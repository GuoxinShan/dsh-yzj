/**
 * Minimal note-file primitives for the memory vault: tolerant frontmatter
 * parsing/serialization, content revisions (short hashes), atomic writes,
 * and file-name validation. Notes are plain `--- fenced ---` Markdown with
 * string or string-list frontmatter values — the same shape the reference
 * dream-vault export uses, so human edits in any editor stay first-class.
 * @module @dsh-yzj/memory-yzj/frontmatter
 */

import { createHash, randomBytes } from 'node:crypto'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'

/** One frontmatter value: a scalar or a list of scalars. */
export type FrontmatterValue = string | string[]

/** Ordered frontmatter mapping (insertion order is preserved on serialize). */
export type Frontmatter = Record<string, FrontmatterValue>

/** One parsed note file. */
export interface Note {
  /** Frontmatter entries; empty when the file has no fence. */
  readonly frontmatter: Frontmatter
  /** Body after the closing fence, leading/trailing blank lines trimmed. */
  readonly body: string
}

/** Match one `key: value` frontmatter entry line. */
const ENTRY = /^([A-Za-z0-9_]+):\s*(.*)$/
/** Match one indented `- item` list continuation line. */
const LIST_ITEM = /^\s+-\s+(.*)$/
/** Characters a vault file name must never contain (Windows + POSIX hazards). */
const UNSAFE_NAME = /[/\\:*?"<>|\u0000-\u001f]/

/** Strip one pair of matching surrounding quotes, if present. */
function unquote(value: string): string {
  if (value.length >= 2) {
    const first = value[0]
    const last = value[value.length - 1]
    if ((first === '\'' && last === '\'') || (first === '"' && last === '"')) {
      return value.slice(1, -1)
    }
  }
  return value
}

/** Read one scalar frontmatter value as a string; undefined for lists/absence. */
export function fmString(frontmatter: Frontmatter, key: string): string | undefined {
  const value = frontmatter[key]
  return typeof value === 'string' ? value : undefined
}

/** Read one frontmatter value as a string list; scalars become singletons. */
export function fmList(frontmatter: Frontmatter, key: string): string[] {
  const value = frontmatter[key]
  if (Array.isArray(value)) return value
  if (typeof value === 'string' && value !== '') return [value]
  return []
}

/** Read one scalar as a finite number; undefined for absence or non-numbers. */
export function fmNumber(frontmatter: Frontmatter, key: string): number | undefined {
  const raw = fmString(frontmatter, key)
  if (raw === undefined || raw.trim() === '') return undefined
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : undefined
}

/** Read one scalar as a boolean; only the literal `true`/`false` count. */
export function fmBool(frontmatter: Frontmatter, key: string): boolean | undefined {
  const raw = fmString(frontmatter, key)
  if (raw === undefined) return undefined
  if (raw.trim() === 'true') return true
  if (raw.trim() === 'false') return false
  return undefined
}

/**
 * Parse a note file: an optional leading `---` fence of `key: value` entries
 * (with `  - item` list continuations), then the body. Tolerant by design —
 * human-edited files with odd quoting or unknown shapes still parse, with the
 * odd lines kept verbatim as scalars.
 */
export function parseNote(raw: string): Note {
  const lines = raw.split('\n')
  if (lines[0]?.trim() !== '---') return { frontmatter: {}, body: raw.trim() }
  let end = -1
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === '---') {
      end = i
      break
    }
  }
  if (end < 0) return { frontmatter: {}, body: raw.trim() }
  const frontmatter: Frontmatter = {}
  let currentListKey: string | undefined
  for (let i = 1; i < end; i++) {
    const line = lines[i] ?? ''
    const listMatch = LIST_ITEM.exec(line)
    if (listMatch !== null && currentListKey !== undefined) {
      const existing = frontmatter[currentListKey]
      const item = unquote(listMatch[1] ?? '').trim()
      if (Array.isArray(existing)) existing.push(item)
      else frontmatter[currentListKey] = [item]
      continue
    }
    const entry = ENTRY.exec(line)
    if (entry === null) continue
    const key = entry[1] ?? ''
    const rest = (entry[2] ?? '').trim()
    if (rest === '') {
      frontmatter[key] = []
      currentListKey = key
    } else {
      frontmatter[key] = unquote(rest)
      currentListKey = undefined
    }
  }
  // Empty list placeholders never made it past the fence; drop them so a
  // hand-written `tags:` with no items serializes back identically.
  for (const key of Object.keys(frontmatter)) {
    const value = frontmatter[key]
    if (Array.isArray(value) && value.length === 0) delete frontmatter[key]
  }
  return { frontmatter, body: lines.slice(end + 1).join('\n').trim() }
}

/** Render one frontmatter value block (`key: v` or `key:` + indented items). */
function renderEntry(key: string, value: FrontmatterValue): string {
  if (typeof value === 'string') return `${key}: ${value === '' ? "''" : value}`
  if (value.length === 0) return `${key}: []`
  return `${key}:\n${value.map(item => `  - ${item.includes(':') ? `'${item}'` : item}`).join('\n')}`
}

/** Serialize a note back to its file form (exactly one trailing newline). */
export function serializeNote(frontmatter: Frontmatter, body: string): string {
  const entries = Object.entries(frontmatter).map(([key, value]) => renderEntry(key, value))
  const fence = entries.length === 0 ? '' : `---\n${entries.join('\n')}\n---\n\n`
  return `${fence}${body.trim()}\n`
}

/** Short content revision: first 16 hex chars of the SHA-256 digest. */
export function revOf(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex').slice(0, 16)
}

/**
 * Write a file atomically (same volume): write to a unique temp sibling, then
 * rename over the target. A crash mid-write never leaves a torn note.
 */
export function atomicWrite(path: string, content: string): void {
  const tmp = `${path}.tmp-${process.pid}-${randomBytes(4).toString('hex')}`
  writeFileSync(tmp, content, 'utf8')
  renameSync(tmp, path)
}

/** Read a file as UTF-8 text, or undefined when it does not exist. */
export function readText(path: string): string | undefined {
  try {
    return readFileSync(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

/**
 * Validate one vault file name segment (section or entity name). Allows
 * letters, digits, underscore, hyphen, and CJK; rejects Windows-hazard
 * characters, control characters, leading dots, and overlong names.
 * @returns the validated name.
 * @throws a descriptive error the caller can surface per decision item.
 */
export function safeName(kind: string, name: string): string {
  const trimmed = name.trim()
  if (trimmed === '') throw new Error(`${kind} name must not be empty`)
  if (trimmed.startsWith('.') || UNSAFE_NAME.test(trimmed)) {
    throw new Error(`${kind} name ${JSON.stringify(trimmed)} contains characters not allowed in file names`)
  }
  if (trimmed.length > 80) throw new Error(`${kind} name exceeds 80 characters`)
  return trimmed
}

/** Format one local timestamp as a compact `yyyymmddHHMMss` id fragment. */
export function timestampId(now = new Date()): string {
  const pad = (n: number, width = 2): string => String(n).padStart(width, '0')
  return `${pad(now.getFullYear(), 4)}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
    + `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

/** Format one local date as `YYYY-MM-DD` (frontmatter `created` fields). */
export function dateStr(now = new Date()): string {
  const pad = (n: number, width = 2): string => String(n).padStart(width, '0')
  return `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
