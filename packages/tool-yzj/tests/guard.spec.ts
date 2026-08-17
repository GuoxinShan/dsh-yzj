/**
 * Approval-guard specs: WRITE_SPECS asks for gated writes and delegates
 * the rest. Bound-home robot_notify / robot_continue must ask (D9); the
 * unbound operator console and leftover yzj-robot-* ids do not.
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { applyApprovalGuard } from '../src/guard.ts'

describe('approval guard', () => {
  type PreToolDecision = { kind: 'allow' } | { kind: 'ask'; reason: string } | { kind: 'deny'; reason: string }
  type Listener = (exec: {
    name: string
    callId: string
    arguments: unknown
    agent?: { session: { id: string } }
  }, next: () => Promise<PreToolDecision>) => Promise<PreToolDecision>
  interface Pending { callId: string; toolName: string; level: string; reason: string; args: Record<string, unknown> }

  function guard(): { listener: Listener; pending: Pending[] } {
    let listener: Listener = async () => ({ kind: 'allow' })
    const pending: Pending[] = []
    const ctx = {
      on(_event: string, fn: Listener): void {
        listener = fn
      },
      emit(_event: string, payload: Pending): void {
        pending.push(payload)
      },
    } as unknown as Context
    applyApprovalGuard(ctx)
    return { listener, pending }
  }

  it('asks for yzj_doc_delete at strong level', async () => {
    const { listener, pending } = guard()
    const decision = await listener({ name: 'yzj_doc_delete', callId: 'c1', arguments: { id: 'x' } }, async () => ({ kind: 'allow' }))
    expect(decision.kind).toBe('ask')
    expect((decision as { reason: string }).reason).toContain('删除')
    expect(pending[0]).toMatchObject({ callId: 'c1', toolName: 'yzj_doc_delete', level: 'strong', args: { id: 'x' } })
  })

  it('asks for yzj_im_message_send at standard level', async () => {
    const { listener, pending } = guard()
    const decision = await listener({ name: 'yzj_im_message_send', callId: 'c1', arguments: { groupId: 'g' } }, async () => ({ kind: 'allow' }))
    expect(decision.kind).toBe('ask')
    expect(pending[0].level).toBe('standard')
  })

  it('asks for yzj_file_download only when overwriting', async () => {
    const { listener, pending } = guard()
    const plain = await listener({ name: 'yzj_file_download', callId: 'c1', arguments: { id: 'f' } }, async () => ({ kind: 'allow' }))
    expect(plain.kind).toBe('allow')
    const overwrite = await listener({ name: 'yzj_file_download', callId: 'c2', arguments: { id: 'f', overwrite: true } }, async () => ({ kind: 'allow' }))
    expect(overwrite.kind).toBe('ask')
    expect(pending[0].level).toBe('standard')
  })

  it('asks for every design-listed standard write tool', async () => {
    const { listener, pending } = guard()
    const names = [
      'yzj_doc_workspace_create', 'yzj_doc_create', 'yzj_doc_rename', 'yzj_doc_import',
      'yzj_doc_block_insert', 'yzj_doc_block_update', 'yzj_sheet_create',
      'yzj_sheet_table_create', 'yzj_sheet_table_rename', 'yzj_sheet_record_create',
      'yzj_sheet_record_update', 'yzj_calendar_event_create', 'yzj_calendar_event_update',
      'robot_share_write',
    ]
    for (const name of names) {
      const decision = await listener({ name, callId: `c${name}`, arguments: {} }, async () => ({ kind: 'allow' }))
      expect(decision.kind, name).toBe('ask')
    }
    expect(pending.length).toBe(names.length)
    expect(pending.every(entry => entry.level === 'standard')).toBe(true)
  })

  it('asks for robot_share_write with the workspace confirmation prefix', async () => {
    const { listener, pending } = guard()
    const decision = await listener({ name: 'robot_share_write', callId: 'c1', arguments: { filename: 'report.md' } }, async () => ({ kind: 'allow' }))
    expect(decision.kind).toBe('ask')
    expect((decision as { reason: string }).reason).toContain('工作区写操作确认')
    expect(pending[0]).toMatchObject({ toolName: 'robot_share_write', level: 'standard', args: { filename: 'report.md' } })
  })

  it('asks for robot_notify / robot_continue on a bound yzj-home-* session (D9)', async () => {
    const { listener, pending } = guard()
    const home = { agent: { session: { id: 'yzj-home-g-a' } } }
    for (const name of ['robot_notify', 'robot_continue'] as const) {
      const decision = await listener({
        name, callId: `c-${name}`, arguments: { text: '推群' }, ...home,
      }, async () => ({ kind: 'allow' }))
      expect(decision.kind, name).toBe('ask')
    }
    expect(pending.map(entry => entry.toolName)).toEqual(['robot_notify', 'robot_continue'])
    expect(pending.every(entry => entry.level === 'standard')).toBe(true)
  })

  it('asks for robot_notify / robot_continue on a yzj-topic-* session (R10)', async () => {
    const { listener, pending } = guard()
    const topic = { agent: { session: { id: 'yzj-topic-g-a-root' } } }
    for (const name of ['robot_notify', 'robot_continue'] as const) {
      const decision = await listener({
        name, callId: `c-t-${name}`, arguments: { text: '推群' }, ...topic,
      }, async () => ({ kind: 'allow' }))
      expect(decision.kind, name).toBe('ask')
    }
    expect(pending.map(entry => entry.toolName)).toEqual(['robot_notify', 'robot_continue'])
  })

  it('asks for robot_notify when the calling session id is missing (fail closed)', async () => {
    const { listener, pending } = guard()
    const decision = await listener({ name: 'robot_notify', callId: 'c1', arguments: { text: 'x' } }, async () => ({ kind: 'allow' }))
    expect(decision.kind).toBe('ask')
    expect(pending[0]?.toolName).toBe('robot_notify')
  })

  it('does not ask for robot_notify / robot_continue on the unbound operator console', async () => {
    const { listener, pending } = guard()
    const unbound = { agent: { session: { id: 'sess-private' } } }
    for (const name of ['robot_notify', 'robot_continue'] as const) {
      const decision = await listener({
        name, callId: `c-${name}`, arguments: { text: '推群' }, ...unbound,
      }, async () => ({ kind: 'allow' }))
      expect(decision.kind, name).toBe('allow')
    }
    expect(pending).toEqual([])
  })

  it('does not ask for robot_notify on leftover yzj-robot-* (operatorOnly still throws at execute)', async () => {
    const { listener, pending } = guard()
    const decision = await listener({
      name: 'robot_notify', callId: 'c1', arguments: { text: 'x' },
      agent: { session: { id: 'yzj-robot-old' } },
    }, async () => ({ kind: 'allow' }))
    expect(decision.kind).toBe('allow')
    expect(pending).toEqual([])
  })

  it('delegates robot_status (read-only control)', async () => {
    const { listener } = guard()
    const decision = await listener({
      name: 'robot_status', callId: 'c1', arguments: {},
      agent: { session: { id: 'yzj-home-g-a' } },
    }, async () => ({ kind: 'allow' }))
    expect(decision.kind).toBe('allow')
  })

  it('delegates non-dangerous tools', async () => {
    const { listener } = guard()
    const decision = await listener({ name: 'yzj_doc_list', callId: 'c1', arguments: { workspace: 'kb' } }, async () => ({ kind: 'allow' }))
    expect(decision.kind).toBe('allow')
  })
})
