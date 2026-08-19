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
import { applyAdvanceTools, YzjAdvanceService } from './advance.ts'
import { ScanCursorStore } from './scan-cursors.ts'
import { YzjHomeService } from './home.ts'
import { applyApprovalGuard } from './guard.ts'
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
  // The advance (AI推进) board shares the active-library holder: the panel
  // switcher moves both the todo tab and the advance board to the same doc.
  // Scan cursors are a host-owned storage-domain (决策 18) shared by the
  // scan tool and the board status RPC.
  const scanCursors = new ScanCursorStore()
  const advanceService = new YzjAdvanceService(ctx, budget, config.todo ?? {}, todoService.holder, scanCursors)
  applyAdvanceTools(ctx, budget, config.todo ?? {}, todoService.holder, scanCursors)
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
    void advanceService.openNow()
  })
  // Window is a one-shot plugin inject (not a snapshot section). Register
  // on the host so official Chat and drawer turns both see it (events bubble).
  applySummonOncePreStep(ctx as never, home)
  applyApprovalGuard(ctx)
}

/** Room + topic lookup used by T5 (pitfall-027). */
export interface SummonHomeFace {
  getBySession(sessionId: string): { yzjConversationId: string } | undefined
  getTopicBySession(sessionId: string): { yzjConversationId: string } | undefined
  formatSummonWindow(yzjConversationId: string, excludeMsgId?: string, sessionId?: string): string
}

/**
 * Snapshot path is retired: the window is a one-shot plugin inject.
 * Kept so older tests / callers still resolve; always empty.
 */
export function summonWindowText(_home: SummonHomeFace, _assemble: AssembleFace | undefined): string {
  return ''
}

const WINDOW_MARK = '［本群最近消息'

function userMessageData(event: { type: string; data: unknown }): Record<string, unknown> | undefined {
  if (event.type !== 'user/message') return undefined
  return typeof event.data === 'object' && event.data !== null
    ? event.data as Record<string, unknown>
    : undefined
}

function sourceOf(data: Record<string, unknown>): Record<string, unknown> {
  return typeof data.source === 'object' && data.source !== null
    ? data.source as Record<string, unknown>
    : {}
}

function textOfUserMessage(data: Record<string, unknown>): string {
  const content = data.content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content.map((part) => {
    if (typeof part === 'string') return part
    if (typeof part === 'object' && part !== null) {
      const text = (part as Record<string, unknown>).text
      return typeof text === 'string' ? text : ''
    }
    return ''
  }).join('')
}

function isRuntimeSnapshot(source: Record<string, unknown>): boolean {
  return source.form === 'snapshot'
}

function snapshotHasBoundWindow(source: Record<string, unknown>): boolean {
  if (!isRuntimeSnapshot(source)) return false
  const sections = Array.isArray(source.sections) ? source.sections : []
  return sections.some((section) => {
    if (typeof section !== 'object' || section === null) return false
    return (section as Record<string, unknown>).name === 'yzj-bound-window'
  })
}

function isPluginWindowInject(data: Record<string, unknown>): boolean {
  const source = sourceOf(data)
  if (source.kind !== 'plugin' || isRuntimeSnapshot(source)) return false
  if (source.plugin === 'yzj-summon-window') return true
  return textOfUserMessage(data).includes(WINDOW_MARK)
}

function latestNonSnapshotUserKind(
  events: readonly { type: string; data: unknown }[],
): 'user' | 'plugin' | 'none' {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event === undefined) continue
    const data = userMessageData(event)
    if (data === undefined) continue
    const source = sourceOf(data)
    if (isRuntimeSnapshot(source) || source.form === 'catalog') continue
    return source.kind === 'plugin' ? 'plugin' : 'user'
  }
  return 'none'
}

function snapshotHasBoundWindowIn(
  events: readonly { type: string; data: unknown }[],
): boolean {
  return events.some((event) => {
    const data = userMessageData(event)
    return data !== undefined && snapshotHasBoundWindow(sourceOf(data))
  })
}

