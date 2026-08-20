/**
 * 830 实验聚焦复验（2026-08-20）：修复决策 25（refs 去重收窄）+ scan 截断后，
 * 重跑第 1 波四步（新探针事项，验证判定 9=恰好 2 卡、③ 一次成功）+
 * 第 2 波回拨 scan（验证截断修复：17:18–18:11 信号本轮可见）+ 幂等。
 * 不碰演示现场 A-20260819-002。
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots-advance-830')
mkdirSync(OUT, { recursive: true })
const shot = (n) => join(OUT, n)
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const DOC_0806 = '6a85774aecd3fb103b859f8a'
const DOC_0812 = '6a85774bfcb86444995406ed'
const DOC_0813 = '6a85774dfcb86444995406ee'
const TITLE = '830 复验探针 0820'

let failures = 0
let cardsTotal = 0
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + String(extra).slice(0, 180) + ')' : ''}`); if (!cond) failures++ }
const info = (m) => console.log(`INFO  ${m}`)

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

async function runUntilStable(tag, expectCard) {
  let cards = 0, last = '', stable = 0
  const t0 = Date.now()
  while (Date.now() - t0 < 8 * 60 * 1000) {
    await page.waitForTimeout(3000)
    const confirmBtn = page.getByRole('button', { name: '确认', exact: true }).first()
    if (await confirmBtn.isVisible().catch(() => false)) {
      cards += 1
      await page.screenshot({ path: shot(`rv-${tag}-card${cards}.png`) })
      await confirmBtn.click()
      await page.waitForTimeout(2000)
      stable = 0; last = ''
      continue
    }
    const cur = await page.evaluate(() => document.body.innerText)
    if (cur === last) { stable += 1; if (stable >= 4) break } else { stable = 0; last = cur }
  }
  cardsTotal += cards
  ok(`${tag} 卡数=${expectCard ? 1 : 0}`, cards === (expectCard ? 1 : 0), `cards=${cards}`)
  return last
}

// ① 立项探针（卡 1）
await composer.fill(`用 yzj_advance_create 立项：title「${TITLE}」；goal「复验决策 25 与截断修复」；targetDate 2026/08/31。直接调用工具。`)
await page.getByRole('button', { name: '发送消息' }).first().click()
await runUntilStable('create', true)
// ② 回放（无卡）
await composer.fill(`对「${TITLE}」feed 一条进度更新：sourceType=文档，summary「参谋部阶段共识复验」，refs=[${DOC_0806}, ${DOC_0812}]。直接调用工具。`)
await page.getByRole('button', { name: '发送消息' }).first().click()
await runUntilStable('replay2', false)
// ③ 目标更新 refs=[0812]（部分重叠，决策 25 后应一次成功，卡 2）
await composer.fill(`对「${TITLE}」feed：changeType=目标更新，goal 改为「复验目标：部分重叠 refs 一次成功」，summary「8/12 定义转向复验」，refs=[${DOC_0812}]。直接调用工具。`)
await page.getByRole('button', { name: '发送消息' }).first().click()
const t3 = await runUntilStable('replay3', true)
ok('③ 一次成功（无「幂等/未追加」误吞提示）', !/同源去重（未追加）/.test(t3), '')
// ④ 回放 0813（无卡）
await composer.fill(`对「${TITLE}」feed 进度更新：8/13 用户旅程对齐复验，refs=[${DOC_0813}]。直接调用工具。`)
await page.getByRole('button', { name: '发送消息' }).first().click()
await runUntilStable('replay4', false)
ok('判定 9 复验：全程恰好 2 卡', cardsTotal === 2, `total=${cardsTotal}`)
// 旅程验收
const pane = page.getByTestId('yzj-advance-pane')
await page.getByTestId('yzj-dock-home').click().catch(() => {})
await page.waitForTimeout(2000)
await page.getByTestId('yzj-workbench-tabs').getByRole('tab', { name: '推进' }).click()
await page.waitForTimeout(4500)
await pane.getByText(new RegExp(TITLE)).first().click()
await page.waitForTimeout(4000)
const detailText = await page.getByTestId('yzj-advance-detail').innerText().catch(() => '')
ok('旅程 4 行且新 goal 在位', detailText.includes('复验目标：部分重叠 refs 一次成功'), '')
await page.screenshot({ path: shot('rv-detail.png') })
console.log(failures === 0 ? 'WAVE1 ALL PASS' : `WAVE1 ${failures} FAILURES`)
await browser.close()
process.exit(failures === 0 ? 0 : 1)
