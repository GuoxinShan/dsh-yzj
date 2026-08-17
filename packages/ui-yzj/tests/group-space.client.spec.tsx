// @vitest-environment jsdom
/**
 * Sidebar-foot 云之家 dock: five domain entries, no group tree.
 */
import { act } from 'react-dom/test-utils'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { YzjYunzhijiaDock } from '../src/client/group-space.tsx'
import { topicNavLabel } from '../src/client/conv-list.tsx'

type Rpc = { ok: true; value: unknown } | { ok: false; error: { message: string } }

function mount(nav: Rpc, extra: {
  wide?: boolean
  openPanel?: (target: { kind: string }) => void
  focused?: string[]
  robotStatus?: () => Promise<Rpc>
} = {}) {
  const focused = extra.focused ?? []
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(
      <YzjYunzhijiaDock
        wide={extra.wide !== false}
        useSessions={select => select({ current: '', byId: {} } as never)}
        homeNav={async () => nav}
        focusBoundSession={id => { focused.push(id) }}
        openPanel={extra.openPanel as never}
        robotStatus={extra.robotStatus ?? (async () => ({ ok: true, value: { channels: [{ connected: true }] } }))}
      />,
    )
  })
  return { container, focused }
}

describe('topicNavLabel', () => {
  it('strips the official-list prefix once', () => {
    expect(topicNavLabel('测试群', '测试群 · 整理接口清单')).toBe('整理接口清单')
    expect(topicNavLabel('测试群', '整理接口清单')).toBe('整理接口清单')
  })
})

describe('YzjYunzhijiaDock', () => {
  it('renders the 云之家 entries and robot status, not a group tree', async () => {
    const { container } = mount({
      ok: true,
      value: {
        rooms: [{
          groupId: 'g-a',
          groupName: '测试群',
          sessionId: 'yzj-home-g-a',
          yzjKind: 'group',
          topics: [{ sessionId: 'yzj-topic-g-a-m1', title: '整理接口清单', source: 'dsh' }],
        }],
      },
    })
    await act(async () => { await Promise.resolve() })
    const text = container.textContent ?? ''
    expect(text).toContain('云之家')
    expect(text).toContain('对话')
    expect(text).toContain('待办')
    expect(text).toContain('日程')
    expect(text).toContain('知识库')
    expect(text).toContain('记忆')
    expect(text).toContain('机器人通道 · 已连接')
    expect(text).not.toContain('群空间')
    expect(text).not.toContain('已打开')
    expect(text).not.toContain('整理接口清单')
    expect(container.querySelector('[data-testid="yzj-group-space"]')?.tagName).toBe('NAV')
  })

  it('对话 focuses the first bound room', async () => {
    const { container, focused } = mount({
      ok: true,
      value: {
        rooms: [{
          groupId: 'g-a',
          groupName: '群房间',
          sessionId: 'yzj-home-g-a',
          yzjKind: 'group',
          topics: [],
        }],
      },
    })
    await act(async () => { await Promise.resolve() })
    const chat = container.querySelector('[data-testid="yzj-dock-chat"]') as HTMLButtonElement
    await act(async () => { chat.click(); await Promise.resolve() })
    expect(focused).toEqual(['yzj-home-g-a'])
  })

  it('待办 opens the floating panel todo tab', async () => {
    const opened: string[] = []
    const { container } = mount({ ok: true, value: { rooms: [] } }, {
      openPanel: (target) => { opened.push(target.kind) },
    })
    await act(async () => { await Promise.resolve() })
    const todo = container.querySelector('[data-testid="yzj-dock-todo"]') as HTMLButtonElement
    act(() => { todo.click() })
    expect(opened).toEqual(['todo'])
  })

  it('记忆 notes the local vault and does not open a panel', async () => {
    const opened: string[] = []
    const { container } = mount({ ok: true, value: { rooms: [] } }, {
      openPanel: (target) => { opened.push(target.kind) },
    })
    await act(async () => { await Promise.resolve() })
    const memory = container.querySelector('[data-testid="yzj-dock-memory"]') as HTMLButtonElement
    act(() => { memory.click() })
    expect(opened).toEqual([])
    expect(container.textContent).toContain('本地 vault')
  })

  it('still renders compact glyphs on the collapsed rail', () => {
    const { container } = mount({ ok: true, value: { rooms: [] } }, { wide: false })
    expect(container.querySelector('[data-testid="yzj-group-space"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="yzj-dock-chat"]')).not.toBeNull()
    expect(container.textContent).not.toContain('云之家')
  })
})
