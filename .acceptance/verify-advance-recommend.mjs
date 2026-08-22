/**
 * 决策 49 真机走查：推荐订阅源（refs 反推 → 面板推荐 chip → 挂上/忽略 → 抑制）。
 * 全程真实路径：消息只发 dsh-2（driver send），喂入走群房间 hover「喂给推进」
 * （refs 自动带 im:g:m，GUI 进程的推荐检查拿真订阅集）。
 * 探针 1 = 挂上路径；探针 2 = 忽略路径。
 *
 * Run: node .acceptance/verify-advance-recommend.mjs  (GUI on :3080 + login)
 */
import { chromium } from 'playwright'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots-advance-recommend')
mkdirSync(OUT, { recursive: true })
const execFileP = promisify(execFile)

let failures = 0
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`)
  if (!cond) failures += 1
}
async function drive(...args) {
  const { stdout } = await execFileP('npx', ['tsx', join(dirname(fileURLToPath(import.meta.url)), 'advance-dsh2-driver.ts'), ...args], { timeout: 120_000 })
  const parsed = JSON.parse(stdout.trim().split('\n').pop())
  if (parsed.ok !== true) throw new Error(`driver ${args[0]} failed: ${stdout}`)
  return parsed
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
await page.waitForTimeout(2000)
const tabs = page.getByTestId('yzj-workbench-tabs')
const pane = page.getByTestId('yzj-advance-pane')

const openAdvance = async () => {
  await tabs.getByRole('tab', { name: '推进' }).click()
  await page.waitForTimeout(4000)
}
const openItem = async (title) => {
  await pane.getByText(title, { exact: true }).last().click()
  await page.waitForTimeout(3000)
}
const createItem = async (title) => {
  const startButton = await page.getByTestId('yzj-advance-start').count() > 0
    ? page.getByTestId('yzj-advance-start')
    : page.getByTestId('yzj-advance-start-hero')
  await startButton.click()
  await page.getByTestId('yzj-advance-draft-title').fill(title)
  await page.getByTestId('yzj-advance-draft-goal').fill('验证推荐订阅源（决策 49）')
  await page.getByTestId('yzj-advance-create').click()
  await page.waitForTimeout(12000)
}
/** 群房间 hover dsh-2 最新消息 → 喂给推进 → picker 选目标事项。 */
const feedViaHover = async (itemTitle, summary) => {
  await tabs.getByRole('tab', { name: '对话' }).click()
  await page.waitForTimeout(3000)
  await page.getByTestId('yzj-conv-list').locator('button').filter({ hasText: 'dsh-2' }).first().click()
  await page.waitForTimeout(3000)
  await page.locator('[data-testid^="yzj-room-row-"]').first().hover()
  const feedBtn = page.locator('[data-testid^="yzj-advance-feed-"]').first()
  await feedBtn.waitFor({ state: 'visible', timeout: 8000 })
  await feedBtn.click()
  await page.waitForTimeout(1500)
  const picker = page.getByTestId('yzj-advance-feed-picker')
  await picker.locator('label').filter({ hasText: itemTitle }).last().click()
  await picker.getByTestId('yzj-advance-feed-summary').fill(summary)
  await picker.getByTestId('yzj-advance-feed-submit').click()
  await page.waitForTimeout(8000)
}
const reloadTo = async (title) => {
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(7000)
  await page.getByTestId('yzj-dock-home').click().catch(() => {})
  await page.waitForTimeout(2000)
  await openAdvance()
  await openItem(title)
}

// ---------- 探针 1：挂上路径 ----------
const T1 = '推荐探针·挂上'
await openAdvance()
await createItem(T1)
await openItem(T1)
const probe1 = /A-\d{8}-\d{3}/.exec(await pane.innerText())?.[0] ?? ''
ok('探针 1 已建', probe1 !== '', probe1)
await drive('send', '推荐探针消息 1：refs 反推验证（可忽略）')
await feedViaHover(T1, '喂入探针 1（推荐 dsh-2）')
await reloadTo(T1)
const rec1 = await page.getByTestId('yzj-advance-recommendations').innerText().catch(() => '')
ok('推荐 chip 出现（refs 反推）', rec1.includes('dsh-2'), rec1.slice(0, 80))
await page.screenshot({ path: join(OUT, '1-recommend.png') })
await page.getByTestId('yzj-advance-recommend-add-im-6a8400d4e4b09a073e3feeaf').click()
await page.waitForTimeout(10000)
ok('挂上后 chip 消失', await page.getByTestId('yzj-advance-recommendations').count().then(n => n === 0))
ok('挂上后来源区出现 dsh-2', (await pane.innerText()).includes('dsh-2'))
// 已订阅不推：再喂一条同渠道
await drive('send', '推荐探针消息 2：已订阅应不推（可忽略）')
await feedViaHover(T1, '喂入探针 1 第二条（应不推荐）')
await reloadTo(T1)
ok('已订阅后不再推荐', await page.getByTestId('yzj-advance-recommendations').count().then(n => n === 0))

// ---------- 探针 2：忽略路径 ----------
const T2 = '推荐探针·忽略'
await createItem(T2)
await openItem(T2)
const probe2 = /A-\d{8}-\d{3}/.exec(await pane.innerText())?.[0] ?? ''
ok('探针 2 已建', probe2 !== '', probe2)
await drive('send', '推荐探针消息 3：忽略路径验证（可忽略）')
await feedViaHover(T2, '喂入探针 2（推荐 dsh-2）')
await reloadTo(T2)
const rec2 = await page.getByTestId('yzj-advance-recommendations').innerText().catch(() => '')
ok('探针 2 推荐出现', rec2.includes('dsh-2'), rec2.slice(0, 80))
await page.getByTestId('yzj-advance-recommend-ignore-im-6a8400d4e4b09a073e3feeaf').click()
await page.waitForTimeout(8000)
ok('忽略后 chip 消失', await page.getByTestId('yzj-advance-recommendations').count().then(n => n === 0))
// 忽略抑制：再喂一条同渠道
await drive('send', '推荐探针消息 4：忽略后应不推（可忽略）')
await feedViaHover(T2, '喂入探针 2 第二条（忽略后应不推荐）')
await reloadTo(T2)
ok('忽略后永不推荐', await page.getByTestId('yzj-advance-recommendations').count().then(n => n === 0))
await page.screenshot({ path: join(OUT, '2-suppressed.png') })

// ---------- SQLite 审计面 ----------
const dump1 = await drive('entries', probe1)
const dump2 = await drive('entries', probe2)
ok('推荐事元落库（探针 1）', JSON.stringify(dump1.entries).includes('推荐订阅: im:6a8400d4e4b09a073e3feeaf'))
ok('忽略事元落库（探针 2）', JSON.stringify(dump2.entries).includes('推荐忽略: im:6a8400d4e4b09a073e3feeaf'))
ok('零页面错误', pageErrors.length === 0, pageErrors.join(' | '))

await browser.close()
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
