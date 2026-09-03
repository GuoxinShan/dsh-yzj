/**
 * Group-room composer chain select + @ mention mapping.
 */
import { describe, expect, it } from 'vitest'
import { resolveAtMentions, interceptAssistantAt } from '../src/client/im-compose.ts'
import { selectGroupRoomComposer } from '../src/client/room-composer.tsx'

describe('selectGroupRoomComposer', () => {
  it('claims yzj-home-* sessions', () => {
    expect(selectGroupRoomComposer({
      session: { sessionId: 'yzj-home-g-a' },
      interactions: [],
    })).toEqual({ room: true })
  })

  it('leaves topic and private sessions to the official composer', () => {
    expect(selectGroupRoomComposer({
      session: { sessionId: 'yzj-topic-g-a-root' },
      interactions: [],
    })).toBeNull()
    expect(selectGroupRoomComposer({
      session: { sessionId: 'private-1' },
      interactions: [],
    })).toBeNull()
  })

  it('yields to approval and question takeovers', () => {
    expect(selectGroupRoomComposer({
      session: { sessionId: 'yzj-home-g-a' },
      interactions: [{ kind: 'approval' }],
    })).toBeNull()
    expect(selectGroupRoomComposer({
      session: { sessionId: 'yzj-home-g-a' },
      interactions: [{ kind: 'question' }],
    })).toBeNull()
  })
})

describe('resolveAtMentions', () => {
  const speakers = [{ openId: 'u-li', name: '老黎' }, { openId: 'u-wang', name: '小王' }]

  it('maps @姓名 fragments onto speaker openIds in order', () => {
    expect(resolveAtMentions('@老黎 看一下 @小王', speakers)).toEqual({
      ok: true, atOpenIds: ['u-li', 'u-wang'], atAll: false,
    })
  })

  it('sets atAll for @all and rejects unknown names', () => {
    expect(resolveAtMentions('@all 同步一下', speakers)).toEqual({
      ok: true, atOpenIds: [], atAll: true,
    })
    expect(resolveAtMentions('@路人 你好', speakers)).toMatchObject({ ok: false })
  })
})

describe('interceptAssistantAt', () => {
  const assistants = [{ id: 'default', name: '助手' }, { id: 'research', name: '研究助手' }]

  it('does not intercept people @姓名', () => {
    expect(interceptAssistantAt('@张三 你好', assistants, true)).toEqual({ kind: 'none' })
  })

  it('rejects empty-composer @助手 (must not post to Yunzhijia)', () => {
    expect(interceptAssistantAt('@助手', assistants, true)).toEqual({ kind: 'empty' })
    expect(interceptAssistantAt('@助手   ', assistants, false)).toEqual({ kind: 'empty' })
  })

  it('rejects @助手 without a reply anchor (V1)', () => {
    expect(interceptAssistantAt('@助手 看下失败', assistants, false)).toEqual({
      kind: 'need-anchor', assistantId: 'default',
    })
  })

  it('asks the matched assistant and strips the @ token', () => {
    expect(interceptAssistantAt('@助手 看下失败', assistants, true)).toEqual({
      kind: 'ask', assistantId: 'default', text: '看下失败',
    })
    expect(interceptAssistantAt('@研究助手 帮我看', assistants, true)).toEqual({
      kind: 'ask', assistantId: 'research', text: '帮我看',
    })
  })
})
