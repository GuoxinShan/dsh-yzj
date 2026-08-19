/**
 * Intent-thread subscription registry for advancement items (spec §15.2,
 * 决策 20). One advancement item subscribes to N data channels ("意图线程");
 * the registry maps advanceId → thread rows. `im:` threads are persistent
 * channels (cursor-based incremental scan, spec §15.3); `doc:` / `todo:` /
 * `event:` / `file:` threads are single-document sources (association lands
 * one 事元, content-update detection is out of scope for ③.2). Host-owned
 * storage-domain `yzj_advance_threads` — the dbt double table is untouched.
 * Memory-backed until `open()` — same pattern as ScanCursorStore.
 * @module @dsh-yzj/tool-yzj/advance-threads
 */

import { z } from 'zod'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import type { Domain, KvTable } from '@deepseek-ai/dsh-storage-domain'

/** Thread classes with different collection semantics (spec §15.1). */
export type AdvanceThreadKind = 'persistent' | 'document'

/** Who attached the thread: panel RPC = user, `yzj_advance_create` = agent. */
export type AdvanceThreadActor = 'user' | 'agent'

/** One subscribed channel of one advancement item. */
export interface AdvanceThread {
  readonly token: string
  readonly kind: AdvanceThreadKind
  readonly label: string
  readonly addedBy: AdvanceThreadActor
  readonly addedAt: number
}

/** Token prefixes of the refs vocabulary (spec §15.2). */
export const THREAD_PREFIXES = ['im', 'doc', 'todo', 'event', 'file'] as const

/** Literal token grammar: `im:<groupId>` / `doc:<docId>` / … (spec §15.2). */
const THREAD_TOKEN_RE = /^(im|doc|todo|event|file):([A-Za-z0-9_-]+)$/

/** Parsed thread token; undefined when the grammar does not match. */
export function parseThreadToken(token: string): { prefix: typeof THREAD_PREFIXES[number]; id: string } | undefined {
  const match = THREAD_TOKEN_RE.exec(token.trim())
  if (match === null) return undefined
  return { prefix: match[1] as typeof THREAD_PREFIXES[number], id: match[2] ?? '' }
}

/** Thread class of one prefix: `im:` is persistent, the rest document. */
export function threadKindOf(prefix: string): AdvanceThreadKind | undefined {
  if (prefix === 'im') return 'persistent'
  if (prefix === 'doc' || prefix === 'todo' || prefix === 'event' || prefix === 'file') return 'document'
  return undefined
}

/** 事元 `来源类型` a single-document source token maps to (spec §15.1). */
export function sourceTypeOfThread(prefix: string): string {
  if (prefix === 'todo') return '待办'
  if (prefix === 'event') return '日程'
  return '文档'
}

const threadSchema = z.object({
  token: z.string().min(1),
  kind: z.enum(['persistent', 'document']),
  label: z.string(),
  addedBy: z.enum(['user', 'agent']),
  addedAt: z.number().int(),
}) as unknown as z.ZodType<AdvanceThread>

const threadListSchema = z.array(threadSchema) as unknown as z.ZodType<AdvanceThread[]>

/** Durable domain: advanceId → subscribed thread rows. */
export const yzjAdvanceThreadsDomainSpec = defineDomain({
  name: 'yzj_advance_threads',
  version: 0,
  tables: {
    threads: domainTable<string, AdvanceThread[]>(threadListSchema),
  },
})

/** Read/write face used by the advance core, the service, and the scan tool. */
export interface AdvanceThreadStoreFace {
  threadsOf(advanceId: string): AdvanceThread[]
  add(advanceId: string, thread: AdvanceThread): Promise<{ added: boolean; threads: AdvanceThread[] }>
  remove(advanceId: string, token: string): Promise<AdvanceThread[]>
  entries(): [string, AdvanceThread[]][]
}

/**
 * Read/write face over the opened domain. Until `open()`, methods use the
 * in-memory map so tests and early calls never block on the hub. Adding an
 * already-subscribed token is a no-op (idempotent; 决策 19 dedupes the
 * document-source 事元 through refs).
 */
export class AdvanceThreadStore implements AdvanceThreadStoreFace {
  private table: KvTable<string, AdvanceThread[]> | undefined
  private readonly memory = new Map<string, AdvanceThread[]>()

  /**
   * Open (or adopt) the domain; safe to await repeatedly.
   * @param facility - the `ctx.storageDomain` facility.
   */
  async open(facility: { open(spec: typeof yzjAdvanceThreadsDomainSpec): Promise<Domain<typeof yzjAdvanceThreadsDomainSpec>> }): Promise<void> {
    if (this.table !== undefined) return
    const domain = await facility.open(yzjAdvanceThreadsDomainSpec)
    this.table = domain.table('threads')
    for (const [key, value] of this.memory) await this.table.put(key, value)
    this.memory.clear()
  }

  /** One item's subscribed threads (insertion order), [] when none. */
  threadsOf(advanceId: string): AdvanceThread[] {
    return this.table?.get(advanceId) ?? this.memory.get(advanceId) ?? []
  }

  /** Subscribe one thread; duplicate tokens return `added: false`. */
  async add(advanceId: string, thread: AdvanceThread): Promise<{ added: boolean; threads: AdvanceThread[] }> {
    const current = this.threadsOf(advanceId)
    if (current.some(row => row.token === thread.token)) {
      return { added: false, threads: current }
    }
    const next = [...current, thread]
    await this.persist(advanceId, next)
    return { added: true, threads: next }
  }

  /** Unsubscribe one token; unknown tokens leave the row list unchanged. */
  async remove(advanceId: string, token: string): Promise<AdvanceThread[]> {
    const current = this.threadsOf(advanceId)
    const next = current.filter(row => row.token !== token)
    if (next.length === current.length) return current
    await this.persist(advanceId, next)
    return next
  }

  /** Every item carrying at least one thread (durable table when open). */
  entries(): [string, AdvanceThread[]][] {
    if (this.table !== undefined) {
      const rows: [string, AdvanceThread[]][] = []
      for (const [key, value] of this.table.entries()) rows.push([key, value])
      return rows
    }
    return [...this.memory.entries()]
  }

  private async persist(advanceId: string, threads: AdvanceThread[]): Promise<void> {
    if (this.table !== undefined) {
      await this.table.put(advanceId, threads)
      return
    }
    this.memory.set(advanceId, threads)
  }
}
