/**
 * The 待办 tab: a friction-light todo surface over the demo-stage sheet
 * backend (待办任务库). Buckets by urgency (逾期 / 今天 / 进行中 / 待办 /
 * 已完成), #tag chips aggregate anything (a tag can be a project, a group,
 * a theme), quick-create parses `#tag` + dates straight from the input, and
 * every row is a drag source into the composer. Completing/reopening and
 * quick-creating are user-direct writes (no confirmation card — the panel
 * acts as the user's own hand); agent writes still go through the tool
 * confirmation flow. Data arrives through the /yzj RPC face only.
 */
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import type { BakedActions } from '@deepseek-ai/dsh-client-ui-slots'
import type { YzjPanelActions, YzjPanelState } from './stores.ts'
import { YZJ_DRAG_MIME, type YzjDragRef } from './panel.tsx'
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

/** One bucket of todos. */
interface Bucket {
  key: string
  label: string
  tone: 'danger' | 'warn' | 'info' | 'muted' | 'done'
  todos: UnknownRecord[]
}

/** Bucket todos by urgency; done shows the 10 most recent. */
function bucketsOf(todos: UnknownRecord[]): Bucket[] {
  const today = todayStr()
  const byDdl = (a: UnknownRecord, b: UnknownRecord): number => {
    const da = asString(a.ddl)
    const db = asString(b.ddl)
    if (da === '' && db === '') return asString(a.todoId) < asString(b.todoId) ? -1 : 1
    if (da === '') return 1
    if (db === '') return -1
    return da === db ? (asString(a.todoId) < asString(b.todoId) ? -1 : 1) : (da < db ? -1 : 1)
  }
  const open = todos.filter(todo => asString(todo.status) !== 'done')
  const done = todos.filter(todo => asString(todo.status) === 'done')
  const overdue = open.filter(todo => asString(todo.ddl) !== '' && asString(todo.ddl) < today)
  const dueToday = open.filter(todo => asString(todo.ddl) === today)
  const inProgress = open.filter(todo => asString(todo.status) === 'in_progress' && !overdue.includes(todo) && !dueToday.includes(todo))
  const plain = open.filter(todo => !overdue.includes(todo) && !dueToday.includes(todo) && !inProgress.includes(todo))
  const buckets: Bucket[] = ([
    { key: 'overdue', label: '逾期', tone: 'danger', todos: overdue.sort(byDdl) },
    { key: 'today', label: '今天到期', tone: 'warn', todos: dueToday.sort(byDdl) },
    { key: 'progress', label: '进行中', tone: 'info', todos: inProgress.sort(byDdl) },
    { key: 'pending', label: '待办', tone: 'muted', todos: plain.sort(byDdl) },
    { key: 'done', label: '已完成', tone: 'done', todos: done.sort((a, b) => asString(a.todoId) < asString(b.todoId) ? 1 : -1).slice(0, 10) },
  ] as Bucket[]).filter(bucket => bucket.todos.length > 0)
  return buckets
}

