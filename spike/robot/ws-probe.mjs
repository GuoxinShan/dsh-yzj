// WS probe for the yzj robot channel (R0 spikes ①③⑦a).
// Derives wss://<host>/xuntong/websocket?yzjtoken=… from sendMsgUrl, logs
// every frame with timestamps (console + logs/ws-<date>.ndjson), classifies
// dispatch vs control frames, keeps alive with a 30s ping, reconnects with
// backoff so the ≥1h post-tunnel observation (spike ①) runs unattended.
import { mkdirSync, appendFileSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const logs = join(here, 'logs')
mkdirSync(logs, { recursive: true })
const logFile = join(logs, `ws-${new Date().toISOString().slice(0, 10)}.ndjson`)

function log(entry) {
  const line = JSON.stringify(entry)
  console.log(line)
  appendFileSync(logFile, line + '\n')
}

const secretPath = join(here, 'secret.local.json')
let sendMsgUrl = process.env.YZJ_SEND_MSG_URL ?? ''
if (sendMsgUrl === '' && existsSync(secretPath)) {
  try { sendMsgUrl = JSON.parse(readFileSync(secretPath, 'utf8')).sendMsgUrl ?? '' } catch {}
}
if (sendMsgUrl === '') {
  console.error('need sendMsgUrl: put it in spike/robot/secret.local.json or set YZJ_SEND_MSG_URL')
  process.exit(1)
}

const u = new URL(sendMsgUrl)
const token = u.searchParams.get('yzjtoken') ?? ''
if (token === '') { console.error('sendMsgUrl missing yzjtoken'); process.exit(1) }
const wsUrl = `wss://${u.host}/xuntong/websocket?yzjtoken=${encodeURIComponent(token)}`
log({ t: new Date().toISOString(), kind: 'probe-start', wsUrl: wsUrl.replace(token, '<token>') })

let attempt = 0
function classify(text) {
  try {
    const p = JSON.parse(text)
    if (typeof p.robotId === 'string' && typeof p.content === 'string') return { kind: 'dispatch', msg: p }
    if (['ping', 'pong', 'ack', 'close'].includes(String(p.type ?? p.event ?? '').toLowerCase())) return { kind: 'control', type: p.type ?? p.event }
    return { kind: 'other-json', keys: Object.keys(p).slice(0, 12) }
  } catch {
    const n = text.trim().toLowerCase()
    if (n === 'ping' || n === 'pong' || n === '') return { kind: 'control', type: n || 'empty' }
    return { kind: 'text', sample: text.slice(0, 80) }
  }
}
function connect() {
  const ws = new WebSocket(wsUrl)
  let lastControl = 0
  ws.addEventListener('open', () => {
    attempt = 0
    log({ t: new Date().toISOString(), kind: 'open' })
  })
  ws.addEventListener('message', ev => {
    const text = typeof ev.data === 'string' ? ev.data : '<binary>'
    const c = classify(text)
    if (c.kind === 'dispatch') {
      log({ t: new Date().toISOString(), kind: 'DISPATCH', robotId: c.msg.robotId, robotName: c.msg.robotName,
        operatorOpenid: c.msg.operatorOpenid, operatorName: c.msg.operatorName,
        msgId: c.msg.msgId, groupType: c.msg.groupType, type: c.msg.type, content: String(c.msg.content).slice(0, 120) })
    } else {
      lastControl = Date.now()
      // Log the FULL frame for non-dispatch payloads — the exact inbound
      // shape for user messages is the thing we're probing (spike ⑦a/③).
      log({ t: new Date().toISOString(), kind: c.kind, detail: c.type ?? c.keys ?? c.sample ?? '', raw: text.slice(0, 2000) })
    }
  })
  ws.addEventListener('close', () => {
    log({ t: new Date().toISOString(), kind: 'close' })
    scheduleReconnect()
  })
  ws.addEventListener('error', () => log({ t: new Date().toISOString(), kind: 'error' }))
  const hb = setInterval(() => {
    if (ws.readyState !== 1) { clearInterval(hb); return }
    try { ws.send(JSON.stringify({ cmd: 'ping' })) } catch {}
  }, 30_000)
  return () => { clearInterval(hb); try { ws.close() } catch {} }
}
function scheduleReconnect() {
  const delay = Math.min(30_000, 1000 * 2 ** attempt)
  attempt += 1
  log({ t: new Date().toISOString(), kind: 'reconnect-scheduled', delayMs: delay, attempt })
  setTimeout(connect, delay)
}
connect()
