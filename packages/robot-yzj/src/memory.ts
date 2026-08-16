/**
 * Durable per-conversation memory (Claude-Tag channel rules, S4): short
 * user-declared instructions ("记住本群规则：…") stored in their own
 * storage-domain and injected as instructions context into every turn of
 * that conversation. Long playbooks stay in the knowledge base (design);
 * this store holds the small, stable instruction set only.
 * @module @dsh-yzj/robot-yzj/memory
 */

import { z } from 'zod'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import type { Domain, KvTable } from '@deepseek-ai/dsh-storage-domain'

/** Cap on stored lines per conversation — memory is curated, not a log. */
export const MEMORY_MAX_LINES = 30

/** One conversation's memory row: creation-ordered instruction lines. */
export interface MemoryRow {
  readonly lines: readonly string[]
}

const memoryRowSchema = z.object({
  lines: z.array(z.string().min(1).max(400)),
}) as unknown as z.ZodType<MemoryRow>

/** Durable domain declaration: one table keyed by conversation key. */
export const robotMemoryDomainSpec = defineDomain({
  name: 'robot_yzj_memory',
  version: 0,
  tables: {
    conversations: domainTable<string, MemoryRow>(memoryRowSchema),
  },
})

/** Result of one memory mutation, for the confirmation reply. */
export interface MemoryMutation {
  /** Stored lines after the mutation. */
  readonly lines: readonly string[]
  /** What the mutation did (reply text fragment). */
  readonly note: string
}

/** Read/write face over the opened memory domain. */
export class MemoryStore {
  private table: KvTable<string, MemoryRow> | undefined

  /**
   * Open (or adopt) the domain; safe to await repeatedly.
   * @param facility - the `ctx.storageDomain` facility.
   */
  async open(facility: { open(spec: typeof robotMemoryDomainSpec): Promise<Domain<typeof robotMemoryDomainSpec>> }): Promise<void> {
    if (this.table !== undefined) return
    const domain = await facility.open(robotMemoryDomainSpec)
    this.table = domain.table('conversations')
  }

  /** Close the domain (idempotent). */
  async close(): Promise<void> {
    this.table = undefined
  }

  /** One conversation's lines ('' entries never stored). */
  lines(key: string): readonly string[] {
    return this.table?.get(key)?.lines ?? []
  }

  /** All memories as lossless JSON entries. */
  entries(): { key: string; lines: readonly string[] }[] {
    const out: { key: string; lines: readonly string[] }[] = []
    for (const [key, row] of this.table?.entries() ?? []) out.push({ key, lines: row.lines })
    return out
  }

  /** Append one line (deduped, capped); reports the resulting set. */
  async remember(key: string, line: string): Promise<MemoryMutation> {
    const trimmed = line.trim().slice(0, 400)
    const existing = [...this.lines(key)]
    if (trimmed !== '' && !existing.includes(trimmed)) {
      existing.push(trimmed)
      while (existing.length > MEMORY_MAX_LINES) existing.shift()
      await this.table?.put(key, { lines: existing })
      return { lines: existing, note: '已记住' }
    }
    return { lines: existing, note: existing.includes(trimmed) ? '这条已经在记忆里了' : '内容为空，未记录' }
  }

  /** Remove lines containing the substring; reports how many went. */
  async forget(key: string, substring: string): Promise<MemoryMutation> {
    const needle = substring.trim().toLowerCase()
    const existing = this.lines(key)
    const kept = existing.filter(line => !line.toLowerCase().includes(needle))
    const removed = existing.length - kept.length
    if (removed > 0) {
      if (kept.length === 0) await this.table?.delete(key)
      else await this.table?.put(key, { lines: kept })
    }
    return { lines: kept, note: removed > 0 ? `已忘掉 ${removed} 条` : '没有匹配的记忆' }
  }
}
