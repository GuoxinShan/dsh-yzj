// @vitest-environment jsdom
/**
 * Switching a conversation in the floating panel must not flash leftover
 * rows or the global 加载中 bar (pitfall-013).
 */
import { act } from 'react-dom/test-utils'
import { createRoot, type Root } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { YzjPanel } from '../src/client/panel.tsx'
import { createYzjStore, type YzjPanelState } from '../src/client/stores.ts'
import { putGroupWindow } from '../src/client/im-cache.ts'
import type { YzjPanelInject } from '../src/client/rpc.ts'

type Rpc = { ok: true; value: unknown } | { ok: false; error: { message: string } }
const ok = (v: unknown): Rpc => ({ ok: true, value: v })

function stubInject(over: Partial<YzjPanelInject>): YzjPanelInject {
  return {
    fetchWorkspaces: async () => ok([]),
    fetchDocs: async () => ok([]),
    fetchEvents: async () => ok([]),
    fetchGroups: async () => ok({ list: [], more: false }),
    fetchMessages: async () => ok({ list: [], more: false }),
    fetchWhoami: async () => ok({}),
    fetchSearch: async () => ok([]),
    fetchDoc: async () => ok({}),
    fetchDocBlocks: async () => ok({ data: { blocks: [] } }),
    fetchSheet: async () => ok({}),
    fetchWorkspace: async () => ok({}),
    fetchEvent: async () => ok({}),
    fetchContact: async () => ok([]),
    fetchFileData: async () => ok({}),
    sendMessage: async () => ok({ msgId: 'm1' }),
    uploadFile: async () => ok({ fileId: 'f1' }),
    todoState: async () => ok({ ready: true, library: { link: '' }, todos: [], activeDocId: '' }),
    ensureTodo: async () => ok({ ready: true, library: { link: '' }, todos: [] }),
    createTodo: async () => ok({}),
    toggleTodo: async () => ok({}),
    todoLibraries: async () => ok({ libraries: [], activeDocId: '', teamWorkspaces: [] }),
    selectTodoLibrary: async () => ok({ ready: true, library: {}, todos: [] }),
    ensureTeamTodo: async () => ok({ ready: true, library: {}, todos: [] }),
    fetchWrite: async () => ok({ list: [] }),
    decideWrite: async () => ok({ settled: true }),
    ...over,
  } as YzjPanelInject
}

async function flush(times = 6): Promise<void> {
  for (let i = 0; i < times; i++) await act(async () => { await Promise.resolve() })
}

function clickNamed(container: HTMLElement, name: string): void {
  const button = [...container.querySelectorAll('button')].find(el => (el.textContent ?? '').includes(name))
  expect(button, `button containing "${name}"`).toBeTruthy()
  act(() => { button!.click() })
}

describe('YzjPanel conversation switch', () => {
  it('clears leftover rows and loads only in the right pane, never the global bar', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root: Root = createRoot(container)
    const instance = createYzjStore().create()
    let resolveB!: (value: Rpc) => void
    const pendingB = new Promise<Rpc>(resolve => { resolveB = resolve })
    const groups = [
      { groupId: 'g-switch-a', groupName: '群A', unreadCount: 0 },
      { groupId: 'g-switch-b', groupName: '群B', unreadCount: 0 },
    ]
    putGroupWindow(groups, false)
    const inject = stubInject({
      fetchGroups: async () => ok({ list: groups, more: false }),
      fetchMessages: async (groupId: string) => {
        if (groupId === 'g-switch-b') return pendingB
        return ok({
          list: [{
            msgId: 'ma', content: 'A的话', msgType: 'text',
            sendTime: '2026-08-17 12:00:00.000', fromOpenId: 'u1',
          }],
          more: false,
        })
      },
    })
    instance.actions.setOpen(true)
    instance.actions.setTab('chat')
    instance.actions.setGroups(groups)
    const useStore = <R,>(selector: (state: YzjPanelState) => R): R => selector(instance.getSnapshot())
    act(() => {
      root.render(<YzjPanel {...inject} useStore={useStore} actions={instance.actions} />)
    })
    await flush()
    clickNamed(container, '群A')
    await flush()
    expect(container.textContent).toContain('A的话')
    expect(container.querySelectorAll('[draggable="true"]').length).toBe(0)
    expect(container.textContent).not.toContain('松开以插入')
    clickNamed(container, '群B')
    expect(container.textContent).toContain('群B')
    expect(container.textContent).not.toContain('A的话')
    expect(container.querySelector('[data-testid="yzj-chat-loading"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="yzj-panel-loading"]')).toBeNull()
    await act(async () => {
      resolveB(ok({
        list: [{
          msgId: 'mb', content: 'B的话', msgType: 'text',
          sendTime: '2026-08-17 12:01:00.000', fromOpenId: 'u2',
        }],
        more: false,
      }))
      await Promise.resolve()
    })
    await flush()
    expect(container.textContent).toContain('B的话')
    expect(container.querySelector('[data-testid="yzj-chat-loading"]')).toBeNull()
    act(() => { root.unmount() })
  })
})

