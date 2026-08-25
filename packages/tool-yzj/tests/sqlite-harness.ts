/**
 * Shared sqlite test harness (决策 54 单后端): every test drives the real
 * local-store against a FRESH temp db per test — afterEach closes the
 * singleton so the next test mints a brand-new file (no cross-test rows).
 */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach } from 'vitest'
import { resetLocalStoreForTests } from '../src/local-store.ts'

let counter = 0

/** Point YZJ_ADVANCE_DB at a fresh temp dir; reset before each test. */
export function useFreshSqlite(): void {
  const dir = mkdtempSync(join(tmpdir(), 'yzj-spec-'))
  process.env.YZJ_ADVANCE_DB = join(dir, 'spec.db')
  afterEach(() => {
    resetLocalStoreForTests()
    counter += 1
    // Next open mints spec-<n>.db within the same dir — keeps files isolated per test.
    process.env.YZJ_ADVANCE_DB = join(dir, `spec-${counter}.db`)
  })
}
