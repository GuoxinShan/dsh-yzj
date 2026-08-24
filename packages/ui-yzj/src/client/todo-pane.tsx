/**
 * The 待办 tab: swimlane board over the six-state machine
 * (todo-swimlane-agent.md §2.4): 待我决定 | 可认领 | 进行中 | 待我验收 |
 * 已完成，已终止收进折叠区（与推进看板「已结束」同款）。卡片操作即状态动词——
 * 批准/验收/打回/中止/编辑都是用户直写（D9 无确认卡；面板即用户本人的手）；
 * agent 走 claim 工具族（yzj_todo_claim/submit_review/release_claim，静默）。
 * #tag chips aggregate anything; quick-create parses `#tag` + dates straight
 * from the input. Data arrives through the /yzj RPC face only.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { BakedActions } from '@deepseek-ai/dsh-client-ui-slots'
import type { YzjPanelActions, YzjPanelState } from './stores.ts'

import css from './todo-pane.module.css'

type UnknownRecord = Record<string, unknown>

function asRecord(value: unknown): UnknownRecord {
  return typeof value === 'object' && value !== null ? value as UnknownRecord : {}
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asTags(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

/** Local today as `YYYY/MM/DD` for bucket math. */
function todayStr(): string {
  const now = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())}`
}

/** Parse a quick-create input: `#tag` tokens and date fragments become
 * structured fields; the remainder is the title. Supported dates: 今天/明天/
 * 后天, 8/20, 08-20, 2026-08-20, 8月20日. */
export function parseQuickCreate(input: string): { title: string; tags: string[]; ddl: string } {
  const pad = (n: number): string => String(n).padStart(2, '0')
  const fmt = (y: number, m: number, d: number): string => `${y}/${pad(m)}/${pad(d)}`
  const now = new Date()
  let ddl = ''
  let rest = ` ${input} `

  // Relative day words.
  for (const [word, offset] of [['今天', 0], ['明天', 1], ['后天', 2]] as const) {
    if (rest.includes(word)) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
      ddl = fmt(date.getFullYear(), date.getMonth() + 1, date.getDate())
      rest = rest.split(word).join(' ')
      break
    }
  }
  if (ddl === '') {
    // 8月20日 / 8月20号
    const cn = rest.match(/(\d{1,2})月(\d{1,2})[日号]/)
    if (cn !== null) {
      ddl = fmt(now.getFullYear(), Number(cn[1]), Number(cn[2]))
      rest = rest.replace(cn[0], ' ')
    }
  }
  if (ddl === '') {
    // 2026-08-20 / 2026/8/20 / 08-20 / 8/20 (standalone tokens only)
    const full = rest.match(/(?:^|\s)(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?=\s|$)/)
    if (full !== null) {
      ddl = fmt(Number(full[1]), Number(full[2]), Number(full[3]))
      rest = rest.replace(full[0], ' ')
    } else {
      const md = rest.match(/(?:^|\s)(\d{1,2})[-/](\d{1,2})(?=\s|$)/)
      if (md !== null) {
        ddl = fmt(now.getFullYear(), Number(md[1]), Number(md[2]))
        rest = rest.replace(md[0], ' ')
      }
    }
  }

  // #tag tokens.
  const tags: string[] = []
  rest = rest.replace(/#[^\s#，,、]+/g, (token) => {
    tags.push(token.slice(1))
    return ' '
  })

  const title = rest.replace(/\s+/g, ' ').trim()
  return { title, tags: [...new Set(tags)], ddl }
}

/** One swimlane lane of the board. */
interface Lane {
  key: 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done'
  label: string
  tone: 'danger' | 'muted' | 'info' | 'warn' | 'done'
  hint: string
  todos: UnknownRecord[]
}

/** Client-side status normalization mirrors the host (S5: legacy pending → todo). */
function laneStatusOf(todo: UnknownRecord): string {
  const status = asString(todo.status)
  return status === 'pending' ? 'todo' : status
}

/** Swimlane lanes (todo-swimlane-agent §2.4): five fixed lanes in state-machine
 *  order; cancelled folds into the 已终止 zone below the board (no lane). */
