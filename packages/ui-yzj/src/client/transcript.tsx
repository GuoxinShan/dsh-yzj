/**
 * Group-room VIEW (docs/spec/group-room-topics.md R2/R7).
 * Identity/media share the floating-panel renderer; layout follows the
 * canvas prototype (self right, others left). Agent work lives on yzj-topic-*.
 * Registered as conversation.view「群房间」— not a Session.append event type.
 */
import { useEffect, useRef, useState } from 'react'
import { resolveSenders, senderNameOf } from './im-cache.ts'
import { ImLightbox, MessageBody, SenderAvatar, typeLabelOf } from './im-render.tsx'
import { emitRoomReplyRequest } from './reply-bus.ts'
import type { YzjPanelInject } from './rpc.ts'
import { YzjTopicDrawer } from './topic-drawer.tsx'
import { topicListBadge } from './conv-list.tsx'
import { ROOM_COMPOSER_HOST_ID } from './room-composer.tsx'
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
  homeFused: (sessionId: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  homeBackfill: (sessionId: string, opts?: { beforeMsgId?: string; limit?: number }) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  homeTopicOpen?: (input: {
    groupId: string
    rootMsgId?: string
    originWho?: string
    originText?: string
  }) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  focusBoundSession?: (sessionId: string) => void
  fetchFileData?: YzjPanelInject['fetchFileData']
  fetchContact?: YzjPanelInject['fetchContact']
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
 * Empty → directory result → openId tail → 「未知」.
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
  if (openId !== '') return openId.length > 6 ? openId.slice(-6) : openId
  return '未知'
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

function remember(sessionId: string, next: FusedViewValue): FusedViewValue {
  fusedCache.set(sessionId, next)
  return next
}

function phaseOf(cached: FusedViewValue | undefined): Phase {
  if (cached === undefined) return 'loading'
  if (cached.bound === true && cached.kind !== 'unbound') return 'bound'
  if (cached.kind === 'unbound' || cached.bound === false) return 'unbound'
  return 'loading'
}

/**
 * Group-room stream. Unbound sessions show a private-chat hint only after
 * fused confirms it. Cache-miss shows 「加载群消息…」 (pitfall-013).
 */
export function YzjFusedView(props: YzjFusedInjected) {
  const cached = fusedCache.get(props.sessionId)
  const [held, setHeld] = useState<{ sessionId: string; value: FusedViewValue; phase: Phase }>(() => ({
    sessionId: props.sessionId,
    value: cached ?? { bound: false, items: [] },
    phase: phaseOf(cached),
  }))
  const value = held.sessionId === props.sessionId ? held.value : (cached ?? { bound: false, items: [] })
  const phase = held.sessionId === props.sessionId ? held.phase : phaseOf(cached)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [more, setMore] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [names, setNames] = useState<Record<string, string>>({})
  const [lightbox, setLightbox] = useState<{ src: string; kind: 'image' | 'pdf' } | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [lensId, setLensId] = useState('')
  const [highlightMsgId, setHighlightMsgId] = useState('')
  const [optimistic, setOptimistic] = useState<RoomTopic[]>([])
  const highlightRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const hit = fusedCache.get(props.sessionId)
    setHeld({
      sessionId: props.sessionId,
      value: hit ?? { bound: false, items: [] },
      phase: phaseOf(hit),
    })
    setDrawerOpen(false)
    setLensId('')
    setHighlightMsgId('')
    setOptimistic([])
    setError('')
  }, [props.sessionId])

  useEffect(() => {
    if (highlightMsgId === '') return
    highlightRef.current?.scrollIntoView({ block: 'center' })
  }, [highlightMsgId, value.items])

  const applyFused = (raw: Record<string, unknown>): FusedViewValue => {
    const items = parseItems(raw.items)
    const binding = typeof raw.binding === 'object' && raw.binding !== null
      ? raw.binding as NonNullable<FusedViewValue['binding']>
      : undefined
    const kind = raw.kind === 'room' || raw.kind === 'topic' || raw.kind === 'unbound'
      ? raw.kind
      : raw.bound === true ? 'room' : 'unbound'
    const next = remember(props.sessionId, {
      bound: raw.bound === true,
      kind,
      items,
      topics: parseTopics(raw.topics),
      ...(binding === undefined ? {} : { binding }),
      ...(typeof raw.groupName === 'string' && raw.groupName !== '' ? { groupName: raw.groupName } : {}),
    })
    const nextPhase: Phase = next.kind === 'unbound' || next.bound !== true ? 'unbound' : 'bound'
    setHeld({ sessionId: props.sessionId, value: next, phase: nextPhase })
    return next
  }

  useEffect(() => {
    let cancelled = false
    const load = async (backfill: boolean): Promise<void> => {
      const fused = await props.homeFused(props.sessionId)
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
        const stats = await props.homeBackfill(props.sessionId)
        if (cancelled) return
        if (stats.ok) {
          const raw = asRecord(stats.value)
          if (raw.more === false) setMore(false)
          const again = await props.homeFused(props.sessionId)
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
  }, [props.sessionId])

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
    setLoadingOlder(true)
    const stats = await props.homeBackfill(props.sessionId, { beforeMsgId, limit: 20 })
    setLoadingOlder(false)
    if (!stats.ok) {
      setError(stats.error.message)
      return
    }
    const raw = asRecord(stats.value)
    if (raw.more === false) setMore(false)
    const result = await props.homeFused(props.sessionId)
    if (!result.ok) return
    const next = applyFused(asRecord(result.value))
    const seeded = seedNames(next.items)
    if (Object.keys(seeded).length > 0) setNames(prev => ({ ...seeded, ...prev }))
  }

  if (phase === 'unbound') {
    return (
      <div className={css.unbound} data-testid="yzj-fused-stream">
        这是私密会话：没有群消息流。下方发送只给助手。
        要用「丢进群」把可见摘要交到群房间。
      </div>
    )
  }

  if (phase === 'loading' && value.items.length === 0) {
    return (
      <div className={css.unbound} data-testid="yzj-fused-stream">
        <div className={css.hint}>{error !== '' ? error : '加载群消息…'}</div>
      </div>
    )
  }

  if (value.kind === 'topic') return null

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
      {error !== '' && <div className={css.hint} role="alert">{error}</div>}
      {isGroup && (
        <div className={css.roomMainHead}>
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
        </div>
      )}
      <div className={css.roomStage}>
        <div className={css.roomTimeline}>
        <div className={css.stream} data-testid="yzj-fused-stream">
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
                      <MessageBody
                        message={messageRecord(entry)}
                        onOpenImage={(src) => setLightbox({ src, kind: 'image' })}
                        onOpenPdf={(src) => setLightbox({ src, kind: 'pdf' })}
                        inject={fileInject}
                      />
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
                  </span>
                </span>
              </div>
            )
          })}
        </div>
        <div
          id={ROOM_COMPOSER_HOST_ID}
          className={css.roomComposerHost}
          data-testid="yzj-room-composer-host"
        />
        </div>
        {isGroup && drawerOpen && (
          <YzjTopicDrawer
            groupName={value.groupName ?? ''}
            topics={topics}
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
          />
        )}
      </div>
      {lightbox !== null && (
        <ImLightbox src={lightbox.src} kind={lightbox.kind} onClose={() => setLightbox(null)} />
      )}
    </div>
  )
}
