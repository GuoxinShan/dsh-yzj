/**
 * 挂上「AI速记知识库（整库）」dir: 订阅(决策 40 落地动作):推进面板 测试事项
 * → 关联来源 → 点「AI速记知识库（整库）」。面板直写(用户意志,无确认卡)。
 * 验证:上下文来源 chip 出现 + ~/.dsh/storages/yzj_advance_sources.json 落盘。
 * 幂等:已挂过则跳过点击直接验证。
 */
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const BASE = process.env.DSH_GUI ?? 'http://127.0.0.1:3080/'
const ADVANCE_ID = 'A-20260819-002'
const LIB_ID = 'dir-kb'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage({ viewport: { width: 1560, height: 940 }, locale: 'zh-CN' })
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(6000)
await page.getByTestId('yzj-dock-home').click().catch(() => {})
await page.waitForTimeout(2500)
await page.getByTestId('yzj-workbench-tabs').getByRole('tab', { name: '推进' }).click()
await page.waitForTimeout(5000)
await page.getByTestId(`yzj-advance-item-${ADVANCE_ID}`).click()
await page.waitForTimeout(4000)

await page.getByTestId('yzj-advance-source-add-open').click()
await page.waitForTimeout(4000)
const btn = page.getByTestId(`yzj-advance-source-dir-${LIB_ID}`)
if (await btn.count() === 0) {
  console.log('FAIL  picker 里没有「AI速记知识库（整库）」按钮')
  await browser.close()
  process.exit(1)
}
const chipBefore = await page.locator('body').innerText()
if (!chipBefore.includes('AI速记知识库（整库） ·') ) {
  await btn.click()
  await page.waitForTimeout(3000)
  console.log('clicked  AI速记知识库（整库）')
} else {
  console.log('skip    已关联,无需重复点击')
}
// 关闭 modal
await page.getByRole('button', { name: '关闭' }).click().catch(() => {})
await page.waitForTimeout(2000)
await page.screenshot({ path: new URL('./shots-look/subscribe-lingee.png', import.meta.url).pathname })

// 验证落盘
const sources = JSON.parse(readFileSync(join(homedir(), '.dsh', 'storages', 'yzj_advance_sources.json'), 'utf8'))
const rows = sources.tables?.sources?.[ADVANCE_ID] ?? []
const hit = rows.find(r => r.token === `dir:${LIB_ID}`)
console.log(hit
  ? `PASS    sources.json 已落盘 ${hit.token} (${hit.label})`
  : 'FAIL    sources.json 未找到 dir:6a744266…')
await browser.close()
process.exit(hit ? 0 : 1)
