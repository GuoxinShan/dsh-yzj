/**
 * Inbound router: turns deduped robot messages into agent turns and pushes the
 * assistant's answer back. Session model mirrors Claude Tag on the measured
 * protocol — one persistent session per (robot, user) DM, reply-chain
 * continuation via the server-maintained replyRootMsgId, standalone bang
 * commands, per-session mute, and ack-then-push (the 3s HTTP contract makes
 * synchronous answers impossible; the ack text is the "is thinking" surface).
 * @module @dsh-yzj/robot-yzj/router
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent, AgentHandle, CreateAgentOptions } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { SessionId, type SessionEvent } from '@deepseek-ai/dsh-session'
import { InboundDedupe, type RobotInboundMessage } from './protocol.ts'
import type { RobotSendOptions, RobotSendResult } from './outbound.ts'

/** The tiny agents-registry face the router needs (fake-able in tests). */
export interface RouterAgentsFace {
  get(sessionId: SessionId): Agent | undefined
  createAgent(ownerCtx: Context, options: CreateAgentOptions): Promise<AgentHandle>
}

/** Outbound face (RobotSender satisfies it). */
export interface RouterSendFace {
  send(text: string, options?: RobotSendOptions): Promise<RobotSendResult>
}

/** Minimal logger face. */
export interface RouterLogger {
  warn(message: string): void
}

/** Resolves the allowFrom openId list; undefined keeps the current policy. */
export type AllowFromResolver = () => Promise<readonly string[] | undefined>

/** Router options; all faces are injectable. */
export interface RobotRouterOptions {
  readonly ownerCtx: Context
  readonly agents: RouterAgentsFace
  readonly sender: RouterSendFace
  /** Empty list denies everyone; the resolver may fill it lazily (whoami). */
  readonly allowFrom: AllowFromResolver
  readonly ackText?: string
  readonly denyText?: string
  readonly logger?: RouterLogger
}

/** Stable session id for one (robot, user) DM channel. */
export function dmSessionId(robotId: string, operatorOpenid: string): SessionId {
  return SessionId(`yzj-robot-${slug(robotId)}-${slug(operatorOpenid)}`)
}

function slug(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  return cleaned === '' ? 'x' : cleaned.slice(0, 40)
}

const STANDALONE_COMMAND = /^!(help|status|mute|unmute|restart)\s*$/

/**
 * The inbound brain. Construct once per robot connection; `handle` is called
 * for every classified robot message (dedupe happens here).
 */
export class RobotRouter {
  private readonly options: Required<Pick<RobotRouterOptions, 'ackText' | 'denyText'>> & RobotRouterOptions
  private readonly dedupe = new InboundDedupe()
  /** Handles for sessions this router created (restart needs the disposer). */
  private readonly handles = new Map<SessionId, AgentHandle>()
  /** Outbound msgId → owning session id (reply continuation). */
  private readonly outboundAnchor = new Map<string, SessionId>()
  /** Session key → muted flag. */
  private readonly muted = new Set<string>()
  /** Session id → highest assistant-event seq already pushed (no double sends). */
  private readonly pushedSeq = new Map<SessionId, number>()
  /** AllowFrom cache once resolved. */
  private allowFromCache: readonly string[] | undefined

  constructor(options: RobotRouterOptions) {
    this.options = options
  }

  /** Forget one session's live state (mute, watermark) — used on restart/dispose. */
  forgetSession(sessionId: SessionId): void {
    this.pushedSeq.delete(sessionId)
    for (const [msgId, owner] of this.outboundAnchor) {
      if (owner === sessionId) this.outboundAnchor.delete(msgId)
    }
  }

  /** Entry point for one classified inbound message. */
  async handle(message: RobotInboundMessage): Promise<void> {
    if (!this.dedupe.markSeen(message.msgId)) return
    const replyAnchor: RobotSendOptions = {
      replyMsgId: message.msgId,
      replySummary: message.content.slice(0, 60),
      replyPersonName: message.operatorName,
    }
    const command = STANDALONE_COMMAND.exec(message.content.trim())
    if (command !== null) {
      await this.runCommand(command[1] as 'help' | 'status' | 'mute' | 'unmute' | 'restart', message, replyAnchor)
      return
    }
    if (!(await this.authorized(message.operatorOpenid))) {
      await this.reply(this.options.denyText, replyAnchor)
      return
    }
    const { sessionId } = this.resolveSession(message)
    if (this.muted.has(sessionId)) return
    await this.reply(this.options.ackText, replyAnchor)
    await this.dispatchTurn(sessionId, message)
  }

