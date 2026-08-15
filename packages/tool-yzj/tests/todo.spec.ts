/**
 * todo tool family tests: pure helpers (tags/state machine/id/log) plus the
 * four tools over a scripted fake bridge — no real yzj-cli needed. The
 * scripts replay the CLI shapes verified by the 2026-08-15 probe: records
 * arrays for create/update, `fields` as a JSON string, `page_token` paging.
 */
import { describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import type { YzjRunResult } from '@dsh-yzj/bridge'
import { applyTodoTools } from '../src/todo.ts'
import {
  normalizeTags, formatTags, parseAssignee, normalizeDdl, checkTransition,
  nextTodoId, appendLog, parseTodoRecord, todayStr,
} from '../src/todo.ts'
import type { YzjToolBudget } from '../src/shared.ts'

const BUDGET: YzjToolBudget = { timeoutMs: 5_000, maxRenderChars: 5_000, maxMetaChars: 5_000 }

interface CapturedTool {
  name: string
  execute: (args: Record<string, unknown>) => Promise<{ content: string; truncated: boolean; data: unknown }>
}

/** Bridge run calls captured for assertions. */
interface FakeBridge {
  ctx: Context
  calls: string[][]
}

/** Build a fake ctx whose yzjBridge.run resolves from a command script. */
function mount(script: (command: string[]) => unknown, holder?: { override?: { docId: string; tableId: number; link: string } }): { tools: CapturedTool[]; bridge: FakeBridge } {
  const tools: CapturedTool[] = []
  const calls: string[][] = []
  const ctx = {
    tools: {
      register(def: { name: string; execute: CapturedTool['execute'] }): void {
        tools.push({ name: def.name, execute: def.execute })
      },
    },
    yzjBridge: {
      async run(command: string[]): Promise<YzjRunResult> {
        calls.push(command)
        const json = script(command)
        if (json instanceof Error) {
          return { ok: false, exitCode: 1, timedOut: false, stdout: '', stderr: json.message, json: undefined }
        }
        return { ok: true, exitCode: 0, timedOut: false, stdout: '', stderr: '', json }
      },
    },
  } as unknown as Context
  applyTodoTools(ctx, BUDGET, {}, holder)
  return { tools, bridge: { ctx, calls } }
}

const ok = (json: unknown) => json

// A resolved library as the CLI presents it: workspace → doc → sheet get.
function resolvedLibraryScript(extra: Record<string, (command: string[]) => unknown> = {}): (command: string[]) => unknown {
  return (command) => {
    const key = command.slice(0, 2).join(' ')
    if (key === 'doc workspace') {
      return ok({ list: [{ id: 'ws1', name: '我的知识', type: '个人' }] })
    }
    if (key === 'doc list') {
      return ok({ list: [{ id: 'doc1', title: '待办任务库', fileSuffix: 'dbt' }] })
    }
    if (key === 'sheet get') {
      return ok({ sheets: [{ id: 4, name: '任务', fields: [{ name: 'todo_id' }, { name: '标题' }] }] })
    }
    const extraHit = extra[key]
    if (extraHit !== undefined) return extraHit(command)
    throw new Error(`unexpected command ${command.join(' ')}`)
  }
}

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
    expect(parseAssignee('单国鑫(64a7e43ae4b07742af0af59d)')).toEqual({ name: '单国鑫', openId: '64a7e43ae4b07742af0af59d' })
    expect(parseAssignee('张三')).toEqual({ name: '张三', openId: '' })
    expect(normalizeDdl('2026-08-20')).toBe('2026/08/20')
    expect(normalizeDdl('2026/8/5')).toBe('2026/08/05')
  })

  it('enforces the state machine with an actionable message', () => {
    expect(checkTransition('pending', 'in_progress')).toBeNull()
    expect(checkTransition('in_progress', 'done')).toBeNull()
    expect(checkTransition('done', 'in_progress')).toBeNull()
    expect(checkTransition('in_progress', 'pending')).toBeNull()
    expect(checkTransition('pending', 'done')).toMatch(/yzj_todo_complete/)
    expect(checkTransition('done', 'pending')).toMatch(/状态机拒绝/)
  })

  it('sequences ids per day and appends log lines', () => {
    expect(nextTodoId(['T-20260815-003', 'T-20260814-001'])).toBe('T-20260815-004')
    expect(appendLog('', 'first')).toBe('first')
    expect(appendLog('first', 'second')).toBe('first\nsecond')
  })

  it('parses a CLI record with JSON-string fields and flags overdue', () => {
    const todo = parseTodoRecord({
      id: 'c',
      fields: JSON.stringify({
        todo_id: 'T-20260815-001', 标题: '验证', 状态: 'pending',
        负责人: '单国鑫(64a7e43ae4b07742af0af59d)', DDL: '2026/01/01',
        标签: '#需求 #P0', 推进日志: 'line',
      }),
    }, '2026/08/15')
    expect(todo?.todoId).toBe('T-20260815-001')
    expect(todo?.tags).toEqual(['需求', 'P0'])
    expect(todo?.assigneeOpenId).toBe('64a7e43ae4b07742af0af59d')
    expect(todo?.overdue).toBe(true)
    expect(parseTodoRecord({ id: 'x', fields: '{}' })).toBeNull()
  })
})

