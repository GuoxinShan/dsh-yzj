/**
 * Topic job-done delivery (docs/spec/group-room-topics.md R29): when a
 * DSH topic turn goes idle, post a bounded summary back onto the Yunzhijia
 * reply chain as the logged-in user (CLI `im message send`), and attach
 * files written this turn. Not every assistant bubble — only the concluding
 * answer. Robot inbound stays on PushHub; this path does not call sendMsgUrl.
 *
 * File messages cannot carry `--reply-msg-id` (CLI contract), so images ride
 * the richText reply and other files follow in the group timeline.
 * @module @dsh-yzj/ui-yzj/topic-deliver
 */

import type { Context } from '@deepseek-ai/cordis'
import { stat } from 'node:fs/promises'
import { basename, extname, isAbsolute, join, relative } from 'node:path'
import {
  extractSendMsgId, latestUserSourceKind,
} from '@dsh-yzj/tool-yzj/src/bound-log.ts'
import { LEGACY_HOST_ROOT, type TopicRecord } from '@dsh-yzj/tool-yzj/src/topics.ts'
import { homeIoFrom, sendImAndLog, type HomeIoFace, type ImSendInput, type ImSendResult } from './bound-io.ts'
import { isYzjTopicSessionId, yzjWorkspacePath } from './yzj-cwd.ts'

/** Write-gate slice: pending/approved rows block job-done delivery. */
export interface TopicDeliverWriteGate {
  list: (sessionId: string) => readonly { status: string }[]
}

/** Caps: summary length, files per turn, bytes per file. */
export const TOPIC_DELIVER_MAX_CHARS = 1_800
export const TOPIC_DELIVER_MAX_FILES = 3
export const TOPIC_DELIVER_MAX_BYTES = 8 * 1024 * 1024

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'])
const FILE_EXT = new Set([
  ...IMAGE_EXT,
  '.md', '.txt', '.json', '.csv', '.pdf', '.doc', '.docx',
  '.xls', '.xlsx', '.html', '.htm', '.svg',
])
const WRITE_TOOLS = new Set(['write', 'edit'])

/** Why a turn is not posted back into the Yunzhijia topic. */
export type TopicDeliverSkipReason =
  | 'not-topic'
  | 'plugin-turn'
  | 'no-anchor'
  | 'synthetic-anchor'
  | 'writes-pending'
  | 'already-sent-im'
  | 'no-answer'

/** One session-event face the hub consumes (no dsh-session import). */
export interface TopicDeliverEvent {
  readonly type: string
  readonly seq?: number
  readonly data: unknown
}

/** One in-flight turn's collected output. */
export interface TopicDeliverStash {
  parts: string[]
  writePaths: string[]
  sentIm: boolean
  topSeq: number
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** True when the root cannot be used as `--reply-msg-id`. */
export function isSyntheticAnchor(rootMsgId: string | undefined): boolean {
  if (rootMsgId === undefined || rootMsgId === '') return true
  if (rootMsgId === LEGACY_HOST_ROOT) return true
  return rootMsgId.startsWith('local-')
}

/** Flatten assistant text from either `data.content` or `data.message.content`. */
export function assistantTextOf(data: unknown): string {
  const rec = asRecord(data)
  const message = asRecord(rec.message)
  const content = message.content ?? rec.content
  if (typeof content === 'string') return content.trim()
  if (!Array.isArray(content)) return ''
  const parts: string[] = []
  for (const block of content) {
    if (typeof block === 'string') {
      if (block.trim() !== '') parts.push(block.trim())
      continue
    }
    const row = asRecord(block)
    if (row.type === 'text' && asString(row.text).trim() !== '') parts.push(asString(row.text).trim())
    else if (asString(row.text).trim() !== '') parts.push(asString(row.text).trim())
  }
  return parts.join('\n').trim()
}

function parseToolArgs(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw)
      return asRecord(parsed)
    } catch {
      return {}
    }
  }
  return asRecord(raw)
}

/** `write` / `edit` `file_path` values from one tool/call. */
export function writePathOf(data: unknown): string | undefined {
  const rec = asRecord(data)
  const name = asString(rec.name)
  if (!WRITE_TOOLS.has(name)) return undefined
  const args = parseToolArgs(rec.arguments)
  const path = asString(args.file_path)
  return path === '' ? undefined : path
}

/** Tool name from one tool/call. */
export function toolNameOf(data: unknown): string {
  return asString(asRecord(data).name)
}

