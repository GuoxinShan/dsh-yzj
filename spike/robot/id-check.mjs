// robotId ↔ CLI groupId comparison (R0 spike ②).
// Usage: id-check.mjs <robotId>  — or no arg to use the newest robotId in logs/ws-*.ndjson.
// Runs read-only yzj-cli commands (im group recent / im message list) and reports
// whether the inbound robotId matches a CLI-visible group / message.
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
let robotId = process.argv[2] ?? ''
if (robotId === '') {
  const logs = join(here, 'logs')
  if (existsSync(logs)) {
    const files = readdirSync(logs).filter(f => f.startsWith('ws-')).sort()
    for (const f of files.reverse()) {
      const lines = readFileSync(join(logs, f), 'utf8').trim().split('\n').reverse()
      for (const line of lines) {
        try { const e = JSON.parse(line); if (e.kind === 'DISPATCH' && e.robotId) { robotId = e.robotId; break } } catch {}
      }
      if (robotId) break
    }
  }
}
if (robotId === '') { console.error('no robotId given and none found in ws logs'); process.exit(1) }
console.log(`robotId from inbound: ${robotId}\n`)

function cli(args) {
  const r = spawnSync('yzj-cli', args, { encoding: 'utf8', timeout: 30_000 })
  if (r.status !== 0) { console.log(`  yzj-cli ${args.join(' ')} -> exit ${r.status}: ${String(r.stderr).slice(0, 200)}`); return null }
  try { return JSON.parse(r.stdout) } catch { console.log(`  unparseable output for ${args.join(' ')}`); return null }
}

const groups = cli(['im', 'group', 'recent', '--limit', '20'])
if (!groups) process.exit(1)
const list = Array.isArray(groups) ? groups : (groups.groups ?? groups.list ?? [])
console.log(`CLI sees ${list.length} recent groups — exact robotId match? substring match?`)
let hit = null
for (const g of list) {
  const s = JSON.stringify(g)
  if (s.includes(robotId)) { hit = g; console.log(`  EXACT/SUBSTRING HIT: ${s.slice(0, 200)}`) }
}
if (!hit) {
  console.log('  no direct match in group payloads; scanning each group\'s recent messages…')
  for (const g of list.slice(0, 8)) {
    const id = g.groupId ?? g.id ?? g.gid
    if (!id) continue
    const msgs = cli(['im', 'message', 'list', '--group-id', String(id), '--limit', '5'])
    if (msgs === null) continue
    if (JSON.stringify(msgs).includes(robotId)) console.log(`  MESSAGE HIT in group ${id}`)
  }
  console.log('\nconclusion: run again after more inbound traffic if still no hit')
} else {
  console.log('\nconclusion: same ID space (or derivable mapping)')
}
