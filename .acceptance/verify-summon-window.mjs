/**
 * Topic 「问助手」must plant the group summon window (pitfall-027).
 * Clicks 交给助手, asks in the drawer, then reads the newest yzj-topic
 * session log for 本群最近消息 / groupId / yzj-bound-window.
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { homedir, tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots-summon-window')
mkdirSync(OUT, { recursive: true })
const GROUP = process.env.YZJ_E2E_GROUP ?? '金蝶最小DSH交流群'
const BASE = process.env.DSH_GUI ?? 'http://127.0.0.1:3080/'
const SESSIONS = join(homedir(), '.dsh/sessions/--Users-guoxinshan-.dsh-yzj-workspace--')
const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
].find(path => existsSync(path))

let failures = 0
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`)
  if (!cond) failures += 1
}

/** Packed jsonl.zstd is concatenated frames (pitfall-008). Decode via harness. */
function readPackedLog(file) {
  const harness = join(dirname(fileURLToPath(import.meta.url)), '../../deepseek-harness')
  const decoder = join(tmpdir(), 'dsh-yzj-decode-zstd.mts')
  writeFileSync(decoder, `import { readFileSync } from 'node:fs'
import { zstdDecompressSync } from 'node:zlib'
import { scanZstdFrames } from '${harness}/packages/session/session-persistence-jsonl/src/zstd.ts'
const buf = readFileSync(process.argv[1])
const { frames } = scanZstdFrames(buf)
let text = ''
for (const frame of frames) text += zstdDecompressSync(buf.subarray(frame.start, frame.end)).toString('utf8')
process.stdout.write(text)
`)
  const ran = spawnSync('node', ['--import', 'tsx/esm', decoder, file], {
    cwd: harness,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  })
  if (ran.status !== 0) {
    console.log(`  [decode] ${ran.stderr?.slice(0, 240) ?? 'failed'}`)
    return ''
  }
  return ran.stdout
}

function newestTopicLog() {
  if (!existsSync(SESSIONS)) return ''
  const rows = readdirSync(SESSIONS)
    .filter(name => name.startsWith('yzj-topic-'))
    .map(name => {
      const dir = join(SESSIONS, name)
      const packed = join(dir, 'session.jsonl.zstd')
      const plain = join(dir, 'session.jsonl')
      const file = existsSync(packed) ? packed : existsSync(plain) ? plain : ''
      const mtime = file === '' ? 0 : statSync(file).mtimeMs
      return { name, file, mtime, packed: file.endsWith('.zstd') }
    })
    .filter(row => row.file !== '')
    .sort((a, b) => b.mtime - a.mtime)
  return rows[0]
}

const browser = await chromium.launch({
  ...(CHROME === undefined ? {} : { executablePath: CHROME }),
  headless: process.env.E2E_HEADED === '1' ? false : true,
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.log(`  [pageerror] ${String(e).slice(0, 240)}`))

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(5000)

const dock = page.getByTestId('yzj-group-space')
await dock.waitFor({ state: 'visible', timeout: 25000 })
await page.getByTestId('yzj-dock-home').click()
const list = page.getByTestId('yzj-conv-list')
const listUp = await list.waitFor({ state: 'visible', timeout: 12000 }).then(() => true).catch(() => false)
ok('云之家 opens the workbench', listUp)
if (!listUp) {
  await page.screenshot({ path: join(OUT, 'fail-no-list.png') })
  await browser.close()
  process.exit(1)
}

const groupRow = list.locator('button').filter({ hasText: GROUP }).first()
const found = await groupRow.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)
const alreadyOnGroup = await page.getByTestId('yzj-room-composer').getByText(GROUP).count().then(n => n > 0).catch(() => false)
ok(`list includes ${GROUP} or last seat is that room`, found || alreadyOnGroup)
if (!found && !alreadyOnGroup) {
  await page.screenshot({ path: join(OUT, 'fail-no-group.png') })
  await browser.close()
  process.exit(1)
}
if (found) await groupRow.click()
const streamUp = await page.getByTestId('yzj-fused-stream').waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false)
ok('timeline visible', streamUp)

const rows = page.locator('[data-testid^="yzj-room-row-"]')
const rowCount = await rows.count()
let handed = false
for (let index = rowCount - 1; index >= 0 && !handed; index -= 1) {
  const row = rows.nth(index)
  await row.hover()
  const handoff = row.getByRole('button', { name: '交给助手' })
  if (await handoff.count() === 0) continue
  await handoff.click()
  handed = true
}
ok('clicked 交给助手 on a free row', handed)
const drawer = page.getByTestId('yzj-topic-drawer')
const drawerUp = await drawer.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false)
ok('topic drawer opened', drawerUp)
await page.screenshot({ path: join(OUT, 'drawer.png') })

if (drawerUp) {
  const input = drawer.getByLabel('问助手')
  await input.fill('这句话在问哪条群消息？先复述 groupId 和锚点。')
  await drawer.getByRole('button', { name: '发送' }).click()
  const userBubble = await page.getByTestId('yzj-lens-bubble-user').first()
    .waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)
  ok('drawer shows the user ask', userBubble)
  const assistant = await page.getByTestId('yzj-lens-bubble-assistant').first()
    .waitFor({ state: 'visible', timeout: 45000 }).then(() => true).catch(() => false)
  ok('drawer shows an assistant reply', assistant)
  await page.waitForTimeout(1500)
}
await page.screenshot({ path: join(OUT, 'after-ask.png') })
await browser.close()

let newest
let text = ''
for (let attempt = 0; attempt < 8 && text === ''; attempt += 1) {
  if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 800))
  newest = newestTopicLog()
  if (newest === undefined || newest === '') continue
  text = newest.packed ? readPackedLog(newest.file) : readFileSync(newest.file, 'utf8')
}
ok('found a yzj-topic session log', newest !== undefined && newest !== '')
if (newest === undefined || newest === '') {
  process.exit(failures === 0 ? 0 : 1)
}
console.log(`  log  ${newest.name}  (${newest.file})`)
ok('log decoded', text.includes('"type"'), `chars=${text.length}`)
ok('inject or snapshot has 本群最近消息', text.includes('本群最近消息'))
ok('window pins groupId', /groupId:\s+\S+/.test(text))
const hasSnapshot = text.includes('yzj-bound-window')
const hasInject = text.includes('本群最近消息')
ok(
  'yzj-bound-window in runtime snapshot (T5) or inject present',
  hasSnapshot || hasInject,
  hasSnapshot ? 'snapshot' : hasInject ? 'inject-only' : 'neither',
)

process.exit(failures === 0 ? 0 : 1)
