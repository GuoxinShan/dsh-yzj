/**
 * Local SQLite IM cache (L2). The file path stays
 * `~/.dsh/storages/yzj_advance.db` (override via `YZJ_ADVANCE_DB`) so
 * existing IM L2 rows keep working after the advance/todo tables were
 * withdrawn from this public plugin.
 * @module @dsh-yzj/tool-yzj/local-store
 */

import { DatabaseSync } from 'node:sqlite'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Host-side IM cache: one row per cache_key. Payload is lossless JSON.
 * Advance items/entries and todo rows are no longer created or read here.
 */
export class YzjLocalStore {
  private readonly db: DatabaseSync

  constructor(path: string) {
    this.db = new DatabaseSync(path)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS im_cache (
        cache_key TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        fetched_at INTEGER NOT NULL
      );
    `)
  }

  cacheGet(key: string): { payload: unknown; fetchedAt: number } | undefined {
    const row = this.db.prepare('SELECT payload, fetched_at FROM im_cache WHERE cache_key = ?').get(key) as { payload: string; fetched_at: number } | undefined
    if (row === undefined) return undefined
    return { payload: JSON.parse(row.payload) as unknown, fetchedAt: row.fetched_at }
  }

  cachePut(key: string, payload: unknown, fetchedAt: number): void {
    this.db.prepare('INSERT INTO im_cache (cache_key, payload, fetched_at) VALUES (?, ?, ?) ON CONFLICT(cache_key) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at').run(key, JSON.stringify(payload), fetchedAt)
  }

  close(): void {
    this.db.close()
  }
}

let singleton: YzjLocalStore | undefined

/** Default db path: ~/.dsh/storages/yzj_advance.db (override via YZJ_ADVANCE_DB). */
export function defaultLocalDbPath(): string {
  return process.env['YZJ_ADVANCE_DB'] ?? join(homedir(), '.dsh', 'storages', 'yzj_advance.db')
}

/** Process-wide store (lazy open). Tests use resetLocalStoreForTests. */
export function localStore(): YzjLocalStore {
  if (singleton === undefined) singleton = new YzjLocalStore(defaultLocalDbPath())
  return singleton
}

/** Drop the singleton (test isolation; closes the handle). */
export function resetLocalStoreForTests(): void {
  singleton?.close()
  singleton = undefined
}
