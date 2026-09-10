/**
 * User-defined assistants (1..N) plus the IM present-layer projection.
 * Each assistant maps to one hidden DSH session; bubbles live in plugin
 * state so the IM never forges custom session events (F4).
 * @module @dsh-yzj/tool-yzj/assistants
 */

import { Context, Service } from '@deepseek-ai/cordis'
import { z } from 'zod'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import type { Domain, KvTable } from '@deepseek-ai/dsh-storage-domain'

/** Factory id of the built-in 助手. */
export const DEFAULT_ASSISTANT_ID = 'default'

/** One user-defined assistant (Grok-Bot-style contact, not a per-group robot). */
export interface AssistantRecord {
  readonly id: string
  readonly name: string
  readonly sessionId: string
  readonly createdAt: number
  readonly prompt?: string
}

/** One IM-visible bubble. Never a Yunzhijia post. */
export interface PresentBubble {
  readonly id: string
  readonly role: 'user' | 'assistant'
  readonly text: string
  readonly at: number
}

/** Where the current hidden-session turn should `present`. */
export type TurnTarget =
  | { readonly kind: 'dm'; readonly assistantId: string }
  | { readonly kind: 'thread'; readonly assistantId: string; readonly groupId: string; readonly msgId: string }

/** Local-only thread hanging under one group message. */
export interface LocalThread {
  readonly groupId: string
  readonly msgId: string
  readonly assistantId: string
  readonly status: 'idle' | 'processing'
  readonly bubbles: readonly PresentBubble[]
  readonly updatedAt: number
}

/** DM projection for one assistant. */
export interface AssistantDmProjection {
  readonly assistant: AssistantRecord
  readonly processing: boolean
  readonly bubbles: readonly PresentBubble[]
}

const assistantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  sessionId: z.string().min(1),
  createdAt: z.number(),
  prompt: z.string().optional(),
}) as unknown as z.ZodType<AssistantRecord>

const bubbleSchema = z.object({
  id: z.string().min(1),
  role: z.enum(['user', 'assistant']),
  text: z.string(),
  at: z.number(),
}) as unknown as z.ZodType<PresentBubble>

const dmSchema = z.object({
  bubbles: z.array(bubbleSchema),
  processing: z.boolean(),
}) as unknown as z.ZodType<{ bubbles: PresentBubble[]; processing: boolean }>

const threadSchema = z.object({
  groupId: z.string().min(1),
  msgId: z.string().min(1),
  assistantId: z.string().min(1),
  status: z.enum(['idle', 'processing']),
  bubbles: z.array(bubbleSchema),
  updatedAt: z.number(),
}) as unknown as z.ZodType<LocalThread>

/** Durable domain: assistant catalog + IM projections. */
export const yzjAssistantsDomainSpec = defineDomain({
  name: 'yzj_assistants',
  version: 0,
  tables: {
    assistants: domainTable<string, AssistantRecord>(assistantSchema),
    dm: domainTable<string, { bubbles: PresentBubble[]; processing: boolean }>(dmSchema),
    threads: domainTable<string, LocalThread>(threadSchema),
  },
})

/** Hidden session id for one assistant. */
export function assistantSessionId(assistantId: string): string {
  const cleaned = assistantId.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  const body = cleaned === '' ? 'x' : cleaned.slice(0, 80)
  return `yzj-assistant-${body}`
}

/** True when this DSH session is a hidden assistant (not a room/topic). */
export function isAssistantSessionId(sessionId: string): boolean {
  return sessionId.startsWith('yzj-assistant-')
}

/** Thread table key: one local thread per (group, message). */
export function threadKey(groupId: string, msgId: string): string {
  return `${groupId}\t${msgId}`
}

function newBubble(role: PresentBubble['role'], text: string): PresentBubble {
  return { id: crypto.randomUUID(), role, text, at: Date.now() }
}

function slugOf(name: string): string {
  const cleaned = name.trim().toLowerCase().replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]+/g, '-').replace(/^-+|-+$/g, '')
  if (cleaned === '') return `a-${Date.now().toString(36)}`
  return cleaned.slice(0, 40)
}

/** In-memory + durable catalog / projection. Inert until `open()`. */
export class AssistantStore {
  private assistants: KvTable<string, AssistantRecord> | undefined
  private dm: KvTable<string, { bubbles: PresentBubble[]; processing: boolean }> | undefined
  private threads: KvTable<string, LocalThread> | undefined
  private readonly memoryAssistants = new Map<string, AssistantRecord>()
  private readonly memoryDm = new Map<string, { bubbles: PresentBubble[]; processing: boolean }>()
  private readonly memoryThreads = new Map<string, LocalThread>()
  /** Live turn routing — not durable; a restart drops in-flight targets. */
  private readonly turnBySession = new Map<string, TurnTarget>()
  private readonly presentedThisTurn = new Set<string>()

