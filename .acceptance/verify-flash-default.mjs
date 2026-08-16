/**
 * Remove the now-redundant per-group flash override (channel default already
 * points at flash) and verify the 机器人 tab shows the default on both
 * channels. Verifies the full config chain: defaultProvider/defaultModel →
 * channel rows → override list empty.
 */
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'

const BASE = process.env.DSH_VERIFY_BASE ?? 'http://127.0.0.1:3093/'
const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find(path => existsSync(path))

let failures = 0
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`)
  if (!cond) failures++
}

const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(6000)

const ball = page.getByLabel('云之家悬浮窗')
try { await ball.waitFor({ state: 'visible', timeout: 20000 }) } catch {}
await ball.hover()
await page.waitForTimeout(400)
const dock = page.getByRole('group', { name: '云之家快捷入口' })
await dock.waitFor({ state: 'visible', timeout: 5000 })
await dock.getByRole('button', { name: '机器人' }).click()
await page.waitForTimeout(2500)

// Both channel rows should now show the flash default.
const channelText = await page.locator('li').filter({ hasText: '机器人' }).allInnerTexts()
const defaultShown = channelText.filter(t => t.includes('opencode-go/deepseek-v4-flash')).length
ok('channels show flash default', defaultShown >= 2, `${defaultShown}/2 rows`)

// Delete the per-group override if present (redundant now).
const rows = page.locator('li button').filter({ hasText: '群 ·' })
const rowCount = await rows.count()
if (rowCount > 0) {
  await rows.first().click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: '删除覆盖' }).click()
  await page.waitForTimeout(2000)
  const after = await page.locator('li button').filter({ hasText: '群 ·' }).count()
  ok('redundant group override removed', after === 0, `${after} rows`)
} else {
  ok('no per-group overrides (already clean)', true)
}

await page.screenshot({ path: '.acceptance/shots-robot/flash-default.png' })
await browser.close()
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
