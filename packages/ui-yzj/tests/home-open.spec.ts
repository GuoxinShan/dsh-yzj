import { describe, expect, it } from 'vitest'
import { openBoundHome } from '../src/home-open.ts'
import type { HomeOpenFace } from '../src/home-open.ts'

function memoryHome(): HomeOpenFace {
  const byConv = new Map<string, { sessionId: string; yzjKind: 'group' | 'dm' }>()
  return {
    async ensureBound(id, kind) {
      const existing = byConv.get(id)
      if (existing !== undefined) return { sessionId: existing.sessionId, created: false, yzjKind: existing.yzjKind }
      const sessionId = `yzj-home-${id}`
      byConv.set(id, { sessionId, yzjKind: kind })
      return { sessionId, created: true, yzjKind: kind }
    },
  }
}

function fakeAgents() {
  const live = new Map<string, true>()
  const created: string[] = []
  return {
    created,
    get: (id: string) => live.get(id) === true ? {} : undefined,
    resume: async () => { throw new Error('no log') },
    create: async (options: { sessionId: string }) => {
      created.push(options.sessionId)
      live.set(options.sessionId, true)
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
  })
})
