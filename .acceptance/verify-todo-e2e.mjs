/**
 * Swimlane todo E2E (hermetic): drives the tool family from source against a
 * throwaway local SQLite store (YZJ_ADVANCE_DB override; 决策 36/37 真机后端),
 * so no yzj-cli login and no running GUI are needed. Covers the six-state
 * loop (todo-swimlane-agent §2.1): agent create lands backlog (S6) → claim
 * rejected before approval → human approve → claim → submit_review → human
 * accept → done; plus 打回 / 中止 / 重开 / 幂等. Run: node .acceptance/verify-todo-e2e.mjs
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Isolate the store BEFORE importing the module (the singleton opens lazily).
const dir = mkdtempSync(join(tmpdir(), 'yzj-todo-e2e-'))
process.env.YZJ_ADVANCE_DB = join(dir, 'e2e.db')

const { applyTodoTools, setTodoBackend, coreSetStatus, fetchTodoByTodoId } = await import(new URL('../packages/tool-yzj/src/todo.ts', import.meta.url).href)

setTodoBackend('sqlite')

const BUDGET = { timeoutMs: 30_000, maxRenderChars: 5_000, maxMetaChars: 20_000 }
const tools = new Map()
const ctx = { tools: { register(def) { tools.set(def.name, def) } } }
applyTodoTools(ctx, BUDGET, {})

const run = async (name, args = {}) => {
  const tool = tools.get(name)
  if (tool === undefined) throw new Error(`tool ${name} not registered`)
  return tool.execute(args)
}
/** Human verbs are panel-direct RPC writes (D9); here we drive the same core. */
const human = (todoId, target, opts = {}) => coreSetStatus(ctx, BUDGET, {}, {}, todoId, target, opts)
const readBack = async (todoId) => fetchTodoByTodoId(ctx, BUDGET, { docId: 'local-sqlite', tableId: 0, link: '' }, todoId)

let passed = 0
let failed = 0
const check = (label, cond, detail = '') => {
  if (cond) { passed += 1; console.log(`  PASS  ${label}`) } else { failed += 1; console.log(`  FAIL  ${label} ${detail}`) }
}

console.log('\n[1] agent create lands backlog（S6：落「待我决定」）')
const created = await run('yzj_todo_create', { title: 'E2E 泳道探针', description: '提示词本体：验证泳道六态', tags: ['泳道'], ddl: '2026-08-30' })
check('create digest', created.content.includes('created 待办'), created.content)
const todoId = created.data.todoId
check('todo id allocated T-…', /^T-\d{8}-\d{3}$/.test(todoId), String(todoId))
check('lands backlog', created.data && (await readBack(todoId))?.status === 'backlog')

console.log('\n[2] claim before approval is rejected（人批准闸）')
const early = await run('yzj_todo_claim', { todoId })
check('claim rejected with 批准 hint', early.content.includes('待我决定') && early.content.includes('批准'), early.content)

console.log('\n[3] human approve → 可认领；claim → 进行中（版本递增）')
await human(todoId, 'todo', { verb: '批准' })
check('approved to todo', (await readBack(todoId))?.status === 'todo')
const claimed = await run('yzj_todo_claim', { todoId })
check('claimed', claimed.content.includes('claimed 待办'), claimed.content)
const afterClaim = await readBack(todoId)
check('in_progress + version 2（批准 v1 → 认领 v2）', afterClaim?.status === 'in_progress' && afterClaim?.version === 2, JSON.stringify({ status: afterClaim?.status, version: afterClaim?.version }))

console.log('\n[4] submit_review → 待我验收（验收说明落库）；重复 claim 排他')
const double = await run('yzj_todo_claim', { todoId })
check('double claim rejected（排他）', double.content.includes('只有「可认领」状态能认领'), double.content)
const submitted = await run('yzj_todo_submit_review', { todoId, note: '探针执行完毕', refs: ['yzj:doc:e2e'] })
check('submitted for review', submitted.content.includes('交卷待验收'), submitted.content)
check('review note stored', (await readBack(todoId))?.reviewNote.includes('探针执行完毕'))

console.log('\n[5] human accept → done（验收闸，S2）；open 列表排除 done')
await human(todoId, 'done', { verb: '验收通过' })
check('accepted to done', (await readBack(todoId))?.status === 'done')
const open = await run('yzj_todo_list', {})
check('open list excludes done', !open.content.includes('E2E 泳道探针'), open.content)
const all = await run('yzj_todo_list', { status: 'all' })
check('all list shows done', all.content.includes('E2E 泳道探针') && all.content.includes('done'))

console.log('\n[6] 打回 / 中止 / 重开')
const second = await run('yzj_todo_create', { title: 'E2E 打回探针' })
const todoId2 = second.data.todoId
await human(todoId2, 'todo', { verb: '批准' })
await run('yzj_todo_claim', { todoId: todoId2 })
await human(todoId2, 'todo', { verb: '打回', note: '先别做', clearClaim: true })
const bounced = await readBack(todoId2)
check('打回清认领回可认领', bounced?.status === 'todo' && bounced?.claimedBy === '', JSON.stringify({ status: bounced?.status, claimedBy: bounced?.claimedBy }))
await human(todoId2, 'cancelled', { verb: '中止', note: '不需要了' })
check('中止到 cancelled', (await readBack(todoId2))?.status === 'cancelled')
await human(todoId2, 'todo', { verb: '重开' })
check('cancelled 重开回 todo', (await readBack(todoId2))?.status === 'todo')

console.log('\n[7] idempotent re-create with the same todoId')
const again = await run('yzj_todo_create', { title: 'E2E 泳道探针', todoId })
check('idempotent hit', again.content.includes('幂等命中'), again.content)

console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'}  ${passed} passed, ${failed} failed`)
rmSync(dir, { recursive: true, force: true })
process.exit(failed === 0 ? 0 : 1)