  private async authorized(operatorOpenid: string): Promise<boolean> {
    if (this.allowFromCache === undefined) {
      try {
        this.allowFromCache = await this.options.allowFrom()
      } catch (error) {
        this.options.logger?.warn(`robot: allowFrom resolve failed: ${String(error)}`)
        this.allowFromCache = []
      }
    }
    return this.allowFromCache.includes(operatorOpenid)
  }

  /** Resolve the owning session for one message (DM persistent + reply chain). */
  private resolveSession(message: RobotInboundMessage): { sessionId: SessionId } {
    const dmId = dmSessionId(message.robotId, message.operatorOpenid)
    return { sessionId: dmId }
  }

  private async reply(text: string, anchor: RobotSendOptions): Promise<RobotSendResult> {
    return this.options.sender.send(text, anchor)
  }

  private async dispatchTurn(sessionId: SessionId, message: RobotInboundMessage): Promise<void> {
    const agent = await this.ensureAgent(sessionId)
    if (agent === undefined) {
      await this.reply('内部错误：无法创建会话，请稍后再试。', {
        replyMsgId: message.msgId,
        replySummary: message.content.slice(0, 60),
        replyPersonName: message.operatorName,
      })
      return
    }
    const markerSeq = lastSeq(agent.session.events)
    try {
      agent.followup(createUserMessage({
        content: [{ type: 'text', text: message.content }],
        source: { kind: 'plugin', plugin: 'robot-yzj' },
      }))
    } catch (error) {
      this.options.logger?.warn(`robot: followup failed: ${String(error)}`)
      return
    }
    try {
      await agent.whenIdle()
    } catch (error) {
      this.options.logger?.warn(`robot: agent idle wait failed: ${String(error)}`)
      return
    }
    const events = agent.session.events
    const afterSeq = Math.max(markerSeq, this.pushedSeq.get(sessionId) ?? -1)
    const answer = collectAssistantText(events, afterSeq)
    const highest = highestAssistantSeq(events, afterSeq)
    if (highest >= 0) this.pushedSeq.set(sessionId, highest)
    if (answer === '') return
    const result = await this.reply(answer, {
      replyMsgId: message.msgId,
      replySummary: message.content.slice(0, 60),
      replyPersonName: message.operatorName,
    })
    if (result.ok && result.msgId !== undefined) this.outboundAnchor.set(result.msgId, sessionId)
  }

  private async ensureAgent(sessionId: SessionId): Promise<Agent | undefined> {
    const existing = this.options.agents.get(sessionId)
    if (existing !== undefined) return existing
    try {
      const handle = await this.options.agents.createAgent(this.options.ownerCtx, { sessionId })
      this.handles.set(sessionId, handle)
      return handle.agent
    } catch (error) {
      this.options.logger?.warn(`robot: createAgent failed for ${sessionId}: ${String(error)}`)
      return undefined
    }
  }

  private async runCommand(
    command: 'help' | 'status' | 'mute' | 'unmute' | 'restart',
    message: RobotInboundMessage,
    anchor: RobotSendOptions,
  ): Promise<void> {
    const { sessionId } = this.resolveSession(message)
    switch (command) {
      case 'help':
        await this.reply(message, [
          '可用命令（独立成句才生效）：',
          '!status — 查看机器人连接与会话状态',
          '!mute — 静音本会话（不再回复，!unmute 解除）',
          '!unmute — 解除静音',
          '!restart — 重启本会话（保留聊天记录，清空额外上下文）',
        ].join('\n'), anchor)
        return
      case 'status': {
        const agent = this.options.agents.get(sessionId)
        await this.reply(message, [
          `会话 ${sessionId}`,
          `状态 ${agent === undefined ? '未创建' : agent.status}`,
          `静音 ${this.muted.has(sessionId) ? '是' : '否'}`,
        ].join('\n'), anchor)
        return
      }
      case 'mute':
        this.muted.add(sessionId)
        await this.reply(message, '已静音。发送 !unmute 解除。', anchor)
        return
      case 'unmute':
        this.muted.delete(sessionId)
        await this.reply(message, '已解除静音。', anchor)
        return
      case 'restart': {
        const handle = this.handles.get(sessionId)
        if (handle !== undefined) {
          try {
            await handle.dispose()
          } catch (error) {
            this.options.logger?.warn(`robot: dispose failed on restart: ${String(error)}`)
          }
          this.handles.delete(sessionId)
        }
        this.forgetSession(sessionId)
        await this.reply(message, '会话已重启（历史保留在 DSH 中）。', anchor)
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
