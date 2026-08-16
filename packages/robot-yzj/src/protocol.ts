/**
 * Wire protocol for the Yunzhijia robot channel: inbound frame shapes measured
 * against `wss://<host>/xuntong/websocket?yzjtoken=…` (see
 * docs/spec/robot-channel-plan.md §4.1), the sendMsgUrl derivation, and
 * the inbound msgId dedupe store. Pure functions and plain data only — no
 * sockets, no timers, so every rule here is directly unit-testable.
 * @module @dsh-yzj/robot-yzj/protocol
 */

/** One inbound robot message (WS `directPush/robotMessage` payload, measured). */
export interface RobotInboundMessage {
  /** Message type; 2 = text. */
  readonly type: number
  /** Encrypted robot id (the robot's id in the same space as CLI group ids). */
  readonly robotId: string
  readonly robotName: string
  /** Sender's openId. */
  readonly operatorOpenid: string
  readonly operatorName: string
  /** Unix epoch milliseconds. */
  readonly time: number
  readonly msgId: string
  readonly content: string
  /** 3 = the BOT-DM/group surface this robot lives on. */
  readonly groupType: number
  /** Conversation id in the CLI id space (e.g. `BOT-<a>-BOT-<b>` for personal-robot DMs). */
  readonly groupId: string
  /** Stringified JSON reply metadata when the user replied to a message. */
  readonly msgParam?: string
  /**
   * True for DSH-side fabricated turns (`robot_continue`): the message never
   * existed on the server, so outbound replies must not carry a reply anchor
   * and session resolution continues the last anchored conversation instead
   * of anchoring a fresh thread at a fake msgId.
   */
  readonly synthetic?: boolean
}

/** Parsed `msgParam` reply chain of one inbound message (measured field set). */
export interface RobotReplyMeta {
  readonly replyMsgId: string
  readonly replyPersonId: string
  readonly replyPersonName: string
  readonly replySummary: string
  /** Server-maintained chain root — session anchoring never walks the chain. */
  readonly replyRootMsgId: string
}

/** Success envelope of one sendMsgUrl POST (measured). */
export interface RobotSendResponse {
  readonly success: boolean
  readonly errorCode?: number
  readonly error?: string
  readonly data?: { groupId?: string; msgId?: string; sendTime?: string } | null
}

/** Sentinal error code for over-long content (measured: 5000 ok, 6000 fail). */
export const ROBOT_ERROR_CONTENT_TOO_LONG = 1401002

/**
 * Build the wire ack for a `msgChg` push the server marked `needAck`.
 * Unacked pushes are re-delivered every ~90s (measured), so every push with
 * a seq gets exactly one `{"cmd":"ack","seq":N}` reply.
 * @param seq - the pushed frame's seq.
 */
export function ackFrame(seq: number): string {
  return JSON.stringify({ cmd: 'ack', seq })
}

/**
 * Derive the inbound WebSocket URL from a robot's sendMsgUrl.
 * `wss://<host>/xuntong/websocket?yzjtoken=<token>` — an outbound-originating
 * long connection, so no public callback is needed.
 * @param sendMsgUrl - the robot's full send URL including its yzjtoken.
 * @returns the WebSocket URL.
 * @throws Error when the URL is unparseable or carries no yzjtoken.
 */
export function deriveWebSocketUrl(sendMsgUrl: string): string {
  const parsed = new URL(sendMsgUrl)
  const token = parsed.searchParams.get('yzjtoken')?.trim()
  if (token === undefined || token === '') throw new Error('sendMsgUrl missing yzjtoken')
  if (parsed.host === '') throw new Error('sendMsgUrl missing host')
  return `wss://${parsed.host}/xuntong/websocket?yzjtoken=${encodeURIComponent(token)}`
}

/** Parse a raw WS text frame into a typed view; unknown frames stay `kind:'other'`. */
export type RobotFrame =
  | { kind: 'auth' }
  | { kind: 'pong' }
  | { kind: 'sync'; lastUpdateTime: string }
  | { kind: 'robot-message'; message: RobotInboundMessage; reply?: RobotReplyMeta }
  | { kind: 'message-change'; msgId: string; needAck: boolean; seq: number }
  | { kind: 'other'; raw: string }

/**
 * Classify one raw WebSocket text frame by the measured protocol.
 * @param raw - the frame's text payload.
 * @returns the typed frame; `other` for everything unrecognized.
 */
