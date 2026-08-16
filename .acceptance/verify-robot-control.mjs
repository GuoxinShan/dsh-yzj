/**
 * R2.6 bidirectional-control verification against the TEST instance (3093):
 * drives the GUI's own agent with plain chat prompts so the robot_* tools
 * execute inside a real harness session — operator → GUI → agent →
 * robot_continue/notify/fork → Yunzhijia group.
 * Steps:
 *  1. robot_status (expect cwd= + surface lines)
 *  2. robot_continue into channel 1 (group robot) asking for a schedule_create reminder
 *  3. robot_notify a marker message to channel 1
 *  4. robot_fork the lastSessionId from status
 *  5. session.list HTTP RPC must list the fork session
 */
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'

const BASE = process.env.DSH_VERIFY_BASE ?? 'http://127.0.0.1:3093/'
const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find(path => existsSync(path))

let failures = 0
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`)
  if (!cond) failures++
}

const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.log(`  [pageerror] ${String(e).slice(0, 250)}`))

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
// The GUI shares the ~/.dsh session store with other instances: always start
// a FRESH session so verification never pollutes an existing conversation.
const newSession = page.getByRole('button', { name: /在“.*”中新建会话/ }).first()
await newSession.waitFor({ timeout: 30_000 }).catch(() => {})
await newSession.click().catch(() => {})
const composer = page.locator('textarea:enabled').last()
await composer.waitFor({ timeout: 30_000 }).catch(() => {})
ok('composer ready', await composer.count() > 0)

/** Send one prompt and wait for `marker` in the chat; prints the reply window. */
async function ask(label, prompt, marker, timeoutMs = 180_000) {
  await composer.fill(prompt)
  // The send button enables on input (React state); poll for it.
  await page.waitForFunction(() => {
    const buttons = [...document.querySelectorAll('button')]
    const send = buttons.find(b => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === '发送消息')
    return send !== undefined && !send.disabled
  }, { timeout: 15_000 }).catch(() => {})
  await page.getByRole('button', { name: '发送消息', exact: true }).click()
  const deadline = Date.now() + timeoutMs
  let text = ''
  while (Date.now() < deadline) {
    await page.waitForTimeout(1500)
    text = await page.locator('body').innerText().catch(() => '')
    if (text.includes(marker)) break
  }
  const found = text.includes(marker)
  ok(label, found, found ? '' : `marker ${marker.slice(0, 30)} not seen`)
  if (found) {
    const index = text.lastIndexOf(marker)
    const window = text.slice(Math.max(0, index - 200), index + 900).replace(/\n{3,}/g, '\n\n')
    console.log(`  ── reply around marker ──\n${window}\n  ─────────────────────────`)
  }
  return { found, text }
}

const status = await ask('1. robot_status surfaces cwd + surface', '调用 robot_status 工具，把它的输出原样贴出来，不要改写。', 'cwd=')
const cont = await ask('2. robot_continue injects the reminder request', '调用 robot_continue，robotIndex 传 1，把下面这条消息原样注入（不要改写、不要自己执行）：帮我用 schedule_create 设置一个 2 分钟后的提醒，提示语：C11 定时推送验证成功，只创建这一次。把 robot_continue 的返回原样贴出来。', '已把操作者消息注入')
const note = await ask('3. robot_notify pushes the marker message', '调用 robot_notify，robotIndex 传 1，推送这条消息：双向打通验证（来自 DSH 内部控制台）。把返回原样贴出来。', '已通过机器人通道 1 推送')
const fork = await ask('4. robot_fork forks the last group session', '调用 robot_status，取 1 号通道 surface 里的 lastSessionId；然后调用 robot_fork 用那个 sessionId fork。把 robot_fork 的返回原样贴出来。', 'fork 出会话')

// 5. session.list HTTP RPC must include the fork session.
let forkId = ''
if (fork.found) {
  const match = fork.text.match(/fork 出会话 ([\w-]+)/)
  if (match !== null) forkId = match[1]
}
const rpc = await fetch(`${BASE}api/session.list`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ type: 'client-request', rpcId: 'r2.6-fork', method: 'session.list', payload: {} }),
}).then(res => res.json()).catch(() => null)
const items = Array.isArray(rpc?.result?.value?.items) ? rpc.result.value.items : []
const forkSessions = items.filter(item => String(item.sessionId ?? item.id ?? '').startsWith('fork-'))
ok('5. session.list lists fork-* sessions', forkSessions.length > 0, `found ${forkSessions.length}`)
if (forkId !== '') {
  ok('5b. the reported fork id is listed', forkSessions.some(item => String(item.sessionId ?? item.id ?? '') === forkId), forkId)
}
if (status.found) {
  const surfaceSeen = status.text.includes('6a7f37b4e4b0e6211b1c5b87')
  ok('1b. group surface visible in status', surfaceSeen)
}

await browser.close()
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
