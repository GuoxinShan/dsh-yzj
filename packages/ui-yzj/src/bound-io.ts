/**
 * Bound-home I/O: optimistic ② send, im message list backfill, fused VIEW
 * snapshot. Lives on the node half so robot/ui share `ctx.yzjHome` logs
 * without the browser importing host packages.
 * @module @dsh-yzj/ui-yzj/bound-io
 */

import type { Context } from '@deepseek-ai/cordis'
import {
  cliMessageList, cliMessageToEntry, extractSendMsgId, localMsgId, mergeFused,
  type BoundLogLimits, type FusedItem, type FusedPending, type FusedSessionEvent,
  type YzjBoundMessageLog, type YzjLogEntry, type YzjLogMsgType,
} from '@dsh-yzj/tool-yzj/src/bound-log.ts'
import { digestCandidates, type DigestCandidate } from './handoff-digest.ts'
import { openBoundHome, type HomeOpenAgents, type HomeOpenFace } from './home-open.ts'
import type { YzjWriteRecord } from './write-gate.ts'

/** CLI `--limit` cap for `im message list` (measured). */
export const CLI_LIST_PAGE = 20

/** True when `ctx.yzjHome` exposes the log face (partial fakes used in RPC tests do not). */
export function homeIoFrom(home: unknown): HomeIoFace | undefined {
  if (typeof home !== 'object' || home === null) return undefined
  const face = home as Partial<HomeIoFace>
  if (typeof face.ensureBound !== 'function') return undefined
  if (typeof face.appendLog !== 'function') return undefined
  if (typeof face.getBySession !== 'function') return undefined
  if (face.logs === undefined) return undefined
  return face as HomeIoFace
}

/** Binding + log face used by the RPC layer (ctx.yzjHome). */
export interface HomeIoFace extends HomeOpenFace {
  getByConversation(yzjConversationId: string): { dshSessionId: string; yzjConversationId: string; yzjKind: 'group' | 'dm' } | undefined
  getBySession(dshSessionId: string): { dshSessionId: string; yzjConversationId: string; yzjKind: 'group' | 'dm' } | undefined
  appendLog(
    yzjConversationId: string,
    incoming: YzjLogEntry,
    options?: { readonly skipOpenIds?: readonly string[] },
  ): Promise<{ accepted: boolean; reason: string; entry?: YzjLogEntry }>
  getLog(yzjConversationId: string): YzjBoundMessageLog | undefined
  getLogBySession(dshSessionId: string): YzjBoundMessageLog | undefined
  ackLocal(yzjConversationId: string, localId: string, realMsgId: string): Promise<YzjBoundMessageLog | undefined>
  failLocal(yzjConversationId: string, localId: string): Promise<YzjBoundMessageLog | undefined>
  formatSummonWindow(yzjConversationId: string, excludeMsgId?: string): string
  logs: { getLimits(): BoundLogLimits }
}

/** Parsed `/yzj im-send` / home-send payload. */
export interface ImSendInput {
  readonly groupId: string
  readonly msgType: 'text' | 'richText' | 'file'
  readonly content?: string
  readonly fileId?: string
  readonly fileName?: string
  readonly images: readonly string[]
  readonly replyMsgId?: string
  readonly atOpenIds: readonly string[]
  readonly atAll: boolean
}

/** Result of one user-direct send (no confirm card, no DSH user-turn). */
export type ImSendResult =
  | { readonly ok: true; readonly value: unknown; readonly localId?: string; readonly sessionId?: string }
  | { readonly ok: false; readonly error: string }

/** Login-user projection from `contact user get` (pitfall-003 envelopes). */
export function parseWhoami(json: unknown): { openId: string; name: string } {
  const rows = Array.isArray(json) ? json
    : typeof json === 'object' && json !== null && Array.isArray((json as { list?: unknown }).list)
      ? (json as { list: unknown[] }).list
      : typeof json === 'object' && json !== null && Array.isArray((json as { data?: unknown }).data)
        ? (json as { data: unknown[] }).data
        : typeof json === 'object' && json !== null ? [json] : []
  const user = typeof rows[0] === 'object' && rows[0] !== null ? rows[0] as Record<string, unknown> : {}
  const openId = typeof user.openId === 'string' && user.openId !== '' ? user.openId
    : typeof user.oId === 'string' ? user.oId : ''
  const name = typeof user.name === 'string' ? user.name : ''
  return { openId, name }
}

