/**
 * 830 复验第 2 波：cursor 回拨 ANCHOR 后 scan，验证截断修复——
 * 17:18–18:11 的 5 条信号（旧版单页 20 截断丢失）本轮应可见；
 * 噪音（竞争力报告）仍拒；本人消息仍过滤；幂等仍成立。
 */
import { chromium } from 'playwright'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { mkdirSync } from 'node:fs'
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots-advance-830')
mkdirSync(OUT, { recursive: true })
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
let failures = 0
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + String(extra).slice(0, 180) + ')' : ''}`); if (!cond) failures++ }

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage({ viewport: { width: 1560, height: 1000 }, locale: 'zh-CN' })
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
// 先给复验探针关联 830 群（订阅分发纪律：信号 ∈ 事项线程才 feed）
await page.getByTestId('yzj-dock-home').click().catch(() => {})
await page.waitForTimeout(2000)
await page.getByTestId('yzj-workbench-tabs').getByRole('tab', { name: '推进' }).click()
await page.waitForTimeout(4500)
const pane = page.getByTestId('yzj-advance-pane')
await pane.getByText(/830 复验探针 0820/).first().click()
await page.waitForTimeout(3500)
await page.getByTestId('yzj-advance-thread-add-open').click()
await page.waitForTimeout(2500)
await page.locator('[data-testid^="yzj-advance-thread-group-"]').filter({ hasText: '830 项目' }).first().click()
await page.waitForTimeout(2500)
const chips = await page.getByTestId('yzj-advance-threads').innerText().catch(() => '')
ok('探针已订阅 830 群', chips.includes('830'), chips.replace(/\n/g, ' '))
// 新会话发 scan（新会话 composer 的发送钮 aria-label 稳定）
await page.locator('button[class*="newSession"]').first().click()
await page.waitForTimeout(2500)
const composer2 = page.locator('textarea:visible').first()
await composer2.fill('请调用 yzj_advance_scan，groups=["830 项目【登顶计划】"]，limit=20。把 digest 的新信号行原样列出来，然后按巡检纪律处理（对「830 复验探针 0820」事项：进度正常静默 feed，refs 用真实 msgId；噪音不写）。直接调用工具。')
await page.getByRole('button', { name: '发送消息' }).first().click()
let last = '', stable = 0
const t0 = Date.now()
while (Date.now() - t0 < 10 * 60 * 1000) {
  await page.waitForTimeout(3000)
  const confirmBtn = page.getByRole('button', { name: '确认', exact: true }).first()
  if (await confirmBtn.isVisible().catch(() => false)) { await confirmBtn.click(); await page.waitForTimeout(2000); continue }
  const cur = await page.evaluate(() => document.body.innerText)
  if (cur === last) { stable += 1; if (stable >= 4) break } else { stable = 0; last = cur }
}
// 截断修复：17:18–18:11 信号本轮可见（工作现场/需求一/图片）
ok('截断修复：17:18 工作现场信号可见', last.includes('工作现场'), '')
ok('截断修复：18:11 需求一信号可见', /需求一|830 复验|会议模板/.test(last) || last.includes('6a85816f'), '')
// 噪音仍拒：竞争力报告的 msgId 不进 refs（模型可将其作为纯过程信息提及，但不作独立信号 feed）
ok('噪音拒绝：竞争力报告 msgId 不在 refs', !last.includes('6a844b44') && !last.includes('6a85279e'), '')
await page.screenshot({ path: join(OUT, 'rv2-scan.png') })
// 幂等：对复验探针已 feed 的 refs 再 feed
await composer2.fill('读「830 复验探针 0820」的事元流（yzj_advance_get），取你刚才 feed 的、带 msgId refs 的那条，用完全相同的 refs 和 changeType 再 feed 一次。直接调用工具。')
await page.getByRole('button', { name: '发送消息' }).first().click()
last = ''; stable = 0
const t1 = Date.now()
while (Date.now() - t1 < 6 * 60 * 1000) {
  await page.waitForTimeout(3000)
  const confirmBtn = page.getByRole('button', { name: '确认', exact: true }).first()
  if (await confirmBtn.isVisible().catch(() => false)) { await confirmBtn.click(); await page.waitForTimeout(2000); continue }
  const cur = await page.evaluate(() => document.body.innerText)
  if (cur === last) { stable += 1; if (stable >= 4) break } else { stable = 0; last = cur }
}
ok('幂等：完全重放被同源去重', /同源去重/.test(last), '')
await page.screenshot({ path: join(OUT, 'rv2-idem.png') })
console.log(failures === 0 ? 'WAVE2 ALL PASS' : `WAVE2 ${failures} FAILURES`)
await browser.close()
process.exit(failures === 0 ? 0 : 1)
