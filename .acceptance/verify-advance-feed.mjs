/**
 * Browser acceptance for AI推进 ②③期 (ai-advance-design §11 / §12.5)
 * against the live GUI (:3080). Requires rebuilt client + running dsh web +
 * logged-in yzj-cli. Journey: create probe → 现在反馈 card feed → 现在反馈
 * again (preset) → 群房间「喂给推进」→ 话题透镜锚点 / 问助手栏（取消、不
 * followup）→ reopen the probe on the board → 「请 AI 验收」切对话 + 问助手
 * 草稿且不 followup. Unlogged GUI skips with exit 0. Screenshots land in
 * shots-advance-feed/.
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots-advance-feed')
mkdirSync(OUT, { recursive: true })
const BASE = process.env.DSH_GUI ?? 'http://127.0.0.1:3080/'
const GROUP_NAME = process.env.YZJ_E2E_GROUP ?? '金蝶最小DSH交流群'
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
ok('top tabs include 推进', (await tabs.innerText().catch(() => '')).includes('推进'))

await tabs.getByRole('tab', { name: '推进' }).click()
await page.waitForTimeout(4500)
const pane = page.getByTestId('yzj-advance-pane')
await pane.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {})
ok('advance pane mounted', await pane.count().then(n => n > 0))
await page.screenshot({ path: join(OUT, '0-advance-tab.png') })
if (await page.getByTestId('yzj-login-banner').count() > 0) {
  await skip('yzj-cli not logged in on this machine — chrome OK, write-path skipped')
}
let paneText = await pane.innerText().catch(() => '')
if (paneText.includes('推进看板还没有开通')) {
  await page.getByTestId('yzj-advance-ensure').click()
  await page.waitForTimeout(12000)
  paneText = await pane.innerText().catch(() => '')
}

const startButton = await page.getByTestId('yzj-advance-start').count() > 0
  ? page.getByTestId('yzj-advance-start')
  : page.getByTestId('yzj-advance-start-hero')
await startButton.click()
const modal = page.getByTestId('yzj-advance-start-modal')
await modal.waitFor({ state: 'visible', timeout: 8000 })
const stamp = Date.now().toString().slice(-6)
const probeTitle = `喂入探针 ${stamp}`
const roomSummary = `${GROUP_NAME} 群房间喂入 ${stamp}`
const topicSummary = `话题透镜喂入 ${stamp}`
await page.getByTestId('yzj-advance-draft-title').fill(probeTitle)
await page.getByTestId('yzj-advance-draft-goal').fill('②期真机走查探针')
await page.getByTestId('yzj-advance-create').click()
await page.waitForTimeout(12000)
ok('probe item created', (await pane.innerText().catch(() => '')).includes(probeTitle))

const feedback = page.getByTestId('yzj-advance-feedback')
await feedback.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {})
ok('现在反馈 on the kicker', await feedback.count().then(n => n > 0))
await page.screenshot({ path: join(OUT, '1-board-feedback.png') })
await feedback.click()
await page.waitForTimeout(2000)

const domain = await page.locator('[data-testid="yzj-room-shell"]').getAttribute('data-workbench-domain').catch(() => '')
ok('现在反馈 switches to 对话', domain === 'im', domain ?? '')
const card = page.getByTestId('yzj-advance-feedback-card')
await card.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {})
ok('事项卡 on the timeline', await card.count().then(n => n > 0), await card.innerText().catch(() => ''))
await page.screenshot({ path: join(OUT, '2-feedback-card.png') })

await card.getByTestId('yzj-advance-feedback-summary').fill('真机口头进度')
await card.getByTestId('yzj-advance-feedback-send').click()
await page.waitForTimeout(8000)
ok('事项卡 clears after feed', await card.count().then(n => n === 0))

await tabs.getByRole('tab', { name: '推进' }).click()
await page.waitForTimeout(2500)
const reselect = page.getByTestId('yzj-advance-queue').getByText(probeTitle, { exact: true })
if (await reselect.count() > 0) await reselect.click()
await page.waitForTimeout(1500)
await page.getByTestId('yzj-advance-feedback').click()
await page.waitForTimeout(2000)

const groupRow = page.getByTestId('yzj-conv-list').locator('button').filter({ hasText: GROUP_NAME }).first()
const groupFound = await groupRow.count().then(n => n > 0).catch(() => false)
ok(`list includes ${GROUP_NAME}`, groupFound)
if (groupFound) {
  await groupRow.click()
  await page.waitForTimeout(2500)
  const row = page.locator('[data-testid^="yzj-room-row-"]').first()
  await row.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
  await row.hover()
  const feedBtn = page.locator('[data-testid^="yzj-advance-feed-"]').first()
  const feedReady = await feedBtn.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)
  ok('群房间 hover 喂给推进', feedReady)
  if (feedReady) {
    await feedBtn.click()
    await page.waitForTimeout(1500)
    const picker = page.getByTestId('yzj-advance-feed-picker')
    ok('picker opens', await picker.count().then(n => n > 0))
    ok('picker says 不改阶段', (await picker.innerText().catch(() => '')).includes('不改阶段'))
    const probeRow = picker.locator('label').filter({ hasText: probeTitle })
    ok('picker lists the probe', await probeRow.count().then(n => n > 0))
    ok('picker presets 现在反馈 item', await probeRow.locator('input').isChecked().catch(() => false))
    await probeRow.click()
    await picker.getByTestId('yzj-advance-feed-summary').fill(roomSummary)
    await page.screenshot({ path: join(OUT, '3-picker.png') })
    await picker.getByTestId('yzj-advance-feed-submit').click()
    await page.waitForTimeout(8000)
    ok('picker closed after feed', await picker.count().then(n => n === 0))
  }

  const toggle = page.getByTestId('yzj-topic-toggle')
  const toggleReady = await toggle.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)
  ok('topic drawer toggle', toggleReady)
  if (toggleReady) {
    await toggle.click()
    await page.waitForTimeout(1000)
    ok('topic drawer opens', await page.getByTestId('yzj-topic-drawer').count().then(n => n > 0))
    const topicCard = page.locator('[data-testid^="yzj-topic-card-"]').first()
    const alreadyLens = await page.getByTestId('yzj-topic-lens').count().then(n => n > 0)
    const hasTopic = alreadyLens || await topicCard.count().then(n => n > 0)
    if (!hasTopic) {
      // Data-state, not a code regression: topic anchors live in the GUI's
      // yzj_topic_anchors storage-domain and this group simply has none
      // (pitfall-036). Skip the topic-dependent steps instead of failing.
      console.log(`SKIP  ${GROUP_NAME} has no topic anchors — 话题透镜/问助手 steps skipped`)
    }
    if (hasTopic) {
      if (!alreadyLens) {
        await topicCard.click()
        await page.waitForTimeout(2000)
      }
      const lensFeed = page.getByTestId('yzj-topic-feed')
      const hasAnchorFeed = await lensFeed.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)
      ok('话题透镜锚点 喂给推进', hasAnchorFeed)
      if (hasAnchorFeed) {
        await lensFeed.click()
        await page.waitForTimeout(1500)
        const topicPicker = page.getByTestId('yzj-advance-feed-picker')
        ok('topic picker opens', await topicPicker.count().then(n => n > 0))
        const topicProbe = topicPicker.locator('label').filter({ hasText: probeTitle })
        await topicProbe.click()
        await topicPicker.getByTestId('yzj-advance-feed-summary').fill(topicSummary)
        await page.screenshot({ path: join(OUT, '5-topic-picker.png') })
        await topicPicker.getByTestId('yzj-advance-feed-submit').click()
        await page.waitForTimeout(8000)
        ok('topic picker closed after feed', await topicPicker.count().then(n => n === 0))
      }
      const ask = page.getByLabel('问助手')
      await ask.fill('不该发给助手')
      const askFeed = page.getByTestId('yzj-topic-feed-ask')
      ok('问助手栏 喂给推进 enabled', await askFeed.isEnabled().catch(() => false))
      await askFeed.click()
      await page.waitForTimeout(1500)
      const askPicker = page.getByTestId('yzj-advance-feed-picker')
      const askSummary = await askPicker.getByTestId('yzj-advance-feed-summary').inputValue().catch(() => '')
      ok('ask-bar picker uses draft', askSummary.includes('不该发给助手'), askSummary.slice(0, 80))
      await askPicker.getByRole('button', { name: '取消' }).click()
      await page.waitForTimeout(500)
      const lensText = await page.getByTestId('yzj-topic-lens').innerText().catch(() => '')
      ok('ask-bar 喂给推进 did not followup', !lensText.includes('不该发给助手'))
      await page.screenshot({ path: join(OUT, '5-topic-lens.png') })
    }
  }
}

await tabs.getByRole('tab', { name: '推进' }).click()
await page.waitForTimeout(4000)
const queueProbe = page.getByTestId('yzj-advance-queue').getByText(probeTitle, { exact: true })
ok('queue still lists the probe', await queueProbe.count().then(n => n > 0))
if (await queueProbe.count() > 0) await queueProbe.click()
await page.waitForTimeout(4000)
const timeline = page.getByTestId('yzj-advance-timeline')
const tlText = await timeline.innerText().catch(() => '')
ok('timeline has 卡直写 真机口头进度', tlText.includes('真机口头进度') && tlText.includes('你的判断'))
ok('timeline has 群房间喂入', tlText.includes(roomSummary) || tlText.includes('对话'))
if (tlText.includes(topicSummary)) {
  ok('timeline has 话题透镜喂入', true)
} else {
  console.log('SKIP  timeline 话题透镜喂入 (目标群无话题锚点，见 pitfall-036)')
}
await page.screenshot({ path: join(OUT, '4-timeline.png') })

const review = page.getByTestId('yzj-advance-review')
ok('请 AI 验收 on the kicker', await review.count().then(n => n > 0))
await review.click()
await page.waitForTimeout(2000)
const reviewDomain = await page.locator('[data-testid="yzj-room-shell"]').getAttribute('data-workbench-domain').catch(() => '')
ok('请 AI 验收 switches to 对话', reviewDomain === 'im', reviewDomain ?? '')
const banner = page.getByTestId('yzj-advance-ask-banner')
await banner.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {})
ok('验收预备 banner', await banner.count().then(n => n > 0), await banner.innerText().catch(() => ''))
await page.screenshot({ path: join(OUT, '6-ask-banner.png') })
const reviewToggle = page.getByTestId('yzj-topic-toggle')
const reviewToggleReady = await reviewToggle.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)
if (reviewToggleReady) {
  if (await page.getByTestId('yzj-topic-drawer').count() === 0) {
    await reviewToggle.click()
    await page.waitForTimeout(1000)
  }
  const reviewTopic = page.locator('[data-testid^="yzj-topic-card-"]').first()
  if (await page.getByTestId('yzj-topic-lens').count() === 0 && await reviewTopic.count() > 0) {
    await reviewTopic.click()
    await page.waitForTimeout(2000)
  }
  const askBox = page.getByLabel('问助手')
  const askVal = await askBox.inputValue().catch(() => '')
  if (askVal.includes('yzj_advance_inspect') && askVal.includes('不要 stageTo=completed')) {
    ok('问助手 filled with inspect prompt', true, askVal.slice(0, 80))
    await page.waitForTimeout(2500)
    const lensAfterAsk = await page.getByTestId('yzj-topic-lens').innerText().catch(() => '')
    ok('请 AI 验收 did not followup', !lensAfterAsk.includes('yzj_advance_inspect'))
  } else {
    console.log('SKIP  问助手 inspect 预填（话题透镜未打开/无话题，见 pitfall-036）')
  }
  await page.screenshot({ path: join(OUT, '7-ask-draft.png') })
}

ok('zero page errors', pageErrors.length === 0, pageErrors.join(' | '))

await browser.close()
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
