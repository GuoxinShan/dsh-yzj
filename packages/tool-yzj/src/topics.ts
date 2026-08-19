/**
 * Topic-session index: one Yunzhijia group room hosts 0..N agent topics
 * (docs/spec/group-room-topics.md R1/R4). Anchor key is
 * `(yzjConversationId, rootMsgId)`; outbound robot posts register so a
 * reply chain continues the same topic.
 * @module @dsh-yzj/tool-yzj/topics
 */

import { z } from 'zod'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import type { Domain, KvTable } from '@deepseek-ai/dsh-storage-domain'

/** How a topic was spawned. */
export type TopicSource = 'dsh' | 'yzj' | 'handoff'

/**
 * Synthetic root for pre-v2.0 ③④ left on the group-room host
 * (docs/spec/group-room-topics.md H9). Stable `topicSessionId` slug.
 */
export const LEGACY_HOST_ROOT = 'legacy-host'

/** Sidebar / drawer title for {@link LEGACY_HOST_ROOT}. */
export const LEGACY_HOST_TITLE = '历史对话'

/** Topic lifecycle (docs/spec/group-room-topics.md P3 / L2). */
export type TopicStatus = 'running' | 'confirm' | 'done'

/** One durable topic row (lossless JSON). */
export interface TopicRecord {
  readonly dshSessionId: string
  readonly yzjConversationId: string
  readonly title: string
  readonly source: TopicSource
  readonly createdAt: number
  /** Last topic activity (ms). Missing on pre-v1.1 rows — use {@link topicActivity}. */
  readonly lastActivity?: number
  /** Missing on pre-P3 rows — treat as running. */
  readonly status?: TopicStatus
  readonly rootMsgId?: string
  readonly originWho?: string
  readonly originText?: string
  readonly originTime?: number
  readonly fromSessionId?: string
}

/** Activity clock for L1 merge: `lastActivity` or, for old rows, `createdAt`. */
export function topicActivity(record: Pick<TopicRecord, 'createdAt' | 'lastActivity'>): number {
  return record.lastActivity ?? record.createdAt
}

/** Lifecycle for L2 badges: missing (pre-P3) rows count as running. */
export function topicStatusOf(record: Pick<TopicRecord, 'status'> | TopicStatus | undefined): TopicStatus {
  const value = typeof record === 'string' || record === undefined ? record : record.status
  return value === 'confirm' || value === 'done' ? value : 'running'
}

/** Result of ensureTopic: `created` means a new topic row, not a parallel root. */
export interface TopicEnsureResult {
  readonly sessionId: string
  readonly created: boolean
  readonly record: TopicRecord
}

/** Input for minting or focusing a topic. */
export interface TopicEnsureInput {
  readonly yzjConversationId: string
  readonly source: TopicSource
  readonly title?: string
  readonly rootMsgId?: string
  readonly originWho?: string
  readonly originText?: string
  readonly originTime?: number
  readonly fromSessionId?: string
  /**
   * When true, an existing root is returned as-is (no `lastActivity` bump).
   * Used by H9 migrate-on-open so merely focusing a room does not steal L1.
   */
  readonly quiet?: boolean
  /** Create-time activity clock; default `Date.now()`. H9 passes host ③④ time. */
  readonly lastActivity?: number
}

const topicSchema = z.object({
  dshSessionId: z.string().min(1),
  yzjConversationId: z.string().min(1),
  title: z.string(),
  source: z.enum(['dsh', 'yzj', 'handoff']),
  createdAt: z.number(),
  lastActivity: z.number().optional(),
  status: z.enum(['running', 'confirm', 'done']).optional(),
  rootMsgId: z.string().optional(),
  originWho: z.string().optional(),
  originText: z.string().optional(),
  originTime: z.number().optional(),
  fromSessionId: z.string().optional(),
}) as unknown as z.ZodType<TopicRecord>

const sessionIndexSchema = z.object({
  yzjConversationId: z.string().min(1),
})

const groupIndexSchema = z.object({
  ids: z.array(z.string()),
})

/** Durable domain: topics, reverse session index, outbound msgId → topic. */
export const yzjTopicDomainSpec = defineDomain({
  name: 'yzj_topic_anchors',
  version: 0,
  tables: {
    topics: domainTable<string, TopicRecord>(topicSchema),
    sessions: domainTable<string, { yzjConversationId: string }>(sessionIndexSchema),
    outbound: domainTable<string, { dshSessionId: string }>(z.object({ dshSessionId: z.string().min(1) })),
    groups: domainTable<string, { ids: string[] }>(groupIndexSchema),
    anchors: domainTable<string, { dshSessionId: string }>(z.object({ dshSessionId: z.string().min(1) })),
  },
})

function slug(value: string, max: number): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  const body = cleaned === '' ? 'x' : cleaned.slice(0, max)
  return body
}

