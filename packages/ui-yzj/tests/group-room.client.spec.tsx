// @vitest-environment jsdom
/**
 * People IM room: 问助手, local 只你可见 thread, @助手 intercepts send.
 */
import { act } from 'react-dom/test-utils'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { YzjGroupRoom } from '../src/client/group-room.tsx'
import { YzjLocalThread } from '../src/client/local-thread.tsx'
import { getImSelection, resetImSelection } from '../src/client/im-nav.ts'
import { emitRoomReplyRequest } from '../src/client/reply-bus.ts'
import type { YzjPanelInject } from '../src/client/rpc.ts'

type Rpc = { ok: true; value: unknown } | { ok: false; error: { message: string } }

function roomPanel(over: {
  homeSend?: (sessionId: string, content: string | undefined) => Promise<Rpc>
  threadAsk?: (input: { assistantId: string; msgId: string; text: string }) => Promise<Rpc>
} = {}): YzjPanelInject {
  return {
    assistantsList: async () => ({ ok: true, value: { assistants: [{ id: 'default', name: '助手' }] } }),
    assistantThreads: async () => ({
      ok: true,
      value: {
        threads: [{
          groupId: 'g-prod',
          msgId: 'm1',
          assistantId: 'default',
          status: 'processing',
          bubbles: [{ id: 'b1', role: 'assistant', text: '失败 3 条' }],
        }],
      },
    }),
    homeFused: async () => ({
      ok: true,
      value: {
        bound: true,
        kind: 'room',
        binding: { yzjConversationId: 'g-prod', dshSessionId: 'yzj-home-g-prod', yzjKind: 'group' },
        topics: [],
        items: [
          { kind: 'im', time: 1, entry: { msgId: 'm1', sentAt: 1, fromName: '张三', content: '回归报告', origin: 'inbound', isSelf: false, status: 'acked' } },
        ],
      },
    }),
    homeBackfill: async () => ({ ok: true, value: { appended: 0, skipped: 0 } }),
    homeSend: over.homeSend ?? (async () => ({ ok: true, value: { msgId: 'm2' } })),
    assistantThreadAsk: async (input) => over.threadAsk?.(input) ?? ({ ok: true, value: { sessionId: 'yzj-assistant-default' } }),
  } as unknown as YzjPanelInject
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('YzjLocalThread', () => {
  it('shows 只你可见 + processing + assistant bubble', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    act(() => {
      root.render(
        <YzjLocalThread
          thread={{
            groupId: 'g',
            msgId: 'm1',
            assistantId: 'default',
            status: 'processing',
            bubbles: [{ id: 'a', role: 'assistant', text: '要我发到群里吗？' }],
          }}
          onPeek={() => {}}
        />,
      )
    })
    expect(container.textContent).toContain('只你可见')
    expect(container.textContent).toContain('助手正在处理')
    expect(container.textContent).toContain('要我发到群里吗？')
    expect(container.textContent).toContain('查看过程')
    act(() => { root.unmount() })
  })
})

describe('YzjGroupRoom', () => {
  afterEach(() => { resetImSelection() })

  it('is people IM with 问助手 and a nested local thread', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root: Root = createRoot(container)
    act(() => {
      root.render(<YzjGroupRoom groupId="g-prod" groupName="灵基Chat·产品群" panel={roomPanel()} defaultAssistantId="default" />)
    })
    await flush()
    expect(container.textContent).toContain('灵基Chat·产品群')
    expect(container.textContent).toContain('问助手')
    expect(container.textContent).toContain('回归报告')
    expect(container.textContent).toContain('只你可见')
    expect(container.textContent).toContain('失败 3 条')
    expect(container.textContent).toContain('转发给助手')
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="yzj-ask-assistant"]')?.click()
    })
    expect(getImSelection()).toEqual({ kind: 'assistant', assistantId: 'default' })
    act(() => { root.unmount() })
  })

  it('intercepts @助手 from the picker so it never hits homeSend', async () => {
    const sent: string[] = []
    const asked: Array<{ msgId: string; text: string }> = []
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root: Root = createRoot(container)
    act(() => {
      root.render(
        <YzjGroupRoom
          groupId="g-prod"
          groupName="产品群"
          defaultAssistantId="default"
          panel={roomPanel({
            homeSend: async (_id, content) => {
              sent.push(content ?? '')
              return { ok: true, value: {} }
            },
            threadAsk: async (input) => {
              asked.push({ msgId: input.msgId, text: input.text })
              return { ok: true, value: {} }
            },
          })}
        />,
      )
    })
    await flush()
    act(() => { emitRoomReplyRequest({ msgId: 'm1', summary: '回归报告' }) })
    act(() => {
      container.querySelector<HTMLButtonElement>('button[aria-label="提及"]')?.click()
    })
    await flush()
    const assistantHit = [...container.querySelectorAll('button')].find(node => node.textContent === '@助手')
    expect(assistantHit).not.toBeUndefined()
    act(() => { assistantHit?.click() })
    await flush()
    expect(sent).toEqual([])
    expect(asked).toEqual([{ msgId: 'm1', text: '请看这条消息' }])
    act(() => { root.unmount() })
  })

  it('does not post an empty @助手 to Yunzhijia', async () => {
    const sent: string[] = []
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root: Root = createRoot(container)
    act(() => {
      root.render(
        <YzjGroupRoom
          groupId="g-prod"
          groupName="产品群"
          defaultAssistantId="default"
          panel={roomPanel({
            homeSend: async (_id, content) => {
              sent.push(content ?? '')
              return { ok: true, value: {} }
            },
          })}
        />,
      )
    })
    await flush()
    act(() => {
      container.querySelector<HTMLButtonElement>('button[aria-label="提及"]')?.click()
    })
    const assistantHit = [...container.querySelectorAll('button')].find(node => node.textContent === '@助手')
    act(() => { assistantHit?.click() })
    await flush()
    expect(sent).toEqual([])
    expect(getImSelection().kind).toBe('assistant')
    act(() => { root.unmount() })
  })
})
