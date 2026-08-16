/**
 * The memory core: scope resolution, read/projection/search surfaces, and
 * the dream consolidation apply-loop. Deliberately free of Cordis types so
 * the logic is unit-testable against a temp directory; the thin service
 * wrapper (`YzjMemoryService`) only adds plugin lifetime.
 *
 * Governance recap (docs/spec/memory-vault-design.md §3): agents write
 * observations only; dream sessions write sections/entities and dispose
 * observations through validated, rev-checked decisions; humans may edit
 * any file directly, and a dream never overwrites content it did not read
 * (stale-rev items fail without touching the file).
 * @module @dsh-yzj/memory-yzj/service
 */

import { join } from 'node:path'
import { MemoryVault } from './vault.ts'
import type { EntityEntry, ObservationEntry, SectionEntry } from './vault.ts'
import { dateStr } from './frontmatter.ts'

/** Valid scope ids: `user` or `group:<id>` with a filesystem-safe group id. */
const SCOPE_RE = /^(user|group:[A-Za-z0-9_-]{1,64})$/

/** One memory-observing tool call's input (tags/source optional). */
export interface ObserveInput {
  readonly content: string
  readonly tags?: readonly string[]
  readonly source?: string
}

/** Result of one observation write. */
export interface ObserveResult {
  readonly id: string
  /** True when an identical open observation already existed (no new file). */
  readonly duplicate: boolean
  readonly openCount: number
  readonly capacity: number
}

/** Bounded read view of one scope (feeds `memory_read` and the UI payload). */
export interface ScopeView {
  readonly scope: string
  readonly cap: number
  readonly sections: { readonly name: string; readonly title: string; readonly order: number; readonly excerpt: string }[]
  readonly entities: { readonly name: string; readonly title: string; readonly excerpt: string }[]
  readonly observations: readonly ObservationEntry[]
  readonly archivedCount: number
}

/** Injection projection of one scope. */
export interface Projection {
  readonly text: string
  readonly truncated: boolean
  readonly chars: number
  readonly cap: number
}

/** One deterministic search hit. */
export interface SearchHit {
  /** `section` / `entity` / `observation`. */
  readonly kind: 'section' | 'entity' | 'observation'
  /** Section/entity name or observation id. */
  readonly ref: string
  readonly score: number
  /** Best matching line, clipped. */
  readonly line: string
}

/** Full state snapshot for one dream run (carries revs for apply). */
export interface DreamState {
  readonly scope: string
  readonly cap: number
  readonly sections: readonly SectionEntry[]
  readonly entities: readonly EntityEntry[]
  readonly observations: readonly ObservationEntry[]
  readonly archivedCount: number
}

/** One dream decision (discriminated on `type`; validated per item in code). */
export interface DreamDecision {
  readonly type: 'promote_observation' | 'drop_observation' | 'update_section' | 'upsert_entity' | 'log_only'
  readonly observationId?: string
  readonly section?: string
  readonly entity?: string
  readonly content?: string
  readonly title?: string
  readonly order?: number
  readonly tags?: string[]
  readonly status?: string
  readonly rev?: string
  readonly note?: string
}

/** Outcome of one applied (or rejected) decision. */
export interface DreamItemResult {
  readonly decision: string
  readonly ok: boolean
  readonly detail: string
  /** Failure reason code for rejected items. */
  readonly reason?: string
}

/** Aggregate dream report. */
export interface DreamReport {
  readonly scope: string
  readonly logId: string
  readonly results: readonly DreamItemResult[]
  readonly counts: {
    readonly promoted: number
    readonly dropped: number
    readonly sectionsWritten: number
    readonly entitiesWritten: number
    readonly rejected: number
  }
}

/** Resolved configuration for the memory core. */
export interface MemoryCoreConfig {
  /** Absolute vault root; one subdirectory per scope. */
  readonly vaultRoot: string
  /** Scopes the tools may address. */
  readonly allowScopes: string[]
  /** Scopes injected into every prompt assembly. */
  readonly injectScopes: string[]
  readonly injectCharCap: number
  readonly observationsMax: number
  readonly maxSearchHits: number
}

