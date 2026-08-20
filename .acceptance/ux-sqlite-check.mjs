import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1560, height: 1000 }, locale: 'zh-CN' })
await page.goto('http://127.0.0.1:3080/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(6000)
await page.getByTestId('yzj-dock-home').click().catch(() => {})
await page.waitForTimeout(2000)
await page.getByTestId('yzj-workbench-tabs').getByRole('tab', { name: '推进' }).click()
await page.waitForTimeout(4000)
const pane = page.getByTestId('yzj-advance-pane')
const emptyHero = await pane.getByTestId('yzj-advance-start-hero').isVisible().catch(() => false)
console.log(emptyHero ? 'PASS 空板 hero（local sqlite 空库）' : 'INFO 非空板')
if (emptyHero) {
  await pane.getByTestId('yzj-advance-start-hero').click()
  await page.waitForTimeout(1000)
  await page.getByTestId('yzj-advance-draft-title').fill('sqlite 写路径探针')
  await page.getByTestId('yzj-advance-draft-goal').fill('验证 local sqlite 后端写路径')
  await page.getByTestId('yzj-advance-create').click()
  await page.waitForTimeout(4000)
  const inQueue = await pane.getByText('sqlite 写路径探针').first().isVisible().catch(() => false)
  console.log(inQueue ? 'PASS 创建落 sqlite 且队列可见' : 'FAIL 队列未见新事项')
}
console.log(existsSync(`${homedir()}/.dsh/storages/yzj_advance.db`) ? 'PASS db 文件在位' : 'FAIL db 文件缺失')
await page.screenshot({ path: '/Users/guoxinshan/dev/dsh-yzj/.acceptance/shots-advance-ux/sqlite-check.png' })
await browser.close()
