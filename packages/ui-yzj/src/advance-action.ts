/**
 * Decision-card action execution, host orchestration (决策 45 closed-loop
 * enforcement, spec advance-domain-model.md §3): one RPC runs the effects
 * atomically — execute the action (todo / im / event), land the execution
 * 事元 (refs = effect pointer, detail carries the 动作序 mark), and
 * auto-subscribe the effect object so its later changes flow back as new
 * signals (the 执行→再观察 arc). Effect failure aborts before the entry is
 * written (no half state); subscription failure degrades to a warning —
 * the effect itself already happened and stays traceable.
 *
 * Idempotence gate: an existing execution 事元 with the same 动作序 key —
 * or the same kind+text (综合卡 re-orders action rows, 决策 43, so the key
 * alone is not stable across card revisions) — replays without re-executing.
 */
import { extractSendMsgId } from '@dsh-yzj/tool-yzj/src/bound-log.ts'

/** Minimal service slices this orchestration consumes (injected for tests). */
export interface AdvanceActionDeps {
  advance: {
    get: (advanceId: string, entryOffset?: number, entryLimit?: number) => Promise<{ entries: unknown[] }>
    feed: (input: {
      advanceId: string
      summary: string
      sourceType: string
      changeType: string
      detail: string
      refs?: string[]
      actor: string
    }) => Promise<unknown>
    sourceAdd: (advanceId: string, token: string, label?: string) => Promise<unknown>
  }
  todo?: {
    /** Agent-origin create lands in backlog（待我决定）——人批准后才可认领（S6）。 */
    createFromAgent: (input: { title: string; description?: string; ddl?: string; tags?: string[] }) => Promise<{ todoId: string }>
  }
  sendIm?: (groupId: string, content: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: string }>
}

/** One decision-card action execution request. */
export interface ActionRunInput {
  advanceId: string
  /** Stable `${entryId}:${actionIndex}` of the action row within its decision card. */
  actionKey: string
  kind: 'todo' | 'im' | 'event'
  text: string
  fields: Record<string, string>
  imGroupId?: string
  imGroupLabel?: string
}

export interface ActionRunResult {
  idempotent: boolean
  /** Effect pointer landed on the execution 事元 refs ('' when none exists, e.g. event jump). */
  effectRef: string
  summary: string
  warnings: string[]
}

/** detail mark line written on every execution 事元 (the fold contract). */
export function actionMarkLine(input: Pick<ActionRunInput, 'actionKey' | 'kind' | 'text'>): string {
  return `动作序: ${input.actionKey} | 种类: ${input.kind} | 文本: ${input.text}`
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** Summary wording shared with the timeline (执行建议动作：…). */
function summaryOf(input: ActionRunInput): string {
  if (input.kind === 'todo') return `执行建议动作：建待办「${input.text}」`
  if (input.kind === 'im') return `执行建议动作：发消息到「${input.imGroupLabel ?? '订阅群'}」对齐`
  return `执行建议动作：定会议「${input.fields['主题'] ?? input.text}」（已跳日程域，建成后经订阅回流）`
}

/** 动作序 mark of one entry, if present. */
function markOf(entry: unknown): { key: string; kind: string; text: string } | undefined {
  for (const line of asString(asRecord(entry).detail).split('\n')) {
    const m = /^动作序:\s*([^|]+)\|\s*种类:\s*(\w+)\s*\|\s*文本:\s*(.*)$/.exec(line.trim())
    if (m !== null) return { key: (m[1] ?? '').trim(), kind: m[2] ?? '', text: (m[3] ?? '').trim() }
  }
  return undefined
}

/** Replay check: same action key, or same kind+text (text non-empty). */
function alreadyRan(entries: unknown[], input: ActionRunInput): boolean {
  for (const entry of entries) {
    const mark = markOf(entry)
    if (mark === undefined) continue
    if (mark.key === input.actionKey) return true
    if (input.text !== '' && mark.kind === input.kind && mark.text === input.text) return true
  }
  return false
}

/**
 * Run one decision-card action. Throws on effect failure (the RPC surface
 * wraps it into an internalError); warnings ride on the result value.
 */
export async function runAdvanceAction(deps: AdvanceActionDeps, input: ActionRunInput): Promise<ActionRunResult> {
  // Idempotence gate before any effect: scan the full stream (window bypass).
  const detail = await deps.advance.get(input.advanceId, 0, 100000)
  const entries = Array.isArray(detail.entries) ? detail.entries : []
  if (alreadyRan(entries, input)) {
    return { idempotent: true, effectRef: '', summary: summaryOf(input), warnings: [] }
  }

  const warnings: string[] = []
  let effectRef = ''
  let sourceType = '人工'

  if (input.kind === 'todo') {
    if (deps.todo === undefined) throw new Error('advance-action-run: yzjTodo 服务不可用（tool-yzj 未挂载）')
    // S6：agent 建的待办落 backlog（待我决定）；描述（S7）是认领后执行的提示词本体。
    const created = await deps.todo.createFromAgent({
      title: input.text,
      ...(input.fields['描述'] === undefined ? {} : { description: input.fields['描述'] }),
      ...(input.fields['截止'] === undefined ? {} : { ddl: input.fields['截止'] }),
      ...(input.fields['负责人'] === undefined ? {} : { tags: [input.fields['负责人']] }),
    })
    if (created.todoId === '') throw new Error('advance-action-run: 待办已建但未返回 todoId')
    effectRef = created.todoId
  } else if (input.kind === 'im') {
    if (deps.sendIm === undefined) throw new Error('advance-action-run: IM 发送通道不可用')
    const groupId = input.imGroupId ?? ''
    if (groupId === '') throw new Error('advance-action-run: 没有订阅的群渠道，发消息动作无处投递')
    const sent = await deps.sendIm(groupId, input.text)
    if (!sent.ok) throw new Error(`advance-action-run: 发消息失败：${sent.error}`)
    const msgId = extractSendMsgId(sent.value)
    if (msgId === undefined) {
      warnings.push('CLI 未返回 msgId，执行事元 refs 缺效应指针（消息已发出，可经群渠道回流）')
    } else {
      effectRef = `im:${groupId}:${msgId}`
    }
    sourceType = '对话'
  } else {
    // event: jumping to the calendar domain produces no effect object yet —
    // land the trace entry without refs; the created event flows back via
    // the item's event:/dir: subscriptions.
    sourceType = '日程'
  }

  await deps.advance.feed({
    advanceId: input.advanceId,
    summary: summaryOf(input),
    sourceType,
    changeType: '进度更新',
    detail: actionMarkLine(input),
    ...(effectRef === '' ? {} : { refs: [effectRef] }),
    actor: 'user',
  })

  // Auto-subscribe the effect object so its changes flow back (再观察).
  if (input.kind === 'todo' && effectRef !== '') {
    try {
      await deps.advance.sourceAdd(input.advanceId, `todo:${effectRef}`, input.text)
    } catch (error) {
      warnings.push(`效应对象自动订阅失败（可在看板手动关联 todo:${effectRef}）：${String((error as Error).message)}`)
    }
  }

  return { idempotent: false, effectRef, summary: summaryOf(input), warnings }
}
