/**
 * Group-room VIEW (docs/spec/group-room-topics.md R2/R7).
 * Identity/media share the floating-panel renderer; layout follows the
 * canvas prototype (self right, others left). Agent work lives on yzj-topic-*.
 * Registered as conversation.view「群聊」— not a Session.append event type.
 */
import { useEffect, useRef, useState } from 'react'
import { resolveSenders, senderNameOf } from './im-cache.ts'
import { ImLightbox, MessageBody, SenderAvatar, typeLabelOf } from './im-render.tsx'
import { emitRoomReplyRequest } from './reply-bus.ts'
import type { YzjPanelInject } from './rpc.ts'
import { YzjTopicDrawer } from './topic-drawer.tsx'
import { AdvanceFeedPicker } from './advance-feed-picker.tsx'
import { setAdvanceFeedback, useAdvanceFeedback } from './advance-feedback.ts'
import { setAdvanceAskDraft, useAdvanceAskDraft } from './advance-ask.ts'
import { topicListBadge } from './conv-list.tsx'
import { consumeTopicOpen } from './workbench-domain.ts'
import { registerRoomComposerHost, ROOM_COMPOSER_HOST_ID } from './composer-host.ts'
import {
  artifactOf, layoutRoomItems, topicReplyCount,
  type LayoutImEntry,
} from './room-layout.ts'
import css from './home.module.css'

/** JSON snapshot from `/yzj home-fused` (room fields; no host types). */
export interface FusedViewValue {
  readonly bound: boolean
  readonly kind?: 'room' | 'topic' | 'unbound'
  readonly binding?: { yzjConversationId: string; dshSessionId: string; yzjKind: 'group' | 'dm' }
  readonly items: readonly FusedViewItem[]
  readonly topics?: readonly RoomTopic[]
  readonly groupName?: string
}

export interface RoomTopic {
  readonly dshSessionId: string
  readonly title: string
  readonly source: string
  readonly lastActivity?: number
  readonly status?: 'running' | 'confirm' | 'done'
  readonly rootMsgId?: string
  readonly originWho?: string
  readonly originText?: string
  readonly originTime?: number
}

export type FusedViewItem =
  | { readonly kind: 'im'; readonly time: number; readonly entry: FusedImEntry }
  | { readonly kind: 'session'; readonly time: number; readonly hide: boolean; readonly event: { type: string; time: number; data: unknown } }
  | { readonly kind: 'pending'; readonly time: number; readonly pending: { writeId: string; toolName: string; status: string } }

export interface FusedImEntry extends LayoutImEntry {
  readonly status: string
  readonly replyMsgId?: string
}

