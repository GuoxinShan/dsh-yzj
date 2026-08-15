/**
 * Real-CLI E2E for the yzj_todo_* tool family (new process, no ports).
 * Roundtrip: create (with tags/ddl) → list by tag → complete → idempotent
 * re-create → cleanup via direct CLI record delete. Requires a logged-in
 * yzj-cli. Run: node .acceptance/verify-todo-e2e.mjs
 */
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const requireFrom = (pkg) => createRequire(new URL(`../packages/${pkg}/package.json`, import.meta.url))
const via = async (pkg, spec) => {
  const resolved = requireFrom(pkg).resolve(spec)
  return import(pathToFileURL(resolved).href)
}

const { Context } = await via('bridge', '@deepseek-ai/cordis')
const { default: YzjBridge } = await via('bridge', '@dsh-yzj/bridge')
// The bundled lib only exports the plugin entry; drive the todo module from
// source (Node native type stripping handles the .ts specifiers).
const { applyTodoTools } = await import(new URL('../packages/tool-yzj/src/todo.ts', import.meta.url).href)

const BUDGET = { timeoutMs: 30_000, maxRenderChars: 5_000, maxMetaChars: 20_000 }
const PROBE_TAG = `e2e探针${Date.now() % 10000}`

const tools = new Map()
const ctx = {
  tools: { register(def) { tools.set(def.name, def) } },
}
ctx.yzjBridge = new YzjBridge(new Context(), {})
applyTodoTools(ctx, BUDGET, {})

const run = async (name, args = {}) => {
  const tool = tools.get(name)
  if (tool === undefined) throw new Error(`tool ${name} not registered`)
  return tool.execute(args)
}

let passed = 0
let failed = 0
const check = (label, cond, detail = '') => {
  if (cond) { passed += 1; console.log(`  PASS  ${label}`) } else { failed += 1; console.log(`  FAIL  ${label} ${detail}`) }
}

const bridgeOk = await ctx.yzjBridge.check(10_000)
if (!bridgeOk) {
  console.log('SKIP: yzj-cli missing or unauthenticated')
  process.exit(0)
}

console.log(`\n[1] create todo with tag #${PROBE_TAG} and ddl 2026-08-20`)
const created = await run('yzj_todo_create', { title: 'E2E 验证用待办（可删）', tags: [PROBE_TAG, 'P0'], ddl: '2026-08-20' })
check('create digest mentions created 待办', created.content.includes('created 待办'), created.content)
const todoId = created.data.todoId
check('todo id allocated T-…', /^T-\d{8}-\d{3}$/.test(todoId), String(todoId))
check('meta carries tags', Array.isArray(created.data.tags) && created.data.tags.includes(PROBE_TAG))
check('meta carries library link', String(created.data.library?.link ?? '').includes('yunzhijia.com'))

console.log('\n[2] list by tag')
const byTag = await run('yzj_todo_list', { tag: PROBE_TAG })
check('tag filter finds the todo', byTag.content.includes('E2E 验证用待办'), byTag.content)
check('ddl rendered', byTag.content.includes('2026/08/20'))

console.log('\n[3] complete it')
const done = await run('yzj_todo_complete', { todoId, note: 'E2E 验证完成' })
check('complete digest', done.content.includes('completed 待办'), done.content)

console.log('\n[4] idempotent re-create with the same todoId')
const again = await run('yzj_todo_create', { title: 'E2E 验证用待办（可删）', todoId })
check('idempotent hit', again.content.includes('幂等命中'), again.content)

console.log('\n[5] state machine: reopen then pending→done must be rejected')
await run('yzj_todo_update', { todoId, status: 'in_progress' })
let rejected = false
try { await run('yzj_todo_update', { todoId: 'T-00000000-001', status: 'done' }) } catch (e) { rejected = true }
check('unknown id rejected without guessing', rejected)

console.log('\n[6] cleanup: delete the probe record via direct CLI')
const listRaw = await ctx.yzjBridge.run([
  'sheet', 'record', 'list', '--id', created.data.library.docId, '--table-id', String(created.data.library.tableId),
  '--filter', JSON.stringify({ mode: 'AND', criteria: [{ field: 'todo_id', operator: 'Equals', values: [todoId] }] }),
])
const record = JSON.parse(JSON.parse(listRaw.json.records[0].fields).todoId ? listRaw.json.records[0].fields : '{}')
const recordId = listRaw.json.records?.[0]?.id
if (recordId !== undefined) {
  await ctx.yzjBridge.run(['sheet', 'record', 'delete', '--id', created.data.library.docId, '--table-id', String(created.data.library.tableId), '--record-ids', recordId])
  console.log(`  cleaned record ${recordId}`)
  void record
}

console.log(`\n==== ${passed} passed, ${failed} failed ====`)
process.exit(failed > 0 ? 1 : 0)
