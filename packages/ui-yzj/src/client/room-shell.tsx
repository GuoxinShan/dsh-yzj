/**
 * Group-room workbench shell (docs/spec/group-room-topics.md §9 / v1.16):
 * page tabs + conversation list | timeline, or a non-IM domain pane.
 * The official conversation.view seat stays one slot; this splits internally.
 */
import { useEffect, useState } from 'react'
import type { BakedActions } from '@deepseek-ai/dsh-client-ui-slots'
import { YzjConvList, type YzjConvListInjected } from './conv-list.tsx'
import { YzjLoginBanner } from './login-banner.tsx'
import { cachedRoomGroupId, YzjFusedView, type YzjFusedInjected } from './transcript.tsx'
import type { YzjPanelInject } from './rpc.ts'
import type { YzjPanelActions, YzjPanelState } from './stores.ts'
import { YzjDomainWorkbench } from './workbench-pane.tsx'
import { YzjAdvancePane } from './advance-pane.tsx'
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
  /** R27 cover: paint without a `yzj-home-*` hanger session. */
  overlay?: boolean
  panel?: YzjPanelInject
  useStore?: <R>(selector: (state: YzjPanelState) => R) => R
  actions?: BakedActions<YzjPanelState, YzjPanelActions>
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

/**
 * Two-column group-room canvas. Clicking a list row switches groupId
 * (R24) — it does not open a DSH session. Overlay mode (R27) paints
 * without a hanger session. Slot mode still refuses non-`yzj-home-*`.
 */
export function YzjRoomShell(props: YzjRoomShellInjected) {
  const isRoom = props.overlay === true || props.sessionId.startsWith('yzj-home-')
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

  // The advance board owns its own data loop (no panel store); other non-IM
  // domains embed the panel with a forced tab.
  const domainPane = domain === 'advance' && props.panel !== undefined
    ? <YzjAdvancePane inject={props.panel} />
    : domain !== 'im' && domain !== 'advance'
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
      <div className={css.pageTabs} role="tablist" aria-label="云之家" data-testid="yzj-workbench-tabs">
        {WORKBENCH_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={domain === tab.domain}
            className={domain === tab.domain ? `${css.pageTab} ${css.pageTabOn}` : css.pageTab}
            data-testid={`yzj-workbench-tab-${tab.id}`}
            onClick={() => { setWorkbenchDomain(tab.domain) }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {domainPane !== null ? (
        <div className={css.roomMain}>
          {props.authStatus !== undefined && props.authLogin !== undefined && (
            <YzjLoginBanner authStatus={props.authStatus} authLogin={props.authLogin} compact />
          )}
          {domainPane}
        </div>
      ) : (
        <div className={css.pageBody}>
          <YzjConvList
            sessionId={props.sessionId}
            {...(activeGroupId === '' ? {} : { activeGroupId })}
            homeNav={props.homeNav}
            {...(props.fetchGroups === undefined ? {} : { fetchGroups: props.fetchGroups })}
            {...(props.authStatus === undefined ? {} : { authStatus: props.authStatus })}
            {...(props.authLogin === undefined ? {} : { authLogin: props.authLogin })}
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
        </div>
      )}
    </div>
  )
}
