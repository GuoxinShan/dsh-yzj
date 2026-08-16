/**
 * Event-driven push hub: the single place robot-session output becomes
 * conversation messages. The service feeds it the host firehose
 * (`session/event`) plus agent lifecycle (`agent/status`, `agent/error`);
 * routers register each conversation's outbound context on every inbound
 * message. Because pushing is decoupled from the inbound dispatch path, ANY
 * turn source reaches the conversation — interactive replies, scheduled
 * reminders, watchers — closing the Claude-Tag routines-delivery gap.
 *
 * Push behavior: assistant text accumulates per session above a watermark
 * and flushes when the agent goes idle (reply-anchored to the last inbound
 * message; group surfaces notify the asker). Long turns emit a milestone
 * line every 5 tool calls (unnotified, rate-limited). Agent errors surface
 * as a bounded failure line instead of silence.
 * @module @dsh-yzj/robot-yzj/push
 */

import type { SessionId } from '@deepseek-ai/dsh-session'

/** Minimal sender face (RobotSender satisfies it). */
export interface PushSender {
  send(text: string, options?: {
    replyMsgId?: string
    replySummary?: string
    replyPersonName?: string
    notifyOpenIds?: readonly string[]
  }): Promise<{ ok: boolean; msgId?: string; error?: string }>
}

/** One conversation's outbound context, refreshed on every inbound message. */
export interface PushConversation {
  readonly sender: PushSender
  /** True for group surfaces; DMs confirm/push without targeting. */
  readonly group: boolean
  readonly askerOpenId: string
  readonly askerName: string
  /** The last inbound message, used as the reply anchor for pushes. */
  readonly lastInbound: { msgId: string; summary: string; personName: string }
  /** True for DSH-side synthetic turns: pushes must not anchor replies (the msgId never existed on the server). */
  readonly noReplyAnchor?: boolean
}

/** Structural session-event face (firehose payloads we consume). */
export interface PushSessionEvent {
  readonly type: string
  readonly seq: number
  readonly data: {
    readonly message?: { readonly content: readonly { readonly type: string; readonly text?: string }[] }
  }
}

/** One session's in-flight collection state. */
interface TurnStash {
  parts: string[]
  topSeq: number
  toolCalls: number
  nextMilestone: number
}

/** How many tool calls between milestone lines. */
const MILESTONE_EVERY = 5

/**
 * The hub. One instance per host process, shared by every channel router;
 * conversation ids (session ids) are globally unique.
 */
export class PushHub {
  private readonly conversations = new Map<string, PushConversation>()
  private readonly stashes = new Map<string, TurnStash>()
  private readonly watermarks = new Map<string, number>()

  /** Routers call this on every authorized inbound message. */
  register(sessionId: SessionId, conversation: PushConversation): void {
    this.conversations.set(String(sessionId), conversation)
    if (this.conversations.size > 300) {
      const oldest = this.conversations.keys().next().value
      if (oldest !== undefined) this.conversations.delete(oldest)
    }
  }

  /** Drop one conversation's live state (router dispose / !restart). */
  forget(sessionId: SessionId): void {
    const key = String(sessionId)
    this.conversations.delete(key)
    this.stashes.delete(key)
    this.watermarks.delete(key)
  }

  /** `session/event` slice for robot sessions; ignores unknown sessions. */
  noteEvent(sessionId: string, event: PushSessionEvent): void {
    const conversation = this.conversations.get(sessionId)
    if (conversation === undefined) return
    if (event.type === 'assistant/message') {
      const stash = this.stashOf(sessionId)
      const watermark = this.watermarks.get(sessionId) ?? -1
      if (event.seq <= watermark) return
      for (const block of event.data.message?.content ?? []) {
        if (block.type === 'text' && block.text !== undefined && block.text !== '') stash.parts.push(block.text)
      }
      if (event.seq > stash.topSeq) stash.topSeq = event.seq
      return
    }
    if (event.type === 'tool/call') {
      const stash = this.stashOf(sessionId)
      stash.toolCalls += 1
      if (stash.toolCalls >= stash.nextMilestone) {
        stash.nextMilestone += MILESTONE_EVERY
        void this.sendSafely(conversation, `⏳ 进行中：已执行 ${stash.toolCalls} 个工具步骤…`)
      }
    }
  }

  /** `agent/status` idle transition: flush the accumulated answer. */
  noteIdle(sessionId: string): void {
    const conversation = this.conversations.get(sessionId)
    const stash = this.stashes.get(sessionId)
    if (conversation === undefined || stash === undefined) return
    this.stashes.delete(sessionId)
    if (stash.topSeq >= 0) this.watermarks.set(sessionId, stash.topSeq)
    const answer = stash.parts.join('')
    if (answer === '') return
    void this.sendSafely(conversation, answer, true)
  }

  /** `agent/error` slice: bounded failure line instead of silence. */
  noteError(sessionId: string, error: unknown): void {
    const conversation = this.conversations.get(sessionId)
    if (conversation === undefined) return
    const text = String(error).slice(0, 300)
    void this.sendSafely(conversation, `⚠️ 处理失败：${text}`)
  }

  /** Send with the conversation's reply anchor; notify only final answers. */
  private async sendSafely(conversation: PushConversation, text: string, notify = false): Promise<void> {
    try {
      await conversation.sender.send(text, {
        ...(conversation.noReplyAnchor === true
          ? {}
          : {
              replyMsgId: conversation.lastInbound.msgId,
              replySummary: conversation.lastInbound.summary,
              replyPersonName: conversation.lastInbound.personName,
            }),
        ...(notify && conversation.group ? { notifyOpenIds: [conversation.askerOpenId] } : {}),
      })
    } catch {
      // Outbound failures are logged by the sender's channel; never throw
      // from a firehose listener.
    }
  }

  /** Diagnostic snapshot: open conversations, active stashes, watermarks. */
  diagnostics(): { conversations: number; activeTurns: { sessionId: string; parts: number; toolCalls: number }[]; watermarks: number } {
    const activeTurns: { sessionId: string; parts: number; toolCalls: number }[] = []
    for (const [sessionId, stash] of this.stashes) {
      activeTurns.push({ sessionId, parts: stash.parts.length, toolCalls: stash.toolCalls })
    }
    return { conversations: this.conversations.size, activeTurns, watermarks: this.watermarks.size }
  }

  /** Lazy stash allocation for one session's active turn. */
  private stashOf(sessionId: string): TurnStash {
    let stash = this.stashes.get(sessionId)
    if (stash === undefined) {
      stash = { parts: [], topSeq: -1, toolCalls: 0, nextMilestone: MILESTONE_EVERY }
      this.stashes.set(sessionId, stash)
    }
    return stash
  }
}
