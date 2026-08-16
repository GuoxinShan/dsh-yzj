// C11 round: inject a schedule_create request, then !routines, print both replies.
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'

const BASE = process.env.DSH_VERIFY_BASE ?? 'http://127.0.0.1:3093/'
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(p => existsSync(p))
const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(9000)
for (const name of ['继续', '稍后配置']) {
  const b = page.getByRole('button', { name, exact: true })
  if (await b.count() > 0) { await b.click().catch(() => {}); await page.waitForTimeout(1200) }
}
const seat = page.getByRole('button', { name: '选择工作区' })
if (await seat.count() > 0) {
  await seat.click({ position: { x: 60, y: 10 } }).catch(() => {})
  await page.waitForTimeout(1500)
  const workspace = page.getByRole('button', { name: 'dsh-yzj' }).first()
  if (await workspace.count() > 0) {
    await workspace.click().catch(() => {})
    await page.waitForTimeout(1500)
  }
}
const newSession = page.getByRole('button', { name: /在“.*”中新建会话/ }).first()
await newSession.waitFor({ timeout: 30_000 }).catch(() => {})
await newSession.click().catch(() => {})
const composer = page.locator('textarea:enabled').last()
await composer.waitFor({ timeout: 30_000 })

async function ask(prompt, marker, timeoutMs = 180_000) {
  await composer.fill(prompt)
  await page.waitForFunction(() => {
    const buttons = [...document.querySelectorAll('button')]
    const send = buttons.find(b => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === '发送消息')
    return send !== undefined && !send.disabled
  }, { timeout: 15_000 }).catch(() => {})
  await page.getByRole('button', { name: '发送消息', exact: true }).click()
  const deadline = Date.now() + timeoutMs
  let text = ''
  while (Date.now() < deadline) {
    await page.waitForTimeout(2000)
    text = await page.locator('body').innerText().catch(() => '')
    if (text.includes(marker)) break
  }
  const found = text.includes(marker)
  console.log(`\n=== ${found ? 'FOUND' : 'NOT FOUND'}: ${marker.slice(0, 20)} ===`)
  if (found) {
    const index = text.lastIndexOf(marker)
    console.log(text.slice(Math.max(0, index - 120), index + 700).replace(/\n{3,}/g, '\n\n'))
  }
  return found
}

await ask('调用 robot_continue，robotIndex 传 1，把下面这条消息原样注入（不要改写、不要自己执行）：帮我用 schedule_create 设置一个 2 分钟后的提醒，提示语：C11 定时推送验证成功，只创建这一次，建完报告提醒 id。把 robot_continue 的返回原样贴出来。', '已把操作者消息注入')
await ask('等 15 秒，然后调用 robot_continue，robotIndex 传 1，注入这条消息（原样）：!routines。把 robot_continue 的返回和机器人在群里的回复都贴出来。', '已把操作者消息注入')
await browser.close()
process.exit(0)
