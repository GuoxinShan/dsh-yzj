import { describe, expect, it, vi } from 'vitest'
import { YzjChatnode } from '../src/chatnode.ts'
import { Context } from '@deepseek-ai/cordis'

function fakeRobot() {
  const notify = vi.fn(async (text: string) => ({ ok: true, msgId: `m-${text.length}` }))
  return { notify, face: { notify } }
}

function mount(robot: { notify: (text: string, index?: number) => Promise<{ ok: boolean; msgId?: string; error?: string }> }, robotIndex = 1) {
  const ctx = new Context()
  return { ctx, node: new YzjChatnode(ctx, robot, robotIndex) }
}

describe('YzjChatnode', () => {
  it('provides the chatnode service on the context', async () => {
    const robot = fakeRobot()
    const { ctx, node } = mount(robot.face)
    expect(typeof ctx.chatnode?.send).toBe('function')
    await ctx.chatnode!.send({ text: 'probe' })
    expect(robot.notify).toHaveBeenCalledTimes(1)
    expect(node).toBeInstanceOf(YzjChatnode)
  })

  it('sends a digest with the title prefixed to the configured channel', async () => {
    const robot = fakeRobot()
    const { node } = mount(robot.face, 1)
    await node.send({ title: 'dsh-routines: nightly-tests', text: '[completed] nightly-tests\n\n3 failed of 412' })
    expect(robot.notify).toHaveBeenCalledTimes(1)
    expect(robot.notify.mock.calls[0]![0]).toBe('dsh-routines: nightly-tests\n\n[completed] nightly-tests\n\n3 failed of 412')
    expect(robot.notify.mock.calls[0]![1]).toBe(1)
  })

  it('sends a bare text without a title', async () => {
    const robot = fakeRobot()
    const { node } = mount(robot.face, 0)
    await node.send({ text: 'hi' })
    expect(robot.notify.mock.calls[0]![0]).toBe('hi')
    expect(robot.notify.mock.calls[0]![1]).toBe(0)
  })

  it('surfaces a failed push as a throw (the scheduler records it, never crashes)', async () => {
    const robot = { notify: async () => ({ ok: false, error: 'no connected robot channel' }) }
    const { node } = mount(robot)
    await expect(node.send({ text: 'x' })).rejects.toThrow(/no connected robot channel/)
  })
})
