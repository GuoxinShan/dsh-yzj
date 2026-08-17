/**
 * Contact payload unwrap (pitfall-003: bare array / list / data / single object).
 * Shared by host whoami and the browser sender-name cache.
 */

/** One directory user projected for display. */
export interface ContactUser {
  readonly openId: string
  readonly name: string
  readonly photoUrl: string
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value !== '') return value
  }
  return ''
}

function rowsOf(json: unknown): unknown[] {
  if (Array.isArray(json)) return json
  const record = asRecord(json)
  if (Array.isArray(record.list)) return record.list
  if (Array.isArray(record.data)) return record.data
  if (typeof record.data === 'object' && record.data !== null) {
    const inner = asRecord(record.data)
    if (Array.isArray(inner.list)) return inner.list
  }
  return Object.keys(record).length === 0 ? [] : [json]
}

/** Parse `contact user get` JSON into openId / name / photoUrl. */
export function parseContactUser(json: unknown): ContactUser {
  const user = asRecord(rowsOf(json)[0])
  return {
    openId: firstNonEmpty(user.openId, user.oId),
    name: firstNonEmpty(user.name, user.userName, user.nickName),
    photoUrl: firstNonEmpty(user.photoUrl, user.photo, user.avatar),
  }
}
