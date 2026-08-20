/**
 * Topic job-done delivery (R29): summary-only reply, skip matrix, artifacts.
 */
import { Context } from '@deepseek-ai/cordis'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import YzjBridge from '@dsh-yzj/bridge'
import { extractSendMsgId } from '@dsh-yzj/tool-yzj/src/bound-log.ts'
import type { TopicRecord } from '@dsh-yzj/tool-yzj/src/topics.ts'
import { LEGACY_HOST_ROOT } from '@dsh-yzj/tool-yzj/src/topics.ts'
import { sendImAndLog, type ImSendInput, type ImSendResult } from '../src/bound-io.ts'
import {
  assistantTextOf, composeTopicDelivery, concludingAnswer, decideTopicDelivery,
  deliverTopicResult, extractUploadFileId, isImageArtifact, isSyntheticAnchor,
  resolveWorkspaceFile, TopicDeliverHub, TOPIC_DELIVER_MAX_CHARS, writePathOf,
} from '../src/topic-deliver.ts'

function topic(over: Partial<TopicRecord> = {}): TopicRecord {
  return {
    dshSessionId: 'yzj-topic-g-root1',
    yzjConversationId: 'group-dsh-2',
    title: '整理接口',
    source: 'dsh',
    createdAt: 1,
    rootMsgId: 'root-1',
    ...over,
  }
}

describe('decideTopicDelivery', () => {
  it('delivers a GUI topic turn onto the real anchor', () => {
    expect(decideTopicDelivery({
      sessionId: 'yzj-topic-g-root1',
      topic: topic(),
      latestUserKind: 'user',
      writesPending: false,
      sentIm: false,
      answer: '做完了',
    })).toEqual({
      ok: true,
      replyMsgId: 'root-1',
      groupId: 'group-dsh-2',
      title: '整理接口',
    })
  })

  it('skips plugin inbound, pending writes, self-sent IM, and fake anchors', () => {
    const base = {
      sessionId: 'yzj-topic-g-root1',
      topic: topic(),
      latestUserKind: 'user' as const,
      writesPending: false,
      sentIm: false,
      answer: '做完了',
    }
    const reason = (over: Partial<typeof base> & { topic?: TopicRecord }): string => {
      const result = decideTopicDelivery({ ...base, ...over })
      return result.ok ? 'ok' : result.reason
    }
    expect(reason({ sessionId: 'sess-other' })).toBe('not-topic')
    expect(reason({ latestUserKind: 'plugin' })).toBe('plugin-turn')
    expect(reason({ writesPending: true })).toBe('writes-pending')
    expect(reason({ sentIm: true })).toBe('already-sent-im')
    expect(reason({ answer: '  ' })).toBe('no-answer')
    expect(reason({ topic: topic({ rootMsgId: LEGACY_HOST_ROOT }) })).toBe('synthetic-anchor')
    expect(reason({ topic: topic({ rootMsgId: 'local-abc' }) })).toBe('synthetic-anchor')
    const { rootMsgId: _omit, ...noRoot } = topic()
    expect(reason({ topic: noRoot })).toBe('no-anchor')
  })
})

