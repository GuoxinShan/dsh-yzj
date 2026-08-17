/**
 * Node-half home-open: bind one Yunzhijia conversation to exactly one DSH
 * session, then resume-or-create that agent (pitfall-006). Structural agents
 * face — this package must not import dsh-session (client/host one tsconfig).
 * @module @dsh-yzj/ui-yzj/home-open
 */

/** Binding table face (ctx.yzjHome). */
export interface HomeOpenFace {
  ensureBound(yzjConversationId: string, yzjKind: 'group' | 'dm'): Promise<{
    sessionId: string
    created: boolean
    yzjKind: 'group' | 'dm'
  }>
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
}

/** Live agent after create/resume (structural — no dsh-session import). */
export interface HomeOpenAgent {
  session?: {
    events?: readonly { type: string; data?: unknown }[]
    append?: (type: string, data: unknown) => unknown
  }
}

/** Resume-then-create face (ctx.agents). */
export interface HomeOpenAgents {
  get(sessionId: string): HomeOpenAgent | undefined
  resume(options: { resumeSessionId: string }): Promise<unknown>
  create(options: { sessionId: string; meta?: { cwd: string } }): Promise<unknown>
}

/**
 * Harness hides sessions with no `turn/start` as blank New Session rows
 * (list-hidden, reusable). Group-room hosts never run a model turn (①② stay
 * in the plugin log), so we close an empty turn and pin `session/title` —
 * no LLM, no IM.
 * @param replace - write even when a title already exists (topic retitle to 「群名 · 话题」).
 */
export function publishHostSession(agent: unknown, title: string, replace = false): void {
  const session = sessionOf(agent)
  if (session?.append === undefined) return
  const events = session.events ?? []
  if (!events.some(event => event.type === 'turn/start')) {
    session.append('turn/start', { turn: 1 })
    session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
  }
  const trimmed = title.trim().slice(0, 80)
  if (trimmed === '') return
  const current = lastSessionTitle(events)
  if (current === trimmed) return
  const upgrading = isPlaceholderRoomTitle(current) && !isPlaceholderRoomTitle(trimmed)
  if (current !== '' && !replace && !upgrading) return
  session.append('session/title', { title: trimmed, messageSeqs: [], source: { kind: 'user' } })
}

/** Sidebar label for a topic: group name first, so a flat list is still scannable (R12). */
export function topicSidebarTitle(groupName: string, topicTitle: string): string {
  const topic = topicTitle.trim() || '话题'
  const group = groupName.trim()
  if (group === '' || topic === group || topic.startsWith(`${group} · `)) return topic.slice(0, 80)
  return `${group} · ${topic}`.slice(0, 80)
}

/** Last `session/title` in a host event log (sidebar / workbench labels). */
export function lastSessionTitle(events: readonly { type: string; data?: unknown }[]): string {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event?.type !== 'session/title') continue
    const data = event.data
    if (typeof data === 'object' && data !== null) {
      const title = (data as { title?: unknown }).title
      if (typeof title === 'string') return title.trim()
    }
  }
  return ''
}

/** Fallback titles used when home-open had no CLI group name. */
export function isPlaceholderRoomTitle(title: string): boolean {
  return title === '群房间' || title === '私聊房间'
}

function sessionOf(agent: unknown): HomeOpenAgent['session'] {
  if (typeof agent !== 'object' || agent === null) return undefined
  const rec = agent as Record<string, unknown>
  const inner = rec.agent
  const live = (typeof inner === 'object' && inner !== null ? inner : rec) as HomeOpenAgent
  return live.session
}

/** RPC value: binding created vs focus; agentCreated is first live agent. */
export interface HomeOpenValue {
  readonly sessionId: string
  readonly created: boolean
  readonly yzjKind: 'group' | 'dm'
  readonly agentCreated: boolean
}

/**
 * Ensure the 1:1 binding and bring the bound agent up. Second open is focus
 * (`created: false`) and must not mint a parallel session id.
 */
