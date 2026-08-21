/**
 * Tool-result cards for the yzj tool family, registered into ui-tool's
 * keyed `tool.call.toolview` slot. Pure presentation over the frozen call
 * slice, aligned with the design prototype: icon box + title + status pill,
 * human-readable rows, and NO raw ids (openIds / msgIds / fileIds / table
 * ids stay model-visible in the digest but never hit the card). Action
 * results render friendly summaries instead of the raw CLI text.
 */
import type { ReactNode } from 'react'
import {
  IconChecklistOutline14,
  IconCloseFill14,
  IconDataOutline16,
  IconFolderOpenOutline16,
  IconListPenOutline16,
  IconNewChatOutline16,
  IconRefreshOutline14,
  IconSendOutline14,
  IconUserOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { ToolCallBlock } from '@deepseek-ai/dsh-client-runtime/client'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import css from './cards.module.css'

/** Every wire tool name this package renders. */
export const YZJ_TOOL_NAMES = [  'yzj_whoami',
  'yzj_contact_search',
  'yzj_contact_get',
  'yzj_doc_workspace_list',
  'yzj_doc_workspace_get',
  'yzj_doc_workspace_create',
  'yzj_doc_list',
  'yzj_doc_get',
  'yzj_doc_recent',
  'yzj_doc_create',
  'yzj_doc_rename',
  'yzj_doc_move',
  'yzj_doc_delete',
  'yzj_doc_import',
  'yzj_doc_download_url',
  'yzj_doc_search',
  'yzj_doc_write',
  'yzj_doc_download',
  'yzj_doc_block_list',
  'yzj_doc_block_insert',
  'yzj_doc_block_update',
  'yzj_doc_block_delete',
  'yzj_doc_block_replace',
  'yzj_sheet_create',
  'yzj_sheet_get',
  'yzj_sheet_table_get',
  'yzj_sheet_table_create',
  'yzj_sheet_table_rename',
  'yzj_sheet_table_delete',
  'yzj_sheet_record_list',
  'yzj_sheet_record_create',
  'yzj_sheet_record_update',
  'yzj_sheet_record_delete',
  'yzj_calendar_event_list',
  'yzj_calendar_event_get',
  'yzj_calendar_event_create',
  'yzj_calendar_event_update',
  'yzj_calendar_event_delete',
  'yzj_calendar_event_participants',
  'yzj_calendar_room_find',
  'yzj_im_message_send',
  'yzj_im_message_list',
  'yzj_im_group_recent',
  'yzj_im_group_search',
  'yzj_im_group_create',
  'yzj_im_group_members_add',
  'yzj_im_group_members_remove',
  'yzj_file_upload',
  'yzj_file_download',
  'yzj_todo_list',
  'yzj_todo_create',
  'yzj_todo_update',
  'yzj_todo_complete',
  'yzj_advance_list',
  'yzj_advance_get',
  'yzj_advance_inspect',
  'yzj_advance_scan',
  'yzj_advance_create',
  'yzj_advance_feed',
  'memory_observe',
  'memory_read',
  'memory_search',
  'memory_dream_load',
  'memory_dream_apply',
] as const

/** Short human titles per tool family. */
const FAMILY_TITLES: Record<string, string> = {
  yzj_whoami: '我的信息',
  yzj_contact_search: '通讯录搜索',
  yzj_contact_get: '用户详情',
  yzj_doc_workspace_list: '知识库列表',
  yzj_doc_workspace_get: '知识库详情',
  yzj_doc_workspace_create: '新建知识库',
  yzj_doc_list: '文档列表',
  yzj_doc_get: '文档详情',
  yzj_doc_recent: '最近文档',
  yzj_doc_create: '新建文档',
  yzj_doc_rename: '重命名文档',
  yzj_doc_move: '移动文档',
  yzj_doc_delete: '删除文档',
  yzj_doc_import: '导入文档',
  yzj_doc_download_url: '文件下载链接',
  yzj_doc_search: '搜索文档',
  yzj_doc_write: '整篇写文档',
  yzj_doc_download: '下载文档',
  yzj_doc_block_list: '文档结构',
  yzj_doc_block_insert: '插入内容',
  yzj_doc_block_update: '更新内容',
  yzj_doc_block_delete: '删除内容',
  yzj_doc_block_replace: '替换内容',
  yzj_sheet_create: '新建多维表格',
  yzj_sheet_get: '多维表格结构',
  yzj_sheet_table_get: '数据表结构',
  yzj_sheet_table_create: '新建数据表',
  yzj_sheet_table_rename: '重命名数据表',
  yzj_sheet_table_delete: '删除数据表',
  yzj_sheet_record_list: '记录列表',
  yzj_sheet_record_create: '新增记录',
  yzj_sheet_record_update: '更新记录',
  yzj_sheet_record_delete: '删除记录',
  yzj_calendar_event_list: '日程列表',
  yzj_calendar_event_get: '日程详情',
  yzj_calendar_event_create: '新建日程',
  yzj_calendar_event_update: '更新日程',
  yzj_calendar_event_delete: '取消日程',
  yzj_calendar_event_participants: '日程参会人',
  yzj_calendar_room_find: '空闲会议室',
  yzj_im_message_send: '发送消息',
  yzj_im_message_list: '聊天记录',
  yzj_im_group_recent: '最近会话',
  yzj_im_group_search: '搜索群组',
  yzj_im_group_create: '创建群组',
  yzj_im_group_members_add: '拉人进群',
  yzj_im_group_members_remove: '移出群成员',
  yzj_file_upload: '上传文件',
  yzj_file_download: '下载文件',
  yzj_todo_list: '待办列表',
  yzj_todo_create: '新建待办',
  yzj_todo_update: '更新待办',
  yzj_todo_complete: '完成待办',
  yzj_advance_list: '推进队列',
  yzj_advance_get: '推进详情',
  yzj_advance_inspect: '比对材料',
  yzj_advance_scan: '巡检扫描',
  yzj_advance_create: '立项推进事项',
  yzj_advance_feed: '喂入事元',
  memory_observe: '记录观察',
  memory_read: '读取记忆',
  memory_search: '检索记忆',
  memory_dream_load: '固化加载',
  memory_dream_apply: '固化应用',
}

type UnknownRecord = Record<string, unknown>

/** Card → floating-window jump: open the panel focused on one item. */
export type YzjJumpTarget =
  | { kind: 'group'; groupId: string }
  | { kind: 'doc'; docId: string }
  | { kind: 'workspace'; workspaceId: string }
  | { kind: 'todo' }
  | { kind: 'advance' }
  | { kind: 'event'; event: { id: string; startDate: number; title: string } }

/** Injected by the registration: jump to a panel view. */
export interface YzjCardInjected {
  openPanel: (target: YzjJumpTarget) => void
}

function asRecord(value: unknown): UnknownRecord {
  return typeof value === 'object' && value !== null ? value as UnknownRecord : {}
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined
}

/** Stringify a field for display (numbers included). */
function field(node: UnknownRecord, key: string): string {
  const value = node[key]
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return ''
}

/** One display row. */
function row(title: string, sub: string, key: string): ReactNode {
  return (
    <div className={css.row} key={key}>
      <div className={css.rowTitle}>{title}</div>
      {sub !== '' && <div className={css.rowSub}>{sub}</div>}
    </div>
  )
}

function linkRow(url: string, label: string, key: string): ReactNode {
  return (
    <a key={key} className={css.link} href={url} target="_blank" rel="noreferrer">{label}</a>
  )
}

/** Ghost jump button: opens the floating panel at this item. */
function jumpRow(label: string, onClick: () => void, key: string): ReactNode {
  return (
    <button key={key} type="button" className={css.jump} onClick={onClick}>{label}</button>
  )
}

/** Generic list body from title/sub key lists (ids never displayed). */
function listRows(list: unknown[], titleKeys: string[], subKeys: string[]): ReactNode {
  return (
    <div className={css.rows}>
      {list.map((item, index) => {
        const node = asRecord(item)
        const title = titleKeys.map(key => field(node, key)).find(value => value !== '') ?? ''
        const sub = subKeys.map(key => field(node, key)).filter(value => value !== '').join(' · ')
        return row(title === '' ? `第 ${index + 1} 项` : title, sub, `x${index}`)
      })}
    </div>
  )
}

/** Workspace/doc node sub-line. */
function nodeSub(node: UnknownRecord): string {
  const suffix = asString(node.fileSuffix)
  const updated = asString(node.updateTime).slice(0, 10)
  const parts = [suffix === '' ? '' : suffix === 'dbt' ? '多维表格' : '在线文档', updated]
  return parts.filter(part => part !== '').join(' · ')
}

/** Doc-domain body (workspaces, doc lists, doc records). */
function DocBody(meta: UnknownRecord, openPanel: YzjCardInjected['openPanel'], listKind: 'workspace' | 'doc'): ReactNode {
  const list = asArray(meta.list)
  if (list.length > 0) {
    return (
      <div className={css.rows}>
        {list.map((item, index) => {
          const node = asRecord(item)
          const name = asString(node.name) !== '' ? asString(node.name) : asString(node.title)
          const kind = asNumber(node.visibility) === 2 ? '个人' : ''
          const url = asString(node.openWebUrl)
          const id = asString(node.id)
          const jump = listKind === 'workspace'
            ? (id !== '' ? jumpRow('查看', () => openPanel({ kind: 'workspace', workspaceId: id }), `j${index}`) : null)
            : (id !== '' ? jumpRow('查看', () => openPanel({ kind: 'doc', docId: id }), `j${index}`) : null)
          return (
            <div key={`n${index}`} className={css.rowWrap}>
              {row(`${name}${kind === '' ? '' : ` · ${kind}`}`, nodeSub(node), `n${index}`)}
              {jump}
              {url !== '' && linkRow(url, '打开', `l${index}`)}
            </div>
          )
        })}
      </div>
    )
  }
  const record = asRecord(meta.record)
  const title = asString(record.title) || asString(record.name)
  const link = asString(record.openWebUrl)
  const id = asString(record.id)
  if (title !== '') {
    const suffix = asString(record.fileSuffix)
    const permission: Record<number, string> = { 1: '可管理', 2: '可编辑', 3: '可查看', 9: '无权限' }
    const perm = typeof record.permissionLevel === 'number' ? permission[record.permissionLevel] : undefined
    const sub = [suffix === 'dbt' ? '多维表格' : suffix === 'otl' ? '在线文档' : '', perm ?? '', asString(record.creatorName), asString(record.updateTime).slice(0, 10)]
      .filter(part => part !== '')
      .join(' · ')
    return (
      <div className={css.rows}>
        <div className={css.rowWrap}>
          {row(title, sub, 'r')}
          {id !== '' && jumpRow('查看', () => openPanel({ kind: 'doc', docId: id }), 'j')}
          {link !== '' && linkRow(link, '打开文档', 'l')}
        </div>
      </div>
    )
  }
  return null
}

/** Block list body: block text + its type label. */
function BlockBody(meta: UnknownRecord): ReactNode {
  const blocks = asArray(meta.list)
  if (blocks.length === 0) return null
  return (
    <div className={css.rows}>
      {blocks.map((item, index) => {
        const block = asRecord(item)
        const type = asString(block.type)
        const content = asString(block.content).replace(/\s+/g, ' ').slice(0, 80)
        const label = type === 'heading' ? '标题' : type === 'paragraph' ? '段落' : type === 'code' ? '代码' : type === 'text' ? '文本' : type === '' ? '' : type
        return row(content === '' ? '(空块)' : content, label, `b${index}`)
      })}
    </div>
  )
}

/** Sheet-domain body (schema, table structure, records). */
function SheetBody(meta: UnknownRecord): ReactNode {
  const schema = asRecord(meta.schema)
  const sheets = asArray(schema.sheets)
  if (sheets.length > 0) {
    return (
      <div className={css.rows}>
        {sheets.map((item, index) => {
          const table = asRecord(item)
          const fields = asArray(table.fields).map(field => asString(asRecord(field).name)).filter(name => name !== '')
          return row(asString(table.name), fields.length === 0 ? '' : `字段：${fields.join(' / ')}`, `t${index}`)
        })}
      </div>
    )
  }
  const table = asRecord(meta.table)
  if (asString(table.name) !== '') {
    const fields = asArray(table.fields).map(field => asString(asRecord(field).name)).filter(name => name !== '')
    return (
      <div className={css.rows}>
        {row(asString(table.name), fields.length === 0 ? '' : `字段：${fields.join(' / ')}`, 't')}
      </div>
    )
  }
  const records = asArray(meta.list)
  if (records.length > 0) {
    return (
      <div className={css.rows}>
        {records.map((item, index) => {
          const record = asRecord(item)
          const fields = asRecord(record.fieldsValue ?? record.fields)
          const values = Object.entries(fields).map(([key, value]) => {
            const text = typeof value === 'string' ? value : JSON.stringify(value)
            return `${key}: ${text.length > 40 ? `${text.slice(0, 40)}…` : text}`
          })
          return row(values.join(' · ') === '' ? '(空记录)' : values.join(' · '), '', `r${index}`)
        })}
      </div>
    )
  }
  return null
}

/** Calendar-domain body (events). */
function CalendarBody(meta: UnknownRecord, openPanel: YzjCardInjected['openPanel']): ReactNode {
  const events = asArray(meta.list)
  if (events.length === 0) return null
  const clock = (ms: unknown): string => {
    if (typeof ms !== 'number') return ''
    const date = new Date(ms)
    const pad = (n: number): string => String(n).padStart(2, '0')
    return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  }
  return (
    <div className={css.rows}>
      {events.map((item, index) => {
        const event = asRecord(item)
        const start = clock(event.startDate)
        const end = clock(event.endDate)
        const time = start === '' ? '' : `${start}${end === '' ? '' : ` → ${end}`}`
        const person = asString(event.personName)
        const id = asString(event.id)
        const startMs = typeof event.startDate === 'number' ? event.startDate : 0
        return (
          <div key={`e${index}`} className={css.rowWrap}>
            {row(asString(event.title), [time, person].filter(part => part !== '').join(' · '), `e${index}`)}
            {id !== '' && startMs > 0 && jumpRow('查看', () => openPanel({ kind: 'event', event: { id, startDate: startMs, title: asString(event.title) } }), `j${index}`)}
          </div>
        )
      })}
    </div>
  )
}

/** IM-domain body (messages / recent groups). */
function ImBody(meta: UnknownRecord, openPanel: YzjCardInjected['openPanel']): ReactNode {
  const messages = asArray(meta.list)
  if (messages.length > 0 && asString(asRecord(messages[0]).sendTime) !== '') {
    return (
      <div className={css.rows}>
        {messages.map((item, index) => {
          const message = asRecord(item)
          const time = asString(message.sendTime).slice(5, 16)
          const content = asString(message.content)
          const reply = asString(asRecord(message.param).replySummary)
          return row(content === '' ? '(文件/图片消息)' : content, [time, reply === '' ? '' : `↳ ${reply}`].filter(part => part !== '').join(' · '), `m${index}`)
        })}
      </div>
    )
  }
  const groups = messages
  if (groups.length > 0) {
    return (
      <div className={css.rows}>
        {groups.map((item, index) => {
          const group = asRecord(item)
          const unread = asNumber(group.unreadCount)
          const last = asString(asRecord(group.lastMsg).content)
          const groupId = asString(group.groupId)
          return (
            <div key={`g${index}`} className={css.rowWrap}>
              {row(asString(group.groupName), [unread !== undefined && unread > 0 ? `未读 ${unread}` : '', last.replace(/\s+/g, ' ').slice(0, 40)].filter(part => part !== '').join(' · '), `g${index}`)}
              {groupId !== '' && jumpRow('查看', () => openPanel({ kind: 'group', groupId }), `j${index}`)}
            </div>
          )
        })}
      </div>
    )
  }
  return null
}

/** Todo-domain body: list rows or one action summary, ids never shown. */
function TodoBody(meta: UnknownRecord, toolName: string): ReactNode {
  const statusLabel: Record<string, string> = { pending: '待办', in_progress: '进行中', done: '已完成' }
  if (toolName === 'yzj_todo_list') {
    if (meta.ready === false) {
      return <div className={css.rows}>{row('任务库未开通', '创建第一条待办时会自动开通', 'np')}</div>
    }
    const list = asArray(meta.list)
    if (list.length === 0) return <div className={css.rows}>{row('无匹配待办', '', 'empty')}</div>
    return (
      <div className={css.rows}>
        {list.map((item, index) => {
          const todo = asRecord(item)
          const tags = asArray(todo.tags).filter((tag): tag is string => typeof tag === 'string')
          const overdue = todo.overdue === true
          const status = statusLabel[asString(todo.status)] ?? asString(todo.status)
          const sub = [
            asString(todo.ddl) === '' ? '' : `${overdue ? '逾期 ' : ''}DDL ${asString(todo.ddl)}`,
            asString(todo.assignee) === '' ? '' : `@${asString(todo.assignee)}`,
            tags.length === 0 ? '' : tags.map(tag => `#${tag}`).join(' '),
          ].filter(part => part !== '').join(' · ')
          return row(asString(todo.title) === '' ? '(无标题)' : asString(todo.title), [status, sub].filter(part => part !== '').join(' · '), `t${index}`)
        })}
      </div>
    )
  }
  // create / update / complete: friendly single-row summary + library link.
  const rowsOut: ReactNode[] = []
  const title = asString(meta.title)
  const tags = asArray(meta.tags).filter((tag): tag is string => typeof tag === 'string')
  const sub = [
    asString(meta.ddl) === '' ? '' : `DDL ${asString(meta.ddl)}`,
    tags.length === 0 ? '' : tags.map(tag => `#${tag}`).join(' '),
  ].filter(part => part !== '').join(' · ')
  if (toolName === 'yzj_todo_create') {
    rowsOut.push(row(meta.idempotentHit === true ? `已存在：${title}` : `已创建：${title}`, sub, 'c'))
  } else if (toolName === 'yzj_todo_complete') {
    rowsOut.push(row(`已完成：${title}`, sub, 'd'))
  } else {
    const changes = asArray(meta.changes).filter((change): change is string => typeof change === 'string')
    rowsOut.push(row(`已更新：${title}`, changes.join('；'), 'u'))
  }
  const library = asRecord(meta.library)
  const link = asString(library.link)
  if (link !== '') rowsOut.push(linkRow(link, '打开任务库', 'l'))
  return <div className={css.rows}>{rowsOut}</div>
}

/** Stage label for advance cards (six-stage machine, ai-advance-design §2). */
const ADVANCE_STAGE_LABEL: Record<string, string> = {
  'draft': '草稿', 'running': '推进中', 'decision-needed': '待决定',
  'updated': '已更新', 'ready-for-review': '待验收', 'completed': '已完成',
}

/** Advance-domain body: queue rows, one item detail, or one feed summary. */
function AdvanceBody(meta: UnknownRecord, toolName: string, jump: (target: YzjJumpTarget) => void): ReactNode {
  const stageOf = (value: unknown): string => ADVANCE_STAGE_LABEL[asString(value)] ?? asString(value)
  if (toolName === 'yzj_advance_list') {
    if (meta.ready === false) {
      return <div className={css.rows}>{row('推进看板未开通', '立项第一个推进事项时会自动开通', 'np')}</div>
    }
    const list = asArray(meta.list)
    if (list.length === 0) return <div className={css.rows}>{row('无匹配事项', '', 'empty')}</div>
    return (
      <div className={css.rows}>
        {list.map((entry, index) => {
          const item = asRecord(entry)
          const sub = [
            stageOf(item.stage),
            asString(item.targetDate) === '' ? '' : `目标 ${asString(item.targetDate)}`,
            asString(item.assignee) === '' ? '' : `@${asString(item.assignee)}`,
            asString(item.latest),
          ].filter(part => part !== '').join(' · ')
          return row(asString(item.title) === '' ? '(无标题)' : asString(item.title), sub, `a${index}`)
        })}
        {jumpRow('打开推进看板', () => { jump({ kind: 'advance' }) }, 'jump')}
      </div>
    )
  }
  if (toolName === 'yzj_advance_get') {
    const item = asRecord(meta.item)
    const rowsOut: ReactNode[] = [
      row(asString(item.title), [stageOf(item.stage), asString(item.goal)].filter(part => part !== '').join(' · '), 'head'),
    ]
    const entries = asArray(meta.entries)
    for (let index = 0; index < Math.min(entries.length, 5); index += 1) {
      const entry = asRecord(entries[index])
      rowsOut.push(row(`${asString(entry.at)} ${asString(entry.changeType)}`, asString(entry.summary), `e${index}`))
    }
    const total = asNumber(meta.entryTotal) ?? entries.length
    rowsOut.push(row(`事元 ${total} 条`, '', 'total'))
    rowsOut.push(jumpRow('打开推进看板', () => { jump({ kind: 'advance' }) }, 'jump'))
    return <div className={css.rows}>{rowsOut}</div>
  }
  if (toolName === 'yzj_advance_inspect') {
    const rowsOut: ReactNode[] = [row(asString(meta.mode) === 'review' ? '验收辅助材料' : '比对材料', asString(meta.signals), 'head')]
    const list = asArray(meta.list)
    for (let index = 0; index < Math.min(list.length, 8); index += 1) {
      const item = asRecord(list[index])
      const next = asArray(item.next).map(part => asString(part)).filter(part => part !== '').join(' / ')
      rowsOut.push(row(
        asString(item.title) === '' ? asString(item.advanceId) : asString(item.title),
        [stageOf(item.stage), next === '' ? '' : `下一阶段 ${next}`].filter(part => part !== '').join(' · '),
        `i${index}`,
      ))
    }
    rowsOut.push(jumpRow('打开推进看板', () => { jump({ kind: 'advance' }) }, 'jump'))
    return <div className={css.rows}>{rowsOut}</div>
  }
  if (toolName === 'yzj_advance_scan') {
    const groups = asArray(meta.groups)
    const signals = asArray(meta.signals)
    const rowsOut: ReactNode[] = [
      row(
        signals.length === 0 ? '无新信号，静默' : `${signals.length} 条新信号`,
        groups.map(row => {
          const group = asRecord(row)
          if (asString(group.error) !== '') return `${asString(group.groupName)}：${asString(group.error)}`
          if (group.baseline === true) return `${asString(group.groupName)}：基线`
          return `${asString(group.groupName)}：${typeof group.newCount === 'number' ? group.newCount : 0} 条`
        }).join(' · '),
        'head',
      ),
    ]
    for (let index = 0; index < Math.min(signals.length, 5); index += 1) {
      const signal = asRecord(signals[index])
      rowsOut.push(row(asString(signal.groupName), asString(signal.content), `s${index}`))
    }
    rowsOut.push(jumpRow('打开推进看板', () => { jump({ kind: 'advance' }) }, 'jump'))
    return <div className={css.rows}>{rowsOut}</div>
  }
  // create / feed: friendly single-row summary + board link.
  const rowsOut: ReactNode[] = []
  if (toolName === 'yzj_advance_create') {
    const item = asRecord(meta.item)
    rowsOut.push(row(
      meta.idempotentHit === true ? `已存在：${asString(item.title)}` : `已立项：${asString(item.title)}`,
      [stageOf(item.stage), asString(item.goal)].filter(part => part !== '').join(' · '),
      'c',
    ))
  } else if (meta.idempotentHit === true) {
    rowsOut.push(row(`同源去重：${asString(meta.summary)}`, '未追加事元', 'f'))
  } else {
    const flow = asString(meta.stageFrom) !== '' && asString(meta.stageFrom) !== asString(meta.stageTo)
      ? `${stageOf(meta.stageFrom)} → ${stageOf(meta.stageTo)}`
      : ''
    rowsOut.push(row(`${asString(meta.changeType)}：${asString(meta.summary)}`, [flow, asString(meta.detail).split('\n').join('；')].filter(part => part !== '').join(' · '), 'f'))
  }
  const library = asRecord(meta.library)
  const link = asString(library.link)
  if (link !== '') rowsOut.push(linkRow(link, '打开推进库', 'l'))
  rowsOut.push(jumpRow('打开推进看板', () => { jump({ kind: 'advance' }) }, 'jump'))
  return <div className={css.rows}>{rowsOut}</div>
}

/** Memory-vault body: observe confirmation, scope counts, search hits, dream report. */
function MemoryBody(meta: UnknownRecord, toolName: string): ReactNode {
  const rowsOut: ReactNode[] = []
  if (toolName === 'memory_observe') {
    rowsOut.push(row(
      meta.duplicate === true ? '这条已经在记忆里' : '已记入观察草稿区',
      `open ${typeof meta.openCount === 'number' ? meta.openCount : 0}/${typeof meta.capacity === 'number' ? meta.capacity : 0}，等待 dream 固化`,
      'obs',
    ))
  } else if (toolName === 'memory_read' || toolName === 'memory_dream_load') {
    const sections = asArray(meta.sections)
    const entities = asArray(meta.entities)
    const observations = asArray(meta.observations)
    rowsOut.push(row(
      `${sections.length} 段落 · ${entities.length} 实体 · ${observations.length} 待固化`,
      `archived ${typeof meta.archivedCount === 'number' ? meta.archivedCount : 0} · 注入上限 ${typeof meta.cap === 'number' ? meta.cap : 0} 字符`,
      'scope',
    ))
    for (const [index, item] of sections.slice(0, 5).entries()) {
      const section = asRecord(item)
      rowsOut.push(row(`段 · ${asString(section.title) || asString(section.name)}`, asString(section.excerpt), `s${index}`))
    }
    if (sections.length > 5) rowsOut.push(row(`…其余 ${sections.length - 5} 段`, '', 'smore'))
  } else if (toolName === 'memory_search') {
    const hits = asArray(meta.hits)
    if (hits.length === 0) rowsOut.push(row('无匹配记忆', '', 'empty'))
    for (const [index, item] of hits.slice(0, 8).entries()) {
      const hit = asRecord(item)
      const kindLabel: Record<string, string> = { section: '段', entity: '实体', observation: '观察' }
      rowsOut.push(row(
        `${kindLabel[asString(hit.kind)] ?? asString(hit.kind)} · ${asString(hit.ref)}`,
        asString(hit.line),
        `h${index}`,
      ))
    }
    if (hits.length > 8) rowsOut.push(row(`…其余 ${hits.length - 8} 条命中`, '', 'hmore'))
  } else if (toolName === 'memory_dream_apply') {
    const counts = asRecord(meta.counts)
    const parts = ['promoted', 'dropped', 'sectionsWritten', 'entitiesWritten', 'rejected']
      .map(key => `${{ promoted: '提升', dropped: '丢弃', sectionsWritten: '段写', entitiesWritten: '实体写', rejected: '拒绝' }[key] ?? key} ${typeof counts[key] === 'number' ? counts[key] : 0}`)
      .join(' · ')
    rowsOut.push(row(`固化完成 ${asString(meta.logId)}`, parts, 'dream'))
    for (const [index, item] of asArray(meta.results).slice(0, 5).entries()) {
      const result = asRecord(item)
      rowsOut.push(row(
        `${result.ok === true ? '✓' : '✗'} ${asString(result.decision)} — ${asString(result.detail)}`,
        asString(result.reason),
        `r${index}`,
      ))
    }
  }
  return rowsOut.length === 0 ? null : <div className={css.rows}>{rowsOut}</div>
}

/** Contact-domain body (whoami / search / details). */function ContactBody(meta: UnknownRecord): ReactNode {  const list = asArray(meta.list)
  const record = asRecord(meta.record)
  const users = list.length > 0 ? list : [record]
  if (users.length === 0 || (list.length === 0 && Object.keys(record).length === 0)) return null
  return (
    <div className={css.rows}>
      {users.map((item, index) => {
        const user = asRecord(item)
        const name = asString(user.name)
        const department = asString(user.department ?? user.fulldepartment)
        const jobTitle = asString(user.jobTitle)
        const sub = [department, jobTitle].filter(part => part !== '').join(' · ')
        return (
          <div className={css.row} key={`u${index}`}>
            <div className={css.rowTitle}>
              {typeof user.photoUrl === 'string' && user.photoUrl !== ''
                ? <img className={css.avatar} src={user.photoUrl} alt="" referrerPolicy="no-referrer" />
                : <span className={css.avatarFallback}>{name.slice(0, 1)}</span>}
              <span>{name}</span>
            </div>
            {sub !== '' && <div className={css.rowSub}>{sub}</div>}
          </div>
        )
      })}
    </div>
  )
}

/** Friendly summary for action results (ids never shown). */
function ActionBody(meta: UnknownRecord, toolName: string): ReactNode {
  const rowsOut: ReactNode[] = []
  const link = asString(meta.link)
  const url = asString(meta.url)
  const output = asString(meta.output)
  const recordIds = asArray(meta.recordIds)
  const push = (title: string, sub: string, key: string): void => {
    rowsOut.push(row(title, sub, key))
  }
  if (toolName === 'yzj_im_message_send') push('消息已发送', '', 'sent')
  else if (toolName === 'yzj_file_upload') push('上传成功', '', 'up')
  else if (toolName === 'yzj_file_download') push('已下载到本地', output, 'dl')
  else if (toolName === 'yzj_doc_download_url') { /* link row below */ }
  else if (toolName.includes('_delete')) push('已删除', '', 'del')
  else if (toolName.includes('_create')) push('已创建', '', 'cr')
  else if (toolName.includes('_rename')) push('已重命名', '', 'rn')
  else if (toolName.includes('_move')) push('已移动', '', 'mv')
  else if (toolName.includes('_insert')) push('已插入内容', '', 'ins')
  else if (toolName.includes('_update')) push('已更新', recordIds.length > 0 ? `${recordIds.length} 条记录` : '', 'upd')
  else push('已完成', '', 'done')
  if (url !== '') rowsOut.push(linkRow(url, '下载链接', 'url'))
  if (link !== '') rowsOut.push(linkRow(link, '打开', 'link'))
  return <div className={css.rows}>{rowsOut}</div>
}

/** Family icon for the card header. */
function familyIcon(toolName: string): ReactNode {
  if (toolName.startsWith('yzj_im_')) return toolName === 'yzj_im_message_send' ? <IconSendOutline14 /> : <IconNewChatOutline16 />
  if (toolName.startsWith('yzj_contact_') || toolName === 'yzj_whoami') return <IconUserOutline16 />
  if (toolName.startsWith('yzj_sheet_')) return <IconDataOutline16 />
  if (toolName.startsWith('yzj_todo_')) return <IconListPenOutline16 />
  if (toolName.startsWith('yzj_advance_')) return <IconChecklistOutline14 />
  if (toolName.startsWith('yzj_calendar_')) return <IconChecklistOutline14 />
  if (toolName.startsWith('yzj_file_')) return <IconRefreshOutline14 />
  return <IconFolderOpenOutline16 />
}

/**
 * The keyed atomic tool view: one card for every yzj tool. Pending calls
 * show the family icon and an 执行中 pill; settled calls render structured
 * rows (or a friendly action summary) — the raw digest (which carries ids)
 * is never shown to the human, and error text keeps the pill red.
 */
export function YzjToolCard({ toolName, block, openPanel }: ToolCallViewProps & Partial<YzjCardInjected>) {
  const family = FAMILY_TITLES[toolName] ?? '云之家'
  const jump = openPanel ?? (() => {})
  if (!('kind' in block) || block.kind !== 'tool-result') {
    return (
      <div className={css.card}>
        <div className={css.header}>
          <span className={css.iconBox}>{familyIcon(toolName)}</span>
          <span className={css.title}>{family}</span>
          <span className={`${css.tag} ${css.tagRun}`}>执行中</span>
        </div>
      </div>
    )
  }

  if (block.isError) {
    return (
      <div className={`${css.card} ${css.errorCard}`}>
        <div className={css.header}>
          <span className={css.iconBox}><IconCloseFill14 /></span>
          <span className={css.title}>{family}</span>
          <span className={`${css.tag} ${css.tagFail}`}>失败</span>
        </div>
        <div className={css.text}>{resultText(block)}</div>
      </div>
    )
  }

  const meta = asRecord(block.meta)
  let body: ReactNode = null
  if (toolName === 'yzj_doc_block_list') body = BlockBody(meta)
  else if (toolName === 'yzj_calendar_event_participants') body = listRows(asArray(meta.list), ['name'], ['jobTitle', 'department'])
  else if (toolName === 'yzj_calendar_room_find') body = listRows(asArray(meta.list), ['name', 'title'], ['capacity', 'floor'])
  else if (toolName.startsWith('yzj_doc_')) body = DocBody(meta, jump, toolName === 'yzj_doc_workspace_list' || toolName === 'yzj_doc_workspace_get' ? 'workspace' : 'doc')
  else if (toolName.startsWith('yzj_sheet_')) body = SheetBody(meta)
  else if (toolName.startsWith('yzj_calendar_')) body = CalendarBody(meta, jump)
  else if (toolName.startsWith('yzj_todo_')) body = TodoBody(meta, toolName)
  else if (toolName.startsWith('yzj_advance_')) body = AdvanceBody(meta, toolName, jump)
  else if (toolName.startsWith('yzj_im_')) body = ImBody(meta, jump)
  else if (toolName.startsWith('yzj_contact_') || toolName === 'yzj_whoami') body = ContactBody(meta)
  else if (toolName.startsWith('memory_')) body = MemoryBody(meta, toolName)
  if (body === null) body = ActionBody(meta, toolName)

  return (
    <div className={css.card}>
      <div className={css.header}>
        <span className={css.iconBox}>{familyIcon(toolName)}</span>
        <span className={css.title}>{family}</span>
        <span className={css.tag}>云之家</span>
      </div>
      {body}
    </div>
  )
}

/** Settled result text blocks, flattened (error messages only). */
function resultText(block: Extract<ToolCallBlock, { kind: 'tool-result' }>): string {
  return block.content
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map(part => part.text)
    .join('\n')
}
