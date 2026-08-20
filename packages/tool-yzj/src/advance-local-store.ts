/**
 * Local SQLite backend for the AI推进 two-table model (v1.8 storage switch).
 * The cloud 多维表格 backend proved unreliable (intermittent 500s on the
 * record service); the advance board now persists to a local SQLite file
 * via node:sqlite (zero cloud dependency). The todo family stays on dbt.
 *
 * Rows keep the same 中文 field keys as the dbt schema (ITEM_F / ENTRY_F)
 * so the core's row→structure mapping is shared by both backends.
 * @module @dsh-yzj/tool-yzj/advance-local-store
 */

import { DatabaseSync } from 'node:sqlite'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** One raw row: dbt-shaped fields bag plus the row id (record id). */
export interface LocalRawRow {
  readonly recordId: string
  readonly fields: Record<string, unknown>
}

/**
 * Two-table local store: items keyed by advance_id, entries keyed by
 * entry_id. `fields` is stored as lossless JSON (中文 keys).
 */
export class AdvanceLocalStore {
  private readonly db: DatabaseSync

  constructor(path: string) {
    this.db = new DatabaseSync(path)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS items (
        advance_id TEXT PRIMARY KEY,
        fields TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS entries (
        entry_id TEXT PRIMARY KEY,
        advance_id TEXT NOT NULL,
        fields TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_entries_advance ON entries (advance_id);
    `)
  }

  /** All item rows (insertion order not guaranteed; core sorts by created). */
  listItems(): LocalRawRow[] {
    const rows = this.db.prepare('SELECT advance_id, fields FROM items').all() as { advance_id: string; fields: string }[]
    return rows.map(row => ({ recordId: row.advance_id, fields: JSON.parse(row.fields) as Record<string, unknown> }))
  }

  item(advanceId: string): LocalRawRow | undefined {
    const row = this.db.prepare('SELECT advance_id, fields FROM items WHERE advance_id = ?').get(advanceId) as { advance_id: string; fields: string } | undefined
    if (row === undefined) return undefined
    return { recordId: row.advance_id, fields: JSON.parse(row.fields) as Record<string, unknown> }
  }

  /** Insert one item row; duplicate advance_id throws (core prevents). */
  createItem(fields: Record<string, unknown>): void {
    const advanceId = String(fields['advance_id'] ?? '')
    this.db.prepare('INSERT INTO items (advance_id, fields) VALUES (?, ?)').run(advanceId, JSON.stringify(fields))
  }

  /** Merge-update one item row's fields (projection refold). */
  updateItem(advanceId: string, patch: Record<string, unknown>): void {
    const current = this.item(advanceId)
    const next = { ...(current?.fields ?? {}), ...patch }
    this.db.prepare('INSERT INTO items (advance_id, fields) VALUES (?, ?) ON CONFLICT(advance_id) DO UPDATE SET fields = excluded.fields').run(advanceId, JSON.stringify(next))
  }

  /** One item's entries in insertion order (rowid order). */
  listEntries(advanceId: string): LocalRawRow[] {
    const rows = this.db.prepare('SELECT entry_id, fields FROM entries WHERE advance_id = ? ORDER BY rowid').all(advanceId) as { entry_id: string; fields: string }[]
    return rows.map(row => ({ recordId: row.entry_id, fields: JSON.parse(row.fields) as Record<string, unknown> }))
  }

  /** Append one entry row (append-only; entry_id unique). */
  createEntry(fields: Record<string, unknown>): void {
    const entryId = String(fields['entry_id'] ?? '')
    const advanceId = String(fields['advance_id'] ?? '')
    this.db.prepare('INSERT INTO entries (entry_id, advance_id, fields) VALUES (?, ?, ?)').run(entryId, advanceId, JSON.stringify(fields))
  }

  /** Every entry_id (for day-sequential id generation). */
  listAllEntryIds(): string[] {
    const rows = this.db.prepare('SELECT entry_id FROM entries').all() as { entry_id: string }[]
    return rows.map(row => row.entry_id)
  }

  close(): void {
    this.db.close()
  }
}

let singleton: AdvanceLocalStore | undefined

/** Default db path: ~/.dsh/storages/yzj_advance.db (override via YZJ_ADVANCE_DB). */
export function defaultLocalDbPath(): string {
  return process.env['YZJ_ADVANCE_DB'] ?? join(homedir(), '.dsh', 'storages', 'yzj_advance.db')
}

/** Process-wide store (lazy open). Tests use resetLocalStoreForTests. */
export function localAdvanceStore(): AdvanceLocalStore {
  if (singleton === undefined) singleton = new AdvanceLocalStore(defaultLocalDbPath())
  return singleton
}

/** Drop the singleton (test isolation; closes the handle). */
export function resetLocalStoreForTests(): void {
  singleton?.close()
  singleton = undefined
}
