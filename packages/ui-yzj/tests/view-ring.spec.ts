// @vitest-environment jsdom
/**
 * View-ring sync: group rooms occupy the pane; other sessions hide 群房间.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { restoreYzjViewRing, syncYzjViewRing, watchYzjViewRing } from '../src/client/view-ring.ts'

function mountTabs(): { tablist: HTMLDivElement; room: HTMLButtonElement; chat: HTMLButtonElement } {
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
  room.textContent = '群房间'
  room.addEventListener('click', () => {
    room.setAttribute('aria-selected', 'true')
    chat.setAttribute('aria-selected', 'false')
  })
  tablist.append(chat, room)
  document.body.append(tablist)
  return { tablist, room, chat }
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

  it('hides a tablist that mounts after the first sync', async () => {
    const stop = watchYzjViewRing('room')
    const { tablist, room } = mountTabs()
    await new Promise<void>(resolve => { window.setTimeout(resolve, 0) })
    expect(room.getAttribute('aria-selected')).toBe('true')
    expect(tablist.hidden).toBe(true)
    expect(tablist.style.display).toBe('none')
    stop()
  })
})
