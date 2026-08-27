/**
 * Bound-log: dedupe, optimistic ②, backfill origin, summon window, fused merge.
 */
import { describe, expect, it } from 'vitest'
import {
  BoundLogStore, applyAppend, ackLocalEntry, failLocalEntry, formatSummonWindow, threadEntries,
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

  it('skips robot outbound openIds when skipOpenIds is passed (inbound echo)', () => {
    const { result, entries } = applyAppend([], entry({ msgId: 'bot-1', fromOpenId: 'BOT-r' }), {
      skipOpenIds: ['BOT-r'],
    })
    expect(result.reason).toBe('robot-skipped')
    expect(entries).toHaveLength(0)
  })

  it('promotes a backfill row to robot-outbound (R9)', () => {
    const first = applyAppend([], entry({ msgId: 'bot-1', fromOpenId: 'BOT-r', origin: 'backfill', content: 'ack' }))
    const second = applyAppend(first.entries, {
      ...entry({ msgId: 'bot-1', fromOpenId: 'BOT-r', origin: 'robot-outbound', fromName: '助手', content: 'ack' }),
      topicSessionId: 'yzj-topic-g-a-root',
    })
    expect(second.result.reason).toBe('promoted-to-robot-outbound')
    expect(second.entries[0]?.origin).toBe('robot-outbound')
    expect(second.entries[0]?.topicSessionId).toBe('yzj-topic-g-a-root')
  })

  it('collapses a later backfill of a robot-outbound post', () => {
    const first = applyAppend([], entry({ msgId: 'bot-1', origin: 'robot-outbound', fromName: '助手' }))
    const second = applyAppend(first.entries, entry({ msgId: 'bot-1', origin: 'backfill', fromOpenId: 'BOT-r' }))
    expect(second.result.reason).toBe('echo-collapsed')
    expect(second.entries[0]?.origin).toBe('robot-outbound')
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
      sendTime: '2026-08-16 20:00:00.000', fromOpenId: 'me', fromName: '测试用户',
    }, 'inbound', 'me')
    expect(row?.origin).toBe('inbound')
    expect(row?.isSelf).toBe(true)
    expect(row?.sentAt).toBe(parseSendTime('2026-08-16 20:00:00.000'))
  })

  it('keeps CLI param so the fused IM renderer can show files and quotes', () => {
    const row = cliMessageToEntry({
      msgId: 'f1', content: '', msgType: 'file',
      param: { file_id: 'fid', name: 'a.pdf', size: 12, replyMsgId: 'm0' },
      fromOpenId: 'u',
    }, 'backfill', '')
    expect(row?.msgType).toBe('file')
    expect(row?.param?.file_id).toBe('fid')
    expect(row?.param?.name).toBe('a.pdf')
    expect(row?.replyMsgId).toBe('m0')
  })

  it('omits param when the CLI row has none (old blobs still parse)', () => {
    const row = cliMessageToEntry({
      msgId: 'm9', content: '纯文本', msgType: 'text', fromOpenId: 'u',
    }, 'inbound', '')
    expect(row?.param).toBeUndefined()
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

  it('reads fromUser.openId / oId / name when top-level fields are empty', () => {
    const row = cliMessageToEntry({
      msgId: 'm-u', content: 'hi', msgType: 'text',
      sendTime: '2026-08-16 20:00:00.000',
      fromUser: { openId: 'u-nested', name: '老黎' },
    }, 'backfill', 'me')
    expect(row?.fromOpenId).toBe('u-nested')
    expect(row?.fromName).toBe('老黎')
  })

  it('prefers fromUser.oId when openId is missing', () => {
    const row = cliMessageToEntry({
      msgId: 'm-o', content: 'hi', fromUser: { oId: 'oid-1', userName: '小王' },
    }, 'inbound', 'me')
    expect(row?.fromOpenId).toBe('oid-1')
    expect(row?.fromName).toBe('小王')
  })
})

describe('applyAppend param enrich', () => {
  it('fills param onto an existing digest-only row', () => {
    const first = applyAppend([], entry({ msgId: 'm1', content: '[图片]' }))
    const second = applyAppend(first.entries, entry({
      msgId: 'm1',
      content: '[图片]',
      msgType: 'file',
      param: { file_id: 'fid-1', name: 'shot.png' },
    }))
    expect(second.result.reason).toBe('enriched')
    expect(second.entries[0]?.param).toEqual({ file_id: 'fid-1', name: 'shot.png' })
    expect(second.entries[0]?.msgType).toBe('file')
  })

  it('fills empty openId and fromName on a collision without changing origin', () => {
    const first = applyAppend([], entry({ msgId: 'm1', fromOpenId: '', fromName: '', content: 'hi' }))
    const second = applyAppend(first.entries, entry({
      msgId: 'm1', fromOpenId: 'u2', fromName: '老黎', content: 'hi',
    }))
    expect(second.result.reason).toBe('enriched')
    expect(second.entries[0]?.fromOpenId).toBe('u2')
    expect(second.entries[0]?.fromName).toBe('老黎')
    expect(second.entries[0]?.origin).toBe('inbound')
  })
})

