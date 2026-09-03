/**
 * Hidden assistant agents: resume-or-create one DSH session per assistant,
 * then followup on a per-assistant serial queue. Structural agents face —
 * do not import dsh-session (client/host one tsconfig).
 * @module @dsh-yzj/ui-yzj/assistant-runtime
 */

import { mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import {
  identifiedUserMessage, topicAgentComposition, topicAgentRoute,
  type HomeOpenAgents,
} from './home-open.ts'
import { lastAssistantText } from '@dsh-yzj/tool-yzj/src/index.ts'
import type { TurnTarget, YzjAssistantsService } from '@dsh-yzj/tool-yzj/src/assistants.ts'

/** Canonical cwd for one assistant: `~/.dsh-yzj/assistants/<id>/`. */
export function assistantCwd(assistantId: string): string {
  return join(homedir(), '.dsh-yzj', 'assistants', assistantId)
}

/** Create the directory if missing; return the path even when mkdir is denied. */
export async function ensureAssistantCwd(assistantId: string): Promise<string> {
  const path = assistantCwd(assistantId)
  try {
    await mkdir(path, { recursive: true })
  } catch {
    // Sandbox / permissions: callers still get the dedicated path.
  }
  return path
}

function agentsFace(ctx: Context): HomeOpenAgents | undefined {
  const agentsRaw = ctx.get('agents') as HomeOpenAgents | undefined
  return agentsRaw
}

function liveAgent(ctx: Context, sessionId: string): {
  session?: { events?: readonly { type: string; data?: unknown }[] }
  followup?: (message: unknown) => void
} | undefined {
  const agents = agentsFace(ctx)
  const got = agents?.get(sessionId) as {
    agent?: { session?: { events?: readonly { type: string; data?: unknown }[] }; followup?: (message: unknown) => void }
    session?: { events?: readonly { type: string; data?: unknown }[] }
    followup?: (message: unknown) => void
  } | undefined
  if (got === undefined) return undefined
  const inner = got.agent
  if (inner !== undefined) {
    return {
      ...(inner.session === undefined ? {} : { session: inner.session }),
      ...(inner.followup === undefined ? {} : { followup: inner.followup }),
    }
  }
  return {
    ...(got.session === undefined ? {} : { session: got.session }),
    ...(got.followup === undefined ? {} : { followup: got.followup }),
  }
}

/**
 * Resume-or-create the hidden assistant session. Does not attach 云之家
 * and does not seed a dummy turn (pitfall-025).
 */
export async function ensureAssistantAgent(ctx: Context, sessionId: string, assistantId: string): Promise<void> {
  const agents = agentsFace(ctx)
  if (agents === undefined) throw new Error('assistant-ask: agents 服务不可用')
  if (agents.get(sessionId) !== undefined) return
  const cwd = await ensureAssistantCwd(assistantId)
  const composition = await topicAgentComposition(ctx)
  const route = topicAgentRoute(ctx)
  try {
    await agents.resume({
      resumeSessionId: sessionId,
      ...(route === undefined ? {} : { agentOptions: route }),
      ...(composition.setup === undefined ? {} : { setup: composition.setup }),
    })
  } catch {
    await agents.create({
      sessionId,
      meta: {
        cwd,
        ...(composition.agentPreset === undefined ? {} : { agentPreset: composition.agentPreset }),
      },
      ...(route === undefined ? {} : { agentOptions: route }),
      ...(composition.setup === undefined ? {} : { setup: composition.setup }),
    })
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function eventsOf(ctx: Context, sessionId: string): readonly { type: string; data?: unknown }[] {
  return liveAgent(ctx, sessionId)?.session?.events ?? []
}

/**
 * Wait until a turn/end appears after `fromLength`, or timeout.
 * Hidden assistants have no GUI to watch; polling the log is the host face.
 */
async function waitTurnEnd(
  ctx: Context,
  sessionId: string,
  fromLength: number,
  timeoutMs: number,
): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const events = eventsOf(ctx, sessionId)
    const ended = events.slice(fromLength).some(event => event.type === 'turn/end')
    if (ended) return
    await sleep(250)
  }
}

function groupContext(input: {
  readonly groupId: string
  readonly msgId: string
  readonly groupName?: string
  readonly originWho?: string
  readonly originText?: string
  readonly window?: string
}): string {
  const lines = [
    `[IM local thread] Yunzhijia group ${input.groupName ?? input.groupId}.`,
    `Anchor msgId=${input.msgId}. Work hangs under that message; only this user sees it.`,
    'Use present for the local thread. Do not im message send unless the user asks to post to the group.',
  ]
  if (input.originWho !== undefined && input.originWho !== '') {
    lines.push(`Anchor from ${input.originWho}: ${input.originText ?? ''}`)
  }
  if (input.window !== undefined && input.window !== '') lines.push(input.window)
  return lines.join('\n')
}

/** One IM user turn: enqueue, followup, present-or-fallback, finish. */
export async function runAssistantTurn(
  ctx: Context,
  assistants: YzjAssistantsService,
  input: {
    readonly target: TurnTarget
    readonly text: string
    readonly groupName?: string
    readonly originWho?: string
    readonly originText?: string
    readonly window?: string
  },
): Promise<{ readonly sessionId: string }> {
  const assistant = assistants.store.get(input.target.assistantId)
    ?? await assistants.store.ensureDefault()
  const sessionId = assistant.sessionId
  const promptPrefix = assistant.prompt !== undefined && assistant.prompt !== ''
    ? `[Assistant notes]\n${assistant.prompt}\n\n`
    : ''
  const body = input.target.kind === 'thread'
    ? `${promptPrefix}${groupContext({
      groupId: input.target.groupId,
      msgId: input.target.msgId,
      ...(input.groupName === undefined ? {} : { groupName: input.groupName }),
      ...(input.originWho === undefined ? {} : { originWho: input.originWho }),
      ...(input.originText === undefined ? {} : { originText: input.originText }),
      ...(input.window === undefined ? {} : { window: input.window }),
    })}\n\nUser: ${input.text}`
    : `${promptPrefix}${input.text}`

  await assistants.enqueue(assistant.id, async () => {
    await ensureAssistantAgent(ctx, sessionId, assistant.id)
    await assistants.store.setTurn(sessionId, input.target)
    await assistants.store.appendUser(input.target, input.text)
    const before = eventsOf(ctx, sessionId).length
    const agent = liveAgent(ctx, sessionId)
    if (agent?.followup === undefined) {
      await assistants.store.present(sessionId, '助手还没准备好（隐藏 session 未能 followup）。')
      await assistants.store.finishTurn(sessionId)
      return
    }
    agent.followup(identifiedUserMessage(body, { kind: 'user' }))
    await waitTurnEnd(ctx, sessionId, before, 180_000)
    const fallback = lastAssistantText(eventsOf(ctx, sessionId) as { type: string; data: unknown }[])
    await assistants.store.fallbackPresent(sessionId, fallback)
    await assistants.store.finishTurn(sessionId)
  })
  return { sessionId }
}

/** Summaries of hidden-session events for 查看过程 (not the IM bubble stream). */
export function processDigest(
  events: readonly { type: string; data?: unknown; time?: unknown }[],
): readonly { readonly type: string; readonly time: number; readonly summary: string }[] {
  const out: { type: string; time: number; summary: string }[] = []
  for (const event of events) {
    const data = typeof event.data === 'object' && event.data !== null
      ? event.data as Record<string, unknown>
      : {}
    const stamped = event as { readonly time?: unknown }
    const time = typeof stamped.time === 'number' ? stamped.time : 0
    if (event.type === 'tool/call') {
      const name = typeof data.name === 'string' ? data.name : typeof data.toolName === 'string' ? data.toolName : 'tool'
      if (name === 'present') continue
      out.push({ type: event.type, time, summary: name })
      continue
    }
    if (event.type === 'assistant/thinking' || event.type === 'thinking') {
      const text = typeof data.text === 'string' ? data.text : typeof data.content === 'string' ? data.content : ''
      if (text.trim() !== '') out.push({ type: 'thinking', time, summary: text.trim().slice(0, 240) })
      continue
    }
    if (event.type === 'tool/result') {
      const name = typeof data.name === 'string' ? data.name : ''
      if (name === 'present') continue
      out.push({ type: event.type, time, summary: name === '' ? 'result' : `${name} 完成` })
    }
  }
  return out.slice(-80)
}
