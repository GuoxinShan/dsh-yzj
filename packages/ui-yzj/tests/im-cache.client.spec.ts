// @vitest-environment jsdom
/**
 * Sender-name resolution must unwrap CLI contact envelopes (pitfall-003) —
 * the live `/yzj contact-get` answers `{ list: [...] }`, not a bare array.
 */
import { describe, expect, it } from 'vitest'
import {
  clearFileDataCache, peekFileData, resolveFileData, resolveSenders, senderNameOf, senderPhotoOf,
} from '../src/client/im-cache.ts'

const ok = (value: unknown): { ok: true; value: unknown } => ({ ok: true, value })

describe('resolveSenders', () => {
  it('resolves names from a list envelope and caches them', async () => {
    const calls: string[] = []
    const found = await resolveSenders(['env-u1', 'env-u1'], {
      fetchContact: async (openId) => {
        calls.push(openId)
        return ok({ list: [{ openId, name: '老黎', photoUrl: 'https://x/p.png' }] })
      },
    })
    expect(found).toEqual({ 'env-u1': '老黎' })
    expect(calls).toEqual(['env-u1'])
    expect(senderNameOf('env-u1')).toBe('老黎')
    expect(senderPhotoOf('env-u1')).toBe('https://x/p.png')
  })

  it('resolves names from a bare array', async () => {
    const found = await resolveSenders(['env-u2'], {
      fetchContact: async () => ok([{ openId: 'env-u2', name: '同事' }]),
    })
    expect(found).toEqual({ 'env-u2': '同事' })
  })

  it('leaves unknown senders unresolved without caching failures', async () => {
    const found = await resolveSenders(['env-u3'], {
      fetchContact: async () => ({ ok: false as const, error: { message: 'down' } }),
    })
    expect(found).toEqual({})
    expect(senderNameOf('env-u3')).toBe('')
  })
})

describe('peekFileData', () => {
  it('returns the in-session data URL after resolveFileData', async () => {
    clearFileDataCache()
    expect(peekFileData('fid-1')).toBeUndefined()
    const dataUrl = 'data:image/png;base64,abc'
    await resolveFileData('fid-1', {
      fetchFileData: async () => ({ ok: true, value: { dataUrl } }),
    })
    expect(peekFileData('fid-1')).toBe(dataUrl)
    const again = await resolveFileData('fid-1', {
      fetchFileData: async () => ({ ok: true, value: { dataUrl: 'data:image/png;base64,other' } }),
    })
    expect(again).toBe(dataUrl)
    clearFileDataCache()
  })
})
