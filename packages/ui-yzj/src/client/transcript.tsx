/**
 * Bound-session fused VIEW (docs/spec/dsh-home-transcript.md §4).
 * ①② live in the plugin log; ③④ + pending overlay merge by timestamp.
 * IM rows reuse the panel renderer (avatars, emoticons, files, quotes).
 * Registered as conversation.view「群工作」— not a Session.append event type.
 */
import { useEffect, useState } from 'react'
import { formatListTime, resolveSenders, senderNameOf } from './im-cache.ts'
import { ImLightbox, MessageBody, SenderAvatar, typeLabelOf } from './im-render.tsx'
import type { YzjPanelInject } from './rpc.ts'
import css from './home.module.css'

/** JSON snapshot from `/yzj home-fused` (no host types on the client). */
export interface FusedViewValue {
  readonly bound: boolean
  readonly binding?: { yzjConversationId: string; dshSessionId: string; yzjKind: 'group' | 'dm' }
  readonly items: readonly FusedViewItem[]
}

export type FusedViewItem =
  | { readonly kind: 'im'; readonly time: number; readonly entry: FusedImEntry }
  | { readonly kind: 'session'; readonly time: number; readonly hide: boolean; readonly event: { type: string; time: number; data: unknown } }
  | { readonly kind: 'pending'; readonly time: number; readonly pending: { writeId: string; toolName: string; status: string } }

export interface FusedImEntry {
  readonly msgId: string
  readonly sentAt: number
  readonly fromName: string
  readonly content: string
  readonly origin: string
  readonly isSelf: boolean
  readonly status: string
  readonly fromOpenId?: string
  readonly replyMsgId?: string
  readonly msgType?: string
  readonly param?: Record<string, unknown>
}

