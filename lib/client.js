window.__ModuleLoader__.load({
	id: "@dsh-yzj/bundle",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let react_dom_client = require("react-dom/client");
		//#region \0dsh-css:/Users/kingdee/dev/dsh-yzj/packages/ui-yzj/src/client/cards.module.css.mjs
		const css$5 = "._9L9s4q_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:10px;flex-direction:column;gap:6px;min-width:0;padding:10px 12px;font-size:14px;line-height:20px;display:flex}._9L9s4q_errorCard{border-color:var(--dsw-static-red-500)}._9L9s4q_header{align-items:center;gap:8px;min-width:0;display:flex}._9L9s4q_iconBox{background:var(--dsw-static-deepseek-100);width:28px;height:28px;color:var(--dsw-static-deepseek-600);border-radius:8px;flex:none;justify-content:center;align-items:center;display:inline-flex}._9L9s4q_title{text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:600;overflow:hidden}._9L9s4q_tag{background:var(--dsw-static-deepseek-100);color:var(--dsw-static-deepseek-600);border-radius:999px;flex:none;margin-left:auto;padding:0 8px;font-size:11px;line-height:18px}._9L9s4q_tagRun{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary)}._9L9s4q_tagFail{background:var(--dsw-static-red-100);color:var(--dsw-static-red-500);font-weight:600}._9L9s4q_rowWrap{align-items:center;gap:6px;min-width:0;display:flex}._9L9s4q_rowWrap>*{flex:1;min-width:0}._9L9s4q_rowWrap ._9L9s4q_link{flex:none}._9L9s4q_rows{flex-direction:column;gap:4px;max-height:260px;display:flex;overflow:auto}._9L9s4q_row{background:var(--dsw-alias-bg-base);border-radius:8px;flex-direction:column;gap:1px;min-width:0;padding:5px 8px;display:flex}._9L9s4q_rowTitle{text-overflow:ellipsis;white-space:nowrap;align-items:center;gap:6px;min-width:0;font-weight:500;display:flex;overflow:hidden}._9L9s4q_rowSub{color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:16px;overflow:hidden}._9L9s4q_rowId{color:var(--dsw-alias-label-tertiary);flex:none;font-size:11px}._9L9s4q_avatar{object-fit:cover;border-radius:50%;flex:none;width:20px;height:20px}._9L9s4q_avatarFallback{background:var(--dsw-static-deepseek-100);width:20px;height:20px;color:var(--dsw-static-deepseek-600);border-radius:50%;flex:none;justify-content:center;align-items:center;font-size:12px;font-weight:600;display:inline-flex}._9L9s4q_link{color:var(--dsw-static-deepseek-500);text-overflow:ellipsis;white-space:nowrap;text-decoration:none;overflow:hidden}._9L9s4q_link:hover{text-decoration:underline}._9L9s4q_jump{color:var(--dsw-static-deepseek-500);cursor:pointer;transition:background-color .12s var(--ds-ease-in-out,ease);background:0 0;border:none;border-radius:6px;flex:none;padding:2px 8px;font-size:12px;line-height:16px}._9L9s4q_jump:hover{background:var(--dsw-static-deepseek-100)}._9L9s4q_text{color:var(--dsw-alias-label-secondary);white-space:pre-wrap;word-break:break-word;max-height:200px;font-size:13px;line-height:18px;overflow:auto}._9L9s4q_strongCard{border-color:var(--dsw-static-red-500);background:var(--dsw-alias-interactive-bg-hover-danger)}._9L9s4q_tagStrong{background:var(--dsw-static-red-100);color:var(--dsw-static-red-500);font-weight:600}._9L9s4q_fullText{white-space:pre-wrap;word-break:break-word;background:var(--dsw-alias-bg-base);border-radius:8px;max-height:180px;padding:6px 8px;font-size:13px;line-height:18px;overflow:auto}._9L9s4q_actions{flex-wrap:wrap;gap:6px;padding-top:2px;display:flex}._9L9s4q_action,._9L9s4q_actionPrimary{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);cursor:pointer;transition:background-color .12s var(--ds-ease-in-out,ease), border-color .12s var(--ds-ease-in-out,ease);border-radius:8px;padding:5px 14px;font-size:12px;line-height:16px}._9L9s4q_action:hover{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l3)}._9L9s4q_actionPrimary{background:var(--dsw-alias-button-info-fill);color:var(--dsw-alias-label-primary-foreground);border-color:#0000;font-weight:600}._9L9s4q_actionPrimary:hover{background:var(--dsw-alias-button-info-hover);border-color:#0000}._9L9s4q_writeId{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;flex:none;margin-left:auto;font-size:10px}._9L9s4q_ccIdentity{color:var(--dsw-alias-label-secondary);padding:2px 8px 0;font-size:12px;line-height:16px}._9L9s4q_ccRefs{flex-wrap:wrap;align-items:center;gap:6px;padding:0 8px;display:flex}._9L9s4q_ccRefsLabel{color:var(--dsw-alias-label-tertiary);flex:none;font-size:11px}._9L9s4q_miniChip{background:var(--dsw-static-deepseek-100);color:var(--dsw-static-deepseek-600);border-radius:999px;flex:none;padding:2px 10px;font-size:11px;line-height:16px}._9L9s4q_terminalCancel{border-color:var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-1);opacity:.85}";
		const tagId$5 = "@dsh-yzj/bundle/cards.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$5) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@dsh-yzj/bundle";
			tag.dataset.pluginCss = tagId$5;
			tag.textContent = css$5;
			document.head.appendChild(tag);
		}
		var cards_module_css_default = {
			"header": "_9L9s4q_header",
			"rowSub": "_9L9s4q_rowSub",
			"row": "_9L9s4q_row",
			"actions": "_9L9s4q_actions",
			"actionPrimary": "_9L9s4q_actionPrimary",
			"terminalCancel": "_9L9s4q_terminalCancel",
			"rows": "_9L9s4q_rows",
			"miniChip": "_9L9s4q_miniChip",
			"title": "_9L9s4q_title",
			"ccRefsLabel": "_9L9s4q_ccRefsLabel",
			"action": "_9L9s4q_action",
			"jump": "_9L9s4q_jump",
			"tagRun": "_9L9s4q_tagRun",
			"strongCard": "_9L9s4q_strongCard",
			"rowWrap": "_9L9s4q_rowWrap",
			"avatar": "_9L9s4q_avatar",
			"link": "_9L9s4q_link",
			"avatarFallback": "_9L9s4q_avatarFallback",
			"rowId": "_9L9s4q_rowId",
			"writeId": "_9L9s4q_writeId",
			"fullText": "_9L9s4q_fullText",
			"ccIdentity": "_9L9s4q_ccIdentity",
			"tagStrong": "_9L9s4q_tagStrong",
			"iconBox": "_9L9s4q_iconBox",
			"rowTitle": "_9L9s4q_rowTitle",
			"ccRefs": "_9L9s4q_ccRefs",
			"text": "_9L9s4q_text",
			"errorCard": "_9L9s4q_errorCard",
			"tag": "_9L9s4q_tag",
			"tagFail": "_9L9s4q_tagFail",
			"card": "_9L9s4q_card"
		};
		//#endregion
		//#region src/client/cards.tsx
		/** Every wire tool name this package renders. */
		const YZJ_TOOL_NAMES = [
			"yzj_whoami",
			"yzj_contact_search",
			"yzj_contact_get",
			"yzj_doc_workspace_list",
			"yzj_doc_workspace_get",
			"yzj_doc_workspace_create",
			"yzj_doc_list",
			"yzj_doc_get",
			"yzj_doc_recent",
			"yzj_doc_create",
			"yzj_doc_folder_create",
			"yzj_doc_rename",
			"yzj_doc_move",
			"yzj_doc_delete",
			"yzj_doc_import",
			"yzj_doc_download_url",
			"yzj_doc_search",
			"yzj_doc_write",
			"yzj_doc_download",
			"yzj_doc_block_list",
			"yzj_doc_block_insert",
			"yzj_doc_block_update",
			"yzj_doc_block_delete",
			"yzj_doc_block_replace",
			"yzj_sheet_create",
			"yzj_sheet_get",
			"yzj_sheet_table_get",
			"yzj_sheet_table_create",
			"yzj_sheet_table_rename",
			"yzj_sheet_table_delete",
			"yzj_sheet_record_list",
			"yzj_sheet_record_create",
			"yzj_sheet_record_update",
			"yzj_sheet_record_delete",
			"yzj_calendar_event_list",
			"yzj_calendar_event_get",
			"yzj_calendar_event_create",
			"yzj_calendar_event_update",
			"yzj_calendar_event_delete",
			"yzj_calendar_event_participants",
			"yzj_calendar_room_find",
			"yzj_im_message_send",
			"yzj_im_message_recall",
			"yzj_im_message_list",
			"yzj_im_message_search",
			"yzj_im_group_recent",
			"yzj_im_group_search",
			"yzj_im_group_create",
			"yzj_im_group_rename",
			"yzj_im_group_members_add",
			"yzj_im_group_members_remove",
			"yzj_file_upload",
			"yzj_file_download",
			"present"
		];
		/** Short human titles per tool family. */
		const FAMILY_TITLES = {
			yzj_whoami: "我的信息",
			yzj_contact_search: "通讯录搜索",
			yzj_contact_get: "用户详情",
			yzj_doc_workspace_list: "知识库列表",
			yzj_doc_workspace_get: "知识库详情",
			yzj_doc_workspace_create: "新建知识库",
			yzj_doc_list: "文档列表",
			yzj_doc_get: "文档详情",
			yzj_doc_recent: "最近文档",
			yzj_doc_create: "新建文档",
			yzj_doc_folder_create: "新建文件夹",
			yzj_doc_rename: "重命名文档",
			yzj_doc_move: "移动文档",
			yzj_doc_delete: "删除文档",
			yzj_doc_import: "导入文档",
			yzj_doc_download_url: "文件下载链接",
			yzj_doc_search: "搜索文档",
			yzj_doc_write: "整篇写文档",
			yzj_doc_download: "下载文档",
			yzj_doc_block_list: "文档结构",
			yzj_doc_block_insert: "插入内容",
			yzj_doc_block_update: "更新内容",
			yzj_doc_block_delete: "删除内容",
			yzj_doc_block_replace: "替换内容",
			yzj_sheet_create: "新建多维表格",
			yzj_sheet_get: "多维表格结构",
			yzj_sheet_table_get: "数据表结构",
			yzj_sheet_table_create: "新建数据表",
			yzj_sheet_table_rename: "重命名数据表",
			yzj_sheet_table_delete: "删除数据表",
			yzj_sheet_record_list: "记录列表",
			yzj_sheet_record_create: "新增记录",
			yzj_sheet_record_update: "更新记录",
			yzj_sheet_record_delete: "删除记录",
			yzj_calendar_event_list: "日程列表",
			yzj_calendar_event_get: "日程详情",
			yzj_calendar_event_create: "新建日程",
			yzj_calendar_event_update: "更新日程",
			yzj_calendar_event_delete: "取消日程",
			yzj_calendar_event_participants: "日程参会人",
			yzj_calendar_room_find: "空闲会议室",
			yzj_im_message_send: "发送消息",
			yzj_im_message_recall: "撤回消息",
			yzj_im_message_list: "聊天记录",
			yzj_im_message_search: "搜索消息",
			yzj_im_group_recent: "最近会话",
			yzj_im_group_search: "搜索群组",
			yzj_im_group_create: "创建群组",
			yzj_im_group_rename: "修改群名",
			yzj_im_group_members_add: "拉人进群",
			yzj_im_group_members_remove: "移出群成员",
			yzj_file_upload: "上传文件",
			yzj_file_download: "下载文件",
			present: "对用户说"
		};
		function asRecord$15(value) {
			return typeof value === "object" && value !== null ? value : {};
		}
		function asString$11(value) {
			return typeof value === "string" ? value : "";
		}
		function asArray$9(value) {
			return Array.isArray(value) ? value : [];
		}
		function asNumber(value) {
			return typeof value === "number" ? value : void 0;
		}
		/** Stringify a field for display (numbers included). */
		function field(node, key) {
			const value = node[key];
			if (typeof value === "string") return value;
			if (typeof value === "number") return String(value);
			return "";
		}
		/** One display row. */
		function row$1(title, sub, key) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: cards_module_css_default.row,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: cards_module_css_default.rowTitle,
					children: title
				}), sub !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: cards_module_css_default.rowSub,
					children: sub
				})]
			}, key);
		}
		function linkRow(url, label, key) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
				className: cards_module_css_default.link,
				href: url,
				target: "_blank",
				rel: "noreferrer",
				children: label
			}, key);
		}
		/** Ghost jump button: opens the floating panel at this item. */
		function jumpRow(label, onClick, key) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: cards_module_css_default.jump,
				onClick,
				children: label
			}, key);
		}
		/** Generic list body from title/sub key lists (ids never displayed). */
		function listRows(list, titleKeys, subKeys) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: cards_module_css_default.rows,
				children: list.map((item, index) => {
					const node = asRecord$15(item);
					const title = titleKeys.map((key) => field(node, key)).find((value) => value !== "") ?? "";
					const sub = subKeys.map((key) => field(node, key)).filter((value) => value !== "").join(" · ");
					return row$1(title === "" ? `第 ${index + 1} 项` : title, sub, `x${index}`);
				})
			});
		}
		/** Workspace/doc node sub-line. */
		function nodeSub(node) {
			const suffix = asString$11(node.fileSuffix);
			const updated = asString$11(node.updateTime).slice(0, 10);
			return [suffix === "" ? "" : suffix === "dbt" ? "多维表格" : "在线文档", updated].filter((part) => part !== "").join(" · ");
		}
		/** Doc-domain body (workspaces, doc lists, doc records). */
		function DocBody(meta, openPanel, listKind) {
			const list = asArray$9(meta.list);
			if (list.length > 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: cards_module_css_default.rows,
				children: list.map((item, index) => {
					const node = asRecord$15(item);
					const name = asString$11(node.name) !== "" ? asString$11(node.name) : asString$11(node.title);
					const kind = asNumber(node.visibility) === 2 ? "个人" : "";
					const url = asString$11(node.openWebUrl);
					const id = asString$11(node.id);
					const jump = listKind === "workspace" ? id !== "" ? jumpRow("查看", () => openPanel({
						kind: "workspace",
						workspaceId: id
					}), `j${index}`) : null : id !== "" ? jumpRow("查看", () => openPanel({
						kind: "doc",
						docId: id
					}), `j${index}`) : null;
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: cards_module_css_default.rowWrap,
						children: [
							row$1(`${name}${kind === "" ? "" : ` · ${kind}`}`, nodeSub(node), `n${index}`),
							jump,
							url !== "" && linkRow(url, "打开", `l${index}`)
						]
					}, `n${index}`);
				})
			});
			const record = asRecord$15(meta.record);
			const title = asString$11(record.title) || asString$11(record.name);
			const link = asString$11(record.openWebUrl);
			const id = asString$11(record.id);
			if (title !== "") {
				const suffix = asString$11(record.fileSuffix);
				const perm = typeof record.permissionLevel === "number" ? {
					1: "可管理",
					2: "可编辑",
					3: "可查看",
					9: "无权限"
				}[record.permissionLevel] : void 0;
				const sub = [
					suffix === "dbt" ? "多维表格" : suffix === "otl" ? "在线文档" : "",
					perm ?? "",
					asString$11(record.creatorName),
					asString$11(record.updateTime).slice(0, 10)
				].filter((part) => part !== "").join(" · ");
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: cards_module_css_default.rows,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: cards_module_css_default.rowWrap,
						children: [
							row$1(title, sub, "r"),
							id !== "" && jumpRow("查看", () => openPanel({
								kind: "doc",
								docId: id
							}), "j"),
							link !== "" && linkRow(link, "打开文档", "l")
						]
					})
				});
			}
			return null;
		}
		/** Block list body: block text + its type label. */
		function BlockBody(meta) {
			const blocks = asArray$9(meta.list);
			if (blocks.length === 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: cards_module_css_default.rows,
				children: blocks.map((item, index) => {
					const block = asRecord$15(item);
					const type = asString$11(block.type);
					const content = asString$11(block.content).replace(/\s+/g, " ").slice(0, 80);
					return row$1(content === "" ? "(空块)" : content, type === "heading" ? "标题" : type === "paragraph" ? "段落" : type === "code" ? "代码" : type === "text" ? "文本" : type === "" ? "" : type, `b${index}`);
				})
			});
		}
		/** Sheet-domain body (schema, table structure, records). */
		function SheetBody(meta) {
			const sheets = asArray$9(asRecord$15(meta.schema).sheets);
			if (sheets.length > 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: cards_module_css_default.rows,
				children: sheets.map((item, index) => {
					const table = asRecord$15(item);
					const fields = asArray$9(table.fields).map((field) => asString$11(asRecord$15(field).name)).filter((name) => name !== "");
					return row$1(asString$11(table.name), fields.length === 0 ? "" : `字段：${fields.join(" / ")}`, `t${index}`);
				})
			});
			const table = asRecord$15(meta.table);
			if (asString$11(table.name) !== "") {
				const fields = asArray$9(table.fields).map((field) => asString$11(asRecord$15(field).name)).filter((name) => name !== "");
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: cards_module_css_default.rows,
					children: row$1(asString$11(table.name), fields.length === 0 ? "" : `字段：${fields.join(" / ")}`, "t")
				});
			}
			const records = asArray$9(meta.list);
			if (records.length > 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: cards_module_css_default.rows,
				children: records.map((item, index) => {
					const record = asRecord$15(item);
					const fields = asRecord$15(record.fieldsValue ?? record.fields);
					const values = Object.entries(fields).map(([key, value]) => {
						const text = typeof value === "string" ? value : JSON.stringify(value);
						return `${key}: ${text.length > 40 ? `${text.slice(0, 40)}…` : text}`;
					});
					return row$1(values.join(" · ") === "" ? "(空记录)" : values.join(" · "), "", `r${index}`);
				})
			});
			return null;
		}
		/** Calendar-domain body (events). */
		function CalendarBody(meta, openPanel) {
			const events = asArray$9(meta.list);
			if (events.length === 0) return null;
			const clock = (ms) => {
				if (typeof ms !== "number") return "";
				const date = new Date(ms);
				const pad = (n) => String(n).padStart(2, "0");
				return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: cards_module_css_default.rows,
				children: events.map((item, index) => {
					const event = asRecord$15(item);
					const start = clock(event.startDate);
					const end = clock(event.endDate);
					const time = start === "" ? "" : `${start}${end === "" ? "" : ` → ${end}`}`;
					const person = asString$11(event.personName);
					const id = asString$11(event.id);
					const startMs = typeof event.startDate === "number" ? event.startDate : 0;
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: cards_module_css_default.rowWrap,
						children: [row$1(asString$11(event.title), [time, person].filter((part) => part !== "").join(" · "), `e${index}`), id !== "" && startMs > 0 && jumpRow("查看", () => openPanel({
							kind: "event",
							event: {
								id,
								startDate: startMs,
								title: asString$11(event.title)
							}
						}), `j${index}`)]
					}, `e${index}`);
				})
			});
		}
		/** IM-domain body (messages / recent groups). */
		function ImBody(meta, openPanel) {
			const messages = asArray$9(meta.list);
			if (messages.length > 0 && asString$11(asRecord$15(messages[0]).sendTime) !== "") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: cards_module_css_default.rows,
				children: messages.map((item, index) => {
					const message = asRecord$15(item);
					const time = asString$11(message.sendTime).slice(5, 16);
					const content = asString$11(message.content);
					const reply = asString$11(asRecord$15(message.param).replySummary);
					return row$1(content === "" ? "(文件/图片消息)" : content, [time, reply === "" ? "" : `↳ ${reply}`].filter((part) => part !== "").join(" · "), `m${index}`);
				})
			});
			const groups = messages;
			if (groups.length > 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: cards_module_css_default.rows,
				children: groups.map((item, index) => {
					const group = asRecord$15(item);
					const unread = asNumber(group.unreadCount);
					const last = asString$11(asRecord$15(group.lastMsg).content);
					const groupId = asString$11(group.groupId);
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: cards_module_css_default.rowWrap,
						children: [row$1(asString$11(group.groupName), [unread !== void 0 && unread > 0 ? `未读 ${unread}` : "", last.replace(/\s+/g, " ").slice(0, 40)].filter((part) => part !== "").join(" · "), `g${index}`), groupId !== "" && jumpRow("查看", () => openPanel({
							kind: "group",
							groupId
						}), `j${index}`)]
					}, `g${index}`);
				})
			});
			return null;
		}
		/** Contact-domain body (whoami / search / details). */ function ContactBody(meta) {
			const list = asArray$9(meta.list);
			const record = asRecord$15(meta.record);
			const users = list.length > 0 ? list : [record];
			if (users.length === 0 || list.length === 0 && Object.keys(record).length === 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: cards_module_css_default.rows,
				children: users.map((item, index) => {
					const user = asRecord$15(item);
					const name = asString$11(user.name);
					const sub = [asString$11(user.department ?? user.fulldepartment), asString$11(user.jobTitle)].filter((part) => part !== "").join(" · ");
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: cards_module_css_default.row,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: cards_module_css_default.rowTitle,
							children: [typeof user.photoUrl === "string" && user.photoUrl !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
								className: cards_module_css_default.avatar,
								src: user.photoUrl,
								alt: "",
								referrerPolicy: "no-referrer"
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: cards_module_css_default.avatarFallback,
								children: name.slice(0, 1)
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: name })]
						}), sub !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: cards_module_css_default.rowSub,
							children: sub
						})]
					}, `u${index}`);
				})
			});
		}
		/** Friendly summary for action results (ids never shown). */
		function ActionBody(meta, toolName) {
			const rowsOut = [];
			const link = asString$11(meta.link);
			const url = asString$11(meta.url);
			const output = asString$11(meta.output);
			const recordIds = asArray$9(meta.recordIds);
			const push = (title, sub, key) => {
				rowsOut.push(row$1(title, sub, key));
			};
			if (toolName === "yzj_im_message_send") push("消息已发送", "", "sent");
			else if (toolName === "yzj_im_message_recall") push("消息已撤回", "", "recall");
			else if (toolName === "yzj_file_upload") push("上传成功", "", "up");
			else if (toolName === "yzj_file_download") push("已下载到本地", output, "dl");
			else if (toolName === "yzj_doc_download_url") {} else if (toolName.includes("_delete")) push("已删除", "", "del");
			else if (toolName.includes("_create")) push("已创建", "", "cr");
			else if (toolName.includes("_rename")) push("已重命名", "", "rn");
			else if (toolName.includes("_move")) push("已移动", "", "mv");
			else if (toolName.includes("_insert")) push("已插入内容", "", "ins");
			else if (toolName.includes("_update")) push("已更新", recordIds.length > 0 ? `${recordIds.length} 条记录` : "", "upd");
			else push("已完成", "", "done");
			if (url !== "") rowsOut.push(linkRow(url, "下载链接", "url"));
			if (link !== "") rowsOut.push(linkRow(link, "打开", "link"));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: cards_module_css_default.rows,
				children: rowsOut
			});
		}
		/** Family icon for the card header. */
		function familyIcon(toolName) {
			if (toolName.startsWith("yzj_im_")) return toolName === "yzj_im_message_send" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSendOutline14, {}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconNewChatOutline16, {});
			if (toolName.startsWith("yzj_contact_") || toolName === "yzj_whoami") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconUserOutline16, {});
			if (toolName.startsWith("yzj_sheet_")) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconDataOutline16, {});
			if (toolName.startsWith("yzj_calendar_")) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChecklistOutline14, {});
			if (toolName.startsWith("yzj_file_")) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutline14, {});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenOutline16, {});
		}
		/**
		* The keyed atomic tool view: one card for every yzj tool. Pending calls
		* show the family icon and an 执行中 pill; settled calls render structured
		* rows (or a friendly action summary) — the raw digest (which carries ids)
		* is never shown to the human, and error text keeps the pill red.
		*/
		function YzjToolCard({ toolName, block, openPanel }) {
			const family = FAMILY_TITLES[toolName] ?? "云之家";
			const jump = openPanel ?? (() => {});
			if (!("kind" in block) || block.kind !== "tool-result") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: cards_module_css_default.card,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: cards_module_css_default.header,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: cards_module_css_default.iconBox,
							children: familyIcon(toolName)
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: cards_module_css_default.title,
							children: family
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: `${cards_module_css_default.tag} ${cards_module_css_default.tagRun}`,
							children: "执行中"
						})
					]
				})
			});
			if (block.isError) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: `${cards_module_css_default.card} ${cards_module_css_default.errorCard}`,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: cards_module_css_default.header,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: cards_module_css_default.iconBox,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseFill14, {})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: cards_module_css_default.title,
							children: family
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: `${cards_module_css_default.tag} ${cards_module_css_default.tagFail}`,
							children: "失败"
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: cards_module_css_default.text,
					children: resultText(block)
				})]
			});
			const meta = asRecord$15(block.meta);
			let body = null;
			if (toolName === "yzj_doc_block_list") body = BlockBody(meta);
			else if (toolName === "yzj_calendar_event_participants") body = listRows(asArray$9(meta.list), ["name"], ["jobTitle", "department"]);
			else if (toolName === "yzj_calendar_room_find") body = listRows(asArray$9(meta.list), ["name", "title"], ["capacity", "floor"]);
			else if (toolName.startsWith("yzj_doc_")) body = DocBody(meta, jump, toolName === "yzj_doc_workspace_list" || toolName === "yzj_doc_workspace_get" ? "workspace" : "doc");
			else if (toolName.startsWith("yzj_sheet_")) body = SheetBody(meta);
			else if (toolName.startsWith("yzj_calendar_")) body = CalendarBody(meta, jump);
			else if (toolName.startsWith("yzj_im_")) body = ImBody(meta, jump);
			else if (toolName.startsWith("yzj_contact_") || toolName === "yzj_whoami") body = ContactBody(meta);
			if (body === null) body = ActionBody(meta, toolName);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: cards_module_css_default.card,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: cards_module_css_default.header,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: cards_module_css_default.iconBox,
							children: familyIcon(toolName)
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: cards_module_css_default.title,
							children: family
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: cards_module_css_default.tag,
							children: "云之家"
						})
					]
				}), body]
			});
		}
		/** Settled result text blocks, flattened (error messages only). */
		function resultText(block) {
			return block.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
		}
		//#endregion
		//#region src/cli-payload.ts
		const ENVELOPE_KEYS = /* @__PURE__ */ new Set([
			"success",
			"identity",
			"data",
			"error"
		]);
		function asRecord$14(value) {
			return typeof value === "object" && value !== null ? value : {};
		}
		/** Peel `{success:true, data}` down to `data`; pass through unwrapped payloads. */
		function unwrapCli(json) {
			if (json === void 0 || json === null) return json;
			if (Array.isArray(json) || typeof json !== "object") return json;
			const rec = json;
			if (rec.success === true && "data" in rec) return rec.data === void 0 || rec.data === null ? {} : rec.data;
			if (rec.success === true && rec.identity !== void 0) {
				if (Object.keys(rec).filter((key) => !ENVELOPE_KEYS.has(key)).length === 0) return rec.data ?? {};
			}
			return json;
		}
		/**
		* Record array for panel RPC values: bare array, `{list}`, or leftover
		* `{data:{list}}` if the host did not unwrap.
		*/
		function cliRows(value) {
			const payload = unwrapCli(value);
			if (Array.isArray(payload)) return payload;
			const rec = asRecord$14(payload);
			if (Array.isArray(rec.list)) return rec.list;
			if (Array.isArray(rec.data)) return rec.data;
			const inner = asRecord$14(rec.data);
			if (Array.isArray(inner.list)) return inner.list;
			return [];
		}
		//#endregion
		//#region src/client/context.ts
		/** In-memory ref → context cache, keyed by a stable ref string. */
		const contextCache = /* @__PURE__ */ new Map();
		function yzjRefKey(ref) {
			return `${ref.kind}:${ref.id}`;
		}
		function asRecord$13(value) {
			return typeof value === "object" && value !== null ? value : {};
		}
		function asArray$8(value) {
			return Array.isArray(value) ? value : [];
		}
		function asString$10(value) {
			return typeof value === "string" ? value : "";
		}
		/** Compact clock for event ms timestamps. */
		function clock$1(ms) {
			if (typeof ms !== "number") return "";
			const date = new Date(ms);
			const pad = (n) => String(n).padStart(2, "0");
			return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
		}
		/** Extract plain text from a doc block subtree (heading/paragraph/code/text). */
		function blockText(node) {
			const record = asRecord$13(node);
			const parts = [];
			const own = asString$10(record.content);
			if (own !== "") parts.push(own);
			const childArray = asArray$8(record.childNodes ?? record.children);
			if (childArray.length > 0) for (const child of childArray) {
				const childText = blockText(child);
				if (childText !== "") parts.push(childText);
			}
			else if (Array.isArray(record.content)) for (const item of record.content) {
				const childText = blockText(item);
				if (childText !== "") parts.push(childText);
			}
			return parts.join(" ").replace(/\s+/g, " ").trim();
		}
		/** Fetch one reference's context block; caches per ref key. */
		async function fetchRefContext(inject, ref) {
			const key = yzjRefKey(ref);
			const cached = contextCache.get(key);
			if (cached !== void 0) return cached;
			const lines = [];
			lines.push(`【云之家·${{
				workspace: "知识库",
				doc: "文档",
				group: "会话",
				event: "日程",
				contact: "联系人",
				message: "消息"
			}[ref.kind] ?? ref.kind}】${ref.title}`);
			try {
				switch (ref.kind) {
					case "workspace": {
						const result = await inject.fetchWorkspace(ref.id);
						if (result.ok) {
							const ws = asRecord$13(unwrapCli(result.value));
							lines.push(`类型：${asString$10(ws.bizType) === "" ? "知识库" : asString$10(ws.bizType)} · 文档 ${typeof ws.docCount === "number" ? ws.docCount : "?"} 篇 · 成员 ${typeof ws.memberCount === "number" ? ws.memberCount : "?"} 人`);
							if (asString$10(ws.description) !== "") lines.push(`简介：${asString$10(ws.description)}`);
						}
						break;
					}
					case "doc": {
						const [infoResult, blocksResult] = await Promise.all([inject.fetchDoc(ref.id), inject.fetchDocBlocks(ref.id)]);
						if (infoResult.ok) {
							const node = asRecord$13(unwrapCli(infoResult.value));
							const suffix = asString$10(node.fileSuffix);
							lines.push(`类型：${suffix === "dbt" ? "多维表格" : "在线文档"} · 更新 ${asString$10(node.updateTime).slice(0, 10)} · 创建人 ${asString$10(node.creatorName) === "" ? "未知" : asString$10(node.creatorName)}`);
							const link = asString$10(node.openWebUrl);
							if (link !== "") lines.push(`链接：${link}`);
						}
						if (blocksResult.ok) {
							const blocksValue = asRecord$13(unwrapCli(blocksResult.value));
							const excerpt = asArray$8(asRecord$13(blocksValue.data).blocks ?? blocksValue.blocks).slice(0, 10).map(blockText).filter((text) => text !== "").join(" ");
							if (excerpt !== "") {
								lines.push(`内容摘要：${excerpt.length > 500 ? `${excerpt.slice(0, 500)}…` : excerpt}`);
								lines.push("（内容为摘要，完整内容可用 yzj_doc_block_list / yzj_doc_get 获取）");
							}
						}
						if (infoResult.ok && asString$10(asRecord$13(unwrapCli(infoResult.value)).fileSuffix) === "dbt") {
							const sheetResult = await inject.fetchSheet(ref.id);
							if (sheetResult.ok) {
								const sheetValue = asRecord$13(unwrapCli(sheetResult.value));
								const tableLines = asArray$8(sheetValue.sheets ?? asRecord$13(sheetValue.data).sheets).slice(0, 5).map((item) => {
									const table = asRecord$13(item);
									const fields = asArray$8(table.fields).map((field) => asString$10(asRecord$13(field).name)).filter((name) => name !== "");
									return `- ${asString$10(table.name)}${fields.length === 0 ? "" : `：${fields.join(" / ")}`}`;
								});
								if (tableLines.length > 0) lines.push(`表结构：\n${tableLines.join("\n")}`);
							}
						}
						break;
					}
					case "group": {
						lines.push(`会话ID：${ref.id}`);
						const result = await inject.fetchMessages(ref.id, 8);
						if (result.ok) {
							const preview = [...cliRows(result.value)].reverse().slice(0, 6).map((item) => {
								const message = asRecord$13(item);
								const time = asString$10(message.sendTime).slice(5, 16);
								const body = asString$10(message.content);
								return `[${time}] ${body === "" ? "(文件/图片消息)" : body.replace(/\s+/g, " ").slice(0, 60)}`;
							});
							if (preview.length > 0) lines.push(`最近消息：\n${preview.join("\n")}`);
						}
						break;
					}
					case "event": {
						const result = await inject.fetchEvent(ref.id);
						if (result.ok) {
							const event = asRecord$13(unwrapCli(result.value));
							const span = [clock$1(event.startDate), clock$1(event.endDate)].filter((part) => part !== "").join(" → ");
							lines.push(`时间：${span === "" ? "未知" : span}`);
							if (asString$10(event.personName) !== "") lines.push(`组织者：${asString$10(event.personName)}`);
							if (asString$10(event.content) !== "") lines.push(`描述：${asString$10(event.content).slice(0, 200)}`);
						}
						break;
					}
					case "contact": {
						const result = await inject.fetchContact(ref.id);
						if (result.ok) {
							const rec = asRecord$13(unwrapCli(result.value));
							const parts = [
								asString$10(rec.department),
								asString$10(rec.jobTitle),
								asString$10(rec.jobNo) === "" ? "" : `工号 ${asString$10(rec.jobNo)}`
							];
							lines.push(parts.filter((part) => part !== "").join(" · "));
						}
						break;
					}
					case "message": {
						const groupId = asString$10(ref.group);
						if (groupId !== "") {
							lines.push(`所属会话：${groupId}`);
							const result = await inject.fetchMessages(groupId, 20, {
								type: "new",
								msgId: ref.id
							});
							if (result.ok) {
								const hit = cliRows(result.value).find((item) => asString$10(asRecord$13(item).msgId) === ref.id);
								if (hit !== void 0) {
									const message = asRecord$13(hit);
									const body = asString$10(message.content);
									const from = asString$10(message.fromOpenId);
									lines.push(`发送人：${from === "" ? "(未知)" : from}`);
									lines.push(`原文：${body === "" ? `(${asString$10(message.msgType) === "" ? "消息" : asString$10(message.msgType)})` : body}`);
								} else lines.push(`内容（快照，原文可能已变）：${ref.title}`);
							} else lines.push(`内容（快照，原文可能已变）：${ref.title}`);
						} else lines.push(`内容（快照，原文可能已变）：${ref.title}`);
						if (asString$10(ref.sub) !== "") lines.push(`时间：${asString$10(ref.sub)}`);
						break;
					}
				}
			} catch {}
			const block = lines.join("\n");
			contextCache.set(key, block);
			return block;
		}
		/** Drop one cached context (used when a session resets). */
		function clearRefContextCache() {
			contextCache.clear();
		}
		//#endregion
		//#region src/client/input-source.ts
		/** Compact ref string persisted with the chip (lossless JSON payload). */
		function encodeRef(ref) {
			return `yzj:${JSON.stringify({
				kind: ref.kind,
				id: ref.id,
				title: ref.title,
				url: ref.url,
				sub: ref.sub,
				group: ref.group
			})}`;
		}
		/** Best-effort decode; unknown shapes return undefined. */
		function decodeRef(raw) {
			if (!raw.startsWith("yzj:")) return void 0;
			try {
				const parsed = JSON.parse(raw.slice(4));
				if (typeof parsed.kind !== "string" || typeof parsed.id !== "string" || typeof parsed.title !== "string") return void 0;
				const ref = {
					kind: parsed.kind,
					id: parsed.id,
					title: parsed.title
				};
				if (typeof parsed.url === "string" && parsed.url !== "") ref.url = parsed.url;
				if (typeof parsed.sub === "string" && parsed.sub !== "") ref.sub = parsed.sub;
				if (typeof parsed.group === "string" && parsed.group !== "") ref.group = parsed.group;
				return ref;
			} catch {
				return;
			}
		}
		const KIND_LABEL = {
			workspace: "知识库",
			doc: "文档",
			group: "会话",
			event: "日程",
			contact: "联系人",
			message: "消息"
		};
		/** Registered source name — the serializer routing key for reference chips. */
		const SOURCE_NAME = "云之家";
		/** Menu group names for the three candidate sets (journey 5 ordering). */
		const SOURCE_CONTACTS = "云之家 · 同事";
		const SOURCE_GROUPS = "云之家 · 会话";
		const SOURCE_DOCS = "云之家 · 文档";
		const KIND_ICON = {
			workspace: "📚",
			doc: "📄",
			group: "💬",
			event: "📅",
			contact: "👤",
			message: "✉️"
		};
		const caches = /* @__PURE__ */ new Map();
		/** Drop every session cache (used on connection/reset and in tests). */
		function clearYzjSourceCaches() {
			caches.clear();
		}
		function cacheOf(sessionId) {
			let cache = caches.get(sessionId);
			if (cache === void 0) {
				cache = {
					warm: null,
					workspaces: [],
					groups: [],
					docs: [],
					byName: /* @__PURE__ */ new Map(),
					byRef: /* @__PURE__ */ new Map()
				};
				caches.set(sessionId, cache);
			}
			return cache;
		}
		function asRecord$12(value) {
			return typeof value === "object" && value !== null ? value : {};
		}
		function asString$9(value) {
			return typeof value === "string" ? value : "";
		}
		/** Warm the catalog once per session: workspaces + recent groups + first-level docs. */
		function ensureWarm(cache, inject) {
			if (cache.warm !== null) return cache.warm;
			cache.warm = Promise.all([inject.fetchWorkspaces().then((result) => {
				if (result.ok) cache.workspaces = cliRows(result.value);
			}).catch(() => {}), inject.fetchGroups(20).then((result) => {
				if (result.ok) cache.groups = cliRows(result.value);
			}).catch(() => {})]).then(() => {
				const roots = cache.workspaces.slice(0, 3);
				return Promise.all(roots.map((workspace) => inject.fetchDocs(asString$9(asRecord$12(workspace).id)).then((result) => {
					if (result.ok) cache.docs = [...cache.docs, ...cliRows(result.value)];
				}).catch(() => {})));
			}).then(() => {});
			return cache.warm;
		}
		/** Register one candidate (name-unique within the session) and its ref. */
		function pushCandidate(cache, out, name, description, icon, ref) {
			if (cache.byName.has(name)) return;
			cache.byName.set(name, ref);
			cache.byRef.set(encodeRef(ref), ref);
			out.push({
				name,
				description,
				icon
			});
		}
		/** 同事: directory hits; requires a query (scoped to what the user can see). */
		function contactCandidates(cache, query, inject) {
			const q = query.trim();
			if (q === "") return Promise.resolve([]);
			return inject.fetchSearch(q).then((result) => {
				const out = [];
				if (result.ok) for (const item of cliRows(result.value)) {
					const user = asRecord$12(item);
					const name = asString$9(user.name);
					if (name === "") continue;
					const sub = [asString$9(user.department), asString$9(user.jobTitle)].filter((part) => part !== "").join(" · ");
					pushCandidate(cache, out, name, `👤 ${sub === "" ? "联系人" : sub}（仅你有权查看的范围）`, KIND_ICON.contact, {
						kind: "contact",
						id: asString$9(user.oId ?? user.openId),
						title: name
					});
				}
				return out;
			});
		}
		/** 会话: recent sessions from the warm snapshot, filtered by query. */
		function groupCandidates(cache, query) {
			const q = query.trim().toLowerCase();
			const out = [];
			for (const item of cache.groups) {
				const group = asRecord$12(item);
				const name = asString$9(group.groupName);
				if (name === "") continue;
				if (q !== "" && !name.toLowerCase().includes(q)) continue;
				const unread = typeof group.unreadCount === "number" ? group.unreadCount : 0;
				pushCandidate(cache, out, name, `💬 会话${unread > 0 ? ` · 未读 ${unread}` : ""}`, KIND_ICON.group, {
					kind: "group",
					id: asString$9(group.groupId),
					title: name
				});
			}
			return out;
		}
		/** 文档: knowledge-base docs from the warm snapshot, filtered by query. */
		function docCandidates(cache, query) {
			const q = query.trim().toLowerCase();
			const out = [];
			for (const item of cache.docs) {
				const node = asRecord$12(item);
				const title = asString$9(node.title);
				if (title === "") continue;
				if (q !== "" && !title.toLowerCase().includes(q)) continue;
				const kindText = asString$9(node.fileSuffix) === "dbt" ? "多维表格" : "文档";
				const updated = asString$9(node.updateTime).slice(0, 10);
				pushCandidate(cache, out, title, `📄 ${kindText}${updated === "" ? "" : ` · 更新 ${updated}`}`, KIND_ICON.doc, {
					kind: "doc",
					id: asString$9(node.id),
					title
				});
			}
			return out;
		}
		/** Insert payload for one ref. `source` must equal the registered source name. */
		function insertFor(source, ref) {
			return {
				source,
				ref: encodeRef(ref),
				label: `☁ ${ref.title}`,
				clipboardText: `【云之家·${KIND_LABEL[ref.kind]}】${ref.title}`
			};
		}
		/** Shared codec: serializes any yzj ref into its fetched context block. */
		function sharedCodec(inject) {
			return {
				clipboardText: (ref) => {
					const parsed = decodeRef(ref);
					return parsed === void 0 ? ref : `【云之家·${KIND_LABEL[parsed.kind]}】${parsed.title}`;
				},
				serialize: async (ref, signal) => {
					const parsed = decodeRef(ref);
					if (parsed === void 0) return ref;
					const context = await fetchRefContext(inject, parsed);
					signal.throwIfAborted();
					return `@yzj ${context}`;
				}
			};
		}
		/** The shared pick handler for every source. */
		function sharedOnPick(source) {
			return ({ candidate, session }) => {
				const ref = cacheOf(session.sessionId).byName.get(candidate.name);
				if (ref === void 0) return void 0;
				return { insert: insertFor(source, ref) };
			};
		}
		/** Build the four '@' sources (three candidate groups + the codec carrier). */
		function createYzjSources(inject) {
			const codec = sharedCodec(inject);
			const onPick = sharedOnPick;
			return [
				{
					trigger: "@",
					name: SOURCE_CONTACTS,
					order: 0,
					candidates: (session, req) => contactCandidates(cacheOf(session.sessionId), req.query, inject),
					onPick: onPick(SOURCE_CONTACTS),
					codec
				},
				{
					trigger: "@",
					name: SOURCE_GROUPS,
					order: 1,
					warm(session) {
						ensureWarm(cacheOf(session.sessionId), inject);
					},
					candidates: async (session, req) => {
						const cache = cacheOf(session.sessionId);
						await ensureWarm(cache, inject);
						return groupCandidates(cache, req.query);
					},
					onPick: onPick(SOURCE_GROUPS),
					codec
				},
				{
					trigger: "@",
					name: SOURCE_DOCS,
					order: 2,
					warm(session) {
						ensureWarm(cacheOf(session.sessionId), inject);
					},
					candidates: async (session, req) => {
						const cache = cacheOf(session.sessionId);
						await ensureWarm(cache, inject);
						return docCandidates(cache, req.query);
					},
					onPick: onPick(SOURCE_DOCS),
					codec
				},
				{
					trigger: "@",
					name: SOURCE_NAME,
					order: 9,
					candidates: () => Promise.resolve([]),
					onPick: () => void 0,
					codec
				}
			];
		}
		/** Register the three candidate groups plus the codec carrier source. */
		function applyYzjAtSource(ctx, inject) {
			const service = ctx.get("inputTriggers");
			if (service === void 0) return;
			const sources = createYzjSources(inject);
			ctx.effect(() => {
				const disposers = sources.map((source) => service.registerSource(source));
				return () => {
					for (const dispose of disposers) dispose();
				};
			}, "ui-yzj: @ sources");
			ctx.on("connection/reset", () => {
				clearRefContextCache();
				clearYzjSourceCaches();
			});
		}
		//#endregion
		//#region \0dsh-css:/Users/kingdee/dev/dsh-yzj/packages/ui-yzj/src/client/login-banner.module.css.mjs
		const css$4 = ".Jd1ZLq_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:10px;flex-direction:column;gap:8px;margin:8px 12px;padding:10px 12px;display:flex}.Jd1ZLq_compact{gap:6px;margin:8px 10px;padding:8px 10px}.Jd1ZLq_title{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600;line-height:18px}.Jd1ZLq_body,.Jd1ZLq_hint,.Jd1ZLq_status{color:var(--dsw-alias-label-secondary);margin:0;font-size:12px;line-height:18px}.Jd1ZLq_hint{color:var(--dsw-alias-label-tertiary);word-break:break-word}.Jd1ZLq_status{flex:none;padding:4px 0 10px}.Jd1ZLq_actions{flex-wrap:wrap;gap:6px;display:flex}.Jd1ZLq_primary,.Jd1ZLq_secondary{cursor:pointer;border-radius:8px;padding:8px 12px;font-family:inherit;font-size:12.5px;line-height:1}.Jd1ZLq_primary{background:var(--dsw-static-deepseek-100);color:var(--dsw-static-deepseek-600);border:none;font-weight:600}.Jd1ZLq_primary:hover:not(:disabled){filter:brightness(.97)}.Jd1ZLq_primary:disabled{cursor:progress;opacity:.7}.Jd1ZLq_secondary{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:0 0}.Jd1ZLq_secondary:hover{color:var(--dsw-alias-label-primary)}";
		const tagId$4 = "@dsh-yzj/bundle/login-banner.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$4) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@dsh-yzj/bundle";
			tag.dataset.pluginCss = tagId$4;
			tag.textContent = css$4;
			document.head.appendChild(tag);
		}
		var login_banner_module_css_default = {
			"hint": "Jd1ZLq_hint",
			"actions": "Jd1ZLq_actions",
			"primary": "Jd1ZLq_primary",
			"card": "Jd1ZLq_card",
			"compact": "Jd1ZLq_compact",
			"status": "Jd1ZLq_status",
			"body": "Jd1ZLq_body",
			"title": "Jd1ZLq_title",
			"secondary": "Jd1ZLq_secondary"
		};
		//#endregion
		//#region src/client/login-banner.tsx
		/**
		* Yunzhijia CLI login card: probe status, open the system browser via
		* `yzj-cli auth login`, then re-probe. DSH never holds tokens.
		*/
		function asRecord$11(value) {
			return typeof value === "object" && value !== null ? value : {};
		}
		function asString$8(value) {
			return typeof value === "string" ? value : "";
		}
		/**
		* Login card. Renders nothing while checking; a one-line status when already
		* logged in (settings); the CTA when the CLI has no credentials.
		*/
		function YzjLoginBanner(props) {
			const [phase, setPhase] = (0, react.useState)("checking");
			const [name, setName] = (0, react.useState)("");
			const [hint, setHint] = (0, react.useState)("");
			const probe = async (afterLogin) => {
				const result = await props.authStatus();
				if (!result.ok) {
					setPhase("out");
					setHint(result.error.message);
					return;
				}
				const rec = asRecord$11(result.value);
				if (rec.loggedIn === true) {
					setName(asString$8(rec.name) || asString$8(rec.openId) || "已登录");
					setHint("");
					setPhase("in");
					if (afterLogin) props.onLoggedIn?.();
					return;
				}
				const reason = asString$8(rec.reason);
				setHint(afterLogin ? reason === "" ? "还没检测到登录，请确认浏览器里已完成授权后再试。" : reason : reason);
				setPhase(afterLogin ? "retry" : "out");
			};
			(0, react.useEffect)(() => {
				probe(false);
			}, []);
			const launch = async () => {
				setPhase("launching");
				setHint("");
				const result = await props.authLogin();
				if (!result.ok) {
					setPhase("out");
					setHint(result.error.message);
					return;
				}
				setPhase("waiting");
			};
			if (phase === "checking") return null;
			if (phase === "in") {
				if (props.compact === true) return null;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
					className: login_banner_module_css_default.status,
					"data-testid": "yzj-login-status",
					children: ["已登录 · ", name]
				});
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: `${login_banner_module_css_default.card} ${props.compact === true ? login_banner_module_css_default.compact : ""}`,
				"data-testid": "yzj-login-banner",
				role: "status",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
						className: login_banner_module_css_default.title,
						children: "云之家未登录"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: login_banner_module_css_default.body,
						children: phase === "waiting" || phase === "retry" ? "已打开系统浏览器。授权完成后点「我已登录」。" : props.compact === true ? "点按钮打开系统浏览器，用 yzj-cli 授权。DSH 不保存密码。" : "工作台复用本机 yzj-cli 登录态。点按钮会打开系统浏览器完成授权；凭据只进操作系统密钥链，DSH 碰不到。"
					}),
					hint !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: login_banner_module_css_default.hint,
						children: hint
					}),
					phase === "waiting" || phase === "retry" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: login_banner_module_css_default.actions,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: login_banner_module_css_default.primary,
							"data-testid": "yzj-login-confirm",
							onClick: () => {
								probe(true);
							},
							children: "我已登录"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: login_banner_module_css_default.secondary,
							"data-testid": "yzj-login-again",
							onClick: () => {
								launch();
							},
							children: "再打开一次"
						})]
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: login_banner_module_css_default.primary,
						"data-testid": "yzj-login-open",
						disabled: phase === "launching",
						onClick: () => {
							launch();
						},
						children: phase === "launching" ? "正在打开浏览器…" : "打开登录页"
					})
				]
			});
		}
		//#endregion
		//#region \0dsh-css:/Users/kingdee/dev/dsh-yzj/packages/ui-yzj/src/client/settings-section.module.css.mjs
		const css$3 = ".wCnkFq_section{flex-direction:column;gap:12px;max-width:760px;display:flex}.wCnkFq_switcher{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:10px;align-self:flex-start;gap:4px;padding:4px;display:inline-flex}.wCnkFq_seg,.wCnkFq_segOn{cursor:pointer;border:none;border-radius:7px;padding:8px 16px;font-family:inherit;font-size:12.5px;line-height:1}.wCnkFq_seg{color:var(--dsw-alias-label-secondary);background:0 0}.wCnkFq_seg:hover{color:var(--dsw-alias-label-primary)}.wCnkFq_segOn{background:var(--dsw-static-deepseek-100);color:var(--dsw-static-deepseek-600);font-weight:600}.wCnkFq_content{flex-direction:column;min-height:420px;display:flex}.wCnkFq_content>*{flex:1;min-height:0;max-height:min(70vh,640px);overflow-y:auto}.wCnkFq_assistants{border-top:1px solid var(--dsw-alias-border-l2,#2a2a2a);flex-direction:column;gap:10px;padding:12px 0 0;display:flex}.wCnkFq_assistantsTitle{font-size:14px;font-weight:600}.wCnkFq_assistantsHint{color:var(--dsw-alias-label-tertiary,#888);margin:0;font-size:12px}.wCnkFq_assistantList{margin:0;padding-left:18px;font-size:13px}.wCnkFq_field{color:var(--dsw-alias-label-secondary,#aaa);flex-direction:column;gap:4px;font-size:12px;display:flex}.wCnkFq_field input,.wCnkFq_field textarea{border:1px solid var(--dsw-alias-border-l2,#2a2a2a);background:var(--dsw-alias-bg-layer-1,#1c1c1c);color:var(--dsw-alias-label-primary,#eee);font:inherit;border-radius:8px;padding:8px 10px}.wCnkFq_alert{color:#c88;margin:0;font-size:12px}.wCnkFq_create{background:var(--dsw-static-deepseek-600,#3b82f6);color:#fff;font:inherit;cursor:pointer;border:0;border-radius:8px;align-self:flex-start;padding:8px 14px}.wCnkFq_create:disabled{opacity:.4;cursor:default}";
		const tagId$3 = "@dsh-yzj/bundle/settings-section.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$3) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@dsh-yzj/bundle";
			tag.dataset.pluginCss = tagId$3;
			tag.textContent = css$3;
			document.head.appendChild(tag);
		}
		var settings_section_module_css_default = {
			"assistants": "wCnkFq_assistants",
			"content": "wCnkFq_content",
			"assistantsHint": "wCnkFq_assistantsHint",
			"switcher": "wCnkFq_switcher",
			"field": "wCnkFq_field",
			"seg": "wCnkFq_seg",
			"segOn": "wCnkFq_segOn",
			"section": "wCnkFq_section",
			"assistantsTitle": "wCnkFq_assistantsTitle",
			"assistantList": "wCnkFq_assistantList",
			"create": "wCnkFq_create",
			"alert": "wCnkFq_alert"
		};
		//#endregion
		//#region src/client/settings-section.tsx
		/**
		* The 云之家 settings section (设置 → 云之家): login + 新建助手.
		* 机器人/记忆管理卡已随决策 53 退役。IM 壳助手是 1..N 条单聊，不是一群一机器人。
		*/
		function asRecord$10(value) {
			return typeof value === "object" && value !== null ? value : {};
		}
		function asArray$7(value) {
			return Array.isArray(value) ? value : [];
		}
		function asString$7(value) {
			return typeof value === "string" ? value : "";
		}
		/** The 云之家 settings section: login + assistant catalog. */
		function YzjSettingsSection(props) {
			const face = props;
			const [assistants, setAssistants] = (0, react.useState)([]);
			const [name, setName] = (0, react.useState)("");
			const [prompt, setPrompt] = (0, react.useState)("");
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)("");
			const reload = async () => {
				const listed = await face.assistantsList?.();
				if (listed === void 0 || !listed.ok) return;
				const rows = asArray$7(asRecord$10(listed.value).assistants).flatMap((item) => {
					const row = asRecord$10(item);
					const id = asString$7(row.id);
					if (id === "") return [];
					return [{
						id,
						name: asString$7(row.name) || "助手"
					}];
				});
				setAssistants(rows);
			};
			(0, react.useEffect)(() => {
				reload();
			}, [face.assistantsList]);
			const create = async () => {
				const trimmed = name.trim();
				if (trimmed === "" || busy) return;
				setBusy(true);
				setError("");
				const result = await face.assistantsCreate?.(trimmed, prompt.trim() === "" ? void 0 : prompt.trim());
				setBusy(false);
				if (result === void 0 || !result.ok) {
					setError(result?.error.message ?? "新建失败");
					return;
				}
				setName("");
				setPrompt("");
				await reload();
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_section_module_css_default.section,
				children: [face.authStatus !== void 0 && face.authLogin !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(YzjLoginBanner, {
					authStatus: face.authStatus,
					authLogin: face.authLogin,
					onLoggedIn: () => {}
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_section_module_css_default.assistants,
					"data-testid": "yzj-settings-assistants",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: settings_section_module_css_default.assistantsTitle,
							children: "助手"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: settings_section_module_css_default.assistantsHint,
							children: "特殊单聊，不是一群一机器人。出厂一条「助手」。"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
							className: settings_section_module_css_default.assistantList,
							children: assistants.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: row.name }, row.id))
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: settings_section_module_css_default.field,
							children: ["名称", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								value: name,
								placeholder: "新建助手",
								"aria-label": "助手名称",
								onChange: (event) => setName(event.target.value)
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: settings_section_module_css_default.field,
							children: ["说明（可选）", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
								value: prompt,
								placeholder: "可选：技能/口吻备注",
								"aria-label": "助手说明",
								rows: 3,
								onChange: (event) => setPrompt(event.target.value)
							})]
						}),
						error !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: settings_section_module_css_default.alert,
							role: "alert",
							children: error
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: settings_section_module_css_default.create,
							"data-testid": "yzj-create-assistant",
							disabled: busy || name.trim() === "",
							onClick: () => {
								create();
							},
							children: "新建助手"
						})
					]
				})]
			});
		}
		//#endregion
		//#region src/client/rpc.ts
		/** Build the inject face from a connection handle; unavailable → failed calls. */
		function createYzjPanelInject(connection) {
			const call = async (endpoint, payload) => {
				if (connection === void 0) return {
					ok: false,
					error: { message: "connection unavailable" }
				};
				const result = await connection.rpc.call("/yzj", endpoint, payload);
				if (result.ok) return {
					ok: true,
					value: result.value
				};
				return {
					ok: false,
					error: { message: result.error.message }
				};
			};
			return {
				fetchWorkspaces: (type) => call("workspaces", type === void 0 ? {} : { type }),
				fetchDocs: (workspace, parentId) => call("docs", parentId === void 0 ? { workspace } : {
					workspace,
					parentId
				}),
				fetchDocSearch: (keyword, workspace) => call("doc-search", workspace === void 0 ? { keyword } : {
					keyword,
					workspace
				}),
				fetchEvents: (start, end) => call("events", {
					start,
					end
				}),
				fetchGroups: (limit, page) => call("groups", {
					...limit === void 0 ? {} : { limit },
					...page === void 0 ? {} : { page }
				}),
				fetchMessages: (groupId, limit, page) => call("messages", {
					groupId,
					...limit === void 0 ? {} : { limit },
					...page === void 0 ? { type: "newest" } : page
				}),
				fetchWhoami: () => call("whoami", {}),
				authStatus: () => call("auth-status", {}),
				authLogin: () => call("auth-login", {}),
				fetchSearch: (keyword) => call("search", { keyword }),
				fetchDoc: (id) => call("doc-get", { id }),
				fetchDocBlocks: (id, blockId) => call("doc-blocks", blockId === void 0 ? { id } : {
					id,
					blockId
				}),
				fetchSheet: (id) => call("sheet-get", { id }),
				fetchWorkspace: (id) => call("workspace-get", { id }),
				fetchEvent: (id) => call("event-get", { id }),
				fetchContact: (openId) => call("contact-get", { openId }),
				fetchFileData: (fileId) => call("file-data", { fileId }),
				sendMessage: (groupId, content, opts) => call("im-send", {
					groupId,
					...content === void 0 ? {} : { content },
					...opts?.msgType === void 0 ? {} : { msgType: opts.msgType },
					...opts?.fileId === void 0 ? {} : { fileId: opts.fileId },
					...opts?.images === void 0 ? {} : { images: opts.images },
					...opts?.replyMsgId === void 0 ? {} : { replyMsgId: opts.replyMsgId },
					...opts?.atOpenIds === void 0 ? {} : { atOpenIds: opts.atOpenIds },
					...opts?.atAll !== true ? {} : { atAll: true }
				}),
				uploadFile: (name, base64, size) => call("file-upload", {
					name,
					base64,
					size
				}),
				imCacheGet: (key) => call("im-cache-get", { key }),
				imCachePut: (key, payload, fetchedAt) => call("im-cache-put", {
					key,
					payload,
					fetchedAt
				}),
				fetchWrite: (sessionId, callId) => call("write-list", {
					sessionId,
					callId
				}),
				decideWrite: (writeId, outcome) => call("write-decide", {
					writeId,
					outcome
				}),
				modelDefault: () => call("model-default", {}),
				modelSetDefault: (provider, model) => call("model-default-set", {
					provider,
					model
				}),
				modelClearDefault: () => call("model-default-clear", {}),
				modelCatalog: () => call("model-catalog", {}),
				homeOpen: (groupId, title) => call("home-open", {
					groupId,
					...title === void 0 || title === "" ? {} : { title }
				}),
				homeBinding: (sessionId) => call("home-binding", { sessionId }),
				homeFused: (sessionId, groupId) => call("home-fused", groupId !== void 0 && groupId !== "" ? { groupId } : { sessionId }),
				homeNav: () => call("home-nav", {}),
				homeTopicOpen: (input) => call("home-topic-open", input),
				homeTopicLens: (sessionId) => call("home-topic-lens", { sessionId }),
				homeTopicAsk: (sessionId, text) => call("home-topic-ask", {
					sessionId,
					text
				}),
				homeBackfill: (sessionId, opts) => call("home-backfill", {
					sessionId,
					...opts?.groupId === void 0 || opts.groupId === "" ? {} : { groupId: opts.groupId },
					...opts?.beforeMsgId === void 0 ? {} : { beforeMsgId: opts.beforeMsgId },
					...opts?.limit === void 0 ? {} : { limit: opts.limit }
				}),
				homeSend: (sessionId, content, opts) => call("home-send", {
					sessionId,
					...opts?.groupId === void 0 || opts.groupId === "" ? {} : { groupId: opts.groupId },
					...content === void 0 ? {} : { content },
					...opts?.msgType === void 0 ? {} : { msgType: opts.msgType },
					...opts?.fileId === void 0 ? {} : { fileId: opts.fileId },
					...opts?.images === void 0 ? {} : { images: opts.images },
					...opts?.replyMsgId === void 0 ? {} : { replyMsgId: opts.replyMsgId },
					...opts?.atOpenIds === void 0 ? {} : { atOpenIds: opts.atOpenIds },
					...opts?.atAll !== true ? {} : { atAll: true }
				}),
				assistantsList: () => call("assistants-list", {}),
				assistantsCreate: (name, prompt) => call("assistants-create", {
					name,
					...prompt === void 0 || prompt === "" ? {} : { prompt }
				}),
				assistantAsk: (assistantId, text) => call("assistant-ask", {
					assistantId,
					text
				}),
				assistantThreadAsk: (input) => call("assistant-thread-ask", input),
				assistantProjection: (input) => call("assistant-projection", input),
				assistantThreads: (groupId) => call("assistant-threads", { groupId }),
				assistantProcess: (assistantId) => call("assistant-process", { assistantId })
			};
		}
		//#endregion
		//#region src/client/im-seat.ts
		let seat;
		const listeners$2 = /* @__PURE__ */ new Set();
		function emit() {
			for (const listener of listeners$2) listener();
		}
		/** Remember a room after open / topic bind / nav prefetch. */
		function rememberImSeat(next) {
			if (next.groupId === "") return;
			seat = {
				groupId: next.groupId,
				sessionId: next.sessionId,
				...next.groupName === void 0 || next.groupName === "" ? {} : { groupName: next.groupName }
			};
			emit();
		}
		/** Last remembered seat, if any. */
		function peekImSeat() {
			return seat;
		}
		//#endregion
		//#region src/client/host-chrome.ts
		/**
		* Hide host ConversationRoot chrome while the IM shell owns the surface.
		* Must not depend on `[data-composer-seat]` (absent on harness 0.1.2-alpha.3;
		* rc.7 overlay:true also leaves the fallback InputBar mounted — pitfall-052).
		*/
		const HIDDEN_ATTR = "data-yzj-host-hidden";
		const HOST_SELECTORS = [
			"[data-composer-seat]",
			"[data-composer-card]",
			"[class*=\"composerSeat\"]",
			"[class*=\"composerStack\"]",
			"[class*=\"composerHero\"]",
			"[class*=\"InputBar\"]",
			"[class*=\"titleRow\"]",
			"[class*=\"headerUtilities\"]",
			"[class*=\"headerActions\"]",
			"[class*=\"sessionLogButton\"]"
		];
		const IM_OWNED = "[data-yzj-im-composer], [data-yzj-im-header], [data-yzj-inbox-host], [data-yzj-surface-switch], [data-yzj-surface-chrome], [data-yzj-surface-root], [data-testid=\"yzj-inbox\"]";
		function ownedByIm(node) {
			return node.closest(IM_OWNED) !== null;
		}
		function collapse(el) {
			if (ownedByIm(el)) return;
			if (el.hasAttribute("data-conversation-scroll")) return;
			if (el.querySelector("[data-yzj-im-composer], [data-yzj-im-header]") !== null) return;
			if (el.hasAttribute(HIDDEN_ATTR)) return;
			el.setAttribute(HIDDEN_ATTR, "");
			el.setAttribute("hidden", "");
			el.style.setProperty("display", "none", "important");
			el.style.setProperty("height", "0", "important");
			el.style.setProperty("min-height", "0", "important");
			el.style.setProperty("overflow", "hidden", "important");
			el.style.setProperty("padding", "0", "important");
			el.style.setProperty("margin", "0", "important");
		}
		function restore(el) {
			el.removeAttribute(HIDDEN_ATTR);
			el.removeAttribute("hidden");
			el.style.removeProperty("display");
			el.style.removeProperty("height");
			el.style.removeProperty("min-height");
			el.style.removeProperty("overflow");
			el.style.removeProperty("padding");
			el.style.removeProperty("margin");
		}
		function restoreAll() {
			if (typeof document === "undefined") return;
			for (const el of document.querySelectorAll(`[${HIDDEN_ATTR}]`)) restore(el);
		}
		function hidePlaceholderHosts() {
			for (const node of document.querySelectorAll("textarea, input")) {
				if (!(node.getAttribute("placeholder") ?? "").includes("发消息或做任务")) continue;
				const wrap = node.closest("[data-composer-seat], [data-composer-card], [class*=\"composerStack\"], [class*=\"composerSeat\"], [class*=\"InputBar\"]") ?? (node.parentElement instanceof HTMLElement ? node.parentElement : null);
				if (wrap !== null) collapse(wrap);
			}
		}
		function hideSessionChromeButtons() {
			for (const btn of document.querySelectorAll("button")) {
				const label = `${btn.textContent ?? ""} ${btn.getAttribute("aria-label") ?? ""}`;
				if (!/Session\s*日志|Session log|标准模式/.test(label)) continue;
				const wrap = btn.closest("header, [class*=\"titleRow\"], [class*=\"headerUtilities\"], [class*=\"headerActions\"]");
				collapse(wrap instanceof HTMLElement ? wrap : btn);
			}
		}
		function hideStatsLines() {
			for (const el of document.querySelectorAll("div, span, p")) {
				if (ownedByIm(el)) continue;
				const text = (el.textContent ?? "").trim();
				if (text.length === 0 || text.length > 280) continue;
				if (!/^\d+\s*轮\s*·/.test(text)) continue;
				const wrap = el.closest("[data-composer-seat], [class*=\"composerStack\"], [class*=\"InputBar\"]");
				if (wrap === null || wrap.hasAttribute("data-conversation-scroll")) continue;
				collapse(wrap);
			}
		}
		function restoreComposerHeight() {
			for (const scroller of document.querySelectorAll("[data-conversation-scroll]")) scroller.style.removeProperty("--dsh-composer-height");
		}
		/**
		* Collapse host InputBar / session header / stats when IM occupancy is on.
		* No-op and restores when `html[data-dsh-yzj-im]` is absent (会话 surface).
		*/
		function applyHostChromeHide() {
			if (typeof document === "undefined") return;
			if (!document.documentElement.hasAttribute("data-dsh-yzj-im")) {
				restoreAll();
				restoreComposerHeight();
				return;
			}
			for (const selector of HOST_SELECTORS) for (const node of document.querySelectorAll(selector)) collapse(node);
			hidePlaceholderHosts();
			hideSessionChromeButtons();
			hideStatsLines();
			for (const scroller of document.querySelectorAll("[data-conversation-scroll]")) scroller.style.setProperty("--dsh-composer-height", "0px");
		}
		let watchers = 0;
		let observer;
		/**
		* Keep host chrome collapsed for the lifetime of IM occupancy.
		* Ref-counted so inbox mount and the composer chain can both subscribe.
		*/
		function watchHostChrome() {
			if (typeof document === "undefined") return () => {};
			watchers += 1;
			applyHostChromeHide();
			if (watchers === 1) {
				observer = new MutationObserver(() => {
					applyHostChromeHide();
				});
				observer.observe(document.documentElement, {
					childList: true,
					subtree: true,
					attributes: true,
					attributeFilter: ["data-dsh-yzj-im"]
				});
			}
			return () => {
				watchers -= 1;
				if (watchers > 0) return;
				observer?.disconnect();
				observer = void 0;
				restoreAll();
			};
		}
		let current$1 = {
			kind: "assistant",
			assistantId: "default"
		};
		let surface = "im";
		const listeners$1 = /* @__PURE__ */ new Set();
		function notify$1() {
			for (const listener of listeners$1) listener();
		}
		function isSurfaceSwitchTab(node) {
			return node.closest("[data-yzj-surface-switch]") !== null;
		}
		function findImViewTab() {
			return [...document.querySelectorAll("[role=\"tab\"]")].find((node) => !isSurfaceSwitchTab(node) && node.textContent?.trim() === "助手");
		}
		/**
		* Host tab buttons have no view-id attribute — stamp ours so 会话 CSS can
		* hide the IM seat without unregistering conversation.view (still needed for
		* 消息). Surface switch stays unmarked.
		*/
		function markImViewTab() {
			if (typeof document === "undefined") return;
			for (const node of document.querySelectorAll("[data-yzj-im-view-tab]")) if (node.textContent?.trim() !== "助手" || isSurfaceSwitchTab(node)) node.removeAttribute("data-yzj-im-view-tab");
			const tab = findImViewTab();
			if (tab !== void 0) tab.setAttribute("data-yzj-im-view-tab", "");
		}
		function findHostChatTab() {
			const tabs = [...document.querySelectorAll("[role=\"tab\"]")].filter((node) => !isSurfaceSwitchTab(node));
			const labeled = tabs.find((node) => {
				const label = node.textContent?.trim() ?? "";
				return label === "对话" || label === "Chat";
			});
			if (labeled !== void 0) return labeled;
			return tabs.find((node) => {
				const label = node.textContent?.trim() ?? "";
				return label !== "助手" && label !== "消息" && label !== "会话";
			});
		}
		function applyDom() {
			if (typeof document === "undefined") return;
			markImViewTab();
			if (surface === "im") {
				document.documentElement.setAttribute("data-dsh-yzj-im", "");
				return;
			}
			document.documentElement.removeAttribute("data-dsh-yzj-im");
		}
		function selectImViewTab() {
			if (typeof document === "undefined") return;
			const tab = findImViewTab();
			if (tab !== void 0 && tab.getAttribute("aria-selected") !== "true") tab.click();
		}
		/** Click the host Chat view once when entering 会话 (do not loop in the observer). */
		function selectHostChatTab() {
			if (typeof document === "undefined") return;
			const tab = findHostChatTab();
			if (tab !== void 0 && tab.getAttribute("aria-selected") !== "true") tab.click();
		}
		/** Current inbox selection. Switching 消息/会话 does not clear this. */
		function getImSelection() {
			return current$1;
		}
		/** Select an inbox row. Does not change occupancy surface. */
		function setImSelection(next) {
			current$1 = next;
			applyDom();
			notify$1();
		}
		/** Subscribe to selection and occupancy-surface changes. */
		function subscribeImSelection(listener) {
			listeners$1.add(listener);
			return () => {
				listeners$1.delete(listener);
			};
		}
		/** Current occupancy: IM shell vs native local-session workbench. */
		function getImSurface() {
			return surface;
		}
		/**
		* Toggle occupancy. Inbox selection is preserved. `im` pins the 助手 view tab;
		* `session` unsets `html[data-dsh-yzj-im]` and clicks host Chat once.
		*/
		function setImSurface(next) {
			if (surface === next) {
				applyDom();
				if (next === "im") selectImViewTab();
				return;
			}
			surface = next;
			applyDom();
			if (next === "im") selectImViewTab();
			else selectHostChatTab();
			notify$1();
		}
		/**
		* Composer-chain election: IM occupancy paints a null seat; 会话 yields to
		* the official InputBar. Approval/question interactions always fall through.
		*/
		function electImComposer(interactions) {
			if (surface !== "im") return null;
			if (interactions.some((item) => item.kind === "approval" || item.kind === "question")) return null;
			return { im: true };
		}
		/**
		* Mark occupancy on first mount. IM surface keeps the 助手 view tab selected;
		* session surface must not steal other host views on later mutations.
		*/
		function markImOccupancy() {
			applyDom();
			if (surface === "im") selectImViewTab();
			if (typeof document === "undefined") return () => {};
			const stopChrome = watchHostChrome();
			const onHostTabClick = (event) => {
				const target = event.target;
				if (!(target instanceof Element)) return;
				const tab = target.closest("[role=\"tab\"]");
				if (tab === null || isSurfaceSwitchTab(tab)) return;
				if (surface === "session" && tab.textContent?.trim() === "助手") setImSurface("im");
			};
			document.addEventListener("click", onHostTabClick, true);
			const observer = new MutationObserver(() => {
				if (surface === "session") {
					applyDom();
					return;
				}
				applyDom();
				selectImViewTab();
			});
			observer.observe(document.body, {
				childList: true,
				subtree: true
			});
			return () => {
				observer.disconnect();
				document.removeEventListener("click", onHostTabClick, true);
				stopChrome();
				if (surface === "im") document.documentElement.removeAttribute("data-dsh-yzj-im");
			};
		}
		//#endregion
		//#region src/client/panel-controller.ts
		/**
		* Focus the IM shell on one item (card 查看详情 / write-card 查看上下文).
		* Only group targets have a surface; docs/calendar stay tool-card only.
		*/
		function openPanelTarget(target, _anchorMsgId) {
			if (target.kind !== "group") return;
			setImSelection({
				kind: "group",
				groupId: target.groupId
			});
			rememberImSeat({
				groupId: target.groupId,
				sessionId: ""
			});
		}
		//#endregion
		//#region src/client/home-focus.ts
		/**
		* Client helper: focus a bound DSH session once the session list is ready
		* and contains the id (harness list snapshot contract). Subscribe + timeout
		* so a just-created home can appear after the RPC returns.
		* @module @dsh-yzj/ui-yzj/client/home-focus
		*/
		const DEFAULT_FOCUS_TIMEOUT_MS = 8e3;
		/**
		* Open `sessionId` when the list is ready and the row exists. No-op on
		* timeout so a missing row never throws.
		*/
		function focusBoundSession(sessions, sessionId, timeoutMs = DEFAULT_FOCUS_TIMEOUT_MS) {
			const tryOpen = () => {
				const snap = sessions.list.getSnapshot();
				if (snap.phase !== "ready") return false;
				if (snap.byId?.[sessionId] === void 0) return false;
				sessions.open(sessionId);
				return true;
			};
			if (tryOpen()) return () => {};
			let settled = false;
			const unsubscribe = sessions.list.subscribe(() => {
				if (settled) return;
				if (tryOpen()) {
					settled = true;
					unsubscribe();
					clearTimeout(timer);
				}
			});
			const timer = setTimeout(() => {
				if (settled) return;
				settled = true;
				unsubscribe();
			}, timeoutMs);
			return () => {
				settled = true;
				unsubscribe();
				clearTimeout(timer);
			};
		}
		/**
		* Fire-and-forget: RPC bind then client focus. Missing homeOpen/focus is a
		* no-op so panel IM still loads without the home slice.
		*/
		function bindAndFocusGroup(homeOpen, focus, groupId, title) {
			if (homeOpen === void 0) return Promise.resolve();
			return (title === void 0 || title === "" ? homeOpen(groupId) : homeOpen(groupId, title)).then((result) => {
				if (!result.ok) return;
				const value = typeof result.value === "object" && result.value !== null ? result.value : {};
				const sessionId = typeof value.sessionId === "string" ? value.sessionId : "";
				if (sessionId !== "") {
					rememberImSeat({
						groupId,
						sessionId,
						...title === void 0 || title === "" ? {} : { groupName: title }
					});
					if (focus !== void 0) focus(sessionId);
				}
			});
		}
		//#endregion
		//#region src/client/write-card.tsx
		/**
		* Confirmation card for yzj write tools, registered into the keyed
		* `tool.call.toolview` seat for every gated write tool name. While a write
		* call sits in the approval gate (status pending/approved), the card shows
		* the full gated arguments by domain, the risk level (strong = red), and the
		* decision verbs (确认 / 取消 / 查看上下文 / 编辑). Settled or ungated calls
		* fall back to the ordinary result card, whose content comes from the
		* durable tool events — replay-safe by construction.
		*/
		/**
		* Every tool name gated by `@dsh-yzj/tool-yzj`'s approval guard. Keep in
		* sync with `tool-yzj/src/guard.ts` `WRITE_SPECS` (a mismatch only affects
		* which calls render the confirmation card, never the gate itself).
		*/
		const YZJ_WRITE_TOOL_NAMES = [
			"yzj_doc_delete",
			"yzj_doc_block_delete",
			"yzj_sheet_table_delete",
			"yzj_sheet_record_delete",
			"yzj_calendar_event_delete",
			"yzj_im_group_members_remove",
			"yzj_im_message_recall",
			"yzj_im_message_send",
			"yzj_file_upload",
			"yzj_file_download",
			"yzj_doc_move",
			"yzj_doc_workspace_create",
			"yzj_doc_create",
			"yzj_doc_folder_create",
			"yzj_doc_rename",
			"yzj_doc_import",
			"yzj_doc_write",
			"yzj_doc_block_replace",
			"yzj_doc_download",
			"yzj_doc_block_insert",
			"yzj_doc_block_update",
			"yzj_sheet_create",
			"yzj_sheet_table_create",
			"yzj_sheet_table_rename",
			"yzj_sheet_record_create",
			"yzj_sheet_record_update",
			"yzj_calendar_event_create",
			"yzj_calendar_event_update",
			"yzj_im_group_create",
			"yzj_im_group_rename",
			"yzj_im_group_members_add"
		];
		function asRecord$9(value) {
			return typeof value === "object" && value !== null ? value : {};
		}
		function asString$6(value) {
			return typeof value === "string" ? value : "";
		}
		function asArray$6(value) {
			return Array.isArray(value) ? value : [];
		}
		/** Short Chinese title per gated tool (mirrors cards.tsx families). */
		const WRITE_TITLES = {
			yzj_doc_delete: "删除文档",
			yzj_doc_block_delete: "删除内容",
			yzj_sheet_table_delete: "删除数据表",
			yzj_sheet_record_delete: "删除记录",
			yzj_calendar_event_delete: "取消日程",
			yzj_im_message_send: "发送消息",
			yzj_im_message_recall: "撤回消息",
			yzj_im_group_create: "创建群组",
			yzj_im_group_rename: "修改群名",
			yzj_im_group_members_add: "拉人进群",
			yzj_im_group_members_remove: "移出群成员",
			yzj_doc_folder_create: "新建文件夹",
			yzj_doc_write: "整篇写文档",
			yzj_doc_block_replace: "替换内容",
			yzj_doc_download: "下载文档",
			yzj_file_upload: "上传文件",
			yzj_file_download: "下载文件",
			yzj_doc_move: "移动文档",
			yzj_doc_workspace_create: "新建知识库",
			yzj_doc_create: "新建文档",
			yzj_doc_rename: "重命名文档",
			yzj_doc_import: "导入文档",
			yzj_doc_block_insert: "插入内容",
			yzj_doc_block_update: "更新内容",
			yzj_sheet_create: "新建多维表格",
			yzj_sheet_table_create: "新建数据表",
			yzj_sheet_table_rename: "重命名数据表",
			yzj_sheet_record_create: "新增记录",
			yzj_sheet_record_update: "更新记录",
			yzj_calendar_event_create: "新建日程",
			yzj_calendar_event_update: "更新日程"
		};
		/** Domain labels for the card header. */
		const DOMAIN_LABELS = {
			im: "消息",
			doc: "文档",
			kb: "知识库",
			sheet: "多维表格",
			calendar: "日程",
			file: "文件",
			other: "云之家"
		};
		function row(title, sub, key) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: cards_module_css_default.row,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: cards_module_css_default.rowTitle,
					children: title
				}), sub !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: cards_module_css_default.rowSub,
					children: sub
				})]
			}, key);
		}
		/** The full draft text a card's 编辑 verb restores into the composer. */
		function writableDraft(record) {
			const args = asRecord$9(record.args);
			const content = asString$6(args.content);
			if (content !== "") return content;
			const text = asString$6(args.text);
			if (text !== "") return text;
			const records = asString$6(args.records);
			if (records !== "") return records;
			const title = asString$6(args.title);
			if (title !== "") return title;
			return "";
		}
		/** The 查看上下文 jump: open the panel on the tab the write targets. */
		/** Resolve raw ids in the gated args to friendly names (per record). */
		function useResolvedNames(record, inject) {
			const [names, setNames] = (0, react.useState)({});
			(0, react.useEffect)(() => {
				if (record === void 0) return;
				let alive = true;
				const args = asRecord$9(record.args);
				const out = {};
				const tasks = [];
				const groupId = asString$6(args.groupId);
				if (record.domain === "im" && groupId !== "" && inject.fetchGroups !== void 0) tasks.push(inject.fetchGroups(20).then((result) => {
					if (!result.ok) return;
					const group = cliRows(result.value).map(asRecord$9).find((g) => asString$6(g.groupId) === groupId);
					if (group !== void 0 && asString$6(group.groupName) !== "") out[groupId] = asString$6(group.groupName);
				}).catch(() => {}));
				const docId = asString$6(args.id);
				if ((record.domain === "doc" || record.domain === "sheet") && docId !== "" && inject.fetchDoc !== void 0) tasks.push(inject.fetchDoc(docId).then((result) => {
					if (!result.ok) return;
					const node = asRecord$9(unwrapCli(result.value));
					const title = asString$6(node.title) !== "" ? asString$6(node.title) : asString$6(asRecord$9(node.data).title);
					if (title !== "") out[docId] = title;
				}).catch(() => {}));
				const workspace = asString$6(args.workspace);
				if (workspace !== "" && inject.fetchWorkspaces !== void 0) tasks.push(inject.fetchWorkspaces().then((result) => {
					if (!result.ok) return;
					const ws = cliRows(result.value).map(asRecord$9).find((w) => asString$6(w.id) === workspace);
					if (ws !== void 0 && asString$6(ws.name) !== "") out[workspace] = asString$6(ws.name);
				}).catch(() => {}));
				if (inject.fetchContact !== void 0) for (const raw of asArray$6(args.organizerOpenIds)) {
					const openId = asString$6(raw);
					if (openId === "") continue;
					tasks.push(inject.fetchContact(openId).then((result) => {
						if (!result.ok) return;
						const name = asString$6(asRecord$9(cliRows(result.value)[0] ?? unwrapCli(result.value)).name);
						if (name !== "") out[openId] = name;
					}).catch(() => {}));
				}
				Promise.all(tasks).then(() => {
					if (alive) setNames(out);
				});
				return () => {
					alive = false;
				};
			}, [record]);
			return names;
		}
		/** One line of gated arguments, domain-specific, ids resolved to names. */
		function ArgBody({ record, names }) {
			const args = asRecord$9(record.args);
			const str = (key) => asString$6(args[key]);
			const list = (key) => asArray$6(args[key]);
			const rows = [];
			const push = (title, sub, key) => {
				rows.push(row(title, sub, key));
			};
			const nameOf = (id, fallback) => id === "" ? "" : names[id] ?? fallback;
			switch (record.domain) {
				case "im": {
					const groupId = str("groupId");
					const toOpenId = str("toOpenId");
					const target = groupId !== "" ? `群聊${nameOf(groupId, "") === "" ? "" : ` · ${nameOf(groupId, "")}`}` : toOpenId !== "" ? `单聊${nameOf(toOpenId, "") === "" ? "" : ` · ${nameOf(toOpenId, "")}`}` : "";
					if (target !== "") push("目标", target, "t");
					if (record.toolName === "yzj_im_message_recall") {
						push("操作", "撤回一条消息", "rc");
						break;
					}
					if (record.toolName === "yzj_im_group_rename") {
						if (str("name") !== "") push("新群名", str("name"), "nm");
						break;
					}
					if (record.toolName === "yzj_im_group_create") {
						if (str("name") !== "") push("群名", str("name"), "nm");
						const members = list("memberOpenIds");
						if (members.length > 0) push("初始成员", `${members.length} 人`, "mb");
						break;
					}
					if (record.toolName === "yzj_im_group_members_add" || record.toolName === "yzj_im_group_members_remove") {
						const members = list("openIds");
						if (members.length > 0) push("成员", `${members.length} 人`, "mb");
						break;
					}
					push("类型", str("msgType"), "mt");
					const body = str("content") !== "" ? str("content") : str("text");
					if (body !== "") rows.push(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: cards_module_css_default.fullText,
						children: body
					}, "c"));
					const ats = list("atOpenIds");
					if (ats.length > 0) push("提及", `${ats.length} 人`, "at");
					if (args.atAll === true) push("提及", "@所有人", "atall");
					if (str("replyMsgId") !== "") push("回复", "回复一条消息", "rp");
					break;
				}
				case "doc": {
					const id = str("id");
					push("文档", id === "" ? record.toolName === "yzj_doc_folder_create" ? "新建文件夹" : "新建文档" : nameOf(id, "文档操作"), "id");
					const ws = str("workspace");
					if (ws !== "") push("知识库", nameOf(ws, "知识库"), "ws");
					if (str("title") !== "") push("标题", str("title"), "ti");
					if (record.toolName === "yzj_doc_move") push("目标位置", str("targetParentId") !== "" ? "指定节点下" : "知识库根节点", "tp");
					if (str("operations") !== "") push("操作", str("operations").slice(0, 200), "op");
					if (str("element") !== "") push("插入内容", str("element").slice(0, 200), "el");
					break;
				}
				case "kb":
					push("知识库名称", str("name"), "n");
					if (str("description") !== "") push("简介", str("description"), "d");
					break;
				case "sheet": {
					const id = str("id");
					push("多维表格", id === "" ? "新建多维表格" : nameOf(id, "多维表格"), "id");
					const recordIds = str("recordIds");
					if (recordIds !== "") push("删除记录", `${recordIds.split(",").filter((part) => part !== "").length} 条`, "rd");
					if (str("records") !== "") push("记录", str("records").slice(0, 300), "rc");
					break;
				}
				case "calendar": {
					push("标题", str("title"), "t");
					if (str("start") !== "") push("开始", str("start"), "s");
					if (str("end") !== "") push("结束", str("end"), "e");
					const orgs = list("organizerOpenIds");
					if (orgs.length > 0) {
						const orgNames = orgs.map((id) => names[asString$6(id)] ?? "").filter((name) => name !== "");
						push("组织者", orgNames.length > 0 ? orgNames.join("、") : `${orgs.length} 人`, "o");
					}
					break;
				}
				case "file":
					if (list("files").length > 0) push("文件", `${list("files").length} 个文件`, "f");
					if (str("name") !== "") push("文件名", str("name"), "n");
					if (str("output") !== "") push("输出", str("output"), "o");
					break;
				default: rows.push(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: cards_module_css_default.text,
					children: JSON.stringify(args)
				}, "j"));
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: cards_module_css_default.rows,
				children: rows
			});
		}
		/** Mini-chip labels for referenced refs (decode yzj:... tokens → titles). */
		function refChips(refs) {
			const out = [];
			const list = asArray$6(refs);
			for (let index = 0; index < list.length; index += 1) {
				const raw = asString$6(list[index]);
				if (raw === "") continue;
				const parsed = decodeRef(raw);
				out.push(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: cards_module_css_default.miniChip,
					children: parsed?.title ?? raw.slice(0, 24)
				}, `r${index}`));
			}
			return out;
		}
		/**
		* The gated confirmation card. Pending/approved records render the decision
		* surface; cancelled renders the terminal 已取消 card; done/failed and
		* ungated calls delegate to the ordinary tool card so the durable result
		* stays the terminal display.
		*/
		function YzjWriteToolCard(props) {
			const { toolName, callId } = props;
			const [record, setRecord] = (0, react.useState)(void 0);
			const [ready, setReady] = (0, react.useState)(false);
			const [meName, setMeName] = (0, react.useState)("");
			const names = useResolvedNames(record, props);
			(0, react.useEffect)(() => {
				let live = true;
				setReady(false);
				props.fetchWrite(callId).then((found) => {
					if (live) {
						setRecord(found);
						setReady(true);
					}
				}).catch(() => {
					if (live) setReady(true);
				});
				props.fetchWhoami().then((name) => {
					if (live && name !== "") setMeName(name);
				}).catch(() => {});
				return () => {
					live = false;
				};
			}, [callId]);
			if (!ready || record === void 0 || record.status === "done" || record.status === "failed") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(YzjToolCard, { ...props });
			const strong = record.level === "strong";
			const settled = record.status === "approved";
			const title = WRITE_TITLES[toolName] ?? `云之家 · ${DOMAIN_LABELS[record.domain] ?? "写操作"}`;
			const draft = writableDraft(record);
			const refs = refChips(asRecord$9(record.args).refs);
			const decide = (outcome, next) => {
				props.decideWrite(record.writeId, outcome).then((ok) => {
					if (ok) setRecord({
						...record,
						status: next
					});
				});
			};
			if (record.status === "cancelled") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: `${cards_module_css_default.card} ${cards_module_css_default.terminalCancel}`,
				role: "status",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: cards_module_css_default.header,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: cards_module_css_default.icon,
						children: "✕"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: cards_module_css_default.title,
						children: [title, " · 已取消"]
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: cards_module_css_default.text,
					children: "未产生任何写动作；「编辑」可把草稿塞回 composer 修改后再发起。"
				})]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: strong ? `${cards_module_css_default.card} ${cards_module_css_default.strongCard}` : cards_module_css_default.card,
				role: "status",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: cards_module_css_default.header,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: cards_module_css_default.icon,
								children: "☁"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: cards_module_css_default.title,
								children: title
							}),
							settled ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: cards_module_css_default.tag,
								children: "执行中"
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: strong ? `${cards_module_css_default.tag} ${cards_module_css_default.tagStrong}` : cards_module_css_default.tag,
								children: strong ? "强确认" : "需确认"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: cards_module_css_default.writeId,
								children: record.writeId
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: cards_module_css_default.ccTarget,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ArgBody, {
							record,
							names
						}), meName !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: cards_module_css_default.ccIdentity,
							children: [
								"将以你本人（",
								meName,
								"）身份执行"
							]
						})]
					}),
					refs.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: cards_module_css_default.ccRefs,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: cards_module_css_default.ccRefsLabel,
							children: "关联引用"
						}), refs]
					}),
					settled ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: cards_module_css_default.text,
						children: "已批准，正在执行…"
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: cards_module_css_default.actions,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: cards_module_css_default.action,
								onClick: () => props.openContext(record),
								children: "查看上下文"
							}),
							draft !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: cards_module_css_default.action,
								onClick: () => {
									props.editDraft(draft);
									decide("rejected", "cancelled");
								},
								children: "编辑"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: cards_module_css_default.action,
								onClick: () => decide("rejected", "cancelled"),
								children: "取消"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: cards_module_css_default.actionPrimary,
								onClick: () => decide("allowed-once", "approved"),
								children: "确认"
							})
						]
					})
				]
			});
		}
		//#endregion
		//#region src/contact-parse.ts
		/**
		* Contact payload unwrap (pitfall-003: bare array / list / data / single object).
		* Shared by host whoami and the browser sender-name cache. Also peels the
		* yzj-cli 0.1.6 `{success, identity, data}` envelope (whoami is one object).
		*/
		function asRecord$8(value) {
			return typeof value === "object" && value !== null ? value : {};
		}
		function firstNonEmpty(...values) {
			for (const value of values) if (typeof value === "string" && value !== "") return value;
			return "";
		}
		function identityOf(json) {
			return asRecord$8(asRecord$8(json).identity);
		}
		function rowsOf(json) {
			const peeled = unwrapCli(json);
			if (Array.isArray(peeled)) return peeled;
			const record = asRecord$8(peeled);
			if (Array.isArray(record.list)) return record.list;
			if (Array.isArray(record.data)) return record.data;
			if (typeof record.data === "object" && record.data !== null) {
				const inner = asRecord$8(record.data);
				if (Array.isArray(inner.list)) return inner.list;
				if (Object.keys(inner).length > 0) return [record.data];
			}
			return Object.keys(record).length === 0 ? [] : [peeled];
		}
		/** Parse `contact user get` / 0.1.6 `whoami` JSON into openId / name / photoUrl.
		* Do not assume top-level openId: peel `data` and sibling `identity`. */
		function parseContactUser(json) {
			const identity = identityOf(json);
			const user = asRecord$8(rowsOf(json)[0]);
			return {
				openId: firstNonEmpty(user.openId, user.oId, identity.openId, identity.oId),
				name: firstNonEmpty(user.name, user.userName, user.nickName, identity.name, identity.userName),
				photoUrl: firstNonEmpty(user.photoUrl, user.photo, user.avatar, identity.photoUrl, identity.photo, identity.avatar)
			};
		}
		//#endregion
		//#region src/client/im-cache.ts
		/**
		* IM-side caching + rendering helpers for the panel chat tab:
		* - message-window cache per group (TTL 60s) and group-list cache (TTL 30s)
		* - sender-name resolution (fetchContact per openId, session cache) so group
		*   chat rows show real names instead of raw openIds
		* - time/size formatters and yunzhijia media URL builders
		*/
		const MESSAGE_TTL = 6e4;
		const GROUP_TTL = 3e4;
		const messageCache = /* @__PURE__ */ new Map();
		let groupCache = null;
		/**
		* Last known first group page for stale-while-revalidate paint.
		* Returns even when older than GROUP_TTL; callers must still refresh.
		*/
		function peekGroupWindow() {
			loadPersisted();
			if (groupCache === null) return void 0;
			return {
				groups: groupCache.groups,
				more: groupCache.more,
				stale: Date.now() - groupCache.fetchedAt > GROUP_TTL
			};
		}
		/** Store (or refresh) the first group page. */
		function putGroupWindow(groups, more) {
			groupCache = {
				groups,
				more,
				fetchedAt: Date.now()
			};
			scheduleSave();
		}
		const readState = /* @__PURE__ */ new Map();
		const PERSIST_KEY = "dsh.yzj.imcache.v1";
		const PERSIST_WINDOWS_MAX = 8;
		const PERSIST_BYTES_MAX = 7e5;
		/** L2 持久化桥（决策 37）：host SQLite 副本。panel 挂载时 bind 一次。 */
		let l2Put = null;
		let l2Get = null;
		function bindImCachePersistence(put, get) {
			l2Put = put;
			l2Get = get;
		}
		let loaded = false;
		let saveTimer = null;
		function loadPersisted() {
			if (loaded) return;
			loaded = true;
			try {
				const raw = window.localStorage.getItem(PERSIST_KEY);
				if (raw === null) {
					if (l2Get !== null) l2Get(PERSIST_KEY).then((hit) => {
						if (hit === null || typeof hit.payload !== "string") return;
						applyPersisted(hit.payload);
					}).catch(() => {});
					return;
				}
				applyPersisted(raw);
			} catch {}
		}
		function applyPersisted(raw) {
			try {
				const data = JSON.parse(raw);
				if (Array.isArray(data.readState)) for (const [id, unread] of data.readState) readState.set(id, unread);
				if (Array.isArray(data.senders)) for (const [id, info] of data.senders) senderNames.set(id, info);
				if (data.groups !== void 0 && data.groups !== null) groupCache = data.groups;
				if (Array.isArray(data.windows)) {
					for (const [id, windowData] of data.windows) if (Date.now() - windowData.fetchedAt <= MESSAGE_TTL) messageCache.set(id, windowData);
				}
			} catch {}
		}
		/** Debounced, bounded localStorage snapshot of every cache. */
		function scheduleSave() {
			if (saveTimer !== null) return;
			saveTimer = setTimeout(() => {
				saveTimer = null;
				try {
					const windows = [...messageCache.entries()].slice(0, PERSIST_WINDOWS_MAX);
					const data = {
						readState: [...readState.entries()],
						senders: [...senderNames.entries()],
						groups: groupCache,
						windows
					};
					let text = JSON.stringify(data);
					while (text.length > PERSIST_BYTES_MAX && windows.length > 0) {
						windows.shift();
						data.windows = windows;
						text = JSON.stringify(data);
					}
					window.localStorage.setItem(PERSIST_KEY, text);
					if (l2Put !== null) l2Put(PERSIST_KEY, text, Date.now());
				} catch {}
			}, 400);
		}
		const senderNames = /* @__PURE__ */ new Map();
		const senderInflight = /* @__PURE__ */ new Map();
		/** Cached display name for a sender, or '' when not yet resolved. */
		function senderNameOf(openId) {
			loadPersisted();
			return senderNames.get(openId)?.name ?? "";
		}
		/** Cached avatar URL for a sender, or '' when unknown. */
		function senderPhotoOf(openId) {
			loadPersisted();
			return senderNames.get(openId)?.photoUrl ?? "";
		}
		/** Resolve every unknown sender in a window; returns the newly found names. */
		async function resolveSenders(openIds, inject) {
			const out = {};
			const unknown = [...new Set(openIds)].filter((id) => id !== "" && !senderNames.has(id));
			if (unknown.length === 0) return out;
			await Promise.all(unknown.map(async (openId) => {
				let pending = senderInflight.get(openId);
				if (pending === void 0) {
					pending = inject.fetchContact(openId).then((result) => {
						const info = {
							name: "",
							photoUrl: ""
						};
						if (result.ok) {
							const user = parseContactUser(result.value);
							info.name = user.name;
							info.photoUrl = user.photoUrl;
							if (info.name !== "" || info.photoUrl !== "") senderNames.set(openId, info);
						}
						return info;
					}).catch(() => ({
						name: "",
						photoUrl: ""
					}));
					senderInflight.set(openId, pending);
				}
				const info = await pending;
				if (info.name !== "") out[openId] = info.name;
			}));
			scheduleSave();
			return out;
		}
		/** 5896737 → "5.6 MB"; unknown → ''. */
		function formatSize(bytes) {
			const size = typeof bytes === "number" ? bytes : Number(bytes);
			if (!Number.isFinite(size) || size <= 0) return "";
			if (size < 1024) return `${size} B`;
			if (size < 1048576) return `${(size / 1024).toFixed(1)} KB`;
			return `${(size / 1024 / 1024).toFixed(1)} MB`;
		}
		const fileDataCache = /* @__PURE__ */ new Map();
		const fileDataInflight = /* @__PURE__ */ new Map();
		const FILE_DATA_LIMIT = 96;
		function rememberFileData(fileId, dataUrl) {
			fileDataCache.set(fileId, dataUrl);
			for (const key of fileDataCache.keys()) {
				if (fileDataCache.size <= FILE_DATA_LIMIT) break;
				fileDataCache.delete(key);
			}
		}
		/** Synchronous hit in the in-session file-data cache (no RPC). */
		function peekFileData(fileId) {
			return fileDataCache.get(fileId);
		}
		/**
		* Resolve a fileId's data URL through the /yzj file-data proxy. Results are
		* cached in-session (bounded) so revisits and repeated images are instant.
		*/
		async function resolveFileData(fileId, inject) {
			const cached = fileDataCache.get(fileId);
			if (cached !== void 0) return cached;
			let pending = fileDataInflight.get(fileId);
			if (pending === void 0) {
				pending = inject.fetchFileData(fileId).then((result) => {
					fileDataInflight.delete(fileId);
					if (!result.ok) return void 0;
					const value = result.value ?? {};
					const dataUrl = typeof value.dataUrl === "string" ? value.dataUrl : "";
					if (dataUrl !== "") rememberFileData(fileId, dataUrl);
					return dataUrl === "" ? void 0 : dataUrl;
				}).catch(() => {
					fileDataInflight.delete(fileId);
				});
				fileDataInflight.set(fileId, pending);
			}
			return pending;
		}
		//#endregion
		//#region \0dsh-css:/Users/kingdee/dev/dsh-yzj/packages/ui-yzj/src/client/home.module.css.mjs
		const css$2 = ".xK0V9G_stream{flex-direction:column;flex:1 1 0;min-height:0;padding:12px 16px 24px;display:flex;overflow:auto}.xK0V9G_streamContent{flex-direction:column;gap:10px;display:flex}.xK0V9G_hint{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);border-radius:8px;padding:8px 10px;font-size:12px;line-height:18px}.xK0V9G_unbound{text-align:center;max-width:420px;color:var(--dsw-alias-label-secondary);margin:24px auto;font-size:13px;line-height:20px}.xK0V9G_row{flex-direction:row;align-items:flex-start;gap:8px;max-width:86%;display:flex}.xK0V9G_rowSelf{flex-direction:row-reverse;align-self:flex-end}.xK0V9G_rowOther{align-self:flex-start}.xK0V9G_stack{flex-direction:column;gap:4px;min-width:0;display:flex}.xK0V9G_daySep{color:var(--dsw-alias-label-tertiary);justify-content:center;margin:8px 0 4px;font-size:11px;line-height:18px;display:flex}.xK0V9G_daySep span{background:var(--dsw-alias-bg-layer-2);border-radius:999px;padding:1px 10px}.xK0V9G_meta{color:var(--dsw-alias-label-tertiary);gap:8px;font-size:11px;display:flex}.xK0V9G_bubble{white-space:pre-wrap;word-break:break-word;border-radius:10px;padding:8px 10px;font-size:14px;line-height:20px}.xK0V9G_im{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2)}.xK0V9G_imSelf{background:var(--dsw-static-deepseek-100);border-color:#0000}.xK0V9G_agent{background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2)}.xK0V9G_pending{border-color:var(--dsw-static-deepseek-500);background:var(--dsw-static-deepseek-100)}.xK0V9G_failed{border-color:var(--dsw-static-red-500)}.xK0V9G_tag{background:var(--dsw-alias-interactive-bg-hover);border-radius:999px;align-items:center;padding:0 6px;font-size:10px;font-weight:600;display:inline-flex}.xK0V9G_chrome{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);border-radius:10px;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 6px;padding:6px 8px;font-size:12px;display:flex}.xK0V9G_chromeQuiet{align-items:center;margin:0 0 4px;padding:0 2px;display:flex}.xK0V9G_chromeLink{color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;background:0 0;border:none;padding:0;font-size:12px}.xK0V9G_chromeLink:hover{color:var(--dsw-alias-label-primary)}.xK0V9G_chromeBtn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:8px;padding:4px 10px;font-size:12px;font-weight:600}.xK0V9G_chromeBtn:hover{background:var(--dsw-alias-interactive-bg-hover)}.xK0V9G_chromePrimary{background:var(--dsw-static-deepseek-500);color:#fff;border-color:#0000}.xK0V9G_modalMask{z-index:200;background:#00000059;justify-content:center;align-items:center;display:flex;position:fixed;inset:0}.xK0V9G_modal{background:var(--dsw-alias-bg-base);width:min(520px,92vw);max-height:80vh;color:var(--dsw-alias-label-primary);border-radius:12px;padding:16px;overflow:auto;box-shadow:0 16px 48px #0003}.xK0V9G_modal h3{margin:0 0 8px;font-size:16px}.xK0V9G_modal p{color:var(--dsw-alias-label-secondary);margin:0 0 12px;font-size:13px}.xK0V9G_pick{flex-direction:column;gap:6px;margin-bottom:12px;display:flex}.xK0V9G_candidate{align-items:flex-start;gap:8px;font-size:13px;line-height:18px;display:flex}.xK0V9G_actions{justify-content:flex-end;gap:8px;margin-top:12px;display:flex}.xK0V9G_topicList{flex-wrap:wrap;align-items:center;gap:6px;display:flex}.xK0V9G_topicListLabel{color:var(--dsw-alias-label-tertiary);font-size:11px;font-weight:600}.xK0V9G_kindPill{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);border-radius:999px;align-items:center;padding:2px 8px;font-size:11px;font-weight:600;display:inline-flex}.xK0V9G_topicDock{box-sizing:border-box;width:calc(100% - 2 * var(--dsh-composer-side-clearance,16px));max-width:var(--dsh-composer-card-max-width,780px);flex:none;margin:0 auto;padding:0}.xK0V9G_topicDockBtn{border:1px solid var(--dsw-alias-border-l2-darkmode-thin,var(--dsw-alias-border-l2));background:var(--dsw-specific-input-major,var(--dsw-alias-bg-base));width:100%;height:36px;box-shadow:var(--dsw-shadow-lv2,0 8px 24px #00000014);color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer;border-radius:22px;align-items:center;gap:10px;padding:4px 16px;display:flex}.xK0V9G_topicDockBtn:hover,.xK0V9G_topicDockBtn:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}.xK0V9G_topicDockLabel{flex:none;font-size:13px;font-weight:500;line-height:18px}.xK0V9G_topicDockSummary{min-width:0;color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;flex:1;font-size:12px;line-height:18px;overflow:hidden}.xK0V9G_roomComposerSeat{display:none}.xK0V9G_roomTimeline{flex-direction:column;flex:1;min-width:0;min-height:0;display:flex}.xK0V9G_roomComposerHost{flex:none}.xK0V9G_roomComposer{background:0 0;border-top:none;flex-direction:column;gap:8px;padding:8px 16px 14px;display:flex;position:relative}.xK0V9G_roomComposerCard{border:1px solid var(--dsw-alias-border-l2-darkmode-thin,var(--dsw-alias-border-l2));background:var(--dsw-specific-input-major,var(--dsw-alias-bg-base));box-shadow:var(--dsw-shadow-lv2,0 8px 24px #00000014);border-radius:22px;flex-direction:column;gap:10px;padding:10px 10px 6px;display:flex}.xK0V9G_roomComposerInput{resize:none;min-height:48px;max-height:160px;color:var(--dsw-alias-label-primary);font:inherit;background:0 0;border:none;border-radius:0;flex:1;padding:4px 10px;font-size:16px;line-height:24px}.xK0V9G_roomComposerInput:focus{outline:none}.xK0V9G_roomComposerBar{justify-content:space-between;align-items:center;gap:12px;padding:2px 6px 6px;display:flex}.xK0V9G_roomComposerTools{align-items:center;gap:14px;padding:0 2px;display:flex}.xK0V9G_roomSendCircle{background:var(--dsw-alias-button-info-fill,var(--dsw-static-deepseek-500));color:#fff;cursor:pointer;border:none;border-radius:999px;flex:none;place-items:center;width:34px;height:34px;display:grid}.xK0V9G_roomSendCircle:hover:not(:disabled){background:var(--dsw-alias-button-info-hover,var(--dsw-static-deepseek-500))}.xK0V9G_roomSendCircle:disabled{opacity:.4;cursor:default}.xK0V9G_roomToolBtn,.xK0V9G_roomReplyCancel{color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;background:0 0;border:none;border-radius:0;padding:0;font-size:12px;font-weight:400}.xK0V9G_roomToolBtn:hover,.xK0V9G_roomReplyCancel:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.xK0V9G_roomReplyBar{border-left:2px solid var(--dsw-static-deepseek-500);background:var(--dsw-alias-bg-layer-1);border-radius:6px;align-items:center;gap:8px;padding:4px 8px;display:flex}.xK0V9G_roomReplyText{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-secondary);flex:1;font-size:12px;overflow:hidden}.xK0V9G_roomEmojiPanel{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:8px;flex-wrap:wrap;gap:4px;padding:6px;display:flex}.xK0V9G_roomEmojiBtn{cursor:pointer;background:0 0;border:none;border-radius:4px;padding:2px 4px;font-size:18px;line-height:24px}.xK0V9G_roomEmojiBtn:hover{background:var(--dsw-alias-interactive-bg-hover)}.xK0V9G_roomRow{gap:8px;max-width:86%;margin-top:10px;display:flex}.xK0V9G_roomRowMerged{margin-top:2px}.xK0V9G_roomRowSelf{flex-direction:row-reverse;align-self:flex-end}.xK0V9G_roomRowOther{align-self:flex-start}.xK0V9G_roomAvatarSlot{flex:none;width:28px}.xK0V9G_roomStack{flex-direction:column;gap:2px;min-width:0;display:flex}.xK0V9G_roomRowSelf .xK0V9G_roomStack{align-items:flex-end}.xK0V9G_roomMeta{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}.xK0V9G_roomBubble{word-break:break-word;max-width:min(525px,82%);color:var(--dsw-alias-label-primary);flex-direction:column;align-items:stretch;padding:10px 16px;font-size:16px;line-height:24px;display:flex}.xK0V9G_roomBubbleSelf{background:var(--dsw-specific-bubble,var(--dsw-static-deepseek-50));border-radius:22px}.xK0V9G_roomBubbleOther,.xK0V9G_roomBubbleAssistant{background:var(--dsw-alias-interactive-bg-hover-solid,var(--dsw-static-neutral-bluish-75));border-radius:22px}.xK0V9G_roomClamp{-webkit-line-clamp:4;word-break:break-word;white-space:pre-wrap;-webkit-box-orient:vertical;display:-webkit-box;overflow:hidden}.xK0V9G_roomClampToggle{color:var(--dsw-alias-state-business-primary);font:inherit;cursor:pointer;background:0 0;border:none;align-self:flex-start;padding:2px 0 0;font-size:12px}.xK0V9G_roomRowActions{opacity:0;flex-wrap:wrap;gap:8px;display:flex}.xK0V9G_roomRow:hover .xK0V9G_roomRowActions,.xK0V9G_roomRow:focus-within .xK0V9G_roomRowActions{opacity:1}.xK0V9G_roomRowActions .xK0V9G_roomAction{font:inherit;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;padding:0;font-size:12px;font-weight:500;line-height:16px}.xK0V9G_roomRowActions .xK0V9G_roomAction:hover{color:var(--dsw-static-deepseek-500)}.xK0V9G_roomRowActions .xK0V9G_roomAction:disabled{opacity:.5;cursor:default}.xK0V9G_replyChip{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-static-deepseek-500);font:inherit;cursor:pointer;border:none;border-radius:10px;align-self:flex-start;margin-top:6px;padding:2px 8px;font-size:11px;font-weight:600;display:inline-flex}.xK0V9G_artifactCard{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);border-radius:8px;align-items:center;gap:8px;margin-top:6px;padding:8px;display:flex}.xK0V9G_artifactType{background:var(--dsw-alias-bg-layer-2);min-width:36px;color:var(--dsw-alias-label-secondary);letter-spacing:.04em;text-align:center;border-radius:4px;flex:none;padding:4px 6px;font-size:10px;font-weight:700}.xK0V9G_artifactMeta{flex-direction:column;gap:2px;min-width:0;display:flex}.xK0V9G_artifactName{color:var(--dsw-alias-label-primary);font-size:12px;font-weight:600;line-height:16px}.xK0V9G_artifactNote{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}.xK0V9G_daySep{max-width:none;color:var(--dsw-alias-label-tertiary);align-self:stretch;align-items:center;gap:8px;margin:14px 0 4px;font-size:11px;line-height:16px;display:flex}.xK0V9G_daySep:before,.xK0V9G_daySep:after{content:\"\";background:var(--dsw-alias-border-l2);flex:1;height:1px}.xK0V9G_groupSpaceSection{color:var(--dsw-alias-label-tertiary);padding:6px 8px 2px;font-size:11px;font-weight:600}.xK0V9G_topicChip,.xK0V9G_handBtn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:8px;padding:2px 8px;font-size:11px;font-weight:600}.xK0V9G_topicChip:hover,.xK0V9G_handBtn:hover{background:var(--dsw-alias-interactive-bg-hover)}.xK0V9G_handBtn:disabled{opacity:.5;cursor:default}.xK0V9G_groupSpace{border-top:1px solid var(--dsw-alias-border-l2);flex-direction:column;flex:1 0 100%;width:100%;min-width:100%;min-height:0;max-height:42vh;margin-top:8px;padding-top:8px;display:flex}.xK0V9G_groupSpaceHead{color:var(--dsw-alias-label-tertiary);flex:none;padding:0 8px 6px;font-size:11px;font-weight:600}.xK0V9G_groupSpaceHint{color:var(--dsw-alias-label-tertiary);flex:none;margin:0;padding:0 8px 8px;font-size:12px;line-height:18px}.xK0V9G_groupSpaceTree{flex-direction:column;flex:1;gap:4px;min-height:0;display:flex;overflow:auto}.xK0V9G_groupSpaceRoom{flex-direction:column;gap:2px;display:flex}.xK0V9G_groupSpaceTopics{border-left:1px solid var(--dsw-alias-border-l2);margin-left:12px;padding-left:8px}.xK0V9G_groupSpaceRowWrap{align-items:center;gap:2px;display:flex}.xK0V9G_groupSpaceRow{width:100%;min-width:0;color:var(--dsw-alias-label-secondary);font:inherit;text-align:left;cursor:pointer;background:0 0;border:none;border-radius:4px;align-items:center;gap:6px;padding:4px 8px;font-size:12px;display:flex}.xK0V9G_groupSpaceRow:hover,.xK0V9G_groupSpaceRowActive{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.xK0V9G_groupSpaceRowLabel{text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;overflow:hidden}.xK0V9G_groupSpaceMeta{color:var(--dsw-alias-label-tertiary);flex:none;font-size:11px}.xK0V9G_groupSpaceToggle{width:18px;height:18px;color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;background:0 0;border:none;border-radius:4px;flex:none;padding:0;font-size:11px}.xK0V9G_groupSpaceToggle:hover{background:var(--dsw-alias-interactive-bg-hover)}.xK0V9G_groupSpaceMore{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;background:0 0;border-radius:4px;margin:4px 8px 8px;padding:4px 8px;font-size:12px}.xK0V9G_groupSpaceMore:disabled{opacity:.5;cursor:default}.xK0V9G_groupSpaceGlyph{background:var(--dsw-alias-bg-layer-2);width:18px;height:18px;color:var(--dsw-alias-label-secondary);text-align:center;border-radius:4px;flex:none;font-size:11px;line-height:18px;overflow:hidden}.xK0V9G_groupSpaceGlyph img{object-fit:cover;width:18px;height:18px;display:block}.xK0V9G_streamMore{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;background:0 0;border-radius:6px;align-self:center;margin:4px 0 8px;padding:4px 10px;font-size:12px}.xK0V9G_streamMore:disabled{opacity:.5;cursor:default}.xK0V9G_roomShell{flex-direction:column;flex:1;min-width:0;height:100%;min-height:0;display:flex}.xK0V9G_pageTabs{border-bottom:1px solid var(--dsw-alias-border-l2);flex:none;align-items:center;gap:28px;padding:0 20px;display:flex}.xK0V9G_pageTab{color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;padding:12px 0;font-size:14px;line-height:22px;position:relative}.xK0V9G_pageTabOn{color:var(--dsw-static-deepseek-500);font-weight:600}.xK0V9G_pageTabOn:after{content:\"\";background:var(--dsw-static-deepseek-500);border-radius:200px;height:2px;position:absolute;bottom:0;left:0;right:0}.xK0V9G_pageBody{flex:1;min-width:0;min-height:0;display:flex}.xK0V9G_roomMain{flex-direction:column;flex:1;min-width:0;min-height:0;display:flex}.xK0V9G_roomMainHead{flex:none;justify-content:flex-end;padding:6px 12px 0;display:flex}.xK0V9G_topicToggle{color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;background:0 0;border:none;border-radius:999px;align-items:center;gap:6px;padding:4px 8px;font-size:12px;font-weight:500;display:inline-flex}.xK0V9G_topicToggle[aria-pressed=true]{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}.xK0V9G_topicToggleBadge{background:var(--dsw-static-deepseek-500);color:#fff;text-align:center;border-radius:999px;min-width:16px;height:16px;padding:0 5px;font-size:10px;font-weight:700;line-height:16px}.xK0V9G_roomStage{flex:1;min-width:0;min-height:0;display:flex}.xK0V9G_roomTimeline .xK0V9G_stream{flex:1;gap:0;min-width:0;min-height:0}.xK0V9G_roomTimeline .xK0V9G_stream .xK0V9G_streamMore{margin-bottom:8px}.xK0V9G_roomRowHighlight{outline:2px solid var(--dsw-static-deepseek-500);outline-offset:2px;border-radius:8px}.xK0V9G_convList{border-right:1px solid var(--dsw-alias-border-l2);flex-direction:column;flex:none;width:236px;min-width:180px;min-height:0;display:flex}.xK0V9G_convListHint{color:var(--dsw-alias-label-tertiary);flex:none;margin:0;padding:0 12px 8px;font-size:12px;line-height:18px}.xK0V9G_convListBody{flex-direction:column;flex:1;min-height:0;display:flex;overflow:auto}.xK0V9G_convRow{width:100%;min-width:0;color:var(--dsw-alias-label-secondary);font:inherit;text-align:left;cursor:pointer;background:0 0;border:none;gap:8px;padding:8px 12px;display:flex}.xK0V9G_convRow:hover,.xK0V9G_convRowActive{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.xK0V9G_convGlyph{background:var(--dsw-alias-bg-layer-2);width:32px;height:32px;color:var(--dsw-alias-label-secondary);text-align:center;border-radius:50%;flex:none;font-size:13px;line-height:32px;overflow:hidden}.xK0V9G_convGlyph img{object-fit:cover;width:32px;height:32px;display:block}.xK0V9G_convRowBody{flex-direction:column;flex:1;gap:2px;min-width:0;display:flex}.xK0V9G_convRowTop,.xK0V9G_convRowBottom{align-items:center;gap:6px;min-width:0;display:flex}.xK0V9G_convRowName{text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;font-size:13px;font-weight:500;overflow:hidden}.xK0V9G_convRowTime{color:var(--dsw-alias-label-tertiary);flex:none;font-size:11px}.xK0V9G_convRowPreview{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-tertiary);flex:1;font-size:12px;overflow:hidden}.xK0V9G_convDot{background:var(--dsw-static-deepseek-500);border-radius:50%;flex:none;width:6px;height:6px}.xK0V9G_convBadge{background:var(--dsw-static-deepseek-500);color:#fff;text-align:center;border-radius:999px;flex:none;min-width:16px;height:16px;padding:0 5px;font-size:10px;font-weight:700;line-height:16px}.xK0V9G_convMore{color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;text-align:left;background:0 0;border:none;margin:4px 12px 10px;padding:4px 0;font-size:12px}.xK0V9G_convMore:disabled{opacity:.5;cursor:default}.xK0V9G_topicDrawer{border-left:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);flex-direction:column;flex:none;width:340px;min-width:260px;min-height:0;display:flex}.xK0V9G_topicDrawerHead{border-bottom:1px solid var(--dsw-alias-border-l2);flex:none;align-items:center;gap:6px;padding:8px 8px 6px;display:flex}.xK0V9G_topicDrawerTitle{text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;font-size:13px;font-weight:600;overflow:hidden}.xK0V9G_topicDrawerNav{color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;background:0 0;border:none;flex:none;padding:2px 4px;font-size:12px}.xK0V9G_topicDrawerBody{flex-direction:column;flex:1;gap:6px;min-height:0;padding:8px;display:flex;overflow:auto}.xK0V9G_topicDrawerHint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:18px}.xK0V9G_topicCard{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);width:100%;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer;border-radius:8px;flex-direction:column;gap:2px;padding:8px;display:flex}.xK0V9G_topicCardTitle{font-size:13px;font-weight:600}.xK0V9G_topicCardOrigin{color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;font-size:12px;overflow:hidden}.xK0V9G_topicAnchorWrap{flex-direction:column;gap:4px;margin:0 8px 4px;display:flex}.xK0V9G_topicAnchorBar{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer;border-radius:8px;flex-direction:column;align-items:flex-start;gap:2px;margin:0;padding:8px;display:flex}.xK0V9G_topicAnchorExcerpt{color:var(--dsw-alias-label-secondary);-webkit-line-clamp:2;word-break:break-word;-webkit-box-orient:vertical;font-size:12px;display:-webkit-box;overflow:hidden}.xK0V9G_topicDrawerAsk{border-top:1px solid var(--dsw-alias-border-l2);flex:none;gap:6px;padding:8px;display:flex}.xK0V9G_topicDrawerInput{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);min-width:0;color:var(--dsw-alias-label-primary);font:inherit;border-radius:6px;flex:1;padding:6px 8px;font-size:13px}.xK0V9G_topicDrawerSend{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;border-radius:6px;flex:none;padding:6px 8px;font-size:12px}.xK0V9G_topicDrawerSend:disabled,.xK0V9G_topicDrawerInput:disabled{opacity:.5;cursor:default}.xK0V9G_topicLensRow{display:flex}.xK0V9G_topicLensRowUser{justify-content:flex-end}.xK0V9G_topicLensRowAssistant{justify-content:flex-start}.xK0V9G_topicLensStack{flex-direction:column;gap:6px;max-width:90%;display:flex}.xK0V9G_topicLensBubble{white-space:pre-wrap;word-break:break-word;max-width:100%;padding:6px 8px;font-size:12px;line-height:18px}.xK0V9G_topicLensBubbleUser{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:8px 2px 8px 8px}.xK0V9G_topicLensBubbleAssistant{background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);border-radius:2px 8px 8px}.xK0V9G_yzjDock{border-top:1px solid var(--dsw-alias-border-l2);flex-direction:column;flex:none;width:100%;margin-top:4px;padding-top:8px;display:flex}.xK0V9G_yzjDockNarrow{flex-direction:column;align-items:center;gap:2px;margin-top:4px;padding-top:8px;display:flex}.xK0V9G_yzjDockEntries{flex-direction:row;align-items:center;gap:4px;padding:0 8px;display:flex}.xK0V9G_yzjDockEntry{min-width:0;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;text-align:left;background:0 0;border:none;border-radius:10px;flex:1;align-items:center;gap:8px;padding:6px 10px;font-size:13px;line-height:18px;display:flex}.xK0V9G_yzjDockEntry:hover,.xK0V9G_yzjDockEntryActive,.xK0V9G_yzjDockEntryActive:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.xK0V9G_yzjDockMark{text-align:center;width:16px;color:var(--dsw-alias-label-tertiary);flex:none;font-size:12px;line-height:1}.xK0V9G_yzjDockNarrow .xK0V9G_yzjDockEntries{align-items:center;padding:0}.xK0V9G_yzjDockNarrow .xK0V9G_yzjDockEntry{flex:none;justify-content:center;width:32px;padding:6px}.xK0V9G_yzjDockLabel{text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;overflow:hidden}.xK0V9G_yzjDockRobot{flex:none;align-items:center;padding:0 4px;display:flex}.xK0V9G_yzjDockRobotDot{background:var(--dsw-alias-label-tertiary);border-radius:50%;flex:none;width:6px;height:6px}.xK0V9G_yzjDockRobotDotOk{background:var(--dsw-alias-state-success-primary)}.xK0V9G_yzjDockRobotDotWarn{background:var(--dsw-alias-state-warn-primary)}.xK0V9G_yzjDockHint{color:var(--dsw-alias-label-tertiary);margin:0;padding:0 12px 8px;font-size:12px;line-height:18px}";
		const tagId$2 = "@dsh-yzj/bundle/home.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@dsh-yzj/bundle";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var home_module_css_default = {
			"roomMainHead": "xK0V9G_roomMainHead",
			"roomEmojiBtn": "xK0V9G_roomEmojiBtn",
			"roomTimeline": "xK0V9G_roomTimeline",
			"topicLensRow": "xK0V9G_topicLensRow",
			"groupSpaceTree": "xK0V9G_groupSpaceTree",
			"roomClamp": "xK0V9G_roomClamp",
			"pending": "xK0V9G_pending",
			"groupSpaceRoom": "xK0V9G_groupSpaceRoom",
			"topicAnchorWrap": "xK0V9G_topicAnchorWrap",
			"kindPill": "xK0V9G_kindPill",
			"agent": "xK0V9G_agent",
			"topicDockBtn": "xK0V9G_topicDockBtn",
			"convGlyph": "xK0V9G_convGlyph",
			"roomRowMerged": "xK0V9G_roomRowMerged",
			"topicDock": "xK0V9G_topicDock",
			"convRowName": "xK0V9G_convRowName",
			"groupSpaceRow": "xK0V9G_groupSpaceRow",
			"topicAnchorExcerpt": "xK0V9G_topicAnchorExcerpt",
			"yzjDock": "xK0V9G_yzjDock",
			"convRow": "xK0V9G_convRow",
			"stream": "xK0V9G_stream",
			"roomRowHighlight": "xK0V9G_roomRowHighlight",
			"streamContent": "xK0V9G_streamContent",
			"roomRowActions": "xK0V9G_roomRowActions",
			"chromeQuiet": "xK0V9G_chromeQuiet",
			"groupSpaceRowActive": "xK0V9G_groupSpaceRowActive",
			"topicToggleBadge": "xK0V9G_topicToggleBadge",
			"topicLensStack": "xK0V9G_topicLensStack",
			"topicLensBubbleAssistant": "xK0V9G_topicLensBubbleAssistant",
			"convRowTop": "xK0V9G_convRowTop",
			"topicDrawerHead": "xK0V9G_topicDrawerHead",
			"topicDrawer": "xK0V9G_topicDrawer",
			"roomEmojiPanel": "xK0V9G_roomEmojiPanel",
			"yzjDockLabel": "xK0V9G_yzjDockLabel",
			"topicDockLabel": "xK0V9G_topicDockLabel",
			"yzjDockEntries": "xK0V9G_yzjDockEntries",
			"convRowPreview": "xK0V9G_convRowPreview",
			"chrome": "xK0V9G_chrome",
			"roomReplyBar": "xK0V9G_roomReplyBar",
			"roomComposerCard": "xK0V9G_roomComposerCard",
			"pageTab": "xK0V9G_pageTab",
			"hint": "xK0V9G_hint",
			"roomComposerSeat": "xK0V9G_roomComposerSeat",
			"roomAvatarSlot": "xK0V9G_roomAvatarSlot",
			"roomBubbleOther": "xK0V9G_roomBubbleOther",
			"topicDrawerAsk": "xK0V9G_topicDrawerAsk",
			"chromeLink": "xK0V9G_chromeLink",
			"roomClampToggle": "xK0V9G_roomClampToggle",
			"candidate": "xK0V9G_candidate",
			"groupSpaceMore": "xK0V9G_groupSpaceMore",
			"convRowBottom": "xK0V9G_convRowBottom",
			"rowOther": "xK0V9G_rowOther",
			"topicToggle": "xK0V9G_topicToggle",
			"groupSpaceRowWrap": "xK0V9G_groupSpaceRowWrap",
			"convMore": "xK0V9G_convMore",
			"groupSpaceHead": "xK0V9G_groupSpaceHead",
			"imSelf": "xK0V9G_imSelf",
			"roomStack": "xK0V9G_roomStack",
			"topicDrawerHint": "xK0V9G_topicDrawerHint",
			"roomBubble": "xK0V9G_roomBubble",
			"failed": "xK0V9G_failed",
			"groupSpaceMeta": "xK0V9G_groupSpaceMeta",
			"roomShell": "xK0V9G_roomShell",
			"yzjDockRobotDotWarn": "xK0V9G_yzjDockRobotDotWarn",
			"artifactNote": "xK0V9G_artifactNote",
			"yzjDockHint": "xK0V9G_yzjDockHint",
			"roomComposerBar": "xK0V9G_roomComposerBar",
			"groupSpaceHint": "xK0V9G_groupSpaceHint",
			"yzjDockRobotDot": "xK0V9G_yzjDockRobotDot",
			"roomComposer": "xK0V9G_roomComposer",
			"convListBody": "xK0V9G_convListBody",
			"convList": "xK0V9G_convList",
			"pick": "xK0V9G_pick",
			"groupSpaceRowLabel": "xK0V9G_groupSpaceRowLabel",
			"roomComposerTools": "xK0V9G_roomComposerTools",
			"groupSpaceGlyph": "xK0V9G_groupSpaceGlyph",
			"groupSpaceSection": "xK0V9G_groupSpaceSection",
			"topicCardTitle": "xK0V9G_topicCardTitle",
			"yzjDockRobotDotOk": "xK0V9G_yzjDockRobotDotOk",
			"topicLensBubbleUser": "xK0V9G_topicLensBubbleUser",
			"daySep": "xK0V9G_daySep",
			"actions": "xK0V9G_actions",
			"chromePrimary": "xK0V9G_chromePrimary",
			"roomComposerHost": "xK0V9G_roomComposerHost",
			"roomComposerInput": "xK0V9G_roomComposerInput",
			"roomBubbleAssistant": "xK0V9G_roomBubbleAssistant",
			"artifactType": "xK0V9G_artifactType",
			"yzjDockNarrow": "xK0V9G_yzjDockNarrow",
			"topicLensRowUser": "xK0V9G_topicLensRowUser",
			"convListHint": "xK0V9G_convListHint",
			"roomReplyText": "xK0V9G_roomReplyText",
			"replyChip": "xK0V9G_replyChip",
			"yzjDockRobot": "xK0V9G_yzjDockRobot",
			"modal": "xK0V9G_modal",
			"topicDockSummary": "xK0V9G_topicDockSummary",
			"streamMore": "xK0V9G_streamMore",
			"topicDrawerBody": "xK0V9G_topicDrawerBody",
			"handBtn": "xK0V9G_handBtn",
			"convRowBody": "xK0V9G_convRowBody",
			"pageTabOn": "xK0V9G_pageTabOn",
			"topicDrawerTitle": "xK0V9G_topicDrawerTitle",
			"rowSelf": "xK0V9G_rowSelf",
			"stack": "xK0V9G_stack",
			"yzjDockEntry": "xK0V9G_yzjDockEntry",
			"im": "xK0V9G_im",
			"roomRowOther": "xK0V9G_roomRowOther",
			"bubble": "xK0V9G_bubble",
			"roomToolBtn": "xK0V9G_roomToolBtn",
			"yzjDockEntryActive": "xK0V9G_yzjDockEntryActive",
			"topicDrawerInput": "xK0V9G_topicDrawerInput",
			"artifactMeta": "xK0V9G_artifactMeta",
			"roomRowSelf": "xK0V9G_roomRowSelf",
			"roomReplyCancel": "xK0V9G_roomReplyCancel",
			"groupSpace": "xK0V9G_groupSpace",
			"topicChip": "xK0V9G_topicChip",
			"groupSpaceTopics": "xK0V9G_groupSpaceTopics",
			"roomRow": "xK0V9G_roomRow",
			"convRowTime": "xK0V9G_convRowTime",
			"convDot": "xK0V9G_convDot",
			"roomBubbleSelf": "xK0V9G_roomBubbleSelf",
			"convBadge": "xK0V9G_convBadge",
			"topicDrawerNav": "xK0V9G_topicDrawerNav",
			"topicCard": "xK0V9G_topicCard",
			"topicCardOrigin": "xK0V9G_topicCardOrigin",
			"unbound": "xK0V9G_unbound",
			"roomMain": "xK0V9G_roomMain",
			"convRowActive": "xK0V9G_convRowActive",
			"topicAnchorBar": "xK0V9G_topicAnchorBar",
			"topicList": "xK0V9G_topicList",
			"groupSpaceToggle": "xK0V9G_groupSpaceToggle",
			"pageTabs": "xK0V9G_pageTabs",
			"topicDrawerSend": "xK0V9G_topicDrawerSend",
			"topicLensRowAssistant": "xK0V9G_topicLensRowAssistant",
			"topicLensBubble": "xK0V9G_topicLensBubble",
			"tag": "xK0V9G_tag",
			"roomMeta": "xK0V9G_roomMeta",
			"roomAction": "xK0V9G_roomAction",
			"yzjDockMark": "xK0V9G_yzjDockMark",
			"pageBody": "xK0V9G_pageBody",
			"roomStage": "xK0V9G_roomStage",
			"artifactCard": "xK0V9G_artifactCard",
			"roomSendCircle": "xK0V9G_roomSendCircle",
			"meta": "xK0V9G_meta",
			"artifactName": "xK0V9G_artifactName",
			"row": "xK0V9G_row",
			"chromeBtn": "xK0V9G_chromeBtn",
			"modalMask": "xK0V9G_modalMask",
			"topicListLabel": "xK0V9G_topicListLabel"
		};
		//#endregion
		//#region src/client/conv-list.tsx
		/**
		* Workbench conversation list (docs/spec/group-room-topics.md R15/L1).
		* Merges `im group recent` with bound-room topics: row time/preview follow
		* max(latest group message, latest topic activity); topic wins with a
		* 「话题·标题」prefix. Click always lands on the timeline (drawer stays shut).
		*/
		function asRecord$7(value) {
			return typeof value === "object" && value !== null ? value : {};
		}
		function asArray$5(value) {
			return Array.isArray(value) ? value : [];
		}
		function asString$5(value) {
			return typeof value === "string" ? value : "";
		}
		function kindOf(groupId) {
			return groupId.startsWith("BOT-") ? "dm" : "group";
		}
		/**
		* Classify an `im group recent` row into inbox sections.
		* Measured against yzj-cli 0.1.6 `im group recent` (2026-09-10): conversation-list
		* enum is **1 = 单聊, 2 = 群, ≥3 = 订阅/通知** — not the group-admin 内部/外部 enum,
		* and not the inverted mapping that shipped in the first IM-shell cut.
		* `BOT-` id space remains measured DM; `pubacc` → subscription.
		*/
		function inboxRoomKind(row) {
			const id = row.groupId;
			if (/pubacc/i.test(id)) return "subscription";
			if (id.startsWith("BOT-")) return "dm";
			const type = row.groupType;
			if (type === 1) return "dm";
			if (type !== void 0 && type >= 3) return "subscription";
			return "group";
		}
		function groupTypeOf(item) {
			const value = item.groupType;
			if (typeof value === "number" && Number.isFinite(value)) return value;
			if (typeof value === "string" && value.trim() !== "") {
				const parsed = Number(value);
				if (Number.isFinite(parsed)) return parsed;
			}
		}
		function photoOf(item) {
			return asString$5(item.headerUrl) || asString$5(item.photoUrl);
		}
		/** Recent CLI rows plus whether another page exists. */
		function parseRecentGroups(value) {
			const rec = asRecord$7(value);
			return {
				rooms: asArray$5(rec.list).flatMap((row) => {
					const item = asRecord$7(row);
					const groupId = asString$5(item.groupId);
					if (groupId === "") return [];
					const headerUrl = photoOf(item);
					const groupType = groupTypeOf(item);
					return [{
						groupId,
						groupName: asString$5(item.groupName) || (kindOf(groupId) === "dm" ? "私聊" : "群聊"),
						lastMsg: asRecord$7(item.lastMsg),
						lastMsgSendTime: item.lastMsgSendTime,
						...headerUrl === "" ? {} : { headerUrl },
						...groupType === void 0 ? {} : { groupType }
					}];
				}),
				more: rec.more === true
			};
		}
		//#endregion
		//#region \0dsh-css:/Users/kingdee/dev/dsh-yzj/packages/ui-yzj/src/client/panel.module.css.mjs
		const css$1 = ".YwXzpq_toggle{width:100%;color:var(--dsw-alias-label-secondary);cursor:pointer;transition:background-color .12s var(--ds-ease-in-out,ease), color .12s var(--ds-ease-in-out,ease);background:0 0;border:none;border-radius:8px;justify-content:center;align-items:center;gap:6px;padding:6px 10px;display:flex}.YwXzpq_toggle:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.YwXzpq_toggleActive{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-static-deepseek-500)}.YwXzpq_toggleLabel{white-space:nowrap;font-size:12px;font-weight:500}.YwXzpq_unreadBadge{background:var(--dsw-static-red-500);color:#fff;text-align:center;border-radius:999px;flex:none;min-width:16px;height:16px;padding:0 4px;font-size:10px;line-height:16px;position:relative}.YwXzpq_panel{z-index:100;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);width:min(880px,96vw);height:min(700px,94vh);color:var(--dsw-alias-label-primary);border-radius:14px;flex-direction:column;margin:auto;font-size:14px;line-height:20px;display:flex;position:fixed;inset:0;overflow:hidden;box-shadow:0 16px 48px #0000002e}.YwXzpq_panelEmbedded{z-index:0;width:100%;height:100%;min-height:0;box-shadow:none;border:none;border-radius:0;margin:0;position:relative;inset:auto}.YwXzpq_header{flex:none;align-items:center;gap:8px;padding:10px 12px;display:flex}.YwXzpq_brand{color:var(--dsw-static-deepseek-500);flex:none;align-items:center;display:inline-flex}.YwXzpq_title{flex:none;font-size:14px;font-weight:600}.YwXzpq_headerSpacer{flex:1}.YwXzpq_tabs{border-bottom:1px solid var(--dsw-alias-border-l1);flex:none;gap:2px;padding:2px 12px 8px;display:flex;overflow:hidden}.YwXzpq_tab{color:var(--dsw-alias-label-secondary);cursor:pointer;transition:background-color .12s var(--ds-ease-in-out,ease), color .12s var(--ds-ease-in-out,ease);background:0 0;border:none;border-radius:8px;flex:1;justify-content:center;align-items:center;gap:4px;padding:5px 8px;font-size:12px;display:inline-flex}.YwXzpq_tab:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.YwXzpq_tabActive{background:var(--dsw-static-deepseek-100);color:var(--dsw-static-deepseek-600);font-weight:600}.YwXzpq_tabActive:hover{background:var(--dsw-static-deepseek-100);color:var(--dsw-static-deepseek-600)}.YwXzpq_iconButton{width:26px;height:26px;color:var(--dsw-alias-label-secondary);cursor:pointer;transition:background-color .12s var(--ds-ease-in-out,ease), color .12s var(--ds-ease-in-out,ease);background:0 0;border:none;border-radius:7px;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}.YwXzpq_iconButton:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.YwXzpq_iconButton:disabled{opacity:.5;cursor:default}.YwXzpq_headerButton{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);cursor:pointer;transition:background-color .12s var(--ds-ease-in-out,ease);border-radius:8px;flex:none;padding:5px 12px;font-size:12px}.YwXzpq_headerButton:hover{background:var(--dsw-alias-interactive-bg-hover)}.YwXzpq_headerButton:disabled{opacity:.5;cursor:default}.YwXzpq_body{flex-direction:column;flex:1;min-height:0;display:flex;overflow:hidden}.YwXzpq_twoPane{flex:1;min-height:0;display:flex}.YwXzpq_paneLeft{border-right:1px solid var(--dsw-alias-border-l1);flex-direction:column;flex:none;width:250px;min-height:0;display:flex}.YwXzpq_docSearch{flex:none;padding:8px 8px 0}.YwXzpq_docSearchInput{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);width:100%;color:var(--dsw-alias-label-primary);border-radius:8px;outline:none;padding:0 10px;font-size:12px;line-height:28px}.YwXzpq_docSearchInput:focus{border-color:var(--dsw-static-deepseek-500)}.YwXzpq_paneGroupLabel{color:var(--dsw-alias-label-tertiary);letter-spacing:.5px;flex:none;padding:6px 4px 2px;font-size:10.5px;font-weight:600}.YwXzpq_paneRight{flex-direction:column;flex:1;min-width:0;min-height:0;display:flex}.YwXzpq_paneList{flex-direction:column;flex:1;gap:3px;min-height:0;padding:8px;display:flex;overflow:auto}.YwXzpq_paneEmpty{min-height:0;color:var(--dsw-alias-label-tertiary);flex-direction:column;flex:1;justify-content:center;align-items:center;gap:8px;font-size:13px;display:flex}.YwXzpq_paneHead{flex:none;align-items:center;gap:8px;padding:4px 10px 8px;display:flex}.YwXzpq_paneTitle{text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:14px;font-weight:600;overflow:hidden}.YwXzpq_itemActive{background:var(--dsw-static-deepseek-100);box-shadow:inset 3px 0 0 var(--dsw-static-deepseek-500)}.YwXzpq_itemActive:hover{background:var(--dsw-static-deepseek-100)}.YwXzpq_itemActive .YwXzpq_itemTitleText{color:var(--dsw-static-deepseek-600);font-weight:700}.YwXzpq_readAllRow{border-bottom:1px solid var(--dsw-alias-border-l1);flex:none;justify-content:space-between;align-items:center;gap:8px;padding:6px 12px;display:flex}.YwXzpq_readAllHint{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:16px}.YwXzpq_readAll{border:1px solid var(--dsw-static-deepseek-500);color:var(--dsw-static-deepseek-500);cursor:pointer;transition:background-color .12s var(--ds-ease-in-out,ease), color .12s var(--ds-ease-in-out,ease);background:0 0;border-radius:999px;flex:none;padding:3px 12px;font-size:12px;line-height:18px}.YwXzpq_readAll:hover:not(:disabled){background:var(--dsw-static-deepseek-100)}.YwXzpq_readAll:disabled{opacity:.45;cursor:default}.YwXzpq_error{border-bottom:1px solid var(--dsw-static-red-500);background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-static-red-400);flex:none;align-items:center;gap:8px;padding:7px 12px;font-size:12px;display:flex}.YwXzpq_errorText{text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;overflow:hidden}.YwXzpq_errorDismiss{width:20px;height:20px;color:inherit;cursor:pointer;background:0 0;border:none;border-radius:5px;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}.YwXzpq_errorDismiss:hover{background:var(--dsw-alias-interactive-bg-hover)}.YwXzpq_loading{color:var(--dsw-alias-label-tertiary);flex:none;padding:6px 12px;font-size:12px}.YwXzpq_list{flex-direction:column;flex:1;gap:3px;padding:8px;display:flex;overflow:auto}.YwXzpq_item{color:var(--dsw-alias-label-primary);text-align:left;cursor:pointer;min-width:0;transition:background-color .12s var(--ds-ease-in-out,ease);background:0 0;border:none;border-radius:10px;flex-direction:column;gap:3px;padding:8px 10px;font-size:14px;display:flex}.YwXzpq_item:hover{background:var(--dsw-alias-interactive-bg-hover)}.YwXzpq_itemTitle{align-items:center;gap:10px;min-width:0;font-weight:500;display:flex}.YwXzpq_itemTitleText{text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;overflow:hidden}.YwXzpq_itemSub{color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;padding-left:42px;font-size:12px;line-height:16px;overflow:hidden}.YwXzpq_docGlyph,.YwXzpq_groupGlyph,.YwXzpq_userGlyph{background:var(--dsw-static-deepseek-100);width:32px;height:32px;color:var(--dsw-static-deepseek-600);border-radius:8px;flex:none;justify-content:center;align-items:center;font-size:14px;font-weight:600;display:inline-flex}.YwXzpq_badge{background:var(--dsw-static-red-500);color:#fff;border-radius:999px;flex:none;padding:0 6px;font-size:11px;line-height:16px}.YwXzpq_itemAnchored{outline:2px solid var(--dsw-static-deepseek-500);outline-offset:-1px;background:var(--dsw-static-deepseek-100)}.YwXzpq_msgItem{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);padding-left:18px;position:relative}.YwXzpq_msgRow{border-radius:10px;align-items:flex-start;gap:8px;min-width:0;padding:4px 10px 4px 18px;display:flex;position:relative}.YwXzpq_msgRow:hover{background:var(--dsw-alias-interactive-bg-hover)}.YwXzpq_msgRowSystem{justify-content:center;padding-left:10px}.YwXzpq_msgAvatar{object-fit:cover;background:var(--dsw-alias-bg-layer-2);border-radius:50%;flex:none;width:28px;height:28px;margin-top:2px}.YwXzpq_msgAvatarFallback{background:var(--dsw-static-deepseek-100);width:28px;height:28px;color:var(--dsw-static-deepseek-600);border-radius:50%;flex:none;justify-content:center;align-items:center;margin-top:2px;font-size:12px;font-weight:600;display:inline-flex}.YwXzpq_msgStack{flex-direction:column;flex:1;align-items:flex-start;min-width:0;display:flex}.YwXzpq_msgMetaLine{align-items:baseline;gap:8px;min-width:0;margin-top:1px;display:flex}.YwXzpq_msgTime{color:var(--dsw-alias-label-caption);font-variant-numeric:tabular-nums;flex:none;font-size:11px;line-height:14px}.YwXzpq_msgContent{min-width:0;margin-top:2px}.YwXzpq_anchorTag{background:var(--dsw-static-deepseek-100);color:var(--dsw-static-deepseek-600);border-radius:999px;flex:none;padding:0 6px;font-size:10px;line-height:16px}.YwXzpq_anchorHint{border:1px solid var(--dsw-static-deepseek-500);background:var(--dsw-static-deepseek-100);color:var(--dsw-static-deepseek-600);border-radius:8px;flex:none;margin:0 10px;padding:4px 10px;font-size:11px;line-height:16px}.YwXzpq_groupChips{scrollbar-width:none;flex:none;gap:6px;padding:6px 10px 2px;display:flex;overflow-x:auto}.YwXzpq_groupChips::-webkit-scrollbar{display:none}.YwXzpq_groupChip{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);cursor:pointer;transition:border-color .12s var(--ds-ease-in-out,ease), background-color .12s var(--ds-ease-in-out,ease), color .12s var(--ds-ease-in-out,ease);border-radius:999px;flex:none;align-items:center;gap:5px;padding:3px 10px;font-size:12px;line-height:18px;display:inline-flex}.YwXzpq_groupChip:hover{border-color:var(--dsw-static-deepseek-500);color:var(--dsw-alias-label-primary)}.YwXzpq_groupChipActive{border-color:var(--dsw-static-deepseek-500);background:var(--dsw-static-deepseek-100);color:var(--dsw-static-deepseek-600);font-weight:600}.YwXzpq_chipBadge{background:var(--dsw-static-red-500);color:#fff;border-radius:999px;padding:0 5px;font-size:10px;line-height:14px}.YwXzpq_msgReply{color:var(--dsw-static-deepseek-500);cursor:pointer;opacity:0;transition:opacity .12s var(--ds-ease-in-out,ease), background-color .12s var(--ds-ease-in-out,ease);background:0 0;border:none;border-radius:6px;margin-top:2px;padding:2px 8px;font-size:11px;line-height:16px}.YwXzpq_msgRow:hover .YwXzpq_msgReply{opacity:1}.YwXzpq_msgReply:hover{background:var(--dsw-alias-interactive-bg-hover)}.YwXzpq_dayDivider{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary);border-radius:999px;margin:6px auto 2px;padding:1px 10px;font-size:11px;line-height:18px;display:table}.YwXzpq_groupHead{align-items:center;gap:8px;padding:2px 10px 8px;display:flex}.YwXzpq_groupHeadName{text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:14px;font-weight:600;overflow:hidden}.YwXzpq_msgBody{color:var(--dsw-alias-label-primary);white-space:pre-wrap;word-break:break-word;min-width:0;font-size:13px;line-height:18px}.YwXzpq_chatHeader{border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);flex:none;align-items:center;gap:4px;padding:2px 4px 0;display:flex}.YwXzpq_panelBanner{background:var(--dsw-static-deepseek-100);color:var(--dsw-alias-label-secondary);border-radius:8px;margin:6px 8px 4px;padding:8px 10px;font-size:12px;line-height:18px}.YwXzpq_chatHeader .YwXzpq_groupHead{padding:2px 6px 6px}.YwXzpq_back{color:var(--dsw-static-deepseek-500);text-align:left;cursor:pointer;transition:background-color .12s var(--ds-ease-in-out,ease);background:0 0;border:none;border-radius:6px;flex:none;align-items:center;gap:2px;padding:5px 8px;font-size:12px;display:inline-flex}.YwXzpq_back:hover{background:var(--dsw-static-deepseek-100)}.YwXzpq_more{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-static-deepseek-500);cursor:pointer;transition:background-color .12s var(--ds-ease-in-out,ease);border-radius:999px;flex:none;margin:6px auto 2px;padding:5px 14px;font-size:12px}.YwXzpq_more:hover:not(:disabled){background:var(--dsw-static-deepseek-100)}.YwXzpq_more:disabled{opacity:.5;cursor:default}.YwXzpq_empty{color:var(--dsw-alias-label-tertiary);text-align:center;flex-direction:column;align-items:center;gap:10px;padding:44px 0;font-size:12px;display:flex}.YwXzpq_searchRow{flex:none;gap:6px;padding:10px 10px 6px;display:flex}.YwXzpq_searchInput{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);transition:border-color .12s var(--ds-ease-in-out,ease), background-color .12s var(--ds-ease-in-out,ease);border-radius:8px;outline:none;flex:1;padding:6px 10px;font-size:13px}.YwXzpq_searchInput:focus{border-color:var(--dsw-static-deepseek-500);background:var(--dsw-alias-bg-base)}.YwXzpq_meCard{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:12px;flex:none;align-items:center;gap:12px;margin:6px 10px 8px;padding:12px;display:flex}.YwXzpq_meAvatar{object-fit:cover;border-radius:50%;flex:none;width:44px;height:44px}.YwXzpq_meAvatarFallback{background:var(--dsw-static-deepseek-100);width:44px;height:44px;color:var(--dsw-static-deepseek-600);border-radius:50%;flex:none;justify-content:center;align-items:center;font-size:18px;font-weight:600;display:inline-flex}.YwXzpq_meInfo{min-width:0}.YwXzpq_meName{font-size:15px;font-weight:600}.YwXzpq_meSub{color:var(--dsw-alias-label-tertiary);margin-top:2px;font-size:12px;line-height:16px}.YwXzpq_floatWrap{z-index:90;position:fixed;bottom:26px;right:26px}.YwXzpq_floatBall{background:var(--dsw-alias-button-info-fill);width:52px;height:52px;color:var(--dsw-alias-label-primary-foreground);cursor:pointer;transition:background-color .12s var(--ds-ease-in-out,ease), transform .12s var(--ds-ease-in-out,ease);border:none;border-radius:50%;justify-content:center;align-items:center;display:flex;position:relative;box-shadow:0 4px 14px #2e6ff259}.YwXzpq_floatBall:hover{background:var(--dsw-alias-button-info-hover);transform:scale(1.04)}.YwXzpq_floatBallActive{box-shadow:0 0 0 2px var(--dsw-alias-bg-base), 0 0 0 4px var(--dsw-static-deepseek-500), 0 4px 14px #2e6ff259}.YwXzpq_floatBallBadge{border:2px solid var(--dsw-alias-bg-base);background:var(--dsw-static-red-500);color:#fff;border-radius:999px;justify-content:center;align-items:center;min-width:20px;height:20px;padding:0 5px;font-size:11px;font-weight:700;line-height:16px;display:flex;position:absolute;top:-4px;right:-4px}.YwXzpq_floatDock{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);opacity:0;visibility:hidden;transition:opacity .12s var(--ds-ease-in-out,ease), transform .12s var(--ds-ease-in-out,ease), visibility .12s;border-radius:12px;flex-direction:column;gap:2px;padding:6px;display:flex;position:absolute;bottom:62px;right:0;transform:translateY(6px);box-shadow:0 12px 32px #00000024}.YwXzpq_floatDockOpen{opacity:1;visibility:visible;transform:none}.YwXzpq_floatDockItem{width:92px;color:var(--dsw-alias-label-secondary);cursor:pointer;transition:background-color .12s var(--ds-ease-in-out,ease), color .12s var(--ds-ease-in-out,ease);background:0 0;border:none;border-radius:8px;align-items:center;gap:8px;padding:6px 10px;display:flex;position:relative}.YwXzpq_floatDockItem:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.YwXzpq_floatDockLabel{white-space:nowrap;font-size:12px;line-height:16px}.YwXzpq_floatDockBadge{border:1px solid var(--dsw-alias-bg-layer-1);background:var(--dsw-static-red-500);color:#fff;border-radius:999px;justify-content:center;align-items:center;min-width:16px;height:16px;padding:0 4px;font-size:10px;font-weight:700;line-height:14px;display:flex;position:absolute;top:2px;left:26px}.YwXzpq_panelToast{background:var(--dsw-static-neutral-bluish-850);color:var(--dsw-alias-label-primary-foreground);text-align:center;border-radius:999px;margin:2px 4px 6px;padding:8px 12px;font-size:11px;line-height:16px}.YwXzpq_avatar{object-fit:cover;background:var(--dsw-alias-bg-layer-2);border-radius:8px;flex:none;width:32px;height:32px}.YwXzpq_itemTime{color:var(--dsw-alias-label-caption);font-variant-numeric:tabular-nums;flex:none;font-size:11px;line-height:14px}.YwXzpq_msgSender{color:var(--dsw-alias-label-secondary);text-overflow:ellipsis;white-space:nowrap;flex:none;min-width:0;font-size:12px;font-weight:600;line-height:16px;overflow:hidden}.YwXzpq_msgQuote{color:var(--dsw-alias-label-tertiary);border-left:2px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-2);text-overflow:ellipsis;white-space:nowrap;border-radius:6px;min-width:0;margin:0 0 4px;padding:4px 8px;font-size:12px;line-height:16px;display:block;overflow:hidden}.YwXzpq_msgImage{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);cursor:zoom-in;border-radius:8px;max-width:100%;max-height:220px;margin-top:4px;display:block}.YwXzpq_msgBold{font-weight:600}.YwXzpq_msgImageSkeleton,.YwXzpq_msgImageFail{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary);border-radius:6px;margin-top:4px;padding:6px 10px;font-size:12px;line-height:16px;display:inline-block}.YwXzpq_msgImageFail{color:var(--dsw-static-red-400)}.YwXzpq_msgSystem{color:var(--dsw-alias-label-tertiary);text-align:center;font-size:12px;line-height:18px}.YwXzpq_msgFile{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);cursor:pointer;min-width:0;transition:border-color .12s var(--ds-ease-in-out,ease), background-color .12s var(--ds-ease-in-out,ease);border-radius:8px;align-items:center;gap:10px;margin-top:2px;padding:8px 10px;text-decoration:none;display:flex}.YwXzpq_msgFileGroup{align-items:stretch;gap:6px;min-width:0;display:flex}.YwXzpq_msgFile:hover:not(:disabled){border-color:var(--dsw-static-deepseek-500);background:var(--dsw-static-deepseek-100)}.YwXzpq_msgFile:disabled{opacity:.5;cursor:default}.YwXzpq_msgFileDownload{border:1px dashed var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);cursor:pointer;transition:border-color .12s var(--ds-ease-in-out,ease), color .12s var(--ds-ease-in-out,ease);background:0 0;border-radius:8px;flex:none;align-self:center;padding:4px 8px;font-size:11px;line-height:14px}.YwXzpq_msgFileDownload:hover{border-color:var(--dsw-static-deepseek-500);color:var(--dsw-static-deepseek-500)}.YwXzpq_msgFileIcon{flex:none;font-size:20px;line-height:20px}.YwXzpq_msgFileMeta{flex-direction:column;gap:2px;min-width:0;display:flex}.YwXzpq_msgFileName{text-overflow:ellipsis;white-space:nowrap;font-size:13px;line-height:16px;overflow:hidden}.YwXzpq_msgFileSize{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:14px}.YwXzpq_linkCard{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);min-width:0;transition:border-color .12s var(--ds-ease-in-out,ease);border-radius:8px;gap:10px;margin-top:2px;padding:8px 10px;text-decoration:none;display:flex}.YwXzpq_linkCard:hover{border-color:var(--dsw-static-deepseek-500)}.YwXzpq_linkCardThumb{object-fit:cover;background:var(--dsw-alias-bg-layer-2);border-radius:6px;flex:none;width:56px;height:56px}.YwXzpq_linkCardBody{flex-direction:column;flex:1;gap:3px;min-width:0;display:flex}.YwXzpq_linkCardTitle{text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:600;line-height:16px;overflow:hidden}.YwXzpq_linkCardDesc{color:var(--dsw-alias-label-secondary);-webkit-line-clamp:2;-webkit-box-orient:vertical;font-size:12px;line-height:16px;display:-webkit-box;overflow:hidden}.YwXzpq_linkCardAction{color:var(--dsw-static-deepseek-500);font-size:11px;line-height:14px}.YwXzpq_lightbox{z-index:200;cursor:zoom-out;background:#000000b8;justify-content:center;align-items:center;display:flex;position:fixed;inset:0}.YwXzpq_lightboxImg{border-radius:8px;max-width:90vw;max-height:90vh;box-shadow:0 24px 64px #00000080}.YwXzpq_lightboxPdf{background:#fff;border:none;border-radius:8px;width:min(720px,92vw);height:min(90vh,900px);box-shadow:0 24px 64px #00000080}.YwXzpq_composer{border-top:1px solid var(--dsw-alias-border-l1);flex-direction:column;flex:none;gap:6px;padding:8px 10px;display:flex;position:relative}.YwXzpq_composerRow{align-items:flex-end;gap:6px;display:flex;position:relative}.YwXzpq_atMenu{z-index:20;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);border-radius:10px;flex-direction:column;gap:1px;min-width:180px;max-width:260px;padding:4px;display:flex;position:absolute;bottom:calc(100% + 6px);left:0;box-shadow:0 8px 24px #0003}.YwXzpq_atHint{color:var(--dsw-alias-label-tertiary);padding:5px 8px;font-size:11px;line-height:15px}.YwXzpq_atItem{color:var(--dsw-alias-label-primary);cursor:pointer;text-align:left;background:0 0;border:none;border-radius:7px;align-items:center;gap:8px;padding:7px 8px;font-size:12.5px;line-height:1;display:flex}.YwXzpq_atItem:hover{background:var(--dsw-alias-interactive-bg-hover)}.YwXzpq_atGlyph{background:var(--dsw-static-deepseek-100);width:22px;height:22px;color:var(--dsw-static-deepseek-600);border-radius:50%;flex-shrink:0;justify-content:center;align-items:center;font-size:11px;font-weight:600;display:inline-flex}.YwXzpq_composerInput{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);min-width:0;color:var(--dsw-alias-label-primary);resize:none;max-height:120px;transition:border-color .12s var(--ds-ease-in-out,ease);border-radius:10px;outline:none;flex:1;padding:7px 10px;font-family:inherit;font-size:13px;line-height:18px;overflow-y:auto}.YwXzpq_composerInput:focus{border-color:var(--dsw-static-deepseek-500)}.YwXzpq_composerInput::placeholder{color:var(--dsw-alias-label-tertiary)}.YwXzpq_composerInput:disabled{opacity:.6}.YwXzpq_composerSend{background:var(--dsw-static-deepseek-500);color:#fff;cursor:pointer;transition:background-color .12s var(--ds-ease-in-out,ease), opacity .12s var(--ds-ease-in-out,ease);border:none;border-radius:10px;flex:none;padding:7px 14px;font-size:13px;font-weight:600}.YwXzpq_composerSend:hover:not(:disabled){background:var(--dsw-static-deepseek-600)}.YwXzpq_composerSend:disabled{opacity:.45;cursor:default}.YwXzpq_composerToolbar{align-items:center;gap:2px;display:flex}.YwXzpq_toolButton{cursor:pointer;width:26px;height:26px;transition:background-color .12s var(--ds-ease-in-out,ease);background:0 0;border:none;border-radius:6px;justify-content:center;align-items:center;font-size:15px;line-height:15px;display:inline-flex}.YwXzpq_toolButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.YwXzpq_toolButton:disabled{opacity:.4;cursor:default}.YwXzpq_toolStatus{color:var(--dsw-alias-label-tertiary);margin-left:6px;font-size:11px}.YwXzpq_replyBar{border-left:2px solid var(--dsw-static-deepseek-500);background:var(--dsw-alias-bg-layer-1);border-radius:6px;align-items:center;gap:8px;padding:5px 8px;font-size:12px;display:flex}.YwXzpq_replyText{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-secondary);flex:1;overflow:hidden}.YwXzpq_replyCancel{color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;border-radius:4px;flex:none;padding:2px 4px;font-size:11px;line-height:14px}.YwXzpq_replyCancel:hover{background:var(--dsw-alias-interactive-bg-hover)}.YwXzpq_emojiPanel{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);z-index:30;border-radius:12px;grid-template-columns:repeat(8,1fr);gap:2px;padding:8px;display:grid;position:absolute;bottom:calc(100% - 4px);left:10px;box-shadow:0 12px 32px #00000029}.YwXzpq_emojiCell{cursor:pointer;background:0 0;border:none;border-radius:6px;justify-content:center;align-items:center;width:30px;height:30px;font-size:17px;display:inline-flex}.YwXzpq_emojiCell:hover{background:var(--dsw-alias-interactive-bg-hover)}.YwXzpq_calHead{flex:none;justify-content:space-between;align-items:center;padding:8px 10px 4px;display:flex}.YwXzpq_calTitle{font-size:13px;font-weight:600}.YwXzpq_calNav{width:24px;height:24px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:6px;font-size:16px;line-height:16px}.YwXzpq_calNav:hover{background:var(--dsw-alias-interactive-bg-hover)}.YwXzpq_calToday{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:999px;margin-left:6px;padding:4px 9px;font-size:11px;line-height:1;transition:border-color .15s,color .15s,background .15s}.YwXzpq_calToday:hover{border-color:var(--dsw-static-deepseek-500);background:var(--dsw-static-deepseek-100);color:var(--dsw-static-deepseek-600)}.YwXzpq_crumbs{flex-wrap:wrap;align-items:center;gap:2px;min-width:0;display:flex}.YwXzpq_crumbLink{color:var(--dsw-static-deepseek-500);cursor:pointer;text-overflow:ellipsis;white-space:nowrap;background:0 0;border:none;max-width:160px;padding:2px 3px;font-size:13px;line-height:18px;overflow:hidden}.YwXzpq_crumbLink:hover{text-decoration:underline}.YwXzpq_crumbItem{align-items:center;min-width:0;display:inline-flex}.YwXzpq_crumbSep{color:var(--dsw-alias-label-caption);padding:0 1px;font-size:12px}.YwXzpq_crumbCurrent{color:var(--dsw-alias-label-primary);text-overflow:ellipsis;white-space:nowrap;max-width:200px;padding:2px 3px;font-size:13px;font-weight:600;line-height:18px;overflow:hidden}.YwXzpq_docRowWrap{align-items:stretch;gap:4px;min-width:0;display:flex}.YwXzpq_docRowWrap .YwXzpq_item{flex:1;min-width:0}.YwXzpq_drill{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);width:30px;color:var(--dsw-alias-label-tertiary);cursor:pointer;border-radius:9px;flex-shrink:0;justify-content:center;align-self:center;align-items:center;height:30px;transition:border-color .15s,color .15s,background .15s;display:inline-flex}.YwXzpq_drill:hover{border-color:var(--dsw-static-deepseek-500);color:var(--dsw-static-deepseek-600);background:var(--dsw-static-deepseek-100)}.YwXzpq_calGrid{grid-template-columns:repeat(7,1fr);gap:2px;padding:4px 10px 10px;display:grid}.YwXzpq_calDow{text-align:center;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:20px}.YwXzpq_calBlank{height:30px}.YwXzpq_calCell{height:30px;color:var(--dsw-alias-label-primary);cursor:pointer;transition:background-color .12s var(--ds-ease-in-out,ease);background:0 0;border:none;border-radius:8px;justify-content:center;align-items:center;font-size:12px;display:flex;position:relative}.YwXzpq_calCell:hover{background:var(--dsw-alias-interactive-bg-hover)}.YwXzpq_calCellToday{box-shadow:inset 0 0 0 1px var(--dsw-static-deepseek-500)}.YwXzpq_calCellSelected{background:var(--dsw-static-deepseek-100);color:var(--dsw-static-deepseek-600);font-weight:600}.YwXzpq_calCellHas{color:var(--dsw-static-deepseek-500);font-weight:600}.YwXzpq_calDayNum{line-height:18px}.YwXzpq_calDot{background:var(--dsw-static-deepseek-500);border-radius:50%;width:4px;height:4px;position:absolute;bottom:2px;left:50%;transform:translate(-50%)}.YwXzpq_eventTime{color:var(--dsw-static-deepseek-500);font-variant-numeric:tabular-nums;font-size:11px;line-height:14px}.YwXzpq_eventDetail{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:10px;flex-direction:column;gap:6px;margin-top:4px;padding:10px 12px;display:flex}.YwXzpq_eventDetailTitle{font-size:14px;font-weight:600;line-height:20px}.YwXzpq_eventDetailRow{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}.YwXzpq_eventDetailContent{border-top:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary);white-space:pre-wrap;word-break:break-word;margin-top:4px;padding-top:8px;font-size:13px;line-height:20px}.YwXzpq_docMeta{color:var(--dsw-alias-label-tertiary);flex:none;padding:0 10px 6px;font-size:11px;line-height:16px}.YwXzpq_docBody{min-height:0;color:var(--dsw-alias-label-primary);white-space:pre-wrap;word-break:break-word;flex-direction:column;flex:1;gap:4px;padding:2px 12px 12px;font-size:13px;line-height:22px;display:flex;overflow:auto}";
		const tagId$1 = "@dsh-yzj/bundle/panel.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@dsh-yzj/bundle";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var panel_module_css_default = {
			"msgSender": "YwXzpq_msgSender",
			"crumbs": "YwXzpq_crumbs",
			"calCell": "YwXzpq_calCell",
			"meInfo": "YwXzpq_meInfo",
			"title": "YwXzpq_title",
			"calDayNum": "YwXzpq_calDayNum",
			"meCard": "YwXzpq_meCard",
			"docBody": "YwXzpq_docBody",
			"groupGlyph": "YwXzpq_groupGlyph",
			"itemTime": "YwXzpq_itemTime",
			"toggle": "YwXzpq_toggle",
			"toggleActive": "YwXzpq_toggleActive",
			"calTitle": "YwXzpq_calTitle",
			"paneRight": "YwXzpq_paneRight",
			"msgImageFail": "YwXzpq_msgImageFail",
			"groupChips": "YwXzpq_groupChips",
			"brand": "YwXzpq_brand",
			"tabs": "YwXzpq_tabs",
			"paneLeft": "YwXzpq_paneLeft",
			"msgFileIcon": "YwXzpq_msgFileIcon",
			"docSearchInput": "YwXzpq_docSearchInput",
			"msgFileMeta": "YwXzpq_msgFileMeta",
			"emojiPanel": "YwXzpq_emojiPanel",
			"panel": "YwXzpq_panel",
			"msgStack": "YwXzpq_msgStack",
			"floatWrap": "YwXzpq_floatWrap",
			"msgSystem": "YwXzpq_msgSystem",
			"msgRow": "YwXzpq_msgRow",
			"linkCard": "YwXzpq_linkCard",
			"eventDetail": "YwXzpq_eventDetail",
			"linkCardAction": "YwXzpq_linkCardAction",
			"lightboxImg": "YwXzpq_lightboxImg",
			"groupHeadName": "YwXzpq_groupHeadName",
			"msgReply": "YwXzpq_msgReply",
			"searchRow": "YwXzpq_searchRow",
			"headerButton": "YwXzpq_headerButton",
			"readAllHint": "YwXzpq_readAllHint",
			"msgImage": "YwXzpq_msgImage",
			"itemTitle": "YwXzpq_itemTitle",
			"eventDetailRow": "YwXzpq_eventDetailRow",
			"groupChipActive": "YwXzpq_groupChipActive",
			"groupChip": "YwXzpq_groupChip",
			"more": "YwXzpq_more",
			"itemTitleText": "YwXzpq_itemTitleText",
			"floatBallBadge": "YwXzpq_floatBallBadge",
			"emojiCell": "YwXzpq_emojiCell",
			"floatBallActive": "YwXzpq_floatBallActive",
			"replyBar": "YwXzpq_replyBar",
			"floatDockOpen": "YwXzpq_floatDockOpen",
			"unreadBadge": "YwXzpq_unreadBadge",
			"toggleLabel": "YwXzpq_toggleLabel",
			"itemAnchored": "YwXzpq_itemAnchored",
			"anchorHint": "YwXzpq_anchorHint",
			"msgTime": "YwXzpq_msgTime",
			"meAvatarFallback": "YwXzpq_meAvatarFallback",
			"msgFileName": "YwXzpq_msgFileName",
			"composerSend": "YwXzpq_composerSend",
			"body": "YwXzpq_body",
			"toolStatus": "YwXzpq_toolStatus",
			"panelToast": "YwXzpq_panelToast",
			"anchorTag": "YwXzpq_anchorTag",
			"msgContent": "YwXzpq_msgContent",
			"paneGroupLabel": "YwXzpq_paneGroupLabel",
			"list": "YwXzpq_list",
			"chatHeader": "YwXzpq_chatHeader",
			"empty": "YwXzpq_empty",
			"lightbox": "YwXzpq_lightbox",
			"toolButton": "YwXzpq_toolButton",
			"docRowWrap": "YwXzpq_docRowWrap",
			"paneTitle": "YwXzpq_paneTitle",
			"back": "YwXzpq_back",
			"msgBold": "YwXzpq_msgBold",
			"iconButton": "YwXzpq_iconButton",
			"atGlyph": "YwXzpq_atGlyph",
			"avatar": "YwXzpq_avatar",
			"floatBall": "YwXzpq_floatBall",
			"calDot": "YwXzpq_calDot",
			"linkCardBody": "YwXzpq_linkCardBody",
			"msgFileSize": "YwXzpq_msgFileSize",
			"tabActive": "YwXzpq_tabActive",
			"atHint": "YwXzpq_atHint",
			"composerInput": "YwXzpq_composerInput",
			"lightboxPdf": "YwXzpq_lightboxPdf",
			"linkCardThumb": "YwXzpq_linkCardThumb",
			"msgFile": "YwXzpq_msgFile",
			"meName": "YwXzpq_meName",
			"linkCardTitle": "YwXzpq_linkCardTitle",
			"tab": "YwXzpq_tab",
			"loading": "YwXzpq_loading",
			"header": "YwXzpq_header",
			"errorText": "YwXzpq_errorText",
			"drill": "YwXzpq_drill",
			"floatDockItem": "YwXzpq_floatDockItem",
			"itemActive": "YwXzpq_itemActive",
			"meAvatar": "YwXzpq_meAvatar",
			"itemSub": "YwXzpq_itemSub",
			"chipBadge": "YwXzpq_chipBadge",
			"msgBody": "YwXzpq_msgBody",
			"panelBanner": "YwXzpq_panelBanner",
			"meSub": "YwXzpq_meSub",
			"linkCardDesc": "YwXzpq_linkCardDesc",
			"calHead": "YwXzpq_calHead",
			"msgFileGroup": "YwXzpq_msgFileGroup",
			"errorDismiss": "YwXzpq_errorDismiss",
			"dayDivider": "YwXzpq_dayDivider",
			"composer": "YwXzpq_composer",
			"floatDock": "YwXzpq_floatDock",
			"eventTime": "YwXzpq_eventTime",
			"docSearch": "YwXzpq_docSearch",
			"docGlyph": "YwXzpq_docGlyph",
			"floatDockLabel": "YwXzpq_floatDockLabel",
			"msgRowSystem": "YwXzpq_msgRowSystem",
			"atMenu": "YwXzpq_atMenu",
			"calCellHas": "YwXzpq_calCellHas",
			"calGrid": "YwXzpq_calGrid",
			"crumbCurrent": "YwXzpq_crumbCurrent",
			"item": "YwXzpq_item",
			"badge": "YwXzpq_badge",
			"crumbItem": "YwXzpq_crumbItem",
			"error": "YwXzpq_error",
			"crumbSep": "YwXzpq_crumbSep",
			"msgMetaLine": "YwXzpq_msgMetaLine",
			"floatDockBadge": "YwXzpq_floatDockBadge",
			"msgAvatar": "YwXzpq_msgAvatar",
			"calToday": "YwXzpq_calToday",
			"readAllRow": "YwXzpq_readAllRow",
			"readAll": "YwXzpq_readAll",
			"replyCancel": "YwXzpq_replyCancel",
			"paneList": "YwXzpq_paneList",
			"headerSpacer": "YwXzpq_headerSpacer",
			"msgFileDownload": "YwXzpq_msgFileDownload",
			"replyText": "YwXzpq_replyText",
			"calNav": "YwXzpq_calNav",
			"msgQuote": "YwXzpq_msgQuote",
			"userGlyph": "YwXzpq_userGlyph",
			"eventDetailContent": "YwXzpq_eventDetailContent",
			"paneEmpty": "YwXzpq_paneEmpty",
			"msgAvatarFallback": "YwXzpq_msgAvatarFallback",
			"crumbLink": "YwXzpq_crumbLink",
			"msgItem": "YwXzpq_msgItem",
			"calCellToday": "YwXzpq_calCellToday",
			"groupHead": "YwXzpq_groupHead",
			"panelEmbedded": "YwXzpq_panelEmbedded",
			"composerRow": "YwXzpq_composerRow",
			"calCellSelected": "YwXzpq_calCellSelected",
			"docMeta": "YwXzpq_docMeta",
			"eventDetailTitle": "YwXzpq_eventDetailTitle",
			"calDow": "YwXzpq_calDow",
			"searchInput": "YwXzpq_searchInput",
			"atItem": "YwXzpq_atItem",
			"twoPane": "YwXzpq_twoPane",
			"paneHead": "YwXzpq_paneHead",
			"composerToolbar": "YwXzpq_composerToolbar",
			"calBlank": "YwXzpq_calBlank",
			"msgImageSkeleton": "YwXzpq_msgImageSkeleton"
		};
		//#endregion
		//#region src/client/im-render.tsx
		/**
		* Shared Yunzhijia IM read-face (panel 会话 + group-room transcript).
		* Avatars, bracket-emoticons, inline images/files, reply quotes.
		* Does not implement reactions / recall / forward (R7).
		*/
		function asRecord$6(value) {
			return typeof value === "object" && value !== null ? value : {};
		}
		function asString$4(value) {
			return typeof value === "string" ? value : "";
		}
		function asArray$4(value) {
			return Array.isArray(value) ? value : [];
		}
		/** Human-readable label for a raw msgType. */
		function typeLabelOf(msgType) {
			if (msgType === "richText") return "图文";
			if (msgType === "file") return "文件";
			if (msgType === "other") return "系统";
			return "消息";
		}
		/** Group avatar: headerUrl image with first-letter fallback. */
		function GroupAvatar({ url, name }) {
			const [failed, setFailed] = (0, react.useState)(false);
			if (url === "" || failed) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: panel_module_css_default.groupGlyph,
				children: name.slice(0, 1)
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
				className: panel_module_css_default.avatar,
				src: url,
				alt: "",
				loading: "lazy",
				referrerPolicy: "no-referrer",
				onError: () => setFailed(true)
			});
		}
		/** Sender avatar in a message row: photo with a glyph fallback. */
		function SenderAvatar({ openId, fallback }) {
			const [failed, setFailed] = (0, react.useState)(false);
			const photo = senderPhotoOf(openId);
			if (photo === "" || failed) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: panel_module_css_default.msgAvatarFallback,
				children: fallback.slice(0, 1)
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
				className: panel_module_css_default.msgAvatar,
				src: photo,
				alt: "",
				loading: "lazy",
				referrerPolicy: "no-referrer",
				onError: () => setFailed(true)
			});
		}
		/**
		* One richText/image/file payload rendered through the file-data proxy
		* (docrest URLs require the authenticated CLI; the panel has no session
		* cookie). Shows a loading placeholder, then the image; failures degrade to
		* a small chip.
		*/
		function ProxyImage({ fileId, alt, onOpen, inject }) {
			const [src, setSrc] = (0, react.useState)(() => peekFileData(fileId) ?? null);
			const [failed, setFailed] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				const hit = peekFileData(fileId);
				if (hit !== void 0) {
					setSrc(hit);
					setFailed(false);
					return;
				}
				setSrc(null);
				setFailed(false);
				let alive = true;
				resolveFileData(fileId, inject).then((dataUrl) => {
					if (!alive) return;
					if (dataUrl === void 0) setFailed(true);
					else setSrc(dataUrl);
				});
				return () => {
					alive = false;
				};
			}, [fileId]);
			if (failed) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: panel_module_css_default.msgImageFail,
				children: "图片加载失败"
			});
			if (src === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: panel_module_css_default.msgImageSkeleton,
				children: "加载中…"
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
				className: panel_module_css_default.msgImage,
				src,
				alt,
				onClick: (event) => {
					event.stopPropagation();
					onOpen(src);
				}
			});
		}
		/** Extract a minimal adaptive-card face (image + title + action). */
		function cardFace(cardJson) {
			const face = {
				title: "",
				image: "",
				actionTitle: "",
				actionUrl: ""
			};
			let parsed;
			try {
				parsed = JSON.parse(cardJson);
			} catch {
				return face;
			}
			const walk = (node) => {
				if (typeof node !== "object" || node === null) return;
				const record = node;
				if (record.type === "Image" && typeof record.url === "string" && face.image === "") face.image = record.url;
				if (record.type === "TextBlock" && typeof record.text === "string" && record.isSubtle !== true && face.title === "") face.title = record.text;
				if (record.type === "Action.OpenUrl") {
					if (typeof record.title === "string" && face.actionTitle === "") face.actionTitle = record.title;
					if (typeof record.url === "string" && face.actionUrl === "") face.actionUrl = record.url;
				}
				for (const value of Object.values(record)) if (Array.isArray(value)) for (const item of value) walk(item);
				else if (typeof value === "object" && value !== null) walk(value);
			};
			walk(parsed);
			return face;
		}
		/**
		* One message's body, rendered by msgType: text (bold + emoticon tokens),
		* richText (inline proxy images + text), file (image inline / PDF preview /
		* download chip), other (link card, adaptive card, or system line).
		*/
		function MessageBody({ message, onOpenImage, onOpenPdf, inject }) {
			const content = asString$4(message.content);
			const msgType = asString$4(message.msgType);
			const param = asRecord$6(message.param);
			if (msgType === "other" && asString$4(param.title) === "" && asRecord$6(param.interactiveCard).cardJson === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: panel_module_css_default.msgSystem,
				children: content === "" ? "(系统消息)" : emojiText(content)
			});
			if (asString$4(param.sysType) === "withdrawMsg") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: panel_module_css_default.msgSystem,
				children: content === "" ? "撤回了一条消息" : emojiText(content)
			});
			const replyMsgId = asString$4(param.replyMsgId);
			const replySummary = asString$4(param.replySummary);
			const replyPerson = asString$4(param.replyPersonName);
			const quote = replyMsgId !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: panel_module_css_default.msgQuote,
				title: replySummary,
				children: `↳ ${replyPerson === "" ? "" : `${replyPerson}：`}${replySummary}`
			}) : null;
			if (msgType === "file") {
				const fileId = asString$4(param.file_id);
				const name = asString$4(param.name) !== "" ? asString$4(param.name) : content.replace(/^\[文件\]:/, "");
				const size = formatSize(param.size);
				const ext = asString$4(param.ext).toLowerCase();
				if (/^(png|jpe?g|gif|webp|bmp)$/.test(ext) && fileId !== "") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: panel_module_css_default.msgBody,
					children: [quote, /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProxyImage, {
						fileId,
						alt: name,
						onOpen: onOpenImage,
						inject
					})]
				});
				const isPdf = ext === "pdf";
				const icon = isPdf ? "📕" : /^(mp4|mov|avi|mkv|webm)$/.test(ext) ? "🎬" : /^(xls|xlsx|csv)$/.test(ext) ? "📊" : /^(doc|docx|txt|md)$/.test(ext) ? "📄" : /^(zip|rar|7z|tar|gz)$/.test(ext) ? "📦" : "📎";
				const download = () => {
					if (fileId === "") return;
					resolveFileData(fileId, inject).then((dataUrl) => {
						if (dataUrl === void 0) return;
						const link = document.createElement("a");
						link.href = dataUrl;
						link.download = name;
						document.body.appendChild(link);
						link.click();
						link.remove();
					});
				};
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: panel_module_css_default.msgBody,
					children: [quote, /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: panel_module_css_default.msgFileGroup,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: panel_module_css_default.msgFile,
							title: isPdf ? `预览 ${name}` : `下载 ${name}`,
							disabled: fileId === "",
							onClick: (event) => {
								event.stopPropagation();
								if (fileId === "") return;
								if (!isPdf) {
									download();
									return;
								}
								resolveFileData(fileId, inject).then((dataUrl) => {
									if (dataUrl !== void 0) onOpenPdf(dataUrl);
								});
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: panel_module_css_default.msgFileIcon,
								children: icon
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: panel_module_css_default.msgFileMeta,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: panel_module_css_default.msgFileName,
									children: name === "" ? "文件" : name
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: panel_module_css_default.msgFileSize,
									children: size === "" ? ext === "" ? "文件" : ext.toUpperCase() : size
								})]
							})]
						}), isPdf && fileId !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: panel_module_css_default.msgFileDownload,
							onClick: (event) => {
								event.stopPropagation();
								download();
							},
							children: "下载"
						})]
					})]
				});
			}
			if (msgType === "other" && asString$4(param.title) !== "") {
				const title = asString$4(param.title);
				const thumb = asString$4(param.thumbUrl);
				const url = asString$4(param.webpageUrl);
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: panel_module_css_default.msgBody,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("a", {
						className: panel_module_css_default.linkCard,
						href: url === "" ? void 0 : url,
						target: "_blank",
						rel: "noreferrer",
						onClick: (event) => {
							event.stopPropagation();
						},
						children: [thumb !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
							className: panel_module_css_default.linkCardThumb,
							src: thumb,
							alt: "",
							loading: "lazy",
							referrerPolicy: "no-referrer"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: panel_module_css_default.linkCardBody,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: panel_module_css_default.linkCardTitle,
									children: title
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: panel_module_css_default.linkCardDesc,
									children: emojiText(content)
								}),
								url !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: panel_module_css_default.linkCardAction,
									children: "查看详情 →"
								})
							]
						})]
					})
				});
			}
			if (msgType === "other") {
				const cardJson = asString$4(asRecord$6(param.interactiveCard).cardJson);
				const face = cardJson === "" ? {
					title: "",
					image: "",
					actionTitle: "",
					actionUrl: ""
				} : cardFace(cardJson);
				const title = face.title !== "" ? face.title : content;
				const actionUrl = face.actionUrl.startsWith("http") ? face.actionUrl : "";
				if (face.title !== "" || face.image !== "") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: panel_module_css_default.msgBody,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("a", {
						className: panel_module_css_default.linkCard,
						href: actionUrl === "" ? void 0 : actionUrl,
						target: "_blank",
						rel: "noreferrer",
						onClick: (event) => {
							event.stopPropagation();
						},
						children: [face.image !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
							className: panel_module_css_default.linkCardThumb,
							src: face.image,
							alt: "",
							loading: "lazy",
							referrerPolicy: "no-referrer"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: panel_module_css_default.linkCardBody,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: panel_module_css_default.linkCardTitle,
									children: title
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: panel_module_css_default.linkCardDesc,
									children: emojiText(content)
								}),
								actionUrl !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: panel_module_css_default.linkCardAction,
									children: [face.actionTitle === "" ? "查看详情" : face.actionTitle, " →"]
								})
							]
						})]
					})
				});
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: panel_module_css_default.msgSystem,
					children: content === "" ? "(系统消息)" : emojiText(content)
				});
			}
			if (msgType === "richText") {
				const desc = asArray$4(param.desc);
				const images = [];
				const bolds = [];
				for (const raw of desc) {
					const seg = asRecord$6(raw);
					const segType = asString$4(seg.type);
					if (segType === "image") {
						const fileId = asString$4(seg.data);
						if (fileId === "") continue;
						images.push({
							start: typeof seg.start === "number" ? seg.start : -1,
							fileId
						});
					} else if (segType === "bold" && typeof seg.start === "number" && typeof seg.length === "number") bolds.push({
						start: seg.start,
						length: seg.length
					});
				}
				const sorted = [...images].sort((a, b) => a.start - b.start);
				const spans = [];
				const imgSpans = [];
				let cursor = 0;
				const inBold = (from, to) => bolds.some((range) => from < range.start + range.length && to > range.start);
				for (const image of sorted) {
					const chunk = content.slice(cursor, image.start).replace(/\[图片\]/g, "");
					if (chunk !== "") spans.push({
						text: chunk,
						bold: inBold(cursor, image.start)
					});
					imgSpans.push({ fileId: image.fileId });
					cursor = image.start + 4;
				}
				const tail = content.slice(cursor).replace(/\[图片\]/g, "");
				if (tail !== "") spans.push({
					text: tail,
					bold: inBold(cursor, content.length)
				});
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: panel_module_css_default.msgBody,
					children: [
						quote,
						spans.map((span, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: span.bold ? panel_module_css_default.msgBold : void 0,
							children: emojiText(span.text)
						}, `t${index}`)),
						imgSpans.map((image, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProxyImage, {
							fileId: image.fileId,
							alt: "",
							onOpen: onOpenImage,
							inject
						}, `i${index}`))
					]
				});
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: panel_module_css_default.msgBody,
				children: [quote, content === "" ? `(${typeLabelOf(msgType)})` : emojiText(content)]
			});
		}
		/** Yunzhijia bracket-emoticon tokens → real emoji. Unmatched tokens stay raw. */
		const EMOJI_MAP = {
			微笑: "😊",
			呲牙: "😁",
			大笑: "😂",
			开心: "😄",
			愉快: "😀",
			调皮: "😜",
			机智: "🤓",
			得意: "😎",
			害羞: "😳",
			难过: "😔",
			大哭: "😭",
			流泪: "😢",
			愤怒: "😡",
			惊讶: "😲",
			惊恐: "😱",
			发呆: "😶",
			睡觉: "😴",
			困: "🥱",
			疑问: "🤔",
			思考: "🤔",
			晕: "😵",
			憋气: "😤",
			抓狂: "🤯",
			黑线: "😑",
			闷闷不乐: "🙁",
			无语: "😮‍💨",
			嘘: "🤫",
			吐舌头: "😛",
			委屈: "🥺",
			鄙视: "🙄",
			委屈哭: "🥹",
			奋斗: "💪",
			加油: "💪",
			强: "👊",
			弱: "👎",
			赞: "👍",
			差评: "👎",
			鼓掌: "👏",
			抱拳: "🙏",
			握手: "🤝",
			胜利: "✌️",
			耶: "✌️",
			OK: "👌",
			勾: "✅",
			叉: "❌",
			对: "✅",
			错: "❌",
			心: "❤️",
			爱心: "❤️",
			心碎: "💔",
			玫瑰: "🌹",
			郁金香: "🌷",
			花朵: "🌸",
			向日葵: "🌻",
			咖啡: "☕",
			茶: "🍵",
			啤酒: "🍺",
			干杯: "🍻",
			蛋糕: "🎂",
			汉堡: "🍔",
			西瓜: "🍉",
			苹果: "🍎",
			米饭: "🍚",
			面: "🍜",
			火锅: "🍲",
			粽子: "🍙",
			月饼: "🥮",
			庆祝: "🎉",
			烟花: "🎆",
			红包: "🧧",
			礼物: "🎁",
			蛋糕蜡烛: "🎂",
			气球: "🎈",
			撒花: "🎊",
			飞机: "✈️",
			汽车: "🚗",
			火车: "🚄",
			火箭: "🚀",
			船: "⛵",
			自行车: "🚲",
			太阳: "☀️",
			月亮: "🌙",
			星星: "⭐",
			闪电: "⚡",
			雨: "🌧️",
			雪: "❄️",
			云: "☁️",
			风: "🍃",
			彩虹: "🌈",
			伞: "☔",
			收到: "✅",
			求抱抱: "🤗",
			比心: "💗",
			亲亲: "😘",
			飞吻: "😘",
			拥抱: "🤗",
			666: "6️⃣",
			doge: "🐕",
			狗头: "🐕",
			衰: "😞",
			捂脸: "🤦",
			裂开: "🥴",
			嘻嘻: "😁",
			哈哈: "😆",
			嗯嗯: "😐",
			呵呵: "🫤",
			哦: "🫤",
			无奈: "🤷",
			耸肩: "🤷",
			告辞: "👋",
			再见: "👋",
			拜拜: "👋",
			你好: "👋",
			来吧: "🤝",
			稳: "👍",
			牛: "🐂",
			猪头: "🐷",
			话筒: "🎤",
			唱歌: "🎤",
			音乐: "🎵",
			跳舞: "💃",
			电影: "🎬",
			游戏: "🎮",
			篮球: "🏀",
			足球: "⚽",
			乒乓球: "🏓",
			奖杯: "🏆",
			奖牌: "🏅",
			第一: "🥇",
			钟: "⏰",
			闹钟: "⏰",
			时间: "⏰",
			日历: "📅",
			电话: "📞",
			手机: "📱",
			电脑: "💻",
			书: "📖",
			笔: "✏️",
			文件: "📄",
			文档: "📄",
			图片: "🖼️",
			相机: "📷",
			链接: "🔗",
			定位: "📍",
			家: "🏠",
			公司: "🏢",
			学校: "🏫",
			医院: "🏥",
			银行: "🏦",
			提示: "💡",
			灯泡: "💡",
			火焰: "🔥",
			炸弹: "💣",
			刀: "🔪",
			锤子: "🔨",
			扳手: "🔧",
			钥匙: "🔑",
			锁: "🔒",
			放大镜: "🔍",
			眼睛: "👁️",
			耳朵: "👂",
			重要: "❗",
			感叹号: "❗",
			问号: "❓",
			警告: "⚠️",
			禁止: "🚫",
			停止: "✋",
			上: "⬆️",
			下: "⬇️",
			左: "⬅️",
			右: "➡️",
			完成: "✅",
			进行中: "⏳",
			等待: "⏳"
		};
		/** Render message text with [token] emoticons mapped to real emoji. */
		function emojiText(text) {
			return text.split(/(\[[^\]\n]{1,10}\])/).map((part, index) => {
				if (part.length > 2 && part.startsWith("[") && part.endsWith("]")) {
					const emoji = EMOJI_MAP[part.slice(1, -1)];
					if (emoji !== void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: emoji }, index);
				}
				return part;
			});
		}
		/** Full-screen image / PDF preview (same chrome as the floating panel). */
		function ImLightbox({ src, kind, onClose }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: panel_module_css_default.lightbox,
				role: "presentation",
				onClick: onClose,
				children: kind === "pdf" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("embed", {
					className: panel_module_css_default.lightboxPdf,
					src,
					type: "application/pdf",
					onClick: (event) => event.stopPropagation()
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
					className: panel_module_css_default.lightboxImg,
					src,
					alt: "",
					onClick: (event) => event.stopPropagation()
				})
			});
		}
		//#endregion
		//#region \0dsh-css:/Users/kingdee/dev/dsh-yzj/packages/ui-yzj/src/client/shell.module.css.mjs
		const css = "html[data-dsh-yzj-im] button[class*=newSession],html[data-dsh-yzj-im] [class*=sessionRow],html[data-dsh-yzj-im] [class*=projectRow],html[data-dsh-yzj-im] [data-pane=details]{display:none!important}html[data-dsh-yzj-im] [role=tablist]:not([data-yzj-surface-switch]){display:none!important}html:not([data-dsh-yzj-im]) [role=tab][data-yzj-im-view-tab]{display:none!important}html[data-dsh-yzj-im] [data-composer-seat],html[data-dsh-yzj-im] [data-composer-card],html[data-dsh-yzj-im] [class*=composerSeat],html[data-dsh-yzj-im] [class*=composerStack],html[data-dsh-yzj-im] [class*=composerHero],html[data-dsh-yzj-im] [class*=InputBar],html[data-dsh-yzj-im] [class*=titleRow],html[data-dsh-yzj-im] [class*=headerUtilities],html[data-dsh-yzj-im] [class*=headerActions],html[data-dsh-yzj-im] [class*=sessionLogButton]{border:0!important;height:0!important;min-height:0!important;margin:0!important;padding:0!important;display:none!important;overflow:hidden!important}html[data-dsh-yzj-im] [data-slot=sidebar\\.workspaces]>:not([data-yzj-inbox-host]){display:none!important}html:not([data-dsh-yzj-im]) [data-yzj-inbox-host]{display:none!important}.Gd1qbW_surfaceSwitch{background:var(--dsw-alias-bg-layer-1,#1c1c1c);border:1px solid var(--dsw-alias-border-l2,#2a2a2a);border-radius:10px;flex:none;gap:4px;margin:8px 10px 6px;padding:3px;display:flex}.Gd1qbW_surfaceTab,.Gd1qbW_surfaceTabOn{font:inherit;cursor:pointer;color:var(--dsw-alias-label-secondary,#aaa);background:0 0;border:0;border-radius:8px;flex:1;padding:7px 10px;font-size:13px;font-weight:600}.Gd1qbW_surfaceTabOn{background:var(--dsw-alias-interactive-bg-hover-solid,#242424);color:var(--dsw-alias-label-primary,#eee)}.Gd1qbW_inbox{background:var(--dsw-alias-bg-base,#111);height:100%;min-height:0;color:var(--dsw-alias-label-primary,#eee);flex-direction:column;display:flex}.Gd1qbW_inboxBar{align-items:center;gap:6px;padding-right:10px;display:flex}.Gd1qbW_inboxBar .Gd1qbW_search{flex:1;min-width:0}.Gd1qbW_layoutSwitch{background:var(--dsw-alias-bg-layer-1,#1c1c1c);border:1px solid var(--dsw-alias-border-l2,#2a2a2a);border-radius:8px;flex:none;gap:2px;padding:2px;display:flex}.Gd1qbW_layoutTab,.Gd1qbW_layoutTabOn{font:inherit;cursor:pointer;color:var(--dsw-alias-label-secondary,#aaa);background:0 0;border:0;border-radius:6px;padding:4px 8px;font-size:12px}.Gd1qbW_layoutTabOn{background:var(--dsw-alias-interactive-bg-hover-solid,#2a2a2a);color:var(--dsw-alias-label-primary,#eee)}.Gd1qbW_addBtn{background:var(--dsw-alias-bg-layer-1,#1c1c1c);width:32px;height:32px;color:var(--dsw-alias-label-primary,#eee);cursor:pointer;border:0;border-radius:8px;flex:none;margin-top:4px;font-size:20px;line-height:1}.Gd1qbW_addBtn:hover{background:var(--dsw-alias-interactive-bg-hover-solid,#242424)}.Gd1qbW_createBox{gap:6px;padding:0 10px 8px;display:flex}.Gd1qbW_createBox input{border:1px solid var(--dsw-alias-border-l2,#2a2a2a);background:var(--dsw-alias-bg-layer-1,#1c1c1c);min-width:0;color:inherit;font:inherit;border-radius:8px;flex:1;padding:6px 10px;font-size:13px}.Gd1qbW_createBox button{background:var(--dsw-static-deepseek-600,#3b82f6);color:#fff;font:inherit;cursor:pointer;border:0;border-radius:8px;flex:none;padding:6px 12px;font-size:13px}.Gd1qbW_createBox button:disabled{opacity:.4;cursor:default}.Gd1qbW_sectionTitle{letter-spacing:.06em;color:var(--dsw-alias-label-tertiary,#888);padding:10px 12px 4px;font-size:11px;font-weight:600}.Gd1qbW_inboxAvatar{border-radius:50%;flex:none;width:32px;height:32px;overflow:hidden}.Gd1qbW_inboxAvatar img,.Gd1qbW_inboxAvatar span{object-fit:cover;border-radius:50%;width:32px;height:32px}.Gd1qbW_search{background:var(--dsw-alias-bg-layer-1,#1c1c1c);border:1px solid var(--dsw-alias-border-l2,#2a2a2a);color:var(--dsw-alias-label-secondary,#aaa);border-radius:8px;align-items:center;gap:6px;margin:10px 10px 6px;padding:6px 10px;font-size:13px;display:flex}.Gd1qbW_search input{min-width:0;color:inherit;font:inherit;background:0 0;border:0;outline:none;flex:1}.Gd1qbW_list{flex:1 1 0;min-height:0;padding:4px 6px 12px;overflow:auto}.Gd1qbW_inboxMore,.Gd1qbW_inboxMoreMuted{text-align:center;margin:8px 10px 4px;font-size:12px}.Gd1qbW_inboxMore{color:var(--dsw-alias-label-secondary,#aaa)}.Gd1qbW_inboxMoreMuted{color:var(--dsw-alias-label-tertiary,#666)}.Gd1qbW_row,.Gd1qbW_rowOn{text-align:left;cursor:pointer;width:100%;color:inherit;font:inherit;background:0 0;border:0;border-radius:10px;align-items:center;gap:10px;padding:8px 10px;display:flex}.Gd1qbW_rowOn{background:var(--dsw-alias-interactive-bg-hover-solid,#242424)}.Gd1qbW_row:hover{background:var(--dsw-alias-interactive-bg-hover-solid,#1e1e1e)}.Gd1qbW_glyph{background:var(--dsw-static-deepseek-600,#3b82f6);color:#fff;border-radius:50%;flex:none;place-items:center;width:32px;height:32px;font-size:13px;font-weight:600;display:grid}.Gd1qbW_glyphGroup{background:var(--dsw-alias-bg-layer-2,#333);color:var(--dsw-alias-label-primary,#eee)}.Gd1qbW_meta{flex-direction:column;flex:1;gap:2px;min-width:0;display:flex}.Gd1qbW_name{white-space:nowrap;text-overflow:ellipsis;font-size:13px;line-height:18px;overflow:hidden}.Gd1qbW_preview{color:var(--dsw-alias-label-tertiary,#888);white-space:nowrap;text-overflow:ellipsis;font-size:12px;line-height:16px;overflow:hidden}.Gd1qbW_shell{background:var(--dsw-alias-bg-base,#111);height:100%;min-height:0;color:var(--dsw-alias-label-primary,#eee);flex-direction:column;display:flex}.Gd1qbW_shellStack{flex-direction:column;height:100%;min-height:0;display:flex}.Gd1qbW_shellStack>:not([hidden]){flex-direction:column;flex:1 1 0;min-height:0;display:flex}.Gd1qbW_shellStack>[hidden]{flex:none;display:none!important}.Gd1qbW_header{border-bottom:1px solid var(--dsw-alias-border-l2,#2a2a2a);flex:none;align-items:center;gap:12px;padding:12px 16px;display:flex}.Gd1qbW_headerTitle{font-size:16px;font-weight:600;line-height:22px}.Gd1qbW_headerSub{color:var(--dsw-alias-label-tertiary,#888);font-size:12px}.Gd1qbW_headerGrow{flex:1}.Gd1qbW_askBtn{background:var(--dsw-static-deepseek-600,#3b82f6);color:#fff;font:inherit;cursor:pointer;border:0;border-radius:999px;padding:6px 14px;font-size:13px}.Gd1qbW_body{flex-direction:column;flex:1 1 0;min-height:0;display:flex}.Gd1qbW_stream{flex-direction:column;flex:1 1 0;gap:10px;min-height:0;padding:16px 20px 8px;display:flex;overflow:auto}.Gd1qbW_bubbleUser,.Gd1qbW_bubbleAssistant{white-space:pre-wrap;word-break:break-word;border-radius:16px;max-width:72%;padding:10px 14px;font-size:14px;line-height:22px}.Gd1qbW_bubbleUser{background:var(--dsw-static-deepseek-600,#2563eb);color:#fff;border-bottom-right-radius:4px;align-self:flex-end}.Gd1qbW_bubbleAssistant{background:var(--dsw-alias-interactive-bg-hover-solid,#2a2a2a);color:var(--dsw-alias-label-primary,#eee);border-bottom-left-radius:4px;align-self:flex-start}.Gd1qbW_processing{color:var(--dsw-alias-label-tertiary,#888);align-self:flex-start;font-size:13px}.Gd1qbW_processLink{color:var(--dsw-alias-label-tertiary,#666);font:inherit;cursor:pointer;background:0 0;border:0;align-self:flex-start;padding:0 2px;font-size:12px}.Gd1qbW_processLink:hover{color:var(--dsw-alias-label-secondary,#aaa)}.Gd1qbW_composer{flex:none;padding:10px 16px 16px}.Gd1qbW_composerCard{background:var(--dsw-alias-bg-layer-1,#1c1c1c);border:1px solid var(--dsw-alias-border-l2,#2a2a2a);border-radius:12px;align-items:flex-end;gap:8px;padding:8px 10px;display:flex}.Gd1qbW_composerInput{min-width:0;color:inherit;font:inherit;resize:none;background:0 0;border:0;outline:none;flex:1;max-height:120px;font-size:14px;line-height:20px}.Gd1qbW_send{background:var(--dsw-static-deepseek-600,#3b82f6);color:#fff;cursor:pointer;border:0;border-radius:50%;flex:none;width:32px;height:32px}.Gd1qbW_send:disabled{opacity:.4;cursor:default}.Gd1qbW_plus{width:28px;height:28px;color:var(--dsw-alias-label-secondary,#aaa);cursor:pointer;background:0 0;border:0;border-radius:50%;flex:none;font-size:18px}.Gd1qbW_menu{background:var(--dsw-alias-bg-layer-1,#1c1c1c);border:1px solid var(--dsw-alias-border-l2,#2a2a2a);z-index:4;border-radius:10px;flex-direction:column;min-width:160px;padding:4px;display:flex;position:absolute;bottom:52px;left:16px}.Gd1qbW_menu button{color:inherit;text-align:left;cursor:pointer;font:inherit;background:0 0;border:0;border-radius:8px;padding:8px 10px;font-size:13px}.Gd1qbW_menu button:hover{background:var(--dsw-alias-interactive-bg-hover-solid,#242424)}.Gd1qbW_thread{background:var(--dsw-alias-bg-layer-1,#1a1a1a);border-left:3px solid var(--dsw-static-deepseek-600,#3b82f6);border-radius:10px;flex-direction:column;gap:8px;margin:6px 0 10px 40px;padding:8px 10px 10px;display:flex}.Gd1qbW_pill{color:#ddd;background:#4c3a66;border-radius:999px;align-self:flex-start;padding:2px 8px;font-size:11px}.Gd1qbW_atMenu{background:var(--dsw-alias-bg-layer-1,#1c1c1c);border:1px solid var(--dsw-alias-border-l2,#2a2a2a);border-radius:8px;flex-direction:column;gap:2px;margin-bottom:6px;padding:4px;display:flex}.Gd1qbW_atItem{color:inherit;text-align:left;cursor:pointer;font:inherit;background:0 0;border:0;border-radius:6px;padding:6px 8px;font-size:13px}.Gd1qbW_atItem:hover,.Gd1qbW_atItemOn{background:var(--dsw-alias-interactive-bg-hover-solid,#242424)}.Gd1qbW_alert{color:var(--dsw-alias-label-secondary,#c88);margin:0 16px 8px;font-size:12px}.Gd1qbW_pane{flex:1 1 0;min-height:0;overflow:auto}.Gd1qbW_login{padding:8px 10px 0}.Gd1qbW_confirm{background:var(--dsw-alias-bg-layer-1,#1c1c1c);border:1px solid var(--dsw-alias-border-l2,#2a2a2a);border-radius:12px;align-self:flex-start;max-width:420px;padding:12px 14px}.Gd1qbW_confirmTitle{margin-bottom:8px;font-size:13px}.Gd1qbW_confirmActions{justify-content:flex-end;gap:8px;margin-top:10px;display:flex}.Gd1qbW_confirmActions button{font:inherit;cursor:pointer;border:0;border-radius:8px;padding:6px 12px;font-size:13px}.Gd1qbW_ghost{background:var(--dsw-alias-bg-layer-2,#333);color:var(--dsw-alias-label-primary,#eee)}.Gd1qbW_primary{background:var(--dsw-static-deepseek-600,#3b82f6);color:#fff}.Gd1qbW_processList{flex-direction:column;gap:8px;padding:16px 20px;display:flex}.Gd1qbW_processRow{color:var(--dsw-alias-label-secondary,#aaa);font-size:13px}.Gd1qbW_back{color:var(--dsw-static-deepseek-600,#3b82f6);font:inherit;cursor:pointer;background:0 0;border:0}";
		const tagId = "@dsh-yzj/bundle/shell.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@dsh-yzj/bundle";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var shell_module_css_default = {
			"inboxBar": "Gd1qbW_inboxBar",
			"rowOn": "Gd1qbW_rowOn",
			"preview": "Gd1qbW_preview",
			"askBtn": "Gd1qbW_askBtn",
			"layoutTab": "Gd1qbW_layoutTab",
			"login": "Gd1qbW_login",
			"inboxMore": "Gd1qbW_inboxMore",
			"glyph": "Gd1qbW_glyph",
			"send": "Gd1qbW_send",
			"inboxMoreMuted": "Gd1qbW_inboxMoreMuted",
			"alert": "Gd1qbW_alert",
			"glyphGroup": "Gd1qbW_glyphGroup",
			"surfaceTab": "Gd1qbW_surfaceTab",
			"confirm": "Gd1qbW_confirm",
			"list": "Gd1qbW_list",
			"body": "Gd1qbW_body",
			"pane": "Gd1qbW_pane",
			"bubbleUser": "Gd1qbW_bubbleUser",
			"inbox": "Gd1qbW_inbox",
			"shell": "Gd1qbW_shell",
			"pill": "Gd1qbW_pill",
			"addBtn": "Gd1qbW_addBtn",
			"stream": "Gd1qbW_stream",
			"processLink": "Gd1qbW_processLink",
			"menu": "Gd1qbW_menu",
			"back": "Gd1qbW_back",
			"inboxAvatar": "Gd1qbW_inboxAvatar",
			"headerGrow": "Gd1qbW_headerGrow",
			"surfaceSwitch": "Gd1qbW_surfaceSwitch",
			"atItemOn": "Gd1qbW_atItemOn",
			"headerSub": "Gd1qbW_headerSub",
			"search": "Gd1qbW_search",
			"headerTitle": "Gd1qbW_headerTitle",
			"confirmTitle": "Gd1qbW_confirmTitle",
			"composerInput": "Gd1qbW_composerInput",
			"createBox": "Gd1qbW_createBox",
			"header": "Gd1qbW_header",
			"atItem": "Gd1qbW_atItem",
			"layoutTabOn": "Gd1qbW_layoutTabOn",
			"plus": "Gd1qbW_plus",
			"thread": "Gd1qbW_thread",
			"atMenu": "Gd1qbW_atMenu",
			"composer": "Gd1qbW_composer",
			"processRow": "Gd1qbW_processRow",
			"ghost": "Gd1qbW_ghost",
			"surfaceTabOn": "Gd1qbW_surfaceTabOn",
			"meta": "Gd1qbW_meta",
			"bubbleAssistant": "Gd1qbW_bubbleAssistant",
			"composerCard": "Gd1qbW_composerCard",
			"confirmActions": "Gd1qbW_confirmActions",
			"row": "Gd1qbW_row",
			"processList": "Gd1qbW_processList",
			"sectionTitle": "Gd1qbW_sectionTitle",
			"processing": "Gd1qbW_processing",
			"primary": "Gd1qbW_primary",
			"layoutSwitch": "Gd1qbW_layoutSwitch",
			"shellStack": "Gd1qbW_shellStack",
			"name": "Gd1qbW_name"
		};
		//#endregion
		//#region src/client/inbox.tsx
		/**
		* IM inbox: Grok-style fused recent list (assistants + people + groups),
		* with optional sectioned layout (助手 / 单聊 / 群 / 订阅). Preference:
		* localStorage `dsh-yzj-inbox-layout` = `mixed` | `grouped`.
		* Warm start: module snapshot + im-cache peekGroupWindow; always revalidate.
		*/
		const LAYOUT_KEY = "dsh-yzj-inbox-layout";
		let inboxSnapshot = null;
		function rememberSnapshot(next) {
			inboxSnapshot = next;
		}
		function seedFromCache() {
			if (inboxSnapshot !== null && inboxSnapshot.rooms.length > 0) return {
				rooms: [...inboxSnapshot.rooms],
				page: inboxSnapshot.page,
				more: inboxSnapshot.more
			};
			const peek = peekGroupWindow();
			if (peek === void 0) return {
				rooms: [],
				page: 1,
				more: false
			};
			const parsed = parseRecentGroups({
				list: peek.groups,
				more: peek.more
			});
			return {
				rooms: parsed.rooms,
				page: 1,
				more: parsed.more
			};
		}
		function seedAssistants() {
			if (inboxSnapshot !== null && inboxSnapshot.assistants.length > 0) return {
				assistants: [...inboxSnapshot.assistants],
				previews: new Map(inboxSnapshot.previews)
			};
			return {
				assistants: [{
					id: "default",
					name: "助手"
				}],
				previews: /* @__PURE__ */ new Map()
			};
		}
		function asRecord$5(value) {
			return typeof value === "object" && value !== null ? value : {};
		}
		function asString$3(value) {
			return typeof value === "string" ? value : "";
		}
		function asArray$3(value) {
			return Array.isArray(value) ? value : [];
		}
		function previewOf(lastMsg) {
			const content = asString$3(lastMsg.content);
			const msgType = asString$3(lastMsg.msgType);
			if (msgType === "file") return "[文件]";
			if (msgType === "richText") {
				const plain = content.replace(/\s+/g, " ").trim();
				return plain === "" ? "[图文]" : plain.slice(0, 60);
			}
			return content.replace(/\s+/g, " ").slice(0, 60);
		}
		function activityMs(value) {
			if (typeof value === "number" && Number.isFinite(value)) return value;
			const text = String(value ?? "").trim();
			if (text === "") return 0;
			const parsed = Date.parse(text.includes("T") ? text : text.replace(" ", "T"));
			return Number.isFinite(parsed) ? parsed : 0;
		}
		function mergePage1(fresh, current) {
			const freshIds = new Set(fresh.map((row) => row.groupId));
			return [...fresh, ...current.filter((row) => !freshIds.has(row.groupId))];
		}
		function parseAssistants(value) {
			return (Array.isArray(asRecord$5(value).assistants) ? asRecord$5(value).assistants : []).flatMap((item) => {
				const row = asRecord$5(item);
				const id = asString$3(row.id);
				if (id === "") return [];
				return [{
					id,
					name: asString$3(row.name) || "助手"
				}];
			});
		}
		function readLayout() {
			if (typeof localStorage === "undefined") return "mixed";
			return localStorage.getItem(LAYOUT_KEY) === "grouped" ? "grouped" : "mixed";
		}
		function writeLayout(next) {
			if (typeof localStorage === "undefined") return;
			localStorage.setItem(LAYOUT_KEY, next);
		}
		function bubblePreview(value) {
			const bubbles = asArray$3(asRecord$5(value).bubbles);
			const last = bubbles.length === 0 ? void 0 : asRecord$5(bubbles[bubbles.length - 1]);
			if (last === void 0) return {
				preview: "专属助手",
				at: 0
			};
			const text = asString$3(last.text).replace(/\s+/g, " ").trim().slice(0, 60);
			const at = typeof last.at === "number" && Number.isFinite(last.at) ? last.at : 0;
			return {
				preview: text === "" ? "专属助手" : text,
				at
			};
		}
		/** Build fused recent rows (assistants + dm + group), newest first. */
		function buildFusedRows(assistants, previews, rooms) {
			const rows = [];
			for (const assistant of assistants) {
				const preview = previews.get(assistant.id) ?? {
					preview: "专属助手",
					at: 0
				};
				rows.push({
					kind: "assistant",
					id: assistant.id,
					name: assistant.name,
					preview: preview.preview,
					at: preview.at
				});
			}
			for (const room of rooms) {
				if (inboxRoomKind(room) === "subscription") continue;
				rows.push({
					kind: "room",
					room,
					at: activityMs(room.lastMsgSendTime)
				});
			}
			return rows.sort((a, b) => b.at - a.at);
		}
		function YzjInbox(props) {
			const [query, setQuery] = (0, react.useState)("");
			const [layout, setLayout] = (0, react.useState)(readLayout);
			const [assistants, setAssistants] = (0, react.useState)(() => seedAssistants().assistants);
			const [previews, setPreviews] = (0, react.useState)(() => seedAssistants().previews);
			const [rooms, setRooms] = (0, react.useState)(() => [...seedFromCache().rooms]);
			const [page, setPage] = (0, react.useState)(() => seedFromCache().page);
			const [more, setMore] = (0, react.useState)(() => seedFromCache().more);
			const [loadingMore, setLoadingMore] = (0, react.useState)(false);
			const [sel, setSel] = (0, react.useState)(getImSelection);
			const [creating, setCreating] = (0, react.useState)(false);
			const [newName, setNewName] = (0, react.useState)("");
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)("");
			const listRef = (0, react.useRef)(null);
			const pageRef = (0, react.useRef)(page);
			const moreRef = (0, react.useRef)(more);
			const loadingRef = (0, react.useRef)(false);
			pageRef.current = page;
			moreRef.current = more;
			(0, react.useEffect)(() => subscribeImSelection(() => {
				setSel(getImSelection());
			}), []);
			(0, react.useEffect)(() => {
				if (props.panel.imCachePut === void 0 || props.panel.imCacheGet === void 0) return;
				bindImCachePersistence((key, payload, fetchedAt) => {
					props.panel.imCachePut(key, payload, fetchedAt);
				}, async (key) => {
					const result = await props.panel.imCacheGet(key);
					if (!result.ok || result.value === null) return null;
					const value = result.value;
					return {
						payload: value.payload,
						fetchedAt: value.fetchedAt
					};
				});
			}, [props.panel]);
			(0, react.useEffect)(() => {
				rememberSnapshot({
					assistants,
					previews: [...previews.entries()],
					rooms,
					page,
					more
				});
			}, [
				assistants,
				previews,
				rooms,
				page,
				more
			]);
			(0, react.useEffect)(() => {
				let cancelled = false;
				const loadPreviews = async (rows) => {
					if (props.panel.assistantProjection === void 0 || rows.length === 0) return;
					const entries = await Promise.all(rows.map(async (row) => {
						const result = await props.panel.assistantProjection({ assistantId: row.id });
						if (!result.ok) return [row.id, {
							preview: "专属助手",
							at: 0
						}];
						return [row.id, bubblePreview(result.value)];
					}));
					if (cancelled) return;
					setPreviews(new Map(entries));
				};
				const loadAssistants = async () => {
					const listed = await props.panel.assistantsList?.();
					if (cancelled || listed === void 0 || !listed.ok) return;
					const next = parseAssistants(listed.value);
					if (next.length > 0) {
						setAssistants(next);
						await loadPreviews(next);
					}
				};
				const loadPage1 = async () => {
					const recent = await props.panel.fetchGroups(20, 1);
					if (cancelled || !recent.ok) return;
					const parsed = parseRecentGroups(recent.value);
					putGroupWindow(asArray$3(asRecord$5(recent.value).list), parsed.more);
					setRooms((current) => current.length === 0 ? parsed.rooms : mergePage1(parsed.rooms, current));
					if (pageRef.current <= 1) {
						setMore(parsed.more);
						setPage(1);
					} else if (!parsed.more) setMore(false);
				};
				loadAssistants();
				loadPage1();
				const timer = window.setInterval(() => {
					loadAssistants();
					loadPage1();
				}, 8e3);
				return () => {
					cancelled = true;
					window.clearInterval(timer);
				};
			}, [props.panel]);
			const loadMore = () => {
				if (loadingRef.current || !moreRef.current) return;
				loadingRef.current = true;
				setLoadingMore(true);
				const nextPage = pageRef.current + 1;
				props.panel.fetchGroups(20, nextPage).then((result) => {
					loadingRef.current = false;
					setLoadingMore(false);
					if (!result.ok) {
						setError(result.error.message);
						return;
					}
					const parsed = parseRecentGroups(result.value);
					setRooms((prev) => {
						const seen = new Set(prev.map((row) => row.groupId));
						return [...prev, ...parsed.rooms.filter((row) => !seen.has(row.groupId))];
					});
					setMore(parsed.more === true && parsed.rooms.length > 0);
					setPage(nextPage);
				});
			};
			const maybeLoadMore = (event) => {
				const el = event?.currentTarget ?? listRef.current;
				if (el === null || el.clientHeight === 0) return;
				if (el.scrollHeight - el.scrollTop - el.clientHeight <= 80) loadMore();
			};
			(0, react.useEffect)(() => {
				maybeLoadMore();
			});
			const createAssistant = async (event) => {
				event?.preventDefault();
				const trimmed = newName.trim();
				if (trimmed === "" || busy) return;
				setBusy(true);
				setError("");
				const result = await props.panel.assistantsCreate?.(trimmed);
				setBusy(false);
				if (result === void 0 || !result.ok) {
					setError(result?.error.message ?? "新建失败");
					return;
				}
				const created = asRecord$5(asRecord$5(result.value).assistant);
				const id = asString$3(created.id);
				const name = asString$3(created.name) || trimmed;
				if (id !== "") {
					setAssistants((current) => current.some((row) => row.id === id) ? current : [...current, {
						id,
						name
					}]);
					setPreviews((current) => {
						const next = new Map(current);
						next.set(id, {
							preview: "专属助手",
							at: Date.now()
						});
						return next;
					});
					setImSelection({
						kind: "assistant",
						assistantId: id
					});
				}
				setNewName("");
				setCreating(false);
				const listed = await props.panel.assistantsList?.();
				if (listed?.ok) {
					const next = parseAssistants(listed.value);
					if (next.length > 0) setAssistants(next);
				}
			};
			const setLayoutPreference = (next) => {
				setLayout(next);
				writeLayout(next);
			};
			const q = query.trim().toLowerCase();
			const shownAssistants = q === "" ? assistants : assistants.filter((row) => row.name.toLowerCase().includes(q));
			const shownRooms = q === "" ? rooms : rooms.filter((row) => {
				const preview = previewOf(row.lastMsg);
				return row.groupName.toLowerCase().includes(q) || preview.toLowerCase().includes(q);
			});
			const dms = shownRooms.filter((row) => inboxRoomKind(row) === "dm");
			const groups = shownRooms.filter((row) => inboxRoomKind(row) === "group");
			const subs = shownRooms.filter((row) => inboxRoomKind(row) === "subscription");
			const fused = buildFusedRows(shownAssistants, previews, shownRooms).filter((row) => {
				if (q === "") return true;
				if (row.kind === "assistant") return row.name.toLowerCase().includes(q) || row.preview.toLowerCase().includes(q);
				const preview = previewOf(row.room.lastMsg);
				return row.room.groupName.toLowerCase().includes(q) || preview.toLowerCase().includes(q);
			});
			const assistantOn = (id) => sel.kind === "assistant" && sel.assistantId === id;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: shell_module_css_default.inbox,
				"data-testid": "yzj-inbox",
				"data-yzj-inbox-layout": layout,
				children: [
					props.panel.authStatus !== void 0 && props.panel.authLogin !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: shell_module_css_default.login,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(YzjLoginBanner, {
							authStatus: props.panel.authStatus,
							authLogin: props.panel.authLogin,
							compact: true
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: shell_module_css_default.inboxBar,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: shell_module_css_default.search,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									"aria-hidden": "true",
									children: "⌕"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									value: query,
									placeholder: "搜索",
									"aria-label": "搜索",
									onChange: (event) => setQuery(event.target.value)
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: shell_module_css_default.layoutSwitch,
								role: "tablist",
								"aria-label": "列表布局",
								"data-testid": "yzj-inbox-layout",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									role: "tab",
									className: layout === "mixed" ? shell_module_css_default.layoutTabOn : shell_module_css_default.layoutTab,
									"aria-selected": layout === "mixed",
									"data-testid": "yzj-inbox-layout-mixed",
									onClick: () => setLayoutPreference("mixed"),
									children: "混合"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									role: "tab",
									className: layout === "grouped" ? shell_module_css_default.layoutTabOn : shell_module_css_default.layoutTab,
									"aria-selected": layout === "grouped",
									"data-testid": "yzj-inbox-layout-grouped",
									onClick: () => setLayoutPreference("grouped"),
									children: "分组"
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: shell_module_css_default.addBtn,
								"data-testid": "yzj-inbox-create",
								"aria-label": "新建助手",
								title: "新建助手",
								onClick: () => {
									setCreating(true);
									setError("");
								},
								children: "+"
							})
						]
					}),
					creating && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
						className: shell_module_css_default.createBox,
						onSubmit: (event) => {
							createAssistant(event);
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							value: newName,
							placeholder: "助手名称",
							"aria-label": "助手名称",
							"data-testid": "yzj-inbox-create-name",
							autoFocus: true,
							onChange: (event) => setNewName(event.target.value)
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "submit",
							"data-testid": "yzj-inbox-create-submit",
							disabled: busy || newName.trim() === "",
							children: "创建"
						})]
					}),
					error !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: shell_module_css_default.alert,
						role: "alert",
						children: error
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: shell_module_css_default.list,
						ref: listRef,
						"data-testid": "yzj-inbox-list",
						onScroll: maybeLoadMore,
						children: [
							layout === "mixed" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								"data-testid": "yzj-inbox-fused",
								children: fused.map((row) => {
									if (row.kind === "assistant") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										className: assistantOn(row.id) ? shell_module_css_default.rowOn : shell_module_css_default.row,
										"data-testid": `yzj-inbox-assistant-${row.id}`,
										onClick: () => setImSelection({
											kind: "assistant",
											assistantId: row.id
										}),
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: shell_module_css_default.inboxAvatar,
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: shell_module_css_default.glyph,
												children: row.name.slice(0, 1)
											})
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: shell_module_css_default.meta,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: shell_module_css_default.name,
												children: row.name
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: shell_module_css_default.preview,
												children: row.preview
											})]
										})]
									}, `a-${row.id}`);
									const on = sel.kind === "group" && sel.groupId === row.room.groupId;
									return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										className: on ? shell_module_css_default.rowOn : shell_module_css_default.row,
										"data-testid": `yzj-inbox-group-${row.room.groupId}`,
										onClick: () => setImSelection({
											kind: "group",
											groupId: row.room.groupId,
											...row.room.groupName === "" ? {} : { groupName: row.room.groupName }
										}),
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: shell_module_css_default.inboxAvatar,
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(GroupAvatar, {
												url: row.room.headerUrl ?? "",
												name: row.room.groupName
											})
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: shell_module_css_default.meta,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: shell_module_css_default.name,
												children: row.room.groupName
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: shell_module_css_default.preview,
												children: previewOf(row.room.lastMsg)
											})]
										})]
									}, row.room.groupId);
								})
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RoomSection, {
								testid: "yzj-inbox-section-sub",
								title: "订阅通知",
								rows: subs,
								sel
							})] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
									"data-testid": "yzj-inbox-section-assistants",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: shell_module_css_default.sectionTitle,
										children: "助手"
									}), shownAssistants.map((row) => {
										const preview = previews.get(row.id)?.preview ?? "专属助手";
										return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
											type: "button",
											className: assistantOn(row.id) ? shell_module_css_default.rowOn : shell_module_css_default.row,
											"data-testid": `yzj-inbox-assistant-${row.id}`,
											onClick: () => setImSelection({
												kind: "assistant",
												assistantId: row.id
											}),
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: shell_module_css_default.inboxAvatar,
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: shell_module_css_default.glyph,
													children: row.name.slice(0, 1)
												})
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: shell_module_css_default.meta,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: shell_module_css_default.name,
													children: row.name
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: shell_module_css_default.preview,
													children: preview
												})]
											})]
										}, `a-${row.id}`);
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RoomSection, {
									testid: "yzj-inbox-section-dm",
									title: "单聊",
									rows: dms,
									sel
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RoomSection, {
									testid: "yzj-inbox-section-group",
									title: "群",
									rows: groups,
									sel
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RoomSection, {
									testid: "yzj-inbox-section-sub",
									title: "订阅通知",
									rows: subs,
									sel
								})
							] }),
							loadingMore && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: shell_module_css_default.inboxMore,
								"data-testid": "yzj-inbox-loading",
								children: "加载中…"
							}),
							!more && rooms.length > 0 && q === "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: shell_module_css_default.inboxMoreMuted,
								"data-testid": "yzj-inbox-end",
								children: "没有更多了"
							})
						]
					})
				]
			});
		}
		function RoomSection(props) {
			if (props.rows.length === 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				"data-testid": props.testid,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: shell_module_css_default.sectionTitle,
					children: props.title
				}), props.rows.map((row) => {
					const on = props.sel.kind === "group" && props.sel.groupId === row.groupId;
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: on ? shell_module_css_default.rowOn : shell_module_css_default.row,
						"data-testid": `yzj-inbox-group-${row.groupId}`,
						onClick: () => setImSelection({
							kind: "group",
							groupId: row.groupId,
							...row.groupName === "" ? {} : { groupName: row.groupName }
						}),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: shell_module_css_default.inboxAvatar,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(GroupAvatar, {
								url: row.headerUrl ?? "",
								name: row.groupName
							})
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: shell_module_css_default.meta,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: shell_module_css_default.name,
								children: row.groupName
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: shell_module_css_default.preview,
								children: previewOf(row.lastMsg)
							})]
						})]
					}, row.groupId);
				})]
			});
		}
		//#endregion
		//#region src/client/im-confirm.tsx
		/**
		* Compact IM confirm card for pending yzj writes (assistant present-layer).
		* Reuses write-card titles / decide verbs without the official toolview seat.
		*/
		function YzjImConfirmCard(props) {
			const { record } = props;
			const [status, setStatus] = (0, react.useState)(record.status);
			if (status !== "pending") return null;
			const args = typeof record.args === "object" && record.args !== null ? record.args : {};
			const group = typeof args.groupId === "string" ? args.groupId : "";
			const title = record.toolName === "yzj_im_message_send" ? `发送到 ${group === "" ? "云之家" : group}` : record.reason;
			const draft = writableDraft(record);
			const decide = (outcome) => {
				props.inject.decideWrite(record.writeId, outcome).then((ok) => {
					if (ok) setStatus(outcome === "allowed-once" ? "approved" : "cancelled");
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: shell_module_css_default.confirm,
				"data-testid": "yzj-im-confirm",
				role: "status",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: shell_module_css_default.confirmTitle,
						children: title
					}),
					typeof args.content === "string" && args.content !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: args.content }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: shell_module_css_default.confirmActions,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: shell_module_css_default.ghost,
								onClick: () => props.inject.openContext(record),
								children: "查看上下文"
							}),
							draft !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: shell_module_css_default.ghost,
								onClick: () => {
									props.inject.editDraft(draft);
									decide("rejected");
								},
								children: "编辑"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: shell_module_css_default.ghost,
								"data-testid": "yzj-im-confirm-cancel",
								onClick: () => decide("rejected"),
								children: "取消"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: shell_module_css_default.primary,
								"data-testid": "yzj-im-confirm-ok",
								onClick: () => decide("allowed-once"),
								children: "确认"
							})
						]
					})
				]
			});
		}
		//#endregion
		//#region src/client/im-view-cache.ts
		const assistants = /* @__PURE__ */ new Map();
		const groups = /* @__PURE__ */ new Map();
		/** Fused timeline “加载更早” budget per viewKey. */
		const fusedMore = /* @__PURE__ */ new Map();
		function getAssistantDmSnapshot(id) {
			return assistants.get(id);
		}
		function putAssistantDmSnapshot(id, next) {
			if (id === "") return;
			assistants.set(id, next);
		}
		function getGroupRoomSnapshot(groupId) {
			return groups.get(groupId);
		}
		function putGroupRoomSnapshot(groupId, next) {
			if (groupId === "") return;
			groups.set(groupId, next);
		}
		function getFusedMore(viewKey) {
			return fusedMore.get(viewKey);
		}
		function putFusedMore(viewKey, more) {
			if (viewKey === "") return;
			fusedMore.set(viewKey, more);
		}
		//#endregion
		//#region src/client/open-assistant-session.ts
		/**
		* Open an assistant's real hidden session on the 会话 surface.
		* Replaces the retired IM 「查看过程」digest page (I5 / I16).
		*/
		function asRecord$4(value) {
			return typeof value === "object" && value !== null ? value : {};
		}
		/**
		* Resolve `assistantId` → hidden `sessionId`, switch to 会话, and focus that
		* session so the official Chat / 轨迹 canvas shows tool process.
		*/
		async function openAssistantSession(panel, assistantId) {
			const result = await panel.assistantProjection?.({ assistantId });
			if (result === void 0 || !result.ok) return false;
			const assistant = asRecord$4(asRecord$4(result.value).assistant);
			const sessionId = typeof assistant.sessionId === "string" ? assistant.sessionId : "";
			if (sessionId === "") return false;
			setImSurface("session");
			panel.focusBoundSession?.(sessionId);
			return true;
		}
		//#endregion
		//#region src/client/assistant-dm.tsx
		/**
		* Assistant DM: Grok-Bot-simple bubbles + confirm cards + muted 查看过程.
		* Warm-starts from im-view-cache so 消息↔会话 / selection remounts do not
		* flash an empty stream.
		*/
		function asRecord$3(value) {
			return typeof value === "object" && value !== null ? value : {};
		}
		function asArray$2(value) {
			return Array.isArray(value) ? value : [];
		}
		function parseBubbles(value) {
			return asArray$2(value).flatMap((item) => {
				const row = asRecord$3(item);
				const id = typeof row.id === "string" ? row.id : "";
				const role = row.role === "user" || row.role === "assistant" ? row.role : "assistant";
				const text = typeof row.text === "string" ? row.text : "";
				if (id === "") return [];
				return [{
					id,
					role,
					text
				}];
			});
		}
		function parseWrites(value) {
			return asArray$2(value).filter((item) => {
				const row = asRecord$3(item);
				return typeof row.writeId === "string" && row.status === "pending";
			});
		}
		function YzjAssistantDm(props) {
			const seed = getAssistantDmSnapshot(props.assistantId);
			const [name, setName] = (0, react.useState)(() => seed?.name ?? "助手");
			const [bubbles, setBubbles] = (0, react.useState)(() => seed ? [...seed.bubbles] : []);
			const [processing, setProcessing] = (0, react.useState)(() => seed?.processing === true);
			const [writes, setWrites] = (0, react.useState)(() => seed ? [...seed.writes] : []);
			const [draft, setDraft] = (0, react.useState)(() => seed?.draft ?? "");
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)("");
			const bottom = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				const hit = getAssistantDmSnapshot(props.assistantId);
				if (hit !== void 0) {
					setName(hit.name);
					setBubbles([...hit.bubbles]);
					setProcessing(hit.processing);
					setWrites([...hit.writes]);
					setDraft(hit.draft);
				} else {
					setName("助手");
					setBubbles([]);
					setProcessing(false);
					setWrites([]);
					setDraft("");
				}
				setError("");
			}, [props.assistantId]);
			(0, react.useEffect)(() => {
				putAssistantDmSnapshot(props.assistantId, {
					name,
					bubbles,
					processing,
					writes,
					draft
				});
			}, [
				props.assistantId,
				name,
				bubbles,
				processing,
				writes,
				draft
			]);
			(0, react.useEffect)(() => {
				let cancelled = false;
				const load = async () => {
					const result = await props.panel.assistantProjection?.({ assistantId: props.assistantId });
					if (cancelled || result === void 0 || !result.ok) return;
					const rec = asRecord$3(result.value);
					const assistant = asRecord$3(rec.assistant);
					if (typeof assistant.name === "string" && assistant.name !== "") setName(assistant.name);
					setProcessing(rec.processing === true);
					setBubbles(parseBubbles(rec.bubbles));
					setWrites(parseWrites(rec.writes));
				};
				load();
				const timer = window.setInterval(() => {
					load();
				}, 800);
				return () => {
					cancelled = true;
					window.clearInterval(timer);
				};
			}, [props.assistantId, props.panel]);
			(0, react.useEffect)(() => {
				const node = bottom.current;
				if (node !== null && typeof node.scrollIntoView === "function") node.scrollIntoView({ block: "end" });
			}, [
				bubbles.length,
				processing,
				writes.length
			]);
			const send = async () => {
				const text = draft.trim();
				if (text === "" || busy) return;
				setBusy(true);
				setError("");
				setDraft("");
				const result = await props.panel.assistantAsk?.(props.assistantId, text);
				setBusy(false);
				if (result === void 0 || !result.ok) {
					setError(result?.error.message ?? "发送失败");
					setDraft(text);
				}
			};
			const onKeyDown = (event) => {
				if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
				event.preventDefault();
				send();
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: shell_module_css_default.shell,
				"data-testid": "yzj-assistant-dm",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("header", {
						className: shell_module_css_default.header,
						"data-yzj-im-header": "",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: shell_module_css_default.headerTitle,
							children: name
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: shell_module_css_default.headerSub,
							children: "专属助手 · 单聊"
						})] })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: shell_module_css_default.stream,
						children: [
							bubbles.map((bubble) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: bubble.role === "user" ? shell_module_css_default.bubbleUser : shell_module_css_default.bubbleAssistant,
								"data-testid": bubble.role === "user" ? "yzj-dm-user" : "yzj-dm-assistant",
								children: bubble.text
							}, bubble.id)),
							writes.map((record) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(YzjImConfirmCard, {
								record,
								inject: props.writeInject
							}, record.writeId)),
							processing && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: shell_module_css_default.processing,
								"data-testid": "yzj-dm-processing",
								children: "助手正在处理…"
							}),
							(bubbles.length > 0 || processing) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: shell_module_css_default.processLink,
								"data-testid": "yzj-view-process",
								onClick: () => {
									openAssistantSession(props.panel, props.assistantId);
								},
								children: "查看过程"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { ref: bottom })
						]
					}),
					error !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: shell_module_css_default.alert,
						role: "alert",
						children: error
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: shell_module_css_default.composer,
						"data-yzj-im-composer": "",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: shell_module_css_default.composerCard,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
								className: shell_module_css_default.composerInput,
								value: draft,
								placeholder: "发给助手",
								rows: 1,
								"aria-label": "发给助手",
								onChange: (event) => setDraft(event.target.value),
								onKeyDown
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: shell_module_css_default.send,
								"data-testid": "yzj-dm-send",
								"aria-label": "发给助手",
								disabled: busy || draft.trim() === "",
								onClick: () => {
									send();
								},
								children: "↑"
							})]
						})
					})
				]
			});
		}
		//#endregion
		//#region src/client/reply-bus.ts
		let listener = null;
		/** Subscribe the active room composer; returns the disposer. */
		function onRoomReplyRequest(callback) {
			listener = callback;
			return () => {
				if (listener === callback) listener = null;
			};
		}
		/** Emit one timeline reply; no-op when no composer is listening. */
		function emitRoomReplyRequest(target) {
			if (listener !== null) listener(target);
		}
		//#endregion
		//#region src/client/composer-host.ts
		/**
		* Live portal target for the group-room composer face (pitfall-019).
		* Transcript registers the timeline-column host; the composer (session-level,
		* survives workbench domain unmount) subscribes. Do not cache getElementById
		* across remounts.
		*/
		const ROOM_COMPOSER_HOST_ID = "yzj-room-composer-host";
		let current = null;
		const listeners = /* @__PURE__ */ new Set();
		function liveHost() {
			return current !== null && current.isConnected ? current : null;
		}
		function notify() {
			const live = liveHost();
			for (const listener of listeners) listener(live);
		}
		/** Register or clear the timeline-column portal host. Pass null on unmount. */
		function registerRoomComposerHost(el) {
			current = el;
			notify();
		}
		//#endregion
		//#region src/artifact-badge.ts
		/** Type chip + display name for a file (MD → DOC, png → IMG, …). */
		function artifactBadgeOf(fileName) {
			const name = fileName.trim();
			const ext = (name.includes(".") ? name.slice(name.lastIndexOf(".") + 1) : "").toUpperCase();
			return {
				type: /^(MD|TXT|DOC|DOCX)$/.test(ext) ? "DOC" : /^(XLS|XLSX|CSV)$/.test(ext) ? "XLS" : ext === "PDF" ? "PDF" : /^(PNG|JPG|JPEG|GIF|WEBP|BMP|SVG)$/.test(ext) ? "IMG" : ext === "" ? "FILE" : ext,
				name: name === "" ? "文件" : name
			};
		}
		//#endregion
		//#region src/client/room-layout.ts
		/**
		* Group-room timeline layout helpers (docs/spec/group-room-topics.md §9.1 P1):
		* same-sender clustering, date separators, reply-count chips, assistant
		* artifact cards. Pure — no React.
		*/
		function asString$2(value) {
			return typeof value === "string" ? value : "";
		}
		/** Cluster key: self / robot / directory openId / display name. */
		function speakerKey(entry) {
			if (entry.isSelf) return "self";
			if (entry.origin === "robot-outbound") return `bot:${entry.topicSessionId ?? entry.fromOpenId ?? "assistant"}`;
			if (entry.fromOpenId !== void 0 && entry.fromOpenId !== "") return `u:${entry.fromOpenId}`;
			return `n:${entry.fromName}`;
		}
		/** Local calendar day `YYYY-MM-DD`. */
		function dayKey(ms) {
			if (!Number.isFinite(ms) || ms <= 0) return "";
			const date = new Date(ms);
			const pad = (n) => String(n).padStart(2, "0");
			return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
		}
		/** Date-rule copy: 今天 / 昨天 / YYYY-MM-DD. Yesterday is calendar-local. */
		function dateSepLabel(ms, now = Date.now()) {
			const key = dayKey(ms);
			if (key === "") return "";
			if (key === dayKey(now)) return "今天";
			const yesterday = new Date(now);
			yesterday.setDate(yesterday.getDate() - 1);
			if (key === dayKey(yesterday.getTime())) return "昨天";
			return key;
		}
		/**
		* Insert date rules and mark same-speaker continuations. A new day always
		* breaks the cluster so the first row of the day shows avatar + name.
		*/
		function layoutRoomItems(items, now = Date.now()) {
			const out = [];
			let lastDay = "";
			let lastSpeaker = "";
			for (const item of items) {
				if (item.kind !== "im" || item.entry === void 0) continue;
				const day = dayKey(item.entry.sentAt);
				if (day !== lastDay) {
					const label = dateSepLabel(item.entry.sentAt, now);
					if (label !== "") out.push({
						kind: "sep",
						label
					});
					lastDay = day;
					lastSpeaker = "";
				}
				const speaker = speakerKey(item.entry);
				out.push({
					kind: "im",
					entry: item.entry,
					merged: speaker === lastSpeaker && lastSpeaker !== ""
				});
				lastSpeaker = speaker;
			}
			return out;
		}
		/**
		* Typed deliverable under an assistant bubble. Robot-outbound file posts
		* and DSH job-done file posts (CLI `msgType=file` or a `param.name`) become
		* a card.
		*/
		function artifactOf(entry) {
			const fromRobot = entry.origin === "robot-outbound";
			const fromTopicDeliver = entry.origin === "dsh-send" && entry.topicSessionId !== void 0;
			if (!fromRobot && !fromTopicDeliver) return void 0;
			const param = entry.param ?? {};
			const name = asString$2(param.name);
			if ((entry.msgType ?? "") !== "file" && name === "") return void 0;
			const display = name === "" ? entry.content.replace(/^\[文件\]:?\s*/, "").trim() || "文件" : name;
			const ext = asString$2(param.ext);
			return {
				type: artifactBadgeOf(ext === "" || display.includes(".") ? display : `${display}.${ext}`).type,
				name: display,
				note: "已发进群 · 点开查看"
			};
		}
		//#endregion
		//#region src/client/transcript.tsx
		/**
		* Group-room VIEW (docs/spec/group-room-topics.md R2/R7).
		* Identity/media share the floating-panel renderer; layout follows the
		* canvas prototype (self right, others left). Agent work lives on yzj-topic-*.
		* Registered as conversation.view「群聊」— not a Session.append event type.
		*/
		function asRecord$2(value) {
			return typeof value === "object" && value !== null ? value : {};
		}
		function clock(ms) {
			if (!Number.isFinite(ms) || ms <= 0) return "";
			const date = new Date(ms);
			const pad = (n) => String(n).padStart(2, "0");
			return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
		}
		/**
		* Visible sender label. Never uses 「群消息」 as a person name.
		* Empty → directory result → BOT- senders 「机器人」 → openId tail → 「未知」.
		* Robot openIds are `BOT-` prefixed and never resolve via the contact
		* directory; without the branch they rendered as a raw id tail (543b4d).
		*/
		function displayNameOf(entry, resolved) {
			if (entry.origin === "robot-outbound") {
				if (resolved !== void 0 && resolved !== "") return resolved;
				return entry.fromName === "" ? "助手" : entry.fromName;
			}
			if (entry.isSelf) return "我";
			if (resolved !== void 0 && resolved !== "") return resolved;
			if (entry.fromName !== "") return entry.fromName;
			const openId = entry.fromOpenId ?? "";
			if (openId.startsWith("BOT-")) return "机器人";
			if (openId !== "") return openId.length > 6 ? openId.slice(-6) : openId;
			return "未知";
		}
		/**
		* True when the row is a robot/assistant wall-of-text worth clamping (R7: the
		* IM timeline is not a markdown canvas — long agent posts fold to 4 lines
		* with 「展开全文」). Images/files/cards stay untouched.
		*/
		function agentClampOf(entry) {
			if (entry.isSelf) return false;
			if (!(entry.origin === "robot-outbound" || (entry.fromOpenId ?? "").startsWith("BOT-"))) return false;
			const msgType = entry.msgType ?? "text";
			if (msgType !== "text" && msgType !== "other") return false;
			return entry.content.length > 240;
		}
		function parseTopics(raw) {
			if (!Array.isArray(raw)) return [];
			return raw.flatMap((item) => {
				const row = asRecord$2(item);
				const id = typeof row.dshSessionId === "string" ? row.dshSessionId : "";
				if (id === "") return [];
				return [{
					dshSessionId: id,
					title: typeof row.title === "string" && row.title !== "" ? row.title : id,
					source: typeof row.source === "string" ? row.source : "yzj",
					...typeof row.lastActivity === "number" ? { lastActivity: row.lastActivity } : {},
					...row.status === "confirm" || row.status === "done" || row.status === "running" ? { status: row.status } : {},
					...typeof row.rootMsgId === "string" ? { rootMsgId: row.rootMsgId } : {},
					...typeof row.originWho === "string" ? { originWho: row.originWho } : {},
					...typeof row.originText === "string" ? { originText: row.originText } : {},
					...typeof row.originTime === "number" ? { originTime: row.originTime } : {}
				}];
			});
		}
		function parseImEntry(raw) {
			const row = asRecord$2(raw);
			const msgId = typeof row.msgId === "string" ? row.msgId : "";
			if (msgId === "") return void 0;
			const param = typeof row.param === "object" && row.param !== null ? row.param : void 0;
			return {
				msgId,
				sentAt: typeof row.sentAt === "number" ? row.sentAt : 0,
				fromName: typeof row.fromName === "string" ? row.fromName : "",
				content: typeof row.content === "string" ? row.content : "",
				origin: typeof row.origin === "string" ? row.origin : "inbound",
				isSelf: row.isSelf === true,
				status: typeof row.status === "string" ? row.status : "acked",
				...typeof row.fromOpenId === "string" ? { fromOpenId: row.fromOpenId } : {},
				...typeof row.replyMsgId === "string" ? { replyMsgId: row.replyMsgId } : {},
				...typeof row.topicSessionId === "string" ? { topicSessionId: row.topicSessionId } : {},
				...typeof row.msgType === "string" ? { msgType: row.msgType } : {},
				...param === void 0 ? {} : { param }
			};
		}
		function parseItems(raw) {
			if (!Array.isArray(raw)) return [];
			return raw.flatMap((item) => {
				const row = asRecord$2(item);
				if (row.kind !== "im") return [];
				const entry = parseImEntry(row.entry);
				if (entry === void 0) return [];
				return [{
					kind: "im",
					time: typeof row.time === "number" ? row.time : entry.sentAt,
					entry
				}];
			});
		}
		function messageRecord(entry) {
			const param = { ...entry.param ?? {} };
			if (entry.replyMsgId !== void 0 && param.replyMsgId === void 0) param.replyMsgId = entry.replyMsgId;
			return {
				content: entry.content,
				msgType: entry.msgType ?? "text",
				param
			};
		}
		function seedNames(items) {
			const out = {};
			for (const item of items) {
				if (item.kind !== "im") continue;
				const openId = item.entry.fromOpenId ?? "";
				if (openId === "") continue;
				if (item.entry.fromName !== "") out[openId] = item.entry.fromName;
				const cachedName = senderNameOf(openId);
				if (cachedName !== "") out[openId] = cachedName;
			}
			return out;
		}
		const fusedCache = /* @__PURE__ */ new Map();
		function cacheKeyOf(sessionId, groupId) {
			return groupId !== void 0 && groupId !== "" ? `g:${groupId}` : sessionId;
		}
		function remember(key, next) {
			fusedCache.set(key, next);
			return next;
		}
		/** True when the timeline is following the latest message (within slack px). */
		function streamAtBottom(el, slack = 40) {
			return el.scrollHeight - el.scrollTop - el.clientHeight < slack;
		}
		function phaseOf(cached) {
			if (cached === void 0) return "loading";
			if (cached.kind === "room" && cached.bound === true) return "bound";
			if (cached.kind === "unbound" || cached.kind === "topic" || cached.bound === false) return "unbound";
			return "loading";
		}
		/**
		* Group-room stream. Unbound sessions show a private-chat hint only after
		* fused confirms it. Cache-miss shows 「加载群消息…」 (pitfall-013).
		*/
		function YzjFusedView(props) {
			const viewKey = cacheKeyOf(props.sessionId, props.groupId);
			const cached = fusedCache.get(viewKey);
			const [held, setHeld] = (0, react.useState)(() => ({
				sessionId: viewKey,
				value: cached ?? {
					bound: false,
					items: []
				},
				phase: phaseOf(cached)
			}));
			const value = held.sessionId === viewKey ? held.value : cached ?? {
				bound: false,
				items: []
			};
			const phase = held.sessionId === viewKey ? held.phase : phaseOf(cached);
			const [error, setError] = (0, react.useState)("");
			const [more, setMore] = (0, react.useState)(() => getFusedMore(viewKey) ?? true);
			const [loadingOlder, setLoadingOlder] = (0, react.useState)(false);
			const anchorPagesRef = (0, react.useRef)(0);
			(0, react.useEffect)(() => {
				anchorPagesRef.current = 0;
			}, [viewKey]);
			const [names, setNames] = (0, react.useState)(() => seedNames(cached?.items ?? []));
			const [lightbox, setLightbox] = (0, react.useState)(null);
			const [highlightMsgId, setHighlightMsgId] = (0, react.useState)("");
			const [unclamped, setUnclamped] = (0, react.useState)(() => /* @__PURE__ */ new Set());
			const highlightRef = (0, react.useRef)(null);
			const streamRef = (0, react.useRef)(null);
			const followBottomRef = (0, react.useRef)(true);
			const scrollRestoreRef = (0, react.useRef)(null);
			/** scrollHeight at the last stick; growth-driven scroll events are not user intent. */
			const stuckHeightRef = (0, react.useRef)(0);
			const streamContentRef = (0, react.useRef)(null);
			/** Set by wheel/touch: only a user-steered scroll may disengage follow-bottom. */
			const userSteerRef = (0, react.useRef)(false);
			(0, react.useEffect)(() => {
				const hit = fusedCache.get(viewKey);
				followBottomRef.current = true;
				userSteerRef.current = false;
				scrollRestoreRef.current = null;
				setHeld({
					sessionId: viewKey,
					value: hit ?? {
						bound: false,
						items: []
					},
					phase: phaseOf(hit)
				});
				setNames(seedNames(hit?.items ?? []));
				setMore(getFusedMore(viewKey) ?? true);
				setHighlightMsgId("");
				setUnclamped(/* @__PURE__ */ new Set());
				setError("");
			}, [viewKey]);
			(0, react.useEffect)(() => {
				putFusedMore(viewKey, more);
			}, [viewKey, more]);
			(0, react.useEffect)(() => {
				if (highlightMsgId === "") return;
				followBottomRef.current = false;
				highlightRef.current?.scrollIntoView({ block: "center" });
			}, [highlightMsgId, value.items]);
			(0, react.useEffect)(() => {
				if (props.anchorMsgId === void 0 || props.anchorMsgId === "") return;
				setHighlightMsgId(props.anchorMsgId);
			}, [props.anchorMsgId, viewKey]);
			(0, react.useEffect)(() => {
				if (props.anchorMsgId === void 0 || props.anchorMsgId === "") return;
				if (value.items.some((item) => item.kind === "im" && item.entry.msgId === props.anchorMsgId)) return;
				if (!more || loadingOlder || phase !== "bound") return;
				if (anchorPagesRef.current >= 10) return;
				anchorPagesRef.current += 1;
				loadOlder();
			}, [
				props.anchorMsgId,
				viewKey,
				value.items,
				more,
				loadingOlder,
				phase
			]);
			(0, react.useEffect)(() => {
				const el = streamRef.current;
				const content = streamContentRef.current;
				if (el === null) return;
				const stick = () => {
					const restore = scrollRestoreRef.current;
					if (restore !== null) {
						const delta = el.scrollHeight - restore.height;
						if (delta > 0) el.scrollTop = restore.top + delta;
						scrollRestoreRef.current = null;
						stuckHeightRef.current = el.scrollHeight;
						return;
					}
					if (followBottomRef.current) el.scrollTop = el.scrollHeight;
					stuckHeightRef.current = el.scrollHeight;
				};
				stick();
				if (typeof ResizeObserver === "undefined") return;
				const observer = new ResizeObserver(() => {
					stick();
				});
				if (content !== null) observer.observe(content);
				return () => observer.disconnect();
			}, [
				value.items,
				viewKey,
				phase
			]);
			const applyFused = (raw) => {
				const items = parseItems(raw.items);
				const binding = typeof raw.binding === "object" && raw.binding !== null ? raw.binding : void 0;
				const kind = raw.kind === "room" || raw.kind === "topic" || raw.kind === "unbound" ? raw.kind : raw.bound === true ? "room" : "unbound";
				const next = remember(viewKey, {
					bound: raw.bound === true,
					kind,
					items,
					topics: parseTopics(raw.topics),
					...binding === void 0 ? {} : { binding },
					...typeof raw.groupName === "string" && raw.groupName !== "" ? { groupName: raw.groupName } : {}
				});
				const nextPhase = next.kind === "room" && next.bound === true ? "bound" : "unbound";
				setHeld({
					sessionId: viewKey,
					value: next,
					phase: nextPhase
				});
				return next;
			};
			(0, react.useEffect)(() => {
				if (viewKey === "") return;
				let cancelled = false;
				const load = async (backfill) => {
					const fused = await props.homeFused(props.sessionId, props.groupId);
					if (cancelled) return;
					if (!fused.ok) {
						setError(fused.error.message);
						return;
					}
					setError("");
					const next = applyFused(asRecord$2(fused.value));
					const seeded = seedNames(next.items);
					if (Object.keys(seeded).length > 0) setNames((prev) => ({
						...seeded,
						...prev
					}));
					if (backfill) {
						const stats = await props.homeBackfill(props.sessionId, props.groupId === void 0 || props.groupId === "" ? void 0 : { groupId: props.groupId });
						if (cancelled) return;
						if (stats.ok) {
							if (asRecord$2(stats.value).more === false) setMore(false);
							const again = await props.homeFused(props.sessionId, props.groupId);
							if (!cancelled && again.ok) applyFused(asRecord$2(again.value));
						}
					}
					if (props.fetchContact !== void 0) {
						const found = await resolveSenders(next.items.flatMap((item) => item.kind === "im" && item.entry.fromOpenId !== void 0 ? [item.entry.fromOpenId] : []), { fetchContact: props.fetchContact });
						if (!cancelled && Object.keys(found).length > 0) setNames((prev) => ({
							...prev,
							...found
						}));
					}
				};
				load(true);
				const timer = window.setInterval(() => {
					load(false);
				}, 800);
				return () => {
					cancelled = true;
					window.clearInterval(timer);
				};
			}, [viewKey]);
			const loadOlder = async () => {
				if (loadingOlder) return;
				const oldest = value.items.find((item) => item.kind === "im");
				const beforeMsgId = oldest?.kind === "im" ? oldest.entry.msgId : "";
				if (beforeMsgId === "") {
					setMore(false);
					return;
				}
				const el = streamRef.current;
				if (el !== null) {
					scrollRestoreRef.current = {
						height: el.scrollHeight,
						top: el.scrollTop
					};
					followBottomRef.current = false;
				}
				setLoadingOlder(true);
				const stats = await props.homeBackfill(props.sessionId, {
					beforeMsgId,
					limit: 20,
					...props.groupId === void 0 || props.groupId === "" ? {} : { groupId: props.groupId }
				});
				setLoadingOlder(false);
				if (!stats.ok) {
					setError(stats.error.message);
					return;
				}
				if (asRecord$2(stats.value).more === false) setMore(false);
				const result = await props.homeFused(props.sessionId, props.groupId);
				if (!result.ok) return;
				const seeded = seedNames(applyFused(asRecord$2(result.value)).items);
				if (Object.keys(seeded).length > 0) setNames((prev) => ({
					...seeded,
					...prev
				}));
			};
			if (value.kind === "topic") return null;
			const emptyPhase = phase === "unbound" || phase === "loading" && value.items.length === 0;
			const fileInject = { fetchFileData: props.fetchFileData ?? (async () => ({
				ok: false,
				error: { message: "file-data unavailable" }
			})) };
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: home_module_css_default.roomMain,
				children: [
					error !== "" && !emptyPhase && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: home_module_css_default.hint,
						role: "alert",
						children: error
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: home_module_css_default.roomMainHead }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: home_module_css_default.roomStage,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: home_module_css_default.roomTimeline,
							children: [emptyPhase ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: home_module_css_default.stream,
								"data-testid": "yzj-fused-stream",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: home_module_css_default.unbound,
									children: viewKey === "" ? "在左侧选择一个群开始。" : phase === "unbound" ? "还没有对话。" : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: home_module_css_default.hint,
										children: error !== "" ? error : "加载群消息…"
									})
								})
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: home_module_css_default.stream,
								"data-testid": "yzj-fused-stream",
								ref: streamRef,
								onWheel: () => {
									userSteerRef.current = true;
								},
								onTouchMove: () => {
									userSteerRef.current = true;
								},
								onScroll: () => {
									const el = streamRef.current;
									if (el === null) return;
									if (el.scrollHeight !== stuckHeightRef.current) return;
									if (streamAtBottom(el)) {
										followBottomRef.current = true;
										userSteerRef.current = false;
										return;
									}
									if (!userSteerRef.current) return;
									userSteerRef.current = false;
									followBottomRef.current = false;
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: home_module_css_default.streamContent,
									ref: streamContentRef,
									children: [more && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: home_module_css_default.streamMore,
										onClick: () => {
											loadOlder();
										},
										disabled: loadingOlder,
										children: loadingOlder ? "加载中…" : "加载更早消息"
									}), layoutRoomItems(value.items).map((node) => {
										if (node.kind === "sep") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: home_module_css_default.daySep,
											"data-testid": "yzj-day-sep",
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: node.label })
										}, `sep-${node.label}`);
										const entry = node.entry;
										const mine = entry.isSelf;
										const assistant = entry.origin === "robot-outbound";
										const openId = entry.fromOpenId ?? "";
										const sender = displayNameOf(entry, openId !== "" ? names[openId] : void 0);
										const clamped = agentClampOf(entry) && !unclamped.has(entry.msgId);
										const clampable = agentClampOf(entry);
										const highlighted = highlightMsgId === entry.msgId;
										const artifact = artifactOf(entry);
										const hideFileBody = artifact !== void 0 && entry.msgType === "file";
										const rowClass = [
											home_module_css_default.roomRow,
											mine ? home_module_css_default.roomRowSelf : home_module_css_default.roomRowOther,
											node.merged ? home_module_css_default.roomRowMerged : "",
											highlighted ? home_module_css_default.roomRowHighlight : ""
										].filter(Boolean).join(" ");
										const bubbleClass = [
											home_module_css_default.roomBubble,
											mine ? home_module_css_default.roomBubbleSelf : home_module_css_default.roomBubbleOther,
											assistant ? home_module_css_default.roomBubbleAssistant : ""
										].filter(Boolean).join(" ");
										const time = clock(entry.sentAt);
										return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: rowClass,
											"data-origin": entry.origin,
											"data-merged": node.merged ? "true" : "false",
											"data-testid": `yzj-room-row-${entry.msgId}`,
											ref: highlighted ? highlightRef : void 0,
											children: [!mine && (node.merged ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: home_module_css_default.roomAvatarSlot,
												"aria-hidden": "true"
											}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SenderAvatar, {
												openId,
												fallback: sender === "" ? typeLabelOf(entry.msgType ?? "text") : sender
											})), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: home_module_css_default.roomStack,
												children: [
													!node.merged && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
														className: home_module_css_default.roomMeta,
														children: [
															mine ? `我${time === "" ? "" : ` · ${time}`}` : `${sender}${time === "" ? "" : ` · ${time}`}`,
															entry.status === "pending" ? " · 发送中…" : "",
															entry.status === "failed" ? " · 发送失败" : ""
														]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
														className: bubbleClass,
														children: [
															!hideFileBody && (clamped ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																className: home_module_css_default.roomClamp,
																children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MessageBody, {
																	message: messageRecord(entry),
																	onOpenImage: (src) => setLightbox({
																		src,
																		kind: "image"
																	}),
																	onOpenPdf: (src) => setLightbox({
																		src,
																		kind: "pdf"
																	}),
																	inject: fileInject
																})
															}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MessageBody, {
																message: messageRecord(entry),
																onOpenImage: (src) => setLightbox({
																	src,
																	kind: "image"
																}),
																onOpenPdf: (src) => setLightbox({
																	src,
																	kind: "pdf"
																}),
																inject: fileInject
															})),
															clampable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																type: "button",
																className: home_module_css_default.roomClampToggle,
																onClick: () => {
																	setUnclamped((prev) => {
																		const next = new Set(prev);
																		if (next.has(entry.msgId)) next.delete(entry.msgId);
																		else next.add(entry.msgId);
																		return next;
																	});
																},
																children: clamped ? "展开全文" : "收起"
															}),
															artifact !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																className: home_module_css_default.artifactCard,
																"data-testid": `yzj-artifact-${entry.msgId}`,
																children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																	className: home_module_css_default.artifactType,
																	children: artifact.type
																}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																	className: home_module_css_default.artifactMeta,
																	children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																		className: home_module_css_default.artifactName,
																		children: artifact.name
																	}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																		className: home_module_css_default.artifactNote,
																		children: artifact.note
																	})]
																})]
															})
														]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
														className: home_module_css_default.roomRowActions,
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															className: home_module_css_default.roomAction,
															onClick: () => emitRoomReplyRequest({
																msgId: entry.msgId,
																summary: entry.content.slice(0, 80)
															}),
															children: "回复"
														}), props.onForwardToAssistant !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															className: home_module_css_default.roomAction,
															"data-testid": `yzj-forward-assistant-${entry.msgId}`,
															onClick: () => props.onForwardToAssistant?.(entry),
															children: "转发给助手"
														})]
													})
												]
											})]
										}, `im-${entry.msgId}`), props.renderThread?.(entry)] }, `im-wrap-${entry.msgId}`);
									})]
								})
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								ref: registerRoomComposerHost,
								id: ROOM_COMPOSER_HOST_ID,
								className: home_module_css_default.roomComposerHost,
								"data-testid": "yzj-room-composer-host"
							}, ROOM_COMPOSER_HOST_ID)]
						})
					}),
					lightbox !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ImLightbox, {
						src: lightbox.src,
						kind: lightbox.kind,
						onClose: () => setLightbox(null)
					})
				]
			});
		}
		//#endregion
		//#region src/client/local-thread.tsx
		/**
		* Local-only thread under a group message (只你可见).
		*/
		function YzjLocalThread(props) {
			const { thread } = props;
			if (thread.status === "idle" && thread.bubbles.length === 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: shell_module_css_default.thread,
				"data-testid": `yzj-local-thread-${thread.msgId}`,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: shell_module_css_default.pill,
						children: "只你可见"
					}),
					thread.status === "processing" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: shell_module_css_default.processing,
						"data-testid": "yzj-thread-processing",
						children: "助手正在处理…"
					}),
					thread.bubbles.filter((b) => b.role === "assistant").map((bubble) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: shell_module_css_default.bubbleAssistant,
						children: bubble.text
					}, bubble.id)),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: shell_module_css_default.processLink,
						onClick: props.onPeek,
						children: "查看过程"
					})
				]
			});
		}
		//#endregion
		//#region src/client/im-compose.ts
		/**
		* Shared light-send helpers for the group-room composer (CLI `im message send`
		* surface). Extracted so panel and room composer do not duplicate @ parsing.
		*/
		/** Common emojis for the composer picker (body Unicode, not message reactions). */
		const EMOJI_LIST = [
			"😀",
			"😄",
			"😂",
			"🤣",
			"😊",
			"😍",
			"🤔",
			"😎",
			"😭",
			"😅",
			"😉",
			"🙏",
			"👍",
			"👏",
			"💪",
			"🔥",
			"❤️",
			"🎉",
			"✅",
			"❌",
			"⚠️",
			"📌",
			"💡",
			"🚀"
		];
		/**
		* One `--at-open-id` per `@姓名` fragment, in order. `@all` sets atAll.
		* Unknown names fail closed — the CLI cannot guess members.
		*/
		function resolveAtMentions(content, candidates) {
			const atOpenIds = [];
			let atAll = false;
			for (const frag of content.match(/@[^@\s，,、]+/g) ?? []) {
				if (frag === "@all") {
					atAll = true;
					continue;
				}
				const openId = candidates.find((candidate) => frag === `@${candidate.name}`)?.openId ?? "";
				if (openId === "") return {
					ok: false,
					error: `未找到 ${frag} 的成员（候选来自本群发言者）`
				};
				atOpenIds.push(openId);
			}
			return {
				ok: true,
				atOpenIds,
				atAll
			};
		}
		const AT_TOKEN = /@([^\s@，,、]+)/g;
		/**
		* First @ token that matches an assistant name (exact). Assistants are
		* tried before people; empty composer `@助手` is `empty` (must not post).
		*/
		function interceptAssistantAt(content, assistants, hasReplyTarget) {
			const trimmed = content.trim();
			if (trimmed === "") return { kind: "none" };
			const tokens = [...trimmed.matchAll(AT_TOKEN)].map((match) => match[1] ?? "");
			if (tokens.length === 0) return { kind: "none" };
			let assistantId;
			for (const token of tokens) {
				const hit = assistants.find((row) => row.name === token || token === "助手" && row.id === "default");
				if (hit !== void 0) {
					assistantId = hit.id;
					break;
				}
			}
			if (assistantId === void 0) return { kind: "none" };
			const without = trimmed.replace(AT_TOKEN, (whole, name) => {
				return assistants.find((row) => row.name === name || name === "助手" && row.id === "default") !== void 0 ? "" : whole;
			}).trim();
			if (without === "" && tokens.every((token) => assistants.some((row) => row.name === token || token === "助手" && row.id === "default"))) return { kind: "empty" };
			if (!hasReplyTarget) return {
				kind: "need-anchor",
				assistantId
			};
			return {
				kind: "ask",
				assistantId,
				text: without === "" ? "请看这条消息" : without
			};
		}
		//#endregion
		//#region src/client/group-room.tsx
		/**
		* People IM room: Yunzhijia timeline + local @助手 threads + group composer.
		*/
		function asRecord$1(value) {
			return typeof value === "object" && value !== null ? value : {};
		}
		function asArray$1(value) {
			return Array.isArray(value) ? value : [];
		}
		function asString$1(value) {
			return typeof value === "string" ? value : "";
		}
		function parseThread(raw) {
			const row = asRecord$1(raw);
			const msgId = asString$1(row.msgId);
			const groupId = asString$1(row.groupId);
			if (msgId === "" || groupId === "") return void 0;
			return {
				groupId,
				msgId,
				assistantId: asString$1(row.assistantId) || "default",
				status: row.status === "processing" ? "processing" : "idle",
				bubbles: asArray$1(row.bubbles).flatMap((item) => {
					const bubble = asRecord$1(item);
					const id = asString$1(bubble.id);
					const role = bubble.role === "user" || bubble.role === "assistant" ? bubble.role : "assistant";
					const text = asString$1(bubble.text);
					if (id === "") return [];
					return [{
						id,
						role,
						text
					}];
				})
			};
		}
		function YzjGroupRoom(props) {
			const seed = getGroupRoomSnapshot(props.groupId);
			const [assistants, setAssistants] = (0, react.useState)([{
				id: "default",
				name: "助手"
			}]);
			const [threads, setThreads] = (0, react.useState)(() => seed ? [...seed.threads] : []);
			const [draft, setDraft] = (0, react.useState)(() => seed?.draft ?? "");
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)("");
			const [replyTo, setReplyTo] = (0, react.useState)(() => seed?.replyTo ?? null);
			const [emojiOpen, setEmojiOpen] = (0, react.useState)(false);
			const [atOpen, setAtOpen] = (0, react.useState)(false);
			const [speakers, setSpeakers] = (0, react.useState)(() => seed ? [...seed.speakers] : []);
			const imageRef = (0, react.useRef)(null);
			const fileRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				rememberImSeat({
					groupId: props.groupId,
					sessionId: "",
					groupName: props.groupName
				});
			}, [props.groupId, props.groupName]);
			(0, react.useEffect)(() => {
				const hit = getGroupRoomSnapshot(props.groupId);
				if (hit !== void 0) {
					setThreads([...hit.threads]);
					setDraft(hit.draft);
					setReplyTo(hit.replyTo);
					setSpeakers([...hit.speakers]);
				} else {
					setThreads([]);
					setDraft("");
					setReplyTo(null);
					setSpeakers([]);
				}
				setError("");
				setEmojiOpen(false);
				setAtOpen(false);
			}, [props.groupId]);
			(0, react.useEffect)(() => {
				putGroupRoomSnapshot(props.groupId, {
					draft,
					replyTo,
					threads,
					speakers
				});
			}, [
				props.groupId,
				draft,
				replyTo,
				threads,
				speakers
			]);
			(0, react.useEffect)(() => onRoomReplyRequest((target) => {
				setReplyTo(target);
				setError("");
			}), []);
			(0, react.useEffect)(() => {
				let cancelled = false;
				const load = async () => {
					const listed = await props.panel.assistantsList?.();
					if (!cancelled && listed?.ok) {
						const rows = asArray$1(asRecord$1(listed.value).assistants).flatMap((item) => {
							const row = asRecord$1(item);
							const id = asString$1(row.id);
							const name = asString$1(row.name);
							if (id === "") return [];
							return [{
								id,
								name: name === "" ? "助手" : name
							}];
						});
						if (rows.length > 0) setAssistants(rows);
					}
					const packed = await props.panel.assistantThreads?.(props.groupId);
					if (!cancelled && packed?.ok) setThreads(asArray$1(asRecord$1(packed.value).threads).flatMap((item) => {
						const thread = parseThread(item);
						return thread === void 0 ? [] : [thread];
					}));
					const fused = await props.panel.homeFused?.("", props.groupId);
					if (!cancelled && fused?.ok) {
						const items = asArray$1(asRecord$1(fused.value).items);
						const byId = /* @__PURE__ */ new Map();
						for (const item of items) {
							const entry = asRecord$1(asRecord$1(item).entry);
							const openId = asString$1(entry.fromOpenId);
							const name = asString$1(entry.fromName);
							if (openId !== "" && name !== "" && entry.isSelf !== true) byId.set(openId, name);
						}
						setSpeakers([...byId.entries()].map(([openId, name]) => ({
							openId,
							name
						})));
					}
				};
				load();
				const timer = window.setInterval(() => {
					load();
				}, 1200);
				return () => {
					cancelled = true;
					window.clearInterval(timer);
				};
			}, [props.groupId, props.panel]);
			const askThread = async (assistantId, msgId, text, origin) => {
				setBusy(true);
				setError("");
				const result = await props.panel.assistantThreadAsk?.({
					assistantId,
					groupId: props.groupId,
					msgId,
					text,
					...props.groupName === "" ? {} : { groupName: props.groupName },
					...origin === void 0 || origin.fromName === "" ? {} : { originWho: origin.fromName },
					...origin === void 0 || origin.content === "" ? {} : { originText: origin.content.slice(0, 400) }
				});
				setBusy(false);
				if (result === void 0 || !result.ok) setError(result?.error.message ?? "助手未响应");
			};
			const sendText = async (content, extra) => {
				const intercepted = interceptAssistantAt(content, assistants, replyTo !== null);
				if (intercepted.kind === "empty") {
					setError("单独 @助手 不会发到群。请先点「回复」再 @，或点右上角「问助手」。");
					return;
				}
				if (intercepted.kind === "need-anchor") {
					setError("请先点某条消息的「回复」再 @助手；要单聊请点右上角「问助手」。");
					return;
				}
				if (intercepted.kind === "ask") {
					const msgId = replyTo?.msgId ?? "";
					await askThread(intercepted.assistantId, msgId, intercepted.text);
					setDraft("");
					setReplyTo(null);
					return;
				}
				const mentions = resolveAtMentions(content, speakers);
				if (!mentions.ok) {
					setError(mentions.error);
					return;
				}
				setBusy(true);
				setError("");
				const result = await props.panel.homeSend?.("", content, {
					...extra,
					groupId: props.groupId,
					...replyTo === null ? {} : { replyMsgId: replyTo.msgId },
					...mentions.atOpenIds.length === 0 ? {} : { atOpenIds: [...mentions.atOpenIds] },
					...mentions.atAll ? { atAll: true } : {}
				});
				setBusy(false);
				if (result === void 0 || !result.ok) {
					setError(result?.error.message ?? "发送失败");
					return;
				}
				setDraft("");
				setReplyTo(null);
			};
			const send = async () => {
				const text = draft.trim();
				if (text === "" || busy) return;
				await sendText(text);
			};
			const onKeyDown = (event) => {
				if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
				event.preventDefault();
				send();
			};
			const pickAssistant = (row) => {
				setAtOpen(false);
				if (replyTo === null) {
					setError("请先点某条消息的「回复」再 @助手；要单聊请点右上角「问助手」。");
					return;
				}
				const rest = draft.replace(/@\S+/g, "").trim();
				askThread(row.id, replyTo.msgId, rest === "" ? "请看这条消息" : rest);
				setDraft("");
				setReplyTo(null);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: shell_module_css_default.shell,
				"data-testid": "yzj-group-room",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: shell_module_css_default.header,
						"data-yzj-im-header": "",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: shell_module_css_default.headerTitle,
								children: props.groupName || "群聊"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: shell_module_css_default.headerSub,
								children: "人群房间"
							})] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: shell_module_css_default.headerGrow }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: shell_module_css_default.askBtn,
								"data-testid": "yzj-ask-assistant",
								onClick: () => setImSelection({
									kind: "assistant",
									assistantId: props.defaultAssistantId
								}),
								children: "问助手"
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: shell_module_css_default.body,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(YzjFusedView, {
							sessionId: "",
							groupId: props.groupId,
							homeFused: (id, groupId) => props.panel.homeFused?.(id, groupId) ?? Promise.resolve({
								ok: false,
								error: { message: "homeFused unavailable" }
							}),
							homeBackfill: (id, opts) => props.panel.homeBackfill?.(id, opts) ?? Promise.resolve({
								ok: false,
								error: { message: "homeBackfill unavailable" }
							}),
							...props.panel.fetchFileData === void 0 ? {} : { fetchFileData: props.panel.fetchFileData },
							...props.panel.fetchContact === void 0 ? {} : { fetchContact: props.panel.fetchContact },
							renderThread: (entry) => {
								const thread = threads.find((item) => item.msgId === entry.msgId);
								if (thread === void 0) return null;
								return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(YzjLocalThread, {
									thread,
									onPeek: () => {
										openAssistantSession(props.panel, thread.assistantId);
									}
								});
							},
							onForwardToAssistant: (entry) => {
								askThread(props.defaultAssistantId, entry.msgId, "请看这条消息", entry);
							}
						})
					}),
					error !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: shell_module_css_default.alert,
						role: "alert",
						children: error
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: shell_module_css_default.composer,
						"data-yzj-im-composer": "",
						children: [
							replyTo !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: home_module_css_default.roomReplyBar,
								"data-testid": "yzj-room-reply",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: home_module_css_default.roomReplyText,
									children: ["回复：", replyTo.summary]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: home_module_css_default.roomReplyCancel,
									onClick: () => setReplyTo(null),
									children: "取消"
								})]
							}),
							atOpen && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: shell_module_css_default.atMenu,
								"data-testid": "yzj-at-menu",
								children: [assistants.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: shell_module_css_default.atItem,
									onClick: () => pickAssistant(row),
									children: ["@", row.name]
								}, row.id)), speakers.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: shell_module_css_default.atItem,
									onClick: () => {
										setDraft(`${draft}@${row.name} `);
										setAtOpen(false);
									},
									children: ["@", row.name]
								}, row.openId))]
							}),
							emojiOpen && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: home_module_css_default.roomEmojiPanel,
								role: "listbox",
								"aria-label": "表情",
								children: EMOJI_LIST.map((emoji) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: home_module_css_default.roomEmojiBtn,
									onClick: () => {
										setDraft(`${draft}${emoji}`);
										setEmojiOpen(false);
									},
									children: emoji
								}, emoji))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: shell_module_css_default.composerCard,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
										className: shell_module_css_default.composerInput,
										value: draft,
										placeholder: "发到群里，@ 可叫助手（不会发到群）",
										rows: 2,
										"aria-label": "发到群里",
										onChange: (event) => {
											setDraft(event.target.value);
											if (event.target.value.endsWith("@")) setAtOpen(true);
										},
										onKeyDown
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: shell_module_css_default.plus,
										"aria-label": "提及",
										onClick: () => setAtOpen((open) => !open),
										children: "@"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: shell_module_css_default.plus,
										"aria-label": "表情",
										onClick: () => setEmojiOpen((open) => !open),
										children: "☺"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: shell_module_css_default.plus,
										"aria-label": "图片",
										onClick: () => imageRef.current?.click(),
										children: "📎"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										ref: imageRef,
										type: "file",
										accept: "image/*",
										hidden: true,
										onChange: (event) => {
											const file = event.target.files?.[0];
											event.target.value = "";
											if (file === void 0 || props.panel.uploadFile === void 0) return;
											const reader = new FileReader();
											reader.onload = () => {
												const base64 = typeof reader.result === "string" ? reader.result.split(",")[1] ?? "" : "";
												if (base64 === "") return;
												props.panel.uploadFile?.(file.name, base64, file.size).then(async (result) => {
													if (!result.ok) return;
													const fileId = asString$1(asRecord$1(result.value).fileId);
													if (fileId === "") return;
													await sendText(draft.trim() === "" ? "[图片]" : draft, {
														msgType: "richText",
														images: [fileId]
													});
												});
											};
											reader.readAsDataURL(file);
										}
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										ref: fileRef,
										type: "file",
										hidden: true
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: shell_module_css_default.send,
										"data-testid": "yzj-send-to-group",
										"aria-label": "发进群",
										disabled: busy || draft.trim() === "",
										onClick: () => {
											send();
										},
										children: "↑"
									})
								]
							})
						]
					})
				]
			});
		}
		//#endregion
		//#region src/client/im-shell.tsx
		/**
		* Center IM shell occupying conversation / conversation.view.
		* Keeps assistant / group panes mounted (CSS-hidden) so drafts and
		* timelines survive inbox row switches; warm snapshots cover 消息↔会话 remounts.
		* Tool process opens the real assistant session on 会话 (no IM peek page).
		*/
		function hideStyle(on) {
			return on ? { display: "none" } : void 0;
		}
		function rememberId(prev, id, max = 6) {
			if (prev[prev.length - 1] === id) return prev;
			const next = prev.filter((row) => row !== id);
			next.push(id);
			return next.length <= max ? next : next.slice(next.length - max);
		}
		function rememberGroup(prev, groupId, groupName, max = 6) {
			const without = prev.filter((row) => row.groupId !== groupId);
			without.push({
				groupId,
				groupName
			});
			return without.length <= max ? without : without.slice(without.length - max);
		}
		function selectionKey(sel) {
			if (sel.kind === "group") return `g:${sel.groupId}`;
			return `a:${sel.assistantId}`;
		}
		function YzjImShell(props) {
			const [sel, setSel] = (0, react.useState)(getImSelection);
			const [seenAssistants, setSeenAssistants] = (0, react.useState)(() => {
				const cur = getImSelection();
				return [cur.kind === "group" ? "default" : cur.assistantId];
			});
			const [seenGroups, setSeenGroups] = (0, react.useState)(() => {
				const cur = getImSelection();
				return cur.kind === "group" ? [{
					groupId: cur.groupId,
					groupName: cur.groupName ?? ""
				}] : [];
			});
			(0, react.useEffect)(() => markImOccupancy(), []);
			(0, react.useEffect)(() => subscribeImSelection(() => {
				setSel(getImSelection());
			}), []);
			(0, react.useEffect)(() => {
				if (sel.kind === "assistant") setSeenAssistants((prev) => rememberId(prev, sel.assistantId));
				if (sel.kind === "group") setSeenGroups((prev) => rememberGroup(prev, sel.groupId, sel.groupName ?? ""));
			}, [sel]);
			if (props.mode === "inbox") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(YzjInbox, { panel: props.panel });
			const assistantOn = sel.kind === "assistant";
			const groupOn = sel.kind === "group";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: shell_module_css_default.shellStack,
				"data-testid": "yzj-im-shell",
				"data-yzj-sel": selectionKey(sel),
				children: [seenAssistants.map((id) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: hideStyle(!(assistantOn && sel.assistantId === id)),
					hidden: !(assistantOn && sel.assistantId === id),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(YzjAssistantDm, {
						assistantId: id,
						panel: props.panel,
						writeInject: props.writeInject
					})
				}, `a-${id}`)), seenGroups.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: hideStyle(!(groupOn && sel.groupId === row.groupId)),
					hidden: !(groupOn && sel.groupId === row.groupId),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(YzjGroupRoom, {
						groupId: row.groupId,
						groupName: row.groupName,
						panel: props.panel,
						defaultAssistantId: "default"
					})
				}, `g-${row.groupId}`))]
			});
		}
		/** Conversation-view occupant: host session props are unused (IM selection bus). */
		function YzjConversationSlot(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(YzjImShell, {
				mode: "conversation",
				panel: props.panel,
				writeInject: props.writeInject
			});
		}
		/** Bind panel/write into a slot component (conversation.view has no inject face). */
		function bindImConversationView(panel, writeInject) {
			return function YzjImConversationView() {
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(YzjConversationSlot, {
					panel,
					writeInject
				});
			};
		}
		/** Chain select: hide the official InputBar while the IM shell owns the center. */
		function selectImComposer({ interactions }) {
			return electImComposer(interactions);
		}
		/** Collapse the official composer seat; the IM shell draws its own. */
		function YzjHideHostComposer() {
			(0, react.useEffect)(() => watchHostChrome(), []);
			return null;
		}
		//#endregion
		//#region src/client/surface-switch.tsx
		function YzjSurfaceSwitch(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: shell_module_css_default.surfaceSwitch,
				role: "tablist",
				"aria-label": "表面",
				"data-yzj-surface-switch": "",
				"data-testid": "yzj-surface-switch",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					role: "tab",
					className: props.surface === "im" ? shell_module_css_default.surfaceTabOn : shell_module_css_default.surfaceTab,
					"aria-selected": props.surface === "im",
					"data-testid": "yzj-surface-im",
					onClick: () => setImSurface("im"),
					children: "消息"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					role: "tab",
					className: props.surface === "session" ? shell_module_css_default.surfaceTabOn : shell_module_css_default.surfaceTab,
					"aria-selected": props.surface === "session",
					"data-testid": "yzj-surface-session",
					onClick: () => setImSurface("session"),
					children: "会话"
				})]
			});
		}
		//#endregion
		//#region src/client/inbox-mount.tsx
		/**
		* Shadow `sidebar.workspaces` without occupying the single seat
		* (pitfall-050: host ui-workspace already registered; a second register throws).
		*
		* Layout (I16):
		* - 消息/会话 switch mounts in the sidebar chrome **above** host「新会话」,
		*   so 会话态 is 表面开关 → 新会话 → 工作区, not 新会话压在页签上.
		* - Inbox portals into the workspaces region; folder tree hides only while
		*   IM occupancy is on.
		*/
		const SWITCH_ATTR = "data-yzj-surface-chrome";
		const INBOX_ATTR = "data-yzj-inbox-host";
		function workspacesSeat() {
			return document.querySelector("[data-slot=\"sidebar.workspaces\"]") ?? void 0;
		}
		function sidebarColumn() {
			return document.querySelector("[data-pane=\"sidebar\"], [class*=\"sidebarCol\"]") ?? void 0;
		}
		function newSessionAnchor(column) {
			const button = column.querySelector("button[class*=\"newSession\"]");
			if (button === null) return void 0;
			const row = button.closest("[class*=\"logoRow\"]");
			if (row !== null && column.contains(row)) return row;
			return button;
		}
		function applyInboxLayout(el, surface) {
			if (surface === "im") {
				el.style.cssText = "display:flex;flex-direction:column;height:100%;min-height:0;flex:1 1 0;";
				el.hidden = false;
				return;
			}
			el.style.cssText = "display:none;";
			el.hidden = true;
		}
		function YzjSurfaceSwitchPortal() {
			const [surface, setSurface] = (0, react.useState)(getImSurface);
			(0, react.useEffect)(() => subscribeImSelection(() => {
				setSurface(getImSurface());
			}), []);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(YzjSurfaceSwitch, { surface });
		}
		function YzjInboxPortal(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(YzjInbox, { panel: props.panel });
		}
		function placeSurfaceSwitch(host) {
			const column = sidebarColumn();
			if (column === void 0) return;
			const anchor = newSessionAnchor(column);
			if (anchor !== void 0 && anchor.parentElement !== null) {
				if (host.parentElement !== anchor.parentElement || host.nextElementSibling !== anchor) anchor.parentElement.insertBefore(host, anchor);
				return;
			}
			const seat = workspacesSeat();
			if (seat?.parentElement !== void 0 && seat.parentElement !== null) {
				if (host.parentElement !== seat.parentElement || host.nextElementSibling !== seat) seat.parentElement.insertBefore(host, seat);
			}
		}
		function placeInboxHost(host) {
			const seat = workspacesSeat();
			if (seat === void 0) return;
			if (host.parentElement !== seat) seat.insertBefore(host, seat.firstChild);
		}
		/**
		* Keep the surface switch + inbox portal mounted. Returns the disposer.
		* Inbox React tree stays mounted under 会话 (host CSS hides it) so the
		* recent list does not cold-fetch on every 消息/会话 toggle.
		*/
		function mountInbox(panel) {
			if (typeof document === "undefined") return () => {};
			const stopMark = markImOccupancy();
			const switchHost = document.createElement("div");
			switchHost.setAttribute(SWITCH_ATTR, "");
			switchHost.style.cssText = "flex:none;";
			const switchRoot = (0, react_dom_client.createRoot)(switchHost);
			const inboxHost = document.createElement("div");
			inboxHost.setAttribute(INBOX_ATTR, "");
			applyInboxLayout(inboxHost, getImSurface());
			const inboxRoot = (0, react_dom_client.createRoot)(inboxHost);
			const paint = () => {
				applyInboxLayout(inboxHost, getImSurface());
				switchRoot.render(/* @__PURE__ */ (0, react_jsx_runtime.jsx)(YzjSurfaceSwitchPortal, {}));
				inboxRoot.render(/* @__PURE__ */ (0, react_jsx_runtime.jsx)(YzjInboxPortal, { panel }));
			};
			const place = () => {
				placeSurfaceSwitch(switchHost);
				placeInboxHost(inboxHost);
				paint();
			};
			const wait = new MutationObserver(place);
			wait.observe(document.body, {
				childList: true,
				subtree: true
			});
			const stopSel = subscribeImSelection(() => {
				applyInboxLayout(inboxHost, getImSurface());
			});
			place();
			return () => {
				wait.disconnect();
				stopSel();
				stopMark();
				switchRoot.unmount();
				inboxRoot.unmount();
				switchHost.remove();
				inboxHost.remove();
			};
		}
		//#endregion
		//#region src/client/im-canvas.ts
		/**
		* Ensure a non-blank host session is current while IM owns the center.
		* `conversation.view` (助手) only mounts off an active canvas — hero / blank
		* 「新会话」 leave the middle column empty after host-chrome hide (pitfall-054).
		*/
		function shellMounted() {
			if (typeof document === "undefined") return false;
			return document.querySelector("[data-testid=\"yzj-im-shell\"]") !== null;
		}
		function pickNonBlank(sessions) {
			const snap = sessions.list.getSnapshot();
			if (snap.phase !== "ready") return void 0;
			const byId = snap.byId ?? {};
			const seatId = peekImSeat()?.sessionId;
			if (seatId !== void 0 && byId[seatId]?.blank === false) return seatId;
			for (const id of snap.ids ?? []) if (byId[id]?.blank === false) return id;
		}
		/**
		* True when IM needs a canvas focus: surface is im, shell absent, and current
		* is missing or blank.
		*/
		function imCanvasNeedsFocus(sessions) {
			if (getImSurface() !== "im") return false;
			if (shellMounted()) return false;
			const snap = sessions.list.getSnapshot();
			if (snap.phase !== "ready") return false;
			const current = snap.current;
			if (current !== void 0 && snap.byId?.[current]?.blank === false) return false;
			return pickNonBlank(sessions) !== void 0;
		}
		/**
		* Keep one non-blank session focused while surface=im so conversation.view
		* can paint. Does not create sessions (R24 / pitfall-024); no-op when the
		* list has only blank rows. Returns disposer.
		*/
		function ensureImCanvas(sessions) {
			let lastOpened;
			const tick = () => {
				if (!imCanvasNeedsFocus(sessions)) return;
				const id = pickNonBlank(sessions);
				if (id === void 0 || id === lastOpened) return;
				lastOpened = id;
				sessions.open(id);
			};
			const stopList = sessions.list.subscribe(tick);
			const stopSel = subscribeImSelection(tick);
			tick();
			return () => {
				stopList();
				stopSel();
			};
		}
		//#endregion
		//#region src/client/index.ts
		/** Required services: the slot registry, connection transport, and sessions. */
		const inject = [
			"slots",
			"connection",
			"sessions"
		];
		function asRecord(value) {
			return typeof value === "object" && value !== null ? value : {};
		}
		function asArray(value) {
			return Array.isArray(value) ? value : [];
		}
		function asString(value) {
			return typeof value === "string" ? value : "";
		}
		/** The client session scope face (see the composer dock for the why). */
		function scopeOf(ctx, sessionId) {
			return ctx.sessions.scope(sessionId);
		}
		/** Push plain text into a session's composer draft (slash/input-insert-text). */
		function insertDraftText(actx, text) {
			const attempt = () => {
				const state = actx.get("conversation")?.input.for(actx).state.getSnapshot();
				const length = state?.draft.length ?? 0;
				const draftRev = state?.draftRev ?? 0;
				return actx.bail(actx, "slash/input-insert-text", {
					text,
					span: {
						start: length,
						end: length,
						draftRev
					}
				}) === true;
			};
			if (!attempt()) setTimeout(attempt, 80);
		}
		/**
		* Client plugin body: register the sidebar dock, the group-room workbench,
		* the keyed tool views, and the write-confirmation cards. All registrations
		* are fiber-scoped effects.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			const panelInject = {
				...createYzjPanelInject(ctx.get("connection")),
				focusBoundSession: (sessionId) => {
					const sessions = ctx.sessions;
					if (sessions === void 0 || typeof sessions.open !== "function") return;
					focusBoundSession(sessions, sessionId);
				}
			};
			const openWriteContextFor = (record) => openWriteContext(record);
			/** Session-less write face for IM confirm cards (projection already carries the record). */
			const imWrite = {
				fetchWrite: async () => void 0,
				decideWrite: async (writeId, outcome) => {
					const result = await panelInject.decideWrite(writeId, outcome);
					return result.ok && asRecord(result.value).settled === true;
				},
				openContext: openWriteContextFor,
				editDraft: () => {},
				fetchWhoami: async () => {
					const result = await panelInject.fetchWhoami();
					if (!result.ok) return "";
					return parseContactUser(result.value).name;
				},
				fetchGroups: (limit, page) => panelInject.fetchGroups(limit, page),
				fetchWorkspaces: (type) => panelInject.fetchWorkspaces(type),
				fetchDoc: (id) => panelInject.fetchDoc(id),
				fetchContact: (openId) => panelInject.fetchContact(openId)
			};
			const writeInjectOf = (sessionId) => {
				const actx = sessionId === void 0 ? void 0 : scopeOf(ctx, sessionId);
				return {
					fetchWrite: async (callId) => {
						if (sessionId === void 0) return void 0;
						const result = await panelInject.fetchWrite(sessionId, callId);
						if (!result.ok) return void 0;
						const list = asArray(asRecord(result.value).list);
						return list.length > 0 ? list[0] : void 0;
					},
					decideWrite: async (writeId, outcome) => {
						const result = await panelInject.decideWrite(writeId, outcome);
						return result.ok && asRecord(result.value).settled === true;
					},
					openContext: openWriteContextFor,
					editDraft: (text) => {
						if (actx !== void 0) insertDraftText(actx, text);
					},
					fetchWhoami: async () => {
						const result = await panelInject.fetchWhoami();
						if (!result.ok) return "";
						return parseContactUser(result.value).name;
					},
					fetchGroups: (limit, page) => panelInject.fetchGroups(limit, page),
					fetchWorkspaces: (type) => panelInject.fetchWorkspaces(type),
					fetchDoc: (id) => panelInject.fetchDoc(id),
					fetchContact: (openId) => panelInject.fetchContact(openId)
				};
			};
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "yzj",
				order: 25,
				label: "云之家",
				inject: () => panelInject
			}, YzjSettingsSection));
			ctx.effect(() => mountInbox(panelInject));
			ctx.effect(() => {
				const sessions = ctx.sessions;
				if (sessions === void 0 || typeof sessions.open !== "function") return;
				return ensureImCanvas(sessions);
			});
			ctx.slots.inject("conversation.view", () => ctx.slots.register({
				name: "conversation.view",
				id: "yzj-im",
				order: -200,
				label: "助手"
			}, bindImConversationView(panelInject, imWrite)));
			ctx.slots.inject("conversation.composer", () => ctx.slots.register({
				name: "conversation.composer",
				select: selectImComposer,
				priority: -50
			}, YzjHideHostComposer));
			applyYzjAtSource(ctx, panelInject);
			const writeNames = YZJ_WRITE_TOOL_NAMES;
			for (const toolName of YZJ_TOOL_NAMES) {
				if (writeNames.includes(toolName)) continue;
				ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
					name: "tool.call.toolview",
					key: toolName,
					inject: () => ({ openPanel: openPanelTarget })
				}, YzjToolCard));
			}
			for (const toolName of YZJ_WRITE_TOOL_NAMES) ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
				name: "tool.call.toolview",
				key: toolName,
				inject: (sessionId) => writeInjectOf(sessionId)
			}, YzjWriteToolCard));
		}
		/**
		* The 查看上下文 jump (write card): focus the IM shell when the write targets
		* a people room. Docs/calendar writes stay on the tool card (I8 — no panel).
		*/
		function openWriteContext(record) {
			const args = asRecord(record.args);
			if (record.domain !== "im") return;
			const groupId = asString(args.groupId);
			if (groupId === "") return;
			const replyTarget = asString(args.replyMsgId);
			openPanelTarget({
				kind: "group",
				groupId
			}, replyTarget === "" ? void 0 : replyTarget);
		}
		//#endregion
		exports.apply = apply;
		exports.bindAndFocusGroup = bindAndFocusGroup;
		exports.createYzjPanelInject = createYzjPanelInject;
		exports.focusBoundSession = focusBoundSession;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map