/**
 * Durable bound-session message log (docs/spec/dsh-home-transcript.md).
 * ① inbound / ② DSH-send live here — never as harness Session.append events.
 * The fused VIEW merges this log with official session events by timestamp.
 * @module @dsh-yzj/tool-yzj/bound-log
 */

import { z } from 'zod'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import type { Domain, KvTable } from '@deepseek-ai/dsh-storage-domain'
import type { YzjConversationKind } from './home.ts'

/** Product origin of one log row (T1/T7). */
export type YzjLogOrigin = 'inbound' | 'dsh-send' | 'backfill'

/** Wire/status of one log row. Only ② uses pending/failed. */
export type YzjLogStatus = 'pending' | 'acked' | 'failed'

/** Digest-level message kind stored in the log (no binaries). */
export type YzjLogMsgType = 'text' | 'richText' | 'file' | 'other'

/** One durable IM row keyed by (yzjConversationId, msgId). */
export interface YzjLogEntry {
  readonly msgId: string
  readonly sentAt: number
  readonly fromOpenId: string
  readonly fromName: string
  readonly content: string
  readonly msgType: YzjLogMsgType
  readonly origin: YzjLogOrigin
  readonly isSelf: boolean
  readonly replyMsgId?: string
  readonly status: YzjLogStatus
  /** CLI `param` (file_id / desc / reply quote / cards). Optional so old blobs still parse. */
  readonly param?: Record<string, unknown>
}

/** One conversation's log header + rows (ascending sentAt). */
export interface YzjBoundMessageLog {
  readonly yzjConversationId: string
  readonly dshSessionId: string
  readonly yzjKind: YzjConversationKind
  readonly updatedAt: number
  readonly entries: readonly YzjLogEntry[]
}

/** Caps that must stay Config fields, not code constants (spec §3.4). */
export interface BoundLogLimits {
  readonly backfillLimit: number
  readonly summonWindowMessages: number
  readonly summonWindowChars: number
  readonly logRetention: number
}

/** Default caps from the transcript spec. */
export const DEFAULT_BOUND_LOG_LIMITS: BoundLogLimits = {
  backfillLimit: 50,
  summonWindowMessages: 20,
  summonWindowChars: 4000,
  logRetention: 500,
}

/** Result of one append attempt. */
export interface BoundLogAppendResult {
  readonly accepted: boolean
  readonly reason:
    | 'appended'
    | 'duplicate'
    | 'echo-collapsed'
    | 'promoted-to-dsh-send'
    | 'robot-skipped'
    | 'anomaly-kept'
    | 'unbound'
  readonly entry?: YzjLogEntry
}

const entrySchema = z.object({
  msgId: z.string().min(1),
  sentAt: z.number(),
  fromOpenId: z.string(),
  fromName: z.string(),
  content: z.string(),
  msgType: z.enum(['text', 'richText', 'file', 'other']),
  origin: z.enum(['inbound', 'dsh-send', 'backfill']),
  isSelf: z.boolean(),
  replyMsgId: z.string().optional(),
  status: z.enum(['pending', 'acked', 'failed']),
  param: z.record(z.string(), z.unknown()).optional(),
}) as unknown as z.ZodType<YzjLogEntry>

const logSchema = z.object({
  yzjConversationId: z.string().min(1),
  dshSessionId: z.string().min(1),
  yzjKind: z.enum(['group', 'dm']),
  updatedAt: z.number(),
  entries: z.array(entrySchema),
}) as unknown as z.ZodType<YzjBoundMessageLog>

/** Durable domain: one log per Yunzhijia conversation id. */
export const yzjHomeLogDomainSpec = defineDomain({
  name: 'yzj_home_logs',
  version: 0,
  tables: {
    logs: domainTable<string, YzjBoundMessageLog>(logSchema),
  },
})

/** True when this id is an optimistic DSH-send placeholder (T8). */
export function isLocalMsgId(msgId: string): boolean {
  return msgId.startsWith('local-')
}

/** Allocate an optimistic ② primary key. */
export function localMsgId(now = Date.now()): string {
  return `local-${now}`
}

/** Parse CLI `sendTime` ("YYYY-MM-DD HH:mm:ss.SSS") into unix ms. */
export function parseSendTime(text: unknown, fallback = Date.now()): number {
  const value = typeof text === 'string' ? text.trim() : ''
  if (value === '') return fallback
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const parsed = Date.parse(normalized)
  return Number.isFinite(parsed) ? parsed : fallback
}

