/**
 * 真机验证：接水源（测试群 + AI速记知识库）+ todo 渠道采集器（决策 45 后续，
 * gap §24.28 断层补钉）。
 *
 * Journey: 测试事项关联 im:测试群 + dir:AI速记知识库整库 → 新建「回流探针」
 * 事项经决策卡动作建待办（自动挂 todo: 订阅）→ 立即巡检建基线 → sidecar 勾掉
 * 该待办 → 再巡检 → 蓄水池必须出现 todo: 渠道条目（硬断言）→ Dream 抽取 →
 * 探针事项落「待办完成」事元（软断言，LLM 产出）。
 *
 * Run: node .acceptance/verify-advance-todo-channel.mjs  (GUI on :3080 + login)
 */
import { chromium } from 'playwright'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots-advance-todo-channel')
mkdirSync(OUT, { recursive: true })
const execFileP = promisify(execFile)

let failures = 0
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`)
  if (!cond) failures += 1
}
async function drive(...args) {
  const { stdout } = await execFileP('npx', ['tsx', join(dirname(fileURLToPath(import.meta.url)), 'advance-dsh2-driver.ts'), ...args], { timeout: 120_000 })
  const parsed = JSON.parse(stdout.trim().split('\n').pop())
  if (parsed.ok !== true) throw new Error(`driver ${args[0]} failed: ${stdout}`)
  return parsed
}

const GROUP_TEST = 'gid-test'
const KB_MINUTES = 'dir-kb' // AI速记知识库（整库）
const ITEM_TEST_TITLE = '测试事项'
const PROBE_TITLE = '回流探针·数据包'

const browser = await chromium.launch({
  ...(existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome') ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}),
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 1560, height: 1000 }, locale: 'zh-CN' })
const pageErrors = []
page.on('pageerror', (error) => { pageErrors.push(String(error).slice(0, 200)) })

await page.goto('http://127.0.0.1:3080/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(6000)
await page.getByTestId('yzj-dock-home').click().catch(() => {})
await page.waitForTimeout(2000)
const tabs = page.getByTestId('yzj-workbench-tabs')
await tabs.getByRole('tab', { name: '推进' }).click()
await page.waitForTimeout(4500)
const pane = page.getByTestId('yzj-advance-pane')

// ---------- 1. 测试事项接上两源 ----------
await pane.getByText(ITEM_TEST_TITLE, { exact: false }).first().click()
await page.waitForTimeout(3500)
const beforeSources = await pane.innerText()
const needGroup = !beforeSources.includes('测试群')
const needKb = !beforeSources.includes('AI速记知识库')
if (needGroup || needKb) {
  await page.getByTestId('yzj-advance-source-add-open').click()
  await page.waitForTimeout(4000)
  if (needGroup) {
    await page.getByTestId(`yzj-advance-source-group-${GROUP_TEST}`).click()
    await page.waitForTimeout(5000)
  }
  if (needKb) {
    const kbBtn = page.getByTestId(`yzj-advance-source-dir-${KB_MINUTES}`)
    const kbReady = await kbBtn.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)
    ok('纪要库整库在 picker', kbReady)
    if (kbReady) { await kbBtn.click(); await page.waitForTimeout(5000) }
  }
  await page.getByTestId('yzj-advance-source-modal').getByRole('button', { name: '关闭' }).click().catch(() => {})
  await page.waitForTimeout(1500)
}
const afterSources = await pane.innerText()
ok('测试事项挂上 测试群', afterSources.includes('测试群'))
ok('测试事项挂上纪要库', afterSources.includes('AI速记知识库'))
await page.screenshot({ path: join(OUT, '1-sources.png') })

// ---------- 2. 回流探针：立项 → 决策卡动作建待办（自动挂 todo: 订阅） ----------
const startButton = await page.getByTestId('yzj-advance-start').count() > 0
  ? page.getByTestId('yzj-advance-start')
  : page.getByTestId('yzj-advance-start-hero')
await startButton.click()
await page.getByTestId('yzj-advance-start-modal').waitFor({ state: 'visible', timeout: 8000 })
await page.getByTestId('yzj-advance-draft-title').fill(PROBE_TITLE)
await page.getByTestId('yzj-advance-draft-goal').fill('验证 todo 渠道回流：待办完成应回到本事项时间线')
await page.getByTestId('yzj-advance-create').click()
await page.waitForTimeout(12000)
await pane.getByText(PROBE_TITLE, { exact: true }).last().click()  // last()：抗上轮残留同名探针
await page.waitForTimeout(3000)
const probeId = /A-\d{8}-\d{3}/.exec(await pane.innerText())?.[0] ?? ''
ok('探针事项已建', probeId !== '', probeId)
// sidecar 推 running + 决策卡（动作行：建待办）
await drive('send', '回流探针信号：渠道验证用，可忽略')  // dsh-2 留痕（约束不变）
await drive('probe', probeId)  // draft→running + 决策卡（动作行：建待办）
await page.getByTestId('yzj-advance-queue').locator('button').filter({ hasText: '测试' }).first().click().catch(() => {})
await page.waitForTimeout(1500)
await pane.getByText(PROBE_TITLE, { exact: true }).last().click()
await page.waitForTimeout(3500)
const actionBtn = page.getByTestId('yzj-advance-action-0')
const actionReady = await actionBtn.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false)
ok('探针决策卡动作按钮', actionReady)
if (!actionReady) {
  console.log('FAIL  决策卡未渲染，终止')
  await browser.close()
  process.exit(1)
}
await actionBtn.click()  // 建待办（自动挂 todo: 订阅）
await page.waitForTimeout(12000)
ok('建待办已执行', (await actionBtn.innerText()).includes('已建待办'))
const dump1 = await drive('entries', probeId)
const todoRef = dump1.entries.map(e => String(e.refs ?? '')).find(r => /T-\d{8}-\d{3}/.test(r))
const todoId = /T-\d{8}-\d{3}/.exec(todoRef ?? '')?.[0] ?? ''
ok('探针待办 id 提取', todoId !== '', todoId)

// ---------- 3. 巡检建基线（im:测试群 / dir:纪要库 / todo:探针待办） ----------
await page.getByTestId('yzj-advance-patrol-now').click()
await page.waitForTimeout(20000)
await page.screenshot({ path: join(OUT, '2-patrol-baseline.png') })

// ---------- 4. 勾掉探针待办 → 再巡检 → 池里必须有 todo: 条目（硬断言） ----------
await drive('todo-done', todoId)
await page.getByTestId('yzj-advance-patrol-now').click()
await page.waitForTimeout(20000)
// 硬断言：蓄水池浮层必须出现 todo: 渠道条目（采集器产出的直接证据）
const poolBtn = page.getByTestId('yzj-advance-dream-pool')
const poolBtnReady = await poolBtn.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)
ok('池查看按钮可见（水位>0）', poolBtnReady)
if (poolBtnReady) {
  await poolBtn.click()
  await page.waitForTimeout(2500)
  const poolText = await page.getByTestId('yzj-advance-dream-entries').innerText().catch(() => '')
  ok('池中含 todo: 渠道条目（采集器产出）', poolText.includes(`todo:${todoId}`), poolText.slice(0, 120))
  await page.screenshot({ path: join(OUT, '3-pool.png') })
  await page.getByTestId('yzj-advance-dream-modal').getByRole('button', { name: '关闭' }).click().catch(() => {})
  await page.getByTestId('yzj-advance-dream-modal').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
}
// ---------- 5. Dream 等 agent → 探针事项应落「待办完成」事元（软断言） ----------
await page.getByTestId('yzj-advance-dream-now').click()  // 手动径触发抽取
await page.waitForTimeout(3000)
let reflow = false
const deadline = Date.now() + 180_000
while (Date.now() < deadline) {
  await page.waitForTimeout(15_000)
  const dump = await drive('entries', probeId)
  if (dump.entries.some(e => /完成|done|办结/.test(String(e.summary ?? '')) && String(e.refs ?? '').includes('todo:'))) { reflow = true; break }
}
ok('todo 渠道完成回流事元（Dream 抽取落）', reflow, reflow ? '' : '180s 未见——检查 Dream 会话')
await page.screenshot({ path: join(OUT, '3-reflow.png') })

// ---------- 6. 测试水源的巡检面：cursor 建立 + 订阅清单 ----------
const scanLine = await page.getByTestId('yzj-advance-scan-status').innerText().catch(() => '')
ok('巡检状态行存在', scanLine.length > 0, scanLine.slice(0, 60))

ok('零页面错误', pageErrors.length === 0, pageErrors.join(' | '))
await browser.close()
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
