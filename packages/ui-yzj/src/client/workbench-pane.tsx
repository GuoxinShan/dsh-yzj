/**
 * Workbench non-IM domains (docs/spec/group-room-topics.md):
 * calendar / docs reuse the embedded panel.
 */
import type { BakedActions } from '@deepseek-ai/dsh-client-ui-slots'
import { YzjPanel } from './panel.tsx'
import type { YzjPanelInject } from './rpc.ts'
import type { YzjPanelActions, YzjPanelState, YzjTab } from './stores.ts'
import type { WorkbenchDomain } from './workbench-domain.ts'

/** Panel store + RPC needed to embed a domain pane. */
export interface YzjDomainWorkbenchInjected {
  readonly domain: Exclude<WorkbenchDomain, 'im'>
  panel: YzjPanelInject
  useStore: <R>(selector: (state: YzjPanelState) => R) => R
  actions: BakedActions<YzjPanelState, YzjPanelActions>
}

const TAB: Record<Exclude<WorkbenchDomain, 'im'>, Exclude<YzjTab, 'chat'>> = {
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
