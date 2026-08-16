/**
 * Inbound router: turns deduped robot messages into agent turns. Session
 * model mirrors Claude Tag on the measured protocol — one persistent session
 * per (robot, user) DM, reply-chain continuation via the server-maintained
 * replyRootMsgId, standalone bang commands, per-session mute, and
 * ack-then-push where the PUSH half lives in the event-driven PushHub (any
 * turn source reaches the conversation). Conversation memory (S4) stores
 * user-declared rules and injects them as instructions context every turn;
 * the first group message triggers a self-introduction turn (S7/C14).
 * @module @dsh-yzj/robot-yzj/router
 */

import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import { foldScheduleEvents } from '@deepseek-ai/dsh-schedule'
import { appendFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
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
  /** Per-conversation override lookup (wins over agentOptions); absent = none. */
  readonly resolveOverride?: OverrideResolver
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
  readonly ackText?: string
  readonly denyText?: string
  readonly logger?: RouterLogger
  /** GUI base URL for `!configure` and S2 session deep links; absent = text guidance only. */
  readonly guiUrl?: string
}

const DEFAULT_ACK_TEXT = '收到，处理中…'
const DEFAULT_DENY_TEXT = '抱歉，你不在本机器人的白名单内。'
const COMMAND_NAMES = ['help', 'status', 'routines', 'mute', 'unmute', 'restart', 'configure'] as const
type RobotCommand = typeof COMMAND_NAMES[number]
const STANDALONE_COMMAND = /^!(help|status|routines|mute|unmute|restart|configure)\s*$/
/** `!fork <groupId> <instruction>` — cross-group handover (S3): the current
 * session's context summary is forwarded to a new/anchored session of the
 * target group through the full inbound pipeline. */
const FORK_COMMAND = /^!fork\s+(\S+)\s+(.+)$/is
/** `!feedback <text>` — append to the local feedback log and acknowledge. */
const FEEDBACK_COMMAND = /^!feedback\s+(.+)$/is
/** Memory verbs (S4): a leading @-mention is tolerated on group surfaces. */
const MEMORY_REMEMBER = /^(?:@[^\s@]+\s*)?(?:记住|remember)\s*[:：]?\s+(.+)$/is
const MEMORY_LIST = /^(?:@[^\s@]+\s*)?(?:!memory|你记住了什么|列出记忆)\s*$/i
const MEMORY_FORGET = /^(?:@[^\s@]+\s*)?(?:忘掉|忘记|forget)\s+[:：]?\s*(.+)$/is

/** Stable session id for one (robot, user) DM channel. */
export function dmSessionId(robotId: string, operatorOpenid: string): SessionId {
  return SessionId(`yzj-robot-${slug(robotId)}-${slug(operatorOpenid)}`)
}

