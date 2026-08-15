/**
 * Confirmation-card E2E for the todo family: a real agent turn calls
 * yzj_todo_create → approval gate → todo-domain confirmation card → 确认
 * click → real record written → CLI cross-check → cleanup. Runs against the
 * isolated :3091 instance with a logged-in yzj-cli.
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const runCli = async (...args) => {
  const { stdout } = await promisify(execFile)('cmd.exe', ['/c', 'yzj-cli', ...args])
  return JSON.parse(stdout)
}

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots-todo-e2e')
mkdirSync(OUT, { recursive: true })
const shot = (name) => join(OUT, name)

const TITLE = '确认卡E2E·待办探针'
const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find(path => existsSync(path))

let failures = 0
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`)
  if (!cond) failures++
}

// Discover the real library the way the tool core does (scan personal
// workspaces for 待办任务库) — never hardcode the doc id.
const schemaAll = await runCli('doc', 'workspace', 'list', '--type', 'personal')
const wsList = Array.isArray(schemaAll) ? schemaAll : (schemaAll.list ?? [])
let LIB = ''
let TABLE_ID = 0
for (const ws of wsList) {
  const docs = await runCli('doc', 'list', '--workspace', ws.id)
  const nodes = Array.isArray(docs) ? docs : (docs.list ?? [])
  const hit = nodes.find(node => node.fileSuffix === 'dbt' && node.title === '待办任务库')
  if (hit === undefined) continue
  const sheet = await runCli('sheet', 'get', '--id', hit.id)
  const table = (sheet.sheets ?? []).find(t => (t.fields ?? []).some(f => f.name === 'todo_id'))
  if (table !== undefined) { LIB = hit.id; TABLE_ID = table.id; break }
}
ok('待办任务库 discovered', LIB !== '', LIB)

const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)))

await page.goto('http://127.0.0.1:3091/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(6000)

// Fresh session, then prompt the agent through the tool path.
await page.getByRole('button', { name: '新建会话' }).first().click().catch(() => {})
await page.waitForTimeout(3000)
const draft = page.locator('textarea').first()
await draft.waitFor({ state: 'visible', timeout: 15000 })
const prompt = `请使用 yzj_todo_create 工具（必须走工具调用，不要用 pwsh/bash 直调 yzj-cli）创建一条待办：标题「${TITLE}」，标签 e2e，优先级 P1。`
await draft.click()
await draft.fill(prompt)
await page.screenshot({ path: shot('1-prompt.png') })
await page.getByRole('button', { name: '发送消息' }).first().click()
console.log('INFO  prompt sent; waiting for the todo confirmation card…')

let cardSeen = false
let sawShell = false
for (let i = 0; i < 60; i += 1) {
  await page.waitForTimeout(3000)
  const text = await page.evaluate(() => document.body.innerText)
  if (text.includes('需确认')) { cardSeen = true; break }
  if (text.includes('Pwsh') || text.includes('bash')) sawShell = true
}
ok('todo confirmation card appears (pending)', cardSeen)
ok('model routed through the tool, not shell', !sawShell || cardSeen)

if (cardSeen) {
  await page.screenshot({ path: shot('2-card-pending.png') })
  const cardText = await page.evaluate(() => document.body.innerText)
  ok('card shows 新建待办 title', cardText.includes('新建待办'))
  ok('card shows the todo title argument', cardText.includes(TITLE))
  ok('card shows #e2e tag', cardText.includes('#e2e'))
  ok('card offers 确认/取消/查看上下文', cardText.includes('确认') && cardText.includes('取消') && cardText.includes('查看上下文'))

  await page.screenshot({ path: shot('3-card.png') })
  await page.locator('button', { hasText: /^确认$/ }).first().click()
  console.log('INFO  确认 clicked; waiting for the real write…')
  let settled = false
  let finalText = ''
  for (let i = 0; i < 40; i += 1) {
    await page.waitForTimeout(3000)
    finalText = await page.evaluate(() => document.body.innerText)
    if (/T-\d{8}-\d{3}/.test(finalText) || finalText.includes('已创建') || finalText.includes('已取消') || finalText.includes('失败')) { settled = true; break }
  }
  ok('tool settled after confirmation', settled, finalText.split('需确认')[0].slice(-80).replace(/\n/g, ' '))
  await page.screenshot({ path: shot('4-settled.png') })
}

// Cross-check the record really landed in the discovered library.
const list = await runCli('sheet', 'record', 'list', '--id', LIB, '--table-id', String(TABLE_ID), '--limit', '100')
const probeRecords = (list.records ?? []).filter(rec => { try { return JSON.parse(rec.fields).标题 === TITLE } catch { return false } })
ok('record really written to the sheet library', probeRecords.length > 0)
if (probeRecords.length > 0) {
  const fields = JSON.parse(probeRecords[probeRecords.length - 1].fields)
  ok('record carries the #e2e tag', String(fields['标签']).includes('#e2e'))
  ok('record carries the progress log', String(fields['推进日志']).includes('创建'))
}

// Cleanup ALL probe-titled records from this and prior runs (quoted comma
// string — pwsh's bare comma would split into an array).
const probeIds = (list.records ?? [])
  .filter(rec => { try { return JSON.parse(rec.fields).标题 === TITLE || JSON.parse(rec.fields).标题 === '浏览器验收待办' || JSON.parse(rec.fields).标题 === '样式探针' } catch { return false } })
  .map(rec => rec.id)
if (probeIds.length > 0) {
  await runCli('sheet', 'record', 'delete', '--id', LIB, '--table-id', String(TABLE_ID), '--record-ids', probeIds.join(','))
  console.log(`cleanup: deleted ${probeIds.length} probe record(s)`)
} else {
  console.log('cleanup: nothing to delete')
}

ok('zero page errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '))
await browser.close()
console.log(failures === 0 ? '\n==== ALL PASS ====' : `\n==== ${failures} FAILURES ====`)
process.exit(failures === 0 ? 0 : 1)
