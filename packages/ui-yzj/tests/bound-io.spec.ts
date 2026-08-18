/**
 * Bound-home I/O: optimistic ②, backfill/dedupe, fused merge, D8 handoff.
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import {
  BoundLogStore, formatSummonWindow, type BoundLogLimits, type YzjLogEntry,
} from '@dsh-yzj/tool-yzj/src/bound-log.ts'
import {
  backfillBoundLog, fusedSnapshot, groupSpaceSnapshot, handoffToGroup, parseImSend, parseWhoami, robotSkipOpenIds,
  sendImAndLog, topicLensBubbles, askTopicAssistant, type HomeIoFace,
} from '../src/bound-io.ts'

function entry(over: Partial<YzjLogEntry> & Pick<YzjLogEntry, 'msgId'>): YzjLogEntry {
  return {
    sentAt: 1_000,
    fromOpenId: 'me',
    fromName: '国鑫',
    content: 'hi',
    msgType: 'text',
    origin: 'inbound',
    isSelf: true,
    status: 'acked',
    ...over,
  }
}

function memoryHomeIo(): HomeIoFace {
  const store = new BoundLogStore()
  const bindings = new Map<string, { dshSessionId: string; yzjConversationId: string; yzjKind: 'group' | 'dm' }>()
  const bySess = new Map<string, string>()
  const topics = new Map<string, {
    dshSessionId: string
    yzjConversationId: string
    title: string
    source: 'dsh' | 'yzj' | 'handoff'
    createdAt: number
    rootMsgId?: string
    originText?: string
    originWho?: string
  }>()
  const face: HomeIoFace = {
    async ensureBound(id, kind) {
      const existing = bindings.get(id)
      if (existing !== undefined) return { sessionId: existing.dshSessionId, created: false, yzjKind: existing.yzjKind }
      const sessionId = `yzj-home-${id}`
      bindings.set(id, { dshSessionId: sessionId, yzjConversationId: id, yzjKind: kind })
      bySess.set(sessionId, id)
      await store.ensureHeader(id, sessionId, kind)
      return { sessionId, created: true, yzjKind: kind }
    },
    async ensureTopic(input) {
      const sessionId = `yzj-topic-${input.yzjConversationId}-${input.rootMsgId ?? 'handoff'}`
      const existing = topics.get(sessionId)
      if (existing !== undefined) {
        return { sessionId, created: false, record: existing }
      }
      const record = {
        dshSessionId: sessionId,
        yzjConversationId: input.yzjConversationId,
        title: input.title ?? '话题',
        source: input.source,
        createdAt: Date.now(),
        ...(input.rootMsgId === undefined ? {} : { rootMsgId: input.rootMsgId }),
        ...(input.originText === undefined ? {} : { originText: input.originText }),
        ...(input.originWho === undefined ? {} : { originWho: input.originWho }),
      }
      topics.set(sessionId, record)
      return { sessionId, created: true, record }
    },
    getTopicBySession: (id) => topics.get(id),
    getByConversation: id => bindings.get(id),
    getBySession: id => {
      const conv = bySess.get(id)
      return conv === undefined ? undefined : bindings.get(conv)
    },
    appendLog: async (id, incoming, options) => {
      const binding = bindings.get(id)
      if (binding === undefined) return { accepted: false, reason: 'unbound' }
      return store.append(id, binding.dshSessionId, binding.yzjKind, incoming, options)
    },
    getLog: id => store.get(id),
    getLogBySession: id => {
      const conv = bySess.get(id)
      return conv === undefined ? undefined : store.get(conv)
    },
    ackLocal: (id, local, real) => store.ackLocal(id, local, real),
    failLocal: (id, local) => store.failLocal(id, local),
    formatSummonWindow: (id, exclude, sessionId) => formatSummonWindow(store.get(id), {
      maxMessages: 20, maxChars: 4000, groupId: id,
      ...(exclude === undefined ? {} : { excludeMsgId: exclude }),
      ...(sessionId === undefined ? {} : {
        topic: { title: '排期', rootMsgId: 'm1', originText: '帮我整理' },
      }),
    }),
    logs: store,
    listTopics: () => [],
  }
  return face
}

function runOf(json: unknown) {
  return { ok: true as const, exitCode: 0, stdout: JSON.stringify(json), stderr: '', json }
}

describe('parseImSend / whoami / skip', () => {
  it('rejects atOpenIds that do not match @ fragments', () => {
    expect(parseImSend({ groupId: 'g1', content: '@张三 你好', atOpenIds: [] })).toContain('atOpenIds')
  })

  it('parses whoami envelopes (pitfall-003)', () => {
    expect(parseWhoami([{ openId: 'me', name: '国鑫' }])).toEqual({ openId: 'me', name: '国鑫' })
    expect(parseWhoami({ oId: 'me', name: '国鑫' })).toEqual({ openId: 'me', name: '国鑫' })
  })

  it('collects robotIds from channel surfaces', () => {
    expect(robotSkipOpenIds({
      statuses: () => [{ surface: [{ robotId: 'BOT-r' }] }],
    })).toEqual(['BOT-r'])
  })
})

describe('sendImAndLog', () => {
  it('writes optimistic ② then acks the real msgId (no user-turn)', async () => {
    const home = memoryHomeIo()
    const ctx = new Context()
    const commands: string[][] = []
    ;(ctx as unknown as { yzjBridge: { run: (command: readonly string[]) => Promise<ReturnType<typeof runOf>> } }).yzjBridge = {
      run: async (command) => {
        commands.push([...command])
        if (command[0] === 'contact') return runOf([{ openId: 'me', name: '国鑫' }])
        return runOf({ msgId: 'm-real' })
      },
    }
    const sent = await sendImAndLog(ctx, home, {
      groupId: 'g-a', msgType: 'text', content: '发进群一句', images: [], atOpenIds: [], atAll: false,
    })
    expect(sent.ok).toBe(true)
    const log = home.getLog('g-a')
    expect(log?.entries).toHaveLength(1)
    expect(log?.entries[0]?.origin).toBe('dsh-send')
    expect(log?.entries[0]?.msgId).toBe('m-real')
    expect(log?.entries[0]?.status).toBe('acked')
    expect(log?.entries[0]?.isSelf).toBe(true)
    expect(commands.some(row => row[0] === 'im' && row[1] === 'message' && row[2] === 'send')).toBe(true)
  })

  it('marks local-* failed when the CLI send fails', async () => {
    const home = memoryHomeIo()
    const ctx = new Context()
    ;(ctx as unknown as { yzjBridge: { run: (command: readonly string[]) => Promise<{ ok: boolean; exitCode: number; stdout: string; stderr: string; json?: unknown }> } }).yzjBridge = {
      run: async (command) => {
        if (command[0] === 'contact') return runOf([{ openId: 'me', name: '国鑫' }])
        return { ok: false, exitCode: 1, stdout: '', stderr: 'denied' }
      },
    }
    const sent = await sendImAndLog(ctx, home, {
      groupId: 'g-a', msgType: 'text', content: '失败', images: [], atOpenIds: [], atAll: false,
    })
    expect(sent.ok).toBe(false)
    expect(home.getLog('g-a')?.entries[0]?.status).toBe('failed')
    expect(home.getLog('g-a')?.entries[0]?.origin).toBe('dsh-send')
  })
})

describe('backfillBoundLog', () => {
  it('pages newest then old up to the cap and dedupes by msgId', async () => {
    const home = memoryHomeIo()
    await home.ensureBound('g-a', 'group')
    await home.appendLog('g-a', entry({ msgId: 'm2', content: 'already', origin: 'dsh-send' }))
    const ctx = new Context()
    const commands: string[][] = []
    ;(ctx as unknown as { yzjBridge: { run: (command: readonly string[]) => Promise<ReturnType<typeof runOf>> } }).yzjBridge = {
      run: async (command) => {
        commands.push([...command])
        if (command[0] === 'contact') return runOf([{ openId: 'me', name: '国鑫' }])
        if (command.includes('newest')) {
          return runOf({ list: [
            { msgId: 'm1', content: '旧', fromOpenId: 'u2', fromName: '同事', sendTime: '2026-08-16 20:00:00.000' },
            { msgId: 'm2', content: 'already', fromOpenId: 'me', fromName: '国鑫', sendTime: '2026-08-16 20:01:00.000' },
          ] })
        }
        return runOf({ list: [] })
      },
    }
    home.logs.setLimits({ backfillLimit: 20 } as Partial<BoundLogLimits>)
    const stats = await backfillBoundLog(ctx, home, 'g-a', 20)
    expect(stats.appended).toBe(1)
    expect(home.getLog('g-a')?.entries.find(row => row.msgId === 'm2')?.origin).toBe('dsh-send')
    expect(home.getLog('g-a')?.entries.find(row => row.msgId === 'm1')?.origin).toBe('backfill')
    expect(commands.some(row => row.includes('newest'))).toBe(true)
  })

  it('keeps robot outbound posts as 助手 (R9, no longer T12 skip)', async () => {
    const home = memoryHomeIo()
    await home.ensureBound('g-a', 'group')
    const ctx = new Context()
    ctx.provide('yzjRobot', { statuses: () => [{ surface: [{ robotId: 'BOT-r' }] }] })
    ;(ctx as unknown as { yzjBridge: { run: (command: readonly string[]) => Promise<ReturnType<typeof runOf>> } }).yzjBridge = {
      run: async (command) => {
        if (command[0] === 'contact') return runOf([{ openId: 'me' }])
        return runOf({ list: [{ msgId: 'bot-1', content: '机器人帖', fromOpenId: 'BOT-r', fromName: '个人助手', sendTime: '2026-08-16 20:00:00.000' }] })
      },
    }
    await backfillBoundLog(ctx, home, 'g-a', 20)
    expect(home.getLog('g-a')?.entries).toHaveLength(1)
    expect(home.getLog('g-a')?.entries[0]?.origin).toBe('robot-outbound')
    expect(home.getLog('g-a')?.entries[0]?.fromName).toBe('个人助手')
  })

  it('fills empty fromName via contact user get, cached per openId', async () => {
    const home = memoryHomeIo()
    await home.ensureBound('g-a', 'group')
    const ctx = new Context()
    const contactCalls: string[][] = []
    ;(ctx as unknown as { yzjBridge: { run: (command: readonly string[]) => Promise<ReturnType<typeof runOf>> } }).yzjBridge = {
      run: async (command) => {
        if (command[0] === 'contact') {
          contactCalls.push([...command])
          if (command.includes('--open-id')) return runOf([{ openId: 'u2', name: '老黎' }])
          return runOf([{ openId: 'me', name: '国鑫' }])
        }
        return runOf({ list: [
          { msgId: 'm1', content: '一', fromUser: { openId: 'u2' }, sendTime: '2026-08-16 20:00:00.000' },
          { msgId: 'm2', content: '二', fromUser: { openId: 'u2' }, sendTime: '2026-08-16 20:01:00.000' },
        ] })
      },
    }
    await backfillBoundLog(ctx, home, 'g-a', 20)
    expect(home.getLog('g-a')?.entries.map(row => row.fromName)).toEqual(['老黎', '老黎'])
    expect(contactCalls.filter(row => row.includes('--open-id'))).toHaveLength(1)
  })
})

describe('fusedSnapshot', () => {
  it('merges log ①② with session ③④ and pending overlay', async () => {
    const home = memoryHomeIo()
    await home.ensureBound('g-a', 'group')
    await home.appendLog('g-a', entry({ msgId: 'm1', sentAt: 10, origin: 'inbound', isSelf: false, content: '群里一句' }))
    const agent = {
      session: {
        events: [
          { type: 'user/message', time: 20, data: { source: { kind: 'user' }, content: [{ type: 'text', text: '发给助手' }] } },
          { type: 'user/message', time: 15, data: { source: { kind: 'plugin' }, content: [{ type: 'text', text: '扳机' }] } },
        ],
      },
    }
    const snapshot = fusedSnapshot(home, 'yzj-home-g-a', agent, [
      { writeId: 'w1', sessionId: 'yzj-home-g-a', toolName: 'yzj_im_message_send', level: 'standard', domain: 'im', args: {}, reason: '', status: 'pending', time: 25 },
    ])
    expect(snapshot.bound).toBe(true)
    expect(snapshot.items.map(item => item.kind)).toEqual(['im', 'session', 'session', 'pending'])
    const hidden = snapshot.items.find(item => item.kind === 'session' && item.hide)
    expect(hidden).toBeDefined()
  })

  it('unbound private sessions expose no log stream', () => {
    const home = memoryHomeIo()
    const snapshot = fusedSnapshot(home, 'plain-private', { session: { events: [] } }, [])
    expect(snapshot.bound).toBe(false)
    expect(snapshot.items).toEqual([])
  })
})

describe('handoffToGroup', () => {
  it('posts the digest as ② and followups the bound session', async () => {
    const home = memoryHomeIo()
    const ctx = new Context()
    ;(ctx as unknown as { yzjBridge: { run: (command: readonly string[]) => Promise<ReturnType<typeof runOf>> } }).yzjBridge = {
      run: async (command) => {
        if (command[0] === 'contact') return runOf([{ openId: 'me', name: '国鑫' }])
        return runOf({ msgId: 'm-digest' })
      },
    }
    const followups: unknown[] = []
    const live = new Map<string, { followup: (msg: unknown) => void; inject: (msg: unknown) => void }>()
    const agents = {
      get: (id: string) => live.get(id),
      resume: async () => { throw new Error('no log') },
      create: async (opts: { sessionId: string }) => {
        const agent = { followup: (msg: unknown) => { followups.push(msg) }, inject: () => {} }
        live.set(opts.sessionId, agent)
      },
    }
    const result = await handoffToGroup({
      ctx, home, agents, groupId: 'g-target', digest: '［摘要］结论', cwd: '/tmp',
    })
    expect(result).toMatchObject({ sessionId: 'yzj-home-g-target' })
    expect(home.getLog('g-target')?.entries[0]?.origin).toBe('dsh-send')
    expect(home.getLog('g-target')?.entries[0]?.content).toContain('结论')
    expect(followups).toHaveLength(1)
  })
})

describe('groupSpaceSnapshot', () => {
  it('nests topics under the group-room parent', async () => {
    const home = memoryHomeIo()
    await home.ensureBound('g-a', 'group')
    const topics = [{
      dshSessionId: 'yzj-topic-g-a-m1',
      yzjConversationId: 'g-a',
      title: '整理接口清单',
      source: 'dsh' as const,
      createdAt: 1,
    }]
    home.listBindings = () => [{
      dshSessionId: 'yzj-home-g-a',
      yzjConversationId: 'g-a',
      yzjKind: 'group',
    }]
    home.listTopics = () => topics
    const agents = {
      get: (id: string) => id === 'yzj-home-g-a'
        ? { session: { events: [{ type: 'session/title', data: { title: '测试群' } }] } }
        : undefined,
    }
    expect(groupSpaceSnapshot(home, agents)).toEqual({
      rooms: [{
        groupId: 'g-a',
        groupName: '测试群',
        sessionId: 'yzj-home-g-a',
        yzjKind: 'group',
        topics: [{ sessionId: 'yzj-topic-g-a-m1', title: '整理接口清单', source: 'dsh', lastActivity: 1, status: 'running' }],
      }],
    })
  })
})

describe('topic lens / ask', () => {
  it('merges fromSessionId host ③④ with topic turns and hides plugin injects', () => {
    const bubbles = topicLensBubbles({
      dshSessionId: 'yzj-topic-1',
      yzjConversationId: 'g-a',
      title: '历史对话',
      source: 'handoff',
      createdAt: 1,
      fromSessionId: 'yzj-home-g-a',
    }, {
      get: (id) => {
        if (id === 'yzj-home-g-a') {
          return {
            session: {
              events: [
                { type: 'user/message', time: 1, data: { content: '旧问题', source: { kind: 'user' } } },
                { type: 'assistant/message', time: 2, data: { content: '旧回答' } },
              ],
            },
          }
        }
        if (id === 'yzj-topic-1') {
          return {
            session: {
              events: [
                { type: 'user/message', time: 3, data: { content: '升级摘要', source: { kind: 'plugin', plugin: 'ui-yzj' } } },
                { type: 'user/message', time: 4, data: { content: '新问', source: { kind: 'user' } } },
              ],
            },
          }
        }
        return undefined
      },
    })
    expect(bubbles.map(row => row.text)).toEqual(['旧问题', '旧回答', '新问'])
    expect(bubbles.map(row => row.role)).toEqual(['user', 'assistant', 'user'])
  })

  it('followups a user turn on the topic without requiring native focus', async () => {
    const followups: unknown[] = []
    const injected: unknown[] = []
    const touched: unknown[] = []
    const home = memoryHomeIo()
    await home.ensureBound('g-a', 'group')
    await home.appendLog('g-a', entry({
      msgId: 'm1', content: '帮我整理接口清单', fromName: '老黎', sentAt: 2_000,
    }))
    home.getTopicBySession = (id) => id === 'yzj-topic-1'
      ? {
        dshSessionId: 'yzj-topic-1',
        yzjConversationId: 'g-a',
        title: '排期',
        source: 'dsh',
        createdAt: 1,
        rootMsgId: 'm1',
        originText: '帮我整理接口清单',
        originWho: '老黎',
      }
      : undefined
    home.ensureTopic = async (input) => {
      touched.push(input)
      return { sessionId: 'yzj-topic-1', created: false, record: home.getTopicBySession!('yzj-topic-1')! }
    }
    const result = await askTopicAssistant({
      home,
      agents: {
        get: (id) => id === 'yzj-topic-1'
          ? {
            inject: (message: unknown) => { injected.push(message) },
            followup: (message: unknown) => { followups.push(message) },
          }
          : undefined,
        resume: async () => undefined,
        create: async () => undefined,
      },
      cwd: '/tmp',
      topicSessionId: 'yzj-topic-1',
      text: ' 继续刚才的 ',
    })
    expect(result).toEqual({ ok: true })
    expect(injected).toHaveLength(1)
    const windowText = JSON.stringify(injected[0])
    expect(windowText).toContain('本群最近消息')
    expect(windowText).toContain('groupId: g-a')
    expect(followups).toHaveLength(1)
    const turn = followups[0] as { id: string; role: string; content: unknown; source: unknown }
    expect(typeof turn.id).toBe('string')
    expect(turn.id.length).toBeGreaterThan(0)
    expect(turn).toMatchObject({
      role: 'user',
      content: [{ type: 'text', text: '继续刚才的' }],
      source: { kind: 'user' },
    })
    expect(touched).toEqual([{ yzjConversationId: 'g-a', source: 'dsh', rootMsgId: 'm1' }])
  })
})
