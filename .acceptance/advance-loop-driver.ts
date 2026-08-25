/**
 * Sidecar for the live five-stage loop (决策 52): real yzj-cli via the bridge
 * (no shell interpolation), local SQLite backend (决策 36). Playwright clicks
 * the panel judge verbs; this file only does agent-parity feeds
 * (running→decision-needed, then running→ready-for-review). Prints one JSON
 * object on stdout.
 */
import { Context } from '@deepseek-ai/cordis'
import YzjBridge from '../packages/bridge/src/index.ts'
import { coreCreateAdvance, coreFeedAdvance } from '../packages/tool-yzj/src/advance.ts'
import type { AdvanceCaches } from '../packages/tool-yzj/src/advance.ts'
import type { YzjToolBudget } from '../packages/tool-yzj/src/shared.ts'

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

if (verb === 'create-to-decision') {
  const stamp = Date.now().toString().slice(-6)
  const title = `闭环探针 ${stamp}`
  const created = await coreCreateAdvance(ctx, BUDGET, {}, caches, {
    title,
    goal: '真机走完五态：待决定 → 确认推进 → 待验收 → 完成',
    background: '验收闭环，可随时清理',
    metrics: '看板可见: 是 / 是',
    actor: 'user',
  })
  // 立项即 running（决策 52）：直接送决策请求。
  const decided = await coreFeedAdvance(ctx, BUDGET, {}, caches, {
    advanceId: created.item.advanceId,
    summary: '客户把验收口径改成必须看见时间旅程全量事元',
    sourceType: '对话',
    changeType: '决策请求',
    detail: '原来的理解：立项即可；现在的约束：五态走完才算闭环',
    stageTo: 'decision-needed',
    actor: 'agent',
  })
  emit({
    ok: true,
    advanceId: decided.item.advanceId,
    title,
    stage: decided.item.stage,
  })
} else if (verb === 'to-review') {
  const advanceId = process.argv[3] ?? ''
  if (advanceId === '') throw new Error('to-review needs advanceId')
  const fed = await coreFeedAdvance(ctx, BUDGET, {}, caches, {
    advanceId,
    summary: '产物已齐，请对照成功指标验收',
    sourceType: '人工',
    changeType: '验收请求',
    stageTo: 'ready-for-review',
    actor: 'agent',
  })
  emit({ ok: true, advanceId, stage: fed.item.stage })
} else {
  throw new Error(`unknown verb ${verb}`)
}
