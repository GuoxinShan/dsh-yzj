// @vitest-environment jsdom
/**
 * Assistant DM: Grok-Bot bubbles + confirm card + muted 查看过程. No tool traces.
 */
import { act } from 'react-dom/test-utils'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { YzjAssistantDm } from '../src/client/assistant-dm.tsx'
import { clearImViewCache, putAssistantDmSnapshot } from '../src/client/im-view-cache.ts'
import { getImSelection, getImSurface, resetImSelection } from '../src/client/im-nav.ts'
import type { YzjPanelInject } from '../src/client/rpc.ts'
import type { WriteCardInjected } from '../src/client/write-card.tsx'

const writeInject: WriteCardInjected = {
  fetchWrite: async () => undefined,
  decideWrite: async () => false,
  openContext: () => {},
  editDraft: () => {},
  fetchWhoami: async () => '',
}

function panelOf(): YzjPanelInject {
  const asked: string[] = []
  const focused: string[] = []
  const panel = {
    assistantProjection: async () => ({
      ok: true,
      value: {
        assistant: { id: 'default', name: '助手', sessionId: 'yzj-assistant-default' },
        processing: false,
        bubbles: [
          { id: 'u1', role: 'user', text: '帮我看看产品群昨天说了什么' },
          { id: 'a1', role: 'assistant', text: '已把讨论整理好了' },
        ],
        writes: [{
          writeId: 'w1', sessionId: 'yzj-assistant-default', toolName: 'yzj_im_message_send',
          callId: 'c1', level: 'standard', domain: 'im',
          args: { groupId: '产品群', content: '摘要' },
          reason: '发送消息', status: 'pending', time: 1,
        }],
      },
    }),
    assistantAsk: async (_id: string, text: string) => {
      asked.push(text)
      return { ok: true, value: { sessionId: 'yzj-assistant-default' } }
    },
    focusBoundSession: (id: string) => { focused.push(id) },
    focused,
  }
  return panel as unknown as YzjPanelInject & { focused: string[] }
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('YzjAssistantDm', () => {
  afterEach(() => {
    resetImSelection()
    clearImViewCache()
  })

  it('renders bubbles and a confirm card, not a tool trace', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root: Root = createRoot(container)
    const panel = panelOf() as YzjPanelInject & { focused: string[] }
    act(() => {
      root.render(<YzjAssistantDm assistantId="default" panel={panel} writeInject={writeInject} />)
    })
    await flush()
    expect(container.textContent).toContain('专属助手 · 单聊')
    expect(container.textContent).toContain('帮我看看产品群昨天说了什么')
    expect(container.textContent).toContain('已把讨论整理好了')
    expect(container.textContent).toContain('发送到 产品群')
    expect(container.textContent).toContain('确认')
    expect(container.textContent).toContain('查看过程')
    expect(container.textContent).not.toContain('bash')
    expect(container.textContent).not.toContain('tool/call')
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="yzj-view-process"]')?.click()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(getImSurface()).toBe('session')
    expect(panel.focused).toEqual(['yzj-assistant-default'])
    expect(getImSelection().kind).not.toBe('peek' as never)
    act(() => { root.unmount() })
  })

  it('paints cached bubbles and draft before projection resolves', async () => {
    putAssistantDmSnapshot('default', {
      name: '助手',
      bubbles: [{ id: 'c1', role: 'assistant', text: '缓存气泡' }],
      processing: false,
      writes: [],
      draft: '未发送草稿',
    })
    let resolveProj: ((value: { ok: true; value: unknown }) => void) | undefined
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root: Root = createRoot(container)
    act(() => {
      root.render(<YzjAssistantDm
        assistantId="default"
        panel={{
          assistantProjection: () => new Promise((resolve) => { resolveProj = resolve }),
        } as unknown as YzjPanelInject}
        writeInject={writeInject}
      />)
    })
    expect(container.textContent).toContain('缓存气泡')
    expect(container.querySelector('textarea')?.value).toBe('未发送草稿')
    await act(async () => {
      resolveProj?.({
        ok: true,
        value: {
          assistant: { id: 'default', name: '助手' },
          processing: false,
          bubbles: [{ id: 'f1', role: 'assistant', text: '新鲜气泡' }],
          writes: [],
        },
      })
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(container.textContent).toContain('新鲜气泡')
    expect(container.querySelector('textarea')?.value).toBe('未发送草稿')
    act(() => { root.unmount() })
  })
})
