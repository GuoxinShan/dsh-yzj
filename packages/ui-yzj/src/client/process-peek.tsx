/**
 * 查看过程: hidden-session tool digest. Not the IM bubble stream.
 */
import { useEffect, useState } from 'react'
import type { YzjPanelInject } from './rpc.ts'
import { setImSelection } from './im-nav.ts'
import css from './shell.module.css'

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function YzjProcessPeek(props: {
  assistantId: string
  panel: YzjPanelInject
  groupId?: string
  groupName?: string
}) {
  const [rows, setRows] = useState<{ type: string; summary: string }[]>([])

  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      const result = await props.panel.assistantProcess?.(props.assistantId)
      if (cancelled || result === undefined || !result.ok) return
      setRows(asArray(asRecord(result.value).events).flatMap((item) => {
        const row = asRecord(item)
        const summary = asString(row.summary)
        if (summary === '') return []
        return [{ type: asString(row.type) || 'event', summary }]
      }))
    }
    void load()
    const timer = window.setInterval(() => { void load() }, 1_200)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [props.assistantId, props.panel])

  return (
    <div className={css.shell} data-testid="yzj-process-peek">
      <header className={css.header}>
        <button
          type="button"
          className={css.back}
          data-testid="yzj-process-back"
          onClick={() => {
            if (props.groupId !== undefined && props.groupId !== '') {
              setImSelection({
                kind: 'group',
                groupId: props.groupId,
                ...(props.groupName === undefined || props.groupName === '' ? {} : { groupName: props.groupName }),
              })
              return
            }
            setImSelection({ kind: 'assistant', assistantId: props.assistantId })
          }}
        >
          ← 返回
        </button>
        <div>
          <div className={css.headerTitle}>查看过程</div>
          <div className={css.headerSub}>真实 session 的工具摘要 · 不会出现在 IM 气泡里</div>
        </div>
      </header>
      <div className={css.processList}>
        {rows.length === 0 && <div className={css.processing}>还没有工具过程。</div>}
        {rows.map((row, index) => (
          <div key={`${row.type}-${index}`} className={css.processRow}>
            {row.type} · {row.summary}
          </div>
        ))}
      </div>
    </div>
  )
}
