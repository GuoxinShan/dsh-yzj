// @vitest-environment jsdom
/**
 * Room shell: session list sits beside the timeline.
 */
import { act } from 'react-dom/test-utils'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { YzjRoomShell } from '../src/client/room-shell.tsx'
import { getWorkbenchDomain, setWorkbenchDomain } from '../src/client/workbench-domain.ts'

describe('YzjRoomShell', () => {
  afterEach(() => {
    setWorkbenchDomain('im')
  })

  it('renders the conversation list next to the group-room timeline', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    act(() => {
      root.render(
        <YzjRoomShell
          sessionId="yzj-home-g-a"
          homeFused={async () => ({
            ok: true,
            value: {
              bound: true,
              kind: 'room',
              binding: { yzjConversationId: 'g-a', dshSessionId: 'yzj-home-g-a', yzjKind: 'group' },
              topics: [],
              items: [
                { kind: 'im', time: 1, entry: { msgId: 'm1', sentAt: 1, fromName: '同事', content: '群里一句', origin: 'inbound', isSelf: false, status: 'acked' } },
              ],
            },
          })}
          homeBackfill={async () => ({ ok: true, value: { appended: 0, skipped: 0 } })}
          homeNav={async () => ({ ok: true, value: { rooms: [] } })}
          fetchGroups={async () => ({
            ok: true,
            value: { list: [{ groupId: 'g-a', groupName: '金蝶最小DSH交流群', lastMsg: { content: '群里一句' } }], more: false },
          })}
        />,
      )
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(container.querySelector('[data-testid="yzj-room-shell"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="yzj-room-shell"]')?.getAttribute('data-workbench-domain')).toBe('im')
    expect(container.querySelector('[data-testid="yzj-workbench-tabs"]')?.textContent).toContain('日程')
    expect(container.querySelector('[data-testid="yzj-workbench-tab-chat"]')?.getAttribute('aria-selected')).toBe('true')
    expect(container.querySelector('[data-testid="yzj-workbench-tab-todo"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="yzj-workbench-tab-calendar"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="yzj-workbench-tab-docs"]')).not.toBeNull()
    // v1.18: the AI推进 board is the fifth tab (ai-advance-design §7).
    expect(container.querySelector('[data-testid="yzj-workbench-tab-advance"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="yzj-workbench-tabs"]')?.textContent).toContain('推进')
    expect(container.querySelector('[data-testid="yzj-conv-list"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="yzj-fused-stream"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="yzj-room-composer-host"]')).not.toBeNull()
    expect(container.textContent).toContain('金蝶最小DSH交流群')
    expect(container.textContent).toContain('群里一句')
  })

  it('workbench tabs switch the domain without a sidebar dock', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    act(() => {
      root.render(
        <YzjRoomShell
          sessionId="yzj-home-g-a"
          homeFused={async () => ({
            ok: true,
            value: {
              bound: true,
              kind: 'room',
              binding: { yzjConversationId: 'g-a', dshSessionId: 'yzj-home-g-a', yzjKind: 'group' },
              topics: [],
              items: [],
            },
          })}
          homeBackfill={async () => ({ ok: true, value: { appended: 0, skipped: 0 } })}
          homeNav={async () => ({ ok: true, value: { rooms: [] } })}
        />,
      )
    })
    await act(async () => { await Promise.resolve() })
    const todo = container.querySelector('[data-testid="yzj-workbench-tab-todo"]') as HTMLButtonElement
    await act(async () => { todo.click(); await Promise.resolve() })
    expect(getWorkbenchDomain()).toBe('todo')
    expect(container.querySelector('[data-testid="yzj-room-shell"]')?.getAttribute('data-workbench-domain')).toBe('todo')
    expect(todo.getAttribute('aria-selected')).toBe('true')
    expect(container.querySelector('[data-testid="yzj-workbench-tab-chat"]')?.getAttribute('aria-selected')).toBe('false')
    // No panel inject in this mount → IM columns stay as the fallback canvas.
    expect(container.querySelector('[data-testid="yzj-conv-list"]')).not.toBeNull()
    act(() => { root.unmount() })
  })

  it('does not mount the IM workbench on a topic or ordinary session', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const fused = {
      ok: true as const,
      value: {
        bound: true,
        kind: 'topic',
        binding: { yzjConversationId: 'g-a', dshSessionId: 'yzj-home-g-a', yzjKind: 'group' },
        topics: [],
        items: [
          { kind: 'im', time: 1, entry: { msgId: 'm1', sentAt: 1, fromName: '同事', content: '群里一句', origin: 'inbound', isSelf: false, status: 'acked' } },
        ],
      },
    }
    const empty = {
      homeFused: async () => fused,
      homeBackfill: async () => ({ ok: true as const, value: { appended: 0, skipped: 0 } }),
      homeNav: async () => ({ ok: true as const, value: { rooms: [] } }),
    }
    act(() => {
      root.render(<YzjRoomShell sessionId="yzj-topic-g-a-root" {...empty} />)
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(container.querySelector('[data-testid="yzj-room-shell"]')).toBeNull()
    expect(container.querySelector('[data-testid="yzj-conv-list"]')).toBeNull()
    expect(container.textContent).not.toContain('群里一句')

    act(() => {
      root.render(<YzjRoomShell sessionId="sess-coding" {...empty} />)
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(container.querySelector('[data-testid="yzj-room-shell"]')).toBeNull()
    act(() => { root.unmount() })
  })

  it('paints the workbench in overlay mode without a hanger session', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    act(() => {
      root.render(
        <YzjRoomShell
          overlay
          sessionId=""
          homeFused={async () => ({
            ok: true,
            value: {
              bound: true,
              kind: 'room',
              binding: { yzjConversationId: 'g-a', dshSessionId: '', yzjKind: 'group' },
              topics: [],
              items: [
                { kind: 'im', time: 1, entry: { msgId: 'm1', sentAt: 1, fromName: '同事', content: '群里一句', origin: 'inbound', isSelf: false, status: 'acked' } },
              ],
            },
          })}
          homeBackfill={async () => ({ ok: true, value: { appended: 0, skipped: 0 } })}
          homeNav={async () => ({ ok: true, value: { rooms: [] } })}
          fetchGroups={async () => ({
            ok: true,
            value: { list: [{ groupId: 'g-a', groupName: '金蝶最小DSH交流群' }], more: false },
          })}
        />,
      )
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(container.querySelector('[data-testid="yzj-room-shell"]')).not.toBeNull()
    expect(container.textContent).toContain('金蝶最小DSH交流群')
    act(() => { root.unmount() })
  })
})
