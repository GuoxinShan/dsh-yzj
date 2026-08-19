/**
 * Node-half home-open: bind one Yunzhijia conversation to exactly one DSH
 * session, then resume-or-create that agent (pitfall-006). Structural agents
 * face — this package must not import dsh-session (client/host one tsconfig).
 * @module @dsh-yzj/ui-yzj/home-open
 */

import { LEGACY_HOST_ROOT, LEGACY_HOST_TITLE } from '@dsh-yzj/tool-yzj/src/topics.ts'
import { composeHandoffDigest, digestCandidates } from './handoff-digest.ts'

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
    readonly quiet?: boolean
    readonly lastActivity?: number
  }): Promise<{ sessionId: string; created: boolean }>
}

/** Live agent after create/resume (structural — no dsh-session import). */
export interface HomeOpenAgent {
  session?: {
    events?: readonly { type: string; time?: number; data?: unknown }[]
    append?: (type: string, data: unknown) => unknown
  }
  inject?: (message: unknown) => void
  followup?: (message: unknown) => void
}

/** Provider + model for a programmatic topic agent (persona `{{model}}`). */
export interface TopicAgentRoute {
  readonly provider: string
  readonly model: string
}

/** Creation-time preset mount (same seam as GUI 新建会话). */
export type TopicAgentSetup = (agentCtx: unknown) => void | Promise<void>

/** Resume-then-create face (ctx.agents). */
export interface HomeOpenAgents {
  get(sessionId: string): HomeOpenAgent | undefined
  resume(options: {
    resumeSessionId: string
    agentOptions?: TopicAgentRoute
    setup?: TopicAgentSetup
  }): Promise<unknown>
  create(options: {
    sessionId: string
    meta?: { cwd: string; agentPreset?: string }
    agentOptions?: TopicAgentRoute
    setup?: TopicAgentSetup
  }): Promise<unknown>
}

/** Host `ctx.agentPresets` (structural — do not import dsh-agent-presets). */
interface AgentPresetsFace {
  readonly defaultId?: string
  resolve(id?: string): Promise<{ id: string }>
  mount(agentCtx: unknown, id: string): Promise<unknown>
}

/**
 * Default preset + setup for a programmatic topic/robot agent.
 * Out of the box this is `standard` (bash / files / jobs) so yzj host
 * tools sit on top — we do not ship a Yunzhijia preset (R28 / pitfall-030).
 */
export async function topicAgentComposition(ctx: { get(name: string): unknown }): Promise<{
  readonly agentPreset?: string
  readonly setup?: TopicAgentSetup
}> {
  const presets = ctx.get('agentPresets') as AgentPresetsFace | undefined
  if (presets === undefined) return {}
  try {
    const id = (await presets.resolve(presets.defaultId)).id
    if (id === '') return {}
    return {
      agentPreset: id,
      setup: async (agentCtx) => { await presets.mount(agentCtx, id) },
    }
  } catch {
    return {}
  }
}

/**
 * Route for a host-created topic agent. Web GUI sessions get `{{model}}` from
 * apiproxy's picker; `ctx.agents.create` from this plugin does not. Prefer the
 * plugin default, then the harness default-model service (pitfall-006 / 026).
 */
export function topicAgentRoute(ctx: { get(name: string): unknown }): TopicAgentRoute | undefined {
  const yzj = ctx.get('yzjModels') as { get?: () => { provider?: string; model?: string } | undefined } | undefined
  const fromYzj = yzj?.get?.()
  if (fromYzj !== undefined && fromYzj.provider !== undefined && fromYzj.provider !== ''
    && fromYzj.model !== undefined && fromYzj.model !== '') {
    return { provider: fromYzj.provider, model: fromYzj.model }
  }
  const def = ctx.get('agentDefaultModel') as { currentSelection?: () => { provider?: string; model?: string } } | undefined
  const sel = def?.currentSelection?.()
  if (sel !== undefined && sel.provider !== undefined && sel.provider !== ''
    && sel.model !== undefined && sel.model !== '') {
    return { provider: sel.provider, model: sel.model }
  }
  return undefined
}

