// @vitest-environment jsdom
/**
 * Room composer portals onto the live timeline host across remounts.
 */
import { act } from 'react-dom/test-utils'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { registerRoomComposerHost } from '../src/client/composer-host.ts'
import { YzjRoomComposer } from '../src/client/room-composer.tsx'
import { setWorkbenchDomain } from '../src/client/workbench-domain.ts'

function mountComposer(): HTMLDivElement {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  let draft = ''
  act(() => {
    root.render(
      <YzjRoomComposer
        {...{
          sessionId: 'yzj-home-g-a',
          matched: { room: true as const },
          useInput: (sel: (s: { draft: string }) => string) => sel({ draft }),
          useSessions: (sel: (s: { byId: Record<string, { displayTitle: string }> }) => string) =>
            sel({ byId: { 'yzj-home-g-a': { displayTitle: '测试群' } } }),
          inputActions: { setDraft: (value: string) => { draft = value } },
          homeSend: async () => ({ ok: true as const, value: {} }),
        } as never}
      />,
    )
  })
  return container
}

describe('YzjRoomComposer host portal', () => {
  afterEach(() => {
    registerRoomComposerHost(null)
    setWorkbenchDomain('im')
  })

  it('moves 发进群 onto a new host after the previous node unmounts', () => {
    const seat = mountComposer()
    expect(seat.querySelector('[data-testid="yzj-room-composer"]')).not.toBeNull()

    const first = document.createElement('div')
    document.body.append(first)
    act(() => { registerRoomComposerHost(first) })
    expect(first.querySelector('[data-testid="yzj-room-composer"]')).not.toBeNull()
    expect(seat.querySelector('[data-testid="yzj-room-composer"]')).toBeNull()

    act(() => { registerRoomComposerHost(null) })
    first.remove()
    expect(seat.querySelector('[data-testid="yzj-room-composer"]')).not.toBeNull()

    const second = document.createElement('div')
    document.body.append(second)
    act(() => { registerRoomComposerHost(second) })
    expect(second.querySelector('[data-testid="yzj-room-composer"]')).not.toBeNull()
    expect(first.querySelector('[data-testid="yzj-room-composer"]')).toBeNull()
    expect(seat.querySelector('[data-testid="yzj-room-composer"]')).toBeNull()
  })

  it('does not paint 发进群 when the workbench is not 对话', () => {
    setWorkbenchDomain('todo')
    const seat = mountComposer()
    expect(seat.querySelector('[data-testid="yzj-room-composer"]')).toBeNull()
    const host = document.createElement('div')
    document.body.append(host)
    act(() => { registerRoomComposerHost(host) })
    expect(host.querySelector('[data-testid="yzj-room-composer"]')).toBeNull()
    host.remove()
  })
})
