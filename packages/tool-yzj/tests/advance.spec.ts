/**
 * advance (AI推进) tool-family tests: pure helpers (stage machine / ids /
 * tones / metrics / sources) plus the four tools and the core operations over
 * a STATEFUL fake bridge — feed→get roundtrips prove the append-only stream
 * is lossless (hard requirement ②). The fake replays the CLI shapes verified
 * by the 2026-08-15 probe: records arrays, `fields` as a JSON string,
 * Equals/Contains filters.
 */
import { describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import type { YzjRunResult } from '@dsh-yzj/bridge'
import {
  applyAdvanceTools, coreCreateAdvance, coreFeedAdvance, judgeVerb,
  checkStageTransition, nextSequentialId, toneOf, parseMetrics,
  parseAdvanceItem, parseAdvanceEntry, aggregateSources,
} from '../src/advance.ts'
import type { AdvanceCaches, YzjAdvanceEntry } from '../src/advance.ts'
import { todayStr } from '../src/todo.ts'
import type { YzjToolBudget } from '../src/shared.ts'

const BUDGET: YzjToolBudget = { timeoutMs: 5_000, maxRenderChars: 8_000, maxMetaChars: 8_000 }

interface CapturedTool {
  name: string
  execute: (args: Record<string, unknown>) => Promise<{ content: string; truncated: boolean; data: unknown }>
}

interface Row { id: string; fields: Record<string, unknown> }

/**
 * Stateful fake backend: one dbt doc with the todo 任务 table plus (optionally
 * pre-provisioned) 事项/事元 tables. Record create/update/list mutate real
 * in-memory rows so multi-step flows behave like the real CLI.
 */
class FakeStore {
  items: Row[] = []
  entries: Row[] = []
  tableCreates: string[] = []
  provisioned: boolean
  private seq = 0

  constructor(provisioned: boolean) {
    this.provisioned = provisioned
  }

  private nextRecordId(): string {
    this.seq += 1
    return `r${this.seq}`
  }

  sheets(): unknown[] {
    const tables: unknown[] = [
      { id: 4, name: '任务', fields: [{ name: 'todo_id' }, { name: '标题' }] },
    ]
    if (this.provisioned) {
      tables.push(
        { id: 7, name: '事项', fields: [{ name: 'advance_id' }, { name: '名称' }, { name: '阶段' }] },
        { id: 8, name: '事元', fields: [{ name: 'entry_id' }, { name: 'advance_id' }] },
      )
    }
    return tables
  }

  handle(command: string[]): unknown {
    const key = command.slice(0, 2).join(' ')
    if (key === 'doc workspace') return { list: [{ id: 'ws1', name: '我的知识', type: '个人' }] }
    if (key === 'doc list') return { list: [{ id: 'doc1', title: '待办任务库', fileSuffix: 'dbt' }] }
    if (key === 'sheet get') return { sheets: this.sheets() }
    if (key === 'sheet table') {
      const name = command[command.indexOf('--name') + 1] ?? ''
      this.tableCreates.push(name)
      this.provisioned = true
      return {}
    }
    if (key === 'contact user') return { list: [] }
    if (key === 'sheet record') {
      const verb = command[2]
      const tableId = command[command.indexOf('--table-id') + 1]
      const rows = tableId === '7' ? this.items : this.entries
      if (verb === 'list') {
        const filterAt = command.indexOf('--filter')
        let shown = rows
        if (filterAt !== -1) {
          const filter = JSON.parse(command[filterAt + 1] ?? '{}') as { criteria?: { field: string; operator: string; values: string[] }[] }
          for (const criterion of filter.criteria ?? []) {
            shown = shown.filter(row => {
              const value = String(row.fields[criterion.field] ?? '')
              if (criterion.operator === 'Equals') return value === criterion.values[0]
              if (criterion.operator === 'Contains') return value.includes(criterion.values[0] ?? '')
              return true
            })
          }
        }
        return { page_token: '', records: shown.map(row => ({ id: row.id, fields: JSON.stringify(row.fields) })) }
      }
      if (verb === 'create') {
        const records = JSON.parse(command[command.indexOf('--records') + 1] ?? '[]') as { fieldsValue: Record<string, unknown> }[]
        const created: Row[] = records.map(record => ({ id: this.nextRecordId(), fields: record.fieldsValue }))
        rows.push(...created)
        return { records: created.map(row => ({ id: row.id, fields: JSON.stringify(row.fields) })) }
      }
      if (verb === 'update') {
        const records = JSON.parse(command[command.indexOf('--records') + 1] ?? '[]') as { id: string; fieldsValue: Record<string, unknown> }[]
        for (const record of records) {
          const row = rows.find(candidate => candidate.id === record.id)
          if (row !== undefined) Object.assign(row.fields, record.fieldsValue)
        }
        return { records: [] }
      }
    }
    throw new Error(`unexpected command ${command.join(' ')}`)
  }
}

function mount(store: FakeStore): { ctx: Context; tools: CapturedTool[]; calls: string[][] } {
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
        try {
          const json = store.handle(command)
          return { ok: true, exitCode: 0, timedOut: false, stdout: '', stderr: '', json }
        } catch (error) {
          return { ok: false, exitCode: 1, timedOut: false, stdout: '', stderr: String((error as Error).message), json: undefined }
        }
      },
    },
  } as unknown as Context
  applyAdvanceTools(ctx, BUDGET, {})
  return { ctx, tools, calls }
}

