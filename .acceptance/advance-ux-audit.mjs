/** 推进面板 UX 审计:测试事项全区域截图 + refs 呈现盘点。 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots-advance-ux')
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1560, height: 1250 }, locale: 'zh-CN' })
await page.goto('http://127.0.0.1:3080/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(6000)
const dock = page.getByTestId('yzj-dock-home')
await dock.click({ timeout: 10000 }).catch(() => dock.click({ force: true }))
await page.waitForTimeout(2000)
await page.getByTestId('yzj-workbench-tabs').getByRole('tab', { name: '推进' }).click()
await page.waitForTimeout(4500)
const pane = page.getByTestId('yzj-advance-pane')
await pane.getByText(/测试事项/).first().click()
await page.waitForTimeout(4000)
await page.screenshot({ path: join(OUT, 'audit-1-top.png') })
// 滚动时间旅程到底部
const tl = page.getByTestId('yzj-advance-timeline')
await tl.evaluate((el) => { el.scrollTop = el.scrollHeight }).catch(() => {})
await page.waitForTimeout(600)
await page.screenshot({ path: join(OUT, 'audit-2-timeline-tail.png') })
// refs 元素盘点
const refsInfo = await page.evaluate(() => {
  const out = []
  document.querySelectorAll('[data-testid="yzj-advance-timeline"] [class*="refs"]').forEach((el) => {
    out.push({ cls: el.className, text: (el.textContent || '').slice(0, 90), clickable: el.tagName === 'A' || el.tagName === 'BUTTON' })
  })
  return out
})
console.log(JSON.stringify(refsInfo, null, 1))
await browser.close()
