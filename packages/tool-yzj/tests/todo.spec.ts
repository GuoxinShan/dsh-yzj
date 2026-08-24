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
    expect(parseAssignee('测试用户(oid-test)')).toEqual({ name: '测试用户', openId: 'oid-test' })
    expect(parseAssignee('张三')).toEqual({ name: '张三', openId: '' })
    expect(normalizeDdl('2026-08-20')).toBe('2026/08/20')
    expect(normalizeDdl('2026/8/5')).toBe('2026/08/05')
  })

  it('enforces the six-state swimlane machine with an actionable message', () => {
    // 主流：backlog→todo→in_progress→in_review→done
    expect(checkTransition('backlog', 'todo')).toBeNull()
    expect(checkTransition('todo', 'in_progress')).toBeNull()
    expect(checkTransition('in_progress', 'in_review')).toBeNull()
    expect(checkTransition('in_review', 'done')).toBeNull()
    // 打回/释放（反向边）
    expect(checkTransition('todo', 'backlog')).toBeNull()
    expect(checkTransition('in_progress', 'todo')).toBeNull()
    expect(checkTransition('in_review', 'in_progress')).toBeNull()
    // 终局与重开
    expect(checkTransition('backlog', 'cancelled')).toBeNull()
    expect(checkTransition('done', 'in_progress')).toBeNull()
    expect(checkTransition('cancelled', 'todo')).toBeNull()
    // 非法跳变
    expect(checkTransition('backlog', 'done')).toMatch(/yzj_todo_complete/)
    expect(checkTransition('done', 'todo')).toMatch(/状态机拒绝/)
    expect(checkTransition('todo', 'done')).toMatch(/状态机拒绝/)
    // S5：legacy pending 读取归一为 todo
    expect(checkTransition('pending', 'in_progress')).toBeNull()
  })

  it('sequences ids per day and appends log lines', () => {
    const today = todayStr().replace(/\//g, '')
    expect(nextTodoId([`T-${today}-003`, 'T-20200101-001'])).toBe(`T-${today}-004`)
    expect(nextTodoId(['T-20200101-009'])).toBe(`T-${today}-001`)
    expect(appendLog('', 'first')).toBe('first')
    expect(appendLog('first', 'second')).toBe('first\nsecond')
  })

  it('parses a CLI record with JSON-string fields and flags overdue', () => {
    const todo = parseTodoRecord({
      id: 'c',
      fields: JSON.stringify({
        todo_id: 'T-20260815-001', 标题: '验证', 状态: 'pending',
        负责人: '测试用户(oid-test)', DDL: '2026/01/01',
        标签: '#需求 #P0', 推进日志: 'line',
      }),
    }, '2026/08/15')
    expect(todo?.todoId).toBe('T-20260815-001')
    // S5：存量 pending 归一为可认领（todo）
    expect(todo?.status).toBe('todo')
    expect(todo?.tags).toEqual(['需求', 'P0'])
    expect(todo?.assigneeOpenId).toBe('oid-test')
    expect(todo?.overdue).toBe(true)
    expect(parseTodoRecord({ id: 'x', fields: '{}' })).toBeNull()
  })
})

