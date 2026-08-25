/**
 * Semantic todo tool family (待办). Demo stage: backed by one 多维表格
 * ("待办任务库" dbt) acting as the shadow task store — every invariant
 * (stable id, state machine, append-only log, #tag aggregation) is enforced
 * host-side so the backend can later be swapped for a native todo API
 * without changing the tool surface (see docs/migration/todo-backend-migration.md).
 *
 * The same core backs the `ctx.yzjTodo` service consumed by the ui-yzj RPC
 * channel, so the conversation tools and the panel share one implementation.
 *
 * Verified CLI formats (probed 2026-08-15): record create/update take a
 * JSON *array* `--records`; `records[].fields` comes back as a JSON string;
 * Date values are `YYYY/MM/DD` strings; SingleSelect options must be
 * pre-registered at table create; Contact/MultipleSelect writes are not
 * usable for dynamic values, so 负责人 is `姓名(openId)` text and 标签 is
 * `#tag` tokens in a text field.
 */

import { Context, Service } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { JsonValue } from '@deepseek-ai/dsh-tools'
import type { YzjRunResult } from '@dsh-yzj/bridge'
import type {} from '@dsh-yzj/bridge'
import { yzjToolOutput, asRecord, asArray, asString, clipJson, failureDigest } from './shared.ts'
import type { YzjToolBudget } from './shared.ts'
import { localStore } from './local-store.ts'

/** v1.8 决策 37: 'sqlite' = 真机本地 SQLite（index.ts apply 启用）；'dbt' = 测试 double（FakeStore 命令脚本）。云 dbt 在真机已死。 */
let todoBackend: 'dbt' | 'sqlite' = 'dbt'
export function setTodoBackend(next: 'dbt' | 'sqlite'): void {
  todoBackend = next
}

/** Field names of the backing 任务 table (single source of truth). */
const F = {
  id: 'todo_id',
  title: '标题',
  desc: '描述',
  status: '状态',
  assignee: '负责人',
  ddl: 'DDL',
  priority: '优先级',
  tags: '标签',
  source: '来源',
  log: '推进日志',
  claimedBy: '认领会话',
  version: '版本',
  review: '验收说明',
  archived: '归档',
} as const

/** Library titles used for discovery/provisioning. */
const LIBRARY_TITLE = '待办任务库'
const TABLE_NAME = '任务'

/**
 * Status values of the swimlane state machine (todo-swimlane-agent.md §2.1):
 * backlog（待我决定）→ todo（可认领）→ in_progress → in_review（待我验收）→ done；
 * cancelled 终局（人）。blocked 砍为 release 备注（S8）；legacy 'pending'
 * reads normalize to 'todo'（S5）。
 */
export type TodoStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled'

export const TODO_STATUSES: readonly TodoStatus[] = ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled']

/** One parsed todo record. */
export interface YzjTodo {
  recordId: string
  todoId: string
  title: string
  /** 描述 = the prompt body the claiming agent executes (S7; human-editable). */
  description: string
  status: TodoStatus
  assignee: string
  assigneeOpenId: string
  ddl: string
  priority: string
  tags: string[]
  log: string
  /** Agent session id holding the claim (audit trail; empty = unclaimed). */
  claimedBy: string
  /** Optimistic-lock version, bumped on every status transition. */
  version: number
  /** Latest submit_review note shown on the 待验收 card. */
  reviewNote: string
  /** 归档 = 视图层隐藏标记（S10：与状态机正交，不是第七态）；已归档收进折叠区，可恢复。 */
  archived: boolean
  overdue: boolean
}

/** Plugin config for the todo library binding. */
export interface TodoConfig {
  workspace?: string
  docId?: string
  tableId?: number
}

/** Resolved library binding. */
export interface TodoBinding {
  docId: string
  tableId: number
  link: string
}

/** One discoverable library for the panel picker. */
export interface TodoLibraryRef {
  scope: 'personal' | 'team'
  workspaceId: string
  workspaceName: string
  docId: string
  tableId: number
  link: string
}

/** Mutable active-library holder shared by the tools and the yzjTodo service:
 *  the panel switcher writes `override`; every write path (tools + RPC)
 *  resolves through it so agent and user act on the same library. */
export interface TodoBindingHolder {
  override?: TodoBinding
  /** Extra known libraries surfaced by the picker (e.g. previously selected
   *  team libraries that a fresh personal scan would miss). */
  known?: TodoLibraryRef[]
}

/** Input for creating one todo. */
export interface TodoCreateInput {
  title: string
  /** 描述（S7）——agent 认领后执行的提示词本体；人可在面板编辑。 */
  description?: string | undefined
  /** Landing column (S6): agent-created → 'backlog'（待我决定）; panel quick-create → 'todo'. */
  initialStatus?: 'backlog' | 'todo' | undefined
  todoId?: string | undefined
  assignee?: string | undefined
  ddl?: string | undefined
  priority?: string | undefined
  tags?: readonly string[] | undefined
  refs?: readonly string[] | undefined
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for tests)
// ---------------------------------------------------------------------------

/** Split a raw tag input (string like "#a #b" / "a,b" or array) into tags. */
export function normalizeTags(input: unknown): string[] {
  const raw: string[] = Array.isArray(input)
    ? input.filter((item): item is string => typeof item === 'string')
    : typeof input === 'string' ? [input]
    : []
  const seen = new Set<string>()
  for (const chunk of raw) {
    for (const token of chunk.split(/[\s,，、;；]+/)) {
      const tag = token.replace(/^#+/, '').trim()
      if (tag !== '') seen.add(tag)
    }
  }
  return [...seen]
}

/** Render tags back into the stored `#tag` token form. */
export function formatTags(tags: readonly string[]): string {
  return tags.map(tag => `#${tag.replace(/^#+/, '')}`).join(' ')
}

/** Local today as `YYYY/MM/DD`. */
export function todayStr(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())}`
}

/** Local now as `YYYY/MM/DD HH:mm`. */
export function nowStamp(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${todayStr(now)} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

/** Normalize a DDL input (`YYYY-MM-DD` or `YYYY/MM/DD`) to `YYYY/MM/DD`. */
export function normalizeDdl(input: string): string {
  const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(input.trim())
  if (match === null) return input.trim().replace(/-/g, '/')
  const y = match[1] ?? ''
  const m = match[2] ?? ''
  const d = match[3] ?? ''
  return `${y}/${m.padStart(2, '0')}/${d.padStart(2, '0')}`
}

/** Whether a todo is overdue (DDL passed and not terminal). */
export function isOverdue(status: string, ddl: string, today = todayStr()): boolean {
  return status !== 'done' && status !== 'cancelled' && ddl !== '' && ddl < today
}

/**
 * Legal edges of the swimlane machine (todo-swimlane-agent §2.1). Human edges
 * (approve/accept/return/cancel) are panel-direct writes (D9, no card);
 * agent edges go through the claim family (claim/submit_review/release);
 * done-from-anything stays the carded fast path (yzj_todo_complete / 勾选）。
 */
export const TODO_NEXT: Record<TodoStatus, readonly TodoStatus[]> = {
  backlog: ['todo', 'cancelled'],
  todo: ['in_progress', 'backlog', 'cancelled'],
  in_progress: ['in_review', 'todo', 'cancelled'],
  in_review: ['done', 'in_progress', 'cancelled'],
  done: ['in_progress'],
  cancelled: ['todo'],
}

/** Read-time status normalization (S5): legacy pending folds into todo. */
export function normalizeTodoStatus(status: string): TodoStatus {
  if (status === 'pending') return 'todo'
  return (TODO_STATUSES.includes(status as TodoStatus) ? status : 'todo') as TodoStatus
}

/**
 * Validate a status transition; returns an error message or null.
 * The done-from-anything fast path bypasses this via coreSetStatus force.
 */
export function checkTransition(from: string, to: string): string | null {
  if (from === to) return null
  const targets: readonly TodoStatus[] = TODO_NEXT[normalizeTodoStatus(from)] ?? []
  if (targets.includes(to as TodoStatus)) return null
  return `状态机拒绝 ${from} → ${to}：合法流转为 backlog→todo→in_progress→in_review→done（打回走反向边，cancelled 可重开 todo）；直接完成请用 yzj_todo_complete`
}

/** Append one line to the append-only progress log. */
export function appendLog(existing: string, line: string): string {
  return existing.trim() === '' ? line : `${existing.trim()}\n${line}`
}

/** Parse a `姓名(openId)` assignee value. */
export function parseAssignee(raw: string): { name: string; openId: string } {
  const match = /^(.*)\(([\w-]+)\)$/.exec(raw.trim())
  if (match === null) return { name: raw.trim(), openId: '' }
  return { name: (match[1] ?? '').trim(), openId: match[2] ?? '' }
}

/** Parse one CLI record into a YzjTodo; null when the shape is unusable. */
export function parseTodoRecord(record: unknown, today = todayStr()): YzjTodo | null {
  const row = asRecord(record)
  const raw = row.fieldsValue ?? row.fields ?? row.values
  let fields: Record<string, unknown>
  if (typeof raw === 'string') {
    try {
      fields = asRecord(JSON.parse(raw))
    } catch {
      return null
    }
  } else {
    fields = asRecord(raw)
  }
  const todoId = asString(fields[F.id])
  if (todoId === '') return null
  const status = normalizeTodoStatus(asString(fields[F.status]))
  const assignee = asString(fields[F.assignee])
  const parsed = parseAssignee(assignee)
  const ddl = normalizeDdl(asString(fields[F.ddl]))
  const rawVersion = fields[F.version]
  return {
    recordId: asString(row.id ?? row.recordId),
    todoId,
    title: asString(fields[F.title]),
    description: asString(fields[F.desc]),
    status,
    assignee: parsed.name,
    assigneeOpenId: parsed.openId,
    ddl,
    priority: asString(fields[F.priority]),
    tags: normalizeTags(asString(fields[F.tags])),
    log: asString(fields[F.log]),
    claimedBy: asString(fields[F.claimedBy]),
    version: typeof rawVersion === 'number' && Number.isFinite(rawVersion) ? rawVersion : 0,
    reviewNote: asString(fields[F.review]),
    archived: fields[F.archived] === true || asString(fields[F.archived]) === '1' || asString(fields[F.archived]) === 'true',
    overdue: isOverdue(status, ddl, today),
  }
}

/** Next sequential id `T-YYYYMMDD-NNN` from today's existing ids. */
export function nextTodoId(existingIds: readonly string[], now = new Date()): string {
  const day = todayStr(now).replace(/\//g, '')
  const prefix = `T-${day}-`
  let max = 0
  for (const id of existingIds) {
    if (!id.startsWith(prefix)) continue
    const n = Number.parseInt(id.slice(prefix.length), 10)
    if (Number.isInteger(n) && n > max) max = n
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`
}

