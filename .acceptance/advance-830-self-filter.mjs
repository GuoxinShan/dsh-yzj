/**
 * 本人过滤修复的真机验证:cursor 回拨到 18:11(本人 19:22 报告前),
 * scan 830 订阅渠道。预期:digest 不含 19:22 两条本人报告(msgId 6a8591fe…/
 * 6a85921a…),只见 19:42 图片(非本人)。修复前该 digest 必含本人消息。
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots-advance-830')
mkdirSync(OUT, { recursive: true })
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

let failures = 0
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + String(extra).slice(0, 200) + ')' : ''}`)
  if (!cond) failures += 1
}
const info = (msg) => console.log(`INFO  ${msg}`)

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage({ viewport: { width: 1560, height: 940 }, locale: 'zh-CN' })
await page.goto('http://127.0.0.1:3080/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(6000)
await page.locator('button[class*="newSession"]').first().click()
await page.waitForTimeout(2500)
const permPicker = page.locator('button, [role="button"]').filter({ hasText: /Full access|Workspace Write|Read Only/ }).first()
if (!((await permPicker.innerText().catch(() => '')).includes('Workspace Write'))) {
  await permPicker.click()
  await page.waitForTimeout(1000)
  await page.getByText('Workspace Write', { exact: true }).first().click()
  await page.waitForTimeout(1200)
}
const composer = page.locator('textarea:visible').first()
await composer.fill('请调用 yzj_advance_scan 做一次巡检(按订阅聚合即可),把 scan 返回的每条信号的 msgId、发送者、时间原样列出来(不要省略),然后按巡检纪律处理。直接调用工具。')
await page.getByRole('button', { name: '发送消息' }).first().click()

let last = ''
let stable = 0
const t0 = Date.now()
while (Date.now() - t0 < 8 * 60 * 1000) {
  await page.waitForTimeout(3000)
  const confirmBtn = page.getByRole('button', { name: '确认', exact: true }).first()
  if (await confirmBtn.isVisible().catch(() => false)) {
    info('出现确认卡(记录)')
    await confirmBtn.click()
    await page.waitForTimeout(2000)
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
const tail = last.slice(-1200)
info(`tail: ${tail.replace(/\n/g, ' ')}`)
// 本人 19:22/19:23 两条的 msgId 不应作为信号出现;19:42 图片(5d294a33)应出现
ok('本人 19:22 报告不在 scan 信号', !last.includes('6a8591fe'), '')
ok('本人 19:23 图片报告不在 scan 信号', !last.includes('6a85921a'), '')
ok('19:42 非本人图片在信号里(6a8596b4)', last.includes('6a8596b4'), '')
await page.screenshot({ path: join(OUT, 'p2-self-filter-scan.png') })
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`)
await browser.close()
process.exit(failures === 0 ? 0 : 1)
