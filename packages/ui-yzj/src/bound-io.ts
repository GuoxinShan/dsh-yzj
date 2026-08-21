/**
 * Bound-home I/O: optimistic ② send, im message list backfill, group-room
 * snapshot. Lives on the node half so robot/ui share `ctx.yzjHome` logs
 * without the browser importing host packages.
 * @module @dsh-yzj/ui-yzj/bound-io
 */

import type { Context } from '@deepseek-ai/cordis'
import {
  cliMessageList, cliMessageToEntry, clipLogParam, extractSendMsgId, localMsgId, mergeFused,
  type BoundLogLimits, type FusedItem, type FusedPending, type FusedSessionEvent,
  type YzjBoundMessageLog, type YzjLogEntry, type YzjLogMsgType,
} from '@dsh-yzj/tool-yzj/src/bound-log.ts'
import { parseContactUser } from './contact-parse.ts'
import { digestCandidates, textOfSessionEvent, type DigestCandidate } from './handoff-digest.ts'
import { artifactBadgeOf, writeFileNameOf, type ArtifactBadge } from './artifact-badge.ts'
import {
  openBoundHome, openTopicHome, lastSessionTitle, isPlaceholderRoomTitle, identifiedUserMessage, publishHostSession, topicAgentRoute,
  topicAgentComposition,
  type HomeOpenAgents, type HomeOpenFace, type TopicAgentRoute, type TopicAgentSetup,
} from './home-open.ts'
import type { YzjWriteRecord } from './write-gate.ts'
import type { TopicEnsureInput, TopicEnsureResult, TopicRecord } from '@dsh-yzj/tool-yzj/src/topics.ts'
import { sessionHasSummonWindow } from '@dsh-yzj/tool-yzj/src/index.ts'

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
  formatSummonWindow(yzjConversationId: string, excludeMsgId?: string, sessionId?: string): string
  logs: { getLimits(): BoundLogLimits }
  ensureTopic?(input: TopicEnsureInput): Promise<TopicEnsureResult>
  getTopicBySession?(dshSessionId: string): TopicRecord | undefined
  getTopicByOutbound?(msgId: string): TopicRecord | undefined
  listTopics?(yzjConversationId: string): TopicRecord[]
  setTopicStatus?(dshSessionId: string, status: NonNullable<TopicRecord['status']>): Promise<void>
  /** Register an outbound post so reply chains continue this topic (R4 / R29). */
  registerTopicOutbound?(msgId: string, dshSessionId: string): Promise<void>
  /** Every group-room binding (workbench session list / L1 merge). */
  listBindings?(): { dshSessionId: string; yzjConversationId: string; yzjKind: 'group' | 'dm' }[]
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
  /** Stamp the log row so topic reply chips count this post (R29). */
  readonly topicSessionId?: string
}

/** Result of one user-direct send (no confirm card, no DSH user-turn). */
export type ImSendResult =
  | { readonly ok: true; readonly value: unknown; readonly localId?: string; readonly sessionId?: string }
  | { readonly ok: false; readonly error: string }

