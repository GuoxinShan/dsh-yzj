/**
 * Ops-daemon autostart: `dsh web` brings the dsh-routines scheduler up with
 * it. The web profile cannot host the scheduler (no job controller; see
 * docs/spec/routines-delivery.md §5.1), so robot-yzj spawns the base-only
 * ops daemon as a detached child through a small wrapper (`ops-wrapper.mjs`)
 * that records the daemon pid in `<home>/ops.pid`. Every launch path —
 * robot-yzj autostart, ops-daemon.cmd, start-all.cmd — goes through the same
 * pid-file idempotence: a live pid means the daemon is already up, and no
 * launch double-starts it.
 * @module @dsh-yzj/robot-yzj/ops-autostart
 */

import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

/** Default ops pid-file location under a DSH home. */
export function opsPidPath(home: string): string {
  return join(home, 'ops.pid')
}

/** Default ops wrapper location (spawned through `node <wrapper>`). */
export function opsWrapperPath(home: string): string {
  return join(home, 'ops-wrapper.mjs')
}

/** Read a pid from the ops pid file; undefined when absent or malformed. */
export function readOpsPid(pidPath: string): number | undefined {
  try {
    const raw = readFileSync(pidPath, 'utf8').trim()
    const pid = Number(raw)
    return Number.isInteger(pid) && pid > 0 ? pid : undefined
  } catch {
    return undefined
  }
}

/** Whether a pid names a live process (signal 0 probe). */
export function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** A minimal logger face. */
export interface OpsAutostartLogger {
  info(message: string): void
  warn(message: string): void
}

/** Options for {@link maybeAutoStartOps}. */
export interface OpsAutostartOptions {
  /** DSH home; the pid file and the wrapper live here. */
  readonly home: string
  /** Working directory for the spawned wrapper (the harness checkout). */
  readonly opsCwd: string
  /** Test seams: custom pid probe and spawner. */
  readonly isAlive?: (pid: number) => boolean
  readonly spawner?: (wrapperPath: string, cwd: string) => { unref(): void; on(event: 'error', listener: (err: Error) => void): void }
  readonly logger?: OpsAutostartLogger
}

/**
 * Bring the ops daemon up unless it is already running (pid file + liveness
 * probe) or the wrapper is missing. Fire-and-forget: the spawn is detached
 * and unref'd, so the daemon outlives the web process and the web boot never
 * blocks on it. Never throws.
 */
export function maybeAutoStartOps(options: OpsAutostartOptions): void {
  const { home, opsCwd, logger } = options
  const isAlive = options.isAlive ?? pidAlive
  const pidPath = opsPidPath(home)
  const wrapperPath = opsWrapperPath(home)
  const pid = readOpsPid(pidPath)
  if (pid !== undefined && isAlive(pid)) {
    logger?.info(`robot: ops daemon already running (pid ${pid}); autostart skipped`)
    return
  }
  if (!existsSync(wrapperPath)) {
    logger?.warn(`robot: autoStartOps enabled but wrapper missing at ${wrapperPath} — run scripts/setup-ops.mjs`)
    return
  }
  const spawner = options.spawner ?? ((path, cwd) => {
    const child = spawn(process.execPath, [path], { cwd, detached: true, stdio: 'ignore' })
    child.unref()
    return child
  })
  try {
    const child = spawner(wrapperPath, opsCwd)
    child.on('error', (error) => {
      logger?.warn(`robot: ops daemon spawn failed: ${String(error)}`)
    })
    logger?.info(`robot: ops daemon autostarted via ${wrapperPath}`)
  } catch (error) {
    logger?.warn(`robot: ops daemon autostart failed: ${String(error)}`)
  }
}

/** Convenience: the default DSH home (DSH_HOME or ~/.dsh). */
export function dshHomeOf(): string {
  const env = process.env.DSH_HOME
  return env !== undefined && env.trim() !== '' ? env.trim() : join(homedir(), '.dsh')
}
