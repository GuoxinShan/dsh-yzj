/**
 * Browser acceptance for the advance-jump fix (pitfall-039): entering the im
 * domain with NO seated group must show the pick-a-group hint instead of the
 * host error "home-fused endpoint requires a groupId or sessionId payload";
 * a conv-list pick opens the room; an advance-detail msg-source jump
 * retargets the overlay timeline (imGroupFocus). Screenshots land in
 * shots-advance-jump/. Requires rebuilt client + running dsh web (:3080) +
 * logged-in yzj-cli for the group steps.
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots-advance-jump')
mkdirSync(OUT, { recursive: true })
const BASE = process.env.DSH_GUI ?? 'http://127.0.0.1:3080/'
const CHROME = [
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/opt/google/chrome/chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find(path => existsSync(path))

let failures = 0
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`)
  if (!cond) failures += 1
}

const browser = await chromium.launch({
  ...(CHROME === undefined ? {} : { executablePath: CHROME }),
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 1560, height: 940 }, locale: 'zh-CN' })
const pageErrors = []
page.on('pageerror', (error) => { pageErrors.push(String(error).slice(0, 200)) })

const skip = async (reason) => {
  console.log(`SKIP  ${reason}`)
  await page.screenshot({ path: join(OUT, 'skip.png') }).catch(() => {})
  await browser.close()
  process.exit(0)
}

/** Fresh web profiles paint the harness welcome + API-key cards over #root (pitfall-035). */
const dismissFirstRun = async () => {
  for (let step = 0; step < 4; step += 1) {
    const welcome = page.getByRole('dialog', { name: /内测声明|Internal Testing Notice/ })
    if (await welcome.isVisible().catch(() => false)) {
      await welcome.getByRole('button', { name: /继续|Continue/ }).click()
      await page.waitForTimeout(800)
      continue
    }
    const credential = page.getByRole('dialog', { name: /添加一个 API Key|Add an API key/ })
    if (await credential.isVisible().catch(() => false)) {
      await credential.getByRole('button', { name: /稍后配置|Configure later/ }).click()
      await page.waitForTimeout(800)
      continue
    }
    break
  }
}

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(5000)
await dismissFirstRun()

// --- 1. dock → workbench opens on the im domain with no seated group ---
const dock = page.getByTestId('yzj-group-space')
await dock.waitFor({ state: 'visible', timeout: 25000 })
await page.getByTestId('yzj-dock-home').click({ timeout: 8000 }).catch(() => {})
await page.waitForTimeout(2500)
const shell = page.getByTestId('yzj-room-shell')
await shell.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {})
ok('room shell mounted', await shell.count().then(n => n > 0))
await page.waitForTimeout(2500)
let bodyText = await page.locator('body').innerText().catch(() => '')
ok('no empty-payload home-fused error', !bodyText.includes('requires a groupId or sessionId'), bodyText.includes('requires a groupId or sessionId') ? 'error text present' : 'clean')
ok('pick-a-group hint shown', bodyText.includes('在左侧选择一个群开始。'))
await page.screenshot({ path: join(OUT, '1-no-seat-hint.png') })

// --- 2. a conv-list pick opens the room (needs a logged-in yzj-cli) ---
await page.waitForTimeout(2500)
const rows = page.locator('[data-testid^="yzj-conv-row-"]')
const rowCount = await rows.count()
let pickedName = ''
if (rowCount === 0) {
  await skip('no recent groups (yzj-cli not logged in or empty) — hint assertions already PASS')
}
const firstRow = rows.first()
pickedName = (await firstRow.innerText().catch(() => '')).split('\n')[0] ?? ''
await firstRow.click()
await page.waitForTimeout(5000)
bodyText = await page.locator('body').innerText().catch(() => '')
ok('group room opened after pick', !bodyText.includes('在左侧选择一个群开始。'), `picked ${pickedName.slice(0, 24)}`)
ok('still no empty-payload error', !bodyText.includes('requires a groupId or sessionId'))
await page.screenshot({ path: join(OUT, '2-room-opened.png') })

// --- 3. advance board → detail msg-source jump retargets the timeline ---
await page.getByTestId('yzj-workbench-tabs').getByRole('tab', { name: '推进' }).click()
await page.waitForTimeout(4500)
const pane = page.getByTestId('yzj-advance-pane')
await pane.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {})
// The queue aside always carries the「发起推进」 button, so item presence is
// decided by rendered item rows, not by pane text.
await page.waitForTimeout(1500)
const itemRows = pane.locator('[data-testid^="yzj-advance-item-"]')
if (await itemRows.count() === 0) {
  await skip('advance board rendered no item rows — cannot exercise the source jump')
}
// open the first item's detail, then any msg-source jump button
const firstCard = itemRows.first()
await firstCard.click()
await page.waitForTimeout(4000)
const jump = page.locator('[data-testid^="yzj-advance-source-jump-"]').first()
if (await jump.count() === 0) {
  console.log('INFO  detail has no msg source jump button (doc-only refs) — retarget covered by component spec')
} else {
  await jump.click()
  await page.waitForTimeout(5000)
  const domain = await page.getByTestId('yzj-room-shell').getAttribute('data-workbench-domain').catch(() => '')
  bodyText = await page.locator('body').innerText().catch(() => '')
  ok('jump lands on the im domain', domain === 'im', `domain=${domain}`)
  ok('jump shows a room, not the hint', !bodyText.includes('在左侧选择一个群开始。'))
  ok('jump shows no host error', !bodyText.includes('requires a groupId or sessionId'))
  await page.screenshot({ path: join(OUT, '3-jump-target.png') })
}

// --- 4. zero page errors ---
ok('zero page errors', pageErrors.length === 0, pageErrors.join(' | '))

await browser.close()
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
