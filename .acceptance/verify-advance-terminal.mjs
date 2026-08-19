/**
 * ④期 cancelled 终局真机走查(spec §16.7-2):建探针(面板直写无卡)→
 * 详情「中止推进」二次确认 → judge cancel。
 * 存量推进库(v1.6 前建)缺 cancelled SingleSelect 选项:预期 assertStageOption
 * 明示报错引导(不静默丢);若库已补选项则走通 cancelled 全流(队列消失+
 * 终局提示出现+重启回 running)。
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots-advance-terminal')
mkdirSync(OUT, { recursive: true })
const shot = (name) => join(OUT, name)
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

await page.goto('http://127.0.0.1:3080/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(6000)
const dock = page.getByTestId('yzj-dock-home')
await dock.click({ timeout: 10000 }).catch(() => dock.click({ force: true }))
await page.waitForTimeout(2000)
await page.getByTestId('yzj-workbench-tabs').getByRole('tab', { name: '推进' }).click()
await page.waitForTimeout(5000)

// --- 1. 发起推进(面板直写探针) ---
const pane = page.getByTestId('yzj-advance-pane')
const startBtn = page.getByTestId('yzj-advance-start')
await startBtn.click()
await page.getByTestId('yzj-advance-start-modal').waitFor({ state: 'visible', timeout: 8000 })
const stamp = Date.now().toString().slice(-6)
const title = `终局探针 ${stamp}`
await page.getByTestId('yzj-advance-draft-title').fill(title)
await page.getByTestId('yzj-advance-draft-goal').fill('④期 cancelled 走查探针,可随时清理')
await page.getByTestId('yzj-advance-create').click()
await page.waitForTimeout(12000)
let paneText = await pane.innerText().catch(() => '')
ok('探针立项出现在队列', paneText.includes(title), paneText.slice(0, 100).replace(/\n/g, ' '))
await page.screenshot({ path: shot('1-created.png') })

// --- 2. 详情 → 中止推进(二次确认) ---
await pane.getByText(title).first().click()
await page.waitForTimeout(4000)
const cancelBtn = page.getByTestId('yzj-advance-judge-cancel')
ok('「中止推进」按钮出现(非终态)', await cancelBtn.count().then((n) => n > 0))
await cancelBtn.click()
await page.waitForTimeout(800)
const armedText = await cancelBtn.innerText()
ok('二次确认态(确认中止?再点一次)', armedText.includes('再点一次'), armedText)
await page.screenshot({ path: shot('2-cancel-armed.png') })
await cancelBtn.click()
await page.waitForTimeout(8000)
await page.screenshot({ path: shot('3-after-cancel.png') })

const detail = page.getByTestId('yzj-advance-detail')
const detailText = await detail.innerText().catch(() => '')
const guided = /缺.*cancelled.*选项|补加选项/.test(detailText)
const cancelledOk = detailText.includes('已中止')
if (guided) {
  info('存量库缺 cancelled 选项 → assertStageOption 明示引导(预期路径)')
  ok('缺选项明示引导(不静默丢)', true)
} else {
  ok('cancelled 流转成功(库已含选项)', cancelledOk, detailText.slice(0, 120).replace(/\n/g, ' '))
  // 终局提示:completed/cancelled 区有「沉淀复盘」
  const terminal = page.getByTestId('yzj-advance-terminal')
  ok('终局提示+沉淀复盘入口', await terminal.count().then((n) => n > 0))
  // 队列排除 cancelled
  paneText = await pane.innerText().catch(() => '')
  ok('队列不再显示已中止探针', !paneText.includes(title), '')
  // 重启:cancelled→running 需经 RPC judge?重启走 agent feed actor 非 user 会被拦;
  // 面板无重启按钮——本期不设(决策 27 只要求状态机允许)。跳过。
}

console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`)
await browser.close()
process.exit(failures === 0 ? 0 : 1)
