/**
 * advance-action-run orchestration specs (决策 45): effect → execution 事元
 * (refs + 动作序 mark) → auto-subscribe, in one RPC. Idempotence by action
 * key or kind+text; effect failure leaves no entry behind.
 */
import { describe, expect, it } from 'vitest'
import { runAdvanceAction, type AdvanceActionDeps, type ActionRunInput } from '../src/advance-action.ts'

interface Calls {
  feeds: Record<string, unknown>[]
  sourceAdds: { advanceId: string; token: string; label?: string }[]
  todos: Record<string, unknown>[]
  sent: { groupId: string; content: string }[]
}

function fakeDeps(over?: {
  entries?: unknown[]
  sendValue?: unknown
  todoThrows?: boolean
  sourceAddThrows?: boolean
  noTodo?: boolean
}): { deps: AdvanceActionDeps; calls: Calls } {
  const calls: Calls = { feeds: [], sourceAdds: [], todos: [], sent: [] }
  const deps: AdvanceActionDeps = {
    advance: {
      get: async () => ({ entries: over?.entries ?? [] }),
      feed: async (input) => {
        calls.feeds.push(input as Record<string, unknown>)
        return {}
      },
      sourceAdd: async (advanceId, token, label) => {
        if (over?.sourceAddThrows === true) throw new Error('dbt 抖动')
        calls.sourceAdds.push({ advanceId, token, ...(label === undefined ? {} : { label }) })
        return {}
      },
    },
    ...(over?.noTodo === true ? {} : {
      todo: {
        createFromAgent: async (input: { title: string; description?: string; ddl?: string; tags?: string[] }) => {
          if (over?.todoThrows === true) throw new Error('创建失败')
          calls.todos.push(input as Record<string, unknown>)
          return { todoId: 'T-20260821-007' }
        },
      },
    }),
    sendIm: async (groupId, content) => {
      calls.sent.push({ groupId, content })
      return { ok: true as const, value: over?.sendValue ?? { msgId: 'm-42' } }
    },
  }
  return { deps, calls }
}

function inputOf(over?: Partial<ActionRunInput>): ActionRunInput {
  return {
    advanceId: 'A-1',
    actionKey: 'E-9:0',
    kind: 'todo',
    text: '确认会议模板排期',
    fields: { 截止: '2026-08-25', 负责人: '王剑' },
    ...over,
  }
}

/** An execution 事元 carrying the 动作序 mark (as the host would have written). */
function executedEntry(mark: string): unknown {
  return { entryId: 'E-run-1', changeType: '进度更新', summary: '执行建议动作：…', detail: mark, actor: 'user' }
}

describe('runAdvanceAction', () => {
  it('todo 路径三效应原子：建待办 → refs=todoId 执行事元 → 自动订阅 todo:<id>', async () => {
    const { deps, calls } = fakeDeps()
    const result = await runAdvanceAction(deps, inputOf())
    expect(result.idempotent).toBe(false)
    expect(result.effectRef).toBe('T-20260821-007')
    expect(calls.todos).toEqual([{ title: '确认会议模板排期', ddl: '2026-08-25', tags: ['王剑'] }])
    expect(calls.feeds).toHaveLength(1)
    expect(calls.feeds[0]).toMatchObject({
      advanceId: 'A-1',
      summary: '执行建议动作：建待办「确认会议模板排期」',
      sourceType: '人工',
      changeType: '进度更新',
      refs: ['T-20260821-007'],
      actor: 'user',
    })
    expect(String(calls.feeds[0]!['detail'])).toContain('动作序: E-9:0 | 种类: todo | 文本: 确认会议模板排期')
    expect(calls.sourceAdds).toEqual([{ advanceId: 'A-1', token: 'todo:T-20260821-007', label: '确认会议模板排期' }])
    expect(result.warnings).toEqual([])
  })

  it('im 路径：发消息 → refs=im:<groupId>:<msgId> 留痕', async () => {
    const { deps, calls } = fakeDeps()
    const result = await runAdvanceAction(deps, inputOf({ kind: 'im', text: '范围补充想跟你对齐一下', fields: {}, imGroupId: 'g1', imGroupLabel: '830 项目' }))
    expect(result.effectRef).toBe('im:g1:m-42')
    expect(calls.sent).toEqual([{ groupId: 'g1', content: '范围补充想跟你对齐一下' }])
    expect(calls.feeds[0]).toMatchObject({ sourceType: '对话', refs: ['im:g1:m-42'] })
    expect(calls.sourceAdds).toEqual([])
  })

  it('im 的 msgId 缺失：事元照落但 refs 缺指针 + warning 明示', async () => {
    const { deps, calls } = fakeDeps({ sendValue: {} })
    const result = await runAdvanceAction(deps, inputOf({ kind: 'im', text: 'x', fields: {}, imGroupId: 'g1' }))
    expect(result.effectRef).toBe('')
    expect(calls.feeds[0]).not.toHaveProperty('refs')
    expect(result.warnings[0]).toContain('msgId')
  })

  it('event 路径：只落留痕事元（无效应对象无 refs），不碰 todo/im', async () => {
    const { deps, calls } = fakeDeps()
    const result = await runAdvanceAction(deps, inputOf({ kind: 'event', text: '原型评审二次会', fields: { 主题: '原型评审二次会', 时间: '2026-08-22 14:00' } }))
    expect(result.effectRef).toBe('')
    expect(calls.todos).toEqual([])
    expect(calls.sent).toEqual([])
    expect(calls.feeds[0]).toMatchObject({ sourceType: '日程', changeType: '进度更新' })
    expect(calls.feeds[0]).not.toHaveProperty('refs')
  })

  it('幂等闸：同动作序已留痕 → 不重复执行、不重复落事元', async () => {
    const { deps, calls } = fakeDeps({ entries: [executedEntry('动作序: E-9:0 | 种类: todo | 文本: 确认会议模板排期')] })
    const result = await runAdvanceAction(deps, inputOf())
    expect(result.idempotent).toBe(true)
    expect(calls.todos).toEqual([])
    expect(calls.feeds).toEqual([])
    expect(calls.sourceAdds).toEqual([])
  })

  it('幂等闸兜底：综合卡重排后 key 变了，同 kind+文本仍幂等（决策 43）', async () => {
    const { deps, calls } = fakeDeps({ entries: [executedEntry('动作序: E-10:2 | 种类: todo | 文本: 确认会议模板排期')] })
    const result = await runAdvanceAction(deps, inputOf({ actionKey: 'E-11:0' }))
    expect(result.idempotent).toBe(true)
    expect(calls.todos).toEqual([])
  })

  it('效应失败不落事元：建待办抛错 → 整体失败、零 feed', async () => {
    const { deps, calls } = fakeDeps({ todoThrows: true })
    await expect(runAdvanceAction(deps, inputOf())).rejects.toThrow('创建失败')
    expect(calls.feeds).toEqual([])
    expect(calls.sourceAdds).toEqual([])
  })

  it('todo 服务缺失：明示报错（不静默降级）', async () => {
    const { deps } = fakeDeps({ noTodo: true })
    await expect(runAdvanceAction(deps, inputOf())).rejects.toThrow('yzjTodo')
  })

  it('订阅失败降级为 warning：事元与待办已成立，不回滚', async () => {
    const { deps, calls } = fakeDeps({ sourceAddThrows: true })
    const result = await runAdvanceAction(deps, inputOf())
    expect(result.idempotent).toBe(false)
    expect(calls.feeds).toHaveLength(1)
    expect(result.warnings[0]).toContain('自动订阅失败')
  })
})
