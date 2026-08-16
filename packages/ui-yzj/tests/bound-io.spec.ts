/**
 * Bound-home I/O: optimistic ②, backfill/dedupe, fused merge, D8 handoff.
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import {
  BoundLogStore, formatSummonWindow, type BoundLogLimits, type YzjLogEntry,
} from '@dsh-yzj/tool-yzj/src/bound-log.ts'
import {
  backfillBoundLog, fusedSnapshot, handoffToGroup, parseImSend, parseWhoami, robotSkipOpenIds,
  sendImAndLog, type HomeIoFace,
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
    formatSummonWindow: (id, exclude) => formatSummonWindow(store.get(id), {
      maxMessages: 20, maxChars: 4000, ...(exclude === undefined ? {} : { excludeMsgId: exclude }),
    }),
    logs: store,
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

  it('skips robot outbound openIds (T12)', async () => {
    const home = memoryHomeIo()
    await home.ensureBound('g-a', 'group')
    const ctx = new Context()
    ctx.provide('yzjRobot', { statuses: () => [{ surface: [{ robotId: 'BOT-r' }] }] })
    ;(ctx as unknown as { yzjBridge: { run: (command: readonly string[]) => Promise<ReturnType<typeof runOf>> } }).yzjBridge = {
      run: async (command) => {
        if (command[0] === 'contact') return runOf([{ openId: 'me' }])
        return runOf({ list: [{ msgId: 'bot-1', content: '机器人帖', fromOpenId: 'BOT-r', sendTime: '2026-08-16 20:00:00.000' }] })
      },
    }
    await backfillBoundLog(ctx, home, 'g-a', 20)
    expect(home.getLog('g-a')?.entries).toHaveLength(0)
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
          { type: 'user/message', time: 20, data: { source: { kind: 'user' }, content: [{ type: 'text', text: '发给 Claude' }] } },
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
