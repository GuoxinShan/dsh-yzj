/**
 * Group-room P1 layout: clustering, date rules, reply chips, artifacts.
 */
import { describe, expect, it } from 'vitest'
import {
  artifactOf, dateSepLabel, dayKey, layoutRoomItems, speakerKey, topicReplyCount,
  type LayoutImEntry,
} from '../src/client/room-layout.ts'

function at(year: number, month: number, day: number, hour = 12): number {
  return new Date(year, month - 1, day, hour).getTime()
}

function im(partial: Partial<LayoutImEntry> & Pick<LayoutImEntry, 'msgId'>): LayoutImEntry {
  return {
    sentAt: at(2026, 8, 17),
    fromName: '同事',
    content: 'hi',
    origin: 'inbound',
    isSelf: false,
    ...partial,
  }
}

describe('room-layout', () => {
  const now = at(2026, 8, 17, 18)

  it('clusters the same human, not assistant with a person, and not across days', () => {
    expect(speakerKey(im({ msgId: 'a', isSelf: true }))).toBe('self')
    expect(speakerKey(im({ msgId: 'b', fromOpenId: 'u1' }))).toBe('u:u1')
    expect(speakerKey(im({ msgId: 'c', origin: 'robot-outbound' }))).toBe('bot:assistant')

    const nodes = layoutRoomItems([
      { kind: 'im', entry: im({ msgId: 'm1', fromOpenId: 'u1', sentAt: at(2026, 8, 16, 10), content: '昨一' }) },
      { kind: 'im', entry: im({ msgId: 'm2', fromOpenId: 'u1', sentAt: at(2026, 8, 16, 11), content: '昨二' }) },
      { kind: 'im', entry: im({ msgId: 'm3', fromOpenId: 'u1', sentAt: at(2026, 8, 17, 9), content: '今一' }) },
      { kind: 'im', entry: im({ msgId: 'm4', origin: 'robot-outbound', sentAt: at(2026, 8, 17, 10), content: '助手' }) },
    ], now)

    expect(nodes.filter(n => n.kind === 'sep').map(n => n.kind === 'sep' ? n.label : '')).toEqual(['昨天', '今天'])
    const ims = nodes.filter(n => n.kind === 'im')
    expect(ims.map(n => n.kind === 'im' ? `${n.entry.msgId}:${n.merged}` : '')).toEqual([
      'm1:false', 'm2:true', 'm3:false', 'm4:false',
    ])
  })

  it('labels today / yesterday / YYYY-MM-DD', () => {
    expect(dateSepLabel(now, now)).toBe('今天')
    expect(dateSepLabel(at(2026, 8, 16, 23), now)).toBe('昨天')
    expect(dateSepLabel(at(2026, 8, 15), now)).toBe('2026-08-15')
    expect(dayKey(0)).toBe('')
  })

  it('counts 1 条回复 for a fresh topic and adds tagged follow-ups', () => {
    const topic = { dshSessionId: 'yzj-topic-1', rootMsgId: 'm1' }
    const items = [
      { kind: 'im', entry: im({ msgId: 'm1', content: '根' }) },
      { kind: 'im', entry: im({ msgId: 'm2', content: '旁人' }) },
      { kind: 'im', entry: im({ msgId: 'bot', origin: 'robot-outbound', topicSessionId: 'yzj-topic-1', content: '帖' }) },
    ]
    expect(topicReplyCount(topic, items.slice(0, 1))).toBe(1)
    expect(topicReplyCount(topic, items)).toBe(2)
  })

  it('builds an artifact card only for robot-outbound files', () => {
    expect(artifactOf(im({ msgId: 't', origin: 'robot-outbound', content: '已排好' }))).toBeUndefined()
    expect(artifactOf(im({
      msgId: 'f',
      origin: 'robot-outbound',
      msgType: 'file',
      param: { name: '排期.md', ext: 'md' },
      content: '[文件] 排期.md',
    }))).toEqual({ type: 'DOC', name: '排期.md', note: '已发进群 · 点开查看' })
  })
})
