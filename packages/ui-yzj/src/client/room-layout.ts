/**
 * Group-room timeline layout helpers (docs/spec/group-room-topics.md §9.1 P1):
 * same-sender clustering, date separators, reply-count chips, assistant
 * artifact cards. Pure — no React.
 */
import { artifactBadgeOf } from '../artifact-badge.ts'

/** Minimal IM row the layout pass needs. */
export interface LayoutImEntry {
  readonly msgId: string
  readonly sentAt: number
  readonly fromName: string
  readonly content: string
  readonly origin: string
  readonly isSelf: boolean
  readonly status?: string
  readonly fromOpenId?: string
  readonly topicSessionId?: string
  readonly msgType?: string
  readonly param?: Record<string, unknown>
}

/** One laid-out timeline node: a date rule or an IM row. */
export type RoomLayoutNode<T extends LayoutImEntry = LayoutImEntry> =
  | { readonly kind: 'sep'; readonly label: string }
  | { readonly kind: 'im'; readonly entry: T; readonly merged: boolean }

/** Assistant deliverable shown as a typed card under the bubble. */
export interface ArtifactCard {
  readonly type: string
  readonly name: string
  readonly note: string
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** Cluster key: self / robot / directory openId / display name. */
export function speakerKey(entry: LayoutImEntry): string {
  if (entry.isSelf) return 'self'
  if (entry.origin === 'robot-outbound') return `bot:${entry.topicSessionId ?? entry.fromOpenId ?? 'assistant'}`
  if (entry.fromOpenId !== undefined && entry.fromOpenId !== '') return `u:${entry.fromOpenId}`
  return `n:${entry.fromName}`
}

/** Local calendar day `YYYY-MM-DD`. */
export function dayKey(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return ''
  const date = new Date(ms)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Date-rule copy: 今天 / 昨天 / YYYY-MM-DD. Yesterday is calendar-local. */
export function dateSepLabel(ms: number, now = Date.now()): string {
  const key = dayKey(ms)
  if (key === '') return ''
  if (key === dayKey(now)) return '今天'
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (key === dayKey(yesterday.getTime())) return '昨天'
  return key
}

/**
 * Insert date rules and mark same-speaker continuations. A new day always
 * breaks the cluster so the first row of the day shows avatar + name.
 */
export function layoutRoomItems<T extends LayoutImEntry>(
  items: readonly { kind: string; entry?: T }[],
  now = Date.now(),
): RoomLayoutNode<T>[] {
  const out: RoomLayoutNode<T>[] = []
  let lastDay = ''
  let lastSpeaker = ''
  for (const item of items) {
    if (item.kind !== 'im' || item.entry === undefined) continue
    const day = dayKey(item.entry.sentAt)
    if (day !== lastDay) {
      const label = dateSepLabel(item.entry.sentAt, now)
      if (label !== '') out.push({ kind: 'sep', label })
      lastDay = day
      lastSpeaker = ''
    }
    const speaker = speakerKey(item.entry)
    out.push({ kind: 'im', entry: item.entry, merged: speaker === lastSpeaker && lastSpeaker !== '' })
    lastSpeaker = speaker
  }
  return out
}

/**
 * Chip count for one topic: the root plus later posts tagged with that
 * session id. Never zero — a freshly minted topic is 「1 条回复」.
 */
export function topicReplyCount(
  topic: { readonly dshSessionId: string; readonly rootMsgId?: string },
  items: readonly { kind: string; entry?: LayoutImEntry }[],
): number {
  let count = 1
  for (const item of items) {
    if (item.kind !== 'im' || item.entry === undefined) continue
    if (item.entry.msgId === topic.rootMsgId) continue
    if (item.entry.topicSessionId === topic.dshSessionId) count += 1
  }
  return count
}

/**
 * Typed deliverable under an assistant bubble. Robot-outbound file posts
 * and DSH job-done file posts (CLI `msgType=file` or a `param.name`) become
 * a card.
 */
export function artifactOf(entry: LayoutImEntry): ArtifactCard | undefined {
  const fromRobot = entry.origin === 'robot-outbound'
  const fromTopicDeliver = entry.origin === 'dsh-send' && entry.topicSessionId !== undefined
  if (!fromRobot && !fromTopicDeliver) return undefined
  const param = entry.param ?? {}
  const name = asString(param.name)
  const msgType = entry.msgType ?? ''
  if (msgType !== 'file' && name === '') return undefined
  const display = name === '' ? (entry.content.replace(/^\[文件\]:?\s*/, '').trim() || '文件') : name
  const ext = asString(param.ext)
  const typed = ext === '' || display.includes('.') ? display : `${display}.${ext}`
  const badge = artifactBadgeOf(typed)
  return {
    type: badge.type,
    name: display,
    note: '已发进群 · 点开查看',
  }
}
