// @vitest-environment jsdom
/**
 * Composer host bus: remounted timeline hosts must replace detached nodes.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  getRoomComposerHost,
  registerRoomComposerHost,
  subscribeRoomComposerHost,
} from '../src/client/composer-host.ts'

describe('composer-host registry', () => {
  beforeEach(() => { registerRoomComposerHost(null) })
  afterEach(() => { registerRoomComposerHost(null) })

  it('notifies subscribers when the host is replaced after unmount', () => {
    const seen: Array<HTMLElement | null> = []
    const stop = subscribeRoomComposerHost(el => { seen.push(el) })
    expect(seen.at(-1)).toBeNull()

    const first = document.createElement('div')
    document.body.append(first)
    registerRoomComposerHost(first)
    expect(seen.at(-1)).toBe(first)
    expect(getRoomComposerHost()).toBe(first)

    registerRoomComposerHost(null)
    first.remove()
    expect(seen.at(-1)).toBeNull()
    expect(getRoomComposerHost()).toBeNull()

    const second = document.createElement('div')
    document.body.append(second)
    registerRoomComposerHost(second)
    expect(seen.at(-1)).toBe(second)
    expect(getRoomComposerHost()).toBe(second)
    expect(second).not.toBe(first)
    stop()
    second.remove()
  })

  it('treats a detached registered node as missing', () => {
    const node = document.createElement('div')
    document.body.append(node)
    registerRoomComposerHost(node)
    node.remove()
    expect(getRoomComposerHost()).toBeNull()
  })
})
