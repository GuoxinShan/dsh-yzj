/**
 * Browser acceptance for 决策 41 (2026-08-21): the decision area must never be
 * an empty button row — the item is decision-needed from a legacy 偏差+stageTo entry
 * (no 决策请求 事元), so the fallback shows the driving 事元 + hint. Also pins
 * the collapsed timeline (详情 caret) and the per-entry 「问助手」 entry.
 * Read-only walk (no writes): screenshots land in shots-advance-ux/.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots-advance-ux')
mkdirSync(OUT, { recursive: true })

let failures = 0
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`)
  if (!cond) failures += 1
}

const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1560, height: 1000 }, locale: 'zh-CN' })
const pageErrors = []
page.on('pageerror', (error) => { pageErrors.push(String(error).slice(0, 200)) })

await page.goto('http://127.0.0.1:3080/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(6000)
await page.getByTestId('yzj-dock-home').click().catch(() => {})
await page.waitForTimeout(2000)
await page.getByTestId('yzj-workbench-tabs').getByRole('tab', { name: '推进' }).click()
await page.waitForTimeout(4500)
await page.getByTestId('yzj-advance-pane').getByText(/测试事项/).first().click()
await page.waitForTimeout(4000)

// --- 1. decision area fallback: legacy 偏差+stageTo item shows the driver, not bare verbs
const area = page.getByTestId('yzj-advance-decision')
const areaText = await area.innerText()
// data-independent: the fallback h3 carries the latest driving 事元 summary (non-trivial text)
const h3Text = await area.locator('h3').first().innerText().catch(() => '')
ok('fallback shows the latest driving 事元 as h3', h3Text.trim().length > 10, h3Text.slice(0, 40))
ok('fallback hint explains missing actions', areaText.includes('没有带上建议动作'))
ok('classic verbs still there', areaText.includes('确认推进') && areaText.includes('忽略'))
ok('回到对话继续聊 entry on the card (决策 41)', areaText.includes('回到对话继续聊'))

// --- 2. collapsed timeline: rows show 详情 caret; expand reveals refs + 问助手
const firstToggle = page.locator('[data-testid="yzj-advance-entry-toggle-0"]')
ok('collapsed rows carry a 详情 caret', (await firstToggle.innerText()).includes('详情'))
await firstToggle.click()
await page.waitForTimeout(1200)
const paneText = await page.getByTestId('yzj-advance-pane').innerText()
ok('expand reveals 原始信息 / 记录自 footer', paneText.includes('原始信息') && paneText.includes('记录自'))
const discuss = page.locator('[data-testid="yzj-advance-entry-discuss-0"]')
ok('问助手 entry point renders once expanded', await discuss.count() === 1)
await page.screenshot({ path: join(OUT, 'ux-actions-decision.png') })

// --- 3. zero page errors
ok('zero page errors', pageErrors.length === 0, pageErrors.join(' | '))

await browser.close()
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
