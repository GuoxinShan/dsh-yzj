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
  status: '状态',
  assignee: '负责人',
  ddl: 'DDL',
  priority: '优先级',
  tags: '标签',
  source: '来源',
  log: '推进日志',
} as const

/** Library titles used for discovery/provisioning. */
const LIBRARY_TITLE = '待办任务库'
const TABLE_NAME = '任务'

/** Status values of the todo state machine. */
export type TodoStatus = 'pending' | 'in_progress' | 'done'

/** One parsed todo record. */
export interface YzjTodo {
  recordId: string
  todoId: string
  title: string
  status: TodoStatus
  assignee: string
  assigneeOpenId: string
  ddl: string
  priority: string
  tags: string[]
  log: string
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

/** Whether a todo is overdue (DDL passed and not done). */
export function isOverdue(status: string, ddl: string, today = todayStr()): boolean {
  return status !== 'done' && ddl !== '' && ddl < today
}

/**
 * Validate a status transition; returns an error message or null.
 * pending→done must go through yzj_todo_complete (or in_progress).
 */
export function checkTransition(from: string, to: string): string | null {
  if (from === to) return null
  const allowed: Record<string, string[]> = {
    pending: ['in_progress'],
    in_progress: ['pending', 'done'],
    done: ['in_progress'],
  }
  const targets = allowed[from] ?? []
  if (targets.includes(to)) return null
  return `状态机拒绝 ${from} → ${to}：合法流转为 pending→in_progress→done（done→in_progress 可重开，in_progress→pending 可打回）；直接完成请用 yzj_todo_complete`
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
  const status = asString(fields[F.status]) || 'pending'
  const assignee = asString(fields[F.assignee])
  const parsed = parseAssignee(assignee)
  const ddl = normalizeDdl(asString(fields[F.ddl]))
  return {
    recordId: asString(row.id ?? row.recordId),
    todoId,
    title: asString(fields[F.title]),
    status: (['pending', 'in_progress', 'done'].includes(status) ? status : 'pending') as TodoStatus,
    assignee: parsed.name,
    assigneeOpenId: parsed.openId,
    ddl,
    priority: asString(fields[F.priority]),
    tags: normalizeTags(asString(fields[F.tags])),
    log: asString(fields[F.log]),
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
    { name: F.status, type: 'SingleSelect', data: { items: [{ value: 'pending' }, { value: 'in_progress' }, { value: 'done' }] } },
    { name: F.assignee, type: 'MultiLineText' },
    { name: F.ddl, type: 'Date' },
    { name: F.priority, type: 'SingleSelect', data: { items: [{ value: 'P0' }, { value: 'P1' }, { value: 'P2' }] } },
    { name: F.tags, type: 'MultiLineText' },
    { name: F.source, type: 'Url' },
    { name: F.log, type: 'MultiLineText' },
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
  const fields: Record<string, unknown> = { [F.id]: todoId, [F.title]: title, [F.status]: 'pending' }
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
  fields[F.log] = `${nowStamp()} 创建${refLine}`
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

/**
 * Set a todo's status with state-machine enforcement and host-appended log.
 * `done` from any state is the complete convenience; `changed: false` marks
 * an idempotent hit (already at target).
 */
export async function coreSetStatus(
  ctx: Context,
  budget: YzjToolBudget,
  config: TodoConfig,
  cache: { binding?: TodoBinding },
  todoId: string,
  target: TodoStatus,
  note?: string,
  holder?: TodoBindingHolder,
): Promise<CoreStatusResult> {
  const binding = await resolveLibrary(ctx, budget, config, cache, false, holder)
  const existing = await fetchTodoByTodoId(ctx, budget, binding, todoId)
  if (existing === undefined) {
    throw new Error(`todo: 待办 ${todoId} 不存在；先用 yzj_todo_list 查真实 id，不要猜测`)
  }
  if (existing.status === target) return { todo: existing, from: existing.status, changed: false, binding }
  if (target !== 'done') {
    const violation = checkTransition(existing.status, target)
    if (violation !== null) throw new Error(`todo: ${violation}`)
  }
  const verb = target === 'done' ? '完成' : target === 'in_progress' ? '推进' : '打回'
  const noteText = note === undefined ? '' : note.trim()
  const log = appendLog(existing.log, `${nowStamp()} 状态 ${existing.status}→${target}（${verb}${noteText === '' ? '' : `：${noteText}`}）`)
  const wrote = await writeRecords(ctx, budget, 'sheet record update', binding, JSON.stringify([{ id: existing.recordId, fieldsValue: { [F.status]: target, [F.log]: log } }]))
  if (!wrote.ok) throw new Error(wrote.content)
  return { todo: { ...existing, status: target, log }, from: existing.status, changed: true, binding }
}

// ---------------------------------------------------------------------------
// yzjTodo host service (consumed by the ui-yzj RPC channel)
// ---------------------------------------------------------------------------

/** Panel-facing projection of one todo (lossless JSON). */
export interface YzjTodoView {
  todoId: string
  title: string
  status: TodoStatus
  assignee: string
  assigneeOpenId: string
  ddl: string
  priority: string
  tags: string[]
  log: string
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

  /** Quick-create (panel composer path). */
  async create(input: TodoCreateInput): Promise<YzjTodoView> {
    const result = await coreCreate(this.ctx, this.budget, this.config, this.cache, input, this.holder)
    if (result.todo === null) throw new Error('todo: 创建成功但未能读回记录')
    return viewOf(result.todo)
  }

  /** Toggle complete / reopen (panel checkbox path). */
  async toggle(todoId: string): Promise<YzjTodoView> {
    const current = await this.state()
    const existing = current.todos.find(todo => todo.todoId === todoId)
    if (existing === undefined) throw new Error(`todo: 待办 ${todoId} 不存在`)
    const target: TodoStatus = existing.status === 'done' ? 'in_progress' : 'done'
    const result = await coreSetStatus(this.ctx, this.budget, this.config, this.cache, todoId, target, target === 'done' ? '面板勾选完成' : '面板重开', this.holder)
    return viewOf(result.todo)
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
    status: todo.status,
    assignee: todo.assignee,
    assigneeOpenId: todo.assigneeOpenId,
    ddl: todo.ddl,
    priority: todo.priority,
    tags: todo.tags,
    log: todo.log,
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
    description: 'List todos from the 待办任务库 (demo-stage sheet backend). Filter by status (pending/in_progress/done/overdue/open/all, default open), tag, or assignee name; sorted by DDL. Use tags to aggregate anything — a tag can be a project, a group, or any theme.',
    parameters: {
      status: { type: 'string', enum: ['pending', 'in_progress', 'done', 'overdue', 'open', 'all'], description: 'open = not done; overdue = DDL passed and not done; default open.' },
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
        if (status === 'open' && todo.status === 'done') return false
        if (status === 'pending' || status === 'in_progress' || status === 'done') {
          if (todo.status !== status) return false
        }
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
    description: 'Create a todo in the 待办任务库 (auto-provisions the library on first use). Idempotent: pass todoId to adopt an existing todo instead of creating a duplicate. Tags aggregate freely (#项目 #群名 …). 分流判据（决策 46）：待办 = 完成标准自明的轻量单动作；有业务目标/成功指标、需跨时间跟进与验收的事用 `yzj_advance_create` 建推进事项（一条待办可作为事元挂进事项，其完成经 todo:<id> 订阅回流）。',
    parameters: {
      title: { type: 'string', required: true, description: 'Todo title.' },
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
        `created 待办 ${todo?.todoId ?? ''} · ${args.title.trim()}${(args.tags ?? []).length > 0 ? ` · ${formatTags(normalizeTags(args.tags))}` : ''}${result.assigneeNote}`,
        `任务库 ${result.binding.link}`,
      ].join('\n')
      return {
        content,
        truncated: false,
        data: {
          kind: 'todo-create',
          todoId: todo?.todoId ?? '',
          title: args.title.trim(),
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
    description: 'Update one todo by todoId: status (state machine enforced), assignee, ddl, priority, tags (replaced), plus an optional appendLog note. The progress log is appended host-side and cannot be rewritten.',
    parameters: {
      todoId: { type: 'string', required: true, description: 'Stable todo id (from yzj_todo_list).' },
      status: { type: 'string', enum: ['pending', 'in_progress', 'done'], description: 'New status; legal moves: pending→in_progress, in_progress↔pending/done, done→in_progress. pending→done must use yzj_todo_complete.' },
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
      if (args.status !== undefined && args.status !== existing.status) {
        const violation = checkTransition(existing.status, args.status)
        if (violation !== null) throw new Error(`yzj_todo_update: ${violation}`)
        fields[F.status] = args.status
        changes.push(`状态 ${existing.status}→${args.status}`)
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
          statusFrom: existing.status,
          statusTo: args.status ?? existing.status,
          changes,
          library: libraryMeta(binding),
        } as unknown as JsonValue,
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'yzj_todo_complete',
    description: 'Complete a todo from any state (sets 状态=done and appends a log line); reopening is yzj_todo_update with status in_progress.',
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
        result = await coreSetStatus(ctx, budget, config, cache, args.todoId, 'done', args.note, holder)
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
}