/** Truncation marker appended when a projection exceeds its cap. */
const TRUNCATION_NOTE = '（已达注入上限，完整内容用 memory_read 查看）'

/**
 * Memory core over one vault root. All methods are synchronous by design
 * (small bounded files; sync access is atomic within one process).
 */
export class MemoryCore {
  /** Last dream report per scope (executor result surface). */
  private readonly lastReports = new Map<string, DreamReport>()

  constructor(private readonly config: MemoryCoreConfig) {}

  /** Absolute vault root (dream state file + executor session cwd). */
  get root(): string { return this.config.vaultRoot }

  /** Validate and resolve one scope to its vault; ensures the skeleton. */
  vault(scope: string): MemoryVault {
    if (!SCOPE_RE.test(scope) || !this.config.allowScopes.includes(scope)) {
      throw new Error(`memory-yzj: scope ${JSON.stringify(scope)} is not in allowScopes [${this.config.allowScopes.join(', ')}]`)
    }
    const directory = scope === 'user' ? 'user' : scope.replace('group:', 'group-')
    const vault = new MemoryVault(join(this.config.vaultRoot, directory), this.config.observationsMax, this.config.injectCharCap)
    vault.ensure()
    return vault
  }

  /** Record one observation (deduped against identical open content). */
  observe(scope: string, input: ObserveInput, now = new Date()): ObserveResult {
    const vault = this.vault(scope)
    const content = input.content.trim()
    if (content === '') throw new Error('memory-yzj: observation content must not be empty')
    const tags = input.tags === undefined ? [] : [...input.tags]
    const source = input.source === undefined || input.source === '' ? 'agent' : input.source
    const open = vault.listObservations('open')
    const existing = open.find(item => item.content === content.slice(0, 2000))
    if (existing !== undefined) {
      return { id: existing.id, duplicate: true, openCount: open.length, capacity: this.config.observationsMax }
    }
    const id = vault.createObservation({ content, tags, source }, now)
    return { id, duplicate: false, openCount: open.length + 1, capacity: this.config.observationsMax }
  }

  /** Bounded read view of one scope. */
  readScope(scope: string): ScopeView {
    const vault = this.vault(scope)
    const sections = vault.listSections()
    const entities = vault.listEntities()
    return {
      scope,
      cap: vault.cap(),
      sections: sections.map(s => ({ name: s.name, title: s.title, order: s.order, excerpt: excerptOf(s.content) })),
      entities: entities.map(e => ({ name: e.name, title: e.title, excerpt: excerptOf(e.content) })),
      observations: vault.listObservations('open'),
      archivedCount: vault.listObservations('archived').length,
    }
  }

  /** Injection projection: sections in order under a header, capped. */
  projection(scope: string): Projection {
    const vault = this.vault(scope)
    const cap = vault.cap()
    const parts = vault.listSections().map(s => `## ${s.title}\n\n${s.content.trim()}`)
    if (parts.length === 0) return { text: '', truncated: false, chars: 0, cap }
    const full = `# 记忆库 · ${scope}\n\n${parts.join('\n\n')}`
    if (full.length <= cap) return { text: full, truncated: false, chars: full.length, cap }
    const cut = full.slice(0, cap).trimEnd()
    return { text: `${cut}\n\n${TRUNCATION_NOTE}`, truncated: true, chars: cut.length, cap }
  }

  /** Joined injection text over `injectScopes`; empty string when all empty. */
  injectText(): string {
    const blocks: string[] = []
    for (const scope of this.config.injectScopes) {
      const { text } = this.projection(scope)
      if (text !== '') blocks.push(text)
    }
    return blocks.join('\n\n---\n\n')
  }

