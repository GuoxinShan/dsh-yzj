import { execFile, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { Service } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
//#region packages/bridge/lib/index.js
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
const execFileAsync = promisify(execFile);
/** Failed to launch the configured binary (missing executable or bad path). */
var YzjSpawnError = class extends Error {};
/**
* Parse an npm-generated Windows launcher (.cmd) and return the node entry
* script it forwards to, resolved against the launcher directory. Matches the
* npm 7+ template `"%_prog%" "%dp0%\node_modules\<pkg>\scripts\<entry>" %*`.
* @param cmdPath - absolute path of the .cmd launcher.
* @returns the node entry script path, or undefined when the template does not match.
*/
function resolveNpmLauncher(cmdPath) {
	let content;
	try {
		content = readFileSync(cmdPath, "utf8");
	} catch {
		return;
	}
	const match = content.match(/%dp0%\\(node_modules\\[^"]+?\\scripts\\[^"]+)/i);
	if (match === null || match[1] === void 0) return void 0;
	return join(dirname(cmdPath), match[1]);
}
/** Cached Windows launcher resolutions: bare command name → [executable, prefix argv]. */
const windowsLauncherCache = /* @__PURE__ */ new Map();
/**
* Resolve a bare command name on Windows: `spawn` cannot execute the
* .cmd/.ps1/.sh shims npm installs globally, so the bridge routes the command
* through `node <entry script>` instead. Non-Windows and explicit paths pass
* through untouched.
* @param binary - the configured binary name or path.
* @returns the [executable, prefix argv] to spawn.
*/
async function resolveBinary(binary) {
	if (process.platform !== "win32") return [binary, []];
	if (binary.includes("/") || binary.includes("\\") || binary.endsWith(".exe")) return [binary, []];
	const cached = windowsLauncherCache.get(binary);
	if (cached !== void 0) return cached;
	let resolved = [binary, []];
	try {
		const { stdout } = await execFileAsync("where.exe", [binary], { timeout: 5e3 });
		const cmdPath = stdout.split(/\r?\n/).map((line) => line.trim()).find((line) => line !== "" && /\.(cmd|bat)$/i.test(line));
		if (cmdPath !== void 0) {
			const script = resolveNpmLauncher(cmdPath);
			if (script !== void 0) resolved = [process.execPath, [script]];
		}
	} catch {}
	windowsLauncherCache.set(binary, resolved);
	return resolved;
}
const DEFAULT_BINARY = "yzj-cli";
const DEFAULT_TIMEOUT_MS = 6e4;
const DEFAULT_MAX_OUTPUT_CHARS = 2e5;
const ConfigSchema = z.object({
	binary: z.string().default(DEFAULT_BINARY),
	profile: z.string().default(""),
	timeoutMs: z.number().step(1).min(1).default(DEFAULT_TIMEOUT_MS),
	maxOutputChars: z.number().step(1).min(1).default(DEFAULT_MAX_OUTPUT_CHARS)
});
/** One `yzj-cli` command execution channel. */
var YzjBridge = class extends Service {
	static Config = ConfigSchema;
	config;
	constructor(ctx, config) {
		super(ctx, "yzjBridge");
		this.config = {
			binary: config.binary ?? DEFAULT_BINARY,
			profile: config.profile === void 0 || config.profile === "" ? void 0 : config.profile,
			timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
			maxOutputChars: config.maxOutputChars ?? DEFAULT_MAX_OUTPUT_CHARS
		};
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
	async run(command, options) {
		const started = Date.now();
		const timeoutMs = options?.timeoutMs ?? this.config.timeoutMs;
		const stdin = options?.stdin;
		const maxOutputChars = options?.maxOutputChars ?? this.config.maxOutputChars;
		const [executable, prefix] = await resolveBinary(this.config.binary);
		const argv = [
			...prefix,
			...this.config.profile === void 0 ? [] : ["--profile", this.config.profile],
			...command
		];
		return new Promise((resolve, reject) => {
			const child = spawn(executable, argv, { stdio: [
				stdin === void 0 ? "ignore" : "pipe",
				"pipe",
				"pipe"
			] });
			let stdout = "";
			let stderr = "";
			let truncated = false;
			let timedOut = false;
			const capture = (existing, chunk) => {
				const next = existing + chunk.toString("utf8");
				if (next.length > maxOutputChars) {
					truncated = true;
					return next.slice(0, maxOutputChars);
				}
				return next;
			};
			const timer = setTimeout(() => {
				timedOut = true;
				child.kill("SIGKILL");
			}, timeoutMs);
			const stdoutStream = child.stdout;
			const stderrStream = child.stderr;
			if (stdoutStream === null || stderrStream === null) {
				clearTimeout(timer);
				reject(new YzjSpawnError(`spawn of "${this.config.binary}" returned no stdout/stderr stream`));
				return;
			}
			stdoutStream.on("data", (chunk) => {
				stdout = capture(stdout, chunk);
			});
			stderrStream.on("data", (chunk) => {
				stderr = capture(stderr, chunk);
			});
			if (stdin !== void 0) {
				const stdinStream = child.stdin;
				if (stdinStream === null) {
					clearTimeout(timer);
					reject(new YzjSpawnError(`spawn of "${this.config.binary}" returned no stdin stream`));
					return;
				}
				stdinStream.on("error", () => {});
				stdinStream.end(stdin);
			}
			child.on("error", (error) => {
				clearTimeout(timer);
				reject(new YzjSpawnError(`failed to spawn yzj-cli binary "${this.config.binary}": ${String(error)}`));
			});
			child.on("close", (code) => {
				clearTimeout(timer);
				let json;
				if (stdout.trim() !== "") try {
					json = JSON.parse(stdout);
				} catch {}
				resolve({
					ok: !timedOut && code === 0,
					exitCode: timedOut ? null : code,
					stdout,
					stderr,
					...json === void 0 ? {} : { json },
					truncated,
					timedOut,
					durationMs: Date.now() - started
				});
			});
		});
	}
	/**
	* Probe whether the configured binary is reachable and authenticated by
	* running `contact user get`; false on spawn failure, timeout, or non-zero
	* exit. Used by tests and by consumers deciding whether to advertise tools.
	* @param timeoutMs - probe budget in milliseconds.
	*/
	async check(timeoutMs = 1e4) {
		try {
			return (await this.run([
				"contact",
				"user",
				"get"
			], { timeoutMs })).ok;
		} catch {
			return false;
		}
	}
};
//#endregion
export { YzjSpawnError, YzjBridge as default, resolveNpmLauncher };
