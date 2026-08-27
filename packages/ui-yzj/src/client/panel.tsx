/**
 * The Yunzhijia workspace panel: a frame overlay with three tabs — 知识库
 * (workspace → doc tree), 日程 (today), 会话 (recent groups → messages with
 * paging). Rendering stays presentational: data arrives through the injected
 * fetch face and the shared store; verbs are the injected face and store
 * actions.
 */
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import {
  IconChecklistOutline14,
  IconFolderOpenOutline16,
  IconNewChatOutline16,
  Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { BakedActions } from '@deepseek-ai/dsh-client-ui-slots'
import type { YzjPanelActions, YzjPanelState, YzjTab } from './stores.ts'
import type { YzjPanelInject } from './rpc.ts'
import {
  effectiveUnread, ensureMyProfile, formatListTime, formatMsgTime, getGroupWindow,
  getMessageWindow, markAllRead, markGroupRead, putGroupWindow, putMessageWindow, resolveSenders,
  senderNameOf,
} from './im-cache.ts'

import { registerPanelController } from './panel-controller.ts'
import { rememberImSeat } from './im-seat.ts'
import { bindImCachePersistence } from './im-cache.ts'
import { setWorkbenchDomain, subscribeImGroupFocus } from './workbench-domain.ts'
import { openWorkbench } from './workbench-overlay.ts'
import {
  GroupAvatar, ImLightbox, MessageBody, SenderAvatar, typeLabelOf,
} from './im-render.tsx'
import { CalendarPane } from './calendar-pane.tsx'
import css from './panel.module.css'

/** The props shares the panel reads. */
export interface YzjPanelProps extends YzjPanelInject {
  useStore: <R>(selector: (state: YzjPanelState) => R) => R
  actions: BakedActions<YzjPanelState, YzjPanelActions>
  /** Workbench embed (P2): no overlay chrome, always mounted. */
  embedded?: boolean
  /** Force a tab when embedded (chat stays in the IM workbench). */
  forceTab?: Exclude<YzjTab, 'chat'>
}

type UnknownRecord = Record<string, unknown>

function asRecord(value: unknown): UnknownRecord {
  return typeof value === 'object' && value !== null ? value as UnknownRecord : {}
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

/** Pointer payload for @-mention / codec refs (drag-to-chip is retired). */
export interface YzjDragRef {
  kind: 'workspace' | 'doc' | 'group' | 'event' | 'contact' | 'message'
  id: string
  title: string
  url?: string
  sub?: string
  /** Owning session id for message refs (required for re-fetching the body). */
  group?: string
}

/** Outline cloud mark for the Yunzhijia brand, DSH icon-line style. */
export function YzjCloudIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7.5 18.5h9a4.25 4.25 0 0 0 .65-8.45A6 6 0 0 0 5.6 11.3a3.9 3.9 0 0 0 1.9 7.2Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 14.6l2.4 2.3 3.4-3.6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** One-line preview of a message for the group list / reply chip. */
function messagePreview(message: Record<string, unknown>): string {
  const content = asString(message.content)
  const msgType = asString(message.msgType)
  const param = asRecord(message.param)
  if (msgType === 'file') {
    const name = asString(param.name)
    return name === '' ? '[文件]' : `[文件] ${name}`
  }
  if (msgType === 'other' && asString(param.title) !== '') {
    return `[链接] ${asString(param.title)}`
  }
  if (msgType === 'richText') {
    const plain = content.replace(/\[图片\]/g, '[图片]').trim()
    return plain === '' ? '[图文]' : plain
  }
  return content.replace(/\s+/g, ' ').slice(0, 60)
}

/** Reply-chip title for a message (file names and media get real labels). */
function dragTitleOf(message: Record<string, unknown>): string {
  const msgType = asString(message.msgType)
  const param = asRecord(message.param)
  if (msgType === 'file') {
    const name = asString(param.name)
    return name === '' ? '文件消息' : name
  }
  if (msgType === 'richText') return '图文消息'
  const content = asString(message.content)
  return content === '' ? '(消息)' : content
}

/** Chat header inside a group: the group's avatar + name. */
function groupNameOf(groups: unknown[], groupId: string): string {
  const group = groups.map(asRecord).find(item => asString(item.groupId) === groupId)
  return group === undefined ? '' : asString(group.groupName)
}


function GroupHead({ groups, groupId }: { groups: unknown[]; groupId: string }) {
  const group = groups.map(asRecord).find(item => asString(item.groupId) === groupId)
  const name = groupNameOf(groups, groupId) || '群聊'
  const avatar = group === undefined ? '' : asString(group.headerUrl)
  return (
    <div className={css.groupHead}>
      <GroupAvatar url={avatar} name={name} />
      <span className={css.groupHeadName}>{name}</span>
    </div>
  )
}

const TABS: { key: YzjTab; label: string; icon: () => ReactNode }[] = [
  { key: 'docs', label: '知识库', icon: () => <IconFolderOpenOutline16 /> },
  { key: 'calendar', label: '日程', icon: () => <IconChecklistOutline14 /> },
  { key: 'chat', label: '会话', icon: () => <IconNewChatOutline16 /> },
]

// 机器人/记忆管理页已迁移至 设置 → 云之家（settings-section.tsx）；工作台页签
// 只保留运营性内容（用户决策）。

/** The sidebar-foot toggle; label and open state ride the store shares. */
export interface YzjPanelButtonProps {
  useStore: <R>(selector: (state: YzjPanelState) => R) => R
  actions: BakedActions<YzjPanelState, YzjPanelActions>
  /** Sidebar column state: wide renders the labeled row, rail the icon. */
  wide: boolean
  /** Fresh recent-session window for the unread badge poll. */
  fetchGroups: (limit?: number, page?: number) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
}

/** Sum the effective (read-aware) unread counts of a recent-session window. */
function unreadTotalOf(value: unknown): number {
  const list = asArray(asRecord(value).list)
  return list.reduce<number>((sum, item) => {
    const group = asRecord(item)
    const server = typeof group.unreadCount === 'number' ? group.unreadCount : 0
    if (server <= 0) return sum
    return sum + effectiveUnread(asString(group.groupId), server)
  }, 0)
}
/**
 * Fire one browser system notification for new unread messages (design v1.6
 * §5.3 layer 3). dsh ships no Notification wrapper — this plugin owns it.
 */
function notifyUnread(total: number, focusPanel: () => void): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    const notice = new Notification('云之家', { body: `${total} 条未读消息` })
    notice.onclick = () => {
      window.focus()
      focusPanel()
    }
  } catch {
    // Some environments (sandboxed iframes) throw on construction.
  }
}

/** Ask for notification permission on first toggle (design §5.3 layer 3). */
function requestNotificationPermission(): void {
  if (typeof Notification === 'undefined') return
  if (Notification.permission === 'default' && typeof Notification.requestPermission === 'function') {
    void Notification.requestPermission()
  }
}

