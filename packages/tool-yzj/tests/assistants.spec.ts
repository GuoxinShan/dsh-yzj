/**
 * Assistant catalog, present-layer projection, serial queue, fallback present.
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import {
  AssistantStore, YzjAssistantsService, assistantSessionId, DEFAULT_ASSISTANT_ID,
} from '../src/assistants.ts'
import { applyPresentTool } from '../src/present.ts'
import { lastAssistantText } from '../src/index.ts'
import type { YzjToolBudget } from '../src/shared.ts'

const BUDGET: YzjToolBudget = { timeoutMs: 5_000, maxRenderChars: 2_000, maxMetaChars: 2_000 }

describe('AssistantStore', () => {
  it('plants the factory 助手 and maps a hidden session id', async () => {
    const store = new AssistantStore()
    const row = await store.ensureDefault()
    expect(row.id).toBe(DEFAULT_ASSISTANT_ID)
    expect(row.name).toBe('助手')
    expect(row.sessionId).toBe(assistantSessionId('default'))
    expect(store.list()).toHaveLength(1)
  })

  it('creates 1..N assistants with unique ids', async () => {
    const store = new AssistantStore()
    await store.ensureDefault()
    const extra = await store.create('研究助手', '口吻短')
    expect(extra.id).not.toBe(DEFAULT_ASSISTANT_ID)
    expect(extra.name).toBe('研究助手')
    expect(extra.prompt).toBe('口吻短')
    expect(store.list()).toHaveLength(2)
  })

  it('presents into the DM projection and never invents a Yunzhijia send', async () => {
    const store = new AssistantStore()
    await store.ensureDefault()
    const sessionId = assistantSessionId('default')
    await store.setTurn(sessionId, { kind: 'dm', assistantId: 'default' })
    await store.appendUser({ kind: 'dm', assistantId: 'default' }, '昨天群里说了什么')
    const bubble = await store.present(sessionId, '整理好了')
    expect(bubble?.role).toBe('assistant')
    expect(store.didPresent(sessionId)).toBe(true)
    const dm = store.dmProjection('default')
    expect(dm?.processing).toBe(true)
    expect(dm?.bubbles.map(row => row.text)).toEqual(['昨天群里说了什么', '整理好了'])
    await store.finishTurn(sessionId)
    expect(store.dmProjection('default')?.processing).toBe(false)
  })

  it('presents into a local-only thread under a group msgId', async () => {
    const store = new AssistantStore()
    await store.ensureDefault()
    const sessionId = assistantSessionId('default')
    const target = { kind: 'thread' as const, assistantId: 'default', groupId: 'g-a', msgId: 'm1' }
    await store.setTurn(sessionId, target)
    await store.appendUser(target, '看这条')
    await store.present(sessionId, '失败 3 条')
    const thread = store.threadOf('g-a', 'm1')
    expect(thread.status).toBe('processing')
    expect(thread.bubbles.some(row => row.role === 'assistant' && row.text === '失败 3 条')).toBe(true)
    expect(store.threadsForGroup('g-a')).toHaveLength(1)
  })

  it('fallbackPresent copies the last assistant text only when present was never called', async () => {
    const store = new AssistantStore()
    await store.ensureDefault()
    const sessionId = assistantSessionId('default')
    await store.setTurn(sessionId, { kind: 'dm', assistantId: 'default' })
    expect(await store.fallbackPresent(sessionId, '  回退  ')).toMatchObject({ text: '回退' })
    expect(await store.fallbackPresent(sessionId, '第二次')).toBeUndefined()
    expect(store.dmProjection('default')?.bubbles.at(-1)?.text).toBe('回退')
  })
})

describe('present tool', () => {
  it('writes a bubble for the calling assistant session', async () => {
    const store = new AssistantStore()
    await store.ensureDefault()
    const sessionId = assistantSessionId('default')
    await store.setTurn(sessionId, { kind: 'dm', assistantId: 'default' })
    const captured: { name: string; execute: (args: Record<string, unknown>, exec: unknown) => Promise<{ content: string; data: unknown }> }[] = []
    const ctx = {
      get: (name: string) => name === 'yzjAssistants' ? { store } : undefined,
      tools: { register(def: (typeof captured)[0]) { captured.push(def) } },
    } as never
    applyPresentTool(ctx, BUDGET)
    const tool = captured.find(row => row.name === 'present')
    expect(tool).toBeDefined()
    const result = await tool!.execute({ text: '你好' }, { agent: { session: { id: sessionId } } })
    expect(result.content).toContain('shown in IM')
    expect((result.data as { shown: boolean }).shown).toBe(true)
    expect(store.dmProjection('default')?.bubbles.some(row => row.text === '你好')).toBe(true)
  })

  it('no-ops when the session is not an assistant turn', async () => {
    const store = new AssistantStore()
    await store.ensureDefault()
    const captured: { name: string; execute: (args: Record<string, unknown>, exec: unknown) => Promise<{ content: string; data: unknown }> }[] = []
    const ctx = {
      get: (name: string) => name === 'yzjAssistants' ? { store } : undefined,
      tools: { register(def: (typeof captured)[0]) { captured.push(def) } },
    } as never
    applyPresentTool(ctx, BUDGET)
    const result = await captured[0]!.execute({ text: 'x' }, { agent: { session: { id: 'private-1' } } })
    expect((result.data as { shown: boolean }).shown).toBe(false)
  })
})

describe('YzjAssistantsService.enqueue', () => {
  it('is serial inside one assistant and parallel across assistants', async () => {
    const ctx = new Context()
    const svc = new YzjAssistantsService(ctx)
    const order: string[] = []
    const slowA = svc.enqueue('a', async () => {
      await new Promise(resolve => setTimeout(resolve, 40))
      order.push('a1')
    })
    const nextA = svc.enqueue('a', async () => {
      order.push('a2')
    })
    const b = svc.enqueue('b', async () => {
      order.push('b')
    })
    await Promise.all([slowA, nextA, b])
    expect(order.indexOf('a1')).toBeLessThan(order.indexOf('a2'))
    expect(order).toContain('b')
  })
})

describe('lastAssistantText', () => {
  it('returns the last assistant/message text for fallback present', () => {
    expect(lastAssistantText([
      { type: 'user/message', data: { content: 'hi' } },
      { type: 'assistant/message', data: { content: 'first' } },
      { type: 'assistant/message', data: { content: [{ type: 'text', text: 'final' }] } },
    ])).toBe('final')
    expect(lastAssistantText([])).toBe('')
  })
})