/** Stable session id for one top-level group conversation root (Claude-Tag thread analogue). */
export function groupSessionId(robotId: string, groupId: string, rootMsgId: string): SessionId {
  return SessionId(`yzj-robot-${slug(robotId)}-g${slug(groupId)}-${slug(rootMsgId)}`)
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

/** @see slug — public so the service can derive fork session ids. */
export function slugId(value: string): string {
  return slug(value)
}

/**
 * The balanced completed-turn prefix of a session log: every event up to and
 * including the last `turn/end`. The in-flight turn is excluded; before any
 * completed turn the result is empty. Because live sequence numbers equal
 * array indexes, the result is a valid fork `seed` beginning at sequence zero
 * (same boundary the harness fork subagent uses).
 * @param events - the source session's full event log.
 * @returns the seed events, contiguous from seq 0; empty when no turn has completed.
 */
export function completedTurnPrefix(events: readonly SessionEvent[]): SessionEvent[] {
  const lastEnd = events.findLast(event => event.type === 'turn/end')
  if (lastEnd === undefined) return []
  return events.slice(0, lastEnd.seq + 1)
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
  private readonly resolveOverride: OverrideResolver | undefined
  private readonly confirm: ConfirmBroker | undefined
  private readonly push: PushHub | undefined
  private readonly memory: RouterMemoryFace | undefined
  private readonly surface: SurfaceStoreFace | undefined
  private readonly channelIndex: number
  private readonly cwd: string
  private readonly ackText: string
  private readonly denyText: string
  private readonly logger: RouterLogger | undefined
  private readonly guiUrl: string

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
    this.resolveOverride = options.resolveOverride
    this.confirm = options.confirm
    this.push = options.push
    this.memory = options.memory
    this.surface = options.surface
    this.channelIndex = options.channelIndex ?? 0
    this.cwd = options.cwd ?? process.cwd()
    this.ackText = options.ackText ?? DEFAULT_ACK_TEXT
    this.denyText = options.denyText ?? DEFAULT_DENY_TEXT
    this.logger = options.logger
    this.guiUrl = options.guiUrl ?? ''
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

  /**
   * Resolve the owning session for one message. DM surfaces keep one
   * persistent session per (robot, user). Group surfaces follow the Claude-Tag
   * thread model on reply chains: a reply whose target/root is an anchored
   * message continues that session; any other message anchors a fresh session
   * at its own msgId.
   */
  private resolveSession(message: RobotInboundMessage): SessionId {
    if (isDirectSurface(message)) return dmSessionId(message.robotId, message.operatorOpenid)
    // A synthetic DSH-side turn continues the last conversation anchored on
    // this surface instead of anchoring a fresh thread at a fake msgId. The
    // in-memory map is hydrated lazily from the durable surface record, so
    // continuation survives host restarts.
    if (message.synthetic === true) {
      const last = this.lastSession.get(message.groupId)
        ?? this.surface?.get(surfaceKey(this.channelIndex, message.groupId))?.lastSessionId
      if (last !== undefined) return SessionId(last)
    }
    const reply = parseReplyMeta(message.msgParam).reply
    if (reply !== undefined) {
      const anchored = this.outboundAnchor.get(reply.replyMsgId)
        ?? this.inboundAnchor.get(reply.replyMsgId)
        ?? this.outboundAnchor.get(reply.replyRootMsgId)
        ?? this.inboundAnchor.get(reply.replyRootMsgId)
      if (anchored !== undefined) return anchored
    }
    const sessionId = groupSessionId(message.robotId, message.groupId, message.msgId)
    this.inboundAnchor.set(message.msgId, sessionId)
    this.trimAnchor(this.inboundAnchor)
    this.sessionCwds.set(sessionId, this.groupThreadCwd(message.groupId, message.msgId))
    return sessionId
  }

  /** Private working directory of one group thread (slugged, stable across restarts). */
  private groupThreadCwd(groupId: string, rootMsgId: string): string {
    return join(this.cwd, 'groups', slug(groupId), slug(rootMsgId))
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
    const sessionId = this.resolveSession(message)
    this.noteSession(message, sessionId)
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
    })
    // The ack is a robot message in the chain — anchor it so replies to the
    // ack (not just to the final answer) continue this session. The task
    // summary rides the ack as the Claude-Tag display-name analogue (C12).
    const taskSummary = message.content.trim().slice(0, 24)
    const ackText = taskSummary.length >= 12
      ? `${this.ackText}（${taskSummary}${message.content.trim().length > 24 ? '…' : ''}）`
      : this.ackText
    const ackResult = await this.reply(ackText, replyAnchor)
    if (ackResult.ok && ackResult.msgId !== undefined) {
      this.outboundAnchor.set(ackResult.msgId, sessionId)
      this.trimAnchor(this.outboundAnchor)
    }
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
  surfaceSummary(): { groupId: string; robotId: string; robotName: string; groupType: number; time: number; lastSessionId?: string }[] {
    const ordered = [...this.recentGroups].reverse()
    const seen = new Set<string>(ordered)
    const out: { groupId: string; robotId: string; robotName: string; groupType: number; time: number; lastSessionId?: string }[] = []
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
    return this.sender.send(text, anchor)
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
    // Resolution order: per-conversation override > channel defaults > harness
    // default (omit the fields entirely so the agent-loop route applies).
    const override = this.resolveOverride?.(conversationKey)
    const merged = { ...(this.agentOptions ?? {}), ...(override ?? {}) }
    const hasRoute = merged.provider !== undefined && merged.provider !== ''
      || merged.model !== undefined && merged.model !== ''
    const agentOptions = hasRoute ? merged : undefined
    // Robot sessions live under an explicit working directory: DMs at the
    // channel root, group threads in their private workspace
    // (`<cwd>/groups/<groupId>/<rootMsgId>/`, §8.4). The persona prompt
    // section requires {{cwd}} to resolve, and a bare `_no-cwd` session would
    // fail prompt assembly on its first turn — so the directory is created
    // eagerly (recursive) before the agent comes up.
    const cwd = this.sessionCwds.get(sessionId) ?? this.cwd
    if (cwd !== this.cwd) {
      try {
        mkdirSync(cwd, { recursive: true })
      } catch (error) {
        this.logger?.warn(`robot: mkdir session cwd failed for ${cwd}: ${String(error)}`)
      }
    }
    const meta = { cwd }
    // A robot session is durable across host restarts: prefer resuming the
    // persisted log, fall back to a fresh create when none exists. Creating
    // over an existing log is a hard id-collision error in the session store.
    const handle = await this.agents
      .resume({ resumeSessionId: sessionId, ...(agentOptions === undefined ? {} : { agentOptions }) })
      .catch(() => this.agents.create({ sessionId, meta, ...(agentOptions === undefined ? {} : { agentOptions }) }))
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
    const sessionId = this.resolveSession(message)
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
          '!fork <群ID> <指令> — 把本会话上下文交接给目标群（群ID 见 !status）',
          '!feedback <文本> — 反馈给机器人维护者',
          '',
          '写操作会先推送确认卡：回复「确认 N / 取消 N」裁决。',
        ].join('\n'), anchor)
        return
      case 'configure':
        await this.reply(this.guiUrl === ''
          ? '机器人设置：在 DSH 面板（悬浮球）的「机器人」tab 调整模型覆盖与通道状态。'
          : `机器人设置面板：${this.guiUrl}（「机器人」tab：模型覆盖、通道状态、会话列表）`, anchor)
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
   * `!fork <groupId> <instruction>` (S3): hand the current session's context
   * summary over to the target group's session through the full inbound
   * pipeline (ack + agent turn in the target group). The target must be a
   * surface this robot has seen; the group's own session anchors there and
   * the instruction runs as the operator.
   */
  private async runFork(
    targetGroupId: string,
    instruction: string,
    message: RobotInboundMessage,
    anchor: RobotSendOptions,
  ): Promise<void> {
    const trimmed = instruction.trim()
    if (targetGroupId === message.groupId) {
      await this.reply('不能交接给当前群。请指定其他群的 groupId（!status 可查本会话；DSH 侧 robot_status 可查全部表面）。', anchor)
      return
    }
    const sessionId = this.resolveSession(message)
    // A top-level !fork opens a fresh thread session with no agent yet; the
    // conversation's context lives in the group's last anchored session, so
    // fall back to it when the message's own session has nothing.
    const sourceId = this.agents.get(sessionId) !== undefined ? sessionId : this.lastSession.get(message.groupId)
    const agent = sourceId === undefined ? undefined : this.agents.get(sourceId)
    const summary = agent === undefined ? '' : conversationSummary(agent.session.events)
    const handover = summary === ''
      ? `${trimmed}\n\n（DSH 跨群交接：来自群 ${message.groupId} 的会话，暂无已完成轮次上下文）`
      : `${trimmed}\n\n（DSH 跨群交接：来自群 ${message.groupId} 的会话上下文摘要，见下）\n\n${summary}`
    const result = await this.continueFromDsh(handover, { groupId: targetGroupId })
    if (!result.ok) {
      await this.reply(`交接失败：${result.error ?? '未知错误'}`, anchor)
      return
    }
    const preview = trimmed.length > 40 ? `${trimmed.slice(0, 40)}…` : trimmed
    await this.reply(
      `已交接给群 ${targetGroupId}：${preview}${summary === '' ? '' : `（附 ${summary.length} 字上下文摘要）`}`,
      anchor,
    )
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
