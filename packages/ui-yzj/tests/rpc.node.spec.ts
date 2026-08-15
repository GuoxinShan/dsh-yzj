/**
 * Node-half RPC endpoint specs: the `/yzj` handler validates payloads,
 * forwards bridge reads, and projects write-gate records into lossless JSON
 * while rejecting unknown outcomes. The write-gate itself is exercised
 * end-to-end in write-gate.spec.ts; here we pin the endpoint contract.
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { applyWriteGate } from '../src/write-gate.ts'
import { createRpcHandler, type YzjWriteGateFace } from '../src/index.ts'
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
