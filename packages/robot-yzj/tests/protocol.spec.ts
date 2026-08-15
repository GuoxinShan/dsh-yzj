import { describe, expect, it } from 'vitest'
import { classifyFrame, deriveWebSocketUrl, InboundDedupe, parseReplyMeta } from '../src/protocol.ts'

describe('deriveWebSocketUrl', () => {
  it('derives the measured wss shape from a sendMsgUrl', () => {
    expect(deriveWebSocketUrl('https://www.yunzhijia.com/gateway/robot/webhook/send?yzjtype=0&yzjtoken=abc'))
      .toBe('wss://www.yunzhijia.com/xuntong/websocket?yzjtoken=abc')
  })

  it('rejects a url without yzjtoken', () => {
    expect(() => deriveWebSocketUrl('https://www.yunzhijia.com/gateway/robot/webhook/send?yzjtype=0'))
      .toThrow(/yzjtoken/)
  })
})

describe('classifyFrame', () => {
  it('classifies the measured auth and pong control frames', () => {
    expect(classifyFrame('{"success":true,"cmd":"auth"}')).toEqual({ kind: 'auth' })
    expect(classifyFrame('{"cmd":"pong"}')).toEqual({ kind: 'pong' })
  })

  it('classifies the sync signal frame', () => {
    expect(classifyFrame('{"cmd":"message","lastUpdateTime":"2026-08-16 04:13:46"}'))
      .toEqual({ kind: 'sync', lastUpdateTime: '2026-08-16 04:13:46' })
  })

  it('classifies one measured robot message with its reply chain', () => {
    const raw = JSON.stringify({
      msg: {
        eid: '10109', groupType: 3, clientId: '10203', msgType: 2,
        robotName: '个人助手', openId: '64a7', groupId: 'BOT-a-BOT-b',
        msgId: '6a80c87ae4b00a133ed87f54',
        msgParam: JSON.stringify({
          replyMsgId: '6a80c81ce4b0ab2391c26127', replyPersonId: '64a7',
          replyPersonName: '单国鑫', replyRootMsgId: '6a80c81ce4b0ab2391c26127',
          replySummary: '测试入站2**',
        }),
        robotId: 'BOT-69ccc7abe4b0298ccdfc1c91', type: 2,
        operatorName: '单国鑫', content: '1', operatorOpenid: '64a7',
        time: 1786824826346,
      },
      level: 0, cmd: 'directPush', type: 'robotMessage',
    })
    const frame = classifyFrame(raw)
    expect(frame.kind).toBe('robot-message')
    if (frame.kind !== 'robot-message') return
    expect(frame.message.msgId).toBe('6a80c87ae4b00a133ed87f54')
    expect(frame.message.groupId).toBe('BOT-a-BOT-b')
    expect(frame.reply?.replyRootMsgId).toBe('6a80c81ce4b0ab2391c26127')
  })

  it('keeps unrecognized payloads as other', () => {
    expect(classifyFrame('not json').kind).toBe('other')
    expect(classifyFrame('{"cmd":"brand-new"}').kind).toBe('other')
  })
})

describe('parseReplyMeta', () => {
  it('falls back to replyMsgId when the root is absent', () => {
    const meta = parseReplyMeta(JSON.stringify({ replyMsgId: 'm1' }))
    expect(meta.reply?.replyRootMsgId).toBe('m1')
  })

  it('returns nothing for missing or malformed params', () => {
    expect(parseReplyMeta(undefined).reply).toBeUndefined()
    expect(parseReplyMeta('{broken').reply).toBeUndefined()
    expect(parseReplyMeta('{"other":1}').reply).toBeUndefined()
  })
})

describe('InboundDedupe', () => {
  it('admits the first sighting and drops the duplicate', () => {
    const dedupe = new InboundDedupe()
    expect(dedupe.markSeen('m1')).toBe(true)
    expect(dedupe.markSeen('m1')).toBe(false)
  })

  it('never dedupes empty ids', () => {
    const dedupe = new InboundDedupe()
    expect(dedupe.markSeen('')).toBe(true)
    expect(dedupe.markSeen('')).toBe(true)
  })

  it('expires entries after the ttl', () => {
    const dedupe = new InboundDedupe()
    dedupe.markSeen('m1', -1)
    expect(dedupe.markSeen('m1')).toBe(true)
  })
})
