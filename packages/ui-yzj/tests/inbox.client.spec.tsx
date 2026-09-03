// @vitest-environment jsdom
/**
 * IM inbox: sectioned list, headerUrl avatars, 新建助手 on the inbox itself.
 */
import { act } from 'react-dom/test-utils'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { YzjInbox } from '../src/client/inbox.tsx'
import { getImSelection, resetImSelection } from '../src/client/im-nav.ts'
import type { YzjPanelInject } from '../src/client/rpc.ts'

function fakePanel(over: Partial<YzjPanelInject> = {}): YzjPanelInject {
  return {
    fetchGroups: async () => ({
      ok: true,
      value: {
        list: [
          { groupId: 'g-ops', groupName: '灵基全员运营群', groupType: 1, headerUrl: 'https://img.test/ops.png', lastMsg: { content: '运营同步' } },
          { groupId: 'BOT-chen', groupName: '陈炳坤', groupType: 2, photoUrl: 'https://img.test/chen.png', lastMsg: { content: '在吗' } },
          { groupId: 'pubacc-notice', groupName: '公司发文', groupType: 3, headerUrl: 'https://img.test/pub.png', lastMsg: { content: '通知' } },
          { groupId: 'g-jinna', groupName: '【金钠财报】测试环境', groupType: 4, lastMsg: { content: '财报' } },
          { groupId: 'g-todo', groupName: '待办通知', groupType: 5, lastMsg: { content: '你有一条待办' } },
        ],
      },
    }),
    assistantsList: async () => ({
      ok: true,
      value: { assistants: [{ id: 'default', name: '助手' }] },
    }),
    assistantsCreate: async (name) => ({
      ok: true,
      value: { assistant: { id: 'a-research', name } },
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

  it('sections recent rows and paints headerUrl images', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root: Root = createRoot(container)
    act(() => { root.render(<YzjInbox panel={fakePanel()} />) })
    await flush()

    expect(container.querySelector('[data-testid="yzj-inbox-section-assistants"]')?.textContent).toContain('助手')
    expect(container.querySelector('[data-testid="yzj-inbox-section-dm"]')?.textContent).toContain('陈炳坤')
    expect(container.querySelector('[data-testid="yzj-inbox-section-group"]')?.textContent).toContain('灵基全员运营群')
    const sub = container.querySelector('[data-testid="yzj-inbox-section-sub"]')?.textContent ?? ''
    expect(sub).toContain('公司发文')
    expect(sub).toContain('【金钠财报】')
    expect(sub).toContain('待办通知')
    expect(container.querySelector('[data-testid="yzj-inbox-section-group"]')?.textContent).not.toContain('待办通知')

    const opsImg = container.querySelector('[data-testid="yzj-inbox-group-g-ops"] img')
    expect(opsImg?.getAttribute('src')).toBe('https://img.test/ops.png')
    expect(opsImg?.getAttribute('referrerpolicy') ?? opsImg?.getAttribute('referrerPolicy')).toBe('no-referrer')
    const chenImg = container.querySelector('[data-testid="yzj-inbox-group-BOT-chen"] img')
    expect(chenImg?.getAttribute('src')).toBe('https://img.test/chen.png')

    act(() => { root.unmount() })
  })

  it('creates an assistant from the inbox header and selects the new row', async () => {
    const created: string[] = []
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root: Root = createRoot(container)
    act(() => {
      root.render(<YzjInbox panel={fakePanel({
        assistantsCreate: async (name) => {
          created.push(name)
          return { ok: true, value: { assistant: { id: 'a-research', name } } }
        },
        assistantsList: async () => ({
          ok: true,
          value: created.length === 0
            ? { assistants: [{ id: 'default', name: '助手' }] }
            : { assistants: [{ id: 'default', name: '助手' }, { id: 'a-research', name: '研究助手' }] },
        }),
      })} />)
    })
    await flush()
    expect(container.querySelector('[data-testid="yzj-inbox-create"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="yzj-inbox-create-hint"]')).not.toBeNull()
    act(() => { container.querySelector<HTMLButtonElement>('[data-testid="yzj-inbox-create"]')?.click() })
    act(() => {
      const input = container.querySelector<HTMLInputElement>('[data-testid="yzj-inbox-create-name"]')
      if (input === null) return
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, '研究助手')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="yzj-inbox-create-submit"]')?.click()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(created).toEqual(['研究助手'])
    expect(getImSelection()).toEqual({ kind: 'assistant', assistantId: 'a-research' })
    expect(container.querySelector('[data-testid="yzj-inbox-assistant-a-research"]')?.textContent).toContain('研究助手')
    act(() => { root.unmount() })
  })
})
