// @vitest-environment jsdom
/**
 * Composer chrome: leftover topic 回群聊; D8 丢进群 retired (决策 55).
 */
import { act } from 'react-dom/test-utils'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { YzjHomeChrome } from '../src/client/home-chrome.tsx'
import { isWorkbenchOpen, resetWorkbenchOverlay } from '../src/client/workbench-overlay.ts'

function mount(bound: boolean) {
  const sent: string[] = []
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  let draft = '发进群草稿'
  act(() => {
    root.render(
      <YzjHomeChrome
        sessionId={bound ? 'yzj-home-g-a' : 'private-1'}
        readDraft={() => draft}
        clearDraft={() => { draft = '' }}
        homeBinding={async () => ({ ok: true, value: { bound, kind: bound ? 'room' : 'unbound' } })}
        homeSend={async (_id, content) => {
          sent.push(content)
          return { ok: true, value: { localId: 'local-1' } }
        }}
      />,
    )
  })
  return { container, sent, draftRef: () => draft }
}

describe('YzjHomeChrome', () => {
  it('bound group rooms hide dock 发进群 (R2 retired)', async () => {
    const { container } = mount(true)
    await act(async () => { await Promise.resolve() })
    expect(container.textContent).not.toContain('发进群')
    expect(container.textContent).not.toContain('丢进群')
    expect(container.querySelector('[data-testid="yzj-home-chrome"]')).toBeNull()
  })

  it('unbound sessions paint no 丢进群 chrome (决策 55)', async () => {
    const { container } = mount(false)
    await act(async () => { await Promise.resolve() })
    expect(container.textContent).not.toContain('丢进群')
    expect(container.textContent).not.toContain('发进群')
    expect(container.querySelector('[data-testid="yzj-home-chrome"]')).toBeNull()
  })

  it('native submit on a group room still routes into homeSend', async () => {
    const sent: string[] = []
    const actions = { submit: () => { sent.push('native') } }
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    let draft = '拦截草稿'
    act(() => {
      root.render(
        <YzjHomeChrome
          sessionId="yzj-home-g-a"
          readDraft={() => draft}
          clearDraft={() => { draft = '' }}
          homeBinding={async () => ({ ok: true, value: { bound: true, kind: 'room' } })}
          homeSend={async (_id, content) => {
            sent.push(content)
            return { ok: true, value: { localId: 'local-1' } }
          }}
          inputActions={actions}
        />,
      )
    })
    await act(async () => { await Promise.resolve() })
    await act(async () => { actions.submit() })
    await act(async () => { await Promise.resolve() })
    expect(sent).toEqual(['拦截草稿'])
    expect(draft).toBe('')
  })

  it('topic sessions sit 回群聊 on the official composer dock', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const focused: string[] = []
    act(() => {
      root.render(
        <YzjHomeChrome
          sessionId="yzj-topic-g-a-root"
          readDraft={() => ''}
          clearDraft={() => {}}
          homeBinding={async () => ({
            ok: true,
            value: {
              bound: true,
              kind: 'topic',
              binding: {
                dshSessionId: 'yzj-home-g-a',
                yzjConversationId: 'g-a',
                yzjKind: 'group',
              },
              topic: { originWho: '老黎', originText: '接口清单整理一版' },
            },
          })}
          homeSend={async () => ({ ok: true, value: {} })}
          homeOpen={async () => ({ ok: true, value: { sessionId: 'yzj-home-g-a' } })}
          focusBoundSession={(id) => { focused.push(id) }}
        />,
      )
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    const chip = container.querySelector('[data-testid="yzj-topic-anchor"]')
    expect(container.querySelector('[data-testid="yzj-home-chrome"]')).not.toBeNull()
    expect(chip?.textContent).toContain('回群聊')
    expect(chip?.textContent).toContain('接口清单整理一版')
    expect(container.textContent).not.toContain('群消息锚点')
    expect(container.textContent).not.toContain('点这里回群聊')
    expect(container.textContent).not.toContain('问助手')
    expect(container.textContent).not.toContain('发进群')
    expect(container.textContent).not.toContain('丢进群')
    act(() => { (chip as HTMLButtonElement).click() })
    await act(async () => { await Promise.resolve() })
    expect(focused).toEqual([])
    expect(isWorkbenchOpen()).toBe(true)
    resetWorkbenchOverlay()
    act(() => { root.unmount() })
  })
})
