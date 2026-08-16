/**
 * Durable DSH-home binding table: one Yunzhijia conversation (group or DM)
 * maps to exactly one DSH session. This is the product object in
 * docs/spec/dsh-home-session.md — shared by robot inbound `followup()` and
 * the panel pick-group path — not a private lastSession hint inside
 * robot-yzj.
 * @module @dsh-yzj/tool-yzj/home
 */

import { Context, Service } from '@deepseek-ai/cordis'
import { z } from 'zod'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import type { Domain, KvTable } from '@deepseek-ai/dsh-storage-domain'
import {
  BoundLogStore, formatSummonWindow, type BoundLogAppendResult, type BoundLogLimits,
  type YzjBoundMessageLog, type YzjLogEntry,
} from './bound-log.ts'

/** Yunzhijia conversation kind (CLI groupId space; BOT- prefix = DM). */
export type YzjConversationKind = 'group' | 'dm'

/** One 1:1 binding row (lossless JSON). */
export interface HomeBindingRecord {
  readonly dshSessionId: string
  readonly yzjConversationId: string
  readonly yzjKind: YzjConversationKind
}

/** Result of ensureBound: `created` means a new row was written, not a new root on a later open. */
export interface HomeEnsureResult {
  readonly sessionId: string
  readonly created: boolean
  readonly yzjKind: YzjConversationKind
}

/**
 * Shared face robot inbound and UI pick-group both call. Structural — robot-yzj
 * must not import this package just to name the type. Log methods are optional
 * on fakes that only exercise binding.
 */
export interface YzjHomeFace {
  ensureBound(yzjConversationId: string, yzjKind: YzjConversationKind): Promise<HomeEnsureResult>
  getByConversation(yzjConversationId: string): HomeBindingRecord | undefined
  getBySession(dshSessionId: string): HomeBindingRecord | undefined
  appendLog?(
    yzjConversationId: string,
    incoming: YzjLogEntry,
    options?: { readonly skipOpenIds?: readonly string[] },
  ): Promise<BoundLogAppendResult>
  getLog?(yzjConversationId: string): YzjBoundMessageLog | undefined
  getLogBySession?(dshSessionId: string): YzjBoundMessageLog | undefined
  ackLocal?(yzjConversationId: string, localId: string, realMsgId: string): Promise<YzjBoundMessageLog | undefined>
  failLocal?(yzjConversationId: string, localId: string): Promise<YzjBoundMessageLog | undefined>
  formatSummonWindow?(yzjConversationId: string, excludeMsgId?: string): string
}

const bindingSchema = z.object({
  dshSessionId: z.string().min(1),
  yzjConversationId: z.string().min(1),
  yzjKind: z.enum(['group', 'dm']),
}) as unknown as z.ZodType<HomeBindingRecord>

const sessionIndexSchema = z.object({
  yzjConversationId: z.string().min(1),
})

/** Durable domain: conversation → session and the reverse index. */
export const yzjHomeDomainSpec = defineDomain({
  name: 'yzj_home_bindings',
  version: 0,
  tables: {
    conversations: domainTable<string, HomeBindingRecord>(bindingSchema),
    sessions: domainTable<string, { yzjConversationId: string }>(sessionIndexSchema),
  },
})

/**
 * Stable product-home session id for one Yunzhijia conversation. Not a
 * `yzj-robot-*` parallel home — this id IS the bound DSH session.
 */
export function homeSessionId(yzjConversationId: string): string {
  const cleaned = yzjConversationId.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  const body = cleaned === '' ? 'x' : cleaned.slice(0, 80)
  return `yzj-home-${body}`
}

/** DM surfaces in the CLI/robot id space carry a BOT- prefix (measured). */
export function conversationKindOf(yzjConversationId: string): YzjConversationKind {
  return yzjConversationId.startsWith('BOT-') ? 'dm' : 'group'
}

/** Read/write face over the opened domain; inert (memory-only) until `open()`. */
export class HomeBindingStore implements YzjHomeFace {
  private conversations: KvTable<string, HomeBindingRecord> | undefined
  private sessions: KvTable<string, { yzjConversationId: string }> | undefined
  /** Fallback until the storage hub is ready — also the test double's backing. */
  private readonly memoryConv = new Map<string, HomeBindingRecord>()
  private readonly memorySess = new Map<string, string>()

  /**
   * Open (or adopt) the domain; safe to await repeatedly.
   * @param facility - the `ctx.storageDomain` facility.
   */
  async open(facility: { open(spec: typeof yzjHomeDomainSpec): Promise<Domain<typeof yzjHomeDomainSpec>> }): Promise<void> {
    if (this.conversations !== undefined) return
    const domain = await facility.open(yzjHomeDomainSpec)
    this.conversations = domain.table('conversations')
    this.sessions = domain.table('sessions')
    // Replay in-memory rows written before the hub was ready.
    for (const [key, value] of this.memoryConv) {
      if (this.conversations.get(key) === undefined) {
        await this.conversations.put(key, value)
        await this.sessions.put(value.dshSessionId, { yzjConversationId: key })
      }
    }
    this.memoryConv.clear()
    this.memorySess.clear()
  }

  /** Close the domain (idempotent). */
  async close(): Promise<void> {
    this.conversations = undefined
    this.sessions = undefined
  }

  /** Binding for one Yunzhijia conversation, or undefined. */
  getByConversation(yzjConversationId: string): HomeBindingRecord | undefined {
    return this.conversations?.get(yzjConversationId) ?? this.memoryConv.get(yzjConversationId)
  }