describe('formatSummonWindow', () => {
  it('returns empty when there is no groupId and no rows', () => {
    expect(formatSummonWindow(undefined, { maxMessages: 20, maxChars: 4000 })).toBe('')
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
      entry({ msgId: 'm2', content: '回你', isSelf: true, fromName: '测试用户', replyMsgId: 'm1', sentAt: 2 }),
    ]
    const text = formatSummonWindow(logOf(entries), { maxMessages: 20, maxChars: 4000 })
    expect(text).toContain('我 msgId=m2: 回你')
    expect(text).toContain('回复 msgId=m1 原帖很长的内容会被截断')
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

  it('pins groupId and per-line msgId so the model can send or reply', () => {
    const text = formatSummonWindow(logOf([
      entry({ msgId: 'm-root', content: '帮我整理', fromName: '老黎', sentAt: 1 }),
    ]), {
      maxMessages: 20,
      maxChars: 4000,
      topic: { title: '整理接口清单', rootMsgId: 'm-root', originWho: '老黎', originText: '帮我整理' },
    })
    expect(text).toContain('groupId: g-a')
    expect(text).toContain('yzj_im_message_send')
    expect(text).toContain('话题: 整理接口清单')
    expect(text).toContain('锚点 msgId: m-root')
    expect(text).toContain('老黎 msgId=m-root: 帮我整理')
  })

  it('still injects groupId when the log is empty', () => {
    const text = formatSummonWindow(undefined, { maxMessages: 20, maxChars: 4000, groupId: 'g-empty' })
    expect(text).toContain('groupId: g-empty')
    expect(text).toContain('yzj_im_message_send')
  })

  it('prints MM-DD HH:mm so a cross-day window stays chronological', () => {
    const earlier = new Date(2026, 7, 17, 16, 55).getTime()
    const later = new Date(2026, 7, 18, 10, 50).getTime()
    const text = formatSummonWindow(logOf([
      entry({ msgId: 'm-old', content: '昨晚', sentAt: earlier }),
      entry({ msgId: 'm-new', content: '今早', sentAt: later }),
    ]), { maxMessages: 20, maxChars: 4000 })
    const oldAt = text.indexOf('昨晚')
    const newAt = text.indexOf('今早')
    expect(oldAt).toBeGreaterThan(-1)
    expect(newAt).toBeGreaterThan(oldAt)
    expect(text).toMatch(/\[08-17 \d{2}:\d{2}\] 张三 msgId=m-old: 昨晚/)
    expect(text).toMatch(/\[08-18 \d{2}:\d{2}\] 张三 msgId=m-new: 今早/)
  })

  it('for a topic root, keeps the reply chain and drops unrelated group rows', () => {
    const entries = [
      entry({ msgId: 'noise', content: '你好', sentAt: 1 }),
      entry({ msgId: 'proto', content: '[文件]:原型.html', sentAt: 2 }),
      entry({ msgId: 'prd', content: 'PRD供参考', replyMsgId: 'proto', sentAt: 3 }),
      entry({ msgId: 'review', content: '明天评审一下', replyMsgId: 'prd', sentAt: 4 }),
      entry({ msgId: 'other', content: '竞争力报告', sentAt: 5 }),
    ]
    expect(threadEntries(entries, 'review').map(row => row.msgId)).toEqual(['proto', 'prd', 'review'])
    const text = formatSummonWindow(logOf(entries), {
      maxMessages: 20,
      maxChars: 4000,
      topic: { title: '明天评审一下', rootMsgId: 'review', originWho: '同事乙', originText: '明天评审一下' },
    })
    expect(text).toContain('明天评审一下')
    expect(text).toContain('PRD供参考')
    expect(text).not.toContain('你好')
    expect(text).not.toContain('竞争力报告')
  })

  it('prints fileId= from param.file_id on file rows and the topic anchor', () => {
    const text = formatSummonWindow(logOf([
      entry({
        msgId: 'm-file',
        content: '[文件]:报告.md',
        msgType: 'file',
        fromName: '代少兵',
        param: { file_id: 'fid-abc', name: '报告.md', size: 34047 },
        sentAt: 2,
      }),
    ]), {
      maxMessages: 20,
      maxChars: 4000,
      topic: { title: '看报告', rootMsgId: 'm-file', originWho: '代少兵', originText: '[文件]:报告.md' },
    })
    expect(text).toContain('msgId=m-file: [文件]:报告.md fileId=fid-abc size=34047')
    expect(text).toContain('锚：代少兵：[文件]:报告.md fileId=fid-abc size=34047')
    expect(text).not.toMatch(/fileId=m-file/)
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

  it('does not hide a real DSH 发给助手 user turn', () => {
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
