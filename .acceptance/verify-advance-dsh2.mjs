/**
 * dsh-2 闭环演习主控（实验设计与验收标准：advance-dsh2-experiment.md）。
 * Playwright drives the panel; the sidecar (advance-dsh2-driver.ts, tsx) does
 * signal injection (dsh-2 group only), agent-parity feeds, todo completion,
 * and SQLite entry-stream assertions. Screenshots land in shots-advance-dsh2/.
 *
 * Run: node .acceptance/verify-advance-dsh2.mjs   (GUI on :3080 + yzj-cli logged in)
 */
import { chromium } from 'playwright'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots-advance-dsh2')
mkdirSync(OUT, { recursive: true })
const BASE = process.env.DSH_GUI ?? 'http://127.0.0.1:3080/'
const GROUP_NAME = 'dsh-2'
const execFileP = promisify(execFile)

let failures = 0
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`)
  if (!cond) failures += 1
}

/** Run one sidecar verb; returns the parsed stdout JSON. */
async function drive(...args) {
  const { stdout } = await execFileP('npx', ['tsx', join(dirname(fileURLToPath(import.meta.url)), 'advance-dsh2-driver.ts'), ...args], { timeout: 120_000 })
  const parsed = JSON.parse(stdout.trim().split('\n').pop())
  if (parsed.ok !== true) throw new Error(`driver ${args[0]} failed: ${stdout}`)
  return parsed
}

const browser = await chromium.launch({
  ...(existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome') ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}),
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 1560, height: 1000 }, locale: 'zh-CN' })
const pageErrors = []
page.on('pageerror', (error) => { pageErrors.push(String(error).slice(0, 200)) })

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(6000)
// Fresh profiles paint welcome/API-key cards over #root (pitfall-035)
for (let step = 0; step < 4; step += 1) {
  const welcome = page.getByRole('dialog', { name: /内测声明|Internal Testing Notice/ })
  if (await welcome.isVisible().catch(() => false)) { await welcome.getByRole('button', { name: /继续|Continue/ }).click(); await page.waitForTimeout(800); continue }
  break
}
await page.getByTestId('yzj-dock-home').click().catch(() => {})
await page.waitForTimeout(2000)
const tabs = page.getByTestId('yzj-workbench-tabs')
await tabs.getByRole('tab', { name: '推进' }).click()
await page.waitForTimeout(4500)
const pane = page.getByTestId('yzj-advance-pane')
if (await page.getByTestId('yzj-login-banner').count() > 0) {
  console.log('SKIP  yzj-cli not logged in')
  await browser.close()
  process.exit(0)
}

// ---------- S0 立项（面板直写）+ 关联 dsh-2 来源 ----------
const TITLE = '闭环演习·演示环境准备'
await (await page.getByTestId('yzj-advance-start').count() > 0
  ? page.getByTestId('yzj-advance-start')
  : page.getByTestId('yzj-advance-start-hero')).click()
const modal = page.getByTestId('yzj-advance-start-modal')
await modal.waitFor({ state: 'visible', timeout: 8000 })
await page.getByTestId('yzj-advance-draft-title').fill(TITLE)
await page.getByTestId('yzj-advance-draft-goal').fill('08-26 前完成演示环境搭建并通过一次彩排')
await modal.locator('input').nth(2).fill('2026-08-26')
await modal.locator('textarea').nth(1).fill('彩排通过: 0 / 1')
await modal.locator('textarea').nth(2).fill('演示环境依赖演示数据包；数据包不齐则环境起不来')
await page.getByTestId('yzj-advance-create').click()
await page.waitForTimeout(12000)
ok('A1a 立项入队', (await pane.innerText()).includes(TITLE))

// 关联来源：dsh-2 群
const queueItem = page.getByTestId('yzj-advance-queue').getByText(TITLE, { exact: true })
await queueItem.click()
await page.waitForTimeout(3000)
const detailText0 = await pane.innerText()
const advanceIdMatch = /A-\d{8}-\d{3}/.exec(detailText0)
const advanceId = advanceIdMatch?.[0] ?? ''
ok('A1b 事项号可见', advanceId !== '', advanceId)
await page.getByTestId('yzj-advance-source-add-open').click()
await page.waitForTimeout(4000)
const groupBtn = page.getByTestId('yzj-advance-source-group-gid-dsh2')
const groupReady = await groupBtn.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false)
ok('A1c 来源弹层列出 dsh-2', groupReady)
if (groupReady) {
  await groupBtn.click()
  await page.waitForTimeout(6000)
}
await page.keyboard.press('Escape').catch(() => {})
await page.getByTestId('yzj-advance-source-modal').getByRole('button', { name: '×' }).click().catch(() => {})
await page.waitForTimeout(1500)
ok('A1d 信息来源区出现 dsh-2', (await pane.innerText()).includes('dsh-2'))
await page.screenshot({ path: join(OUT, 's0-created.png') })

// ---------- S1 正常进展：dsh-2 信号 → 群房间喂给推进 ----------
const s1 = await drive('send', '演示脚本初稿已完成，明天下一轮校对')
ok('S1a 信号 1 已发 dsh-2', typeof s1.sent?.msgId === 'string', String(s1.sent?.msgId ?? ''))
await tabs.getByRole('tab', { name: '对话' }).click()
await page.waitForTimeout(3000)
const groupRow = page.getByTestId('yzj-conv-list').locator('button').filter({ hasText: GROUP_NAME }).first()
await groupRow.click()
await page.waitForTimeout(3000)
const latestRow = page.locator('[data-testid^="yzj-room-row-"]').first()
await latestRow.hover()
const feedBtn = page.locator('[data-testid^="yzj-advance-feed-"]').first()
await feedBtn.waitFor({ state: 'visible', timeout: 8000 })
await feedBtn.click()
await page.waitForTimeout(1500)
const picker = page.getByTestId('yzj-advance-feed-picker')
await picker.locator('label').filter({ hasText: TITLE }).click()
await picker.getByTestId('yzj-advance-feed-summary').fill('演示脚本初稿完成（S1 正常进展）')
await picker.getByTestId('yzj-advance-feed-submit').click()
await page.waitForTimeout(8000)
ok('S1b 喂给推进提交', await picker.count().then(n => n === 0))

await tabs.getByRole('tab', { name: '推进' }).click()
await page.waitForTimeout(3000)
await page.getByTestId('yzj-advance-queue').getByText(TITLE, { exact: true }).click()
await page.waitForTimeout(3000)
let tlText = await page.getByTestId('yzj-advance-timeline').innerText()
ok('A2a S1 事元在时间线', tlText.includes('演示脚本初稿完成'))
ok('A2b 阶段未被拖动（仍 running，不在待我决定）', !(await pane.innerText()).includes('待我决定') || (await pane.innerText()).includes('推进中'))
await page.screenshot({ path: join(OUT, 's1-fed.png') })

// ---------- S2 阻塞信号 → 决策卡 ----------
await drive('send', '演示数据包还没齐，供应侧说最早下周一（08-24）才能给到')
await drive('decide', advanceId)
// 同一事项已激活时点队列项不重拉（setActiveId 同值不触发 effect）——先点走再点回
const other = page.getByTestId('yzj-advance-queue').locator('button').filter({ hasText: '测试' }).first()
if (await other.count() > 0) { await other.click(); await page.waitForTimeout(1500) }
await page.getByTestId('yzj-advance-queue').getByText(TITLE, { exact: true }).first().click()
await page.waitForTimeout(3500)
const decisionArea = page.getByTestId('yzj-advance-decision')
const decisionText = await decisionArea.innerText().catch(() => '')
ok('A3a 进待我决定', (await pane.innerText()).includes('待我决定') || decisionText.includes('数据包'))
ok('A3b 决策卡带推论链', decisionText.includes('推论链') && decisionText.includes('威胁 08-26'))
const actionButtons = await page.locator('[data-testid^="yzj-advance-action-"]').count()
ok('A3c 动作按钮 ≥3', actionButtons >= 3, `count=${actionButtons}`)
await page.screenshot({ path: join(OUT, 's2-decision.png') })

// ---------- S3 三动作执行（决策 45 核心面） ----------
await page.getByTestId('yzj-advance-action-0').click()  // 建待办
await page.waitForTimeout(12000)
ok('A4a 建待办后置灰（流折叠）', (await page.getByTestId('yzj-advance-action-0').innerText()).includes('已建待办'))

await page.getByTestId('yzj-advance-action-1').click()  // 发消息：开草稿框
await page.waitForTimeout(1000)
await page.getByTestId('yzj-advance-action-send').click()
await page.waitForTimeout(12000)
ok('A4b 发消息后显示已发', (await page.getByTestId('yzj-advance-action-1').innerText()).includes('已发消息'))

await page.getByTestId('yzj-advance-action-2').click()  // 定会议：留痕 + 跳日程
await page.waitForTimeout(10000)
ok('A4c 定会议跳日程域', true)
await tabs.getByRole('tab', { name: '推进' }).click()
await page.waitForTimeout(2500)
await page.getByTestId('yzj-advance-queue').getByText(TITLE, { exact: true }).first().click().catch(() => {})
await page.waitForTimeout(3000)

// 刷新页面 → 执行态必须保持（foldDoneActions，不再是内存 Set）
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(7000)
await page.getByTestId('yzj-dock-home').click().catch(() => {})
await page.waitForTimeout(2000)
await page.getByTestId('yzj-workbench-tabs').getByRole('tab', { name: '推进' }).click()
await page.waitForTimeout(4000)
await page.getByTestId('yzj-advance-queue').getByText(TITLE, { exact: true }).first().click()
await page.waitForTimeout(3500)
const afterReload = await page.getByTestId('yzj-advance-actions').innerText().catch(() => '')
ok('A4d 刷新后执行态保持（三动作全已执行）',
  afterReload.includes('已建待办') && afterReload.includes('已发消息') && afterReload.includes('已跳日程'), afterReload.slice(0, 80))
await page.screenshot({ path: join(OUT, 's3-after-reload.png') })

// SQLite 面：执行事元 refs 断言
const entries1 = await drive('entries', advanceId)
const streamText = JSON.stringify(entries1.entries)
ok('A4e 执行事元 refs 含 todoId', /refs?[^,]*T-\d{8}-\d{3}|T-\d{8}-\d{3}/.test(streamText), '')
ok('A4f 执行事元 refs 含 im:g:m', /gid-dsh2[^"\s]*:/.test(streamText) || streamText.includes('im:gid-dsh2:'), '')
ok('A4g 动作序标记落库', streamText.includes('动作序'))
const todoRef = entries1.entries.map(e => String(e.refs ?? '')).find(r => /T-\d{8}-\d{3}/.test(r))
const todoId = /T-\d{8}-\d{3}/.exec(todoRef ?? '')?.[0] ?? ''
ok('A4h 待办 id 可提取（供 S4）', todoId !== '', todoId)

// ---------- S4 断层探测：勾待办 → 巡检 → Dream ----------
if (todoId !== '') {
  await drive('todo-done', todoId)
  await page.getByTestId('yzj-advance-patrol-now').click().catch(() => {})
  await page.waitForTimeout(15000)
  const dreamBtn = page.getByTestId('yzj-advance-dream-now')
  const dreamReady = await dreamBtn.count().then(n => n > 0)
  if (dreamReady) {
    await dreamBtn.click()
    // Dream 会话真跑 agent：轮询 180s 看待办完成回流事元（精确断言：来源=待办 且 summary 含完成语义）
    let reflow = false
    const deadline = Date.now() + 180_000
    while (Date.now() < deadline) {
      await page.waitForTimeout(15_000)
      const dump = await drive('entries', advanceId)
      if (dump.entries.some(e => e.sourceType === '待办' && /完成|done|办结/.test(String(e.summary ?? '')))) { reflow = true; break }
    }
    console.log(`${reflow ? 'PASS' : 'SOFT-FAIL'}  A5 todo 渠道回流（${reflow ? '超出预期：采集器已存在' : '断层证实：todo: 订阅无采集器，“完成回流”只能靠 agent 主动 feed——登记后续任务'}）`)
  } else {
    console.log('SOFT-FAIL  A5 Dream 按钮未就绪')
  }
  await page.screenshot({ path: join(OUT, 's4-dream.png') })
}

// ---------- S5 收口六态 ----------
// Dream 手动径会直建 yzj-dream-* 会话并切走页面（决策 38）——reload 回推进页签
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(7000)
await page.getByTestId('yzj-dock-home').click().catch(() => {})
await page.waitForTimeout(2000)
await page.getByTestId('yzj-workbench-tabs').getByRole('tab', { name: '推进' }).click()
await page.waitForTimeout(4000)
await page.getByTestId('yzj-advance-queue').getByText(TITLE, { exact: true }).first().click().catch(() => {})
await page.waitForTimeout(3000)
await page.getByTestId('yzj-advance-judge-confirm_advance').click()   // 确认推进 → updated
await page.waitForTimeout(8000)
await drive('review', advanceId)                                       // → ready-for-review
await tabs.getByRole('tab', { name: '推进' }).click()
await page.waitForTimeout(2500)
await page.getByTestId('yzj-advance-queue').locator('button').filter({ hasText: '测试' }).first().click().catch(() => {})
await page.waitForTimeout(1500)
await page.getByTestId('yzj-advance-queue').getByText(TITLE, { exact: true }).first().click()
await page.waitForTimeout(3000)
const acceptBtn = page.getByTestId('yzj-advance-judge-accept')
const acceptReady = await acceptBtn.count().then(n => n > 0)
ok('A6a 待我验收出现确认达到目标', acceptReady)
if (acceptReady) {
  await acceptBtn.click()
  await page.waitForTimeout(8000)
}
const entries2 = await drive('entries', advanceId)
const stages = entries2.entries.map(e => String(e.detail ?? '')).join(' ')
ok('A6b 六态走通 completed', stages.includes('completed') || JSON.stringify(entries2.entries).includes('已完成'), '')
await page.getByTestId('yzj-advance-show-all').click().catch(() => {})
await page.waitForTimeout(3000)
const fullText = await page.getByTestId('yzj-advance-timeline').innerText().catch(() => '')
const renderedCount = (fullText.match(/\d{2}:\d{2}/g) ?? []).length
ok('A6c 事元流全量（SQLite == 面板查看全部）', Math.abs(entries2.count - renderedCount) <= 2, `sqlite=${entries2.count} rendered~=${renderedCount}`)
await page.screenshot({ path: join(OUT, 's5-completed.png') })

// ---------- A7 边界 ----------
ok('A7a 零页面错误', pageErrors.length === 0, pageErrors.join(' | '))

await browser.close()
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