/** Product id for one topic. Stable when `rootMsgId` is present. */
export function topicSessionId(yzjConversationId: string, rootMsgId?: string): string {
  const group = slug(yzjConversationId, 40)
  if (rootMsgId !== undefined && rootMsgId !== '') {
    return `yzj-topic-${group}-${slug(rootMsgId, 24)}`
  }
  return `yzj-topic-${group}-${Date.now().toString(36)}`
}

/** Anchor table key: conversation + root message. */
export function topicAnchorKey(yzjConversationId: string, rootMsgId: string): string {
  return `${yzjConversationId}\t${rootMsgId}`
}

function defaultTitle(input: TopicEnsureInput): string {
  if (input.title !== undefined && input.title.trim() !== '') return input.title.trim().slice(0, 40)
  const excerpt = (input.originText ?? '').replace(/\s+/g, ' ').trim()
  if (excerpt !== '') return excerpt.slice(0, 24)
  return '新话题'
}

/** Read/write face over the opened domain; inert (memory-only) until `open()`. */
export class TopicAnchorStore {
  private topics: KvTable<string, TopicRecord> | undefined
  private sessions: KvTable<string, { yzjConversationId: string }> | undefined
  private outbound: KvTable<string, { dshSessionId: string }> | undefined
  private groups: KvTable<string, { ids: string[] }> | undefined
  private anchors: KvTable<string, { dshSessionId: string }> | undefined
  private readonly memoryTopics = new Map<string, TopicRecord>()
  private readonly memorySess = new Map<string, string>()
  private readonly memoryOutbound = new Map<string, string>()
  private readonly memoryGroups = new Map<string, string[]>()
  private readonly memoryAnchors = new Map<string, string>()

  /** Open (or adopt) the domain; safe to await repeatedly. */
  async open(facility: { open(spec: typeof yzjTopicDomainSpec): Promise<Domain<typeof yzjTopicDomainSpec>> }): Promise<void> {
    if (this.topics !== undefined) return
    const domain = await facility.open(yzjTopicDomainSpec)
    this.topics = domain.table('topics')
    this.sessions = domain.table('sessions')
    this.outbound = domain.table('outbound')
    this.groups = domain.table('groups')
    this.anchors = domain.table('anchors')
    for (const [key, value] of this.memoryTopics) {
      if (this.topics.get(key) === undefined) {
        await this.topics.put(key, value)
        await this.sessions.put(value.dshSessionId, { yzjConversationId: value.yzjConversationId })
      }
    }
    for (const [msgId, sessionId] of this.memoryOutbound) {
      if (this.outbound.get(msgId) === undefined) {
        await this.outbound.put(msgId, { dshSessionId: sessionId })
      }
    }
    for (const [groupId, ids] of this.memoryGroups) {
      if (this.groups.get(groupId) === undefined) {
        await this.groups.put(groupId, { ids })
      }
    }
    for (const [key, sessionId] of this.memoryAnchors) {
      if (this.anchors.get(key) === undefined) {
        await this.anchors.put(key, { dshSessionId: sessionId })
      }
    }
    this.memoryTopics.clear()
    this.memorySess.clear()
    this.memoryOutbound.clear()
    this.memoryGroups.clear()
    this.memoryAnchors.clear()
  }

  /** Close the domain (idempotent). */
  async close(): Promise<void> {
    this.topics = undefined
    this.sessions = undefined
    this.outbound = undefined
    this.groups = undefined
    this.anchors = undefined
  }

  /** Topic for one DSH session, or undefined. */
  getBySession(dshSessionId: string): TopicRecord | undefined {
    if (this.topics !== undefined) return this.topics.get(dshSessionId)
    return this.memoryTopics.get(dshSessionId)
  }

  /** Topic anchored on one inbound root message, or undefined. */
  getByAnchor(yzjConversationId: string, rootMsgId: string): TopicRecord | undefined {
    const sessionId = this.sessionIdOfAnchor(yzjConversationId, rootMsgId)
    if (sessionId === undefined) return undefined
    return this.getBySession(sessionId)
  }

  /** Topic that posted this outbound robot msgId, or undefined. */
  getByOutbound(msgId: string): TopicRecord | undefined {
    const sessionId = this.outbound?.get(msgId)?.dshSessionId ?? this.memoryOutbound.get(msgId)
    if (sessionId === undefined) return undefined
    return this.getBySession(sessionId)
  }

  /** Every topic of one group, newest last. */
  listByConversation(yzjConversationId: string): TopicRecord[] {
    const ids = this.groups?.get(yzjConversationId)?.ids ?? this.memoryGroups.get(yzjConversationId) ?? []
    const rows: TopicRecord[] = []
    for (const id of ids) {
      const row = this.getBySession(id)
      if (row !== undefined) rows.push(row)
    }
    return rows
  }

