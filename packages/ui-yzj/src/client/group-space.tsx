/**
 * Sidebar-foot 云之家 entry dock (docs/spec/group-room-topics.md R15).
 * Five domain entries + robot status. 对话 focuses a bound room (or binds
 * the first recent conversation); other domains switch the workbench pane
 * (P2) after focusing a room so conversation.view is mounted.
 */
import { useEffect, useState } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { bindAndFocusGroup } from './home-focus.ts'
import { parseNavRooms, parseRecentGroups, peekConvListHold, topicNavLabel } from './conv-list.tsx'
import { peekImSeat, rememberImSeat } from './im-seat.ts'
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

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function robotLine(value: unknown): string {
  const channels = asArray(asRecord(value).channels)
  if (channels.length === 0) return '未配置'
  const connected = channels.filter(row => asRecord(row).connected === true).length
  if (connected === 0) return '未连接'
  if (connected === channels.length) return channels.length === 1 ? '已连接' : `${connected} 路已连接`
  return `${connected}/${channels.length} 已连接`
}

/** Status-dot tone for the robot line: ok = all connected, warn = some/off, off = unconfigured. */
type RobotTone = 'ok' | 'warn' | 'off'

function robotTone(line: string): RobotTone {
  if (line.includes('已连接') && !line.includes('未连接')) return line.includes('/') ? 'warn' : 'ok'
  if (line.includes('未配置') || line.includes('不可用')) return 'off'
  return 'warn'
}

function currentSessionId(props: { useSessions?: (select: (state: { current?: string }) => string) => string }): string {
  if (props.useSessions === undefined) return ''
  return props.useSessions(state => typeof state.current === 'string' ? state.current : '')
}

/**
 * In-flow 云之家 dock in the sidebar foot. Compact glyphs on the collapsed
 * rail so 对话 is still reachable.
 */
export function YzjYunzhijiaDock(
  props: PropsRuntime<'sidebar.footer.action'> & YzjGroupSpaceInjected,
) {
  const [robot, setRobot] = useState('…')
  const [hint, setHint] = useState('')
  const [domain, setDomain] = useState<WorkbenchDomain>(getWorkbenchDomain)
  const currentId = currentSessionId(props)

  useEffect(() => subscribeWorkbenchDomain(() => { setDomain(getWorkbenchDomain()) }), [])

  useEffect(() => {
    if (props.robotStatus === undefined) {
      setRobot('未配置')
      return
    }
    let cancelled = false
    const load = async (): Promise<void> => {
      const result = await props.robotStatus?.()
      if (cancelled || result === undefined) return
      if (!result.ok) {
        setRobot('不可用')
        return
      }
      setRobot(robotLine(result.value))
    }
    void load()
    const timer = window.setInterval(() => { void load() }, 4000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
    // robotStatus is a stable RPC closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const focusSeat = (groupId: string, sessionId: string, groupName?: string): void => {
    if (sessionId !== '') props.focusBoundSession?.(sessionId)
    if (props.homeOpen !== undefined && groupId !== '') {
      void bindAndFocusGroup(props.homeOpen, props.focusBoundSession, groupId, groupName)
    }
  }

  const openChat = async (): Promise<void> => {
    if (currentId.startsWith('yzj-home-')) return

    const cached = peekImSeat()
    if (cached !== undefined) {
      focusSeat(cached.groupId, cached.sessionId, cached.groupName)
      return
    }
    const held = peekConvListHold()?.bound[0]
    if (held !== undefined) {
      focusSeat(held.groupId, held.sessionId, held.groupName)
      return
    }

    const nav = await props.homeNav()
    if (nav.ok) {
      const first = parseNavRooms(nav.value)[0]
      if (first !== undefined) {
        if (props.homeOpen === undefined) {
          props.focusBoundSession?.(first.sessionId)
          return
        }
        void bindAndFocusGroup(props.homeOpen, props.focusBoundSession, first.groupId, first.groupName)
        return
      }
    }
    if (props.fetchGroups === undefined || props.homeOpen === undefined) {
      setHint('还没有群聊。从侧栏脚「对话」或会话列表挑一个。')
      return
    }
    const recent = await props.fetchGroups(20, 1)
    if (!recent.ok) {
      setHint(recent.error.message)
      return
    }
    const first = parseRecentGroups(recent.value).rooms[0]
    if (first === undefined) {
      setHint('还没有最近会话。')
      return
    }
    void bindAndFocusGroup(props.homeOpen, props.focusBoundSession, first.groupId, first.groupName)
  }

  const onEntry = (id: DockId): void => {
    const domain: WorkbenchDomain = id === 'chat' ? 'im' : id
    setWorkbenchDomain(domain)
    setHint('')
    void openChat()
  }

  const tone = robotTone(robot)
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
      {props.wide && (
        <div className={css.yzjDockRobot} data-testid="yzj-dock-robot" title={`机器人 ${robot}`}>
          <span
            className={`${css.yzjDockRobotDot} ${tone === 'ok' ? css.yzjDockRobotDotOk : tone === 'warn' ? css.yzjDockRobotDotWarn : ''}`}
            aria-hidden="true"
          />
        </div>
      )}
      {props.wide && hint !== '' && <p className={css.yzjDockHint}>{hint}</p>}
    </nav>
  )
}

/** @deprecated Slot still uses this name in older tests; prefer {@link YzjYunzhijiaDock}. */
export const YzjGroupSpaceNav = YzjYunzhijiaDock