export function lanesOf(todos: UnknownRecord[]): { lanes: Lane[]; cancelled: UnknownRecord[] } {
  const byDdl = (a: UnknownRecord, b: UnknownRecord): number => {
    const da = asString(a.ddl)
    const db = asString(b.ddl)
    if (da === '' && db === '') return asString(a.todoId) < asString(b.todoId) ? -1 : 1
    if (da === '') return 1
    if (db === '') return -1
    return da === db ? (asString(a.todoId) < asString(b.todoId) ? -1 : 1) : (da < db ? -1 : 1)
  }
  const pick = (status: string): UnknownRecord[] => todos.filter(todo => laneStatusOf(todo) === status).sort(byDdl)
  const lanes: Lane[] = [
    { key: 'backlog', label: '待我决定', tone: 'danger', hint: '批准后 agent 才能认领', todos: pick('backlog') },
    { key: 'todo', label: '可认领', tone: 'muted', hint: '对 agent 说「把能做的做了」', todos: pick('todo') },
    { key: 'in_progress', label: '进行中', tone: 'info', hint: '', todos: pick('in_progress') },
    { key: 'in_review', label: '待我验收', tone: 'warn', hint: '验收才算完', todos: pick('in_review') },
    { key: 'done', label: '已完成', tone: 'done', hint: '', todos: pick('done').reverse().slice(0, 10) },
  ]
  const cancelled = todos.filter(todo => laneStatusOf(todo) === 'cancelled')
  return { lanes, cancelled }
}

