/**
 * Bound-session fused VIEW (docs/spec/dsh-home-transcript.md §4).
 * ①② live in the plugin log; ③④ + pending overlay merge by timestamp.
 * Registered as conversation.view「群工作」— not a Session.append event type.
 */
import { useEffect, useState } from 'react'
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
  readonly replyMsgId?: string
  readonly status: string
}

/** Injected RPC + backfill verbs. */
export interface YzjFusedInjected {
  readonly sessionId: string
  homeFused: (sessionId: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  homeBackfill: (sessionId: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
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

function originLabel(entry: FusedImEntry): string {
  if (entry.origin === 'dsh-send') return '发进群'
  if (entry.isSelf) return '我（云之家）'
  return entry.fromName === '' ? '群消息' : entry.fromName
}

/**
 * Bound fused stream. Unbound sessions show a private-chat hint (no ①②).
 */
export function YzjFusedView(props: YzjFusedInjected) {
  const [value, setValue] = useState<FusedViewValue>({ bound: false, items: [] })
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const load = async (backfill: boolean): Promise<void> => {
      if (backfill) await props.homeBackfill(props.sessionId)
      const result = await props.homeFused(props.sessionId)
      if (cancelled) return
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      setError('')
      const raw = asRecord(result.value)
      const items = Array.isArray(raw.items) ? raw.items as FusedViewItem[] : []
      const binding = typeof raw.binding === 'object' && raw.binding !== null
        ? raw.binding as NonNullable<FusedViewValue['binding']>
        : undefined
      setValue(binding === undefined
        ? { bound: raw.bound === true, items }
        : { bound: raw.bound === true, items, binding })
    }
    void load(true)
    const timer = window.setInterval(() => { void load(false) }, 800)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [props.sessionId])

  if (!value.bound) {
    return (
      <div className={css.unbound}>
        这是私密会话：没有群消息流。下方发送只给 Claude。
        要用「丢进群」把可见摘要交到绑定群会话。
      </div>
    )
  }

  return (
    <div className={css.stream} data-testid="yzj-fused-stream">
      <div className={css.hint}>
        群工作时间线：云之家消息与发给 Claude / Claude 回复在同一条流。
        下方发送 = 发给 Claude；「发进群」才进群、不叫模型。
      </div>
      {error !== '' && <div className={css.hint} role="alert">{error}</div>}
      {value.items.map((item, index) => {
        if (item.kind === 'im') {
          const mine = item.entry.isSelf
          return (
            <div
              key={`im-${item.entry.msgId}`}
              className={`${css.row} ${mine ? css.rowSelf : css.rowOther}`}
              data-origin={item.entry.origin}
            >
              <div className={css.meta}>
                <span className={css.tag}>{originLabel(item.entry)}</span>
                <span>{clock(item.entry.sentAt)}</span>
                {item.entry.status === 'pending' ? <span>发送中…</span> : null}
                {item.entry.status === 'failed' ? <span>发送失败</span> : null}
                {item.entry.replyMsgId !== undefined ? <span>回复</span> : null}
              </div>
              <div className={`${css.bubble} ${css.im} ${mine ? css.imSelf : ''} ${item.entry.status === 'failed' ? css.failed : ''}`}>
                {item.entry.content}
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
              <span className={css.tag}>{fromAgent ? 'Claude' : '发给 Claude'}</span>
              <span>{clock(item.time)}</span>
            </div>
            <div className={`${css.bubble} ${css.agent}`}>{text}</div>
          </div>
        )
      })}
    </div>
  )
}
