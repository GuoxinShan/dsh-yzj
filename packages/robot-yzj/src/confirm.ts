/**
 * The group suggestion-card protocol (design §3.4 / S8): write tools fired by
 * a robot session's agent are gated by the same approval waterfall as GUI
 * sessions, but nobody watches a GUI card for a robot turn — so robot-yzj
 * owns those requests itself. On approval it pushes a numbered suggestion
 * into the conversation ("回复 确认 N / 取消 N") and resolves when an
 * allow-listed reply matches, or after the timeout (cancelled).
 *
 * The GUI write-gate (ui-yzj) skips sessions this broker owns (inbound
 * `registerSession`) so exactly one listener answers each request. Leftover
 * `yzj-robot-*` ids are also skipped at the write-gate.
 * @module @dsh-yzj/robot-yzj/confirm
 */

import type { SessionId } from '@deepseek-ai/dsh-session'
import type { RobotInboundMessage } from './protocol.ts'
import type { RouterSendFace } from './router.ts'
/** The approval outcome vocabulary this broker resolves with. */
export type ConfirmOutcome = 'allowed-once' | 'rejected' | 'cancelled'

/** Structural approval-request face (mirrors user-approval, fake-able). */
export interface ConfirmApprovalRequest {
  readonly agent: {
    readonly session: {
      readonly id: string
      readonly events: readonly { type: string; data: unknown }[]
    }
  }
  readonly toolName: string
  readonly callId?: string
  readonly reason?: string
  readonly signal?: {
    readonly aborted: boolean
    addEventListener(type: 'abort', listener: () => void, options?: { once?: boolean }): void
    removeEventListener(type: 'abort', listener: () => void): void
  }
}

/** The ask metadata tool-yzj's guard broadcasts before asking. */
export interface ConfirmAskPending {
  callId: string
  toolName: string
  level: 'standard' | 'strong'
  reason: string
  args: Record<string, unknown>
}

/** Per-session routing context the routers keep fresh on every message. */
export interface ConfirmContext {
  readonly sender: {
    send: RouterSendFace['send']
    sendCard: RouterSendFace['sendCard']
  }
  readonly robotId: string
  /** True for group surfaces; DMs confirm in the DM conversation. */
  readonly group: boolean
  readonly groupId: string
  readonly askerOpenId: string
  readonly askerName: string
}

/** Broker options. */
export interface ConfirmBrokerOptions {
  /** Suggestion validity window; defaults to 30 minutes. */
  readonly timeoutMs?: number
  readonly timers?: {
    setTimeout(handler: () => void, ms: number): unknown
    clearTimeout(handle: unknown): void
  }
  readonly logger?: { warn(message: string): void }
}

const DEFAULT_TIMEOUT_MS = 30 * 60_000

/** Inbound reply patterns: optional @-mention prefix, then 确认/取消 + number. */
const CONFIRM_REPLY = /^\s*(?:@[^\s@]+\s*)?(确认|允许|ok|okay|取消|拒绝|no)\s*#?(\d*)\s*$/i

interface PendingCard {
  readonly number: number
  readonly sessionId: string
  readonly context: ConfirmContext
  readonly toolName: string
  readonly digest: string
  readonly level: 'standard' | 'strong'
  resolve: ((outcome: ConfirmOutcome) => void) | undefined
  timer: unknown
  removeAbort: (() => void) | undefined
}

/**
 * One broker per host process (all robot channels share it). Routers feed it
 * session contexts; the approval listener answers only registered inbound
 * sessions; inbound replies are matched against open cards.
 */
export class ConfirmBroker {
  private readonly timeoutMs: number
  private readonly timers: NonNullable<ConfirmBrokerOptions['timers']>

  private nextNumber = 1
  private readonly cards = new Map<number, PendingCard>()
  private readonly sessionContext = new Map<string, ConfirmContext>()
  private readonly askByCallId = new Map<string, ConfirmAskPending>()

  constructor(options: ConfirmBrokerOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.timers = options.timers ?? {
      setTimeout: (h, ms) => setTimeout(h, ms),
      clearTimeout: h => clearTimeout(h as ReturnType<typeof setTimeout>),
    }
  }

  /** Routers call this on every authorized inbound message. */
  registerSession(sessionId: SessionId, context: ConfirmContext): void {
    this.sessionContext.set(String(sessionId), context)
    if (this.sessionContext.size > 200) {
      const oldest = this.sessionContext.keys().next().value
      if (oldest !== undefined) this.sessionContext.delete(oldest)
    }
  }

  /** True when inbound has registered this session (group suggestion cards). */
  ownsSession(sessionId: string): boolean {
    return this.sessionContext.has(sessionId)
  }

  /** Feed of `yzj/ask-pending` broadcasts (level + args for the digest). */
  noteAsk(pending: ConfirmAskPending): void {
    this.askByCallId.set(pending.callId, pending)
    if (this.askByCallId.size > 200) {
      const oldest = this.askByCallId.keys().next().value
      if (oldest !== undefined) this.askByCallId.delete(oldest)
    }
  }

