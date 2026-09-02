// @vitest-environment jsdom
/**
 * View-ring sync: group rooms occupy the pane; other sessions hide 群房间.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { restoreYzjViewRing, syncYzjViewRing, watchYzjViewRing, yzjViewKindFromSessionId } from '../src/client/view-ring.ts'

function mountTabs(): { header: HTMLElement; tablist: HTMLDivElement; room: HTMLButtonElement; chat: HTMLButtonElement } {
  const header = document.createElement('header')
  const tablist = document.createElement('div')
  tablist.setAttribute('role', 'tablist')
  tablist.style.display = 'flex'
  const chat = document.createElement('button')
  chat.setAttribute('role', 'tab')
  chat.setAttribute('aria-selected', 'true')
  chat.textContent = '对话'
  const room = document.createElement('button')
  room.setAttribute('role', 'tab')
  room.setAttribute('aria-selected', 'false')
  room.textContent = '群聊'
  room.addEventListener('click', () => {
    room.setAttribute('aria-selected', 'true')
    chat.setAttribute('aria-selected', 'false')
  })
  chat.addEventListener('click', () => {
    chat.setAttribute('aria-selected', 'true')
    room.setAttribute('aria-selected', 'false')
  })
  tablist.append(chat, room)
  header.append(tablist)
  document.body.append(header)
  return { header, tablist, room, chat }
}

describe('syncYzjViewRing', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('selects 群房间 and hides the tablist on a group room', () => {
    const { tablist, room } = mountTabs()
    syncYzjViewRing('room')
    expect(room.getAttribute('aria-selected')).toBe('true')
    expect(tablist.hidden).toBe(true)
    expect(tablist.style.display).toBe('none')
    expect(tablist.style.getPropertyPriority('display')).toBe('important')
  })

  it('hides the 群房间 tab on topic and private chats', () => {
    const { tablist, room } = mountTabs()
    syncYzjViewRing('topic')
    expect(tablist.hidden).toBe(false)
    expect(room.hidden).toBe(true)
    syncYzjViewRing('unbound')
    expect(room.hidden).toBe(true)
    restoreYzjViewRing()
    expect(tablist.hidden).toBe(false)
    expect(room.hidden).toBe(false)
    expect(tablist.style.display).not.toBe('none')
  })

  it('clicks 对话 when a leftover 群聊 view is selected (pitfall-022)', () => {
    const { room, chat } = mountTabs()
    room.click()
    expect(room.getAttribute('aria-selected')).toBe('true')
    syncYzjViewRing('topic')
    expect(chat.getAttribute('aria-selected')).toBe('true')
    expect(room.getAttribute('aria-selected')).toBe('false')
    expect(room.hidden).toBe(true)
    room.hidden = false
    room.click()
    syncYzjViewRing('unbound')
    expect(chat.getAttribute('aria-selected')).toBe('true')
    expect(room.getAttribute('aria-selected')).toBe('false')
  })

  it('classifies view kind from the session-id prefix only', () => {
    expect(yzjViewKindFromSessionId('yzj-home-g-a')).toBe('room')
    expect(yzjViewKindFromSessionId('yzj-topic-g-a-root')).toBe('topic')
    expect(yzjViewKindFromSessionId('sess-coding')).toBe('unbound')
    expect(yzjViewKindFromSessionId('private-1')).toBe('unbound')
  })

  it('hides a tablist that mounts after the first sync', async () => {
    const stop = watchYzjViewRing('room')
    const { tablist, room } = mountTabs()
    await new Promise<void>(resolve => { window.setTimeout(resolve, 0) })
    expect(room.getAttribute('aria-selected')).toBe('true')
    expect(tablist.hidden).toBe(true)
    expect(tablist.style.display).toBe('none')
    stop()
  })

  it('scopes the mutation observer to the tablist parent once tabs exist', () => {
    const { header } = mountTabs()
    const NativeObserver = window.MutationObserver
    const observed: Node[] = []
    window.MutationObserver = class {
      private readonly inner: MutationObserver
      constructor(callback: MutationCallback) {
        this.inner = new NativeObserver(callback)
      }
      observe(target: Node, options?: MutationObserverInit): void {
        observed.push(target)
        this.inner.observe(target, options)
      }
      disconnect(): void { this.inner.disconnect() }
      takeRecords(): MutationRecord[] { return this.inner.takeRecords() }
    } as typeof MutationObserver
    try {
      const stop = watchYzjViewRing('room')
      expect(observed.at(-1)).toBe(header)
      expect(observed).not.toContain(document.documentElement)
      stop()
    } finally {
      window.MutationObserver = NativeObserver
    }
  })
})