/** Injected RPC + backfill + topic-open verbs. */
export interface YzjFusedInjected {
  readonly sessionId: string
  /** When set, the timeline follows this group (R24) instead of the hanger session. */
  readonly groupId?: string
  /** 决策 39: 事元 msg ref 跳转锚点 — timeline 加载后滚动并高亮这条消息。 */
  readonly anchorMsgId?: string
  homeFused: (sessionId: string, groupId?: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  homeBackfill: (sessionId: string, opts?: { beforeMsgId?: string; limit?: number; groupId?: string }) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  homeTopicOpen?: (input: {
    groupId: string
    rootMsgId?: string
    originWho?: string
    originText?: string
  }) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  homeTopicLens?: (sessionId: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  homeTopicAsk?: (sessionId: string, text: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  focusBoundSession?: (sessionId: string) => void
  fetchFileData?: YzjPanelInject['fetchFileData']
  fetchContact?: YzjPanelInject['fetchContact']
  advanceState?: YzjPanelInject['advanceState']
  advanceFeed?: YzjPanelInject['advanceFeed']
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function clock(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return ''
  const date = new Date(ms)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * Visible sender label. Never uses 「群消息」 as a person name.
 * Empty → directory result → BOT- senders 「机器人」 → openId tail → 「未知」.
 * Robot openIds are `BOT-` prefixed and never resolve via the contact
 * directory; without the branch they rendered as a raw id tail (543b4d).
 */
export function displayNameOf(entry: FusedImEntry, resolved?: string): string {
  if (entry.origin === 'robot-outbound') {
    if (resolved !== undefined && resolved !== '') return resolved
    return entry.fromName === '' ? '助手' : entry.fromName
  }
  if (entry.isSelf) return '我'
  if (resolved !== undefined && resolved !== '') return resolved
  if (entry.fromName !== '') return entry.fromName
  const openId = entry.fromOpenId ?? ''
  if (openId.startsWith('BOT-')) return '机器人'
  if (openId !== '') return openId.length > 6 ? openId.slice(-6) : openId
  return '未知'
}

/** Robot/assistant text posts longer than this collapse to a clamped digest. */
export const AGENT_CLAMP_CHARS = 240

/**
 * True when the row is a robot/assistant wall-of-text worth clamping (R7: the
 * IM timeline is not a markdown canvas — long agent posts fold to 4 lines
 * with 「展开全文」). Images/files/cards stay untouched.
 */
export function agentClampOf(entry: FusedImEntry): boolean {
  if (entry.isSelf) return false
  const robotish = entry.origin === 'robot-outbound' || (entry.fromOpenId ?? '').startsWith('BOT-')
  if (!robotish) return false
  const msgType = entry.msgType ?? 'text'
  if (msgType !== 'text' && msgType !== 'other') return false
  return entry.content.length > AGENT_CLAMP_CHARS
}

function parseTopics(raw: unknown): RoomTopic[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap(item => {
    const row = asRecord(item)
    const id = typeof row.dshSessionId === 'string' ? row.dshSessionId : ''
    if (id === '') return []
    return [{
      dshSessionId: id,
      title: typeof row.title === 'string' && row.title !== '' ? row.title : id,
      source: typeof row.source === 'string' ? row.source : 'yzj',
      ...(typeof row.lastActivity === 'number' ? { lastActivity: row.lastActivity } : {}),
      ...(row.status === 'confirm' || row.status === 'done' || row.status === 'running' ? { status: row.status } : {}),
      ...(typeof row.rootMsgId === 'string' ? { rootMsgId: row.rootMsgId } : {}),
      ...(typeof row.originWho === 'string' ? { originWho: row.originWho } : {}),
      ...(typeof row.originText === 'string' ? { originText: row.originText } : {}),
      ...(typeof row.originTime === 'number' ? { originTime: row.originTime } : {}),
    }]
  })
}

function parseImEntry(raw: unknown): FusedImEntry | undefined {
  const row = asRecord(raw)
  const msgId = typeof row.msgId === 'string' ? row.msgId : ''
  if (msgId === '') return undefined
  const param = typeof row.param === 'object' && row.param !== null
    ? row.param as Record<string, unknown>
    : undefined
  return {
    msgId,
    sentAt: typeof row.sentAt === 'number' ? row.sentAt : 0,
    fromName: typeof row.fromName === 'string' ? row.fromName : '',
    content: typeof row.content === 'string' ? row.content : '',
    origin: typeof row.origin === 'string' ? row.origin : 'inbound',
    isSelf: row.isSelf === true,
    status: typeof row.status === 'string' ? row.status : 'acked',
    ...(typeof row.fromOpenId === 'string' ? { fromOpenId: row.fromOpenId } : {}),
    ...(typeof row.replyMsgId === 'string' ? { replyMsgId: row.replyMsgId } : {}),
    ...(typeof row.topicSessionId === 'string' ? { topicSessionId: row.topicSessionId } : {}),
    ...(typeof row.msgType === 'string' ? { msgType: row.msgType } : {}),
    ...(param === undefined ? {} : { param }),
  }
}

function parseItems(raw: unknown): FusedViewItem[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    const row = asRecord(item)
    if (row.kind !== 'im') return []
    const entry = parseImEntry(row.entry)
    if (entry === undefined) return []
    return [{ kind: 'im' as const, time: typeof row.time === 'number' ? row.time : entry.sentAt, entry }]
  })
}

function messageRecord(entry: FusedImEntry): Record<string, unknown> {
  const param = { ...(entry.param ?? {}) }
  if (entry.replyMsgId !== undefined && param.replyMsgId === undefined) param.replyMsgId = entry.replyMsgId
  return {
    content: entry.content,
    msgType: entry.msgType ?? 'text',
    param,
  }
}

function seedNames(items: readonly FusedViewItem[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const item of items) {
    if (item.kind !== 'im') continue
    const openId = item.entry.fromOpenId ?? ''
    if (openId === '') continue
    if (item.entry.fromName !== '') out[openId] = item.entry.fromName
    const cachedName = senderNameOf(openId)
    if (cachedName !== '') out[openId] = cachedName
  }
  return out
}

type Phase = 'loading' | 'bound' | 'unbound'

const fusedCache = new Map<string, FusedViewValue>()

function cacheKeyOf(sessionId: string, groupId?: string): string {
  return groupId !== undefined && groupId !== '' ? `g:${groupId}` : sessionId
}

function remember(key: string, next: FusedViewValue): FusedViewValue {
  fusedCache.set(key, next)
  return next
}

/** Group id last fused for this room session, if the module cache still has it. */
export function cachedRoomGroupId(sessionId: string): string {
  const id = fusedCache.get(sessionId)?.binding?.yzjConversationId
  return id === undefined ? '' : id
}

/** True when the timeline is following the latest message (within slack px). */
export function streamAtBottom(
  el: Pick<HTMLElement, 'scrollHeight' | 'scrollTop' | 'clientHeight'>,
  slack = 40,
): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight < slack
}

function phaseOf(cached: FusedViewValue | undefined): Phase {
  if (cached === undefined) return 'loading'
  if (cached.kind === 'room' && cached.bound === true) return 'bound'
  if (cached.kind === 'unbound' || cached.kind === 'topic' || cached.bound === false) return 'unbound'
  return 'loading'
}

/**
 * Group-room stream. Unbound sessions show a private-chat hint only after
 * fused confirms it. Cache-miss shows 「加载群消息…」 (pitfall-013).
 */
export function YzjFusedView(props: YzjFusedInjected) {
  const viewKey = cacheKeyOf(props.sessionId, props.groupId)
  const cached = fusedCache.get(viewKey)
  const [held, setHeld] = useState<{ sessionId: string; value: FusedViewValue; phase: Phase }>(() => ({
    sessionId: viewKey,
    value: cached ?? { bound: false, items: [] },
    phase: phaseOf(cached),
  }))
  const value = held.sessionId === viewKey ? held.value : (cached ?? { bound: false, items: [] })
  const phase = held.sessionId === viewKey ? held.phase : phaseOf(cached)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [more, setMore] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  // Anchor auto-paging budget per viewKey (决策 39 后续): reset when the view swaps.
  const anchorPagesRef = useRef(0)
  useEffect(() => { anchorPagesRef.current = 0 }, [viewKey])
  const [names, setNames] = useState<Record<string, string>>(() => seedNames(cached?.items ?? []))
  const [lightbox, setLightbox] = useState<{ src: string; kind: 'image' | 'pdf' } | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [lensId, setLensId] = useState('')
  const [highlightMsgId, setHighlightMsgId] = useState('')
  const [optimistic, setOptimistic] = useState<RoomTopic[]>([])
  const [unclamped, setUnclamped] = useState<ReadonlySet<string>>(() => new Set())
  const [feedTarget, setFeedTarget] = useState<{ summary: string; refs: string[] } | null>(null)
  const feedback = useAdvanceFeedback()
  const askDraft = useAdvanceAskDraft()
  const highlightRef = useRef<HTMLDivElement | null>(null)
  const streamRef = useRef<HTMLDivElement | null>(null)
  const followBottomRef = useRef(true)
  const scrollRestoreRef = useRef<{ height: number; top: number } | null>(null)
  /** scrollHeight at the last stick; growth-driven scroll events are not user intent. */
  const stuckHeightRef = useRef(0)
  const streamContentRef = useRef<HTMLDivElement | null>(null)
  /** Set by wheel/touch: only a user-steered scroll may disengage follow-bottom. */
  const userSteerRef = useRef(false)

  useEffect(() => {
    const hit = fusedCache.get(viewKey)
    followBottomRef.current = true
    userSteerRef.current = false
    scrollRestoreRef.current = null
    setHeld({
      sessionId: viewKey,
      value: hit ?? { bound: false, items: [] },
      phase: phaseOf(hit),
    })
    setNames(seedNames(hit?.items ?? []))
    setDrawerOpen(false)
    setLensId('')
    setHighlightMsgId('')
    setOptimistic([])
    setUnclamped(new Set())
    setError('')
  }, [viewKey])

  useEffect(() => {
    if (highlightMsgId === '') return
    followBottomRef.current = false
    highlightRef.current?.scrollIntoView({ block: 'center' })
  }, [highlightMsgId, value.items])

  // 决策 39: anchored group-focus (事元 msg ref jump) — after the view swaps
  // onto the target group, highlight the anchor row. Fires after the viewKey
  // reset above, so ordering keeps the anchor sticky across group switches.
  useEffect(() => {
    if (props.anchorMsgId === undefined || props.anchorMsgId === '') return
    setHighlightMsgId(props.anchorMsgId)
  }, [props.anchorMsgId, viewKey])

  // 决策 41 讨论回环:advance 板「问助手/回到对话继续聊」直开话题抽屉(agent 问答面),
  // 不停在群时间线。binding 就绪后消费 latch;无 sessionId 时按 title 现 mint 一个话题。
  /** 喂给推进/话题透镜 refs 的渠道 token（决策 49）：群 id 优先 props（R24 跟随），回退绑定群。 */
  const boundGroupId = value.binding?.yzjConversationId
  const feedGroupId = props.groupId ?? (typeof boundGroupId === 'string' ? boundGroupId : '')
  useEffect(() => {
    const groupId = value.binding?.yzjConversationId
    if (groupId === undefined) return
    const pending = consumeTopicOpen(groupId)
    if (pending === null) return
    void (async () => {
      let sessionId = pending.sessionId ?? ''
      if (sessionId === '' && props.homeTopicOpen !== undefined) {
        const result = await props.homeTopicOpen({ groupId, ...(pending.title === undefined ? {} : { title: pending.title }) })
        const minted = asRecord(result.ok ? result.value : null).sessionId
        if (typeof minted === 'string') sessionId = minted
      }
      if (sessionId === '') return
      setDrawerOpen(true)
      setLensId(sessionId)
    })()
    // consume-once latch; binding identity churns per poll but the latch is gone after the first match.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey, value.binding])

  // 决策 39 后续:捞过的消息本体都在 bound log(每群 500 条)且 fused 全量读,
  // 但从未开过的群只 backfill 最近 50 条 — 锚点被新消息顶出窗口时自动翻页
  // 加载更早(有界,防无限拉;找到或到底即停)。
  useEffect(() => {
    if (props.anchorMsgId === undefined || props.anchorMsgId === '') return
    if (value.items.some(item => item.kind === 'im' && item.entry.msgId === props.anchorMsgId)) return
    if (!more || loadingOlder || phase !== 'bound') return
    if (anchorPagesRef.current >= 10) return
    anchorPagesRef.current += 1
    void loadOlder()
    // loadOlder is a stable closure over state refs (same pattern as above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.anchorMsgId, viewKey, value.items, more, loadingOlder, phase])

  useEffect(() => {
    const el = streamRef.current
    const content = streamContentRef.current
    if (el === null) return
    const stick = (): void => {
      const restore = scrollRestoreRef.current
      if (restore !== null) {
        const delta = el.scrollHeight - restore.height
        if (delta > 0) el.scrollTop = restore.top + delta
        scrollRestoreRef.current = null
        stuckHeightRef.current = el.scrollHeight
        return
      }
      if (followBottomRef.current) el.scrollTop = el.scrollHeight
      stuckHeightRef.current = el.scrollHeight
    }
    stick()
    if (typeof ResizeObserver === 'undefined') return
    // Observe the CONTENT box, not the scroller: the scroller's own height is
    // flex-fixed, so late-loading images grow the content without ever firing
    // a scroller ResizeObserver (pitfall-020 follow-up).
    const observer = new ResizeObserver(() => { stick() })
    if (content !== null) observer.observe(content)
    return () => observer.disconnect()
  }, [value.items, viewKey, phase])

  const applyFused = (raw: Record<string, unknown>): FusedViewValue => {
    const items = parseItems(raw.items)
    const binding = typeof raw.binding === 'object' && raw.binding !== null
      ? raw.binding as NonNullable<FusedViewValue['binding']>
      : undefined
    const kind = raw.kind === 'room' || raw.kind === 'topic' || raw.kind === 'unbound'
      ? raw.kind
      : raw.bound === true ? 'room' : 'unbound'
    const next = remember(viewKey, {
      bound: raw.bound === true,
      kind,
      items,
      topics: parseTopics(raw.topics),
      ...(binding === undefined ? {} : { binding }),
      ...(typeof raw.groupName === 'string' && raw.groupName !== '' ? { groupName: raw.groupName } : {}),
    })
    const nextPhase: Phase = next.kind === 'room' && next.bound === true ? 'bound' : 'unbound'
    setHeld({ sessionId: viewKey, value: next, phase: nextPhase })
    return next
  }

  useEffect(() => {
    // Overlay cover with no group picked yet: an empty viewKey means no
    // sessionId AND no groupId — the host would reject the empty payload
    // (pitfall-039), so stay idle until a group is selected.
    if (viewKey === '') return
    let cancelled = false
    const load = async (backfill: boolean): Promise<void> => {
      const fused = await props.homeFused(props.sessionId, props.groupId)
      if (cancelled) return
      if (!fused.ok) {
        setError(fused.error.message)
        return
      }
      setError('')
      const next = applyFused(asRecord(fused.value))
      const seeded = seedNames(next.items)
      if (Object.keys(seeded).length > 0) setNames(prev => ({ ...seeded, ...prev }))
      if (backfill) {
        const stats = await props.homeBackfill(props.sessionId, props.groupId === undefined || props.groupId === ''
          ? undefined
          : { groupId: props.groupId })
        if (cancelled) return
        if (stats.ok) {
          const raw = asRecord(stats.value)
          if (raw.more === false) setMore(false)
          const again = await props.homeFused(props.sessionId, props.groupId)
          if (!cancelled && again.ok) applyFused(asRecord(again.value))
        }
      }
      if (props.fetchContact !== undefined) {
        const openIds = next.items.flatMap(item => item.kind === 'im' && item.entry.fromOpenId !== undefined
          ? [item.entry.fromOpenId] : [])
        const found = await resolveSenders(openIds, { fetchContact: props.fetchContact })
        if (!cancelled && Object.keys(found).length > 0) setNames(prev => ({ ...prev, ...found }))
      }
    }
    void load(true)
    const timer = window.setInterval(() => { void load(false) }, 800)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey])

  const openTopic = async (entry: FusedImEntry): Promise<void> => {
    const groupId = value.binding?.yzjConversationId
    if (groupId === undefined || props.homeTopicOpen === undefined) return
    setBusyId(entry.msgId)
    const result = await props.homeTopicOpen({
      groupId,
      rootMsgId: entry.msgId,
      originWho: entry.fromName,
      originText: entry.content,
    })
    setBusyId('')
    if (!result.ok) {
      setError(result.error.message)
      return
    }
    const sessionId = typeof asRecord(result.value).sessionId === 'string'
      ? asRecord(result.value).sessionId as string : ''
    if (sessionId === '') return
    setOptimistic(prev => {
      if (prev.some(row => row.dshSessionId === sessionId || row.rootMsgId === entry.msgId)) return prev
      return [...prev, {
        dshSessionId: sessionId,
        title: entry.content.replace(/\s+/g, ' ').trim().slice(0, 24) || '新话题',
        source: 'dsh',
        lastActivity: Date.now(),
        rootMsgId: entry.msgId,
        originWho: entry.fromName,
        originText: entry.content,
        originTime: entry.sentAt,
      }]
    })
    setDrawerOpen(true)
    setLensId(sessionId)
  }

  const loadOlder = async (): Promise<void> => {
    if (loadingOlder) return
    const oldest = value.items.find(item => item.kind === 'im')
    const beforeMsgId = oldest?.kind === 'im' ? oldest.entry.msgId : ''
    if (beforeMsgId === '') {
      setMore(false)
      return
    }
    const el = streamRef.current
    if (el !== null) {
      scrollRestoreRef.current = { height: el.scrollHeight, top: el.scrollTop }
      followBottomRef.current = false
    }
    setLoadingOlder(true)
    const stats = await props.homeBackfill(props.sessionId, {
      beforeMsgId,
      limit: 20,
      ...(props.groupId === undefined || props.groupId === '' ? {} : { groupId: props.groupId }),
    })
    setLoadingOlder(false)
    if (!stats.ok) {
      setError(stats.error.message)
      return
    }
    const raw = asRecord(stats.value)
    if (raw.more === false) setMore(false)
    const result = await props.homeFused(props.sessionId, props.groupId)
    if (!result.ok) return
    const next = applyFused(asRecord(result.value))
    const seeded = seedNames(next.items)
    if (Object.keys(seeded).length > 0) setNames(prev => ({ ...seeded, ...prev }))
  }

  // Topic snapshots are agent sessions: never paint the IM timeline
  // even if this view is still mounted (R22 / pitfall-022).
  if (value.kind === 'topic') return null

  // Cache-miss / empty still use the room column so `#yzj-room-composer-host`
  // stays mounted. An early return here unregisters the portal and the official
  // InputBar flashes (pitfall-024 follow-up).
  const emptyPhase = phase === 'unbound' || (phase === 'loading' && value.items.length === 0)

  const serverTopics = value.topics ?? []
  const topics = [
    ...serverTopics,
    ...optimistic.filter(row => !serverTopics.some(topic => (
      topic.dshSessionId === row.dshSessionId
      || (row.rootMsgId !== undefined && topic.rootMsgId === row.rootMsgId)
    ))),
  ]
  const topicByRoot = new Map(topics.flatMap(topic => (
    topic.rootMsgId === undefined ? [] : [[topic.rootMsgId, topic] as const]
  )))
  const topicBySession = new Map(topics.map(topic => [topic.dshSessionId, topic]))
  const fileInject = { fetchFileData: props.fetchFileData ?? (async () => ({ ok: false as const, error: { message: 'file-data unavailable' } })) }
  const isGroup = value.binding?.yzjKind !== 'dm'
  const topicBadge = topicListBadge(topics)
  const openLens = (sessionId: string): void => {
    if (sessionId === '') return
    setDrawerOpen(true)
    setLensId(sessionId)
  }

  return (
    <div className={css.roomMain}>
      {error !== '' && !emptyPhase && <div className={css.hint} role="alert">{error}</div>}
      <div className={css.roomMainHead}>
        {isGroup && !emptyPhase && (
          <button
            type="button"
            className={css.topicToggle}
            data-testid="yzj-topic-toggle"
            aria-pressed={drawerOpen}
            onClick={() => {
              if (drawerOpen) {
                setDrawerOpen(false)
                setLensId('')
                return
              }
              setDrawerOpen(true)
            }}
          >
            话题 {topics.length}
            {topicBadge.confirmCount > 0 && (
              <span className={css.topicToggleBadge} data-testid="yzj-topic-badge">{topicBadge.confirmCount}</span>
            )}
          </button>
        )}
      </div>
      <div className={css.roomStage}>
        <div className={css.roomTimeline}>
        {feedback !== null && props.advanceFeed !== undefined && (
          <div className={css.chrome} data-testid="yzj-advance-feedback-card">
            <span>正在反馈 · {feedback.title}（{feedback.advanceId}）</span>
            <FeedbackLine
              advanceId={feedback.advanceId}
              advanceFeed={props.advanceFeed}
              onDone={() => setAdvanceFeedback(null)}
            />
            <button type="button" className={css.chromeLink} onClick={() => setAdvanceFeedback(null)}>取消</button>
          </div>
        )}
        {askDraft !== null && (
          <div className={css.chrome} data-testid="yzj-advance-ask-banner">
            <span>{askDraft.kind === 'export' ? '复盘沉淀已预备' : askDraft.kind === 'discuss' ? '进展讨论已预备' : '验收问题已预备'} · {askDraft.title}{askDraft.advanceId === '' ? '' : `（${askDraft.advanceId}）`}。打开话题后会出现在问助手栏。</span>
            <button type="button" className={css.chromeLink} onClick={() => setAdvanceAskDraft(null)}>取消</button>
          </div>
        )}
        {emptyPhase ? (
        <div className={css.stream} data-testid="yzj-fused-stream">
          <div className={css.unbound}>
            {viewKey === '' ? '在左侧选择一个群开始。' : phase === 'unbound' ? '还没有对话。' : (
              <div className={css.hint}>{error !== '' ? error : '加载群消息…'}</div>
            )}
          </div>
        </div>
        ) : (
        <div
          className={css.stream}
          data-testid="yzj-fused-stream"
          ref={streamRef}
          onWheel={() => { userSteerRef.current = true }}
          onTouchMove={() => { userSteerRef.current = true }}
          onScroll={() => {
            const el = streamRef.current
            if (el === null) return
            // Content growth fires scroll events too (the stick effect re-seats
            // scrollTop); only a scroll at a stable height can steer. Even then,
            // programmatic scrollIntoView (harness focus management) is
            // indistinguishable from a user drag — so only wheel/touch-marked
            // scrolls may disengage follow-bottom; landing at the bottom
            // re-engages from any source (pitfall-020 follow-up).
            if (el.scrollHeight !== stuckHeightRef.current) return
            if (streamAtBottom(el)) {
              followBottomRef.current = true
              userSteerRef.current = false
              return
            }
            if (!userSteerRef.current) return
            userSteerRef.current = false
            followBottomRef.current = false
          }}
        >
          <div className={css.streamContent} ref={streamContentRef}>
          {more && (
            <button type="button" className={css.streamMore} onClick={() => { void loadOlder() }} disabled={loadingOlder}>
              {loadingOlder ? '加载中…' : '加载更早消息'}
            </button>
          )}
          {layoutRoomItems<FusedImEntry>(value.items).map(node => {
            if (node.kind === 'sep') {
              return (
                <div key={`sep-${node.label}`} className={css.daySep} data-testid="yzj-day-sep">
                  <span>{node.label}</span>
                </div>
              )
            }
            const entry = node.entry
            const mine = entry.isSelf
            const assistant = entry.origin === 'robot-outbound'
            const linked = topicByRoot.get(entry.msgId)
            const fromTopic = entry.topicSessionId === undefined
              ? undefined
              : topicBySession.get(entry.topicSessionId)
            const openId = entry.fromOpenId ?? ''
            const sender = displayNameOf(entry, openId !== '' ? names[openId] : undefined)
            const clamped = agentClampOf(entry) && !unclamped.has(entry.msgId)
            const clampable = agentClampOf(entry)
            const highlighted = highlightMsgId === entry.msgId
            const artifact = artifactOf(entry)
            const hideFileBody = artifact !== undefined && entry.msgType === 'file'
            const rowClass = [
              css.roomRow,
              mine ? css.roomRowSelf : css.roomRowOther,
              node.merged ? css.roomRowMerged : '',
              highlighted ? css.roomRowHighlight : '',
            ].filter(Boolean).join(' ')
            const bubbleClass = [
              css.roomBubble,
              mine ? css.roomBubbleSelf : css.roomBubbleOther,
              assistant ? css.roomBubbleAssistant : '',
            ].filter(Boolean).join(' ')
            const time = clock(entry.sentAt)
            return (
              <div
                key={`im-${entry.msgId}`}
                className={rowClass}
                data-origin={entry.origin}
                data-merged={node.merged ? 'true' : 'false'}
                data-testid={`yzj-room-row-${entry.msgId}`}
                ref={highlighted ? highlightRef : undefined}
              >
                {!mine && (
                  node.merged
                    ? <span className={css.roomAvatarSlot} aria-hidden="true" />
                    : <SenderAvatar openId={openId} fallback={sender === '' ? typeLabelOf(entry.msgType ?? 'text') : sender} />
                )}
                <span className={css.roomStack}>
                  {!node.merged && (
                    <span className={css.roomMeta}>
                      {mine ? `我${time === '' ? '' : ` · ${time}`}` : `${sender}${time === '' ? '' : ` · ${time}`}`}
                      {entry.status === 'pending' ? ' · 发送中…' : ''}
                      {entry.status === 'failed' ? ' · 发送失败' : ''}
                    </span>
                  )}
                  <span className={bubbleClass}>
                    {!hideFileBody && (
                      clamped
                        ? (
                          <span className={css.roomClamp}>
                            <MessageBody
                              message={messageRecord(entry)}
                              onOpenImage={(src) => setLightbox({ src, kind: 'image' })}
                              onOpenPdf={(src) => setLightbox({ src, kind: 'pdf' })}
                              inject={fileInject}
                            />
                          </span>
                        )
                        : (
                          <MessageBody
                            message={messageRecord(entry)}
                            onOpenImage={(src) => setLightbox({ src, kind: 'image' })}
                            onOpenPdf={(src) => setLightbox({ src, kind: 'pdf' })}
                            inject={fileInject}
                          />
                        )
                    )}
                    {clampable && (
                      <button
                        type="button"
                        className={css.roomClampToggle}
                        onClick={() => {
                          setUnclamped((prev) => {
                            const next = new Set(prev)
                            if (next.has(entry.msgId)) next.delete(entry.msgId)
                            else next.add(entry.msgId)
                            return next
                          })
                        }}
                      >
                        {clamped ? '展开全文' : '收起'}
                      </button>
                    )}
                    {artifact !== undefined && (
                      <span className={css.artifactCard} data-testid={`yzj-artifact-${entry.msgId}`}>
                        <span className={css.artifactType}>{artifact.type}</span>
                        <span className={css.artifactMeta}>
                          <span className={css.artifactName}>{artifact.name}</span>
                          <span className={css.artifactNote}>{artifact.note}</span>
                        </span>
                      </span>
                    )}
                    {linked !== undefined && (
                      <button
                        type="button"
                        className={css.replyChip}
                        data-testid={`yzj-reply-chip-${entry.msgId}`}
                        onClick={() => openLens(linked.dshSessionId)}
                      >
                        {topicReplyCount(linked, value.items)} 条回复
                      </button>
                    )}
                    {assistant && fromTopic !== undefined && linked === undefined && (
                      <button
                        type="button"
                        className={css.replyChip}
                        onClick={() => openLens(fromTopic.dshSessionId)}
                      >
                        来自话题 · {fromTopic.title}
                      </button>
                    )}
                  </span>
                  <span className={css.roomRowActions}>
                    <button
                      type="button"
                      className={css.roomAction}
                      onClick={() => emitRoomReplyRequest({ msgId: entry.msgId, summary: entry.content.slice(0, 80) })}
                    >
                      回复
                    </button>
                    {linked === undefined && !assistant && (
                      <button
                        type="button"
                        className={css.roomAction}
                        disabled={busyId === entry.msgId || props.homeTopicOpen === undefined}
                        onClick={() => { void openTopic(entry) }}
                      >
                        {busyId === entry.msgId ? '交给助手…' : '交给助手'}
                      </button>
                    )}
                    {props.advanceState !== undefined && props.advanceFeed !== undefined && !assistant && (
                      <button
                        type="button"
                        className={css.roomAction}
                        data-testid={`yzj-advance-feed-${entry.msgId}`}
                        onClick={() => setFeedTarget({
                          summary: entry.content.slice(0, 80),
                          // refs 带渠道 token（决策 39/49）：面板可定位到群消息，推荐可反推渠道。
                          refs: [feedGroupId === '' ? entry.msgId : `im:${feedGroupId}:${entry.msgId}`],
                        })}
                      >
                        喂给推进
                      </button>
                    )}
                  </span>
                </span>
              </div>
            )
          })}
          </div>
        </div>
        )}
        <div
          key={ROOM_COMPOSER_HOST_ID}
          ref={registerRoomComposerHost}
          id={ROOM_COMPOSER_HOST_ID}
          className={css.roomComposerHost}
          data-testid="yzj-room-composer-host"
        />
        </div>
        {isGroup && drawerOpen && (
          <YzjTopicDrawer
            groupName={value.groupName ?? ''}
            topics={topics}
            {...(feedGroupId === '' ? {} : { groupId: feedGroupId })}
            {...(lensId === '' ? {} : { lensSessionId: lensId })}
            onClose={() => {
              setDrawerOpen(false)
              setLensId('')
            }}
            onBack={() => setLensId('')}
            onOpenLens={openLens}
            onNative={(sessionId) => {
              if (sessionId !== '') props.focusBoundSession?.(sessionId)
            }}
            onJumpOrigin={(msgId) => setHighlightMsgId(msgId)}
            {...(props.homeTopicLens === undefined ? {} : { homeTopicLens: props.homeTopicLens })}
            {...(props.homeTopicAsk === undefined ? {} : { homeTopicAsk: props.homeTopicAsk })}
            {...(props.advanceState === undefined ? {} : { advanceState: props.advanceState })}
            {...(props.advanceFeed === undefined ? {} : { advanceFeed: props.advanceFeed })}
          />
        )}
      </div>
      {feedTarget !== null && props.advanceState !== undefined && props.advanceFeed !== undefined && (
        <AdvanceFeedPicker
          advanceState={props.advanceState}
          {...(feedback === null ? {} : { presetId: feedback.advanceId })}
          defaultSummary={feedTarget.summary}
          onClose={() => setFeedTarget(null)}
          onSubmit={async (advanceId, summary) => {
            const result = await props.advanceFeed?.({
              advanceId,
              summary,
              sourceType: '对话',
              refs: feedTarget.refs,
            })
            if (result === undefined || !result.ok) {
              return { ok: false, error: { message: result === undefined ? 'advanceFeed unavailable' : result.error.message } }
            }
            return { ok: true }
          }}
        />
      )}
      {lightbox !== null && (
        <ImLightbox src={lightbox.src} kind={lightbox.kind} onClose={() => setLightbox(null)} />
      )}
    </div>
  )
}

/** One-line feed on the 「现在反馈」 card (sourceType 人工, no msg ref). */
function FeedbackLine(props: {
  advanceId: string
  advanceFeed: NonNullable<YzjFusedInjected['advanceFeed']>
  onDone: () => void
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const send = async (): Promise<void> => {
    const summary = text.trim()
    if (summary === '') {
      setError('写一句反馈')
      return
    }
    setBusy(true)
    setError('')
    const result = await props.advanceFeed({ advanceId: props.advanceId, summary, sourceType: '人工' })
    setBusy(false)
    if (!result.ok) {
      setError(result.error.message)
      return
    }
    setText('')
    props.onDone()
  }
  return (
    <>
      <input
        className={css.topicDrawerInput}
        data-testid="yzj-advance-feedback-summary"
        placeholder="一句话反馈…"
        value={text}
        onChange={event => setText(event.target.value)}
        disabled={busy}
      />
      <button
        type="button"
        className={`${css.chromeBtn} ${css.chromePrimary}`}
        data-testid="yzj-advance-feedback-send"
        disabled={busy}
        onClick={() => { void send() }}
      >
        {busy ? '写入中…' : '喂进去'}
      </button>
      {error !== '' && <span role="alert">{error}</span>}
    </>
  )
}
