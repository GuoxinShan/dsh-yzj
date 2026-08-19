/**
 * Node-half RPC endpoint specs: the `/yzj` handler validates payloads,
 * forwards bridge reads, and projects write-gate records into lossless JSON
 * while rejecting unknown outcomes. The write-gate itself is exercised
 * end-to-end in write-gate.spec.ts; here we pin the endpoint contract.
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { applyWriteGate } from '../src/write-gate.ts'
import { clearRecentNamesCache, createRpcHandler, type YzjWriteGateFace } from '../src/index.ts'
import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection'

interface RunResult { ok: boolean; exitCode: number | null; stdout: string; stderr: string; json?: unknown }

function runOf(json: unknown): RunResult {
  return { ok: true, exitCode: 0, stdout: JSON.stringify(json), stderr: '', json }
}

function mountBridge(runs: Record<string, RunResult>): Context {
  const ctx = new Context()
  ;(ctx as unknown as { yzjBridge: { run: (command: readonly string[]) => Promise<RunResult> } }).yzjBridge = {
    run: async (command: readonly string[]) => runs[command.join(' ')] ?? { ok: false, exitCode: 1, stdout: '', stderr: `no fixture for ${command.join(' ')}` },
  }
  return ctx
}

/** One gated write record, ready for the endpoint. */
function pendingRecord(over: Partial<Parameters<YzjWriteGateFace['list']>[0] extends never ? never : object> = {}): unknown {
  return {
    writeId: 'w1', sessionId: 's1', toolName: 'yzj_im_message_send', callId: 'c1',
    level: 'standard', domain: 'im', args: { groupId: 'g1', content: 'hi' },
    reason: 'r', status: 'pending', time: 1,
    ...over,
  }
}

