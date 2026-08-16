import { describe, expect, it } from 'vitest'
import { openOrResumeBoundHome } from '../src/home-target.ts'
import type { RouterHomeFace } from '../src/router.ts'

function memoryHome(): RouterHomeFace & { createdIds: string[] } {
  const byConv = new Map<string, { dshSessionId: string; yzjConversationId: string; yzjKind: 'group' | 'dm' }>()
  const bySess = new Map<string, string>()
  const createdIds: string[] = []
  return {
    createdIds,
    async ensureBound(id, kind) {
      const existing = byConv.get(id)
      if (existing !== undefined) return { sessionId: existing.dshSessionId, created: false, yzjKind: existing.yzjKind }
      const sessionId = `yzj-home-${id}`
      byConv.set(id, { dshSessionId: sessionId, yzjConversationId: id, yzjKind: kind })
      bySess.set(sessionId, id)
      createdIds.push(sessionId)
      return { sessionId, created: true, yzjKind: kind }
    },
    getByConversation: id => byConv.get(id),
    getBySession: id => {
      const conv = bySess.get(id)
      return conv === undefined ? undefined : byConv.get(conv)
    },
  }
}

function fakeAgents() {
  const live = new Map<string, { id: string }>()
  const created: string[] = []
  const resumed: string[] = []
  return {
    created,
    resumed,
    get: (id: string) => live.get(id),
    resume: async (options: { resumeSessionId: string }) => {
      resumed.push(options.resumeSessionId)
      throw new Error('no persisted log')
    },
    create: async (options: { sessionId: string }) => {
      if (options.sessionId.startsWith('fork-')) throw new Error('must not create fork-* root')
      created.push(options.sessionId)
      live.set(options.sessionId, { id: options.sessionId })
      return { id: options.sessionId }
    },
  }
}

describe('openOrResumeBoundHome', () => {
  it('opens the bound home and does not create a fork-* root', async () => {
    const home = memoryHome()
    await home.ensureBound('g-a', 'group')
    const agents = fakeAgents()
    const first = await openOrResumeBoundHome({
      sourceSessionId: 'yzj-home-g-a',
      home,
      surfaces: [],
      agents,
      cwd: '/tmp',
    })
    expect(first.ok).toBe(true)
    expect(first.sessionId).toBe('yzj-home-g-a')
    expect(first.sessionId?.startsWith('fork-')).toBe(false)
    expect(agents.created).toEqual(['yzj-home-g-a'])

    const second = await openOrResumeBoundHome({
      sourceSessionId: 'yzj-home-g-a',
      home,
      surfaces: [],
      agents,
      cwd: '/tmp',
    })
    expect(second.ok).toBe(true)
    expect(second.sessionId).toBe('yzj-home-g-a')
    expect(second.createdAgent).toBe(false)
    expect(agents.created).toEqual(['yzj-home-g-a'])
  })

  it('resolves a leftover lastSessionId via the surface groupId', async () => {
    const home = memoryHome()
    const agents = fakeAgents()
    const result = await openOrResumeBoundHome({
      sourceSessionId: 'yzj-robot-old',
      home,
      surfaces: [{ groupId: 'g-legacy', lastSessionId: 'yzj-robot-old' }],
      agents,
      cwd: '/tmp',
    })
    expect(result.ok).toBe(true)
    expect(result.sessionId).toBe('yzj-home-g-legacy')
    expect(agents.created.some(id => id.startsWith('fork-') || id.startsWith('yzj-robot-'))).toBe(false)
  })

  it('fails closed when the source has no conversation (no new root)', async () => {
    const home = memoryHome()
    const agents = fakeAgents()
    const result = await openOrResumeBoundHome({
      sourceSessionId: 'unbound-gui',
      home,
      surfaces: [],
      agents,
      cwd: '/tmp',
    })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('禁止 fork 新根')
    expect(agents.created).toEqual([])
  })
})
