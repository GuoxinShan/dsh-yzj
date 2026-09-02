/**
 * The Yunzhijia panel's viewing store: open state, active tab, fetched data
 * per tab, drill-down selection, loading/error flags. Module level exports
 * the factory only (a module-level handle would pin store identity across
 * plugin reloads); the two registrations share the factory's handle.
 */
import type { EngineStoreHandle } from '@deepseek-ai/dsh-client-store'

type DefineStore = typeof import('@deepseek-ai/dsh-client-store').defineStore

/**
 * 0.1.2 seeds `@deepseek-ai/dsh-client-store`; 0.1.1 answers the same
 * engine at `@deepseek-ai/dsh-client-runtime/client`. A static import of
 * either specifier crashes the other runtime (client-modules require miss).
 * The client factory injects `require`; keep the calls here so the bundle
 * resolves against the shell table instead of inlining a second engine.
 */
function resolveDefineStore(): DefineStore {
  const req = require as (spec: string) => { defineStore: DefineStore }
  try {
    return req('@deepseek-ai/dsh-client-store').defineStore
  } catch {
    return req('@deepseek-ai/dsh-client-runtime/client').defineStore
  }
}

const defineStore = resolveDefineStore()

/** Panel tabs (运营性内容 only — 机器人/记忆管理页在 设置 → 云之家). */
export type YzjTab = 'docs' | 'calendar' | 'chat'
/** Yunzhijia panel viewing state (raw CLI payloads, rendered by components). */
export type YzjPanelState = {
  open: boolean
  tab: YzjTab
  /** Floating-window position (CSS px, viewport-relative). */
  panelX: number
  panelY: number
  workspaces: unknown[]
  workspaceId: string
  docs: unknown[]
  /** Doc opened in the right pane preview (docs tab). */
  docId: string
  events: unknown[]
  /** Calendar cursor: visible month + selected day + month events. */
  calYear: number
  calMonth: number
  calDay: string
  calEvents: unknown[]
  /** Selected event for the right-pane detail. */
  calEventId: string
  groups: unknown[]
  groupsPage: number
  groupsMore: boolean
  groupId: string
  messages: unknown[]
  messagesMore: boolean
  messagesAnchor: string
  /** Message to scroll to and highlight after the group loads (jump anchor). */
  anchorMsgId: string
  /** Sum of unread counts across recent sessions (the floating-ball badge). */
  unreadTotal: number
  loading: boolean
  error: string
}

/** Annotation twin of the actions literal below. */
export type YzjPanelActions = {
  setOpen: (draft: YzjPanelState, open: boolean) => void
  setTab: (draft: YzjPanelState, tab: YzjTab) => void
  setPanelPosition: (draft: YzjPanelState, x: number, y: number) => void
  setWorkspaces: (draft: YzjPanelState, workspaces: unknown[]) => void
  setWorkspaceId: (draft: YzjPanelState, id: string) => void
  setDocs: (draft: YzjPanelState, docs: unknown[]) => void
  setDocId: (draft: YzjPanelState, id: string) => void
  setEvents: (draft: YzjPanelState, events: unknown[]) => void
  setCalCursor: (draft: YzjPanelState, year: number, month: number) => void
  setCalDay: (draft: YzjPanelState, day: string) => void
  setCalEvents: (draft: YzjPanelState, events: unknown[]) => void
  setCalEventId: (draft: YzjPanelState, id: string) => void
  setGroups: (draft: YzjPanelState, groups: unknown[]) => void
  setGroupsPage: (draft: YzjPanelState, page: number) => void
  setGroupsMore: (draft: YzjPanelState, more: boolean) => void
  appendGroups: (draft: YzjPanelState, groups: unknown[]) => void
  setGroupId: (draft: YzjPanelState, id: string) => void
  setMessages: (draft: YzjPanelState, messages: unknown[]) => void
  setMessagesMore: (draft: YzjPanelState, more: boolean) => void
  setMessagesAnchor: (draft: YzjPanelState, anchor: string) => void
  prependMessages: (draft: YzjPanelState, messages: unknown[]) => void
  appendMessages: (draft: YzjPanelState, messages: unknown[]) => void
  setAnchorMsgId: (draft: YzjPanelState, id: string) => void
  setUnreadTotal: (draft: YzjPanelState, total: number) => void
  setLoading: (draft: YzjPanelState, loading: boolean) => void
  setError: (draft: YzjPanelState, error: string) => void
}