/** Robot openIds to skip on backfill (T12). Surfaces carry robotId after inbound. */
export function robotSkipOpenIds(robot: { statuses?: () => readonly { surface?: readonly { robotId?: string }[] }[] } | undefined): string[] {
  const ids = new Set<string>()
  for (const channel of robot?.statuses?.() ?? []) {
    for (const surface of channel.surface ?? []) {
      if (typeof surface.robotId === 'string' && surface.robotId !== '') ids.add(surface.robotId)
    }
  }
  return [...ids]
}

/** Validate one IM send payload. Error string on failure. */
export function parseImSend(payload: unknown): ImSendInput | string {
  const record = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {}
  const groupId = typeof record.groupId === 'string' && record.groupId !== '' ? record.groupId : ''
  if (groupId === '') return 'im-send endpoint requires a groupId payload'
  const msgType = typeof record.msgType === 'string' && record.msgType !== '' ? record.msgType : 'text'
  if (msgType !== 'text' && msgType !== 'richText' && msgType !== 'file') {
    return `im-send endpoint rejects msg-type "${msgType}"`
  }
  const content = typeof record.content === 'string' && record.content !== '' ? record.content : undefined
  const fileId = typeof record.fileId === 'string' && record.fileId !== '' ? record.fileId : undefined
  const fileName = typeof record.fileName === 'string' && record.fileName !== '' ? record.fileName : undefined
  const replyMsgId = typeof record.replyMsgId === 'string' && record.replyMsgId !== '' ? record.replyMsgId : undefined
  const rawImages = record.images
  const images = Array.isArray(rawImages)
    ? rawImages.filter((item): item is string => typeof item === 'string' && item !== '')
    : []
  if (msgType === 'file') {
    if (fileId === undefined) return 'im-send: msg-type file requires fileId'
    if (content !== undefined || replyMsgId !== undefined || images.length > 0) {
      return 'im-send: msg-type file does not support content, reply, or images'
    }
  } else {
    if (content === undefined || content.trim() === '') {
      return 'im-send: text/richText require non-empty content'
    }
    if (content.length > 4000) return 'im-send: content over 4000 chars'
    if (msgType !== 'richText' && images.length > 0) {
      return 'im-send: images are only supported for msg-type richText'
    }
  }
  const rawAt = record.atOpenIds
  const atOpenIds = Array.isArray(rawAt)
    ? rawAt.filter((item): item is string => typeof item === 'string' && item !== '')
    : []
  const atAll = record.atAll === true
  if (msgType !== 'file') {
    const atFragments = (content ?? '').match(/@[^@\s，,、]+/g) ?? []
    const atNames = atFragments.filter(frag => frag !== '@all')
    if (atOpenIds.length !== atNames.length) {
      return `im-send: atOpenIds (${atOpenIds.length}) must match the @姓名 fragments in content (${atNames.length}), in order`
    }
    if (atAll && !(content ?? '').includes('@all')) {
      return 'im-send: atAll requires an @all fragment in content'
    }
  }
  return {
    groupId,
    msgType,
    images,
    atOpenIds,
    atAll,
    ...(content === undefined ? {} : { content }),
    ...(fileId === undefined ? {} : { fileId }),
    ...(fileName === undefined ? {} : { fileName }),
    ...(replyMsgId === undefined ? {} : { replyMsgId }),
  }
}

/** CLI argv for `im message send` (no shell interpolation). */
export function imSendArgv(input: ImSendInput): string[] {
  const command = ['im', 'message', 'send', '--msg-type', input.msgType, '--group-id', input.groupId]
  if (input.content !== undefined) command.push('--content', input.content)
  if (input.fileId !== undefined) command.push('--file-id', input.fileId)
  if (input.replyMsgId !== undefined) command.push('--reply-msg-id', input.replyMsgId)
  for (const image of input.images) command.push('--image', image)
  for (const openId of input.atOpenIds) command.push('--at-open-id', openId)
  if (input.atAll) command.push('--at-all')
  return command
}

function digestOfSend(input: ImSendInput): { content: string; msgType: YzjLogMsgType } {
  if (input.msgType === 'file') {
    const name = input.fileName ?? ''
    return { content: name === '' ? '[文件]' : `[文件] ${name}`, msgType: 'file' }
  }
  if (input.msgType === 'richText') {
    return { content: input.content ?? '[图文]', msgType: 'richText' }
  }
  return { content: input.content ?? '', msgType: 'text' }
}

/** Whoami via the bridge; empty on failure. */
export async function whoamiOf(ctx: Context): Promise<{ openId: string; name: string }> {
  try {
    const result = await ctx.yzjBridge.run(['contact', 'user', 'get'])
    if (!result.ok) return { openId: '', name: '' }
    return parseWhoami(result.json)
  } catch {
    return { openId: '', name: '' }
  }
}

