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
  fetchSearch: (keyword: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  fetchDoc: (id: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  fetchDocBlocks: (id: string, blockId?: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** 多维表格 schema (tables and fields) — used for dbt drag previews. */
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
  /** Panel-direct write into a group's shared workspace (user's own will; auto-unique names unless overwrite). */
  robotShareWrite: (input: { groupId: string; filename: string; content: string; overwrite?: boolean; robotIndex?: number }) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Persist the FULL channel configuration to the channels file (§8.5); takes effect after a GUI restart. */
  robotChannelsSave: (input: { defaultProvider?: string; defaultModel?: string; robots: { sendMsgUrl: string; provider?: string; model?: string; cwd?: string; enabled?: boolean; allowFrom?: string[] }[] }) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
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
  }
}
