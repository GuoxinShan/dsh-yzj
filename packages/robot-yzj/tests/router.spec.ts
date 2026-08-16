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
  const byId = new Map<string, unknown>()
  return {
    created,
    get: (id: { toString(): string }) => byId.get(String(id)),
    resume: async () => Promise.reject(new Error('no persisted log')),
    create: async (options: { sessionId: { toString(): string } }) => {
      const listeners: ((payload: unknown) => void)[] = []
      const agent = {
        id: `agent-${created.length}`,
        status: getStatus(),
        followup: vi.fn(),
        inject: vi.fn(),
        whenIdle: async () => {},
        session: { events: [] },
        ctx: {
          on: (_type: string, listener: (payload: unknown) => void) => {
            listeners.push(listener)
            return () => { const i = listeners.indexOf(listener); if (i >= 0) listeners.splice(i, 1) }
          },
        },
      }
      created.push(agent)
      byId.set(String(options.sessionId), agent)
      return { agent, dispose: async () => { byId.delete(String(options.sessionId)) } }
    },
  }
}

function makeRouter(
  sends: RobotSendResult[],
  agents = fakeAgents(() => 'idle'),
  allowFrom = ['u-allowed'],
  extra: { memory?: { lines: (key: string) => readonly string[]; remember: (key: string, line: string) => Promise<{ lines: readonly string[]; note: string }>; forget: (key: string, substring: string) => Promise<{ lines: readonly string[]; note: string }> } } = {},
) {
  const sendCalls: { text: string; options?: RobotSendOptions }[] = []
  const sender = {
    send: async (text: string, options?: RobotSendOptions): Promise<RobotSendResult> => {
      sendCalls.push({ text, options })
      return sends.shift() ?? { ok: true, msgId: 'out-1' }
    },
  }
  const router = new RobotRouter({
    agents: agents as never,
    sender,
    allowFrom: async () => allowFrom,
    ...(extra.memory === undefined ? {} : { memory: extra.memory }),
  })
  return { router, sendCalls, agents }
}