  /** Deterministic multi-token keyword search across one scope. */
  search(scope: string, query: string): SearchHit[] {
    const tokens = query.toLowerCase().split(/\s+/).filter(token => token !== '')
    if (tokens.length === 0) return []
    const vault = this.vault(scope)
    const hits: SearchHit[] = []
    for (const section of vault.listSections()) {
      const hit = scoreNote(section.title, section.tags, section.content, tokens)
      if (hit !== undefined) hits.push({ kind: 'section', ref: section.name, score: hit.score, line: hit.line })
    }
    for (const entity of vault.listEntities()) {
      const hit = scoreNote(entity.title, entity.tags, entity.content, tokens)
      if (hit !== undefined) hits.push({ kind: 'entity', ref: entity.name, score: hit.score, line: hit.line })
    }
    for (const observation of vault.listObservations('open')) {
      const hit = scoreNote('', observation.tags, observation.content, tokens)
      if (hit !== undefined) hits.push({ kind: 'observation', ref: observation.id, score: hit.score, line: hit.line })
    }
    const kindRank = { section: 0, entity: 1, observation: 2 } as const
    return hits
      .sort((a, b) => b.score - a.score || kindRank[a.kind] - kindRank[b.kind] || (a.ref < b.ref ? -1 : 1))
      .slice(0, this.config.maxSearchHits)
  }

  /** Full snapshot with revisions, the entry surface of a dream run. */
  dreamLoad(scope: string): DreamState {
    const vault = this.vault(scope)
    return {
      scope,
      cap: vault.cap(),
      sections: vault.listSections(),
      entities: vault.listEntities(),
      observations: vault.listObservations('open'),
      archivedCount: vault.listObservations('archived').length,
    }
  }

  /** Tail of the scope's dream log (UI transparency surface). */
  dreamLogTail(scope: string, maxChars = 4000): string {
    return this.vault(scope).logTail(maxChars)
  }

  /** The most recent dream report of one scope, when any apply happened. */
  lastDreamReport(scope: string): DreamReport | undefined {
    return this.lastReports.get(scope)
  }

  /**
   * Apply one dream's decision list item by item. Every item is validated
   * against the current files; a stale rev (file changed since load) or a
   * missing target rejects that item only — the rest still apply. The log
   * entry and index rebuild always run, so a report exists even when every
   * item was rejected.
   */
  dreamApply(scope: string, decisions: readonly DreamDecision[], summary: string, now = new Date()): DreamReport {
    const vault = this.vault(scope)
    const results: DreamItemResult[] = []
    const counts = { promoted: 0, dropped: 0, sectionsWritten: 0, entitiesWritten: 0, rejected: 0 }
    for (const decision of decisions) {
      try {
        results.push(applyDecision(vault, decision, counts))
      } catch (error) {
        counts.rejected += 1
        results.push({ decision: decision.type, ok: false, detail: describeDecision(decision), reason: reasonOf(error) })
      }
    }
    const logId = `${dateStr(now)} ${Math.random().toString(16).slice(2, 10)}`
    const lines = [`## [${logId}] dream`, '', summary.trim(), '']
    for (const result of results) {
      lines.push(`${result.ok ? '- ' : '- ✗ '}${result.decision} — ${result.detail}${result.reason === undefined ? '' : ` (rejected: ${result.reason})`}`)
    }
    vault.appendLog(lines.join('\n'))
    vault.rebuildIndex()
    const report: DreamReport = { scope, logId, results, counts }
    this.lastReports.set(scope, report)
    return report
  }

  /**
   * Apply one dream from raw tool input: each entry is parsed and validated
   * first; malformed entries become pre-rejected report items instead of
   * failing the whole batch. Valid entries flow through {@link dreamApply}.
   */
  dreamApplyRaw(scope: string, raws: readonly unknown[], summary: string, now = new Date()): DreamReport {
    const decisions: DreamDecision[] = []
    const invalid: DreamItemResult[] = []
    for (const raw of raws) {
      const type = typeof raw === 'object' && raw !== null ? String((raw as { type?: unknown }).type ?? '') : ''
      try {
        decisions.push(parseDecision(raw))
      } catch (error) {
        invalid.push({
          decision: type === '' ? '(missing type)' : type,
          ok: false,
          detail: describeRaw(raw),
          reason: error instanceof Error ? error.message : String(error),
        })
      }
    }
    const report = this.dreamApply(scope, decisions, summary, now)
    if (invalid.length === 0) return report
    return {
      ...report,
      results: [...invalid, ...report.results],
      counts: { ...report.counts, rejected: report.counts.rejected + invalid.length },
    }
  }
}

