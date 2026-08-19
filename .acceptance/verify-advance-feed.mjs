/**
 * Browser acceptance for AI推进 ②期 (ai-advance-design §11) against the
 * live GUI (:3080). Requires rebuilt client + running dsh web + logged-in
 * yzj-cli. Journey: 推进 tab → 现在反馈 → 对话域事项卡 → 群房间「喂给推进」
 * picker. Unlogged GUI skips with exit 0. Screenshots land in shots-advance-feed/.
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots-advance-feed')
mkdirSync(OUT, { recursive: true })
const BASE = process.env.DSH_GUI ?? 'http://127.0.0.1:3080/'
const GROUP_NAME = process.env.YZJ_E2E_GROUP ?? '测试群'
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
  headless: process.env.E2E_HEADED === '1' ? false : true,
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

const dock = page.getByTestId('yzj-group-space')
const dockUp = await dock.waitFor({ state: 'visible', timeout: 25000 }).then(() => true).catch(() => false)
if (!dockUp) await skip('云之家 dock not mounted — GUI not running the yzj bundle')
const home = page.getByTestId('yzj-dock-home')
await home.click({ timeout: 8000 }).catch(() => home.click({ force: true }))
await page.waitForTimeout(2500)

const tabs = page.getByTestId('yzj-workbench-tabs')
await tabs.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {})
ok('top tabs include 推进', (await tabs.innerText().catch(() => '')).includes('推进'))

await tabs.getByRole('tab', { name: '推进' }).click()
await page.waitForTimeout(4500)
const pane = page.getByTestId('yzj-advance-pane')
await pane.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {})
ok('advance pane mounted', await pane.count().then(n => n > 0))
await page.screenshot({ path: join(OUT, '0-advance-tab.png') })
if (await page.getByTestId('yzj-login-banner').count() > 0) {
  await skip('yzj-cli not logged in on this machine — chrome OK, write-path skipped')
}
let paneText = await pane.innerText().catch(() => '')
if (paneText.includes('推进看板还没有开通')) {
  await page.getByTestId('yzj-advance-ensure').click()
  await page.waitForTimeout(12000)
  paneText = await pane.innerText().catch(() => '')
}

const startButton = await page.getByTestId('yzj-advance-start').count() > 0
  ? page.getByTestId('yzj-advance-start')
  : page.getByTestId('yzj-advance-start-hero')
await startButton.click()
const modal = page.getByTestId('yzj-advance-start-modal')
await modal.waitFor({ state: 'visible', timeout: 8000 })
const stamp = Date.now().toString().slice(-6)
await page.getByTestId('yzj-advance-draft-title').fill(`喂入探针 ${stamp}`)
await page.getByTestId('yzj-advance-draft-goal').fill('②期真机走查探针')
await page.getByTestId('yzj-advance-create').click()
await page.waitForTimeout(12000)
ok('probe item created', (await pane.innerText().catch(() => '')).includes(`喂入探针 ${stamp}`))

const feedback = page.getByTestId('yzj-advance-feedback')
await feedback.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {})
ok('现在反馈 on the kicker', await feedback.count().then(n => n > 0))
await page.screenshot({ path: join(OUT, '1-board-feedback.png') })
await feedback.click()
await page.waitForTimeout(2000)

const domain = await page.locator('[data-testid="yzj-room-shell"]').getAttribute('data-workbench-domain').catch(() => '')
ok('现在反馈 switches to 对话', domain === 'im', domain ?? '')
const card = page.getByTestId('yzj-advance-feedback-card')
await card.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {})
ok('事项卡 on the timeline', await card.count().then(n => n > 0), await card.innerText().catch(() => ''))
await page.screenshot({ path: join(OUT, '2-feedback-card.png') })

await card.getByTestId('yzj-advance-feedback-summary').fill('真机口头进度')
await card.getByTestId('yzj-advance-feedback-send').click()
await page.waitForTimeout(8000)
ok('事项卡 clears after feed', await card.count().then(n => n === 0))

const groupRow = page.getByTestId('yzj-conv-list').locator('button').filter({ hasText: GROUP_NAME }).first()
const groupFound = await groupRow.count().then(n => n > 0).catch(() => false)
ok(`list includes ${GROUP_NAME}`, groupFound)
if (groupFound) {
  await groupRow.click()
  await page.waitForTimeout(2500)
  const row = page.locator('[data-testid^="yzj-room-row-"]').first()
  await row.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
  await row.hover()
  const feedBtn = page.locator('[data-testid^="yzj-advance-feed-"]').first()
  const feedReady = await feedBtn.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)
  ok('群房间 hover 喂给推进', feedReady)
  if (feedReady) {
    await feedBtn.click()
    await page.waitForTimeout(1500)
    const picker = page.getByTestId('yzj-advance-feed-picker')
    ok('picker opens', await picker.count().then(n => n > 0))
    ok('picker says 不改阶段', (await picker.innerText().catch(() => '')).includes('不改阶段'))
    await page.screenshot({ path: join(OUT, '3-picker.png') })
    await picker.getByTestId('yzj-advance-feed-submit').click()
    await page.waitForTimeout(8000)
    ok('picker closed after feed', await picker.count().then(n => n === 0))
  }
}

await tabs.getByRole('tab', { name: '推进' }).click()
await page.waitForTimeout(4000)
const timeline = page.getByTestId('yzj-advance-timeline')
const tlText = await timeline.innerText().catch(() => '')
ok('timeline has user 进度更新', tlText.includes('进度更新') || tlText.includes('真机口头进度') || tlText.includes('群'))
await page.screenshot({ path: join(OUT, '4-timeline.png') })
ok('zero page errors', pageErrors.length === 0, pageErrors.join(' | '))

await browser.close()
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
