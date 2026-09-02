/**
 * model-yzj: the plugin-wide default model route for dsh-yzj packages.
 * One editable default (provider + model) stored as plain JSON under
 * `$DSH_HOME/yzj-model.json`, shared by every consumer in this bundle —
 * robot channels fall back to it at the end of their resolution chain, and
 * the memory dream executor prefers it over the harness default. The file is
 * hand-editable and re-read on every access, so external edits apply live.
 * @module @dsh-yzj/model-yzj
 */

import { randomBytes } from 'node:crypto'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Context, Service } from '@deepseek-ai/cordis'
import { expandHomePath, resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import z from '@deepseek-ai/schemastery'

/** Read a file as UTF-8 text, or undefined when it does not exist. */
function readText(path: string): string | undefined {
  try {
    return readFileSync(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

/** Write a file atomically (same volume): temp sibling + rename. */
function atomicWrite(path: string, content: string): void {
  const tmp = `${path}.tmp-${process.pid}-${randomBytes(4).toString('hex')}`
  writeFileSync(tmp, content, 'utf8')
  renameSync(tmp, path)
}

/** A resolved model route; both fields are present together or neither. */
export interface YzjModelRoute {
  readonly provider: string
  readonly model: string
}

/** One provider entry of the UI catalog. */
export interface YzjModelCatalogEntry {
  readonly provider: string
  readonly models: string[]
}

/** model-yzj configuration; the schema fills every default. */
export interface Config {
  /** Store location. Defaults to `$DSH_HOME/yzj-model.json`; `~` expands. */
  path?: string
}

export const Config: z<Config> = z.object({
  path: z.string(),
})

/** The plugin-wide default-model service. */
export class YzjModels extends Service {
  private readonly filePath: string

  constructor(ctx: Context, config: Config) {
    super(ctx, 'yzjModels')
    this.filePath = config.path !== undefined && config.path !== ''
      ? expandHomePath(config.path)
      : join(resolveDshHome(), 'yzj-model.json')
  }

  /** Store path (diagnostics / UI display). */
  get path(): string {
    return this.filePath
  }

  /** The current default route, or undefined when unset or malformed. */
  get(): YzjModelRoute | undefined {
    const raw = readText(this.filePath)
    if (raw === undefined) return undefined
    try {
      const parsed: unknown = JSON.parse(raw)
      if (typeof parsed !== 'object' || parsed === null) return undefined
      const provider = (parsed as { provider?: unknown }).provider
      const model = (parsed as { model?: unknown }).model
      if (typeof provider !== 'string' || typeof model !== 'string') return undefined
      if (provider.trim() === '' || model.trim() === '') return undefined
      return { provider: provider.trim(), model: model.trim() }
    } catch {
      // A hand-edited malformed file reads as "unset"; the next write heals it.
      return undefined
    }
  }

  /** Persist the default route (both fields required, trimmed). */
  async setDefault(provider: string, model: string): Promise<YzjModelRoute> {
    const cleanProvider = provider.trim()
    const cleanModel = model.trim()
    if (cleanProvider === '' || cleanModel === '') {
      throw new Error('model-yzj: setDefault requires non-empty provider and model')
    }
    atomicWrite(this.filePath, `${JSON.stringify({ provider: cleanProvider, model: cleanModel }, null, 2)}\n`)
    return { provider: cleanProvider, model: cleanModel }
  }

  /** Remove the default (consumers fall back to the harness default). */
  async clear(): Promise<void> {
    atomicWrite(this.filePath, '{\n  "provider": "",\n  "model": ""\n}\n')
  }

  /**
   * Provider/model catalog for UI pickers: active adapter routes only
   * (`listProviders`), dormant-but-configurable providers excluded — the
   * same policy the robot settings picker applies. Reads the `llm` service
   * opportunistically; an absent service yields an empty catalog.
   */
  async catalog(): Promise<YzjModelCatalogEntry[]> {
    const llm = this.ctx.get('llm')
    if (llm === undefined) return []
    const face = llm as {
      listProviders?: () => { provider?: string }[]
      listConfigurableProviders?: () => { provider?: string }[]
      listModels?: (provider: string) => Promise<{ id?: string; model?: string }[]>
    }
    const names = [
      ...(face.listProviders?.() ?? []).map(entry => String(entry.provider ?? '')),
      ...(face.listConfigurableProviders?.() ?? []).map(entry => String(entry.provider ?? '')),
    ].filter(name => name !== '')
    const out: YzjModelCatalogEntry[] = []
    for (const provider of [...new Set(names)]) {
      try {
        const models = await face.listModels?.(provider) ?? []
        out.push({ provider, models: models.map(m => String(m.id ?? m.model ?? '')).filter(id => id !== '') })
      } catch (error) {
        this.ctx.logger.warn(`model-yzj: listModels failed for ${provider}: ${String(error)}`)
        out.push({ provider, models: [] })
      }
    }
    return out
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    yzjModels: YzjModels
  }
}

/** Cordis plugin name used by loader diagnostics. */
export const name = 'model-yzj'
/** No hard dependencies: `llm` is read opportunistically for the catalog. */
export const inject: readonly string[] = []

/** Plugin entry: the service alone. */
export function apply(ctx: Context, config: Config): void {
  void new YzjModels(ctx, config)
}
