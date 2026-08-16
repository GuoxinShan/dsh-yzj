import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { maybeAutoStartOps, opsPidPath, opsWrapperPath, pidAlive, readOpsPid } from '../src/ops-autostart.ts'

const bases: string[] = []
function tmpHome(): string {
  const base = mkdtempSync(join(tmpdir(), 'ops-autostart-'))
  bases.push(base)
  return base
}
afterEach(() => {
  for (const base of bases.splice(0)) rmSync(base, { recursive: true, force: true })
})

/** A fake spawner recording invocations. */
function fakeSpawner(recorder: { calls: [string, string][] }) {
  return (wrapperPath: string, cwd: string) => {
    recorder.calls.push([wrapperPath, cwd])
    return { unref: () => {}, on: () => {} }
  }
}

describe('ops pid helpers', () => {
  it('reads a valid pid and probes liveness', () => {
    const home = tmpHome()
    const path = opsPidPath(home)
    expect(readOpsPid(path)).toBeUndefined()
    writeFileSync(path, String(process.pid), 'utf8')
    expect(readOpsPid(path)).toBe(process.pid)
    expect(pidAlive(process.pid)).toBe(true)
    expect(pidAlive(99_999_999)).toBe(false)
  })

  it('ignores malformed pid files', () => {
    const home = tmpHome()
    writeFileSync(opsPidPath(home), 'not-a-pid', 'utf8')
    expect(readOpsPid(opsPidPath(home))).toBeUndefined()
  })
})

describe('maybeAutoStartOps', () => {
  it('skips when a live pid is recorded (idempotence)', () => {
    const home = tmpHome()
    writeFileSync(opsPidPath(home), String(process.pid), 'utf8')
    writeFileSync(opsWrapperPath(home), '// wrapper', 'utf8')
    const recorder = { calls: [] as [string, string][] }
    const info = vi.fn()
    maybeAutoStartOps({ home, opsCwd: 'D:/harness', spawner: fakeSpawner(recorder), logger: { info, warn: vi.fn() } })
    expect(recorder.calls).toEqual([])
    expect(info).toHaveBeenCalledWith(expect.stringContaining('already running'))
  })

  it('spawns through the wrapper when the pid is stale or absent', () => {
    const home = tmpHome()
    writeFileSync(opsPidPath(home), '99999999', 'utf8') // stale pid
    writeFileSync(opsWrapperPath(home), '// wrapper', 'utf8')
    const recorder = { calls: [] as [string, string][] }
    maybeAutoStartOps({ home, opsCwd: 'D:/harness', spawner: fakeSpawner(recorder), logger: { info: vi.fn(), warn: vi.fn() } })
    expect(recorder.calls).toEqual([[opsWrapperPath(home), 'D:/harness']])
    recorder.calls.length = 0
    rmSync(opsPidPath(home), { force: true })
    maybeAutoStartOps({ home, opsCwd: 'D:/harness', spawner: fakeSpawner(recorder), logger: { info: vi.fn(), warn: vi.fn() } })
    expect(recorder.calls).toHaveLength(1)
  })

  it('refuses to spawn when the wrapper is missing', () => {
    const home = tmpHome()
    const recorder = { calls: [] as [string, string][] }
    const warn = vi.fn()
    maybeAutoStartOps({ home, opsCwd: 'D:/harness', spawner: fakeSpawner(recorder), logger: { info: vi.fn(), warn } })
    expect(recorder.calls).toEqual([])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('wrapper missing'))
  })
})