/** Create the Yunzhijia panel store handle. */
export function createYzjStore(): EngineStoreHandle<YzjPanelState, YzjPanelActions> {
  const handle = defineStore({
    init: (): YzjPanelState => ({
      open: false,
      tab: 'docs',
      panelX: -1,
      panelY: -1,
      workspaces: [],
      workspaceId: '',
      docs: [],
      docId: '',
      events: [],
      calYear: new Date().getFullYear(),
      calMonth: new Date().getMonth() + 1,
      calDay: '',
      calEvents: [],
      calEventId: '',
      groups: [],
      groupsPage: 1,
      groupsMore: false,
      groupId: '',
      messages: [],
      messagesMore: false,
      messagesAnchor: '',
      anchorMsgId: '',
      unreadTotal: 0,
      loading: true,
      error: '',
    }),
    persist: 'dsh.yzj.panel.v6',
    actions: {
      setOpen: (d: YzjPanelState, open: boolean) => { d.open = open },
      setTab: (d: YzjPanelState, tab: YzjTab) => { d.tab = tab },
      setPanelPosition: (d: YzjPanelState, x: number, y: number) => { d.panelX = x; d.panelY = y },
      setWorkspaces: (d: YzjPanelState, workspaces: unknown[]) => { d.workspaces = workspaces },
      setWorkspaceId: (d: YzjPanelState, id: string) => { d.workspaceId = id },
      setDocs: (d: YzjPanelState, docs: unknown[]) => { d.docs = docs },
      setDocId: (d: YzjPanelState, id: string) => { d.docId = id },
      setEvents: (d: YzjPanelState, events: unknown[]) => { d.events = events },
      setCalCursor: (d: YzjPanelState, year: number, month: number) => { d.calYear = year; d.calMonth = month },
      setCalDay: (d: YzjPanelState, day: string) => { d.calDay = day },
      setCalEvents: (d: YzjPanelState, events: unknown[]) => { d.calEvents = events },
      setCalEventId: (d: YzjPanelState, id: string) => { d.calEventId = id },
      setGroups: (d: YzjPanelState, groups: unknown[]) => { d.groups = groups },
      setGroupsPage: (d: YzjPanelState, page: number) => { d.groupsPage = page },
      setGroupsMore: (d: YzjPanelState, more: boolean) => { d.groupsMore = more },
      appendGroups: (d: YzjPanelState, groups: unknown[]) => {
        const seen = new Set(d.groups.map(group => String(asRecord(group).groupId)))
        d.groups = [...d.groups, ...groups.filter(group => !seen.has(String(asRecord(group).groupId)))]
      },
      setGroupId: (d: YzjPanelState, id: string) => { d.groupId = id },
      setMessages: (d: YzjPanelState, messages: unknown[]) => { d.messages = messages },
      setMessagesMore: (d: YzjPanelState, more: boolean) => { d.messagesMore = more },
      setMessagesAnchor: (d: YzjPanelState, anchor: string) => { d.messagesAnchor = anchor },
      prependMessages: (d: YzjPanelState, messages: unknown[]) => {
        const seen = new Set(d.messages.map(message => String(asRecord(message).msgId)))
        d.messages = [...messages.filter(message => !seen.has(String(asRecord(message).msgId))), ...d.messages]
      },
      appendMessages: (d: YzjPanelState, messages: unknown[]) => {
        const seen = new Set(d.messages.map(message => String(asRecord(message).msgId)))
        d.messages = [...d.messages, ...messages.filter(message => !seen.has(String(asRecord(message).msgId)))]
      },
      setAnchorMsgId: (d: YzjPanelState, id: string) => { d.anchorMsgId = id },
      setUnreadTotal: (d: YzjPanelState, total: number) => { d.unreadTotal = total },
      setLoading: (d: YzjPanelState, loading: boolean) => { d.loading = loading },
      setError: (d: YzjPanelState, error: string) => { d.error = error },
    },
  })
  return {
    ...handle,
    create(scopeKey?: string) {
      const instance = handle.create(scopeKey)
      const snap = instance.getSnapshot()
      // Repair a non-conforming rehydrated blob: every array-typed field
      // must exist as an array; a single violation resets to the fresh
      // init (panel UI state is cheap to rebuild; read-state lives in
      // separate keys and survives). Without this, a blob written by an
      // older build (or a poisoned one) crashes array consumers.
      const arrays: (keyof YzjPanelState)[] = [
        'workspaces', 'docs', 'events', 'calEvents', 'groups', 'messages',
      ]
      const broken = arrays.some(key => !Array.isArray(snap[key]))
        || typeof snap.loading !== 'boolean'
      if (broken) {
        instance.store.set({ ...handle.spec.init(), open: false, tab: 'docs' })
        instance.clearPersisted()
      }
      return instance
    },
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}
