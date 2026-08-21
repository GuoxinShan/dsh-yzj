/**
 * Live proof for the 决策 41 producer chain (2026-08-21): drive the LATEST
 * yzj-dream-* session in the native chat — ask it to feed one clearly-marked
 * 备注 into 830 — then poll sqlite for the entry whose 出处会话 equals that
 * session id (exec.agent.session.id recorded by the new host), and finally
 * assert the board's 「问助手」 on that entry focuses the dream session back.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots-advance-ux')
mkdirSync(OUT, { recursive: true })
const DB = join(process.env.HOME ?? '', '.dsh/storages/yzj_advance.db')
const DREAM_ID = process.env.DREAM_ID ?? 'yzj-dream-20260821-173349'

const entryWithProducer = () => {
  const db = new DatabaseSync(DB, { readOnly: true })
  const rows = db.prepare('SELECT fields FROM entries').all()
  db.close()
  return rows
    .map(row => JSON.parse(row.fields))
    .find(f => f['出处会话'] === DREAM_ID)
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

// 1. Open the latest dream session from the official session list
//    (row title = 「Dream 抽取 · 池中 N 条」; the board button is bare「Dream 抽取」).
const sessionRow = page.getByText(/Dream 抽取 · 池中/).last()
await sessionRow.click().catch(() => {})
await page.waitForTimeout(4000)
const body0 = await page.locator('body').innerText()
ok('dream session opened in native chat', body0.includes('蓄水池') || body0.includes('pending'))

// 2. Ask it to feed one marked 备注 into 830 (proves exec.agent.session.id on the live host).
const composer = page.locator('textarea:visible').last()
await composer.fill('调用 yzj_advance_feed：advanceId=A-20260819-002，summary=「讨论回环产出会话验证（可忽略）」，sourceType=人工，changeType=备注。直接连续调用工具完成，不要询问我。')
await page.keyboard.press('Enter')
console.log('ask sent; polling sqlite for the produced entry…')
const deadline = Date.now() + 4 * 60_000
let hit
while (Date.now() < deadline && hit === undefined) {
  await page.waitForTimeout(10_000)
  hit = entryWithProducer()
}
ok('entry fed with 出处会话 = the dream session', hit !== undefined, hit ? `${hit['时间']} ${String(hit['摘要']).slice(0, 30)} → ${hit['出处会话']}` : 'none')

// 3. Board: 问助手 on that newest entry focuses the dream session back.
await page.getByTestId('yzj-dock-home').click().catch(() => {})
await page.waitForTimeout(2000)
await page.getByTestId('yzj-workbench-tabs').getByRole('tab', { name: '推进' }).click()
await page.waitForTimeout(4000)
await page.getByTestId('yzj-advance-pane').getByText(/830.{0,4}从参谋部到/).first().click()
await page.waitForTimeout(3500)
await page.locator('[data-testid="yzj-advance-entry-toggle-0"]').click()
await page.waitForTimeout(1000)
await page.locator('[data-testid="yzj-advance-entry-discuss-0"]').click()
await page.waitForTimeout(4000)
const body = await page.locator('body').innerText()
ok('问助手 focused the producing dream session', body.includes('Dream 抽取'))
await page.screenshot({ path: join(OUT, 'ux-producer-focus.png') })

await browser.close()
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
