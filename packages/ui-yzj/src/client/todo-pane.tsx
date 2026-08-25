/**
 * The 待办 tab: swimlane board over the six-state machine
 * (todo-swimlane-agent.md §2.4): 待我决定 | 可认领 | 进行中 | 待我验收 |
 * 已完成，已终止收进折叠区（与推进看板「已结束」同款）。卡片操作即状态动词——
 * 批准/验收/打回/中止/编辑都是用户直写（D9 无确认卡；面板即用户本人的手）；
 * agent 走 claim 工具族（yzj_todo_claim/submit_review/release_claim，静默）。
 * #tag chips aggregate anything; quick-create parses `#tag` + dates straight
 * from the input. Data arrives through the /yzj RPC face only.
 */
import { useMemo, useRef, useState } from 'react'
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

/** Swimlane lanes (todo-swimlane-agent §2.4): five fixed lanes in state-machine
 * order over NON-archived cards; cancelled folds into 已终止, archived into
 * 已归档 (S10: view-layer hide, recoverable) — neither occupies a lane. */
export function lanesOf(todos: UnknownRecord[]): { lanes: Lane[]; cancelled: UnknownRecord[]; archived: UnknownRecord[] } {
  const byDdl = (a: UnknownRecord, b: UnknownRecord): number => {
    const da = asString(a.ddl)
    const db = asString(b.ddl)
    if (da === '' && db === '') return asString(a.todoId) < asString(b.todoId) ? -1 : 1
    if (da === '') return 1
    if (db === '') return -1
    return da === db ? (asString(a.todoId) < asString(b.todoId) ? -1 : 1) : (da < db ? -1 : 1)
  }
  const live = todos.filter(todo => todo.archived !== true)
  const pick = (status: string): UnknownRecord[] => live.filter(todo => asString(todo.status) === status).sort(byDdl)
  const lanes: Lane[] = [
    { key: 'backlog', label: '待我决定', tone: 'danger', hint: '批准后 agent 才能认领', todos: pick('backlog') },
    { key: 'todo', label: '可认领', tone: 'muted', hint: '对 agent 说「把能做的做了」', todos: pick('todo') },
    { key: 'in_progress', label: '进行中', tone: 'info', hint: '', todos: pick('in_progress') },
    { key: 'in_review', label: '待我验收', tone: 'warn', hint: '验收才算完', todos: pick('in_review') },
    { key: 'done', label: '已完成', tone: 'done', hint: '', todos: pick('done').reverse().slice(0, 10) },
  ]
  const cancelled = live.filter(todo => asString(todo.status) === 'cancelled')
  const archived = todos.filter(todo => todo.archived === true)
  return { lanes, cancelled, archived }
}

/** Props the panel passes down; data + verbs only, no ctx. */
export interface TodoPaneProps {
  todos: unknown[]
  ready: boolean
  tagFilter: string
  loading: boolean
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
  /** Archive/unarchive (S10：视图层隐藏，非状态）。 */
  archiveTodo: (todoId: string, archived: boolean) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  /** Edit task details (S7): 标题/描述（agent 执行的提示词本体）/DDL/负责人。 */
  editTodo: (todoId: string, patch: { title?: string; description?: string; ddl?: string; assignee?: string }) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  /** Dispatch one claimable todo to a fresh agent session（期②手动径，todo-swimlane-agent §2.3）。 */
  dispatchTodo: (todoId: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  /** Focus the fresh agent session after dispatch (optional; absence = no jump). */
  focusBoundSession?: ((sessionId: string) => void) | undefined
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
  const [showArchived, setShowArchived] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Defensive: persisted stores from older builds may carry `todos` as
  // anything but an array — never crash the pane on stale state.
  const todos = useMemo(() => (Array.isArray(props.todos) ? props.todos : []).map(asRecord), [props.todos])
  const parsed = useMemo(() => parseQuickCreate(draft), [draft])
  // 标签轨只统计在途卡（未归档 + 非终局）——已完成/已中止/已归档的 tag 不再占位（S10 同期）。
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const todo of todos) {
      if (todo.archived === true) continue
      const status = asString(todo.status)
      if (status === 'done' || status === 'cancelled') continue
      for (const tag of asTags(todo.tags)) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [todos])

