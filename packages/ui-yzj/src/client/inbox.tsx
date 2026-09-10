/**
 * IM inbox: Grok-style fused recent list (assistants + people + groups),
 * with optional sectioned layout (助手 / 单聊 / 群 / 订阅). Preference:
 * localStorage `dsh-yzj-inbox-layout` = `mixed` | `grouped`.
 * Warm start: module snapshot + im-cache peekGroupWindow; always revalidate.
 */
import { useEffect, useRef, useState, type FormEvent, type UIEvent } from 'react'
import type { YzjPanelInject } from './rpc.ts'
import { getImSelection, setImSelection, subscribeImSelection } from './im-nav.ts'
import { inboxRoomKind, parseRecentGroups, type RecentGroupRoom } from './conv-list.tsx'
import { bindImCachePersistence, peekGroupWindow, putGroupWindow } from './im-cache.ts'
import { GroupAvatar } from './im-render.tsx'
import { YzjLoginBanner } from './login-banner.tsx'
import css from './shell.module.css'

const LAYOUT_KEY = 'dsh-yzj-inbox-layout'

export type InboxLayout = 'mixed' | 'grouped'

interface AssistantRow {
  readonly id: string
  readonly name: string
}

interface AssistantPreview {
  readonly preview: string
  readonly at: number
}

/** Survives React remount within the same client session (plugin effect). */
interface InboxSnapshot {
  readonly assistants: readonly AssistantRow[]
  readonly previews: ReadonlyArray<readonly [string, AssistantPreview]>
  readonly rooms: readonly RecentGroupRoom[]
  readonly page: number
  readonly more: boolean
}

let inboxSnapshot: InboxSnapshot | null = null

/** Test helper: drop the module inbox snapshot. */
export function clearInboxSnapshot(): void {
  inboxSnapshot = null
}

function rememberSnapshot(next: InboxSnapshot): void {
  inboxSnapshot = next
}

function seedFromCache(): Pick<InboxSnapshot, 'rooms' | 'page' | 'more'> {
  if (inboxSnapshot !== null && inboxSnapshot.rooms.length > 0) {
    return {
      rooms: [...inboxSnapshot.rooms],
      page: inboxSnapshot.page,
      more: inboxSnapshot.more,
    }
  }
  const peek = peekGroupWindow()
  if (peek === undefined) return { rooms: [], page: 1, more: false }
  const parsed = parseRecentGroups({ list: peek.groups, more: peek.more })
  return { rooms: parsed.rooms, page: 1, more: parsed.more }
}

function seedAssistants(): { assistants: AssistantRow[]; previews: Map<string, AssistantPreview> } {
  if (inboxSnapshot !== null && inboxSnapshot.assistants.length > 0) {
    return {
      assistants: [...inboxSnapshot.assistants],
      previews: new Map(inboxSnapshot.previews),
    }
  }
  return { assistants: [{ id: 'default', name: '助手' }], previews: new Map() }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

type FusedRow =
  | { readonly kind: 'assistant'; readonly id: string; readonly name: string; readonly preview: string; readonly at: number }
  | { readonly kind: 'room'; readonly room: RecentGroupRoom; readonly at: number }

function previewOf(lastMsg: Record<string, unknown>): string {
  const content = asString(lastMsg.content)
  const msgType = asString(lastMsg.msgType)
  if (msgType === 'file') return '[文件]'
  if (msgType === 'richText') {
    const plain = content.replace(/\s+/g, ' ').trim()
    return plain === '' ? '[图文]' : plain.slice(0, 60)
  }
  return content.replace(/\s+/g, ' ').slice(0, 60)
}

function activityMs(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const text = String(value ?? '').trim()
  if (text === '') return 0
  const parsed = Date.parse(text.includes('T') ? text : text.replace(' ', 'T'))
  return Number.isFinite(parsed) ? parsed : 0
}

function mergePage1(fresh: readonly RecentGroupRoom[], current: readonly RecentGroupRoom[]): RecentGroupRoom[] {
  const freshIds = new Set(fresh.map(row => row.groupId))
  return [...fresh, ...current.filter(row => !freshIds.has(row.groupId))]
}

function parseAssistants(value: unknown): AssistantRow[] {
  const rows = Array.isArray(asRecord(value).assistants)
    ? asRecord(value).assistants as unknown[]
    : []
  return rows.flatMap((item) => {
    const row = asRecord(item)
    const id = asString(row.id)
    if (id === '') return []
    return [{ id, name: asString(row.name) || '助手' }]
  })
}

function readLayout(): InboxLayout {
  if (typeof localStorage === 'undefined') return 'mixed'
  return localStorage.getItem(LAYOUT_KEY) === 'grouped' ? 'grouped' : 'mixed'
}

function writeLayout(next: InboxLayout): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(LAYOUT_KEY, next)
}

