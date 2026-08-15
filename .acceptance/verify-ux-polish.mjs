/**
 * UX-polish acceptance for the EXISTING tabs (isolated :3091, logged-in CLI):
 * 1. 日程 opens with TODAY preselected (no empty right pane) + 今天 button.
 * 2. 知识库 folder drill-down: chevron rows for parents, breadcrumb trail,
 *    back navigation.
 * 3. Esc closes the panel.
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

const now = new Date()
const pad = (n) => String(n).padStart(2, '0')
const todayCn = `${now.getMonth() + 1}月${now.getDate()}日`

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

// --- 1. calendar: today preselected + 今天 button ---
await dialog.locator('nav button').filter({ hasText: '日程' }).first().click()
await page.waitForTimeout(4000)
let text = await dialog.innerText()
ok('日程 opens with today preselected', text.includes('今天 · 周'), text.slice(0, 60).replace(/\n/g, ' '))
ok('day pane shows events or the empty-day notice', text.includes('当天暂无日程') || /→/.test(text))
ok('今天 quick button present', await dialog.locator('button', { hasText: '今天' }).count() === 1)
// Navigate away, then 今天 returns to today.
await dialog.locator('button[aria-label="上个月"]').click()
await page.waitForTimeout(2500)
await dialog.locator('button', { hasText: '今天' }).click()
await page.waitForTimeout(2500)
text = await dialog.innerText()
ok('今天 jumps back to the current month + today', text.includes(`${now.getFullYear()}年${now.getMonth() + 1}月`) && text.includes('今天 · 周'))
// Reopening the tab re-lands on today even after browsing another month.
await dialog.locator('button[aria-label="上个月"]').click()
await page.waitForTimeout(2000)
await dialog.locator('nav button').filter({ hasText: '会话' }).first().click()
await page.waitForTimeout(800)
await dialog.locator('nav button').filter({ hasText: '日程' }).first().click()
await page.waitForTimeout(3000)
text = await dialog.innerText()
ok('reopening 日程 re-lands on today', text.includes('今天 · 周'))

// --- 2. docs: folder drill-down ---
await dialog.locator('nav button').filter({ hasText: '知识库' }).first().click()
await page.waitForTimeout(4000)
// Prefer a workspace known to carry folders; otherwise scan the list.
const wsButtons = dialog.locator('div[class*="paneLeft"] button[class*="item"]')
const total = await wsButtons.count()
let drilled = false
let label = ''
const known = dialog.locator('div[class*="paneLeft"] button[class*="item"]').filter({ hasText: '安全管理体系制度文档' }).first()
const candidates = []
if (await known.count() > 0) candidates.push(known)
for (let i = 0; i < Math.min(total, 24); i += 1) candidates.push(wsButtons.nth(i))
for (const candidate of candidates) {
  await candidate.click()
  await page.waitForTimeout(2200)
  const drill = dialog.locator('button[class*="drill"]').first()
  if (await drill.count() > 0) {
    label = await drill.getAttribute('aria-label') ?? ''
    await drill.click()
    await page.waitForTimeout(2200)
    const crumbs = dialog.locator('nav[class*="crumbs"]')
    const crumbVisible = await crumbs.count() > 0
    const crumbText = crumbVisible ? await crumbs.innerText() : ''
    ok('folder chevron drills into children', crumbVisible, `crumb: ${crumbText.replace(/\n/g, ' ').slice(0, 60)}`)
    ok('breadcrumb shows the folder as current', crumbText.includes('/'))
    await crumbs.locator('button').first().click()
    await page.waitForTimeout(2200)
    const afterBack = await dialog.locator('nav[class*="crumbs"]').count()
    ok('root crumb returns to the workspace level', afterBack === 0)
    drilled = true
    break
  }
}
ok('at least one workspace exposes a drillable folder', drilled, drilled ? `via ${label}` : 'none found in 24 workspaces')

// --- 3. Esc closes the panel ---
await page.keyboard.press('Escape')
await page.waitForTimeout(1200)
const panelGone = (await page.getByRole('dialog', { name: '云之家' }).count()) === 0
ok('Esc closes the panel', panelGone)

ok('zero page errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '))
await browser.close()
console.log(failures === 0 ? '\n==== ALL PASS ====' : `\n==== ${failures} FAILURES ====`)
process.exit(failures === 0 ? 0 : 1)
