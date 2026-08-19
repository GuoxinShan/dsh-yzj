/**
 * 830 真数据闭环实验 · 第 2 波:cursor 回拨后的真巡检(advance-830-experiment.md §5)。
 * 前置:cursor 已回拨到 ANCHOR 6a83ffffe4b09a073e3f481a(农佳捷需求前一条),
 * GUI 已重启(cursor domain 随进程内存加载)。
 * 流程:新会话(Workspace Write)→ scan prompt(§5 原文,无结果暗示)→
 * 视情况第二轮 scan → 看板状态行/详情 refs 验收 → 幂等测试。
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots-advance-830')
mkdirSync(OUT, { recursive: true })
const shot = (name) => join(OUT, name)
const BASE = process.env.DSH_GUI ?? 'http://127.0.0.1:3080/'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

let failures = 0
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + String(extra).slice(0, 200) + ')' : ''}`)
  if (!cond) failures += 1
}
const info = (msg) => console.log(`INFO  ${msg}`)

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage({ viewport: { width: 1560, height: 940 }, locale: 'zh-CN' })
page.on('pageerror', (e) => info(`[pageerror] ${String(e).slice(0, 120)}`))

/** 等模型一轮跑完;确认卡计数并点确认(本轮不该有,有则记录)。 */
async function runUntilStable(tag, timeoutMs = 10 * 60 * 1000) {
  let cards = 0
  let last = ''
  let stable = 0
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    await page.waitForTimeout(3000)
    const confirmBtn = page.getByRole('button', { name: '确认', exact: true }).first()
    if (await confirmBtn.isVisible().catch(() => false)) {
      cards += 1
      await page.screenshot({ path: shot(`${tag}-card-${cards}.png`) })
      info(`${tag}: card #${cards} → 确认(记录:巡检波不该有卡)`)
      await confirmBtn.click()
      await page.waitForTimeout(2000)
      stable = 0
      last = ''
      continue
    }
    const cur = await page.evaluate(() => document.body.innerText)
    if (cur === last) {
      stable += 1
      if (stable >= 4) break
    } else {
      stable = 0
      last = cur
    }
  }
  return { cards, finalText: last }
}

// --- 0. fresh session + Workspace Write ---
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(6000)
await page.locator('button[class*="newSession"]').first().click()
await page.waitForTimeout(2500)
const permPicker = page.locator('button, [role="button"]').filter({ hasText: /Full access|Workspace Write|Read Only/ }).first()
const permText = await permPicker.innerText().catch(() => '')
if (!permText.includes('Workspace Write')) {
  await permPicker.click()
  await page.waitForTimeout(1000)
  await page.getByText('Workspace Write', { exact: true }).first().click()
  await page.waitForTimeout(1200)
  info(`权限档位切到 Workspace Write(原: ${permText.trim()})`)
}
const composer = page.locator('textarea:visible').first()
await composer.waitFor({ state: 'visible', timeout: 15000 })

// --- 1. patrol prompt(§5 原文) ---
const SCAN_PROMPT = `请调用 yzj_advance_scan,groups=["830 项目【登顶计划】"],limit=20。然后按巡检纪律处理:把新信号交给 yzj_advance_inspect,与在途事项比对;进度正常就静默 feed(refs 用真实 msgId),命中打扰判据才 stageTo=decision-needed;无关信号不要写。请直接连续调用工具完成整个巡检,不要询问我。`
info('sending scan prompt…')
await composer.fill(SCAN_PROMPT)
await page.getByRole('button', { name: '发送消息' }).first().click()
let r1 = await runUntilStable('w2-scan1')
await page.screenshot({ path: shot('w2-1-scan-done.png') })
info(`scan1 tail: ${r1.finalText.slice(-400).replace(/\n/g, ' ')}`)

// --- 2. 若模型提示还有增量,再扫一轮 ---
const moreHint = /还有|再次|更多|增量|more|继续扫|剩余/i.test(r1.finalText.slice(-500))
if (moreHint) {
  info('模型提示可能有剩余增量,发第二轮 scan…')
  await composer.fill('再 scan 一次同一群,同样按巡检纪律处理。')
  await page.getByRole('button', { name: '发送消息' }).first().click()
  const r2 = await runUntilStable('w2-scan2')
  r1 = { cards: r1.cards + r2.cards, finalText: r2.finalText }
  await page.screenshot({ path: shot('w2-2-scan2-done.png') })
  info(`scan2 tail: ${r2.finalText.slice(-400).replace(/\n/g, ' ')}`)
}
ok('巡检波确认卡数为 0(静默纪律)', r1.cards === 0, `cards=${r1.cards}`)