/** Identified user-role payload. Session replay requires `message.id` (pitfall-026). */
export function identifiedUserMessage(
  text: string,
  source: { kind: 'user' } | { kind: 'plugin'; plugin: string },
): {
  id: string
  role: 'user'
  content: { type: 'text'; text: string }[]
  source: { kind: 'user' } | { kind: 'plugin'; plugin: string }
} {
  return {
    id: crypto.randomUUID(),
    role: 'user',
    content: [{ type: 'text', text }],
    source,
  }
}

/**
 * Pin a host title. Rooms seed a closed empty turn 1 so harness treats them
 * as a real conversation canvas (`conversation.view` / tab ring). Blank
 * 「新会话」rows vanish when not current — but they also have no tab ring,
 * so the IM workbench cannot mount (R14). Topics must not seed that turn
 * (pitfall-025 / R25).
 * @param replace - write even when a title already exists (topic retitle).
 * @param seedEmptyTurn - write the closed empty turn 1. Rooms yes; topics no.
 */
export function publishHostSession(agent: unknown, title: string, replace = false, seedEmptyTurn = true): void {
  const session = sessionOf(agent)
  if (session?.append === undefined) return
  const events = session.events ?? []
  if (seedEmptyTurn && !events.some(event => event.type === 'turn/start')) {
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

/**
 * Sidebar label for a topic: topic title first, group as suffix. The former
 * group-first order truncated to identical 「群名·【…」 rows in the narrow
 * sidebar — the distinguishing part must lead (R12 修订, gap-analysis).
 */
export function topicSidebarTitle(groupName: string, topicTitle: string): string {
  const topic = topicTitle.trim() || '话题'
  const group = groupName.trim()
  if (group === '' || topic === group) return topic.slice(0, 80)
  if (topic.startsWith(`${group} · `) || topic.endsWith(` · ${group}`)) return topic.slice(0, 80)
  return `${topic} · ${group}`.slice(0, 80)
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
  /** H9: minted-or-focused 「历史对话」 topic, when the host had real ③④. */
  readonly legacyTopicSessionId?: string
}

/** True when the host log has real assistant work, not just R14 empty turns. */
export function hostHasLegacyTurns(
  events: readonly { type: string }[],
): boolean {
  return events.some(event => (
    event.type === 'user/message'
    || event.type === 'assistant/message'
    || event.type === 'tool/call'
  ))
}

function pluginContextTurn(text: string): ReturnType<typeof identifiedUserMessage> {
  return identifiedUserMessage(text, { kind: 'plugin', plugin: 'ui-yzj' })
}

/**
 * Mint-or-focus the H9 「历史对话」 topic. Does not copy Session events;
 * the lens reads `fromSessionId`. Injects a plugin digest so the model can
 * continue. No-op for DMs, blank hosts, or a home face without topics.
 */
async function maybeMigrateLegacyHost(options: {
  readonly home: HomeOpenFace
  readonly agents: HomeOpenAgents
  readonly yzjConversationId: string
  readonly cwd: string
  readonly yzjKind: 'group' | 'dm'
  readonly hostSessionId: string
  readonly groupName: string
  readonly agentOptions?: TopicAgentRoute
  readonly agentPreset?: string
  readonly setup?: TopicAgentSetup
}): Promise<string | undefined> {
  if (options.yzjKind === 'dm' || options.home.ensureTopic === undefined) return undefined
  const events = sessionOf(options.agents.get(options.hostSessionId))?.events ?? []
  if (!hostHasLegacyTurns(events)) return undefined
  let lastActivity = 0
  for (const event of events) {
    const time = event.time ?? 0
    if (time > lastActivity) lastActivity = time
  }
  const opened = await openTopicHome({
    home: options.home,
    agents: options.agents,
    yzjConversationId: options.yzjConversationId,
    cwd: options.cwd,
    source: 'handoff',
    rootMsgId: LEGACY_HOST_ROOT,
    title: LEGACY_HOST_TITLE,
    fromSessionId: options.hostSessionId,
    groupName: options.groupName,
    quiet: true,
    lastActivity: lastActivity > 0 ? lastActivity : 1,
    ...(options.agentOptions === undefined ? {} : { agentOptions: options.agentOptions }),
    ...(options.agentPreset === undefined ? {} : { agentPreset: options.agentPreset }),
    ...(options.setup === undefined ? {} : { setup: options.setup }),
  })
  if (opened.topicCreated) {
    const digest = composeHandoffDigest(
      digestCandidates(events.map(event => ({
        type: event.type,
        time: event.time ?? 0,
        data: event.data ?? {},
      }))),
      [],
      true,
    )
    if (digest !== '') {
      options.agents.get(opened.sessionId)?.inject?.(
        pluginContextTurn(`以下是本群房间升级前的助手对话，请接续。\n${digest}`),
      )
    }
  }
  return opened.sessionId
}

/**
 * Ensure the 1:1 binding only (R27). Does not resume/create/publish a
 * `yzj-home-*` agent — that would land a group row in 未分组. Leftover
 * hosts already in memory still run H9 「历史对话」 migration.
 */
export async function openBoundHome(options: {
  readonly home: HomeOpenFace
  readonly agents: HomeOpenAgents
  readonly yzjConversationId: string
  readonly cwd: string
  readonly title?: string
  readonly agentOptions?: TopicAgentRoute
  readonly agentPreset?: string
  readonly setup?: TopicAgentSetup
}): Promise<HomeOpenValue> {
  const yzjKind = options.yzjConversationId.startsWith('BOT-') ? 'dm' : 'group'
  const bound = await options.home.ensureBound(options.yzjConversationId, yzjKind)
  const title = options.title?.trim() || (yzjKind === 'dm' ? '私聊房间' : '群房间')
  const existing = options.agents.get(bound.sessionId)
  const legacyTopicSessionId = existing === undefined
    ? undefined
    : await maybeMigrateLegacyHost({
      home: options.home,
      agents: options.agents,
      yzjConversationId: options.yzjConversationId,
      cwd: options.cwd,
      yzjKind,
      hostSessionId: bound.sessionId,
      groupName: title,
      ...(options.agentOptions === undefined ? {} : { agentOptions: options.agentOptions }),
      ...(options.agentPreset === undefined ? {} : { agentPreset: options.agentPreset }),
      ...(options.setup === undefined ? {} : { setup: options.setup }),
    })
  return {
    sessionId: bound.sessionId,
    created: bound.created,
    yzjKind: bound.yzjKind,
    agentCreated: false,
    ...(legacyTopicSessionId === undefined ? {} : { legacyTopicSessionId }),
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
  /** Handoff / H9: the session whose ③④ the lens still reads. */
  readonly fromSessionId?: string
  /** H9: do not bump `lastActivity` on an existing root. */
  readonly quiet?: boolean
  /** H9: stamp create-time activity from the host log, not "now". */
  readonly lastActivity?: number
  /** Required for a first model turn — persona interpolates `{{model}}`. */
  readonly agentOptions?: TopicAgentRoute
  /** Default agent preset id (R28). */
  readonly agentPreset?: string
  /** Mount that preset under the new/resumed scope (pitfall-030). */
  readonly setup?: TopicAgentSetup
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
    ...(options.fromSessionId === undefined ? {} : { fromSessionId: options.fromSessionId }),
    ...(options.quiet === true ? { quiet: true } : {}),
    ...(options.lastActivity === undefined ? {} : { lastActivity: options.lastActivity }),
  })
  const groupName = options.groupName?.trim()
    || lastSessionTitle(sessionOf(options.agents.get(bound.sessionId))?.events ?? [])
  const topicPart = options.title?.trim() || options.originText?.trim().slice(0, 40) || '话题'
  const title = topicSidebarTitle(groupName, topicPart)
  const publish = (agent: unknown): void => { publishHostSession(agent, title, true, false) }
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
    const resumed = await options.agents.resume({
      resumeSessionId: topic.sessionId,
      ...(options.agentOptions === undefined ? {} : { agentOptions: options.agentOptions }),
      ...(options.setup === undefined ? {} : { setup: options.setup }),
    })
    publish(resumed ?? options.agents.get(topic.sessionId))
    return {
      sessionId: topic.sessionId,
      created: topic.created,
      yzjKind,
      agentCreated: false,
      topicCreated: topic.created,
    }
  } catch {
    const created = await options.agents.create({
      sessionId: topic.sessionId,
      meta: {
        cwd: options.cwd,
        ...(options.agentPreset === undefined ? {} : { agentPreset: options.agentPreset }),
      },
      ...(options.agentOptions === undefined ? {} : { agentOptions: options.agentOptions }),
      ...(options.setup === undefined ? {} : { setup: options.setup }),
    })
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
