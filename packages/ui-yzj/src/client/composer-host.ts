/**
 * Live portal target for the group-room composer face (pitfall-019).
 * Transcript registers the timeline-column host; the composer (session-level,
 * survives workbench domain unmount) subscribes. Do not cache getElementById
 * across remounts.
 */

export const ROOM_COMPOSER_HOST_ID = 'yzj-room-composer-host'

type HostListener = (host: HTMLElement | null) => void

let current: HTMLElement | null = null
const listeners = new Set<HostListener>()

function liveHost(): HTMLElement | null {
  return current !== null && current.isConnected ? current : null
}

function notify(): void {
  const live = liveHost()
  for (const listener of listeners) listener(live)
}

/** Register or clear the timeline-column portal host. Pass null on unmount. */
export function registerRoomComposerHost(el: HTMLElement | null): void {
  current = el
  notify()
}

/**
 * Subscribe to the connected host. Fires immediately with the current node
 * (or null). Returns the disposer.
 */
export function subscribeRoomComposerHost(listener: HostListener): () => void {
  listeners.add(listener)
  listener(liveHost())
  return () => { listeners.delete(listener) }
}

/** Connected host, or null if unregistered / detached. */
export function getRoomComposerHost(): HTMLElement | null {
  return liveHost()
}
