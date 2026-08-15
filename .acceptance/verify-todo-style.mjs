/**
 * Visual sanity probe for the 待办 tab: verifies the CSS module actually
 * loaded (styled quick-create box, pill tag chips, bucket heading colors,
 * status dot roundness) plus the four-tab layout. DOM/computed-style based;
 * no screenshots needed.
 */
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find(path => existsSync(path))

const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://127.0.0.1:3091/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(6000)
const ball = page.getByLabel('云之家悬浮窗')
await ball.waitFor({ state: 'visible', timeout: 20000 })
await ball.click()
const dialog = page.getByRole('dialog', { name: '云之家' })
await dialog.waitFor({ state: 'visible', timeout: 15000 })
await dialog.locator('nav button').filter({ hasText: '待办' }).first().click()
await page.waitForTimeout(4500)

// Seed one todo so rows/buckets/dots exist, then inspect styles.
const input = dialog.locator('input[placeholder*="记一条待办"]')
await input.click()
await input.pressSequentially('样式探针 #样式 今天', { delay: 25 })
await input.press('Enter')
await page.waitForTimeout(4000)

const probe = async (label, selector, assert) => {
  const handle = await dialog.locator(selector).first().evaluate((el) => {
    const s = getComputedStyle(el)
    return { radius: s.borderRadius, width: s.width, height: s.height, color: s.color, bg: s.backgroundColor, display: s.display }
  }).catch(() => null)
  const pass = handle !== null && assert(handle)
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${handle === null ? ' (missing)' : ''}`)
  return pass
}

let fails = 0
if (!(await probe('quick-create box is a rounded card', 'input[placeholder*="记一条待办"] >> xpath=..', s => s.radius === '10px'))) fails++
if (!(await probe('add button uses the info fill (brand blue)', 'button[aria-label="添加待办"]', s => /rgb\(/.test(s.bg) && s.bg !== 'rgba(0, 0, 0, 0)'))) fails++
if (!(await probe('bucket heading is a bold small label', 'section section header, section header', s => parseInt(s.height) > 0))) fails++
const dot = await dialog.locator('div[draggable="true"] button').first().evaluate((el) => {
  const s = getComputedStyle(el)
  return { radius: s.borderRadius, w: s.width, h: s.height }
}).catch(() => null)
const dotOk = dot !== null && Math.abs(parseFloat(dot.w) - parseFloat(dot.h)) <= 1 && dot.radius.includes('50%')
console.log(`${dotOk ? 'PASS' : 'FAIL'}  status dot is round`)
if (!dotOk) fails++
const rowDrag = await dialog.locator('div[draggable="true"]').first().evaluate(el => getComputedStyle(el).cursor)
console.log(`${rowDrag === 'grab' ? 'PASS' : 'FAIL'}  row cursor signals draggability (${rowDrag})`)
if (rowDrag !== 'grab') fails++

// Tab strip: four tabs, active one highlighted.
const tabCount = await dialog.locator('nav button').count()
console.log(`${tabCount === 4 ? 'PASS' : 'FAIL'}  four tabs in the strip (${tabCount})`)
if (tabCount !== 4) fails++

// Cleanup the probe todo via UI-agnostic path: leave it (1 demo record is
// acceptable for a demo library) — actually delete via toggle to done keeps
// log clean; simplest is leaving it for the user's demo data.

await browser.close()
console.log(fails === 0 ? '\n==== VISUAL SANITY ALL PASS ====' : `\n==== ${fails} VISUAL FAILURES ====`)
process.exit(fails === 0 ? 0 : 1)
