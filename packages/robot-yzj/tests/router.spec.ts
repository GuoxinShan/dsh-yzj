import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { RobotRouter, collectAssistantText, conversationSummary, highestAssistantSeq } from '../src/router.ts'
import type { RobotInboundMessage } from '../src/protocol.ts'
import type { RobotSendOptions, RobotSendResult } from '../src/outbound.ts'

/** Scratch channel root for group-surface tests (kept out of the repo tree). */
const tmpBase = mkdtempSync(join(tmpdir(), 'robot-router-spec-'))
afterEach(() => { rmSync(tmpBase, { recursive: true, force: true }) })

function inbound(content: string, overrides: Partial<RobotInboundMessage> = {}): RobotInboundMessage {
  return {
    type: 2, robotId: 'BOT-r', robotName: '个人助手',
    operatorOpenid: 'u-allowed', operatorName: '测试用户',
    time: Date.now(), msgId: `m-${Math.random().toString(36).slice(2)}`,
    content, groupType: 3, groupId: 'BOT-a-BOT-b', ...overrides,
  }
}

function fakeAgents(getStatus: () => 'idle' | 'running') {
  const created: unknown[] = []
  const createdWith: unknown[] = []
  const byId = new Map<string, unknown>()
  return {
    created,
    createdWith,
    get: (id: { toString(): string }) => byId.get(String(id)),
    resume: async () => Promise.reject(new Error('no persisted log')),
    create: async (options: { sessionId: { toString(): string } }) => {
      createdWith.push(options)
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

function memoryHome() {
  const byConv = new Map<string, { dshSessionId: string; yzjConversationId: string; yzjKind: 'group' | 'dm' }>()
  const bySess = new Map<string, string>()
  const slug = (id: string): string => {
    const cleaned = id.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
    return cleaned === '' ? 'x' : cleaned.slice(0, 80)
  }
  return {
    async ensureBound(id: string, kind: 'group' | 'dm') {
      const existing = byConv.get(id)
      if (existing !== undefined) return { sessionId: existing.dshSessionId, created: false, yzjKind: existing.yzjKind }
      const sessionId = `yzj-home-${slug(id)}`
      byConv.set(id, { dshSessionId: sessionId, yzjConversationId: id, yzjKind: kind })
      bySess.set(sessionId, id)
      return { sessionId, created: true, yzjKind: kind }
    },
    getByConversation: (id: string) => byConv.get(id),
    getBySession: (id: string) => {
      const conv = bySess.get(id)
      return conv === undefined ? undefined : byConv.get(conv)
    },
  }
}

function memoryTopicHome() {
  const rooms = memoryHome()
  const topics = new Map<string, { dshSessionId: string; yzjConversationId: string; rootMsgId?: string }>()
  const outbound = new Map<string, string>()
  const slug = (id: string): string => {
    const cleaned = id.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
    return cleaned === '' ? 'x' : cleaned.slice(0, 40)
  }
  return {
    ...rooms,
    async ensureTopic(input: { yzjConversationId: string; rootMsgId?: string }) {
      await rooms.ensureBound(input.yzjConversationId, input.yzjConversationId.startsWith('BOT-') ? 'dm' : 'group')
      if (input.rootMsgId !== undefined) {
        for (const row of topics.values()) {
          if (row.yzjConversationId === input.yzjConversationId && row.rootMsgId === input.rootMsgId) {
            return { sessionId: row.dshSessionId, created: false }
          }
        }
      }
      const sessionId = `yzj-topic-${slug(input.yzjConversationId)}-${slug(input.rootMsgId ?? `n${topics.size}`)}`
      topics.set(sessionId, {
        dshSessionId: sessionId,
        yzjConversationId: input.yzjConversationId,
        ...(input.rootMsgId === undefined ? {} : { rootMsgId: input.rootMsgId }),
      })
      return { sessionId, created: true }
    },
    getTopicByAnchor(groupId: string, rootMsgId: string) {
      for (const row of topics.values()) {
        if (row.yzjConversationId === groupId && row.rootMsgId === rootMsgId) return row
      }
      return undefined
    },
    getTopicByOutbound(msgId: string) {
      const id = outbound.get(msgId)
      return id === undefined ? undefined : topics.get(id)
    },
    async registerTopicOutbound(msgId: string, sessionId: string) {
      outbound.set(msgId, sessionId)
    },
  }
}

function makeRouter(
  sends: RobotSendResult[],
  agents = fakeAgents(() => 'idle'),
  allowFrom = ['u-allowed'],
    extra: {
    memory?: { lines: (key: string) => readonly string[]; remember: (key: string, line: string) => Promise<{ lines: readonly string[]; note: string }>; forget: (key: string, substring: string) => Promise<{ lines: readonly string[]; note: string }> }
    cwd?: string
    guiUrl?: string
    surface?: unknown
    resolveGroupName?: (groupId: string) => Promise<string | undefined>
    home?: ReturnType<typeof memoryHome> | ReturnType<typeof memoryTopicHome>
  } = {},
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
    home: extra.home ?? memoryHome(),
    ...(extra.memory === undefined ? {} : { memory: extra.memory }),
    ...(extra.cwd === undefined ? {} : { cwd: extra.cwd }),
    ...(extra.guiUrl === undefined ? {} : { guiUrl: extra.guiUrl }),
    ...(extra.surface === undefined ? {} : { surface: extra.surface as never }),
    ...(extra.resolveGroupName === undefined ? {} : { resolveGroupName: extra.resolveGroupName }),
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

  it('anchors one bound group session for every top-level message and continues it on replies', async () => {
    const agents = fakeAgents(() => 'idle')
    const memory = fakeMemory()
    const { router, sendCalls } = makeRouter([], agents, ['u-allowed'], { memory, cwd: tmpBase })
    // Top-level group @: groupId without the BOT- prefix. The first group
    // message runs the intro as its own turn ahead of the user's message (S7).
    await router.handle(inbound('群任务A', { groupId: 'gid-test', msgId: 'root-1' }))
    expect(agents.created).toHaveLength(1)
    const firstId = String((agents.createdWith[0] as { sessionId: { toString(): string } }).sessionId)
    expect(firstId.startsWith('yzj-home-')).toBe(true)
    expect(firstId.startsWith('yzj-robot-')).toBe(false)
    const firstFollowup = (agents.created[0] as { followup: { mock: { calls: unknown[][] } } }).followup.mock.calls
    expect(String(firstFollowup[0]![0]!.content[0]!.text)).toContain('自我介绍')
    expect(String(firstFollowup[1]![0]!.content[0]!.text)).toBe('群任务A')
    // Ack carried notifyParams targeting the asker (group surface).
    const ack = sendCalls[0]!.options
    expect(ack?.notifyOpenIds).toEqual(['u-allowed'])
    // A reply to the robot's ack (msgId 'out-1' from the fake sender) continues the same session.
    await router.handle(inbound('继续刚才的', {
      groupId: 'gid-test',
      msgId: 'reply-1',
      msgParam: JSON.stringify({ replyMsgId: 'out-1', replyRootMsgId: 'root-1', replyPersonName: '测试用户', replySummary: '群任务A' }),
    }))
    expect(agents.created).toHaveLength(1)
    expect((agents.created[0] as { followup: { mock: { calls: unknown[][] } } }).followup.mock.calls).toHaveLength(3)
    // A different top-level message in the SAME group reuses the bound session (no second intro).
    await router.handle(inbound('另一个话题', { groupId: 'gid-test', msgId: 'root-2' }))
    expect(agents.created).toHaveLength(1)
    const followups = (agents.created[0] as { followup: { mock: { calls: unknown[][] } } }).followup.mock.calls
    expect(String(followups.at(-1)![0]!.content[0]!.text)).toBe('另一个话题')
  })

  it('mints a yzj-topic-* per top-level @ and continues it on the reply chain', async () => {
    const agents = fakeAgents(() => 'idle')
    const memory = fakeMemory()
    const { router } = makeRouter([], agents, ['u-allowed'], { memory, cwd: tmpBase, home: memoryTopicHome() })
    await router.handle(inbound('群任务A', { groupId: 'gid-test', msgId: 'root-1' }))
    expect(agents.created).toHaveLength(1)
    const firstId = String((agents.createdWith[0] as { sessionId: { toString(): string } }).sessionId)
    expect(firstId.startsWith('yzj-topic-')).toBe(true)
    await router.handle(inbound('继续刚才的', {
      groupId: 'gid-test',
      msgId: 'reply-1',
      msgParam: JSON.stringify({ replyMsgId: 'out-1', replyRootMsgId: 'root-1', replyPersonName: '测试用户', replySummary: '群任务A' }),
    }))
    expect(agents.created).toHaveLength(1)
    await router.handle(inbound('另一个话题', { groupId: 'gid-test', msgId: 'root-2' }))
    expect(agents.created).toHaveLength(2)
    const secondId = String((agents.createdWith[1] as { sessionId: { toString(): string } }).sessionId)
    expect(secondId.startsWith('yzj-topic-')).toBe(true)
    expect(secondId).not.toBe(firstId)
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
    expect(sendCalls[0]!.options?.replyPersonName).toBe('测试用户')
  })

  it('continueFromDsh injects an operator turn continuing the last group session', async () => {
    const agents = fakeAgents(() => 'idle')
    const memory = fakeMemory()
    const { router, sendCalls } = makeRouter([], agents, ['u-allowed'], { memory, cwd: tmpBase })
    await router.handle(inbound('群任务A', { groupId: 'g1', msgId: 'root-1' }))
    expect(agents.created).toHaveLength(1)
    const result = await router.continueFromDsh('再来一条')
    expect(result.ok).toBe(true)
    expect(result.sessionId).toMatch(/^yzj-home-/)
    expect(result.sessionId?.startsWith('yzj-robot-')).toBe(false)
    // The synthetic ack carries no reply anchor (the fake msgId never existed
    // on the server) but still notifies the asker on group surfaces.
    const syntheticAck = sendCalls[1]!.options
    expect(syntheticAck?.replyMsgId).toBeUndefined()
    expect(syntheticAck?.notifyOpenIds).toEqual(['u-allowed'])
    // Same session, one more user turn (intro + 2 user messages).
    expect(agents.created).toHaveLength(1)
    const followups = (agents.created[0] as { followup: { mock: { calls: unknown[][] } } }).followup.mock.calls
    expect(followups).toHaveLength(3)
    expect(String(followups[2]![0]!.content[0]!.text)).toBe('再来一条')
  })

  it('continueFromDsh refuses without a seen surface or a whitelisted operator', async () => {
    const { router } = makeRouter([], fakeAgents(() => 'idle'), ['u-allowed'])
    const noSurface = await router.continueFromDsh('你好')
    expect(noSurface.ok).toBe(false)
    expect(noSurface.error).toContain('入站')
    const blocked = makeRouter([], fakeAgents(() => 'idle'), [])
    const denied = await blocked.router.continueFromDsh('你好')
    expect(denied.ok).toBe(false)
    expect(denied.error).toContain('白名单')
  })

  it('continueFromDsh runs bang commands without driving the agent', async () => {
    const agents = fakeAgents(() => 'idle')
    const { router, sendCalls } = makeRouter([], agents, ['u-allowed'], { cwd: tmpBase })
    await router.handle(inbound('群任务A', { groupId: 'g1', msgId: 'root-1' }))
    const result = await router.continueFromDsh('!status')
    expect(result.ok).toBe(true)
    expect(sendCalls.at(-1)!.text).toContain('会话')
    expect(agents.created).toHaveLength(1)
  })

  it('surfaceSummary lists seen surfaces most recent first', async () => {
    const { router } = makeRouter([], fakeAgents(() => 'idle'), ['u-allowed'], { cwd: tmpBase })
    await router.handle(inbound('甲', { groupId: 'g1', msgId: 'm1' }))
    await router.handle(inbound('乙', { groupId: 'g2', msgId: 'm2' }))
    await router.handle(inbound('丙', { groupId: 'g1', msgId: 'm3' }))
    const summary = router.surfaceSummary()
    expect(summary.map(entry => entry.groupId)).toEqual(['g1', 'g2'])
    expect(summary[0]!.robotId).toBe('BOT-r')
    expect(summary[0]!.lastSessionId).toBeDefined()
  })

  it('continueFromDsh continues the persisted home binding after a restart', async () => {
    const agents = fakeAgents(() => 'idle')
    const home = memoryHome()
    await home.ensureBound('g1', 'group')
    const boundId = home.getByConversation('g1')!.dshSessionId
    const store = new Map<string, unknown>([
      ['surface:0:g1', {
        robotId: 'BOT-r', robotName: '群机器人', groupType: 3, time: 1,
        lastSessionId: boundId,
      }],
    ])
    const surface = {
      get: (key: string) => store.get(key),
      put: async (key: string, value: unknown) => { store.set(key, value) },
      getMeta: () => undefined,
      putMeta: async () => {},
      entries: () => [...store.entries()],
    }
    const router = new RobotRouter({
      agents: agents as never,
      sender: { send: async () => ({ ok: true, msgId: 'out-1' }) },
      allowFrom: async () => ['u-allowed'],
      cwd: tmpBase,
      surface: surface as never,
      home,
    })
    const result = await router.continueFromDsh('继续之前的对话')
    expect(result.ok).toBe(true)
    expect(result.sessionId).toBe(boundId)
    expect(result.sessionId?.startsWith('yzj-robot-')).toBe(false)
    expect(agents.created).toHaveLength(1)
  })

  it('surfaceSummary merges persisted surfaces after a restart', async () => {
    const store = new Map<string, unknown>([
      ['surface:0:g1', { robotId: 'BOT-r', robotName: '群机器人', groupType: 3, time: 1 }],
      ['surface:1:g9', { robotId: 'BOT-other', robotName: '别的群', groupType: 3, time: 2 }],
    ])
    const surface = {
      get: (key: string) => store.get(key),
      put: async () => {},
      getMeta: () => undefined,
      putMeta: async () => {},
      entries: () => [...store.entries()],
    }
    const router = new RobotRouter({
      agents: fakeAgents(() => 'idle') as never,
      sender: { send: async () => ({ ok: true }) },
      allowFrom: async () => ['u-allowed'],
      channelIndex: 0,
      cwd: tmpBase,
      surface: surface as never,
    })
    const summary = router.surfaceSummary()
    expect(summary.map(entry => entry.groupId)).toEqual(['g1'])
    expect(summary[0]!.robotId).toBe('BOT-r')
  })

  it('workdir defaults to the 云之家 workspace and honors the option', () => {
    const { router } = makeRouter([])
    expect(router.workdir()).toBe(join(homedir(), '.dsh-yzj', 'workspace'))
    const custom = new RobotRouter({ agents: fakeAgents(() => 'idle') as never, sender: { send: async () => ({ ok: true }) }, allowFrom: async () => ['u'], cwd: 'C:\\work' })
    expect(custom.workdir()).toBe('C:\\work')
  })

  it('resolves one cwd per bound group (not per thread) and the channel root for DMs (§8.4)', async () => {
    const agents = fakeAgents(() => 'idle')
    const { router } = makeRouter([], agents, ['u-allowed'], { cwd: tmpBase })
    await router.handle(inbound('群任务A', { groupId: 'g1', msgId: 'root-1' }))
    await router.handle(inbound('另一个话题', { groupId: 'g1', msgId: 'root-2' }))
    await router.handle(inbound('DM 消息', { groupId: 'BOT-a-BOT-b', msgId: 'dm-1' }))
    const cwds = agents.createdWith.map(options => (options as { meta: { cwd: string } }).meta.cwd)
    expect(agents.createdWith).toHaveLength(2)
    expect(cwds).toEqual([
      join(tmpBase, 'groups', 'g1'),
      tmpBase,
    ])
  })

  it('keeps one thread cwd across reply continuations (§8.4)', async () => {
    const agents = fakeAgents(() => 'idle')
    const { router } = makeRouter([], agents, ['u-allowed'], { cwd: tmpBase })
    await router.handle(inbound('群任务A', { groupId: 'g1', msgId: 'root-1' }))
    await router.handle(inbound('继续', {
      groupId: 'g1',
      msgId: 'reply-1',
      msgParam: JSON.stringify({ replyMsgId: 'out-1', replyRootMsgId: 'root-1', replyPersonName: '测试用户', replySummary: '群任务A' }),
    }))
    expect(agents.createdWith).toHaveLength(1)
    expect((agents.createdWith[0] as { meta: { cwd: string } }).meta.cwd).toBe(join(tmpBase, 'groups', 'g1'))
  })

  it('injects the shared-workspace instruction into group turns only (§8.4)', async () => {
    const agents = fakeAgents(() => 'idle')
    const { router } = makeRouter([], agents, ['u-allowed'], { cwd: tmpBase })
    await router.handle(inbound('群任务A', { groupId: 'g1', msgId: 'root-1' }))
    const groupAgent = agents.created[0] as { inject: { mock: { calls: unknown[][] } } }
    const injected = groupAgent.inject.mock.calls.map(call => String(call[0]!.content[0]!.text)).join('\n')
    expect(injected).toContain('本群共享工作区')
    expect(injected).toContain(join(tmpBase, 'groups', 'g1', 'shared'))
    // DM turns get no shared-workspace instruction.
    const dmAgents = fakeAgents(() => 'idle')
    const { router: dmRouter } = makeRouter([], dmAgents, ['u-allowed'], { cwd: tmpBase })
    await dmRouter.handle(inbound('DM 消息', { msgId: 'dm-1' }))
    const dmAgent = dmAgents.created[0] as { inject: { mock: { calls: unknown[][] } } }
    expect(dmAgent.inject.mock.calls).toHaveLength(0)
  })

  it('writes inbound ① into the bound log (self in Yunzhijia client is isSelf, not ②)', async () => {
    const appended: { origin: string; isSelf: boolean; content: string; msgId: string }[] = []
    const home = {
      ...memoryHome(),
      appendLog: async (_id: string, incoming: { origin: string; isSelf: boolean; content: string; msgId: string }) => {
        appended.push(incoming)
        return { accepted: true, reason: 'appended' }
      },
    }
    const { router } = makeRouter([], fakeAgents(() => 'idle'), ['u-allowed'], { home: home as never, cwd: tmpBase })
    await router.handle(inbound('我在客户端发的', { groupId: 'g1', msgId: 'm-self', operatorOpenid: 'u-allowed' }))
    expect(appended.some(row => row.origin === 'inbound' && row.msgId === 'm-self')).toBe(true)
    expect(appended.some(row => row.origin === 'robot-outbound')).toBe(true)
  })

  it('injects the shared summon window on @机器人 turns (T5)', async () => {
    const home = {
      ...memoryHome(),
      formatSummonWindow: () => '［本群最近消息（仅本轮上下文，非完整群档）］\n[20:00] 同事: 上下文',
    }
    const agents = fakeAgents(() => 'idle')
    const { router } = makeRouter([], agents, ['u-allowed'], { home: home as never, cwd: tmpBase })
    await router.handle(inbound('帮我总结', { groupId: 'g1', msgId: 'm-ask' }))
    const agent = agents.created[0] as { inject: { mock: { calls: unknown[][] } } }
    const injected = agent.inject.mock.calls.map(call => String(call[0]!.content[0]!.text)).join('\n')
    expect(injected).toContain('本群最近消息')
    expect(injected).toContain('本群共享工作区')
  })

  it('!configure without guiUrl gives panel guidance; with guiUrl gives the link', async () => {
    const { router: plain, sendCalls: plainCalls } = makeRouter([])
    await plain.handle(inbound('!configure'))
    expect(plainCalls[0]!.text).toContain('机器人设置')
    expect(plainCalls[0]!.text).not.toContain('http')
    const { router: linked, sendCalls: linkedCalls } = makeRouter([], fakeAgents(() => 'idle'), ['u-allowed'], { guiUrl: 'http://127.0.0.1:3080' })
    await linked.handle(inbound('!configure'))
    expect(linkedCalls[0]!.text).toContain('http://127.0.0.1:3080')
  })

  it('!feedback appends to the local log under DSH_HOME and acknowledges', async () => {
    vi.stubEnv('DSH_HOME', tmpBase)
    try {
      const { router, sendCalls } = makeRouter([])
      await router.handle(inbound('!feedback 机器人回复有点慢，建议提速。'))
      expect(sendCalls[0]!.text).toContain('已记录反馈（14 字）')
      const log = readFileSync(join(tmpBase, 'robot-feedback.log'), 'utf8')
      expect(log).toContain('机器人回复有点慢')
      expect(log).toContain('group=')
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('!fork refuses the current group and reports an unknown target', async () => {
    const { router, sendCalls } = makeRouter([])
    await router.handle(inbound('!fork gid-test 继续调研', { groupId: 'gid-test' }))
    expect(sendCalls[0]!.text).toContain('不能交接给当前群')
    await router.handle(inbound('!fork g-unknown 继续调研', { groupId: 'gid-test' }))
    expect(sendCalls[1]!.text).toContain('交接失败')
    expect(sendCalls[1]!.text).toContain('没有找到群')
  })

  it('!fork hands context over to a target surface through the inbound pipeline', async () => {
    const surface = {
      get: (key: string) => key === 'surface:0:g-target'
        ? { robotId: 'BOT-r', robotName: '群机器人', groupType: 3, time: Date.now() }
        : undefined,
      put: async () => {}, getMeta: () => undefined, putMeta: async () => {}, entries: () => [],
    }
    const agents = fakeAgents(() => 'idle')
    const { router, sendCalls } = makeRouter([], agents, ['u-allowed'], { surface, cwd: tmpBase })
    // Seed the source session with completed assistant output.
    await router.handle(inbound('给我讲讲项目', { groupId: 'gid-test', msgId: 'root-1' }))
    const source = agents.created[0] as { session: { events: unknown[] } }
    source.session.events = [
      { type: 'user/message', seq: 0, time: 0, data: {} },
      { type: 'assistant/message', seq: 1, time: 0, data: { message: { content: [{ type: 'text', text: '项目要点：A、B、C。' }] } } },
      { type: 'turn/end', seq: 2, time: 0, data: { reason: { kind: 'completed' } } },
    ] as never as import('@deepseek-ai/dsh-session').SessionEvent[]
    const before = sendCalls.length
    await router.handle(inbound('!fork g-target 继续调研', { groupId: 'gid-test', msgId: 'root-2' }))
    // The target group's bound session is created once; the source group
    // received a handover receipt. No fork-* root.
    expect(agents.created).toHaveLength(2)
    const ids = agents.createdWith.map(options => String((options as { sessionId: { toString(): string } }).sessionId))
    expect(ids.every(id => id.startsWith('yzj-home-'))).toBe(true)
    expect(ids.some(id => id.startsWith('fork-') || id.startsWith('yzj-robot-'))).toBe(false)
    const targetFollowups = (agents.created[1] as { followup: { mock: { calls: unknown[][] } } }).followup.mock.calls
    const handoverText = String(targetFollowups.at(-1)![0]!.content[0]!.text)
    expect(handoverText).toContain('继续调研')
    expect(handoverText).toContain('项目要点：A、B、C')
    expect(handoverText).toContain('来自群 gid-test')
    const receipt = sendCalls.at(-1)!
    expect(receipt.text).toContain('已交接给群 g-target')
    expect(receipt.text).toContain('附 11 字上下文摘要')
    expect(sendCalls.length).toBeGreaterThan(before)
  })

  it('!fork to the same target a second time does not create a third root', async () => {
    const surface = {
      get: (key: string) => key === 'surface:0:g-target'
        ? { robotId: 'BOT-r', robotName: '群机器人', groupType: 3, time: Date.now() }
        : undefined,
      put: async () => {}, getMeta: () => undefined, putMeta: async () => {}, entries: () => [],
    }
    const agents = fakeAgents(() => 'idle')
    const { router } = makeRouter([], agents, ['u-allowed'], { surface, cwd: tmpBase })
    await router.handle(inbound('给我讲讲项目', { groupId: 'gid-test', msgId: 'root-1' }))
    await router.handle(inbound('!fork g-target 继续调研', { groupId: 'gid-test', msgId: 'root-2' }))
    expect(agents.created).toHaveLength(2)
    await router.handle(inbound('!fork g-target 再交接一次', { groupId: 'gid-test', msgId: 'root-3' }))
    expect(agents.created).toHaveLength(2)
    const ids = agents.createdWith.map(options => String((options as { sessionId: { toString(): string } }).sessionId))
    expect(ids.some(id => id.startsWith('fork-'))).toBe(false)
  })

  it('!fork resolves a target by group name (surface groupName and lazy resolver)', async () => {
    const surface = {
      get: (key: string) => key === 'surface:0:g-target'
        ? { robotId: 'BOT-r', robotName: '群机器人', groupType: 3, time: Date.now(), groupName: '目标群A' }
        : key === 'surface:0:g-other'
          ? { robotId: 'BOT-r', robotName: '群机器人', groupType: 3, time: Date.now() }
          : undefined,
      put: async () => {}, getMeta: () => undefined, putMeta: async () => {},
      entries: () => [
        ['surface:0:g-target', { robotId: 'BOT-r', robotName: '群机器人', groupType: 3, time: Date.now(), groupName: '目标群A' }],
        ['surface:0:g-other', { robotId: 'BOT-r', robotName: '群机器人', groupType: 3, time: Date.now() }],
      ] as [string, { robotId: string; robotName: string; groupType: number; time: number; groupName?: string }][],
    }
    const resolveGroupName = vi.fn(async (groupId: string) => groupId === 'g-other' ? '目标群B' : undefined)
    const agents = fakeAgents(() => 'idle')
    const { router, sendCalls } = makeRouter([], agents, ['u-allowed'], { surface, cwd: tmpBase, resolveGroupName })
    // Named target with the name persisted on the surface.
    await router.handle(inbound('!fork 目标群A 继续调研', { groupId: 'gid-test', msgId: 'root-1' }))
    expect(sendCalls.at(-1)!.text).toContain('已交接给群 目标群A（g-target）')
    // Named target resolved lazily through the resolver.
    await router.handle(inbound('!fork 目标群B 继续调研', { groupId: 'gid-test', msgId: 'root-2' }))
    expect(sendCalls.at(-1)!.text).toContain('已交接给群 目标群B（g-other）')
    expect(resolveGroupName).toHaveBeenCalledWith('g-other')
    // Unknown name reports a clear failure.
    await router.handle(inbound('!fork 不存在的群 继续调研', { groupId: 'gid-test', msgId: 'root-3' }))
    expect(sendCalls.at(-1)!.text).toContain('没有找到群「不存在的群」')
  })

  it('conversationSummary is bounded and newest-first', () => {
    const events = [
      { type: 'assistant/message', seq: 0, time: 0, data: { message: { content: [{ type: 'text', text: '旧内容' }] } } },
      { type: 'assistant/message', seq: 1, time: 0, data: { message: { content: [{ type: 'text', text: '新内容' }] } } },
    ] as never as import('@deepseek-ai/dsh-session').SessionEvent[]
    expect(conversationSummary(events)).toBe('旧内容\n新内容')
    expect(conversationSummary(events, 3)).toBe('新内容')
    expect(conversationSummary([])).toBe('')
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
