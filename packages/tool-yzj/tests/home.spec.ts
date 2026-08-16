/**
 * Home binding table: 1:1 conversation ↔ session, second open is focus,
 * rows survive a store reopen (restart).
 */
import { describe, expect, it } from 'vitest'
import {
  HomeBindingStore, conversationKindOf, homeSessionId,
  type HomeBindingRecord,
} from '../src/home.ts'

function memoryFacility(): {
  facility: { open: (spec: unknown) => Promise<{ table: (name: string) => FakeTable }> }
  conv: Map<string, HomeBindingRecord>
  sess: Map<string, { yzjConversationId: string }>
} {
  const conv = new Map<string, HomeBindingRecord>()
  const sess = new Map<string, { yzjConversationId: string }>()
  const tableOf = <V>(map: Map<string, V>) => ({
    get: (key: string) => map.get(key),
    put: async (key: string, value: V) => { map.set(key, value) },
    delete: async (key: string) => map.delete(key),
    entries: () => [...map.entries()] as [string, V][],
  })
  return {
    conv,
    sess,
    facility: {
      open: async () => ({
        table: (name: string) => name === 'conversations' ? tableOf(conv) : tableOf(sess),
      }),
    },
  }
}

type FakeTable = {
  get: (key: string) => unknown
  put: (key: string, value: unknown) => Promise<void>
  delete: (key: string) => Promise<boolean>
  entries: () => [string, unknown][]
}

describe('homeSessionId / conversationKindOf', () => {
  it('allocates a yzj-home-* product id, never yzj-robot-*', () => {
    expect(homeSessionId('gid-test')).toBe('yzj-home-gid-test')
    expect(homeSessionId('BOT-a-BOT-b')).toBe('yzj-home-BOT-a-BOT-b')
    expect(homeSessionId('gid-test').startsWith('yzj-robot-')).toBe(false)
  })

  it('classifies BOT- ids as dm and the rest as group', () => {
    expect(conversationKindOf('BOT-user-BOT-robot')).toBe('dm')
    expect(conversationKindOf('gid-test')).toBe('group')
  })
})

describe('HomeBindingStore', () => {
  it('binds a conversation once; the second open is focus, not a new row', async () => {
    const store = new HomeBindingStore()
    const first = await store.ensureBound('g-a', 'group')
    expect(first.created).toBe(true)
    expect(first.sessionId).toBe(homeSessionId('g-a'))
    const second = await store.ensureBound('g-a', 'group')
    expect(second.created).toBe(false)
    expect(second.sessionId).toBe(first.sessionId)
    expect(store.getByConversation('g-a')?.dshSessionId).toBe(first.sessionId)
    expect(store.getBySession(first.sessionId)?.yzjConversationId).toBe('g-a')
  })

  it('keeps group A and group B on distinct sessions (1:1)', async () => {
    const store = new HomeBindingStore()
    const a = await store.ensureBound('g-a', 'group')
    const b = await store.ensureBound('g-b', 'group')
    expect(a.sessionId).not.toBe(b.sessionId)
    expect(store.getByConversation('g-a')?.dshSessionId).toBe(a.sessionId)
    expect(store.getByConversation('g-b')?.dshSessionId).toBe(b.sessionId)
  })

  it('survives reopen against the same durable tables (restart)', async () => {
    const { facility, conv } = memoryFacility()
    const first = new HomeBindingStore()
    await first.open(facility as never)
    const bound = await first.ensureBound('g-persist', 'group')
    expect(conv.get('g-persist')?.dshSessionId).toBe(bound.sessionId)

    const restarted = new HomeBindingStore()
    await restarted.open(facility as never)
    const again = await restarted.ensureBound('g-persist', 'group')
    expect(again.created).toBe(false)
    expect(again.sessionId).toBe(bound.sessionId)
  })

  it('inboundTarget is ensureBound: missing row creates, existing row reuses', async () => {
    const store = new HomeBindingStore()
    const inbound = (id: string) => store.ensureBound(id, conversationKindOf(id))
    const first = await inbound('g-in')
    const second = await inbound('g-in')
    expect(first.created).toBe(true)
    expect(second.created).toBe(false)
    expect(second.sessionId).toBe(first.sessionId)
    expect(second.sessionId.startsWith('yzj-robot-')).toBe(false)
  })
})
