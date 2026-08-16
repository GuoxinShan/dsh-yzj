/**
 * Model-facing Yunzhijia tool family over `ctx.yzjBridge`: doc, sheet,
 * calendar, contact, im, and file domains. Every tool renders a bounded
 * model-facing digest and projects a capped structured payload for the UI
 * through `output.presentationMeta`; destructive or irreversible operations
 * ask through the `tools/pre-execute` approval seam (the bundle's browser
 * surface answers via the GUI approval panel).
 * @module @dsh-yzj/tool-yzj
 */

import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@dsh-yzj/bridge'
import { applyContactTools } from './contact.ts'
import { applyDocTools } from './doc.ts'
import { applySheetTools } from './sheet.ts'
import { applyCalendarTools } from './calendar.ts'
import { applyImTools } from './im.ts'
import { applyFileTools } from './file.ts'
import { applyTodoTools } from './todo.ts'
import { YzjTodoService } from './todo.ts'
import type { TodoConfig } from './todo.ts'
import { YzjHomeService } from './home.ts'
import { applyApprovalGuard } from './guard.ts'
import { latestUserSourceKind } from './bound-log.ts'
import type { YzjToolBudget } from './shared.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'tool-yzj'
/** Services required by the yzj tools. */
export const inject = ['tools', 'yzjBridge']

/** tool-yzj configuration; the schema fills every default. */
export interface Config {
  /** Cooperative timeout per bridge invocation in milliseconds. Defaults to 60000. */
  timeoutMs?: number
  /** Cap on model-facing digests in characters. Defaults to 30000. */
  maxRenderChars?: number
  /** Cap on UI presentation payloads in characters. Defaults to 50000. */
  maxMetaChars?: number
  /**
   * Todo library binding (demo-stage sheet backend). Omitted fields are
   * auto-discovered; the first write auto-provisions the 待办任务库 in the
   * personal workspace (or the configured one).
   */
  todo?: TodoConfig
  /** Open a bound session: pull this many recent Yunzhijia messages into the log. */
  backfillLimit?: number
  /** Summon window: max log rows injected for one agent turn. */
  summonWindowMessages?: number
  /** Summon window: character cap (aligned with im-send 4000). */
  summonWindowChars?: number
  /** Per-conversation log retention (oldest dropped). */
  logRetention?: number
}

export const Config: z<Config> = z.object({
  timeoutMs: z.number().step(1).min(1).default(60_000),
  maxRenderChars: z.number().step(1).min(1).default(30_000),
  maxMetaChars: z.number().step(1).min(1).default(50_000),
  todo: z.object({
    workspace: z.string(),
    docId: z.string(),
    tableId: z.number(),
  }),
  backfillLimit: z.number().step(1).min(1).default(50),
  summonWindowMessages: z.number().step(1).min(1).default(20),
  summonWindowChars: z.number().step(1).min(200).default(4_000),
  logRetention: z.number().step(1).min(1).default(500),
})

/** Register the full yzj tool family and the approval guard. */
export function apply(ctx: Context, config: Config): void {
  const budget: YzjToolBudget = {
    timeoutMs: config.timeoutMs ?? 60_000,
    maxRenderChars: config.maxRenderChars ?? 30_000,
    maxMetaChars: config.maxMetaChars ?? 50_000,
  }
  applyContactTools(ctx, budget)
  applyDocTools(ctx, budget)
  applySheetTools(ctx, budget)
  applyCalendarTools(ctx, budget)
  applyImTools(ctx, budget)
  applyFileTools(ctx, budget)
  // The yzjTodo service shares the todo core AND the active-library holder
  // with the tools (panel switcher writes it; agent writes follow it), and
  // backs the ui-yzj RPC channel. Needs a real Cordis context.
  const todoService = new YzjTodoService(ctx, budget, config.todo ?? {})
  applyTodoTools(ctx, budget, config.todo ?? {}, todoService.holder)
  // Product-home binding table (dsh-home-session): one Yunzhijia
  // conversation ↔ one DSH session. Shared by robot inbound and UI pick-group.
  const home = new YzjHomeService(ctx, {
    backfillLimit: config.backfillLimit ?? 50,
    summonWindowMessages: config.summonWindowMessages ?? 20,
    summonWindowChars: config.summonWindowChars ?? 4_000,
    logRetention: config.logRetention ?? 500,
  })
  ctx.inject(['storageDomain'], () => {
    void home.openNow()
  })
  // systemPrompt is a harness core service; wait for it so ops-less profiles
  // skip injection and web/gui profiles do not miss the provider.
  ctx.inject(['systemPrompt'], () => {
    applySummonWindow(ctx, home)
  })
  applyApprovalGuard(ctx)
}

