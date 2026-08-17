/**
 * Panel controller bridge: the shell slots bind their OWN store instance
 * (per handle × scope key) — `store.create()` in apply() is a different
 * instance, so mutating it never reaches the mounted panel. The panel
 * component therefore registers its slot-bound actions + inject face here on
 * mount; cards (查看 jump) and the write-card 查看上下文 drive the REAL
 * panel through this bridge.
 */
import type { BakedActions } from '@deepseek-ai/dsh-client-ui-slots'
import type { YzjPanelActions, YzjPanelState } from './stores.ts'
import type { YzjPanelInject } from './rpc.ts'
import type { YzjJumpTarget } from './cards.tsx'
import { bindAndFocusGroup } from './home-focus.ts'
import { setWorkbenchDomain } from './workbench-domain.ts'

type PanelActions = BakedActions<YzjPanelState, YzjPanelActions>

interface PanelController {
  actions: PanelActions
  inject: YzjPanelInject
}

let controller: PanelController | null = null

/** Mount the live panel controller; returns the disposer. */
export function registerPanelController(actions: PanelActions, inject: YzjPanelInject): () => void {
  controller = { actions, inject }
  return () => {
    if (controller?.actions === actions) controller = null
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * Open the real panel focused on one item (card 查看详情). Group/workspace
 * jumps prefetch their windows; doc jumps set docId (the panel fetches the
 * preview); event jumps re-target the calendar cursor and prefetch the
 * month. An optional anchor scrolls to one message after the group loads.
 */
export function openPanelTarget(target: YzjJumpTarget, anchorMsgId?: string): void {
  const c = controller
  if (target.kind === 'group') {
    setWorkbenchDomain('im')
  } else if (target.kind === 'todo') {
    setWorkbenchDomain('todo')
  } else if (target.kind === 'doc' || target.kind === 'workspace') {
    setWorkbenchDomain('docs')
  } else {
    setWorkbenchDomain('calendar')
  }
  if (c === null) return
  const actions = c.actions
  actions.setOpen(true)
  actions.setError('')
  actions.setAnchorMsgId(anchorMsgId ?? '')
  if (target.kind === 'group') {
    actions.setTab('chat')
    actions.setGroupId(target.groupId)
    void bindAndFocusGroup(c.inject.homeOpen, c.inject.focusBoundSession, target.groupId)
    void c.inject.fetchMessages(target.groupId, 20).then((result) => {
      if (!result.ok) return
      const list = asArray(asRecord(result.value).list)
      actions.setMessages(list)
      actions.setMessagesMore(asRecord(result.value).more === true)
      actions.setMessagesAnchor(list.length > 0 ? asString(asRecord(list[0]).msgId) : '')
    })
  } else if (target.kind === 'doc') {
    actions.setTab('docs')
    actions.setDocId(target.docId)
  } else if (target.kind === 'workspace') {
    actions.setTab('docs')
    actions.setWorkspaceId(target.workspaceId)
    void c.inject.fetchDocs(target.workspaceId).then((result) => {
      if (result.ok) actions.setDocs(asArray(result.value))
    })
  } else if (target.kind === 'todo') {
    actions.setTab('todo')
    void c.inject.todoState().then((result) => {
      if (!result.ok) return
      const value = asRecord(result.value)
      const library = asRecord(value.library)
      actions.setTodoState(
        asArray(value.todos),
        value.ready === true,
        typeof library.link === 'string' ? library.link : '',
      )
      actions.setTodoLibraries([], typeof value.activeDocId === 'string' ? value.activeDocId : '')
    })
  } else {
    actions.setTab('calendar')
    // A zero startDate (fallback from write-card jumps) keeps the current month.
    const date = target.event.startDate > 0 ? new Date(target.event.startDate) : new Date()
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const pad = (n: number): string => String(n).padStart(2, '0')
    actions.setCalCursor(year, month)
    actions.setCalDay(`${year}-${pad(month)}-${pad(date.getDate())}`)
    actions.setCalEventId(target.event.id)
    void c.inject.fetchEvents(`${year}-${pad(month)}-01`, `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`).then((result) => {
      if (result.ok) actions.setCalEvents(asArray(result.value))
    })
  }
}
