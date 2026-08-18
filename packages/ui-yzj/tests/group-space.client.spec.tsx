// @vitest-environment jsdom
/**
 * Sidebar-foot 云之家 dock: one entry, no domain buttons, no group tree (R28).
 */
import { act } from 'react-dom/test-utils'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { YzjYunzhijiaDock } from '../src/client/group-space.tsx'
import { topicNavLabel } from '../src/client/conv-list.tsx'
import { clearImSeat, rememberImSeat } from '../src/client/im-seat.ts'
import { getWorkbenchDomain, setWorkbenchDomain } from '../src/client/workbench-domain.ts'

type Rpc = { ok: true; value: unknown } | { ok: false; error: { message: string } }

function mount(nav: Rpc, extra: {
  wide?: boolean
  focused?: string[]
  current?: string
  robotStatus?: () => Promise<Rpc>
  homeNav?: () => Promise<Rpc>
} = {}) {
  const focused = extra.focused ?? []
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(
      <YzjYunzhijiaDock
        wide={extra.wide !== false}
        useSessions={select => select({ current: extra.current ?? '', byId: {} } as never)}
        homeNav={extra.homeNav ?? (async () => nav)}
        focusBoundSession={id => { focused.push(id) }}
        robotStatus={extra.robotStatus ?? (async () => ({ ok: true, value: { channels: [{ connected: true }] } }))}
      />,
    )
  })
  return { container, focused }
}

describe('topicNavLabel', () => {
  it('strips the official-list affix once (legacy prefix and current suffix)', () => {
    expect(topicNavLabel('金蝶最小DSH交流群', '金蝶最小DSH交流群 · 整理接口清单')).toBe('整理接口清单')
    expect(topicNavLabel('金蝶最小DSH交流群', '整理接口清单 · 金蝶最小DSH交流群')).toBe('整理接口清单')
    expect(topicNavLabel('金蝶最小DSH交流群', '整理接口清单')).toBe('整理接口清单')
    expect(topicNavLabel('', '整理接口清单')).toBe('整理接口清单')
  })
})

describe('YzjYunzhijiaDock', () => {
  afterEach(() => {
    clearImSeat()
    setWorkbenchDomain('im')
  })

  it('renders one 云之家 entry and robot status, not a group tree or domain buttons', async () => {
    const { container } = mount({
      ok: true,
      value: {
        rooms: [{
          groupId: 'g-a',
          groupName: '金蝶最小DSH交流群',
          sessionId: 'yzj-home-g-a',
          yzjKind: 'group',
          topics: [{ sessionId: 'yzj-topic-g-a-m1', title: '整理接口清单', source: 'dsh' }],
        }],
      },
    })
    await act(async () => { await Promise.resolve() })
    const text = container.textContent ?? ''
    expect(text).toContain('云之家')
    expect(container.querySelector('[data-testid="yzj-dock-home"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="yzj-dock-chat"]')).toBeNull()
    expect(container.querySelector('[data-testid="yzj-dock-todo"]')).toBeNull()
    expect(container.querySelector('[data-testid="yzj-dock-calendar"]')).toBeNull()
    expect(container.querySelector('[data-testid="yzj-dock-docs"]')).toBeNull()
    expect(text).not.toContain('待办')
    expect(text).not.toContain('日程')
    expect(text).not.toContain('知识库')
    expect(text).not.toContain('记忆')
    expect(container.querySelector('[data-testid="yzj-dock-robot"]')?.getAttribute('title')).toContain('已连接')
    expect(text).not.toContain('💬')
    expect(text).not.toContain('机器人通道')
    expect(text).not.toContain('群空间')
    expect(text).not.toContain('已打开')
    expect(text).not.toContain('整理接口清单')
    expect(container.querySelector('[data-testid="yzj-group-space"]')?.tagName).toBe('NAV')
  })

  it('marks the entry active when already on a room host and tones the robot dot', async () => {
    const { container } = mount({
      ok: true,
      value: {
        rooms: [{
          groupId: 'g-a',
          groupName: '金蝶最小DSH交流群',
          sessionId: 'yzj-home-g-a',
          yzjKind: 'group',
          topics: [],
        }],
      },
    }, { current: 'yzj-home-g-a' })
    await act(async () => { await Promise.resolve() })
    const home = container.querySelector('[data-testid="yzj-dock-home"]') as HTMLButtonElement
    expect(home.className).toMatch(/yzjDockEntryActive/)
    expect(home.getAttribute('aria-pressed')).toBe('true')
    const dot = container.querySelector('[data-testid="yzj-dock-robot"] span')
    expect(dot?.className).toMatch(/DotOk/)
  })

  it('云之家 focuses the first bound room without switching the workbench domain', async () => {
    setWorkbenchDomain('todo')
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
    const home = container.querySelector('[data-testid="yzj-dock-home"]') as HTMLButtonElement
    await act(async () => { home.click(); await Promise.resolve() })
    expect(focused).toEqual(['yzj-home-g-a'])
    expect(getWorkbenchDomain()).toBe('todo')
  })

  it('does not expose a 记忆 dock entry', async () => {
    const { container } = mount({ ok: true, value: { rooms: [] } })
    await act(async () => { await Promise.resolve() })
    expect(container.querySelector('[data-testid="yzj-dock-memory"]')).toBeNull()
    expect(container.textContent).not.toContain('记忆')
  })

  it('skips homeNav when already on a room host and does not change domain', async () => {
    setWorkbenchDomain('calendar')
    let navCalls = 0
    const { container, focused } = mount({ ok: true, value: { rooms: [] } }, {
      current: 'yzj-home-g-a',
      homeNav: async () => {
        navCalls += 1
        return { ok: true, value: { rooms: [] } }
      },
    })
    await act(async () => { await Promise.resolve() })
    const afterMount = navCalls
    const home = container.querySelector('[data-testid="yzj-dock-home"]') as HTMLButtonElement
    await act(async () => { home.click(); await Promise.resolve() })
    expect(navCalls).toBe(afterMount)
    expect(focused).toEqual([])
    expect(getWorkbenchDomain()).toBe('calendar')
  })

  it('focuses the cached seat without waiting for homeNav', async () => {
    rememberImSeat({ groupId: 'g-cached', sessionId: 'yzj-home-cached', groupName: '缓存群' })
    let resolveNav: ((value: Rpc) => void) | undefined
    const { container, focused } = mount({ ok: true, value: { rooms: [] } }, {
      homeNav: () => new Promise<Rpc>(resolve => { resolveNav = resolve }),
    })
    const home = container.querySelector('[data-testid="yzj-dock-home"]') as HTMLButtonElement
    await act(async () => { home.click() })
    expect(focused).toEqual(['yzj-home-cached'])
    resolveNav?.({ ok: true, value: { rooms: [] } })
  })

  it('still renders a compact glyph on the collapsed rail', () => {
    const { container } = mount({ ok: true, value: { rooms: [] } }, { wide: false })
    expect(container.querySelector('[data-testid="yzj-group-space"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="yzj-dock-home"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="yzj-dock-chat"]')).toBeNull()
    expect(container.textContent).not.toContain('云之家')
    expect(container.querySelector('[data-testid="yzj-dock-home"]')?.textContent).toContain('云')
  })
})