describe('yzj_todo_list', () => {
  it('lists open todos parsed from JSON-string fields, sorted by DDL', async () => {
    const { tools } = mount(resolvedLibraryScript({
      'sheet record': () => ok({
        page_token: '',
        records: [
          { id: 'a', fields: JSON.stringify({ todo_id: 'T-1', 标题: '后做的', 状态: 'pending', DDL: '2026/09/01', 标签: '#b' }) },
          { id: 'b', fields: JSON.stringify({ todo_id: 'T-2', 标题: '先做的', 状态: 'in_progress', DDL: '2026/08/20', 标签: '#a #前端' }) },
          { id: 'c', fields: JSON.stringify({ todo_id: 'T-3', 标题: '已完成的', 状态: 'done', DDL: '2026/08/01' }) },
          { id: 'd', fields: JSON.stringify({ todo_id: 'T-4', 标题: '过期的', 状态: 'pending', DDL: '2026/01/01' }) },
        ],
      }),
    }))
    const list = tools.find(tool => tool.name === 'yzj_todo_list')!
    const result = await list.execute({})
    expect(result.content).toContain('先做的')
    expect(result.content).toContain('后做的')
    expect(result.content).toContain('过期')
    expect(result.content).not.toContain('已完成的')
    expect(result.content.indexOf('先做的')).toBeLessThan(result.content.indexOf('后做的'))
    expect(result.content.indexOf('T-4')).toBeGreaterThanOrEqual(0)

    const overdue = await list.execute({ status: 'overdue' })
    expect(overdue.content).toContain('过期的')
    expect(overdue.content).not.toContain('先做的')

    const byTag = await list.execute({ tag: '前端' })
    expect(byTag.content).toContain('先做的')
    expect(byTag.content).not.toContain('后做的')
  })
})

