/**
 * Yunzhijia browser surface, node half: the `/yzj` Connection RPC channel over
 * `ctx.yzjBridge`. The browser half fetches workspaces, docs, events, chats,
 * and contacts through it; the model-facing tools remain in `@dsh-yzj/tool-yzj`.
 * Only lossless CLI-parsed JSON crosses the channel — never harness live
 * objects.
 * @module @dsh-yzj/ui-yzj
 */

import type { Context } from '@deepseek-ai/cordis'
import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection'
import type {} from '@dsh-yzj/bridge'
import type {} from '@dsh-yzj/tool-yzj'
import { applyWriteGate, type YzjWriteRecord } from './write-gate.ts'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'ui-yzj'
/** Services required by the board channel plus the robot settings face. */
export const inject = ['connection', 'yzjBridge']

/** Internal failure envelope matching the closed RpcError union. */
function internalError(message: string): { ok: false; error: { code: 'internal'; message: string; details: Record<string, never> } } {
  return { ok: false, error: { code: 'internal', message, details: {} } }
}

/** One bridge call projected into the RPC result envelope. */
async function bridgeResult(
  ctx: Context,
  label: string,
  command: readonly string[],
): Promise<{ ok: true; value: unknown } | { ok: false; error: { code: 'internal'; message: string; details: Record<string, never> } }> {
  let result
  try {
    result = await ctx.yzjBridge.run(command)
  } catch (error) {
    // The bridge rejects only on spawn failure (binary missing, bad path) —
    // surface a structured error with the login hint instead of a 500.
    return internalError(`${label} failed: ${String(error)}；请确认已安装 yzj-cli 并完成 \`yzj-cli auth login\``)
  }
  if (!result.ok) {
    const detail = result.stderr.trim() === '' ? `${label} failed (exit ${result.exitCode})` : result.stderr.trim()
    return internalError(detail)
  }
  return { ok: true, value: result.json ?? {} }
}

/** Validate a string field of an RPC payload. */
function stringField(payload: unknown, key: string): string | undefined {
  const value = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>)[key] : undefined
  return typeof value === 'string' && value !== '' ? value : undefined
}

/** Validate a non-negative integer field of an RPC payload. */
function numberField(payload: unknown, key: string): number | undefined {
  const value = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>)[key] : undefined
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined
}

/** Cap an integer field at the CLI's real `--limit` bound (1-20 for im). */
function clampLimit(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) return undefined
  return Math.min(value, CLI_LIMIT_MAX)
}

/** Hard CLI cap for im `--limit` (verified against yzj-cli 0.x). */
const CLI_LIMIT_MAX = 20

/* ── file-data proxy (docrest URLs need the CLI's auth) ─────────────── */

/** Largest payload the proxy returns (bytes) — keeps RPC and memory sane. */
const FILE_DATA_MAX_BYTES = 24 * 1024 * 1024
const fileDataCache = new Map<string, { dataUrl: string; bytes: number }>()
const fileDataInflight = new Map<string, Promise<{ dataUrl: string; bytes: number } | undefined>>()
let fileDataCachedBytes = 0

/** Sniff an image MIME from magic bytes ('' = not a known image). */
function sniffMime(bytes: Buffer): string {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return 'image/gif'
  if (bytes.length >= 12 && bytes.slice(0, 4).toString('latin1') === 'RIFF' && bytes.slice(8, 12).toString('latin1') === 'WEBP') return 'image/webp'
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return 'image/bmp'
  return ''
}

