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
import type { Agent, AgentHandle, CreateAgentOptions, ResumeAgentOptions } from '@deepseek-ai/dsh-agent'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { InboundDedupe, parseReplyMeta, type RobotInboundMessage } from './protocol.ts'
import type { RobotCardOptions, RobotSendOptions, RobotSendResult } from './outbound.ts'
import { dmKey, groupKey } from './overrides.ts'
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
  readonly ackText?: string
  readonly denyText?: string
  readonly logger?: RouterLogger
}

const DEFAULT_ACK_TEXT = '收到，处理中…'
const DEFAULT_DENY_TEXT = '抱歉，你不在本机器人的白名单内。'
const COMMAND_NAMES = ['help', 'status', 'routines', 'mute', 'unmute', 'restart'] as const
type RobotCommand = typeof COMMAND_NAMES[number]
const STANDALONE_COMMAND = /^!(help|status|routines|mute|unmute|restart)\s*$/
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
    '（系统引导：请按以下步骤回复群友，中文、简洁）',
    '1. 先用 yzj_im_message_list 读取本群最近的聊天记录（groupId 用当前群的）；',
    '2. 用两三句话自我介绍：你是接入 DeepSeek Harness 的机器人助手，可以操作云之家（文档/日程/待办/消息/多维表格）并调度 DSH 的全部能力；',
    '3. 根据群内近况提出 2~3 个你现在就能帮忙的具体任务；',
    '4. 最后提醒：发 !help 可看命令列表。',
  ].join('\n')
}

function slug(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  return cleaned === '' ? 'x' : cleaned.slice(0, 40)
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
  private readonly ackText: string
  private readonly denyText: string
  private readonly logger: RouterLogger | undefined

  private readonly dedupe = new InboundDedupe()
  /** Handles for sessions this router created (dispose/restart need them). */
  private readonly handles = new Map<SessionId, AgentHandle>()
  /** Outbound msgId → owning session id (reply continuation). */
  private readonly outboundAnchor = new Map<string, SessionId>()
  /** Inbound root msgId → anchored group session id (reply continuation). */
  private readonly inboundAnchor = new Map<string, SessionId>()
  /** Session id → muted flag. */
  private readonly muted = new Set<string>()
  /** (robotId, groupId) pairs that already had their intro turn (S7). */
  private readonly introduced = new Set<string>()
  /** AllowFrom cache once resolved. */
  private allowFromCache: readonly string[] | undefined

  constructor(options: RobotRouterOptions) {
    this.agents = options.agents
    this.sender = options.sender
    this.allowFrom = options.allowFrom
    this.agentOptions = options.agentOptions
    this.resolveOverride = options.resolveOverride
    this.confirm = options.confirm
    this.push = options.push
    this.memory = options.memory
    this.ackText = options.ackText ?? DEFAULT_ACK_TEXT
    this.denyText = options.denyText ?? DEFAULT_DENY_TEXT
    this.logger = options.logger
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
    this.introduced.clear()
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
    return sessionId
  }

  /** Entry point for one classified inbound message. */
  async handle(message: RobotInboundMessage): Promise<void> {
    if (!this.dedupe.markSeen(message.msgId)) return
    const group = !isDirectSurface(message)
    const replyAnchor: RobotSendOptions = {
      replyMsgId: message.msgId,
      replySummary: message.content.slice(0, 60),
      replyPersonName: message.operatorName,
      // Group surfaces highlight only the asker; DMs need no targeting.
      ...(group ? { notifyOpenIds: [message.operatorOpenid] } : {}),
    }
    const command = STANDALONE_COMMAND.exec(message.content.trim())
    const commandName = command?.[1] as RobotCommand | undefined
    if (commandName !== undefined && COMMAND_NAMES.includes(commandName)) {
      await this.runCommand(commandName, message, replyAnchor)
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
    // The first conversation in a group starts with a self-introduction turn
    // (S7/C14) instead of the raw message; the PushHub delivers its answer.
    let turnText = message.content
    if (group && !this.introduced.has(`${message.robotId}:${message.groupId}`)) {
      this.introduced.add(`${message.robotId}:${message.groupId}`)
      turnText = introPrompt()
    }
    await this.dispatchTurn(sessionId, conversationKey, message, turnText)
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
    // Robot sessions live under the dsh-yzj checkout: the persona prompt
    // section requires {{cwd}} to resolve, and a bare `_no-cwd` session would
    // fail prompt assembly on its first turn.
    const meta = { cwd: process.cwd() }
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
          '可用命令（独立成句才生效）：',
          '!status — 查看机器人连接与会话状态',
          '!routines — 列出本会话的定时提醒',
          '!memory — 查看本会话的记忆（说「记住 …」添加、「忘掉 …」删除）',
          '!mute — 静音本会话（不再回复，!unmute 解除）',
          '!unmute — 解除静音',
          '!restart — 重启本会话（保留聊天记录，清空额外上下文）',
          '',
          '写操作会先推送确认卡：回复「确认 N / 取消 N」裁决。',
        ].join('\n'), anchor)
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
        await this.reply(lines.length === 0 ? '本会话暂无定时提醒（让 agent 用 schedule_create 建立提醒）。' : `本会话的定时提醒：\n${lines.join('\n')}`, anchor)
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
