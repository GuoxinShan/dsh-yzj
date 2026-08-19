/** 决策 33/34 演示路径:巡检入池 → 看板水位行 → 「Dream 抽取」按钮 → banner 预备。 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots-advance-ux')
mkdirSync(OUT, { recursive: true })
let failures = 0
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + String(extra).slice(0, 160) + ')' : ''}`); if (!cond) failures++ }
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1560, height: 940 }, locale: 'zh-CN' })
await page.goto('http://127.0.0.1:3080/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(6000)
// 新会话跑巡检(scan 入池)
await page.locator('button[class*="newSession"]').first().click()
await page.waitForTimeout(2500)
const permPicker = page.locator('button, [role="button"]').filter({ hasText: /Full access|Workspace Write|Read Only/ }).first()
if (!((await permPicker.innerText().catch(() => '')).includes('Workspace Write'))) {
  await permPicker.click(); await page.waitForTimeout(1000)
  await page.getByText('Workspace Write', { exact: true }).first().click(); await page.waitForTimeout(1200)
}
const composer = page.locator('textarea:visible').first()
await composer.fill('请调用 yzj_advance_scan 做一次巡检(按订阅聚合,不提群名)。直接调用工具。')
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
// 回看板看水位行
await page.getByTestId('yzj-dock-home').click().catch(() => {})
await page.waitForTimeout(2000)
await page.getByTestId('yzj-workbench-tabs').getByRole('tab', { name: '推进' }).click()
await page.waitForTimeout(4500)
const dreamLine = page.getByTestId('yzj-advance-dream-status')
const lineText = await dreamLine.innerText().catch(() => '')
ok('水位行显示池中待抽取', /池中 \d+ 条待抽取/.test(lineText), lineText)
const dreamBtn = page.getByTestId('yzj-advance-dream-now')
ok('Dream 抽取按钮在位', await dreamBtn.count() > 0)
await page.screenshot({ path: join(OUT, 'audit-8-dream-watermark.png') })
await dreamBtn.click()
await page.waitForTimeout(2500)
const bodyText = await page.evaluate(() => document.body.innerText)
ok('banner「Dream 抽取已预备」', bodyText.includes('Dream 抽取已预备'))
await page.screenshot({ path: join(OUT, 'audit-9-dream-banner.png') })
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`)
await browser.close()
process.exit(failures === 0 ? 0 : 1)
