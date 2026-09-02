/**
 * IM-domain tools: message sending, history listing, and recent group
 * sessions. Sending is a serious side effect and is gated by the approval
 * guard; the tool itself validates the mutually exclusive target and
 * msg-type/attachment combinations the CLI enforces.
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import {
  runValue, yzjToolOutput,
  asRecord, asArray, asString, asNumber, clipJson, fileIdMark, cliList, cliObject,
} from './shared.ts'
import type { YzjToolBudget } from './shared.ts'

/** Format "YYYY-MM-DD HH:mm:ss.SSS" as `MM-DD HH:mm`. */
function shortTime(text: unknown): string {
  const value = asString(text)
  return value.length >= 16 ? value.slice(5, 16) : value
}

/** One message line for history digests. */
function messageLine(record: unknown): string {
  const message = asRecord(record)
  const content = asString(message.content)
  const from = asString(message.fromOpenId)
  const time = shortTime(message.sendTime)
  const msgType = asString(message.msgType)
  const reply = asRecord(message.param)
  const replySummary = asString(reply.replySummary)
  const parts: string[] = []
  if (time !== '') parts.push(`[${time}]`)
  parts.push(from === '' ? '(unknown sender)' : from)
  const body = content === '' ? `(${msgType === '' ? 'message' : msgType})` : content
  const replyMark = replySummary === '' ? '' : ` ↳${replySummary}`
  const fileMark = fileIdMark(reply)
  parts.push(`${body}${fileMark}${replyMark}`)
  const msgId = asString(message.msgId)
  if (msgId !== '') parts.push(`<${msgId}>`)
  return parts.join(' ')
}

/** One group line for recent-session digests. */
function groupLine(record: unknown): string {
  const group = asRecord(record)
  const name = asString(group.groupName)
  const id = asString(group.groupId)
  const groupType = asNumber(group.groupType)
  const unread = asNumber(group.unreadCount)
  const last = asRecord(group.lastMsg)
  const lastContent = asString(last.content)
  const parts = [name === '' ? id : name]
  if (groupType !== undefined) parts.push(`类型${groupType}`)
  if (unread !== undefined && unread > 0) parts.push(`未读 ${unread}`)
  if (lastContent !== '') parts.push(`最近: ${lastContent.replace(/\s+/g, ' ').slice(0, 40)}`)
  if (id !== '' && id !== name) parts.push(`(${id})`)
  return parts.join(' · ')
}

/** One group-search-hit line: group header plus nested message previews. */
function searchHitLine(record: unknown): string {
  const row = asRecord(record)
  const group = asRecord(row.group)
  const name = asString(group.groupName || row.groupName)
  const id = asString(group.groupId || row.groupId)
  const matched = asNumber(row.matchedMessageCount)
  const messages = asArray(row.messages)
  const head = [
    name === '' ? id : name,
    matched !== undefined ? `命中 ${matched}` : (messages.length > 0 ? `命中 ${messages.length}` : ''),
    id !== '' && id !== name ? `(${id})` : '',
  ].filter(part => part !== '').join(' · ')
  const nested = messages.map((item) => {
    const wrapped = asRecord(item)
    const message = Object.keys(asRecord(wrapped.message)).length > 0 ? wrapped.message : item
    return `  ${messageLine(message)}`
  })
  return [head === '' ? '(group)' : head, ...nested].join('\n')
}

/** Flatten a message-search hit so the card can reuse the group renderer. */
function searchHitCard(record: unknown): Record<string, unknown> {
  const row = asRecord(record)
  const group = asRecord(row.group)
  const groupId = asString(group.groupId || row.groupId)
  const groupName = asString(group.groupName || row.groupName)
  const matched = asNumber(row.matchedMessageCount)
  const messages = asArray(row.messages)
  const preview = `${matched ?? messages.length} 条命中`
  return {
    groupId,
    groupName,
    matchedMessageCount: matched,
    messages,
    lastMsg: { content: preview },
  }
}

