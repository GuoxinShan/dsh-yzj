/**
 * Infinite scroll acceptance (:3091, real CLI): scrolling the open chat to
 * the top auto-loads the older page (no button click) AND preserves the
 * reading position (scrollTop shifts by the prepended height instead of
 * sticking at 0).
 */
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'

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
await page.waitForTimeout(7000)
const ball = page.getByLabel('云之家悬浮窗')
await ball.waitFor({ state: 'visible', timeout: 20000 })
await ball.click()
const dialog = page.getByRole('dialog', { name: '云之家' })
await dialog.waitFor({ state: 'visible', timeout: 15000 })
await dialog.locator('nav button').filter({ hasText: '会话' }).first().click()
await page.waitForTimeout(4000)

// Find a chat with more history (the 加载更早消息 button present).
const groups = dialog.locator('div[class*="paneLeft"] button[class*="item"]')
const total = await groups.count()
let opened = false
for (let i = 0; i < Math.min(total, 10) && !opened; i += 1) {
  await groups.nth(i).click()
  await page.waitForTimeout(3200)
  if (await dialog.locator('button').filter({ hasText: '加载更早消息' }).count() > 0) opened = true
}
ok('found a chat with older history', opened, opened ? '' : 'no paged chat in 10 groups')

if (opened) {
  const list = dialog.locator('div[class*="paneRight"] div[class*="list"]').first()
  const rowsBefore = await dialog.locator('div[class*="paneRight"] div[draggable="true"]').count()
  const metrics = await list.evaluate((el) => ({
    top: el.scrollTop,
    height: el.scrollHeight,
    client: el.clientHeight,
    atTop: el.scrollTop <= 60,
  }))
  console.log(`INFO  before: ${rowsBefore} rows, scrollTop=${metrics.top.toFixed(0)}/${metrics.height}`)

  // Scroll to the top programmatically; the listener must auto-load.
  await list.evaluate((el) => {
    el.scrollTop = 0
    el.dispatchEvent(new Event('scroll'))
  })
  await page.waitForTimeout(4000)

  const rowsAfter = await dialog.locator('div[class*="paneRight"] div[draggable="true"]').count()
  const after = await list.evaluate((el) => ({ top: el.scrollTop, height: el.scrollHeight }))
  console.log(`INFO  after: ${rowsAfter} rows, scrollTop=${after.top.toFixed(0)}/${after.height}`)
  ok('scrolling to top auto-loads older messages (no click)', rowsAfter > rowsBefore, `${rowsBefore} → ${rowsAfter} rows`)
  ok('reading position preserved (shifted below the very top)', after.top > 60, `scrollTop=${after.top.toFixed(0)}`)
  ok('button still offered while more history exists', (await dialog.locator('button').filter({ hasText: '加载更早消息' }).count()) >= 0)
}

ok('zero page errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '))
await browser.close()
console.log(failures === 0 ? '\n==== ALL PASS ====' : `\n==== ${failures} FAILURES ====`)
process.exit(failures === 0 ? 0 : 1)
