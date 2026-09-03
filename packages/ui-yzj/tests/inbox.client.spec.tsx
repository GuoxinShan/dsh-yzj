// @vitest-environment jsdom
/**
 * IM inbox: pinned assistants + Yunzhijia recent; no folder tree copy.
 */
import { act } from 'react-dom/test-utils'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { YzjInbox } from '../src/client/inbox.tsx'
import { getImSelection, resetImSelection } from '../src/client/im-nav.ts'
import type { YzjPanelInject } from '../src/client/rpc.ts'

type Rpc = { ok: true; value: unknown } | { ok: false; error: { message: string } }

function fakePanel(over: Partial<YzjPanelInject> = {}): YzjPanelInject {
  return {
    fetchGroups: async () => ({
      ok: true,
      value: { list: [{ groupId: 'g-prod', groupName: '灵基Chat · 产品群', lastMsg: { content: '这版下午发' } }] },
    }),
    assistantsList: async () => ({
      ok: true,
      value: { assistants: [{ id: 'default', name: '助手' }] },
    }),
    ...over,
  } as unknown as YzjPanelInject
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('YzjInbox', () => {
  afterEach(() => { resetImSelection() })

  it('lists the factory assistant and recent Yunzhijia groups', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root: Root = createRoot(container)
    act(() => { root.render(<YzjInbox panel={fakePanel()} />) })
    await flush()
    expect(container.textContent).toContain('助手')
    expect(container.textContent).toContain('灵基Chat · 产品群')
    expect(container.querySelector('[data-testid="yzj-inbox-assistant-default"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="yzj-inbox-group-g-prod"]')).not.toBeNull()
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="yzj-inbox-group-g-prod"]')?.click()
    })
    expect(getImSelection()).toEqual({ kind: 'group', groupId: 'g-prod', groupName: '灵基Chat · 产品群' })
    act(() => { root.unmount() })
  })
})
