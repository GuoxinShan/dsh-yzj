/**
 * Closed-loop sidecar: real yzj-cli scan → inspect → feed on dsh-2.
 * Rewinds the host cursor to just before the latest non-self message so the
 * scan actually returns a live signal (a first visit would only set a
 * baseline). Then creates a probe item, inspects, feeds that msgId, and
 * proves the second feed with the same ref is idempotent. Prints one JSON
 * object on stdout.
 */
import { Context } from '@deepseek-ai/cordis'
import YzjBridge from '../packages/bridge/src/index.ts'
import {
  buildInspectDigest, buildScanDigest, coreCreateAdvance, coreFeedAdvance, coreScanAdvance,
  fetchEntries, fetchItems, isSkippableSender, resolveAdvance,
} from '../packages/tool-yzj/src/advance.ts'
import type { AdvanceCaches, InspectSubject } from '../packages/tool-yzj/src/advance.ts'
import { ScanCursorStore } from '../packages/tool-yzj/src/scan-cursors.ts'
import type { YzjToolBudget } from '../packages/tool-yzj/src/shared.ts'

const BUDGET: YzjToolBudget = { timeoutMs: 60_000, maxRenderChars: 12_000, maxMetaChars: 8_000 }
const GROUP = process.env.YZJ_E2E_GROUP ?? 'dsh-2'

