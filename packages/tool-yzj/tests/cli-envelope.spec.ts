/**
 * yzj-cli 0.1.6 success envelope + exit-code mapping (skill 0.6.0).
 * Parsers must accept both `{success, identity, data}` and 0.1.4 bare payloads.
 */
import { describe, expect, it } from 'vitest'
import type { YzjRunResult } from '@dsh-yzj/bridge'
import { unwrapCli, cliList, cliObject, failureDigest } from '../src/shared.ts'

function fail(over: Pick<YzjRunResult, 'exitCode' | 'stderr'>): YzjRunResult {
  return {
    ok: false,
    stdout: '',
    truncated: false,
    timedOut: false,
    durationMs: 1,
    ...over,
  }
}

describe('unwrapCli / cliList / cliObject', () => {
  it('peels the 0.1.6 success envelope down to data', () => {
    expect(unwrapCli({
      success: true,
      identity: { openId: 'u1' },
      data: { list: [{ groupId: 'g1' }], more: true },
    })).toEqual({ list: [{ groupId: 'g1' }], more: true })
  })

  it('passes through 0.1.4 bare arrays and unwrapped objects', () => {
    expect(unwrapCli([{ id: 'd1' }])).toEqual([{ id: 'd1' }])
    expect(unwrapCli({ list: [{ id: 'd1' }] })).toEqual({ list: [{ id: 'd1' }] })
    expect(unwrapCli({ title: '周报', id: 'd1' })).toEqual({ title: '周报', id: 'd1' })
  })

  it('turns an empty write receipt (success, no data) into {}', () => {
    expect(unwrapCli({ success: true, identity: { openId: 'u1' } })).toEqual({})
    expect(unwrapCli({ success: true, identity: { openId: 'u1' }, data: null })).toEqual({})
  })

  it('is idempotent', () => {
    const inner = { list: [{ id: '1' }] }
    expect(unwrapCli(unwrapCli({ success: true, data: inner }))).toEqual(inner)
  })

  it('reads list from wrapped, leftover data, and unwrapped shapes', () => {
    expect(cliList({ success: true, data: { list: [{ a: 1 }] } })).toEqual([{ a: 1 }])
    expect(cliList({ list: [{ a: 1 }] })).toEqual([{ a: 1 }])
    expect(cliList([{ a: 1 }])).toEqual([{ a: 1 }])
    expect(cliList({ success: true, data: [{ a: 1 }] })).toEqual([{ a: 1 }])
    expect(cliList({ data: { blocks: [{ type: 'p' }] } }, ['blocks'])).toEqual([{ type: 'p' }])
  })

  it('cliObject peels then returns the record', () => {
    expect(cliObject({ success: true, data: { msgId: 'm1' } }).msgId).toBe('m1')
    expect(cliObject({ msgId: 'm2' }).msgId).toBe('m2')
  })
})

describe('failureDigest exit mapping', () => {
  it('treats exit 10 + confirmation_required as the CLI gate, not auth', () => {
    const value = failureDigest('doc delete', fail({
      exitCode: 10,
      stderr: JSON.stringify({
        success: false,
        error: {
          type: 'user',
          subtype: 'confirmation_required',
          message: 'High-risk command requires --yes',
          hint: 'Re-run with --yes',
        },
      }),
    }), 5_000)
    expect(value.content).toContain('exit 10')
    expect(value.content).toContain('High-risk command requires --yes')
    expect(value.content).toContain('--yes')
    expect(value.content).not.toContain('auth login')
  })

  it('still recognizes 0.1.4 confirmation_required on exit 3', () => {
    const value = failureDigest('doc delete', fail({
      exitCode: 3,
      stderr: 'confirmation_required: pass --yes',
    }), 5_000)
    expect(value.content).toContain('exit 3')
    expect(value.content).toContain('--yes')
  })

  it('maps credentials_missing exit 3 to a login hint, not the confirm gate', () => {
    const value = failureDigest('whoami', fail({
      exitCode: 3,
      stderr: JSON.stringify({
        success: false,
        error: {
          type: 'authentication',
          subtype: 'credentials_missing',
          message: 'Not logged in',
          hint: 'yzj-cli auth login',
        },
      }),
    }), 5_000)
    expect(value.content).toContain('Not logged in')
    expect(value.content).toContain('auth login')
    expect(value.content).not.toContain('confirmation_required')
  })

  it('hints that exit 5 is an internal / --jq failure', () => {
    const value = failureDigest('doc list', fail({
      exitCode: 5,
      stderr: 'jq: error',
    }), 5_000)
    expect(value.content).toContain('exit 5')
    expect(value.content).toContain('--jq')
  })
})
