/**
 * Sidecar for the live patrol scan: real yzj-cli via the bridge (read-only).
 * First call of a group is a baseline (no signals); a second call with no
 * new messages is silent. Prints one JSON object on stdout.
 */
import { Context } from '@deepseek-ai/cordis'
import YzjBridge from '../packages/bridge/src/index.ts'
import { coreScanAdvance } from '../packages/tool-yzj/src/advance.ts'
import { ScanCursorStore } from '../packages/tool-yzj/src/scan-cursors.ts'
import type { AdvanceCaches } from '../packages/tool-yzj/src/advance.ts'
import type { YzjToolBudget } from '../packages/tool-yzj/src/shared.ts'

const BUDGET: YzjToolBudget = { timeoutMs: 60_000, maxRenderChars: 8_000, maxMetaChars: 8_000 }
const GROUP = process.env.YZJ_E2E_GROUP ?? 'dsh-2'

function emit(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`)
}

const ctx = new Context()
new YzjBridge(ctx, {})
const caches: AdvanceCaches = { lib: {}, adv: {} }
const cursors = new ScanCursorStore()

const first = await coreScanAdvance(ctx, BUDGET, {}, caches, cursors, [GROUP])
const second = await coreScanAdvance(ctx, BUDGET, {}, caches, cursors, [GROUP])
emit({
  ok: true,
  group: GROUP,
  baseline: first.groups.map(row => ({ groupName: row.groupName, baseline: row.baseline, error: row.error, newCount: row.newCount })),
  firstSignals: first.signals.length,
  secondQuiet: second.signals.length === 0 && second.groups.every(row => row.baseline !== true && row.error === undefined),
  secondNewCount: second.groups.map(row => row.newCount),
  secondErrors: second.groups.map(row => row.error).filter(row => row !== undefined),
})
