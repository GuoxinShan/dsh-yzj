/**
 * Show the closed-loop probe on the live 推进 board after
 * advance-patrol-driver.ts has fed a scanned group message.
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, 'shots-advance-patrol')
mkdirSync(OUT, { recursive: true })
const BASE = process.env.DSH_GUI ?? 'http://127.0.0.1:3080/'
const TITLE = process.env.YZJ_PATROL_TITLE ?? ''
const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
].find(path => existsSync(path))

let failures = 0
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`)
  if (!cond) failures += 1
}

const headed = process.env.E2E_HEADED === '1'
const browser = await chromium.launch({
  ...(CHROME === undefined ? {} : { executablePath: CHROME }),
  headless: !headed,
  slowMo: headed ? 80 : 0,
})
const page = await browser.newPage({ viewport: { width: 1560, height: 940 }, locale: 'zh-CN' })
page.on('pageerror', (error) => { console.log('PAGEERROR', String(error).slice(0, 200)) })

const skip = async (reason) => {
  console.log(`SKIP  ${reason}`)
  await page.screenshot({ path: join(OUT, 'skip.png') }).catch(() => {})
  await browser.close()
  process.exit(0)
}

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
await page.waitForTimeout(4000)
await dismissFirstRun()

const dock = page.getByTestId('yzj-group-space')
const dockUp = await dock.waitFor({ state: 'visible', timeout: 25000 }).then(() => true).catch(() => false)
if (!dockUp) await skip('云之家 dock not mounted')
await page.getByTestId('yzj-dock-home').click({ timeout: 8000 }).catch(() => {})
await page.waitForTimeout(2000)
const tabs = page.getByTestId('yzj-workbench-tabs')
await tabs.waitFor({ state: 'visible', timeout: 15000 })
await tabs.getByRole('tab', { name: '推进' }).click()
const pane = page.getByTestId('yzj-advance-pane')
await pane.waitFor({ state: 'visible', timeout: 20000 })
await page.waitForTimeout(5000)

const queue = page.getByTestId('yzj-advance-queue')
const queueText = await queue.innerText().catch(() => '')
ok('queue visible', queueText.includes('我的推进'), queueText.slice(0, 80).replace(/\n/g, ' '))
const title = TITLE === '' ? '巡检闭环' : TITLE
const probe = page.getByTestId('yzj-advance-queue').getByText(title)
const found = await probe.count().then(n => n > 0)
ok('probe item on the board', found, title)
if (found) await probe.first().click()
await page.waitForTimeout(4000)
const detail = page.getByTestId('yzj-advance-detail')
const detailText = await detail.innerText().catch(() => '')
ok('timeline mentions 巡检发现', detailText.includes('巡检发现'), detailText.slice(0, 180).replace(/\n/g, ' '))
await page.screenshot({ path: join(OUT, '1-patrol-board.png') })
console.log(`SHOT  ${join(OUT, '1-patrol-board.png')}`)

if (headed) await page.waitForTimeout(4000)
await browser.close()
if (failures > 0) process.exit(1)
console.log('ALL PASS')
