/**
 * 830 实验第 1 波补救:③ 目标更新首次 feed 被 host refs 去重误吞
 * (refs=0812 纪要 docId 与 ② 交集 → 幂等不加行,goal 未更新)。
 * 补救:refs 换 8/12 产品定义卡文件消息 msgId 6a7c1274e4b09a073bec3d4d
 * (真实转向源头),重 feed 目标更新。预期弹确认卡(全程第 3 张,
 * 判定 9 将记 FAIL 并附根因)。
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
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + String(extra).slice(0, 160) + ')' : ''}`)
  if (!cond) failures += 1
}
const info = (msg) => console.log(`INFO  ${msg}`)

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage({ viewport: { width: 1560, height: 940 }, locale: 'zh-CN' })

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(6000)
// 进入最近的立项会话(侧栏「用 yzj_advance_create 立…」第一行)
await page.locator('[role="treeitem"]').filter({ hasText: /yzj_advance_create/ }).first().click()
await page.waitForTimeout(3000)
await page.screenshot({ path: shot('7-fix-session.png') })

const composer = page.locator('textarea:visible').first()
await composer.waitFor({ state: 'visible', timeout: 15000 })

const FIX = `③ 的目标更新实际没写进去:你上一条 feed 的 refs 与之前事元交集,host 幂等返回没加行。请重新 feed「830:从参谋部到 AI推进」:changeType=目标更新,goal 改为「按 AI推进产品定义:六态看板+最小推进回路,跑通纪要→共识入库→下一步编排」,summary「8/12 产品定义卡把方向从 AI参谋部改为 AI推进:从战略落地大切口收敛为六态看板+最小推进回路」,refs 用 8/12 产品定义卡消息 msgId 6a7c1274e4b09a073bec3d4d(不要再用 0812 纪要 docId)。直接调用 yzj_advance_feed,不要询问;确认卡我会处理。`

info('sending fix prompt…')
await composer.fill(FIX)
await page.getByRole('button', { name: '发送消息' }).first().click()

let cards = 0
let last = ''
let stable = 0
const t0 = Date.now()
while (Date.now() - t0 < 6 * 60 * 1000) {
  await page.waitForTimeout(3000)
  const confirmBtn = page.getByRole('button', { name: '确认', exact: true }).first()
  if (await confirmBtn.isVisible().catch(() => false)) {
    cards += 1
    await page.screenshot({ path: shot(`8-fix-card-${cards}.png`) })
    info(`fix: card #${cards} → 确认`)
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
info(`fix cards=${cards}`)
info(`fix tail: ${last.slice(-240).replace(/\n/g, ' ')}`)
ok('补救 feed 弹了确认卡', cards >= 1, `cards=${cards}`)
await page.screenshot({ path: shot('9-fix-done.png') })

// 验证:推进页签 → 详情 → 新 goal + 时间旅程 4 条
const dock = page.getByTestId('yzj-dock-home')
await dock.click({ timeout: 10000 }).catch(() => dock.click({ force: true }))
await page.waitForTimeout(2000)
await page.getByTestId('yzj-workbench-tabs').getByRole('tab', { name: '推进' }).click()
await page.waitForTimeout(4500)
const pane = page.getByTestId('yzj-advance-pane')
await pane.getByText(/830.{0,4}从参谋部到 AI推进/).first().click().catch(() => {})
await page.waitForTimeout(4000)
const detailText = await page.getByTestId('yzj-advance-detail').innerText().catch(() => '')
await page.screenshot({ path: shot('10-detail-after-fix.png') })
ok('目标区显示新 goal(六态看板+最小推进回路)', detailText.includes('六态看板') && detailText.includes('最小推进回路'))
const feedCount = ['立项', '参谋部阶段共识', 'AI推进', '用户旅程对齐'].filter((s) => detailText.includes(s)).length
ok('时间旅程含立项+3 回放', feedCount >= 4, `matched=${feedCount}`)

console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`)
console.log(`FIX_CARDS=${cards}`)
await browser.close()
process.exit(failures === 0 ? 0 : 1)
