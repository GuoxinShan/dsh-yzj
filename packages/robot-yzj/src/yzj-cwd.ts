/**
 * Dedicated cwd for robot-minted yzj sessions (docs/spec/group-room-topics.md R20).
 * Same path as ui-yzj (`~/.dsh-yzj/workspace`); duplicated so robot-yzj does
 * not import the UI package.
 * @module @dsh-yzj/robot-yzj/yzj-cwd
 */

import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Canonical directory: `~/.dsh-yzj/workspace`. */
export function yzjWorkspacePath(): string {
  return join(homedir(), '.dsh-yzj', 'workspace')
}

/** Create the directory if missing; return the path. Sync for channel start. */
export function ensureYzjWorkspaceDirSync(): string {
  const path = yzjWorkspacePath()
  try {
    mkdirSync(path, { recursive: true })
  } catch {
    // Sandbox / permissions: still return the dedicated path.
  }
  return path
}