describe('yzj_todo_list', () => {
  it('lists open todos parsed from JSON-string fields, sorted by DDL', async () => {
    // DDL 用相对日期(fixme 日期炸弹:硬编码 DDL 会随真实日期过期变 overdue)。
    const day = (offset: number): string => {
      const d = new Date(Date.now() + offset * 86_400_000)
      const pad = (n: number): string => String(n).padStart(2, '0')
      return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`
    }
    const { tools } = mount(resolvedLibraryScript({
      'sheet record': () => ok({
        page_token: '',
        records: [
          { id: 'a', fields: JSON.stringify({ todo_id: 'T-1', 标题: '后做的', 状态: 'pending', DDL: day(30), 标签: '#b' }) },
          { id: 'b', fields: JSON.stringify({ todo_id: 'T-2', 标题: '先做的', 状态: 'in_progress', DDL: day(7), 标签: '#a #前端' }) },
          { id: 'c', fields: JSON.stringify({ todo_id: 'T-3', 标题: '已完成的', 状态: 'done', DDL: day(-20) }) },
          { id: 'd', fields: JSON.stringify({ todo_id: 'T-4', 标题: '过期的', 状态: 'pending', DDL: day(-30) }) },
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
    // S6：agent 建的落 backlog（待我决定），人批准后才可认领
    expect(records[0]!.fieldsValue['状态']).toBe('backlog')
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

describe('yzj_todo_update / complete / claim 族', () => {
  function mountedWithTodo(startStatus: string) {
    let status = startStatus
    const bridgeState = { claimedBy: '', version: 0, review: '' }
    const mounted = mount(resolvedLibraryScript({
      'sheet record': (command) => {
        if (command[2] === 'list') {
          return ok({ records: [{ id: 'r5', fields: JSON.stringify({ todo_id: 'T-1', 标题: '任务一', 状态: status, 推进日志: '2026/08/15 09:00 创建', 认领会话: bridgeState.claimedBy, 版本: bridgeState.version, 验收说明: bridgeState.review }) }] })
        }
        // update: replay the written fields into the scripted state
        const records = JSON.parse(command[command.length - 1]) as Array<{ fieldsValue: Record<string, unknown> }>
        const fields = records[0]?.fieldsValue ?? {}
        if (typeof fields['状态'] === 'string') status = fields['状态']
        if (typeof fields['认领会话'] === 'string') bridgeState.claimedBy = fields['认领会话']
        if (typeof fields['版本'] === 'number') bridgeState.version = fields['版本']
        if (typeof fields['验收说明'] === 'string') bridgeState.review = fields['验收说明']
        return ok({ records: [{ id: 'r5', fields: '{}' }] })
      },
    }))
    return { ...mounted, bridgeState }
  }

  it('update 不再有 status 参数（状态只走合法边）；描述可编辑（S7）', async () => {
    const { tools, bridge } = mountedWithTodo('todo')
    const update = tools.find(tool => tool.name === 'yzj_todo_update')!
    const result = await update.execute({ todoId: 'T-1', description: '提示词本体：做完 X 并验证 Y' })
    expect(result.content).toContain('updated 待办')
    const writeCall = bridge.calls.find(call => call.join(' ').startsWith('sheet record update'))
    const records = JSON.parse(writeCall![writeCall!.length - 1]) as Array<{ fieldsValue: Record<string, unknown> }>
    expect(records[0]!.fieldsValue['描述']).toBe('提示词本体：做完 X 并验证 Y')
  })

  it('claim：todo→in_progress，排他（重复认领被拒），版本递增', async () => {
    const { tools, bridge, bridgeState } = mountedWithTodo('todo')
    const claim = tools.find(tool => tool.name === 'yzj_todo_claim')!
    const result = await claim.execute({ todoId: 'T-1' })
    expect(result.content).toContain('claimed 待办')
    const writeCall = bridge.calls.find(call => call.join(' ').startsWith('sheet record update'))
    const records = JSON.parse(writeCall![writeCall!.length - 1]) as Array<{ fieldsValue: Record<string, unknown> }>
    expect(records[0]!.fieldsValue['状态']).toBe('in_progress')
    expect(records[0]!.fieldsValue['版本']).toBe(1)
    // 排他：已在进行中 → 第二次认领被拒
    const again = await claim.execute({ todoId: 'T-1' })
    expect(again.content).toContain('只有「可认领」状态能认领')
    expect(bridgeState.claimedBy).toBe('')
  })

  it('claim 拦截未批准的 backlog（人批准闸，S6）', async () => {
    const { tools } = mountedWithTodo('backlog')
    const claim = tools.find(tool => tool.name === 'yzj_todo_claim')!
    const result = await claim.execute({ todoId: 'T-1' })
    expect(result.content).toContain('待我决定')
    expect(result.content).toContain('批准')
  })

  it('submit_review：in_progress→in_review，验收说明落库；空说明被拒', async () => {
    const { tools, bridgeState } = mountedWithTodo('in_progress')
    const submit = tools.find(tool => tool.name === 'yzj_todo_submit_review')!
    const empty = await submit.execute({ todoId: 'T-1', note: '  ' })
    expect(empty.content).toContain('交卷必须带结果说明')
    const result = await submit.execute({ todoId: 'T-1', note: '已上线并回归', refs: ['yzj:doc:abc'] })
    expect(result.content).toContain('交卷待验收')
    expect(bridgeState.review).toContain('已上线并回归')
    expect(bridgeState.review).toContain('yzj:doc:abc')
  })

  it('release_claim：in_progress→todo，认领清空（阻塞是备注不是状态，S8）', async () => {
    const { tools, bridgeState } = mountedWithTodo('in_progress')
    const release = tools.find(tool => tool.name === 'yzj_todo_release_claim')!
    const result = await release.execute({ todoId: 'T-1', note: '阻塞：等上游接口' })
    expect(result.content).toContain('released 待办')
    expect(result.content).toContain('阻塞：等上游接口')
    expect(bridgeState.claimedBy).toBe('')
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
    await expect(update.execute({ todoId: 'T-404', appendLog: 'x' })).rejects.toThrow(/不存在/)
    const claim = tools.find(tool => tool.name === 'yzj_todo_claim')!
    const miss = await claim.execute({ todoId: 'T-404' })
    expect(miss.content).toContain('不存在')
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
