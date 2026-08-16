/**
 * Durable per-conversation model overrides for the robot channel: which
 * provider/model a group conversation or DM session should use, outliving
 * restarts. Stored as one storage-domain KV table (json backend under the
 * harness home); the key names the conversation surface so group and DM
 * surfaces never collide.
 * @module @dsh-yzj/robot-yzj/overrides
 */

import { z } from 'zod'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import type { Domain, KvTable } from '@deepseek-ai/dsh-storage-domain'
/** One override: both fields optional — set only what you want to pin. */
export interface ModelOverride {
  /** Provider route (e.g. 'opencode-go'); empty/undefined = inherit. */
  readonly provider?: string
  /** Model id (e.g. 'deepseek-v4-flash'); empty/undefined = inherit. */
  readonly model?: string
}

/** Conversation keys: `g:<groupId>` for group surfaces, `dm:<robotId>:<openId>` for DMs. */
export function groupKey(groupId: string): string {
  return `g:${groupId}`
}

/** @see groupKey */
export function dmKey(robotId: string, operatorOpenid: string): string {
  return `dm:${robotId}:${operatorOpenid}`
}

const overrideSchema = z.object({
  provider: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
}).refine(value => value.provider !== undefined || value.model !== undefined, {
  message: 'model override must set at least one of provider/model',
}) as unknown as z.ZodType<ModelOverride>

/** Durable domain declaration: one table keyed by conversation key. */
export const robotOverridesDomainSpec = defineDomain({
  name: 'robot_yzj_overrides',
  version: 0,
  tables: {
    conversations: domainTable<string, ModelOverride>(overrideSchema),
  },
})

/**
 * Read/write face over the opened domain. `open()` resolves once the storage
 * hub has the domain form; until then every method rejects.
 */
export class OverrideStore {
  private table: KvTable<string, ModelOverride> | undefined

  /**
   * Open (or adopt) the domain; safe to await repeatedly.
   * @param facility - the `ctx.storageDomain` facility.
   */
  async open(facility: { open(spec: typeof robotOverridesDomainSpec): Promise<Domain<typeof robotOverridesDomainSpec>> }): Promise<void> {
    if (this.table !== undefined) return
    const domain = await facility.open(robotOverridesDomainSpec)
    this.table = domain.table('conversations')
  }

  /** Close the domain (idempotent). */
  async close(): Promise<void> {
    this.table = undefined
  }

  /** One conversation's override, or undefined. */
  get(key: string): ModelOverride | undefined {
    return this.table?.get(key)
  }

  /** Persist one override (whole-record replace). */
  async put(key: string, override: ModelOverride): Promise<void> {
    await this.table?.put(key, override)
  }

  /** Remove one override. */
  async delete(key: string): Promise<boolean> {
    return this.table?.delete(key) ?? false
  }

  /** All overrides as lossless JSON entries. */
  entries(): { key: string; provider?: string; model?: string }[] {
    const out: { key: string; provider?: string; model?: string }[] = []
    for (const [key, value] of this.table?.entries() ?? []) {
      out.push({
        key,
        ...(value.provider === undefined ? {} : { provider: value.provider }),
        ...(value.model === undefined ? {} : { model: value.model }),
      })
    }
    return out
  }
}
