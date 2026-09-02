/**
 * Browser-safe CLI envelope helpers must match tool-yzj unwrapCli.
 */
import { describe, expect, it } from 'vitest'
import { unwrapCli, cliRows, cliRecord } from '../src/cli-payload.ts'

describe('cli-payload unwrap', () => {
  it('peels success envelopes and passes through bare payloads', () => {
    expect(unwrapCli({ success: true, data: { list: [1], more: true } })).toEqual({ list: [1], more: true })
    expect(unwrapCli({ list: [1] })).toEqual({ list: [1] })
    expect(unwrapCli([1, 2])).toEqual([1, 2])
  })

  it('cliRows reads list from wrapped, leftover, and bare array', () => {
    expect(cliRows({ success: true, data: { list: [{ id: 'a' }] } })).toEqual([{ id: 'a' }])
    expect(cliRows({ list: [{ id: 'a' }] })).toEqual([{ id: 'a' }])
    expect(cliRows([{ id: 'a' }])).toEqual([{ id: 'a' }])
  })

  it('cliRecord peels then exposes sibling flags such as more', () => {
    expect(cliRecord({ success: true, data: { list: [], more: true } }).more).toBe(true)
    expect(cliRecord({ list: [], more: true }).more).toBe(true)
  })
})
