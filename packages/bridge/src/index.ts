/**
 * Host channel to the Yunzhijia CLI (`yzj-cli`). The bridge spawns the CLI
 * binary directly with an argv array — no shell interpolation — so it reuses
 * the machine's existing `yzj-cli auth login` state, keychain-held credentials
 * and config (`~/.yzj-cli/config.json`) without the harness ever seeing
 * appSecret or accessToken. Every invocation captures bounded stdout/stderr,
 * enforces a cooperative timeout, and parses stdout as one JSON document when
 * it parses. The channel is read-only at this level; every mutation stays
 * behind the model-facing tools that consume this service.
 * @module @dsh-yzj/bridge
 */

import { spawn, execFile, type ChildProcess } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'

const execFileAsync = promisify(execFile)

/** Handle returned by {@link YzjBridge.start}: the child is already running. */
export interface YzjStartHandle {
  /** True when the same argv is still running from a previous `start`. */
  alreadyRunning: boolean
}

/** One background child tracked by {@link YzjBridge.start}. */
interface StartedChild {
  child: ChildProcess
  timer: ReturnType<typeof setTimeout>
}

/** Result of one `yzj-cli` invocation. */
export interface YzjRunResult {
  /** True when the process exited with code 0 within budget. */
  ok: boolean
  /** Process exit code; null when the process was killed by the timeout. */
  exitCode: number | null
  /** Captured stdout, truncated at the configured character cap. */
  stdout: string
  /** Captured stderr, truncated at the configured character cap. */
  stderr: string
  /** stdout parsed as a JSON value when it parses; omitted otherwise. */
  json?: unknown
  /** True when either captured stream hit the character cap. */
  truncated: boolean
  /** True when the process was killed for exceeding the timeout budget. */
  timedOut: boolean
  /** Wall-clock duration of the invocation in milliseconds. */
  durationMs: number
}

/** Failed to launch the configured binary (missing executable or bad path). */
export class YzjSpawnError extends Error {}

/**
 * Parse an npm-generated Windows launcher (.cmd) and return the node entry
 * script it forwards to, resolved against the launcher directory. Matches the
 * npm 7+ template `"%_prog%" "%dp0%\node_modules\<pkg>\scripts\<entry>" %*`.
 * @param cmdPath - absolute path of the .cmd launcher.
 * @returns the node entry script path, or undefined when the template does not match.
 */
export function resolveNpmLauncher(cmdPath: string): string | undefined {
  let content: string
  try {
    content = readFileSync(cmdPath, 'utf8')
  } catch {
    return undefined
  }
  const match = content.match(/%dp0%\\(node_modules\\[^"]+?\\scripts\\[^"]+)/i)
  if (match === null || match[1] === undefined) return undefined
  return join(dirname(cmdPath), match[1])
}

/** Cached Windows launcher resolutions: bare command name → [executable, prefix argv]. */
const windowsLauncherCache = new Map<string, [string, string[]]>()

/**
 * Resolve a bare command name on Windows: `spawn` cannot execute the
 * .cmd/.ps1/.sh shims npm installs globally, so the bridge routes the command
 * through `node <entry script>` instead. Non-Windows and explicit paths pass
 * through untouched.
 * @param binary - the configured binary name or path.
 * @returns the [executable, prefix argv] to spawn.
 */
async function resolveBinary(binary: string): Promise<[string, string[]]> {
  if (process.platform !== 'win32') return [binary, []]
  if (binary.includes('/') || binary.includes('\\') || binary.endsWith('.exe')) return [binary, []]
  const cached = windowsLauncherCache.get(binary)
  if (cached !== undefined) return cached
  let resolved: [string, string[]] = [binary, []]
  try {
    const { stdout } = await execFileAsync('where.exe', [binary], { timeout: 5_000 })
    // `where` lists every PATH hit — the npm sh (extension-less) shim first,
    // then the .cmd launcher. Pick the .cmd/.bat entry the parser understands.
    const cmdPath = stdout.split(/\r?\n/)
      .map(line => line.trim())
      .find(line => line !== '' && /\.(cmd|bat)$/i.test(line))
    if (cmdPath !== undefined) {
      const script = resolveNpmLauncher(cmdPath)
      if (script !== undefined) resolved = [process.execPath, [script]]
    }
  } catch {
    // Resolution failure falls through: the spawn below reports the real error.
  }
  windowsLauncherCache.set(binary, resolved)
  return resolved
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    yzjBridge: YzjBridge
  }
}

