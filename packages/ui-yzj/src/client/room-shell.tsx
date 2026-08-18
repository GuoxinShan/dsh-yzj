/**
 * Group-room workbench shell (docs/spec/group-room-topics.md §9):
 * conversation list | timeline + topic drawer, or a non-IM domain pane.
 * Top-bar tabs switch domains (R28). The official conversation.view seat
 * stays one slot; this splits internally.
 */
import { useEffect, useState } from 'react'
import type { BakedActions } from '@deepseek-ai/dsh-client-ui-slots'
import { YzjConvList, type YzjConvListInjected } from './conv-list.tsx'
import { cachedRoomGroupId, YzjFusedView, type YzjFusedInjected } from './transcript.tsx'
import type { YzjPanelInject } from './rpc.ts'
import type { YzjPanelActions, YzjPanelState } from './stores.ts'
import { YzjDomainWorkbench } from './workbench-pane.tsx'
import { registerPanelController } from './panel-controller.ts'
import {
  getWorkbenchDomain, setWorkbenchDomain, subscribeWorkbenchDomain,
  WORKBENCH_TABS, type WorkbenchDomain,
} from './workbench-domain.ts'
import { peekImSeat, rememberImSeat } from './im-seat.ts'
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
 * Two-column group-room canvas with a top-bar domain tablist (R28).
 * Clicking a list row switches groupId (R24) — it does not open a DSH
 * session. The drawer is owned by the timeline (never auto-opens from
 * the list). Non-room sessions must not paint this shell (R22 / pitfall-022).
 */
export function YzjRoomShell(props: YzjRoomShellInjected) {
  const isRoom = props.sessionId.startsWith('yzj-home-')
  const [domain, setDomain] = useState<WorkbenchDomain>(getWorkbenchDomain)
  const [activeGroupId, setActiveGroupId] = useState(() => peekImSeat()?.groupId || cachedRoomGroupId(props.sessionId))

  useEffect(() => subscribeWorkbenchDomain(() => { setDomain(getWorkbenchDomain()) }), [])

  useEffect(() => {
    if (!isRoom || props.actions === undefined || props.panel === undefined) return
    return registerPanelController(props.actions, props.panel)
  }, [isRoom, props.actions, props.panel])

  useEffect(() => {
    if (!isRoom) return
    const seated = peekImSeat()?.groupId ?? ''
    if (seated !== '') {
      setActiveGroupId(seated)
      return
    }
    const cached = cachedRoomGroupId(props.sessionId)
    if (cached !== '') setActiveGroupId(cached)
    let cancelled = false
    const load = async (): Promise<void> => {
      if (peekImSeat()?.groupId) return
      const result = await props.homeFused(props.sessionId)
      if (cancelled || !result.ok) return
      const binding = asRecord(asRecord(result.value).binding)
      const groupId = typeof binding.yzjConversationId === 'string' ? binding.yzjConversationId : ''
      if (groupId === '' || peekImSeat()?.groupId) return
      setActiveGroupId(groupId)
      rememberImSeat({ groupId, sessionId: props.sessionId })
    }
    void load()
    return () => { cancelled = true }
    // homeFused is a stable RPC closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRoom, props.sessionId])

  const selectGroup = (groupId: string, groupName?: string): void => {
    setActiveGroupId(groupId)
    rememberImSeat({
      groupId,
      sessionId: props.sessionId,
      ...(groupName === undefined || groupName === '' ? {} : { groupName }),
    })
  }

  if (!isRoom) return null

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
    // data-conversation-composer-overlay: opt into the harness bounded-view
    // contract (ConversationRoot viewArea flex 1 1 0 / overflow hidden) so the
    // columns scroll internally; without it the view grows with content and
    // the composer lands thousands of px below the fold (pitfall-020).
    <div
      className={css.roomShell}
      data-testid="yzj-room-shell"
      data-workbench-domain={domain}
      data-conversation-composer-overlay=""
    >
      <div
        className={css.workbenchTabs}
        role="tablist"
        aria-label="云之家"
        data-testid="yzj-workbench-tabs"
      >
        {WORKBENCH_TABS.map((tab) => {
          const selected = domain === tab.domain
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`${css.workbenchTab} ${selected ? css.workbenchTabActive : ''}`}
              data-testid={`yzj-workbench-tab-${tab.id}`}
              onClick={() => { setWorkbenchDomain(tab.domain) }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      <div className={css.roomShellBody}>
        {domainPane !== null ? (
          <div className={css.roomDomainPane}>{domainPane}</div>
        ) : (
          <>
            <YzjConvList
              sessionId={props.sessionId}
              {...(activeGroupId === '' ? {} : { activeGroupId })}
              homeNav={props.homeNav}
              {...(props.fetchGroups === undefined ? {} : { fetchGroups: props.fetchGroups })}
              onSelectGroup={(row) => { selectGroup(row.groupId, row.groupName) }}
            />
            <YzjFusedView
              sessionId={props.sessionId}
              {...(activeGroupId === '' ? {} : { groupId: activeGroupId })}
              homeFused={props.homeFused}
              homeBackfill={props.homeBackfill}
              {...(props.homeTopicOpen === undefined ? {} : { homeTopicOpen: props.homeTopicOpen })}
              {...(props.homeTopicLens === undefined ? {} : { homeTopicLens: props.homeTopicLens })}
              {...(props.homeTopicAsk === undefined ? {} : { homeTopicAsk: props.homeTopicAsk })}
              {...(props.focusBoundSession === undefined ? {} : { focusBoundSession: props.focusBoundSession })}
              {...(props.fetchFileData === undefined ? {} : { fetchFileData: props.fetchFileData })}
              {...(props.fetchContact === undefined ? {} : { fetchContact: props.fetchContact })}
            />
          </>
        )}
      </div>
    </div>
  )
}
