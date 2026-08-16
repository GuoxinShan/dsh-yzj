import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildChannelsDoc, loadChannelsFile } from '../src/index.ts'

const bases: string[] = []
function tmpBase(): string {
  const base = mkdtempSync(join(tmpdir(), 'robot-channels-'))
  bases.push(base)
  return base
}

afterEach(() => {
  for (const base of bases.splice(0)) rmSync(base, { recursive: true, force: true })
})

describe('loadChannelsFile (design §8.5)', () => {
  it('returns undefined for a missing file (config fallback)', () => {
    expect(loadChannelsFile(join(tmpBase(), 'nope.json'))).toBeUndefined()
  })

  it('returns undefined for invalid JSON', () => {
    const path = join(tmpBase(), 'bad.json')
    writeFileSync(path, '{oops', 'utf8')
    expect(loadChannelsFile(path)).toBeUndefined()
  })

  it('parses robots and defaults, dropping entries without sendMsgUrl', () => {
    const path = join(tmpBase(), 'channels.json')
    writeFileSync(path, JSON.stringify({
      defaultProvider: 'opencode-go',
      robots: [
        { sendMsgUrl: 'https://a/b?yzjtoken=t1', provider: 'other', model: 'm1', cwd: 'C:\\work', enabled: false },
        { nope: true },
      ],
    }), 'utf8')
    const doc = loadChannelsFile(path)
    expect(doc?.defaultProvider).toBe('opencode-go')
    expect(doc?.robots).toHaveLength(1)
    expect(doc?.robots[0]).toMatchObject({ sendMsgUrl: 'https://a/b?yzjtoken=t1', provider: 'other', model: 'm1', cwd: 'C:\\work', enabled: false })
  })
})

describe('buildChannelsDoc (design §8.5)', () => {
  const configDefaults = { defaultProvider: 'patch-provider', defaultModel: 'patch-model' }

  it('seeds defaults from the patch config when nothing else provides them', () => {
    const doc = buildChannelsDoc({ robots: [{ sendMsgUrl: 'https://x?yzjtoken=t' }] }, undefined, configDefaults)
    expect(doc.defaultProvider).toBe('patch-provider')
    expect(doc.defaultModel).toBe('patch-model')
  })

  it('prefers the existing file defaults over the patch config', () => {
    const doc = buildChannelsDoc({ robots: [] }, { defaultProvider: 'file-provider', robots: [] }, configDefaults)
    expect(doc.defaultProvider).toBe('file-provider')
  })

  it('the payload overrides both file and patch defaults', () => {
    const doc = buildChannelsDoc(
      { defaultProvider: 'payload-provider', robots: [] },
      { defaultProvider: 'file-provider', robots: [] },
      configDefaults,
    )
    expect(doc.defaultProvider).toBe('payload-provider')
  })

  it('keeps robot entries minimal (only non-empty fields)', () => {
    const doc = buildChannelsDoc(
      { robots: [{ sendMsgUrl: 'https://x?yzjtoken=t', provider: 'p', cwd: 'C:\\w', enabled: false, allowFrom: ['u1'] }] },
      undefined,
      configDefaults,
    )
    expect(doc.robots).toEqual([
      { sendMsgUrl: 'https://x?yzjtoken=t', provider: 'p', cwd: 'C:\\w', enabled: false, allowFrom: ['u1'] },
    ])
  })

  it('round-trips through loadChannelsFile', () => {
    const doc = buildChannelsDoc(
      { robots: [{ sendMsgUrl: 'https://x?yzjtoken=t', model: 'm', allowFrom: ['u1'] }] },
      undefined,
      configDefaults,
    )
    const path = join(tmpBase(), 'roundtrip.json')
    writeFileSync(path, JSON.stringify(doc), 'utf8')
    const loaded = loadChannelsFile(path)
    expect(loaded?.defaultProvider).toBe('patch-provider')
    expect(loaded?.robots[0]).toMatchObject({ sendMsgUrl: 'https://x?yzjtoken=t', model: 'm', allowFrom: ['u1'] })
    expect(readFileSync(path, 'utf8')).toContain('sendMsgUrl')
  })
})