/** yzj-bridge configuration; the schema fills every default. */
export interface Config {
  /** `yzj-cli` executable name or absolute path. Defaults to `yzj-cli`. */
  binary?: string
  /** yzj-cli credential/config profile (`--profile <name>`). Defaults to none (the `default` profile). */
  profile?: string
  /** Cooperative timeout per invocation in milliseconds. Defaults to 60000. */
  timeoutMs?: number
  /** Per-stream capture cap in characters. Defaults to 200000. */
  maxOutputChars?: number
}

const DEFAULT_BINARY = 'yzj-cli'
const DEFAULT_TIMEOUT_MS = 60_000
/** Background `start()` budget — long enough for interactive `auth login`. */
const DEFAULT_START_TIMEOUT_MS = 600_000
const DEFAULT_MAX_OUTPUT_CHARS = 200_000
/** Empty profile string means "no --profile flag" (the CLI default profile). */
const NO_PROFILE = ''

const ConfigSchema: z<Config> = z.object({
  binary: z.string().default(DEFAULT_BINARY),
  profile: z.string().default(NO_PROFILE),
  timeoutMs: z.number().step(1).min(1).default(DEFAULT_TIMEOUT_MS),
  maxOutputChars: z.number().step(1).min(1).default(DEFAULT_MAX_OUTPUT_CHARS),
})

/** Configuration with every default resolved. */
interface ResolvedConfig {
  binary: string
  profile: string | undefined
  timeoutMs: number
  maxOutputChars: number
}

/** One `yzj-cli` command execution channel. */
export default class YzjBridge extends Service {
  static Config: z<Config> = ConfigSchema

  private readonly config: ResolvedConfig
  /** In-flight `start()` children, keyed by the caller argv (joined). */
  private readonly started = new Map<string, StartedChild>()

  constructor(ctx: Context, config: Config) {
    super(ctx, 'yzjBridge')
    this.config = {
      binary: config.binary ?? DEFAULT_BINARY,
      profile: config.profile === undefined || config.profile === '' ? undefined : config.profile,
      timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      maxOutputChars: config.maxOutputChars ?? DEFAULT_MAX_OUTPUT_CHARS,
    }
    ctx.effect(() => () => { this.stopAll() })
  }