/** Coerce a CLI/robot msgType into the log vocabulary. */
export function logMsgTypeOf(value: unknown): YzjLogMsgType {
  const text = typeof value === 'string' ? value : ''
  if (text === 'richText' || text === 'file' || text === 'text' || text === 'other') return text
  if (text === 'image' || text === 'img') return 'richText'
  return text === '' ? 'text' : 'other'
}

/** Digest one CLI message body (no binaries). */
export function digestOfCliMessage(record: Record<string, unknown>): string {
  const content = typeof record.content === 'string' ? record.content : ''
  if (content !== '') return content
  const msgType = logMsgTypeOf(record.msgType)
  const param = typeof record.param === 'object' && record.param !== null
    ? record.param as Record<string, unknown>
    : {}
  if (msgType === 'file') {
    const name = typeof param.name === 'string' ? param.name : ''
    return name === '' ? '[文件]' : `[文件] ${name}`
  }
  if (msgType === 'richText') return content === '' ? '[图文]' : content
  const title = typeof param.title === 'string' ? param.title : ''
  return title === '' ? `[${msgType}]` : title
}

/**
 * Project one CLI `im message list` row into a log entry. Caller sets origin
 * and isSelf; robot skip happens before append.
 */
export function cliMessageToEntry(
  record: unknown,
  origin: YzjLogOrigin,
  selfOpenId: string,
): YzjLogEntry | undefined {
  const row = typeof record === 'object' && record !== null ? record as Record<string, unknown> : {}
  const msgId = typeof row.msgId === 'string' && row.msgId !== ''
    ? row.msgId
    : typeof row.id === 'string' && row.id !== '' ? row.id : ''
  if (msgId === '') return undefined
  const param = typeof row.param === 'object' && row.param !== null
    ? row.param as Record<string, unknown>
    : {}
  const fromOpenId = typeof row.fromOpenId === 'string' ? row.fromOpenId
    : typeof row.openId === 'string' ? row.openId : ''
  const fromUser = typeof row.fromUser === 'object' && row.fromUser !== null
    ? row.fromUser as Record<string, unknown>
    : {}
  const fromName = typeof row.fromName === 'string' ? row.fromName
    : typeof fromUser.name === 'string' ? fromUser.name
      : typeof row.userName === 'string' ? row.userName : ''
  const replyMsgId = typeof param.replyMsgId === 'string' && param.replyMsgId !== ''
    ? param.replyMsgId
    : typeof row.replyMsgId === 'string' && row.replyMsgId !== '' ? row.replyMsgId : undefined
  const entry: YzjLogEntry = {
    msgId,
    sentAt: parseSendTime(row.sendTime ?? row.time),
    fromOpenId,
    fromName,
    content: digestOfCliMessage(row),
    msgType: logMsgTypeOf(row.msgType),
    origin,
    isSelf: selfOpenId !== '' && fromOpenId === selfOpenId,
    status: 'acked',
    ...(replyMsgId === undefined ? {} : { replyMsgId }),
    ...(Object.keys(param).length === 0 ? {} : { param }),
  }
  return entry
}

/** Unwrap CLI list envelopes (pitfall-003: bare array / list / data). */
export function cliMessageList(json: unknown): unknown[] {
  if (Array.isArray(json)) return json
  if (typeof json !== 'object' || json === null) return []
  const record = json as Record<string, unknown>
  if (Array.isArray(record.list)) return record.list
  if (Array.isArray(record.data)) return record.data
  if (typeof record.data === 'object' && record.data !== null) {
    const inner = record.data as Record<string, unknown>
    if (Array.isArray(inner.list)) return inner.list
    if (Array.isArray(inner.messages)) return inner.messages
  }
  if (Array.isArray(record.messages)) return record.messages
  return []
}

/** Extract the real msgId from an `im message send` CLI payload. */
export function extractSendMsgId(json: unknown): string | undefined {
  if (typeof json !== 'object' || json === null) return undefined
  const record = json as Record<string, unknown>
  for (const key of ['msgId', 'id', 'messageId']) {
    const value = record[key]
    if (typeof value === 'string' && value !== '') return value
  }
  if (typeof record.data === 'object' && record.data !== null) {
    const inner = record.data as Record<string, unknown>
    for (const key of ['msgId', 'id', 'messageId']) {
      const value = inner[key]
      if (typeof value === 'string' && value !== '') return value
    }
  }
  return undefined
}

