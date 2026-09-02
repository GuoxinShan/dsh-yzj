/**
 * Topic index: same (group, rootMsgId) is focus; two roots mint two sessions.
 */
import { describe, expect, it } from 'vitest'
import {
  TopicAnchorStore, topicActivity, topicSessionId, type TopicRecord,
} from '../src/topics.ts'

function memoryFacility(): {
  facility: { open: (spec: unknown) => Promise<{ table: (name: string) => FakeTable }> }
  topics: Map<string, TopicRecord>
  anchors: Map<string, { dshSessionId: string }>
} {
  const topics = new Map<string, TopicRecord>()
  const sessions = new Map<string, { yzjConversationId: string }>()
  const outbound = new Map<string, { dshSessionId: string }>()
  const groups = new Map<string, { ids: string[] }>()
  const anchors = new Map<string, { dshSessionId: string }>()
  const tableOf = <V>(map: Map<string, V>) => ({
    get: (key: string) => map.get(key),
    put: async (key: string, value: V) => { map.set(key, value) },
    delete: async (key: string) => map.delete(key),
    entries: () => [...map.entries()] as [string, V][],
  })
  return {
    topics,
    anchors,
    facility: {
      open: async () => ({
        table: (name: string) => {
          if (name === 'topics') return tableOf(topics)
          if (name === 'sessions') return tableOf(sessions)
          if (name === 'outbound') return tableOf(outbound)
          if (name === 'groups') return tableOf(groups)
          return tableOf(anchors)
        },
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

describe('topicSessionId', () => {
  it('mints a yzj-topic-* id, never yzj-home-* or yzj-robot-*', () => {
    const id = topicSessionId('gid-test', 'root-1')
    expect(id.startsWith('yzj-topic-')).toBe(true)
    expect(id.startsWith('yzj-home-')).toBe(false)
    expect(id.startsWith('yzj-robot-')).toBe(false)
  })
})

describe('TopicAnchorStore', () => {
  it('reuses the same topic for the same root message', async () => {
    const store = new TopicAnchorStore()
    const first = await store.ensureTopic({
      yzjConversationId: 'g-a', source: 'yzj', rootMsgId: 'm1', originText: '@机器人 整理接口',
    })
    expect(first.created).toBe(true)
    expect(typeof first.record.lastActivity).toBe('number')
    expect(first.record.lastActivity).toBe(first.record.createdAt)
    const second = await store.ensureTopic({
      yzjConversationId: 'g-a', source: 'dsh', rootMsgId: 'm1',
    })
    expect(second.created).toBe(false)
    expect(second.sessionId).toBe(first.sessionId)
    expect(second.record.lastActivity ?? 0).toBeGreaterThanOrEqual(first.record.lastActivity ?? 0)
    expect(store.getByAnchor('g-a', 'm1')?.dshSessionId).toBe(first.sessionId)
  })

  it('opens a second topic for a second root in the same group', async () => {
    const store = new TopicAnchorStore()
    const a = await store.ensureTopic({ yzjConversationId: 'g-a', source: 'yzj', rootMsgId: 'm1' })
    const b = await store.ensureTopic({ yzjConversationId: 'g-a', source: 'yzj', rootMsgId: 'm2' })
    expect(a.sessionId).not.toBe(b.sessionId)
    expect(store.listByConversation('g-a').map(row => row.dshSessionId)).toEqual([a.sessionId, b.sessionId])
  })

  it('continues via outbound robot msgId', async () => {
    const store = new TopicAnchorStore()
    const topic = await store.ensureTopic({ yzjConversationId: 'g-a', source: 'yzj', rootMsgId: 'm1' })
    await store.registerOutbound('out-9', topic.sessionId)
    expect(store.getByOutbound('out-9')?.dshSessionId).toBe(topic.sessionId)
  })

  it('retargets a local-* anchor to the real msgId without minting a parallel topic', async () => {
    const store = new TopicAnchorStore()
    const first = await store.ensureTopic({ yzjConversationId: 'g-a', source: 'dsh', rootMsgId: 'local-1', originText: '发进群草稿' })
    await store.retargetAnchor('g-a', 'local-1', 'm-real')
    expect(store.getByAnchor('g-a', 'local-1')).toBeUndefined()
    expect(store.getByAnchor('g-a', 'm-real')?.dshSessionId).toBe(first.sessionId)
    const again = await store.ensureTopic({ yzjConversationId: 'g-a', source: 'dsh', rootMsgId: 'm-real' })
    expect(again.created).toBe(false)
    expect(again.sessionId).toBe(first.sessionId)
  })

  it('survives reopen against the same durable tables', async () => {
    const { facility, topics } = memoryFacility()
    const first = new TopicAnchorStore()
    await first.open(facility as never)
    const bound = await first.ensureTopic({ yzjConversationId: 'g-persist', source: 'yzj', rootMsgId: 'root' })
    expect(topics.get(bound.sessionId)?.rootMsgId).toBe('root')

    const restarted = new TopicAnchorStore()
    await restarted.open(facility as never)
    const again = await restarted.ensureTopic({ yzjConversationId: 'g-persist', source: 'yzj', rootMsgId: 'root' })
    expect(again.created).toBe(false)
    expect(again.sessionId).toBe(bound.sessionId)
  })

  it('falls lastActivity back to createdAt for pre-v1.1 rows', () => {
    const row: TopicRecord = {
      dshSessionId: 'yzj-topic-old',
      yzjConversationId: 'g-a',
      title: '旧话题',
      source: 'dsh',
      createdAt: 42,
    }
    expect(topicActivity(row)).toBe(42)
    expect(topicActivity({ ...row, lastActivity: 99 })).toBe(99)
  })

  it('setStatus writes confirm/done and no-ops unknown sessions', async () => {
    const store = new TopicAnchorStore()
    const topic = await store.ensureTopic({ yzjConversationId: 'g-a', source: 'dsh', rootMsgId: 'm1' })
    expect(topic.record.status).toBe('running')
    await store.setStatus(topic.sessionId, 'confirm')
    expect(store.getBySession(topic.sessionId)?.status).toBe('confirm')
    await store.setStatus(topic.sessionId, 'done')
    expect(store.getBySession(topic.sessionId)?.status).toBe('done')
    await store.setStatus('yzj-topic-missing', 'confirm')
    expect(store.getBySession('yzj-topic-missing')).toBeUndefined()
  })
})
