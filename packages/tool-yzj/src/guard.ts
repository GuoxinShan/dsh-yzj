/**
 * Approval guard for yzj write operations, gated by a risk-level table
 * (design v1.6 §5.1/§5.5): read-only tools pass through, standard-level
 * writes confirm, strong-level writes (deletion, irreversible) confirm with
 * the strong flag and never merge into batch confirmations.
 *
 * Confirmation is self-hosted: the guard broadcasts `yzj/ask-pending` then
 * waits on `yzj/confirm-request` (ui-yzj write-gate answers) and returns
 * allow/deny. It does **not** return harness `{ kind: 'ask' }` — GUI Full
 * access sets `approval: never`, which rejects an ask before
 * `approval/request` runs (pitfall-036 / D9). Headless overlays without a
 * write-gate fail closed (`unavailable` → deny).
 */

import type { Context } from '@deepseek-ai/cordis'

/** Risk level of one gated write operation. */
export type YzjRiskLevel = 'standard' | 'strong'

/** Closed outcomes of the self-hosted confirmation waterfall. */
export type YzjConfirmOutcome = 'allowed-once' | 'rejected' | 'cancelled' | 'unavailable'

interface DangerousSpec {
  reason: string
  /** 'strong' for irreversible operations (deletion etc.); never merged. */
  level: YzjRiskLevel
  /** Optional predicate over the parsed call arguments; defaults to always ask. */
  when?: (args: Record<string, unknown>) => boolean
  /** Optional session filter. `undefined` session id asks (fail closed). */
  whenSession?: (sessionId: string | undefined) => boolean
  /** Confirmation-prefix override for non-yzj tools (e.g. the shared workspace); defaults to the yzj wording. */
  prefix?: string
}

/** Tool name → confirmation spec for every write tool in the yzj family. */
const WRITE_SPECS: Record<string, DangerousSpec> = {
  // --- strong: irreversible, never merged ---
  yzj_doc_delete: { reason: '删除知识库文档节点，不可恢复', level: 'strong' },
  yzj_doc_block_delete: { reason: '删除文档块内容，不可恢复', level: 'strong' },
  yzj_sheet_table_delete: { reason: '删除数据表及其全部记录，不可恢复', level: 'strong' },
  yzj_sheet_record_delete: { reason: '删除多维表格记录，不可恢复', level: 'strong' },
  yzj_calendar_event_delete: { reason: '取消/删除日程', level: 'strong' },
  yzj_im_group_members_remove: { reason: '移成员出群，不可恢复', level: 'strong' },
  // --- standard: side effects but reversible/new ---
  yzj_im_message_send: { reason: '发送 IM 消息到云之家会话，发出后不可撤回', level: 'standard' },
  yzj_file_upload: { reason: '上传文件到云之家，即刻落服务端', level: 'standard' },
  yzj_file_download: { reason: '下载文件并覆盖本地已有文件', level: 'standard', when: args => args.overwrite === true },
  yzj_doc_move: { reason: '移动知识库文档节点', level: 'standard' },
  yzj_doc_workspace_create: { reason: '新建知识库', level: 'standard' },
  yzj_doc_create: { reason: '新建知识库文档', level: 'standard' },
  yzj_doc_rename: { reason: '重命名知识库文档', level: 'standard' },
  yzj_doc_import: { reason: '导入文件到知识库', level: 'standard' },
  yzj_doc_block_insert: { reason: '向文档插入内容', level: 'standard' },
  yzj_doc_block_update: { reason: '更新文档内容', level: 'standard' },
  yzj_doc_block_replace: { reason: '替换文档块范围（先删后插）', level: 'standard' },
  yzj_doc_write: { reason: '覆盖/追加写整个在线文档内容', level: 'standard' },
  yzj_doc_download: { reason: '下载文档并覆盖本地已有文件', level: 'standard', when: args => args.overwrite === true },
  yzj_im_group_create: { reason: '创建云之家群组', level: 'standard' },
  yzj_im_group_members_add: { reason: '拉人进群', level: 'standard' },
  yzj_sheet_create: { reason: '新建多维表格', level: 'standard' },
  yzj_sheet_table_create: { reason: '新建数据表', level: 'standard' },
  yzj_sheet_table_rename: { reason: '重命名数据表', level: 'standard' },
  yzj_sheet_record_create: { reason: '新增多维表格记录', level: 'standard' },
  yzj_sheet_record_update: { reason: '更新多维表格记录', level: 'standard' },
  yzj_calendar_event_create: { reason: '新建日程', level: 'standard' },
  yzj_calendar_event_update: { reason: '更新日程', level: 'standard' },
  // robot-yzj 已彻底退役（决策 53，2026-08-25；决策 50 撤 UI / 51 摘挂载的同族终局）：
  // 包与 robot_* 工具不复存在——历史机器人会话（yzj-robot-*）的写请求由
  // write-gate 按残留前缀跳过 GUI 卡。恢复只能从 git 历史重建。
}