function emit(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`)
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

interface ImRow {
  msgId: string
  fromOpenId: string
  content: string
  sendTime: string
}

function parseIm(record: unknown): ImRow {
  const message = asRecord(record)
  const fromUser = asRecord(message.fromUser)
  return {
    msgId: asString(message.msgId ?? message.id),
    fromOpenId: asString(message.fromOpenId ?? fromUser.openId ?? fromUser.oId),
    content: asString(message.content),
    sendTime: asString(message.sendTime),
  }
}

const ctx = new Context()
new YzjBridge(ctx, {})
const caches: AdvanceCaches = { lib: {}, adv: {} }
const cursors = new ScanCursorStore()

const who = await ctx.yzjBridge.run(['contact', 'user', 'get'])
if (!who.ok) {
  emit({ ok: false, step: 'whoami', error: who.stderr || who.stdout })
  process.exit(1)
}
const whoRoot = asRecord(who.json)
const whoFirst = asArray(whoRoot.list).length > 0 ? asRecord(whoRoot.list[0]) : whoRoot
const selfOpenId = asString(whoFirst.openId ?? whoFirst.oId)

const recent = await ctx.yzjBridge.run(['im', 'group', 'recent', '--limit', '20', '--page', '1'])
if (!recent.ok) {
  emit({ ok: false, step: 'group-recent', error: recent.stderr || recent.stdout })
  process.exit(1)
}
const catalog = asArray(asRecord(recent.json).list).map((row) => {
  const group = asRecord(row)
  return { groupId: asString(group.groupId), groupName: asString(group.groupName) }
})
const resolved = catalog.find(row => row.groupId === GROUP || row.groupName === GROUP || row.groupName.includes(GROUP))
if (resolved === undefined) {
  emit({ ok: false, step: 'resolve-group', error: `找不到群 ${GROUP}`, catalog: catalog.slice(0, 8) })
  process.exit(1)
}

const listed = await ctx.yzjBridge.run([
  'im', 'message', 'list', '--group-id', resolved.groupId, '--type', 'newest', '--limit', '20',
])
if (!listed.ok) {
  emit({ ok: false, step: 'message-list', error: listed.stderr || listed.stdout })
  process.exit(1)
}
const newest = asArray(asRecord(listed.json).list).map(parseIm).filter(row => row.msgId !== '')
newest.sort((a, b) => (a.sendTime < b.sendTime ? -1 : 1))
const others = newest.filter(row => !isSkippableSender(row.fromOpenId, selfOpenId))
if (others.length === 0) {
  emit({
    ok: false, step: 'no-foreign-signal',
    error: '最近 20 条没有非本人/非机器人消息，无法演示发现轮',
    selfOpenId, newest: newest.map(row => ({ msgId: row.msgId, fromOpenId: row.fromOpenId, sendTime: row.sendTime })),
  })
  process.exit(1)
}
const target = others[others.length - 1]!
const targetIndex = newest.findIndex(row => row.msgId === target.msgId)
let cursorMsgId = targetIndex > 0 ? newest[targetIndex - 1]!.msgId : ''
if (cursorMsgId === '') {
  const older = await ctx.yzjBridge.run([
    'im', 'message', 'list', '--group-id', resolved.groupId, '--type', 'old', '--msg-id', target.msgId, '--limit', '5',
  ])
  const olderRows = asArray(asRecord(older.json).list).map(parseIm).filter(row => row.msgId !== '')
  olderRows.sort((a, b) => (a.sendTime < b.sendTime ? -1 : 1))
  cursorMsgId = olderRows.length > 0 ? olderRows[olderRows.length - 1]!.msgId : target.msgId
}

await cursors.put(resolved.groupId, {
  lastMsgId: cursorMsgId,
  scannedAt: Date.now() - 60_000,
  groupName: resolved.groupName,
})

const scanned = await coreScanAdvance(ctx, BUDGET, {}, caches, cursors, [GROUP])
const scanDigest = buildScanDigest(scanned)
const hit = scanned.signals.find(signal => signal.msgId === target.msgId) ?? scanned.signals[0]

const stamp = Date.now().toString().slice(-6)
const title = `巡检闭环 ${stamp}`
const created = await coreCreateAdvance(ctx, BUDGET, {}, caches, {
  title,
  goal: '验证 scan → inspect → feed 真机回路',
  background: '闭环探针，可随时清理',
  metrics: '看板能看到扫描到的群消息: 否 / 是',
  actor: 'user',
})
await coreFeedAdvance(ctx, BUDGET, {}, caches, {
  advanceId: created.item.advanceId,
  summary: '开始推进：等巡检把群消息挂上来',
  sourceType: '人工',
  changeType: '阶段变化',
  stageTo: 'running',
  actor: 'agent',
})

const binding = await resolveAdvance(ctx, BUDGET, {}, caches, false)
const items = await fetchItems(ctx, BUDGET, binding)
const open = items.filter(item => item.stage !== 'completed')
const subjects: InspectSubject[] = []
for (const item of open.filter(item => item.advanceId === created.item.advanceId)) {
  const entries = await fetchEntries(ctx, BUDGET, binding, item.advanceId)
  subjects.push({ item, recent: entries.slice(-5) })
}
const inspectDigest = buildInspectDigest({
  subjects,
  signals: scanned.signals.map(signal => `[${signal.groupName}] ${signal.content} <${signal.msgId}>`).join('\n'),
  mode: 'compare',
})

const signalLine = hit === undefined
  ? `巡检未带回目标消息 ${target.msgId}，用扫描到的 ${scanned.signals.length} 条信号做回路`
  : `群「${hit.groupName}」${hit.content.slice(0, 80)}`
const refs = hit === undefined ? [target.msgId] : [hit.msgId]
const fed = await coreFeedAdvance(ctx, BUDGET, {}, caches, {
  advanceId: created.item.advanceId,
  summary: `巡检发现：${signalLine}`,
  sourceType: '对话',
  changeType: '进度更新',
  refs,
  actor: 'agent',
})
const again = await coreFeedAdvance(ctx, BUDGET, {}, caches, {
  advanceId: created.item.advanceId,
  summary: '同一条再喂一次（应被去重）',
  sourceType: '对话',
  changeType: '进度更新',
  refs,
  actor: 'agent',
})
const entriesAfter = await fetchEntries(ctx, BUDGET, binding, created.item.advanceId)

emit({
  ok: true,
  group: { id: resolved.groupId, name: resolved.groupName },
  selfOpenId,
  target: { msgId: target.msgId, fromOpenId: target.fromOpenId, content: target.content.slice(0, 80), sendTime: target.sendTime },
  cursorBefore: cursorMsgId,
  scan: {
    signalCount: scanned.signals.length,
    hit: hit === undefined ? null : { msgId: hit.msgId, content: hit.content.slice(0, 80) },
    groups: scanned.groups,
    digestHead: scanDigest.split('\n').slice(0, 8),
  },
  inspectHead: inspectDigest.split('\n').slice(0, 10),
  item: { advanceId: created.item.advanceId, title, stage: fed.item.stage },
  feed: { entryId: fed.entry.entryId, idempotent: fed.idempotent, summary: fed.entry.summary, refs: fed.entry.refs },
  dedup: { idempotent: again.idempotent, entryCount: entriesAfter.length },
})