/** One `yzj_todo_list` digest line. */
function todoLine(todo: YzjTodo): string {
  const parts: string[] = [todo.todoId, todo.title]
  parts.push(`[${todo.status}${todo.overdue ? '/逾期' : ''}]`)
  if (todo.ddl !== '') parts.push(`DDL ${todo.ddl}`)
  if (todo.priority !== '') parts.push(todo.priority)
  if (todo.tags.length > 0) parts.push(formatTags(todo.tags))
  if (todo.assignee !== '') parts.push(`@${todo.assignee}`)
  return parts.join(' · ')
}

// ---------------------------------------------------------------------------
// Bridge helpers
// ---------------------------------------------------------------------------

/** Run one bridge command expecting JSON; failures become a digest value. */
async function runTodoJson(
  ctx: Context,
  budget: YzjToolBudget,
  label: string,
  command: readonly string[],
): Promise<{ ok: true; json: unknown } | { ok: false; value: ReturnType<typeof failureDigest> }> {
  const result: YzjRunResult = await ctx.yzjBridge.run(command, { timeoutMs: budget.timeoutMs })
  if (!result.ok) return { ok: false, value: failureDigest(label, result, budget.maxRenderChars) }
  return { ok: true, json: result.json }
}

/** CLI records array from a list/create/update payload. */
function cliRecords(json: unknown): unknown[] {
  const root = asRecord(json)
  const records = asArray(root.records)
  return records.length > 0 ? records : asArray(json)
}

// ---------------------------------------------------------------------------
// Library resolution and provisioning
// ---------------------------------------------------------------------------

/** Fields definition for provisioning the 任务 table (options embedded). */
function tableFieldsJson(): string {
  return JSON.stringify([
    { name: F.id, type: 'MultiLineText' },
    { name: F.title, type: 'MultiLineText' },
    { name: F.desc, type: 'MultiLineText' },
    { name: F.status, type: 'SingleSelect', data: { items: TODO_STATUSES.map(value => ({ value })) } },
    { name: F.assignee, type: 'MultiLineText' },
    { name: F.ddl, type: 'Date' },
    { name: F.priority, type: 'SingleSelect', data: { items: [{ value: 'P0' }, { value: 'P1' }, { value: 'P2' }] } },
    { name: F.tags, type: 'MultiLineText' },
    { name: F.source, type: 'Url' },
    { name: F.log, type: 'MultiLineText' },
    { name: F.claimedBy, type: 'MultiLineText' },
    { name: F.version, type: 'MultiLineText' },
    { name: F.review, type: 'MultiLineText' },
  ])
}

/** Find a usable binding in one dbt doc: a table whose fields include todo_id. */
async function bindingForDoc(
  ctx: Context,
  budget: YzjToolBudget,
  docId: string,
): Promise<TodoBinding | undefined> {
  const ran = await runTodoJson(ctx, budget, 'sheet get', ['sheet', 'get', '--id', docId])
  if (!ran.ok) return undefined
  for (const table of asArray(asRecord(ran.json).sheets)) {
    const row = asRecord(table)
    const tableId = row.id
    const names = asArray(row.fields).map(field => asString(asRecord(field).name))
    if (typeof tableId === 'number' && names.includes(F.id)) {
      return { docId, tableId, link: `https://www.yunzhijia.com/knowledge/lingee/#/store/doc/${docId}` }
    }
  }
  return undefined
}

/** Provision the 任务 table inside an existing dbt doc. */
async function provisionTable(
  ctx: Context,
  budget: YzjToolBudget,
  docId: string,
): Promise<TodoBinding> {
  const ran = await runTodoJson(ctx, budget, 'sheet table create', [
    'sheet', 'table', 'create', '--id', docId, '--name', TABLE_NAME,
    '--fields', tableFieldsJson(), '--views', JSON.stringify([{ name: '全部', type: 'Grid' }, { name: '按DDL', type: 'Query' }]),
  ])
  if (!ran.ok) throw new Error(ran.value.content)
  const binding = await bindingForDoc(ctx, budget, docId)
  if (binding === undefined) throw new Error(`todo: 任务表创建后未在 ${docId} 中找到 todo_id 字段`)
  return binding
}

/**
 * Resolve (and optionally provision) the todo library. Order: panel-selected
 * override (user's active library) → explicit config binding → discovery by
 * title in the configured/personal workspaces. Cached per core instance.
 * An override that no longer validates (library deleted) is cleared and
 * resolution falls through.
 */
export async function resolveLibrary(
  ctx: Context,
  budget: YzjToolBudget,
  config: TodoConfig,
  cache: { binding?: TodoBinding },
  allowProvision: boolean,
  holder?: TodoBindingHolder,
): Promise<TodoBinding> {
  if (todoBackend === 'sqlite') {
    const local: TodoBinding = { docId: 'local-sqlite', tableId: 0, link: '' }
    cache.binding = local
    return local
  }

  if (cache.binding !== undefined) return cache.binding

  // 0. Panel-selected override: validate once, then trust (and remember).
  if (holder?.override !== undefined) {
    const ran = await runTodoJson(ctx, budget, 'sheet get', ['sheet', 'get', '--id', holder.override.docId])
    const stillOk = ran.ok && asArray(asRecord(ran.json).sheets).some(table =>
      asRecord(table).id === holder.override!.tableId
      && asArray(asRecord(table).fields).some(field => asString(asRecord(field).name) === F.id))
    if (stillOk) {
      cache.binding = holder.override
      return holder.override
    }
    // Stale override (library deleted or table removed): drop it.
    delete holder.override
  }

  // 1. Explicit binding from config.
  if (config.docId !== undefined && config.tableId !== undefined) {
    const direct: TodoBinding = {
      docId: config.docId,
      tableId: config.tableId,
      link: `https://www.yunzhijia.com/knowledge/lingee/#/store/doc/${config.docId}`,
    }
    const ran = await runTodoJson(ctx, budget, 'sheet get', ['sheet', 'get', '--id', config.docId])
    if (ran.ok) {
      const ok = asArray(asRecord(ran.json).sheets).some(table =>
        asRecord(table).id === config.tableId
        && asArray(asRecord(table).fields).some(field => asString(asRecord(field).name) === F.id))
      if (ok) {
        cache.binding = direct
        return direct
      }
    }
    throw new Error(`todo: 配置的库 doc=${config.docId} table=${config.tableId} 校验失败（不存在或缺少 ${F.id} 字段）；请修正 todo 配置或清空以走自动发现`)
  }

  // 2. Pick the workspace(s) to search/create in: all personal workspaces
  // (the CLI's first entry is not necessarily 我的知识), bounded to 8.
  let workspaces: { id: string; name: string }[] = []
  if (config.workspace !== undefined) {
    workspaces = [{ id: config.workspace, name: '' }]
  } else {
    const ran = await runTodoJson(ctx, budget, 'doc workspace list', ['doc', 'workspace', 'list', '--type', 'personal'])
    if (!ran.ok) throw new Error(ran.value.content)
    // The CLI returns a bare array here (unlike most list commands).
    const list = Array.isArray(ran.json) ? ran.json : asArray(asRecord(ran.json).list)
    workspaces = list
      .map(node => { const row = asRecord(node); return { id: asString(row.id), name: asString(row.name) } })
      .filter(ws => ws.id !== '')
      .slice(0, 8)
    if (workspaces.length === 0) throw new Error('todo: 未找到个人知识库，无法定位待办任务库；请在 todo 配置中显式指定 workspace')
  }

  // 3. Find an existing 待办任务库 doc with a usable table (scan every
  // candidate workspace before provisioning, so a library in any personal
  // KB is found instead of duplicated).
  for (const ws of workspaces) {
    const listRan = await runTodoJson(ctx, budget, 'doc list', ['doc', 'list', '--workspace', ws.id])
    if (!listRan.ok) continue
    // `doc list` also returns a bare array of nodes.
    const nodes = Array.isArray(listRan.json) ? listRan.json : asArray(asRecord(listRan.json).list)
    for (const node of nodes) {
      const row = asRecord(node)
      if (row.fileSuffix === 'dbt' && asString(row.title) === LIBRARY_TITLE) {
        const docId = asString(row.id)
        const found = await bindingForDoc(ctx, budget, docId)
        if (found !== undefined) {
          cache.binding = found
          return found
        }
        if (allowProvision) {
          const provisioned = await provisionTable(ctx, budget, docId)
          cache.binding = provisioned
          return provisioned
        }
      }
    }
  }

  if (!allowProvision) {
    throw new Error('todo: 待办任务库尚未开通；创建第一条待办即可自动开通')
  }

  // 4. Provision the whole library in the first candidate workspace.
  const createRan = await runTodoJson(ctx, budget, 'sheet create', [
    'sheet', 'create', '--workspace', workspaces[0]!.id, '--title', LIBRARY_TITLE,
  ])
  if (!createRan.ok) throw new Error(createRan.value.content)
  const docId = asString(asRecord(createRan.json).id)
  if (docId === '') throw new Error('todo: 创建待办任务库未返回文档 id')
  const binding = await provisionTable(ctx, budget, docId)
  cache.binding = binding
  return binding
}

