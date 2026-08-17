// @vitest-environment jsdom
/**
 * Fused VIEW: bound stream shows ①② + ③; unbound has no group stream.
 */
import { act } from 'react-dom/test-utils'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { YzjFusedView } from '../src/client/transcript.tsx'

type Rpc = { ok: true; value: unknown } | { ok: false; error: { message: string } }

function renderView(
  fused: Rpc,
  extra: {
    backfill?: Rpc
    homeTopicOpen?: (input: { groupId: string; rootMsgId?: string }) => Promise<Rpc>
    focused?: string[]
  } = {},
): HTMLDivElement {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const backfill = extra.backfill ?? { ok: true as const, value: { appended: 0, skipped: 0 } }
  act(() => {
    root.render(
      <YzjFusedView
        sessionId="yzj-home-g-a"
        homeFused={async () => fused}
        homeBackfill={async () => backfill}
        {...(extra.homeTopicOpen === undefined ? {} : { homeTopicOpen: extra.homeTopicOpen })}
        {...(extra.focused === undefined ? {} : { focusBoundSession: (id) => extra.focused?.push(id) })}
      />,
    )
  })
  return container
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('YzjFusedView', () => {
  it('renders the group room as IM plus 交给助手, not a fused agent stream', async () => {
    const fused: Rpc = {
      ok: true,
      value: {
        bound: true,
        kind: 'room',
        binding: { yzjConversationId: 'g-a', dshSessionId: 'yzj-home-g-a', yzjKind: 'group' },
        topics: [],
        items: [
          { kind: 'im', time: 1, entry: { msgId: 'm1', sentAt: 1, fromName: '同事', content: '群里一句', origin: 'inbound', isSelf: false, status: 'acked' } },
          { kind: 'im', time: 2, entry: { msgId: 'm2', sentAt: 2, fromName: '我', content: '发进群', origin: 'dsh-send', isSelf: true, status: 'acked' } },
        ],
      },
    }
    const container = renderView(fused)
    await flush()
    const text = container.textContent ?? ''
    expect(text).toContain('群里一句')
    expect(text).toContain('发进群')
    expect(text).toContain('交给助手')
    expect(text).toContain('加载更早消息')
    expect(text).toContain('回复')
    expect(container.querySelector('[data-testid="yzj-room-row-m2"]')?.className).toMatch(/roomRowSelf/)
    expect(container.querySelector('[data-testid="yzj-room-row-m1"]')?.className).toMatch(/roomRowOther/)
    expect(text).not.toContain('发给助手')
    expect(text).not.toContain('助手回答一句')
    expect(text).not.toContain('本群话题')
  })

  it('maps Yunzhijia emoticon tokens like the floating panel', async () => {
    const fused: Rpc = {
      ok: true,
      value: {
        bound: true,
        kind: 'room',
        binding: { yzjConversationId: 'g-a', dshSessionId: 'yzj-home-g-a', yzjKind: 'group' },
        topics: [],
        items: [
          { kind: 'im', time: 1, entry: { msgId: 'm1', sentAt: 1, fromName: '同事', content: '[握手]好的', origin: 'inbound', isSelf: false, status: 'acked' } },
        ],
      },
    }
    const container = renderView(fused)
    await flush()
    expect(container.textContent).toContain('🤝')
    expect(container.textContent).toContain('好的')
    expect(container.textContent).not.toContain('[握手]')
  })

  it('renders 助手 posts with a topic backlink (R9)', async () => {
    const fused: Rpc = {
      ok: true,
      value: {
        bound: true,
        kind: 'room',
        binding: { yzjConversationId: 'g-a', dshSessionId: 'yzj-home-g-a', yzjKind: 'group' },
        topics: [{ dshSessionId: 'yzj-topic-g-a-root', title: '排期', source: 'yzj', rootMsgId: 'm1' }],
        items: [
          { kind: 'im', time: 1, entry: { msgId: 'bot-1', sentAt: 1, fromName: '助手', content: '已排好', origin: 'robot-outbound', isSelf: false, status: 'acked', topicSessionId: 'yzj-topic-g-a-root' } },
        ],
      },
    }
    const container = renderView(fused)
    await flush()
    expect(container.textContent).toContain('已排好')
    expect(container.textContent).toContain('来自话题 · 排期')
    const handoff = [...container.querySelectorAll('button')].some(node => node.textContent?.includes('交给助手'))
    expect(handoff).toBe(false)
  })

  it('shows the private-session hint when unbound', async () => {
    const container = renderView({ ok: true, value: { bound: false, items: [] } })
    await flush()
    expect(container.textContent).toContain('私密会话')
    expect(container.textContent).toContain('只给助手')
    expect(container.textContent).not.toContain('群房间：这里发送')
  })

  it('does not label empty names as 群消息', async () => {
    const fused: Rpc = {
      ok: true,
      value: {
        bound: true,
        kind: 'room',
        binding: { yzjConversationId: 'g-a', dshSessionId: 'yzj-home-g-a', yzjKind: 'group' },
        topics: [],
        items: [
          { kind: 'im', time: 1, entry: { msgId: 'm1', sentAt: 1, fromName: '', fromOpenId: 'openid-abcdef', content: '无名', origin: 'inbound', isSelf: false, status: 'acked' } },
        ],
      },
    }
    const container = renderView(fused)
    await flush()
    expect(container.textContent).toContain('无名')
    expect(container.textContent).toContain('abcdef')
    expect(container.textContent).not.toContain('群消息')
  })

  it('shows 话题 N on a group room and opens the drawer without leaving the timeline', async () => {
    const fused: Rpc = {
      ok: true,
      value: {
        bound: true,
        kind: 'room',
        binding: { yzjConversationId: 'g-a', dshSessionId: 'yzj-home-g-a', yzjKind: 'group' },
        topics: [{ dshSessionId: 'yzj-topic-1', title: '排期', source: 'dsh', rootMsgId: 'm1' }],
        items: [
          { kind: 'im', time: 1, entry: { msgId: 'm1', sentAt: 1, fromName: '同事', content: '群里一句', origin: 'inbound', isSelf: false, status: 'acked' } },
        ],
      },
    }
    const container = renderView(fused)
    await flush()
    expect(container.textContent).toContain('话题 1')
    expect(container.querySelector('[data-testid="yzj-topic-drawer"]')).toBeNull()
    act(() => { (container.querySelector('[data-testid="yzj-topic-toggle"]') as HTMLButtonElement).click() })
    expect(container.querySelector('[data-testid="yzj-topic-drawer"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="yzj-fused-stream"]')).not.toBeNull()
    expect(container.textContent).toContain('群里一句')
    expect(container.textContent).toContain('1 条回复')
  })

  it('交给助手 opens the drawer lens and does not focus the topic session', async () => {
    const focused: string[] = []
    const fused: Rpc = {
      ok: true,
      value: {
        bound: true,
        kind: 'room',
        binding: { yzjConversationId: 'g-a', dshSessionId: 'yzj-home-g-a', yzjKind: 'group' },
        topics: [],
        items: [
          { kind: 'im', time: 1, entry: { msgId: 'm2', sentAt: 1, fromName: '我', content: '发进群', origin: 'dsh-send', isSelf: true, status: 'acked' } },
        ],
      },
    }
    const container = renderView(fused, {
      focused,
      homeTopicOpen: async () => ({ ok: true, value: { sessionId: 'yzj-topic-g-a-m2' } }),
    })
    await flush()
    const handoff = [...container.querySelectorAll('button')].find(node => node.textContent?.includes('交给助手'))
    await act(async () => { handoff?.click(); await Promise.resolve(); await Promise.resolve() })
    await flush()
    expect(focused).toEqual([])
    expect(container.querySelector('[data-testid="yzj-topic-drawer"]')).not.toBeNull()
    expect(container.textContent).toContain('原生会话')
    expect(container.querySelector('[data-testid="yzj-fused-stream"]')).not.toBeNull()
    expect(container.textContent).toContain('1 条回复')
    expect(container.textContent).not.toContain('交给助手')
  })

  it('hides the topic drawer toggle on a dm room', async () => {
    const fused: Rpc = {
      ok: true,
      value: {
        bound: true,
        kind: 'room',
        binding: { yzjConversationId: 'BOT-x', dshSessionId: 'yzj-home-BOT-x', yzjKind: 'dm' },
        topics: [],
        items: [
          { kind: 'im', time: 1, entry: { msgId: 'm1', sentAt: 1, fromName: '同事', content: '私聊一句', origin: 'inbound', isSelf: false, status: 'acked' } },
        ],
      },
    }
    const container = renderView(fused)
    await flush()
    expect(container.querySelector('[data-testid="yzj-topic-toggle"]')).toBeNull()
    expect(container.textContent).toContain('私聊一句')
  })

  it('merges same-speaker rows, inserts 今天, and chips the topic root', async () => {
    const now = Date.now()
    const fused: Rpc = {
      ok: true,
      value: {
        bound: true,
        kind: 'room',
        binding: { yzjConversationId: 'g-a', dshSessionId: 'yzj-home-g-a', yzjKind: 'group' },
        topics: [{ dshSessionId: 'yzj-topic-1', title: '排期', source: 'dsh', rootMsgId: 'm1' }],
        items: [
          { kind: 'im', time: now, entry: { msgId: 'm1', sentAt: now, fromName: '同事', fromOpenId: 'u1', content: '第一句', origin: 'inbound', isSelf: false, status: 'acked' } },
          { kind: 'im', time: now + 1, entry: { msgId: 'm2', sentAt: now + 1, fromName: '同事', fromOpenId: 'u1', content: '第二句', origin: 'inbound', isSelf: false, status: 'acked' } },
          { kind: 'im', time: now + 2, entry: { msgId: 'bot', sentAt: now + 2, fromName: '助手', content: '[文件]', origin: 'robot-outbound', isSelf: false, status: 'acked', msgType: 'file', param: { name: '排期.md', ext: 'md' }, topicSessionId: 'yzj-topic-1' } },
        ],
      },
    }
    const container = renderView(fused)
    await flush()
    expect(container.textContent).toContain('今天')
    expect(container.querySelector('[data-testid="yzj-room-row-m1"]')?.getAttribute('data-merged')).toBe('false')
    expect(container.querySelector('[data-testid="yzj-room-row-m2"]')?.getAttribute('data-merged')).toBe('true')
    expect(container.querySelector('[data-testid="yzj-room-row-m2"]')?.textContent).not.toContain('同事')
    expect(container.textContent).toContain('2 条回复')
    expect(container.querySelector('[data-testid="yzj-reply-chip-m1"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="yzj-artifact-bot"]')?.textContent).toContain('排期.md')
    expect(container.querySelector('[data-testid="yzj-artifact-bot"]')?.textContent).toContain('已发进群')
    expect(container.querySelector('[data-testid="yzj-room-row-m1"]')?.textContent).not.toContain('交给助手')
  })
})
