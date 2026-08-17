/**
 * v2.0 group-room + topic e2e against the live GUI (:3080).
 * Covers spec/group-room-topics.md §7 items 1–3, 8 (partial), 10 (panel composer).
 * Requires: running `dsh web`, logged-in yzj-cli, and a rebuilt client bundle.
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots-group-room')
mkdirSync(OUT, { recursive: true })
const shot = (name) => join(OUT, name)

const GROUP_NAME = process.env.YZJ_E2E_GROUP ?? '测试群'
const BASE = process.env.DSH_GUI ?? 'http://127.0.0.1:3080/'
const MARKER = `【群房间e2e】${new Date().toISOString().slice(11, 19)} ${Math.random().toString(36).slice(2, 6)}`

const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find(path => existsSync(path))

let failures = 0
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`)
  if (!cond) failures++
}

const browser = await chromium.launch({
  ...(CHROME === undefined ? {} : { executablePath: CHROME }),
  headless: process.env.E2E_HEADED === '1' ? false : true,
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const pageErrors = []
page.on('pageerror', (e) => {
  const text = String(e).slice(0, 240)
  pageErrors.push(text)
  console.log(`  [pageerror] ${text}`)
})

try {
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(5000)

const dock = page.getByTestId('yzj-group-space')
await dock.waitFor({ state: 'visible', timeout: 25000 })
ok('sidebar-foot 云之家 dock is visible (no floating ball)', await dock.isVisible())
ok('floating ball is gone', await page.getByLabel('云之家悬浮窗').count().then(n => n === 0).catch(() => true))
await page.getByTestId('yzj-dock-chat').click()
await page.waitForTimeout(2500)

const convList = page.getByTestId('yzj-conv-list')
await convList.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {})
const groupRow = page.getByTestId('yzj-conv-list').locator('button').filter({ hasText: GROUP_NAME }).first()
const groupFound = await groupRow.count().then(n => n > 0).catch(() => false)
ok(`workbench list includes ${GROUP_NAME}`, groupFound)
if (!groupFound) {
  await page.screenshot({ path: shot('0-no-group.png') })
  await browser.close()
  console.log(`\n${failures} FAILURE(S)`)
  process.exit(1)
}
await groupRow.click()
await page.waitForTimeout(2500)
await page.screenshot({ path: shot('0-workbench.png') })

const stream = page.getByTestId('yzj-fused-stream')
const roomReady = await stream.waitFor({ state: 'visible', timeout: 4000 }).then(() => true).catch(() => false)
if (!roomReady) {
  const sideHit = page.getByText(GROUP_NAME, { exact: true }).last()
  await sideHit.click().catch(() => {})
  await stream.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {})
}
await page.waitForTimeout(500)

const roomPill = page.getByTestId('yzj-room-pill')
const roomComposer = page.getByTestId('yzj-room-composer')
await roomComposer.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {})
const chromeText = `${await roomComposer.innerText().catch(() => '')}\n${await roomPill.innerText().catch(() => '')}`
ok('group room chrome is 发进群, not 丢进群', chromeText.includes('发进群') && !chromeText.includes('丢进群'), chromeText.slice(0, 80))
ok('dock 发进群 chrome is gone', await page.getByTestId('yzj-home-chrome').count().then(n => n === 0).catch(() => true))
const tablistVisible = await page.getByRole('tablist').filter({ has: page.getByRole('tab', { name: '群房间' }) }).isVisible().catch(() => false)
ok('tab ring is hidden on the group room', !tablistVisible)
const convBox = await convList.boundingBox().catch(() => null)
const sendBox = await page.getByTestId('yzj-send-to-group').boundingBox().catch(() => null)
ok(
  '发进群 sits in the timeline column, not under the session list',
  convBox === null || sendBox === null || sendBox.x >= convBox.x + convBox.width - 12,
  convBox && sendBox ? `listRight=${Math.round(convBox.x + convBox.width)} sendX=${Math.round(sendBox.x)}` : 'missing box',
)
const toolbarText = await roomComposer.innerText().catch(() => '')
ok('light-send toolbar exposes 表情/图片/文件 (H14)', ['表情', '图片', '文件'].every(label => toolbarText.includes(label)), toolbarText.slice(0, 60))
const streamText = await stream.innerText().catch(() => '')
ok('timeline never labels senders 群消息 (H13)', !streamText.includes('群消息'), streamText.slice(0, 120))
await page.screenshot({ path: shot('1-room.png') })

const roomTab = page.getByRole('tab', { name: '群房间' })
if (await roomTab.isVisible().catch(() => false)) await roomTab.click().catch(() => {})
await stream.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {})
await page.waitForTimeout(500)

const tas = await page.locator('textarea').evaluateAll(els => els.map(el => ({
  label: el.getAttribute('aria-label'),
  readonly: el.readOnly,
  placeholder: el.getAttribute('placeholder'),
  visible: el.offsetParent !== null,
})))
console.log('INFO  textareas', JSON.stringify(tas))

const sendGroup = page.getByTestId('yzj-send-to-group')
const sendVisible = await sendGroup.isVisible().catch(() => false)
const draft = page.getByTestId('yzj-room-composer').locator('textarea')
const draftVisible = await draft.isVisible().catch(() => false)
ok('conversation composer is editable', draftVisible)
ok('发进群 button is on the group room', sendVisible)
const roomPlaceholder = tas.some(row => row.visible && typeof row.placeholder === 'string' && row.placeholder.includes('发进'))
ok('composer placeholder is 发进群, not 给智能体发消息', roomPlaceholder, JSON.stringify(tas))
if (draftVisible && sendVisible) {
  await draft.click()
  await draft.fill(MARKER)
  await page.keyboard.press('Escape').catch(() => {})
  await sendGroup.click({ timeout: 8000, force: true })
  let bubble = false
  for (let i = 0; i < 20; i += 1) {
    await page.waitForTimeout(500)
    const body = await page.evaluate(() => document.body.innerText)
    if (body.includes(MARKER) && !body.includes('需确认') && !body.includes('强确认')) {
      bubble = true
      break
    }
  }
  ok('发进群 paints ② immediately with no confirm card', bubble)
  const afterSend = await page.evaluate(() => document.body.innerText)
  ok('发进群 did not open a model turn', !afterSend.includes('需确认') && !/正在思考|Thinking/.test(afterSend))
  await page.screenshot({ path: shot('2-sent.png') })

  // Row actions are hover-revealed (opacity 0 at rest): hover first, then force-click.
  const sentRow = stream.locator('[data-origin="dsh-send"]').filter({ hasText: MARKER }).last()
  await sentRow.hover().catch(() => {})
  await page.waitForTimeout(300)
  const handoff = sentRow.getByRole('button', { name: /交给助手/ })
  const handoffVisible = await handoff.count().then(n => n > 0).catch(() => false)
  ok('交给助手 is on the sent row', handoffVisible)
  if (handoffVisible) {
    await handoff.click({ force: true })
    let drawerVisible = false
    for (let i = 0; i < 20; i += 1) {
      await page.waitForTimeout(400)
      drawerVisible = await page.getByTestId('yzj-topic-drawer').count().then(n => n > 0).catch(() => false)
      if (drawerVisible) break
    }
    const stillRoom = await stream.isVisible().catch(() => false)
    ok('交给助手 opens the topic drawer', drawerVisible)
    ok('timeline stays after 交给助手', stillRoom)
    let chipOnSent = false
    for (let i = 0; i < 20; i += 1) {
      chipOnSent = await page.locator('[data-testid^="yzj-reply-chip-"]').count().then(n => n > 0).catch(() => false)
      if (chipOnSent) break
      await page.waitForTimeout(400)
    }
    ok('root bubble shows N 条回复 chip after 交给助手', chipOnSent)
    await page.screenshot({ path: shot('3-topic.png') })

    const native = page.getByRole('button', { name: /原生会话/ })
    if (await native.count() > 0) {
      await native.first().click()
      await page.waitForTimeout(800)
    }
    const back = page.getByTestId('yzj-topic-anchor')
    ok('topic header shows the origin anchor card', await back.count().then(n => n > 0).catch(() => false))
    if (await back.count() > 0) {
      await back.first().click()
      await page.waitForTimeout(800)
    }
    const roomTabAgain = page.getByRole('tab', { name: '群房间' })
    if (await roomTabAgain.count() > 0) await roomTabAgain.first().click().catch(() => {})
    await stream.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {})
    let linked = false
    for (let i = 0; i < 15; i += 1) {
      linked = await page.getByRole('button', { name: /条回复/ }).count().then(n => n > 0).catch(() => false)
      if (linked) break
      await page.waitForTimeout(400)
    }
    ok('same message now links the existing topic (idempotent)', linked)
  }
} else {
  ok('发进群 paints ② immediately with no confirm card', false, 'no editable composer or 发进群 button')
  ok('发进群 did not open a model turn', false)
  ok('交给助手 is on the sent row', false)
}

await page.keyboard.press('Escape').catch(() => {})
await page.waitForTimeout(400)
const jumpRoom = page.getByRole('button', { name: '回群房间' })
if (await jumpRoom.count() > 0) {
  await jumpRoom.first().click()
  await page.waitForTimeout(800)
}
const roomChrome = await page.getByTestId('yzj-room-composer').innerText().catch(() => '')
ok('回群房间 restores 发进群 chrome', roomChrome.includes('发进群') && !roomChrome.includes('问助手'), roomChrome.slice(0, 80))
await page.screenshot({ path: shot('4-room-back.png') })

const searchBtn = page.getByRole('button', { name: '搜索会话' })
if (await searchBtn.count() > 0) {
  await searchBtn.click().catch(() => {})
  const searchBox = page.getByRole('textbox', { name: '搜索会话…' })
  if (await searchBox.count() > 0) {
    await searchBox.fill('')
    await searchBox.fill(GROUP_NAME)
    await page.waitForTimeout(1500)
    const resultTree = page.getByRole('tree', { name: '搜索结果' })
    const hits = await resultTree.getByRole('treeitem').count().catch(() => 0)
    const named = await page.getByText(GROUP_NAME).count()
    const resultText = await resultTree.innerText().catch(() => '')
    console.log('INFO  search results', JSON.stringify(resultText.slice(0, 200)))
    ok(
      'group room session is in the DSH sidebar under the group name',
      hits > 0 || named > 1,
      `treeitems=${hits} named=${named}`,
    )
    await page.keyboard.press('Escape').catch(() => {})
  }
}

ok('no page errors', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 200))
} finally {
  await browser.close()
}
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
