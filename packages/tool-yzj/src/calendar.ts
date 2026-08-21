/**
 * Calendar-domain tools: event queries, create/update/delete, participants,
 * and free-room lookup. Event deletion is gated by the approval guard.
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import {
  runValue, yzjToolOutput, linesOf,
  asRecord, asArray, asString, asNumber, clipJson,
} from './shared.ts'
import type { YzjToolBudget } from './shared.ts'
import { collectCalendarEvents } from './calendar-range.ts'

/** Format an epoch-ms timestamp as `MM-DD HH:mm` in local time. */
function clockTime(ms: unknown): string {
  const value = asNumber(ms)
  if (value === undefined) return ''
  const date = new Date(value)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Slim list row for the card payload (full CLI blobs overflow the meta cap). */
function eventCard(record: unknown): Record<string, unknown> {
  const event = asRecord(record)
  const out: Record<string, unknown> = {}
  for (const key of ['id', 'title', 'startDate', 'endDate', 'personName', 'meetingPlace', 'content', 'meetingStatus'] as const) {
    const value = event[key]
    if (value !== undefined && value !== null && value !== '') out[key] = value
  }
  return out
}

/** One event line for list digests. */
function eventLine(record: unknown): string {
  const event = asRecord(record)
  const title = asString(event.title)
  const id = asString(event.id)
  const start = clockTime(event.startDate)
  const end = clockTime(event.endDate)
  const person = asString(event.personName)
  const status = asNumber(event.meetingStatus)
  const parts = [title === '' ? id : title]
  if (start !== '') parts.push(`${start}${end === '' ? '' : `→${end}`}`)
  if (person !== '') parts.push(person)
  if (status !== undefined && status !== 1) parts.push(`状态 ${status}`)
  if (id !== '' && id !== title) parts.push(`(${id})`)
  return parts.join(' · ')
}

/** Register the calendar-domain tools. */
export function applyCalendarTools(ctx: Context, budget: YzjToolBudget): void {
  ctx.tools.register(defineTool({
    name: 'yzj_calendar_event_list',
    description: 'List calendar events in a time window (pure dates or datetimes). Multi-day windows are scanned with a two-pointer walk so recurring instances are not collapsed to the first occurrence. Returns one line per event.',
    parameters: {
      start: { type: 'string', required: true, description: 'Start: "YYYY-MM-DD", "YYYY-MM-DDTHH:mm:ss", with timezone, or unix seconds/ms.' },
      end: { type: 'string', required: true, description: 'End (same formats).' },
    },
    output: yzjToolOutput,
    timeoutMs: budget.timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args) {
      const collected = await collectCalendarEvents(args.start, args.end, async (start, end) => {
        const result = await ctx.yzjBridge.run(
          ['calendar', 'event', 'list', '--start', start, '--end', end],
          { timeoutMs: budget.timeoutMs },
        )
        if (!result.ok) {
          const detail = result.stderr.trim() === ''
            ? `exit ${result.exitCode ?? 'killed'}`
            : result.stderr.trim()
          return { ok: false, errorText: detail }
        }
        return result.json === undefined ? { ok: true } : { ok: true, json: result.json }
      })
      if (!collected.ok) {
        return {
          content: `yzj calendar event list failed: ${collected.errorText}`,
          truncated: false,
          data: {},
        }
      }
      const events = collected.events
      if (events.length === 0) {
        return { content: '(no events)', truncated: false, data: { list: clipJson([], { maxChars: budget.maxMetaChars }) } }
      }
      const digest = linesOf(events.map(eventLine), budget.maxRenderChars)
      return {
        content: digest.content,
        truncated: digest.truncated,
        data: { list: clipJson(events.map(eventCard), { maxChars: budget.maxMetaChars }) },
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'yzj_calendar_event_get',
    description: 'Fetch one calendar event by id.',
    parameters: {
      id: { type: 'string', required: true, description: 'Event id.' },
    },
    output: yzjToolOutput,
    timeoutMs: budget.timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args) {
      return runValue(ctx, budget, 'calendar event get', ['calendar', 'event', 'get', '--id', args.id], (json) => {
        const event = asRecord(json)
        const content = eventLine(event)
        return { content, data: { record: clipJson(event, { maxChars: budget.maxMetaChars }) } }
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'yzj_calendar_event_create',
    description: 'Create a calendar event/meeting. organizerOpenIds is required; resolve openIds via yzj_contact_search first.',
    parameters: {
      title: { type: 'string', required: true, description: 'Event title (max 100 chars).' },
      start: { type: 'string', required: true, description: 'Start time (see yzj_calendar_event_list formats).' },
      end: { type: 'string', required: true, description: 'End time.' },
      organizerOpenIds: { type: 'array', required: true, items: { type: 'string' }, description: 'Organizer openIds (required).' },
      openId: { type: 'string', description: 'Operating user openId (required under app-level authorization).' },
      description: { type: 'string', description: 'Event description.' },
      roomId: { type: 'string', description: 'Meeting room id (from yzj_calendar_room_find).' },
      attendeeOpenIds: { type: 'array', items: { type: 'string' }, description: 'Attendee openIds.' },
      calendarId: { type: 'string', description: 'Calendar id; omit for the main calendar.' },
    },
    output: yzjToolOutput,
    timeoutMs: budget.timeoutMs,
    isConcurrencySafe: () => false,
    async execute(args) {
      const command = [
        'calendar', 'event', 'create',
        '--title', args.title,
        '--start', args.start,
        '--end', args.end,
      ]
      if (args.openId !== undefined) command.push('--open-id', args.openId)
      if (args.organizerOpenIds.length === 0) {
        throw new Error('yzj_calendar_event_create: organizerOpenIds must not be empty')
      }
      for (const id of args.organizerOpenIds) command.push('--meet-organizer-open-ids', id)
      if (args.description !== undefined) command.push('--description', args.description)
      if (args.roomId !== undefined) command.push('--room-id', args.roomId)
      for (const id of args.attendeeOpenIds ?? []) command.push('--attendee-open-ids', id)
      if (args.calendarId !== undefined) command.push('--calendar-id', args.calendarId)
      return runValue(ctx, budget, 'calendar event create', command, (json) => {
        const event = asRecord(json)
        const id = asString(event.id)
        return {
          content: `created 日程 "${args.title}"${id === '' ? '' : ` (${id})`}`,
          data: { record: clipJson(event, { maxChars: budget.maxMetaChars }), id },
        }
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'yzj_calendar_event_update',
    description: 'Update a calendar event; only the provided fields change.',
    parameters: {
      id: { type: 'string', required: true, description: 'Event id.' },
      openId: { type: 'string', description: 'Operating user openId (required under app-level authorization).' },
      title: { type: 'string', description: 'New title.' },
      start: { type: 'string', description: 'New start time.' },
      end: { type: 'string', description: 'New end time.' },
      description: { type: 'string', description: 'New description.' },
      roomId: { type: 'string', description: 'New room id.' },
      addAttendeeOpenIds: { type: 'array', items: { type: 'string' }, description: 'Attendees to add.' },
      removeAttendeeOpenIds: { type: 'array', items: { type: 'string' }, description: 'Attendees to remove.' },
    },
    output: yzjToolOutput,
    timeoutMs: budget.timeoutMs,
    isConcurrencySafe: () => false,
    async execute(args) {
      const command = ['calendar', 'event', 'update', '--id', args.id]
      if (args.openId !== undefined) command.push('--open-id', args.openId)
      if (args.title !== undefined) command.push('--title', args.title)
      if (args.start !== undefined) command.push('--start', args.start)
      if (args.end !== undefined) command.push('--end', args.end)
      if (args.description !== undefined) command.push('--description', args.description)
      if (args.roomId !== undefined) command.push('--room-id', args.roomId)
      for (const id of args.addAttendeeOpenIds ?? []) command.push('--add-attendee-open-ids', id)
      for (const id of args.removeAttendeeOpenIds ?? []) command.push('--remove-attendee-open-ids', id)
      return runValue(ctx, budget, 'calendar event update', command, (json) => ({
        content: `updated 日程 (${args.id})`,
        data: { payload: clipJson(json, { maxChars: budget.maxMetaChars }), id: args.id },
      }))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'yzj_calendar_event_delete',
    description: 'Cancel (soft, default) or hard-delete a calendar event. Requires user confirmation.',
    parameters: {
      id: { type: 'string', required: true, description: 'Event id.' },
      openId: { type: 'string', description: 'Operating user openId (required under app-level authorization).' },
      hard: { type: 'boolean', description: 'Hard-delete irreversibly; omit for soft cancellation.' },
    },
    output: yzjToolOutput,
    timeoutMs: budget.timeoutMs,
    isConcurrencySafe: () => false,
    async execute(args) {
      const command = ['calendar', 'event', 'delete', '--id', args.id, '--yes']
      if (args.openId !== undefined) command.push('--open-id', args.openId)
      if (args.hard === true) command.push('--hard')
      return runValue(ctx, budget, 'calendar event delete', command, () => ({
        content: `${args.hard === true ? 'hard-deleted' : 'cancelled'} 日程 (${args.id})`,
        data: { id: args.id, hard: args.hard === true },
      }))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'yzj_calendar_event_participants',
    description: 'List the participants of a calendar event.',
    parameters: {
      id: { type: 'string', required: true, description: 'Event id.' },
    },
    output: yzjToolOutput,
    timeoutMs: budget.timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args) {
      return runValue(ctx, budget, 'calendar event participants',
        ['calendar', 'event', 'participants', '--id', args.id],
        (json) => {
          const participants = asArray(json)
          const lines = participants.map((record) => {
            const p = asRecord(record)
            const name = asString(p.name ?? p.personName)
            const openId = asString(p.openId ?? p.openid)
            return name === '' ? openId : `${name}${openId === '' ? '' : ` (${openId})`}`
          })
          const content = lines.length === 0 ? '(no participants)' : lines.join('\n')
          return { content, data: { list: clipJson(participants, { maxChars: budget.maxMetaChars }) } }
        })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'yzj_calendar_room_find',
    description: 'Find free meeting rooms for a time slot within ONE day (start and end must share a date). Query only — booking happens via yzj_calendar_event_create with roomId.',
    parameters: {
      start: { type: 'string', required: true, description: 'Slot start (datetime).' },
      end: { type: 'string', required: true, description: 'Slot end (same day).' },
      openId: { type: 'string', description: 'Operating user openId (required under app-level authorization).' },
    },
    output: yzjToolOutput,
    timeoutMs: budget.timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args) {
      const command = ['calendar', 'room', 'find', '--start', args.start, '--end', args.end]
      if (args.openId !== undefined) command.push('--open-id', args.openId)
      return runValue(ctx, budget, 'calendar room find', command, (json) => {
        const rooms = asArray(json)
        const lines = rooms.map((record) => {
          const room = asRecord(record)
          const name = asString(room.name ?? room.roomName)
          const id = asString(room.id ?? room.roomId)
          return name === '' ? id : `${name}${id === '' ? '' : ` (${id})`}`
        })
        const content = lines.length === 0 ? '(no free rooms)' : lines.join('\n')
        return { content, data: { list: clipJson(rooms, { maxChars: budget.maxMetaChars }) } }
      })
    },
  }))
}