  async open(facility: { open(spec: typeof yzjAssistantsDomainSpec): Promise<Domain<typeof yzjAssistantsDomainSpec>> }): Promise<void> {
    if (this.assistants !== undefined) return
    const domain = await facility.open(yzjAssistantsDomainSpec)
    this.assistants = domain.table('assistants')
    this.dm = domain.table('dm')
    this.threads = domain.table('threads')
    for (const [key, value] of this.memoryAssistants) {
      if (this.assistants.get(key) === undefined) await this.assistants.put(key, value)
    }
    for (const [key, value] of this.memoryDm) {
      if (this.dm.get(key) === undefined) await this.dm.put(key, value)
    }
    for (const [key, value] of this.memoryThreads) {
      if (this.threads.get(key) === undefined) await this.threads.put(key, value)
    }
    this.memoryAssistants.clear()
    this.memoryDm.clear()
    this.memoryThreads.clear()
    await this.ensureDefault()
  }

  async close(): Promise<void> {
    this.assistants = undefined
    this.dm = undefined
    this.threads = undefined
  }

  /** Built-in 助手. Idempotent. */
  async ensureDefault(): Promise<AssistantRecord> {
    const existing = this.get(DEFAULT_ASSISTANT_ID)
    if (existing !== undefined) return existing
    const record: AssistantRecord = {
      id: DEFAULT_ASSISTANT_ID,
      name: '助手',
      sessionId: assistantSessionId(DEFAULT_ASSISTANT_ID),
      createdAt: Date.now(),
    }
    await this.putAssistant(record)
    return record
  }

  get(id: string): AssistantRecord | undefined {
    return this.assistants?.get(id) ?? this.memoryAssistants.get(id)
  }

  getBySession(sessionId: string): AssistantRecord | undefined {
    return this.list().find(row => row.sessionId === sessionId)
  }

  list(): AssistantRecord[] {
    if (this.assistants !== undefined) {
      return [...this.assistants.entries()].map(([, record]) => record)
        .sort((a, b) => a.createdAt - b.createdAt)
    }
    return [...this.memoryAssistants.values()].sort((a, b) => a.createdAt - b.createdAt)
  }

  /** Create another assistant (settings 「新建助手」). */
  async create(name: string, prompt?: string): Promise<AssistantRecord> {
    await this.ensureDefault()
    let id = slugOf(name)
    let suffix = 2
    while (this.get(id) !== undefined) {
      id = `${slugOf(name)}-${suffix}`
      suffix += 1
    }
    const record: AssistantRecord = {
      id,
      name: name.trim() === '' ? '助手' : name.trim().slice(0, 40),
      sessionId: assistantSessionId(id),
      createdAt: Date.now(),
      ...(prompt !== undefined && prompt.trim() !== '' ? { prompt: prompt.trim().slice(0, 4_000) } : {}),
    }
    await this.putAssistant(record)
    return record
  }

  async setTurn(sessionId: string, target: TurnTarget): Promise<void> {
    this.turnBySession.set(sessionId, target)
    this.presentedThisTurn.delete(sessionId)
    if (target.kind === 'dm') await this.setDmProcessing(target.assistantId, true)
    else await this.setThreadStatus(target.groupId, target.msgId, target.assistantId, 'processing')
  }

  turnOf(sessionId: string): TurnTarget | undefined {
    return this.turnBySession.get(sessionId)
  }

  didPresent(sessionId: string): boolean {
    return this.presentedThisTurn.has(sessionId)
  }

  /** Append a user bubble into the current projection. */
  async appendUser(target: TurnTarget, text: string): Promise<PresentBubble> {
    const bubble = newBubble('user', text)
    if (target.kind === 'dm') {
      const dm = this.dmOf(target.assistantId)
      await this.putDm(target.assistantId, { bubbles: [...dm.bubbles, bubble], processing: true })
    } else {
      const thread = this.threadOf(target.groupId, target.msgId, target.assistantId)
      await this.putThread({
        ...thread,
        status: 'processing',
        bubbles: [...thread.bubbles, bubble],
        updatedAt: Date.now(),
      })
    }
    return bubble
  }

  /**
   * Speak to the current IM projection. No-op (returns undefined) when the
   * calling session is not an assistant turn.
   */
  async present(sessionId: string, text: string): Promise<PresentBubble | undefined> {
    const target = this.turnBySession.get(sessionId) ?? this.targetFromSession(sessionId)
    if (target === undefined) return undefined
    this.presentedThisTurn.add(sessionId)
    const bubble = newBubble('assistant', text)
    if (target.kind === 'dm') {
      const dm = this.dmOf(target.assistantId)
      await this.putDm(target.assistantId, { bubbles: [...dm.bubbles, bubble], processing: dm.processing })
    } else {
      const thread = this.threadOf(target.groupId, target.msgId, target.assistantId)
      await this.putThread({
        ...thread,
        bubbles: [...thread.bubbles, bubble],
        updatedAt: Date.now(),
      })
    }
    return bubble
  }

