// @vitest-environment jsdom
/**
 * Room shell: session list sits beside the timeline.
 */
import { act } from 'react-dom/test-utils'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { YzjRoomShell } from '../src/client/room-shell.tsx'

describe('YzjRoomShell', () => {
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
            value: { list: [{ groupId: 'g-a', groupName: '测试群', lastMsg: { content: '群里一句' } }], more: false },
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
    expect(container.querySelector('[data-testid="yzj-workbench-tabs"]')?.textContent).toContain('日程')
    expect(container.querySelector('[data-testid="yzj-conv-list"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="yzj-fused-stream"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="yzj-room-composer-host"]')).not.toBeNull()
    expect(container.textContent).toContain('测试群')
    expect(container.textContent).toContain('群里一句')
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
            value: { list: [{ groupId: 'g-a', groupName: '测试群' }], more: false },
          })}
        />,
      )
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(container.querySelector('[data-testid="yzj-room-shell"]')).not.toBeNull()
    expect(container.textContent).toContain('测试群')
    act(() => { root.unmount() })
  })
})
