/**
 * Host plugin for the Yunzhijia robot channel: wires the measured inbound
 * WebSocket (protocol.ts / socket.ts), the outbound sender (outbound.ts), and
 * the session router (router.ts) into one Cordis service (`ctx.yzjRobot`).
 * Lifecycle is effect-owned — stop/unload closes the socket, cancels every
 * timer, and leaves no residue. The allowFrom policy resolves the CLI login
 * user's openId through the bridge (`contact user get`), so by default only
 * the machine's owner can drive the robot.
 * @module @dsh-yzj/robot-yzj
 */

import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { SocketStatus } from './socket.ts'
import { RobotSocket } from './socket.ts'
import { deriveWebSocketUrl } from './protocol.ts'
import { RobotSender } from './outbound.ts'
import { RobotRouter, dmSessionId } from './router.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    yzjRobot: YzjRobot
  }
}

/** Plugin configuration; the schema fills every default. */
export interface Config {
  /** The robot's sendMsgUrl (from the personal-robot page). Empty disables the channel. */
  sendMsgUrl?: string
  /** Whether to bring the channel up once the plugin loads. Defaults to true. */
  enabled?: boolean
  /** openIds allowed to drive the robot; defaults to the CLI login user. */
  allowFrom?: string[]
}

const ConfigSchema: z<Config> = z.object({
  sendMsgUrl: z.string().default(''),
  enabled: z.boolean().default(true),
  allowFrom: z.array(z.string()).default([]),
})

const DEFAULT_ACK_TEXT = '收到，处理中…'
const DEFAULT_DENY_TEXT = '抱歉，你不在本机器人的白名单内。'

/** Live status projected to RPC consumers (lossless JSON). */
export interface RobotStatus {
  configured: boolean
  connected: boolean
  lastError: string | null
  lastFrameAt: number
}

/**
 * The robot-channel service: one managed connection plus the outbound face.
 * `send()` is the proactive-push entry (routines, reminders); inbound turns
 * flow through the internal router into per-DM agent sessions.
 */
export class YzjRobot extends Service {
  static Config: z<Config> = ConfigSchema
  static inject = ['yzjBridge']

  private readonly config: Config
  private socket: RobotSocket | null = null
  private router: RobotRouter | null = null
  private sender: RobotSender | null = null
  private status: SocketStatus = { connected: false, attempts: 0, lastError: null, lastFrameAt: 0 }
  private allowFromCache: readonly string[] | undefined

  constructor(ctx: Context, config: Config) {
    super(ctx, 'yzjRobot')
    this.config = config
  }

  /** Current projected status for RPC/UI consumers. */
  getStatus(): RobotStatus {
    return {
      configured: this.config.sendMsgUrl !== '',
      connected: this.status.connected,
      lastError: this.status.lastError,
      lastFrameAt: this.status.lastFrameAt,
    }
  }

  /** Proactive outbound push (routines, digests, reminders). */
  async send(text: string): Promise<{ ok: boolean; msgId?: string; error?: string }> {
    if (this.sender === null) return { ok: false, error: 'robot channel not started' }
    return this.sender.send(text)
  }

  /** Stable DM session id for the configured robot and one user openId. */
  dmSession(robotId: string, operatorOpenid: string): string {
    return dmSessionId(robotId, operatorOpenid)
  }

  /** Start the channel (idempotent); called by apply() and by later restarts. */
  start(): void {
    if (this.socket !== null || this.config.sendMsgUrl === '' || !this.config.enabled) return
    const sender = new RobotSender({ sendMsgUrl: this.config.sendMsgUrl })
    const router = new RobotRouter({
      ownerCtx: this.ctx,
      agents: this.ctx.agents,
      sender,
      allowFrom: () => this.resolveAllowFrom(),
      ackText: DEFAULT_ACK_TEXT,
      denyText: DEFAULT_DENY_TEXT,
      logger: { warn: message => this.ctx.logger.warn(message) },
    })
    const socket = new RobotSocket({
      url: deriveWebSocketUrl(this.config.sendMsgUrl),
      onMessage: message => {
        void router.handle(message)
      },
      onStatus: status => {
        this.status = status
      },
    })
    this.sender = sender
    this.router = router
    this.socket = socket
    socket.start()
  }

  /** Stop and clear the channel (idempotent). */
  stop(): void {
    this.socket?.stop()
    this.socket = null
    this.router = null
    this.sender = null
  }

  /** allowFrom policy: explicit config list, else the CLI login user once. */
  private async resolveAllowFrom(): Promise<readonly string[]> {
    if (this.allowFromCache !== undefined) return this.allowFromCache
    const configured = this.config.allowFrom ?? []
    if (configured.length > 0) {
      this.allowFromCache = configured
      return configured
    }
    const bridge = this.ctx.get('yzjBridge')
    if (bridge === undefined) {
      this.ctx.logger.warn('robot: yzjBridge unavailable; allowFrom stays empty')
      this.allowFromCache = []
      return []
    }
    try {
      const result = await bridge.run(['contact', 'user', 'get'], { timeoutMs: 15_000 })
      const users = Array.isArray(result.json) ? result.json : []
      const first = users[0] as { openId?: string } | undefined
      const openId = typeof first?.openId === 'string' ? first.openId : ''
      this.allowFromCache = openId === '' ? [] : [openId]
    } catch (error) {
      this.ctx.logger.warn(`robot: whoami failed: ${String(error)}`)
      this.allowFromCache = []
    }
    return this.allowFromCache
  }
}

/** Plugin entry: expose the service and own the socket lifecycle. */
export function apply(ctx: Context, config: Config): void {
  const robot = new YzjRobot(ctx, config)
  ctx.effect(() => {
    robot.start()
    return () => robot.stop()
  }, 'robot-yzj: channel lifecycle')
}