/**
 * DSH「发给 agent」summon window (T5): opportunistic systemPrompt.context.
 * Returns the bound log window only when this assembly's latest user message
 * is a real GUI turn (not a plugin followup — those inject via agent.inject).
 */
function applySummonWindow(ctx: Context, home: YzjHomeService): void {
  const systemPrompt = ctx.get('systemPrompt') as {
    context(entry: { name: string; order: number; text: (assemble?: AssembleFace) => string }): () => void
  } | undefined
  if (systemPrompt === undefined) return
  ctx.effect(() => systemPrompt.context({
    name: 'yzj-bound-window',
    order: 40,
    text: (assemble) => {
      const sessionId = sessionIdFromAssemble(assemble)
      if (sessionId === undefined) return ''
      const binding = home.getBySession(sessionId)
      if (binding === undefined) return ''
      const events = eventsFromAssemble(assemble)
      // Only GUI「发给 agent」turns. Plugin followups already agent.inject()
      // the same digest; empty logs (no user/message yet) stay silent.
      if (latestUserSourceKind(events) !== 'user') return ''
      return home.formatSummonWindow(binding.yzjConversationId)
    },
  }))
}

/** Structural AssembleContext (harness `assembleContextFor` sets agent + scope = Agent). */
export interface AssembleFace {
  readonly agent?: {
    readonly session?: {
      readonly id?: string
      readonly events?: readonly { type: string; data: unknown }[]
    }
  }
  readonly scope?: unknown
}

/**
 * Session id for one prompt assembly. harness `AssembleContext.scope` is the
 * Agent object (`ScopeKey = object`), not a session-id string.
 */
export function sessionIdFromAssemble(assemble: AssembleFace | undefined): string | undefined {
  const fromAgent = assemble?.agent?.session?.id
  if (typeof fromAgent === 'string' && fromAgent !== '') return fromAgent
  if (assemble?.scope !== undefined && typeof assemble.scope === 'object' && assemble.scope !== null) {
    const scoped = assemble.scope as { session?: { id?: string } }
    if (typeof scoped.session?.id === 'string' && scoped.session.id !== '') return scoped.session.id
  }
  return undefined
}

function eventsFromAssemble(assemble: AssembleFace | undefined): readonly { type: string; data: unknown }[] {
  const fromAgent = assemble?.agent?.session?.events
  if (fromAgent !== undefined) return fromAgent
  if (assemble?.scope !== undefined && typeof assemble.scope === 'object' && assemble.scope !== null) {
    const scoped = assemble.scope as { session?: { events?: readonly { type: string; data: unknown }[] } }
    if (scoped.session?.events !== undefined) return scoped.session.events
  }
  return []
}

export {
  HomeBindingStore, conversationKindOf, homeSessionId, yzjHomeDomainSpec,
} from './home.ts'
export {
  BoundLogStore, applyAppend, ackLocalEntry, failLocalEntry, formatSummonWindow,
  mergeFused, cliMessageToEntry, cliMessageList, extractSendMsgId, localMsgId,
  isPluginFollowup, latestUserSourceKind, DEFAULT_BOUND_LOG_LIMITS, yzjHomeLogDomainSpec,
} from './bound-log.ts'
export type {
  HomeBindingRecord, HomeEnsureResult, YzjConversationKind, YzjHomeFace,
} from './home.ts'
export type {
  YzjBoundMessageLog, YzjLogEntry, YzjLogOrigin, BoundLogLimits, BoundLogAppendResult,
  FusedItem, FusedSessionEvent, FusedPending,
} from './bound-log.ts'
