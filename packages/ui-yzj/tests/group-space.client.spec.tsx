// @vitest-environment jsdom
/**
 * Sidebar 云之家 dock: one entry, no domain buttons, no group tree (R31).
 * Click opens the center-column cover without focusing a hanger session.
 */
import { act } from 'react-dom/test-utils'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { YzjYunzhijiaDock } from '../src/client/group-space.tsx'
import { topicNavLabel } from '../src/client/conv-list.tsx'
import { clearImSeat, rememberImSeat } from '../src/client/im-seat.ts'
import { getWorkbenchDomain, setWorkbenchDomain } from '../src/client/workbench-domain.ts'
import { isWorkbenchOpen, resetWorkbenchOverlay } from '../src/client/workbench-overlay.ts'

type Rpc = { ok: true; value: unknown } | { ok: false; error: { message: string } }

function mount(nav: Rpc, extra: {
  wide?: boolean
  focused?: string[]
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
        homeNav={extra.homeNav ?? (async () => nav)}
        focusBoundSession={id => { focused.push(id) }}
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
    resetWorkbenchOverlay()
  })

  it('renders one 云之家 entry, not a group tree or domain buttons', async () => {
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
    expect(container.querySelector('[data-testid="yzj-dock-robot"]')).toBeNull()
    expect(text).not.toContain('待办')
    expect(text).not.toContain('日程')
    expect(text).not.toContain('知识库')
    expect(text).not.toContain('记忆')
    expect(text).not.toContain('群空间')
    expect(text).not.toContain('整理接口清单')
    expect(container.querySelector('[data-testid="yzj-group-space"]')?.tagName).toBe('NAV')
  })

  it('marks the entry active after opening the cover', async () => {
    const { container } = mount({ ok: true, value: { rooms: [] } })
    await act(async () => { await Promise.resolve() })
    const home = container.querySelector('[data-testid="yzj-dock-home"]') as HTMLButtonElement
    expect(home.getAttribute('aria-pressed')).toBe('false')
    await act(async () => { home.click(); await Promise.resolve() })
    expect(home.className).toMatch(/yzjDockEntryActive/)
    expect(home.getAttribute('aria-pressed')).toBe('true')
    expect(isWorkbenchOpen()).toBe(true)
  })

  it('云之家 opens the cover without focusing a hanger or switching domain', async () => {
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
    expect(focused).toEqual([])
    expect(isWorkbenchOpen()).toBe(true)
    expect(getWorkbenchDomain()).toBe('todo')
  })

  it('does not expose a 记忆 dock entry', async () => {
    const { container } = mount({ ok: true, value: { rooms: [] } })
    await act(async () => { await Promise.resolve() })
    expect(container.querySelector('[data-testid="yzj-dock-memory"]')).toBeNull()
    expect(container.textContent).not.toContain('记忆')
  })

  it('does not wait for homeNav before opening the cover', async () => {
    rememberImSeat({ groupId: 'g-cached', sessionId: 'yzj-home-cached', groupName: '缓存群' })
    let resolveNav: ((value: Rpc) => void) | undefined
    const { container, focused } = mount({ ok: true, value: { rooms: [] } }, {
      homeNav: () => new Promise<Rpc>(resolve => { resolveNav = resolve }),
    })
    const home = container.querySelector('[data-testid="yzj-dock-home"]') as HTMLButtonElement
    await act(async () => { home.click() })
    expect(focused).toEqual([])
    expect(isWorkbenchOpen()).toBe(true)
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
