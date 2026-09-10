// @vitest-environment jsdom
/**
 * IM inbox: default fused recent list + optional grouped sections;
 * headerUrl avatars; 新建助手 on the inbox itself.
 */
import { act } from 'react-dom/test-utils'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearInboxSnapshot, buildFusedRows, YzjInbox } from '../src/client/inbox.tsx'
import { clearGroupWindow, putGroupWindow } from '../src/client/im-cache.ts'
import { getImSelection, resetImSelection } from '../src/client/im-nav.ts'
import type { YzjPanelInject } from '../src/client/rpc.ts'

const LAYOUT_KEY = 'dsh-yzj-inbox-layout'

function fakePanel(over: Partial<YzjPanelInject> = {}): YzjPanelInject {
  return {
    fetchGroups: async () => ({
      ok: true,
      value: {
        list: [
          { groupId: 'g-ops', groupName: '灵基全员运营群', groupType: 2, headerUrl: 'https://img.test/ops.png', lastMsg: { content: '运营同步' }, lastMsgSendTime: '2026-09-10 12:00:00' },
          { groupId: 'u-chen', groupName: '陈炳坤', groupType: 1, photoUrl: 'https://img.test/chen.png', lastMsg: { content: '在吗' }, lastMsgSendTime: '2026-09-10 11:00:00' },
          { groupId: 'pubacc-notice', groupName: '公司发文', groupType: 3, headerUrl: 'https://img.test/pub.png', lastMsg: { content: '通知' } },
          { groupId: 'g-jinna', groupName: '【金钠财报】测试环境', groupType: 4, lastMsg: { content: '财报' } },
          { groupId: 'g-todo', groupName: '待办通知', groupType: 8, lastMsg: { content: '你有一条待办' } },
        ],
        more: false,
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
    assistantProjection: async () => ({
      ok: true,
      value: { bubbles: [{ role: 'assistant', text: '有什么可以帮你', at: Date.parse('2026-09-10T10:00:00') }] },
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

describe('buildFusedRows', () => {
  it('interleaves assistants and rooms by activity and skips subscriptions', () => {
    const rows = buildFusedRows(
      [{ id: 'default', name: '助手' }],
      new Map([['default', { preview: 'hello', at: 200 }]]),
      [
        { groupId: 'g-ops', groupName: '运营群', lastMsg: { content: 'x' }, lastMsgSendTime: 300, groupType: 2 },
        { groupId: 'u-chen', groupName: '陈', lastMsg: { content: 'y' }, lastMsgSendTime: 100, groupType: 1 },
        { groupId: 'pub', groupName: '订阅', lastMsg: { content: 'z' }, lastMsgSendTime: 999, groupType: 3 },
      ],
    )
    expect(rows.map(row => row.kind === 'assistant' ? row.id : row.room.groupId)).toEqual(['g-ops', 'default', 'u-chen'])
  })
})

describe('YzjInbox', () => {
  beforeEach(() => {
    localStorage.removeItem(LAYOUT_KEY)
    clearInboxSnapshot()
    clearGroupWindow()
  })
  afterEach(() => {
    resetImSelection()
    localStorage.removeItem(LAYOUT_KEY)
    clearInboxSnapshot()
    clearGroupWindow()
  })

  it('defaults to fused recent list with subscriptions sunk', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root: Root = createRoot(container)
    act(() => { root.render(<YzjInbox panel={fakePanel()} />) })
    await flush()

    expect(container.querySelector('[data-yzj-inbox-layout="mixed"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="yzj-inbox-section-assistants"]')).toBeNull()
    expect(container.querySelector('[data-testid="yzj-inbox-section-dm"]')).toBeNull()
    expect(container.querySelector('[data-testid="yzj-inbox-section-group"]')).toBeNull()
    expect(container.querySelector('[data-testid="yzj-inbox-fused"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="yzj-inbox-assistant-default"]')?.textContent).toContain('助手')
    expect(container.querySelector('[data-testid="yzj-inbox-group-g-ops"]')?.textContent).toContain('灵基全员运营群')
    expect(container.querySelector('[data-testid="yzj-inbox-group-u-chen"]')?.textContent).toContain('陈炳坤')

    const sub = container.querySelector('[data-testid="yzj-inbox-section-sub"]')?.textContent ?? ''
    expect(sub).toContain('公司发文')
    expect(sub).toContain('【金钠财报】')
    expect(sub).toContain('待办通知')
    expect(container.querySelector('[data-testid="yzj-inbox-fused"]')?.textContent).not.toContain('待办通知')

    const opsImg = container.querySelector('[data-testid="yzj-inbox-group-g-ops"] img')
    expect(opsImg?.getAttribute('src')).toBe('https://img.test/ops.png')
    expect(opsImg?.getAttribute('referrerpolicy') ?? opsImg?.getAttribute('referrerPolicy')).toBe('no-referrer')
    const chenImg = container.querySelector('[data-testid="yzj-inbox-group-u-chen"] img')
    expect(chenImg?.getAttribute('src')).toBe('https://img.test/chen.png')

    act(() => { root.unmount() })
  })

  it('paints cached recent rows before fetch resolves', async () => {
    putGroupWindow([
      { groupId: 'g-cached', groupName: '缓存群', groupType: 2, lastMsg: { content: 'hi' } },
    ], false)
    let resolveFetch: ((value: { ok: true; value: unknown }) => void) | undefined
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root: Root = createRoot(container)
    act(() => {
      root.render(<YzjInbox panel={fakePanel({
        fetchGroups: () => new Promise((resolve) => { resolveFetch = resolve }),
      })} />)
    })
    expect(container.querySelector('[data-testid="yzj-inbox-group-g-cached"]')?.textContent).toContain('缓存群')
    await act(async () => {
      resolveFetch?.({
        ok: true,
        value: {
          list: [
            { groupId: 'g-fresh', groupName: '新群', groupType: 2, lastMsg: { content: 'new' } },
          ],
          more: false,
        },
      })
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(container.querySelector('[data-testid="yzj-inbox-group-g-fresh"]')?.textContent).toContain('新群')
    act(() => { root.unmount() })
  })

  it('switches to grouped sections and persists the preference', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root: Root = createRoot(container)
    act(() => { root.render(<YzjInbox panel={fakePanel()} />) })
    await flush()

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="yzj-inbox-layout-grouped"]')?.click()
    })
    await flush()

    expect(localStorage.getItem(LAYOUT_KEY)).toBe('grouped')
    expect(container.querySelector('[data-yzj-inbox-layout="grouped"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="yzj-inbox-section-assistants"]')?.textContent).toContain('助手')
    expect(container.querySelector('[data-testid="yzj-inbox-section-dm"]')?.textContent).toContain('陈炳坤')
    expect(container.querySelector('[data-testid="yzj-inbox-section-group"]')?.textContent).toContain('灵基全员运营群')
    expect(container.querySelector('[data-testid="yzj-inbox-fused"]')).toBeNull()

    act(() => { root.unmount() })
  })

  it('scrolls to load further recent pages in mixed layout', async () => {
    const pages: number[] = []
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root: Root = createRoot(container)
    act(() => {
      root.render(<YzjInbox panel={fakePanel({
        fetchGroups: async (_limit, page = 1) => {
          pages.push(page)
          if (page === 1) {
            return {
              ok: true,
              value: {
                list: [
                  { groupId: 'g-1', groupName: '群一', groupType: 2, lastMsg: { content: 'a' } },
                ],
                more: true,
              },
            }
          }
          return {
            ok: true,
            value: {
              list: [
                { groupId: 'u-2', groupName: '张三', groupType: 1, lastMsg: { content: 'b' } },
              ],
              more: false,
            },
          }
        },
      })} />)
    })
    await flush()
    expect(pages).toEqual([1])
    expect(container.querySelector('[data-testid="yzj-inbox-fused"]')?.textContent).toContain('群一')
    const list = container.querySelector<HTMLDivElement>('[data-testid="yzj-inbox-list"]')
    expect(list).not.toBeNull()
    Object.defineProperty(list!, 'clientHeight', { configurable: true, get: () => 100 })
    Object.defineProperty(list!, 'scrollHeight', { configurable: true, get: () => 200 })
    Object.defineProperty(list!, 'scrollTop', { configurable: true, get: () => 120 })
    await act(async () => {
      list!.dispatchEvent(new Event('scroll', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(pages).toEqual([1, 2])
    expect(container.querySelector('[data-testid="yzj-inbox-fused"]')?.textContent).toContain('张三')
    expect(container.querySelector('[data-testid="yzj-inbox-end"]')).not.toBeNull()
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
    expect(container.querySelector('[data-testid="yzj-inbox-create-hint"]')).toBeNull()
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