/** Fetch and parse every todo (paged up to 300 records, demo scale). */
export async function fetchTodos(
  ctx: Context,
  budget: YzjToolBudget,
  binding: TodoBinding,
): Promise<YzjTodo[]> {
  if (todoBackend === 'sqlite') {
    return localStore().listTodos()
      .map(row => parseTodoRecord({ id: row.recordId, fields: row.fields }))
      .filter((todo): todo is YzjTodo => todo !== null)
  }

  const todos: YzjTodo[] = []
  let pageToken: string | undefined
  for (let page = 0; page < 3; page += 1) {
    const command = ['sheet', 'record', 'list', '--id', binding.docId, '--table-id', String(binding.tableId), '--limit', '100']
    if (pageToken !== undefined) command.push('--page-token', pageToken)
    const ran = await runTodoJson(ctx, budget, 'sheet record list', command)
    if (!ran.ok) throw new Error(ran.value.content)
    for (const record of cliRecords(ran.json)) {
      const todo = parseTodoRecord(record)
      if (todo !== null) todos.push(todo)
    }
    pageToken = asString(asRecord(ran.json).page_token ?? asRecord(ran.json).next_page_token)
    if (pageToken === '') break
  }
  return todos
}

/** Fetch one todo by todo_id; undefined when absent. */
export async function fetchTodoByTodoId(
  ctx: Context,
  budget: YzjToolBudget,
  binding: TodoBinding,
  todoId: string,
): Promise<YzjTodo | undefined> {
  if (todoBackend === 'sqlite') {
    const row = localStore().todo(todoId)
    if (row === undefined) return undefined
    return parseTodoRecord({ id: row.recordId, fields: row.fields }) ?? undefined
  }

  const filter = JSON.stringify({ mode: 'AND', criteria: [{ field: F.id, operator: 'Equals', values: [todoId] }] })
  const ran = await runTodoJson(ctx, budget, 'sheet record list', [
    'sheet', 'record', 'list', '--id', binding.docId, '--table-id', String(binding.tableId), '--filter', filter,
  ])
  if (!ran.ok) throw new Error(ran.value.content)
  for (const record of cliRecords(ran.json)) {
    const todo = parseTodoRecord(record)
    if (todo !== null) return todo
  }
  return undefined
}

/** Resolve an assignee string to `姓名(openId)` when unambiguous. */
export async function resolveAssignee(
  ctx: Context,
  budget: YzjToolBudget,
  assignee: string,
): Promise<{ value: string; resolved: boolean }> {
  const trimmed = assignee.trim()
  if (trimmed === '' || /\([\w-]+\)$/.test(trimmed)) return { value: trimmed, resolved: true }
  const ran = await runTodoJson(ctx, budget, 'contact user search', ['contact', 'user', 'search', '--keyword', trimmed])
  if (!ran.ok) return { value: trimmed, resolved: false }
  const hits = asArray(asRecord(ran.json).list ?? ran.json)
    .map(row => asRecord(row))
    .filter(row => asString(row.name) === trimmed)
  if (hits.length === 1) {
    const openId = asString(hits[0]?.openId ?? hits[0]?.open_id)
    if (openId !== '') return { value: `${trimmed}(${openId})`, resolved: true }
  }
  return { value: trimmed, resolved: false }
}

/** Write records (create/update array form) and return the raw payload. */
async function writeRecords(
  ctx: Context,
  budget: YzjToolBudget,
  label: string,
  binding: TodoBinding,
  records: string,
): Promise<{ ok: true; json: unknown } | { ok: false; content: string }> {
  if (todoBackend === 'sqlite') {
    const store = localStore()
    const rows = JSON.parse(records) as { id?: string; fieldsValue?: Record<string, unknown> }[]
    const out: { id: string; fields: Record<string, unknown> }[] = []
    for (const row of rows) {
      const fields = row.fieldsValue ?? {}
      const todoId = String(row.id ?? fields[F.id] ?? '')
      if (label.includes('create')) store.createTodo(fields)
      else store.updateTodo(todoId, fields)
      out.push({ id: todoId, fields: { ...store.todo(todoId)?.fields } })
    }
    return { ok: true, json: { records: out } }
  }

  const command = label.includes('create')
    ? ['sheet', 'record', 'create', '--id', binding.docId, '--table-id', String(binding.tableId), '--records', records]
    : ['sheet', 'record', 'update', '--id', binding.docId, '--table-id', String(binding.tableId), '--records', records]
  const result: YzjRunResult = await ctx.yzjBridge.run(command, { timeoutMs: budget.timeoutMs })
  if (!result.ok) {
    const digest = failureDigest(label, result, budget.maxRenderChars)
    return { ok: false, content: digest.content }
  }
  return { ok: true, json: result.json }
}

// ---------------------------------------------------------------------------
// Core operations shared by the tools and the yzjTodo service
// ---------------------------------------------------------------------------

/** Result of a core create: the stored todo plus bookkeeping facts. */
export interface CoreCreateResult {
  todo: YzjTodo | null
  idempotent: boolean
  assigneeNote: string
  binding: TodoBinding
}

/** Create one todo (idempotent on explicit todoId). Throws actionable errors. */
export async function coreCreate(
  ctx: Context,
  budget: YzjToolBudget,
  config: TodoConfig,
  cache: { binding?: TodoBinding },
  input: TodoCreateInput,
  holder?: TodoBindingHolder,
): Promise<CoreCreateResult> {
  const title = input.title.trim()
  if (title === '') throw new Error('todo: title must not be empty')
  const binding = await resolveLibrary(ctx, budget, config, cache, true, holder)
  if (input.todoId !== undefined) {
    const existing = await fetchTodoByTodoId(ctx, budget, binding, input.todoId)
    if (existing !== undefined) return { todo: existing, idempotent: true, assigneeNote: '', binding }
  }
  const todos = await fetchTodos(ctx, budget, binding)
  const todoId = input.todoId ?? nextTodoId(todos.map(todo => todo.todoId))
  if (todos.some(todo => todo.todoId === todoId)) {
    throw new Error(`todo: 生成的 todo_id ${todoId} 已冲突，请显式传入 todoId`)
  }
  const tags = normalizeTags(input.tags)
  const landing: TodoStatus = input.initialStatus ?? 'backlog'
  const fields: Record<string, unknown> = { [F.id]: todoId, [F.title]: title, [F.status]: landing }
  if (input.description !== undefined && input.description.trim() !== '') fields[F.desc] = input.description.trim()
  let assigneeNote = ''
  if (input.assignee !== undefined && input.assignee.trim() !== '') {
    const resolved = await resolveAssignee(ctx, budget, input.assignee)
    fields[F.assignee] = resolved.value
    if (!resolved.resolved) assigneeNote = `（负责人 "${input.assignee}" 未能唯一解析，已按姓名保存）`
  }
  if (input.ddl !== undefined && input.ddl.trim() !== '') fields[F.ddl] = normalizeDdl(input.ddl)
  if (input.priority !== undefined && input.priority !== '') fields[F.priority] = input.priority
  if (tags.length > 0) fields[F.tags] = formatTags(tags)
  const refLine = (input.refs ?? []).length > 0 ? `\n${nowStamp()} 来源引用 ${(input.refs ?? []).join(' ')}` : ''
  fields[F.log] = `${nowStamp()} 创建${landing === 'backlog' ? '（落待我决定，待人批准）' : ''}${refLine}`
  const wrote = await writeRecords(ctx, budget, 'sheet record create', binding, JSON.stringify([{ fieldsValue: fields }]))
  if (!wrote.ok) throw new Error(wrote.content)
  const created = cliRecords(wrote.json).map(record => parseTodoRecord(record)).find(todo => todo !== null)
  return { todo: created ?? null, idempotent: false, assigneeNote, binding }
}

/** Result of a core status change. */
export interface CoreStatusResult {
  todo: YzjTodo
  from: TodoStatus
  changed: boolean
  binding: TodoBinding
}

