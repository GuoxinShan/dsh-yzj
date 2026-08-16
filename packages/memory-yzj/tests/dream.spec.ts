/**
 * Dream state specs: file defaults (switch OFF), partial-update
 * normalization (half routes dropped, invalid dailyAt cleared), and the
 * pure daily-fire predicate across boundaries (before/after the fire time,
 * same-day dedupe, disabled/unscheduled states).
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isValidDailyAt, readDreamSettings, shouldFireDaily, updateDreamSettings } from '../src/dream.ts'

function root(): string {
  return mkdtempSync(join(tmpdir(), 'memory-dream-'))
}

describe('dream state file', () => {
  it('defaults to disabled when absent or malformed', () => {
    expect(readDreamSettings(root())).toEqual({ enabled: false })
    const malformed = root()
    writeFileSync(join(malformed, 'dream.json'), '{oops', 'utf8')
    expect(readDreamSettings(malformed)).toEqual({ enabled: false })
  })

  it('persists partial updates and normalizes half routes / invalid times', () => {
    const dir = root()
    const on = updateDreamSettings(dir, { enabled: true })
    expect(on.enabled).toBe(true)
    expect(readDreamSettings(dir).enabled).toBe(true)
    const half = updateDreamSettings(dir, { provider: 'deepseek' })
    expect(half.provider).toBeUndefined()
    expect(half.model).toBeUndefined()
    const full = updateDreamSettings(dir, { provider: 'deepseek', model: 'glm-4.7', dailyAt: '03:30' })
    expect(full).toMatchObject({ enabled: true, provider: 'deepseek', model: 'glm-4.7', dailyAt: '03:30' })
    const bad = updateDreamSettings(dir, { dailyAt: '25:99' })
    expect(bad.dailyAt).toBeUndefined()
    // clearing: empty strings drop the route (picker「跟随插件默认」)
    const cleared = updateDreamSettings(dir, { provider: '', model: '' })
    expect(cleared.provider).toBeUndefined()
    expect(cleared.model).toBeUndefined()
    expect(JSON.parse(readFileSync(join(dir, 'dream.json'), 'utf8')).enabled).toBe(true)
  })
})

describe('shouldFireDaily', () => {
  const at = (day: number, hour: number, minute: number): Date => new Date(2026, 7, day, hour, minute)

  it('fires only after the scheduled minute, once per day', () => {
    const state = { enabled: true, dailyAt: '03:30' }
    expect(shouldFireDaily(state, at(16, 3, 29))).toBe(false)
    expect(shouldFireDaily(state, at(16, 3, 30))).toBe(true)
    expect(shouldFireDaily(state, at(16, 23, 0))).toBe(true)
    expect(shouldFireDaily({ ...state, lastRunDay: '2026-08-16' }, at(16, 23, 0))).toBe(false)
    // next day fires again only after the scheduled minute
    expect(shouldFireDaily(state, at(17, 3, 0))).toBe(false)
    expect(shouldFireDaily(state, at(17, 3, 31))).toBe(true)
  })

  it('never fires when disabled, unscheduled, or misconfigured', () => {
    expect(shouldFireDaily({ enabled: false, dailyAt: '03:30' }, at(16, 9, 0))).toBe(false)
    expect(shouldFireDaily({ enabled: true }, at(16, 9, 0))).toBe(false)
    expect(shouldFireDaily({ enabled: true, dailyAt: '9:00' }, at(16, 9, 0))).toBe(false)
  })

  it('validates dailyAt strictly', () => {
    expect(isValidDailyAt('00:00')).toBe(true)
    expect(isValidDailyAt('23:59')).toBe(true)
    expect(isValidDailyAt('24:00')).toBe(false)
    expect(isValidDailyAt('3:30')).toBe(false)
    expect(isValidDailyAt('')).toBe(false)
  })
})
