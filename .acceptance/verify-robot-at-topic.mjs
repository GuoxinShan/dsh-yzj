/**
 * H4: @机器人 inbound → group-room topic. Live @ requires the Yunzhijia
 * push; this script does not spawn yzj-cli writes (AGENTS.md).
 *
 * Skip (exit 0) when the dock says 未配置 / 未连接.
 * When connected: assert the dock + a group room can open the topic drawer.
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots-robot-at-topic')
mkdirSync(OUT, { recursive: true })
const shot = (name) => join(OUT, name)

const GROUP_NAME = process.env.YZJ_E2E_GROUP ?? '金蝶最小DSH交流群'
const BASE = process.env.DSH_GUI ?? 'http://127.0.0.1:3080/'

const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find(path => existsSync(path))

let failures = 0
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`)
  if (!cond) failures++
}

const browser = await chromium.launch({
  ...(CHROME === undefined ? {} : { executablePath: CHROME }),
  headless: process.env.E2E_HEADED === '1' ? false : true,
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.log(`  [pageerror] ${String(e).slice(0, 240)}`))

try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(5000)

  const dock = page.getByTestId('yzj-group-space')
  await dock.waitFor({ state: 'visible', timeout: 25000 })
  const robot = page.getByTestId('yzj-dock-robot')
  const robotText = await robot.textContent().catch(() => '')
  const label = (robotText ?? '').trim()
  console.log(`  dock robot: ${label}`)

  if (label.includes('未配置') || label.includes('未连接') || label === '') {
    console.log('SKIP  robot channel not configured/connected — inbound @ e2e needs a live WS')
    await page.screenshot({ path: shot('skip-unconnected.png') })
    await browser.close()
    process.exit(0)
  }

  ok('robot dock is connected', /已连接|连接/.test(label) || !label.includes('未'), label)

  await page.getByTestId('yzj-dock-chat').click()
  await page.waitForTimeout(2500)
  const groupRow = page.getByTestId('yzj-conv-list').locator('button').filter({ hasText: GROUP_NAME }).first()
  const groupFound = await groupRow.count().then(n => n > 0).catch(() => false)
  ok(`workbench list includes ${GROUP_NAME}`, groupFound)
  if (groupFound) {
    await groupRow.click()
    await page.waitForTimeout(2500)
    const toggle = page.getByTestId('yzj-topic-toggle')
    const toggleReady = await toggle.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)
    ok('group room topic drawer toggle is visible', toggleReady)
    if (toggleReady) {
      await toggle.click()
      await page.waitForTimeout(800)
      ok('topic drawer opens', await page.getByTestId('yzj-topic-drawer').count().then(n => n > 0))
    }
  }
  await page.screenshot({ path: shot('connected.png') })
} finally {
  await browser.close()
}

console.log(`\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
