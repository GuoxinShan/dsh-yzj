/**
 * Yunzhijia browser surface, node half: the `/yzj` Connection RPC channel over
 * `ctx.yzjBridge`. The browser half fetches workspaces, docs, events, chats,
 * and contacts through it; the model-facing tools remain in `@dsh-yzj/tool-yzj`.
 * Only lossless CLI-parsed JSON crosses the channel — never harness live
 * objects.
 * @module @dsh-yzj/ui-yzj
 */

import { DatabaseSync as SqliteDb } from 'node:sqlite'
import { homedir } from 'node:os'
import { join as joinPath } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection'
import type {} from '@dsh-yzj/bridge'
import type {} from '@dsh-yzj/tool-yzj'
import { applyWriteGate, type YzjWriteRecord } from './write-gate.ts'
import { openBoundHome, openTopicHome, isPlaceholderRoomTitle, topicAgentRoute, topicAgentComposition, type HomeOpenFace } from './home-open.ts'
import {
  backfillBoundLog, fusedSnapshot, groupSpaceSnapshot, handoffToGroup, homeIoFrom, parseImSend, roomSnapshot, roomSnapshotForGroup, sendImAndLog,
  sessionEventsOf, topicLensBubbles, askTopicAssistant, runDreamSession,
} from './bound-io.ts'
import { digestCandidates } from './handoff-digest.ts'
import { attachYzjSession, ensureYzjHostWorkspace } from './yzj-cwd.ts'
import { applyTopicDeliver } from './topic-deliver.ts'
import { parseContactUser } from './contact-parse.ts'
import { collectCalendarEvents } from '@dsh-yzj/tool-yzj/src/calendar-range.ts'
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

/** Cached groupId → name map from `im group recent` (60s TTL; the client polls home-nav every 2s). */
let recentNamesCache: { at: number; map: Map<string, string> } | undefined

/** docId → fileName cache for advance-ref-lookup (titles never change; miss stays uncached). */
const refDocTitleCache = new Map<string, string>()

/** Test helper: drop the recent-names cache so specs start cold. */
export function clearRecentNamesCache(): void {
  recentNamesCache = undefined
}

/**
 * Page `im group recent` (CLI caps --limit at 20) into a name map. Robot-bound
 * rooms created outside this profile never pinned a `session/title` here, so
 * the workbench list fell back to identical 「群聊」 ghost rows — this fills
 * their real names. Best-effort: bridge failures keep the stale cache.
 */