/** Options steering one status transition (log verb, claim bookkeeping, force). */
export interface CoreStatusOptions {
  /** Note appended to the transition log line. */
  note?: string | undefined
  /** Log verb override (默认按 target 推断). */
  verb?: string | undefined
  /** Skip the machine check — ONLY the human complete fast path (D9: 勾选 / complete 卡后的人意志). */
  force?: boolean | undefined
  /** Agent session id recorded on claim (认领会话 field + audit). */
  sessionId?: string | undefined
  /** Clear the claim holder (release / 打回出 in_progress). */
  clearClaim?: boolean | undefined
  /** Review note stored for the 待验收 card (submit_review). */
  reviewNote?: string | undefined
}

/**
 * Set a todo's status with state-machine enforcement and host-appended log.
 * Every transition bumps the optimistic-lock version. `force` bypasses the
 * machine (complete fast path only); `changed: false` marks an idempotent hit.
 */
export async function coreSetStatus(
  ctx: Context,
  budget: YzjToolBudget,
  config: TodoConfig,
  cache: { binding?: TodoBinding },
  todoId: string,
  target: TodoStatus,
  opts: CoreStatusOptions = {},
  holder?: TodoBindingHolder,
): Promise<CoreStatusResult> {
  const binding = await resolveLibrary(ctx, budget, config, cache, false, holder)
  const existing = await fetchTodoByTodoId(ctx, budget, binding, todoId)
  if (existing === undefined) {
    throw new Error(`todo: 待办 ${todoId} 不存在；先用 yzj_todo_list 查真实 id，不要猜测`)
  }
  if (existing.status === target) return { todo: existing, from: existing.status, changed: false, binding }
  if (opts.force !== true) {
    const violation = checkTransition(existing.status, target)
    if (violation !== null) throw new Error(`todo: ${violation}`)
  }
  const verb = opts.verb ?? (target === 'done' ? '完成' : target === 'in_progress' ? '推进' : target === 'in_review' ? '交卷' : target === 'cancelled' ? '中止' : target === 'todo' ? '可认领' : '打回')
  const noteText = (opts.note ?? '').trim()
  const log = appendLog(existing.log, `${nowStamp()} 状态 ${existing.status}→${target}（${verb}${noteText === '' ? '' : `：${noteText}`}）`)
  const fieldsValue: Record<string, unknown> = { [F.status]: target, [F.log]: log, [F.version]: existing.version + 1 }
  if (opts.sessionId !== undefined && opts.sessionId !== '') fieldsValue[F.claimedBy] = opts.sessionId
  if (opts.clearClaim === true) fieldsValue[F.claimedBy] = ''
  if (opts.reviewNote !== undefined) fieldsValue[F.review] = opts.reviewNote
  const wrote = await writeRecords(ctx, budget, 'sheet record update', binding, JSON.stringify([{ id: existing.recordId, fieldsValue }]))
  if (!wrote.ok) throw new Error(wrote.content)
  const next: YzjTodo = {
    ...existing,
    status: target,
    log,
    version: existing.version + 1,
    claimedBy: opts.clearClaim === true ? '' : (opts.sessionId ?? existing.claimedBy),
    reviewNote: opts.reviewNote ?? existing.reviewNote,
  }
  return { todo: next, from: existing.status, changed: true, binding }
}

/**
 * Archive/unarchive one todo (S10): a view-layer hide flag, NOT a status —
 * the state machine stays untouched, no version bump, no claim interaction.
 * Board hygiene is the human's hand; 归档可恢复（已归档折叠区恢复回原列）。
 */
export async function coreSetArchived(
  ctx: Context,
  budget: YzjToolBudget,
  config: TodoConfig,
  cache: { binding?: TodoBinding },
  todoId: string,
  archived: boolean,
  holder?: TodoBindingHolder,
): Promise<{ todo: YzjTodo; binding: TodoBinding }> {
  const { todo, binding } = await mustFetch(ctx, budget, config, cache, todoId, holder)
  if (todo.archived === archived) return { todo, binding }
  const log = appendLog(todo.log, `${nowStamp()} ${archived ? '归档（收进已归档折叠区）' : '恢复（已归档 → 回板）'}`)
  const wrote = await writeRecords(ctx, budget, 'sheet record update', binding, JSON.stringify([{ id: todo.recordId, fieldsValue: { [F.archived]: archived, [F.log]: log } }]))
  if (!wrote.ok) throw new Error(wrote.content)
  return { todo: { ...todo, archived, log }, binding }
}

/** Fetch one todo or throw the canonical not-found error. */
async function mustFetch(
  ctx: Context,
  budget: YzjToolBudget,
  config: TodoConfig,
  cache: { binding?: TodoBinding },
  todoId: string,
  holder?: TodoBindingHolder,
): Promise<{ todo: YzjTodo; binding: TodoBinding }> {
  const binding = await resolveLibrary(ctx, budget, config, cache, false, holder)
  const todo = await fetchTodoByTodoId(ctx, budget, binding, todoId)
  if (todo === undefined) {
    throw new Error(`todo: 待办 ${todoId} 不存在；先用 yzj_todo_list 查真实 id，不要猜测`)
  }
  return { todo, binding }
}

/**
 * Agent claim (yzj_todo_claim): todo→in_progress. 排他由状态机本体保证
 *（只有 todo 态能进）；认领记录会话 id + 版本递增（谁干的可查，stale 即重读）。
 */
export async function coreClaim(
  ctx: Context,
  budget: YzjToolBudget,
  config: TodoConfig,
  cache: { binding?: TodoBinding },
  todoId: string,
  sessionId: string,
  holder?: TodoBindingHolder,
): Promise<CoreStatusResult> {
  const { todo } = await mustFetch(ctx, budget, config, cache, todoId, holder)
  if (todo.status === 'backlog') throw new Error(`todo: 「${todo.title}」还在「待我决定」——人批准后才可认领`)
  if (todo.status !== 'todo') {
    throw new Error(`todo: 「${todo.title}」当前 ${todo.status}，只有「可认领」状态能认领${todo.claimedBy === '' ? '' : `（已认领会话 ${todo.claimedBy}）`}`)
  }
  return coreSetStatus(ctx, budget, config, cache, todoId, 'in_progress', { verb: '认领', sessionId }, holder)
}

/**
 * Agent submit for review (yzj_todo_submit_review): in_progress→in_review.
 * done 永远只经人 accept（S2）。交卷带上结果说明（+ 证据 refs 进日志）。
 */
export async function coreSubmitReview(
  ctx: Context,
  budget: YzjToolBudget,
  config: TodoConfig,
  cache: { binding?: TodoBinding },
  todoId: string,
  note: string,
  refs: readonly string[] | undefined,
  sessionId: string,
  holder?: TodoBindingHolder,
): Promise<CoreStatusResult> {
  const { todo } = await mustFetch(ctx, budget, config, cache, todoId, holder)
  if (todo.status !== 'in_progress') throw new Error(`todo: 「${todo.title}」当前 ${todo.status}，只有「进行中」能交卷`)
  if (todo.claimedBy !== '' && sessionId !== '' && todo.claimedBy !== sessionId) {
    throw new Error(`todo: 「${todo.title}」由会话 ${todo.claimedBy} 认领，当前会话不能交卷`)
  }
  const trimmed = note.trim()
  if (trimmed === '') throw new Error('todo: 交卷必须带结果说明（note）——验收人靠它判断')
  const evidence = (refs ?? []).filter(ref => ref.trim() !== '').join(' ')
  return coreSetStatus(ctx, budget, config, cache, todoId, 'in_review', {
    verb: '交卷',
    note: evidence === '' ? trimmed : `${trimmed}；证据 ${evidence}`,
    reviewNote: evidence === '' ? trimmed : `${trimmed}\n证据：${evidence}`,
  }, holder)
}

/**
 * Agent release (yzj_todo_release_claim): in_progress→todo, clears the claim.
 * 阻塞不是状态（S8）——卡住了带备注释放：「阻塞：…」，卡回可认领列。
 */
export async function coreReleaseClaim(
  ctx: Context,
  budget: YzjToolBudget,
  config: TodoConfig,
  cache: { binding?: TodoBinding },
  todoId: string,
  note: string | undefined,
  sessionId: string,
  holder?: TodoBindingHolder,
): Promise<CoreStatusResult> {
  const { todo } = await mustFetch(ctx, budget, config, cache, todoId, holder)
  if (todo.status !== 'in_progress') throw new Error(`todo: 「${todo.title}」当前 ${todo.status}，只有「进行中」有认领可释放`)
  if (todo.claimedBy !== '' && sessionId !== '' && todo.claimedBy !== sessionId) {
    throw new Error(`todo: 「${todo.title}」由会话 ${todo.claimedBy} 认领，当前会话不能释放`)
  }
  return coreSetStatus(ctx, budget, config, cache, todoId, 'todo', { verb: '释放认领', note: note ?? '', clearClaim: true }, holder)
}

// ---------------------------------------------------------------------------
// yzjTodo host service (consumed by the ui-yzj RPC channel)
// ---------------------------------------------------------------------------