function sameSpeakerAndBody(a: YzjLogEntry, b: YzjLogEntry): boolean {
  return a.fromOpenId === b.fromOpenId && a.content === b.content
}

function sortEntries(entries: YzjLogEntry[]): YzjLogEntry[] {
  return [...entries].sort((left, right) => {
    if (left.sentAt !== right.sentAt) return left.sentAt - right.sentAt
    return left.msgId.localeCompare(right.msgId)
  })
}

function trimRetention(entries: YzjLogEntry[], retention: number): YzjLogEntry[] {
  if (entries.length <= retention) return entries
  return entries.slice(entries.length - retention)
}

/**
 * Apply T7/T8/T12 collision rules. Pure: returns the next entries array.
 */
export function applyAppend(
  existing: readonly YzjLogEntry[],
  incoming: YzjLogEntry,
  options: { readonly skipOpenIds?: readonly string[] } = {},
): { entries: YzjLogEntry[]; result: BoundLogAppendResult } {
  if (options.skipOpenIds !== undefined && options.skipOpenIds.includes(incoming.fromOpenId)) {
    return { entries: [...existing], result: { accepted: false, reason: 'robot-skipped' } }
  }
  const byId = new Map(existing.map(entry => [entry.msgId, entry]))
  const hit = byId.get(incoming.msgId)
  if (hit !== undefined) {
    if (hit.origin === 'dsh-send' && incoming.origin !== 'dsh-send') {
      return { entries: [...existing], result: { accepted: false, reason: 'echo-collapsed', entry: hit } }
    }
    if (hit.origin !== 'dsh-send' && incoming.origin === 'dsh-send' && sameSpeakerAndBody(hit, incoming)) {
      const promoted: YzjLogEntry = { ...hit, origin: 'dsh-send', isSelf: true, status: 'acked' }
      byId.set(hit.msgId, promoted)
      return {
        entries: sortEntries([...byId.values()]),
        result: { accepted: true, reason: 'promoted-to-dsh-send', entry: promoted },
      }
    }
    if (hit.origin !== 'dsh-send' && incoming.origin === 'dsh-send') {
      return { entries: [...existing], result: { accepted: false, reason: 'anomaly-kept', entry: hit } }
    }
    return { entries: [...existing], result: { accepted: false, reason: 'duplicate', entry: hit } }
  }
  const next = sortEntries([...existing, incoming])
  return { entries: next, result: { accepted: true, reason: 'appended', entry: incoming } }
}

/**
 * Rewrite an optimistic `local-*` row to the real msgId after CLI ack (T8).
 * If the real id already exists, collapse the local row (echo).
 */
export function ackLocalEntry(
  existing: readonly YzjLogEntry[],
  localId: string,
  realMsgId: string,
): YzjLogEntry[] {
  const local = existing.find(entry => entry.msgId === localId)
  if (local === undefined) return [...existing]
  const withoutLocal = existing.filter(entry => entry.msgId !== localId)
  const collision = withoutLocal.find(entry => entry.msgId === realMsgId)
  if (collision !== undefined) {
    const promoted: YzjLogEntry = collision.origin === 'dsh-send'
      ? { ...collision, status: 'acked' }
      : { ...collision, origin: 'dsh-send', isSelf: true, status: 'acked' }
    return sortEntries(withoutLocal.map(entry => entry.msgId === realMsgId ? promoted : entry))
  }
  return sortEntries([...withoutLocal, { ...local, msgId: realMsgId, status: 'acked' }])
}

/** Mark an optimistic ② row failed (keep the bubble; do not roll into ③). */
export function failLocalEntry(existing: readonly YzjLogEntry[], localId: string): YzjLogEntry[] {
  return existing.map(entry => entry.msgId === localId ? { ...entry, status: 'failed' as const } : entry)
}

/**
 * Summon-window digest (spec §5.2). Both summon paths MUST call this.
 * Empty window → '' (do not inject an empty block).
 */
