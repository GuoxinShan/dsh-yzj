/**
 * Visual check of v1.16 workbench tabs + calendar day/week/month/year
 * against the live GUI (:3080). Requires rebuilt client + running dsh web.
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots-calendar-views')
mkdirSync(OUT, { recursive: true })
const BASE = process.env.DSH_GUI ?? 'http://127.0.0.1:3080/'
const CHROME = [
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
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const pageErrors = []
page.on('pageerror', (error) => { pageErrors.push(String(error).slice(0, 200)) })

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(5000)

const dock = page.getByTestId('yzj-group-space')
await dock.waitFor({ state: 'visible', timeout: 25000 })
ok('dock visible', await dock.isVisible())

await page.getByTestId('yzj-dock-chat').click()
await page.waitForTimeout(2000)

const tabs = page.getByTestId('yzj-workbench-tabs')
await tabs.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {})
const tabText = await tabs.innerText().catch(() => '')
ok('top tabs show 对话/待办/日程/知识库', ['对话', '待办', '日程', '知识库'].every(label => tabText.includes(label)), tabText.replace(/\n/g, ' '))
await page.screenshot({ path: join(OUT, '1-im-tabs.png') })

await tabs.getByRole('tab', { name: '日程' }).click()
await page.waitForTimeout(3500)
const cal = page.getByTestId('yzj-calendar-pane')
await cal.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {})
ok('calendar pane mounted', await cal.count().then(n => n > 0))
const calText = await cal.innerText().catch(() => '')
ok('week chrome: 今天 + 日周月年', calText.includes('今天') && calText.includes('周') && calText.includes('月') && calText.includes('年'), calText.slice(0, 80).replace(/\n/g, ' '))
ok('week time gutter', calText.includes('GMT+8') || calText.includes('07:00') || calText.includes('10:00'))
await page.screenshot({ path: join(OUT, '2-week.png') })

await cal.getByRole('tab', { name: '月' }).click()
await page.waitForTimeout(400)
ok('month grid after switch', (await cal.locator('[class*="monthCell"], [class*="monthGrid"]').count()) > 0)
await page.screenshot({ path: join(OUT, '3-month.png') })

await cal.getByRole('tab', { name: '年' }).click()
await page.waitForTimeout(400)
ok('year view lists 12 months', (await cal.locator('button', { hasText: '月' }).count()) >= 12)
await page.screenshot({ path: join(OUT, '4-year.png') })

await cal.getByRole('tab', { name: '日' }).click()
await page.waitForTimeout(400)
ok('day view keeps time gutter', (await cal.innerText()).includes('GMT+8') || (await cal.innerText()).includes(':00'))
await page.screenshot({ path: join(OUT, '5-day.png') })

await tabs.getByRole('tab', { name: '待办' }).click()
await page.waitForTimeout(1500)
await page.screenshot({ path: join(OUT, '6-todo.png') })
ok('todo tab still paints a domain pane', await page.getByTestId('yzj-workbench-domain').count().then(n => n > 0))

await tabs.getByRole('tab', { name: '对话' }).click()
await page.waitForTimeout(800)
ok('back to IM list', await page.getByTestId('yzj-conv-list').count().then(n => n > 0))

ok('no page errors', pageErrors.length === 0, pageErrors.join(' | '))
await browser.close()
process.exit(failures === 0 ? 0 : 1)
