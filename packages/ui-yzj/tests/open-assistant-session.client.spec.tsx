// @vitest-environment jsdom
/**
 * 查看过程 opens the real assistant session on 会话 (no IM peek page).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { openAssistantSession } from '../src/client/open-assistant-session.ts'
import { getImSurface, resetImSelection } from '../src/client/im-nav.ts'

afterEach(() => {
  resetImSelection()
})

describe('openAssistantSession', () => {
  it('switches to 会话 and focuses the assistant sessionId', async () => {
    const focused: string[] = []
    const ok = await openAssistantSession(
      {
        assistantProjection: async () => ({
          ok: true,
          value: { assistant: { id: 'default', name: '助手', sessionId: 'yzj-assistant-default' } },
        }),
        focusBoundSession: (id) => { focused.push(id) },
      },
      'default',
    )
    expect(ok).toBe(true)
    expect(getImSurface()).toBe('session')
    expect(focused).toEqual(['yzj-assistant-default'])
  })

  it('is a no-op without sessionId', async () => {
    const focused: string[] = []
    const ok = await openAssistantSession(
      {
        assistantProjection: async () => ({
          ok: true,
          value: { assistant: { id: 'default', name: '助手' } },
        }),
        focusBoundSession: (id) => { focused.push(id) },
      },
      'default',
    )
    expect(ok).toBe(false)
    expect(focused).toEqual([])
  })
})
