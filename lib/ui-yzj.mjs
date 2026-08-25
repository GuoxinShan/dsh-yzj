import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { homedir, tmpdir } from "node:os";
import { z } from "zod";
import { defineDomain, domainTable } from "@deepseek-ai/dsh-storage-domain";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
//#region packages/tool-yzj/src/shared.ts
function asRecord$2(value) {
	return typeof value === "object" && value !== null ? value : {};
}
function asArray(value) {
	return Array.isArray(value) ? value : [];
}
function asString$1(value) {
	return typeof value === "string" ? value : "";
}
function asNumber(value) {
	return typeof value === "number" ? value : void 0;
}
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
const YMD = /^(\d{4})-(\d{2})-(\d{2})/;
/** `YYYY-MM-DD` in local time. */
function ymdOf(date) {
	const pad = (n) => String(n).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
/** Next local calendar day after `ymd`. */
function nextCalendarDay(ymd) {
	const date = /* @__PURE__ */ new Date(`${ymd}T00:00:00`);
	date.setDate(date.getDate() + 1);
	return ymdOf(date);
}
/**
* Local calendar day of a CLI time token (pure date, datetime, or unix
* seconds/ms). `undefined` when the token cannot be parsed.
*/
function parseCalendarDay(input) {
	const ymd = YMD.exec(input);
	if (ymd !== null) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
	const n = Number(input);
	if (Number.isFinite(n) && n > 0) {
		const ms = n < 0xe8d4a51000 ? n * 1e3 : n;
		const date = new Date(ms);
		return Number.isNaN(date.getTime()) ? void 0 : ymdOf(date);
	}
	const parsed = Date.parse(input);
	if (Number.isNaN(parsed)) return void 0;
	return ymdOf(new Date(parsed));
}
/**
* Inclusive bound in epoch-ms. A pure `YYYY-MM-DD` start is local 00:00:00;
* a pure date end is local 23:59:59.999.
*/
function calendarBoundMs(input, role) {
	const ymd = YMD.exec(input);
	if (ymd !== null && input.length === 10) {
		const ms = (/* @__PURE__ */ new Date(`${input}${role === "start" ? "T00:00:00" : "T23:59:59.999"}`)).getTime();
		return Number.isNaN(ms) ? void 0 : ms;
	}
	if (ymd !== null && input.length > 10) {
		const ms = new Date(input).getTime();
		return Number.isNaN(ms) ? void 0 : ms;
	}
	const n = Number(input);
	if (Number.isFinite(n) && n > 0) return n < 0xe8d4a51000 ? n * 1e3 : n;
	const parsed = Date.parse(input);
	return Number.isNaN(parsed) ? void 0 : parsed;
}
/**
* Inclusive local `YYYY-MM-DD` days covering start..end. `undefined` when
* either bound is unparseable; empty when start is after end.
*/
function calendarRangeDays(start, end) {
	const first = parseCalendarDay(start);
	const last = parseCalendarDay(end);
	if (first === void 0 || last === void 0) return void 0;
	const cursor = /* @__PURE__ */ new Date(`${first}T00:00:00`);
	const stop = /* @__PURE__ */ new Date(`${last}T00:00:00`);
	if (Number.isNaN(cursor.getTime()) || Number.isNaN(stop.getTime())) return void 0;
	if (cursor.getTime() > stop.getTime()) return [];
	const days = [];
	while (cursor.getTime() <= stop.getTime()) {
		days.push(ymdOf(cursor));
		cursor.setDate(cursor.getDate() + 1);
	}
	return days;
}
/**
* Unwrap the three CLI list envelopes into a record array.
*/
function calendarEventsFromJson(json) {
	if (Array.isArray(json)) return json;
	const record = asRecord$2(json);
	if (Array.isArray(record.list)) return record.list;
	if (Array.isArray(record.data)) return record.data;
	const nested = asRecord$2(record.data);
	if (Array.isArray(nested.list)) return nested.list;
	if (Array.isArray(nested.events)) return nested.events;
	return asArray(json);
}
/**
* Dedupe by event id (fallback: JSON identity) and sort by `startDate`.
*/
function mergeCalendarEvents(records) {
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const record of records) {
		const id = asString$1(asRecord$2(record).id);
		const key = id === "" ? JSON.stringify(record) : id;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(record);
	}
	out.sort((left, right) => {
		return (asNumber(asRecord$2(left).startDate) ?? 0) - (asNumber(asRecord$2(right).startDate) ?? 0);
	});
	return out;
}
/** Keep events whose `startDate` sits inside the original window. */
function filterCalendarEvents(records, start, end) {
	const startMs = calendarBoundMs(start, "start");
	const endMs = calendarBoundMs(end, "end");
	if (startMs === void 0 || endMs === void 0) return [...records];
	return records.filter((record) => {
		const ms = asNumber(asRecord$2(record).startDate);
		if (ms === void 0) return true;
		return ms >= startMs && ms <= endMs;
	});
}
/** Local day of an event `startDate`, or `undefined` when missing. */
function calendarEventDay(record) {
	const ms = asNumber(asRecord$2(record).startDate);
	if (ms === void 0) return void 0;
	const date = new Date(ms);
	return Number.isNaN(date.getTime()) ? void 0 : ymdOf(date);
}
/** Earliest local day among dated events. */
function earliestCalendarDay(records) {
	let hit;
	for (const record of records) {
		const day = calendarEventDay(record);
		if (day === void 0) continue;
		if (hit === void 0 || day < hit) hit = day;
	}
	return hit;
}
/**
* Plan the list: unparseable tokens stay one original window; otherwise
* week stripes over the local day span.
*/
function calendarListWindows(start, end) {
	const days = calendarRangeDays(start, end);
	if (days === void 0) return {
		ok: true,
		windows: [{
			start,
			end
		}],
		filter: false
	};
	if (days.length > 366) return {
		ok: false,
		errorText: `calendar event list window exceeds 366 days; split the range`
	};
	return {
		ok: true,
		windows: calendarWeekStripes(days),
		filter: true
	};
}
/** Partition an inclusive day list into `CALENDAR_STRIPE_DAYS` windows. */
function calendarWeekStripes(days) {
	const stripes = [];
	for (let index = 0; index < days.length; index += 7) {
		const from = days[index];
		const to = days[Math.min(index + 7 - 1, days.length - 1)];
		if (from === void 0 || to === void 0) continue;
		stripes.push({
			start: from,
			end: to
		});
	}
	return stripes;
}
async function mapPool(items, limit, mapper) {
	const results = new Array(items.length);
	let cursor = 0;
	const worker = async () => {
		for (;;) {
			const index = cursor;
			cursor += 1;
			if (index >= items.length) return;
			const item = items[index];
			if (item === void 0) return;
			results[index] = await mapper(item);
		}
	};
	const n = Math.max(1, Math.min(limit, items.length));
	await Promise.all(Array.from({ length: n }, () => worker()));
	return results;
}
/**
* Slow pointer `lo` walks to the day after each hit. Fast window is the
* remaining suffix `[lo, hi]`. An empty peek means the rest of the stripe
* is empty. Only the earliest returned day is trusted (later days in the
* same peek may be a collapsed subset).
*/
async function scanCalendarStripe(lo, hi, listWindow) {
	const collected = [];
	let cursor = lo;
	const budget = (calendarRangeDays(lo, hi)?.length ?? 0) + 1;
	let steps = 0;
	while (cursor <= hi && steps < budget) {
		steps += 1;
		const shot = await listWindow(cursor, hi);
		if (!shot.ok) return {
			ok: false,
			errorText: shot.errorText ?? "calendar event list failed"
		};
		const batch = calendarEventsFromJson(shot.json);
		if (batch.length === 0) break;
		const hit = earliestCalendarDay(batch);
		if (hit === void 0 || hit < cursor || hit > hi) {
			collected.push(...batch);
			break;
		}
		for (const record of batch) {
			const day = calendarEventDay(record);
			if (day === void 0 || day === hit) collected.push(record);
		}
		cursor = nextCalendarDay(hit);
	}
	return {
		ok: true,
		events: collected
	};
}
/**
* Expand `[start, end]` by week-striped two-pointer scans, merge by id,
* then clip to the original bounds.
*/
async function collectCalendarEvents(start, end, listWindow) {
	const plan = calendarListWindows(start, end);
	if (!plan.ok) return {
		ok: false,
		errorText: plan.errorText
	};
	if (plan.windows.length === 0) return {
		ok: true,
		events: []
	};
	if (!plan.filter) {
		const shot = await listWindow(start, end);
		if (!shot.ok) return {
			ok: false,
			errorText: shot.errorText ?? "calendar event list failed"
		};
		return {
			ok: true,
			events: calendarEventsFromJson(shot.json)
		};
	}
	const shots = await mapPool(plan.windows, 6, (window) => scanCalendarStripe(window.start, window.end, listWindow));
	const failed = shots.find((shot) => !shot.ok);
	if (failed !== void 0 && !failed.ok) return {
		ok: false,
		errorText: failed.errorText
	};
	return {
		ok: true,
		events: filterCalendarEvents(mergeCalendarEvents(shots.flatMap((shot) => shot.ok ? shot.events : [])), start, end)
	};
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
	if (toolName.startsWith("yzj_im_")) return "im";
	if (toolName.startsWith("yzj_doc_workspace_")) return "kb";
	if (toolName.startsWith("yzj_doc_")) return "doc";
	if (toolName.startsWith("yzj_sheet_")) return "sheet";
	if (toolName.startsWith("yzj_todo_")) return "todo";
	if (toolName.startsWith("yzj_advance_")) return "advance";
	if (toolName.startsWith("yzj_calendar_")) return "calendar";
	if (toolName.startsWith("yzj_file_")) return "file";
	return "other";
}
/** Tools this gate answers: the yzj_* family. */
function isWriteGateTool(toolName) {
	return toolName.startsWith("yzj_");
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
* Node-half home-open: bind one Yunzhijia conversation to exactly one DSH
* session, then resume-or-create that agent (pitfall-006). Structural agents
* face — this package must not import dsh-session (client/host one tsconfig).
* @module @dsh-yzj/ui-yzj/home-open
*/
/**
* Default preset + setup for a programmatic topic/robot agent.
* Out of the box this is `standard` (bash / files / jobs) so yzj host
* tools sit on top — we do not ship a Yunzhijia preset (R28 / pitfall-030).
*/
async function topicAgentComposition(ctx) {
	const presets = ctx.get("agentPresets");
	if (presets === void 0) return {};
	try {
		const id = (await presets.resolve(presets.defaultId)).id;
		if (id === "") return {};
		return {
			agentPreset: id,
			setup: async (agentCtx) => {
				await presets.mount(agentCtx, id);
			}
		};
	} catch {
		return {};
	}
}
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
/**
* Ensure the 1:1 binding only (R27). Does not resume/create/publish a
* `yzj-home-*` agent — that would land a group row in 未分组.
*/
async function openBoundHome(options) {
	const yzjKind = options.yzjConversationId.startsWith("BOT-") ? "dm" : "group";
	const bound = await options.home.ensureBound(options.yzjConversationId, yzjKind);
	return {
		sessionId: bound.sessionId,
		created: bound.created,
		yzjKind: bound.yzjKind,
		agentCreated: false
	};
}
/**
* Mint or focus a topic session under a group room, then resume-or-create
* that agent (pitfall-006). Same root is focus, never a parallel id.
*/
async function openTopicHome(options) {
	if (options.home.ensureTopic === void 0) return {
		...await openBoundHome({
			home: options.home,
			yzjConversationId: options.yzjConversationId
		}),
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
		...options.title === void 0 ? {} : { title: options.title }
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
			...options.agentOptions === void 0 ? {} : { agentOptions: options.agentOptions },
			...options.setup === void 0 ? {} : { setup: options.setup }
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
			meta: {
				cwd: options.cwd,
				...options.agentPreset === void 0 ? {} : { agentPreset: options.agentPreset }
			},
			...options.agentOptions === void 0 ? {} : { agentOptions: options.agentOptions },
			...options.setup === void 0 ? {} : { setup: options.setup }
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
function asRecord$1(value) {
	return typeof value === "object" && value !== null ? value : {};
}
function firstNonEmpty(...values) {
	for (const value of values) if (typeof value === "string" && value !== "") return value;
	return "";
}
function rowsOf(json) {
	if (Array.isArray(json)) return json;
	const record = asRecord$1(json);
	if (Array.isArray(record.list)) return record.list;
	if (Array.isArray(record.data)) return record.data;
	if (typeof record.data === "object" && record.data !== null) {
		const inner = asRecord$1(record.data);
		if (Array.isArray(inner.list)) return inner.list;
	}
	return Object.keys(record).length === 0 ? [] : [json];
}
/** Parse `contact user get` JSON into openId / name / photoUrl. */
function parseContactUser(json) {
	const user = asRecord$1(rowsOf(json)[0]);
	return {
		openId: firstNonEmpty(user.openId, user.oId),
		name: firstNonEmpty(user.name, user.userName, user.nickName),
		photoUrl: firstNonEmpty(user.photoUrl, user.photo, user.avatar)
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
	const content = (typeof data.message === "object" && data.message !== null ? data.message : {}).content ?? data.content;
	if (typeof content === "string") return content.trim();
	if (!Array.isArray(content)) return "";
	const parts = [];
	for (const block of content) {
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
/** User-authored followup (drawer 「问助手」). Visible in the lens. Must carry `id`. */
function userTurn(text) {
	return identifiedUserMessage(text, { kind: "user" });
}
/**
* Dream 抽取指令（spec §17.2 手动径，决策 38）。单一事实源在 host：
* `advance-dream-run` RPC 直建 `yzj-dream-*` 会话并以首条 user turn 注入，
* 不再经 client askDraft / 话题问助手栏。
*/
function dreamAskPrompt() {
	return "请做一轮 Dream 抽取。流程与纪律:\n1) yzj_advance_dream_status 读蓄水池 pending 清单。\n2) 取材(关键——别凭一行摘要瞎猜):dir: 文档类条目(新增/更新文档《…》)必先 yzj_doc_get + yzj_doc_block_list 读正文再判;im: 消息条目拿不准语境就 yzj_im_message_list 以该消息为锚读前后各 10 条还原讨论;判断与哪个事项相关时 yzj_advance_get 翻候选事项最近事元找对照,或 yzj_doc_search 找背景。\n3) 逐条与 open 事项比对(yzj_advance_inspect):有价值的按纪律 feed(refs 用池条目的 channel+refId 组装成 im:<groupId>:<msgId> token 抄进去（todo: 渠道条目例外：refs 直接抄 refId 即待办 id）,面板才能定位到具体群消息;sourceType 按渠道标:im:→对话 / dir:→文档 / todo:→待办;禁止把池条目 id(dp-*)抄进 refs——那只是池内键,不是原始出处;detail 必须写出你读到的原文要点,不是复述标题;进度正常静默挂但仍落进度事元;偏差事元 detail 必须写推论链:事实→影响了什么→为什么;若某条信号与事项强相关但该事项未订阅其渠道,顺手落一条推荐事元(detail 一行 `推荐订阅: <渠道token>`)),命中打扰判据才 feed changeType=决策请求 stageTo=decision-needed 形成建议卡:summary=要我决定的问题,detail=问题分析+动作行(每行一个,可多个:`动作: 建待办 | 内容: <标题> | 截止: <yyyy-MM-dd> | 负责人: <名字>` / `动作: 发消息 | 内容: <草稿>` / `动作: 定会议 | 主题: <主题> | 时间: <yyyy-MM-dd HH:mm>`)——建议必须落到可执行动作,我在看板一键执行;若该事项已有未处理的决策请求,不要并列起新卡——feed 一张综合卡(detail 带一行「综合自: <旧卡 entryId>」写明旧问题的并入/失效,host 会校验),卡面永远只有一条当前决策且必须带最新上下文;无关的跳过。\n4) 最后 yzj_advance_dream_mark(ids=[已处理条目 id]) 并给我一句「抽取 N 条/产出 M 条建议」的总结。直接连续调用工具完成,不要询问我。";
}
/** `yzj-dream-<yyyymmdd-hhmmss>` stamp, newest-last sortable. */
function dreamStamp() {
	const now = /* @__PURE__ */ new Date();
	const pad = (value) => String(value).padStart(2, "0");
	return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}
/**
* One-shot Dream session (决策 38): mint `yzj-dream-<stamp>`, start the
* distillation as turn 1, then pin the board title so the sidebar lists it
* immediately. The caller focuses the GUI on the returned sessionId.
*/
async function runDreamSession(options) {
	const sessionId = `yzj-dream-${dreamStamp()}`;
	await options.agents.create({
		sessionId,
		meta: {
			cwd: options.cwd,
			...options.agentPreset === void 0 ? {} : { agentPreset: options.agentPreset }
		},
		...options.agentOptions === void 0 ? {} : { agentOptions: options.agentOptions },
		...options.setup === void 0 ? {} : { setup: options.setup }
	});
	const live = options.agents.get(sessionId);
	if (live?.followup === void 0) throw new Error("advance-dream-run: agent followup unavailable");
	live.followup(userTurn(dreamAskPrompt()));
	publishHostSession(live, `Dream 抽取 · 池中 ${options.pending} 条`, true, true);
	return { sessionId };
}
/**
* 派发指令（泳道期②，todo-swimlane-agent §2.3）：单一事实源在 host——
* `todo-dispatch` RPC 直建 `yzj-todo-*` 会话并以首条 user turn 注入任务卡，
* 与 Dream 手动径（决策 38）同构。claim/交卷纪律写进提示词，状态机与
* 人验收闸（S2）由 host 强制，不靠模型自觉。
*/
function todoDispatchPrompt(todo) {
	return [
		"你认领了一条泳道待办，现在开工。",
		"",
		`任务卡（版本 v${todo.version}）：`,
		`- ID：${todo.todoId}`,
		`- 标题：${todo.title}`,
		`- 描述（你要执行的提示词本体）：${todo.description === "" ? "（空——先按标题与常识界定范围，拿不准在交卷说明里写清你的理解）" : todo.description}`,
		...todo.ddl === "" ? [] : [`- DDL：${todo.ddl}`],
		...todo.tags.length === 0 ? [] : [`- 标签：${todo.tags.join(" / ")}`],
		"",
		"纪律：",
		`1) 先 yzj_todo_claim（todoId=${todo.todoId}）认领——认领不上（已被抢或状态变了）就停下来如实报告，不要硬做。`,
		"2) 按描述干活；写云之家的动作（发消息/写文档/建日程等）会弹确认卡，我来批。",
		"3) 干完用 yzj_todo_submit_review 交卷：note=结果说明（做了什么/结果是什么/还剩什么），refs 带证据链接（docId、im:<groupId>:<msgId> 等）。done 永远由我在面板验收，你不要自己标完成。",
		"4) 卡住或发现做不了：yzj_todo_release_claim 备注「阻塞：<原因>」，把卡放回可认领列——别占着不说话。",
		"直接连续调用工具完成，不要询问我。"
	].join("\n");
}
/**
* One-shot todo dispatch session (泳道期② MVP 手动径): mint `yzj-todo-<stamp>`,
* inject the task card as turn 1, then pin the board title. Same shape as the
* Dream manual path (决策 38). The caller focuses the GUI on the sessionId.
*/
async function runTodoSession(options) {
	const sessionId = `yzj-todo-${dreamStamp()}`;
	await options.agents.create({
		sessionId,
		meta: {
			cwd: options.cwd,
			...options.agentPreset === void 0 ? {} : { agentPreset: options.agentPreset }
		},
		...options.agentOptions === void 0 ? {} : { agentOptions: options.agentOptions },
		...options.setup === void 0 ? {} : { setup: options.setup }
	});
	const live = options.agents.get(sessionId);
	if (live?.followup === void 0) throw new Error("todo-dispatch: agent followup unavailable");
	live.followup(userTurn(todoDispatchPrompt(options.todo)));
	publishHostSession(live, `待办 · ${options.todo.title}`, true, true);
	return { sessionId };
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
			yzjConversationId: options.groupId
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
		const composition = await topicAgentComposition(options.ctx);
		const topic = await openTopicHome({
			home: options.home,
			agents: options.agents,
			yzjConversationId: options.groupId,
			cwd: options.cwd,
			source: "handoff",
			originText: options.digest,
			title: "丢进群交接",
			...route === void 0 ? {} : { agentOptions: route },
			...composition
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
* Decision-card action execution, host orchestration (决策 45 closed-loop
* enforcement, spec advance-domain-model.md §3): one RPC runs the effects
* atomically — execute the action (todo / im / event), land the execution
* 事元 (refs = effect pointer, detail carries the 动作序 mark), and
* auto-subscribe the effect object so its later changes flow back as new
* signals (the 执行→再观察 arc). Effect failure aborts before the entry is
* written (no half state); subscription failure degrades to a warning —
* the effect itself already happened and stays traceable.
*
* Idempotence gate: an existing execution 事元 with the same 动作序 key —
* or the same kind+text (综合卡 re-orders action rows, 决策 43, so the key
* alone is not stable across card revisions) — replays without re-executing.
*/
/** detail mark line written on every execution 事元 (the fold contract). */
function actionMarkLine(input) {
	return `动作序: ${input.actionKey} | 种类: ${input.kind} | 文本: ${input.text}`;
}
function asRecord(value) {
	return typeof value === "object" && value !== null ? value : {};
}
function asString(value) {
	return typeof value === "string" ? value : "";
}
/** Summary wording shared with the timeline (执行建议动作：…). */
function summaryOf(input) {
	if (input.kind === "todo") return `执行建议动作：建待办「${input.text}」`;
	if (input.kind === "im") return `执行建议动作：发消息到「${input.imGroupLabel ?? "订阅群"}」对齐`;
	return `执行建议动作：定会议「${input.fields["主题"] ?? input.text}」（已跳日程域，建成后经订阅回流）`;
}
/** 动作序 mark of one entry, if present. */
function markOf(entry) {
	for (const line of asString(asRecord(entry).detail).split("\n")) {
		const m = /^动作序:\s*([^|]+)\|\s*种类:\s*(\w+)\s*\|\s*文本:\s*(.*)$/.exec(line.trim());
		if (m !== null) return {
			key: (m[1] ?? "").trim(),
			kind: m[2] ?? "",
			text: (m[3] ?? "").trim()
		};
	}
}
/** Replay check: same action key, or same kind+text (text non-empty). */
function alreadyRan(entries, input) {
	for (const entry of entries) {
		const mark = markOf(entry);
		if (mark === void 0) continue;
		if (mark.key === input.actionKey) return true;
		if (input.text !== "" && mark.kind === input.kind && mark.text === input.text) return true;
	}
	return false;
}
/**
* Run one decision-card action. Throws on effect failure (the RPC surface
* wraps it into an internalError); warnings ride on the result value.
*/
async function runAdvanceAction(deps, input) {
	const detail = await deps.advance.get(input.advanceId, 0, 1e5);
	if (alreadyRan(Array.isArray(detail.entries) ? detail.entries : [], input)) return {
		idempotent: true,
		effectRef: "",
		summary: summaryOf(input),
		warnings: []
	};
	const warnings = [];
	let effectRef = "";
	let sourceType = "人工";
	if (input.kind === "todo") {
		if (deps.todo === void 0) throw new Error("advance-action-run: yzjTodo 服务不可用（tool-yzj 未挂载）");
		const created = await deps.todo.createFromAgent({
			title: input.text,
			...input.fields["描述"] === void 0 ? {} : { description: input.fields["描述"] },
			...input.fields["截止"] === void 0 ? {} : { ddl: input.fields["截止"] },
			...input.fields["负责人"] === void 0 ? {} : { tags: [input.fields["负责人"]] }
		});
		if (created.todoId === "") throw new Error("advance-action-run: 待办已建但未返回 todoId");
		effectRef = created.todoId;
	} else if (input.kind === "im") {
		if (deps.sendIm === void 0) throw new Error("advance-action-run: IM 发送通道不可用");
		const groupId = input.imGroupId ?? "";
		if (groupId === "") throw new Error("advance-action-run: 没有订阅的群渠道，发消息动作无处投递");
		const sent = await deps.sendIm(groupId, input.text);
		if (!sent.ok) throw new Error(`advance-action-run: 发消息失败：${sent.error}`);
		const msgId = extractSendMsgId(sent.value);
		if (msgId === void 0) warnings.push("CLI 未返回 msgId，执行事元 refs 缺效应指针（消息已发出，可经群渠道回流）");
		else effectRef = `im:${groupId}:${msgId}`;
		sourceType = "对话";
	} else sourceType = "日程";
	await deps.advance.feed({
		advanceId: input.advanceId,
		summary: summaryOf(input),
		sourceType,
		changeType: "进度更新",
		detail: actionMarkLine(input),
		...effectRef === "" ? {} : { refs: [effectRef] },
		actor: "user"
	});
	if (input.kind === "todo" && effectRef !== "") try {
		await deps.advance.sourceAdd(input.advanceId, `todo:${effectRef}`, input.text);
	} catch (error) {
		warnings.push(`效应对象自动订阅失败（可在看板手动关联 todo:${effectRef}）：${String(error.message)}`);
	}
	return {
		idempotent: false,
		effectRef,
		summary: summaryOf(input),
		warnings
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
/** Cached groupId → name map from `im group recent` (60s TTL; the client polls home-nav every 2s). */
let recentNamesCache;
/** docId → fileName cache for advance-ref-lookup (titles never change; miss stays uncached). */
const refDocTitleCache = /* @__PURE__ */ new Map();
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
/** Keep `yzj-cli auth login` alive long enough for the browser OAuth. */
const AUTH_LOGIN_TIMEOUT_MS = 6e5;
/** Structural agents face for home-open / handoff (never import dsh-session). */
function agentsFace(ctx) {
	const agentsRaw = ctx.get("agents");
	if (agentsRaw === void 0) return void 0;
	return {
		get: (id) => agentsRaw.get(id),
		resume: (opts) => agentsRaw.resume({
			resumeSessionId: opts.resumeSessionId,
			...opts.agentOptions === void 0 ? {} : { agentOptions: opts.agentOptions },
			...opts.setup === void 0 ? {} : { setup: opts.setup }
		}),
		create: (opts) => agentsRaw.create({
			sessionId: opts.sessionId,
			...opts.meta === void 0 ? {} : { meta: opts.meta },
			...opts.agentOptions === void 0 ? {} : { agentOptions: opts.agentOptions },
			...opts.setup === void 0 ? {} : { setup: opts.setup }
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
			case "doc-search": {
				const keyword = stringField(payload, "keyword");
				if (keyword === void 0) return internalError("doc-search endpoint requires a keyword payload");
				const command = [
					"doc",
					"search",
					"--keyword",
					keyword
				];
				const workspace = stringField(payload, "workspace");
				if (workspace !== void 0) command.push("--workspace", workspace);
				return bridgeResult(ctx, "doc search", command);
			}
			case "events": {
				const start = stringField(payload, "start");
				const end = stringField(payload, "end");
				if (start === void 0 || end === void 0) return internalError("events endpoint requires start and end payloads");
				const collected = await collectCalendarEvents(start, end, async (from, to) => {
					let result;
					try {
						result = await ctx.yzjBridge.run([
							"calendar",
							"event",
							"list",
							"--start",
							from,
							"--end",
							to
						]);
					} catch (error) {
						return {
							ok: false,
							errorText: `calendar event list failed: ${String(error)}；请确认已安装 yzj-cli 并完成 \`yzj-cli auth login\``
						};
					}
					if (!result.ok) return {
						ok: false,
						errorText: result.stderr.trim() === "" ? `calendar event list failed (exit ${result.exitCode})` : result.stderr.trim()
					};
					return result.json === void 0 ? { ok: true } : {
						ok: true,
						json: result.json
					};
				});
				if (!collected.ok) return internalError(collected.errorText);
				return {
					ok: true,
					value: collected.events
				};
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
			case "auth-status": {
				let result;
				try {
					result = await ctx.yzjBridge.run([
						"contact",
						"user",
						"get"
					], { timeoutMs: 1e4 });
				} catch (error) {
					return {
						ok: true,
						value: {
							loggedIn: false,
							name: "",
							openId: "",
							reason: String(error)
						}
					};
				}
				if (!result.ok) return {
					ok: true,
					value: {
						loggedIn: false,
						name: "",
						openId: "",
						reason: result.stderr.trim() === "" ? `contact user get failed (exit ${result.exitCode})` : result.stderr.trim()
					}
				};
				const user = parseContactUser(result.json);
				return {
					ok: true,
					value: {
						loggedIn: true,
						name: user.name,
						openId: user.openId,
						reason: ""
					}
				};
			}
			case "auth-login":
				if (typeof ctx.yzjBridge.start !== "function") return internalError("auth-login: yzjBridge.start 不可用");
				try {
					return {
						ok: true,
						value: {
							started: true,
							alreadyRunning: (await ctx.yzjBridge.start(["auth", "login"], { timeoutMs: AUTH_LOGIN_TIMEOUT_MS })).alreadyRunning
						}
					};
				} catch (error) {
					return internalError(`打开 yzj-cli 登录失败: ${String(error)}；请确认已安装 yzj-cli`);
				}
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
							description: stringField(record, "description"),
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
			case "todo-approve": {
				const todo = ctx.get("yzjTodo");
				if (todo === void 0) return internalError("todo-approve: yzjTodo 服务不可用（tool-yzj 未挂载）");
				const todoId = stringField(payload, "todoId");
				if (todoId === void 0) return internalError("todo-approve endpoint requires a todoId payload");
				try {
					return {
						ok: true,
						value: await todo.approve(todoId, stringField(payload, "note"))
					};
				} catch (error) {
					return internalError(`todo-approve failed: ${String(error)}`);
				}
			}
			case "todo-accept": {
				const todo = ctx.get("yzjTodo");
				if (todo === void 0) return internalError("todo-accept: yzjTodo 服务不可用（tool-yzj 未挂载）");
				const todoId = stringField(payload, "todoId");
				if (todoId === void 0) return internalError("todo-accept endpoint requires a todoId payload");
				try {
					return {
						ok: true,
						value: await todo.accept(todoId, stringField(payload, "note"))
					};
				} catch (error) {
					return internalError(`todo-accept failed: ${String(error)}`);
				}
			}
			case "todo-return": {
				const todo = ctx.get("yzjTodo");
				if (todo === void 0) return internalError("todo-return: yzjTodo 服务不可用（tool-yzj 未挂载）");
				const todoId = stringField(payload, "todoId");
				if (todoId === void 0) return internalError("todo-return endpoint requires a todoId payload");
				try {
					return {
						ok: true,
						value: await todo.sendBack(todoId, stringField(payload, "note"))
					};
				} catch (error) {
					return internalError(`todo-return failed: ${String(error)}`);
				}
			}
			case "todo-cancel": {
				const todo = ctx.get("yzjTodo");
				if (todo === void 0) return internalError("todo-cancel: yzjTodo 服务不可用（tool-yzj 未挂载）");
				const todoId = stringField(payload, "todoId");
				if (todoId === void 0) return internalError("todo-cancel endpoint requires a todoId payload");
				try {
					return {
						ok: true,
						value: await todo.cancel(todoId, stringField(payload, "note"))
					};
				} catch (error) {
					return internalError(`todo-cancel failed: ${String(error)}`);
				}
			}
			case "todo-reopen": {
				const todo = ctx.get("yzjTodo");
				if (todo === void 0) return internalError("todo-reopen: yzjTodo 服务不可用（tool-yzj 未挂载）");
				const todoId = stringField(payload, "todoId");
				if (todoId === void 0) return internalError("todo-reopen endpoint requires a todoId payload");
				try {
					return {
						ok: true,
						value: await todo.reopen(todoId)
					};
				} catch (error) {
					return internalError(`todo-reopen failed: ${String(error)}`);
				}
			}
			case "todo-archive": {
				const todo = ctx.get("yzjTodo");
				if (todo === void 0) return internalError("todo-archive: yzjTodo 服务不可用（tool-yzj 未挂载）");
				const todoId = stringField(payload, "todoId");
				if (todoId === void 0) return internalError("todo-archive endpoint requires a todoId payload");
				const archived = (typeof payload === "object" && payload !== null ? payload : {}).archived !== false;
				try {
					return {
						ok: true,
						value: await todo.setArchived(todoId, archived)
					};
				} catch (error) {
					return internalError(`todo-archive failed: ${String(error)}`);
				}
			}
			case "todo-edit": {
				const todo = ctx.get("yzjTodo");
				if (todo === void 0) return internalError("todo-edit: yzjTodo 服务不可用（tool-yzj 未挂载）");
				const todoId = stringField(payload, "todoId");
				if (todoId === void 0) return internalError("todo-edit endpoint requires a todoId payload");
				const record = typeof payload === "object" && payload !== null ? payload : {};
				const rawTags = record.tags;
				const tags = Array.isArray(rawTags) ? rawTags.filter((item) => typeof item === "string") : void 0;
				try {
					return {
						ok: true,
						value: await todo.edit(todoId, {
							...stringField(record, "title") === void 0 ? {} : { title: stringField(record, "title") },
							...stringField(record, "description") === void 0 ? {} : { description: stringField(record, "description") },
							...stringField(record, "ddl") === void 0 ? {} : { ddl: stringField(record, "ddl") },
							...stringField(record, "assignee") === void 0 ? {} : { assignee: stringField(record, "assignee") },
							...stringField(record, "priority") === void 0 ? {} : { priority: stringField(record, "priority") },
							...tags === void 0 ? {} : { tags }
						})
					};
				} catch (error) {
					return internalError(`todo-edit failed: ${String(error)}`);
				}
			}
			case "todo-dispatch": {
				const todo = ctx.get("yzjTodo");
				if (todo === void 0) return internalError("todo-dispatch: yzjTodo 服务不可用（tool-yzj 未挂载）");
				const todoId = stringField(payload, "todoId");
				if (todoId === void 0) return internalError("todo-dispatch endpoint requires a todoId payload");
				const agents = agentsFace(ctx);
				if (agents === void 0) return internalError("todo-dispatch: agents 服务不可用");
				try {
					const card = await todo.get(todoId);
					if (card.status !== "todo") return internalError(`todo-dispatch: 「${card.title}」当前 ${card.status}，只有「可认领」能派发`);
					const cwd = await ensureYzjHostWorkspace(ctx);
					const route = topicAgentRoute(ctx);
					const composition = await topicAgentComposition(ctx);
					const value = await runTodoSession({
						agents,
						cwd,
						todo: {
							todoId: card.todoId,
							title: card.title,
							description: card.description,
							ddl: card.ddl,
							tags: card.tags,
							version: card.version
						},
						...route === void 0 ? {} : { agentOptions: route },
						...composition
					});
					await attachYzjSession(ctx, value.sessionId);
					return {
						ok: true,
						value
					};
				} catch (error) {
					return internalError(`todo-dispatch failed: ${String(error)}`);
				}
			}
			case "advance-state": {
				const advance = ctx.get("yzjAdvance");
				if (advance === void 0) return internalError("advance-state: yzjAdvance 服务不可用（tool-yzj 未挂载）");
				try {
					return {
						ok: true,
						value: await advance.state()
					};
				} catch (error) {
					return internalError(`advance-state failed: ${String(error)}`);
				}
			}
			case "advance-get": {
				const advance = ctx.get("yzjAdvance");
				if (advance === void 0) return internalError("advance-get: yzjAdvance 服务不可用（tool-yzj 未挂载）");
				const advanceId = stringField(payload, "advanceId");
				if (advanceId === void 0) return internalError("advance-get endpoint requires an advanceId payload");
				try {
					return {
						ok: true,
						value: await advance.get(advanceId, numberField(payload, "entryOffset"), numberField(payload, "entryLimit"))
					};
				} catch (error) {
					return internalError(`advance-get failed: ${String(error)}`);
				}
			}
			case "advance-create": {
				const advance = ctx.get("yzjAdvance");
				if (advance === void 0) return internalError("advance-create: yzjAdvance 服务不可用（tool-yzj 未挂载）");
				const title = stringField(payload, "title");
				if (title === void 0) return internalError("advance-create endpoint requires a title payload");
				const rawTags = (typeof payload === "object" && payload !== null ? payload : {}).tags;
				const tags = Array.isArray(rawTags) ? rawTags.filter((item) => typeof item === "string") : [];
				try {
					return {
						ok: true,
						value: await advance.create({
							title,
							goal: stringField(payload, "goal"),
							background: stringField(payload, "background"),
							metrics: stringField(payload, "metrics"),
							assignee: stringField(payload, "assignee"),
							targetDate: stringField(payload, "targetDate"),
							tags
						})
					};
				} catch (error) {
					return internalError(`advance-create failed: ${String(error)}`);
				}
			}
			case "advance-judge": {
				const advance = ctx.get("yzjAdvance");
				if (advance === void 0) return internalError("advance-judge: yzjAdvance 服务不可用（tool-yzj 未挂载）");
				const advanceId = stringField(payload, "advanceId");
				const action = stringField(payload, "action");
				if (advanceId === void 0 || action === void 0) return internalError("advance-judge endpoint requires advanceId and action payloads");
				if (![
					"confirm_condition",
					"confirm_advance",
					"accept",
					"reject",
					"ignore",
					"cancel"
				].includes(action)) return internalError(`advance-judge: unknown action ${action}`);
				try {
					return {
						ok: true,
						value: await advance.judge(advanceId, action, stringField(payload, "note"))
					};
				} catch (error) {
					return internalError(`advance-judge failed: ${String(error)}`);
				}
			}
			case "advance-ensure":
				{
					const advance = ctx.get("yzjAdvance");
					if (advance === void 0) return internalError("advance-ensure: yzjAdvance 服务不可用（tool-yzj 未挂载）");
					try {
						return {
							ok: true,
							value: await advance.ensure()
						};
					} catch (error) {
						return internalError(`advance-ensure failed: ${String(error)}`);
					}
				}
				function imCacheStore() {
					if (imCacheDb === void 0) {
						const dbPath = process.env["YZJ_ADVANCE_DB"] ?? join(homedir(), ".dsh", "storages", "yzj_advance.db");
						imCacheDb = new DatabaseSync(dbPath);
						imCacheDb.exec("CREATE TABLE IF NOT EXISTS im_cache (cache_key TEXT PRIMARY KEY, payload TEXT NOT NULL, fetched_at INTEGER NOT NULL)");
					}
					return imCacheDb;
				}
			case "im-cache-get": try {
				const key = String(payload.key ?? "");
				const row = imCacheStore().prepare("SELECT payload, fetched_at FROM im_cache WHERE cache_key = ?").get(key);
				if (row === void 0) return {
					ok: true,
					value: null
				};
				return {
					ok: true,
					value: {
						payload: JSON.parse(row.payload),
						fetchedAt: row.fetched_at
					}
				};
			} catch (error) {
				return internalError(`im-cache-get failed: ${String(error)}`);
			}
			case "im-cache-put": try {
				const p = payload;
				imCacheStore().prepare("INSERT INTO im_cache (cache_key, payload, fetched_at) VALUES (?, ?, ?) ON CONFLICT(cache_key) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at").run(String(p.key ?? ""), JSON.stringify(p.payload ?? null), Number(p.fetchedAt ?? Date.now()));
				return {
					ok: true,
					value: true
				};
			} catch (error) {
				return internalError(`im-cache-put failed: ${String(error)}`);
			}
			case "advance-patrol-now": {
				const advance = ctx.get("yzjAdvance");
				if (advance === void 0) return internalError("advance-patrol-now: yzjAdvance 服务不可用（tool-yzj 未挂载）");
				try {
					return {
						ok: true,
						value: await advance.patrolNow()
					};
				} catch (error) {
					return internalError(`advance-patrol-now failed: ${String(error)}`);
				}
			}
			case "advance-scan-state": {
				const advance = ctx.get("yzjAdvance");
				if (advance === void 0) return internalError("advance-scan-state: yzjAdvance 服务不可用（tool-yzj 未挂载）");
				try {
					return {
						ok: true,
						value: advance.scanState()
					};
				} catch (error) {
					return internalError(`advance-scan-state failed: ${String(error)}`);
				}
			}
			case "advance-dream-state": {
				const advance = ctx.get("yzjAdvance");
				if (advance === void 0) return internalError("advance-dream-state: yzjAdvance 服务不可用（tool-yzj 未挂载）");
				try {
					return {
						ok: true,
						value: advance.dreamState()
					};
				} catch (error) {
					return internalError(`advance-dream-state failed: ${String(error)}`);
				}
			}
			case "advance-dream-run": {
				const advance = ctx.get("yzjAdvance");
				if (advance === void 0) return internalError("advance-dream-run: yzjAdvance 服务不可用（tool-yzj 未挂载）");
				const agents = agentsFace(ctx);
				if (agents === void 0) return internalError("advance-dream-run: agents 服务不可用");
				try {
					const state = advance.dreamState();
					const cwd = await ensureYzjHostWorkspace(ctx);
					const route = topicAgentRoute(ctx);
					const composition = await topicAgentComposition(ctx);
					const value = await runDreamSession({
						agents,
						cwd,
						pending: state.pending,
						...route === void 0 ? {} : { agentOptions: route },
						...composition
					});
					await attachYzjSession(ctx, value.sessionId);
					return {
						ok: true,
						value
					};
				} catch (error) {
					return internalError(`advance-dream-run failed: ${String(error)}`);
				}
			}
			case "advance-ref-lookup": {
				const io = homeIoFrom(ctx.get("yzjHome"));
				const refsRaw = typeof payload === "object" && payload !== null ? payload.refs : void 0;
				const refs = Array.isArray(refsRaw) ? refsRaw.map((row) => {
					const record = typeof row === "object" && row !== null ? row : {};
					return {
						token: String(record.token ?? ""),
						kind: String(record.kind ?? "msg")
					};
				}).filter((row) => row.token !== "") : [];
				if (refs.length === 0) return {
					ok: true,
					value: { hits: [] }
				};
				const hits = [];
				/** doc get → fileName(进程内缓存);miss 不缓存。 */
				const docTitleOf = async (docId) => {
					const cached = refDocTitleCache.get(docId);
					if (cached !== void 0) return cached;
					let ran;
					try {
						ran = await ctx.yzjBridge.run([
							"doc",
							"get",
							"--id",
							docId
						]);
					} catch {
						ran = void 0;
					}
					const fileName = ran !== void 0 && ran.ok && typeof ran.json === "object" && ran.json !== null ? String(ran.json.fileName ?? "") : "";
					if (fileName !== "") refDocTitleCache.set(docId, fileName);
					return fileName;
				};
				const advance = ctx.get("yzjAdvance");
				const poolIds = refs.map((ref) => ref.token).filter((token) => token.startsWith("dp-"));
				const poolRows = poolIds.length > 0 && advance !== void 0 && typeof advance.dreamPoolLookup === "function" ? advance.dreamPoolLookup(poolIds) : [];
				const poolById = new Map(poolRows.map((row) => [row.id, row]));
				/** 池条目 sendTime(`yyyy-MM-DD HH:mm:ss.SSS`) → epoch ms;非法为 0。 */
				const poolSentAtOf = (sendTime) => {
					const parsed = Date.parse(sendTime.replace(" ", "T"));
					return Number.isNaN(parsed) ? 0 : parsed;
				};
				for (const ref of refs) {
					if (ref.kind === "doc") {
						const title = await docTitleOf(ref.token);
						if (title !== "") hits.push({
							token: ref.token,
							kind: "doc",
							fromName: "",
							content: title,
							sentAt: 0,
							docId: ref.token
						});
						continue;
					}
					if (ref.token.startsWith("dp-")) {
						const pooled = poolById.get(ref.token);
						if (pooled === void 0) continue;
						if (pooled.channel.startsWith("im:")) {
							const groupId = pooled.channel.slice(3);
							const logEntry = io?.getLog(groupId)?.entries.find((row) => row.msgId === pooled.refId);
							hits.push({
								token: ref.token,
								kind: "msg",
								fromName: logEntry?.fromName ?? "",
								content: (logEntry?.content ?? pooled.content).slice(0, 80),
								sentAt: logEntry?.sentAt ?? poolSentAtOf(pooled.sendTime),
								jumpToken: `${pooled.channel}:${pooled.refId}`
							});
							continue;
						}
						if (pooled.channel.startsWith("dir:")) {
							const title = await docTitleOf(pooled.refId);
							if (title !== "") hits.push({
								token: ref.token,
								kind: "doc",
								fromName: "",
								content: title,
								sentAt: 0,
								docId: pooled.refId
							});
							continue;
						}
						hits.push({
							token: ref.token,
							kind: "msg",
							fromName: "",
							content: pooled.content.slice(0, 80),
							sentAt: poolSentAtOf(pooled.sendTime)
						});
						continue;
					}
					if (io === void 0) continue;
					const match = /^im:([^:\s]+):(.+)$/.exec(ref.token);
					if (match !== null) {
						const entry = io.getLog(match[1])?.entries.find((row) => row.msgId === match[2]);
						if (entry === void 0) continue;
						hits.push({
							token: ref.token,
							kind: "msg",
							fromName: entry.fromName,
							content: entry.content.slice(0, 80),
							sentAt: entry.sentAt,
							jumpToken: ref.token
						});
						continue;
					}
					if (ref.kind !== "msg") continue;
					for (const binding of io.listBindings?.() ?? []) {
						const entry = io.getLog(binding.yzjConversationId)?.entries.find((row) => row.msgId === ref.token);
						if (entry === void 0) continue;
						hits.push({
							token: ref.token,
							kind: "msg",
							fromName: entry.fromName,
							content: entry.content.slice(0, 80),
							sentAt: entry.sentAt,
							jumpToken: `im:${binding.yzjConversationId}:${ref.token}`
						});
						break;
					}
				}
				return {
					ok: true,
					value: { hits }
				};
			}
			case "advance-source-add": {
				const advance = ctx.get("yzjAdvance");
				if (advance === void 0) return internalError("advance-source-add: yzjAdvance 服务不可用（tool-yzj 未挂载）");
				const advanceId = stringField(payload, "advanceId");
				const token = stringField(payload, "token");
				if (advanceId === void 0 || token === void 0) return internalError("advance-source-add endpoint requires advanceId and token payloads");
				try {
					return {
						ok: true,
						value: await advance.sourceAdd(advanceId, token, stringField(payload, "label"))
					};
				} catch (error) {
					return internalError(`advance-source-add failed: ${String(error)}`);
				}
			}
			case "advance-source-remove": {
				const advance = ctx.get("yzjAdvance");
				if (advance === void 0) return internalError("advance-source-remove: yzjAdvance 服务不可用（tool-yzj 未挂载）");
				const advanceId = stringField(payload, "advanceId");
				const token = stringField(payload, "token");
				if (advanceId === void 0 || token === void 0) return internalError("advance-source-remove endpoint requires advanceId and token payloads");
				try {
					return {
						ok: true,
						value: { sources: await advance.sourceRemove(advanceId, token) }
					};
				} catch (error) {
					return internalError(`advance-source-remove failed: ${String(error)}`);
				}
			}
			case "advance-action-run": {
				const advance = ctx.get("yzjAdvance");
				if (advance === void 0) return internalError("advance-action-run: yzjAdvance 服务不可用（tool-yzj 未挂载）");
				const advanceId = stringField(payload, "advanceId");
				const actionKey = stringField(payload, "actionKey");
				const kind = stringField(payload, "kind");
				const text = stringField(payload, "text");
				if (advanceId === void 0 || actionKey === void 0 || text === void 0 || kind !== "todo" && kind !== "im" && kind !== "event") return internalError("advance-action-run endpoint requires advanceId/actionKey/kind(todo|im|event)/text payloads");
				const rawFields = (typeof payload === "object" && payload !== null ? payload : {}).fields;
				const fields = {};
				if (typeof rawFields === "object" && rawFields !== null) {
					for (const [key, value] of Object.entries(rawFields)) if (typeof value === "string") fields[key] = value;
				}
				const todo = ctx.get("yzjTodo");
				const imGroupId = stringField(payload, "imGroupId");
				const imGroupLabel = stringField(payload, "imGroupLabel");
				try {
					return {
						ok: true,
						value: await runAdvanceAction({
							advance,
							...todo === void 0 ? {} : { todo },
							sendIm: async (groupId, content) => {
								const sent = await sendImAndLog(ctx, homeIoFrom(ctx.get("yzjHome")), {
									groupId,
									msgType: "text",
									content,
									images: [],
									atOpenIds: [],
									atAll: false
								});
								return sent.ok ? {
									ok: true,
									value: sent.value
								} : {
									ok: false,
									error: sent.error
								};
							}
						}, {
							advanceId,
							actionKey,
							kind,
							text,
							fields,
							...imGroupId === void 0 ? {} : { imGroupId },
							...imGroupLabel === void 0 ? {} : { imGroupLabel }
						})
					};
				} catch (error) {
					return internalError(`advance-action-run failed: ${String(error)}`);
				}
			}
			case "advance-feed": {
				const advance = ctx.get("yzjAdvance");
				if (advance === void 0) return internalError("advance-feed: yzjAdvance 服务不可用（tool-yzj 未挂载）");
				if (stringField(payload, "stageTo") !== void 0 || stringField(payload, "goal") !== void 0 || stringField(payload, "metrics") !== void 0 || stringField(payload, "targetDate") !== void 0 || stringField(payload, "assignee") !== void 0) return internalError("advance-feed: 用户直写不能改阶段或目标字段，请走确认卡或看板判断");
				const advanceId = stringField(payload, "advanceId");
				const summary = stringField(payload, "summary");
				if (advanceId === void 0 || summary === void 0) return internalError("advance-feed endpoint requires advanceId and summary payloads");
				const rawRefs = (typeof payload === "object" && payload !== null ? payload : {}).refs;
				const refs = Array.isArray(rawRefs) ? rawRefs.filter((item) => typeof item === "string" && item !== "") : [];
				const sourceType = stringField(payload, "sourceType");
				const detail = stringField(payload, "detail");
				try {
					return {
						ok: true,
						value: await advance.feed({
							advanceId,
							summary,
							sourceType: sourceType ?? (refs.length > 0 ? "对话" : "人工"),
							changeType: "进度更新",
							...detail === void 0 ? {} : { detail },
							...refs.length === 0 ? {} : { refs },
							actor: "user"
						})
					};
				} catch (error) {
					return internalError(`advance-feed failed: ${String(error)}`);
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
				try {
					const value = await openBoundHome({
						home,
						yzjConversationId: groupId
					});
					await attachYzjSession(ctx, value.sessionId);
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
	const handler = createRpcHandler(ctx, applyWriteGate(ctx));
	ctx.connection.rpc.handle("/yzj", handler, { authority: "loopback" });
	ensureYzjHostWorkspace(ctx).catch(() => void 0);
}
//#endregion
export { apply, clearRecentNamesCache, createRpcHandler, inject, name };