  /**
   * Return the existing topic for this root, or allocate one.
   * Same `(conversation, rootMsgId)` is always focus (`created: false`).
   */
  async ensureTopic(input: TopicEnsureInput): Promise<TopicEnsureResult> {
    if (input.rootMsgId !== undefined && input.rootMsgId !== '') {
      const existing = this.getByAnchor(input.yzjConversationId, input.rootMsgId)
      if (existing !== undefined) {
        if (input.quiet === true) {
          return { sessionId: existing.dshSessionId, created: false, record: existing }
        }
        const touched: TopicRecord = { ...existing, lastActivity: Date.now() }
        await this.putTopic(touched)
        return { sessionId: touched.dshSessionId, created: false, record: touched }
      }
    }
    let sessionId = topicSessionId(input.yzjConversationId, input.rootMsgId)
    let suffix = 2
    while (this.getBySession(sessionId) !== undefined) {
      sessionId = `${topicSessionId(input.yzjConversationId, input.rootMsgId)}-${suffix}`
      suffix += 1
    }
    const now = Date.now()
    const record: TopicRecord = {
      dshSessionId: sessionId,
      yzjConversationId: input.yzjConversationId,
      title: defaultTitle(input),
      source: input.source,
      createdAt: now,
      lastActivity: input.lastActivity ?? now,
      status: 'running',
      ...(input.rootMsgId === undefined || input.rootMsgId === '' ? {} : { rootMsgId: input.rootMsgId }),
      ...(input.originWho === undefined ? {} : { originWho: input.originWho }),
      ...(input.originText === undefined ? {} : { originText: input.originText }),
      ...(input.originTime === undefined ? {} : { originTime: input.originTime }),
      ...(input.fromSessionId === undefined ? {} : { fromSessionId: input.fromSessionId }),
    }
    await this.putTopic(record)
    return { sessionId, created: true, record }
  }

  /** Register a robot outbound post so reply chains continue this topic. */
  async registerOutbound(msgId: string, dshSessionId: string): Promise<void> {
    if (this.outbound !== undefined) {
      await this.outbound.put(msgId, { dshSessionId })
      return
    }
    this.memoryOutbound.set(msgId, dshSessionId)
  }

  /**
   * Set lifecycle status (P3 / L2 / L5). No-op when the session is not a
   * topic or the value is unchanged.
   */
  async setStatus(sessionId: string, status: TopicStatus): Promise<void> {
    const existing = this.getBySession(sessionId)
    if (existing === undefined || topicStatusOf(existing) === status) return
    await this.putTopic({ ...existing, status, lastActivity: Date.now() })
  }

  /**
   * Move an anchor from an optimistic `local-*` id to the real Yunzhijia
   * msgId after CLI ack. Session id stays put. No-op when the old root has
   * no topic or the ids match.
   */
  async retargetAnchor(yzjConversationId: string, fromMsgId: string, toMsgId: string): Promise<void> {
    if (fromMsgId === toMsgId || fromMsgId === '' || toMsgId === '') return
    const existing = this.getByAnchor(yzjConversationId, fromMsgId)
    if (existing === undefined) return
    const already = this.getByAnchor(yzjConversationId, toMsgId)
    if (already !== undefined && already.dshSessionId !== existing.dshSessionId) return
    const next: TopicRecord = { ...existing, rootMsgId: toMsgId }
    const oldKey = topicAnchorKey(yzjConversationId, fromMsgId)
    if (this.anchors !== undefined) await this.anchors.delete(oldKey)
    else this.memoryAnchors.delete(oldKey)
    await this.putTopic(next)
  }

  private sessionIdOfAnchor(yzjConversationId: string, rootMsgId: string): string | undefined {
    const key = topicAnchorKey(yzjConversationId, rootMsgId)
    return this.anchors?.get(key)?.dshSessionId ?? this.memoryAnchors.get(key)
  }

  private async putTopic(record: TopicRecord): Promise<void> {
    const anchorKey = record.rootMsgId === undefined || record.rootMsgId === ''
      ? undefined
      : topicAnchorKey(record.yzjConversationId, record.rootMsgId)
    if (this.topics !== undefined && this.sessions !== undefined && this.groups !== undefined) {
      await this.topics.put(record.dshSessionId, record)
      await this.sessions.put(record.dshSessionId, { yzjConversationId: record.yzjConversationId })
      const current = this.groups.get(record.yzjConversationId)?.ids ?? []
      if (!current.includes(record.dshSessionId)) {
        await this.groups.put(record.yzjConversationId, { ids: [...current, record.dshSessionId] })
      }
      if (anchorKey !== undefined && this.anchors !== undefined) {
        await this.anchors.put(anchorKey, { dshSessionId: record.dshSessionId })
      }
      return
    }
    this.memoryTopics.set(record.dshSessionId, record)
    this.memorySess.set(record.dshSessionId, record.yzjConversationId)
    const ids = this.memoryGroups.get(record.yzjConversationId) ?? []
    if (!ids.includes(record.dshSessionId)) {
      this.memoryGroups.set(record.yzjConversationId, [...ids, record.dshSessionId])
    }
    if (anchorKey !== undefined) this.memoryAnchors.set(anchorKey, record.dshSessionId)
  }
}
