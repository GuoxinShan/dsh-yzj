/**
 * Pick an open 推进事项 and type one sentence (docs/spec/ai-advance-design.md §11).
 * User-direct feed — the caller posts `/yzj advance-feed` (no confirm card).
 */
import { useEffect, useState } from 'react'
import type { YzjPanelInject } from './rpc.ts'
import css from './home.module.css'

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

/** One row in the picker list. */
export interface AdvancePickItem {
  readonly advanceId: string
  readonly title: string
  readonly stage: string
  readonly latest: string
}

/** Props: load items via advanceState; submit is the caller's RPC. */
export interface AdvanceFeedPickerProps {
  advanceState: YzjPanelInject['advanceState']
  /** Pre-select this id (「现在反馈」 card). */
  presetId?: string
  defaultSummary: string
  onClose: () => void
  onSubmit: (advanceId: string, summary: string) => Promise<{ ok: true } | { ok: false; error: { message: string } }>
}

/** Modal: choose an item + one sentence, then feed. */
export function AdvanceFeedPicker(props: AdvanceFeedPickerProps) {
  const [items, setItems] = useState<AdvancePickItem[]>([])
  const [ready, setReady] = useState(false)
  const [selected, setSelected] = useState(props.presetId ?? '')
  const [summary, setSummary] = useState(props.defaultSummary)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void props.advanceState().then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      const raw = asArray(asRecord(result.value).items)
      const rows: AdvancePickItem[] = []
      for (const row of raw) {
        const rec = asRecord(row)
        const advanceId = asString(rec.advanceId)
        if (advanceId === '') continue
        rows.push({
          advanceId,
          title: asString(rec.title) || advanceId,
          stage: asString(rec.stage),
          latest: asString(rec.latest),
        })
      }
      setItems(rows)
      setReady(asRecord(result.value).ready === true)
      if (props.presetId !== undefined && rows.some(item => item.advanceId === props.presetId)) {
        setSelected(props.presetId)
      } else if (rows[0] !== undefined && selected === '') {
        setSelected(rows[0].advanceId)
      }
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.advanceState, props.presetId])

  const submit = async (): Promise<void> => {
    const text = summary.trim()
    if (selected === '') {
      setError('请选择一个推进事项')
      return
    }
    if (text === '') {
      setError('写一句要喂进去的话')
      return
    }
    setBusy(true)
    setError('')
    const result = await props.onSubmit(selected, text)
    if (!result.ok) {
      setError(result.error.message)
      setBusy(false)
      return
    }
    props.onClose()
  }

  return (
    <div className={css.modalMask} role="dialog" aria-modal="true" aria-label="喂给推进" data-testid="yzj-advance-feed-picker">
      <div className={css.modal}>
        <h3>喂给推进</h3>
        <p>这句话会作为一条事元挂到选中的事项上，群里其他人看不见。不改阶段。</p>
        {!ready && items.length === 0 && error === '' && <p>推进看板还没有开通。到「推进」页签开通后再喂。</p>}
        {ready && items.length === 0 && error === '' && <p>还没有推进事项。到「推进」页签发起一条。</p>}
        <div className={css.pick} data-testid="yzj-advance-feed-list">
          {items.map(item => (
            <label key={item.advanceId} className={css.candidate}>
              <input
                type="radio"
                name="yzj-advance-feed-item"
                checked={selected === item.advanceId}
                onChange={() => setSelected(item.advanceId)}
              />
              <span>
                <strong>{item.title}</strong>
                <span> {item.advanceId} · {item.stage}</span>
                {item.latest !== '' && <span> · {item.latest.slice(0, 40)}</span>}
              </span>
            </label>
          ))}
        </div>
        <label className={css.pick}>
          一句话
          <textarea
            data-testid="yzj-advance-feed-summary"
            value={summary}
            onChange={event => setSummary(event.target.value)}
            rows={3}
            style={{ width: '100%', marginTop: 6 }}
          />
        </label>
        {error !== '' && <p role="alert">{error}</p>}
        <div className={css.actions}>
          <button type="button" className={css.chromeBtn} onClick={props.onClose}>取消</button>
          <button
            type="button"
            className={`${css.chromeBtn} ${css.chromePrimary}`}
            data-testid="yzj-advance-feed-submit"
            disabled={busy || items.length === 0}
            onClick={() => { void submit() }}
          >
            {busy ? '写入中…' : '喂进去'}
          </button>
        </div>
      </div>
    </div>
  )
}
