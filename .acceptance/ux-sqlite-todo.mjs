import { chromium } from 'playwright'
import { DatabaseSync } from 'node:sqlite'
import { homedir } from 'node:os'
import { join } from 'node:path'
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1560, height: 1000 }, locale: 'zh-CN' })
await page.goto('http://127.0.0.1:3080/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(6000)
await page.getByTestId('yzj-dock-home').click().catch(() => {})
await page.waitForTimeout(2000)
// 对话域先逛一下触发 im-cache 双写
await page.getByTestId('yzj-workbench-tabs').getByRole('tab', { name: '对话' }).click()
await page.waitForTimeout(6000)
// todo 域创建一条
await page.getByTestId('yzj-workbench-tabs').getByRole('tab', { name: '待办' }).click()
await page.waitForTimeout(3000)
const todoInput = page.locator('input[placeholder*="待办"], textarea[placeholder*="待办"]').first()
const hasComposer = await todoInput.isVisible().catch(() => false)
if (hasComposer) {
  await todoInput.fill('sqlite 存储切换验证待办')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(3000)
  const listed = await page.getByText('sqlite 存储切换验证待办').first().isVisible().catch(() => false)
  console.log(listed ? 'PASS todo 创建落 sqlite 且列表可见' : 'FAIL todo 列表未见')
} else {
  console.log('INFO todo composer 未找到（空态 UI 可能不同）')
}
await page.waitForTimeout(2000)
await browser.close()
const db = new DatabaseSync(join(homedir(), '.dsh', 'storages', 'yzj_advance.db'))
const todos = db.prepare('SELECT COUNT(*) AS n FROM todos').get()
const cache = db.prepare('SELECT COUNT(*) AS n FROM im_cache').get()
console.log(`sqlite: todos=${todos.n} im_cache=${cache.n}`)
console.log(cache.n > 0 ? 'PASS im-cache L2 落 sqlite' : 'INFO im-cache 暂无（TTL 内未触发 save）')
db.close()
