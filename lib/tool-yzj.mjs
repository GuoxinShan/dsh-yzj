import { Service } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { z as z$1 } from "zod";
import { defineDomain, domainTable } from "@deepseek-ai/dsh-storage-domain";
//#region packages/tool-yzj/lib/index.js
/**
* Shared tool plumbing for the yzj tool family: the common output contract,
* digest builders, CLI payload accessors, and the capped presentation payload
* every tool projects through `output.presentationMeta`.
*/
/** Cap a rendered digest at the character budget. */
function digestOf(text, max) {
	if (text.length <= max) return {
		content: text,
		truncated: false
	};
	return {
		content: text.slice(0, max),
		truncated: true
	};
}
/** A model-facing failure digest from a non-ok bridge invocation. */
function failureDigest(label, result, max) {
	const { content, truncated } = digestOf(`yzj ${label} failed (${result.timedOut ? "timed out" : `exit ${result.exitCode ?? "killed"}`}): ${stderrDetail(result.stderr)}${looksCliConfirm(result) ? "\n提示：yzj-cli 0.1.6 高风险命令在非交互下 exit 10（confirmation_required）。本插件应在产品确认卡通过后附加 --yes；不要用 bash 直调 yzj-cli。" : looksUnauthenticated(result.stderr) ? "\n提示：yzj-cli 可能未登录，请先运行 `yzj-cli auth login` 完成浏览器/设备码登录。" : result.exitCode === 5 ? "\n提示：exit 5 是 CLI 内部错误（含 --jq 求值失败）。本插件不传 --jq。" : ""}`, max);
	return {
		content,
		truncated,
		data: {}
	};
}
/** Prefer the 0.1.6 stderr JSON `error.message`; fall back to the raw line. */
function stderrDetail(stderr) {
	const text = stderr.trim();
	if (text === "") return "(no stderr)";
	try {
		const message = asString(asRecord(asRecord(JSON.parse(text)).error).message);
		if (message !== "") return message;
	} catch {}
	return text;
}
/** Heuristic: stderr mentions an auth/credential failure worth a login hint. */
function looksUnauthenticated(stderr) {
	return /(auth|login|登录|token|credential|unauthorized|未授权)/i.test(stderr);
}
/**
* CLI high-risk gate (skill 0.6.0): non-interactive delete family without
* `--yes` exits 10 with `confirmation_required`. 0.1.4 used exit 3 for the
* same signal — accept both so a missed `--yes` is not mistaken for auth.
*/
function looksCliConfirm(result) {
	if (result.exitCode === 10) return true;
	return /confirmation_required/.test(result.stderr);
}
/** Keys that belong to the yzj-cli 0.1.6 success/error envelope, not the payload. */
const CLI_ENVELOPE_KEYS = /* @__PURE__ */ new Set([
	"success",
	"identity",
	"data",
	"error"
]);
function asRecord(value) {
	return typeof value === "object" && value !== null ? value : {};
}
function asArray(value) {
	return Array.isArray(value) ? value : [];
}
/**
* Peel the yzj-cli 0.1.6 success envelope `{success, identity, data}` down to
* `data`. Bare arrays and 0.1.4 unwrapped objects pass through. Idempotent.
*
* Empty write receipts omit `data`; those become `{}` so formatters do not
* see `success`/`identity` as business fields.
*/
function unwrapCli(json) {
	if (json === void 0 || json === null) return json;
	if (Array.isArray(json) || typeof json !== "object") return json;
	const rec = json;
	if (rec.success === true && "data" in rec) return rec.data === void 0 || rec.data === null ? {} : rec.data;
	if (rec.success === true && rec.identity !== void 0) {
		if (Object.keys(rec).filter((key) => !CLI_ENVELOPE_KEYS.has(key)).length === 0) return rec.data ?? {};
	}
	return json;
}
/**
* Record array from any CLI list shape: bare array, `{list}`, `{records}`,
* `{blocks}`, `{messages}`, or the same keys under a leftover `.data`.
*/
function cliList(json, keys = ["list"]) {
	const payload = unwrapCli(json);
	if (Array.isArray(payload)) return payload;
	const rec = asRecord(payload);
	for (const key of keys) if (Array.isArray(rec[key])) return rec[key];
	const inner = asRecord(rec.data);
	for (const key of keys) if (Array.isArray(inner[key])) return inner[key];
	return [];
}
/** Object payload after {@link unwrapCli}. */
function cliObject(json) {
	return asRecord(unwrapCli(json));
}
function asString(value) {
	return typeof value === "string" ? value : "";
}
function asNumber(value) {
	return typeof value === "number" ? value : void 0;
}
/**
* Model-facing file-id suffix. `file_id` is the Yunzhijia file service id
* (yzj_file_download / yzj_im_message_send), never the IM msgId.
*/
function fileIdMark(param) {
	if (param === void 0) return "";
	const id = typeof param.file_id === "string" ? param.file_id : "";
	if (id === "") return "";
	const size = typeof param.size === "number" ? param.size : void 0;
	return size === void 0 ? ` fileId=${id}` : ` fileId=${id} size=${size}`;
}
function asBool(value) {
	return value === true;
}
/** One line per array entry rendered by the per-domain formatters. */
function linesOf(entries, max) {
	return digestOf(entries.join("\n"), max);
}
/**
* Deep-clip a CLI JSON payload for UI presentation: long strings truncate to
* `maxString`, arrays cap at `maxItems`, and the result is dropped when its
* JSON serialization still exceeds `maxChars` (returning `{}` instead). Pure
* and lossy — never feeds the model.
*/
function clipJson(value, options) {
	const maxString = options.maxString ?? 300;
	const maxItems = options.maxItems ?? 100;
	const clip = (node, depth) => {
		if (depth > 6) return void 0;
		if (typeof node === "string") return node.length <= maxString ? node : `${node.slice(0, maxString)}…`;
		if (Array.isArray(node)) {
			const kept = node.slice(0, maxItems).map((item) => clip(item, depth + 1));
			return node.length > maxItems ? [...kept, { __clipped: node.length - maxItems }] : kept;
		}
		if (typeof node === "object" && node !== null) {
			const out = {};
			for (const [key, child] of Object.entries(node)) {
				const clipped = clip(child, depth + 1);
				if (clipped !== void 0) out[key] = clipped;
			}
			return out;
		}
		return node;
	};
	const clipped = clip(value, 0);
	if (clipped === void 0) return {};
	const json = JSON.stringify(clipped);
	if (json !== void 0 && json.length > options.maxChars) return { __oversized: true };
	return clipped;
}
/** Run one bridge command and return a common tool value. */
async function runValue(ctx, budget, label, command, format) {
	const result = await ctx.yzjBridge.run(command, { timeoutMs: budget.timeoutMs });
	if (!result.ok) return failureDigest(label, result, budget.maxRenderChars);
	const { content, data } = format(unwrapCli(result.json));
	const digest = digestOf(content, budget.maxRenderChars);
	return {
		content: digest.content,
		truncated: digest.truncated,
		data
	};
}
/** Standard link returned by doc/sheet write tools. */
function docLink(id) {
	return `https://www.yunzhijia.com/knowledge/lingee/#/store/doc/${id}`;
}
/**
* The shared tool `output` contract for the whole yzj family: the model sees
* only `content` (rendered), the session log persists it, and the UI reads
* the capped `data` payload through `presentationMeta` — which is never
* model-visible.
*/
const yzjToolOutput = {
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
	presentationMeta: (_args, value) => value.data
};
/**
* Contact-domain tools: whoami, contact search, and user detail lookups.
* All read-only; outputs render one line per user.
*/
/** One contact line: name, openId, department, job title, job number. */
function contactLine(record) {
	const user = asRecord(record);
	const name = asString(user.name);
	const openId = asString(user.openId ?? user.oId);
	const department = asString(user.department ?? user.fulldepartment);
	const jobTitle = asString(user.jobTitle);
	const jobNo = asString(user.jobNo);
	const parts = [name === "" ? openId : name];
	if (department !== "") parts.push(department);
	if (jobTitle !== "") parts.push(jobTitle);
	if (jobNo !== "") parts.push(`工号 ${jobNo}`);
	if (openId !== "" && openId !== name) parts.push(`<${openId}>`);
	return parts.join(" · ");
}
/**
* User rows from `whoami` (one object) or `contact user get/search`
* (bare array / `{list}` / leftover `.data`).
*/
function usersOf(json) {
	const listed = cliList(json, ["list"]);
	if (listed.length > 0) return listed;
	const payload = unwrapCli(json);
	if (Array.isArray(payload)) return payload;
	const rec = asRecord(payload);
	if (asString(rec.openId ?? rec.oId ?? rec.name) !== "") return [payload];
	return [];
}
/** Register the three contact tools. */
function applyContactTools(ctx, budget) {
	ctx.tools.register(defineTool({
		name: "yzj_whoami",
		description: "Return the current yzj-cli login user (yzj-cli whoami): name, openId, department, job title, job number, and token status.",
		parameters: {},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => true,
		async execute() {
			return runValue(ctx, budget, "whoami", ["whoami"], (json) => {
				const users = usersOf(json);
				const lines = users.map(contactLine);
				const rec = asRecord(users[0]);
				const token = asString(rec.tokenStatus);
				return {
					content: [lines.length === 0 ? "(no user info)" : lines.join("\n"), ...token === "" ? [] : [`token ${token}`]].join("\n"),
					data: {
						record: rec,
						users: clipJson(users, { maxChars: budget.maxMetaChars })
					}
				};
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_contact_search",
		description: "Search the Yunzhijia contact directory by keyword (name etc.). Returns one line per match with openId for follow-up get/send calls.",
		parameters: {
			keyword: {
				type: "string",
				required: true,
				description: "Search keyword (a name or other directory term)."
			},
			orgId: {
				type: "string",
				description: "Optional org/department id to scope the search."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => true,
		async execute(args) {
			const command = [
				"contact",
				"user",
				"search",
				"--keyword",
				args.keyword
			];
			if (args.orgId !== void 0) command.push("--org-id", args.orgId);
			return runValue(ctx, budget, "contact user search", command, (json) => {
				const users = usersOf(json);
				const lines = users.map(contactLine);
				return {
					content: lines.length === 0 ? "(no matches)" : lines.join("\n"),
					data: { list: clipJson(users, { maxChars: budget.maxMetaChars }) }
				};
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_contact_get",
		description: "Fetch Yunzhijia user details by openId (repeatable); without openIds returns the current login user.",
		parameters: { openIds: {
			type: "array",
			items: { type: "string" },
			description: "One or more openIds to fetch; omit to fetch the current user."
		} },
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => true,
		async execute(args) {
			const openIds = args.openIds ?? [];
			if (openIds.some((id) => id.trim() === "")) throw new Error("yzj_contact_get: openIds must not contain empty strings");
			const command = [
				"contact",
				"user",
				"get"
			];
			for (const id of openIds) command.push("--open-id", id);
			return runValue(ctx, budget, "contact user get", command, (json) => {
				const users = usersOf(json);
				const lines = users.map(contactLine);
				return {
					content: lines.length === 0 ? "(no user info)" : lines.join("\n"),
					data: { list: clipJson(users, { maxChars: budget.maxMetaChars }) }
				};
			});
		}
	}));
}
/**
* Doc-domain tools: knowledge-base (workspace) management, node browsing and
* mutation, imports, download links, and block-level read/write. Write tools
* return the doc link per the yzj-cli contract; destructive operations are
* gated by the approval guard (see guard.ts).
*/
const PERMISSION = {
	1: "可管理",
	2: "可编辑",
	3: "可查看",
	9: "无权限"
};
const SUFFIX = {
	otl: "在线文档",
	dbt: "多维表格"
};
function dateOf(iso) {
	const text = asString(iso);
	return text === "" ? "" : text.slice(0, 10);
}
/** One node line for doc list / recent digests. */
function nodeLine(record) {
	const node = asRecord(record);
	const title = asString(node.title);
	const id = asString(node.id);
	const suffix = asString(node.fileSuffix);
	const updated = dateOf(node.updateTime);
	const suffixText = SUFFIX[suffix] ?? suffix;
	const parts = [title === "" ? id : title, `(${id})`];
	if (suffixText !== "") parts.push(suffixText);
	if (updated !== "") parts.push(`更新 ${updated}`);
	if (asBool(node.hasChildren)) parts.push("含子节点");
	return parts.join(" · ");
}
/** One workspace line. */
function workspaceLine(record) {
	const ws = asRecord(record);
	const name = asString(ws.name);
	const id = asString(ws.id);
	const kind = asNumber(ws.visibility) === 2 ? "个人" : "企业";
	const parts = [
		name === "" ? id : name,
		`(${id})`,
		kind
	];
	const docCount = asNumber(ws.docCount);
	const memberCount = asNumber(ws.memberCount);
	if (docCount !== void 0) parts.push(`文档 ${docCount}`);
	if (memberCount !== void 0) parts.push(`成员 ${memberCount}`);
	const owner = asString(ws.ownerName);
	if (owner !== "") parts.push(owner);
	return parts.join(" · ");
}
/** Extract inline text from one block's content array. */
function blockText(block, depth = 0) {
	if (depth > 4) return "";
	const record = asRecord(block);
	const own = asString(record.textContent);
	if (own !== "") return own;
	const parts = [];
	for (const child of asArray(record.content)) {
		const inline = asRecord(child);
		const text = asString(inline.content);
		if (text !== "") parts.push(text);
		else if (typeof inline.content === "object" && inline.content !== null) {
			const nested = blockText(inline.content, depth + 1);
			if (nested !== "") parts.push(nested);
		}
	}
	return parts.join(" ");
}
/** One block line for block list digests. */
function blockLine(record) {
	const block = asRecord(record);
	const type = asString(block.type);
	const id = asString(block.id);
	const text = blockText(block).replace(/\s+/g, " ").trim().slice(0, 60);
	return `- [${type}] ${id}${text === "" ? "" : `: ${text}`}`;
}
/** Register the doc-domain tools. */
function applyDocTools(ctx, budget) {
	ctx.tools.register(defineTool({
		name: "yzj_doc_workspace_list",
		description: "List Yunzhijia knowledge bases (workspaces) with optional personal/enterprise filter. Returns one line per workspace with its KB_ID for doc/sheet operations.",
		parameters: { type: {
			type: "string",
			enum: [
				"all",
				"personal",
				"enterprise"
			],
			description: "Filter: all (default), personal, or enterprise."
		} },
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => true,
		async execute(args) {
			const command = [
				"doc",
				"workspace",
				"list"
			];
			if (args.type !== void 0) command.push("--type", args.type);
			return runValue(ctx, budget, "doc workspace list", command, (json) => {
				const workspaces = cliList(json);
				const lines = workspaces.map(workspaceLine);
				return {
					content: lines.length === 0 ? "(no workspaces)" : lines.join("\n"),
					data: { list: clipJson(workspaces, { maxChars: budget.maxMetaChars }) }
				};
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_doc_workspace_get",
		description: "Fetch one knowledge base detail by its KB_ID.",
		parameters: { id: {
			type: "string",
			required: true,
			description: "Knowledge base id (KB_ID)."
		} },
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => true,
		async execute(args) {
			return runValue(ctx, budget, "doc workspace get", [
				"doc",
				"workspace",
				"get",
				"--id",
				args.id
			], (json) => {
				const ws = cliObject(json);
				return {
					content: workspaceLine(ws),
					data: { record: clipJson(ws, { maxChars: budget.maxMetaChars }) }
				};
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_doc_workspace_create",
		description: "Create a knowledge base with the given name and optional description. visibility: 1=企业知识库, 2=个人知识库 (default 2); allMember sets the enterprise-wide permission (2=可编辑, 3=可查看, visibility=1 only). Returns the new KB_ID.",
		parameters: {
			name: {
				type: "string",
				required: true,
				description: "Knowledge base name."
			},
			description: {
				type: "string",
				description: "Optional description."
			},
			visibility: {
				type: "number",
				enum: [1, 2],
				description: "1=企业知识库, 2=个人知识库 (default 2)."
			},
			allMember: {
				type: "number",
				enum: [2, 3],
				description: "Enterprise-wide permission: 2=可编辑, 3=可查看 (visibility=1 only)."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => false,
		async execute(args) {
			const command = [
				"doc",
				"workspace",
				"create",
				"--name",
				args.name
			];
			if (args.description !== void 0) command.push("--description", args.description);
			if (args.visibility !== void 0) command.push("--visibility", String(args.visibility));
			if (args.allMember !== void 0) command.push("--all-member", String(args.allMember));
			return runValue(ctx, budget, "doc workspace create", command, (json) => {
				const ws = cliObject(json);
				const id = asString(ws.id);
				return {
					content: `created 知识库 "${asString(ws.name) || args.name}"${id === "" ? "" : ` (${id})`}`,
					data: { record: clipJson(ws, { maxChars: budget.maxMetaChars }) }
				};
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_doc_list",
		description: "List the direct child nodes of a knowledge base (one level), optionally under a parent doc. Nodes carry fileSuffix otl (在线文档) or dbt (多维表格).",
		parameters: {
			workspace: {
				type: "string",
				required: true,
				description: "Knowledge base id (KB_ID) from yzj_doc_workspace_list."
			},
			parentId: {
				type: "string",
				description: "Optional parent node id to list its children instead of the workspace root."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => true,
		async execute(args) {
			const command = [
				"doc",
				"list",
				"--workspace",
				args.workspace
			];
			if (args.parentId !== void 0) command.push("--parent-id", args.parentId);
			return runValue(ctx, budget, "doc list", command, (json) => {
				const nodes = cliList(json);
				const lines = nodes.map(nodeLine);
				return {
					content: lines.length === 0 ? "(no nodes)" : lines.join("\n"),
					data: { list: clipJson(nodes, { maxChars: budget.maxMetaChars }) }
				};
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_doc_get",
		description: "Fetch one knowledge-base node (doc or sheet) by id: title, type, permission, timestamps, and the open link.",
		parameters: { id: {
			type: "string",
			required: true,
			description: "Node id (DOC_ID)."
		} },
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => true,
		async execute(args) {
			return runValue(ctx, budget, "doc get", [
				"doc",
				"get",
				"--id",
				args.id
			], (json) => {
				const node = cliObject(json);
				const title = asString(node.title);
				const id = asString(node.id);
				const suffix = asString(node.fileSuffix);
				const permission = asNumber(node.permissionLevel);
				const lines = [`${title === "" ? id : title} (${id})`];
				const suffixText = SUFFIX[suffix];
				if (suffixText !== "") lines.push(`类型：${suffixText}`);
				if (permission !== void 0 && PERMISSION[permission] !== void 0) lines.push(`权限：${PERMISSION[permission]}`);
				const creator = asString(node.creatorName);
				if (creator !== "") lines.push(`创建人：${creator}`);
				const updated = dateOf(node.updateTime);
				if (updated !== "") lines.push(`更新时间：${updated}`);
				const link = asString(node.openWebUrl);
				if (link !== "") lines.push(link);
				return {
					content: lines.join("\n"),
					data: { record: clipJson(node, { maxChars: budget.maxMetaChars }) }
				};
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_doc_recent",
		description: "List the current user's recently visited documents across knowledge bases, newest first, with pagination cursor support.",
		parameters: {
			limit: {
				type: "number",
				description: "Result count; default 20, max 100."
			},
			lastVisitTime: {
				type: "number",
				description: "Pagination cursor: the visitTime (ms) of the last entry of the previous page."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => true,
		async execute(args) {
			const command = ["doc", "recent"];
			if (args.limit !== void 0) {
				if (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 100) throw new Error("yzj_doc_recent: limit must be an integer between 1 and 100");
				command.push("--limit", String(args.limit));
			}
			if (args.lastVisitTime !== void 0) command.push("--last-visit-time", String(args.lastVisitTime));
			return runValue(ctx, budget, "doc recent", command, (json) => {
				const nodes = cliList(json);
				const lines = nodes.map((record) => {
					const node = asRecord(record);
					const kb = asString(node.kbName);
					const visit = asNumber(node.visitTime);
					const base = nodeLine(node);
					const tail = [kb === "" ? "" : kb, visit === void 0 ? "" : `访问 ${new Date(visit).toISOString().slice(0, 10)}`].filter((part) => part !== "");
					return tail.length === 0 ? base : `${base} · ${tail.join(" · ")}`;
				});
				return {
					content: lines.length === 0 ? "(no recent docs)" : lines.join("\n"),
					data: { list: clipJson(nodes, { maxChars: budget.maxMetaChars }) }
				};
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_doc_create",
		description: "Create an online doc (otl) in a knowledge base, optionally under a parent node. Returns the new node id and link. For 多维表格 use yzj_sheet_create. For a real folder node use yzj_doc_folder_create (distinct from a parent otl).",
		parameters: {
			workspace: {
				type: "string",
				required: true,
				description: "Knowledge base id (KB_ID)."
			},
			title: {
				type: "string",
				required: true,
				description: "Doc title (also shown as the node title; do not repeat it as a level-1 heading inside the doc)."
			},
			parentId: {
				type: "string",
				description: "Optional parent node id to nest the doc under."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => false,
		async execute(args) {
			const command = [
				"doc",
				"create",
				"--workspace",
				args.workspace,
				"--title",
				args.title
			];
			if (args.parentId !== void 0) command.push("--parent-id", args.parentId);
			return runValue(ctx, budget, "doc create", command, (json) => {
				const node = cliObject(json);
				const id = asString(node.id);
				const link = docLink(id);
				return {
					content: `created 文档 "${asString(node.title) || args.title}"${id === "" ? "" : ` (${id})`}\n${link}`,
					data: {
						record: clipJson(node, { maxChars: budget.maxMetaChars }),
						id,
						link
					}
				};
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_doc_folder_create",
		description: "Create a knowledge-base folder node (yzj-cli `doc folder create`, distinct from yzj_doc_create which makes an otl). Optional parentId nests it; omit for workspace root. Requires user confirmation.",
		parameters: {
			workspace: {
				type: "string",
				required: true,
				description: "Knowledge base id (KB_ID)."
			},
			title: {
				type: "string",
				required: true,
				description: "Folder name."
			},
			parentId: {
				type: "string",
				description: "Optional parent node id; omit to create at the workspace root."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => false,
		async execute(args) {
			const command = [
				"doc",
				"folder",
				"create",
				"--workspace",
				args.workspace,
				"--title",
				args.title
			];
			if (args.parentId !== void 0) command.push("--parent-id", args.parentId);
			return runValue(ctx, budget, "doc folder create", command, (json) => {
				const node = cliObject(json);
				const id = asString(node.id);
				const link = id === "" ? "" : docLink(id);
				return {
					content: `created 文件夹 "${asString(node.title) || args.title}"${id === "" ? "" : ` (${id})`}${link === "" ? "" : `\n${link}`}`,
					data: {
						record: clipJson(node, { maxChars: budget.maxMetaChars }),
						id,
						link
					}
				};
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_doc_rename",
		description: "Rename a knowledge-base node (online doc or 多维表格).",
		parameters: {
			id: {
				type: "string",
				required: true,
				description: "Node id (DOC_ID)."
			},
			title: {
				type: "string",
				required: true,
				description: "New title."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => false,
		async execute(args) {
			return runValue(ctx, budget, "doc rename", [
				"doc",
				"rename",
				"--id",
				args.id,
				"--title",
				args.title
			], (json) => {
				const node = cliObject(json);
				const id = asString(node.id) || args.id;
				return {
					content: `renamed → "${args.title}" (${id})\n${docLink(id)}`,
					data: {
						record: clipJson(node, { maxChars: budget.maxMetaChars }),
						id,
						link: docLink(id)
					}
				};
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_doc_move",
		description: "Move a knowledge-base node under another parent node. Requires user confirmation.",
		parameters: {
			id: {
				type: "string",
				required: true,
				description: "Node id (DOC_ID) to move."
			},
			targetParentId: {
				type: "string",
				required: true,
				description: "Target parent node id (any doc can be a parent)."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => false,
		async execute(args) {
			return runValue(ctx, budget, "doc move", [
				"doc",
				"move",
				"--id",
				args.id,
				"--target-parent-id",
				args.targetParentId
			], (json) => {
				const node = cliObject(json);
				const id = asString(node.id) || args.id;
				return {
					content: `moved (${id}) → parent (${args.targetParentId})\n${docLink(id)}`,
					data: {
						record: clipJson(node, { maxChars: budget.maxMetaChars }),
						id,
						link: docLink(id)
					}
				};
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_doc_delete",
		description: "Delete a knowledge-base node irreversibly. Requires user confirmation.",
		parameters: { id: {
			type: "string",
			required: true,
			description: "Node id (DOC_ID) to delete."
		} },
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => false,
		async execute(args) {
			return runValue(ctx, budget, "doc delete", [
				"doc",
				"delete",
				"--id",
				args.id,
				"--yes"
			], () => ({
				content: `deleted doc (${args.id})`,
				data: { id: args.id }
			}));
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_doc_import",
		description: "Import files into a knowledge base. Inline mode (.md): pass fileName + content (content becomes the doc body; do not repeat the file title as a level-1 heading). Reference mode (docx/xlsx/xls/csv/pptx/pdf/html/htm): upload first via yzj_file_upload and pass fileName + fileId + fileSize.",
		parameters: {
			workspace: {
				type: "string",
				required: true,
				description: "Target knowledge base id (KB_ID)."
			},
			items: {
				type: "array",
				required: true,
				items: {
					type: "object",
					additionalProperties: false,
					properties: {
						fileName: {
							type: "string",
							required: true,
							description: "File name with extension; .md selects inline mode, other supported extensions reference mode."
						},
						content: {
							type: "string",
							description: "Inline-mode markdown body (only for .md files)."
						},
						fileId: {
							type: "string",
							description: "Reference-mode uploaded file id (non-md formats)."
						},
						fileSize: {
							type: "number",
							description: "Reference-mode uploaded file size in bytes."
						}
					}
				},
				description: "Import items; .md uses content (inline), other formats use fileId+fileSize (reference)."
			},
			parentId: {
				type: "string",
				description: "Optional parent node id to import under."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => false,
		async execute(args) {
			const command = [
				"doc",
				"import",
				"--workspace",
				args.workspace
			];
			if (args.parentId !== void 0) command.push("--parent-id", args.parentId);
			command.push("--items", JSON.stringify(args.items));
			return runValue(ctx, budget, "doc import", command, (json) => {
				const nodes = cliList(json);
				if (nodes.length > 0) return {
					content: nodes.map((record) => {
						const node = asRecord(record);
						const id = asString(node.id);
						return `${asString(node.title) || asString(node.fileName) || id} (${id})\n${docLink(id)}`;
					}).join("\n"),
					data: { list: clipJson(nodes, { maxChars: budget.maxMetaChars }) }
				};
				const raw = cliObject(json);
				return {
					content: Object.keys(raw).length === 0 ? `imported ${args.items.length} item(s)` : `imported ${args.items.length} item(s)`,
					data: { payload: clipJson(raw, { maxChars: budget.maxMetaChars }) }
				};
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_doc_download_url",
		description: "Get a temporary (30-minute) download URL for an Office/HTML file node in a knowledge base (docx/xlsx/xls/csv/pptx/pdf/html/htm). Not supported for otl/dbt/md nodes.",
		parameters: { id: {
			type: "string",
			required: true,
			description: "Node id (DOC_ID) of the file."
		} },
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => true,
		async execute(args) {
			return runValue(ctx, budget, "doc download-url", [
				"doc",
				"download-url",
				"--id",
				args.id
			], (json) => {
				const payload = cliObject(json);
				const url = asString(payload.url ?? payload.downloadUrl);
				return {
					content: url === "" ? "(no download url in response)" : url,
					data: {
						record: clipJson(payload, { maxChars: budget.maxMetaChars }),
						url
					}
				};
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_doc_block_list",
		description: "List the block structure of an online doc, optionally rooted at one block. Each block line shows type, id, and a text preview.",
		parameters: {
			id: {
				type: "string",
				required: true,
				description: "Doc node id (DOC_ID)."
			},
			blockId: {
				type: "string",
				description: "Optional block id to list only its subtree."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => true,
		async execute(args) {
			const command = [
				"doc",
				"block",
				"list",
				"--id",
				args.id
			];
			if (args.blockId !== void 0) command.push("--block-id", args.blockId);
			return runValue(ctx, budget, "doc block list", command, (json) => {
				const blocks = cliList(json, ["blocks", "list"]);
				const lines = blocks.map(blockLine);
				return {
					content: lines.length === 0 ? "(no blocks)" : lines.join("\n"),
					data: { list: clipJson(blocks, { maxChars: budget.maxMetaChars }) }
				};
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_doc_block_insert",
		description: "Insert blocks into an online doc. element is a JSON array of block objects (types: heading/paragraph/codeBlock/blockQuote/table; inline text nodes support bold/italic/underline/strike attrs). When inserting into a doc created by yzj_doc_create, do not repeat the doc title as a level-1 heading.",
		parameters: {
			id: {
				type: "string",
				required: true,
				description: "Doc node id (DOC_ID)."
			},
			element: {
				type: "string",
				required: true,
				description: "JSON array of block objects, e.g. [{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"content\":\"正文\"}]}]."
			},
			blockId: {
				type: "string",
				description: "Parent block id; defaults to \"doc\" (document root)."
			},
			index: {
				type: "number",
				description: "Insertion index; -1 (default) appends, 0 prepends."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => false,
		async execute(args) {
			const command = [
				"doc",
				"block",
				"insert",
				"--id",
				args.id,
				"--element",
				args.element
			];
			if (args.blockId !== void 0) command.push("--block-id", args.blockId);
			if (args.index !== void 0) command.push("--index", String(args.index));
			return runValue(ctx, budget, "doc block insert", command, (json) => {
				const id = args.id;
				return {
					content: `inserted blocks into doc (${id})\n${docLink(id)}`,
					data: {
						payload: clipJson(json, { maxChars: budget.maxMetaChars }),
						id,
						link: docLink(id)
					}
				};
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_doc_block_update",
		description: "Update blocks in an online doc. operations is a JSON array; each entry needs {\"operation\":\"update_content\"|\"update_attrs\",\"blockId\":\"<concrete block id from yzj_doc_block_list>\",\"content\":[...]|\"attrs\":{...}} (content for update_content, attrs for update_attrs).",
		parameters: {
			id: {
				type: "string",
				required: true,
				description: "Doc node id (DOC_ID)."
			},
			operations: {
				type: "string",
				required: true,
				description: "JSON array of update operations (see description)."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => false,
		async execute(args) {
			return runValue(ctx, budget, "doc block update", [
				"doc",
				"block",
				"update",
				"--id",
				args.id,
				"--operations",
				args.operations
			], (json) => ({
				content: `updated blocks in doc (${args.id})\n${docLink(args.id)}`,
				data: {
					payload: clipJson(json, { maxChars: budget.maxMetaChars }),
					id: args.id,
					link: docLink(args.id)
				}
			}));
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_doc_block_delete",
		description: "Delete child blocks of a parent block irreversibly. operations is a JSON array; each entry needs {\"blockId\":\"<parent block id — the CONTAINER, not the block itself>\",\"startIndex\":N,\"endIndex\":M} (half-open index range into the parent's content array). Requires user confirmation.",
		parameters: {
			id: {
				type: "string",
				required: true,
				description: "Doc node id (DOC_ID)."
			},
			operations: {
				type: "string",
				required: true,
				description: "JSON array of delete operations (see description)."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => false,
		async execute(args) {
			return runValue(ctx, budget, "doc block delete", [
				"doc",
				"block",
				"delete",
				"--id",
				args.id,
				"--operations",
				args.operations,
				"--yes"
			], (json) => ({
				content: `deleted blocks in doc (${args.id})\n${docLink(args.id)}`,
				data: {
					payload: clipJson(json, { maxChars: budget.maxMetaChars }),
					id: args.id,
					link: docLink(args.id)
				}
			}));
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_doc_search",
		description: "Search knowledge-base documents by keyword in title/file name. Optional workspace scope; paged (pageNum from 1, pageSize ≤50). Use this to locate a doc before yzj_doc_get / yzj_doc_write / yzj_doc_download.",
		parameters: {
			keyword: {
				type: "string",
				required: true,
				description: "Search keyword (matches title and file name)."
			},
			workspace: {
				type: "string",
				description: "Limit to one knowledge base (KB_ID)."
			},
			pageSize: {
				type: "number",
				description: "Page size, max 50 (default 20)."
			},
			pageNum: {
				type: "number",
				description: "Page number, from 1 (default 1)."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => true,
		async execute(args) {
			const command = [
				"doc",
				"search",
				"--keyword",
				args.keyword
			];
			if (args.workspace !== void 0) command.push("--workspace", args.workspace);
			if (args.pageSize !== void 0) command.push("--page-size", String(args.pageSize));
			if (args.pageNum !== void 0) command.push("--page-num", String(args.pageNum));
			return runValue(ctx, budget, "doc search", command, (json) => {
				const rows = cliList(json);
				const lines = rows.map(nodeLine);
				return {
					content: lines.length === 0 ? "(no matches)" : lines.join("\n"),
					data: { list: clipJson(rows, { maxChars: budget.maxMetaChars }) }
				};
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_doc_write",
		description: "Write the WHOLE content of one smart doc (otl) in one call: overwrite (default, replaces the entire body) or append (adds to the end). Content format markdown (default) or html. For surgical edits prefer yzj_doc_block_insert/update/replace — overwrite destroys the previous body, so it requires user confirmation.",
		parameters: {
			id: {
				type: "string",
				required: true,
				description: "Doc node id (must be an otl smart doc)."
			},
			content: {
				type: "string",
				required: true,
				description: "Full document content (overwrite) or the segment to append (append)."
			},
			mode: {
				type: "string",
				enum: ["overwrite", "append"],
				description: "overwrite (default) or append."
			},
			format: {
				type: "string",
				enum: ["markdown", "html"],
				description: "Content format (default markdown)."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs * 2,
		isConcurrencySafe: () => false,
		async execute(args) {
			const command = [
				"doc",
				"write",
				"--id",
				args.id,
				"--content",
				args.content
			];
			if (args.mode !== void 0) command.push("--mode", args.mode);
			if (args.format !== void 0) command.push("--format", args.format);
			return runValue(ctx, budget, "doc write", command, (json) => ({
				content: `wrote doc (${args.id}) mode=${args.mode ?? "overwrite"}\n${docLink(args.id)}`,
				data: {
					payload: clipJson(json, { maxChars: budget.maxMetaChars }),
					id: args.id,
					link: docLink(args.id)
				}
			}));
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_doc_download",
		description: "Download one knowledge-base Office/HTML document node to a local file. Without output the original file name lands in the current directory; without overwrite an existing file is auto-renamed (report.pdf → report (1).pdf). Overwriting an existing local file requires user confirmation.",
		parameters: {
			id: {
				type: "string",
				required: true,
				description: "Doc node id (must be an Office/HTML attachment-type node, not otl)."
			},
			output: {
				type: "string",
				description: "Output file path."
			},
			overwrite: {
				type: "boolean",
				description: "Overwrite an existing local file; requires user confirmation."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs * 2,
		isConcurrencySafe: () => false,
		async execute(args) {
			const command = [
				"doc",
				"download",
				"--id",
				args.id
			];
			if (args.output !== void 0) command.push("--output", args.output);
			if (args.overwrite === true) command.push("--overwrite");
			return runValue(ctx, budget, "doc download", command, (json) => ({
				content: `downloaded doc (${args.id})${args.output === void 0 ? "" : ` → ${args.output}`}`,
				data: {
					payload: clipJson(json, { maxChars: budget.maxMetaChars }),
					id: args.id,
					output: args.output ?? ""
				}
			}));
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_doc_block_replace",
		description: "Replace a block range inside an otl smart doc: deletes blocks [start, end) then inserts content. start >= 1 (index 0 is the doc title and can never be removed); end is exclusive and must exceed start. content is the same block-node JSON array shape as yzj_doc_block_insert.",
		parameters: {
			id: {
				type: "string",
				required: true,
				description: "Doc node id (otl)."
			},
			start: {
				type: "number",
				required: true,
				description: "Delete start index (inclusive, >= 1)."
			},
			end: {
				type: "number",
				required: true,
				description: "Delete end index (exclusive, > start)."
			},
			content: {
				type: "string",
				required: true,
				description: "Block-node JSON array to insert in place (see yzj_doc_block_insert)."
			},
			parentBlockId: {
				type: "string",
				description: "Parent block id; defaults to \"doc\" (document root)."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => false,
		async execute(args) {
			const command = [
				"doc",
				"block",
				"replace",
				"--id",
				args.id,
				"--start",
				String(args.start),
				"--end",
				String(args.end),
				"--content",
				args.content
			];
			if (args.parentBlockId !== void 0) command.push("--parent-block-id", args.parentBlockId);
			return runValue(ctx, budget, "doc block replace", command, (json) => ({
				content: `replaced blocks [${args.start}, ${args.end}) in doc (${args.id})\n${docLink(args.id)}`,
				data: {
					payload: clipJson(json, { maxChars: budget.maxMetaChars }),
					id: args.id,
					link: docLink(args.id)
				}
			}));
		}
	}));
}
/**
* Sheet-domain tools (多维表格): file creation, schema reads, table
* management, and record CRUD. Node-level rename/move/delete reuse the doc
* tools (the 多维表格 is a `fileSuffix=dbt` node); table/record destructive
* operations are gated by the approval guard.
*/
/** One sheet line: table id, name, and field names. */
function tableLine(record) {
	const table = asRecord(record);
	const id = asNumber(table.id);
	const name = asString(table.name);
	const fields = asArray(table.fields).map((field) => asString(asRecord(field).name)).filter((name) => name !== "");
	const head = `${name === "" ? "(unnamed)" : name} (${id ?? "?"})`;
	return fields.length === 0 ? head : `${head} · 字段: ${fields.join(" / ")}`;
}
/**
* One record's field map. The CLI returns `records[].fields` as a JSON
* **string** (e.g. `"{\"姓名\":\"张明\"}"`) on create/update/list, though some
* paths emit a nested object; accept both.
*/
function fieldsOf(record) {
	const row = asRecord(record);
	const raw = row.fieldsValue ?? row.fields ?? row.values;
	if (typeof raw === "string") try {
		return asRecord(JSON.parse(raw));
	} catch {
		return {};
	}
	return asRecord(raw);
}
/** One record line: record id plus the visible field values. */
function recordLine(record) {
	const row = asRecord(record);
	const id = asString(row.id ?? row.recordId);
	const fields = fieldsOf(record);
	const parts = [];
	for (const [key, value] of Object.entries(fields)) {
		if (value === null || value === void 0) continue;
		let text;
		if (typeof value === "string") text = value;
		else if (typeof value === "number" || typeof value === "boolean") text = String(value);
		else text = JSON.stringify(value);
		if (text.length > 80) text = `${text.slice(0, 80)}…`;
		parts.push(`${key}=${text}`);
	}
	const body = parts.join(", ");
	return id === "" ? body : `${id}${body === "" ? "" : `: ${body}`}`;
}
/** The record array from either a `{records: [...]}` payload or a bare array. */
function recordsOf(json) {
	return cliList(json, ["records", "list"]);
}
/** Register the sheet-domain tools. */
function applySheetTools(ctx, budget) {
	ctx.tools.register(defineTool({
		name: "yzj_sheet_create",
		description: "Create a 多维表格 (dbt node) in a knowledge base, optionally under a parent. Returns the new node id and link; use yzj_sheet_get to read its schema.",
		parameters: {
			workspace: {
				type: "string",
				required: true,
				description: "Knowledge base id (KB_ID)."
			},
			title: {
				type: "string",
				required: true,
				description: "Sheet title."
			},
			parent: {
				type: "string",
				description: "Optional parent node id to nest under."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => false,
		async execute(args) {
			const command = [
				"sheet",
				"create",
				"--workspace",
				args.workspace,
				"--title",
				args.title
			];
			if (args.parent !== void 0) command.push("--parent", args.parent);
			return runValue(ctx, budget, "sheet create", command, (json) => {
				const node = cliObject(json);
				const id = asString(node.id);
				const link = docLink(id);
				return {
					content: `created 多维表格 "${asString(node.title) || args.title}"${id === "" ? "" : ` (${id})`}\n${link}`,
					data: {
						record: clipJson(node, { maxChars: budget.maxMetaChars }),
						id,
						link
					}
				};
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_sheet_get",
		description: "Read a 多维表格's schema: one line per data table (integer table id, fields, views). Pass lite=true for names and ids only (no field details; yzj-cli --lite). Always call this before table/record operations to obtain real sheetIds and field names.",
		parameters: {
			id: {
				type: "string",
				required: true,
				description: "The 多维表格 node id (DOC_ID, fileSuffix=dbt)."
			},
			lite: {
				type: "boolean",
				description: "If true, request the compact schema (table name + id, no field details)."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => true,
		async execute(args) {
			const command = [
				"sheet",
				"get",
				"--id",
				args.id
			];
			if (args.lite === true) command.push("--lite");
			return runValue(ctx, budget, "sheet get", command, (json) => {
				const schema = cliObject(json);
				const lines = cliList(schema, ["sheets"]).map(tableLine);
				return {
					content: lines.length === 0 ? "(no tables)" : lines.join("\n"),
					data: { schema: clipJson(schema, { maxChars: budget.maxMetaChars }) }
				};
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_sheet_table_get",
		description: "Read one data table's structure (fields and views) by its integer table id, resolved from yzj_sheet_get.",
		parameters: {
			id: {
				type: "string",
				required: true,
				description: "The 多维表格 node id (DOC_ID)."
			},
			tableId: {
				type: "number",
				required: true,
				description: "Integer data-table id from yzj_sheet_get."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => true,
		async execute(args) {
			return runValue(ctx, budget, "sheet table get", [
				"sheet",
				"table",
				"get",
				"--id",
				args.id,
				"--table-id",
				String(args.tableId)
			], (json) => {
				const table = cliObject(json);
				return {
					content: tableLine(table),
					data: { table: clipJson(table, { maxChars: budget.maxMetaChars }) }
				};
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_sheet_table_create",
		description: "Create a data table inside a 多维表格. fields and views are JSON arrays; field type values include MultiLineText/Number/Currency/Percent/Date/Time/SingleSelect/MultipleSelect/Rating/Checkbox/Complete/ID/Phone/Email/Url/Contact/Attachment/Address/Note/Link; view types include Grid/Kanban/Gallery/Form/Gantt/Query.",
		parameters: {
			id: {
				type: "string",
				required: true,
				description: "The 多维表格 node id (DOC_ID)."
			},
			name: {
				type: "string",
				required: true,
				description: "Data-table name."
			},
			fields: {
				type: "string",
				required: true,
				description: "JSON array of field definitions, e.g. [{\"name\":\"任务名\",\"type\":\"MultiLineText\"}]."
			},
			views: {
				type: "string",
				required: true,
				description: "JSON array of view definitions, e.g. [{\"name\":\"默认视图\",\"type\":\"Grid\"}]."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => false,
		async execute(args) {
			return runValue(ctx, budget, "sheet table create", [
				"sheet",
				"table",
				"create",
				"--id",
				args.id,
				"--name",
				args.name,
				"--fields",
				args.fields,
				"--views",
				args.views
			], (json) => ({
				content: `created 数据表 "${args.name}" in 多维表格 (${args.id})\n${docLink(args.id)}`,
				data: {
					payload: clipJson(json, { maxChars: budget.maxMetaChars }),
					id: args.id,
					link: docLink(args.id)
				}
			}));
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_sheet_table_rename",
		description: "Rename a data table inside a 多维表格.",
		parameters: {
			id: {
				type: "string",
				required: true,
				description: "The 多维表格 node id (DOC_ID)."
			},
			tableId: {
				type: "number",
				required: true,
				description: "Integer data-table id."
			},
			name: {
				type: "string",
				required: true,
				description: "New data-table name."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => false,
		async execute(args) {
			return runValue(ctx, budget, "sheet table rename", [
				"sheet",
				"table",
				"rename",
				"--id",
				args.id,
				"--table-id",
				String(args.tableId),
				"--name",
				args.name
			], () => ({
				content: `renamed 数据表 ${args.tableId} → "${args.name}" (${args.id})`,
				data: {
					id: args.id,
					tableId: args.tableId,
					link: docLink(args.id)
				}
			}));
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_sheet_table_delete",
		description: "Delete a data table and all its records irreversibly. Requires user confirmation.",
		parameters: {
			id: {
				type: "string",
				required: true,
				description: "The 多维表格 node id (DOC_ID)."
			},
			tableId: {
				type: "number",
				required: true,
				description: "Integer data-table id to delete."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => false,
		async execute(args) {
			return runValue(ctx, budget, "sheet table delete", [
				"sheet",
				"table",
				"delete",
				"--id",
				args.id,
				"--table-id",
				String(args.tableId),
				"--yes"
			], () => ({
				content: `deleted 数据表 ${args.tableId} from 多维表格 (${args.id})`,
				data: {
					id: args.id,
					tableId: args.tableId
				}
			}));
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_sheet_record_list",
		description: "List records of a data table with optional filter/search/pagination. Filter JSON: {\"mode\":\"AND\",\"criteria\":[{\"field\":\"字段名\",\"operator\":\"Equals\",\"values\":[\"值\"]}]} (operators: Equals/NotEqu/Greater/GreaterEqu/Less/LessEqu/GreaterEquAndLessEqu/BeginWith/EndWith/Contains/NotContains/Intersected/Empty/NotEmpty).",
		parameters: {
			id: {
				type: "string",
				required: true,
				description: "The 多维表格 node id (DOC_ID)."
			},
			tableId: {
				type: "number",
				required: true,
				description: "Integer data-table id."
			},
			filter: {
				type: "string",
				description: "Optional filter JSON object (see description)."
			},
			textValue: {
				type: "string",
				description: "Optional text search value."
			},
			fields: {
				type: "array",
				items: { type: "string" },
				description: "Optional field names to return only."
			},
			viewId: {
				type: "string",
				description: "Optional view id to query through."
			},
			pageToken: {
				type: "string",
				description: "Pagination cursor from the previous page's next_page_token."
			},
			limit: {
				type: "number",
				description: "Max records; default 100, single call max 100."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => true,
		async execute(args) {
			const command = [
				"sheet",
				"record",
				"list",
				"--id",
				args.id,
				"--table-id",
				String(args.tableId)
			];
			if (args.filter !== void 0) command.push("--filter", args.filter);
			if (args.textValue !== void 0) command.push("--text-value", args.textValue);
			for (const field of args.fields ?? []) command.push("--fields", field);
			if (args.viewId !== void 0) command.push("--view-id", args.viewId);
			if (args.pageToken !== void 0) command.push("--page-token", args.pageToken);
			if (args.limit !== void 0) {
				if (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 100) throw new Error("yzj_sheet_record_list: limit must be an integer between 1 and 100");
				command.push("--limit", String(args.limit));
			}
			return runValue(ctx, budget, "sheet record list", command, (json) => {
				const records = recordsOf(json);
				const lines = records.map(recordLine);
				const root = cliObject(json);
				const next = asString(root.next_page_token ?? root.nextPageToken);
				return {
					content: [...lines.length === 0 ? ["(no records)"] : lines, ...next === "" ? [] : [`(more: page_token ${next})`]].join("\n"),
					data: {
						list: clipJson(records, { maxChars: budget.maxMetaChars }),
						nextPageToken: next
					}
				};
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_sheet_record_create",
		description: "Create records in a data table. records is a JSON array; each entry: {\"fieldsValue\":{\"字段名\":\"值\"}} — field names must match the schema from yzj_sheet_get, values follow the field types (strings, numbers, booleans, arrays, or objects for Url/Contact/Attachment/Address/Note).",
		parameters: {
			id: {
				type: "string",
				required: true,
				description: "The 多维表格 node id (DOC_ID)."
			},
			tableId: {
				type: "number",
				required: true,
				description: "Integer data-table id."
			},
			records: {
				type: "string",
				required: true,
				description: "JSON array of record entries with fieldsValue (see description)."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => false,
		async execute(args) {
			return runValue(ctx, budget, "sheet record create", [
				"sheet",
				"record",
				"create",
				"--id",
				args.id,
				"--table-id",
				String(args.tableId),
				"--records",
				args.records
			], (json) => {
				const created = recordsOf(json);
				return {
					content: `created ${created.length > 0 ? created.length : "?"} record(s) in 数据表 ${args.tableId} (${args.id})\n${docLink(args.id)}`,
					data: {
						list: clipJson(created, { maxChars: budget.maxMetaChars }),
						id: args.id,
						link: docLink(args.id)
					}
				};
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_sheet_record_update",
		description: "Update records in a data table. records is a JSON array; each entry: {\"id\":\"rec_xxx\",\"fieldsValue\":{\"字段名\":\"新值\"}} — only the fields to change.",
		parameters: {
			id: {
				type: "string",
				required: true,
				description: "The 多维表格 node id (DOC_ID)."
			},
			tableId: {
				type: "number",
				required: true,
				description: "Integer data-table id."
			},
			records: {
				type: "string",
				required: true,
				description: "JSON array of {id, fieldsValue} entries (see description)."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => false,
		async execute(args) {
			return runValue(ctx, budget, "sheet record update", [
				"sheet",
				"record",
				"update",
				"--id",
				args.id,
				"--table-id",
				String(args.tableId),
				"--records",
				args.records
			], (json) => ({
				content: `updated record(s) in 数据表 ${args.tableId} (${args.id})\n${docLink(args.id)}`,
				data: {
					payload: clipJson(json, { maxChars: budget.maxMetaChars }),
					id: args.id,
					link: docLink(args.id)
				}
			}));
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_sheet_record_delete",
		description: "Delete records irreversibly by comma-separated record ids. Requires user confirmation.",
		parameters: {
			id: {
				type: "string",
				required: true,
				description: "The 多维表格 node id (DOC_ID)."
			},
			tableId: {
				type: "number",
				required: true,
				description: "Integer data-table id."
			},
			recordIds: {
				type: "string",
				required: true,
				description: "Comma-separated record ids, e.g. \"rec_abc,rec_def\"."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => false,
		async execute(args) {
			return runValue(ctx, budget, "sheet record delete", [
				"sheet",
				"record",
				"delete",
				"--id",
				args.id,
				"--table-id",
				String(args.tableId),
				"--record-ids",
				args.recordIds,
				"--yes"
			], () => ({
				content: `deleted record(s) [${args.recordIds}] from 数据表 ${args.tableId} (${args.id})`,
				data: {
					id: args.id,
					tableId: args.tableId,
					recordIds: args.recordIds
				}
			}));
		}
	}));
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
* Unwrap the CLI list envelopes into a record array (0.1.6 `{success,data}`
* plus 0.1.4 bare array / `{list}`).
*/
function calendarEventsFromJson(json) {
	const payload = unwrapCli(json);
	if (Array.isArray(payload)) return payload;
	const record = asRecord(payload);
	if (Array.isArray(record.list)) return record.list;
	if (Array.isArray(record.data)) return record.data;
	const nested = asRecord(record.data);
	if (Array.isArray(nested.list)) return nested.list;
	if (Array.isArray(nested.events)) return nested.events;
	return asArray(payload);
}
/**
* Dedupe by event id (fallback: JSON identity) and sort by `startDate`.
*/
function mergeCalendarEvents(records) {
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const record of records) {
		const id = asString(asRecord(record).id);
		const key = id === "" ? JSON.stringify(record) : id;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(record);
	}
	out.sort((left, right) => {
		return (asNumber(asRecord(left).startDate) ?? 0) - (asNumber(asRecord(right).startDate) ?? 0);
	});
	return out;
}
/** Keep events whose `startDate` sits inside the original window. */
function filterCalendarEvents(records, start, end) {
	const startMs = calendarBoundMs(start, "start");
	const endMs = calendarBoundMs(end, "end");
	if (startMs === void 0 || endMs === void 0) return [...records];
	return records.filter((record) => {
		const ms = asNumber(asRecord(record).startDate);
		if (ms === void 0) return true;
		return ms >= startMs && ms <= endMs;
	});
}
/** Local day of an event `startDate`, or `undefined` when missing. */
function calendarEventDay(record) {
	const ms = asNumber(asRecord(record).startDate);
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
/**
* Calendar-domain tools: event queries, create/update/delete, participants,
* and free-room lookup. Event deletion is gated by the approval guard.
*/
/** Format an epoch-ms timestamp as `MM-DD HH:mm` in local time. */
function clockTime(ms) {
	const value = asNumber(ms);
	if (value === void 0) return "";
	const date = new Date(value);
	const pad = (n) => String(n).padStart(2, "0");
	return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
/** Slim list row for the card payload (full CLI blobs overflow the meta cap). */
function eventCard(record) {
	const event = asRecord(record);
	const out = {};
	for (const key of [
		"id",
		"title",
		"startDate",
		"endDate",
		"personName",
		"meetingPlace",
		"content",
		"meetingStatus"
	]) {
		const value = event[key];
		if (value !== void 0 && value !== null && value !== "") out[key] = value;
	}
	return out;
}
/** One event line for list digests. */
function eventLine(record) {
	const event = asRecord(record);
	const title = asString(event.title);
	const id = asString(event.id);
	const start = clockTime(event.startDate);
	const end = clockTime(event.endDate);
	const person = asString(event.personName);
	const status = asNumber(event.meetingStatus);
	const parts = [title === "" ? id : title];
	if (start !== "") parts.push(`${start}${end === "" ? "" : `→${end}`}`);
	if (person !== "") parts.push(person);
	if (status !== void 0 && status !== 1) parts.push(`状态 ${status}`);
	if (id !== "" && id !== title) parts.push(`(${id})`);
	return parts.join(" · ");
}
/** Register the calendar-domain tools. */
function applyCalendarTools(ctx, budget) {
	ctx.tools.register(defineTool({
		name: "yzj_calendar_event_list",
		description: "List calendar events in a time window (pure dates or datetimes). Multi-day windows are scanned with a two-pointer walk so recurring instances are not collapsed to the first occurrence. Returns one line per event.",
		parameters: {
			start: {
				type: "string",
				required: true,
				description: "Start: \"YYYY-MM-DD\", \"YYYY-MM-DDTHH:mm:ss\", with timezone, or unix seconds/ms."
			},
			end: {
				type: "string",
				required: true,
				description: "End (same formats)."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => true,
		async execute(args) {
			const collected = await collectCalendarEvents(args.start, args.end, async (start, end) => {
				const result = await ctx.yzjBridge.run([
					"calendar",
					"event",
					"list",
					"--start",
					start,
					"--end",
					end
				], { timeoutMs: budget.timeoutMs });
				if (!result.ok) return {
					ok: false,
					errorText: result.stderr.trim() === "" ? `exit ${result.exitCode ?? "killed"}` : result.stderr.trim()
				};
				return result.json === void 0 ? { ok: true } : {
					ok: true,
					json: result.json
				};
			});
			if (!collected.ok) return {
				content: `yzj calendar event list failed: ${collected.errorText}`,
				truncated: false,
				data: {}
			};
			const events = collected.events;
			if (events.length === 0) return {
				content: "(no events)",
				truncated: false,
				data: { list: clipJson([], { maxChars: budget.maxMetaChars }) }
			};
			const digest = linesOf(events.map(eventLine), budget.maxRenderChars);
			return {
				content: digest.content,
				truncated: digest.truncated,
				data: { list: clipJson(events.map(eventCard), { maxChars: budget.maxMetaChars }) }
			};
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_calendar_event_get",
		description: "Fetch one calendar event by id.",
		parameters: { id: {
			type: "string",
			required: true,
			description: "Event id."
		} },
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => true,
		async execute(args) {
			return runValue(ctx, budget, "calendar event get", [
				"calendar",
				"event",
				"get",
				"--id",
				args.id
			], (json) => {
				const event = cliObject(json);
				return {
					content: eventLine(event),
					data: { record: clipJson(event, { maxChars: budget.maxMetaChars }) }
				};
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_calendar_event_create",
		description: "Create a calendar event/meeting. organizerOpenIds is required; resolve openIds via yzj_contact_search first.",
		parameters: {
			title: {
				type: "string",
				required: true,
				description: "Event title (max 100 chars)."
			},
			start: {
				type: "string",
				required: true,
				description: "Start time (see yzj_calendar_event_list formats)."
			},
			end: {
				type: "string",
				required: true,
				description: "End time."
			},
			organizerOpenIds: {
				type: "array",
				required: true,
				items: { type: "string" },
				description: "Organizer openIds (required)."
			},
			openId: {
				type: "string",
				description: "Operating user openId (required under app-level authorization)."
			},
			description: {
				type: "string",
				description: "Event description."
			},
			roomId: {
				type: "string",
				description: "Meeting room id (from yzj_calendar_room_find)."
			},
			attendeeOpenIds: {
				type: "array",
				items: { type: "string" },
				description: "Attendee openIds."
			},
			calendarId: {
				type: "string",
				description: "Calendar id; omit for the main calendar."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => false,
		async execute(args) {
			const command = [
				"calendar",
				"event",
				"create",
				"--title",
				args.title,
				"--start",
				args.start,
				"--end",
				args.end
			];
			if (args.openId !== void 0) command.push("--open-id", args.openId);
			if (args.organizerOpenIds.length === 0) throw new Error("yzj_calendar_event_create: organizerOpenIds must not be empty");
			for (const id of args.organizerOpenIds) command.push("--meet-organizer-open-ids", id);
			if (args.description !== void 0) command.push("--description", args.description);
			if (args.roomId !== void 0) command.push("--room-id", args.roomId);
			for (const id of args.attendeeOpenIds ?? []) command.push("--attendee-open-ids", id);
			if (args.calendarId !== void 0) command.push("--calendar-id", args.calendarId);
			return runValue(ctx, budget, "calendar event create", command, (json) => {
				const event = cliObject(json);
				const id = asString(event.id);
				return {
					content: `created 日程 "${args.title}"${id === "" ? "" : ` (${id})`}`,
					data: {
						record: clipJson(event, { maxChars: budget.maxMetaChars }),
						id
					}
				};
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_calendar_event_update",
		description: "Update a calendar event; only the provided fields change.",
		parameters: {
			id: {
				type: "string",
				required: true,
				description: "Event id."
			},
			openId: {
				type: "string",
				description: "Operating user openId (required under app-level authorization)."
			},
			title: {
				type: "string",
				description: "New title."
			},
			start: {
				type: "string",
				description: "New start time."
			},
			end: {
				type: "string",
				description: "New end time."
			},
			description: {
				type: "string",
				description: "New description."
			},
			roomId: {
				type: "string",
				description: "New room id."
			},
			addAttendeeOpenIds: {
				type: "array",
				items: { type: "string" },
				description: "Attendees to add."
			},
			removeAttendeeOpenIds: {
				type: "array",
				items: { type: "string" },
				description: "Attendees to remove."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => false,
		async execute(args) {
			const command = [
				"calendar",
				"event",
				"update",
				"--id",
				args.id
			];
			if (args.openId !== void 0) command.push("--open-id", args.openId);
			if (args.title !== void 0) command.push("--title", args.title);
			if (args.start !== void 0) command.push("--start", args.start);
			if (args.end !== void 0) command.push("--end", args.end);
			if (args.description !== void 0) command.push("--description", args.description);
			if (args.roomId !== void 0) command.push("--room-id", args.roomId);
			for (const id of args.addAttendeeOpenIds ?? []) command.push("--add-attendee-open-ids", id);
			for (const id of args.removeAttendeeOpenIds ?? []) command.push("--remove-attendee-open-ids", id);
			return runValue(ctx, budget, "calendar event update", command, (json) => ({
				content: `updated 日程 (${args.id})`,
				data: {
					payload: clipJson(json, { maxChars: budget.maxMetaChars }),
					id: args.id
				}
			}));
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_calendar_event_delete",
		description: "Cancel (soft, default) or hard-delete a calendar event. Requires user confirmation.",
		parameters: {
			id: {
				type: "string",
				required: true,
				description: "Event id."
			},
			openId: {
				type: "string",
				description: "Operating user openId (required under app-level authorization)."
			},
			hard: {
				type: "boolean",
				description: "Hard-delete irreversibly; omit for soft cancellation."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => false,
		async execute(args) {
			const command = [
				"calendar",
				"event",
				"delete",
				"--id",
				args.id,
				"--yes"
			];
			if (args.openId !== void 0) command.push("--open-id", args.openId);
			if (args.hard === true) command.push("--hard");
			return runValue(ctx, budget, "calendar event delete", command, () => ({
				content: `${args.hard === true ? "hard-deleted" : "cancelled"} 日程 (${args.id})`,
				data: {
					id: args.id,
					hard: args.hard === true
				}
			}));
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_calendar_event_participants",
		description: "List the participants of a calendar event.",
		parameters: { id: {
			type: "string",
			required: true,
			description: "Event id."
		} },
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => true,
		async execute(args) {
			return runValue(ctx, budget, "calendar event participants", [
				"calendar",
				"event",
				"participants",
				"--id",
				args.id
			], (json) => {
				const participants = cliList(json);
				const lines = participants.map((record) => {
					const p = asRecord(record);
					const name = asString(p.name ?? p.personName);
					const openId = asString(p.openId ?? p.openid);
					return name === "" ? openId : `${name}${openId === "" ? "" : ` (${openId})`}`;
				});
				return {
					content: lines.length === 0 ? "(no participants)" : lines.join("\n"),
					data: { list: clipJson(participants, { maxChars: budget.maxMetaChars }) }
				};
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_calendar_room_find",
		description: "Find free meeting rooms for a time slot within ONE day (start and end must share a date). Query only — booking happens via yzj_calendar_event_create with roomId.",
		parameters: {
			start: {
				type: "string",
				required: true,
				description: "Slot start (datetime)."
			},
			end: {
				type: "string",
				required: true,
				description: "Slot end (same day)."
			},
			openId: {
				type: "string",
				description: "Operating user openId (required under app-level authorization)."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => true,
		async execute(args) {
			const command = [
				"calendar",
				"room",
				"find",
				"--start",
				args.start,
				"--end",
				args.end
			];
			if (args.openId !== void 0) command.push("--open-id", args.openId);
			return runValue(ctx, budget, "calendar room find", command, (json) => {
				const rooms = cliList(json);
				const lines = rooms.map((record) => {
					const room = asRecord(record);
					const name = asString(room.name ?? room.roomName);
					const id = asString(room.id ?? room.roomId);
					return name === "" ? id : `${name}${id === "" ? "" : ` (${id})`}`;
				});
				return {
					content: lines.length === 0 ? "(no free rooms)" : lines.join("\n"),
					data: { list: clipJson(rooms, { maxChars: budget.maxMetaChars }) }
				};
			});
		}
	}));
}
/**
* IM-domain tools: message sending, history listing, and recent group
* sessions. Sending is a serious side effect and is gated by the approval
* guard; the tool itself validates the mutually exclusive target and
* msg-type/attachment combinations the CLI enforces.
*/
/** Format "YYYY-MM-DD HH:mm:ss.SSS" as `MM-DD HH:mm`. */
function shortTime(text) {
	const value = asString(text);
	return value.length >= 16 ? value.slice(5, 16) : value;
}
/** One message line for history digests. */
function messageLine(record) {
	const message = asRecord(record);
	const content = asString(message.content);
	const from = asString(message.fromOpenId);
	const time = shortTime(message.sendTime);
	const msgType = asString(message.msgType);
	const reply = asRecord(message.param);
	const replySummary = asString(reply.replySummary);
	const parts = [];
	if (time !== "") parts.push(`[${time}]`);
	parts.push(from === "" ? "(unknown sender)" : from);
	const body = content === "" ? `(${msgType === "" ? "message" : msgType})` : content;
	const replyMark = replySummary === "" ? "" : ` ↳${replySummary}`;
	const fileMark = fileIdMark(reply);
	parts.push(`${body}${fileMark}${replyMark}`);
	const msgId = asString(message.msgId);
	if (msgId !== "") parts.push(`<${msgId}>`);
	return parts.join(" ");
}
/** One group line for recent-session digests. */
function groupLine(record) {
	const group = asRecord(record);
	const name = asString(group.groupName);
	const id = asString(group.groupId);
	const groupType = asNumber(group.groupType);
	const unread = asNumber(group.unreadCount);
	const lastContent = asString(asRecord(group.lastMsg).content);
	const parts = [name === "" ? id : name];
	if (groupType !== void 0) parts.push(`类型${groupType}`);
	if (unread !== void 0 && unread > 0) parts.push(`未读 ${unread}`);
	if (lastContent !== "") parts.push(`最近: ${lastContent.replace(/\s+/g, " ").slice(0, 40)}`);
	if (id !== "" && id !== name) parts.push(`(${id})`);
	return parts.join(" · ");
}
/** One group-search-hit line: group header plus nested message previews. */
function searchHitLine(record) {
	const row = asRecord(record);
	const group = asRecord(row.group);
	const name = asString(group.groupName || row.groupName);
	const id = asString(group.groupId || row.groupId);
	const matched = asNumber(row.matchedMessageCount);
	const messages = asArray(row.messages);
	const head = [
		name === "" ? id : name,
		matched !== void 0 ? `命中 ${matched}` : messages.length > 0 ? `命中 ${messages.length}` : "",
		id !== "" && id !== name ? `(${id})` : ""
	].filter((part) => part !== "").join(" · ");
	const nested = messages.map((item) => {
		const wrapped = asRecord(item);
		return `  ${messageLine(Object.keys(asRecord(wrapped.message)).length > 0 ? wrapped.message : item)}`;
	});
	return [head === "" ? "(group)" : head, ...nested].join("\n");
}
/** Flatten a message-search hit so the card can reuse the group renderer. */
function searchHitCard(record) {
	const row = asRecord(record);
	const group = asRecord(row.group);
	const groupId = asString(group.groupId || row.groupId);
	const groupName = asString(group.groupName || row.groupName);
	const matched = asNumber(row.matchedMessageCount);
	const messages = asArray(row.messages);
	return {
		groupId,
		groupName,
		matchedMessageCount: matched,
		messages,
		lastMsg: { content: `${matched ?? messages.length} 条命中` }
	};
}
/** Register the im-domain tools. */
function applyImTools(ctx, budget) {
	ctx.tools.register(defineTool({
		name: "yzj_im_message_send",
		description: "Send an IM message to a group or direct chat. Exactly one of groupId / toOpenId; msg-type text|richText require content (file requires fileId). @ mentions need at-open-id per @姓名 in content and at-all per @all (group chats only). Reply uses replyMsgId with text/richText. Requires user confirmation before dispatch.",
		parameters: {
			groupId: {
				type: "string",
				description: "Target group or chat session id; mutually exclusive with toOpenId."
			},
			toOpenId: {
				type: "string",
				description: "Direct-chat target openId; mutually exclusive with groupId."
			},
			msgType: {
				type: "string",
				required: true,
				enum: [
					"text",
					"file",
					"richText"
				],
				description: "text or richText need content; file needs fileId."
			},
			content: {
				type: "string",
				description: "Message body; required for text/richText. @all and @姓名 must be standalone fragments (\"@all 请关注\")."
			},
			fileId: {
				type: "string",
				description: "Uploaded file id (from yzj_file_upload); required for msg-type file."
			},
			replyMsgId: {
				type: "string",
				description: "Reply-to message id; text/richText only."
			},
			atOpenIds: {
				type: "array",
				items: { type: "string" },
				description: "One per @姓名 in content, in order; group chats only."
			},
			atAll: {
				type: "boolean",
				description: "True when content contains @all (user must have explicitly asked for @all)."
			},
			images: {
				type: "array",
				items: { type: "string" },
				description: "File ids for [图片] placeholders in richText content."
			},
			refs: {
				type: "array",
				items: { type: "string" },
				description: "Referenced Yunzhijia ref tokens (yzj:... encodings from dragged or @-picked chips) this message is based on; the confirmation card shows them as 关联引用. Never sent to the CLI."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => false,
		async execute(args) {
			if (args.groupId === void 0 === (args.toOpenId === void 0)) throw new Error("yzj_im_message_send: exactly one of groupId or toOpenId is required");
			if (args.msgType === "file") {
				if (args.fileId === void 0) throw new Error("yzj_im_message_send: msg-type file requires fileId");
				if (args.content !== void 0 || args.replyMsgId !== void 0 || args.atAll === true || (args.atOpenIds ?? []).length > 0) throw new Error("yzj_im_message_send: msg-type file does not support content, reply, or @ mentions");
			} else if (args.content === void 0 || args.content.trim() === "") throw new Error("yzj_im_message_send: text/richText require non-empty content");
			if (args.msgType !== "richText" && (args.images ?? []).length > 0) throw new Error("yzj_im_message_send: images are only supported for msg-type richText");
			const command = [
				"im",
				"message",
				"send",
				"--msg-type",
				args.msgType
			];
			if (args.groupId !== void 0) command.push("--group-id", args.groupId);
			if (args.toOpenId !== void 0) command.push("--to-open-id", args.toOpenId);
			if (args.content !== void 0) command.push("--content", args.content);
			if (args.fileId !== void 0) command.push("--file-id", args.fileId);
			if (args.replyMsgId !== void 0) command.push("--reply-msg-id", args.replyMsgId);
			for (const id of args.atOpenIds ?? []) command.push("--at-open-id", id);
			if (args.atAll === true) command.push("--at-all");
			for (const image of args.images ?? []) command.push("--image", image);
			return runValue(ctx, budget, "im message send", command, (json) => {
				const payload = cliObject(json);
				const msgId = asString(payload.msgId ?? payload.id);
				return {
					content: `sent ${args.msgType} message${msgId === "" ? "" : ` (${msgId})`}`,
					data: {
						payload: clipJson(payload, { maxChars: budget.maxMetaChars }),
						msgId
					}
				};
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_im_message_list",
		description: "List chat history of a group/session: newest (default) or anchored old/new around msgId. Returns one line per message with time, sender, content, and msgId.",
		parameters: {
			groupId: {
				type: "string",
				required: true,
				description: "Group or chat session id."
			},
			type: {
				type: "string",
				enum: [
					"newest",
					"old",
					"new"
				],
				description: "newest fetches the latest; old/new page around msgId."
			},
			msgId: {
				type: "string",
				description: "Anchor message id; required for type old/new."
			},
			limit: {
				type: "number",
				description: "Message count; default 20, range 1-20 (CLI cap)."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => true,
		async execute(args) {
			const command = [
				"im",
				"message",
				"list",
				"--group-id",
				args.groupId
			];
			if (args.type !== void 0) command.push("--type", args.type);
			if (args.msgId !== void 0) command.push("--msg-id", args.msgId);
			if (args.limit !== void 0) {
				if (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 20) throw new Error("yzj_im_message_list: limit must be an integer between 1 and 20 (CLI cap)");
				command.push("--limit", String(args.limit));
			}
			return runValue(ctx, budget, "im message list", command, (json) => {
				const root = cliObject(json);
				const messages = cliList(root);
				const more = root.more === true;
				const lines = messages.map(messageLine);
				return {
					content: [...lines.length === 0 ? ["(no messages)"] : lines, ...more ? ["(more messages available)"] : []].join("\n"),
					data: {
						list: clipJson(messages, { maxChars: budget.maxMetaChars }),
						more
					}
				};
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_im_group_recent",
		description: "List recent group/chat sessions with unread counts and last-message previews, newest first. To find a group by name use yzj_im_group_search; to find a message use yzj_im_message_search.",
		parameters: {
			limit: {
				type: "number",
				description: "Per-page count; default 20, range 1-20 (CLI cap)."
			},
			page: {
				type: "number",
				description: "Page number; default 1, must be >= 1."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => true,
		async execute(args) {
			const command = [
				"im",
				"group",
				"recent"
			];
			if (args.limit !== void 0) {
				if (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 20) throw new Error("yzj_im_group_recent: limit must be an integer between 1 and 20 (CLI cap)");
				command.push("--limit", String(args.limit));
			}
			if (args.page !== void 0) {
				if (!Number.isInteger(args.page) || args.page < 1) throw new Error("yzj_im_group_recent: page must be an integer >= 1");
				command.push("--page", String(args.page));
			}
			return runValue(ctx, budget, "im group recent", command, (json) => {
				const root = cliObject(json);
				const groups = cliList(root);
				const more = root.more === true;
				const lines = groups.map(groupLine);
				return {
					content: [...lines.length === 0 ? "(no recent groups)" : lines, ...more ? ["(more pages available)"] : []].join("\n"),
					data: {
						list: clipJson(groups, { maxChars: budget.maxMetaChars }),
						more
					}
				};
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_im_group_search",
		description: "Search groups visible to the current user by keyword. Use to resolve a group id when yzj_im_group_recent paging misses it (e.g. before message operations).",
		parameters: {
			keyword: {
				type: "string",
				required: true,
				description: "Group-name keyword."
			},
			limit: {
				type: "number",
				description: "Per-page count (default 10)."
			},
			page: {
				type: "number",
				description: "Page number (default 1)."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => true,
		async execute(args) {
			const command = [
				"im",
				"group",
				"search",
				"--keyword",
				args.keyword
			];
			if (args.limit !== void 0) command.push("--limit", String(args.limit));
			if (args.page !== void 0) command.push("--page", String(args.page));
			return runValue(ctx, budget, "im group search", command, (json) => {
				const groups = cliList(json);
				const lines = groups.map(groupLine);
				return {
					content: lines.length === 0 ? "(no matches)" : lines.join("\n"),
					data: { list: clipJson(groups, { maxChars: budget.maxMetaChars }) }
				};
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_im_group_create",
		description: "Create a group with the current user as owner. memberOpenIds are the initial members EXCLUDING the creator — the CLI requires 2-10. Requires user confirmation.",
		parameters: {
			name: {
				type: "string",
				description: "Group name."
			},
			memberOpenIds: {
				type: "array",
				items: { type: "string" },
				required: true,
				description: "Initial member openIds (2-10, creator excluded)."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => false,
		async execute(args) {
			const members = Array.isArray(args.memberOpenIds) ? args.memberOpenIds.map(String).filter((id) => id !== "") : [];
			if (members.length < 2 || members.length > 10) throw new Error(`yzj_im_group_create: memberOpenIds needs 2-10 openIds (creator excluded), got ${members.length}`);
			const command = [
				"im",
				"group",
				"create"
			];
			if (args.name !== void 0) command.push("--name", args.name);
			for (const id of members) command.push("--member-open-id", id);
			return runValue(ctx, budget, "im group create", command, (json) => {
				const payload = cliObject(json);
				const groupId = asString(payload.groupId ?? payload.id);
				return {
					content: `created group${args.name === void 0 ? "" : `「${args.name}」`} (${groupId === "" ? "id unknown" : groupId}) with ${members.length} member(s)`,
					data: {
						payload: clipJson(payload, { maxChars: budget.maxMetaChars }),
						groupId
					}
				};
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_im_group_members_add",
		description: "Add members to a group (≤10 openIds per call). Requires user confirmation.",
		parameters: {
			groupId: {
				type: "string",
				required: true,
				description: "Target group id."
			},
			openIds: {
				type: "array",
				items: { type: "string" },
				required: true,
				description: "Member openIds to add (max 10)."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => false,
		async execute(args) {
			const openIds = Array.isArray(args.openIds) ? args.openIds.map(String).filter((id) => id !== "") : [];
			if (openIds.length === 0 || openIds.length > 10) throw new Error(`yzj_im_group_members_add: openIds needs 1-10 ids, got ${openIds.length}`);
			const command = [
				"im",
				"group.members",
				"add",
				"--group-id",
				args.groupId
			];
			for (const id of openIds) command.push("--open-id", id);
			return runValue(ctx, budget, "im group.members add", command, (json) => ({
				content: `added ${openIds.length} member(s) to group (${args.groupId})`,
				data: {
					payload: clipJson(json, { maxChars: budget.maxMetaChars }),
					groupId: args.groupId,
					count: openIds.length
				}
			}));
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_im_group_members_remove",
		description: "Remove members from a group irreversibly (≤10 openIds per call). Strong user confirmation required; the approval already covers the CLI --yes flag.",
		parameters: {
			groupId: {
				type: "string",
				required: true,
				description: "Target group id."
			},
			openIds: {
				type: "array",
				items: { type: "string" },
				required: true,
				description: "Member openIds to remove (max 10)."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => false,
		async execute(args) {
			const openIds = Array.isArray(args.openIds) ? args.openIds.map(String).filter((id) => id !== "") : [];
			if (openIds.length === 0 || openIds.length > 10) throw new Error(`yzj_im_group_members_remove: openIds needs 1-10 ids, got ${openIds.length}`);
			const command = [
				"im",
				"group.members",
				"remove",
				"--group-id",
				args.groupId
			];
			for (const id of openIds) command.push("--open-id", id);
			command.push("--yes");
			return runValue(ctx, budget, "im group.members remove", command, (json) => ({
				content: `removed ${openIds.length} member(s) from group (${args.groupId})`,
				data: {
					payload: clipJson(json, { maxChars: budget.maxMetaChars }),
					groupId: args.groupId,
					count: openIds.length
				}
			}));
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_im_message_recall",
		description: "Recall one of your own IM messages. Only the sender can recall, and the server enforces a time window. Exactly one of groupId / toOpenId. Strong user confirmation required. The CLI does not use --yes for this command — the product card is the gate.",
		parameters: {
			msgId: {
				type: "string",
				required: true,
				description: "Message id to recall (from yzj_im_message_list; must be sent by the current user)."
			},
			groupId: {
				type: "string",
				description: "Group or chat session id; mutually exclusive with toOpenId."
			},
			toOpenId: {
				type: "string",
				description: "Direct-chat target openId; mutually exclusive with groupId."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => false,
		async execute(args) {
			if (args.groupId === void 0 === (args.toOpenId === void 0)) throw new Error("yzj_im_message_recall: exactly one of groupId or toOpenId is required");
			const command = [
				"im",
				"message",
				"recall",
				"--msg-id",
				args.msgId
			];
			if (args.groupId !== void 0) command.push("--group-id", args.groupId);
			if (args.toOpenId !== void 0) command.push("--to-open-id", args.toOpenId);
			return runValue(ctx, budget, "im message recall", command, (json) => ({
				content: `recalled message (${args.msgId})`,
				data: {
					payload: clipJson(json, { maxChars: budget.maxMetaChars }),
					msgId: args.msgId
				}
			}));
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_im_message_search",
		description: "Search visible chat history by keyword (min 2 characters). Results are grouped by conversation. Optional filters: groupId, senderOpenId, notifyToOpenId (@ target), start/end time. Use a hit's groupId + msgId with yzj_im_message_list for context.",
		parameters: {
			keyword: {
				type: "string",
				required: true,
				description: "Search keyword; at least 2 characters."
			},
			groupId: {
				type: "string",
				description: "Limit to one group or chat session."
			},
			senderOpenId: {
				type: "string",
				description: "Only messages from this sender."
			},
			notifyToOpenId: {
				type: "string",
				description: "Only messages that @ this openId (pass your own openId for \"who @ me\")."
			},
			start: {
				type: "string",
				description: "Range start: YYYY-MM-DD, datetime, or unix timestamp."
			},
			end: {
				type: "string",
				description: "Range end (same formats; a pure date is that day 23:59:59)."
			},
			limit: {
				type: "number",
				description: "Groups per page; default 10, range 1-20."
			},
			page: {
				type: "number",
				description: "Page number; default 1, range 1-200."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => true,
		async execute(args) {
			if (args.keyword.trim().length < 2) throw new Error("yzj_im_message_search: keyword must be at least 2 characters");
			const command = [
				"im",
				"message",
				"search",
				"--keyword",
				args.keyword
			];
			if (args.groupId !== void 0) command.push("--group-id", args.groupId);
			if (args.senderOpenId !== void 0) command.push("--sender-open-id", args.senderOpenId);
			if (args.notifyToOpenId !== void 0) command.push("--notify-to-open-id", args.notifyToOpenId);
			if (args.start !== void 0) command.push("--start", args.start);
			if (args.end !== void 0) command.push("--end", args.end);
			if (args.limit !== void 0) {
				if (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 20) throw new Error("yzj_im_message_search: limit must be an integer between 1 and 20 (CLI cap)");
				command.push("--limit", String(args.limit));
			}
			if (args.page !== void 0) {
				if (!Number.isInteger(args.page) || args.page < 1 || args.page > 200) throw new Error("yzj_im_message_search: page must be an integer between 1 and 200");
				command.push("--page", String(args.page));
			}
			return runValue(ctx, budget, "im message search", command, (json) => {
				const root = cliObject(json);
				const hits = cliList(root);
				const more = root.more === true;
				const lines = hits.map(searchHitLine);
				return {
					content: [...lines.length === 0 ? ["(no matches)"] : lines, ...more ? ["(more pages available)"] : []].join("\n"),
					data: {
						list: clipJson(hits.map(searchHitCard), { maxChars: budget.maxMetaChars }),
						more
					}
				};
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_im_group_rename",
		description: "Rename a group. The current user must be in the group; some groups require an admin. Does not support external groups. Requires user confirmation. Empty CLI receipt on success.",
		parameters: {
			groupId: {
				type: "string",
				required: true,
				description: "Target group id."
			},
			name: {
				type: "string",
				required: true,
				description: "New group name (must come from the user; cannot be blank)."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => false,
		async execute(args) {
			if (args.name.trim() === "") throw new Error("yzj_im_group_rename: name must not be blank");
			return runValue(ctx, budget, "im group rename", [
				"im",
				"group",
				"rename",
				"--group-id",
				args.groupId,
				"--name",
				args.name
			], (json) => ({
				content: `renamed group (${args.groupId}) → "${args.name}"`,
				data: {
					payload: clipJson(json, { maxChars: budget.maxMetaChars }),
					groupId: args.groupId,
					name: args.name
				}
			}));
		}
	}));
}
/**
* File-domain tools: upload local files to the Yunzhijia file service
* (returns fileIds usable for IM messages and rich-text images) and download
* files by fileId. Uploads land on the server immediately; overwriting
* downloads are gated by the approval guard.
*/
/** Register the file-domain tools. */
function applyFileTools(ctx, budget) {
	ctx.tools.register(defineTool({
		name: "yzj_file_upload",
		description: "Upload local file(s) to the Yunzhijia file service (single file ≤ 30MB; up to 5 concurrent). Returns fileIds usable for IM file messages and rich-text images. Uploads are immediate — requires user confirmation.",
		parameters: {
			files: {
				type: "array",
				required: true,
				items: { type: "string" },
				description: "Local file paths; multiple files are allowed (name flag then is rejected)."
			},
			name: {
				type: "string",
				description: "Uploaded file name; single file only."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => false,
		async execute(args) {
			if (args.files.length === 0) throw new Error("yzj_file_upload: at least one file path is required");
			if (args.name !== void 0 && args.files.length > 1) throw new Error("yzj_file_upload: --name is only allowed for a single file");
			const command = ["file", "upload"];
			for (const file of args.files) command.push("--file", file);
			if (args.name !== void 0) command.push("--name", args.name);
			return runValue(ctx, budget, "file upload", command, (json) => {
				const payload = cliObject(json);
				const fileId = asString(payload.fileId ?? payload.file_id ?? payload.id);
				return {
					content: fileId === "" ? `uploaded ${args.files.length} file(s)` : `uploaded ${args.files[0]} → fileId ${fileId}`,
					data: {
						payload: clipJson(payload, { maxChars: budget.maxMetaChars }),
						fileId
					}
				};
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_file_download",
		description: "Download a file by fileId to the local machine. fileId comes from yzj_file_upload or a file message param.file_id (list/summon-window `fileId=`), never from an IM msgId. Output may be a directory or file path; without --output the name comes from the server. Without --overwrite an existing file is auto-renamed (report.pdf → report (1).pdf).",
		parameters: {
			id: {
				type: "string",
				required: true,
				description: "Yunzhijia file service id: yzj_file_upload return value or IM file message param.file_id. Not the message msgId."
			},
			output: {
				type: "string",
				description: "Output directory or file path."
			},
			overwrite: {
				type: "boolean",
				description: "Overwrite an existing file; requires user confirmation."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => false,
		async execute(args) {
			const command = [
				"file",
				"download",
				"--id",
				args.id
			];
			if (args.output !== void 0) command.push("--output", args.output);
			if (args.overwrite === true) command.push("--overwrite");
			return runValue(ctx, budget, "file download", command, () => ({
				content: `downloaded ${args.id}${args.output === void 0 ? "" : ` → ${args.output}`}`,
				data: {
					id: args.id,
					output: args.output ?? "",
					overwrite: args.overwrite === true
				}
			}));
		}
	}));
}
/**
* Durable bound-session message log (docs/spec/dsh-home-transcript.md).
* ① inbound / ② DSH-send live here — never as harness Session.append events.
* The fused VIEW merges this log with official session events by timestamp.
* @module @dsh-yzj/tool-yzj/bound-log
*/
/** Default caps from the transcript spec. */
const DEFAULT_BOUND_LOG_LIMITS = {
	backfillLimit: 50,
	summonWindowMessages: 20,
	summonWindowChars: 4e3,
	logRetention: 500
};
const entrySchema = z$1.object({
	msgId: z$1.string().min(1),
	sentAt: z$1.number(),
	fromOpenId: z$1.string(),
	fromName: z$1.string(),
	content: z$1.string(),
	msgType: z$1.enum([
		"text",
		"richText",
		"file",
		"other"
	]),
	origin: z$1.enum([
		"inbound",
		"dsh-send",
		"backfill",
		"robot-outbound"
	]),
	isSelf: z$1.boolean(),
	replyMsgId: z$1.string().optional(),
	topicSessionId: z$1.string().optional(),
	param: z$1.record(z$1.string(), z$1.unknown()).optional(),
	status: z$1.enum([
		"pending",
		"acked",
		"failed"
	])
});
const logSchema = z$1.object({
	yzjConversationId: z$1.string().min(1),
	dshSessionId: z$1.string().min(1),
	yzjKind: z$1.enum(["group", "dm"]),
	updatedAt: z$1.number(),
	entries: z$1.array(entrySchema)
});
/** Durable domain: one log per Yunzhijia conversation id. */
const yzjHomeLogDomainSpec = defineDomain({
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
function paramMissing(entry) {
	return entry.param === void 0 || Object.keys(entry.param).length === 0;
}
function firstNonEmpty(...values) {
	for (const value of values) if (typeof value === "string" && value !== "") return value;
	return "";
}
function withParam(hit, incoming) {
	if (incoming.param === void 0) return hit;
	if (!paramMissing(hit) && JSON.stringify(hit.param).length >= JSON.stringify(incoming.param).length) return hit;
	return {
		...hit,
		param: incoming.param,
		msgType: hit.msgType === "text" && incoming.msgType !== "text" ? incoming.msgType : hit.msgType
	};
}
/** Fill empty identity on a collision without changing origin. */
function withIdentity(hit, incoming) {
	const fromOpenId = hit.fromOpenId === "" ? incoming.fromOpenId : hit.fromOpenId;
	const fromName = hit.fromName === "" ? incoming.fromName : hit.fromName;
	if (fromOpenId === hit.fromOpenId && fromName === hit.fromName) return hit;
	return {
		...hit,
		fromOpenId,
		fromName
	};
}
function enrichHit(hit, incoming) {
	return withIdentity(withParam(hit, incoming), incoming);
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
	const fromOpenId = firstNonEmpty(row.fromOpenId, row.openId, fromUser.openId, fromUser.oId);
	const fromName = firstNonEmpty(row.fromName, fromUser.name, fromUser.userName, fromUser.nickName, row.userName);
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
	const payload = unwrapCli(json);
	if (Array.isArray(payload)) return payload;
	if (typeof payload !== "object" || payload === null) return [];
	const record = payload;
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
	const payload = unwrapCli(json);
	if (typeof payload !== "object" || payload === null) return void 0;
	const record = payload;
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
function sameSpeakerAndBody(a, b) {
	return a.fromOpenId === b.fromOpenId && a.content === b.content;
}
/** Origins that win T8 collisions (user DSH-send and assistant posts). */
function isStickyOrigin(origin) {
	return origin === "dsh-send" || origin === "robot-outbound";
}
/** One assistant post into the group-room log (R9). */
function robotOutboundEntry(input) {
	return {
		msgId: input.msgId,
		sentAt: input.sentAt ?? Date.now(),
		fromOpenId: input.fromOpenId,
		fromName: input.fromName !== void 0 && input.fromName !== "" ? input.fromName : "助手",
		content: input.content,
		msgType: "text",
		origin: "robot-outbound",
		isSelf: false,
		status: "acked",
		...input.replyMsgId === void 0 || input.replyMsgId === "" ? {} : { replyMsgId: input.replyMsgId },
		...input.topicSessionId === void 0 || input.topicSessionId === "" ? {} : { topicSessionId: input.topicSessionId }
	};
}
function sortEntries(entries) {
	return [...entries].sort((left, right) => {
		if (left.sentAt !== right.sentAt) return left.sentAt - right.sentAt;
		return left.msgId.localeCompare(right.msgId);
	});
}
function trimRetention(entries, retention) {
	if (entries.length <= retention) return entries;
	return entries.slice(entries.length - retention);
}
/**
* Apply T7/T8/T12 collision rules. Pure: returns the next entries array.
*/
function applyAppend(existing, incoming, options = {}) {
	if (options.skipOpenIds !== void 0 && options.skipOpenIds.includes(incoming.fromOpenId)) return {
		entries: [...existing],
		result: {
			accepted: false,
			reason: "robot-skipped"
		}
	};
	const byId = new Map(existing.map((entry) => [entry.msgId, entry]));
	const hit = byId.get(incoming.msgId);
	if (hit !== void 0) {
		if (isStickyOrigin(hit.origin) && !isStickyOrigin(incoming.origin)) {
			const enriched = enrichHit(hit, incoming);
			if (enriched !== hit) {
				byId.set(hit.msgId, enriched);
				return {
					entries: sortEntries([...byId.values()]),
					result: {
						accepted: true,
						reason: "enriched",
						entry: enriched
					}
				};
			}
			return {
				entries: [...existing],
				result: {
					accepted: false,
					reason: "echo-collapsed",
					entry: hit
				}
			};
		}
		if (!isStickyOrigin(hit.origin) && incoming.origin === "dsh-send" && sameSpeakerAndBody(hit, incoming)) {
			const promoted = {
				...enrichHit(hit, incoming),
				origin: "dsh-send",
				isSelf: true,
				status: "acked"
			};
			byId.set(hit.msgId, promoted);
			return {
				entries: sortEntries([...byId.values()]),
				result: {
					accepted: true,
					reason: "promoted-to-dsh-send",
					entry: promoted
				}
			};
		}
		if (!isStickyOrigin(hit.origin) && incoming.origin === "robot-outbound") {
			const filled = withIdentity(hit, incoming);
			const promoted = {
				...filled,
				origin: "robot-outbound",
				isSelf: false,
				fromName: incoming.fromName === "" ? filled.fromName : incoming.fromName,
				status: "acked",
				...incoming.topicSessionId === void 0 ? {} : { topicSessionId: incoming.topicSessionId }
			};
			byId.set(hit.msgId, promoted);
			return {
				entries: sortEntries([...byId.values()]),
				result: {
					accepted: true,
					reason: "promoted-to-robot-outbound",
					entry: promoted
				}
			};
		}
		if (!isStickyOrigin(hit.origin) && incoming.origin === "dsh-send") return {
			entries: [...existing],
			result: {
				accepted: false,
				reason: "anomaly-kept",
				entry: hit
			}
		};
		const enriched = enrichHit(hit, incoming);
		if (enriched !== hit) {
			byId.set(hit.msgId, enriched);
			return {
				entries: sortEntries([...byId.values()]),
				result: {
					accepted: true,
					reason: "enriched",
					entry: enriched
				}
			};
		}
		return {
			entries: [...existing],
			result: {
				accepted: false,
				reason: "duplicate",
				entry: hit
			}
		};
	}
	return {
		entries: sortEntries([...existing, incoming]),
		result: {
			accepted: true,
			reason: "appended",
			entry: incoming
		}
	};
}
/**
* Rewrite an optimistic `local-*` row to the real msgId after CLI ack (T8).
* If the real id already exists, collapse the local row (echo).
*/
function ackLocalEntry(existing, localId, realMsgId) {
	const local = existing.find((entry) => entry.msgId === localId);
	if (local === void 0) return [...existing];
	const withoutLocal = existing.filter((entry) => entry.msgId !== localId);
	const collision = withoutLocal.find((entry) => entry.msgId === realMsgId);
	if (collision !== void 0) {
		const promoted = collision.origin === "dsh-send" ? {
			...collision,
			status: "acked"
		} : {
			...collision,
			origin: "dsh-send",
			isSelf: true,
			status: "acked"
		};
		return sortEntries(withoutLocal.map((entry) => entry.msgId === realMsgId ? promoted : entry));
	}
	return sortEntries([...withoutLocal, {
		...local,
		msgId: realMsgId,
		status: "acked"
	}]);
}
/** Mark an optimistic ② row failed (keep the bubble; do not roll into ③). */
function failLocalEntry(existing, localId) {
	return existing.map((entry) => entry.msgId === localId ? {
		...entry,
		status: "failed"
	} : entry);
}
/**
* Reply-chain around a topic anchor: walk parents via replyMsgId, then
* descendants that reply into that set. Empty when the root is not in the log.
*/
function threadEntries(entries, rootMsgId) {
	const byId = new Map(entries.map((entry) => [entry.msgId, entry]));
	if (!byId.has(rootMsgId)) return [];
	const keep = /* @__PURE__ */ new Set();
	let cursor = rootMsgId;
	while (cursor !== void 0 && !keep.has(cursor)) {
		keep.add(cursor);
		cursor = byId.get(cursor)?.replyMsgId;
	}
	let grew = true;
	while (grew) {
		grew = false;
		for (const entry of entries) {
			const reply = entry.replyMsgId;
			if (reply !== void 0 && keep.has(reply) && !keep.has(entry.msgId)) {
				keep.add(entry.msgId);
				grew = true;
			}
		}
	}
	return entries.filter((entry) => keep.has(entry.msgId));
}
/**
* Summon-window digest (spec §5.2). Both summon paths MUST call this.
* Empty log with no groupId → '' (do not inject an empty block).
* groupId / per-line msgId are required so the model can send or reply.
* Topics with a root prefer the reply chain; missing root falls back to the
* group near-window.
*/
function formatSummonWindow(log, options) {
	const groupId = options.groupId ?? log?.yzjConversationId ?? "";
	const root = options.topic?.rootMsgId?.trim() ?? "";
	const thread = root === "" ? [] : threadEntries(log?.entries ?? [], root);
	const window = (thread.length > 0 ? thread : log?.entries ?? []).filter((entry) => {
		if (entry.status !== "acked") return false;
		if (options.excludeMsgId !== void 0 && entry.msgId === options.excludeMsgId) return false;
		return true;
	}).slice(-Math.max(0, options.maxMessages));
	const lines = [];
	let chars = 0;
	for (let index = window.length - 1; index >= 0; index -= 1) {
		const entry = window[index];
		if (entry === void 0) continue;
		const when = formatWindowTime(entry.sentAt);
		const who = entry.isSelf ? "我" : entry.fromName === "" ? entry.fromOpenId : entry.fromName;
		const replyId = entry.replyMsgId;
		const replyDigest = replyId === void 0 ? "" : shortReply(log, replyId);
		const reply = replyId === void 0 ? "" : ` 回复 msgId=${replyId}${replyDigest === "" ? "" : ` ${replyDigest}`}`;
		const line = `[${when}] ${who} msgId=${entry.msgId}: ${entry.content}${fileIdMark(entry.param)}${reply}`;
		if (chars + line.length + 1 > options.maxChars && lines.length > 0) break;
		lines.unshift(line);
		chars += line.length + 1;
	}
	const meta = ["［本群最近消息（仅本轮上下文，非完整群档）］"];
	if (groupId !== "") {
		meta.push(`groupId: ${groupId}`);
		meta.push("发群用 yzj_im_message_send 的 groupId；回复某条把 replyMsgId 设成该行 msgId。");
	}
	const topic = options.topic;
	if (topic !== void 0) {
		const title = topic.title?.trim() ?? "";
		if (title !== "") meta.push(`话题: ${title}`);
		const root = topic.rootMsgId?.trim() ?? "";
		if (root !== "") meta.push(`锚点 msgId: ${root}`);
		const excerpt = (topic.originText ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
		if (excerpt !== "") {
			const who = (topic.originWho ?? "").trim();
			const rootEntry = root === "" ? void 0 : log?.entries.find((entry) => entry.msgId === root);
			meta.push(`锚：${who === "" ? "" : `${who}：`}${excerpt}${fileIdMark(rootEntry?.param)}`);
		}
	}
	if (lines.length === 0 && groupId === "" && topic === void 0) return "";
	if (lines.length === 0) return meta.join("\n");
	return `${meta.join("\n")}\n${lines.join("\n")}`;
}
function formatWindowTime(sentAt) {
	const date = new Date(sentAt);
	const pad = (n) => String(n).padStart(2, "0");
	return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function shortReply(log, replyMsgId) {
	const hit = log?.entries.find((entry) => entry.msgId === replyMsgId);
	if (hit === void 0) return "";
	return hit.content.replace(/\s+/g, " ").trim().slice(0, 24);
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
/** Durable store: one log per yzjConversationId, memory-fallback until open(). */
var BoundLogStore = class {
	logs;
	memory = /* @__PURE__ */ new Map();
	limits = DEFAULT_BOUND_LOG_LIMITS;
	/** Apply Config caps (schema fields, not constants). */
	setLimits(limits) {
		this.limits = {
			...this.limits,
			...limits
		};
	}
	/** Current caps. */
	getLimits() {
		return this.limits;
	}
	/** Open (or adopt) the domain; safe to await repeatedly. */
	async open(facility) {
		if (this.logs !== void 0) return;
		const domain = await facility.open(yzjHomeLogDomainSpec);
		this.logs = domain.table("logs");
		for (const [key, value] of this.memory) if (this.logs.get(key) === void 0) await this.logs.put(key, value);
		this.memory.clear();
	}
	/** Close the domain (idempotent). */
	async close() {
		this.logs = void 0;
	}
	/** Log for one Yunzhijia conversation, or undefined. */
	get(yzjConversationId) {
		return this.logs?.get(yzjConversationId) ?? this.memory.get(yzjConversationId);
	}
	/** Ensure a header exists (binding table is authority for dshSessionId). */
	async ensureHeader(yzjConversationId, dshSessionId, yzjKind) {
		const existing = this.get(yzjConversationId);
		if (existing !== void 0) {
			if (existing.dshSessionId === dshSessionId && existing.yzjKind === yzjKind) return existing;
			const synced = {
				...existing,
				dshSessionId,
				yzjKind,
				updatedAt: Date.now()
			};
			await this.put(synced);
			return synced;
		}
		const created = {
			yzjConversationId,
			dshSessionId,
			yzjKind,
			updatedAt: Date.now(),
			entries: []
		};
		await this.put(created);
		return created;
	}
	/** Append one row with T8 collision rules. */
	async append(yzjConversationId, dshSessionId, yzjKind, incoming, options = {}) {
		const header = await this.ensureHeader(yzjConversationId, dshSessionId, yzjKind);
		const { entries, result } = applyAppend(header.entries, incoming, options);
		if (!result.accepted && result.reason !== "promoted-to-dsh-send" && result.reason !== "promoted-to-robot-outbound") return result;
		const next = {
			...header,
			updatedAt: Date.now(),
			entries: trimRetention(entries, this.limits.logRetention)
		};
		await this.put(next);
		return result;
	}
	/** Rewrite local-* → real msgId after CLI ack. */
	async ackLocal(yzjConversationId, localId, realMsgId) {
		const header = this.get(yzjConversationId);
		if (header === void 0) return void 0;
		const next = {
			...header,
			updatedAt: Date.now(),
			entries: ackLocalEntry(header.entries, localId, realMsgId)
		};
		await this.put(next);
		return next;
	}
	/** Mark local-* failed. */
	async failLocal(yzjConversationId, localId) {
		const header = this.get(yzjConversationId);
		if (header === void 0) return void 0;
		const next = {
			...header,
			updatedAt: Date.now(),
			entries: failLocalEntry(header.entries, localId)
		};
		await this.put(next);
		return next;
	}
	async put(log) {
		if (this.logs !== void 0) {
			await this.logs.put(log.yzjConversationId, log);
			return;
		}
		this.memory.set(log.yzjConversationId, log);
	}
};
/**
* Topic-session index: one Yunzhijia group room hosts 0..N agent topics
* (docs/spec/group-room-topics.md R1/R4). Anchor key is
* `(yzjConversationId, rootMsgId)`; outbound robot posts register so a
* reply chain continues the same topic.
* @module @dsh-yzj/tool-yzj/topics
*/
/** Lifecycle for L2 badges: missing (pre-P3) rows count as running. */
function topicStatusOf(record) {
	const value = typeof record === "string" || record === void 0 ? record : record.status;
	return value === "confirm" || value === "done" ? value : "running";
}
const topicSchema = z$1.object({
	dshSessionId: z$1.string().min(1),
	yzjConversationId: z$1.string().min(1),
	title: z$1.string(),
	source: z$1.enum([
		"dsh",
		"yzj",
		"handoff"
	]),
	createdAt: z$1.number(),
	lastActivity: z$1.number().optional(),
	status: z$1.enum([
		"running",
		"confirm",
		"done"
	]).optional(),
	rootMsgId: z$1.string().optional(),
	originWho: z$1.string().optional(),
	originText: z$1.string().optional(),
	originTime: z$1.number().optional()
});
const sessionIndexSchema$1 = z$1.object({ yzjConversationId: z$1.string().min(1) });
const groupIndexSchema = z$1.object({ ids: z$1.array(z$1.string()) });
/** Durable domain: topics, reverse session index, outbound msgId → topic. */
const yzjTopicDomainSpec = defineDomain({
	name: "yzj_topic_anchors",
	version: 0,
	tables: {
		topics: domainTable(topicSchema),
		sessions: domainTable(sessionIndexSchema$1),
		outbound: domainTable(z$1.object({ dshSessionId: z$1.string().min(1) })),
		groups: domainTable(groupIndexSchema),
		anchors: domainTable(z$1.object({ dshSessionId: z$1.string().min(1) }))
	}
});
function slug(value, max) {
	const cleaned = value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
	return cleaned === "" ? "x" : cleaned.slice(0, max);
}
/** Product id for one topic. Stable when `rootMsgId` is present. */
function topicSessionId(yzjConversationId, rootMsgId) {
	const group = slug(yzjConversationId, 40);
	if (rootMsgId !== void 0 && rootMsgId !== "") return `yzj-topic-${group}-${slug(rootMsgId, 24)}`;
	return `yzj-topic-${group}-${Date.now().toString(36)}`;
}
/** Anchor table key: conversation + root message. */
function topicAnchorKey(yzjConversationId, rootMsgId) {
	return `${yzjConversationId}\t${rootMsgId}`;
}
function defaultTitle(input) {
	if (input.title !== void 0 && input.title.trim() !== "") return input.title.trim().slice(0, 40);
	const excerpt = (input.originText ?? "").replace(/\s+/g, " ").trim();
	if (excerpt !== "") return excerpt.slice(0, 24);
	return "新话题";
}
/** Read/write face over the opened domain; inert (memory-only) until `open()`. */
var TopicAnchorStore = class {
	topics;
	sessions;
	outbound;
	groups;
	anchors;
	memoryTopics = /* @__PURE__ */ new Map();
	memorySess = /* @__PURE__ */ new Map();
	memoryOutbound = /* @__PURE__ */ new Map();
	memoryGroups = /* @__PURE__ */ new Map();
	memoryAnchors = /* @__PURE__ */ new Map();
	/** Open (or adopt) the domain; safe to await repeatedly. */
	async open(facility) {
		if (this.topics !== void 0) return;
		const domain = await facility.open(yzjTopicDomainSpec);
		this.topics = domain.table("topics");
		this.sessions = domain.table("sessions");
		this.outbound = domain.table("outbound");
		this.groups = domain.table("groups");
		this.anchors = domain.table("anchors");
		for (const [key, value] of this.memoryTopics) if (this.topics.get(key) === void 0) {
			await this.topics.put(key, value);
			await this.sessions.put(value.dshSessionId, { yzjConversationId: value.yzjConversationId });
		}
		for (const [msgId, sessionId] of this.memoryOutbound) if (this.outbound.get(msgId) === void 0) await this.outbound.put(msgId, { dshSessionId: sessionId });
		for (const [groupId, ids] of this.memoryGroups) if (this.groups.get(groupId) === void 0) await this.groups.put(groupId, { ids });
		for (const [key, sessionId] of this.memoryAnchors) if (this.anchors.get(key) === void 0) await this.anchors.put(key, { dshSessionId: sessionId });
		this.memoryTopics.clear();
		this.memorySess.clear();
		this.memoryOutbound.clear();
		this.memoryGroups.clear();
		this.memoryAnchors.clear();
	}
	/** Close the domain (idempotent). */
	async close() {
		this.topics = void 0;
		this.sessions = void 0;
		this.outbound = void 0;
		this.groups = void 0;
		this.anchors = void 0;
	}
	/** Topic for one DSH session, or undefined. */
	getBySession(dshSessionId) {
		if (this.topics !== void 0) return this.topics.get(dshSessionId);
		return this.memoryTopics.get(dshSessionId);
	}
	/** Topic anchored on one inbound root message, or undefined. */
	getByAnchor(yzjConversationId, rootMsgId) {
		const sessionId = this.sessionIdOfAnchor(yzjConversationId, rootMsgId);
		if (sessionId === void 0) return void 0;
		return this.getBySession(sessionId);
	}
	/** Topic that posted this outbound robot msgId, or undefined. */
	getByOutbound(msgId) {
		const sessionId = this.outbound?.get(msgId)?.dshSessionId ?? this.memoryOutbound.get(msgId);
		if (sessionId === void 0) return void 0;
		return this.getBySession(sessionId);
	}
	/** Every topic of one group, newest last. */
	listByConversation(yzjConversationId) {
		const ids = this.groups?.get(yzjConversationId)?.ids ?? this.memoryGroups.get(yzjConversationId) ?? [];
		const rows = [];
		for (const id of ids) {
			const row = this.getBySession(id);
			if (row !== void 0) rows.push(row);
		}
		return rows;
	}
	/**
	* Return the existing topic for this root, or allocate one.
	* Same `(conversation, rootMsgId)` is always focus (`created: false`).
	*/
	async ensureTopic(input) {
		if (input.rootMsgId !== void 0 && input.rootMsgId !== "") {
			const existing = this.getByAnchor(input.yzjConversationId, input.rootMsgId);
			if (existing !== void 0) {
				const touched = {
					...existing,
					lastActivity: Date.now()
				};
				await this.putTopic(touched);
				return {
					sessionId: touched.dshSessionId,
					created: false,
					record: touched
				};
			}
		}
		let sessionId = topicSessionId(input.yzjConversationId, input.rootMsgId);
		let suffix = 2;
		while (this.getBySession(sessionId) !== void 0) {
			sessionId = `${topicSessionId(input.yzjConversationId, input.rootMsgId)}-${suffix}`;
			suffix += 1;
		}
		const now = Date.now();
		const record = {
			dshSessionId: sessionId,
			yzjConversationId: input.yzjConversationId,
			title: defaultTitle(input),
			source: input.source,
			createdAt: now,
			lastActivity: now,
			status: "running",
			...input.rootMsgId === void 0 || input.rootMsgId === "" ? {} : { rootMsgId: input.rootMsgId },
			...input.originWho === void 0 ? {} : { originWho: input.originWho },
			...input.originText === void 0 ? {} : { originText: input.originText },
			...input.originTime === void 0 ? {} : { originTime: input.originTime }
		};
		await this.putTopic(record);
		return {
			sessionId,
			created: true,
			record
		};
	}
	/** Register a robot outbound post so reply chains continue this topic. */
	async registerOutbound(msgId, dshSessionId) {
		if (this.outbound !== void 0) {
			await this.outbound.put(msgId, { dshSessionId });
			return;
		}
		this.memoryOutbound.set(msgId, dshSessionId);
	}
	/**
	* Set lifecycle status (P3 / L2 / L5). No-op when the session is not a
	* topic or the value is unchanged.
	*/
	async setStatus(sessionId, status) {
		const existing = this.getBySession(sessionId);
		if (existing === void 0 || topicStatusOf(existing) === status) return;
		await this.putTopic({
			...existing,
			status,
			lastActivity: Date.now()
		});
	}
	/**
	* Move an anchor from an optimistic `local-*` id to the real Yunzhijia
	* msgId after CLI ack. Session id stays put. No-op when the old root has
	* no topic or the ids match.
	*/
	async retargetAnchor(yzjConversationId, fromMsgId, toMsgId) {
		if (fromMsgId === toMsgId || fromMsgId === "" || toMsgId === "") return;
		const existing = this.getByAnchor(yzjConversationId, fromMsgId);
		if (existing === void 0) return;
		const already = this.getByAnchor(yzjConversationId, toMsgId);
		if (already !== void 0 && already.dshSessionId !== existing.dshSessionId) return;
		const next = {
			...existing,
			rootMsgId: toMsgId
		};
		const oldKey = topicAnchorKey(yzjConversationId, fromMsgId);
		if (this.anchors !== void 0) await this.anchors.delete(oldKey);
		else this.memoryAnchors.delete(oldKey);
		await this.putTopic(next);
	}
	sessionIdOfAnchor(yzjConversationId, rootMsgId) {
		const key = topicAnchorKey(yzjConversationId, rootMsgId);
		return this.anchors?.get(key)?.dshSessionId ?? this.memoryAnchors.get(key);
	}
	async putTopic(record) {
		const anchorKey = record.rootMsgId === void 0 || record.rootMsgId === "" ? void 0 : topicAnchorKey(record.yzjConversationId, record.rootMsgId);
		if (this.topics !== void 0 && this.sessions !== void 0 && this.groups !== void 0) {
			await this.topics.put(record.dshSessionId, record);
			await this.sessions.put(record.dshSessionId, { yzjConversationId: record.yzjConversationId });
			const current = this.groups.get(record.yzjConversationId)?.ids ?? [];
			if (!current.includes(record.dshSessionId)) await this.groups.put(record.yzjConversationId, { ids: [...current, record.dshSessionId] });
			if (anchorKey !== void 0 && this.anchors !== void 0) await this.anchors.put(anchorKey, { dshSessionId: record.dshSessionId });
			return;
		}
		this.memoryTopics.set(record.dshSessionId, record);
		this.memorySess.set(record.dshSessionId, record.yzjConversationId);
		const ids = this.memoryGroups.get(record.yzjConversationId) ?? [];
		if (!ids.includes(record.dshSessionId)) this.memoryGroups.set(record.yzjConversationId, [...ids, record.dshSessionId]);
		if (anchorKey !== void 0) this.memoryAnchors.set(anchorKey, record.dshSessionId);
	}
};
/**
* Durable group-room binding plus topic index. One Yunzhijia conversation
* maps to one group-room host session (`yzj-home-*`) and 0..N topic sessions
* (`yzj-topic-*`). Shared by robot inbound and the panel pick-group path
* (docs/spec/group-room-topics.md).
* @module @dsh-yzj/tool-yzj/home
*/
const bindingSchema = z$1.object({
	dshSessionId: z$1.string().min(1),
	yzjConversationId: z$1.string().min(1),
	yzjKind: z$1.enum(["group", "dm"])
});
const sessionIndexSchema = z$1.object({ yzjConversationId: z$1.string().min(1) });
/** Durable domain: conversation → session and the reverse index. */
const yzjHomeDomainSpec = defineDomain({
	name: "yzj_home_bindings",
	version: 0,
	tables: {
		conversations: domainTable(bindingSchema),
		sessions: domainTable(sessionIndexSchema)
	}
});
/**
* Stable group-room host session id for one Yunzhijia conversation.
* Agent work lives on `yzj-topic-*` ids (see {@link topicSessionId}).
*/
function homeSessionId(yzjConversationId) {
	const cleaned = yzjConversationId.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
	return `yzj-home-${cleaned === "" ? "x" : cleaned.slice(0, 80)}`;
}
/** DM surfaces in the CLI/robot id space carry a BOT- prefix (measured). */
function conversationKindOf(yzjConversationId) {
	return yzjConversationId.startsWith("BOT-") ? "dm" : "group";
}
/** Read/write face over the opened domain; inert (memory-only) until `open()`. */
var HomeBindingStore = class {
	conversations;
	sessions;
	/** Fallback until the storage hub is ready — also the test double's backing. */
	memoryConv = /* @__PURE__ */ new Map();
	memorySess = /* @__PURE__ */ new Map();
	/**
	* Open (or adopt) the domain; safe to await repeatedly.
	* @param facility - the `ctx.storageDomain` facility.
	*/
	async open(facility) {
		if (this.conversations !== void 0) return;
		const domain = await facility.open(yzjHomeDomainSpec);
		this.conversations = domain.table("conversations");
		this.sessions = domain.table("sessions");
		for (const [key, value] of this.memoryConv) if (this.conversations.get(key) === void 0) {
			await this.conversations.put(key, value);
			await this.sessions.put(value.dshSessionId, { yzjConversationId: key });
		}
		this.memoryConv.clear();
		this.memorySess.clear();
	}
	/** Close the domain (idempotent). */
	async close() {
		this.conversations = void 0;
		this.sessions = void 0;
	}
	/** Binding for one Yunzhijia conversation, or undefined. */
	getByConversation(yzjConversationId) {
		return this.conversations?.get(yzjConversationId) ?? this.memoryConv.get(yzjConversationId);
	}
	/** Binding for one DSH session, or undefined. */
	getBySession(dshSessionId) {
		const conversationId = this.sessions?.get(dshSessionId)?.yzjConversationId ?? this.memorySess.get(dshSessionId);
		if (conversationId === void 0) return void 0;
		return this.getByConversation(conversationId);
	}
	/** Every persisted binding row (group rooms and bound DMs). */
	listBindings() {
		if (this.conversations !== void 0) return [...this.conversations.entries()].map(([, record]) => record);
		return [...this.memoryConv.values()];
	}
	/**
	* Return the existing bound session, or allocate and persist one.
	* A second call for the same conversation is focus (created=false), never
	* a parallel row.
	*/
	async ensureBound(yzjConversationId, yzjKind) {
		const existing = this.getByConversation(yzjConversationId);
		if (existing !== void 0) return {
			sessionId: existing.dshSessionId,
			created: false,
			yzjKind: existing.yzjKind
		};
		let sessionId = homeSessionId(yzjConversationId);
		let suffix = 2;
		while (this.getBySession(sessionId) !== void 0) {
			sessionId = `${homeSessionId(yzjConversationId)}-${suffix}`;
			suffix += 1;
		}
		const record = {
			dshSessionId: sessionId,
			yzjConversationId,
			yzjKind
		};
		await this.put(record);
		return {
			sessionId,
			created: true,
			yzjKind
		};
	}
	/** Persist one 1:1 row (both directions). */
	async put(record) {
		if (this.conversations !== void 0 && this.sessions !== void 0) {
			await this.conversations.put(record.yzjConversationId, record);
			await this.sessions.put(record.dshSessionId, { yzjConversationId: record.yzjConversationId });
			return;
		}
		this.memoryConv.set(record.yzjConversationId, record);
		this.memorySess.set(record.dshSessionId, record.yzjConversationId);
	}
};
/** Cordis service wrapping {@link HomeBindingStore} as `ctx.yzjHome`. */
var YzjHomeService = class extends Service {
	store = new HomeBindingStore();
	logs = new BoundLogStore();
	topics = new TopicAnchorStore();
	constructor(ctx, limits) {
		super(ctx, "yzjHome");
		if (limits !== void 0) this.logs.setLimits(limits);
	}
	/** Open the durable table once the storage hub has the domain form. */
	async openNow() {
		const facility = this.ctx.get("storageDomain");
		if (facility === void 0) return;
		try {
			await this.store.open(facility);
		} catch (error) {
			this.ctx.logger.warn(`yzjHome: binding store failed to open: ${String(error)}`);
		}
		try {
			await this.logs.open(facility);
		} catch (error) {
			this.ctx.logger.warn(`yzjHome: bound-log store failed to open: ${String(error)}`);
		}
		try {
			await this.topics.open(facility);
		} catch (error) {
			this.ctx.logger.warn(`yzjHome: topic store failed to open: ${String(error)}`);
		}
	}
	/** @see HomeBindingStore.ensureBound */
	async ensureBound(yzjConversationId, yzjKind) {
		const result = await this.store.ensureBound(yzjConversationId, yzjKind);
		await this.logs.ensureHeader(yzjConversationId, result.sessionId, result.yzjKind);
		return result;
	}
	/** @see HomeBindingStore.getByConversation */
	getByConversation(yzjConversationId) {
		return this.store.getByConversation(yzjConversationId);
	}
	/** @see HomeBindingStore.getBySession */
	getBySession(dshSessionId) {
		return this.store.getBySession(dshSessionId);
	}
	/** @see HomeBindingStore.listBindings */
	listBindings() {
		return this.store.listBindings();
	}
	/** Append one ①/②/backfill row; no-ops without a binding. */
	async appendLog(yzjConversationId, incoming, options = {}) {
		const binding = this.getByConversation(yzjConversationId);
		if (binding === void 0) return {
			accepted: false,
			reason: "unbound"
		};
		return this.logs.append(yzjConversationId, binding.dshSessionId, binding.yzjKind, incoming, options);
	}
	/** Log for one conversation. */
	getLog(yzjConversationId) {
		return this.logs.get(yzjConversationId);
	}
	/** Log for the conversation bound to this DSH session (room or topic). */
	getLogBySession(dshSessionId) {
		const binding = this.getBySession(dshSessionId);
		if (binding !== void 0) return this.logs.get(binding.yzjConversationId);
		const topic = this.topics.getBySession(dshSessionId);
		if (topic === void 0) return void 0;
		return this.logs.get(topic.yzjConversationId);
	}
	/** @see BoundLogStore.ackLocal — also retargets topic anchors off local-* ids. */
	async ackLocal(yzjConversationId, localId, realMsgId) {
		const log = await this.logs.ackLocal(yzjConversationId, localId, realMsgId);
		if (localId !== realMsgId) await this.topics.retargetAnchor(yzjConversationId, localId, realMsgId);
		return log;
	}
	/** @see BoundLogStore.failLocal */
	failLocal(yzjConversationId, localId) {
		return this.logs.failLocal(yzjConversationId, localId);
	}
	/** Shared summon-window digest (robot inject + DSH systemPrompt). */
	formatSummonWindow(yzjConversationId, excludeMsgId, sessionId) {
		const limits = this.logs.getLimits();
		const topic = sessionId === void 0 ? void 0 : this.topics.getBySession(sessionId);
		return formatSummonWindow(this.logs.get(yzjConversationId), {
			maxMessages: limits.summonWindowMessages,
			maxChars: limits.summonWindowChars,
			groupId: yzjConversationId,
			...excludeMsgId === void 0 ? {} : { excludeMsgId },
			...topic === void 0 ? {} : { topic: {
				...topic.title.trim() === "" ? {} : { title: topic.title },
				...topic.rootMsgId === void 0 ? {} : { rootMsgId: topic.rootMsgId },
				...topic.originWho === void 0 ? {} : { originWho: topic.originWho },
				...topic.originText === void 0 ? {} : { originText: topic.originText }
			} }
		});
	}
	/** Mint or focus a topic under this group room. Ensures the room row exists. */
	async ensureTopic(input) {
		const kind = conversationKindOf(input.yzjConversationId);
		await this.ensureBound(input.yzjConversationId, kind);
		return this.topics.ensureTopic(input);
	}
	/** Topic for one DSH session. */
	getTopicBySession(dshSessionId) {
		return this.topics.getBySession(dshSessionId);
	}
	/** Topic anchored on one inbound root. */
	getTopicByAnchor(yzjConversationId, rootMsgId) {
		return this.topics.getByAnchor(yzjConversationId, rootMsgId);
	}
	/** Topic that posted this outbound robot message. */
	getTopicByOutbound(msgId) {
		return this.topics.getByOutbound(msgId);
	}
	/** Every topic of one group. */
	listTopics(yzjConversationId) {
		return this.topics.listByConversation(yzjConversationId);
	}
	/** Register a robot outbound post onto a topic. */
	registerTopicOutbound(msgId, dshSessionId) {
		return this.topics.registerOutbound(msgId, dshSessionId);
	}
	/** P3 / L2 / L5: pending write → confirm; delivery or cancel → running. */
	setTopicStatus(dshSessionId, status) {
		return this.topics.setStatus(dshSessionId, status);
	}
};
/**
* Approval guard for yzj write operations, gated by a risk-level table
* (design v1.6 §5.1/§5.5): read-only tools pass through, standard-level
* writes confirm, strong-level writes (deletion, irreversible) confirm with
* the strong flag and never merge into batch confirmations.
*
* Confirmation is self-hosted: the guard broadcasts `yzj/ask-pending` then
* waits on `yzj/confirm-request` (ui-yzj write-gate answers) and returns
* allow/deny. It does **not** return harness `{ kind: 'ask' }` — GUI Full
* access sets `approval: never`, which rejects an ask before
* `approval/request` runs (pitfall-036 / D9). Headless overlays without a
* write-gate fail closed (`unavailable` → deny).
*/
/** Tool name → confirmation spec for every write tool in the yzj family. */
const WRITE_SPECS = {
	yzj_doc_delete: {
		reason: "删除知识库文档节点，不可恢复",
		level: "strong"
	},
	yzj_doc_block_delete: {
		reason: "删除文档块内容，不可恢复",
		level: "strong"
	},
	yzj_sheet_table_delete: {
		reason: "删除数据表及其全部记录，不可恢复",
		level: "strong"
	},
	yzj_sheet_record_delete: {
		reason: "删除多维表格记录，不可恢复",
		level: "strong"
	},
	yzj_calendar_event_delete: {
		reason: "取消/删除日程",
		level: "strong"
	},
	yzj_im_group_members_remove: {
		reason: "移成员出群，不可恢复",
		level: "strong"
	},
	yzj_im_message_recall: {
		reason: "撤回已发出的 IM 消息，不可恢复",
		level: "strong"
	},
	yzj_im_message_send: {
		reason: "发送 IM 消息到云之家会话，发出后不可撤回",
		level: "standard"
	},
	yzj_file_upload: {
		reason: "上传文件到云之家，即刻落服务端",
		level: "standard"
	},
	yzj_file_download: {
		reason: "下载文件并覆盖本地已有文件",
		level: "standard",
		when: (args) => args.overwrite === true
	},
	yzj_doc_move: {
		reason: "移动知识库文档节点",
		level: "standard"
	},
	yzj_doc_workspace_create: {
		reason: "新建知识库",
		level: "standard"
	},
	yzj_doc_create: {
		reason: "新建知识库文档",
		level: "standard"
	},
	yzj_doc_rename: {
		reason: "重命名知识库文档",
		level: "standard"
	},
	yzj_doc_import: {
		reason: "导入文件到知识库",
		level: "standard"
	},
	yzj_doc_block_insert: {
		reason: "向文档插入内容",
		level: "standard"
	},
	yzj_doc_block_update: {
		reason: "更新文档内容",
		level: "standard"
	},
	yzj_doc_block_replace: {
		reason: "替换文档块范围（先删后插）",
		level: "standard"
	},
	yzj_doc_write: {
		reason: "覆盖/追加写整个在线文档内容",
		level: "standard"
	},
	yzj_doc_download: {
		reason: "下载文档并覆盖本地已有文件",
		level: "standard",
		when: (args) => args.overwrite === true
	},
	yzj_im_group_create: {
		reason: "创建云之家群组",
		level: "standard"
	},
	yzj_im_group_rename: {
		reason: "修改云之家群名称，影响全体成员",
		level: "standard"
	},
	yzj_im_group_members_add: {
		reason: "拉人进群",
		level: "standard"
	},
	yzj_doc_folder_create: {
		reason: "在知识库新建文件夹",
		level: "standard"
	},
	yzj_sheet_create: {
		reason: "新建多维表格",
		level: "standard"
	},
	yzj_sheet_table_create: {
		reason: "新建数据表",
		level: "standard"
	},
	yzj_sheet_table_rename: {
		reason: "重命名数据表",
		level: "standard"
	},
	yzj_sheet_record_create: {
		reason: "新增多维表格记录",
		level: "standard"
	},
	yzj_sheet_record_update: {
		reason: "更新多维表格记录",
		level: "standard"
	},
	yzj_calendar_event_create: {
		reason: "新建日程",
		level: "standard"
	},
	yzj_calendar_event_update: {
		reason: "更新日程",
		level: "standard"
	}
};
/** Structural session id on a tools/pre-execute exec (agent is present in harness). */
function callingSessionId(exec) {
	const id = exec.agent?.session?.id;
	return typeof id === "string" ? id : void 0;
}
function denyReason(toolName, outcome) {
	if (outcome === "rejected") return `用户拒绝了云之家操作「${toolName}」`;
	if (outcome === "cancelled") return `云之家操作「${toolName}」的确认已取消`;
	return `云之家操作「${toolName}」需要确认，但当前没有确认通道`;
}
/**
* Register the `tools/pre-execute` confirm guard plus the ask-pending broadcast.
* @param ctx - Cordis context carrying the tools registry.
*/
function applyApprovalGuard(ctx) {
	ctx.on("tools/pre-execute", async (exec, next) => {
		const spec = WRITE_SPECS[exec.name];
		if (spec === void 0) return next();
		const args = typeof exec.arguments === "object" && exec.arguments !== null ? exec.arguments : {};
		if (spec.when !== void 0 && !spec.when(args)) return next();
		if (spec.whenSession !== void 0 && !spec.whenSession(callingSessionId(exec))) return next();
		const reason = `${spec.prefix ?? "云之家操作确认"}：${spec.reason}`;
		ctx.emit("yzj/ask-pending", {
			callId: exec.callId,
			toolName: exec.name,
			level: spec.level,
			reason,
			args
		});
		const sessionId = callingSessionId(exec) ?? "";
		const signal = exec.signal;
		const outcome = await ctx.waterfall("yzj/confirm-request", {
			sessionId,
			callId: exec.callId,
			toolName: exec.name,
			reason,
			...signal === void 0 ? {} : { signal }
		}, () => Promise.resolve("unavailable"));
		if (outcome === "allowed-once") return { kind: "allow" };
		return {
			kind: "deny",
			reason: denyReason(exec.name, outcome)
		};
	});
}
/**
* Model-facing Yunzhijia tool family over `ctx.yzjBridge`: doc, sheet,
* calendar, contact, im, and file domains. Every tool renders a bounded
* model-facing digest and projects a capped structured payload for the UI
* through `output.presentationMeta`; destructive or irreversible operations
* confirm through `yzj/confirm-request` (write-gate answers; not harness
* `{ kind: 'ask' }`, see pitfall-036).
* @module @dsh-yzj/tool-yzj
*/
/** Cordis plugin name used by loader diagnostics. */
const name = "tool-yzj";
/** Services required by the yzj tools. */
const inject = ["tools", "yzjBridge"];
const Config = z.object({
	timeoutMs: z.number().step(1).min(1).default(6e4),
	maxRenderChars: z.number().step(1).min(1).default(3e4),
	maxMetaChars: z.number().step(1).min(1).default(5e4),
	backfillLimit: z.number().step(1).min(1).default(50),
	summonWindowMessages: z.number().step(1).min(1).default(20),
	summonWindowChars: z.number().step(1).min(200).default(4e3),
	logRetention: z.number().step(1).min(1).default(500)
});
/** Register the full yzj tool family and the approval guard. */
function apply(ctx, config) {
	const budget = {
		timeoutMs: config.timeoutMs ?? 6e4,
		maxRenderChars: config.maxRenderChars ?? 3e4,
		maxMetaChars: config.maxMetaChars ?? 5e4
	};
	applyContactTools(ctx, budget);
	applyDocTools(ctx, budget);
	applySheetTools(ctx, budget);
	applyCalendarTools(ctx, budget);
	applyImTools(ctx, budget);
	applyFileTools(ctx, budget);
	const home = new YzjHomeService(ctx, {
		backfillLimit: config.backfillLimit ?? 50,
		summonWindowMessages: config.summonWindowMessages ?? 20,
		summonWindowChars: config.summonWindowChars ?? 4e3,
		logRetention: config.logRetention ?? 500
	});
	ctx.inject(["storageDomain"], () => {
		home.openNow();
	});
	applySummonOncePreStep(ctx, home);
	applyApprovalGuard(ctx);
}
/**
* Snapshot path is retired: the window is a one-shot plugin inject.
* Kept so older tests / callers still resolve; always empty.
*/
function summonWindowText(_home, _assemble) {
	return "";
}
const WINDOW_MARK = "［本群最近消息";
function userMessageData(event) {
	if (event.type !== "user/message") return void 0;
	return typeof event.data === "object" && event.data !== null ? event.data : void 0;
}
function sourceOf(data) {
	return typeof data.source === "object" && data.source !== null ? data.source : {};
}
function textOfUserMessage(data) {
	const content = data.content;
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content.map((part) => {
		if (typeof part === "string") return part;
		if (typeof part === "object" && part !== null) {
			const text = part.text;
			return typeof text === "string" ? text : "";
		}
		return "";
	}).join("");
}
function isRuntimeSnapshot(source) {
	return source.form === "snapshot";
}
function snapshotHasBoundWindow(source) {
	if (!isRuntimeSnapshot(source)) return false;
	return (Array.isArray(source.sections) ? source.sections : []).some((section) => {
		if (typeof section !== "object" || section === null) return false;
		return section.name === "yzj-bound-window";
	});
}
function isPluginWindowInject(data) {
	const source = sourceOf(data);
	if (source.kind !== "plugin" || isRuntimeSnapshot(source)) return false;
	if (source.plugin === "yzj-summon-window") return true;
	return textOfUserMessage(data).includes(WINDOW_MARK);
}
function latestNonSnapshotUserKind(events) {
	for (let index = events.length - 1; index >= 0; index -= 1) {
		const event = events[index];
		if (event === void 0) continue;
		const data = userMessageData(event);
		if (data === void 0) continue;
		const source = sourceOf(data);
		if (isRuntimeSnapshot(source) || source.form === "catalog") continue;
		return source.kind === "plugin" ? "plugin" : "user";
	}
	return "none";
}
function snapshotHasBoundWindowIn(events) {
	return events.some((event) => {
		const data = userMessageData(event);
		return data !== void 0 && snapshotHasBoundWindow(sourceOf(data));
	});
}
function pluginInjectedWindowIn(events) {
	return events.some((event) => {
		const data = userMessageData(event);
		return data !== void 0 && isPluginWindowInject(data);
	});
}
/** True when this session already has a summon-window plugin line or old snapshot section. */
function sessionHasSummonWindow(events) {
	return pluginInjectedWindowIn(events) || snapshotHasBoundWindowIn(events);
}
function messagesHaveSummonWindow(messages) {
	return messages.some((message) => {
		if (typeof message !== "object" || message === null) return false;
		return isPluginWindowInject(message) || snapshotHasBoundWindow(sourceOf(message));
	});
}
/**
* First user turn on a yzj room/topic: prepend one plugin window message.
* Later turns no-op. Official Chat and drawer share this (pitfall-031).
*/
function applySummonOncePreStep(ctx, home) {
	ctx.on("agent/pre-step", (async (payload, next) => {
		const decision = await next();
		if (decision.kind !== "enter") return decision;
		const sessionId = payload.agent?.session?.id;
		if (sessionId === void 0 || sessionId === "") return decision;
		const events = payload.agent?.session?.events ?? [];
		const incoming = decision.messages ?? payload.messages ?? [];
		if (sessionHasSummonWindow(events) || messagesHaveSummonWindow(incoming)) return decision;
		const conversationId = home.getBySession(sessionId)?.yzjConversationId ?? home.getTopicBySession(sessionId)?.yzjConversationId;
		if (conversationId === void 0) return decision;
		const text = home.formatSummonWindow(conversationId, void 0, sessionId);
		if (text === "") return decision;
		return {
			kind: "enter",
			messages: [{
				id: crypto.randomUUID(),
				role: "user",
				content: [{
					type: "text",
					text
				}],
				source: {
					kind: "plugin",
					plugin: "yzj-summon-window"
				}
			}, ...incoming]
		};
	}));
}
/** @deprecated Window no longer lives in the snapshot; prefer sessionHasSummonWindow. */
function shouldAttachSummonWindow(events) {
	return !sessionHasSummonWindow(events) && latestNonSnapshotUserKind(events) !== "plugin";
}
/**
* Session id for one prompt assembly. harness `AssembleContext.scope` is the
* Agent object (`ScopeKey = object`), not a session-id string.
*/
function sessionIdFromAssemble(assemble) {
	const fromAgent = assemble?.agent?.session?.id;
	if (typeof fromAgent === "string" && fromAgent !== "") return fromAgent;
	if (assemble?.scope !== void 0 && typeof assemble.scope === "object" && assemble.scope !== null) {
		const scoped = assemble.scope;
		if (typeof scoped.session?.id === "string" && scoped.session.id !== "") return scoped.session.id;
	}
}
//#endregion
export { BoundLogStore, Config, DEFAULT_BOUND_LOG_LIMITS, HomeBindingStore, TopicAnchorStore, ackLocalEntry, apply, applyAppend, applySummonOncePreStep, cliList, cliMessageList, cliMessageToEntry, cliObject, clipLogParam, conversationKindOf, extractSendMsgId, failLocalEntry, formatSummonWindow, homeSessionId, inject, isPluginFollowup, latestUserSourceKind, localMsgId, mergeFused, name, robotOutboundEntry, sessionHasSummonWindow, sessionIdFromAssemble, shouldAttachSummonWindow, summonWindowText, threadEntries, topicAnchorKey, topicSessionId, unwrapCli, yzjHomeDomainSpec, yzjHomeLogDomainSpec, yzjTopicDomainSpec };