function pluginInjectedWindowIn(
  events: readonly { type: string; data: unknown }[],
): boolean {
  return events.some((event) => {
    const data = userMessageData(event)
    return data !== undefined && isPluginWindowInject(data)
  })
}

/** True when this session already has a summon-window plugin line or old snapshot section. */
export function sessionHasSummonWindow(
  events: readonly { type: string; data: unknown }[],
): boolean {
  return pluginInjectedWindowIn(events) || snapshotHasBoundWindowIn(events)
}

function messagesHaveSummonWindow(messages: readonly unknown[]): boolean {
  return messages.some((message) => {
    if (typeof message !== 'object' || message === null) return false
    return isPluginWindowInject(message as Record<string, unknown>)
      || snapshotHasBoundWindow(sourceOf(message as Record<string, unknown>))
  })
}

/**
 * First user turn on a yzj room/topic: prepend one plugin window message.
 * Later turns no-op. Official Chat and drawer share this (pitfall-031).
 */
export function applySummonOncePreStep(
  ctx: { on: (name: string, listener: (...args: never[]) => unknown) => unknown },
  home: SummonHomeFace,
): void {
  ctx.on('agent/pre-step', (async (payload: {
    agent?: { session?: { id?: string; events?: readonly { type: string; data: unknown }[] } }
    messages?: unknown[]
  }, next: () => Promise<{ kind: string; messages?: unknown[] }>) => {
    const decision = await next()
    if (decision.kind !== 'enter') return decision
    const sessionId = payload.agent?.session?.id
    if (sessionId === undefined || sessionId === '') return decision
    const events = payload.agent?.session?.events ?? []
    const incoming = decision.messages ?? payload.messages ?? []
    if (sessionHasSummonWindow(events) || messagesHaveSummonWindow(incoming)) return decision
    const conversationId = home.getBySession(sessionId)?.yzjConversationId
      ?? home.getTopicBySession(sessionId)?.yzjConversationId
    if (conversationId === undefined) return decision
    const text = home.formatSummonWindow(conversationId, undefined, sessionId)
    if (text === '') return decision
    const planted = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: [{ type: 'text' as const, text }],
      source: { kind: 'plugin' as const, plugin: 'yzj-summon-window' },
    }
    return { kind: 'enter', messages: [planted, ...incoming] }
  }) as never)
}

/** @deprecated Window no longer lives in the snapshot; prefer sessionHasSummonWindow. */
export function shouldAttachSummonWindow(
  events: readonly { type: string; data: unknown }[],
): boolean {
  return !sessionHasSummonWindow(events) && latestNonSnapshotUserKind(events) !== 'plugin'
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

export {
  HomeBindingStore, conversationKindOf, homeSessionId, yzjHomeDomainSpec,
} from './home.ts'
export {
  TopicAnchorStore, topicSessionId, topicAnchorKey, yzjTopicDomainSpec,
} from './topics.ts'
export {
  BoundLogStore, applyAppend, ackLocalEntry, failLocalEntry, formatSummonWindow, threadEntries,
  mergeFused, cliMessageToEntry, cliMessageList, extractSendMsgId, localMsgId,
  robotOutboundEntry, isPluginFollowup, latestUserSourceKind, DEFAULT_BOUND_LOG_LIMITS, yzjHomeLogDomainSpec,
  clipLogParam,
} from './bound-log.ts'
export type {
  HomeBindingRecord, HomeEnsureResult, YzjConversationKind, YzjHomeFace,
} from './home.ts'
export type {
  TopicRecord, TopicEnsureInput, TopicEnsureResult, TopicSource,
} from './topics.ts'
export type {
  YzjBoundMessageLog, YzjLogEntry, YzjLogOrigin, BoundLogLimits, BoundLogAppendResult,
  FusedItem, FusedSessionEvent, FusedPending,
} from './bound-log.ts'
