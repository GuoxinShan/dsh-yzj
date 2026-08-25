/**
 * todo tool family tests over the real local SQLite store (决策 54 单后端):
 * pure helpers plus the seven tools against a throwaway temp db — no fake
 * bridge scripts. The assignee-resolution path still scripts a bridge face.
 */
import { describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { applyTodoTools } from '../src/todo.ts'
import {
  normalizeTags, formatTags, parseAssignee, normalizeDdl, checkTransition,
  nextTodoId, appendLog, parseTodoRecord, todayStr, coreSetArchived, coreSetStatus, fetchTodoByTodoId,
} from '../src/todo.ts'
import type { YzjToolBudget } from '../src/shared.ts'
import { useFreshSqlite } from './sqlite-harness.ts'

useFreshSqlite()

const BUDGET: YzjToolBudget = { timeoutMs: 5_000, maxRenderChars: 5_000, maxMetaChars: 5_000 }

interface CapturedTool {
  name: string
  execute: (args: Record<string, unknown>) => Promise<{ content: string; truncated: boolean; data: unknown }>
}

function mount(): { tools: CapturedTool[] } {
  const tools: CapturedTool[] = []
  const ctx = { tools: { register(def: { name: string; execute: CapturedTool['execute'] }): void { tools.push({ name: def.name, execute: def.execute }) } } } as unknown as Context
  applyTodoTools(ctx, BUDGET, {})
  return { tools }
}

const run = async (tools: CapturedTool[], name: string, args: Record<string, unknown> = {}) => {
  const tool = tools.find(t => t.name === name)
  if (tool === undefined) throw new Error(`tool ${name} not registered`)
  return tool.execute(args)
}
const readBack = (todoId: string) => fetchTodoByTodoId(todoId)

describe('todo pure helpers', () => {
  it('normalizes tags from strings and arrays, deduping and stripping #', () => {
    expect(normalizeTags('#需求 #P0')).toEqual(['需求', 'P0'])
    expect(normalizeTags(['a', 'a', '#b'])).toEqual(['a', 'b'])
    expect(normalizeTags('前端，重构、上线')).toEqual(['前端', '重构', '上线'])
    expect(normalizeTags('  ')).toEqual([])
  })

  it('formats tags back to token form', () => {
    expect(formatTags(['需求', 'P0'])).toBe('#需求 #P0')
  })

  it('parses and normalizes assignee and ddl shapes', () => {
    expect(parseAssignee('测试用户(oid-test)')).toEqual({ name: '测试用户', openId: 'oid-test' })
    expect(parseAssignee('张三')).toEqual({ name: '张三', openId: '' })
    expect(normalizeDdl('2026-08-20')).toBe('2026/08/20')
    expect(normalizeDdl('2026/8/5')).toBe('2026/08/05')
  })

  it('enforces the six-state swimlane machine with an actionable message', () => {
    expect(checkTransition('backlog', 'todo')).toBeNull()
    expect(checkTransition('todo', 'in_progress')).toBeNull()
    expect(checkTransition('in_progress', 'in_review')).toBeNull()
    expect(checkTransition('in_review', 'done')).toBeNull()
    expect(checkTransition('todo', 'backlog')).toBeNull()
    expect(checkTransition('in_progress', 'todo')).toBeNull()
    expect(checkTransition('in_review', 'in_progress')).toBeNull()
    expect(checkTransition('backlog', 'cancelled')).toBeNull()
    expect(checkTransition('done', 'in_progress')).toBeNull()
    expect(checkTransition('cancelled', 'todo')).toBeNull()
    expect(checkTransition('backlog', 'done')).toMatch(/yzj_todo_complete/)
    expect(checkTransition('done', 'todo')).toMatch(/状态机拒绝/)
    expect(checkTransition('todo', 'done')).toMatch(/状态机拒绝/)
  })

  it('sequences ids per day and appends log lines', () => {
    const today = todayStr().replace(/\//g, '')
    expect(nextTodoId([`T-${today}-003`, 'T-20200101-001'])).toBe(`T-${today}-004`)
    expect(nextTodoId(['T-20200101-009'])).toBe(`T-${today}-001`)
    expect(appendLog('', 'first')).toBe('first')
    expect(appendLog('first', 'second')).toBe('first\nsecond')
  })

  it('parses a fields bag and flags overdue; an unknown status folds into todo', () => {
    const todo = parseTodoRecord({
      id: 'c',
      fields: {
        todo_id: 'T-20260815-001', 标题: '验证', 状态: 'garbage',
        负责人: '测试用户(oid-test)', DDL: '2026/01/01',
        标签: '#需求 #P0', 推进日志: 'line',
      },
    }, '2026/08/15')
    expect(todo?.todoId).toBe('T-20260815-001')
    expect(todo?.status).toBe('todo')
    expect(todo?.tags).toEqual(['需求', 'P0'])
    expect(todo?.assigneeOpenId).toBe('oid-test')
    expect(todo?.overdue).toBe(true)
    expect(parseTodoRecord({ id: 'x', fields: '{}' })).toBeNull()
  })
})

describe('yzj_todo_list', () => {
  it('lists open todos sorted by DDL; overdue filter; archived excluded (S10)', async () => {
    const { tools } = mount()
    await run(tools, 'yzj_todo_create', { title: '后做的', tags: ['b'], ddl: '2099/01/01' })
    await run(tools, 'yzj_todo_create', { title: '先做的', tags: ['a', '前端'], ddl: '2099/06/01' })
    await run(tools, 'yzj_todo_create', { title: '过期的', ddl: '2020/01/01' })
    const done = await run(tools, 'yzj_todo_create', { title: '已完成的' })
    await run(tools, 'yzj_todo_complete', { todoId: (done.data as { todoId: string }).todoId })
    const archived = await run(tools, 'yzj_todo_create', { title: '已归档的' })
    await coreSetArchived({} as Context, BUDGET, {}, {}, (archived.data as { todoId: string }).todoId, true)

    const list = await run(tools, 'yzj_todo_list', {})
    expect(list.content).toContain('先做的')
    expect(list.content).toContain('后做的')
    expect(list.content).toContain('过期的')
    expect(list.content).not.toContain('已完成的')
    expect(list.content).not.toContain('已归档的')

    const overdue = await run(tools, 'yzj_todo_list', { status: 'overdue' })
    expect(overdue.content).toContain('过期的')
    expect(overdue.content).not.toContain('先做的')

    const byTag = await run(tools, 'yzj_todo_list', { tag: '前端' })
    expect(byTag.content).toContain('先做的')
    expect(byTag.content).not.toContain('后做的')

    const all = await run(tools, 'yzj_todo_list', { status: 'all' })
    expect(all.content).not.toContain('已归档的')
  })
})

describe('yzj_todo_create / claim 族 / complete / archive', () => {
  it('agent create lands backlog (S6) with tags/ddl/description and a log line', async () => {
    const { tools } = mount()
    const result = await run(tools, 'yzj_todo_create', { title: '梳理迁移文档', description: '提示词本体', tags: ['迁移', 'P0'], ddl: '2026-08-20' })
    expect(result.content).toContain('created 待办')
    expect(result.content).toContain('落「待我决定」')
    const todoId = (result.data as { todoId: string }).todoId
    expect(todoId).toMatch(/^T-\d{8}-\d{3}$/)
    const todo = readBack(todoId)
    expect(todo?.status).toBe('backlog')
    expect(todo?.tags).toEqual(['迁移', 'P0'])
    expect(todo?.description).toBe('提示词本体')
    expect(todo?.log).toContain('创建')
  })

  it('claim rejects backlog (批准闸) and double claims; version bumps per transition', async () => {
    const { tools } = mount()
    const created = await run(tools, 'yzj_todo_create', { title: '任务一', description: '提示词本体' })
    const todoId = (created.data as { todoId: string }).todoId

    const early = await run(tools, 'yzj_todo_claim', { todoId })
    expect(early.content).toContain('待我决定')

    await coreSetStatus({} as Context, BUDGET, {}, {}, todoId, 'todo', { verb: '批准' })
    const claimed = await run(tools, 'yzj_todo_claim', { todoId })
    expect(claimed.content).toContain('claimed 待办')
    expect(claimed.content).toContain('提示词本体')
    expect(readBack(todoId)?.version).toBe(2)

    const again = await run(tools, 'yzj_todo_claim', { todoId })
    expect(again.content).toContain('只有「可认领」状态能认领')
  })

  it('submit_review stores the note; release clears the claim (S8 阻塞是备注)', async () => {
    const { tools } = mount()
    const created = await run(tools, 'yzj_todo_create', { title: '任务一' })
    const todoId = (created.data as { todoId: string }).todoId
    await coreSetStatus({} as Context, BUDGET, {}, {}, todoId, 'todo', { verb: '批准' })
    await run(tools, 'yzj_todo_claim', { todoId })

    const empty = await run(tools, 'yzj_todo_submit_review', { todoId, note: '  ' })
    expect(empty.content).toContain('交卷必须带结果说明')

    const submitted = await run(tools, 'yzj_todo_submit_review', { todoId, note: '已上线并回归', refs: ['yzj:doc:abc'] })
    expect(submitted.content).toContain('交卷待验收')
    expect(readBack(todoId)?.reviewNote).toContain('已上线并回归')

    // 打回进行中再释放（release 只从 in_progress）
    await coreSetStatus({} as Context, BUDGET, {}, {}, todoId, 'in_progress', { verb: '打回', note: '再改改' })
    const released = await run(tools, 'yzj_todo_release_claim', { todoId, note: '阻塞：等上游接口' })
    expect(released.content).toContain('released 待办')
    expect(readBack(todoId)?.claimedBy).toBe('')
    expect(readBack(todoId)?.status).toBe('todo')
  })

  it('update edits description (S7); no status parameter (状态只走合法边)', async () => {
    const { tools } = mount()
    const created = await run(tools, 'yzj_todo_create', { title: '任务一' })
    const todoId = (created.data as { todoId: string }).todoId
    const result = await run(tools, 'yzj_todo_update', { todoId, description: '新提示词', appendLog: '调整' })
    expect(result.content).toContain('updated 待办')
    expect(readBack(todoId)?.description).toBe('新提示词')
    expect(readBack(todoId)?.log).toContain('描述已更新')
  })

  it('completes from any state and is idempotent once done', async () => {
    const { tools } = mount()
    const created = await run(tools, 'yzj_todo_create', { title: '任务一' })
    const todoId = (created.data as { todoId: string }).todoId
    const result = await run(tools, 'yzj_todo_complete', { todoId, note: '先交付再收尾' })
    expect(result.content).toContain('completed 待办')
    const again = await run(tools, 'yzj_todo_complete', { todoId })
    expect(again.content).toContain('幂等命中')
  })

  it('归档/恢复：不动状态不增版本，日志留痕（S10）', async () => {
    const { tools } = mount()
    const created = await run(tools, 'yzj_todo_create', { title: '任务一' })
    const todoId = (created.data as { todoId: string }).todoId
    await run(tools, 'yzj_todo_complete', { todoId })
    const versionBefore = readBack(todoId)?.version
    const archived = await coreSetArchived({} as Context, BUDGET, {}, {}, todoId, true)
    expect(archived.todo.archived).toBe(true)
    expect(archived.todo.status).toBe('done')
    expect(archived.todo.version).toBe(versionBefore)
    expect(archived.todo.log).toContain('归档')
    const back = await coreSetArchived({} as Context, BUDGET, {}, {}, todoId, false)
    expect(back.todo.archived).toBe(false)
    expect(back.todo.log).toContain('恢复')
  })

  it('refuses unknown todo ids without guessing', async () => {
    const { tools } = mount()
    await expect(run(tools, 'yzj_todo_update', { todoId: 'T-404', appendLog: 'x' })).rejects.toThrow(/不存在/)
    const miss = await run(tools, 'yzj_todo_claim', { todoId: 'T-404' })
    expect(miss.content).toContain('不存在')
  })
})