  /** Binding for one DSH session, or undefined. */
  getBySession(dshSessionId: string): HomeBindingRecord | undefined {
    const conversationId = this.sessions?.get(dshSessionId)?.yzjConversationId
      ?? this.memorySess.get(dshSessionId)
    if (conversationId === undefined) return undefined
    return this.getByConversation(conversationId)
  }

  /**
   * Return the existing bound session, or allocate and persist one.
   * A second call for the same conversation is focus (created=false), never
   * a parallel row.
   */
  async ensureBound(yzjConversationId: string, yzjKind: YzjConversationKind): Promise<HomeEnsureResult> {
    const existing = this.getByConversation(yzjConversationId)
    if (existing !== undefined) {
      return { sessionId: existing.dshSessionId, created: false, yzjKind: existing.yzjKind }
    }
    let sessionId = homeSessionId(yzjConversationId)
    let suffix = 2
    while (this.getBySession(sessionId) !== undefined) {
      sessionId = `${homeSessionId(yzjConversationId)}-${suffix}`
      suffix += 1
    }
    const record: HomeBindingRecord = { dshSessionId: sessionId, yzjConversationId, yzjKind }
    await this.put(record)
    return { sessionId, created: true, yzjKind }
  }

  /** Persist one 1:1 row (both directions). */
  private async put(record: HomeBindingRecord): Promise<void> {
    if (this.conversations !== undefined && this.sessions !== undefined) {
      await this.conversations.put(record.yzjConversationId, record)
      await this.sessions.put(record.dshSessionId, { yzjConversationId: record.yzjConversationId })
      return
    }
    this.memoryConv.set(record.yzjConversationId, record)
    this.memorySess.set(record.dshSessionId, record.yzjConversationId)
  }
}

/** Cordis service wrapping {@link HomeBindingStore} as `ctx.yzjHome`. */
export class YzjHomeService extends Service implements YzjHomeFace {
  readonly store = new HomeBindingStore()
  readonly logs = new BoundLogStore()

  constructor(ctx: Context, limits?: Partial<BoundLogLimits>) {
    super(ctx, 'yzjHome')
    if (limits !== undefined) this.logs.setLimits(limits)
  }

  /** Open the durable table once the storage hub has the domain form. */
  async openNow(): Promise<void> {
    const facility = this.ctx.get('storageDomain')
    if (facility === undefined) return
    try {
      await this.store.open(facility as never)
    } catch (error) {
      this.ctx.logger.warn(`yzjHome: binding store failed to open: ${String(error)}`)
    }
    try {
      await this.logs.open(facility as never)
    } catch (error) {
      this.ctx.logger.warn(`yzjHome: bound-log store failed to open: ${String(error)}`)
    }
  }

  /** @see HomeBindingStore.ensureBound */
  async ensureBound(yzjConversationId: string, yzjKind: YzjConversationKind): Promise<HomeEnsureResult> {
    const result = await this.store.ensureBound(yzjConversationId, yzjKind)
    await this.logs.ensureHeader(yzjConversationId, result.sessionId, result.yzjKind)
    return result
  }

  /** @see HomeBindingStore.getByConversation */
  getByConversation(yzjConversationId: string): HomeBindingRecord | undefined {
    return this.store.getByConversation(yzjConversationId)
  }

  /** @see HomeBindingStore.getBySession */
  getBySession(dshSessionId: string): HomeBindingRecord | undefined {
    return this.store.getBySession(dshSessionId)
  }

  /** Append one ①/②/backfill row; no-ops without a binding. */
  async appendLog(
    yzjConversationId: string,
    incoming: YzjLogEntry,
    options: { readonly skipOpenIds?: readonly string[] } = {},
  ): Promise<BoundLogAppendResult> {
    const binding = this.getByConversation(yzjConversationId)
    if (binding === undefined) return { accepted: false, reason: 'unbound' }
    return this.logs.append(yzjConversationId, binding.dshSessionId, binding.yzjKind, incoming, options)
  }

  /** Log for one conversation. */
  getLog(yzjConversationId: string): YzjBoundMessageLog | undefined {
    return this.logs.get(yzjConversationId)
  }

  /** Log for the conversation bound to this DSH session. */
  getLogBySession(dshSessionId: string): YzjBoundMessageLog | undefined {
    const binding = this.getBySession(dshSessionId)
    if (binding === undefined) return undefined
    return this.logs.get(binding.yzjConversationId)
  }

  /** @see BoundLogStore.ackLocal */
  ackLocal(yzjConversationId: string, localId: string, realMsgId: string): Promise<YzjBoundMessageLog | undefined> {
    return this.logs.ackLocal(yzjConversationId, localId, realMsgId)
  }

  /** @see BoundLogStore.failLocal */
  failLocal(yzjConversationId: string, localId: string): Promise<YzjBoundMessageLog | undefined> {
    return this.logs.failLocal(yzjConversationId, localId)
  }

  /** Shared summon-window digest (robot inject + DSH systemPrompt). */
  formatSummonWindow(yzjConversationId: string, excludeMsgId?: string): string {
    const limits = this.logs.getLimits()
    return formatSummonWindow(this.logs.get(yzjConversationId), {
      maxMessages: limits.summonWindowMessages,
      maxChars: limits.summonWindowChars,
      ...(excludeMsgId === undefined ? {} : { excludeMsgId }),
    })
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    yzjHome: YzjHomeService
  }
}
