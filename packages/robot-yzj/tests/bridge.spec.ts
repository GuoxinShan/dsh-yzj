import { afterEach, describe, expect, it, vi } from 'vitest'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { Context } from '@deepseek-ai/cordis'
import { ChatnodeBridge, ChatnodeBridgeClient } from '../src/bridge.ts'

const TOKEN = 'bridge-secret-1'

/** Start a real loopback HTTP server answering through one handler. */
function start(handler: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void | Promise<void>): { server: Server; url: string; close: () => Promise<void> } {
  const server = createServer((req, res) => {
    Promise.resolve(handler(req, res)).catch((error: unknown) => {
      res.writeHead(500)
      res.end(`handler error: ${String(error)}`)
    })
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port
      resolve({
        server,
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(() => done())),
      })
    })
  })
}

const servers: { close: () => Promise<void> }[] = []
afterEach(async () => {
  await Promise.all(servers.splice(0).map(entry => entry.close()))
})

describe('ChatnodeBridge (listener half)', () => {
  it('rejects non-POST methods with 405', async () => {
    const robot = { notify: vi.fn() }
    const target = await start((req, res) => new ChatnodeBridge({ robot, defaultRobotIndex: 0, token: TOKEN }).handle(req, res))
    servers.push(target)
    const res = await fetch(`${target.url}/yzj/chatnode`, { method: 'GET' })
    expect(res.status).toBe(405)
    expect(robot.notify).not.toHaveBeenCalled()
  })

  it('rejects a missing or wrong bearer token with 401', async () => {
    const robot = { notify: vi.fn() }
    const target = await start((req, res) => new ChatnodeBridge({ robot, defaultRobotIndex: 0, token: TOKEN }).handle(req, res))
    servers.push(target)
    const missing = await fetch(`${target.url}/yzj/chatnode`, { method: 'POST', body: JSON.stringify({ text: 'x' }) })
    expect(missing.status).toBe(401)
    const wrong = await fetch(`${target.url}/yzj/chatnode`, {
      method: 'POST',
      headers: { authorization: 'Bearer nope' },
      body: JSON.stringify({ text: 'x' }),
    })
    expect(wrong.status).toBe(401)
    expect(robot.notify).not.toHaveBeenCalled()
  })

  it('pushes a valid digest through the robot face with the default channel', async () => {
    const notify = vi.fn(async (text: string) => ({ ok: true, msgId: `m-${text.length}` }))
    const target = await start((req, res) => new ChatnodeBridge({ robot: { notify }, defaultRobotIndex: 1, token: TOKEN }).handle(req, res))
    servers.push(target)
    const res = await fetch(`${target.url}/yzj/chatnode`, {
      method: 'POST',
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'dsh-routines: c11-prod', text: '[completed] c11-prod\n\nall green' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean; msgId?: string }
    expect(body.ok).toBe(true)
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify.mock.calls[0]![0]).toBe('dsh-routines: c11-prod\n\n[completed] c11-prod\n\nall green')
    expect(notify.mock.calls[0]![1]).toBe(1)
  })

  it('honors an explicit robotIndex from the caller', async () => {
    const notify = vi.fn(async () => ({ ok: true }))
    const target = await start((req, res) => new ChatnodeBridge({ robot: { notify }, defaultRobotIndex: 0, token: TOKEN }).handle(req, res))
    servers.push(target)
    const res = await fetch(`${target.url}/yzj/chatnode`, {
      method: 'POST',
      headers: { authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ text: 'probe', robotIndex: 3 }),
    })
    expect(res.status).toBe(200)
    expect(notify.mock.calls[0]![1]).toBe(3)
  })

  it('rejects malformed bodies and empty text with 400', async () => {
    const robot = { notify: vi.fn() }
    const target = await start((req, res) => new ChatnodeBridge({ robot, defaultRobotIndex: 0, token: TOKEN }).handle(req, res))
    servers.push(target)
    const headers = { authorization: `Bearer ${TOKEN}` }
    const badJson = await fetch(`${target.url}/yzj/chatnode`, { method: 'POST', headers, body: 'not json' })
    expect(badJson.status).toBe(400)
    const noText = await fetch(`${target.url}/yzj/chatnode`, { method: 'POST', headers, body: JSON.stringify({ text: '  ' }) })
    expect(noText.status).toBe(400)
    expect(robot.notify).not.toHaveBeenCalled()
  })

  it('answers 502 when the robot push fails', async () => {
    const robot = { notify: async () => ({ ok: false, error: 'no connected robot channel' }) }
    const target = await start((req, res) => new ChatnodeBridge({ robot, defaultRobotIndex: 0, token: TOKEN }).handle(req, res))
    servers.push(target)
    const res = await fetch(`${target.url}/yzj/chatnode`, {
      method: 'POST',
      headers: { authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ text: 'x' }),
    })
    expect(res.status).toBe(502)
    const body = await res.json() as { error?: string }
    expect(body.error).toContain('no connected robot channel')
  })
})

describe('ChatnodeBridgeClient (client half)', () => {
  it('provides ctx.chatnode and POSTs the raw contract fields with the bearer token', async () => {
    const seen: { method?: string; path?: string; auth?: string; body?: unknown } = {}
    const target = await start(async (req, res) => {
      const chunks: Buffer[] = []
      for await (const chunk of req) chunks.push(chunk as Buffer)
      seen.method = req.method
      seen.path = req.url
      seen.auth = req.headers.authorization
      seen.body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
    })
    servers.push(target)
    const ctx = new Context()
    new ChatnodeBridgeClient(ctx, `${target.url}/yzj/chatnode`, TOKEN)
    expect(typeof ctx.chatnode?.send).toBe('function')
    await ctx.chatnode!.send({ title: 'dsh-routines: c11-prod', text: '[completed] c11-prod\n\nall green' })
    expect(seen.method).toBe('POST')
    expect(seen.path).toBe('/yzj/chatnode')
    expect(seen.auth).toBe(`Bearer ${TOKEN}`)
    expect(seen.body).toEqual({ title: 'dsh-routines: c11-prod', text: '[completed] c11-prod\n\nall green' })
  })

  it('throws on a non-2xx response, carrying the listener error', async () => {
    const target = await start((_req, res) => {
      res.writeHead(401, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: 'unauthorized' }))
    })
    servers.push(target)
    const ctx = new Context()
    const client = new ChatnodeBridgeClient(ctx, `${target.url}/yzj/chatnode`, 'wrong-token')
    await expect(client.send({ text: 'x' })).rejects.toThrow(/HTTP 401 unauthorized/)
  })

  it('treats a 2xx non-{ok:true} body as a failure (SPA-fallback false positive)', async () => {
    const target = await start((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end('<!doctype html><title>dsh web</title>')
    })
    servers.push(target)
    const ctx = new Context()
    const client = new ChatnodeBridgeClient(ctx, `${target.url}/yzj/chatnode`, TOKEN)
    await expect(client.send({ text: 'x' })).rejects.toThrow(/without ok:true/)
  })

  it('throws when the listener is unreachable', async () => {
    const ctx = new Context()
    const client = new ChatnodeBridgeClient(ctx, 'http://127.0.0.1:1/yzj/chatnode', TOKEN)
    await expect(client.send({ text: 'x' })).rejects.toThrow(/unreachable/)
  })
})
