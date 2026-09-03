/**
 * Contact payload unwrap (pitfall-003: bare array / list / data / single object).
 * Shared by host whoami and the browser sender-name cache. Also peels the
 * yzj-cli 0.1.6 `{success, identity, data}` envelope (whoami is one object).
 */

import { unwrapCli } from './cli-payload.ts'

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

function identityOf(json: unknown): Record<string, unknown> {
  const envelope = asRecord(json)
  return asRecord(envelope.identity)
}

function rowsOf(json: unknown): unknown[] {
  const peeled = unwrapCli(json)
  if (Array.isArray(peeled)) return peeled
  const record = asRecord(peeled)
  if (Array.isArray(record.list)) return record.list
  if (Array.isArray(record.data)) return record.data
  if (typeof record.data === 'object' && record.data !== null) {
    const inner = asRecord(record.data)
    if (Array.isArray(inner.list)) return inner.list
    if (Object.keys(inner).length > 0) return [record.data]
  }
  return Object.keys(record).length === 0 ? [] : [peeled]
}

/** Parse `contact user get` / 0.1.6 `whoami` JSON into openId / name / photoUrl.
 * Do not assume top-level openId: peel `data` and sibling `identity`. */
export function parseContactUser(json: unknown): ContactUser {
  const identity = identityOf(json)
  const user = asRecord(rowsOf(json)[0])
  return {
    openId: firstNonEmpty(user.openId, user.oId, identity.openId, identity.oId),
    name: firstNonEmpty(user.name, user.userName, user.nickName, identity.name, identity.userName),
    photoUrl: firstNonEmpty(user.photoUrl, user.photo, user.avatar, identity.photoUrl, identity.photo, identity.avatar),
  }
}