/** Panel-facing projection of one todo (lossless JSON). */
export interface YzjTodoView {
  todoId: string
  title: string
  description: string
  status: TodoStatus
  assignee: string
  assigneeOpenId: string
  ddl: string
  priority: string
  tags: string[]
  log: string
  claimedBy: string
  version: number
  reviewNote: string
  /** 归档标记（S10：视图层隐藏，非状态机第七态）。 */
  archived: boolean
  overdue: boolean
}

/** Library snapshot for the panel. */
export interface YzjTodoState {
  ready: boolean
  library: { docId: string; tableId: number; link: string } | null
  todos: YzjTodoView[]
  /** Set when the library is provisioned but reading it failed. */
  error?: string
  /** Active library identity for the switcher label (cheap lookup). */
  libraryName?: string
  libraryScope?: 'personal' | 'team'
  /** Discoverable libraries for the switcher (personal scan + known team). */
  libraries?: TodoLibraryRef[]
  /** docId of the active library (convenience for the switcher radio). */
  activeDocId?: string
}

/** One enterprise workspace offered by the team-library provisioner. */
export interface TodoTeamWorkspace {
  id: string
  name: string
  docCount: number
  /** 1 可管理 / 2 可编辑 / 3 可查看 — provisioning needs ≤2. */
  permissionLevel: number
}

/** Host service exposing the todo core to the browser surface. */
export class YzjTodoService extends Service {
  private readonly budget: YzjToolBudget
  private readonly config: TodoConfig
  private readonly cache: { binding?: TodoBinding } = {}
  /** Shared with the tool family so agent writes follow the active library. */
  readonly holder: TodoBindingHolder = {}
  private librariesCache: { at: number; list: TodoLibraryRef[] } | null = null

  constructor(ctx: Context, budget: YzjToolBudget, config: TodoConfig) {
    super(ctx, 'yzjTodo')
    this.budget = budget
    this.config = config
  }

  /** Current state; `ready` false means the library is not provisioned yet.
   *  Libraries for the switcher are fetched separately (todo-libraries RPC)
   *  so this stays fast — the discovery scan is slow. The ACTIVE library's
   *  identity rides along via a cheap doc-get + cached workspace index. */
  async state(): Promise<YzjTodoState> {
    let binding: TodoBinding
    try {
      binding = await resolveLibrary(this.ctx, this.budget, this.config, this.cache, false, this.holder)
    } catch {
      return { ready: false, library: null, todos: [], activeDocId: '' }
    }
    const identity = await this.libraryIdentity(binding.docId)
    try {
      const todos = await fetchTodos(this.ctx, this.budget, binding)
      return { ready: true, library: binding, todos: todos.map(viewOf), activeDocId: binding.docId, ...identity }
    } catch (error) {
      return { ready: true, library: binding, todos: [], error: String((error as Error).message), activeDocId: binding.docId, ...identity }
    }
  }

  /** wsId → {name, scope} index from the two workspace lists (cached 5min). */
  private wsIndexCache: { at: number; map: Map<string, { name: string; scope: 'personal' | 'team' }> } | null = null

  private async workspaceIndex(): Promise<Map<string, { name: string; scope: 'personal' | 'team' }>> {
    if (this.wsIndexCache !== null && Date.now() - this.wsIndexCache.at < 300_000) {
      return this.wsIndexCache.map
    }
    const map = new Map<string, { name: string; scope: 'personal' | 'team' }>()
    const scans: { cli: 'personal' | 'enterprise'; scope: 'personal' | 'team' }[] = [
      { cli: 'personal', scope: 'personal' },
      { cli: 'enterprise', scope: 'team' },
    ]
    for (const { cli, scope } of scans) {
      const ran = await runTodoJson(this.ctx, this.budget, 'doc workspace list', ['doc', 'workspace', 'list', '--type', cli])
      if (!ran.ok) continue
      const list = Array.isArray(ran.json) ? ran.json : asArray(asRecord(ran.json).list)
      for (const node of list) {
        const row = asRecord(node)
        const id = asString(row.id)
        if (id !== '') map.set(id, { name: asString(row.name), scope })
      }
    }
    this.wsIndexCache = { at: Date.now(), map }
    return map
  }

  /** Cheap identity of one library doc: its workspace name + scope. */
  private async libraryIdentity(docId: string): Promise<{ libraryName?: string; libraryScope?: 'personal' | 'team' }> {
    try {
      const ran = await runTodoJson(this.ctx, this.budget, 'doc get', ['doc', 'get', '--id', docId])
      if (!ran.ok) return {}
      const kbId = asString(asRecord(ran.json).kbId)
      if (kbId === '') return {}
      const meta = (await this.workspaceIndex()).get(kbId)
      if (meta === undefined) return {}
      return { libraryName: meta.name, libraryScope: meta.scope }
    } catch {
      return {}
    }
  }

  /**
   * Discover libraries for the switcher: every 待办任务库 across personal
   * and enterprise workspaces (bounded scan) plus remembered team libraries.
   * Cached ~5min — the scan is a dozen-plus CLI calls.
   */
  async listLibraries(): Promise<TodoLibraryRef[]> {
    if (this.librariesCache !== null && Date.now() - this.librariesCache.at < 300_000) {
      return this.librariesCache.list
    }
    const found: TodoLibraryRef[] = []
    const seen = new Set<string>()
    const scans: { cli: 'personal' | 'enterprise'; scope: 'personal' | 'team' }[] = [
      { cli: 'personal', scope: 'personal' },
      { cli: 'enterprise', scope: 'team' },
    ]
    for (const { cli, scope } of scans) {
      const ran = await runTodoJson(this.ctx, this.budget, 'doc workspace list', ['doc', 'workspace', 'list', '--type', cli])
      if (!ran.ok) continue
      const list = Array.isArray(ran.json) ? ran.json : asArray(asRecord(ran.json).list)
      for (const node of list.slice(0, 12)) {
        const ws = asRecord(node)
        const wsId = asString(ws.id)
        if (wsId === '') continue
        const docsRan = await runTodoJson(this.ctx, this.budget, 'doc list', ['doc', 'list', '--workspace', wsId])
        if (!docsRan.ok) continue
        const nodes = Array.isArray(docsRan.json) ? docsRan.json : asArray(asRecord(docsRan.json).list)
        for (const doc of nodes) {
          const row = asRecord(doc)
          if (row.fileSuffix !== 'dbt' || asString(row.title) !== LIBRARY_TITLE) continue
          const docId = asString(row.id)
          if (docId === '' || seen.has(docId)) continue
          const binding = await bindingForDoc(this.ctx, this.budget, docId)
          if (binding === undefined) continue
          seen.add(docId)
          found.push({
            scope,
            workspaceId: wsId,
            workspaceName: asString(ws.name),
            docId,
            tableId: binding.tableId,
            link: binding.link,
          })
        }
      }
    }
    // Remembered selections (e.g. team libraries in workspaces beyond the
    // scan bound) stay visible in the picker.
    for (const known of this.holder.known ?? []) {
      if (!seen.has(known.docId)) {
        seen.add(known.docId)
        found.push(known)
      }
    }
    this.librariesCache = { at: Date.now(), list: found }
    return found
  }

  /** Enterprise workspaces offered when provisioning a team library. */
  async teamWorkspaces(): Promise<TodoTeamWorkspace[]> {
    const ran = await runTodoJson(this.ctx, this.budget, 'doc workspace list', ['doc', 'workspace', 'list', '--type', 'enterprise'])
    if (!ran.ok) throw new Error(ran.value.content)
    const list = Array.isArray(ran.json) ? ran.json : asArray(asRecord(ran.json).list)
    return list
      .map(node => {
        const row = asRecord(node)
        return {
          id: asString(row.id),
          name: asString(row.name),
          docCount: typeof row.docCount === 'number' ? row.docCount : 0,
          permissionLevel: typeof row.permissionLevel === 'number' ? row.permissionLevel : 3,
        }
      })
      .filter(ws => ws.id !== '')
      .sort((a, b) => (a.permissionLevel - b.permissionLevel) || a.name.localeCompare(b.name))
  }

  /** Switch the active library (panel picker). Validates before adopting. */
  async select(docId: string): Promise<YzjTodoState> {
    const binding = await bindingForDoc(this.ctx, this.budget, docId)
    if (binding === undefined) throw new Error(`todo: 文档 ${docId} 不是可用的待办任务库（缺少任务表）`)
    this.holder.override = binding
    this.rememberLibrary(binding)
    delete this.cache.binding
    this.librariesCache = null
    return this.state()
  }

  /** Adopt-or-provision a team library in one enterprise workspace, then
   *  make it active. Returns the refreshed state. */
  async ensureTeam(workspaceId: string): Promise<YzjTodoState> {
    const ran = await runTodoJson(this.ctx, this.budget, 'doc list', ['doc', 'list', '--workspace', workspaceId])
    if (!ran.ok) throw new Error(ran.value.content)
    const nodes = Array.isArray(ran.json) ? ran.json : asArray(asRecord(ran.json).list)
    const existing = nodes.find(node => asRecord(node).fileSuffix === 'dbt' && asString(asRecord(node).title) === LIBRARY_TITLE)
    let binding: TodoBinding
    if (existing !== undefined) {
      const docId = asString(asRecord(existing).id)
      const found = await bindingForDoc(this.ctx, this.budget, docId)
      binding = found ?? await provisionTable(this.ctx, this.budget, docId)
    } else {
      const createRan = await runTodoJson(this.ctx, this.budget, 'sheet create', ['sheet', 'create', '--workspace', workspaceId, '--title', LIBRARY_TITLE])
      if (!createRan.ok) throw new Error(createRan.value.content)
      const docId = asString(asRecord(createRan.json).id)
      if (docId === '') throw new Error('todo: 创建团队任务库未返回文档 id')
      binding = await provisionTable(this.ctx, this.budget, docId)
    }
    this.holder.override = binding
    this.rememberLibrary(binding, workspaceId)
    delete this.cache.binding
    this.librariesCache = null
    return this.state()
  }

