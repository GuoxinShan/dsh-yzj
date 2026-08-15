/**
 * Team-library acceptance (isolated :3091, real CLI): the switcher lists the
 * personal library, provisioning creates a real team library in a chosen
 * enterprise workspace, todos created in the panel land THERE, switching
 * back restores the personal library, and the probe library is cleaned up.
 */
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const runCli = async (...args) => {
  const { stdout } = await promisify(execFile)('cmd.exe', ['/c', 'yzj-cli', ...args])
  try { return JSON.parse(stdout) } catch { return { okText: stdout.trim() } }
}

const TEAM_WS = '6a70609b9aabf22a248395fd' // 六大场景内测 (perm 2, sandbox)
const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find(path => existsSync(path))

let failures = 0
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`)
  if (!cond) failures++
}

const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)))

await page.goto('http://127.0.0.1:3091/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(6000)
const ball = page.getByLabel('云之家悬浮窗')
await ball.waitFor({ state: 'visible', timeout: 20000 })
await ball.click()
const dialog = page.getByRole('dialog', { name: '云之家' })
await dialog.waitFor({ state: 'visible', timeout: 15000 })
await dialog.locator('nav button').filter({ hasText: '待办' }).first().click()
await page.waitForTimeout(5000)

// --- 1. switcher renders with the personal library (wait for readiness) ---
let text = ''
for (let i = 0; i < 15; i += 1) {
  text = await dialog.innerText()
  if (text.includes('个人 ·') || text.includes('团队 ·')) break
  await page.waitForTimeout(1200)
}
ok('switcher shows the personal library', text.includes('个人 ·'), text.slice(0, 60).replace(/\n/g, ' '))
const switcher = dialog.locator('button[aria-haspopup="listbox"]')
ok('switcher button present', await switcher.count() === 1)

// --- 2. open picker → provision team library in the sandbox workspace ---
await switcher.click()
await page.waitForTimeout(600)
text = await dialog.innerText()
ok('picker lists discovered libraries', text.includes('新建 / 选择团队任务库'))
const provision = dialog.locator('button').filter({ hasText: '新建 / 选择团队任务库' }).first()
await provision.click()
await page.waitForTimeout(2500)
text = await dialog.innerText()
ok('team workspace list opens with the permission hint', text.includes('选择团队知识库'))
const teamItem = dialog.locator('button').filter({ hasText: '六大场景内测' }).first()
ok('sandbox workspace offered', await teamItem.count() >= 1)
await teamItem.click()
console.log('INFO  provisioning team library…')
let provisioned = false
for (let i = 0; i < 20; i += 1) {
  await page.waitForTimeout(1500)
  text = await dialog.innerText()
  if (text.includes('团队任务库已就绪') || text.includes('团队 ·')) { provisioned = true; break }
}
ok('team library provisioned and active', provisioned, text.slice(0, 80).replace(/\n/g, ' '))

// --- 3. cross-check: the team library really exists in the workspace ---
const docs = await runCli('doc', 'list', '--workspace', TEAM_WS)
const nodes = Array.isArray(docs) ? docs : (docs.list ?? [])
const teamDoc = nodes.find(node => node.title === '待办任务库')
ok('待办任务库 exists in the enterprise workspace', teamDoc !== undefined)
let teamTableId = 0
if (teamDoc !== undefined) {
  const sheet = await runCli('sheet', 'get', '--id', teamDoc.id)
  const table = (sheet.sheets ?? []).find(t => (t.fields ?? []).some(f => f.name === 'todo_id'))
  ok('team library carries the 任务 table', table !== undefined)
  teamTableId = table?.id ?? 0
}

// --- 4. create a todo from the panel → it must land in the TEAM library ---
const input = dialog.locator('input[placeholder*="记一条待办"]')
await input.click()
await input.pressSequentially('团队协作验收 #团队 今天', { delay: 25 })
await input.press('Enter')
await page.waitForTimeout(4000)
text = await dialog.innerText()
ok('panel shows the created todo', text.includes('团队协作验收'))
if (teamDoc !== undefined && teamTableId > 0) {
  const list = await runCli('sheet', 'record', 'list', '--id', teamDoc.id, '--table-id', String(teamTableId), '--limit', '50')
  const hit = (list.records ?? []).find(rec => { try { return JSON.parse(rec.fields).标题 === '团队协作验收' } catch { return false } })
  ok('todo really written to the TEAM library', hit !== undefined)
  if (hit !== undefined) {
    const fields = JSON.parse(hit.fields)
    ok('team todo carries the #团队 tag', String(fields['标签']).includes('#团队'))
  }
}

// --- 5. switch back to the personal library ---
await switcher.click()
await page.waitForTimeout(600)
const personalItem = dialog.locator('[role="option"]').filter({ hasText: '个人 ·' }).first()
ok('personal library still offered', await personalItem.count() === 1)
await personalItem.click()
let back = false
for (let i = 0; i < 12; i += 1) {
  await page.waitForTimeout(1200)
  text = await dialog.innerText()
  if (text.includes('已切换任务库') && !text.includes('团队协作验收')) { back = true; break }
}
ok('switching back restores the personal library view', back, text.slice(0, 80).replace(/\n/g, ' '))

// --- 6. cleanup: delete the probe team library doc (sandbox workspace) ---
if (teamDoc !== undefined) {
  await runCli('doc', 'delete', '--id', teamDoc.id)
  console.log('cleanup: team probe library deleted')
}
ok('zero page errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '))

await browser.close()
console.log(failures === 0 ? '\n==== ALL PASS ====' : `\n==== ${failures} FAILURES ====`)
process.exit(failures === 0 ? 0 : 1)
