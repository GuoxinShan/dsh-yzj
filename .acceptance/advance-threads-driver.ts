/**
 * Sidecar probe for the ③.2 threads acceptance: creates one advancement item
 * and feeds it into decision-needed with a §15.4 `选项N` decision request so
 * the browser walkthrough has a live item to render options against. All
 * writes go through the bridge (the repo's only subprocess path). Prints one
 * JSON object on stdout; requires a logged-in yzj-cli.
 */
import { Context } from '@deepseek-ai/cordis'
import YzjBridge from '../packages/bridge/src/index.ts'
import { coreCreateAdvance, coreFeedAdvance } from '../packages/tool-yzj/src/advance.ts'
import type { AdvanceCaches } from '../packages/tool-yzj/src/advance.ts'
import type { YzjToolBudget } from '../packages/tool-yzj/src/shared.ts'

const BUDGET: YzjToolBudget = { timeoutMs: 60_000, maxRenderChars: 12_000, maxMetaChars: 8_000 }

function emit(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`)
}

const ctx = new Context()
new YzjBridge(ctx, {})
const caches: AdvanceCaches = { lib: {}, adv: {} }

const who = await ctx.yzjBridge.run(['contact', 'user', 'get'])
if (!who.ok) {
  emit({ ok: false, step: 'whoami', error: who.stderr || who.stdout })
  process.exit(1)
}

const stamp = Date.now().toString().slice(-6)
const title = `线程探针 ${stamp}`
const created = await coreCreateAdvance(ctx, BUDGET, {}, caches, {
  title,
  goal: '验证 ③.2 决策选项渲染与关联渠道走查',
  background: '闭环探针，可随时清理',
  metrics: '决策区渲染选项: 否 / 是',
  actor: 'user',
})
await coreFeedAdvance(ctx, BUDGET, {}, caches, {
  advanceId: created.item.advanceId,
  summary: '开始推进：等待决策请求探针',
  changeType: '阶段变化',
  stageTo: 'running',
  actor: 'agent',
})
const decision = await coreFeedAdvance(ctx, BUDGET, {}, caches, {
  advanceId: created.item.advanceId,
  summary: '探针决策：资源与日期取舍',
  sourceType: '人工',
  changeType: '决策请求',
  stageTo: 'decision-needed',
  detail: '选项1: 追加资源，目标日期不变\n选项2: 目标日期顺延两周\n影响: 检验标准需同步调整',
  actor: 'agent',
})

emit({
  ok: true,
  title,
  advanceId: created.item.advanceId,
  stage: decision.item.stage,
  entryId: decision.entry.entryId,
})