function fakeMemory(initial: string[] = []) {
  const store = new Map<string, string[]>([['dm:BOT-r:u-allowed', [...initial]]])
  const keyOf = (message: RobotInboundMessage): string => message.groupId.startsWith('BOT-') ? `dm:${message.robotId}:${message.operatorOpenid}` : `g:${message.groupId}`
  return {
    store,
    lines: (key: string) => store.get(key) ?? [],
    remember: async (key: string, line: string) => {
      const lines = store.get(key) ?? []
      if (!lines.includes(line)) lines.push(line)
      store.set(key, lines)
      return { lines, note: '已记住' }
    },
    forget: async (key: string, substring: string) => {
      const lines = (store.get(key) ?? []).filter(line => !line.includes(substring))
      store.set(key, lines)
      return { lines, note: '已处理' }
    },
    keyOf,
  }
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
    // Ack only (the PushHub owns answer pushes; none without events)…
    expect(sendCalls).toHaveLength(1)
    expect(sendCalls[0]!.text).toContain('收到，处理中')
    await router.handle(message)
    // …and the duplicate adds nothing.
    expect(sendCalls).toHaveLength(1)
  })

  it('mutes and unmutes the DM session', async () => {
    const { router, sendCalls } = makeRouter([])
    await router.handle(inbound('!mute'))
    await router.handle(inbound('被静音的消息'))
    expect(sendCalls).toHaveLength(1)
    await router.handle(inbound('!unmute'))
    expect(sendCalls).toHaveLength(2)
  })

  it('prefers resume over create for a persisted DM session', async () => {
    const order: string[] = []
    const agents = {
      get: () => undefined,
      resume: async () => { order.push('resume'); throw new Error('not here') },
      create: async () => { order.push('create'); throw new Error('boom') },
    }
    const { router } = makeRouter([], agents as never)
    await router.handle(inbound('触发'))
    // resume is attempted first; its failure falls back to create (which we
    // let fail here so the deny-path message goes out without an agent).
    expect(order).toEqual(['resume', 'create'])
  })

  it('anchors a fresh group session per top-level message and continues it on replies', async () => {
    const agents = fakeAgents(() => 'idle')
    const { router, sendCalls } = makeRouter([], agents)
    // Top-level group @: groupId without the BOT- prefix. The first group
    // message runs the intro turn (S7) instead of the raw content.
    await router.handle(inbound('群任务A', { groupId: '6a7f37b4e4b0e6211b1c5b87', msgId: 'root-1' }))
    expect(agents.created).toHaveLength(1)
    const firstFollowup = (agents.created[0] as { followup: { mock: { calls: unknown[][] } } }).followup.mock.calls
    expect(String(firstFollowup[0]![0]!.content[0]!.text)).toContain('自我介绍')
    // Ack carried notifyParams targeting the asker (group surface).
    const ack = sendCalls[0]!.options
    expect(ack?.notifyOpenIds).toEqual(['u-allowed'])
    // A reply to the robot's ack (msgId 'out-1' from the fake sender) continues the same session.
    await router.handle(inbound('继续刚才的', {
      groupId: '6a7f37b4e4b0e6211b1c5b87',
      msgId: 'reply-1',
      msgParam: JSON.stringify({ replyMsgId: 'out-1', replyRootMsgId: 'root-1', replyPersonName: '单国鑫', replySummary: '群任务A' }),
    }))
    expect(agents.created).toHaveLength(1)
    expect((agents.created[0] as { followup: { mock: { calls: unknown[][] } } }).followup.mock.calls).toHaveLength(2)
    // A different top-level message anchors its own session (no second intro).
    await router.handle(inbound('另一个话题', { groupId: '6a7f37b4e4b0e6211b1c5b87', msgId: 'root-2' }))
    expect(agents.created).toHaveLength(2)
    const secondFollowup = (agents.created[1] as { followup: { mock: { calls: unknown[][] } } }).followup.mock.calls
    expect(String(secondFollowup[0]![0]!.content[0]!.text)).toBe('另一个话题')
  })

  it('rides the task summary in the ack (C12) for long-enough prompts', async () => {
    const { router, sendCalls } = makeRouter([])
    await router.handle(inbound('帮我总结一下今天上午的会议纪要并分发'))
    expect(sendCalls[0]!.text).toContain('收到，处理中')
    expect(sendCalls[0]!.text).toContain('帮我总结一下今天上午的会议纪要')
  })

  it('stores and lists conversation memory via verbs (S4)', async () => {
    const memory = fakeMemory()
    const { router, sendCalls } = makeRouter([], fakeAgents(() => 'idle'), ['u-allowed'], { memory })
    await router.handle(inbound('记住 周报一律发成表格'))
    expect(sendCalls.at(-1)!.text).toContain('已记住')
    expect(memory.lines('dm:BOT-r:u-allowed')).toEqual(['周报一律发成表格'])
    await router.handle(inbound('你记住了什么'))
    expect(sendCalls.at(-1)!.text).toContain('周报一律发成表格')
    await router.handle(inbound('忘掉 周报'))
    expect(memory.lines('dm:BOT-r:u-allowed')).toEqual([])
  })

  it('injects stored memory as instructions context on turns (S4)', async () => {
    const memory = fakeMemory(['周报一律发成表格'])
    const agents = fakeAgents(() => 'idle')
    const { router } = makeRouter([], agents, ['u-allowed'], { memory })
    await router.handle(inbound('帮我写周报'))
    const agent = agents.created[0] as { inject: { mock: { calls: unknown[][] } } }
    expect(agent.inject.mock.calls).toHaveLength(1)
    expect(String(agent.inject.mock.calls[0]![0]!.content[0]!.text)).toContain('周报一律发成表格')
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