/** Props the panel passes down; data + verbs only, no ctx. */
export interface TodoPaneProps {
  todos: unknown[]
  ready: boolean
  libraryLink: string
  tagFilter: string
  loading: boolean
  /** Active library identity for the switcher label (cheap, always present). */
  libName: string
  libScope: string
  /** Active library docId (for the switcher's radio state). */
  activeDocId: string
  /** Discovered libraries from todo-state (may be absent on older hosts). */
  libraries?: unknown[]
  actions: BakedActions<YzjPanelState, YzjPanelActions>
  todoState: () => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  ensureTodo: () => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  createTodo: (input: { title: string; ddl?: string; priority?: string; tags?: string[] }) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  toggleTodo: (todoId: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  /** Swimlane human verbs (todo-swimlane-agent §3; user-direct writes, no card). */
  approveTodo: (todoId: string, note?: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  acceptTodo: (todoId: string, note?: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  returnTodo: (todoId: string, note?: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  cancelTodo: (todoId: string, note?: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  reopenTodo: (todoId: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  /** Edit task details (S7): 标题/描述（agent 执行的提示词本体）/DDL/负责人。 */
  editTodo: (todoId: string, patch: { title?: string; description?: string; ddl?: string; assignee?: string }) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  todoLibraries: () => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  selectTodoLibrary: (docId: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  ensureTeamTodo: (workspace: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
}

/** Persisted library selection (docId) so the team library survives reloads
 *  without hand-editing host config. */
const LIB_PREF_KEY = 'dsh.yzj.todo.lib'

function readLibPref(): string {
  try { return window.localStorage.getItem(LIB_PREF_KEY) ?? '' } catch { return '' }
}

function writeLibPref(docId: string): void {
  try {
    if (docId === '') window.localStorage.removeItem(LIB_PREF_KEY)
    else window.localStorage.setItem(LIB_PREF_KEY, docId)
  } catch { /* storage unavailable — selection stays in-memory */ }
}

export function TodoPane(props: TodoPaneProps) {
  const [draft, setDraft] = useState('')
  const [creating, setCreating] = useState(false)
  const [ensuring, setEnsuring] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [notice, setNotice] = useState('')
  const [expanded, setExpanded] = useState('')
  /** 打回/验收的备注内联表单（验收可空，打回建议写评语）。 */
  const [noteFor, setNoteFor] = useState<{ todoId: string; verb: 'accept' | 'return' } | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  /** 行内编辑（S7）：标题 + 描述（提示词本体）+ DDL + 负责人。 */
  const [editFor, setEditFor] = useState('')
  const [editDraft, setEditDraft] = useState({ title: '', description: '', ddl: '', assignee: '' })
  const [showCancelled, setShowCancelled] = useState(false)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [teamPick, setTeamPick] = useState(false)
  const [teamWorkspaces, setTeamWorkspaces] = useState<{ id: string; name: string; docCount: number; permissionLevel: number }[]>([])
  const [switching, setSwitching] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const switcherRef = useRef<HTMLDivElement | null>(null)

  // Restore the persisted library selection on first mount (before the
  // first state render takes over): the host override is per-process, the
  // browser preference survives reloads.
  useEffect(() => {
    const pref = readLibPref()
    if (pref === '' || pref === props.activeDocId) return
    void props.selectTodoLibrary(pref).then((result) => {
      if (!result.ok) writeLibPref('')
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load the switcher's library list once per mount (host caches ~5min; the
  // scan is slow so it never blocks the todo list itself).
  useEffect(() => {
    void props.todoLibraries().then((result) => {
      if (!result.ok) return
      const value = asRecord(result.value)
      props.actions.setTodoLibraries(
        Array.isArray(value.libraries) ? value.libraries : [],
        typeof value.activeDocId === 'string' ? value.activeDocId : props.activeDocId,
      )
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Close the switcher on outside clicks.
  useEffect(() => {
    if (!switcherOpen) return
    const onDown = (event: MouseEvent): void => {
      if (switcherRef.current !== null && !switcherRef.current.contains(event.target as Node)) {
        setSwitcherOpen(false)
        setTeamPick(false)
      }
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [switcherOpen])

  // Defensive: persisted stores from older builds may carry `todos` as
  // anything but an array — never crash the pane on stale state.
  const todos = useMemo(() => (Array.isArray(props.todos) ? props.todos : []).map(asRecord), [props.todos])
  const parsed = useMemo(() => parseQuickCreate(draft), [draft])
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const todo of todos) {
      for (const tag of asTags(todo.tags)) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [todos])

  const visible = props.tagFilter === '' ? todos : todos.filter(todo => asTags(todo.tags).includes(props.tagFilter))
  const { lanes, cancelled } = useMemo(() => lanesOf(visible), [visible])
  const openCount = todos.filter(todo => laneStatusOf(todo) !== 'done' && laneStatusOf(todo) !== 'cancelled').length
  // Label identity: cheap state-provided scope/name first (always present),
  // then the picker's library list, then a neutral fallback.
  const activeLib = useMemo(() => {
    if (props.libScope === 'team' || props.libScope === 'personal') {
      return { scope: props.libScope, workspaceName: props.libName }
    }
    const libs = Array.isArray(props.libraries) ? props.libraries : []
    for (const lib of libs.map(asRecord)) {
      if (asString(lib.docId) === props.activeDocId) {
        return { scope: asString(lib.scope), workspaceName: asString(lib.workspaceName) }
      }
    }
    return undefined
  }, [props.libScope, props.libName, props.libraries, props.activeDocId])

  const flash = (message: string): void => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2600)
  }

  const refresh = (): void => {
    void props.todoState().then((result) => {
      if (!result.ok) return
      applyState(result.value)
    })
  }

  const applyState = (value: unknown): void => {
    const record = asRecord(value)
    const library = asRecord(record.library)
    props.actions.setTodoState(
      Array.isArray(record.todos) ? record.todos : [],
      record.ready === true,
      typeof library.link === 'string' ? library.link : '',
      typeof record.libraryName === 'string' ? record.libraryName : undefined,
      typeof record.libraryScope === 'string' ? record.libraryScope : undefined,
    )
    if (Array.isArray(record.libraries) || typeof record.activeDocId === 'string') {
      props.actions.setTodoLibraries(
        Array.isArray(record.libraries) ? record.libraries : [],
        typeof record.activeDocId === 'string' ? record.activeDocId : '',
      )
    }
  }

  /** Pull the switcher list fresh (host cache was cleared by select/ensure). */
  const refreshLibraries = (): void => {
    void props.todoLibraries().then((result) => {
      if (!result.ok) return
      const value = asRecord(result.value)
      props.actions.setTodoLibraries(
        Array.isArray(value.libraries) ? value.libraries : [],
        typeof value.activeDocId === 'string' ? value.activeDocId : '',
      )
    }).catch(() => {})
  }

  const onSelectLibrary = (docId: string): void => {
    if (docId === props.activeDocId || switching) return
    setSwitching(true)
    void props.selectTodoLibrary(docId).then((result) => {
      setSwitching(false)
      setSwitcherOpen(false)
      setTeamPick(false)
      if (result.ok) {
        writeLibPref(docId)
        applyState(result.value)
        refreshLibraries()
        flash('已切换任务库')
      } else {
        flash(`切换失败：${result.error.message}`)
      }
    })
  }

  const openTeamPicker = (): void => {
    setTeamPick(true)
    if (teamWorkspaces.length === 0) {
      void props.todoLibraries().then((result) => {
        if (!result.ok) return
        const list = asArray(asRecord(result.value).teamWorkspaces)
        setTeamWorkspaces(list.map(item => {
          const ws = asRecord(item)
          return {
            id: asString(ws.id),
            name: asString(ws.name),
            docCount: typeof ws.docCount === 'number' ? ws.docCount : 0,
            permissionLevel: typeof ws.permissionLevel === 'number' ? ws.permissionLevel : 3,
          }
        }))
      })
    }
  }

  const onEnsureTeam = (workspace: string): void => {
    if (switching) return
    setSwitching(true)
    void props.ensureTeamTodo(workspace).then((result) => {
      setSwitching(false)
      setSwitcherOpen(false)
      setTeamPick(false)
      if (result.ok) {
        const library = asRecord(asRecord(result.value).library)
        const docId = asString(library.docId)
        if (docId !== '') writeLibPref(docId)
        applyState(result.value)
        refreshLibraries()
        flash('团队任务库已就绪')
      } else {
        flash(`开通失败：${result.error.message}`)
      }
    })
  }

  const onEnsure = (): void => {
    setEnsuring(true)
    void props.ensureTodo().then((result) => {
      setEnsuring(false)
      if (result.ok) {
        const value = asRecord(result.value)
        const library = asRecord(value.library)
        props.actions.setTodoState([], true, typeof library.link === 'string' ? library.link : '')
        flash('任务库已开通，创建第一条待办吧')
        inputRef.current?.focus()
      } else {
        flash(`开通失败：${result.error.message}`)
      }
    })
  }

  const onCreate = (): void => {
    if (parsed.title === '' || creating) return
    setCreating(true)
    void props.createTodo({
      title: parsed.title,
      ...(parsed.ddl === '' ? {} : { ddl: parsed.ddl }),
      ...(parsed.tags.length === 0 ? {} : { tags: parsed.tags }),
    }).then((result) => {
      setCreating(false)
      if (result.ok) {
        setDraft('')
        props.actions.patchTodo(result.value)
        refresh()
      } else {
        flash(`创建失败：${result.error.message}`)
      }
    })
  }

  const onToggle = (todo: UnknownRecord): void => {
    const todoId = asString(todo.todoId)
    setBusyId(todoId)
    // Optimistic flip; revert via refresh on failure.
    props.actions.patchTodo({ ...todo, status: laneStatusOf(todo) === 'done' ? 'in_progress' : 'done' })
    void props.toggleTodo(todoId).then((result) => {
      setBusyId('')
      if (result.ok) {
        props.actions.patchTodo(result.value)
      } else {
        flash(`操作失败：${result.error.message}`)
        refresh()
      }
    })
  }

  /** One human verb → RPC → patch/refresh (泳道卡片操作即状态动词，D9 无卡). */
  const runVerb = (verb: 'approve' | 'accept' | 'return' | 'cancel' | 'reopen', todoId: string, note?: string): void => {
    setBusyId(todoId)
    const call = verb === 'approve' ? props.approveTodo(todoId, note)
      : verb === 'accept' ? props.acceptTodo(todoId, note)
      : verb === 'return' ? props.returnTodo(todoId, note)
      : verb === 'cancel' ? props.cancelTodo(todoId, note)
      : props.reopenTodo(todoId)
    void call.then((result) => {
      setBusyId('')
      setNoteFor(null)
      setNoteDraft('')
      if (result.ok) {
        props.actions.patchTodo(result.value)
        refresh()
      } else {
        flash(`操作失败：${result.error.message}`)
        refresh()
      }
    })
  }

  const openEdit = (todo: UnknownRecord): void => {
    setEditFor(asString(todo.todoId))
    setEditDraft({
      title: asString(todo.title),
      description: asString(todo.description),
      ddl: asString(todo.ddl),
      assignee: asString(todo.assignee),
    })
  }

  const saveEdit = (todoId: string): void => {
    if (editDraft.title.trim() === '' || busyId === todoId) return
    setBusyId(todoId)
    void props.editTodo(todoId, {
      title: editDraft.title.trim(),
      description: editDraft.description,
      ...(editDraft.ddl.trim() === '' ? {} : { ddl: editDraft.ddl.trim() }),
      ...(editDraft.assignee.trim() === '' ? {} : { assignee: editDraft.assignee.trim() }),
    }).then((result) => {
      setBusyId('')
      if (result.ok) {
        setEditFor('')
        props.actions.patchTodo(result.value)
        refresh()
      } else {
        flash(`保存失败：${result.error.message}`)
      }
    })
  }

  /** One swimlane card: title + meta + description preview + lane verbs (卡片操作即状态动词). */
  const renderCard = (todo: UnknownRecord) => {
    const todoId = asString(todo.todoId)
    const status = laneStatusOf(todo)
    const isExpanded = expanded === todoId
    const ddl = asString(todo.ddl)
    const terminal = status === 'done' || status === 'cancelled'
    const overdue = !terminal && ddl !== '' && ddl < todayStr()
    const dueToday = !terminal && ddl === todayStr()
    const description = asString(todo.description)
    const claimedBy = asString(todo.claimedBy)
    const reviewNote = asString(todo.reviewNote)
    const busy = busyId === todoId
    return (
      <div
        key={todoId}
        className={`${css.card}${status === 'done' ? ` ${css.cardDone}` : ''}${status === 'cancelled' ? ` ${css.cardDone}` : ''}${overdue ? ` ${css.cardOverdue}` : ''}`}
        data-testid={`yzj-todo-card-${todoId}`}
        data-status={status}
      >
        <button
          type="button"
          className={css.rowMain}
          onClick={() => { setExpanded(isExpanded ? '' : todoId) }}
          aria-expanded={isExpanded}
        >
          <span className={css.rowTitle}>{asString(todo.title)}</span>
          <span className={css.rowMeta}>
            {ddl !== '' && (
              <span className={overdue ? `${css.chip} ${css.chipDanger}` : dueToday ? `${css.chip} ${css.chipWarn}` : css.chip}>
                {overdue ? '逾期 ' : dueToday ? '今天 ' : ''}{ddl}
              </span>
            )}
            {asTags(todo.tags).map(tag => (
              <span
                key={tag}
                className={css.chipTag}
                onClick={(event) => {
                  event.stopPropagation()
                  props.actions.setTodoTag(props.tagFilter === tag ? '' : tag)
                }}
              >
                #{tag}
              </span>
            ))}
            {asString(todo.priority) !== '' && <span className={css.chipMuted}>{asString(todo.priority)}</span>}
            {asString(todo.assignee) !== '' && <span className={css.chipMuted}>@{asString(todo.assignee)}</span>}
          </span>
        </button>
        {description !== '' && status !== 'done' && status !== 'cancelled' && (
          <div className={css.cardDesc} title={description}>{description}</div>
        )}
        {status === 'in_progress' && (
          <div className={css.claimBadge}>agent 认领中{claimedBy === '' ? '' : ` · ${claimedBy.slice(0, 16)}`}</div>
        )}
        {status === 'in_review' && reviewNote !== '' && (
          <div className={css.reviewBox}>{reviewNote}</div>
        )}
        <div className={css.cardVerbs}>
          {status === 'backlog' && (
            <>
              <button type="button" className={`${css.verb} ${css.verbPrimary}`} data-testid={`yzj-todo-approve-${todoId}`} disabled={busy} onClick={() => { runVerb('approve', todoId) }}>批准</button>
              <button type="button" className={css.verb} data-testid={`yzj-todo-edit-${todoId}`} disabled={busy} onClick={() => { openEdit(todo) }}>编辑</button>
              <button type="button" className={`${css.verb} ${css.verbDanger}`} data-testid={`yzj-todo-cancel-${todoId}`} disabled={busy} onClick={() => { runVerb('cancel', todoId) }}>中止</button>
            </>
          )}
          {status === 'todo' && (
            <>
              <button type="button" className={css.verb} data-testid={`yzj-todo-edit-${todoId}`} disabled={busy} onClick={() => { openEdit(todo) }}>编辑</button>
              <button type="button" className={css.verb} data-testid={`yzj-todo-done-${todoId}`} disabled={busy} title="人直写完成的快路径（不经验收）" onClick={() => { onToggle(todo) }}>✓ 完成</button>
              <button type="button" className={css.verb} data-testid={`yzj-todo-return-${todoId}`} disabled={busy} onClick={() => { setNoteFor({ todoId, verb: 'return' }); setNoteDraft('') }}>打回</button>
              <button type="button" className={`${css.verb} ${css.verbDanger}`} data-testid={`yzj-todo-cancel-${todoId}`} disabled={busy} onClick={() => { runVerb('cancel', todoId) }}>中止</button>
            </>
          )}
          {status === 'in_progress' && (
            <>
              <button type="button" className={css.verb} data-testid={`yzj-todo-done-${todoId}`} disabled={busy} title="人直写完成的快路径（不经验收）" onClick={() => { onToggle(todo) }}>✓ 完成</button>
              <button type="button" className={css.verb} data-testid={`yzj-todo-return-${todoId}`} disabled={busy} title="打回可认领列（清认领）" onClick={() => { setNoteFor({ todoId, verb: 'return' }); setNoteDraft('') }}>打回</button>
              <button type="button" className={`${css.verb} ${css.verbDanger}`} data-testid={`yzj-todo-cancel-${todoId}`} disabled={busy} onClick={() => { runVerb('cancel', todoId) }}>中止</button>
            </>
          )}
          {status === 'in_review' && (
            <>
              <button type="button" className={`${css.verb} ${css.verbPrimary}`} data-testid={`yzj-todo-accept-${todoId}`} disabled={busy} onClick={() => { setNoteFor({ todoId, verb: 'accept' }); setNoteDraft('') }}>验收 ✓</button>
              <button type="button" className={css.verb} data-testid={`yzj-todo-return-${todoId}`} disabled={busy} title="带评语打回进行中" onClick={() => { setNoteFor({ todoId, verb: 'return' }); setNoteDraft('') }}>打回</button>
            </>
          )}
          {status === 'done' && (
            <button type="button" className={css.verb} data-testid={`yzj-todo-reopen-${todoId}`} disabled={busy} onClick={() => { onToggle(todo) }}>重开</button>
          )}
          {status === 'cancelled' && (
            <button type="button" className={css.verb} data-testid={`yzj-todo-reopen-${todoId}`} disabled={busy} onClick={() => { runVerb('reopen', todoId) }}>重开</button>
          )}
        </div>
        {noteFor !== null && noteFor.todoId === todoId && (
          <div className={css.noteForm}>
            <input
              className={css.noteInput}
              data-testid={`yzj-todo-note-input-${todoId}`}
              value={noteDraft}
              placeholder={noteFor.verb === 'accept' ? '验收备注（可空）' : '打回评语（告诉对方差在哪）'}
              onChange={(event) => { setNoteDraft(event.target.value) }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  runVerb(noteFor.verb, todoId, noteDraft)
                }
              }}
            />
            <button type="button" className={`${css.verb} ${css.verbPrimary}`} data-testid={`yzj-todo-note-confirm-${todoId}`} disabled={busy} onClick={() => { runVerb(noteFor.verb, todoId, noteDraft) }}>
              {noteFor.verb === 'accept' ? '确认验收' : '确认打回'}
            </button>
            <button type="button" className={css.verb} onClick={() => { setNoteFor(null); setNoteDraft('') }}>取消</button>
          </div>
        )}
        {editFor === todoId && (
          <div className={css.editForm} data-testid={`yzj-todo-edit-form-${todoId}`}>
            <input
              className={css.noteInput}
              data-testid={`yzj-todo-edit-title-${todoId}`}
              value={editDraft.title}
              placeholder="标题"
              onChange={(event) => { setEditDraft({ ...editDraft, title: event.target.value }) }}
            />
            <textarea
              className={css.editArea}
              data-testid={`yzj-todo-edit-desc-${todoId}`}
              value={editDraft.description}
              placeholder="描述：agent 认领后执行的那段提示词——目标、上下文、完成标准"
              rows={3}
              onChange={(event) => { setEditDraft({ ...editDraft, description: event.target.value }) }}
            />
            <div className={css.editRow}>
              <input
                className={css.noteInput}
                value={editDraft.ddl}
                placeholder="DDL（如 2026-08-30）"
                onChange={(event) => { setEditDraft({ ...editDraft, ddl: event.target.value }) }}
              />
              <input
                className={css.noteInput}
                value={editDraft.assignee}
                placeholder="负责人"
                onChange={(event) => { setEditDraft({ ...editDraft, assignee: event.target.value }) }}
              />
            </div>
            <div className={css.cardVerbs}>
              <button type="button" className={`${css.verb} ${css.verbPrimary}`} data-testid={`yzj-todo-edit-save-${todoId}`} disabled={busy || editDraft.title.trim() === ''} onClick={() => { saveEdit(todoId) }}>保存</button>
              <button type="button" className={css.verb} onClick={() => { setEditFor('') }}>取消</button>
            </div>
          </div>
        )}
        {isExpanded && (
          <div className={css.detail}>
            <div className={css.detailLine}>ID {todoId} · 状态 {status}{ddl === '' ? '' : ` · DDL ${ddl}`}{asString(todo.claimedBy) === '' ? '' : ` · 认领会话 ${asString(todo.claimedBy)}`}</div>
            {asString(todo.assignee) !== '' && <div className={css.detailLine}>负责人：{asString(todo.assignee)}</div>}
            {asString(todo.log) !== '' && (
              <div className={css.detailLog}>
                {asString(todo.log).split('\n').slice(-4).map((line, index) => <div key={index}>{line}</div>)}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // --- Empty state: one-click provisioning (never flash while loading) ---
  if (!props.ready && !props.loading) {
    return (
      <div className={css.body}>
        <div className={css.hero}>
          <div className={css.heroIcon}>✓</div>
          <div className={css.heroTitle}>开通待办任务库</div>
          <div className={css.heroText}>
            待办以一张多维表格作为演示载体（自动建在你的个人知识库），支持 #标签 聚合与逾期提醒；
            后续将无缝切换到原生待办后端，标签与任务数据一并迁移。
          </div>
          <button type="button" className={css.heroButton} onClick={onEnsure} disabled={ensuring}>
            {ensuring ? '开通中…' : '一键开通'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={css.body} data-testid="yzj-todo-pane">
      {/* Library switcher: personal / team libraries, one-click team setup. */}
      <div className={css.libRow} ref={switcherRef}>
        <button
          type="button"
          className={switcherOpen ? `${css.libSwitch} ${css.libSwitchOpen}` : css.libSwitch}
          onClick={() => { setSwitcherOpen(!switcherOpen); setTeamPick(false) }}
          aria-haspopup="listbox"
          aria-expanded={switcherOpen}
          title="切换任务库（个人 / 团队）"
        >
          <span aria-hidden="true">{activeLib?.scope === 'team' ? '👥' : '📋'}</span>
          <span className={css.libName}>{activeLib === undefined ? '任务库' : activeLib.scope === 'team' ? `团队 · ${activeLib.workspaceName === '' ? '共享库' : activeLib.workspaceName}` : `个人 · ${activeLib.workspaceName === '' ? '我的' : activeLib.workspaceName}`}</span>
          <span className={css.libCaret} aria-hidden="true">▾</span>
        </button>
        <span className={css.tagRailSpace} />
        {props.libraryLink !== '' && (
          <a className={css.libraryLink} href={props.libraryLink} target="_blank" rel="noreferrer" title="在云之家打开任务库（多维表格）">
            任务库 ↗
          </a>
        )}
        {switcherOpen && (
          <div className={css.libMenu} role="listbox" aria-label="任务库">
            {!teamPick && (Array.isArray(props.libraries) ? props.libraries : []).map(asRecord).map((lib) => {
              const docId = asString(lib.docId)
              const scope = asString(lib.scope)
              const name = asString(lib.workspaceName)
              return (
                <button
                  key={docId}
                  type="button"
                  role="option"
                  aria-selected={docId === props.activeDocId}
                  className={docId === props.activeDocId ? `${css.libItem} ${css.libItemActive}` : css.libItem}
                  onClick={() => { onSelectLibrary(docId) }}
                  disabled={switching}
                >
                  <span aria-hidden="true">{scope === 'team' ? '👥' : '📋'}</span>
                  <span className={css.libItemName}>{scope === 'team' ? `团队 · ${name === '' ? '共享库' : name}` : `个人 · ${name === '' ? '我的' : name}`}</span>
                  {docId === props.activeDocId && <span className={css.libCheck} aria-hidden="true">✓</span>}
                </button>
              )
            })}
            {!teamPick && (
              <button type="button" className={css.libItem} onClick={openTeamPicker} disabled={switching}>
                <span aria-hidden="true">➕</span>
                <span className={css.libItemName}>新建 / 选择团队任务库…</span>
              </button>
            )}
            {teamPick && (
              <>
                <button type="button" className={css.libBack} onClick={() => { setTeamPick(false) }}>‹ 返回</button>
                <div className={css.libMenuHint}>选择团队知识库（将创建或复用其中的「待办任务库」，有编辑权限才可选）</div>
                {teamWorkspaces.map(ws => (
                  <button
                    key={ws.id}
                    type="button"
                    className={css.libItem}
                    onClick={() => { onEnsureTeam(ws.id) }}
                    disabled={switching || ws.permissionLevel > 2}
                    title={ws.permissionLevel > 2 ? '只读知识库，无法开通' : `在「${ws.name}」开通团队任务库`}
                  >
                    <span aria-hidden="true">👥</span>
                    <span className={css.libItemName}>{ws.name}</span>
                    <span className={css.libItemMeta}>{ws.permissionLevel > 2 ? '只读' : `${ws.docCount} 文档`}</span>
                  </button>
                ))}
                {teamWorkspaces.length === 0 && <div className={css.libMenuHint}>（无可用的团队知识库）</div>}
              </>
            )}
          </div>
        )}
      </div>

      {/* Quick create: title + #tags + date fragments in one input. */}
      <div className={css.quick}>
        <span className={css.quickPlus} aria-hidden="true">+</span>
        <input
          ref={inputRef}
          className={css.quickInput}
          value={draft}
          placeholder="记一条待办… 支持 #标签 和日期（8/20、周五前、8月20日、今天/明天）"
          onChange={(event) => { setDraft(event.target.value) }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              onCreate()
            }
          }}
          disabled={creating}
        />
        <button
          type="button"
          className={parsed.title === '' ? `${css.quickAdd} ${css.quickAddDisabled}` : css.quickAdd}
          onClick={onCreate}
          disabled={parsed.title === '' || creating}
          aria-label="添加待办"
        >
          {creating ? '…' : '添加'}
        </button>
      </div>
      {draft.trim() !== '' && (
        <div className={css.quickHint} aria-live="polite">
          将创建：<strong>{parsed.title}</strong>
          {parsed.tags.length > 0 && <span> · {parsed.tags.map(tag => `#${tag}`).join(' ')}</span>}
          {parsed.ddl !== '' && <span> · DDL {parsed.ddl}</span>}
        </div>
      )}

      {/* Tag rail: tags aggregate anything — projects, groups, themes. */}
      {tagCounts.length > 0 && (
        <div className={css.tagRail} role="group" aria-label="标签聚合">
          <button
            type="button"
            className={props.tagFilter === '' ? `${css.tagChip} ${css.tagChipActive}` : css.tagChip}
            onClick={() => { props.actions.setTodoTag('') }}
          >
            全部 · {todos.length}
          </button>
          {tagCounts.map(([tag, count]) => (
            <button
              key={tag}
              type="button"
              className={props.tagFilter === tag ? `${css.tagChip} ${css.tagChipActive}` : css.tagChip}
              onClick={() => { props.actions.setTodoTag(props.tagFilter === tag ? '' : tag) }}
            >
              #{tag} · {count}
            </button>
          ))}
        </div>
      )}

      {/* Swimlane board: five lanes in state-machine order (todo-swimlane-agent §2.4). */}
      {visible.length === 0 && !props.loading ? (
        <div className={css.empty}>
          <div className={css.emptyIcon}>🗒️</div>
          <div>{props.tagFilter === '' ? (openCount === 0 && todos.length === 0 ? '还没有待办，从上面记一条开始' : '当前筛选下没有待办') : `#${props.tagFilter} 下没有待办`}</div>
        </div>
      ) : (
        <div className={css.lanes}>
          {lanes.map(lane => (
            <section key={lane.key} className={css.lane} aria-label={lane.label} data-testid={`yzj-todo-lane-${lane.key}`}>
              <header className={`${css.bucketHead} ${css[`tone-${lane.tone}`]}`}>
                <span>{lane.label}</span>
                <span className={css.bucketCount}>{lane.todos.length}</span>
              </header>
              {lane.hint !== '' && <div className={css.laneHint}>{lane.hint}</div>}
              {lane.todos.map(renderCard)}
              {lane.todos.length === 0 && <div className={css.laneEmpty}>（空）</div>}
            </section>
          ))}
        </div>
      )}
      {cancelled.length > 0 && (
        <div className={css.closedZone}>
          <button
            type="button"
            className={css.closedToggle}
            data-testid="yzj-todo-cancelled-toggle"
            onClick={() => { setShowCancelled(!showCancelled) }}
          >
            {showCancelled ? '▾' : '▸'} 已终止 {cancelled.length}
          </button>
          {showCancelled && cancelled.map(renderCard)}
        </div>
      )}

      <footer className={css.foot}>
        <span>泳道待办：你管批准与验收，agent 认领执行；卡片可直接编辑任务描述——那就是 agent 认领后执行的那段提示词</span>
      </footer>

      {notice !== '' && <div className={css.notice} role="status">{notice}</div>}
    </div>
  )
}
