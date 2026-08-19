/**
 * Durable per-group scan cursors for AI推进 auto-discovery
 * (docs/spec/ai-advance-design.md §14 / 决策 18). Host owns the cursor so
 * the model cannot rewind or skip. Memory-backed until `open()` — same
 * pattern as HomeBindingStore / SurfaceStore.
 * @module @dsh-yzj/tool-yzj/scan-cursors
 */

import { z } from 'zod'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import type { Domain, KvTable } from '@deepseek-ai/dsh-storage-domain'

/** One group's incremental IM cursor. */
export interface ScanCursor {
  readonly lastMsgId: string
  readonly scannedAt: number
  readonly groupName: string
}

/** Last patrol wave summary (P4 board line). */
export interface ScanPatrolMeta {
  readonly scannedAt: number
  readonly found: number
}

/** One knowledge-base directory thread's snapshot cursor (v1.7, 决策 32): docId → updateTime. */
export interface DirScanCursor {
  readonly knownDocs: Readonly<Record<string, string>>
  readonly scannedAt: number
  readonly label: string
}

const cursorSchema = z.object({
  lastMsgId: z.string().min(1),
  scannedAt: z.number().int(),
  groupName: z.string(),
}) as unknown as z.ZodType<ScanCursor>

const patrolSchema = z.object({
  scannedAt: z.number().int(),
  found: z.number().int(),
}) as unknown as z.ZodType<ScanPatrolMeta>

const dirCursorSchema = z.object({
  knownDocs: z.record(z.string(), z.string()),
  scannedAt: z.number().int(),
  label: z.string(),
}) as unknown as z.ZodType<DirScanCursor>

/** Durable domain: groupId → cursor + last-patrol meta + dir:<docId> → doc snapshot. */
export const yzjAdvanceScanDomainSpec = defineDomain({
  name: 'yzj_advance_scan_cursors',
  version: 0,
  tables: {
    cursors: domainTable<string, ScanCursor>(cursorSchema),
    meta: domainTable<string, ScanPatrolMeta>(patrolSchema),
    dirs: domainTable<string, DirScanCursor>(dirCursorSchema),
  },
})

const LAST_KEY = 'last'

/** Read/write face used by scan + the board RPC. */
export interface ScanCursorStoreFace {
  get(groupId: string): ScanCursor | undefined
  put(groupId: string, value: ScanCursor): Promise<void>
  entries(): [string, ScanCursor][]
  lastPatrol(): ScanPatrolMeta | undefined
  recordPatrol(found: number, at?: number): Promise<void>
  /** One directory thread's snapshot cursor (`dir:<docId>` key), or undefined. */
  getDir(key: string): DirScanCursor | undefined
  /** Persist one directory thread's snapshot. */
  putDir(key: string, value: DirScanCursor): Promise<void>
}

/**
 * Read/write face over the opened domain. Until `open()`, methods use the
 * in-memory maps so tests and early calls never block on the hub.
 */
export class ScanCursorStore implements ScanCursorStoreFace {
  private table: KvTable<string, ScanCursor> | undefined
  private meta: KvTable<string, ScanPatrolMeta> | undefined
  private dirs: KvTable<string, DirScanCursor> | undefined
  private readonly memoryCursors = new Map<string, ScanCursor>()
  private readonly memoryDirs = new Map<string, DirScanCursor>()
  private memoryPatrol: ScanPatrolMeta | undefined

  /**
   * Open (or adopt) the domain; safe to await repeatedly.
   * @param facility - the `ctx.storageDomain` facility.
   */
  async open(facility: { open(spec: typeof yzjAdvanceScanDomainSpec): Promise<Domain<typeof yzjAdvanceScanDomainSpec>> }): Promise<void> {
    if (this.table !== undefined) return
    const domain = await facility.open(yzjAdvanceScanDomainSpec)
    this.table = domain.table('cursors')
    this.meta = domain.table('meta')
    this.dirs = domain.table('dirs')
    for (const [key, value] of this.memoryCursors) await this.table.put(key, value)
    this.memoryCursors.clear()
    for (const [key, value] of this.memoryDirs) await this.dirs.put(key, value)
    this.memoryDirs.clear()
    if (this.memoryPatrol !== undefined) {
      await this.meta.put(LAST_KEY, this.memoryPatrol)
      this.memoryPatrol = undefined
    }
  }

  /** One group's cursor, or undefined. */
  get(groupId: string): ScanCursor | undefined {
    return this.table?.get(groupId) ?? this.memoryCursors.get(groupId)
  }

  /** Persist one group's cursor. */
  async put(groupId: string, value: ScanCursor): Promise<void> {
    if (this.table !== undefined) {
      await this.table.put(groupId, value)
      return
    }
    this.memoryCursors.set(groupId, value)
  }

  /** Every persisted cursor (durable table when open, else memory). */
  entries(): [string, ScanCursor][] {
    if (this.table !== undefined) {
      const rows: [string, ScanCursor][] = []
      for (const [key, value] of this.table.entries()) rows.push([key, value])
      return rows
    }
    return [...this.memoryCursors.entries()]
  }

  /** Last patrol wave, or undefined when never scanned. */
  lastPatrol(): ScanPatrolMeta | undefined {
    return this.meta?.get(LAST_KEY) ?? this.memoryPatrol
  }

  /** Record a patrol wave (found = new signals after self/robot filter). */
  async recordPatrol(found: number, at = Date.now()): Promise<void> {
    const value: ScanPatrolMeta = { scannedAt: at, found }
    if (this.meta !== undefined) {
      await this.meta.put(LAST_KEY, value)
      return
    }
    this.memoryPatrol = value
  }

  /** One directory thread's snapshot cursor, or undefined. */
  getDir(key: string): DirScanCursor | undefined {
    return this.dirs?.get(key) ?? this.memoryDirs.get(key)
  }

  /** Persist one directory thread's snapshot. */
  async putDir(key: string, value: DirScanCursor): Promise<void> {
    if (this.dirs !== undefined) {
      await this.dirs.put(key, value)
      return
    }
    this.memoryDirs.set(key, value)
  }
}

/** Board snapshot of the last patrol (lossless JSON). */
export interface AdvanceScanState {
  scannedAt: number | null
  found: number
  groups: { groupId: string; groupName: string; lastMsgId: string; scannedAt: number }[]
}

/** Project the store into the panel RPC shape. */
export function scanStateOf(store: ScanCursorStoreFace): AdvanceScanState {
  const patrol = store.lastPatrol()
  return {
    scannedAt: patrol?.scannedAt ?? null,
    found: patrol?.found ?? 0,
    groups: store.entries().map(([groupId, cursor]) => ({
      groupId,
      groupName: cursor.groupName,
      lastMsgId: cursor.lastMsgId,
      scannedAt: cursor.scannedAt,
    })),
  }
}
