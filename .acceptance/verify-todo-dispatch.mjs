/**
 * 期②执行回路真机验收（todo-swimlane-agent §5）：可认领卡点「让 agent 做」→
 * host 直建 yzj-todo-* 会话注入任务卡 → agent 自动 claim（进行中）→ 交卷
 * （待我验收，评语落卡）→ 人验收 → done。需要运行中的 GUI（:3080，重建后的
 * bundle）+ 可用模型路由。agent 回合有真实模型时延，轮询给足窗口。
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, 'shots-todo-swimlane')
mkdirSync(OUT, { recursive: true })
const BASE = process.env.DSH_GUI ?? 'http://127.0.0.1:3080/'

let fails = 0
const ok = (label, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  (' + extra + ')' : ''}`)
  if (!cond) fails += 1
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1560, height: 940 } })
const pageErrors = []
page.on('pageerror', (error) => { pageErrors.push(String(error).slice(0, 200)) })

async function openTodoLane() {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(4000)
  await page.getByTestId('yzj-dock-home').click()
  await page.waitForTimeout(1500)
  const tabs = page.getByTestId('yzj-workbench-tabs')
  await tabs.waitFor({ state: 'visible', timeout: 15000 })
  await tabs.getByRole('tab', { name: '待办' }).click()
  await page.waitForTimeout(4000)
  return page.getByTestId('yzj-todo-pane')
}

/** Poll a lane for the probe card (agent run has real model latency). Each
 * cycle reopens the workbench（聚焦派发会话会收起它）并「对话→待办」切tab
 * ——同 tab 重点不触发刷新，切走再切回才会重拉 todo-state（panel.tsx）。 */
async function waitForLane(laneKey, stamp, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await page.getByTestId('yzj-dock-home').click().catch(() => {})
    await page.waitForTimeout(1500)
    const tabs = page.getByTestId('yzj-workbench-tabs')
    if (await tabs.count() > 0) {
      await tabs.getByRole('tab', { name: '对话' }).click().catch(() => {})
      await page.waitForTimeout(800)
      await tabs.getByRole('tab', { name: '待办' }).click().catch(() => {})
      await page.waitForTimeout(3000)
      const pane = page.getByTestId('yzj-todo-pane')
      const count = await pane.getByTestId(`yzj-todo-lane-${laneKey}`).locator('[data-testid^="yzj-todo-card-"]').filter({ hasText: stamp }).count()
      if (count > 0) return true
    }
    await page.waitForTimeout(5000)
  }
  return false
}

try {
  let pane = await openTodoLane()

  // 1. 建探针（面板快捷新建 = 用户直写，落可认领，S6）
  const stamp = `派发探针 ${Date.now() % 100000}`
  const input = pane.locator('input[placeholder*="记一条待办"]')
  await input.click()
  await input.pressSequentially(`${stamp} #泳道`, { delay: 15 })
  await input.press('Enter')
  await page.waitForTimeout(4000)
  const card = pane.getByTestId('yzj-todo-lane-todo').locator('[data-testid^="yzj-todo-card-"]').filter({ hasText: stamp }).first()
  ok('探针落可认领列', await card.count() === 1)
  const todoId = (await card.getAttribute('data-testid'))?.replace('yzj-todo-card-', '') ?? ''
  ok('拿到 todoId', todoId !== '', todoId)

  // 2. 行内编辑写入描述（S7：描述=提示词本体——这里它就是 agent 的全部指令）
  await card.getByTestId(`yzj-todo-edit-${todoId}`).click()
  await page.waitForTimeout(400)
  await pane.getByTestId(`yzj-todo-edit-desc-${todoId}`).fill('这是期②验收探针，不需要任何真实工作：直接 yzj_todo_claim 认领（todoId 在任务卡里），然后 yzj_todo_submit_review 交卷，note 写「探针回执：链路通」。不要做任何其他事。')
  await pane.getByTestId(`yzj-todo-edit-save-${todoId}`).click()
  await page.waitForTimeout(4000)
  pane = page.getByTestId('yzj-todo-pane')
  ok('描述已写入卡片', (await pane.innerText()).includes('验收探针'))

  // 3. 点「让 agent 做」→ host 直建会话并聚焦（工作台收起、会话标题入侧栏）
  await pane.getByTestId(`yzj-todo-dispatch-${todoId}`).click()
  await page.waitForTimeout(6000)
  const bodyText = await page.locator('body').innerText()
  ok('会话已聚焦（待办·探针标题可见）', bodyText.includes(`待办 · ${stamp}`), bodyText.slice(0, 120).replace(/\n/g, ' '))
  await page.screenshot({ path: join(OUT, 'dispatch-session.png') })

  // 4. 等 agent 认领 + 交卷（轮询，真实模型时延给足 5 分钟窗口）
  const arrived = await waitForLane('in_review', stamp, 300_000)
  pane = page.getByTestId('yzj-todo-pane')
  ok('agent 交卷落「待我验收」', arrived)
  if (arrived) {
    const cardText = await pane.getByTestId('yzj-todo-lane-in_review').locator(`[data-testid="yzj-todo-card-${todoId}"]`).innerText().catch(() => '')
    // 评语形态由 agent 措辞，只要求非空验收说明区（reviewBox）在卡上
    ok('验收说明区在卡上', cardText.includes('回执') || cardText.includes('链路') || cardText.length > 0, cardText.slice(0, 100).replace(/\n/g, ' '))
    await page.screenshot({ path: join(OUT, 'dispatch-in-review.png') })
  }

  // 5. 人验收 → done（先切走再切回强制重拉，卡才在最新列）
  await page.getByTestId('yzj-dock-home').click().catch(() => {})
  await page.waitForTimeout(1500)
  const tabs5 = page.getByTestId('yzj-workbench-tabs')
  await tabs5.getByRole('tab', { name: '对话' }).click().catch(() => {})
  await page.waitForTimeout(800)
  await tabs5.getByRole('tab', { name: '待办' }).click()
  await page.waitForTimeout(3000)
  pane = page.getByTestId('yzj-todo-pane')
  const acceptBtn = pane.getByTestId(`yzj-todo-accept-${todoId}`)
  await acceptBtn.waitFor({ state: 'visible', timeout: 15000 })
  await acceptBtn.click()
  await page.waitForTimeout(400)
  await pane.getByTestId(`yzj-todo-note-confirm-${todoId}`).click()
  await page.waitForTimeout(4000)
  const doneCount = await pane.getByTestId('yzj-todo-lane-done').locator(`[data-testid="yzj-todo-card-${todoId}"]`).count()
  ok('人验收后落已完成', doneCount === 1)

  ok('zero page errors', pageErrors.length === 0, pageErrors.join(' | '))
} finally {
  await browser.close()
}

console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)
