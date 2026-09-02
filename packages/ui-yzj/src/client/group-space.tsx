/**
 * 云之家 sidebar entry (R27 cover + R31 single entry).
 * One 「云之家」button opens the center-column cover — it does not
 * focus a hanger session and does not switch domains. Domain switching
 * lives on the workbench tablist. Robot status lives in 设置 → 云之家.
 */
import { useEffect, useState } from 'react'
import { parseNavRooms, topicNavLabel } from './conv-list.tsx'
import { isWorkbenchOpen, openWorkbench, subscribeWorkbenchOpen } from './workbench-overlay.ts'
import { rememberImSeat } from './im-seat.ts'
import css from './home.module.css'

export { topicNavLabel }

/** Injected RPC + focus for the dock. */
export interface YzjGroupSpaceInjected {
  homeNav: () => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  focusBoundSession?: (sessionId: string) => void
  fetchGroups?: (limit?: number, page?: number) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  homeOpen?: (groupId: string, title?: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
}

/**
 * 云之家 dock (injected under New Session). Compact glyph when the
 * sidebar is a rail.
 */
export function YzjYunzhijiaDock(
  props: { wide: boolean } & YzjGroupSpaceInjected,
) {
  const [hint, setHint] = useState('')
  const [open, setOpen] = useState(isWorkbenchOpen)
  useEffect(() => subscribeWorkbenchOpen(() => { setOpen(isWorkbenchOpen()) }), [])

  useEffect(() => {
    let cancelled = false
    void props.homeNav().then((nav) => {
      if (cancelled || !nav.ok) return
      const first = parseNavRooms(nav.value)[0]
      if (first === undefined) return
      rememberImSeat({
        groupId: first.groupId,
        sessionId: first.sessionId,
        ...(first.groupName === '' ? {} : { groupName: first.groupName }),
      })
    })
    return () => { cancelled = true }
    // homeNav is a stable RPC closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onHome = (): void => {
    setHint('')
    openWorkbench()
  }

  return (
    <nav
      className={props.wide ? css.yzjDock : css.yzjDockNarrow}
      data-testid="yzj-group-space"
      aria-label="云之家"
    >
      <div className={css.yzjDockEntries}>
        <button
          type="button"
          className={`${css.yzjDockEntry} ${open ? css.yzjDockEntryActive : ''}`}
          title="云之家"
          aria-pressed={open}
          data-testid="yzj-dock-home"
          onClick={onHome}
        >
          {!props.wide && <span className={css.yzjDockMark} aria-hidden="true">云</span>}
          {props.wide && <span className={css.yzjDockLabel}>云之家</span>}
        </button>
      </div>
      {props.wide && hint !== '' && <p className={css.yzjDockHint}>{hint}</p>}
    </nav>
  )
}

/** @deprecated Slot still uses this name in older tests; prefer {@link YzjYunzhijiaDock}. */
export const YzjGroupSpaceNav = YzjYunzhijiaDock
