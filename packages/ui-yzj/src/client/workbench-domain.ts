/**
 * Workbench domain bus (docs/spec/group-room-topics.md R15/R21).
 * The sidebar dock writes; the group-room shell reads. Module-level so the
 * dock (sidebar.footer) and conversation.view do not share a React tree.
 */

/** Five 云之家 workbench domains. `im` is the group-room timeline. */
export type WorkbenchDomain = 'im' | 'todo' | 'calendar' | 'docs' | 'memory'

let current: WorkbenchDomain = 'im'
const listeners = new Set<() => void>()

/** Current domain (defaults to 对话). */
export function getWorkbenchDomain(): WorkbenchDomain {
  return current
}

/** Switch the workbench domain; no-op when unchanged. */
export function setWorkbenchDomain(next: WorkbenchDomain): void {
  if (current === next) return
  current = next
  for (const listener of listeners) listener()
}

/** Subscribe to domain changes. Returns the disposer. */
export function subscribeWorkbenchDomain(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