/** Structural abort signal on a tools/pre-execute exec. */
interface ConfirmSignal {
  readonly aborted: boolean
  addEventListener(type: 'abort', listener: () => void, options?: { once?: boolean }): void
  removeEventListener(type: 'abort', listener: () => void): void
}

/** Payload of the self-hosted confirmation waterfall. */
export interface YzjConfirmRequest {
  sessionId: string
  callId: string
  toolName: string
  reason: string
  signal?: ConfirmSignal
}

/** Structural session id on a tools/pre-execute exec (agent is present in harness). */
function callingSessionId(exec: { agent?: { session?: { id?: unknown } } }): string | undefined {
  const id = exec.agent?.session?.id
  return typeof id === 'string' ? id : undefined
}

/** The host-internal ask-pending event the guard emits before waiting. */
export interface YzjAskPending {
  /** Exact tool call id; the confirmation answerer pairs it with the request. */
  callId: string
  toolName: string
  level: YzjRiskLevel
  reason: string
  /** Full parsed call arguments — displayed on the confirmation card. */
  args: Record<string, unknown>
}

declare module '@deepseek-ai/cordis' {
  interface Events {
    'yzj/ask-pending'(pending: YzjAskPending): void
    'yzj/confirm-request'(
      req: YzjConfirmRequest,
      next: () => Promise<YzjConfirmOutcome>,
    ): Promise<YzjConfirmOutcome>
  }
}

function denyReason(toolName: string, outcome: YzjConfirmOutcome): string {
  if (outcome === 'rejected') return `用户拒绝了云之家操作「${toolName}」`
  if (outcome === 'cancelled') return `云之家操作「${toolName}」的确认已取消`
  return `云之家操作「${toolName}」需要确认，但当前没有确认通道`
}

/**
 * Register the `tools/pre-execute` confirm guard plus the ask-pending broadcast.
 * @param ctx - Cordis context carrying the tools registry.
 */
export function applyApprovalGuard(ctx: Context): void {
  ctx.on('tools/pre-execute', async (exec, next) => {
    const spec = WRITE_SPECS[exec.name]
    if (spec === undefined) return next()
    const args = typeof exec.arguments === 'object' && exec.arguments !== null
      ? exec.arguments as Record<string, unknown>
      : {}
    if (spec.when !== undefined && !spec.when(args)) return next()
    if (spec.whenSession !== undefined && !spec.whenSession(callingSessionId(exec))) return next()
    const reason = `${spec.prefix ?? '云之家操作确认'}：${spec.reason}`
    ctx.emit('yzj/ask-pending', {
      callId: exec.callId,
      toolName: exec.name,
      level: spec.level,
      reason,
      args,
    })
    const sessionId = callingSessionId(exec) ?? ''
    const signal = exec.signal
    const outcome = await ctx.waterfall(
      'yzj/confirm-request',
      {
        sessionId,
        callId: exec.callId,
        toolName: exec.name,
        reason,
        ...signal === undefined ? {} : { signal },
      },
      () => Promise.resolve<YzjConfirmOutcome>('unavailable'),
    )
    if (outcome === 'allowed-once') return { kind: 'allow' }
    return { kind: 'deny', reason: denyReason(exec.name, outcome) }
  })
}