export async function openBoundHome(options: {
  readonly home: HomeOpenFace
  readonly agents: HomeOpenAgents
  readonly yzjConversationId: string
  readonly cwd: string
  readonly title?: string
}): Promise<HomeOpenValue> {
  const yzjKind = options.yzjConversationId.startsWith('BOT-') ? 'dm' : 'group'
  const bound = await options.home.ensureBound(options.yzjConversationId, yzjKind)
  const title = options.title?.trim() || (yzjKind === 'dm' ? '私聊房间' : '群房间')
  if (options.agents.get(bound.sessionId) !== undefined) {
    publishHostSession(options.agents.get(bound.sessionId), title)
    return { sessionId: bound.sessionId, created: bound.created, yzjKind: bound.yzjKind, agentCreated: false }
  }
  try {
    const resumed = await options.agents.resume({ resumeSessionId: bound.sessionId })
    publishHostSession(resumed ?? options.agents.get(bound.sessionId), title)
    return { sessionId: bound.sessionId, created: bound.created, yzjKind: bound.yzjKind, agentCreated: false }
  } catch {
    const created = await options.agents.create({ sessionId: bound.sessionId, meta: { cwd: options.cwd } })
    publishHostSession(created ?? options.agents.get(bound.sessionId), title)
    return { sessionId: bound.sessionId, created: bound.created, yzjKind: bound.yzjKind, agentCreated: true }
  }
}

/**
 * Mint or focus a topic session under a group room, then resume-or-create
 * that agent (pitfall-006). Same root is focus, never a parallel id.
 */
export async function openTopicHome(options: {
  readonly home: HomeOpenFace
  readonly agents: HomeOpenAgents
  readonly yzjConversationId: string
  readonly cwd: string
  readonly source: 'dsh' | 'yzj' | 'handoff'
  readonly rootMsgId?: string
  readonly originWho?: string
  readonly originText?: string
  readonly title?: string
  /** Group display name for the sidebar prefix (R12). */
  readonly groupName?: string
}): Promise<HomeOpenValue & { readonly topicCreated: boolean }> {
  if (options.home.ensureTopic === undefined) {
    const room = await openBoundHome(options)
    return { ...room, topicCreated: false }
  }
  const yzjKind = options.yzjConversationId.startsWith('BOT-') ? 'dm' : 'group'
  const bound = await options.home.ensureBound(options.yzjConversationId, yzjKind)
  const topic = await options.home.ensureTopic({
    yzjConversationId: options.yzjConversationId,
    source: options.source,
    ...(options.rootMsgId === undefined ? {} : { rootMsgId: options.rootMsgId }),
    ...(options.originWho === undefined ? {} : { originWho: options.originWho }),
    ...(options.originText === undefined ? {} : { originText: options.originText }),
    ...(options.title === undefined ? {} : { title: options.title }),
  })
  const groupName = options.groupName?.trim()
    || lastSessionTitle(sessionOf(options.agents.get(bound.sessionId))?.events ?? [])
  const topicPart = options.title?.trim() || options.originText?.trim().slice(0, 40) || '话题'
  const title = topicSidebarTitle(groupName, topicPart)
  const publish = (agent: unknown): void => { publishHostSession(agent, title, true) }
  if (options.agents.get(topic.sessionId) !== undefined) {
    publish(options.agents.get(topic.sessionId))
    return {
      sessionId: topic.sessionId,
      created: topic.created,
      yzjKind,
      agentCreated: false,
      topicCreated: topic.created,
    }
  }
  try {
    const resumed = await options.agents.resume({ resumeSessionId: topic.sessionId })
    publish(resumed ?? options.agents.get(topic.sessionId))
    return {
      sessionId: topic.sessionId,
      created: topic.created,
      yzjKind,
      agentCreated: false,
      topicCreated: topic.created,
    }
  } catch {
    const created = await options.agents.create({ sessionId: topic.sessionId, meta: { cwd: options.cwd } })
    publish(created ?? options.agents.get(topic.sessionId))
    return {
      sessionId: topic.sessionId,
      created: topic.created,
      yzjKind,
      agentCreated: true,
      topicCreated: topic.created,
    }
  }
}
