import { describe, expect, it } from 'vitest'
import {
  openBoundHome, openTopicHome, publishHostSession, topicSidebarTitle,
  topicAgentRoute, topicAgentComposition, identifiedUserMessage,
} from '../src/home-open.ts'
import type { HomeOpenFace } from '../src/home-open.ts'

function memoryHome(): HomeOpenFace & { topicInputs: Record<string, unknown>[] } {
  const byConv = new Map<string, { sessionId: string; yzjKind: 'group' | 'dm' }>()
  const topics = new Map<string, { sessionId: string; rootMsgId?: string }>()
  const topicInputs: Record<string, unknown>[] = []
  return {
    topicInputs,
    async ensureBound(id, kind) {
      const existing = byConv.get(id)
      if (existing !== undefined) return { sessionId: existing.sessionId, created: false, yzjKind: existing.yzjKind }
      const sessionId = `yzj-home-${id}`
      byConv.set(id, { sessionId, yzjKind: kind })
      return { sessionId, created: true, yzjKind: kind }
    },
    async ensureTopic(input) {
      topicInputs.push({ ...input })
      if (input.rootMsgId !== undefined) {
        for (const row of topics.values()) {
          if (row.rootMsgId === input.rootMsgId) return { sessionId: row.sessionId, created: false }
        }
      }
      const sessionId = `yzj-topic-${input.yzjConversationId}-${input.rootMsgId ?? 'new'}`
      topics.set(sessionId, { sessionId, ...(input.rootMsgId === undefined ? {} : { rootMsgId: input.rootMsgId }) })
      return { sessionId, created: true }
    },
  }
}

function fakeAgents() {
  const live = new Map<string, {
    session: { events: { type: string; data?: unknown }[]; append: (type: string, data: unknown) => void }
    inject: (message: unknown) => void
  }>()
  const created: string[] = []
  const createdWith: unknown[] = []
  const injected: unknown[] = []
  return {
    created,
    createdWith,
    injected,
    live,
    get: (id: string) => live.get(id),
    resume: async () => { throw new Error('no log') },
    create: async (options: {
      sessionId: string
      meta?: { cwd: string; agentPreset?: string }
      agentOptions?: { provider: string; model: string }
      setup?: (agentCtx: unknown) => void | Promise<void>
    }) => {
      created.push(options.sessionId)
      createdWith.push(options)
      const events: { type: string; data?: unknown }[] = []
      const agent = {
        session: {
          events,
          append: (type: string, data: unknown) => { events.push({ type, data }) },
        },
        inject: (message: unknown) => { injected.push(message) },
      }
      live.set(options.sessionId, agent)
      return agent
    },
  }
}

describe('openBoundHome', () => {
  it('binds once; the second open is focus (same id, created false)', async () => {
    const home = memoryHome()
    const agents = fakeAgents()
    const first = await openBoundHome({ home, agents, yzjConversationId: 'g-a', cwd: '/tmp' })
    expect(first.created).toBe(true)
    expect(first.sessionId).toBe('yzj-home-g-a')
    expect(first.yzjKind).toBe('group')
    expect(first.agentCreated).toBe(false)
    expect(agents.created).toEqual([])
    const second = await openBoundHome({ home, agents, yzjConversationId: 'g-a', cwd: '/tmp' })
    expect(second.created).toBe(false)
    expect(second.sessionId).toBe(first.sessionId)
    expect(second.agentCreated).toBe(false)
    expect(agents.created).toEqual([])
    expect(home.topicInputs).toEqual([])
    expect(first.legacyTopicSessionId).toBeUndefined()
  })

  it('does not mint a room agent just to bind (R27)', async () => {
    const home = memoryHome()
    const agents = fakeAgents()
    await openBoundHome({ home, agents, yzjConversationId: 'g-a', cwd: '/tmp', title: '测试群' })
    expect(agents.created).toEqual([])
    expect(agents.live.get('yzj-home-g-a')).toBeUndefined()
  })

  it('mints 历史对话 when the host already has ③④; second open is focus', async () => {
    const home = memoryHome()
    const agents = fakeAgents()
    await agents.create({ sessionId: 'yzj-home-g-a' })
    agents.live.get('yzj-home-g-a')?.session.append('user/message', {
      content: '旧问题', source: { kind: 'user' },
    })
    const first = await openBoundHome({ home, agents, yzjConversationId: 'g-a', cwd: '/tmp', title: '测试群' })
    expect(first.legacyTopicSessionId).toBe('yzj-topic-g-a-legacy-host')
    expect(home.topicInputs[0]).toMatchObject({
      source: 'handoff',
      rootMsgId: 'legacy-host',
      title: '历史对话',
      fromSessionId: 'yzj-home-g-a',
      quiet: true,
      lastActivity: 1,
    })
    expect(agents.created).toContain('yzj-topic-g-a-legacy-host')
    expect(agents.injected).toHaveLength(1)
    const second = await openBoundHome({ home, agents, yzjConversationId: 'g-a', cwd: '/tmp', title: '测试群' })
    expect(second.legacyTopicSessionId).toBe(first.legacyTopicSessionId)
    expect(home.topicInputs.filter(row => row.rootMsgId === 'legacy-host')).toHaveLength(2)
    expect(agents.created.filter(id => id === 'yzj-topic-g-a-legacy-host')).toEqual(['yzj-topic-g-a-legacy-host'])
    expect(agents.injected).toHaveLength(1)
  })

  it('does not mint 历史对话 for a DM host with ③④', async () => {
    const home = memoryHome()
    const agents = fakeAgents()
    await agents.create({ sessionId: 'yzj-home-BOT-a' })
    agents.live.get('yzj-home-BOT-a')?.session.append('user/message', {
      content: '私聊旧话', source: { kind: 'user' },
    })
    const opened = await openBoundHome({ home, agents, yzjConversationId: 'BOT-a', cwd: '/tmp' })
    expect(opened.yzjKind).toBe('dm')
    expect(opened.legacyTopicSessionId).toBeUndefined()
    expect(home.topicInputs).toEqual([])
  })
})