/** Login-user projection from `contact user get` (pitfall-003 envelopes). */
export function parseWhoami(json: unknown): { openId: string; name: string } {
  const user = parseContactUser(json)
  return { openId: user.openId, name: user.name }
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

const contactNameCache = new Map<string, string>()

/** Directory lookup for an empty fromName. Process-local cache keyed by openId. */
async function contactNameOf(ctx: Context, openId: string): Promise<string> {
  if (openId === '') return ''
  const cached = contactNameCache.get(openId)
  if (cached !== undefined) return cached
  try {
    const result = await ctx.yzjBridge.run(['contact', 'user', 'get', '--open-id', openId])
    if (!result.ok) return ''
    const name = parseWhoami(result.json).name
    if (name !== '') contactNameCache.set(openId, name)
    return name
  } catch {
    return ''
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
    const sendParam = clipLogParam({
      ...(input.replyMsgId === undefined ? {} : { replyMsgId: input.replyMsgId }),
      ...(input.msgType === 'file'
        ? { file_id: input.fileId ?? '', name: input.fileName ?? '', ext: (input.fileName ?? '').split('.').pop() ?? '' }
        : {}),
      ...(input.msgType === 'richText' && input.images.length > 0
        ? {
            desc: input.images.map(fileId => ({
              type: 'image',
              data: fileId,
              start: (input.content ?? '').indexOf('[图片]'),
              length: 4,
            })),
          }
        : {}),
    })
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
      ...(input.topicSessionId === undefined ? {} : { topicSessionId: input.topicSessionId }),
      ...(sendParam === undefined ? {} : { param: sendParam }),
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
  beforeMsgId?: string,
): Promise<{ appended: number; skipped: number; more: boolean }> {
  let binding = home.getByConversation(yzjConversationId)
  if (binding === undefined) {
    await home.ensureBound(yzjConversationId, yzjConversationId.startsWith('BOT-') ? 'dm' : 'group')
    binding = home.getByConversation(yzjConversationId)
  }
  if (binding === undefined) return { appended: 0, skipped: 0, more: false }
  const cap = Math.max(1, limit ?? home.logs.getLimits().backfillLimit)
  const self = await whoamiOf(ctx)
  const skip = robotSkipOpenIds(ctx.get('yzjRobot') as { statuses?: () => readonly { surface?: readonly { robotId?: string }[] }[] } | undefined)
  let appended = 0
  let skipped = 0
  let remaining = cap
  let cursor: string | undefined = beforeMsgId
  let more = false
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
    if (rows.length === 0) {
      more = false
      break
    }
    const oldest = rows[0]
    const oldestId = typeof oldest === 'object' && oldest !== null
      ? String((oldest as { msgId?: unknown }).msgId ?? (oldest as { id?: unknown }).id ?? '')
      : ''
    more = rows.length === page
    for (const row of rows) {
      const parsed = cliMessageToEntry(row, 'backfill', self.openId)
      if (parsed === undefined) {
        skipped += 1
        continue
      }
      const filledName = parsed.fromName === '' && parsed.fromOpenId !== ''
        ? await contactNameOf(ctx, parsed.fromOpenId)
        : parsed.fromName
      const entry = filledName === parsed.fromName ? parsed : { ...parsed, fromName: filledName }
      const robotHit = skip.includes(entry.fromOpenId)
      const topic = home.getTopicByOutbound?.(entry.msgId)
      const incoming = robotHit
        ? {
            ...entry,
            origin: 'robot-outbound' as const,
            isSelf: false,
            fromName: entry.fromName === '' ? '助手' : entry.fromName,
            ...(topic === undefined ? {} : { topicSessionId: topic.dshSessionId }),
          }
        : entry
      const outcome = await home.appendLog(yzjConversationId, incoming)
      if (outcome.accepted) appended += 1
      else skipped += 1
    }
    remaining -= rows.length
    if (rows.length < page || oldestId === '' || oldestId === cursor) {
      more = rows.length === page && oldestId !== '' && oldestId !== cursor
      break
    }
    cursor = oldestId
  }
  return { appended, skipped, more }
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
  topics: TopicRecord[]
  groupName?: string
} {
  const events = sessionEventsOf(agent)
  const candidates = digestCandidates(events)
  const topic = home.getTopicBySession?.(sessionId)
  const binding = home.getBySession(sessionId)
    ?? (topic === undefined ? undefined : home.getByConversation(topic.yzjConversationId))
  if (binding === undefined) return { bound: false, items: [], candidates, topics: [] }
  const log = home.getLog(binding.yzjConversationId)
  const items = mergeFused(log?.entries ?? [], events, pendingOf(writes))
  const topics = home.listTopics?.(binding.yzjConversationId) ?? []
  const pinned = lastSessionTitle(events)
  const groupName = pinned !== '' && !isPlaceholderRoomTitle(pinned) ? pinned : ''
  return {
    bound: true,
    binding,
    ...(log === undefined ? {} : { log }),
    items,
    candidates,
    topics,
    ...(groupName === '' ? {} : { groupName }),
  }
}

/** Group-room VIEW: IM rows + topic list, no ③④ (R2). */
export function roomSnapshot(
  home: HomeIoFace,
  sessionId: string,
): {
  bound: boolean
  kind: 'room' | 'topic' | 'unbound'
  binding?: { dshSessionId: string; yzjConversationId: string; yzjKind: 'group' | 'dm' }
  topic?: TopicRecord
  topics: TopicRecord[]
  items: FusedItem[]
} {
  const topic = home.getTopicBySession?.(sessionId)
  if (topic !== undefined) {
    const binding = home.getByConversation(topic.yzjConversationId)
    return {
      bound: true,
      kind: 'topic',
      ...(binding === undefined ? {} : { binding }),
      topic,
      topics: home.listTopics?.(topic.yzjConversationId) ?? [],
      items: [],
    }
  }
  const binding = home.getBySession(sessionId)
  if (binding === undefined) return { bound: false, kind: 'unbound', topics: [], items: [] }
  const log = home.getLog(binding.yzjConversationId)
  const items: FusedItem[] = (log?.entries ?? []).map(entry => ({
    kind: 'im' as const,
    time: entry.sentAt,
    entry,
  }))
  return {
    bound: true,
    kind: 'room',
    binding,
    topics: home.listTopics?.(binding.yzjConversationId) ?? [],
    items,
  }
}

/**
 * IM snapshot keyed by Yunzhijia group id (R24). Does not need a live
 * agent — the plugin log is the timeline. Missing binding still returns a
 * room row so the workbench can paint before ensureBound.
 */
export function roomSnapshotForGroup(
  home: HomeIoFace,
  groupId: string,
): {
  bound: boolean
  kind: 'room'
  binding: { dshSessionId: string; yzjConversationId: string; yzjKind: 'group' | 'dm' }
  topics: TopicRecord[]
  items: FusedItem[]
} {
  const binding = home.getByConversation(groupId)
  const log = home.getLog(groupId)
  const items: FusedItem[] = (log?.entries ?? []).map(entry => ({
    kind: 'im' as const,
    time: entry.sentAt,
    entry,
  }))
  const yzjKind = groupId.startsWith('BOT-') ? 'dm' : 'group'
  return {
    bound: true,
    kind: 'room',
    binding: binding ?? { dshSessionId: '', yzjConversationId: groupId, yzjKind },
    topics: home.listTopics?.(groupId) ?? [],
    items,
  }
}

/** One file card under a topic-lens assistant bubble (DSH-local, not IM). */
export type TopicLensArtifact = ArtifactBadge

/** One bubble in the topic-drawer IM lens (plugin followups omitted). */
export interface TopicLensBubble {
  readonly id: string
  readonly role: 'user' | 'assistant'
  readonly text: string
  readonly time: number
  readonly artifacts?: readonly TopicLensArtifact[]
}

const LENS_MAX_ARTIFACTS = 8

function uniqueWriteNames(names: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const name of names) {
    if (seen.has(name)) continue
    seen.add(name)
    out.push(name)
    if (out.length >= LENS_MAX_ARTIFACTS) break
  }
  return out
}