  const visible = props.tagFilter === '' ? todos : todos.filter(todo => asTags(todo.tags).includes(props.tagFilter))
  const { lanes, cancelled, archived } = useMemo(() => lanesOf(visible), [visible])
  const openCount = todos.filter(todo => todo.archived !== true && asString(todo.status) !== 'done' && asString(todo.status) !== 'cancelled').length

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
    props.actions.setTodoState(
      Array.isArray(record.todos) ? record.todos : [],
      record.ready === true,
    )
  }

  const onEnsure = (): void => {
    setEnsuring(true)
    void props.ensureTodo().then((result) => {
      setEnsuring(false)
      if (result.ok) {
        props.actions.setTodoState([], true)
        flash('待办库已就绪，创建第一条待办吧')
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
    props.actions.patchTodo({ ...todo, status: asString(todo.status) === 'done' ? 'in_progress' : 'done' })
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
  const runVerb = (verb: 'approve' | 'accept' | 'return' | 'cancel' | 'reopen' | 'archive' | 'unarchive', todoId: string, note?: string): void => {
    setBusyId(todoId)
    const call = verb === 'approve' ? props.approveTodo(todoId, note)
      : verb === 'accept' ? props.acceptTodo(todoId, note)
      : verb === 'return' ? props.returnTodo(todoId, note)
      : verb === 'cancel' ? props.cancelTodo(todoId, note)
      : verb === 'archive' ? props.archiveTodo(todoId, true)
      : verb === 'unarchive' ? props.archiveTodo(todoId, false)
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

  /** 「让 agent 做」（期②）：host 直建 yzj-todo-* 会话注入任务卡，成功后聚焦。 */
  const onDispatch = (todoId: string): void => {
    setBusyId(todoId)
    void props.dispatchTodo(todoId).then((result) => {
      setBusyId('')
      if (result.ok) {
        const sessionId = asString(asRecord(result.value).sessionId)
        flash('已开工：agent 会话已起，认领与交卷都在那边进行')
        if (sessionId !== '') props.focusBoundSession?.(sessionId)
      } else {
        flash(`派发失败：${result.error.message}`)
        refresh()
      }
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
    const status = asString(todo.status)
    const isExpanded = expanded === todoId
    const ddl = asString(todo.ddl)
    const terminal = status === 'done' || status === 'cancelled'
    const overdue = !terminal && ddl !== '' && ddl < todayStr()
    const dueToday = !terminal && ddl === todayStr()
    const description = asString(todo.description)
    const claimedBy = asString(todo.claimedBy)
    const reviewNote = asString(todo.reviewNote)
    const isArchived = todo.archived === true
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
        {description !== '' && !isArchived && status !== 'done' && status !== 'cancelled' && (
          <div className={css.cardDesc} title={description}>{description}</div>
        )}
        {status === 'in_progress' && (
          <div className={css.claimBadge}>agent 认领中{claimedBy === '' ? '' : ` · ${claimedBy.slice(0, 16)}`}</div>
        )}
        {status === 'in_review' && reviewNote !== '' && (
          <div className={css.reviewBox}>{reviewNote}</div>
        )}
        <div className={css.cardVerbs}>
          {isArchived && (
            <button type="button" className={css.verb} data-testid={`yzj-todo-unarchive-${todoId}`} disabled={busy} onClick={() => { runVerb('unarchive', todoId) }}>恢复</button>
          )}
          {!isArchived && status === 'backlog' && (
            <>
              <button type="button" className={`${css.verb} ${css.verbPrimary}`} data-testid={`yzj-todo-approve-${todoId}`} disabled={busy} onClick={() => { runVerb('approve', todoId) }}>批准</button>
              <button type="button" className={css.verb} data-testid={`yzj-todo-edit-${todoId}`} disabled={busy} onClick={() => { openEdit(todo) }}>编辑</button>
              <button type="button" className={`${css.verb} ${css.verbDanger}`} data-testid={`yzj-todo-cancel-${todoId}`} disabled={busy} onClick={() => { runVerb('cancel', todoId) }}>中止</button>
            </>
          )}
          {!isArchived && status === 'todo' && (
            <>
              <button type="button" className={`${css.verb} ${css.verbPrimary}`} data-testid={`yzj-todo-dispatch-${todoId}`} disabled={busy} title="开一个 agent 会话认领并执行这条待办（期②）" onClick={() => { onDispatch(todoId) }}>让 agent 做</button>
              <button type="button" className={css.verb} data-testid={`yzj-todo-edit-${todoId}`} disabled={busy} onClick={() => { openEdit(todo) }}>编辑</button>
              <button type="button" className={css.verb} data-testid={`yzj-todo-done-${todoId}`} disabled={busy} title="人直写完成的快路径（不经验收）" onClick={() => { onToggle(todo) }}>✓ 完成</button>
              <button type="button" className={css.verb} data-testid={`yzj-todo-return-${todoId}`} disabled={busy} onClick={() => { setNoteFor({ todoId, verb: 'return' }); setNoteDraft('') }}>打回</button>
              <button type="button" className={`${css.verb} ${css.verbDanger}`} data-testid={`yzj-todo-cancel-${todoId}`} disabled={busy} onClick={() => { runVerb('cancel', todoId) }}>中止</button>
            </>
          )}
          {!isArchived && status === 'in_progress' && (
            <>
              <button type="button" className={css.verb} data-testid={`yzj-todo-done-${todoId}`} disabled={busy} title="人直写完成的快路径（不经验收）" onClick={() => { onToggle(todo) }}>✓ 完成</button>
              <button type="button" className={css.verb} data-testid={`yzj-todo-return-${todoId}`} disabled={busy} title="打回可认领列（清认领）" onClick={() => { setNoteFor({ todoId, verb: 'return' }); setNoteDraft('') }}>打回</button>
              <button type="button" className={`${css.verb} ${css.verbDanger}`} data-testid={`yzj-todo-cancel-${todoId}`} disabled={busy} onClick={() => { runVerb('cancel', todoId) }}>中止</button>
            </>
          )}
          {!isArchived && status === 'in_review' && (
            <>
              <button type="button" className={`${css.verb} ${css.verbPrimary}`} data-testid={`yzj-todo-accept-${todoId}`} disabled={busy} onClick={() => { setNoteFor({ todoId, verb: 'accept' }); setNoteDraft('') }}>验收 ✓</button>
              <button type="button" className={css.verb} data-testid={`yzj-todo-return-${todoId}`} disabled={busy} title="带评语打回进行中" onClick={() => { setNoteFor({ todoId, verb: 'return' }); setNoteDraft('') }}>打回</button>
            </>
          )}
          {!isArchived && status === 'done' && (
            <>
              <button type="button" className={css.verb} data-testid={`yzj-todo-reopen-${todoId}`} disabled={busy} onClick={() => { onToggle(todo) }}>重开</button>
              <button type="button" className={css.verb} data-testid={`yzj-todo-archive-${todoId}`} disabled={busy} title="收进已归档折叠区（可恢复）" onClick={() => { runVerb('archive', todoId) }}>归档</button>
            </>
          )}
          {!isArchived && status === 'cancelled' && (
            <>
              <button type="button" className={css.verb} data-testid={`yzj-todo-reopen-${todoId}`} disabled={busy} onClick={() => { runVerb('reopen', todoId) }}>重开</button>
              <button type="button" className={css.verb} data-testid={`yzj-todo-archive-${todoId}`} disabled={busy} title="收进已归档折叠区（可恢复）" onClick={() => { runVerb('archive', todoId) }}>归档</button>
            </>
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
      {archived.length > 0 && (
        <div className={css.closedZone}>
          <button
            type="button"
            className={css.closedToggle}
            data-testid="yzj-todo-archived-toggle"
            onClick={() => { setShowArchived(!showArchived) }}
          >
            {showArchived ? '▾' : '▸'} 已归档 {archived.length}
          </button>
          {showArchived && archived.map(renderCard)}
        </div>
      )}

      <footer className={css.foot}>
        <span>泳道待办：你管批准与验收，agent 认领执行；卡片可直接编辑任务描述——那就是 agent 认领后执行的那段提示词</span>
      </footer>

      {notice !== '' && <div className={css.notice} role="status">{notice}</div>}
    </div>
  )
}
