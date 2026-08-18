/**
 * Workbench calendar (group-room-topics v1.16): Lingee-shaped day / week /
 * month / year views over the month events already fetched by the panel.
 */
import { useMemo, useState, type ReactNode } from 'react'
import css from './calendar-pane.module.css'

export type CalView = 'day' | 'week' | 'month' | 'year'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'] as const
const HOUR_START = 7
const HOUR_END = 21
const HOUR_PX = 52
const TONES = ['blue', 'green', 'orange', 'red', 'purple'] as const

export interface CalendarEventDetail {
  title: string
  time: string
  person: string
  place: string
  content: string
}

export interface CalendarPaneProps {
  year: number
  month: number
  day: string
  events: unknown[]
  eventId: string
  eventDetail: CalendarEventDetail | null
  onNavigate: (year: number, month: number, day: string) => void
  onSelectEvent: (event: Record<string, unknown>) => void
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function ymd(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function parseDay(day: string, fallback: Date): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return fallback
  const date = new Date(`${day}T00:00:00`)
  return Number.isNaN(date.getTime()) ? fallback : date
}

function mondayOf(date: Date): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dow = (next.getDay() + 6) % 7
  next.setDate(next.getDate() - dow)
  return next
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

function clock(ms: unknown): string {
  if (typeof ms !== 'number') return ''
  const date = new Date(ms)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function toneOf(id: string): (typeof TONES)[number] {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) hash = (hash + id.charCodeAt(i)) % TONES.length
  return TONES[hash] ?? 'blue'
}

function eventDayKey(event: Record<string, unknown>): string {
  if (typeof event.startDate !== 'number') return ''
  return ymd(new Date(event.startDate))
}

function eventsOn(events: unknown[], day: string): Record<string, unknown>[] {
  return events.map(asRecord).filter(event => eventDayKey(event) === day)
}

function eventBlock(event: Record<string, unknown>): { top: number; height: number } | undefined {
  if (typeof event.startDate !== 'number') return undefined
  const start = new Date(event.startDate)
  const end = typeof event.endDate === 'number' ? new Date(event.endDate) : new Date(event.startDate + 60 * 60 * 1000)
  const startHour = start.getHours() + start.getMinutes() / 60
  const endHour = end.getHours() + end.getMinutes() / 60
  const top = (startHour - HOUR_START) * HOUR_PX
  const height = Math.max(22, (endHour - startHour) * HOUR_PX)
  return { top, height }
}

function hours(): number[] {
  const list: number[] = []
  for (let hour = HOUR_START; hour <= HOUR_END; hour += 1) list.push(hour)
  return list
}

/**
 * Full-page calendar with 日 / 周 / 月 / 年, matching the Lingee `.cal` chrome.
 */
export function CalendarPane(props: CalendarPaneProps) {
  const [view, setView] = useState<CalView>('week')
  const cursor = parseDay(props.day, new Date(props.year, props.month - 1, 1))
  const today = ymd(new Date())
  const weekStart = mondayOf(cursor)
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart.getTime()])

  const rangeLabel = ((): string => {
    if (view === 'year') return `${cursor.getFullYear()}年`
    if (view === 'month') return `${cursor.getFullYear()}年${cursor.getMonth() + 1}月`
    if (view === 'day') return `${cursor.getMonth() + 1}月${cursor.getDate()}日`
    const end = weekDays[6] ?? cursor
    if (weekStart.getMonth() === end.getMonth()) {
      return `${weekStart.getFullYear()}年${weekStart.getMonth() + 1}月${weekStart.getDate()}日 – ${end.getDate()}日`
    }
    return `${weekStart.getMonth() + 1}月${weekStart.getDate()}日 – ${end.getMonth() + 1}月${end.getDate()}日`
  })()

  const goToday = (): void => {
    const now = new Date()
    props.onNavigate(now.getFullYear(), now.getMonth() + 1, ymd(now))
  }

  const go = (delta: number): void => {
    let next = new Date(cursor)
    if (view === 'day') next = addDays(cursor, delta)
    else if (view === 'week') next = addDays(cursor, delta * 7)
    else if (view === 'month') next = new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1)
    else next = new Date(cursor.getFullYear() + delta, cursor.getMonth(), 1)
    props.onNavigate(next.getFullYear(), next.getMonth() + 1, ymd(next))
  }

  const pickDay = (date: Date, nextView?: CalView): void => {
    if (nextView !== undefined) setView(nextView)
    props.onNavigate(date.getFullYear(), date.getMonth() + 1, ymd(date))
  }

  const renderEventChip = (event: Record<string, unknown>, key: string): ReactNode => {
    const id = asString(event.id)
    const tone = toneOf(id === '' ? asString(event.title) : id)
    const start = clock(event.startDate)
    return (
      <button
        key={key}
        type="button"
        className={`${css.monthEv} ${css[`ev_${tone}`]} ${id === props.eventId ? css.monthEvOn : ''}`}
        onClick={(click) => {
          click.stopPropagation()
          props.onSelectEvent(event)
        }}
      >
        <span className={css.monthEvTime}>{start === '' ? '全天' : start}</span>
        <span className={css.monthEvTitle}>{asString(event.title)}</span>
      </button>
    )
  }

  const renderTimed = (day: Date): ReactNode => {
    const key = ymd(day)
    return eventsOn(props.events, key).map((event, index) => {
      const box = eventBlock(event)
      if (box === undefined) return null
      const id = asString(event.id)
      const tone = toneOf(id === '' ? asString(event.title) : id)
      return (
        <button
          key={`${key}-${index}`}
          type="button"
          className={`${css.block} ${css[`block_${tone}`]} ${id === props.eventId ? css.blockOn : ''}`}
          style={{ top: box.top, height: box.height }}
          onClick={() => { props.onSelectEvent(event) }}
        >
          <span className={css.blockTitle}>{asString(event.title)}</span>
          <span className={css.blockTime}>{clock(event.startDate)}{clock(event.endDate) === '' ? '' : ` – ${clock(event.endDate)}`}</span>
        </button>
      )
    })
  }

  const nowTop = ((): number | undefined => {
    const now = new Date()
    if (ymd(now) !== ymd(cursor) && view === 'day') return undefined
    const hour = now.getHours() + now.getMinutes() / 60
    if (hour < HOUR_START || hour > HOUR_END) return undefined
    return (hour - HOUR_START) * HOUR_PX
  })()

  return (
    <div className={css.page} data-testid="yzj-calendar-pane">
      <div className={css.toolbar}>
        <div className={css.toolbarLeft}>
          <button type="button" className={css.today} onClick={goToday}>今天</button>
          <div className={css.nav}>
            <button type="button" className={css.icon} aria-label="上一段" onClick={() => go(-1)}>‹</button>
            <button type="button" className={css.icon} aria-label="下一段" onClick={() => go(1)}>›</button>
          </div>
          <span className={css.range}>{rangeLabel}</span>
        </div>
        <div className={css.views} role="tablist" aria-label="日程视图">
          {(['day', 'week', 'month', 'year'] as const).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={view === item}
              className={view === item ? `${css.view} ${css.viewOn}` : css.view}
              onClick={() => { setView(item) }}
            >
              {item === 'day' ? '日' : item === 'week' ? '周' : item === 'month' ? '月' : '年'}
            </button>
          ))}
        </div>
      </div>

      {view === 'week' && (
        <div className={css.week}>
          <div className={css.weekHead}>
            <div className={css.gutter}>GMT+8</div>
            {weekDays.map((day) => {
              const key = ymd(day)
              return (
                <button
                  key={key}
                  type="button"
                  className={`${css.dayHead} ${key === today ? css.dayHeadToday : ''} ${key === props.day ? css.dayHeadOn : ''}`}
                  onClick={() => pickDay(day, 'day')}
                >
                  <span className={css.dayWeek}>{WEEKDAYS[(day.getDay() + 6) % 7]}</span>
                  <span className={css.dayDate}>{day.getDate()}</span>
                </button>
              )
            })}
          </div>
          <div className={css.weekBody}>
            <div className={css.times}>
              {hours().map((hour) => (
                <div key={hour} className={css.timeRow} style={{ height: HOUR_PX }}>
                  <span className={css.timeLabel}>{pad(hour)}:00</span>
                </div>
              ))}
            </div>
            <div className={css.grid} style={{ height: hours().length * HOUR_PX }}>
              {weekDays.map((day) => {
                const key = ymd(day)
                return (
                  <div
                    key={key}
                    className={`${css.col} ${key === today ? css.colToday : ''} ${key === props.day ? css.colOn : ''}`}
                    onClick={() => pickDay(day)}
                  >
                    {renderTimed(day)}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {view === 'day' && (
        <div className={css.week}>
          <div className={css.weekHead}>
            <div className={css.gutter}>GMT+8</div>
            <div className={`${css.dayHead} ${css.dayHeadOn} ${ymd(cursor) === today ? css.dayHeadToday : ''}`}>
              <span className={css.dayWeek}>{WEEKDAYS[(cursor.getDay() + 6) % 7]}</span>
              <span className={css.dayDate}>{cursor.getDate()}</span>
            </div>
          </div>
          <div className={css.weekBody}>
            <div className={css.times}>
              {hours().map((hour) => (
                <div key={hour} className={css.timeRow} style={{ height: HOUR_PX }}>
                  <span className={css.timeLabel}>{pad(hour)}:00</span>
                </div>
              ))}
            </div>
            <div className={css.grid} style={{ height: hours().length * HOUR_PX }}>
              <div className={`${css.col} ${css.colOn} ${ymd(cursor) === today ? css.colToday : ''}`}>
                {renderTimed(cursor)}
                {nowTop !== undefined && ymd(cursor) === today && (
                  <div className={css.now} style={{ top: nowTop }}><span className={css.nowDot} /></div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {view === 'month' && (
        <div className={css.month}>
          <div className={css.monthHead}>
            {WEEKDAYS.map((label) => <div key={label} className={css.monthHeadCell}>{label}</div>)}
          </div>
          <div className={css.monthGrid}>
            {monthRows(cursor.getFullYear(), cursor.getMonth() + 1).map((row, rowIndex) => (
              <div key={`r${rowIndex}`} className={css.monthRow}>
                {row.map((cell) => {
                  const key = ymd(cell.date)
                  const dayEvents = eventsOn(props.events, key)
                  return (
                    <div
                      key={key}
                      className={`${css.monthCell} ${cell.outside ? css.monthCellMuted : ''} ${key === props.day ? css.monthCellOn : ''}`}
                      onClick={() => pickDay(cell.date, 'day')}
                    >
                      <div className={css.monthDateRow}>
                        <span className={`${css.monthDate} ${key === today ? css.monthDateToday : ''}`}>{cell.date.getDate()}</span>
                      </div>
                      <div className={css.monthEvents}>
                        {dayEvents.slice(0, 3).map((event, index) => renderEventChip(event, `${key}-${index}`))}
                        {dayEvents.length > 3 && <div className={css.monthMore}>还有 {dayEvents.length - 3} 项</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'year' && (
        <div className={css.year}>
          {Array.from({ length: 12 }, (_, monthIndex) => {
            const month = monthIndex + 1
            return (
              <button
                key={month}
                type="button"
                className={css.yearMonth}
                onClick={() => {
                  setView('month')
                  props.onNavigate(cursor.getFullYear(), month, `${cursor.getFullYear()}-${pad(month)}-01`)
                }}
              >
                <div className={`${css.yearTitle} ${month === cursor.getMonth() + 1 ? css.yearTitleOn : ''}`}>{month}月</div>
                <div className={css.yearWeek}>
                  {WEEKDAYS.map((label) => <span key={label} className={css.yearWcell}>{label}</span>)}
                </div>
                <div className={css.yearDays}>
                  {yearCells(cursor.getFullYear(), month).map((cell, index) => {
                    if (cell === null) return <span key={`e${index}`} className={`${css.yearDay} ${css.yearDayEmpty}`} />
                    const key = `${cursor.getFullYear()}-${pad(month)}-${pad(cell)}`
                    const has = eventsOn(props.events, key).length > 0
                    const isToday = key === today
                    return (
                      <span key={key} className={`${css.yearDay} ${isToday ? css.yearDayToday : ''}`}>
                        {cell}
                        {has && <span className={css.yearDot} />}
                      </span>
                    )
                  })}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {props.eventDetail !== null && props.eventId !== '' && (
        <div className={css.detail}>
          <div className={css.detailTitle}>{props.eventDetail.title}</div>
          {props.eventDetail.time !== '' && <div className={css.detailRow}>{props.eventDetail.time}</div>}
          {props.eventDetail.person !== '' && <div className={css.detailRow}>{props.eventDetail.person}</div>}
          {props.eventDetail.place !== '' && <div className={css.detailRow}>{props.eventDetail.place}</div>}
          {props.eventDetail.content !== '' && <div className={css.detailBody}>{props.eventDetail.content}</div>}
        </div>
      )}
    </div>
  )
}

function monthRows(year: number, month: number): { date: Date; outside: boolean }[][] {
  const first = new Date(year, month - 1, 1)
  const start = mondayOf(first)
  const rows: { date: Date; outside: boolean }[][] = []
  let cursor = start
  for (let row = 0; row < 6; row += 1) {
    const cells: { date: Date; outside: boolean }[] = []
    for (let col = 0; col < 7; col += 1) {
      cells.push({ date: cursor, outside: cursor.getMonth() !== month - 1 })
      cursor = addDays(cursor, 1)
    }
    rows.push(cells)
  }
  return rows
}

function yearCells(year: number, month: number): (number | null)[] {
  const firstDow = (new Date(year, month - 1, 1).getDay() + 6) % 7
  const dim = new Date(year, month, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDow; i += 1) cells.push(null)
  for (let day = 1; day <= dim; day += 1) cells.push(day)
  return cells
}