/** The circular status control: empty (pending), half (in_progress), check (done). */
function StatusDot({ status, busy, onToggle, title }: { status: string; busy: boolean; onToggle: () => void; title: string }) {
  const cls = status === 'done'
    ? `${css.dot} ${css.dotDone}`
    : status === 'in_progress' ? `${css.dot} ${css.dotProgress}` : css.dot
  return (
    <button
      type="button"
      className={busy ? `${cls} ${css.dotBusy}` : cls}
      onClick={onToggle}
      disabled={busy}
      title={title}
      aria-label={title}
      aria-pressed={status === 'done'}
    >
      {status === 'done' && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
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
  const buckets = useMemo(() => bucketsOf(visible), [visible])
  const openCount = todos.filter(todo => asString(todo.status) !== 'done').length
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

  const startDrag = (event: DragEvent, todo: UnknownRecord): void => {
    const ref: YzjDragRef = {
      kind: 'todo',
      id: asString(todo.todoId),
      title: asString(todo.title),
      sub: `${asString(todo.status)}${asString(todo.ddl) === '' ? '' : ` · ${asString(todo.ddl)}`}`,
      ...(props.libraryLink === '' ? {} : { url: props.libraryLink }),
    }
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData(YZJ_DRAG_MIME, JSON.stringify(ref))
    event.dataTransfer.setData('text/plain', `【云之家·待办】${ref.title}${ref.sub === undefined ? '' : `（${ref.sub}）`}`)
  }

  // --- Empty state: one-click provisioning (never flash while loading) ---
  if (!props.ready && !props.loading) {
    return (
      <div className={css.body}>
        <div className={css.hero}>
          <div className={css.heroIcon}>✓</div>
          <div className={css.heroTitle}>开通待办任务库</div>
          <div className={css.heroText}>
            待办以一张多维表格作为演示载体（自动建在你的个人知识库），支持 #标签 聚合、逾期提醒与拖入对话；
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
    <div className={css.body}>
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

      {/* Buckets. */}
      <div className={css.list}>
        {buckets.length === 0 && !props.loading && (
          <div className={css.empty}>
            <div className={css.emptyIcon}>🗒️</div>
            <div>{props.tagFilter === '' ? (openCount === 0 && todos.length === 0 ? '还没有待办，从上面记一条开始' : '当前筛选下没有待办') : `#${props.tagFilter} 下没有待办`}</div>
          </div>
        )}
        {buckets.map(bucket => (
          <section key={bucket.key} className={css.bucket} aria-label={bucket.label}>
            <header className={`${css.bucketHead} ${css[`tone-${bucket.tone}`]}`}>
              <span>{bucket.label}</span>
              <span className={css.bucketCount}>{bucket.todos.length}</span>
            </header>
            {bucket.todos.map(todo => {
              const todoId = asString(todo.todoId)
              const status = asString(todo.status)
              const isExpanded = expanded === todoId
              const meta: string[] = []
              if (asString(todo.priority) !== '') meta.push(asString(todo.priority))
              if (asString(todo.assignee) !== '') meta.push(`@${asString(todo.assignee)}`)
              const overdue = status !== 'done' && asString(todo.ddl) !== '' && asString(todo.ddl) < todayStr()
              const dueToday = status !== 'done' && asString(todo.ddl) === todayStr()
              return (
                <div key={todoId}>
                  <div
                    className={status === 'done' ? `${css.row} ${css.rowDone}` : overdue ? `${css.row} ${css.rowOverdue}` : css.row}
                    draggable
                    onDragStart={(event) => { startDrag(event, todo) }}
                    title="拖入对话，让 agent 处理这条待办"
                  >
                    <StatusDot
                      status={status}
                      busy={busyId === todoId}
                      onToggle={() => { onToggle(todo) }}
                      title={status === 'done' ? '重开待办' : '完成待办'}
                    />
                    <button
                      type="button"
                      className={css.rowMain}
                      onClick={() => { setExpanded(isExpanded ? '' : todoId) }}
                      aria-expanded={isExpanded}
                    >
                      <span className={css.rowTitle}>{asString(todo.title)}</span>
                      <span className={css.rowMeta}>
                        {asString(todo.ddl) !== '' && (
                          <span className={overdue ? `${css.chip} ${css.chipDanger}` : dueToday ? `${css.chip} ${css.chipWarn}` : css.chip}>
                            {overdue ? '逾期 ' : dueToday ? '今天 ' : ''}{asString(todo.ddl)}
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
                        {meta.map(part => <span key={part} className={css.chipMuted}>{part}</span>)}
                      </span>
                    </button>
                  </div>
                  {isExpanded && (
                    <div className={css.detail}>
                      <div className={css.detailLine}>ID {todoId} · 状态 {status}{asString(todo.ddl) === '' ? '' : ` · DDL ${asString(todo.ddl)}`}</div>
                      {asString(todo.assignee) !== '' && <div className={css.detailLine}>负责人：{asString(todo.assignee)}</div>}
                      {asString(todo.log) !== '' && (
                        <div className={css.detailLog}>
                          {asString(todo.log).split('\n').slice(-4).map((line, index) => <div key={index}>{line}</div>)}
                        </div>
                      )}
                      <div className={css.detailHint}>拖入对话可让 agent 跟进；改期/改负责人请直接告诉 agent。</div>
                    </div>
                  )}
                </div>
              )
            })}
          </section>
        ))}
      </div>

      <footer className={css.foot}>
        <span>演示阶段：待办存于多维表格「待办任务库」，后续切换原生后端时数据与标签平滑迁移</span>
      </footer>

      {notice !== '' && <div className={css.notice} role="status">{notice}</div>}
    </div>
  )
}
