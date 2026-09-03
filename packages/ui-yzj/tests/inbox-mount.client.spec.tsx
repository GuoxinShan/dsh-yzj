// @vitest-environment jsdom
/**
 * Inbox portal into the workspaces region (does not occupy the single seat).
 */
import { act } from 'react-dom/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { mountInbox } from '../src/client/inbox-mount.tsx'
import { resetImSelection } from '../src/client/im-nav.ts'
import type { YzjPanelInject } from '../src/client/rpc.ts'

describe('mountInbox', () => {
  afterEach(() => { resetImSelection() })

  it('portals the inbox into [data-slot=sidebar.workspaces] and marks IM occupancy', async () => {
    const seat = document.createElement('div')
    seat.setAttribute('data-slot', 'sidebar.workspaces')
    const tree = document.createElement('div')
    tree.textContent = 'folder-tree'
    seat.appendChild(tree)
    document.body.appendChild(seat)
    const panel = {
      fetchGroups: async () => ({ ok: true, value: { list: [] } }),
      assistantsList: async () => ({ ok: true, value: { assistants: [{ id: 'default', name: '助手' }] } }),
    } as unknown as YzjPanelInject
    const stop = mountInbox(panel)
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(document.documentElement.hasAttribute('data-dsh-yzj-im')).toBe(true)
    expect(seat.querySelector('[data-yzj-inbox-host]')).not.toBeNull()
    expect(seat.querySelector('[data-testid="yzj-inbox"]')?.textContent).toContain('助手')
    stop()
    expect(seat.querySelector('[data-yzj-inbox-host]')).toBeNull()
  })
})
