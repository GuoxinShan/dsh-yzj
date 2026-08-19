/**
 * AI推进 (advancement) tool family — the event-sourced "推进事项" aggregate
 * described by docs/spec/ai-advance-design.md. One advancement item is a
 * fold of an append-only 事元 (source-unit) stream: every change (goal
 * update, progress, deviation, decision request, stage move) is one entry
 * carrying traceable refs; the item row only caches the projection. The
 * stream is never truncated at the storage layer (hard requirement ②) —
 * only model digests and panel first-screens are windowed.
 *
 * Demo-stage backend: two tables (「事项」/「事元」) inside the same
 * 待办任务库 dbt used by the todo family, so the panel library switcher and
 * team-library semantics apply unchanged. All invariants (stable ids, the
 * six-stage machine, append-only entries, projection folding) live host-side
 * so a native backend can replace the sheet adapter without changing the
 * tool surface.
 */

import { Context, Service } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { JsonValue } from '@deepseek-ai/dsh-tools'
import type { YzjRunResult } from '@dsh-yzj/bridge'
import type {} from '@dsh-yzj/bridge'
import { yzjToolOutput, asRecord, asArray, asString, clipJson, failureDigest } from './shared.ts'
import type { YzjToolBudget } from './shared.ts'
import {
  resolveLibrary, resolveAssignee, normalizeTags, formatTags, normalizeDdl,
  nowStamp, todayStr, parseAssignee,
} from './todo.ts'
import type { TodoBinding, TodoBindingHolder, TodoConfig } from './todo.ts'
import { ScanCursorStore, scanStateOf, type AdvanceScanState, type ScanCursorStoreFace } from './scan-cursors.ts'
import {
  AdvanceThreadStore, parseThreadToken, threadKindOf, sourceTypeOfThread,
} from './advance-threads.ts'
import type { AdvanceThread, AdvanceThreadStoreFace } from './advance-threads.ts'

// ---------------------------------------------------------------------------
// Schema constants (single source of truth for both tables)
// ---------------------------------------------------------------------------

/** Field names of the 「事项」 (advancement item) table. */
export const ITEM_F = {
  id: 'advance_id',
  title: '名称',
  goal: '描述',
  assignee: '负责人',
  targetDate: '目标日期',
  stage: '阶段',
  background: '任务背景',
  metrics: '成功指标',
  tags: '标签',
  latest: '最新动态',
  source: '来源',
} as const

/** Field names of the 「事元」 (source-unit entry) table. */
export const ENTRY_F = {
  id: 'entry_id',
  advanceId: 'advance_id',
  at: '时间',
  sourceType: '来源类型',
  changeType: '变化类型',
  summary: '摘要',
  detail: '变化内容',
  refs: '引用',
  actor: '操作者',
} as const

const ITEM_TABLE = '事项'
const ENTRY_TABLE = '事元'

/** Six-stage machine of one advancement item (PRD §5.1.2). */
export type AdvanceStage = 'draft' | 'running' | 'decision-needed' | 'updated' | 'ready-for-review' | 'completed'

export const ADVANCE_STAGES: readonly AdvanceStage[] = [
  'draft', 'running', 'decision-needed', 'updated', 'ready-for-review', 'completed',
]

/** Legal next stages from each node (same table as {@link checkStageTransition}). */
export const STAGE_NEXT: Record<AdvanceStage, readonly AdvanceStage[]> = {
  draft: ['running'],
  running: ['decision-needed', 'ready-for-review', 'draft'],
  'decision-needed': ['running', 'updated'],
  updated: ['running', 'ready-for-review'],
  'ready-for-review': ['completed', 'running'],
  completed: ['running'],
}

/** 事元 source types (工作现场 provenance). */
export const SOURCE_TYPES = ['对话', '待办', '文档', '会议', '日程', '数据', '人工'] as const

/** 事元 change types (what this entry did to the item). */
export const CHANGE_TYPES = ['目标更新', '进度更新', '偏差', '决策请求', '验收请求', '阶段变化', '备注'] as const

// ---------------------------------------------------------------------------
// Pure helpers (exported for tests)
// ---------------------------------------------------------------------------

export function legalNextStages(from: string): readonly string[] {
  if (!ADVANCE_STAGES.includes(from as AdvanceStage)) return []
  return STAGE_NEXT[from as AdvanceStage]
}

/**
 * Validate a stage transition; returns an error message or null.
 * running is the quiet steady state; decision-needed→updated is the minimal
 * advance loop and may fire repeatedly.
 */
export function checkStageTransition(from: string, to: string): string | null {
  if (from === to) return null
  if (legalNextStages(from).includes(to)) return null
  return `状态机拒绝 ${from} → ${to}：合法流转为 draft→running→(decision-needed→updated)*→ready-for-review→completed；ready-for-review/decision-needed 可打回 running，completed 可重开 running`
}

/** Inspect discipline pasted into every yzj_advance_inspect digest (spec §12). */
export const INSPECT_DISCIPLINE = [
  '纪律：running 无偏差则不要 feed（静默）。已记录事实的复述连事元都不写。',
  '打扰判据（命中任一条才 stageTo=decision-needed）：① 新信号与任务背景的前提矛盾；② 任一成功指标由达标转未达标或朝远离目标移动；③ 按当前速度在目标日期前补不上差距；④ 出现明确阻塞威胁目标日期；⑤ 继续推进须砍范围/加资源/改优先级或越红线；⑥ 两条以上都合理且会改变后续基准的路径分叉。',
  '静默判据：信号与目标一致且指标不变或朝目标移动；纯过程信息（谁在做/做到哪/附了什么产物）。',
  '抑制：同判据已在 decision-needed 未处理则补进现有决策请求、不新起；同一来源（msgId/docId）已喂过则 host 强制去重；被用户 ignore 过的判据除非指标进一步恶化不再提。',
  '偏差成立 → yzj_advance_feed changeType=偏差 stageTo=decision-needed。',
  '产物齐且指标 N/N 达标且无未决偏差 → changeType=验收请求 stageTo=ready-for-review。',
  '确认卡只在改基准（goal/metrics/targetDate/assignee）时出现；纯追加与阶段变化静默落，人在看板队列被找到。',
  '禁止 stageTo=completed；验收通过只由用户在看板点「确认达到目标」。',
  '巡检五步：到点 → yzj_advance_scan(groups=…) → 无新消息则静默结束 → 有新信号则 yzj_advance_inspect → 按打扰判据行动（进度正常静默挂上；命中则 stageTo=decision-needed；禁止 completed）。用户说「开启巡检」时在 root 会话 schedule_create(every_seconds≥300，prompt 含群清单)。',
  '订阅分发：scan digest 的「订阅清单」列出每个 open 事项订阅了哪些线程（groups 缺省时 scan 也按它取流）；分发是你的职责——信号属于哪个事项的线程且语义相关才 feed 给谁，否则不喂。',
  '最小回路：核心变量对比（原来的理解 vs 现在的约束）→ 建议（AI建议+备选+自定义）→ 用户选择 → 复述影响 → 确认后才 feed。',
].join('\n')

/** One inspect subject: item projection + recent 事元 window. */
export interface InspectSubject {
  readonly item: YzjAdvanceItem
  readonly recent: readonly YzjAdvanceEntry[]
}

/**
 * Model-facing inspect digest. Host does not judge semantics (spec §12 / 决策 11).
 */
export function buildInspectDigest(args: {
  subjects: readonly InspectSubject[]
  signals: string
  mode: 'compare' | 'review'
}): string {
  const head = args.mode === 'review'
    ? '验收辅助材料（对照成功指标给一句话结论，不要自动过）'
    : '比对材料（核心变量：原来的理解 vs 新信号）'
  if (args.subjects.length === 0) {
    return [head, '没有 open 推进事项。无偏差，静默。', INSPECT_DISCIPLINE].join('\n')
  }
  const signal = args.signals.trim() === ''
    ? '新信号：（无，巡检请先拉近期群消息/纪要再比对）'
    : `新信号：${args.signals.trim()}`
  const blocks = args.subjects.map(({ item, recent }) => {
    const next = legalNextStages(item.stage).join(' / ') || '（无）'
    const rec = recent.length === 0
      ? '（暂无事元）'
      : recent.map(entry => `${entry.at} ${entry.changeType} ${entry.summary}`).join('\n  ')
    return [
      `${item.advanceId} · ${item.title} [${item.stage}]`,
      item.goal === '' ? '目标：（空）' : `目标：${item.goal}`,
      item.background === '' ? '背景（原来的理解）：（空）' : `背景（原来的理解）：${item.background}`,
      item.metrics === '' ? '成功指标：（空）' : `成功指标：${item.metrics.split('\n').join('；')}`,
      `合法下一阶段：${next}`,
      `最近事元：\n  ${rec}`,
    ].join('\n')
  })
  return [head, signal, ...blocks, INSPECT_DISCIPLINE].join('\n---\n')
}

/** Max groups one scan call accepts (spec §14 / 决策 17). */
export const MAX_SCAN_GROUPS = 8

/** Self or robot sender — skip to avoid self-reinforcing the patrol. */
export function isSkippableSender(fromOpenId: string, selfOpenId: string): boolean {
  if (fromOpenId === '') return false
  if (selfOpenId !== '' && fromOpenId === selfOpenId) return true
  return fromOpenId.startsWith('BOT-')
}

/** True when any incoming ref is already on the item's stream (决策 19). */
export function refsOverlap(incoming: readonly string[], existing: readonly string[]): boolean {
  if (incoming.length === 0) return false
  const have = new Set(existing.filter(token => token !== ''))
  return incoming.some(token => token !== '' && have.has(token))
}

/** One IM signal surfaced by a scan. */
export interface ScanSignal {
  readonly groupId: string
  readonly groupName: string
  readonly msgId: string
  readonly fromOpenId: string
  readonly content: string
  readonly sendTime: string
}

/** One group's scan outcome. */
export interface ScanGroupResult {
  readonly groupId: string
  readonly groupName: string
  readonly baseline: boolean
  readonly newCount: number
  readonly error?: string
}

/** One item's subscription row in the scan digest (spec §15.3 分发面). */
export interface AdvanceSubscription {
  readonly advanceId: string
  readonly title: string
  readonly stage: string
  readonly tokens: readonly string[]
}

/** Result of {@link coreScanAdvance}. */
export interface AdvanceScanResult {
  readonly signals: readonly ScanSignal[]
  readonly groups: readonly ScanGroupResult[]
  readonly openItems: readonly { advanceId: string; title: string; stage: string }[]
  readonly subscriptions: readonly AdvanceSubscription[]
}

function imMessageLine(signal: ScanSignal): string {
  const time = signal.sendTime.length >= 16 ? signal.sendTime.slice(5, 16) : signal.sendTime
  const who = signal.fromOpenId === '' ? '(unknown)' : signal.fromOpenId
  const body = signal.content === '' ? '(message)' : signal.content.replace(/\s+/g, ' ').slice(0, 80)
  return `[${time}] ${signal.groupName} ${who} ${body} <${signal.msgId}>`
}

