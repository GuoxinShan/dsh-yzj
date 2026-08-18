/**
 * Dock 「云之家」 end-to-end against the live GUI (:3080).
 * Catches the archived-hanger dead end (pitfall-021): click 云之家 must
 * mount the workbench list + room composer, then switch groups without
 * flashing the official InputBar.
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots-dock-chat')
mkdirSync(OUT, { recursive: true })
const GROUP = process.env.YZJ_E2E_GROUP ?? '金蝶最小DSH交流群'
const BASE = process.env.DSH_GUI ?? 'http://127.0.0.1:3080/'
const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
].find(path => existsSync(path))

let failures = 0
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`)
  if (!cond) failures += 1
}

const browser = await chromium.launch({
  ...(CHROME === undefined ? {} : { executablePath: CHROME }),
  headless: process.env.E2E_HEADED === '1' ? false : true,
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.log(`  [pageerror] ${String(e).slice(0, 240)}`))

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(5000)

const dock = page.getByTestId('yzj-group-space')
await dock.waitFor({ state: 'visible', timeout: 25000 })
ok('云之家 dock is visible', await dock.isVisible())

await page.getByTestId('yzj-dock-home').click()
const list = page.getByTestId('yzj-conv-list')
const listUp = await list.waitFor({ state: 'visible', timeout: 12000 }).then(() => true).catch(() => false)
await page.screenshot({ path: join(OUT, 'after-dock.png') })
ok('云之家 opens the workbench conversation list', listUp)
ok('room shell mounted', await page.getByTestId('yzj-room-shell').count().then(n => n > 0))

if (listUp) {
  const groupRow = list.locator('button').filter({ hasText: GROUP }).first()
  const found = await groupRow.count().then(n => n > 0)
  ok(`list includes ${GROUP}`, found)
  if (found) {
    await groupRow.click()
    await page.waitForTimeout(2000)
    ok(
      'timeline is visible after picking a group',
      await page.getByTestId('yzj-fused-stream').waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false),
    )
    ok(
      'room composer is visible',
      await page.getByTestId('yzj-room-composer').waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false),
    )
    const other = list.locator('button').filter({ hasNotText: GROUP }).first()
    if (await other.count() > 0) {
      await other.click()
      const mid = await page.evaluate(() => {
        const official = [...document.querySelectorAll('textarea, [placeholder]')].some(el => {
          if (!(el.getAttribute('placeholder') ?? '').includes('给智能体发消息')) return false
          const box = el.getBoundingClientRect()
          return box.height > 8 && box.width > 8
        })
        return {
          host: document.querySelector('[data-testid="yzj-room-composer-host"]') !== null,
          official,
        }
      })
      ok('composer host stays after switching group', mid.host)
      ok('official InputBar stays hidden after switching group', !mid.official)
    }
  }
}

await page.screenshot({ path: join(OUT, 'workbench.png') })
await browser.close()
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
