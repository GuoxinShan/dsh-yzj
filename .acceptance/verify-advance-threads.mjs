/**
 * Browser acceptance for AI推进 ③.2 意图线程订阅 (ai-advance-design §15.5)
 * against the live GUI (:3080). Requires rebuilt client + running dsh web +
 * logged-in yzj-cli. Journey: sidecar-probed decision item → 决策区选项渲染
 * → 点选项落 user 事元 → 关联渠道弹层（群 picker + 手输 token）→ 线程 chip
 * 出现/解除（解除不删已产事元）。立项挂线程①与「同群两事项一次取流」由
 * advance.spec.ts（fake CLI）覆盖——storage-domain 注册表是 GUI 进程私有的。
 * Unlogged GUI skips with exit 0. Screenshots land in shots-advance-threads/.
 */
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, 'shots-advance-threads')
mkdirSync(OUT, { recursive: true })
const BASE = process.env.DSH_GUI ?? 'http://127.0.0.1:3080/'
const CHROME = [
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/opt/google/chrome/chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(path => existsSync(path))

let failures = 0
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`)
  if (!cond) failures += 1
}

const browser = await chromium.launch({
  ...(CHROME === undefined ? {} : { executablePath: CHROME }),
  headless: process.env.E2E_HEADED === '1' ? false : true,
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

// --- sidecar probe: decision-needed item with 选项N rows --------------------
let probe = { title: '', advanceId: '' }
try {
  const raw = execFileSync('npx', ['tsx', join(HERE, 'advance-threads-driver.ts')], {
    cwd: join(HERE, '..'), encoding: 'utf8', timeout: 180_000,
  }).trim().split('\n').pop() ?? ''
  probe = JSON.parse(raw)
} catch (error) {
  console.log(`DRIVER-ERROR  ${String(error).slice(0, 300)}`)
}
if (probe.ok === false) await skip(`sidecar probe failed at ${probe.step}: ${probe.error}`)
ok('sidecar seeded a decision-needed probe', probe.ok === true && probe.stage === 'decision-needed', `${probe.advanceId} ${probe.title}`)

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(5000)
await dismissFirstRun()

const dock = page.getByTestId('yzj-group-space')
const dockUp = await dock.waitFor({ state: 'visible', timeout: 25000 }).then(() => true).catch(() => false)
if (!dockUp) await skip('云之家 dock not mounted — GUI not running the yzj bundle')
const home = page.getByTestId('yzj-dock-home')
await home.click({ timeout: 8000 }).catch(() => home.click({ force: true }))
await page.waitForTimeout(2500)

const tabs = page.getByTestId('yzj-workbench-tabs')
await tabs.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {})
await tabs.getByRole('tab', { name: '推进' }).click()
await page.waitForTimeout(4500)
const pane = page.getByTestId('yzj-advance-pane')
await pane.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {})
ok('advance pane mounted', await pane.count().then(n => n > 0))
if (await page.getByTestId('yzj-login-banner').count() > 0) {
  await skip('yzj-cli not logged in on this machine — chrome OK, write-path skipped')
}
let paneText = await pane.innerText().catch(() => '')
if (paneText.includes('推进看板还没有开通')) {
  await page.getByTestId('yzj-advance-ensure').click()
  await page.waitForTimeout(12000)
}

// --- 1. decision area renders 选项N rows ------------------------------------
const probeRow = page.getByTestId('yzj-advance-queue').getByText(probe.title, { exact: true })
ok('probe item on the board', await probeRow.count().then(n => n > 0), probe.title)
if (await probeRow.count() > 0) await probeRow.click()
await page.waitForTimeout(4000)
const decision = page.getByTestId('yzj-advance-decision')
const decisionText = await decision.innerText().catch(() => '')
ok('decision area renders the options', decisionText.includes('选项1：追加资源，目标日期不变') && decisionText.includes('选项2：目标日期顺延两周'), decisionText.slice(0, 120).replace(/\n/g, ' '))
ok('影响 row shown separately', decisionText.includes('影响：检验标准需同步调整'))
ok('classic verbs still present', await page.getByTestId('yzj-advance-judge-confirm_advance').count().then(n => n > 0)
  && await page.getByTestId('yzj-advance-judge-ignore').count().then(n => n > 0))
await page.screenshot({ path: join(OUT, '1-decision-options.png') })

// --- 2. choosing an option lands a user 事元 --------------------------------
await page.getByTestId('yzj-advance-option-2').click()
await page.waitForTimeout(9000)
const timeline = page.getByTestId('yzj-advance-timeline')
const tlAfterJudge = await timeline.innerText().catch(() => '')
ok('option choice lands 确认推进：选项全文', tlAfterJudge.includes('确认推进：目标日期顺延两周'), tlAfterJudge.slice(0, 160).replace(/\n/g, ' '))
ok('choice entry marked 你的判断', tlAfterJudge.includes('你的判断'))
await page.screenshot({ path: join(OUT, '2-option-chosen.png') })

// --- 3. 关联渠道: group picker ------------------------------------------------
const openPicker = page.getByTestId('yzj-advance-thread-add-open')
await openPicker.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {})
ok('关联渠道 entry on the sources column', await openPicker.count().then(n => n > 0))
await openPicker.click()
await page.waitForTimeout(3000)
const modal = page.getByTestId('yzj-advance-thread-modal')
ok('关联渠道 modal opens', await modal.count().then(n => n > 0))
const groupButtons = page.getByTestId('yzj-advance-thread-groups').locator('button')
const groupCount = await groupButtons.count().catch(() => 0)
ok('group picker lists recent groups', groupCount > 0, `${groupCount} groups`)
if (groupCount > 0) {
  const groupName = await groupButtons.first().innerText().catch(() => '')
  await groupButtons.first().click()
  await page.waitForTimeout(7000)
  const chips = page.getByTestId('yzj-advance-threads')
  const chipsText = await chips.innerText().catch(() => '')
  ok('im thread chip appears after association', chipsText.includes(groupName) || chipsText.length > 0, chipsText.slice(0, 80).replace(/\n/g, ' '))
  await page.screenshot({ path: join(OUT, '3-group-chip.png') })
  // --- 4. chip × unlinks (registry only; entries untouched) ----------------
  const removeBtn = page.locator('[data-testid^="yzj-advance-thread-remove-"]').first()
  if (await removeBtn.count() > 0) {
    await removeBtn.click()
    await page.waitForTimeout(6000)
    ok('chip removed after ×', await page.getByTestId('yzj-advance-threads').count().then(async n => n === 0 ? true : !(await page.getByTestId('yzj-advance-threads').innerText().catch(() => '')).includes(groupName)))
  }
}

// --- 5. manual token association lands a 备注 事元 ----------------------------
await openPicker.click()
await page.waitForTimeout(2000)
const tokenInput = page.getByTestId('yzj-advance-thread-token')
await tokenInput.fill('doc:e2e-probe-doc')
await page.getByTestId('yzj-advance-thread-token-submit').click()
await page.waitForTimeout(9000)
const tlAfterDoc = await page.getByTestId('yzj-advance-timeline').innerText().catch(() => '')
ok('document association lands one 备注 事元', tlAfterDoc.includes('关联渠道：e2e-probe-doc'), tlAfterDoc.slice(-160).replace(/\n/g, ' '))
await page.screenshot({ path: join(OUT, '4-doc-thread.png') })

ok('zero page errors', pageErrors.length === 0, pageErrors.join(' | '))

await browser.close()
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
