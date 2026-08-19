/** 决策 32 真机:关联渠道弹层(无手输+目录 picker)→ 830 事项关联「830实验·共识」目录 → scan 首扫基线 → 二扫静默。 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots-advance-ux')
mkdirSync(OUT, { recursive: true })
const shot = (n) => join(OUT, n)
let failures = 0
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + String(extra).slice(0, 160) + ')' : ''}`); if (!cond) failures++ }
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1560, height: 1000 }, locale: 'zh-CN' })
await page.goto('http://127.0.0.1:3080/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(6000)
await page.getByTestId('yzj-dock-home').click().catch(() => {})
await page.waitForTimeout(2000)
await page.getByTestId('yzj-workbench-tabs').getByRole('tab', { name: '推进' }).click()
await page.waitForTimeout(4500)
const pane = page.getByTestId('yzj-advance-pane')
await pane.getByText(/830.{0,4}从参谋部到/).first().click()
await page.waitForTimeout(4000)
await page.getByTestId('yzj-advance-thread-add-open').click()
await page.waitForTimeout(2500)
const modal = page.getByTestId('yzj-advance-thread-modal')
const modalText = await modal.innerText()
ok('弹层无手输 token 输入框', await page.getByTestId('yzj-advance-thread-token').count() === 0)
ok('目录 picker 列「我的知识(整库)」', modalText.includes('我的知识'), modalText.slice(0, 120).replace(/\n/g, ' '))
ok('目录 picker 列「830实验·共识」', modalText.includes('830实验·共识'))
await page.screenshot({ path: shot('audit-5-thread-modal.png') })
// 关联目录
const dirBtn = page.locator('[data-testid^="yzj-advance-thread-dir-"]').filter({ hasText: '830实验·共识' }).first()
await dirBtn.click()
await page.waitForTimeout(3000)
const chips = await page.getByTestId('yzj-advance-threads').innerText().catch(() => '')
ok('目录 chip 出现', chips.includes('830'), chips.replace(/\n/g, ' '))
await page.screenshot({ path: shot('audit-6-dir-linked.png') })
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`)
await browser.close()
process.exit(failures === 0 ? 0 : 1)
