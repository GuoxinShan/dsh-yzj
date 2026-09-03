// @vitest-environment jsdom
/**
 * Inbox portal into the workspaces region (does not occupy the single seat).
 * 消息/会话 switch (I16) must restore the folder tree without dropping selection.
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

describe('mountInbox', () => {
  let stop: (() => void) | undefined

  afterEach(() => {
    stop?.()
    stop = undefined
    resetImSelection()
    document.body.replaceChildren()
  })

  it('portals the inbox into [data-slot=sidebar.workspaces] and marks IM occupancy', async () => {
    const seat = document.createElement('div')
    seat.setAttribute('data-slot', 'sidebar.workspaces')
    const tree = document.createElement('div')
    tree.textContent = 'folder-tree'
    seat.appendChild(tree)
    document.body.appendChild(seat)
    stop = mountInbox(fakePanel())
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(document.documentElement.hasAttribute('data-dsh-yzj-im')).toBe(true)
    expect(getImSurface()).toBe('im')
    expect(seat.querySelector('[data-yzj-surface-switch]')).not.toBeNull()
    expect(seat.querySelector('[data-yzj-inbox-host]')).not.toBeNull()
    expect(seat.querySelector('[data-testid="yzj-inbox"]')?.textContent).toContain('助手')
    expect(seat.querySelector('[data-yzj-inbox-host]')?.hasAttribute('hidden')).toBe(false)
  })

  it('会话 unsets occupancy, hides inbox, and leaves the folder tree in the seat', async () => {
    const seat = document.createElement('div')
    seat.setAttribute('data-slot', 'sidebar.workspaces')
    const tree = document.createElement('div')
    tree.setAttribute('data-testid', 'folder-tree')
    tree.textContent = 'folder-tree'
    seat.appendChild(tree)
    document.body.appendChild(seat)
    stop = mountInbox(fakePanel())
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    await act(async () => {
      seat.querySelector<HTMLButtonElement>('[data-testid="yzj-surface-session"]')?.click()
    })
    expect(getImSurface()).toBe('session')
    expect(document.documentElement.hasAttribute('data-dsh-yzj-im')).toBe(false)
    expect(seat.querySelector('[data-yzj-inbox-host]')?.hasAttribute('hidden')).toBe(true)
    expect(seat.querySelector('[data-testid="folder-tree"]')?.parentElement).toBe(seat)
    expect(seat.querySelector('[data-yzj-surface-switch]')).not.toBeNull()
    await act(async () => {
      seat.querySelector<HTMLButtonElement>('[data-testid="yzj-surface-im"]')?.click()
    })
    expect(getImSurface()).toBe('im')
    expect(document.documentElement.hasAttribute('data-dsh-yzj-im')).toBe(true)
    expect(seat.querySelector('[data-yzj-inbox-host]')?.hasAttribute('hidden')).toBe(false)
  })

  it('keeps the inbox selection when toggling 消息 / 会话', async () => {
    const seat = document.createElement('div')
    seat.setAttribute('data-slot', 'sidebar.workspaces')
    document.body.appendChild(seat)
    stop = mountInbox(fakePanel())
    await act(async () => {
      await Promise.resolve()
    })
    await act(async () => {
      setImSelection({ kind: 'group', groupId: 'g1', groupName: '销售' })
    })
    await act(async () => {
      seat.querySelector<HTMLButtonElement>('[data-testid="yzj-surface-session"]')?.click()
    })
    await act(async () => {
      seat.querySelector<HTMLButtonElement>('[data-testid="yzj-surface-im"]')?.click()
    })
    expect(getImSelection()).toEqual({ kind: 'group', groupId: 'g1', groupName: '销售' })
    expect(getImSurface()).toBe('im')
  })
})
