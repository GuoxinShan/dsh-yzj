// Webhook receiver for the robot-creation probe (R0 spike ①).
// Replies the official ack shape within 3s and logs every inbound request
// (sign/sessionId headers + body) to logs/hook-<date>.ndjson.
import { createServer } from 'node:http'
import { mkdirSync, appendFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const logs = join(here, 'logs')
mkdirSync(logs, { recursive: true })
const logFile = join(logs, `hook-${new Date().toISOString().slice(0, 10)}.ndjson`)

const PORT = 9902
const server = createServer((req, res) => {
  const chunks = []
  req.on('data', c => chunks.push(c))
  req.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf8')
    const entry = {
      t: new Date().toISOString(),
      method: req.method,
      url: req.url,
      sign: req.headers.sign ?? null,
      sessionId: req.headers.sessionid ?? req.headers['session-id'] ?? null,
      contentType: req.headers['content-type'] ?? null,
      body: raw.length > 4096 ? raw.slice(0, 4096) + '…' : raw,
    }
    console.log(`[${entry.t}] ${entry.method} ${entry.url} sign=${String(entry.sign).slice(0, 12)}… body=${entry.body.slice(0, 160)}`)
    appendFileSync(logFile, JSON.stringify(entry) + '\n')
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/plain' }).end('OK')
    } else {
      // Official response shape (api/im/chatbot.md) — must arrive within 3s.
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ success: true, data: { type: 2, content: 'ok' } }))
    }
  })
})
server.listen(PORT, '127.0.0.1', () => {
  console.log(`hook-recv listening on http://127.0.0.1:${PORT} (log: ${logFile})`)
})
