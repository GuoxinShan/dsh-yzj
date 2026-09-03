/**
 * IM inbox occupying sidebar.workspaces: pinned assistants + Yunzhijia recent.
 */
import { useEffect, useState } from 'react'
import type { YzjPanelInject } from './rpc.ts'
import { getImSelection, setImSelection, subscribeImSelection } from './im-nav.ts'
import { YzjLoginBanner } from './login-banner.tsx'
import { cliRows } from '../cli-payload.ts'
import css from './shell.module.css'

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

interface AssistantRow {
  readonly id: string
  readonly name: string
}

interface GroupRow {
  readonly groupId: string
  readonly groupName: string
  readonly preview: string
  readonly kind: 'group' | 'dm'
}

export function YzjInbox(props: { panel: YzjPanelInject }) {
  const [query, setQuery] = useState('')
  const [assistants, setAssistants] = useState<AssistantRow[]>([{ id: 'default', name: '助手' }])
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [sel, setSel] = useState(getImSelection)

  useEffect(() => subscribeImSelection(() => { setSel(getImSelection()) }), [])

  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      const listed = await props.panel.assistantsList?.()
      if (!cancelled && listed?.ok) {
        const rows = Array.isArray(asRecord(listed.value).assistants)
          ? asRecord(listed.value).assistants as unknown[]
          : []
        const next = rows.flatMap((item) => {
          const row = asRecord(item)
          const id = asString(row.id)
          const name = asString(row.name)
          if (id === '') return []
          return [{ id, name: name === '' ? '助手' : name }]
        })
        if (next.length > 0) setAssistants(next)
      }
      const recent = await props.panel.fetchGroups(20, 1)
      if (!cancelled && recent.ok) {
        setGroups(cliRows(recent.value).flatMap((item) => {
          const row = asRecord(item)
          const groupId = asString(row.groupId)
          if (groupId === '') return []
          const last = asRecord(row.lastMsg)
          return [{
            groupId,
            groupName: asString(row.groupName) || groupId,
            preview: asString(last.content) || asString(row.lastMsgContent),
            kind: groupId.startsWith('BOT-') ? 'dm' as const : 'group' as const,
          }]
        }))
      }
    }
    void load()
    const timer = window.setInterval(() => { void load() }, 8_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [props.panel])

  const q = query.trim().toLowerCase()
  const shownAssistants = q === '' ? assistants : assistants.filter(row => row.name.toLowerCase().includes(q))
  const shownGroups = q === '' ? groups : groups.filter(row => row.groupName.toLowerCase().includes(q) || row.preview.toLowerCase().includes(q))

  return (
    <div className={css.inbox} data-testid="yzj-inbox">
      {props.panel.authStatus !== undefined && props.panel.authLogin !== undefined && (
        <div className={css.login}>
          <YzjLoginBanner authStatus={props.panel.authStatus} authLogin={props.panel.authLogin} compact />
        </div>
      )}
      <label className={css.search}>
        <span aria-hidden="true">⌕</span>
        <input
          value={query}
          placeholder="搜索"
          aria-label="搜索"
          onChange={event => setQuery(event.target.value)}
        />
      </label>
      <div className={css.list}>
        {shownAssistants.map(row => {
          const on = sel.kind === 'assistant' && sel.assistantId === row.id
            || sel.kind === 'peek' && sel.assistantId === row.id
          return (
            <button
              key={`a-${row.id}`}
              type="button"
              className={on ? css.rowOn : css.row}
              data-testid={`yzj-inbox-assistant-${row.id}`}
              onClick={() => setImSelection({ kind: 'assistant', assistantId: row.id })}
            >
              <span className={css.glyph}>助</span>
              <span className={css.meta}>
                <span className={css.name}>{row.name}</span>
                <span className={css.preview}>专属助手</span>
              </span>
            </button>
          )
        })}
        {shownGroups.map(row => {
          const on = sel.kind === 'group' && sel.groupId === row.groupId
          return (
            <button
              key={row.groupId}
              type="button"
              className={on ? css.rowOn : css.row}
              data-testid={`yzj-inbox-group-${row.groupId}`}
              onClick={() => setImSelection({
                kind: 'group',
                groupId: row.groupId,
                ...(row.groupName === '' ? {} : { groupName: row.groupName }),
              })}
            >
              <span className={`${css.glyph} ${css.glyphGroup}`}>{row.groupName.slice(0, 1)}</span>
              <span className={css.meta}>
                <span className={css.name}>{row.groupName}</span>
                <span className={css.preview}>{row.preview}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
