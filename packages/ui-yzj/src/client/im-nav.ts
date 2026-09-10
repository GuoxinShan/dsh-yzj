/**
 * IM-shell selection bus: assistant DM vs Yunzhijia people room,
 * plus the 消息 / 会话 occupancy switch (I16). Module-level so inbox
 * (sidebar.workspaces) and the conversation occupy do not share a React tree.
 */

import { watchHostChrome } from './host-chrome.ts'

export type ImSelection =
  | { readonly kind: 'assistant'; readonly assistantId: string }
  | { readonly kind: 'group'; readonly groupId: string; readonly groupName?: string }

/** Default surface is IM; `session` restores native DSH (I16). */
export type ImSurface = 'im' | 'session'

const DEFAULT: ImSelection = { kind: 'assistant', assistantId: 'default' }

let current: ImSelection = DEFAULT
let surface: ImSurface = 'im'
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

function isSurfaceSwitchTab(node: Element): boolean {
  return node.closest('[data-yzj-surface-switch]') !== null
}

function findImViewTab(): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>('[role="tab"]')]
    .find(node => !isSurfaceSwitchTab(node) && node.textContent?.trim() === '助手')
}

/**
 * Host tab buttons have no view-id attribute — stamp ours so 会话 CSS can
 * hide the IM seat without unregistering conversation.view (still needed for
 * 消息). Surface switch stays unmarked.
 */
function markImViewTab(): void {
  if (typeof document === 'undefined') return
  for (const node of document.querySelectorAll<HTMLElement>('[data-yzj-im-view-tab]')) {
    if (node.textContent?.trim() !== '助手' || isSurfaceSwitchTab(node)) {
      node.removeAttribute('data-yzj-im-view-tab')
    }
  }
  const tab = findImViewTab()
  if (tab !== undefined) tab.setAttribute('data-yzj-im-view-tab', '')
}

function findHostChatTab(): HTMLElement | undefined {
  const tabs = [...document.querySelectorAll<HTMLElement>('[role="tab"]')]
    .filter(node => !isSurfaceSwitchTab(node))
  const labeled = tabs.find((node) => {
    const label = node.textContent?.trim() ?? ''
    return label === '对话' || label === 'Chat'
  })
  if (labeled !== undefined) return labeled
  return tabs.find((node) => {
    const label = node.textContent?.trim() ?? ''
    return label !== '助手' && label !== '消息' && label !== '会话'
  })
}

function applyDom(): void {
  if (typeof document === 'undefined') return
  markImViewTab()
  if (surface === 'im') {
    document.documentElement.setAttribute('data-dsh-yzj-im', '')
    return
  }
  document.documentElement.removeAttribute('data-dsh-yzj-im')
}

function selectImViewTab(): void {
  if (typeof document === 'undefined') return
  const tab = findImViewTab()
  if (tab !== undefined && tab.getAttribute('aria-selected') !== 'true') tab.click()
}

/** Click the host Chat view once when entering 会话 (do not loop in the observer). */
function selectHostChatTab(): void {
  if (typeof document === 'undefined') return
  const tab = findHostChatTab()
  if (tab !== undefined && tab.getAttribute('aria-selected') !== 'true') tab.click()
}

/** Current inbox selection. Switching 消息/会话 does not clear this. */
export function getImSelection(): ImSelection {
  return current
}

/** Select an inbox row. Does not change occupancy surface. */
export function setImSelection(next: ImSelection): void {
  current = next
  applyDom()
  notify()
}

/** Subscribe to selection and occupancy-surface changes. */
export function subscribeImSelection(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Test helper. Surface returns to the IM default; occupancy attrs are cleared. */
export function resetImSelection(): void {
  current = DEFAULT
  surface = 'im'
  listeners.clear()
  if (typeof document !== 'undefined') {
    document.documentElement.removeAttribute('data-dsh-yzj-im')
  }
}

/** Current occupancy: IM shell vs native local-session workbench. */
export function getImSurface(): ImSurface {
  return surface
}

/**
 * Toggle occupancy. Inbox selection is preserved. `im` pins the 助手 view tab;
 * `session` unsets `html[data-dsh-yzj-im]` and clicks host Chat once.
 */
export function setImSurface(next: ImSurface): void {
  if (surface === next) {
    applyDom()
    if (next === 'im') selectImViewTab()
    return
  }
  surface = next
  applyDom()
  if (next === 'im') selectImViewTab()
  else selectHostChatTab()
  notify()
}

/**
 * Composer-chain election: IM occupancy paints a null seat; 会话 yields to
 * the official InputBar. Approval/question interactions always fall through.
 */
export function electImComposer(interactions: readonly { readonly kind: string }[]): { im: true } | null {
  if (surface !== 'im') return null
  if (interactions.some(item => item.kind === 'approval' || item.kind === 'question')) return null
  return { im: true }
}

/**
 * Mark occupancy on first mount. IM surface keeps the 助手 view tab selected;
 * session surface must not steal other host views on later mutations.
 */
export function markImOccupancy(): () => void {
  applyDom()
  if (surface === 'im') selectImViewTab()
  if (typeof document === 'undefined') return () => {}
  const stopChrome = watchHostChrome()
  const onHostTabClick = (event: Event): void => {
    const target = event.target
    if (!(target instanceof Element)) return
    const tab = target.closest<HTMLElement>('[role="tab"]')
    if (tab === null || isSurfaceSwitchTab(tab)) return
    if (surface === 'session' && tab.textContent?.trim() === '助手') setImSurface('im')
  }
  document.addEventListener('click', onHostTabClick, true)
  const observer = new MutationObserver(() => {
    if (surface === 'session') {
      applyDom()
      return
    }
    applyDom()
    selectImViewTab()
  })
  observer.observe(document.body, { childList: true, subtree: true })
  return () => {
    observer.disconnect()
    document.removeEventListener('click', onHostTabClick, true)
    stopChrome()
    if (surface === 'im') {
      document.documentElement.removeAttribute('data-dsh-yzj-im')
    }
  }
}
