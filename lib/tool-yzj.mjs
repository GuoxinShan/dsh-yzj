import { join } from "node:path";
import { Service } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { DatabaseSync } from "node:sqlite";
import { homedir } from "node:os";
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
	const { content, truncated } = digestOf(`yzj ${label} failed (${result.timedOut ? "timed out" : `exit ${result.exitCode ?? "killed"}`}): ${result.stderr.trim() === "" ? "(no stderr)" : result.stderr.trim()}${looksUnauthenticated(result.stderr) ? "\n提示：yzj-cli 可能未登录，请先运行 `yzj-cli auth login` 完成浏览器/设备码登录。" : ""}`, max);
	return {
		content,
		truncated,
		data: {}
	};
}
/** Heuristic: stderr mentions an auth/credential failure worth a login hint. */
function looksUnauthenticated(stderr) {
	return /(auth|login|登录|token|credential|unauthorized|未授权)/i.test(stderr);
}
function asRecord(value) {
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
	const { content, data } = format(result.json);
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
/** Extract the user array from either a bare array or an object payload. */
function usersOf(json) {
	const list = asArray(json);
	return list.length > 0 ? list : asArray(asRecord(json).list);
}
/** Register the three contact tools. */
function applyContactTools(ctx, budget) {
	ctx.tools.register(defineTool({
		name: "yzj_whoami",
		description: "Return the current yzj-cli login user: name, openId, department, job title, and job number.",
		parameters: {},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => true,
		async execute() {
			return runValue(ctx, budget, "contact user get", [
				"contact",
				"user",
				"get"
			], (json) => {
				const users = usersOf(json);
				const lines = users.map(contactLine);
				return {
					content: lines.length === 0 ? "(no user info)" : lines.join("\n"),
					data: {
						record: asRecord(users[0]),
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
				const workspaces = asArray(json);
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
				const ws = asRecord(json);
				return {
					content: workspaceLine(ws),
					data: { record: clipJson(ws, { maxChars: budget.maxMetaChars }) }
				};
			});
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_doc_workspace_create",
		description: "Create a knowledge base with the given name and optional description. visibility: 1=企业知识库, 2=个人知识库 (default 2); allMember sets the enterprise-wide permission (2=可编辑, 3=可查看, visibility=1 only, yzj-cli v0.1.4). Returns the new KB_ID.",
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
				const ws = asRecord(json);
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
				const nodes = asArray(json);
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
				const node = asRecord(json);
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
				const nodes = asArray(json);
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
		description: "Create an online doc (otl) in a knowledge base, optionally under a parent node. Returns the new node id and link. For 多维表格 use yzj_sheet_create; knowledge bases have no folder type — use a parent doc for grouping.",
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
				const node = asRecord(json);
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
				const node = asRecord(json);
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
				const node = asRecord(json);
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
				const nodes = asArray(json);
				if (nodes.length > 0) return {
					content: nodes.map((record) => {
						const node = asRecord(record);
						const id = asString(node.id);
						return `${asString(node.title) || asString(node.fileName) || id} (${id})\n${docLink(id)}`;
					}).join("\n"),
					data: { list: clipJson(nodes, { maxChars: budget.maxMetaChars }) }
				};
				const raw = asRecord(json);
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
				const payload = asRecord(json);
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
				const blocks = asArray(asRecord(asRecord(json).data).blocks);
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
		description: "Search knowledge-base documents by keyword in title/file name (yzj-cli v0.1.4). Optional workspace scope; paged (pageNum from 1, pageSize ≤50). Use this to locate a doc before yzj_doc_get / yzj_doc_write / yzj_doc_download.",
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
				const rows = asArray(json).length > 0 ? asArray(json) : asArray(asRecord(json).list);
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
		description: "Write the WHOLE content of one smart doc (otl) in one call (yzj-cli v0.1.4): overwrite (default, replaces the entire body) or append (adds to the end). Content format markdown (default) or html. For surgical edits prefer yzj_doc_block_insert/update/replace — overwrite destroys the previous body, so it requires user confirmation.",
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
		description: "Download one knowledge-base Office/HTML document node to a local file (yzj-cli v0.1.4). Without output the original file name lands in the current directory; without overwrite an existing file is auto-renamed (report.pdf → report (1).pdf). Overwriting an existing local file requires user confirmation.",
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
		description: "Replace a block range inside an otl smart doc (yzj-cli v0.1.4): deletes blocks [start, end) then inserts content. start >= 1 (index 0 is the doc title and can never be removed); end is exclusive and must exceed start. content is the same block-node JSON array shape as yzj_doc_block_insert.",
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
function fieldsOf$1(record) {
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
	const fields = fieldsOf$1(record);
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
	const records = asArray(asRecord(json).records);
	return records.length > 0 ? records : asArray(json);
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
				const node = asRecord(json);
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
		description: "Read a 多维表格's schema: one line per data table (integer table id, fields, views). Always call this before table/record operations to obtain real sheetIds and field names.",
		parameters: { id: {
			type: "string",
			required: true,
			description: "The 多维表格 node id (DOC_ID, fileSuffix=dbt)."
		} },
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs,
		isConcurrencySafe: () => true,
		async execute(args) {
			return runValue(ctx, budget, "sheet get", [
				"sheet",
				"get",
				"--id",
				args.id
			], (json) => {
				const lines = asArray(asRecord(json).sheets).map(tableLine);
				return {
					content: lines.length === 0 ? "(no tables)" : lines.join("\n"),
					data: { schema: clipJson(json, { maxChars: budget.maxMetaChars }) }
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
				const table = asRecord(json);
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
				const root = asRecord(json);
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
* Unwrap the three CLI list envelopes into a record array.
*/
function calendarEventsFromJson(json) {
	if (Array.isArray(json)) return json;
	const record = asRecord(json);
	if (Array.isArray(record.list)) return record.list;
	if (Array.isArray(record.data)) return record.data;
	const nested = asRecord(record.data);
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
				const event = asRecord(json);
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
				const event = asRecord(json);
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
				const participants = asArray(json);
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
				const rooms = asArray(json);
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
				const payload = asRecord(json);
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
				const messages = asArray(asRecord(json).list);
				const more = asRecord(json).more === true;
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
		description: "List recent group/chat sessions with unread counts and last-message previews, newest first. There is no group search; page through this to locate a target group.",
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
				const groups = asArray(asRecord(json).list);
				const more = asRecord(json).more === true;
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
		description: "Search groups visible to the current user by keyword (yzj-cli v0.1.4). Use to resolve a group id when yzj_im_group_recent paging misses it (e.g. before advance source subscription or message operations).",
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
				const groups = asArray(asRecord(json).list).length > 0 ? asArray(asRecord(json).list) : asArray(json);
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
		description: "Create a group with the current user as owner (yzj-cli v0.1.4). memberOpenIds are the initial members EXCLUDING the creator — the CLI requires 2-10. Requires user confirmation.",
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
				const payload = asRecord(json);
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
		description: "Add members to a group (yzj-cli v0.1.4; ≤10 openIds per call). Requires user confirmation.",
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
		description: "Remove members from a group irreversibly (yzj-cli v0.1.4; ≤10 openIds per call). Strong user confirmation required; the approval already covers the CLI --yes flag.",
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
				const payload = asRecord(json);
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
* Local SQLite backend for advance 双表 + todo 任务表 + IM 缓存 (v1.8
* storage switch, 决策 36/37).
* The cloud 多维表格 backend proved unreliable (intermittent 500s on the
* record service); the advance board now persists to a local SQLite file
* via node:sqlite (zero cloud dependency). The todo family stays on dbt.
*
* Rows keep the same 中文 field keys as the dbt schema (ITEM_F / ENTRY_F)
* so the core's row→structure mapping is shared by both backends.
* @module @dsh-yzj/tool-yzj/local-store
*/
/**
* Two-table local store: items keyed by advance_id, entries keyed by
* entry_id. `fields` is stored as lossless JSON (中文 keys).
*/
var YzjLocalStore = class {
	db;
	constructor(path) {
		this.db = new DatabaseSync(path);
		this.db.exec(`
      CREATE TABLE IF NOT EXISTS items (
        advance_id TEXT PRIMARY KEY,
        fields TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS entries (
        entry_id TEXT PRIMARY KEY,
        advance_id TEXT NOT NULL,
        fields TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_entries_advance ON entries (advance_id);
      CREATE TABLE IF NOT EXISTS todos (
        todo_id TEXT PRIMARY KEY,
        fields TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS im_cache (
        cache_key TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        fetched_at INTEGER NOT NULL
      );
    `);
	}
	/** All item rows (insertion order not guaranteed; core sorts by created). */
	listItems() {
		return this.db.prepare("SELECT advance_id, fields FROM items").all().map((row) => ({
			recordId: row.advance_id,
			fields: JSON.parse(row.fields)
		}));
	}
	item(advanceId) {
		const row = this.db.prepare("SELECT advance_id, fields FROM items WHERE advance_id = ?").get(advanceId);
		if (row === void 0) return void 0;
		return {
			recordId: row.advance_id,
			fields: JSON.parse(row.fields)
		};
	}
	/** Insert one item row; duplicate advance_id throws (core prevents). */
	createItem(fields) {
		const advanceId = String(fields["advance_id"] ?? "");
		this.db.prepare("INSERT INTO items (advance_id, fields) VALUES (?, ?)").run(advanceId, JSON.stringify(fields));
	}
	/** Merge-update one item row's fields (projection refold). */
	updateItem(advanceId, patch) {
		const next = {
			...this.item(advanceId)?.fields ?? {},
			...patch
		};
		this.db.prepare("INSERT INTO items (advance_id, fields) VALUES (?, ?) ON CONFLICT(advance_id) DO UPDATE SET fields = excluded.fields").run(advanceId, JSON.stringify(next));
	}
	/** One item's entries in insertion order (rowid order). */
	listEntries(advanceId) {
		return this.db.prepare("SELECT entry_id, fields FROM entries WHERE advance_id = ? ORDER BY rowid").all(advanceId).map((row) => ({
			recordId: row.entry_id,
			fields: JSON.parse(row.fields)
		}));
	}
	/** Append one entry row (append-only; entry_id unique). */
	createEntry(fields) {
		const entryId = String(fields["entry_id"] ?? "");
		const advanceId = String(fields["advance_id"] ?? "");
		this.db.prepare("INSERT INTO entries (entry_id, advance_id, fields) VALUES (?, ?, ?)").run(entryId, advanceId, JSON.stringify(fields));
	}
	/** Every entry_id (for day-sequential id generation). */
	listAllEntryIds() {
		return this.db.prepare("SELECT entry_id FROM entries").all().map((row) => row.entry_id);
	}
	listTodos() {
		return this.db.prepare("SELECT todo_id, fields FROM todos").all().map((row) => ({
			recordId: row.todo_id,
			fields: JSON.parse(row.fields)
		}));
	}
	todo(todoId) {
		const row = this.db.prepare("SELECT todo_id, fields FROM todos WHERE todo_id = ?").get(todoId);
		if (row === void 0) return void 0;
		return {
			recordId: row.todo_id,
			fields: JSON.parse(row.fields)
		};
	}
	createTodo(fields) {
		this.db.prepare("INSERT INTO todos (todo_id, fields) VALUES (?, ?)").run(String(fields["todo_id"] ?? ""), JSON.stringify(fields));
	}
	updateTodo(todoId, patch) {
		const next = {
			...this.todo(todoId)?.fields ?? {},
			...patch
		};
		this.db.prepare("INSERT INTO todos (todo_id, fields) VALUES (?, ?) ON CONFLICT(todo_id) DO UPDATE SET fields = excluded.fields").run(todoId, JSON.stringify(next));
	}
	cacheGet(key) {
		const row = this.db.prepare("SELECT payload, fetched_at FROM im_cache WHERE cache_key = ?").get(key);
		if (row === void 0) return void 0;
		return {
			payload: JSON.parse(row.payload),
			fetchedAt: row.fetched_at
		};
	}
	cachePut(key, payload, fetchedAt) {
		this.db.prepare("INSERT INTO im_cache (cache_key, payload, fetched_at) VALUES (?, ?, ?) ON CONFLICT(cache_key) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at").run(key, JSON.stringify(payload), fetchedAt);
	}
	close() {
		this.db.close();
	}
};
let singleton;
/** Default db path: ~/.dsh/storages/yzj_advance.db (override via YZJ_ADVANCE_DB). */
function defaultLocalDbPath() {
	return process.env["YZJ_ADVANCE_DB"] ?? join(homedir(), ".dsh", "storages", "yzj_advance.db");
}
/** Process-wide store (lazy open). Tests use resetLocalStoreForTests. */
function localStore() {
	if (singleton === void 0) singleton = new YzjLocalStore(defaultLocalDbPath());
	return singleton;
}
/**
* Semantic todo tool family (待办). Demo stage: backed by one 多维表格
* ("待办任务库" dbt) acting as the shadow task store — every invariant
* (stable id, state machine, append-only log, #tag aggregation) is enforced
* host-side so the backend can later be swapped for a native todo API
* without changing the tool surface (see docs/migration/todo-backend-migration.md).
*
* The same core backs the `ctx.yzjTodo` service consumed by the ui-yzj RPC
* channel, so the conversation tools and the panel share one implementation.
*
* Verified CLI formats (probed 2026-08-15): record create/update take a
* JSON *array* `--records`; `records[].fields` comes back as a JSON string;
* Date values are `YYYY/MM/DD` strings; SingleSelect options must be
* pre-registered at table create; Contact/MultipleSelect writes are not
* usable for dynamic values, so 负责人 is `姓名(openId)` text and 标签 is
* `#tag` tokens in a text field.
*/
/** v1.8 决策 37: 'sqlite' = 真机本地 SQLite（index.ts apply 启用）；'dbt' = 测试 double（FakeStore 命令脚本）。云 dbt 在真机已死。 */
let todoBackend = "dbt";
function setTodoBackend(next) {
	todoBackend = next;
}
/** Field names of the backing 任务 table (single source of truth). */
const F = {
	id: "todo_id",
	title: "标题",
	status: "状态",
	assignee: "负责人",
	ddl: "DDL",
	priority: "优先级",
	tags: "标签",
	source: "来源",
	log: "推进日志"
};
/** Library titles used for discovery/provisioning. */
const LIBRARY_TITLE = "待办任务库";
const TABLE_NAME = "任务";
/** Split a raw tag input (string like "#a #b" / "a,b" or array) into tags. */
function normalizeTags(input) {
	const raw = Array.isArray(input) ? input.filter((item) => typeof item === "string") : typeof input === "string" ? [input] : [];
	const seen = /* @__PURE__ */ new Set();
	for (const chunk of raw) for (const token of chunk.split(/[\s,，、;；]+/)) {
		const tag = token.replace(/^#+/, "").trim();
		if (tag !== "") seen.add(tag);
	}
	return [...seen];
}
/** Render tags back into the stored `#tag` token form. */
function formatTags(tags) {
	return tags.map((tag) => `#${tag.replace(/^#+/, "")}`).join(" ");
}
/** Local today as `YYYY/MM/DD`. */
function todayStr(now = /* @__PURE__ */ new Date()) {
	const pad = (n) => String(n).padStart(2, "0");
	return `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())}`;
}
/** Local now as `YYYY/MM/DD HH:mm`. */
function nowStamp(now = /* @__PURE__ */ new Date()) {
	const pad = (n) => String(n).padStart(2, "0");
	return `${todayStr(now)} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
/** Normalize a DDL input (`YYYY-MM-DD` or `YYYY/MM/DD`) to `YYYY/MM/DD`. */
function normalizeDdl(input) {
	const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(input.trim());
	if (match === null) return input.trim().replace(/-/g, "/");
	const y = match[1] ?? "";
	const m = match[2] ?? "";
	const d = match[3] ?? "";
	return `${y}/${m.padStart(2, "0")}/${d.padStart(2, "0")}`;
}
/** Whether a todo is overdue (DDL passed and not done). */
function isOverdue(status, ddl, today = todayStr()) {
	return status !== "done" && ddl !== "" && ddl < today;
}
/**
* Validate a status transition; returns an error message or null.
* pending→done must go through yzj_todo_complete (or in_progress).
*/
function checkTransition(from, to) {
	if (from === to) return null;
	if (({
		pending: ["in_progress"],
		in_progress: ["pending", "done"],
		done: ["in_progress"]
	}[from] ?? []).includes(to)) return null;
	return `状态机拒绝 ${from} → ${to}：合法流转为 pending→in_progress→done（done→in_progress 可重开，in_progress→pending 可打回）；直接完成请用 yzj_todo_complete`;
}
/** Append one line to the append-only progress log. */
function appendLog(existing, line) {
	return existing.trim() === "" ? line : `${existing.trim()}\n${line}`;
}
/** Parse a `姓名(openId)` assignee value. */
function parseAssignee(raw) {
	const match = /^(.*)\(([\w-]+)\)$/.exec(raw.trim());
	if (match === null) return {
		name: raw.trim(),
		openId: ""
	};
	return {
		name: (match[1] ?? "").trim(),
		openId: match[2] ?? ""
	};
}
/** Parse one CLI record into a YzjTodo; null when the shape is unusable. */
function parseTodoRecord(record, today = todayStr()) {
	const row = asRecord(record);
	const raw = row.fieldsValue ?? row.fields ?? row.values;
	let fields;
	if (typeof raw === "string") try {
		fields = asRecord(JSON.parse(raw));
	} catch {
		return null;
	}
	else fields = asRecord(raw);
	const todoId = asString(fields[F.id]);
	if (todoId === "") return null;
	const status = asString(fields[F.status]) || "pending";
	const parsed = parseAssignee(asString(fields[F.assignee]));
	const ddl = normalizeDdl(asString(fields[F.ddl]));
	return {
		recordId: asString(row.id ?? row.recordId),
		todoId,
		title: asString(fields[F.title]),
		status: [
			"pending",
			"in_progress",
			"done"
		].includes(status) ? status : "pending",
		assignee: parsed.name,
		assigneeOpenId: parsed.openId,
		ddl,
		priority: asString(fields[F.priority]),
		tags: normalizeTags(asString(fields[F.tags])),
		log: asString(fields[F.log]),
		overdue: isOverdue(status, ddl, today)
	};
}
/** Next sequential id `T-YYYYMMDD-NNN` from today's existing ids. */
function nextTodoId(existingIds, now = /* @__PURE__ */ new Date()) {
	const prefix = `T-${todayStr(now).replace(/\//g, "")}-`;
	let max = 0;
	for (const id of existingIds) {
		if (!id.startsWith(prefix)) continue;
		const n = Number.parseInt(id.slice(prefix.length), 10);
		if (Number.isInteger(n) && n > max) max = n;
	}
	return `${prefix}${String(max + 1).padStart(3, "0")}`;
}
/** One `yzj_todo_list` digest line. */
function todoLine(todo) {
	const parts = [todo.todoId, todo.title];
	parts.push(`[${todo.status}${todo.overdue ? "/逾期" : ""}]`);
	if (todo.ddl !== "") parts.push(`DDL ${todo.ddl}`);
	if (todo.priority !== "") parts.push(todo.priority);
	if (todo.tags.length > 0) parts.push(formatTags(todo.tags));
	if (todo.assignee !== "") parts.push(`@${todo.assignee}`);
	return parts.join(" · ");
}
/** Run one bridge command expecting JSON; failures become a digest value. */
async function runTodoJson(ctx, budget, label, command) {
	const result = await ctx.yzjBridge.run(command, { timeoutMs: budget.timeoutMs });
	if (!result.ok) return {
		ok: false,
		value: failureDigest(label, result, budget.maxRenderChars)
	};
	return {
		ok: true,
		json: result.json
	};
}
/** CLI records array from a list/create/update payload. */
function cliRecords$1(json) {
	const records = asArray(asRecord(json).records);
	return records.length > 0 ? records : asArray(json);
}
/** Fields definition for provisioning the 任务 table (options embedded). */
function tableFieldsJson() {
	return JSON.stringify([
		{
			name: F.id,
			type: "MultiLineText"
		},
		{
			name: F.title,
			type: "MultiLineText"
		},
		{
			name: F.status,
			type: "SingleSelect",
			data: { items: [
				{ value: "pending" },
				{ value: "in_progress" },
				{ value: "done" }
			] }
		},
		{
			name: F.assignee,
			type: "MultiLineText"
		},
		{
			name: F.ddl,
			type: "Date"
		},
		{
			name: F.priority,
			type: "SingleSelect",
			data: { items: [
				{ value: "P0" },
				{ value: "P1" },
				{ value: "P2" }
			] }
		},
		{
			name: F.tags,
			type: "MultiLineText"
		},
		{
			name: F.source,
			type: "Url"
		},
		{
			name: F.log,
			type: "MultiLineText"
		}
	]);
}
/** Find a usable binding in one dbt doc: a table whose fields include todo_id. */
async function bindingForDoc(ctx, budget, docId) {
	const ran = await runTodoJson(ctx, budget, "sheet get", [
		"sheet",
		"get",
		"--id",
		docId
	]);
	if (!ran.ok) return void 0;
	for (const table of asArray(asRecord(ran.json).sheets)) {
		const row = asRecord(table);
		const tableId = row.id;
		const names = asArray(row.fields).map((field) => asString(asRecord(field).name));
		if (typeof tableId === "number" && names.includes(F.id)) return {
			docId,
			tableId,
			link: `https://www.yunzhijia.com/knowledge/lingee/#/store/doc/${docId}`
		};
	}
}
/** Provision the 任务 table inside an existing dbt doc. */
async function provisionTable(ctx, budget, docId) {
	const ran = await runTodoJson(ctx, budget, "sheet table create", [
		"sheet",
		"table",
		"create",
		"--id",
		docId,
		"--name",
		TABLE_NAME,
		"--fields",
		tableFieldsJson(),
		"--views",
		JSON.stringify([{
			name: "全部",
			type: "Grid"
		}, {
			name: "按DDL",
			type: "Query"
		}])
	]);
	if (!ran.ok) throw new Error(ran.value.content);
	const binding = await bindingForDoc(ctx, budget, docId);
	if (binding === void 0) throw new Error(`todo: 任务表创建后未在 ${docId} 中找到 todo_id 字段`);
	return binding;
}
/**
* Resolve (and optionally provision) the todo library. Order: panel-selected
* override (user's active library) → explicit config binding → discovery by
* title in the configured/personal workspaces. Cached per core instance.
* An override that no longer validates (library deleted) is cleared and
* resolution falls through.
*/
async function resolveLibrary(ctx, budget, config, cache, allowProvision, holder) {
	if (todoBackend === "sqlite") {
		const local = {
			docId: "local-sqlite",
			tableId: 0,
			link: ""
		};
		cache.binding = local;
		return local;
	}
	if (cache.binding !== void 0) return cache.binding;
	if (holder?.override !== void 0) {
		const ran = await runTodoJson(ctx, budget, "sheet get", [
			"sheet",
			"get",
			"--id",
			holder.override.docId
		]);
		if (ran.ok && asArray(asRecord(ran.json).sheets).some((table) => asRecord(table).id === holder.override.tableId && asArray(asRecord(table).fields).some((field) => asString(asRecord(field).name) === F.id))) {
			cache.binding = holder.override;
			return holder.override;
		}
		delete holder.override;
	}
	if (config.docId !== void 0 && config.tableId !== void 0) {
		const direct = {
			docId: config.docId,
			tableId: config.tableId,
			link: `https://www.yunzhijia.com/knowledge/lingee/#/store/doc/${config.docId}`
		};
		const ran = await runTodoJson(ctx, budget, "sheet get", [
			"sheet",
			"get",
			"--id",
			config.docId
		]);
		if (ran.ok) {
			if (asArray(asRecord(ran.json).sheets).some((table) => asRecord(table).id === config.tableId && asArray(asRecord(table).fields).some((field) => asString(asRecord(field).name) === F.id))) {
				cache.binding = direct;
				return direct;
			}
		}
		throw new Error(`todo: 配置的库 doc=${config.docId} table=${config.tableId} 校验失败（不存在或缺少 ${F.id} 字段）；请修正 todo 配置或清空以走自动发现`);
	}
	let workspaces = [];
	if (config.workspace !== void 0) workspaces = [{
		id: config.workspace,
		name: ""
	}];
	else {
		const ran = await runTodoJson(ctx, budget, "doc workspace list", [
			"doc",
			"workspace",
			"list",
			"--type",
			"personal"
		]);
		if (!ran.ok) throw new Error(ran.value.content);
		workspaces = (Array.isArray(ran.json) ? ran.json : asArray(asRecord(ran.json).list)).map((node) => {
			const row = asRecord(node);
			return {
				id: asString(row.id),
				name: asString(row.name)
			};
		}).filter((ws) => ws.id !== "").slice(0, 8);
		if (workspaces.length === 0) throw new Error("todo: 未找到个人知识库，无法定位待办任务库；请在 todo 配置中显式指定 workspace");
	}
	for (const ws of workspaces) {
		const listRan = await runTodoJson(ctx, budget, "doc list", [
			"doc",
			"list",
			"--workspace",
			ws.id
		]);
		if (!listRan.ok) continue;
		const nodes = Array.isArray(listRan.json) ? listRan.json : asArray(asRecord(listRan.json).list);
		for (const node of nodes) {
			const row = asRecord(node);
			if (row.fileSuffix === "dbt" && asString(row.title) === LIBRARY_TITLE) {
				const docId = asString(row.id);
				const found = await bindingForDoc(ctx, budget, docId);
				if (found !== void 0) {
					cache.binding = found;
					return found;
				}
				if (allowProvision) {
					const provisioned = await provisionTable(ctx, budget, docId);
					cache.binding = provisioned;
					return provisioned;
				}
			}
		}
	}
	if (!allowProvision) throw new Error("todo: 待办任务库尚未开通；创建第一条待办即可自动开通");
	const createRan = await runTodoJson(ctx, budget, "sheet create", [
		"sheet",
		"create",
		"--workspace",
		workspaces[0].id,
		"--title",
		LIBRARY_TITLE
	]);
	if (!createRan.ok) throw new Error(createRan.value.content);
	const docId = asString(asRecord(createRan.json).id);
	if (docId === "") throw new Error("todo: 创建待办任务库未返回文档 id");
	const binding = await provisionTable(ctx, budget, docId);
	cache.binding = binding;
	return binding;
}
/** Fetch and parse every todo (paged up to 300 records, demo scale). */
async function fetchTodos(ctx, budget, binding) {
	if (todoBackend === "sqlite") return localStore().listTodos().map((row) => parseTodoRecord({
		id: row.recordId,
		fields: row.fields
	})).filter((todo) => todo !== null);
	const todos = [];
	let pageToken;
	for (let page = 0; page < 3; page += 1) {
		const command = [
			"sheet",
			"record",
			"list",
			"--id",
			binding.docId,
			"--table-id",
			String(binding.tableId),
			"--limit",
			"100"
		];
		if (pageToken !== void 0) command.push("--page-token", pageToken);
		const ran = await runTodoJson(ctx, budget, "sheet record list", command);
		if (!ran.ok) throw new Error(ran.value.content);
		for (const record of cliRecords$1(ran.json)) {
			const todo = parseTodoRecord(record);
			if (todo !== null) todos.push(todo);
		}
		pageToken = asString(asRecord(ran.json).page_token ?? asRecord(ran.json).next_page_token);
		if (pageToken === "") break;
	}
	return todos;
}
/** Fetch one todo by todo_id; undefined when absent. */
async function fetchTodoByTodoId(ctx, budget, binding, todoId) {
	if (todoBackend === "sqlite") {
		const row = localStore().todo(todoId);
		if (row === void 0) return void 0;
		return parseTodoRecord({
			id: row.recordId,
			fields: row.fields
		}) ?? void 0;
	}
	const filter = JSON.stringify({
		mode: "AND",
		criteria: [{
			field: F.id,
			operator: "Equals",
			values: [todoId]
		}]
	});
	const ran = await runTodoJson(ctx, budget, "sheet record list", [
		"sheet",
		"record",
		"list",
		"--id",
		binding.docId,
		"--table-id",
		String(binding.tableId),
		"--filter",
		filter
	]);
	if (!ran.ok) throw new Error(ran.value.content);
	for (const record of cliRecords$1(ran.json)) {
		const todo = parseTodoRecord(record);
		if (todo !== null) return todo;
	}
}
/** Resolve an assignee string to `姓名(openId)` when unambiguous. */
async function resolveAssignee(ctx, budget, assignee) {
	const trimmed = assignee.trim();
	if (trimmed === "" || /\([\w-]+\)$/.test(trimmed)) return {
		value: trimmed,
		resolved: true
	};
	const ran = await runTodoJson(ctx, budget, "contact user search", [
		"contact",
		"user",
		"search",
		"--keyword",
		trimmed
	]);
	if (!ran.ok) return {
		value: trimmed,
		resolved: false
	};
	const hits = asArray(asRecord(ran.json).list ?? ran.json).map((row) => asRecord(row)).filter((row) => asString(row.name) === trimmed);
	if (hits.length === 1) {
		const openId = asString(hits[0]?.openId ?? hits[0]?.open_id);
		if (openId !== "") return {
			value: `${trimmed}(${openId})`,
			resolved: true
		};
	}
	return {
		value: trimmed,
		resolved: false
	};
}
/** Write records (create/update array form) and return the raw payload. */
async function writeRecords(ctx, budget, label, binding, records) {
	if (todoBackend === "sqlite") {
		const store = localStore();
		const rows = JSON.parse(records);
		const out = [];
		for (const row of rows) {
			const fields = row.fieldsValue ?? {};
			const todoId = String(row.id ?? fields[F.id] ?? "");
			if (label.includes("create")) store.createTodo(fields);
			else store.updateTodo(todoId, fields);
			out.push({
				id: todoId,
				fields: { ...store.todo(todoId)?.fields }
			});
		}
		return {
			ok: true,
			json: { records: out }
		};
	}
	const command = label.includes("create") ? [
		"sheet",
		"record",
		"create",
		"--id",
		binding.docId,
		"--table-id",
		String(binding.tableId),
		"--records",
		records
	] : [
		"sheet",
		"record",
		"update",
		"--id",
		binding.docId,
		"--table-id",
		String(binding.tableId),
		"--records",
		records
	];
	const result = await ctx.yzjBridge.run(command, { timeoutMs: budget.timeoutMs });
	if (!result.ok) return {
		ok: false,
		content: failureDigest(label, result, budget.maxRenderChars).content
	};
	return {
		ok: true,
		json: result.json
	};
}
/** Create one todo (idempotent on explicit todoId). Throws actionable errors. */
async function coreCreate(ctx, budget, config, cache, input, holder) {
	const title = input.title.trim();
	if (title === "") throw new Error("todo: title must not be empty");
	const binding = await resolveLibrary(ctx, budget, config, cache, true, holder);
	if (input.todoId !== void 0) {
		const existing = await fetchTodoByTodoId(ctx, budget, binding, input.todoId);
		if (existing !== void 0) return {
			todo: existing,
			idempotent: true,
			assigneeNote: "",
			binding
		};
	}
	const todos = await fetchTodos(ctx, budget, binding);
	const todoId = input.todoId ?? nextTodoId(todos.map((todo) => todo.todoId));
	if (todos.some((todo) => todo.todoId === todoId)) throw new Error(`todo: 生成的 todo_id ${todoId} 已冲突，请显式传入 todoId`);
	const tags = normalizeTags(input.tags);
	const fields = {
		[F.id]: todoId,
		[F.title]: title,
		[F.status]: "pending"
	};
	let assigneeNote = "";
	if (input.assignee !== void 0 && input.assignee.trim() !== "") {
		const resolved = await resolveAssignee(ctx, budget, input.assignee);
		fields[F.assignee] = resolved.value;
		if (!resolved.resolved) assigneeNote = `（负责人 "${input.assignee}" 未能唯一解析，已按姓名保存）`;
	}
	if (input.ddl !== void 0 && input.ddl.trim() !== "") fields[F.ddl] = normalizeDdl(input.ddl);
	if (input.priority !== void 0 && input.priority !== "") fields[F.priority] = input.priority;
	if (tags.length > 0) fields[F.tags] = formatTags(tags);
	const refLine = (input.refs ?? []).length > 0 ? `\n${nowStamp()} 来源引用 ${(input.refs ?? []).join(" ")}` : "";
	fields[F.log] = `${nowStamp()} 创建${refLine}`;
	const wrote = await writeRecords(ctx, budget, "sheet record create", binding, JSON.stringify([{ fieldsValue: fields }]));
	if (!wrote.ok) throw new Error(wrote.content);
	return {
		todo: cliRecords$1(wrote.json).map((record) => parseTodoRecord(record)).find((todo) => todo !== null) ?? null,
		idempotent: false,
		assigneeNote,
		binding
	};
}
/**
* Set a todo's status with state-machine enforcement and host-appended log.
* `done` from any state is the complete convenience; `changed: false` marks
* an idempotent hit (already at target).
*/
async function coreSetStatus(ctx, budget, config, cache, todoId, target, note, holder) {
	const binding = await resolveLibrary(ctx, budget, config, cache, false, holder);
	const existing = await fetchTodoByTodoId(ctx, budget, binding, todoId);
	if (existing === void 0) throw new Error(`todo: 待办 ${todoId} 不存在；先用 yzj_todo_list 查真实 id，不要猜测`);
	if (existing.status === target) return {
		todo: existing,
		from: existing.status,
		changed: false,
		binding
	};
	if (target !== "done") {
		const violation = checkTransition(existing.status, target);
		if (violation !== null) throw new Error(`todo: ${violation}`);
	}
	const verb = target === "done" ? "完成" : target === "in_progress" ? "推进" : "打回";
	const noteText = note === void 0 ? "" : note.trim();
	const log = appendLog(existing.log, `${nowStamp()} 状态 ${existing.status}→${target}（${verb}${noteText === "" ? "" : `：${noteText}`}）`);
	const wrote = await writeRecords(ctx, budget, "sheet record update", binding, JSON.stringify([{
		id: existing.recordId,
		fieldsValue: {
			[F.status]: target,
			[F.log]: log
		}
	}]));
	if (!wrote.ok) throw new Error(wrote.content);
	return {
		todo: {
			...existing,
			status: target,
			log
		},
		from: existing.status,
		changed: true,
		binding
	};
}
/** Host service exposing the todo core to the browser surface. */
var YzjTodoService = class extends Service {
	budget;
	config;
	cache = {};
	/** Shared with the tool family so agent writes follow the active library. */
	holder = {};
	librariesCache = null;
	constructor(ctx, budget, config) {
		super(ctx, "yzjTodo");
		this.budget = budget;
		this.config = config;
	}
	/** Current state; `ready` false means the library is not provisioned yet.
	*  Libraries for the switcher are fetched separately (todo-libraries RPC)
	*  so this stays fast — the discovery scan is slow. The ACTIVE library's
	*  identity rides along via a cheap doc-get + cached workspace index. */
	async state() {
		let binding;
		try {
			binding = await resolveLibrary(this.ctx, this.budget, this.config, this.cache, false, this.holder);
		} catch {
			return {
				ready: false,
				library: null,
				todos: [],
				activeDocId: ""
			};
		}
		const identity = await this.libraryIdentity(binding.docId);
		try {
			const todos = await fetchTodos(this.ctx, this.budget, binding);
			return {
				ready: true,
				library: binding,
				todos: todos.map(viewOf),
				activeDocId: binding.docId,
				...identity
			};
		} catch (error) {
			return {
				ready: true,
				library: binding,
				todos: [],
				error: String(error.message),
				activeDocId: binding.docId,
				...identity
			};
		}
	}
	/** wsId → {name, scope} index from the two workspace lists (cached 5min). */
	wsIndexCache = null;
	async workspaceIndex() {
		if (this.wsIndexCache !== null && Date.now() - this.wsIndexCache.at < 3e5) return this.wsIndexCache.map;
		const map = /* @__PURE__ */ new Map();
		for (const { cli, scope } of [{
			cli: "personal",
			scope: "personal"
		}, {
			cli: "enterprise",
			scope: "team"
		}]) {
			const ran = await runTodoJson(this.ctx, this.budget, "doc workspace list", [
				"doc",
				"workspace",
				"list",
				"--type",
				cli
			]);
			if (!ran.ok) continue;
			const list = Array.isArray(ran.json) ? ran.json : asArray(asRecord(ran.json).list);
			for (const node of list) {
				const row = asRecord(node);
				const id = asString(row.id);
				if (id !== "") map.set(id, {
					name: asString(row.name),
					scope
				});
			}
		}
		this.wsIndexCache = {
			at: Date.now(),
			map
		};
		return map;
	}
	/** Cheap identity of one library doc: its workspace name + scope. */
	async libraryIdentity(docId) {
		try {
			const ran = await runTodoJson(this.ctx, this.budget, "doc get", [
				"doc",
				"get",
				"--id",
				docId
			]);
			if (!ran.ok) return {};
			const kbId = asString(asRecord(ran.json).kbId);
			if (kbId === "") return {};
			const meta = (await this.workspaceIndex()).get(kbId);
			if (meta === void 0) return {};
			return {
				libraryName: meta.name,
				libraryScope: meta.scope
			};
		} catch {
			return {};
		}
	}
	/**
	* Discover libraries for the switcher: every 待办任务库 across personal
	* and enterprise workspaces (bounded scan) plus remembered team libraries.
	* Cached ~5min — the scan is a dozen-plus CLI calls.
	*/
	async listLibraries() {
		if (this.librariesCache !== null && Date.now() - this.librariesCache.at < 3e5) return this.librariesCache.list;
		const found = [];
		const seen = /* @__PURE__ */ new Set();
		for (const { cli, scope } of [{
			cli: "personal",
			scope: "personal"
		}, {
			cli: "enterprise",
			scope: "team"
		}]) {
			const ran = await runTodoJson(this.ctx, this.budget, "doc workspace list", [
				"doc",
				"workspace",
				"list",
				"--type",
				cli
			]);
			if (!ran.ok) continue;
			const list = Array.isArray(ran.json) ? ran.json : asArray(asRecord(ran.json).list);
			for (const node of list.slice(0, 12)) {
				const ws = asRecord(node);
				const wsId = asString(ws.id);
				if (wsId === "") continue;
				const docsRan = await runTodoJson(this.ctx, this.budget, "doc list", [
					"doc",
					"list",
					"--workspace",
					wsId
				]);
				if (!docsRan.ok) continue;
				const nodes = Array.isArray(docsRan.json) ? docsRan.json : asArray(asRecord(docsRan.json).list);
				for (const doc of nodes) {
					const row = asRecord(doc);
					if (row.fileSuffix !== "dbt" || asString(row.title) !== LIBRARY_TITLE) continue;
					const docId = asString(row.id);
					if (docId === "" || seen.has(docId)) continue;
					const binding = await bindingForDoc(this.ctx, this.budget, docId);
					if (binding === void 0) continue;
					seen.add(docId);
					found.push({
						scope,
						workspaceId: wsId,
						workspaceName: asString(ws.name),
						docId,
						tableId: binding.tableId,
						link: binding.link
					});
				}
			}
		}
		for (const known of this.holder.known ?? []) if (!seen.has(known.docId)) {
			seen.add(known.docId);
			found.push(known);
		}
		this.librariesCache = {
			at: Date.now(),
			list: found
		};
		return found;
	}
	/** Enterprise workspaces offered when provisioning a team library. */
	async teamWorkspaces() {
		const ran = await runTodoJson(this.ctx, this.budget, "doc workspace list", [
			"doc",
			"workspace",
			"list",
			"--type",
			"enterprise"
		]);
		if (!ran.ok) throw new Error(ran.value.content);
		return (Array.isArray(ran.json) ? ran.json : asArray(asRecord(ran.json).list)).map((node) => {
			const row = asRecord(node);
			return {
				id: asString(row.id),
				name: asString(row.name),
				docCount: typeof row.docCount === "number" ? row.docCount : 0,
				permissionLevel: typeof row.permissionLevel === "number" ? row.permissionLevel : 3
			};
		}).filter((ws) => ws.id !== "").sort((a, b) => a.permissionLevel - b.permissionLevel || a.name.localeCompare(b.name));
	}
	/** Switch the active library (panel picker). Validates before adopting. */
	async select(docId) {
		const binding = await bindingForDoc(this.ctx, this.budget, docId);
		if (binding === void 0) throw new Error(`todo: 文档 ${docId} 不是可用的待办任务库（缺少任务表）`);
		this.holder.override = binding;
		this.rememberLibrary(binding);
		delete this.cache.binding;
		this.librariesCache = null;
		return this.state();
	}
	/** Adopt-or-provision a team library in one enterprise workspace, then
	*  make it active. Returns the refreshed state. */
	async ensureTeam(workspaceId) {
		const ran = await runTodoJson(this.ctx, this.budget, "doc list", [
			"doc",
			"list",
			"--workspace",
			workspaceId
		]);
		if (!ran.ok) throw new Error(ran.value.content);
		const existing = (Array.isArray(ran.json) ? ran.json : asArray(asRecord(ran.json).list)).find((node) => asRecord(node).fileSuffix === "dbt" && asString(asRecord(node).title) === LIBRARY_TITLE);
		let binding;
		if (existing !== void 0) {
			const docId = asString(asRecord(existing).id);
			binding = await bindingForDoc(this.ctx, this.budget, docId) ?? await provisionTable(this.ctx, this.budget, docId);
		} else {
			const createRan = await runTodoJson(this.ctx, this.budget, "sheet create", [
				"sheet",
				"create",
				"--workspace",
				workspaceId,
				"--title",
				LIBRARY_TITLE
			]);
			if (!createRan.ok) throw new Error(createRan.value.content);
			const docId = asString(asRecord(createRan.json).id);
			if (docId === "") throw new Error("todo: 创建团队任务库未返回文档 id");
			binding = await provisionTable(this.ctx, this.budget, docId);
		}
		this.holder.override = binding;
		this.rememberLibrary(binding, workspaceId);
		delete this.cache.binding;
		this.librariesCache = null;
		return this.state();
	}
	/** Provision the personal library on demand (one-click empty-state action). */
	async ensure() {
		return {
			ready: true,
			library: await resolveLibrary(this.ctx, this.budget, this.config, this.cache, true, this.holder),
			todos: []
		};
	}
	/** Quick-create (panel composer path). */
	async create(input) {
		const result = await coreCreate(this.ctx, this.budget, this.config, this.cache, input, this.holder);
		if (result.todo === null) throw new Error("todo: 创建成功但未能读回记录");
		return viewOf(result.todo);
	}
	/** Toggle complete / reopen (panel checkbox path). */
	async toggle(todoId) {
		const existing = (await this.state()).todos.find((todo) => todo.todoId === todoId);
		if (existing === void 0) throw new Error(`todo: 待办 ${todoId} 不存在`);
		const target = existing.status === "done" ? "in_progress" : "done";
		return viewOf((await coreSetStatus(this.ctx, this.budget, this.config, this.cache, todoId, target, target === "done" ? "面板勾选完成" : "面板重开", this.holder)).todo);
	}
	/** Keep a selected binding visible in the picker across scans. */
	rememberLibrary(binding, workspaceId) {
		const known = this.holder.known ?? [];
		if (!known.some((ref) => ref.docId === binding.docId)) {
			known.push({
				scope: "team",
				workspaceId: workspaceId ?? "",
				workspaceName: "",
				docId: binding.docId,
				tableId: binding.tableId,
				link: binding.link
			});
			this.holder.known = known;
		}
	}
};
/** Lossless projection of a parsed todo for the wire. */
function viewOf(todo) {
	return {
		todoId: todo.todoId,
		title: todo.title,
		status: todo.status,
		assignee: todo.assignee,
		assigneeOpenId: todo.assigneeOpenId,
		ddl: todo.ddl,
		priority: todo.priority,
		tags: todo.tags,
		log: todo.log,
		overdue: todo.overdue
	};
}
/** Register the semantic todo tool family. The yzjTodo service is
* instantiated separately by the package entry (it needs a real Cordis
* context); both share the same core operations. */
function applyTodoTools(ctx, budget, config, holder) {
	const cache = {};
	const libraryMeta = (binding) => ({
		docId: binding.docId,
		tableId: binding.tableId,
		link: binding.link
	});
	ctx.tools.register(defineTool({
		name: "yzj_todo_list",
		description: "List todos from the 待办任务库 (demo-stage sheet backend). Filter by status (pending/in_progress/done/overdue/open/all, default open), tag, or assignee name; sorted by DDL. Use tags to aggregate anything — a tag can be a project, a group, or any theme.",
		parameters: {
			status: {
				type: "string",
				enum: [
					"pending",
					"in_progress",
					"done",
					"overdue",
					"open",
					"all"
				],
				description: "open = not done; overdue = DDL passed and not done; default open."
			},
			tag: {
				type: "string",
				description: "Only todos carrying this tag (no # prefix needed)."
			},
			assignee: {
				type: "string",
				description: "Only todos whose 负责人 name matches (substring)."
			},
			limit: {
				type: "number",
				description: "Max rows in the digest, 1-100, default 50."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs * 2,
		isConcurrencySafe: () => true,
		async execute(args) {
			let binding;
			try {
				binding = await resolveLibrary(ctx, budget, config, cache, false, holder);
			} catch (error) {
				return {
					content: `(待办任务库未开通) ${String(error.message)}`,
					truncated: false,
					data: {
						kind: "todo-list",
						ready: false
					}
				};
			}
			let todos;
			try {
				todos = await fetchTodos(ctx, budget, binding);
			} catch (error) {
				return {
					content: `yzj todo list failed: ${String(error.message)}`,
					truncated: false,
					data: {}
				};
			}
			const status = args.status ?? "open";
			const tag = args.tag === void 0 ? "" : args.tag.replace(/^#+/, "").trim();
			const assignee = (args.assignee ?? "").trim();
			const sorted = todos.filter((todo) => {
				if (status === "open" && todo.status === "done") return false;
				if (status === "pending" || status === "in_progress" || status === "done") {
					if (todo.status !== status) return false;
				}
				if (status === "overdue" && !todo.overdue) return false;
				if (tag !== "" && !todo.tags.includes(tag)) return false;
				if (assignee !== "" && !todo.assignee.includes(assignee)) return false;
				return true;
			}).sort((a, b) => {
				if (a.ddl === "" && b.ddl === "") return a.todoId < b.todoId ? -1 : 1;
				if (a.ddl === "") return 1;
				if (b.ddl === "") return -1;
				return a.ddl === b.ddl ? a.todoId < b.todoId ? -1 : 1 : a.ddl < b.ddl ? -1 : 1;
			});
			const limit = args.limit === void 0 ? 50 : args.limit;
			if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("yzj_todo_list: limit must be an integer between 1 and 100");
			const shown = sorted.slice(0, limit);
			return {
				content: [`待办任务库 (${binding.link}) · ${status}${tag === "" ? "" : ` #${tag}`} · ${sorted.length} 条`, ...shown.length === 0 ? ["(无匹配待办)"] : shown.map(todoLine)].join("\n"),
				truncated: false,
				data: {
					kind: "todo-list",
					ready: true,
					list: clipJson(shown, { maxChars: budget.maxMetaChars }),
					total: sorted.length,
					library: libraryMeta(binding)
				}
			};
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_todo_create",
		description: "Create a todo in the 待办任务库 (auto-provisions the library on first use). Idempotent: pass todoId to adopt an existing todo instead of creating a duplicate. Tags aggregate freely (#项目 #群名 …).",
		parameters: {
			title: {
				type: "string",
				required: true,
				description: "Todo title."
			},
			todoId: {
				type: "string",
				description: "Explicit stable id (T-YYYYMMDD-NNN); when it already exists the existing todo is returned unchanged (idempotent)."
			},
			assignee: {
				type: "string",
				description: "Assignee name (resolved to 姓名(openId) when the directory match is unique) or a preformatted 姓名(openId) value."
			},
			ddl: {
				type: "string",
				description: "Deadline as YYYY-MM-DD or YYYY/MM/DD."
			},
			priority: {
				type: "string",
				enum: [
					"P0",
					"P1",
					"P2"
				],
				description: "Priority."
			},
			tags: {
				type: "array",
				items: { type: "string" },
				description: "Tags for aggregation (project, group, theme…); # prefixes are stripped and normalized."
			},
			refs: {
				type: "array",
				items: { type: "string" },
				description: "Referenced Yunzhijia ref tokens (yzj:... from dragged/@-picked chips) this todo originates from; recorded in the progress log and shown on the confirmation card. Never sent to the CLI."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs * 3,
		isConcurrencySafe: () => false,
		async execute(args) {
			let result;
			try {
				result = await coreCreate(ctx, budget, config, cache, {
					title: args.title,
					todoId: args.todoId,
					assignee: args.assignee,
					ddl: args.ddl,
					priority: args.priority,
					tags: args.tags,
					refs: args.refs
				}, holder);
			} catch (error) {
				return {
					content: `yzj todo create failed: ${String(error.message)}`,
					truncated: false,
					data: {}
				};
			}
			if (result.idempotent && result.todo !== null) return {
				content: `已存在（幂等命中，未重复创建）：${todoLine(result.todo)}`,
				truncated: false,
				data: {
					kind: "todo-create",
					idempotentHit: true,
					todoId: result.todo.todoId,
					todo: clipJson(result.todo, { maxChars: budget.maxMetaChars }),
					library: libraryMeta(result.binding)
				}
			};
			const todo = result.todo;
			return {
				content: [`created 待办 ${todo?.todoId ?? ""} · ${args.title.trim()}${(args.tags ?? []).length > 0 ? ` · ${formatTags(normalizeTags(args.tags))}` : ""}${result.assigneeNote}`, `任务库 ${result.binding.link}`].join("\n"),
				truncated: false,
				data: {
					kind: "todo-create",
					todoId: todo?.todoId ?? "",
					title: args.title.trim(),
					tags: normalizeTags(args.tags),
					assignee: args.assignee ?? "",
					ddl: args.ddl === void 0 ? "" : normalizeDdl(args.ddl),
					priority: args.priority ?? "",
					refs: args.refs ?? [],
					library: libraryMeta(result.binding)
				}
			};
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_todo_update",
		description: "Update one todo by todoId: status (state machine enforced), assignee, ddl, priority, tags (replaced), plus an optional appendLog note. The progress log is appended host-side and cannot be rewritten.",
		parameters: {
			todoId: {
				type: "string",
				required: true,
				description: "Stable todo id (from yzj_todo_list)."
			},
			status: {
				type: "string",
				enum: [
					"pending",
					"in_progress",
					"done"
				],
				description: "New status; legal moves: pending→in_progress, in_progress↔pending/done, done→in_progress. pending→done must use yzj_todo_complete."
			},
			assignee: {
				type: "string",
				description: "New assignee (name resolved when unique, or 姓名(openId))."
			},
			ddl: {
				type: "string",
				description: "New deadline (YYYY-MM-DD or YYYY/MM/DD)."
			},
			priority: {
				type: "string",
				enum: [
					"P0",
					"P1",
					"P2"
				],
				description: "New priority."
			},
			tags: {
				type: "array",
				items: { type: "string" },
				description: "Replacement tag set."
			},
			appendLog: {
				type: "string",
				description: "Optional note appended to the progress log with a timestamp."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs * 3,
		isConcurrencySafe: () => false,
		async execute(args) {
			let binding;
			try {
				binding = await resolveLibrary(ctx, budget, config, cache, false, holder);
			} catch (error) {
				return {
					content: `yzj todo update failed: ${String(error.message)}`,
					truncated: false,
					data: {}
				};
			}
			const existing = await fetchTodoByTodoId(ctx, budget, binding, args.todoId);
			if (existing === void 0) throw new Error(`yzj_todo_update: 待办 ${args.todoId} 不存在；先用 yzj_todo_list 查真实 id，不要猜测`);
			const changes = [];
			const fields = {};
			if (args.status !== void 0 && args.status !== existing.status) {
				const violation = checkTransition(existing.status, args.status);
				if (violation !== null) throw new Error(`yzj_todo_update: ${violation}`);
				fields[F.status] = args.status;
				changes.push(`状态 ${existing.status}→${args.status}`);
			}
			if (args.assignee !== void 0 && args.assignee.trim() !== "") {
				const resolved = await resolveAssignee(ctx, budget, args.assignee);
				fields[F.assignee] = resolved.value;
				changes.push(`负责人→${resolved.value}`);
			}
			if (args.ddl !== void 0 && args.ddl.trim() !== "") {
				const ddl = normalizeDdl(args.ddl);
				fields[F.ddl] = ddl;
				changes.push(`DDL→${ddl}`);
			}
			if (args.priority !== void 0) {
				fields[F.priority] = args.priority;
				changes.push(`优先级→${args.priority}`);
			}
			if (args.tags !== void 0) {
				const tags = normalizeTags(args.tags);
				if (tags.length > 0) fields[F.tags] = formatTags(tags);
				changes.push(`标签→${formatTags(tags)}`);
			}
			if (changes.length === 0 && args.appendLog === void 0) return {
				content: `无变更：${todoLine(existing)}`,
				truncated: false,
				data: {
					kind: "todo-update",
					todoId: args.todoId,
					changes: []
				}
			};
			const logLines = [];
			if (changes.length > 0) logLines.push(`${nowStamp()} ${changes.join("；")}`);
			if (args.appendLog !== void 0 && args.appendLog.trim() !== "") logLines.push(`${nowStamp()} 备注 ${args.appendLog.trim()}`);
			if (logLines.length > 0) fields[F.log] = appendLog(existing.log, logLines.join("\n"));
			const wrote = await writeRecords(ctx, budget, "sheet record update", binding, JSON.stringify([{
				id: existing.recordId,
				fieldsValue: fields
			}]));
			if (!wrote.ok) return {
				content: wrote.content,
				truncated: false,
				data: {}
			};
			return {
				content: `updated 待办 ${args.todoId}${changes.length > 0 ? `（${changes.join("；")}）` : "（追加日志）"}\n任务库 ${binding.link}`,
				truncated: false,
				data: {
					kind: "todo-update",
					todoId: args.todoId,
					title: existing.title,
					statusFrom: existing.status,
					statusTo: args.status ?? existing.status,
					changes,
					library: libraryMeta(binding)
				}
			};
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_todo_complete",
		description: "Complete a todo from any state (sets 状态=done and appends a log line); reopening is yzj_todo_update with status in_progress.",
		parameters: {
			todoId: {
				type: "string",
				required: true,
				description: "Stable todo id."
			},
			note: {
				type: "string",
				description: "Optional completion note appended to the log."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs * 3,
		isConcurrencySafe: () => false,
		async execute(args) {
			let result;
			try {
				result = await coreSetStatus(ctx, budget, config, cache, args.todoId, "done", args.note, holder);
			} catch (error) {
				return {
					content: `yzj todo complete failed: ${String(error.message)}`,
					truncated: false,
					data: {}
				};
			}
			if (!result.changed) return {
				content: `已是完成态（幂等命中）：${todoLine(result.todo)}`,
				truncated: false,
				data: {
					kind: "todo-complete",
					idempotentHit: true,
					todoId: args.todoId
				}
			};
			return {
				content: `completed 待办 ${args.todoId} · ${result.todo.title}\n任务库 ${result.binding.link}`,
				truncated: false,
				data: {
					kind: "todo-complete",
					todoId: args.todoId,
					title: result.todo.title,
					statusFrom: result.from,
					statusTo: "done",
					library: libraryMeta(result.binding)
				}
			};
		}
	}));
}
/**
* Durable per-group scan cursors for AI推进 auto-discovery
* (docs/spec/ai-advance-design.md §14 / 决策 18). Host owns the cursor so
* the model cannot rewind or skip. Memory-backed until `open()` — same
* pattern as HomeBindingStore / SurfaceStore.
* @module @dsh-yzj/tool-yzj/scan-cursors
*/
const cursorSchema = z$1.object({
	lastMsgId: z$1.string().min(1),
	scannedAt: z$1.number().int(),
	groupName: z$1.string()
});
const patrolSchema = z$1.object({
	scannedAt: z$1.number().int(),
	found: z$1.number().int()
});
const dirCursorSchema = z$1.object({
	knownDocs: z$1.record(z$1.string(), z$1.string()),
	scannedAt: z$1.number().int(),
	label: z$1.string()
});
/** Durable domain: groupId → cursor + last-patrol meta + dir:<docId> → doc snapshot. */
const yzjAdvanceScanDomainSpec = defineDomain({
	name: "yzj_advance_scan_cursors",
	version: 0,
	tables: {
		cursors: domainTable(cursorSchema),
		meta: domainTable(patrolSchema),
		dirs: domainTable(dirCursorSchema)
	}
});
const LAST_KEY = "last";
/**
* Read/write face over the opened domain. Until `open()`, methods use the
* in-memory maps so tests and early calls never block on the hub.
*/
var ScanCursorStore = class {
	table;
	meta;
	dirs;
	memoryCursors = /* @__PURE__ */ new Map();
	memoryDirs = /* @__PURE__ */ new Map();
	memoryPatrol;
	/**
	* Open (or adopt) the domain; safe to await repeatedly.
	* @param facility - the `ctx.storageDomain` facility.
	*/
	async open(facility) {
		if (this.table !== void 0) return;
		const domain = await facility.open(yzjAdvanceScanDomainSpec);
		this.table = domain.table("cursors");
		this.meta = domain.table("meta");
		this.dirs = domain.table("dirs");
		for (const [key, value] of this.memoryCursors) await this.table.put(key, value);
		this.memoryCursors.clear();
		for (const [key, value] of this.memoryDirs) await this.dirs.put(key, value);
		this.memoryDirs.clear();
		if (this.memoryPatrol !== void 0) {
			await this.meta.put(LAST_KEY, this.memoryPatrol);
			this.memoryPatrol = void 0;
		}
	}
	/** One group's cursor, or undefined. */
	get(groupId) {
		return this.table?.get(groupId) ?? this.memoryCursors.get(groupId);
	}
	/** Persist one group's cursor. */
	async put(groupId, value) {
		if (this.table !== void 0) {
			await this.table.put(groupId, value);
			return;
		}
		this.memoryCursors.set(groupId, value);
	}
	/** Every persisted cursor (durable table when open, else memory). */
	entries() {
		if (this.table !== void 0) {
			const rows = [];
			for (const [key, value] of this.table.entries()) rows.push([key, value]);
			return rows;
		}
		return [...this.memoryCursors.entries()];
	}
	/** Last patrol wave, or undefined when never scanned. */
	lastPatrol() {
		return this.meta?.get(LAST_KEY) ?? this.memoryPatrol;
	}
	/** Record a patrol wave (found = new signals after self/robot filter). */
	async recordPatrol(found, at = Date.now()) {
		const value = {
			scannedAt: at,
			found
		};
		if (this.meta !== void 0) {
			await this.meta.put(LAST_KEY, value);
			return;
		}
		this.memoryPatrol = value;
	}
	/** One directory thread's snapshot cursor, or undefined. */
	getDir(key) {
		return this.dirs?.get(key) ?? this.memoryDirs.get(key);
	}
	/** Persist one directory thread's snapshot. */
	async putDir(key, value) {
		if (this.dirs !== void 0) {
			await this.dirs.put(key, value);
			return;
		}
		this.memoryDirs.set(key, value);
	}
};
/** Project the store into the panel RPC shape. */
function scanStateOf(store) {
	const patrol = store.lastPatrol();
	return {
		scannedAt: patrol?.scannedAt ?? null,
		found: patrol?.found ?? 0,
		groups: store.entries().map(([groupId, cursor]) => ({
			groupId,
			groupName: cursor.groupName,
			lastMsgId: cursor.lastMsgId,
			scannedAt: cursor.scannedAt
		}))
	};
}
/**
* Intent-thread subscription registry for advancement items (spec §15.2,
* 决策 20). One advancement item subscribes to N data channels ("上下文来源" / context sources; pre-v1.8 name "意图线程");
* the registry maps advanceId → thread rows. `im:` threads are persistent
* channels (cursor-based incremental scan, spec §15.3); `doc:` / `todo:` /
* `event:` / `file:` threads are single-document sources (association lands
* one 事元, content-update detection is out of scope for ③.2). Host-owned
* storage-domain `yzj_advance_threads` — the dbt double table is untouched.
* Memory-backed until `open()` — same pattern as ScanCursorStore.
* @module @dsh-yzj/tool-yzj/advance-sources
*/
/** Literal token grammar: `im:<groupId>` / `doc:<docId>` / `dir:<docId>` / … (spec §15.2). */
const SOURCE_TOKEN_RE = /^(im|doc|todo|event|file|dir):([A-Za-z0-9_-]+)$/;
/** Parsed thread token; undefined when the grammar does not match. */
function parseSourceToken(token) {
	const match = SOURCE_TOKEN_RE.exec(token.trim());
	if (match === null) return void 0;
	return {
		prefix: match[1],
		id: match[2] ?? ""
	};
}
/** Thread class of one prefix: `im:` and `dir:` are persistent, the rest document. */
function sourceKindOf(prefix) {
	if (prefix === "im" || prefix === "dir") return "persistent";
	if (prefix === "doc" || prefix === "todo" || prefix === "event" || prefix === "file") return "document";
}
/** 事元 `来源类型` a single-document source token maps to (spec §15.1). */
function sourceTypeOfToken(prefix) {
	if (prefix === "todo") return "待办";
	if (prefix === "event") return "日程";
	return "文档";
}
const sourceSchema = z$1.object({
	token: z$1.string().min(1),
	kind: z$1.enum(["persistent", "document"]),
	label: z$1.string(),
	addedBy: z$1.enum(["user", "agent"]),
	addedAt: z$1.number().int()
});
const sourceListSchema = z$1.array(sourceSchema);
/** Durable domain: advanceId → subscribed context-source rows. */
const yzjAdvanceSourcesDomainSpec = defineDomain({
	name: "yzj_advance_sources",
	version: 0,
	tables: { sources: domainTable(sourceListSchema) }
});
/** Legacy domain (pre-v1.8 name `yzj_advance_threads`); read once for migration. */
const legacyThreadsDomainSpec = defineDomain({
	name: "yzj_advance_threads",
	version: 0,
	tables: { threads: domainTable(sourceListSchema) }
});
/**
* Read/write face over the opened domain. Until `open()`, methods use the
* in-memory map so tests and early calls never block on the hub. Adding an
* already-subscribed token is a no-op (idempotent; 决策 19 dedupes the
* document-source 事元 through refs).
*/
var ContextSourceStore = class {
	table;
	memory = /* @__PURE__ */ new Map();
	/**
	* Open (or adopt) the domain; safe to await repeatedly.
	* @param facility - the `ctx.storageDomain` facility.
	*/
	async open(facility) {
		if (this.table !== void 0) return;
		const domain = await facility.open(yzjAdvanceSourcesDomainSpec);
		this.table = domain.table("sources");
		for (const [key, value] of this.memory) await this.table.put(key, value);
		this.memory.clear();
		try {
			const oldTable = (await facility.open(legacyThreadsDomainSpec)).table("threads");
			if (![...this.table.entries()].some(([, rows]) => rows.length > 0)) {
				for (const [key, rows] of oldTable.entries()) if (rows.length > 0) await this.table.put(key, rows);
			}
		} catch {}
	}
	/** One item's subscribed context sources (insertion order), [] when none. */
	sourcesOf(advanceId) {
		return this.table?.get(advanceId) ?? this.memory.get(advanceId) ?? [];
	}
	/** Subscribe one source; duplicate tokens return `added: false`. */
	async add(advanceId, source) {
		const current = this.sourcesOf(advanceId);
		if (current.some((row) => row.token === source.token)) return {
			added: false,
			sources: current
		};
		const next = [...current, source];
		await this.persist(advanceId, next);
		return {
			added: true,
			sources: next
		};
	}
	/** Unsubscribe one token; unknown tokens leave the row list unchanged. */
	async remove(advanceId, token) {
		const current = this.sourcesOf(advanceId);
		const next = current.filter((row) => row.token !== token);
		if (next.length === current.length) return current;
		await this.persist(advanceId, next);
		return next;
	}
	/** Every item carrying at least one thread (durable table when open). */
	entries() {
		if (this.table !== void 0) {
			const rows = [];
			for (const [key, value] of this.table.entries()) rows.push([key, value]);
			return rows;
		}
		return [...this.memory.entries()];
	}
	async persist(advanceId, threads) {
		if (this.table !== void 0) {
			await this.table.put(advanceId, threads);
			return;
		}
		this.memory.set(advanceId, threads);
	}
};
/**
* AI推进 (advancement) tool family — the event-sourced "推进事项" aggregate
* described by docs/spec/ai-advance-design.md. One advancement item is a
* fold of an append-only 事元 (source-unit) stream: every change (goal
* update, progress, deviation, decision request, stage move) is one entry
* carrying traceable refs; the item row only caches the projection. The
* stream is never truncated at the storage layer (hard requirement ②) —
* only model digests and panel first-screens are windowed.
*
* Demo-stage backend: two tables (「事项」/「事元」) inside the same
* 待办任务库 dbt used by the todo family, so the panel library switcher and
* team-library semantics apply unchanged. All invariants (stable ids, the
* six-stage machine, append-only entries, projection folding) live host-side
* so a native backend can replace the sheet adapter without changing the
* tool surface.
*/
/** Field names of the 「事项」 (advancement item) table. */
const ITEM_F = {
	id: "advance_id",
	title: "名称",
	goal: "描述",
	assignee: "负责人",
	targetDate: "目标日期",
	stage: "阶段",
	background: "任务背景",
	metrics: "成功指标",
	tags: "标签",
	latest: "最新动态",
	source: "来源"
};
/** Field names of the 「事元」 (source-unit entry) table. */
const ENTRY_F = {
	id: "entry_id",
	advanceId: "advance_id",
	at: "时间",
	sourceType: "来源类型",
	changeType: "变化类型",
	summary: "摘要",
	detail: "变化内容",
	refs: "引用",
	actor: "操作者"
};
const ITEM_TABLE = "事项";
const ENTRY_TABLE = "事元";
/**
* v1.8 storage switch (决策 36): 'sqlite' = local SQLite via node:sqlite
* (real-device default; zero cloud dependency after the 多维表格 record
* service proved intermittently unavailable); 'dbt' = cloud 多维表格
* (tests + legacy). Tests never call setAdvanceBackend, so they stay on
* the dbt path with the existing FakeStore mocks.
*/
let advanceBackend = "dbt";
function setAdvanceBackend(next) {
	advanceBackend = next;
}
/** Binding placeholder for the local backend (no cloud doc). */
const LOCAL_BINDING = {
	docId: "local-sqlite",
	itemTableId: 0,
	entryTableId: 1,
	link: ""
};
const ADVANCE_STAGES = [
	"draft",
	"running",
	"decision-needed",
	"updated",
	"ready-for-review",
	"completed",
	"cancelled"
];
/** Terminal stages the agent may never stageTo — the user enters them via panel judge (决策 27; spec §13.5, host-enforced). */
const USER_ONLY_STAGES = ["completed", "cancelled"];
/** Open = neither terminal (completed/cancelled) — the queue/digest/scan-subscription scope. */
function isOpenStage(stage) {
	return stage !== "completed" && stage !== "cancelled";
}
/** Legal next stages from each node (same table as {@link checkStageTransition}). */
const STAGE_NEXT = {
	draft: ["running", "cancelled"],
	running: [
		"decision-needed",
		"ready-for-review",
		"draft",
		"cancelled"
	],
	"decision-needed": [
		"running",
		"updated",
		"cancelled"
	],
	updated: [
		"running",
		"ready-for-review",
		"cancelled"
	],
	"ready-for-review": [
		"completed",
		"running",
		"cancelled"
	],
	completed: ["running"],
	cancelled: ["running"]
};
/** 事元 source types (工作现场 provenance). */
const SOURCE_TYPES = [
	"对话",
	"待办",
	"文档",
	"会议",
	"日程",
	"数据",
	"人工"
];
/** 事元 change types (what this entry did to the item). */
const CHANGE_TYPES = [
	"目标更新",
	"进度更新",
	"偏差",
	"决策请求",
	"验收请求",
	"阶段变化",
	"备注"
];
function legalNextStages(from) {
	if (!ADVANCE_STAGES.includes(from)) return [];
	return STAGE_NEXT[from];
}
/**
* Validate a stage transition; returns an error message or null.
* running is the quiet steady state; decision-needed→updated is the minimal
* advance loop and may fire repeatedly.
*/
function checkStageTransition(from, to) {
	if (from === to) return null;
	if (legalNextStages(from).includes(to)) return null;
	return `状态机拒绝 ${from} → ${to}：合法流转为 draft→running→(decision-needed→updated)*→ready-for-review→completed；ready-for-review/decision-needed 可打回 running，completed/cancelled 可重开 running；非终态可中止 cancelled`;
}
const INSPECT_DISCIPLINE = [
	"纪律：running 无偏差则不要 feed（静默）。已记录事实的复述连事元都不写。",
	"打扰判据（命中任一条才 stageTo=decision-needed）：① 新信号与任务背景的前提矛盾；② 任一成功指标由达标转未达标或朝远离目标移动；③ 按当前速度在目标日期前补不上差距；④ 出现明确阻塞威胁目标日期；⑤ 继续推进须砍范围/加资源/改优先级或越红线；⑥ 两条以上都合理且会改变后续基准的路径分叉。",
	"静默判据：信号与目标一致且指标不变或朝目标移动；纯过程信息（谁在做/做到哪/附了什么产物）。",
	"抑制：同判据已在 decision-needed 未处理则补进现有决策请求、不新起；同一来源（msgId/docId）已喂过则 host 强制去重；被用户 ignore 过的判据除非指标进一步恶化不再提。",
	"打扰判据成立 → yzj_advance_feed changeType=决策请求 stageTo=decision-needed：summary=要用户决定的问题；detail=问题分析（多行）+ 动作行（每行一个，可多个，用户在看板一键执行，决策 41）：`动作: 建待办 | 内容: <标题> | 截止: <yyyy-MM-dd> | 负责人: <名字>`、`动作: 发消息 | 内容: <草稿>`、`动作: 定会议 | 主题: <主题> | 时间: <yyyy-MM-dd HH:mm>`（键可省）。host 强制：stageTo=decision-needed 必须配决策请求。",
	"偏差（changeType=偏差）只记录指标未达标等事实，不推阶段；需要人拍板的一律走决策请求。",
	"产物齐且指标 N/N 达标且无未决偏差 → changeType=验收请求 stageTo=ready-for-review。",
	"确认卡只在改基准（goal/metrics/targetDate/assignee）时出现；纯追加与阶段变化静默落，人在看板队列被找到。",
	"禁止 stageTo=completed/cancelled；终局只由用户在看板拍板（确认达到目标/中止推进）。",
	"抽取分发（v1.8 收敛，决策 35）：巡检是 host 机械 routine（增量入池，无模型）；模型只在 Dream 抽取时出场——读池 pending 清单，按「信号 ∈ 哪个事项的上下文来源 + 语义相关」逐条比对提炼，有价值的落事元/建议卡，处理完 dream_mark 出池。",
	"最小回路：核心变量对比（原来的理解 vs 现在的约束）→ 建议（AI建议+备选+自定义）→ 用户选择 → 复述影响 → 确认后才 feed。",
	"终局沉淀：事项进 completed/cancelled 后，用户可能说「复盘一下」——沉淀四步：yzj_advance_get 翻页读全量事元 → 按复盘模板（docs/spec/advance-review-template.md：目标演化/关键决策/偏差与证据链/下一步/事元索引）写 markdown → yzj_doc_import 入「我的知识/推进复盘/<事项名>」→ 回链 feed 一条产物事元（refs=[复盘 docId]，纯追加静默）。会议纪要出口同理（纪要四步：读转录 → 金蝶四段式目标/内容/共识/下一步 → 入库 → 下一步挂事项回链 refs）。"
].join("\n");
/**
* Model-facing inspect digest. Host does not judge semantics (spec §12 / 决策 11).
*/
function buildInspectDigest(args) {
	const head = args.mode === "review" ? "验收辅助材料（对照成功指标给一句话结论，不要自动过）" : "比对材料（核心变量：原来的理解 vs 新信号）";
	if (args.subjects.length === 0) return [
		head,
		"没有 open 推进事项。无偏差，静默。",
		INSPECT_DISCIPLINE
	].join("\n");
	return [
		head,
		args.signals.trim() === "" ? "新信号：（无，巡检请先拉近期群消息/纪要再比对）" : `新信号：${args.signals.trim()}`,
		...args.subjects.map(({ item, recent }) => {
			const next = legalNextStages(item.stage).join(" / ") || "（无）";
			const rec = recent.length === 0 ? "（暂无事元）" : recent.map((entry) => `${entry.at} ${entry.changeType} ${entry.summary}`).join("\n  ");
			return [
				`${item.advanceId} · ${item.title} [${item.stage}]`,
				item.goal === "" ? "目标：（空）" : `目标：${item.goal}`,
				item.background === "" ? "背景（原来的理解）：（空）" : `背景（原来的理解）：${item.background}`,
				item.metrics === "" ? "成功指标：（空）" : `成功指标：${item.metrics.split("\n").join("；")}`,
				`合法下一阶段：${next}`,
				`最近事元：\n  ${rec}`
			].join("\n");
		}),
		INSPECT_DISCIPLINE
	].join("\n---\n");
}
/** Self or robot sender — skip to avoid self-reinforcing the patrol. */
function isSkippableSender(fromOpenId, selfOpenId) {
	if (fromOpenId === "") return false;
	if (selfOpenId !== "" && fromOpenId === selfOpenId) return true;
	return fromOpenId.startsWith("BOT-");
}
/**
* True when the incoming refs form exactly the same set as the entry's refs
* AND the changeType matches — a genuine replay of the same signal (决策 25,
* 修订决策 19 的交集语义). Partial overlap is NOT a replay: distinct entries
* may legitimately cite the same document (e.g. one 纪要 ref feeding both a
* progress note and a later goal update — the 830 experiment hit this).
*/
function isRefReplay(incoming, changeType, entry) {
	if (incoming.length === 0 || entry.refs.length !== incoming.length) return false;
	if (entry.changeType !== changeType) return false;
	const have = new Set(entry.refs.filter((token) => token !== ""));
	return incoming.every((token) => token !== "" && have.has(token));
}
/** Refs shared between the incoming feed and the existing stream (for the overlap hint). */
function overlappedRefsOf(incoming, existing) {
	if (incoming.length === 0) return [];
	const incomingSet = new Set(incoming.filter((token) => token !== ""));
	const shared = /* @__PURE__ */ new Set();
	for (const entry of existing) for (const ref of entry.refs) if (ref !== "" && incomingSet.has(ref)) shared.add(ref);
	return [...shared];
}
function imMessageLine(signal) {
	const time = signal.sendTime.length >= 16 ? signal.sendTime.slice(5, 16) : signal.sendTime;
	const who = signal.fromOpenId === "" ? "(unknown)" : signal.fromOpenId;
	const body = signal.content === "" ? "(message)" : signal.content.replace(/\s+/g, " ").slice(0, 80);
	return `[${time}] ${signal.groupName} ${who} ${body} <im:${signal.groupId}:${signal.msgId}>`;
}
/** One digest line for a signal; dir signals are document deltas, not chat rows. */
function scanSignalLine(signal) {
	if (signal.kind === "dir") return `[${signal.sendTime.length >= 16 ? signal.sendTime.slice(5, 16) : signal.sendTime}] 目录「${signal.groupName}」${signal.content} <${signal.msgId}>`;
	return imMessageLine(signal);
}
/** Model-facing scan digest (spec §14.2). */
function buildScanDigest(result) {
	const groupLines = result.groups.map((group) => {
		if (group.error !== void 0) return `${group.groupName}（${group.groupId}）：${group.error}`;
		if (group.baseline) return `${group.groupName}：基线已立（不回灌历史）`;
		if (group.newCount === 0) return `${group.groupName}：无新消息，静默`;
		return `${group.groupName}：${group.newCount} 条新信号`;
	});
	const signalLines = result.signals.length === 0 ? ["新信号：（无）"] : ["新信号：", ...result.signals.map(scanSignalLine)];
	const items = result.openItems.length === 0 ? "open 事项：（无）" : `open 事项：${result.openItems.map((item) => `${item.advanceId} · ${item.title} [${item.stage}]`).join("；")}`;
	const subscriptionLines = result.subscriptions.length === 0 ? [] : ["订阅清单（分发按线程 + 语义相关）：", ...result.subscriptions.map((row) => `${row.advanceId} · ${row.title} [${row.stage}] → ${row.tokens.length === 0 ? "（无线程）" : row.tokens.join("，")}`)];
	const next = result.signals.length === 0 ? "下一步：本轮无新信号。" : "下一步：信号已由 host 巡检自动入蓄水池；抽取走 Dream 三径（yzj_advance_dream_status 读池 → 提炼 → dream_mark）。";
	return [
		"巡检扫描",
		...groupLines,
		...signalLines,
		items,
		...subscriptionLines,
		next
	].join("\n");
}
function parseImMessage(record) {
	const message = asRecord(record);
	const fromUser = asRecord(message.fromUser);
	return {
		msgId: asString(message.msgId ?? message.id),
		fromOpenId: asString(message.fromOpenId ?? fromUser.openId ?? fromUser.oId),
		content: asString(message.content),
		sendTime: asString(message.sendTime)
	};
}
async function listDirDocs(ctx, budget, dirId) {
	let workspace = dirId;
	let parentId;
	const got = await runJson(ctx, budget, "doc get", [
		"doc",
		"get",
		"--id",
		dirId
	]);
	if (got.ok) {
		const kb = asString(asRecord(got.json).kbId);
		if (kb !== "") {
			workspace = kb;
			parentId = dirId;
		}
	}
	const args = [
		"doc",
		"list",
		"--workspace",
		workspace
	];
	if (parentId !== void 0) args.push("--parent-id", parentId);
	const ran = await runJson(ctx, budget, "doc list", args);
	if (!ran.ok) throw new Error(`doc list 目录 ${dirId} 失败：${ran.content}`);
	const rows = asArray(ran.json).length > 0 ? asArray(ran.json) : asArray(asRecord(ran.json).list);
	const out = [];
	for (const row of rows) {
		const node = asRecord(row);
		const id = asString(node.id);
		if (id === "") continue;
		out.push({
			id,
			title: asString(node.title),
			updateTime: asString(node.updateTime)
		});
	}
	return out;
}
/** Scan one dir: thread (决策 32): first visit snapshots, later visits surface new/updated docs as signals. */
async function scanDirThread(ctx, budget, cursors, dir, signals, groupResults, now, pool) {
	const key = `dir:${dir.id}`;
	const name = dir.label === "" ? dir.id : dir.label;
	try {
		const docs = await listDirDocs(ctx, budget, dir.id);
		const prior = cursors.getDir(key);
		const snapshot = {};
		for (const doc of docs) snapshot[doc.id] = doc.updateTime;
		if (prior === void 0) {
			await cursors.putDir(key, {
				knownDocs: snapshot,
				scannedAt: now,
				label: name
			});
			groupResults.push({
				groupId: key,
				groupName: name,
				baseline: true,
				newCount: 0
			});
			return;
		}
		const known = prior.knownDocs;
		const fresh = docs.filter((doc) => !(doc.id in known) || known[doc.id] !== doc.updateTime);
		for (const doc of fresh) {
			signals.push({
				kind: "dir",
				groupId: key,
				groupName: name,
				msgId: doc.id,
				fromOpenId: "",
				content: `${doc.id in known ? "更新" : "新增"}文档《${doc.title}》`,
				sendTime: doc.updateTime
			});
			await pool?.enqueue({
				channel: key,
				refId: doc.id,
				content: `${doc.id in known ? "更新" : "新增"}文档《${doc.title}》`,
				sendTime: doc.updateTime
			});
		}
		await cursors.putDir(key, {
			knownDocs: snapshot,
			scannedAt: now,
			label: name
		});
		groupResults.push({
			groupId: key,
			groupName: name,
			baseline: false,
			newCount: fresh.length
		});
	} catch (error) {
		groupResults.push({
			groupId: key,
			groupName: name,
			baseline: false,
			newCount: 0,
			error: String(error.message)
		});
	}
}
async function whoamiOpenId(ctx, budget) {
	const ran = await runJson(ctx, budget, "contact user get", [
		"contact",
		"user",
		"get"
	]);
	if (!ran.ok) return "";
	const direct = asArray(ran.json);
	const list = direct.length > 0 ? direct : asArray(asRecord(ran.json).list);
	const first = list.length > 0 ? asRecord(list[0]) : asRecord(ran.json);
	return asString(first.openId ?? first.oId);
}
async function listRecentGroups(ctx, budget) {
	const out = [];
	for (const page of [
		1,
		2,
		3
	]) {
		const ran = await runJson(ctx, budget, "im group recent", [
			"im",
			"group",
			"recent",
			"--limit",
			"20",
			"--page",
			String(page)
		]);
		if (!ran.ok) break;
		const payload = asRecord(ran.json);
		const rows = asArray(payload.list);
		for (const row of rows) {
			const group = asRecord(row);
			const groupId = asString(group.groupId);
			if (groupId === "") continue;
			out.push({
				groupId,
				groupName: asString(group.groupName) || groupId
			});
		}
		if (payload.more !== true || rows.length === 0) break;
	}
	return out;
}
function resolveGroupToken(token, catalog) {
	const trimmed = token.trim();
	if (trimmed === "") return void 0;
	const exactId = catalog.find((row) => row.groupId === trimmed);
	if (exactId !== void 0) return exactId;
	const exactName = catalog.filter((row) => row.groupName === trimmed);
	if (exactName.length === 1) return exactName[0];
	const partial = catalog.filter((row) => row.groupName.includes(trimmed));
	if (partial.length === 1) return partial[0];
}
async function listImMessages(ctx, budget, groupId, type, msgId, limit) {
	const command = [
		"im",
		"message",
		"list",
		"--group-id",
		groupId,
		"--type",
		type,
		"--limit",
		String(limit)
	];
	if (msgId !== void 0) command.push("--msg-id", msgId);
	const ran = await runJson(ctx, budget, "im message list", command);
	if (!ran.ok) throw new Error(ran.content);
	return asArray(asRecord(ran.json).list);
}
/**
* Read the full incremental window after `msgId` (type=new), paging until a
* short page or the cap. Fixes the 830-experiment gap: one page of 20 silently
* dropped later signals when a group moved >20 messages between patrols.
*/
async function listImMessagesAll(ctx, budget, groupId, afterMsgId, pageSize) {
	const out = [];
	let after = afterMsgId;
	for (let page = 0; page * pageSize < 200; page += 1) {
		const rows = await listImMessages(ctx, budget, groupId, "new", after, pageSize);
		if (rows.length === 0) break;
		out.push(...rows);
		if (rows.length < pageSize) break;
		const last = asRecord(rows[rows.length - 1]);
		const next = asString(last.msgId ?? last.id);
		if (next === "" || next === after) break;
		after = next;
	}
	return out;
}
function newestMsgId(rows) {
	let best = "";
	let bestTime = "";
	for (const row of rows) {
		if (row.msgId === "") continue;
		if (best === "" || row.sendTime >= bestTime) {
			best = row.msgId;
			bestTime = row.sendTime;
		}
	}
	return best;
}
/**
* Incremental IM scan for the patrol loop (spec §14). First visit of a
* group records a baseline cursor and returns no signals; later visits
* return messages after the cursor, minus self/robot.
*/
async function coreScanAdvance(ctx, budget, config, caches, cursors, groups, limit = 20, holder, sources, pool) {
	let effective = groups;
	let preItems;
	let scanDirs = [];
	if (effective.length === 0) {
		if (sources === void 0) throw new Error("advance scan: groups must not be empty (no source registry)");
		preItems = (await fetchItems(ctx, budget, await resolveAdvance(ctx, budget, config, caches, false, holder))).filter((item) => isOpenStage(item.stage)).map((item) => ({
			advanceId: item.advanceId,
			title: item.title,
			stage: item.stage
		}));
		const openIds = new Set(preItems.map((item) => item.advanceId));
		const channelIds = /* @__PURE__ */ new Set();
		const dirIds = /* @__PURE__ */ new Map();
		for (const [advanceId, rows] of sources.entries()) {
			if (!openIds.has(advanceId)) continue;
			for (const row of rows) {
				const parsed = parseSourceToken(row.token);
				if (parsed === void 0) continue;
				if (parsed.prefix === "im") channelIds.add(parsed.id);
				if (parsed.prefix === "dir") dirIds.set(parsed.id, row.label);
			}
		}
		if (channelIds.size === 0 && dirIds.size === 0) throw new Error("advance scan: 没有 open 事项订阅 im:/dir: 来源；先在面板「关联来源」或 create sources 挂群/目录");
		if (channelIds.size > 8) throw new Error(`advance scan: 订阅渠道 ${channelIds.size} 个超过上限 8（决策 17）；请按事项分批传 groups`);
		effective = [...channelIds];
		scanDirs = [...dirIds.entries()].map(([id, label]) => ({
			id,
			label
		}));
	}
	if (effective.length > 8) throw new Error(`advance scan: at most 8 groups`);
	const pageSize = !Number.isInteger(limit) || limit < 1 || limit > 20 ? 20 : limit;
	const selfOpenId = await whoamiOpenId(ctx, budget);
	const catalog = await listRecentGroups(ctx, budget);
	const signals = [];
	const groupResults = [];
	const now = Date.now();
	for (const token of effective) {
		const resolved = resolveGroupToken(token, catalog);
		if (resolved === void 0) {
			groupResults.push({
				groupId: token,
				groupName: token,
				baseline: false,
				newCount: 0,
				error: `找不到群「${token}」；用 yzj_im_group_recent 核对 id/名`
			});
			continue;
		}
		const prior = cursors.get(resolved.groupId);
		try {
			if (prior === void 0) {
				const lastMsgId = newestMsgId((await listImMessages(ctx, budget, resolved.groupId, "newest", void 0, pageSize)).map(parseImMessage));
				if (lastMsgId !== "") await cursors.put(resolved.groupId, {
					lastMsgId,
					scannedAt: now,
					groupName: resolved.groupName
				});
				groupResults.push({
					groupId: resolved.groupId,
					groupName: resolved.groupName,
					baseline: true,
					newCount: 0
				});
				continue;
			}
			const fresh = (await listImMessagesAll(ctx, budget, resolved.groupId, prior.lastMsgId, pageSize)).map(parseImMessage).filter((row) => row.msgId !== "" && row.msgId !== prior.lastMsgId);
			const lastMsgId = newestMsgId(fresh) || prior.lastMsgId;
			const accepted = fresh.filter((row) => !isSkippableSender(row.fromOpenId, selfOpenId));
			for (const row of accepted) {
				signals.push({
					groupId: resolved.groupId,
					groupName: resolved.groupName,
					msgId: row.msgId,
					fromOpenId: row.fromOpenId,
					content: row.content,
					sendTime: row.sendTime
				});
				await pool?.enqueue({
					channel: `im:${resolved.groupId}`,
					refId: row.msgId,
					content: row.content,
					sendTime: row.sendTime
				});
			}
			await cursors.put(resolved.groupId, {
				lastMsgId,
				scannedAt: now,
				groupName: resolved.groupName
			});
			groupResults.push({
				groupId: resolved.groupId,
				groupName: resolved.groupName,
				baseline: false,
				newCount: accepted.length
			});
		} catch (error) {
			groupResults.push({
				groupId: resolved.groupId,
				groupName: resolved.groupName,
				baseline: false,
				newCount: 0,
				error: String(error.message)
			});
		}
	}
	for (const dir of scanDirs) await scanDirThread(ctx, budget, cursors, dir, signals, groupResults, now, pool);
	await cursors.recordPatrol(signals.length, now);
	let openItems;
	if (preItems !== void 0) openItems = preItems;
	else {
		openItems = [];
		try {
			openItems = (await fetchItems(ctx, budget, await resolveAdvance(ctx, budget, config, caches, false, holder))).filter((item) => isOpenStage(item.stage)).map((item) => ({
				advanceId: item.advanceId,
				title: item.title,
				stage: item.stage
			}));
		} catch {
			openItems = [];
		}
	}
	const subscriptions = sources === void 0 ? [] : openItems.map((item) => ({
		advanceId: item.advanceId,
		title: item.title,
		stage: item.stage,
		tokens: sources.sourcesOf(item.advanceId).map((row) => row.token)
	}));
	return {
		signals,
		groups: groupResults,
		openItems,
		subscriptions
	};
}
/** Timeline tone of one entry (PRD §5.3.4: 蓝=推进 绿=达标 红=偏差决策). */
function toneOf(changeType, detail) {
	if (changeType === "偏差" || changeType === "决策请求") return "red";
	if (changeType === "验收请求") return "green";
	if (changeType === "阶段变化") {
		if (/→\s*completed/.test(detail)) return "green";
		if (/→\s*decision-needed/.test(detail)) return "red";
	}
	return "blue";
}
/** Next sequential id with a day prefix (`A-YYYYMMDD-NNN` / `E-YYYYMMDD-NNN`). */
function nextSequentialId(prefixLetter, existingIds, now = /* @__PURE__ */ new Date()) {
	const prefix = `${prefixLetter}-${todayStr(now).replace(/\//g, "")}-`;
	let max = 0;
	for (const id of existingIds) {
		if (!id.startsWith(prefix)) continue;
		const n = Number.parseInt(id.slice(prefix.length), 10);
		if (Number.isInteger(n) && n > max) max = n;
	}
	return `${prefix}${String(max + 1).padStart(3, "0")}`;
}
/** Fields object from a CLI record row (fields may be a JSON string). */
function fieldsOf(record) {
	const row = asRecord(record);
	const raw = row.fieldsValue ?? row.fields ?? row.values;
	if (typeof raw === "string") try {
		return asRecord(JSON.parse(raw));
	} catch {
		return null;
	}
	return asRecord(raw);
}
/** Parse one CLI record into an item; null when unusable. */
function parseAdvanceItem(record) {
	const fields = fieldsOf(record);
	if (fields === null) return null;
	const advanceId = asString(fields[ITEM_F.id]);
	if (advanceId === "") return null;
	const stage = asString(fields[ITEM_F.stage]);
	const parsed = parseAssignee(asString(fields[ITEM_F.assignee]));
	return {
		recordId: asString(asRecord(record).id ?? asRecord(record).recordId),
		advanceId,
		title: asString(fields[ITEM_F.title]),
		goal: asString(fields[ITEM_F.goal]),
		assignee: parsed.name,
		assigneeOpenId: parsed.openId,
		targetDate: normalizeDdl(asString(fields[ITEM_F.targetDate])),
		stage: ADVANCE_STAGES.includes(stage) ? stage : "draft",
		background: asString(fields[ITEM_F.background]),
		metrics: asString(fields[ITEM_F.metrics]),
		tags: normalizeTags(asString(fields[ITEM_F.tags])),
		latest: asString(fields[ITEM_F.latest])
	};
}
/** Parse one CLI record into an entry; null when unusable. */
function parseAdvanceEntry(record) {
	const fields = fieldsOf(record);
	if (fields === null) return null;
	const entryId = asString(fields[ENTRY_F.id]);
	if (entryId === "") return null;
	const changeType = asString(fields[ENTRY_F.changeType]);
	const detail = asString(fields[ENTRY_F.detail]);
	return {
		recordId: asString(asRecord(record).id ?? asRecord(record).recordId),
		entryId,
		advanceId: asString(fields[ENTRY_F.advanceId]),
		at: asString(fields[ENTRY_F.at]),
		sourceType: asString(fields[ENTRY_F.sourceType]),
		changeType,
		summary: asString(fields[ENTRY_F.summary]),
		detail,
		refs: asString(fields[ENTRY_F.refs]).split(/\s+/).filter((token) => token !== ""),
		actor: asString(fields[ENTRY_F.actor]),
		tone: toneOf(changeType, detail)
	};
}
/** Success-metric lines parsed for the panel (`指标名: 当前 / 目标`). */
function parseMetrics(metrics) {
	const out = [];
	for (const line of metrics.split("\n")) {
		const trimmed = line.trim();
		if (trimmed === "") continue;
		const colon = trimmed.match(/^([^:：]+)[:：]\s*(.*)$/);
		if (colon === null) {
			out.push({
				name: trimmed,
				current: "",
				target: ""
			});
			continue;
		}
		const slash = (colon[2] ?? "").split("/");
		out.push({
			name: (colon[1] ?? "").trim(),
			current: (slash[0] ?? "").trim(),
			target: slash.length > 1 ? slash.slice(1).join("/").trim() : ""
		});
	}
	return out;
}
/**
* Fold the stream into the original-information panel: one row per distinct
* ref (or per source-type+summary when unreferenced) carrying the 事元 that
* cite it — 三层结构里事项引用事元、事元引用原始信息，本聚合只管后一层。
* Status from the latest citing entry — a stage-① heuristic that the phase-③
* AI judgement will replace.
*/
function aggregateSources(entries) {
	const byKey = /* @__PURE__ */ new Map();
	for (const entry of entries) {
		const key = entry.refs[0] ?? `${entry.sourceType}:${entry.summary}`;
		const status = entry.changeType === "决策请求" ? "等待中" : entry.changeType === "偏差" ? "未达标" : entry.actor === "user" ? "已确认" : "已读取";
		const citing = {
			entryId: entry.entryId,
			changeType: entry.changeType,
			summary: entry.summary
		};
		const existing = byKey.get(key);
		if (existing === void 0) byKey.set(key, {
			sourceType: entry.sourceType,
			label: entry.summary,
			ref: entry.refs[0] ?? "",
			at: entry.at,
			status,
			citing: [citing]
		});
		else byKey.set(key, {
			...existing,
			at: entry.at,
			status,
			citing: [...existing.citing, citing]
		});
	}
	return [...byKey.values()];
}
/** One `yzj_advance_list` digest line. */
function itemLine(item) {
	const parts = [
		item.advanceId,
		item.title,
		`[${item.stage}]`
	];
	if (item.targetDate !== "") parts.push(`目标 ${item.targetDate}`);
	if (item.assignee !== "") parts.push(`@${item.assignee}`);
	if (item.tags.length > 0) parts.push(formatTags(item.tags));
	if (item.latest !== "") parts.push(item.latest);
	return parts.join(" · ");
}
/** One timeline digest line. */
function entryLine(entry) {
	const parts = [
		entry.at,
		`[${entry.changeType}]`,
		entry.summary
	];
	if (entry.detail !== "") parts.push(entry.detail.split("\n").join("；"));
	if (entry.refs.length > 0) parts.push(`引用 ${entry.refs.join(" ")}`);
	return parts.join(" · ");
}
async function runJson(ctx, budget, label, command) {
	const result = await ctx.yzjBridge.run(command, { timeoutMs: budget.timeoutMs });
	if (!result.ok) return {
		ok: false,
		content: failureDigest(label, result, budget.maxRenderChars).content
	};
	return {
		ok: true,
		json: result.json
	};
}
function cliRecords(json) {
	const records = asArray(asRecord(json).records);
	return records.length > 0 ? records : asArray(json);
}
/** Table-provision field definitions (SingleSelect options pre-registered). */
function itemFieldsJson() {
	return JSON.stringify([
		{
			name: ITEM_F.id,
			type: "MultiLineText"
		},
		{
			name: ITEM_F.title,
			type: "MultiLineText"
		},
		{
			name: ITEM_F.goal,
			type: "MultiLineText"
		},
		{
			name: ITEM_F.assignee,
			type: "MultiLineText"
		},
		{
			name: ITEM_F.targetDate,
			type: "Date"
		},
		{
			name: ITEM_F.stage,
			type: "SingleSelect",
			data: { items: ADVANCE_STAGES.map((value) => ({ value })) }
		},
		{
			name: ITEM_F.background,
			type: "MultiLineText"
		},
		{
			name: ITEM_F.metrics,
			type: "MultiLineText"
		},
		{
			name: ITEM_F.tags,
			type: "MultiLineText"
		},
		{
			name: ITEM_F.latest,
			type: "MultiLineText"
		},
		{
			name: ITEM_F.source,
			type: "Url"
		}
	]);
}
function entryFieldsJson() {
	return JSON.stringify([
		{
			name: ENTRY_F.id,
			type: "MultiLineText"
		},
		{
			name: ENTRY_F.advanceId,
			type: "MultiLineText"
		},
		{
			name: ENTRY_F.at,
			type: "MultiLineText"
		},
		{
			name: ENTRY_F.sourceType,
			type: "SingleSelect",
			data: { items: SOURCE_TYPES.map((value) => ({ value })) }
		},
		{
			name: ENTRY_F.changeType,
			type: "SingleSelect",
			data: { items: CHANGE_TYPES.map((value) => ({ value })) }
		},
		{
			name: ENTRY_F.summary,
			type: "MultiLineText"
		},
		{
			name: ENTRY_F.detail,
			type: "MultiLineText"
		},
		{
			name: ENTRY_F.refs,
			type: "MultiLineText"
		},
		{
			name: ENTRY_F.actor,
			type: "MultiLineText"
		}
	]);
}
/** Locate both tables inside a doc; undefined when either is missing. */
async function advanceTablesOf(ctx, budget, docId) {
	const ran = await runJson(ctx, budget, "sheet get", [
		"sheet",
		"get",
		"--id",
		docId
	]);
	if (!ran.ok) return void 0;
	let itemTableId;
	let entryTableId;
	for (const table of asArray(asRecord(ran.json).sheets)) {
		const row = asRecord(table);
		const tableId = row.id;
		if (typeof tableId !== "number") continue;
		const names = asArray(row.fields).map((field) => asString(asRecord(field).name));
		if (names.includes(ENTRY_F.id)) entryTableId = tableId;
		else if (names.includes(ITEM_F.id) && names.includes(ITEM_F.stage)) itemTableId = tableId;
	}
	if (itemTableId === void 0 || entryTableId === void 0) return void 0;
	return {
		docId,
		itemTableId,
		entryTableId,
		link: `https://www.yunzhijia.com/knowledge/lingee/#/store/doc/${docId}`
	};
}
/**
* v1.6 cancelled option guard: SingleSelect options are pre-registered only at
* table-create time;存量推进库缺 cancelled 选项,写入未注册值会被静默丢弃
* (迁移文档 §3 事实 5 / pitfall-003)——写前校验,缺则明示引导,不静默丢。
* 实测形状(2026-08-19):sheet get → sheets[].fields[].data.items[].value。
*/
async function assertStageOption(ctx, budget, binding, value) {
	const ran = await runJson(ctx, budget, "sheet get", [
		"sheet",
		"get",
		"--id",
		binding.docId
	]);
	if (!ran.ok) return;
	for (const table of asArray(asRecord(ran.json).sheets)) {
		if (asString(asRecord(table).name) !== ITEM_TABLE) continue;
		for (const field of asArray(asRecord(table).fields)) {
			const f = asRecord(field);
			if (asString(f.name) !== ITEM_F.stage) continue;
			if (!new Set(asArray(asRecord(f.data).items).map((item) => asString(asRecord(item).value))).has(value)) throw new Error(`advance: 推进库「事项」表的阶段字段缺「${value}」选项(v1.6 新增);请在多维表格给该字段补加选项 ${value} 后重试(写入未注册选项会被静默丢弃)`);
			return;
		}
	}
}
/** Provision whichever of the two tables is missing inside the doc. */
async function provisionAdvanceTables(ctx, budget, docId) {
	const probe = await runJson(ctx, budget, "sheet get", [
		"sheet",
		"get",
		"--id",
		docId
	]);
	const names = /* @__PURE__ */ new Set();
	if (probe.ok) for (const table of asArray(asRecord(probe.json).sheets)) for (const field of asArray(asRecord(table).fields)) names.add(asString(asRecord(field).name));
	if (!names.has(ITEM_F.stage) || !names.has(ITEM_F.id)) {
		const ran = await runJson(ctx, budget, "sheet table create", [
			"sheet",
			"table",
			"create",
			"--id",
			docId,
			"--name",
			ITEM_TABLE,
			"--fields",
			itemFieldsJson(),
			"--views",
			JSON.stringify([{
				name: "全部",
				type: "Grid"
			}])
		]);
		if (!ran.ok) throw new Error(ran.content);
	}
	if (!names.has(ENTRY_F.id)) {
		const ran = await runJson(ctx, budget, "sheet table create", [
			"sheet",
			"table",
			"create",
			"--id",
			docId,
			"--name",
			ENTRY_TABLE,
			"--fields",
			entryFieldsJson(),
			"--views",
			JSON.stringify([{
				name: "全部",
				type: "Grid"
			}])
		]);
		if (!ran.ok) throw new Error(ran.content);
	}
	const binding = await advanceTablesOf(ctx, budget, docId);
	if (binding === void 0) throw new Error(`advance: 推进双表创建后未在 ${docId} 中找齐 ${ITEM_F.id}/${ENTRY_F.id} 字段`);
	return binding;
}
/**
* Resolve the advancement binding: the active 待办任务库 doc (panel override
* → config → discovery, via the todo resolver) plus the two advance tables
* inside it (provisioned on demand). A cached binding is dropped when the
* active library doc changed (library switcher follow).
*/
async function resolveAdvance(ctx, budget, config, caches, allowProvision, holder) {
	if (advanceBackend === "sqlite") {
		caches.adv.binding = LOCAL_BINDING;
		return LOCAL_BINDING;
	}
	if (holder?.override !== void 0 && caches.adv.binding !== void 0 && caches.adv.binding.docId !== holder.override.docId) {
		delete caches.adv.binding;
		delete caches.lib.binding;
	}
	let library;
	try {
		library = await resolveLibrary(ctx, budget, config, caches.lib, allowProvision, holder);
	} catch (error) {
		if (allowProvision) throw error;
		throw new Error(`advance: 推进看板尚未开通（依赖待办任务库）：${String(error.message)}`);
	}
	if (caches.adv.binding !== void 0 && caches.adv.binding.docId === library.docId) return caches.adv.binding;
	const found = await advanceTablesOf(ctx, budget, library.docId);
	if (found !== void 0) {
		caches.adv.binding = found;
		return found;
	}
	if (!allowProvision) throw new Error("advance: 推进看板尚未开通；发起第一个推进事项（yzj_advance_create）即可自动开通事项/事元双表");
	const provisioned = await provisionAdvanceTables(ctx, budget, library.docId);
	caches.adv.binding = provisioned;
	return provisioned;
}
/** Fetch every item (paged, demo scale). */
async function fetchItems(ctx, budget, binding) {
	if (advanceBackend === "sqlite") return localStore().listItems().map((row) => parseAdvanceItem({
		id: row.recordId,
		fields: row.fields
	})).filter((item) => item !== null);
	const items = [];
	let pageToken;
	for (let page = 0; page < 3; page += 1) {
		const command = [
			"sheet",
			"record",
			"list",
			"--id",
			binding.docId,
			"--table-id",
			String(binding.itemTableId),
			"--limit",
			"100"
		];
		if (pageToken !== void 0) command.push("--page-token", pageToken);
		const ran = await runJson(ctx, budget, "sheet record list", command);
		if (!ran.ok) throw new Error(ran.content);
		for (const record of cliRecords(ran.json)) {
			const item = parseAdvanceItem(record);
			if (item !== null) items.push(item);
		}
		pageToken = asString(asRecord(ran.json).page_token ?? asRecord(ran.json).next_page_token);
		if (pageToken === "") break;
	}
	return items;
}
/** Fetch one item by advance_id; undefined when absent. */
async function fetchItemById(ctx, budget, binding, advanceId) {
	if (advanceBackend === "sqlite") {
		const row = localStore().item(advanceId);
		if (row === void 0) return void 0;
		return parseAdvanceItem({
			id: row.recordId,
			fields: row.fields
		}) ?? void 0;
	}
	const filter = JSON.stringify({
		mode: "AND",
		criteria: [{
			field: ITEM_F.id,
			operator: "Equals",
			values: [advanceId]
		}]
	});
	const ran = await runJson(ctx, budget, "sheet record list", [
		"sheet",
		"record",
		"list",
		"--id",
		binding.docId,
		"--table-id",
		String(binding.itemTableId),
		"--filter",
		filter
	]);
	if (!ran.ok) throw new Error(ran.content);
	for (const record of cliRecords(ran.json)) {
		const item = parseAdvanceItem(record);
		if (item !== null) return item;
	}
}
/**
* Fetch the FULL entry stream of one item, oldest first (entry ids are
* day-sequential, so at+entryId sorts stably). Storage-side the stream is
* complete; callers window it for digests/first screens only.
*/
async function fetchEntries(ctx, budget, binding, advanceId) {
	if (advanceBackend === "sqlite") return localStore().listEntries(advanceId).map((row) => parseAdvanceEntry({
		id: row.recordId,
		fields: row.fields
	})).filter((entry) => entry !== null).sort((a, b) => a.at === b.at ? a.entryId < b.entryId ? -1 : 1 : a.at < b.at ? -1 : 1);
	const filter = JSON.stringify({
		mode: "AND",
		criteria: [{
			field: ENTRY_F.advanceId,
			operator: "Equals",
			values: [advanceId]
		}]
	});
	const entries = [];
	let pageToken;
	for (let page = 0; page < 5; page += 1) {
		const command = [
			"sheet",
			"record",
			"list",
			"--id",
			binding.docId,
			"--table-id",
			String(binding.entryTableId),
			"--filter",
			filter,
			"--limit",
			"100"
		];
		if (pageToken !== void 0) command.push("--page-token", pageToken);
		const ran = await runJson(ctx, budget, "sheet record list", command);
		if (!ran.ok) throw new Error(ran.content);
		for (const record of cliRecords(ran.json)) {
			const entry = parseAdvanceEntry(record);
			if (entry !== null) entries.push(entry);
		}
		pageToken = asString(asRecord(ran.json).page_token ?? asRecord(ran.json).next_page_token);
		if (pageToken === "") break;
	}
	return entries.sort((a, b) => a.at === b.at ? a.entryId < b.entryId ? -1 : 1 : a.at < b.at ? -1 : 1);
}
/** Today's entry ids (Contains filter on the day prefix) for id generation. */
async function todaysEntryIds(ctx, budget, binding) {
	const day = todayStr().replace(/\//g, "");
	if (advanceBackend === "sqlite") return localStore().listAllEntryIds().filter((id) => id.includes(`E-${day}-`));
	const filter = JSON.stringify({
		mode: "AND",
		criteria: [{
			field: ENTRY_F.id,
			operator: "Contains",
			values: [`E-${day}-`]
		}]
	});
	const ran = await runJson(ctx, budget, "sheet record list", [
		"sheet",
		"record",
		"list",
		"--id",
		binding.docId,
		"--table-id",
		String(binding.entryTableId),
		"--filter",
		filter,
		"--limit",
		"100"
	]);
	if (!ran.ok) throw new Error(ran.content);
	return cliRecords(ran.json).map((record) => parseAdvanceEntry(record)?.entryId ?? "").filter((id) => id !== "");
}
async function writeTable(ctx, budget, binding, tableId, kind, records) {
	if (advanceBackend === "sqlite") {
		const store = localStore();
		const rows = JSON.parse(records);
		for (const row of rows) {
			const fields = row.fieldsValue ?? {};
			if (tableId === LOCAL_BINDING.entryTableId) store.createEntry(fields);
			else if (kind === "create") store.createItem(fields);
			else store.updateItem(String(row.id ?? fields[ITEM_F.id] ?? ""), fields);
		}
		return {};
	}
	const command = [
		"sheet",
		"record",
		kind,
		"--id",
		binding.docId,
		"--table-id",
		String(tableId),
		"--records",
		records
	];
	const ran = await runJson(ctx, budget, `sheet record ${kind}`, command);
	if (!ran.ok) throw new Error(ran.content);
	return ran.json;
}
/** Append one entry row + refresh the item's 最新动态 projection cache. */
async function appendEntry(ctx, budget, binding, input) {
	const entryId = nextSequentialId("E", await todaysEntryIds(ctx, budget, binding));
	const at = nowStamp();
	const fields = {
		[ENTRY_F.id]: entryId,
		[ENTRY_F.advanceId]: input.advanceId,
		[ENTRY_F.at]: at,
		[ENTRY_F.sourceType]: SOURCE_TYPES.includes(input.sourceType) ? input.sourceType : "人工",
		[ENTRY_F.changeType]: CHANGE_TYPES.includes(input.changeType) ? input.changeType : "备注",
		[ENTRY_F.summary]: input.summary,
		[ENTRY_F.actor]: input.actor
	};
	if (input.detail !== "") fields[ENTRY_F.detail] = input.detail;
	if (input.refs.length > 0) fields[ENTRY_F.refs] = input.refs.join(" ");
	await writeTable(ctx, budget, binding, binding.entryTableId, "create", JSON.stringify([{ fieldsValue: fields }]));
	return {
		recordId: "",
		entryId,
		advanceId: input.advanceId,
		at,
		sourceType: asString(fields[ENTRY_F.sourceType]),
		changeType: asString(fields[ENTRY_F.changeType]),
		summary: input.summary,
		detail: input.detail,
		refs: [...input.refs],
		actor: input.actor,
		tone: toneOf(asString(fields[ENTRY_F.changeType]), input.detail)
	};
}
/** Create one advancement item (idempotent on explicit advanceId) + its 立项 entry. */
async function coreCreateAdvance(ctx, budget, config, caches, input, holder, sources) {
	const title = input.title.trim();
	if (title === "") throw new Error("advance: title must not be empty");
	const binding = await resolveAdvance(ctx, budget, config, caches, true, holder);
	if (input.advanceId !== void 0) {
		const existing = await fetchItemById(ctx, budget, binding, input.advanceId);
		if (existing !== void 0) return {
			item: existing,
			entry: null,
			idempotent: true,
			assigneeNote: "",
			binding
		};
	}
	const items = await fetchItems(ctx, budget, binding);
	const advanceId = input.advanceId ?? nextSequentialId("A", items.map((item) => item.advanceId));
	if (items.some((item) => item.advanceId === advanceId)) throw new Error(`advance: 生成的 advance_id ${advanceId} 已冲突，请显式传入 advanceId`);
	const fields = {
		[ITEM_F.id]: advanceId,
		[ITEM_F.title]: title,
		[ITEM_F.stage]: "draft"
	};
	let assigneeNote = "";
	if (input.assignee !== void 0 && input.assignee.trim() !== "") {
		const resolved = await resolveAssignee(ctx, budget, input.assignee);
		fields[ITEM_F.assignee] = resolved.value;
		if (!resolved.resolved) assigneeNote = `（负责人 "${input.assignee}" 未能唯一解析，已按姓名保存）`;
	}
	if (input.goal !== void 0 && input.goal.trim() !== "") fields[ITEM_F.goal] = input.goal.trim();
	if (input.background !== void 0 && input.background.trim() !== "") fields[ITEM_F.background] = input.background.trim();
	if (input.metrics !== void 0 && input.metrics.trim() !== "") fields[ITEM_F.metrics] = input.metrics.trim();
	if (input.targetDate !== void 0 && input.targetDate.trim() !== "") fields[ITEM_F.targetDate] = normalizeDdl(input.targetDate);
	const tags = normalizeTags(input.tags);
	if (tags.length > 0) fields[ITEM_F.tags] = formatTags(tags);
	const summary = `立项：${title}`;
	fields[ITEM_F.latest] = `${nowStamp()} 备注 ${summary}`;
	const created = cliRecords(await writeTable(ctx, budget, binding, binding.itemTableId, "create", JSON.stringify([{ fieldsValue: fields }]))).map((record) => parseAdvanceItem(record)).find((item) => item !== null) ?? null;
	const entry = await appendEntry(ctx, budget, binding, {
		advanceId,
		sourceType: input.sourceType ?? "人工",
		changeType: "备注",
		summary,
		detail: input.goal === void 0 || input.goal.trim() === "" ? "" : `目标 →${input.goal.trim()}`,
		refs: input.refs ?? [],
		actor: input.actor ?? "agent"
	});
	const item = created ?? {
		recordId: "",
		advanceId,
		title,
		goal: asString(fields[ITEM_F.goal]),
		assignee: parseAssignee(asString(fields[ITEM_F.assignee])).name,
		assigneeOpenId: parseAssignee(asString(fields[ITEM_F.assignee])).openId,
		targetDate: asString(fields[ITEM_F.targetDate]),
		stage: "draft",
		background: asString(fields[ITEM_F.background]),
		metrics: asString(fields[ITEM_F.metrics]),
		tags,
		latest: asString(fields[ITEM_F.latest])
	};
	if (sources !== void 0 && input.sources !== void 0 && input.sources.length > 0) {
		const actor = input.actor === "user" ? "user" : "agent";
		let catalog;
		for (const token of input.sources) {
			const parsed = parseSourceToken(token);
			if (parsed === void 0) continue;
			let label = parsed.id;
			if (parsed.prefix === "im") {
				if (catalog === void 0) catalog = await listRecentGroups(ctx, budget);
				label = catalog.find((row) => row.groupId === parsed.id)?.groupName ?? parsed.id;
			}
			await sources.add(advanceId, {
				token,
				kind: sourceKindOf(parsed.prefix) ?? "document",
				label,
				addedBy: actor,
				addedAt: Date.now()
			});
		}
	}
	return {
		item,
		entry,
		idempotent: false,
		assigneeNote,
		binding
	};
}
/**
* Feed one 事元: validate the stage move (when present), append the entry
* (append-only stream), then refresh the item projection. Field-level
* `原值→新值` diffs are host-generated into 变化内容 — the model cannot
* rewrite history.
*/
async function coreFeedAdvance(ctx, budget, config, caches, input, holder) {
	if (input.summary.trim() === "") throw new Error("advance: summary must not be empty");
	const binding = await resolveAdvance(ctx, budget, config, caches, false, holder);
	const item = await fetchItemById(ctx, budget, binding, input.advanceId);
	if (item === void 0) throw new Error(`advance: 事项 ${input.advanceId} 不存在；先用 yzj_advance_list 查真实 id，不要猜测`);
	const incomingRefs = (input.refs ?? []).filter((token) => token.trim() !== "");
	let overlappedRefs = [];
	if (incomingRefs.length > 0) {
		const existing = await fetchEntries(ctx, budget, binding, input.advanceId);
		const rawChangeType = input.changeType ?? "备注";
		const changeType = CHANGE_TYPES.includes(rawChangeType) ? rawChangeType : "备注";
		const replay = existing.find((entry) => isRefReplay(incomingRefs, changeType, entry));
		if (replay !== void 0) return {
			item,
			entry: replay,
			stageFrom: item.stage,
			stageChanged: false,
			binding,
			idempotent: true,
			overlappedRefs: []
		};
		overlappedRefs = overlappedRefsOf(incomingRefs, existing);
	}
	const diffs = [];
	const projection = {};
	let stageChanged = false;
	if (input.stageTo !== void 0 && input.stageTo !== item.stage) {
		if (!ADVANCE_STAGES.includes(input.stageTo)) throw new Error(`advance: 未知阶段 ${input.stageTo}；合法值 ${ADVANCE_STAGES.join("/")}`);
		if (USER_ONLY_STAGES.includes(input.stageTo) && input.actor !== "user") throw new Error(`advance: 终局(${USER_ONLY_STAGES.join("/")})只由用户在看板拍板;agent 请 stageTo=ready-for-review 或用决策请求说明理由`);
		if (input.stageTo === "decision-needed" && input.changeType !== "决策请求") throw new Error("advance: stageTo=decision-needed 必须配 changeType=决策请求（summary=要用户决定的问题，detail=分析+动作行 动作: 建待办|发消息|定会议 …）；偏差只记录事实，不推阶段");
		const violation = checkStageTransition(item.stage, input.stageTo);
		if (violation !== null) throw new Error(`advance: ${violation}`);
		if (input.stageTo === "cancelled") await assertStageOption(ctx, budget, binding, "cancelled");
		diffs.push(`阶段 ${item.stage}→${input.stageTo}`);
		projection[ITEM_F.stage] = input.stageTo;
		stageChanged = true;
	}
	if (input.goal !== void 0 && input.goal.trim() !== "" && input.goal.trim() !== item.goal) {
		diffs.push(`目标 ${item.goal === "" ? "（空）" : item.goal}→${input.goal.trim()}`);
		projection[ITEM_F.goal] = input.goal.trim();
	}
	if (input.metrics !== void 0 && input.metrics.trim() !== "" && input.metrics.trim() !== item.metrics) {
		diffs.push(`成功指标 ${item.metrics === "" ? "（空）" : item.metrics.split("\n").join("；")}→${input.metrics.trim().split("\n").join("；")}`);
		projection[ITEM_F.metrics] = input.metrics.trim();
	}
	if (input.targetDate !== void 0 && input.targetDate.trim() !== "") {
		const next = normalizeDdl(input.targetDate);
		if (next !== item.targetDate) {
			diffs.push(`目标日期 ${item.targetDate === "" ? "（空）" : item.targetDate}→${next}`);
			projection[ITEM_F.targetDate] = next;
		}
	}
	if (input.assignee !== void 0 && input.assignee.trim() !== "") {
		const resolved = await resolveAssignee(ctx, budget, input.assignee);
		if (parseAssignee(resolved.value).name !== item.assignee) {
			diffs.push(`负责人 ${item.assignee === "" ? "（空）" : item.assignee}→${parseAssignee(resolved.value).name}`);
			projection[ITEM_F.assignee] = resolved.value;
		}
	}
	const detailParts = [...diffs];
	if (input.detail !== void 0 && input.detail.trim() !== "") detailParts.push(input.detail.trim());
	const changeType = input.changeType ?? (stageChanged ? "阶段变化" : "备注");
	const entry = await appendEntry(ctx, budget, binding, {
		advanceId: input.advanceId,
		sourceType: input.sourceType ?? "人工",
		changeType,
		summary: input.summary.trim(),
		detail: detailParts.join("\n"),
		refs: input.refs ?? [],
		actor: input.actor ?? "agent"
	});
	projection[ITEM_F.latest] = `${entry.at} ${entry.changeType} ${entry.summary}`;
	await writeTable(ctx, budget, binding, binding.itemTableId, "update", JSON.stringify([{
		id: item.recordId,
		fieldsValue: projection
	}]));
	return {
		item: {
			...item,
			stage: projection[ITEM_F.stage] ?? item.stage,
			goal: asString(projection[ITEM_F.goal]) === "" ? item.goal : asString(projection[ITEM_F.goal]),
			metrics: asString(projection[ITEM_F.metrics]) === "" ? item.metrics : asString(projection[ITEM_F.metrics]),
			targetDate: asString(projection[ITEM_F.targetDate]) === "" ? item.targetDate : asString(projection[ITEM_F.targetDate]),
			assignee: projection[ITEM_F.assignee] === void 0 ? item.assignee : parseAssignee(asString(projection[ITEM_F.assignee])).name,
			assigneeOpenId: projection[ITEM_F.assignee] === void 0 ? item.assigneeOpenId : parseAssignee(asString(projection[ITEM_F.assignee])).openId,
			latest: asString(projection[ITEM_F.latest])
		},
		entry,
		stageFrom: item.stage,
		stageChanged,
		binding,
		idempotent: false,
		overlappedRefs
	};
}
/**
* The 备注 事元 a single-document source association lands (关联即一条事元,
* spec §15.1). refs carry the token so a repeat association is also caught
* by the 决策 19 stream dedupe.
*/
function documentThreadEntryInput(advanceId, token, label) {
	const parsed = parseSourceToken(token);
	return {
		advanceId,
		summary: `关联来源：${label}`,
		sourceType: sourceTypeOfToken(parsed?.prefix ?? "doc"),
		changeType: "备注",
		detail: `订阅单文档源 ${token}（关联即一条事元；内容更新监测未排期）`,
		refs: [token],
		actor: "user"
	};
}
/** Pure verb → entry/stage mapping behind the panel judge path. */
function judgeVerb(action, note) {
	const suffix = note === void 0 || note.trim() === "" ? "" : `：${note.trim()}`;
	return {
		confirm_condition: {
			summary: `确认新条件${suffix}`,
			changeType: "备注"
		},
		confirm_advance: {
			summary: `确认推进${suffix}`,
			stageTo: "updated",
			changeType: "阶段变化"
		},
		accept: {
			summary: `验收通过${suffix}`,
			stageTo: "completed",
			changeType: "阶段变化"
		},
		reject: {
			summary: `打回补充${suffix}`,
			stageTo: "running",
			changeType: "阶段变化"
		},
		ignore: {
			summary: `忽略本次评估，不构成新约束${suffix}`,
			stageTo: "running",
			changeType: "备注"
		},
		cancel: {
			summary: `中止推进${suffix}`,
			stageTo: "cancelled",
			changeType: "阶段变化"
		}
	}[action];
}
function itemViewOf(item) {
	return {
		advanceId: item.advanceId,
		title: item.title,
		goal: item.goal,
		assignee: item.assignee,
		targetDate: item.targetDate,
		stage: item.stage,
		background: item.background,
		metrics: parseMetrics(item.metrics),
		tags: item.tags,
		latest: item.latest
	};
}
function entryViewOf(entry) {
	return {
		entryId: entry.entryId,
		at: entry.at,
		sourceType: entry.sourceType,
		changeType: entry.changeType,
		summary: entry.summary,
		detail: entry.detail,
		refs: entry.refs,
		actor: entry.actor,
		tone: entry.tone
	};
}
/** Host service exposing the advance core to the browser surface. */
var YzjAdvanceService = class extends Service {
	budget;
	config;
	caches = {
		lib: {},
		adv: {}
	};
	/** Shared with the todo family so both boards follow the active library. */
	holder;
	cursors;
	sources;
	pool;
	constructor(ctx, budget, config, holder, cursors = new ScanCursorStore(), sources = new ContextSourceStore(), pool) {
		super(ctx, "yzjAdvance");
		this.budget = budget;
		this.config = config;
		this.holder = holder;
		this.cursors = cursors;
		this.sources = sources;
		this.pool = pool;
	}
	/** Board snapshot; `ready` false = tables not provisioned yet. */
	async state() {
		let binding;
		try {
			binding = await resolveAdvance(this.ctx, this.budget, this.config, this.caches, false, this.holder);
		} catch {
			return {
				ready: false,
				library: null,
				items: []
			};
		}
		try {
			const items = await fetchItems(this.ctx, this.budget, binding);
			return {
				ready: true,
				library: binding,
				items: items.map(itemViewOf)
			};
		} catch (error) {
			return {
				ready: true,
				library: binding,
				items: [],
				error: String(error.message)
			};
		}
	}
	/** One item's detail: projection + entry window (tail by default) + sources. */
	async get(advanceId, entryOffset, entryLimit) {
		const binding = await resolveAdvance(this.ctx, this.budget, this.config, this.caches, false, this.holder);
		const item = await fetchItemById(this.ctx, this.budget, binding, advanceId);
		if (item === void 0) throw new Error(`advance: 事项 ${advanceId} 不存在`);
		const entries = await fetchEntries(this.ctx, this.budget, binding, advanceId);
		const limit = entryLimit === void 0 || entryLimit < 1 ? 20 : entryLimit;
		const offset = entryOffset === void 0 || entryOffset < 0 ? Math.max(0, entries.length - limit) : entryOffset;
		return {
			item: itemViewOf(item),
			entries: entries.slice(offset, offset + limit).map(entryViewOf),
			entryOffset: offset,
			entryTotal: entries.length,
			sources: aggregateSources(entries),
			contextSources: this.sources.sourcesOf(advanceId).map((row) => ({ ...row }))
		};
	}
	/** Provision the two tables on demand (one-click empty-state action). */
	async ensure() {
		await resolveAdvance(this.ctx, this.budget, this.config, this.caches, true, this.holder);
		return this.state();
	}
	/** Start-modal direct write (the user's own act; no confirmation card). */
	async create(input) {
		return itemViewOf((await coreCreateAdvance(this.ctx, this.budget, this.config, this.caches, {
			...input,
			actor: "user"
		}, this.holder, this.sources)).item);
	}
	/** Agent-parity feed exposed for host-side callers (tools use the core directly). */
	async feed(input) {
		return itemViewOf((await coreFeedAdvance(this.ctx, this.budget, this.config, this.caches, input, this.holder)).item);
	}
	/**
	* Panel judge verbs — every user judgement lands as one 事元 (PRD: 每次
	* 用户的判断及操作都记录在推进时间旅程上), with the stage move where the
	* verb implies one.
	*/
	async judge(advanceId, action, note) {
		const verb = judgeVerb(action, note);
		return itemViewOf((await coreFeedAdvance(this.ctx, this.budget, this.config, this.caches, {
			advanceId,
			summary: verb.summary,
			sourceType: "人工",
			changeType: verb.changeType,
			...verb.stageTo === void 0 ? {} : { stageTo: verb.stageTo },
			actor: "user"
		}, this.holder)).item);
	}
	/** Last patrol wave for the board status line (spec §14.5). */
	scanState() {
		return scanStateOf(this.cursors);
	}
	/** Dream-pool snapshot for the board watermark line + pool viewer (spec §17.3). */
	dreamState() {
		if (this.pool === void 0) return {
			pending: 0,
			lastDreamAt: null,
			waterLevelReached: false,
			entries: []
		};
		const pending = this.pool.pending();
		return {
			pending: pending.length,
			lastDreamAt: this.pool.lastDreamAt() ?? null,
			waterLevelReached: pending.length >= 5,
			entries: pending.map((entry) => ({
				id: entry.id,
				channel: entry.channel,
				refId: entry.refId,
				content: entry.content.slice(0, 120),
				sendTime: entry.sendTime
			}))
		};
	}
	/** dp-* id lookup for advance-ref-lookup (视觉走查 08-21): Dream 抽取 agent 曾把池 id 抄进 refs;池条目永不删(审计),done 也可查。 */
	dreamPoolLookup(ids) {
		return this.pool?.lookup(ids) ?? [];
	}
	/**
	* One mechanical patrol tick (v1.8 收敛，决策 35): aggregate every open
	* item's subscribed sources, fetch increments, enqueue signals into the
	* Dream pool. No model in the loop — distillation happens only in Dream.
	* Errors are swallowed (patrol must never break the host).
	*/
	async patrolNow() {
		try {
			const result = await coreScanAdvance(this.ctx, this.budget, this.config, this.caches, this.cursors, [], 20, this.holder, this.sources, this.pool);
			return {
				scannedAt: Date.now(),
				found: result.signals.length
			};
		} catch {
			return {
				scannedAt: Date.now(),
				found: 0
			};
		}
	}
	/**
	* Host patrol timer (registration = effect; disposer returned). Interval
	* bounded to ≥300s per the patrol-frequency 口径.
	*/
	startPatrolTimer(intervalMs = 3e5) {
		const timer = setInterval(() => {
			this.patrolNow();
		}, Math.max(3e5, intervalMs));
		return () => {
			clearInterval(timer);
		};
	}
	/** One item's subscribed sources (lossless rows for the panel). */
	contextSourcesOf(advanceId) {
		return this.sources.sourcesOf(advanceId).map((row) => ({ ...row }));
	}
	/**
	* Panel 「关联来源」 direct write (D9, no confirmation card): validate the
	* token grammar and the item, append the registry row (addedBy=user), and
	* for single-document sources land one 备注 事元 with refs=[token] so a
	* repeat association is blocked by both the registry and 决策 19 dedupe.
	* Unsubscribing never deletes entries (timeline invariance).
	*/
	async sourceAdd(advanceId, token, label) {
		const parsed = parseSourceToken(token);
		if (parsed === void 0) throw new Error(`advance: 非法来源 token「${token}」；语法 im:<groupId> / doc:<docId> / dir:<docId> / todo:<todoId> / event:<eventId> / file:<fileId>`);
		const binding = await resolveAdvance(this.ctx, this.budget, this.config, this.caches, false, this.holder);
		if (await fetchItemById(this.ctx, this.budget, binding, advanceId) === void 0) throw new Error(`advance: 事项 ${advanceId} 不存在`);
		const existing = this.sources.sourcesOf(advanceId);
		if (existing.some((row) => row.token === token)) return {
			sources: existing.map((row) => ({ ...row })),
			entryAppended: false
		};
		const kind = sourceKindOf(parsed.prefix) ?? "document";
		let resolvedLabel = label !== void 0 && label.trim() !== "" ? label.trim() : parsed.id;
		if (label === void 0 || label.trim() === "") {
			if (parsed.prefix === "im") resolvedLabel = (await listRecentGroups(this.ctx, this.budget)).find((row) => row.groupId === parsed.id)?.groupName ?? parsed.id;
		}
		const outcome = await this.sources.add(advanceId, {
			token,
			kind,
			label: resolvedLabel,
			addedBy: "user",
			addedAt: Date.now()
		});
		if (!outcome.added) return {
			sources: outcome.sources.map((row) => ({ ...row })),
			entryAppended: false
		};
		if (kind === "document") {
			await coreFeedAdvance(this.ctx, this.budget, this.config, this.caches, documentThreadEntryInput(advanceId, token, resolvedLabel), this.holder);
			return {
				sources: outcome.sources.map((row) => ({ ...row })),
				entryAppended: true
			};
		}
		return {
			sources: outcome.sources.map((row) => ({ ...row })),
			entryAppended: false
		};
	}
	/** Panel 「解除关联」: registry row only — existing 事元 stay untouched. */
	async sourceRemove(advanceId, token) {
		if (parseSourceToken(token) === void 0) throw new Error(`advance: 非法来源 token「${token}」`);
		return (await this.sources.remove(advanceId, token)).map((row) => ({ ...row }));
	}
	/** Open the scan-cursor, thread, and dream-pool domains once the storage hub is ready. */
	async openNow() {
		const facility = this.ctx.get("storageDomain");
		if (facility === void 0) return;
		if (this.cursors instanceof ScanCursorStore) try {
			await this.cursors.open(facility);
		} catch (error) {
			this.ctx.logger.warn(`yzjAdvance: scan cursor store failed to open: ${String(error)}`);
		}
		if (this.sources instanceof ContextSourceStore) try {
			await this.sources.open(facility);
		} catch (error) {
			this.ctx.logger.warn(`yzjAdvance: thread store failed to open: ${String(error)}`);
		}
		if (this.pool !== void 0 && "open" in this.pool) try {
			await this.pool.open(facility);
		} catch (error) {
			this.ctx.logger.warn(`yzjAdvance: dream pool failed to open: ${String(error)}`);
		}
	}
};
/** Register the yzj_advance_* tool family (list/get/inspect/scan/create/feed). */
function applyAdvanceTools(ctx, budget, config, holder, cursors = new ScanCursorStore(), sources = new ContextSourceStore(), pool) {
	const caches = {
		lib: {},
		adv: {}
	};
	const bindingMeta = (binding) => ({
		docId: binding.docId,
		itemTableId: binding.itemTableId,
		entryTableId: binding.entryTableId,
		link: binding.link
	});
	ctx.tools.register(defineTool({
		name: "yzj_advance_list",
		description: "List advancement items (推进事项) from the AI推进 board: each item is an event-sourced aggregate of traceable 事元 (IM/todo/doc/minutes/calendar signals). Filter by stage (six-stage machine), tag, or assignee. The board queue groups decision-needed (待我决定) / ready-for-review (待我验收) / other open items (我关注的推进).",
		parameters: {
			stage: {
				type: "string",
				enum: [
					...ADVANCE_STAGES,
					"open",
					"all"
				],
				description: "open = not completed/cancelled (default); or one exact stage."
			},
			tag: {
				type: "string",
				description: "Only items carrying this tag (no # prefix needed)."
			},
			assignee: {
				type: "string",
				description: "Only items whose 负责人 name matches (substring)."
			},
			limit: {
				type: "number",
				description: "Max rows in the digest, 1-100, default 50."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs * 2,
		isConcurrencySafe: () => true,
		async execute(args) {
			let binding;
			try {
				binding = await resolveAdvance(ctx, budget, config, caches, false, holder);
			} catch (error) {
				return {
					content: `(推进看板未开通) ${String(error.message)}`,
					truncated: false,
					data: {
						kind: "advance-list",
						ready: false
					}
				};
			}
			let items;
			try {
				items = await fetchItems(ctx, budget, binding);
			} catch (error) {
				return {
					content: `yzj advance list failed: ${String(error.message)}`,
					truncated: false,
					data: {}
				};
			}
			const stage = args.stage ?? "open";
			const tag = args.tag === void 0 ? "" : args.tag.replace(/^#+/, "").trim();
			const assignee = (args.assignee ?? "").trim();
			const filtered = items.filter((item) => {
				if (stage === "open" && !isOpenStage(item.stage)) return false;
				if (ADVANCE_STAGES.includes(stage) && item.stage !== stage) return false;
				if (tag !== "" && !item.tags.includes(tag)) return false;
				if (assignee !== "" && !item.assignee.includes(assignee)) return false;
				return true;
			});
			const rank = {
				"decision-needed": 0,
				"ready-for-review": 1,
				"updated": 2,
				"running": 3,
				"draft": 4,
				"completed": 5,
				"cancelled": 6
			};
			const sorted = filtered.sort((a, b) => rank[a.stage] === rank[b.stage] ? a.advanceId < b.advanceId ? -1 : 1 : rank[a.stage] - rank[b.stage]);
			const limit = args.limit === void 0 ? 50 : args.limit;
			if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("yzj_advance_list: limit must be an integer between 1 and 100");
			const shown = sorted.slice(0, limit);
			return {
				content: [`AI推进看板 (${binding.link}) · ${stage}${tag === "" ? "" : ` #${tag}`} · ${sorted.length} 项`, ...shown.length === 0 ? ["(无匹配事项)"] : shown.map(itemLine)].join("\n"),
				truncated: false,
				data: {
					kind: "advance-list",
					ready: true,
					list: clipJson(shown.map(itemViewOf), { maxChars: budget.maxMetaChars }),
					total: sorted.length,
					library: bindingMeta(binding)
				}
			};
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_advance_get",
		description: "Read one advancement item: the folded projection (goal/stage/metrics/background) plus its append-only 事元 stream (推进时间旅程). The stream is complete storage-side; page with entryOffset/entryLimit to read it all (default = tail window).",
		parameters: {
			advanceId: {
				type: "string",
				required: true,
				description: "Stable item id (A-YYYYMMDD-NNN, from yzj_advance_list)."
			},
			entryOffset: {
				type: "number",
				description: "Stream window start (0-based, oldest first); default = tail."
			},
			entryLimit: {
				type: "number",
				description: "Stream window size, default 20."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs * 2,
		isConcurrencySafe: () => true,
		async execute(args) {
			let binding;
			let item;
			let entries;
			try {
				binding = await resolveAdvance(ctx, budget, config, caches, false, holder);
				item = await fetchItemById(ctx, budget, binding, args.advanceId);
				if (item === void 0) return {
					content: `advance: 事项 ${args.advanceId} 不存在；先用 yzj_advance_list 查真实 id`,
					truncated: false,
					data: {}
				};
				entries = await fetchEntries(ctx, budget, binding, args.advanceId);
			} catch (error) {
				return {
					content: `yzj advance get failed: ${String(error.message)}`,
					truncated: false,
					data: {}
				};
			}
			const limit = args.entryLimit === void 0 || args.entryLimit < 1 ? 20 : Math.min(args.entryLimit, 100);
			const offset = args.entryOffset === void 0 || args.entryOffset < 0 ? Math.max(0, entries.length - limit) : args.entryOffset;
			const window = entries.slice(offset, offset + limit);
			return {
				content: [
					...[
						`${item.advanceId} · ${item.title} [${item.stage}]`,
						item.goal === "" ? "" : `目标：${item.goal}`,
						item.background === "" ? "" : `背景：${item.background}`,
						item.metrics === "" ? "" : `成功指标：${item.metrics.split("\n").join("；")}`,
						`${item.assignee === "" ? "" : `负责人 ${item.assignee} · `}${item.targetDate === "" ? "" : `目标日期 ${item.targetDate} · `}事元 ${entries.length} 条（窗口 ${offset}-${offset + window.length}）`
					].filter((line) => line !== ""),
					"--- 推进时间旅程 ---",
					...window.length === 0 ? ["(暂无事元)"] : window.map(entryLine)
				].join("\n"),
				truncated: false,
				data: {
					kind: "advance-get",
					item: clipJson(itemViewOf(item), { maxChars: budget.maxMetaChars }),
					entries: clipJson(window.map(entryViewOf), { maxChars: budget.maxMetaChars }),
					entryOffset: offset,
					entryTotal: entries.length,
					sources: clipJson(aggregateSources(entries), { maxChars: budget.maxMetaChars }),
					library: bindingMeta(binding)
				}
			};
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_advance_inspect",
		description: "Read-only 比对材料 for AI推进 (spec §12). Spreads open items' goal/background/metrics/recent 事元/legal next stages plus the interrupt / silence / suppression criteria (spec §13). Host does NOT judge semantics — you do, then yzj_advance_feed. mode=review is the 验收辅助 checklist. v1.8 收敛（决策 35）：used during Dream distillation (read pool via yzj_advance_dream_status, compare per item, feed valuable ones) and 验收; patrol itself is a host mechanical routine with no model. Never stageTo completed.",
		parameters: {
			advanceId: {
				type: "string",
				description: "Inspect one item; omit to spread every open (not completed/cancelled) item."
			},
			signals: {
				type: "string",
				description: "New information to contrast (group messages / minutes excerpt). Empty = scheduled patrol with no new signal yet."
			},
			mode: {
				type: "string",
				enum: ["compare", "review"],
				description: "compare = 核心变量对比 (default); review = 验收辅助, still must not auto-accept."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs * 3,
		isConcurrencySafe: () => true,
		async execute(args) {
			let binding;
			try {
				binding = await resolveAdvance(ctx, budget, config, caches, false, holder);
			} catch (error) {
				return {
					content: `(推进看板未开通) ${String(error.message)}`,
					truncated: false,
					data: {
						kind: "advance-inspect",
						ready: false
					}
				};
			}
			let items;
			try {
				items = await fetchItems(ctx, budget, binding);
			} catch (error) {
				return {
					content: `yzj advance inspect failed: ${String(error.message)}`,
					truncated: false,
					data: {}
				};
			}
			const wanted = (args.advanceId ?? "").trim();
			const mode = args.mode === "review" ? "review" : "compare";
			const scoped = wanted === "" ? items.filter((item) => isOpenStage(item.stage)) : items.filter((item) => item.advanceId === wanted);
			if (wanted !== "" && scoped.length === 0) return {
				content: `advance: 事项 ${wanted} 不存在；先用 yzj_advance_list 查真实 id，不要猜测`,
				truncated: false,
				data: {}
			};
			const subjects = [];
			for (const item of scoped) {
				let recent = [];
				try {
					const entries = await fetchEntries(ctx, budget, binding, item.advanceId);
					recent = entries.slice(Math.max(0, entries.length - 5));
				} catch {
					recent = [];
				}
				subjects.push({
					item,
					recent
				});
			}
			return {
				content: buildInspectDigest({
					subjects,
					signals: args.signals ?? "",
					mode
				}),
				truncated: false,
				data: {
					kind: "advance-inspect",
					ready: true,
					mode,
					signals: args.signals ?? "",
					list: clipJson(subjects.map((row) => ({
						advanceId: row.item.advanceId,
						title: row.item.title,
						stage: row.item.stage,
						next: [...legalNextStages(row.item.stage)]
					})), { maxChars: budget.maxMetaChars }),
					library: bindingMeta(binding)
				}
			};
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_advance_scan",
		description: "Read-only incremental scan for AI推进 (spec §14 / §15.3). v1.8 收敛（决策 35）: the host patrol routine runs this mechanically every ≥300s (no model) and enqueues signals into the Dream pool; calling it yourself is a read-only peek at the same increments. Host owns the per-group cursor (storage-domain); the model must not pass or invent a msgId cursor. First visit of a group records a baseline and returns no history. Later visits return messages after the cursor, minus self and BOT- senders. groups is optional: omit it to scan every im: channel and dir: directory subscribed by open items (registry yzj_advance_sources, deduped — one fetch per channel whichever items subscribe; dir: sources surface new/updated docs in the directory as signals, refs=<docId>). The digest lists each item's 订阅清单. Explicit groups stay capped at 8 (决策 17); subscription aggregation errors out instead of silently truncating. Distillation is NOT your job here — it happens in Dream (yzj_advance_dream_status → 提炼 → dream_mark).",
		parameters: {
			groups: {
				type: "array",
				items: { type: "string" },
				description: "Group ids or names to watch (1–8). Omit to aggregate the im: sources of every open item from the subscription registry."
			},
			limit: {
				type: "number",
				description: "Per-group page size 1–20, default 20."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs * 6,
		isConcurrencySafe: () => true,
		async execute(args) {
			const groups = (args.groups ?? []).map((token) => String(token).trim()).filter((token) => token !== "");
			if (groups.length > 8) return {
				content: `advance scan: at most 8 groups`,
				truncated: false,
				data: {
					kind: "advance-scan",
					ready: false
				}
			};
			let result;
			try {
				result = await coreScanAdvance(ctx, budget, config, caches, cursors, groups, args.limit, holder, sources, pool);
			} catch (error) {
				return {
					content: `yzj advance scan failed: ${String(error.message)}`,
					truncated: false,
					data: {}
				};
			}
			return {
				content: buildScanDigest(result),
				truncated: false,
				data: {
					kind: "advance-scan",
					ready: true,
					signals: clipJson(result.signals, { maxChars: budget.maxMetaChars }),
					groups: clipJson(result.groups, { maxChars: budget.maxMetaChars }),
					openItems: clipJson(result.openItems, { maxChars: budget.maxMetaChars }),
					subscriptions: clipJson(result.subscriptions, { maxChars: budget.maxMetaChars })
				}
			};
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_advance_dream_status",
		description: "Read-only Dream-pool status (spec §17): pending signals awaiting distillation + watermark + last dream time. Dream 抽取流程:先读本工具拿 pending 清单 → 交 yzj_advance_inspect 与 open 事项比对 → 有价值的 yzj_advance_feed(refs=<refId>,命中打扰判据才 stageTo=decision-needed 即建议卡片) → 最后 yzj_advance_dream_mark(ids=[已处理的池条目 id]) 并给一句「抽取 N 条/产出 M 条建议」总结。",
		parameters: {},
		output: yzjToolOutput,
		isConcurrencySafe: () => true,
		async execute() {
			if (pool === void 0) return {
				content: "Dream 蓄水池未挂载（yzj_advance_dreampool domain 未开）",
				truncated: false,
				data: {}
			};
			const pending = pool.pending();
			const lastAt = pool.lastDreamAt();
			const lines = pending.map((entry) => `[${entry.sendTime}] ${entry.channel} ${entry.content.slice(0, 80)} <${entry.refId}>(id=${entry.id})`);
			return {
				content: [
					`Dream 蓄水池：pending ${pending.length} 条 · 上次抽取 ${lastAt === void 0 ? "从未" : new Date(lastAt).toLocaleString("zh-CN", { hour12: false })}`,
					...pending.length === 0 ? ["pending 清单：（无）——静默"] : ["pending 清单（待抽取）：", ...lines],
					"抽取后调用 yzj_advance_dream_mark(ids=[...])。"
				].join("\n"),
				truncated: false,
				data: {
					kind: "advance-dream-status",
					pending: clipJson(pending, { maxChars: budget.maxMetaChars }),
					pendingCount: pending.length,
					lastDreamAt: lastAt ?? null
				}
			};
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_advance_dream_mark",
		description: "Mark Dream-pool entries done after a distillation (spec §17; host-internal state, not a user-data write — never gated).",
		parameters: { ids: {
			type: "array",
			items: { type: "string" },
			required: true,
			description: "Processed pool entry ids (from yzj_advance_dream_status)."
		} },
		output: yzjToolOutput,
		isConcurrencySafe: () => true,
		async execute(args) {
			if (pool === void 0) return {
				content: "Dream 蓄水池未挂载",
				truncated: false,
				data: {}
			};
			const ids = (args.ids ?? []).map((id) => String(id));
			const marked = await pool.markDone(ids);
			await pool.recordDream();
			return {
				content: `Dream 抽取完成：标记 ${marked} 条已处理；剩余 pending ${pool.pending().length} 条`,
				truncated: false,
				data: {
					kind: "advance-dream-mark",
					marked,
					pendingCount: pool.pending().length
				}
			};
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_advance_create",
		description: "Create one advancement item (推进事项) on the AI推进 board (auto-provisions the 事项/事元 tables on first use). Prefill the 7 fields from the conversation so the user only confirms (AI 预填). When 立项 happens inside a group topic, pass sources=[im:<groupId>] so the founding group becomes 来源① (intent-thread subscription, spec §15); later patrol scans follow the subscription. Idempotent: pass advanceId to adopt an existing item. Starts at stage draft; move it with yzj_advance_feed.",
		parameters: {
			title: {
				type: "string",
				required: true,
				description: "Item name (名称)."
			},
			advanceId: {
				type: "string",
				description: "Explicit stable id (A-YYYYMMDD-NNN); when it exists the existing item is returned unchanged (idempotent)."
			},
			goal: {
				type: "string",
				description: "这件事要做到什么 — the currently effective goal (描述)."
			},
			background: {
				type: "string",
				description: "任务背景 — the anchor the agent compares incoming signals against."
			},
			metrics: {
				type: "string",
				description: "成功指标, one per line as `指标名: 当前 / 目标` (rendered as metric cards)."
			},
			assignee: {
				type: "string",
				description: "结果承担者 (name resolved to 姓名(openId) when unique)."
			},
			targetDate: {
				type: "string",
				description: "Target date as YYYY-MM-DD or YYYY/MM/DD."
			},
			tags: {
				type: "array",
				items: { type: "string" },
				description: "Tags for aggregation; # prefixes stripped."
			},
			refs: {
				type: "array",
				items: { type: "string" },
				description: "Traceable ref tokens (yzj:... / im:<groupId>:<msgId> for messages — copy verbatim from the scan digest / dream status listing / docId for docs) this item originates from; stored on the 立项 entry. Never sent to the CLI."
			},
			sourceType: {
				type: "string",
				enum: [...SOURCE_TYPES],
				description: "Provenance of the founding signal (default 人工)."
			},
			sources: {
				type: "array",
				items: { type: "string" },
				description: "Intent-thread tokens to subscribe (im:<groupId> / dir:<docId 目录或整库 kbId> / doc:<docId> / todo:<todoId> / event:<eventId> / file:<fileId>). The founding group usually goes here as 来源①; im:/dir: sources drive later yzj_advance_scan aggregation."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs * 4,
		isConcurrencySafe: () => false,
		async execute(args) {
			let result;
			try {
				result = await coreCreateAdvance(ctx, budget, config, caches, {
					title: args.title,
					advanceId: args.advanceId,
					goal: args.goal,
					background: args.background,
					metrics: args.metrics,
					assignee: args.assignee,
					targetDate: args.targetDate,
					tags: args.tags,
					refs: args.refs,
					sourceType: args.sourceType,
					sources: args.sources,
					actor: "agent"
				}, holder, sources);
			} catch (error) {
				return {
					content: `yzj advance create failed: ${String(error.message)}`,
					truncated: false,
					data: {}
				};
			}
			if (result.idempotent) return {
				content: `已存在（幂等命中，未重复创建）：${itemLine(result.item)}`,
				truncated: false,
				data: {
					kind: "advance-create",
					idempotentHit: true,
					advanceId: result.item.advanceId,
					item: clipJson(itemViewOf(result.item), { maxChars: budget.maxMetaChars }),
					library: bindingMeta(result.binding)
				}
			};
			return {
				content: [
					`created 推进事项 ${result.item.advanceId} · ${result.item.title} [draft]${result.assigneeNote}`,
					...sources.sourcesOf(result.item.advanceId).length > 0 ? [`已订阅来源：${sources.sourcesOf(result.item.advanceId).map((row) => row.token).join("、")}`] : [],
					`推进看板 ${result.binding.link}`
				].join("\n"),
				truncated: false,
				data: {
					kind: "advance-create",
					advanceId: result.item.advanceId,
					item: clipJson(itemViewOf(result.item), { maxChars: budget.maxMetaChars }),
					refs: args.refs ?? [],
					library: bindingMeta(result.binding)
				}
			};
		}
	}));
	ctx.tools.register(defineTool({
		name: "yzj_advance_feed",
		description: "Feed one 事元 (source unit) into an advancement item — the ONLY mutation channel: goal updates, progress, deviations, decision requests, and stage moves are all append-only entries with host-generated 原值→新值 diffs; the item projection is refolded. Stage moves obey the seven-stage machine (draft→running→(decision-needed→updated)*→ready-for-review→completed; any non-terminal → cancelled; terminal → running reopens). Patrol: yzj_advance_scan then yzj_advance_inspect, then this tool. Host forcibly dedupes only an exact replay — the same refs set AND the same changeType (决策 25): a genuine re-feed returns the existing 事元 and appends nothing; a partial refs overlap appends normally and returns an overlappedRefs hint, so distinct entries may cite the same document. running items stay quiet — do not feed when there is no deviation, and never re-state a fact already on the timeline. Interrupt the user (changeType 决策请求 + stageTo decision-needed — host rejects any other changeType with decision-needed, 决策 41) only when a criterion fires: the signal contradicts 任务背景, a metric flips off-target or moves away from it, the gap cannot close before the target date, a blocker threatens that date, continuing needs scope/resource/priority trade-offs or crosses a stated red line, or two+ viable paths would change the baseline. A 决策请求 carries the question in summary and, in detail, the analysis plus ACTION LINES the user can execute with one tap on the board (several allowed, one per line): `动作: 建待办 | 内容: <标题> | 截止: <yyyy-MM-dd> | 负责人: <名字>` / `动作: 发消息 | 内容: <草稿>` / `动作: 定会议 | 主题: <主题> | 时间: <yyyy-MM-dd HH:mm>` (keys optional). 偏差 entries record facts only and never push the stage. Deliverables complete AND metrics N/N AND no open deviation → 验收请求 + ready-for-review. Never stageTo completed/cancelled — terminal stages are user-only (the user taps 确认达到目标 / 中止推进; host rejects agent terminal stage moves outright). The confirmation card appears ONLY when you rewrite the baseline (goal/metrics/targetDate/assignee) — plain appends and stage moves land silently, the board queue is where the user is found. Min-loop in the topic: contrast 原来的理解 vs 现在的约束, propose options, wait, restate impact, then feed. Knowledge export (spec §16): when the user asks for 复盘, read the full stream with yzj_advance_get (page to the end), write the five-section review per docs/spec/advance-review-template.md, yzj_doc_import into 「我的知识/推进复盘/<事项名>」, then feed one silent 产物 entry with refs=[that docId]; meeting minutes follow the same loop with the four-section 金蝶 template (docs/spec/meeting-minutes-template.md).",
		parameters: {
			advanceId: {
				type: "string",
				required: true,
				description: "Stable item id (from yzj_advance_list)."
			},
			summary: {
				type: "string",
				required: true,
				description: "Event description — what happened (timeline row text)."
			},
			sourceType: {
				type: "string",
				enum: [...SOURCE_TYPES],
				description: "Where the signal came from (default 人工)."
			},
			changeType: {
				type: "string",
				enum: [...CHANGE_TYPES],
				description: "What this entry does to the item (default 阶段变化 when stageTo is set, else 备注)."
			},
			detail: {
				type: "string",
				description: "Free-form detail appended after the host-generated field diffs. 决策请求时: 问题分析(多行) + 动作行(每行一个 `动作: 建待办|发消息|定会议 | 键: 值 | …`, 决策 41)。"
			},
			refs: {
				type: "array",
				items: { type: "string" },
				description: "Traceable ref tokens for this signal (yzj:... / im:<groupId>:<msgId> for messages — copy verbatim from the scan digest or dream status listing / docId / todoId). Never sent to the CLI."
			},
			stageTo: {
				type: "string",
				enum: [...ADVANCE_STAGES],
				description: "Stage move (state machine enforced; illegal moves are rejected with the legal paths)."
			},
			goal: {
				type: "string",
				description: "New effective goal (goal update; old→new recorded)."
			},
			metrics: {
				type: "string",
				description: "New 成功指标 lines (old→new recorded)."
			},
			targetDate: {
				type: "string",
				description: "New target date (old→new recorded)."
			},
			assignee: {
				type: "string",
				description: "New 结果承担者 (old→new recorded)."
			}
		},
		output: yzjToolOutput,
		timeoutMs: budget.timeoutMs * 4,
		isConcurrencySafe: () => false,
		async execute(args) {
			let result;
			try {
				result = await coreFeedAdvance(ctx, budget, config, caches, {
					advanceId: args.advanceId,
					summary: args.summary,
					sourceType: args.sourceType,
					changeType: args.changeType,
					detail: args.detail,
					refs: args.refs,
					stageTo: args.stageTo,
					goal: args.goal,
					metrics: args.metrics,
					targetDate: args.targetDate,
					assignee: args.assignee,
					actor: "agent"
				}, holder);
			} catch (error) {
				return {
					content: `yzj advance feed failed: ${String(error.message)}`,
					truncated: false,
					data: {}
				};
			}
			if (result.idempotent) return {
				content: `同源去重（未追加）：事元 ${result.entry.entryId} → ${result.item.advanceId} 已含 ${result.entry.refs.join(" ")}`,
				truncated: false,
				data: {
					kind: "advance-feed",
					idempotentHit: true,
					advanceId: result.item.advanceId,
					entryId: result.entry.entryId,
					changeType: result.entry.changeType,
					summary: result.entry.summary,
					refs: result.entry.refs,
					item: clipJson(itemViewOf(result.item), { maxChars: budget.maxMetaChars }),
					library: bindingMeta(result.binding)
				}
			};
			const stageNote = result.stageChanged ? `（阶段 ${result.stageFrom}→${result.item.stage}）` : "";
			const overlapNote = result.overlappedRefs.length > 0 ? `引用重叠提示：${result.overlappedRefs.join(" ")} 已存在于既有些事元（本条仍已追加；若是同一信号的重复上报，无需再 feed）` : "";
			return {
				content: [
					`fed 事元 ${result.entry.entryId} → ${result.item.advanceId} · ${result.entry.changeType} ${result.entry.summary}${stageNote}`,
					result.entry.detail === "" ? "" : `变化：${result.entry.detail.split("\n").join("；")}`,
					overlapNote,
					`推进看板 ${result.binding.link}`
				].filter((line) => line !== "").join("\n"),
				truncated: false,
				data: {
					kind: "advance-feed",
					advanceId: result.item.advanceId,
					entryId: result.entry.entryId,
					changeType: result.entry.changeType,
					summary: result.entry.summary,
					detail: result.entry.detail,
					stageFrom: result.stageFrom,
					stageTo: result.item.stage,
					refs: result.entry.refs,
					overlappedRefs: result.overlappedRefs,
					item: clipJson(itemViewOf(result.item), { maxChars: budget.maxMetaChars }),
					library: bindingMeta(result.binding)
				}
			};
		}
	}));
}
/**
* DreamPool: the 蓄水池 for the AI推进 Dream rhythm (spec §17, 决策 33/34).
* Work-scan signals are copied in as pending entries; a Dream trigger (manual
* button / watermark hint / scheduled wake) lets the model distill the pending
* batch into entries + suggestion cards, then marks them done. Entries are
* never deleted (audit trail).
* @module @dsh-yzj/tool-yzj/advance-dreampool
*/
const entrySchema$1 = z$1.object({
	id: z$1.string().min(1),
	channel: z$1.string(),
	refId: z$1.string(),
	content: z$1.string(),
	sendTime: z$1.string(),
	enqueuedAt: z$1.number().int(),
	done: z$1.boolean()
});
const entryListSchema = z$1.array(entrySchema$1);
const POOL_KEY = "pending";
const META_KEY = "meta";
/** Durable domain: pool list + last-dream meta. */
const yzjAdvanceDreamPoolDomainSpec = defineDomain({
	name: "yzj_advance_dreampool",
	version: 0,
	tables: {
		pool: domainTable(entryListSchema),
		meta: domainTable(z$1.object({ lastDreamAt: z$1.number().int() }))
	}
});
/**
* Read/write face over the opened domain. Memory-backed until `open()` —
* same pattern as ScanCursorStore / AdvanceThreadStore.
*/
var DreamPoolStore = class {
	table;
	meta;
	memoryPool = [];
	memoryLastDream;
	seq = 0;
	/** Open (or adopt) the domain; safe to await repeatedly. */
	async open(facility) {
		if (this.table !== void 0) return;
		const domain = await facility.open(yzjAdvanceDreamPoolDomainSpec);
		this.table = domain.table("pool");
		this.meta = domain.table("meta");
		if (this.memoryPool.length > 0) await this.table.put(POOL_KEY, this.memoryPool);
		this.memoryPool = [];
		if (this.memoryLastDream !== void 0) {
			await this.meta.put(META_KEY, { lastDreamAt: this.memoryLastDream });
			this.memoryLastDream = void 0;
		}
	}
	list() {
		return this.table?.get(POOL_KEY) ?? this.memoryPool;
	}
	async persist(next) {
		if (this.table !== void 0) {
			await this.table.put(POOL_KEY, next);
			return;
		}
		this.memoryPool = next;
	}
	pending() {
		return this.list().filter((entry) => !entry.done);
	}
	lookup(ids) {
		const wanted = new Set(ids);
		return this.list().filter((entry) => wanted.has(entry.id));
	}
	async enqueue(entry) {
		const current = this.list();
		const dup = current.find((row) => row.channel === entry.channel && row.refId === entry.refId);
		if (dup !== void 0) return dup;
		this.seq += 1;
		const full = {
			...entry,
			id: `dp-${Date.now()}-${this.seq}`,
			enqueuedAt: Date.now(),
			done: false
		};
		await this.persist([...current, full]);
		return full;
	}
	async markDone(ids) {
		const wanted = new Set(ids);
		let marked = 0;
		const next = this.list().map((entry) => {
			if (!entry.done && wanted.has(entry.id)) {
				marked += 1;
				return {
					...entry,
					done: true
				};
			}
			return entry;
		});
		if (marked > 0) await this.persist(next);
		return marked;
	}
	lastDreamAt() {
		return this.meta?.get(META_KEY)?.lastDreamAt ?? this.memoryLastDream;
	}
	async recordDream(at = Date.now()) {
		if (this.meta !== void 0) {
			await this.meta.put(META_KEY, { lastDreamAt: at });
			return;
		}
		this.memoryLastDream = at;
	}
};
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
	originTime: z$1.number().optional(),
	fromSessionId: z$1.string().optional()
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
				if (input.quiet === true) return {
					sessionId: existing.dshSessionId,
					created: false,
					record: existing
				};
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
			lastActivity: input.lastActivity ?? now,
			status: "running",
			...input.rootMsgId === void 0 || input.rootMsgId === "" ? {} : { rootMsgId: input.rootMsgId },
			...input.originWho === void 0 ? {} : { originWho: input.originWho },
			...input.originText === void 0 ? {} : { originText: input.originText },
			...input.originTime === void 0 ? {} : { originTime: input.originTime },
			...input.fromSessionId === void 0 ? {} : { fromSessionId: input.fromSessionId }
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
* writes ask, strong-level writes (deletion, irreversible) ask with the
* strong flag and never merge into batch confirmations. The ask broadcasts a
* `yzj/ask-pending` host event carrying the full parsed arguments so the
* confirmation-card bridge (ui-yzj node half) can append the durable
* `yzj/write-request` session event with complete parameter display.
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
	yzj_im_group_members_add: {
		reason: "拉人进群",
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
	},
	yzj_todo_create: {
		reason: "在待办任务库创建待办（首用时会自动开通任务库）",
		level: "standard"
	},
	yzj_todo_update: {
		reason: "更新待办（状态/负责人/DDL/标签/日志）",
		level: "standard"
	},
	yzj_todo_complete: {
		reason: "完成待办（状态置 done）",
		level: "standard"
	},
	yzj_advance_create: {
		reason: "在AI推进看板立项推进事项（首用时自动开通事项/事元双表）",
		level: "standard"
	},
	yzj_advance_feed: {
		reason: "改写推进事项的比对基准（目标/成功指标/目标日期/负责人）",
		level: "standard",
		when: rewritesAdvanceBaseline
	},
	robot_share_write: {
		reason: "写入群共享工作区文件（<cwd>/groups/<groupId>/shared/）",
		level: "standard",
		prefix: "工作区写操作确认"
	},
	robot_notify: {
		reason: "通过机器人通道向云之家会话推送消息，发出后不可撤回",
		level: "standard",
		whenSession: isBoundHomeSession
	},
	robot_continue: {
		reason: "向机器人会话注入操作者消息并走入站管线（含群内回复推送）",
		level: "standard",
		whenSession: isBoundHomeSession
	}
};
/** Projection fields whose rewrite replaces the baseline every later comparison rests on. */
const ADVANCE_BASELINE_FIELDS = [
	"goal",
	"metrics",
	"targetDate",
	"assignee"
];
/**
* Advance feed asks only when it rewrites the comparison baseline
* (ai-advance-design.md §13.5 / 决策 14). A normal-progress entry carries no
* decision for the user, and a deviation already surfaces in the board's
* 待我决定 queue — carding those would ask the same thing twice while the
* first ask ("may I append this?") carries no information.
*/
function rewritesAdvanceBaseline(args) {
	return ADVANCE_BASELINE_FIELDS.some((field) => {
		const value = args[field];
		return typeof value === "string" && value.trim() !== "";
	});
}
/** Group-room host or a topic session. Missing id → ask (fail closed on the D9 hole). */
function isBoundHomeSession(sessionId) {
	return sessionId === void 0 || sessionId.startsWith("yzj-home-") || sessionId.startsWith("yzj-topic-");
}
/** Structural session id on a tools/pre-execute exec (agent is present in harness). */
function callingSessionId(exec) {
	const id = exec.agent?.session?.id;
	return typeof id === "string" ? id : void 0;
}
/**
* Register the `tools/pre-execute` ask guard plus the ask-pending broadcast.
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
		return {
			kind: "ask",
			reason
		};
	});
}
/**
* Model-facing Yunzhijia tool family over `ctx.yzjBridge`: doc, sheet,
* calendar, contact, im, and file domains. Every tool renders a bounded
* model-facing digest and projects a capped structured payload for the UI
* through `output.presentationMeta`; destructive or irreversible operations
* ask through the `tools/pre-execute` approval seam (the bundle's browser
* surface answers via the GUI approval panel).
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
	todo: z.object({
		workspace: z.string(),
		docId: z.string(),
		tableId: z.number()
	}),
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
	const todoService = new YzjTodoService(ctx, budget, config.todo ?? {});
	applyTodoTools(ctx, budget, config.todo ?? {}, todoService.holder);
	setAdvanceBackend("sqlite");
	setTodoBackend("sqlite");
	const scanCursors = new ScanCursorStore();
	const advanceSources = new ContextSourceStore();
	const dreamPool = new DreamPoolStore();
	const advanceService = new YzjAdvanceService(ctx, budget, config.todo ?? {}, todoService.holder, scanCursors, advanceSources, dreamPool);
	applyAdvanceTools(ctx, budget, config.todo ?? {}, todoService.holder, scanCursors, advanceSources, dreamPool);
	ctx.effect(() => advanceService.startPatrolTimer());
	const home = new YzjHomeService(ctx, {
		backfillLimit: config.backfillLimit ?? 50,
		summonWindowMessages: config.summonWindowMessages ?? 20,
		summonWindowChars: config.summonWindowChars ?? 4e3,
		logRetention: config.logRetention ?? 500
	});
	ctx.inject(["storageDomain"], () => {
		home.openNow();
		advanceService.openNow();
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
export { BoundLogStore, Config, ContextSourceStore, DEFAULT_BOUND_LOG_LIMITS, HomeBindingStore, TopicAnchorStore, ackLocalEntry, apply, applyAppend, applySummonOncePreStep, cliMessageList, cliMessageToEntry, clipLogParam, conversationKindOf, extractSendMsgId, failLocalEntry, formatSummonWindow, homeSessionId, inject, isPluginFollowup, latestUserSourceKind, localMsgId, mergeFused, name, parseSourceToken, robotOutboundEntry, sessionHasSummonWindow, sessionIdFromAssemble, shouldAttachSummonWindow, sourceKindOf, sourceTypeOfToken, summonWindowText, threadEntries, topicAnchorKey, topicSessionId, yzjAdvanceSourcesDomainSpec, yzjHomeDomainSpec, yzjHomeLogDomainSpec, yzjTopicDomainSpec };