/** Injected RPC + backfill + panel IM verbs. */
export interface YzjFusedInjected {
  readonly sessionId: string
  homeFused: (sessionId: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  homeBackfill: (sessionId: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  fetchFileData?: YzjPanelInject['fetchFileData']
  fetchContact?: YzjPanelInject['fetchContact']
}

type Phase = 'loading' | 'bound' | 'unbound'

const fusedCache = new Map<string, FusedViewValue>()

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function clock(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return ''
  const date = new Date(ms)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function dayKeyOf(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return ''
  const date = new Date(ms)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function eventText(event: { type: string; data: unknown }): string {
  const data = asRecord(event.data)
  if (typeof data.content === 'string') return data.content
  if (!Array.isArray(data.content)) return ''
  return data.content
    .map(block => {
      if (typeof block === 'string') return block
      const row = asRecord(block)
      return typeof row.text === 'string' ? row.text : ''
    })
    .filter(text => text !== '')
    .join('\n')
}

/**
 * Visible sender label. Never uses 「群消息」 as a person name.
 * Empty → directory result → openId tail → 「未知」.
 */
export function displayNameOf(entry: FusedImEntry, resolved?: string): string {
  if (entry.isSelf) return '我'
  if (resolved !== undefined && resolved !== '') return resolved
  if (entry.fromName !== '') return entry.fromName
  const openId = entry.fromOpenId ?? ''
  if (openId !== '') return openId.length > 6 ? openId.slice(-6) : openId
  return '未知'
}

function parseItems(raw: unknown): FusedViewItem[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item): FusedViewItem[] => {
    const row = asRecord(item)
    if (row.kind === 'im') {
      const entry = asRecord(row.entry)
      const msgId = typeof entry.msgId === 'string' ? entry.msgId : ''
      if (msgId === '') return []
      const param = typeof entry.param === 'object' && entry.param !== null
        ? entry.param as Record<string, unknown>
        : undefined
      const fromOpenId = typeof entry.fromOpenId === 'string' ? entry.fromOpenId : undefined
      const replyMsgId = typeof entry.replyMsgId === 'string' ? entry.replyMsgId : undefined
      const msgType = typeof entry.msgType === 'string' ? entry.msgType : undefined
      return [{
        kind: 'im' as const,
        time: typeof row.time === 'number' ? row.time : 0,
        entry: {
          msgId,
          sentAt: typeof entry.sentAt === 'number' ? entry.sentAt : 0,
          fromName: typeof entry.fromName === 'string' ? entry.fromName : '',
          content: typeof entry.content === 'string' ? entry.content : '',
          origin: typeof entry.origin === 'string' ? entry.origin : 'inbound',
          isSelf: entry.isSelf === true,
          status: typeof entry.status === 'string' ? entry.status : 'acked',
          ...(fromOpenId === undefined || fromOpenId === '' ? {} : { fromOpenId }),
          ...(replyMsgId === undefined ? {} : { replyMsgId }),
          ...(msgType === undefined ? {} : { msgType }),
          ...(param === undefined ? {} : { param }),
        },
      }]
    }
    if (row.kind === 'pending') {
      const pending = asRecord(row.pending)
      return [{
        kind: 'pending' as const,
        time: typeof row.time === 'number' ? row.time : 0,
        pending: {
          writeId: typeof pending.writeId === 'string' ? pending.writeId : '',
          toolName: typeof pending.toolName === 'string' ? pending.toolName : '',
          status: typeof pending.status === 'string' ? pending.status : '',
        },
      }]
    }
    if (row.kind === 'session') {
      const event = asRecord(row.event)
      return [{
        kind: 'session' as const,
        time: typeof row.time === 'number' ? row.time : 0,
        hide: row.hide === true,
        event: {
          type: typeof event.type === 'string' ? event.type : '',
          time: typeof event.time === 'number' ? event.time : 0,
          data: event.data,
        },
      }]
    }
    return []
  })
}

function parseValue(raw: unknown): FusedViewValue {
  const record = asRecord(raw)
  const binding = typeof record.binding === 'object' && record.binding !== null
    ? record.binding as NonNullable<FusedViewValue['binding']>
    : undefined
  return {
    bound: record.bound === true,
    items: parseItems(record.items),
    ...(binding === undefined ? {} : { binding }),
  }
}

function messageRecord(entry: FusedImEntry): Record<string, unknown> {
  const param = { ...(entry.param ?? {}) }
  if (entry.replyMsgId !== undefined && asRecord(param).replyMsgId === undefined) {
    param.replyMsgId = entry.replyMsgId
  }
  return {
    content: entry.content,
    msgType: entry.msgType ?? 'text',
    param,
    fromOpenId: entry.fromOpenId ?? '',
  }
}

function seedNames(items: readonly FusedViewItem[]): Record<string, string> {
  const seeded: Record<string, string> = {}
  for (const item of items) {
    if (item.kind !== 'im') continue
    const openId = item.entry.fromOpenId ?? ''
    if (openId === '') continue
    const name = senderNameOf(openId)
    if (name !== '') seeded[openId] = name
  }
  return seeded
}

function applySnapshot(
  sessionId: string,
  raw: unknown,
): FusedViewValue {
  const value = parseValue(raw)
  fusedCache.set(sessionId, value)
  return value
}

function phaseOf(cached: FusedViewValue | undefined): Phase {
  if (cached === undefined) return 'loading'
  return cached.bound ? 'bound' : 'unbound'
}

/**
 * Bound fused stream. Unbound sessions show a private-chat hint (no ①②).
 * Switching sessions paints cache / local log first; backfill is a second
 * stage so the view never flashes 「私密会话」 while the CLI is in flight.
 * Display is derived from `sessionId` so the first frame after a switch
 * does not keep the previous session's rows (the effect has not run yet).
 */
export function YzjFusedView(props: YzjFusedInjected) {
  const cached = fusedCache.get(props.sessionId)
  const [held, setHeld] = useState<{ sessionId: string; value: FusedViewValue; phase: Phase }>(() => ({
    sessionId: props.sessionId,
    value: cached ?? { bound: false, items: [] },
    phase: phaseOf(cached),
  }))
  const [error, setError] = useState('')
  const [names, setNames] = useState<Record<string, string>>({})
  const [lightbox, setLightbox] = useState<{ src: string; kind: 'image' | 'pdf' } | null>(null)

  const value = held.sessionId === props.sessionId
    ? held.value
    : cached ?? { bound: false, items: [] }
  const phase = held.sessionId === props.sessionId ? held.phase : phaseOf(cached)

  useEffect(() => {
    const hit = fusedCache.get(props.sessionId)
    setHeld({
      sessionId: props.sessionId,
      value: hit ?? { bound: false, items: [] },
      phase: phaseOf(hit),
    })
    setError('')
    setLightbox(null)
    let cancelled = false
    const paint = async (backfill: boolean): Promise<void> => {
      if (backfill) await props.homeBackfill(props.sessionId)
      const result = await props.homeFused(props.sessionId)
      if (cancelled) return
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      setError('')
      const next = applySnapshot(props.sessionId, result.value)
      setHeld({
        sessionId: props.sessionId,
        value: next,
        phase: next.bound ? 'bound' : 'unbound',
      })
      const seeded = seedNames(next.items)
      if (Object.keys(seeded).length > 0) setNames(prev => ({ ...seeded, ...prev }))
      if (props.fetchContact !== undefined) {
        const openIds = next.items.flatMap(item => item.kind === 'im' && item.entry.fromOpenId !== undefined
          ? [item.entry.fromOpenId] : [])
        const found = await resolveSenders(openIds, { fetchContact: props.fetchContact })
        if (!cancelled && Object.keys(found).length > 0) setNames(prev => ({ ...prev, ...found }))
      }
    }
    // Stage 1: local fused snapshot (fast). Stage 2: CLI backfill, then paint again.
    void paint(false).then(() => { if (!cancelled) void paint(true) })
    const timer = window.setInterval(() => { void paint(false) }, 800)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [props.sessionId])

  const fileInject = {
    fetchFileData: props.fetchFileData ?? (async () => ({ ok: false as const, error: { message: 'file-data unavailable' } })),
  }

  if (phase === 'unbound') {
    return (
      <div className={css.unbound}>
        这是私密会话：没有群消息流。下方发送只给助手。
        要用「丢进群」把可见摘要交到绑定群会话。
      </div>
    )
  }

  if (phase === 'loading' && value.items.length === 0) {
    return (
      <div className={css.stream} data-testid="yzj-fused-stream">
        <div className={css.hint}>{error !== '' ? error : '加载群消息…'}</div>
      </div>
    )
  }

  let lastDay = ''
  return (
    <div className={css.stream} data-testid="yzj-fused-stream">
      <div className={css.hint}>
        群工作时间线：云之家消息与发给助手 / 助手回复在同一条流。
        下方发送 = 发给助手；「发进群」才进群、不叫模型。
      </div>
      {error !== '' && <div className={css.hint} role="alert">{error}</div>}
      {value.items.map((item, index) => {
        if (item.kind === 'im') {
          const entry = item.entry
          const mine = entry.isSelf
          const openId = entry.fromOpenId ?? ''
          const sender = displayNameOf(entry, openId !== '' ? names[openId] : undefined)
          const day = dayKeyOf(entry.sentAt)
          const sep = day !== '' && day !== lastDay
          if (sep) lastDay = day
          const dayLabel = sep ? formatListTime(`${day} 00:00:00`) : ''
          return (
            <div key={`im-${entry.msgId}`}>
              {sep && (
                <div className={css.daySep} data-testid="yzj-day-sep"><span>{dayLabel === '' ? day : dayLabel}</span></div>
              )}
              <div
                className={`${css.row} ${mine ? css.rowSelf : css.rowOther}`}
                data-origin={entry.origin}
                data-testid={`yzj-room-row-${entry.msgId}`}
              >
                {!mine && (
                  <SenderAvatar openId={openId} fallback={sender === '未知' ? typeLabelOf(entry.msgType ?? 'text') : sender} />
                )}
                <span className={css.stack}>
                  <span className={css.meta}>
                    <span className={css.tag}>{mine ? `我${entry.origin === 'dsh-send' ? ' · 发进群' : ''}` : sender}</span>
                    <span>{clock(entry.sentAt)}</span>
                    {entry.status === 'pending' ? <span>发送中…</span> : null}
                    {entry.status === 'failed' ? <span>发送失败</span> : null}
                  </span>
                  <span className={`${css.bubble} ${css.im} ${mine ? css.imSelf : ''} ${entry.status === 'failed' ? css.failed : ''}`}>
                    <MessageBody
                      message={messageRecord(entry)}
                      onOpenImage={(src) => setLightbox({ src, kind: 'image' })}
                      onOpenPdf={(src) => setLightbox({ src, kind: 'pdf' })}
                      inject={fileInject}
                    />
                  </span>
                </span>
              </div>
            </div>
          )
        }
        if (item.kind === 'pending') {
          return (
            <div key={`p-${item.pending.writeId}`} className={`${css.row} ${css.rowOther}`}>
              <div className={css.meta}><span className={css.tag}>确认卡</span></div>
              <div className={`${css.bubble} ${css.pending}`}>
                待确认：{item.pending.toolName}（在 GUI 确认卡或群建议卡处理同一 writeId）
              </div>
            </div>
          )
        }
        if (item.hide) return null
        const type = item.event.type
        if (type !== 'user/message' && type !== 'assistant/message') {
          if (type === 'tool/call' || type === 'tool/result') {
            const name = String(asRecord(item.event.data).name ?? asRecord(asRecord(item.event.data).call).name ?? '工具')
            return (
              <div key={`s-${index}`} className={`${css.row} ${css.rowOther}`}>
                <div className={`${css.bubble} ${css.agent}`}>{type === 'tool/call' ? '工具调用' : '工具结果'} · {name}</div>
              </div>
            )
          }
          return null
        }
        const fromAgent = type === 'assistant/message'
        const text = eventText(item.event)
        if (text === '') return null
        return (
          <div key={`s-${index}`} className={`${css.row} ${fromAgent ? css.rowOther : css.rowSelf}`}>
            <div className={css.meta}>
              <span className={css.tag}>{fromAgent ? '助手回复' : '发给助手'}</span>
              <span>{clock(item.time)}</span>
            </div>
            <div className={`${css.bubble} ${css.agent}`}>{text}</div>
          </div>
        )
      })}
      {lightbox !== null && (
        <ImLightbox src={lightbox.src} kind={lightbox.kind} onClose={() => setLightbox(null)} />
      )}
    </div>
  )
}
