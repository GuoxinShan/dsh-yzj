import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Service } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { homedir } from "node:os";
import { SessionId } from "@deepseek-ai/dsh-session";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { foldScheduleEvents } from "@deepseek-ai/dsh-schedule";
import { z as z$1 } from "zod";
import { defineDomain, domainTable } from "@deepseek-ai/dsh-storage-domain";
import { timingSafeEqual } from "node:crypto";
//#region packages/robot-yzj/lib/index.js
/**
* Build the wire ack for a `msgChg` push the server marked `needAck`.
* Unacked pushes are re-delivered every ~90s (measured), so every push with
* a seq gets exactly one `{"cmd":"ack","seq":N}` reply.
* @param seq - the pushed frame's seq.
*/
function ackFrame(seq) {
	return JSON.stringify({
		cmd: "ack",
		seq
	});
}
/**
* Derive the inbound WebSocket URL from a robot's sendMsgUrl.
* `wss://<host>/xuntong/websocket?yzjtoken=<token>` — an outbound-originating
* long connection, so no public callback is needed.
* @param sendMsgUrl - the robot's full send URL including its yzjtoken.
* @returns the WebSocket URL.
* @throws Error when the URL is unparseable or carries no yzjtoken.
*/
function deriveWebSocketUrl(sendMsgUrl) {
	const parsed = new URL(sendMsgUrl);
	const token = parsed.searchParams.get("yzjtoken")?.trim();
	if (token === void 0 || token === "") throw new Error("sendMsgUrl missing yzjtoken");
	if (parsed.host === "") throw new Error("sendMsgUrl missing host");
	return `wss://${parsed.host}/xuntong/websocket?yzjtoken=${encodeURIComponent(token)}`;
}
/**
* Classify one raw WebSocket text frame by the measured protocol.
* @param raw - the frame's text payload.
* @returns the typed frame; `other` for everything unrecognized.
*/
function classifyFrame(raw) {
	let payload;
	try {
		payload = JSON.parse(raw);
	} catch {
		return {
			kind: "other",
			raw
		};
	}
	if (payload === null || typeof payload !== "object") return {
		kind: "other",
		raw
	};
	const record = payload;
	const cmd = typeof record.cmd === "string" ? record.cmd : "";
	if (cmd === "auth") return { kind: "auth" };
	if (cmd === "pong") return { kind: "pong" };
	if (cmd === "message" && typeof record.lastUpdateTime === "string") return {
		kind: "sync",
		lastUpdateTime: record.lastUpdateTime
	};
	if (cmd === "directPush" && record.type === "robotMessage") {
		const msg = record.msg;
		if (msg === null || typeof msg !== "object") return {
			kind: "other",
			raw
		};
		const m = msg;
		if (typeof m.msgId !== "string" || typeof m.content !== "string") return {
			kind: "other",
			raw
		};
		const msgParam = typeof m.msgParam === "string" ? m.msgParam : void 0;
		return {
			kind: "robot-message",
			message: {
				type: typeof m.type === "number" ? m.type : 2,
				robotId: typeof m.robotId === "string" ? m.robotId : "",
				robotName: typeof m.robotName === "string" ? m.robotName : "",
				operatorOpenid: typeof m.operatorOpenid === "string" ? m.operatorOpenid : "",
				operatorName: typeof m.operatorName === "string" ? m.operatorName : "",
				time: typeof m.time === "number" ? m.time : 0,
				msgId: m.msgId,
				content: m.content,
				groupType: typeof m.groupType === "number" ? m.groupType : 3,
				groupId: typeof m.groupId === "string" ? m.groupId : "",
				...msgParam === void 0 ? {} : { msgParam }
			},
			...parseReplyMeta(msgParam)
		};
	}
	if (cmd === "directPush" && record.type === "msgChg") {
		const msg = record.msg;
		const inner = msg !== null && typeof msg === "object" ? msg : null;
		return {
			kind: "message-change",
			msgId: typeof inner?.msgId === "string" ? inner.msgId : "",
			needAck: record.needAck === true,
			seq: typeof record.seq === "number" ? record.seq : -1
		};
	}
	return {
		kind: "other",
		raw
	};
}
/**
* Parse the stringified `msgParam` of an inbound message into its reply chain.
* @param msgParam - raw `msgParam` field, when present.
* @returns the reply meta wrapped for object spread, or undefined.
*/
function parseReplyMeta(msgParam) {
	if (msgParam === void 0) return {};
	try {
		const parsed = JSON.parse(msgParam);
		if (typeof parsed.replyMsgId !== "string") return {};
		return { reply: {
			replyMsgId: parsed.replyMsgId,
			replyPersonId: typeof parsed.replyPersonId === "string" ? parsed.replyPersonId : "",
			replyPersonName: typeof parsed.replyPersonName === "string" ? parsed.replyPersonName : "",
			replySummary: typeof parsed.replySummary === "string" ? parsed.replySummary : "",
			replyRootMsgId: typeof parsed.replyRootMsgId === "string" ? parsed.replyRootMsgId : parsed.replyMsgId
		} };
	} catch {
		return {};
	}
}
/**
* Bounded msgId dedupe for one robot connection. The same msgId can arrive on
* both the WebSocket and a webhook entry; TTL keeps the table small without a
* background sweep.
*/
var InboundDedupe = class {
	seen = /* @__PURE__ */ new Map();
	/**
	* Mark one msgId seen.
	* @param msgId - inbound message id; empty ids never dedupe.
	* @param ttlMs - retention window in milliseconds.
	* @returns true when this call is the first sighting (process the message).
	*/
	markSeen(msgId, ttlMs = 6e5) {
		const key = msgId.trim();
		if (key === "") return true;
		const now = Date.now();
		for (const [id, expiresAt] of this.seen) if (expiresAt <= now) this.seen.delete(id);
		const expiresAt = this.seen.get(key);
		if (expiresAt !== void 0 && expiresAt > now) return false;
		this.seen.set(key, now + ttlMs);
		return true;
	}
};
/**
* Reconnecting WebSocket client for the robot inbound channel. Owns no policy:
* it classifies frames (protocol.ts), keeps the connection alive with the
* measured 30s `{cmd:"ping"}` heartbeat, reconnects with exponential backoff,
* and drops stale connections. Every dependency (socket factory, timers, clock)
* is injectable so the lifecycle is unit-testable without a network.
* @module @dsh-yzj/robot-yzj/socket
*/
const DEFAULT_HEARTBEAT_MS = 3e4;
const DEFAULT_STALE_MS = 12e4;
const DEFAULT_BACKOFF_BASE_MS = 1e3;
const BACKOFF_CAP_MS = 3e4;
/**
* One managed robot inbound connection. `start()` connects; `stop()` closes
* and cancels every timer; both are idempotent.
*/
var RobotSocket = class {
	options;
	timers;
	now;
	heartbeatMs;
	staleMs;
	backoffBaseMs;
	socket = null;
	heartbeat = null;
	reconnect = null;
	stopped = true;
	attempts = 0;
	lastError = null;
	lastFrameAt = 0;
	constructor(options) {
		this.options = options;
		this.heartbeatMs = options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS;
		this.staleMs = options.staleMs ?? DEFAULT_STALE_MS;
		this.backoffBaseMs = options.backoffBaseMs ?? DEFAULT_BACKOFF_BASE_MS;
		this.timers = options.timers ?? {
			setInterval: (h, ms) => setInterval(h, ms),
			clearInterval: (h) => clearInterval(h),
			setTimeout: (h, ms) => setTimeout(h, ms),
			clearTimeout: (h) => clearTimeout(h)
		};
		this.now = options.now ?? (() => Date.now());
	}
	/** Current live status snapshot. */
	get status() {
		return {
			connected: this.socket !== null,
			attempts: this.attempts,
			lastError: this.lastError,
			lastFrameAt: this.lastFrameAt
		};
	}
	/** Connect and begin heartbeating; a no-op while running. */
	start() {
		if (!this.stopped) return;
		this.stopped = false;
		this.connect();
	}
	/** Close and cancel everything; safe to call repeatedly. */
	stop() {
		this.stopped = true;
		this.clearHeartbeat();
		if (this.reconnect !== null) {
			this.timers.clearTimeout(this.reconnect);
			this.reconnect = null;
		}
		const socket = this.socket;
		this.socket = null;
		if (socket !== null) try {
			socket.close(1e3, "shutdown");
		} catch {}
		this.emitStatus();
	}
	connect() {
		if (this.stopped) return;
		let socket;
		try {
			socket = (this.options.socketFactory ?? ((url) => new WebSocket(url)))(this.options.url);
		} catch (error) {
			this.scheduleReconnect(`connect failed: ${String(error)}`);
			return;
		}
		this.socket = socket;
		socket.addEventListener("open", () => {
			this.attempts = 0;
			this.lastError = null;
			this.lastFrameAt = this.now();
			this.startHeartbeat();
			this.emitStatus();
		});
		socket.addEventListener("message", (event) => {
			this.lastFrameAt = this.now();
			if (typeof event.data !== "string") return;
			const frame = classifyFrame(event.data);
			if (frame.kind === "robot-message") this.options.onMessage(frame.message, frame);
			else if (frame.kind === "message-change" && frame.needAck && frame.seq >= 0) try {
				socket.send(ackFrame(frame.seq));
			} catch {}
		});
		socket.addEventListener("close", () => {
			if (this.stopped) return;
			this.socket = null;
			this.clearHeartbeat();
			this.scheduleReconnect("closed");
		});
		socket.addEventListener("error", () => {
			if (this.stopped) return;
			this.lastError = "socket error";
			this.emitStatus();
		});
	}
	startHeartbeat() {
		this.clearHeartbeat();
		this.heartbeat = this.timers.setInterval(() => {
			const socket = this.socket;
			if (socket === null) return;
			if (this.now() - this.lastFrameAt >= this.staleMs) {
				this.forceReconnect("stale connection");
				return;
			}
			try {
				socket.send(JSON.stringify({ cmd: "ping" }));
			} catch (error) {
				this.forceReconnect(`heartbeat failed: ${String(error)}`);
			}
		}, this.heartbeatMs);
	}
	clearHeartbeat() {
		if (this.heartbeat === null) return;
		this.timers.clearInterval(this.heartbeat);
		this.heartbeat = null;
	}
	forceReconnect(reason) {
		const socket = this.socket;
		this.socket = null;
		this.clearHeartbeat();
		if (socket !== null) try {
			socket.close(4e3, reason);
		} catch {}
		this.scheduleReconnect(reason);
	}
	scheduleReconnect(reason) {
		if (this.stopped || this.reconnect !== null) return;
		this.lastError = reason;
		this.emitStatus();
		const delay = Math.min(BACKOFF_CAP_MS, this.backoffBaseMs * 2 ** this.attempts);
		this.attempts += 1;
		this.reconnect = this.timers.setTimeout(() => {
			this.reconnect = null;
			this.connect();
		}, delay);
	}
	emitStatus() {
		this.options.onStatus?.(this.status);
	}
};
/**
* Outbound robot sender over the sendMsgUrl webhook: one POST per message with
* the measured envelope (`msgtype:2` text, optional `param/paramType:3` reply
* anchor, optional `notifyParams`), response msgId extraction, content
* chunking under the measured ~5000-char ceiling, and a conservative sustained
* rate limiter. The fetch face is injectable for tests.
* @module @dsh-yzj/robot-yzj/outbound
*/
const DEFAULT_MAX_CHUNK_CHARS = 4e3;
const DEFAULT_MIN_INTERVAL_MS = 1200;
/**
* Rate-limited, chunking robot message sender. `send()` splits over-long text
* into sequential chunks that each carry the same reply anchor.
*/
var RobotSender = class {
	sendMsgUrl;
	maxChunkChars;
	minIntervalMs;
	post;
	delay;
	queueTail = Promise.resolve();
	lastSendAt = 0;
	constructor(options) {
		this.sendMsgUrl = options.sendMsgUrl;
		this.maxChunkChars = options.maxChunkChars ?? DEFAULT_MAX_CHUNK_CHARS;
		this.minIntervalMs = options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
		this.post = options.post ?? (async (url, body) => {
			const res = await fetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/json;charset=utf-8" },
				body
			});
			return {
				status: res.status,
				text: await res.text()
			};
		});
		this.delay = options.delay ?? ((ms) => new Promise((resolve) => {
			setTimeout(resolve, ms);
		}));
	}
	/**
	* Send one text message (chunked when over the ceiling). Sends are serialized
	* through one queue so the rate limit holds under concurrency.
	* @param text - message body.
	* @param options - reply anchor and notification targets.
	* @returns the last chunk's result (failure short-circuits remaining chunks).
	*/
	async send(text, options = {}) {
		const run = async () => {
			const chunks = chunkText(text, this.maxChunkChars);
			let last = {
				ok: false,
				error: "empty message"
			};
			for (const chunk of chunks) {
				last = await this.sendOne(chunk, options);
				if (!last.ok) return last;
			}
			return last;
		};
		const result = this.queueTail.then(run, run);
		this.queueTail = result.catch(() => void 0);
		return result;
	}
	/**
	* Send one application-style card (msgType:1). Same serialization and
	* rate limiting as text sends.
	* @param card - card content and optional reply/notify anchors.
	* @returns the send result.
	*/
	async sendCard(card) {
		const run = async () => {
			const style = card.customStyle ?? 1;
			const param = {
				appName: card.appName,
				title: card.title,
				lightAppId: "0",
				thumbUrl: "",
				webpageUrl: card.webpageUrl ?? "",
				customStyle: style,
				content: card.body
			};
			if (style === 1 && card.primaryContent !== void 0) param.primaryContent = card.primaryContent;
			if (style === 2 && card.contentUrl !== void 0) param.contentUrl = card.contentUrl;
			const payload = {
				content: card.title,
				msgType: 1,
				param
			};
			if (card.replyMsgId !== void 0) payload.param2 = {
				replyMsgId: card.replyMsgId,
				replyTitle: "",
				isReference: true,
				replySummary: card.replySummary ?? card.title.slice(0, 60),
				replyPersonName: card.replyPersonName ?? ""
			};
			if (card.notifyOpenIds !== void 0 && card.notifyOpenIds.length > 0) payload.notifyParams = [{
				type: "openIds",
				values: [...card.notifyOpenIds]
			}];
			return this.postOnce(payload);
		};
		const result = this.queueTail.then(run, run);
		this.queueTail = result.catch(() => void 0);
		return result;
	}
	async sendOne(content, options) {
		const wait = this.lastSendAt + this.minIntervalMs - Date.now();
		if (wait > 0) await this.delay(wait);
		this.lastSendAt = Date.now();
		const payload = {
			msgtype: 2,
			content
		};
		if (options.replyMsgId !== void 0) {
			payload.param = {
				replyMsgId: options.replyMsgId,
				replyTitle: "",
				isReference: true,
				replySummary: options.replySummary ?? content.slice(0, 60),
				replyPersonName: options.replyPersonName ?? ""
			};
			payload.paramType = 3;
		}
		if (options.notifyOpenIds !== void 0 && options.notifyOpenIds.length > 0) payload.notifyParams = [{
			type: "openIds",
			values: [...options.notifyOpenIds]
		}];
		return this.postOnce(payload);
	}
	/** One serialized POST with response parsing; shared by text and card sends. */
	async postOnce(payload) {
		let response;
		try {
			response = await this.post(this.sendMsgUrl, JSON.stringify(payload));
		} catch (error) {
			return {
				ok: false,
				error: `post failed: ${String(error)}`
			};
		}
		let parsed;
		try {
			parsed = JSON.parse(response.text);
		} catch {
			return {
				ok: false,
				error: `unparseable response (HTTP ${response.status})`
			};
		}
		if (parsed.success === true) {
			const msgId = parsed.data?.msgId;
			return {
				ok: true,
				...msgId === void 0 ? {} : { msgId }
			};
		}
		if (parsed.errorCode === 1401002) return {
			ok: false,
			error: "too-long"
		};
		return {
			ok: false,
			error: parsed.error ?? `errorCode ${parsed.errorCode ?? "unknown"}`
		};
	}
};
/**
* Split text into chunks at the ceiling without cutting through a paragraph
* break when one sits near the boundary.
* @param text - body to split.
* @param maxChars - chunk ceiling.
* @returns one or more non-empty chunks whose concatenation equals the input.
*/
function chunkText(text, maxChars) {
	if (maxChars < 1) throw new Error("maxChars must be positive");
	if (text === "") return [""];
	const chunks = [];
	let rest = text;
	while (rest.length > maxChars) {
		let cut = rest.lastIndexOf("\n", maxChars);
		if (cut < Math.floor(maxChars / 2)) cut = maxChars;
		const includeSep = cut < maxChars && rest[cut] === "\n" ? 1 : 0;
		chunks.push(rest.slice(0, cut + includeSep));
		rest = rest.slice(cut + includeSep);
	}
	if (rest !== "") chunks.push(rest);
	return chunks;
}
/**
* Durable per-conversation model overrides for the robot channel: which
* provider/model a group conversation or DM session should use, outliving
* restarts. Stored as one storage-domain KV table (json backend under the
* harness home); the key names the conversation surface so group and DM
* surfaces never collide.
* @module @dsh-yzj/robot-yzj/overrides
*/
/** Conversation keys: `g:<groupId>` for group surfaces, `dm:<robotId>:<openId>` for DMs. */
function groupKey(groupId) {
	return `g:${groupId}`;
}
/** @see groupKey */
function dmKey(robotId, operatorOpenid) {
	return `dm:${robotId}:${operatorOpenid}`;
}
const overrideSchema = z$1.object({
	provider: z$1.string().min(1).optional(),
	model: z$1.string().min(1).optional()
}).refine((value) => value.provider !== void 0 || value.model !== void 0, { message: "model override must set at least one of provider/model" });
/** Durable domain declaration: one table keyed by conversation key. */
const robotOverridesDomainSpec = defineDomain({
	name: "robot_yzj_overrides",
	version: 0,
	tables: { conversations: domainTable(overrideSchema) }
});
/**
* Read/write face over the opened domain. `open()` resolves once the storage
* hub has the domain form; until then every method rejects.
*/
var OverrideStore = class {
	table;
	/**
	* Open (or adopt) the domain; safe to await repeatedly.
	* @param facility - the `ctx.storageDomain` facility.
	*/
	async open(facility) {
		if (this.table !== void 0) return;
		const domain = await facility.open(robotOverridesDomainSpec);
		this.table = domain.table("conversations");
	}
	/** Close the domain (idempotent). */
	async close() {
		this.table = void 0;
	}
	/** One conversation's override, or undefined. */
	get(key) {
		return this.table?.get(key);
	}
	/** Persist one override (whole-record replace). */
	async put(key, override) {
		await this.table?.put(key, override);
	}
	/** Remove one override. */
	async delete(key) {
		return this.table?.delete(key) ?? false;
	}
	/** All overrides as lossless JSON entries. */
	entries() {
		const out = [];
		for (const [key, value] of this.table?.entries() ?? []) out.push({
			key,
			...value.provider === void 0 ? {} : { provider: value.provider },
			...value.model === void 0 ? {} : { model: value.model }
		});
		return out;
	}
};
/**
* Durable per-conversation SURFACE state for the robot channel: the last
* inbound identity (robotId/robotName/groupType) and the last anchored session
* id of every conversation a channel has seen, plus the most-recent groupId
* per channel. Outliving restarts lets DSH-side continuation
* (`robot_continue`) and fork resolve the real robot/group identity and the
* exact session id without waiting for a fresh inbound message. Stored as one
* storage-domain KV table (json backend under the harness home); keys embed
* the channel index so colliding robotIds across channels never mix.
* @module @dsh-yzj/robot-yzj/surface
*/
const surfaceSchema = z$1.object({
	robotId: z$1.string().min(1),
	robotName: z$1.string(),
	groupType: z$1.number().int(),
	time: z$1.number().int(),
	lastSessionId: z$1.string().min(1).optional(),
	groupName: z$1.string().min(1).optional()
});
const metaSchema = z$1.object({ value: z$1.string().min(1) });
/** Durable domain declaration: per-conversation surfaces + channel meta. */
const robotSurfaceDomainSpec = defineDomain({
	name: "robot_yzj_surface",
	version: 0,
	tables: {
		surfaces: domainTable(surfaceSchema),
		meta: domainTable(metaSchema)
	}
});
/** Persisted key of one conversation surface (channel + group scoped). */
function surfaceKey(channelIndex, groupId) {
	return `surface:${channelIndex}:${groupId}`;
}
/** Persisted key of one channel's most-recent groupId. */
function recentKey(channelIndex) {
	return `recent:${channelIndex}`;
}
/**
* Read/write face over the opened domain. `open()` resolves once the storage
* hub has the domain form; until then every method is inert (returns
* undefined / no-ops), so routers never block on storage readiness.
*/
var SurfaceStore = class {
	table;
	meta;
	/**
	* Open (or adopt) the domain; safe to await repeatedly.
	* @param facility - the `ctx.storageDomain` facility.
	*/
	async open(facility) {
		if (this.table !== void 0) return;
		const domain = await facility.open(robotSurfaceDomainSpec);
		this.table = domain.table("surfaces");
		this.meta = domain.table("meta");
	}
	/** Close the domain (idempotent). */
	async close() {
		this.table = void 0;
		this.meta = void 0;
	}
	/** One conversation surface, or undefined (unopened store included). */
	get(key) {
		return this.table?.get(key);
	}
	/** Persist one surface record. */
	async put(key, value) {
		await this.table?.put(key, value);
	}
	/** One channel meta record, or undefined. */
	getMeta(key) {
		return this.meta?.get(key);
	}
	/** Persist one channel meta record. */
	async putMeta(key, value) {
		await this.meta?.put(key, value);
	}
	/** Every persisted surface record (lossless JSON snapshot). */
	entries() {
		return [...this.table?.entries() ?? []];
	}
};
/**
* Inbound router: turns deduped robot messages into agent turns. Session
* model mirrors Claude Tag on the measured protocol — one persistent session
* per (robot, user) DM, reply-chain continuation via the server-maintained
* replyRootMsgId, standalone bang commands, per-session mute, and
* ack-then-push where the PUSH half lives in the event-driven PushHub (any
* turn source reaches the conversation). Conversation memory (S4) stores
* user-declared rules and injects them as instructions context every turn;
* the first group message triggers a self-introduction turn (S7/C14).
* @module @dsh-yzj/robot-yzj/router
*/
const DEFAULT_ACK_TEXT$1 = "收到，处理中…";
const DEFAULT_DENY_TEXT$1 = "抱歉，你不在本机器人的白名单内。";
const COMMAND_NAMES = [
	"help",
	"status",
	"routines",
	"mute",
	"unmute",
	"restart",
	"configure"
];
const STANDALONE_COMMAND = /^!(help|status|routines|mute|unmute|restart|configure)\s*$/;
/** `!fork <groupId|群名> <instruction>` — cross-group handover (S3): the
* current session's context summary is forwarded to a new/anchored session of
* the target group through the full inbound pipeline. The target may be a
* groupId or a human group name (resolved lazily via resolveGroupName). */
const FORK_COMMAND = /^!fork\s+(\S+)\s+(.+)$/is;
/** `!feedback <text>` — append to the local feedback log and acknowledge. */
const FEEDBACK_COMMAND = /^!feedback\s+(.+)$/is;
/** How many known surfaces a group-name `!fork` lookup may resolve (bounded). */
const GROUP_NAME_LOOKUP_LIMIT = 20;
/** Memory verbs (S4): a leading @-mention is tolerated on group surfaces. */
const MEMORY_REMEMBER = /^(?:@[^\s@]+\s*)?(?:记住|remember)\s*[:：]?\s+(.+)$/is;
const MEMORY_LIST = /^(?:@[^\s@]+\s*)?(?:!memory|你记住了什么|列出记忆)\s*$/i;
const MEMORY_FORGET = /^(?:@[^\s@]+\s*)?(?:忘掉|忘记|forget)\s+[:：]?\s*(.+)$/is;
/** Stable session id for one (robot, user) DM channel. */
function dmSessionId(robotId, operatorOpenid) {
	return SessionId(`yzj-robot-${slug(robotId)}-${slug(operatorOpenid)}`);
}
/** Stable session id for one top-level group conversation root (Claude-Tag thread analogue). */
function groupSessionId(robotId, groupId, rootMsgId) {
	return SessionId(`yzj-robot-${slug(robotId)}-g${slug(groupId)}-${slug(rootMsgId)}`);
}
/**
* A BOT-prefixed groupId marks a robot-DM conversation surface (measured:
* `BOT-<userVariant>-BOT-<robotId>`); anything else is a group conversation.
*/
function isDirectSurface(message) {
	return message.groupId.startsWith("BOT-");
}
/** Parse one message's memory verb, if any (an @-prefix is tolerated). */
function parseMemoryCommand(content) {
	const stripped = content.replace(/^\s*@[^\s@]+\s*/, "");
	const remember = MEMORY_REMEMBER.exec(stripped);
	if (remember !== null && remember[1] !== void 0) return {
		kind: "remember",
		line: remember[1]
	};
	if (MEMORY_LIST.test(stripped)) return { kind: "list" };
	const forget = MEMORY_FORGET.exec(stripped);
	if (forget !== null && forget[1] !== void 0) return {
		kind: "forget",
		substring: forget[1]
	};
}
/** The intro prompt for a group's first conversation (S7/C14). */
function introPrompt() {
	return [
		"（系统引导：请按以下步骤回复群友，中文、简洁。除第一步读取群消息外，禁止调用任何工具——自我介绍直接以文本输出，不要用 yzj_im_message_send 发消息）",
		"1. 先用 yzj_im_message_list 读取本群最近的聊天记录（groupId 用当前群的）；",
		"2. 直接输出一段两三句话的自我介绍：你是接入 DeepSeek Harness 的机器人助手，可以操作云之家（文档/日程/待办/消息/多维表格）并调度 DSH 的全部能力；",
		"3. 根据群内近况提出 2~3 个你现在就能帮忙的具体任务；",
		"4. 最后提醒：发 !help 可看命令列表。"
	].join("\n");
}
function slug(value) {
	const cleaned = value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
	return cleaned === "" ? "x" : cleaned.slice(0, 40);
}
/** @see slug — public so the service can derive fork session ids. */
function slugId(value) {
	return slug(value);
}
/**
* The balanced completed-turn prefix of a session log: every event up to and
* including the last `turn/end`. The in-flight turn is excluded; before any
* completed turn the result is empty. Because live sequence numbers equal
* array indexes, the result is a valid fork `seed` beginning at sequence zero
* (same boundary the harness fork subagent uses).
* @param events - the source session's full event log.
* @returns the seed events, contiguous from seq 0; empty when no turn has completed.
*/
function completedTurnPrefix(events) {
	const lastEnd = events.findLast((event) => event.type === "turn/end");
	if (lastEnd === void 0) return [];
	return events.slice(0, lastEnd.seq + 1);
}
/**
* A bounded, newest-first plain-text summary of a session's assistant
* output, for cross-group handover (`!fork`). Traverses the log backwards,
* collecting assistant text blocks up to `maxChars` (older content is
* dropped; order within the window is preserved).
* @param events - the source session's full event log.
* @param maxChars - hard cap on the returned text length.
* @returns the bounded summary ('' when the session has no assistant output).
*/
function conversationSummary(events, maxChars = 1200) {
	const parts = [];
	let size = 0;
	for (let index = events.length - 1; index >= 0 && size < maxChars; index -= 1) {
		const event = events[index];
		if (event === void 0 || event.type !== "assistant/message") continue;
		for (const block of event.data.message?.content ?? []) if (block.type === "text" && block.text !== void 0 && block.text !== "") {
			parts.unshift(block.text);
			size += block.text.length;
		}
	}
	return parts.join("\n").slice(-maxChars);
}
/** DM conversation key of one message (override/memory-table form). */
function dmKeyOf(message) {
	return dmKey(message.robotId, message.operatorOpenid);
}
/**
* The inbound brain. Construct once per robot connection; `handle` is called
* for every classified robot message (dedupe happens here). `dispose()` tears
* down every agent this router created.
*/
var RobotRouter = class {
	agents;
	sender;
	allowFrom;
	agentOptions;
	fallbackRoute;
	resolveOverride;
	confirm;
	push;
	memory;
	surface;
	channelIndex;
	cwd;
	ackText;
	denyText;
	logger;
	guiUrl;
	resolveGroupName;
	/** groupId → human group name, resolved lazily for `!fork` by name. */
	groupNames = /* @__PURE__ */ new Map();
	dedupe = new InboundDedupe();
	/** Handles for sessions this router created (dispose/restart need them). */
	handles = /* @__PURE__ */ new Map();
	/** Outbound msgId → owning session id (reply continuation). */
	outboundAnchor = /* @__PURE__ */ new Map();
	/** Inbound root msgId → anchored group session id (reply continuation). */
	inboundAnchor = /* @__PURE__ */ new Map();
	/** Session id → muted flag. */
	muted = /* @__PURE__ */ new Set();
	/** AllowFrom cache once resolved. */
	allowFromCache;
	/** groupId → last seen surface identity (in-memory mirror of the store). */
	surfaces = /* @__PURE__ */ new Map();
	/** Recency order of seen groupIds (most recent last). */
	recentGroups = [];
	/** groupId → last anchored session id (synthetic continuation target). */
	lastSession = /* @__PURE__ */ new Map();
	/** Group-thread session id → its private working directory (§8.4). */
	sessionCwds = /* @__PURE__ */ new Map();
	constructor(options) {
		this.agents = options.agents;
		this.sender = options.sender;
		this.allowFrom = options.allowFrom;
		this.agentOptions = options.agentOptions;
		this.fallbackRoute = options.fallbackRoute;
		this.resolveOverride = options.resolveOverride;
		this.confirm = options.confirm;
		this.push = options.push;
		this.memory = options.memory;
		this.surface = options.surface;
		this.channelIndex = options.channelIndex ?? 0;
		this.cwd = options.cwd ?? process.cwd();
		this.ackText = options.ackText ?? DEFAULT_ACK_TEXT$1;
		this.denyText = options.denyText ?? DEFAULT_DENY_TEXT$1;
		this.logger = options.logger;
		this.guiUrl = options.guiUrl ?? "";
		this.resolveGroupName = options.resolveGroupName;
	}
	/** Dispose every agent session this router created; clears all state. */
	async dispose() {
		for (const [sessionId, handle] of this.handles) try {
			await handle.dispose();
		} catch (error) {
			this.logger?.warn(`robot: dispose failed for ${sessionId}: ${String(error)}`);
		}
		this.handles.clear();
		this.outboundAnchor.clear();
		this.inboundAnchor.clear();
		this.muted.clear();
	}
	/** Forget one session's live state (mute, anchors, push registration). */
	forgetSession(sessionId) {
		this.muted.delete(sessionId);
		this.push?.forget(sessionId);
		for (const [msgId, owner] of this.outboundAnchor) if (owner === sessionId) this.outboundAnchor.delete(msgId);
		for (const [msgId, owner] of this.inboundAnchor) if (owner === sessionId) this.inboundAnchor.delete(msgId);
	}
	/** Cap an anchor map, evicting oldest entries (insertion order). */
	trimAnchor(map, cap = 500) {
		for (const key of map.keys()) {
			if (map.size <= cap) break;
			map.delete(key);
		}
	}
	/**
	* Resolve the owning session for one message. DM surfaces keep one
	* persistent session per (robot, user). Group surfaces follow the Claude-Tag
	* thread model on reply chains: a reply whose target/root is an anchored
	* message continues that session; any other message anchors a fresh session
	* at its own msgId.
	*/
	resolveSession(message) {
		if (isDirectSurface(message)) return dmSessionId(message.robotId, message.operatorOpenid);
		if (message.synthetic === true) {
			const last = this.lastSession.get(message.groupId) ?? this.surface?.get(surfaceKey(this.channelIndex, message.groupId))?.lastSessionId;
			if (last !== void 0) return SessionId(last);
		}
		const reply = parseReplyMeta(message.msgParam).reply;
		if (reply !== void 0) {
			const anchored = this.outboundAnchor.get(reply.replyMsgId) ?? this.inboundAnchor.get(reply.replyMsgId) ?? this.outboundAnchor.get(reply.replyRootMsgId) ?? this.inboundAnchor.get(reply.replyRootMsgId);
			if (anchored !== void 0) return anchored;
		}
		const sessionId = groupSessionId(message.robotId, message.groupId, message.msgId);
		this.inboundAnchor.set(message.msgId, sessionId);
		this.trimAnchor(this.inboundAnchor);
		this.sessionCwds.set(sessionId, this.groupThreadCwd(message.groupId, message.msgId));
		return sessionId;
	}
	/** Private working directory of one group thread (slugged, stable across restarts). */
	groupThreadCwd(groupId, rootMsgId) {
		return join(this.cwd, "groups", slug(groupId), slug(rootMsgId));
	}
	/**
	* The group shared directory (design §8.4): the explicit cross-thread
	* collaboration area, created on demand. Only `robot_share_write` writes
	* here — harness file tools stay sandboxed inside each session's private
	* workspace, so this is the sole write channel outside it.
	*/
	shareDir(groupId) {
		const dir = join(this.cwd, "groups", slug(groupId), "shared");
		try {
			mkdirSync(dir, { recursive: true });
		} catch (error) {
			this.logger?.warn(`robot: mkdir shared dir failed for ${dir}: ${String(error)}`);
		}
		return dir;
	}
	/** Entry point for one classified inbound message. */
	async handle(message) {
		if (!this.dedupe.markSeen(message.msgId)) return;
		this.noteSurface(message);
		const group = !isDirectSurface(message);
		const replyAnchor = message.synthetic === true ? { ...group ? { notifyOpenIds: [message.operatorOpenid] } : {} } : {
			replyMsgId: message.msgId,
			replySummary: message.content.slice(0, 60),
			replyPersonName: message.operatorName,
			...group ? { notifyOpenIds: [message.operatorOpenid] } : {}
		};
		const stripped = message.content.replace(/^\s*@[^\s@]+\s*/, "");
		const commandName = STANDALONE_COMMAND.exec(stripped)?.[1];
		if (commandName !== void 0 && COMMAND_NAMES.includes(commandName)) {
			await this.runCommand(commandName, message, replyAnchor);
			return;
		}
		const fork = FORK_COMMAND.exec(stripped);
		if (fork !== null && fork[1] !== void 0 && fork[2] !== void 0) {
			await this.runFork(fork[1], fork[2], message, replyAnchor);
			return;
		}
		const feedback = FEEDBACK_COMMAND.exec(stripped);
		if (feedback !== null && feedback[1] !== void 0) {
			await this.runFeedback(feedback[1], message, replyAnchor);
			return;
		}
		if (!await this.authorized(message.operatorOpenid)) {
			await this.reply(this.denyText, replyAnchor);
			return;
		}
		if (this.confirm !== void 0 && this.confirm.checkReply(message)) return;
		const sessionId = this.resolveSession(message);
		this.noteSession(message, sessionId);
		if (this.muted.has(sessionId)) return;
		const conversationKey = group ? groupKey(message.groupId) : dmKeyOf(message);
		const memoryCommand = this.memory === void 0 ? void 0 : parseMemoryCommand(message.content);
		if (memoryCommand !== void 0) {
			await this.runMemory(memoryCommand, conversationKey, replyAnchor);
			return;
		}
		this.confirm?.registerSession(sessionId, {
			sender: this.sender,
			robotId: message.robotId,
			group,
			groupId: message.groupId,
			askerOpenId: message.operatorOpenid,
			askerName: message.operatorName
		});
		this.push?.register(sessionId, {
			sender: this.sender,
			group,
			askerOpenId: message.operatorOpenid,
			askerName: message.operatorName,
			lastInbound: {
				msgId: message.msgId,
				summary: message.content.slice(0, 60),
				personName: message.operatorName
			},
			...message.synthetic === true ? { noReplyAnchor: true } : {}
		});
		const taskSummary = message.content.trim().slice(0, 24);
		const ackText = taskSummary.length >= 12 ? `${this.ackText}（${taskSummary}${message.content.trim().length > 24 ? "…" : ""}）` : this.ackText;
		const ackResult = await this.reply(ackText, replyAnchor);
		if (ackResult.ok && ackResult.msgId !== void 0) {
			this.outboundAnchor.set(ackResult.msgId, sessionId);
			this.trimAnchor(this.outboundAnchor);
		}
		let turnText = message.content;
		const introKey = `intro:${message.robotId}:${message.groupId}`;
		if (group && this.memory !== void 0 && this.memory.lines(introKey).length === 0) {
			this.memory.remember(introKey, "done").catch(() => void 0);
			const introAgent = await this.ensureAgent(sessionId, conversationKey);
			if (introAgent !== void 0) try {
				introAgent.followup(createUserMessage({
					content: [{
						type: "text",
						text: introPrompt()
					}],
					source: {
						kind: "plugin",
						plugin: "robot-yzj"
					}
				}));
			} catch (error) {
				this.logger?.warn(`robot: intro followup failed: ${String(error)}`);
			}
		}
		await this.dispatchTurn(sessionId, conversationKey, message, turnText);
	}
	/**
	* Record one inbound message's conversation surface (in memory and, when a
	* store is present, durably) so DSH-side continuation and fork can resolve
	* the real robot/group identity and the last anchored session. A persisted
	* lastSessionId survives a restart and is preserved across rewrites.
	*/
	noteSurface(message) {
		const previous = this.surfaces.get(message.groupId) ?? this.surface?.get(surfaceKey(this.channelIndex, message.groupId));
		const state = {
			robotId: message.robotId,
			robotName: message.robotName,
			groupType: message.groupType,
			time: message.time,
			...previous?.lastSessionId === void 0 ? {} : { lastSessionId: previous.lastSessionId }
		};
		this.surfaces.set(message.groupId, state);
		if (this.recentGroups[this.recentGroups.length - 1] !== message.groupId) {
			const index = this.recentGroups.indexOf(message.groupId);
			if (index >= 0) this.recentGroups.splice(index, 1);
			this.recentGroups.push(message.groupId);
			if (this.recentGroups.length > 100) this.recentGroups.shift();
			this.surface?.putMeta(recentKey(this.channelIndex), { value: message.groupId }).catch(() => void 0);
		}
		if (previous === void 0 || previous.robotId !== message.robotId || previous.robotName !== message.robotName || previous.groupType !== message.groupType) this.surface?.put(surfaceKey(this.channelIndex, message.groupId), state).catch(() => void 0);
	}
	/** Track the session a message anchored on its surface (continuation target). */
	noteSession(message, sessionId) {
		this.lastSession.set(message.groupId, sessionId);
		if (this.lastSession.size > 300) {
			const oldest = this.lastSession.keys().next().value;
			if (oldest !== void 0) this.lastSession.delete(oldest);
		}
		const state = this.surfaces.get(message.groupId);
		if (state !== void 0 && state.lastSessionId !== String(sessionId)) {
			const updated = {
				...state,
				lastSessionId: String(sessionId)
			};
			this.surfaces.set(message.groupId, updated);
			this.surface?.put(surfaceKey(this.channelIndex, message.groupId), updated).catch(() => void 0);
		}
	}
	/**
	* DSH-side conversation continuation: fabricate a user turn as the
	* operator and run it through the full inbound pipeline (ack, memory,
	* confirmation replies, agent turn, event-driven push). The operator openId
	* resolves through the allowFrom policy, so only the whitelisted owner can
	* drive the robot this way.
	* @param text - the operator's message text.
	* @param options - explicit groupId; defaults to the most recent surface.
	* @returns the anchored session id when a turn was queued.
	*/
	async continueFromDsh(text, options = {}) {
		const operator = (await this.allowFrom())?.[0];
		if (operator === void 0 || operator === "") return {
			ok: false,
			error: "机器人白名单为空：无法以操作者身份续接会话"
		};
		const surface = await this.resolveSurface(options.groupId);
		if (surface === void 0) return {
			ok: false,
			error: options.groupId === void 0 ? "该机器人尚未收到任何入站消息，没有可续接的会话表面" : `该机器人没有见过群 ${options.groupId} 的消息`
		};
		const message = {
			type: 2,
			robotId: surface.robotId,
			robotName: surface.robotName,
			operatorOpenid: operator,
			operatorName: "DSH 控制台",
			time: Date.now(),
			msgId: `dsh-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
			content: text,
			groupType: surface.groupType,
			groupId: surface.groupId,
			synthetic: true
		};
		await this.handle(message);
		const sessionId = this.lastSession.get(surface.groupId);
		return sessionId === void 0 ? {
			ok: true,
			error: "handle 返回但未锚定会话"
		} : {
			ok: true,
			sessionId: String(sessionId)
		};
	}
	/** Resolve one surface: explicit groupId, else the most recent one. */
	async resolveSurface(groupId) {
		const known = (key) => {
			const state = this.surfaces.get(key);
			return state === void 0 ? void 0 : {
				...state,
				groupId: key
			};
		};
		if (groupId !== void 0) {
			const found = known(groupId);
			if (found !== void 0) return found;
			const persisted = this.surface?.get(surfaceKey(this.channelIndex, groupId));
			return persisted === void 0 ? void 0 : {
				...persisted,
				groupId
			};
		}
		const recent = this.recentGroups[this.recentGroups.length - 1];
		if (recent !== void 0) {
			const found = known(recent);
			if (found !== void 0) return found;
			const persisted = this.surface?.get(surfaceKey(this.channelIndex, recent));
			return persisted === void 0 ? void 0 : {
				...persisted,
				groupId: recent
			};
		}
		const persistedRecent = this.surface?.getMeta(recentKey(this.channelIndex));
		if (persistedRecent !== void 0 && persistedRecent.value !== "") {
			const persisted = this.surface?.get(surfaceKey(this.channelIndex, persistedRecent.value));
			if (persisted !== void 0) return {
				...persisted,
				groupId: persistedRecent.value
			};
		}
		const prefix = `surface:${this.channelIndex}:`;
		let best;
		for (const [key, state] of this.surface?.entries() ?? []) {
			if (!key.startsWith(prefix)) continue;
			if (best === void 0 || state.time > best.state.time) best = {
				state,
				groupId: key.slice(prefix.length)
			};
		}
		return best === void 0 ? void 0 : {
			...best.state,
			groupId: best.groupId
		};
	}
	/** Every surface this channel has seen, most recent first (lossless JSON). */
	surfaceSummary() {
		const ordered = [...this.recentGroups].reverse();
		const seen = new Set(ordered);
		const out = [];
		for (const groupId of ordered) {
			const state = this.surfaces.get(groupId);
			if (state !== void 0) out.push({
				groupId,
				robotId: state.robotId,
				robotName: state.robotName,
				groupType: state.groupType,
				time: state.time,
				...state.lastSessionId === void 0 ? {} : { lastSessionId: state.lastSessionId },
				...state.groupName === void 0 ? {} : { groupName: state.groupName }
			});
		}
		const prefix = `surface:${this.channelIndex}:`;
		for (const [key, state] of this.surface?.entries() ?? []) {
			if (!key.startsWith(prefix)) continue;
			const groupId = key.slice(prefix.length);
			if (seen.has(groupId)) continue;
			seen.add(groupId);
			out.push({
				groupId,
				robotId: state.robotId,
				robotName: state.robotName,
				groupType: state.groupType,
				time: state.time,
				...state.lastSessionId === void 0 ? {} : { lastSessionId: state.lastSessionId },
				...state.groupName === void 0 ? {} : { groupName: state.groupName }
			});
		}
		return out;
	}
	/** The session a conversation last anchored on, when still live. */
	conversationSession(groupId) {
		return this.lastSession.get(groupId);
	}
	/** The working directory robot sessions on this channel are created with. */
	workdir() {
		return this.cwd;
	}
	/** Every live session id this router created (lossless JSON for status). */
	liveSessionIds() {
		return [...this.handles.keys()].map(String);
	}
	async authorized(operatorOpenid) {
		if (this.allowFromCache === void 0) try {
			const resolved = await this.allowFrom();
			this.allowFromCache = resolved ?? [];
		} catch (error) {
			this.logger?.warn(`robot: allowFrom resolve failed: ${String(error)}`);
			this.allowFromCache = [];
		}
		const allowFrom = this.allowFromCache;
		return allowFrom !== void 0 && allowFrom.includes(operatorOpenid);
	}
	async reply(text, anchor) {
		return this.sender.send(text, anchor);
	}
	/**
	* Queue one turn: inject the conversation's memory as instructions
	* context, then follow up the turn text. The PushHub owns all pushes for
	* the resulting output (interactive, scheduled, or otherwise sourced).
	*/
	async dispatchTurn(sessionId, conversationKey, message, turnText) {
		const agent = await this.ensureAgent(sessionId, conversationKey);
		if (agent === void 0) {
			await this.reply("内部错误：无法创建会话，请稍后再试。", {
				replyMsgId: message.msgId,
				replySummary: message.content.slice(0, 60),
				replyPersonName: message.operatorName
			});
			return;
		}
		const lines = this.memory?.lines(conversationKey) ?? [];
		if (lines.length > 0) {
			const text = `［本会话长期指令（用户设定，请遵守）］\n${lines.map((line) => `- ${line}`).join("\n")}`;
			try {
				agent.inject(createUserMessage({
					content: [{
						type: "text",
						text
					}],
					source: {
						kind: "plugin",
						plugin: "robot-yzj"
					}
				}));
			} catch (error) {
				this.logger?.warn(`robot: memory inject failed: ${String(error)}`);
			}
		}
		if (!isDirectSurface(message)) {
			const text = [
				"［本群共享工作区］",
				`- 绝对路径：${this.shareDir(message.groupId)}`,
				"- 写共享区必须用 robot_share_write 工具（自动处理同名冲突）；禁止用 write/edit 工具写共享区路径（会被沙箱拒绝）",
				"- 读共享区文件可直接用内置 read/glob（绝对路径）。"
			].join("\n");
			try {
				agent.inject(createUserMessage({
					content: [{
						type: "text",
						text
					}],
					source: {
						kind: "plugin",
						plugin: "robot-yzj"
					}
				}));
			} catch (error) {
				this.logger?.warn(`robot: share-dir inject failed: ${String(error)}`);
			}
		}
		try {
			agent.followup(createUserMessage({
				content: [{
					type: "text",
					text: turnText
				}],
				source: {
					kind: "plugin",
					plugin: "robot-yzj"
				}
			}));
		} catch (error) {
			this.logger?.warn(`robot: followup failed: ${String(error)}`);
		}
	}
	async ensureAgent(sessionId, conversationKey) {
		const existing = this.agents.get(sessionId);
		if (existing !== void 0) return existing;
		const override = this.resolveOverride?.(conversationKey);
		const merged = {
			...this.fallbackRoute?.() ?? {},
			...this.agentOptions ?? {},
			...override ?? {}
		};
		const agentOptions = merged.provider !== void 0 && merged.provider !== "" || merged.model !== void 0 && merged.model !== "" ? merged : void 0;
		const cwd = this.sessionCwds.get(sessionId) ?? this.cwd;
		if (cwd !== this.cwd) try {
			mkdirSync(cwd, { recursive: true });
		} catch (error) {
			this.logger?.warn(`robot: mkdir session cwd failed for ${cwd}: ${String(error)}`);
		}
		const meta = { cwd };
		const handle = await this.agents.resume({
			resumeSessionId: sessionId,
			...agentOptions === void 0 ? {} : { agentOptions }
		}).catch(() => this.agents.create({
			sessionId,
			meta,
			...agentOptions === void 0 ? {} : { agentOptions }
		})).catch((error) => {
			this.logger?.warn(`robot: create/resume agent failed for ${sessionId}: ${String(error)}`);
		});
		if (handle === void 0) return void 0;
		this.handles.set(sessionId, handle);
		return handle.agent;
	}
	/** Execute one parsed memory verb and reply with the outcome. */
	async runMemory(command, conversationKey, anchor) {
		if (this.memory === void 0) return;
		if (command.kind === "list") {
			const lines = this.memory.lines(conversationKey);
			await this.reply(lines.length === 0 ? "本会话暂无记忆。说「记住 …」即可添加。" : `本会话的记忆（${lines.length} 条）：\n${lines.map((line, index) => `${index + 1}. ${line}`).join("\n")}\n说「忘掉 …」可删除。`, anchor);
			return;
		}
		const mutation = command.kind === "remember" ? await this.memory.remember(conversationKey, command.line) : await this.memory.forget(conversationKey, command.substring);
		await this.reply(`${mutation.note}（当前 ${mutation.lines.length} 条）`, anchor);
	}
	async runCommand(command, message, anchor) {
		const sessionId = this.resolveSession(message);
		switch (command) {
			case "help":
				await this.reply([
					"可用命令（独立成句才生效；!fork / !feedback 带参数）：",
					"!status — 查看机器人连接与会话状态",
					"!routines — 列出本会话的定时提醒",
					"!memory — 查看本会话的记忆（说「记住 …」添加、「忘掉 …」删除）",
					"!mute — 静音本会话（不再回复，!unmute 解除）",
					"!unmute — 解除静音",
					"!restart — 重启本会话（保留聊天记录，清空额外上下文）",
					"!configure — 机器人设置面板入口",
					"!fork <群ID> <指令> — 把本会话上下文交接给目标群（群ID 见 !status）",
					"!feedback <文本> — 反馈给机器人维护者",
					"",
					"写操作会先推送确认卡：回复「确认 N / 取消 N」裁决。"
				].join("\n"), anchor);
				return;
			case "configure":
				await this.reply(this.guiUrl === "" ? "机器人设置：在 DSH 面板（悬浮球）的「机器人」tab 调整模型覆盖与通道状态。" : `机器人设置面板：${this.guiUrl}（「机器人」tab：模型覆盖、通道状态、会话列表）`, anchor);
				return;
			case "routines": {
				const agent = this.agents.get(sessionId);
				const lines = [];
				if (agent !== void 0) try {
					const folded = foldScheduleEvents(agent.session.events, agent.session.header.seedLength ?? 0);
					for (const record of folded.active) lines.push(`· ${record.id} — ${record.prompt}${record.kind === "every" ? `（每 ${Math.round(record.everySeconds / 60)} 分钟）` : ""}`);
				} catch (error) {
					this.logger?.warn(`robot: routines fold failed: ${String(error)}`);
				}
				await this.reply(lines.length === 0 ? "本会话暂无定时提醒（定时任务由 dsh-routines 管理：在对应 profile 用 `dsh routines list` 查看）。" : `本会话的定时提醒：\n${lines.join("\n")}`, anchor);
				return;
			}
			case "status": {
				const agent = this.agents.get(sessionId);
				await this.reply([
					`会话 ${sessionId}`,
					`状态 ${agent === void 0 ? "未创建" : agent.status}`,
					`静音 ${this.muted.has(sessionId) ? "是" : "否"}`
				].join("\n"), anchor);
				return;
			}
			case "mute":
				this.muted.add(sessionId);
				await this.reply("已静音。发送 !unmute 解除。", anchor);
				return;
			case "unmute":
				this.muted.delete(sessionId);
				await this.reply("已解除静音。", anchor);
				return;
			case "restart": {
				const handle = this.handles.get(sessionId);
				if (handle !== void 0) {
					try {
						await handle.dispose();
					} catch (error) {
						this.logger?.warn(`robot: dispose failed on restart: ${String(error)}`);
					}
					this.handles.delete(sessionId);
				}
				this.forgetSession(sessionId);
				await this.reply("会话已重启（历史保留在 DSH 中）。", anchor);
				return;
			}
		}
	}
	/**
	* `!fork <groupId|群名> <instruction>` (S3): hand the current session's
	* context summary over to the target group's session through the full
	* inbound pipeline (ack + agent turn in the target group). The target must
	* be a surface this robot has seen; the group's own session anchors there
	* and the instruction runs as the operator.
	*/
	async runFork(rawTarget, instruction, message, anchor) {
		const trimmed = instruction.trim();
		if (rawTarget === message.groupId) {
			await this.reply("不能交接给当前群。请指定其他群的群名或 groupId（!status 可查本会话；DSH 侧 robot_status 可查全部表面）。", anchor);
			return;
		}
		const target = await this.resolveForkTarget(rawTarget);
		if (target === void 0) {
			await this.reply(`交接失败：没有找到群「${rawTarget}」（仅支持机器人已见过的群；群名或 groupId 均可）`, anchor);
			return;
		}
		const sessionId = this.resolveSession(message);
		const sourceId = this.agents.get(sessionId) !== void 0 ? sessionId : this.lastSession.get(message.groupId);
		const agent = sourceId === void 0 ? void 0 : this.agents.get(sourceId);
		const summary = agent === void 0 ? "" : conversationSummary(agent.session.events);
		const handover = summary === "" ? `${trimmed}\n\n（DSH 跨群交接：来自群 ${message.groupId} 的会话，暂无已完成轮次上下文）` : `${trimmed}\n\n（DSH 跨群交接：来自群 ${message.groupId} 的会话上下文摘要，见下）\n\n${summary}`;
		const result = await this.continueFromDsh(handover, { groupId: target.groupId });
		if (!result.ok) {
			await this.reply(`交接失败：${result.error ?? "未知错误"}`, anchor);
			return;
		}
		const label = target.name === void 0 ? target.groupId : `${target.name}（${target.groupId}）`;
		const preview = trimmed.length > 40 ? `${trimmed.slice(0, 40)}…` : trimmed;
		await this.reply(`已交接给群 ${label}：${preview}${summary === "" ? "" : `（附 ${summary.length} 字上下文摘要）`}`, anchor);
	}
	/** Resolve a `!fork` target: exact groupId first, then a lazy group-name
	* lookup over a bounded window of known surfaces. */
	async resolveForkTarget(raw) {
		const byId = await this.resolveSurface(raw);
		if (byId !== void 0) return byId.groupName === void 0 ? { groupId: raw } : {
			groupId: raw,
			name: byId.groupName
		};
		for (const surface of this.surfaceSummary().slice(0, GROUP_NAME_LOOKUP_LIMIT)) {
			const name = surface.groupName ?? await this.resolveGroupNameOf(surface.groupId);
			if (name === raw) return {
				groupId: surface.groupId,
				name
			};
		}
	}
	/** One group's human name: memory cache, then the resolver, then persist. */
	async resolveGroupNameOf(groupId) {
		const cached = this.groupNames.get(groupId);
		if (cached !== void 0) return cached;
		if (this.resolveGroupName === void 0) return void 0;
		const name = await this.resolveGroupName(groupId);
		if (name === void 0 || name === "") return void 0;
		this.groupNames.set(groupId, name);
		const state = this.surfaces.get(groupId) ?? this.surface?.get(surfaceKey(this.channelIndex, groupId));
		if (state !== void 0) this.surface?.put(surfaceKey(this.channelIndex, groupId), {
			...state,
			groupName: name
		}).catch(() => void 0);
		return name;
	}
	/**
	* `!feedback <text>` (S3): append to the local feedback log under the
	* harness home (`~/.dsh/robot-feedback.log`) and acknowledge. Delivery to a
	* maintenance group stays an explicit future option.
	*/
	async runFeedback(text, message, anchor) {
		const home = process.env.DSH_HOME ?? join(homedir(), ".dsh");
		const line = [
			`[${(/* @__PURE__ */ new Date()).toISOString()}] group=${message.groupId} robot=${message.robotId}`,
			`user=${message.operatorName}(${message.operatorOpenid})`,
			text.trim(),
			"---"
		].join("\n") + "\n";
		try {
			mkdirSync(home, { recursive: true });
			appendFileSync(join(home, "robot-feedback.log"), line, "utf8");
			await this.reply(`已记录反馈（${text.trim().length} 字）。谢谢！`, anchor);
		} catch (error) {
			this.logger?.warn(`robot: feedback log failed: ${String(error)}`);
			await this.reply("反馈记录失败（本地日志写入异常），请稍后再试。", anchor);
		}
	}
};
/**
* The group suggestion-card protocol (design §3.4 / S8): write tools fired by
* a robot session's agent are gated by the same approval waterfall as GUI
* sessions, but nobody watches a GUI card for a robot turn — so robot-yzj
* owns those requests itself. On approval it pushes a numbered suggestion
* into the conversation ("回复 确认 N / 取消 N") and resolves when an
* allow-listed reply matches, or after the timeout (cancelled).
*
* The GUI write-gate (ui-yzj) skips `yzj-robot-*` sessions so exactly one
* listener answers each request.
* @module @dsh-yzj/robot-yzj/confirm
*/
const DEFAULT_TIMEOUT_MS = 18e5;
/** Inbound reply patterns: optional @-mention prefix, then 确认/取消 + number. */
const CONFIRM_REPLY = /^\s*(?:@[^\s@]+\s*)?(确认|允许|ok|okay|取消|拒绝|no)\s*#?(\d*)\s*$/i;
/**
* One broker per host process (all robot channels share it). Routers feed it
* session contexts; the approval listener answers only `yzj-robot-*`
* sessions; inbound replies are matched against open cards.
*/
var ConfirmBroker = class {
	timeoutMs;
	timers;
	nextNumber = 1;
	cards = /* @__PURE__ */ new Map();
	sessionContext = /* @__PURE__ */ new Map();
	askByCallId = /* @__PURE__ */ new Map();
	constructor(options = {}) {
		this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
		this.timers = options.timers ?? {
			setTimeout: (h, ms) => setTimeout(h, ms),
			clearTimeout: (h) => clearTimeout(h)
		};
	}
	/** Routers call this on every authorized inbound message. */
	registerSession(sessionId, context) {
		this.sessionContext.set(String(sessionId), context);
		if (this.sessionContext.size > 200) {
			const oldest = this.sessionContext.keys().next().value;
			if (oldest !== void 0) this.sessionContext.delete(oldest);
		}
	}
	/** Feed of `yzj/ask-pending` broadcasts (level + args for the digest). */
	noteAsk(pending) {
		this.askByCallId.set(pending.callId, pending);
		if (this.askByCallId.size > 200) {
			const oldest = this.askByCallId.keys().next().value;
			if (oldest !== void 0) this.askByCallId.delete(oldest);
		}
	}
	/** The approval/request waterfall slice this broker owns. */
	handleApproval(req, next) {
		const sessionId = req.agent.session.id;
		if (!sessionId.startsWith("yzj-robot-")) return next();
		const context = this.sessionContext.get(sessionId);
		if (context === void 0) return next();
		const ask = req.callId === void 0 ? void 0 : this.askByCallId.get(req.callId);
		const number = this.nextNumber;
		this.nextNumber += 1;
		const digest = digestOf(ask?.args, ask?.reason ?? req.reason ?? "");
		const card = {
			number,
			sessionId,
			context,
			toolName: req.toolName,
			digest,
			level: ask?.level ?? "standard",
			resolve: void 0,
			timer: null,
			removeAbort: void 0
		};
		const timeoutMinutes = Math.max(1, Math.round(this.timeoutMs / 6e4));
		context.sender.sendCard({
			appName: "DSH 助手",
			title: `${card.level === "strong" ? "🔴 高风险写操作待确认" : "🔒 写操作待确认"} [${number}]`,
			customStyle: 1,
			primaryContent: `工具 ${req.toolName}`,
			body: [
				...digest === "" ? [] : [`内容：${digest}`],
				`回复「确认 ${number}」执行，或「取消 ${number}」放弃`,
				`${timeoutMinutes} 分钟内有效`
			].join("\n"),
			...context.group ? { notifyOpenIds: [context.askerOpenId] } : {}
		});
		return new Promise((resolve) => {
			const settle = (outcome) => {
				this.timers.clearTimeout(card.timer);
				card.removeAbort?.();
				card.removeAbort = void 0;
				card.resolve = void 0;
				this.cards.delete(number);
				context.sender.sendCard({
					appName: "DSH 助手",
					title: outcome === "allowed-once" ? `✅ [${number}] 已确认，执行中…` : `🚫 [${number}] 已${outcome === "rejected" ? "取消" : "超时失效"}。`,
					customStyle: 1,
					primaryContent: `工具 ${card.toolName}`,
					body: outcome === "allowed-once" ? "确认已放行，结果稍后回复。" : outcome === "rejected" ? "本次操作已放弃。" : "确认超时，操作未执行。",
					...context.group ? { notifyOpenIds: [context.askerOpenId] } : {}
				}).catch(() => void 0);
				resolve(outcome);
			};
			card.resolve = settle;
			card.timer = this.timers.setTimeout(() => {
				settle("cancelled");
			}, this.timeoutMs);
			const onAbort = () => {
				settle("cancelled");
			};
			card.removeAbort = () => req.signal?.removeEventListener("abort", onAbort);
			req.signal?.addEventListener("abort", onAbort, { once: true });
			this.cards.set(number, card);
		});
	}
	/**
	* Match one authorized inbound message against open cards. A leading
	* @-mention (group surfaces deliver only @-addressed messages) is ignored.
	* @returns true when the message was consumed as a confirmation reply.
	*/
	checkReply(message) {
		const content = message.content.replace(/^\s*@[^\s@]+\s*/, "");
		const match = CONFIRM_REPLY.exec(content);
		if (match === null) return false;
		const verb = match[1] ?? "";
		const rawNumber = match[2] ?? "";
		const approve = /^(确认|允许|ok|okay)$/i.test(verb);
		let card;
		if (rawNumber === "") {
			const candidates = [...this.cards.values()].filter((entry) => sameConversation(entry, message));
			if (candidates.length === 1) card = candidates[0];
		} else {
			const numbered = this.cards.get(Number(rawNumber));
			if (numbered !== void 0 && sameConversation(numbered, message)) card = numbered;
		}
		if (card === void 0) return false;
		card.resolve?.(approve ? "allowed-once" : "rejected");
		return true;
	}
	/** Open-card count (diagnostics/tests). */
	get openCards() {
		return this.cards.size;
	}
	/** Tear every open card down as cancelled (channel stop). */
	dispose() {
		for (const card of [...this.cards.values()]) card.resolve?.("cancelled");
		this.cards.clear();
		this.sessionContext.clear();
		this.askByCallId.clear();
	}
};
/** Whether one card belongs to the conversation the reply arrived in. */
function sameConversation(card, message) {
	if (card.context.robotId !== message.robotId) return false;
	return card.context.group ? message.groupId === card.context.groupId && !message.groupId.startsWith("BOT-") : message.groupId.startsWith("BOT-") && message.operatorOpenid === card.context.askerOpenId;
}
/** Short human digest of the gated write's args. */
function digestOf(args, reason) {
	const parts = [];
	if (args !== void 0) for (const key of [
		"content",
		"title",
		"name",
		"records",
		"filename"
	]) {
		const value = args[key];
		if (typeof value === "string" && value !== "") parts.push(value.slice(0, 80));
		else if (Array.isArray(value)) parts.push(JSON.stringify(value).slice(0, 80));
	}
	if (parts.length === 0 && reason !== "") parts.push(reason.slice(0, 80));
	return parts.join("；");
}
/**
* Event-driven push hub: the single place robot-session output becomes
* conversation messages. The service feeds it the host firehose
* (`session/event`) plus agent lifecycle (`agent/status`, `agent/error`);
* routers register each conversation's outbound context on every inbound
* message. Because pushing is decoupled from the inbound dispatch path, ANY
* turn source reaches the conversation — interactive replies, scheduled
* reminders, watchers — closing the Claude-Tag routines-delivery gap.
*
* Push behavior: assistant text accumulates per session above a watermark
* and flushes when the agent goes idle (reply-anchored to the last inbound
* message; group surfaces notify the asker). Long turns emit a milestone
* line every 5 tool calls (unnotified, rate-limited). Agent errors surface
* as a bounded failure line instead of silence.
* @module @dsh-yzj/robot-yzj/push
*/
/** How many tool calls between milestone lines. */
const MILESTONE_EVERY = 5;
/**
* The hub. One instance per host process, shared by every channel router;
* conversation ids (session ids) are globally unique.
* @param guiUrl - optional DSH GUI base URL; final answers get a
* session-record line (S2 deep-link analogue — the GUI has no session URL
* route, so the link is the GUI root plus the searchable session id).
*/
var PushHub = class {
	guiUrl;
	conversations = /* @__PURE__ */ new Map();
	stashes = /* @__PURE__ */ new Map();
	watermarks = /* @__PURE__ */ new Map();
	constructor(guiUrl = void 0) {
		this.guiUrl = guiUrl;
	}
	/** Routers call this on every authorized inbound message. */
	register(sessionId, conversation) {
		this.conversations.set(String(sessionId), conversation);
		if (this.conversations.size > 300) {
			const oldest = this.conversations.keys().next().value;
			if (oldest !== void 0) this.conversations.delete(oldest);
		}
	}
	/** Drop one conversation's live state (router dispose / !restart). */
	forget(sessionId) {
		const key = String(sessionId);
		this.conversations.delete(key);
		this.stashes.delete(key);
		this.watermarks.delete(key);
	}
	/** `session/event` slice for robot sessions; ignores unknown sessions. */
	noteEvent(sessionId, event) {
		const conversation = this.conversations.get(sessionId);
		if (conversation === void 0) return;
		if (event.type === "assistant/message") {
			const stash = this.stashOf(sessionId);
			const watermark = this.watermarks.get(sessionId) ?? -1;
			if (event.seq <= watermark) return;
			for (const block of event.data.message?.content ?? []) if (block.type === "text" && block.text !== void 0 && block.text !== "") stash.parts.push(block.text);
			if (event.seq > stash.topSeq) stash.topSeq = event.seq;
			return;
		}
		if (event.type === "tool/call") {
			const stash = this.stashOf(sessionId);
			stash.toolCalls += 1;
			if (stash.toolCalls >= stash.nextMilestone) {
				stash.nextMilestone += MILESTONE_EVERY;
				this.sendSafely(conversation, `⏳ 进行中：已执行 ${stash.toolCalls} 个工具步骤…`);
			}
		}
	}
	/** `agent/status` idle transition: flush the accumulated answer. */
	noteIdle(sessionId) {
		const conversation = this.conversations.get(sessionId);
		const stash = this.stashes.get(sessionId);
		if (conversation === void 0 || stash === void 0) return;
		this.stashes.delete(sessionId);
		if (stash.topSeq >= 0) this.watermarks.set(sessionId, stash.topSeq);
		let answer = stash.parts.join("");
		if (answer === "") return;
		if (this.guiUrl !== void 0 && this.guiUrl !== "") answer += `\n\n📎 本任务完整记录：${this.guiUrl}（DSH 会话 ${sessionId}）`;
		this.sendSafely(conversation, answer, true);
	}
	/** `agent/error` slice: bounded failure line instead of silence. */
	noteError(sessionId, error) {
		const conversation = this.conversations.get(sessionId);
		if (conversation === void 0) return;
		const text = String(error).slice(0, 300);
		this.sendSafely(conversation, `⚠️ 处理失败：${text}`);
	}
	/** Send with the conversation's reply anchor; notify only final answers. */
	async sendSafely(conversation, text, notify = false) {
		try {
			await conversation.sender.send(text, {
				...conversation.noReplyAnchor === true ? {} : {
					replyMsgId: conversation.lastInbound.msgId,
					replySummary: conversation.lastInbound.summary,
					replyPersonName: conversation.lastInbound.personName
				},
				...notify && conversation.group ? { notifyOpenIds: [conversation.askerOpenId] } : {}
			});
		} catch {}
	}
	/** Diagnostic snapshot: open conversations, active stashes, watermarks. */
	diagnostics() {
		const activeTurns = [];
		for (const [sessionId, stash] of this.stashes) activeTurns.push({
			sessionId,
			parts: stash.parts.length,
			toolCalls: stash.toolCalls
		});
		return {
			conversations: this.conversations.size,
			activeTurns,
			watermarks: this.watermarks.size
		};
	}
	/** Lazy stash allocation for one session's active turn. */
	stashOf(sessionId) {
		let stash = this.stashes.get(sessionId);
		if (stash === void 0) {
			stash = {
				parts: [],
				topSeq: -1,
				toolCalls: 0,
				nextMilestone: MILESTONE_EVERY
			};
			this.stashes.set(sessionId, stash);
		}
		return stash;
	}
};
const memoryRowSchema = z$1.object({ lines: z$1.array(z$1.string().min(1).max(400)) });
/** Durable domain declaration: one table keyed by conversation key. */
const robotMemoryDomainSpec = defineDomain({
	name: "robot_yzj_memory",
	version: 0,
	tables: { conversations: domainTable(memoryRowSchema) }
});
/** Read/write face over the opened memory domain. */
var MemoryStore = class {
	table;
	/**
	* Open (or adopt) the domain; safe to await repeatedly.
	* @param facility - the `ctx.storageDomain` facility.
	*/
	async open(facility) {
		if (this.table !== void 0) return;
		const domain = await facility.open(robotMemoryDomainSpec);
		this.table = domain.table("conversations");
	}
	/** Close the domain (idempotent). */
	async close() {
		this.table = void 0;
	}
	/** One conversation's lines ('' entries never stored). */
	lines(key) {
		return this.table?.get(key)?.lines ?? [];
	}
	/** All memories as lossless JSON entries. */
	entries() {
		const out = [];
		for (const [key, row] of this.table?.entries() ?? []) out.push({
			key,
			lines: row.lines
		});
		return out;
	}
	/** Append one line (deduped, capped); reports the resulting set. */
	async remember(key, line) {
		const trimmed = line.trim().slice(0, 400);
		const existing = [...this.lines(key)];
		if (trimmed !== "" && !existing.includes(trimmed)) {
			existing.push(trimmed);
			while (existing.length > 30) existing.shift();
			await this.table?.put(key, { lines: existing });
			return {
				lines: existing,
				note: "已记住"
			};
		}
		return {
			lines: existing,
			note: existing.includes(trimmed) ? "这条已经在记忆里了" : "内容为空，未记录"
		};
	}
	/** Remove lines containing the substring; reports how many went. */
	async forget(key, substring) {
		const needle = substring.trim().toLowerCase();
		const existing = this.lines(key);
		const kept = existing.filter((line) => !line.toLowerCase().includes(needle));
		const removed = existing.length - kept.length;
		if (removed > 0) {
			if (kept.length === 0) await this.table?.delete(key);
			else await this.table?.put(key, { lines: kept });
		}
		return {
			lines: kept,
			note: removed > 0 ? `已忘掉 ${removed} 条` : "没有匹配的记忆"
		};
	}
};
/**
* The Yunzhijia `ctx.chatnode` provider: the delivery contract dsh-routines
* (and any other scheduled-agent engine) consumes to push run digests into a
* robot conversation. `send({ text, title })` becomes a proactive robot
* message on the configured channel (a group robot pushes to its group, a
* personal robot to its DM) — the FIRST real implementation of the chatnode
* contract in the DSH ecosystem (reference study:
* docs/spec/routines-delivery.md §2). Only one chatnode provider may exist
* per profile (Cordis same-name service collision), so a WeChat node and this
* node cannot coexist on one profile.
* @module @dsh-yzj/robot-yzj/chatnode
*/
/**
* The chatnode service: `send` prefixes the title, then pushes through the
* robot channel's outbound. Delivery failures are contained — the scheduler
* records them in its `deliveries` array and never crashes.
*/
var YzjChatnode = class extends Service {
	static inject = ["yzjRobot"];
	robot;
	robotIndex;
	/**
	* @param ctx - plugin context (provides the service as `ctx.chatnode`).
	* @param robot - the robot-channel service the send delegates to.
	* @param robotIndex - which channel to push to (notify semantics).
	*/
	constructor(ctx, robot, robotIndex) {
		super(ctx, "chatnode");
		this.robot = robot;
		this.robotIndex = robotIndex;
	}
	/** Push one digest into the robot conversation. */
	async send(input) {
		const body = input.title === void 0 || input.title === "" ? input.text : `${input.title}\n\n${input.text}`;
		const result = await this.robot.notify(body, this.robotIndex);
		if (!result.ok) throw new Error(`yzj chatnode send failed: ${result.error ?? "unknown"}`);
	}
};
/**
* Chatnode bridge — cross-process delivery between an ops scheduler daemon
* (dsh-routines) and the robot channels hosted by the web profile, with no
* second robot connection and no robot credentials on the ops side.
*
* Two halves of the same contract (`ChatnodeService`, the dsh-routines
* delivery interface):
*
* - `ChatnodeBridge` (bridge listener, web profile): an exact HTTP route on
*   the profile's `webServer` (`POST /yzj/chatnode`). It authenticates a
*   shared bearer token, validates the JSON body, and pushes through the
*   robot channel's outbound via `notify` — one channel index from config
*   (`chatnodeRobotIndex`) when the caller does not choose one.
* - `ChatnodeBridgeClient` (bridge client, ops profile): a `ctx.chatnode`
*   provider whose `send` POSTs to the listener. It holds only the target
*   URL and the shared token — no sendMsgUrl, no WebSocket, no session
*   machinery.
*
* The web profile's server binds loopback only (the web-app startup fence
* rejects non-loopback hosts), so the surface is localhost-local; the token
* is defense in depth, and route registration is opt-in via `bridgeToken`.
* @module @dsh-yzj/robot-yzj/bridge
*/
/** Body-size cap for one bridge request (digests are bounded by the sender). */
const MAX_BODY_BYTES = 262144;
/** Client request timeout; a wedged listener must not wedge the scheduler. */
const CLIENT_TIMEOUT_MS = 15e3;
/** Read a request body with a hard size cap; rejects on overflow. */
function readBody(req, cap) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		let size = 0;
		req.on("data", (chunk) => {
			size += chunk.length;
			if (size > cap) {
				req.destroy();
				reject(/* @__PURE__ */ new Error(`body exceeds ${cap} bytes`));
				return;
			}
			chunks.push(chunk);
		});
		req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
		req.on("error", reject);
	});
}
/** Write one JSON response (optional extra headers merged in). */
function json(res, status, body, extraHeaders = {}) {
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		...extraHeaders
	});
	res.end(JSON.stringify(body));
}
/** Constant-time bearer check: `Authorization: Bearer <token>`. */
function authorized(req, token) {
	const expected = `Bearer ${token}`;
	const actual = req.headers.authorization ?? "";
	if (expected.length !== actual.length) return false;
	return timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}
/**
* Bridge listener: one webServer route owning the full request/response
* lifecycle of `POST /yzj/chatnode`. Never throws across the handler seam —
* every failure is a JSON error response (400/401/405/502), so a malformed
* request cannot take down the web process.
*/
var ChatnodeBridge = class {
	options;
	constructor(options) {
		this.options = options;
	}
	/** Handle one request; answers and ends the response. */
	async handle(req, res) {
		if (req.method !== "POST") {
			json(res, 405, {
				ok: false,
				error: "method not allowed"
			}, { allow: "POST" });
			return;
		}
		if (!authorized(req, this.options.token)) {
			json(res, 401, {
				ok: false,
				error: "unauthorized"
			});
			return;
		}
		let raw;
		try {
			raw = await readBody(req, MAX_BODY_BYTES);
		} catch {
			json(res, 400, {
				ok: false,
				error: "request body too large"
			});
			return;
		}
		let payload;
		try {
			payload = JSON.parse(raw);
		} catch {
			json(res, 400, {
				ok: false,
				error: "invalid json body"
			});
			return;
		}
		if (typeof payload.text !== "string" || payload.text.trim() === "") {
			json(res, 400, {
				ok: false,
				error: "text must be a non-empty string"
			});
			return;
		}
		const title = typeof payload.title === "string" && payload.title !== "" ? payload.title : void 0;
		const robotIndex = Number.isInteger(payload.robotIndex) ? payload.robotIndex : this.options.defaultRobotIndex;
		const body = title === void 0 ? payload.text : `${title}\n\n${payload.text}`;
		const result = await this.options.robot.notify(body, robotIndex);
		if (!result.ok) {
			json(res, 502, {
				ok: false,
				error: result.error ?? "delivery failed"
			});
			return;
		}
		json(res, 200, {
			ok: true,
			...result.msgId === void 0 ? {} : { msgId: result.msgId }
		});
	}
};
/**
* Bridge client: the `ctx.chatnode` provider for a profile without robot
* channels. `send` POSTs the digest to the listener with the shared token;
* failures throw (the scheduler records them in its `deliveries` array and
* never crashes). Title prefixing happens on the listener side, keeping the
* wire format raw contract fields.
*/
var ChatnodeBridgeClient = class extends Service {
	target;
	token;
	static inject = [];
	/**
	* @param ctx - plugin context (provides the service as `ctx.chatnode`).
	* @param target - full listener URL, e.g. `http://127.0.0.1:3080/yzj/chatnode`.
	* @param token - shared bearer token the listener requires.
	*/
	constructor(ctx, target, token) {
		super(ctx, "chatnode");
		this.target = target;
		this.token = token;
	}
	/** Push one digest to the bridge listener. */
	async send(input) {
		let res;
		try {
			res = await fetch(this.target, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					authorization: `Bearer ${this.token}`
				},
				body: JSON.stringify({
					text: input.text,
					...input.title === void 0 || input.title === "" ? {} : { title: input.title }
				}),
				signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS)
			});
		} catch (error) {
			throw new Error(`yzj chatnode bridge unreachable: ${error instanceof Error ? error.message : String(error)}`);
		}
		let data = null;
		try {
			data = await res.json();
		} catch {}
		if (!res.ok) {
			const detail = typeof data?.error === "string" ? ` ${data.error}` : "";
			throw new Error(`yzj chatnode bridge: HTTP ${res.status}${detail}`);
		}
		if (data?.ok !== true) throw new Error("yzj chatnode bridge: listener answered 2xx without ok:true — route not active?");
	}
};
/**
* Ops-daemon autostart: `dsh web` brings the dsh-routines scheduler up with
* it. The web profile cannot host the scheduler (no job controller; see
* docs/spec/routines-delivery.md §5.1), so robot-yzj spawns the base-only
* ops daemon as a detached child through a small wrapper (`ops-wrapper.mjs`)
* that records the daemon pid in `<home>/ops.pid`. Every launch path —
* robot-yzj autostart, ops-daemon.cmd, start-all.cmd — goes through the same
* pid-file idempotence: a live pid means the daemon is already up, and no
* launch double-starts it.
* @module @dsh-yzj/robot-yzj/ops-autostart
*/
/** Default ops pid-file location under a DSH home. */
function opsPidPath(home) {
	return join(home, "ops.pid");
}
/** Default ops wrapper location (spawned through `node <wrapper>`). */
function opsWrapperPath(home) {
	return join(home, "ops-wrapper.mjs");
}
/** Read a pid from the ops pid file; undefined when absent or malformed. */
function readOpsPid(pidPath) {
	try {
		const raw = readFileSync(pidPath, "utf8").trim();
		const pid = Number(raw);
		return Number.isInteger(pid) && pid > 0 ? pid : void 0;
	} catch {
		return;
	}
}
/** Whether a pid names a live process (signal 0 probe). */
function pidAlive(pid) {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}
/**
* Bring the ops daemon up unless it is already running (pid file + liveness
* probe) or the wrapper is missing. Fire-and-forget: the spawn is detached
* and unref'd, so the daemon outlives the web process and the web boot never
* blocks on it. Never throws.
*/
function maybeAutoStartOps(options) {
	const { home, opsCwd, logger } = options;
	const isAlive = options.isAlive ?? pidAlive;
	const pidPath = opsPidPath(home);
	const wrapperPath = opsWrapperPath(home);
	const pid = readOpsPid(pidPath);
	if (pid !== void 0 && isAlive(pid)) {
		logger?.info(`robot: ops daemon already running (pid ${pid}); autostart skipped`);
		return;
	}
	if (!existsSync(wrapperPath)) {
		logger?.warn(`robot: autoStartOps enabled but wrapper missing at ${wrapperPath} — run scripts/setup-ops.mjs`);
		return;
	}
	const spawner = options.spawner ?? ((path, cwd) => {
		const child = spawn(process.execPath, [path], {
			cwd,
			detached: true,
			stdio: "ignore"
		});
		child.unref();
		return child;
	});
	try {
		spawner(wrapperPath, opsCwd).on("error", (error) => {
			logger?.warn(`robot: ops daemon spawn failed: ${String(error)}`);
		});
		logger?.info(`robot: ops daemon autostarted via ${wrapperPath}`);
	} catch (error) {
		logger?.warn(`robot: ops daemon autostart failed: ${String(error)}`);
	}
}
/** Convenience: the default DSH home (DSH_HOME or ~/.dsh). */
function dshHomeOf() {
	const env = process.env.DSH_HOME;
	return env !== void 0 && env.trim() !== "" ? env.trim() : join(homedir(), ".dsh");
}
/**
* DSH-side bidirectional robot controls: the model-facing tools that let the
* operator drive robot channels from any harness session — proactive
* notifications (`robot_notify`), conversation continuation (`robot_continue`,
* fabricates an operator turn through the full inbound pipeline), and session
* fork (`robot_fork`, seeds a new operator session with a robot
* conversation's completed-turn history). These are operator-trusted channels:
* unlike the yzj write family they are deliberately NOT gated by the
* confirmation guard — the robot is the operator's own bot, its outbound is
* already allowFrom-restricted, and the tool bodies refuse to run inside
* robot sessions themselves.
* @module @dsh-yzj/robot-yzj/control
*/
/** Shared output contract (mirrors the yzj tool family's shape). */
const controlOutput = {
	schema: {
		type: "object",
		additionalProperties: false,
		properties: {
			content: {
				type: "string",
				required: true
			},
			truncated: {
				type: "boolean",
				required: true
			},
			data: { type: "json" }
		}
	},
	render: (_args, value) => [{
		type: "text",
		text: value.content
	}],
	presentationMeta: (_args, value) => value.data ?? null
};
/** Reject calls originating inside robot sessions (no self-driving). */
function operatorOnly(sessionId) {
	if (typeof sessionId === "string" && sessionId.startsWith("yzj-robot-")) throw new Error("robot_* 工具仅限操作者会话使用，机器人会话不能驱动自身");
}
/**
* Register the robot control tools on one context.
* @param ctx - Cordis context carrying the tools registry.
* @param robot - the live robot-channel service.
*/
function applyRobotControlTools(ctx, robot) {
	ctx.tools.register(defineTool({
		name: "robot_status",
		description: "Inspect every Yunzhijia robot channel: connection state, resolved working directory (cwd), provider/model route, allowFrom, every conversation surface the channel has seen (groupId + robotId + last anchored session id), and live session ids. Use this first to discover session ids for robot_continue / robot_fork.",
		parameters: {},
		output: controlOutput,
		timeoutMs: 1e4,
		isConcurrencySafe: () => true,
		async execute(_args, exec) {
			operatorOnly(exec.agent?.session.id);
			const channels = robot.statuses();
			const lines = channels.map((channel) => {
				const parts = [
					`#${channel.index} ${channel.connected ? "已连接" : `断开(${channel.lastError ?? "unknown"})`}`,
					`cwd=${channel.cwd}`,
					`route=${channel.provider === "" ? "(默认)" : channel.provider}${channel.model === "" ? "" : ` / ${channel.model}`}`
				];
				if (channel.surface.length > 0) for (const surface of channel.surface) parts.push(`  surface ${surface.groupId} robot=${surface.robotId}${surface.lastSessionId === void 0 ? "" : ` lastSession=${surface.lastSessionId}`}`);
				else parts.push("  (尚未收到入站消息)");
				if (channel.sessions.length > 0) parts.push(`  live sessions: ${channel.sessions.join(", ")}`);
				return parts.join("\n");
			});
			return {
				content: channels.length === 0 ? "(未配置任何机器人通道)" : lines.join("\n\n"),
				truncated: false,
				data: { channels }
			};
		}
	}));
	ctx.tools.register(defineTool({
		name: "robot_notify",
		description: "Proactive notification: push a text message to one robot channel's conversation (a group robot pushes to its group, a personal robot to its DM) without any agent turn. Use for digests, alerts, and routine deliveries the operator initiates from DSH.",
		parameters: {
			text: {
				type: "string",
				required: true,
				description: "Message body to push."
			},
			robotIndex: {
				type: "number",
				description: "Channel index (robot_status lists them); default 0."
			}
		},
		output: controlOutput,
		timeoutMs: 3e4,
		isConcurrencySafe: () => false,
		async execute(args, exec) {
			operatorOnly(exec.agent?.session.id);
			const result = await robot.notify(args.text, args.robotIndex ?? 0);
			if (!result.ok) throw new Error(`robot_notify 推送失败：${result.error ?? "unknown"}`);
			return {
				content: `已通过机器人通道 ${args.robotIndex ?? 0} 推送消息${result.msgId === void 0 ? "" : `（msgId ${result.msgId}）`}`,
				truncated: false,
				data: {
					ok: true,
					msgId: result.msgId ?? null
				}
			};
		}
	}));
	ctx.tools.register(defineTool({
		name: "robot_continue",
		description: "Bidirectional continuation: inject an operator turn into a robot conversation as if the operator had typed it. The full inbound pipeline runs — ack to the conversation, memory injection, agent processing, answer pushed back to the group/DM. Bang commands (!help/!status/!routines/!mute/…) also work through it. Requires the whitelisted operator identity (allowFrom).",
		parameters: {
			text: {
				type: "string",
				required: true,
				description: "The message to inject as the operator."
			},
			robotIndex: {
				type: "number",
				description: "Channel index (robot_status lists them); default 0."
			},
			groupId: {
				type: "string",
				description: "Explicit conversation surface (groupId); default = the most recent surface the channel saw."
			}
		},
		output: controlOutput,
		timeoutMs: 3e4,
		isConcurrencySafe: () => false,
		async execute(args, exec) {
			operatorOnly(exec.agent?.session.id);
			const result = await robot.continueConversation(args.text, {
				...args.robotIndex === void 0 ? {} : { robotIndex: args.robotIndex },
				...args.groupId === void 0 ? {} : { groupId: args.groupId }
			});
			if (!result.ok) throw new Error(`robot_continue 失败：${result.error ?? "unknown"}`);
			return {
				content: `已把操作者消息注入会话 ${result.sessionId ?? "(未锚定)"}，机器人会回复到该会话${args.groupId === void 0 ? "" : `（群 ${args.groupId}）`}。`,
				truncated: false,
				data: {
					ok: true,
					sessionId: result.sessionId ?? null
				}
			};
		}
	}));
	ctx.tools.register(defineTool({
		name: "robot_fork",
		description: "Fork a robot conversation into a NEW operator-side session seeded with its completed-turn history (balanced prefix through the last turn/end). The fork appears in the DSH session list where it can be opened and continued with the full harness toolset; its cwd and parentSession lineage point at the source. Returns the new session id.",
		parameters: { sessionId: {
			type: "string",
			required: true,
			description: "Source session id (yzj-robot-… from robot_status)."
		} },
		output: controlOutput,
		timeoutMs: 6e4,
		isConcurrencySafe: () => false,
		async execute(args, exec) {
			operatorOnly(exec.agent?.session.id);
			const result = await robot.forkSession(args.sessionId);
			if (!result.ok) throw new Error(`robot_fork 失败：${result.error ?? "unknown"}`);
			return {
				content: `已从 ${args.sessionId} fork 出会话 ${result.sessionId}。可在 DSH 会话列表打开它继续处理（继承源会话的全部已完成回合与工作目录）。`,
				truncated: false,
				data: {
					ok: true,
					forkSessionId: result.sessionId ?? null,
					sourceSessionId: args.sessionId
				}
			};
		}
	}));
}
/**
* Group shared-workspace tools (design §8.4): `robot_share_write` and
* `robot_share_list` are the ONLY write channel into a group's shared
* directory (`<cwd>/groups/<groupId>/shared/`). Harness file tools stay
* sandboxed inside each session's private workspace, so the plugin's host
* process writes the shared area directly — the permission boundary IS the
* channel boundary and robot sessions never need elevated sandbox rights.
* Unlike the operator-only `robot_*` control tools, these are callable from
* every session: robot sessions place deliverables here, operator sessions
* place shared materials. Write conflicts resolve by automatic unique naming
* (report.md → report-2.md) unless `overwrite: true` is explicit.
* @module @dsh-yzj/robot-yzj/share
*/
/**
* Register the group shared-workspace tools on one context. The write tool is
* gated by the approval guard (WRITE_SPECS, standard level) — GUI sessions
* answer via the GUI confirmation card, robot sessions via the in-group
* suggestion card.
* @param ctx - Cordis context carrying the tools registry.
* @param robot - the live robot-channel service.
*/
function applyRobotShareTools(ctx, robot) {
	ctx.tools.register(defineTool({
		name: "robot_share_write",
		description: "Write a text file into a group's shared workspace — the explicit cross-thread collaboration area for robot group conversations (design §8.4), located at <cwd>/groups/<groupId>/shared/. Existing same-named files get an automatic unique suffix (report.md → report-2.md, the original stays untouched) unless overwrite:true. This is the ONLY way to write the shared area: harness write tools are sandboxed inside the session's private workspace and would be denied on this path. Callable from any session — robot sessions place deliverables here, operator sessions place shared materials.",
		parameters: {
			groupId: {
				type: "string",
				description: "Target group surface (robot_status lists them); default = the channel's most recent surface."
			},
			filename: {
				type: "string",
				required: true,
				description: "File name; path separators, Windows-reserved characters, and empty names are rejected."
			},
			content: {
				type: "string",
				required: true,
				description: "UTF-8 text content to write."
			},
			overwrite: {
				type: "boolean",
				description: "Replace an existing same-named file; default false (unique suffix instead)."
			},
			robotIndex: {
				type: "number",
				description: "Channel index (robot_status lists them); default 0."
			}
		},
		output: controlOutput,
		timeoutMs: 15e3,
		isConcurrencySafe: () => false,
		async execute(args, _exec) {
			const result = await robot.shareWrite(args.robotIndex ?? 0, args.groupId, args.filename, args.content, args.overwrite === true);
			if (!result.ok) throw new Error(`robot_share_write 失败：${result.error ?? "unknown"}`);
			return {
				content: `已写入群共享工作区：${result.path}${result.existed === true ? `（目标原本存在，已自动唯一化为 ${result.name}，原文件未动）` : ""}`,
				truncated: false,
				data: {
					ok: true,
					path: result.path ?? null,
					name: result.name ?? null,
					existed: result.existed ?? false
				}
			};
		}
	}));
	ctx.tools.register(defineTool({
		name: "robot_share_list",
		description: "List the files of a group's shared workspace (name / size / mtime, most recently modified first). Use this BEFORE robot_share_write to see what other topics have placed there and pick a non-colliding name.",
		parameters: {
			groupId: {
				type: "string",
				description: "Target group surface (robot_status lists them); default = the channel's most recent surface."
			},
			robotIndex: {
				type: "number",
				description: "Channel index (robot_status lists them); default 0."
			}
		},
		output: controlOutput,
		timeoutMs: 1e4,
		isConcurrencySafe: () => true,
		async execute(args, _exec) {
			const result = robot.shareList(args.robotIndex ?? 0, args.groupId);
			if (!result.ok) throw new Error(`robot_share_list 失败：${result.error ?? "unknown"}`);
			const files = result.files ?? [];
			return {
				content: files.length === 0 ? `群共享工作区（${result.dir}）暂无文件。` : `群共享工作区（${result.dir}）共 ${files.length} 个文件：\n${files.map((entry) => `· ${entry.name}（${entry.size} B，${new Date(entry.mtime).toISOString()}）`).join("\n")}`,
				truncated: false,
				data: {
					ok: true,
					dir: result.dir ?? null,
					files
				}
			};
		}
	}));
}
/**
* Host plugin for the Yunzhijia robot channel: wires the measured inbound
* WebSocket (protocol.ts / socket.ts), the outbound sender (outbound.ts), and
* the session router (router.ts) into one Cordis service (`ctx.yzjRobot`).
* One channel per configured robot (personal DM robot, group conversation
* robot, …), each with its own socket, sender, and router. Lifecycle is
* effect-owned — stop/unload closes every socket, cancels every timer, and
* leaves no residue. The allowFrom policy resolves the CLI login user's openId
* through the bridge (`contact user get`), so by default only the machine's
* owner can drive the robots.
* @module @dsh-yzj/robot-yzj
*/
/** Plugin name used by loader diagnostics. */
const name = "robot-yzj";
/** Required services: the agent registry (robot sessions) and the tools registry (robot_* controls). The CLI bridge is optional (allowFrom resolution only). */
const inject = ["agents", "tools"];
const RobotChannelSchema = z.object({
	sendMsgUrl: z.string(),
	enabled: z.boolean().default(true),
	allowFrom: z.array(z.string()).default([]),
	provider: z.string().default(""),
	model: z.string().default(""),
	cwd: z.string().default("")
});
const ConfigSchema = z.object({
	defaultProvider: z.string().default(""),
	defaultModel: z.string().default(""),
	defaultCwd: z.string().default(""),
	robots: z.array(RobotChannelSchema).default([]),
	sendMsgUrl: z.string().default(""),
	enabled: z.boolean().default(true),
	allowFrom: z.array(z.string()).default([]),
	provider: z.string().default(""),
	model: z.string().default(""),
	cwd: z.string().default(""),
	chatnodeRobotIndex: z.number().default(0),
	bridgeToken: z.string().default(""),
	bridgeTarget: z.string().default(""),
	guiUrl: z.string().default(""),
	autoStartOps: z.boolean().default(false),
	opsCwd: z.string().default(""),
	channelsFile: z.string().default("")
});
const DEFAULT_ACK_TEXT = "收到，处理中…";
const DEFAULT_DENY_TEXT = "抱歉，你不在本机器人的白名单内。";
/**
* The robot-channel service: one managed connection per configured robot.
* `send()` is the proactive-push entry on channel 0; `statuses()` feeds the
* panel; inbound turns flow through each channel's router into agent sessions.
*/
var YzjRobot = class extends Service {
	static Config = ConfigSchema;
	static inject = ["agents", "tools"];
	channels = [];
	overrides = new OverrideStore();
	surfaces = new SurfaceStore();
	confirm = new ConfirmBroker();
	hub;
	memory = new MemoryStore();
	guiUrl;
	/** Config snapshot for the settings-card save path (seed fallback). */
	config;
	/** The settings card's channel file (design §8.5); undefined = file not configured. */
	channelsFile;
	/** Operator-side fork sessions created from robot conversations (owned here). */
	forked = /* @__PURE__ */ new Map();
	constructor(ctx, config) {
		super(ctx, "yzjRobot");
		this.config = config;
		this.guiUrl = config.guiUrl ?? "";
		this.hub = new PushHub(this.guiUrl === "" ? void 0 : this.guiUrl);
		this.channelsFile = config.channelsFile === void 0 || config.channelsFile === "" ? join(homedir(), ".dsh", "robot-channels.json") : config.channelsFile;
		const source = this.channelsFile === void 0 ? void 0 : loadChannelsFile(this.channelsFile);
		const defaults = source ?? {
			defaultProvider: config.defaultProvider,
			defaultModel: config.defaultModel,
			defaultCwd: config.defaultCwd
		};
		const fillDefaults = (robot) => ({
			...robot,
			...robot.provider === void 0 || robot.provider === "" ? defaults.defaultProvider === void 0 || defaults.defaultProvider === "" ? {} : { provider: defaults.defaultProvider } : {},
			...robot.model === void 0 || robot.model === "" ? defaults.defaultModel === void 0 || defaults.defaultModel === "" ? {} : { model: defaults.defaultModel } : {},
			...robot.cwd === void 0 || robot.cwd === "" ? defaults.defaultCwd === void 0 || defaults.defaultCwd === "" ? { cwd: deriveRobotWorkspace(robot.sendMsgUrl) } : { cwd: defaults.defaultCwd } : {}
		});
		const configured = source !== void 0 ? source.robots : config.robots !== void 0 && config.robots.length > 0 ? config.robots : config.sendMsgUrl === void 0 || config.sendMsgUrl === "" ? [] : [{
			sendMsgUrl: config.sendMsgUrl,
			enabled: config.enabled ?? true,
			allowFrom: config.allowFrom ?? [],
			provider: config.provider ?? "",
			model: config.model ?? "",
			cwd: config.cwd ?? ""
		}];
		this.startAll(configured.map(fillDefaults));
	}
	/**
	* Persist the FULL channel configuration to the channels file (§8.5):
	* seeds the file from the current config when it does not exist yet
	* (existing channels migrate transparently), then writes the payload.
	* Changes apply after a GUI restart — live channels are not touched.
	*/
	async saveChannels(input) {
		if (this.channelsFile === void 0) return {
			ok: false,
			error: "channelsFile 未配置：robot-yzj config 加 channelsFile 指向 JSON 文件后才可保存通道"
		};
		for (const robot of input.robots) if (robot.sendMsgUrl === void 0 || robot.sendMsgUrl === "") return {
			ok: false,
			error: "每个通道必须有 sendMsgUrl"
		};
		const doc = buildChannelsDoc(input, loadChannelsFile(this.channelsFile), this.config);
		try {
			mkdirSync(dirname(this.channelsFile), { recursive: true });
			const tmp = join(dirname(this.channelsFile), `.robot-channels-${Date.now().toString(36)}.tmp`);
			writeFileSync(tmp, JSON.stringify(doc, null, 2), "utf8");
			renameSync(tmp, this.channelsFile);
		} catch (error) {
			return {
				ok: false,
				error: `写入通道配置失败：${String(error)}`
			};
		}
		return {
			ok: true,
			path: this.channelsFile,
			count: input.robots.length
		};
	}
	/** The configured channels file path, when present (settings-card hint). */
	channelsFilePath() {
		return this.channelsFile;
	}
	/** Status of every configured channel (config order). */
	statuses() {
		return this.channels.map((channel, index) => ({
			index,
			sendMsgUrl: channel.config.sendMsgUrl,
			enabled: channel.config.enabled ?? true,
			allowFrom: channel.config.allowFrom ?? [],
			provider: channel.config.provider ?? "",
			model: channel.config.model ?? "",
			cwd: channel.router.workdir(),
			connected: channel.status.connected,
			lastError: channel.status.lastError,
			lastFrameAt: channel.status.lastFrameAt,
			surface: channel.router.surfaceSummary(),
			sessions: channel.router.liveSessionIds()
		}));
	}
	/** Proactive outbound push on the first enabled channel (routines, digests). */
	async send(text) {
		const channel = this.channels.find((item) => (item.config.enabled ?? true) && item.status.connected);
		if (channel === void 0) return {
			ok: false,
			error: "no connected robot channel"
		};
		return channel.sender.send(text);
	}
	/**
	* DSH-side proactive notification: push text to one robot channel's
	* conversation (the channel's own surface — the group for a group robot,
	* the DM for a personal robot).
	* @param text - message body.
	* @param robotIndex - channel index; defaults to 0.
	*/
	async notify(text, robotIndex = 0) {
		const channel = this.channels[robotIndex];
		if (channel === void 0) return {
			ok: false,
			error: `no robot channel at index ${robotIndex}`
		};
		if (!(channel.config.enabled ?? true)) return {
			ok: false,
			error: `robot channel ${robotIndex} is disabled`
		};
		return channel.sender.send(text);
	}
	/** DSH-side proactive card notification (application-style card). */
	async notifyCard(card, robotIndex = 0) {
		const channel = this.channels[robotIndex];
		if (channel === void 0) return {
			ok: false,
			error: `no robot channel at index ${robotIndex}`
		};
		if (!(channel.config.enabled ?? true)) return {
			ok: false,
			error: `robot channel ${robotIndex} is disabled`
		};
		return channel.sender.sendCard(card);
	}
	/**
	* Resolve one channel's shared dir and target group (design §8.4); an
	* omitted groupId defaults to the channel's most recent surface. The dir is
	* created on demand.
	*/
	shareTarget(robotIndex, groupId) {
		const channel = this.channels[robotIndex];
		if (channel === void 0) return { error: `no robot channel at index ${robotIndex}` };
		if (!(channel.config.enabled ?? true)) return { error: `robot channel ${robotIndex} is disabled` };
		const target = groupId ?? channel.router.surfaceSummary()[0]?.groupId;
		if (target === void 0 || target === "") return { error: groupId === void 0 ? "该机器人尚未收到任何入站消息，没有可用的群表面" : `机器人没有见过群 ${groupId} 的消息` };
		return {
			dir: channel.router.shareDir(target),
			groupId: target
		};
	}
	/**
	* Write one UTF-8 text file into a group's shared workspace — the ONLY
	* write channel outside session sandboxes (design §8.4). Existing
	* same-named files get an automatic unique suffix unless `overwrite` is
	* explicit; writes are atomic (tmp file + rename).
	*/
	async shareWrite(robotIndex, groupId, filename, content, overwrite) {
		const target = this.shareTarget(robotIndex, groupId);
		if ("error" in target) return {
			ok: false,
			error: target.error
		};
		return writeShareFile(target.dir, filename, content, overwrite);
	}
	/** List one group's shared workspace files (name/size/mtime, newest first). */
	shareList(robotIndex, groupId) {
		const target = this.shareTarget(robotIndex, groupId);
		if ("error" in target) return {
			ok: false,
			error: target.error
		};
		return listShareFiles(target.dir);
	}
	/**
	* Read one shared file's text content (bounded preview, panel 打开).
	* Read-only — no sandbox or approval implications.
	*/
	shareRead(robotIndex, groupId, filename) {
		const target = this.shareTarget(robotIndex, groupId);
		if ("error" in target) return {
			ok: false,
			error: target.error
		};
		return readShareFile(target.dir, filename);
	}
	/**
	* Open one robot's workspace folder in the OS file manager (user's own
	* click from the panel — no approval). With a groupId it opens that
	* group's shared dir; without, the channel's workspace root. Paths are
	* derived internally (never user-supplied), so no injection surface.
	*/
	openFolder(robotIndex, groupId) {
		const channel = this.channels[robotIndex];
		if (channel === void 0) return {
			ok: false,
			error: `no robot channel at index ${robotIndex}`
		};
		let dir;
		if (groupId === void 0 || groupId === "") dir = channel.router.workdir();
		else {
			const target = this.shareTarget(robotIndex, groupId);
			if ("error" in target) return {
				ok: false,
				error: target.error
			};
			dir = target.dir;
		}
		try {
			mkdirSync(dir, { recursive: true });
		} catch (error) {
			return {
				ok: false,
				error: `无法创建目录：${String(error)}`
			};
		}
		try {
			if (process.platform === "win32") spawn("explorer", [dir], {
				detached: true,
				stdio: "ignore"
			}).unref();
			else if (process.platform === "darwin") spawn("open", [dir], {
				detached: true,
				stdio: "ignore"
			}).unref();
			else spawn("xdg-open", [dir], {
				detached: true,
				stdio: "ignore"
			}).unref();
			return {
				ok: true,
				path: dir
			};
		} catch (error) {
			return {
				ok: false,
				error: `打开文件夹失败：${String(error)}`
			};
		}
	}
	/**
	* DSH-side conversation continuation: fabricate an operator turn on one
	* channel and run it through the full inbound pipeline (ack + agent turn +
	* push to the conversation).
	* @param text - the operator's message text.
	* @param options - channel index (default 0) and optional explicit groupId.
	*/
	async continueConversation(text, options = {}) {
		const channel = this.channels[options.robotIndex ?? 0];
		if (channel === void 0) return {
			ok: false,
			error: `no robot channel at index ${options.robotIndex ?? 0}`
		};
		return channel.router.continueFromDsh(text, options.groupId === void 0 ? {} : { groupId: options.groupId });
	}
	/**
	* Fork one live session (typically a robot conversation) into a new
	* operator-side root session seeded with its completed-turn history. The
	* fork appears in the DSH web session list and continues with the full
	* harness toolset; its log keeps `parentSession` pointing at the source.
	* @param sourceSessionId - any live session id (robot conversations included).
	* @returns the new fork session id.
	*/
	async forkSession(sourceSessionId) {
		const source = this.ctx.agents.get(sourceSessionId);
		if (source === void 0) return {
			ok: false,
			error: `no live agent for session ${sourceSessionId}`
		};
		const seed = completedTurnPrefix(source.session.events);
		if (seed.length === 0) return {
			ok: false,
			error: "源会话还没有任何完成的回合，无法 fork"
		};
		const forkId = SessionId(`fork-${slugId(sourceSessionId)}-${Date.now().toString(36)}`);
		try {
			const handle = await this.ctx.agents.create({
				sessionId: forkId,
				seed,
				meta: {
					...source.session.header.cwd === void 0 ? {} : { cwd: source.session.header.cwd },
					parentSession: source.session.header.id,
					seedLength: seed.length
				}
			});
			this.forked.set(String(forkId), handle);
			return {
				ok: true,
				sessionId: String(forkId)
			};
		} catch (error) {
			return {
				ok: false,
				error: `fork failed: ${String(error)}`
			};
		}
	}
	/** Fork sessions this service owns (diagnostics). */
	forkedSessions() {
		return [...this.forked.keys()];
	}
	/** Stable DM session id for one robot and one user openId. */
	dmSession(robotId, operatorOpenid) {
		return dmSessionId(robotId, operatorOpenid);
	}
	/** Every persisted model override (lossless JSON for RPC). */
	listOverrides() {
		return this.overrides.entries();
	}
	/** Persist one conversation's model override (whole-record replace). */
	async setOverride(key, override) {
		if (override.provider === void 0 && override.model === void 0) {
			await this.overrides.delete(key);
			return;
		}
		await this.overrides.put(key, override);
	}
	/** Remove one conversation's override. */
	async deleteOverride(key) {
		return this.overrides.delete(key);
	}
	/**
	* Provider/model catalog for the UI picker: only ACTIVE adapter routes
	* (`listProviders`) — dormant-but-configurable providers are not offered
	* (user decision: an unconfigured provider in the picker is noise; the
	* config file can still reference one).
	*/
	async modelCatalog() {
		const llm = this.ctx.get("llm");
		if (llm === void 0) return [];
		const names = [...new Set(llm.listProviders().map((entry) => String(entry.id ?? entry.provider ?? "")).filter((name) => name !== ""))];
		return Promise.all(names.map(async (provider) => {
			try {
				return {
					provider,
					models: (await llm.listModels(provider)).map((m) => String(m.id ?? m.model ?? "")).filter((id) => id !== "")
				};
			} catch (error) {
				this.ctx.logger.warn(`robot: listModels failed for ${provider}: ${String(error)}`);
				return {
					provider,
					models: []
				};
			}
		}));
	}
	/** Build and start every channel (idempotent per constructor call). */
	startAll(robots) {
		let index = 0;
		for (const robotConfig of robots) {
			if (!(robotConfig.enabled ?? true)) {
				index += 1;
				continue;
			}
			if (robotConfig.sendMsgUrl === "") {
				index += 1;
				continue;
			}
			const channel = this.makeChannel(robotConfig, index);
			this.channels.push(channel);
			channel.socket.start();
			index += 1;
		}
	}
	/** Assemble one channel's runtime pieces. */
	makeChannel(robotConfig, channelIndex) {
		const sender = new RobotSender({ sendMsgUrl: robotConfig.sendMsgUrl });
		const agentOptions = {
			...robotConfig.provider === void 0 || robotConfig.provider === "" ? {} : { provider: robotConfig.provider },
			...robotConfig.model === void 0 || robotConfig.model === "" ? {} : { model: robotConfig.model }
		};
		const router = new RobotRouter({
			agents: this.ctx.agents,
			sender,
			allowFrom: () => this.resolveAllowFrom(robotConfig),
			...Object.keys(agentOptions).length === 0 ? {} : { agentOptions },
			fallbackRoute: () => this.ctx.get("yzjModels")?.get(),
			resolveOverride: (key) => this.overrides.get(key),
			confirm: this.confirm,
			push: this.hub,
			channelIndex,
			cwd: robotConfig.cwd ?? process.cwd(),
			surface: this.surfaces,
			memory: {
				lines: (key) => this.memory.lines(key),
				remember: (key, line) => this.memory.remember(key, line),
				forget: (key, substring) => this.memory.forget(key, substring)
			},
			ackText: DEFAULT_ACK_TEXT,
			denyText: DEFAULT_DENY_TEXT,
			logger: { warn: (message) => this.ctx.logger.warn(message) },
			resolveGroupName: (groupId) => this.resolveGroupNameOf(groupId),
			...this.guiUrl === "" ? {} : { guiUrl: this.guiUrl }
		});
		const status = {
			connected: false,
			attempts: 0,
			lastError: null,
			lastFrameAt: 0
		};
		return {
			config: robotConfig,
			sender,
			router,
			socket: new RobotSocket({
				url: deriveWebSocketUrl(robotConfig.sendMsgUrl),
				onMessage: (message) => {
					router.handle(message);
				},
				onStatus: (updated) => {
					Object.assign(status, updated);
				}
			}),
			status
		};
	}
	/** Stop every channel (idempotent). Disposes router-owned and fork agents. */
	stop() {
		for (const channel of this.channels) {
			channel.socket.stop();
			channel.router.dispose();
		}
		this.channels.length = 0;
		for (const handle of this.forked.values()) handle.dispose();
		this.forked.clear();
		this.confirm.dispose();
		this.overrides.close();
		this.surfaces.close();
		this.memory.close();
	}
	/** Firehose slice for robot sessions (plugin entry). */
	noteSessionEvent(sessionId, event) {
		this.hub.noteEvent(sessionId, event);
	}
	/** Agent-idle slice for robot sessions (plugin entry): flush the answer. */
	noteAgentIdle(sessionId) {
		this.hub.noteIdle(sessionId);
	}
	/** Agent-error slice for robot sessions (plugin entry). */
	noteAgentError(sessionId, error) {
		this.hub.noteError(sessionId, error);
	}
	/** Push-hub diagnostic snapshot (statuses()-adjacent debugging face). */
	pushDiagnostics() {
		return this.hub.diagnostics();
	}
	/** Confirm-broker diagnostic snapshot. */
	confirmDiagnostics() {
		return { openCards: this.confirm.openCards };
	}
	/** Open the override + surface stores once the storage hub has the domain form. */
	async ensureOverrides() {
		const facility = this.ctx.get("storageDomain");
		if (facility === void 0) return;
		try {
			await this.overrides.open(facility);
			await this.memory.open(facility);
			await this.surfaces.open(facility);
		} catch (error) {
			this.ctx.logger.warn(`robot: override store failed to open: ${String(error)}`);
		}
	}
	/** Public wrapper for the plugin entry's inject callback. */
	async openOverridesNow() {
		await this.ensureOverrides();
	}
	/** Feed one ask broadcast into the confirmation broker (plugin entry). */
	noteAsk(pending) {
		this.confirm.noteAsk(pending);
	}
	/** The approval waterfall slice for robot sessions (plugin entry). */
	handleApproval(req, next) {
		return this.confirm.handleApproval(req, next);
	}
	/** Resolve one group's human name through the CLI recent-session list
	* (WS frames carry no group names); undefined when unknown. Bounded: the
	* first page of 20 recent sessions. */
	async resolveGroupNameOf(groupId) {
		const bridge = this.ctx.get("yzjBridge");
		if (bridge === void 0) return void 0;
		try {
			const json = (await bridge.run([
				"im",
				"group",
				"recent",
				"--limit",
				"20"
			], { timeoutMs: 15e3 })).json;
			const list = Array.isArray(json) ? json : Array.isArray(json?.list) ? json.list : [];
			for (const item of list) {
				const record = item;
				if (record.groupId === groupId && typeof record.groupName === "string" && record.groupName !== "") return record.groupName;
			}
			return;
		} catch {
			return;
		}
	}
	/** allowFrom policy: explicit config list, else the CLI login user once. */
	async resolveAllowFrom(robotConfig) {
		const configured = robotConfig.allowFrom ?? [];
		if (configured.length > 0) return configured;
		const bridge = this.ctx.get("yzjBridge");
		if (bridge === void 0) {
			this.ctx.logger.warn("robot: yzjBridge unavailable; allowFrom stays empty");
			return [];
		}
		try {
			const result = await bridge.run([
				"contact",
				"user",
				"get"
			], { timeoutMs: 15e3 });
			const first = (Array.isArray(result.json) ? result.json : [])[0];
			const openId = typeof first?.openId === "string" ? first.openId : "";
			return openId === "" ? [] : [openId];
		} catch (error) {
			this.ctx.logger.warn(`robot: whoami failed: ${String(error)}`);
			return [];
		}
	}
};
/** File names allowed in the shared workspace: no path separators or Windows-reserved characters. */
const SHARE_NAME = /^[^\\/:*?"<>|\u0000-\u001f]+$/;
/** First non-colliding `base-N.ext` for an existing shared file name. */
function uniqueShareName(dir, filename) {
	const dot = filename.lastIndexOf(".");
	const base = dot > 0 ? filename.slice(0, dot) : filename;
	const ext = dot > 0 ? filename.slice(dot) : "";
	let n = 2;
	while (existsSync(join(dir, `${base}-${n}${ext}`))) n += 1;
	return `${base}-${n}${ext}`;
}
/**
* Write one UTF-8 text file into a shared dir (design §8.4). Rejects unsafe
* names, resolves conflicts with an automatic unique suffix unless
* `overwrite` is explicit, and writes atomically (tmp file + rename). Pure
* host-side helper so the collision/validation rules are unit-testable.
*/
function writeShareFile(dir, filename, content, overwrite) {
	if (filename === "." || filename === ".." || !SHARE_NAME.test(filename)) return {
		ok: false,
		error: "文件名不合法：禁止路径分隔符、Windows 保留字符与空名"
	};
	let name = filename;
	let existed = existsSync(join(dir, filename));
	if (existed && !overwrite) name = uniqueShareName(dir, filename);
	const full = join(dir, name);
	const tmp = join(dir, `.robot-share-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.tmp`);
	try {
		mkdirSync(dir, { recursive: true });
		writeFileSync(tmp, content, "utf8");
		renameSync(tmp, full);
	} catch (error) {
		try {
			rmSync(tmp, { force: true });
		} catch {}
		return {
			ok: false,
			error: `写入共享区失败：${String(error)}`
		};
	}
	return {
		ok: true,
		path: full,
		name,
		existed
	};
}
/** List one shared dir's files (name/size/mtime, newest first). */
function listShareFiles(dir) {
	try {
		return {
			ok: true,
			dir,
			files: readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => {
				const stat = statSync(join(dir, entry.name));
				return {
					name: entry.name,
					size: stat.size,
					mtime: stat.mtimeMs
				};
			}).sort((a, b) => b.mtime - a.mtime || a.name.localeCompare(b.name))
		};
	} catch (error) {
		return {
			ok: false,
			dir,
			files: [],
			error: `读取共享区失败：${String(error)}`
		};
	}
}
/** Preview cap for shareRead (chars); larger files truncate. */
const SHARE_READ_MAX = 2e4;
/**
* Read one shared file as text (bounded preview). Rejects unsafe names with
* the same rule as writes; content beyond the cap truncates with a flag.
*/
function readShareFile(dir, filename) {
	if (filename === "." || filename === ".." || !SHARE_NAME.test(filename)) return {
		ok: false,
		error: "文件名不合法：禁止路径分隔符、Windows 保留字符与空名"
	};
	try {
		const content = readFileSync(join(dir, filename), "utf8");
		if (content.length > 2e4) return {
			ok: true,
			content: content.slice(0, SHARE_READ_MAX),
			truncated: true
		};
		return {
			ok: true,
			content,
			truncated: false
		};
	} catch (error) {
		return {
			ok: false,
			error: `读取共享区文件失败：${String(error)}`
		};
	}
}
/**
* Read and parse the channels file; undefined when missing, unreadable, or
* invalid JSON — the caller falls back to the patch-level config.
*/
function loadChannelsFile(path) {
	let raw;
	try {
		raw = readFileSync(path, "utf8");
	} catch {
		return;
	}
	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return;
	}
	const record = typeof parsed === "object" && parsed !== null ? parsed : {};
	const robots = Array.isArray(record.robots) ? record.robots.filter((item) => {
		const candidate = item;
		return candidate !== null && typeof candidate === "object" && typeof candidate.sendMsgUrl === "string";
	}) : [];
	return {
		...typeof record.defaultProvider === "string" && record.defaultProvider !== "" ? { defaultProvider: record.defaultProvider } : {},
		...typeof record.defaultModel === "string" && record.defaultModel !== "" ? { defaultModel: record.defaultModel } : {},
		...typeof record.defaultCwd === "string" && record.defaultCwd !== "" ? { defaultCwd: record.defaultCwd } : {},
		robots
	};
}
/** First non-empty string of the candidates (settings-card seed fallback chain). */
function firstNonEmpty(...values) {
	for (const value of values) if (value !== void 0 && value !== "") return value;
}
/**
* Auto-assigned workspace root for a robot without an explicit cwd (§8.5):
* `~/.dsh/robot-workspaces/robot-<yzjtype>-<token8>` — stable per
* sendMsgUrl, self-contained (group shared/private dirs live under it),
* and never the bare host cwd.
*/
function deriveRobotWorkspace(sendMsgUrl) {
	const type = /yzjtype=(\d+)/.exec(sendMsgUrl)?.[1] ?? "x";
	const token = /yzjtoken=([a-f0-9]+)/i.exec(sendMsgUrl)?.[1] ?? "x";
	return join(homedir(), ".dsh", "robot-workspaces", `robot-${type}-${token.slice(0, 8)}`);
}
/**
* Build the channels-file document for one save (§8.5): `default*` resolve
* input > existing file > patch config (the seed migration); robots carry
* only non-empty fields so the file stays minimal.
*/
function buildChannelsDoc(input, previous, configDefaults) {
	return {
		...firstNonEmpty(input.defaultProvider, previous?.defaultProvider, configDefaults.defaultProvider) === void 0 ? {} : { defaultProvider: firstNonEmpty(input.defaultProvider, previous?.defaultProvider, configDefaults.defaultProvider) },
		...firstNonEmpty(input.defaultModel, previous?.defaultModel, configDefaults.defaultModel) === void 0 ? {} : { defaultModel: firstNonEmpty(input.defaultModel, previous?.defaultModel, configDefaults.defaultModel) },
		robots: input.robots.map((robot) => ({
			sendMsgUrl: robot.sendMsgUrl,
			...robot.enabled === void 0 ? {} : { enabled: robot.enabled },
			...robot.allowFrom === void 0 || robot.allowFrom.length === 0 ? {} : { allowFrom: robot.allowFrom },
			...robot.provider === void 0 || robot.provider === "" ? {} : { provider: robot.provider },
			...robot.model === void 0 || robot.model === "" ? {} : { model: robot.model },
			...robot.cwd === void 0 || robot.cwd === "" ? {} : { cwd: robot.cwd }
		}))
	};
}
/** Plugin entry: expose the service and own every channel's lifecycle. */
function apply(ctx, config) {
	if (config.bridgeTarget !== void 0 && config.bridgeTarget !== "") {
		if (config.bridgeToken === void 0 || config.bridgeToken === "") throw new Error("robot-yzj: bridgeTarget requires bridgeToken (the shared listener secret)");
		new ChatnodeBridgeClient(ctx, config.bridgeTarget, config.bridgeToken);
		ctx.logger.info(`robot-yzj: bridge client mode → ${config.bridgeTarget}`);
		return;
	}
	const robot = new YzjRobot(ctx, config);
	if (config.autoStartOps === true) maybeAutoStartOps({
		home: dshHomeOf(),
		opsCwd: config.opsCwd !== void 0 && config.opsCwd !== "" ? config.opsCwd : process.cwd(),
		logger: {
			info: (message) => ctx.logger.info(message),
			warn: (message) => ctx.logger.warn(message)
		}
	});
	ctx.inject(["storageDomain"], () => {
		robot.openOverridesNow();
	});
	ctx.on("yzj/ask-pending", (pending) => {
		robot.noteAsk(pending);
	});
	ctx.on("approval/request", (req, next) => {
		return robot.handleApproval(req, next);
	});
	applyRobotControlTools(ctx, robot);
	applyRobotShareTools(ctx, robot);
	new YzjChatnode(ctx, robot, config.chatnodeRobotIndex ?? 0);
	const bridgeToken = config.bridgeToken;
	if (bridgeToken !== void 0 && bridgeToken !== "") ctx.inject(["webServer"], () => {
		const webServer = ctx.get("webServer");
		if (webServer === void 0) return;
		const bridge = new ChatnodeBridge({
			robot,
			defaultRobotIndex: config.chatnodeRobotIndex ?? 0,
			token: bridgeToken
		});
		ctx.effect(() => webServer.register({
			kind: "exact",
			path: "/yzj/chatnode",
			handler: (req, res) => bridge.handle(req, res)
		}), "robot-yzj: chatnode bridge route");
	});
	ctx.on("session/event", (session, event) => {
		const id = String(session.id);
		if (!id.startsWith("yzj-robot-")) return;
		robot.noteSessionEvent(id, event);
	});
	ctx.on("agent/status", (payload) => {
		if (payload.status !== "idle") return;
		const id = String(payload.agent.id);
		if (!id.startsWith("yzj-robot-")) return;
		robot.noteAgentIdle(id);
	});
	ctx.on("agent/error", (payload) => {
		const id = String(payload.agent.id);
		if (!id.startsWith("yzj-robot-")) return;
		robot.noteAgentError(id, payload.error);
	});
	ctx.effect(() => {
		return () => robot.stop();
	}, "robot-yzj: channel lifecycle");
}
//#endregion
export { SHARE_READ_MAX, YzjRobot, apply, buildChannelsDoc, deriveRobotWorkspace, inject, listShareFiles, loadChannelsFile, name, readShareFile, writeShareFile };
