/**
 * ④期 cancelled 终局真机走查(spec §16.7-2,存量库已补 cancelled 选项后):
 * 对既有「终局探针」点「中止推进」(二次确认)→ 阶段已中止 → 终局提示
 * 「沉淀复盘」出现 → 队列排除。走查后探针留在 cancelled(可手工重启或清理)。
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots-advance-terminal')
mkdirSync(OUT, { recursive: true })
const shot = (name) => join(OUT, name)
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PROBE = '终局探针'

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

const pane = page.getByTestId('yzj-advance-pane')
await pane.getByText(new RegExp(PROBE)).first().click()
await page.waitForTimeout(4000)

// 中止推进(二次确认)
const cancelBtn = page.getByTestId('yzj-advance-judge-cancel')
ok('「中止推进」按钮出现(非终态)', await cancelBtn.count().then((n) => n > 0))
await cancelBtn.click()
await page.waitForTimeout(800)
const armedText = await cancelBtn.innerText()
ok('二次确认态', armedText.includes('再点一次'), armedText)
await cancelBtn.click()
await page.waitForTimeout(8000)
await page.screenshot({ path: shot('4-cancelled.png') })

const detail = page.getByTestId('yzj-advance-detail')
const detailText = await detail.innerText().catch(() => '')
ok('阶段已中止', detailText.includes('已中止'), detailText.slice(0, 150).replace(/\n/g, ' '))
const terminal = page.getByTestId('yzj-advance-terminal')
ok('终局提示+沉淀复盘入口出现', await terminal.count().then((n) => n > 0))
const exportBtn = page.getByTestId('yzj-advance-export-review')
ok('「沉淀复盘」按钮可点', await exportBtn.count().then((n) => n > 0))
const queueEl = page.getByTestId('yzj-advance-queue')
const queueText = await queueEl.innerText().catch(() => '')
ok('队列不再显示已中止探针', !queueText.includes(PROBE), queueText.slice(0, 120).replace(/\n/g, ' '))

// 点「沉淀复盘」验证跳对话域预填(不发送)
await exportBtn.click().catch(() => {})
await page.waitForTimeout(2500)
await page.screenshot({ path: shot('5-export-review.png') })
const bodyText = await page.evaluate(() => document.body.innerText)
ok('跳对话域且 banner 提示复盘已预备', bodyText.includes('复盘沉淀已预备'), '')

console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`)
await browser.close()
process.exit(failures === 0 ? 0 : 1)
