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
}

/** Resume-then-create face (ctx.agents). */
export interface HomeOpenAgents {
  get(sessionId: string): unknown
  resume(options: { resumeSessionId: string }): Promise<unknown>
  create(options: { sessionId: string; meta?: { cwd: string } }): Promise<unknown>
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
}): Promise<HomeOpenValue> {
  const yzjKind = options.yzjConversationId.startsWith('BOT-') ? 'dm' : 'group'
  const bound = await options.home.ensureBound(options.yzjConversationId, yzjKind)
  if (options.agents.get(bound.sessionId) !== undefined) {
    return { sessionId: bound.sessionId, created: bound.created, yzjKind: bound.yzjKind, agentCreated: false }
  }
  try {
    await options.agents.resume({ resumeSessionId: bound.sessionId })
    return { sessionId: bound.sessionId, created: bound.created, yzjKind: bound.yzjKind, agentCreated: false }
  } catch {
    await options.agents.create({ sessionId: bound.sessionId, meta: { cwd: options.cwd } })
    return { sessionId: bound.sessionId, created: bound.created, yzjKind: bound.yzjKind, agentCreated: true }
  }
}
