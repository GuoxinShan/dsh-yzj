// @vitest-environment jsdom
/**
 * Todo pane specs: the quick-create mini-parser (#tags + date fragments),
 * bucketing by urgency, tag-filter aggregation, the provisioning hero, and
 * the optimistic complete toggle against a scripted inject face.
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
  state: () => ReturnType<ReturnType<typeof createYzjStore>['create']>['getSnapshot']
  root: Root
}

function mountPane(over: Partial<TodoPaneProps> & { todos?: unknown[] }): Face {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const instance = createYzjStore().create()
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
    createTodo: async () => ({ ok: true, value: { todoId: 'T-1', title: 'x', status: 'pending', tags: [] } }) as Rpc,
    toggleTodo: async () => ({ ok: true, value: { todoId: 'T-1', title: 'x', status: 'done', tags: [] } }) as Rpc,
    todoLibraries: async () => ({ ok: true, value: { libraries: [], activeDocId: '', teamWorkspaces: [] } }) as Rpc,
    selectTodoLibrary: async () => ({ ok: true, value: { ready: true, library: { docId: 'docB', link: 'https://example/lib' }, todos: [] } }) as Rpc,
    ensureTeamTodo: async () => ({ ok: true, value: { ready: true, library: { docId: 'docTeam', link: 'https://example/lib' }, todos: [] } }) as Rpc,
    ...over,
  }
  act(() => {
    root.render(<TodoPane {...base} />)
  })
  return { container, props: base, state: () => instance.getSnapshot(), root }
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
  return { todoId: 'T-1', title: '任务', status: 'pending', tags: [], ddl: '', assignee: '', log: '', overdue: false, ...over }
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

  it('buckets overdue/today/pending and shows counts', () => {
    const face = mountPane({
      todos: [
        todo({ todoId: 'T-1', title: '过期的活', ddl: yesterday, overdue: true }),
        todo({ todoId: 'T-2', title: '今天到期的活', ddl: today }),
        todo({ todoId: 'T-3', title: '以后的活', ddl: '2099/01/01' }),
      ],
    })
    const text = face.container.textContent ?? ''
    expect(text).toContain('逾期')
    expect(text).toContain('过期的活')
    expect(text).toContain('今天到期')
    expect(text).toContain('今天到期的活')
    expect(text).toContain('待办')
    expect(text).toContain('以后的活')
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

  it('renders the demo-stage footnote', () => {
    const face = mountPane({})
    expect(face.container.textContent).toContain('演示阶段')
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
