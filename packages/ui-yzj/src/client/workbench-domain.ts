/**
 * Workbench domain bus (docs/spec/group-room-topics.md R15/R21/R31).
 * The workbench tablist writes; the group-room shell reads. Module-level so
 * the dock (sidebar inject) and overlay cover do not share a React tree.
 */

import { useEffect, useState } from 'react'

/** Three 云之家 workbench domains. `im` is the group-room timeline. */
export type WorkbenchDomain = 'im' | 'calendar' | 'docs'

/** Top-bar tabs that switch {@link WorkbenchDomain}. */
export const WORKBENCH_TABS = [
  { domain: 'im', id: 'chat', label: '对话' },
  { domain: 'calendar', id: 'calendar', label: '日程' },
  { domain: 'docs', id: 'docs', label: '知识库' },
] as const

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

/**
 * React face for {@link getWorkbenchDomain}. Lives here so composer / dock /
 * shell share one subscription instead of each wiring useState+effect.
 */
export function useWorkbenchDomain(): WorkbenchDomain {
  const [domain, setDomain] = useState<WorkbenchDomain>(getWorkbenchDomain)
  useEffect(() => subscribeWorkbenchDomain(() => { setDomain(getWorkbenchDomain()) }), [])
  return domain
}

/** Cross-component IM group focus bus: a pane or card may request a group
 * open; the im panel consumes it and switches the timeline. The request may
 * carry an anchor message — the timeline scrolls to and highlights that row. */
export interface ImFocusTarget {
  readonly groupId: string
  readonly anchorMsgId?: string
}

const imFocusListeners = new Set<(target: ImFocusTarget) => void>()

/** Ask the im domain to open one group, optionally anchored on a message. */
export function requestImGroupFocus(target: ImFocusTarget | string): void {
  const resolved: ImFocusTarget = typeof target === 'string' ? { groupId: target } : target
  for (const listener of imFocusListeners) listener(resolved)
}

/** Subscribe to group-focus requests. Returns the disposer. */
export function subscribeImGroupFocus(listener: (target: ImFocusTarget) => void): () => void {
  imFocusListeners.add(listener)
  return () => { imFocusListeners.delete(listener) }
}

