/**
 * 存量 3 份速记纪要 → 测试事项事元(决策 40 落地动作②):打开 测试群话题,
 * 在问助手栏发定向指令(读 3 个 docId → yzj_advance_feed refs=[docId],
 * 不带基准字段→无确认卡),轮询本地 sqlite 直至 3 条事元落库。
 * 话题里的发送是用户本人意志的直写通道;agent 执行 1–5 分钟,脚本容忍。
 */
import { chromium } from 'playwright'
import { DatabaseSync } from 'node:sqlite'
import { homedir } from 'node:os'
import { join } from 'node:path'

const BASE = process.env.DSH_GUI ?? 'http://127.0.0.1:3080/'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ADVANCE_ID = process.env.YZJ_E2E_ADVANCE_ID ?? 'A-20260819-002'
const rawDocs = process.env.YZJ_MINUTES_DOC_IDS
if (!rawDocs) {
  console.log('SKIP  set YZJ_MINUTES_DOC_IDS=id1,id2,id3 to run this live check')
  process.exit(0)
}
const DOCS = rawDocs.split(',').map((id, i) => ({ id: id.trim(), name: `纪要-${i + 1}` })).filter(d => d.id !== '')
const PROMPT = `请把三份会议纪要吃进推进事项 ${ADVANCE_ID}（测试事项）：逐个用 yzj_doc_get 读这三篇文档——${DOCS.map(d => `${d.id}（${d.name}）`).join('、')}；每篇提炼一条事元，用 yzj_advance_feed 落到该事项：advanceId=${ADVANCE_ID}、sourceType=文档、changeType=进度更新、summary=一句话要点（含会议名）、detail=关键共识/决策摘要（3-5 句）、refs=[对应文档 docId]。不要带 goal/metrics/targetDate/stageTo。直接连续调用工具完成，不要询问我。最后给我一句「已落 N 条事元」的总结。`

const db = () => new DatabaseSync(join(homedir(), '.dsh', 'storages', 'yzj_advance.db'))
const foundDocIds = () => {
  const store = db()
  const rows = store.prepare('SELECT fields FROM entries WHERE advance_id = ?').all(ADVANCE_ID)
  store.close()
  const found = new Set()
  for (const row of rows) {
    for (const doc of DOCS) if (String(row.fields).includes(doc.id)) found.add(doc.id)
  }
  return found
}
console.log('baseline 已覆盖 docId:', [...foundDocIds()].length, '/ 3')

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage({ viewport: { width: 1560, height: 940 }, locale: 'zh-CN' })
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(6000)
await page.getByTestId('yzj-dock-home').click().catch(() => {})
await page.waitForTimeout(2500)

// 全新 harness 会话(旧话题会话 INVALID_REPLAY_STATE 损坏,换新会话绕开)
await page.locator('span.FJWpAa_newSessionLabel').first().click()
await page.waitForTimeout(5000)

// 发指令(fill 后必须验证 React 受控 state 真被更新——上一版空发超时 0/3)
const input = page.locator('textarea[placeholder*="描述你想要构建"]')
await input.fill(PROMPT)
let value = await input.inputValue()
if (value === '') {
  await input.click()
  await input.pressSequentially(PROMPT, { delay: 5 })
  value = await input.inputValue()
}
if (value === '') {
  console.log('FAIL  指令未能填入 composer')
  await browser.close(); process.exit(1)
}
await input.press('Enter')
await page.waitForTimeout(8000)
const bodyText = await page.locator('body').innerText().catch(() => '')
if (!bodyText.includes('三份会议纪要')) {
  console.log('FAIL  指令未出现在会话流里')
  await page.screenshot({ path: new URL('./shots-look/minutes-feed-fail.png', import.meta.url).pathname })
  await browser.close(); process.exit(1)
}
console.log('sent    指令已在新会话发出,等待 agent 执行…')

// 轮询 sqlite 直至 3 条事元落库(最多 6 分钟)
const deadline = Date.now() + 360_000
let done = foundDocIds()
while (done.size < 3 && Date.now() < deadline) {
  await page.waitForTimeout(10_000)
  done = foundDocIds()
  process.stdout.write(`\r        已落 ${done.size}/3…`)
}
console.log('')
await page.screenshot({ path: new URL('./shots-look/minutes-feed.png', import.meta.url).pathname })
await browser.close()
if (done.size === 3) {
  console.log('PASS    3 份纪要已全部落成事元(refs 含 docId)')
  process.exit(0)
}
console.log(`FAIL    超时,只覆盖 ${done.size}/3`)
process.exit(1)
