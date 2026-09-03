/**
 * Shadow `sidebar.workspaces` without occupying the single seat
 * (pitfall-050: host ui-workspace already registered; a second register throws).
 * Portal the IM inbox into the declared host and hide the folder tree.
 */
import { createRoot, type Root } from 'react-dom/client'
import type { YzjPanelInject } from './rpc.ts'
import { markImOccupancy } from './im-nav.ts'
import { YzjInbox } from './inbox.tsx'
import './shell.module.css'

const HOST_ATTR = 'data-yzj-inbox-host'

function workspacesSeat(): HTMLElement | undefined {
  return document.querySelector<HTMLElement>('[data-slot="sidebar.workspaces"]') ?? undefined
}

/**
 * Keep an inbox portal inside the workspaces region. Returns the disposer.
 */
export function mountInbox(panel: YzjPanelInject): () => void {
  if (typeof document === 'undefined') return () => {}
  const stopMark = markImOccupancy()
  const host = document.createElement('div')
  host.setAttribute(HOST_ATTR, '')
  host.style.cssText = 'display:flex;flex-direction:column;height:100%;min-height:0;'
  const reactRoot: Root = createRoot(host)

  const paint = (): void => {
    reactRoot.render(<YzjInbox panel={panel} />)
  }

  const place = (): void => {
    const seat = workspacesSeat()
    if (seat === undefined) return
    if (host.parentElement !== seat) seat.appendChild(host)
    paint()
  }

  const wait = new MutationObserver(place)
  wait.observe(document.body, { childList: true, subtree: true })
  place()

  return () => {
    wait.disconnect()
    stopMark()
    reactRoot.unmount()
    host.remove()
  }
}
