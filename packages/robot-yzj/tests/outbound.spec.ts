import { describe, expect, it } from 'vitest'
import { chunkText, RobotSender } from '../src/outbound.ts'

describe('chunkText', () => {
  it('returns short text as one chunk', () => {
    expect(chunkText('hello', 100)).toEqual(['hello'])
  })

  it('splits at a newline near the boundary when one exists', () => {
    const text = `${'a'.repeat(60)}\n${'b'.repeat(60)}`
    expect(chunkText(text, 80)).toEqual(['a'.repeat(60), 'b'.repeat(60)])
  })

  it('hard-splits when no newline sits near the boundary', () => {
    const text = 'x'.repeat(200)
    const chunks = chunkText(text, 80)
    expect(chunks).toHaveLength(3)
    expect(chunks.join('')).toBe(text)
  })

  it('keeps an empty body as one empty chunk', () => {
    expect(chunkText('', 10)).toEqual([''])
  })
})

describe('RobotSender', () => {
  function makeSender(posts: { url: string; body: string }[], responses: { status: number; text: string }[]) {
    let call = 0
    return new RobotSender({
      sendMsgUrl: 'https://example.com/send?yzjtoken=t',
      maxChunkChars: 10,
      minIntervalMs: 0,
      delay: async () => {},
      post: async (url, body) => {
        posts.push({ url, body })
        const response = responses[call]
        call += 1
        return response ?? { status: 200, text: '{"success":true,"data":{"msgId":"m-default"}}' }
      },
    })
  }

  it('sends one text with the measured envelope and extracts the msgId', async () => {
    const posts: { url: string; body: string }[] = []
    const sender = makeSender(posts, [{ status: 200, text: '{"success":true,"data":{"msgId":"m-1"}}' }])
    const result = await sender.send('你好')
    expect(result).toEqual({ ok: true, msgId: 'm-1' })
    const payload = JSON.parse(posts[0]!.body) as Record<string, unknown>
    expect(payload.msgtype).toBe(2)
    expect(payload.content).toBe('你好')
  })

  it('rides the reply anchor as param + paramType 3', async () => {
    const posts: { url: string; body: string }[] = []
    const sender = makeSender(posts, [])
    await sender.send('ack', { replyMsgId: 'm-in', replySummary: '原消息', replyPersonName: '张三' })
    const payload = JSON.parse(posts[0]!.body) as Record<string, unknown>
    expect(payload.paramType).toBe(3)
    const param = payload.param as Record<string, unknown>
    expect(param.replyMsgId).toBe('m-in')
    expect(param.isReference).toBe(true)
  })

  it('maps errorCode 1401002 to too-long', async () => {
    const sender = makeSender([], [{ status: 200, text: '{"success":false,"errorCode":1401002,"error":"消息内容太长"}' }])
    expect(await sender.send('x'.repeat(20))).toEqual({ ok: false, error: 'too-long' })
  })

  it('chunks long text into sequential sends', async () => {
    const posts: { url: string; body: string }[] = []
    const sender = makeSender(posts, [])
    const result = await sender.send('a'.repeat(25))
    expect(result.ok).toBe(true)
    expect(posts).toHaveLength(3)
    const joined = posts.map(p => (JSON.parse(p.body) as { content: string }).content).join('')
    expect(joined).toBe('a'.repeat(25))
  })

  it('carries notifyParams for targeted openIds', async () => {
    const posts: { url: string; body: string }[] = []
    const sender = makeSender(posts, [])
    await sender.send('ping', { notifyOpenIds: ['u1'] })
    const payload = JSON.parse(posts[0]!.body) as { notifyParams: { type: string; values: string[] }[] }
    expect(payload.notifyParams).toEqual([{ type: 'openIds', values: ['u1'] }])
  })
})
