/**
 * IM inbox occupying sidebar.workspaces: sectioned 助手 / 单聊 / 群 / 订阅通知.
 */
import { useEffect, useState, type FormEvent } from 'react'
import type { YzjPanelInject } from './rpc.ts'
import { getImSelection, setImSelection, subscribeImSelection } from './im-nav.ts'
import { inboxRoomKind, parseRecentGroups, type RecentGroupRoom } from './conv-list.tsx'
import { GroupAvatar } from './im-render.tsx'
import { YzjLoginBanner } from './login-banner.tsx'
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

function previewOf(lastMsg: Record<string, unknown>): string {
  const content = asString(lastMsg.content)
  const msgType = asString(lastMsg.msgType)
  if (msgType === 'file') return '[文件]'
  if (msgType === 'richText') {
    const plain = content.replace(/\s+/g, ' ').trim()
    return plain === '' ? '[图文]' : plain.slice(0, 60)
  }
  return content.replace(/\s+/g, ' ').slice(0, 60)
}

export function YzjInbox(props: { panel: YzjPanelInject }) {
  const [query, setQuery] = useState('')
  const [assistants, setAssistants] = useState<AssistantRow[]>([{ id: 'default', name: '助手' }])
  const [rooms, setRooms] = useState<RecentGroupRoom[]>([])
  const [sel, setSel] = useState(getImSelection)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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
        setRooms(parseRecentGroups(recent.value).rooms)
      }
    }
    void load()
    const timer = window.setInterval(() => { void load() }, 8_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [props.panel])

  const createAssistant = async (event?: FormEvent): Promise<void> => {
    event?.preventDefault()
    const trimmed = newName.trim()
    if (trimmed === '' || busy) return
    setBusy(true)
    setError('')
    const result = await props.panel.assistantsCreate?.(trimmed)
    setBusy(false)
    if (result === undefined || !result.ok) {
      setError(result?.error.message ?? '新建失败')
      return
    }
    const created = asRecord(asRecord(result.value).assistant)
    const id = asString(created.id)
    const name = asString(created.name) || trimmed
    if (id !== '') {
      setAssistants(current => current.some(row => row.id === id) ? current : [...current, { id, name }])
      setImSelection({ kind: 'assistant', assistantId: id })
    }
    setNewName('')
    setCreating(false)
    const listed = await props.panel.assistantsList?.()
    if (listed?.ok) {
      const rows = Array.isArray(asRecord(listed.value).assistants)
        ? asRecord(listed.value).assistants as unknown[]
        : []
      const next = rows.flatMap((item) => {
        const row = asRecord(item)
        const rowId = asString(row.id)
        if (rowId === '') return []
        return [{ id: rowId, name: asString(row.name) || '助手' }]
      })
      if (next.length > 0) setAssistants(next)
    }
  }

  const q = query.trim().toLowerCase()
  const shownAssistants = q === '' ? assistants : assistants.filter(row => row.name.toLowerCase().includes(q))
  const shownRooms = q === '' ? rooms : rooms.filter(row => {
    const preview = previewOf(row.lastMsg)
    return row.groupName.toLowerCase().includes(q) || preview.toLowerCase().includes(q)
  })
  const dms = shownRooms.filter(row => inboxRoomKind(row) === 'dm')
  const groups = shownRooms.filter(row => inboxRoomKind(row) === 'group')
  const subs = shownRooms.filter(row => inboxRoomKind(row) === 'subscription')
  const firstRun = assistants.length <= 1 && !creating

  const assistantOn = (id: string): boolean =>
    sel.kind === 'assistant' && sel.assistantId === id
    || sel.kind === 'peek' && sel.assistantId === id

  return (
    <div className={css.inbox} data-testid="yzj-inbox">
      {props.panel.authStatus !== undefined && props.panel.authLogin !== undefined && (
        <div className={css.login}>
          <YzjLoginBanner authStatus={props.panel.authStatus} authLogin={props.panel.authLogin} compact />
        </div>
      )}
      <div className={css.inboxBar}>
        <label className={css.search}>
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            placeholder="搜索"
            aria-label="搜索"
            onChange={event => setQuery(event.target.value)}
          />
        </label>
        <button
          type="button"
          className={css.addBtn}
          data-testid="yzj-inbox-create"
          aria-label="新建助手"
          title="新建助手"
          onClick={() => { setCreating(true); setError('') }}
        >
          +
        </button>
      </div>
      {creating && (
        <form className={css.createBox} onSubmit={event => { void createAssistant(event) }}>
          <input
            value={newName}
            placeholder="助手名称"
            aria-label="助手名称"
            data-testid="yzj-inbox-create-name"
            autoFocus
            onChange={event => setNewName(event.target.value)}
          />
          <button type="submit" data-testid="yzj-inbox-create-submit" disabled={busy || newName.trim() === ''}>
            创建
          </button>
        </form>
      )}
      {error !== '' && <p className={css.alert} role="alert">{error}</p>}
      <div className={css.list}>
        <section data-testid="yzj-inbox-section-assistants">
          <div className={css.sectionTitle}>助手</div>
          {shownAssistants.map(row => (
            <button
              key={`a-${row.id}`}
              type="button"
              className={assistantOn(row.id) ? css.rowOn : css.row}
              data-testid={`yzj-inbox-assistant-${row.id}`}
              onClick={() => setImSelection({ kind: 'assistant', assistantId: row.id })}
            >
              <span className={css.inboxAvatar}>
                <span className={css.glyph}>{row.name.slice(0, 1)}</span>
              </span>
              <span className={css.meta}>
                <span className={css.name}>{row.name}</span>
                <span className={css.preview}>专属助手</span>
              </span>
            </button>
          ))}
          {firstRun && (
            <button
              type="button"
              className={css.createHint}
              data-testid="yzj-inbox-create-hint"
              onClick={() => { setCreating(true); setError('') }}
            >
              ＋ 新建助手
            </button>
          )}
        </section>
        <RoomSection testid="yzj-inbox-section-dm" title="单聊" rows={dms} sel={sel} />
        <RoomSection testid="yzj-inbox-section-group" title="群" rows={groups} sel={sel} />
        <RoomSection testid="yzj-inbox-section-sub" title="订阅通知" rows={subs} sel={sel} />
      </div>
    </div>
  )
}

function RoomSection(props: {
  testid: string
  title: string
  rows: readonly RecentGroupRoom[]
  sel: ReturnType<typeof getImSelection>
}) {
  if (props.rows.length === 0) return null
  return (
    <section data-testid={props.testid}>
      <div className={css.sectionTitle}>{props.title}</div>
      {props.rows.map(row => {
        const on = props.sel.kind === 'group' && props.sel.groupId === row.groupId
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
            <span className={css.inboxAvatar}>
              <GroupAvatar url={row.headerUrl ?? ''} name={row.groupName} />
            </span>
            <span className={css.meta}>
              <span className={css.name}>{row.groupName}</span>
              <span className={css.preview}>{previewOf(row.lastMsg)}</span>
            </span>
          </button>
        )
      })}
    </section>
  )
}
