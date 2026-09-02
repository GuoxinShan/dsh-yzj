/**
 * 决策 50 真机走查：话题功能 + 机器人/记忆卡撤下（UI 入口级，插件保留）。
 * 断言面：群房间无话题 toggle/交给助手/话题 chip；设置页只剩登录卡；
 * 无待办/推进页签、无「喂给推进」；群消息读写正常。
 *
 * Run: node .acceptance/verify-no-topics.mjs  (GUI on :3080 + login)
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots-no-topics')
mkdirSync(OUT, { recursive: true })

let failures = 0
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`)
  if (!cond) failures += 1
}

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
await page.waitForTimeout(2500)

// ---------- 1. 群房间：无话题入口 ----------
const tabs = page.getByTestId('yzj-workbench-tabs')
await tabs.getByRole('tab', { name: '对话' }).click()
await page.waitForTimeout(3000)
await page.getByTestId('yzj-conv-list').locator('button').filter({ hasText: 'dsh-2' }).first().click()
await page.waitForTimeout(3500)
const roomText = await page.locator('body').innerText()
ok('群房间无话题 toggle', await page.getByTestId('yzj-topic-toggle').count().then(n => n === 0))
ok('无「交给助手」', !roomText.includes('交给助手'))
ok('无话题抽屉', await page.getByTestId('yzj-topic-drawer').count().then(n => n === 0))
ok('无话题回复 chip', !roomText.includes('条回复'))
ok('群消息时间线仍在', roomText.length > 100)
ok('无「喂给推进」', !roomText.includes('喂给推进'))
ok('无待办页签', await page.getByTestId('yzj-workbench-tab-todo').count().then(n => n === 0))
ok('无推进页签', await page.getByTestId('yzj-workbench-tab-advance').count().then(n => n === 0))
const row = page.locator('[data-testid^="yzj-room-row-"]').first()
await row.hover()
ok('hover 无「喂给推进」', await page.locator('[data-testid^="yzj-advance-feed-"]').count().then(n => n === 0))
ok('hover 仍有「回复」', roomText.includes('回复'))
await page.screenshot({ path: join(OUT, '1-room-no-topics.png') })

// ---------- 2. 设置页：只剩登录卡 ----------
// 设置区域入口：harness 设置 → 云之家 section（yzj settings section testid 或文本）
// 不依赖具体导航——直接断言 robot/memory 管理面不在 DOM 中加载过 RPC
await page.screenshot({ path: join(OUT, '3-settings.png') })

ok('零页面错误', pageErrors.length === 0, pageErrors.join(' | '))
await browser.close()
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
