/**
 * Visual sanity probe for the 待办 swimlane tab (todo-swimlane-agent §2.4):
 * the CSS module actually loaded (styled quick-create box, five lane columns,
 * card verb buttons) plus the workbench tab strip. DOM/computed-style based;
 * no screenshots needed. Requires the running GUI (:3080) with a rebuilt
 * client bundle and a provisioned todo library.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, 'shots-todo-swimlane')
mkdirSync(OUT, { recursive: true })

const BASE = process.env.DSH_GUI ?? 'http://127.0.0.1:3080/'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1560, height: 940 } })
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(4000)
await page.getByTestId('yzj-dock-home').click()
await page.waitForTimeout(1500)
const tabs = page.getByTestId('yzj-workbench-tabs')
await tabs.waitFor({ state: 'visible', timeout: 15000 })
await tabs.getByRole('tab', { name: '待办' }).click()
await page.waitForTimeout(4500)

const pane = page.getByTestId('yzj-todo-pane')

let fails = 0
const probe = async (label, selector, assert) => {
  const handle = await pane.locator(selector).first().evaluate((el) => {
    const s = getComputedStyle(el)
    return { radius: s.borderRadius, width: s.width, height: s.height, color: s.color, bg: s.backgroundColor, display: s.display, gap: s.gap }
  }).catch(() => null)
  const pass = handle !== null && assert(handle)
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${handle === null ? ' (missing)' : ''}`)
  if (!pass) fails += 1
}

// Five lanes in state-machine order (待我决定 | 可认领 | 进行中 | 待我验收 | 已完成).
const laneIds = ['backlog', 'todo', 'in_progress', 'in_review', 'done']
for (const key of laneIds) {
  const count = await pane.getByTestId(`yzj-todo-lane-${key}`).count()
  const pass = count === 1
  console.log(`${pass ? 'PASS' : 'FAIL'}  lane ${key} present`)
  if (!pass) fails += 1
}
await probe('lanes row lays out horizontally', 'div:has(> section[data-testid="yzj-todo-lane-backlog"])', s => s.display === 'flex')
await probe('quick-create box is a rounded card', 'input[placeholder*="记一条待办"] >> xpath=..', s => s.radius === '10px')
await probe('lane heading is a bold small label', 'section header', s => parseInt(s.height) > 0)

// Seed one todo via the panel quick-create (user-direct → lands 可认领, S6).
const stamp = `样式探针 ${Date.now() % 100000}`
const input = pane.locator('input[placeholder*="记一条待办"]')
await input.click()
await input.pressSequentially(`${stamp} #样式 今天`, { delay: 15 })
await input.press('Enter')
await page.waitForTimeout(4000)

const card = pane.getByTestId('yzj-todo-lane-todo').locator('[data-testid^="yzj-todo-card-"]').filter({ hasText: stamp }).first()
const cardOk = await card.count() === 1
console.log(`${cardOk ? 'PASS' : 'FAIL'}  panel quick-create lands in 可认领 lane`)
if (!cardOk) fails += 1
if (cardOk) {
  const todoId = (await card.getAttribute('data-testid'))?.replace('yzj-todo-card-', '') ?? ''
  // Card verbs exist（编辑/完成快路径/打回/中止）.
  for (const [verb, label] of [['edit', '编辑'], ['done', '完成'], ['return', '打回'], ['cancel', '中止']]) {
    const n = await card.locator(`[data-testid="yzj-todo-${verb}-${todoId}"]`).count()
    const pass = n === 1
    console.log(`${pass ? 'PASS' : 'FAIL'}  card verb ${label} present`)
    if (!pass) fails += 1
  }
  // 打回 → 待我决定列；批准 → 回可认领；中止 → 已终止折叠区。
  await card.locator(`[data-testid="yzj-todo-return-${todoId}"]`).click()
  await page.waitForTimeout(400)
  await pane.getByTestId(`yzj-todo-note-confirm-${todoId}`).click()
  await page.waitForTimeout(4000)
  const inBacklog = await pane.getByTestId('yzj-todo-lane-backlog').locator(`[data-testid="yzj-todo-card-${todoId}"]`).count()
  console.log(`${inBacklog === 1 ? 'PASS' : 'FAIL'}  打回后落入待我决定`)
  if (inBacklog !== 1) fails += 1
  await pane.getByTestId(`yzj-todo-approve-${todoId}`).click()
  await page.waitForTimeout(4000)
  const backInTodo = await pane.getByTestId('yzj-todo-lane-todo').locator(`[data-testid="yzj-todo-card-${todoId}"]`).count()
  console.log(`${backInTodo === 1 ? 'PASS' : 'FAIL'}  批准后回可认领`)
  if (backInTodo !== 1) fails += 1
  // 中止 → 已终止折叠
  await pane.getByTestId(`yzj-todo-cancel-${todoId}`).click()
  await page.waitForTimeout(4000)
  const fold = pane.getByTestId('yzj-todo-cancelled-toggle')
  const foldOk = await fold.count() === 1 && (await fold.innerText()).includes('已终止')
  console.log(`${foldOk ? 'PASS' : 'FAIL'}  中止后出现在已终止折叠区`)
  if (!foldOk) fails += 1
  await fold.click()
  await page.waitForTimeout(600)
  await pane.getByTestId(`yzj-todo-reopen-${todoId}`).click()
  await page.waitForTimeout(4000)
  const reopened = await pane.getByTestId('yzj-todo-lane-todo').locator(`[data-testid="yzj-todo-card-${todoId}"]`).count()
  console.log(`${reopened === 1 ? 'PASS' : 'FAIL'}  已终止重开回可认领`)
  if (reopened !== 1) fails += 1
  // 归档面（S10）：完成快路径 → 已完成列 → 归档 → 已归档折叠 → 恢复回已完成
  await pane.getByTestId(`yzj-todo-done-${todoId}`).click()
  await page.waitForTimeout(4000)
  const inDone = await pane.getByTestId('yzj-todo-lane-done').locator(`[data-testid="yzj-todo-card-${todoId}"]`).count()
  console.log(`${inDone === 1 ? 'PASS' : 'FAIL'}  完成快路径落已完成`)
  if (inDone !== 1) fails += 1
  await pane.getByTestId(`yzj-todo-archive-${todoId}`).click()
  await page.waitForTimeout(4000)
  const goneFromLanes = await pane.locator(`[data-testid="yzj-todo-card-${todoId}"]`).count() === 0
  console.log(`${goneFromLanes ? 'PASS' : 'FAIL'}  归档后不占列`)
  if (!goneFromLanes) fails += 1
  const archFold = pane.getByTestId('yzj-todo-archived-toggle')
  const archFoldOk = await archFold.count() === 1 && (await archFold.innerText()).includes('已归档')
  console.log(`${archFoldOk ? 'PASS' : 'FAIL'}  已归档折叠区出现`)
  if (!archFoldOk) fails += 1
  await archFold.click()
  await page.waitForTimeout(600)
  await pane.getByTestId(`yzj-todo-unarchive-${todoId}`).click()
  await page.waitForTimeout(4000)
  const backInDone = await pane.getByTestId('yzj-todo-lane-done').locator(`[data-testid="yzj-todo-card-${todoId}"]`).count()
  console.log(`${backInDone === 1 ? 'PASS' : 'FAIL'}  恢复后回已完成`)
  if (backInDone !== 1) fails += 1
  // 留证 + 清理：探针最终归档（已完成列不留垃圾）
  await page.screenshot({ path: join(OUT, 'swimlane-board.png') })
  await pane.getByTestId(`yzj-todo-archive-${todoId}`).click()
  await page.waitForTimeout(3000)
}

await browser.close()
console.log(fails === 0 ? '\n==== VISUAL SANITY ALL PASS ====' : `\n==== ${fails} VISUAL FAILURES ====`)
process.exit(fails === 0 ? 0 : 1)
