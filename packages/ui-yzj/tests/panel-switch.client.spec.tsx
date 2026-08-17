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
