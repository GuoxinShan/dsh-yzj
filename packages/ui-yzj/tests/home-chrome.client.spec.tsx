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
  it('bound sessions expose 发进群 and not 丢进群', async () => {
    const { container } = mount(true)
    await act(async () => { await Promise.resolve() })
    expect(container.textContent).toContain('发进群')
    expect(container.textContent).toContain('群房间')
    expect(container.textContent).not.toContain('丢进群')
  })

  it('unbound sessions expose 丢进群 and a single-send hint', async () => {
    const { container } = mount(false)
    await act(async () => { await Promise.resolve() })
    expect(container.textContent).toContain('丢进群')
    expect(container.textContent).toContain('只给助手')
    expect(container.textContent).not.toContain('发进群')
  })

  it('intercepts native submit on a group room into homeSend', async () => {
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

  it('topic sessions show the origin card and 回群房间', async () => {
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
              binding: { dshSessionId: 'yzj-home-g-a' },
              topic: { originWho: '老黎', originText: '接口清单整理一版' },
            },
          })}
          homeSend={async () => ({ ok: true, value: {} })}
          homeDigest={async () => ({ ok: true, value: { candidates: [] } })}
          homeHandoff={async () => ({ ok: true, value: { sessionId: 'yzj-home-g-a' } })}
          fetchGroups={async () => ({ ok: true, value: { list: [] } })}
          focusBoundSession={(id) => { focused.push(id) }}
        />,
      )
    })
    await act(async () => { await Promise.resolve() })
    // The anchor card lives in the session header (session-shell); the chrome
    // exposes only the lightweight 回群房间 jump.
    expect(container.textContent).not.toContain('群消息锚点')
    expect(container.textContent).toContain('回群房间')
    expect(container.textContent).not.toContain('发进群')
    const jump = [...container.querySelectorAll('button')].find(node => node.textContent?.includes('回群房间'))
    await act(async () => { jump?.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(focused).toEqual(['yzj-home-g-a'])
  })

  it('发进群 consumes the draft via homeSend and clears it', async () => {
    const { container, sent, draftRef } = mount(true)
    await act(async () => { await Promise.resolve() })
    const button = [...container.querySelectorAll('button')].find(node => node.textContent?.includes('发进群'))
    expect(button).toBeDefined()
    await act(async () => { button?.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    await act(async () => { await Promise.resolve() })
    expect(sent).toEqual(['发进群草稿'])
    expect(draftRef()).toBe('')
  })
})