/** Model-facing scan digest (spec §14.2). */
export function buildScanDigest(result: AdvanceScanResult): string {
  const groupLines = result.groups.map((group) => {
    if (group.error !== undefined) return `${group.groupName}（${group.groupId}）：${group.error}`
    if (group.baseline) return `${group.groupName}：基线已立（不回灌历史）`
    if (group.newCount === 0) return `${group.groupName}：无新消息，静默`
    return `${group.groupName}：${group.newCount} 条新信号`
  })
  const signalLines = result.signals.length === 0
    ? ['新信号：（无）']
    : ['新信号：', ...result.signals.map(imMessageLine)]
  const items = result.openItems.length === 0
    ? 'open 事项：（无）'
    : `open 事项：${result.openItems.map(item => `${item.advanceId} · ${item.title} [${item.stage}]`).join('；')}`
  const subscriptionLines = result.subscriptions.length === 0
    ? []
    : [
        '订阅清单（分发按线程 + 语义相关）：',
        ...result.subscriptions.map(row =>
          `${row.advanceId} · ${row.title} [${row.stage}] → ${row.tokens.length === 0 ? '（无线程）' : row.tokens.join('，')}`),
      ]
  const next = result.signals.length === 0
    ? '下一步：静默结束本轮。'
    : '下一步：把新信号交给 yzj_advance_inspect（signals=上列），再按纪律决定是否 feed。'
  return ['巡检扫描', ...groupLines, ...signalLines, items, ...subscriptionLines, next, INSPECT_DISCIPLINE].join('\n')
}

function parseImMessage(record: unknown): { msgId: string; fromOpenId: string; content: string; sendTime: string } {
  const message = asRecord(record)
  const fromUser = asRecord(message.fromUser)
  return {
    msgId: asString(message.msgId ?? message.id),
    fromOpenId: asString(message.fromOpenId ?? fromUser.openId ?? fromUser.oId),
    content: asString(message.content),
    sendTime: asString(message.sendTime),
  }
}

async function whoamiOpenId(ctx: Context, budget: YzjToolBudget): Promise<string> {
  const ran = await runJson(ctx, budget, 'contact user get', ['contact', 'user', 'get'])
  if (!ran.ok) return ''
  const root = asRecord(ran.json)
  const list = asArray(root.list)
  const first = list.length > 0 ? asRecord(list[0]) : root
  return asString(first.openId ?? first.oId)
}

async function listRecentGroups(ctx: Context, budget: YzjToolBudget): Promise<{ groupId: string; groupName: string }[]> {
  const out: { groupId: string; groupName: string }[] = []
  for (const page of [1, 2, 3]) {
    const ran = await runJson(ctx, budget, 'im group recent', [
      'im', 'group', 'recent', '--limit', '20', '--page', String(page),
    ])
    if (!ran.ok) break
    const payload = asRecord(ran.json)
    const rows = asArray(payload.list)
    for (const row of rows) {
      const group = asRecord(row)
      const groupId = asString(group.groupId)
      if (groupId === '') continue
      out.push({ groupId, groupName: asString(group.groupName) || groupId })
    }
    if (payload.more !== true || rows.length === 0) break
  }
  return out
}

function resolveGroupToken(
  token: string,
  catalog: readonly { groupId: string; groupName: string }[],
): { groupId: string; groupName: string } | undefined {
  const trimmed = token.trim()
  if (trimmed === '') return undefined
  const exactId = catalog.find(row => row.groupId === trimmed)
  if (exactId !== undefined) return exactId
  const exactName = catalog.filter(row => row.groupName === trimmed)
  if (exactName.length === 1) return exactName[0]
  const partial = catalog.filter(row => row.groupName.includes(trimmed))
  if (partial.length === 1) return partial[0]
  return undefined
}

async function listImMessages(
  ctx: Context,
  budget: YzjToolBudget,
  groupId: string,
  type: 'newest' | 'new',
  msgId: string | undefined,
  limit: number,
): Promise<unknown[]> {
  const command = ['im', 'message', 'list', '--group-id', groupId, '--type', type, '--limit', String(limit)]
  if (msgId !== undefined) command.push('--msg-id', msgId)
  const ran = await runJson(ctx, budget, 'im message list', command)
  if (!ran.ok) throw new Error(ran.content)
  return asArray(asRecord(ran.json).list)
}

function newestMsgId(rows: readonly { msgId: string; sendTime: string }[]): string {
  let best = ''
  let bestTime = ''
  for (const row of rows) {
    if (row.msgId === '') continue
    if (best === '' || row.sendTime >= bestTime) {
      best = row.msgId
      bestTime = row.sendTime
    }
  }
  return best
}

/**
 * Incremental IM scan for the patrol loop (spec §14). First visit of a
 * group records a baseline cursor and returns no signals; later visits
 * return messages after the cursor, minus self/robot.
 */
export async function coreScanAdvance(
  ctx: Context,
  budget: YzjToolBudget,
  config: TodoConfig,
  caches: AdvanceCaches,
  cursors: ScanCursorStoreFace,
  groups: readonly string[],
  limit = 20,
  holder?: TodoBindingHolder,
  threads?: AdvanceThreadStoreFace,
): Promise<AdvanceScanResult> {
  // groups omitted → aggregate the `im:` threads of every open item (spec
  // §15.3): one fetch per channel, the channel-level cursor advances once
  // no matter how many items subscribe (决策 18/21).
  let effective = groups
  let preItems: { advanceId: string; title: string; stage: string }[] | undefined
  if (effective.length === 0) {
    if (threads === undefined) throw new Error('advance scan: groups must not be empty (no thread registry)')
    const binding = await resolveAdvance(ctx, budget, config, caches, false, holder)
    const items = await fetchItems(ctx, budget, binding)
    preItems = items.filter(item => item.stage !== 'completed').map(item => ({
      advanceId: item.advanceId, title: item.title, stage: item.stage,
    }))
    const openIds = new Set(preItems.map(item => item.advanceId))
    const channelIds = new Set<string>()
    for (const [advanceId, rows] of threads.entries()) {
      if (!openIds.has(advanceId)) continue
      for (const row of rows) {
        const parsed = parseThreadToken(row.token)
        if (parsed !== undefined && parsed.prefix === 'im') channelIds.add(parsed.id)
      }
    }
    if (channelIds.size === 0) {
      throw new Error('advance scan: 没有 open 事项订阅 im: 渠道；先在面板「关联渠道」或 create threads 挂群')
    }
    if (channelIds.size > MAX_SCAN_GROUPS) {
      throw new Error(`advance scan: 订阅渠道 ${channelIds.size} 个超过上限 ${MAX_SCAN_GROUPS}（决策 17）；请按事项分批传 groups`)
    }
    effective = [...channelIds]
  }
  if (effective.length > MAX_SCAN_GROUPS) throw new Error(`advance scan: at most ${MAX_SCAN_GROUPS} groups`)
  const pageSize = !Number.isInteger(limit) || limit < 1 || limit > 20 ? 20 : limit
  const selfOpenId = await whoamiOpenId(ctx, budget)
  const catalog = await listRecentGroups(ctx, budget)
  const signals: ScanSignal[] = []
  const groupResults: ScanGroupResult[] = []
  const now = Date.now()
  for (const token of effective) {
    const resolved = resolveGroupToken(token, catalog)
    if (resolved === undefined) {
      groupResults.push({
        groupId: token, groupName: token, baseline: false, newCount: 0,
        error: `找不到群「${token}」；用 yzj_im_group_recent 核对 id/名`,
      })
      continue
    }
    const prior = cursors.get(resolved.groupId)
    try {
      if (prior === undefined) {
        const rows = (await listImMessages(ctx, budget, resolved.groupId, 'newest', undefined, pageSize)).map(parseImMessage)
        const lastMsgId = newestMsgId(rows)
        if (lastMsgId !== '') {
          await cursors.put(resolved.groupId, { lastMsgId, scannedAt: now, groupName: resolved.groupName })
        }
        groupResults.push({ groupId: resolved.groupId, groupName: resolved.groupName, baseline: true, newCount: 0 })
        continue
      }
      const rows = (await listImMessages(ctx, budget, resolved.groupId, 'new', prior.lastMsgId, pageSize)).map(parseImMessage)
      const fresh = rows.filter(row => row.msgId !== '' && row.msgId !== prior.lastMsgId)
      const lastMsgId = newestMsgId(fresh) || prior.lastMsgId
      const accepted = fresh.filter(row => !isSkippableSender(row.fromOpenId, selfOpenId))
      for (const row of accepted) {
        signals.push({
          groupId: resolved.groupId,
          groupName: resolved.groupName,
          msgId: row.msgId,
          fromOpenId: row.fromOpenId,
          content: row.content,
          sendTime: row.sendTime,
        })
      }
      await cursors.put(resolved.groupId, { lastMsgId, scannedAt: now, groupName: resolved.groupName })
      groupResults.push({
        groupId: resolved.groupId, groupName: resolved.groupName, baseline: false, newCount: accepted.length,
      })
    } catch (error) {
      groupResults.push({
        groupId: resolved.groupId, groupName: resolved.groupName, baseline: false, newCount: 0,
        error: String((error as Error).message),
      })
    }
  }
  await cursors.recordPatrol(signals.length, now)
  let openItems: { advanceId: string; title: string; stage: string }[]
  if (preItems !== undefined) {
    openItems = preItems
  } else {
    openItems = []
    try {
      const binding = await resolveAdvance(ctx, budget, config, caches, false, holder)
      const items = await fetchItems(ctx, budget, binding)
      openItems = items.filter(item => item.stage !== 'completed').map(item => ({
        advanceId: item.advanceId, title: item.title, stage: item.stage,
      }))
    } catch {
      openItems = []
    }
  }
  const subscriptions: AdvanceSubscription[] = threads === undefined
    ? []
    : openItems.map(item => ({
        advanceId: item.advanceId,
        title: item.title,
        stage: item.stage,
        tokens: threads.threadsOf(item.advanceId).map(row => row.token),
      }))
  return { signals, groups: groupResults, openItems, subscriptions }
}

/** Timeline tone of one entry (PRD §5.3.4: 蓝=推进 绿=达标 红=偏差决策). */
export function toneOf(changeType: string, detail: string): 'blue' | 'green' | 'red' {
  if (changeType === '偏差' || changeType === '决策请求') return 'red'
  if (changeType === '验收请求') return 'green'
  if (changeType === '阶段变化') {
    if (/→\s*completed/.test(detail)) return 'green'
    if (/→\s*decision-needed/.test(detail)) return 'red'
  }
  return 'blue'
}

