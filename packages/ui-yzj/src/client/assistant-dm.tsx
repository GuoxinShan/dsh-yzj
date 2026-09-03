/**
 * Assistant DM: Grok-Bot-simple bubbles + confirm cards + muted 查看过程.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { YzjPanelInject } from './rpc.ts'
import type { YzjWriteRecord } from '../write-gate.ts'
import { YzjImConfirmCard } from './im-confirm.tsx'
import type { WriteCardInjected } from './write-card.tsx'
import { setImSelection } from './im-nav.ts'
import css from './shell.module.css'

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

interface Bubble {
  readonly id: string
  readonly role: 'user' | 'assistant'
  readonly text: string
}

export function YzjAssistantDm(props: {
  assistantId: string
  panel: YzjPanelInject
  writeInject: WriteCardInjected
  onOpenPane?: (kind: 'calendar' | 'docs') => void
}) {
  const [name, setName] = useState('助手')
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [processing, setProcessing] = useState(false)
  const [writes, setWrites] = useState<YzjWriteRecord[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [plus, setPlus] = useState(false)
  const bottom = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      const result = await props.panel.assistantProjection?.({ assistantId: props.assistantId })
      if (cancelled || result === undefined || !result.ok) return
      const rec = asRecord(result.value)
      const assistant = asRecord(rec.assistant)
      if (typeof assistant.name === 'string' && assistant.name !== '') setName(assistant.name)
      setProcessing(rec.processing === true)
      setBubbles(asArray(rec.bubbles).flatMap((item) => {
        const row = asRecord(item)
        const id = typeof row.id === 'string' ? row.id : ''
        const role = row.role === 'user' || row.role === 'assistant' ? row.role : 'assistant'
        const text = typeof row.text === 'string' ? row.text : ''
        if (id === '') return []
        return [{ id, role, text }]
      }))
      setWrites(asArray(rec.writes).filter((item): item is YzjWriteRecord => {
        const row = asRecord(item)
        return typeof row.writeId === 'string' && row.status === 'pending'
      }))
    }
    void load()
    const timer = window.setInterval(() => { void load() }, 800)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [props.assistantId, props.panel])

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [bubbles.length, processing, writes.length])

  const send = async (): Promise<void> => {
    const text = draft.trim()
    if (text === '' || busy) return
    setBusy(true)
    setError('')
    setDraft('')
    const result = await props.panel.assistantAsk?.(props.assistantId, text)
    setBusy(false)
    if (result === undefined || !result.ok) {
      setError(result?.error.message ?? '发送失败')
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    void send()
  }

  return (
    <div className={css.shell} data-testid="yzj-assistant-dm">
      <header className={css.header}>
        <div>
          <div className={css.headerTitle}>{name}</div>
          <div className={css.headerSub}>专属助手 · 单聊</div>
        </div>
      </header>
      <div className={css.stream}>
        {bubbles.map(bubble => (
          <div
            key={bubble.id}
            className={bubble.role === 'user' ? css.bubbleUser : css.bubbleAssistant}
            data-testid={bubble.role === 'user' ? 'yzj-dm-user' : 'yzj-dm-assistant'}
          >
            {bubble.text}
          </div>
        ))}
        {writes.map(record => (
          <YzjImConfirmCard key={record.writeId} record={record} inject={props.writeInject} />
        ))}
        {processing && <div className={css.processing} data-testid="yzj-dm-processing">助手正在处理…</div>}
        {(bubbles.length > 0 || processing) && (
          <button
            type="button"
            className={css.processLink}
            data-testid="yzj-view-process"
            onClick={() => setImSelection({ kind: 'peek', assistantId: props.assistantId })}
          >
            查看过程
          </button>
        )}
        <div ref={bottom} />
      </div>
      {error !== '' && <p className={css.alert} role="alert">{error}</p>}
      <div className={css.composer} style={{ position: 'relative' }}>
        {plus && (
          <div className={css.menu} data-testid="yzj-plus-menu">
            <button type="button" onClick={() => { setPlus(false); props.onOpenPane?.('calendar') }}>日程</button>
            <button type="button" onClick={() => { setPlus(false); props.onOpenPane?.('docs') }}>知识库</button>
          </div>
        )}
        <div className={css.composerCard}>
          <button type="button" className={css.plus} aria-label="更多" onClick={() => setPlus(open => !open)}>+</button>
          <textarea
            className={css.composerInput}
            value={draft}
            placeholder="发给助手"
            rows={1}
            aria-label="发给助手"
            onChange={event => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
          />
          <button
            type="button"
            className={css.send}
            data-testid="yzj-dm-send"
            aria-label="发给助手"
            disabled={busy || draft.trim() === ''}
            onClick={() => { void send() }}
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  )
}
