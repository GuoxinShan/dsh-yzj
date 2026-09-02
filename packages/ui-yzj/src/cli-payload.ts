/**
 * yzj-cli 0.1.6 JSON envelope helpers (same contract as tool-yzj `shared.ts`).
 * Browser-safe: no host imports. Idempotent unwrap so 0.1.4 bare payloads
 * and 0.1.6 `{success, identity, data}` both parse.
 */

type UnknownRecord = Record<string, unknown>

const ENVELOPE_KEYS = new Set(['success', 'identity', 'data', 'error'])

function asRecord(value: unknown): UnknownRecord {
  return typeof value === 'object' && value !== null ? value as UnknownRecord : {}
}

/** Peel `{success:true, data}` down to `data`; pass through unwrapped payloads. */
export function unwrapCli(json: unknown): unknown {
  if (json === undefined || json === null) return json
  if (Array.isArray(json) || typeof json !== 'object') return json
  const rec = json as UnknownRecord
  if (rec.success === true && 'data' in rec) {
    return rec.data === undefined || rec.data === null ? {} : rec.data
  }
  if (rec.success === true && rec.identity !== undefined) {
    const extra = Object.keys(rec).filter(key => !ENVELOPE_KEYS.has(key))
    if (extra.length === 0) return rec.data ?? {}
  }
  return json
}

/** Object payload after {@link unwrapCli}; arrays become `{}`. */
export function cliRecord(value: unknown): UnknownRecord {
  const payload = unwrapCli(value)
  if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
    return payload as UnknownRecord
  }
  return {}
}

/**
 * Record array for panel RPC values: bare array, `{list}`, or leftover
 * `{data:{list}}` if the host did not unwrap.
 */
export function cliRows(value: unknown): unknown[] {
  const payload = unwrapCli(value)
  if (Array.isArray(payload)) return payload
  const rec = asRecord(payload)
  if (Array.isArray(rec.list)) return rec.list
  if (Array.isArray(rec.data)) return rec.data
  const inner = asRecord(rec.data)
  if (Array.isArray(inner.list)) return inner.list
  return []
}
