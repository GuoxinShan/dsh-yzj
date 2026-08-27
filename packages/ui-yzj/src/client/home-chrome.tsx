/**
 * Composer chrome in `conversation.input.dock`.
 * Group room: dock 发进群 is retired (R2) — the timeline column owns 发进群.
 * Topic leftover sessions keep 「回群聊」. D8 「丢进群」 is retired (决策 55).
 */
import { useEffect, useRef, useState } from 'react'
import { peekImSeat, rememberImSeat } from './im-seat.ts'
import { setWorkbenchDomain, useWorkbenchDomain } from './workbench-domain.ts'
import { openWorkbench } from './workbench-overlay.ts'
import { yzjViewKindFromSessionId } from './view-ring.ts'
import css from './home.module.css'

/** Injected verbs for the dock chrome. */
export interface YzjHomeChromeInjected {
  readonly sessionId: string
  readDraft: () => string
  clearDraft: () => void
  homeBinding: (sessionId: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  homeSend: (sessionId: string, content: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  homeOpen?: (groupId: string, title?: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  focusBoundSession?: (sessionId: string) => void
  /** Native composer submit; intercepted on group rooms so 发送 = 发进群. */
  inputActions?: { submit: () => void }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

/**
 * Room chrome: native send is intercepted to 发进群 (safety net if the
 * official bar is still up). Leftover topic sessions paint 「回群聊」 on
 * this dock. Unbound private chats paint nothing (决策 55).
 */
export function YzjHomeChrome(props: YzjHomeChromeInjected) {
  const domain = useWorkbenchDomain()
  const [kind, setKind] = useState<'room' | 'topic' | 'unbound'>(() => yzjViewKindFromSessionId(props.sessionId))
  const [roomGroupId, setRoomGroupId] = useState('')
  const [roomKind, setRoomKind] = useState<'group' | 'dm' | ''>('')
  const [summary, setSummary] = useState('')
  const sendRef = useRef<() => Promise<void>>(async () => {})

  useEffect(() => {
    const next = yzjViewKindFromSessionId(props.sessionId)
    setKind(next)
    if (next !== 'topic') {
      setRoomGroupId('')
      setRoomKind('')
      setSummary('')
      return
    }
    let cancelled = false
    const tick = async (): Promise<void> => {
      const result = await props.homeBinding(props.sessionId)
      if (cancelled || !result.ok) return
      const raw = asRecord(result.value)
      const binding = asRecord(raw.binding)
      const host = typeof binding.dshSessionId === 'string' ? binding.dshSessionId : ''
      const groupId = typeof binding.yzjConversationId === 'string' ? binding.yzjConversationId : ''
      setRoomGroupId(groupId)
      setRoomKind(binding.yzjKind === 'dm' ? 'dm' : binding.yzjKind === 'group' ? 'group' : '')
      rememberImSeat({ groupId, sessionId: host })
      const topic = asRecord(raw.topic)
      const origin = typeof topic.originText === 'string' ? topic.originText : ''
      const title = typeof topic.title === 'string' ? topic.title : ''
      setSummary(origin !== '' ? origin : title)
    }
    void tick()
    const timer = window.setInterval(() => { void tick() }, 1500)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.sessionId])

  const sendToGroup = async (): Promise<void> => {
    const draft = props.readDraft().trim()
    if (draft === '') return
    const result = await props.homeSend(props.sessionId, draft)
    if (!result.ok) return
    props.clearDraft()
  }
  sendRef.current = sendToGroup

  useEffect(() => {
    if (kind !== 'room') return
    const actions = props.inputActions
    const original = actions?.submit
    if (actions !== undefined && original !== undefined) {
      actions.submit = () => { void sendRef.current() }
    }
    return () => {
      if (actions !== undefined && original !== undefined) actions.submit = original
    }
  }, [kind, props.inputActions])

  if (kind !== 'topic' || domain !== 'im') return null

  const label = roomKind === 'dm' ? '回私聊' : '回群聊'
  return (
    <div className={css.topicDock} data-testid="yzj-home-chrome">
      <button
        type="button"
        className={css.topicDockBtn}
        data-testid="yzj-topic-anchor"
        title={summary === '' ? label : summary}
        aria-label={summary === '' ? label : `${label}：${summary}`}
        onClick={() => {
          const groupId = roomGroupId !== '' ? roomGroupId : (peekImSeat()?.groupId ?? '')
          if (groupId !== '') rememberImSeat({ groupId, sessionId: peekImSeat()?.sessionId ?? '' })
          setWorkbenchDomain('im')
          openWorkbench()
        }}
      >
        <span className={css.topicDockLabel}>{label}</span>
        {summary !== '' && <span className={css.topicDockSummary}>{summary}</span>}
      </button>
    </div>
  )
}
