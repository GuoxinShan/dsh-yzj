// @vitest-environment node
/**
 * Built client bundle contract: the closure artifact must register
 * `@dsh-yzj/bundle` (package name = 0.1.2 graph row id = Loader row name).
 * A mismatch boots with "loaded without registering" (see
 * docs/pitfalls/pitfall-010-loader-entry-id.md). Skips when the bundle is not
 * built (`pnpm --filter @dsh-yzj/ui-yzj bundle`).
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const BUNDLE_PATH = join(import.meta.dirname, '..', 'lib', 'client.js')
const ENTRY_ID = '@dsh-yzj/bundle'

describe('client bundle loader entry', () => {
  it('registers the package-root graph id', () => {
    if (!existsSync(BUNDLE_PATH)) return
    const bundle = readFileSync(BUNDLE_PATH, 'utf8')
    expect(bundle).toMatch(
      new RegExp(`__ModuleLoader__\\.load\\(\\{\\s*id: "${ENTRY_ID}"`),
    )
    expect(bundle).not.toContain('id: "@dsh-yzj/ui-yzj"')
    expect(bundle).not.toContain('id: "@dsh-yzj/bundle/ui-yzj"')
  })
})