/** Short description of one malformed raw decision entry. */
function describeRaw(raw: unknown): string {
  return JSON.stringify(raw).slice(0, 120)
}

/** Parse and validate one raw decision entry into the typed shape. */
export function parseDecision(raw: unknown): DreamDecision {
  if (typeof raw !== 'object' || raw === null) throw new Error('decision must be an object')
  const record = raw as Record<string, unknown>
  const type = record['type']
  const allowed = ['promote_observation', 'drop_observation', 'update_section', 'upsert_entity', 'log_only']
  if (typeof type !== 'string' || !allowed.includes(type)) {
    throw new Error(`decision.type must be one of ${allowed.join(' | ')}`)
  }
  const optional = (key: string): string | undefined => {
    const value = record[key]
    if (value === undefined) return undefined
    if (typeof value !== 'string') throw new Error(`decision.${key} must be a string`)
    return value
  }
  const tags = record['tags']
  if (tags !== undefined && (!Array.isArray(tags) || tags.some(tag => typeof tag !== 'string'))) {
    throw new Error('decision.tags must be an array of strings')
  }
  const order = record['order']
  if (order !== undefined && (typeof order !== 'number' || !Number.isFinite(order))) {
    throw new Error('decision.order must be a number')
  }
  const observationId = optional('observationId')
  const section = optional('section')
  const entity = optional('entity')
  const content = optional('content')
  const title = optional('title')
  const status = optional('status')
  const rev = optional('rev')
  const note = optional('note')
  return {
    type: type as DreamDecision['type'],
    ...(observationId === undefined ? {} : { observationId }),
    ...(section === undefined ? {} : { section }),
    ...(entity === undefined ? {} : { entity }),
    ...(content === undefined ? {} : { content }),
    ...(title === undefined ? {} : { title }),
    ...(order === undefined ? {} : { order }),
    ...(Array.isArray(tags) ? { tags: tags as string[] } : {}),
    ...(status === undefined ? {} : { status }),
    ...(rev === undefined ? {} : { rev }),
    ...(note === undefined ? {} : { note }),
  }
}

/** Clip one note body to a single-line excerpt. */
function excerptOf(content: string): string {
  const line = content.split('\n').find(part => part.trim() !== '') ?? ''
  return line.length > 120 ? `${line.slice(0, 120)}…` : line
}

/** Score one note against lowercase tokens; undefined when nothing matched. */
function scoreNote(title: string, tags: readonly string[], content: string, tokens: readonly string[]): { score: number; line: string } | undefined {
  const haystackTitle = `${title} ${tags.join(' ')}`.toLowerCase()
  const haystackBody = content.toLowerCase()
  let score = 0
  let bestLine = ''
  for (const token of tokens) {
    if (haystackTitle.includes(token)) score += 2
    let occurrences = 0
    let index = haystackBody.indexOf(token)
    while (index >= 0 && occurrences < 5) {
      occurrences += 1
      index = haystackBody.indexOf(token, index + token.length)
    }
    score += occurrences
    if (bestLine === '' && occurrences > 0) {
      const source = content.split('\n').find(part => part.toLowerCase().includes(token)) ?? ''
      bestLine = source.length > 160 ? `${source.slice(0, 160)}…` : source
    }
  }
  return score === 0 ? undefined : { score, line: bestLine }
}

/** Human-readable one-line description of a decision for the report. */
function describeDecision(decision: DreamDecision): string {
  switch (decision.type) {
    case 'promote_observation': return `${decision.observationId ?? '?'} → sections/${decision.section ?? '?'}`
    case 'drop_observation': return decision.observationId ?? '?'
    case 'update_section': return `sections/${decision.section ?? '?'}`
    case 'upsert_entity': return `entities/${decision.entity ?? '?'}`
    case 'log_only': return decision.note ?? ''
  }
}

/** Map one apply error to a stable reason code (fallback: the message). */
function reasonOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('rev')) return 'rev-conflict'
  if (message.includes('not found')) return 'not-found'
  if (message.includes('must not be empty') || message.includes('not allowed in file names')) return 'invalid-name'
  if (message.includes('exceeds')) return 'content-too-long'
  return message
}

