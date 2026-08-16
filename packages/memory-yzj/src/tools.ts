/**
 * Model-facing memory tools: observe, read, search, and the two dream
 * surfaces (load/apply). Digests are bounded; the structured payload rides
 * `output.presentationMeta` exactly like the yzj tool family. Per the design
 * (§3, D4) none of these enter the yzj WRITE_SPECS confirmation gate — the
 * vault is local, human-auditable storage, not a Yunzhijia-side write.
 * @module @dsh-yzj/memory-yzj/tools
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { JsonValue } from '@deepseek-ai/dsh-tools'
import type { DreamReport, DreamState, MemoryCore, ScopeView, SearchHit } from './service.ts'

/** Render/payload budget shared by the memory tools. */
export interface MemoryToolBudget {
  readonly maxRenderChars: number
  readonly maxMetaChars: number
}

/** Common tool value: model-facing digest + capped structured payload. */
interface MemoryToolValue {
  content: string
  truncated: boolean
  data: JsonValue
}

/** Shared output contract (same shape as the yzj tool family). */
const memoryToolOutput: {
  readonly schema: {
    readonly type: 'object'
    readonly additionalProperties: false
    readonly properties: {
      readonly content: { readonly type: 'string'; readonly required: true }
      readonly truncated: { readonly type: 'boolean'; readonly required: true }
      readonly data: { readonly type: 'json' }
    }
  }
  render(_args: unknown, value: MemoryToolValue): { type: 'text'; text: string }[]
  presentationMeta(_args: unknown, value: MemoryToolValue): JsonValue
} = {
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      content: { type: 'string', required: true },
      truncated: { type: 'boolean', required: true },
      data: { type: 'json' },
    },
  },
  render: (_args, value) => [{ type: 'text', text: value.content }],
  presentationMeta: (_args, value) => value.data,
}

/** Clip a digest to the render budget. */
function clip(text: string, max: number): { content: string; truncated: boolean } {
  return text.length <= max ? { content: text, truncated: false } : { content: `${text.slice(0, max)}\n…(truncated)`, truncated: true }
}

/** Clip a structured payload to the meta budget (whole-value replace on overflow). */
function clipMeta(value: unknown, max: number): JsonValue {
  const text = JSON.stringify(value) ?? 'null'
  if (text.length <= max) return JSON.parse(text) as JsonValue
  return { truncated: true, chars: text.length, preview: text.slice(0, max) }
}

/** Format the read view as a bounded digest. */
function readDigest(view: ScopeView): string {
  const lines: string[] = [`scope ${view.scope} · 注入上限 ${view.cap} 字符`]
  lines.push('', `## sections (${view.sections.length})`)
  if (view.sections.length === 0) lines.push('- (none)')
  for (const section of view.sections) lines.push(`- ${section.name}（order ${section.order}）${section.excerpt}`)
  lines.push('', `## entities (${view.entities.length})`)
  if (view.entities.length === 0) lines.push('- (none)')
  for (const entity of view.entities) lines.push(`- ${entity.name} ${entity.excerpt}`)
  lines.push('', `## observations (${view.observations.length} open / ${view.archivedCount} archived)`)
  for (const observation of view.observations) {
    const tags = observation.tags.length === 0 ? '' : ` [${observation.tags.join(',')}]`
    lines.push(`- ${observation.id} ${observation.created}${tags} (${observation.source})`)
    lines.push(`  ${observation.content.split('\n')[0] ?? ''}`)
  }
  return lines.join('\n')
}

/** Format one search hit digest line. */
function hitLine(hit: SearchHit): string {
  return `${hit.kind} ${hit.ref} · score ${hit.score}${hit.line === '' ? '' : `\n  ${hit.line}`}`
}

/** Format the dream report digest. */
function reportDigest(report: DreamReport): string {
  const { counts } = report
  const head = `固化完成 [${report.logId}]：提升 ${counts.promoted} · 丢弃 ${counts.dropped} · 段写 ${counts.sectionsWritten} · 实体写 ${counts.entitiesWritten} · 拒绝 ${counts.rejected}`
  const items = report.results.map(result =>
    `${result.ok ? '✓' : '✗'} ${result.decision} — ${result.detail}${result.reason === undefined ? '' : ` (${result.reason})`}`)
  return items.length === 0 ? head : `${head}\n${items.join('\n')}`
}

