/**
 * Bound-log: dedupe, optimistic ②, backfill origin, summon window, fused merge.
 */
import { describe, expect, it } from 'vitest'
import {
  BoundLogStore, applyAppend, ackLocalEntry, failLocalEntry, formatSummonWindow,
  mergeFused, cliMessageToEntry, cliMessageList, extractSendMsgId, localMsgId,
  isPluginFollowup, latestUserSourceKind, parseSendTime,
  type YzjBoundMessageLog, type YzjLogEntry,
} from '../src/bound-log.ts'
import { homeSessionId } from '../src/home.ts'

function entry(over: Partial<YzjLogEntry> & Pick<YzjLogEntry, 'msgId'>): YzjLogEntry {
  return {
    sentAt: 1_000,
    fromOpenId: 'u1',
    fromName: '张三',
    content: 'hello',
    msgType: 'text',
    origin: 'inbound',
    isSelf: false,
    status: 'acked',
    ...over,
  }
}

function logOf(entries: YzjLogEntry[]): YzjBoundMessageLog {
  return {
    yzjConversationId: 'g-a',
    dshSessionId: homeSessionId('g-a'),
    yzjKind: 'group',
    updatedAt: 1,
    entries,
  }
}

describe('applyAppend / T8 dedupe', () => {
  it('appends a new (conversation, msgId) row', () => {
    const { entries, result } = applyAppend([], entry({ msgId: 'm1' }))
    expect(result.accepted).toBe(true)
    expect(result.reason).toBe('appended')
    expect(entries).toHaveLength(1)
  })

  it('drops a second inbound with the same msgId and keeps the first origin', () => {
    const first = applyAppend([], entry({ msgId: 'm1', origin: 'dsh-send', isSelf: true }))
    const second = applyAppend(first.entries, entry({ msgId: 'm1', origin: 'inbound', isSelf: true }))
    expect(second.result.accepted).toBe(false)
    expect(second.result.reason).toBe('echo-collapsed')
    expect(second.entries[0]?.origin).toBe('dsh-send')
  })

  it('does not use full-text equality as the default key (repeatable speech stays)', () => {
    const first = applyAppend([], entry({ msgId: 'm1', content: '收到' }))
    const second = applyAppend(first.entries, entry({ msgId: 'm2', content: '收到', sentAt: 2_000 }))
    expect(second.entries).toHaveLength(2)
  })

  it('promotes a backfill/inbound row to dsh-send when the real id returns later', () => {
    const first = applyAppend([], entry({ msgId: 'm-real', origin: 'backfill', isSelf: true, content: 'hi' }))
    const second = applyAppend(first.entries, entry({
      msgId: 'm-real', origin: 'dsh-send', isSelf: true, content: 'hi', status: 'acked',
    }))
    expect(second.result.reason).toBe('promoted-to-dsh-send')
    expect(second.entries[0]?.origin).toBe('dsh-send')
  })

  it('skips robot outbound openIds (T12)', () => {
    const { result, entries } = applyAppend([], entry({ msgId: 'bot-1', fromOpenId: 'BOT-r' }), {
      skipOpenIds: ['BOT-r'],
    })
    expect(result.reason).toBe('robot-skipped')
    expect(entries).toHaveLength(0)
  })
})

describe('optimistic local-* ack (T8)', () => {
  it('rewrites local-* to the real msgId instead of adding a second row', () => {
    const local = entry({ msgId: localMsgId(50), origin: 'dsh-send', isSelf: true, status: 'pending' })
    const acked = ackLocalEntry([local], local.msgId, 'm-real')
    expect(acked).toHaveLength(1)
    expect(acked[0]?.msgId).toBe('m-real')
    expect(acked[0]?.status).toBe('acked')
    expect(acked[0]?.origin).toBe('dsh-send')
  })

  it('collapses local-* when the real id was already backfilled', () => {
    const local = entry({ msgId: 'local-1', origin: 'dsh-send', isSelf: true, status: 'pending', content: 'hi' })
    const backfill = entry({ msgId: 'm-real', origin: 'backfill', isSelf: true, content: 'hi', sentAt: 2_000 })
    const acked = ackLocalEntry([local, backfill], 'local-1', 'm-real')
    expect(acked).toHaveLength(1)
    expect(acked[0]?.msgId).toBe('m-real')
    expect(acked[0]?.origin).toBe('dsh-send')
  })

  it('failed ② stays a failed bubble, not a user-turn', () => {
    const local = entry({ msgId: 'local-1', origin: 'dsh-send', isSelf: true, status: 'pending' })
    const failed = failLocalEntry([local], 'local-1')
    expect(failed[0]?.status).toBe('failed')
    expect(failed[0]?.origin).toBe('dsh-send')
  })
})

