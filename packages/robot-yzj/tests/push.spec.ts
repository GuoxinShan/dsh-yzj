import { describe, expect, it } from 'vitest'
import { PushHub } from '../src/push.ts'

function makeHub() {
  const sends: { text: string; options?: Record<string, unknown> }[] = []
  const hub = new PushHub()
  hub.register('yzj-robot-s1' as never, {
    sender: {
      send: async (text, options) => {
        sends.push({ text, ...(options === undefined ? {} : { options }) })
        return { ok: true, msgId: 'p-1' }
      },
    },
    group: true,
    askerOpenId: 'u1',
    askerName: '张三',
    lastInbound: { msgId: 'in-1', summary: '原消息', personName: '张三' },
  })
  return { hub, sends }
}

function assistant(seq: number, text: string) {
  return { type: 'assistant/message', seq, data: { message: { content: [{ type: 'text', text }] } } }
}

function toolCall(seq: number) {
  return { type: 'tool/call', seq, data: {} }
}

describe('PushHub', () => {
  it('flushes accumulated assistant text on idle with the reply anchor and asker notify', async () => {
    const { hub, sends } = makeHub()
    hub.noteEvent('yzj-robot-s1', assistant(2, '你好'))
    hub.noteEvent('yzj-robot-s1', assistant(3, '世界'))
    hub.noteIdle('yzj-robot-s1')
    await Promise.resolve()
    expect(sends).toHaveLength(1)
    expect(sends[0]!.text).toBe('你好世界')
    expect(sends[0]!.options).toMatchObject({ replyMsgId: 'in-1', notifyOpenIds: ['u1'] })
  })

  it('never re-pushes below the watermark', async () => {
    const { hub, sends } = makeHub()
    hub.noteEvent('yzj-robot-s1', assistant(2, '一次'))
    hub.noteIdle('yzj-robot-s1')
    // A replayed event at or below the flushed watermark adds nothing.
    hub.noteEvent('yzj-robot-s1', assistant(2, '一次'))
    hub.noteIdle('yzj-robot-s1')
    await Promise.resolve()
    expect(sends).toHaveLength(1)
  })

  it('emits an unnotified milestone every five tool calls', async () => {
    const { hub, sends } = makeHub()
    for (let index = 1; index <= 10; index += 1) hub.noteEvent('yzj-robot-s1', toolCall(index))
    await Promise.resolve()
    expect(sends.map(send => send.text)).toEqual([
      '⏳ 进行中：已执行 5 个工具步骤…',
      '⏳ 进行中：已执行 10 个工具步骤…',
    ])
    expect(sends[0]!.options).not.toHaveProperty('notifyOpenIds')
  })

  it('pushes a bounded failure line on agent error', async () => {
    const { hub, sends } = makeHub()
    hub.noteError('yzj-robot-s1', new Error('boom'.repeat(100)))
    await Promise.resolve()
    expect(sends).toHaveLength(1)
    expect(sends[0]!.text).toContain('⚠️ 处理失败')
    expect(sends[0]!.text.length).toBeLessThanOrEqual(330)
  })

  it('ignores events for unregistered sessions', () => {
    const { hub, sends } = makeHub()
    hub.noteEvent('yzj-robot-other', assistant(2, '幽灵'))
    hub.noteIdle('yzj-robot-other')
    hub.noteError('yzj-robot-other', new Error('x'))
    expect(sends).toHaveLength(0)
  })
})