describe('createRpcHandler', () => {
  it('forwards bridge reads with the CLI argv', async () => {
    const ctx = mountBridge({
      'doc workspace list --type personal': runOf([{ id: 'kb1', name: '我的' }]),
    })
    const gate: YzjWriteGateFace = { list: () => [], decide: () => false }
    const handler = createRpcHandler(ctx, gate)
    const result = await handler('workspaces', { type: 'personal' }, undefined as never)
    expect(result.ok && result.value).toEqual([{ id: 'kb1', name: '我的' }])
  })

  it('events two-pointer-scans a range so recurring instances survive (pitfall-032)', async () => {
    const calls: string[] = []
    const ctx = new Context()
    ;(ctx as unknown as { yzjBridge: { run: (command: readonly string[]) => Promise<RunResult> } }).yzjBridge = {
      run: async (command) => {
        calls.push(command.join(' '))
        const start = command[command.indexOf('--start') + 1] ?? ''
        return runOf([{ id: start, startDate: Date.parse(`${start}T10:00:00`), title: start }])
      },
    }
    const handler = createRpcHandler(ctx, { list: () => [], decide: () => false })
    const result = await handler('events', { start: '2026-08-17', end: '2026-08-18' }, undefined as never)
    expect(calls).toEqual([
      'calendar event list --start 2026-08-17 --end 2026-08-18',
      'calendar event list --start 2026-08-18 --end 2026-08-18',
    ])
    expect(result.ok && result.value).toEqual([
      { id: '2026-08-17', startDate: Date.parse('2026-08-17T10:00:00'), title: '2026-08-17' },
      { id: '2026-08-18', startDate: Date.parse('2026-08-18T10:00:00'), title: '2026-08-18' },
    ])
  })

  it('validates required payloads', async () => {
    const ctx = mountBridge({})
    const gate: YzjWriteGateFace = { list: () => [], decide: () => false }
    const handler = createRpcHandler(ctx, gate)
    const result = await handler('messages', {}, undefined as never)
    expect(result).toEqual({ ok: false, error: { code: 'internal', message: 'messages endpoint requires a groupId payload', details: {} } })
  })

  it('write-list returns projected records for one call', async () => {
    const ctx = mountBridge({})
    const records = [pendingRecord()]
    const gate: YzjWriteGateFace = {
      list: (sessionId, callId) => {
        expect(sessionId).toBe('s1')
        expect(callId).toBe('c1')
        return records as never
      },
      decide: () => false,
    }
    const handler = createRpcHandler(ctx, gate)
    const result = await handler('write-list', { sessionId: 's1', callId: 'c1' }, undefined as never)
    expect(result.ok && (result.value as { list: unknown[] }).list).toEqual(records)
  })

  it('write-decide settles allowed-once and rejected', async () => {
    const ctx = mountBridge({})
    const decided: string[] = []
    const gate: YzjWriteGateFace = {
      list: () => [],
      decide: (writeId, outcome) => { decided.push(`${writeId}:${outcome}`); return true },
    }
    const handler = createRpcHandler(ctx, gate)
    const ok = await handler('write-decide', { writeId: 'w1', outcome: 'allowed-once' }, undefined as never)
    expect(ok).toEqual({ ok: true, value: { settled: true } })
    const no = await handler('write-decide', { writeId: 'w2', outcome: 'rejected' }, undefined as never)
    expect(no.ok && (no.value as { settled: boolean }).settled).toBe(true)
    expect(decided).toEqual(['w1:allowed-once', 'w2:rejected'])
  })

  it('write-decide rejects unknown outcomes', async () => {
    const ctx = mountBridge({})
    const gate: YzjWriteGateFace = { list: () => [], decide: () => false }
    const handler = createRpcHandler(ctx, gate)
    const result = await handler('write-decide', { writeId: 'w1', outcome: 'maybe' }, undefined as never)
    expect(result).toEqual({ ok: false, error: { code: 'internal', message: 'write-decide endpoint rejects outcome "maybe"', details: {} } })
  })

  it('memory endpoints project the vault service and stay unavailable without it', async () => {
    const gate: YzjWriteGateFace = { list: () => [], decide: () => false }
    // Without the service: every memory endpoint fails closed with guidance.
    const bare = createRpcHandler(mountBridge({}), gate)
    expect(await bare('memory-scope', {}, undefined as never)).toEqual({
      ok: false,
      error: { code: 'internal', message: 'memory-scope: yzjMemory 服务不可用（memory-yzj 未挂载）', details: {} },
    })
    // With a scripted service: scope view, log tail, and the panel-direct
    // observe write (user's own will — no gate involvement).
    const ctx = new Context()
    const observed: { scope: string; content: string; source: string; durable?: boolean }[] = []
    ctx.provide('yzjMemory', {
      readScope: (scope: string) => ({ scope, cap: 6000, sections: [], entities: [], observations: [], archivedCount: 0 }),
      dreamLogTail: (scope: string, max: number) => `log ${scope} ${max}`,
      observe: (scope: string, content: string, opts: { source: string; durable?: boolean }) => {
        observed.push({ scope, content, source: opts.source, ...(opts.durable === undefined ? {} : { durable: opts.durable }) })
        return { id: 'obs-1', duplicate: false, openCount: 1, capacity: 200 }
      },
    })
    const handler = createRpcHandler(ctx, gate)
    const scope = await handler('memory-scope', {}, undefined as never)
    expect(scope.ok && (scope.value as { view: { scope: string } }).view.scope).toBe('user')
    const log = await handler('memory-log', {}, undefined as never)
    expect(log.ok && (log.value as { log: string }).log).toBe('log user 4000')
    expect((await handler('memory-observe', {}, undefined as never)).ok).toBe(false)
    const write = await handler('memory-observe', { content: '偏好表格周报', tags: ['work', 7] }, undefined as never)
    expect(write.ok).toBe(true)
    expect(observed).toEqual([{ scope: 'user', content: '偏好表格周报', source: 'panel' }])
    const durableWrite = await handler('memory-observe', { content: '长期偏好', durable: true }, undefined as never)
    expect(durableWrite.ok).toBe(true)
    expect(observed[1]).toEqual({ scope: 'user', content: '长期偏好', source: 'panel', durable: true })
  })

  it('advance-feed is a user-direct write: actor=user, no stageTo, default sourceType', async () => {
    const gate: YzjWriteGateFace = { list: () => [], decide: () => false }
    const bare = createRpcHandler(mountBridge({}), gate)
    expect(await bare('advance-feed', { advanceId: 'A-1', summary: '进度' }, undefined as never)).toEqual({
      ok: false,
      error: { code: 'internal', message: 'advance-feed: yzjAdvance 服务不可用（tool-yzj 未挂载）', details: {} },
    })
    const ctx = new Context()
    const fed: Record<string, unknown>[] = []
    ctx.provide('yzjAdvance', {
      feed: async (input: Record<string, unknown>) => {
        fed.push(input)
        return { advanceId: input.advanceId, stage: 'running' }
      },
    })
    const handler = createRpcHandler(ctx, gate)
    const blocked = await handler('advance-feed', {
      advanceId: 'A-1', summary: '偷偷改阶段', stageTo: 'completed',
    }, undefined as never)
    expect(blocked.ok).toBe(false)
    expect(blocked.ok === false && blocked.error.message).toContain('用户直写不能改阶段或目标字段')
    expect(fed).toEqual([])
    const goalBlocked = await handler('advance-feed', {
      advanceId: 'A-1', summary: '改目标', goal: '新目标',
    }, undefined as never)
    expect(goalBlocked.ok).toBe(false)
    expect(fed).toEqual([])
    const withRefs = await handler('advance-feed', {
      advanceId: 'A-1', summary: '群里一句', refs: ['m1', ''],
    }, undefined as never)
    expect(withRefs.ok).toBe(true)
    expect(fed[0]).toEqual({
      advanceId: 'A-1',
      summary: '群里一句',
      sourceType: '对话',
      changeType: '进度更新',
      refs: ['m1'],
      actor: 'user',
    })
    const noRefs = await handler('advance-feed', {
      advanceId: 'A-1', summary: '口头反馈', sourceType: '人工',
    }, undefined as never)
    expect(noRefs.ok).toBe(true)
    expect(fed[1]).toEqual({
      advanceId: 'A-1',
      summary: '口头反馈',
      sourceType: '人工',
      changeType: '进度更新',
      actor: 'user',
    })
  })

  it('advance-scan-state reads the last patrol snapshot', async () => {
    const gate: YzjWriteGateFace = { list: () => [], decide: () => false }
    const bare = createRpcHandler(mountBridge({}), gate)
    expect(await bare('advance-scan-state', {}, undefined as never)).toEqual({
      ok: false,
      error: { code: 'internal', message: 'advance-scan-state: yzjAdvance 服务不可用（tool-yzj 未挂载）', details: {} },
    })
    const ctx = new Context()
    ctx.provide('yzjAdvance', {
      scanState: () => ({ scannedAt: 1, found: 2, groups: [] }),
    })
    const handler = createRpcHandler(ctx, gate)
    expect(await handler('advance-scan-state', {}, undefined as never)).toEqual({
      ok: true,
      value: { scannedAt: 1, found: 2, groups: [] },
    })
  })

  it('advance-thread-add / advance-thread-remove are user-direct subscription writes (spec §15.2)', async () => {
    const gate: YzjWriteGateFace = { list: () => [], decide: () => false }
    const bare = createRpcHandler(mountBridge({}), gate)
    expect(await bare('advance-thread-add', { advanceId: 'A-1', token: 'doc:d1' }, undefined as never)).toEqual({
      ok: false,
      error: { code: 'internal', message: 'advance-thread-add: yzjAdvance 服务不可用（tool-yzj 未挂载）', details: {} },
    })
    expect(await bare('advance-thread-remove', { advanceId: 'A-1', token: 'doc:d1' }, undefined as never)).toEqual({
      ok: false,
      error: { code: 'internal', message: 'advance-thread-remove: yzjAdvance 服务不可用（tool-yzj 未挂载）', details: {} },
    })
    const ctx = new Context()
    const adds: { advanceId: string; token: string; label?: string }[] = []
    const removes: { advanceId: string; token: string }[] = []
    ctx.provide('yzjAdvance', {
      threadAdd: async (advanceId: string, token: string, label?: string) => {
        if (!/^(im|doc|todo|event|file):/.test(token)) throw new Error(`advance: 非法线程 token「${token}」`)
        adds.push({ advanceId, token, ...(label === undefined ? {} : { label }) })
        return { threads: [{ token, kind: 'document', label: label ?? '', addedBy: 'user', addedAt: 1 }], entryAppended: true }
      },
      threadRemove: async (advanceId: string, token: string) => {
        removes.push({ advanceId, token })
        return []
      },
    })
    const handler = createRpcHandler(ctx, gate)
    expect(await handler('advance-thread-add', { advanceId: 'A-1' }, undefined as never)).toEqual({
      ok: false,
      error: { code: 'internal', message: 'advance-thread-add endpoint requires advanceId and token payloads', details: {} },
    })
    const added = await handler('advance-thread-add', { advanceId: 'A-1', token: 'doc:d1', label: '范围说明' }, undefined as never)
    expect(added.ok).toBe(true)
    expect(added.ok && (added.value as { entryAppended: boolean }).entryAppended).toBe(true)
    expect(adds).toEqual([{ advanceId: 'A-1', token: 'doc:d1', label: '范围说明' }])
    const serviceError = await handler('advance-thread-add', { advanceId: 'A-1', token: 'msg:bad' }, undefined as never)
    expect(serviceError.ok).toBe(false)
    expect(serviceError.ok === false && serviceError.error.message).toContain('advance-thread-add failed')
    expect(await handler('advance-thread-remove', { token: 'doc:d1' }, undefined as never)).toEqual({
      ok: false,
      error: { code: 'internal', message: 'advance-thread-remove endpoint requires advanceId and token payloads', details: {} },
    })
    const removed = await handler('advance-thread-remove', { advanceId: 'A-1', token: 'doc:d1' }, undefined as never)
    expect(removed).toEqual({ ok: true, value: { threads: [] } })
    expect(removes).toEqual([{ advanceId: 'A-1', token: 'doc:d1' }])
  })

  it('advance-get folds the subscribed threads into the detail (no extra read endpoint)', async () => {
    const ctx = new Context()
    ctx.provide('yzjAdvance', {
      get: async (advanceId: string) => ({
        item: { advanceId, title: '试运行' },
        entries: [],
        entryOffset: 0,
        entryTotal: 0,
        sources: [],
        threads: [{ token: 'im:g1', kind: 'persistent', label: 'dsh-2', addedBy: 'agent', addedAt: 1 }],
      }),
    })
    const handler = createRpcHandler(ctx, { list: () => [], decide: () => false })
    const result = await handler('advance-get', { advanceId: 'A-1' }, undefined as never)
    expect(result.ok).toBe(true)
    expect(result.ok && (result.value as { threads: { token: string }[] }).threads.map(row => row.token)).toEqual(['im:g1'])
  })

  it('dream and model-default endpoints project their services', async () => {
    const ctx = new Context()
    const dreamSets: Record<string, unknown>[] = []
    const dreamRuns: string[] = []
    ctx.provide('yzjMemory', {
      dreamSettings: () => ({ enabled: false }),
      setDreamSettings: (partial: Record<string, unknown>) => { dreamSets.push(partial); return { enabled: partial.enabled === true } },
      dreamRun: async (trigger: string) => { dreamRuns.push(trigger); return { ok: true as const, sessionId: 'dream-1', note: '固化完成' } },
    })
    const modelSets: { provider: string; model: string }[] = []
    ctx.provide('yzjModels', {
      get: () => undefined,
      get path() { return 'yzj-model.json' },
      setDefault: async (provider: string, model: string) => { modelSets.push({ provider, model }); return { provider, model } },
      clear: async () => { modelSets.length = 0 },
      catalog: async () => [{ provider: 'deepseek', models: ['glm-4.7'] }],
    })
    const handler = createRpcHandler(ctx, { list: () => [], decide: () => false })
    const state = await handler('dream-state', {}, undefined as never)
    expect(state.ok && (state.value as { state: { enabled: boolean } }).state.enabled).toBe(false)
    const set = await handler('dream-set', { enabled: true, provider: '', model: '', dailyAt: '03:30' }, undefined as never)
    expect(set.ok && (set.value as { state: { enabled: boolean } }).state.enabled).toBe(true)
    expect(dreamSets).toEqual([{ enabled: true, provider: '', model: '', dailyAt: '03:30' }])
    const run = await handler('dream-run', {}, undefined as never)
    expect(run.ok && (run.value as { note: string }).note).toBe('固化完成')
    expect(dreamRuns).toEqual(['panel'])
    const def = await handler('model-default', {}, undefined as never)
    expect(def.ok && (def.value as { path: string }).path).toBe('yzj-model.json')
    const setDef = await handler('model-default-set', { provider: 'deepseek', model: 'glm-4.7' }, undefined as never)
    expect(setDef.ok && (setDef.value as { route: { model: string } }).route.model).toBe('glm-4.7')
    await handler('model-default-clear', {}, undefined as never)
    expect(modelSets).toEqual([])
    const catalog = await handler('model-catalog', {}, undefined as never)
    expect(catalog.ok && (catalog.value as { catalog: unknown[] }).catalog).toEqual([{ provider: 'deepseek', models: ['glm-4.7'] }])
  })

  it('home-open binds once and focuses the same session on the second call', async () => {
    const ctx = mountBridge({})
    const rows = new Map<string, { sessionId: string; yzjKind: 'group' | 'dm' }>()
    ctx.provide('yzjHome', {
      ensureBound: async (id: string, kind: 'group' | 'dm') => {
        const existing = rows.get(id)
        if (existing !== undefined) return { sessionId: existing.sessionId, created: false, yzjKind: existing.yzjKind }
        const row = { sessionId: `yzj-home-${id}`, yzjKind: kind }
        rows.set(id, row)
        return { ...row, created: true }
      },
    })
    const live = new Map<string, true>()
    const created: string[] = []
    ctx.provide('agents', {
      get: (id: string) => live.get(String(id)) === true ? {} : undefined,
      resume: async () => { throw new Error('no log') },
      create: async (opts: { sessionId: string }) => {
        created.push(String(opts.sessionId))
        live.set(String(opts.sessionId), true)
      },
    })
    const handler = createRpcHandler(ctx, { list: () => [], decide: () => false })
    const first = await handler('home-open', { groupId: 'g-a' }, undefined as never)
    expect(first.ok && first.value).toMatchObject({ sessionId: 'yzj-home-g-a', created: true, yzjKind: 'group' })
    const second = await handler('home-open', { groupId: 'g-a' }, undefined as never)
    expect(second.ok && second.value).toMatchObject({ sessionId: 'yzj-home-g-a', created: false })
    expect(created).toEqual([])
  })

  function recordingRegistry() {
    const attached: string[] = []
    const workspace = {
      attachSession: async (sessionId: string) => { attached.push(String(sessionId)) },
    }
    return {
      attached,
      registry: {
        create: async () => workspace,
        resolveByPath: async () => workspace,
      },
    }
  }

  function liveAgents() {
    const live = new Map<string, {
      session: { events: { type: string; data?: unknown }[]; append: (type: string, data: unknown) => void }
      followup?: (message: unknown) => void
    }>()
    return {
      live,
      get: (id: string) => live.get(String(id)),
      resume: async () => { throw new Error('no log') },
      create: async (opts: { sessionId: string }) => {
        const events: { type: string; data?: unknown }[] = []
        const agent = {
          session: {
            events,
            append: (type: string, data: unknown) => { events.push({ type, data }) },
          },
          followup: () => undefined,
        }
        live.set(String(opts.sessionId), agent)
        return agent
      },
    }
  }

  function topicHome() {
    const rooms = new Map<string, { sessionId: string; yzjKind: 'group' | 'dm' }>()
    const topics = new Map<string, { sessionId: string; rootMsgId?: string }>()
    return {
      ensureBound: async (id: string, kind: 'group' | 'dm') => {
        const existing = rooms.get(id)
        if (existing !== undefined) return { sessionId: existing.sessionId, created: false, yzjKind: existing.yzjKind }
        const row = { sessionId: `yzj-home-${id}`, yzjKind: kind }
        rooms.set(id, row)
        return { ...row, created: true }
      },
      ensureTopic: async (input: { yzjConversationId: string; rootMsgId?: string }) => {
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

  it('home-open does not attach the room host to 云之家', async () => {
    const ctx = mountBridge({})
    const { attached, registry } = recordingRegistry()
    ctx.provide('workspaceRegistry', registry)
    ctx.provide('yzjHome', topicHome())
    ctx.provide('agents', liveAgents())
    const handler = createRpcHandler(ctx, { list: () => [], decide: () => false })
    const opened = await handler('home-open', { groupId: 'g-a' }, undefined as never)
    expect(opened.ok && opened.value).toMatchObject({ sessionId: 'yzj-home-g-a' })
    expect(attached).toEqual([])
  })

  it('home-topic-open attaches only the topic session', async () => {
    const ctx = mountBridge({})
    const { attached, registry } = recordingRegistry()
    ctx.provide('workspaceRegistry', registry)
    ctx.provide('yzjHome', topicHome())
    ctx.provide('agents', liveAgents())
    const handler = createRpcHandler(ctx, { list: () => [], decide: () => false })
    const opened = await handler('home-topic-open', {
      groupId: 'g-a', rootMsgId: 'm1', originText: '帮我整理',
    }, undefined as never)
    expect(opened.ok && opened.value).toMatchObject({ sessionId: 'yzj-topic-g-a-m1' })
    expect(attached).toEqual(['yzj-topic-g-a-m1'])
  })

  it('home-open with leftover ③④ attaches only the 历史对话 topic', async () => {
    const ctx = mountBridge({})
    const { attached, registry } = recordingRegistry()
    ctx.provide('workspaceRegistry', registry)
    ctx.provide('yzjHome', topicHome())
    const agents = liveAgents()
    await agents.create({ sessionId: 'yzj-home-g-a' })
    agents.live.get('yzj-home-g-a')?.session.append('user/message', { content: '旧问题' })
    ctx.provide('agents', agents)
    const handler = createRpcHandler(ctx, { list: () => [], decide: () => false })
    const opened = await handler('home-open', { groupId: 'g-a' }, undefined as never)
    expect(opened.ok && opened.value).toMatchObject({
      sessionId: 'yzj-home-g-a',
      legacyTopicSessionId: 'yzj-topic-g-a-legacy-host',
    })
    expect(attached).toEqual(['yzj-topic-g-a-legacy-host'])
  })

  it('home-handoff attaches only the minted topic, not the room host', async () => {
    const { BoundLogStore } = await import('@dsh-yzj/tool-yzj/src/bound-log.ts')
    const store = new BoundLogStore()
    const ctx = new Context()
    const { attached, registry } = recordingRegistry()
    ctx.provide('workspaceRegistry', registry)
    const rows = new Map<string, { dshSessionId: string; yzjConversationId: string; yzjKind: 'group' | 'dm' }>()
    const topics = new Map<string, { sessionId: string }>()
    ctx.provide('yzjHome', {
      ensureBound: async (id: string, kind: 'group' | 'dm') => {
        const existing = rows.get(id)
        if (existing !== undefined) return { sessionId: existing.dshSessionId, created: false, yzjKind: existing.yzjKind }
        const row = { dshSessionId: `yzj-home-${id}`, yzjConversationId: id, yzjKind: kind }
        rows.set(id, row)
        await store.ensureHeader(id, row.dshSessionId, kind)
        return { sessionId: row.dshSessionId, created: true, yzjKind: kind }
      },
      ensureTopic: async (input: { yzjConversationId: string }) => {
        const sessionId = `yzj-topic-${input.yzjConversationId}-handoff`
        const existing = topics.get(sessionId)
        if (existing !== undefined) return { sessionId, created: false }
        topics.set(sessionId, { sessionId })
        return { sessionId, created: true }
      },
      getByConversation: (id: string) => rows.get(id),
      getBySession: (id: string) => [...rows.values()].find(row => row.dshSessionId === id),
      appendLog: (id: string, incoming: never, options?: never) => {
        const row = rows.get(id)
        if (row === undefined) return Promise.resolve({ accepted: false, reason: 'unbound' })
        return store.append(id, row.dshSessionId, row.yzjKind, incoming, options)
      },
      getLog: (id: string) => store.get(id),
      getLogBySession: (id: string) => {
        const row = [...rows.values()].find(item => item.dshSessionId === id)
        return row === undefined ? undefined : store.get(row.yzjConversationId)
      },
      ackLocal: (id: string, local: string, real: string) => store.ackLocal(id, local, real),
      failLocal: (id: string, local: string) => store.failLocal(id, local),
      formatSummonWindow: () => '',
      logs: store,
    })
    ctx.provide('agents', liveAgents())
    ;(ctx as unknown as { yzjBridge: { run: (command: readonly string[]) => Promise<RunResult> } }).yzjBridge = {
      run: async (command) => command[0] === 'contact' ? runOf([{ openId: 'me', name: '国鑫' }]) : runOf({ msgId: 'm-digest' }),
    }
    const handler = createRpcHandler(ctx, { list: () => [], decide: () => false })
    const result = await handler('home-handoff', { groupId: 'g-a', digest: '［摘要］结论' }, undefined as never)
    expect(result.ok && result.value).toMatchObject({
      sessionId: 'yzj-home-g-a',
      topicSessionId: 'yzj-topic-g-a-handoff',
    })
    expect(attached).toEqual(['yzj-topic-g-a-handoff'])
  })

  it('home-open fails closed without yzjHome', async () => {
    const ctx = mountBridge({})
    const handler = createRpcHandler(ctx, { list: () => [], decide: () => false })
    const result = await handler('home-open', { groupId: 'g-a' }, undefined as never)
    expect(result.ok).toBe(false)
  })

  it('home-topic-lens and home-topic-ask fail closed without a topic session', async () => {
    const ctx = mountBridge({})
    const handler = createRpcHandler(ctx, { list: () => [], decide: () => false })
    expect((await handler('home-topic-lens', {}, undefined as never)).ok).toBe(false)
    expect((await handler('home-topic-ask', {}, undefined as never)).ok).toBe(false)
    const noHome = await handler('home-topic-lens', { sessionId: 'yzj-topic-1' }, undefined as never)
    expect(noHome).toEqual({
      ok: false,
      error: { code: 'internal', message: 'home-topic-lens: yzjHome 服务不可用（tool-yzj 未挂载）', details: {} },
    })
  })

  it('home-send writes ② into the bound log without a user-turn', async () => {
    const { BoundLogStore } = await import('@dsh-yzj/tool-yzj/src/bound-log.ts')
    const store = new BoundLogStore()
    const ctx = new Context()
    const rows = new Map<string, { dshSessionId: string; yzjConversationId: string; yzjKind: 'group' | 'dm' }>()
    ctx.provide('yzjHome', {
      ensureBound: async (id: string, kind: 'group' | 'dm') => {
        const existing = rows.get(id)
        if (existing !== undefined) return { sessionId: existing.dshSessionId, created: false, yzjKind: existing.yzjKind }
        const row = { dshSessionId: `yzj-home-${id}`, yzjConversationId: id, yzjKind: kind }
        rows.set(id, row)
        await store.ensureHeader(id, row.dshSessionId, kind)
        return { sessionId: row.dshSessionId, created: true, yzjKind: kind }
      },
      getByConversation: (id: string) => rows.get(id),
      getBySession: (id: string) => [...rows.values()].find(row => row.dshSessionId === id),
      appendLog: (id: string, incoming: never, options?: never) => {
        const row = rows.get(id)
        if (row === undefined) return Promise.resolve({ accepted: false, reason: 'unbound' })
        return store.append(id, row.dshSessionId, row.yzjKind, incoming, options)
      },
      getLog: (id: string) => store.get(id),
      getLogBySession: (id: string) => {
        const row = [...rows.values()].find(item => item.dshSessionId === id)
        return row === undefined ? undefined : store.get(row.yzjConversationId)
      },
      ackLocal: (id: string, local: string, real: string) => store.ackLocal(id, local, real),
      failLocal: (id: string, local: string) => store.failLocal(id, local),
      formatSummonWindow: () => '',
      logs: store,
    })
    ctx.provide('agents', {
      get: () => ({ session: { events: [] } }),
      resume: async () => { throw new Error('no log') },
      create: async () => ({}),
    })
    ;(ctx as unknown as { yzjBridge: { run: (command: readonly string[]) => Promise<RunResult> } }).yzjBridge = {
      run: async (command) => command[0] === 'contact' ? runOf([{ openId: 'me', name: '国鑫' }]) : runOf({ msgId: 'm-real' }),
    }
    const handler = createRpcHandler(ctx, { list: () => [], decide: () => false })
    const opened = await handler('home-open', { groupId: 'g-a' }, undefined as never)
    expect(opened.ok).toBe(true)
    const sent = await handler('home-send', { sessionId: 'yzj-home-g-a', content: '发进群' }, undefined as never)
    expect(sent.ok).toBe(true)
    const fused = await handler('home-fused', { sessionId: 'yzj-home-g-a' }, undefined as never)
    expect(fused.ok && (fused.value as { bound: boolean }).bound).toBe(true)
    expect((fused.value as { items: { kind: string }[] }).items.some(item => item.kind === 'im')).toBe(true)
    const byGroup = await handler('home-fused', { groupId: 'g-a' }, undefined as never)
    expect(byGroup.ok && (byGroup.value as { kind: string }).kind).toBe('room')
    expect((byGroup.value as { binding: { yzjConversationId: string } }).binding.yzjConversationId).toBe('g-a')
  })

  it('home-nav nests topics under the group room', async () => {
    const { BoundLogStore } = await import('@dsh-yzj/tool-yzj/src/bound-log.ts')
    const store = new BoundLogStore()
    const ctx = new Context()
    const rows = new Map<string, { dshSessionId: string; yzjConversationId: string; yzjKind: 'group' | 'dm' }>()
    ctx.provide('yzjHome', {
      ensureBound: async (id: string, kind: 'group' | 'dm') => {
        const row = { dshSessionId: `yzj-home-${id}`, yzjConversationId: id, yzjKind: kind }
        rows.set(id, row)
        await store.ensureHeader(id, row.dshSessionId, kind)
        return { sessionId: row.dshSessionId, created: true, yzjKind: kind }
      },
      getByConversation: (id: string) => rows.get(id),
      getBySession: (id: string) => [...rows.values()].find(row => row.dshSessionId === id),
      appendLog: async () => ({ accepted: false, reason: 'unbound' }),
      getLog: (id: string) => store.get(id),
      getLogBySession: () => undefined,
      ackLocal: (id: string, local: string, real: string) => store.ackLocal(id, local, real),
      failLocal: (id: string, local: string) => store.failLocal(id, local),
      formatSummonWindow: () => '',
      logs: store,
      listBindings: () => [...rows.values()],
      listTopics: () => [{
        dshSessionId: 'yzj-topic-g-a-m1',
        yzjConversationId: 'g-a',
        title: '整理接口清单',
        source: 'dsh',
        createdAt: 1,
      }],
    })
    ctx.provide('agents', { get: () => ({ session: { events: [{ type: 'session/title', data: { title: '金蝶最小DSH交流群' } }] } }) })
    ;(ctx as unknown as { yzjBridge: { run: (command: readonly string[]) => Promise<RunResult> } }).yzjBridge = {
      run: async () => runOf({}),
    }
    const handler = createRpcHandler(ctx, { list: () => [], decide: () => false })
    await handler('home-open', { groupId: 'g-a' }, undefined as never)
    const nav = await handler('home-nav', {}, undefined as never)
    expect(nav.ok && nav.value).toMatchObject({
      rooms: [{
        groupId: 'g-a',
        groupName: '金蝶最小DSH交流群',
        sessionId: 'yzj-home-g-a',
        topics: [{ sessionId: 'yzj-topic-g-a-m1', title: '整理接口清单' }],
      }],
    })
  })

  it('home-nav backfills placeholder room names from CLI recent pages', async () => {
    clearRecentNamesCache()
    const { BoundLogStore } = await import('@dsh-yzj/tool-yzj/src/bound-log.ts')
    const store = new BoundLogStore()
    const ctx = new Context()
    const rows = new Map<string, { dshSessionId: string; yzjConversationId: string; yzjKind: 'group' | 'dm' }>()
    ctx.provide('yzjHome', {
      ensureBound: async (id: string, kind: 'group' | 'dm') => {
        const sessionId = `yzj-home-${id}`
        rows.set(id, { dshSessionId: sessionId, yzjConversationId: id, yzjKind: kind })
        return { sessionId, created: true, yzjKind: kind }
      },
      getByConversation: (id: string) => rows.get(id),
      getBySession: (id: string) => [...rows.values()].find(row => row.dshSessionId === id),
      appendLog: (id: string, incoming: never, options?: never) => {
        const row = rows.get(id)
        if (row === undefined) return Promise.resolve({ accepted: false, reason: 'unbound' })
        return store.append(id, row.dshSessionId, row.yzjKind, incoming, options)
      },
      getLog: (id: string) => store.get(id),
      getLogBySession: () => undefined,
      ackLocal: (id: string, local: string, real: string) => store.ackLocal(id, local, real),
      failLocal: (id: string, local: string) => store.failLocal(id, local),
      listBindings: () => [...rows.values()],
      listTopics: () => [],
      formatSummonWindow: () => '',
      logs: store,
    })
    // No pinned session/title anywhere → the snapshot name is the 群房间 placeholder.
    ctx.provide('agents', { get: () => ({ session: { events: [] } }) })
    ;(ctx as unknown as { yzjBridge: { run: (command: readonly string[]) => Promise<RunResult> } }).yzjBridge = {
      run: async (command) => command.join(' ') === 'im group recent --limit 20 --page 1'
        ? runOf({ list: [{ groupId: 'g-b', groupName: '金蝶最大AI交流群' }] })
        : runOf({}),
    }
    const handler = createRpcHandler(ctx, { list: () => [], decide: () => false })
    await handler('home-open', { groupId: 'g-b' }, undefined as never)
    const nav = await handler('home-nav', {}, undefined as never)
    expect(nav.ok && nav.value).toMatchObject({
      rooms: [{ groupId: 'g-b', groupName: '金蝶最大AI交流群' }],
    })
    clearRecentNamesCache()
  })

  it('unknown endpoints fail closed', async () => {
    const ctx = mountBridge({})
    const gate: YzjWriteGateFace = { list: () => [], decide: () => false }
    const handler = createRpcHandler(ctx, gate)
    const result = await handler('nope', {}, undefined as never)
    expect(result.ok).toBe(false)
  })

  it('im-send forwards @ mentions with one at-open-id per @姓名 fragment (issue #4)', async () => {
    const commands: string[][] = []
    const ctx = new Context()
    ;(ctx as unknown as { yzjBridge: { run: (command: readonly string[]) => Promise<RunResult> } }).yzjBridge = {
      run: async (command: readonly string[]) => {
        commands.push([...command])
        return runOf({ msgId: 'm1' })
      },
    }
    const gate: YzjWriteGateFace = { list: () => [], decide: () => false }
    const handler = createRpcHandler(ctx, gate)
    // Two @ fragments, two atOpenIds in order → forwarded verbatim.
    const ok = await handler('im-send', {
      groupId: 'g1', msgType: 'text', content: '@张三 评审下 @李四 的方案',
      atOpenIds: ['open-zs', 'open-ls'],
    }, undefined as never)
    expect(ok.ok).toBe(true)
    expect(commands[0]).toEqual([
      'im', 'message', 'send', '--msg-type', 'text', '--group-id', 'g1',
      '--content', '@张三 评审下 @李四 的方案',
      '--at-open-id', 'open-zs', '--at-open-id', 'open-ls',
    ])
    // Count mismatch rejected.
    const mismatch = await handler('im-send', {
      groupId: 'g1', msgType: 'text', content: '@张三 评审下 @李四 的方案',
      atOpenIds: ['open-zs'],
    }, undefined as never)
    expect(mismatch.ok).toBe(false)
    // @all requires both the fragment and the flag together.
    const all = await handler('im-send', {
      groupId: 'g1', msgType: 'text', content: '@all 周四发布', atAll: true,
    }, undefined as never)
    expect(all.ok).toBe(true)
    expect(commands[commands.length - 1]).toContain('--at-all')
    const allNoFragment = await handler('im-send', {
      groupId: 'g1', msgType: 'text', content: '周四发布', atAll: true,
    }, undefined as never)
    expect(allNoFragment.ok).toBe(false)
  })

  it('auth-status projects a logged-in whoami as loggedIn', async () => {
    const ctx = mountBridge({
      'contact user get': runOf({ name: '单国鑫', openId: 'oid-1' }),
    })
    const handler = createRpcHandler(ctx, { list: () => [], decide: () => false })
    const result = await handler('auth-status', {}, undefined as never)
    expect(result.ok && result.value).toEqual({
      loggedIn: true, name: '单国鑫', openId: 'oid-1', reason: '',
    })
  })

  it('auth-status treats a CLI auth failure as logged-out, not an RPC error', async () => {
    const ctx = mountBridge({
      'contact user get': { ok: false, exitCode: 1, stdout: '', stderr: 'error: no app credentials configured -- run \'yzj-cli auth login\' first' },
    })
    const handler = createRpcHandler(ctx, { list: () => [], decide: () => false })
    const result = await handler('auth-status', {}, undefined as never)
    expect(result.ok).toBe(true)
    expect(result.ok && (result.value as { loggedIn: boolean; reason: string }).loggedIn).toBe(false)
    expect(result.ok && (result.value as { reason: string }).reason).toContain('no app credentials')
  })

  it('auth-login starts yzj-cli auth login and does not wait for the browser', async () => {
    const started: string[][] = []
    const ctx = new Context()
    ;(ctx as unknown as { yzjBridge: { start: (command: readonly string[]) => Promise<{ alreadyRunning: boolean }> } }).yzjBridge = {
      start: async (command) => {
        started.push([...command])
        return { alreadyRunning: false }
      },
    }
    const handler = createRpcHandler(ctx, { list: () => [], decide: () => false })
    const result = await handler('auth-login', {}, undefined as never)
    expect(result).toEqual({ ok: true, value: { started: true, alreadyRunning: false } })
    expect(started).toEqual([['auth', 'login']])
  })

  it('write-gate + handler integrate end to end', async () => {
    const ctx = new Context()
    const gate = applyWriteGate(ctx)
    const handler = createRpcHandler(ctx, gate)
    // ask-pending broadcast (as the tool guard would emit it)
    ctx.emit('yzj/ask-pending', { callId: 'c9', toolName: 'yzj_doc_create', level: 'standard', reason: 'r', args: { title: 'x' } })
    // approval/request waterfall with an audit pair in the session log
    const session = { id: 's1', events: [{ type: 'approval/asked', data: { id: 'w9', callId: 'c9' } }] }
    const pending = ctx.waterfall('approval/request', {
      agent: { session },
      toolName: 'yzj_doc_create',
      callId: 'c9',
    }, () => Promise.resolve('unavailable' as const))
    const listed = await handler('write-list', { sessionId: 's1', callId: 'c9' }, undefined as never)
    const records = (listed.ok ? listed.value : { list: [] }) as { list: Array<{ writeId: string; domain: string; level: string; status: string; args: Record<string, unknown> }> }
    expect(records.list.length).toBe(1)
    expect(records.list[0]).toMatchObject({ writeId: 'w9', domain: 'doc', level: 'standard', status: 'pending', args: { title: 'x' } })
    const decided = await handler('write-decide', { writeId: 'w9', outcome: 'allowed-once' }, undefined as never)
    expect(decided.ok && (decided.value as { settled: boolean }).settled).toBe(true)
    await expect(pending).resolves.toBe('allowed-once')
    const after = await handler('write-list', { sessionId: 's1', callId: 'c9' }, undefined as never)
    const afterList = (after.ok ? after.value : { list: [] }) as { list: Array<{ status: string }> }
    expect(afterList.list[0].status).toBe('approved')
  })
})
