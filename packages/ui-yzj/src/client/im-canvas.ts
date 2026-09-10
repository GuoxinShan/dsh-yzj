/**
 * Ensure a non-blank host session is current while IM owns the center.
 * `conversation.view` (助手) only mounts off an active canvas — hero / blank
 * 「新会话」 leave the middle column empty after host-chrome hide (pitfall-054).
 */
import { getImSurface, subscribeImSelection } from './im-nav.ts'
import { peekImSeat } from './im-seat.ts'

/** Structural session-list face used to leave hero without homeOpen-per-click. */
export interface ImCanvasSessionsFace {
  open(id: string): void
  list: {
    getSnapshot(): {
      phase?: string
      current?: string
      ids?: readonly string[]
      byId?: Record<string, { blank?: boolean } | undefined>
    }
    subscribe(listener: () => void): () => void
  }
}

function shellMounted(): boolean {
  if (typeof document === 'undefined') return false
  return document.querySelector('[data-testid="yzj-im-shell"]') !== null
}

function pickNonBlank(sessions: ImCanvasSessionsFace): string | undefined {
  const snap = sessions.list.getSnapshot()
  if (snap.phase !== 'ready') return undefined
  const byId = snap.byId ?? {}
  const seatId = peekImSeat()?.sessionId
  if (seatId !== undefined && byId[seatId]?.blank === false) return seatId
  for (const id of snap.ids ?? []) {
    if (byId[id]?.blank === false) return id
  }
  return undefined
}

/**
 * True when IM needs a canvas focus: surface is im, shell absent, and current
 * is missing or blank.
 */
export function imCanvasNeedsFocus(sessions: ImCanvasSessionsFace): boolean {
  if (getImSurface() !== 'im') return false
  if (shellMounted()) return false
  const snap = sessions.list.getSnapshot()
  if (snap.phase !== 'ready') return false
  const current = snap.current
  if (current !== undefined && snap.byId?.[current]?.blank === false) return false
  return pickNonBlank(sessions) !== undefined
}

/**
 * Keep one non-blank session focused while surface=im so conversation.view
 * can paint. Does not create sessions (R24 / pitfall-024); no-op when the
 * list has only blank rows. Returns disposer.
 */
export function ensureImCanvas(sessions: ImCanvasSessionsFace): () => void {
  let lastOpened: string | undefined

  const tick = (): void => {
    if (!imCanvasNeedsFocus(sessions)) return
    const id = pickNonBlank(sessions)
    if (id === undefined || id === lastOpened) return
    lastOpened = id
    sessions.open(id)
  }

  const stopList = sessions.list.subscribe(tick)
  const stopSel = subscribeImSelection(tick)
  tick()
  return () => {
    stopList()
    stopSel()
  }
}
