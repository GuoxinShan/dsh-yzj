/**
 * Verify the 机器人 panel tab (robot pane):
 *  1. dock gains the 机器人 shortcut (5 items now)
 *  2. the tab opens and lists both configured channels (personal + group)
 *  3. the override editor lists recent groups in the picker
 *  4. provider catalog loads (dropdown has providers)
 *  5. saving an override for one group persists (row appears in the list)
 *  6. deleting the override removes the row
 */
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'

const BASE = process.env.DSH_VERIFY_BASE ?? 'http://127.0.0.1:3093/'
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
page.on('pageerror', (e) => console.log(`  [pageerror] ${String(e).slice(0, 250)}`))

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(6000)

const ball = page.getByLabel('云之家悬浮窗')
try { await ball.waitFor({ state: 'visible', timeout: 20000 }) } catch {}
await ball.hover()
await page.waitForTimeout(500)
const dock = page.getByRole('group', { name: '云之家快捷入口' })
await dock.waitFor({ state: 'visible', timeout: 5000 })
const dockItems = await dock.locator('button').count()
ok('dock has 5 tab shortcuts (机器人 added)', dockItems === 5, `${dockItems} items`)

// open the robot tab
await dock.getByRole('button', { name: '机器人' }).click()
await page.waitForTimeout(1500)
const panel = page.getByLabel('云之家工作台')
try { await panel.waitFor({ state: 'visible', timeout: 5000 }) } catch {}
const tabNav = page.getByLabel('云之家功能')
const tabBtn = tabNav.getByRole('button', { name: '机器人' })
ok('机器人 tab button exists', await tabBtn.count() > 0)

await page.waitForTimeout(2500)
const channelRows = await page.locator('li').filter({ hasText: '机器人通道' }).count()
  + await page.locator('li').filter({ hasText: '个人机器人' }).count()
  + await page.locator('li').filter({ hasText: '群对话机器人' }).count()
ok('channel status lists the two robots', channelRows >= 2, `${channelRows} rows`)

// override editor: group picker + provider select populated
const selects = page.locator('select')
const selectCount = await selects.count()
ok('override editor has 3 selects', selectCount >= 3, `${selectCount} selects`)
const groupOptions = await selects.first().locator('option').allInnerTexts()
ok('group picker lists recent groups', groupOptions.length > 1, groupOptions.slice(0, 3).join(','))

await page.waitForTimeout(1500)
const providerOptions = await selects.nth(1).locator('option').allInnerTexts()
ok('provider catalog loaded', providerOptions.some(text => text.includes('opencode') || text.includes('zai') || text.includes('deepseek')), providerOptions.slice(0, 4).join(','))

// save an override for the first group with a provider+model, then verify row
await selects.first().selectOption({ index: 1 })
await page.waitForTimeout(300)
const providerOptions2 = await selects.nth(1).locator('option').allInnerTexts()
const wanted = providerOptions2.find(text => text.includes('opencode-go'))
if (wanted !== undefined) {
  await selects.nth(1).selectOption(wanted)
  await page.waitForTimeout(600)
  const modelOptions = await selects.nth(2).locator('option').allInnerTexts()
  if (modelOptions.length > 1) {
    await selects.nth(2).selectOption({ index: 1 })
  }
  await page.getByRole('button', { name: '保存' }).click()
  await page.waitForTimeout(2500)
  const rows = await page.locator('li button').filter({ hasText: '群 ·' }).count()
  ok('override row appears after save', rows >= 1, `${rows} rows`)
  const note = await page.locator('p[role="status"]').last().innerText().catch(() => '')
  ok('save note shown', note.includes('已保存'), note.slice(0, 60))

  // reload the tab and confirm persistence
  await tabNav.getByRole('button', { name: '会话' }).click()
  await page.waitForTimeout(800)
  await tabNav.getByRole('button', { name: '机器人' }).click()
  await page.waitForTimeout(2500)
  const rowsAfterReload = await page.locator('li button').filter({ hasText: '群 ·' }).count()
  ok('override persists across tab reload', rowsAfterReload >= 1, `${rowsAfterReload} rows`)

  // delete it
  const firstRow = page.locator('li button').filter({ hasText: '群 ·' }).first()
  await firstRow.click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: '删除覆盖' }).click()
  await page.waitForTimeout(2500)
  const rowsAfterDelete = await page.locator('li button').filter({ hasText: '群 ·' }).count()
  ok('override row removed after delete', rowsAfterDelete === 0, `${rowsAfterDelete} rows`)
} else {
  ok('provider selectable (skip save flow)', false, 'no provider value')
}

await page.screenshot({ path: '.acceptance/shots-robot/robot-pane.png', fullPage: false })
await browser.close()
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
