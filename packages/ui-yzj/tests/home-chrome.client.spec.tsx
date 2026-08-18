// @vitest-environment jsdom
/**
 * Composer chrome: bound 发进群 vs unbound 丢进群; 发进群 does not look like a user-turn.
 */
import { act } from 'react-dom/test-utils'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { YzjHomeChrome } from '../src/client/home-chrome.tsx'

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
        homeDigest={async () => ({ ok: true, value: { candidates: [] } })}
        homeHandoff={async () => ({ ok: true, value: { sessionId: 'yzj-home-g-b' } })}
        fetchGroups={async () => ({ ok: true, value: { list: [{ groupId: 'g-b', groupName: '目标群' }] } })}
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

  it('unbound sessions expose 丢进群 without a send-semantics lecture', async () => {
    const { container } = mount(false)
    await act(async () => { await Promise.resolve() })
    expect(container.textContent).toContain('丢进群')
    expect(container.textContent).not.toContain('只给助手')
    expect(container.textContent).not.toContain('发进群')
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
          homeDigest={async () => ({ ok: true, value: { candidates: [] } })}
          homeHandoff={async () => ({ ok: true, value: { sessionId: 'yzj-home-g-b' } })}
          fetchGroups={async () => ({ ok: true, value: { list: [] } })}
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
          homeDigest={async () => ({ ok: true, value: { candidates: [] } })}
          homeHandoff={async () => ({ ok: true, value: { sessionId: 'yzj-home-g-a' } })}
          homeOpen={async () => ({ ok: true, value: { sessionId: 'yzj-home-g-a' } })}
          fetchGroups={async () => ({ ok: true, value: { list: [] } })}
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
    act(() => { (chip as HTMLButtonElement).click() })
    await act(async () => { await Promise.resolve() })
    expect(focused).toEqual(['yzj-home-g-a'])
    act(() => { root.unmount() })
  })
})