  /** Provision the personal library on demand (one-click empty-state action). */
  async ensure(): Promise<YzjTodoState> {
    const binding = await resolveLibrary(this.ctx, this.budget, this.config, this.cache, true, this.holder)
    return { ready: true, library: binding, todos: [] }
  }

  /** Quick-create (panel composer path) — user-direct write, lands in todo
   *  （可认领）: the user creating it IS the approval (S6, D9). */
  async create(input: TodoCreateInput): Promise<YzjTodoView> {
    const result = await coreCreate(this.ctx, this.budget, this.config, this.cache, { ...input, initialStatus: 'todo' }, this.holder)
    if (result.todo === null) throw new Error('todo: 创建成功但未能读回记录')
    return viewOf(result.todo)
  }

  /**
   * Agent-origin create (decision-card action rows / advance-action-run) —
   * lands in backlog（待我决定）; the human approve gate moves it to 可认领（S6）。
   */
  async createFromAgent(input: TodoCreateInput): Promise<YzjTodoView> {
    const result = await coreCreate(this.ctx, this.budget, this.config, this.cache, { ...input, initialStatus: 'backlog' }, this.holder)
    if (result.todo === null) throw new Error('todo: 创建成功但未能读回记录')
    return viewOf(result.todo)
  }

  /** Toggle complete / reopen (panel checkbox path) — user-direct fast path (D9). */
  async toggle(todoId: string): Promise<YzjTodoView> {
    const current = await this.state()
    const existing = current.todos.find(todo => todo.todoId === todoId)
    if (existing === undefined) throw new Error(`todo: 待办 ${todoId} 不存在`)
    const target: TodoStatus = existing.status === 'done' ? 'in_progress' : 'done'
    const result = await coreSetStatus(this.ctx, this.budget, this.config, this.cache, todoId, target, {
      note: target === 'done' ? '面板勾选完成' : '面板重开',
      verb: target === 'done' ? '完成' : '重开',
      force: target === 'done',
    }, this.holder)
    return viewOf(result.todo)
  }

  /** Human approve (backlog→todo) — panel direct write (D9, no card). */
  async approve(todoId: string, note?: string): Promise<YzjTodoView> {
    const result = await coreSetStatus(this.ctx, this.budget, this.config, this.cache, todoId, 'todo', { verb: '批准', note }, this.holder)
    return viewOf(result.todo)
  }

  /** Human accept (in_review→done) — the review gate; done only enters here or the checkbox fast path (S2). */
  async accept(todoId: string, note?: string): Promise<YzjTodoView> {
    const result = await coreSetStatus(this.ctx, this.budget, this.config, this.cache, todoId, 'done', { verb: '验收通过', note }, this.holder)
    return viewOf(result.todo)
  }

  /**
   * Human 打回 — target derived from the current state (host owns the map):
   * todo→backlog / in_progress→todo（清认领）/ in_review→in_progress。
   */
  async sendBack(todoId: string, note?: string): Promise<YzjTodoView> {
    const { todo } = await mustFetch(this.ctx, this.budget, this.config, this.cache, todoId, this.holder)
    const targets: Partial<Record<TodoStatus, TodoStatus>> = { todo: 'backlog', in_progress: 'todo', in_review: 'in_progress' }
    const target = targets[todo.status]
    if (target === undefined) throw new Error(`todo: 「${todo.title}」当前 ${todo.status}，没有可打回的边`)
    const result = await coreSetStatus(this.ctx, this.budget, this.config, this.cache, todoId, target, {
      verb: '打回', note, clearClaim: todo.status === 'in_progress',
    }, this.holder)
    return viewOf(result.todo)
  }

  /** Human cancel (any open→cancelled) — 唯一终止坑（无删除工具）。 */
  async cancel(todoId: string, note?: string): Promise<YzjTodoView> {
    const { todo } = await mustFetch(this.ctx, this.budget, this.config, this.cache, todoId, this.holder)
    if (todo.status === 'done' || todo.status === 'cancelled') throw new Error(`todo: 「${todo.title}」已是终局（${todo.status}），不能中止`)
    const result = await coreSetStatus(this.ctx, this.budget, this.config, this.cache, todoId, 'cancelled', { verb: '中止', note, clearClaim: todo.status === 'in_progress' }, this.holder)
    return viewOf(result.todo)
  }

  /** One todo by id（todo-dispatch RPC 读任务卡）。 */
  async get(todoId: string): Promise<YzjTodoView> {
    const { todo } = await mustFetch(this.ctx, this.budget, this.config, this.cache, todoId, this.holder)
    return viewOf(todo)
  }

  /** Human reopen of a cancelled todo (cancelled→todo，回可认领列)。 */
  async reopen(todoId: string): Promise<YzjTodoView> {
    const result = await coreSetStatus(this.ctx, this.budget, this.config, this.cache, todoId, 'todo', { verb: '重开' }, this.holder)
    return viewOf(result.todo)
  }

  /** Human archive/unarchive (S10)——视图层隐藏，非状态。 */
  async setArchived(todoId: string, archived: boolean): Promise<YzjTodoView> {
    const result = await coreSetArchived(this.ctx, this.budget, this.config, this.cache, todoId, archived, this.holder)
    return viewOf(result.todo)
  }

  /**
   * Human edit of task details (S7): 标题/描述/DDL/负责人/优先级/标签。
   * 描述是 agent 认领后执行的提示词本体——批准前改它是第一闸的本职。
   */
  async edit(todoId: string, patch: { title?: string; description?: string; ddl?: string; assignee?: string; priority?: string; tags?: readonly string[] }): Promise<YzjTodoView> {
    const { todo, binding } = await mustFetch(this.ctx, this.budget, this.config, this.cache, todoId, this.holder)
    const changes: string[] = []
    const fields: Record<string, unknown> = {}
    if (patch.title !== undefined && patch.title.trim() !== '' && patch.title.trim() !== todo.title) {
      fields[F.title] = patch.title.trim()
      changes.push(`标题→${patch.title.trim()}`)
    }
    if (patch.description !== undefined && patch.description.trim() !== todo.description) {
      fields[F.desc] = patch.description.trim()
      changes.push('描述已更新')
    }
    if (patch.ddl !== undefined && patch.ddl.trim() !== '') {
      const ddl = normalizeDdl(patch.ddl)
      if (ddl !== todo.ddl) {
        fields[F.ddl] = ddl
        changes.push(`DDL→${ddl}`)
      }
    }
    if (patch.assignee !== undefined && patch.assignee.trim() !== '') {
      const resolved = await resolveAssignee(this.ctx, this.budget, patch.assignee)
      if (resolved.value !== todo.assignee) {
        fields[F.assignee] = resolved.value
        changes.push(`负责人→${resolved.value}`)
      }
    }
    if (patch.priority !== undefined && patch.priority !== todo.priority) {
      fields[F.priority] = patch.priority
      changes.push(`优先级→${patch.priority}`)
    }
    if (patch.tags !== undefined) {
      const tags = normalizeTags(patch.tags)
      const nextTags = formatTags(tags)
      if (nextTags !== formatTags(todo.tags)) {
        fields[F.tags] = nextTags
        changes.push(`标签→${nextTags}`)
      }
    }
    if (changes.length === 0) return viewOf(todo)
    fields[F.log] = appendLog(todo.log, `${nowStamp()} 编辑 ${changes.join('；')}`)
    const wrote = await writeRecords(this.ctx, this.budget, 'sheet record update', binding, JSON.stringify([{ id: todo.recordId, fieldsValue: fields }]))
    if (!wrote.ok) throw new Error(wrote.content)
    return viewOf({
      ...todo,
      title: typeof fields[F.title] === 'string' ? fields[F.title] as string : todo.title,
      description: typeof fields[F.desc] === 'string' ? fields[F.desc] as string : todo.description,
      ddl: typeof fields[F.ddl] === 'string' ? fields[F.ddl] as string : todo.ddl,
      assignee: typeof fields[F.assignee] === 'string' ? parseAssignee(fields[F.assignee] as string).name : todo.assignee,
      priority: typeof fields[F.priority] === 'string' ? fields[F.priority] as string : todo.priority,
      tags: patch.tags === undefined ? todo.tags : normalizeTags(patch.tags),
      log: fields[F.log] as string,
    })
  }

  /** Keep a selected binding visible in the picker across scans. */
  private rememberLibrary(binding: TodoBinding, workspaceId?: string): void {
    const known = this.holder.known ?? []
    if (!known.some(ref => ref.docId === binding.docId)) {
      known.push({
        scope: 'team',
        workspaceId: workspaceId ?? '',
        workspaceName: '',
        docId: binding.docId,
        tableId: binding.tableId,
        link: binding.link,
      })
      this.holder.known = known
    }
  }
}