export function formatSummonWindow(
  log: YzjBoundMessageLog | undefined,
  options: {
    readonly maxMessages: number
    readonly maxChars: number
    readonly excludeMsgId?: string
  },
): string {
  if (log === undefined) return ''
  const acked = log.entries.filter(entry => {
    if (entry.status !== 'acked') return false
    if (options.excludeMsgId !== undefined && entry.msgId === options.excludeMsgId) return false
    return true
  })
  const window = acked.slice(-Math.max(0, options.maxMessages))
  const lines: string[] = []
  let chars = 0
  const header = '［本群最近消息（仅本轮上下文，非完整群档）］'
  for (let index = window.length - 1; index >= 0; index -= 1) {
    const entry = window[index]
    if (entry === undefined) continue
    const when = formatWindowTime(entry.sentAt)
    const who = entry.isSelf ? '我' : (entry.fromName === '' ? entry.fromOpenId : entry.fromName)
    const reply = entry.replyMsgId === undefined ? '' : ` 回复 ${shortReply(log, entry.replyMsgId)}`
    const line = `[${when}] ${who}: ${entry.content}${reply}`
    if (chars + line.length + 1 > options.maxChars && lines.length > 0) break
    lines.unshift(line)
    chars += line.length + 1
  }
  if (lines.length === 0) return ''
  return `${header}\n${lines.join('\n')}`
}

function formatWindowTime(sentAt: number): string {
  const date = new Date(sentAt)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function shortReply(log: YzjBoundMessageLog, replyMsgId: string): string {
  const hit = log.entries.find(entry => entry.msgId === replyMsgId)
  if (hit === undefined) return replyMsgId.slice(0, 8)
  const digest = hit.content.replace(/\s+/g, ' ').slice(0, 24)
  return digest === '' ? replyMsgId.slice(0, 8) : digest
}

/** Lightweight session event the fused view sorts against. */
export interface FusedSessionEvent {
  readonly type: string
  readonly time: number
  readonly data: unknown
}

/** Write-gate pending overlay (host memory; G3 still not a session event). */
export interface FusedPending {
  readonly writeId: string
  readonly time: number
  readonly toolName: string
  readonly status: string
}

/** One row of the fused VIEW (not written to the official session log). */
export type FusedItem =
  | { readonly kind: 'im'; readonly time: number; readonly entry: YzjLogEntry }
  | { readonly kind: 'session'; readonly time: number; readonly hide: boolean; readonly event: FusedSessionEvent }
  | { readonly kind: 'pending'; readonly time: number; readonly pending: FusedPending }

/** True when a user/message is a plugin followup trigger (spec §4.4) — hide in the fused view. */
export function isPluginFollowup(event: FusedSessionEvent): boolean {
  if (event.type !== 'user/message') return false
  const data = typeof event.data === 'object' && event.data !== null ? event.data as Record<string, unknown> : {}
  const source = typeof data.source === 'object' && data.source !== null ? data.source as Record<string, unknown> : {}
  return source.kind === 'plugin'
}

/** Latest user/message source kind on a session log (write-gate split). */
export function latestUserSourceKind(events: readonly { type: string; data: unknown }[]): 'user' | 'plugin' | 'none' {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event === undefined || event.type !== 'user/message') continue
    const data = typeof event.data === 'object' && event.data !== null ? event.data as Record<string, unknown> : {}
    const source = typeof data.source === 'object' && data.source !== null ? data.source as Record<string, unknown> : {}
    return source.kind === 'plugin' ? 'plugin' : 'user'
  }
  return 'none'
}

/**
 * Merge ①② log rows with official ③④ events and write-gate pending.
 * Ascending; same-ms IM before session (summon ① before its followup).
 * Pending cards stick after the last session event with time ≤ pending.time.
 */
export function mergeFused(
  entries: readonly YzjLogEntry[],
  events: readonly FusedSessionEvent[],
  pending: readonly FusedPending[] = [],
): FusedItem[] {
  const items: FusedItem[] = []
  for (const entry of entries) {
    items.push({ kind: 'im', time: entry.sentAt, entry })
  }
  for (const event of events) {
    items.push({
      kind: 'session',
      time: event.time,
      hide: isPluginFollowup(event),
      event,
    })
  }
  items.sort((left, right) => {
    if (left.time !== right.time) return left.time - right.time
    const rank = (item: FusedItem): number => item.kind === 'im' ? 0 : item.kind === 'session' ? 1 : 2
    return rank(left) - rank(right)
  })
  const withPending = [...items]
  const orderedPending = [...pending].sort((a, b) => a.time - b.time)
  for (const card of orderedPending) {
    let insertAt = withPending.length
    for (let index = withPending.length - 1; index >= 0; index -= 1) {
      const item = withPending[index]
      if (item !== undefined && item.kind === 'session' && item.time <= card.time) {
        insertAt = index + 1
        break
      }
    }
    withPending.splice(insertAt, 0, { kind: 'pending', time: card.time, pending: card })
  }
  return withPending
}

