/**
 * `robot_fork` / `!fork` retarget: open or resume the bound DSH home for a
 * Yunzhijia conversation. Must never `agents.create` a `fork-*` parallel root
 * (docs/spec/dsh-home-session.md D10). Digest handoff is optional and lives
 * on the inbound `!fork` path; this helper only changes the session target.
 * @module @dsh-yzj/robot-yzj/home-target
 */

import type { RouterHomeFace } from './router.ts'

/** Surfaces the robot has seen (groupId + last anchored session). */
export interface HomeTargetSurface {
  readonly groupId: string
  readonly lastSessionId?: string
}

/** Minimal agents face (resume-then-create; pitfall-006). */
export interface HomeTargetAgents {
  get(sessionId: string): unknown
  resume(options: { resumeSessionId: string }): Promise<unknown>
  create(options: { sessionId: string; meta?: { cwd: string } }): Promise<unknown>
}

/** Result of opening/resuming a bound home. `createdAgent` is first live agent, not a new root id. */
export interface HomeTargetResult {
  readonly ok: boolean
  readonly sessionId?: string
  readonly error?: string
  readonly createdAgent?: boolean
}

/**
 * Resolve the Yunzhijia conversation for a source session, then ensure its
 * bound home and resume-or-create **that** session id.
 */
export async function openOrResumeBoundHome(options: {
  readonly sourceSessionId: string
  readonly home: RouterHomeFace
  readonly surfaces: readonly HomeTargetSurface[]
  readonly agents: HomeTargetAgents
  readonly cwd: string
}): Promise<HomeTargetResult> {
  let conversationId = options.home.getBySession(options.sourceSessionId)?.yzjConversationId
  if (conversationId === undefined) {
    for (const surface of options.surfaces) {
      if (surface.lastSessionId === options.sourceSessionId) {
        conversationId = surface.groupId
        break
      }
    }
  }
  if (conversationId === undefined) {
    return {
      ok: false,
      error: `会话 ${options.sourceSessionId} 没有绑定的云之家会话，无法打开家园（禁止 fork 新根）`,
    }
  }
  const kind = conversationId.startsWith('BOT-') ? 'dm' : 'group'
  const bound = await options.home.ensureBound(conversationId, kind)
  const sessionId = bound.sessionId
  if (options.agents.get(sessionId) !== undefined) {
    return { ok: true, sessionId, createdAgent: false }
  }
  try {
    await options.agents.resume({ resumeSessionId: sessionId })
    return { ok: true, sessionId, createdAgent: false }
  } catch {
    try {
      await options.agents.create({ sessionId, meta: { cwd: options.cwd } })
      return { ok: true, sessionId, createdAgent: true }
    } catch (error) {
      return { ok: false, error: `打开绑定会话失败：${String(error)}` }
    }
  }
}