/**
 * User-direct send: optimistic ② into the bound log, then CLI send, then
 * ack/fail the local-* row. Never opens a DSH user-turn. Never a confirm card.
 */
export async function sendImAndLog(ctx: Context, home: HomeIoFace | undefined, input: ImSendInput): Promise<ImSendResult> {
  let sessionId: string | undefined
  let localId: string | undefined
  if (home !== undefined) {
    const kind = input.groupId.startsWith('BOT-') ? 'dm' : 'group'
    try {
      const bound = await home.ensureBound(input.groupId, kind)
      sessionId = bound.sessionId
    } catch (error) {
      return { ok: false, error: `home bind failed: ${String(error)}` }
    }
    const self = await whoamiOf(ctx)
    const digest = digestOfSend(input)
    localId = localMsgId()
    const entry: YzjLogEntry = {
      msgId: localId,
      sentAt: Date.now(),
      fromOpenId: self.openId,
      fromName: self.name === '' ? '我' : self.name,
      content: digest.content,
      msgType: digest.msgType,
      origin: 'dsh-send',
      isSelf: true,
      status: 'pending',
      ...(input.replyMsgId === undefined ? {} : { replyMsgId: input.replyMsgId }),
    }
    try {
      await home.appendLog(input.groupId, entry)
    } catch (error) {
      return { ok: false, error: `bound log append failed: ${String(error)}` }
    }
  }
  let result
  try {
    result = await ctx.yzjBridge.run(imSendArgv(input))
  } catch (error) {
    if (home !== undefined && localId !== undefined) await home.failLocal(input.groupId, localId)
    return { ok: false, error: `im message send failed: ${String(error)}；请确认已安装 yzj-cli 并完成 \`yzj-cli auth login\`` }
  }
  if (!result.ok) {
    if (home !== undefined && localId !== undefined) await home.failLocal(input.groupId, localId)
    const detail = result.stderr.trim() === '' ? `im message send failed (exit ${result.exitCode})` : result.stderr.trim()
    return { ok: false, error: detail }
  }
  const json = result.json ?? {}
  const realId = extractSendMsgId(json)
  if (home !== undefined && localId !== undefined) {
    if (realId !== undefined) await home.ackLocal(input.groupId, localId, realId)
    else await home.ackLocal(input.groupId, localId, localId)
  }
  return {
    ok: true,
    value: json,
    ...(localId === undefined ? {} : { localId }),
    ...(sessionId === undefined ? {} : { sessionId }),
  }
}

/** Pull recent N Yunzhijia messages into the bound log (T9). */
export async function backfillBoundLog(
  ctx: Context,
  home: HomeIoFace,
  yzjConversationId: string,
  limit?: number,
): Promise<{ appended: number; skipped: number }> {
  let binding = home.getByConversation(yzjConversationId)
  if (binding === undefined) {
    await home.ensureBound(yzjConversationId, yzjConversationId.startsWith('BOT-') ? 'dm' : 'group')
    binding = home.getByConversation(yzjConversationId)
  }
  if (binding === undefined) return { appended: 0, skipped: 0 }
  const cap = Math.max(1, limit ?? home.logs.getLimits().backfillLimit)
  const self = await whoamiOf(ctx)
  const skip = robotSkipOpenIds(ctx.get('yzjRobot') as { statuses?: () => readonly { surface?: readonly { robotId?: string }[] }[] } | undefined)
  let appended = 0
  let skipped = 0
  let remaining = cap
  let cursor: string | undefined
  while (remaining > 0) {
    const page = Math.min(CLI_LIST_PAGE, remaining)
    const command = ['im', 'message', 'list', '--group-id', yzjConversationId, '--limit', String(page)]
    if (cursor === undefined) command.push('--type', 'newest')
    else command.push('--type', 'old', '--msg-id', cursor)
    let result
    try {
      result = await ctx.yzjBridge.run(command)
    } catch {
      break
    }
    if (!result.ok) break
    const rows = cliMessageList(result.json)
    if (rows.length === 0) break
    const oldest = rows[0]
    const oldestId = typeof oldest === 'object' && oldest !== null
      ? String((oldest as { msgId?: unknown }).msgId ?? (oldest as { id?: unknown }).id ?? '')
      : ''
    for (const row of rows) {
      const entry = cliMessageToEntry(row, 'backfill', self.openId)
      if (entry === undefined) {
        skipped += 1
        continue
      }
      const outcome = await home.appendLog(yzjConversationId, entry, { skipOpenIds: skip })
      if (outcome.accepted) appended += 1
      else skipped += 1
    }
    remaining -= rows.length
    if (rows.length < page || oldestId === '' || oldestId === cursor) break
    cursor = oldestId
  }
  return { appended, skipped }
}

