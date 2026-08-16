/**
 * Reconnecting WebSocket client for the robot inbound channel. Owns no policy:
 * it classifies frames (protocol.ts), keeps the connection alive with the
 * measured 30s `{cmd:"ping"}` heartbeat, reconnects with exponential backoff,
 * and drops stale connections. Every dependency (socket factory, timers, clock)
 * is injectable so the lifecycle is unit-testable without a network.
 * @module @dsh-yzj/robot-yzj/socket
 */

import { ackFrame, classifyFrame, type RobotFrame, type RobotInboundMessage } from './protocol.ts'

/** Minimal WebSocket face both the `ws` package and the browser global satisfy. */
export interface WebSocketLike {
  readonly readyState: number
  send(data: string): void
  close(code?: number, reason?: string): void
  addEventListener(type: string, listener: (event: { data?: unknown }) => void): void
}

/** Factory creating one connected-or-connecting socket for a URL. */
export type SocketFactory = (url: string) => WebSocketLike

/** Timer face used by the client; injectable for tests. */
export interface SocketTimers {
  setInterval(handler: () => void, ms: number): unknown
  clearInterval(handle: unknown): void
  setTimeout(handler: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}

/** Live connection status mirrored to the service face. */
export interface SocketStatus {
  connected: boolean
  /** Monotonic reconnect attempt count since the last successful open. */
  attempts: number
  lastError: string | null
  lastFrameAt: number
}

/** Constructor options; every default matches the measured protocol. */
export interface RobotSocketOptions {
  /** Full WebSocket URL (from {@link deriveWebSocketUrl}). */
  readonly url: string
  /** Called for every classified inbound robot message (already deduped upstream). */
  readonly onMessage: (message: RobotInboundMessage, rawFrame: RobotFrame) => void
  /** Status transition callback (connected flips, error notes). */
  readonly onStatus?: (status: SocketStatus) => void
  /** Injectable socket factory; defaults to the global WebSocket. */
  readonly socketFactory?: SocketFactory
  /** Injectable timers; defaults to the host globals. */
  readonly timers?: SocketTimers
  /** Injectable clock in epoch ms; defaults to Date.now. */
  readonly now?: () => number
  /** Heartbeat interval; measured server tolerance fits 30s. */
  readonly heartbeatMs?: number
  /** Reconnect with no inbound traffic beyond this window forces a cycle. */
  readonly staleMs?: number
  /** Backoff base; delay is `base * 2^attempt` capped at 30s. */
  readonly backoffBaseMs?: number
}

const DEFAULT_HEARTBEAT_MS = 30_000
const DEFAULT_STALE_MS = 120_000
const DEFAULT_BACKOFF_BASE_MS = 1_000
const BACKOFF_CAP_MS = 30_000

/**
 * One managed robot inbound connection. `start()` connects; `stop()` closes
 * and cancels every timer; both are idempotent.
 */
export class RobotSocket {
  private readonly options: RobotSocketOptions
  private readonly timers: SocketTimers
  private readonly now: () => number
  private readonly heartbeatMs: number
  private readonly staleMs: number
  private readonly backoffBaseMs: number

  private socket: WebSocketLike | null = null
  private heartbeat: unknown = null
  private reconnect: unknown = null
  private stopped = true
  private attempts = 0
  private lastError: string | null = null
  private lastFrameAt = 0

  constructor(options: RobotSocketOptions) {
    this.options = options
    this.heartbeatMs = options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS
    this.staleMs = options.staleMs ?? DEFAULT_STALE_MS
    this.backoffBaseMs = options.backoffBaseMs ?? DEFAULT_BACKOFF_BASE_MS
    this.timers = options.timers ?? {
      setInterval: (h, ms) => setInterval(h, ms),
      clearInterval: h => clearInterval(h as ReturnType<typeof setInterval>),
      setTimeout: (h, ms) => setTimeout(h, ms),
      clearTimeout: h => clearTimeout(h as ReturnType<typeof setTimeout>),
    }
    this.now = options.now ?? (() => Date.now())
  }

