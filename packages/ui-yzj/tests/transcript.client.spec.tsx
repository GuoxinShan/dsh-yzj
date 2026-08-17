// @vitest-environment jsdom
/**
 * Fused VIEW: bound stream shows ①② + ③; unbound has no group stream.
 * Switching sessions must not flash 「私密会话」 or leftover rows.
 */
import { act } from 'react-dom/test-utils'
import { createRoot, type Root } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { displayNameOf, YzjFusedView } from '../src/client/transcript.tsx'

type Rpc = { ok: true; value: unknown } | { ok: false; error: { message: string } }

function boundItems(): unknown[] {
  return [
    { kind: 'im', time: 1, entry: { msgId: 'm1', sentAt: 1, fromName: '同事', content: '群里一句[握手]', origin: 'inbound', isSelf: false, status: 'acked' } },
    { kind: 'im', time: 2, entry: { msgId: 'm2', sentAt: 2, fromName: '我', content: '发进群', origin: 'dsh-send', isSelf: true, status: 'acked' } },
    { kind: 'session', time: 3, hide: true, event: { type: 'user/message', time: 3, data: { source: { kind: 'plugin' }, content: [{ type: 'text', text: '扳机' }] } } },
    { kind: 'session', time: 4, hide: false, event: { type: 'user/message', time: 4, data: { source: { kind: 'user' }, content: [{ type: 'text', text: '对助手说一句' }] } } },
    { kind: 'session', time: 5, hide: false, event: { type: 'assistant/message', time: 5, data: { content: [{ type: 'text', text: '助手回答一句' }] } } },
  ]
}

async function flush(times = 8): Promise<void> {
  for (let i = 0; i < times; i++) await act(async () => { await Promise.resolve() })
}

function mountView(
  sessionId: string,
  fused: () => Promise<Rpc>,
  backfill: () => Promise<Rpc> = async () => ({ ok: true, value: { appended: 0, skipped: 0 } }),
): { container: HTMLDivElement; root: Root } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(
      <YzjFusedView
        sessionId={sessionId}
        homeFused={fused}
        homeBackfill={backfill}
      />,
    )
  })
  return { container, root }
}

describe('displayNameOf', () => {
  it('never uses 「群消息」; empty name falls back to openId tail then 未知', () => {
    expect(displayNameOf({
      msgId: 'm', sentAt: 1, fromName: '', content: 'x', origin: 'inbound', isSelf: false, status: 'acked',
    })).toBe('未知')
    expect(displayNameOf({
      msgId: 'm', sentAt: 1, fromName: '', content: 'x', origin: 'inbound', isSelf: false, status: 'acked',
      fromOpenId: 'abcdef123456',
    })).toBe('123456')
    expect(displayNameOf({
      msgId: 'm', sentAt: 1, fromName: '同事', content: 'x', origin: 'inbound', isSelf: false, status: 'acked',
    }, '通讯录名')).toBe('通讯录名')
    expect(displayNameOf({
      msgId: 'm', sentAt: 1, fromName: '同事', content: 'x', origin: 'inbound', isSelf: true, status: 'acked',
    })).toBe('我')
  })
})

describe('YzjFusedView', () => {
  it('renders inbound, dsh-send, and 发给助手 in one stream', async () => {
    const { container, root } = mountView('yzj-home-g-stream', async () => ({
      ok: true,
      value: {
        bound: true,
        binding: { yzjConversationId: 'g-a', dshSessionId: 'yzj-home-g-stream', yzjKind: 'group' },
        items: boundItems(),
      },
    }))
    await flush()
    const text = container.textContent ?? ''
    expect(text).toContain('群里一句')
    expect(text).toContain('🤝')
    expect(text).toContain('发进群')
    expect(text).toContain('发给助手')
    expect(text).toContain('助手回复')
    expect(text).toContain('对助手说一句')
    expect(text).toContain('助手回答一句')
    expect(text).not.toContain('扳机')
    expect(text).not.toContain('群消息')
    act(() => { root.unmount() })
  })

  it('shows the private-session hint when unbound, after fused confirms', async () => {
    const { container, root } = mountView('yzj-home-g-unbound', async () => ({
      ok: true, value: { bound: false, items: [] },
    }))
    await flush()
    expect(container.textContent).toContain('私密会话')
    expect(container.textContent).toContain('只给助手')
    expect(container.textContent).not.toContain('群工作时间线')
    act(() => { root.unmount() })
  })

  it('does not flash 私密会话 while fused is still in flight', async () => {
    let resolveFused!: (value: Rpc) => void
    const pending = new Promise<Rpc>(resolve => { resolveFused = resolve })
    const { container, root } = mountView('yzj-home-g-delay', async () => pending)
    expect(container.textContent).toContain('加载群消息')
    expect(container.textContent).not.toContain('私密会话')
    await act(async () => {
      resolveFused({
        ok: true,
        value: {
          bound: true,
          binding: { yzjConversationId: 'g-delay', dshSessionId: 'yzj-home-g-delay', yzjKind: 'group' },
          items: [
            { kind: 'im', time: 1, entry: { msgId: 'm1', sentAt: 1, fromName: '同事', content: '来了', origin: 'inbound', isSelf: false, status: 'acked' } },
          ],
        },
      })
      await Promise.resolve()
    })
    await flush()
    expect(container.textContent).toContain('来了')
    expect(container.textContent).not.toContain('私密会话')
    act(() => { root.unmount() })
  })

  it('paints the new session cache on the first frame, not leftover rows', async () => {
    const { container, root } = mountView('yzj-home-g-cache-a', async () => ({
      ok: true,
      value: {
        bound: true,
        binding: { yzjConversationId: 'g-a', dshSessionId: 'yzj-home-g-cache-a', yzjKind: 'group' },
        items: [
          { kind: 'im', time: 1, entry: { msgId: 'ma', sentAt: 1, fromName: '甲', content: '群A的话', origin: 'inbound', isSelf: false, status: 'acked' } },
        ],
      },
    }))
    await flush()
    expect(container.textContent).toContain('群A的话')
    let resolveB!: (value: Rpc) => void
    const pendingB = new Promise<Rpc>(resolve => { resolveB = resolve })
    act(() => {
      root.render(
        <YzjFusedView
          sessionId="yzj-home-g-cache-b"
          homeFused={async () => pendingB}
          homeBackfill={async () => ({ ok: true, value: { appended: 0, skipped: 0 } })}
        />,
      )
    })
    expect(container.textContent).toContain('加载群消息')
    expect(container.textContent).not.toContain('群A的话')
    expect(container.textContent).not.toContain('私密会话')
    await act(async () => {
      resolveB({
        ok: true,
        value: {
          bound: true,
          binding: { yzjConversationId: 'g-b', dshSessionId: 'yzj-home-g-cache-b', yzjKind: 'group' },
          items: [
            { kind: 'im', time: 1, entry: { msgId: 'mb', sentAt: 1, fromName: '乙', content: '群B的话', origin: 'inbound', isSelf: false, status: 'acked' } },
          ],
        },
      })
      await Promise.resolve()
    })
    await flush()
    expect(container.textContent).toContain('群B的话')
    expect(container.textContent).not.toContain('群A的话')
    act(() => { root.unmount() })
  })
})
