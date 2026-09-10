// @vitest-environment jsdom
/**
 * Inbox portal into the workspaces region (does not occupy the single seat).
 * 消息/会话 switch mounts above host「新会话」(I16), not under it.
 */
import { act } from 'react-dom/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { mountInbox } from '../src/client/inbox-mount.tsx'
import {
  getImSelection, getImSurface, resetImSelection, setImSelection,
} from '../src/client/im-nav.ts'
import type { YzjPanelInject } from '../src/client/rpc.ts'

function fakePanel(): YzjPanelInject {
  return {
    fetchGroups: async () => ({ ok: true, value: { list: [] } }),
    assistantsList: async () => ({ ok: true, value: { assistants: [{ id: 'default', name: '助手' }] } }),
  } as unknown as YzjPanelInject
}

/** Sidebar chrome: 新会话 then workspaces seat (matches Oh My DSH / harness). */
function mountSidebarChrome(): { column: HTMLElement; seat: HTMLElement; newSession: HTMLButtonElement } {
  const column = document.createElement('div')
  column.setAttribute('data-pane', 'sidebar')
  const newSession = document.createElement('button')
  newSession.className = 'newSession'
  newSession.textContent = '新会话'
  const seat = document.createElement('div')
  seat.setAttribute('data-slot', 'sidebar.workspaces')
  column.append(newSession, seat)
  document.body.appendChild(column)
  return { column, seat, newSession }
}

describe('mountInbox', () => {
  let stop: (() => void) | undefined

  afterEach(() => {
    stop?.()
    stop = undefined
    resetImSelection()
    document.body.replaceChildren()
  })

  it('portals the inbox into workspaces and places the surface switch above 新会话', async () => {
    const { column, seat, newSession } = mountSidebarChrome()
    const tree = document.createElement('div')
    tree.textContent = 'folder-tree'
    seat.appendChild(tree)
    stop = mountInbox(fakePanel())
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(document.documentElement.hasAttribute('data-dsh-yzj-im')).toBe(true)
    expect(getImSurface()).toBe('im')
    const chrome = column.querySelector('[data-yzj-surface-chrome]')
    expect(chrome).not.toBeNull()
    expect(chrome?.nextElementSibling).toBe(newSession)
    expect(chrome?.querySelector('[data-yzj-surface-switch]')).not.toBeNull()
    expect(seat.querySelector('[data-yzj-inbox-host]')).not.toBeNull()
    expect(seat.querySelector('[data-testid="yzj-inbox"]')?.textContent).toContain('助手')
    expect(seat.querySelector('[data-yzj-inbox-host]')?.hasAttribute('hidden')).toBe(false)
  })

  it('会话 unsets occupancy, hides inbox, and leaves the folder tree in the seat', async () => {
    const { seat } = mountSidebarChrome()
    const tree = document.createElement('div')
    tree.setAttribute('data-testid', 'folder-tree')
    tree.textContent = 'folder-tree'
    seat.appendChild(tree)
    stop = mountInbox(fakePanel())
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    await act(async () => {
      document.querySelector<HTMLButtonElement>('[data-testid="yzj-surface-session"]')?.click()
    })
    expect(getImSurface()).toBe('session')
    expect(document.documentElement.hasAttribute('data-dsh-yzj-im')).toBe(false)
    expect(seat.querySelector('[data-yzj-inbox-host]')?.hasAttribute('hidden')).toBe(true)
    // Keep React tree mounted (CSS hide only) so returning to 消息 is warm.
    expect(seat.querySelector('[data-testid="yzj-inbox"]')).not.toBeNull()
    expect(seat.querySelector('[data-testid="folder-tree"]')?.parentElement).toBe(seat)
    expect(document.querySelector('[data-yzj-surface-switch]')).not.toBeNull()
    await act(async () => {
      document.querySelector<HTMLButtonElement>('[data-testid="yzj-surface-im"]')?.click()
    })
    expect(getImSurface()).toBe('im')
    expect(document.documentElement.hasAttribute('data-dsh-yzj-im')).toBe(true)
    expect(seat.querySelector('[data-yzj-inbox-host]')?.hasAttribute('hidden')).toBe(false)
  })

  it('does not cold-refetch recent groups when toggling 消息 / 会话', async () => {
    const pages: number[] = []
    mountSidebarChrome()
    stop = mountInbox({
      fetchGroups: async (_limit, page = 1) => {
        pages.push(page)
        return {
          ok: true,
          value: {
            list: [{ groupId: 'g-1', groupName: '群一', groupType: 2, lastMsg: { content: 'a' } }],
            more: false,
          },
        }
      },
      assistantsList: async () => ({ ok: true, value: { assistants: [{ id: 'default', name: '助手' }] } }),
    } as unknown as YzjPanelInject)
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    const afterMount = pages.length
    expect(afterMount).toBeGreaterThanOrEqual(1)
    await act(async () => {
      document.querySelector<HTMLButtonElement>('[data-testid="yzj-surface-session"]')?.click()
    })
    await act(async () => {
      document.querySelector<HTMLButtonElement>('[data-testid="yzj-surface-im"]')?.click()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(pages.length).toBe(afterMount)
    expect(document.querySelector('[data-testid="yzj-inbox-group-g-1"]')?.textContent).toContain('群一')
  })

  it('keeps the inbox selection when toggling 消息 / 会话', async () => {
    mountSidebarChrome()
    stop = mountInbox(fakePanel())
    await act(async () => {
      await Promise.resolve()
    })
    await act(async () => {
      setImSelection({ kind: 'group', groupId: 'g1', groupName: '销售' })
    })
    await act(async () => {
      document.querySelector<HTMLButtonElement>('[data-testid="yzj-surface-session"]')?.click()
    })
    await act(async () => {
      document.querySelector<HTMLButtonElement>('[data-testid="yzj-surface-im"]')?.click()
    })
    expect(getImSelection()).toEqual({ kind: 'group', groupId: 'g1', groupName: '销售' })
    expect(getImSurface()).toBe('im')
  })
})
