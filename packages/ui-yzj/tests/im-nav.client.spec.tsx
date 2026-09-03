// @vitest-environment jsdom
/**
 * Occupancy surface (I16): 会话 must not keep pinning the 助手 view tab.
 */
import { afterEach, describe, expect, it } from 'vitest'
import {
  electImComposer, getImSurface, markImOccupancy, resetImSelection, setImSurface,
} from '../src/client/im-nav.ts'

function hostTabs(): { im: HTMLButtonElement; chat: HTMLButtonElement } {
  const list = document.createElement('div')
  list.setAttribute('role', 'tablist')
  const im = document.createElement('button')
  im.setAttribute('role', 'tab')
  im.textContent = '助手'
  im.setAttribute('aria-selected', 'true')
  const chat = document.createElement('button')
  chat.setAttribute('role', 'tab')
  chat.textContent = '对话'
  chat.setAttribute('aria-selected', 'false')
  list.append(im, chat)
  document.body.append(list)
  return { im, chat }
}

describe('im occupancy surface', () => {
  afterEach(() => {
    resetImSelection()
    document.body.replaceChildren()
  })

  it('会话 unsets data-dsh-yzj-im and clicks host Chat once', () => {
    const { im, chat } = hostTabs()
    let imClicks = 0
    let chatClicks = 0
    im.addEventListener('click', () => { imClicks += 1 })
    chat.addEventListener('click', () => { chatClicks += 1 })
    const stop = markImOccupancy()
    expect(document.documentElement.hasAttribute('data-dsh-yzj-im')).toBe(true)
    setImSurface('session')
    expect(getImSurface()).toBe('session')
    expect(document.documentElement.hasAttribute('data-dsh-yzj-im')).toBe(false)
    expect(chatClicks).toBe(1)
    const imAfter = imClicks
    document.body.appendChild(document.createElement('span'))
    expect(imClicks).toBe(imAfter)
    stop()
  })

  it('clicking the host 助手 tab while in 会话 re-enters IM occupancy', () => {
    const { im, chat } = hostTabs()
    chat.addEventListener('click', () => {
      chat.setAttribute('aria-selected', 'true')
      im.setAttribute('aria-selected', 'false')
    })
    const stop = markImOccupancy()
    setImSurface('session')
    expect(getImSurface()).toBe('session')
    im.click()
    expect(getImSurface()).toBe('im')
    expect(document.documentElement.hasAttribute('data-dsh-yzj-im')).toBe(true)
    stop()
  })

  it('electImComposer yields to the official chain on 会话', () => {
    expect(electImComposer([])).toEqual({ im: true })
    setImSurface('session')
    expect(electImComposer([])).toBeNull()
    expect(electImComposer([{ kind: 'approval' }])).toBeNull()
  })
})
