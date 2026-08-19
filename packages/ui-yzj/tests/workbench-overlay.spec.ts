// @vitest-environment jsdom
/**
 * R27 overlay controller: open/close flips the html attribute and dismisses
 * on a sibling panel activate.
 */
import { afterEach, describe, expect, it } from 'vitest'
import {
  bindWorkbenchDismissal, closeWorkbench, isWorkbenchOpen, openWorkbench,
  resetWorkbenchOverlay,
} from '../src/client/workbench-overlay.ts'

describe('workbench overlay', () => {
  afterEach(() => { resetWorkbenchOverlay() })

  it('sets the html flag when opened and clears it when closed', () => {
    expect(isWorkbenchOpen()).toBe(false)
    openWorkbench()
    expect(isWorkbenchOpen()).toBe(true)
    expect(document.documentElement.getAttribute('data-dsh-yzj-active')).toBe('')
    closeWorkbench()
    expect(isWorkbenchOpen()).toBe(false)
    expect(document.documentElement.getAttribute('data-dsh-yzj-active')).toBeNull()
  })

  it('closes when another webuiall-family panel activates', () => {
    const stop = bindWorkbenchDismissal()
    openWorkbench()
    document.dispatchEvent(new CustomEvent('dsh-panel-activate', { detail: 'taskboard' }))
    expect(isWorkbenchOpen()).toBe(false)
    stop()
  })
})
