/**
 * DreamPool: the 蓄水池 for the AI推进 Dream rhythm (spec §17, 决策 33/34).
 * Work-scan signals are copied in as pending entries; a Dream trigger (manual
 * button / watermark hint / scheduled wake) lets the model distill the pending
 * batch into entries + suggestion cards, then marks them done. Entries are
 * never deleted (audit trail).
 * @module @dsh-yzj/tool-yzj/advance-dreampool
 */

import { z } from 'zod'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import type { Domain, KvTable } from '@deepseek-ai/dsh-storage-domain'

/** One pooled signal awaiting Dream distillation. */
export interface DreamPoolEntry {
  readonly id: string
  /** Channel token the signal came from (`im:<groupId>` / `dir:<docId>`). */
  readonly channel: string
  /** Traceable id of the original signal (msgId / docId). */
  readonly refId: string
  readonly content: string
  readonly sendTime: string
  readonly enqueuedAt: number
  readonly done: boolean
}

const entrySchema = z.object({
  id: z.string().min(1),
  channel: z.string(),
  refId: z.string(),
  content: z.string(),
  sendTime: z.string(),
  enqueuedAt: z.number().int(),
  done: z.boolean(),
}) as unknown as z.ZodType<DreamPoolEntry>

const entryListSchema = z.array(entrySchema) as unknown as z.ZodType<DreamPoolEntry[]>

const POOL_KEY = 'pending'
const META_KEY = 'meta'

/** Durable domain: pool list + last-dream meta. */
export const yzjAdvanceDreamPoolDomainSpec = defineDomain({
  name: 'yzj_advance_dreampool',
  version: 0,
  tables: {
    pool: domainTable<string, DreamPoolEntry[]>(entryListSchema),
    meta: domainTable<string, { lastDreamAt: number }>(z.object({ lastDreamAt: z.number().int() }) as never),
  },
})

/** Read/write face used by scan (enqueue), the dream tools, and the board RPC. */
export interface DreamPoolFace {
  /** Pending (undistilled) entries, oldest first. */
  pending(): DreamPoolEntry[]
  /** By-id lookup including done (entries are never deleted, so dp-* refs on 事元 stay resolvable). */
  lookup(ids: readonly string[]): DreamPoolEntry[]
  /** Enqueue one signal copy; duplicate refId+channel stays single (pool dedup). */
  enqueue(entry: Omit<DreamPoolEntry, 'id' | 'enqueuedAt' | 'done'>): Promise<DreamPoolEntry>
  /** Mark entries done after a Dream distillation. */
  markDone(ids: readonly string[]): Promise<number>
  /** Last dream run timestamp, or undefined. */
  lastDreamAt(): number | undefined
  /** Record one dream run. */
  recordDream(at?: number): Promise<void>
}

/**
 * Read/write face over the opened domain. Memory-backed until `open()` —
 * same pattern as ScanCursorStore / AdvanceThreadStore.
 */
export class DreamPoolStore implements DreamPoolFace {
  private table: KvTable<string, DreamPoolEntry[]> | undefined
  private meta: KvTable<string, { lastDreamAt: number }> | undefined
  private memoryPool: DreamPoolEntry[] = []
  private memoryLastDream: number | undefined
  private seq = 0

  /** Open (or adopt) the domain; safe to await repeatedly. */
  async open(facility: { open(spec: typeof yzjAdvanceDreamPoolDomainSpec): Promise<Domain<typeof yzjAdvanceDreamPoolDomainSpec>> }): Promise<void> {
    if (this.table !== undefined) return
    const domain = await facility.open(yzjAdvanceDreamPoolDomainSpec)
    this.table = domain.table('pool')
    this.meta = domain.table('meta')
    if (this.memoryPool.length > 0) await this.table.put(POOL_KEY, this.memoryPool)
    this.memoryPool = []
    if (this.memoryLastDream !== undefined) {
      await this.meta.put(META_KEY, { lastDreamAt: this.memoryLastDream })
      this.memoryLastDream = undefined
    }
  }

  private list(): DreamPoolEntry[] {
    return this.table?.get(POOL_KEY) ?? this.memoryPool
  }

  private async persist(next: DreamPoolEntry[]): Promise<void> {
    if (this.table !== undefined) {
      await this.table.put(POOL_KEY, next)
      return
    }
    this.memoryPool = next
  }

  pending(): DreamPoolEntry[] {
    return this.list().filter(entry => !entry.done)
  }

  lookup(ids: readonly string[]): DreamPoolEntry[] {
    const wanted = new Set(ids)
    return this.list().filter(entry => wanted.has(entry.id))
  }

  async enqueue(entry: Omit<DreamPoolEntry, 'id' | 'enqueuedAt' | 'done'>): Promise<DreamPoolEntry> {
    const current = this.list()
    const dup = current.find(row => row.channel === entry.channel && row.refId === entry.refId)
    if (dup !== undefined) return dup
    this.seq += 1
    const full: DreamPoolEntry = {
      ...entry,
      id: `dp-${Date.now()}-${this.seq}`,
      enqueuedAt: Date.now(),
      done: false,
    }
    await this.persist([...current, full])
    return full
  }

  async markDone(ids: readonly string[]): Promise<number> {
    const wanted = new Set(ids)
    let marked = 0
    const next = this.list().map((entry) => {
      if (!entry.done && wanted.has(entry.id)) {
        marked += 1
        return { ...entry, done: true }
      }
      return entry
    })
    if (marked > 0) await this.persist(next)
    return marked
  }

  lastDreamAt(): number | undefined {
    return this.meta?.get(META_KEY)?.lastDreamAt ?? this.memoryLastDream
  }

  async recordDream(at = Date.now()): Promise<void> {
    if (this.meta !== undefined) {
      await this.meta.put(META_KEY, { lastDreamAt: at })
      return
    }
    this.memoryLastDream = at
  }
}
