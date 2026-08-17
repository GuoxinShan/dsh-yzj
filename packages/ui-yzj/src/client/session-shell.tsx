/**
 * Session-header action that keeps the tab ring honest for v2.0 views.
 * Always mounted (header.actions), unlike the dock which a composer
 * takeover hides on group rooms.
 */
import { useEffect, useState } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { restoreYzjViewRing, syncYzjViewRing, type YzjViewKind } from './view-ring.ts'
import css from './home.module.css'

/** Injected binding lookup for the header shell. */
export interface YzjSessionShellInjected {
  readonly sessionId: string
  homeBinding: (sessionId: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  focusBoundSession?: (sessionId: string) => void
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

/**
 * Pill + tab-ring sync. Renders 「群房间」 on room sessions so the header
 * still names the view after the tablist is hidden.
 */
export function YzjSessionShell(props: PropsRuntime<'conversation.session.header.actions'> & YzjSessionShellInjected) {
  const [kind, setKind] = useState<YzjViewKind>('unbound')
  const [roomSessionId, setRoomSessionId] = useState('')
  const [topicTitle, setTopicTitle] = useState('')
  const [originText, setOriginText] = useState('')

  useEffect(() => {
    let cancelled = false
    const tick = async (): Promise<void> => {
      const result = await props.homeBinding(props.sessionId)
      if (cancelled) return
      if (!result.ok) {
        setKind('unbound')
        return
      }
      const raw = asRecord(result.value)
      const next: YzjViewKind = raw.kind === 'room' || raw.kind === 'topic' ? raw.kind : 'unbound'
      setKind(next)
      const binding = asRecord(raw.binding)
      const host = typeof binding.dshSessionId === 'string' ? binding.dshSessionId : ''
      setRoomSessionId(host)
      const topic = asRecord(raw.topic)
      setTopicTitle(typeof topic.title === 'string' ? topic.title : '')
      setOriginText(typeof topic.originText === 'string' ? topic.originText : '')
    }
    void tick()
    const timer = window.setInterval(() => { void tick() }, 1500)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      restoreYzjViewRing()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.sessionId])

  useEffect(() => {
    syncYzjViewRing(kind)
  }, [kind, props.sessionId])

  if (kind === 'topic') {
    const summary = originText !== '' ? originText : topicTitle
    return (
      <button
        type="button"
        className={css.anchorCard}
        data-testid="yzj-topic-anchor"
        onClick={() => {
          if (roomSessionId !== '') props.focusBoundSession?.(roomSessionId)
        }}
      >
        <span>群消息锚点{summary === '' ? '' : `：${summary}`}</span>
        <span className={css.anchorHint}>点这里回群房间</span>
      </button>
    )
  }
  if (kind !== 'room') return null
  return (
    <span className={css.kindPill} data-testid="yzj-room-pill">群房间</span>
  )
}