/** Next sequential id with a day prefix (`A-YYYYMMDD-NNN` / `E-YYYYMMDD-NNN`). */
export function nextSequentialId(prefixLetter: 'A' | 'E', existingIds: readonly string[], now = new Date()): string {
  const day = todayStr(now).replace(/\//g, '')
  const prefix = `${prefixLetter}-${day}-`
  let max = 0
  for (const id of existingIds) {
    if (!id.startsWith(prefix)) continue
    const n = Number.parseInt(id.slice(prefix.length), 10)
    if (Number.isInteger(n) && n > max) max = n
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`
}

/** One parsed advancement item (projection row). */
export interface YzjAdvanceItem {
  recordId: string
  advanceId: string
  title: string
  goal: string
  assignee: string
  assigneeOpenId: string
  targetDate: string
  stage: AdvanceStage
  background: string
  metrics: string
  tags: string[]
  latest: string
}

/** One parsed 事元 entry (append-only stream row). */
export interface YzjAdvanceEntry {
  recordId: string
  entryId: string
  advanceId: string
  at: string
  sourceType: string
  changeType: string
  summary: string
  detail: string
  refs: string[]
  actor: string
  tone: 'blue' | 'green' | 'red'
}

/** Fields object from a CLI record row (fields may be a JSON string). */
function fieldsOf(record: unknown): Record<string, unknown> | null {
  const row = asRecord(record)
  const raw = row.fieldsValue ?? row.fields ?? row.values
  if (typeof raw === 'string') {
    try {
      return asRecord(JSON.parse(raw))
    } catch {
      return null
    }
  }
  return asRecord(raw)
}

/** Parse one CLI record into an item; null when unusable. */
export function parseAdvanceItem(record: unknown): YzjAdvanceItem | null {
  const fields = fieldsOf(record)
  if (fields === null) return null
  const advanceId = asString(fields[ITEM_F.id])
  if (advanceId === '') return null
  const stage = asString(fields[ITEM_F.stage])
  const parsed = parseAssignee(asString(fields[ITEM_F.assignee]))
  return {
    recordId: asString(asRecord(record).id ?? asRecord(record).recordId),
    advanceId,
    title: asString(fields[ITEM_F.title]),
    goal: asString(fields[ITEM_F.goal]),
    assignee: parsed.name,
    assigneeOpenId: parsed.openId,
    targetDate: normalizeDdl(asString(fields[ITEM_F.targetDate])),
    stage: (ADVANCE_STAGES.includes(stage as AdvanceStage) ? stage : 'draft') as AdvanceStage,
    background: asString(fields[ITEM_F.background]),
    metrics: asString(fields[ITEM_F.metrics]),
    tags: normalizeTags(asString(fields[ITEM_F.tags])),
    latest: asString(fields[ITEM_F.latest]),
  }
}

/** Parse one CLI record into an entry; null when unusable. */
export function parseAdvanceEntry(record: unknown): YzjAdvanceEntry | null {
  const fields = fieldsOf(record)
  if (fields === null) return null
  const entryId = asString(fields[ENTRY_F.id])
  if (entryId === '') return null
  const changeType = asString(fields[ENTRY_F.changeType])
  const detail = asString(fields[ENTRY_F.detail])
  return {
    recordId: asString(asRecord(record).id ?? asRecord(record).recordId),
    entryId,
    advanceId: asString(fields[ENTRY_F.advanceId]),
    at: asString(fields[ENTRY_F.at]),
    sourceType: asString(fields[ENTRY_F.sourceType]),
    changeType,
    summary: asString(fields[ENTRY_F.summary]),
    detail,
    refs: asString(fields[ENTRY_F.refs]).split(/\s+/).filter(token => token !== ''),
    actor: asString(fields[ENTRY_F.actor]),
    tone: toneOf(changeType, detail),
  }
}

/** Success-metric lines parsed for the panel (`指标名: 当前 / 目标`). */
export function parseMetrics(metrics: string): { name: string; current: string; target: string }[] {
  const out: { name: string; current: string; target: string }[] = []
  for (const line of metrics.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '') continue
    const colon = trimmed.match(/^([^:：]+)[:：]\s*(.*)$/)
    if (colon === null) {
      out.push({ name: trimmed, current: '', target: '' })
      continue
    }
    const rest = colon[2] ?? ''
    const slash = rest.split('/')
    out.push({
      name: (colon[1] ?? '').trim(),
      current: (slash[0] ?? '').trim(),
      target: slash.length > 1 ? slash.slice(1).join('/').trim() : '',
    })
  }
  return out
}

/** One aggregated information source (PRD §5.3.3), derived from the stream. */
export interface YzjAdvanceSource {
  sourceType: string
  label: string
  ref: string
  at: string
  status: '已确认' | '已读取' | '未达标' | '等待中'
}

/**
 * Fold the stream into the information-sources panel: one row per distinct
 * ref (or per source-type+summary when unreferenced), status from the latest
 * entry — a stage-①  heuristic that the phase-③ AI judgement will replace.
 */
export function aggregateSources(entries: readonly YzjAdvanceEntry[]): YzjAdvanceSource[] {
  const byKey = new Map<string, YzjAdvanceSource>()
  for (const entry of entries) {
    const key = entry.refs[0] ?? `${entry.sourceType}:${entry.summary}`
    const status: YzjAdvanceSource['status'] = entry.changeType === '决策请求' ? '等待中'
      : entry.changeType === '偏差' ? '未达标'
      : entry.actor === 'user' ? '已确认'
      : '已读取'
    byKey.set(key, {
      sourceType: entry.sourceType,
      label: entry.summary,
      ref: entry.refs[0] ?? '',
      at: entry.at,
      status,
    })
  }
  return [...byKey.values()]
}

/** One `yzj_advance_list` digest line. */
function itemLine(item: YzjAdvanceItem): string {
  const parts: string[] = [item.advanceId, item.title, `[${item.stage}]`]
  if (item.targetDate !== '') parts.push(`目标 ${item.targetDate}`)
  if (item.assignee !== '') parts.push(`@${item.assignee}`)
  if (item.tags.length > 0) parts.push(formatTags(item.tags))
  if (item.latest !== '') parts.push(item.latest)
  return parts.join(' · ')
}

/** One timeline digest line. */
function entryLine(entry: YzjAdvanceEntry): string {
  const parts: string[] = [entry.at, `[${entry.changeType}]`, entry.summary]
  if (entry.detail !== '') parts.push(entry.detail.split('\n').join('；'))
  if (entry.refs.length > 0) parts.push(`引用 ${entry.refs.join(' ')}`)
  return parts.join(' · ')
}

// ---------------------------------------------------------------------------
// Bridge + binding
// ---------------------------------------------------------------------------

/** Both provisioned tables inside the active 待办任务库 doc. */
export interface AdvanceBinding {
  docId: string
  itemTableId: number
  entryTableId: number
  link: string
}

/** Caches shared per owner (tools closure / service instance). */
export interface AdvanceCaches {
  lib: { binding?: TodoBinding }
  adv: { binding?: AdvanceBinding }
}

async function runJson(
  ctx: Context,
  budget: YzjToolBudget,
  label: string,
  command: readonly string[],
): Promise<{ ok: true; json: unknown } | { ok: false; content: string }> {
  const result: YzjRunResult = await ctx.yzjBridge.run(command, { timeoutMs: budget.timeoutMs })
  if (!result.ok) return { ok: false, content: failureDigest(label, result, budget.maxRenderChars).content }
  return { ok: true, json: result.json }
}

function cliRecords(json: unknown): unknown[] {
  const root = asRecord(json)
  const records = asArray(root.records)
  return records.length > 0 ? records : asArray(json)
}

/** Table-provision field definitions (SingleSelect options pre-registered). */
function itemFieldsJson(): string {
  return JSON.stringify([
    { name: ITEM_F.id, type: 'MultiLineText' },
    { name: ITEM_F.title, type: 'MultiLineText' },
    { name: ITEM_F.goal, type: 'MultiLineText' },
    { name: ITEM_F.assignee, type: 'MultiLineText' },
    { name: ITEM_F.targetDate, type: 'Date' },
    { name: ITEM_F.stage, type: 'SingleSelect', data: { items: ADVANCE_STAGES.map(value => ({ value })) } },
    { name: ITEM_F.background, type: 'MultiLineText' },
    { name: ITEM_F.metrics, type: 'MultiLineText' },
    { name: ITEM_F.tags, type: 'MultiLineText' },
    { name: ITEM_F.latest, type: 'MultiLineText' },
    { name: ITEM_F.source, type: 'Url' },
  ])
}

function entryFieldsJson(): string {
  return JSON.stringify([
    { name: ENTRY_F.id, type: 'MultiLineText' },
    { name: ENTRY_F.advanceId, type: 'MultiLineText' },
    { name: ENTRY_F.at, type: 'MultiLineText' },
    { name: ENTRY_F.sourceType, type: 'SingleSelect', data: { items: SOURCE_TYPES.map(value => ({ value })) } },
    { name: ENTRY_F.changeType, type: 'SingleSelect', data: { items: CHANGE_TYPES.map(value => ({ value })) } },
    { name: ENTRY_F.summary, type: 'MultiLineText' },
    { name: ENTRY_F.detail, type: 'MultiLineText' },
    { name: ENTRY_F.refs, type: 'MultiLineText' },
    { name: ENTRY_F.actor, type: 'MultiLineText' },
  ])
}

/** Locate both tables inside a doc; undefined when either is missing. */
async function advanceTablesOf(
  ctx: Context,
  budget: YzjToolBudget,
  docId: string,
): Promise<AdvanceBinding | undefined> {
  const ran = await runJson(ctx, budget, 'sheet get', ['sheet', 'get', '--id', docId])
  if (!ran.ok) return undefined
  let itemTableId: number | undefined
  let entryTableId: number | undefined
  for (const table of asArray(asRecord(ran.json).sheets)) {
    const row = asRecord(table)
    const tableId = row.id
    if (typeof tableId !== 'number') continue
    const names = asArray(row.fields).map(field => asString(asRecord(field).name))
    if (names.includes(ENTRY_F.id)) entryTableId = tableId
    else if (names.includes(ITEM_F.id) && names.includes(ITEM_F.stage)) itemTableId = tableId
  }
  if (itemTableId === undefined || entryTableId === undefined) return undefined
  return {
    docId,
    itemTableId,
    entryTableId,
    link: `https://www.yunzhijia.com/knowledge/lingee/#/store/doc/${docId}`,
  }
}

/** Provision whichever of the two tables is missing inside the doc. */
async function provisionAdvanceTables(
  ctx: Context,
  budget: YzjToolBudget,
  docId: string,
): Promise<AdvanceBinding> {
  const probe = await runJson(ctx, budget, 'sheet get', ['sheet', 'get', '--id', docId])
  const names = new Set<string>()
  if (probe.ok) {
    for (const table of asArray(asRecord(probe.json).sheets)) {
      for (const field of asArray(asRecord(table).fields)) {
        names.add(asString(asRecord(field).name))
      }
    }
  }
  if (!names.has(ITEM_F.stage) || !names.has(ITEM_F.id)) {
    const ran = await runJson(ctx, budget, 'sheet table create', [
      'sheet', 'table', 'create', '--id', docId, '--name', ITEM_TABLE,
      '--fields', itemFieldsJson(), '--views', JSON.stringify([{ name: '全部', type: 'Grid' }]),
    ])
    if (!ran.ok) throw new Error(ran.content)
  }
  if (!names.has(ENTRY_F.id)) {
    const ran = await runJson(ctx, budget, 'sheet table create', [
      'sheet', 'table', 'create', '--id', docId, '--name', ENTRY_TABLE,
      '--fields', entryFieldsJson(), '--views', JSON.stringify([{ name: '全部', type: 'Grid' }]),
    ])
    if (!ran.ok) throw new Error(ran.content)
  }
  const binding = await advanceTablesOf(ctx, budget, docId)
  if (binding === undefined) throw new Error(`advance: 推进双表创建后未在 ${docId} 中找齐 ${ITEM_F.id}/${ENTRY_F.id} 字段`)
  return binding
}

/**
 * Resolve the advancement binding: the active 待办任务库 doc (panel override
 * → config → discovery, via the todo resolver) plus the two advance tables
 * inside it (provisioned on demand). A cached binding is dropped when the
 * active library doc changed (library switcher follow).
 */
export async function resolveAdvance(
  ctx: Context,
  budget: YzjToolBudget,
  config: TodoConfig,
  caches: AdvanceCaches,
  allowProvision: boolean,
  holder?: TodoBindingHolder,
): Promise<AdvanceBinding> {
  if (holder?.override !== undefined && caches.adv.binding !== undefined
    && caches.adv.binding.docId !== holder.override.docId) {
    delete caches.adv.binding
    delete caches.lib.binding
  }
  let library: TodoBinding
  try {
    library = await resolveLibrary(ctx, budget, config, caches.lib, allowProvision, holder)
  } catch (error) {
    if (allowProvision) throw error
    throw new Error(`advance: 推进看板尚未开通（依赖待办任务库）：${String((error as Error).message)}`)
  }
  if (caches.adv.binding !== undefined && caches.adv.binding.docId === library.docId) {
    return caches.adv.binding
  }
  const found = await advanceTablesOf(ctx, budget, library.docId)
  if (found !== undefined) {
    caches.adv.binding = found
    return found
  }
  if (!allowProvision) {
    throw new Error('advance: 推进看板尚未开通；发起第一个推进事项（yzj_advance_create）即可自动开通事项/事元双表')
  }
  const provisioned = await provisionAdvanceTables(ctx, budget, library.docId)
  caches.adv.binding = provisioned
  return provisioned
}

/** Fetch every item (paged, demo scale). */
export async function fetchItems(
  ctx: Context,
  budget: YzjToolBudget,
  binding: AdvanceBinding,
): Promise<YzjAdvanceItem[]> {
  const items: YzjAdvanceItem[] = []
  let pageToken: string | undefined
  for (let page = 0; page < 3; page += 1) {
    const command = ['sheet', 'record', 'list', '--id', binding.docId, '--table-id', String(binding.itemTableId), '--limit', '100']
    if (pageToken !== undefined) command.push('--page-token', pageToken)
    const ran = await runJson(ctx, budget, 'sheet record list', command)
    if (!ran.ok) throw new Error(ran.content)
    for (const record of cliRecords(ran.json)) {
      const item = parseAdvanceItem(record)
      if (item !== null) items.push(item)
    }
    pageToken = asString(asRecord(ran.json).page_token ?? asRecord(ran.json).next_page_token)
    if (pageToken === '') break
  }
  return items
}

/** Fetch one item by advance_id; undefined when absent. */
export async function fetchItemById(
  ctx: Context,
  budget: YzjToolBudget,
  binding: AdvanceBinding,
  advanceId: string,
): Promise<YzjAdvanceItem | undefined> {
  const filter = JSON.stringify({ mode: 'AND', criteria: [{ field: ITEM_F.id, operator: 'Equals', values: [advanceId] }] })
  const ran = await runJson(ctx, budget, 'sheet record list', [
    'sheet', 'record', 'list', '--id', binding.docId, '--table-id', String(binding.itemTableId), '--filter', filter,
  ])
  if (!ran.ok) throw new Error(ran.content)
  for (const record of cliRecords(ran.json)) {
    const item = parseAdvanceItem(record)
    if (item !== null) return item
  }
  return undefined
}

/**
 * Fetch the FULL entry stream of one item, oldest first (entry ids are
 * day-sequential, so at+entryId sorts stably). Storage-side the stream is
 * complete; callers window it for digests/first screens only.
 */
export async function fetchEntries(
  ctx: Context,
  budget: YzjToolBudget,
  binding: AdvanceBinding,
  advanceId: string,
): Promise<YzjAdvanceEntry[]> {
  const filter = JSON.stringify({ mode: 'AND', criteria: [{ field: ENTRY_F.advanceId, operator: 'Equals', values: [advanceId] }] })
  const entries: YzjAdvanceEntry[] = []
  let pageToken: string | undefined
  for (let page = 0; page < 5; page += 1) {
    const command = ['sheet', 'record', 'list', '--id', binding.docId, '--table-id', String(binding.entryTableId), '--filter', filter, '--limit', '100']
    if (pageToken !== undefined) command.push('--page-token', pageToken)
    const ran = await runJson(ctx, budget, 'sheet record list', command)
    if (!ran.ok) throw new Error(ran.content)
    for (const record of cliRecords(ran.json)) {
      const entry = parseAdvanceEntry(record)
      if (entry !== null) entries.push(entry)
    }
    pageToken = asString(asRecord(ran.json).page_token ?? asRecord(ran.json).next_page_token)
    if (pageToken === '') break
  }
  return entries.sort((a, b) => (a.at === b.at ? (a.entryId < b.entryId ? -1 : 1) : (a.at < b.at ? -1 : 1)))
}

/** Today's entry ids (Contains filter on the day prefix) for id generation. */
async function todaysEntryIds(
  ctx: Context,
  budget: YzjToolBudget,
  binding: AdvanceBinding,
): Promise<string[]> {
  const day = todayStr().replace(/\//g, '')
  const filter = JSON.stringify({ mode: 'AND', criteria: [{ field: ENTRY_F.id, operator: 'Contains', values: [`E-${day}-`] }] })
  const ran = await runJson(ctx, budget, 'sheet record list', [
    'sheet', 'record', 'list', '--id', binding.docId, '--table-id', String(binding.entryTableId), '--filter', filter, '--limit', '100',
  ])
  if (!ran.ok) throw new Error(ran.content)
  return cliRecords(ran.json).map(record => parseAdvanceEntry(record)?.entryId ?? '').filter(id => id !== '')
}

async function writeTable(
  ctx: Context,
  budget: YzjToolBudget,
  binding: AdvanceBinding,
  tableId: number,
  kind: 'create' | 'update',
  records: string,
): Promise<unknown> {
  const command = ['sheet', 'record', kind, '--id', binding.docId, '--table-id', String(tableId), '--records', records]
  const ran = await runJson(ctx, budget, `sheet record ${kind}`, command)
  if (!ran.ok) throw new Error(ran.content)
  return ran.json
}

// ---------------------------------------------------------------------------
// Core operations shared by the tools and the yzjAdvance service
// ---------------------------------------------------------------------------

/** Input for creating one advancement item. */
export interface AdvanceCreateInput {
  title: string
  advanceId?: string | undefined
  goal?: string | undefined
  background?: string | undefined
  metrics?: string | undefined
  assignee?: string | undefined
  targetDate?: string | undefined
  tags?: readonly string[] | undefined
  refs?: readonly string[] | undefined
  sourceType?: string | undefined
  actor?: string | undefined
  /** Intent threads attached at 立项 (线程① is the founding group, spec §15). */
  threads?: readonly string[] | undefined
}

/** Input for feeding one 事元 into an item. */
export interface AdvanceFeedInput {
  advanceId: string
  summary: string
  sourceType?: string | undefined
  changeType?: string | undefined
  detail?: string | undefined
  refs?: readonly string[] | undefined
  stageTo?: string | undefined
  goal?: string | undefined
  metrics?: string | undefined
  targetDate?: string | undefined
  assignee?: string | undefined
  actor?: string | undefined
}

/** Append one entry row + refresh the item's 最新动态 projection cache. */
async function appendEntry(
  ctx: Context,
  budget: YzjToolBudget,
  binding: AdvanceBinding,
  input: {
    advanceId: string
    sourceType: string
    changeType: string
    summary: string
    detail: string
    refs: readonly string[]
    actor: string
  },
): Promise<YzjAdvanceEntry> {
  const entryId = nextSequentialId('E', await todaysEntryIds(ctx, budget, binding))
  const at = nowStamp()
  const fields: Record<string, unknown> = {
    [ENTRY_F.id]: entryId,
    [ENTRY_F.advanceId]: input.advanceId,
    [ENTRY_F.at]: at,
    [ENTRY_F.sourceType]: SOURCE_TYPES.includes(input.sourceType as typeof SOURCE_TYPES[number]) ? input.sourceType : '人工',
    [ENTRY_F.changeType]: CHANGE_TYPES.includes(input.changeType as typeof CHANGE_TYPES[number]) ? input.changeType : '备注',
    [ENTRY_F.summary]: input.summary,
    [ENTRY_F.actor]: input.actor,
  }
  if (input.detail !== '') fields[ENTRY_F.detail] = input.detail
  if (input.refs.length > 0) fields[ENTRY_F.refs] = input.refs.join(' ')
  await writeTable(ctx, budget, binding, binding.entryTableId, 'create', JSON.stringify([{ fieldsValue: fields }]))
  return {
    recordId: '',
    entryId,
    advanceId: input.advanceId,
    at,
    sourceType: asString(fields[ENTRY_F.sourceType]),
    changeType: asString(fields[ENTRY_F.changeType]),
    summary: input.summary,
    detail: input.detail,
    refs: [...input.refs],
    actor: input.actor,
    tone: toneOf(asString(fields[ENTRY_F.changeType]), input.detail),
  }
}

/** Result of a core create. */
export interface AdvanceCreateResult {
  item: YzjAdvanceItem
  entry: YzjAdvanceEntry | null
  idempotent: boolean
  assigneeNote: string
  binding: AdvanceBinding
}

/** Create one advancement item (idempotent on explicit advanceId) + its 立项 entry. */
export async function coreCreateAdvance(
  ctx: Context,
  budget: YzjToolBudget,
  config: TodoConfig,
  caches: AdvanceCaches,
  input: AdvanceCreateInput,
  holder?: TodoBindingHolder,
  threads?: AdvanceThreadStoreFace,
): Promise<AdvanceCreateResult> {
  const title = input.title.trim()
  if (title === '') throw new Error('advance: title must not be empty')
  const binding = await resolveAdvance(ctx, budget, config, caches, true, holder)
  if (input.advanceId !== undefined) {
    const existing = await fetchItemById(ctx, budget, binding, input.advanceId)
    if (existing !== undefined) return { item: existing, entry: null, idempotent: true, assigneeNote: '', binding }
  }
  const items = await fetchItems(ctx, budget, binding)
  const advanceId = input.advanceId ?? nextSequentialId('A', items.map(item => item.advanceId))
  if (items.some(item => item.advanceId === advanceId)) {
    throw new Error(`advance: 生成的 advance_id ${advanceId} 已冲突，请显式传入 advanceId`)
  }
  const fields: Record<string, unknown> = {
    [ITEM_F.id]: advanceId,
    [ITEM_F.title]: title,
    [ITEM_F.stage]: 'draft',
  }
  let assigneeNote = ''
  if (input.assignee !== undefined && input.assignee.trim() !== '') {
    const resolved = await resolveAssignee(ctx, budget, input.assignee)
    fields[ITEM_F.assignee] = resolved.value
    if (!resolved.resolved) assigneeNote = `（负责人 "${input.assignee}" 未能唯一解析，已按姓名保存）`
  }
  if (input.goal !== undefined && input.goal.trim() !== '') fields[ITEM_F.goal] = input.goal.trim()
  if (input.background !== undefined && input.background.trim() !== '') fields[ITEM_F.background] = input.background.trim()
  if (input.metrics !== undefined && input.metrics.trim() !== '') fields[ITEM_F.metrics] = input.metrics.trim()
  if (input.targetDate !== undefined && input.targetDate.trim() !== '') fields[ITEM_F.targetDate] = normalizeDdl(input.targetDate)
  const tags = normalizeTags(input.tags)
  if (tags.length > 0) fields[ITEM_F.tags] = formatTags(tags)
  const summary = `立项：${title}`
  fields[ITEM_F.latest] = `${nowStamp()} 备注 ${summary}`
  const wrote = await writeTable(ctx, budget, binding, binding.itemTableId, 'create', JSON.stringify([{ fieldsValue: fields }]))
  const created = cliRecords(wrote).map(record => parseAdvanceItem(record)).find(item => item !== null) ?? null
  const entry = await appendEntry(ctx, budget, binding, {
    advanceId,
    sourceType: input.sourceType ?? '人工',
    changeType: '备注',
    summary,
    detail: input.goal === undefined || input.goal.trim() === '' ? '' : `目标 →${input.goal.trim()}`,
    refs: input.refs ?? [],
    actor: input.actor ?? 'agent',
  })
  const item: YzjAdvanceItem = created ?? {
    recordId: '',
    advanceId,
    title,
    goal: asString(fields[ITEM_F.goal]),
    assignee: parseAssignee(asString(fields[ITEM_F.assignee])).name,
    assigneeOpenId: parseAssignee(asString(fields[ITEM_F.assignee])).openId,
    targetDate: asString(fields[ITEM_F.targetDate]),
    stage: 'draft',
    background: asString(fields[ITEM_F.background]),
    metrics: asString(fields[ITEM_F.metrics]),
    tags,
    latest: asString(fields[ITEM_F.latest]),
  }
  if (threads !== undefined && input.threads !== undefined && input.threads.length > 0) {
    // Attach 意图线程 (spec §15.2): the founding group becomes 线程①.
    // Labels resolve once at write time (im: via the recent-group catalog);
    // they are display text, never live references.
    const actor: 'user' | 'agent' = input.actor === 'user' ? 'user' : 'agent'
    let catalog: { groupId: string; groupName: string }[] | undefined
    for (const token of input.threads) {
      const parsed = parseThreadToken(token)
      if (parsed === undefined) continue
      let label = parsed.id
      if (parsed.prefix === 'im') {
        if (catalog === undefined) catalog = await listRecentGroups(ctx, budget)
        label = catalog.find(row => row.groupId === parsed.id)?.groupName ?? parsed.id
      }
      await threads.add(advanceId, {
        token,
        kind: threadKindOf(parsed.prefix) ?? 'document',
        label,
        addedBy: actor,
        addedAt: Date.now(),
      })
    }
  }
  return { item, entry, idempotent: false, assigneeNote, binding }
}

/** Result of a core feed. */
export interface AdvanceFeedResult {
  item: YzjAdvanceItem
  entry: YzjAdvanceEntry
  stageFrom: AdvanceStage
  stageChanged: boolean
  binding: AdvanceBinding
  /** True when a matching ref was already on the stream (决策 19). */
  idempotent: boolean
}

/**
 * Feed one 事元: validate the stage move (when present), append the entry
 * (append-only stream), then refresh the item projection. Field-level
 * `原值→新值` diffs are host-generated into 变化内容 — the model cannot
 * rewrite history.
 */
export async function coreFeedAdvance(
  ctx: Context,
  budget: YzjToolBudget,
  config: TodoConfig,
  caches: AdvanceCaches,
  input: AdvanceFeedInput,
  holder?: TodoBindingHolder,
): Promise<AdvanceFeedResult> {
  if (input.summary.trim() === '') throw new Error('advance: summary must not be empty')
  const binding = await resolveAdvance(ctx, budget, config, caches, false, holder)
  const item = await fetchItemById(ctx, budget, binding, input.advanceId)
  if (item === undefined) {
    throw new Error(`advance: 事项 ${input.advanceId} 不存在；先用 yzj_advance_list 查真实 id，不要猜测`)
  }
  const incomingRefs = (input.refs ?? []).filter(token => token.trim() !== '')
  if (incomingRefs.length > 0) {
    const existing = await fetchEntries(ctx, budget, binding, input.advanceId)
    const hit = existing.find(entry => refsOverlap(incomingRefs, entry.refs))
    if (hit !== undefined) {
      return { item, entry: hit, stageFrom: item.stage, stageChanged: false, binding, idempotent: true }
    }
  }
  const diffs: string[] = []
  const projection: Record<string, unknown> = {}
  let stageChanged = false
  if (input.stageTo !== undefined && input.stageTo !== item.stage) {
    if (!ADVANCE_STAGES.includes(input.stageTo as AdvanceStage)) {
      throw new Error(`advance: 未知阶段 ${input.stageTo}；合法值 ${ADVANCE_STAGES.join('/')}`)
    }
    const violation = checkStageTransition(item.stage, input.stageTo)
    if (violation !== null) throw new Error(`advance: ${violation}`)
    diffs.push(`阶段 ${item.stage}→${input.stageTo}`)
    projection[ITEM_F.stage] = input.stageTo
    stageChanged = true
  }
  if (input.goal !== undefined && input.goal.trim() !== '' && input.goal.trim() !== item.goal) {
    diffs.push(`目标 ${item.goal === '' ? '（空）' : item.goal}→${input.goal.trim()}`)
    projection[ITEM_F.goal] = input.goal.trim()
  }
  if (input.metrics !== undefined && input.metrics.trim() !== '' && input.metrics.trim() !== item.metrics) {
    diffs.push(`成功指标 ${item.metrics === '' ? '（空）' : item.metrics.split('\n').join('；')}→${input.metrics.trim().split('\n').join('；')}`)
    projection[ITEM_F.metrics] = input.metrics.trim()
  }
  if (input.targetDate !== undefined && input.targetDate.trim() !== '') {
    const next = normalizeDdl(input.targetDate)
    if (next !== item.targetDate) {
      diffs.push(`目标日期 ${item.targetDate === '' ? '（空）' : item.targetDate}→${next}`)
      projection[ITEM_F.targetDate] = next
    }
  }
  if (input.assignee !== undefined && input.assignee.trim() !== '') {
    const resolved = await resolveAssignee(ctx, budget, input.assignee)
    if (parseAssignee(resolved.value).name !== item.assignee) {
      diffs.push(`负责人 ${item.assignee === '' ? '（空）' : item.assignee}→${parseAssignee(resolved.value).name}`)
      projection[ITEM_F.assignee] = resolved.value
    }
  }
  const detailParts = [...diffs]
  if (input.detail !== undefined && input.detail.trim() !== '') detailParts.push(input.detail.trim())
  const changeType = input.changeType ?? (stageChanged ? '阶段变化' : '备注')
  const entry = await appendEntry(ctx, budget, binding, {
    advanceId: input.advanceId,
    sourceType: input.sourceType ?? '人工',
    changeType,
    summary: input.summary.trim(),
    detail: detailParts.join('\n'),
    refs: input.refs ?? [],
    actor: input.actor ?? 'agent',
  })
  projection[ITEM_F.latest] = `${entry.at} ${entry.changeType} ${entry.summary}`
  await writeTable(ctx, budget, binding, binding.itemTableId, 'update', JSON.stringify([{ id: item.recordId, fieldsValue: projection }]))
  const updated: YzjAdvanceItem = {
    ...item,
    stage: (projection[ITEM_F.stage] as AdvanceStage | undefined) ?? item.stage,
    goal: asString(projection[ITEM_F.goal]) === '' ? item.goal : asString(projection[ITEM_F.goal]),
    metrics: asString(projection[ITEM_F.metrics]) === '' ? item.metrics : asString(projection[ITEM_F.metrics]),
    targetDate: asString(projection[ITEM_F.targetDate]) === '' ? item.targetDate : asString(projection[ITEM_F.targetDate]),
    assignee: projection[ITEM_F.assignee] === undefined ? item.assignee : parseAssignee(asString(projection[ITEM_F.assignee])).name,
    assigneeOpenId: projection[ITEM_F.assignee] === undefined ? item.assigneeOpenId : parseAssignee(asString(projection[ITEM_F.assignee])).openId,
    latest: asString(projection[ITEM_F.latest]),
  }
  return { item: updated, entry, stageFrom: item.stage, stageChanged, binding, idempotent: false }
}

// ---------------------------------------------------------------------------
// yzjAdvance host service (consumed by the ui-yzj RPC channel)
// ---------------------------------------------------------------------------

/** Panel-facing projection of one item (lossless JSON). */
export interface YzjAdvanceItemView {
  advanceId: string
  title: string
  goal: string
  assignee: string
  targetDate: string
  stage: AdvanceStage
  background: string
  metrics: { name: string; current: string; target: string }[]
  tags: string[]
  latest: string
}

/** Panel-facing projection of one entry. */
export interface YzjAdvanceEntryView {
  entryId: string
  at: string
  sourceType: string
  changeType: string
  summary: string
  detail: string
  refs: string[]
  actor: string
  tone: 'blue' | 'green' | 'red'
}

/** Board snapshot for the panel queue. */
export interface YzjAdvanceState {
  ready: boolean
  library: { docId: string; itemTableId: number; entryTableId: number; link: string } | null
  items: YzjAdvanceItemView[]
  error?: string
}

/** Detail snapshot: projection + a stream window + aggregated sources. */
export interface YzjAdvanceDetail {
  item: YzjAdvanceItemView
  entries: YzjAdvanceEntryView[]
  entryOffset: number
  entryTotal: number
  sources: YzjAdvanceSource[]
  /** Subscribed intent threads (spec §15.2), folded into `advance-get`. */
  threads: AdvanceThread[]
}

/** Outcome of one panel thread association (user-direct write). */
export interface AdvanceThreadAddResult {
  threads: AdvanceThread[]
  /** True when a document-source 事元 was appended (关联即一条，决策 20). */
  entryAppended: boolean
}

/**
 * The 备注 事元 a single-document source association lands (关联即一条事元,
 * spec §15.1). refs carry the token so a repeat association is also caught
 * by the 决策 19 stream dedupe.
 */
export function documentThreadEntryInput(advanceId: string, token: string, label: string): {
  advanceId: string
  summary: string
  sourceType: string
  changeType: '备注'
  detail: string
  refs: string[]
  actor: 'user'
} {
  const parsed = parseThreadToken(token)
  return {
    advanceId,
    summary: `关联渠道：${label}`,
    sourceType: sourceTypeOfThread(parsed?.prefix ?? 'doc'),
    changeType: '备注',
    detail: `订阅单文档源 ${token}（关联即一条事元；内容更新监测未排期）`,
    refs: [token],
    actor: 'user',
  }
}

/** Panel judge verbs (user-direct writes; each lands as one user 事元). */
export type AdvanceJudgeAction = 'confirm_condition' | 'confirm_advance' | 'accept' | 'reject' | 'ignore'

/** Pure verb → entry/stage mapping behind the panel judge path. */
export function judgeVerb(action: AdvanceJudgeAction, note?: string): { summary: string; stageTo?: AdvanceStage; changeType: string } {
  const suffix = note === undefined || note.trim() === '' ? '' : `：${note.trim()}`
  const spec: Record<AdvanceJudgeAction, { summary: string; stageTo?: AdvanceStage; changeType: string }> = {
    confirm_condition: { summary: `确认新条件${suffix}`, changeType: '备注' },
    confirm_advance: { summary: `确认推进${suffix}`, stageTo: 'updated', changeType: '阶段变化' },
    accept: { summary: `验收通过${suffix}`, stageTo: 'completed', changeType: '阶段变化' },
    reject: { summary: `打回补充${suffix}`, stageTo: 'running', changeType: '阶段变化' },
    ignore: { summary: `忽略本次评估，不构成新约束${suffix}`, stageTo: 'running', changeType: '备注' },
  }
  return spec[action]
}

function itemViewOf(item: YzjAdvanceItem): YzjAdvanceItemView {
  return {
    advanceId: item.advanceId,
    title: item.title,
    goal: item.goal,
    assignee: item.assignee,
    targetDate: item.targetDate,
    stage: item.stage,
    background: item.background,
    metrics: parseMetrics(item.metrics),
    tags: item.tags,
    latest: item.latest,
  }
}

function entryViewOf(entry: YzjAdvanceEntry): YzjAdvanceEntryView {
  return {
    entryId: entry.entryId,
    at: entry.at,
    sourceType: entry.sourceType,
    changeType: entry.changeType,
    summary: entry.summary,
    detail: entry.detail,
    refs: entry.refs,
    actor: entry.actor,
    tone: entry.tone,
  }
}

/** Host service exposing the advance core to the browser surface. */
export class YzjAdvanceService extends Service {
  private readonly budget: YzjToolBudget
  private readonly config: TodoConfig
  private readonly caches: AdvanceCaches = { lib: {}, adv: {} }
  /** Shared with the todo family so both boards follow the active library. */
  private readonly holder: TodoBindingHolder
  private readonly cursors: ScanCursorStoreFace
  private readonly threads: AdvanceThreadStoreFace

  constructor(
    ctx: Context,
    budget: YzjToolBudget,
    config: TodoConfig,
    holder: TodoBindingHolder,
    cursors: ScanCursorStoreFace = new ScanCursorStore(),
    threads: AdvanceThreadStoreFace = new AdvanceThreadStore(),
  ) {
    super(ctx, 'yzjAdvance')
    this.budget = budget
    this.config = config
    this.holder = holder
    this.cursors = cursors
    this.threads = threads
  }

  /** Board snapshot; `ready` false = tables not provisioned yet. */
  async state(): Promise<YzjAdvanceState> {
    let binding: AdvanceBinding
    try {
      binding = await resolveAdvance(this.ctx, this.budget, this.config, this.caches, false, this.holder)
    } catch {
      return { ready: false, library: null, items: [] }
    }
    try {
      const items = await fetchItems(this.ctx, this.budget, binding)
      return { ready: true, library: binding, items: items.map(itemViewOf) }
    } catch (error) {
      return { ready: true, library: binding, items: [], error: String((error as Error).message) }
    }
  }

  /** One item's detail: projection + entry window (tail by default) + sources. */
  async get(advanceId: string, entryOffset?: number, entryLimit?: number): Promise<YzjAdvanceDetail> {
    const binding = await resolveAdvance(this.ctx, this.budget, this.config, this.caches, false, this.holder)
    const item = await fetchItemById(this.ctx, this.budget, binding, advanceId)
    if (item === undefined) throw new Error(`advance: 事项 ${advanceId} 不存在`)
    const entries = await fetchEntries(this.ctx, this.budget, binding, advanceId)
    const limit = entryLimit === undefined || entryLimit < 1 ? 20 : entryLimit
    const offset = entryOffset === undefined || entryOffset < 0 ? Math.max(0, entries.length - limit) : entryOffset
    return {
      item: itemViewOf(item),
      entries: entries.slice(offset, offset + limit).map(entryViewOf),
      entryOffset: offset,
      entryTotal: entries.length,
      sources: aggregateSources(entries),
      threads: this.threads.threadsOf(advanceId).map(row => ({ ...row })),
    }
  }

  /** Provision the two tables on demand (one-click empty-state action). */
  async ensure(): Promise<YzjAdvanceState> {
    await resolveAdvance(this.ctx, this.budget, this.config, this.caches, true, this.holder)
    return this.state()
  }

  /** Start-modal direct write (the user's own act; no confirmation card). */
  async create(input: AdvanceCreateInput): Promise<YzjAdvanceItemView> {
    const result = await coreCreateAdvance(this.ctx, this.budget, this.config, this.caches, { ...input, actor: 'user' }, this.holder, this.threads)
    return itemViewOf(result.item)
  }

  /** Agent-parity feed exposed for host-side callers (tools use the core directly). */
  async feed(input: AdvanceFeedInput): Promise<YzjAdvanceItemView> {
    const result = await coreFeedAdvance(this.ctx, this.budget, this.config, this.caches, input, this.holder)
    return itemViewOf(result.item)
  }

  /**
   * Panel judge verbs — every user judgement lands as one 事元 (PRD: 每次
   * 用户的判断及操作都记录在推进时间旅程上), with the stage move where the
   * verb implies one.
   */
  async judge(advanceId: string, action: AdvanceJudgeAction, note?: string): Promise<YzjAdvanceItemView> {
    const verb = judgeVerb(action, note)
    const result = await coreFeedAdvance(this.ctx, this.budget, this.config, this.caches, {
      advanceId,
      summary: verb.summary,
      sourceType: '人工',
      changeType: verb.changeType,
      ...(verb.stageTo === undefined ? {} : { stageTo: verb.stageTo }),
      actor: 'user',
    }, this.holder)
    return itemViewOf(result.item)
  }

  /** Last patrol wave for the board status line (spec §14.5). */
  scanState(): AdvanceScanState {
    return scanStateOf(this.cursors)
  }

  /** One item's subscribed threads (lossless rows for the panel). */
  threadsOf(advanceId: string): AdvanceThread[] {
    return this.threads.threadsOf(advanceId).map(row => ({ ...row }))
  }

  /**
   * Panel 「关联渠道」 direct write (D9, no confirmation card): validate the
   * token grammar and the item, append the registry row (addedBy=user), and
   * for single-document sources land one 备注 事元 with refs=[token] so a
   * repeat association is blocked by both the registry and 决策 19 dedupe.
   * Unsubscribing never deletes entries (timeline invariance).
   */
  async threadAdd(advanceId: string, token: string, label?: string): Promise<AdvanceThreadAddResult> {
    const parsed = parseThreadToken(token)
    if (parsed === undefined) {
      throw new Error(`advance: 非法线程 token「${token}」；语法 im:<groupId> / doc:<docId> / todo:<todoId> / event:<eventId> / file:<fileId>`)
    }
    const binding = await resolveAdvance(this.ctx, this.budget, this.config, this.caches, false, this.holder)
    const item = await fetchItemById(this.ctx, this.budget, binding, advanceId)
    if (item === undefined) throw new Error(`advance: 事项 ${advanceId} 不存在`)
    const existing = this.threads.threadsOf(advanceId)
    if (existing.some(row => row.token === token)) {
      return { threads: existing.map(row => ({ ...row })), entryAppended: false }
    }
    const kind = threadKindOf(parsed.prefix) ?? 'document'
    let resolvedLabel = label !== undefined && label.trim() !== '' ? label.trim() : parsed.id
    if (label === undefined || label.trim() === '') {
      if (parsed.prefix === 'im') {
        const catalog = await listRecentGroups(this.ctx, this.budget)
        resolvedLabel = catalog.find(row => row.groupId === parsed.id)?.groupName ?? parsed.id
      }
    }
    const outcome = await this.threads.add(advanceId, {
      token,
      kind,
      label: resolvedLabel,
      addedBy: 'user',
      addedAt: Date.now(),
    })
    if (!outcome.added) return { threads: outcome.threads.map(row => ({ ...row })), entryAppended: false }
    if (kind === 'document') {
      await coreFeedAdvance(this.ctx, this.budget, this.config, this.caches, documentThreadEntryInput(advanceId, token, resolvedLabel), this.holder)
      return { threads: outcome.threads.map(row => ({ ...row })), entryAppended: true }
    }
    return { threads: outcome.threads.map(row => ({ ...row })), entryAppended: false }
  }

  /** Panel 「解除关联」: registry row only — existing 事元 stay untouched. */
  async threadRemove(advanceId: string, token: string): Promise<AdvanceThread[]> {
    if (parseThreadToken(token) === undefined) {
      throw new Error(`advance: 非法线程 token「${token}」`)
    }
    const rows = await this.threads.remove(advanceId, token)
    return rows.map(row => ({ ...row }))
  }

  /** Open the scan-cursor and thread domains once the storage hub is ready. */
  async openNow(): Promise<void> {
    const facility = this.ctx.get('storageDomain')
    if (facility === undefined) return
    if (this.cursors instanceof ScanCursorStore) {
      try {
        await this.cursors.open(facility as never)
      } catch (error) {
        this.ctx.logger.warn(`yzjAdvance: scan cursor store failed to open: ${String(error)}`)
      }
    }
    if (this.threads instanceof AdvanceThreadStore) {
      try {
        await this.threads.open(facility as never)
      } catch (error) {
        this.ctx.logger.warn(`yzjAdvance: thread store failed to open: ${String(error)}`)
      }
    }
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Advancement (AI推进) core shared by the tools and the browser surface. */
    yzjAdvance: YzjAdvanceService
  }
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

/** Register the yzj_advance_* tool family (list/get/inspect/scan/create/feed). */
export function applyAdvanceTools(
  ctx: Context,
  budget: YzjToolBudget,
  config: TodoConfig,
  holder?: TodoBindingHolder,
  cursors: ScanCursorStoreFace = new ScanCursorStore(),
  threads: AdvanceThreadStoreFace = new AdvanceThreadStore(),
): void {
  const caches: AdvanceCaches = { lib: {}, adv: {} }

  const bindingMeta = (binding: AdvanceBinding): JsonValue =>
    ({ docId: binding.docId, itemTableId: binding.itemTableId, entryTableId: binding.entryTableId, link: binding.link }) as unknown as JsonValue

  ctx.tools.register(defineTool({
    name: 'yzj_advance_list',
    description: 'List advancement items (推进事项) from the AI推进 board: each item is an event-sourced aggregate of traceable 事元 (IM/todo/doc/minutes/calendar signals). Filter by stage (six-stage machine), tag, or assignee. The board queue groups decision-needed (待我决定) / ready-for-review (待我验收) / other open items (我关注的推进).',
    parameters: {
      stage: { type: 'string', enum: [...ADVANCE_STAGES, 'open', 'all'], description: 'open = not completed (default); or one exact stage.' },
      tag: { type: 'string', description: 'Only items carrying this tag (no # prefix needed).' },
      assignee: { type: 'string', description: 'Only items whose 负责人 name matches (substring).' },
      limit: { type: 'number', description: 'Max rows in the digest, 1-100, default 50.' },
    },
    output: yzjToolOutput,
    timeoutMs: budget.timeoutMs * 2,
    isConcurrencySafe: () => true,
    async execute(args) {
      let binding: AdvanceBinding
      try {
        binding = await resolveAdvance(ctx, budget, config, caches, false, holder)
      } catch (error) {
        return { content: `(推进看板未开通) ${String((error as Error).message)}`, truncated: false, data: { kind: 'advance-list', ready: false } }
      }
      let items: YzjAdvanceItem[]
      try {
        items = await fetchItems(ctx, budget, binding)
      } catch (error) {
        return { content: `yzj advance list failed: ${String((error as Error).message)}`, truncated: false, data: {} }
      }
      const stage = args.stage ?? 'open'
      const tag = args.tag === undefined ? '' : args.tag.replace(/^#+/, '').trim()
      const assignee = (args.assignee ?? '').trim()
      const filtered = items.filter(item => {
        if (stage === 'open' && item.stage === 'completed') return false
        if (ADVANCE_STAGES.includes(stage as AdvanceStage) && item.stage !== stage) return false
        if (tag !== '' && !item.tags.includes(tag)) return false
        if (assignee !== '' && !item.assignee.includes(assignee)) return false
        return true
      })
      const rank: Record<AdvanceStage, number> = {
        'decision-needed': 0, 'ready-for-review': 1, 'updated': 2, 'running': 3, 'draft': 4, 'completed': 5,
      }
      const sorted = filtered.sort((a, b) =>
        rank[a.stage] === rank[b.stage] ? (a.advanceId < b.advanceId ? -1 : 1) : rank[a.stage] - rank[b.stage])
      const limit = args.limit === undefined ? 50 : args.limit
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        throw new Error('yzj_advance_list: limit must be an integer between 1 and 100')
      }
      const shown = sorted.slice(0, limit)
      const head = `AI推进看板 (${binding.link}) · ${stage}${tag === '' ? '' : ` #${tag}`} · ${sorted.length} 项`
      const content = [head, ...(shown.length === 0 ? ['(无匹配事项)'] : shown.map(itemLine))].join('\n')
      return {
        content,
        truncated: false,
        data: {
          kind: 'advance-list',
          ready: true,
          list: clipJson(shown.map(itemViewOf), { maxChars: budget.maxMetaChars }),
          total: sorted.length,
          library: bindingMeta(binding),
        } as unknown as JsonValue,
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'yzj_advance_get',
    description: 'Read one advancement item: the folded projection (goal/stage/metrics/background) plus its append-only 事元 stream (推进时间旅程). The stream is complete storage-side; page with entryOffset/entryLimit to read it all (default = tail window).',
    parameters: {
      advanceId: { type: 'string', required: true, description: 'Stable item id (A-YYYYMMDD-NNN, from yzj_advance_list).' },
      entryOffset: { type: 'number', description: 'Stream window start (0-based, oldest first); default = tail.' },
      entryLimit: { type: 'number', description: 'Stream window size, default 20.' },
    },
    output: yzjToolOutput,
    timeoutMs: budget.timeoutMs * 2,
    isConcurrencySafe: () => true,
    async execute(args) {
      let binding: AdvanceBinding
      let item: YzjAdvanceItem | undefined
      let entries: YzjAdvanceEntry[]
      try {
        binding = await resolveAdvance(ctx, budget, config, caches, false, holder)
        item = await fetchItemById(ctx, budget, binding, args.advanceId)
        if (item === undefined) {
          return { content: `advance: 事项 ${args.advanceId} 不存在；先用 yzj_advance_list 查真实 id`, truncated: false, data: {} }
        }
        entries = await fetchEntries(ctx, budget, binding, args.advanceId)
      } catch (error) {
        return { content: `yzj advance get failed: ${String((error as Error).message)}`, truncated: false, data: {} }
      }
      const limit = args.entryLimit === undefined || args.entryLimit < 1 ? 20 : Math.min(args.entryLimit, 100)
      const offset = args.entryOffset === undefined || args.entryOffset < 0 ? Math.max(0, entries.length - limit) : args.entryOffset
      const window = entries.slice(offset, offset + limit)
      const head = [
        `${item.advanceId} · ${item.title} [${item.stage}]`,
        item.goal === '' ? '' : `目标：${item.goal}`,
        item.background === '' ? '' : `背景：${item.background}`,
        item.metrics === '' ? '' : `成功指标：${item.metrics.split('\n').join('；')}`,
        `${item.assignee === '' ? '' : `负责人 ${item.assignee} · `}${item.targetDate === '' ? '' : `目标日期 ${item.targetDate} · `}事元 ${entries.length} 条（窗口 ${offset}-${offset + window.length}）`,
      ].filter(line => line !== '')
      const content = [...head, '--- 推进时间旅程 ---', ...(window.length === 0 ? ['(暂无事元)'] : window.map(entryLine))].join('\n')
      return {
        content,
        truncated: false,
        data: {
          kind: 'advance-get',
          item: clipJson(itemViewOf(item), { maxChars: budget.maxMetaChars }),
          entries: clipJson(window.map(entryViewOf), { maxChars: budget.maxMetaChars }),
          entryOffset: offset,
          entryTotal: entries.length,
          sources: clipJson(aggregateSources(entries), { maxChars: budget.maxMetaChars }),
          library: bindingMeta(binding),
        } as unknown as JsonValue,
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'yzj_advance_inspect',
    description: 'Read-only 比对材料 for AI推进 (spec §12). Spreads open items\' goal/background/metrics/recent 事元/legal next stages plus the interrupt / silence / suppression criteria (spec §13). Host does NOT judge semantics — you do, then yzj_advance_feed. mode=review is the 验收辅助 checklist. Patrol five steps: on a schedule wake call yzj_advance_scan(groups=…) first; no new messages → stay silent and stop; new signals → call this with signals=the scan digest, then act per §13 (progress-normal silent feed; interrupt criterion → stageTo=decision-needed; never completed). Never stageTo completed.',
    parameters: {
      advanceId: { type: 'string', description: 'Inspect one item; omit to spread every open (not completed) item.' },
      signals: { type: 'string', description: 'New information to contrast (group messages / minutes excerpt). Empty = scheduled patrol with no new signal yet.' },
      mode: { type: 'string', enum: ['compare', 'review'], description: 'compare = 核心变量对比 (default); review = 验收辅助, still must not auto-accept.' },
    },
    output: yzjToolOutput,
    timeoutMs: budget.timeoutMs * 3,
    isConcurrencySafe: () => true,
    async execute(args) {
      let binding: AdvanceBinding
      try {
        binding = await resolveAdvance(ctx, budget, config, caches, false, holder)
      } catch (error) {
        return { content: `(推进看板未开通) ${String((error as Error).message)}`, truncated: false, data: { kind: 'advance-inspect', ready: false } }
      }
      let items: YzjAdvanceItem[]
      try {
        items = await fetchItems(ctx, budget, binding)
      } catch (error) {
        return { content: `yzj advance inspect failed: ${String((error as Error).message)}`, truncated: false, data: {} }
      }
      const wanted = (args.advanceId ?? '').trim()
      const mode = args.mode === 'review' ? 'review' : 'compare'
      const scoped = wanted === ''
        ? items.filter(item => item.stage !== 'completed')
        : items.filter(item => item.advanceId === wanted)
      if (wanted !== '' && scoped.length === 0) {
        return { content: `advance: 事项 ${wanted} 不存在；先用 yzj_advance_list 查真实 id，不要猜测`, truncated: false, data: {} }
      }
      const subjects: InspectSubject[] = []
      for (const item of scoped) {
        let recent: YzjAdvanceEntry[] = []
        try {
          const entries = await fetchEntries(ctx, budget, binding, item.advanceId)
          recent = entries.slice(Math.max(0, entries.length - 5))
        } catch {
          recent = []
        }
        subjects.push({ item, recent })
      }
      const content = buildInspectDigest({ subjects, signals: args.signals ?? '', mode })
      return {
        content,
        truncated: false,
        data: {
          kind: 'advance-inspect',
          ready: true,
          mode,
          signals: args.signals ?? '',
          list: clipJson(subjects.map(row => ({
            advanceId: row.item.advanceId,
            title: row.item.title,
            stage: row.item.stage,
            next: [...legalNextStages(row.item.stage)],
          })), { maxChars: budget.maxMetaChars }),
          library: bindingMeta(binding),
        } as unknown as JsonValue,
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'yzj_advance_scan',
    description: 'Read-only incremental IM scan for AI推进 auto-discovery (spec §14 / §15.3). Host owns the per-group cursor (storage-domain); the model must not pass or invent a msgId cursor. First visit of a group records a baseline and returns no history. Later visits return messages after the cursor, minus self and BOT- senders. groups is optional: omit it to scan every im: channel subscribed by open items (registry yzj_advance_threads, deduped — one fetch per channel whichever items subscribe); the digest lists each item\'s 订阅清单 so you dispatch signals by thread + semantic relevance. Explicit groups stay capped at 8 (决策 17); subscription aggregation errors out instead of silently truncating. Patrol five steps: schedule wake → this tool → no new messages stay silent → new signals → yzj_advance_inspect → feed per §13 (progress-normal silent; interrupt → decision-needed; never completed). When the user says 开启巡检, create a root-session schedule_create(every_seconds≥300) whose prompt lists the groups.',
    parameters: {
      groups: { type: 'array', items: { type: 'string' }, description: 'Group ids or names to watch (1–8). Omit to aggregate the im: threads of every open item from the subscription registry.' },
      limit: { type: 'number', description: 'Per-group page size 1–20, default 20.' },
    },
    output: yzjToolOutput,
    timeoutMs: budget.timeoutMs * 6,
    isConcurrencySafe: () => true,
    async execute(args) {
      const groups = (args.groups ?? []).map((token: unknown) => String(token).trim()).filter((token: string) => token !== '')
      if (groups.length > MAX_SCAN_GROUPS) {
        return { content: `advance scan: at most ${MAX_SCAN_GROUPS} groups`, truncated: false, data: { kind: 'advance-scan', ready: false } }
      }
      let result: AdvanceScanResult
      try {
        result = await coreScanAdvance(ctx, budget, config, caches, cursors, groups, args.limit, holder, threads)
      } catch (error) {
        return { content: `yzj advance scan failed: ${String((error as Error).message)}`, truncated: false, data: {} }
      }
      return {
        content: buildScanDigest(result),
        truncated: false,
        data: {
          kind: 'advance-scan',
          ready: true,
          signals: clipJson(result.signals, { maxChars: budget.maxMetaChars }),
          groups: clipJson(result.groups, { maxChars: budget.maxMetaChars }),
          openItems: clipJson(result.openItems, { maxChars: budget.maxMetaChars }),
          subscriptions: clipJson(result.subscriptions, { maxChars: budget.maxMetaChars }),
        } as unknown as JsonValue,
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'yzj_advance_create',
    description: 'Create one advancement item (推进事项) on the AI推进 board (auto-provisions the 事项/事元 tables on first use). Prefill the 7 fields from the conversation so the user only confirms (AI 预填). When 立项 happens inside a group topic, pass threads=[im:<groupId>] so the founding group becomes 线程① (intent-thread subscription, spec §15); later patrol scans follow the subscription. Idempotent: pass advanceId to adopt an existing item. Starts at stage draft; move it with yzj_advance_feed.',
    parameters: {
      title: { type: 'string', required: true, description: 'Item name (名称).' },
      advanceId: { type: 'string', description: 'Explicit stable id (A-YYYYMMDD-NNN); when it exists the existing item is returned unchanged (idempotent).' },
      goal: { type: 'string', description: '这件事要做到什么 — the currently effective goal (描述).' },
      background: { type: 'string', description: '任务背景 — the anchor the agent compares incoming signals against.' },
      metrics: { type: 'string', description: '成功指标, one per line as `指标名: 当前 / 目标` (rendered as metric cards).' },
      assignee: { type: 'string', description: '结果承担者 (name resolved to 姓名(openId) when unique).' },
      targetDate: { type: 'string', description: 'Target date as YYYY-MM-DD or YYYY/MM/DD.' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Tags for aggregation; # prefixes stripped.' },
      refs: { type: 'array', items: { type: 'string' }, description: 'Traceable ref tokens (yzj:... / msgId / docId) this item originates from; stored on the 立项 entry. Never sent to the CLI.' },
      sourceType: { type: 'string', enum: [...SOURCE_TYPES], description: 'Provenance of the founding signal (default 人工).' },
      threads: { type: 'array', items: { type: 'string' }, description: 'Intent-thread tokens to subscribe (im:<groupId> / doc:<docId> / todo:<todoId> / event:<eventId> / file:<fileId>). The founding group usually goes here as 线程①; im: threads drive later yzj_advance_scan aggregation.' },
    },
    output: yzjToolOutput,
    timeoutMs: budget.timeoutMs * 4,
    isConcurrencySafe: () => false,
    async execute(args) {
      let result: AdvanceCreateResult
      try {
        result = await coreCreateAdvance(ctx, budget, config, caches, {
          title: args.title,
          advanceId: args.advanceId,
          goal: args.goal,
          background: args.background,
          metrics: args.metrics,
          assignee: args.assignee,
          targetDate: args.targetDate,
          tags: args.tags,
          refs: args.refs,
          sourceType: args.sourceType,
          threads: args.threads,
          actor: 'agent',
        }, holder, threads)
      } catch (error) {
        return { content: `yzj advance create failed: ${String((error as Error).message)}`, truncated: false, data: {} }
      }
      if (result.idempotent) {
        return {
          content: `已存在（幂等命中，未重复创建）：${itemLine(result.item)}`,
          truncated: false,
          data: { kind: 'advance-create', idempotentHit: true, advanceId: result.item.advanceId, item: clipJson(itemViewOf(result.item), { maxChars: budget.maxMetaChars }), library: bindingMeta(result.binding) } as unknown as JsonValue,
        }
      }
      const content = [
        `created 推进事项 ${result.item.advanceId} · ${result.item.title} [draft]${result.assigneeNote}`,
        ...(threads.threadsOf(result.item.advanceId).length > 0
          ? [`已订阅线程：${threads.threadsOf(result.item.advanceId).map(row => row.token).join('、')}`]
          : []),
        `推进看板 ${result.binding.link}`,
      ].join('\n')
      return {
        content,
        truncated: false,
        data: {
          kind: 'advance-create',
          advanceId: result.item.advanceId,
          item: clipJson(itemViewOf(result.item), { maxChars: budget.maxMetaChars }),
          refs: args.refs ?? [],
          library: bindingMeta(result.binding),
        } as unknown as JsonValue,
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'yzj_advance_feed',
    description: 'Feed one 事元 (source unit) into an advancement item — the ONLY mutation channel: goal updates, progress, deviations, decision requests, and stage moves are all append-only entries with host-generated 原值→新值 diffs; the item projection is refolded. Stage moves obey the six-stage machine (draft→running→(decision-needed→updated)*→ready-for-review→completed). Patrol: yzj_advance_scan then yzj_advance_inspect, then this tool. Host forcibly dedupes the same ref/msgId (决策 19) — a second feed with an overlapping refs token returns the existing 事元 and appends nothing. running items stay quiet — do not feed when there is no deviation, and never re-state a fact already on the timeline. Interrupt the user (changeType 偏差 + stageTo decision-needed) only when a criterion fires: the signal contradicts 任务背景, a metric flips off-target or moves away from it, the gap cannot close before the target date, a blocker threatens that date, continuing needs scope/resource/priority trade-offs or crosses a stated red line, or two+ viable paths would change the baseline. Deliverables complete AND metrics N/N AND no open deviation → 验收请求 + ready-for-review. Never stageTo completed (the user taps 确认达到目标). The confirmation card appears ONLY when you rewrite the baseline (goal/metrics/targetDate/assignee) — plain appends and stage moves land silently, the board queue is where the user is found. Min-loop in the topic: contrast 原来的理解 vs 现在的约束, propose options, wait, restate impact, then feed.',
    parameters: {
      advanceId: { type: 'string', required: true, description: 'Stable item id (from yzj_advance_list).' },
      summary: { type: 'string', required: true, description: 'Event description — what happened (timeline row text).' },
      sourceType: { type: 'string', enum: [...SOURCE_TYPES], description: 'Where the signal came from (default 人工).' },
      changeType: { type: 'string', enum: [...CHANGE_TYPES], description: 'What this entry does to the item (default 阶段变化 when stageTo is set, else 备注).' },
      detail: { type: 'string', description: 'Free-form detail appended after the host-generated field diffs.' },
      refs: { type: 'array', items: { type: 'string' }, description: 'Traceable ref tokens for this signal (yzj:... / msgId / docId / todoId). Never sent to the CLI.' },
      stageTo: { type: 'string', enum: [...ADVANCE_STAGES], description: 'Stage move (state machine enforced; illegal moves are rejected with the legal paths).' },
      goal: { type: 'string', description: 'New effective goal (goal update; old→new recorded).' },
      metrics: { type: 'string', description: 'New 成功指标 lines (old→new recorded).' },
      targetDate: { type: 'string', description: 'New target date (old→new recorded).' },
      assignee: { type: 'string', description: 'New 结果承担者 (old→new recorded).' },
    },
    output: yzjToolOutput,
    timeoutMs: budget.timeoutMs * 4,
    isConcurrencySafe: () => false,
    async execute(args) {
      let result: AdvanceFeedResult
      try {
        result = await coreFeedAdvance(ctx, budget, config, caches, {
          advanceId: args.advanceId,
          summary: args.summary,
          sourceType: args.sourceType,
          changeType: args.changeType,
          detail: args.detail,
          refs: args.refs,
          stageTo: args.stageTo,
          goal: args.goal,
          metrics: args.metrics,
          targetDate: args.targetDate,
          assignee: args.assignee,
          actor: 'agent',
        }, holder)
      } catch (error) {
        return { content: `yzj advance feed failed: ${String((error as Error).message)}`, truncated: false, data: {} }
      }
      if (result.idempotent) {
        return {
          content: `同源去重（未追加）：事元 ${result.entry.entryId} → ${result.item.advanceId} 已含 ${result.entry.refs.join(' ')}`,
          truncated: false,
          data: {
            kind: 'advance-feed',
            idempotentHit: true,
            advanceId: result.item.advanceId,
            entryId: result.entry.entryId,
            changeType: result.entry.changeType,
            summary: result.entry.summary,
            refs: result.entry.refs,
            item: clipJson(itemViewOf(result.item), { maxChars: budget.maxMetaChars }),
            library: bindingMeta(result.binding),
          } as unknown as JsonValue,
        }
      }
      const stageNote = result.stageChanged ? `（阶段 ${result.stageFrom}→${result.item.stage}）` : ''
      const content = [
        `fed 事元 ${result.entry.entryId} → ${result.item.advanceId} · ${result.entry.changeType} ${result.entry.summary}${stageNote}`,
        result.entry.detail === '' ? '' : `变化：${result.entry.detail.split('\n').join('；')}`,
        `推进看板 ${result.binding.link}`,
      ].filter(line => line !== '').join('\n')
      return {
        content,
        truncated: false,
        data: {
          kind: 'advance-feed',
          advanceId: result.item.advanceId,
          entryId: result.entry.entryId,
          changeType: result.entry.changeType,
          summary: result.entry.summary,
          detail: result.entry.detail,
          stageFrom: result.stageFrom,
          stageTo: result.item.stage,
          refs: result.entry.refs,
          item: clipJson(itemViewOf(result.item), { maxChars: budget.maxMetaChars }),
          library: bindingMeta(result.binding),
        } as unknown as JsonValue,
      }
    },
  }))
}
