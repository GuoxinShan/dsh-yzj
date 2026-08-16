import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { listShareFiles, readShareFile, writeShareFile } from '../src/index.ts'

const bases: string[] = []
function tmpBase(): string {
  const base = mkdtempSync(join(tmpdir(), 'robot-share-'))
  bases.push(base)
  return base
}

afterEach(() => {
  for (const base of bases.splice(0)) rmSync(base, { recursive: true, force: true })
})

describe('writeShareFile / listShareFiles (design §8.4)', () => {
  it('writes a new file with the exact name', () => {
    const dir = tmpBase()
    const result = writeShareFile(dir, 'report.md', 'hello', false)
    expect(result.ok).toBe(true)
    expect(result.name).toBe('report.md')
    expect(result.existed).toBe(false)
    expect(result.path).toBe(join(dir, 'report.md'))
    expect(readFileSync(join(dir, 'report.md'), 'utf8')).toBe('hello')
  })

  it('auto-uniques an existing name unless overwrite is explicit', () => {
    const dir = tmpBase()
    writeShareFile(dir, 'report.md', 'v1', false)
    const second = writeShareFile(dir, 'report.md', 'v2', false)
    expect(second.ok).toBe(true)
    expect(second.name).toBe('report-2.md')
    expect(second.existed).toBe(true)
    expect(readFileSync(join(dir, 'report.md'), 'utf8')).toBe('v1')
    expect(readFileSync(join(dir, 'report-2.md'), 'utf8')).toBe('v2')
    // -2 already taken → -3.
    const third = writeShareFile(dir, 'report.md', 'v3', false)
    expect(third.ok).toBe(true)
    expect(third.name).toBe('report-3.md')
    // Explicit overwrite replaces the original in place.
    const overwritten = writeShareFile(dir, 'report.md', 'v4', true)
    expect(overwritten.name).toBe('report.md')
    expect(overwritten.existed).toBe(true)
    expect(readFileSync(join(dir, 'report.md'), 'utf8')).toBe('v4')
  })

  it('rejects traversal, reserved names, and dot names', () => {
    const dir = tmpBase()
    for (const name of ['../evil.md', 'a/b.md', 'a\\b.md', 'a:b.md', 'a*b.md', '.', '..', '']) {
      const result = writeShareFile(dir, name, 'x', false)
      expect(result.ok, name).toBe(false)
    }
    expect(readdirSync(dir)).toHaveLength(0)
  })

  it('lists files newest first with size and mtime', async () => {
    const dir = tmpBase()
    writeShareFile(dir, 'a.txt', 'aaa', false)
    // Back-to-back writes can share an mtime tick, which makes the
    // newest-first order unstable — space the two writes out.
    await new Promise(resolve => setTimeout(resolve, 25))
    writeShareFile(dir, 'b.txt', 'bb', false)
    const listed = listShareFiles(dir)
    expect(listed.ok).toBe(true)
    expect(listed.files.map(entry => entry.name)).toEqual(['b.txt', 'a.txt'])
    expect(listed.files[0]!.size).toBe(2)
    expect(listed.files[1]!.mtime).toBeGreaterThan(0)
  })

  it('reports an unreadable dir as an error with an empty list', () => {
    const dir = join(tmpBase(), 'nested', 'shared')
    const listed = listShareFiles(dir)
    expect(listed.ok).toBe(false)
    expect(listed.files).toEqual([])
  })

  it('reads a shared file back and truncates beyond the preview cap', () => {
    const dir = tmpBase()
    writeShareFile(dir, 'note.txt', 'hello world', false)
    const read = readShareFile(dir, 'note.txt')
    expect(read.ok).toBe(true)
    expect(read.content).toBe('hello world')
    expect(read.truncated).toBe(false)
    const long = 'x'.repeat(30_000)
    writeShareFile(dir, 'long.txt', long, false)
    const capped = readShareFile(dir, 'long.txt')
    expect(capped.ok).toBe(true)
    expect(capped.truncated).toBe(true)
    expect(capped.content?.length).toBe(20_000)
    // Missing file and unsafe names fail cleanly.
    expect(readShareFile(dir, 'nope.txt').ok).toBe(false)
    expect(readShareFile(dir, '../evil.txt').ok).toBe(false)
  })
})
