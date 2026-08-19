/**
 * 830 真数据闭环实验 · 第 1 波:立项 + 历史回放(advance-830-experiment.md §4)。
 * root Chat 新会话,模型沿用当前会话默认(本机为 MiMo V2.5,非文档所写
 * DeepSeek-V4-Pro——文档选型理由是 Grok 4.6 当天 Connection error;
 * 经实验发起人拍板使用 MiMo V2.5,差异记入 gap §24.6 环境行)。
 * 预期:① 立项弹确认卡(第 1 张);② 纯追加不弹;③ 目标更新弹卡(第 2 张);
 * ④ 纯追加不弹。非预期卡一律拒绝并截图记录(实验红线 4)。
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots-advance-830')
mkdirSync(OUT, { recursive: true })
const shot = (name) => join(OUT, name)
const BASE = process.env.DSH_GUI ?? 'http://127.0.0.1:3080/'
const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome-stable',
].find((p) => existsSync(p))

// 第 0 波产出的纪要 docId
const DOC_0806 = '6a85774aecd3fb103b859f8a'
const DOC_0812 = '6a85774bfcb86444995406ed'
const DOC_0813 = '6a85774dfcb86444995406ee'

const PROMPTS = [
  {
    key: '1-create',
    expectCard: true,
    text: `用 yzj_advance_create 立项:title「830:从参谋部到 AI推进」;background「项目始于 AI参谋部/幕僚长构想(8/6 方案讨论、8/10 参谋场景),要把战略讨论变成可执行旅程」;goal「跑通 听会→标准纪要→共识入知识库→下一步入任务 的最小回路,产品口径对齐 PRD v2.1」;metrics 三行「金蝶标准纪要: 0 / 有」「共识入知识库: 0 / 有可溯源文档」「下一步可挂推进时间线: 0 / 有」;targetDate 2026/08/31;tags #830。`,
  },
  {
    key: '2-replay-0806',
    expectCard: false,
    text: `对「830:从参谋部到 AI推进」feed 一条进度更新:sourceType=文档,summary「参谋部阶段共识:幕僚长价值=真实理解×合法授权×闭环执行×时间连续性」,refs 带第 0 波 0806/0812 纪要的 docId(0806: ${DOC_0806};0812: ${DOC_0812})。`,
  },
  {
    key: '3-replay-0812-goal',
    expectCard: true,
    text: `8/12 产品定义卡把方向从 AI参谋部改为 AI推进。请 feed:changeType=目标更新,goal 改为「按 AI推进产品定义:六态看板+最小推进回路,跑通纪要→共识入库→下一步编排」,summary 说明转向,refs 带 0812 纪要 docId(${DOC_0812})。`,
  },
  {
    key: '4-replay-0813',
    expectCard: false,
    text: `feed 进度更新:8/13 推进任务管理功能方案讨论完成用户旅程对齐,refs 带 0813 纪要 docId(${DOC_0813})。`,
  },
]

let failures = 0
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + String(extra).slice(0, 160) + ')' : ''}`)
  if (!cond) failures += 1
}
const info = (msg) => console.log(`INFO  ${msg}`)

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage({ viewport: { width: 1560, height: 940 }, locale: 'zh-CN' })
page.on('pageerror', (e) => info(`[pageerror] ${String(e).slice(0, 160)}`))

const dismissFirstRun = async () => {
  for (let i = 0; i < 4; i += 1) {
    const w = page.getByRole('dialog', { name: /内测声明|Internal Testing Notice/ })
    if (await w.isVisible().catch(() => false)) { await w.getByRole('button', { name: /继续|Continue/ }).click(); await page.waitForTimeout(800); continue }
    const c = page.getByRole('dialog', { name: /添加一个 API Key|Add an API key/ })
    if (await c.isVisible().catch(() => false)) { await c.getByRole('button', { name: /稍后配置|Configure later/ }).click(); await page.waitForTimeout(800); continue }
    break
  }
}

/** 等模型一轮跑完:处理确认卡(按 expectCard),直到正文 10s 稳定。返回本轮卡数。 */
async function runPrompt(step, timeoutMs = 8 * 60 * 1000) {
  let cards = 0
  let last = ''
  let stable = 0
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    await page.waitForTimeout(3000)
    const confirmBtn = page.getByRole('button', { name: '确认', exact: true }).first()
    const hasCard = await confirmBtn.isVisible().catch(() => false)
    if (hasCard) {
      cards += 1
      await page.screenshot({ path: shot(`${step.key}-card-${cards}.png`) })
      if (step.expectCard && cards === 1) {
        info(`${step.key}: expected confirmation card #${cards} → 确认`)
        await confirmBtn.click()
      } else {
        info(`${step.key}: UNEXPECTED card #${cards} → 拒绝并记录`)
        await page.screenshot({ path: shot(`${step.key}-card-${cards}-unexpected.png`) })
        const reject = page.getByRole('button', { name: /^(拒绝|取消)$/, exact: true }).first()
        await reject.click().catch(() => {})
        ok(`${step.key} unexpected card`, false, '见截图')
      }
      await page.waitForTimeout(2000)
      stable = 0
      last = ''
      continue
    }
    const cur = await page.evaluate(() => document.body.innerText)
    if (cur === last) {
      stable += 1
      if (stable >= 4) break
    } else {
      stable = 0
      last = cur
    }
  }
  return { cards, finalText: last }
}

