/**
 * Approval-guard specs: WRITE_SPECS waits on yzj/confirm-request (not harness ask).
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { applyApprovalGuard, type YzjConfirmOutcome, type YzjConfirmRequest } from '../src/guard.ts'

describe('approval guard', () => {
  type PreToolDecision = { kind: 'allow' } | { kind: 'ask'; reason: string } | { kind: 'deny'; reason: string }
  type Listener = (exec: {
    name: string
    callId: string
    arguments: unknown
    signal?: YzjConfirmRequest['signal']
    agent?: { session: { id: string } }
  }, next: () => Promise<PreToolDecision>) => Promise<PreToolDecision>
  interface Pending { callId: string; toolName: string; level: string; reason: string; args: Record<string, unknown> }

  function guard(answer: () => Promise<YzjConfirmOutcome> = async () => 'unavailable'): {
    listener: Listener
    pending: Pending[]
    confirms: YzjConfirmRequest[]
  } {
    let listener: Listener = async () => ({ kind: 'allow' })
    const pending: Pending[] = []
    const confirms: YzjConfirmRequest[] = []
    const ctx = {
      on(_event: string, fn: Listener): void {
        listener = fn
      },
      emit(_event: string, payload: Pending): void {
        pending.push(payload)
      },
      waterfall(_event: string, payload: YzjConfirmRequest, next: () => Promise<YzjConfirmOutcome>): Promise<YzjConfirmOutcome> {
        confirms.push(payload)
        return answer()
      },
    } as unknown as Context
    applyApprovalGuard(ctx)
    return { listener, pending, confirms }
  }

  const session = { agent: { session: { id: 's1' } } }

  it('confirms yzj_doc_delete at strong level and allows when the gate grants', async () => {
    const { listener, pending, confirms } = guard(async () => 'allowed-once')
    const decision = await listener({ name: 'yzj_doc_delete', callId: 'c1', arguments: { id: 'x' }, ...session }, async () => ({ kind: 'allow' }))
    expect(decision.kind).toBe('allow')
    expect(pending[0]).toMatchObject({ callId: 'c1', toolName: 'yzj_doc_delete', level: 'strong', args: { id: 'x' } })
    expect(confirms[0]).toMatchObject({ sessionId: 's1', callId: 'c1', toolName: 'yzj_doc_delete' })
    expect(confirms[0]?.reason).toContain('删除')
  })

  it('confirms yzj_im_message_recall at strong level without merging', async () => {
    const { listener, pending } = guard(async () => 'allowed-once')
    const decision = await listener({
      name: 'yzj_im_message_recall', callId: 'c1', arguments: { msgId: 'm1', groupId: 'g1' }, ...session,
    }, async () => ({ kind: 'allow' }))
    expect(decision.kind).toBe('allow')
    expect(pending[0]?.level).toBe('strong')
    expect(pending[0]?.reason).toContain('撤回')
  })

  it('confirms yzj_im_group_rename and yzj_doc_folder_create at standard level', async () => {
    const { listener, pending } = guard(async () => 'allowed-once')
    await listener({ name: 'yzj_im_group_rename', callId: 'c1', arguments: { groupId: 'g1', name: '新' }, ...session }, async () => ({ kind: 'allow' }))
    await listener({ name: 'yzj_doc_folder_create', callId: 'c2', arguments: { workspace: 'kb', title: '夹' }, ...session }, async () => ({ kind: 'allow' }))
    expect(pending[0]?.level).toBe('standard')
    expect(pending[1]?.level).toBe('standard')
  })

  it('confirms yzj_im_message_send at standard level', async () => {
    const { listener, pending, confirms } = guard(async () => 'allowed-once')
    const decision = await listener({ name: 'yzj_im_message_send', callId: 'c1', arguments: { groupId: 'g' }, ...session }, async () => ({ kind: 'allow' }))
    expect(decision.kind).toBe('allow')
    expect(pending[0]?.level).toBe('standard')
    expect(confirms).toHaveLength(1)
  })

  it('denies when the user rejects the card', async () => {
    const { listener } = guard(async () => 'rejected')
    const decision = await listener({ name: 'yzj_im_message_send', callId: 'c1', arguments: { groupId: 'g' }, ...session }, async () => ({ kind: 'allow' }))
    expect(decision.kind).toBe('deny')
    expect((decision as { reason: string }).reason).toContain('拒绝')
  })

  it('denies when no write-gate answers (headless / unavailable)', async () => {
    const { listener, pending, confirms } = guard()
    const decision = await listener({ name: 'yzj_doc_create', callId: 'c1', arguments: {}, ...session }, async () => ({ kind: 'allow' }))
    expect(decision.kind).toBe('deny')
    expect((decision as { reason: string }).reason).toContain('没有确认通道')
    expect(pending).toHaveLength(1)
    expect(confirms).toHaveLength(1)
  })

  it('never returns harness ask — Full access approval=never would auto-deny that', async () => {
    const { listener } = guard(async () => 'allowed-once')
    const decision = await listener({ name: 'yzj_im_message_send', callId: 'c1', arguments: {}, ...session }, async () => ({ kind: 'allow' }))
    expect(decision.kind).not.toBe('ask')
  })

  it('asks for yzj_file_download only when overwriting', async () => {
    const { listener, pending, confirms } = guard(async () => 'allowed-once')
    const plain = await listener({ name: 'yzj_file_download', callId: 'c1', arguments: { id: 'f' }, ...session }, async () => ({ kind: 'allow' }))
    expect(plain.kind).toBe('allow')
    expect(confirms).toEqual([])
    const overwrite = await listener({ name: 'yzj_file_download', callId: 'c2', arguments: { id: 'f', overwrite: true }, ...session }, async () => ({ kind: 'allow' }))
    expect(overwrite.kind).toBe('allow')
    expect(pending[0]?.level).toBe('standard')
    expect(confirms).toHaveLength(1)
  })

  it('confirms every design-listed standard write tool', async () => {
    const { listener, pending, confirms } = guard(async () => 'allowed-once')
    const names = [
      'yzj_doc_workspace_create', 'yzj_doc_create', 'yzj_doc_rename', 'yzj_doc_import',
      'yzj_doc_block_insert', 'yzj_doc_block_update', 'yzj_sheet_create',
      'yzj_sheet_table_create', 'yzj_sheet_table_rename', 'yzj_sheet_record_create',
      'yzj_sheet_record_update', 'yzj_calendar_event_create', 'yzj_calendar_event_update',
    ]
    for (const name of names) {
      const decision = await listener({ name, callId: `c${name}`, arguments: {}, ...session }, async () => ({ kind: 'allow' }))
      expect(decision.kind, name).toBe('allow')
    }
    expect(pending.length).toBe(names.length)
    expect(pending.every(entry => entry.level === 'standard')).toBe(true)
    expect(confirms.length).toBe(names.length)
  })

  it('does not confirm robot_notify on leftover yzj-robot-* (operatorOnly still throws at execute)', async () => {
    const { listener, pending, confirms } = guard(async () => 'allowed-once')
    const decision = await listener({
      name: 'robot_notify', callId: 'c1', arguments: { text: 'x' },
      agent: { session: { id: 'yzj-robot-old' } },
    }, async () => ({ kind: 'allow' }))
    expect(decision.kind).toBe('allow')
    expect(pending).toEqual([])
    expect(confirms).toEqual([])
  })

  it('delegates robot_status (read-only control)', async () => {
    const { listener, confirms } = guard(async () => 'allowed-once')
    const decision = await listener({
      name: 'robot_status', callId: 'c1', arguments: {},
      agent: { session: { id: 'yzj-home-g-a' } },
    }, async () => ({ kind: 'allow' }))
    expect(decision.kind).toBe('allow')
    expect(confirms).toEqual([])
  })

})
