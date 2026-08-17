/**
 * Group-room workbench shell (docs/spec/group-room-topics.md §9):
 * conversation list | timeline + topic drawer. The official conversation.view
 * seat stays one slot; this component splits the pane internally.
 */
import { useEffect, useState } from 'react'
import { YzjConvList, type YzjConvListInjected } from './conv-list.tsx'
import { YzjFusedView, type YzjFusedInjected } from './transcript.tsx'
import css from './home.module.css'

/** Injected verbs: fused view plus the session list. */
export interface YzjRoomShellInjected extends YzjFusedInjected, Omit<YzjConvListInjected, 'sessionId' | 'activeGroupId'> {
  readonly sessionId: string
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

/**
 * Two-column group-room canvas. Clicking a list row focuses that room;
 * the drawer is owned by the timeline (never auto-opens from the list).
 */
export function YzjRoomShell(props: YzjRoomShellInjected) {
  const [activeGroupId, setActiveGroupId] = useState('')

  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      const result = await props.homeFused(props.sessionId)
      if (cancelled || !result.ok) return
      const binding = asRecord(asRecord(result.value).binding)
      const groupId = typeof binding.yzjConversationId === 'string' ? binding.yzjConversationId : ''
      setActiveGroupId(groupId)
    }
    void load()
    const timer = window.setInterval(() => { void load() }, 1500)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
    // homeFused is a stable RPC closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.sessionId])

  return (
    <div className={css.roomShell} data-testid="yzj-room-shell">
      <YzjConvList
        sessionId={props.sessionId}
        {...(activeGroupId === '' ? {} : { activeGroupId })}
        homeNav={props.homeNav}
        {...(props.fetchGroups === undefined ? {} : { fetchGroups: props.fetchGroups })}
        {...(props.homeOpen === undefined ? {} : { homeOpen: props.homeOpen })}
        {...(props.focusBoundSession === undefined ? {} : { focusBoundSession: props.focusBoundSession })}
      />
      <YzjFusedView
        sessionId={props.sessionId}
        homeFused={props.homeFused}
        homeBackfill={props.homeBackfill}
        {...(props.homeTopicOpen === undefined ? {} : { homeTopicOpen: props.homeTopicOpen })}
        {...(props.focusBoundSession === undefined ? {} : { focusBoundSession: props.focusBoundSession })}
        {...(props.fetchFileData === undefined ? {} : { fetchFileData: props.fetchFileData })}
        {...(props.fetchContact === undefined ? {} : { fetchContact: props.fetchContact })}
      />
    </div>
  )
}
