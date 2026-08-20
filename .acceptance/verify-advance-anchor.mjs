/**
 * Browser acceptance for 决策 39 (事元 msg ref 事件级定位): seeds one 对话
 * 事元 whose ref is `im:<groupId>:<msgId>` (real ids from yzj-cli), then the
 * advance detail's source jump must open THAT group AND render the anchor
 * message row (highlighted). Screenshots land in shots-advance-anchor/.
 * Requires running dsh web (:3080) + logged-in yzj-cli + local sqlite advance
 * store with the 830 item. Cleans the seeded entry afterwards.
 */
import { chromium } from 'playwright'
import { DatabaseSync } from 'node:sqlite'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots-advance-anchor')
mkdirSync(OUT, { recursive: true })
const BASE = process.env.DSH_GUI ?? 'http://127.0.0.1:3080/'
const ADVANCE_ID = process.env.ANCHOR_ADVANCE_ID ?? 'A-20260819-002'
const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome-stable',
].find(path => existsSync(path))

let failures = 0
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`)
  if (!cond) failures += 1
}

// --- 1. resolve one real group + message via yzj-cli (read-only) ---
const runCli = (args) => JSON.parse(execFileSync('yzj-cli', args, { encoding: 'utf8', timeout: 30_000 }))
let groupId = ''
let groupName = ''
let msgId = ''
try {
  const groups = runCli(['im', 'group', 'recent', '--limit', '20']).list ?? []
  const target = groups.find(g => (g.groupName ?? '').includes('830')) ?? groups[0]
  if (target === undefined) throw new Error('no recent groups')
  groupId = String(target.groupId)
  groupName = String(target.groupName ?? '')
  // Prefer a message OUTSIDE the first backfill window (~50 newest, CLI page
  // cap 20) so the run exercises the 决策 39 auto-paging path; fall back to
  // the newest row when the group is too shallow.
  const recent = runCli(['im', 'message', 'list', '--group-id', groupId, '--type', 'newest', '--limit', '20']).list ?? []
  const newest = recent.find(m => typeof (m.msgId ?? m.id) === 'string')
  if (newest === undefined) throw new Error('no messages in group')
  msgId = String(newest.msgId ?? newest.id)
  let cursor = recent[recent.length - 1]
  if (recent.length >= 20 && cursor !== undefined) {
    let deep = null
    for (let page = 0; page < 2; page += 1) {
      const older = runCli(['im', 'message', 'list', '--group-id', groupId, '--type', 'old', '--msg-id', String(cursor.msgId ?? cursor.id), '--limit', '20']).list ?? []
      if (older.length === 0) break
      deep = older[older.length - 1]
      cursor = deep
    }
    if (deep !== null) msgId = String(deep.msgId ?? deep.id)
  }
} catch (error) {
  console.log(`SKIP  yzj-cli read failed: ${String(error).slice(0, 120)}`)
  process.exit(0)
}
console.log(`seed target: ${groupName} (${groupId}) msg ${msgId}`)

// --- 2. seed one 对话 事元 with the anchored ref ---
const db = new DatabaseSync(join(homedir(), '.dsh', 'storages', 'yzj_advance.db'))
const at = new Date(Date.now() - 60_000)
const stamp = `${at.getFullYear()}/${String(at.getMonth() + 1).padStart(2, '0')}/${String(at.getDate()).padStart(2, '0')} ${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
const entryId = 'E-20260820-990'
const refToken = `im:${groupId}:${msgId}`
db.prepare('INSERT OR REPLACE INTO entries (entry_id, advance_id, fields) VALUES (?, ?, ?)').run(
  entryId,
  ADVANCE_ID,
  JSON.stringify({
    advance_id: ADVANCE_ID,
    时间: stamp,
    来源类型: '对话',
    变化类型: '备注',
    摘要: '验收锚点·点击来源应定位到消息',
    变化内容: `决策 39 事件级定位验收（群 ${groupName}）`,
    引用: refToken,
    操作者: 'user',
  }),
)
db.close()

// --- 3. browser: advance detail → source jump lands on the anchor row ---
const browser = await chromium.launch({
  ...(CHROME === undefined ? {} : { executablePath: CHROME }),
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 1560, height: 940 }, locale: 'zh-CN' })
const pageErrors = []
page.on('pageerror', (error) => { pageErrors.push(String(error).slice(0, 200)) })

try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(5000)
  for (let step = 0; step < 4; step += 1) {
    const welcome = page.getByRole('dialog', { name: /内测声明|Internal Testing Notice/ })
    if (await welcome.isVisible().catch(() => false)) {
      await welcome.getByRole('button', { name: /继续|Continue/ }).click()
      await page.waitForTimeout(800)
      continue
    }
    const credential = page.getByRole('dialog', { name: /添加一个 API Key|Add an API key/ })
    if (await credential.isVisible().catch(() => false)) {
      await credential.getByRole('button', { name: /稍后配置|Configure later/ }).click()
      await page.waitForTimeout(800)
      continue
    }
    break
  }

  const dock = page.getByTestId('yzj-group-space')
  await dock.waitFor({ state: 'visible', timeout: 25000 })
  await page.getByTestId('yzj-dock-home').click({ timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(2000)
  await page.getByTestId('yzj-workbench-tabs').getByRole('tab', { name: '推进' }).click()
  await page.waitForTimeout(4500)

  const itemRow = page.getByTestId(`yzj-advance-item-${ADVANCE_ID}`)
  if (await itemRow.count() === 0) {
    console.log(`SKIP  item ${ADVANCE_ID} not on the board`)
    await browser.close()
    process.exit(0)
  }
  await itemRow.click()
  await page.waitForTimeout(4000)
  await page.screenshot({ path: join(OUT, '1-detail-source.png') })

  const jump = page.locator('[data-testid^="yzj-advance-source-jump-"]').first()
  if (await jump.count() === 0) {
    ok('msg source jump rendered', false, 'no source-jump button on the detail')
  } else {
    await jump.click()
    await page.waitForTimeout(9000)
    const domain = await page.getByTestId('yzj-room-shell').getAttribute('data-workbench-domain').catch(() => '')
    ok('jump lands on the im domain', domain === 'im', `domain=${domain}`)
    const row = page.getByTestId(`yzj-room-row-${msgId}`)
    ok('anchor message row rendered (auto-paged when outside the first window)', await row.count().then(n => n > 0), `row yzj-room-row-${msgId.slice(0, 12)}…`)
    await page.screenshot({ path: join(OUT, '2-anchor-row.png') })
    const bodyText = await page.locator('body').innerText().catch(() => '')
    ok('no home-fused error', !bodyText.includes('requires a groupId or sessionId'))
  }
  ok('zero page errors', pageErrors.length === 0, pageErrors.join(' | '))
} finally {
  await browser.close().catch(() => {})
  const cleanup = new DatabaseSync(join(homedir(), '.dsh', 'storages', 'yzj_advance.db'))
  cleanup.prepare('DELETE FROM entries WHERE entry_id = ?').run(entryId)
  cleanup.close()
  console.log('seeded entry cleaned')
}

console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
