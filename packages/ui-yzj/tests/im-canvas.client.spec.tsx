// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { ensureImCanvas, imCanvasNeedsFocus } from '../src/client/im-canvas.ts'
import { resetImSelection, setImSurface } from '../src/client/im-nav.ts'
import { clearImSeat, rememberImSeat } from '../src/client/im-seat.ts'

afterEach(() => {
  resetImSelection()
  clearImSeat()
  document.body.replaceChildren()
  document.documentElement.removeAttribute('data-dsh-yzj-im')
})

function sessionsStub(opts: {
  phase?: string
  current?: string
  ids?: string[]
  byId?: Record<string, { blank?: boolean }>
  onOpen?: (id: string) => void
}) {
  let listener: (() => void) | undefined
  return {
    open: (id: string) => { opts.onOpen?.(id) },
    list: {
      getSnapshot: () => ({
        phase: opts.phase ?? 'ready',
        current: opts.current,
        ids: opts.ids ?? Object.keys(opts.byId ?? {}),
        byId: opts.byId ?? {},
      }),
      subscribe: (fn: () => void) => {
        listener = fn
        return () => { listener = undefined }
      },
      notify: () => { listener?.() },
    },
  }
}

describe('imCanvasNeedsFocus', () => {
  it('is false on 会话 surface', () => {
    setImSurface('session')
    const sessions = sessionsStub({
      byId: { s1: { blank: false } },
      ids: ['s1'],
    })
    expect(imCanvasNeedsFocus(sessions)).toBe(false)
  })

  it('is false when shell is already mounted', () => {
    setImSurface('im')
    const shell = document.createElement('div')
    shell.setAttribute('data-testid', 'yzj-im-shell')
    document.body.append(shell)
    const sessions = sessionsStub({
      byId: { s1: { blank: false } },
      ids: ['s1'],
    })
    expect(imCanvasNeedsFocus(sessions)).toBe(false)
  })

  it('is true when IM + hero with a non-blank row available', () => {
    setImSurface('im')
    const sessions = sessionsStub({
      current: undefined,
      byId: { s1: { blank: false }, s0: { blank: true } },
      ids: ['s0', 's1'],
    })
    expect(imCanvasNeedsFocus(sessions)).toBe(true)
  })

  it('is false when current is already non-blank', () => {
    setImSurface('im')
    const sessions = sessionsStub({
      current: 's1',
      byId: { s1: { blank: false } },
      ids: ['s1'],
    })
    expect(imCanvasNeedsFocus(sessions)).toBe(false)
  })
})

describe('ensureImCanvas', () => {
  it('opens the first non-blank session on IM hero', () => {
    setImSurface('im')
    const opened: string[] = []
    const sessions = sessionsStub({
      current: 'blank',
      byId: { blank: { blank: true }, real: { blank: false } },
      ids: ['blank', 'real'],
      onOpen: id => { opened.push(id) },
    })
    const stop = ensureImCanvas(sessions)
    expect(opened).toEqual(['real'])
    stop()
  })

  it('prefers the remembered IM seat when non-blank', () => {
    setImSurface('im')
    rememberImSeat({ groupId: 'g', sessionId: 'seat' })
    const opened: string[] = []
    const sessions = sessionsStub({
      byId: { other: { blank: false }, seat: { blank: false } },
      ids: ['other', 'seat'],
      onOpen: id => { opened.push(id) },
    })
    const stop = ensureImCanvas(sessions)
    expect(opened).toEqual(['seat'])
    stop()
  })

  it('does not open on 会话 surface', () => {
    setImSurface('session')
    const opened: string[] = []
    const sessions = sessionsStub({
      byId: { s1: { blank: false } },
      ids: ['s1'],
      onOpen: id => { opened.push(id) },
    })
    const stop = ensureImCanvas(sessions)
    expect(opened).toEqual([])
    stop()
  })
})
