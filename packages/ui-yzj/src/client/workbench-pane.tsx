/**
 * Workbench non-IM domains (docs/spec/group-room-topics.md §9 P2 / R21):
 * todo / calendar / docs reuse the embedded panel. Memory is deferred.
 */
import type { BakedActions } from '@deepseek-ai/dsh-client-ui-slots'
import { YzjPanel } from './panel.tsx'
import type { YzjPanelInject } from './rpc.ts'
import type { YzjPanelActions, YzjPanelState, YzjTab } from './stores.ts'
import type { WorkbenchDomain } from './workbench-domain.ts'

/** Panel store + RPC needed to embed a domain pane.
 * `advance` is NOT embedded here — the board owns its own data loop and is
 * mounted directly by the room shell (ai-advance-design §7). */
export interface YzjDomainWorkbenchInjected {
  readonly domain: Exclude<WorkbenchDomain, 'im' | 'advance'>
  panel: YzjPanelInject
  useStore: <R>(selector: (state: YzjPanelState) => R) => R
  actions: BakedActions<YzjPanelState, YzjPanelActions>
}

const TAB: Record<Exclude<WorkbenchDomain, 'im' | 'advance'>, Exclude<YzjTab, 'chat'>> = {
  todo: 'todo',
  calendar: 'calendar',
  docs: 'docs',
}

/**
 * Right-of-list workbench content for a non-IM domain.
 */
export function YzjDomainWorkbench(props: YzjDomainWorkbenchInjected) {
  return (
    <YzjPanel
      {...props.panel}
      useStore={props.useStore}
      actions={props.actions}
      embedded
      forceTab={TAB[props.domain]}
    />
  )
}
