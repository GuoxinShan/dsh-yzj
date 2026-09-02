/**
 * D8 digest: default ticks a visible summary; full migrate is explicit.
 */
import { describe, expect, it } from 'vitest'
import {
  composeHandoffDigest, defaultSelectedIds, digestCandidates, textOfSessionEvent,
} from '../src/handoff-digest.ts'

describe('digestCandidates', () => {
  it('drops plugin followups and empty assistant chunks', () => {
    const rows = digestCandidates([
      { type: 'user/message', time: 1, data: { source: { kind: 'plugin' }, content: [{ type: 'text', text: '扳机' }] } },
      { type: 'user/message', time: 2, data: { source: { kind: 'user' }, content: [{ type: 'text', text: '私密结论' }] } },
      { type: 'assistant/message', time: 3, data: { content: [{ type: 'text', text: '建议发周报' }] } },
      { type: 'tool/call', time: 4, data: { name: 'yzj_im_message_send' } },
    ])
    expect(rows.map(row => row.text)).toEqual(['私密结论', '建议发周报'])
    expect(textOfSessionEvent({ type: 'user/message', data: { source: { kind: 'plugin' }, content: 'x' } })).toBe('')
    expect(textOfSessionEvent({
      type: 'assistant/message',
      data: { message: { content: '写好了' } },
    })).toBe('写好了')
  })

  it('defaults to the newest few lines, not the whole transcript', () => {
    const candidates = digestCandidates([
      { type: 'user/message', time: 1, data: { source: { kind: 'user' }, content: '旧1' } },
      { type: 'user/message', time: 2, data: { source: { kind: 'user' }, content: '旧2' } },
      { type: 'user/message', time: 3, data: { source: { kind: 'user' }, content: '旧3' } },
      { type: 'assistant/message', time: 4, data: { content: '新结论' } },
    ])
    expect(defaultSelectedIds(candidates, 2)).toEqual(['e2', 'e3'])
    const digest = composeHandoffDigest(candidates, defaultSelectedIds(candidates, 2), false)
    expect(digest).toContain('［私密会话摘要（用户勾选）］')
    expect(digest).toContain('新结论')
    expect(digest).not.toContain('旧1')
  })

  it('full migrate is explicit and labelled', () => {
    const candidates = digestCandidates([
      { type: 'user/message', time: 1, data: { source: { kind: 'user' }, content: '秘密' } },
      { type: 'assistant/message', time: 2, data: { content: '草稿' } },
    ])
    const digest = composeHandoffDigest(candidates, [], true)
    expect(digest).toContain('全文迁移')
    expect(digest).toContain('秘密')
    expect(digest).toContain('助手：草稿')
  })
})