/** Decide whether this idle turn should post back into the topic. */
export function decideTopicDelivery(input: {
  readonly sessionId: string
  readonly topic: TopicRecord | undefined
  readonly latestUserKind: 'user' | 'plugin' | 'none'
  readonly writesPending: boolean
  readonly sentIm: boolean
  readonly answer: string
}): { ok: true; replyMsgId: string; groupId: string; title: string } | { ok: false; reason: TopicDeliverSkipReason } {
  if (!isYzjTopicSessionId(input.sessionId)) return { ok: false, reason: 'not-topic' }
  if (input.latestUserKind === 'plugin') return { ok: false, reason: 'plugin-turn' }
  if (input.topic === undefined) return { ok: false, reason: 'not-topic' }
  const root = input.topic.rootMsgId
  if (root === undefined || root === '') return { ok: false, reason: 'no-anchor' }
  if (isSyntheticAnchor(root)) return { ok: false, reason: 'synthetic-anchor' }
  if (input.writesPending) return { ok: false, reason: 'writes-pending' }
  if (input.sentIm) return { ok: false, reason: 'already-sent-im' }
  if (input.answer.trim() === '') return { ok: false, reason: 'no-answer' }
  return {
    ok: true,
    replyMsgId: root,
    groupId: input.topic.yzjConversationId,
    title: input.topic.title,
  }
}

/** Last non-empty assistant part; over-budget keeps only that last block. */
export function concludingAnswer(parts: readonly string[]): string {
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const text = parts[index]?.trim() ?? ''
    if (text !== '') return text
  }
  return ''
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

/** Bounded summary posted as the topic reply (no tool chatter). */
export function composeTopicDelivery(input: {
  readonly title: string
  readonly answer: string
  readonly artifactNames: readonly string[]
}): string {
  const title = input.title.trim()
  const head = title === '' ? '✅ 已完成' : `✅ 已完成「${clip(title, 40)}」`
  const body = clip(input.answer.trim(), TOPIC_DELIVER_MAX_CHARS)
  const names = input.artifactNames.filter(name => name.trim() !== '')
  const images = names.filter(isImageArtifact)
  const files = names.filter(name => !isImageArtifact(name))
  const lines: string[] = []
  if (images.length > 0) lines.push(`🖼 图片附在本回复：${images.join('、')}`)
  if (files.length > 0) {
    lines.push(`📎 文件发在群时间线（CLI 文件消息不能挂回复链）：${files.join('、')}`)
  }
  const artifacts = lines.length === 0 ? '' : `\n\n${lines.join('\n')}`
  return `${head}\n\n${body}${artifacts}`
}

/** Keep a path inside `cwd`; reject escapes and empty names. */
export function resolveWorkspaceFile(cwd: string, filePath: string): string | undefined {
  if (cwd === '' || filePath.trim() === '') return undefined
  const resolved = isAbsolute(filePath) ? filePath : join(cwd, filePath)
  const rel = relative(cwd, resolved)
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) return undefined
  if (rel.split(/[/\\]/).some(part => part === 'node_modules' || part === '.git')) return undefined
  const ext = extname(resolved).toLowerCase()
  if (ext !== '' && !FILE_EXT.has(ext)) return undefined
  return resolved
}

function uniquePaths(paths: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const path of paths) {
    if (seen.has(path)) continue
    seen.add(path)
    out.push(path)
  }
  return out
}

/** Classify an uploaded file for reply vs follow-on file message. */
export function isImageArtifact(name: string): boolean {
  return IMAGE_EXT.has(extname(name).toLowerCase())
}

/** Extract a fileId from `file upload` CLI JSON (pitfall-003 envelopes). */
export function extractUploadFileId(json: unknown): string | undefined {
  const record = asRecord(json)
  for (const key of ['fileId', 'file_id', 'id']) {
    const value = record[key]
    if (typeof value === 'string' && value !== '') return value
  }
  const inner = asRecord(record.data)
  for (const key of ['fileId', 'file_id', 'id']) {
    const value = inner[key]
    if (typeof value === 'string' && value !== '') return value
  }
  return undefined
}

async function existingFile(path: string): Promise<{ path: string; name: string; bytes: number } | undefined> {
  try {
    const info = await stat(path)
    if (!info.isFile() || info.size <= 0 || info.size > TOPIC_DELIVER_MAX_BYTES) return undefined
    return { path, name: basename(path), bytes: info.size }
  } catch {
    return undefined
  }
}

/** One uploaded artifact ready to send. */
export interface UploadedArtifact {
  readonly fileId: string
  readonly name: string
  readonly image: boolean
}

