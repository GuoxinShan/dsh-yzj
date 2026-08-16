/**
 * Chatnode bridge — cross-process delivery between an ops scheduler daemon
 * (dsh-routines) and the robot channels hosted by the web profile, with no
 * second robot connection and no robot credentials on the ops side.
 *
 * Two halves of the same contract (`ChatnodeService`, the dsh-routines
 * delivery interface):
 *
 * - `ChatnodeBridge` (bridge listener, web profile): an exact HTTP route on
 *   the profile's `webServer` (`POST /yzj/chatnode`). It authenticates a
 *   shared bearer token, validates the JSON body, and pushes through the
 *   robot channel's outbound via `notify` — one channel index from config
 *   (`chatnodeRobotIndex`) when the caller does not choose one.
 * - `ChatnodeBridgeClient` (bridge client, ops profile): a `ctx.chatnode`
 *   provider whose `send` POSTs to the listener. It holds only the target
 *   URL and the shared token — no sendMsgUrl, no WebSocket, no session
 *   machinery.
 *
 * The web profile's server binds loopback only (the web-app startup fence
 * rejects non-loopback hosts), so the surface is localhost-local; the token
 * is defense in depth, and route registration is opt-in via `bridgeToken`.
 * @module @dsh-yzj/robot-yzj/bridge
 */

import { Context, Service } from '@deepseek-ai/cordis'
import { timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ChatnodeService, ChatnodeRobotFace } from './chatnode.ts'

/** Body-size cap for one bridge request (digests are bounded by the sender). */
const MAX_BODY_BYTES = 256 * 1024
/** Client request timeout; a wedged listener must not wedge the scheduler. */
const CLIENT_TIMEOUT_MS = 15_000

/** Options for the listener half. */
export interface ChatnodeBridgeOptions {
  /** The robot-channel face the bridge pushes through. */
  robot: ChatnodeRobotFace
  /** Channel index used when the caller does not name one. */
  defaultRobotIndex: number
  /** Shared bearer token every request must present. */
  token: string
}

/** The bridge request body (lossless JSON only). */
interface BridgePayload {
  text?: unknown
  title?: unknown
  robotIndex?: unknown
}

/** Read a request body with a hard size cap; rejects on overflow. */
function readBody(req: IncomingMessage, cap: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > cap) {
        req.destroy()
        reject(new Error(`body exceeds ${cap} bytes`))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/** Write one JSON response (optional extra headers merged in). */
function json(res: ServerResponse, status: number, body: unknown, extraHeaders: Record<string, string> = {}): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...extraHeaders })
  res.end(JSON.stringify(body))
}

/** Constant-time bearer check: `Authorization: Bearer <token>`. */
function authorized(req: IncomingMessage, token: string): boolean {
  const expected = `Bearer ${token}`
  const actual = req.headers.authorization ?? ''
  if (expected.length !== actual.length) return false
  return timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
}

/**
 * Bridge listener: one webServer route owning the full request/response
 * lifecycle of `POST /yzj/chatnode`. Never throws across the handler seam —
 * every failure is a JSON error response (400/401/405/502), so a malformed
 * request cannot take down the web process.
 */
export class ChatnodeBridge {
  constructor(private readonly options: ChatnodeBridgeOptions) {}

  /** Handle one request; answers and ends the response. */
  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'POST') {
      json(res, 405, { ok: false, error: 'method not allowed' }, { allow: 'POST' })
      return
    }
    if (!authorized(req, this.options.token)) {
      json(res, 401, { ok: false, error: 'unauthorized' })
      return
    }
    let raw: string
    try {
      raw = await readBody(req, MAX_BODY_BYTES)
    } catch {
      json(res, 400, { ok: false, error: 'request body too large' })
      return
    }
    let payload: BridgePayload
    try {
      payload = JSON.parse(raw) as BridgePayload
    } catch {
      json(res, 400, { ok: false, error: 'invalid json body' })
      return
    }
    if (typeof payload.text !== 'string' || payload.text.trim() === '') {
      json(res, 400, { ok: false, error: 'text must be a non-empty string' })
      return
    }
    const title = typeof payload.title === 'string' && payload.title !== '' ? payload.title : undefined
    const robotIndex = Number.isInteger(payload.robotIndex) ? payload.robotIndex as number : this.options.defaultRobotIndex
    const body = title === undefined ? payload.text : `${title}\n\n${payload.text}`
    const result = await this.options.robot.notify(body, robotIndex)
    if (!result.ok) {
      json(res, 502, { ok: false, error: result.error ?? 'delivery failed' })
      return
    }
    json(res, 200, { ok: true, ...(result.msgId === undefined ? {} : { msgId: result.msgId }) })
  }
}

/**
 * Bridge client: the `ctx.chatnode` provider for a profile without robot
 * channels. `send` POSTs the digest to the listener with the shared token;
 * failures throw (the scheduler records them in its `deliveries` array and
 * never crashes). Title prefixing happens on the listener side, keeping the
 * wire format raw contract fields.
 */
export class ChatnodeBridgeClient extends Service implements ChatnodeService {
  static inject = []

  /**
   * @param ctx - plugin context (provides the service as `ctx.chatnode`).
   * @param target - full listener URL, e.g. `http://127.0.0.1:3080/yzj/chatnode`.
   * @param token - shared bearer token the listener requires.
   */
  constructor(ctx: Context, private readonly target: string, private readonly token: string) {
    super(ctx, 'chatnode')
  }

  /** Push one digest to the bridge listener. */
  async send(input: { text: string; title?: string }): Promise<void> {
    let res: Response
    try {
      res = await fetch(this.target, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({ text: input.text, ...(input.title === undefined || input.title === '' ? {} : { title: input.title }) }),
        signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
      })
    } catch (error) {
      throw new Error(`yzj chatnode bridge unreachable: ${error instanceof Error ? error.message : String(error)}`)
    }
    let data: { ok?: unknown; error?: unknown } | null = null
    try {
      data = await res.json() as { ok?: unknown; error?: unknown }
    } catch {
      // Non-JSON error body — the status line still carries the failure.
    }
    if (!res.ok) {
      const detail = typeof data?.error === 'string' ? ` ${data.error}` : ''
      throw new Error(`yzj chatnode bridge: HTTP ${res.status}${detail}`)
    }
    // A 2xx body that is not `{ok:true}` (e.g. the web SPA fallback answering
    // an unregistered route with index.html) is a delivery failure, not a
    // success — the digest never reached a robot channel.
    if (data?.ok !== true) {
      throw new Error('yzj chatnode bridge: listener answered 2xx without ok:true — route not active?')
    }
  }
}