/** Durable store: one log per yzjConversationId, memory-fallback until open(). */
export class BoundLogStore {
  private logs: KvTable<string, YzjBoundMessageLog> | undefined
  private readonly memory = new Map<string, YzjBoundMessageLog>()
  private limits: BoundLogLimits = DEFAULT_BOUND_LOG_LIMITS

  /** Apply Config caps (schema fields, not constants). */
  setLimits(limits: Partial<BoundLogLimits>): void {
    this.limits = { ...this.limits, ...limits }
  }

  /** Current caps. */
  getLimits(): BoundLogLimits {
    return this.limits
  }

  /** Open (or adopt) the domain; safe to await repeatedly. */
  async open(facility: { open(spec: typeof yzjHomeLogDomainSpec): Promise<Domain<typeof yzjHomeLogDomainSpec>> }): Promise<void> {
    if (this.logs !== undefined) return
    const domain = await facility.open(yzjHomeLogDomainSpec)
    this.logs = domain.table('logs')
    for (const [key, value] of this.memory) {
      if (this.logs.get(key) === undefined) await this.logs.put(key, value)
    }
    this.memory.clear()
  }

  /** Close the domain (idempotent). */
  async close(): Promise<void> {
    this.logs = undefined
  }

  /** Log for one Yunzhijia conversation, or undefined. */
  get(yzjConversationId: string): YzjBoundMessageLog | undefined {
    return this.logs?.get(yzjConversationId) ?? this.memory.get(yzjConversationId)
  }

  /** Ensure a header exists (binding table is authority for dshSessionId). */
  async ensureHeader(
    yzjConversationId: string,
    dshSessionId: string,
    yzjKind: YzjConversationKind,
  ): Promise<YzjBoundMessageLog> {
    const existing = this.get(yzjConversationId)
    if (existing !== undefined) {
      if (existing.dshSessionId === dshSessionId && existing.yzjKind === yzjKind) return existing
      const synced: YzjBoundMessageLog = { ...existing, dshSessionId, yzjKind, updatedAt: Date.now() }
      await this.put(synced)
      return synced
    }
    const created: YzjBoundMessageLog = {
      yzjConversationId,
      dshSessionId,
      yzjKind,
      updatedAt: Date.now(),
      entries: [],
    }
    await this.put(created)
    return created
  }

  /** Append one row with T8 collision rules. */
  async append(
    yzjConversationId: string,
    dshSessionId: string,
    yzjKind: YzjConversationKind,
    incoming: YzjLogEntry,
    options: { readonly skipOpenIds?: readonly string[] } = {},
  ): Promise<BoundLogAppendResult> {
    const header = await this.ensureHeader(yzjConversationId, dshSessionId, yzjKind)
    const { entries, result } = applyAppend(header.entries, incoming, options)
    if (!result.accepted && result.reason !== 'promoted-to-dsh-send') return result
    const next: YzjBoundMessageLog = {
      ...header,
      updatedAt: Date.now(),
      entries: trimRetention(entries, this.limits.logRetention),
    }
    await this.put(next)
    return result
  }

  /** Rewrite local-* → real msgId after CLI ack. */
  async ackLocal(yzjConversationId: string, localId: string, realMsgId: string): Promise<YzjBoundMessageLog | undefined> {
    const header = this.get(yzjConversationId)
    if (header === undefined) return undefined
    const next: YzjBoundMessageLog = {
      ...header,
      updatedAt: Date.now(),
      entries: ackLocalEntry(header.entries, localId, realMsgId),
    }
    await this.put(next)
    return next
  }

  /** Mark local-* failed. */
  async failLocal(yzjConversationId: string, localId: string): Promise<YzjBoundMessageLog | undefined> {
    const header = this.get(yzjConversationId)
    if (header === undefined) return undefined
    const next: YzjBoundMessageLog = {
      ...header,
      updatedAt: Date.now(),
      entries: failLocalEntry(header.entries, localId),
    }
    await this.put(next)
    return next
  }

  private async put(log: YzjBoundMessageLog): Promise<void> {
    if (this.logs !== undefined) {
      await this.logs.put(log.yzjConversationId, log)
      return
    }
    this.memory.set(log.yzjConversationId, log)
  }
}
