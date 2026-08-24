// @vitest-environment jsdom
/**
 * Todo pane specs: the quick-create mini-parser (#tags + date fragments),
 * the swimlane lanes (todo-swimlane-agent §2.4: 待我决定/可认领/进行中/待我验收/
 * 已完成 + 已终止折叠), tag-filter aggregation, the provisioning hero, and the
 * lane verb calls against a scripted inject face.
 */
import { act } from 'react-dom/test-utils'
import { createRoot, type Root } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { TodoPane, parseQuickCreate } from '../src/client/todo-pane.tsx'
import type { TodoPaneProps } from '../src/client/todo-pane.tsx'
import { createYzjStore } from '../src/client/stores.ts'

type Rpc = { ok: true; value: unknown } | { ok: false; error: { message: string } }

interface Face {
  container: HTMLDivElement
  props: TodoPaneProps
  verbs: { verb: string; todoId: string; note?: string }[]
  state: () => ReturnType<ReturnType<typeof createYzjStore>['create']>['getSnapshot']
  root: Root
}

function mountPane(over: Partial<TodoPaneProps> & { todos?: unknown[] }): Face {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const instance = createYzjStore().create()
  const verbs: Face['verbs'] = []
  const verbRpc = (verb: string) => async (todoId: string, note?: string) => {
    verbs.push({ verb, todoId, ...(note === undefined ? {} : { note }) })
    return { ok: true, value: { todoId, title: 'x', status: 'todo', tags: [] } } as Rpc
  }
  const base: TodoPaneProps = {
    todos: [],
    ready: true,
    libraryLink: 'https://example/lib',
    tagFilter: '',
    loading: false,
    libName: '',
    libScope: '',
    activeDocId: '',
    libraries: [],
    actions: instance.actions,
    todoState: async () => ({ ok: true, value: { ready: true, library: { link: 'https://example/lib' }, todos: over.todos ?? [] } }) as Rpc,
    ensureTodo: async () => ({ ok: true, value: { ready: true, library: { link: 'https://example/lib' }, todos: [] } }) as Rpc,
    createTodo: async () => ({ ok: true, value: { todoId: 'T-1', title: 'x', status: 'todo', tags: [] } }) as Rpc,
    toggleTodo: async () => ({ ok: true, value: { todoId: 'T-1', title: 'x', status: 'done', tags: [] } }) as Rpc,
    approveTodo: verbRpc('approve'),
    acceptTodo: verbRpc('accept'),
    returnTodo: verbRpc('return'),
    cancelTodo: verbRpc('cancel'),
    reopenTodo: verbRpc('reopen'),
    editTodo: async (todoId, patch) => {
      verbs.push({ verb: 'edit', todoId, ...(patch.title === undefined ? {} : { note: patch.title }) })
      return { ok: true, value: { todoId, title: patch.title ?? 'x', status: 'todo', tags: [] } } as Rpc
    },
    todoLibraries: async () => ({ ok: true, value: { libraries: [], activeDocId: '', teamWorkspaces: [] } }) as Rpc,
    selectTodoLibrary: async () => ({ ok: true, value: { ready: true, library: { docId: 'docB', link: 'https://example/lib' }, todos: [] } }) as Rpc,
    ensureTeamTodo: async () => ({ ok: true, value: { ready: true, library: { docId: 'docTeam', link: 'https://example/lib' }, todos: [] } }) as Rpc,
    ...over,
  }
  act(() => {
    root.render(<TodoPane {...base} />)
  })
  return { container, props: base, verbs, state: () => instance.getSnapshot(), root }
}

const today = (() => {
  const now = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())}`
})()

const yesterday = (() => {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`
})()

function todo(over: Record<string, unknown>): unknown {
  return { todoId: 'T-1', title: '任务', status: 'todo', tags: [], ddl: '', assignee: '', log: '', description: '', claimedBy: '', version: 0, reviewNote: '', overdue: false, ...over }
}