export function classifyFrame(raw: string): RobotFrame {
  let payload: unknown
  try {
    payload = JSON.parse(raw) as unknown
  } catch {
    return { kind: 'other', raw }
  }
  if (payload === null || typeof payload !== 'object') return { kind: 'other', raw }
  const record = payload as Record<string, unknown>
  const cmd = typeof record.cmd === 'string' ? record.cmd : ''
  if (cmd === 'auth') return { kind: 'auth' }
  if (cmd === 'pong') return { kind: 'pong' }
  if (cmd === 'message' && typeof record.lastUpdateTime === 'string') {
    return { kind: 'sync', lastUpdateTime: record.lastUpdateTime }
  }
  if (cmd === 'directPush' && record.type === 'robotMessage') {
    const msg = record.msg
    if (msg === null || typeof msg !== 'object') return { kind: 'other', raw }
    const m = msg as Record<string, unknown>
    if (typeof m.msgId !== 'string' || typeof m.content !== 'string') return { kind: 'other', raw }
    const msgParam = typeof m.msgParam === 'string' ? m.msgParam : undefined
    const message: RobotInboundMessage = {
      type: typeof m.type === 'number' ? m.type : 2,
      robotId: typeof m.robotId === 'string' ? m.robotId : '',
      robotName: typeof m.robotName === 'string' ? m.robotName : '',
      operatorOpenid: typeof m.operatorOpenid === 'string' ? m.operatorOpenid : '',
      operatorName: typeof m.operatorName === 'string' ? m.operatorName : '',
      time: typeof m.time === 'number' ? m.time : 0,
      msgId: m.msgId,
      content: m.content,
      groupType: typeof m.groupType === 'number' ? m.groupType : 3,
      groupId: typeof m.groupId === 'string' ? m.groupId : '',
      ...(msgParam === undefined ? {} : { msgParam }),
    }
    return { kind: 'robot-message', message, ...parseReplyMeta(msgParam) }
  }
  if (cmd === 'directPush' && record.type === 'msgChg') {
    const msg = record.msg
    const inner = msg !== null && typeof msg === 'object' ? msg as Record<string, unknown> | null : null
    return {
      kind: 'message-change',
      msgId: typeof inner?.msgId === 'string' ? inner.msgId : '',
      needAck: record.needAck === true,
      seq: typeof record.seq === 'number' ? record.seq : -1,
    }
  }
  return { kind: 'other', raw }
}

/**
 * Parse the stringified `msgParam` of an inbound message into its reply chain.
 * @param msgParam - raw `msgParam` field, when present.
 * @returns the reply meta wrapped for object spread, or undefined.
 */
export function parseReplyMeta(msgParam: string | undefined): { reply?: RobotReplyMeta } {
  if (msgParam === undefined) return {}
  try {
    const parsed = JSON.parse(msgParam) as Record<string, unknown>
    if (typeof parsed.replyMsgId !== 'string') return {}
    return {
      reply: {
        replyMsgId: parsed.replyMsgId,
        replyPersonId: typeof parsed.replyPersonId === 'string' ? parsed.replyPersonId : '',
        replyPersonName: typeof parsed.replyPersonName === 'string' ? parsed.replyPersonName : '',
        replySummary: typeof parsed.replySummary === 'string' ? parsed.replySummary : '',
        replyRootMsgId: typeof parsed.replyRootMsgId === 'string' ? parsed.replyRootMsgId : parsed.replyMsgId,
      },
    }
  } catch {
    return {}
  }
}

/**
 * Bounded msgId dedupe for one robot connection. The same msgId can arrive on
 * both the WebSocket and a webhook entry; TTL keeps the table small without a
 * background sweep.
 */
export class InboundDedupe {
  private readonly seen = new Map<string, number>()

  /**
   * Mark one msgId seen.
   * @param msgId - inbound message id; empty ids never dedupe.
   * @param ttlMs - retention window in milliseconds.
   * @returns true when this call is the first sighting (process the message).
   */
  markSeen(msgId: string, ttlMs: number = 600_000): boolean {
    const key = msgId.trim()
    if (key === '') return true
    const now = Date.now()
    for (const [id, expiresAt] of this.seen) {
      if (expiresAt <= now) this.seen.delete(id)
    }
    const expiresAt = this.seen.get(key)
    if (expiresAt !== undefined && expiresAt > now) return false
    this.seen.set(key, now + ttlMs)
    return true
  }
}
