/**
 * Dream consolidation state and execution contracts: the runtime switch,
 * model route, and daily-schedule live in `<vaultRoot>/dream.json` (plain
 * JSON, hand-editable, hot-reloaded on every read — a runtime toggle must
 * not require a profile restart); the canonical dream prompt shared by the
 * in-process executor and the (legacy) dsh-routines template; and the pure
 * daily-fire predicate tested without timers.
 *
 * Governance (design §3): the switch gates every dream APPLICATION surface
 * (the `memory_dream_apply` tool and the executor) in every process sharing
 * the vault; observation writes are never gated — they are the component's
 * point.
 * @module @dsh-yzj/memory-yzj/dream
 */

import { randomBytes } from 'node:crypto'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Runtime dream settings persisted at `<vaultRoot>/dream.json`. */
export interface DreamSettings {
  /** Master switch; `false` (the default) refuses every consolidation. */
  readonly enabled: boolean
  /** Dream model override — provider and model are set together or neither. */
  readonly provider?: string
  readonly model?: string
  /** Local daily fire time `HH:mm`; schedule active when set (and enabled). */
  readonly dailyAt?: string
  /** `YYYY-MM-DD` of the last scheduled run (restart-safe dedupe). */
  readonly lastRunDay?: string
  /** Human note from the last run (manual or scheduled). */
  readonly lastNote?: string
}

/** Drop the provider/model pair when only half of it is present. */
function withoutHalfRoute<T extends { provider?: string; model?: string }>(state: T): T {
  const hasPair = state.provider !== undefined && state.model !== undefined
  if (hasPair) return state
  const { provider: _provider, model: _model, ...rest } = state
  return rest as T
}

/** Wall-clock budget for one in-process dream run (matches routine timeoutMin 10). */
export const DREAM_RUN_TIMEOUT_MS = 10 * 60_000