/**
 * Upload + send the job-done reply (and follow-on files). Caller has already
 * decided this turn should deliver.
 */
export async function deliverTopicResult(options: {
  readonly ctx: Context
  readonly home: HomeIoFace | undefined
  readonly topic: TopicRecord
  readonly replyMsgId: string
  readonly title: string
  readonly answer: string
  readonly artifactPaths: readonly string[]
  readonly send?: (input: ImSendInput) => Promise<ImSendResult>
  readonly upload?: (localPath: string, name: string) => Promise<string | undefined>
}): Promise<{ ok: boolean; replyMsgId?: string; filesSent: number; error?: string }> {
  const send = options.send ?? ((input: ImSendInput) => sendImAndLog(options.ctx, options.home, input))
  const upload = options.upload ?? (async (localPath: string, name: string) => {
    try {
      const result = await options.ctx.yzjBridge.run(
        ['file', 'upload', '--file', localPath, '--name', name],
        { timeoutMs: 120_000 },
      )
      if (!result.ok) return undefined
      return extractUploadFileId(result.json)
    } catch {
      return undefined
    }
  })
  const uploaded: UploadedArtifact[] = []
  for (const path of options.artifactPaths.slice(0, TOPIC_DELIVER_MAX_FILES)) {
    const file = await existingFile(path)
    if (file === undefined) continue
    const fileId = await upload(file.path, file.name)
    if (fileId === undefined) continue
    uploaded.push({ fileId, name: file.name, image: isImageArtifact(file.name) })
  }
  const images = uploaded.filter(item => item.image)
  const files = uploaded.filter(item => !item.image)
  const summary = composeTopicDelivery({
    title: options.title,
    answer: options.answer,
    artifactNames: uploaded.map(item => item.name),
  })
  const placeholders = images.map(() => '[图片]').join('')
  const content = images.length === 0
    ? summary
    : `${summary}${placeholders === '' ? '' : `\n${placeholders}`}`
  const reply: ImSendInput = {
    groupId: options.topic.yzjConversationId,
    msgType: images.length > 0 ? 'richText' : 'text',
    content,
    images: images.map(item => item.fileId),
    atOpenIds: [],
    atAll: false,
    replyMsgId: options.replyMsgId,
    topicSessionId: options.topic.dshSessionId,
  }
  const posted = await send(reply)
  if (!posted.ok) return { ok: false, filesSent: 0, error: posted.error }
  const postedId = extractSendMsgId(posted.value) ?? posted.localId
  if (postedId !== undefined) {
    await options.home?.registerTopicOutbound?.(postedId, options.topic.dshSessionId)
  }
  let filesSent = images.length
  for (const file of files) {
    const sent = await send({
      groupId: options.topic.yzjConversationId,
      msgType: 'file',
      fileId: file.fileId,
      fileName: file.name,
      images: [],
      atOpenIds: [],
      atAll: false,
      topicSessionId: options.topic.dshSessionId,
    })
    if (sent.ok) {
      filesSent += 1
      const fileMsgId = extractSendMsgId(sent.value) ?? sent.localId
      if (fileMsgId !== undefined) {
        await options.home?.registerTopicOutbound?.(fileMsgId, options.topic.dshSessionId)
      }
    }
  }
  return {
    ok: true,
    filesSent,
    ...(postedId === undefined ? {} : { replyMsgId: postedId }),
  }
}

/** Collect one turn's assistant text / write paths / IM sends. */
export class TopicDeliverHub {
  private readonly stashes = new Map<string, TopicDeliverStash>()
  private readonly watermarks = new Map<string, number>()
  private readonly inflight = new Set<string>()

  constructor(
    private readonly deps: {
      readonly getTopic: (sessionId: string) => TopicRecord | undefined
      readonly writesPending: (sessionId: string) => boolean
      readonly workspaceCwd: () => string
      readonly deliver: (input: {
        topic: TopicRecord
        replyMsgId: string
        title: string
        answer: string
        artifactPaths: readonly string[]
      }) => Promise<unknown>
    },
  ) {}