describe('openTopicHome', () => {
  it('mints a yzj-topic-* id; the same root is focus', async () => {
    const home = memoryHome()
    const agents = fakeAgents()
    const first = await openTopicHome({
      home, agents, yzjConversationId: 'g-a', cwd: '/tmp', source: 'dsh', rootMsgId: 'm1', originText: '帮我整理',
    })
    expect(first.sessionId).toBe('yzj-topic-g-a-m1')
    expect(first.topicCreated).toBe(true)
    expect(agents.created).toEqual(['yzj-topic-g-a-m1'])
    const second = await openTopicHome({
      home, agents, yzjConversationId: 'g-a', cwd: '/tmp', source: 'dsh', rootMsgId: 'm1',
    })
    expect(second.created).toBe(false)
    expect(second.sessionId).toBe(first.sessionId)
    expect(agents.created).toEqual(['yzj-topic-g-a-m1'])
  })

  it('pins sidebar title as 话题 · 群名 so narrow sidebars keep the distinguishing part', async () => {
    const home = memoryHome()
    const agents = fakeAgents()
    await openTopicHome({
      home, agents, yzjConversationId: 'g-a', cwd: '/tmp', source: 'dsh', rootMsgId: 'm1',
      originText: '帮我整理接口清单', groupName: '测试群',
    })
    const title = agents.live.get('yzj-topic-g-a-m1')?.session.events.findLast(event => event.type === 'session/title')
    expect(title?.data).toMatchObject({ title: '帮我整理接口清单 · 测试群' })
  })

  it('does not seed an empty turn 1 on a topic (pitfall-025)', async () => {
    const home = memoryHome()
    const agents = fakeAgents()
    await openTopicHome({
      home, agents, yzjConversationId: 'g-a', cwd: '/tmp', source: 'dsh', rootMsgId: 'm1', originText: '帮我整理',
    })
    const types = agents.live.get('yzj-topic-g-a-m1')?.session.events.map(event => event.type)
    expect(types).toEqual(['session/title'])
    expect(types?.includes('turn/start')).toBe(false)
  })

  it('forwards agentOptions on create so persona {{model}} can resolve', async () => {
    const home = memoryHome()
    const agents = fakeAgents()
    await openTopicHome({
      home, agents, yzjConversationId: 'g-a', cwd: '/tmp', source: 'dsh', rootMsgId: 'm1',
      agentOptions: { provider: 'deepseek-official', model: 'deepseek-chat' },
    })
    expect(agents.createdWith[0]).toMatchObject({
      sessionId: 'yzj-topic-g-a-m1',
      agentOptions: { provider: 'deepseek-official', model: 'deepseek-chat' },
    })
  })

  it('mounts the default agent preset so topics get standard tools (R28)', async () => {
    const home = memoryHome()
    const agents = fakeAgents()
    const mounted: string[] = []
    await openTopicHome({
      home, agents, yzjConversationId: 'g-a', cwd: '/tmp', source: 'dsh', rootMsgId: 'm1',
      agentPreset: 'standard',
      setup: (scope) => { mounted.push(String(scope ?? 'ok')) },
    })
    expect(agents.createdWith[0]).toMatchObject({
      sessionId: 'yzj-topic-g-a-m1',
      meta: { cwd: '/tmp', agentPreset: 'standard' },
    })
    expect(typeof (agents.createdWith[0] as { setup?: unknown }).setup).toBe('function')
    await ((agents.createdWith[0] as { setup: (ctx: unknown) => Promise<void> }).setup)('agent-ctx')
    expect(mounted).toEqual(['agent-ctx'])
  })
})