function badgesOf(names: readonly string[]): TopicLensArtifact[] {
  return uniqueWriteNames(names).map(name => artifactBadgeOf(name))
}

/**
 * Walk one session's events into lens bubbles. `write`/`edit` files ride
 * the next assistant bubble (leftover names attach to the last assistant).
 */
function lensBubblesFromEvents(
  events: readonly FusedSessionEvent[],
  idPrefix: string,
): TopicLensBubble[] {
  const out: TopicLensBubble[] = []
  let pending: string[] = []
  const flushWrites = (bubble: TopicLensBubble): TopicLensBubble => {
    if (pending.length === 0) return bubble
    const extras = badgesOf(pending)
    pending = []
    const prior = bubble.artifacts ?? []
    return { ...bubble, artifacts: [...prior, ...extras] }
  }
  for (const event of events) {
    if (event.type === 'tool/call') {
      const name = writeFileNameOf(event.data)
      if (name !== undefined) pending.push(name)
      continue
    }
    const text = textOfSessionEvent(event)
    if (text === '') continue
    const role: 'user' | 'assistant' = event.type === 'assistant/message' ? 'assistant' : 'user'
    let bubble: TopicLensBubble = {
      id: `${idPrefix}${out.length}`,
      role,
      text,
      time: event.time,
    }
    if (role === 'assistant') bubble = flushWrites(bubble)
    out.push(bubble)
  }
  if (pending.length === 0) return out
  for (let index = out.length - 1; index >= 0; index -= 1) {
    const row = out[index]
    if (row?.role !== 'assistant') continue
    out[index] = flushWrites(row)
    return out
  }
  out.push({
    id: `${idPrefix}${out.length}`,
    role: 'assistant',
    text: '产物',
    time: events[events.length - 1]?.time ?? 0,
    artifacts: badgesOf(pending),
  })
  return out
}

