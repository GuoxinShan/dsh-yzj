// @vitest-environment jsdom
/**
 * Topic jump left the header: session-shell only syncs the tab ring.
 */
import { act } from 'react-dom/test-utils'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { YzjSessionShell } from '../src/client/session-shell.tsx'

describe('YzjSessionShell', () => {
  it('does not paint 回群聊 in the session header', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    act(() => {
      root.render((
        <YzjSessionShell
          sessionId="yzj-topic-g-a-root"
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
              topic: { title: '排期', originText: '接口清单整理一版' },
            },
          })}
        />
      ) as never)
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(container.querySelector('[data-testid="yzj-topic-anchor"]')).toBeNull()
    expect(container.textContent).not.toContain('回群聊')
    expect(container.textContent).not.toContain('群消息锚点')
    act(() => { root.unmount() })
  })
})
