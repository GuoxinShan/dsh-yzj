import { describe, expect, it } from 'vitest'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { yzjWorkspacePath } from '../src/yzj-cwd.ts'

describe('yzjWorkspacePath', () => {
  it('lives under ~/.dsh-yzj/workspace, not process.cwd()', () => {
    expect(yzjWorkspacePath()).toBe(join(homedir(), '.dsh-yzj', 'workspace'))
    expect(yzjWorkspacePath()).not.toBe(process.cwd())
  })
})
