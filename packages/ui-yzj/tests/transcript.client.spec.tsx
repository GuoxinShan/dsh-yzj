// @vitest-environment jsdom
/**
 * Fused VIEW: bound stream shows ①② + ③; unbound has no group stream.
 */
import { act } from 'react-dom/test-utils'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { agentClampOf, displayNameOf, streamAtBottom, YzjFusedView } from '../src/client/transcript.tsx'
import { subscribeRoomComposerHost } from '../src/client/composer-host.ts'

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

const roomFused = (items: unknown[]): Rpc => ({
  ok: true,
  value: {
    bound: true,
    kind: 'room',
    binding: { yzjConversationId: 'g-a', dshSessionId: 'yzj-home-g-a', yzjKind: 'group' },
    topics: [],
    items,
  },
})

describe('YzjFusedView', () => {
  it('renders the group room as IM rows（话题入口已撤下，决策 50）, not a fused agent stream', async () => {
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
    expect(text).not.toContain('交给助手')  // 决策 50：话题入口已撤
    expect(text).toContain('加载更早消息')
    expect(text).toContain('回复')
    expect(container.querySelector('[data-testid="yzj-topic-toggle"]')).toBeNull()
    expect(container.querySelector('[data-testid="yzj-room-row-m2"]')?.className).toMatch(/roomRowSelf/)
    expect(container.querySelector('[data-testid="yzj-room-row-m1"]')?.className).toMatch(/roomRowOther/)
    expect(container.querySelector('[data-testid="yzj-room-row-m2"] [class*="roomBubbleSelf"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="yzj-room-row-m1"] [class*="roomBubbleOther"]')).not.toBeNull()
    expect(text).not.toContain('发给助手')
    expect(text).not.toContain('助手回答一句')
    expect(text).not.toContain('本群话题')
    expect(text).not.toContain('喂给推进')
    expect(container.querySelector('[data-testid="yzj-room-composer-host"]')).not.toBeNull()
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
    expect(container.textContent).not.toContain('来自话题')  // 决策 50：话题 backlink chip 已撤
    expect(container.textContent).not.toContain('交给助手')
  })

  it('labels BOT- senders 机器人, never the raw openId tail', async () => {
    const fused: Rpc = {
      ok: true,
      value: {
        bound: true,
        kind: 'room',
        binding: { yzjConversationId: 'g-a', dshSessionId: 'yzj-home-g-a', yzjKind: 'group' },
        topics: [],
        items: [
          { kind: 'im', time: 1, entry: { msgId: 'b1', sentAt: 1, fromName: '', fromOpenId: 'BOT-test-robot', content: '@我 收到', origin: 'backfill', isSelf: false, status: 'acked' } },
        ],
      },
    }
    const container = renderView(fused)
    await flush()
    expect(container.textContent).toContain('机器人')
    expect(container.textContent).not.toContain('543b4d')
  })

  it('clamps long robot posts behind 展开全文 and expands on click', async () => {
    const long = '很长的助手回复'.repeat(40)
    const fused: Rpc = {
      ok: true,
      value: {
        bound: true,
        kind: 'room',
        binding: { yzjConversationId: 'g-a', dshSessionId: 'yzj-home-g-a', yzjKind: 'group' },
        topics: [],
        items: [
          { kind: 'im', time: 1, entry: { msgId: 'b1', sentAt: 1, fromName: '', fromOpenId: 'BOT-x1', content: long, origin: 'backfill', isSelf: false, status: 'acked' } },
        ],
      },
    }
    const container = renderView(fused)
    await flush()
    const toggle = [...container.querySelectorAll('button')].find(node => node.textContent === '展开全文')
    expect(toggle).not.toBeUndefined()
    expect(container.querySelector('span[class*="roomClamp"]')).not.toBeNull()
    act(() => { toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    await flush()
    expect(container.querySelector('span[class*="roomClamp"]')).toBeNull()
    expect([...container.querySelectorAll('button')].some(node => node.textContent === '收起')).toBe(true)
  })

  it('keeps short robot posts and human walls unclamped', () => {
    const robotShort = { msgId: 'a', sentAt: 1, fromName: '', fromOpenId: 'BOT-x', content: '收到', origin: 'backfill', isSelf: false, status: 'acked' }
    const humanLong = { msgId: 'b', sentAt: 1, fromName: '同事', fromOpenId: 'u-1', content: '长'.repeat(400), origin: 'backfill', isSelf: false, status: 'acked' }
    expect(agentClampOf(robotShort)).toBe(false)
    expect(agentClampOf(humanLong)).toBe(false)
    expect(agentClampOf({ ...robotShort, content: '长'.repeat(400) })).toBe(true)
    expect(agentClampOf({ ...robotShort, content: '长'.repeat(400), msgType: 'richText' })).toBe(false)
    expect(displayNameOf(robotShort)).toBe('机器人')
    expect(displayNameOf({ ...robotShort, origin: 'robot-outbound' })).toBe('助手')
    expect(displayNameOf(humanLong)).toBe('同事')
  })

  it('shows a quiet empty state when unbound', async () => {
    const container = renderView({ ok: true, value: { bound: false, items: [] } })
    await flush()
    expect(container.textContent).toContain('还没有对话')
    expect(container.querySelector('[data-testid="yzj-room-composer-host"]')).not.toBeNull()
    expect(container.textContent).not.toContain('只给助手')
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

  it('话题 toggle 与抽屉已撤下（决策 50）：群房间无话题入口', async () => {
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
    expect(container.querySelector('[data-testid="yzj-topic-toggle"]')).toBeNull()
    expect(container.querySelector('[data-testid="yzj-topic-drawer"]')).toBeNull()
    expect(container.querySelector('[data-testid="yzj-fused-stream"]')).not.toBeNull()
    expect(container.textContent).toContain('群里一句')
    expect(container.textContent).not.toContain('条回复')
  })

  it('无「交给助手」入口（决策 50 撤下）', async () => {
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
    const container = renderView(fused)
    await flush()
    expect(container.textContent).not.toContain('交给助手')
    expect(container.querySelector('[data-testid="yzj-topic-drawer"]')).toBeNull()
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

  it('merges same-speaker rows, inserts 今天（话题根 chip 已撤，决策 50）', async () => {
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
    expect(container.querySelector('[data-testid="yzj-reply-chip-m1"]')).toBeNull()  // 决策 50：话题根 chip 已撤
    expect(container.querySelector('[data-testid="yzj-artifact-bot"]')?.textContent).toContain('排期.md')
    expect(container.querySelector('[data-testid="yzj-artifact-bot"]')?.textContent).toContain('已发进群')
    expect(container.querySelector('[data-testid="yzj-room-row-m1"]')?.textContent).not.toContain('交给助手')
  })

  it('cache-miss first frame is 加载群消息, not 私密会话', async () => {
    let resolveFused: ((value: Rpc) => void) | undefined
    const pending = new Promise<Rpc>((resolve) => { resolveFused = resolve })
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    act(() => {
      root.render(
        <YzjFusedView
          sessionId="yzj-home-miss"
          homeFused={async () => pending}
          homeBackfill={async () => ({ ok: true, value: { appended: 0, skipped: 0 } })}
        />,
      )
    })
    expect(container.textContent).toContain('加载群消息')
    expect(container.textContent).not.toContain('私密会话')
    expect(container.querySelector('[data-testid="yzj-room-composer-host"]')).not.toBeNull()
    await act(async () => {
      resolveFused?.({ ok: true, value: { bound: false, kind: 'unbound', items: [] } })
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(container.textContent).toContain('还没有对话')
  })

  it('话题待确认 badge 已随 toggle 撤下（决策 50）', async () => {
    const fused: Rpc = {
      ok: true,
      value: {
        bound: true,
        kind: 'room',
        binding: { yzjConversationId: 'g-a', dshSessionId: 'yzj-home-g-a', yzjKind: 'group' },
        topics: [
          { dshSessionId: 'yzj-topic-1', title: '排期', source: 'dsh', status: 'confirm', rootMsgId: 'm1' },
        ],
        items: [
          { kind: 'im', time: 1, entry: { msgId: 'm1', sentAt: 1, fromName: '同事', content: '群里一句', origin: 'inbound', isSelf: false, status: 'acked' } },
        ],
      },
    }
    const container = renderView(fused)
    await flush()
    expect(container.querySelector('[data-testid="yzj-topic-badge"]')).toBeNull()
  })

  it('re-registers the composer host after the timeline unmounts', async () => {
    const fused: Rpc = {
      ok: true,
      value: {
        bound: true,
        kind: 'room',
        binding: { yzjConversationId: 'g-a', dshSessionId: 'yzj-home-g-a', yzjKind: 'group' },
        topics: [],
        items: [],
      },
    }
    const seen: Array<HTMLElement | null> = []
    const stop = subscribeRoomComposerHost(el => { seen.push(el) })
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    act(() => {
      root.render(
        <YzjFusedView
          sessionId="yzj-home-g-a"
          homeFused={async () => fused}
          homeBackfill={async () => ({ ok: true, value: { appended: 0, skipped: 0 } })}
        />,
      )
    })
    await flush()
    const first = container.querySelector('[data-testid="yzj-room-composer-host"]')
    expect(first).not.toBeNull()
    expect(seen.at(-1)).toBe(first)

    act(() => { root.unmount() })
    expect(seen.at(-1)).toBeNull()

    const next = document.createElement('div')
    document.body.appendChild(next)
    const root2 = createRoot(next)
    act(() => {
      root2.render(
        <YzjFusedView
          sessionId="yzj-home-g-a"
          homeFused={async () => fused}
          homeBackfill={async () => ({ ok: true, value: { appended: 0, skipped: 0 } })}
        />,
      )
    })
    await flush()
    const second = next.querySelector('[data-testid="yzj-room-composer-host"]')
    expect(second).not.toBeNull()
    expect(second).not.toBe(first)
    expect(seen.at(-1)).toBe(second)
    stop()
    act(() => { root2.unmount() })
  })

  it('keeps the composer host mounted across a cache-miss group switch', async () => {
    const fusedA: Rpc = {
      ok: true,
      value: {
        bound: true,
        kind: 'room',
        binding: { yzjConversationId: 'g-a', dshSessionId: 'yzj-home-hanger', yzjKind: 'group' },
        topics: [],
        items: [
          { kind: 'im', time: 1, entry: { msgId: 'm1', sentAt: 1, fromName: '同事', content: '甲群一句', origin: 'inbound', isSelf: false, status: 'acked' } },
        ],
      },
    }
    let resolveB: ((value: Rpc) => void) | undefined
    const pendingB = new Promise<Rpc>((resolve) => { resolveB = resolve })
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const paint = (groupId: string, fused: () => Promise<Rpc>): void => {
      root.render(
        <YzjFusedView
          sessionId="yzj-home-hanger"
          groupId={groupId}
          homeFused={async () => fused()}
          homeBackfill={async () => ({ ok: true, value: { appended: 0, skipped: 0 } })}
        />,
      )
    }
    act(() => { paint('g-a', async () => fusedA) })
    await flush()
    expect(container.textContent).toContain('甲群一句')
    const host = container.querySelector('[data-testid="yzj-room-composer-host"]')
    expect(host).not.toBeNull()
    act(() => { paint('g-b', async () => pendingB) })
    expect(container.textContent).toContain('加载群消息')
    expect(container.textContent).not.toContain('甲群一句')
    expect(container.querySelector('[data-testid="yzj-room-composer-host"]')).toBe(host)
    await act(async () => {
      resolveB?.({
        ok: true,
        value: {
          bound: true,
          kind: 'room',
          binding: { yzjConversationId: 'g-b', dshSessionId: 'yzj-home-hanger', yzjKind: 'group' },
          topics: [],
          items: [
            { kind: 'im', time: 1, entry: { msgId: 'm2', sentAt: 1, fromName: '同事', content: '乙群一句', origin: 'inbound', isSelf: false, status: 'acked' } },
          ],
        },
      })
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(container.textContent).toContain('乙群一句')
    expect(container.querySelector('[data-testid="yzj-room-composer-host"]')).toBe(host)
    act(() => { root.unmount() })
  })

  it('does not paint the IM timeline for a topic snapshot', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    act(() => {
      root.render(
        <YzjFusedView
          sessionId="yzj-topic-g-a-root"
          homeFused={async () => ({
            ok: true,
            value: {
              bound: true,
              kind: 'topic',
              binding: { yzjConversationId: 'g-a', dshSessionId: 'yzj-home-g-a', yzjKind: 'group' },
              topics: [],
              items: [
                { kind: 'im', time: 1, entry: { msgId: 'm1', sentAt: 1, fromName: '同事', content: '群里一句', origin: 'inbound', isSelf: false, status: 'acked' } },
              ],
            },
          })}
          homeBackfill={async () => ({ ok: true, value: { appended: 0, skipped: 0 } })}
        />,
      )
    })
    await flush()
    expect(container.textContent).not.toContain('群里一句')
    expect(container.textContent).not.toContain('交给助手')
    expect(container.querySelector('[data-testid="yzj-fused-stream"]')).toBeNull()
    expect(container.querySelector('[data-testid="yzj-room-composer-host"]')).toBeNull()
    act(() => { root.unmount() })
  })

})

describe('streamAtBottom', () => {
  it('is true within slack of the latest message', () => {
    expect(streamAtBottom({ scrollHeight: 800, scrollTop: 760, clientHeight: 40 })).toBe(true)
    expect(streamAtBottom({ scrollHeight: 800, scrollTop: 0, clientHeight: 40 })).toBe(false)
  })
})
