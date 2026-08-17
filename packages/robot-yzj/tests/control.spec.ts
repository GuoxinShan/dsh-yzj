/**
 * robot_* control tools: leftover yzj-robot-* still refuse at execute
 * (no self-driving). Bound homes are allowed through execute — D9 confirm
 * is the WRITE_SPECS / write-gate path, not this throw.
 */
import { describe, expect, it, vi } from 'vitest'
import { applyRobotControlTools } from '../src/control.ts'
import type { YzjRobot } from '../src/index.ts'

interface Captured {
  name: string
  execute: (args: Record<string, unknown>, exec: { agent?: { session: { id: string } } }) => Promise<unknown>
}

function mount(robot: Partial<YzjRobot>): Map<string, Captured> {
  const captured: Captured[] = []
  const ctx = {
    tools: {
      register(def: Captured): void {
        captured.push(def)
      },
    },
  }
  applyRobotControlTools(ctx as never, robot as YzjRobot)
  return new Map(captured.map(tool => [tool.name, tool]))
}

function execOf(sessionId: string): { agent: { session: { id: string } } } {
  return { agent: { session: { id: sessionId } } }
}

describe('robot_* operatorOnly (execute-time residual gate)', () => {
  it('refuses robot_notify / robot_continue / robot_status / robot_fork on leftover yzj-robot-*', async () => {
    const byName = mount({
      notify: vi.fn(),
      continueConversation: vi.fn(),
      forkSession: vi.fn(),
      statuses: vi.fn(() => []),
    })
    for (const name of ['robot_notify', 'robot_continue', 'robot_status', 'robot_fork'] as const) {
      const tool = byName.get(name)
      expect(tool, name).toBeDefined()
      await expect(tool!.execute({ text: 'x', sessionId: 'yzj-robot-old' }, execOf('yzj-robot-old'))).rejects.toThrow(/仅限操作者会话/)
    }
  })

  it('runs robot_notify on a bound yzj-home-* after the confirm path (execute is not the gate)', async () => {
    const notify = vi.fn(async () => ({ ok: true, msgId: 'm1' }))
    const byName = mount({ notify })
    const result = await byName.get('robot_notify')!.execute({ text: '推群' }, execOf('yzj-home-g-a'))
    expect(notify).toHaveBeenCalledWith('推群', 0)
    expect(result).toMatchObject({ truncated: false, data: { ok: true, msgId: 'm1' } })
  })

  it('runs robot_notify on the unbound operator console without this throw', async () => {
    const notify = vi.fn(async () => ({ ok: true }))
    const byName = mount({ notify })
    await byName.get('robot_notify')!.execute({ text: 'digest' }, execOf('sess-private'))
    expect(notify).toHaveBeenCalledOnce()
  })
})
