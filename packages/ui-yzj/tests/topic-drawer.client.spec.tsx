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
          groupName="测试群"
          topics={[{
            dshSessionId: 'yzj-topic-g-a-m1',
            title: '测试群 · 整理接口',
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

  it('renders lens bubbles and asks without focusing native chat', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const native: string[] = []
    const asked: string[] = []
    await act(async () => {
      root.render(
        <YzjTopicDrawer
          groupName="群"
          topics={[{
            dshSessionId: 'yzj-topic-1',
            title: '排期',
            source: 'dsh',
          }]}
          lensSessionId="yzj-topic-1"
          onClose={() => undefined}
          onBack={() => undefined}
          onOpenLens={() => undefined}
          onNative={id => { native.push(id) }}
          onJumpOrigin={() => undefined}
          homeTopicLens={async () => ({
            ok: true,
            value: {
              bubbles: [
                { id: 'h0', role: 'user', text: '旧问题', time: 1 },
                {
                  id: 't0', role: 'assistant', text: '旧回答', time: 2,
                  artifacts: [{ type: 'DOC', name: '纪要.md' }],
                },
              ],
            },
          })}
          homeTopicAsk={async (_id, text) => {
            asked.push(text)
            return { ok: true, value: { ok: true } }
          }}
        />,
      )
    })
    await act(async () => { await Promise.resolve() })
    expect(container.textContent).toContain('旧问题')
    expect(container.textContent).toContain('旧回答')
    expect(container.textContent).toContain('纪要.md')
    expect(container.querySelector('[data-testid="yzj-lens-artifact-纪要.md"]')).not.toBeNull()
    expect(container.textContent).not.toContain('透镜只作对照')
    const input = container.querySelector('[aria-label="问助手"]') as HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    await act(async () => {
      setter?.call(input, '继续')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => {
      container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    expect(asked).toEqual(['继续'])
    expect(native).toEqual([])
  })

  it('hides the group-origin jump on the 历史对话 topic', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    act(() => {
      root.render(
        <YzjTopicDrawer
          groupName="群"
          topics={[{
            dshSessionId: 'yzj-topic-legacy',
            title: '历史对话',
            source: 'handoff',
            rootMsgId: 'legacy-host',
            originText: '不该跳群消息',
          }]}
          lensSessionId="yzj-topic-legacy"
          onClose={() => undefined}
          onBack={() => undefined}
          onOpenLens={() => undefined}
          onNative={() => undefined}
          onJumpOrigin={() => undefined}
        />,
      )
    })
    expect(container.querySelector('[data-testid="yzj-drawer-anchor"]')).toBeNull()
    expect(container.textContent).toContain('还没有助手回合')
  })
})