  /** Current live status snapshot. */
  get status(): SocketStatus {
    return { connected: this.socket !== null, attempts: this.attempts, lastError: this.lastError, lastFrameAt: this.lastFrameAt }
  }

  /** Connect and begin heartbeating; a no-op while running. */
  start(): void {
    if (!this.stopped) return
    this.stopped = false
    this.connect()
  }

  /** Close and cancel everything; safe to call repeatedly. */
  stop(): void {
    this.stopped = true
    this.clearHeartbeat()
    if (this.reconnect !== null) {
      this.timers.clearTimeout(this.reconnect)
      this.reconnect = null
    }
    const socket = this.socket
    this.socket = null
    if (socket !== null) {
      try {
        socket.close(1000, 'shutdown')
      } catch {
        // A half-open socket may already be dead; the close error is not ours.
      }
    }
    this.emitStatus()
  }

  private connect(): void {
    if (this.stopped) return
    let socket: WebSocketLike
    try {
      socket = (this.options.socketFactory ?? ((url: string) => new WebSocket(url)))(this.options.url)
    } catch (error) {
      this.scheduleReconnect(`connect failed: ${String(error)}`)
      return
    }
    this.socket = socket
    socket.addEventListener('open', () => {
      this.attempts = 0
      this.lastError = null
      this.lastFrameAt = this.now()
      this.startHeartbeat()
      this.emitStatus()
    })
    socket.addEventListener('message', (event: { data?: unknown }) => {
      this.lastFrameAt = this.now()
      if (typeof event.data !== 'string') return
      const frame = classifyFrame(event.data)
      if (frame.kind === 'robot-message') {
        this.options.onMessage(frame.message, frame)
      } else if (frame.kind === 'message-change' && frame.needAck && frame.seq >= 0) {
        // Unacked pushes redeliver every ~90s (measured); ack immediately.
        try {
          socket.send(ackFrame(frame.seq))
        } catch {
          // A dead socket's close handler already scheduled the reconnect.
        }
      }
    })
    socket.addEventListener('close', () => {
      if (this.stopped) return
      this.socket = null
      this.clearHeartbeat()
      this.scheduleReconnect('closed')
    })
    socket.addEventListener('error', () => {
      if (this.stopped) return
      this.lastError = 'socket error'
      this.emitStatus()
    })
  }

  private startHeartbeat(): void {
    this.clearHeartbeat()
    this.heartbeat = this.timers.setInterval(() => {
      const socket = this.socket
      if (socket === null) return
      if (this.now() - this.lastFrameAt >= this.staleMs) {
        this.forceReconnect('stale connection')
        return
      }
      try {
        socket.send(JSON.stringify({ cmd: 'ping' }))
      } catch (error) {
        this.forceReconnect(`heartbeat failed: ${String(error)}`)
      }
    }, this.heartbeatMs)
  }

  private clearHeartbeat(): void {
    if (this.heartbeat === null) return
    this.timers.clearInterval(this.heartbeat)
    this.heartbeat = null
  }

  private forceReconnect(reason: string): void {
    const socket = this.socket
    this.socket = null
    this.clearHeartbeat()
    if (socket !== null) {
      try {
        socket.close(4000, reason)
      } catch {
        // See stop(): close errors on dead sockets are not actionable.
      }
    }
    this.scheduleReconnect(reason)
  }

  private scheduleReconnect(reason: string): void {
    if (this.stopped || this.reconnect !== null) return
    this.lastError = reason
    this.emitStatus()
    const delay = Math.min(BACKOFF_CAP_MS, this.backoffBaseMs * 2 ** this.attempts)
    this.attempts += 1
    this.reconnect = this.timers.setTimeout(() => {
      this.reconnect = null
      this.connect()
    }, delay)
  }

  private emitStatus(): void {
    this.options.onStatus?.(this.status)
  }
}
