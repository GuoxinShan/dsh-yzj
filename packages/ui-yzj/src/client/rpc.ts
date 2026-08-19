/**
 * RPC face for the Yunzhijia panel: every data verb the panel needs, backed
 * by the `/yzj` connection channel registered by this package's node half.
 * Plain callbacks over JSON — components never see the connection handle.
 */
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'

/** One RPC failure, normalized for display. */
export interface YzjRpcError {
  message: string
}

/** The injected data face the panel receives. */
export interface YzjPanelInject {
  fetchWorkspaces: (type?: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  fetchDocs: (workspace: string, parentId?: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  fetchEvents: (start: string, end: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  fetchGroups: (limit?: number, page?: number) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  fetchMessages: (groupId: string, limit?: number, page?: { type: 'newest' | 'old' | 'new'; msgId?: string }) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  fetchWhoami: () => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Probe `yzj-cli` login: `{ loggedIn, name, openId, reason }` (always ok). */
  authStatus: () => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Spawn `yzj-cli auth login` (opens the system browser). User-direct. */
  authLogin: () => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  fetchSearch: (keyword: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  fetchDoc: (id: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  fetchDocBlocks: (id: string, blockId?: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** 多维表格 schema (tables and fields) — used for dbt @-ref previews. */
  fetchSheet: (id: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  fetchWorkspace: (id: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  fetchEvent: (id: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  fetchContact: (openId: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** One file's data URL proxied through the authenticated CLI (fileId). */
  fetchFileData: (fileId: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Send options beyond plain text (real IM: richText/file/reply/images/@). */
  sendMessageOpts?: {
    msgType?: 'text' | 'richText' | 'file'
    fileId?: string
    images?: string[]
    replyMsgId?: string
    /** One per @姓名 fragment in content, in order (group chats only). */
    atOpenIds?: string[]
    atAll?: boolean
  }
  /** Send a message to a group from the panel composer. */
  sendMessage: (groupId: string, content: string | undefined, opts?: YzjPanelInject['sendMessageOpts']) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Upload a local file (base64) to Yunzhijia; returns the fileId. */
  uploadFile: (name: string, base64: string, size: number) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Todo library snapshot (demo-stage sheet backend via the yzjTodo core). */
  todoState: () => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** One-click provision of the todo library (empty-state action). */
  ensureTodo: () => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Quick-create one todo from the panel (user-direct write). */
  createTodo: (input: { title: string; ddl?: string; priority?: string; tags?: string[] }) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Toggle complete / reopen one todo (user-direct write). */
  toggleTodo: (todoId: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Library switcher data: discovered libraries + provisionable team workspaces. */
  todoLibraries: () => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Switch the active library (panel picker; agent writes follow it). */
  selectTodoLibrary: (docId: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Adopt-or-provision a team library in one enterprise workspace. */
  ensureTeamTodo: (workspace: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** AI推进 board snapshot (items + library) over the yzjAdvance core. */
  advanceState: () => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** One advancement item: projection + 事元 stream window + sources. */
  advanceGet: (advanceId: string, entryOffset?: number, entryLimit?: number) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Start-modal direct write: create one advancement item (user's own will). */
  advanceCreate: (input: { title: string; goal?: string; background?: string; metrics?: string; assignee?: string; targetDate?: string; tags?: string[] }) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Panel judge verbs (user-direct; each lands as one user 事元; cancel = 中止终局, v1.6). */
  advanceJudge: (advanceId: string, action: 'confirm_condition' | 'confirm_advance' | 'accept' | 'reject' | 'ignore' | 'cancel', note?: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** One-click provision of the 事项/事元 tables (empty-state action). */
  advanceEnsure: () => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Last patrol wave for the board status line (spec §14.5). */
  advanceScanState: () => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** User-direct 事元 feed (D9, no confirm card; no stageTo). */
  advanceFeed: (input: { advanceId: string; summary: string; sourceType?: string; refs?: string[] }) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Subscribe one intent thread (关联渠道; user-direct, spec §15.2). */
  advanceThreadAdd: (advanceId: string, token: string, label?: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Unsubscribe one intent thread (registry only; entries untouched). */
  advanceThreadRemove: (advanceId: string, token: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** One write-confirmation record for a tool call (undefined when not gated). */
  fetchWrite: (sessionId: string, callId: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Settle one pending write-confirmation decision. */
  decideWrite: (writeId: string, outcome: 'allowed-once' | 'rejected') => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Robot channel statuses (one entry per configured robot). */
  robotStatus: () => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Every persisted per-conversation model override. */
  robotOverrides: () => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Persist one conversation's model override (provider and/or model). */
  setRobotOverride: (key: string, provider: string | undefined, model: string | undefined) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Remove one conversation's model override. */
  deleteRobotOverride: (key: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Provider/model catalog for the robot settings picker. */
  robotModels: () => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Live diagnostics: push-hub stashes and open confirmation cards. */
  robotDiagnostics: () => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** DSH-side proactive notification via one robot channel. */
  robotNotify: (text: string, robotIndex?: number) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** DSH-side conversation continuation (operator turn through the full pipeline). */
  robotContinue: (text: string, options?: { robotIndex?: number; groupId?: string }) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Fork one robot conversation into a new operator-side session. */
  robotFork: (sessionId: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** List one group's shared workspace files (name/size/mtime). */
  robotShareList: (groupId: string, robotIndex?: number) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Read one shared file's text content (bounded preview). */
  robotShareRead: (groupId: string, filename: string, robotIndex?: number) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Open a robot workspace folder in the OS file manager (user's own click). */
  robotOpenFolder: (groupId: string | undefined, robotIndex?: number) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Panel-direct write into a group's shared workspace (user's own will; auto-unique names unless overwrite). */
  robotShareWrite: (input: { groupId: string; filename: string; content: string; overwrite?: boolean; robotIndex?: number }) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Persist the FULL channel configuration to the channels file (§8.5); takes effect after a GUI restart. */
  robotChannelsSave: (input: { defaultProvider?: string; defaultModel?: string; robots: { sendMsgUrl: string; provider?: string; model?: string; cwd?: string; enabled?: boolean; allowFrom?: string[] }[] }) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Memory vault: one scope's read view (sections/entities/observations). */
  memoryScope: (scope?: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Memory vault: tail of the dream log (audit transparency). */
  memoryLog: (scope?: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Memory vault: panel-direct observation write (user's own will; no confirm card). */
  memoryObserve: (content: string, tags?: string[], scope?: string, durable?: boolean) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Memory vault: dream runtime state (switch / model / schedule). */
  dreamState: () => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Memory vault: merge a partial dream-state update (empty strings clear). */
  dreamSet: (partial: { enabled?: boolean; provider?: string; model?: string; dailyAt?: string }) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Memory vault: run one dream consolidation now (in-process executor). */
  dreamRun: () => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Plugin-wide default model route (model-yzj). */
  modelDefault: () => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Set the plugin-wide default model route. */
  modelSetDefault: (provider: string, model: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Clear the plugin-wide default model route. */
  modelClearDefault: () => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Provider/model catalog for the pickers (active adapter routes). */
  modelCatalog: () => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /**
   * Bind one Yunzhijia conversation to its DSH home and resume-or-create
   * that session. Second open is focus (`created: false`). Optional so test
   * fakes need not stub it — pick-group still loads panel IM without it.
   */
  homeOpen?: (groupId: string, title?: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Client-side focus of a bound session (sessions.open after list ready). */
  focusBoundSession?: (sessionId: string) => void
  /** Binding row for one DSH session (or unbound). */
  homeBinding?: (sessionId: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Fused / room VIEW snapshot (IM log + topic list). Prefer groupId (R24). */
  homeFused?: (sessionId: string, groupId?: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Workbench session list: bound rooms plus their topics (L1). */
  homeNav?: () => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Mint or focus a topic session under a group (交给助手). */
  homeTopicOpen?: (input: {
    groupId: string
    rootMsgId?: string
    originWho?: string
    originText?: string
    title?: string
    groupName?: string
  }) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Topic-drawer lens bubbles (user/assistant + write/edit file cards). */
  homeTopicLens?: (sessionId: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Ask the topic agent from the drawer; does not focus native Chat. */
  homeTopicAsk?: (sessionId: string, text: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Backfill recent Yunzhijia messages into the bound log. */
  homeBackfill?: (sessionId: string, opts?: { beforeMsgId?: string; limit?: number; groupId?: string }) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** DSH「发进群」: optimistic ② + CLI send, no user-turn. */
  homeSend?: (sessionId: string, content: string | undefined, opts?: YzjPanelInject['sendMessageOpts'] & { groupId?: string }) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Private-transcript digest candidates for 丢进群. */
  homeDigest?: (sessionId: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Confirmed D8 handoff into a bound group session. */
  homeHandoff?: (groupId: string, digest: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
}

/** Build the inject face from a connection handle; unavailable → failed calls. */
export function createYzjPanelInject(connection: ConnectionHandle | undefined): YzjPanelInject {
  const call = async (endpoint: string, payload: Record<string, unknown>)
    : Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }> => {
    if (connection === undefined) return { ok: false, error: { message: 'connection unavailable' } }
    const result = await connection.rpc.call('/yzj', endpoint, payload)
    if (result.ok) return { ok: true, value: result.value }
    return { ok: false, error: { message: result.error.message } }
  }
  return {
    fetchWorkspaces: (type) => call('workspaces', type === undefined ? {} : { type }),
    fetchDocs: (workspace, parentId) => call('docs', parentId === undefined ? { workspace } : { workspace, parentId }),
    fetchEvents: (start, end) => call('events', { start, end }),
    fetchGroups: (limit, page) => call('groups', {
      ...(limit === undefined ? {} : { limit }),
      ...(page === undefined ? {} : { page }),
    }),
    fetchMessages: (groupId, limit, page) => call('messages', {
      groupId,
      ...(limit === undefined ? {} : { limit }),
      ...(page === undefined ? { type: 'newest' } : page),
    }),
    fetchWhoami: () => call('whoami', {}),
    authStatus: () => call('auth-status', {}),
    authLogin: () => call('auth-login', {}),
    fetchSearch: (keyword) => call('search', { keyword }),
    fetchDoc: (id) => call('doc-get', { id }),
    fetchDocBlocks: (id, blockId) => call('doc-blocks', blockId === undefined ? { id } : { id, blockId }),
    fetchSheet: (id) => call('sheet-get', { id }),
    fetchWorkspace: (id) => call('workspace-get', { id }),
    fetchEvent: (id) => call('event-get', { id }),
    fetchContact: (openId) => call('contact-get', { openId }),
    fetchFileData: (fileId) => call('file-data', { fileId }),
    sendMessage: (groupId, content, opts) => call('im-send', {
      groupId,
      ...(content === undefined ? {} : { content }),
      ...(opts?.msgType === undefined ? {} : { msgType: opts.msgType }),
      ...(opts?.fileId === undefined ? {} : { fileId: opts.fileId }),
      ...(opts?.images === undefined ? {} : { images: opts.images }),
      ...(opts?.replyMsgId === undefined ? {} : { replyMsgId: opts.replyMsgId }),
      ...(opts?.atOpenIds === undefined ? {} : { atOpenIds: opts.atOpenIds }),
      ...(opts?.atAll !== true ? {} : { atAll: true }),
    }),
    uploadFile: (name, base64, size) => call('file-upload', { name, base64, size }),
    todoState: () => call('todo-state', {}),
    ensureTodo: () => call('todo-ensure', {}),
    createTodo: (input) => call('todo-create', {
      title: input.title,
      ...(input.ddl === undefined ? {} : { ddl: input.ddl }),
      ...(input.priority === undefined ? {} : { priority: input.priority }),
      ...(input.tags === undefined || input.tags.length === 0 ? {} : { tags: input.tags }),
    }),
    toggleTodo: (todoId) => call('todo-toggle', { todoId }),
    todoLibraries: () => call('todo-libraries', {}),
    selectTodoLibrary: (docId) => call('todo-select', { docId }),
    ensureTeamTodo: (workspace) => call('todo-ensure-team', { workspace }),
    advanceState: () => call('advance-state', {}),
    advanceGet: (advanceId, entryOffset, entryLimit) => call('advance-get', {
      advanceId,
      ...(entryOffset === undefined ? {} : { entryOffset }),
      ...(entryLimit === undefined ? {} : { entryLimit }),
    }),
    advanceCreate: (input) => call('advance-create', {
      title: input.title,
      ...(input.goal === undefined || input.goal === '' ? {} : { goal: input.goal }),
      ...(input.background === undefined || input.background === '' ? {} : { background: input.background }),
      ...(input.metrics === undefined || input.metrics === '' ? {} : { metrics: input.metrics }),
      ...(input.assignee === undefined || input.assignee === '' ? {} : { assignee: input.assignee }),
      ...(input.targetDate === undefined || input.targetDate === '' ? {} : { targetDate: input.targetDate }),
      ...(input.tags === undefined || input.tags.length === 0 ? {} : { tags: input.tags }),
    }),
    advanceJudge: (advanceId, action, note) => call('advance-judge', {
      advanceId,
      action,
      ...(note === undefined || note === '' ? {} : { note }),
    }),
    advanceEnsure: () => call('advance-ensure', {}),
    advanceScanState: () => call('advance-scan-state', {}),
    advanceFeed: (input) => call('advance-feed', {
      advanceId: input.advanceId,
      summary: input.summary,
      ...(input.sourceType === undefined || input.sourceType === '' ? {} : { sourceType: input.sourceType }),
      ...(input.refs === undefined || input.refs.length === 0 ? {} : { refs: input.refs }),
    }),
    advanceThreadAdd: (advanceId, token, label) => call('advance-thread-add', {
      advanceId,
      token,
      ...(label === undefined || label === '' ? {} : { label }),
    }),
    advanceThreadRemove: (advanceId, token) => call('advance-thread-remove', { advanceId, token }),
    fetchWrite: (sessionId, callId) => call('write-list', { sessionId, callId }),
    decideWrite: (writeId, outcome) => call('write-decide', { writeId, outcome }),
    robotStatus: () => call('robot-status', {}),
    robotOverrides: () => call('robot-overrides', {}),
    setRobotOverride: (key, provider, model) => call('robot-override-set', {
      key,
      ...(provider === undefined ? {} : { provider }),
      ...(model === undefined ? {} : { model }),
    }),
    deleteRobotOverride: (key) => call('robot-override-delete', { key }),
    robotModels: () => call('robot-models', {}),
    robotDiagnostics: () => call('robot-diagnostics', {}),
    robotNotify: (text: string, robotIndex?: number) => call('robot-notify', {
      text,
      ...(robotIndex === undefined ? {} : { robotIndex }),
    }),
    robotContinue: (text: string, options: { robotIndex?: number; groupId?: string } = {}) => call('robot-continue', {
      text,
      ...(options.robotIndex === undefined ? {} : { robotIndex: options.robotIndex }),
      ...(options.groupId === undefined ? {} : { groupId: options.groupId }),
    }),
    robotFork: (sessionId: string) => call('robot-fork', { sessionId }),
    robotShareList: (groupId: string, robotIndex?: number) => call('robot-share-list', {
      groupId,
      ...(robotIndex === undefined ? {} : { robotIndex }),
    }),
    robotShareRead: (groupId: string, filename: string, robotIndex?: number) => call('robot-share-read', {
      groupId,
      filename,
      ...(robotIndex === undefined ? {} : { robotIndex }),
    }),
    robotOpenFolder: (groupId: string | undefined, robotIndex?: number) => call('robot-open-folder', {
      ...(groupId === undefined || groupId === '' ? {} : { groupId }),
      ...(robotIndex === undefined ? {} : { robotIndex }),
    }),
    robotShareWrite: (input: { groupId: string; filename: string; content: string; overwrite?: boolean; robotIndex?: number }) => call('robot-share-write', {
      groupId: input.groupId,
      filename: input.filename,
      content: input.content,
      ...(input.overwrite === undefined ? {} : { overwrite: input.overwrite }),
      ...(input.robotIndex === undefined ? {} : { robotIndex: input.robotIndex }),
    }),
    robotChannelsSave: (input: { defaultProvider?: string; defaultModel?: string; robots: { sendMsgUrl: string; provider?: string; model?: string; cwd?: string; enabled?: boolean; allowFrom?: string[] }[] }) => call('robot-channels-save', {
      ...(input.defaultProvider === undefined ? {} : { defaultProvider: input.defaultProvider }),
      ...(input.defaultModel === undefined ? {} : { defaultModel: input.defaultModel }),
      robots: input.robots,
    }),
    memoryScope: (scope?: string) => call('memory-scope', scope === undefined ? {} : { scope }),
    memoryLog: (scope?: string) => call('memory-log', scope === undefined ? {} : { scope }),
    memoryObserve: (content: string, tags?: string[], scope?: string, durable?: boolean) => call('memory-observe', {
      content,
      ...(tags === undefined || tags.length === 0 ? {} : { tags }),
      ...(scope === undefined ? {} : { scope }),
      ...(durable === undefined ? {} : { durable }),
    }),
    dreamState: () => call('dream-state', {}),
    dreamSet: (partial) => call('dream-set', {
      ...(partial.enabled === undefined ? {} : { enabled: partial.enabled }),
      ...(partial.provider === undefined ? {} : { provider: partial.provider }),
      ...(partial.model === undefined ? {} : { model: partial.model }),
      ...(partial.dailyAt === undefined ? {} : { dailyAt: partial.dailyAt }),
    }),
    dreamRun: () => call('dream-run', {}),
    modelDefault: () => call('model-default', {}),
    modelSetDefault: (provider, model) => call('model-default-set', { provider, model }),
    modelClearDefault: () => call('model-default-clear', {}),
    modelCatalog: () => call('model-catalog', {}),
    homeOpen: (groupId, title) => call('home-open', {
      groupId,
      ...(title === undefined || title === '' ? {} : { title }),
    }),
    homeBinding: (sessionId) => call('home-binding', { sessionId }),
    homeFused: (sessionId, groupId) => call('home-fused', groupId !== undefined && groupId !== ''
      ? { groupId }
      : { sessionId }),
    homeNav: () => call('home-nav', {}),
    homeTopicOpen: (input) => call('home-topic-open', input),
    homeTopicLens: (sessionId) => call('home-topic-lens', { sessionId }),
    homeTopicAsk: (sessionId, text) => call('home-topic-ask', { sessionId, text }),
    homeBackfill: (sessionId, opts) => call('home-backfill', {
      sessionId,
      ...(opts?.groupId === undefined || opts.groupId === '' ? {} : { groupId: opts.groupId }),
      ...(opts?.beforeMsgId === undefined ? {} : { beforeMsgId: opts.beforeMsgId }),
      ...(opts?.limit === undefined ? {} : { limit: opts.limit }),
    }),
    homeSend: (sessionId, content, opts) => call('home-send', {
      sessionId,
      ...(opts?.groupId === undefined || opts.groupId === '' ? {} : { groupId: opts.groupId }),
      ...(content === undefined ? {} : { content }),
      ...(opts?.msgType === undefined ? {} : { msgType: opts.msgType }),
      ...(opts?.fileId === undefined ? {} : { fileId: opts.fileId }),
      ...(opts?.images === undefined ? {} : { images: opts.images }),
      ...(opts?.replyMsgId === undefined ? {} : { replyMsgId: opts.replyMsgId }),
      ...(opts?.atOpenIds === undefined ? {} : { atOpenIds: opts.atOpenIds }),
      ...(opts?.atAll !== true ? {} : { atAll: true }),
    }),
    homeDigest: (sessionId) => call('home-digest', { sessionId }),
    homeHandoff: (groupId, digest) => call('home-handoff', { groupId, digest }),
  }
}
