/** Dump the tail of a dsh session log (.jsonl.zstd = concatenated zstd frames). */
import { zstdDecompressSync } from 'node:zlib'
import { readFileSync } from 'node:fs'

const file = process.argv[2]
const tail = Number(process.argv[3] ?? 40)
const buf = readFileSync(file)
const MAGIC = Buffer.from([0x28, 0xB5, 0x2F, 0xFD])
const starts = []
for (let i = 0; i + 4 <= buf.length; i += 1) {
  if (buf[i] === 0x28 && buf[i + 1] === 0xB5 && buf[i + 2] === 0x2F && buf[i + 3] === 0xFD) starts.push(i)
}
let text = ''
for (let i = 0; i < starts.length; i += 1) {
  const next = starts[i + 1]
  const end = next !== undefined ? next : buf.length
  try {
    text += zstdDecompressSync(buf.subarray(starts[i], end)).toString('utf8')
  } catch {
    // Partial frame (log still being written) — skip.
  }
}
const lines = text.split('\n').filter(line => line.trim() !== '')
console.log(`total ${lines.length} events; last ${tail}:`)
for (const line of lines.slice(-tail)) {
  let event
  try { event = JSON.parse(line) } catch { continue }
  const type = event.type ?? '?'
  const data = event.data ?? {}
  const brief = typeof data === 'object'
    ? JSON.stringify(data).slice(0, 300)
    : String(data).slice(0, 300)
  console.log(`[${type}] ${brief}`)
}