/** Lossless projection of a parsed todo for the wire. */
function viewOf(todo: YzjTodo): YzjTodoView {
  return {
    todoId: todo.todoId,
    title: todo.title,
    description: todo.description,
    status: todo.status,
    assignee: todo.assignee,
    assigneeOpenId: todo.assigneeOpenId,
    ddl: todo.ddl,
    priority: todo.priority,
    tags: todo.tags,
    log: todo.log,
    claimedBy: todo.claimedBy,
    version: todo.version,
    reviewNote: todo.reviewNote,
    archived: todo.archived,
    overdue: todo.overdue,
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Semantic todo core shared by the tools and the browser surface. */
    yzjTodo: YzjTodoService
  }
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

/** Register the semantic todo tool family. The yzjTodo service is
 * instantiated separately by the package entry (it needs a real Cordis
 * context); both share the same core operations. */
export function applyTodoTools(ctx: Context, budget: YzjToolBudget, config: TodoConfig, holder?: TodoBindingHolder): void {
  const cache: { binding?: TodoBinding } = {}

  const libraryMeta = (binding: TodoBinding): JsonValue =>
    ({ docId: binding.docId, tableId: binding.tableId, link: binding.link }) as unknown as JsonValue

  ctx.tools.register(defineTool({
    name: 'yzj_todo_list',
    description: 'List todos from the 泳道待办库. Filter by status (backlog 待我决定 / todo 可认领 / in_progress 进行中 / in_review 待我验收 / done / cancelled / overdue / open / all, default open), tag, or assignee name; sorted by DDL. Use tags to aggregate anything — a tag can be a project, a group, or any theme.',
    parameters: {
      status: { type: 'string', enum: ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled', 'overdue', 'open', 'all'], description: 'open = not done/cancelled; overdue = DDL passed and not terminal; default open.' },
      tag: { type: 'string', description: 'Only todos carrying this tag (no # prefix needed).' },
      assignee: { type: 'string', description: 'Only todos whose 负责人 name matches (substring).' },
      limit: { type: 'number', description: 'Max rows in the digest, 1-100, default 50.' },
    },
    output: yzjToolOutput,
    timeoutMs: budget.timeoutMs * 2,
    isConcurrencySafe: () => true,
    async execute(args) {
      let binding: TodoBinding
      try {
        binding = await resolveLibrary(ctx, budget, config, cache, false, holder)
      } catch (error) {
        return { content: `(待办任务库未开通) ${String((error as Error).message)}`, truncated: false, data: { kind: 'todo-list', ready: false } }
      }
      let todos: YzjTodo[]
      try {
        todos = await fetchTodos(ctx, budget, binding)
      } catch (error) {
        return { content: `yzj todo list failed: ${String((error as Error).message)}`, truncated: false, data: {} }
      }
      const status = args.status ?? 'open'
      const tag = args.tag === undefined ? '' : args.tag.replace(/^#+/, '').trim()
      const assignee = (args.assignee ?? '').trim()
      const filtered = todos.filter(todo => {
        if (todo.archived) return false
        if (status === 'open' && (todo.status === 'done' || todo.status === 'cancelled')) return false
        if ((TODO_STATUSES as readonly string[]).includes(status) && todo.status !== status) return false
        if (status === 'overdue' && !todo.overdue) return false
        if (tag !== '' && !todo.tags.includes(tag)) return false
        if (assignee !== '' && !todo.assignee.includes(assignee)) return false
        return true
      })
      const sorted = filtered.sort((a, b) => {
        if (a.ddl === '' && b.ddl === '') return a.todoId < b.todoId ? -1 : 1
        if (a.ddl === '') return 1
        if (b.ddl === '') return -1
        return a.ddl === b.ddl ? (a.todoId < b.todoId ? -1 : 1) : (a.ddl < b.ddl ? -1 : 1)
      })
      const limit = args.limit === undefined ? 50 : args.limit
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        throw new Error('yzj_todo_list: limit must be an integer between 1 and 100')
      }
      const shown = sorted.slice(0, limit)
      const head = `待办任务库 (${binding.link}) · ${status}${tag === '' ? '' : ` #${tag}`} · ${sorted.length} 条`
      const content = [head, ...(shown.length === 0 ? ['(无匹配待办)'] : shown.map(todoLine))].join('\n')
      return {
        content,
        truncated: false,
        data: {
          kind: 'todo-list',
          ready: true,
          list: clipJson(shown, { maxChars: budget.maxMetaChars }),
          total: sorted.length,
          library: libraryMeta(binding),
        } as unknown as JsonValue,
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'yzj_todo_create',
    description: 'Create a todo in the 泳道待办库 (auto-provisions the library on first use). Lands in backlog（待我决定）——人批准后才进可认领列（S6）；描述 = 认领后执行的提示词本体，写给未来的自己（S7）。Idempotent: pass todoId to adopt an existing todo instead of creating a duplicate. Tags aggregate freely (#项目 #群名 …). 分流判据（决策 46）：待办 = 完成标准自明的轻量单动作；有业务目标/成功指标、需跨时间跟进与验收的事用 `yzj_advance_create` 建推进事项（一条待办可作为事元挂进事项，其完成经 todo:<id> 订阅回流）。',
    parameters: {
      title: { type: 'string', required: true, description: 'Todo title.' },
      description: { type: 'string', description: '描述（S7）：认领这条待办的 agent 要执行的提示词本体——目标、上下文、完成标准。人可在面板改。' },
      todoId: { type: 'string', description: 'Explicit stable id (T-YYYYMMDD-NNN); when it already exists the existing todo is returned unchanged (idempotent).' },
      assignee: { type: 'string', description: 'Assignee name (resolved to 姓名(openId) when the directory match is unique) or a preformatted 姓名(openId) value.' },
      ddl: { type: 'string', description: 'Deadline as YYYY-MM-DD or YYYY/MM/DD.' },
      priority: { type: 'string', enum: ['P0', 'P1', 'P2'], description: 'Priority.' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Tags for aggregation (project, group, theme…); # prefixes are stripped and normalized.' },
      refs: { type: 'array', items: { type: 'string' }, description: 'Referenced Yunzhijia ref tokens (yzj:... from dragged/@-picked chips) this todo originates from; recorded in the progress log and shown on the confirmation card. Never sent to the CLI.' },
    },
    output: yzjToolOutput,
    timeoutMs: budget.timeoutMs * 3,
    isConcurrencySafe: () => false,
    async execute(args) {
      let result: CoreCreateResult
      try {
        result = await coreCreate(ctx, budget, config, cache, {
          title: args.title,
          description: args.description,
          initialStatus: 'backlog',
          todoId: args.todoId,
          assignee: args.assignee,
          ddl: args.ddl,
          priority: args.priority,
          tags: args.tags,
          refs: args.refs,
        }, holder)
      } catch (error) {
        return { content: `yzj todo create failed: ${String((error as Error).message)}`, truncated: false, data: {} }
      }
      if (result.idempotent && result.todo !== null) {
        return {
          content: `已存在（幂等命中，未重复创建）：${todoLine(result.todo)}`,
          truncated: false,
          data: { kind: 'todo-create', idempotentHit: true, todoId: result.todo.todoId, todo: clipJson(result.todo, { maxChars: budget.maxMetaChars }), library: libraryMeta(result.binding) } as unknown as JsonValue,
        }
      }
      const todo = result.todo
      const content = [
        `created 待办 ${todo?.todoId ?? ''} · ${args.title.trim()}（落「待我决定」，人批准后 agent 可认领）${(args.tags ?? []).length > 0 ? ` · ${formatTags(normalizeTags(args.tags))}` : ''}${result.assigneeNote}`,
        `任务库 ${result.binding.link}`,
      ].join('\n')
      return {
        content,
        truncated: false,
        data: {
          kind: 'todo-create',
          todoId: todo?.todoId ?? '',
          title: args.title.trim(),
          description: args.description ?? '',
          tags: normalizeTags(args.tags),
          assignee: args.assignee ?? '',
          ddl: args.ddl === undefined ? '' : normalizeDdl(args.ddl),
          priority: args.priority ?? '',
          refs: args.refs ?? [],
          library: libraryMeta(result.binding),
        } as unknown as JsonValue,
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'yzj_todo_update',
    description: 'Update one todo by todoId: 描述（认领后执行的提示词本体）, assignee, ddl, priority, tags (replaced), plus an optional appendLog note. The progress log is appended host-side and cannot be rewritten. 状态不走这里——状态只能走合法边：agent 用 yzj_todo_claim / yzj_todo_submit_review / yzj_todo_release_claim，done 快路径用 yzj_todo_complete。',
    parameters: {
      todoId: { type: 'string', required: true, description: 'Stable todo id (from yzj_todo_list).' },
      description: { type: 'string', description: 'New 描述（提示词本体）。' },
      assignee: { type: 'string', description: 'New assignee (name resolved when unique, or 姓名(openId)).' },
      ddl: { type: 'string', description: 'New deadline (YYYY-MM-DD or YYYY/MM/DD).' },
      priority: { type: 'string', enum: ['P0', 'P1', 'P2'], description: 'New priority.' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Replacement tag set.' },
      appendLog: { type: 'string', description: 'Optional note appended to the progress log with a timestamp.' },
    },
    output: yzjToolOutput,
    timeoutMs: budget.timeoutMs * 3,
    isConcurrencySafe: () => false,
    async execute(args) {
      let binding: TodoBinding
      try {
        binding = await resolveLibrary(ctx, budget, config, cache, false, holder)
      } catch (error) {
        return { content: `yzj todo update failed: ${String((error as Error).message)}`, truncated: false, data: {} }
      }
      const existing = await fetchTodoByTodoId(ctx, budget, binding, args.todoId)
      if (existing === undefined) {
        throw new Error(`yzj_todo_update: 待办 ${args.todoId} 不存在；先用 yzj_todo_list 查真实 id，不要猜测`)
      }
      const changes: string[] = []
      const fields: Record<string, unknown> = {}
      if (args.description !== undefined) {
        fields[F.desc] = args.description.trim()
        changes.push('描述已更新')
      }
      if (args.assignee !== undefined && args.assignee.trim() !== '') {
        const resolved = await resolveAssignee(ctx, budget, args.assignee)
        fields[F.assignee] = resolved.value
        changes.push(`负责人→${resolved.value}`)
      }
      if (args.ddl !== undefined && args.ddl.trim() !== '') {
        const ddl = normalizeDdl(args.ddl)
        fields[F.ddl] = ddl
        changes.push(`DDL→${ddl}`)
      }
      if (args.priority !== undefined) {
        fields[F.priority] = args.priority
        changes.push(`优先级→${args.priority}`)
      }
      if (args.tags !== undefined) {
        const tags = normalizeTags(args.tags)
        if (tags.length > 0) fields[F.tags] = formatTags(tags)
        changes.push(`标签→${formatTags(tags)}`)
      }
      if (changes.length === 0 && args.appendLog === undefined) {
        return { content: `无变更：${todoLine(existing)}`, truncated: false, data: { kind: 'todo-update', todoId: args.todoId, changes: [] } as unknown as JsonValue }
      }
      const logLines: string[] = []
      if (changes.length > 0) logLines.push(`${nowStamp()} ${changes.join('；')}`)
      if (args.appendLog !== undefined && args.appendLog.trim() !== '') logLines.push(`${nowStamp()} 备注 ${args.appendLog.trim()}`)
      if (logLines.length > 0) fields[F.log] = appendLog(existing.log, logLines.join('\n'))
      const wrote = await writeRecords(ctx, budget, 'sheet record update', binding, JSON.stringify([{ id: existing.recordId, fieldsValue: fields }]))
      if (!wrote.ok) return { content: wrote.content, truncated: false, data: {} }
      const content = `updated 待办 ${args.todoId}${changes.length > 0 ? `（${changes.join('；')}）` : '（追加日志）'}\n任务库 ${binding.link}`
      return {
        content,
        truncated: false,
        data: {
          kind: 'todo-update',
          todoId: args.todoId,
          title: existing.title,
          changes,
          library: libraryMeta(binding),
        } as unknown as JsonValue,
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'yzj_todo_complete',
    description: 'Complete a todo from any state (sets 状态=done and appends a log line) — 人直写 done 的快路径（不经 review；标准确认卡门控）。泳道主径是 claim→交卷→人验收；重开是面板「打回」或重开操作。',
    parameters: {
      todoId: { type: 'string', required: true, description: 'Stable todo id.' },
      note: { type: 'string', description: 'Optional completion note appended to the log.' },
    },
    output: yzjToolOutput,
    timeoutMs: budget.timeoutMs * 3,
    isConcurrencySafe: () => false,
    async execute(args) {
      let result: CoreStatusResult
      try {
        result = await coreSetStatus(ctx, budget, config, cache, args.todoId, 'done', { note: args.note, verb: '完成', force: true }, holder)
      } catch (error) {
        return { content: `yzj todo complete failed: ${String((error as Error).message)}`, truncated: false, data: {} }
      }
      if (!result.changed) {
        return { content: `已是完成态（幂等命中）：${todoLine(result.todo)}`, truncated: false, data: { kind: 'todo-complete', idempotentHit: true, todoId: args.todoId } as unknown as JsonValue }
      }
      return {
        content: `completed 待办 ${args.todoId} · ${result.todo.title}\n任务库 ${result.binding.link}`,
        truncated: false,
        data: {
          kind: 'todo-complete',
          todoId: args.todoId,
          title: result.todo.title,
          statusFrom: result.from,
          statusTo: 'done',
          library: libraryMeta(result.binding),
        } as unknown as JsonValue,
      }
    },
  }))

  // --- claim family (泳道待办, todo-swimlane-agent §2.2)：agent 执行回路。 ---
  // S3：三个都静默无卡（可逆、无外部写；done 永远只经人 accept）。

  ctx.tools.register(defineTool({
    name: 'yzj_todo_claim',
    description: 'Claim one todo from the 可认领 column (todo→in_progress). Exclusive: only an unclaimed todo-state task qualifies, the machine rejects double claims; your session id is recorded for audit. the todo 的 描述 field is the task brief you execute. Workflow: claim → do the work → yzj_todo_submit_review; blocked or giving up → yzj_todo_release_claim with note「阻塞：<原因>」（阻塞是备注不是状态, S8）。You can NEVER set done — only the human accepts (S2). Silent by design (S3): reversible, no external write.',
    parameters: {
      todoId: { type: 'string', required: true, description: 'Stable todo id (from yzj_todo_list status=todo).' },
    },
    output: yzjToolOutput,
    timeoutMs: budget.timeoutMs * 2,
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      try {
        const result = await coreClaim(ctx, budget, config, cache, args.todoId, exec?.agent?.session?.id ?? '', holder)
        const todo = result.todo
        return {
          content: [
            `claimed 待办 ${todo.todoId} · ${todo.title}（版本 v${todo.version}）`,
            todo.description === '' ? '描述：（空）——开工前先把上下文弄清，或请人在面板补充描述' : `描述（执行提示词）：${todo.description}`,
            '干完用 yzj_todo_submit_review 交卷；done 只经人验收。卡住用 yzj_todo_release_claim note=「阻塞：…」。',
          ].join('\n'),
          truncated: false,
          data: { kind: 'todo-claim', todoId: todo.todoId, title: todo.title, description: todo.description, version: todo.version, statusFrom: result.from, statusTo: 'in_progress' } as unknown as JsonValue,
        }
      } catch (error) {
        return { content: `yzj todo claim failed: ${String((error as Error).message)}`, truncated: false, data: {} }
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'yzj_todo_submit_review',
    description: 'Submit a claimed todo for human acceptance (in_progress→in_review) with a result note and optional evidence refs. done never enters here — only the human accepts on the panel (S2). Silent by design (S3).',
    parameters: {
      todoId: { type: 'string', required: true, description: 'Stable todo id (must be claimed by you, in_progress).' },
      note: { type: 'string', required: true, description: '结果说明——验收人靠它判断：做了什么 / 结果是什么 / 还剩什么。' },
      refs: { type: 'array', items: { type: 'string' }, description: 'Optional evidence ref tokens (yzj:... / im:<groupId>:<msgId> / docId) recorded in the log.' },
    },
    output: yzjToolOutput,
    timeoutMs: budget.timeoutMs * 2,
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      try {
        const result = await coreSubmitReview(ctx, budget, config, cache, args.todoId, args.note, args.refs, exec?.agent?.session?.id ?? '', holder)
        return {
          content: `交卷待验收 待办 ${args.todoId} · ${result.todo.title}\n验收说明：${result.todo.reviewNote}\n人在面板「待我验收」列验收；被打回会带评语回到进行中。`,
          truncated: false,
          data: { kind: 'todo-submit-review', todoId: args.todoId, title: result.todo.title, statusFrom: result.from, statusTo: 'in_review', reviewNote: result.todo.reviewNote } as unknown as JsonValue,
        }
      } catch (error) {
        return { content: `yzj todo submit_review failed: ${String((error as Error).message)}`, truncated: false, data: {} }
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'yzj_todo_release_claim',
    description: 'Release your claim on a todo (in_progress→todo, clears the claim record). Blocked? Pass note「阻塞：<原因>」——阻塞是备注不是状态（S8），卡片带着你的备注回到可认领列。Silent by design (S3).',
    parameters: {
      todoId: { type: 'string', required: true, description: 'Stable todo id (must be claimed by you, in_progress).' },
      note: { type: 'string', description: '释放原因；阻塞时写「阻塞：<原因>」。' },
    },
    output: yzjToolOutput,
    timeoutMs: budget.timeoutMs * 2,
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      try {
        const result = await coreReleaseClaim(ctx, budget, config, cache, args.todoId, args.note, exec?.agent?.session?.id ?? '', holder)
        return {
          content: `released 待办 ${args.todoId} · ${result.todo.title}（回可认领列${(args.note ?? '').trim() === '' ? '' : `，备注：${(args.note ?? '').trim()}`}）`,
          truncated: false,
          data: { kind: 'todo-release-claim', todoId: args.todoId, title: result.todo.title, statusFrom: result.from, statusTo: 'todo', note: args.note ?? '' } as unknown as JsonValue,
        }
      } catch (error) {
        return { content: `yzj todo release_claim failed: ${String((error as Error).message)}`, truncated: false, data: {} }
      }
    },
  }))
}
