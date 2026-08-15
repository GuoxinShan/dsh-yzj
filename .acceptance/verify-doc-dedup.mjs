/**
 * Doc-preview duplication regression: blocks carry the same text twice
 * (childNodes tree + content array); the preview and the drag-chip codec
 * must render each line exactly once. Drives the real panel on :3091.
 */
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'

const DOC_WS = 'kb-meetings' // 会议Agent知识库 (otl meeting notes)
const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find(path => existsSync(path))

let failures = 0
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`)
  if (!cond) failures++
}

const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)))

await page.goto('http://127.0.0.1:3091/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(6000)
const ball = page.getByLabel('云之家悬浮窗')
await ball.waitFor({ state: 'visible', timeout: 20000 })
await ball.click()
const dialog = page.getByRole('dialog', { name: '云之家' })
await dialog.waitFor({ state: 'visible', timeout: 15000 })

// 知识库 → 会议Agent知识库 → 打开一篇会议记录 → 读右栏预览行。
await dialog.locator('nav button').filter({ hasText: '知识库' }).first().click()
await page.waitForTimeout(4000)
const wsItem = dialog.locator('div[class*="paneLeft"] button[class*="item"]').filter({ hasText: '我的知识' }).first()
await wsItem.waitFor({ state: 'visible', timeout: 15000 })
await wsItem.click()
await page.waitForTimeout(3500)
// The 会议记录 doc is text-heavy (dozens of lines) — the strongest signal.
const docItem = dialog.locator('div[class*="paneRight"] button[class*="item"]').filter({ hasText: '会议记录' }).first()
await docItem.waitFor({ state: 'visible', timeout: 15000 })
await docItem.click()
await page.waitForTimeout(5000)

// Collect the preview body lines (right pane below the back button).
const bodyText = await dialog.locator('div[class*="paneRight"]').innerText().catch(() => '')
const lines = bodyText.split('\n').map(line => line.trim()).filter(line => line !== '')
ok('preview renders the meeting-note body (not just meta)', lines.length > 5, `${lines.length} lines`)
// The first content line should be the doc title text, not doubled.
const contentLines = lines.filter(line => !line.startsWith('在线文档') && !line.startsWith('多维表格') && line !== '返回文档')
ok('body lines extracted', contentLines.length > 3, `${contentLines.length} content lines`)

// Duplication check: no line should equal the immediately following line
// (the old bug rendered each sentence twice in a row).
let adjacentDupes = 0
for (let i = 1; i < lines.length; i += 1) {
  if (lines[i] === lines[i - 1]) adjacentDupes += 1
}
ok('no adjacent duplicated lines', adjacentDupes === 0, `${adjacentDupes} dup pairs`)

// Stronger: every long BODY line must be unique (the pane also shows the
// doc title in its header — the title block legitimately appears once in
// the header and once as the body's first line).
const titleLine = lines[1] ?? ''
const bodyLongs = lines.filter(line => line.length > 12 && line !== '返回文档' && line !== titleLine)
const uniqueLongs = new Set(bodyLongs).size
ok('every long body line is unique (no duplicated content)', bodyLongs.length === uniqueLongs, `${bodyLongs.length} long lines, ${uniqueLongs} unique`)

ok('zero page errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '))
await browser.close()
console.log(failures === 0 ? '\n==== ALL PASS ====' : `\n==== ${failures} FAILURES ====`)
process.exit(failures === 0 ? 0 : 1)
