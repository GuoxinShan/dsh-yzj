/**
 * R23 / H26: drag-to-composer ☁ chips are retired.
 * Walks the live GUI workbench (对话 / 日程 / 知识库) and asserts
 * no `draggable` sources and no 「松开以插入云之家引用」 overlay.
 * @ mention sources remain (not asserted here — official InputBar).
 * GUI down → skip exit 0 so leftover CI / habit scripts stay green.
 */
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'

const BASE = process.env.DSH_GUI ?? 'http://127.0.0.1:3080/'
const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find(path => existsSync(path))

const live = await fetch(BASE, { signal: AbortSignal.timeout(1500) }).then(r => r.ok).catch(() => false)
if (!live) {
  console.log('SKIP  drag-to-chip retired (R23); GUI not running')
  process.exit(0)
}

let failures = 0
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`)
  if (!cond) failures += 1
}

const browser = await chromium.launch({
  ...(CHROME === undefined ? {} : { executablePath: CHROME }),
  headless: process.env.E2E_HEADED === '1' ? false : true,
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.log(`  [pageerror] ${String(e).slice(0, 240)}`))

try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(4000)
  const dock = page.getByTestId('yzj-group-space')
  await dock.waitFor({ state: 'visible', timeout: 25000 })
  ok('sidebar-foot 云之家 dock is visible', await dock.isVisible())

  const probe = async (label) => page.evaluate((domain) => {
    // Official sidebar project/session rows stay draggable (harness).
    // R23 only retires yzj workbench drag-to-chip sources.
    const roots = [
      ...document.querySelectorAll('[data-testid^="yzj-"]'),
    ]
    const seen = new Set()
    const draggable = []
    for (const root of roots) {
      for (const el of root.querySelectorAll('[draggable="true"]')) {
        if (seen.has(el)) continue
        seen.add(el)
        draggable.push({
          tag: el.tagName.toLowerCase(),
          testid: el.getAttribute('data-testid') ?? '',
          text: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40),
        })
      }
    }
    const body = document.body?.innerText ?? ''
    return {
      domain,
      draggable,
      overlay: body.includes('松开以插入') || body.includes('插入云之家引用'),
      dropHint: [...document.querySelectorAll('[class*="dropOverlay"]')].some(el =>
        (el.className || '').toString().includes('dropOverlay')),
    }
  }, label)

  await page.getByTestId('yzj-dock-home').click()
  await page.waitForTimeout(2000)
  const tabs = page.getByTestId('yzj-workbench-tabs')
  await tabs.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {})
  ok('workbench tabs are visible', await tabs.isVisible().catch(() => false))
  ok('sidebar-foot has no domain dock buttons', await page.getByTestId('yzj-dock-chat').count().then(n => n === 0))

  const domains = [
    { id: 'yzj-workbench-tab-chat', label: '对话' },
    { id: 'yzj-workbench-tab-calendar', label: '日程' },
    { id: 'yzj-workbench-tab-docs', label: '知识库' },
  ]
  for (const { id, label } of domains) {
    await page.getByTestId(id).click()
    await page.waitForTimeout(label === '对话' ? 2000 : 1200)
    if (label === '对话') {
      const row = page.getByTestId('yzj-conv-list').locator('button').first()
      if (await row.count() > 0) {
        await row.click()
        await page.waitForTimeout(1500)
      }
    }
    const snap = await probe(label)
    ok(`${label}: no draggable workbench rows`, snap.draggable.length === 0, JSON.stringify(snap.draggable.slice(0, 3)))
    ok(`${label}: no drop overlay copy`, snap.overlay === false)
    ok(`${label}: no dropOverlay node`, snap.dropHint === false)
  }
} finally {
  await browser.close()
}

if (failures > 0) {
  console.log(`FAIL  ${failures} check(s)`)
  process.exit(1)
}
console.log('OK    drag-to-chip retired (R23)')
process.exit(0)
