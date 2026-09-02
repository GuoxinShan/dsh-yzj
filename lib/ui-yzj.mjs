import { join } from "node:path";
import { z } from "zod";
import { defineDomain, domainTable } from "@deepseek-ai/dsh-storage-domain";
import { DatabaseSync } from "node:sqlite";
import { homedir, tmpdir } from "node:os";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
//#region packages/tool-yzj/src/shared.ts
function asRecord$1(value) {
	return typeof value === "object" && value !== null ? value : {};
}
function asArray(value) {
	return Array.isArray(value) ? value : [];
}
function asString(value) {
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
	const record = asRecord$1(json);
	if (Array.isArray(record.list)) return record.list;
	if (Array.isArray(record.data)) return record.data;
	const nested = asRecord$1(record.data);
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
		const id = asString(asRecord$1(record).id);
		const key = id === "" ? JSON.stringify(record) : id;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(record);
	}
	out.sort((left, right) => {
		return (asNumber(asRecord$1(left).startDate) ?? 0) - (asNumber(asRecord$1(right).startDate) ?? 0);
	});
	return out;
}
/** Keep events whose `startDate` sits inside the original window. */
function filterCalendarEvents(records, start, end) {
	const startMs = calendarBoundMs(start, "start");
	const endMs = calendarBoundMs(end, "end");
	if (startMs === void 0 || endMs === void 0) return [...records];
	return records.filter((record) => {
		const ms = asNumber(asRecord$1(record).startDate);
		if (ms === void 0) return true;
		return ms >= startMs && ms <= endMs;
	});
}
/** Local day of an event `startDate`, or `undefined` when missing. */
function calendarEventDay(record) {
	const ms = asNumber(asRecord$1(record).startDate);
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
* Confirmation-card bridge for yzj write operations (design v1.6 §5.2, D9).
*
* How it works within harness constraints: out-of-repo plugins cannot append
* custom session event types (the generated `KNOWN_SESSION_EVENT_TYPES` set
* refuses unknown events without an `ignorable` marker, and `Session.append`
* offers no marker entry). The card is a UI-only overlay on the already-logged
* tool call:
*
* - `tools/pre-execute` (tool-yzj guard) broadcasts `yzj/ask-pending` with the
*   full parsed arguments, then waits on `yzj/confirm-request` (this module
*   answers, minting a writeId — not harness `{ kind: 'ask' }`, so GUI Full
*   access `approval: never` cannot auto-deny the card; pitfall-036);
* - an in-memory pending record (status `pending` → `approved` / `cancelled`)
*   is what the browser card queries and decides through RPC;
* - the official `tools/result` event drives the terminal status (`done` /
*   `failed`), so replay reconstructs results from the durable tool events
*   while the card's transient state lives in this process (SPA reloads keep
*   it; a host restart degrades to the ordinary tool card).
*
* The `approval/request` listener is kept as a defensive fallback if some
* other gate still returns harness `ask` under Workspace Write.
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
	const hold = (writeId, sessionId, toolName, callId, reason, signal) => {
		const pending = callId === void 0 ? void 0 : askPending.get(callId);
		const record = {
			writeId,
			sessionId,
			toolName,
			...callId === void 0 ? {} : { callId },
			level: pending?.level ?? "standard",
			domain: domainOf(toolName),
			args: pending?.args ?? {},
			reason: reason !== "" ? reason : pending?.reason ?? "",
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
			record.removeAbort = () => signal?.removeEventListener("abort", onAbort);
			signal?.addEventListener("abort", onAbort, { once: true });
			records.set(record.writeId, record);
			syncTopicStatus(sessionId);
		});
	};
	ctx.on("yzj/confirm-request", (req, next) => {
		if (!isWriteGateTool(req.toolName)) return next();
		if (req.sessionId.startsWith("yzj-robot-")) return next();
		if (req.signal?.aborted === true) return Promise.resolve("cancelled");
		return hold(crypto.randomUUID(), req.sessionId, req.toolName, req.callId, req.reason, req.signal);
	});
	ctx.on("approval/request", (req, next) => {
		if (!isWriteGateTool(req.toolName)) return next();
		if (req.agent.session.id.startsWith("yzj-robot-")) return next();
		if (req.signal?.aborted === true) return Promise.resolve("cancelled");
		const claimed = new Set(records.keys());
		const id = findApprovalId(req.agent.session.events, req.callId, claimed);
		if (id === void 0) return next();
		return hold(id, req.agent.session.id, req.toolName, req.callId, req.reason ?? "", req.signal);
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
* Contact payload unwrap (pitfall-003: bare array / list / data / single object).
* Shared by host whoami and the browser sender-name cache.
*/
function asRecord(value) {
	return typeof value === "object" && value !== null ? value : {};
}
function firstNonEmpty(...values) {
	for (const value of values) if (typeof value === "string" && value !== "") return value;
	return "";
}
function rowsOf(json) {
	if (Array.isArray(json)) return json;
	const record = asRecord(json);
	if (Array.isArray(record.list)) return record.list;
	if (Array.isArray(record.data)) return record.data;
	if (typeof record.data === "object" && record.data !== null) {
		const inner = asRecord(record.data);
		if (Array.isArray(inner.list)) return inner.list;
	}
	return Object.keys(record).length === 0 ? [] : [json];
}
/** Parse `contact user get` JSON into openId / name / photoUrl. */
function parseContactUser(json) {
	const user = asRecord(rowsOf(json)[0]);
	return {
		openId: firstNonEmpty(user.openId, user.oId),
		name: firstNonEmpty(user.name, user.userName, user.nickName),
		photoUrl: firstNonEmpty(user.photoUrl, user.photo, user.avatar)
	};
}
/**
* D8 digest helpers: visible private-transcript lines (fused snapshot still
* projects `candidates`). Full-transcript compose stays for tests; the
* 「丢进群」picker UI is retired (决策 55).
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
* group (R20 v1.4). Swallows header cwd mismatch so open never fails closed.
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
/** IM 缓存 L2 持久化（决策 37）：host SQLite 副本（browser localStorage 为 L1 热备）。 */
let imCacheDb;
function imCacheStore() {
	if (imCacheDb === void 0) {
		const dbPath = process.env["YZJ_ADVANCE_DB"] ?? join(homedir(), ".dsh", "storages", "yzj_advance.db");
		imCacheDb = new DatabaseSync(dbPath);
		imCacheDb.exec("CREATE TABLE IF NOT EXISTS im_cache (cache_key TEXT PRIMARY KEY, payload TEXT NOT NULL, fetched_at INTEGER NOT NULL)");
	}
	return imCacheDb;
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
