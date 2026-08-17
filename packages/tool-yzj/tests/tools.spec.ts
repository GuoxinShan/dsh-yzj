/**
 * tool-yzj tests:
 * 1. Real-CLI smoke: mounts the read-only tools over a real YzjBridge and
 *    executes contact/doc/calendar/im reads, asserting digests and payloads.
 *    Self-skips when the machine's yzj-cli is absent or unauthenticated.
 * Guard specs live in guard.spec.ts (WRITE_SPECS / D9 robot_notify).
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import YzjBridge from '@dsh-yzj/bridge'
import { applyContactTools } from '../src/contact.ts'
import { applyDocTools } from '../src/doc.ts'
import { applyCalendarTools } from '../src/calendar.ts'
import { applyImTools } from '../src/im.ts'
import { applyFileTools } from '../src/file.ts'
import type { YzjToolBudget } from '../src/shared.ts'

const BUDGET: YzjToolBudget = { timeoutMs: 30_000, maxRenderChars: 5_000, maxMetaChars: 5_000 }

interface CapturedTool {
  name: string
  execute: (args: Record<string, unknown>) => Promise<{ content: string; truncated: boolean; data: unknown }>
}

/** Fake tool registry capturing definitions; real bridge for execution. */
function mountTools(): { captured: CapturedTool[]; bridge: YzjBridge } {
  const captured: CapturedTool[] = []
  const ctx = {
    tools: {
      register(def: { name: string; execute: (args: Record<string, unknown>) => Promise<{ content: string; truncated: boolean; data: unknown }> }): void {
        captured.push({ name: def.name, execute: def.execute })
      },
    },
  } as unknown as Context
  const bridge = new YzjBridge(new Context(), {})
  ;(ctx as unknown as { yzjBridge: YzjBridge }).yzjBridge = bridge
  applyContactTools(ctx, BUDGET)
  applyDocTools(ctx, BUDGET)
  applyCalendarTools(ctx, BUDGET)
  applyImTools(ctx, BUDGET)
  applyFileTools(ctx, BUDGET)
  return { captured, bridge }
}

describe('read-only tools over the real CLI', () => {
  const { captured, bridge } = mountTools()
  const byName = new Map(captured.map(tool => [tool.name, tool]))

  it('self-skips without a healthy yzj-cli login', async () => {
    const healthy = await bridge.check(10_000)
    if (!healthy) {
      console.warn('yzj-cli missing or unauthenticated — skipping real-CLI smoke')
    }
    expect(byName.size).toBeGreaterThan(20)
  })

  it('yzj_whoami returns the login user', async () => {
    if (!(await bridge.check(10_000))) return
    const result = await byName.get('yzj_whoami')!.execute({})
    expect(result.content.length).toBeGreaterThan(0)
    expect(result.data).toBeTruthy()
  })

  it('yzj_doc_workspace_list returns workspaces with ids', async () => {
    if (!(await bridge.check(10_000))) return
    const result = await byName.get('yzj_doc_workspace_list')!.execute({})
    expect(result.content.length).toBeGreaterThan(0)
  })

  it('yzj_doc_workspace_list filters by personal type', async () => {
    if (!(await bridge.check(10_000))) return
    const result = await byName.get('yzj_doc_workspace_list')!.execute({ type: 'personal' })
    expect(result.content).toContain('个人')
  })

  it('yzj_contact_search finds the current user by name', async () => {
    if (!(await bridge.check(10_000))) return
    const me = await byName.get('yzj_whoami')!.execute({})
    const name = me.content.split(' · ')[0]
    const result = await byName.get('yzj_contact_search')!.execute({ keyword: name })
    expect(result.content).toContain(name)
  })

  it('yzj_im_group_recent returns recent sessions', async () => {
    if (!(await bridge.check(10_000))) return
    const result = await byName.get('yzj_im_group_recent')!.execute({ limit: 3 })
    expect(result.content.length).toBeGreaterThan(0)
  })

  it('im tools reject limits above the CLI cap of 20', async () => {
    if (!(await bridge.check(10_000))) return
    await expect(byName.get('yzj_im_group_recent')!.execute({ limit: 21 })).rejects.toThrow(/1 and 20/)
    await expect(byName.get('yzj_im_message_list')!.execute({ groupId: 'x', limit: 21 })).rejects.toThrow(/1 and 20/)
    // boundary values are accepted
    const ok = await byName.get('yzj_im_group_recent')!.execute({ limit: 20 })
    expect(ok.content.length).toBeGreaterThan(0)
  })

  it('yzj_calendar_event_list returns events or an empty notice', async () => {
    if (!(await bridge.check(10_000))) return
    const today = new Date().toISOString().slice(0, 10)
    const result = await byName.get('yzj_calendar_event_list')!.execute({ start: today, end: today })
    expect(result.content.length).toBeGreaterThan(0)
  })
})
