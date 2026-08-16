import { join } from "node:path";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
//#region packages/ui-yzj/lib/index.js
/**
* Confirmation-card bridge for yzj write operations (design v1.6 §5.2).
*
* How it works within harness constraints: out-of-repo plugins cannot append
* custom session event types (the generated `KNOWN_SESSION_EVENT_TYPES` set
* refuses unknown events without an `ignorable` marker, and `Session.append`
* offers no marker entry). The card therefore rides the OFFICIAL audit path:
*
* - `tools/pre-execute` asks (tool-yzj guard) and broadcasts `yzj/ask-pending`
*   with the full parsed arguments;
* - this module answers the `approval/request` waterfall for `yzj_*` tools,
*   keeping an in-memory pending record (status `pending` → `approved` /
*   `cancelled`) that the browser card queries and decides through RPC;
* - the official `tools/result` event drives the terminal status (`done` /
*   `failed`), so replay reconstructs results from the durable tool events
*   while the card's transient state lives in this process (SPA reloads keep
*   it; a host restart degrades to the ordinary tool card).
*
* The record never enters the model transcript; it is a UI-only decision
* surface on top of the already-logged tool call.
*
* Type hygiene: this package compiles its node half and browser half in ONE
* program, and importing the host-only packages (`user-approval`,
* `dsh-session` roots) would merge their `ctx.sessions` declarations over
* the browser runtime's — so every event contract used here is declared
* locally with structural types.
*/
/** Map a tool name to its confirmation-card domain. */
function domainOf(toolName) {
	if (toolName.startsWith("yzj_im_")) return "im";
	if (toolName.startsWith("yzj_doc_workspace_")) return "kb";
	if (toolName.startsWith("yzj_doc_")) return "doc";
	if (toolName.startsWith("yzj_sheet_")) return "sheet";
	if (toolName.startsWith("yzj_todo_")) return "todo";
	if (toolName.startsWith("yzj_calendar_")) return "calendar";
	if (toolName.startsWith("yzj_file_")) return "file";
	return "other";
}
/**
* Find the audit id pairing one approval request: the newest `approval/asked`
* event with the same callId that is neither decided nor claimed by another
* pending record (mirrors the apiproxy pairing rule).
*/
function findApprovalId(sessionEvents, callId, claimed) {
	const decided = /* @__PURE__ */ new Set();
	for (let index = sessionEvents.length - 1; index >= 0; index -= 1) {
		const event = sessionEvents[index];
		if (event.type === "approval/decided") decided.add(event.data.id);
		else if (event.type === "approval/asked") {
			const asked = event;
			if (decided.has(asked.data.id) || claimed.has(asked.data.id)) continue;
			if ((callId ?? null) !== (asked.data.callId ?? null)) continue;
			return asked.data.id;
		}
	}
}
/**
* Register the confirmation-card bridge. Returns the query/decide faces the
* `/yzj` RPC channel exposes to the browser.
*/
function applyWriteGate(ctx) {
	/** callId → ask metadata broadcast by the tool-yzj guard. */
	const askPending = /* @__PURE__ */ new Map();
	/** writeId → live record. */
	const records = /* @__PURE__ */ new Map();
	/** Settled records kept for a short window so cards refresh after reload. */
	const settled = [];
	const SETTLED_WINDOW = 200;
	const statusOf = (outcome) => outcome === "allowed-once" ? "approved" : "cancelled";
	const retain = (record) => {
		records.delete(record.writeId);
		settled.push(projectRecord$1(record));
		if (settled.length > SETTLED_WINDOW) settled.splice(0, settled.length - SETTLED_WINDOW);
	};
	ctx.on("yzj/ask-pending", (pending) => {
		askPending.set(pending.callId, pending);
	});
	ctx.on("approval/request", (req, next) => {
		if (!req.toolName.startsWith("yzj_")) return next();
		if (req.agent.session.id.startsWith("yzj-robot-")) return next();
		if (req.signal?.aborted === true) return Promise.resolve("cancelled");
		const claimed = new Set(records.keys());
		const id = findApprovalId(req.agent.session.events, req.callId, claimed);
		if (id === void 0) return next();
		const pending = req.callId === void 0 ? void 0 : askPending.get(req.callId);
		const record = {
			writeId: id,
			sessionId: req.agent.session.id,
			toolName: req.toolName,
			...req.callId === void 0 ? {} : { callId: req.callId },
			level: pending?.level ?? "standard",
			domain: domainOf(req.toolName),
			args: pending?.args ?? {},
			reason: req.reason ?? pending?.reason ?? "",
			status: "pending",
			time: Date.now(),
			resolve: void 0,
			removeAbort: void 0
		};
		return new Promise((resolve) => {
			const settle = (outcome) => {
				record.removeAbort?.();
				record.removeAbort = void 0;
				record.resolve = void 0;
				if (record.status === "pending") {
					record.status = statusOf(outcome);
					record.decidedAt = Date.now();
				}
				retain(record);
				resolve(outcome);
			};
			const onAbort = () => {
				settle("cancelled");
			};
			record.resolve = settle;
			record.removeAbort = () => req.signal?.removeEventListener("abort", onAbort);
			req.signal?.addEventListener("abort", onAbort, { once: true });
			records.set(record.writeId, record);
		});
	});
	ctx.on("tools/result", (exec, result) => {
		const apply = (record) => {
			if (record.callId === exec.callId && record.status === "approved") {
				record.status = result.isError === true ? "failed" : "done";
				if (result.isError === true) {
					const first = result.content?.[0];
					const text = first !== void 0 && "text" in first ? first.text : void 0;
					record.error = String(text ?? "工具执行失败");
				} else delete record.error;
				return true;
			}
			return false;
		};
		for (const record of records.values()) if (apply(record)) return;
		for (const record of settled) if (apply(record)) return;
	});
	ctx.effect(() => () => {
		for (const record of records.values()) {
			record.removeAbort?.();
			if (record.status === "pending") record.resolve?.("cancelled");
		}
		records.clear();
		settled.length = 0;
		askPending.clear();
	}, "ui-yzj: write-gate teardown");
	return {
		list: (sessionId, callId) => {
			const out = [];
			for (const record of records.values()) {
				if (record.sessionId !== sessionId) continue;
				if (callId !== void 0 && record.callId !== callId) continue;
				out.push(projectRecord$1(record));
			}
			for (const record of settled) {
				if (record.sessionId !== sessionId) continue;
				if (callId !== void 0 && record.callId !== callId) continue;
				out.push(record);
			}
			return out;
		},
		decide: (writeId, outcome) => {
			const record = records.get(writeId);
			if (record === void 0 || record.status !== "pending" || record.resolve === void 0) return false;
			record.resolve(outcome);
			return true;
		}
	};
}
/** Project a live record into a lossless JSON snapshot. */
function projectRecord$1(record) {
	return {
		writeId: record.writeId,
		sessionId: record.sessionId,
		toolName: record.toolName,
		...record.callId === void 0 ? {} : { callId: record.callId },
		level: record.level,
		domain: record.domain,
		args: record.args,
		reason: record.reason,
		status: record.status,
		...record.error === void 0 ? {} : { error: record.error },
		time: record.time,
		...record.decidedAt === void 0 ? {} : { decidedAt: record.decidedAt }
	};
}
/**
* Yunzhijia browser surface, node half: the `/yzj` Connection RPC channel over
* `ctx.yzjBridge`. The browser half fetches workspaces, docs, events, chats,
* and contacts through it; the model-facing tools remain in `@dsh-yzj/tool-yzj`.
* Only lossless CLI-parsed JSON crosses the channel — never harness live
* objects.
* @module @dsh-yzj/ui-yzj
*/
/** Cordis plugin name used by loader diagnostics. */
const name = "ui-yzj";
/** Services required by the board channel plus the robot settings face. */
const inject = ["connection", "yzjBridge"];
/** Internal failure envelope matching the closed RpcError union. */
function internalError(message) {
	return {
		ok: false,
		error: {
			code: "internal",
			message,
			details: {}
		}
	};
}
/** One bridge call projected into the RPC result envelope. */
async function bridgeResult(ctx, label, command) {
	let result;
	try {
		result = await ctx.yzjBridge.run(command);
	} catch (error) {
		return internalError(`${label} failed: ${String(error)}；请确认已安装 yzj-cli 并完成 \`yzj-cli auth login\``);
	}
	if (!result.ok) return internalError(result.stderr.trim() === "" ? `${label} failed (exit ${result.exitCode})` : result.stderr.trim());
	return {
		ok: true,
		value: result.json ?? {}
	};
}
/** Validate a string field of an RPC payload. */
function stringField(payload, key) {
	const value = typeof payload === "object" && payload !== null ? payload[key] : void 0;
	return typeof value === "string" && value !== "" ? value : void 0;
}
/** Validate a non-negative integer field of an RPC payload. */
function numberField(payload, key) {
	const value = typeof payload === "object" && payload !== null ? payload[key] : void 0;
	return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : void 0;
}
/** Cap an integer field at the CLI's real `--limit` bound (1-20 for im). */
function clampLimit(value) {
	if (typeof value !== "number" || !Number.isInteger(value) || value < 1) return void 0;
	return Math.min(value, CLI_LIMIT_MAX);
}
/** Hard CLI cap for im `--limit` (verified against yzj-cli 0.x). */
const CLI_LIMIT_MAX = 20;
/** Largest payload the proxy returns (bytes) — keeps RPC and memory sane. */
const FILE_DATA_MAX_BYTES = 25165824;
const fileDataCache = /* @__PURE__ */ new Map();
const fileDataInflight = /* @__PURE__ */ new Map();
let fileDataCachedBytes = 0;
/** Sniff an image MIME from magic bytes ('' = not a known image). */
function sniffMime(bytes) {
	if (bytes.length >= 8 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) return "image/png";
	if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
	if (bytes.length >= 6 && bytes[0] === 71 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 56) return "image/gif";
	if (bytes.length >= 12 && bytes.slice(0, 4).toString("latin1") === "RIFF" && bytes.slice(8, 12).toString("latin1") === "WEBP") return "image/webp";
	if (bytes.length >= 2 && bytes[0] === 66 && bytes[1] === 77) return "image/bmp";
	return "";
}
/** Download one file via the authenticated CLI; data URL or undefined. */
async function downloadFileData(ctx, fileId) {
	const dir = await mkdtemp(join(tmpdir(), "yzj-file-"));
	const target = join(dir, "payload.bin");
	try {
		if (!(await ctx.yzjBridge.run([
			"file",
			"download",
			"--id",
			fileId,
			"--output",
			target
		], { timeoutMs: 6e4 })).ok) return void 0;
		const bytes = await readFile(target);
		if (bytes.length === 0 || bytes.length > FILE_DATA_MAX_BYTES) return void 0;
		return {
			dataUrl: `data:${sniffMime(bytes) === "" ? "application/octet-stream" : sniffMime(bytes)};base64,${bytes.toString("base64")}`,
			bytes: bytes.length
		};
	} catch {
		return;
	} finally {
		await rm(dir, {
			recursive: true,
			force: true
		}).catch(() => {});
	}
}
/** Cached fileId → data URL (bounded by entries and total bytes). */
function rememberFileData(fileId, entry) {
	fileDataCache.set(fileId, entry);
	fileDataCachedBytes += entry.bytes;
	for (const [key, value] of fileDataCache) {
		if (fileDataCache.size <= 48 && fileDataCachedBytes <= 100663296) break;
		fileDataCache.delete(key);
		fileDataCachedBytes -= value.bytes;
	}
}
/** Resolve one file's data URL, deduped per fileId. */
async function fileDataFor(ctx, fileId) {
	const cached = fileDataCache.get(fileId);
	if (cached !== void 0) return cached;
	let pending = fileDataInflight.get(fileId);
	if (pending === void 0) {
		pending = downloadFileData(ctx, fileId);
		fileDataInflight.set(fileId, pending);
	}
	const entry = await pending;
	fileDataInflight.delete(fileId);
	if (entry !== void 0) rememberFileData(fileId, entry);
	return entry;
}
/** Project a write-gate record into lossless JSON for the browser card. */
function projectRecord(record) {
	return {
		writeId: record.writeId,
		sessionId: record.sessionId,
		toolName: record.toolName,
		...record.callId === void 0 ? {} : { callId: record.callId },
		level: record.level,
		domain: record.domain,
		args: record.args,
		reason: record.reason,
		status: record.status,
		...record.error === void 0 ? {} : { error: record.error },
		time: record.time,
		...record.decidedAt === void 0 ? {} : { decidedAt: record.decidedAt }
	};
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
function createRpcHandler(ctx, writeGate) {
	return async (endpoint, payload, _signal) => {
		switch (endpoint) {
			case "workspaces": {
				const type = stringField(payload, "type");
				const command = [
					"doc",
					"workspace",
					"list"
				];
				if (type !== void 0) command.push("--type", type);
				return bridgeResult(ctx, "doc workspace list", command);
			}
			case "docs": {
				const workspace = stringField(payload, "workspace");
				if (workspace === void 0) return internalError("docs endpoint requires a workspace payload");
				const command = [
					"doc",
					"list",
					"--workspace",
					workspace
				];
				const parentId = stringField(payload, "parentId");
				if (parentId !== void 0) command.push("--parent-id", parentId);
				return bridgeResult(ctx, "doc list", command);
			}
			case "events": {
				const start = stringField(payload, "start");
				const end = stringField(payload, "end");
				if (start === void 0 || end === void 0) return internalError("events endpoint requires start and end payloads");
				return bridgeResult(ctx, "calendar event list", [
					"calendar",
					"event",
					"list",
					"--start",
					start,
					"--end",
					end
				]);
			}
			case "groups": {
				const command = [
					"im",
					"group",
					"recent"
				];
				if (typeof payload === "object" && payload !== null) {
					const limit = clampLimit(payload.limit);
					if (limit !== void 0) command.push("--limit", String(limit));
					const page = payload.page;
					if (typeof page === "number" && Number.isInteger(page) && page > 0) command.push("--page", String(page));
				}
				return bridgeResult(ctx, "im group recent", command);
			}
			case "messages": {
				const groupId = stringField(payload, "groupId");
				if (groupId === void 0) return internalError("messages endpoint requires a groupId payload");
				const command = [
					"im",
					"message",
					"list",
					"--group-id",
					groupId
				];
				const type = stringField(payload, "type");
				if (type !== void 0) command.push("--type", type);
				const msgId = stringField(payload, "msgId");
				if (msgId !== void 0) command.push("--msg-id", msgId);
				if (typeof payload === "object" && payload !== null) {
					const limit = clampLimit(payload.limit);
					if (limit !== void 0) command.push("--limit", String(limit));
				}
				return bridgeResult(ctx, "im message list", command);
			}
			case "whoami": return bridgeResult(ctx, "contact user get", [
				"contact",
				"user",
				"get"
			]);
			case "doc-get": {
				const id = stringField(payload, "id");
				if (id === void 0) return internalError("doc-get endpoint requires an id payload");
				return bridgeResult(ctx, "doc get", [
					"doc",
					"get",
					"--id",
					id
				]);
			}
			case "doc-blocks": {
				const id = stringField(payload, "id");
				if (id === void 0) return internalError("doc-blocks endpoint requires an id payload");
				const command = [
					"doc",
					"block",
					"list",
					"--id",
					id
				];
				const blockId = stringField(payload, "blockId");
				if (blockId !== void 0) command.push("--block-id", blockId);
				let result;
				try {
					result = await ctx.yzjBridge.run(command, {
						timeoutMs: 12e4,
						maxOutputChars: 2e6
					});
				} catch (error) {
					return internalError(`doc block list failed: ${String(error)}；请确认已安装 yzj-cli 并完成 \`yzj-cli auth login\``);
				}
				if (!result.ok) return internalError(result.stderr.trim() === "" ? `doc block list failed (exit ${result.exitCode})` : result.stderr.trim());
				return {
					ok: true,
					value: result.json ?? {}
				};
			}
			case "sheet-get": {
				const id = stringField(payload, "id");
				if (id === void 0) return internalError("sheet-get endpoint requires an id payload");
				return bridgeResult(ctx, "sheet get", [
					"sheet",
					"get",
					"--id",
					id
				]);
			}
			case "workspace-get": {
				const id = stringField(payload, "id");
				if (id === void 0) return internalError("workspace-get endpoint requires an id payload");
				return bridgeResult(ctx, "doc workspace get", [
					"doc",
					"workspace",
					"get",
					"--id",
					id
				]);
			}
			case "event-get": {
				const id = stringField(payload, "id");
				if (id === void 0) return internalError("event-get endpoint requires an id payload");
				return bridgeResult(ctx, "calendar event get", [
					"calendar",
					"event",
					"get",
					"--id",
					id
				]);
			}
			case "contact-get": {
				const openId = stringField(payload, "openId");
				if (openId === void 0) return internalError("contact-get endpoint requires an openId payload");
				return bridgeResult(ctx, "contact user get", [
					"contact",
					"user",
					"get",
					"--open-id",
					openId
				]);
			}
			case "search": {
				const keyword = stringField(payload, "keyword");
				if (keyword === void 0) return internalError("search endpoint requires a keyword payload");
				return bridgeResult(ctx, "contact user search", [
					"contact",
					"user",
					"search",
					"--keyword",
					keyword
				]);
			}
			case "im-send": {
				const groupId = stringField(payload, "groupId");
				if (groupId === void 0) return internalError("im-send endpoint requires a groupId payload");
				const record = typeof payload === "object" && payload !== null ? payload : {};
				const msgType = stringField(record, "msgType") ?? "text";
				if (msgType !== "text" && msgType !== "richText" && msgType !== "file") return internalError(`im-send endpoint rejects msg-type "${msgType}"`);
				const content = stringField(record, "content");
				const fileId = stringField(record, "fileId");
				const replyMsgId = stringField(record, "replyMsgId");
				const rawImages = record.images;
				const images = Array.isArray(rawImages) ? rawImages.filter((item) => typeof item === "string" && item !== "") : [];
				if (msgType === "file") {
					if (fileId === void 0) return internalError("im-send: msg-type file requires fileId");
					if (content !== void 0 || replyMsgId !== void 0 || images.length > 0) return internalError("im-send: msg-type file does not support content, reply, or images");
				} else {
					if (content === void 0 || content.trim() === "") return internalError("im-send: text/richText require non-empty content");
					if (content.length > 4e3) return internalError("im-send: content over 4000 chars");
					if (msgType !== "richText" && images.length > 0) return internalError("im-send: images are only supported for msg-type richText");
				}
				const rawAt = record.atOpenIds;
				const atOpenIds = Array.isArray(rawAt) ? rawAt.filter((item) => typeof item === "string" && item !== "") : [];
				const atAll = record.atAll === true;
				if (msgType !== "file") {
					const atNames = ((content ?? "").match(/@[^@\s，,、]+/g) ?? []).filter((frag) => frag !== "@all");
					if (atOpenIds.length !== atNames.length) return internalError(`im-send: atOpenIds (${atOpenIds.length}) must match the @姓名 fragments in content (${atNames.length}), in order`);
					if (atAll && !(content ?? "").includes("@all")) return internalError("im-send: atAll requires an @all fragment in content");
				}
				const command = [
					"im",
					"message",
					"send",
					"--msg-type",
					msgType,
					"--group-id",
					groupId
				];
				if (content !== void 0) command.push("--content", content);
				if (fileId !== void 0) command.push("--file-id", fileId);
				if (replyMsgId !== void 0) command.push("--reply-msg-id", replyMsgId);
				for (const image of images) command.push("--image", image);
				for (const openId of atOpenIds) command.push("--at-open-id", openId);
				if (atAll) command.push("--at-all");
				return bridgeResult(ctx, "im message send", command);
			}
			case "file-upload": {
				const record = typeof payload === "object" && payload !== null ? payload : {};
				const name = stringField(record, "name");
				const base64 = stringField(record, "base64");
				if (name === void 0 || base64 === void 0) return internalError("file-upload endpoint requires name and base64 payloads");
				if (base64.length > 33554432) return internalError("file-upload endpoint rejects payloads over 24MB (base64)");
				let bytes;
				try {
					bytes = Buffer.from(base64, "base64");
				} catch {
					return internalError("file-upload endpoint received invalid base64");
				}
				if (bytes.length === 0) return internalError("file-upload endpoint rejects empty files");
				if (bytes.length > 25165824) return internalError("file-upload endpoint rejects files over 24MB");
				const dir = await mkdtemp(join(tmpdir(), "yzj-up-"));
				const target = join(dir, name.replace(/[\\/:*?"<>|]/g, "_"));
				try {
					await writeFile(target, bytes);
					const result = await ctx.yzjBridge.run([
						"file",
						"upload",
						"--file",
						target,
						"--name",
						name
					], { timeoutMs: 12e4 });
					if (!result.ok) return internalError(result.stderr.trim() === "" ? `file upload failed (exit ${result.exitCode})` : result.stderr.trim());
					const payloadJson = result.json ?? {};
					const fileId = stringField(payloadJson, "fileId") ?? stringField(payloadJson, "file_id") ?? stringField(payloadJson, "id");
					if (fileId === void 0) return internalError("file upload returned no fileId");
					return {
						ok: true,
						value: {
							fileId,
							name,
							size: bytes.length
						}
					};
				} catch (error) {
					return internalError(`file upload failed: ${String(error)}`);
				} finally {
					await rm(dir, {
						recursive: true,
						force: true
					}).catch(() => {});
				}
			}
			case "file-data": {
				const fileId = stringField(payload, "fileId");
				if (fileId === void 0) return internalError("file-data endpoint requires a fileId payload");
				const entry = await fileDataFor(ctx, fileId);
				if (entry === void 0) return internalError(`file-data failed to download fileId ${fileId}`);
				return {
					ok: true,
					value: entry
				};
			}
			case "todo-libraries": {
				const todo = ctx.get("yzjTodo");
				if (todo === void 0) return internalError("todo-libraries: yzjTodo 服务不可用（tool-yzj 未挂载）");
				try {
					const [libraries, teamWorkspaces, state] = await Promise.all([
						todo.listLibraries(),
						todo.teamWorkspaces(),
						todo.state()
					]);
					return {
						ok: true,
						value: {
							libraries,
							activeDocId: state.activeDocId ?? "",
							teamWorkspaces
						}
					};
				} catch (error) {
					return internalError(`todo-libraries failed: ${String(error)}`);
				}
			}
			case "todo-select": {
				const todo = ctx.get("yzjTodo");
				if (todo === void 0) return internalError("todo-select: yzjTodo 服务不可用（tool-yzj 未挂载）");
				const docId = stringField(payload, "docId");
				if (docId === void 0) return internalError("todo-select endpoint requires a docId payload");
				try {
					return {
						ok: true,
						value: await todo.select(docId)
					};
				} catch (error) {
					return internalError(`todo-select failed: ${String(error)}`);
				}
			}
			case "todo-ensure-team": {
				const todo = ctx.get("yzjTodo");
				if (todo === void 0) return internalError("todo-ensure-team: yzjTodo 服务不可用（tool-yzj 未挂载）");
				const workspace = stringField(payload, "workspace");
				if (workspace === void 0) return internalError("todo-ensure-team endpoint requires a workspace payload");
				try {
					return {
						ok: true,
						value: await todo.ensureTeam(workspace)
					};
				} catch (error) {
					return internalError(`todo-ensure-team failed: ${String(error)}`);
				}
			}
			case "todo-state": {
				const todo = ctx.get("yzjTodo");
				if (todo === void 0) return internalError("todo-state: yzjTodo 服务不可用（tool-yzj 未挂载）");
				try {
					return {
						ok: true,
						value: await todo.state()
					};
				} catch (error) {
					return internalError(`todo-state failed: ${String(error)}`);
				}
			}
			case "todo-ensure": {
				const todo = ctx.get("yzjTodo");
				if (todo === void 0) return internalError("todo-ensure: yzjTodo 服务不可用（tool-yzj 未挂载）");
				try {
					return {
						ok: true,
						value: await todo.ensure()
					};
				} catch (error) {
					return internalError(`todo-ensure failed: ${String(error)}`);
				}
			}
			case "todo-create": {
				const todo = ctx.get("yzjTodo");
				if (todo === void 0) return internalError("todo-create: yzjTodo 服务不可用（tool-yzj 未挂载）");
				const title = stringField(payload, "title");
				if (title === void 0) return internalError("todo-create endpoint requires a title payload");
				const record = typeof payload === "object" && payload !== null ? payload : {};
				const rawTags = record.tags;
				const tags = Array.isArray(rawTags) ? rawTags.filter((item) => typeof item === "string") : typeof rawTags === "string" ? [rawTags] : [];
				try {
					return {
						ok: true,
						value: await todo.create({
							title,
							ddl: stringField(record, "ddl"),
							priority: stringField(record, "priority"),
							assignee: stringField(record, "assignee"),
							tags
						})
					};
				} catch (error) {
					return internalError(`todo-create failed: ${String(error)}`);
				}
			}
			case "todo-toggle": {
				const todo = ctx.get("yzjTodo");
				if (todo === void 0) return internalError("todo-toggle: yzjTodo 服务不可用（tool-yzj 未挂载）");
				const todoId = stringField(payload, "todoId");
				if (todoId === void 0) return internalError("todo-toggle endpoint requires a todoId payload");
				try {
					return {
						ok: true,
						value: await todo.toggle(todoId)
					};
				} catch (error) {
					return internalError(`todo-toggle failed: ${String(error)}`);
				}
			}
			case "write-list": {
				const sessionId = stringField(payload, "sessionId");
				if (sessionId === void 0) return internalError("write-list endpoint requires a sessionId payload");
				const callId = stringField(payload, "callId");
				return {
					ok: true,
					value: { list: writeGate.list(sessionId, callId).map(projectRecord) }
				};
			}
			case "write-decide": {
				const writeId = stringField(payload, "writeId");
				const outcome = stringField(payload, "outcome");
				if (writeId === void 0 || outcome === void 0) return internalError("write-decide endpoint requires writeId and outcome payloads");
				if (outcome !== "allowed-once" && outcome !== "rejected") return internalError(`write-decide endpoint rejects outcome "${outcome}"`);
				return {
					ok: true,
					value: { settled: writeGate.decide(writeId, outcome) }
				};
			}
			case "robot-status": {
				const robot = ctx.get("yzjRobot");
				if (robot === void 0) return internalError("robot-status: yzjRobot 服务不可用（robot-yzj 未挂载）");
				return {
					ok: true,
					value: { channels: robot.statuses() }
				};
			}
			case "robot-overrides": {
				const robot = ctx.get("yzjRobot");
				if (robot === void 0) return internalError("robot-overrides: yzjRobot 服务不可用（robot-yzj 未挂载）");
				return {
					ok: true,
					value: { overrides: robot.listOverrides() }
				};
			}
			case "robot-override-set": {
				const robot = ctx.get("yzjRobot");
				if (robot === void 0) return internalError("robot-override-set: yzjRobot 服务不可用（robot-yzj 未挂载）");
				const record = typeof payload === "object" && payload !== null ? payload : {};
				const key = stringField(record, "key");
				if (key === void 0) return internalError("robot-override-set endpoint requires a key payload");
				const provider = stringField(record, "provider");
				const model = stringField(record, "model");
				if (provider === void 0 && model === void 0) return internalError("robot-override-set endpoint requires provider and/or model payloads");
				try {
					await robot.setOverride(key, {
						...provider === void 0 ? {} : { provider },
						...model === void 0 ? {} : { model }
					});
					return {
						ok: true,
						value: { saved: true }
					};
				} catch (error) {
					return internalError(`robot-override-set failed: ${String(error)}`);
				}
			}
			case "robot-override-delete": {
				const robot = ctx.get("yzjRobot");
				if (robot === void 0) return internalError("robot-override-delete: yzjRobot 服务不可用（robot-yzj 未挂载）");
				const key = stringField(payload, "key");
				if (key === void 0) return internalError("robot-override-delete endpoint requires a key payload");
				try {
					return {
						ok: true,
						value: { deleted: await robot.deleteOverride(key) }
					};
				} catch (error) {
					return internalError(`robot-override-delete failed: ${String(error)}`);
				}
			}
			case "robot-models": {
				const robot = ctx.get("yzjRobot");
				if (robot === void 0) return internalError("robot-models: yzjRobot 服务不可用（robot-yzj 未挂载）");
				try {
					return {
						ok: true,
						value: { catalog: await robot.modelCatalog() }
					};
				} catch (error) {
					return internalError(`robot-models failed: ${String(error)}`);
				}
			}
			case "robot-share-list": {
				const robot = ctx.get("yzjRobot");
				if (robot === void 0) return internalError("robot-share-list: yzjRobot 服务不可用（robot-yzj 未挂载）");
				const record = typeof payload === "object" && payload !== null ? payload : {};
				return {
					ok: true,
					value: robot.shareList(numberField(record, "robotIndex") ?? 0, stringField(record, "groupId"))
				};
			}
			case "robot-share-read": {
				const robot = ctx.get("yzjRobot");
				if (robot === void 0) return internalError("robot-share-read: yzjRobot 服务不可用（robot-yzj 未挂载）");
				const record = typeof payload === "object" && payload !== null ? payload : {};
				const groupId = stringField(record, "groupId");
				const filename = stringField(record, "filename");
				if (groupId === void 0 || filename === void 0) return internalError("robot-share-read endpoint requires groupId and filename payloads");
				return {
					ok: true,
					value: robot.shareRead(numberField(record, "robotIndex") ?? 0, groupId, filename)
				};
			}
			case "robot-open-folder": {
				const robot = ctx.get("yzjRobot");
				if (robot === void 0) return internalError("robot-open-folder: yzjRobot 服务不可用（robot-yzj 未挂载）");
				const record = typeof payload === "object" && payload !== null ? payload : {};
				return {
					ok: true,
					value: robot.openFolder(numberField(record, "robotIndex") ?? 0, stringField(record, "groupId"))
				};
			}
			case "robot-share-write": {
				const robot = ctx.get("yzjRobot");
				if (robot === void 0) return internalError("robot-share-write: yzjRobot 服务不可用（robot-yzj 未挂载）");
				const record = typeof payload === "object" && payload !== null ? payload : {};
				const groupId = stringField(record, "groupId");
				const filename = stringField(record, "filename");
				const content = stringField(record, "content");
				if (groupId === void 0 || filename === void 0 || content === void 0) return internalError("robot-share-write endpoint requires groupId, filename and content payloads");
				try {
					return {
						ok: true,
						value: await robot.shareWrite(numberField(record, "robotIndex") ?? 0, groupId, filename, content, record.overwrite === true)
					};
				} catch (error) {
					return internalError(`robot-share-write failed: ${String(error)}`);
				}
			}
			case "robot-channels-save": {
				const robot = ctx.get("yzjRobot");
				if (robot === void 0) return internalError("robot-channels-save: yzjRobot 服务不可用（robot-yzj 未挂载）");
				const record = typeof payload === "object" && payload !== null ? payload : {};
				const robots = (Array.isArray(record.robots) ? record.robots : []).flatMap((item) => {
					const entry = typeof item === "object" && item !== null ? item : {};
					const sendMsgUrl = stringField(entry, "sendMsgUrl");
					if (sendMsgUrl === void 0 || sendMsgUrl === "") return [];
					return [{
						sendMsgUrl,
						...typeof entry.enabled === "boolean" ? { enabled: entry.enabled } : {},
						...Array.isArray(entry.allowFrom) ? { allowFrom: entry.allowFrom.filter((value) => typeof value === "string") } : {},
						...stringField(entry, "provider") === void 0 ? {} : { provider: stringField(entry, "provider") },
						...stringField(entry, "model") === void 0 ? {} : { model: stringField(entry, "model") },
						...stringField(entry, "cwd") === void 0 ? {} : { cwd: stringField(entry, "cwd") }
					}];
				});
				try {
					return {
						ok: true,
						value: await robot.saveChannels({
							...stringField(record, "defaultProvider") === void 0 ? {} : { defaultProvider: stringField(record, "defaultProvider") },
							...stringField(record, "defaultModel") === void 0 ? {} : { defaultModel: stringField(record, "defaultModel") },
							robots
						})
					};
				} catch (error) {
					return internalError(`robot-channels-save failed: ${String(error)}`);
				}
			}
			case "robot-diagnostics": {
				const robot = ctx.get("yzjRobot");
				if (robot === void 0) return internalError("robot-diagnostics: yzjRobot 服务不可用（robot-yzj 未挂载）");
				return {
					ok: true,
					value: {
						push: robot.pushDiagnostics(),
						confirm: robot.confirmDiagnostics(),
						forks: robot.forkedSessions()
					}
				};
			}
			case "robot-notify": {
				const robot = ctx.get("yzjRobot");
				if (robot === void 0) return internalError("robot-notify: yzjRobot 服务不可用（robot-yzj 未挂载）");
				const record = typeof payload === "object" && payload !== null ? payload : {};
				const text = stringField(record, "text");
				if (text === void 0 || text === "") return internalError("robot-notify endpoint requires a text payload");
				try {
					return {
						ok: true,
						value: { sent: await robot.notify(text, numberField(record, "robotIndex") ?? 0) }
					};
				} catch (error) {
					return internalError(`robot-notify failed: ${String(error)}`);
				}
			}
			case "robot-continue": {
				const robot = ctx.get("yzjRobot");
				if (robot === void 0) return internalError("robot-continue: yzjRobot 服务不可用（robot-yzj 未挂载）");
				const record = typeof payload === "object" && payload !== null ? payload : {};
				const text = stringField(record, "text");
				if (text === void 0 || text === "") return internalError("robot-continue endpoint requires a text payload");
				const groupId = stringField(record, "groupId");
				try {
					return {
						ok: true,
						value: { continued: await robot.continueConversation(text, {
							...numberField(record, "robotIndex") === void 0 ? {} : { robotIndex: numberField(record, "robotIndex") },
							...groupId === void 0 ? {} : { groupId }
						}) }
					};
				} catch (error) {
					return internalError(`robot-continue failed: ${String(error)}`);
				}
			}
			case "robot-fork": {
				const robot = ctx.get("yzjRobot");
				if (robot === void 0) return internalError("robot-fork: yzjRobot 服务不可用（robot-yzj 未挂载）");
				const sessionId = stringField(payload, "sessionId");
				if (sessionId === void 0 || sessionId === "") return internalError("robot-fork endpoint requires a sessionId payload");
				try {
					return {
						ok: true,
						value: { forked: await robot.forkSession(sessionId) }
					};
				} catch (error) {
					return internalError(`robot-fork failed: ${String(error)}`);
				}
			}
			case "memory-scope": {
				const memory = ctx.get("yzjMemory");
				if (memory === void 0) return internalError("memory-scope: yzjMemory 服务不可用（memory-yzj 未挂载）");
				const scope = stringField(typeof payload === "object" && payload !== null ? payload : {}, "scope") ?? "user";
				try {
					return {
						ok: true,
						value: { view: memory.readScope(scope) }
					};
				} catch (error) {
					return internalError(`memory-scope failed: ${String(error)}`);
				}
			}
			case "memory-log": {
				const memory = ctx.get("yzjMemory");
				if (memory === void 0) return internalError("memory-log: yzjMemory 服务不可用（memory-yzj 未挂载）");
				const scope = stringField(typeof payload === "object" && payload !== null ? payload : {}, "scope") ?? "user";
				try {
					return {
						ok: true,
						value: { log: memory.dreamLogTail(scope, 4e3) }
					};
				} catch (error) {
					return internalError(`memory-log failed: ${String(error)}`);
				}
			}
			case "memory-observe": {
				const memory = ctx.get("yzjMemory");
				if (memory === void 0) return internalError("memory-observe: yzjMemory 服务不可用（memory-yzj 未挂载）");
				const record = typeof payload === "object" && payload !== null ? payload : {};
				const content = stringField(record, "content");
				if (content === void 0 || content.trim() === "") return internalError("memory-observe endpoint requires a non-empty content payload");
				const scope = stringField(record, "scope") ?? "user";
				const tags = Array.isArray(record.tags) ? record.tags.filter((value) => typeof value === "string") : [];
				try {
					return {
						ok: true,
						value: memory.observe(scope, content, {
							tags,
							source: "panel",
							...typeof record.durable === "boolean" ? { durable: record.durable } : {}
						})
					};
				} catch (error) {
					return internalError(`memory-observe failed: ${String(error)}`);
				}
			}
			case "dream-state": {
				const memory = ctx.get("yzjMemory");
				if (memory === void 0) return internalError("dream-state: yzjMemory 服务不可用（memory-yzj 未挂载）");
				return {
					ok: true,
					value: { state: memory.dreamSettings() }
				};
			}
			case "dream-set": {
				const memory = ctx.get("yzjMemory");
				if (memory === void 0) return internalError("dream-set: yzjMemory 服务不可用（memory-yzj 未挂载）");
				const record = typeof payload === "object" && payload !== null ? payload : {};
				if (record.enabled !== void 0 && typeof record.enabled !== "boolean") return internalError("dream-set: enabled must be a boolean");
				const str = (key) => {
					const value = record[key];
					return typeof value === "string" ? value : void 0;
				};
				try {
					return {
						ok: true,
						value: { state: memory.setDreamSettings({
							...record.enabled === void 0 ? {} : { enabled: record.enabled === true },
							...str("provider") === void 0 ? {} : { provider: str("provider") },
							...str("model") === void 0 ? {} : { model: str("model") },
							...str("dailyAt") === void 0 ? {} : { dailyAt: str("dailyAt") }
						}) }
					};
				} catch (error) {
					return internalError(`dream-set failed: ${String(error)}`);
				}
			}
			case "dream-run": {
				const memory = ctx.get("yzjMemory");
				if (memory === void 0) return internalError("dream-run: yzjMemory 服务不可用（memory-yzj 未挂载）");
				try {
					return {
						ok: true,
						value: await memory.dreamRun("panel")
					};
				} catch (error) {
					return internalError(`dream-run failed: ${String(error)}`);
				}
			}
			case "model-default": {
				const models = ctx.get("yzjModels");
				if (models === void 0) return internalError("model-default: yzjModels 服务不可用（model-yzj 未挂载）");
				return {
					ok: true,
					value: {
						route: models.get(),
						path: models.path
					}
				};
			}
			case "model-default-set": {
				const models = ctx.get("yzjModels");
				if (models === void 0) return internalError("model-default-set: yzjModels 服务不可用（model-yzj 未挂载）");
				const record = typeof payload === "object" && payload !== null ? payload : {};
				const provider = stringField(record, "provider");
				const model = stringField(record, "model");
				if (provider === void 0 || model === void 0) return internalError("model-default-set endpoint requires provider and model payloads");
				try {
					return {
						ok: true,
						value: { route: await models.setDefault(provider, model) }
					};
				} catch (error) {
					return internalError(`model-default-set failed: ${String(error)}`);
				}
			}
			case "model-default-clear": {
				const models = ctx.get("yzjModels");
				if (models === void 0) return internalError("model-default-clear: yzjModels 服务不可用（model-yzj 未挂载）");
				await models.clear();
				return {
					ok: true,
					value: { route: void 0 }
				};
			}
			case "model-catalog": {
				const models = ctx.get("yzjModels");
				if (models === void 0) return internalError("model-catalog: yzjModels 服务不可用（model-yzj 未挂载）");
				return {
					ok: true,
					value: { catalog: await models.catalog() }
				};
			}
			default: return internalError(`unknown /yzj endpoint ${endpoint}`);
		}
	};
}
/**
* Register the `/yzj` channel over the built handler.
* @param ctx - Cordis context carrying the connection and bridge services.
*/
function apply(ctx) {
	const handler = createRpcHandler(ctx, applyWriteGate(ctx));
	ctx.connection.rpc.handle("/yzj", handler, { authority: "loopback" });
}
//#endregion
export { apply, createRpcHandler, inject, name };
