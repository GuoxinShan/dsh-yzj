/**
 * advance (AI推进) tool-family tests: pure helpers (stage machine / ids /
 * tones / metrics / sources) plus the four tools and the core operations over
 * a STATEFUL fake bridge — feed→get roundtrips prove the append-only stream
 * is lossless (hard requirement ②). inspect is read-only 比对材料 (spec §12).
 * by the 2026-08-15 probe: records arrays, `fields` as a JSON string,
 * Equals/Contains filters.
 */
import { describe, expect, it } from 'vitest'
import { Context as LiveContext } from '@deepseek-ai/cordis'
import type { Context } from '@deepseek-ai/cordis'
import type { YzjRunResult } from '@dsh-yzj/bridge'
import {
  applyAdvanceTools, coreCreateAdvance, coreFeedAdvance, coreScanAdvance, judgeVerb,
  checkStageTransition, nextSequentialId, toneOf, parseMetrics,
  parseAdvanceItem, parseAdvanceEntry, aggregateSources,
  buildInspectDigest, buildScanDigest, legalNextStages, INSPECT_DISCIPLINE,
  isSkippableSender, refsOverlap, isRefReplay, overlappedRefsOf, MAX_SCAN_GROUPS, YzjAdvanceService,
  documentThreadEntryInput, ADVANCE_STAGES,
} from '../src/advance.ts'
import type { AdvanceCaches, YzjAdvanceEntry, YzjAdvanceItem } from '../src/advance.ts'
import { ScanCursorStore, scanStateOf } from '../src/scan-cursors.ts'
import { DreamPoolStore } from '../src/advance-dreampool.ts'
import { ContextSourceStore, parseSourceToken, sourceKindOf, sourceTypeOfToken } from '../src/advance-sources.ts'
import { todayStr } from '../src/todo.ts'
import type { YzjToolBudget } from '../src/shared.ts'

const BUDGET: YzjToolBudget = { timeoutMs: 5_000, maxRenderChars: 8_000, maxMetaChars: 8_000 }

interface CapturedTool {
  name: string
  execute: (args: Record<string, unknown>) => Promise<{ content: string; truncated: boolean; data: unknown }>
}

interface Row { id: string; fields: Record<string, unknown> }

interface ImMessage {
  msgId: string
  fromOpenId: string
  content: string
  sendTime: string
}

/**
 * Stateful fake backend: one dbt doc with the todo 任务 table plus (optionally
 * pre-provisioned) 事项/事元 tables. Record create/update/list mutate real
 * in-memory rows so multi-step flows behave like the real CLI. Optional IM
 * catalog / messages back the scan tool.
 */
class FakeStore {
  items: Row[] = []
  entries: Row[] = []
  tableCreates: string[] = []
  provisioned: boolean
  selfOpenId = ''
  groups: { groupId: string; groupName: string }[] = []
  messages: Record<string, ImMessage[]> = {}
  private seq = 0

  constructor(provisioned: boolean) {
    this.provisioned = provisioned
  }

  /** Simulates a pre-v1.6 推进库 whose 阶段 SingleSelect lacks the cancelled option. */
  legacyStageOptions = false
  /** Directory-thread fixture: parentId → listed docs(决策 32 scan dir: mock)。 */
  dirDocs: Record<string, { id: string; title: string; updateTime: string }[]> = {}

  private nextRecordId(): string {
    this.seq += 1
    return `r${this.seq}`
  }

  sheets(): unknown[] {
    // 阶段 SingleSelect 选项:data.items(与真实 CLI 同形,2026-08-19 实测);
    // legacyStageOptions 模拟 v1.6 前的存量库(缺 cancelled)。
    const stageValues = this.legacyStageOptions
      ? ['draft', 'running', 'decision-needed', 'updated', 'ready-for-review', 'completed']
      : [...ADVANCE_STAGES]
    const tables: unknown[] = [
      { id: 4, name: '任务', fields: [{ name: 'todo_id' }, { name: '标题' }] },
    ]
    if (this.provisioned) {
      tables.push(
        { id: 7, name: '事项', fields: [{ name: 'advance_id' }, { name: '名称' }, { name: '阶段', data: { items: stageValues.map(value => ({ value })) } }] },
        { id: 8, name: '事元', fields: [{ name: 'entry_id' }, { name: 'advance_id' }] },
      )
    }
    return tables
  }

