/**
 * Durable per-conversation SURFACE state for the robot channel: the last
 * inbound identity (robotId/robotName/groupType) and the last anchored session
 * id of every conversation a channel has seen, plus the most-recent groupId
 * per channel. Outliving restarts lets DSH-side continuation
 * (`robot_continue`) and fork resolve the real robot/group identity and the
 * exact session id without waiting for a fresh inbound message. Stored as one
 * storage-domain KV table (json backend under the harness home); keys embed
 * the channel index so colliding robotIds across channels never mix.
 * @module @dsh-yzj/robot-yzj/surface
 */

import { z } from 'zod'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import type { Domain, KvTable } from '@deepseek-ai/dsh-storage-domain'

/** One conversation surface as last seen from the wire. */
export interface SurfaceState {
  /** Encrypted robot id (the id space the WS inbound carries). */
  readonly robotId: string
  readonly robotName: string
  /** 3 = the BOT-DM/group surface this robot lives on. */
  readonly groupType: number
  /** Unix epoch ms of the last inbound message on this surface. */
  readonly time: number
  /** The last session id anchored on this surface (continuation target). */
  readonly lastSessionId?: string
}

/** A plain string value for the channel-level meta table (recent groupId). */
export interface MetaValue {
  readonly value: string
}

const surfaceSchema = z.object({
  robotId: z.string().min(1),
  robotName: z.string(),
  groupType: z.number().int(),
  time: z.number().int(),
  lastSessionId: z.string().min(1).optional(),
}) as unknown as z.ZodType<SurfaceState>

const metaSchema = z.object({
  value: z.string().min(1),
})

/** Durable domain declaration: per-conversation surfaces + channel meta. */
export const robotSurfaceDomainSpec = defineDomain({
  name: 'robot_yzj_surface',
  version: 0,
  tables: {
    surfaces: domainTable<string, SurfaceState>(surfaceSchema),
    meta: domainTable<string, MetaValue>(metaSchema),
  },
})

/** Persisted key of one conversation surface (channel + group scoped). */
export function surfaceKey(channelIndex: number, groupId: string): string {
  return `surface:${channelIndex}:${groupId}`
}

/** Persisted key of one channel's most-recent groupId. */
export function recentKey(channelIndex: number): string {
  return `recent:${channelIndex}`
}

/** Minimal read/write face a router needs; SurfaceStore satisfies it. */
export interface SurfaceStoreFace {
  get(key: string): SurfaceState | undefined
  put(key: string, value: SurfaceState): Promise<void>
  /** Channel meta (most-recent groupId) read. */
  getMeta(key: string): MetaValue | undefined
  putMeta(key: string, value: MetaValue): Promise<void>
  /** Every persisted surface record (for status projection). */
  entries(): [string, SurfaceState][]
}

/**
 * Read/write face over the opened domain. `open()` resolves once the storage
 * hub has the domain form; until then every method is inert (returns
 * undefined / no-ops), so routers never block on storage readiness.
 */
export class SurfaceStore implements SurfaceStoreFace {
  private table: KvTable<string, SurfaceState> | undefined
  private meta: KvTable<string, MetaValue> | undefined

  /**
   * Open (or adopt) the domain; safe to await repeatedly.
   * @param facility - the `ctx.storageDomain` facility.
   */
  async open(facility: { open(spec: typeof robotSurfaceDomainSpec): Promise<Domain<typeof robotSurfaceDomainSpec>> }): Promise<void> {
    if (this.table !== undefined) return
    const domain = await facility.open(robotSurfaceDomainSpec)
    this.table = domain.table('surfaces')
    this.meta = domain.table('meta')
  }

  /** Close the domain (idempotent). */
  async close(): Promise<void> {
    this.table = undefined
    this.meta = undefined
  }

  /** One conversation surface, or undefined (unopened store included). */
  get(key: string): SurfaceState | undefined {
    return this.table?.get(key)
  }

  /** Persist one surface record. */
  async put(key: string, value: SurfaceState): Promise<void> {
    await this.table?.put(key, value)
  }

  /** One channel meta record, or undefined. */
  getMeta(key: string): MetaValue | undefined {
    return this.meta?.get(key)
  }

  /** Persist one channel meta record. */
  async putMeta(key: string, value: MetaValue): Promise<void> {
    await this.meta?.put(key, value)
  }

  /** Every persisted surface record (lossless JSON snapshot). */
  entries(): [string, SurfaceState][] {
    return [...(this.table?.entries() ?? [])]
  }
}