describe('compose / answer / artifacts', () => {
  it('posts only the last assistant block, clipped, with artifact names', () => {
    expect(concludingAnswer(['中间过程', '  最终结论  '])).toBe('最终结论')
    expect(isSyntheticAnchor('local-1')).toBe(true)
    expect(isSyntheticAnchor('real-msg')).toBe(false)
    expect(isImageArtifact('a.png')).toBe(true)
    expect(isImageArtifact('a.md')).toBe(false)
    const text = composeTopicDelivery({
      title: '整理接口',
      answer: '三处待确认。',
      artifactNames: ['纪要.md', '图.png'],
    })
    expect(text).toContain('✅ 已完成「整理接口」')
    expect(text).toContain('三处待确认。')
    expect(text).toContain('🖼 图片附在本回复：图.png')
    expect(text).toContain('📎 文件发在群时间线（CLI 文件消息不能挂回复链）：纪要.md')
    expect(text).not.toContain('中间过程')
    const long = '字'.repeat(TOPIC_DELIVER_MAX_CHARS + 40)
    expect(composeTopicDelivery({ title: 'x', answer: long, artifactNames: [] }).length).toBeLessThan(long.length)
  })

  it('reads assistant text from both message envelopes', () => {
    expect(assistantTextOf({ message: { content: [{ type: 'text', text: '你好' }] } })).toBe('你好')
    expect(assistantTextOf({ content: [{ type: 'text', text: '世界' }] })).toBe('世界')
    expect(writePathOf({ name: 'write', arguments: '{"file_path":"out/a.md"}' })).toBe('out/a.md')
    expect(writePathOf({ name: 'edit', arguments: { file_path: 'b.txt' } })).toBe('b.txt')
    expect(writePathOf({ name: 'read', arguments: '{"file_path":"c.md"}' })).toBeUndefined()
  })

  it('keeps artifacts inside the workspace', () => {
    expect(resolveWorkspaceFile('/ws', 'a.md')).toBe(join('/ws', 'a.md'))
    expect(resolveWorkspaceFile('/ws', '../etc/passwd')).toBeUndefined()
    expect(resolveWorkspaceFile('/ws', 'node_modules/x.md')).toBeUndefined()
    expect(resolveWorkspaceFile('/ws', 'secret.bin')).toBeUndefined()
    expect(extractUploadFileId({ fileId: 'f1' })).toBe('f1')
    expect(extractUploadFileId({ data: { file_id: 'f2' } })).toBe('f2')
  })
})

describe('TopicDeliverHub', () => {
  it('flushes the concluding answer on idle and skips a second idle', async () => {
    const delivered: { answer: string; replyMsgId: string; artifactPaths: readonly string[] }[] = []
    const hub = new TopicDeliverHub({
      getTopic: () => topic(),
      writesPending: () => false,
      workspaceCwd: () => '/ws',
      deliver: async (input) => { delivered.push(input) },
    })
    hub.noteEvent('yzj-topic-g-root1', { type: 'turn/start', seq: 1, data: {} })
    hub.noteEvent('yzj-topic-g-root1', {
      type: 'assistant/message', seq: 2,
      data: { message: { content: [{ type: 'text', text: '草稿' }] } },
    })
    hub.noteEvent('yzj-topic-g-root1', {
      type: 'assistant/message', seq: 3,
      data: { message: { content: [{ type: 'text', text: '定稿结论' }] } },
    })
    hub.noteIdle('yzj-topic-g-root1', 'user')
    await Promise.resolve()
    expect(delivered).toHaveLength(1)
    expect(delivered[0]?.replyMsgId).toBe('root-1')
    expect(delivered[0]?.answer).toContain('定稿结论')
    expect(delivered[0]?.answer).not.toContain('草稿')
    hub.noteIdle('yzj-topic-g-root1', 'user')
    await Promise.resolve()
    expect(delivered).toHaveLength(1)
  })

  it('skips plugin turns and yzj_im_message_send turns', async () => {
    const delivered: unknown[] = []
    const hub = new TopicDeliverHub({
      getTopic: () => topic(),
      writesPending: () => false,
      workspaceCwd: () => '/ws',
      deliver: async (input) => { delivered.push(input) },
    })
    hub.noteEvent('yzj-topic-g-root1', {
      type: 'assistant/message', seq: 2,
      data: { content: [{ type: 'text', text: '机器人已经推过' }] },
    })
    hub.noteIdle('yzj-topic-g-root1', 'plugin')
    await Promise.resolve()
    expect(delivered).toHaveLength(0)

    hub.noteEvent('yzj-topic-g-root1', { type: 'turn/start', seq: 10, data: {} })
    hub.noteEvent('yzj-topic-g-root1', {
      type: 'tool/call', seq: 11, data: { name: 'yzj_im_message_send', arguments: '{}' },
    })
    hub.noteEvent('yzj-topic-g-root1', {
      type: 'assistant/message', seq: 12, data: { content: '又说一句' },
    })
    hub.noteIdle('yzj-topic-g-root1', 'user')
    await Promise.resolve()
    expect(delivered).toHaveLength(0)
  })

  it('collects write paths from the turn', async () => {
    const delivered: { artifactPaths: readonly string[] }[] = []
    const hub = new TopicDeliverHub({
      getTopic: () => topic(),
      writesPending: () => false,
      workspaceCwd: () => '/ws',
      deliver: async (input) => { delivered.push(input) },
    })
    hub.noteEvent('yzj-topic-g-root1', { type: 'user/message', seq: 1, data: { source: { kind: 'user' } } })
    hub.noteEvent('yzj-topic-g-root1', {
      type: 'tool/call', seq: 2, data: { name: 'write', arguments: '{"file_path":"notes.md"}' },
    })
    hub.noteEvent('yzj-topic-g-root1', {
      type: 'assistant/message', seq: 3, data: { content: '写好了' },
    })
    hub.noteIdle('yzj-topic-g-root1', 'user')
    await Promise.resolve()
    expect(delivered[0]?.artifactPaths).toEqual([join('/ws', 'notes.md')])
  })

  it('retries after a failed deliver instead of watermarking first', async () => {
    let fails = 1
    const delivered: string[] = []
    const hub = new TopicDeliverHub({
      getTopic: () => topic(),
      writesPending: () => false,
      workspaceCwd: () => '/ws',
      deliver: async (input) => {
        if (fails > 0) {
          fails -= 1
          throw new Error('network')
        }
        delivered.push(input.answer)
      },
    })
    hub.noteEvent('yzj-topic-g-root1', {
      type: 'assistant/message', seq: 2,
      data: { message: { content: [{ type: 'text', text: '定稿结论' }] } },
    })
    hub.noteIdle('yzj-topic-g-root1', 'user')
    await Promise.resolve()
    await Promise.resolve()
    expect(delivered).toHaveLength(0)
    hub.noteIdle('yzj-topic-g-root1', 'user')
    await Promise.resolve()
    await Promise.resolve()
    expect(delivered).toEqual(['定稿结论'])
  })
})