function bubblePreview(value: unknown): AssistantPreview {
  const bubbles = asArray(asRecord(value).bubbles)
  const last = bubbles.length === 0 ? undefined : asRecord(bubbles[bubbles.length - 1])
  if (last === undefined) return { preview: '专属助手', at: 0 }
  const text = asString(last.text).replace(/\s+/g, ' ').trim().slice(0, 60)
  const at = typeof last.at === 'number' && Number.isFinite(last.at) ? last.at : 0
  return { preview: text === '' ? '专属助手' : text, at }
}

/** Build fused recent rows (assistants + dm + group), newest first. */
export function buildFusedRows(
  assistants: readonly AssistantRow[],
  previews: ReadonlyMap<string, AssistantPreview>,
  rooms: readonly RecentGroupRoom[],
): FusedRow[] {
  const rows: FusedRow[] = []
  for (const assistant of assistants) {
    const preview = previews.get(assistant.id) ?? { preview: '专属助手', at: 0 }
    rows.push({
      kind: 'assistant',
      id: assistant.id,
      name: assistant.name,
      preview: preview.preview,
      at: preview.at,
    })
  }
  for (const room of rooms) {
    if (inboxRoomKind(room) === 'subscription') continue
    rows.push({ kind: 'room', room, at: activityMs(room.lastMsgSendTime) })
  }
  return rows.sort((a, b) => b.at - a.at)
}

