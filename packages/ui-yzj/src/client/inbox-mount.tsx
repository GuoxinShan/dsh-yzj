/**
 * Shadow `sidebar.workspaces` without occupying the single seat
 * (pitfall-050: host ui-workspace already registered; a second register throws).
 * Portal the 消息/会话 switch + IM inbox into the declared host; hide the
 * folder tree only while IM occupancy is on (I16).
 */
import { createRoot, type Root } from 'react-dom/client'
import { useEffect, useState } from 'react'
import type { YzjPanelInject } from './rpc.ts'
import {
  getImSurface, markImOccupancy, subscribeImSelection, type ImSurface,
} from './im-nav.ts'
import { YzjInbox } from './inbox.tsx'
import { YzjSurfaceSwitch } from './surface-switch.tsx'
import './shell.module.css'

const ROOT_ATTR = 'data-yzj-surface-root'

function workspacesSeat(): HTMLElement | undefined {
  return document.querySelector<HTMLElement>('[data-slot="sidebar.workspaces"]') ?? undefined
}

function applyRootLayout(el: HTMLElement, surface: ImSurface): void {
  if (surface === 'im') {
    el.style.cssText = 'display:flex;flex-direction:column;height:100%;min-height:0;flex:1 1 0;'
    return
  }
  el.style.cssText = 'display:flex;flex-direction:column;flex:none;height:auto;min-height:0;'
}

function YzjWorkspacesPortal(props: { panel: YzjPanelInject }) {
  const [surface, setSurface] = useState(getImSurface)
  useEffect(() => subscribeImSelection(() => { setSurface(getImSurface()) }), [])
  const inboxOn = surface === 'im'
  return (
    <>
      <YzjSurfaceSwitch surface={surface} />
      <div
        data-yzj-inbox-host=""
        hidden={!inboxOn}
        style={inboxOn
          ? { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, flex: '1 1 0' }
          : { display: 'none' }}
      >
        <YzjInbox panel={props.panel} />
      </div>
    </>
  )
}

/**
 * Keep an inbox portal inside the workspaces region. Returns the disposer.
 * The inbox host stays mounted in 会话 so selection does not refetch on return.
 */
export function mountInbox(panel: YzjPanelInject): () => void {
  if (typeof document === 'undefined') return () => {}
  const stopMark = markImOccupancy()
  const root = document.createElement('div')
  root.setAttribute(ROOT_ATTR, '')
  applyRootLayout(root, getImSurface())
  const reactRoot: Root = createRoot(root)

  const paint = (): void => {
    applyRootLayout(root, getImSurface())
    reactRoot.render(<YzjWorkspacesPortal panel={panel} />)
  }

  const place = (): void => {
    const seat = workspacesSeat()
    if (seat === undefined) return
    if (root.parentElement !== seat) seat.insertBefore(root, seat.firstChild)
    paint()
  }

  const wait = new MutationObserver(place)
  wait.observe(document.body, { childList: true, subtree: true })
  const stopSel = subscribeImSelection(() => { applyRootLayout(root, getImSurface()) })
  place()

  return () => {
    wait.disconnect()
    stopSel()
    stopMark()
    reactRoot.unmount()
    root.remove()
  }
}
