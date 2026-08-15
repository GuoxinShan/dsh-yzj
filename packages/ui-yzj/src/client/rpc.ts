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
  /** Send options beyond plain text (real IM: richText/file/reply/images). */
  sendMessageOpts?: {
    msgType?: 'text' | 'richText' | 'file'
    fileId?: string
    images?: string[]
    replyMsgId?: string
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
  }
}