describe('yzj_todo_create', () => {
  it('auto-provisions the library and writes an array-form record with tags and log', async () => {
    const { tools, bridge } = mount((command) => {
      const key = command.slice(0, 2).join(' ')
      if (key === 'doc workspace') return ok({ list: [{ id: 'ws1', name: '我的知识' }] })
      if (key === 'doc list') return ok({ list: [] })
      if (key === 'sheet create') return ok({ id: 'docNew', title: '待办任务库' })
      if (key === 'sheet table') return ok({ sheet: { id: 9, fields: [] } })
      if (key === 'sheet get') return ok({ sheets: [{ id: 9, name: '任务', fields: [{ name: 'todo_id' }] }] })
      if (key === 'sheet record' && command[2] === 'list') return ok({ page_token: '', records: [] })
      if (key === 'sheet record') return ok({ records: [{ id: 'r1', fields: '{}' }] })
      throw new Error(`unexpected ${command.join(' ')}`)
    })
    const create = tools.find(tool => tool.name === 'yzj_todo_create')!
    const result = await create.execute({ title: '梳理迁移文档', tags: ['迁移', '#P0'], ddl: '2026-08-20', priority: 'P0' })
    expect(result.content).toContain('created 待办')
    expect(result.content).toContain('#迁移 #P0')
    const writeCall = bridge.calls.find(call => call.join(' ').startsWith('sheet record create'))
    expect(writeCall).toBeDefined()
    const records = JSON.parse(writeCall![writeCall!.length - 1]) as Array<{ fieldsValue: Record<string, unknown> }>
    expect(Array.isArray(records)).toBe(true)
    expect(records[0]!.fieldsValue['标签']).toBe('#迁移 #P0')
    expect(records[0]!.fieldsValue['DDL']).toBe('2026/08/20')
    expect(String(records[0]!.fieldsValue['推进日志'])).toContain('创建')
    expect(records[0]!.fieldsValue['todo_id']).toMatch(/^T-\d{8}-001$/)
  })

  it('scans every personal workspace before provisioning — a library in the second workspace is found, not duplicated', async () => {
    let provisioned = false
    const { tools, bridge } = mount((command) => {
      const key = command.slice(0, 2).join(' ')
      if (key === 'doc workspace') {
        return ok({ list: [{ id: 'wsA', name: 'AI速记知识库' }, { id: 'wsB', name: '我的知识' }] })
      }
      if (key === 'doc list') {
        // wsA has no library; wsB has one with a usable 任务 table.
        return command.includes('wsA')
          ? ok({ list: [{ id: 'other', title: '速记', fileSuffix: 'otl' }] })
          : ok({ list: [{ id: 'docB', title: '待办任务库', fileSuffix: 'dbt' }] })
      }
      if (key === 'sheet get') {
        return command.includes('docB')
          ? ok({ sheets: [{ id: 2, name: '任务', fields: [{ name: 'todo_id' }] }] })
          : new Error('sheet get on unexpected doc')
      }
      if (key === 'sheet create') { provisioned = true; return new Error('must not provision') }
      if (key === 'sheet record' && command[2] === 'list') return ok({ page_token: '', records: [] })
      if (key === 'sheet record') return ok({ records: [{ id: 'r1', fields: '{}' }] })
      throw new Error(`unexpected ${command.join(' ')}`)
    })
    const create = tools.find(tool => tool.name === 'yzj_todo_create')!
    const result = await create.execute({ title: '复用既有库' })
    expect(result.content).toContain('created 待办')
    expect(provisioned).toBe(false)
    const writeCall = bridge.calls.find(call => call.join(' ').startsWith('sheet record create'))
    expect(writeCall!.includes('docB')).toBe(true)
    expect(writeCall!.includes('wsA')).toBe(false)
  })

  it('returns the existing todo on an idempotent hit', async () => {
    const { tools } = mount(resolvedLibraryScript({
      'sheet record': (command) => {
        if (command[2] === 'list') {
          return ok({ records: [{ id: 'r9', fields: JSON.stringify({ todo_id: 'T-20260815-001', 标题: '已有的', 状态: 'pending' }) }] })
        }
        return ok({ records: [] })
      },
    }))
    const create = tools.find(tool => tool.name === 'yzj_todo_create')!
    const result = await create.execute({ title: '重复创建', todoId: 'T-20260815-001' })
    expect(result.content).toContain('幂等命中')
  })
})

describe('yzj_todo_update / complete', () => {
  function mountedWithTodo(startStatus: string) {
    let status = startStatus
    return mount(resolvedLibraryScript({
      'sheet record': (command) => {
        if (command[2] === 'list') {
          return ok({ records: [{ id: 'r5', fields: JSON.stringify({ todo_id: 'T-1', 标题: '任务一', 状态: status, 推进日志: '2026/08/15 09:00 创建' }) }] })
        }
        // update: replay the new status into the scripted state
        const records = JSON.parse(command[command.length - 1]) as Array<{ fieldsValue: Record<string, unknown> }>
        const next = records[0]?.fieldsValue['状态']
        if (typeof next === 'string') status = next
        return ok({ records: [{ id: 'r5', fields: '{}' }] })
      },
    }))
  }

  it('rejects pending→done and points at yzj_todo_complete', async () => {
    const { tools } = mountedWithTodo('pending')
    const update = tools.find(tool => tool.name === 'yzj_todo_update')!
    await expect(update.execute({ todoId: 'T-1', status: 'done' })).rejects.toThrow(/yzj_todo_complete/)
  })

  it('applies in_progress→done with a host-appended log line', async () => {
    const { tools, bridge } = mountedWithTodo('in_progress')
    const update = tools.find(tool => tool.name === 'yzj_todo_update')!
    const result = await update.execute({ todoId: 'T-1', status: 'done', appendLog: '联调通过' })
    expect(result.content).toContain('updated 待办')
    const writeCall = bridge.calls.find(call => call.join(' ').startsWith('sheet record update'))
    const records = JSON.parse(writeCall![writeCall!.length - 1]) as Array<{ id: string; fieldsValue: Record<string, unknown> }>
    expect(records[0]!.id).toBe('r5')
    expect(records[0]!.fieldsValue['状态']).toBe('done')
    expect(String(records[0]!.fieldsValue['推进日志'])).toContain('状态 in_progress→done')
    expect(String(records[0]!.fieldsValue['推进日志'])).toContain('备注 联调通过')
    expect(String(records[0]!.fieldsValue['推进日志'])).toContain('2026/08/15 09:00 创建')
  })

  it('completes from any state and is idempotent once done', async () => {
    const { tools } = mountedWithTodo('pending')
    const complete = tools.find(tool => tool.name === 'yzj_todo_complete')!
    const result = await complete.execute({ todoId: 'T-1', note: '先交付再收尾' })
    expect(result.content).toContain('completed 待办')

    const again = await complete.execute({ todoId: 'T-1' })
    expect(again.content).toContain('幂等命中')
  })

  it('refuses unknown todo ids without guessing', async () => {
    const { tools } = mount(resolvedLibraryScript({
      'sheet record': () => ok({ records: [] }),
    }))
    const update = tools.find(tool => tool.name === 'yzj_todo_update')!
    await expect(update.execute({ todoId: 'T-404', status: 'in_progress' })).rejects.toThrow(/不存在/)
  })
})

