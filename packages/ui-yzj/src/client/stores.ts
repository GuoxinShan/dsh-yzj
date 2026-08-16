/**
 * The Yunzhijia panel's viewing store: open state, active tab, fetched data
 * per tab, drill-down selection, loading/error flags. Module level exports
 * the factory only (a module-level handle would pin store identity across
 * plugin reloads); the two registrations share the factory's handle.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'

/** Panel tabs (我的 removed — the composer '@' covers directory search;
 * 待办 added for the demo-stage todo library; 机器人 added for the robot
 * channel status + per-conversation model overrides). */
export type YzjTab = 'docs' | 'calendar' | 'chat' | 'todo' | 'robot'
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
  /** Todo tab: library snapshot (views from the yzjTodo core). */
  todos: unknown[]
  todoReady: boolean
  todoLink: string
  /** Active library identity for the switcher label (cheap, always present). */
  todoLibName: string
  todoLibScope: string
  /** Discoverable todo libraries + active docId (switcher). */
  todoLibraries: unknown[]
  todoActiveDocId: string
  /** Active tag filter ('' = all). */
  todoTag: string
  /** Robot tab: channel statuses + model overrides + provider/model catalog. */
  robotChannels: unknown[]
  robotOverrides: unknown[]
  robotCatalog: unknown[]
  /** Conversation selected in the override editor ('' = none). */
  robotSelKey: string
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
  setTodoState: (draft: YzjPanelState, todos: unknown[], ready: boolean, link: string, libName?: string, libScope?: string) => void
  setTodoLibraries: (draft: YzjPanelState, libraries: unknown[], activeDocId: string) => void
  patchTodo: (draft: YzjPanelState, todo: unknown) => void
  setTodoTag: (draft: YzjPanelState, tag: string) => void
  setRobotData: (draft: YzjPanelState, channels: unknown[], overrides: unknown[], catalog: unknown[]) => void
  setRobotSelKey: (draft: YzjPanelState, key: string) => void
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
      todos: [],
      todoReady: false,
      todoLink: '',
      todoLibName: '',
      todoLibScope: '',
      todoLibraries: [],
      todoActiveDocId: '',
      todoTag: '',
      robotChannels: [],
      robotOverrides: [],
      robotCatalog: [],
      robotSelKey: '',
      // Start "loading" so the todo pane never flashes its provisioning hero
      // for the single frame before loadTab kicks in.
      loading: true,
      error: '',
    }),
    // v5: schema gained todo fields (todos/todoLib*/…); the engine's
    // persistence REPLACES state wholesale with the parsed blob, so a blob
    // written by an older build leaves every new key undefined — the pane
    // crashed on `todos.map` (and any array consumer crashes likewise).
    // The version bump alone doesn't harden future schema drift, so
    // `create` below also repairs non-conforming rehydrated blobs.
    persist: 'dsh.yzj.panel.v5',
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
      setTodoState: (d: YzjPanelState, todos: unknown[], ready: boolean, link: string, libName?: string, libScope?: string) => {
        d.todos = todos
        d.todoReady = ready
        d.todoLink = link
        if (libName !== undefined) d.todoLibName = libName
        if (libScope !== undefined) d.todoLibScope = libScope
      },
      setTodoLibraries: (d: YzjPanelState, libraries: unknown[], activeDocId: string) => {
        d.todoLibraries = libraries
        d.todoActiveDocId = activeDocId
      },
      patchTodo: (d: YzjPanelState, todo: unknown) => {
        const todoId = String(asRecord(todo).todoId)
        d.todos = d.todos.map(item => String(asRecord(item).todoId) === todoId ? todo : item)
      },
      setTodoTag: (d: YzjPanelState, tag: string) => { d.todoTag = tag },
      setRobotData: (d: YzjPanelState, channels: unknown[], overrides: unknown[], catalog: unknown[]) => {
        d.robotChannels = channels
        d.robotOverrides = overrides
        d.robotCatalog = catalog
      },
      setRobotSelKey: (d: YzjPanelState, key: string) => { d.robotSelKey = key },
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
        'todos', 'todoLibraries', 'robotChannels', 'robotOverrides', 'robotCatalog',
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
