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
import z from '@deepseek-ai/schemastery'
import { MemoryCore } from './service.ts'
import type {
  DreamDecision, DreamItemResult, DreamReport, DreamState, MemoryCoreConfig,
  ObserveResult, Projection, ScopeView, SearchHit,
} from './service.ts'
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
  observe(scope: string, content: string, options: { tags?: string[]; source?: string } = {}): ObserveResult {
    return this.core.observe(scope, { content, tags: options.tags ?? [], source: options.source ?? 'agent' })
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
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    yzjMemory: YzjMemoryService
  }
}

/** Plugin entry: service + tools + (optional) prompt-injection context. */
export function apply(ctx: Context, config: Config): void {
  const service = new YzjMemoryService(ctx, config)
  applyMemoryTools(ctx, service.core, {
    maxRenderChars: config.maxRenderChars ?? 20_000,
    maxMetaChars: config.maxMetaChars ?? 50_000,
  })
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
}

export type {
  DreamDecision, DreamItemResult, DreamReport, DreamState,
  ObserveResult, Projection, ScopeView, SearchHit,
}
export { MemoryCore, parseDecision } from './service.ts'
export type { EntityEntry, ObservationEntry, SectionEntry } from './vault.ts'
export { MemoryVault, DEFAULT_INJECT_CHAR_CAP } from './vault.ts'