describe('sheet record digest regression (T0)', () => {
  it('todayStr is slash-formatted for overdue comparison', () => {
    expect(todayStr(new Date(2026, 7, 15))).toBe('2026/08/15')
  })
})

describe('team libraries (active-binding override)', () => {
  /** Script: personal ws has docP; team ws (wsT) has docT; both carry a
   *  todo_id table. `sheet get` distinguishes docs by the --id argument. */
  function teamScript() {
    return (command: string[]) => {
      const key = command.slice(0, 2).join(' ')
      const idArg = command[command.indexOf('--id') + 1] ?? ''
      if (key === 'doc workspace') {
        return command.includes('enterprise')
          ? ok({ list: [{ id: 'wsT', name: '六大场景内测', permissionLevel: 2 }] })
          : ok({ list: [{ id: 'wsP', name: '我的知识' }] })
      }
      if (key === 'doc list') {
        return command.includes('wsT')
          ? ok([{ id: 'docT', title: '待办任务库', fileSuffix: 'dbt' }])
          : ok([{ id: 'docP', title: '待办任务库', fileSuffix: 'dbt' }])
      }
      if (key === 'sheet get') {
        const tableId = idArg === 'docT' ? 7 : 4
        return ok({ sheets: [{ id: tableId, name: '任务', fields: [{ name: 'todo_id' }] }] })
      }
      if (key === 'sheet record' && command[2] === 'list') return ok({ page_token: '', records: [] })
      if (key === 'sheet record') return ok({ records: [{ id: 'r1', fields: '{}' }] })
      throw new Error(`unexpected ${command.join(' ')}`)
    }
  }

  it('the holder override wins over personal discovery and routes writes to the team library', async () => {
    const holder: { override?: { docId: string; tableId: number; link: string } } = {}
    const { tools, bridge } = mount(teamScript(), holder)
    holder.override = { docId: 'docT', tableId: 7, link: 'https://example/docT' }
    const create = tools.find(tool => tool.name === 'yzj_todo_create')!
    const result = await create.execute({ title: '团队任务' })
    expect(result.content).toContain('created 待办')
    const writeCall = bridge.calls.find(call => call.join(' ').startsWith('sheet record create'))
    expect(writeCall!.includes('docT')).toBe(true)
    expect(writeCall!.includes('7')).toBe(true)
    expect(writeCall!.includes('docP')).toBe(false)
  })

  it('a stale override is cleared and resolution falls back to discovery', async () => {
    const holder: { override?: { docId: string; tableId: number; link: string } } = {}
    const script = (command: string[]) => {
      const key = command.slice(0, 2).join(' ')
      const idArg = command[command.indexOf('--id') + 1] ?? ''
      if (key === 'doc workspace') return ok({ list: [{ id: 'wsP', name: '我的知识' }] })
      if (key === 'doc list') return ok([{ id: 'docP', title: '待办任务库', fileSuffix: 'dbt' }])
      if (key === 'sheet get') {
        // docT (the stale override) answers with no todo_id table.
        if (idArg === 'docT') return ok({ sheets: [{ id: 9, name: '别的表', fields: [{ name: '名称' }] }] })
        return ok({ sheets: [{ id: 4, name: '任务', fields: [{ name: 'todo_id' }] }] })
      }
      if (key === 'sheet record' && command[2] === 'list') return ok({ page_token: '', records: [] })
      if (key === 'sheet record') return ok({ records: [{ id: 'r1', fields: '{}' }] })
      throw new Error(`unexpected ${command.join(' ')}`)
    }
    const { tools, bridge } = mount(script, holder)
    holder.override = { docId: 'docT', tableId: 9, link: 'https://example/docT' }
    const create = tools.find(tool => tool.name === 'yzj_todo_create')!
    const result = await create.execute({ title: '降级' })
    expect(result.content).toContain('created 待办')
    expect(holder.override).toBeUndefined()
    const writeCall = bridge.calls.find(call => call.join(' ').startsWith('sheet record create'))
    expect(writeCall!.includes('docP')).toBe(true)
  })
})
