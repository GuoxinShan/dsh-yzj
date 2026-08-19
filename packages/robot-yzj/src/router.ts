/**
 * Inbound router: turns deduped robot messages into agent turns. Session
 * landing follows the DSH-home product law (docs/spec/dsh-home-session.md):
 * one Yunzhijia conversation (group or DM) ↔ exactly one bound DSH session,
 * via the shared `home` table — not a hidden `yzj-robot-*` parallel home.
 * Reply-chain ids stay transcript relations (outbound reply cards), not new
 * roots. Bang commands, per-session mute, ack-then-push (PushHub), memory
 * (S4), and the first-group intro (S7/C14) are unchanged protocol.
 * @module @dsh-yzj/robot-yzj/router
 */

import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import { foldScheduleEvents } from '@deepseek-ai/dsh-schedule'
import { appendFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { yzjWorkspacePath } from './yzj-cwd.ts'
import type { Agent, AgentHandle, CreateAgentOptions, ResumeAgentOptions } from '@deepseek-ai/dsh-agent'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { InboundDedupe, parseReplyMeta, type RobotInboundMessage } from './protocol.ts'
import type { RobotCardOptions, RobotSendOptions, RobotSendResult } from './outbound.ts'
import { dmKey, groupKey } from './overrides.ts'
import { recentKey, surfaceKey, type SurfaceState, type SurfaceStoreFace } from './surface.ts'
import type { ConfirmBroker } from './confirm.ts'
import type { PushHub } from './push.ts'

/** The tiny agents-registry face the router needs (fake-able in tests). */
export interface RouterAgentsFace {
  get(sessionId: SessionId): Agent | undefined
  create(options: CreateAgentOptions): Promise<AgentHandle>
  /** Resume an agent on a persisted session log; rejects when none exists. */
  resume(options: ResumeAgentOptions): Promise<AgentHandle>
}

/** Outbound face (RobotSender satisfies it). */
export interface RouterSendFace {
  send(text: string, options?: RobotSendOptions): Promise<RobotSendResult>
  /** Application-style card send (msgType:1; no reply anchor — cards and reply links are mutually exclusive, measured). */
  sendCard(card: RobotCardOptions): Promise<RobotSendResult>
}

/** Minimal logger face. */
export interface RouterLogger {
  warn(message: string): void
}

/** Resolves the allowFrom openId list; undefined keeps the current policy. */
export type AllowFromResolver = () => Promise<readonly string[] | undefined>

/** Resolves a per-conversation model override; undefined = inherit. */
export type OverrideResolver = (conversationKey: string) => { provider?: string; model?: string } | undefined

/** Resolves one group's human name (WS frames carry none); undefined = unknown. */
export type GroupNameResolver = (groupId: string) => Promise<string | undefined>

/**
 * Shared DSH-home binding face (ctx.yzjHome). Structural so this package
 * does not import tool-yzj — the table is the product object, not lastSession.
 */
export interface RouterHomeFace {
  ensureBound(yzjConversationId: string, yzjKind: 'group' | 'dm'): Promise<{ sessionId: string; created: boolean; yzjKind: 'group' | 'dm' }>
  getByConversation(yzjConversationId: string): { dshSessionId: string; yzjConversationId: string; yzjKind: 'group' | 'dm' } | undefined
  getBySession(dshSessionId: string): { dshSessionId: string; yzjConversationId: string; yzjKind: 'group' | 'dm' } | undefined
  /** Append one inbound ① row into the bound log (optional on binding-only fakes). */
  appendLog?(yzjConversationId: string, incoming: {
    readonly msgId: string
    readonly sentAt: number
    readonly fromOpenId: string
    readonly fromName: string
    readonly content: string
    readonly msgType: 'text' | 'richText' | 'file' | 'other'
    readonly origin: 'inbound' | 'dsh-send' | 'backfill' | 'robot-outbound'
    readonly isSelf: boolean
    readonly replyMsgId?: string
    readonly topicSessionId?: string
    readonly status: 'pending' | 'acked' | 'failed'
    readonly param?: Record<string, unknown>
  }, options?: { readonly skipOpenIds?: readonly string[] }): Promise<unknown>
  /** Shared summon-window digest (T5); empty → do not inject. */
  formatSummonWindow?(yzjConversationId: string, excludeMsgId?: string, sessionId?: string): string
  /** Mint or focus a topic under this group (R4). Absent = 1:1 room fallback. */
  ensureTopic?(input: {
    readonly yzjConversationId: string
    readonly source: 'dsh' | 'yzj' | 'handoff'
    readonly title?: string
    readonly rootMsgId?: string
    readonly originWho?: string
    readonly originText?: string
    readonly originTime?: number
    readonly fromSessionId?: string
  }): Promise<{ sessionId: string; created: boolean }>
  getTopicByAnchor?(yzjConversationId: string, rootMsgId: string): { dshSessionId: string } | undefined
  getTopicByOutbound?(msgId: string): { dshSessionId: string } | undefined
  registerTopicOutbound?(msgId: string, dshSessionId: string): Promise<void>
}

/** Per-conversation memory face (MemoryStore satisfies it). */
export interface RouterMemoryFace {
  lines(key: string): readonly string[]
  remember(key: string, line: string): Promise<{ lines: readonly string[]; note: string }>
  forget(key: string, substring: string): Promise<{ lines: readonly string[]; note: string }>
}

/** Router options; all faces are injectable. */
export interface RobotRouterOptions {
  readonly agents: RouterAgentsFace
  readonly sender: RouterSendFace
  /** Empty list denies everyone; the resolver may fill it lazily (whoami). */
  readonly allowFrom: AllowFromResolver
  /** Provider/model override for created agent sessions; absent = harness default. */
  readonly agentOptions?: { provider?: string; model?: string }
  /**
   * Lowest-priority route lookup consulted only when neither the
   * per-conversation override nor {@link agentOptions} carries a route —
   * the plugin-wide default model (`ctx.yzjModels`); absent = harness default.
   */
  readonly fallbackRoute?: () => { provider?: string; model?: string } | undefined
  /** Per-conversation override lookup (wins over agentOptions); absent = none. */
  readonly resolveOverride?: OverrideResolver
  /**
   * Mount the host default agent preset (standard + host yzj tools).
   * Absent = bare scope, host tools only (pitfall-030).
   */
  readonly composePreset?: () => Promise<{
    readonly agentPreset?: string
    readonly setup?: CreateAgentOptions['setup']
  }>
  /** Shared confirmation broker for gated writes (suggestion cards). */
  readonly confirm?: ConfirmBroker
  /** Shared event-driven push hub; absent = turns run but nothing is pushed. */
  readonly push?: PushHub
  /** Per-conversation memory; absent = memory verbs are inert. */
  readonly memory?: RouterMemoryFace
  /** Zero-based channel index; scopes persisted surface keys. */
  readonly channelIndex?: number
  /** Working directory for created sessions; defaults to the host process cwd. */
  readonly cwd?: string
  /** Durable surface store; absent = surface memory is ephemeral. */
  readonly surface?: SurfaceStoreFace
  /**
   * Product-home binding table (ctx.yzjHome). Inbound followup() and !fork
   * land here. Absent = in-process yzj-home-* ids (still not yzj-robot-*).
   * A getter is allowed so the plugin can resolve the service after this
   * router is constructed (tool-yzj may load later).
   */
  readonly home?: RouterHomeFace | (() => RouterHomeFace | undefined)
  readonly ackText?: string
  readonly denyText?: string
  readonly logger?: RouterLogger
  /** GUI base URL for `!configure` and S2 session deep links; absent = text guidance only. */
  readonly guiUrl?: string
  /** Resolves group names (for `!fork` by name); absent = groupId-only fork. */
  readonly resolveGroupName?: GroupNameResolver
}

const DEFAULT_ACK_TEXT = '收到，处理中…'
const DEFAULT_DENY_TEXT = '抱歉，你不在本机器人的白名单内。'
const COMMAND_NAMES = ['help', 'status', 'routines', 'mute', 'unmute', 'restart', 'configure'] as const
type RobotCommand = typeof COMMAND_NAMES[number]
const STANDALONE_COMMAND = /^!(help|status|routines|mute|unmute|restart|configure)\s*$/
/** `!fork <groupId|群名> <instruction>` — cross-group handover: open or
 * resume the **target group's bound DSH session** and inject a bounded
 * summary. Must not `agents.create` a parallel root. The target may be a
 * groupId or a human group name (resolved lazily via resolveGroupName). */
const FORK_COMMAND = /^!fork\s+(\S+)\s+(.+)$/is
/** `!feedback <text>` — append to the local feedback log and acknowledge. */
const FEEDBACK_COMMAND = /^!feedback\s+(.+)$/is
/** How many known surfaces a group-name `!fork` lookup may resolve (bounded). */
const GROUP_NAME_LOOKUP_LIMIT = 20
/** Memory verbs (S4): a leading @-mention is tolerated on group surfaces. */
const MEMORY_REMEMBER = /^(?:@[^\s@]+\s*)?(?:记住|remember)\s*[:：]?\s+(.+)$/is
const MEMORY_LIST = /^(?:@[^\s@]+\s*)?(?:!memory|你记住了什么|列出记忆)\s*$/i
const MEMORY_FORGET = /^(?:@[^\s@]+\s*)?(?:忘掉|忘记|forget)\s+[:：]?\s*(.+)$/is

/**
 * Legacy DM id shape (`yzj-robot-*`). Not the product home — inbound uses
 * {@link homeSessionIdOf} / ctx.yzjHome. Leftover export so status helpers
 * and old disk logs remain addressable; do not mint new product sessions.
 */
export function dmSessionId(robotId: string, operatorOpenid: string): SessionId {
  return SessionId(`yzj-robot-${slug(robotId)}-${slug(operatorOpenid)}`)
}

/** In-process product-home id when ctx.yzjHome is not mounted (tests / ops). */
export function homeSessionIdOf(yzjConversationId: string): SessionId {
  return SessionId(`yzj-home-${slug(yzjConversationId)}`)
}

/**
 * A BOT-prefixed groupId marks a robot-DM conversation surface (measured:
 * `BOT-<userVariant>-BOT-<robotId>`); anything else is a group conversation.
 */
export function isDirectSurface(message: RobotInboundMessage): boolean {
  return message.groupId.startsWith('BOT-')
}

/** Parsed memory verb. */
type MemoryCommand =
  | { kind: 'remember'; line: string }
  | { kind: 'list' }
  | { kind: 'forget'; substring: string }

/** Parse one message's memory verb, if any (an @-prefix is tolerated). */
export function parseMemoryCommand(content: string): MemoryCommand | undefined {
  const stripped = content.replace(/^\s*@[^\s@]+\s*/, '')
  const remember = MEMORY_REMEMBER.exec(stripped)
  if (remember !== null && remember[1] !== undefined) return { kind: 'remember', line: remember[1] }
  if (MEMORY_LIST.test(stripped)) return { kind: 'list' }
  const forget = MEMORY_FORGET.exec(stripped)
  if (forget !== null && forget[1] !== undefined) return { kind: 'forget', substring: forget[1] }
  return undefined
}

/** The intro prompt for a group's first conversation (S7/C14). */
function introPrompt(): string {
  return [
    '（系统引导：请按以下步骤回复群友，中文、简洁。除第一步读取群消息外，禁止调用任何工具——自我介绍直接以文本输出，不要用 yzj_im_message_send 发消息）',
    '1. 先用 yzj_im_message_list 读取本群最近的聊天记录（groupId 用当前群的）；',
    '2. 直接输出一段两三句话的自我介绍：你是接入 DeepSeek Harness 的机器人助手，可以操作云之家（文档/日程/待办/消息/多维表格）并调度 DSH 的全部能力；',
    '3. 根据群内近况提出 2~3 个你现在就能帮忙的具体任务；',
    '4. 最后提醒：发 !help 可看命令列表。',
  ].join('\n')
}

function slug(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  return cleaned === '' ? 'x' : cleaned.slice(0, 40)
}

/**
 * A bounded, newest-first plain-text summary of a session's assistant
 * output, for cross-group handover (`!fork`). Traverses the log backwards,
 * collecting assistant text blocks up to `maxChars` (older content is
 * dropped; order within the window is preserved).
 * @param events - the source session's full event log.
 * @param maxChars - hard cap on the returned text length.
 * @returns the bounded summary ('' when the session has no assistant output).
 */
export function conversationSummary(events: readonly SessionEvent[], maxChars = 1200): string {
  const parts: string[] = []
  let size = 0
  for (let index = events.length - 1; index >= 0 && size < maxChars; index -= 1) {
    const event = events[index]
    if (event === undefined || event.type !== 'assistant/message') continue
    for (const block of event.data.message?.content ?? []) {
      if (block.type === 'text' && block.text !== undefined && block.text !== '') {
        parts.unshift(block.text)
        size += block.text.length
      }
    }
  }
  return parts.join('\n').slice(-maxChars)
}

/** DM conversation key of one message (override/memory-table form). */
function dmKeyOf(message: RobotInboundMessage): string {
  return dmKey(message.robotId, message.operatorOpenid)
}

/**
 * The inbound brain. Construct once per robot connection; `handle` is called
 * for every classified robot message (dedupe happens here). `dispose()` tears
 * down every agent this router created.
 */
export class RobotRouter {
  private readonly agents: RouterAgentsFace
  private readonly sender: RouterSendFace
  private readonly allowFrom: AllowFromResolver
  private readonly agentOptions: { provider?: string; model?: string } | undefined
  private readonly fallbackRoute: (() => { provider?: string; model?: string } | undefined) | undefined
  private readonly resolveOverride: OverrideResolver | undefined
  private readonly composePreset: RobotRouterOptions['composePreset']
  private readonly confirm: ConfirmBroker | undefined
  private readonly push: PushHub | undefined
  private readonly memory: RouterMemoryFace | undefined
  private readonly surface: SurfaceStoreFace | undefined
  private readonly home: RouterHomeFace | (() => RouterHomeFace | undefined) | undefined
  private readonly channelIndex: number
  private readonly cwd: string
  private readonly ackText: string
  private readonly denyText: string
  private readonly logger: RouterLogger | undefined
  private readonly guiUrl: string
  private readonly resolveGroupName: GroupNameResolver | undefined
  /** groupId → human group name, resolved lazily for `!fork` by name. */
  private readonly groupNames = new Map<string, string>()

  private readonly dedupe = new InboundDedupe()
  /** Handles for sessions this router created (dispose/restart need them). */
  private readonly handles = new Map<SessionId, AgentHandle>()
  /** Outbound msgId → owning session id (reply continuation). */
  private readonly outboundAnchor = new Map<string, SessionId>()
  /** Inbound root msgId → anchored group session id (reply continuation). */
  private readonly inboundAnchor = new Map<string, SessionId>()
  /** Session id → muted flag. */
  private readonly muted = new Set<string>()
  /** AllowFrom cache once resolved. */
  private allowFromCache: readonly string[] | undefined
  /** groupId → last seen surface identity (in-memory mirror of the store). */
  private readonly surfaces = new Map<string, SurfaceState>()
  /** Last inbound surface, used to stamp robot-outbound log rows (R9). */
  private lastSurface: { groupId: string; robotId: string; robotName: string; sessionId: string } | undefined
  /** Recency order of seen groupIds (most recent last). */
  private readonly recentGroups: string[] = []
  /** groupId → last anchored session id (synthetic continuation target). */
  private readonly lastSession = new Map<string, SessionId>()
  /** Group-thread session id → its private working directory (§8.4). */
  private readonly sessionCwds = new Map<SessionId, string>()

  constructor(options: RobotRouterOptions) {
    this.agents = options.agents
    this.sender = options.sender
    this.allowFrom = options.allowFrom
    this.agentOptions = options.agentOptions
    this.fallbackRoute = options.fallbackRoute
    this.resolveOverride = options.resolveOverride
    this.composePreset = options.composePreset
    this.confirm = options.confirm
    this.push = options.push
    this.memory = options.memory
    this.surface = options.surface
    this.home = options.home
    this.channelIndex = options.channelIndex ?? 0
    this.cwd = options.cwd !== undefined && options.cwd !== '' ? options.cwd : yzjWorkspacePath()
    this.ackText = options.ackText ?? DEFAULT_ACK_TEXT
    this.denyText = options.denyText ?? DEFAULT_DENY_TEXT
    this.logger = options.logger
    this.guiUrl = options.guiUrl ?? ''
    this.resolveGroupName = options.resolveGroupName
  }

  /** Dispose every agent session this router created; clears all state. */
  async dispose(): Promise<void> {
    for (const [sessionId, handle] of this.handles) {
      try {
        await handle.dispose()
      } catch (error) {
        this.logger?.warn(`robot: dispose failed for ${sessionId}: ${String(error)}`)
      }
    }
    this.handles.clear()
    this.outboundAnchor.clear()
    this.inboundAnchor.clear()
    this.muted.clear()
  }

  /** Forget one session's live state (mute, anchors, push registration). */
  forgetSession(sessionId: SessionId): void {
    this.muted.delete(sessionId)
    this.push?.forget(sessionId)
    for (const [msgId, owner] of this.outboundAnchor) {
      if (owner === sessionId) this.outboundAnchor.delete(msgId)
    }
    for (const [msgId, owner] of this.inboundAnchor) {
      if (owner === sessionId) this.inboundAnchor.delete(msgId)
    }
  }

  /** Cap an anchor map, evicting oldest entries (insertion order). */
  private trimAnchor(map: Map<string, SessionId>, cap = 500): void {
    for (const key of map.keys()) {
      if (map.size <= cap) break
      map.delete(key)
    }
  }

  /** Live home table (getter re-resolves after late plugin mount). */
  private homeFace(): RouterHomeFace | undefined {
    if (this.home === undefined) return undefined
    return typeof this.home === 'function' ? this.home() : this.home
  }

  /** Stamp one delivered robot post into the group-room log (R9). */
  private noteRobotPost(
    surface: { groupId: string; robotId: string; robotName: string; sessionId: string },
    msgId: string,
    content: string,
    replyMsgId?: string,
  ): void {
    const topicSessionId = surface.sessionId.startsWith('yzj-topic-') ? surface.sessionId : undefined
    void this.homeFace()?.appendLog?.(surface.groupId, {
      msgId,
      sentAt: Date.now(),
      fromOpenId: surface.robotId,
      fromName: surface.robotName === '' ? '助手' : surface.robotName,
      content,
      msgType: 'text',
      origin: 'robot-outbound',
      isSelf: false,
      status: 'acked',
      ...(replyMsgId === undefined || replyMsgId === '' ? {} : { replyMsgId }),
      ...(topicSessionId === undefined ? {} : { topicSessionId }),
    })
    if (surface.sessionId !== '') {
      void this.homeFace()?.registerTopicOutbound?.(msgId, surface.sessionId)
    }
  }

  /**
   * Resolve the owning session for one message. Product law v2.0: a top-level
   * @ mints (or focuses) a topic; a reply chain continues that topic. The
   * group-room host (`yzj-home-*`) is not the agent work session. Without a
   * topic face this process still falls back to the 1:1 room id (tests / ops).
   */
  private async resolveSession(message: RobotInboundMessage): Promise<SessionId> {
    const kind = isDirectSurface(message) ? 'dm' : 'group'
    const home = this.homeFace()
    const continued = this.continuedTopicId(message, home)
    if (continued !== undefined) {
      return this.rememberResolved(message, kind, continued)
    }
    if (home?.ensureTopic !== undefined) {
      const minted = await home.ensureTopic({
        yzjConversationId: message.groupId,
        source: 'yzj',
        rootMsgId: message.msgId,
        originWho: message.operatorName,
        originText: message.content,
        originTime: message.time,
      })
      return this.rememberResolved(message, kind, SessionId(minted.sessionId))
    }
    const sessionId = home === undefined
      ? homeSessionIdOf(message.groupId)
      : SessionId((await home.ensureBound(message.groupId, kind)).sessionId)
    return this.rememberResolved(message, kind, sessionId)
  }

  /** Reply-chain or synthetic continuation target, if any. */
  private continuedTopicId(message: RobotInboundMessage, home: RouterHomeFace | undefined): SessionId | undefined {
    if (message.synthetic === true) {
      const last = this.lastSession.get(message.groupId)
      if (last !== undefined) return last
    }
    const reply = parseReplyMeta(message.msgParam).reply
    if (reply === undefined) return undefined
    const fromOutbound = this.outboundAnchor.get(reply.replyMsgId)
      ?? (reply.replyMsgId === '' ? undefined : home?.getTopicByOutbound?.(reply.replyMsgId)?.dshSessionId)
    if (fromOutbound !== undefined) return SessionId(String(fromOutbound))
    const rootId = reply.replyRootMsgId !== '' ? reply.replyRootMsgId : reply.replyMsgId
    if (rootId === '') return undefined
    const fromRoot = this.inboundAnchor.get(rootId)
      ?? home?.getTopicByAnchor?.(message.groupId, rootId)?.dshSessionId
    return fromRoot === undefined ? undefined : SessionId(String(fromRoot))
  }

  /** Persist cwd + inbound root mapping for one resolved session. */
  private rememberResolved(message: RobotInboundMessage, kind: 'group' | 'dm', sessionId: SessionId): SessionId {
    if (kind === 'group') {
      const cwd = String(sessionId).startsWith('yzj-topic-')
        ? join(this.cwd, 'groups', slug(message.groupId), slug(String(sessionId).slice('yzj-topic-'.length)))
        : this.groupHomeCwd(message.groupId)
      this.sessionCwds.set(sessionId, cwd)
    }
    this.inboundAnchor.set(message.msgId, sessionId)
    this.trimAnchor(this.inboundAnchor)
    return sessionId
  }

  /** Private working directory of one bound group session (one dir per group). */
  private groupHomeCwd(groupId: string): string {
    return join(this.cwd, 'groups', slug(groupId))
  }

  /**
   * The group shared directory (design §8.4): the explicit cross-thread
   * collaboration area, created on demand. Only `robot_share_write` writes
   * here — harness file tools stay sandboxed inside each session's private
   * workspace, so this is the sole write channel outside it.
   */
  shareDir(groupId: string): string {
    const dir = join(this.cwd, 'groups', slug(groupId), 'shared')
    try {
      mkdirSync(dir, { recursive: true })
    } catch (error) {
      this.logger?.warn(`robot: mkdir shared dir failed for ${dir}: ${String(error)}`)
    }
    return dir
  }

  /** Entry point for one classified inbound message. */
  async handle(message: RobotInboundMessage): Promise<void> {
    if (!this.dedupe.markSeen(message.msgId)) return
    this.noteSurface(message)
    this.lastSurface = {
      groupId: message.groupId,
      robotId: message.robotId,
      robotName: message.robotName,
      sessionId: '',
    }
    if (message.synthetic !== true) {
      await this.noteInboundLog(message)
    }
    const group = !isDirectSurface(message)
    // A synthetic DSH-side turn references a msgId the server never saw, so
    // outbound messages must not carry a reply anchor (the server could not
    // resolve it); the asker notification still applies on group surfaces.
    const replyAnchor: RobotSendOptions = message.synthetic === true
      ? { ...(group ? { notifyOpenIds: [message.operatorOpenid] } : {}) }
      : {
          replyMsgId: message.msgId,
          replySummary: message.content.slice(0, 60),
          replyPersonName: message.operatorName,
          // Group surfaces highlight only the asker; DMs need no targeting.
          ...(group ? { notifyOpenIds: [message.operatorOpenid] } : {}),
        }
    // Group surfaces deliver only @-addressed messages; strip the mention
    // prefix before matching bang commands (确认 N handles its own prefix).
    const stripped = message.content.replace(/^\s*@[^\s@]+\s*/, '')
    const command = STANDALONE_COMMAND.exec(stripped)
    const commandName = command?.[1] as RobotCommand | undefined
    if (commandName !== undefined && COMMAND_NAMES.includes(commandName)) {
      await this.runCommand(commandName, message, replyAnchor)
      return
    }
    // Parameterized commands (S3): !fork carries a target groupId + instruction,
    // !feedback carries the feedback text. Both run before authorization, like
    // the standalone bang family, and consume the message (no ack, no turn).
    const fork = FORK_COMMAND.exec(stripped)
    if (fork !== null && fork[1] !== undefined && fork[2] !== undefined) {
      await this.runFork(fork[1], fork[2], message, replyAnchor)
      return
    }
    const feedback = FEEDBACK_COMMAND.exec(stripped)
    if (feedback !== null && feedback[1] !== undefined) {
      await this.runFeedback(feedback[1], message, replyAnchor)
      return
    }
    if (!(await this.authorized(message.operatorOpenid))) {
      await this.reply(this.denyText, replyAnchor)
      return
    }
    // Confirmation-card replies (确认 N / 取消 N) consume the message before
    // anything else — no ack, no turn.
    if (this.confirm !== undefined && this.confirm.checkReply(message)) return
    const sessionId = await this.resolveSession(message)
    this.noteSession(message, sessionId)
    if (this.lastSurface !== undefined) {
      this.lastSurface = { ...this.lastSurface, sessionId: String(sessionId) }
    }
    if (this.muted.has(sessionId)) return
    const conversationKey = group ? groupKey(message.groupId) : dmKeyOf(message)
    // Memory verbs (S4) manage the conversation's long-lived instructions
    // and consume the message — no ack, no turn.
    const memoryCommand = this.memory === undefined ? undefined : parseMemoryCommand(message.content)
    if (memoryCommand !== undefined) {
      await this.runMemory(memoryCommand, conversationKey, replyAnchor)
      return
    }
    this.confirm?.registerSession(sessionId, {
      sender: this.sender,
      robotId: message.robotId,
      group,
      groupId: message.groupId,
      askerOpenId: message.operatorOpenid,
      askerName: message.operatorName,
    })
    this.push?.register(sessionId, {
      sender: this.sender,
      group,
      askerOpenId: message.operatorOpenid,
      askerName: message.operatorName,
      lastInbound: {
        msgId: message.msgId,
        summary: message.content.slice(0, 60),
        personName: message.operatorName,
      },
      // Synthetic turns reference a msgId the server never saw: pushes must
      // not anchor replies to it.
      ...(message.synthetic === true ? { noReplyAnchor: true } : {}),
      onOutbound: (msgId, text, replyMsgId) => {
        this.noteRobotPost({
          groupId: message.groupId,
          robotId: message.robotId,
          robotName: message.robotName,
          sessionId: String(sessionId),
        }, msgId, text, replyMsgId)
      },
    })
    // The ack is a robot message in the chain — anchor it so replies to the
    // ack (not just to the final answer) continue this session. The task
    // summary rides the ack as the Claude-Tag display-name analogue (C12).
    const taskSummary = message.content.trim().slice(0, 24)
    const ackText = taskSummary.length >= 12
      ? `${this.ackText}（${taskSummary}${message.content.trim().length > 24 ? '…' : ''}）`
      : this.ackText
    await this.reply(ackText, replyAnchor)
    // The first conversation in a group prepends a self-introduction turn
    // (S7/C14) ahead of the user's message — the intro runs as its own turn,
    // never replacing the user's request. The introduced flag persists in
    // the memory domain under a side key (never injected: only the
    // conversation key's lines reach the model), so restarts do not re-run.
    let turnText = message.content
    const introKey = `intro:${message.robotId}:${message.groupId}`
    if (group && this.memory !== undefined && this.memory.lines(introKey).length === 0) {
      void this.memory.remember(introKey, 'done').catch(() => undefined)
      const introAgent = await this.ensureAgent(sessionId, conversationKey)
      if (introAgent !== undefined) {
        try {
          introAgent.followup(createUserMessage({
            content: [{ type: 'text', text: introPrompt() }],
            source: { kind: 'plugin', plugin: 'robot-yzj' },
          }))
        } catch (error) {
          this.logger?.warn(`robot: intro followup failed: ${String(error)}`)
        }
      }
    }
    await this.dispatchTurn(sessionId, conversationKey, message, turnText)
  }

  /**
   * Record one inbound message's conversation surface (in memory and, when a
   * store is present, durably) so DSH-side continuation and fork can resolve
   * the real robot/group identity and the last anchored session. A persisted
   * lastSessionId survives a restart and is preserved across rewrites.
   */
  private noteSurface(message: RobotInboundMessage): void {
    const previous = this.surfaces.get(message.groupId)
      ?? this.surface?.get(surfaceKey(this.channelIndex, message.groupId))
    const state: SurfaceState = {
      robotId: message.robotId,
      robotName: message.robotName,
      groupType: message.groupType,
      time: message.time,
      ...(previous?.lastSessionId === undefined ? {} : { lastSessionId: previous.lastSessionId }),
    }
    this.surfaces.set(message.groupId, state)
    if (this.recentGroups[this.recentGroups.length - 1] !== message.groupId) {
      const index = this.recentGroups.indexOf(message.groupId)
      if (index >= 0) this.recentGroups.splice(index, 1)
      this.recentGroups.push(message.groupId)
      if (this.recentGroups.length > 100) this.recentGroups.shift()
      void this.surface?.putMeta(recentKey(this.channelIndex), { value: message.groupId }).catch(() => undefined)
    }
    const changed = previous === undefined
      || previous.robotId !== message.robotId
      || previous.robotName !== message.robotName
      || previous.groupType !== message.groupType
    if (changed) {
      void this.surface?.put(surfaceKey(this.channelIndex, message.groupId), state).catch(() => undefined)
    }
  }

  /**
   * Write inbound ① into the bound log (T1/T7). Cloud-home client posts by
   * the login user are ① + isSelf, never ②. Synthetic DSH continues skip this.
   */
  private async noteInboundLog(message: RobotInboundMessage): Promise<void> {
    const home = this.homeFace()
    if (home?.appendLog === undefined) return
    if (this.allowFromCache === undefined) {
      try {
        this.allowFromCache = await this.allowFrom() ?? []
      } catch {
        this.allowFromCache = []
      }
    }
    const kind = isDirectSurface(message) ? 'dm' : 'group'
    try {
      await home.ensureBound(message.groupId, kind)
    } catch (error) {
      this.logger?.warn(`robot: inbound log ensureBound failed: ${String(error)}`)
      return
    }
    const reply = parseReplyMeta(message.msgParam).reply
    const selfOpenId = this.allowFromCache?.[0] ?? ''
    let param: Record<string, unknown> | undefined
    if (message.msgParam !== undefined) {
      try {
        const parsed: unknown = JSON.parse(message.msgParam)
        if (typeof parsed === 'object' && parsed !== null) param = parsed as Record<string, unknown>
      } catch {
        param = undefined
      }
    }
    try {
      await home.appendLog(message.groupId, {
        msgId: message.msgId,
        sentAt: message.time > 0 ? message.time : Date.now(),
        fromOpenId: message.operatorOpenid,
        fromName: message.operatorName,
        content: message.content,
        msgType: 'text',
        origin: 'inbound',
        isSelf: selfOpenId !== '' && message.operatorOpenid === selfOpenId,
        status: 'acked',
        ...(reply?.replyMsgId === undefined || reply.replyMsgId === '' ? {} : { replyMsgId: reply.replyMsgId }),
        ...(param === undefined || Object.keys(param).length === 0 ? {} : { param }),
      }, { skipOpenIds: [message.robotId] })
    } catch (error) {
      this.logger?.warn(`robot: inbound log append failed: ${String(error)}`)
    }
  }

  /** Track the session a message anchored on its surface (continuation target). */
  private noteSession(message: RobotInboundMessage, sessionId: SessionId): void {
    this.lastSession.set(message.groupId, sessionId)
    if (this.lastSession.size > 300) {
      const oldest = this.lastSession.keys().next().value
      if (oldest !== undefined) this.lastSession.delete(oldest)
    }
    const state = this.surfaces.get(message.groupId)
    if (state !== undefined && state.lastSessionId !== String(sessionId)) {
      const updated: SurfaceState = { ...state, lastSessionId: String(sessionId) }
      this.surfaces.set(message.groupId, updated)
      void this.surface?.put(surfaceKey(this.channelIndex, message.groupId), updated).catch(() => undefined)
    }
  }

  /**
   * DSH-side conversation continuation: fabricate a user turn as the
   * operator and run it through the full inbound pipeline (ack, memory,
   * confirmation replies, agent turn, event-driven push). The operator openId
   * resolves through the allowFrom policy, so only the whitelisted owner can
   * drive the robot this way.
   * @param text - the operator's message text.
   * @param options - explicit groupId; defaults to the most recent surface.
   * @returns the anchored session id when a turn was queued.
   */
  async continueFromDsh(text: string, options: { groupId?: string } = {}): Promise<{ ok: boolean; sessionId?: string; error?: string }> {
    const allowed = await this.allowFrom()
    const operator = allowed?.[0]
    if (operator === undefined || operator === '') {
      return { ok: false, error: '机器人白名单为空：无法以操作者身份续接会话' }
    }
    const surface = await this.resolveSurface(options.groupId)
    if (surface === undefined) {
      return { ok: false, error: options.groupId === undefined
        ? '该机器人尚未收到任何入站消息，没有可续接的会话表面'
        : `该机器人没有见过群 ${options.groupId} 的消息` }
    }
    const message: RobotInboundMessage = {
      type: 2,
      robotId: surface.robotId,
      robotName: surface.robotName,
      operatorOpenid: operator,
      operatorName: 'DSH 控制台',
      time: Date.now(),
      msgId: `dsh-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
      content: text,
      groupType: surface.groupType,
      groupId: surface.groupId,
      synthetic: true,
    }
    await this.handle(message)
    const sessionId = this.lastSession.get(surface.groupId)
    return sessionId === undefined
      ? { ok: true, error: 'handle 返回但未锚定会话' }
      : { ok: true, sessionId: String(sessionId) }
  }

  /** Resolve one surface: explicit groupId, else the most recent one. */
  private async resolveSurface(groupId: string | undefined): Promise<(SurfaceState & { groupId: string }) | undefined> {
    const known = (key: string): (SurfaceState & { groupId: string }) | undefined => {
      const state = this.surfaces.get(key)
      return state === undefined ? undefined : { ...state, groupId: key }
    }
    if (groupId !== undefined) {
      const found = known(groupId)
      if (found !== undefined) return found
      const persisted = this.surface?.get(surfaceKey(this.channelIndex, groupId))
      return persisted === undefined ? undefined : { ...persisted, groupId }
    }
    const recent = this.recentGroups[this.recentGroups.length - 1]
    if (recent !== undefined) {
      const found = known(recent)
      if (found !== undefined) return found
      const persisted = this.surface?.get(surfaceKey(this.channelIndex, recent))
      return persisted === undefined ? undefined : { ...persisted, groupId: recent }
    }
    const persistedRecent = this.surface?.getMeta(recentKey(this.channelIndex))
    if (persistedRecent !== undefined && persistedRecent.value !== '') {
      const persisted = this.surface?.get(surfaceKey(this.channelIndex, persistedRecent.value))
      if (persisted !== undefined) return { ...persisted, groupId: persistedRecent.value }
    }
    // No recent marker (fresh store / legacy data): fall back to the most
    // recently seen persisted surface of this channel.
    const prefix = `surface:${this.channelIndex}:`
    let best: { state: SurfaceState; groupId: string } | undefined
    for (const [key, state] of this.surface?.entries() ?? []) {
      if (!key.startsWith(prefix)) continue
      if (best === undefined || state.time > best.state.time) best = { state, groupId: key.slice(prefix.length) }
    }
    return best === undefined ? undefined : { ...best.state, groupId: best.groupId }
  }

  /** Every surface this channel has seen, most recent first (lossless JSON). */
  surfaceSummary(): { groupId: string; robotId: string; robotName: string; groupType: number; time: number; lastSessionId?: string; groupName?: string }[] {
    const ordered = [...this.recentGroups].reverse()
    const seen = new Set<string>(ordered)
    const out: { groupId: string; robotId: string; robotName: string; groupType: number; time: number; lastSessionId?: string; groupName?: string }[] = []
    for (const groupId of ordered) {
      const state = this.surfaces.get(groupId)
      if (state !== undefined) {
        out.push({
          groupId,
          robotId: state.robotId,
          robotName: state.robotName,
          groupType: state.groupType,
          time: state.time,
          ...(state.lastSessionId === undefined ? {} : { lastSessionId: state.lastSessionId }),
          ...(state.groupName === undefined ? {} : { groupName: state.groupName }),
        })
      }
    }
    // Persisted surfaces the process has not seen live yet (restart) still
    // surface in status so robot_continue/fork targets are discoverable.
    const prefix = `surface:${this.channelIndex}:`
    for (const [key, state] of this.surface?.entries() ?? []) {
      if (!key.startsWith(prefix)) continue
      const groupId = key.slice(prefix.length)
      if (seen.has(groupId)) continue
      seen.add(groupId)
      out.push({
        groupId,
        robotId: state.robotId,
        robotName: state.robotName,
        groupType: state.groupType,
        time: state.time,
        ...(state.lastSessionId === undefined ? {} : { lastSessionId: state.lastSessionId }),
        ...(state.groupName === undefined ? {} : { groupName: state.groupName }),
      })
    }
    return out
  }

  /** The session a conversation last anchored on, when still live. */
  conversationSession(groupId: string): SessionId | undefined {
    return this.lastSession.get(groupId)
  }

  /** The working directory robot sessions on this channel are created with. */
  workdir(): string {
    return this.cwd
  }

  /** Every live session id this router created (lossless JSON for status). */
  liveSessionIds(): string[] {
    return [...this.handles.keys()].map(String)
  }

  private async authorized(operatorOpenid: string): Promise<boolean> {
    if (this.allowFromCache === undefined) {
      try {
        const resolved = await this.allowFrom()
        this.allowFromCache = resolved ?? []
      } catch (error) {
        this.logger?.warn(`robot: allowFrom resolve failed: ${String(error)}`)
        this.allowFromCache = []
      }
    }
    const allowFrom = this.allowFromCache
    return allowFrom !== undefined && allowFrom.includes(operatorOpenid)
  }

  private async reply(text: string, anchor: RobotSendOptions): Promise<RobotSendResult> {
    const result = await this.sender.send(text, anchor)
    if (result.ok && result.msgId !== undefined && this.lastSurface !== undefined) {
      if (this.lastSurface.sessionId !== '') {
        this.outboundAnchor.set(result.msgId, SessionId(this.lastSurface.sessionId))
        this.trimAnchor(this.outboundAnchor)
      }
      this.noteRobotPost(this.lastSurface, result.msgId, text, anchor.replyMsgId)
    }
    return result
  }

  /**
   * Queue one turn: inject the conversation's memory as instructions
   * context, then follow up the turn text. The PushHub owns all pushes for
   * the resulting output (interactive, scheduled, or otherwise sourced).
   */
  private async dispatchTurn(
    sessionId: SessionId,
    conversationKey: string,
    message: RobotInboundMessage,
    turnText: string,
  ): Promise<void> {
    const agent = await this.ensureAgent(sessionId, conversationKey)
    if (agent === undefined) {
      await this.reply('内部错误：无法创建会话，请稍后再试。', {
        replyMsgId: message.msgId,
        replySummary: message.content.slice(0, 60),
        replyPersonName: message.operatorName,
      })
      return
    }
    const lines = this.memory?.lines(conversationKey) ?? []
    if (lines.length > 0) {
      const text = `［本会话长期指令（用户设定，请遵守）］\n${lines.map(line => `- ${line}`).join('\n')}`
      try {
        agent.inject(createUserMessage({
          content: [{ type: 'text', text }],
          source: { kind: 'plugin', plugin: 'robot-yzj' },
        }))
      } catch (error) {
        this.logger?.warn(`robot: memory inject failed: ${String(error)}`)
      }
    }
    // Group threads learn their shared workspace every turn (§8.4): the
    // explicit cross-thread collaboration area, writable only through
    // robot_share_write (harness write tools are sandboxed in the private
    // workspace and would be denied on this path).
    if (!isDirectSurface(message)) {
      const text = [
        '［本群共享工作区］',
        `- 绝对路径：${this.shareDir(message.groupId)}`,
        '- 写共享区必须用 robot_share_write 工具（自动处理同名冲突）；禁止用 write/edit 工具写共享区路径（会被沙箱拒绝）',
        '- 读共享区文件可直接用内置 read/glob（绝对路径）。',
      ].join('\n')
      try {
        agent.inject(createUserMessage({
          content: [{ type: 'text', text }],
          source: { kind: 'plugin', plugin: 'robot-yzj' },
        }))
      } catch (error) {
        this.logger?.warn(`robot: share-dir inject failed: ${String(error)}`)
      }
    }
    const window = this.homeFace()?.formatSummonWindow?.(message.groupId, message.msgId, sessionId) ?? ''
    const events = (agent.session?.events ?? []) as unknown as { type: string; data: unknown }[]
    const already = events.some((event) => {
      if (event.type !== 'user/message') return false
      const raw = JSON.stringify(event.data ?? '')
      return raw.includes('［本群最近消息')
    })
    if (window !== '' && !already) {
      try {
        agent.inject(createUserMessage({
          content: [{ type: 'text', text: window }],
          source: { kind: 'plugin', plugin: 'robot-yzj' },
        }))
      } catch (error) {
        this.logger?.warn(`robot: summon-window inject failed: ${String(error)}`)
      }
    }
    try {
      agent.followup(createUserMessage({
        content: [{ type: 'text', text: turnText }],
        source: { kind: 'plugin', plugin: 'robot-yzj' },
      }))
    } catch (error) {
      this.logger?.warn(`robot: followup failed: ${String(error)}`)
    }
  }

  private async ensureAgent(sessionId: SessionId, conversationKey: string): Promise<Agent | undefined> {
    const existing = this.agents.get(sessionId)
    if (existing !== undefined) return existing
    // Resolution order: per-conversation override > channel defaults >
    // plugin-wide default (fallbackRoute) > harness default (omit the
    // fields entirely so the agent-loop route applies).
    const override = this.resolveOverride?.(conversationKey)
    const merged = {
      ...(this.fallbackRoute?.() ?? {}),
      ...(this.agentOptions ?? {}),
      ...(override ?? {}),
    }
    const hasRoute = merged.provider !== undefined && merged.provider !== ''
      || merged.model !== undefined && merged.model !== ''
    const agentOptions = hasRoute ? merged : undefined
    // Robot sessions live under an explicit working directory: DMs at the
    // channel root, bound group homes in `<cwd>/groups/<groupId>/` (one dir
    // per group, not per thread). The persona prompt section requires
    // {{cwd}} to resolve, and a bare `_no-cwd` session would fail prompt
    // assembly on its first turn — so the directory is created eagerly
    // (recursive) before the agent comes up.
    const cwd = this.sessionCwds.get(sessionId) ?? this.cwd
    if (cwd !== this.cwd) {
      try {
        mkdirSync(cwd, { recursive: true })
      } catch (error) {
        this.logger?.warn(`robot: mkdir session cwd failed for ${cwd}: ${String(error)}`)
      }
    }
    const composition = this.composePreset === undefined ? {} : await this.composePreset()
    const meta = {
      cwd,
      ...(composition.agentPreset === undefined ? {} : { agentPreset: composition.agentPreset }),
    }
    // A robot session is durable across host restarts: prefer resuming the
    // persisted log, fall back to a fresh create when none exists. Creating
    // over an existing log is a hard id-collision error in the session store.
    const handle = await this.agents
      .resume({
        resumeSessionId: sessionId,
        ...(agentOptions === undefined ? {} : { agentOptions }),
        ...(composition.setup === undefined ? {} : { setup: composition.setup }),
      })
      .catch(() => this.agents.create({
        sessionId,
        meta,
        ...(agentOptions === undefined ? {} : { agentOptions }),
        ...(composition.setup === undefined ? {} : { setup: composition.setup }),
      }))
      .catch(error => {
        this.logger?.warn(`robot: create/resume agent failed for ${sessionId}: ${String(error)}`)
        return undefined
      })
    if (handle === undefined) return undefined
    this.handles.set(sessionId, handle)
    return handle.agent
  }

  /** Execute one parsed memory verb and reply with the outcome. */
  private async runMemory(command: MemoryCommand, conversationKey: string, anchor: RobotSendOptions): Promise<void> {
    if (this.memory === undefined) return
    if (command.kind === 'list') {
      const lines = this.memory.lines(conversationKey)
      await this.reply(lines.length === 0
        ? '本会话暂无记忆。说「记住 …」即可添加。'
        : `本会话的记忆（${lines.length} 条）：\n${lines.map((line, index) => `${index + 1}. ${line}`).join('\n')}\n说「忘掉 …」可删除。`, anchor)
      return
    }
    const mutation = command.kind === 'remember'
      ? await this.memory.remember(conversationKey, command.line)
      : await this.memory.forget(conversationKey, command.substring)
    await this.reply(`${mutation.note}（当前 ${mutation.lines.length} 条）`, anchor)
  }

  private async runCommand(
    command: RobotCommand,
    message: RobotInboundMessage,
    anchor: RobotSendOptions,
  ): Promise<void> {
    const sessionId = await this.resolveSession(message)
    switch (command) {
      case 'help':
        await this.reply([
          '可用命令（独立成句才生效；!fork / !feedback 带参数）：',
          '!status — 查看机器人连接与会话状态',
          '!routines — 列出本会话的定时提醒',
          '!memory — 查看本会话的记忆（说「记住 …」添加、「忘掉 …」删除）',
          '!mute — 静音本会话（不再回复，!unmute 解除）',
          '!unmute — 解除静音',
          '!restart — 重启本会话（保留聊天记录，清空额外上下文）',
          '!configure — 机器人设置面板入口',
          '!fork <群ID> <指令> — 打开/恢复目标群的绑定会话并交接摘要（不开新根；群ID 见 !status）',
          '!feedback <文本> — 反馈给机器人维护者',
          '',
          '写操作会先推送确认卡：回复「确认 N / 取消 N」裁决。',
        ].join('\n'), anchor)
        return
      case 'configure':
        await this.reply(this.guiUrl === ''
          ? '机器人设置：在 DSH「设置 → 云之家」调整模型覆盖与通道状态。'
          : `机器人设置面板：${this.guiUrl}（设置 → 云之家：模型覆盖、通道状态）`, anchor)
        return
      case 'routines': {
        const agent = this.agents.get(sessionId)
        const lines: string[] = []
        if (agent !== undefined) {
          try {
            const folded = foldScheduleEvents(agent.session.events, agent.session.header.seedLength ?? 0)
            for (const record of folded.active) {
              lines.push(`· ${record.id} — ${record.prompt}${record.kind === 'every' ? `（每 ${Math.round(record.everySeconds / 60)} 分钟）` : ''}`)
            }
          } catch (error) {
            this.logger?.warn(`robot: routines fold failed: ${String(error)}`)
          }
        }
        await this.reply(lines.length === 0 ? '本会话暂无定时提醒（定时任务由 dsh-routines 管理：在对应 profile 用 `dsh routines list` 查看）。' : `本会话的定时提醒：\n${lines.join('\n')}`, anchor)
        return
      }
      case 'status': {
        const agent = this.agents.get(sessionId)
        await this.reply([
          `会话 ${sessionId}`,
          `状态 ${agent === undefined ? '未创建' : agent.status}`,
          `静音 ${this.muted.has(sessionId) ? '是' : '否'}`,
        ].join('\n'), anchor)
        return
      }
      case 'mute':
        this.muted.add(sessionId)
        await this.reply('已静音。发送 !unmute 解除。', anchor)
        return
      case 'unmute':
        this.muted.delete(sessionId)
        await this.reply('已解除静音。', anchor)
        return
      case 'restart': {
        const handle = this.handles.get(sessionId)
        if (handle !== undefined) {
          try {
            await handle.dispose()
          } catch (error) {
            this.logger?.warn(`robot: dispose failed on restart: ${String(error)}`)
          }
          this.handles.delete(sessionId)
        }
        this.forgetSession(sessionId)
        await this.reply('会话已重启（历史保留在 DSH 中）。', anchor)
        return
      }
    }
  }

  /**
   * `!fork <groupId|群名> <instruction>` (S3): hand the current session's
   * context summary over to the target group's session through the full
   * inbound pipeline (ack + agent turn in the target group). The target must
   * be a surface this robot has seen; the group's own session anchors there
   * and the instruction runs as the operator.
   */
  private async runFork(
    rawTarget: string,
    instruction: string,
    message: RobotInboundMessage,
    anchor: RobotSendOptions,
  ): Promise<void> {
    const trimmed = instruction.trim()
    if (rawTarget === message.groupId) {
      await this.reply('不能交接给当前群。请指定其他群的群名或 groupId（!status 可查本会话；DSH 侧 robot_status 可查全部表面）。', anchor)
      return
    }
    const target = await this.resolveForkTarget(rawTarget)
    if (target === undefined) {
      await this.reply(`交接失败：没有找到群「${rawTarget}」（仅支持机器人已见过的群；群名或 groupId 均可）`, anchor)
      return
    }
    const sessionId = await this.resolveSession(message)
    // !fork lands on the target group's bound session. The source summary
    // comes from this conversation's bound agent, falling back to lastSession
    // when the bang ran before any turn on a brand-new bind.
    const sourceId = this.agents.get(sessionId) !== undefined ? sessionId : this.lastSession.get(message.groupId)
    const agent = sourceId === undefined ? undefined : this.agents.get(sourceId)
    const summary = agent === undefined ? '' : conversationSummary(agent.session.events)
    const handover = summary === ''
      ? `${trimmed}\n\n（DSH 跨群交接：来自群 ${message.groupId} 的会话，暂无已完成轮次上下文）`
      : `${trimmed}\n\n（DSH 跨群交接：来自群 ${message.groupId} 的会话上下文摘要，见下）\n\n${summary}`
    const result = await this.continueFromDsh(handover, { groupId: target.groupId })
    if (!result.ok) {
      await this.reply(`交接失败：${result.error ?? '未知错误'}`, anchor)
      return
    }
    const label = target.name === undefined ? target.groupId : `${target.name}（${target.groupId}）`
    const preview = trimmed.length > 40 ? `${trimmed.slice(0, 40)}…` : trimmed
    await this.reply(
      `已交接给群 ${label}：${preview}${summary === '' ? '' : `（附 ${summary.length} 字上下文摘要）`}`,
      anchor,
    )
  }

  /** Resolve a `!fork` target: exact groupId first, then a lazy group-name
   * lookup over a bounded window of known surfaces. */
  private async resolveForkTarget(raw: string): Promise<{ groupId: string; name?: string } | undefined> {
    const byId = await this.resolveSurface(raw)
    if (byId !== undefined) {
      return byId.groupName === undefined ? { groupId: raw } : { groupId: raw, name: byId.groupName }
    }
    for (const surface of this.surfaceSummary().slice(0, GROUP_NAME_LOOKUP_LIMIT)) {
      const name = surface.groupName ?? await this.resolveGroupNameOf(surface.groupId)
      if (name === raw) return { groupId: surface.groupId, name }
    }
    return undefined
  }

  /** One group's human name: memory cache, then the resolver, then persist. */
  private async resolveGroupNameOf(groupId: string): Promise<string | undefined> {
    const cached = this.groupNames.get(groupId)
    if (cached !== undefined) return cached
    if (this.resolveGroupName === undefined) return undefined
    const name = await this.resolveGroupName(groupId)
    if (name === undefined || name === '') return undefined
    this.groupNames.set(groupId, name)
    const state = this.surfaces.get(groupId) ?? this.surface?.get(surfaceKey(this.channelIndex, groupId))
    if (state !== undefined) {
      void this.surface?.put(surfaceKey(this.channelIndex, groupId), { ...state, groupName: name }).catch(() => undefined)
    }
    return name
  }

  /**
   * `!feedback <text>` (S3): append to the local feedback log under the
   * harness home (`~/.dsh/robot-feedback.log`) and acknowledge. Delivery to a
   * maintenance group stays an explicit future option.
   */
  private async runFeedback(text: string, message: RobotInboundMessage, anchor: RobotSendOptions): Promise<void> {
    const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
    const line = [
      `[${new Date().toISOString()}] group=${message.groupId} robot=${message.robotId}`,
      `user=${message.operatorName}(${message.operatorOpenid})`,
      text.trim(),
      '---',
    ].join('\n') + '\n'
    try {
      mkdirSync(home, { recursive: true })
      appendFileSync(join(home, 'robot-feedback.log'), line, 'utf8')
      await this.reply(`已记录反馈（${text.trim().length} 字）。谢谢！`, anchor)
    } catch (error) {
      this.logger?.warn(`robot: feedback log failed: ${String(error)}`)
      await this.reply('反馈记录失败（本地日志写入异常），请稍后再试。', anchor)
    }
  }
}

/**
 * Join the text blocks of `assistant/message` events.
 * @param events - the full session event log (scan is bounded by `afterSeq`).
 * @param afterSeq - ignore events at or below this seq (double-send guard).
 * @returns the concatenated visible text ('' when none).
 */
export function collectAssistantText(events: readonly SessionEvent[], afterSeq: number): string {
  const parts: string[] = []
  for (const event of events) {
    if (event.type !== 'assistant/message' || event.seq <= afterSeq) continue
    for (const block of event.data.message.content) {
      if (block.type === 'text' && block.text !== '') parts.push(block.text)
    }
  }
  return parts.join('')
}

/**
 * Highest `assistant/message` seq above a watermark, for the push watermark.
 * @param events - the full session event log.
 * @param afterSeq - ignore events at or below this seq.
 * @returns the highest seq above the watermark, or -1 when none.
 */
export function highestAssistantSeq(events: readonly SessionEvent[], afterSeq: number): number {
  let highest = -1
  for (const event of events) {
    if (event.type === 'assistant/message' && event.seq > afterSeq && event.seq > highest) highest = event.seq
  }
  return highest
}