/** Validate and apply one decision; throws with reason-compatible messages. */
function applyDecision(vault: MemoryVault, decision: DreamDecision, counts: { promoted: number; dropped: number; sectionsWritten: number; entitiesWritten: number; rejected: number }): DreamItemResult {
  switch (decision.type) {
    case 'promote_observation': {
      const id = requireString(decision.observationId, 'observationId')
      const sectionName = requireString(decision.section, 'section')
      const content = requireContent(decision.content, 2000, 'content')
      const observation = vault.readObservation(id, false)
      if (observation === undefined) throw new Error(`${id} not found in open observations`)
      const existing = vault.readSection(sectionName)
      checkRev(existing?.rev, decision.rev, `sections/${sectionName}`)
      const order = decision.order ?? (existing?.order ?? nextOrder(vault))
      vault.appendSection(sectionName, {
        title: decision.title ?? existing?.title ?? sectionName,
        order,
        tags: decision.tags ?? existing?.tags ?? observation.tags,
        content,
      })
      vault.archiveObservation(id)
      counts.promoted += 1
      counts.sectionsWritten += 1
      return { decision: decision.type, ok: true, detail: `${id} → sections/${sectionName}` }
    }
    case 'drop_observation': {
      const id = requireString(decision.observationId, 'observationId')
      if (!vault.archiveObservation(id)) throw new Error(`${id} not found in open observations`)
      counts.dropped += 1
      return { decision: decision.type, ok: true, detail: id }
    }
    case 'update_section': {
      const sectionName = requireString(decision.section, 'section')
      const content = requireContent(decision.content, 8000, 'content')
      const existing = vault.readSection(sectionName)
      checkRev(existing?.rev, decision.rev, `sections/${sectionName}`)
      vault.writeSection(sectionName, {
        title: decision.title ?? existing?.title ?? sectionName,
        order: decision.order ?? existing?.order ?? nextOrder(vault),
        tags: decision.tags ?? existing?.tags ?? [],
        content,
      })
      counts.sectionsWritten += 1
      return { decision: decision.type, ok: true, detail: `sections/${sectionName} (${existing === undefined ? 'created' : 'rewritten'})` }
    }
    case 'upsert_entity': {
      const entityName = requireString(decision.entity, 'entity')
      const content = requireContent(decision.content, 8000, 'content')
      const existing = vault.readEntity(entityName)
      checkRev(existing?.rev, decision.rev, `entities/${entityName}`)
      vault.writeEntity(entityName, {
        title: decision.title ?? existing?.title ?? entityName,
        tags: decision.tags ?? existing?.tags ?? [],
        status: decision.status ?? existing?.status ?? '',
        content,
      })
      counts.entitiesWritten += 1
      return { decision: decision.type, ok: true, detail: `entities/${entityName} (${existing === undefined ? 'created' : 'rewritten'})` }
    }
    case 'log_only': {
      return { decision: decision.type, ok: true, detail: decision.note ?? '' }
    }
  }
}

/** Read a required string field of one decision. */
function requireString(value: string | undefined, field: string): string {
  if (value === undefined || value.trim() === '') throw new Error(`${field} must not be empty`)
  return value.trim()
}

/** Read required bounded content of one decision. */
function requireContent(value: string | undefined, max: number, field: string): string {
  const text = requireString(value, field)
  if (text.length > max) throw new Error(`${field} exceeds ${max} characters`)
  return text
}

/** Enforce the optional rev check: mismatch ⇒ rev-conflict; absent target with a rev ⇒ not found. */
function checkRev(currentRev: string | undefined, decisionRev: string | undefined, label: string): void {
  if (decisionRev === undefined) return
  if (currentRev === undefined) throw new Error(`${label} not found (rev supplied for a missing file)`)
  if (currentRev !== decisionRev) throw new Error(`stale rev for ${label}`)
}

/** First free order slot after the current maximum (new sections/entities). */
function nextOrder(vault: MemoryVault): number {
  const orders = vault.listSections().map(section => section.order)
  const max = orders.length === 0 ? 90 : Math.max(...orders)
  return max + 10
}
