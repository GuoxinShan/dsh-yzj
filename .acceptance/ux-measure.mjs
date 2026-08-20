import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1560, height: 1000 }, locale: 'zh-CN' })
await page.goto('http://127.0.0.1:3080/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(6000)
await page.getByTestId('yzj-dock-home').click().catch(() => {})
await page.waitForTimeout(2000)
await page.getByTestId('yzj-workbench-tabs').getByRole('tab', { name: '推进' }).click()
await page.waitForTimeout(4500)
await page.getByTestId('yzj-advance-pane').getByText(/830.{0,4}从参谋部到/).first().click()
await page.waitForTimeout(3000)
const m = await page.evaluate(() => {
  const q = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { w: Math.round(r.width), flex: cs.flex, cls: el.className.slice(0, 40) } }
  const grid = document.querySelector('[class*="detailGrid"]')
  const kids = grid ? [...grid.children].map(el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { w: Math.round(r.width), flex: cs.flex, tag: el.tagName } }) : []
  const gridR = grid ? grid.getBoundingClientRect() : null
  return { gridW: gridR ? Math.round(gridR.width) : null, kids }
})
console.log(JSON.stringify(m, null, 1))
await browser.close()
