/** 830 实验交回件:看板最终态截图(队列头 + 时间旅程同屏)。 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots-advance-830')
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1560, height: 1100 }, locale: 'zh-CN' })
await page.goto('http://127.0.0.1:3080/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(6000)
const dock = page.getByTestId('yzj-dock-home')
await dock.click({ timeout: 10000 }).catch(() => dock.click({ force: true }))
await page.waitForTimeout(2000)
await page.getByTestId('yzj-workbench-tabs').getByRole('tab', { name: '推进' }).click()
await page.waitForTimeout(4500)
const pane = page.getByTestId('yzj-advance-pane')
await pane.getByText(/830.{0,4}从参谋部到 AI推进/).first().click().catch(() => {})
await page.waitForTimeout(4000)
await page.screenshot({ path: join(OUT, 'final-board.png'), fullPage: false })
const status = await page.getByTestId('yzj-advance-scan-status').innerText().catch(() => '')
console.log('队列头:', status.replace(/\n/g, ' '))
await browser.close()
console.log('OK final-board.png')
