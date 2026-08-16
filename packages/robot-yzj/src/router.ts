/**
 * Inbound router: turns deduped robot messages into agent turns and pushes the
 * assistant's answer back. Session model mirrors Claude Tag on the measured
 * protocol — one persistent session per (robot, user) DM, reply-chain
 * continuation via the server-maintained replyRootMsgId, standalone bang
 * commands, per-session mute, and ack-then-push (the 3s HTTP contract makes
 * synchronous answers impossible; the ack text is the "is thinking" surface).
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

/** DM conversation key of one message (override-table form). */
function dmKeyOf(message: RobotInboundMessage): string {
  return dmKey(message.robotId, message.operatorOpenid)
}

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
  readonly ackText?: string
  readonly denyText?: string
  readonly logger?: RouterLogger
}

const DEFAULT_ACK_TEXT = '收到，处理中…'
const DEFAULT_DENY_TEXT = '抱歉，你不在本机器人的白名单内。'
const COMMAND_NAMES = ['help', 'status', 'routines', 'mute', 'unmute', 'restart'] as const
type RobotCommand = typeof COMMAND_NAMES[number]
const STANDALONE_COMMAND = /^!(help|status|routines|mute|unmute|restart)\s*$/

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

function slug(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  return cleaned === '' ? 'x' : cleaned.slice(0, 40)
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
  /** Session id → highest assistant-event seq already pushed (no double sends). */
  private readonly pushedSeq = new Map<SessionId, number>()
  /** AllowFrom cache once resolved. */
  private allowFromCache: readonly string[] | undefined

  constructor(options: RobotRouterOptions) {
    this.agents = options.agents
    this.sender = options.sender
    this.allowFrom = options.allowFrom
    this.agentOptions = options.agentOptions
    this.resolveOverride = options.resolveOverride
    this.confirm = options.confirm
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
    this.pushedSeq.clear()
  }

  /** Forget one session's live state (mute, watermark, anchors) — used on restart. */
  forgetSession(sessionId: SessionId): void {
    this.pushedSeq.delete(sessionId)
    this.muted.delete(sessionId)
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
    this.confirm?.registerSession(sessionId, {
      sender: this.sender,
      robotId: message.robotId,
      group,
      groupId: message.groupId,
      askerOpenId: message.operatorOpenid,
      askerName: message.operatorName,
    })
    // The ack is a robot message in the chain — anchor it so replies to the
    // ack (not just to the final answer) continue this session.
    const ackResult = await this.reply(this.ackText, replyAnchor)
    if (ackResult.ok && ackResult.msgId !== undefined) {
      this.outboundAnchor.set(ackResult.msgId, sessionId)
      this.trimAnchor(this.outboundAnchor)
    }
    await this.dispatchTurn(sessionId, message)
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

  private async dispatchTurn(sessionId: SessionId, message: RobotInboundMessage): Promise<void> {
    const group = !isDirectSurface(message)
    const conversationKey = group
      ? groupKey(message.groupId)
      : dmKeyOf(message)
    const anchorOf = (): RobotSendOptions => ({
      replyMsgId: message.msgId,
      replySummary: message.content.slice(0, 60),
      replyPersonName: message.operatorName,
      ...(group ? { notifyOpenIds: [message.operatorOpenid] } : {}),
    })
    const agent = await this.ensureAgent(sessionId, conversationKey)
    if (agent === undefined) {
      await this.reply('内部错误：无法创建会话，请稍后再试。', anchorOf())
      return
    }
    const markerSeq = lastSeq(agent.session.events)
    let lastError: string | undefined
    const errorListener = (payload: { agent?: { id?: string }; error?: unknown }): void => {
      if (payload.agent?.id === agent.id) {
        this.logger?.warn(`robot: agent error in ${sessionId}: ${String(payload.error)}`)
        lastError = String(payload.error)
      }
    }
    // ctx.on returns the disposer; detach it on every exit below.
    const detach = agent.ctx.on('agent/error', errorListener as never)
    try {
      agent.followup(createUserMessage({
        content: [{ type: 'text', text: message.content }],
        source: { kind: 'plugin', plugin: 'robot-yzj' },
      }))
    } catch (error) {
      this.logger?.warn(`robot: followup failed: ${String(error)}`)
      detach()
      return
    }
    try {
      await agent.whenIdle()
    } catch (error) {
      this.logger?.warn(`robot: agent idle wait failed: ${String(error)}`)
      detach()
      return
    }
    detach()
    const events = agent.session.events
    const afterSeq = Math.max(markerSeq, this.pushedSeq.get(sessionId) ?? -1)
    const answer = collectAssistantText(events, afterSeq)
    const highest = highestAssistantSeq(events, afterSeq)
    if (highest >= 0) this.pushedSeq.set(sessionId, highest)
    const histogram = events.filter(e => e.seq > markerSeq).map(e => e.type).join(',')
    this.logger?.warn(`robot: turn done for ${sessionId} events=[${histogram}] answer=${answer.length}ch${lastError === undefined ? '' : ` err=${lastError.slice(0, 200)}`}`)
    if (answer === '') {
      await this.reply(lastError === undefined ? '本轮没有产出回答（会话已记录，可在 DSH 中查看）。' : `处理失败：${lastError.slice(0, 300)}`, anchorOf())
      return
    }
    const result = await this.reply(answer, anchorOf())
    if (result.ok && result.msgId !== undefined) {
      this.outboundAnchor.set(result.msgId, sessionId)
      this.trimAnchor(this.outboundAnchor)
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

/** Last seq in the log, or -1 for an empty log. */
function lastSeq(events: readonly SessionEvent[]): number {
  return events.length === 0 ? -1 : events[events.length - 1]!.seq
}
