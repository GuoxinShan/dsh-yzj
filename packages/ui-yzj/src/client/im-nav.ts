/**
 * IM-shell selection bus: assistant DM vs Yunzhijia people room vs process peek.
 * Module-level so inbox (sidebar.workspaces) and the conversation occupy
 * do not share a React tree.
 */

import { watchHostChrome } from './host-chrome.ts'

export type ImSelection =
  | { readonly kind: 'assistant'; readonly assistantId: string }
  | { readonly kind: 'group'; readonly groupId: string; readonly groupName?: string }
  | { readonly kind: 'peek'; readonly assistantId: string; readonly groupId?: string; readonly groupName?: string }

const DEFAULT: ImSelection = { kind: 'assistant', assistantId: 'default' }

let current: ImSelection = DEFAULT
export type ImPane = '' | 'calendar' | 'docs'
let pane: ImPane = ''
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

function applyDom(): void {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-dsh-yzj-im', '')
  if (current.kind === 'peek') {
    document.documentElement.setAttribute('data-dsh-yzj-peek', '')
  } else {
    document.documentElement.removeAttribute('data-dsh-yzj-peek')
  }
}

function selectImViewTab(): void {
  if (typeof document === 'undefined') return
  const tab = [...document.querySelectorAll<HTMLElement>('[role="tab"]')]
    .find(node => node.textContent?.trim() === '助手')
  if (tab !== undefined && tab.getAttribute('aria-selected') !== 'true') tab.click()
}

/** Current inbox selection. */
export function getImSelection(): ImSelection {
  return current
}

/** Select an inbox row (or process peek). */
export function setImSelection(next: ImSelection): void {
  current = next
  pane = ''
  applyDom()
  notify()
}

/** Subscribe to selection changes. */
export function subscribeImSelection(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Test helper. */
export function resetImSelection(): void {
  current = DEFAULT
  pane = ''
  listeners.clear()
  if (typeof document !== 'undefined') {
    document.documentElement.removeAttribute('data-dsh-yzj-im')
    document.documentElement.removeAttribute('data-dsh-yzj-peek')
  }
}

/** Composer `+` / 查看上下文: calendar or docs over the IM center. */
export function getImPane(): ImPane {
  return pane
}

export function setImPane(next: ImPane): void {
  pane = next
  notify()
}

/** Mark the IM occupancy on first mount and keep the 助手 view tab selected. */
export function markImOccupancy(): () => void {
  applyDom()
  selectImViewTab()
  if (typeof document === 'undefined') return () => {}
  const stopChrome = watchHostChrome()
  const observer = new MutationObserver(() => {
    applyDom()
    selectImViewTab()
  })
  observer.observe(document.body, { childList: true, subtree: true })
  return () => {
    observer.disconnect()
    stopChrome()
    document.documentElement.removeAttribute('data-dsh-yzj-im')
    document.documentElement.removeAttribute('data-dsh-yzj-peek')
  }
}