  /**
   * If the turn never `present`ed, copy the last assistant text into IM so
   * the user is not stuck on 助手正在处理….
   */
  async fallbackPresent(sessionId: string, text: string): Promise<PresentBubble | undefined> {
    if (this.presentedThisTurn.has(sessionId)) return undefined
    const trimmed = text.trim()
    if (trimmed === '') return undefined
    return this.present(sessionId, trimmed)
  }

  async finishTurn(sessionId: string): Promise<void> {
    const target = this.turnBySession.get(sessionId)
    this.turnBySession.delete(sessionId)
    this.presentedThisTurn.delete(sessionId)
    if (target === undefined) return
    if (target.kind === 'dm') await this.setDmProcessing(target.assistantId, false)
    else await this.setThreadStatus(target.groupId, target.msgId, target.assistantId, 'idle')
  }

  dmProjection(assistantId: string): AssistantDmProjection | undefined {
    const assistant = this.get(assistantId)
    if (assistant === undefined) return undefined
    const dm = this.dmOf(assistantId)
    return { assistant, processing: dm.processing, bubbles: dm.bubbles }
  }

  threadOf(groupId: string, msgId: string, assistantId = DEFAULT_ASSISTANT_ID): LocalThread {
    const existing = this.threads?.get(threadKey(groupId, msgId)) ?? this.memoryThreads.get(threadKey(groupId, msgId))
    if (existing !== undefined) return existing
    return {
      groupId,
      msgId,
      assistantId,
      status: 'idle',
      bubbles: [],
      updatedAt: 0,
    }
  }

  threadsForGroup(groupId: string): LocalThread[] {
    const rows = this.threads !== undefined
      ? [...this.threads.entries()].map(([, row]) => row)
      : [...this.memoryThreads.values()]
    return rows.filter(row => row.groupId === groupId)
  }

  private targetFromSession(sessionId: string): TurnTarget | undefined {
    const assistant = this.getBySession(sessionId)
    if (assistant === undefined) return undefined
    return { kind: 'dm', assistantId: assistant.id }
  }

  private dmOf(assistantId: string): { bubbles: PresentBubble[]; processing: boolean } {
    return this.dm?.get(assistantId)
      ?? this.memoryDm.get(assistantId)
      ?? { bubbles: [], processing: false }
  }

  private async setDmProcessing(assistantId: string, processing: boolean): Promise<void> {
    const dm = this.dmOf(assistantId)
    await this.putDm(assistantId, { bubbles: dm.bubbles, processing })
  }

  private async setThreadStatus(
    groupId: string,
    msgId: string,
    assistantId: string,
    status: LocalThread['status'],
  ): Promise<void> {
    const thread = this.threadOf(groupId, msgId, assistantId)
    await this.putThread({ ...thread, assistantId, status, updatedAt: Date.now() })
  }

  private async putAssistant(record: AssistantRecord): Promise<void> {
    if (this.assistants !== undefined) {
      await this.assistants.put(record.id, record)
      return
    }
    this.memoryAssistants.set(record.id, record)
  }

  private async putDm(assistantId: string, value: { bubbles: PresentBubble[]; processing: boolean }): Promise<void> {
    if (this.dm !== undefined) {
      await this.dm.put(assistantId, value)
      return
    }
    this.memoryDm.set(assistantId, value)
  }

  private async putThread(thread: LocalThread): Promise<void> {
    const key = threadKey(thread.groupId, thread.msgId)
    if (this.threads !== undefined) {
      await this.threads.put(key, thread)
      return
    }
    this.memoryThreads.set(key, thread)
  }
}

/** Cordis service: `ctx.yzjAssistants`. */
export class YzjAssistantsService extends Service {
  readonly store = new AssistantStore()
  /** Per-assistant serial queue. */
  private readonly queues = new Map<string, Promise<void>>()

  constructor(ctx: Context) {
    super(ctx, 'yzjAssistants')
  }

  async openNow(): Promise<void> {
    const facility = this.ctx.get('storageDomain')
    if (facility === undefined) {
      await this.store.ensureDefault()
      return
    }
    try {
      await this.store.open(facility as never)
    } catch (error) {
      this.ctx.logger.warn(`yzjAssistants: store failed to open: ${String(error)}`)
      await this.store.ensureDefault()
    }
  }

  /**
   * Run `job` after any in-flight job for this assistant. Parallel across
   * assistants; serial inside one.
   */
  enqueue(assistantId: string, job: () => Promise<void>): Promise<void> {
    const previous = this.queues.get(assistantId) ?? Promise.resolve()
    const next = previous.then(job, job)
    this.queues.set(assistantId, next.then(() => undefined, () => undefined))
    return next
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    yzjAssistants: YzjAssistantsService
  }
}
