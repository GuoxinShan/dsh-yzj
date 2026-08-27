// @vitest-environment jsdom
/**
 * Room shell: session list sits beside the timeline.
 */
import { act } from 'react-dom/test-utils'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { YzjRoomShell } from '../src/client/room-shell.tsx'
import { getWorkbenchDomain, requestImGroupFocus, setWorkbenchDomain } from '../src/client/workbench-domain.ts'
import { clearImSeat, peekImSeat } from '../src/client/im-seat.ts'

describe('YzjRoomShell', () => {
  afterEach(() => {
    setWorkbenchDomain('im')
    clearImSeat()
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
    expect(container.querySelector('[data-testid="yzj-room-shell"]')?.getAttribute('data-workbench-domain')).toBe('im')
    expect(container.querySelector('[data-testid="yzj-workbench-tabs"]')?.textContent).toContain('日程')
    expect(container.querySelector('[data-testid="yzj-workbench-tab-chat"]')?.getAttribute('aria-selected')).toBe('true')
    expect(container.querySelector('[data-testid="yzj-workbench-tab-todo"]')).toBeNull()
    expect(container.querySelector('[data-testid="yzj-workbench-tab-calendar"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="yzj-workbench-tab-docs"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="yzj-workbench-tab-advance"]')).toBeNull()
    expect(container.querySelector('[data-testid="yzj-workbench-tabs"]')?.textContent).not.toContain('推进')
    expect(container.querySelector('[data-testid="yzj-workbench-tabs"]')?.textContent).not.toContain('待办')
    expect(container.querySelector('[data-testid="yzj-conv-list"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="yzj-fused-stream"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="yzj-room-composer-host"]')).not.toBeNull()
    expect(container.textContent).toContain('测试群')
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
    const calendar = container.querySelector('[data-testid="yzj-workbench-tab-calendar"]') as HTMLButtonElement
    await act(async () => { calendar.click(); await Promise.resolve() })
    expect(getWorkbenchDomain()).toBe('calendar')
    expect(container.querySelector('[data-testid="yzj-room-shell"]')?.getAttribute('data-workbench-domain')).toBe('calendar')
    expect(calendar.getAttribute('aria-selected')).toBe('true')
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

  it('overlay with no seat never sends an empty home-fused payload (pitfall-039)', async () => {
    clearImSeat()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const calls: Array<[string, string | undefined]> = []
    act(() => {
      root.render(
        <YzjRoomShell
          overlay
          sessionId=""
          homeFused={async (id, groupId) => {
            calls.push([id, groupId])
            return { ok: true, value: { bound: false, kind: 'unbound', items: [] } }
          }}
          homeBackfill={async () => ({ ok: true, value: { appended: 0, skipped: 0 } })}
          homeNav={async () => ({ ok: true, value: { rooms: [] } })}
          fetchGroups={async () => ({ ok: true, value: { list: [], more: false } })}
        />,
      )
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(calls).toEqual([])
    expect(container.textContent).toContain('在左侧选择一个群开始。')
    act(() => { root.unmount() })
  })

  it('imGroupFocus retargets the overlay timeline to the group', async () => {
    clearImSeat()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const calls: Array<[string, string | undefined]> = []
    act(() => {
      root.render(
        <YzjRoomShell
          overlay
          sessionId=""
          homeFused={async (id, groupId) => {
            calls.push([id, groupId])
            return {
              ok: true,
              value: {
                bound: true,
                kind: 'room',
                binding: { yzjConversationId: groupId ?? '', dshSessionId: '', yzjKind: 'group' },
                topics: [],
                items: [
                  { kind: 'im', time: 1, entry: { msgId: 'm1', sentAt: 1, fromName: '同事', content: '跳转目标群消息', origin: 'inbound', isSelf: false, status: 'acked' } },
                ],
              },
            }
          }}
          homeBackfill={async () => ({ ok: true, value: { appended: 0, skipped: 0 } })}
          homeNav={async () => ({ ok: true, value: { rooms: [] } })}
          fetchGroups={async () => ({ ok: true, value: { list: [], more: false } })}
        />,
      )
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(calls).toEqual([])
    act(() => { requestImGroupFocus('g-focus') })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(calls.some(([, groupId]) => groupId === 'g-focus')).toBe(true)
    expect(peekImSeat()?.groupId).toBe('g-focus')
    expect(container.textContent).toContain('跳转目标群消息')
    act(() => { root.unmount() })
  })

  it('anchored imGroupFocus scrolls the timeline onto the anchor row (决策 39)', async () => {
    clearImSeat()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const scrolled: Element[] = []
    const prevScrollIntoView = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function scrollIntoViewSpy(this: Element) { scrolled.push(this) }
    try {
      act(() => {
        root.render(
          <YzjRoomShell
            overlay
            sessionId=""
            homeFused={async (id, groupId) => ({
              ok: true,
              value: {
                bound: true,
                kind: 'room',
                binding: { yzjConversationId: groupId ?? '', dshSessionId: '', yzjKind: 'group' },
                topics: [],
                items: [
                  { kind: 'im', time: 1, entry: { msgId: 'm-anchor', sentAt: 1, fromName: '同事', content: '锚点消息本体', origin: 'inbound', isSelf: false, status: 'acked' } },
                ],
              },
            })}
            homeBackfill={async () => ({ ok: true, value: { appended: 0, skipped: 0 } })}
            homeNav={async () => ({ ok: true, value: { rooms: [] } })}
            fetchGroups={async () => ({ ok: true, value: { list: [], more: false } })}
          />,
        )
      })
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })
      act(() => { requestImGroupFocus({ groupId: 'g-anchor', anchorMsgId: 'm-anchor' }) })
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
      })
      expect(container.querySelector('[data-testid="yzj-room-row-m-anchor"]')).not.toBeNull()
      expect(scrolled.some(el => el.getAttribute('data-testid') === 'yzj-room-row-m-anchor')).toBe(true)
    } finally {
      Element.prototype.scrollIntoView = prevScrollIntoView
      act(() => { root.unmount() })
    }
  })

  it('anchored jump auto-pages older history when the anchor is outside the first window (决策 39)', async () => {
    clearImSeat()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const backfills: Array<string | undefined> = []
    act(() => {
      root.render(
        <YzjRoomShell
          overlay
          sessionId=""
          homeFused={async (id, groupId) => ({
            ok: true,
            value: {
              bound: true,
              kind: 'room',
              binding: { yzjConversationId: groupId ?? '', dshSessionId: '', yzjKind: 'group' },
              topics: [],
              items: [
                { kind: 'im', time: 1, entry: { msgId: 'm-newest', sentAt: 2, fromName: '同事', content: '最新一条', origin: 'inbound', isSelf: false, status: 'acked' } },
              ],
            },
          })}
          homeBackfill={async (id, opts) => {
            backfills.push(opts?.beforeMsgId)
            // 初次拉取(无 beforeMsgId)云端还有更早;翻页一次后到底。
            return { ok: true, value: { appended: 0, skipped: 0, more: opts?.beforeMsgId === undefined } }
          }}
          homeNav={async () => ({ ok: true, value: { rooms: [] } })}
          fetchGroups={async () => ({ ok: true, value: { list: [], more: false } })}
        />,
      )
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    act(() => { requestImGroupFocus({ groupId: 'g-deep', anchorMsgId: 'm-deep-old' }) })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    // 锚点不在首窗 → 自动以最老一条为 beforeMsgId 翻页;more=false 后停。
    // backfills[0] 是初次 load 的无锚 backfill,自动翻页调用从带 beforeMsgId 的开始。
    const paged = backfills.filter(id => id !== undefined)
    expect(paged.length).toBeGreaterThanOrEqual(1)
    expect(paged[0]).toBe('m-newest')
    act(() => { root.unmount() })
  })
})
