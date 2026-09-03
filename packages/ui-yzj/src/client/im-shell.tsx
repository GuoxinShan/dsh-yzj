/**
 * Center IM shell occupying conversation / conversation.view.
 */
import { useEffect, useState } from 'react'
import { useSyncExternalStore } from 'react'
import type { ComposerChainProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { YzjPanelInject } from './rpc.ts'
import { createYzjStore, type YzjPanelState } from './stores.ts'
import { YzjInbox } from './inbox.tsx'
import { YzjAssistantDm } from './assistant-dm.tsx'
import { YzjGroupRoom } from './group-room.tsx'
import { YzjProcessPeek } from './process-peek.tsx'
import { YzjDomainWorkbench } from './workbench-pane.tsx'
import { getImPane, getImSelection, markImOccupancy, setImPane, subscribeImSelection } from './im-nav.ts'
import { registerPanelController } from './panel-controller.ts'
import type { WriteCardInjected } from './write-card.tsx'
import { watchHostChrome } from './host-chrome.ts'
import css from './shell.module.css'

function useStoreOf(store: { getSnapshot: () => YzjPanelState; subscribe: (fn: () => void) => () => void }) {
  return function useStore<R>(selector: (state: YzjPanelState) => R): R {
    return useSyncExternalStore(
      store.subscribe,
      () => selector(store.getSnapshot()),
      () => selector(store.getSnapshot()),
    )
  }
}

export function YzjImShell(props: {
  panel: YzjPanelInject
  writeInject: WriteCardInjected
  /** Occupying sidebar.workspaces — inbox is a sibling, not nested. */
  mode: 'inbox' | 'conversation'
}) {
  const [sel, setSel] = useState(getImSelection)
  const [pane, setPane] = useState(getImPane)
  const [store] = useState(() => createYzjStore().create())
  const useStore = useStoreOf(store)

  useEffect(() => markImOccupancy(), [])
  useEffect(() => subscribeImSelection(() => {
    setSel(getImSelection())
    setPane(getImPane())
  }), [])
  useEffect(() => registerPanelController(store.actions, props.panel), [props.panel, store.actions])

  if (props.mode === 'inbox') {
    return <YzjInbox panel={props.panel} />
  }

  if (pane === 'calendar' || pane === 'docs') {
    return (
      <div className={css.shell} data-testid="yzj-im-pane">
        <header className={css.header} data-yzj-im-header="">
          <button type="button" className={css.back} onClick={() => setImPane('')}>← 返回</button>
          <div className={css.headerTitle}>{pane === 'calendar' ? '日程' : '知识库'}</div>
        </header>
        <div className={css.pane}>
          <YzjDomainWorkbench
            domain={pane}
            panel={props.panel}
            useStore={useStore}
            actions={store.actions}
          />
        </div>
      </div>
    )
  }

  if (sel.kind === 'peek') {
    return (
      <YzjProcessPeek
        assistantId={sel.assistantId}
        panel={props.panel}
        {...(sel.groupId === undefined ? {} : { groupId: sel.groupId })}
        {...(sel.groupName === undefined ? {} : { groupName: sel.groupName })}
      />
    )
  }
  if (sel.kind === 'group') {
    return (
      <YzjGroupRoom
        groupId={sel.groupId}
        groupName={sel.groupName ?? ''}
        panel={props.panel}
        defaultAssistantId="default"
      />
    )
  }
  return (
    <YzjAssistantDm
      assistantId={sel.assistantId}
      panel={props.panel}
      writeInject={props.writeInject}
      onOpenPane={setImPane}
    />
  )
}

/** Conversation-view occupant: host session props are unused (IM selection bus). */
export function YzjConversationSlot(props: {
  panel: YzjPanelInject
  writeInject: WriteCardInjected
}) {
  return <YzjImShell mode="conversation" panel={props.panel} writeInject={props.writeInject} />
}

/** Bind panel/write into a slot component (conversation.view has no inject face). */
export function bindImConversationView(panel: YzjPanelInject, writeInject: WriteCardInjected) {
  return function YzjImConversationView() {
    return <YzjConversationSlot panel={panel} writeInject={writeInject} />
  }
}

/** Chain select: hide the official InputBar while the IM shell owns the center. */
export function selectImComposer({ interactions }: ComposerChainProps): { im: true } | null {
  if (interactions.some(item => item.kind === 'approval' || item.kind === 'question')) return null
  return { im: true }
}

/** Collapse the official composer seat; the IM shell draws its own. */
export function YzjHideHostComposer() {
  useEffect(() => watchHostChrome(), [])
  return null
}
