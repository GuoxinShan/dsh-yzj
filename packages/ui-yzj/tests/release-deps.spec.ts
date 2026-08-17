/**
 * Publish contract: the installable root bundle must not depend on
 * workspace `link:` harness checkouts. Local packages keep `link:`;
 * consumers install `@dsh-yzj/bundle` whose dependencies are registry.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '../../..')

describe('bundle publish dependencies', () => {
  it('root @dsh-yzj/bundle has no link: in dependencies', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
      name: string
      dependencies: Record<string, string>
    }
    expect(pkg.name).toBe('@dsh-yzj/bundle')
    const linked = Object.entries(pkg.dependencies).filter(([, spec]) => spec.startsWith('link:'))
    expect(linked).toEqual([])
    expect(pkg.dependencies['@deepseek-ai/dsh-session']).toMatch(/^\^?0\.1\.0-rc\./)
  })
})
