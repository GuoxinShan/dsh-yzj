/**
 * Calendar list expansion: week-striped two-pointer scan so recurring
 * instances survive without listing every empty day (pitfall-032).
 */
import { describe, expect, it } from 'vitest'
import {
  CALENDAR_RANGE_MAX_DAYS,
  CALENDAR_STRIPE_DAYS,
  calendarBoundMs,
  calendarEventsFromJson,
  calendarListWindows,
  calendarRangeDays,
  calendarWeekStripes,
  collectCalendarEvents,
  filterCalendarEvents,
  mergeCalendarEvents,
  nextCalendarDay,
  parseCalendarDay,
} from '../src/calendar-range.ts'

describe('calendarRangeDays', () => {
  it('expands an inclusive date window', () => {
    expect(calendarRangeDays('2026-08-01', '2026-08-03')).toEqual([
      '2026-08-01', '2026-08-02', '2026-08-03',
    ])
  })

  it('treats a single day as one entry', () => {
    expect(calendarRangeDays('2026-08-18', '2026-08-18')).toEqual(['2026-08-18'])
  })

  it('reads the date of a datetime token', () => {
    expect(parseCalendarDay('2026-08-18T10:00:00')).toBe('2026-08-18')
    expect(calendarRangeDays('2026-08-17T09:00:00', '2026-08-18T11:00:00')).toEqual([
      '2026-08-17', '2026-08-18',
    ])
  })

  it('returns undefined for unparseable bounds', () => {
    expect(calendarRangeDays('soon', '2026-08-18')).toBeUndefined()
  })

  it('returns an empty list when start is after end', () => {
    expect(calendarRangeDays('2026-08-18', '2026-08-01')).toEqual([])
  })

  it('steps to the next local day', () => {
    expect(nextCalendarDay('2026-08-31')).toBe('2026-09-01')
  })
})

describe('calendarListWindows', () => {
  it('partitions a month into week stripes', () => {
    const plan = calendarListWindows('2026-08-01', '2026-08-31')
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.filter).toBe(true)
    expect(plan.windows[0]).toEqual({ start: '2026-08-01', end: '2026-08-07' })
    expect(plan.windows.at(-1)).toEqual({ start: '2026-08-29', end: '2026-08-31' })
    expect(plan.windows).toHaveLength(Math.ceil(31 / CALENDAR_STRIPE_DAYS))
  })

  it('keeps a two-day span as one stripe', () => {
    expect(calendarWeekStripes(['2026-08-17', '2026-08-18'])).toEqual([
      { start: '2026-08-17', end: '2026-08-18' },
    ])
  })

  it('keeps the original tokens when they cannot be parsed', () => {
    expect(calendarListWindows('soon', 'later')).toEqual({
      ok: true,
      filter: false,
      windows: [{ start: 'soon', end: 'later' }],
    })
  })

  it('rejects a window longer than a year', () => {
    const start = '2026-01-01'
    const end = '2027-01-03'
    expect(calendarRangeDays(start, end)?.length).toBeGreaterThan(CALENDAR_RANGE_MAX_DAYS)
    expect(calendarListWindows(start, end)).toEqual({
      ok: false,
      errorText: `calendar event list window exceeds ${CALENDAR_RANGE_MAX_DAYS} days; split the range`,
    })
  })
})

describe('merge and filter', () => {
  it('dedupes by id and sorts by startDate', () => {
    const merged = mergeCalendarEvents([
      { id: 'b', startDate: 200, title: 'later' },
      { id: 'a', startDate: 100, title: 'first' },
      { id: 'b', startDate: 200, title: 'dup' },
    ])
    expect(merged.map(item => (item as { id: string }).id)).toEqual(['a', 'b'])
  })

  it('unwraps data/list envelopes', () => {
    expect(calendarEventsFromJson({ data: { list: [{ id: '1' }] } })).toEqual([{ id: '1' }])
    expect(calendarEventsFromJson([{ id: '2' }])).toEqual([{ id: '2' }])
  })

  it('clips events to a same-day datetime window', () => {
    const start = '2026-08-18T09:00:00'
    const end = '2026-08-18T11:00:00'
    const startMs = calendarBoundMs(start, 'start')
    const endMs = calendarBoundMs(end, 'end')
    expect(startMs).toBeDefined()
    expect(endMs).toBeDefined()
    const kept = filterCalendarEvents([
      { id: 'in', startDate: (startMs ?? 0) + 60_000 },
      { id: 'out', startDate: (endMs ?? 0) + 60_000 },
    ], start, end)
    expect(kept).toEqual([{ id: 'in', startDate: (startMs ?? 0) + 60_000 }])
  })
})

/** CLI-shaped collapse: only the earliest seeded day in the window. */
function collapsingList(seed: Record<string, { id: string; startDate: number; title: string }>) {
  const calls: string[] = []
  const listWindow = async (start: string, end: string) => {
    calls.push(`${start}/${end}`)
    const days = calendarRangeDays(start, end) ?? [start]
    for (const day of days) {
      const event = seed[day]
      if (event !== undefined) return { ok: true as const, json: [event] }
    }
    return { ok: true as const, json: [] }
  }
  return { calls, listWindow }
}

describe('collectCalendarEvents', () => {
  it('walks the suffix after each hit and keeps later instances', async () => {
    const ev17 = { id: '17', startDate: Date.parse('2026-08-17T10:00:00'), title: '17' }
    const ev18 = { id: '18', startDate: Date.parse('2026-08-18T10:00:00'), title: '18' }
    const { calls, listWindow } = collapsingList({ '2026-08-17': ev17, '2026-08-18': ev18 })
    const result = await collectCalendarEvents('2026-08-17', '2026-08-18', listWindow)
    expect(calls).toEqual(['2026-08-17/2026-08-18', '2026-08-18/2026-08-18'])
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.events.map(item => (item as { id: string }).id)).toEqual(['17', '18'])
    }
  })

  it('stops when a suffix peek is empty', async () => {
    const ev17 = { id: '17', startDate: Date.parse('2026-08-17T10:00:00'), title: '17' }
    const { calls, listWindow } = collapsingList({ '2026-08-17': ev17 })
    const result = await collectCalendarEvents('2026-08-17', '2026-08-21', listWindow)
    expect(calls).toEqual(['2026-08-17/2026-08-21', '2026-08-18/2026-08-21'])
    expect(result.ok && result.events).toEqual([ev17])
  })

  it('surfaces the first failed peek', async () => {
    const result = await collectCalendarEvents('2026-08-17', '2026-08-18', async (start) => {
      if (start === '2026-08-18') return { ok: false, errorText: 'boom' }
      return {
        ok: true,
        json: [{ id: '17', startDate: Date.parse('2026-08-17T10:00:00') }],
      }
    })
    expect(result).toEqual({ ok: false, errorText: 'boom' })
  })
})
