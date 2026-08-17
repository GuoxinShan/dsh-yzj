/**
 * Align the harness conversation tab ring with v2.0 views.
 * Group room occupies the pane (select 「群房间」, hide the ring).
 * Topic / private chats keep official Chat and hide the unused 群房间 tab.
 *
 * pitfall-018: harness `.tabs { display:flex }` beats `[hidden]`; hide with
 * `display:none !important` and re-run when the tablist mounts late.
 */

export type YzjViewKind = 'room' | 'topic' | 'unbound'

function roomTabOf(root: ParentNode): HTMLElement | undefined {
  return [...root.querySelectorAll<HTMLElement>('[role="tab"]')]
    .find(tab => tab.textContent?.trim() === '群房间')
}

function hideTablist(tablist: HTMLElement | null | undefined): void {
  if (tablist === undefined || tablist === null) return
  if (tablist.getAttribute('data-yzj-ring') === 'off' && tablist.style.display === 'none') return
  tablist.hidden = true
  tablist.setAttribute('data-yzj-ring', 'off')
  tablist.style.setProperty('display', 'none', 'important')
}

function showTablist(tablist: HTMLElement | null | undefined): void {
  if (tablist === undefined || tablist === null) return
  if (tablist.getAttribute('data-yzj-ring') !== 'off' && !tablist.hidden) return
  tablist.hidden = false
  tablist.removeAttribute('data-yzj-ring')
  tablist.style.removeProperty('display')
}

/**
 * Sync the visible conversation tab ring to `kind`. Safe to call often:
 * clicks only when the room tab is not already selected.
 */
export function syncYzjViewRing(kind: YzjViewKind): void {
  const roomTab = roomTabOf(document)
  const tablist = roomTab?.closest<HTMLElement>('[role="tablist"]')
  if (kind === 'room') {
    if (roomTab !== undefined && roomTab.getAttribute('aria-selected') !== 'true') {
      roomTab.click()
    }
    hideTablist(tablist)
    if (roomTab !== undefined) roomTab.hidden = false
    return
  }
  showTablist(tablist)
  if (roomTab !== undefined) roomTab.hidden = true
}

/**
 * Keep {@link syncYzjViewRing} applied while the header lives: the tablist
 * often mounts after the first sync (pitfall-018). Once the tablist exists,
 * observe only its parent (header)—not `document.documentElement`, which
 * fires on every timeline insert.
 */
export function watchYzjViewRing(kind: YzjViewKind): () => void {
  syncYzjViewRing(kind)
  let observed: Node | null = null
  const observer = new MutationObserver(() => {
    syncYzjViewRing(kind)
    retarget()
  })
  const retarget = (): void => {
    const tablist = document.querySelector('[role="tablist"]')
    const next: Node = tablist?.parentElement ?? document.documentElement
    if (next === observed) return
    observer.disconnect()
    observed = next
    observer.observe(next, { childList: true, subtree: true })
  }
  retarget()
  return () => {
    observer.disconnect()
    observed = null
  }
}

/** Undo {@link syncYzjViewRing} when the session header unmounts. */
export function restoreYzjViewRing(): void {
  const roomTab = roomTabOf(document)
  const tablist = roomTab?.closest<HTMLElement>('[role="tablist"]')
  showTablist(tablist)
  if (roomTab !== undefined) roomTab.hidden = false
}
