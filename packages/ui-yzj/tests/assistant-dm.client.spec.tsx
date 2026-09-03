// @vitest-environment jsdom
/**
 * Assistant DM: Grok-Bot bubbles + confirm card + muted 查看过程. No tool traces.
 */
import { act } from 'react-dom/test-utils'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { YzjAssistantDm } from '../src/client/assistant-dm.tsx'
import { getImSelection, resetImSelection } from '../src/client/im-nav.ts'
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
  return {
    assistantProjection: async () => ({
      ok: true,
      value: {
        assistant: { id: 'default', name: '助手' },
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
  } as unknown as YzjPanelInject
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('YzjAssistantDm', () => {
  afterEach(() => { resetImSelection() })

  it('renders bubbles and a confirm card, not a tool trace', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root: Root = createRoot(container)
    act(() => {
      root.render(<YzjAssistantDm assistantId="default" panel={panelOf()} writeInject={writeInject} />)
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
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="yzj-view-process"]')?.click()
    })
    expect(getImSelection()).toEqual({ kind: 'peek', assistantId: 'default' })
    act(() => { root.unmount() })
  })
})
