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
// 深路径 type-only import：tool-yzj 源码入口带出全部 cordis augmentation（yzjBridge/yzjHome
// 的 Context 声明散在各域文件）——包入口 d.ts 不 re-export 它们，浅 import 拿不到。
import type {} from '@dsh-yzj/tool-yzj/src/index.ts'
import { applyWriteGate, type YzjWriteRecord } from './write-gate.ts'
import { openBoundHome, isPlaceholderRoomTitle, type HomeOpenFace } from './home-open.ts'
import {
  backfillBoundLog, fusedSnapshot, groupSpaceSnapshot, homeIoFrom, parseImSend, roomSnapshot, roomSnapshotForGroup, sendImAndLog,
} from './bound-io.ts'
import { attachYzjSession, ensureYzjHostWorkspace } from './yzj-cwd.ts'
import { parseContactUser } from './contact-parse.ts'
import { unwrapCli, cliRows } from './cli-payload.ts'
import { collectCalendarEvents } from '@dsh-yzj/tool-yzj/src/calendar-range.ts'
import { DEFAULT_ASSISTANT_ID, type YzjAssistantsService } from '@dsh-yzj/tool-yzj/src/assistants.ts'
import { processDigest, runAssistantTurn } from './assistant-runtime.ts'
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
  return { ok: true, value: unwrapCli(result.json) ?? {} }
}

/** Validate a string field of an RPC payload. */
function stringField(payload: unknown, key: string): string | undefined {
  const value = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>)[key] : undefined
  return typeof value === 'string' && value !== '' ? value : undefined
}

/** Cached groupId → name map from `im group recent` (60s TTL; the client polls home-nav every 2s). */
let recentNamesCache: { at: number; map: Map<string, string> } | undefined

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
    const rows = cliRows(result.json)
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