/**
 * Lens stream: topic session events, plus leftover host ③④ when this is
 * the H9 「历史对话」 topic (`fromSessionId`). Plugin injects stay hidden.
 * Write/edit files appear on the assistant bubble (R30) as DSH-local
 * cards. Job-done (R29) still uploads and posts the same files to the
 * group; the lens does not replace that send.
 */
export function topicLensBubbles(
  topic: TopicRecord,
  agents: { get(id: string): { session?: { events?: readonly { type: string; time?: number; timestamp?: number; data?: unknown }[] } } | undefined },
): TopicLensBubble[] {
  const fromHost = topic.fromSessionId === undefined || topic.fromSessionId === ''
    ? []
    : lensBubblesFromEvents(sessionEventsOf(agents.get(topic.fromSessionId)), 'h')
  const fromTopic = lensBubblesFromEvents(sessionEventsOf(agents.get(topic.dshSessionId)), 't')
  return [...fromHost, ...fromTopic].sort((a, b) => a.time - b.time)
}

/** User-authored followup (drawer 「问助手」). Visible in the lens. Must carry `id`. */
function userTurn(text: string): ReturnType<typeof identifiedUserMessage> {
  return identifiedUserMessage(text, { kind: 'user' })
}

/**
 * Dream 抽取指令（spec §17.2 手动径，决策 38）。单一事实源在 host：
 * `advance-dream-run` RPC 直建 `yzj-dream-*` 会话并以首条 user turn 注入，
 * 不再经 client askDraft / 话题问助手栏。
 */
export function dreamAskPrompt(): string {
  return '请做一轮 Dream 抽取。流程与纪律:\n1) yzj_advance_dream_status 读蓄水池 pending 清单。\n2) 取材(关键——别凭一行摘要瞎猜):dir: 文档类条目(新增/更新文档《…》)必先 yzj_doc_get + yzj_doc_block_list 读正文再判;im: 消息条目拿不准语境就 yzj_im_message_list 以该消息为锚读前后各 10 条还原讨论;判断与哪个事项相关时 yzj_advance_get 翻候选事项最近事元找对照,或 yzj_doc_search 找背景。\n3) 逐条与 open 事项比对(yzj_advance_inspect):有价值的按纪律 feed(refs 用池条目的 channel+refId 组装成 im:<groupId>:<msgId> token 抄进去,面板才能定位到具体群消息;禁止把池条目 id(dp-*)抄进 refs——那只是池内键,不是原始出处;detail 必须写出你读到的原文要点,不是复述标题;进度正常静默挂但仍落进度事元;偏差事元 detail 必须写推论链:事实→影响了什么→为什么),命中打扰判据才 feed changeType=决策请求 stageTo=decision-needed 形成建议卡:summary=要我决定的问题,detail=问题分析+动作行(每行一个,可多个:`动作: 建待办 | 内容: <标题> | 截止: <yyyy-MM-dd> | 负责人: <名字>` / `动作: 发消息 | 内容: <草稿>` / `动作: 定会议 | 主题: <主题> | 时间: <yyyy-MM-dd HH:mm>`)——建议必须落到可执行动作,我在看板一键执行;若该事项已有未处理的决策请求,不要并列起新卡——feed 一张综合卡(detail 带一行「综合自: <旧卡 entryId>」写明旧问题的并入/失效,host 会校验),卡面永远只有一条当前决策且必须带最新上下文;无关的跳过。\n4) 最后 yzj_advance_dream_mark(ids=[已处理条目 id]) 并给我一句「抽取 N 条/产出 M 条建议」的总结。直接连续调用工具完成,不要询问我。'
}

