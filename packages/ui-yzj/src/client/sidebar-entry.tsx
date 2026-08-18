/**
 * Inject the 云之家 dock after the official New Session button (R27).
 * Official sidebar has no upper list slot; this follows webuiall task-board.
 */
import { createRoot, type Root } from 'react-dom/client'
import { YzjYunzhijiaDock, type YzjGroupSpaceInjected } from './group-space.tsx'
import css from './overlay.module.css'

const ENTRY_ATTR = 'data-dsh-yzj-entry'

function sidebarRoot(): HTMLElement | undefined {
  const column = document.querySelector<HTMLElement>('[data-pane="sidebar"], [class*="sidebarCol"]')
  if (column === null) return undefined
  const logoOwner = column.querySelector<HTMLElement>('[class*="logoRow"]')?.parentElement
  return logoOwner ?? (column.firstElementChild as HTMLElement | undefined)
}

function newSessionButton(root: HTMLElement): HTMLElement | undefined {
  const nested = root.querySelector<HTMLElement>('button[class*="newSession"]')
  if (nested !== null) return nested
  for (const child of root.children) {
    if (child.tagName === 'BUTTON') return child as HTMLElement
  }
  return undefined
}

function sidebarIsWide(): boolean {
  const column = document.querySelector<HTMLElement>('[data-pane="sidebar"], [class*="sidebarCol"]')
  return (column?.getBoundingClientRect().width ?? 0) > 80
}

/**
 * Mount the dock into the sidebar chrome. Returns the disposer.
 */
export function mountSidebarEntry(inject: YzjGroupSpaceInjected): () => void {
  if (typeof document !== 'undefined' && document.querySelector(`[${ENTRY_ATTR}]`) !== null) {
    return () => {}
  }
  const host = document.createElement('div')
  host.setAttribute(ENTRY_ATTR, '')
  host.className = css.entryHost ?? ''
  const reactRoot: Root = createRoot(host)
  let wide = sidebarIsWide()
  const paint = (): void => {
    reactRoot.render(<YzjYunzhijiaDock wide={wide} {...inject} />)
  }

  const place = (root: HTMLElement): boolean => {
    const button = newSessionButton(root)
    if (button === undefined) return false
    const row = button.closest('[class*="logoRow"]')
    const base = (row !== null && row.parentElement === root) ? row : button
    if (host.parentElement !== root) {
      root.insertBefore(host, base.nextElementSibling)
    }
    return true
  }

  let root: HTMLElement | undefined
  const tryPlace = (): void => {
    if (root !== undefined && !root.isConnected) root = undefined
    root ??= sidebarRoot()
    if (root === undefined) return
    if (place(root)) paint()
  }

  const wait = new MutationObserver(() => {
    wide = sidebarIsWide()
    tryPlace()
    if (root !== undefined && !root.contains(host)) tryPlace()
  })
  wait.observe(document.body, { childList: true, subtree: true })
  tryPlace()

  return () => {
    wait.disconnect()
    reactRoot.unmount()
    host.remove()
  }
}