/**
 * Build the `/yzj` RPC handler: `workspaces`, `docs`, `events`, `groups`,
 * `messages`, `whoami`, `auth-status`, `auth-login`, `search`, `doc-get`, `doc-blocks`, `sheet-get`,
 * `workspace-get`, `event-get`, `contact-get`, `write-list`, and
 * `write-decide`, `home-open` / `home-send` / `home-fused` / `home-nav`
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
        // 知识库全局搜索:面板知识库页搜索框;可选限库。
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
        return { ok: true, value: unwrapCli(result.json) ?? {} }
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
          const payloadJson = unwrapCli(result.json) ?? {}
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
        try {
          const value = await openBoundHome({ home, yzjConversationId: groupId })
          await attachYzjSession(ctx, value.sessionId)
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
      case 'assistants-list': {
        const assistants = ctx.get('yzjAssistants') as YzjAssistantsService | undefined
        if (assistants === undefined) return internalError('assistants-list: yzjAssistants 服务不可用（tool-yzj 未挂载）')
        await assistants.store.ensureDefault()
        return { ok: true, value: { assistants: assistants.store.list() } }
      }
      case 'assistants-create': {
        const assistants = ctx.get('yzjAssistants') as YzjAssistantsService | undefined
        if (assistants === undefined) return internalError('assistants-create: yzjAssistants 服务不可用（tool-yzj 未挂载）')
        const name = stringField(payload, 'name') ?? '助手'
        const prompt = stringField(payload, 'prompt')
        const record = prompt === undefined
          ? await assistants.store.create(name)
          : await assistants.store.create(name, prompt)
        return { ok: true, value: { assistant: record } }
      }
      case 'assistant-ask': {
        const assistants = ctx.get('yzjAssistants') as YzjAssistantsService | undefined
        if (assistants === undefined) return internalError('assistant-ask: yzjAssistants 服务不可用（tool-yzj 未挂载）')
        const assistantId = stringField(payload, 'assistantId') ?? DEFAULT_ASSISTANT_ID
        const text = stringField(payload, 'text')
        if (text === undefined) return internalError('assistant-ask endpoint requires a text payload')
        await assistants.store.ensureDefault()
        if (assistants.store.get(assistantId) === undefined) {
          return internalError(`assistant-ask: unknown assistant ${assistantId}`)
        }
        const result = await runAssistantTurn(ctx, assistants, {
          target: { kind: 'dm', assistantId },
          text,
        })
        return { ok: true, value: result }
      }
      case 'assistant-thread-ask': {
        const assistants = ctx.get('yzjAssistants') as YzjAssistantsService | undefined
        if (assistants === undefined) return internalError('assistant-thread-ask: yzjAssistants 服务不可用（tool-yzj 未挂载）')
        const assistantId = stringField(payload, 'assistantId') ?? DEFAULT_ASSISTANT_ID
        const groupId = stringField(payload, 'groupId')
        const msgId = stringField(payload, 'msgId')
        const text = stringField(payload, 'text')
        if (groupId === undefined || msgId === undefined || text === undefined) {
          return internalError('assistant-thread-ask endpoint requires groupId, msgId, and text')
        }
        await assistants.store.ensureDefault()
        if (assistants.store.get(assistantId) === undefined) {
          return internalError(`assistant-thread-ask: unknown assistant ${assistantId}`)
        }
        const io = homeIoFrom(ctx.get('yzjHome'))
        const window = io?.formatSummonWindow?.(groupId, msgId)
        const groupName = stringField(payload, 'groupName')
        const originWho = stringField(payload, 'originWho')
        const originText = stringField(payload, 'originText')
        const result = await runAssistantTurn(ctx, assistants, {
          target: { kind: 'thread', assistantId, groupId, msgId },
          text,
          ...(groupName === undefined ? {} : { groupName }),
          ...(originWho === undefined ? {} : { originWho }),
          ...(originText === undefined ? {} : { originText }),
          ...(window === undefined || window === '' ? {} : { window }),
        })
        return { ok: true, value: result }
      }
      case 'assistant-projection': {
        const assistants = ctx.get('yzjAssistants') as YzjAssistantsService | undefined
        if (assistants === undefined) return internalError('assistant-projection: yzjAssistants 服务不可用（tool-yzj 未挂载）')
        await assistants.store.ensureDefault()
        const groupId = stringField(payload, 'groupId')
        const msgId = stringField(payload, 'msgId')
        if (groupId !== undefined && msgId !== undefined) {
          const thread = assistants.store.threadOf(groupId, msgId)
          return { ok: true, value: { thread } }
        }
        const assistantId = stringField(payload, 'assistantId') ?? DEFAULT_ASSISTANT_ID
        const dm = assistants.store.dmProjection(assistantId)
        if (dm === undefined) return internalError(`assistant-projection: unknown assistant ${assistantId}`)
        const writes = writeGate.list(dm.assistant.sessionId).map(projectRecord)
        const threads = typeof payload === 'object' && payload !== null && stringField(payload, 'threadsGroupId') !== undefined
          ? assistants.store.threadsForGroup(stringField(payload, 'threadsGroupId') ?? '')
          : []
        return {
          ok: true,
          value: {
            assistant: dm.assistant,
            processing: dm.processing,
            bubbles: dm.bubbles,
            writes,
            ...(threads.length === 0 ? {} : { threads }),
          },
        }
      }
      case 'assistant-threads': {
        const assistants = ctx.get('yzjAssistants') as YzjAssistantsService | undefined
        if (assistants === undefined) return internalError('assistant-threads: yzjAssistants 服务不可用（tool-yzj 未挂载）')
        const groupId = stringField(payload, 'groupId')
        if (groupId === undefined) return internalError('assistant-threads endpoint requires a groupId payload')
        return { ok: true, value: { threads: assistants.store.threadsForGroup(groupId) } }
      }
      case 'assistant-process': {
        const assistants = ctx.get('yzjAssistants') as YzjAssistantsService | undefined
        if (assistants === undefined) return internalError('assistant-process: yzjAssistants 服务不可用（tool-yzj 未挂载）')
        const assistantId = stringField(payload, 'assistantId') ?? DEFAULT_ASSISTANT_ID
        const row = assistants.store.get(assistantId) ?? await assistants.store.ensureDefault()
        const events = agentsFace(ctx)?.get(row.sessionId)?.session?.events ?? []
        return {
          ok: true,
          value: {
            sessionId: row.sessionId,
            events: processDigest(events),
          },
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
  void ensureYzjHostWorkspace(ctx).catch(() => undefined)
}