/** Register the im-domain tools. */
export function applyImTools(ctx: Context, budget: YzjToolBudget): void {
  ctx.tools.register(defineTool({
    name: 'yzj_im_message_send',
    description: 'Send an IM message to a group or direct chat. Exactly one of groupId / toOpenId; msg-type text|richText require content (file requires fileId). @ mentions need at-open-id per @姓名 in content and at-all per @all (group chats only). Reply uses replyMsgId with text/richText. Requires user confirmation before dispatch.',
    parameters: {
      groupId: { type: 'string', description: 'Target group or chat session id; mutually exclusive with toOpenId.' },
      toOpenId: { type: 'string', description: 'Direct-chat target openId; mutually exclusive with groupId.' },
      msgType: { type: 'string', required: true, enum: ['text', 'file', 'richText'], description: 'text or richText need content; file needs fileId.' },
      content: { type: 'string', description: 'Message body; required for text/richText. @all and @姓名 must be standalone fragments ("@all 请关注").' },
      fileId: { type: 'string', description: 'Uploaded file id (from yzj_file_upload); required for msg-type file.' },
      replyMsgId: { type: 'string', description: 'Reply-to message id; text/richText only.' },
      atOpenIds: { type: 'array', items: { type: 'string' }, description: 'One per @姓名 in content, in order; group chats only.' },
      atAll: { type: 'boolean', description: 'True when content contains @all (user must have explicitly asked for @all).' },
      images: { type: 'array', items: { type: 'string' }, description: 'File ids for [图片] placeholders in richText content.' },
      refs: { type: 'array', items: { type: 'string' }, description: 'Referenced Yunzhijia ref tokens (yzj:... encodings from dragged or @-picked chips) this message is based on; the confirmation card shows them as 关联引用. Never sent to the CLI.' },
    },
    output: yzjToolOutput,
    timeoutMs: budget.timeoutMs,
    isConcurrencySafe: () => false,
    async execute(args) {
      if ((args.groupId === undefined) === (args.toOpenId === undefined)) {
        throw new Error('yzj_im_message_send: exactly one of groupId or toOpenId is required')
      }
      if (args.msgType === 'file') {
        if (args.fileId === undefined) {
          throw new Error('yzj_im_message_send: msg-type file requires fileId')
        }
        if (args.content !== undefined || args.replyMsgId !== undefined || args.atAll === true || (args.atOpenIds ?? []).length > 0) {
          throw new Error('yzj_im_message_send: msg-type file does not support content, reply, or @ mentions')
        }
      } else if (args.content === undefined || args.content.trim() === '') {
        throw new Error('yzj_im_message_send: text/richText require non-empty content')
      }
      if (args.msgType !== 'richText' && (args.images ?? []).length > 0) {
        throw new Error('yzj_im_message_send: images are only supported for msg-type richText')
      }
      const command = ['im', 'message', 'send', '--msg-type', args.msgType]
      if (args.groupId !== undefined) command.push('--group-id', args.groupId)
      if (args.toOpenId !== undefined) command.push('--to-open-id', args.toOpenId)
      if (args.content !== undefined) command.push('--content', args.content)
      if (args.fileId !== undefined) command.push('--file-id', args.fileId)
      if (args.replyMsgId !== undefined) command.push('--reply-msg-id', args.replyMsgId)
      for (const id of args.atOpenIds ?? []) command.push('--at-open-id', id)
      if (args.atAll === true) command.push('--at-all')
      for (const image of args.images ?? []) command.push('--image', image)
      return runValue(ctx, budget, 'im message send', command, (json) => {
        const payload = cliObject(json)
        const msgId = asString(payload.msgId ?? payload.id)
        return {
          content: `sent ${args.msgType} message${msgId === '' ? '' : ` (${msgId})`}`,
          data: { payload: clipJson(payload, { maxChars: budget.maxMetaChars }), msgId },
        }
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'yzj_im_message_list',
    description: 'List chat history of a group/session: newest (default) or anchored old/new around msgId. Returns one line per message with time, sender, content, and msgId.',
    parameters: {
      groupId: { type: 'string', required: true, description: 'Group or chat session id.' },
      type: { type: 'string', enum: ['newest', 'old', 'new'], description: 'newest fetches the latest; old/new page around msgId.' },
      msgId: { type: 'string', description: 'Anchor message id; required for type old/new.' },
      limit: { type: 'number', description: 'Message count; default 20, range 1-20 (CLI cap).' },
    },
    output: yzjToolOutput,
    timeoutMs: budget.timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args) {
      const command = ['im', 'message', 'list', '--group-id', args.groupId]
      if (args.type !== undefined) command.push('--type', args.type)
      if (args.msgId !== undefined) command.push('--msg-id', args.msgId)
      if (args.limit !== undefined) {
        if (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 20) {
          throw new Error('yzj_im_message_list: limit must be an integer between 1 and 20 (CLI cap)')
        }
        command.push('--limit', String(args.limit))
      }
      return runValue(ctx, budget, 'im message list', command, (json) => {
        const root = cliObject(json)
        const messages = cliList(root)
        const more = root.more === true
        const lines = messages.map(messageLine)
        const content = [
          ...(lines.length === 0 ? ['(no messages)'] : lines),
          ...(more ? ['(more messages available)'] : []),
        ].join('\n')
        return { content, data: { list: clipJson(messages, { maxChars: budget.maxMetaChars }), more } }
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'yzj_im_group_recent',
    description: 'List recent group/chat sessions with unread counts and last-message previews, newest first. To find a group by name use yzj_im_group_search; to find a message use yzj_im_message_search.',
    parameters: {
      limit: { type: 'number', description: 'Per-page count; default 20, range 1-20 (CLI cap).' },
      page: { type: 'number', description: 'Page number; default 1, must be >= 1.' },
    },
    output: yzjToolOutput,
    timeoutMs: budget.timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args) {
      const command = ['im', 'group', 'recent']
      if (args.limit !== undefined) {
        if (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 20) {
          throw new Error('yzj_im_group_recent: limit must be an integer between 1 and 20 (CLI cap)')
        }
        command.push('--limit', String(args.limit))
      }
      if (args.page !== undefined) {
        if (!Number.isInteger(args.page) || args.page < 1) {
          throw new Error('yzj_im_group_recent: page must be an integer >= 1')
        }
        command.push('--page', String(args.page))
      }
      return runValue(ctx, budget, 'im group recent', command, (json) => {
        const root = cliObject(json)
        const groups = cliList(root)
        const more = root.more === true
        const lines = groups.map(groupLine)
        const content = [
          ...(lines.length === 0 ? '(no recent groups)' : lines),
          ...(more ? ['(more pages available)'] : []),
        ].join('\n')
        return { content, data: { list: clipJson(groups, { maxChars: budget.maxMetaChars }), more } }
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'yzj_im_group_search',
    description: 'Search groups visible to the current user by keyword. Use to resolve a group id when yzj_im_group_recent paging misses it (e.g. before message operations).',
    parameters: {
      keyword: { type: 'string', required: true, description: 'Group-name keyword.' },
      limit: { type: 'number', description: 'Per-page count (default 10).' },
      page: { type: 'number', description: 'Page number (default 1).' },
    },
    output: yzjToolOutput,
    timeoutMs: budget.timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args) {
      const command = ['im', 'group', 'search', '--keyword', args.keyword]
      if (args.limit !== undefined) command.push('--limit', String(args.limit))
      if (args.page !== undefined) command.push('--page', String(args.page))
      return runValue(ctx, budget, 'im group search', command, (json) => {
        const groups = cliList(json)
        const lines = groups.map(groupLine)
        const content = lines.length === 0 ? '(no matches)' : lines.join('\n')
        return { content, data: { list: clipJson(groups, { maxChars: budget.maxMetaChars }) } }
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'yzj_im_group_create',
    description: 'Create a group with the current user as owner. memberOpenIds are the initial members EXCLUDING the creator — the CLI requires 2-10. Requires user confirmation.',
    parameters: {
      name: { type: 'string', description: 'Group name.' },
      memberOpenIds: { type: 'array', items: { type: 'string' }, required: true, description: 'Initial member openIds (2-10, creator excluded).' },
    },
    output: yzjToolOutput,
    timeoutMs: budget.timeoutMs,
    isConcurrencySafe: () => false,
    async execute(args) {
      const members = Array.isArray(args.memberOpenIds) ? args.memberOpenIds.map(String).filter(id => id !== '') : []
      if (members.length < 2 || members.length > 10) {
        throw new Error(`yzj_im_group_create: memberOpenIds needs 2-10 openIds (creator excluded), got ${members.length}`)
      }
      const command = ['im', 'group', 'create']
      if (args.name !== undefined) command.push('--name', args.name)
      for (const id of members) command.push('--member-open-id', id)
      return runValue(ctx, budget, 'im group create', command, (json) => {
        const payload = cliObject(json)
        const groupId = asString(payload.groupId ?? payload.id)
        return {
          content: `created group${args.name === undefined ? '' : `「${args.name}」`} (${groupId === '' ? 'id unknown' : groupId}) with ${members.length} member(s)`,
          data: { payload: clipJson(payload, { maxChars: budget.maxMetaChars }), groupId },
        }
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'yzj_im_group_members_add',
    description: 'Add members to a group (≤10 openIds per call). Requires user confirmation.',
    parameters: {
      groupId: { type: 'string', required: true, description: 'Target group id.' },
      openIds: { type: 'array', items: { type: 'string' }, required: true, description: 'Member openIds to add (max 10).' },
    },
    output: yzjToolOutput,
    timeoutMs: budget.timeoutMs,
    isConcurrencySafe: () => false,
    async execute(args) {
      const openIds = Array.isArray(args.openIds) ? args.openIds.map(String).filter(id => id !== '') : []
      if (openIds.length === 0 || openIds.length > 10) {
        throw new Error(`yzj_im_group_members_add: openIds needs 1-10 ids, got ${openIds.length}`)
      }
      const command = ['im', 'group.members', 'add', '--group-id', args.groupId]
      for (const id of openIds) command.push('--open-id', id)
      return runValue(ctx, budget, 'im group.members add', command, (json) => ({
        content: `added ${openIds.length} member(s) to group (${args.groupId})`,
        data: { payload: clipJson(json, { maxChars: budget.maxMetaChars }), groupId: args.groupId, count: openIds.length },
      }))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'yzj_im_group_members_remove',
    description: 'Remove members from a group irreversibly (≤10 openIds per call). Strong user confirmation required; the approval already covers the CLI --yes flag.',
    parameters: {
      groupId: { type: 'string', required: true, description: 'Target group id.' },
      openIds: { type: 'array', items: { type: 'string' }, required: true, description: 'Member openIds to remove (max 10).' },
    },
    output: yzjToolOutput,
    timeoutMs: budget.timeoutMs,
    isConcurrencySafe: () => false,
    async execute(args) {
      const openIds = Array.isArray(args.openIds) ? args.openIds.map(String).filter(id => id !== '') : []
      if (openIds.length === 0 || openIds.length > 10) {
        throw new Error(`yzj_im_group_members_remove: openIds needs 1-10 ids, got ${openIds.length}`)
      }
      const command = ['im', 'group.members', 'remove', '--group-id', args.groupId]
      for (const id of openIds) command.push('--open-id', id)
      command.push('--yes')
      return runValue(ctx, budget, 'im group.members remove', command, (json) => ({
        content: `removed ${openIds.length} member(s) from group (${args.groupId})`,
        data: { payload: clipJson(json, { maxChars: budget.maxMetaChars }), groupId: args.groupId, count: openIds.length },
      }))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'yzj_im_message_recall',
    description: 'Recall one of your own IM messages. Only the sender can recall, and the server enforces a time window. Exactly one of groupId / toOpenId. Strong user confirmation required. The CLI does not use --yes for this command — the product card is the gate.',
    parameters: {
      msgId: { type: 'string', required: true, description: 'Message id to recall (from yzj_im_message_list; must be sent by the current user).' },
      groupId: { type: 'string', description: 'Group or chat session id; mutually exclusive with toOpenId.' },
      toOpenId: { type: 'string', description: 'Direct-chat target openId; mutually exclusive with groupId.' },
    },
    output: yzjToolOutput,
    timeoutMs: budget.timeoutMs,
    isConcurrencySafe: () => false,
    async execute(args) {
      if ((args.groupId === undefined) === (args.toOpenId === undefined)) {
        throw new Error('yzj_im_message_recall: exactly one of groupId or toOpenId is required')
      }
      const command = ['im', 'message', 'recall', '--msg-id', args.msgId]
      if (args.groupId !== undefined) command.push('--group-id', args.groupId)
      if (args.toOpenId !== undefined) command.push('--to-open-id', args.toOpenId)
      return runValue(ctx, budget, 'im message recall', command, (json) => ({
        content: `recalled message (${args.msgId})`,
        data: { payload: clipJson(json, { maxChars: budget.maxMetaChars }), msgId: args.msgId },
      }))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'yzj_im_message_search',
    description: 'Search visible chat history by keyword (min 2 characters). Results are grouped by conversation. Optional filters: groupId, senderOpenId, notifyToOpenId (@ target), start/end time. Use a hit\'s groupId + msgId with yzj_im_message_list for context.',
    parameters: {
      keyword: { type: 'string', required: true, description: 'Search keyword; at least 2 characters.' },
      groupId: { type: 'string', description: 'Limit to one group or chat session.' },
      senderOpenId: { type: 'string', description: 'Only messages from this sender.' },
      notifyToOpenId: { type: 'string', description: 'Only messages that @ this openId (pass your own openId for "who @ me").' },
      start: { type: 'string', description: 'Range start: YYYY-MM-DD, datetime, or unix timestamp.' },
      end: { type: 'string', description: 'Range end (same formats; a pure date is that day 23:59:59).' },
      limit: { type: 'number', description: 'Groups per page; default 10, range 1-20.' },
      page: { type: 'number', description: 'Page number; default 1, range 1-200.' },
    },
    output: yzjToolOutput,
    timeoutMs: budget.timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args) {
      if (args.keyword.trim().length < 2) {
        throw new Error('yzj_im_message_search: keyword must be at least 2 characters')
      }
      const command = ['im', 'message', 'search', '--keyword', args.keyword]
      if (args.groupId !== undefined) command.push('--group-id', args.groupId)
      if (args.senderOpenId !== undefined) command.push('--sender-open-id', args.senderOpenId)
      if (args.notifyToOpenId !== undefined) command.push('--notify-to-open-id', args.notifyToOpenId)
      if (args.start !== undefined) command.push('--start', args.start)
      if (args.end !== undefined) command.push('--end', args.end)
      if (args.limit !== undefined) {
        if (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 20) {
          throw new Error('yzj_im_message_search: limit must be an integer between 1 and 20 (CLI cap)')
        }
        command.push('--limit', String(args.limit))
      }
      if (args.page !== undefined) {
        if (!Number.isInteger(args.page) || args.page < 1 || args.page > 200) {
          throw new Error('yzj_im_message_search: page must be an integer between 1 and 200')
        }
        command.push('--page', String(args.page))
      }
      return runValue(ctx, budget, 'im message search', command, (json) => {
        const root = cliObject(json)
        const hits = cliList(root)
        const more = root.more === true
        const lines = hits.map(searchHitLine)
        const content = [
          ...(lines.length === 0 ? ['(no matches)'] : lines),
          ...(more ? ['(more pages available)'] : []),
        ].join('\n')
        return { content, data: { list: clipJson(hits.map(searchHitCard), { maxChars: budget.maxMetaChars }), more } }
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'yzj_im_group_rename',
    description: 'Rename a group. The current user must be in the group; some groups require an admin. Does not support external groups. Requires user confirmation. Empty CLI receipt on success.',
    parameters: {
      groupId: { type: 'string', required: true, description: 'Target group id.' },
      name: { type: 'string', required: true, description: 'New group name (must come from the user; cannot be blank).' },
    },
    output: yzjToolOutput,
    timeoutMs: budget.timeoutMs,
    isConcurrencySafe: () => false,
    async execute(args) {
      if (args.name.trim() === '') {
        throw new Error('yzj_im_group_rename: name must not be blank')
      }
      const command = ['im', 'group', 'rename', '--group-id', args.groupId, '--name', args.name]
      return runValue(ctx, budget, 'im group rename', command, (json) => ({
        content: `renamed group (${args.groupId}) → "${args.name}"`,
        data: { payload: clipJson(json, { maxChars: budget.maxMetaChars }), groupId: args.groupId, name: args.name },
      }))
    },
  }))
}