export function YzjInbox(props: { panel: YzjPanelInject }) {
  const [query, setQuery] = useState('')
  const [layout, setLayout] = useState<InboxLayout>(readLayout)
  const [assistants, setAssistants] = useState<AssistantRow[]>(() => seedAssistants().assistants)
  const [previews, setPreviews] = useState<Map<string, AssistantPreview>>(() => seedAssistants().previews)
  const [rooms, setRooms] = useState<RecentGroupRoom[]>(() => [...seedFromCache().rooms])
  const [page, setPage] = useState(() => seedFromCache().page)
  const [more, setMore] = useState(() => seedFromCache().more)
  const [loadingMore, setLoadingMore] = useState(false)
  const [sel, setSel] = useState(getImSelection)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef(page)
  const moreRef = useRef(more)
  const loadingRef = useRef(false)
  pageRef.current = page
  moreRef.current = more

  useEffect(() => subscribeImSelection(() => { setSel(getImSelection()) }), [])

  useEffect(() => {
    if (props.panel.imCachePut === undefined || props.panel.imCacheGet === undefined) return
    bindImCachePersistence(
      (key, payload, fetchedAt) => { void props.panel.imCachePut!(key, payload, fetchedAt) },
      async (key) => {
        const result = await props.panel.imCacheGet!(key)
        if (!result.ok || result.value === null) return null
        const value = result.value as { payload: unknown; fetchedAt: number }
        return { payload: value.payload, fetchedAt: value.fetchedAt }
      },
    )
  }, [props.panel])

  useEffect(() => {
    rememberSnapshot({
      assistants,
      previews: [...previews.entries()],
      rooms,
      page,
      more,
    })
  }, [assistants, previews, rooms, page, more])

  useEffect(() => {
    let cancelled = false
    const loadPreviews = async (rows: readonly AssistantRow[]): Promise<void> => {
      if (props.panel.assistantProjection === undefined || rows.length === 0) return
      const entries = await Promise.all(rows.map(async (row) => {
        const result = await props.panel.assistantProjection!({ assistantId: row.id })
        if (!result.ok) return [row.id, { preview: '专属助手', at: 0 }] as const
        return [row.id, bubblePreview(result.value)] as const
      }))
      if (cancelled) return
      setPreviews(new Map(entries))
    }
    const loadAssistants = async (): Promise<void> => {
      const listed = await props.panel.assistantsList?.()
      if (cancelled || listed === undefined || !listed.ok) return
      const next = parseAssistants(listed.value)
      if (next.length > 0) {
        setAssistants(next)
        await loadPreviews(next)
      }
    }
    const loadPage1 = async (): Promise<void> => {
      const recent = await props.panel.fetchGroups(20, 1)
      if (cancelled || !recent.ok) return
      const parsed = parseRecentGroups(recent.value)
      const rawList = asArray(asRecord(recent.value).list)
      putGroupWindow(rawList, parsed.more)
      setRooms(current => current.length === 0 ? parsed.rooms : mergePage1(parsed.rooms, current))
      if (pageRef.current <= 1) {
        setMore(parsed.more)
        setPage(1)
      } else if (!parsed.more) {
        setMore(false)
      }
    }
    void loadAssistants()
    void loadPage1()
    const timer = window.setInterval(() => {
      void loadAssistants()
      void loadPage1()
    }, 8_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [props.panel])

  const loadMore = (): void => {
    if (loadingRef.current || !moreRef.current) return
    loadingRef.current = true
    setLoadingMore(true)
    const nextPage = pageRef.current + 1
    void props.panel.fetchGroups(20, nextPage).then((result) => {
      loadingRef.current = false
      setLoadingMore(false)
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      const parsed = parseRecentGroups(result.value)
      setRooms((prev) => {
        const seen = new Set(prev.map(row => row.groupId))
        return [...prev, ...parsed.rooms.filter(row => !seen.has(row.groupId))]
      })
      setMore(parsed.more === true && parsed.rooms.length > 0)
      setPage(nextPage)
    })
  }

  const maybeLoadMore = (event?: UIEvent<HTMLDivElement>): void => {
    const el = event?.currentTarget ?? listRef.current
    if (el === null || el.clientHeight === 0) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight <= 80) loadMore()
  }

  useEffect(() => {
    maybeLoadMore()
  })

  const createAssistant = async (event?: FormEvent): Promise<void> => {
    event?.preventDefault()
    const trimmed = newName.trim()
    if (trimmed === '' || busy) return
    setBusy(true)
    setError('')
    const result = await props.panel.assistantsCreate?.(trimmed)
    setBusy(false)
    if (result === undefined || !result.ok) {
      setError(result?.error.message ?? '新建失败')
      return
    }
    const created = asRecord(asRecord(result.value).assistant)
    const id = asString(created.id)
    const name = asString(created.name) || trimmed
    if (id !== '') {
      setAssistants(current => current.some(row => row.id === id) ? current : [...current, { id, name }])
      setPreviews((current) => {
        const next = new Map(current)
        next.set(id, { preview: '专属助手', at: Date.now() })
        return next
      })
      setImSelection({ kind: 'assistant', assistantId: id })
    }
    setNewName('')
    setCreating(false)
    const listed = await props.panel.assistantsList?.()
    if (listed?.ok) {
      const next = parseAssistants(listed.value)
      if (next.length > 0) setAssistants(next)
    }
  }

  const setLayoutPreference = (next: InboxLayout): void => {
    setLayout(next)
    writeLayout(next)
  }

  const q = query.trim().toLowerCase()
  const shownAssistants = q === '' ? assistants : assistants.filter(row => row.name.toLowerCase().includes(q))
  const shownRooms = q === '' ? rooms : rooms.filter(row => {
    const preview = previewOf(row.lastMsg)
    return row.groupName.toLowerCase().includes(q) || preview.toLowerCase().includes(q)
  })
  const dms = shownRooms.filter(row => inboxRoomKind(row) === 'dm')
  const groups = shownRooms.filter(row => inboxRoomKind(row) === 'group')
  const subs = shownRooms.filter(row => inboxRoomKind(row) === 'subscription')
  const fused = buildFusedRows(shownAssistants, previews, shownRooms).filter((row) => {
    if (q === '') return true
    if (row.kind === 'assistant') {
      return row.name.toLowerCase().includes(q) || row.preview.toLowerCase().includes(q)
    }
    const preview = previewOf(row.room.lastMsg)
    return row.room.groupName.toLowerCase().includes(q) || preview.toLowerCase().includes(q)
  })

  const assistantOn = (id: string): boolean =>
    sel.kind === 'assistant' && sel.assistantId === id

  return (
    <div className={css.inbox} data-testid="yzj-inbox" data-yzj-inbox-layout={layout}>
      {props.panel.authStatus !== undefined && props.panel.authLogin !== undefined && (
        <div className={css.login}>
          <YzjLoginBanner authStatus={props.panel.authStatus} authLogin={props.panel.authLogin} compact />
        </div>
      )}
      <div className={css.inboxBar}>
        <label className={css.search}>
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            placeholder="搜索"
            aria-label="搜索"
            onChange={event => setQuery(event.target.value)}
          />
        </label>
        <div className={css.layoutSwitch} role="tablist" aria-label="列表布局" data-testid="yzj-inbox-layout">
          <button
            type="button"
            role="tab"
            className={layout === 'mixed' ? css.layoutTabOn : css.layoutTab}
            aria-selected={layout === 'mixed'}
            data-testid="yzj-inbox-layout-mixed"
            onClick={() => setLayoutPreference('mixed')}
          >
            混合
          </button>
          <button
            type="button"
            role="tab"
            className={layout === 'grouped' ? css.layoutTabOn : css.layoutTab}
            aria-selected={layout === 'grouped'}
            data-testid="yzj-inbox-layout-grouped"
            onClick={() => setLayoutPreference('grouped')}
          >
            分组
          </button>
        </div>
        <button
          type="button"
          className={css.addBtn}
          data-testid="yzj-inbox-create"
          aria-label="新建助手"
          title="新建助手"
          onClick={() => { setCreating(true); setError('') }}
        >
          +
        </button>
      </div>
      {creating && (
        <form className={css.createBox} onSubmit={event => { void createAssistant(event) }}>
          <input
            value={newName}
            placeholder="助手名称"
            aria-label="助手名称"
            data-testid="yzj-inbox-create-name"
            autoFocus
            onChange={event => setNewName(event.target.value)}
          />
          <button type="submit" data-testid="yzj-inbox-create-submit" disabled={busy || newName.trim() === ''}>
            创建
          </button>
        </form>
      )}
      {error !== '' && <p className={css.alert} role="alert">{error}</p>}
      <div
        className={css.list}
        ref={listRef}
        data-testid="yzj-inbox-list"
        onScroll={maybeLoadMore}
      >
        {layout === 'mixed' ? (
          <>
            <div data-testid="yzj-inbox-fused">
              {fused.map((row) => {
                if (row.kind === 'assistant') {
                  return (
                    <button
                      key={`a-${row.id}`}
                      type="button"
                      className={assistantOn(row.id) ? css.rowOn : css.row}
                      data-testid={`yzj-inbox-assistant-${row.id}`}
                      onClick={() => setImSelection({ kind: 'assistant', assistantId: row.id })}
                    >
                      <span className={css.inboxAvatar}>
                        <span className={css.glyph}>{row.name.slice(0, 1)}</span>
                      </span>
                      <span className={css.meta}>
                        <span className={css.name}>{row.name}</span>
                        <span className={css.preview}>{row.preview}</span>
                      </span>
                    </button>
                  )
                }
                const on = sel.kind === 'group' && sel.groupId === row.room.groupId
                return (
                  <button
                    key={row.room.groupId}
                    type="button"
                    className={on ? css.rowOn : css.row}
                    data-testid={`yzj-inbox-group-${row.room.groupId}`}
                    onClick={() => setImSelection({
                      kind: 'group',
                      groupId: row.room.groupId,
                      ...(row.room.groupName === '' ? {} : { groupName: row.room.groupName }),
                    })}
                  >
                    <span className={css.inboxAvatar}>
                      <GroupAvatar url={row.room.headerUrl ?? ''} name={row.room.groupName} />
                    </span>
                    <span className={css.meta}>
                      <span className={css.name}>{row.room.groupName}</span>
                      <span className={css.preview}>{previewOf(row.room.lastMsg)}</span>
                    </span>
                  </button>
                )
              })}
            </div>
            <RoomSection testid="yzj-inbox-section-sub" title="订阅通知" rows={subs} sel={sel} />
          </>
        ) : (
          <>
            <section data-testid="yzj-inbox-section-assistants">
              <div className={css.sectionTitle}>助手</div>
              {shownAssistants.map(row => {
                const preview = previews.get(row.id)?.preview ?? '专属助手'
                return (
                  <button
                    key={`a-${row.id}`}
                    type="button"
                    className={assistantOn(row.id) ? css.rowOn : css.row}
                    data-testid={`yzj-inbox-assistant-${row.id}`}
                    onClick={() => setImSelection({ kind: 'assistant', assistantId: row.id })}
                  >
                    <span className={css.inboxAvatar}>
                      <span className={css.glyph}>{row.name.slice(0, 1)}</span>
                    </span>
                    <span className={css.meta}>
                      <span className={css.name}>{row.name}</span>
                      <span className={css.preview}>{preview}</span>
                    </span>
                  </button>
                )
              })}
            </section>
            <RoomSection testid="yzj-inbox-section-dm" title="单聊" rows={dms} sel={sel} />
            <RoomSection testid="yzj-inbox-section-group" title="群" rows={groups} sel={sel} />
            <RoomSection testid="yzj-inbox-section-sub" title="订阅通知" rows={subs} sel={sel} />
          </>
        )}
        {loadingMore && <p className={css.inboxMore} data-testid="yzj-inbox-loading">加载中…</p>}
        {!more && rooms.length > 0 && q === '' && (
          <p className={css.inboxMoreMuted} data-testid="yzj-inbox-end">没有更多了</p>
        )}
      </div>
    </div>
  )
}

function RoomSection(props: {
  testid: string
  title: string
  rows: readonly RecentGroupRoom[]
  sel: ReturnType<typeof getImSelection>
}) {
  if (props.rows.length === 0) return null
  return (
    <section data-testid={props.testid}>
      <div className={css.sectionTitle}>{props.title}</div>
      {props.rows.map(row => {
        const on = props.sel.kind === 'group' && props.sel.groupId === row.groupId
        return (
          <button
            key={row.groupId}
            type="button"
            className={on ? css.rowOn : css.row}
            data-testid={`yzj-inbox-group-${row.groupId}`}
            onClick={() => setImSelection({
              kind: 'group',
              groupId: row.groupId,
              ...(row.groupName === '' ? {} : { groupName: row.groupName }),
            })}
          >
            <span className={css.inboxAvatar}>
              <GroupAvatar url={row.headerUrl ?? ''} name={row.groupName} />
            </span>
            <span className={css.meta}>
              <span className={css.name}>{row.groupName}</span>
              <span className={css.preview}>{previewOf(row.lastMsg)}</span>
            </span>
          </button>
        )
      })}
    </section>
  )
}
