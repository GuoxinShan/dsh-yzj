/**
 * Outbound robot sender over the sendMsgUrl webhook: one POST per message with
 * the measured envelope (`msgtype:2` text, optional `param/paramType:3` reply
 * anchor, optional `notifyParams`), response msgId extraction, content
 * chunking under the measured ~5000-char ceiling, and a conservative sustained
 * rate limiter. The fetch face is injectable for tests.
 * @module @dsh-yzj/robot-yzj/outbound
 */

import { ROBOT_ERROR_CONTENT_TOO_LONG, type RobotSendResponse } from './protocol.ts'

/** Minimal fetch face for one JSON POST. */
export type PostJson = (url: string, body: string) => Promise<{ status: number; text: string }>

/** Result of one outbound send attempt. */
export interface RobotSendResult {
  readonly ok: boolean
  /** Server msgId when the send succeeded (measured: matches message history). */
  readonly msgId?: string
  /** Human-readable failure reason; `too-long` maps to errorCode 1401002. */
  readonly error?: string
}

/** Send options; the reply anchor rides the measured `param` + `paramType:3` shape. */
export interface RobotSendOptions {
  /** Anchor the message as a reply to this inbound msgId. */
  readonly replyMsgId?: string
  /** Reply-card summary of the anchored message. */
  readonly replySummary?: string
  /** Reply-card author name. */
  readonly replyPersonName?: string
  /** Restrict the visible notification to these openIds (measured `notifyParams`). */
  readonly notifyOpenIds?: readonly string[]
}

/** Constructor options. */
export interface RobotSenderOptions {
  /** The robot's full sendMsgUrl (token included). */
  readonly sendMsgUrl: string
  /** Chunk ceiling; measured server limit sits between 5000 and 6000 chars. */
  readonly maxChunkChars?: number
  /** Minimum spacing between posts (sustained rate; measured ceiling ≈75/min). */
  readonly minIntervalMs?: number
  /** Injectable POST face; defaults to global fetch. */
  readonly post?: PostJson
  /** Injectable delay for the rate limiter; defaults to setTimeout. */
  readonly delay?: (ms: number) => Promise<void>
}

const DEFAULT_MAX_CHUNK_CHARS = 4_000
const DEFAULT_MIN_INTERVAL_MS = 1_200

/**
 * Rate-limited, chunking robot message sender. `send()` splits over-long text
 * into sequential chunks that each carry the same reply anchor.
 */
export class RobotSender {
  private readonly sendMsgUrl: string
  private readonly maxChunkChars: number
  private readonly minIntervalMs: number
  private readonly post: PostJson
  private readonly delay: (ms: number) => Promise<void>
  private queueTail: Promise<unknown> = Promise.resolve()
  private lastSendAt = 0

  constructor(options: RobotSenderOptions) {
    this.sendMsgUrl = options.sendMsgUrl
    this.maxChunkChars = options.maxChunkChars ?? DEFAULT_MAX_CHUNK_CHARS
    this.minIntervalMs = options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS
    this.post = options.post ?? (async (url, body) => {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json;charset=utf-8' }, body })
      return { status: res.status, text: await res.text() }
    })
    this.delay = options.delay ?? (ms => new Promise(resolve => { setTimeout(resolve, ms) }))
  }

  /**
   * Send one text message (chunked when over the ceiling). Sends are serialized
   * through one queue so the rate limit holds under concurrency.
   * @param text - message body.
   * @param options - reply anchor and notification targets.
   * @returns the last chunk's result (failure short-circuits remaining chunks).
   */
  async send(text: string, options: RobotSendOptions = {}): Promise<RobotSendResult> {
    const run = async (): Promise<RobotSendResult> => {
      const chunks = chunkText(text, this.maxChunkChars)
      let last: RobotSendResult = { ok: false, error: 'empty message' }
      for (const chunk of chunks) {
        last = await this.sendOne(chunk, options)
        if (!last.ok) return last
      }
      return last
    }
    const result = this.queueTail.then(run, run)
    this.queueTail = result.catch(() => undefined)
    return result
  }

  private async sendOne(content: string, options: RobotSendOptions): Promise<RobotSendResult> {
    const wait = this.lastSendAt + this.minIntervalMs - Date.now()
    if (wait > 0) await this.delay(wait)
    this.lastSendAt = Date.now()
    const payload: Record<string, unknown> = { msgtype: 2, content }
    if (options.replyMsgId !== undefined) {
      payload.param = {
        replyMsgId: options.replyMsgId,
        replyTitle: '',
        isReference: true,
        replySummary: options.replySummary ?? content.slice(0, 60),
        replyPersonName: options.replyPersonName ?? '',
      }
      payload.paramType = 3
    }
    if (options.notifyOpenIds !== undefined && options.notifyOpenIds.length > 0) {
      payload.notifyParams = [{ type: 'openIds', values: [...options.notifyOpenIds] }]
    }
    let response: { status: number; text: string }
    try {
      response = await this.post(this.sendMsgUrl, JSON.stringify(payload))
    } catch (error) {
      return { ok: false, error: `post failed: ${String(error)}` }
    }
    let parsed: RobotSendResponse
    try {
      parsed = JSON.parse(response.text) as RobotSendResponse
    } catch {
      return { ok: false, error: `unparseable response (HTTP ${response.status})` }
    }
    if (parsed.success === true) {
      const msgId = parsed.data?.msgId
      return { ok: true, ...(msgId === undefined ? {} : { msgId }) }
    }
    if (parsed.errorCode === ROBOT_ERROR_CONTENT_TOO_LONG) {
      return { ok: false, error: 'too-long' }
    }
    return { ok: false, error: parsed.error ?? `errorCode ${parsed.errorCode ?? 'unknown'}` }
  }
}

/**
 * Split text into chunks at the ceiling without cutting through a paragraph
 * break when one sits near the boundary.
 * @param text - body to split.
 * @param maxChars - chunk ceiling.
 * @returns one or more non-empty chunks whose concatenation equals the input.
 */
export function chunkText(text: string, maxChars: number): string[] {
  if (maxChars < 1) throw new Error('maxChars must be positive')
  if (text === '') return ['']
  const chunks: string[] = []
  let rest = text
  while (rest.length > maxChars) {
    let cut = rest.lastIndexOf('\n', maxChars)
    if (cut < Math.floor(maxChars / 2)) cut = maxChars
    chunks.push(rest.slice(0, cut))
    rest = rest.slice(cut)
  }
  if (rest !== '') chunks.push(rest)
  return chunks
}
