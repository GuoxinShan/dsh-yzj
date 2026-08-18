import { afterEach, describe, expect, it } from 'vitest'
import { bindAndFocusGroup, focusBoundSession } from '../src/client/home-focus.ts'
import { clearImSeat, peekImSeat } from '../src/client/im-seat.ts'

describe('focusBoundSession', () => {
  it('opens immediately when the list is ready and the row exists', () => {
    const opened: string[] = []
    const sessions = {
      open: (id: string) => { opened.push(id) },
      list: {
        getSnapshot: () => ({ phase: 'ready', byId: { 'yzj-home-g-a': {} } }),
        subscribe: () => () => {},
      },
    }
    focusBoundSession(sessions, 'yzj-home-g-a')
    expect(opened).toEqual(['yzj-home-g-a'])
  })

  it('waits for the list snapshot then opens', () => {
    const opened: string[] = []
    let listener: (() => void) | undefined
    let byId: Record<string, unknown> = {}
    const sessions = {
      open: (id: string) => { opened.push(id) },
      list: {
        getSnapshot: () => ({ phase: 'ready' as const, byId }),
        subscribe: (fn: () => void) => {
          listener = fn
          return () => { listener = undefined }
        },
      },
    }
    focusBoundSession(sessions, 'yzj-home-g-a')
    expect(opened).toEqual([])
    byId = { 'yzj-home-g-a': {} }
    listener?.()
    expect(opened).toEqual(['yzj-home-g-a'])
  })
})

describe('bindAndFocusGroup', () => {
  afterEach(() => { clearImSeat() })

  it('focuses the sessionId from a successful homeOpen', async () => {
    const focused: string[] = []
    await bindAndFocusGroup(
      async () => ({ ok: true, value: { sessionId: 'yzj-home-g-a', created: false } }),
      id => { focused.push(id) },
      'g-a',
    )
    expect(focused).toEqual(['yzj-home-g-a'])
    expect(peekImSeat()).toEqual({ groupId: 'g-a', sessionId: 'yzj-home-g-a' })
  })

  it('is a no-op without homeOpen', () => {
    const focused: string[] = []
    bindAndFocusGroup(undefined, id => { focused.push(id) }, 'g-a')
    expect(focused).toEqual([])
  })
})
