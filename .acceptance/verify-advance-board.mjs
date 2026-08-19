/**
 * Browser acceptance for the AI推进 board (fifth workbench tab, v1.18 /
 * ai-advance-design §7) against the live GUI (:3080). Requires rebuilt
 * client + running dsh web + logged-in yzj-cli. Journey: sidebar 云之家 →
 * overlay tabs incl 推进 → board (provision hero OR queue three groups) →
 * start modal → create → detail (kicker/goal/decision area/timeline/sources)
 * → zero page errors. Screenshots land in shots-advance/.
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots-advance')
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

// --- 1. single sidebar entry opens the overlay; five tabs incl 推进 ---
const dock = page.getByTestId('yzj-group-space')
await dock.waitFor({ state: 'visible', timeout: 25000 })
ok('dock visible', await dock.isVisible())
const home = page.getByTestId('yzj-dock-home')
await home.click({ timeout: 8000 }).catch(() => home.click({ force: true }))
await page.waitForTimeout(2000)

const tabs = page.getByTestId('yzj-workbench-tabs')
await tabs.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {})
const tabText = await tabs.innerText().catch(() => '')
ok('five top tabs incl 推进', ['对话', '待办', '日程', '知识库', '推进'].every(label => tabText.includes(label)), tabText.replace(/\n/g, ' '))
await page.screenshot({ path: join(OUT, '1-tabs.png') })

// --- 2. 推进 tab mounts the board ---
await tabs.getByRole('tab', { name: '推进' }).click()
await page.waitForTimeout(4500)
const pane = page.getByTestId('yzj-advance-pane')
await pane.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {})
ok('advance pane mounted', await pane.count().then(n => n > 0))
let paneText = await pane.innerText().catch(() => '')
await page.screenshot({ path: join(OUT, '2-board.png') })
if (await page.getByTestId('yzj-login-banner').count() > 0) {
  await skip('yzj-cli not logged in on this machine — chrome OK, write-path skipped')
}

// --- 3. provision on demand when the hero shows ---
if (paneText.includes('推进看板还没有开通')) {
  await page.getByTestId('yzj-advance-ensure').click()
  await page.waitForTimeout(12000)
  paneText = await pane.innerText().catch(() => '')
  ok('board provisioned from the hero', !paneText.includes('推进看板还没有开通'), paneText.slice(0, 80).replace(/\n/g, ' '))
  await page.screenshot({ path: join(OUT, '3-provisioned.png') })
}

// --- 4. queue chrome: three groups + prototype empty copy (when empty) ---
const queue = page.getByTestId('yzj-advance-queue')
const hasQueue = await queue.count().then(n => n > 0)
if (hasQueue) {
  const queueText = await queue.innerText()
  ok('queue three groups', ['待我决定', '待我验收', '我关注的推进'].every(label => queueText.includes(label)), queueText.slice(0, 100).replace(/\n/g, ' '))
} else {
  ok('board empty hero shows 发起推进', paneText.includes('发起推进') || paneText.includes('这件事还没有开始推进'))
}

// --- 5. start modal → create one probe item (user-direct write) ---
const startButton = hasQueue ? page.getByTestId('yzj-advance-start') : page.getByTestId('yzj-advance-start-hero')
await startButton.click()
const modal = page.getByTestId('yzj-advance-start-modal')
await modal.waitFor({ state: 'visible', timeout: 8000 })
ok('start modal fields', (await modal.innerText()).includes('这件事要做到什么'))
const stamp = Date.now().toString().slice(-6)
await page.getByTestId('yzj-advance-draft-title').fill(`验收探针推进 ${stamp}`)
await page.getByTestId('yzj-advance-draft-goal').fill('浏览器走查用探针，可随时清理')
await page.screenshot({ path: join(OUT, '4-start-modal.png') })
await page.getByTestId('yzj-advance-create').click()
await page.waitForTimeout(12000)
paneText = await pane.innerText().catch(() => '')
ok('created item appears', paneText.includes(`验收探针推进 ${stamp}`), paneText.slice(0, 120).replace(/\n/g, ' '))

// --- 6. detail chrome: kicker / goal / decision area / timeline / sources ---
const detail = page.getByTestId('yzj-advance-detail')
const detailText = await detail.innerText().catch(() => '')
ok('detail kicker + stage pill', /A-\d{8}-\d{3}/.test(detailText) && detailText.includes('草稿'))
ok('goal section', detailText.includes('这件事要做到什么'))
ok('decision area (quiet on draft)', detailText.includes('接下来会怎样'))
ok('timeline section with 立项 entry', detailText.includes('已经推进到这里') && detailText.includes('立项'))
ok('sources column + PRD footnote', detailText.includes('当前判断来自哪里') && detailText.includes('AI 推进不建立新的文件库'))
await page.screenshot({ path: join(OUT, '5-detail.png') })

// --- 7. zero page errors ---
ok('zero page errors', pageErrors.length === 0, pageErrors.join(' | '))

await browser.close()
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
