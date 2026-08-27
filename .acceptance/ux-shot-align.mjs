/**
 * Visual-pass shot for the advance timeline alignment fix (2026-08-21):
 * --dsh-* var typos nulled refEvent chrome, bare sourceType orphan labels,
 * no timeline rail. Asserts the new markers + computed styles, then shots.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots-advance-ux')
mkdirSync(OUT, { recursive: true })

let failures = 0
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`)
  if (!cond) failures += 1
}

const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1560, height: 1000 }, locale: 'zh-CN' })
const pageErrors = []
page.on('pageerror', (error) => { pageErrors.push(String(error).slice(0, 200)) })

await page.goto('http://127.0.0.1:3080/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(6000)
await page.getByTestId('yzj-dock-home').click().catch(() => {})
await page.waitForTimeout(2000)
await page.getByTestId('yzj-workbench-tabs').getByRole('tab', { name: '推进' }).click()
await page.waitForTimeout(4500)
await page.getByTestId('yzj-advance-pane').getByText(/测试事项/).first().click()
await page.waitForTimeout(4000)

const pane = page.getByTestId('yzj-advance-pane')
const text = await pane.innerText()
ok('dev-speak small gone (三层结构)', !text.includes('三层结构'))
ok('user-facing small present', text.includes('每条事元可溯源到原始信息'))
ok('no repeated 提炼为同一条事元 noise per entry', !text.includes('提炼为同一条事元'))
ok('source caption reads 记录自/你的判断', text.includes('记录自') || text.includes('你的判断'))
ok('no dp-* pool ids leaked into the timeline', !text.includes('dp-'))
ok('no bare hex msgId chips (聊 <hex>)', !/聊 [0-9a-f]{6,}/.test(text))

// refEvent cards must have a real border + background (the --dsh-* typo nulled them)
const cardStyle = await page.locator('[data-testid^="yzj-advance-ref-"]').first().evaluate((el) => {
  const cs = getComputedStyle(el)
  return { border: cs.borderTopWidth, bg: cs.backgroundColor, deco: cs.textDecorationLine }
}).catch(() => null)
ok('ref card has visible border', cardStyle !== null && cardStyle.border === '1px', JSON.stringify(cardStyle))

// timeline rail: a non-last entry's mark grows an ::after connector
const rail = await page.locator('[data-testid="yzj-advance-timeline"] [class*="timeItem"]').first().evaluate((el) => {
  const mark = el.querySelector('i[class*="mark"]')
  if (mark === null) return ''
  return getComputedStyle(mark, '::after').height
}).catch(() => '')
ok('timeline rail connector painted', rail !== '' && rail !== 'auto' && parseFloat(rail) > 10, rail)

ok('zero page errors', pageErrors.length === 0, pageErrors.join(' | '))

await page.screenshot({ path: join(OUT, 'ux-align-fix-full.png'), fullPage: false })
const timeline = page.getByTestId('yzj-advance-timeline')
await timeline.screenshot({ path: join(OUT, 'ux-align-fix-timeline.png') }).catch(() => {})

await browser.close()
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
