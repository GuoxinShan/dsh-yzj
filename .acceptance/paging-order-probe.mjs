/** Verify: after 加载更早消息 paging, the merged list stays chronological. */
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find(path => existsSync(path))

const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.log(`[pageerror] ${String(e).slice(0, 250)}`))

await page.goto('http://127.0.0.1:3090/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(6000)
await page.getByLabel('云之家悬浮窗').click()
const dialog = page.getByRole('dialog', { name: '云之家' })
await dialog.waitFor({ state: 'visible', timeout: 15000 })
await dialog.locator('nav button').filter({ hasText: '会话' }).first().click()
await page.waitForTimeout(3000)
// 灵基Chat has >20 messages (multi-day), so paging is possible
await dialog.locator('[class*="paneLeft"] button[class*="item"]').filter({ hasText: '灵基Chat' }).first().click()
await page.waitForTimeout(3500)

const readTimes = async () => {
  return dialog.locator('[class*="msgTime"]').allInnerTexts().catch(() => [])
}

const toNum = (t) => {
  const m = t.trim().match(/^(?:(\d{2})-(\d{2}) )?(\d{2}):(\d{2})$/)
  if (m) {
    const day = m[1] !== undefined ? Number(m[1]) * 100 + Number(m[2]) : 999
    return day * 10000 + Number(m[3]) * 100 + Number(m[4])
  }
  if (t.trim().startsWith('昨天')) {
    const hm = t.trim().match(/(\d{2}):(\d{2})$/)
    return hm ? 998 * 10000 + Number(hm[1]) * 100 + Number(hm[2]) : 9980000
  }
  return 0
}
const isAsc = (times) => times.every((t, i) => i === 0 || toNum(times[i - 1]) <= toNum(t))

const before = await readTimes()
console.log('window 1 rows:', before.length, '| ascending:', isAsc(before))

const moreBtn = dialog.locator('button[class*="more"]').filter({ hasText: '加载更早消息' })
if (await moreBtn.count().catch(() => 0) > 0) {
  await moreBtn.click()
  await page.waitForTimeout(3500)
  const after = await readTimes()
  console.log('after paging rows:', after.length, '| ascending:', isAsc(after))
  console.log('first 3:', after.slice(0, 3).join(' | '), '… last 3:', after.slice(-3).join(' | '))
} else {
  console.log('no 加载更早 button (window fully loaded)')
}
await browser.close()
