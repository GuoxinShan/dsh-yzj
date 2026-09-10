/**
 * Assistant DM: Grok-Bot-simple bubbles + confirm cards + muted 查看过程.
 * Warm-starts from im-view-cache so 消息↔会话 / selection remounts do not
 * flash an empty stream.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { YzjPanelInject } from './rpc.ts'
import type { YzjWriteRecord } from '../write-gate.ts'
import { YzjImConfirmCard } from './im-confirm.tsx'
import type { WriteCardInjected } from './write-card.tsx'
import { getAssistantDmSnapshot, putAssistantDmSnapshot } from './im-view-cache.ts'
import { openAssistantSession } from './open-assistant-session.ts'
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

function parseBubbles(value: unknown): Bubble[] {
  return asArray(value).flatMap((item) => {
    const row = asRecord(item)
    const id = typeof row.id === 'string' ? row.id : ''
    const role = row.role === 'user' || row.role === 'assistant' ? row.role : 'assistant'
    const text = typeof row.text === 'string' ? row.text : ''
    if (id === '') return []
    return [{ id, role, text }]
  })
}

function parseWrites(value: unknown): YzjWriteRecord[] {
  return asArray(value).filter((item): item is YzjWriteRecord => {
    const row = asRecord(item)
    return typeof row.writeId === 'string' && row.status === 'pending'
  })
}

export function YzjAssistantDm(props: {
  assistantId: string
  panel: YzjPanelInject
  writeInject: WriteCardInjected
}) {
  const seed = getAssistantDmSnapshot(props.assistantId)
  const [name, setName] = useState(() => seed?.name ?? '助手')
  const [bubbles, setBubbles] = useState<Bubble[]>(() => seed ? [...seed.bubbles] : [])
  const [processing, setProcessing] = useState(() => seed?.processing === true)
  const [writes, setWrites] = useState<YzjWriteRecord[]>(() => seed ? [...seed.writes] : [])
  const [draft, setDraft] = useState(() => seed?.draft ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const bottom = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const hit = getAssistantDmSnapshot(props.assistantId)
    if (hit !== undefined) {
      setName(hit.name)
      setBubbles([...hit.bubbles])
      setProcessing(hit.processing)
      setWrites([...hit.writes])
      setDraft(hit.draft)
    } else {
      setName('助手')
      setBubbles([])
      setProcessing(false)
      setWrites([])
      setDraft('')
    }
    setError('')
  }, [props.assistantId])

  useEffect(() => {
    putAssistantDmSnapshot(props.assistantId, {
      name,
      bubbles,
      processing,
      writes,
      draft,
    })
  }, [props.assistantId, name, bubbles, processing, writes, draft])

  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      const result = await props.panel.assistantProjection?.({ assistantId: props.assistantId })
      if (cancelled || result === undefined || !result.ok) return
      const rec = asRecord(result.value)
      const assistant = asRecord(rec.assistant)
      if (typeof assistant.name === 'string' && assistant.name !== '') setName(assistant.name)
      setProcessing(rec.processing === true)
      setBubbles(parseBubbles(rec.bubbles))
      setWrites(parseWrites(rec.writes))
    }
    void load()
    const timer = window.setInterval(() => { void load() }, 800)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [props.assistantId, props.panel])

  useEffect(() => {
    const node = bottom.current
    if (node !== null && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ block: 'end' })
    }
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
      setDraft(text)
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    void send()
  }

  return (
    <div className={css.shell} data-testid="yzj-assistant-dm">
      <header className={css.header} data-yzj-im-header="">
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
            onClick={() => { void openAssistantSession(props.panel, props.assistantId) }}
          >
            查看过程
          </button>
        )}
        <div ref={bottom} />
      </div>
      {error !== '' && <p className={css.alert} role="alert">{error}</p>}
      <div className={css.composer} data-yzj-im-composer="">
        <div className={css.composerCard}>
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
