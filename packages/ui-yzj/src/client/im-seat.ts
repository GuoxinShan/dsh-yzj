/**
 * Last group-room seat the workbench should reopen.
 * Dock 「对话」 focuses this immediately; home-open only heals a missing host.
 */

/** One IM seat: the room host plus the Yunzhijia conversation it bridges. */
export interface ImSeat {
  readonly groupId: string
  readonly sessionId: string
  readonly groupName?: string
}

let seat: ImSeat | undefined
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

/** Remember a room after open / topic bind / nav prefetch. */
export function rememberImSeat(next: ImSeat): void {
  if (next.groupId === '') return
  seat = {
    groupId: next.groupId,
    sessionId: next.sessionId,
    ...(next.groupName === undefined || next.groupName === '' ? {} : { groupName: next.groupName }),
  }
  emit()
}

/** Last remembered seat, if any. */
export function peekImSeat(): ImSeat | undefined {
  return seat
}

/** Subscribe to seat changes (composer / shell). */
export function subscribeImSeat(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Test helper: drop the seat so specs start empty. */
export function clearImSeat(): void {
  seat = undefined
}
