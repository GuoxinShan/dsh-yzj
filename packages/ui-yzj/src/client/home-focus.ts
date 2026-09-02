/**
 * Client helper: focus a bound DSH session once the session list is ready
 * and contains the id (harness list snapshot contract). Subscribe + timeout
 * so a just-created home can appear after the RPC returns.
 * @module @dsh-yzj/ui-yzj/client/home-focus
 */

import { rememberImSeat } from './im-seat.ts'

/** Structural session-list face (browser `ctx.sessions`). */
export interface FocusSessionsFace {
  open(id: string): void
  list: {
    getSnapshot(): { phase?: string; byId?: Record<string, unknown> }
    subscribe(listener: () => void): () => void
  }
}

const DEFAULT_FOCUS_TIMEOUT_MS = 8_000

/**
 * Open `sessionId` when the list is ready and the row exists. No-op on
 * timeout so a missing row never throws.
 */
export function focusBoundSession(
  sessions: FocusSessionsFace,
  sessionId: string,
  timeoutMs = DEFAULT_FOCUS_TIMEOUT_MS,
): () => void {
  const tryOpen = (): boolean => {
    const snap = sessions.list.getSnapshot()
    if (snap.phase !== 'ready') return false
    if (snap.byId?.[sessionId] === undefined) return false
    sessions.open(sessionId)
    return true
  }
  if (tryOpen()) return () => {}
  let settled = false
  const unsubscribe = sessions.list.subscribe(() => {
    if (settled) return
    if (tryOpen()) {
      settled = true
      unsubscribe()
      clearTimeout(timer)
    }
  })
  const timer = setTimeout(() => {
    if (settled) return
    settled = true
    unsubscribe()
  }, timeoutMs)
  return () => {
    settled = true
    unsubscribe()
    clearTimeout(timer)
  }
}

/**
 * Fire-and-forget: RPC bind then client focus. Missing homeOpen/focus is a
 * no-op so panel IM still loads without the home slice.
 */
export function bindAndFocusGroup(
  homeOpen: ((groupId: string, title?: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>) | undefined,
  focus: ((sessionId: string) => void) | undefined,
  groupId: string,
  title?: string,
): Promise<void> {
  if (homeOpen === undefined) return Promise.resolve()
  return (title === undefined || title === '' ? homeOpen(groupId) : homeOpen(groupId, title)).then(result => {
    if (!result.ok) return
    const value = typeof result.value === 'object' && result.value !== null
      ? result.value as Record<string, unknown>
      : {}
    const sessionId = typeof value.sessionId === 'string' ? value.sessionId : ''
    if (sessionId !== '') {
      rememberImSeat({
        groupId,
        sessionId,
        ...(title === undefined || title === '' ? {} : { groupName: title }),
      })
      if (focus !== undefined) focus(sessionId)
    }
  })
}