  /** The approval/request waterfall slice this broker owns. */
  handleApproval(
    req: ConfirmApprovalRequest,
    next: () => Promise<ConfirmOutcome | 'unavailable'>,
  ): Promise<ConfirmOutcome | 'unavailable'> {
    const sessionId = req.agent.session.id
    const context = this.sessionContext.get(sessionId)
    if (context === undefined) return next()
    const ask = req.callId === undefined ? undefined : this.askByCallId.get(req.callId)
    const number = this.nextNumber
    this.nextNumber += 1
    const digest = digestOf(ask?.args, ask?.reason ?? req.reason ?? '')
    const card: PendingCard = {
      number,
      sessionId,
      context,
      toolName: req.toolName,
      digest,
      level: ask?.level ?? 'standard',
      resolve: undefined,
      timer: null as never,
      removeAbort: undefined,
    }
    const timeoutMinutes = Math.max(1, Math.round(this.timeoutMs / 60_000))
    // Application-style card (measured: renders without any template; cards
    // cannot carry a reply anchor, so the card title carries the context).
    void context.sender.sendCard({
      appName: 'DSH 助手',
      title: `${card.level === 'strong' ? '🔴 高风险写操作待确认' : '🔒 写操作待确认'} [${number}]`,
      customStyle: 1,
      primaryContent: `工具 ${req.toolName}`,
      body: [
        ...(digest === '' ? [] : [`内容：${digest}`]),
        `回复「确认 ${number}」执行，或「取消 ${number}」放弃`,
        `${timeoutMinutes} 分钟内有效`,
      ].join('\n'),
      ...(context.group ? { notifyOpenIds: [context.askerOpenId] } : {}),
    })
    return new Promise<ConfirmOutcome>(resolve => {
      const settle = (outcome: ConfirmOutcome): void => {
        this.timers.clearTimeout(card.timer)
        card.removeAbort?.()
        card.removeAbort = undefined
        card.resolve = undefined
        this.cards.delete(number)
        void context.sender.sendCard({
          appName: 'DSH 助手',
          title: outcome === 'allowed-once' ? `✅ [${number}] 已确认，执行中…` : `🚫 [${number}] 已${outcome === 'rejected' ? '取消' : '超时失效'}。`,
          customStyle: 1,
          primaryContent: `工具 ${card.toolName}`,
          body: outcome === 'allowed-once' ? '确认已放行，结果稍后回复。' : (outcome === 'rejected' ? '本次操作已放弃。' : '确认超时，操作未执行。'),
          ...(context.group ? { notifyOpenIds: [context.askerOpenId] } : {}),
        }).catch(() => undefined)
        resolve(outcome)
      }
      card.resolve = settle
      card.timer = this.timers.setTimeout(() => { settle('cancelled') }, this.timeoutMs)
      const onAbort = (): void => { settle('cancelled') }
      card.removeAbort = () => req.signal?.removeEventListener('abort', onAbort)
      req.signal?.addEventListener('abort', onAbort, { once: true })
      this.cards.set(number, card)
    })
  }

  /**
   * Match one authorized inbound message against open cards. A leading
   * @-mention (group surfaces deliver only @-addressed messages) is ignored.
   * @returns true when the message was consumed as a confirmation reply.
   */
  checkReply(message: RobotInboundMessage): boolean {
    const content = message.content.replace(/^\s*@[^\s@]+\s*/, '')
    const match = CONFIRM_REPLY.exec(content)
    if (match === null) return false
    const verb = match[1] ?? ''
    const rawNumber = match[2] ?? ''
    const approve = /^(确认|允许|ok|okay)$/i.test(verb)
    // Without a number: exactly one open card in this conversation resolves.
    let card: PendingCard | undefined
    if (rawNumber === '') {
      const candidates = [...this.cards.values()].filter(entry => sameConversation(entry, message))
      if (candidates.length === 1) card = candidates[0]
    } else {
      const numbered = this.cards.get(Number(rawNumber))
      if (numbered !== undefined && sameConversation(numbered, message)) card = numbered
    }
    if (card === undefined) return false
    card.resolve?.(approve ? 'allowed-once' : 'rejected')
    return true
  }

  /** Open-card count (diagnostics/tests). */
  get openCards(): number {
    return this.cards.size
  }

  /** Tear every open card down as cancelled (channel stop). */
  dispose(): void {
    for (const card of [...this.cards.values()]) {
      card.resolve?.('cancelled')
    }
    this.cards.clear()
    this.sessionContext.clear()
    this.askByCallId.clear()
  }
}

/** Whether one card belongs to the conversation the reply arrived in. */
function sameConversation(card: PendingCard, message: RobotInboundMessage): boolean {
  if (card.context.robotId !== message.robotId) return false
  return card.context.group
    ? message.groupId === card.context.groupId && !message.groupId.startsWith('BOT-')
    : message.groupId.startsWith('BOT-') && message.operatorOpenid === card.context.askerOpenId
}

/** Short human digest of the gated write's args. */
function digestOf(args: Record<string, unknown> | undefined, reason: string): string {
  const parts: string[] = []
  if (args !== undefined) {
    for (const key of ['content', 'title', 'name', 'records', 'filename']) {
      const value = args[key]
      if (typeof value === 'string' && value !== '') parts.push(value.slice(0, 80))
      else if (Array.isArray(value)) parts.push(JSON.stringify(value).slice(0, 80))
    }
  }
  if (parts.length === 0 && reason !== '') parts.push(reason.slice(0, 80))
  return parts.join('；')
}