describe('cli projection', () => {
  it('parses a CLI list row; self in the Yunzhijia client is ① isSelf, not ②', () => {
    const row = cliMessageToEntry({
      msgId: 'm9', content: '我在客户端发的', msgType: 'text',
      sendTime: '2026-08-16 20:00:00.000', fromOpenId: 'me', fromName: '国鑫',
    }, 'inbound', 'me')
    expect(row?.origin).toBe('inbound')
    expect(row?.isSelf).toBe(true)
    expect(row?.sentAt).toBe(parseSendTime('2026-08-16 20:00:00.000'))
  })

  it('unwraps list envelopes (pitfall-003)', () => {
    expect(cliMessageList([{ msgId: 'a' }])).toHaveLength(1)
    expect(cliMessageList({ list: [{ msgId: 'b' }] })).toHaveLength(1)
    expect(cliMessageList({ data: { list: [{ msgId: 'c' }] } })).toHaveLength(1)
  })

  it('extracts send msgId from several CLI shapes', () => {
    expect(extractSendMsgId({ msgId: 'm1' })).toBe('m1')
    expect(extractSendMsgId({ data: { msgId: 'm2' } })).toBe('m2')
    expect(extractSendMsgId({ id: 'm3' })).toBe('m3')
  })
})

describe('formatSummonWindow', () => {
  it('returns empty for an empty log (do not inject an empty block)', () => {
    expect(formatSummonWindow(logOf([]), { maxMessages: 20, maxChars: 4000 })).toBe('')
  })

  it('takes the newest N acked rows, drops pending ②, excludes the summon ①', () => {
    const entries = [
      entry({ msgId: 'm1', content: '旧', sentAt: 1 }),
      entry({ msgId: 'm2', content: '中', sentAt: 2 }),
      entry({ msgId: 'm3', content: '新问句', sentAt: 3 }),
      entry({ msgId: 'local-x', origin: 'dsh-send', isSelf: true, status: 'pending', content: '未发出', sentAt: 4 }),
    ]
    const text = formatSummonWindow(logOf(entries), { maxMessages: 20, maxChars: 4000, excludeMsgId: 'm3' })
    expect(text).toContain('［本群最近消息（仅本轮上下文，非完整群档）］')
    expect(text).toContain('旧')
    expect(text).toContain('中')
    expect(text).not.toContain('新问句')
    expect(text).not.toContain('未发出')
  })

  it('marks isSelf as 我 and attaches a reply digest', () => {
    const entries = [
      entry({ msgId: 'm1', content: '原帖很长的内容会被截断', sentAt: 1 }),
      entry({ msgId: 'm2', content: '回你', isSelf: true, fromName: '国鑫', replyMsgId: 'm1', sentAt: 2 }),
    ]
    const text = formatSummonWindow(logOf(entries), { maxMessages: 20, maxChars: 4000 })
    expect(text).toContain('我: 回你')
    expect(text).toContain('回复 原帖很长的内容会被截断')
  })

  it('drops older lines to stay inside maxChars, keeping newer', () => {
    const entries = [
      entry({ msgId: 'm1', content: 'AAAA', sentAt: 1 }),
      entry({ msgId: 'm2', content: 'BBBB', sentAt: 2 }),
    ]
    const text = formatSummonWindow(logOf(entries), { maxMessages: 20, maxChars: 24 })
    expect(text).toContain('BBBB')
    expect(text).not.toContain('AAAA')
  })
})