describe('topicAgentComposition', () => {
  it('resolves the roster default and returns a mount setup', async () => {
    const mounted: string[] = []
    const composition = await topicAgentComposition({
      get(name: string): unknown {
        if (name !== 'agentPresets') return undefined
        return {
          defaultId: 'standard',
          resolve: async (id?: string) => ({ id: id ?? 'standard' }),
          mount: async (_ctx: unknown, id: string) => { mounted.push(id) },
        }
      },
    })
    expect(composition.agentPreset).toBe('standard')
    await composition.setup?.('scope')
    expect(mounted).toEqual(['standard'])
  })

  it('is a no-op when the roster is absent', async () => {
    expect(await topicAgentComposition({ get: () => undefined })).toEqual({})
  })
})

describe('topicAgentRoute', () => {
  it('prefers yzjModels over the harness default', () => {
    const ctx = {
      get(name: string): unknown {
        if (name === 'yzjModels') return { get: () => ({ provider: 'yzj-p', model: 'yzj-m' }) }
        if (name === 'agentDefaultModel') return { currentSelection: () => ({ provider: 'dsh-p', model: 'dsh-m' }) }
        return undefined
      },
    }
    expect(topicAgentRoute(ctx)).toEqual({ provider: 'yzj-p', model: 'yzj-m' })
  })

  it('falls back to agentDefaultModel when the plugin default is unset', () => {
    const ctx = {
      get(name: string): unknown {
        if (name === 'agentDefaultModel') return { currentSelection: () => ({ provider: 'dsh-p', model: 'dsh-m' }) }
        return undefined
      },
    }
    expect(topicAgentRoute(ctx)).toEqual({ provider: 'dsh-p', model: 'dsh-m' })
  })
})

describe('identifiedUserMessage', () => {
  it('always carries a non-empty id (pitfall-026)', () => {
    const message = identifiedUserMessage('这是在说啥', { kind: 'user' })
    expect(message.id.length).toBeGreaterThan(8)
    expect(message.role).toBe('user')
    expect(message.content[0]?.text).toBe('这是在说啥')
  })
})

describe('topicSidebarTitle', () => {
  it('suffixes the group name once (either affix direction is idempotent)', () => {
    expect(topicSidebarTitle('测试群', '帮我整理')).toBe('帮我整理 · 测试群')
    expect(topicSidebarTitle('测试群', '帮我整理 · 测试群')).toBe('帮我整理 · 测试群')
    expect(topicSidebarTitle('测试群', '测试群 · 帮我整理')).toBe('测试群 · 帮我整理')
    expect(topicSidebarTitle('', '帮我整理')).toBe('帮我整理')
  })
})

describe('publishHostSession', () => {
  it('is a no-op without session.append', () => {
    expect(() => publishHostSession({}, '群')).not.toThrow()
  })

  it('skips the empty turn when seedEmptyTurn is false', () => {
    const events: { type: string; data?: unknown }[] = []
    publishHostSession({
      session: { events, append: (type: string, data: unknown) => { events.push({ type, data }) } },
    }, '话题标题', true, false)
    expect(events.map(event => event.type)).toEqual(['session/title'])
  })

  it('does not write a second empty turn on an already-open host', () => {
    const events: { type: string; data?: unknown }[] = [{ type: 'turn/start', data: { turn: 1 } }]
    publishHostSession({
      session: { events, append: (type: string, data: unknown) => { events.push({ type, data }) } },
    }, '群A')
    expect(events.filter(event => event.type === 'turn/start')).toHaveLength(1)
    expect(events.some(event => event.type === 'session/title')).toBe(true)
  })

  it('upgrades a 群房间 placeholder title when the real group name arrives', () => {
    const events: { type: string; data?: unknown }[] = []
    const agent = {
      session: { events, append: (type: string, data: unknown) => { events.push({ type, data }) } },
    }
    publishHostSession(agent, '群房间')
    publishHostSession(agent, '测试群')
    const titles = events.filter(event => event.type === 'session/title')
    expect(titles.at(-1)?.data).toMatchObject({ title: '测试群' })
  })
})