async function recentGroupNames(ctx: Context): Promise<Map<string, string>> {
  if (recentNamesCache !== undefined && Date.now() - recentNamesCache.at < 60_000) return recentNamesCache.map
  const map = new Map(recentNamesCache?.map ?? [])
  for (let page = 1; page <= 5; page += 1) {
    let result
    try {
      result = await ctx.yzjBridge.run(['im', 'group', 'recent', '--limit', '20', '--page', String(page)])
    } catch {
      break
    }
    if (!result.ok) break
    const json = result.json
    const rows = Array.isArray(json) ? json : (() => {
      const rec = typeof json === 'object' && json !== null ? json as Record<string, unknown> : {}
      const inner = typeof rec.data === 'object' && rec.data !== null ? rec.data as Record<string, unknown> : {}
      return [rec.list, rec.data, inner.list].find(Array.isArray) ?? []
    })()
    for (const row of rows) {
      const rec = typeof row === 'object' && row !== null ? row as Record<string, unknown> : {}
      const id = typeof rec.groupId === 'string' ? rec.groupId : ''
      const name = typeof rec.groupName === 'string' ? rec.groupName.trim() : ''
      if (id !== '' && name !== '') map.set(id, name)
    }
    if (rows.length < 20) break
  }
  recentNamesCache = { at: Date.now(), map }
  return map
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
/** Keep `yzj-cli auth login` alive long enough for the browser OAuth. */
const AUTH_LOGIN_TIMEOUT_MS = 600_000

/** Structural agents face for home-open / handoff (never import dsh-session). */
function agentsFace(ctx: Context): {
  get: (id: string) => {
    session?: { events?: readonly { type: string; time?: number; timestamp?: number; data?: unknown }[] }
    inject?: (message: unknown) => void
    followup?: (message: unknown) => void
  } | undefined
  resume: (opts: {
    resumeSessionId: string
    agentOptions?: { provider: string; model: string }
    setup?: (agentCtx: unknown) => void | Promise<void>
  }) => Promise<unknown>
  create: (opts: {
    sessionId: string
    meta?: { cwd: string; agentPreset?: string }
    agentOptions?: { provider: string; model: string }
    setup?: (agentCtx: unknown) => void | Promise<void>
  }) => Promise<unknown>
} | undefined {
  const agentsRaw = ctx.get('agents') as {
    get: (id: never) => unknown
    resume: (opts: {
      resumeSessionId: never
      agentOptions?: { provider: string; model: string }
      setup?: (agentCtx: unknown) => void | Promise<void>
    }) => Promise<unknown>
    create: (opts: {
      sessionId: never
      meta?: { cwd: string; agentPreset?: string }
      agentOptions?: { provider: string; model: string }
      setup?: (agentCtx: unknown) => void | Promise<void>
    }) => Promise<unknown>
  } | undefined
  if (agentsRaw === undefined) return undefined
  return {
    get: id => agentsRaw.get(id as never) as ReturnType<NonNullable<ReturnType<typeof agentsFace>>['get']>,
    resume: opts => agentsRaw.resume({
      resumeSessionId: opts.resumeSessionId as never,
      ...(opts.agentOptions === undefined ? {} : { agentOptions: opts.agentOptions }),
      ...(opts.setup === undefined ? {} : { setup: opts.setup }),
    }),
    create: opts => agentsRaw.create({
      sessionId: opts.sessionId as never,
      ...(opts.meta === undefined ? {} : { meta: opts.meta }),
      ...(opts.agentOptions === undefined ? {} : { agentOptions: opts.agentOptions }),
      ...(opts.setup === undefined ? {} : { setup: opts.setup }),
    }),
  }
}

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
 * `messages`, `whoami`, `auth-status`, `auth-login`, `search`, `doc-get`, `doc-blocks`, `sheet-get`,
 * `workspace-get`, `event-get`, `contact-get`, `write-list`, and
 * `write-decide`, `home-open` / `home-send` / `home-fused` / `home-nav` / `home-handoff` /
 * `home-topic-lens` / `home-topic-ask` / `advance-scan-state` /
 * `advance-source-add` / `advance-source-remove`
 * endpoints, all backed by the yzj-cli bridge, the write-gate, and `ctx.yzjHome`.
 * Endpoint payloads are validated as lossless JSON before use.
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
      case 'doc-search': {
        // 知识库全局搜索(yzj-cli v0.1.4):面板知识库页搜索框;可选限库。
        const keyword = stringField(payload, 'keyword')
        if (keyword === undefined) return internalError('doc-search endpoint requires a keyword payload')
        const command = ['doc', 'search', '--keyword', keyword]
        const workspace = stringField(payload, 'workspace')
        if (workspace !== undefined) command.push('--workspace', workspace)
        return bridgeResult(ctx, 'doc search', command)
      }
      case 'events': {
        const start = stringField(payload, 'start')
        const end = stringField(payload, 'end')
        if (start === undefined || end === undefined) return internalError('events endpoint requires start and end payloads')
        const collected = await collectCalendarEvents(start, end, async (from, to) => {
          let result
          try {
            result = await ctx.yzjBridge.run(['calendar', 'event', 'list', '--start', from, '--end', to])
          } catch (error) {
            return {
              ok: false,
              errorText: `calendar event list failed: ${String(error)}；请确认已安装 yzj-cli 并完成 \`yzj-cli auth login\``,
            }
          }
          if (!result.ok) {
            const detail = result.stderr.trim() === ''
              ? `calendar event list failed (exit ${result.exitCode})`
              : result.stderr.trim()
            return { ok: false, errorText: detail }
          }
          return result.json === undefined ? { ok: true } : { ok: true, json: result.json }
        })
        if (!collected.ok) return internalError(collected.errorText)
        return { ok: true, value: collected.events }
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
      case 'auth-status': {
        // Always 200: logged-out is a state, not an RPC failure. The workbench
        // banner keys off `loggedIn` rather than matching stderr strings.
        let result
        try {
          result = await ctx.yzjBridge.run(['contact', 'user', 'get'], { timeoutMs: 10_000 })
        } catch (error) {
          return {
            ok: true,
            value: { loggedIn: false, name: '', openId: '', reason: String(error) },
          }
        }
        if (!result.ok) {
          const reason = result.stderr.trim() === ''
            ? `contact user get failed (exit ${result.exitCode})`
            : result.stderr.trim()
          return { ok: true, value: { loggedIn: false, name: '', openId: '', reason } }
        }
        const user = parseContactUser(result.json)
        return { ok: true, value: { loggedIn: true, name: user.name, openId: user.openId, reason: '' } }
      }
      case 'auth-login': {
        // User-clicked: spawn `yzj-cli auth login` and return immediately so
        // the CLI can open the system browser. Tokens stay in the OS keychain.
        if (typeof ctx.yzjBridge.start !== 'function') {
          return internalError('auth-login: yzjBridge.start 不可用')
        }
        try {
          const handle = await ctx.yzjBridge.start(['auth', 'login'], { timeoutMs: AUTH_LOGIN_TIMEOUT_MS })
          return { ok: true, value: { started: true, alreadyRunning: handle.alreadyRunning } }
        } catch (error) {
          return internalError(`打开 yzj-cli 登录失败: ${String(error)}；请确认已安装 yzj-cli`)
        }
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
        const parsed = parseImSend(payload)
        if (typeof parsed === 'string') return internalError(parsed)
        const sent = await sendImAndLog(ctx, homeIoFrom(ctx.get('yzjHome')), parsed)
        if (!sent.ok) return internalError(sent.error)
        return { ok: true, value: sent.value }
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
      case 'advance-state': {
        // AI推进 board snapshot over the shared yzjAdvance core (tool-yzj).
        const advance = ctx.get('yzjAdvance')
        if (advance === undefined) return internalError('advance-state: yzjAdvance 服务不可用（tool-yzj 未挂载）')
        try {
          return { ok: true, value: await advance.state() }
        } catch (error) {
          return internalError(`advance-state failed: ${String(error)}`)
        }
      }
      case 'advance-get': {
        const advance = ctx.get('yzjAdvance')
        if (advance === undefined) return internalError('advance-get: yzjAdvance 服务不可用（tool-yzj 未挂载）')
        const advanceId = stringField(payload, 'advanceId')
        if (advanceId === undefined) return internalError('advance-get endpoint requires an advanceId payload')
        try {
          return { ok: true, value: await advance.get(advanceId, numberField(payload, 'entryOffset'), numberField(payload, 'entryLimit')) }
        } catch (error) {
          return internalError(`advance-get failed: ${String(error)}`)
        }
      }
      case 'advance-create': {
        // Start-modal direct write = the user's own will (D9): no confirm card.
        const advance = ctx.get('yzjAdvance')
        if (advance === undefined) return internalError('advance-create: yzjAdvance 服务不可用（tool-yzj 未挂载）')
        const title = stringField(payload, 'title')
        if (title === undefined) return internalError('advance-create endpoint requires a title payload')
        const record = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {}
        const rawTags = record.tags
        const tags = Array.isArray(rawTags)
          ? rawTags.filter((item): item is string => typeof item === 'string')
          : []
        try {
          return {
            ok: true,
            value: await advance.create({
              title,
              goal: stringField(payload, 'goal'),
              background: stringField(payload, 'background'),
              metrics: stringField(payload, 'metrics'),
              assignee: stringField(payload, 'assignee'),
              targetDate: stringField(payload, 'targetDate'),
              tags,
            }),
          }
        } catch (error) {
          return internalError(`advance-create failed: ${String(error)}`)
        }
      }
      case 'advance-judge': {
        // Panel judge verbs = user-direct writes landing as user 事元 (D9).
        const advance = ctx.get('yzjAdvance')
        if (advance === undefined) return internalError('advance-judge: yzjAdvance 服务不可用（tool-yzj 未挂载）')
        const advanceId = stringField(payload, 'advanceId')
        const action = stringField(payload, 'action')
        if (advanceId === undefined || action === undefined) return internalError('advance-judge endpoint requires advanceId and action payloads')
        if (!['confirm_condition', 'confirm_advance', 'accept', 'reject', 'ignore', 'cancel'].includes(action)) {
          return internalError(`advance-judge: unknown action ${action}`)
        }
        try {
          return { ok: true, value: await advance.judge(advanceId, action as Parameters<typeof advance.judge>[1], stringField(payload, 'note')) }
        } catch (error) {
          return internalError(`advance-judge failed: ${String(error)}`)
        }
      }
      case 'advance-ensure': {
        const advance = ctx.get('yzjAdvance')
        if (advance === undefined) return internalError('advance-ensure: yzjAdvance 服务不可用（tool-yzj 未挂载）')
        try {
          return { ok: true, value: await advance.ensure() }
        } catch (error) {
          return internalError(`advance-ensure failed: ${String(error)}`)
        }
      }

/** IM 缓存 L2 持久化（决策 37）：host SQLite 副本（browser localStorage 为 L1 热备）。 */
let imCacheDb: SqliteDb | undefined
function imCacheStore(): SqliteDb {
  if (imCacheDb === undefined) {
    const dbPath = process.env['YZJ_ADVANCE_DB'] ?? joinPath(homedir(), '.dsh', 'storages', 'yzj_advance.db')
    imCacheDb = new SqliteDb(dbPath)
    imCacheDb.exec('CREATE TABLE IF NOT EXISTS im_cache (cache_key TEXT PRIMARY KEY, payload TEXT NOT NULL, fetched_at INTEGER NOT NULL)')
  }
  return imCacheDb
}
      case 'im-cache-get': {
        try {
          const key = String((payload as { key?: string }).key ?? '')
          const row = imCacheStore().prepare('SELECT payload, fetched_at FROM im_cache WHERE cache_key = ?').get(key) as { payload: string; fetched_at: number } | undefined
          if (row === undefined) return { ok: true, value: null }
          return { ok: true, value: { payload: JSON.parse(row.payload), fetchedAt: row.fetched_at } }
        } catch (error) {
          return internalError(`im-cache-get failed: ${String(error)}`)
        }
      }
      case 'im-cache-put': {
        try {
          const p = payload as { key?: string; payload?: unknown; fetchedAt?: number }
          imCacheStore().prepare('INSERT INTO im_cache (cache_key, payload, fetched_at) VALUES (?, ?, ?) ON CONFLICT(cache_key) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at').run(String(p.key ?? ''), JSON.stringify(p.payload ?? null), Number(p.fetchedAt ?? Date.now()))
          return { ok: true, value: true }
        } catch (error) {
          return internalError(`im-cache-put failed: ${String(error)}`)
        }
      }
      case 'advance-patrol-now': {
        const advance = ctx.get('yzjAdvance')
        if (advance === undefined) return internalError('advance-patrol-now: yzjAdvance 服务不可用（tool-yzj 未挂载）')
        try {
          return { ok: true, value: await advance.patrolNow() }
        } catch (error) {
          return internalError(`advance-patrol-now failed: ${String(error)}`)
        }
      }
      case 'advance-scan-state': {
        const advance = ctx.get('yzjAdvance')
        if (advance === undefined) return internalError('advance-scan-state: yzjAdvance 服务不可用（tool-yzj 未挂载）')
        try {
          return { ok: true, value: advance.scanState() }
        } catch (error) {
          return internalError(`advance-scan-state failed: ${String(error)}`)
        }
      }
      case 'advance-dream-state': {
        // Dream-pool watermark for the board queue head (spec §17.3).
        const advance = ctx.get('yzjAdvance')
        if (advance === undefined) return internalError('advance-dream-state: yzjAdvance 服务不可用（tool-yzj 未挂载）')
        try {
          return { ok: true, value: advance.dreamState() }
        } catch (error) {
          return internalError(`advance-dream-state failed: ${String(error)}`)
        }
      }
      case 'advance-dream-run': {
        // Dream 手动径（决策 38）: host 直建 yzj-dream-* 会话注入抽取指令,
        // 不再经 client askDraft / 话题问助手栏。返回 sessionId 供 GUI 聚焦。
        const advance = ctx.get('yzjAdvance')
        if (advance === undefined) return internalError('advance-dream-run: yzjAdvance 服务不可用（tool-yzj 未挂载）')
        const agents = agentsFace(ctx)
        if (agents === undefined) return internalError('advance-dream-run: agents 服务不可用')
        try {
          const state = advance.dreamState()
          const cwd = await ensureYzjHostWorkspace(ctx)
          const route = topicAgentRoute(ctx)
          const composition = await topicAgentComposition(ctx)
          const value = await runDreamSession({
            agents,
            cwd,
            pending: state.pending,
            ...(route === undefined ? {} : { agentOptions: route }),
            ...composition,
          })
          await attachYzjSession(ctx, value.sessionId)
          return { ok: true, value }
        } catch (error) {
          return internalError(`advance-dream-run failed: ${String(error)}`)
        }
      }
      case 'advance-ref-lookup': {
        // 决策 39 后续: 原始信息叶子可读化 — msg refs 从 bound log（捞过的
        // 消息本体）解析成 谁/何时/说了什么；doc refs 经 `doc get` 拿文件名
        // （进程内缓存）。而板渲染三层树的事件层。
        // 08-21 视觉走查扩展: dp-* 池 id → 蓄水池条目(永不删)还原原始 msg/doc;
        // 裸 msgId(legacy refs) → 扫全部绑定会话的 bound log;命中带 jumpToken
        // (im:<g>:<m>) 让点击直达那条消息。
        const io = homeIoFrom(ctx.get('yzjHome'))
        const refsRaw = typeof payload === 'object' && payload !== null
          ? (payload as Record<string, unknown>).refs
          : undefined
        const refs = Array.isArray(refsRaw)
          ? refsRaw.map(row => {
            const record = typeof row === 'object' && row !== null ? row as Record<string, unknown> : {}
            return { token: String(record.token ?? ''), kind: String(record.kind ?? 'msg') }
          }).filter(row => row.token !== '')
          : []
        if (refs.length === 0) return { ok: true, value: { hits: [] } }
        const hits: { token: string; kind: string; fromName: string; content: string; sentAt: number; jumpToken?: string; docId?: string }[] = []
        /** doc get → fileName(进程内缓存);miss 不缓存。 */
        const docTitleOf = async (docId: string): Promise<string> => {
          const cached = refDocTitleCache.get(docId)
          if (cached !== undefined) return cached
          let ran
          try {
            ran = await ctx.yzjBridge.run(['doc', 'get', '--id', docId])
          } catch {
            ran = undefined
          }
          const fileName = ran !== undefined && ran.ok && typeof ran.json === 'object' && ran.json !== null
            ? String((ran.json as Record<string, unknown>).fileName ?? '')
            : ''
          if (fileName !== '') refDocTitleCache.set(docId, fileName)
          return fileName
        }
        // dp-* 池 id 一次性批量解析(含 done;agent 曾把池 id 抄进 refs — 视觉走查 08-21)。
        const advance = ctx.get('yzjAdvance')
        const poolIds = refs.map(ref => ref.token).filter(token => token.startsWith('dp-'))
        const poolRows = poolIds.length > 0 && advance !== undefined && typeof advance.dreamPoolLookup === 'function'
          ? advance.dreamPoolLookup(poolIds)
          : []
        const poolById = new Map(poolRows.map(row => [row.id, row]))
        /** 池条目 sendTime(`yyyy-MM-DD HH:mm:ss.SSS`) → epoch ms;非法为 0。 */
        const poolSentAtOf = (sendTime: string): number => {
          const parsed = Date.parse(sendTime.replace(' ', 'T'))
          return Number.isNaN(parsed) ? 0 : parsed
        }
        for (const ref of refs) {
          if (ref.kind === 'doc') {
            const title = await docTitleOf(ref.token)
            if (title !== '') hits.push({ token: ref.token, kind: 'doc', fromName: '', content: title, sentAt: 0, docId: ref.token })
            continue
          }
          if (ref.token.startsWith('dp-')) {
            const pooled = poolById.get(ref.token)
            if (pooled === undefined) continue
            if (pooled.channel.startsWith('im:')) {
              const groupId = pooled.channel.slice(3)
              const logEntry = io?.getLog(groupId)?.entries.find(row => row.msgId === pooled.refId)
              hits.push({
                token: ref.token,
                kind: 'msg',
                fromName: logEntry?.fromName ?? '',
                content: (logEntry?.content ?? pooled.content).slice(0, 80),
                sentAt: logEntry?.sentAt ?? poolSentAtOf(pooled.sendTime),
                jumpToken: `${pooled.channel}:${pooled.refId}`,
              })
              continue
            }
            if (pooled.channel.startsWith('dir:')) {
              const title = await docTitleOf(pooled.refId)
              if (title !== '') hits.push({ token: ref.token, kind: 'doc', fromName: '', content: title, sentAt: 0, docId: pooled.refId })
              continue
            }
            hits.push({ token: ref.token, kind: 'msg', fromName: '', content: pooled.content.slice(0, 80), sentAt: poolSentAtOf(pooled.sendTime) })
            continue
          }
          if (io === undefined) continue
          const match = /^im:([^:\s]+):(.+)$/.exec(ref.token)
          if (match !== null) {
            const entry = io.getLog(match[1]!)?.entries.find(row => row.msgId === match[2])
            if (entry === undefined) continue
            hits.push({ token: ref.token, kind: 'msg', fromName: entry.fromName, content: entry.content.slice(0, 80), sentAt: entry.sentAt, jumpToken: ref.token })
            continue
          }
          // 裸 msgId(legacy refs):扫全部绑定会话的 bound log,命中补 jumpToken。
          if (ref.kind !== 'msg') continue
          for (const binding of io.listBindings?.() ?? []) {
            const entry = io.getLog(binding.yzjConversationId)?.entries.find(row => row.msgId === ref.token)
            if (entry === undefined) continue
            hits.push({ token: ref.token, kind: 'msg', fromName: entry.fromName, content: entry.content.slice(0, 80), sentAt: entry.sentAt, jumpToken: `im:${binding.yzjConversationId}:${ref.token}` })
            break
          }
        }
        return { ok: true, value: { hits } }
      }
      case 'advance-source-add': {
        // 面板「关联来源」 = user-direct write (D9, spec §15.2): registry row
        // + one 备注 事元 for single-document sources; no confirmation card.
        const advance = ctx.get('yzjAdvance')
        if (advance === undefined) return internalError('advance-source-add: yzjAdvance 服务不可用（tool-yzj 未挂载）')
        const advanceId = stringField(payload, 'advanceId')
        const token = stringField(payload, 'token')
        if (advanceId === undefined || token === undefined) {
          return internalError('advance-source-add endpoint requires advanceId and token payloads')
        }
        try {
          return { ok: true, value: await advance.sourceAdd(advanceId, token, stringField(payload, 'label')) }
        } catch (error) {
          return internalError(`advance-source-add failed: ${String(error)}`)
        }
      }
      case 'advance-source-remove': {
        // 解除关联：只删注册表行，已产事元不动（时间线无损不变量）。
        const advance = ctx.get('yzjAdvance')
        if (advance === undefined) return internalError('advance-source-remove: yzjAdvance 服务不可用（tool-yzj 未挂载）')
        const advanceId = stringField(payload, 'advanceId')
        const token = stringField(payload, 'token')
        if (advanceId === undefined || token === undefined) {
          return internalError('advance-source-remove endpoint requires advanceId and token payloads')
        }
        try {
          return { ok: true, value: { sources: await advance.sourceRemove(advanceId, token) } }
        } catch (error) {
          return internalError(`advance-source-remove failed: ${String(error)}`)
        }
      }
      case 'advance-feed': {
        // User-direct chip/sentence feed (D9): no confirm card. Stage stays
        // on agent yzj_advance_feed or panel judge (spec §11 / 决策 10).
        const advance = ctx.get('yzjAdvance')
        if (advance === undefined) return internalError('advance-feed: yzjAdvance 服务不可用（tool-yzj 未挂载）')
        if (stringField(payload, 'stageTo') !== undefined
          || stringField(payload, 'goal') !== undefined
          || stringField(payload, 'metrics') !== undefined
          || stringField(payload, 'targetDate') !== undefined
          || stringField(payload, 'assignee') !== undefined) {
          return internalError('advance-feed: 用户直写不能改阶段或目标字段，请走确认卡或看板判断')
        }
        const advanceId = stringField(payload, 'advanceId')
        const summary = stringField(payload, 'summary')
        if (advanceId === undefined || summary === undefined) {
          return internalError('advance-feed endpoint requires advanceId and summary payloads')
        }
        const record = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {}
        const rawRefs = record.refs
        const refs = Array.isArray(rawRefs)
          ? rawRefs.filter((item): item is string => typeof item === 'string' && item !== '')
          : []
        const sourceType = stringField(payload, 'sourceType')
        try {
          return {
            ok: true,
            value: await advance.feed({
              advanceId,
              summary,
              sourceType: sourceType ?? (refs.length > 0 ? '对话' : '人工'),
              changeType: '进度更新',
              ...(refs.length === 0 ? {} : { refs }),
              actor: 'user',
            }),
          }
        } catch (error) {
          return internalError(`advance-feed failed: ${String(error)}`)
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
      case 'robot-share-read': {
        const robot = ctx.get('yzjRobot')
        if (robot === undefined) return internalError('robot-share-read: yzjRobot 服务不可用（robot-yzj 未挂载）')
        const record = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {}
        const groupId = stringField(record, 'groupId')
        const filename = stringField(record, 'filename')
        if (groupId === undefined || filename === undefined) {
          return internalError('robot-share-read endpoint requires groupId and filename payloads')
        }
        const result = robot.shareRead(numberField(record, 'robotIndex') ?? 0, groupId, filename)
        return { ok: true, value: result }
      }
      case 'robot-open-folder': {
        const robot = ctx.get('yzjRobot')
        if (robot === undefined) return internalError('robot-open-folder: yzjRobot 服务不可用（robot-yzj 未挂载）')
        const record = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {}
        const result = robot.openFolder(numberField(record, 'robotIndex') ?? 0, stringField(record, 'groupId'))
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
      case 'robot-channels-save': {
        const robot = ctx.get('yzjRobot')
        if (robot === undefined) return internalError('robot-channels-save: yzjRobot 服务不可用（robot-yzj 未挂载）')
        const record = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {}
        const robotsRaw = Array.isArray(record.robots) ? record.robots : []
        const robots = robotsRaw.flatMap(item => {
          const entry = typeof item === 'object' && item !== null ? item as Record<string, unknown> : {}
          const sendMsgUrl = stringField(entry, 'sendMsgUrl')
          if (sendMsgUrl === undefined || sendMsgUrl === '') return []
          return [{
            sendMsgUrl,
            ...(typeof entry.enabled === 'boolean' ? { enabled: entry.enabled } : {}),
            ...(Array.isArray(entry.allowFrom) ? { allowFrom: entry.allowFrom.filter((value): value is string => typeof value === 'string') } : {}),
            ...(stringField(entry, 'provider') === undefined ? {} : { provider: stringField(entry, 'provider') }),
            ...(stringField(entry, 'model') === undefined ? {} : { model: stringField(entry, 'model') }),
            ...(stringField(entry, 'cwd') === undefined ? {} : { cwd: stringField(entry, 'cwd') }),
          }]
        })
        try {
          const result = await robot.saveChannels({
            ...(stringField(record, 'defaultProvider') === undefined ? {} : { defaultProvider: stringField(record, 'defaultProvider') }),
            ...(stringField(record, 'defaultModel') === undefined ? {} : { defaultModel: stringField(record, 'defaultModel') }),
            robots,
          })
          return { ok: true, value: result }
        } catch (error) {
          return internalError(`robot-channels-save failed: ${String(error)}`)
        }
      }
      case 'robot-diagnostics': {
        const robot = ctx.get('yzjRobot')
        if (robot === undefined) return internalError('robot-diagnostics: yzjRobot 服务不可用（robot-yzj 未挂载）')
        return { ok: true, value: { push: robot.pushDiagnostics(), confirm: robot.confirmDiagnostics() } }
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
      case 'memory-scope': {
        const memory = ctx.get('yzjMemory')
        if (memory === undefined) return internalError('memory-scope: yzjMemory 服务不可用（memory-yzj 未挂载）')
        const record = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {}
        const scope = stringField(record, 'scope') ?? 'user'
        try {
          return { ok: true, value: { view: memory.readScope(scope) } }
        } catch (error) {
          return internalError(`memory-scope failed: ${String(error)}`)
        }
      }
      case 'memory-log': {
        const memory = ctx.get('yzjMemory')
        if (memory === undefined) return internalError('memory-log: yzjMemory 服务不可用（memory-yzj 未挂载）')
        const record = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {}
        const scope = stringField(record, 'scope') ?? 'user'
        try {
          return { ok: true, value: { log: memory.dreamLogTail(scope, 4000) } }
        } catch (error) {
          return internalError(`memory-log failed: ${String(error)}`)
        }
      }
      case 'memory-observe': {
        // Panel-direct write = the user's own will (im-send/todo-create
        // semantics): no confirmation card; source marks the provenance.
        const memory = ctx.get('yzjMemory')
        if (memory === undefined) return internalError('memory-observe: yzjMemory 服务不可用（memory-yzj 未挂载）')
        const record = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {}
        const content = stringField(record, 'content')
        if (content === undefined || content.trim() === '') return internalError('memory-observe endpoint requires a non-empty content payload')
        const scope = stringField(record, 'scope') ?? 'user'
        const tags = Array.isArray(record.tags) ? record.tags.filter((value): value is string => typeof value === 'string') : []
        try {
          return { ok: true, value: memory.observe(scope, content, {
            tags,
            source: 'panel',
            ...(typeof record.durable === 'boolean' ? { durable: record.durable } : {}),
          }) }
        } catch (error) {
          return internalError(`memory-observe failed: ${String(error)}`)
        }
      }
      case 'dream-state': {
        const memory = ctx.get('yzjMemory')
        if (memory === undefined) return internalError('dream-state: yzjMemory 服务不可用（memory-yzj 未挂载）')
        return { ok: true, value: { state: memory.dreamSettings() } }
      }
      case 'dream-set': {
        const memory = ctx.get('yzjMemory')
        if (memory === undefined) return internalError('dream-set: yzjMemory 服务不可用（memory-yzj 未挂载）')
        const record = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {}
        if (record.enabled !== undefined && typeof record.enabled !== 'boolean') return internalError('dream-set: enabled must be a boolean')
        const str = (key: string): string | undefined => {
          const value = record[key]
          return typeof value === 'string' ? value : undefined
        }
        try {
          const state = memory.setDreamSettings({
            ...(record.enabled === undefined ? {} : { enabled: record.enabled === true }),
            ...(str('provider') === undefined ? {} : { provider: str('provider') }),
            ...(str('model') === undefined ? {} : { model: str('model') }),
            ...(str('dailyAt') === undefined ? {} : { dailyAt: str('dailyAt') }),
          })
          return { ok: true, value: { state } }
        } catch (error) {
          return internalError(`dream-set failed: ${String(error)}`)
        }
      }
      case 'dream-run': {
        const memory = ctx.get('yzjMemory')
        if (memory === undefined) return internalError('dream-run: yzjMemory 服务不可用（memory-yzj 未挂载）')
        try {
          return { ok: true, value: await memory.dreamRun('panel') }
        } catch (error) {
          return internalError(`dream-run failed: ${String(error)}`)
        }
      }
      case 'model-default': {
        const models = ctx.get('yzjModels')
        if (models === undefined) return internalError('model-default: yzjModels 服务不可用（model-yzj 未挂载）')
        return { ok: true, value: { route: models.get(), path: models.path } }
      }
      case 'model-default-set': {
        const models = ctx.get('yzjModels')
        if (models === undefined) return internalError('model-default-set: yzjModels 服务不可用（model-yzj 未挂载）')
        const record = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {}
        const provider = stringField(record, 'provider')
        const model = stringField(record, 'model')
        if (provider === undefined || model === undefined) return internalError('model-default-set endpoint requires provider and model payloads')
        try {
          return { ok: true, value: { route: await models.setDefault(provider, model) } }
        } catch (error) {
          return internalError(`model-default-set failed: ${String(error)}`)
        }
      }
      case 'model-default-clear': {
        const models = ctx.get('yzjModels')
        if (models === undefined) return internalError('model-default-clear: yzjModels 服务不可用（model-yzj 未挂载）')
        await models.clear()
        return { ok: true, value: { route: undefined } }
      }
      case 'model-catalog': {
        const models = ctx.get('yzjModels')
        if (models === undefined) return internalError('model-catalog: yzjModels 服务不可用（model-yzj 未挂载）')
        return { ok: true, value: { catalog: await models.catalog() } }
      }
      case 'home-open': {
        const home = ctx.get('yzjHome') as HomeOpenFace | undefined
        if (home === undefined) return internalError('home-open: yzjHome 服务不可用（tool-yzj 未挂载）')
        const groupId = stringField(payload, 'groupId') ?? stringField(payload, 'yzjConversationId')
        if (groupId === undefined) return internalError('home-open endpoint requires a groupId payload')
        const agents = agentsFace(ctx)
        if (agents === undefined) return internalError('home-open: agents 服务不可用')
        try {
          // Title fallback: resolve the real group name so a re-materialized
          // room never pins the 群房间 placeholder (pitfall-021 cleanup path).
          const title = stringField(payload, 'title') ?? (await recentGroupNames(ctx)).get(groupId)
          const cwd = await ensureYzjHostWorkspace(ctx)
          const route = topicAgentRoute(ctx)
          const composition = await topicAgentComposition(ctx)
          const value = await openBoundHome({
            home,
            agents,
            yzjConversationId: groupId,
            cwd,
            ...(title === undefined ? {} : { title }),
            ...(route === undefined ? {} : { agentOptions: route }),
            ...composition,
          })
          await attachYzjSession(ctx, value.sessionId)
          if (value.legacyTopicSessionId !== undefined) await attachYzjSession(ctx, value.legacyTopicSessionId)
          const io = homeIoFrom(home)
          if (io !== undefined) {
            void backfillBoundLog(ctx, io, groupId).catch(() => undefined)
          }
          return { ok: true, value }
        } catch (error) {
          return internalError(`home-open failed: ${String(error)}`)
        }
      }
      case 'home-binding': {
        const io = homeIoFrom(ctx.get('yzjHome'))
        if (io === undefined) return internalError('home-binding: yzjHome 服务不可用（tool-yzj 未挂载）')
        const sessionId = stringField(payload, 'sessionId')
        const groupId = stringField(payload, 'groupId')
        const binding = sessionId !== undefined ? io.getBySession(sessionId)
          : groupId !== undefined ? io.getByConversation(groupId) : undefined
        const topic = sessionId === undefined ? undefined : io.getTopicBySession?.(sessionId)
        const room = topic === undefined ? binding : io.getByConversation(topic.yzjConversationId)
        const kind = topic !== undefined ? 'topic' : room !== undefined ? 'room' : 'unbound'
        return {
          ok: true,
          value: {
            bound: room !== undefined,
            kind,
            ...(room === undefined ? {} : { binding: room }),
            ...(topic === undefined ? {} : { topic }),
          },
        }
      }
      case 'home-log': {
        const io = homeIoFrom(ctx.get('yzjHome'))
        if (io === undefined) return internalError('home-log: yzjHome 服务不可用（tool-yzj 未挂载）')
        const sessionId = stringField(payload, 'sessionId')
        const groupId = stringField(payload, 'groupId')
        const log = sessionId !== undefined ? io.getLogBySession(sessionId)
          : groupId !== undefined ? io.getLog(groupId) : undefined
        return { ok: true, value: { log: log ?? null } }
      }
      case 'home-fused': {
        const io = homeIoFrom(ctx.get('yzjHome'))
        if (io === undefined) return internalError('home-fused: yzjHome 服务不可用（tool-yzj 未挂载）')
        const groupId = stringField(payload, 'groupId')
        if (groupId !== undefined) {
          return { ok: true, value: { ...roomSnapshotForGroup(io, groupId), candidates: [] } }
        }
        const sessionId = stringField(payload, 'sessionId')
        if (sessionId === undefined) return internalError('home-fused endpoint requires a groupId or sessionId payload')
        const agents = agentsFace(ctx)
        const writes = writeGate.list(sessionId)
        return { ok: true, value: { ...fusedSnapshot(io, sessionId, agents?.get(sessionId), writes), ...roomSnapshot(io, sessionId) } }
      }
      case 'home-nav': {
        const io = homeIoFrom(ctx.get('yzjHome'))
        if (io === undefined) return internalError('home-nav: yzjHome 服务不可用（tool-yzj 未挂载）')
        const snap = groupSpaceSnapshot(io, agentsFace(ctx))
        const names = await recentGroupNames(ctx)
        const rooms = snap.rooms.map((room) => {
          const resolved = names.get(room.groupId)
          return resolved !== undefined && isPlaceholderRoomTitle(room.groupName)
            ? { ...room, groupName: resolved }
            : room
        })
        return { ok: true, value: { rooms } }
      }
      case 'home-topic-open': {
        const home = ctx.get('yzjHome') as HomeOpenFace | undefined
        if (home === undefined) return internalError('home-topic-open: yzjHome 服务不可用（tool-yzj 未挂载）')
        const groupId = stringField(payload, 'groupId') ?? stringField(payload, 'yzjConversationId')
        if (groupId === undefined) return internalError('home-topic-open endpoint requires a groupId payload')
        const agents = agentsFace(ctx)
        if (agents === undefined) return internalError('home-topic-open: agents 服务不可用')
        try {
          const rootMsgId = stringField(payload, 'rootMsgId')
          const originWho = stringField(payload, 'originWho')
          const originText = stringField(payload, 'originText')
          const title = stringField(payload, 'title')
          const groupName = stringField(payload, 'groupName')
          const cwd = await ensureYzjHostWorkspace(ctx)
          const route = topicAgentRoute(ctx)
          const composition = await topicAgentComposition(ctx)
          const value = await openTopicHome({
            home,
            agents,
            yzjConversationId: groupId,
            cwd,
            source: 'dsh',
            ...(rootMsgId === undefined ? {} : { rootMsgId }),
            ...(originWho === undefined ? {} : { originWho }),
            ...(originText === undefined ? {} : { originText }),
            ...(title === undefined ? {} : { title }),
            ...(groupName === undefined ? {} : { groupName }),
            ...(route === undefined ? {} : { agentOptions: route }),
            ...composition,
          })
          await attachYzjSession(ctx, value.sessionId)
          const io = homeIoFrom(home)
          if (io !== undefined) void backfillBoundLog(ctx, io, groupId).catch(() => undefined)
          return { ok: true, value }
        } catch (error) {
          return internalError(`home-topic-open failed: ${String(error)}`)
        }
      }
      case 'home-topic-lens': {
        const io = homeIoFrom(ctx.get('yzjHome'))
        if (io === undefined) return internalError('home-topic-lens: yzjHome 服务不可用（tool-yzj 未挂载）')
        const sessionId = stringField(payload, 'sessionId')
        if (sessionId === undefined) return internalError('home-topic-lens endpoint requires a sessionId payload')
        const topic = io.getTopicBySession?.(sessionId)
        if (topic === undefined) return internalError('home-topic-lens: not a topic session')
        const bubbles = topicLensBubbles(topic, agentsFace(ctx) ?? { get: () => undefined })
        return { ok: true, value: { bubbles, topicSessionId: sessionId } }
      }
      case 'home-topic-ask': {
        const io = homeIoFrom(ctx.get('yzjHome'))
        if (io === undefined) return internalError('home-topic-ask: yzjHome 服务不可用（tool-yzj 未挂载）')
        const sessionId = stringField(payload, 'sessionId')
        const text = stringField(payload, 'text')
        if (sessionId === undefined) return internalError('home-topic-ask endpoint requires a sessionId payload')
        if (text === undefined) return internalError('home-topic-ask endpoint requires a text payload')
        const agents = agentsFace(ctx)
        if (agents === undefined) return internalError('home-topic-ask: agents 服务不可用')
        const cwd = await ensureYzjHostWorkspace(ctx)
        const route = topicAgentRoute(ctx)
        const composition = await topicAgentComposition(ctx)
        const result = await askTopicAssistant({
          home: io,
          agents,
          cwd,
          topicSessionId: sessionId,
          text,
          ...(route === undefined ? {} : { agentOptions: route }),
          ...composition,
        })
        if ('error' in result) return internalError(result.error)
        await attachYzjSession(ctx, sessionId)
        return { ok: true, value: result }
      }
      case 'home-backfill': {
        const io = homeIoFrom(ctx.get('yzjHome'))
        if (io === undefined) return internalError('home-backfill: yzjHome 服务不可用（tool-yzj 未挂载）')
        const sessionId = stringField(payload, 'sessionId')
        const groupId = stringField(payload, 'groupId')
          ?? (sessionId === undefined ? undefined : io.getBySession(sessionId)?.yzjConversationId)
        if (groupId === undefined) return internalError('home-backfill endpoint requires a groupId or bound sessionId')
        try {
          const beforeMsgId = stringField(payload, 'beforeMsgId')
          const limit = numberField(payload, 'limit')
          const stats = await backfillBoundLog(
            ctx,
            io,
            groupId,
            limit,
            beforeMsgId,
          )
          return { ok: true, value: stats }
        } catch (error) {
          return internalError(`home-backfill failed: ${String(error)}`)
        }
      }
      case 'home-send': {
        const io = homeIoFrom(ctx.get('yzjHome'))
        if (io === undefined) return internalError('home-send: yzjHome 服务不可用（tool-yzj 未挂载）')
        const sessionId = stringField(payload, 'sessionId')
        const bound = sessionId === undefined ? undefined : io.getBySession(sessionId)
        const groupId = stringField(payload, 'groupId') ?? bound?.yzjConversationId
        if (groupId === undefined) return internalError('home-send endpoint requires a bound sessionId or groupId')
        const record = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {}
        const parsed = parseImSend({ ...record, groupId })
        if (typeof parsed === 'string') return internalError(parsed)
        const sent = await sendImAndLog(ctx, io, parsed)
        if (!sent.ok) return internalError(sent.error)
        return { ok: true, value: sent }
      }
      case 'home-digest': {
        const sessionId = stringField(payload, 'sessionId')
        if (sessionId === undefined) return internalError('home-digest endpoint requires a sessionId payload')
        const agents = agentsFace(ctx)
        const candidates = digestCandidates(sessionEventsOf(agents?.get(sessionId)))
        return { ok: true, value: { candidates } }
      }
      case 'home-handoff': {
        const io = homeIoFrom(ctx.get('yzjHome'))
        if (io === undefined) return internalError('home-handoff: yzjHome 服务不可用（tool-yzj 未挂载）')
        const groupId = stringField(payload, 'groupId')
        const digest = stringField(payload, 'digest')
        if (groupId === undefined) return internalError('home-handoff endpoint requires a groupId payload')
        if (digest === undefined) return internalError('home-handoff endpoint requires a digest payload')
        const agents = agentsFace(ctx)
        if (agents === undefined) return internalError('home-handoff: agents 服务不可用')
        const cwd = await ensureYzjHostWorkspace(ctx)
        const result = await handoffToGroup({ ctx, home: io, agents, groupId, digest, cwd })
        if ('error' in result) return internalError(result.error)
        if ('sessionId' in result) await attachYzjSession(ctx, result.sessionId)
        const topicId = 'topicSessionId' in result ? result.topicSessionId : undefined
        if (typeof topicId === 'string' && topicId !== '') await attachYzjSession(ctx, topicId)
        void backfillBoundLog(ctx, io, groupId).catch(() => undefined)
        return { ok: true, value: result }
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
  void ensureYzjHostWorkspace(ctx).catch(() => undefined)
  applyTopicDeliver(ctx, writeGate)
}