  /** `session/event` slice; ignores non-topic sessions. */
  noteEvent(sessionId: string, event: TopicDeliverEvent): void {
    if (!isYzjTopicSessionId(sessionId)) return
    if (event.type === 'turn/start') {
      this.stashes.set(sessionId, emptyStash())
      return
    }
    if (event.type === 'user/message') {
      const data = asRecord(event.data)
      const source = asRecord(data.source)
      if (source.kind !== 'plugin') this.stashes.set(sessionId, emptyStash())
      return
    }
    const stash = this.stashOf(sessionId)
    const seq = typeof event.seq === 'number' ? event.seq : stash.topSeq
    if (seq <= (this.watermarks.get(sessionId) ?? -1)) return
    if (seq > stash.topSeq) stash.topSeq = seq
    if (event.type === 'assistant/message') {
      const text = assistantTextOf(event.data)
      if (text !== '') stash.parts.push(text)
      return
    }
    if (event.type === 'tool/call') {
      const name = toolNameOf(event.data)
      if (name === 'yzj_im_message_send') stash.sentIm = true
      const path = writePathOf(event.data)
      if (path !== undefined) stash.writePaths.push(path)
    }
  }

  /** `agent/status` idle: decide and post. */
  noteIdle(sessionId: string, latestUserKind: 'user' | 'plugin' | 'none', cwd?: string): void {
    if (!isYzjTopicSessionId(sessionId)) return
    if (this.inflight.has(sessionId)) return
    const stash = this.stashes.get(sessionId)
    if (stash === undefined) return
    this.stashes.delete(sessionId)
    const answer = concludingAnswer(stash.parts)
    const topic = this.deps.getTopic(sessionId)
    const decision = decideTopicDelivery({
      sessionId,
      topic,
      latestUserKind,
      writesPending: this.deps.writesPending(sessionId),
      sentIm: stash.sentIm,
      answer,
    })
    if (!decision.ok || topic === undefined) {
      if (stash.topSeq >= 0) this.watermarks.set(sessionId, stash.topSeq)
      return
    }
    const root = cwd !== undefined && cwd !== '' ? cwd : this.deps.workspaceCwd()
    const artifactPaths = uniquePaths(
      stash.writePaths
        .map(path => resolveWorkspaceFile(root, path))
        .filter((path): path is string => path !== undefined),
    ).slice(0, TOPIC_DELIVER_MAX_FILES)
    this.inflight.add(sessionId)
    void this.deps.deliver({
      topic,
      replyMsgId: decision.replyMsgId,
      title: decision.title,
      answer,
      artifactPaths,
    }).then((result) => {
      const failed = typeof result === 'object' && result !== null
        && 'ok' in result && (result as { ok: unknown }).ok === false
      if (failed) {
        this.stashes.set(sessionId, stash)
        return
      }
      if (stash.topSeq >= 0) this.watermarks.set(sessionId, stash.topSeq)
    }, () => {
      this.stashes.set(sessionId, stash)
    }).finally(() => {
      this.inflight.delete(sessionId)
    })
  }

  private stashOf(sessionId: string): TopicDeliverStash {
    let stash = this.stashes.get(sessionId)
    if (stash === undefined) {
      stash = emptyStash()
      this.stashes.set(sessionId, stash)
    }
    return stash
  }
}

function emptyStash(): TopicDeliverStash {
  return { parts: [], writePaths: [], sentIm: false, topSeq: -1 }
}

/**
 * Wire the hub onto the host firehose. `yzjHome` is resolved per event so
 * a late tool-yzj mount still delivers.
 */
export function applyTopicDeliver(ctx: Context, writeGate: TopicDeliverWriteGate): TopicDeliverHub {
  const hub = new TopicDeliverHub({
    getTopic: (sessionId) => {
      const home = homeIoFrom(ctx.get('yzjHome'))
      return home?.getTopicBySession?.(sessionId)
    },
    writesPending: (sessionId) => writeGate.list(sessionId).some(
      row => row.status === 'pending' || row.status === 'approved',
    ),
    workspaceCwd: () => yzjWorkspacePath(),
    deliver: async (input) => {
      const home = homeIoFrom(ctx.get('yzjHome'))
      return deliverTopicResult({
        ctx,
        home,
        topic: input.topic,
        replyMsgId: input.replyMsgId,
        title: input.title,
        answer: input.answer,
        artifactPaths: input.artifactPaths,
      })
    },
  })
  ctx.on('session/event', (session, event) => {
    hub.noteEvent(String(session.id), event as TopicDeliverEvent)
  })
  ctx.on('agent/status', (payload) => {
    if (payload.status !== 'idle') return
    const sessionId = String(payload.agent.id)
    const events = payload.agent.session.events as readonly { type: string; data: unknown }[]
    hub.noteIdle(sessionId, latestUserSourceKind(events), sessionCwd(payload.agent.session))
  })
  return hub
}

function sessionCwd(session: unknown): string | undefined {
  const cwd = asString(asRecord(asRecord(session).meta).cwd)
  return cwd === '' ? undefined : cwd
}
