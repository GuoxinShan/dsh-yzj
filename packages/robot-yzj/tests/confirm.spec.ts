import { describe, expect, it, vi } from 'vitest'
import { ConfirmBroker, type ConfirmContext } from '../src/confirm.ts'
import type { RobotInboundMessage } from '../src/protocol.ts'

function inbound(content: string, overrides: Partial<RobotInboundMessage> = {}): RobotInboundMessage {
  return {
    type: 2, robotId: 'BOT-r', robotName: '个人助手',
    operatorOpenid: 'u-allowed', operatorName: '测试用户',
    time: Date.now(), msgId: `m-${Math.random().toString(36).slice(2)}`,
    content, groupType: 3, groupId: 'g-1', ...overrides,
  }
}

function makeContext(sends: string[], cards: string[] = []): ConfirmContext {
  return {
    robotId: 'BOT-r',
    group: true,
    groupId: 'g-1',
    askerOpenId: 'u-allowed',
    askerName: '测试用户',
    sender: {
      send: async (text: string) => {
        sends.push(text)
        return { ok: true, msgId: 'out-1' }
      },
      sendCard: async (card: { title: string }) => {
        cards.push(card.title)
        return { ok: true, msgId: 'out-card-1' }
      },
    },
  }
}

function fakeTimers() {
  const fired: (() => void)[] = []
  return {
    fired,
    setTimeout: (handler: () => void, _ms: number) => { fired.push(handler); return fired.length - 1 },
    clearTimeout: () => {},
  }
}

describe('ConfirmBroker', () => {
  it('pushes a numbered suggestion and resolves on 确认 N', async () => {
    const sends: string[] = []
    const cards: string[] = []
    const broker = new ConfirmBroker({ timers: fakeTimers() })
    broker.registerSession('yzj-robot-x' as never, makeContext(sends, cards))
    const next = vi.fn(async () => 'unavailable' as const)
    const settled = broker.handleApproval({
      agent: { session: { id: 'yzj-robot-x', events: [] } },
      toolName: 'yzj_im_message_send',
      callId: 'c1',
    }, next)
    await Promise.resolve()
    expect(next).not.toHaveBeenCalled()
    expect(cards[0]).toContain('[1]')
    expect(cards[0]).toContain('写操作待确认')
    expect(broker.checkReply(inbound('确认 1'))).toBe(true)
    await expect(settled).resolves.toBe('allowed-once')
    expect(cards.at(-1)).toContain('已确认')
  })

  it('resolves rejected on 取消 N and pushes the notice', async () => {
    const sends: string[] = []
    const cards: string[] = []
    const broker = new ConfirmBroker({ timers: fakeTimers() })
    broker.registerSession('yzj-robot-x' as never, makeContext(sends, cards))
    const settled = broker.handleApproval({
      agent: { session: { id: 'yzj-robot-x', events: [] } },
      toolName: 'yzj_doc_delete',
      callId: 'c2',
    }, vi.fn(async () => 'unavailable' as const))
    await Promise.resolve()
    expect(cards[0]).toContain('写操作待确认 [1]')
    expect(broker.checkReply(inbound('取消 1'))).toBe(true)
    await expect(settled).resolves.toBe('rejected')
    expect(cards.at(-1)).toContain('已取消')
  })

  it('ignores replies from a different conversation', async () => {
    const sends: string[] = []
    const cards: string[] = []
    const broker = new ConfirmBroker({ timers: fakeTimers() })
    broker.registerSession('yzj-robot-x' as never, makeContext(sends, cards))
    const settled = broker.handleApproval({
      agent: { session: { id: 'yzj-robot-x', events: [] } },
      toolName: 'yzj_im_message_send',
      callId: 'c3',
    }, vi.fn(async () => 'unavailable' as const))
    await Promise.resolve()
    expect(broker.checkReply(inbound('确认 1', { groupId: 'other-group' }))).toBe(false)
    expect(broker.checkReply(inbound('确认 1'))).toBe(true)
    await expect(settled).resolves.toBe('allowed-once')
  })

  it('matches a confirmation behind an @-mention prefix (group surfaces)', async () => {
    const sends: string[] = []
    const cards: string[] = []
    const broker = new ConfirmBroker({ timers: fakeTimers() })
    broker.registerSession('yzj-robot-x' as never, makeContext(sends, cards))
    const settled = broker.handleApproval({
      agent: { session: { id: 'yzj-robot-x', events: [] } },
      toolName: 'yzj_doc_create',
      callId: 'c5',
    }, vi.fn(async () => 'unavailable' as const))
    await Promise.resolve()
    expect(broker.checkReply(inbound('@DSH-YZJ-TEST 确认 1'))).toBe(true)
    await expect(settled).resolves.toBe('allowed-once')
    expect(cards.at(-1)).toContain('已确认')
  })

  it('times out to cancelled and disposes open cards', async () => {
    const sends: string[] = []
    const cards: string[] = []
    const timers = fakeTimers()
    const broker = new ConfirmBroker({ timers, timeoutMs: 1000 })
    broker.registerSession('yzj-robot-x' as never, makeContext(sends, cards))
    const settled = broker.handleApproval({
      agent: { session: { id: 'yzj-robot-x', events: [] } },
      toolName: 'yzj_im_message_send',
      callId: 'c4',
    }, vi.fn(async () => 'unavailable' as const))
    await Promise.resolve()
    timers.fired[0]!()
    await expect(settled).resolves.toBe('cancelled')
    expect(cards.at(-1)).toContain('超时失效')
  })

  it('delegates sessions that are not inbound-registered to next', async () => {
    const broker = new ConfirmBroker({ timers: fakeTimers() })
    const next = vi.fn(async () => 'unavailable' as const)
    const result = await broker.handleApproval({
      agent: { session: { id: 'gui-session-1', events: [] } },
      toolName: 'yzj_im_message_send',
    }, next)
    expect(next).toHaveBeenCalledOnce()
    expect(result).toBe('unavailable')
  })

  it('owns a registered yzj-home-* inbound session and skips unregistered homes', async () => {
    const broker = new ConfirmBroker({ timers: fakeTimers() })
    const sends: string[] = []
    broker.registerSession('yzj-home-g-a' as never, makeContext(sends))
    expect(broker.ownsSession('yzj-home-g-a')).toBe(true)
    expect(broker.ownsSession('yzj-home-g-b')).toBe(false)
    const next = vi.fn(async () => 'unavailable' as const)
    void broker.handleApproval({
      agent: { session: { id: 'yzj-home-g-a', events: [] } },
      toolName: 'yzj_im_message_send',
      callId: 'c-home',
    }, next)
    await Promise.resolve()
    expect(next).not.toHaveBeenCalled()
    const skipped = await broker.handleApproval({
      agent: { session: { id: 'yzj-home-g-b', events: [] } },
      toolName: 'yzj_im_message_send',
    }, next)
    expect(skipped).toBe('unavailable')
  })
})
