// @vitest-environment jsdom
/**
 * Fused VIEW: bound stream shows ①② + ③; unbound has no group stream.
 */
import { act } from 'react-dom/test-utils'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { YzjFusedView } from '../src/client/transcript.tsx'

type Rpc = { ok: true; value: unknown } | { ok: false; error: { message: string } }

function renderView(fused: Rpc, backfill: Rpc = { ok: true, value: { appended: 0, skipped: 0 } }): HTMLDivElement {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(
      <YzjFusedView
        sessionId="yzj-home-g-a"
        homeFused={async () => fused}
        homeBackfill={async () => backfill}
      />,
    )
  })
  return container
}

describe('YzjFusedView', () => {
  it('renders inbound, dsh-send, and 发给助手 in one stream', async () => {
    const fused: Rpc = {
      ok: true,
      value: {
        bound: true,
        binding: { yzjConversationId: 'g-a', dshSessionId: 'yzj-home-g-a', yzjKind: 'group' },
        items: [
          { kind: 'im', time: 1, entry: { msgId: 'm1', sentAt: 1, fromName: '同事', content: '群里一句', origin: 'inbound', isSelf: false, status: 'acked' } },
          { kind: 'im', time: 2, entry: { msgId: 'm2', sentAt: 2, fromName: '我', content: '发进群', origin: 'dsh-send', isSelf: true, status: 'acked' } },
          { kind: 'session', time: 3, hide: true, event: { type: 'user/message', time: 3, data: { source: { kind: 'plugin' }, content: [{ type: 'text', text: '扳机' }] } } },
          { kind: 'session', time: 4, hide: false, event: { type: 'user/message', time: 4, data: { source: { kind: 'user' }, content: [{ type: 'text', text: '对助手说一句' }] } } },
          { kind: 'session', time: 5, hide: false, event: { type: 'assistant/message', time: 5, data: { content: [{ type: 'text', text: '助手回答一句' }] } } },
        ],
      },
    }
    const container = renderView(fused)
    await act(async () => { await Promise.resolve() })
    const text = container.textContent ?? ''
    expect(text).toContain('群里一句')
    expect(text).toContain('发进群')
    expect(text).toContain('发给助手')
    expect(text).toContain('助手回复')
    expect(text).toContain('对助手说一句')
    expect(text).toContain('助手回答一句')
    expect(text).not.toContain('扳机')
  })

  it('shows the private-session hint when unbound', async () => {
    const container = renderView({ ok: true, value: { bound: false, items: [] } })
    await act(async () => { await Promise.resolve() })
    expect(container.textContent).toContain('私密会话')
    expect(container.textContent).toContain('只给助手')
    expect(container.textContent).not.toContain('群工作时间线')
  })
})