describe('parseQuickCreate', () => {
  it('splits #tags and date fragments out of the title', () => {
    expect(parseQuickCreate('写迁移文档 #迁移 #P0 8/20')).toEqual({
      title: '写迁移文档',
      tags: ['迁移', 'P0'],
      ddl: `${new Date().getFullYear()}/08/20`,
    })
  })

  it('understands relative words and full dates', () => {
    const rel = parseQuickCreate('今天收尾')
    expect(rel.ddl).toBe(today)
    expect(rel.title).toBe('收尾')
    expect(parseQuickCreate('评审 2026-08-20').ddl).toBe('2026/08/20')
    expect(parseQuickCreate('发版 8月20日').ddl).toBe(`${new Date().getFullYear()}/08/20`)
  })

  it('dedupes tags and keeps plain text intact', () => {
    const out = parseQuickCreate('#a #a 纯文本 无日期')
    expect(out.tags).toEqual(['a'])
    expect(out.title).toBe('纯文本 无日期')
    expect(out.ddl).toBe('')
  })
})

describe('TodoPane', () => {
  it('shows the provisioning hero when the library is not ready', () => {
    const face = mountPane({ ready: false })
    expect(face.container.textContent).toContain('开通待办任务库')
    expect(face.container.textContent).toContain('一键开通')
  })

  it('swimlane lanes map statuses; overdue flagged as chip; cancelled folds away', async () => {
    const face = mountPane({
      todos: [
        todo({ todoId: 'T-1', title: '待批准的事', status: 'backlog' }),
        todo({ todoId: 'T-2', title: '过期的活', status: 'todo', ddl: yesterday, overdue: true }),
        todo({ todoId: 'T-3', title: '今天到期的活', status: 'todo', ddl: today }),
        todo({ todoId: 'T-4', title: '进行中的活', status: 'in_progress', claimedBy: 'sess-abc' }),
        todo({ todoId: 'T-5', title: '交卷的活', status: 'in_review', reviewNote: '已上线' }),
        todo({ todoId: 'T-6', title: '干完的活', status: 'done' }),
        todo({ todoId: 'T-7', title: '中止的活', status: 'cancelled' }),
      ],
    })
    const laneText = (key: string): string => face.container.querySelector(`[data-testid="yzj-todo-lane-${key}"]`)?.textContent ?? ''
    // 五列齐（与推进三栏目同词：待我决定/待我验收）
    expect(laneText('backlog')).toContain('待我决定')
    expect(laneText('backlog')).toContain('待批准的事')
    expect(laneText('todo')).toContain('可认领')
    expect(laneText('todo')).toContain('过期的活')
    expect(laneText('todo')).toContain('逾期')
    expect(laneText('todo')).toContain('今天到期的活')
    expect(laneText('in_progress')).toContain('agent 认领中')
    expect(laneText('in_review')).toContain('已上线')
    expect(laneText('done')).toContain('干完的活')
    // cancelled 不占列，收进折叠区
    expect(face.container.textContent).not.toContain('中止的活')
    const toggle = face.container.querySelector('[data-testid="yzj-todo-cancelled-toggle"]') as HTMLButtonElement
    expect(toggle.textContent).toContain('已终止 1')
    await act(async () => { toggle.click() })
    expect(face.container.textContent).toContain('中止的活')
    expect(face.container.querySelectorAll('[draggable="true"]').length).toBe(0)
    expect(face.container.textContent).not.toContain('拖入')
  })

  it('card verbs call the matching human RPC（批准/打回带评语/验收）', async () => {
    const face = mountPane({
      todos: [
        todo({ todoId: 'T-1', title: '待批准的事', status: 'backlog' }),
        todo({ todoId: 'T-2', title: '交卷的活', status: 'in_review', reviewNote: '已上线' }),
      ],
    })
    // 批准：一键
    const approve = face.container.querySelector('[data-testid="yzj-todo-approve-T-1"]') as HTMLButtonElement
    await act(async () => { approve.click(); await Promise.resolve() })
    expect(face.verbs.some(v => v.verb === 'approve' && v.todoId === 'T-1')).toBe(true)
    // 验收：先开备注表单再确认
    const accept = face.container.querySelector('[data-testid="yzj-todo-accept-T-2"]') as HTMLButtonElement
    act(() => { accept.click() })
    const confirm = face.container.querySelector('[data-testid="yzj-todo-note-confirm-T-2"]') as HTMLButtonElement
    expect(confirm.textContent).toContain('确认验收')
    await act(async () => { confirm.click(); await Promise.resolve() })
    expect(face.verbs.some(v => v.verb === 'accept' && v.todoId === 'T-2')).toBe(true)
  })

  it('inline edit writes the task details（S7：描述=提示词本体）', async () => {
    const face = mountPane({
      todos: [todo({ todoId: 'T-1', title: '待批准的事', status: 'backlog', description: '旧提示词' })],
    })
    const edit = face.container.querySelector('[data-testid="yzj-todo-edit-T-1"]') as HTMLButtonElement
    act(() => { edit.click() })
    const descArea = face.container.querySelector('[data-testid="yzj-todo-edit-desc-T-1"]') as HTMLTextAreaElement
    expect(descArea.value).toBe('旧提示词')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
    act(() => {
      setter?.call(descArea, '改好的提示词')
      descArea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const save = face.container.querySelector('[data-testid="yzj-todo-edit-save-T-1"]') as HTMLButtonElement
    await act(async () => { save.click(); await Promise.resolve() })
    expect(face.verbs.some(v => v.verb === 'edit' && v.todoId === 'T-1')).toBe(true)
  })

  it('aggregates tag chips and filters on click', () => {
    const face = mountPane({
      todos: [
        todo({ todoId: 'T-1', title: '前端活', tags: ['前端'] }),
        todo({ todoId: 'T-2', title: '后端活', tags: ['后端', 'P0'] }),
      ],
    })
    const text = face.container.textContent ?? ''
    expect(text).toContain('#前端 · 1')
    expect(text).toContain('#后端 · 1')
    // Click the 前端 chip: the store filter flips and only that todo stays.
    const chip = [...face.container.querySelectorAll('button')].find(button => (button.textContent ?? '').includes('#前端'))
    expect(chip).toBeDefined()
    act(() => { chip!.click() })
    expect(face.state()?.todoTag).toBe('前端')
  })

  it('shows the quick-create parse hint while typing', () => {
    const face = mountPane({})
    const input = face.container.querySelector('input')
    expect(input).toBeDefined()
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setter?.call(input, '写迁移文档 #迁移 明天')
      input!.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const text = face.container.textContent ?? ''
    expect(text).toContain('将创建')
    expect(text).toContain('写迁移文档')
    expect(text).toContain('#迁移')
  })

  it('renders the swimlane footnote', () => {
    const face = mountPane({})
    expect(face.container.textContent).toContain('泳道待办')
  })

  it('renders the library switcher with scope badges and switches on click', async () => {
    const face = mountPane({
      activeDocId: 'docP',
      libraries: [
        { scope: 'personal', workspaceName: '我的知识', docId: 'docP', tableId: 1, link: '' },
        { scope: 'team', workspaceName: '六大场景内测', docId: 'docT', tableId: 2, link: '' },
      ],
    })
    expect(face.container.textContent).toContain('个人 · 我的知识')
    // Open the menu: both libraries with the active one checked.
    const switcher = [...face.container.querySelectorAll('button')].find(button => (button.getAttribute('aria-haspopup') ?? '') === 'listbox')
    expect(switcher).toBeDefined()
    act(() => { switcher!.click() })
    const text = face.container.textContent ?? ''
    expect(text).toContain('团队 · 六大场景内测')
    // Select the team library: the selection is persisted + RPC called.
    const teamItem = [...face.container.querySelectorAll('[role="option"]')].find(option => (option.textContent ?? '').includes('团队'))
    expect(teamItem).toBeDefined()
    await act(async () => { teamItem!.click() })
    expect(face.container.textContent).toContain('已切换任务库')
  })

  it('offers team provisioning from the switcher (second level)', async () => {
    const face = mountPane({
      activeDocId: 'docP',
      libraries: [{ scope: 'personal', workspaceName: '我的知识', docId: 'docP', tableId: 1, link: '' }],
    })
    const switcher = [...face.container.querySelectorAll('button')].find(button => (button.getAttribute('aria-haspopup') ?? '') === 'listbox')
    act(() => { switcher!.click() })
    const provision = [...face.container.querySelectorAll('button')].find(button => (button.textContent ?? '').includes('新建 / 选择团队任务库'))
    expect(provision).toBeDefined()
    act(() => { provision!.click() })
    // The workspace list loads asynchronously; after resolution at least the
    // hint line of the second level is present.
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
    const text = face.container.textContent ?? ''
    expect(text).toContain('选择团队知识库')
  })
})
