/**
 * Contact envelope parsing (pitfall-003): the CLI answers bare arrays, list
 * envelopes, data envelopes, or a single object — every shape must resolve.
 */
import { describe, expect, it } from 'vitest'
import { parseContactUser } from '../src/contact-parse.ts'

describe('parseContactUser', () => {
  it('parses a bare array', () => {
    expect(parseContactUser([{ openId: 'u1', name: '老黎', photoUrl: 'p.png' }]))
      .toEqual({ openId: 'u1', name: '老黎', photoUrl: 'p.png' })
  })

  it('parses a list envelope (real contact-get shape)', () => {
    expect(parseContactUser({ list: [{ openId: 'u1', name: '老黎', photoUrl: 'p.png' }] }))
      .toEqual({ openId: 'u1', name: '老黎', photoUrl: 'p.png' })
  })

  it('parses data envelopes, flat and nested', () => {
    expect(parseContactUser({ data: [{ oId: 'u1', userName: '老黎' }] }).name).toBe('老黎')
    expect(parseContactUser({ data: { list: [{ openId: 'u1', nickName: '老黎' }] } }).name).toBe('老黎')
  })

  it('parses the 0.1.6 whoami success envelope (data is one user object)', () => {
    expect(parseContactUser({
      success: true,
      identity: { openId: 'u1' },
      data: { openId: 'u1', name: '老黎', photoUrl: 'p.png' },
    })).toEqual({ openId: 'u1', name: '老黎', photoUrl: 'p.png' })
  })

  it('parses a single object and alternate field names', () => {
    expect(parseContactUser({ oId: 'u1', name: '老黎', photo: 'p.png' }))
      .toEqual({ openId: 'u1', name: '老黎', photoUrl: 'p.png' })
  })

  it('answers empty fields on junk input', () => {
    expect(parseContactUser(undefined)).toEqual({ openId: '', name: '', photoUrl: '' })
    expect(parseContactUser('nope')).toEqual({ openId: '', name: '', photoUrl: '' })
    expect(parseContactUser({})).toEqual({ openId: '', name: '', photoUrl: '' })
    expect(parseContactUser({ list: [] })).toEqual({ openId: '', name: '', photoUrl: '' })
  })
})
