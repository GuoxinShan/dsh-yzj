/**
 * Yunzhijia workbench overlay controller (R27). Opening the workbench does
 * not create or focus a DSH session — it flips an html attribute that the
 * center-column cover listens to, same family as webuiall's task board.
 */

const ACTIVE_ATTR = 'data-dsh-yzj-active'
const SIBLING_ATTRS = ['data-dsh-taskboard-active', 'data-dsh-ssh-active'] as const
const ACTIVATE_EVENT = 'dsh-panel-activate'
const PANEL_NAME = 'yzj'

let open = false
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

function applyDom(): void {
  if (typeof document === 'undefined') return
  if (open) {
    for (const attr of SIBLING_ATTRS) document.documentElement.removeAttribute(attr)
    document.documentElement.setAttribute(ACTIVE_ATTR, '')
    document.dispatchEvent(new CustomEvent(ACTIVATE_EVENT, { detail: PANEL_NAME }))
  } else {
    document.documentElement.removeAttribute(ACTIVE_ATTR)
  }
}

/** Whether the workbench cover is showing. */
export function isWorkbenchOpen(): boolean {
  return open
}

/** Show the workbench cover. No-op when already open. */
export function openWorkbench(): void {
  if (open) return
  open = true
  applyDom()
  notify()
}

/** Hide the workbench cover. No-op when already closed. */
export function closeWorkbench(): void {
  if (!open) return
  open = false
  applyDom()
  notify()
}

/** Toggle the cover. */
export function toggleWorkbench(): void {
  if (open) closeWorkbench()
  else openWorkbench()
}

/** Subscribe to open/close. Returns the disposer. */
export function subscribeWorkbenchOpen(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/**
 * Close the cover when another webuiall-family panel activates, or when the
 * user clicks a session / new-session row. Call from the mount lifetime.
 */
export function bindWorkbenchDismissal(): () => void {
  if (typeof document === 'undefined') return () => {}
  const onActivate = (event: Event): void => {
    if ((event as CustomEvent).detail !== PANEL_NAME && open) closeWorkbench()
  }
  const onSidebar = (event: MouseEvent): void => {
    if (!open) return
    const target = event.target as HTMLElement | null
    if (target === null) return
    if (target.closest('[data-dsh-yzj-entry]') !== null) return
    if (target.closest('[class*="sessionRow"], [class*="projectRow"], [class*="searchResultRow"], [class*="searchResultWorkspace"], [class*="newSession"]') !== null) {
      closeWorkbench()
    }
  }
  document.addEventListener(ACTIVATE_EVENT, onActivate)
  document.addEventListener('click', onSidebar, true)
  return () => {
    document.removeEventListener(ACTIVATE_EVENT, onActivate)
    document.removeEventListener('click', onSidebar, true)
  }
}

/** Test helper: drop overlay state between specs. */
export function resetWorkbenchOverlay(): void {
  open = false
  listeners.clear()
  if (typeof document !== 'undefined') document.documentElement.removeAttribute(ACTIVE_ATTR)
}
