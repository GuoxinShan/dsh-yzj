/**
 * Approval-guard specs: WRITE_SPECS asks for gated writes and delegates
 * yzj_advance_feed only asks when it rewrites the baseline (决策 14 / §13.5).
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

  it('asks for yzj_advance_feed only when it rewrites the baseline (决策 14 / §13.5)', async () => {
    const { listener, pending } = guard()
    const silent = [
      { advanceId: 'A-1', summary: '进度正常，覆盖率 82' },
      { advanceId: 'A-1', summary: '偏差：客户改口径', stageTo: 'decision-needed' },
      { advanceId: 'A-1', summary: '产物齐', stageTo: 'ready-for-review' },
      { advanceId: 'A-1', summary: '空基准字段不算改写', goal: '   ' },
    ]
    for (const [index, args] of silent.entries()) {
      const decision = await listener({ name: 'yzj_advance_feed', callId: `c-quiet-${index}`, arguments: args }, async () => ({ kind: 'allow' }))
      expect(decision.kind, JSON.stringify(args)).toBe('allow')
    }
    expect(pending).toHaveLength(0)
    for (const field of ['goal', 'metrics', 'targetDate', 'assignee']) {
      const decision = await listener({
        name: 'yzj_advance_feed', callId: `c-${field}`, arguments: { advanceId: 'A-1', summary: '换基准', [field]: '新值' },
      }, async () => ({ kind: 'allow' }))
      expect(decision.kind, field).toBe('ask')
    }
    expect(pending.map(entry => entry.toolName)).toEqual(Array.from({ length: 4 }, () => 'yzj_advance_feed'))
    expect(pending.every(entry => entry.level === 'standard')).toBe(true)
  })

  it('asks for yzj_advance_create unconditionally (立项 is a new object)', async () => {
    const { listener, pending } = guard()
    const decision = await listener({ name: 'yzj_advance_create', callId: 'c1', arguments: { title: '试运行' } }, async () => ({ kind: 'allow' }))
    expect(decision.kind).toBe('ask')
    expect(pending[0]).toMatchObject({ toolName: 'yzj_advance_create', level: 'standard' })
  })

  it('asks for every design-listed standard write tool', async () => {
    const { listener, pending } = guard()
    const names = [
      'yzj_doc_workspace_create', 'yzj_doc_create', 'yzj_doc_rename', 'yzj_doc_import',
      'yzj_doc_block_insert', 'yzj_doc_block_update', 'yzj_sheet_create',
      'yzj_sheet_table_create', 'yzj_sheet_table_rename', 'yzj_sheet_record_create',
      'yzj_sheet_record_update', 'yzj_calendar_event_create', 'yzj_calendar_event_update',
    ]
    for (const name of names) {
      const decision = await listener({ name, callId: `c${name}`, arguments: {} }, async () => ({ kind: 'allow' }))
      expect(decision.kind, name).toBe('ask')
    }
    expect(pending.length).toBe(names.length)
    expect(pending.every(entry => entry.level === 'standard')).toBe(true)
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

  it('delegates yzj_advance_scan and yzj_advance_inspect (read-only, spec §14.6)', async () => {
    const { listener, pending } = guard()
    for (const name of ['yzj_advance_scan', 'yzj_advance_inspect'] as const) {
      const decision = await listener({ name, callId: `c-${name}`, arguments: {} }, async () => ({ kind: 'allow' }))
      expect(decision.kind, name).toBe('allow')
    }
    expect(pending).toEqual([])
  })
})
