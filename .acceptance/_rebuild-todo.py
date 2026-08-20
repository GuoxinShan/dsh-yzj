#!/usr/bin/env python3
"""One-shot: insert sqlite branches into pristine todo.ts (决策 37)."""
path = 'packages/tool-yzj/src/todo.ts'
text = open(path).read()

text = text.replace("import type { YzjToolBudget } from './shared.ts'", "import type { YzjToolBudget } from './shared.ts'\nimport { localStore } from './local-store.ts'\n\n/** v1.8 决策 37: 'sqlite' = 真机本地 SQLite（index.ts apply 启用）；'dbt' = 测试 double（FakeStore 命令脚本）。云 dbt 在真机已死。 */\nlet todoBackend: 'dbt' | 'sqlite' = 'dbt'\nexport function setTodoBackend(next: 'dbt' | 'sqlite'): void {\n  todoBackend = next\n}")

def insert_branch(marker, branch):
    global text
    s = text.index(marker)
    sig_end_line = text.index('\n', text.index('): ', s))
    brace = text.rindex('{', 0, sig_end_line)
    text = text[:brace + 1] + '\n' + branch + text[brace + 1:]

insert_branch('export async function resolveLibrary(', """  if (todoBackend === 'sqlite') {
    const local: TodoBinding = { docId: 'local-sqlite', tableId: 0, link: '' }
    cache.binding = local
    return local
  }
""")
insert_branch('export async function fetchTodos(', """  if (todoBackend === 'sqlite') {
    return localStore().listTodos()
      .map(row => parseTodoRecord({ id: row.recordId, fields: row.fields }))
      .filter((todo): todo is YzjTodo => todo !== null)
  }
""")
insert_branch('export async function fetchTodoByTodoId(', """  if (todoBackend === 'sqlite') {
    const row = localStore().todo(todoId)
    if (row === undefined) return undefined
    return parseTodoRecord({ id: row.recordId, fields: row.fields }) ?? undefined
  }
""")
insert_branch('async function writeRecords(', """  if (todoBackend === 'sqlite') {
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
""")
open(path, 'w').write(text)
print('todo dual-backend ok (pristine + branches)')
