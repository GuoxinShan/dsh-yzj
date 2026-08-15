/**
 * Crash regression: an OLD persisted panel store (v4 blob without the todo
 * fields) must not crash the todo pane. Simulate by seeding localStorage
 * with a v4-shaped blob (todos absent / wrong type), then opening the todo
 * tab and asserting no page error and the pane renders.
 */
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'

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
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)))

// Seed a stale v4 store blob BEFORE the app boots: schema predates the todo
// fields entirely (the exact shape that produced the crash).
await page.addInitScript(() => {
  const stale = {
    state: {
      open: true,
      tab: 'todo',
      panelX: 100,
      panelY: 100,
      workspaces: [],
      workspaceId: '',
      docs: [],
      docId: '',
      events: [],
      calYear: 2026,
      calMonth: 8,
      calDay: '',
      calEvents: [],
      calEventId: '',
      groups: [],
      groupsPage: 1,
      groupsMore: false,
      groupId: '',
      messages: [],
      messagesMore: false,
      messagesAnchor: '',
      anchorMsgId: '',
      unreadTotal: 0,
      loading: false,
      error: '',
      // NOTE: no todos/todoReady/todoLib*/… keys at all.
    },
  }
  window.localStorage.setItem('dsh.yzj.panel.v4', JSON.stringify(stale))
  // Also poison the new key with a wrong-type todos to prove pane hardening.
  window.localStorage.setItem('dsh.yzj.panel.v5', JSON.stringify({
    state: { ...stale.state, todos: 'garbage-not-array', todoReady: true, todoLink: '', todoTag: '', todoLibraries: null, todoActiveDocId: '', todoLibName: '', todoLibScope: '' },
  }))
})

await page.goto('http://127.0.0.1:3091/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(7000)

const ball = page.getByLabel('云之家悬浮窗')
await ball.waitFor({ state: 'visible', timeout: 20000 })
// The v5 blob we poisoned opens the panel onto the todo tab already.
// If the poisoned store had crashed the pane, the dialog would never mount.
await ball.click()
await page.waitForTimeout(4000)
let dialog = page.getByRole('dialog', { name: '云之家' })
let visible = false
try { await dialog.waitFor({ state: 'visible', timeout: 8000 }); visible = true } catch {}
if (!visible) {
  // Toggle once more (the seeded open:true may have raced the boot).
  await ball.click()
  await page.waitForTimeout(1500)
  await ball.click()
  await page.waitForTimeout(4000)
  dialog = page.getByRole('dialog', { name: '云之家' })
  try { await dialog.waitFor({ state: 'visible', timeout: 8000 }); visible = true } catch {}
}
ok('panel renders with a stale persisted store', visible)
await page.waitForTimeout(3000)

const text = visible ? await dialog.innerText().catch(() => '') : ''
ok('todo tab renders (no .map crash)', text.includes('待办') || text.includes('任务库') || text.includes('开通'))
ok('no page errors (the .map crash is gone)', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '))

await browser.close()
console.log(failures === 0 ? '\n==== ALL PASS ====' : `\n==== ${failures} FAILURES ====`)
process.exit(failures === 0 ? 0 : 1)
