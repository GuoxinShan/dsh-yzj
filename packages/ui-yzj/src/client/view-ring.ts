/**
 * Align the harness conversation tab ring with v2.0 views.
 * Group room occupies the pane (select 「群房间」, hide the ring).
 * Topic / private chats keep official Chat and hide the unused 群房间 tab.
 */

export type YzjViewKind = 'room' | 'topic' | 'unbound'

function roomTabOf(root: ParentNode): HTMLElement | undefined {
  return [...root.querySelectorAll<HTMLElement>('[role="tab"]')]
    .find(tab => tab.textContent?.trim() === '群房间')
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
    if (tablist !== undefined && tablist !== null) tablist.hidden = true
    if (roomTab !== undefined) roomTab.hidden = false
    return
  }
  if (tablist !== undefined && tablist !== null) tablist.hidden = false
  if (roomTab !== undefined) roomTab.hidden = true
}

/** Undo {@link syncYzjViewRing} when the session header unmounts. */
export function restoreYzjViewRing(): void {
  const roomTab = roomTabOf(document)
  const tablist = roomTab?.closest<HTMLElement>('[role="tablist"]')
  if (tablist !== undefined && tablist !== null) tablist.hidden = false
  if (roomTab !== undefined) roomTab.hidden = false
}
