/**
 * Workbench conversation list (docs/spec/group-room-topics.md R15/L1).
 * Merges `im group recent` with bound-room topics: row time/preview follow
 * max(latest group message, latest topic activity); topic wins with a
 * 「话题·标题」prefix. Click always lands on the timeline (drawer stays shut).
 */
import { useEffect, useState } from 'react'
import { bindAndFocusGroup } from './home-focus.ts'
import { formatListTime } from './im-cache.ts'
import css from './home.module.css'

/** One topic under a bound room (from `/yzj home-nav`). */
export interface ConvTopicView {
  readonly sessionId: string
  readonly title: string
  readonly lastActivity: number
  readonly status: 'running' | 'confirm' | 'done'
}

/** One row in the workbench conversation list. */
export interface ConvRow {
  readonly groupId: string
  readonly groupName: string
  readonly sessionId: string
  readonly yzjKind: 'group' | 'dm'
  readonly preview: string
  readonly timeLabel: string
  readonly sortKey: number
  readonly topicCount: number
  readonly confirmCount: number
  readonly hasRunning: boolean
  readonly opened: boolean
  readonly headerUrl?: string
}

/** Injected RPC + focus for the list. */
export interface YzjConvListInjected {
  readonly sessionId: string
  readonly activeGroupId?: string
  homeNav: () => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  fetchGroups?: (limit?: number, page?: number) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  homeOpen?: (groupId: string, title?: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  focusBoundSession?: (sessionId: string) => void
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** Nested topic label: drop the 「群名 · 」prefix the official list still uses. */
export function topicNavLabel(groupName: string, title: string): string {
  const prefix = `${groupName.trim()} · `
  const body = title.trim()
  if (prefix !== ' · ' && body.startsWith(prefix)) return body.slice(prefix.length) || '话题'
  return body || '话题'
}

function isPlaceholderName(name: string): boolean {
  return name === '群房间' || name === '私聊房间'
}

/** Prefer the CLI recent name over a host `session/title` placeholder. */
export function displayGroupName(hostName: string | undefined, recentName: string, kind: 'group' | 'dm'): string {
  const recent = recentName.trim()
  const host = (hostName ?? '').trim()
  if (recent !== '' && !isPlaceholderName(recent)) return recent
  if (host !== '' && !isPlaceholderName(host)) return host
  if (recent !== '') return recent
  return kind === 'dm' ? '私聊' : '群聊'
}

function kindOf(groupId: string): 'group' | 'dm' {
  return groupId.startsWith('BOT-') ? 'dm' : 'group'
}

/** L2: missing / unknown status counts as running (pre-P3 rows). */
export function topicStatusOf(status: string | undefined): 'running' | 'confirm' | 'done' {
  return status === 'confirm' || status === 'done' ? status : 'running'
}

/** L2 badge inputs: accent number = confirm count; dot = any running. */
export function topicListBadge(topics: readonly { status?: string }[]): { confirmCount: number; hasRunning: boolean } {
  let confirmCount = 0
  let hasRunning = false
  for (const topic of topics) {
    const status = topicStatusOf(topic.status)
    if (status === 'confirm') confirmCount += 1
    else if (status === 'running') hasRunning = true
  }
  return { confirmCount, hasRunning }
}

function previewOf(message: Record<string, unknown>): string {
  const content = asString(message.content)
  const msgType = asString(message.msgType)
  if (msgType === 'file') return '[文件]'
  if (msgType === 'richText') {
    const plain = content.replace(/\s+/g, ' ').trim()
    return plain === '' ? '[图文]' : plain.slice(0, 60)
  }
  return content.replace(/\s+/g, ' ').slice(0, 60)
}

function listTimeMs(text: unknown): number {
  if (typeof text === 'number' && Number.isFinite(text)) return text
  const value = String(text ?? '').trim()
  if (value === '') return 0
  const parsed = Date.parse(value.includes('T') ? value : value.replace(' ', 'T'))
  return Number.isFinite(parsed) ? parsed : 0
}

function clockLabel(ms: number, fallback: unknown): string {
  if (ms <= 0) return formatListTime(fallback)
  const date = new Date(ms)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return formatListTime(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:00`)
}

/** Bound rooms from `home-nav`. */
export function parseNavRooms(value: unknown): { groupId: string; sessionId: string; groupName: string; yzjKind: 'group' | 'dm'; topics: ConvTopicView[] }[] {
  return asArray(asRecord(value).rooms).flatMap((row) => {
    const rec = asRecord(row)
    const sessionId = asString(rec.sessionId)
    const groupId = asString(rec.groupId)
    if (sessionId === '' || groupId === '') return []
    const topics = asArray(rec.topics).flatMap((item) => {
      const topic = asRecord(item)
      const id = asString(topic.sessionId)
      if (id === '') return []
      const activity = typeof topic.lastActivity === 'number' ? topic.lastActivity : 0
      return [{
        sessionId: id,
        title: asString(topic.title) || '话题',
        lastActivity: activity,
        status: topicStatusOf(asString(topic.status) || undefined),
      }]
    })
    return [{
      groupId,
      sessionId,
      groupName: asString(rec.groupName) || (rec.yzjKind === 'dm' ? '私聊房间' : '群房间'),
      yzjKind: rec.yzjKind === 'dm' ? 'dm' as const : 'group' as const,
      topics,
    }]
  })
}

/** Recent CLI rows plus whether another page exists. */
export function parseRecentGroups(value: unknown): { rooms: { groupId: string; groupName: string; headerUrl?: string; lastMsg: Record<string, unknown>; lastMsgSendTime: unknown }[]; more: boolean } {
  const rec = asRecord(value)
  const rooms = asArray(rec.list).flatMap((row) => {
    const item = asRecord(row)
    const groupId = asString(item.groupId)
    if (groupId === '') return []
    return [{
      groupId,
      groupName: asString(item.groupName) || (kindOf(groupId) === 'dm' ? '私聊' : '群聊'),
      lastMsg: asRecord(item.lastMsg),
      lastMsgSendTime: item.lastMsgSendTime,
      ...(asString(item.headerUrl) === '' ? {} : { headerUrl: asString(item.headerUrl) }),
    }]
  })
  return { rooms, more: rec.more === true }
}

/**
 * L1 merge: recent list × bound topics. Topic activity newer than the last
 * group message wins the preview (prefix 「话题·」) and the sort key.
 */
export function buildConvRows(
  recent: readonly { groupId: string; groupName: string; headerUrl?: string; lastMsg: Record<string, unknown>; lastMsgSendTime: unknown }[],
  bound: readonly { groupId: string; sessionId: string; groupName: string; yzjKind: 'group' | 'dm'; topics: readonly ConvTopicView[] }[],
): ConvRow[] {
  const boundById = new Map(bound.map(room => [room.groupId, room]))
  const seen = new Set<string>()
  const rows: ConvRow[] = []
  for (const item of recent) {
    seen.add(item.groupId)
    const host = boundById.get(item.groupId)
    const topics = host?.topics ?? []
    const latestTopic = topics.reduce<ConvTopicView | undefined>((best, topic) => {
      if (best === undefined || topic.lastActivity > best.lastActivity) return topic
      return best
    }, undefined)
    const groupMs = listTimeMs(item.lastMsgSendTime)
    const topicMs = latestTopic?.lastActivity ?? 0
    const topicWins = topicMs > groupMs && latestTopic !== undefined
    const sortKey = Math.max(groupMs, topicMs)
    const preview = topicWins
      ? `话题·${topicNavLabel(host?.groupName ?? item.groupName, latestTopic.title)}`
      : previewOf(item.lastMsg)
    const badge = topicListBadge(topics)
    rows.push({
      groupId: item.groupId,
      groupName: displayGroupName(host?.groupName, item.groupName, host?.yzjKind ?? kindOf(item.groupId)),
      sessionId: host?.sessionId ?? '',
      yzjKind: host?.yzjKind ?? kindOf(item.groupId),
      preview,
      timeLabel: clockLabel(sortKey, item.lastMsgSendTime),
      sortKey,
      topicCount: topics.length,
      confirmCount: badge.confirmCount,
      hasRunning: badge.hasRunning,
      opened: host !== undefined,
      ...(item.headerUrl === undefined ? {} : { headerUrl: item.headerUrl }),
    })
  }
  for (const host of bound) {
    if (seen.has(host.groupId)) continue
    const latestTopic = host.topics.reduce<ConvTopicView | undefined>((best, topic) => {
      if (best === undefined || topic.lastActivity > best.lastActivity) return topic
      return best
    }, undefined)
    const badge = topicListBadge(host.topics)
    rows.push({
      groupId: host.groupId,
      groupName: displayGroupName(host.groupName, '', host.yzjKind),
      sessionId: host.sessionId,
      yzjKind: host.yzjKind,
      preview: latestTopic === undefined ? '' : `话题·${topicNavLabel(host.groupName, latestTopic.title)}`,
      timeLabel: clockLabel(latestTopic?.lastActivity ?? 0, ''),
      sortKey: latestTopic?.lastActivity ?? 0,
      topicCount: host.topics.length,
      confirmCount: badge.confirmCount,
      hasRunning: badge.hasRunning,
      opened: true,
    })
  }
  return rows.sort((a, b) => b.sortKey - a.sortKey)
}

/**
 * Left column of the group-room workbench. Load-more uses the same CLI page
 * as the former floating-panel 会话 list.
 */
export function YzjConvList(props: YzjConvListInjected) {
  const [bound, setBound] = useState<ReturnType<typeof parseNavRooms>>([])
  const [recent, setRecent] = useState<ReturnType<typeof parseRecentGroups>['rooms']>([])
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      const result = await props.homeNav()
      if (cancelled) return
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      setError('')
      setBound(parseNavRooms(result.value))
    }
    void load()
    const timer = window.setInterval(() => { void load() }, 2000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
    // homeNav is a stable RPC closure from the slot inject.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (props.fetchGroups === undefined) return
    let cancelled = false
    void props.fetchGroups(20, 1).then((result) => {
      if (cancelled) return
      if (!result.ok) return
      const parsed = parseRecentGroups(result.value)
      setRecent(parsed.rooms)
      setMore(parsed.more)
      setPage(1)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rows = buildConvRows(recent, bound)

  const openRow = (row: ConvRow): void => {
    if (row.opened && row.sessionId !== '') {
      props.focusBoundSession?.(row.sessionId)
      return
    }
    void bindAndFocusGroup(props.homeOpen, props.focusBoundSession, row.groupId, row.groupName)
  }

  const loadMore = (): void => {
    if (loading || props.fetchGroups === undefined) return
    setLoading(true)
    const nextPage = page + 1
    void props.fetchGroups(20, nextPage).then((result) => {
      setLoading(false)
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      const parsed = parseRecentGroups(result.value)
      setRecent(prev => {
        const seen = new Set(prev.map(room => room.groupId))
        return [...prev, ...parsed.rooms.filter(room => !seen.has(room.groupId))]
      })
      setMore(parsed.more)
      setPage(nextPage)
    })
  }

  return (
    <nav className={css.convList} data-testid="yzj-conv-list" aria-label="会话">
      <div className={css.convListHead}>会话</div>
      {error !== '' && <p className={css.convListHint}>{error}</p>}
      {rows.length === 0 && error === '' && (
        <p className={css.convListHint}>还没有最近会话。点侧栏脚「云之家 → 对话」打开一个。</p>
      )}
      <div className={css.convListBody}>
        {rows.map((row) => {
          const active = row.groupId === props.activeGroupId || (row.sessionId !== '' && row.sessionId === props.sessionId)
          const glyph = row.headerUrl !== undefined && row.headerUrl !== ''
            ? <img src={row.headerUrl} alt="" referrerPolicy="no-referrer" />
            : row.groupName.slice(0, 1)
          return (
            <button
              key={row.groupId}
              type="button"
              className={`${css.convRow} ${active ? css.convRowActive : ''}`}
              aria-current={active ? 'page' : undefined}
              data-testid={`yzj-conv-row-${row.groupId}`}
              onClick={() => openRow(row)}
            >
              <span className={css.convGlyph} aria-hidden="true">{glyph}</span>
              <span className={css.convRowBody}>
                <span className={css.convRowTop}>
                  <span className={css.convRowName}>{row.groupName}</span>
                  <span className={css.convRowTime}>{row.timeLabel}</span>
                </span>
                <span className={css.convRowBottom}>
                  <span className={css.convRowPreview}>{row.preview}</span>
                  {row.confirmCount > 0
                    ? <span className={css.convBadge} data-testid="yzj-conv-badge" title={`${row.confirmCount} 个待确认话题`}>{row.confirmCount}</span>
                    : row.hasRunning
                      ? <span className={css.convDot} data-testid="yzj-conv-dot" title={`${row.topicCount} 个进行中话题`} />
                      : null}
                </span>
              </span>
            </button>
          )
        })}
      </div>
      {more && (
        <button type="button" className={css.convMore} onClick={loadMore} disabled={loading} data-testid="yzj-conv-more">
          {loading ? '加载中…' : '加载更多会话'}
        </button>
      )}
    </nav>
  )
}
