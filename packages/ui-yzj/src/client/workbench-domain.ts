/**
 * Workbench domain bus (docs/spec/group-room-topics.md R15/R21/R31).
 * The workbench tablist writes; the group-room shell reads. Module-level so
 * the dock (sidebar inject) and overlay cover do not share a React tree.
 */

import { useEffect, useState } from 'react'

/** Five 云之家 workbench domains. `im` is the group-room timeline;
 * `advance` is the AI推进 board (docs/spec/ai-advance-design.md §7). */
export type WorkbenchDomain = 'im' | 'todo' | 'calendar' | 'docs' | 'advance'

/** Top-bar tabs that switch {@link WorkbenchDomain} (v1.16 / R31; v1.18 +推进). */
export const WORKBENCH_TABS = [
  { domain: 'im', id: 'chat', label: '对话' },
  { domain: 'todo', id: 'todo', label: '待办' },
  { domain: 'calendar', id: 'calendar', label: '日程' },
  { domain: 'docs', id: 'docs', label: '知识库' },
  { domain: 'advance', id: 'advance', label: '推进' },
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

/** Cross-component IM group focus bus: the advance board's 事元/source jumps
 * request a group open; the im panel consumes it and switches the timeline.
 * 决策 39: the request may carry an anchor message — the timeline scrolls to
 * and highlights that exact row (事件级定位, not just the group). */
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

/**
 * Topic-drawer open latch (决策 41 讨论回环): the advance pane's 问助手/回到对话
 * 继续聊 asks the im domain to open the topic drawer straight onto an agent Q&A
 * surface — not the bare group timeline. Latched (not fire-and-forget) because
 * the target group transcript may mount after the request (domain switch first).
 */
export interface TopicOpenRequest {
  readonly groupId: string
  /** Open this existing topic session; empty → the transcript mints one with `title`. */
  readonly sessionId?: string
  readonly title?: string
}

let pendingTopicOpen: TopicOpenRequest | null = null

/** Latch a topic-drawer open request for one group room. */
export function requestTopicOpen(request: TopicOpenRequest): void {
  pendingTopicOpen = request
}

/** Read-and-clear the latch when the group matches; null otherwise. */
export function consumeTopicOpen(groupId: string): TopicOpenRequest | null {
  if (pendingTopicOpen === null || pendingTopicOpen.groupId !== groupId) return null
  const request = pendingTopicOpen
  pendingTopicOpen = null
  return request
}
