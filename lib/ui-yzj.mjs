import { join } from "node:path";
import { z } from "zod";
import { defineDomain, domainTable } from "@deepseek-ai/dsh-storage-domain";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
//#region packages/tool-yzj/src/bound-log.ts
/**
* Durable bound-session message log (docs/spec/dsh-home-transcript.md).
* ① inbound / ② DSH-send live here — never as harness Session.append events.
* The fused VIEW merges this log with official session events by timestamp.
* @module @dsh-yzj/tool-yzj/bound-log
*/
const entrySchema = z.object({
	msgId: z.string().min(1),
	sentAt: z.number(),
	fromOpenId: z.string(),
	fromName: z.string(),
	content: z.string(),
	msgType: z.enum([
		"text",
		"richText",
		"file",
		"other"
	]),
	origin: z.enum([
		"inbound",
		"dsh-send",
		"backfill"
	]),
	isSelf: z.boolean(),
	replyMsgId: z.string().optional(),
	status: z.enum([
		"pending",
		"acked",
		"failed"
	]),
	param: z.record(z.string(), z.unknown()).optional()
});
const logSchema = z.object({
	yzjConversationId: z.string().min(1),
	dshSessionId: z.string().min(1),
	yzjKind: z.enum(["group", "dm"]),
	updatedAt: z.number(),
	entries: z.array(entrySchema)
});
defineDomain({
	name: "yzj_home_logs",
	version: 0,
	tables: { logs: domainTable(logSchema) }
});
/** Allocate an optimistic ② primary key. */
function localMsgId(now = Date.now()) {
	return `local-${now}`;
}
/** Parse CLI `sendTime` ("YYYY-MM-DD HH:mm:ss.SSS") into unix ms. */
function parseSendTime(text, fallback = Date.now()) {
	const value = typeof text === "string" ? text.trim() : "";
	if (value === "") return fallback;
	const normalized = value.includes("T") ? value : value.replace(" ", "T");
	const parsed = Date.parse(normalized);
	return Number.isFinite(parsed) ? parsed : fallback;
}
/** Coerce a CLI/robot msgType into the log vocabulary. */
function logMsgTypeOf(value) {
	const text = typeof value === "string" ? value : "";
	if (text === "richText" || text === "file" || text === "text" || text === "other") return text;
	if (text === "image" || text === "img") return "richText";
	return text === "" ? "text" : "other";
}
/** Digest one CLI message body (no binaries). */
function digestOfCliMessage(record) {
	const content = typeof record.content === "string" ? record.content : "";
	if (content !== "") return content;
	const msgType = logMsgTypeOf(record.msgType);
	const param = typeof record.param === "object" && record.param !== null ? record.param : {};
	if (msgType === "file") {
		const name = typeof param.name === "string" ? param.name : "";
		return name === "" ? "[文件]" : `[文件] ${name}`;
	}
	if (msgType === "richText") return content === "" ? "[图文]" : content;
	const title = typeof param.title === "string" ? param.title : "";
	return title === "" ? `[${msgType}]` : title;
}
/**
* Project one CLI `im message list` row into a log entry. Caller sets origin
* and isSelf; robot skip happens before append.
*/
function cliMessageToEntry(record, origin, selfOpenId) {
	const row = typeof record === "object" && record !== null ? record : {};
	const msgId = typeof row.msgId === "string" && row.msgId !== "" ? row.msgId : typeof row.id === "string" && row.id !== "" ? row.id : "";
	if (msgId === "") return void 0;
	const param = typeof row.param === "object" && row.param !== null ? row.param : {};
	const fromOpenId = typeof row.fromOpenId === "string" ? row.fromOpenId : typeof row.openId === "string" ? row.openId : "";
	const fromUser = typeof row.fromUser === "object" && row.fromUser !== null ? row.fromUser : {};
	const fromName = typeof row.fromName === "string" ? row.fromName : typeof fromUser.name === "string" ? fromUser.name : typeof row.userName === "string" ? row.userName : "";
	const replyMsgId = typeof param.replyMsgId === "string" && param.replyMsgId !== "" ? param.replyMsgId : typeof row.replyMsgId === "string" && row.replyMsgId !== "" ? row.replyMsgId : void 0;
	return {
		msgId,
		sentAt: parseSendTime(row.sendTime ?? row.time),
		fromOpenId,
		fromName,
		content: digestOfCliMessage(row),
		msgType: logMsgTypeOf(row.msgType),
		origin,
		isSelf: selfOpenId !== "" && fromOpenId === selfOpenId,
		status: "acked",
		...replyMsgId === void 0 ? {} : { replyMsgId },
		...Object.keys(param).length === 0 ? {} : { param }
	};
}
/** Unwrap CLI list envelopes (pitfall-003: bare array / list / data). */
function cliMessageList(json) {
	if (Array.isArray(json)) return json;
	if (typeof json !== "object" || json === null) return [];
	const record = json;
	if (Array.isArray(record.list)) return record.list;
	if (Array.isArray(record.data)) return record.data;
	if (typeof record.data === "object" && record.data !== null) {
		const inner = record.data;
		if (Array.isArray(inner.list)) return inner.list;
		if (Array.isArray(inner.messages)) return inner.messages;
	}
	if (Array.isArray(record.messages)) return record.messages;
	return [];
}
/** Extract the real msgId from an `im message send` CLI payload. */
function extractSendMsgId(json) {
	if (typeof json !== "object" || json === null) return void 0;
	const record = json;
	for (const key of [
		"msgId",
		"id",
		"messageId"
	]) {
		const value = record[key];
		if (typeof value === "string" && value !== "") return value;
	}
	if (typeof record.data === "object" && record.data !== null) {
		const inner = record.data;
		for (const key of [
			"msgId",
			"id",
			"messageId"
		]) {
			const value = inner[key];
			if (typeof value === "string" && value !== "") return value;
		}
	}
}
/** True when a user/message is a plugin followup trigger (spec §4.4) — hide in the fused view. */
function isPluginFollowup(event) {
	if (event.type !== "user/message") return false;
	const data = typeof event.data === "object" && event.data !== null ? event.data : {};
	return (typeof data.source === "object" && data.source !== null ? data.source : {}).kind === "plugin";
}
/**
* Merge ①② log rows with official ③④ events and write-gate pending.
* Ascending; same-ms IM before session (summon ① before its followup).
* Pending cards stick after the last session event with time ≤ pending.time.
*/
function mergeFused(entries, events, pending = []) {
	const items = [];
	for (const entry of entries) items.push({
		kind: "im",
		time: entry.sentAt,
		entry
	});
	for (const event of events) items.push({
		kind: "session",
		time: event.time,
		hide: isPluginFollowup(event),
		event
	});
	items.sort((left, right) => {
		if (left.time !== right.time) return left.time - right.time;
		const rank = (item) => item.kind === "im" ? 0 : item.kind === "session" ? 1 : 2;
		return rank(left) - rank(right);
	});
	const withPending = [...items];
	const orderedPending = [...pending].sort((a, b) => a.time - b.time);
	for (const card of orderedPending) {
		let insertAt = withPending.length;
		for (let index = withPending.length - 1; index >= 0; index -= 1) {
			const item = withPending[index];
			if (item !== void 0 && item.kind === "session" && item.time <= card.time) {
				insertAt = index + 1;
				break;
			}
		}
		withPending.splice(insertAt, 0, {
			kind: "pending",
			time: card.time,
			pending: card
		});
	}
	return withPending;
}
//#endregion
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
	if (toolName.startsWith("yzj_im_") || toolName === "robot_notify" || toolName === "robot_continue") return "im";
	if (toolName.startsWith("yzj_doc_workspace_")) return "kb";
	if (toolName.startsWith("yzj_doc_")) return "doc";
	if (toolName.startsWith("yzj_sheet_")) return "sheet";
	if (toolName.startsWith("yzj_todo_")) return "todo";
	if (toolName.startsWith("yzj_calendar_")) return "calendar";
	if (toolName.startsWith("yzj_file_")) return "file";
	return "other";
}
/** Tools this gate answers. yzj_* family plus bound-home robot group-push (D9). */
function isWriteGateTool(toolName) {
	return toolName.startsWith("yzj_") || toolName === "robot_notify" || toolName === "robot_continue";
}
/**
* True when the latest user/message is a real GUI turn. Empty logs and
* plugin followups are not GUI-focused — inbound ConfirmBroker keeps those.
*/
function latestUserIsGui(events) {
	return latestUserSource(events) === "user";
}
function latestUserSource(events) {
	for (let index = events.length - 1; index >= 0; index -= 1) {
		const event = events[index];
		if (event === void 0 || event.type !== "user/message") continue;
		const data = typeof event.data === "object" && event.data !== null ? event.data : {};
		return (typeof data.source === "object" && data.source !== null ? data.source : {}).kind === "plugin" ? "plugin" : "user";
	}
	return "none";
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
		if (!isWriteGateTool(req.toolName)) return next();
		if (req.agent.session.id.startsWith("yzj-robot-")) return next();
		if (ctx.get("yzjRobot")?.ownsConfirm?.(req.agent.session.id) === true && !latestUserIsGui(req.agent.session.events)) return next();
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
* Node-half home-open: bind one Yunzhijia conversation to exactly one DSH
* session, then resume-or-create that agent (pitfall-006). Structural agents
* face — this package must not import dsh-session (client/host one tsconfig).
* @module @dsh-yzj/ui-yzj/home-open
*/
/**
* Ensure the 1:1 binding and bring the bound agent up. Second open is focus
* (`created: false`) and must not mint a parallel session id.
*/
async function openBoundHome(options) {
	const yzjKind = options.yzjConversationId.startsWith("BOT-") ? "dm" : "group";
	const bound = await options.home.ensureBound(options.yzjConversationId, yzjKind);
	if (options.agents.get(bound.sessionId) !== void 0) return {
		sessionId: bound.sessionId,
		created: bound.created,
		yzjKind: bound.yzjKind,
		agentCreated: false
	};
	try {
		await options.agents.resume({ resumeSessionId: bound.sessionId });
		return {
			sessionId: bound.sessionId,
			created: bound.created,
			yzjKind: bound.yzjKind,
			agentCreated: false
		};
	} catch {
		await options.agents.create({
			sessionId: bound.sessionId,
			meta: { cwd: options.cwd }
		});
		return {
			sessionId: bound.sessionId,
			created: bound.created,
			yzjKind: bound.yzjKind,
			agentCreated: true
		};
	}
}
/**
* D8「丢进群」digest helpers: default is a user-selected visible summary.
* Full-transcript migrate is explicit. Pure — node RPC and client share it.
* @module @dsh-yzj/ui-yzj/handoff-digest
*/
/** Flatten one session event's text blocks (user/assistant only). */
function textOfSessionEvent(event) {
	if (event.type !== "user/message" && event.type !== "assistant/message") return "";
	const data = typeof event.data === "object" && event.data !== null ? event.data : {};
	const source = typeof data.source === "object" && data.source !== null ? data.source : {};
	if (event.type === "user/message" && source.kind === "plugin") return "";
	if (typeof data.content === "string") return data.content.trim();
	if (!Array.isArray(data.content)) return "";
	const parts = [];
	for (const block of data.content) {
		if (typeof block === "string") {
			if (block.trim() !== "") parts.push(block.trim());
			continue;
		}
		if (typeof block !== "object" || block === null) continue;
		const row = block;
		if (typeof row.text === "string" && row.text.trim() !== "") parts.push(row.text.trim());
	}
	return parts.join("\n").trim();
}
/** Visible private-transcript lines the user can tick (plugin followups omitted). */
function digestCandidates(events) {
	const out = [];
	for (let index = 0; index < events.length; index += 1) {
		const event = events[index];
		if (event === void 0) continue;
		const text = textOfSessionEvent(event);
		if (text === "") continue;
		out.push({
			id: `e${index}`,
			role: event.type === "assistant/message" ? "assistant" : "user",
			text,
			time: event.time
		});
	}
	return out;
}
/** True when `ctx.yzjHome` exposes the log face (partial fakes used in RPC tests do not). */
function homeIoFrom(home) {
	if (typeof home !== "object" || home === null) return void 0;
	const face = home;
	if (typeof face.ensureBound !== "function") return void 0;
	if (typeof face.appendLog !== "function") return void 0;
	if (typeof face.getBySession !== "function") return void 0;
	if (face.logs === void 0) return void 0;
	return face;
}
/** Login-user projection from `contact user get` (pitfall-003 envelopes). */
function parseWhoami(json) {
	const rows = Array.isArray(json) ? json : typeof json === "object" && json !== null && Array.isArray(json.list) ? json.list : typeof json === "object" && json !== null && Array.isArray(json.data) ? json.data : typeof json === "object" && json !== null ? [json] : [];
	const user = typeof rows[0] === "object" && rows[0] !== null ? rows[0] : {};
	return {
		openId: typeof user.openId === "string" && user.openId !== "" ? user.openId : typeof user.oId === "string" ? user.oId : "",
		name: typeof user.name === "string" ? user.name : ""
	};
}
/** Robot openIds to skip on backfill (T12). Surfaces carry robotId after inbound. */
function robotSkipOpenIds(robot) {
	const ids = /* @__PURE__ */ new Set();
	for (const channel of robot?.statuses?.() ?? []) for (const surface of channel.surface ?? []) if (typeof surface.robotId === "string" && surface.robotId !== "") ids.add(surface.robotId);
	return [...ids];
}
/** Validate one IM send payload. Error string on failure. */
function parseImSend(payload) {
	const record = typeof payload === "object" && payload !== null ? payload : {};
	const groupId = typeof record.groupId === "string" && record.groupId !== "" ? record.groupId : "";
	if (groupId === "") return "im-send endpoint requires a groupId payload";
	const msgType = typeof record.msgType === "string" && record.msgType !== "" ? record.msgType : "text";
	if (msgType !== "text" && msgType !== "richText" && msgType !== "file") return `im-send endpoint rejects msg-type "${msgType}"`;
	const content = typeof record.content === "string" && record.content !== "" ? record.content : void 0;
	const fileId = typeof record.fileId === "string" && record.fileId !== "" ? record.fileId : void 0;
	const fileName = typeof record.fileName === "string" && record.fileName !== "" ? record.fileName : void 0;
	const replyMsgId = typeof record.replyMsgId === "string" && record.replyMsgId !== "" ? record.replyMsgId : void 0;
	const rawImages = record.images;
	const images = Array.isArray(rawImages) ? rawImages.filter((item) => typeof item === "string" && item !== "") : [];
	if (msgType === "file") {
		if (fileId === void 0) return "im-send: msg-type file requires fileId";
		if (content !== void 0 || replyMsgId !== void 0 || images.length > 0) return "im-send: msg-type file does not support content, reply, or images";
	} else {
		if (content === void 0 || content.trim() === "") return "im-send: text/richText require non-empty content";
		if (content.length > 4e3) return "im-send: content over 4000 chars";
		if (msgType !== "richText" && images.length > 0) return "im-send: images are only supported for msg-type richText";
	}
	const rawAt = record.atOpenIds;
	const atOpenIds = Array.isArray(rawAt) ? rawAt.filter((item) => typeof item === "string" && item !== "") : [];
	const atAll = record.atAll === true;
	if (msgType !== "file") {
		const atNames = ((content ?? "").match(/@[^@\s，,、]+/g) ?? []).filter((frag) => frag !== "@all");
		if (atOpenIds.length !== atNames.length) return `im-send: atOpenIds (${atOpenIds.length}) must match the @姓名 fragments in content (${atNames.length}), in order`;
		if (atAll && !(content ?? "").includes("@all")) return "im-send: atAll requires an @all fragment in content";
	}
	return {
		groupId,
		msgType,
		images,
		atOpenIds,
		atAll,
		...content === void 0 ? {} : { content },
		...fileId === void 0 ? {} : { fileId },
		...fileName === void 0 ? {} : { fileName },
		...replyMsgId === void 0 ? {} : { replyMsgId }
	};
}
/** CLI argv for `im message send` (no shell interpolation). */
function imSendArgv(input) {
	const command = [
		"im",
		"message",
		"send",
		"--msg-type",
		input.msgType,
		"--group-id",
		input.groupId
	];
	if (input.content !== void 0) command.push("--content", input.content);
	if (input.fileId !== void 0) command.push("--file-id", input.fileId);
	if (input.replyMsgId !== void 0) command.push("--reply-msg-id", input.replyMsgId);
	for (const image of input.images) command.push("--image", image);
	for (const openId of input.atOpenIds) command.push("--at-open-id", openId);
	if (input.atAll) command.push("--at-all");
	return command;
}
function digestOfSend(input) {
	if (input.msgType === "file") {
		const name = input.fileName ?? "";
		return {
			content: name === "" ? "[文件]" : `[文件] ${name}`,
			msgType: "file"
		};
	}
	if (input.msgType === "richText") return {
		content: input.content ?? "[图文]",
		msgType: "richText"
	};
	return {
		content: input.content ?? "",
		msgType: "text"
	};
}
/** Persist enough CLI `param` for the fused IM renderer (file / images / quote). */
function paramOfSend(input) {
	const param = {};
	if (input.fileId !== void 0) param.file_id = input.fileId;
	if (input.fileName !== void 0) param.name = input.fileName;
	if (input.replyMsgId !== void 0) param.replyMsgId = input.replyMsgId;
	if (input.images.length > 0) {
		const start = (input.content ?? "").length;
		param.desc = input.images.map((fileId) => ({
			type: "image",
			data: fileId,
			start
		}));
	}
	return Object.keys(param).length === 0 ? void 0 : param;
}
/** Whoami via the bridge; empty on failure. */
async function whoamiOf(ctx) {
	try {
		const result = await ctx.yzjBridge.run([
			"contact",
			"user",
			"get"
		]);
		if (!result.ok) return {
			openId: "",
			name: ""
		};
		return parseWhoami(result.json);
	} catch {
		return {
			openId: "",
			name: ""
		};
	}
}
/**
* User-direct send: optimistic ② into the bound log, then CLI send, then
* ack/fail the local-* row. Never opens a DSH user-turn. Never a confirm card.
*/
async function sendImAndLog(ctx, home, input) {
	let sessionId;
	let localId;
	if (home !== void 0) {
		const kind = input.groupId.startsWith("BOT-") ? "dm" : "group";
		try {
			sessionId = (await home.ensureBound(input.groupId, kind)).sessionId;
		} catch (error) {
			return {
				ok: false,
				error: `home bind failed: ${String(error)}`
			};
		}
		const self = await whoamiOf(ctx);
		const digest = digestOfSend(input);
		const param = paramOfSend(input);
		localId = localMsgId();
		const entry = {
			msgId: localId,
			sentAt: Date.now(),
			fromOpenId: self.openId,
			fromName: self.name === "" ? "我" : self.name,
			content: digest.content,
			msgType: digest.msgType,
			origin: "dsh-send",
			isSelf: true,
			status: "pending",
			...input.replyMsgId === void 0 ? {} : { replyMsgId: input.replyMsgId },
			...param === void 0 ? {} : { param }
		};
		try {
			await home.appendLog(input.groupId, entry);
		} catch (error) {
			return {
				ok: false,
				error: `bound log append failed: ${String(error)}`
			};
		}
	}
	let result;
	try {
		result = await ctx.yzjBridge.run(imSendArgv(input));
	} catch (error) {
		if (home !== void 0 && localId !== void 0) await home.failLocal(input.groupId, localId);
		return {
			ok: false,
			error: `im message send failed: ${String(error)}；请确认已安装 yzj-cli 并完成 \`yzj-cli auth login\``
		};
	}
	if (!result.ok) {
		if (home !== void 0 && localId !== void 0) await home.failLocal(input.groupId, localId);
		return {
			ok: false,
			error: result.stderr.trim() === "" ? `im message send failed (exit ${result.exitCode})` : result.stderr.trim()
		};
	}
	const json = result.json ?? {};
	const realId = extractSendMsgId(json);
	if (home !== void 0 && localId !== void 0) {
		if (realId !== void 0) await home.ackLocal(input.groupId, localId, realId);
		else await home.ackLocal(input.groupId, localId, localId);
	}
	return {
		ok: true,
		value: json,
		...localId === void 0 ? {} : { localId },
		...sessionId === void 0 ? {} : { sessionId }
	};
}
/** Pull recent N Yunzhijia messages into the bound log (T9). */
async function backfillBoundLog(ctx, home, yzjConversationId, limit) {
	let binding = home.getByConversation(yzjConversationId);
	if (binding === void 0) {
		await home.ensureBound(yzjConversationId, yzjConversationId.startsWith("BOT-") ? "dm" : "group");
		binding = home.getByConversation(yzjConversationId);
	}
	if (binding === void 0) return {
		appended: 0,
		skipped: 0
	};
	const cap = Math.max(1, limit ?? home.logs.getLimits().backfillLimit);
	const self = await whoamiOf(ctx);
	const skip = robotSkipOpenIds(ctx.get("yzjRobot"));
	let appended = 0;
	let skipped = 0;
	let remaining = cap;
	let cursor;
	while (remaining > 0) {
		const page = Math.min(20, remaining);
		const command = [
			"im",
			"message",
			"list",
			"--group-id",
			yzjConversationId,
			"--limit",
			String(page)
		];
		if (cursor === void 0) command.push("--type", "newest");
		else command.push("--type", "old", "--msg-id", cursor);
		let result;
		try {
			result = await ctx.yzjBridge.run(command);
		} catch {
			break;
		}
		if (!result.ok) break;
		const rows = cliMessageList(result.json);
		if (rows.length === 0) break;
		const oldest = rows[0];
		const oldestId = typeof oldest === "object" && oldest !== null ? String(oldest.msgId ?? oldest.id ?? "") : "";
		for (const row of rows) {
			const entry = cliMessageToEntry(row, "backfill", self.openId);
			if (entry === void 0) {
				skipped += 1;
				continue;
			}
			if ((await home.appendLog(yzjConversationId, entry, { skipOpenIds: skip })).accepted) appended += 1;
			else skipped += 1;
		}
		remaining -= rows.length;
		if (rows.length < page || oldestId === "" || oldestId === cursor) break;
		cursor = oldestId;
	}
	return {
		appended,
		skipped
	};
}
function eventTime(event) {
	if (typeof event.time === "number") return event.time;
	if (typeof event.timestamp === "number") return event.timestamp;
	return 0;
}
/** Project host session events into the fused-view leaf shape. */
function sessionEventsOf(agent) {
	return (agent?.session?.events ?? []).map((event) => ({
		type: event.type,
		time: eventTime(event),
		data: event.data ?? {}
	}));
}
/** Pending write-gate rows for the fused overlay (G3 still host memory). */
function pendingOf(records) {
	return records.filter((record) => record.status === "pending").map((record) => ({
		writeId: record.writeId,
		time: record.time,
		toolName: record.toolName,
		status: record.status
	}));
}
/** One fused snapshot for a DSH session (unbound → bound:false). */
function fusedSnapshot(home, sessionId, agent, writes) {
	const events = sessionEventsOf(agent);
	const candidates = digestCandidates(events);
	const binding = home.getBySession(sessionId);
	if (binding === void 0) return {
		bound: false,
		items: [],
		candidates
	};
	const log = home.getLog(binding.yzjConversationId);
	const items = mergeFused(log?.entries ?? [], events, pendingOf(writes));
	return {
		bound: true,
		binding,
		...log === void 0 ? {} : { log },
		items,
		candidates
	};
}
/** Structural plugin user-turn (ui-yzj must not import dsh-llm — dual-face tsconfig). */
function pluginTurn(text) {
	return {
		role: "user",
		content: [{
			type: "text",
			text
		}],
		source: {
			kind: "plugin",
			plugin: "ui-yzj"
		}
	};
}
/**
* D8 handoff: bind the target group, post the confirmed digest as ②, then
* inject the summon window and followup so Claude continues as the group home.
*/
async function handoffToGroup(options) {
	if (options.digest.trim() === "") return { error: "home-handoff: digest is empty" };
	let opened;
	try {
		opened = await openBoundHome({
			home: options.home,
			agents: options.agents,
			yzjConversationId: options.groupId,
			cwd: options.cwd
		});
	} catch (error) {
		return { error: `home-handoff open failed: ${String(error)}` };
	}
	const sent = await sendImAndLog(options.ctx, options.home, {
		groupId: options.groupId,
		msgType: "text",
		content: options.digest,
		images: [],
		atOpenIds: [],
		atAll: false
	});
	if (!sent.ok) return { error: sent.error };
	const live = options.agents.get(opened.sessionId);
	const agent = typeof live === "object" && live !== null ? live : void 0;
	const window = options.home.formatSummonWindow(options.groupId);
	try {
		if (window !== "") agent?.inject?.(pluginTurn(window));
		agent?.followup?.(pluginTurn("用户从私密会话把工作丢进了本群。请基于群里刚发出的摘要，以本群共享身份继续协作。"));
	} catch (error) {
		return { error: `home-handoff followup failed: ${String(error)}` };
	}
	return {
		sessionId: opened.sessionId,
		created: opened.created
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
/** Structural agents face for home-open / handoff (never import dsh-session). */
function agentsFace(ctx) {
	const agentsRaw = ctx.get("agents");
	if (agentsRaw === void 0) return void 0;
	return {
		get: (id) => agentsRaw.get(id),
		resume: (opts) => agentsRaw.resume({ resumeSessionId: opts.resumeSessionId }),
		create: (opts) => agentsRaw.create({
			sessionId: opts.sessionId,
			...opts.meta === void 0 ? {} : { meta: opts.meta }
		})
	};
}
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
* `write-decide`, `home-open` / `home-send` / `home-fused` / `home-handoff`
* endpoints, all backed by the yzj-cli bridge, the write-gate, and `ctx.yzjHome`.
* Endpoint payloads are validated as lossless JSON before use.
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
				const parsed = parseImSend(payload);
				if (typeof parsed === "string") return internalError(parsed);
				const sent = await sendImAndLog(ctx, homeIoFrom(ctx.get("yzjHome")), parsed);
				if (!sent.ok) return internalError(sent.error);
				return {
					ok: true,
					value: sent.value
				};
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
						confirm: robot.confirmDiagnostics()
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
			case "home-open": {
				const home = ctx.get("yzjHome");
				if (home === void 0) return internalError("home-open: yzjHome 服务不可用（tool-yzj 未挂载）");
				const groupId = stringField(payload, "groupId") ?? stringField(payload, "yzjConversationId");
				if (groupId === void 0) return internalError("home-open endpoint requires a groupId payload");
				const agents = agentsFace(ctx);
				if (agents === void 0) return internalError("home-open: agents 服务不可用");
				try {
					const value = await openBoundHome({
						home,
						agents,
						yzjConversationId: groupId,
						cwd: process.cwd()
					});
					const io = homeIoFrom(home);
					if (io !== void 0) backfillBoundLog(ctx, io, groupId).catch(() => void 0);
					return {
						ok: true,
						value
					};
				} catch (error) {
					return internalError(`home-open failed: ${String(error)}`);
				}
			}
			case "home-binding": {
				const io = homeIoFrom(ctx.get("yzjHome"));
				if (io === void 0) return internalError("home-binding: yzjHome 服务不可用（tool-yzj 未挂载）");
				const sessionId = stringField(payload, "sessionId");
				const groupId = stringField(payload, "groupId");
				const binding = sessionId !== void 0 ? io.getBySession(sessionId) : groupId !== void 0 ? io.getByConversation(groupId) : void 0;
				return {
					ok: true,
					value: {
						bound: binding !== void 0,
						...binding === void 0 ? {} : { binding }
					}
				};
			}
			case "home-log": {
				const io = homeIoFrom(ctx.get("yzjHome"));
				if (io === void 0) return internalError("home-log: yzjHome 服务不可用（tool-yzj 未挂载）");
				const sessionId = stringField(payload, "sessionId");
				const groupId = stringField(payload, "groupId");
				return {
					ok: true,
					value: { log: (sessionId !== void 0 ? io.getLogBySession(sessionId) : groupId !== void 0 ? io.getLog(groupId) : void 0) ?? null }
				};
			}
			case "home-fused": {
				const io = homeIoFrom(ctx.get("yzjHome"));
				if (io === void 0) return internalError("home-fused: yzjHome 服务不可用（tool-yzj 未挂载）");
				const sessionId = stringField(payload, "sessionId");
				if (sessionId === void 0) return internalError("home-fused endpoint requires a sessionId payload");
				const agents = agentsFace(ctx);
				const writes = writeGate.list(sessionId);
				return {
					ok: true,
					value: fusedSnapshot(io, sessionId, agents?.get(sessionId), writes)
				};
			}
			case "home-backfill": {
				const io = homeIoFrom(ctx.get("yzjHome"));
				if (io === void 0) return internalError("home-backfill: yzjHome 服务不可用（tool-yzj 未挂载）");
				const sessionId = stringField(payload, "sessionId");
				const groupId = stringField(payload, "groupId") ?? (sessionId === void 0 ? void 0 : io.getBySession(sessionId)?.yzjConversationId);
				if (groupId === void 0) return internalError("home-backfill endpoint requires a groupId or bound sessionId");
				try {
					return {
						ok: true,
						value: await backfillBoundLog(ctx, io, groupId)
					};
				} catch (error) {
					return internalError(`home-backfill failed: ${String(error)}`);
				}
			}
			case "home-send": {
				const io = homeIoFrom(ctx.get("yzjHome"));
				if (io === void 0) return internalError("home-send: yzjHome 服务不可用（tool-yzj 未挂载）");
				const sessionId = stringField(payload, "sessionId");
				const bound = sessionId === void 0 ? void 0 : io.getBySession(sessionId);
				const groupId = stringField(payload, "groupId") ?? bound?.yzjConversationId;
				if (groupId === void 0) return internalError("home-send endpoint requires a bound sessionId or groupId");
				const parsed = parseImSend({
					...typeof payload === "object" && payload !== null ? payload : {},
					groupId
				});
				if (typeof parsed === "string") return internalError(parsed);
				const sent = await sendImAndLog(ctx, io, parsed);
				if (!sent.ok) return internalError(sent.error);
				return {
					ok: true,
					value: sent
				};
			}
			case "home-digest": {
				const sessionId = stringField(payload, "sessionId");
				if (sessionId === void 0) return internalError("home-digest endpoint requires a sessionId payload");
				return {
					ok: true,
					value: { candidates: digestCandidates(sessionEventsOf(agentsFace(ctx)?.get(sessionId))) }
				};
			}
			case "home-handoff": {
				const io = homeIoFrom(ctx.get("yzjHome"));
				if (io === void 0) return internalError("home-handoff: yzjHome 服务不可用（tool-yzj 未挂载）");
				const groupId = stringField(payload, "groupId");
				const digest = stringField(payload, "digest");
				if (groupId === void 0) return internalError("home-handoff endpoint requires a groupId payload");
				if (digest === void 0) return internalError("home-handoff endpoint requires a digest payload");
				const agents = agentsFace(ctx);
				if (agents === void 0) return internalError("home-handoff: agents 服务不可用");
				const result = await handoffToGroup({
					ctx,
					home: io,
					agents,
					groupId,
					digest,
					cwd: process.cwd()
				});
				if ("error" in result) return internalError(result.error);
				backfillBoundLog(ctx, io, groupId).catch(() => void 0);
				return {
					ok: true,
					value: result
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
