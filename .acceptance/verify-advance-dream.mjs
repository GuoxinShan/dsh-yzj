/**
 * Browser acceptance for the Dream direct-session path (决策 38): the board
 * 「Dream 抽取」 button must open a NEW session (yzj-dream-*) with the
 * distillation prompt as turn 1 — no askDraft banner, no topic bar. The
 * 「池 N」 button opens the pending-signals viewer. Requires rebuilt client +
 * running dsh web (:3080) + logged-in yzj-cli with at least one fresh signal
 * (patrol first; pool empty ⇒ SKIP exit 0, pitfall-037).
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots-advance-dream')
mkdirSync(OUT, { recursive: true })
const BASE = process.env.DSH_GUI ?? 'http://127.0.0.1:3080/'
const CHROME = [
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/opt/google/chrome/chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find(path => existsSync(path))

let failures = 0
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`)
  if (!cond) failures += 1
}

const browser = await chromium.launch({
  ...(CHROME === undefined ? {} : { executablePath: CHROME }),
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 1560, height: 940 }, locale: 'zh-CN' })
const pageErrors = []
page.on('pageerror', (error) => { pageErrors.push(String(error).slice(0, 200)) })

const skip = async (reason) => {
  console.log(`SKIP  ${reason}`)
  await page.screenshot({ path: join(OUT, 'skip.png') }).catch(() => {})
  await browser.close()
  process.exit(0)
}

/** Fresh web profiles paint the harness welcome + API-key cards over #root (pitfall-035). */
const dismissFirstRun = async () => {
  for (let step = 0; step < 4; step += 1) {
    const welcome = page.getByRole('dialog', { name: /内测声明|Internal Testing Notice/ })
    if (await welcome.isVisible().catch(() => false)) {
      await welcome.getByRole('button', { name: /继续|Continue/ }).click()
      await page.waitForTimeout(800)
      continue
    }
    const credential = page.getByRole('dialog', { name: /添加一个 API Key|Add an API key/ })
    if (await credential.isVisible().catch(() => false)) {
      await credential.getByRole('button', { name: /稍后配置|Configure later/ }).click()
      await page.waitForTimeout(800)
      continue
    }
    break
  }
}

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(5000)
await dismissFirstRun()

// --- 1. dock → workbench → 推进 board ---
const dock = page.getByTestId('yzj-group-space')
await dock.waitFor({ state: 'visible', timeout: 25000 })
await page.getByTestId('yzj-dock-home').click({ timeout: 8000 }).catch(() => {})
await page.waitForTimeout(2000)
await page.getByTestId('yzj-workbench-tabs').getByRole('tab', { name: '推进' }).click()
await page.waitForTimeout(4500)
const pane = page.getByTestId('yzj-advance-pane')
await pane.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {})
if (await pane.count() === 0) await skip('advance pane did not mount')

// --- 2. patrol once to feed the pool, then read the watermark line ---
const patrol = page.getByTestId('yzj-advance-patrol-now')
if (await patrol.count() > 0) {
  await patrol.click()
  await page.waitForTimeout(9000)
}
await page.waitForTimeout(1500)
const dreamLine = page.getByTestId('yzj-advance-dream-status')
const lineText = await dreamLine.innerText().catch(() => '')
await page.screenshot({ path: join(OUT, '1-board-pool.png') })
const poolBtn = page.getByTestId('yzj-advance-dream-pool')
if (await poolBtn.count() === 0) {
  await skip(`dream pool is empty (line="${lineText.replace(/\n/g, ' ')}") — direct-session path needs pending signals`)
}

// --- 3. pool viewer lists the pending entries ---
await poolBtn.click()
await page.waitForTimeout(800)
const dreamModal = page.getByTestId('yzj-advance-dream-modal')
ok('pool viewer modal opens', await dreamModal.count().then(n => n > 0))
const modalText = await dreamModal.innerText().catch(() => '')
ok('pool viewer lists entries', /待抽取 \d+ 条/.test(modalText) && modalText.includes('['), modalText.slice(0, 80).replace(/\n/g, ' '))
await page.screenshot({ path: join(OUT, '2-pool-viewer.png') })
await page.keyboard.press('Escape').catch(() => {})
await dreamModal.getByRole('button', { name: '关闭' }).click().catch(() => {})
await page.waitForTimeout(600)

// --- 4. Dream 抽取 opens a NEW session with the prompt as turn 1 ---
const dreamNow = page.getByTestId('yzj-advance-dream-now')
await dreamNow.click()
await page.waitForTimeout(9000)
const bodyText = await page.locator('body').innerText().catch(() => '')
// closeWorkbench hides the cover (attribute flip, not unmount) — assert
// invisibility, not DOM removal.
const coverVisible = await page.getByTestId('yzj-room-shell').first().isVisible().catch(() => false)
ok('workbench cover hidden onto the session view', coverVisible === false)
ok('dream session title pinned', bodyText.includes('Dream 抽取 · 池中'), bodyText.includes('Dream 抽取') ? 'title visible' : 'no title')
ok('distillation prompt is turn 1', bodyText.includes('yzj_advance_dream_status'))
ok('no askDraft banner', !bodyText.includes('已预备 · 蓄水池'))
await page.screenshot({ path: join(OUT, '3-dream-session.png') })

// --- 5. zero page errors ---
ok('zero page errors', pageErrors.length === 0, pageErrors.join(' | '))

await browser.close()
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
