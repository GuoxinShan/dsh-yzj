import { describe, expect, it, vi } from 'vitest'
import { RobotRouter, collectAssistantText, highestAssistantSeq } from '../src/router.ts'
import type { RobotInboundMessage } from '../src/protocol.ts'
import type { RobotSendOptions, RobotSendResult } from '../src/outbound.ts'

function inbound(content: string, overrides: Partial<RobotInboundMessage> = {}): RobotInboundMessage {
  return {
    type: 2, robotId: 'BOT-r', robotName: '个人助手',
    operatorOpenid: 'u-allowed', operatorName: '单国鑫',
    time: Date.now(), msgId: `m-${Math.random().toString(36).slice(2)}`,
    content, groupType: 3, groupId: 'BOT-a-BOT-b', ...overrides,
  }
}

function fakeAgents(getStatus: () => 'idle' | 'running') {
  const created: unknown[] = []
  return {
    created,
    get: () => undefined,
    createAgent: async () => {
      const agent = {
        status: getStatus(),
        followup: vi.fn(),
        whenIdle: async () => {},
        session: { events: [] },
      }
      created.push(agent)
      return { agent, dispose: async () => {} }
    },
  }
}

function makeRouter(sends: RobotSendResult[], agents = fakeAgents(() => 'idle'), allowFrom = ['u-allowed']) {
  const sendCalls: { text: string; options?: RobotSendOptions }[] = []
  const sender = {
    send: async (text: string, options?: RobotSendOptions): Promise<RobotSendResult> => {
      sendCalls.push({ text, options })
      return sends.shift() ?? { ok: true, msgId: 'out-1' }
    },
  }
  const router = new RobotRouter({
    ownerCtx: {} as never,
    agents: agents as never,
    sender,
    allowFrom: async () => allowFrom,
  })
  return { router, sendCalls, agents }
}

describe('RobotRouter', () => {
  it('acks then denies a non-whitelisted sender without creating a session', async () => {
    const { router, sendCalls } = makeRouter([], fakeAgents(() => 'idle'), ['someone-else'])
    await router.handle(inbound('你好'))
    expect(sendCalls).toHaveLength(1)
    expect(sendCalls[0]!.text).toContain('白名单')
  })

  it('answers a standalone !help command without driving the agent', async () => {
    const { router, sendCalls, agents } = makeRouter([])
    await router.handle(inbound('!help'))
    expect(sendCalls).toHaveLength(1)
    expect(sendCalls[0]!.text).toContain('!mute')
    expect(agents.created).toHaveLength(0)
  })

  it('drops a duplicate msgId', async () => {
    const { router, sendCalls } = makeRouter([])
    const message = inbound('重复消息')
    await router.handle(message)
    await router.handle(message)
    // First call created no agent (empty events → no answer), so only the ack went out once.
    expect(sendCalls).toHaveLength(1)
    expect(sendCalls[0]!.text).toBe('收到，处理中…')
  })

  it('mutes and unmutes the DM session', async () => {
    const { router, sendCalls } = makeRouter([])
    await router.handle(inbound('!mute'))
    await router.handle(inbound('被静音的消息'))
    expect(sendCalls).toHaveLength(1)
    await router.handle(inbound('!unmute'))
    expect(sendCalls).toHaveLength(2)
  })

  it('acks with a reply anchor to the inbound msgId', async () => {
    const { router, sendCalls } = makeRouter([])
    await router.handle(inbound('查一下日程'))
    expect(sendCalls[0]!.options?.replyMsgId).toBeDefined()
    expect(sendCalls[0]!.options?.replyPersonName).toBe('单国鑫')
  })
})

describe('collectAssistantText / highestAssistantSeq', () => {
  const events = [
    { type: 'user/message', seq: 1, time: 0, data: {} },
    { type: 'assistant/message', seq: 2, time: 0, data: { message: { content: [{ type: 'text', text: '你好' }] } } },
    { type: 'assistant/message', seq: 3, time: 0, data: { message: { content: [{ type: 'text', text: '世界' }] } } },
  ] as never as import('@deepseek-ai/dsh-session').SessionEvent[]

  it('joins text blocks above the watermark', () => {
    expect(collectAssistantText(events, 1)).toBe('你好世界')
    expect(collectAssistantText(events, 2)).toBe('世界')
    expect(collectAssistantText(events, 3)).toBe('')
  })

  it('tracks the highest assistant seq above the watermark', () => {
    expect(highestAssistantSeq(events, 1)).toBe(3)
    expect(highestAssistantSeq(events, 3)).toBe(-1)
  })
})
