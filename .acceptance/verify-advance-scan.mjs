/**
 * Browser acceptance for AI推进 v1.4 patrol status line (ai-advance-design §14.5)
 * against the live GUI (:3080). Requires rebuilt client + running dsh web.
 * Unlogged GUI / missing dock skips with exit 0. Screenshots land in
 * shots-advance-scan/.
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots-advance-scan')
mkdirSync(OUT, { recursive: true })
const BASE = process.env.DSH_GUI ?? 'http://127.0.0.1:3080/'
const CHROME = [
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/opt/google/chrome/chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
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
await tabs.getByRole('tab', { name: '推进' }).click()
const pane = page.getByTestId('yzj-advance-pane')
const paneUp = await pane.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)
if (!paneUp) await skip('推进 pane not visible')
await page.waitForTimeout(3000)

const status = page.getByTestId('yzj-advance-scan-status')
const statusUp = await status.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)
const text = statusUp ? (await status.innerText()) : ''
ok('queue head has patrol status', statusUp && (text.includes('尚未巡检') || text.includes('上次巡检')), text)
await page.screenshot({ path: join(OUT, '1-scan-status.png') })
ok('no page errors', pageErrors.length === 0, pageErrors.join(' | '))

await browser.close()
if (failures > 0) process.exit(1)
console.log('ALL PASS')