describe('deliverTopicResult', () => {
  it('replies with richText when images exist and follows with file messages', async () => {
    const sends: ImSendInput[] = []
    const dir = await mkdtemp(join(tmpdir(), 'yzj-deliver-'))
    const md = join(dir, 'notes.md')
    const png = join(dir, 'shot.png')
    await writeFile(md, 'hello')
    await writeFile(png, 'fake-png')
    const sent = await deliverTopicResult({
      ctx: {} as never,
      home: {
        registerTopicOutbound: async () => undefined,
      } as never,
      topic: topic(),
      replyMsgId: 'root-1',
      title: '整理接口',
      answer: '写好了',
      artifactPaths: [png, md],
      send: async (input) => {
        sends.push(input)
        return { ok: true, value: { msgId: `m-${sends.length}` } } satisfies ImSendResult
      },
      upload: async (_path, name) => `fid-${name}`,
    })
    expect(sent.ok).toBe(true)
    expect(sends[0]?.msgType).toBe('richText')
    expect(sends[0]?.replyMsgId).toBe('root-1')
    expect(sends[0]?.content).toContain('[图片]')
    expect(sends[0]?.images).toEqual(['fid-shot.png'])
    expect(sends[1]?.msgType).toBe('file')
    expect(sends[1]?.fileId).toBe('fid-notes.md')
    expect(sends[1]?.replyMsgId).toBeUndefined()
    expect(sends[0]?.content).toContain('notes.md')
    expect(sends[0]?.content).toContain('shot.png')
  })

  it('omits artifact names that did not upload from the reply', async () => {
    const sends: ImSendInput[] = []
    const dir = await mkdtemp(join(tmpdir(), 'yzj-deliver-miss-'))
    const md = join(dir, 'notes.md')
    await writeFile(md, 'hello')
    const sent = await deliverTopicResult({
      ctx: {} as never,
      home: {
        registerTopicOutbound: async () => undefined,
      } as never,
      topic: topic(),
      replyMsgId: 'root-1',
      title: '整理接口',
      answer: '写好了',
      artifactPaths: [md],
      send: async (input) => {
        sends.push(input)
        return { ok: true, value: { msgId: `m-${sends.length}` } } satisfies ImSendResult
      },
      upload: async () => undefined,
    })
    expect(sent.ok).toBe(true)
    expect(sends[0]?.content).toContain('写好了')
    expect(sends[0]?.content).not.toContain('notes.md')
    expect(sends).toHaveLength(1)
  })
})

