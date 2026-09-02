/**
 * Calendar list windowing (pitfall-032). Yunzhijia's `calendar event list`
 * always includes the earliest occupied day in `[start, end]`, but drops
 * later instances of the same recurring series. We walk a slow pointer
 * (`lo`) forward to the day after each hit and peek the remaining suffix
 * (`[lo, stripeEnd]`) so empty tails collapse in one call. Week stripes
 * run in parallel.
 */
import { asArray, asNumber, asRecord, asString, unwrapCli } from './shared.ts'

/** Inclusive local-day cap for one list expansion (a year). */
export const CALENDAR_RANGE_MAX_DAYS = 366
/** Days per parallel stripe. */
export const CALENDAR_STRIPE_DAYS = 7
/** Parallel stripes (each stripe walks sequentially). */
export const CALENDAR_STRIPE_CONCURRENCY = 6

const YMD = /^(\d{4})-(\d{2})-(\d{2})/

/** One CLI window after expansion. */
export interface CalendarListWindow {
  start: string
  end: string
}

/** Result of one list invocation. */
export interface CalendarDayListResult {
  ok: boolean
  json?: unknown
  errorText?: string
}

/** `YYYY-MM-DD` in local time. */
function ymdOf(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Next local calendar day after `ymd`. */
export function nextCalendarDay(ymd: string): string {
  const date = new Date(`${ymd}T00:00:00`)
  date.setDate(date.getDate() + 1)
  return ymdOf(date)
}

/**
 * Local calendar day of a CLI time token (pure date, datetime, or unix
 * seconds/ms). `undefined` when the token cannot be parsed.
 */
export function parseCalendarDay(input: string): string | undefined {
  const ymd = YMD.exec(input)
  if (ymd !== null) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`
  const n = Number(input)
  if (Number.isFinite(n) && n > 0) {
    const ms = n < 1e12 ? n * 1000 : n
    const date = new Date(ms)
    return Number.isNaN(date.getTime()) ? undefined : ymdOf(date)
  }
  const parsed = Date.parse(input)
  if (Number.isNaN(parsed)) return undefined
  return ymdOf(new Date(parsed))
}

/**
 * Inclusive bound in epoch-ms. A pure `YYYY-MM-DD` start is local 00:00:00;
 * a pure date end is local 23:59:59.999.
 */
export function calendarBoundMs(input: string, role: 'start' | 'end'): number | undefined {
  const ymd = YMD.exec(input)
  if (ymd !== null && input.length === 10) {
    const stamp = role === 'start' ? 'T00:00:00' : 'T23:59:59.999'
    const ms = new Date(`${input}${stamp}`).getTime()
    return Number.isNaN(ms) ? undefined : ms
  }
  if (ymd !== null && input.length > 10) {
    const ms = new Date(input).getTime()
    return Number.isNaN(ms) ? undefined : ms
  }
  const n = Number(input)
  if (Number.isFinite(n) && n > 0) return n < 1e12 ? n * 1000 : n
  const parsed = Date.parse(input)
  return Number.isNaN(parsed) ? undefined : parsed
}

/**
 * Inclusive local `YYYY-MM-DD` days covering start..end. `undefined` when
 * either bound is unparseable; empty when start is after end.
 */
export function calendarRangeDays(start: string, end: string): string[] | undefined {
  const first = parseCalendarDay(start)
  const last = parseCalendarDay(end)
  if (first === undefined || last === undefined) return undefined
  const cursor = new Date(`${first}T00:00:00`)
  const stop = new Date(`${last}T00:00:00`)
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(stop.getTime())) return undefined
  if (cursor.getTime() > stop.getTime()) return []
  const days: string[] = []
  while (cursor.getTime() <= stop.getTime()) {
    days.push(ymdOf(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

/**
 * Unwrap the CLI list envelopes into a record array (0.1.6 `{success,data}`
 * plus 0.1.4 bare array / `{list}`).
 */
export function calendarEventsFromJson(json: unknown): unknown[] {
  const payload = unwrapCli(json)
  if (Array.isArray(payload)) return payload
  const record = asRecord(payload)
  if (Array.isArray(record.list)) return record.list
  if (Array.isArray(record.data)) return record.data
  const nested = asRecord(record.data)
  if (Array.isArray(nested.list)) return nested.list
  if (Array.isArray(nested.events)) return nested.events
  return asArray(payload)
}

/**
 * Dedupe by event id (fallback: JSON identity) and sort by `startDate`.
 */
export function mergeCalendarEvents(records: readonly unknown[]): unknown[] {
  const seen = new Set<string>()
  const out: unknown[] = []
  for (const record of records) {
    const id = asString(asRecord(record).id)
    const key = id === '' ? JSON.stringify(record) : id
    if (seen.has(key)) continue
    seen.add(key)
    out.push(record)
  }
  out.sort((left, right) => {
    const a = asNumber(asRecord(left).startDate) ?? 0
    const b = asNumber(asRecord(right).startDate) ?? 0
    return a - b
  })
  return out
}

/** Keep events whose `startDate` sits inside the original window. */
export function filterCalendarEvents(
  records: readonly unknown[],
  start: string,
  end: string,
): unknown[] {
  const startMs = calendarBoundMs(start, 'start')
  const endMs = calendarBoundMs(end, 'end')
  if (startMs === undefined || endMs === undefined) return [...records]
  return records.filter((record) => {
    const ms = asNumber(asRecord(record).startDate)
    if (ms === undefined) return true
    return ms >= startMs && ms <= endMs
  })
}

/** Local day of an event `startDate`, or `undefined` when missing. */
export function calendarEventDay(record: unknown): string | undefined {
  const ms = asNumber(asRecord(record).startDate)
  if (ms === undefined) return undefined
  const date = new Date(ms)
  return Number.isNaN(date.getTime()) ? undefined : ymdOf(date)
}

/** Earliest local day among dated events. */
export function earliestCalendarDay(records: readonly unknown[]): string | undefined {
  let hit: string | undefined
  for (const record of records) {
    const day = calendarEventDay(record)
    if (day === undefined) continue
    if (hit === undefined || day < hit) hit = day
  }
  return hit
}

/**
 * Plan the list: unparseable tokens stay one original window; otherwise
 * week stripes over the local day span.
 */
export function calendarListWindows(start: string, end: string):
  { ok: true; windows: CalendarListWindow[]; filter: boolean } | { ok: false; errorText: string } {
  const days = calendarRangeDays(start, end)
  if (days === undefined) return { ok: true, windows: [{ start, end }], filter: false }
  if (days.length > CALENDAR_RANGE_MAX_DAYS) {
    return {
      ok: false,
      errorText: `calendar event list window exceeds ${CALENDAR_RANGE_MAX_DAYS} days; split the range`,
    }
  }
  return { ok: true, windows: calendarWeekStripes(days), filter: true }
}

/** Partition an inclusive day list into `CALENDAR_STRIPE_DAYS` windows. */
export function calendarWeekStripes(days: readonly string[]): CalendarListWindow[] {
  const stripes: CalendarListWindow[] = []
  for (let index = 0; index < days.length; index += CALENDAR_STRIPE_DAYS) {
    const from = days[index]
    const to = days[Math.min(index + CALENDAR_STRIPE_DAYS - 1, days.length - 1)]
    if (from === undefined || to === undefined) continue
    stripes.push({ start: from, end: to })
  }
  return stripes
}

async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  const worker = async (): Promise<void> => {
    for (;;) {
      const index = cursor
      cursor += 1
      if (index >= items.length) return
      const item = items[index]
      if (item === undefined) return
      results[index] = await mapper(item)
    }
  }
  const n = Math.max(1, Math.min(limit, items.length))
  await Promise.all(Array.from({ length: n }, () => worker()))
  return results
}

/**
 * Slow pointer `lo` walks to the day after each hit. Fast window is the
 * remaining suffix `[lo, hi]`. An empty peek means the rest of the stripe
 * is empty. Only the earliest returned day is trusted (later days in the
 * same peek may be a collapsed subset).
 */
export async function scanCalendarStripe(
  lo: string,
  hi: string,
  listWindow: (start: string, end: string) => Promise<CalendarDayListResult>,
): Promise<{ ok: true; events: unknown[] } | { ok: false; errorText: string }> {
  const collected: unknown[] = []
  let cursor = lo
  const span = calendarRangeDays(lo, hi)
  const budget = (span?.length ?? 0) + 1
  let steps = 0
  while (cursor <= hi && steps < budget) {
    steps += 1
    const shot = await listWindow(cursor, hi)
    if (!shot.ok) return { ok: false, errorText: shot.errorText ?? 'calendar event list failed' }
    const batch = calendarEventsFromJson(shot.json)
    if (batch.length === 0) break
    const hit = earliestCalendarDay(batch)
    if (hit === undefined || hit < cursor || hit > hi) {
      collected.push(...batch)
      break
    }
    for (const record of batch) {
      const day = calendarEventDay(record)
      if (day === undefined || day === hit) collected.push(record)
    }
    cursor = nextCalendarDay(hit)
  }
  return { ok: true, events: collected }
}

/**
 * Expand `[start, end]` by week-striped two-pointer scans, merge by id,
 * then clip to the original bounds.
 */
export async function collectCalendarEvents(
  start: string,
  end: string,
  listWindow: (start: string, end: string) => Promise<CalendarDayListResult>,
): Promise<{ ok: true; events: unknown[] } | { ok: false; errorText: string }> {
  const plan = calendarListWindows(start, end)
  if (!plan.ok) return { ok: false, errorText: plan.errorText }
  if (plan.windows.length === 0) return { ok: true, events: [] }
  if (!plan.filter) {
    const shot = await listWindow(start, end)
    if (!shot.ok) return { ok: false, errorText: shot.errorText ?? 'calendar event list failed' }
    return { ok: true, events: calendarEventsFromJson(shot.json) }
  }
  const shots = await mapPool(plan.windows, CALENDAR_STRIPE_CONCURRENCY, window => (
    scanCalendarStripe(window.start, window.end, listWindow)
  ))
  const failed = shots.find(shot => !shot.ok)
  if (failed !== undefined && !failed.ok) {
    return { ok: false, errorText: failed.errorText }
  }
  const merged = mergeCalendarEvents(shots.flatMap(shot => shot.ok ? shot.events : []))
  return { ok: true, events: filterCalendarEvents(merged, start, end) }
}