/** Parse the `decisions` JSON-string parameter into a raw entry array. */
function parseDecisionsJson(text: string): unknown[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw new Error(`decisions must be a JSON array: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (!Array.isArray(parsed)) throw new Error('decisions must be a JSON array of decision objects')
  return parsed
}

/** Register the five memory tools over one core. */
export function applyMemoryTools(ctx: Context, core: MemoryCore, budget: MemoryToolBudget): void {
  ctx.tools.register(defineTool({
    name: 'memory_observe',
    description: 'Record one observation into the memory vault scratchpad (a provisional signal, not yet curated memory). Observations are consolidated into sections/entities by the periodic dream; use this whenever the user states a durable preference, fact, decision, or project context worth keeping.',
    parameters: {
      content: { type: 'string', required: true, description: 'The signal to remember, self-contained (≤2000 chars; longer content is trimmed).' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Optional free-form tags for later filtering.' },
      scope: { type: 'string', description: 'Memory scope; defaults to "user".' },
      source: { type: 'string', description: 'Provenance label, e.g. "routine:<id>"; defaults to "agent".' },
    },
    output: memoryToolOutput,
    isConcurrencySafe: () => true,
    async execute(args) {
      const result = core.observe(args.scope ?? 'user', {
        content: args.content,
        tags: args.tags ?? [],
        source: args.source === undefined || args.source === '' ? 'agent' : args.source,
      })
      const { content, truncated } = clip(
        `${result.duplicate ? '已有相同观察' : '已记录观察'} ${result.id}（scope ${args.scope ?? 'user'}，open ${result.openCount}/${result.capacity}）`,
        budget.maxRenderChars,
      )
      return { content, truncated, data: clipMeta(result, budget.maxMetaChars) }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'memory_read',
    description: 'Read one memory scope: section summaries, entity summaries, and full open observations. Injected context is capped, so use this for the complete picture before answering with memory or before editing.',
    parameters: {
      scope: { type: 'string', description: 'Memory scope; defaults to "user".' },
    },
    output: memoryToolOutput,
    isConcurrencySafe: () => true,
    async execute(args) {
      const view = core.readScope(args.scope ?? 'user')
      const { content, truncated } = clip(readDigest(view), budget.maxRenderChars)
      return { content, truncated, data: clipMeta(view, budget.maxMetaChars) }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'memory_search',
    description: 'Deterministic keyword search over one memory scope (sections, entities, open observations). Tokens match title/tags and content; hits carry the best matching line.',
    parameters: {
      query: { type: 'string', required: true, description: 'Whitespace-separated keywords.' },
      scope: { type: 'string', description: 'Memory scope; defaults to "user".' },
    },
    output: memoryToolOutput,
    isConcurrencySafe: () => true,
    async execute(args) {
      const hits = core.search(args.scope ?? 'user', args.query)
      const body = hits.length === 0 ? '(no matches)' : hits.map(hitLine).join('\n')
      const { content, truncated } = clip(body, budget.maxRenderChars)
      return { content, truncated, data: clipMeta({ hits }, budget.maxMetaChars) }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'memory_dream_load',
    description: 'Dream entry point: load one memory scope\'s full state — sections and entities with content revisions (rev), and every open observation. Weigh each observation against the corroboration rules, then submit decisions with memory_dream_apply referencing the revs returned here.',
    parameters: {
      scope: { type: 'string', required: true, description: 'Memory scope to consolidate (e.g. "user").' },
    },
    output: memoryToolOutput,
    isConcurrencySafe: () => true,
    async execute(args) {
      const state: DreamState = core.dreamLoad(args.scope)
      const head = `scope ${state.scope} · ${state.sections.length} sections / ${state.entities.length} entities / ${state.observations.length} open observations`
      const hint = '对每条 open observation 判定：promote（多源佐证或明确稳定）/ drop（已被 sections/entities 覆盖）/ 留观（单源信号）；过时段落用 update_section 重写。decisions 必须引用本 load 返回的 rev。'
      const { content, truncated } = clip(`${head}\n\n${hint}`, budget.maxRenderChars)
      return { content, truncated, data: clipMeta(state, budget.maxMetaChars) }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'memory_dream_apply',
    description: 'Apply one dream\'s decisions to a memory scope: promote/drop observations, rewrite sections, upsert entities. Each item is validated (stale rev or missing target rejects that item only); the log and index are always rebuilt. Call once per dream after memory_dream_load.',
    parameters: {
      scope: { type: 'string', required: true, description: 'Memory scope being consolidated.' },
      decisions: { type: 'string', required: true, description: 'JSON array of decisions; each item {type: promote_observation|drop_observation|update_section|upsert_entity|log_only, …fields, rev? from dream load}.' },
      summary: { type: 'string', required: true, description: 'One-paragraph human-readable dream summary for the log.' },
    },
    output: memoryToolOutput,
    async execute(args) {
      const report = core.dreamApplyRaw(args.scope, parseDecisionsJson(args.decisions), args.summary)
      const { content, truncated } = clip(reportDigest(report), budget.maxRenderChars)
      return { content, truncated, data: clipMeta(report, budget.maxMetaChars) }
    },
  }))
}
