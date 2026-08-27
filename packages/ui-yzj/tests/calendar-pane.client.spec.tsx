// @vitest-environment jsdom
/**
 * Calendar pane: Lingee-shaped 日 / 周 / 月 / 年 switch.
 */
import { act } from 'react-dom/test-utils'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { CalendarPane } from '../src/client/calendar-pane.tsx'

const start = Date.parse('2026-08-19T10:00:00')
const event = { id: 'e1', title: '测试日程', startDate: start, endDate: start + 3_600_000, personName: '同事乙' }

describe('CalendarPane', () => {
  it('defaults to week view and can switch month / year / day', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const jumped: string[] = []
    act(() => {
      root.render(
        <CalendarPane
          year={2026}
          month={8}
          day="2026-08-19"
          events={[event]}
          eventId=""
          eventDetail={null}
          onNavigate={(year, month, day) => { jumped.push(`${year}-${month}-${day}`) }}
          onSelectEvent={() => {}}
        />,
      )
    })
    expect(container.querySelector('[data-testid="yzj-calendar-pane"]')).not.toBeNull()
    expect(container.textContent).toContain('周')
    expect(container.textContent).toContain('测试日程')
    const tabs = [...container.querySelectorAll('[role="tab"]')]
    expect(tabs.map(tab => tab.textContent)).toEqual(['日', '周', '月', '年'])
    act(() => { (tabs[2] as HTMLButtonElement).click() })
    expect(container.textContent).toContain('测试日程')
    act(() => { (tabs[3] as HTMLButtonElement).click() })
    expect(container.textContent).toContain('8月')
    act(() => { (tabs[0] as HTMLButtonElement).click() })
    const today = [...container.querySelectorAll('button')].find(button => button.textContent === '今天')
    act(() => { today?.click() })
    expect(jumped.some(item => item.includes('2026-8-'))).toBe(true)
    act(() => { root.unmount() })
    container.remove()
  })
})