/** Local date key `YYYY-MM-DD`. */
export function todayKey(now = new Date()): string {
  const pad = (n: number, width = 2): string => String(n).padStart(width, '0')
  return `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Validate one `HH:mm` local time (24h). */
export function isValidDailyAt(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

/** Path of the dream state file under one vault root. */
export function dreamStatePath(vaultRoot: string): string {
  return join(vaultRoot, 'dream.json')
}

/** Read the dream settings; absent or malformed files read as the safe default. */
export function readDreamSettings(vaultRoot: string): DreamSettings {
  try {
    const raw = readFileSync(dreamStatePath(vaultRoot), 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return { enabled: false }
    const record = parsed as { enabled?: unknown; provider?: unknown; model?: unknown; dailyAt?: unknown; lastRunDay?: unknown; lastNote?: unknown }
    return withoutHalfRoute({
      enabled: record.enabled === true,
      ...(typeof record.provider === 'string' && record.provider.trim() !== '' ? { provider: record.provider.trim() } : {}),
      ...(typeof record.model === 'string' && record.model.trim() !== '' ? { model: record.model.trim() } : {}),
      ...(typeof record.dailyAt === 'string' && isValidDailyAt(record.dailyAt) ? { dailyAt: record.dailyAt } : {}),
      ...(typeof record.lastRunDay === 'string' ? { lastRunDay: record.lastRunDay } : {}),
      ...(typeof record.lastNote === 'string' ? { lastNote: record.lastNote } : {}),
    })
  } catch {
    return { enabled: false }
  }
}

/** Persist the dream settings atomically (temp sibling + rename). */
export function writeDreamSettings(vaultRoot: string, settings: DreamSettings): void {
  const path = dreamStatePath(vaultRoot)
  const tmp = `${path}.tmp-${process.pid}-${randomBytes(4).toString('hex')}`
  writeFileSync(tmp, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
  renameSync(tmp, path)
}

/**
 * Merge a partial update into the persisted settings (whole-record replace).
 * Invalid `dailyAt` values are dropped; a half route is normalized away;
 * empty-string provider/model clear the route.
 */
export function updateDreamSettings(vaultRoot: string, partial: Partial<DreamSettings>): DreamSettings {
  const current = readDreamSettings(vaultRoot)
  const merged = withoutHalfRoute({
    enabled: partial.enabled ?? current.enabled,
    ...(partial.provider === undefined && partial.model === undefined
      ? (current.provider !== undefined && current.model !== undefined ? { provider: current.provider, model: current.model } : {})
      : {}),
    ...(partial.provider !== undefined && partial.provider !== '' && partial.model !== undefined && partial.model !== ''
      ? { provider: partial.provider, model: partial.model }
      : {}),
    ...(partial.dailyAt === undefined && current.dailyAt !== undefined ? { dailyAt: current.dailyAt } : {}),
    ...(partial.dailyAt !== undefined && isValidDailyAt(partial.dailyAt) ? { dailyAt: partial.dailyAt } : {}),
    ...(partial.lastRunDay === undefined && current.lastRunDay !== undefined ? { lastRunDay: current.lastRunDay } : {}),
    ...(partial.lastRunDay !== undefined ? { lastRunDay: partial.lastRunDay } : {}),
    ...(partial.lastNote === undefined && current.lastNote !== undefined ? { lastNote: current.lastNote } : {}),
    ...(partial.lastNote !== undefined ? { lastNote: partial.lastNote } : {}),
  })
  writeDreamSettings(vaultRoot, merged)
  return merged
}

/**
 * Pure daily-fire predicate: true when the schedule is armed, the local time
 * has passed today's `dailyAt`, and no run happened today yet.
 */
export function shouldFireDaily(settings: DreamSettings, now = new Date()): boolean {
  if (!settings.enabled || settings.dailyAt === undefined || !isValidDailyAt(settings.dailyAt)) return false
  if (settings.lastRunDay === todayKey(now)) return false
  const [hour, minute] = settings.dailyAt.split(':').map(part => Number.parseInt(part, 10))
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  return nowMinutes >= (hour ?? 0) * 60 + (minute ?? 0)
}

/** The canonical dream prompt (shared by the executor; the dsh-routines
 * template mirrors it — keep the two in sync when the rules evolve). */
export const DREAM_PROMPT = [
  '你是记忆固化引擎（dream），负责整理记忆库 user scope 的观察草稿区。严格按以下步骤工作：',
  '',
  '1. 调用 memory_dream_load(scope="user") 获取记忆库现状（sections/entities 的内容与 rev、全部 open observations）。',
  '2. 对每条 open observation 依据佐证规则判定（先看 durable 标记）：',
  '   - durable=true（长期候选，agent/用户明确意图）→ 即使单源也应 promote_observation（并入合适的 section，content 写成自包含的陈述句；必要时同步 upsert_entity）；',
  '   - durable=false（便签）→ 默认 drop_observation；仅当信息构成尚未反映的新稳定事实且被其他来源佐证时才 promote；',
  '   - 未标记：单日单源信号 → 留观，不出决策；信息已被某个 section/entity 覆盖 → drop_observation；',
  '     多源或跨日佐证、或用户明确陈述的稳定事实/偏好/决策 → promote_observation；',
  '   - 过时或与现状矛盾 → update_section 重写该段（rev 必须来自本次 load）；',
  '   - 都不适用但值得留痕 → log_only。',
  '   注意：source 为 routine:* 的例行产出信号默认不直接提升（防自反馈），durable=true 除外。',
  '3. 段落的 order/title 保持 load 返回的原值，不要重排。',
  '4. 调用 memory_dream_apply(scope="user", decisions=<JSON 数组字符串>, summary="<一句话摘要>")。decisions 里每条 update_section/upsert_entity/promote_observation 引用 load 返回的 rev；单条被拒（rev-conflict 等）不影响其余条目，无需重试。',
  '5. 最后用一两句话总结固化结果。',
  '',
  '取材扩展（AI推进 ④期，决策 29）：可调用 yzj_advance_list(stage=all) 找到推进事项，yzj_advance_get 读其事元流；终局（completed/cancelled）事项的复盘/纪要类产物事元（refs 指向知识库 docId）是高价值固化素材——它们回答「哪些事做完了、做成了什么样、为什么黄了」。',
  '',
  '只使用 memory_* 与 yzj_advance_*（只读 list/get）工具；不要调用其他工具。',
].join('\n')