/** `yzj-dream-<yyyymmdd-hhmmss>` stamp, newest-last sortable. */
function dreamStamp(): string {
  const now = new Date()
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

/**
 * One-shot Dream session (决策 38): mint `yzj-dream-<stamp>`, start the
 * distillation as turn 1, then pin the board title so the sidebar lists it
 * immediately. The caller focuses the GUI on the returned sessionId.
 */
export async function runDreamSession(options: {
  readonly agents: HomeOpenAgents & {
    get(sessionId: string): { followup?: (message: unknown) => void } | undefined
  }
  readonly cwd: string
  readonly agentOptions?: TopicAgentRoute
  readonly agentPreset?: string
  readonly setup?: TopicAgentSetup
  readonly pending: number
}): Promise<{ sessionId: string }> {
  const sessionId = `yzj-dream-${dreamStamp()}`
  await options.agents.create({
    sessionId,
    meta: {
      cwd: options.cwd,
      ...(options.agentPreset === undefined ? {} : { agentPreset: options.agentPreset }),
    },
    ...(options.agentOptions === undefined ? {} : { agentOptions: options.agentOptions }),
    ...(options.setup === undefined ? {} : { setup: options.setup }),
  })
  const live = options.agents.get(sessionId) as
    | { followup?: (message: unknown) => void }
    | undefined
  if (live?.followup === undefined) throw new Error('advance-dream-run: agent followup unavailable')
  live.followup(userTurn(dreamAskPrompt()))
  publishHostSession(live, `Dream 抽取 · 池中 ${options.pending} 条`, true, true)
  return { sessionId }
}

/**
 * Ask the topic agent without focusing native Chat. Resume-or-create the
 * topic session, plant the summon window once as a plugin inject, then
 * `followup` a user turn (H18 / pitfall-031). Opening the topic does not
 * start a turn.
 */
export async function askTopicAssistant(options: {
  readonly home: HomeIoFace
  readonly agents: HomeOpenAgents & {
    get(sessionId: string): { followup?: (message: unknown) => void } | undefined
  }
  readonly cwd: string
  readonly topicSessionId: string
  readonly text: string
  readonly agentOptions?: TopicAgentRoute
  readonly agentPreset?: string
  readonly setup?: TopicAgentSetup
}): Promise<{ ok: true } | { error: string }> {
  const text = options.text.trim()
  if (text === '') return { error: 'home-topic-ask: text is empty' }
  const topic = options.home.getTopicBySession?.(options.topicSessionId)
  if (topic === undefined) return { error: 'home-topic-ask: not a topic session' }
  if (options.agents.get(options.topicSessionId) === undefined) {
    try {
      await options.agents.resume({
        resumeSessionId: options.topicSessionId,
        ...(options.agentOptions === undefined ? {} : { agentOptions: options.agentOptions }),
        ...(options.setup === undefined ? {} : { setup: options.setup }),
      })
    } catch {
      await options.agents.create({
        sessionId: options.topicSessionId,
        meta: {
          cwd: options.cwd,
          ...(options.agentPreset === undefined ? {} : { agentPreset: options.agentPreset }),
        },
        ...(options.agentOptions === undefined ? {} : { agentOptions: options.agentOptions }),
        ...(options.setup === undefined ? {} : { setup: options.setup }),
      })
    }
  }
  const live = options.agents.get(options.topicSessionId) as
    | {
      followup?: (message: unknown) => void
      inject?: (message: unknown) => void
      session?: { events?: readonly { type: string; data: unknown }[] }
    }
    | undefined
  if (live?.followup === undefined) return { error: 'home-topic-ask: agent followup unavailable' }
  const window = options.home.formatSummonWindow(topic.yzjConversationId, undefined, options.topicSessionId)
  if (window !== '' && !sessionHasSummonWindow(live.session?.events ?? [])) {
    live.inject?.(pluginTurn(window))
  }
  live.followup(userTurn(text))
  if (topic.rootMsgId !== undefined && topic.rootMsgId !== '' && options.home.ensureTopic !== undefined) {
    await options.home.ensureTopic({
      yzjConversationId: topic.yzjConversationId,
      source: topic.source,
      rootMsgId: topic.rootMsgId,
    })
  }
  return { ok: true }
}

/** One topic row in the workbench session list / topic drawer. */
export interface GroupSpaceTopic {
  readonly sessionId: string
  readonly title: string
  readonly source: string
  readonly lastActivity: number
  readonly status: 'running' | 'confirm' | 'done'
  readonly rootMsgId?: string
  readonly originWho?: string
  readonly originText?: string
  readonly originTime?: number
}

/** One group-room parent (bound rooms feeding L1 merge). */
export interface GroupSpaceRoom {
  readonly groupId: string
  readonly groupName: string
  readonly sessionId: string
  readonly yzjKind: 'group' | 'dm'
  readonly topics: readonly GroupSpaceTopic[]
}

/**
 * Bound-room snapshot: every binding as a parent plus its topics (L1 merge).
 * Group display name prefers the pinned host `session/title`.
 */
export function groupSpaceSnapshot(
  home: HomeIoFace,
  agents?: { get(id: string): { session?: { events?: readonly { type: string; data?: unknown }[] } } | undefined },
): { rooms: GroupSpaceRoom[] } {
  const rooms = (home.listBindings?.() ?? []).map((binding) => {
    const topics = (home.listTopics?.(binding.yzjConversationId) ?? []).map(topic => ({
      sessionId: topic.dshSessionId,
      title: topic.title,
      source: topic.source,
      lastActivity: topic.lastActivity ?? topic.createdAt,
      status: topic.status === 'confirm' || topic.status === 'done' ? topic.status : 'running' as const,
      ...(topic.rootMsgId === undefined ? {} : { rootMsgId: topic.rootMsgId }),
      ...(topic.originWho === undefined ? {} : { originWho: topic.originWho }),
      ...(topic.originText === undefined ? {} : { originText: topic.originText }),
      ...(topic.originTime === undefined ? {} : { originTime: topic.originTime }),
    }))
    const pinned = lastSessionTitle(agents?.get(binding.dshSessionId)?.session?.events ?? [])
    const groupName = pinned !== '' && !isPlaceholderRoomTitle(pinned)
      ? pinned
      : (binding.yzjKind === 'dm' ? '私聊房间' : '群房间')
    return {
      groupId: binding.yzjConversationId,
      groupName,
      sessionId: binding.dshSessionId,
      yzjKind: binding.yzjKind,
      topics,
    }
  })
  return { rooms }
}

/** Structural plugin user-turn (no dsh-llm import — dual-face tsconfig). */
function pluginTurn(text: string): ReturnType<typeof identifiedUserMessage> {
  return identifiedUserMessage(text, { kind: 'plugin', plugin: 'ui-yzj' })
}

/**
 * D8 handoff: bind the target group room, post the confirmed digest as ②,
 * then mint a handoff topic and followup there (R3). Lands the user on the
 * group room; the topic is listed underneath.
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
}): Promise<{ sessionId: string; created: boolean; topicSessionId?: string } | { error: string }> {
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
  let topicSessionId: string | undefined
  try {
    const route = topicAgentRoute(options.ctx)
    const composition = await topicAgentComposition(options.ctx)
    const topic = await openTopicHome({
      home: options.home,
      agents: options.agents,
      yzjConversationId: options.groupId,
      cwd: options.cwd,
      source: 'handoff',
      originText: options.digest,
      title: '丢进群交接',
      ...(route === undefined ? {} : { agentOptions: route }),
      ...composition,
    })
    topicSessionId = topic.sessionId
    const live = options.agents.get(topic.sessionId)
    const agent = typeof live === 'object' && live !== null
      ? live as { inject?: (message: unknown) => void; followup?: (message: unknown) => void }
      : undefined
    const window = options.home.formatSummonWindow(options.groupId, undefined, topic.sessionId)
    if (window !== '') agent?.inject?.(pluginTurn(window))
    agent?.followup?.(pluginTurn('用户从私密会话把工作丢进了本群。请基于群里刚发出的摘要，以本群共享身份继续协作。'))
  } catch (error) {
    return { error: `home-handoff followup failed: ${String(error)}` }
  }
  return { sessionId: opened.sessionId, created: opened.created, ...(topicSessionId === undefined ? {} : { topicSessionId }) }
}
