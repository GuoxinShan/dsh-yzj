/**
 * Shadow `sidebar.workspaces` without occupying the single seat
 * (pitfall-050: host ui-workspace already registered; a second register throws).
 *
 * Layout (I16):
 * - 消息/会话 switch mounts in the sidebar chrome **above** host「新会话」,
 *   so 会话态 is 表面开关 → 新会话 → 工作区, not 新会话压在页签上.
 * - Inbox portals into the workspaces region; folder tree hides only while
 *   IM occupancy is on.
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

const SWITCH_ATTR = 'data-yzj-surface-chrome'
const INBOX_ATTR = 'data-yzj-inbox-host'

function workspacesSeat(): HTMLElement | undefined {
  return document.querySelector<HTMLElement>('[data-slot="sidebar.workspaces"]') ?? undefined
}

function sidebarColumn(): HTMLElement | undefined {
  return document.querySelector<HTMLElement>('[data-pane="sidebar"], [class*="sidebarCol"]') ?? undefined
}

function newSessionAnchor(column: HTMLElement): HTMLElement | undefined {
  const button = column.querySelector<HTMLElement>('button[class*="newSession"]')
  if (button === null) return undefined
  const row = button.closest<HTMLElement>('[class*="logoRow"]')
  if (row !== null && column.contains(row)) return row
  return button
}

function applyInboxLayout(el: HTMLElement, surface: ImSurface): void {
  if (surface === 'im') {
    el.style.cssText = 'display:flex;flex-direction:column;height:100%;min-height:0;flex:1 1 0;'
    el.hidden = false
    return
  }
  el.style.cssText = 'display:none;'
  el.hidden = true
}

function YzjSurfaceSwitchPortal() {
  const [surface, setSurface] = useState(getImSurface)
  useEffect(() => subscribeImSelection(() => { setSurface(getImSurface()) }), [])
  return <YzjSurfaceSwitch surface={surface} />
}

function YzjInboxPortal(props: { panel: YzjPanelInject }) {
  // Stay mounted under 会话: host CSS already hides this node. Returning
  // null here used to remount YzjInbox and force a cold recent-list fetch.
  return <YzjInbox panel={props.panel} />
}

function placeSurfaceSwitch(host: HTMLElement): void {
  const column = sidebarColumn()
  if (column === undefined) return
  const anchor = newSessionAnchor(column)
  if (anchor !== undefined && anchor.parentElement !== null) {
    if (host.parentElement !== anchor.parentElement || host.nextElementSibling !== anchor) {
      anchor.parentElement.insertBefore(host, anchor)
    }
    return
  }
  const seat = workspacesSeat()
  if (seat?.parentElement !== undefined && seat.parentElement !== null) {
    if (host.parentElement !== seat.parentElement || host.nextElementSibling !== seat) {
      seat.parentElement.insertBefore(host, seat)
    }
  }
}

function placeInboxHost(host: HTMLElement): void {
  const seat = workspacesSeat()
  if (seat === undefined) return
  if (host.parentElement !== seat) seat.insertBefore(host, seat.firstChild)
}

/**
 * Keep the surface switch + inbox portal mounted. Returns the disposer.
 * Inbox React tree stays mounted under 会话 (host CSS hides it) so the
 * recent list does not cold-fetch on every 消息/会话 toggle.
 */
export function mountInbox(panel: YzjPanelInject): () => void {
  if (typeof document === 'undefined') return () => {}
  const stopMark = markImOccupancy()

  const switchHost = document.createElement('div')
  switchHost.setAttribute(SWITCH_ATTR, '')
  switchHost.style.cssText = 'flex:none;'
  const switchRoot: Root = createRoot(switchHost)

  const inboxHost = document.createElement('div')
  inboxHost.setAttribute(INBOX_ATTR, '')
  applyInboxLayout(inboxHost, getImSurface())
  const inboxRoot: Root = createRoot(inboxHost)

  const paint = (): void => {
    applyInboxLayout(inboxHost, getImSurface())
    switchRoot.render(<YzjSurfaceSwitchPortal />)
    inboxRoot.render(<YzjInboxPortal panel={panel} />)
  }

  const place = (): void => {
    placeSurfaceSwitch(switchHost)
    placeInboxHost(inboxHost)
    paint()
  }

  const wait = new MutationObserver(place)
  wait.observe(document.body, { childList: true, subtree: true })
  const stopSel = subscribeImSelection(() => { applyInboxLayout(inboxHost, getImSurface()) })
  place()

  return () => {
    wait.disconnect()
    stopSel()
    stopMark()
    switchRoot.unmount()
    inboxRoot.unmount()
    switchHost.remove()
    inboxHost.remove()
  }
}
