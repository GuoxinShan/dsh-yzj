import { basename, extname, isAbsolute, join, relative } from "node:path";
import { z } from "zod";
import { defineDomain, domainTable } from "@deepseek-ai/dsh-storage-domain";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
//#region packages/tool-yzj/src/topics.ts
/**
* Topic-session index: one Yunzhijia group room hosts 0..N agent topics
* (docs/spec/group-room-topics.md R1/R4). Anchor key is
* `(yzjConversationId, rootMsgId)`; outbound robot posts register so a
* reply chain continues the same topic.
* @module @dsh-yzj/tool-yzj/topics
*/
/**
* Synthetic root for pre-v2.0 ③④ left on the group-room host
* (docs/spec/group-room-topics.md H9). Stable `topicSessionId` slug.
*/
const LEGACY_HOST_ROOT = "legacy-host";
/** Sidebar / drawer title for {@link LEGACY_HOST_ROOT}. */
const LEGACY_HOST_TITLE = "历史对话";
const topicSchema = z.object({
	dshSessionId: z.string().min(1),
	yzjConversationId: z.string().min(1),
	title: z.string(),
	source: z.enum([
		"dsh",
		"yzj",
		"handoff"
	]),
	createdAt: z.number(),
	lastActivity: z.number().optional(),
	status: z.enum([
		"running",
		"confirm",
		"done"
	]).optional(),
	rootMsgId: z.string().optional(),
	originWho: z.string().optional(),
	originText: z.string().optional(),
	originTime: z.number().optional(),
	fromSessionId: z.string().optional()
});
const sessionIndexSchema = z.object({ yzjConversationId: z.string().min(1) });
const groupIndexSchema = z.object({ ids: z.array(z.string()) });
defineDomain({
	name: "yzj_topic_anchors",
	version: 0,
	tables: {
		topics: domainTable(topicSchema),
		sessions: domainTable(sessionIndexSchema),
		outbound: domainTable(z.object({ dshSessionId: z.string().min(1) })),
		groups: domainTable(groupIndexSchema),
		anchors: domainTable(z.object({ dshSessionId: z.string().min(1) }))
	}
});
//#endregion
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
		"backfill",
		"robot-outbound"
	]),
	isSelf: z.boolean(),
	replyMsgId: z.string().optional(),
	topicSessionId: z.string().optional(),
	param: z.record(z.string(), z.unknown()).optional(),
	status: z.enum([
		"pending",
		"acked",
		"failed"
	])
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
const PARAM_KEEP = [
	"file_id",
	"name",
	"size",
	"ext",
	"desc",
	"replyMsgId",
	"replySummary",
	"replyPersonName",
	"title",
	"thumbUrl",
	"webpageUrl",
	"sysType",
	"interactiveCard"
];
const PARAM_JSON_MAX = 8192;
/**
* Keep the renderer-facing CLI param keys. Drop binaries and oversized
* adaptive-card JSON so the durable log stays a digest.
*/
function clipLogParam(raw) {
	if (raw === void 0) return void 0;
	const out = {};
	for (const key of PARAM_KEEP) {
		const value = raw[key];
		if (value !== void 0) out[key] = value;
	}
	if (Object.keys(out).length === 0) return void 0;
	let text = JSON.stringify(out);
	if (text.length > PARAM_JSON_MAX) {
		delete out.interactiveCard;
		text = JSON.stringify(out);
	}
	if (text.length > PARAM_JSON_MAX) return void 0;
	return out;
}
function firstNonEmpty$1(...values) {
	for (const value of values) if (typeof value === "string" && value !== "") return value;
	return "";
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
	const fromUser = typeof row.fromUser === "object" && row.fromUser !== null ? row.fromUser : {};
	const fromOpenId = firstNonEmpty$1(row.fromOpenId, row.openId, fromUser.openId, fromUser.oId);
	const fromName = firstNonEmpty$1(row.fromName, fromUser.name, fromUser.userName, fromUser.nickName, row.userName);
	const replyMsgId = typeof param.replyMsgId === "string" && param.replyMsgId !== "" ? param.replyMsgId : typeof row.replyMsgId === "string" && row.replyMsgId !== "" ? row.replyMsgId : void 0;
	const clipped = clipLogParam(param);
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
		...clipped === void 0 ? {} : { param: clipped }
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
/** Latest user/message source kind on a session log (write-gate split). */
function latestUserSourceKind(events) {
	for (let index = events.length - 1; index >= 0; index -= 1) {
		const event = events[index];
		if (event === void 0 || event.type !== "user/message") continue;
		const data = typeof event.data === "object" && event.data !== null ? event.data : {};
		return (typeof data.source === "object" && data.source !== null ? data.source : {}).kind === "plugin" ? "plugin" : "user";
	}
	return "none";
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
	/**
	* P3 / L2 / L5: a topic with a live confirmation (pending or approved-not-
	* yet-done) is 待确认; after cancel or delivery it falls back to 进行中.
	* Explicit `done` is left alone unless a new pending write appears.
	*/
	const syncTopicStatus = (sessionId) => {
		if (!sessionId.startsWith("yzj-topic-")) return;
		const home = ctx.get("yzjHome");
		const row = home?.getTopicBySession?.(sessionId);
		const setStatus = home?.setTopicStatus;
		if (row === void 0 || setStatus === void 0) return;
		const blocking = [...records.values(), ...settled].some((item) => item.sessionId === sessionId && (item.status === "pending" || item.status === "approved"));
		const current = row.status === "confirm" || row.status === "done" ? row.status : "running";
		if (blocking) {
			if (current !== "confirm") setStatus(sessionId, "confirm");
			return;
		}
		if (current === "confirm") setStatus(sessionId, "running");
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
				syncTopicStatus(record.sessionId);
				resolve(outcome);
			};
			const onAbort = () => {
				settle("cancelled");
			};
			record.resolve = settle;
			record.removeAbort = () => req.signal?.removeEventListener("abort", onAbort);
			req.signal?.addEventListener("abort", onAbort, { once: true });
			records.set(record.writeId, record);
			syncTopicStatus(req.agent.session.id);
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
		for (const record of records.values()) if (apply(record)) {
			syncTopicStatus(record.sessionId);
			return;
		}
		for (const record of settled) if (apply(record)) {
			syncTopicStatus(record.sessionId);
			return;
		}
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
/** Compose the group-visible digest. `migrateFull` is the explicit rare path. */
function composeHandoffDigest(candidates, selectedIds, migrateFull) {
	const rows = migrateFull ? [...candidates] : candidates.filter((row) => selectedIds.includes(row.id));
	if (rows.length === 0) return "";
	const lines = rows.map((row) => {
		return `${row.role === "assistant" ? "助手" : "用户"}：${row.text}`;
	});
	return `${migrateFull ? "［私密会话全文迁移（用户显式确认）］" : "［私密会话摘要（用户勾选）］"}\n${lines.join("\n\n")}`;
}
/**
* Node-half home-open: bind one Yunzhijia conversation to exactly one DSH
* session, then resume-or-create that agent (pitfall-006). Structural agents
* face — this package must not import dsh-session (client/host one tsconfig).
* @module @dsh-yzj/ui-yzj/home-open
*/
/**
* Route for a host-created topic agent. Web GUI sessions get `{{model}}` from
* apiproxy's picker; `ctx.agents.create` from this plugin does not. Prefer the
* plugin default, then the harness default-model service (pitfall-006 / 026).
*/
function topicAgentRoute(ctx) {
	const fromYzj = ctx.get("yzjModels")?.get?.();
	if (fromYzj !== void 0 && fromYzj.provider !== void 0 && fromYzj.provider !== "" && fromYzj.model !== void 0 && fromYzj.model !== "") return {
		provider: fromYzj.provider,
		model: fromYzj.model
	};
	const sel = ctx.get("agentDefaultModel")?.currentSelection?.();
	if (sel !== void 0 && sel.provider !== void 0 && sel.provider !== "" && sel.model !== void 0 && sel.model !== "") return {
		provider: sel.provider,
		model: sel.model
	};
}
/** Identified user-role payload. Session replay requires `message.id` (pitfall-026). */
function identifiedUserMessage(text, source) {
	return {
		id: crypto.randomUUID(),
		role: "user",
		content: [{
			type: "text",
			text
		}],
		source
	};
}
/**
* Pin a host title. Rooms seed a closed empty turn 1 so harness treats them
* as a real conversation canvas (`conversation.view` / tab ring). Blank
* 「新会话」rows vanish when not current — but they also have no tab ring,
* so the IM workbench cannot mount (R14). Topics must not seed that turn
* (pitfall-025 / R25).
* @param replace - write even when a title already exists (topic retitle).
* @param seedEmptyTurn - write the closed empty turn 1. Rooms yes; topics no.
*/
function publishHostSession(agent, title, replace = false, seedEmptyTurn = true) {
	const session = sessionOf(agent);
	if (session?.append === void 0) return;
	const events = session.events ?? [];
	if (seedEmptyTurn && !events.some((event) => event.type === "turn/start")) {
		session.append("turn/start", { turn: 1 });
		session.append("turn/end", {
			turn: 1,
			reason: { kind: "completed" }
		});
	}
	const trimmed = title.trim().slice(0, 80);
	if (trimmed === "") return;
	const current = lastSessionTitle(events);
	if (current === trimmed) return;
	const upgrading = isPlaceholderRoomTitle(current) && !isPlaceholderRoomTitle(trimmed);
	if (current !== "" && !replace && !upgrading) return;
	session.append("session/title", {
		title: trimmed,
		messageSeqs: [],
		source: { kind: "user" }
	});
}
/**
* Sidebar label for a topic: topic title first, group as suffix. The former
* group-first order truncated to identical 「群名·【…」 rows in the narrow
* sidebar — the distinguishing part must lead (R12 修订, gap-analysis).
*/
function topicSidebarTitle(groupName, topicTitle) {
	const topic = topicTitle.trim() || "话题";
	const group = groupName.trim();
	if (group === "" || topic === group) return topic.slice(0, 80);
	if (topic.startsWith(`${group} · `) || topic.endsWith(` · ${group}`)) return topic.slice(0, 80);
	return `${topic} · ${group}`.slice(0, 80);
}
/** Last `session/title` in a host event log (sidebar / workbench labels). */
function lastSessionTitle(events) {
	for (let index = events.length - 1; index >= 0; index -= 1) {
		const event = events[index];
		if (event?.type !== "session/title") continue;
		const data = event.data;
		if (typeof data === "object" && data !== null) {
			const title = data.title;
			if (typeof title === "string") return title.trim();
		}
	}
	return "";
}
/** Fallback titles used when home-open had no CLI group name. */
function isPlaceholderRoomTitle(title) {
	return title === "群房间" || title === "私聊房间";
}
function sessionOf(agent) {
	if (typeof agent !== "object" || agent === null) return void 0;
	const rec = agent;
	const inner = rec.agent;
	return (typeof inner === "object" && inner !== null ? inner : rec).session;
}
/** True when the host log has real assistant work, not just R14 empty turns. */
function hostHasLegacyTurns(events) {
	return events.some((event) => event.type === "user/message" || event.type === "assistant/message" || event.type === "tool/call");
}
function pluginContextTurn(text) {
	return identifiedUserMessage(text, {
		kind: "plugin",
		plugin: "ui-yzj"
	});
}
/**
* Mint-or-focus the H9 「历史对话」 topic. Does not copy Session events;
* the lens reads `fromSessionId`. Injects a plugin digest so the model can
* continue. No-op for DMs, blank hosts, or a home face without topics.
*/
async function maybeMigrateLegacyHost(options) {
	if (options.yzjKind === "dm" || options.home.ensureTopic === void 0) return void 0;
	const events = sessionOf(options.agents.get(options.hostSessionId))?.events ?? [];
	if (!hostHasLegacyTurns(events)) return void 0;
	let lastActivity = 0;
	for (const event of events) {
		const time = event.time ?? 0;
		if (time > lastActivity) lastActivity = time;
	}
	const opened = await openTopicHome({
		home: options.home,
		agents: options.agents,
		yzjConversationId: options.yzjConversationId,
		cwd: options.cwd,
		source: "handoff",
		rootMsgId: LEGACY_HOST_ROOT,
		title: LEGACY_HOST_TITLE,
		fromSessionId: options.hostSessionId,
		groupName: options.groupName,
		quiet: true,
		lastActivity: lastActivity > 0 ? lastActivity : 1,
		...options.agentOptions === void 0 ? {} : { agentOptions: options.agentOptions }
	});
	if (opened.topicCreated) {
		const digest = composeHandoffDigest(digestCandidates(events.map((event) => ({
			type: event.type,
			time: event.time ?? 0,
			data: event.data ?? {}
		}))), [], true);
		if (digest !== "") options.agents.get(opened.sessionId)?.inject?.(pluginContextTurn(`以下是本群房间升级前的助手对话，请接续。\n${digest}`));
	}
	return opened.sessionId;
}
/**
* Ensure the 1:1 binding and bring the bound agent up. Second open is focus
* (`created: false`) and must not mint a parallel session id. Group rooms
* with leftover ③④ mint 「历史对话」 (H9).
*/
async function openBoundHome(options) {
	const yzjKind = options.yzjConversationId.startsWith("BOT-") ? "dm" : "group";
	const bound = await options.home.ensureBound(options.yzjConversationId, yzjKind);
	const title = options.title?.trim() || (yzjKind === "dm" ? "私聊房间" : "群房间");
	const finish = async (agentCreated) => {
		const legacyTopicSessionId = await maybeMigrateLegacyHost({
			home: options.home,
			agents: options.agents,
			yzjConversationId: options.yzjConversationId,
			cwd: options.cwd,
			yzjKind,
			hostSessionId: bound.sessionId,
			groupName: title,
			...options.agentOptions === void 0 ? {} : { agentOptions: options.agentOptions }
		});
		return {
			sessionId: bound.sessionId,
			created: bound.created,
			yzjKind: bound.yzjKind,
			agentCreated,
			...legacyTopicSessionId === void 0 ? {} : { legacyTopicSessionId }
		};
	};
	if (options.agents.get(bound.sessionId) !== void 0) {
		publishHostSession(options.agents.get(bound.sessionId), title);
		return finish(false);
	}
	try {
		publishHostSession(await options.agents.resume({ resumeSessionId: bound.sessionId }) ?? options.agents.get(bound.sessionId), title);
		return finish(false);
	} catch {
		publishHostSession(await options.agents.create({
			sessionId: bound.sessionId,
			meta: { cwd: options.cwd }
		}) ?? options.agents.get(bound.sessionId), title);
		return finish(true);
	}
}
/**
* Mint or focus a topic session under a group room, then resume-or-create
* that agent (pitfall-006). Same root is focus, never a parallel id.
*/
async function openTopicHome(options) {
	if (options.home.ensureTopic === void 0) return {
		...await openBoundHome(options),
		topicCreated: false
	};
	const yzjKind = options.yzjConversationId.startsWith("BOT-") ? "dm" : "group";
	const bound = await options.home.ensureBound(options.yzjConversationId, yzjKind);
	const topic = await options.home.ensureTopic({
		yzjConversationId: options.yzjConversationId,
		source: options.source,
		...options.rootMsgId === void 0 ? {} : { rootMsgId: options.rootMsgId },
		...options.originWho === void 0 ? {} : { originWho: options.originWho },
		...options.originText === void 0 ? {} : { originText: options.originText },
		...options.title === void 0 ? {} : { title: options.title },
		...options.fromSessionId === void 0 ? {} : { fromSessionId: options.fromSessionId },
		...options.quiet === true ? { quiet: true } : {},
		...options.lastActivity === void 0 ? {} : { lastActivity: options.lastActivity }
	});
	const title = topicSidebarTitle(options.groupName?.trim() || lastSessionTitle(sessionOf(options.agents.get(bound.sessionId))?.events ?? []), options.title?.trim() || options.originText?.trim().slice(0, 40) || "话题");
	const publish = (agent) => {
		publishHostSession(agent, title, true, false);
	};
	if (options.agents.get(topic.sessionId) !== void 0) {
		publish(options.agents.get(topic.sessionId));
		return {
			sessionId: topic.sessionId,
			created: topic.created,
			yzjKind,
			agentCreated: false,
			topicCreated: topic.created
		};
	}
	try {
		publish(await options.agents.resume({
			resumeSessionId: topic.sessionId,
			...options.agentOptions === void 0 ? {} : { agentOptions: options.agentOptions }
		}) ?? options.agents.get(topic.sessionId));
		return {
			sessionId: topic.sessionId,
			created: topic.created,
			yzjKind,
			agentCreated: false,
			topicCreated: topic.created
		};
	} catch {
		publish(await options.agents.create({
			sessionId: topic.sessionId,
			meta: { cwd: options.cwd },
			...options.agentOptions === void 0 ? {} : { agentOptions: options.agentOptions }
		}) ?? options.agents.get(topic.sessionId));
		return {
			sessionId: topic.sessionId,
			created: topic.created,
			yzjKind,
			agentCreated: true,
			topicCreated: topic.created
		};
	}
}
/**
* Contact payload unwrap (pitfall-003: bare array / list / data / single object).
* Shared by host whoami and the browser sender-name cache.
*/
function asRecord$2(value) {
	return typeof value === "object" && value !== null ? value : {};
}
function firstNonEmpty(...values) {
	for (const value of values) if (typeof value === "string" && value !== "") return value;
	return "";
}
function rowsOf(json) {
	if (Array.isArray(json)) return json;
	const record = asRecord$2(json);
	if (Array.isArray(record.list)) return record.list;
	if (Array.isArray(record.data)) return record.data;
	if (typeof record.data === "object" && record.data !== null) {
		const inner = asRecord$2(record.data);
		if (Array.isArray(inner.list)) return inner.list;
	}
	return Object.keys(record).length === 0 ? [] : [json];
}
/** Parse `contact user get` JSON into openId / name / photoUrl. */
function parseContactUser(json) {
	const user = asRecord$2(rowsOf(json)[0]);
	return {
		openId: firstNonEmpty(user.openId, user.oId),
		name: firstNonEmpty(user.name, user.userName, user.nickName),
		photoUrl: firstNonEmpty(user.photoUrl, user.photo, user.avatar)
	};
}
/**
* File-type badge for IM / topic-lens artifact cards. Pure — host and
* browser halves share it (no node, no React).
* @module @dsh-yzj/ui-yzj/artifact-badge
*/
const WRITE_TOOLS$1 = /* @__PURE__ */ new Set(["write", "edit"]);
function asRecord$1(value) {
	return typeof value === "object" && value !== null ? value : {};
}
function asString$1(value) {
	return typeof value === "string" ? value : "";
}
function parseToolArgs$1(raw) {
	if (typeof raw === "string") try {
		return asRecord$1(JSON.parse(raw));
	} catch {
		return {};
	}
	return asRecord$1(raw);
}
/** Basename of a workspace path (`a/b.md` → `b.md`). */
function fileBaseName(filePath) {
	const trimmed = filePath.trim().replace(/\\/g, "/");
	if (trimmed === "") return "";
	const parts = trimmed.split("/");
	return parts[parts.length - 1] ?? "";
}
/** `write` / `edit` `file_path` basename from one `tool/call` data blob. */
function writeFileNameOf(data) {
	const rec = asRecord$1(data);
	const name = asString$1(rec.name);
	if (!WRITE_TOOLS$1.has(name)) return void 0;
	const base = fileBaseName(asString$1(parseToolArgs$1(rec.arguments).file_path));
	return base === "" ? void 0 : base;
}
/** Type chip + display name for a file (MD → DOC, png → IMG, …). */
function artifactBadgeOf(fileName) {
	const name = fileName.trim();
	const ext = (name.includes(".") ? name.slice(name.lastIndexOf(".") + 1) : "").toUpperCase();
	return {
		type: /^(MD|TXT|DOC|DOCX)$/.test(ext) ? "DOC" : /^(XLS|XLSX|CSV)$/.test(ext) ? "XLS" : ext === "PDF" ? "PDF" : /^(PNG|JPG|JPEG|GIF|WEBP|BMP|SVG)$/.test(ext) ? "IMG" : ext === "" ? "FILE" : ext,
		name: name === "" ? "文件" : name
	};
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
	const user = parseContactUser(json);
	return {
		openId: user.openId,
		name: user.name
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
const contactNameCache = /* @__PURE__ */ new Map();
/** Directory lookup for an empty fromName. Process-local cache keyed by openId. */
async function contactNameOf(ctx, openId) {
	if (openId === "") return "";
	const cached = contactNameCache.get(openId);
	if (cached !== void 0) return cached;
	try {
		const result = await ctx.yzjBridge.run([
			"contact",
			"user",
			"get",
			"--open-id",
			openId
		]);
		if (!result.ok) return "";
		const name = parseWhoami(result.json).name;
		if (name !== "") contactNameCache.set(openId, name);
		return name;
	} catch {
		return "";
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
		localId = localMsgId();
		const sendParam = clipLogParam({
			...input.replyMsgId === void 0 ? {} : { replyMsgId: input.replyMsgId },
			...input.msgType === "file" ? {
				file_id: input.fileId ?? "",
				name: input.fileName ?? "",
				ext: (input.fileName ?? "").split(".").pop() ?? ""
			} : {},
			...input.msgType === "richText" && input.images.length > 0 ? { desc: input.images.map((fileId) => ({
				type: "image",
				data: fileId,
				start: (input.content ?? "").indexOf("[图片]"),
				length: 4
			})) } : {}
		});
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
			...input.topicSessionId === void 0 ? {} : { topicSessionId: input.topicSessionId },
			...sendParam === void 0 ? {} : { param: sendParam }
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
async function backfillBoundLog(ctx, home, yzjConversationId, limit, beforeMsgId) {
	let binding = home.getByConversation(yzjConversationId);
	if (binding === void 0) {
		await home.ensureBound(yzjConversationId, yzjConversationId.startsWith("BOT-") ? "dm" : "group");
		binding = home.getByConversation(yzjConversationId);
	}
	if (binding === void 0) return {
		appended: 0,
		skipped: 0,
		more: false
	};
	const cap = Math.max(1, limit ?? home.logs.getLimits().backfillLimit);
	const self = await whoamiOf(ctx);
	const skip = robotSkipOpenIds(ctx.get("yzjRobot"));
	let appended = 0;
	let skipped = 0;
	let remaining = cap;
	let cursor = beforeMsgId;
	let more = false;
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
		if (rows.length === 0) {
			more = false;
			break;
		}
		const oldest = rows[0];
		const oldestId = typeof oldest === "object" && oldest !== null ? String(oldest.msgId ?? oldest.id ?? "") : "";
		more = rows.length === page;
		for (const row of rows) {
			const parsed = cliMessageToEntry(row, "backfill", self.openId);
			if (parsed === void 0) {
				skipped += 1;
				continue;
			}
			const filledName = parsed.fromName === "" && parsed.fromOpenId !== "" ? await contactNameOf(ctx, parsed.fromOpenId) : parsed.fromName;
			const entry = filledName === parsed.fromName ? parsed : {
				...parsed,
				fromName: filledName
			};
			const robotHit = skip.includes(entry.fromOpenId);
			const topic = home.getTopicByOutbound?.(entry.msgId);
			const incoming = robotHit ? {
				...entry,
				origin: "robot-outbound",
				isSelf: false,
				fromName: entry.fromName === "" ? "助手" : entry.fromName,
				...topic === void 0 ? {} : { topicSessionId: topic.dshSessionId }
			} : entry;
			if ((await home.appendLog(yzjConversationId, incoming)).accepted) appended += 1;
			else skipped += 1;
		}
		remaining -= rows.length;
		if (rows.length < page || oldestId === "" || oldestId === cursor) {
			more = rows.length === page && oldestId !== "" && oldestId !== cursor;
			break;
		}
		cursor = oldestId;
	}
	return {
		appended,
		skipped,
		more
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
	const topic = home.getTopicBySession?.(sessionId);
	const binding = home.getBySession(sessionId) ?? (topic === void 0 ? void 0 : home.getByConversation(topic.yzjConversationId));
	if (binding === void 0) return {
		bound: false,
		items: [],
		candidates,
		topics: []
	};
	const log = home.getLog(binding.yzjConversationId);
	const items = mergeFused(log?.entries ?? [], events, pendingOf(writes));
	const topics = home.listTopics?.(binding.yzjConversationId) ?? [];
	const pinned = lastSessionTitle(events);
	const groupName = pinned !== "" && !isPlaceholderRoomTitle(pinned) ? pinned : "";
	return {
		bound: true,
		binding,
		...log === void 0 ? {} : { log },
		items,
		candidates,
		topics,
		...groupName === "" ? {} : { groupName }
	};
}
/** Group-room VIEW: IM rows + topic list, no ③④ (R2). */
function roomSnapshot(home, sessionId) {
	const topic = home.getTopicBySession?.(sessionId);
	if (topic !== void 0) {
		const binding = home.getByConversation(topic.yzjConversationId);
		return {
			bound: true,
			kind: "topic",
			...binding === void 0 ? {} : { binding },
			topic,
			topics: home.listTopics?.(topic.yzjConversationId) ?? [],
			items: []
		};
	}
	const binding = home.getBySession(sessionId);
	if (binding === void 0) return {
		bound: false,
		kind: "unbound",
		topics: [],
		items: []
	};
	const items = (home.getLog(binding.yzjConversationId)?.entries ?? []).map((entry) => ({
		kind: "im",
		time: entry.sentAt,
		entry
	}));
	return {
		bound: true,
		kind: "room",
		binding,
		topics: home.listTopics?.(binding.yzjConversationId) ?? [],
		items
	};
}
/**
* IM snapshot keyed by Yunzhijia group id (R24). Does not need a live
* agent — the plugin log is the timeline. Missing binding still returns a
* room row so the workbench can paint before ensureBound.
*/
function roomSnapshotForGroup(home, groupId) {
	const binding = home.getByConversation(groupId);
	const items = (home.getLog(groupId)?.entries ?? []).map((entry) => ({
		kind: "im",
		time: entry.sentAt,
		entry
	}));
	const yzjKind = groupId.startsWith("BOT-") ? "dm" : "group";
	return {
		bound: true,
		kind: "room",
		binding: binding ?? {
			dshSessionId: "",
			yzjConversationId: groupId,
			yzjKind
		},
		topics: home.listTopics?.(groupId) ?? [],
		items
	};
}
const LENS_MAX_ARTIFACTS = 8;
function uniqueWriteNames(names) {
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const name of names) {
		if (seen.has(name)) continue;
		seen.add(name);
		out.push(name);
		if (out.length >= LENS_MAX_ARTIFACTS) break;
	}
	return out;
}
function badgesOf(names) {
	return uniqueWriteNames(names).map((name) => artifactBadgeOf(name));
}
/**
* Walk one session's events into lens bubbles. `write`/`edit` files ride
* the next assistant bubble (leftover names attach to the last assistant).
*/
function lensBubblesFromEvents(events, idPrefix) {
	const out = [];
	let pending = [];
	const flushWrites = (bubble) => {
		if (pending.length === 0) return bubble;
		const extras = badgesOf(pending);
		pending = [];
		const prior = bubble.artifacts ?? [];
		return {
			...bubble,
			artifacts: [...prior, ...extras]
		};
	};
	for (const event of events) {
		if (event.type === "tool/call") {
			const name = writeFileNameOf(event.data);
			if (name !== void 0) pending.push(name);
			continue;
		}
		const text = textOfSessionEvent(event);
		if (text === "") continue;
		const role = event.type === "assistant/message" ? "assistant" : "user";
		let bubble = {
			id: `${idPrefix}${out.length}`,
			role,
			text,
			time: event.time
		};
		if (role === "assistant") bubble = flushWrites(bubble);
		out.push(bubble);
	}
	if (pending.length === 0) return out;
	for (let index = out.length - 1; index >= 0; index -= 1) {
		const row = out[index];
		if (row?.role !== "assistant") continue;
		out[index] = flushWrites(row);
		return out;
	}
	out.push({
		id: `${idPrefix}${out.length}`,
		role: "assistant",
		text: "产物",
		time: events[events.length - 1]?.time ?? 0,
		artifacts: badgesOf(pending)
	});
	return out;
}
/**
* Lens stream: topic session events, plus leftover host ③④ when this is
* the H9 「历史对话」 topic (`fromSessionId`). Plugin injects stay hidden.
* Write/edit files appear on the assistant bubble (R27) as DSH-local
* cards. Job-done (R26) still uploads and posts the same files to the
* group; the lens does not replace that send.
*/
function topicLensBubbles(topic, agents) {
	const fromHost = topic.fromSessionId === void 0 || topic.fromSessionId === "" ? [] : lensBubblesFromEvents(sessionEventsOf(agents.get(topic.fromSessionId)), "h");
	const fromTopic = lensBubblesFromEvents(sessionEventsOf(agents.get(topic.dshSessionId)), "t");
	return [...fromHost, ...fromTopic].sort((a, b) => a.time - b.time);
}
/** User-authored followup (drawer 「问助手」). Visible in the lens. Must carry `id`. */
function userTurn(text) {
	return identifiedUserMessage(text, { kind: "user" });
}
/**
* Ask the topic agent without focusing native Chat. Resume-or-create the
* topic session, inject the summon window (pitfall-027), then `followup`
* a user turn (H18). Opening the topic does not start a turn.
*/
async function askTopicAssistant(options) {
	const text = options.text.trim();
	if (text === "") return { error: "home-topic-ask: text is empty" };
	const topic = options.home.getTopicBySession?.(options.topicSessionId);
	if (topic === void 0) return { error: "home-topic-ask: not a topic session" };
	if (options.agents.get(options.topicSessionId) === void 0) try {
		await options.agents.resume({
			resumeSessionId: options.topicSessionId,
			...options.agentOptions === void 0 ? {} : { agentOptions: options.agentOptions }
		});
	} catch {
		await options.agents.create({
			sessionId: options.topicSessionId,
			meta: { cwd: options.cwd },
			...options.agentOptions === void 0 ? {} : { agentOptions: options.agentOptions }
		});
	}
	const live = options.agents.get(options.topicSessionId);
	if (live?.followup === void 0) return { error: "home-topic-ask: agent followup unavailable" };
	const window = options.home.formatSummonWindow(topic.yzjConversationId, void 0, options.topicSessionId);
	if (window !== "") live.inject?.(pluginTurn(window));
	live.followup(userTurn(text));
	if (topic.rootMsgId !== void 0 && topic.rootMsgId !== "" && options.home.ensureTopic !== void 0) await options.home.ensureTopic({
		yzjConversationId: topic.yzjConversationId,
		source: topic.source,
		rootMsgId: topic.rootMsgId
	});
	return { ok: true };
}
/**
* Bound-room snapshot: every binding as a parent plus its topics (L1 merge).
* Group display name prefers the pinned host `session/title`.
*/
function groupSpaceSnapshot(home, agents) {
	return { rooms: (home.listBindings?.() ?? []).map((binding) => {
		const topics = (home.listTopics?.(binding.yzjConversationId) ?? []).map((topic) => ({
			sessionId: topic.dshSessionId,
			title: topic.title,
			source: topic.source,
			lastActivity: topic.lastActivity ?? topic.createdAt,
			status: topic.status === "confirm" || topic.status === "done" ? topic.status : "running",
			...topic.rootMsgId === void 0 ? {} : { rootMsgId: topic.rootMsgId },
			...topic.originWho === void 0 ? {} : { originWho: topic.originWho },
			...topic.originText === void 0 ? {} : { originText: topic.originText },
			...topic.originTime === void 0 ? {} : { originTime: topic.originTime }
		}));
		const pinned = lastSessionTitle(agents?.get(binding.dshSessionId)?.session?.events ?? []);
		const groupName = pinned !== "" && !isPlaceholderRoomTitle(pinned) ? pinned : binding.yzjKind === "dm" ? "私聊房间" : "群房间";
		return {
			groupId: binding.yzjConversationId,
			groupName,
			sessionId: binding.dshSessionId,
			yzjKind: binding.yzjKind,
			topics
		};
	}) };
}
/** Structural plugin user-turn (no dsh-llm import — dual-face tsconfig). */
function pluginTurn(text) {
	return identifiedUserMessage(text, {
		kind: "plugin",
		plugin: "ui-yzj"
	});
}
/**
* D8 handoff: bind the target group room, post the confirmed digest as ②,
* then mint a handoff topic and followup there (R3). Lands the user on the
* group room; the topic is listed underneath.
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
	let topicSessionId;
	try {
		const route = topicAgentRoute(options.ctx);
		const topic = await openTopicHome({
			home: options.home,
			agents: options.agents,
			yzjConversationId: options.groupId,
			cwd: options.cwd,
			source: "handoff",
			originText: options.digest,
			title: "丢进群交接",
			...route === void 0 ? {} : { agentOptions: route }
		});
		topicSessionId = topic.sessionId;
		const live = options.agents.get(topic.sessionId);
		const agent = typeof live === "object" && live !== null ? live : void 0;
		const window = options.home.formatSummonWindow(options.groupId, void 0, topic.sessionId);
		if (window !== "") agent?.inject?.(pluginTurn(window));
		agent?.followup?.(pluginTurn("用户从私密会话把工作丢进了本群。请基于群里刚发出的摘要，以本群共享身份继续协作。"));
	} catch (error) {
		return { error: `home-handoff followup failed: ${String(error)}` };
	}
	return {
		sessionId: opened.sessionId,
		created: opened.created,
		...topicSessionId === void 0 ? {} : { topicSessionId }
	};
}
/**
* Dedicated cwd for yzj-home-* / yzj-topic-* (docs/spec/group-room-topics.md
* R20 v1.4). Both kinds share `~/.dsh-yzj/workspace` so they never inherit
* `process.cwd()`. Only topic sessions attach to Host Workspace 「云之家」;
* room hosts stay off that official sidebar group.
* @module @dsh-yzj/ui-yzj/yzj-cwd
*/
/** Canonical directory: `~/.dsh-yzj/workspace`. */
function yzjWorkspacePath() {
	return join(homedir(), ".dsh-yzj", "workspace");
}
/** Create the directory if missing; return the path even when mkdir is denied. */
async function ensureYzjWorkspaceDir() {
	const path = yzjWorkspacePath();
	try {
		await mkdir(path, { recursive: true });
	} catch {}
	return path;
}
/**
* Ensure the directory exists and register (or reuse) the 云之家 workspace.
* Registry is optional — missing service still yields the dedicated cwd.
* After create, leftover room hosts from v1.1 attach are detached (R20 v1.4).
*/
async function ensureYzjHostWorkspace(ctx) {
	const path = await ensureYzjWorkspaceDir();
	const registry = ctx.get("workspaceRegistry");
	if (registry === void 0) return path;
	try {
		await registry.create(path, "云之家");
	} catch {}
	await detachYzjRoomHosts(ctx);
	return path;
}
/** Topic / agent sessions grown from a group or DM. Room hosts are not this. */
function isYzjTopicSessionId(sessionId) {
	return sessionId.startsWith("yzj-topic-");
}
/** Group/DM room hosts. These must not sit in the official 云之家 group. */
function isYzjRoomSessionId(sessionId) {
	return sessionId.startsWith("yzj-home-");
}
/**
* Drop leftover `yzj-home-*` membership from 云之家. Does not archive,
* delete, or touch topic sessions. Idempotent; swallows registry faults.
*/
async function detachYzjRoomHosts(ctx) {
	const registry = ctx.get("workspaceRegistry");
	if (registry === void 0) return;
	const path = yzjWorkspacePath();
	try {
		const workspace = await registry.resolveByPath(path);
		if (workspace?.detachSession === void 0) return;
		for (const sessionId of workspace.sessionIds ?? []) {
			if (!isYzjRoomSessionId(String(sessionId))) continue;
			await workspace.detachSession(sessionId);
		}
	} catch {}
}
/**
* Attach one topic session to 云之家. Room hosts (`yzj-home-*`) and any
* other id are skipped — they must not appear in that official sidebar
* group (R20 v1.4). Swallows mismatch (legacy process.cwd() headers) so
* open never fails closed.
*/
async function attachYzjSession(ctx, sessionId) {
	if (!isYzjTopicSessionId(sessionId)) return;
	const registry = ctx.get("workspaceRegistry");
	if (registry === void 0) return;
	const path = yzjWorkspacePath();
	try {
		await (await registry.resolveByPath(path) ?? await registry.create(path, "云之家")).attachSession(sessionId);
	} catch {}
}
/**
* Topic job-done delivery (docs/spec/group-room-topics.md R26): when a
* DSH topic turn goes idle, post a bounded summary back onto the Yunzhijia
* reply chain as the logged-in user (CLI `im message send`), and attach
* files written this turn. Not every assistant bubble — only the concluding
* answer. Robot inbound stays on PushHub; this path does not call sendMsgUrl.
*
* File messages cannot carry `--reply-msg-id` (CLI contract), so images ride
* the richText reply and other files follow in the group timeline.
* @module @dsh-yzj/ui-yzj/topic-deliver
*/
/** Caps: summary length, files per turn, bytes per file. */
const TOPIC_DELIVER_MAX_CHARS = 1800;
const IMAGE_EXT = /* @__PURE__ */ new Set([
	".png",
	".jpg",
	".jpeg",
	".gif",
	".webp",
	".bmp"
]);
const FILE_EXT = /* @__PURE__ */ new Set([
	...IMAGE_EXT,
	".md",
	".txt",
	".json",
	".csv",
	".pdf",
	".doc",
	".docx",
	".xls",
	".xlsx",
	".html",
	".htm",
	".svg"
]);
const WRITE_TOOLS = /* @__PURE__ */ new Set(["write", "edit"]);
function asRecord(value) {
	return typeof value === "object" && value !== null ? value : {};
}
function asString(value) {
	return typeof value === "string" ? value : "";
}
/** True when the root cannot be used as `--reply-msg-id`. */
function isSyntheticAnchor(rootMsgId) {
	if (rootMsgId === void 0 || rootMsgId === "") return true;
	if (rootMsgId === "legacy-host") return true;
	return rootMsgId.startsWith("local-");
}
/** Flatten assistant text from either `data.content` or `data.message.content`. */
function assistantTextOf(data) {
	const rec = asRecord(data);
	const content = asRecord(rec.message).content ?? rec.content;
	if (typeof content === "string") return content.trim();
	if (!Array.isArray(content)) return "";
	const parts = [];
	for (const block of content) {
		if (typeof block === "string") {
			if (block.trim() !== "") parts.push(block.trim());
			continue;
		}
		const row = asRecord(block);
		if (row.type === "text" && asString(row.text).trim() !== "") parts.push(asString(row.text).trim());
		else if (asString(row.text).trim() !== "") parts.push(asString(row.text).trim());
	}
	return parts.join("\n").trim();
}
function parseToolArgs(raw) {
	if (typeof raw === "string") try {
		return asRecord(JSON.parse(raw));
	} catch {
		return {};
	}
	return asRecord(raw);
}
/** `write` / `edit` `file_path` values from one tool/call. */
function writePathOf(data) {
	const rec = asRecord(data);
	const name = asString(rec.name);
	if (!WRITE_TOOLS.has(name)) return void 0;
	const path = asString(parseToolArgs(rec.arguments).file_path);
	return path === "" ? void 0 : path;
}
/** Tool name from one tool/call. */
function toolNameOf(data) {
	return asString(asRecord(data).name);
}
/** Decide whether this idle turn should post back into the topic. */
function decideTopicDelivery(input) {
	if (!isYzjTopicSessionId(input.sessionId)) return {
		ok: false,
		reason: "not-topic"
	};
	if (input.latestUserKind === "plugin") return {
		ok: false,
		reason: "plugin-turn"
	};
	if (input.topic === void 0) return {
		ok: false,
		reason: "not-topic"
	};
	const root = input.topic.rootMsgId;
	if (root === void 0 || root === "") return {
		ok: false,
		reason: "no-anchor"
	};
	if (isSyntheticAnchor(root)) return {
		ok: false,
		reason: "synthetic-anchor"
	};
	if (input.writesPending) return {
		ok: false,
		reason: "writes-pending"
	};
	if (input.sentIm) return {
		ok: false,
		reason: "already-sent-im"
	};
	if (input.answer.trim() === "") return {
		ok: false,
		reason: "no-answer"
	};
	return {
		ok: true,
		replyMsgId: root,
		groupId: input.topic.yzjConversationId,
		title: input.topic.title
	};
}
/** Last non-empty assistant part; over-budget keeps only that last block. */
function concludingAnswer(parts) {
	for (let index = parts.length - 1; index >= 0; index -= 1) {
		const text = parts[index]?.trim() ?? "";
		if (text !== "") return text;
	}
	return "";
}
function clip(text, max) {
	if (text.length <= max) return text;
	return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}
/** Bounded summary posted as the topic reply (no tool chatter). */
function composeTopicDelivery(input) {
	const title = input.title.trim();
	const head = title === "" ? "✅ 已完成" : `✅ 已完成「${clip(title, 40)}」`;
	const body = clip(input.answer.trim(), TOPIC_DELIVER_MAX_CHARS);
	const names = input.artifactNames.filter((name) => name.trim() !== "");
	const images = names.filter(isImageArtifact);
	const files = names.filter((name) => !isImageArtifact(name));
	const lines = [];
	if (images.length > 0) lines.push(`🖼 图片附在本回复：${images.join("、")}`);
	if (files.length > 0) lines.push(`📎 文件发在群时间线（CLI 文件消息不能挂回复链）：${files.join("、")}`);
	return `${head}\n\n${body}${lines.length === 0 ? "" : `\n\n${lines.join("\n")}`}`;
}
/** Keep a path inside `cwd`; reject escapes and empty names. */
function resolveWorkspaceFile(cwd, filePath) {
	if (cwd === "" || filePath.trim() === "") return void 0;
	const resolved = isAbsolute(filePath) ? filePath : join(cwd, filePath);
	const rel = relative(cwd, resolved);
	if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) return void 0;
	if (rel.split(/[/\\]/).some((part) => part === "node_modules" || part === ".git")) return void 0;
	const ext = extname(resolved).toLowerCase();
	if (ext !== "" && !FILE_EXT.has(ext)) return void 0;
	return resolved;
}
function uniquePaths(paths) {
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const path of paths) {
		if (seen.has(path)) continue;
		seen.add(path);
		out.push(path);
	}
	return out;
}
/** Classify an uploaded file for reply vs follow-on file message. */
function isImageArtifact(name) {
	return IMAGE_EXT.has(extname(name).toLowerCase());
}
/** Extract a fileId from `file upload` CLI JSON (pitfall-003 envelopes). */
function extractUploadFileId(json) {
	const record = asRecord(json);
	for (const key of [
		"fileId",
		"file_id",
		"id"
	]) {
		const value = record[key];
		if (typeof value === "string" && value !== "") return value;
	}
	const inner = asRecord(record.data);
	for (const key of [
		"fileId",
		"file_id",
		"id"
	]) {
		const value = inner[key];
		if (typeof value === "string" && value !== "") return value;
	}
}
async function existingFile(path) {
	try {
		const info = await stat(path);
		if (!info.isFile() || info.size <= 0 || info.size > 8388608) return void 0;
		return {
			path,
			name: basename(path),
			bytes: info.size
		};
	} catch {
		return;
	}
}
/**
* Upload + send the job-done reply (and follow-on files). Caller has already
* decided this turn should deliver.
*/
async function deliverTopicResult(options) {
	const send = options.send ?? ((input) => sendImAndLog(options.ctx, options.home, input));
	const upload = options.upload ?? (async (localPath, name) => {
		try {
			const result = await options.ctx.yzjBridge.run([
				"file",
				"upload",
				"--file",
				localPath,
				"--name",
				name
			], { timeoutMs: 12e4 });
			if (!result.ok) return void 0;
			return extractUploadFileId(result.json);
		} catch {
			return;
		}
	});
	const uploaded = [];
	for (const path of options.artifactPaths.slice(0, 3)) {
		const file = await existingFile(path);
		if (file === void 0) continue;
		const fileId = await upload(file.path, file.name);
		if (fileId === void 0) continue;
		uploaded.push({
			fileId,
			name: file.name,
			image: isImageArtifact(file.name)
		});
	}
	const images = uploaded.filter((item) => item.image);
	const files = uploaded.filter((item) => !item.image);
	const placeholders = images.map(() => "[图片]").join("");
	const content = images.length === 0 ? options.summary : `${options.summary}${placeholders === "" ? "" : `\n${placeholders}`}`;
	const posted = await send({
		groupId: options.topic.yzjConversationId,
		msgType: images.length > 0 ? "richText" : "text",
		content,
		images: images.map((item) => item.fileId),
		atOpenIds: [],
		atAll: false,
		replyMsgId: options.replyMsgId,
		topicSessionId: options.topic.dshSessionId
	});
	if (!posted.ok) return {
		ok: false,
		filesSent: 0,
		error: posted.error
	};
	const postedId = extractSendMsgId(posted.value) ?? posted.localId;
	if (postedId !== void 0) await options.home?.registerTopicOutbound?.(postedId, options.topic.dshSessionId);
	let filesSent = images.length;
	for (const file of files) {
		const sent = await send({
			groupId: options.topic.yzjConversationId,
			msgType: "file",
			fileId: file.fileId,
			fileName: file.name,
			images: [],
			atOpenIds: [],
			atAll: false,
			topicSessionId: options.topic.dshSessionId
		});
		if (sent.ok) {
			filesSent += 1;
			const fileMsgId = extractSendMsgId(sent.value) ?? sent.localId;
			if (fileMsgId !== void 0) await options.home?.registerTopicOutbound?.(fileMsgId, options.topic.dshSessionId);
		}
	}
	return {
		ok: true,
		filesSent,
		...postedId === void 0 ? {} : { replyMsgId: postedId }
	};
}
/** Collect one turn's assistant text / write paths / IM sends. */
var TopicDeliverHub = class {
	deps;
	stashes = /* @__PURE__ */ new Map();
	watermarks = /* @__PURE__ */ new Map();
	inflight = /* @__PURE__ */ new Set();
	constructor(deps) {
		this.deps = deps;
	}
	/** `session/event` slice; ignores non-topic sessions. */
	noteEvent(sessionId, event) {
		if (!isYzjTopicSessionId(sessionId)) return;
		if (event.type === "turn/start") {
			this.stashes.set(sessionId, emptyStash());
			return;
		}
		if (event.type === "user/message") {
			if (asRecord(asRecord(event.data).source).kind !== "plugin") this.stashes.set(sessionId, emptyStash());
			return;
		}
		const stash = this.stashOf(sessionId);
		const seq = typeof event.seq === "number" ? event.seq : stash.topSeq;
		if (seq <= (this.watermarks.get(sessionId) ?? -1)) return;
		if (seq > stash.topSeq) stash.topSeq = seq;
		if (event.type === "assistant/message") {
			const text = assistantTextOf(event.data);
			if (text !== "") stash.parts.push(text);
			return;
		}
		if (event.type === "tool/call") {
			if (toolNameOf(event.data) === "yzj_im_message_send") stash.sentIm = true;
			const path = writePathOf(event.data);
			if (path !== void 0) stash.writePaths.push(path);
		}
	}
	/** `agent/status` idle: decide and post. */
	noteIdle(sessionId, latestUserKind, cwd) {
		if (!isYzjTopicSessionId(sessionId)) return;
		if (this.inflight.has(sessionId)) return;
		const stash = this.stashes.get(sessionId);
		if (stash === void 0) return;
		this.stashes.delete(sessionId);
		if (stash.topSeq >= 0) this.watermarks.set(sessionId, stash.topSeq);
		const answer = concludingAnswer(stash.parts);
		const topic = this.deps.getTopic(sessionId);
		const decision = decideTopicDelivery({
			sessionId,
			topic,
			latestUserKind,
			writesPending: this.deps.writesPending(sessionId),
			sentIm: stash.sentIm,
			answer
		});
		if (!decision.ok || topic === void 0) return;
		const root = cwd !== void 0 && cwd !== "" ? cwd : this.deps.workspaceCwd();
		const artifactPaths = uniquePaths(stash.writePaths.map((path) => resolveWorkspaceFile(root, path)).filter((path) => path !== void 0)).slice(0, 3);
		const summary = composeTopicDelivery({
			title: decision.title,
			answer,
			artifactNames: artifactPaths.map((path) => basename(path))
		});
		this.inflight.add(sessionId);
		this.deps.deliver({
			topic,
			replyMsgId: decision.replyMsgId,
			summary,
			artifactPaths
		}).finally(() => {
			this.inflight.delete(sessionId);
		});
	}
	stashOf(sessionId) {
		let stash = this.stashes.get(sessionId);
		if (stash === void 0) {
			stash = emptyStash();
			this.stashes.set(sessionId, stash);
		}
		return stash;
	}
};
function emptyStash() {
	return {
		parts: [],
		writePaths: [],
		sentIm: false,
		topSeq: -1
	};
}
/**
* Wire the hub onto the host firehose. `yzjHome` is resolved per event so
* a late tool-yzj mount still delivers.
*/
function applyTopicDeliver(ctx, writeGate) {
	const hub = new TopicDeliverHub({
		getTopic: (sessionId) => {
			return homeIoFrom(ctx.get("yzjHome"))?.getTopicBySession?.(sessionId);
		},
		writesPending: (sessionId) => writeGate.list(sessionId).some((row) => row.status === "pending" || row.status === "approved"),
		workspaceCwd: () => yzjWorkspacePath(),
		deliver: async (input) => {
			return deliverTopicResult({
				ctx,
				home: homeIoFrom(ctx.get("yzjHome")),
				topic: input.topic,
				replyMsgId: input.replyMsgId,
				summary: input.summary,
				artifactPaths: input.artifactPaths
			});
		}
	});
	ctx.on("session/event", (session, event) => {
		hub.noteEvent(String(session.id), event);
	});
	ctx.on("agent/status", (payload) => {
		if (payload.status !== "idle") return;
		const sessionId = String(payload.agent.id);
		const events = payload.agent.session.events;
		hub.noteIdle(sessionId, latestUserSourceKind(events), sessionCwd(payload.agent.session));
	});
	return hub;
}
function sessionCwd(session) {
	const cwd = asString(asRecord(asRecord(session).meta).cwd);
	return cwd === "" ? void 0 : cwd;
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
/** Cached groupId → name map from `im group recent` (60s TTL; the client polls home-nav every 2s). */
let recentNamesCache;
/** Test helper: drop the recent-names cache so specs start cold. */
function clearRecentNamesCache() {
	recentNamesCache = void 0;
}
/**
* Page `im group recent` (CLI caps --limit at 20) into a name map. Robot-bound
* rooms created outside this profile never pinned a `session/title` here, so
* the workbench list fell back to identical 「群聊」 ghost rows — this fills
* their real names. Best-effort: bridge failures keep the stale cache.
*/
async function recentGroupNames(ctx) {
	if (recentNamesCache !== void 0 && Date.now() - recentNamesCache.at < 6e4) return recentNamesCache.map;
	const map = new Map(recentNamesCache?.map ?? []);
	for (let page = 1; page <= 5; page += 1) {
		let result;
		try {
			result = await ctx.yzjBridge.run([
				"im",
				"group",
				"recent",
				"--limit",
				"20",
				"--page",
				String(page)
			]);
		} catch {
			break;
		}
		if (!result.ok) break;
		const json = result.json;
		const rows = Array.isArray(json) ? json : (() => {
			const rec = typeof json === "object" && json !== null ? json : {};
			const inner = typeof rec.data === "object" && rec.data !== null ? rec.data : {};
			return [
				rec.list,
				rec.data,
				inner.list
			].find(Array.isArray) ?? [];
		})();
		for (const row of rows) {
			const rec = typeof row === "object" && row !== null ? row : {};
			const id = typeof rec.groupId === "string" ? rec.groupId : "";
			const name = typeof rec.groupName === "string" ? rec.groupName.trim() : "";
			if (id !== "" && name !== "") map.set(id, name);
		}
		if (rows.length < 20) break;
	}
	recentNamesCache = {
		at: Date.now(),
		map
	};
	return map;
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
		resume: (opts) => agentsRaw.resume({
			resumeSessionId: opts.resumeSessionId,
			...opts.agentOptions === void 0 ? {} : { agentOptions: opts.agentOptions }
		}),
		create: (opts) => agentsRaw.create({
			sessionId: opts.sessionId,
			...opts.meta === void 0 ? {} : { meta: opts.meta },
			...opts.agentOptions === void 0 ? {} : { agentOptions: opts.agentOptions }
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
* `write-decide`, `home-open` / `home-send` / `home-fused` / `home-nav` / `home-handoff` /
* `home-topic-lens` / `home-topic-ask`
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
					const title = stringField(payload, "title") ?? (await recentGroupNames(ctx)).get(groupId);
					const cwd = await ensureYzjHostWorkspace(ctx);
					const route = topicAgentRoute(ctx);
					const value = await openBoundHome({
						home,
						agents,
						yzjConversationId: groupId,
						cwd,
						...title === void 0 ? {} : { title },
						...route === void 0 ? {} : { agentOptions: route }
					});
					await attachYzjSession(ctx, value.sessionId);
					if (value.legacyTopicSessionId !== void 0) await attachYzjSession(ctx, value.legacyTopicSessionId);
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
				const topic = sessionId === void 0 ? void 0 : io.getTopicBySession?.(sessionId);
				const room = topic === void 0 ? binding : io.getByConversation(topic.yzjConversationId);
				return {
					ok: true,
					value: {
						bound: room !== void 0,
						kind: topic !== void 0 ? "topic" : room !== void 0 ? "room" : "unbound",
						...room === void 0 ? {} : { binding: room },
						...topic === void 0 ? {} : { topic }
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
				const groupId = stringField(payload, "groupId");
				if (groupId !== void 0) return {
					ok: true,
					value: {
						...roomSnapshotForGroup(io, groupId),
						candidates: []
					}
				};
				const sessionId = stringField(payload, "sessionId");
				if (sessionId === void 0) return internalError("home-fused endpoint requires a groupId or sessionId payload");
				const agents = agentsFace(ctx);
				const writes = writeGate.list(sessionId);
				return {
					ok: true,
					value: {
						...fusedSnapshot(io, sessionId, agents?.get(sessionId), writes),
						...roomSnapshot(io, sessionId)
					}
				};
			}
			case "home-nav": {
				const io = homeIoFrom(ctx.get("yzjHome"));
				if (io === void 0) return internalError("home-nav: yzjHome 服务不可用（tool-yzj 未挂载）");
				const snap = groupSpaceSnapshot(io, agentsFace(ctx));
				const names = await recentGroupNames(ctx);
				return {
					ok: true,
					value: { rooms: snap.rooms.map((room) => {
						const resolved = names.get(room.groupId);
						return resolved !== void 0 && isPlaceholderRoomTitle(room.groupName) ? {
							...room,
							groupName: resolved
						} : room;
					}) }
				};
			}
			case "home-topic-open": {
				const home = ctx.get("yzjHome");
				if (home === void 0) return internalError("home-topic-open: yzjHome 服务不可用（tool-yzj 未挂载）");
				const groupId = stringField(payload, "groupId") ?? stringField(payload, "yzjConversationId");
				if (groupId === void 0) return internalError("home-topic-open endpoint requires a groupId payload");
				const agents = agentsFace(ctx);
				if (agents === void 0) return internalError("home-topic-open: agents 服务不可用");
				try {
					const rootMsgId = stringField(payload, "rootMsgId");
					const originWho = stringField(payload, "originWho");
					const originText = stringField(payload, "originText");
					const title = stringField(payload, "title");
					const groupName = stringField(payload, "groupName");
					const cwd = await ensureYzjHostWorkspace(ctx);
					const route = topicAgentRoute(ctx);
					const value = await openTopicHome({
						home,
						agents,
						yzjConversationId: groupId,
						cwd,
						source: "dsh",
						...rootMsgId === void 0 ? {} : { rootMsgId },
						...originWho === void 0 ? {} : { originWho },
						...originText === void 0 ? {} : { originText },
						...title === void 0 ? {} : { title },
						...groupName === void 0 ? {} : { groupName },
						...route === void 0 ? {} : { agentOptions: route }
					});
					await attachYzjSession(ctx, value.sessionId);
					const io = homeIoFrom(home);
					if (io !== void 0) backfillBoundLog(ctx, io, groupId).catch(() => void 0);
					return {
						ok: true,
						value
					};
				} catch (error) {
					return internalError(`home-topic-open failed: ${String(error)}`);
				}
			}
			case "home-topic-lens": {
				const io = homeIoFrom(ctx.get("yzjHome"));
				if (io === void 0) return internalError("home-topic-lens: yzjHome 服务不可用（tool-yzj 未挂载）");
				const sessionId = stringField(payload, "sessionId");
				if (sessionId === void 0) return internalError("home-topic-lens endpoint requires a sessionId payload");
				const topic = io.getTopicBySession?.(sessionId);
				if (topic === void 0) return internalError("home-topic-lens: not a topic session");
				return {
					ok: true,
					value: {
						bubbles: topicLensBubbles(topic, agentsFace(ctx) ?? { get: () => void 0 }),
						topicSessionId: sessionId
					}
				};
			}
			case "home-topic-ask": {
				const io = homeIoFrom(ctx.get("yzjHome"));
				if (io === void 0) return internalError("home-topic-ask: yzjHome 服务不可用（tool-yzj 未挂载）");
				const sessionId = stringField(payload, "sessionId");
				const text = stringField(payload, "text");
				if (sessionId === void 0) return internalError("home-topic-ask endpoint requires a sessionId payload");
				if (text === void 0) return internalError("home-topic-ask endpoint requires a text payload");
				const agents = agentsFace(ctx);
				if (agents === void 0) return internalError("home-topic-ask: agents 服务不可用");
				const cwd = await ensureYzjHostWorkspace(ctx);
				const route = topicAgentRoute(ctx);
				const result = await askTopicAssistant({
					home: io,
					agents,
					cwd,
					topicSessionId: sessionId,
					text,
					...route === void 0 ? {} : { agentOptions: route }
				});
				if ("error" in result) return internalError(result.error);
				await attachYzjSession(ctx, sessionId);
				return {
					ok: true,
					value: result
				};
			}
			case "home-backfill": {
				const io = homeIoFrom(ctx.get("yzjHome"));
				if (io === void 0) return internalError("home-backfill: yzjHome 服务不可用（tool-yzj 未挂载）");
				const sessionId = stringField(payload, "sessionId");
				const groupId = stringField(payload, "groupId") ?? (sessionId === void 0 ? void 0 : io.getBySession(sessionId)?.yzjConversationId);
				if (groupId === void 0) return internalError("home-backfill endpoint requires a groupId or bound sessionId");
				try {
					const beforeMsgId = stringField(payload, "beforeMsgId");
					return {
						ok: true,
						value: await backfillBoundLog(ctx, io, groupId, numberField(payload, "limit"), beforeMsgId)
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
					cwd: await ensureYzjHostWorkspace(ctx)
				});
				if ("error" in result) return internalError(result.error);
				if ("sessionId" in result) await attachYzjSession(ctx, result.sessionId);
				const topicId = "topicSessionId" in result ? result.topicSessionId : void 0;
				if (typeof topicId === "string" && topicId !== "") await attachYzjSession(ctx, topicId);
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
	const writeGate = applyWriteGate(ctx);
	const handler = createRpcHandler(ctx, writeGate);
	ctx.connection.rpc.handle("/yzj", handler, { authority: "loopback" });
	ensureYzjHostWorkspace(ctx).catch(() => void 0);
	applyTopicDeliver(ctx, writeGate);
}
//#endregion
export { apply, clearRecentNamesCache, createRpcHandler, inject, name };