/** The sidebar-foot Yunzhijia toggle (labeled row or rail icon). */
export function YzjPanelButton(props: YzjPanelButtonProps) {  const open = props.useStore(state => state.open)
  const unreadTotal = props.useStore(state => state.unreadTotal)
  // Poll cadence follows the design: ~30s while the panel is open, ~5min
  // while collapsed. New unread counts raise the badge and fire a browser
  // notification once per increase.
  useEffect(() => {
    let last = unreadTotal
    const poll = (): void => {
      void props.fetchGroups(20).then((result) => {
        if (!result.ok) return
        const total = unreadTotalOf(result.value)
        props.actions.setUnreadTotal(total)
        if (total > last && total > 0) notifyUnread(total, () => props.actions.setOpen(true))
        last = total
      })
    }
    poll()
    const interval = window.setInterval(poll, open ? 30_000 : 300_000)
    return () => window.clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const button = (
    <button
      type="button"
      className={open ? `${css.toggle} ${css.toggleActive}` : css.toggle}
      aria-expanded={open}
      onClick={() => {
        requestNotificationPermission()
        props.actions.setOpen(!open)
      }}
      aria-label="云之家"
    >
      <YzjCloudIcon size={props.wide ? 16 : 18} />
      {props.wide && <span className={css.toggleLabel}>云之家</span>}
      {unreadTotal > 0 && (
        <span className={css.unreadBadge} title={`${unreadTotal} 条未读`}>
          {unreadTotal > 99 ? '99+' : unreadTotal}
        </span>
      )}
    </button>
  )
  if (props.wide) return button
  return (
    <Tooltip label="云之家" delayMs={500} side="right">
      {button}
    </Tooltip>
  )
}

/** Shortcut order for the floating ball's hover quick-dock. */
const DOCK_ITEMS: { key: YzjTab; label: string; icon: () => ReactNode }[] = [
  { key: 'chat', label: '会话', icon: () => <IconNewChatOutline16 /> },
  { key: 'calendar', label: '日程', icon: () => <IconChecklistOutline14 /> },
  { key: 'docs', label: '知识库', icon: () => <IconFolderOpenOutline16 /> },
]

/** Common emojis for the composer picker (real-IM habit). */
const EMOJI_LIST = ['😀', '😄', '😂', '🤣', '😊', '😍', '🤔', '😎', '😭', '😅', '😉', '🙏', '👍', '👏', '💪', '🔥', '❤️', '🎉', '✅', '❌', '⚠️', '📌', '💡', '🚀']

/** The floating ball: a PERMANENT bottom-right entry — it never disappears,
 *  even while the panel is open (click toggles open/close). Hovering expands
 *  a quick-dock with one shortcut per panel tab. Registered in shell.overlay. */
export interface YzjFloatBallProps {
  useStore: <R>(selector: (state: YzjPanelState) => R) => R
  actions: BakedActions<YzjPanelState, YzjPanelActions>
  /** Fresh recent-session window for the unread badge poll. */
  fetchGroups: (limit?: number, page?: number) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
}

export function YzjFloatBall(props: YzjFloatBallProps) {
  const open = props.useStore(state => state.open)
  const unreadTotal = props.useStore(state => state.unreadTotal)
  const [hover, setHover] = useState(false)

  // The unread poll used to live on the sidebar button; the ball is now the
  // only entry, so it owns the poll. ~60s cadence; an increase raises the
  // badge and fires one browser notification (design §5.3 layer 3).
  useEffect(() => {
    let last = unreadTotal
    const poll = (): void => {
      void props.fetchGroups(20).then((result) => {
        if (!result.ok) return
        const total = unreadTotalOf(result.value)
        props.actions.setUnreadTotal(total)
        if (total > last && total > 0) notifyUnread(total, () => props.actions.setOpen(true))
        last = total
      })
    }
    poll()
    const interval = window.setInterval(poll, 60_000)
    return () => window.clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const openTab = (tab: YzjTab): void => {
    props.actions.setTab(tab)
    props.actions.setOpen(true)
  }
  return (
    <div className={css.floatWrap} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div
        className={hover ? `${css.floatDock} ${css.floatDockOpen}` : css.floatDock}
        role="group"
        aria-label="云之家快捷入口"
      >
        {DOCK_ITEMS.map(item => (
          <button
            key={item.key}
            type="button"
            className={css.floatDockItem}
            title={`${item.label}${item.key === 'chat' && unreadTotal > 0 ? ` · ${unreadTotal} 条未读` : ''}`}
            aria-label={item.label}
            onClick={() => openTab(item.key)}
          >
            {item.icon()}
            <span className={css.floatDockLabel}>{item.label}</span>
            {item.key === 'chat' && unreadTotal > 0 && (
              <span className={css.floatDockBadge}>{unreadTotal > 99 ? '99+' : unreadTotal}</span>
            )}
          </button>
        ))}
      </div>
      <button
        type="button"
        className={open ? `${css.floatBall} ${css.floatBallActive}` : css.floatBall}
        aria-label="云之家悬浮窗"
        aria-expanded={open}
        title={unreadTotal > 0 ? `云之家 · ${unreadTotal} 条未读` : '云之家'}
        onClick={() => {
          requestNotificationPermission()
          props.actions.setOpen(!open)
        }}
      >
        <YzjCloudIcon size={22} />
        {unreadTotal > 0 && (
          <span className={css.floatBallBadge} title={`${unreadTotal} 条未读`}>
            {unreadTotal > 99 ? '99+' : unreadTotal}
          </span>
        )}
      </button>
    </div>
  )
}

/** Load one tab's data into the store through the fetch face. */
function loadTab(
  tab: YzjTab,
  props: YzjPanelProps,
): void {
  const fail = (error: unknown): void => {
    props.actions.setError(typeof error === 'string' ? error : '加载失败')
    props.actions.setLoading(false)
  }
  props.actions.setLoading(true)
  props.actions.setError('')
  if (tab === 'docs') {
    void props.fetchWorkspaces().then((result) => {
      if (result.ok) {
        props.actions.setWorkspaces(asArray(result.value))
        props.actions.setLoading(false)
      } else fail(result.error.message)
    })
  } else if (tab === 'calendar') {
    const pad = (n: number): string => String(n).padStart(2, '0')
    // Opening 日程 always lands on today: cursor month + selected day. A
    // stale persisted selection (or a previously browsed month) must not
    // survive the reopen.
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    props.actions.setCalCursor(year, month)
    props.actions.setCalDay(`${year}-${pad(month)}-${pad(now.getDate())}`)
    props.actions.setCalEventId('')
    const start = `${year}-${pad(month)}-01`
    const end = `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`
    void props.fetchEvents(start, end).then((result) => {
      if (result.ok) {
        props.actions.setCalEvents(asArray(result.value))
        props.actions.setLoading(false)
      } else fail(result.error.message)
    })
  } else if (tab === 'chat') {
    // Group list is cached ~30s so switching tabs is instant.
    const cached = getGroupWindow()
    if (cached !== undefined) {
      props.actions.setGroups(cached.groups)
      props.actions.setGroupsPage(1)
      props.actions.setGroupsMore(cached.more)
      props.actions.setLoading(false)
      return
    }
    // CLI caps --limit at 20; the node half clamps, so ask for the max.
    void props.fetchGroups(20, 1).then((result) => {
      if (result.ok) {
        const groups = asArray(asRecord(result.value).list)
        putGroupWindow(groups, asRecord(result.value).more === true)
        props.actions.setGroups(groups)
        props.actions.setGroupsPage(1)
        props.actions.setGroupsMore(asRecord(result.value).more === true)
        props.actions.setLoading(false)
      } else fail(result.error.message)
    })
  }
}

/** The frame-overlay Yunzhijia panel; renders null while closed. */
export function YzjPanel(props: YzjPanelProps) {
  const open = props.useStore(state => state.open)
  useEffect(() => {
    bindImCachePersistence(
      (key, payload, fetchedAt) => { void props.imCachePut(key, payload, fetchedAt) },
      async (key) => {
        const result = await props.imCacheGet(key)
        if (!result.ok || result.value === null) return null
        return { payload: (result.value as { payload: unknown }).payload, fetchedAt: (result.value as { fetchedAt: number }).fetchedAt }
      },
    )
  }, [])

  const tab = props.useStore(state => state.tab)
  const embedded = props.embedded === true
  // Persisted tabs may hold removed keys (me/robot/memory); fall back to docs.
  const storedTab: YzjTab = tab === 'docs' || tab === 'calendar' || tab === 'chat' ? tab : 'docs'
  const activeTab: YzjTab = embedded
    ? (props.forceTab ?? (storedTab === 'chat' ? 'docs' : storedTab))
    : storedTab
  const anchorActive = props.useStore(state => state.anchorMsgId !== '')
  const state = props.useStore(s => s)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const dragOffset = useRef<{ dx: number; dy: number } | null>(null)
  const anchorRef = useRef<HTMLDivElement | null>(null)
  const [anchorToast, setAnchorToast] = useState('')
  const [senderNames, setSenderNames] = useState<Record<string, string>>({})
  const [lightbox, setLightbox] = useState<{ src: string; kind: 'image' | 'pdf' } | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [replyTo, setReplyTo] = useState<{ msgId: string; summary: string } | null>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [myProfile, setMyProfile] = useState<{ openId: string; name: string }>({ openId: '', name: '' })
  const [docPreview, setDocPreview] = useState<{ title: string; meta: string; lines: string[] } | null>(null)
  /** Folder drill-down trail inside the selected workspace (root = workspace). */
  const [docCrumbs, setDocCrumbs] = useState<{ id: string; title: string }[]>([])
  /** 知识库搜索(v0.1.4):null = 浏览模式;非 null = 搜索结果列表(可能空)。 */
  const [docQuery, setDocQuery] = useState('')
  const [docResults, setDocResults] = useState<Record<string, unknown>[] | null>(null)
  const [docSearching, setDocSearching] = useState(false)
  const [eventDetail, setEventDetail] = useState<{ title: string; time: string; person: string; place: string; content: string } | null>(null)
  const [messagesFetching, setMessagesFetching] = useState(false)
  const openGenRef = useRef(0)
  const listRef = useRef<HTMLDivElement | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const draftRef = useRef<HTMLTextAreaElement | null>(null)

  // The login user, so "my" messages bubble right with the brand color.
  useEffect(() => {
    void ensureMyProfile(props).then(profile => {
      setMyProfile({ openId: profile.openId, name: profile.name })
      if (profile.openId !== '' && profile.name !== '') {
        setSenderNames(prev => ({ ...prev, [profile.openId]: profile.name }))
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Expose the REAL slot-bound actions to cards (查看详情 / 查看上下文
  // jumps) — apply()-side store.create() is a different instance.
  useEffect(() => registerPanelController(props.actions, props), [])

  // Opening a group marks it read locally (the CLI has no mark-read): the
  // row's unread clears and the floating-ball total drops to what's real.
  useEffect(() => {
    if (state.groupId === '') return
    const group = state.groups.map(asRecord).find(item => asString(item.groupId) === state.groupId)
    if (group === undefined) return
    const serverUnread = typeof group.unreadCount === 'number' ? group.unreadCount : 0
    if (serverUnread <= 0) return
    markGroupRead(state.groupId, serverUnread)
    props.actions.setGroups(state.groups.map(item =>
      asString(asRecord(item).groupId) === state.groupId ? { ...asRecord(item), unreadCount: 0 } : item))
    props.actions.setUnreadTotal(unreadTotalOf({ list: state.groups }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.groupId])

  // Reset the auto-growing textarea after a send clears the draft.
  useEffect(() => {
    if (draft === '' && draftRef.current !== null) draftRef.current.style.height = 'auto'
  }, [draft])

  // Live message sync for the OPEN conversation (issue #2): poll `type:new`
  // anchored on the newest loaded msgId while the panel is open on the chat
  // tab; append whatever arrived and keep the bottom pinned when the user
  // is already there. ~30s matches the unread-badge cadence.
  const atBottomRef = useRef(true)
  // Infinite scroll (older messages): refs only — bisect variant D.
  const chatScrollRef = useRef<{ more: boolean; loading: boolean; loadOlder: () => void }>({ more: false, loading: false, loadOlder: () => {} })
  const scrollRestoreRef = useRef<{ height: number; top: number } | null>(null)
  const lastTopLoadRef = useRef(0)
  useEffect(() => {
    if (!open || activeTab !== 'chat' || state.groupId === '') return
    const poll = (): void => {
      const anchor = state.messages.length > 0
        ? asString(asRecord(state.messages[state.messages.length - 1]).msgId)
        : ''
      const fetch = anchor === ''
        ? props.fetchMessages(state.groupId, 20)
        : props.fetchMessages(state.groupId, 20, { type: 'new', msgId: anchor })
      void fetch.then((result) => {
        if (!result.ok) return
        const fresh = asArray(asRecord(result.value).list)
        if (fresh.length === 0) return
        const known = new Set(state.messages.map(message => String(asRecord(message).msgId)))
        const delta = fresh.filter(message => !known.has(String(asRecord(message).msgId)))
        if (delta.length === 0) return
        props.actions.appendMessages(delta)
        putMessageWindow(state.groupId, [...state.messages, ...delta], state.messagesMore)
        // Opening the group already marks it read; also clear its row badge.
        markGroupRead(state.groupId, delta.length)
        props.actions.setGroups(state.groups.map(item =>
          asString(asRecord(item).groupId) === state.groupId ? { ...asRecord(item), unreadCount: 0 } : item))
        props.actions.setUnreadTotal(unreadTotalOf({ list: state.groups.map(item =>
          asString(asRecord(item).groupId) === state.groupId ? { ...asRecord(item), unreadCount: 0 } : item) }))
        if (atBottomRef.current) {
          const list = listRef.current
          if (list !== null) list.scrollTop = list.scrollHeight
        }
      })
    }
    const interval = window.setInterval(poll, 30_000)
    return () => window.clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeTab, state.groupId, state.messages.length === 0])

  // Track whether the message list is scrolled to the bottom (autoscroll
  // follow vs. keep the user's reading position) — and auto-load the older
  // page when the user reaches the top (infinite scroll). The listener reads
  // flags through chatScrollRef; loadOlderMessages self-registers into it.
  useEffect(() => {
    const list = listRef.current
    if (list === null || activeTab !== 'chat') return
    const onScroll = (): void => {
      atBottomRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 40
      const { more, loading, loadOlder } = chatScrollRef.current
      if (list.scrollTop <= 60 && more && !loading && scrollRestoreRef.current === null
        && Date.now() - lastTopLoadRef.current > 1200) {
        lastTopLoadRef.current = Date.now()
        scrollRestoreRef.current = { height: list.scrollHeight, top: list.scrollTop }
        loadOlder()
      }
    }
    list.addEventListener('scroll', onScroll, { passive: true })
    return () => list.removeEventListener('scroll', onScroll)
  }, [activeTab, state.groupId])
  // Refresh only the FLAGS (the loader registers itself; no forward ref).
  useEffect(() => {
    chatScrollRef.current = { ...chatScrollRef.current, more: state.messagesMore, loading: messagesFetching }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.messagesMore, messagesFetching])

  // External jumps (card 查看 → docs preview) set docId without the click
  // handler; fetch the preview when the id changes.
  useEffect(() => {
    if (state.docId === '' || docPreview !== null) return
    loadDocPreview(state.docId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.docId])

  // External jumps (card 查看 → calendar event) set calEventId; enrich the
  // detail once the month's events land.
  useEffect(() => {
    if (state.calEventId === '' || eventDetail !== null) return
    const event = state.calEvents.map(asRecord).find(item => asString(item.id) === state.calEventId)
    if (event !== undefined) pickEvent(event)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.calEventId, state.calEvents])

  // Keep the newest messages in view: bottom on group open and after sends,
  // unless an anchor jump is active.
  useEffect(() => {
    if (state.groupId === '' || state.anchorMsgId !== '') return
    const list = listRef.current
    if (list === null) return
    list.scrollTop = list.scrollHeight
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.groupId, state.messages])

  // Resolve sender display names for the loaded message window (cached).
  // The React state mirrors the module cache so newly resolved names
  // re-render; already-cached names are seeded immediately.
  useEffect(() => {
    const openIds = state.messages.map(message => asString(asRecord(message).fromOpenId))
    if (openIds.length === 0) return
    const seeded: Record<string, string> = {}
    for (const openId of openIds) {
      const name = senderNameOf(openId)
      if (name !== '') seeded[openId] = name
    }
    if (Object.keys(seeded).length > 0) setSenderNames(prev => ({ ...prev, ...seeded }))
    void resolveSenders(openIds, props).then(names => {
      if (Object.keys(names).length > 0) setSenderNames(prev => ({ ...prev, ...names }))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.messages])

  // Esc closes the image lightbox.
  useEffect(() => {
    if (lightbox === null) return
    const onKey = (event: KeyboardEvent): void => { if (event.key === 'Escape') setLightbox(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox])

  // @ mention candidates (issue #4): everyone who spoke in the current chat
  // window (name → openId, deduped, self last). The CLI has no group-member
  // list command; the speaker set is the practical roster for mentions.
  const atCandidates = useMemo<{ name: string; openId: string }[]>(() => {
    const seen = new Map<string, { name: string; openId: string }>()
    for (const message of state.messages) {
      const openId = asString(asRecord(message).fromOpenId)
      if (openId === '') continue
      const name = senderNames[openId] ?? ''
      if (name !== '' && !seen.has(name)) seen.set(name, { name, openId })
    }
    return [...seen.values()].filter((candidate: { name: string; openId: string }) => candidate.openId !== myProfile.openId)
  }, [state.messages, senderNames, myProfile.openId])

  // @ menu state: open while the caret types an @fragment; query is the text
  // after the last '@'.
  const [atMenu, setAtMenu] = useState<{ query: string; replaceFrom: number } | null>(null)
  const onDraftChange = (value: string, caret: number): void => {
    setDraft(value)
    if (state.groupId === '') { setAtMenu(null); return }
    const before = value.slice(0, caret)
    const at = before.lastIndexOf('@')
    if (at >= 0) {
      const query = before.slice(at + 1)
      if (/^[\w\u4e00-\u9fa5.·-]*$/.test(query) && query.length <= 12) {
        setAtMenu({ query, replaceFrom: at })
        return
      }
    }
    setAtMenu(null)
  }
  const pickAt = (candidate: { name: string; openId: string }): void => {
    if (atMenu === null) return
    const after = `${draft.slice(0, atMenu.replaceFrom)}@${candidate.name} ${draft.slice(atMenu.replaceFrom + 1 + atMenu.query.length)}`
    setAtMenu(null)
    setDraft(after)
    draftRef.current?.focus()
    requestAnimationFrame(() => {
      const el = draftRef.current
      if (el === null) return
      const pos = atMenu.replaceFrom + candidate.name.length + 2
      el.setSelectionRange(pos, pos)
    })
  }
  const atMatches = atMenu === null ? [] : atCandidates
    .filter(candidate => atMenu.query === '' || candidate.name.toLowerCase().includes(atMenu.query.toLowerCase()))
    .slice(0, 6)

  // Esc dismisses layered UI first (emoji picker → reply bar), then closes
  // the panel itself — the standard floating-panel contract.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || lightbox !== null) return
      if (emojiOpen) { setEmojiOpen(false); return }
      if (replyTo !== null) { setReplyTo(null); return }
      props.actions.setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lightbox, emojiOpen, replyTo])

  // Scroll the jump anchor into view once its group's messages land.
  useEffect(() => {
    if (state.anchorMsgId === '' || anchorRef.current === null) return
    anchorRef.current.scrollIntoView({ block: 'center' })
    setAnchorToast(`已定位到锚点消息（${state.anchorMsgId.slice(0, 12)}…）`)
    const timer = window.setTimeout(() => setAnchorToast(''), 3200)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.messages, state.anchorMsgId])

  useEffect(() => {
    if (!open) return
    const move = (event: PointerEvent): void => {
      if (dragOffset.current === null) return
      const x = Math.max(8, Math.min(event.clientX - dragOffset.current.dx, Math.max(8, window.innerWidth - 880)))
      const y = Math.max(8, Math.min(event.clientY - dragOffset.current.dy, window.innerHeight - 60))
      props.actions.setPanelPosition(x, y)
    }
    const up = (): void => { dragOffset.current = null }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open && !embedded) return
    loadTab(activeTab, props)
    // tab switches and opens are the load triggers; state reads inside the
    // loader come from the snapshot taken at effect time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeTab, embedded])

  if (!open && !embedded) return null

  const startDrag = (event: ReactPointerEvent<HTMLElement>): void => {
    if (event.button !== 0) return
    const rect = panelRef.current?.getBoundingClientRect()
    if (rect === undefined) return
    dragOffset.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top }
    event.preventDefault()
  }

  // Stale persisted positions (saved for the old 460px panel) can push the
  // wide panel off-screen; clamp so it always stays reachable.
  const dockStyle = state.panelX >= 0 && state.panelY >= 0
    ? {
        left: Math.min(state.panelX, Math.max(0, window.innerWidth - 860)),
        top: Math.min(state.panelY, Math.max(0, window.innerHeight - 80)),
        margin: 0,
      }
    : undefined

  /** 知识库全局搜索(v0.1.4):命中后左栏切到结果列表;清空关键词回浏览模式。 */
  const runDocSearch = async (): Promise<void> => {
    const keyword = docQuery.trim()
    if (keyword === '') { setDocResults(null); return }
    setDocSearching(true)
    const result = await props.fetchDocSearch(keyword, state.workspaceId === '' ? undefined : state.workspaceId)
    setDocSearching(false)
    if (!result.ok) { props.actions.setError(result.error.message); return }
    const rows = asArray(result.value).length > 0 ? asArray(result.value) : asArray(asRecord(result.value).list)
    setDocResults(rows.map(asRecord))
  }

  /** Fetch one docs level of the workspace; parentId omitted = root. */
  const fetchDocsAt = (workspace: string, parentId?: string): void => {
    props.actions.setLoading(true)
    props.actions.setError('')
    void props.fetchDocs(workspace, parentId).then((result) => {
      if (result.ok) {
        props.actions.setDocs(asArray(result.value))
      } else {
        props.actions.setError(result.error.message)
      }
      props.actions.setLoading(false)
    })
  }

  const openWorkspace = (id: string): void => {
    props.actions.setWorkspaceId(id)
    props.actions.setDocId('')
    setDocPreview(null)
    setDocCrumbs([])
    fetchDocsAt(id)
  }

  /** Drill into a folder node (docs tab): push a crumb, load its children. */
  const openFolder = (id: string, title: string): void => {
    props.actions.setDocId('')
    setDocPreview(null)
    setDocCrumbs(prev => [...prev, { id, title }])
    fetchDocsAt(state.workspaceId, id)
  }

  /** Jump the docs trail back to a crumb (index -1 = workspace root). */
  const jumpCrumb = (index: number): void => {
    const next = index < 0 ? [] : docCrumbs.slice(0, index + 1)
    props.actions.setDocId('')
    setDocPreview(null)
    setDocCrumbs(next)
    const parent = next.length > 0 ? next[next.length - 1]!.id : undefined
    fetchDocsAt(state.workspaceId, parent)
  }

  /** Right-pane doc preview: info + first blocks as text. */
  const loadDocPreview = (id: string): void => {
    setDocPreview(null)
    void Promise.all([props.fetchDoc(id), props.fetchDocBlocks(id)]).then(([infoResult, blocksResult]) => {
      const node = asRecord(infoResult.ok ? infoResult.value : {})
      const title = asString(node.title) === '' ? '文档' : asString(node.title)
      const suffix = asString(node.fileSuffix)
      const meta = [
        suffix === 'dbt' ? '多维表格' : '在线文档',
        asString(node.updateTime).slice(0, 10) === '' ? '' : `更新 ${asString(node.updateTime).slice(0, 10)}`,
        asString(node.creatorName) === '' ? '' : `创建人 ${asString(node.creatorName)}`,
      ].filter(part => part !== '').join(' · ')
      const lines: string[] = []
      if (blocksResult.ok) {
        // The CLI wraps blocks as { data: { blocks: [...] } }. A CONTAINER
        // block mirrors the same children twice — `childNodes` (tree) and
        // `content` (flat array); a LEAF text node carries its string in
        // `content`. Walk the tree when present; only descend into a
        // container's `content` mirror when there is no tree, so every line
        // is emitted exactly once.
        const blocksValue = asRecord(blocksResult.value)
        // The CLI wraps as { data: { blocks: [...] } } (blocks[0] is a
        // root `doc` container whose only children live in its `content`
        // array). A CONTAINER block mirrors children twice — `childNodes`
        // (tree) and `content` (flat array); a LEAF text node carries its
        // string in `content`. Walk the tree when present, otherwise the
        // content array — never both — so each line emits exactly once.
        const blocks = asArray(asRecord(blocksValue.data).blocks ?? blocksValue.blocks)
        const walk = (node2: unknown): void => {
          if (typeof node2 !== 'object' || node2 === null) return
          const record = node2 as Record<string, unknown>
          if (typeof record.type === 'string' && typeof record.content === 'string') {
            const text = record.content.trim()
            if (text !== '' && (record.type === 'heading' || record.type === 'paragraph' || record.type === 'code' || record.type === 'text' || record.type === 'title')) {
              lines.push(text)
              return
            }
          }
          const children = record.childNodes
          if (Array.isArray(children) && children.length > 0) {
            for (const child of children) walk(child)
            return
          }
          for (const [key, value] of Object.entries(record)) {
            if (key === 'content') continue // never the mirror after a leaf check
            if (Array.isArray(value)) for (const item of value) walk(item)
            else if (typeof value === 'object' && value !== null) walk(value)
          }
          // Container with no childNodes (e.g. the root `doc` block): its
          // `content` array IS the only child source — descend last.
          if (Array.isArray(record.content)) {
            for (const item of record.content) walk(item)
          }
        }
        for (const block of blocks) walk(block)
      }
      setDocPreview({ title, meta, lines: lines.slice(0, 200) })
    }).catch(() => setDocPreview({ title: '文档', meta: '', lines: [] }))
  }

  const openDoc = (id: string): void => {
    props.actions.setDocId(id)
    loadDocPreview(id)
  }

  /** Select an event; enrich with the full detail when needed. */
  const pickEvent = (event: Record<string, unknown>): void => {
    const id = asString(event.id)
    props.actions.setCalEventId(id)
    const clock = (ms: unknown): string => {
      if (typeof ms !== 'number') return ''
      const date = new Date(ms)
      const pad = (n: number): string => String(n).padStart(2, '0')
      return `${pad(date.getHours())}:${pad(date.getMinutes())}`
    }
    const start = clock(event.startDate)
    const end = clock(event.endDate)
    const base = {
      title: asString(event.title),
      time: start === '' ? '' : `${start}${end === '' ? '' : ` → ${end}`}`,
      person: asString(event.personName),
      place: asString(event.meetingPlace),
      content: asString(event.content),
    }
    if (base.content !== '') {
      setEventDetail(base)
      return
    }
    void props.fetchEvent(id).then((result) => {
      if (!result.ok) {
        setEventDetail(base)
        return
      }
      const detail = asRecord(result.value)
      const ms = typeof detail.startDate === 'number' ? detail.startDate : typeof event.startDate === 'number' ? event.startDate : 0
      const start2 = clock(ms)
      const endMs = typeof detail.endDate === 'number' ? detail.endDate : typeof event.endDate === 'number' ? event.endDate : 0
      const end2 = clock(endMs)
      setEventDetail({
        title: asString(detail.title) === '' ? base.title : asString(detail.title),
        time: start2 === '' ? base.time : `${start2}${end2 === '' ? '' : ` → ${end2}`}`,
        person: asString(detail.personName) === '' ? base.person : asString(detail.personName),
        place: asString(detail.meetingPlace),
        content: asString(detail.content),
      })
    }).catch(() => setEventDetail(base))
  }

  const openGroup = (id: string): void => {
    const gen = ++openGenRef.current
    props.actions.setGroupId(id)
    props.actions.setAnchorMsgId('')
    setDraft('')
    setReplyTo(null)
    rememberImSeat({
      groupId: id,
      sessionId: '',
      ...(groupNameOf(state.groups, id) === '' ? {} : { groupName: groupNameOf(state.groups, id) }),
    })
    setWorkbenchDomain('im')
    openWorkbench()
    // Stage 1: header swaps immediately. Stage 2: cached window paints
    // instantly. Stage 3: cache miss clears previous rows so they never
    // flash under the new name, then fetches into the right pane only.
    const cached = getMessageWindow(id)
    if (cached !== undefined) {
      setMessagesFetching(false)
      props.actions.setMessages(cached.messages)
      props.actions.setMessagesMore(cached.more)
      props.actions.setMessagesAnchor(
        cached.messages.length > 0 ? asString(asRecord(cached.messages[0]).msgId) : '',
      )
      return
    }
    props.actions.setMessages([])
    props.actions.setMessagesMore(false)
    props.actions.setMessagesAnchor('')
    props.actions.setError('')
    setMessagesFetching(true)
    void props.fetchMessages(id, 20).then((result) => {
      if (gen !== openGenRef.current) return
      if (result.ok) {
        const messages = asArray(asRecord(result.value).list)
        putMessageWindow(id, messages, asRecord(result.value).more === true)
        props.actions.setMessages(messages)
        props.actions.setMessagesMore(asRecord(result.value).more === true)
        props.actions.setMessagesAnchor(messages.length > 0 ? asString(asRecord(messages[0]).msgId) : '')
      } else {
        props.actions.setError(result.error.message)
      }
      setMessagesFetching(false)
    })
  }

  // Advance board 事元/source jumps request a group open via the bus.
  const openGroupRef = useRef(openGroup)
  openGroupRef.current = openGroup
  useEffect(() => subscribeImGroupFocus((target) => { openGroupRef.current(target.groupId) }), [])

  const loadMoreGroups = (): void => {
    if (state.loading) return
    props.actions.setLoading(true)
    void props.fetchGroups(20, state.groupsPage + 1).then((result) => {
      if (result.ok) {
        props.actions.appendGroups(asArray(asRecord(result.value).list))
        props.actions.setGroupsPage(state.groupsPage + 1)
        props.actions.setGroupsMore(asRecord(result.value).more === true)
      } else {
        props.actions.setError(result.error.message)
      }
      props.actions.setLoading(false)
    })
  }

  // Keep the scroll listener's facts fresh: the loader SELF-REGISTERS here
  // (no forward references); flags are refreshed by the effect above.
  const loadOlderMessages = (): void => {
    if (messagesFetching || state.messagesAnchor === '') return
    const gen = openGenRef.current
    chatScrollRef.current = { ...chatScrollRef.current, loadOlder: loadOlderMessages }
    setMessagesFetching(true)
    void props.fetchMessages(state.groupId, 20, { type: 'old', msgId: state.messagesAnchor }).then((result) => {
      if (gen !== openGenRef.current) return
      if (result.ok) {
        // type 'old' returns messages OLDER than the anchor, oldest-first —
        // prepend as-is so the top of the list stays the oldest message.
        const older = asArray(asRecord(result.value).list)
        props.actions.prependMessages(older)
        putMessageWindow(state.groupId, [...older, ...state.messages], asRecord(result.value).more === true)
        props.actions.setMessagesMore(asRecord(result.value).more === true)
        if (older.length > 0) {
          props.actions.setMessagesAnchor(asString(asRecord(older[0]).msgId))
        }
        requestAnimationFrame(() => {
          const restore = scrollRestoreRef.current
          scrollRestoreRef.current = null
          const list = listRef.current
          if (restore === null || list === null) return
          const delta = list.scrollHeight - restore.height
          if (delta > 0) list.scrollTop = restore.top + delta
        })
      } else {
        props.actions.setError(result.error.message)
        scrollRestoreRef.current = null
      }
      setMessagesFetching(false)
    })
  }
  // Self-register on every render so the listener always has the freshest
  // closure (state snapshot) without any forward reference.
  chatScrollRef.current = { ...chatScrollRef.current, loadOlder: loadOlderMessages }

  /** Core send: calls the bridge, appends the local message, clears state. */
  const doSend = async (opts: {
    content?: string
    msgType?: 'text' | 'richText' | 'file'
    fileId?: string
    images?: string[]
    replyMsgId?: string
    fileName?: string
    fileSize?: number
    atOpenIds?: string[]
    atAll?: boolean
  }): Promise<void> => {
    if (state.groupId === '') return
    const groupId = state.groupId
    const result = await props.sendMessage(groupId, opts.content, {
      ...(opts.msgType === undefined ? {} : { msgType: opts.msgType }),
      ...(opts.fileId === undefined ? {} : { fileId: opts.fileId }),
      ...(opts.images === undefined ? {} : { images: opts.images }),
      ...(opts.replyMsgId === undefined ? {} : { replyMsgId: opts.replyMsgId }),
      ...(opts.atOpenIds === undefined || opts.atOpenIds.length === 0 ? {} : { atOpenIds: opts.atOpenIds }),
      ...(opts.atAll !== true ? {} : { atAll: true }),
    })
    if (!result.ok) {
      props.actions.setError(result.error.message)
      return
    }
    const profile = await ensureMyProfile(props)
    const payload = asRecord(result.value)
    const now = new Date()
    const pad = (n: number): string => String(n).padStart(2, '0')
    const sendTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.000`
    const msgType = opts.msgType ?? 'text'
    const sent: Record<string, unknown> = {
      msgId: asString(payload.msgId ?? payload.id) === '' ? `local-${now.getTime()}` : asString(payload.msgId ?? payload.id),
      content: opts.content ?? '',
      msgType,
      sendTime,
      fromOpenId: profile.openId,
      param: {
        ...(opts.replyMsgId === undefined ? {} : { replyMsgId: opts.replyMsgId }),
        ...(opts.replyMsgId !== undefined && opts.content !== undefined ? { replySummary: opts.content.slice(0, 80) } : {}),
        ...(msgType === 'file'
          ? { file_id: opts.fileId ?? '', name: opts.fileName ?? '', size: opts.fileSize ?? 0, ext: (opts.fileName ?? '').split('.').pop() ?? '' }
          : {}),
        ...(msgType === 'richText' && opts.images !== undefined && opts.images.length > 0
          ? {
              desc: opts.images.map((fileId) => ({
                type: 'image',
                data: fileId,
                start: (opts.content ?? '').indexOf('[图片]'),
                length: 4,
              })),
            }
          : {}),
      },
    }
    if (profile.openId !== '' && profile.name !== '') {
      setSenderNames(prev => ({ ...prev, [profile.openId]: profile.name }))
    }
    const next = [...state.messages, sent]
    props.actions.setMessages(next)
    putMessageWindow(groupId, next, state.messagesMore)
    setDraft('')
    setReplyTo(null)
    const list = listRef.current
    if (list !== null) list.scrollTop = list.scrollHeight
  }

  /** Plain-text send (Enter / 发送 button). */
  const submitMessage = (): void => {
    const content = draft.trim()
    if (content === '' || sending || uploading || state.groupId === '') return
    // @ mentions (issue #4): one atOpenId per @姓名 fragment, in order —
    // resolved against the chat's known senders (name → openId).
    const atOpenIds: string[] = []
    let atAll = false
    for (const frag of content.match(/@[^@\s，,、]+/g) ?? []) {
      if (frag === '@all') { atAll = true; continue }
      const openId = atCandidates.find(candidate => frag === `@${candidate.name}`)?.openId ?? ''
      if (openId === '') {
        props.actions.setError(`未找到 @${frag.slice(1)} 的成员（候选来自本会话发言者）；请从 @ 菜单选择`)
        return
      }
      atOpenIds.push(openId)
    }
    setSending(true)
    const replyMsgId = replyTo?.msgId
    const send = replyMsgId === undefined ? { content, atOpenIds, atAll } : { content, replyMsgId, atOpenIds, atAll }
    void doSend(send)
      .finally(() => setSending(false))
  }

  /** Upload a picked file, then send it as an image (richText) or file. */
  const handlePickFile = (kind: 'image' | 'file', file: File | undefined): void => {
    if (file === undefined) return
    if (file.size > 24 * 1024 * 1024) {
      props.actions.setError('文件超过 24MB，请压缩后重试')
      return
    }
    const reader = new FileReader()
    reader.onload = (): void => {
      const base64 = typeof reader.result === 'string' ? reader.result.split(',')[1] ?? '' : ''
      if (base64 === '') return
      setUploading(true)
      void props.uploadFile(file.name, base64, file.size).then(async (result) => {
        if (!result.ok) {
          props.actions.setError(result.error.message)
          return
        }
        const payload = asRecord(result.value)
        const fileId = asString(payload.fileId ?? payload.file_id ?? payload.id)
        if (fileId === '') {
          props.actions.setError('上传失败：未返回文件 ID')
          return
        }
        if (kind === 'image') {
          const text = draft.trim()
          const content = text === '' ? '[图片]' : `${text}\n[图片]`
          const replyMsgId = replyTo?.msgId
          await doSend(replyMsgId === undefined
            ? { content, msgType: 'richText', images: [fileId] }
            : { content, msgType: 'richText', images: [fileId], replyMsgId })
        } else {
          await doSend({ msgType: 'file', fileId, fileName: file.name, fileSize: file.size })
        }
      }).finally(() => setUploading(false))
    }
    reader.readAsDataURL(file)
  }

  // Retired panel IM composer (R7). Keep the handler graph referenced so
  // hook order stays stable (pitfall-001).
  if (false) {
    void draft
    void sending
    void uploading
    void emojiOpen
    void replyTo
    void atMenu
    void atMatches
    void EMOJI_LIST
    void draftRef
    void imageInputRef
    void fileInputRef
    submitMessage()
    handlePickFile('image', undefined)
    onDraftChange('', 0)
    pickAt({ openId: '', name: '' })
  }

  return (
    <div
      ref={panelRef}
      className={embedded ? `${css.panel} ${css.panelEmbedded}` : css.panel}
      role="dialog"
      aria-label="云之家"
      data-testid={embedded ? 'yzj-workbench-domain' : undefined}
      style={embedded ? undefined : dockStyle}
    >
      {!embedded && (
      <header className={css.header} onPointerDown={startDrag}>
        <span className={css.brand}><YzjCloudIcon size={18} /></span>
        <span className={css.title}>云之家</span>
        <span className={css.headerSpacer} />
        <button
          type="button"
          className={css.iconButton}
          onClick={() => { loadTab(activeTab, props) }}
          disabled={state.loading}
          aria-label="刷新"
          title="刷新"
          onPointerDown={(event) => { event.stopPropagation() }}
        >
          <IconRefresh14 />
        </button>
        <button
          type="button"
          className={css.iconButton}
          onClick={() => { props.actions.setOpen(false) }}
          aria-label="关闭"
          title="关闭"
          onPointerDown={(event) => { event.stopPropagation() }}
        >
          <IconClose14 />
        </button>
      </header>
      )}
      {!embedded && (
      <nav className={css.tabs} aria-label="云之家功能" onPointerDown={(event) => { event.stopPropagation() }}>
        {TABS.map(item => (
          <button
            key={item.key}
            type="button"
            className={activeTab === item.key ? `${css.tab} ${css.tabActive}` : css.tab}
            aria-current={activeTab === item.key ? 'page' : undefined}
            onClick={() => { props.actions.setTab(item.key) }}
          >
            {item.icon()}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      )}

      {state.error !== '' && (
        <div className={css.error} role="alert">
          <span className={css.errorText}>{state.error}</span>
          <button
            type="button"
            className={css.errorDismiss}
            onClick={() => { props.actions.setError('') }}
            aria-label="忽略错误"
          >
            <IconClose14 />
          </button>
        </div>
      )}
      {state.loading && <div className={css.loading} data-testid="yzj-panel-loading">加载中…</div>}

      {activeTab === 'docs' && (
        <div className={css.body}>
          <div className={css.twoPane}>
            <div className={css.paneLeft}>
              <div className={css.docSearch}>
                <input
                  className={css.docSearchInput}
                  value={docQuery}
                  placeholder="搜索文档标题/文件名…"
                  aria-label="搜索文档"
                  data-testid="yzj-panel-doc-search"
                  onChange={(event) => {
                    setDocQuery(event.target.value)
                    if (event.target.value.trim() === '') setDocResults(null)
                  }}
                  onKeyDown={(event) => { if (event.key === 'Enter') void runDocSearch() }}
                />
              </div>
              <div className={css.paneList}>
                {docResults !== null ? (
                  docSearching ? (
                    <div className={css.empty}>搜索中…</div>
                  ) : docResults.length === 0 ? (
                    <div className={css.empty}><YzjCloudIcon size={28} /><span>没有命中文档</span></div>
                  ) : (
                    docResults.map((node, index) => {
                      const id = asString(node.id)
                      const title = asString(node.title) || asString(node.fileName) || id
                      const updated = asString(node.updateTime).slice(0, 10)
                      const kb = asString(node.kbName)
                      return (
                        <button
                          key={`s${index}`}
                          type="button"
                          className={css.item}
                          data-testid={`yzj-panel-doc-hit-${id}`}
                          onClick={() => { openDoc(id) }}
                        >
                          <span className={css.itemTitle}>
                            <IconFolderOpenOutline16 />
                            <span className={css.itemTitleText}>{title}</span>
                          </span>
                          <span className={css.itemSub}>{kb === '' ? '' : `${kb} · `}{updated === '' ? '文档' : `更新 ${updated}`}</span>
                        </button>
                      )
                    })
                  )
                ) : (
                  <>
                {state.workspaces.length === 0 && !state.loading && state.error === '' && (
                  <div className={css.empty}><YzjCloudIcon size={28} /><span>暂无知识库</span></div>
                )}
                {/* 类型分组(v0.1.4 visibility):个人(=2)置顶,企业/团队随后——51 库平铺分不清层。 */}
                {(() => {
                  const rows = state.workspaces.map(asRecord)
                  const personal = rows.filter(ws => ws.visibility === 2)
                  const enterprise = rows.filter(ws => ws.visibility !== 2)
                  const renderWs = (ws: Record<string, unknown>, index: number): ReactNode => {
                    const count = typeof ws.docCount === 'number' ? ws.docCount : 0
                    const members = typeof ws.memberCount === 'number' ? ws.memberCount : 0
                    const id = asString(ws.id)
                    const name = asString(ws.name)
                    const active = id === state.workspaceId
                    return (
                      <button
                        key={`w${index}`}
                        type="button"
                        className={active ? `${css.item} ${css.itemActive}` : css.item}
                        onClick={() => { openWorkspace(id) }}
                      >
                        <span className={css.itemTitle}>
                          <IconFolderOpenOutline16 />
                          <span className={css.itemTitleText}>{name}</span>
                        </span>
                        <span className={css.itemSub}>文档 {count} · 成员 {members}</span>
                      </button>
                    )
                  }
                  return (
                    <>
                      {personal.length > 0 && (
                        <>
                          <div className={css.paneGroupLabel} data-testid="yzj-panel-ws-group-personal">个人</div>
                          {personal.map(renderWs)}
                        </>
                      )}
                      {enterprise.length > 0 && (
                        <>
                          <div className={css.paneGroupLabel} data-testid="yzj-panel-ws-group-enterprise">企业 / 团队</div>
                          {enterprise.map(renderWs)}
                        </>
                      )}
                    </>
                  )
                })()}
                  </>
                )}
              </div>
            </div>
            <div className={css.paneRight}>
              {state.docId !== '' ? (
                docPreview === null ? (
                  <div className={css.paneEmpty}>加载中…</div>
                ) : (
                  <div className={css.paneList}>
                    <div className={css.paneHead}>
                      <button type="button" className={css.back} onClick={() => { props.actions.setDocId('') }}>
                        <IconChevronLeft14 /> 返回文档
                      </button>
                      <span className={css.paneTitle}>{docPreview.title}</span>
                    </div>
                    {docPreview.meta !== '' && <div className={css.docMeta}>{docPreview.meta}</div>}
                    <div className={css.docBody}>
                      {docPreview.lines.length === 0
                        ? '（无文本内容，可拖拽引用或在新标签打开）'
                        : docPreview.lines.map((line, i) => <div key={i}>{line}</div>)}
                    </div>
                  </div>
                )
              ) : state.workspaceId === '' ? (
                <div className={css.paneEmpty}><YzjCloudIcon size={28} /><span>选择左侧知识库查看文档</span></div>
              ) : (
                <div className={css.paneList}>
                  <div className={css.paneHead}>
                    {docCrumbs.length === 0 ? (
                      <span className={css.paneTitle}>
                        {asString(state.workspaces.map(asRecord).find(ws => asString(ws.id) === state.workspaceId)?.name ?? '知识库')}
                      </span>
                    ) : (
                      <nav className={css.crumbs} aria-label="文档位置">
                        <button type="button" className={css.crumbLink} onClick={() => { jumpCrumb(-1) }}>
                          {asString(state.workspaces.map(asRecord).find(ws => asString(ws.id) === state.workspaceId)?.name ?? '知识库')}
                        </button>
                        {docCrumbs.map((crumb, index) => (
                          <span key={crumb.id} className={css.crumbItem}>
                            <span className={css.crumbSep} aria-hidden="true">/</span>
                            {index === docCrumbs.length - 1
                              ? <span className={css.crumbCurrent}>{crumb.title}</span>
                              : (
                                  <button type="button" className={css.crumbLink} onClick={() => { jumpCrumb(index) }}>
                                    {crumb.title}
                                  </button>
                                )}
                          </span>
                        ))}
                      </nav>
                    )}
                  </div>
                  {state.docs.length === 0 && !state.loading && state.error === '' && <div className={css.empty}>暂无文档</div>}
                  {state.docs.map((item, index) => {
                    const node = asRecord(item)
                    const suffix = asString(node.fileSuffix)
                    const title = asString(node.title)
                    const id = asString(node.id)
                    const hasChildren = node.hasChildren === true
                      || (typeof node.childrenCount === 'number' && node.childrenCount > 0)
                    return (
                      <div key={`d${index}`} className={css.docRowWrap}>
                        <button
                          type="button"
                          className={css.item}
                          onClick={() => { openDoc(id) }}
                        >
                          <span className={css.itemTitle}>
                            <span className={css.docGlyph}>{suffix === 'dbt' ? '表' : '文'}</span>
                            <span className={css.itemTitleText}>{title}</span>
                          </span>
                          <span className={css.itemSub}>
                            {suffix === 'dbt' ? '多维表格' : '在线文档'} · {asString(node.updateTime).slice(0, 10)}
                            {hasChildren && typeof node.childrenCount === 'number' ? ` · ${node.childrenCount} 个子项` : ''}
                          </span>
                        </button>
                        {hasChildren && (
                          <button
                            type="button"
                            className={css.drill}
                            title={`打开「${title}」`}
                            aria-label={`打开文件夹 ${title}`}
                            onClick={() => { openFolder(id, title) }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'calendar' && (
        <div className={css.body}>
          <CalendarPane
            year={state.calYear}
            month={state.calMonth}
            day={state.calDay}
            events={state.calEvents}
            eventId={state.calEventId}
            eventDetail={eventDetail}
            onNavigate={(year, month, day) => {
              props.actions.setCalCursor(year, month)
              props.actions.setCalDay(day)
              props.actions.setCalEventId('')
              setEventDetail(null)
              if (year === state.calYear && month === state.calMonth) return
              const pad = (n: number): string => String(n).padStart(2, '0')
              const start = `${year}-${pad(month)}-01`
              const end = `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`
              props.actions.setLoading(true)
              props.actions.setError('')
              void props.fetchEvents(start, end).then((result) => {
                if (result.ok) props.actions.setCalEvents(asArray(result.value))
                else props.actions.setError(result.error.message)
                props.actions.setLoading(false)
              })
            }}
            onSelectEvent={pickEvent}
          />
        </div>
      )}

      {activeTab === 'chat' && (
        <div className={css.body}>
          <div className={css.twoPane}>
            <div className={css.paneLeft}>
              <div className={css.readAllRow}>
                <span className={css.readAllHint}>
                  {state.unreadTotal > 0 ? `共 ${state.unreadTotal > 99 ? '99+' : state.unreadTotal} 条未读` : '没有未读消息'}
                </span>
                <button
                  type="button"
                  className={css.readAll}
                  disabled={state.unreadTotal === 0}
                  onClick={() => {
                    markAllRead(state.groups)
                    props.actions.setGroups(state.groups.map(item => ({ ...asRecord(item), unreadCount: 0 })))
                    props.actions.setUnreadTotal(0)
                  }}
                >
                  全部已读
                </button>
              </div>
              <div className={css.paneList}>
              {state.groups.length === 0 && !state.loading && state.error === '' && (
                <div className={css.empty}><IconNewChatOutline16 /><span>暂无最近会话</span></div>
              )}
              {state.groups.map((item, index) => {
                const group = asRecord(item)
                const unread = effectiveUnread(asString(group.groupId), typeof group.unreadCount === 'number' ? group.unreadCount : 0)
                const name = asString(group.groupName)
                const lastTime = formatListTime(group.lastMsgSendTime)
                const preview = messagePreview(asRecord(group.lastMsg))
                const active = asString(group.groupId) === state.groupId
                return (
                  <button
                    key={`g${index}`}
                    type="button"
                    className={active ? `${css.item} ${css.itemActive}` : css.item}
                    onClick={() => { openGroup(asString(group.groupId)) }}
                  >
                    <span className={css.itemTitle}>
                      <GroupAvatar url={asString(group.headerUrl)} name={name} />
                      <span className={css.itemTitleText}>{name}</span>
                      {lastTime !== '' && <span className={css.itemTime}>{lastTime}</span>}
                      {unread > 0 && <span className={css.badge}>{unread > 99 ? '99+' : unread}</span>}
                    </span>
                    <span className={css.itemSub}>{preview}</span>
                  </button>
                )
              })}
              {state.groupsMore && (
                <button type="button" className={css.more} onClick={loadMoreGroups} disabled={state.loading}>
                  {state.loading ? '加载中…' : '加载更多会话'}
                </button>
              )}
            </div>
            </div>
            <div className={css.paneRight}>
            {state.groupId === '' ? (
                <div className={css.paneEmpty}><IconNewChatOutline16 /><span>选择左侧会话查看消息</span></div>
            ) : (
            <>
              <div className={css.chatHeader}>
                <GroupHead groups={state.groups} groupId={state.groupId} />
              </div>
              <div className={css.panelBanner} role="note">
                点群打开 DSH 群聊。悬浮窗不再发消息。
              </div>
              {anchorActive && (
                <div className={css.anchorHint} role="status">
                  已定位到锚点消息（来自「查看上下文」）
                </div>
              )}
              <div className={css.list} ref={listRef}>
              {messagesFetching && state.messages.length === 0 && <div className={css.empty} data-testid="yzj-chat-loading">加载中…</div>}
              {state.messages.length === 0 && !messagesFetching && state.error === '' && <div className={css.empty}>暂无消息</div>}
              {state.messagesMore && (
                <button type="button" className={css.more} onClick={loadOlderMessages} disabled={messagesFetching}>
                  {messagesFetching ? '加载中…' : '加载更早消息'}
                </button>
              )}
              {state.messages.map((item, index) => {
                const message = asRecord(item)
                const msgType = asString(message.msgType)
                const sendTime = formatMsgTime(message.sendTime)
                const msgId = asString(message.msgId)
                const fromOpenId = asString(message.fromOpenId)
                const mine = myProfile.openId !== '' && fromOpenId === myProfile.openId
                const sender = fromOpenId === '' ? '' : senderNames[fromOpenId] ?? ''
                const anchored = msgId !== '' && msgId === state.anchorMsgId
                // Date divider: a new day between consecutive messages.
                const dayKey = String(message.sendTime).slice(0, 10)
                const prevDay = index > 0 ? String(asRecord(state.messages[index - 1]).sendTime).slice(0, 10) : ''
                const dayLabel = dayKey === '' ? '' : formatListTime(`${dayKey} 00:00:00`)
                const isSystem = msgType === 'other' || asString(asRecord(message.param).sysType) === 'withdrawMsg'
                return (
                  <div key={`m${index}`}>
                    {dayKey !== '' && dayKey !== prevDay && (
                      <div className={css.dayDivider}>{dayLabel}</div>
                    )}
                    <div
                      ref={anchored ? anchorRef : undefined}
                      className={[
                        css.msgRow,
                        isSystem ? css.msgRowSystem : '',
                        anchored ? css.itemAnchored : '',
                      ].filter(Boolean).join(' ')}
                    >
                      {!isSystem && (
                        <SenderAvatar openId={fromOpenId} fallback={sender === '' ? typeLabelOf(msgType) : sender} />
                      )}
                      <span className={css.msgStack}>
                        {!isSystem && (
                          <span className={css.msgMetaLine}>
                            <span className={css.msgSender}>{sender === '' ? typeLabelOf(msgType) : sender}{mine ? '（我）' : ''}</span>
                            <span className={css.msgTime}>{sendTime}</span>
                            {anchored && <span className={css.anchorTag}>锚点</span>}
                          </span>
                        )}
                        <span className={css.msgContent}>
                          <MessageBody
                            message={message}
                            onOpenImage={(src) => setLightbox({ src, kind: 'image' })}
                            onOpenPdf={(src) => setLightbox({ src, kind: 'pdf' })}
                            inject={props}
                          />
                        </span>
                        {!isSystem && (
                          <button
                            type="button"
                            className={css.msgReply}
                            title="回复此消息"
                            aria-label="回复"
                            onClick={() => {
                              setReplyTo({ msgId, summary: dragTitleOf(message) })
                              draftRef.current?.focus()
                            }}
                          >
                            回复
                          </button>
                        )}
                      </span>
                    </div>
                  </div>
                )
              })}
              {anchorToast !== '' && (
                <div className={css.panelToast} role="status">{anchorToast}</div>
              )}
              </div>
              <div className={css.composer}>
                <button
                  type="button"
                  className={css.composerSend}
                  data-testid="yzj-open-group-room"
                  onClick={() => {
                    rememberImSeat({
                      groupId: state.groupId,
                      sessionId: '',
                      ...(groupNameOf(state.groups, state.groupId) === '' ? {} : { groupName: groupNameOf(state.groups, state.groupId) }),
                    })
                    setWorkbenchDomain('im')
                    openWorkbench()
                  }}
                >
                  打开群聊
                </button>
              </div>
            </>
          )}
            </div>
          </div>
        </div>
      )}

      {lightbox !== null && (
        <ImLightbox src={lightbox.src} kind={lightbox.kind} onClose={() => setLightbox(null)} />
      )}
    </div>
  )
}

function IconRefresh14() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 12a8 8 0 1 1-2.34-5.66" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M20 3v4h-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconClose14() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function IconChevronLeft14() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14.5 5.5L8 12l6.5 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
