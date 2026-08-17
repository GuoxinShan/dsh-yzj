/**
 * Group-room workbench shell (docs/spec/group-room-topics.md §9):
 * conversation list | timeline + topic drawer, or a non-IM domain pane.
 * The official conversation.view seat stays one slot; this splits internally.
 */
import { useEffect, useState } from 'react'
import type { BakedActions } from '@deepseek-ai/dsh-client-ui-slots'
import { YzjConvList, type YzjConvListInjected } from './conv-list.tsx'
import { YzjFusedView, type YzjFusedInjected } from './transcript.tsx'
import type { YzjPanelInject } from './rpc.ts'
import type { YzjPanelActions, YzjPanelState } from './stores.ts'
import { YzjDomainWorkbench } from './workbench-pane.tsx'
import { registerPanelController } from './panel-controller.ts'
import {
  getWorkbenchDomain, subscribeWorkbenchDomain, type WorkbenchDomain,
} from './workbench-domain.ts'
import css from './home.module.css'

/** Injected verbs: fused view plus the session list. */
export interface YzjRoomShellInjected extends YzjFusedInjected, Omit<YzjConvListInjected, 'sessionId' | 'activeGroupId'> {
  readonly sessionId: string
  panel?: YzjPanelInject
  useStore?: <R>(selector: (state: YzjPanelState) => R) => R
  actions?: BakedActions<YzjPanelState, YzjPanelActions>
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

/**
 * Two-column group-room canvas. Clicking a list row focuses that room;
 * the drawer is owned by the timeline (never auto-opens from the list).
 */
export function YzjRoomShell(props: YzjRoomShellInjected) {
  const [domain, setDomain] = useState<WorkbenchDomain>(getWorkbenchDomain)
  const [activeGroupId, setActiveGroupId] = useState('')

  useEffect(() => subscribeWorkbenchDomain(() => { setDomain(getWorkbenchDomain()) }), [])

  useEffect(() => {
    if (props.actions === undefined || props.panel === undefined) return
    return registerPanelController(props.actions, props.panel)
  }, [props.actions, props.panel])

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

  const domainPane = domain !== 'im'
    && props.panel !== undefined
    && props.useStore !== undefined
    && props.actions !== undefined
    ? (
      <YzjDomainWorkbench
        domain={domain}
        panel={props.panel}
        useStore={props.useStore}
        actions={props.actions}
      />
    )
    : null

  return (
    <div className={css.roomShell} data-testid="yzj-room-shell">
      {domainPane !== null ? domainPane : (
        <>
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
        </>
      )}
    </div>
  )
}
