/**
 * Approval guard for yzj write operations, gated by a risk-level table
 * (design v1.6 §5.1/§5.5): read-only tools pass through, standard-level
 * writes ask, strong-level writes (deletion, irreversible) ask with the
 * strong flag and never merge into batch confirmations. The ask broadcasts a
 * `yzj/ask-pending` host event carrying the full parsed arguments so the
 * confirmation-card bridge (ui-yzj node half) can append the durable
 * `yzj/write-request` session event with complete parameter display.
 */

import type { Context } from '@deepseek-ai/cordis'

/** Risk level of one gated write operation. */
export type YzjRiskLevel = 'standard' | 'strong'

interface DangerousSpec {
  reason: string
  /** 'strong' for irreversible operations (deletion etc.); never merged. */
  level: YzjRiskLevel
  /** Optional predicate over the parsed call arguments; defaults to always ask. */
  when?: (args: Record<string, unknown>) => boolean
  /**
   * Optional session filter. `undefined` session id asks (fail closed).
   * Used by robot_notify/continue: group-room hosts and topic sessions must
   * confirm (D9 / R10); the unbound operator console stays ungated; leftover
   * yzj-robot-* still refuse at execute (operatorOnly).
   */
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
  yzj_sheet_create: { reason: '新建多维表格', level: 'standard' },
  yzj_sheet_table_create: { reason: '新建数据表', level: 'standard' },
  yzj_sheet_table_rename: { reason: '重命名数据表', level: 'standard' },
  yzj_sheet_record_create: { reason: '新增多维表格记录', level: 'standard' },
  yzj_sheet_record_update: { reason: '更新多维表格记录', level: 'standard' },
  yzj_calendar_event_create: { reason: '新建日程', level: 'standard' },
  yzj_calendar_event_update: { reason: '更新日程', level: 'standard' },
  // --- todo family (demo-stage sheet backend) ---
  yzj_todo_create: { reason: '在待办任务库创建待办（首用时会自动开通任务库）', level: 'standard' },
  yzj_todo_update: { reason: '更新待办（状态/负责人/DDL/标签/日志）', level: 'standard' },
  yzj_todo_complete: { reason: '完成待办（状态置 done）', level: 'standard' },
  // --- advance family (AI推进看板; docs/spec/ai-advance-design.md §4) ---
  yzj_advance_create: { reason: '在AI推进看板立项推进事项（首用时自动开通事项/事元双表）', level: 'standard' },
  yzj_advance_feed: { reason: '向推进事项喂入事元（目标/进度/偏差/决策/阶段变化，追加进时间旅程）', level: 'standard' },
  // --- robot-yzj group shared workspace (design robot-channel-plan §8.4) ---
  robot_share_write: { reason: '写入群共享工作区文件（<cwd>/groups/<groupId>/shared/）', level: 'standard', prefix: '工作区写操作确认' },
  // --- robot-yzj group push from a bound home (D9; operator console stays ungated) ---
  robot_notify: {
    reason: '通过机器人通道向云之家会话推送消息，发出后不可撤回',
    level: 'standard',
    whenSession: isBoundHomeSession,
  },
  robot_continue: {
    reason: '向机器人会话注入操作者消息并走入站管线（含群内回复推送）',
    level: 'standard',
    whenSession: isBoundHomeSession,
  },
}

/** Group-room host or a topic session. Missing id → ask (fail closed on the D9 hole). */
function isBoundHomeSession(sessionId: string | undefined): boolean {
  return sessionId === undefined
    || sessionId.startsWith('yzj-home-')
    || sessionId.startsWith('yzj-topic-')
}

/** Structural session id on a tools/pre-execute exec (agent is present in harness). */
function callingSessionId(exec: { agent?: { session?: { id?: unknown } } }): string | undefined {
  const id = exec.agent?.session?.id
  return typeof id === 'string' ? id : undefined
}

/** The host-internal ask-pending event the guard emits before returning ask. */
export interface YzjAskPending {
  /** Exact tool call id; the approval answerer pairs it with the request. */
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
  }
}

/**
 * Register the `tools/pre-execute` ask guard plus the ask-pending broadcast.
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
    return { kind: 'ask', reason }
  })
}
