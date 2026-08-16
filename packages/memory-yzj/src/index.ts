/**
 * memory-yzj: a Markdown memory vault for DSH agents (host half). Provides
 * `ctx.yzjMemory` (scope-addressed observe/read/search + dream consolidation)
 * and five model-facing tools, and — when the `systemPrompt` service is
 * present — injects the configured scopes' bounded projection into every
 * prompt assembly as the `yzj-memory` dynamic context.
 *
 * Storage is plain files under one vault root (default
 * `$DSH_HOME/yzj-memory`), one subdirectory per scope, so every profile on
 * the machine (web, headless routines, ops) shares the same memory with no
 * runtime coupling; see docs/spec/memory-vault-design.md for the contracts.
 * @module @dsh-yzj/memory-yzj
 */

import { join } from 'node:path'
import { Context, Service } from '@deepseek-ai/cordis'
import { expandHomePath, resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-agent'
import z from '@deepseek-ai/schemastery'
import { MemoryCore } from './service.ts'
import type {
  DreamDecision, DreamItemResult, DreamReport, DreamState, MemoryCoreConfig,
  ObserveResult, Projection, ScopeView, SearchHit,
} from './service.ts'
import { DREAM_PROMPT, DREAM_RUN_TIMEOUT_MS, readDreamSettings, shouldFireDaily, todayKey, updateDreamSettings } from './dream.ts'
import type { DreamSettings } from './dream.ts'
import { timestampId } from './frontmatter.ts'
import { applyMemoryTools } from './tools.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'memory-yzj'
/** Hard dependency: the tool registry. `systemPrompt` is read opportunistically. */
export const inject = ['tools']

/** memory-yzj configuration; the schema fills every default. */
export interface Config {
  /** Vault root directory. Defaults to `$DSH_HOME/yzj-memory`; `~` expands. */
  vaultRoot?: string
  /** Scopes the tools may address. Defaults to `['user']`. */
  allowScopes?: string[]
  /** Scopes injected into every prompt assembly. Defaults to `['user']`. */
  injectScopes?: string[]
  /** Injection character cap fallback when a scope has no `sections.yaml`. Defaults to 6000. */
  injectCharCap?: number
  /** Open-observation capacity per scope. Defaults to 200. */
  observationsMax?: number
  /** Model-facing digest cap in characters. Defaults to 20000. */
  maxRenderChars?: number
  /** UI presentation payload cap in characters. Defaults to 50000. */
  maxMetaChars?: number
  /** Search hit cap. Defaults to 20. */
  maxSearchHits?: number
}

export const Config: z<Config> = z.object({
  vaultRoot: z.string(),
  allowScopes: z.array(z.string()).default(['user']),
  injectScopes: z.array(z.string()).default(['user']),
  injectCharCap: z.number().step(1).min(200).default(6000),
  observationsMax: z.number().step(1).min(1).default(200),
  maxRenderChars: z.number().step(1).min(1000).default(20_000),
  maxMetaChars: z.number().step(1).min(1000).default(50_000),
  maxSearchHits: z.number().step(1).min(1).max(100).default(20),
})

/** The memory service: thin lifetime owner over the pure {@link MemoryCore}. */
export class YzjMemoryService extends Service {
  static inject = ['tools']

  /** The pure core every method delegates to (also used directly by tests). */
  readonly core: MemoryCore

  constructor(ctx: Context, config: Config) {
    super(ctx, 'yzjMemory')
    const root = config.vaultRoot !== undefined && config.vaultRoot !== ''
      ? expandHomePath(config.vaultRoot)
      : join(resolveDshHome(), 'yzj-memory')
    const coreConfig: MemoryCoreConfig = {
      vaultRoot: root,
      allowScopes: config.allowScopes ?? ['user'],
      injectScopes: config.injectScopes ?? ['user'],
      injectCharCap: config.injectCharCap ?? 6000,
      observationsMax: config.observationsMax ?? 200,
      maxSearchHits: config.maxSearchHits ?? 20,
    }
    this.core = new MemoryCore(coreConfig)
  }

  /** Record one observation (deduped); see {@link MemoryCore.observe}. */
  observe(scope: string, content: string, options: { tags?: string[]; source?: string; durable?: boolean } = {}): ObserveResult {
    return this.core.observe(scope, {
      content,
      tags: options.tags ?? [],
      source: options.source ?? 'agent',
      ...(options.durable === undefined ? {} : { durable: options.durable }),
    })
  }

  /** Bounded read view; see {@link MemoryCore.readScope}. */
  readScope(scope: string): ScopeView { return this.core.readScope(scope) }

  /** Injection projection; see {@link MemoryCore.projection}. */
  projection(scope: string): Projection { return this.core.projection(scope) }

  /** Deterministic keyword search; see {@link MemoryCore.search}. */
  search(scope: string, query: string): SearchHit[] { return this.core.search(scope, query) }

  /** Dream state with revisions; see {@link MemoryCore.dreamLoad}. */
  dreamLoad(scope: string): DreamState { return this.core.dreamLoad(scope) }

  /** Tail of the scope's dream log; see {@link MemoryCore.dreamLogTail}. */
  dreamLogTail(scope: string, maxChars?: number): string { return this.core.dreamLogTail(scope, maxChars) }

  /** Apply typed decisions; see {@link MemoryCore.dreamApply}. */
  dreamApply(scope: string, decisions: readonly DreamDecision[], summary: string): DreamReport {
    return this.core.dreamApply(scope, decisions, summary)
  }

  /** Joined injection text over the configured inject scopes. */
  injectText(): string { return this.core.injectText() }

  // -- dream runtime state & executor ---------------------------------------

  /** Current dream settings (runtime switch / model / schedule). */
  dreamSettings(): DreamSettings { return readDreamSettings(this.core.root) }

  /** Merge a partial update into the dream settings; returns the new state. */
  setDreamSettings(partial: Partial<DreamSettings>): DreamSettings { return updateDreamSettings(this.core.root, partial) }

  private dreamInFlight = false

  /**
   * Run one dream consolidation in-process: a fresh one-shot agent session
   * (full session log = audit) driven by the canonical dream prompt, with
   * the model resolved as dream.json route > plugin default (yzjModels) >
   * harness default. Refuses when the switch is off or a run is in flight.
   */
  async dreamRun(trigger: string): Promise<{ ok: true; sessionId: string; report?: DreamReport; note: string } | { ok: false; error: string }> {
    const state = this.dreamSettings()
    if (!state.enabled) return { ok: false, error: 'dream 未开启（dream.json enabled=false）' }
    if (this.dreamInFlight) return { ok: false, error: '已有 dream 正在运行，请稍候' }
    const agents = this.ctx.get('agents')
    if (agents === undefined) return { ok: false, error: 'agents 服务不可用（dream 执行器需要 web/headless profile）' }
    // Ensures the vault root (the executor session's cwd) exists.
    this.core.vault('user')
    const route = state.provider !== undefined && state.model !== undefined
      ? { provider: state.provider, model: state.model }
      : this.ctx.get('yzjModels')?.get()
    const sessionId = `dream-${timestampId()}-${Math.random().toString(16).slice(2, 6)}`
    this.dreamInFlight = true
    try {
      const handle = await agents.create({
        sessionId: SessionId(sessionId),
        meta: { cwd: this.core.root },
        ...(route === undefined ? {} : { agentOptions: route }),
      })
      handle.agent.followup(createUserMessage({
        content: [{ type: 'text', text: DREAM_PROMPT }],
        source: { kind: 'plugin', plugin: 'memory-yzj' },
      }))
      const timedOut = await Promise.race([
        handle.agent.whenIdle().then(() => false as const),
        new Promise<true>(resolve => { setTimeout(() => resolve(true), DREAM_RUN_TIMEOUT_MS) }),
      ])
      const report = this.core.lastDreamReport('user')
      const note = timedOut
        ? `固化会话 ${sessionId} 超过 ${Math.round(DREAM_RUN_TIMEOUT_MS / 60_000)} 分钟未收敛（会话仍在后台运行，结果稍后见固化日志）`
        : report === undefined
          ? `固化会话 ${sessionId} 已完成，但未产生固化报告（可查会话日志排查）`
          : `固化完成：提升 ${report.counts.promoted} · 丢弃 ${report.counts.dropped} · 段写 ${report.counts.sectionsWritten} · 实体写 ${report.counts.entitiesWritten} · 拒绝 ${report.counts.rejected}`
      updateDreamSettings(this.core.root, { lastNote: `${todayKey()} ${trigger}：${note}` })
      return { ok: true, sessionId, ...(report === undefined ? {} : { report }), note }
    } catch (error) {
      const errorNote = `固化失败：${error instanceof Error ? error.message : String(error)}`
      updateDreamSettings(this.core.root, { lastNote: `${todayKey()} ${trigger}：${errorNote}` })
      return { ok: false, error: errorNote }
    } finally {
      this.dreamInFlight = false
    }
  }

  /** One scheduler tick: fire the daily dream when due (idempotent per day). */
  tickDaily(): void {
    if (!shouldFireDaily(this.dreamSettings())) return
    // Stamp first so a slow run (or a restart mid-run) never double-fires.
    updateDreamSettings(this.core.root, { lastRunDay: todayKey() })
    void this.dreamRun('schedule')
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    yzjMemory: YzjMemoryService
  }
}

/** Plugin entry: service + tools + (optional) prompt-injection context + daily tick. */
export function apply(ctx: Context, config: Config): void {
  const service = new YzjMemoryService(ctx, config)
  applyMemoryTools(ctx, service.core, {
    maxRenderChars: config.maxRenderChars ?? 20_000,
    maxMetaChars: config.maxMetaChars ?? 50_000,
  }, () => service.dreamSettings().enabled)
  // Opportunistic: profiles without prompt assembly (ops daemon) still get
  // the service and tools; injection exists only where systemPrompt does.
  const systemPrompt = ctx.get('systemPrompt')
  if (systemPrompt !== undefined) {
    ctx.effect(() => systemPrompt.context({
      name: 'yzj-memory',
      order: 0,
      text: () => service.core.injectText(),
    }))
  }
  // Daily dream tick (armed by dream.json: enabled + dailyAt); one check per
  // minute, restart-safe through the persisted lastRunDay stamp.
  ctx.effect(() => {
    const timer = setInterval(() => { service.tickDaily() }, 60_000)
    return () => clearInterval(timer)
  })
}

export type {
  DreamDecision, DreamItemResult, DreamReport, DreamState,
  ObserveResult, Projection, ScopeView, SearchHit,
}
export { MemoryCore, parseDecision } from './service.ts'
export type { EntityEntry, ObservationEntry, SectionEntry } from './vault.ts'
export { MemoryVault, DEFAULT_INJECT_CHAR_CAP } from './vault.ts'
export type { DreamSettings } from './dream.ts'
export { DREAM_PROMPT, DREAM_RUN_TIMEOUT_MS, shouldFireDaily, todayKey } from './dream.ts'
