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
import { useMemo, useRef, useState, type DragEvent } from 'react'
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
  actions: BakedActions<YzjPanelState, YzjPanelActions>
  todoState: () => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  ensureTodo: () => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  createTodo: (input: { title: string; ddl?: string; priority?: string; tags?: string[] }) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  toggleTodo: (todoId: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
}

export function TodoPane(props: TodoPaneProps) {
  const [draft, setDraft] = useState('')
  const [creating, setCreating] = useState(false)
  const [ensuring, setEnsuring] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [notice, setNotice] = useState('')
  const [expanded, setExpanded] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  const todos = useMemo(() => props.todos.map(asRecord), [props.todos])
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

  const flash = (message: string): void => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2600)
  }

  const refresh = (): void => {
    void props.todoState().then((result) => {
      if (!result.ok) return
      const value = asRecord(result.value)
      const library = asRecord(value.library)
      props.actions.setTodoState(
        Array.isArray(value.todos) ? value.todos : [],
        value.ready === true,
        typeof library.link === 'string' ? library.link : '',
      )
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

  // --- Empty state: one-click provisioning ---
  if (!props.ready) {
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
          <span className={css.tagRailSpace} />
          {props.libraryLink !== '' && (
            <a className={css.libraryLink} href={props.libraryLink} target="_blank" rel="noreferrer" title="在云之家打开任务库（多维表格）">
              任务库 ↗
            </a>
          )}
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
