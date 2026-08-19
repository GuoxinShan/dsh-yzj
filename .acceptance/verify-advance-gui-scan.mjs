/**
 * Drive the live GUI (:3080) to call yzj_advance_scan in a new Chat session,
 * then assert the 推进 queue head shows 上次巡检 (host cursor, not sidecar).
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, 'shots-advance-gui-scan')
mkdirSync(OUT, { recursive: true })
const BASE = process.env.DSH_GUI ?? 'http://127.0.0.1:3080/'
const PROMPT = '只调用一次 yzj_advance_scan，groups 传 ["dsh-2"]，不要 inspect，不要 feed。把返回的「巡检扫描」原样贴出来。'
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

const browser = await chromium.launch({
  ...(CHROME === undefined ? {} : { executablePath: CHROME }),
  headless: process.env.E2E_HEADED === '1' ? false : true,
})
const page = await browser.newPage({ viewport: { width: 1560, height: 940 }, locale: 'zh-CN' })
page.on('pageerror', (error) => { console.log('PAGEERROR', String(error).slice(0, 240)) })

const shot = (name) => page.screenshot({ path: join(OUT, name), fullPage: false })

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
await shot('0-loaded.png')

const dump = await page.evaluate(() => {
  const buttons = [...document.querySelectorAll('button')].slice(0, 40).map((el) => ({
    name: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40),
    testid: el.getAttribute('data-testid') ?? '',
  }))
  const fields = [...document.querySelectorAll('textarea, [contenteditable="true"], [placeholder]')].map((el) => ({
    tag: el.tagName,
    ph: el.getAttribute('placeholder') ?? '',
    aria: el.getAttribute('aria-label') ?? '',
    visible: el.getClientRects().length > 0,
  }))
  return { buttons, fields }
})
console.log('DUMP buttons', JSON.stringify(dump.buttons, null, 0))
console.log('DUMP fields', JSON.stringify(dump.fields, null, 0))

const composer = page.getByPlaceholder(/描述你想要构建的内容|给智能体发消息/).first()
const composerAlt = page.locator('textarea:visible, [contenteditable="true"]:visible').first()
if (await composer.count() > 0) {
  await composer.waitFor({ state: 'visible', timeout: 10_000 })
  await composer.click()
  await composer.fill(PROMPT)
} else {
  await composerAlt.waitFor({ state: 'visible', timeout: 15_000 })
  await composerAlt.click()
  await composerAlt.fill(PROMPT)
}
ok('composer filled', true)
const send = page.getByRole('button', { name: /发送消息/ }).first()
if (await send.count() > 0 && await send.isVisible().catch(() => false)) {
  await send.click()
} else {
  await page.locator('button').filter({ has: page.locator('svg') }).last().click().catch(async () => {
    await (await composer.count() > 0 ? composer : composerAlt).press('Meta+Enter')
  })
}
await shot('2-sent.png')

const deadline = Date.now() + 150_000
let body = ''
let foundScan = false
while (Date.now() < deadline) {
  await page.waitForTimeout(2500)
  body = await page.locator('body').innerText().catch(() => '')
  if (body.includes('巡检扫描') || body.includes('yzj_advance_scan')) {
    foundScan = body.includes('巡检扫描')
    break
  }
}
ok('model returned 巡检扫描', foundScan, body.includes('巡检扫描') ? 'digest visible' : body.slice(-400).replace(/\n+/g, ' | '))
await shot('3-scan-result.png')
if (foundScan) {
  const index = body.lastIndexOf('巡检扫描')
  console.log('\n=== digest ===\n' + body.slice(Math.max(0, index), index + 800).replace(/\n{3,}/g, '\n\n'))
}

const home = page.getByTestId('yzj-dock-home')
if (await home.count() > 0) {
  await home.click({ timeout: 8000 }).catch(() => home.click({ force: true }))
  await page.waitForTimeout(1500)
}
const tabs = page.getByTestId('yzj-workbench-tabs')
const tabsUp = await tabs.waitFor({ state: 'visible', timeout: 15_000 }).then(() => true).catch(() => false)
ok('workbench tabs visible', tabsUp)
if (tabsUp) await tabs.getByRole('tab', { name: '推进' }).click()
const pane = page.getByTestId('yzj-advance-pane')
const paneUp = await pane.waitFor({ state: 'visible', timeout: 20_000 }).then(() => true).catch(() => false)
ok('推进 pane visible', paneUp)
await page.waitForTimeout(3000)

const status = page.getByTestId('yzj-advance-scan-status')
const statusUp = await status.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)
const text = statusUp ? (await status.innerText()) : ''
ok('queue head is 上次巡检 (host cursor)', statusUp && text.includes('上次巡检'), text)
await shot('4-advance-status.png')

await browser.close()
if (failures > 0) process.exit(1)
console.log('ALL PASS')
