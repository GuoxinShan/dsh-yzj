/**
 * Dedicated cwd for yzj-home-* / yzj-topic-* so they land in a Host
 * Workspace titled 云之家 (docs/spec/group-room-topics.md R20).
 * Path is an implementation decision; recorded in gap-analysis §23 H16.
 * @module @dsh-yzj/ui-yzj/yzj-cwd
 */

import { mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Structural workspace registry (do not import dsh-workspace — dual-face tsconfig). */
interface WorkspaceFace {
  create(path: string, title?: string): Promise<{ attachSession(sessionId: string): Promise<void> }>
  resolveByPath(path: string): Promise<{ attachSession(sessionId: string): Promise<void> } | undefined>
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
  return path
}

/**
 * Attach one session to 云之家. Swallows mismatch (legacy process.cwd()
 * headers) so open never fails closed.
 */
export async function attachYzjSession(ctx: CwdContext, sessionId: string): Promise<void> {
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