// --- 3. 看板状态行 + 详情 refs ---
const dock = page.getByTestId('yzj-dock-home')
await dock.click({ timeout: 10000 }).catch(() => dock.click({ force: true }))
await page.waitForTimeout(2000)
await page.getByTestId('yzj-workbench-tabs').getByRole('tab', { name: '推进' }).click()
await page.waitForTimeout(5000)
const pane = page.getByTestId('yzj-advance-pane')
const paneText = await pane.innerText().catch(() => '')
const statusEl = page.getByTestId('yzj-advance-scan-status')
const statusText = await statusEl.innerText().catch(() => '')
info(`队列头状态行: ${statusText.replace(/\n/g, ' ')}`)
const m = statusText.match(/上次巡检\s*(\d{1,2}:\d{2})\s*·\s*本轮发现\s*(\d+)\s*条/)
ok('判定4: 队列头「上次巡检 HH:mm · 本轮发现 N 条」且 N≥1', m !== null && Number(m[2]) >= 1, statusText.replace(/\n/g, ' '))
await page.screenshot({ path: shot('w2-3-board-after-scan.png') })

await pane.getByText(/830.{0,4}从参谋部到 AI推进/).first().click().catch(() => {})
await page.waitForTimeout(4000)
const detail = page.getByTestId('yzj-advance-detail')
let detailText = await detail.innerText().catch(() => '')
// 展开「查看全部」拿全量时间旅程
const viewAll = detail.getByText(/查看全部|全部 \d+/).first()
if (await viewAll.isVisible().catch(() => false)) {
  await viewAll.click().catch(() => {})
  await page.waitForTimeout(1500)
  detailText = await page.evaluate(() => document.body.innerText)
}
await page.screenshot({ path: shot('w2-4-detail-after-scan.png') })

const NJJ = '6a841a46e4b0ab2392c31eb9'   // 农佳捷三点需求
const PRD = '6a842792e4b08c3f7ebf8521'   // 冯胜龙 PRD 消息
const NOISE = ['6a844b44e4b0a35e3fd4b583'] // 占位,下面用内容判定
ok('判定5: 农佳捷需求和/或 PRD msgId 进入事元 refs', detailText.includes(NJJ) || detailText.includes(PRD), `njj=${detailText.includes(NJJ)} prd=${detailText.includes(PRD)}`)
ok('判定6: 竞争力报告讨论未喂入(无「竞争力」事元)', !/竞争力/.test(detailText), '')
const MY_MSGS = ['6a856f0ce4b08c3f7f34d036', '6a856f0ee4b0892254769fbe', '6a856f0fe4b0e1cfb89cc528', '6a856f11e4b0e01177c0c896', '6a856f12e4b00a134059b32e', '6a856f12e4b0a35e3fd4b583']
ok('判定7: 本人 16:51 六条交付不在事元 refs', !MY_MSGS.some((id) => detailText.includes(id)), '')

// --- 4. 幂等测试(判定8) ---
const beforeText = detailText
info('发送幂等测试 prompt…')
await dock.click().catch(() => {})
await page.waitForTimeout(1500)
// 回到会话:点侧栏当前会话(第一个 treeitem 含 scan 关键词的会话)
await page.locator('[role="treeitem"]').filter({ hasText: /scan|巡检|830/ }).first().click().catch(() => {})
await page.waitForTimeout(2500)
const composer2 = page.locator('textarea:visible').first()
await composer2.fill('对刚才已喂过的农佳捷需求那条 msgId 6a841a46e4b0ab2392c31eb9 再 feed 一次同样内容到同一事项。然后用 yzj_advance_get 读该事项,告诉我事元总数。直接调用工具。')
await page.getByRole('button', { name: '发送消息' }).first().click()
const r3 = await runUntilStable('w2-idem')
await page.screenshot({ path: shot('w2-5-idem-done.png') })
const tail3 = r3.finalText.slice(-600)
info(`idem tail: ${tail3.replace(/\n/g, ' ')}`)
ok('判定8: 幂等返回(模型报告幂等/跳过/事元数不变)', /幂等|idempotent|跳过|没有新增|未增加|不变|重复/.test(tail3), '')

console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`)
await browser.close()
process.exit(failures === 0 ? 0 : 1)
