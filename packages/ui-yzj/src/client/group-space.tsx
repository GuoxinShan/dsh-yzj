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
import { parseNavRooms, parseRecentGroups, topicNavLabel } from './conv-list.tsx'
import { setWorkbenchDomain, type WorkbenchDomain } from './workbench-domain.ts'
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

type DockId = 'chat' | 'todo' | 'calendar' | 'docs' | 'memory'

const DOCK: readonly { id: DockId; label: string; hint?: string }[] = [
  { id: 'chat', label: '对话' },
  { id: 'todo', label: '待办' },
  { id: 'calendar', label: '日程' },
  { id: 'docs', label: '知识库' },
  { id: 'memory', label: '记忆', hint: '本地 vault，不出本机' },
]

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function robotLine(value: unknown): string {
  const channels = asArray(asRecord(value).channels)
  if (channels.length === 0) return '机器人通道 · 未配置'
  const connected = channels.filter(row => asRecord(row).connected === true).length
  if (connected === 0) return '机器人通道 · 未连接'
  if (connected === channels.length) return channels.length === 1 ? '机器人通道 · 已连接' : `机器人通道 · ${connected} 路已连接`
  return `机器人通道 · ${connected}/${channels.length} 已连接`
}

/**
 * In-flow 云之家 dock in the sidebar foot. Compact glyphs on the collapsed
 * rail so 对话 is still reachable.
 */
export function YzjYunzhijiaDock(
  props: PropsRuntime<'sidebar.footer.action'> & YzjGroupSpaceInjected,
) {
  const [robot, setRobot] = useState('机器人通道 · …')
  const [hint, setHint] = useState('')

  useEffect(() => {
    if (props.robotStatus === undefined) {
      setRobot('机器人通道 · 未配置')
      return
    }
    let cancelled = false
    const load = async (): Promise<void> => {
      const result = await props.robotStatus?.()
      if (cancelled || result === undefined) return
      if (!result.ok) {
        setRobot('机器人通道 · 不可用')
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

  const openChat = async (): Promise<void> => {
    const nav = await props.homeNav()
    if (nav.ok) {
      const rooms = parseNavRooms(nav.value)
      const first = rooms[0]
      if (first !== undefined) {
        props.focusBoundSession?.(first.sessionId)
        return
      }
    }
    if (props.fetchGroups === undefined || props.homeOpen === undefined) {
      setHint('还没有群房间。从侧栏脚「对话」或会话列表挑一个。')
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
    setHint(id === 'memory' ? '记忆是本地 vault，不出本机。' : '')
    void openChat()
  }

  return (
    <nav
      className={props.wide ? css.yzjDock : css.yzjDockNarrow}
      data-testid="yzj-group-space"
      aria-label="云之家"
    >
      {props.wide && <div className={css.yzjDockHead}>云之家</div>}
      <div className={css.yzjDockEntries}>
        {DOCK.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={css.yzjDockEntry}
            title={entry.hint ?? entry.label}
            data-testid={`yzj-dock-${entry.id}`}
            onClick={() => onEntry(entry.id)}
          >
            {props.wide ? entry.label : entry.label.slice(0, 1)}
          </button>
        ))}
      </div>
      {props.wide && <div className={css.yzjDockRobot} data-testid="yzj-dock-robot">{robot}</div>}
      {props.wide && hint !== '' && <p className={css.yzjDockHint}>{hint}</p>}
    </nav>
  )
}

/** @deprecated Slot still uses this name in older tests; prefer {@link YzjYunzhijiaDock}. */
export const YzjGroupSpaceNav = YzjYunzhijiaDock
