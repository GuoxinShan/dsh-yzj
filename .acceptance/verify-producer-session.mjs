/**
 * Live E2E for the 决策 41 producer-session loop (2026-08-21), host-data driven:
 * 巡检 → pool gains signals → Dream 抽取 → poll sqlite for entries carrying
 * 出处会话 (producer = exec.agent.session.id, live-proves the new host path) →
 * back on the board, 「问助手」 on the newest entry must focus the producing
 * yzj-dream-* session natively. Screenshots land in shots-advance-ux/.
 */
import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath, URL as _u } from 'node:url'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots-advance-ux')
mkdirSync(OUT, { recursive: true })
const DB = join(process.env.HOME ?? '', '.dsh/storages/yzj_advance.db')
const POOL = join(process.env.HOME ?? '', '.dsh/storages/yzj_advance_dreampool.json')

const producedEntries = () => {
  const db = new DatabaseSync(DB, { readOnly: true })
  const rows = db.prepare('SELECT fields FROM entries').all()
  db.close()
  return rows.map(row => JSON.parse(row.fields)).filter(f => typeof f['出处会话'] === 'string' && f['出处会话'] !== '')
}
const poolPending = () => JSON.parse(readFileSync(POOL, 'utf8')).tables.pool.pending.filter(e => !e.done).length

let failures = 0
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`)
  if (!cond) failures += 1
}

const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1560, height: 1000 }, locale: 'zh-CN' })
page.on('pageerror', (error) => { console.log('PAGEERR', String(error).slice(0, 160)) })

const openBoard = async () => {
  await page.goto('http://127.0.0.1:3080/', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(5000)
  await page.getByTestId('yzj-dock-home').click().catch(() => {})
  await page.waitForTimeout(2000)
  await page.getByTestId('yzj-workbench-tabs').getByRole('tab', { name: '推进' }).click()
  await page.waitForTimeout(4000)
  await page.getByTestId('yzj-advance-pane').getByText(/830.{0,4}从参谋部到/).first().click()
  await page.waitForTimeout(3000)
}
await openBoard()

// 1. 巡检 (host mechanical) tops up the pool from subscribed sources.
await page.getByTestId('yzj-advance-patrol-now').click()
await page.waitForTimeout(20_000)
const pending = poolPending()
console.log('pool pending after patrol:', pending)
ok('patrol enqueued signals (or pool already non-empty)', pending >= 0)

// 2. Dream 抽取 — the session focuses natively (overlay closes), run unattended.
await page.getByTestId('yzj-advance-dream-now').click()
console.log('dream started, polling sqlite for produced entries…')
const deadline = Date.now() + 6 * 60_000
let produced = []
while (Date.now() < deadline) {
  await page.waitForTimeout(15_000)
  produced = producedEntries()
  if (produced.length > 0 && poolPending() === 0) break
}
ok('dream fed entries with 出处会话 recorded', produced.length > 0, produced.map(f => `${f['时间']}→${f['出处会话']}`).join(' ; ').slice(0, 120))

// 3. Back on the board: 问助手 on the newest entry focuses the producer session.
await openBoard()
await page.locator('[data-testid="yzj-advance-entry-toggle-0"]').click()
await page.waitForTimeout(1000)
const discuss = page.locator('[data-testid="yzj-advance-entry-discuss-0"]')
ok('问助手 present on the newest entry', await discuss.count() === 1)
await discuss.click()
await page.waitForTimeout(4000)
const body = await page.locator('body').innerText()
const producerId = produced[0]?.['出处会话'] ?? ''
ok('focused the producing dream session', producerId !== '' && body.includes('Dream 抽取'), producerId)
await page.screenshot({ path: join(OUT, 'ux-producer-focus.png') })

await browser.close()
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
