/**
 * dsh-2 闭环演习 sidecar（实验设计：advance-dsh2-experiment.md）。
 * Real yzj-cli via the bridge (no shell interpolation); advance/todo writes go
 * through the core functions (agent-parity). Verbs:
 *   send <text>            — post one signal message to the dsh-2 group
 *   decide <advanceId>     — feed the blocking-signal 决策请求 (推论链 + 动作行)
 *   probe <advanceId>      — draft→running + 决策请求（回流探针，动作行：建待办）
 *   feed-ref <advanceId> <ref> <summary> — feed 一条带 refs 的事元（决策 49 推荐探针）
 *   review <advanceId>     — feed the 验收请求 (stageTo=ready-for-review)
 *   todo-done <todoId>     — mark one todo done (S4 回流探测)
 *   entries <advanceId>    — dump the item's entry stream from local SQLite
 * Prints one JSON object on stdout.
 */
import { Context } from '@deepseek-ai/cordis'
import { DatabaseSync } from 'node:sqlite'
import { homedir } from 'node:os'
import { join } from 'node:path'
import YzjBridge from '../packages/bridge/src/index.ts'
import { coreFeedAdvance } from '../packages/tool-yzj/src/advance.ts'
import type { AdvanceCaches } from '../packages/tool-yzj/src/advance.ts'
import { coreSetStatus } from '../packages/tool-yzj/src/todo.ts'
import type { YzjToolBudget } from '../packages/tool-yzj/src/shared.ts'

const GROUP_ID = '6a8400d4e4b09a073e3feeaf' // dsh-2
const BUDGET: YzjToolBudget = { timeoutMs: 60_000, maxRenderChars: 8_000, maxMetaChars: 8_000 }

function mount(): { ctx: Context; caches: AdvanceCaches } {
  // Storage backend: local SQLite only (决策 54 removed the backend switch).
  const ctx = new Context()
  new YzjBridge(ctx, {})
  return { ctx, caches: { lib: {}, adv: {} } }
}

function emit(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`)
}

const verb = process.argv[2] ?? ''
const { ctx, caches } = mount()

if (verb === 'send') {
  const text = process.argv[3] ?? ''
  if (text === '') throw new Error('send needs text')
  const result = await ctx.yzjBridge.run(['im', 'message', 'send', '--group-id', GROUP_ID, '--msg-type', 'text', '--content', text])
  if (!result.ok) throw new Error(`im send failed: ${result.stderr}`)
  emit({ ok: true, sent: result.json ?? {} })
} else if (verb === 'decide') {
  const advanceId = process.argv[3] ?? ''
  if (advanceId === '') throw new Error('decide needs advanceId')
  // 决策 52：立项即 running，无需先推 running。
  const fed = await coreFeedAdvance(ctx, BUDGET, {}, caches, {
    advanceId,
    summary: '演示数据包最早 08-24 才到位，08-26 彩排目标是否顺延？',
    sourceType: '对话',
    changeType: '决策请求',
    detail: [
      '事实：演示数据包还没齐，供应侧说最早下周一（08-24）才能给到。',
      '推论链：数据包 08-24 才到 → 搭建+彩排窗口从 5 天压缩到 2 天 → 威胁 08-26 目标日期（打扰判据③/④）。',
      '动作: 建待办 | 内容: 跟进演示数据包到位情况 | 截止: 2026-08-24',
      '动作: 发消息 | 内容: 数据包预计 08-24 到位，彩排可能被压缩，先同步一下风险与备选方案',
      '动作: 定会议 | 主题: 彩排评审会 | 时间: 2026-08-26 10:00',
    ].join('\n'),
    stageTo: 'decision-needed',
    actor: 'agent',
  })
  emit({ ok: true, advanceId, stage: fed.item.stage })
} else if (verb === 'probe') {
  // 回流探针（verify-advance-todo-channel）：决策 52 后立项即 running，直接喂决策请求（动作行：建待办）
  const advanceId = process.argv[3] ?? ''
  if (advanceId === '') throw new Error('probe needs advanceId')
  const fed = await coreFeedAdvance(ctx, BUDGET, {}, caches, {
    advanceId,
    summary: '探针待办待建：是否现在建立跟进待办？',
    sourceType: '对话',
    changeType: '决策请求',
    detail: '事实：探针事项需要一条待办验证 todo: 渠道回流。\n推论链：建待办 → 勾掉 → 巡检采集 → 完成事元应回到本时间线。\n动作: 建待办 | 内容: 回流探针待办（验证 todo 渠道） | 截止: 2026-08-23',
    stageTo: 'decision-needed',
    actor: 'agent',
  })
  emit({ ok: true, advanceId, stage: fed.item.stage })
} else if (verb === 'feed-ref') {
  const advanceId = process.argv[3] ?? ''
  const ref = process.argv[4] ?? ''
  const summary = process.argv[5] ?? ''
  if (advanceId === '' || ref === '' || summary === '') throw new Error('feed-ref needs advanceId/ref/summary')
  const fed = await coreFeedAdvance(ctx, BUDGET, {}, caches, {
    advanceId,
    summary,
    sourceType: '对话',
    refs: [ref],
    actor: 'agent',
  })
  emit({ ok: true, advanceId, entryId: fed.entry.entryId })
} else if (verb === 'review') {
  const advanceId = process.argv[3] ?? ''
  if (advanceId === '') throw new Error('review needs advanceId')
  const fed = await coreFeedAdvance(ctx, BUDGET, {}, caches, {
    advanceId,
    summary: '环境就绪且彩排通过，请对照成功指标验收',
    sourceType: '人工',
    changeType: '验收请求',
    stageTo: 'ready-for-review',
    actor: 'agent',
  })
  emit({ ok: true, advanceId, stage: fed.item.stage })
} else if (verb === 'todo-done') {
  const todoId = process.argv[3] ?? ''
  if (todoId === '') throw new Error('todo-done needs todoId')
  const result = await coreSetStatus(ctx, BUDGET, {}, {}, todoId, 'done')
  emit({ ok: true, todoId, changed: result.changed, status: result.todo?.status })
} else if (verb === 'entries') {
  const advanceId = process.argv[3] ?? ''
  if (advanceId === '') throw new Error('entries needs advanceId')
  const db = new DatabaseSync(join(homedir(), '.dsh', 'storages', 'yzj_advance.db'), { readOnly: true })
  const rows = db.prepare('SELECT entry_id, fields FROM entries WHERE advance_id = ? ORDER BY rowid').all(advanceId) as { entry_id: string; fields: string }[]
  db.close()
  emit({
    ok: true,
    advanceId,
    count: rows.length,
    entries: rows.map(row => {
      const fields = JSON.parse(row.fields) as Record<string, unknown>
      return {
        entryId: row.entry_id,
        changeType: fields['变化类型'],
        sourceType: fields['来源类型'],
        summary: fields['摘要'],
        detail: fields['变化内容'],
        refs: fields['引用'],
        actor: fields['操作者'],
      }
    }),
  })
} else {
  throw new Error(`unknown verb ${verb}`)
}
