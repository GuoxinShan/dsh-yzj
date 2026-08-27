/**
 * Seed the item's first real 决策请求 card (2026-08-21): the two scope-extension
 * questions from the 8/19 评审 are the genuinely pending decision; feeding them
 * as a proper 决策请求 (options + action lines) makes the board's decision card
 * real. Drives an agent session in the native chat so the feed carries the
 * producer session. Then screenshots the card.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots-advance-ux')
mkdirSync(OUT, { recursive: true })
const DB = join(process.env.HOME ?? '', '.dsh/storages/yzj_advance.db')

const decisionEntry = () => {
  const db = new DatabaseSync(DB, { readOnly: true })
  const rows = db.prepare('SELECT fields FROM entries').all()
  db.close()
  return rows.map(row => JSON.parse(row.fields)).find(f => f['变化类型'] === '决策请求' && String(f['摘要']).includes('范围补充'))
}

let failures = 0
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`)
  if (!cond) failures += 1
}

const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1560, height: 1000 }, locale: 'zh-CN' })
page.on('pageerror', (error) => { console.log('PAGEERR', String(error).slice(0, 160)) })

await page.goto('http://127.0.0.1:3080/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(6000)

// Reuse the 「调用 yzj_advance_feed…」 session (it already has the feed context).
await page.getByText(/调用 yzj_advance_feed/).first().click().catch(() => {})
await page.waitForTimeout(3500)

const ask = [
  '对推进事项 A-20260819-002 调用一次 yzj_advance_feed（不要 stageTo，已经是 decision-needed）：',
  'changeType=决策请求，sourceType=会议，summary=「评审两个范围补充是否纳入最小回路」',
  'detail 如下原样抄（注意保留换行与「动作:」行）：',
  '评审浮现两个范围补充：①会议模板能力（用户发起速记时选模板、AI按模板格式自动填充）此前被排后期，需重新确认排期；②单人用 Agent 干活的工作现场（AI聊天框/IM/会议中）在当前原型中缺失，需确认是否纳入最小回路范围。',
  '选项1: 两个都纳入，最小回路扩大',
  '选项2: 只纳入会议模板，工作现场下期再评',
  '选项3: 都不纳入，维持现回路',
  '动作: 建待办 | 内容: 确认会议模板排期 | 截止: 2026-08-26 | 负责人: 同事丙',
  '动作: 发消息 | 内容: 评审两个范围补充（会议模板排期 / 单人Agent工作现场）想跟你对齐下是否纳入最小回路',
  '影响: 纳入与否决定 8/31 目标日期下的最小回路范围',
  '直接连续调用工具完成，不要询问我。',
].join('\n')
const composer = page.locator('textarea:visible').last()
await composer.fill(ask)
await page.keyboard.press('Enter')
console.log('ask sent; polling sqlite for the 决策请求 entry…')

const deadline = Date.now() + 4 * 60_000
let hit
while (Date.now() < deadline && hit === undefined) {
  await page.waitForTimeout(8000)
  hit = decisionEntry()
}
ok('决策请求 entry landed', hit !== undefined, hit ? `${hit['时间']} ${String(hit['摘要']).slice(0, 30)} 出处=${hit['出处会话'] ?? ''}` : 'none')

// Board: the decision card renders the question + options + actions.
await page.getByTestId('yzj-dock-home').click().catch(() => {})
await page.waitForTimeout(2000)
await page.getByTestId('yzj-workbench-tabs').getByRole('tab', { name: '推进' }).click()
await page.waitForTimeout(4000)
await page.getByTestId('yzj-advance-pane').getByText(/测试事项/).first().click()
await page.waitForTimeout(3500)
const area = await page.getByTestId('yzj-advance-decision').innerText()
ok('card shows the question', area.includes('评审两个范围补充是否纳入最小回路'))
ok('card shows options', area.includes('选项1') && area.includes('选项3'))
ok('card shows action buttons', area.includes('建待办：确认会议模板排期') && area.includes('发消息'))
await page.screenshot({ path: join(OUT, 'ux-decision-card-live.png') })

await browser.close()
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
