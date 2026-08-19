/**
 * 830 实验 P2:给「830:从参谋部到 AI推进」(A-20260819-002)关联 830 群渠道,
 * 然后验证 scan 订阅聚合——新会话发「请巡检」不提群名,模型应自动按订阅扫 830 群。
 * 这是③.2 意图线程订阅的第一个真实使用场景(消除实验中 scan 手写 groups 的别扭)。
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots-advance-830')
mkdirSync(OUT, { recursive: true })
const shot = (name) => join(OUT, name)
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const GROUP_NAME = '830 项目【登顶计划】'

let failures = 0
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + String(extra).slice(0, 200) + ')' : ''}`)
  if (!cond) failures += 1
}
const info = (msg) => console.log(`INFO  ${msg}`)

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage({ viewport: { width: 1560, height: 1100 }, locale: 'zh-CN' })

await page.goto('http://127.0.0.1:3080/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(6000)
const dock = page.getByTestId('yzj-dock-home')
await dock.click({ timeout: 10000 }).catch(() => dock.click({ force: true }))
await page.waitForTimeout(2000)
await page.getByTestId('yzj-workbench-tabs').getByRole('tab', { name: '推进' }).click()
await page.waitForTimeout(4500)
const pane = page.getByTestId('yzj-advance-pane')
await pane.getByText(/830.{0,4}从参谋部到 AI推进/).first().click()
await page.waitForTimeout(4000)

// --- 1. 关联渠道:群 picker 选 830 群 ---
await page.getByTestId('yzj-advance-thread-add-open').click()
await page.waitForTimeout(1500)
const modal = page.getByTestId('yzj-advance-thread-modal')
ok('关联渠道弹层打开', await modal.count().then((n) => n > 0))
const groupBtn = page.getByTestId('yzj-advance-thread-groups').locator('button').filter({ hasText: GROUP_NAME }).first()
ok('群 picker 列出 830 群', await groupBtn.count().then((n) => n > 0))
await groupBtn.click().catch(() => {})
await page.waitForTimeout(2500)
const chips = page.getByTestId('yzj-advance-threads')
const chipsText = await chips.innerText().catch(() => '')
ok('830 群线程 chip 出现', chipsText.includes('830'), chipsText.replace(/\n/g, ' '))
await page.screenshot({ path: shot('p2-thread-linked.png') })

// --- 2. 订阅聚合验证:新会话「请巡检」不提群名 ---
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
await composer.fill('请做一次推进巡检(调用 yzj_advance_scan,不提群名,按订阅聚合),然后按巡检纪律处理。直接调用工具,不要询问。')
await page.getByRole('button', { name: '发送消息' }).first().click()

let last = ''
let stable = 0
const t0 = Date.now()
while (Date.now() - t0 < 8 * 60 * 1000) {
  await page.waitForTimeout(3000)
  const confirmBtn = page.getByRole('button', { name: '确认', exact: true }).first()
  if (await confirmBtn.isVisible().catch(() => false)) {
    info('巡检波出现确认卡(记录)')
    await page.screenshot({ path: shot('p2-scan-card.png') })
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
const tail = last.slice(-800)
info(`scan tail: ${tail.replace(/\n/g, ' ')}`)
ok('scan 按订阅聚合(提到 830 群或订阅清单)', /830|订阅/.test(tail), '')
ok('无「无订阅」类报错', !/没有订阅|无订阅|未订阅任何/.test(tail), '')
await page.screenshot({ path: shot('p2-scan-by-subscription.png') })

console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`)
await browser.close()
process.exit(failures === 0 ? 0 : 1)
