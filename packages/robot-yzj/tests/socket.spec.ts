import { describe, expect, it, vi } from 'vitest'
import { RobotSocket, type SocketTimers, type WebSocketLike } from '../src/socket.ts'

type Listener = (event: { data?: unknown }) => void

/** Scriptable fake socket: records sends and emits events on demand. */
function fakeSocketFactory() {
  const sockets: { socket: FakeSocket; listeners: Map<string, Listener[]> }[] = []
  class FakeSocket implements WebSocketLike {
    readyState = 0
    sent: string[] = []
    listeners = new Map<string, Listener[]>()
    closed = false
    constructor() {
      sockets.push({ socket: this, listeners: this.listeners })
    }
    send(data: string): void { this.sent.push(data) }
    close(): void { this.closed = true; this.readyState = 3 }
    addEventListener(type: string, listener: Listener): void {
      this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
    }
    emit(type: string, event: { data?: unknown } = {}): void {
      for (const listener of this.listeners.get(type) ?? []) listener(event)
    }
  }
  return { sockets, factory: (url: string) => new FakeSocket() as unknown as WebSocketLike, urlSeen: '' as string }
}

/** Deterministic timer bag recording every schedule/clear for assertions. */
function fakeTimers() {
  const intervals = new Map<unknown, () => void>()
  const timeouts = new Map<unknown, () => void>()
  const timers: SocketTimers = {
    setInterval: (h, ms) => { const id = { h, ms }; intervals.set(id, h); return id },
    clearInterval: id => { intervals.delete(id) },
    setTimeout: (h, ms) => { const id = { h, ms }; timeouts.set(id, h); return id },
    clearTimeout: id => { timeouts.delete(id) },
  }
  return { timers, intervals, timeouts }
}

describe('RobotSocket', () => {
  it('delivers classified robot messages and mirrors status on open', () => {
    const fake = fakeSocketFactory()
    const { timers } = fakeTimers()
    const statuses: boolean[] = []
    const messages: string[] = []
    const socket = new RobotSocket({
      url: 'wss://example/xuntong/websocket?yzjtoken=t',
      socketFactory: fake.factory,
      timers,
      onMessage: message => { messages.push(message.content) },
      onStatus: status => { statuses.push(status.connected) },
    })
    socket.start()
    const first = fake.sockets[0]!.socket
    first.emit('open')
    first.emit('message', { data: JSON.stringify({ cmd: 'directPush', type: 'robotMessage', msg: { msgId: 'm1', content: '你好', robotId: 'r', operatorOpenid: 'u', time: 1 } }) })
    expect(messages).toEqual(['你好'])
    expect(statuses.at(-1)).toBe(true)
    socket.stop()
    expect(first.closed).toBe(true)
  })

  it('schedules a capped-backoff reconnect on close and stops cleanly', () => {
    const fake = fakeSocketFactory()
    const { timers, timeouts } = fakeTimers()
    const socket = new RobotSocket({
      url: 'wss://example/x',
      socketFactory: fake.factory,
      timers,
      onMessage: () => {},
    })
    socket.start()
    const first = fake.sockets[0]!.socket
    first.emit('open')
    first.emit('close')
    // One reconnect timeout pending with the base delay.
    expect(timeouts.size).toBe(1)
    const [id] = [...timeouts.keys()]
    expect((id as { ms: number }).ms).toBe(1000)
    socket.stop()
    expect(timeouts.size).toBe(0)
  })

  it('forces a reconnect when the connection goes stale between heartbeats', () => {
    const fake = fakeSocketFactory()
    const { timers, intervals } = fakeTimers()
    let clock = 0
    const socket = new RobotSocket({
      url: 'wss://example/x',
      socketFactory: fake.factory,
      timers,
      now: () => clock,
      heartbeatMs: 30_000,
      staleMs: 60_000,
      onMessage: () => {},
    })
    socket.start()
    const first = fake.sockets[0]!.socket
    first.emit('open')
    // Advance past staleMs with no frames, then fire one heartbeat tick.
    clock += 61_000
    const [heartbeat] = [...intervals.values()]
    expect(heartbeat).toBeDefined()
    heartbeat!()
    expect(first.closed).toBe(true)
    socket.stop()
  })

  it('heartbeats with the measured {cmd:ping} frame', () => {
    const fake = fakeSocketFactory()
    const { timers, intervals } = fakeTimers()
    const socket = new RobotSocket({
      url: 'wss://example/x',
      socketFactory: fake.factory,
      timers,
      onMessage: () => {},
    })
    socket.start()
    const first = fake.sockets[0]!.socket
    first.emit('open')
    const [heartbeat] = [...intervals.values()]
    heartbeat!()
    expect(first.sent).toEqual([JSON.stringify({ cmd: 'ping' })])
    socket.stop()
  })

  it('ignores non-robot frames silently', () => {
    const fake = fakeSocketFactory()
    const { timers } = fakeTimers()
    const messages: string[] = []
    const socket = new RobotSocket({
      url: 'wss://example/x',
      socketFactory: fake.factory,
      timers,
      onMessage: message => { messages.push(message.content) },
    })
    socket.start()
    const first = fake.sockets[0]!.socket
    first.emit('open')
    first.emit('message', { data: JSON.stringify({ cmd: 'pong' }) })
    first.emit('message', { data: JSON.stringify({ cmd: 'message', lastUpdateTime: 'x' }) })
    first.emit('message', { data: 'garbage' })
    expect(messages).toEqual([])
    socket.stop()
  })

  it('keeps the factory url untouched', () => {
    const fake = fakeSocketFactory()
    const { timers } = fakeTimers()
    const seen: string[] = []
    const socket = new RobotSocket({
      url: 'wss://example/x?yzjtoken=secret',
      socketFactory: url => { seen.push(url); return fake.factory(url) },
      timers,
      onMessage: () => {},
    })
    socket.start()
    expect(seen).toEqual(['wss://example/x?yzjtoken=secret'])
    socket.stop()
  })
})
