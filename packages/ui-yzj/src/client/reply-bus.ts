/**
 * One-slot bus from the group-room timeline to the room composer:
 * 「回复」on a row arms the composer reply bar. Exactly one composer
 * listens per session view (same shape as drop-bus).
 */

/** Target of a group-room reply gesture. */
export interface RoomReplyTarget {
  readonly msgId: string
  readonly summary: string
}

type Listener = (target: RoomReplyTarget) => void

let listener: Listener | null = null

/** Subscribe the active room composer; returns the disposer. */
export function onRoomReplyRequest(callback: Listener): () => void {
  listener = callback
  return () => {
    if (listener === callback) listener = null
  }
}

/** Emit one timeline reply; no-op when no composer is listening. */
export function emitRoomReplyRequest(target: RoomReplyTarget): void {
  if (listener !== null) listener(target)
}