/** Download one file via the authenticated CLI; data URL or undefined. */
async function downloadFileData(ctx: Context, fileId: string): Promise<{ dataUrl: string; bytes: number } | undefined> {
  const dir = await mkdtemp(join(tmpdir(), 'yzj-file-'))
  const target = join(dir, 'payload.bin')
  try {
    const result = await ctx.yzjBridge.run(['file', 'download', '--id', fileId, '--output', target], { timeoutMs: 60_000 })
    if (!result.ok) return undefined
    const bytes = await readFile(target)
    if (bytes.length === 0 || bytes.length > FILE_DATA_MAX_BYTES) return undefined
    const mime = sniffMime(bytes) === '' ? 'application/octet-stream' : sniffMime(bytes)
    return { dataUrl: `data:${mime};base64,${bytes.toString('base64')}`, bytes: bytes.length }
  } catch {
    return undefined
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

/** Cached fileId → data URL (bounded by entries and total bytes). */
function rememberFileData(fileId: string, entry: { dataUrl: string; bytes: number }): void {
  fileDataCache.set(fileId, entry)
  fileDataCachedBytes += entry.bytes
  for (const [key, value] of fileDataCache) {
    if (fileDataCache.size <= 48 && fileDataCachedBytes <= 96 * 1024 * 1024) break
    fileDataCache.delete(key)
    fileDataCachedBytes -= value.bytes
  }
}

/** Resolve one file's data URL, deduped per fileId. */
async function fileDataFor(ctx: Context, fileId: string): Promise<{ dataUrl: string; bytes: number } | undefined> {
  const cached = fileDataCache.get(fileId)
  if (cached !== undefined) return cached
  let pending = fileDataInflight.get(fileId)
  if (pending === undefined) {
    pending = downloadFileData(ctx, fileId)
    fileDataInflight.set(fileId, pending)
  }
  const entry = await pending
  fileDataInflight.delete(fileId)
  if (entry !== undefined) rememberFileData(fileId, entry)
  return entry
}

/** Project a write-gate record into lossless JSON for the browser card. */
function projectRecord(record: YzjWriteRecord): YzjWriteRecord {
  return {
    writeId: record.writeId,
    sessionId: record.sessionId,
    toolName: record.toolName,
    ...record.callId === undefined ? {} : { callId: record.callId },
    level: record.level,
    domain: record.domain,
    args: record.args,
    reason: record.reason,
    status: record.status,
    ...record.error === undefined ? {} : { error: record.error },
    time: record.time,
    ...record.decidedAt === undefined ? {} : { decidedAt: record.decidedAt },
  }
}

/** The write-gate query/decide face consumed by the RPC handler. */
export interface YzjWriteGateFace {
  list: (sessionId: string, callId?: string) => YzjWriteRecord[]
  decide: (writeId: string, outcome: 'allowed-once' | 'rejected') => boolean
}

/**
 * Build the `/yzj` RPC handler: `workspaces`, `docs`, `events`, `groups`,
 * `messages`, `whoami`, `search`, `doc-get`, `doc-blocks`, `sheet-get`,
 * `workspace-get`, `event-get`, `contact-get`, `write-list`, and
 * `write-decide` endpoints, all backed by the yzj-cli bridge and the
 * write-gate. Endpoint payloads are validated as lossless JSON before use.
 * @param ctx - Cordis context carrying the bridge service.
 * @param writeGate - the confirmation-card bridge face.
 */
export function createRpcHandler(ctx: Context, writeGate: YzjWriteGateFace): ConnectionRpcHandler {
  return async (endpoint, payload, _signal) => {
    switch (endpoint) {
      case 'workspaces': {
        const type = stringField(payload, 'type')
        const command = ['doc', 'workspace', 'list']
        if (type !== undefined) command.push('--type', type)
        return bridgeResult(ctx, 'doc workspace list', command)
      }
      case 'docs': {
        const workspace = stringField(payload, 'workspace')
        if (workspace === undefined) return internalError('docs endpoint requires a workspace payload')
        const command = ['doc', 'list', '--workspace', workspace]
        const parentId = stringField(payload, 'parentId')
        if (parentId !== undefined) command.push('--parent-id', parentId)
        return bridgeResult(ctx, 'doc list', command)
      }
      case 'events': {
        const start = stringField(payload, 'start')
        const end = stringField(payload, 'end')
        if (start === undefined || end === undefined) return internalError('events endpoint requires start and end payloads')
        return bridgeResult(ctx, 'calendar event list', ['calendar', 'event', 'list', '--start', start, '--end', end])
      }
      case 'groups': {
        const command = ['im', 'group', 'recent']
        if (typeof payload === 'object' && payload !== null) {
          const limit = clampLimit((payload as Record<string, unknown>).limit)
          if (limit !== undefined) command.push('--limit', String(limit))
          const page = (payload as Record<string, unknown>).page
          if (typeof page === 'number' && Number.isInteger(page) && page > 0) command.push('--page', String(page))
        }
        return bridgeResult(ctx, 'im group recent', command)
      }
      case 'messages': {
        const groupId = stringField(payload, 'groupId')
        if (groupId === undefined) return internalError('messages endpoint requires a groupId payload')
        const command = ['im', 'message', 'list', '--group-id', groupId]
        const type = stringField(payload, 'type')
        if (type !== undefined) command.push('--type', type)
        const msgId = stringField(payload, 'msgId')
        if (msgId !== undefined) command.push('--msg-id', msgId)
        if (typeof payload === 'object' && payload !== null) {
          const limit = clampLimit((payload as Record<string, unknown>).limit)
          if (limit !== undefined) command.push('--limit', String(limit))
        }
        return bridgeResult(ctx, 'im message list', command)
      }
      case 'whoami': {
        return bridgeResult(ctx, 'contact user get', ['contact', 'user', 'get'])
      }
      case 'doc-get': {
        const id = stringField(payload, 'id')
        if (id === undefined) return internalError('doc-get endpoint requires an id payload')
        return bridgeResult(ctx, 'doc get', ['doc', 'get', '--id', id])
      }
      case 'doc-blocks': {
        const id = stringField(payload, 'id')
        if (id === undefined) return internalError('doc-blocks endpoint requires an id payload')
        const command = ['doc', 'block', 'list', '--id', id]
        const blockId = stringField(payload, 'blockId')
        if (blockId !== undefined) command.push('--block-id', blockId)
        // Block dumps are legitimately large (a meeting note measures ~390k
        // chars; the bridge's default 200k cap truncates them into
        // unparseable JSON → the preview rendered EMPTY for big docs). Use a
        // dedicated 2MB budget for this read-only endpoint.
        let result
        try {
          result = await ctx.yzjBridge.run(command, { timeoutMs: 120_000, maxOutputChars: 2_000_000 })
        } catch (error) {
          return internalError(`doc block list failed: ${String(error)}；请确认已安装 yzj-cli 并完成 \`yzj-cli auth login\``)
        }
        if (!result.ok) {
          const detail = result.stderr.trim() === '' ? `doc block list failed (exit ${result.exitCode})` : result.stderr.trim()
          return internalError(detail)
        }
        return { ok: true, value: result.json ?? {} }
      }
      case 'sheet-get': {
        const id = stringField(payload, 'id')
        if (id === undefined) return internalError('sheet-get endpoint requires an id payload')
        return bridgeResult(ctx, 'sheet get', ['sheet', 'get', '--id', id])
      }
      case 'workspace-get': {
        const id = stringField(payload, 'id')
        if (id === undefined) return internalError('workspace-get endpoint requires an id payload')
        return bridgeResult(ctx, 'doc workspace get', ['doc', 'workspace', 'get', '--id', id])
      }
      case 'event-get': {
        const id = stringField(payload, 'id')
        if (id === undefined) return internalError('event-get endpoint requires an id payload')
        return bridgeResult(ctx, 'calendar event get', ['calendar', 'event', 'get', '--id', id])
      }
      case 'contact-get': {
        const openId = stringField(payload, 'openId')
        if (openId === undefined) return internalError('contact-get endpoint requires an openId payload')
        return bridgeResult(ctx, 'contact user get', ['contact', 'user', 'get', '--open-id', openId])
      }
      case 'search': {
        const keyword = stringField(payload, 'keyword')
        if (keyword === undefined) return internalError('search endpoint requires a keyword payload')
        return bridgeResult(ctx, 'contact user search', ['contact', 'user', 'search', '--keyword', keyword])
      }
      case 'im-send': {
        const groupId = stringField(payload, 'groupId')
        if (groupId === undefined) return internalError('im-send endpoint requires a groupId payload')
        const record = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {}
        const msgType = stringField(record, 'msgType') ?? 'text'
        if (msgType !== 'text' && msgType !== 'richText' && msgType !== 'file') {
          return internalError(`im-send endpoint rejects msg-type "${msgType}"`)
        }
        const content = stringField(record, 'content')
        const fileId = stringField(record, 'fileId')
        const replyMsgId = stringField(record, 'replyMsgId')
        const rawImages = record.images
        const images = Array.isArray(rawImages)
          ? rawImages.filter((item): item is string => typeof item === 'string' && item !== '')
          : []
        // Mirror the tool's validation: file needs a fileId and nothing else.
        if (msgType === 'file') {
          if (fileId === undefined) return internalError('im-send: msg-type file requires fileId')
          if (content !== undefined || replyMsgId !== undefined || images.length > 0) {
            return internalError('im-send: msg-type file does not support content, reply, or images')
          }
        } else {
          if (content === undefined || content.trim() === '') {
            return internalError('im-send: text/richText require non-empty content')
          }
          if (content.length > 4000) return internalError('im-send: content over 4000 chars')
          if (msgType !== 'richText' && images.length > 0) {
            return internalError('im-send: images are only supported for msg-type richText')
          }
        }
        // @ mentions (issue #4): mirror the tool's rule — one atOpenId per
        // @姓名 fragment in the content, in order; @all only when explicit.
        const rawAt = record.atOpenIds
        const atOpenIds = Array.isArray(rawAt)
          ? rawAt.filter((item): item is string => typeof item === 'string' && item !== '')
          : []
        const atAll = record.atAll === true
        if (msgType !== 'file') {
          const atFragments = (content ?? '').match(/@[^@\s，,、]+/g) ?? []
          const atNames = atFragments.filter(frag => frag !== '@all')
          if (atOpenIds.length !== atNames.length) {
            return internalError(`im-send: atOpenIds (${atOpenIds.length}) must match the @姓名 fragments in content (${atNames.length}), in order`)
          }
          if (atAll && !(content ?? '').includes('@all')) {
            return internalError('im-send: atAll requires an @all fragment in content')
          }
        }
        const command = ['im', 'message', 'send', '--msg-type', msgType, '--group-id', groupId]
        if (content !== undefined) command.push('--content', content)
        if (fileId !== undefined) command.push('--file-id', fileId)
        if (replyMsgId !== undefined) command.push('--reply-msg-id', replyMsgId)
        for (const image of images) command.push('--image', image)
        for (const openId of atOpenIds) command.push('--at-open-id', openId)
        if (atAll) command.push('--at-all')
        return bridgeResult(ctx, 'im message send', command)
      }
      case 'file-upload': {
        const record = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {}
        const name = stringField(record, 'name')
        const base64 = stringField(record, 'base64')
        if (name === undefined || base64 === undefined) {
          return internalError('file-upload endpoint requires name and base64 payloads')
        }
        if (base64.length > 32 * 1024 * 1024) {
          return internalError('file-upload endpoint rejects payloads over 24MB (base64)')
        }
        let bytes: Buffer
        try {
          bytes = Buffer.from(base64, 'base64')
        } catch {
          return internalError('file-upload endpoint received invalid base64')
        }
        if (bytes.length === 0) return internalError('file-upload endpoint rejects empty files')
        if (bytes.length > 24 * 1024 * 1024) {
          return internalError('file-upload endpoint rejects files over 24MB')
        }
        const dir = await mkdtemp(join(tmpdir(), 'yzj-up-'))
        const target = join(dir, name.replace(/[\\/:*?"<>|]/g, '_'))
        try {
          await writeFile(target, bytes)
          const result = await ctx.yzjBridge.run(
            ['file', 'upload', '--file', target, '--name', name],
            { timeoutMs: 120_000 },
          )
          if (!result.ok) {
            const detail = result.stderr.trim() === '' ? `file upload failed (exit ${result.exitCode})` : result.stderr.trim()
            return internalError(detail)
          }
          const payloadJson = result.json ?? {}
          const fileId = stringField(payloadJson, 'fileId') ?? stringField(payloadJson, 'file_id') ?? stringField(payloadJson, 'id')
          if (fileId === undefined) return internalError('file upload returned no fileId')
          return { ok: true, value: { fileId, name, size: bytes.length } }
        } catch (error) {
          return internalError(`file upload failed: ${String(error)}`)
        } finally {
          await rm(dir, { recursive: true, force: true }).catch(() => {})
        }
      }
      case 'file-data': {
        const fileId = stringField(payload, 'fileId')
        if (fileId === undefined) return internalError('file-data endpoint requires a fileId payload')
        const entry = await fileDataFor(ctx, fileId)
        if (entry === undefined) return internalError(`file-data failed to download fileId ${fileId}`)
        return { ok: true, value: entry }
      }
      case 'todo-libraries': {
        // Switcher data: discovered libraries + provisionable team workspaces.
        const todo = ctx.get('yzjTodo')
        if (todo === undefined) return internalError('todo-libraries: yzjTodo 服务不可用（tool-yzj 未挂载）')
        try {
          const [libraries, teamWorkspaces, state] = await Promise.all([todo.listLibraries(), todo.teamWorkspaces(), todo.state()])
          return {
            ok: true,
            value: {
              libraries,
              activeDocId: state.activeDocId ?? '',
              teamWorkspaces,
            },
          }
        } catch (error) {
          return internalError(`todo-libraries failed: ${String(error)}`)
        }
      }
      case 'todo-select': {
        const todo = ctx.get('yzjTodo')
        if (todo === undefined) return internalError('todo-select: yzjTodo 服务不可用（tool-yzj 未挂载）')
        const docId = stringField(payload, 'docId')
        if (docId === undefined) return internalError('todo-select endpoint requires a docId payload')
        try {
          return { ok: true, value: await todo.select(docId) }
        } catch (error) {
          return internalError(`todo-select failed: ${String(error)}`)
        }
      }
      case 'todo-ensure-team': {
        const todo = ctx.get('yzjTodo')
        if (todo === undefined) return internalError('todo-ensure-team: yzjTodo 服务不可用（tool-yzj 未挂载）')
        const workspace = stringField(payload, 'workspace')
        if (workspace === undefined) return internalError('todo-ensure-team endpoint requires a workspace payload')
        try {
          return { ok: true, value: await todo.ensureTeam(workspace) }
        } catch (error) {
          return internalError(`todo-ensure-team failed: ${String(error)}`)
        }
      }
      case 'todo-state': {
        // Panel todo tab snapshot over the shared yzjTodo core (tool-yzj).
        const todo = ctx.get('yzjTodo')
        if (todo === undefined) return internalError('todo-state: yzjTodo 服务不可用（tool-yzj 未挂载）')
        try {
          return { ok: true, value: await todo.state() }
        } catch (error) {
          return internalError(`todo-state failed: ${String(error)}`)
        }
      }
      case 'todo-ensure': {
        const todo = ctx.get('yzjTodo')
        if (todo === undefined) return internalError('todo-ensure: yzjTodo 服务不可用（tool-yzj 未挂载）')
        try {
          return { ok: true, value: await todo.ensure() }
        } catch (error) {
          return internalError(`todo-ensure failed: ${String(error)}`)
        }
      }
      case 'todo-create': {
        const todo = ctx.get('yzjTodo')
        if (todo === undefined) return internalError('todo-create: yzjTodo 服务不可用（tool-yzj 未挂载）')
        const title = stringField(payload, 'title')
        if (title === undefined) return internalError('todo-create endpoint requires a title payload')
        const record = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {}
        const rawTags = record.tags
        const tags = Array.isArray(rawTags)
          ? rawTags.filter((item): item is string => typeof item === 'string')
          : typeof rawTags === 'string' ? [rawTags] : []
        try {
          const created = await todo.create({
            title,
            ddl: stringField(record, 'ddl'),
            priority: stringField(record, 'priority'),
            assignee: stringField(record, 'assignee'),
            tags,
          })
          return { ok: true, value: created }
        } catch (error) {
          return internalError(`todo-create failed: ${String(error)}`)
        }
      }
      case 'todo-toggle': {
        const todo = ctx.get('yzjTodo')
        if (todo === undefined) return internalError('todo-toggle: yzjTodo 服务不可用（tool-yzj 未挂载）')
        const todoId = stringField(payload, 'todoId')
        if (todoId === undefined) return internalError('todo-toggle endpoint requires a todoId payload')
        try {
          return { ok: true, value: await todo.toggle(todoId) }
        } catch (error) {
          return internalError(`todo-toggle failed: ${String(error)}`)
        }
      }
      case 'write-list': {
        const sessionId = stringField(payload, 'sessionId')
        if (sessionId === undefined) return internalError('write-list endpoint requires a sessionId payload')
        const callId = stringField(payload, 'callId')
        const list = writeGate.list(sessionId, callId).map(projectRecord)
        return { ok: true, value: { list } }
      }
      case 'write-decide': {
        const writeId = stringField(payload, 'writeId')
        const outcome = stringField(payload, 'outcome')
        if (writeId === undefined || outcome === undefined) {
          return internalError('write-decide endpoint requires writeId and outcome payloads')
        }
        if (outcome !== 'allowed-once' && outcome !== 'rejected') {
          return internalError(`write-decide endpoint rejects outcome "${outcome}"`)
        }
        const settled = writeGate.decide(writeId, outcome)
        return { ok: true, value: { settled } }
      }
      case 'robot-status': {
        const robot = ctx.get('yzjRobot')
        if (robot === undefined) return internalError('robot-status: yzjRobot 服务不可用（robot-yzj 未挂载）')
        return { ok: true, value: { channels: robot.statuses() } }
      }
      case 'robot-overrides': {
        const robot = ctx.get('yzjRobot')
        if (robot === undefined) return internalError('robot-overrides: yzjRobot 服务不可用（robot-yzj 未挂载）')
        return { ok: true, value: { overrides: robot.listOverrides() } }
      }
      case 'robot-override-set': {
        const robot = ctx.get('yzjRobot')
        if (robot === undefined) return internalError('robot-override-set: yzjRobot 服务不可用（robot-yzj 未挂载）')
        const record = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {}
        const key = stringField(record, 'key')
        if (key === undefined) return internalError('robot-override-set endpoint requires a key payload')
        const provider = stringField(record, 'provider')
        const model = stringField(record, 'model')
        if (provider === undefined && model === undefined) {
          return internalError('robot-override-set endpoint requires provider and/or model payloads')
        }
        try {
          await robot.setOverride(key, {
            ...(provider === undefined ? {} : { provider }),
            ...(model === undefined ? {} : { model }),
          })
          return { ok: true, value: { saved: true } }
        } catch (error) {
          return internalError(`robot-override-set failed: ${String(error)}`)
        }
      }
      case 'robot-override-delete': {
        const robot = ctx.get('yzjRobot')
        if (robot === undefined) return internalError('robot-override-delete: yzjRobot 服务不可用（robot-yzj 未挂载）')
        const key = stringField(payload, 'key')
        if (key === undefined) return internalError('robot-override-delete endpoint requires a key payload')
        try {
          return { ok: true, value: { deleted: await robot.deleteOverride(key) } }
        } catch (error) {
          return internalError(`robot-override-delete failed: ${String(error)}`)
        }
      }
      case 'robot-models': {
        const robot = ctx.get('yzjRobot')
        if (robot === undefined) return internalError('robot-models: yzjRobot 服务不可用（robot-yzj 未挂载）')
        try {
          return { ok: true, value: { catalog: await robot.modelCatalog() } }
        } catch (error) {
          return internalError(`robot-models failed: ${String(error)}`)
        }
      }
      case 'robot-share-list': {
        const robot = ctx.get('yzjRobot')
        if (robot === undefined) return internalError('robot-share-list: yzjRobot 服务不可用（robot-yzj 未挂载）')
        const record = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {}
        const result = robot.shareList(numberField(record, 'robotIndex') ?? 0, stringField(record, 'groupId'))
        return { ok: true, value: result }
      }
      case 'robot-share-write': {
        const robot = ctx.get('yzjRobot')
        if (robot === undefined) return internalError('robot-share-write: yzjRobot 服务不可用（robot-yzj 未挂载）')
        const record = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {}
        const groupId = stringField(record, 'groupId')
        const filename = stringField(record, 'filename')
        const content = stringField(record, 'content')
        if (groupId === undefined || filename === undefined || content === undefined) {
          return internalError('robot-share-write endpoint requires groupId, filename and content payloads')
        }
        try {
          const result = await robot.shareWrite(
            numberField(record, 'robotIndex') ?? 0,
            groupId,
            filename,
            content,
            record.overwrite === true,
          )
          return { ok: true, value: result }
        } catch (error) {
          return internalError(`robot-share-write failed: ${String(error)}`)
        }
      }
      case 'robot-diagnostics': {
        const robot = ctx.get('yzjRobot')
        if (robot === undefined) return internalError('robot-diagnostics: yzjRobot 服务不可用（robot-yzj 未挂载）')
        return { ok: true, value: { push: robot.pushDiagnostics(), confirm: robot.confirmDiagnostics(), forks: robot.forkedSessions() } }
      }
      case 'robot-notify': {
        const robot = ctx.get('yzjRobot')
        if (robot === undefined) return internalError('robot-notify: yzjRobot 服务不可用（robot-yzj 未挂载）')
        const record = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {}
        const text = stringField(record, 'text')
        if (text === undefined || text === '') return internalError('robot-notify endpoint requires a text payload')
        try {
          return { ok: true, value: { sent: await robot.notify(text, numberField(record, 'robotIndex') ?? 0) } }
        } catch (error) {
          return internalError(`robot-notify failed: ${String(error)}`)
        }
      }
      case 'robot-continue': {
        const robot = ctx.get('yzjRobot')
        if (robot === undefined) return internalError('robot-continue: yzjRobot 服务不可用（robot-yzj 未挂载）')
        const record = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {}
        const text = stringField(record, 'text')
        if (text === undefined || text === '') return internalError('robot-continue endpoint requires a text payload')
        const groupId = stringField(record, 'groupId')
        try {
          return { ok: true, value: { continued: await robot.continueConversation(text, {
            ...(numberField(record, 'robotIndex') === undefined ? {} : { robotIndex: numberField(record, 'robotIndex') }),
            ...(groupId === undefined ? {} : { groupId }),
          }) } }
        } catch (error) {
          return internalError(`robot-continue failed: ${String(error)}`)
        }
      }
      case 'robot-fork': {
        const robot = ctx.get('yzjRobot')
        if (robot === undefined) return internalError('robot-fork: yzjRobot 服务不可用（robot-yzj 未挂载）')
        const sessionId = stringField(payload, 'sessionId')
        if (sessionId === undefined || sessionId === '') return internalError('robot-fork endpoint requires a sessionId payload')
        try {
          return { ok: true, value: { forked: await robot.forkSession(sessionId) } }
        } catch (error) {
          return internalError(`robot-fork failed: ${String(error)}`)
        }
      }
      default:
        return internalError(`unknown /yzj endpoint ${endpoint}`)
    }
  }
}

/**
 * Register the `/yzj` channel over the built handler.
 * @param ctx - Cordis context carrying the connection and bridge services.
 */
export function apply(ctx: Context): void {
  const writeGate = applyWriteGate(ctx)
  const handler = createRpcHandler(ctx, writeGate)
  ctx.connection.rpc.handle('/yzj', handler, { authority: 'loopback' })
}
