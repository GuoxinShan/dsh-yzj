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
  /** 知识库文档搜索:按标题/文件名关键词,可选限库。 */
  fetchDocSearch: (keyword: string, workspace?: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
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
  /** IM 缓存 L2（host SQLite，决策 37）。 */
  imCacheGet: (key: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  imCachePut: (key: string, payload: unknown, fetchedAt: number) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** One write-confirmation record for a tool call (undefined when not gated). */
  fetchWrite: (sessionId: string, callId: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  /** Settle one pending write-confirmation decision. */
  decideWrite: (writeId: string, outcome: 'allowed-once' | 'rejected') => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
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
  assistantsList?: () => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  assistantsCreate?: (name: string, prompt?: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  assistantAsk?: (assistantId: string, text: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  assistantThreadAsk?: (input: {
    assistantId: string
    groupId: string
    msgId: string
    text: string
    groupName?: string
    originWho?: string
    originText?: string
  }) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  assistantProjection?: (input: { assistantId?: string; groupId?: string; msgId?: string; threadsGroupId?: string }) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  assistantThreads?: (groupId: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
  assistantProcess?: (assistantId: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: YzjRpcError }>
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
    fetchDocSearch: (keyword, workspace) => call('doc-search', workspace === undefined ? { keyword } : { keyword, workspace }),
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
    imCacheGet: (key) => call('im-cache-get', { key }),
    imCachePut: (key, payload, fetchedAt) => call('im-cache-put', { key, payload, fetchedAt }),
    fetchWrite: (sessionId, callId) => call('write-list', { sessionId, callId }),
    decideWrite: (writeId, outcome) => call('write-decide', { writeId, outcome }),
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
    assistantsList: () => call('assistants-list', {}),
    assistantsCreate: (name, prompt) => call('assistants-create', {
      name,
      ...(prompt === undefined || prompt === '' ? {} : { prompt }),
    }),
    assistantAsk: (assistantId, text) => call('assistant-ask', { assistantId, text }),
    assistantThreadAsk: (input) => call('assistant-thread-ask', input),
    assistantProjection: (input) => call('assistant-projection', input),
    assistantThreads: (groupId) => call('assistant-threads', { groupId }),
    assistantProcess: (assistantId) => call('assistant-process', { assistantId }),
  }
}
