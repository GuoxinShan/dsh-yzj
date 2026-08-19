/**
 * 决策 25 修复后的真机回归:幂等语义必须保持(判定 8 不退化)。
 * 进巡检会话,让模型把 18:28 那条巡检 feed(7 refs)原样再喂一次 →
 * 预期幂等不加行,事元总数仍 5。部分重叠追加由单测覆盖
 * (advance.spec.ts「partial refs overlap」830 回归用例),不污染实验事项。
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots-advance-830')
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

await page.goto('http://127.0.0.1:3080/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(6000)
// 巡检会话(标题以「请调用 yzj_advance_scan」开头)
await page.locator('[role="treeitem"]').filter({ hasText: /yzj_advance_scan/ }).first().click()
await page.waitForTimeout(3000)
const composer = page.locator('textarea:visible').first()
await composer.waitFor({ state: 'visible', timeout: 15000 })

await composer.fill('把 18:28 那条巡检进度更新原样再 feed 一次到同一事项(完全相同的 refs、changeType、summary)。然后用 yzj_advance_get 读该事项,告诉我事元总数。直接调用工具,不要询问。')
await page.getByRole('button', { name: '发送消息' }).first().click()

let last = ''
let stable = 0
const t0 = Date.now()
while (Date.now() - t0 < 6 * 60 * 1000) {
  await page.waitForTimeout(3000)
  const confirmBtn = page.getByRole('button', { name: '确认', exact: true }).first()
  if (await confirmBtn.isVisible().catch(() => false)) {
    info('UNEXPECTED: 确认卡出现(纯追加不该弹)')
    await page.screenshot({ path: shot('regression-unexpected-card.png') })
    ok('回归全程无确认卡', false, '纯追加 feed 弹了卡')
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
const tail = last.slice(-700)
info(`tail: ${tail.replace(/\n/g, ' ')}`)
ok('幂等保持:同源去重返回', /同源去重|幂等|idempotent|未追加/.test(tail), '')
ok('事元总数仍 5', /事元总数\D*5|共\s*5\s*条|5\s*条事元/.test(tail), '')
await page.screenshot({ path: shot('regression-idem.png') })

console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`)
await browser.close()
process.exit(failures === 0 ? 0 : 1)
