/**
 * Live five-stage loop against the GUI (:3080) + local SQLite (决策 36/52).
 * Agent-parity feeds go through the bridge sidecar (running→decision-needed,
 * then running→ready-for-review). Panel judge verbs (确认推进 / 确认达到目标)
 * are clicked in the board — D9 direct writes.
 * Requires rebuilt client, running dsh web, logged-in yzj-cli.
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, 'shots-advance')
mkdirSync(OUT, { recursive: true })
const BASE = process.env.DSH_GUI ?? 'http://127.0.0.1:3080/'
const TSX = join(HERE, '../../deepseek-harness/node_modules/.bin/tsx')
if (!existsSync(TSX)) throw new Error(`tsx not found at ${TSX}`)
const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find(path => existsSync(path))

let failures = 0
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`)
  if (!cond) failures += 1
}

function sidecar(args) {
  const stdout = execFileSync(TSX, [join(HERE, 'advance-loop-driver.ts'), ...args], {
    encoding: 'utf8',
    cwd: join(HERE, '..'),
    timeout: 120_000,
  })
  const line = stdout.trim().split('\n').filter(row => row.startsWith('{')).at(-1)
  if (line === undefined) throw new Error(`sidecar produced no JSON: ${stdout.slice(0, 400)}`)
  return JSON.parse(line)
}

async function openBoard(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(4000)
  await page.getByTestId('yzj-dock-home').click()
  await page.waitForTimeout(1500)
  const tabs = page.getByTestId('yzj-workbench-tabs')
  await tabs.waitFor({ state: 'visible', timeout: 15000 })
  await tabs.getByRole('tab', { name: '推进' }).click()
  const pane = page.getByTestId('yzj-advance-pane')
  await pane.waitFor({ state: 'visible', timeout: 20000 })
  await page.waitForTimeout(4000)
  return pane
}

const seeded = sidecar(['create-to-decision'])
ok('sidecar seeded decision-needed', seeded.ok === true && seeded.stage === 'decision-needed', `${seeded.advanceId} ${seeded.stage}`)
console.log(`  loop item ${seeded.advanceId} 「${seeded.title}」`)

const browser = await chromium.launch({
  ...(CHROME === undefined ? {} : { executablePath: CHROME }),
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 1560, height: 940 } })
const pageErrors = []
page.on('pageerror', (error) => { pageErrors.push(String(error).slice(0, 200)) })

try {
  let pane = await openBoard(page)
  let paneText = await pane.innerText()
  ok('queue shows 待我决定 with the probe', paneText.includes('待我决定') && paneText.includes(seeded.title), paneText.slice(0, 120).replace(/\n/g, ' '))
  const probe = page.getByTestId('yzj-advance-queue').getByText(seeded.title)
  if (await probe.count() > 0) await probe.first().click()
  await page.waitForTimeout(3000)
  const decision = page.getByTestId('yzj-advance-decision')
  ok('decision area asks 需要你决定', (await decision.innerText().catch(() => '')).includes('需要你决定'))
  await page.screenshot({ path: join(OUT, '6-loop-decide.png') })
  await page.getByTestId('yzj-advance-judge-confirm_advance').click()
  await page.waitForTimeout(12000)
  paneText = await pane.innerText()
  ok('确认推进 → 回到推进中 (no confirm card)', paneText.includes('确认推进') && paneText.includes('推进中') && !paneText.includes('需确认'), paneText.slice(0, 120).replace(/\n/g, ' '))
  await page.screenshot({ path: join(OUT, '7-loop-updated.png') })

  const reviewed = sidecar(['to-review', seeded.advanceId])
  ok('sidecar moved to ready-for-review', reviewed.ok === true && reviewed.stage === 'ready-for-review', reviewed.stage)
  pane = await openBoard(page)
  paneText = await pane.innerText()
  ok('queue shows 待我验收', paneText.includes('待我验收') && paneText.includes(seeded.title), paneText.slice(0, 120).replace(/\n/g, ' '))
  const probe2 = page.getByTestId('yzj-advance-queue').getByText(seeded.title)
  if (await probe2.count() > 0) await probe2.first().click()
  await page.waitForTimeout(3000)
  ok('decision area asks 是否已经达到目标', (await page.getByTestId('yzj-advance-decision').innerText().catch(() => '')).includes('是否已经达到目标'))
  await page.screenshot({ path: join(OUT, '8-loop-review.png') })
  await page.getByTestId('yzj-advance-judge-accept').click()
  await page.waitForTimeout(12000)
  paneText = await pane.innerText()
  ok('验收通过 → 已完成', paneText.includes('已完成') && paneText.includes(seeded.title), paneText.slice(0, 160).replace(/\n/g, ' '))
  const detail = await page.getByTestId('yzj-advance-detail').innerText().catch(() => '')
  ok('timeline kept 立项 + 确认推进 + 验收通过', detail.includes('立项') && detail.includes('确认推进') && detail.includes('验收通过'), detail.slice(0, 200).replace(/\n/g, ' '))
  await page.screenshot({ path: join(OUT, '9-loop-done.png') })
  ok('zero page errors', pageErrors.length === 0, pageErrors.join(' | '))
} finally {
  await browser.close()
}

console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
