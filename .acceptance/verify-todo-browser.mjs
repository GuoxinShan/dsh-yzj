/**
 * Browser acceptance for the 待办 tab (isolated instance on :3091, real
 * logged-in yzj-cli). Journey walkthrough: floating ball → 待办 tab →
 * (library already provisioned by E2E) buckets + tag rail + quick-create →
 * optimistic checkbox → todo chip drag intent (row draggable) → demo
 * footnote → zero page errors.
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots-todo')
mkdirSync(OUT, { recursive: true })
const shot = (name) => join(OUT, name)

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

// --- 1. floating ball entry, panel opens, four tabs ---
const ball = page.getByLabel('云之家悬浮窗')
let ballVisible = false
try { await ball.waitFor({ state: 'visible', timeout: 20000 }); ballVisible = true } catch {}
ok('floating ball mounted', ballVisible)
if (!ballVisible) { console.log('ABORT: no entry'); await browser.close(); process.exit(1) }
await ball.click()
const dialog = page.getByRole('dialog', { name: '云之家' })
await dialog.waitFor({ state: 'visible', timeout: 15000 })
const tabsText = await dialog.innerText()
ok('panel has four tabs incl 待办', ['知识库', '日程', '会话', '待办'].every(t => tabsText.includes(t)))
await page.screenshot({ path: shot('1-panel.png') })

// --- 2. 待办 tab: real library loads ---
await dialog.locator('nav button').filter({ hasText: '待办' }).first().click()
await page.waitForTimeout(4500)
let todoText = await dialog.innerText().catch(() => '')
ok('todo tab loads (not the provisioning hero)', !todoText.includes('一键开通'), todoText.replace(/\n/g, ' ').slice(0, 80))
ok('quick-create input present', await dialog.locator('input[placeholder*="记一条待办"]').count() === 1)
ok('demo-stage footnote shown', todoText.includes('演示阶段') || todoText.includes('多维表格'))
ok('task-library link shown', todoText.includes('任务库'))
await page.screenshot({ path: shot('2-todo-empty.png') })

// --- 3. quick-create with #tag + date fragment ---
const input = dialog.locator('input[placeholder*="记一条待办"]')
await input.click()
await input.pressSequentially('浏览器验收待办 #验收 8月30日', { delay: 30 })
await page.waitForTimeout(600)
todoText = await dialog.innerText()
ok('parse hint previews title', todoText.includes('将创建') && todoText.includes('浏览器验收待办'))
ok('parse hint previews tag + ddl', todoText.includes('#验收') && todoText.includes('08/30'))
await page.screenshot({ path: shot('3-quickcreate-hint.png') })
await input.press('Enter')
await page.waitForTimeout(4000)
todoText = await dialog.innerText()
ok('todo appears after create', todoText.includes('浏览器验收待办'))
ok('tag chip appears in rail', todoText.includes('#验收'))
await page.screenshot({ path: shot('4-created.png') })

// --- 4. tag filter: click the #验收 chip ---
const chip = dialog.locator('button').filter({ hasText: '#验收' }).first()
await chip.click()
await page.waitForTimeout(800)
todoText = await dialog.innerText()
ok('tag filter active (rail chip + filtered rows)', (await dialog.locator('button[class*="tagChipActive"]').count()) >= 1)
await page.screenshot({ path: shot('5-tag-filter.png') })

// --- 5. optimistic complete toggle ---
const row = dialog.locator('div[draggable="true"]').filter({ hasText: '浏览器验收待办' }).first()
ok('todo row is draggable', await row.count() === 1)
const dot = row.locator('button').first()
await dot.click()
await page.waitForTimeout(2500)
todoText = await dialog.innerText()
ok('completed bucket shows the todo', todoText.includes('已完成'))
await page.screenshot({ path: shot('6-completed.png') })

// --- 6. cleanup: delete the probe records via the CLI (demo library stays clean) ---
try {
  const { execFile } = await import('node:child_process')
  const { promisify } = await import('node:util')
  const runCli = promisify(execFile)
  const sheetId = process.env.YZJ_TODO_SHEET_ID
  if (!sheetId) {
    console.log('cleanup skipped: set YZJ_TODO_SHEET_ID to delete probe records')
  } else {
  const schema = JSON.parse((await runCli('yzj-cli', ['sheet', 'get', '--id', sheetId])).stdout)
  const table = (schema.sheets ?? []).find(t => (t.fields ?? []).some(f => f.name === 'todo_id'))
  if (table !== undefined) {
    const listJson = JSON.parse((await runCli('yzj-cli', [
      'sheet', 'record', 'list', '--id', sheetId, '--table-id', String(table.id), '--limit', '100',
    ])).stdout)
    const ids = (listJson.records ?? [])
      .filter(rec => { try { return JSON.parse(rec.fields).标题?.includes('浏览器验收待办') } catch { return false } })
      .map(rec => rec.id)
      .filter(id => id !== undefined)
    if (ids.length > 0) {
      await runCli('yzj-cli', ['sheet', 'record', 'delete', '--id', sheetId, '--table-id', String(table.id), '--record-ids', ids.join(',')])
      console.log(`cleanup: deleted ${ids.length} probe record(s)`)
    }
  }
  }
} catch (error) {
  console.log(`cleanup skipped: ${String(error).slice(0, 120)}`)
}

// --- 7. zero page errors across the journey ---
await page.waitForTimeout(1500)
ok('zero page errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '))

await browser.close()
console.log(`\n==== ${failures === 0 ? 'ALL PASS' : failures + ' FAILURES'} ====`)
process.exit(failures === 0 ? 0 : 1)
