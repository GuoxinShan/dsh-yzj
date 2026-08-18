/**
 * 云之家 entry dock (R27): four domains. Click opens the center-column
 * cover — it does not focus a hanger session. Robot status lives in
 * 设置 → 云之家, not as a lone status dot here.
 */
import { useEffect, useState } from 'react'
import { parseNavRooms, topicNavLabel } from './conv-list.tsx'
import { openWorkbench } from './workbench-overlay.ts'
import { rememberImSeat } from './im-seat.ts'
import { getWorkbenchDomain, setWorkbenchDomain, subscribeWorkbenchDomain, type WorkbenchDomain } from './workbench-domain.ts'
import css from './home.module.css'

export { topicNavLabel }

/** Injected RPC + focus + panel jump for the dock. */
export interface YzjGroupSpaceInjected {
  homeNav: () => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  focusBoundSession?: (sessionId: string) => void
  fetchGroups?: (limit?: number, page?: number) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  homeOpen?: (groupId: string, title?: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  robotStatus?: () => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
}

type DockId = 'chat' | 'todo' | 'calendar' | 'docs'

const DOCK: readonly { id: DockId; label: string; mark: string; hint?: string }[] = [
  { id: 'chat', label: '对话', mark: '对' },
  { id: 'todo', label: '待办', mark: '办' },
  { id: 'calendar', label: '日程', mark: '日' },
  { id: 'docs', label: '知识库', mark: '库' },
]

/**
 * 云之家 dock (R27: injected under New Session). Compact glyphs when the
 * sidebar is a rail.
 */
export function YzjYunzhijiaDock(
  props: { wide: boolean } & YzjGroupSpaceInjected,
) {
  const [hint, setHint] = useState('')
  const [domain, setDomain] = useState<WorkbenchDomain>(getWorkbenchDomain)
  useEffect(() => subscribeWorkbenchDomain(() => { setDomain(getWorkbenchDomain()) }), [])

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

  const onEntry = (id: DockId): void => {
    const domain: WorkbenchDomain = id === 'chat' ? 'im' : id
    setWorkbenchDomain(domain)
    setHint('')
    openWorkbench()
  }

  return (
    <nav
      className={props.wide ? css.yzjDock : css.yzjDockNarrow}
      data-testid="yzj-group-space"
      aria-label="云之家"
    >
      {props.wide && <div className={css.yzjDockHead}>云之家</div>}
      <div className={css.yzjDockEntries}>
        {DOCK.map((entry) => {
          const active = domain === (entry.id === 'chat' ? 'im' : entry.id)
          return (
            <button
              key={entry.id}
              type="button"
              className={`${css.yzjDockEntry} ${active ? css.yzjDockEntryActive : ''}`}
              title={entry.hint ?? entry.label}
              aria-pressed={active}
              data-testid={`yzj-dock-${entry.id}`}
              onClick={() => onEntry(entry.id)}
            >
              {!props.wide && <span className={css.yzjDockMark} aria-hidden="true">{entry.mark}</span>}
              {props.wide && <span className={css.yzjDockLabel}>{entry.label}</span>}
            </button>
          )
        })}
      </div>
      {props.wide && hint !== '' && <p className={css.yzjDockHint}>{hint}</p>}
    </nav>
  )
}

/** @deprecated Slot still uses this name in older tests; prefer {@link YzjYunzhijiaDock}. */
export const YzjGroupSpaceNav = YzjYunzhijiaDock
