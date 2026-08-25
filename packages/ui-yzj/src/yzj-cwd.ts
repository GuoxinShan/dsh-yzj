/**
 * Dedicated cwd for yzj-home-* / yzj-topic-* (docs/spec/group-room-topics.md
 * R20 v1.4). Both kinds share `~/.dsh-yzj/workspace` so they never inherit
 * `process.cwd()`. Only topic sessions attach to Host Workspace 「云之家」;
 * room hosts stay off that official sidebar group.
 * @module @dsh-yzj/ui-yzj/yzj-cwd
 */

import { mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** One workspace record: membership list plus attach/detach (no dsh-workspace import). */
interface WorkspaceMember {
  readonly sessionIds?: readonly string[]
  attachSession(sessionId: string): Promise<void>
  detachSession?(sessionId: string): Promise<void>
}

/** Structural workspace registry (do not import dsh-workspace — dual-face tsconfig). */
interface WorkspaceFace {
  create(path: string, title?: string): Promise<WorkspaceMember>
  resolveByPath(path: string): Promise<WorkspaceMember | undefined>
}

/** Cordis-like getter used by the node half. */
interface CwdContext {
  get(name: string): unknown
}

/** Canonical directory: `~/.dsh-yzj/workspace`. */
export function yzjWorkspacePath(): string {
  return join(homedir(), '.dsh-yzj', 'workspace')
}

/** Create the directory if missing; return the path even when mkdir is denied. */
export async function ensureYzjWorkspaceDir(): Promise<string> {
  const path = yzjWorkspacePath()
  try {
    await mkdir(path, { recursive: true })
  } catch {
    // Sandbox / permissions: callers still get the dedicated path.
  }
  return path
}

/**
 * Ensure the directory exists and register (or reuse) the 云之家 workspace.
 * Registry is optional — missing service still yields the dedicated cwd.
 * After create, leftover room hosts from v1.1 attach are detached (R20 v1.4).
 */
export async function ensureYzjHostWorkspace(ctx: CwdContext): Promise<string> {
  const path = await ensureYzjWorkspaceDir()
  const registry = ctx.get('workspaceRegistry') as WorkspaceFace | undefined
  if (registry === undefined) return path
  try {
    await registry.create(path, '云之家')
  } catch {
    // Path race or registry not ready: sessions still use the dedicated cwd.
  }
  await detachYzjRoomHosts(ctx)
  return path
}

/** Topic / agent sessions grown from a group or DM. Room hosts are not this. */
export function isYzjTopicSessionId(sessionId: string): boolean {
  return sessionId.startsWith('yzj-topic-')
}

/** Group/DM room hosts. These must not sit in the official 云之家 group. */
export function isYzjRoomSessionId(sessionId: string): boolean {
  return sessionId.startsWith('yzj-home-')
}

/**
 * Drop leftover `yzj-home-*` membership from 云之家. Does not archive,
 * delete, or touch topic sessions. Idempotent; swallows registry faults.
 */
export async function detachYzjRoomHosts(ctx: CwdContext): Promise<void> {
  const registry = ctx.get('workspaceRegistry') as WorkspaceFace | undefined
  if (registry === undefined) return
  const path = yzjWorkspacePath()
  try {
    const workspace = await registry.resolveByPath(path)
    if (workspace?.detachSession === undefined) return
    for (const sessionId of workspace.sessionIds ?? []) {
      if (!isYzjRoomSessionId(String(sessionId))) continue
      await workspace.detachSession(sessionId)
    }
  } catch {
    // Registry not ready or detach rejected: next ensure retries.
  }
}

/**
 * Attach one topic session to 云之家. Room hosts (`yzj-home-*`) and any
 * other id are skipped — they must not appear in that official sidebar
 * group (R20 v1.4). Swallows header cwd mismatch so open never fails closed.
 */
export async function attachYzjSession(ctx: CwdContext, sessionId: string): Promise<void> {
  if (!isYzjTopicSessionId(sessionId)) return
  const registry = ctx.get('workspaceRegistry') as WorkspaceFace | undefined
  if (registry === undefined) return
  const path = yzjWorkspacePath()
  try {
    const workspace = (await registry.resolveByPath(path)) ?? await registry.create(path, '云之家')
    await workspace.attachSession(sessionId as never)
  } catch {
    // Header cwd mismatch or unknown id: leave ungrouped.
  }
}
