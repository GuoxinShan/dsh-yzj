// @vitest-environment jsdom
/**
 * Topic drawer: list ⇄ lens, native jump, origin locates the timeline.
 */
import { act } from 'react-dom/test-utils'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { YzjTopicDrawer } from '../src/client/topic-drawer.tsx'

describe('YzjTopicDrawer', () => {
  it('lists topics and opens a lens without focusing native chat', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const native: string[] = []
    const lens: string[] = []
    act(() => {
      root.render(
        <YzjTopicDrawer
          groupName="金蝶最小DSH交流群"
          topics={[{
            dshSessionId: 'yzj-topic-g-a-m1',
            title: '金蝶最小DSH交流群 · 整理接口',
            source: 'dsh',
            lastActivity: 2,
            rootMsgId: 'm1',
            originWho: '同事',
            originText: '帮我整理',
          }]}
          onClose={() => undefined}
          onBack={() => undefined}
          onOpenLens={id => { lens.push(id) }}
          onNative={id => { native.push(id) }}
          onJumpOrigin={() => undefined}
        />,
      )
    })
    expect(container.textContent).toContain('话题 1')
    expect(container.textContent).toContain('整理接口')
    const card = container.querySelector('[data-testid="yzj-topic-card-yzj-topic-g-a-m1"]') as HTMLButtonElement
    act(() => { card.click() })
    expect(lens).toEqual(['yzj-topic-g-a-m1'])
    expect(native).toEqual([])
  })

  it('lens origin jumps the timeline; 原生会话 is the only native focus', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const native: string[] = []
    const jumps: string[] = []
    act(() => {
      root.render(
        <YzjTopicDrawer
          groupName="群"
          topics={[{
            dshSessionId: 'yzj-topic-1',
            title: '排期',
            source: 'yzj',
            rootMsgId: 'm-root',
            originText: '原话',
            originWho: '张三',
          }]}
          lensSessionId="yzj-topic-1"
          onClose={() => undefined}
          onBack={() => undefined}
          onOpenLens={() => undefined}
          onNative={id => { native.push(id) }}
          onJumpOrigin={id => { jumps.push(id) }}
        />,
      )
    })
    expect(container.textContent).toContain('排期')
    expect(container.textContent).toContain('原生会话')
    expect(container.textContent).toContain('原话')
    act(() => { (container.querySelector('[data-testid="yzj-drawer-anchor"]') as HTMLButtonElement).click() })
    expect(jumps).toEqual(['m-root'])
    const nativeBtn = [...container.querySelectorAll('button')].find(btn => btn.textContent?.includes('原生会话'))
    act(() => { nativeBtn?.click() })
    expect(native).toEqual(['yzj-topic-1'])
  })
})
