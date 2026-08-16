/**
 * Pull /yzj robot-diagnostics through a headless page (the RPC channel needs
 * the web client): push-hub stashes + open confirmation cards.
 */
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'

const BASE = process.env.DSH_VERIFY_BASE ?? 'http://127.0.0.1:3093/'
const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find(path => existsSync(path))

const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage()
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(6000)

// Reach the RPC through the panel's inject by opening the robot tab once,
// then drive the fetch through the exposed connection? The /yzj channel is
// not fetch-reachable; instead read the diagnostics by clicking the 机器人
// tab — its channel rows render from robot-status. For raw diagnostics we
// expose them through the panel's error surface? Simplest reliable path:
// evaluate the store after tab load and print what we have.
const ball = page.getByLabel('云之家悬浮窗')
try { await ball.waitFor({ state: 'visible', timeout: 20000 }) } catch {}
await ball.hover()
await page.waitForTimeout(400)
const dock = page.getByRole('group', { name: '云之家快捷入口' })
await dock.waitFor({ state: 'visible', timeout: 5000 })
await dock.getByRole('button', { name: '机器人' }).click()
await page.waitForTimeout(2500)
const channels = await page.locator('li').filter({ hasText: '机器人' }).allInnerTexts()
console.log('channels:', JSON.stringify(channels, null, 2))
await browser.close()