describe('YzjPanel docs search (v0.1.4)', () => {
  it('知识库搜索框:Enter 触发 fetchDocSearch,命中行点击开预览', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root: Root = createRoot(container)
    const instance = createYzjStore().create()
    const searches: string[] = []
    const inject = stubInject({
      fetchDocSearch: async (keyword: string) => {
        searches.push(keyword)
        return ok([{ id: 'd1', title: '830纪要·0806 AI参谋产品方案讨论', updateTime: '2026-08-19T10:00:00' }])
      },
      fetchDoc: async () => ok({ title: '830纪要·0806 AI参谋产品方案讨论', fileSuffix: 'otl', updateTime: '2026-08-19' }),
    })
    instance.actions.setOpen(true)
    instance.actions.setTab('docs')
    const useStore = <R,>(selector: (state: YzjPanelState) => R): R => selector(instance.getSnapshot())
    act(() => {
      root.render(<YzjPanel {...inject} useStore={useStore} actions={instance.actions} />)
    })
    await flush()
    const input = container.querySelector('[data-testid="yzj-panel-doc-search"]') as HTMLInputElement
    expect(input).not.toBeNull()
    // React 受控 input:native setter + input 事件才能更新 state
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    act(() => {
      setter.call(input, '830纪要')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    await flush()
    expect(searches).toEqual(['830纪要'])
    const hit = container.querySelector('[data-testid="yzj-panel-doc-hit-d1"]') as HTMLButtonElement
    expect(hit).not.toBeNull()
    expect(hit.textContent).toContain('830纪要·0806')
    act(() => { hit.click() })
    await flush()
    expect(container.textContent).toContain('返回文档')
    act(() => { root.unmount() })
  })
})

describe('YzjPanel workspace type groups (v0.1.4)', () => {
  it('知识库列表按 visibility 分组:个人置顶,企业/团队随后', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root: Root = createRoot(container)
    const instance = createYzjStore().create()
    const inject = stubInject({
      fetchWorkspaces: async () => ok([
        { id: 'kb-e1', name: '费用审核智能体', visibility: 1, docCount: 11, memberCount: 1 },
        { id: 'kb-p1', name: '我的知识', visibility: 2, docCount: 16, memberCount: 1 },
        { id: 'kb-p2', name: 'AI速记知识库', visibility: 2, docCount: 6, memberCount: 1 },
        { id: 'kb-e2', name: '灵基foundation', visibility: 1, docCount: 7, memberCount: 1 },
      ]),
    })
    instance.actions.setOpen(true)
    instance.actions.setTab('docs')
    instance.actions.setWorkspaces([
      { id: 'kb-e1', name: '费用审核智能体', visibility: 1, docCount: 11, memberCount: 1 },
      { id: 'kb-p1', name: '我的知识', visibility: 2, docCount: 16, memberCount: 1 },
      { id: 'kb-p2', name: 'AI速记知识库', visibility: 2, docCount: 6, memberCount: 1 },
      { id: 'kb-e2', name: '灵基foundation', visibility: 1, docCount: 7, memberCount: 1 },
    ])
    const useStore = <R,>(selector: (state: YzjPanelState) => R): R => selector(instance.getSnapshot())
    act(() => {
      root.render(<YzjPanel {...inject} useStore={useStore} actions={instance.actions} />)
    })
    await flush()
    expect(container.querySelector('[data-testid="yzj-panel-ws-group-personal"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="yzj-panel-ws-group-enterprise"]')).not.toBeNull()
    // 个人组整体在企业组之前(与数据源顺序无关)
    const text = container.textContent ?? ''
    const personalAt = text.indexOf('我的知识')
    const enterpriseAt = text.indexOf('费用审核智能体')
    expect(personalAt).toBeGreaterThanOrEqual(0)
    expect(enterpriseAt).toBeGreaterThan(personalAt)
    act(() => { root.unmount() })
  })
})