function eventTime(event: { time?: unknown; timestamp?: unknown }): number {
  if (typeof event.time === 'number') return event.time
  if (typeof event.timestamp === 'number') return event.timestamp
  return 0
}

/** Project host session events into the fused-view leaf shape. */
export function sessionEventsOf(agent: { session?: { events?: readonly { type: string; time?: number; timestamp?: number; data?: unknown }[] } } | undefined): FusedSessionEvent[] {
  const events = agent?.session?.events ?? []
  return events.map(event => ({
    type: event.type,
    time: eventTime(event),
    data: event.data ?? {},
  }))
}

/** Pending write-gate rows for the fused overlay (G3 still host memory). */
export function pendingOf(records: readonly YzjWriteRecord[]): FusedPending[] {
  return records
    .filter(record => record.status === 'pending')
    .map(record => ({
      writeId: record.writeId,
      time: record.time,
      toolName: record.toolName,
      status: record.status,
    }))
}

/** One fused snapshot for a DSH session (unbound → bound:false). */
export function fusedSnapshot(
  home: HomeIoFace,
  sessionId: string,
  agent: { session?: { events?: readonly { type: string; time?: number; timestamp?: number; data?: unknown }[] } } | undefined,
  writes: readonly YzjWriteRecord[],
): {
  bound: boolean
  binding?: { dshSessionId: string; yzjConversationId: string; yzjKind: 'group' | 'dm' }
  log?: YzjBoundMessageLog
  items: FusedItem[]
  candidates: DigestCandidate[]
} {
  const events = sessionEventsOf(agent)
  const candidates = digestCandidates(events)
  const binding = home.getBySession(sessionId)
  if (binding === undefined) return { bound: false, items: [], candidates }
  const log = home.getLog(binding.yzjConversationId)
  const items = mergeFused(log?.entries ?? [], events, pendingOf(writes))
  return { bound: true, binding, ...(log === undefined ? {} : { log }), items, candidates }
}

/** Structural plugin user-turn (ui-yzj must not import dsh-llm — dual-face tsconfig). */
function pluginTurn(text: string): { role: 'user'; content: { type: 'text'; text: string }[]; source: { kind: 'plugin'; plugin: string } } {
  return {
    role: 'user',
    content: [{ type: 'text', text }],
    source: { kind: 'plugin', plugin: 'ui-yzj' },
  }
}

/**
 * D8 handoff: bind the target group, post the confirmed digest as ②, then
 * inject the summon window and followup so Claude continues as the group home.
 */
export async function handoffToGroup(options: {
  readonly ctx: Context
  readonly home: HomeIoFace
  readonly agents: HomeOpenAgents & {
    get(sessionId: string): {
      inject?: (message: unknown) => void
      followup?: (message: unknown) => void
    } | undefined
  }
  readonly groupId: string
  readonly digest: string
  readonly cwd: string
}): Promise<{ sessionId: string; created: boolean } | { error: string }> {
  if (options.digest.trim() === '') return { error: 'home-handoff: digest is empty' }
  let opened
  try {
    opened = await openBoundHome({
      home: options.home,
      agents: options.agents,
      yzjConversationId: options.groupId,
      cwd: options.cwd,
    })
  } catch (error) {
    return { error: `home-handoff open failed: ${String(error)}` }
  }
  const sent = await sendImAndLog(options.ctx, options.home, {
    groupId: options.groupId,
    msgType: 'text',
    content: options.digest,
    images: [],
    atOpenIds: [],
    atAll: false,
  })
  if (!sent.ok) return { error: sent.error }
  const live = options.agents.get(opened.sessionId)
  const agent = typeof live === 'object' && live !== null
    ? live as { inject?: (message: unknown) => void; followup?: (message: unknown) => void }
    : undefined
  const window = options.home.formatSummonWindow(options.groupId)
  try {
    if (window !== '') agent?.inject?.(pluginTurn(window))
    agent?.followup?.(pluginTurn('用户从私密会话把工作丢进了本群。请基于群里刚发出的摘要，以本群共享身份继续协作。'))
  } catch (error) {
    return { error: `home-handoff followup failed: ${String(error)}` }
  }
  return { sessionId: opened.sessionId, created: opened.created }
}
