// @vitest-environment jsdom
/**
 * Workbench conversation list: L1 merge + load-more + click opens a room.
 */
import { act } from 'react-dom/test-utils'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildConvRows, clearConvListHold, YzjConvList } from '../src/client/conv-list.tsx'

describe('buildConvRows', () => {
  it('prefixes 话题· when topic activity is newer than the last group message', () => {
    const rows = buildConvRows(
      [{
        groupId: 'g-a',
        groupName: '测试群',
        lastMsg: { content: '群里一句' },
        lastMsgSendTime: '2026-08-17 10:00:00',
      }],
      [{
        groupId: 'g-a',
        sessionId: 'yzj-home-g-a',
        groupName: '测试群',
        yzjKind: 'group',
        topics: [{ sessionId: 'yzj-topic-1', title: '整理接口', lastActivity: Date.parse('2026-08-17T12:00:00'), status: 'running' }],
      }],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.preview).toBe('话题·整理接口')
    expect(rows[0]?.topicCount).toBe(1)
    expect(rows[0]?.opened).toBe(true)
    expect(rows[0]?.hasRunning).toBe(true)
    expect(rows[0]?.confirmCount).toBe(0)
  })

  it('keeps the group preview when the group message is newer', () => {
    const rows = buildConvRows(
      [{
        groupId: 'g-a',
        groupName: '群A',
        lastMsg: { content: '最新群消息' },
        lastMsgSendTime: '2026-08-17 18:00:00',
      }],
      [{
        groupId: 'g-a',
        sessionId: 'yzj-home-g-a',
        groupName: '群A',
        yzjKind: 'group',
        topics: [{ sessionId: 'yzj-topic-1', title: '旧话题', lastActivity: Date.parse('2026-08-17T10:00:00'), status: 'running' }],
      }],
    )
    expect(rows[0]?.preview).toBe('最新群消息')
  })

  it('L2 badge prefers confirm count over the running dot', () => {
    const rows = buildConvRows(
      [{
        groupId: 'g-a',
        groupName: '群A',
        lastMsg: { content: '群里一句' },
        lastMsgSendTime: '2026-08-17 10:00:00',
      }],
      [{
        groupId: 'g-a',
        sessionId: 'yzj-home-g-a',
        groupName: '群A',
        yzjKind: 'group',
        topics: [
          { sessionId: 'yzj-topic-1', title: '待确认', lastActivity: 2, status: 'confirm' },
          { sessionId: 'yzj-topic-2', title: '进行中', lastActivity: 1, status: 'running' },
          { sessionId: 'yzj-topic-3', title: '已完成', lastActivity: 0, status: 'done' },
        ],
      }],
    )
    expect(rows[0]?.confirmCount).toBe(1)
    expect(rows[0]?.hasRunning).toBe(true)
    expect(rows[0]?.preview).toBe('群里一句')
  })

  it('does not let a 群房间 placeholder override the CLI group name', () => {
    const rows = buildConvRows(
      [{
        groupId: 'g-a',
        groupName: '测试群',
        lastMsg: { content: '群里一句' },
        lastMsgSendTime: '2026-08-17 10:00:00',
      }],
      [{
        groupId: 'g-a',
        sessionId: 'yzj-home-g-a',
        groupName: '群房间',
        yzjKind: 'group',
        topics: [],
      }],
    )
    expect(rows[0]?.groupName).toBe('测试群')
  })
})

describe('YzjConvList', () => {
  beforeEach(() => {
    clearConvListHold()
  })
  afterEach(() => {
    clearConvListHold()
  })

  it('lists recent conversations and load-more, click binds', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const opened: string[] = []
    act(() => {
      root.render(
        <YzjConvList
          sessionId="yzj-home-g-a"
          homeNav={async () => ({ ok: true, value: { rooms: [] } })}
          homeOpen={async (groupId) => {
            opened.push(groupId)
            return { ok: true, value: { sessionId: `yzj-home-${groupId}` } }
          }}
          fetchGroups={async (_limit, page) => ({
            ok: true,
            value: page === 2
              ? { list: [{ groupId: 'g-b', groupName: '第二页群', lastMsg: { content: 'b' }, lastMsgSendTime: '2026-08-16 10:00:00' }], more: false }
              : { list: [{ groupId: 'g-recent', groupName: '最近群', lastMsg: { content: 'hi' }, lastMsgSendTime: '2026-08-17 10:00:00' }], more: true },
          })}
          focusBoundSession={() => undefined}
        />,
      )
    })
    await act(async () => { await Promise.resolve() })
    await act(async () => { await Promise.resolve() })
    expect(container.textContent).toContain('最近群')
    const more = container.querySelector('[data-testid="yzj-conv-more"]') as HTMLButtonElement
    expect(more).toBeDefined()
    await act(async () => { more.click(); await Promise.resolve() })
    expect(container.textContent).toContain('第二页群')
    const recent = container.querySelector('[data-testid="yzj-conv-row-g-recent"]') as HTMLButtonElement
    await act(async () => { recent.click(); await Promise.resolve() })
    expect(opened).toEqual(['g-recent'])
  })

  it('keeps recent rows on remount before fetchGroups returns (pitfall-013)', async () => {
    const groups = {
      ok: true as const,
      value: {
        list: [{ groupId: 'g-hold', groupName: '缓存群', lastMsg: { content: 'hi' }, lastMsgSendTime: '2026-08-17 10:00:00' }],
        more: false,
      },
    }
    const first = document.createElement('div')
    document.body.appendChild(first)
    const root = createRoot(first)
    act(() => {
      root.render(
        <YzjConvList
          sessionId="yzj-home-g-a"
          homeNav={async () => ({ ok: true, value: { rooms: [] } })}
          fetchGroups={async () => groups}
        />,
      )
    })
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(first.textContent).toContain('缓存群')
    act(() => { root.unmount() })

    let finish: ((value: typeof groups) => void) | undefined
    const pending = new Promise<typeof groups>(resolve => { finish = resolve })
    const second = document.createElement('div')
    document.body.appendChild(second)
    const root2 = createRoot(second)
    act(() => {
      root2.render(
        <YzjConvList
          sessionId="yzj-home-g-b"
          homeNav={async () => ({ ok: true, value: { rooms: [] } })}
          fetchGroups={async () => pending}
        />,
      )
    })
    expect(second.textContent).toContain('缓存群')
    await act(async () => { finish?.(groups); await Promise.resolve() })
    act(() => { root2.unmount() })
  })
})
