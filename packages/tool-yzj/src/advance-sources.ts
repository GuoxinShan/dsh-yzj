/**
 * Intent-thread subscription registry for advancement items (spec §15.2,
 * 决策 20). One advancement item subscribes to N data channels ("上下文来源" / context sources; pre-v1.8 name "意图线程");
 * the registry maps advanceId → thread rows. `im:` threads are persistent
 * channels (cursor-based incremental scan, spec §15.3); `doc:` / `todo:` /
 * `event:` / `file:` threads are single-document sources (association lands
 * one 事元, content-update detection is out of scope for ③.2). Host-owned
 * storage-domain `yzj_advance_threads` — the dbt double table is untouched.
 * Memory-backed until `open()` — same pattern as ScanCursorStore.
 * @module @dsh-yzj/tool-yzj/advance-sources
 */

import { z } from 'zod'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import type { Domain, KvTable } from '@deepseek-ai/dsh-storage-domain'

/** Thread classes with different collection semantics (spec §15.1). */
export type ContextSourceKind = 'persistent' | 'document'

/** Who attached the thread: panel RPC = user, `yzj_advance_create` = agent. */
export type ContextSourceActor = 'user' | 'agent'

/** One subscribed channel of one advancement item. */
export interface ContextSource {
  readonly token: string
  readonly kind: ContextSourceKind
  readonly label: string
  readonly addedBy: ContextSourceActor
  readonly addedAt: number
}

/** Token prefixes of the refs vocabulary (spec §15.2; `dir:` added in v1.7 — 知识库目录,持续渠道). */
export const SOURCE_PREFIXES = ['im', 'doc', 'todo', 'event', 'file', 'dir'] as const

/** Literal token grammar: `im:<groupId>` / `doc:<docId>` / `dir:<docId>` / … (spec §15.2). */
const SOURCE_TOKEN_RE = /^(im|doc|todo|event|file|dir):([A-Za-z0-9_-]+)$/

/** Parsed thread token; undefined when the grammar does not match. */
export function parseSourceToken(token: string): { prefix: typeof SOURCE_PREFIXES[number]; id: string } | undefined {
  const match = SOURCE_TOKEN_RE.exec(token.trim())
  if (match === null) return undefined
  return { prefix: match[1] as typeof SOURCE_PREFIXES[number], id: match[2] ?? '' }
}

/** Thread class of one prefix: `im:` and `dir:` are persistent, the rest document. */
export function sourceKindOf(prefix: string): ContextSourceKind | undefined {
  if (prefix === 'im' || prefix === 'dir') return 'persistent'
  if (prefix === 'doc' || prefix === 'todo' || prefix === 'event' || prefix === 'file') return 'document'
  return undefined
}

/** 事元 `来源类型` a single-document source token maps to (spec §15.1). */
export function sourceTypeOfToken(prefix: string): string {
  if (prefix === 'todo') return '待办'
  if (prefix === 'event') return '日程'
  return '文档'
}

const sourceSchema = z.object({
  token: z.string().min(1),
  kind: z.enum(['persistent', 'document']),
  label: z.string(),
  addedBy: z.enum(['user', 'agent']),
  addedAt: z.number().int(),
}) as unknown as z.ZodType<ContextSource>

const sourceListSchema = z.array(sourceSchema) as unknown as z.ZodType<ContextSource[]>

/** Durable domain: advanceId → subscribed context-source rows. */
export const yzjAdvanceSourcesDomainSpec = defineDomain({
  name: 'yzj_advance_sources',
  version: 0,
  tables: {
    sources: domainTable<string, ContextSource[]>(sourceListSchema),
  },
})

/** Legacy domain (pre-v1.8 name `yzj_advance_threads`); read once for migration. */
const legacyThreadsDomainSpec = defineDomain({
  name: 'yzj_advance_threads',
  version: 0,
  tables: {
    threads: domainTable<string, ContextSource[]>(sourceListSchema),
  },
})

/** Read/write face used by the advance core, the service, and the scan tool. */
export interface ContextSourceStoreFace {
  sourcesOf(advanceId: string): ContextSource[]
  add(advanceId: string, source: ContextSource): Promise<{ added: boolean; sources: ContextSource[] }>
  remove(advanceId: string, token: string): Promise<ContextSource[]>
  entries(): [string, ContextSource[]][]
}

/**
 * Read/write face over the opened domain. Until `open()`, methods use the
 * in-memory map so tests and early calls never block on the hub. Adding an
 * already-subscribed token is a no-op (idempotent; 决策 19 dedupes the
 * document-source 事元 through refs).
 */
export class ContextSourceStore implements ContextSourceStoreFace {
  private table: KvTable<string, ContextSource[]> | undefined
  private readonly memory = new Map<string, ContextSource[]>()

  /**
   * Open (or adopt) the domain; safe to await repeatedly.
   * @param facility - the `ctx.storageDomain` facility.
   */
  async open(facility: { open(spec: typeof yzjAdvanceSourcesDomainSpec): Promise<Domain<typeof yzjAdvanceSourcesDomainSpec>> }): Promise<void> {
    if (this.table !== undefined) return
    const domain = await facility.open(yzjAdvanceSourcesDomainSpec)
    this.table = domain.table('sources')
    for (const [key, value] of this.memory) await this.table.put(key, value)
    this.memory.clear()
    // v1.8 legacy migration: pre-rename data lives in `yzj_advance_threads`;
    // copy once when the new domain is still empty. Best-effort (legacy may not exist).
    try {
      const legacy = await facility.open(legacyThreadsDomainSpec as never)
      const oldTable = (legacy as { table(name: string): KvTable<string, ContextSource[]> }).table('threads')
      const hasNew = [...this.table.entries()].some(([, rows]) => rows.length > 0)
      if (!hasNew) {
        for (const [key, rows] of oldTable.entries()) {
          if (rows.length > 0) await this.table.put(key, rows)
        }
      }
    } catch {
      // legacy domain absent — nothing to migrate
    }
  }

  /** One item's subscribed context sources (insertion order), [] when none. */
  sourcesOf(advanceId: string): ContextSource[] {
    return this.table?.get(advanceId) ?? this.memory.get(advanceId) ?? []
  }

  /** Subscribe one source; duplicate tokens return `added: false`. */
  async add(advanceId: string, source: ContextSource): Promise<{ added: boolean; sources: ContextSource[] }> {
    const current = this.sourcesOf(advanceId)
    if (current.some(row => row.token === source.token)) {
      return { added: false, sources: current }
    }
    const next = [...current, source]
    await this.persist(advanceId, next)
    return { added: true, sources: next }
  }

  /** Unsubscribe one token; unknown tokens leave the row list unchanged. */
  async remove(advanceId: string, token: string): Promise<ContextSource[]> {
    const current = this.sourcesOf(advanceId)
    const next = current.filter(row => row.token !== token)
    if (next.length === current.length) return current
    await this.persist(advanceId, next)
    return next
  }

  /** Every item carrying at least one thread (durable table when open). */
  entries(): [string, ContextSource[]][] {
    if (this.table !== undefined) {
      const rows: [string, ContextSource[]][] = []
      for (const [key, value] of this.table.entries()) rows.push([key, value])
      return rows
    }
    return [...this.memory.entries()]
  }

  private async persist(advanceId: string, threads: ContextSource[]): Promise<void> {
    if (this.table !== undefined) {
      await this.table.put(advanceId, threads)
      return
    }
    this.memory.set(advanceId, threads)
  }
}