describe('mergeFused', () => {
  it('interleaves IM and session events by time; same-ms IM first', () => {
    const items = mergeFused(
      [entry({ msgId: 'm1', sentAt: 100, content: '群消息' })],
      [
        { type: 'user/message', time: 100, data: { source: { kind: 'user' }, content: '对 Claude' } },
        { type: 'assistant/message', time: 200, data: {} },
      ],
    )
    expect(items.map(item => item.kind)).toEqual(['im', 'session', 'session'])
    expect(items[0]?.kind === 'im' && items[0].entry.content).toBe('群消息')
  })

  it('hides plugin followup ③ (summon trigger is not a second spoken line)', () => {
    const items = mergeFused(
      [entry({ msgId: 'm1', sentAt: 50 })],
      [{ type: 'user/message', time: 51, data: { source: { kind: 'plugin', plugin: 'robot-yzj' } } }],
    )
    const session = items.find(item => item.kind === 'session')
    expect(session?.kind === 'session' && session.hide).toBe(true)
  })

  it('does not hide a real DSH 发给 agent user turn', () => {
    const items = mergeFused(
      [],
      [{ type: 'user/message', time: 1, data: { source: { kind: 'user' } } }],
    )
    expect(items[0]?.kind === 'session' && items[0].hide).toBe(false)
  })

  it('sticks write-gate pending after the matching-time session event', () => {
    const items = mergeFused(
      [entry({ msgId: 'm1', sentAt: 10 })],
      [{ type: 'tool/call', time: 20, data: { name: 'yzj_im_message_send' } }],
      [{ writeId: 'w1', time: 21, toolName: 'yzj_im_message_send', status: 'pending' }],
    )
    expect(items.map(item => item.kind)).toEqual(['im', 'session', 'pending'])
  })
})

describe('latestUserSourceKind / isPluginFollowup', () => {
  it('classifies the latest user/message for the write-gate split', () => {
    expect(latestUserSourceKind([])).toBe('none')
    expect(latestUserSourceKind([
      { type: 'user/message', time: 1, data: { source: { kind: 'plugin' } } },
    ])).toBe('plugin')
    expect(latestUserSourceKind([
      { type: 'user/message', time: 1, data: { source: { kind: 'plugin' } } },
      { type: 'user/message', time: 2, data: { source: { kind: 'user' } } },
    ])).toBe('user')
    expect(isPluginFollowup({ type: 'assistant/message', time: 1, data: {} })).toBe(false)
  })
})

describe('BoundLogStore durability', () => {
  it('survives reopen against the same table (restart)', async () => {
    const table = new Map<string, YzjBoundMessageLog>()
    const facility = {
      open: async () => ({
        table: () => ({
          get: (key: string) => table.get(key),
          put: async (key: string, value: YzjBoundMessageLog) => { table.set(key, value) },
          delete: async (key: string) => table.delete(key),
          entries: () => [...table.entries()] as [string, YzjBoundMessageLog][],
        }),
      }),
    }
    const first = new BoundLogStore()
    await first.open(facility as never)
    await first.ensureHeader('g-a', 'yzj-home-g-a', 'group')
    await first.append('g-a', 'yzj-home-g-a', 'group', entry({ msgId: 'm1' }))
    const restarted = new BoundLogStore()
    await restarted.open(facility as never)
    expect(restarted.get('g-a')?.entries).toHaveLength(1)
    expect(restarted.get('g-a')?.entries[0]?.msgId).toBe('m1')
  })

  it('drops oldest rows past logRetention', async () => {
    const store = new BoundLogStore()
    store.setLimits({ logRetention: 2, backfillLimit: 50, summonWindowMessages: 20, summonWindowChars: 4000 })
    await store.ensureHeader('g-a', 'yzj-home-g-a', 'group')
    await store.append('g-a', 'yzj-home-g-a', 'group', entry({ msgId: 'm1', sentAt: 1 }))
    await store.append('g-a', 'yzj-home-g-a', 'group', entry({ msgId: 'm2', sentAt: 2 }))
    await store.append('g-a', 'yzj-home-g-a', 'group', entry({ msgId: 'm3', sentAt: 3 }))
    expect(store.get('g-a')?.entries.map(row => row.msgId)).toEqual(['m2', 'm3'])
  })
})
