/**
 * Contact-domain tools: whoami, contact search, and user detail lookups.
 * All read-only; outputs render one line per user.
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { runValue, yzjToolOutput, asRecord, asString, clipJson, cliList, unwrapCli } from './shared.ts'
import type { YzjToolBudget } from './shared.ts'

/** One contact line: name, openId, department, job title, job number. */
function contactLine(record: unknown): string {
  const user = asRecord(record)
  const name = asString(user.name)
  const openId = asString(user.openId ?? user.oId)
  const department = asString(user.department ?? user.fulldepartment)
  const jobTitle = asString(user.jobTitle)
  const jobNo = asString(user.jobNo)
  const parts = [name === '' ? openId : name]
  if (department !== '') parts.push(department)
  if (jobTitle !== '') parts.push(jobTitle)
  if (jobNo !== '') parts.push(`工号 ${jobNo}`)
  if (openId !== '' && openId !== name) parts.push(`<${openId}>`)
  return parts.join(' · ')
}

/**
 * User rows from `whoami` (one object) or `contact user get/search`
 * (bare array / `{list}` / leftover `.data`).
 */
function usersOf(json: unknown): unknown[] {
  const listed = cliList(json, ['list'])
  if (listed.length > 0) return listed
  const payload = unwrapCli(json)
  if (Array.isArray(payload)) return payload
  const rec = asRecord(payload)
  if (asString(rec.openId ?? rec.oId ?? rec.name) !== '') return [payload]
  return []
}

/** Register the three contact tools. */
export function applyContactTools(ctx: Context, budget: YzjToolBudget): void {
  ctx.tools.register(defineTool({
    name: 'yzj_whoami',
    description: 'Return the current yzj-cli login user (yzj-cli whoami): name, openId, department, job title, job number, and token status.',
    parameters: {},
    output: yzjToolOutput,
    timeoutMs: budget.timeoutMs,
    isConcurrencySafe: () => true,
    async execute() {
      return runValue(ctx, budget, 'whoami', ['whoami'], (json) => {
        const users = usersOf(json)
        const lines = users.map(contactLine)
        const rec = asRecord(users[0])
        const token = asString(rec.tokenStatus)
        const content = [
          lines.length === 0 ? '(no user info)' : lines.join('\n'),
          ...(token === '' ? [] : [`token ${token}`]),
        ].join('\n')
        return { content, data: { record: rec, users: clipJson(users, { maxChars: budget.maxMetaChars }) } }
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'yzj_contact_search',
    description: 'Search the Yunzhijia contact directory by keyword (name etc.). Returns one line per match with openId for follow-up get/send calls.',
    parameters: {
      keyword: { type: 'string', required: true, description: 'Search keyword (a name or other directory term).' },
      orgId: { type: 'string', description: 'Optional org/department id to scope the search.' },
    },
    output: yzjToolOutput,
    timeoutMs: budget.timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args) {
      const command = ['contact', 'user', 'search', '--keyword', args.keyword]
      if (args.orgId !== undefined) command.push('--org-id', args.orgId)
      return runValue(ctx, budget, 'contact user search', command, (json) => {
        const users = usersOf(json)
        const lines = users.map(contactLine)
        const content = lines.length === 0 ? '(no matches)' : lines.join('\n')
        return { content, data: { list: clipJson(users, { maxChars: budget.maxMetaChars }) } }
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'yzj_contact_get',
    description: 'Fetch Yunzhijia user details by openId (repeatable); without openIds returns the current login user.',
    parameters: {
      openIds: { type: 'array', items: { type: 'string' }, description: 'One or more openIds to fetch; omit to fetch the current user.' },
    },
    output: yzjToolOutput,
    timeoutMs: budget.timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args) {
      const openIds = args.openIds ?? []
      if (openIds.some(id => id.trim() === '')) {
        throw new Error('yzj_contact_get: openIds must not contain empty strings')
      }
      const command = ['contact', 'user', 'get']
      for (const id of openIds) command.push('--open-id', id)
      return runValue(ctx, budget, 'contact user get', command, (json) => {
        const users = usersOf(json)
        const lines = users.map(contactLine)
        const content = lines.length === 0 ? '(no user info)' : lines.join('\n')
        return { content, data: { list: clipJson(users, { maxChars: budget.maxMetaChars }) } }
      })
    },
  }))
}