  /**
   * Run one `yzj-cli` command and return its bounded result. Arguments are
   * passed verbatim to the CLI. A non-zero exit is a result, not a rejection.
   * @param command - argv after the executable and any configured `--profile`
   * prefix (e.g. `['doc', 'workspace', 'list']`).
   * @param options - per-invocation overrides: timeout, optional stdin body
   * (closed immediately after writing; used by commands reading JSON from
   * stdin), and an output-char budget for legitimately large payloads (e.g.
   * block dumps) that the default cap would truncate into unparseable JSON.
   * @returns the invocation result.
   */
  async run(
    command: readonly string[],
    options?: { timeoutMs?: number; stdin?: string; maxOutputChars?: number },
  ): Promise<YzjRunResult> {
    const started = Date.now()
    const timeoutMs = options?.timeoutMs ?? this.config.timeoutMs
    const stdin = options?.stdin
    const maxOutputChars = options?.maxOutputChars ?? this.config.maxOutputChars
    // On Windows, npm-global commands exist only as .cmd/.ps1/.sh shims that
    // `spawn` cannot execute; resolve the shim to its node entry once.
    const [executable, prefix] = await resolveBinary(this.config.binary)
    const argv = [
      ...prefix,
      ...(this.config.profile === undefined ? [] : ['--profile', this.config.profile]),
      ...command,
    ]

    return new Promise<YzjRunResult>((resolve, reject) => {
      const child = spawn(executable, argv, {
        stdio: [stdin === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
      })
      let stdout = ''
      let stderr = ''
      let truncated = false
      let timedOut = false

      const capture = (existing: string, chunk: Buffer): string => {
        const next = existing + chunk.toString('utf8')
        if (next.length > maxOutputChars) {
          truncated = true
          return next.slice(0, maxOutputChars)
        }
        return next
      }

      const timer = setTimeout(() => {
        timedOut = true
        child.kill('SIGKILL')
      }, timeoutMs)

      const stdoutStream = child.stdout
      const stderrStream = child.stderr
      if (stdoutStream === null || stderrStream === null) {
        // The pipe entries above always provide both streams; a missing
        // stream means the spawn options changed without this guard.
        clearTimeout(timer)
        reject(new YzjSpawnError(`spawn of "${this.config.binary}" returned no stdout/stderr stream`))
        return
      }
      stdoutStream.on('data', (chunk: Buffer) => { stdout = capture(stdout, chunk) })
      stderrStream.on('data', (chunk: Buffer) => { stderr = capture(stderr, chunk) })

      if (stdin !== undefined) {
        const stdinStream = child.stdin
        if (stdinStream === null) {
          clearTimeout(timer)
          reject(new YzjSpawnError(`spawn of "${this.config.binary}" returned no stdin stream`))
          return
        }
        // The child may exit before reading; swallow the resulting EPIPE
        // instead of surfacing an unhandled stream error.
        stdinStream.on('error', () => {})
        stdinStream.end(stdin)
      }

      child.on('error', (error) => {
        clearTimeout(timer)
        reject(new YzjSpawnError(`failed to spawn yzj-cli binary "${this.config.binary}": ${String(error)}`))
      })

      child.on('close', (code) => {
        clearTimeout(timer)
        let json: unknown
        if (stdout.trim() !== '') {
          try {
            json = JSON.parse(stdout) as unknown
          } catch {
            // Non-JSON output stays text-only.
          }
        }
        resolve({
          ok: !timedOut && code === 0,
          exitCode: timedOut ? null : code,
          stdout,
          stderr,
          ...(json === undefined ? {} : { json }),
          truncated,
          timedOut,
          durationMs: Date.now() - started,
        })
      })
    })
  }

  /**
   * Spawn one `yzj-cli` command without awaiting exit. Used for interactive
   * `auth login`: the CLI opens the system browser and must stay alive until
   * the user finishes (or the timeout fires). A second `start` of the same
   * argv while the child is still running is a no-op. Plugin unload kills
   * every background child.
   * @param command - argv after the executable and any configured `--profile`.
   * @param options.timeoutMs - kill budget; defaults to 10 minutes.
   */
  async start(
    command: readonly string[],
    options?: { timeoutMs?: number },
  ): Promise<YzjStartHandle> {
    const key = command.join('\0')
    const existing = this.started.get(key)
    if (existing !== undefined && existing.child.exitCode === null && !existing.child.killed) {
      return { alreadyRunning: true }
    }
    this.forget(key)
    const timeoutMs = options?.timeoutMs ?? DEFAULT_START_TIMEOUT_MS
    const [executable, prefix] = await resolveBinary(this.config.binary)
    const argv = [
      ...prefix,
      ...(this.config.profile === undefined ? [] : ['--profile', this.config.profile]),
      ...command,
    ]
    return new Promise<YzjStartHandle>((resolve, reject) => {
      const child = spawn(executable, argv, { stdio: 'ignore' })
      const onError = (error: Error): void => {
        this.forget(key)
        reject(new YzjSpawnError(`failed to spawn yzj-cli binary "${this.config.binary}": ${String(error)}`))
      }
      child.once('error', onError)
      child.once('spawn', () => {
        child.off('error', onError)
        const timer = setTimeout(() => { child.kill('SIGKILL') }, timeoutMs)
        this.started.set(key, { child, timer })
        child.on('close', () => { this.forget(key) })
        resolve({ alreadyRunning: false })
      })
    })
  }

  /** Kill every background `start()` child. Called on plugin unload. */
  stopAll(): void {
    for (const key of [...this.started.keys()]) {
      const entry = this.started.get(key)
      if (entry === undefined) continue
      if (entry.child.exitCode === null && !entry.child.killed) entry.child.kill('SIGKILL')
      this.forget(key)
    }
  }

  /** Drop one tracked child without killing it (exit / spawn-error path). */
  private forget(key: string): void {
    const entry = this.started.get(key)
    if (entry === undefined) return
    clearTimeout(entry.timer)
    this.started.delete(key)
  }

  /**
   * Probe whether the configured binary is reachable and authenticated by
   * running `contact user get`; false on spawn failure, timeout, or non-zero
   * exit. Used by tests and by consumers deciding whether to advertise tools.
   * @param timeoutMs - probe budget in milliseconds.
   */
  async check(timeoutMs: number = 10_000): Promise<boolean> {
    try {
      const result = await this.run(['contact', 'user', 'get'], { timeoutMs })
      return result.ok
    } catch {
      return false
    }
  }
}
