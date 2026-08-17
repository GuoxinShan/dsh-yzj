/**
 * Workbench non-IM domains (docs/spec/group-room-topics.md §9 P2):
 * todo / calendar / docs reuse the embedded panel; memory is the local vault.
 */
import { useEffect, useState } from 'react'
import type { BakedActions } from '@deepseek-ai/dsh-client-ui-slots'
import { MemoryPane } from './memory-pane.tsx'
import { YzjPanel } from './panel.tsx'
import type { YzjPanelInject } from './rpc.ts'
import type { YzjPanelActions, YzjPanelState, YzjTab } from './stores.ts'
import type { WorkbenchDomain } from './workbench-domain.ts'
import css from './home.module.css'

type Rpc = { ok: true; value: unknown } | { ok: false; error: { message: string } }

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

/** Panel store + RPC needed to embed a domain pane. */
export interface YzjDomainWorkbenchInjected {
  readonly domain: Exclude<WorkbenchDomain, 'im'>
  panel: YzjPanelInject
  useStore: <R>(selector: (state: YzjPanelState) => R) => R
  actions: BakedActions<YzjPanelState, YzjPanelActions>
}

const TAB: Record<Exclude<WorkbenchDomain, 'im' | 'memory'>, Exclude<YzjTab, 'chat'>> = {
  todo: 'todo',
  calendar: 'calendar',
  docs: 'docs',
}

/**
 * Right-of-list workbench content for a non-IM domain.
 */
export function YzjDomainWorkbench(props: YzjDomainWorkbenchInjected) {
  if (props.domain === 'memory') {
    return <MemoryWorkbench panel={props.panel} />
  }
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

function MemoryWorkbench(props: { panel: YzjPanelInject }) {
  const face = props.panel
  const [view, setView] = useState<unknown>(undefined)
  const [log, setLog] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchMemory = async (): Promise<void> => {
    setLoading(true)
    const [scope, tail] = await Promise.all([face.memoryScope(), face.memoryLog()])
    if (!scope.ok) {
      setError(scope.error.message)
      setLoading(false)
      return
    }
    setView(asRecord(scope.value).view)
    setLog(tail.ok ? String(asRecord(tail.value).log ?? '') : '')
    setError('')
    setLoading(false)
  }

  useEffect(() => {
    void fetchMemory()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- RPC face is stable
  }, [])

  const wrap = async (run: () => Promise<Rpc>, after?: () => Promise<void>): Promise<Rpc> => {
    const result = await run()
    if (after !== undefined) await after()
    return result
  }

  return (
    <div className={css.roomMain} data-testid="yzj-workbench-memory">
      <div className={css.roomMainHead}>
        <span>记忆</span>
        <span className={css.hint}>本地 vault，不出本机</span>
      </div>
      <MemoryPane
        view={view}
        log={log}
        loading={loading}
        error={error}
        memoryScope={async () => wrap(face.memoryScope, fetchMemory)}
        memoryLog={async () => wrap(face.memoryLog, fetchMemory)}
        memoryObserve={(content, tags, durable) => face.memoryObserve(content, tags, undefined, durable)}
        dreamState={() => face.dreamState()}
        dreamSet={partial => face.dreamSet(partial)}
        dreamRun={async () => wrap(face.dreamRun, fetchMemory)}
        modelDefault={() => face.modelDefault()}
        modelSetDefault={(provider, model) => face.modelSetDefault(provider, model)}
        modelClearDefault={() => face.modelClearDefault()}
        modelCatalog={() => face.modelCatalog()}
      />
    </div>
  )
}