function freshCaches(): AdvanceCaches {
  return { lib: {}, adv: {} }
}

describe('advance pure helpers', () => {
  it('enforces the six-stage machine', () => {
    expect(checkStageTransition('draft', 'running')).toBeNull()
    expect(checkStageTransition('running', 'decision-needed')).toBeNull()
    expect(checkStageTransition('decision-needed', 'updated')).toBeNull()
    expect(checkStageTransition('updated', 'ready-for-review')).toBeNull()
    expect(checkStageTransition('ready-for-review', 'completed')).toBeNull()
    expect(checkStageTransition('ready-for-review', 'running')).toBeNull()
    expect(checkStageTransition('completed', 'running')).toBeNull()
    expect(checkStageTransition('draft', 'completed')).toMatch(/状态机拒绝/)
    expect(checkStageTransition('running', 'updated')).toMatch(/状态机拒绝/)
    expect(checkStageTransition('draft', 'draft')).toBeNull()
  })

  it('sequences day-prefixed ids for items and entries', () => {
    const day = todayStr().replace(/\//g, '')
    expect(nextSequentialId('A', [`A-${day}-002`, 'A-20200101-009'])).toBe(`A-${day}-003`)
    expect(nextSequentialId('E', [])).toBe(`E-${day}-001`)
  })

  it('maps change types to the three timeline tones', () => {
    expect(toneOf('偏差', '')).toBe('red')
    expect(toneOf('决策请求', '')).toBe('red')
    expect(toneOf('验收请求', '')).toBe('green')
    expect(toneOf('阶段变化', '阶段 ready-for-review→completed')).toBe('green')
    expect(toneOf('阶段变化', '阶段 running→decision-needed')).toBe('red')
    expect(toneOf('进度更新', '')).toBe('blue')
  })

  it('parses metric lines into cards', () => {
    expect(parseMetrics('UAT 自助解决率: 38% / 60%\n客户环境: 未连通 / 已连通')).toEqual([
      { name: 'UAT 自助解决率', current: '38%', target: '60%' },
      { name: '客户环境', current: '未连通', target: '已连通' },
    ])
    expect(parseMetrics('只有指标名')).toEqual([{ name: '只有指标名', current: '', target: '' }])
    expect(parseMetrics('')).toEqual([])
  })

  it('parses item and entry records with JSON-string fields', () => {
    const item = parseAdvanceItem({
      id: 'r1',
      fields: JSON.stringify({ advance_id: 'A-20260819-001', 名称: '试运行', 阶段: 'running', 标签: '#ka', 成功指标: 'x: 1 / 2' }),
    })
    expect(item?.advanceId).toBe('A-20260819-001')
    expect(item?.stage).toBe('running')
    expect(item?.tags).toEqual(['ka'])
    const entry = parseAdvanceEntry({
      id: 'r2',
      fields: JSON.stringify({ entry_id: 'E-20260819-001', advance_id: 'A-20260819-001', 变化类型: '偏差', 摘要: '解决率不达标', 引用: 'yzj:msg:1 yzj:doc:2' }),
    })
    expect(entry?.refs).toEqual(['yzj:msg:1', 'yzj:doc:2'])
    expect(entry?.tone).toBe('red')
    expect(parseAdvanceItem({ id: 'x', fields: '{}' })).toBeNull()
  })

  it('aggregates sources by ref with the stage-① status heuristic', () => {
    const base = { recordId: '', advanceId: 'A-1', at: '2026/08/19 10:00', detail: '', actor: 'agent', tone: 'blue' as const }
    const entries: YzjAdvanceEntry[] = [
      { ...base, entryId: 'E-1', sourceType: '文档', changeType: '备注', summary: '读取范围说明', refs: ['yzj:doc:1'] },
      { ...base, entryId: 'E-2', sourceType: '数据', changeType: '偏差', summary: 'UAT 不达标', refs: ['yzj:data:uat'] },
      { ...base, entryId: 'E-3', sourceType: '人工', changeType: '备注', summary: '用户确认', refs: ['yzj:doc:1'], actor: 'user' },
    ]
    const sources = aggregateSources(entries)
    expect(sources).toHaveLength(2)
    expect(sources.find(source => source.ref === 'yzj:doc:1')?.status).toBe('已确认')
    expect(sources.find(source => source.ref === 'yzj:data:uat')?.status).toBe('未达标')
  })

  it('maps judge verbs to entries and stage moves', () => {
    expect(judgeVerb('confirm_advance').stageTo).toBe('updated')
    expect(judgeVerb('accept').stageTo).toBe('completed')
    expect(judgeVerb('reject').stageTo).toBe('running')
    expect(judgeVerb('ignore', '不影响').summary).toContain('不构成新约束：不影响')
    expect(judgeVerb('confirm_condition').stageTo).toBeUndefined()
  })
})

describe('yzj_advance_create', () => {
  it('provisions both tables on first use and writes the 立项 entry with refs', async () => {
    const store = new FakeStore(false)
    const { tools } = mount(store)
    const create = tools.find(tool => tool.name === 'yzj_advance_create')!
    const result = await create.execute({
      title: 'KA 客户 AI Helpdesk 试运行',
      goal: '8 月 31 日前通过 UAT 并进入试运行',
      metrics: '自助解决率: 38% / 60%',
      tags: ['ka'],
      refs: ['yzj:msg:root'],
      sourceType: '对话',
    })
    expect(store.tableCreates).toEqual(['事项', '事元'])
    expect(result.content).toContain('created 推进事项')
    expect(store.items).toHaveLength(1)
    expect(store.items[0]!.fields['阶段']).toBe('draft')
    expect(store.entries).toHaveLength(1)
    expect(store.entries[0]!.fields['引用']).toBe('yzj:msg:root')
    expect(store.entries[0]!.fields['操作者']).toBe('agent')
    expect(store.entries[0]!.fields['摘要']).toContain('立项')
  })

  it('is idempotent on an explicit advanceId', async () => {
    const store = new FakeStore(true)
    store.items.push({ id: 'r1', fields: { advance_id: 'A-20260819-001', 名称: '已有', 阶段: 'running' } })
    const { tools } = mount(store)
    const create = tools.find(tool => tool.name === 'yzj_advance_create')!
    const result = await create.execute({ title: '重复', advanceId: 'A-20260819-001' })
    expect(result.content).toContain('幂等命中')
    expect(store.items).toHaveLength(1)
    expect(store.entries).toHaveLength(0)
  })
})

describe('yzj_advance_feed', () => {
  it('appends an entry with host-generated old→new diffs and refolds the projection', async () => {
    const store = new FakeStore(true)
    store.items.push({ id: 'r1', fields: { advance_id: 'A-1', 名称: '试运行', 阶段: 'running', 描述: '原目标' } })
    const { tools } = mount(store)
    const feed = tools.find(tool => tool.name === 'yzj_advance_feed')!
    const result = await feed.execute({
      advanceId: 'A-1',
      summary: '客户新增本地部署要求',
      sourceType: '会议',
      changeType: '决策请求',
      stageTo: 'decision-needed',
      goal: '新目标：范围调整后按期评审',
      refs: ['yzj:doc:minutes'],
    })
    expect(result.content).toContain('fed 事元')
    expect(result.content).toContain('running→decision-needed')
    expect(store.entries).toHaveLength(1)
    const detail = String(store.entries[0]!.fields['变化内容'])
    expect(detail).toContain('阶段 running→decision-needed')
    expect(detail).toContain('目标 原目标→新目标')
    expect(store.items[0]!.fields['阶段']).toBe('decision-needed')
    expect(store.items[0]!.fields['描述']).toContain('新目标')
    expect(String(store.items[0]!.fields['最新动态'])).toContain('决策请求')
  })

  it('rejects an illegal stage move without writing any entry', async () => {
    const store = new FakeStore(true)
    store.items.push({ id: 'r1', fields: { advance_id: 'A-1', 名称: '试运行', 阶段: 'draft' } })
    const { tools } = mount(store)
    const feed = tools.find(tool => tool.name === 'yzj_advance_feed')!
    const result = await feed.execute({ advanceId: 'A-1', summary: '直接完成', stageTo: 'completed' })
    expect(result.content).toContain('状态机拒绝')
    expect(store.entries).toHaveLength(0)
    expect(store.items[0]!.fields['阶段']).toBe('draft')
  })

  it('keeps the stream lossless: N feeds read back complete and ordered', async () => {
    const store = new FakeStore(true)
    store.items.push({ id: 'r1', fields: { advance_id: 'A-1', 名称: '试运行', 阶段: 'running' } })
    const { ctx, tools } = mount(store)
    const feed = tools.find(tool => tool.name === 'yzj_advance_feed')!
    for (let i = 1; i <= 5; i += 1) {
      const result = await feed.execute({ advanceId: 'A-1', summary: `进展 ${i}`, changeType: '进度更新' })
      expect(result.content).toContain('fed 事元')
    }
    expect(store.entries).toHaveLength(5)
    void ctx
    const get = tools.find(tool => tool.name === 'yzj_advance_get')!
    const all = await get.execute({ advanceId: 'A-1', entryOffset: 0, entryLimit: 100 })
    for (let i = 1; i <= 5; i += 1) expect(all.content).toContain(`进展 ${i}`)
    const paged = await get.execute({ advanceId: 'A-1', entryOffset: 0, entryLimit: 2 })
    expect(paged.content).toContain('进展 1')
    expect(paged.content).toContain('进展 2')
    expect(paged.content).not.toContain('进展 3')
    const tail = await get.execute({ advanceId: 'A-1' })
    expect(tail.content).toContain('进展 5')
  })
})

describe('yzj_advance_list', () => {
  it('groups decision-needed first and hides completed from open', async () => {
    const store = new FakeStore(true)
    store.items.push(
      { id: 'r1', fields: { advance_id: 'A-1', 名称: '安静推进', 阶段: 'running' } },
      { id: 'r2', fields: { advance_id: 'A-2', 名称: '要决定', 阶段: 'decision-needed' } },
      { id: 'r3', fields: { advance_id: 'A-3', 名称: '已完成', 阶段: 'completed' } },
      { id: 'r4', fields: { advance_id: 'A-4', 名称: '待验收', 阶段: 'ready-for-review' } },
    )
    const { tools } = mount(store)
    const list = tools.find(tool => tool.name === 'yzj_advance_list')!
    const result = await list.execute({})
    expect(result.content).not.toContain('已完成')
    expect(result.content.indexOf('要决定')).toBeLessThan(result.content.indexOf('待验收'))
    expect(result.content.indexOf('待验收')).toBeLessThan(result.content.indexOf('安静推进'))
    const completed = await list.execute({ stage: 'completed' })
    expect(completed.content).toContain('已完成')
  })

  it('reports the un-provisioned board with an actionable message', async () => {
    const store = new FakeStore(false)
    const { tools } = mount(store)
    const list = tools.find(tool => tool.name === 'yzj_advance_list')!
    const result = await list.execute({})
    expect(result.content).toContain('推进看板尚未开通')
    expect(store.tableCreates).toHaveLength(0)
  })
})

describe('core judge path (panel direct write)', () => {
  function coreCtx(store: FakeStore): Context {
    return {
      yzjBridge: {
        async run(command: string[]): Promise<YzjRunResult> {
          try {
            const json = store.handle(command)
            return { ok: true, exitCode: 0, timedOut: false, stdout: '', stderr: '', json }
          } catch (error) {
            return { ok: false, exitCode: 1, timedOut: false, stdout: '', stderr: String((error as Error).message), json: undefined }
          }
        },
      },
    } as unknown as Context
  }

  it('accept lands a user 事元 and completes the item', async () => {
    const store = new FakeStore(true)
    store.items.push({ id: 'r1', fields: { advance_id: 'A-1', 名称: '试运行', 阶段: 'ready-for-review' } })
    const ctx = coreCtx(store)
    const verb = judgeVerb('accept', '指标齐了')
    const result = await coreFeedAdvance(ctx, BUDGET, {}, freshCaches(), {
      advanceId: 'A-1',
      summary: verb.summary,
      changeType: verb.changeType,
      ...(verb.stageTo === undefined ? {} : { stageTo: verb.stageTo }),
      actor: 'user',
    })
    expect(result.item.stage).toBe('completed')
    expect(store.entries).toHaveLength(1)
    expect(store.entries[0]!.fields['操作者']).toBe('user')
    expect(String(store.entries[0]!.fields['摘要'])).toContain('验收通过：指标齐了')
  })

  it('core create is reachable for the panel start modal (actor user)', async () => {
    const store = new FakeStore(true)
    const ctx = coreCtx(store)
    const result = await coreCreateAdvance(ctx, BUDGET, {}, freshCaches(), {
      title: '面板立项', goal: '目标', actor: 'user',
    })
    expect(result.item.stage).toBe('draft')
    expect(store.entries[0]!.fields['操作者']).toBe('user')
  })
})
