/**
 * Mount the Yunzhijia workbench as a center-column cover (R27).
 * The conversation subtree stays mounted underneath; CSS hides it while
 * `html[data-dsh-yzj-active]` is set.
 */
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { useSyncExternalStore } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { createYzjStore, type YzjPanelState } from './stores.ts'
import { YzjRoomShell } from './room-shell.tsx'
import { YzjRoomComposer } from './room-composer.tsx'
import {
  bindWorkbenchDismissal, isWorkbenchOpen, subscribeWorkbenchOpen,
} from './workbench-overlay.ts'
import type { YzjPanelInject } from './rpc.ts'
import './overlay.module.css'

const VIEW_ATTR = 'data-dsh-yzj-view'
const COLUMN_SELECTOR = '[data-pane="conversation"], [class*="centerCol"]'

function conversationColumn(): HTMLElement | undefined {
  return document.querySelector<HTMLElement>(COLUMN_SELECTOR) ?? undefined
}

/** Injected RPC + focus used by the overlay tree. */
export interface WorkbenchMountInject extends YzjPanelInject {
  focusBoundSession?: (sessionId: string) => void
}

/**
 * Append the cover into the center column and keep it alive across shell
 * remounts. Returns the disposer.
 */
function useStoreOf(store: { getSnapshot: () => YzjPanelState; subscribe: (fn: () => void) => () => void }) {
  return function useStore<R>(selector: (state: YzjPanelState) => R): R {
    return useSyncExternalStore(
      store.subscribe,
      () => selector(store.getSnapshot()),
      () => selector(store.getSnapshot()),
    )
  }
}

export function mountWorkbench(panel: WorkbenchMountInject): () => void {
  const store = createYzjStore().create()
  const useStore = useStoreOf(store)
  let root: Root | undefined
  let container: HTMLDivElement | undefined

  const paint = (): void => {
    if (container === undefined || root === undefined) return
    // R27 overlay has no hanger session; rc.7 composer props still want a branded id.
    // R27 overlay has no hanger session; rc.7 composer props still want a branded id.
    const sessionId = '' as SessionId as SessionId
    root.render(
      <>
        <YzjRoomShell
          overlay
          sessionId={sessionId}
          homeFused={(id, groupId) => panel.homeFused?.(id, groupId) ?? Promise.resolve({ ok: false as const, error: { message: 'homeFused unavailable' } })}
          homeBackfill={(id, opts) => panel.homeBackfill?.(id, opts) ?? Promise.resolve({ ok: false as const, error: { message: 'homeBackfill unavailable' } })}
          homeNav={() => panel.homeNav?.() ?? Promise.resolve({ ok: false as const, error: { message: 'homeNav unavailable' } })}
          fetchGroups={(limit, page) => panel.fetchGroups(limit, page)}
          authStatus={() => panel.authStatus()}
          authLogin={() => panel.authLogin()}
          homeTopicOpen={input => panel.homeTopicOpen?.(input) ?? Promise.resolve({ ok: false as const, error: { message: 'homeTopicOpen unavailable' } })}
          homeTopicLens={id => panel.homeTopicLens?.(id) ?? Promise.resolve({ ok: false as const, error: { message: 'homeTopicLens unavailable' } })}
          homeTopicAsk={(id, text) => panel.homeTopicAsk?.(id, text) ?? Promise.resolve({ ok: false as const, error: { message: 'homeTopicAsk unavailable' } })}
          {...(panel.focusBoundSession === undefined ? {} : { focusBoundSession: panel.focusBoundSession })}
          fetchFileData={panel.fetchFileData}
          fetchContact={panel.fetchContact}
          panel={panel}
          useStore={useStore}
          actions={store.actions}
        />
        <YzjRoomComposer
          standalone
          sessionId={sessionId}
          homeSend={(id, content, opts) => panel.homeSend?.(id, content, opts) ?? Promise.resolve({ ok: false as const, error: { message: 'homeSend unavailable' } })}
          uploadFile={panel.uploadFile}
          homeFused={(id, groupId) => panel.homeFused?.(id, groupId) ?? Promise.resolve({ ok: false as const, error: { message: 'homeFused unavailable' } })}
          fetchContact={panel.fetchContact}
        />
      </>,
    )
  }

  const ensure = (): void => {
    if (container !== undefined) {
      if (!document.body.contains(container)) {
        container = undefined
        root?.unmount()
        root = undefined
      } else {
        return
      }
    }
    const column = conversationColumn()
    if (column === undefined) return
    container = document.createElement('div')
    container.setAttribute(VIEW_ATTR, '')
    container.dataset.testid = 'yzj-workbench-overlay'
    column.appendChild(container)
    root = createRoot(container)
    paint()
  }

  const wait = new MutationObserver(() => { ensure() })
  wait.observe(document.body, { childList: true, subtree: true })
  const offOpen = subscribeWorkbenchOpen(() => { ensure() })
  const offDismiss = bindWorkbenchDismissal()
  if (isWorkbenchOpen()) ensure()
  else ensure()

  return () => {
    wait.disconnect()
    offOpen()
    offDismiss()
    root?.unmount()
    root = undefined
    container?.remove()
    container = undefined
  }
}
