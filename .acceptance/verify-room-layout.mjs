/**
 * Room-layout acceptance against the live GUI (:3080) — pitfall-020 regression:
 *  1. the room opts into the composer-overlay contract (columns bounded to the viewport)
 *  2. the timeline is internally scrollable and opens pinned to the latest message
 *  3. the 发进群 composer sits at the bottom of the timeline column (visible)
 *  4. BOT- senders render 机器人, never the raw openId tail
 *  5. long robot posts collapse behind 展开全文
 *  6. the topic drawer is viewport-height and its anchor card is clamped
 * Requires: running `dsh web`, logged-in yzj-cli, rebuilt client bundle.
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots-room-layout')
mkdirSync(OUT, { recursive: true })

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
await page.getByTestId('yzj-dock-home').click()
await page.waitForTimeout(2500)
await page.getByTestId('yzj-conv-list').locator('button').filter({ hasText: GROUP_NAME }).first().click()
await page.waitForTimeout(3000)

// ---- 1. bounded layout: shell fits the viewport, not a 10k px page ----
const metrics = await page.evaluate(() => {
  const box = (sel) => {
    const el = document.querySelector(sel)
    return el === null ? null : Math.round(el.getBoundingClientRect().height)
  }
  const send = document.querySelector('[data-testid="yzj-send-to-group"]')?.getBoundingClientRect()
  const streamEl = document.querySelector('[data-testid="yzj-fused-stream"]')
  return {
    shell: box('[data-testid="yzj-room-shell"]'),
    stream: box('[data-testid="yzj-fused-stream"]'),
    sendY: send === undefined ? null : Math.round(send.y),
    sendVisible: send !== undefined && send.y >= 0 && send.bottom <= window.innerHeight,
    scrollable: streamEl !== null && streamEl.scrollHeight > streamEl.clientHeight,
    scrollTop: streamEl?.scrollTop ?? -1,
    scrollMax: streamEl === null ? -1 : streamEl.scrollHeight - streamEl.clientHeight,
  }
})
ok('room shell is bounded to the viewport', metrics.shell !== null && metrics.shell <= 900, `shell=${metrics.shell}px`)
ok('timeline scrolls internally', metrics.scrollable, `stream=${metrics.stream}px`)
ok('room opens pinned to the latest message', metrics.scrollMax >= 0 && metrics.scrollMax - (metrics.scrollTop ?? 0) < 40, `scrollTop=${metrics.scrollTop} max=${metrics.scrollMax}`)
ok('发进群 composer is visible in the viewport', metrics.sendVisible === true, `sendY=${metrics.sendY}`)

// ---- 2. ghost 群聊 rows are resolved to real names ----
const ghostCount = await page.getByTestId('yzj-conv-list').locator('button').filter({ hasText: /^\s*群聊\s*$/ }).count()
ok('no ghost 群聊 rows in the conversation list', ghostCount === 0, `${ghostCount} ghosts`)

// ---- 3. robot identity + clamp (needs the robot-heavy history of the e2e group) ----
const robot = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('[data-testid^="yzj-room-row-"]')]
  const metas = rows.map(row => row.querySelector('[class*="roomMeta"]')?.textContent ?? '')
  return {
    robotRows: metas.filter(meta => meta.startsWith('机器人 ·')).length,
    cryptic: metas.filter(meta => /^[0-9a-f]{4,} ·/.test(meta)).length,
    clampToggles: [...document.querySelectorAll('button')].filter(btn => btn.textContent === '展开全文').length,
  }
})
ok('BOT- senders render 机器人', robot.robotRows > 0, `${robot.robotRows} rows`)
ok('no raw openId-tail senders', robot.cryptic === 0, `${robot.cryptic} rows`)
ok('long robot posts collapse behind 展开全文', robot.clampToggles > 0, `${robot.clampToggles} toggles`)
await page.screenshot({ path: join(OUT, 'room-layout.png') })

// ---- 3b. switch group: composer host stays, official InputBar does not flash ----
const otherRow = page.getByTestId('yzj-conv-list').locator('button').filter({ hasNotText: GROUP_NAME }).first()
const hasOther = await otherRow.count().then(n => n > 0).catch(() => false)
if (hasOther) {
  await otherRow.click()
  const mid = await page.evaluate(() => {
    const host = document.querySelector('[data-testid="yzj-room-composer-host"]')
    const official = [...document.querySelectorAll('textarea, [placeholder]')].some(el => {
      if (!(el.getAttribute('placeholder') ?? '').includes('给智能体发消息')) return false
      const box = el.getBoundingClientRect()
      return box.height > 8 && box.width > 8
    })
    const roomComposer = document.querySelector('[data-testid="yzj-room-composer"]')
    return {
      host: host !== null,
      official,
      roomComposer: roomComposer !== null,
    }
  })
  ok('composer host stays on cache-miss group switch', mid.host === true)
  ok('official 给智能体发消息 is not visible on switch', mid.official === false)
  ok('room composer still mounted on switch', mid.roomComposer === true)
  await page.getByTestId('yzj-conv-list').locator('button').filter({ hasText: GROUP_NAME }).first().click()
  await page.waitForTimeout(1500)
} else {
  ok('composer host stays on cache-miss group switch', false, 'no second conversation row')
}

// ---- 4. topic drawer: viewport height, clamped anchor ----
const chip = page.getByRole('button', { name: /条回复/ }).first()
if (await chip.count() > 0) {
  await chip.click()
  await page.waitForTimeout(1500)
  const drawer = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="yzj-topic-drawer"]')
    if (el === null) return null
    const rect = el.getBoundingClientRect()
    return { w: Math.round(rect.width), h: Math.round(rect.height) }
  })
  ok('topic drawer is bounded to the viewport', drawer !== null && drawer.h <= 900, drawer === null ? 'missing' : `h=${drawer.h} w=${drawer.w}`)
  await page.screenshot({ path: join(OUT, 'room-drawer.png') })
} else {
  ok('topic drawer is bounded to the viewport', false, 'no reply chip to open the drawer')
}

await browser.close()
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
