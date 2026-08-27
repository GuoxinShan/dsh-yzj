// @vitest-environment jsdom
/**
 * Regression probe: mounting YzjPanel and toggling open must not throw the
 * hooks-order React error #310 seen in the browser after the scroll change.
 */
import { act } from 'react-dom/test-utils'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { YzjPanel } from '../src/client/panel.tsx'
import { createYzjStore } from '../src/client/stores.ts'
import type { YzjPanelInject } from '../src/client/rpc.ts'

type Rpc = { ok: true; value: unknown } | { ok: false; error: { message: string } }
const ok = (v: unknown): Rpc => ({ ok: true, value: v })

function mountPanel(): { container: HTMLDivElement } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const instance = createYzjStore().create()
  const inject = {
    fetchWorkspaces: async () => ok([]),
    fetchDocs: async () => ok([]),
    fetchEvents: async () => ok([]),
    fetchGroups: async () => ok({ list: [], more: false }),
    fetchMessages: async () => ok({ list: [], more: false }),
    fetchWhoami: async () => ok({}),
    fetchSearch: async () => ok([]),
    fetchDoc: async () => ok({}),
    fetchDocBlocks: async () => ok({ data: { blocks: [] } }),
    fetchSheet: async () => ok({}),
    fetchWorkspace: async () => ok({}),
    fetchEvent: async () => ok({}),
    fetchContact: async () => ok([]),
    fetchFileData: async () => ok({}),
    sendMessage: async () => ok({ msgId: 'm1' }),
    uploadFile: async () => ok({ fileId: 'f1' }),
    imCacheGet: async () => ok(null),
    imCachePut: async () => ok(true),
    fetchWrite: async () => ok({ list: [] }),
    decideWrite: async () => ok({ settled: true }),
  } as unknown as YzjPanelInject
  const props = { ...inject, useStore: instance.getSnapshot, actions: instance.actions } as never
  // Render closed, then open, then switch through every tab — the exact
  // sequence that crashed in the browser.
  act(() => { root.render(<YzjPanel {...props} />) })
  act(() => { instance.actions.setOpen(true) })
  for (const tab of ['chat', 'calendar', 'docs'] as const) {
    act(() => { instance.actions.setTab(tab) })
  }
  act(() => { instance.actions.setOpen(false) })
  act(() => { instance.actions.setOpen(true) })
  return { container }
}

describe('YzjPanel hooks-order regression (#310)', () => {
  it('mounts, opens, walks tabs, closes, reopens without a hooks error', () => {
    expect(() => mountPanel()).not.toThrow()
  })

  it('restored open chat state (persisted store) mounts cleanly', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const instance = createYzjStore().create()
    // The browser crash reproduced with a RESTORED store: open + chat tab +
    // a selected group + messages already present.
    const msg = { msgId: 'm1', content: 'x', msgType: 'text', sendTime: '2026-08-16 03:00:00.000', fromOpenId: 'u1' }
    instance.actions.setOpen(true)
    instance.actions.setTab('chat')
    instance.actions.setGroupId('g1')
    instance.actions.setGroups([{ groupId: 'g1', groupName: '群', unreadCount: 1 }])
    instance.actions.setMessages([msg])
    instance.actions.setMessagesMore(true)
    const inject = {
      fetchWorkspaces: async () => ok([]),
      fetchDocs: async () => ok([]),
      fetchEvents: async () => ok([]),
      fetchGroups: async () => ok({ list: [{ groupId: 'g1', groupName: '群', unreadCount: 1 }], more: false }),
      fetchMessages: async () => ok({ list: [msg], more: true }),
      fetchWhoami: async () => ok({ openId: 'me' }),
      fetchSearch: async () => ok([]),
      fetchDoc: async () => ok({}),
      fetchDocBlocks: async () => ok({ data: { blocks: [] } }),
      fetchSheet: async () => ok({}),
      fetchWorkspace: async () => ok({}),
      fetchEvent: async () => ok({}),
      fetchContact: async () => ok([]),
      fetchFileData: async () => ok({}),
      sendMessage: async () => ok({ msgId: 'm2' }),
      uploadFile: async () => ok({ fileId: 'f1' }),
      imCacheGet: async () => ok(null),
      imCachePut: async () => ok(true),
      fetchWrite: async () => ok({ list: [] }),
      decideWrite: async () => ok({ settled: true }),
    } as unknown as YzjPanelInject
    const props = { ...inject, useStore: instance.getSnapshot, actions: instance.actions } as never
    expect(() => {
      act(() => { root.render(<YzjPanel {...props} />) })
    }).not.toThrow()
  })
})
