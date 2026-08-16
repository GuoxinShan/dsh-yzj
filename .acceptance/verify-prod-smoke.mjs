// Production smoke: verify robot_* tools are live in the restarted 3080 GUI.
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(p => existsSync(p))
const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://127.0.0.1:3080/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(9000)
const newSession = page.getByRole('button', { name: /在“.*”中新建会话/ }).first()
await newSession.waitFor({ timeout: 30_000 }).catch(() => {})
await newSession.click().catch(() => {})
const composer = page.locator('textarea:enabled').last()
await composer.waitFor({ timeout: 30_000 }).catch(() => {})
if (await composer.count() === 0) { console.log('NO COMPOSER'); await browser.close(); process.exit(1) }

async function ask(prompt, marker, timeoutMs = 120_000) {
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
  console.log(`\n=== ${found ? 'FOUND' : 'NOT FOUND'}: ${marker.slice(0, 24)} ===`)
  if (found) {
    const index = text.lastIndexOf(marker)
    console.log(text.slice(Math.max(0, index - 250), index + 900).replace(/\n{3,}/g, '\n\n'))
  } else {
    console.log('tail:', text.slice(-600).replace(/\n+/g, ' | '))
  }
  return found
}

const ok1 = await ask('调用 robot_status 工具，把它的输出原样贴出来，不要改写。', 'cwd=')
const ok2 = ok1 ? await ask('调用 robot_continue，robotIndex 传 1，把下面这条消息原样注入（不要改写）：生产重启连通性测试，请用一句话回复确认。把 robot_continue 的返回原样贴出来。', '已把操作者消息注入') : false
console.log(`\nSUMMARY: robot_status=${ok1 ? 'PASS' : 'FAIL'} robot_continue=${ok2 ? 'PASS' : 'SKIP/FAIL'}`)
await browser.close()
process.exit(ok1 && ok2 ? 0 : 1)