  handle(command: string[]): unknown {
    const key = command.slice(0, 2).join(' ')
    if (key === 'doc list') {
      // dir: 线程的目录增量(决策 32):带 --parent-id 列目录;否则库发现(待办任务库)
      const parentAt = command.indexOf('--parent-id')
      if (parentAt !== -1) {
        const parentId = command[parentAt + 1] ?? ''
        return { list: this.dirDocs[parentId] ?? [] }
      }
      return { list: [{ id: 'doc1', title: '待办任务库', fileSuffix: 'dbt' }] }
    }
    if (key === 'doc workspace') return { list: [{ id: 'ws1', name: '我的知识', type: '个人' }] }
    if (key === 'sheet get') return { sheets: this.sheets() }
    if (key === 'sheet table') {
      const name = command[command.indexOf('--name') + 1] ?? ''
      this.tableCreates.push(name)
      this.provisioned = true
      return {}
    }
    if (key === 'contact user') {
      // 真实 CLI 返回顶层数组(2026-08-19 实测;旧 {list} 形状曾掩盖 whoami 解析 bug)
      if (this.selfOpenId === '') return []
      return [{ openId: this.selfOpenId, oId: this.selfOpenId }]
    }
    // dir: 线程的目录增量 mock(决策 32):doc get 返回 kbId;doc list --parent-id 列目录
    if (key === 'doc get') {
      const id = command[command.indexOf('--id') + 1] ?? ''
      if (id in this.dirDocs) return { kbId: 'kb1' }
      throw new Error(`doc ${id} not found`)
    }
    if (key === 'im group') return { list: this.groups, more: false }
    if (key === 'im message') {
      const groupId = command[command.indexOf('--group-id') + 1] ?? ''
      const type = command[command.indexOf('--type') + 1] ?? 'newest'
      const limitAt = command.indexOf('--limit')
      const limit = limitAt === -1 ? 20 : Number(command[limitAt + 1] ?? 20)
      const msgIdAt = command.indexOf('--msg-id')
      const cursor = msgIdAt === -1 ? undefined : command[msgIdAt + 1]
      const rows = this.messages[groupId] ?? []
      if (type === 'newest') return { list: rows.slice(-Math.max(1, limit)) }
      const start = rows.findIndex(row => row.msgId === cursor)
      const after = start === -1 ? rows : rows.slice(start + 1)
      return { list: after.slice(0, Math.max(1, limit)) }
    }
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

/** Mount with an explicit thread registry so subscription flows can assert on it. */
function mountWithThreads(store: FakeStore, sources: ContextSourceStore): { ctx: Context; tools: CapturedTool[]; calls: string[][] } {
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
  applyAdvanceTools(ctx, BUDGET, {}, undefined, new ScanCursorStore(), sources)
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

  it('spreads inspect materials without judging', () => {
    const item: YzjAdvanceItem = {
      recordId: 'r1', advanceId: 'A-1', title: '试运行', goal: '进入试运行',
      assignee: '', assigneeOpenId: '', targetDate: '', stage: 'running',
      background: '原计划本周', metrics: '覆盖率: 80 / 100', tags: [], latest: '',
    }
    const compare = buildInspectDigest({ subjects: [{ item, recent: [] }], signals: '客户改口径', mode: 'compare' })
    expect(compare).toContain('比对材料')
    expect(compare).toContain('背景（原来的理解）：原计划本周')
    expect(compare).toContain('合法下一阶段：decision-needed / ready-for-review / draft')
    expect(compare).toContain('客户改口径')
    expect(compare).toContain('禁止 stageTo=completed')
    expect(compare).toContain(INSPECT_DISCIPLINE.split('\n')[0] ?? '纪律')
    // §13 判据：打扰 / 静默 / 抑制 / 门控线各留一条可核对的锚点
    expect(compare).toContain('打扰判据')
    expect(compare).toContain('朝远离目标移动')
    expect(compare).toContain('静默判据')
    expect(compare).toContain('抑制')
    expect(compare).toContain('确认卡只在改基准')
    expect(compare).toContain('抽取分发')
    expect(compare).toContain('打扰判据')
    const review = buildInspectDigest({ subjects: [{ item, recent: [] }], signals: '', mode: 'review' })
    expect(review).toContain('验收辅助材料')
    expect(review).toContain('不要自动过')
    const empty = buildInspectDigest({ subjects: [], signals: '', mode: 'compare' })
    expect(empty).toContain('没有 open 推进事项')
    expect(empty).toContain('静默')
    expect(legalNextStages('running')).toEqual(['decision-needed', 'ready-for-review', 'draft', 'cancelled'])
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
    // 决策 39 后续: 一条原始信息携带引用它的事元（三层:事项→事元→原始信息）
    const doc = sources.find(source => source.ref === 'yzj:doc:1')
    expect(doc?.citing).toHaveLength(2)
    expect(doc?.citing[0]).toMatchObject({ entryId: 'E-1', changeType: '备注', summary: '读取范围说明' })
    expect(doc?.citing[1]).toMatchObject({ entryId: 'E-3', changeType: '备注', summary: '用户确认' })
    expect(sources.find(source => source.ref === 'yzj:data:uat')?.citing).toHaveLength(1)
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

  it('rejects stageTo=decision-needed without 决策请求 (决策 41: 决策区只渲染决策请求,偏差推阶段会出空决策区)', async () => {
    const store = new FakeStore(true)
    store.items.push({ id: 'r1', fields: { advance_id: 'A-1', 名称: '试运行', 阶段: 'running', 描述: '原目标' } })
    const { tools } = mount(store)
    const feed = tools.find(tool => tool.name === 'yzj_advance_feed')!
    const result = await feed.execute({
      advanceId: 'A-1',
      summary: '评审浮现范围补充',
      sourceType: '会议',
      changeType: '偏差',
      stageTo: 'decision-needed',
    })
    expect(result.content).toContain('stageTo=decision-needed 必须配 changeType=决策请求')
    expect(store.entries).toHaveLength(0)
    expect(store.items[0]!.fields['阶段']).toBe('running')
  })

  it('records the producing session on the entry (决策 41 讨论回环:问助手直回产出会话)', async () => {
    const store = new FakeStore(true)
    store.items.push({ id: 'r1', fields: { advance_id: 'A-1', 名称: '试运行', 阶段: 'running', 描述: '原目标' } })
    const { tools } = mount(store)
    const feed = tools.find(tool => tool.name === 'yzj_advance_feed')!
    const result = await feed.execute(
      { advanceId: 'A-1', summary: '群里一句', sourceType: '对话' } as never,
      { agent: { session: { id: 'yzj-dream-20260821-101500' } } } as never,
    )
    expect(result.content).toContain('fed 事元')
    expect(store.entries[0]!.fields['出处会话']).toBe('yzj-dream-20260821-101500')
    expect(parseAdvanceEntry({ id: 'x', fields: store.entries[0]!.fields })?.producer).toBe('yzj-dream-20260821-101500')
  })

  it('rejects agent stage moves OUT of a waiting stage (决策 43: 待决出口是人的主权,防未处理决策被下一次 Dream 冲掉)', async () => {
    const store = new FakeStore(true)
    store.items.push(
      { id: 'r1', fields: { advance_id: 'A-1', 名称: '待决定', 阶段: 'decision-needed' } },
      { id: 'r2', fields: { advance_id: 'A-2', 名称: '待验收', 阶段: 'ready-for-review' } },
    )
    const { tools } = mount(store)
    const feed = tools.find(tool => tool.name === 'yzj_advance_feed')!
    const out1 = await feed.execute({ advanceId: 'A-1', summary: 'agent 误判解除', sourceType: '数据', stageTo: 'running' })
    expect(out1.content).toContain('只能由用户在看板拍板')
    const out2 = await feed.execute({ advanceId: 'A-2', summary: 'agent 试图打回', sourceType: '数据', stageTo: 'running' })
    expect(out2.content).toContain('只能由用户在看板拍板')
    expect(store.entries).toHaveLength(0)
    expect(store.items[0]!.fields['阶段']).toBe('decision-needed')
  })

  it('enforces 综合自 on a second open 决策请求 (决策 43 修正: 卡面只有一条当前决策)', async () => {
    const store = new FakeStore(true)
    store.items.push({ id: 'r1', fields: { advance_id: 'A-1', 名称: '待决定', 阶段: 'decision-needed' } })
    store.entries.push({ id: 'e1', fields: { entry_id: 'E-1', advance_id: 'A-1', 时间: '2026/08/21 10:00', 来源类型: '会议', 变化类型: '决策请求', 摘要: '范围补充要不要纳入', 操作者: 'agent' } })
    const { tools } = mount(store)
    const feed = tools.find(tool => tool.name === 'yzj_advance_feed')!
    const blocked = await feed.execute({ advanceId: 'A-1', summary: '新分叉要不要加资源', changeType: '决策请求', detail: '分析:两条路径都成立' })
    expect(blocked.content).toContain('综合自')
    expect(store.entries).toHaveLength(1)
    const merged = await feed.execute({ advanceId: 'A-1', summary: '范围与分叉综合版', changeType: '决策请求', detail: '分析:最新上下文\n综合自: E-1（旧问题并入本卡）' })
    expect(merged.content).toContain('fed 事元')
    expect(store.entries).toHaveLength(2)
  })

  it('rejects an illegal stage move without writing any entry', async () => {
    const store = new FakeStore(true)
    store.items.push({ id: 'r1', fields: { advance_id: 'A-1', 名称: '试运行', 阶段: 'draft' } })
    const { tools } = mount(store)
    const feed = tools.find(tool => tool.name === 'yzj_advance_feed')!
    // draft→ready-for-review 是非终局的非法跳变(终局拦截由「agent feed can never enter terminal stages」专项覆盖)
    const result = await feed.execute({ advanceId: 'A-1', summary: '直接送验收', stageTo: 'ready-for-review' })
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

  it('host-dedupes a second feed whose refs overlap an existing 事元 (决策 19)', async () => {
    const store = new FakeStore(true)
    store.items.push({ id: 'r1', fields: { advance_id: 'A-1', 名称: '试运行', 阶段: 'running' } })
    const { tools } = mount(store)
    const feed = tools.find(tool => tool.name === 'yzj_advance_feed')!
    const first = await feed.execute({
      advanceId: 'A-1', summary: '群里一句进度', changeType: '进度更新', refs: ['msg-42'],
    })
    expect(first.content).toContain('fed 事元')
    expect(store.entries).toHaveLength(1)
    const second = await feed.execute({
      advanceId: 'A-1', summary: '同一条再喂', changeType: '进度更新', refs: ['msg-42'],
    })
    expect(second.content).toContain('同源去重')
    expect(store.entries).toHaveLength(1)
    const emptyRefs = await feed.execute({
      advanceId: 'A-1', summary: '没有 ref 的另一次', changeType: '进度更新',
    })
    expect(emptyRefs.content).toContain('fed 事元')
    expect(store.entries).toHaveLength(2)
  })

  it('appends on partial refs overlap with an overlap hint (830 regression: one doc cited by progress AND goal-update entries)', async () => {
    const store = new FakeStore(true)
    store.items.push({ id: 'r1', fields: { advance_id: 'A-1', 名称: '试运行', 阶段: 'running' } })
    const { tools } = mount(store)
    const feed = tools.find(tool => tool.name === 'yzj_advance_feed')!
    // 回放②:refs 两个文档(进度更新)
    const first = await feed.execute({
      advanceId: 'A-1', summary: '参谋部阶段共识', changeType: '进度更新', refs: ['doc-0806', 'doc-0812'],
    })
    expect(first.content).toContain('fed 事元')
    expect(store.entries).toHaveLength(1)
    // 回放③:同一文档被目标更新再引——子集重叠,必须追加而不是幂等吞掉
    const goalUpdate = await feed.execute({
      advanceId: 'A-1', summary: '定义转向', changeType: '目标更新', goal: '新目标', refs: ['doc-0812'],
    })
    expect(goalUpdate.content).toContain('fed 事元')
    expect(goalUpdate.content).toContain('引用重叠提示')
    expect(goalUpdate.content).toContain('doc-0812')
    expect((goalUpdate.data as { overlappedRefs?: string[] }).overlappedRefs).toEqual(['doc-0812'])
    expect(store.entries).toHaveLength(2)
    // refs 集合相等但 changeType 不同 → 追加(同一消息可以驱动不同语义的条目)
    const retyped = await feed.execute({
      advanceId: 'A-1', summary: '换个变化类型再引同一消息', changeType: '偏差', refs: ['doc-0806', 'doc-0812'],
    })
    expect(retyped.content).toContain('fed 事元')
    expect(store.entries).toHaveLength(3)
    // refs 超集 → 追加并提示交集
    const superset = await feed.execute({
      advanceId: 'A-1', summary: '补充新信号后的合并 feed', changeType: '进度更新', refs: ['doc-0806', 'doc-0812', 'msg-9'],
    })
    expect(superset.content).toContain('fed 事元')
    expect(superset.content).toContain('引用重叠提示')
    expect(store.entries).toHaveLength(4)
    // 完全重放(同 refs 集合 + 同 changeType)→ 仍幂等(决策 25 保留判定 8 行为)
    const replay = await feed.execute({
      advanceId: 'A-1', summary: '超集那条再喂一遍', changeType: '进度更新', refs: ['doc-0806', 'doc-0812', 'msg-9'],
    })
    expect(replay.content).toContain('同源去重')
    expect(store.entries).toHaveLength(4)
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

describe('yzj_advance_inspect', () => {
  it('spreads open items and hides completed', async () => {
    const store = new FakeStore(true)
    store.items.push(
      { id: 'r1', fields: { advance_id: 'A-1', 名称: '安静推进', 阶段: 'running', 描述: '按期', 任务背景: '原计划' } },
      { id: 'r2', fields: { advance_id: 'A-2', 名称: '已完成', 阶段: 'completed' } },
    )
    const { tools } = mount(store)
    const inspect = tools.find(tool => tool.name === 'yzj_advance_inspect')!
    const result = await inspect.execute({ signals: '群里说范围变了' })
    expect(result.content).toContain('安静推进')
    expect(result.content).not.toContain('已完成')
    expect(result.content).toContain('群里说范围变了')
    expect(result.content).toContain('禁止 stageTo=completed')
    const review = await inspect.execute({ advanceId: 'A-1', mode: 'review' })
    expect(review.content).toContain('验收辅助材料')
    expect(review.content).toContain('不要自动过')
    const missing = await inspect.execute({ advanceId: 'A-missing' })
    expect(missing.content).toContain('不存在')
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

  it('judge verbs land the 判定动作 marker so the board settles the queue head (决策 43)', async () => {
    const store = new FakeStore(true)
    store.items.push({ id: 'r1', fields: { advance_id: 'A-1', 名称: '待决定', 阶段: 'decision-needed' } })
    const ctx = coreCtx(store)
    const verb = judgeVerb('ignore')
    await coreFeedAdvance(ctx, BUDGET, {}, freshCaches(), {
      advanceId: 'A-1',
      summary: verb.summary,
      changeType: verb.changeType,
      ...(verb.stageTo === undefined ? {} : { stageTo: verb.stageTo }),
      actor: 'user',
      judgeAction: 'ignore',
    })
    expect(store.entries[0]!.fields['判定动作']).toBe('ignore')
    expect(parseAdvanceEntry({ id: 'x', fields: store.entries[0]!.fields })?.judge).toBe('ignore')
    expect(store.entries[0]!.fields['操作者']).toBe('user')
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

  it('cancel lands cancelled as a user 事元 (决策 27: 失败/黄了的体面收口)', async () => {
    const store = new FakeStore(true)
    store.items.push({ id: 'r1', fields: { advance_id: 'A-1', 名称: '试运行', 阶段: 'running' } })
    const ctx = coreCtx(store)
    const verb = judgeVerb('cancel', '方向变了')
    const result = await coreFeedAdvance(ctx, BUDGET, {}, freshCaches(), {
      advanceId: 'A-1',
      summary: verb.summary,
      changeType: verb.changeType,
      stageTo: verb.stageTo,
      actor: 'user',
    })
    expect(result.item.stage).toBe('cancelled')
    expect(store.entries[0]!.fields['操作者']).toBe('user')
    expect(String(store.entries[0]!.fields['摘要'])).toContain('中止推进：方向变了')
    // cancelled → running 可重启
    const reopen = await coreFeedAdvance(ctx, BUDGET, {}, freshCaches(), {
      advanceId: 'A-1', summary: '重启', stageTo: 'running', actor: 'user',
    })
    expect(reopen.item.stage).toBe('running')
  })

  it('legacy 库缺 cancelled 选项时 judge cancel 明示报错(不静默丢)', async () => {
    const store = new FakeStore(true)
    store.legacyStageOptions = true
    store.items.push({ id: 'r1', fields: { advance_id: 'A-1', 名称: '试运行', 阶段: 'running' } })
    const ctx = coreCtx(store)
    const verb = judgeVerb('cancel')
    await expect(coreFeedAdvance(ctx, BUDGET, {}, freshCaches(), {
      advanceId: 'A-1',
      summary: verb.summary,
      changeType: verb.changeType,
      stageTo: verb.stageTo,
      actor: 'user',
    })).rejects.toThrow(/缺.*cancelled.*选项/)
    expect(store.entries).toHaveLength(0)
  })

  it('agent feed can never enter terminal stages (spec §13.5 host-enforced, 决策 27)', async () => {
    const store = new FakeStore(true)
    store.items.push(
      { id: 'r1', fields: { advance_id: 'A-1', 名称: '待验收', 阶段: 'ready-for-review' } },
      { id: 'r2', fields: { advance_id: 'A-2', 名称: '进行中', 阶段: 'running' } },
    )
    const ctx = coreCtx(store)
    await expect(coreFeedAdvance(ctx, BUDGET, {}, freshCaches(), {
      advanceId: 'A-1', summary: 'agent 试图验收', stageTo: 'completed', actor: 'agent',
    })).rejects.toThrow(/终局.*只由用户/)
    await expect(coreFeedAdvance(ctx, BUDGET, {}, freshCaches(), {
      advanceId: 'A-2', summary: 'agent 试图中止', stageTo: 'cancelled', actor: 'agent',
    })).rejects.toThrow(/终局.*只由用户/)
    expect(store.entries).toHaveLength(0)
  })
})

describe('cancelled stage machine (决策 26/27)', () => {
  it('allows non-terminal → cancelled and cancelled → running; forbids completed → cancelled', () => {
    expect(checkStageTransition('running', 'cancelled')).toBeNull()
    expect(checkStageTransition('draft', 'cancelled')).toBeNull()
    expect(checkStageTransition('decision-needed', 'cancelled')).toBeNull()
    expect(checkStageTransition('ready-for-review', 'cancelled')).toBeNull()
    expect(checkStageTransition('cancelled', 'running')).toBeNull()
    expect(checkStageTransition('completed', 'cancelled')).not.toBeNull()
    expect(checkStageTransition('cancelled', 'completed')).not.toBeNull()
  })

  it('list open excludes cancelled (same as completed)', async () => {
    const store = new FakeStore(true)
    store.items.push(
      { id: 'r1', fields: { advance_id: 'A-1', 名称: '跑着', 阶段: 'running' } },
      { id: 'r2', fields: { advance_id: 'A-2', 名称: '黄了', 阶段: 'cancelled' } },
      { id: 'r3', fields: { advance_id: 'A-3', 名称: '成了', 阶段: 'completed' } },
    )
    const { tools } = mount(store)
    const list = tools.find(tool => tool.name === 'yzj_advance_list')!
    const result = await list.execute({})
    expect(result.content).toContain('跑着')
    expect(result.content).not.toContain('黄了')
    expect(result.content).not.toContain('成了')
    const cancelledOnly = await list.execute({ stage: 'cancelled' })
    expect(cancelledOnly.content).toContain('黄了')
  })
})

describe('scan helpers', () => {
  it('skips self and BOT- senders', () => {
    expect(isSkippableSender('me', 'me')).toBe(true)
    expect(isSkippableSender('BOT-r1', 'me')).toBe(true)
    expect(isSkippableSender('other', 'me')).toBe(false)
    expect(isSkippableSender('', 'me')).toBe(false)
  })

  it('treats overlapping refs as a duplicate', () => {
    expect(refsOverlap(['a', 'b'], ['b', 'c'])).toBe(true)
    expect(refsOverlap(['a'], ['b'])).toBe(false)
    expect(refsOverlap([], ['a'])).toBe(false)
    expect(MAX_SCAN_GROUPS).toBe(8)
  })

  it('isRefReplay requires the exact refs set AND the same changeType (决策 25)', () => {
    const entry = { refs: ['a', 'b'], changeType: '进度更新' }
    expect(isRefReplay(['a', 'b'], '进度更新', entry)).toBe(true)
    expect(isRefReplay(['b', 'a'], '进度更新', entry)).toBe(true) // 顺序无关
    expect(isRefReplay(['a'], '进度更新', entry)).toBe(false)      // 子集不是重放
    expect(isRefReplay(['a', 'b', 'c'], '进度更新', entry)).toBe(false) // 超集不是
    expect(isRefReplay(['a', 'b'], '目标更新', entry)).toBe(false) // changeType 不同
    expect(isRefReplay([], '进度更新', entry)).toBe(false)
  })

  it('overlappedRefsOf returns the shared ref tokens', () => {
    const existing = [{ refs: ['a', 'b'] }, { refs: ['c'] }]
    expect(overlappedRefsOf(['a', 'c', 'z'], existing)).toEqual(['a', 'c'])
    expect(overlappedRefsOf(['z'], existing)).toEqual([])
    expect(overlappedRefsOf([], existing)).toEqual([])
  })
})

describe('thread token grammar (spec §15.2)', () => {
  it('accepts the five literal prefixes and nothing else', () => {
    expect(parseSourceToken('im:g-1')).toEqual({ prefix: 'im', id: 'g-1' })
    expect(parseSourceToken('doc:abc_123')).toEqual({ prefix: 'doc', id: 'abc_123' })
    expect(parseSourceToken('todo:t1')).toEqual({ prefix: 'todo', id: 't1' })
    expect(parseSourceToken('event:e1')).toEqual({ prefix: 'event', id: 'e1' })
    expect(parseSourceToken('file:f1')).toEqual({ prefix: 'file', id: 'f1' })
    expect(parseSourceToken('msg:m1')).toBeUndefined()
    expect(parseSourceToken('im:')).toBeUndefined()
    expect(parseSourceToken('im:g 1')).toBeUndefined()
    expect(parseSourceToken('')).toBeUndefined()
  })

  it('maps prefixes to thread kinds and 事元 source types', () => {
    expect(sourceKindOf('im')).toBe('persistent')
    expect(sourceKindOf('dir')).toBe('persistent')
    expect(sourceKindOf('doc')).toBe('document')
    expect(sourceKindOf('file')).toBe('document')
    expect(sourceKindOf('msg')).toBeUndefined()
    expect(sourceTypeOfToken('doc')).toBe('文档')
    expect(sourceTypeOfToken('file')).toBe('文档')
    expect(sourceTypeOfToken('todo')).toBe('待办')
    expect(sourceTypeOfToken('event')).toBe('日程')
  })
})

describe('yzj_advance_scan', () => {
  function seedIm(store: FakeStore): void {
    store.selfOpenId = 'me-openid'
    store.groups = [{ groupId: 'g-dsh2', groupName: 'dsh-2' }]
    store.messages['g-dsh2'] = [
      { msgId: 'm0', fromOpenId: 'alice', content: '历史消息', sendTime: '2026/08/19 10:00' },
    ]
  }

  it('first visit records a baseline and returns no signals', async () => {
    const store = new FakeStore(true)
    seedIm(store)
    const { tools } = mount(store)
    const scan = tools.find(tool => tool.name === 'yzj_advance_scan')!
    const result = await scan.execute({ groups: ['dsh-2'] })
    expect(result.content).toContain('基线已立')
    expect(result.content).not.toContain('历史消息')
    expect(result.content).toContain('新信号：（无）')
    const data = result.data as { signals: unknown[] }
    expect(data.signals).toEqual([])
  })

  it('dir: thread snapshots first, then surfaces new/updated docs as signals (决策 32)', async () => {
    const store = new FakeStore(true)
    seedIm(store)
    store.items.push({ id: 'r1', fields: { advance_id: 'A-1', 名称: '试运行', 阶段: 'running' } })
    store.dirDocs['dir-830'] = [
      { id: 'd1', title: '纪要 0806', updateTime: '2026-08-19 10:00' },
    ]
    const sources = new ContextSourceStore()
    await sources.add('A-1', { token: 'dir:dir-830', kind: 'persistent', label: '830实验·共识', addedBy: 'user', addedAt: 1 })
    const { tools } = mountWithThreads(store, sources)
    const scan = tools.find(tool => tool.name === 'yzj_advance_scan')!
    // 首扫:基线不回灌
    const first = await scan.execute({})
    expect(first.content).toContain('基线已立')
    expect(first.content).not.toContain('纪要 0806')
    // 新增文档 → 信号
    store.dirDocs['dir-830']!.push({ id: 'd2', title: '纪要 0812', updateTime: '2026-08-19 12:00' })
    const second = await scan.execute({})
    expect(second.content).toContain('新增文档《纪要 0812》')
    expect(second.content).toContain('<d2>')
    expect(second.content).toContain('830实验·共识')
    // 更新文档(updateTime 变) → 信号
    store.dirDocs['dir-830'] = [
      { id: 'd1', title: '纪要 0806', updateTime: '2026-08-19 13:00' },
      { id: 'd2', title: '纪要 0812', updateTime: '2026-08-19 12:00' },
    ]
    const third = await scan.execute({})
    expect(third.content).toContain('更新文档《纪要 0806》')
    // 无变化 → 静默
    const fourth = await scan.execute({})
    expect(fourth.content).toContain('无新消息，静默')
  })

  it('pages through the full incremental window when a group moved >pageSize messages (830 截断回归)', async () => {
    const store = new FakeStore(true)
    seedIm(store)
    const { tools } = mount(store)
    const scan = tools.find(tool => tool.name === 'yzj_advance_scan')!
    await scan.execute({ groups: ['dsh-2'] }) // 基线(此时只有 m0 历史)
    // 基线后才涌入 25 条 > 单页 20:修复前只取前 20,后 5 条丢失
    for (let i = 1; i <= 25; i += 1) {
      store.messages['g-dsh2']!.push({ msgId: `m-${i}`, fromOpenId: 'alice', content: `消息 ${i}`, sendTime: `2026/08/19 10:${String(i).padStart(2, '0')}` })
    }
    const found = await scan.execute({ groups: ['dsh-2'] })
    expect(found.content).toContain('25 条新信号')
    expect(found.content).toContain('消息 25')
    const data = found.data as { signals: unknown[] }
    expect(data.signals).toHaveLength(25)
  })

  it('second visit with no new messages is silent; a later human message is a signal', async () => {
    const store = new FakeStore(true)
    seedIm(store)
    const { tools } = mount(store)
    const scan = tools.find(tool => tool.name === 'yzj_advance_scan')!
    await scan.execute({ groups: ['dsh-2'] })
    const quiet = await scan.execute({ groups: ['dsh-2'] })
    expect(quiet.content).toContain('无新消息，静默')
    store.messages['g-dsh2']!.push(
      { msgId: 'm-bot', fromOpenId: 'BOT-r', content: '机器人回帖', sendTime: '2026/08/19 10:05' },
      { msgId: 'm-me', fromOpenId: 'me-openid', content: '我自己说的', sendTime: '2026/08/19 10:06' },
      { msgId: 'm-new', fromOpenId: 'alice', content: '进度正常，覆盖率到 80', sendTime: '2026/08/19 10:07' },
    )
    const found = await scan.execute({ groups: ['dsh-2'] })
    expect(found.content).toContain('1 条新信号')
    expect(found.content).toContain('进度正常，覆盖率到 80')
    expect(found.content).toContain('<im:g-dsh2:m-new>')
    expect(found.content).not.toContain('机器人回帖')
    expect(found.content).not.toContain('我自己说的')
    expect(found.content).toContain('信号已由 host 巡检自动入蓄水池')
  })

  it('persists the cursor across tool calls and names unknown groups', async () => {
    const store = new FakeStore(true)
    seedIm(store)
    const cursors = new ScanCursorStore()
    const { ctx } = mount(store)
    const first = await coreScanAdvance(ctx, BUDGET, {}, freshCaches(), cursors, ['dsh-2'])
    expect(first.groups[0]?.baseline).toBe(true)
    expect(cursors.get('g-dsh2')?.lastMsgId).toBe('m0')
    store.messages['g-dsh2']!.push(
      { msgId: 'm1', fromOpenId: 'alice', content: '新一句', sendTime: '2026/08/19 11:00' },
    )
    const second = await coreScanAdvance(ctx, BUDGET, {}, freshCaches(), cursors, ['g-dsh2'])
    expect(second.signals.map(row => row.msgId)).toEqual(['m1'])
    expect(cursors.get('g-dsh2')?.lastMsgId).toBe('m1')
    expect(scanStateOf(cursors).found).toBe(1)
    const missing = await coreScanAdvance(ctx, BUDGET, {}, freshCaches(), cursors, ['不存在的群'])
    expect(missing.groups[0]?.error).toMatch(/找不到群/)
    const digest = buildScanDigest(second)
    expect(digest).toContain('巡检扫描')
    expect(digest).toContain('<im:g-dsh2:m1>')
    const state = scanStateOf(cursors)
    expect(state.found).toBe(0)
    expect(state.scannedAt).not.toBeNull()
    expect(state.groups[0]?.groupId).toBe('g-dsh2')
  })
})

describe('intent sources (spec §15 / ③.2)', () => {
  it('create with sources subscribes 来源①; invalid tokens are skipped', async () => {
    const store = new FakeStore(true)
    store.groups = [{ groupId: 'g-dsh2', groupName: 'dsh-2' }]
    const sources = new ContextSourceStore()
    const { tools } = mountWithThreads(store, sources)
    const create = tools.find(tool => tool.name === 'yzj_advance_create')!
    const result = await create.execute({
      title: '带订阅立项',
      sources: ['im:g-dsh2', 'bogus-token'],
    })
    expect(result.content).toContain('created 推进事项')
    expect(result.content).toContain('已订阅来源：im:g-dsh2')
    const advanceId = String(store.items[0]!.fields['advance_id'])
    const rows = sources.sourcesOf(advanceId)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ token: 'im:g-dsh2', kind: 'persistent', label: 'dsh-2', addedBy: 'agent' })
  })

  it('one group subscribed by two items: one fetch, cursor advances once, digest lists subscriptions', async () => {
    const store = new FakeStore(true)
    store.selfOpenId = 'me-openid'
    store.groups = [{ groupId: 'g-dsh2', groupName: 'dsh-2' }]
    store.messages['g-dsh2'] = [
      { msgId: 'm0', fromOpenId: 'alice', content: '历史消息', sendTime: '2026/08/19 10:00' },
    ]
    store.items.push(
      { id: 'r1', fields: { advance_id: 'A-1', 名称: '事项甲', 阶段: 'running' } },
      { id: 'r2', fields: { advance_id: 'A-2', 名称: '事项乙', 阶段: 'running' } },
      { id: 'r3', fields: { advance_id: 'A-3', 名称: '已完成', 阶段: 'completed' } },
    )
    const sources = new ContextSourceStore()
    await sources.add('A-1', { token: 'im:g-dsh2', kind: 'persistent', label: 'dsh-2', addedBy: 'agent', addedAt: 1 })
    await sources.add('A-2', { token: 'im:g-dsh2', kind: 'persistent', label: 'dsh-2', addedBy: 'user', addedAt: 2 })
    await sources.add('A-2', { token: 'doc:d1', kind: 'document', label: '纪要', addedBy: 'user', addedAt: 3 })
    // completed 事项的订阅不进扫描集合
    await sources.add('A-3', { token: 'im:g-other', kind: 'persistent', label: '别的群', addedBy: 'agent', addedAt: 4 })
    const cursors = new ScanCursorStore()
    const { ctx, calls } = mountWithThreads(store, sources)
    const first = await coreScanAdvance(ctx, BUDGET, {}, freshCaches(), cursors, [], 20, undefined, sources)
    expect(first.groups).toHaveLength(1)
    expect(first.groups[0]?.baseline).toBe(true)
    store.messages['g-dsh2']!.push(
      { msgId: 'm1', fromOpenId: 'alice', content: '新进度一句', sendTime: '2026/08/19 11:00' },
    )
    calls.length = 0
    const second = await coreScanAdvance(ctx, BUDGET, {}, freshCaches(), cursors, [], 20, undefined, sources)
    // 同一渠道一次取流（im message list 恰好一次），cursor 只前进一次
    expect(calls.filter(command => command[0] === 'im' && command[1] === 'message')).toHaveLength(1)
    expect(second.signals.map(signal => signal.msgId)).toEqual(['m1'])
    expect(cursors.get('g-dsh2')?.lastMsgId).toBe('m1')
    // 分发材料：每个 open 事项的订阅清单（completed 不列）
    expect(second.subscriptions.map(row => row.advanceId)).toEqual(['A-1', 'A-2'])
    expect(second.subscriptions[1]?.tokens).toEqual(['im:g-dsh2', 'doc:d1'])
    const digest = buildScanDigest(second)
    expect(digest).toContain('订阅清单（分发按线程 + 语义相关）')
    expect(digest).toContain('A-2 · 事项乙 [running] → im:g-dsh2，doc:d1')
    expect(digest).not.toContain('g-other')
  })

  it('scan without groups errors with guidance when nothing is subscribed', async () => {
    const store = new FakeStore(true)
    store.items.push({ id: 'r1', fields: { advance_id: 'A-1', 名称: '事项甲', 阶段: 'running' } })
    const sources = new ContextSourceStore()
    const { tools } = mountWithThreads(store, sources)
    const scan = tools.find(tool => tool.name === 'yzj_advance_scan')!
    const result = await scan.execute({})
    expect(result.content).toContain('没有 open 事项订阅 im:/dir: 来源')
  })

  it('document-source association lands one 备注 事元; repeat is idempotent', async () => {
    const store = new FakeStore(true)
    store.items.push({ id: 'r1', fields: { advance_id: 'A-1', 名称: '试运行', 阶段: 'running' } })
    const sources = new ContextSourceStore()
    const ctx = new LiveContext()
    ;(ctx as unknown as { yzjBridge: { run: (command: string[]) => Promise<YzjRunResult> } }).yzjBridge = {
      async run(command: string[]): Promise<YzjRunResult> {
        try {
          const json = store.handle(command)
          return { ok: true, exitCode: 0, timedOut: false, stdout: '', stderr: '', json }
        } catch (error) {
          return { ok: false, exitCode: 1, timedOut: false, stdout: '', stderr: String((error as Error).message), json: undefined }
        }
      },
    }
    const service = new YzjAdvanceService(ctx, BUDGET, {}, {}, new ScanCursorStore(), sources)
    const first = await service.sourceAdd('A-1', 'doc:d-123', '范围说明')
    expect(first.entryAppended).toBe(true)
    expect(first.sources[0]).toMatchObject({ token: 'doc:d-123', kind: 'document', label: '范围说明', addedBy: 'user' })
    expect(store.entries).toHaveLength(1)
    expect(store.entries[0]!.fields['来源类型']).toBe('文档')
    expect(store.entries[0]!.fields['变化类型']).toBe('备注')
    expect(store.entries[0]!.fields['引用']).toBe('doc:d-123')
    expect(store.entries[0]!.fields['操作者']).toBe('user')
    // 重复关联：注册表与事元双重幂等
    const again = await service.sourceAdd('A-1', 'doc:d-123', '范围说明')
    expect(again.entryAppended).toBe(false)
    expect(store.entries).toHaveLength(1)
    expect(sources.sourcesOf('A-1')).toHaveLength(1)
    // detail 折叠了 sources 字段
    const detail = await service.get('A-1')
    expect(detail.sources).toHaveLength(1)
    expect(detail.contextSources[0]?.token).toBe('doc:d-123')
    // 解除只删注册表行，已产事元不动
    const removed = await service.sourceRemove('A-1', 'doc:d-123')
    expect(removed).toEqual([])
    expect(store.entries).toHaveLength(1)
    const afterRemove = await service.get('A-1')
    expect(afterRemove.contextSources).toEqual([])
    expect(afterRemove.entries.map(entry => entry.summary)).toContain('关联来源：范围说明')
  })

  it('im association registers only (no entry); invalid token and missing item are rejected', async () => {
    const store = new FakeStore(true)
    store.groups = [{ groupId: 'g-dsh2', groupName: 'dsh-2' }]
    store.items.push({ id: 'r1', fields: { advance_id: 'A-1', 名称: '试运行', 阶段: 'running' } })
    const sources = new ContextSourceStore()
    const ctx = new LiveContext()
    ;(ctx as unknown as { yzjBridge: { run: (command: string[]) => Promise<YzjRunResult> } }).yzjBridge = {
      async run(command: string[]): Promise<YzjRunResult> {
        try {
          const json = store.handle(command)
          return { ok: true, exitCode: 0, timedOut: false, stdout: '', stderr: '', json }
        } catch (error) {
          return { ok: false, exitCode: 1, timedOut: false, stdout: '', stderr: String((error as Error).message), json: undefined }
        }
      },
    }
    const service = new YzjAdvanceService(ctx, BUDGET, {}, {}, new ScanCursorStore(), sources)
    const im = await service.sourceAdd('A-1', 'im:g-dsh2')
    expect(im.entryAppended).toBe(false)
    expect(im.sources[0]?.label).toBe('dsh-2')
    expect(store.entries).toHaveLength(0)
    await expect(service.sourceAdd('A-1', 'msg:xx')).rejects.toThrow(/非法来源 token/)
    await expect(service.sourceAdd('A-404', 'doc:d1')).rejects.toThrow(/不存在/)
    await expect(service.sourceRemove('A-1', 'bogus')).rejects.toThrow(/非法来源 token/)
  })

  it('documentThreadEntryInput maps token prefixes to source types', () => {
    const docEntry = documentThreadEntryInput('A-1', 'doc:d1', '纪要')
    expect(docEntry).toMatchObject({ sourceType: '文档', changeType: '备注', refs: ['doc:d1'], actor: 'user' })
    expect(docEntry.summary).toBe('关联来源：纪要')
    expect(documentThreadEntryInput('A-1', 'todo:t1', '待办').sourceType).toBe('待办')
    expect(documentThreadEntryInput('A-1', 'event:e1', '日程').sourceType).toBe('日程')
    expect(documentThreadEntryInput('A-1', 'file:f1', '文件').sourceType).toBe('文档')
  })
})

describe('DreamPoolStore.lookup', () => {
  it('returns entries incl done — dp-* refs on 事元 stay resolvable after distillation', async () => {
    const pool = new DreamPoolStore()
    const a = await pool.enqueue({ channel: 'im:g1', refId: 'm1', content: '群消息', sendTime: '2026-08-20 10:00:00.000' })
    const b = await pool.enqueue({ channel: 'dir:kb1', refId: 'doc1', content: '新文档', sendTime: '2026-08-20 10:01:00.000' })
    await pool.markDone([a.id])
    expect(pool.pending().map(entry => entry.id)).toEqual([b.id])
    const hits = pool.lookup([a.id, b.id, 'dp-missing'])
    expect(hits.map(entry => entry.id)).toEqual([a.id, b.id])
    expect(hits[0]).toMatchObject({ channel: 'im:g1', refId: 'm1', done: true })
  })
})