// --- 0. open + fresh root chat session ---
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(6000)
await dismissFirstRun()
await page.locator('button[class*="newSession"]').first().click()
await page.waitForTimeout(2500)
// 权限档位:Full access = approval never(harness permission-presets),ask 全被自动
// 转 deny;实验需要确认卡,切到 Workspace Write(approval: ask)。
const permPicker = page.locator('button, [role="button"]').filter({ hasText: /Full access|Workspace Write|Read Only/ }).first()
const permText = await permPicker.innerText().catch(() => '')
if (!permText.includes('Workspace Write')) {
  await permPicker.click()
  await page.waitForTimeout(1000)
  await page.getByText('Workspace Write', { exact: true }).first().click()
  await page.waitForTimeout(1200)
  info(`权限档位已切到 Workspace Write(原: ${permText.trim()})`)
}
const composer = page.locator('textarea:visible').first()
await composer.waitFor({ state: 'visible', timeout: 15000 })
await page.screenshot({ path: shot('0-fresh-session.png') })

// --- 1..4. prompts in order ---
let totalCards = 0
for (const step of PROMPTS) {
  info(`sending ${step.key}…`)
  await composer.fill(step.text + ' 请直接调用工具完成,不要询问我、不要给选项;如弹确认卡我会处理。')
  await page.getByRole('button', { name: '发送消息' }).first().click()
  let { cards, finalText } = await runPrompt(step)
  // 模型追问/未调工具时,催促重等(最多 2 次)
  for (let nudge = 0; nudge < 2 && !finalText.includes('yzj_advance'); nudge += 1) {
    info(`${step.key}: 未见工具卡,催促直接调用(nudge ${nudge + 1})`)
    await page.screenshot({ path: shot(`${step.key}-nudge-${nudge}.png`) })
    await composer.fill('请直接调用 yzj_advance 工具执行上面的请求,不要询问、不要给选项;确认卡我会处理。')
    await page.getByRole('button', { name: '发送消息' }).first().click()
    const retry = await runPrompt(step)
    cards += retry.cards
    finalText = retry.finalText
  }
  totalCards += cards
  await page.screenshot({ path: shot(`${step.key}-done.png`) })
  const cardVerdict = step.expectCard ? cards >= 1 : cards === 0
  ok(`${step.key} card expectation (${step.expectCard ? 'card' : 'no card'})`, cardVerdict, `cards=${cards}`)
  const tail = finalText.slice(-300).replace(/\n/g, ' ')
  info(`${step.key} tail: ${tail}`)
}
ok('全程确认卡恰好 2 张', totalCards === 2, `total=${totalCards}`)

// --- 5. board acceptance: 推进 tab → item → timeline ---
const dock = page.getByTestId('yzj-dock-home')
await dock.click({ timeout: 10000 }).catch(() => dock.click({ force: true }))
await page.waitForTimeout(2000)
const tabs = page.getByTestId('yzj-workbench-tabs')
await tabs.getByRole('tab', { name: '推进' }).click()
await page.waitForTimeout(5000)
const pane = page.getByTestId('yzj-advance-pane')
const paneText = await pane.innerText().catch(() => '')
ok('看板出现事项「830:从参谋部到 AI推进」', /830.{0,4}从参谋部到 AI推进/.test(paneText), paneText.slice(0, 120).replace(/\n/g, ' '))
await page.screenshot({ path: shot('5-board.png') })
// 点开事项
await pane.getByText(/830.{0,4}从参谋部到 AI推进/).first().click().catch(() => {})
await page.waitForTimeout(4000)
const detail = page.getByTestId('yzj-advance-detail')
const detailText = await detail.innerText().catch(() => '')
await page.screenshot({ path: shot('6-detail.png') })
const timelineRows = (detailText.match(/\n/g) || []).length
ok('时间旅程可见且 ≥4 行(立项+3 回放)', detailText.includes('已经推进到这里') && timelineRows >= 4, `lines=${timelineRows}`)
ok('目标区显示新 goal', detailText.includes('六态看板') && detailText.includes('最小推进回路'))
ok('指标卡三行可见', ['金蝶标准纪要', '共识入知识库', '下一步可挂推进时间线'].every((s) => detailText.includes(s)))

console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`)
console.log(`TOTAL_CARDS=${totalCards}`)
await browser.close()
process.exit(failures === 0 ? 0 : 1)
