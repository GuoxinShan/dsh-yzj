import { describe, expect, it, vi } from 'vitest'
import { RobotRouter } from '../src/router.ts'
import type { RobotInboundMessage } from '../src/protocol.ts'

function inbound(content: string, overrides: Partial<RobotInboundMessage> = {}): RobotInboundMessage {
  return {
    type: 2, robotId: 'BOT-r', robotName: '个人助手',
    operatorOpenid: 'u-allowed', operatorName: '单国鑫',
    time: Date.now(), msgId: `m-${Math.random().toString(36).slice(2)}`,
    content, groupType: 3, groupId: 'BOT-a-BOT-b', ...overrides,
  }
}

function minimalRouter() {
  const sendCalls: { text: string }[] = []
  const router = new RobotRouter({
    agents: {
      get: () => undefined,
      create: async () => { throw new Error('no agent') },
      resume: async () => { throw new Error('no log') },
    },
    sender: { send: async (text: string) => { sendCalls.push({ text }); return { ok: true } } },
    allowFrom: async () => ['u-allowed'],
  })
  return { router, sendCalls }
}

describe('bang commands behind @-mentions', () => {
  it.each(['!help', '!status', '!routines', '!mute', '!unmute', '!restart'])('matches %s behind an @-prefix without driving the agent', async (cmd) => {
    const { router, sendCalls } = minimalRouter()
    const followup = vi.fn()
    // @ts-expect-error test double
    router['agents'] = { get: () => undefined, create: async () => ({ agent: { followup }, dispose: async () => {} }), resume: async () => { throw new Error('x') } }
    await router.handle(inbound(`@DSH-YZJ-TEST ${cmd}`))
    expect(sendCalls).toHaveLength(1)
    expect(sendCalls[0]!.text).not.toContain('收到，处理中')
    expect(followup).not.toHaveBeenCalled()
  })

  it('still matches bare bang commands', async () => {
    const { router, sendCalls } = minimalRouter()
    await router.handle(inbound('!help'))
    expect(sendCalls[0]!.text).toContain('!mute')
  })
})
