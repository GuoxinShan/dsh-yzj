import { describe, expect, it } from 'vitest'
import { openBoundHome, openTopicHome, publishHostSession, topicSidebarTitle } from '../src/home-open.ts'
import type { HomeOpenFace } from '../src/home-open.ts'

function memoryHome(): HomeOpenFace {
  const byConv = new Map<string, { sessionId: string; yzjKind: 'group' | 'dm' }>()
  const topics = new Map<string, { sessionId: string; rootMsgId?: string }>()
  return {
    async ensureBound(id, kind) {
      const existing = byConv.get(id)
      if (existing !== undefined) return { sessionId: existing.sessionId, created: false, yzjKind: existing.yzjKind }
      const sessionId = `yzj-home-${id}`
      byConv.set(id, { sessionId, yzjKind: kind })
      return { sessionId, created: true, yzjKind: kind }
    },
    async ensureTopic(input) {
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
  const live = new Map<string, { session: { events: { type: string; data?: unknown }[]; append: (type: string, data: unknown) => void } }>()
  const created: string[] = []
  return {
    created,
    live,
    get: (id: string) => live.get(id),
    resume: async () => { throw new Error('no log') },
    create: async (options: { sessionId: string }) => {
      created.push(options.sessionId)
      const events: { type: string; data?: unknown }[] = []
      const agent = {
        session: {
          events,
          append: (type: string, data: unknown) => { events.push({ type, data }) },
        },
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
    expect(agents.created).toEqual(['yzj-home-g-a'])
    const second = await openBoundHome({ home, agents, yzjConversationId: 'g-a', cwd: '/tmp' })
    expect(second.created).toBe(false)
    expect(second.sessionId).toBe(first.sessionId)
    expect(second.agentCreated).toBe(false)
    expect(agents.created).toEqual(['yzj-home-g-a'])
    const types = agents.live.get('yzj-home-g-a')?.session.events.map(event => event.type)
    expect(types).toEqual(['turn/start', 'turn/end', 'session/title'])
  })

  it('pins the supplied group name as session/title', async () => {
    const home = memoryHome()
    const agents = fakeAgents()
    await openBoundHome({ home, agents, yzjConversationId: 'g-a', cwd: '/tmp', title: '测试群' })
    const title = agents.live.get('yzj-home-g-a')?.session.events.find(event => event.type === 'session/title')
    expect(title?.data).toMatchObject({ title: '测试群', source: { kind: 'user' } })
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

  it('pins sidebar title as 群名 · 话题 so a flat list is still scannable', async () => {
    const home = memoryHome()
    const agents = fakeAgents()
    await openBoundHome({ home, agents, yzjConversationId: 'g-a', cwd: '/tmp', title: '测试群' })
    await openTopicHome({
      home, agents, yzjConversationId: 'g-a', cwd: '/tmp', source: 'dsh', rootMsgId: 'm1', originText: '帮我整理接口清单',
    })
    const title = agents.live.get('yzj-topic-g-a-m1')?.session.events.findLast(event => event.type === 'session/title')
    expect(title?.data).toMatchObject({ title: '测试群 · 帮我整理接口清单' })
  })
})

describe('topicSidebarTitle', () => {
  it('prefixes the group name once', () => {
    expect(topicSidebarTitle('测试群', '帮我整理')).toBe('测试群 · 帮我整理')
    expect(topicSidebarTitle('测试群', '测试群 · 帮我整理')).toBe('测试群 · 帮我整理')
    expect(topicSidebarTitle('', '帮我整理')).toBe('帮我整理')
  })
})

describe('publishHostSession', () => {
  it('is a no-op without session.append', () => {
    expect(() => publishHostSession({}, '群')).not.toThrow()
  })

  it('does not write a second empty turn on an already-open host', () => {
    const events: { type: string; data?: unknown }[] = [{ type: 'turn/start', data: { turn: 1 } }]
    publishHostSession({
      session: { events, append: (type: string, data: unknown) => { events.push({ type, data }) } },
    }, '群A')
    expect(events.filter(event => event.type === 'turn/start')).toHaveLength(1)
    expect(events.some(event => event.type === 'session/title')).toBe(true)
  })

  it('upgrades a 群房间 placeholder title when the real group name arrives', async () => {
    const home = memoryHome()
    const agents = fakeAgents()
    await openBoundHome({ home, agents, yzjConversationId: 'g-a', cwd: '/tmp' })
    expect(agents.live.get('yzj-home-g-a')?.session.events.find(event => event.type === 'session/title')?.data)
      .toMatchObject({ title: '群房间' })
    await openBoundHome({ home, agents, yzjConversationId: 'g-a', cwd: '/tmp', title: '测试群' })
    const titles = agents.live.get('yzj-home-g-a')?.session.events.filter(event => event.type === 'session/title')
    expect(titles?.at(-1)?.data).toMatchObject({ title: '测试群' })
  })
})
