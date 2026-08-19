/** 决策 32 真机 scan:830 事项已订阅 dir:目录 → 巡检 digest 应含目录基线行。 */
import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1560, height: 940 }, locale: 'zh-CN' })
await page.goto('http://127.0.0.1:3080/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(6000)
await page.locator('button[class*="newSession"]').first().click()
await page.waitForTimeout(2500)
const permPicker = page.locator('button, [role="button"]').filter({ hasText: /Full access|Workspace Write|Read Only/ }).first()
if (!((await permPicker.innerText().catch(() => '')).includes('Workspace Write'))) {
  await permPicker.click(); await page.waitForTimeout(1000)
  await page.getByText('Workspace Write', { exact: true }).first().click(); await page.waitForTimeout(1200)
}
const composer = page.locator('textarea:visible').first()
await composer.fill('请调用 yzj_advance_scan 做一次巡检(按订阅聚合,不提群名),把返回的每行原样列出来。直接调用工具。')
await page.getByRole('button', { name: '发送消息' }).first().click()
let last = '', stable = 0
const t0 = Date.now()
while (Date.now() - t0 < 6 * 60 * 1000) {
  await page.waitForTimeout(3000)
  const confirmBtn = page.getByRole('button', { name: '确认', exact: true }).first()
  if (await confirmBtn.isVisible().catch(() => false)) { await confirmBtn.click(); await page.waitForTimeout(2000); continue }
  const cur = await page.evaluate(() => document.body.innerText)
  if (cur === last) { stable += 1; if (stable >= 4) break } else { stable = 0; last = cur }
}
const hit = last.includes('830实验·共识') || last.includes('基线已立')
console.log(hit ? 'PASS 目录线程进 scan digest' : 'FAIL')
console.log('tail:', last.slice(-400).replace(/\n/g, ' '))
await page.screenshot({ path: '/Users/guoxinshan/dev/dsh-yzj/.acceptance/shots-advance-ux/audit-7-dir-scan.png' })
await browser.close()
process.exit(hit ? 0 : 1)
