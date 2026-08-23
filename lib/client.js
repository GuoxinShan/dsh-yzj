window.__ModuleLoader__.load({
	id: "@dsh-yzj/bundle/ui-yzj",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react = require("react");
		let react_dom_client = require("react-dom/client");
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");
		let react_dom = require("react-dom");
		//#region \0dsh-css:/Users/guoxinshan/dev/dsh-yzj/packages/ui-yzj/src/client/cards.module.css.mjs
		const css$8 = ".bCjfTG_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:10px;flex-direction:column;gap:6px;min-width:0;padding:10px 12px;font-size:14px;line-height:20px;display:flex}.bCjfTG_errorCard{border-color:var(--dsw-static-red-500)}.bCjfTG_header{align-items:center;gap:8px;min-width:0;display:flex}.bCjfTG_iconBox{background:var(--dsw-static-deepseek-100);width:28px;height:28px;color:var(--dsw-static-deepseek-600);border-radius:8px;flex:none;justify-content:center;align-items:center;display:inline-flex}.bCjfTG_title{text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:600;overflow:hidden}.bCjfTG_tag{background:var(--dsw-static-deepseek-100);color:var(--dsw-static-deepseek-600);border-radius:999px;flex:none;margin-left:auto;padding:0 8px;font-size:11px;line-height:18px}.bCjfTG_tagRun{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary)}.bCjfTG_tagFail{background:var(--dsw-static-red-100);color:var(--dsw-static-red-500);font-weight:600}.bCjfTG_rowWrap{align-items:center;gap:6px;min-width:0;display:flex}.bCjfTG_rowWrap>*{flex:1;min-width:0}.bCjfTG_rowWrap .bCjfTG_link{flex:none}.bCjfTG_rows{flex-direction:column;gap:4px;max-height:260px;display:flex;overflow:auto}.bCjfTG_row{background:var(--dsw-alias-bg-base);border-radius:8px;flex-direction:column;gap:1px;min-width:0;padding:5px 8px;display:flex}.bCjfTG_rowTitle{text-overflow:ellipsis;white-space:nowrap;align-items:center;gap:6px;min-width:0;font-weight:500;display:flex;overflow:hidden}.bCjfTG_rowSub{color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:16px;overflow:hidden}.bCjfTG_rowId{color:var(--dsw-alias-label-tertiary);flex:none;font-size:11px}.bCjfTG_avatar{object-fit:cover;border-radius:50%;flex:none;width:20px;height:20px}.bCjfTG_avatarFallback{background:var(--dsw-static-deepseek-100);width:20px;height:20px;color:var(--dsw-static-deepseek-600);border-radius:50%;flex:none;justify-content:center;align-items:center;font-size:12px;font-weight:600;display:inline-flex}.bCjfTG_link{color:var(--dsw-static-deepseek-500);text-overflow:ellipsis;white-space:nowrap;text-decoration:none;overflow:hidden}.bCjfTG_link:hover{text-decoration:underline}.bCjfTG_jump{color:var(--dsw-static-deepseek-500);cursor:pointer;transition:background-color .12s var(--ds-ease-in-out,ease);background:0 0;border:none;border-radius:6px;flex:none;padding:2px 8px;font-size:12px;line-height:16px}.bCjfTG_jump:hover{background:var(--dsw-static-deepseek-100)}.bCjfTG_text{color:var(--dsw-alias-label-secondary);white-space:pre-wrap;word-break:break-word;max-height:200px;font-size:13px;line-height:18px;overflow:auto}.bCjfTG_strongCard{border-color:var(--dsw-static-red-500);background:var(--dsw-alias-interactive-bg-hover-danger)}.bCjfTG_tagStrong{background:var(--dsw-static-red-100);color:var(--dsw-static-red-500);font-weight:600}.bCjfTG_fullText{white-space:pre-wrap;word-break:break-word;background:var(--dsw-alias-bg-base);border-radius:8px;max-height:180px;padding:6px 8px;font-size:13px;line-height:18px;overflow:auto}.bCjfTG_actions{flex-wrap:wrap;gap:6px;padding-top:2px;display:flex}.bCjfTG_action,.bCjfTG_actionPrimary{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);cursor:pointer;transition:background-color .12s var(--ds-ease-in-out,ease), border-color .12s var(--ds-ease-in-out,ease);border-radius:8px;padding:5px 14px;font-size:12px;line-height:16px}.bCjfTG_action:hover{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l3)}.bCjfTG_actionPrimary{background:var(--dsw-alias-button-info-fill);color:var(--dsw-alias-label-primary-foreground);border-color:#0000;font-weight:600}.bCjfTG_actionPrimary:hover{background:var(--dsw-alias-button-info-hover);border-color:#0000}.bCjfTG_writeId{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;flex:none;margin-left:auto;font-size:10px}.bCjfTG_ccIdentity{color:var(--dsw-alias-label-secondary);padding:2px 8px 0;font-size:12px;line-height:16px}.bCjfTG_ccRefs{flex-wrap:wrap;align-items:center;gap:6px;padding:0 8px;display:flex}.bCjfTG_ccRefsLabel{color:var(--dsw-alias-label-tertiary);flex:none;font-size:11px}.bCjfTG_miniChip{background:var(--dsw-static-deepseek-100);color:var(--dsw-static-deepseek-600);border-radius:999px;flex:none;padding:2px 10px;font-size:11px;line-height:16px}.bCjfTG_terminalCancel{border-color:var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-1);opacity:.85}";
		const tagId$8 = "@dsh-yzj/bundle/ui-yzj/cards.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$8) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@dsh-yzj/bundle/ui-yzj";
			tag.dataset.pluginCss = tagId$8;
			tag.textContent = css$8;
			document.head.appendChild(tag);
		}
		var cards_module_css_default = {
			"ccRefs": "bCjfTG_ccRefs",
			"fullText": "bCjfTG_fullText",
			"avatar": "bCjfTG_avatar",
			"jump": "bCjfTG_jump",
			"rowTitle": "bCjfTG_rowTitle",
			"text": "bCjfTG_text",
			"terminalCancel": "bCjfTG_terminalCancel",
			"tagRun": "bCjfTG_tagRun",
			"writeId": "bCjfTG_writeId",
			"ccRefsLabel": "bCjfTG_ccRefsLabel",
			"card": "bCjfTG_card",
			"errorCard": "bCjfTG_errorCard",
			"rows": "bCjfTG_rows",
			"strongCard": "bCjfTG_strongCard",
			"row": "bCjfTG_row",
			"rowId": "bCjfTG_rowId",
			"iconBox": "bCjfTG_iconBox",
			"miniChip": "bCjfTG_miniChip",
			"actions": "bCjfTG_actions",
			"tagStrong": "bCjfTG_tagStrong",
			"header": "bCjfTG_header",
			"rowSub": "bCjfTG_rowSub",
			"avatarFallback": "bCjfTG_avatarFallback",
			"action": "bCjfTG_action",
			"tag": "bCjfTG_tag",
			"actionPrimary": "bCjfTG_actionPrimary",
			"tagFail": "bCjfTG_tagFail",
			"link": "bCjfTG_link",
			"ccIdentity": "bCjfTG_ccIdentity",
			"rowWrap": "bCjfTG_rowWrap",
			"title": "bCjfTG_title"
		};
		//#endregion
		//#region lib/types/client/cards.js
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
			"yzj_im_message_list",
			"yzj_im_group_recent",
			"yzj_im_group_search",
			"yzj_im_group_create",
			"yzj_im_group_members_add",
			"yzj_im_group_members_remove",
			"yzj_file_upload",
			"yzj_file_download",
			"yzj_todo_list",
			"yzj_todo_create",
			"yzj_todo_update",
			"yzj_todo_complete",
			"yzj_advance_list",
			"yzj_advance_get",
			"yzj_advance_inspect",
			"yzj_advance_scan",
			"yzj_advance_create",
			"yzj_advance_feed",
			"memory_observe",
			"memory_read",
			"memory_search",
			"memory_dream_load",
			"memory_dream_apply"
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
			yzj_im_message_list: "聊天记录",
			yzj_im_group_recent: "最近会话",
			yzj_im_group_search: "搜索群组",
			yzj_im_group_create: "创建群组",
			yzj_im_group_members_add: "拉人进群",
			yzj_im_group_members_remove: "移出群成员",
			yzj_file_upload: "上传文件",
			yzj_file_download: "下载文件",
			yzj_todo_list: "待办列表",
			yzj_todo_create: "新建待办",
			yzj_todo_update: "更新待办",
			yzj_todo_complete: "完成待办",
			yzj_advance_list: "推进队列",
			yzj_advance_get: "推进详情",
			yzj_advance_inspect: "比对材料",
			yzj_advance_scan: "巡检扫描",
			yzj_advance_create: "立项推进事项",
			yzj_advance_feed: "喂入事元",
			memory_observe: "记录观察",
			memory_read: "读取记忆",
			memory_search: "检索记忆",
			memory_dream_load: "固化加载",
			memory_dream_apply: "固化应用"
		};
		function asRecord$20(value) {
			return typeof value === "object" && value !== null ? value : {};
		}
		function asString$14(value) {
			return typeof value === "string" ? value : "";
		}
		function asArray$12(value) {
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
			return (0, react_jsx_runtime.jsxs)("div", {
				className: cards_module_css_default.row,
				children: [(0, react_jsx_runtime.jsx)("div", {
					className: cards_module_css_default.rowTitle,
					children: title
				}), sub !== "" && (0, react_jsx_runtime.jsx)("div", {
					className: cards_module_css_default.rowSub,
					children: sub
				})]
			}, key);
		}
		function linkRow(url, label, key) {
			return (0, react_jsx_runtime.jsx)("a", {
				className: cards_module_css_default.link,
				href: url,
				target: "_blank",
				rel: "noreferrer",
				children: label
			}, key);
		}
		/** Ghost jump button: opens the floating panel at this item. */
		function jumpRow(label, onClick, key) {
			return (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: cards_module_css_default.jump,
				onClick,
				children: label
			}, key);
		}
		/** Generic list body from title/sub key lists (ids never displayed). */
		function listRows(list, titleKeys, subKeys) {
			return (0, react_jsx_runtime.jsx)("div", {
				className: cards_module_css_default.rows,
				children: list.map((item, index) => {
					const node = asRecord$20(item);
					const title = titleKeys.map((key) => field(node, key)).find((value) => value !== "") ?? "";
					const sub = subKeys.map((key) => field(node, key)).filter((value) => value !== "").join(" · ");
					return row$1(title === "" ? `第 ${index + 1} 项` : title, sub, `x${index}`);
				})
			});
		}
		/** Workspace/doc node sub-line. */
		function nodeSub(node) {
			const suffix = asString$14(node.fileSuffix);
			const updated = asString$14(node.updateTime).slice(0, 10);
			return [suffix === "" ? "" : suffix === "dbt" ? "多维表格" : "在线文档", updated].filter((part) => part !== "").join(" · ");
		}
		/** Doc-domain body (workspaces, doc lists, doc records). */
		function DocBody(meta, openPanel, listKind) {
			const list = asArray$12(meta.list);
			if (list.length > 0) return (0, react_jsx_runtime.jsx)("div", {
				className: cards_module_css_default.rows,
				children: list.map((item, index) => {
					const node = asRecord$20(item);
					const name = asString$14(node.name) !== "" ? asString$14(node.name) : asString$14(node.title);
					const kind = asNumber(node.visibility) === 2 ? "个人" : "";
					const url = asString$14(node.openWebUrl);
					const id = asString$14(node.id);
					const jump = listKind === "workspace" ? id !== "" ? jumpRow("查看", () => openPanel({
						kind: "workspace",
						workspaceId: id
					}), `j${index}`) : null : id !== "" ? jumpRow("查看", () => openPanel({
						kind: "doc",
						docId: id
					}), `j${index}`) : null;
					return (0, react_jsx_runtime.jsxs)("div", {
						className: cards_module_css_default.rowWrap,
						children: [
							row$1(`${name}${kind === "" ? "" : ` · ${kind}`}`, nodeSub(node), `n${index}`),
							jump,
							url !== "" && linkRow(url, "打开", `l${index}`)
						]
					}, `n${index}`);
				})
			});
			const record = asRecord$20(meta.record);
			const title = asString$14(record.title) || asString$14(record.name);
			const link = asString$14(record.openWebUrl);
			const id = asString$14(record.id);
			if (title !== "") {
				const suffix = asString$14(record.fileSuffix);
				const perm = typeof record.permissionLevel === "number" ? {
					1: "可管理",
					2: "可编辑",
					3: "可查看",
					9: "无权限"
				}[record.permissionLevel] : void 0;
				const sub = [
					suffix === "dbt" ? "多维表格" : suffix === "otl" ? "在线文档" : "",
					perm ?? "",
					asString$14(record.creatorName),
					asString$14(record.updateTime).slice(0, 10)
				].filter((part) => part !== "").join(" · ");
				return (0, react_jsx_runtime.jsx)("div", {
					className: cards_module_css_default.rows,
					children: (0, react_jsx_runtime.jsxs)("div", {
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
			const blocks = asArray$12(meta.list);
			if (blocks.length === 0) return null;
			return (0, react_jsx_runtime.jsx)("div", {
				className: cards_module_css_default.rows,
				children: blocks.map((item, index) => {
					const block = asRecord$20(item);
					const type = asString$14(block.type);
					const content = asString$14(block.content).replace(/\s+/g, " ").slice(0, 80);
					return row$1(content === "" ? "(空块)" : content, type === "heading" ? "标题" : type === "paragraph" ? "段落" : type === "code" ? "代码" : type === "text" ? "文本" : type === "" ? "" : type, `b${index}`);
				})
			});
		}
		/** Sheet-domain body (schema, table structure, records). */
		function SheetBody(meta) {
			const sheets = asArray$12(asRecord$20(meta.schema).sheets);
			if (sheets.length > 0) return (0, react_jsx_runtime.jsx)("div", {
				className: cards_module_css_default.rows,
				children: sheets.map((item, index) => {
					const table = asRecord$20(item);
					const fields = asArray$12(table.fields).map((field) => asString$14(asRecord$20(field).name)).filter((name) => name !== "");
					return row$1(asString$14(table.name), fields.length === 0 ? "" : `字段：${fields.join(" / ")}`, `t${index}`);
				})
			});
			const table = asRecord$20(meta.table);
			if (asString$14(table.name) !== "") {
				const fields = asArray$12(table.fields).map((field) => asString$14(asRecord$20(field).name)).filter((name) => name !== "");
				return (0, react_jsx_runtime.jsx)("div", {
					className: cards_module_css_default.rows,
					children: row$1(asString$14(table.name), fields.length === 0 ? "" : `字段：${fields.join(" / ")}`, "t")
				});
			}
			const records = asArray$12(meta.list);
			if (records.length > 0) return (0, react_jsx_runtime.jsx)("div", {
				className: cards_module_css_default.rows,
				children: records.map((item, index) => {
					const record = asRecord$20(item);
					const fields = asRecord$20(record.fieldsValue ?? record.fields);
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
			const events = asArray$12(meta.list);
			if (events.length === 0) return null;
			const clock = (ms) => {
				if (typeof ms !== "number") return "";
				const date = new Date(ms);
				const pad = (n) => String(n).padStart(2, "0");
				return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
			};
			return (0, react_jsx_runtime.jsx)("div", {
				className: cards_module_css_default.rows,
				children: events.map((item, index) => {
					const event = asRecord$20(item);
					const start = clock(event.startDate);
					const end = clock(event.endDate);
					const time = start === "" ? "" : `${start}${end === "" ? "" : ` → ${end}`}`;
					const person = asString$14(event.personName);
					const id = asString$14(event.id);
					const startMs = typeof event.startDate === "number" ? event.startDate : 0;
					return (0, react_jsx_runtime.jsxs)("div", {
						className: cards_module_css_default.rowWrap,
						children: [row$1(asString$14(event.title), [time, person].filter((part) => part !== "").join(" · "), `e${index}`), id !== "" && startMs > 0 && jumpRow("查看", () => openPanel({
							kind: "event",
							event: {
								id,
								startDate: startMs,
								title: asString$14(event.title)
							}
						}), `j${index}`)]
					}, `e${index}`);
				})
			});
		}
		/** IM-domain body (messages / recent groups). */
		function ImBody(meta, openPanel) {
			const messages = asArray$12(meta.list);
			if (messages.length > 0 && asString$14(asRecord$20(messages[0]).sendTime) !== "") return (0, react_jsx_runtime.jsx)("div", {
				className: cards_module_css_default.rows,
				children: messages.map((item, index) => {
					const message = asRecord$20(item);
					const time = asString$14(message.sendTime).slice(5, 16);
					const content = asString$14(message.content);
					const reply = asString$14(asRecord$20(message.param).replySummary);
					return row$1(content === "" ? "(文件/图片消息)" : content, [time, reply === "" ? "" : `↳ ${reply}`].filter((part) => part !== "").join(" · "), `m${index}`);
				})
			});
			const groups = messages;
			if (groups.length > 0) return (0, react_jsx_runtime.jsx)("div", {
				className: cards_module_css_default.rows,
				children: groups.map((item, index) => {
					const group = asRecord$20(item);
					const unread = asNumber(group.unreadCount);
					const last = asString$14(asRecord$20(group.lastMsg).content);
					const groupId = asString$14(group.groupId);
					return (0, react_jsx_runtime.jsxs)("div", {
						className: cards_module_css_default.rowWrap,
						children: [row$1(asString$14(group.groupName), [unread !== void 0 && unread > 0 ? `未读 ${unread}` : "", last.replace(/\s+/g, " ").slice(0, 40)].filter((part) => part !== "").join(" · "), `g${index}`), groupId !== "" && jumpRow("查看", () => openPanel({
							kind: "group",
							groupId
						}), `j${index}`)]
					}, `g${index}`);
				})
			});
			return null;
		}
		/** Todo-domain body: list rows or one action summary, ids never shown. */
		function TodoBody(meta, toolName) {
			const statusLabel = {
				pending: "待办",
				in_progress: "进行中",
				done: "已完成"
			};
			if (toolName === "yzj_todo_list") {
				if (meta.ready === false) return (0, react_jsx_runtime.jsx)("div", {
					className: cards_module_css_default.rows,
					children: row$1("任务库未开通", "创建第一条待办时会自动开通", "np")
				});
				const list = asArray$12(meta.list);
				if (list.length === 0) return (0, react_jsx_runtime.jsx)("div", {
					className: cards_module_css_default.rows,
					children: row$1("无匹配待办", "", "empty")
				});
				return (0, react_jsx_runtime.jsx)("div", {
					className: cards_module_css_default.rows,
					children: list.map((item, index) => {
						const todo = asRecord$20(item);
						const tags = asArray$12(todo.tags).filter((tag) => typeof tag === "string");
						const overdue = todo.overdue === true;
						const status = statusLabel[asString$14(todo.status)] ?? asString$14(todo.status);
						const sub = [
							asString$14(todo.ddl) === "" ? "" : `${overdue ? "逾期 " : ""}DDL ${asString$14(todo.ddl)}`,
							asString$14(todo.assignee) === "" ? "" : `@${asString$14(todo.assignee)}`,
							tags.length === 0 ? "" : tags.map((tag) => `#${tag}`).join(" ")
						].filter((part) => part !== "").join(" · ");
						return row$1(asString$14(todo.title) === "" ? "(无标题)" : asString$14(todo.title), [status, sub].filter((part) => part !== "").join(" · "), `t${index}`);
					})
				});
			}
			const rowsOut = [];
			const title = asString$14(meta.title);
			const tags = asArray$12(meta.tags).filter((tag) => typeof tag === "string");
			const sub = [asString$14(meta.ddl) === "" ? "" : `DDL ${asString$14(meta.ddl)}`, tags.length === 0 ? "" : tags.map((tag) => `#${tag}`).join(" ")].filter((part) => part !== "").join(" · ");
			if (toolName === "yzj_todo_create") rowsOut.push(row$1(meta.idempotentHit === true ? `已存在：${title}` : `已创建：${title}`, sub, "c"));
			else if (toolName === "yzj_todo_complete") rowsOut.push(row$1(`已完成：${title}`, sub, "d"));
			else {
				const changes = asArray$12(meta.changes).filter((change) => typeof change === "string");
				rowsOut.push(row$1(`已更新：${title}`, changes.join("；"), "u"));
			}
			const link = asString$14(asRecord$20(meta.library).link);
			if (link !== "") rowsOut.push(linkRow(link, "打开任务库", "l"));
			return (0, react_jsx_runtime.jsx)("div", {
				className: cards_module_css_default.rows,
				children: rowsOut
			});
		}
		/** Stage label for advance cards (six-stage machine, ai-advance-design §2). */
		const ADVANCE_STAGE_LABEL = {
			"draft": "草稿",
			"running": "推进中",
			"decision-needed": "待决定",
			"updated": "已更新",
			"ready-for-review": "待验收",
			"completed": "已完成"
		};
		/** Advance-domain body: queue rows, one item detail, or one feed summary. */
		function AdvanceBody(meta, toolName, jump) {
			const stageOf = (value) => ADVANCE_STAGE_LABEL[asString$14(value)] ?? asString$14(value);
			if (toolName === "yzj_advance_list") {
				if (meta.ready === false) return (0, react_jsx_runtime.jsx)("div", {
					className: cards_module_css_default.rows,
					children: row$1("推进看板未开通", "立项第一个推进事项时会自动开通", "np")
				});
				const list = asArray$12(meta.list);
				if (list.length === 0) return (0, react_jsx_runtime.jsx)("div", {
					className: cards_module_css_default.rows,
					children: row$1("无匹配事项", "", "empty")
				});
				return (0, react_jsx_runtime.jsxs)("div", {
					className: cards_module_css_default.rows,
					children: [list.map((entry, index) => {
						const item = asRecord$20(entry);
						const sub = [
							stageOf(item.stage),
							asString$14(item.targetDate) === "" ? "" : `目标 ${asString$14(item.targetDate)}`,
							asString$14(item.assignee) === "" ? "" : `@${asString$14(item.assignee)}`,
							asString$14(item.latest)
						].filter((part) => part !== "").join(" · ");
						return row$1(asString$14(item.title) === "" ? "(无标题)" : asString$14(item.title), sub, `a${index}`);
					}), jumpRow("打开推进看板", () => {
						jump({ kind: "advance" });
					}, "jump")]
				});
			}
			if (toolName === "yzj_advance_get") {
				const item = asRecord$20(meta.item);
				const rowsOut = [row$1(asString$14(item.title), [stageOf(item.stage), asString$14(item.goal)].filter((part) => part !== "").join(" · "), "head")];
				const entries = asArray$12(meta.entries);
				for (let index = 0; index < Math.min(entries.length, 5); index += 1) {
					const entry = asRecord$20(entries[index]);
					rowsOut.push(row$1(`${asString$14(entry.at)} ${asString$14(entry.changeType)}`, asString$14(entry.summary), `e${index}`));
				}
				const total = asNumber(meta.entryTotal) ?? entries.length;
				rowsOut.push(row$1(`事元 ${total} 条`, "", "total"));
				rowsOut.push(jumpRow("打开推进看板", () => {
					jump({ kind: "advance" });
				}, "jump"));
				return (0, react_jsx_runtime.jsx)("div", {
					className: cards_module_css_default.rows,
					children: rowsOut
				});
			}
			if (toolName === "yzj_advance_inspect") {
				const rowsOut = [row$1(asString$14(meta.mode) === "review" ? "验收辅助材料" : "比对材料", asString$14(meta.signals), "head")];
				const list = asArray$12(meta.list);
				for (let index = 0; index < Math.min(list.length, 8); index += 1) {
					const item = asRecord$20(list[index]);
					const next = asArray$12(item.next).map((part) => asString$14(part)).filter((part) => part !== "").join(" / ");
					rowsOut.push(row$1(asString$14(item.title) === "" ? asString$14(item.advanceId) : asString$14(item.title), [stageOf(item.stage), next === "" ? "" : `下一阶段 ${next}`].filter((part) => part !== "").join(" · "), `i${index}`));
				}
				rowsOut.push(jumpRow("打开推进看板", () => {
					jump({ kind: "advance" });
				}, "jump"));
				return (0, react_jsx_runtime.jsx)("div", {
					className: cards_module_css_default.rows,
					children: rowsOut
				});
			}
			if (toolName === "yzj_advance_scan") {
				const groups = asArray$12(meta.groups);
				const signals = asArray$12(meta.signals);
				const rowsOut = [row$1(signals.length === 0 ? "无新信号，静默" : `${signals.length} 条新信号`, groups.map((row) => {
					const group = asRecord$20(row);
					if (asString$14(group.error) !== "") return `${asString$14(group.groupName)}：${asString$14(group.error)}`;
					if (group.baseline === true) return `${asString$14(group.groupName)}：基线`;
					return `${asString$14(group.groupName)}：${typeof group.newCount === "number" ? group.newCount : 0} 条`;
				}).join(" · "), "head")];
				for (let index = 0; index < Math.min(signals.length, 5); index += 1) {
					const signal = asRecord$20(signals[index]);
					rowsOut.push(row$1(asString$14(signal.groupName), asString$14(signal.content), `s${index}`));
				}
				rowsOut.push(jumpRow("打开推进看板", () => {
					jump({ kind: "advance" });
				}, "jump"));
				return (0, react_jsx_runtime.jsx)("div", {
					className: cards_module_css_default.rows,
					children: rowsOut
				});
			}
			const rowsOut = [];
			if (toolName === "yzj_advance_create") {
				const item = asRecord$20(meta.item);
				rowsOut.push(row$1(meta.idempotentHit === true ? `已存在：${asString$14(item.title)}` : `已立项：${asString$14(item.title)}`, [stageOf(item.stage), asString$14(item.goal)].filter((part) => part !== "").join(" · "), "c"));
			} else if (meta.idempotentHit === true) rowsOut.push(row$1(`同源去重：${asString$14(meta.summary)}`, "未追加事元", "f"));
			else {
				const flow = asString$14(meta.stageFrom) !== "" && asString$14(meta.stageFrom) !== asString$14(meta.stageTo) ? `${stageOf(meta.stageFrom)} → ${stageOf(meta.stageTo)}` : "";
				rowsOut.push(row$1(`${asString$14(meta.changeType)}：${asString$14(meta.summary)}`, [flow, asString$14(meta.detail).split("\n").join("；")].filter((part) => part !== "").join(" · "), "f"));
			}
			const link = asString$14(asRecord$20(meta.library).link);
			if (link !== "") rowsOut.push(linkRow(link, "打开推进库", "l"));
			rowsOut.push(jumpRow("打开推进看板", () => {
				jump({ kind: "advance" });
			}, "jump"));
			return (0, react_jsx_runtime.jsx)("div", {
				className: cards_module_css_default.rows,
				children: rowsOut
			});
		}
		/** Memory-vault body: observe confirmation, scope counts, search hits, dream report. */
		function MemoryBody(meta, toolName) {
			const rowsOut = [];
			if (toolName === "memory_observe") rowsOut.push(row$1(meta.duplicate === true ? "这条已经在记忆里" : "已记入观察草稿区", `open ${typeof meta.openCount === "number" ? meta.openCount : 0}/${typeof meta.capacity === "number" ? meta.capacity : 0}，等待 dream 固化`, "obs"));
			else if (toolName === "memory_read" || toolName === "memory_dream_load") {
				const sections = asArray$12(meta.sections);
				const entities = asArray$12(meta.entities);
				const observations = asArray$12(meta.observations);
				rowsOut.push(row$1(`${sections.length} 段落 · ${entities.length} 实体 · ${observations.length} 待固化`, `archived ${typeof meta.archivedCount === "number" ? meta.archivedCount : 0} · 注入上限 ${typeof meta.cap === "number" ? meta.cap : 0} 字符`, "scope"));
				for (const [index, item] of sections.slice(0, 5).entries()) {
					const section = asRecord$20(item);
					rowsOut.push(row$1(`段 · ${asString$14(section.title) || asString$14(section.name)}`, asString$14(section.excerpt), `s${index}`));
				}
				if (sections.length > 5) rowsOut.push(row$1(`…其余 ${sections.length - 5} 段`, "", "smore"));
			} else if (toolName === "memory_search") {
				const hits = asArray$12(meta.hits);
				if (hits.length === 0) rowsOut.push(row$1("无匹配记忆", "", "empty"));
				for (const [index, item] of hits.slice(0, 8).entries()) {
					const hit = asRecord$20(item);
					rowsOut.push(row$1(`${{
						section: "段",
						entity: "实体",
						observation: "观察"
					}[asString$14(hit.kind)] ?? asString$14(hit.kind)} · ${asString$14(hit.ref)}`, asString$14(hit.line), `h${index}`));
				}
				if (hits.length > 8) rowsOut.push(row$1(`…其余 ${hits.length - 8} 条命中`, "", "hmore"));
			} else if (toolName === "memory_dream_apply") {
				const counts = asRecord$20(meta.counts);
				const parts = [
					"promoted",
					"dropped",
					"sectionsWritten",
					"entitiesWritten",
					"rejected"
				].map((key) => `${{
					promoted: "提升",
					dropped: "丢弃",
					sectionsWritten: "段写",
					entitiesWritten: "实体写",
					rejected: "拒绝"
				}[key] ?? key} ${typeof counts[key] === "number" ? counts[key] : 0}`).join(" · ");
				rowsOut.push(row$1(`固化完成 ${asString$14(meta.logId)}`, parts, "dream"));
				for (const [index, item] of asArray$12(meta.results).slice(0, 5).entries()) {
					const result = asRecord$20(item);
					rowsOut.push(row$1(`${result.ok === true ? "✓" : "✗"} ${asString$14(result.decision)} — ${asString$14(result.detail)}`, asString$14(result.reason), `r${index}`));
				}
			}
			return rowsOut.length === 0 ? null : (0, react_jsx_runtime.jsx)("div", {
				className: cards_module_css_default.rows,
				children: rowsOut
			});
		}
		/** Contact-domain body (whoami / search / details). */ function ContactBody(meta) {
			const list = asArray$12(meta.list);
			const record = asRecord$20(meta.record);
			const users = list.length > 0 ? list : [record];
			if (users.length === 0 || list.length === 0 && Object.keys(record).length === 0) return null;
			return (0, react_jsx_runtime.jsx)("div", {
				className: cards_module_css_default.rows,
				children: users.map((item, index) => {
					const user = asRecord$20(item);
					const name = asString$14(user.name);
					const sub = [asString$14(user.department ?? user.fulldepartment), asString$14(user.jobTitle)].filter((part) => part !== "").join(" · ");
					return (0, react_jsx_runtime.jsxs)("div", {
						className: cards_module_css_default.row,
						children: [(0, react_jsx_runtime.jsxs)("div", {
							className: cards_module_css_default.rowTitle,
							children: [typeof user.photoUrl === "string" && user.photoUrl !== "" ? (0, react_jsx_runtime.jsx)("img", {
								className: cards_module_css_default.avatar,
								src: user.photoUrl,
								alt: "",
								referrerPolicy: "no-referrer"
							}) : (0, react_jsx_runtime.jsx)("span", {
								className: cards_module_css_default.avatarFallback,
								children: name.slice(0, 1)
							}), (0, react_jsx_runtime.jsx)("span", { children: name })]
						}), sub !== "" && (0, react_jsx_runtime.jsx)("div", {
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
			const link = asString$14(meta.link);
			const url = asString$14(meta.url);
			const output = asString$14(meta.output);
			const recordIds = asArray$12(meta.recordIds);
			const push = (title, sub, key) => {
				rowsOut.push(row$1(title, sub, key));
			};
			if (toolName === "yzj_im_message_send") push("消息已发送", "", "sent");
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
			return (0, react_jsx_runtime.jsx)("div", {
				className: cards_module_css_default.rows,
				children: rowsOut
			});
		}
		/** Family icon for the card header. */
		function familyIcon(toolName) {
			if (toolName.startsWith("yzj_im_")) return toolName === "yzj_im_message_send" ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSendOutline14, {}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconNewChatOutline16, {});
			if (toolName.startsWith("yzj_contact_") || toolName === "yzj_whoami") return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconUserOutline16, {});
			if (toolName.startsWith("yzj_sheet_")) return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconDataOutline16, {});
			if (toolName.startsWith("yzj_todo_")) return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconListPenOutline16, {});
			if (toolName.startsWith("yzj_advance_")) return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChecklistOutline14, {});
			if (toolName.startsWith("yzj_calendar_")) return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChecklistOutline14, {});
			if (toolName.startsWith("yzj_file_")) return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutline14, {});
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenOutline16, {});
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
			if (!("kind" in block) || block.kind !== "tool-result") return (0, react_jsx_runtime.jsx)("div", {
				className: cards_module_css_default.card,
				children: (0, react_jsx_runtime.jsxs)("div", {
					className: cards_module_css_default.header,
					children: [
						(0, react_jsx_runtime.jsx)("span", {
							className: cards_module_css_default.iconBox,
							children: familyIcon(toolName)
						}),
						(0, react_jsx_runtime.jsx)("span", {
							className: cards_module_css_default.title,
							children: family
						}),
						(0, react_jsx_runtime.jsx)("span", {
							className: `${cards_module_css_default.tag} ${cards_module_css_default.tagRun}`,
							children: "执行中"
						})
					]
				})
			});
			if (block.isError) return (0, react_jsx_runtime.jsxs)("div", {
				className: `${cards_module_css_default.card} ${cards_module_css_default.errorCard}`,
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: cards_module_css_default.header,
					children: [
						(0, react_jsx_runtime.jsx)("span", {
							className: cards_module_css_default.iconBox,
							children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseFill14, {})
						}),
						(0, react_jsx_runtime.jsx)("span", {
							className: cards_module_css_default.title,
							children: family
						}),
						(0, react_jsx_runtime.jsx)("span", {
							className: `${cards_module_css_default.tag} ${cards_module_css_default.tagFail}`,
							children: "失败"
						})
					]
				}), (0, react_jsx_runtime.jsx)("div", {
					className: cards_module_css_default.text,
					children: resultText(block)
				})]
			});
			const meta = asRecord$20(block.meta);
			let body = null;
			if (toolName === "yzj_doc_block_list") body = BlockBody(meta);
			else if (toolName === "yzj_calendar_event_participants") body = listRows(asArray$12(meta.list), ["name"], ["jobTitle", "department"]);
			else if (toolName === "yzj_calendar_room_find") body = listRows(asArray$12(meta.list), ["name", "title"], ["capacity", "floor"]);
			else if (toolName.startsWith("yzj_doc_")) body = DocBody(meta, jump, toolName === "yzj_doc_workspace_list" || toolName === "yzj_doc_workspace_get" ? "workspace" : "doc");
			else if (toolName.startsWith("yzj_sheet_")) body = SheetBody(meta);
			else if (toolName.startsWith("yzj_calendar_")) body = CalendarBody(meta, jump);
			else if (toolName.startsWith("yzj_todo_")) body = TodoBody(meta, toolName);
			else if (toolName.startsWith("yzj_advance_")) body = AdvanceBody(meta, toolName, jump);
			else if (toolName.startsWith("yzj_im_")) body = ImBody(meta, jump);
			else if (toolName.startsWith("yzj_contact_") || toolName === "yzj_whoami") body = ContactBody(meta);
			else if (toolName.startsWith("memory_")) body = MemoryBody(meta, toolName);
			if (body === null) body = ActionBody(meta, toolName);
			return (0, react_jsx_runtime.jsxs)("div", {
				className: cards_module_css_default.card,
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: cards_module_css_default.header,
					children: [
						(0, react_jsx_runtime.jsx)("span", {
							className: cards_module_css_default.iconBox,
							children: familyIcon(toolName)
						}),
						(0, react_jsx_runtime.jsx)("span", {
							className: cards_module_css_default.title,
							children: family
						}),
						(0, react_jsx_runtime.jsx)("span", {
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
		//#region lib/types/handoff-digest.js
		/**
		* Default ticks: the newest few user/assistant lines (visible digest).
		* Never pre-select the whole transcript.
		*/
		function defaultSelectedIds(candidates, max = 4) {
			return candidates.slice(-Math.max(0, max)).map((row) => row.id);
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
		//#endregion
		//#region lib/types/client/im-seat.js
		/**
		* Last group-room seat the workbench should reopen.
		* Dock 「对话」 focuses this immediately; home-open only heals a missing host.
		*/
		let seat;
		const listeners$5 = /* @__PURE__ */ new Set();
		function emit() {
			for (const listener of listeners$5) listener();
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
		/** Subscribe to seat changes (composer / shell). */
		function subscribeImSeat(listener) {
			listeners$5.add(listener);
			return () => {
				listeners$5.delete(listener);
			};
		}
		//#endregion
		//#region lib/types/client/workbench-domain.js
		/**
		* Workbench domain bus (docs/spec/group-room-topics.md R15/R21/R31).
		* The workbench tablist writes; the group-room shell reads. Module-level so
		* the dock (sidebar inject) and overlay cover do not share a React tree.
		*/
		/** Top-bar tabs that switch {@link WorkbenchDomain} (v1.16 / R31; v1.18 +推进). */
		const WORKBENCH_TABS = [
			{
				domain: "im",
				id: "chat",
				label: "对话"
			},
			{
				domain: "todo",
				id: "todo",
				label: "待办"
			},
			{
				domain: "calendar",
				id: "calendar",
				label: "日程"
			},
			{
				domain: "docs",
				id: "docs",
				label: "知识库"
			},
			{
				domain: "advance",
				id: "advance",
				label: "推进"
			}
		];
		let current$3 = "im";
		const listeners$4 = /* @__PURE__ */ new Set();
		/** Current domain (defaults to 对话). */
		function getWorkbenchDomain() {
			return current$3;
		}
		/** Switch the workbench domain; no-op when unchanged. */
		function setWorkbenchDomain(next) {
			if (current$3 === next) return;
			current$3 = next;
			for (const listener of listeners$4) listener();
		}
		/** Subscribe to domain changes. Returns the disposer. */
		function subscribeWorkbenchDomain(listener) {
			listeners$4.add(listener);
			return () => {
				listeners$4.delete(listener);
			};
		}
		/**
		* React face for {@link getWorkbenchDomain}. Lives here so composer / dock /
		* shell share one subscription instead of each wiring useState+effect.
		*/
		function useWorkbenchDomain() {
			const [domain, setDomain] = (0, react.useState)(getWorkbenchDomain);
			(0, react.useEffect)(() => subscribeWorkbenchDomain(() => {
				setDomain(getWorkbenchDomain());
			}), []);
			return domain;
		}
		const imFocusListeners = /* @__PURE__ */ new Set();
		/** Ask the im domain to open one group, optionally anchored on a message. */
		function requestImGroupFocus(target) {
			const resolved = typeof target === "string" ? { groupId: target } : target;
			for (const listener of imFocusListeners) listener(resolved);
		}
		/** Subscribe to group-focus requests. Returns the disposer. */
		function subscribeImGroupFocus(listener) {
			imFocusListeners.add(listener);
			return () => {
				imFocusListeners.delete(listener);
			};
		}
		//#endregion
		//#region lib/types/client/workbench-overlay.js
		/**
		* Yunzhijia workbench overlay controller (R27). Opening the workbench does
		* not create or focus a DSH session — it flips an html attribute that the
		* center-column cover listens to, same family as webuiall's task board.
		*/
		const ACTIVE_ATTR = "data-dsh-yzj-active";
		const SIBLING_ATTRS = ["data-dsh-taskboard-active", "data-dsh-ssh-active"];
		const ACTIVATE_EVENT = "dsh-panel-activate";
		const PANEL_NAME = "yzj";
		let open = false;
		const listeners$3 = /* @__PURE__ */ new Set();
		function notify$1() {
			for (const listener of listeners$3) listener();
		}
		function applyDom() {
			if (typeof document === "undefined") return;
			if (open) {
				for (const attr of SIBLING_ATTRS) document.documentElement.removeAttribute(attr);
				document.documentElement.setAttribute(ACTIVE_ATTR, "");
				document.dispatchEvent(new CustomEvent(ACTIVATE_EVENT, { detail: PANEL_NAME }));
			} else document.documentElement.removeAttribute(ACTIVE_ATTR);
		}
		/** Whether the workbench cover is showing. */
		function isWorkbenchOpen() {
			return open;
		}
		/** Show the workbench cover. No-op when already open. */
		function openWorkbench() {
			if (open) return;
			open = true;
			applyDom();
			notify$1();
		}
		/** Hide the workbench cover. No-op when already closed. */
		function closeWorkbench() {
			if (!open) return;
			open = false;
			applyDom();
			notify$1();
		}
		/** Subscribe to open/close. Returns the disposer. */
		function subscribeWorkbenchOpen(listener) {
			listeners$3.add(listener);
			return () => {
				listeners$3.delete(listener);
			};
		}
		/**
		* Close the cover when another webuiall-family panel activates, or when the
		* user clicks a session / new-session row. Call from the mount lifetime.
		*/
		function bindWorkbenchDismissal() {
			if (typeof document === "undefined") return () => {};
			const onActivate = (event) => {
				if (event.detail !== PANEL_NAME && open) closeWorkbench();
			};
			const onSidebar = (event) => {
				if (!open) return;
				const target = event.target;
				if (target === null) return;
				if (target.closest("[data-dsh-yzj-entry]") !== null) return;
				if (target.closest("[class*=\"sessionRow\"], [class*=\"projectRow\"], [class*=\"searchResultRow\"], [class*=\"searchResultWorkspace\"], [class*=\"newSession\"]") !== null) closeWorkbench();
			};
			document.addEventListener(ACTIVATE_EVENT, onActivate);
			document.addEventListener("click", onSidebar, true);
			return () => {
				document.removeEventListener(ACTIVATE_EVENT, onActivate);
				document.removeEventListener("click", onSidebar, true);
			};
		}
		//#endregion
		//#region lib/types/client/view-ring.js
		/**
		* Align the harness conversation tab ring with v2.0 views.
		* Group room occupies the pane (select 「群聊」, hide the ring).
		* Topic / private / ordinary chats must select 「对话」 (writes view=chat)
		* and hide the unused 群聊 tab. Hiding the tab alone leaves a persisted
		* `view=yzj-home` mounted (pitfall-022).
		*
		* pitfall-018: harness `.tabs { display:flex }` beats `[hidden]`; hide with
		* `display:none !important` and re-run when the tablist mounts late.
		*/
		/** View kind follows the session-id prefix only — binding cannot promote. */
		function yzjViewKindFromSessionId(sessionId) {
			if (sessionId.startsWith("yzj-home-")) return "room";
			if (sessionId.startsWith("yzj-topic-")) return "topic";
			return "unbound";
		}
		function roomTabOf(root) {
			return [...root.querySelectorAll("[role=\"tab\"]")].find((tab) => tab.textContent?.trim() === "群聊");
		}
		function chatTabOf(root) {
			return [...root.querySelectorAll("[role=\"tab\"]")].find((tab) => tab.textContent?.trim() === "对话");
		}
		function hideTablist(tablist) {
			if (tablist === void 0 || tablist === null) return;
			if (tablist.getAttribute("data-yzj-ring") === "off" && tablist.style.display === "none") return;
			tablist.hidden = true;
			tablist.setAttribute("data-yzj-ring", "off");
			tablist.style.setProperty("display", "none", "important");
		}
		function showTablist(tablist) {
			if (tablist === void 0 || tablist === null) return;
			if (tablist.getAttribute("data-yzj-ring") !== "off" && !tablist.hidden) return;
			tablist.hidden = false;
			tablist.removeAttribute("data-yzj-ring");
			tablist.style.removeProperty("display");
		}
		/**
		* Sync the visible conversation tab ring to `kind`. Safe to call often:
		* clicks only when the target tab is not already selected.
		*/
		function syncYzjViewRing(kind) {
			const roomTab = roomTabOf(document);
			const chatTab = chatTabOf(document);
			const tablist = roomTab?.closest("[role=\"tablist\"]") ?? chatTab?.closest("[role=\"tablist\"]");
			if (kind === "room") {
				if (roomTab !== void 0 && roomTab.getAttribute("aria-selected") !== "true") roomTab.click();
				hideTablist(tablist);
				if (roomTab !== void 0) roomTab.hidden = false;
				return;
			}
			showTablist(tablist);
			if (roomTab !== void 0) roomTab.hidden = true;
			if (chatTab !== void 0 && chatTab.getAttribute("aria-selected") !== "true") chatTab.click();
		}
		/**
		* Keep {@link syncYzjViewRing} applied while the header lives: the tablist
		* often mounts after the first sync (pitfall-018). Once the tablist exists,
		* observe only its parent (header)—not `document.documentElement`, which
		* fires on every timeline insert.
		*/
		function watchYzjViewRing(kind) {
			syncYzjViewRing(kind);
			let observed = null;
			const observer = new MutationObserver(() => {
				syncYzjViewRing(kind);
				retarget();
			});
			const retarget = () => {
				const next = document.querySelector("[role=\"tablist\"]")?.parentElement ?? document.documentElement;
				if (next === observed) return;
				observer.disconnect();
				observed = next;
				observer.observe(next, {
					childList: true,
					subtree: true
				});
			};
			retarget();
			return () => {
				observer.disconnect();
				observed = null;
			};
		}
		/** Undo {@link syncYzjViewRing} when the session header unmounts. */
		function restoreYzjViewRing() {
			const roomTab = roomTabOf(document);
			const tablist = roomTab?.closest("[role=\"tablist\"]");
			showTablist(tablist);
			if (roomTab !== void 0) roomTab.hidden = false;
		}
		//#endregion
		//#region \0dsh-css:/Users/guoxinshan/dev/dsh-yzj/packages/ui-yzj/src/client/home.module.css.mjs
		const css$7 = "._1NmHsa_stream{flex-direction:column;flex:1 1 0;min-height:0;padding:12px 16px 24px;display:flex;overflow:auto}._1NmHsa_streamContent{flex-direction:column;gap:10px;display:flex}._1NmHsa_hint{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);border-radius:8px;padding:8px 10px;font-size:12px;line-height:18px}._1NmHsa_unbound{text-align:center;max-width:420px;color:var(--dsw-alias-label-secondary);margin:24px auto;font-size:13px;line-height:20px}._1NmHsa_row{flex-direction:row;align-items:flex-start;gap:8px;max-width:86%;display:flex}._1NmHsa_rowSelf{flex-direction:row-reverse;align-self:flex-end}._1NmHsa_rowOther{align-self:flex-start}._1NmHsa_stack{flex-direction:column;gap:4px;min-width:0;display:flex}._1NmHsa_daySep{color:var(--dsw-alias-label-tertiary);justify-content:center;margin:8px 0 4px;font-size:11px;line-height:18px;display:flex}._1NmHsa_daySep span{background:var(--dsw-alias-bg-layer-2);border-radius:999px;padding:1px 10px}._1NmHsa_meta{color:var(--dsw-alias-label-tertiary);gap:8px;font-size:11px;display:flex}._1NmHsa_bubble{white-space:pre-wrap;word-break:break-word;border-radius:10px;padding:8px 10px;font-size:14px;line-height:20px}._1NmHsa_im{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2)}._1NmHsa_imSelf{background:var(--dsw-static-deepseek-100);border-color:#0000}._1NmHsa_agent{background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2)}._1NmHsa_pending{border-color:var(--dsw-static-deepseek-500);background:var(--dsw-static-deepseek-100)}._1NmHsa_failed{border-color:var(--dsw-static-red-500)}._1NmHsa_tag{background:var(--dsw-alias-interactive-bg-hover);border-radius:999px;align-items:center;padding:0 6px;font-size:10px;font-weight:600;display:inline-flex}._1NmHsa_chrome{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);border-radius:10px;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 6px;padding:6px 8px;font-size:12px;display:flex}._1NmHsa_chromeQuiet{align-items:center;margin:0 0 4px;padding:0 2px;display:flex}._1NmHsa_chromeLink{color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;background:0 0;border:none;padding:0;font-size:12px}._1NmHsa_chromeLink:hover{color:var(--dsw-alias-label-primary)}._1NmHsa_chromeBtn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:8px;padding:4px 10px;font-size:12px;font-weight:600}._1NmHsa_chromeBtn:hover{background:var(--dsw-alias-interactive-bg-hover)}._1NmHsa_chromePrimary{background:var(--dsw-static-deepseek-500);color:#fff;border-color:#0000}._1NmHsa_modalMask{z-index:200;background:#00000059;justify-content:center;align-items:center;display:flex;position:fixed;inset:0}._1NmHsa_modal{background:var(--dsw-alias-bg-base);width:min(520px,92vw);max-height:80vh;color:var(--dsw-alias-label-primary);border-radius:12px;padding:16px;overflow:auto;box-shadow:0 16px 48px #0003}._1NmHsa_modal h3{margin:0 0 8px;font-size:16px}._1NmHsa_modal p{color:var(--dsw-alias-label-secondary);margin:0 0 12px;font-size:13px}._1NmHsa_pick{flex-direction:column;gap:6px;margin-bottom:12px;display:flex}._1NmHsa_candidate{align-items:flex-start;gap:8px;font-size:13px;line-height:18px;display:flex}._1NmHsa_actions{justify-content:flex-end;gap:8px;margin-top:12px;display:flex}._1NmHsa_topicList{flex-wrap:wrap;align-items:center;gap:6px;display:flex}._1NmHsa_topicListLabel{color:var(--dsw-alias-label-tertiary);font-size:11px;font-weight:600}._1NmHsa_kindPill{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);border-radius:999px;align-items:center;padding:2px 8px;font-size:11px;font-weight:600;display:inline-flex}._1NmHsa_topicDock{box-sizing:border-box;width:calc(100% - 2 * var(--dsh-composer-side-clearance,16px));max-width:var(--dsh-composer-card-max-width,780px);flex:none;margin:0 auto;padding:0}._1NmHsa_topicDockBtn{border:1px solid var(--dsw-alias-border-l2-darkmode-thin,var(--dsw-alias-border-l2));background:var(--dsw-specific-input-major,var(--dsw-alias-bg-base));width:100%;height:36px;box-shadow:var(--dsw-shadow-lv2,0 8px 24px #00000014);color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer;border-radius:22px;align-items:center;gap:10px;padding:4px 16px;display:flex}._1NmHsa_topicDockBtn:hover,._1NmHsa_topicDockBtn:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}._1NmHsa_topicDockLabel{flex:none;font-size:13px;font-weight:500;line-height:18px}._1NmHsa_topicDockSummary{min-width:0;color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;flex:1;font-size:12px;line-height:18px;overflow:hidden}._1NmHsa_roomComposerSeat{display:none}._1NmHsa_roomTimeline{flex-direction:column;flex:1;min-width:0;min-height:0;display:flex}._1NmHsa_roomComposerHost{flex:none}._1NmHsa_roomComposer{background:0 0;border-top:none;flex-direction:column;gap:8px;padding:8px 16px 14px;display:flex;position:relative}._1NmHsa_roomComposerCard{border:1px solid var(--dsw-alias-border-l2-darkmode-thin,var(--dsw-alias-border-l2));background:var(--dsw-specific-input-major,var(--dsw-alias-bg-base));box-shadow:var(--dsw-shadow-lv2,0 8px 24px #00000014);border-radius:22px;flex-direction:column;gap:10px;padding:10px 10px 6px;display:flex}._1NmHsa_roomComposerInput{resize:none;min-height:48px;max-height:160px;color:var(--dsw-alias-label-primary);font:inherit;background:0 0;border:none;border-radius:0;flex:1;padding:4px 10px;font-size:16px;line-height:24px}._1NmHsa_roomComposerInput:focus{outline:none}._1NmHsa_roomComposerBar{justify-content:space-between;align-items:center;gap:12px;padding:2px 6px 6px;display:flex}._1NmHsa_roomComposerTools{align-items:center;gap:14px;padding:0 2px;display:flex}._1NmHsa_roomSendCircle{background:var(--dsw-alias-button-info-fill,var(--dsw-static-deepseek-500));color:#fff;cursor:pointer;border:none;border-radius:999px;flex:none;place-items:center;width:34px;height:34px;display:grid}._1NmHsa_roomSendCircle:hover:not(:disabled){background:var(--dsw-alias-button-info-hover,var(--dsw-static-deepseek-500))}._1NmHsa_roomSendCircle:disabled{opacity:.4;cursor:default}._1NmHsa_roomToolBtn,._1NmHsa_roomReplyCancel{color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;background:0 0;border:none;border-radius:0;padding:0;font-size:12px;font-weight:400}._1NmHsa_roomToolBtn:hover,._1NmHsa_roomReplyCancel:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}._1NmHsa_roomReplyBar{border-left:2px solid var(--dsw-static-deepseek-500);background:var(--dsw-alias-bg-layer-1);border-radius:6px;align-items:center;gap:8px;padding:4px 8px;display:flex}._1NmHsa_roomReplyText{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-secondary);flex:1;font-size:12px;overflow:hidden}._1NmHsa_roomEmojiPanel{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:8px;flex-wrap:wrap;gap:4px;padding:6px;display:flex}._1NmHsa_roomEmojiBtn{cursor:pointer;background:0 0;border:none;border-radius:4px;padding:2px 4px;font-size:18px;line-height:24px}._1NmHsa_roomEmojiBtn:hover{background:var(--dsw-alias-interactive-bg-hover)}._1NmHsa_roomRow{gap:8px;max-width:86%;margin-top:10px;display:flex}._1NmHsa_roomRowMerged{margin-top:2px}._1NmHsa_roomRowSelf{flex-direction:row-reverse;align-self:flex-end}._1NmHsa_roomRowOther{align-self:flex-start}._1NmHsa_roomAvatarSlot{flex:none;width:28px}._1NmHsa_roomStack{flex-direction:column;gap:2px;min-width:0;display:flex}._1NmHsa_roomRowSelf ._1NmHsa_roomStack{align-items:flex-end}._1NmHsa_roomMeta{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}._1NmHsa_roomBubble{word-break:break-word;max-width:min(525px,82%);color:var(--dsw-alias-label-primary);flex-direction:column;align-items:stretch;padding:10px 16px;font-size:16px;line-height:24px;display:flex}._1NmHsa_roomBubbleSelf{background:var(--dsw-specific-bubble,var(--dsw-static-deepseek-50));border-radius:22px}._1NmHsa_roomBubbleOther,._1NmHsa_roomBubbleAssistant{background:var(--dsw-alias-interactive-bg-hover-solid,var(--dsw-static-neutral-bluish-75));border-radius:22px}._1NmHsa_roomClamp{-webkit-line-clamp:4;word-break:break-word;white-space:pre-wrap;-webkit-box-orient:vertical;display:-webkit-box;overflow:hidden}._1NmHsa_roomClampToggle{color:var(--dsw-alias-state-business-primary);font:inherit;cursor:pointer;background:0 0;border:none;align-self:flex-start;padding:2px 0 0;font-size:12px}._1NmHsa_roomRowActions{opacity:0;flex-wrap:wrap;gap:8px;display:flex}._1NmHsa_roomRow:hover ._1NmHsa_roomRowActions,._1NmHsa_roomRow:focus-within ._1NmHsa_roomRowActions{opacity:1}._1NmHsa_roomRowActions ._1NmHsa_roomAction{font:inherit;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;padding:0;font-size:12px;font-weight:500;line-height:16px}._1NmHsa_roomRowActions ._1NmHsa_roomAction:hover{color:var(--dsw-static-deepseek-500)}._1NmHsa_roomRowActions ._1NmHsa_roomAction:disabled{opacity:.5;cursor:default}._1NmHsa_replyChip{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-static-deepseek-500);font:inherit;cursor:pointer;border:none;border-radius:10px;align-self:flex-start;margin-top:6px;padding:2px 8px;font-size:11px;font-weight:600;display:inline-flex}._1NmHsa_artifactCard{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);border-radius:8px;align-items:center;gap:8px;margin-top:6px;padding:8px;display:flex}._1NmHsa_artifactType{background:var(--dsw-alias-bg-layer-2);min-width:36px;color:var(--dsw-alias-label-secondary);letter-spacing:.04em;text-align:center;border-radius:4px;flex:none;padding:4px 6px;font-size:10px;font-weight:700}._1NmHsa_artifactMeta{flex-direction:column;gap:2px;min-width:0;display:flex}._1NmHsa_artifactName{color:var(--dsw-alias-label-primary);font-size:12px;font-weight:600;line-height:16px}._1NmHsa_artifactNote{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}._1NmHsa_daySep{max-width:none;color:var(--dsw-alias-label-tertiary);align-self:stretch;align-items:center;gap:8px;margin:14px 0 4px;font-size:11px;line-height:16px;display:flex}._1NmHsa_daySep:before,._1NmHsa_daySep:after{content:\"\";background:var(--dsw-alias-border-l2);flex:1;height:1px}._1NmHsa_groupSpaceSection{color:var(--dsw-alias-label-tertiary);padding:6px 8px 2px;font-size:11px;font-weight:600}._1NmHsa_topicChip,._1NmHsa_handBtn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:8px;padding:2px 8px;font-size:11px;font-weight:600}._1NmHsa_topicChip:hover,._1NmHsa_handBtn:hover{background:var(--dsw-alias-interactive-bg-hover)}._1NmHsa_handBtn:disabled{opacity:.5;cursor:default}._1NmHsa_groupSpace{border-top:1px solid var(--dsw-alias-border-l2);flex-direction:column;flex:1 0 100%;width:100%;min-width:100%;min-height:0;max-height:42vh;margin-top:8px;padding-top:8px;display:flex}._1NmHsa_groupSpaceHead{color:var(--dsw-alias-label-tertiary);flex:none;padding:0 8px 6px;font-size:11px;font-weight:600}._1NmHsa_groupSpaceHint{color:var(--dsw-alias-label-tertiary);flex:none;margin:0;padding:0 8px 8px;font-size:12px;line-height:18px}._1NmHsa_groupSpaceTree{flex-direction:column;flex:1;gap:4px;min-height:0;display:flex;overflow:auto}._1NmHsa_groupSpaceRoom{flex-direction:column;gap:2px;display:flex}._1NmHsa_groupSpaceTopics{border-left:1px solid var(--dsw-alias-border-l2);margin-left:12px;padding-left:8px}._1NmHsa_groupSpaceRowWrap{align-items:center;gap:2px;display:flex}._1NmHsa_groupSpaceRow{width:100%;min-width:0;color:var(--dsw-alias-label-secondary);font:inherit;text-align:left;cursor:pointer;background:0 0;border:none;border-radius:4px;align-items:center;gap:6px;padding:4px 8px;font-size:12px;display:flex}._1NmHsa_groupSpaceRow:hover,._1NmHsa_groupSpaceRowActive{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}._1NmHsa_groupSpaceRowLabel{text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;overflow:hidden}._1NmHsa_groupSpaceMeta{color:var(--dsw-alias-label-tertiary);flex:none;font-size:11px}._1NmHsa_groupSpaceToggle{width:18px;height:18px;color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;background:0 0;border:none;border-radius:4px;flex:none;padding:0;font-size:11px}._1NmHsa_groupSpaceToggle:hover{background:var(--dsw-alias-interactive-bg-hover)}._1NmHsa_groupSpaceMore{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;background:0 0;border-radius:4px;margin:4px 8px 8px;padding:4px 8px;font-size:12px}._1NmHsa_groupSpaceMore:disabled{opacity:.5;cursor:default}._1NmHsa_groupSpaceGlyph{background:var(--dsw-alias-bg-layer-2);width:18px;height:18px;color:var(--dsw-alias-label-secondary);text-align:center;border-radius:4px;flex:none;font-size:11px;line-height:18px;overflow:hidden}._1NmHsa_groupSpaceGlyph img{object-fit:cover;width:18px;height:18px;display:block}._1NmHsa_streamMore{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;background:0 0;border-radius:6px;align-self:center;margin:4px 0 8px;padding:4px 10px;font-size:12px}._1NmHsa_streamMore:disabled{opacity:.5;cursor:default}._1NmHsa_roomShell{flex-direction:column;flex:1;min-width:0;height:100%;min-height:0;display:flex}._1NmHsa_pageTabs{border-bottom:1px solid var(--dsw-alias-border-l2);flex:none;align-items:center;gap:28px;padding:0 20px;display:flex}._1NmHsa_pageTab{color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;padding:12px 0;font-size:14px;line-height:22px;position:relative}._1NmHsa_pageTabOn{color:var(--dsw-static-deepseek-500);font-weight:600}._1NmHsa_pageTabOn:after{content:\"\";background:var(--dsw-static-deepseek-500);border-radius:200px;height:2px;position:absolute;bottom:0;left:0;right:0}._1NmHsa_pageBody{flex:1;min-width:0;min-height:0;display:flex}._1NmHsa_roomMain{flex-direction:column;flex:1;min-width:0;min-height:0;display:flex}._1NmHsa_roomMainHead{flex:none;justify-content:flex-end;padding:6px 12px 0;display:flex}._1NmHsa_topicToggle{color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;background:0 0;border:none;border-radius:999px;align-items:center;gap:6px;padding:4px 8px;font-size:12px;font-weight:500;display:inline-flex}._1NmHsa_topicToggle[aria-pressed=true]{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}._1NmHsa_topicToggleBadge{background:var(--dsw-static-deepseek-500);color:#fff;text-align:center;border-radius:999px;min-width:16px;height:16px;padding:0 5px;font-size:10px;font-weight:700;line-height:16px}._1NmHsa_roomStage{flex:1;min-width:0;min-height:0;display:flex}._1NmHsa_roomTimeline ._1NmHsa_stream{flex:1;gap:0;min-width:0;min-height:0}._1NmHsa_roomTimeline ._1NmHsa_stream ._1NmHsa_streamMore{margin-bottom:8px}._1NmHsa_roomRowHighlight{outline:2px solid var(--dsw-static-deepseek-500);outline-offset:2px;border-radius:8px}._1NmHsa_convList{border-right:1px solid var(--dsw-alias-border-l2);flex-direction:column;flex:none;width:236px;min-width:180px;min-height:0;display:flex}._1NmHsa_convListHint{color:var(--dsw-alias-label-tertiary);flex:none;margin:0;padding:0 12px 8px;font-size:12px;line-height:18px}._1NmHsa_convListBody{flex-direction:column;flex:1;min-height:0;display:flex;overflow:auto}._1NmHsa_convRow{width:100%;min-width:0;color:var(--dsw-alias-label-secondary);font:inherit;text-align:left;cursor:pointer;background:0 0;border:none;gap:8px;padding:8px 12px;display:flex}._1NmHsa_convRow:hover,._1NmHsa_convRowActive{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}._1NmHsa_convGlyph{background:var(--dsw-alias-bg-layer-2);width:32px;height:32px;color:var(--dsw-alias-label-secondary);text-align:center;border-radius:50%;flex:none;font-size:13px;line-height:32px;overflow:hidden}._1NmHsa_convGlyph img{object-fit:cover;width:32px;height:32px;display:block}._1NmHsa_convRowBody{flex-direction:column;flex:1;gap:2px;min-width:0;display:flex}._1NmHsa_convRowTop,._1NmHsa_convRowBottom{align-items:center;gap:6px;min-width:0;display:flex}._1NmHsa_convRowName{text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;font-size:13px;font-weight:500;overflow:hidden}._1NmHsa_convRowTime{color:var(--dsw-alias-label-tertiary);flex:none;font-size:11px}._1NmHsa_convRowPreview{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-tertiary);flex:1;font-size:12px;overflow:hidden}._1NmHsa_convDot{background:var(--dsw-static-deepseek-500);border-radius:50%;flex:none;width:6px;height:6px}._1NmHsa_convBadge{background:var(--dsw-static-deepseek-500);color:#fff;text-align:center;border-radius:999px;flex:none;min-width:16px;height:16px;padding:0 5px;font-size:10px;font-weight:700;line-height:16px}._1NmHsa_convMore{color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;text-align:left;background:0 0;border:none;margin:4px 12px 10px;padding:4px 0;font-size:12px}._1NmHsa_convMore:disabled{opacity:.5;cursor:default}._1NmHsa_topicDrawer{border-left:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);flex-direction:column;flex:none;width:340px;min-width:260px;min-height:0;display:flex}._1NmHsa_topicDrawerHead{border-bottom:1px solid var(--dsw-alias-border-l2);flex:none;align-items:center;gap:6px;padding:8px 8px 6px;display:flex}._1NmHsa_topicDrawerTitle{text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;font-size:13px;font-weight:600;overflow:hidden}._1NmHsa_topicDrawerNav{color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;background:0 0;border:none;flex:none;padding:2px 4px;font-size:12px}._1NmHsa_topicDrawerBody{flex-direction:column;flex:1;gap:6px;min-height:0;padding:8px;display:flex;overflow:auto}._1NmHsa_topicDrawerHint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:18px}._1NmHsa_topicCard{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);width:100%;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer;border-radius:8px;flex-direction:column;gap:2px;padding:8px;display:flex}._1NmHsa_topicCardTitle{font-size:13px;font-weight:600}._1NmHsa_topicCardOrigin{color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;font-size:12px;overflow:hidden}._1NmHsa_topicAnchorWrap{flex-direction:column;gap:4px;margin:0 8px 4px;display:flex}._1NmHsa_topicAnchorBar{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer;border-radius:8px;flex-direction:column;align-items:flex-start;gap:2px;margin:0;padding:8px;display:flex}._1NmHsa_topicAnchorExcerpt{color:var(--dsw-alias-label-secondary);-webkit-line-clamp:2;word-break:break-word;-webkit-box-orient:vertical;font-size:12px;display:-webkit-box;overflow:hidden}._1NmHsa_topicDrawerAsk{border-top:1px solid var(--dsw-alias-border-l2);flex:none;gap:6px;padding:8px;display:flex}._1NmHsa_topicDrawerInput{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);min-width:0;color:var(--dsw-alias-label-primary);font:inherit;border-radius:6px;flex:1;padding:6px 8px;font-size:13px}._1NmHsa_topicDrawerSend{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;border-radius:6px;flex:none;padding:6px 8px;font-size:12px}._1NmHsa_topicDrawerSend:disabled,._1NmHsa_topicDrawerInput:disabled{opacity:.5;cursor:default}._1NmHsa_topicLensRow{display:flex}._1NmHsa_topicLensRowUser{justify-content:flex-end}._1NmHsa_topicLensRowAssistant{justify-content:flex-start}._1NmHsa_topicLensStack{flex-direction:column;gap:6px;max-width:90%;display:flex}._1NmHsa_topicLensBubble{white-space:pre-wrap;word-break:break-word;max-width:100%;padding:6px 8px;font-size:12px;line-height:18px}._1NmHsa_topicLensBubbleUser{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:8px 2px 8px 8px}._1NmHsa_topicLensBubbleAssistant{background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);border-radius:2px 8px 8px}._1NmHsa_yzjDock{border-top:1px solid var(--dsw-alias-border-l2);flex-direction:column;flex:none;width:100%;margin-top:4px;padding-top:8px;display:flex}._1NmHsa_yzjDockNarrow{flex-direction:column;align-items:center;gap:2px;margin-top:4px;padding-top:8px;display:flex}._1NmHsa_yzjDockEntries{flex-direction:row;align-items:center;gap:4px;padding:0 8px;display:flex}._1NmHsa_yzjDockEntry{min-width:0;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;text-align:left;background:0 0;border:none;border-radius:10px;flex:1;align-items:center;gap:8px;padding:6px 10px;font-size:13px;line-height:18px;display:flex}._1NmHsa_yzjDockEntry:hover,._1NmHsa_yzjDockEntryActive,._1NmHsa_yzjDockEntryActive:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}._1NmHsa_yzjDockMark{text-align:center;width:16px;color:var(--dsw-alias-label-tertiary);flex:none;font-size:12px;line-height:1}._1NmHsa_yzjDockNarrow ._1NmHsa_yzjDockEntries{align-items:center;padding:0}._1NmHsa_yzjDockNarrow ._1NmHsa_yzjDockEntry{flex:none;justify-content:center;width:32px;padding:6px}._1NmHsa_yzjDockLabel{text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;overflow:hidden}._1NmHsa_yzjDockRobot{flex:none;align-items:center;padding:0 4px;display:flex}._1NmHsa_yzjDockRobotDot{background:var(--dsw-alias-label-tertiary);border-radius:50%;flex:none;width:6px;height:6px}._1NmHsa_yzjDockRobotDotOk{background:var(--dsw-alias-state-success-primary)}._1NmHsa_yzjDockRobotDotWarn{background:var(--dsw-alias-state-warn-primary)}._1NmHsa_yzjDockHint{color:var(--dsw-alias-label-tertiary);margin:0;padding:0 12px 8px;font-size:12px;line-height:18px}";
		const tagId$7 = "@dsh-yzj/bundle/ui-yzj/home.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$7) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@dsh-yzj/bundle/ui-yzj";
			tag.dataset.pluginCss = tagId$7;
			tag.textContent = css$7;
			document.head.appendChild(tag);
		}
		var home_module_css_default = {
			"convRowPreview": "_1NmHsa_convRowPreview",
			"roomClamp": "_1NmHsa_roomClamp",
			"yzjDockEntry": "_1NmHsa_yzjDockEntry",
			"agent": "_1NmHsa_agent",
			"candidate": "_1NmHsa_candidate",
			"pageTabOn": "_1NmHsa_pageTabOn",
			"chromePrimary": "_1NmHsa_chromePrimary",
			"roomBubbleAssistant": "_1NmHsa_roomBubbleAssistant",
			"pageTab": "_1NmHsa_pageTab",
			"topicToggle": "_1NmHsa_topicToggle",
			"topicCardOrigin": "_1NmHsa_topicCardOrigin",
			"failed": "_1NmHsa_failed",
			"roomAvatarSlot": "_1NmHsa_roomAvatarSlot",
			"groupSpaceHead": "_1NmHsa_groupSpaceHead",
			"yzjDockEntries": "_1NmHsa_yzjDockEntries",
			"topicDockLabel": "_1NmHsa_topicDockLabel",
			"roomShell": "_1NmHsa_roomShell",
			"yzjDockRobotDot": "_1NmHsa_yzjDockRobotDot",
			"roomEmojiPanel": "_1NmHsa_roomEmojiPanel",
			"groupSpaceTopics": "_1NmHsa_groupSpaceTopics",
			"meta": "_1NmHsa_meta",
			"roomRowMerged": "_1NmHsa_roomRowMerged",
			"replyChip": "_1NmHsa_replyChip",
			"roomComposerSeat": "_1NmHsa_roomComposerSeat",
			"stack": "_1NmHsa_stack",
			"chrome": "_1NmHsa_chrome",
			"topicListLabel": "_1NmHsa_topicListLabel",
			"handBtn": "_1NmHsa_handBtn",
			"groupSpaceGlyph": "_1NmHsa_groupSpaceGlyph",
			"roomReplyCancel": "_1NmHsa_roomReplyCancel",
			"groupSpaceRowWrap": "_1NmHsa_groupSpaceRowWrap",
			"topicLensRow": "_1NmHsa_topicLensRow",
			"roomRow": "_1NmHsa_roomRow",
			"topicLensStack": "_1NmHsa_topicLensStack",
			"kindPill": "_1NmHsa_kindPill",
			"yzjDockRobot": "_1NmHsa_yzjDockRobot",
			"convRowBody": "_1NmHsa_convRowBody",
			"topicDrawerBody": "_1NmHsa_topicDrawerBody",
			"modal": "_1NmHsa_modal",
			"convListHint": "_1NmHsa_convListHint",
			"yzjDockNarrow": "_1NmHsa_yzjDockNarrow",
			"groupSpaceTree": "_1NmHsa_groupSpaceTree",
			"pending": "_1NmHsa_pending",
			"roomRowOther": "_1NmHsa_roomRowOther",
			"convRow": "_1NmHsa_convRow",
			"topicDrawerSend": "_1NmHsa_topicDrawerSend",
			"roomBubble": "_1NmHsa_roomBubble",
			"topicChip": "_1NmHsa_topicChip",
			"roomReplyBar": "_1NmHsa_roomReplyBar",
			"yzjDockRobotDotOk": "_1NmHsa_yzjDockRobotDotOk",
			"convDot": "_1NmHsa_convDot",
			"yzjDockEntryActive": "_1NmHsa_yzjDockEntryActive",
			"roomComposerTools": "_1NmHsa_roomComposerTools",
			"groupSpaceRoom": "_1NmHsa_groupSpaceRoom",
			"topicAnchorExcerpt": "_1NmHsa_topicAnchorExcerpt",
			"daySep": "_1NmHsa_daySep",
			"roomMainHead": "_1NmHsa_roomMainHead",
			"roomComposerHost": "_1NmHsa_roomComposerHost",
			"roomClampToggle": "_1NmHsa_roomClampToggle",
			"topicToggleBadge": "_1NmHsa_topicToggleBadge",
			"topicDrawerTitle": "_1NmHsa_topicDrawerTitle",
			"topicDrawerNav": "_1NmHsa_topicDrawerNav",
			"yzjDockLabel": "_1NmHsa_yzjDockLabel",
			"roomTimeline": "_1NmHsa_roomTimeline",
			"convGlyph": "_1NmHsa_convGlyph",
			"convRowBottom": "_1NmHsa_convRowBottom",
			"roomRowHighlight": "_1NmHsa_roomRowHighlight",
			"modalMask": "_1NmHsa_modalMask",
			"groupSpaceRow": "_1NmHsa_groupSpaceRow",
			"roomEmojiBtn": "_1NmHsa_roomEmojiBtn",
			"roomStage": "_1NmHsa_roomStage",
			"streamContent": "_1NmHsa_streamContent",
			"topicDrawerHint": "_1NmHsa_topicDrawerHint",
			"artifactMeta": "_1NmHsa_artifactMeta",
			"rowOther": "_1NmHsa_rowOther",
			"topicDrawer": "_1NmHsa_topicDrawer",
			"convListBody": "_1NmHsa_convListBody",
			"convMore": "_1NmHsa_convMore",
			"yzjDockRobotDotWarn": "_1NmHsa_yzjDockRobotDotWarn",
			"topicLensRowUser": "_1NmHsa_topicLensRowUser",
			"artifactCard": "_1NmHsa_artifactCard",
			"pageTabs": "_1NmHsa_pageTabs",
			"groupSpaceMeta": "_1NmHsa_groupSpaceMeta",
			"topicLensBubbleUser": "_1NmHsa_topicLensBubbleUser",
			"topicCardTitle": "_1NmHsa_topicCardTitle",
			"roomComposer": "_1NmHsa_roomComposer",
			"bubble": "_1NmHsa_bubble",
			"groupSpaceRowActive": "_1NmHsa_groupSpaceRowActive",
			"im": "_1NmHsa_im",
			"yzjDockMark": "_1NmHsa_yzjDockMark",
			"yzjDock": "_1NmHsa_yzjDock",
			"roomStack": "_1NmHsa_roomStack",
			"topicDrawerAsk": "_1NmHsa_topicDrawerAsk",
			"actions": "_1NmHsa_actions",
			"groupSpaceSection": "_1NmHsa_groupSpaceSection",
			"streamMore": "_1NmHsa_streamMore",
			"topicAnchorWrap": "_1NmHsa_topicAnchorWrap",
			"roomReplyText": "_1NmHsa_roomReplyText",
			"roomAction": "_1NmHsa_roomAction",
			"roomComposerInput": "_1NmHsa_roomComposerInput",
			"pageBody": "_1NmHsa_pageBody",
			"hint": "_1NmHsa_hint",
			"convRowTop": "_1NmHsa_convRowTop",
			"chromeBtn": "_1NmHsa_chromeBtn",
			"tag": "_1NmHsa_tag",
			"topicDock": "_1NmHsa_topicDock",
			"topicLensBubble": "_1NmHsa_topicLensBubble",
			"topicLensRowAssistant": "_1NmHsa_topicLensRowAssistant",
			"groupSpaceRowLabel": "_1NmHsa_groupSpaceRowLabel",
			"topicList": "_1NmHsa_topicList",
			"groupSpace": "_1NmHsa_groupSpace",
			"topicCard": "_1NmHsa_topicCard",
			"row": "_1NmHsa_row",
			"topicDockSummary": "_1NmHsa_topicDockSummary",
			"roomToolBtn": "_1NmHsa_roomToolBtn",
			"roomBubbleSelf": "_1NmHsa_roomBubbleSelf",
			"groupSpaceMore": "_1NmHsa_groupSpaceMore",
			"convRowName": "_1NmHsa_convRowName",
			"rowSelf": "_1NmHsa_rowSelf",
			"roomSendCircle": "_1NmHsa_roomSendCircle",
			"convRowTime": "_1NmHsa_convRowTime",
			"roomBubbleOther": "_1NmHsa_roomBubbleOther",
			"topicAnchorBar": "_1NmHsa_topicAnchorBar",
			"imSelf": "_1NmHsa_imSelf",
			"pick": "_1NmHsa_pick",
			"convRowActive": "_1NmHsa_convRowActive",
			"topicDrawerInput": "_1NmHsa_topicDrawerInput",
			"roomRowActions": "_1NmHsa_roomRowActions",
			"roomComposerBar": "_1NmHsa_roomComposerBar",
			"chromeLink": "_1NmHsa_chromeLink",
			"unbound": "_1NmHsa_unbound",
			"roomComposerCard": "_1NmHsa_roomComposerCard",
			"roomMeta": "_1NmHsa_roomMeta",
			"topicLensBubbleAssistant": "_1NmHsa_topicLensBubbleAssistant",
			"topicDrawerHead": "_1NmHsa_topicDrawerHead",
			"artifactNote": "_1NmHsa_artifactNote",
			"convBadge": "_1NmHsa_convBadge",
			"groupSpaceToggle": "_1NmHsa_groupSpaceToggle",
			"topicDockBtn": "_1NmHsa_topicDockBtn",
			"yzjDockHint": "_1NmHsa_yzjDockHint",
			"roomRowSelf": "_1NmHsa_roomRowSelf",
			"artifactType": "_1NmHsa_artifactType",
			"stream": "_1NmHsa_stream",
			"chromeQuiet": "_1NmHsa_chromeQuiet",
			"artifactName": "_1NmHsa_artifactName",
			"groupSpaceHint": "_1NmHsa_groupSpaceHint",
			"roomMain": "_1NmHsa_roomMain",
			"convList": "_1NmHsa_convList"
		};
		//#endregion
		//#region lib/types/client/home-chrome.js
		/**
		* Bound / unbound composer chrome in `conversation.input.dock`.
		* Group room: dock 发进群 is retired (R2) — the timeline column owns 发进群.
		* Topic: native send = 问助手. Unbound: 「丢进群」.
		*/
		function asRecord$19(value) {
			return typeof value === "object" && value !== null ? value : {};
		}
		function asArray$11(value) {
			return Array.isArray(value) ? value : [];
		}
		/**
		* Room chrome: native send is intercepted to 发进群 (safety net if the
		* official bar is still up). Topic paints 「回群聊」 on this dock, matching
		* the official InputBar column. Unbound keeps 「丢进群」. Room dock 发进群
		* is retired — the timeline column owns it.
		*/
		function YzjHomeChrome(props) {
			const domain = useWorkbenchDomain();
			const [kind, setKind] = (0, react.useState)(() => yzjViewKindFromSessionId(props.sessionId));
			const [error, setError] = (0, react.useState)("");
			const [handoffOpen, setHandoffOpen] = (0, react.useState)(false);
			const [roomGroupId, setRoomGroupId] = (0, react.useState)("");
			const [roomKind, setRoomKind] = (0, react.useState)("");
			const [summary, setSummary] = (0, react.useState)("");
			const sendRef = (0, react.useRef)(async () => {});
			(0, react.useEffect)(() => {
				const next = yzjViewKindFromSessionId(props.sessionId);
				setKind(next);
				if (next !== "topic") {
					setRoomGroupId("");
					setRoomKind("");
					setSummary("");
					return;
				}
				let cancelled = false;
				const tick = async () => {
					const result = await props.homeBinding(props.sessionId);
					if (cancelled || !result.ok) return;
					const raw = asRecord$19(result.value);
					const binding = asRecord$19(raw.binding);
					const host = typeof binding.dshSessionId === "string" ? binding.dshSessionId : "";
					const groupId = typeof binding.yzjConversationId === "string" ? binding.yzjConversationId : "";
					setRoomGroupId(groupId);
					setRoomKind(binding.yzjKind === "dm" ? "dm" : binding.yzjKind === "group" ? "group" : "");
					rememberImSeat({
						groupId,
						sessionId: host
					});
					const topic = asRecord$19(raw.topic);
					const origin = typeof topic.originText === "string" ? topic.originText : "";
					const title = typeof topic.title === "string" ? topic.title : "";
					setSummary(origin !== "" ? origin : title);
				};
				tick();
				const timer = window.setInterval(() => {
					tick();
				}, 1500);
				return () => {
					cancelled = true;
					window.clearInterval(timer);
				};
			}, [props.sessionId]);
			const sendToGroup = async () => {
				const draft = props.readDraft().trim();
				if (draft === "") {
					setError("先写点内容再发进群");
					return;
				}
				setError("");
				const result = await props.homeSend(props.sessionId, draft);
				if (!result.ok) {
					setError(result.error.message);
					return;
				}
				props.clearDraft();
			};
			sendRef.current = sendToGroup;
			(0, react.useEffect)(() => {
				if (kind !== "room") return;
				const actions = props.inputActions;
				const original = actions?.submit;
				if (actions !== void 0 && original !== void 0) actions.submit = () => {
					sendRef.current();
				};
				return () => {
					if (actions !== void 0 && original !== void 0) actions.submit = original;
				};
			}, [kind, props.inputActions]);
			if (kind === "room" || domain !== "im") return null;
			if (kind === "topic") {
				const label = roomKind === "dm" ? "回私聊" : "回群聊";
				return (0, react_jsx_runtime.jsx)("div", {
					className: home_module_css_default.topicDock,
					"data-testid": "yzj-home-chrome",
					children: (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: home_module_css_default.topicDockBtn,
						"data-testid": "yzj-topic-anchor",
						title: summary === "" ? label : summary,
						"aria-label": summary === "" ? label : `${label}：${summary}`,
						onClick: () => {
							const groupId = roomGroupId !== "" ? roomGroupId : peekImSeat()?.groupId ?? "";
							if (groupId !== "") rememberImSeat({
								groupId,
								sessionId: peekImSeat()?.sessionId ?? ""
							});
							setWorkbenchDomain("im");
							openWorkbench();
						},
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: home_module_css_default.topicDockLabel,
							children: label
						}), summary !== "" && (0, react_jsx_runtime.jsx)("span", {
							className: home_module_css_default.topicDockSummary,
							children: summary
						})]
					})
				});
			}
			return (0, react_jsx_runtime.jsxs)("div", {
				className: home_module_css_default.chromeQuiet,
				"data-testid": "yzj-home-chrome",
				children: [
					(0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: home_module_css_default.chromeLink,
						onClick: () => setHandoffOpen(true),
						children: "丢进群"
					}),
					error !== "" && (0, react_jsx_runtime.jsx)("span", {
						role: "alert",
						children: error
					}),
					handoffOpen && (0, react_jsx_runtime.jsx)(HandoffModal, {
						sessionId: props.sessionId,
						homeDigest: props.homeDigest,
						homeHandoff: props.homeHandoff,
						fetchGroups: props.fetchGroups,
						...props.focusBoundSession === void 0 ? {} : { focusBoundSession: props.focusBoundSession },
						onClose: () => setHandoffOpen(false)
					})
				]
			});
		}
		function HandoffModal(props) {
			const [groups, setGroups] = (0, react.useState)([]);
			const [groupId, setGroupId] = (0, react.useState)("");
			const [candidates, setCandidates] = (0, react.useState)([]);
			const [selected, setSelected] = (0, react.useState)([]);
			const [migrateFull, setMigrateFull] = (0, react.useState)(false);
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)("");
			(0, react.useEffect)(() => {
				props.fetchGroups(20).then((result) => {
					if (!result.ok) return;
					const rows = asArray$11(asRecord$19(result.value).list).map((item) => {
						const row = asRecord$19(item);
						return {
							id: typeof row.groupId === "string" ? row.groupId : "",
							name: typeof row.groupName === "string" ? row.groupName : ""
						};
					}).filter((row) => row.id !== "");
					setGroups(rows);
					if (rows[0] !== void 0) setGroupId(rows[0].id);
				});
				props.homeDigest(props.sessionId).then((result) => {
					if (!result.ok) return;
					const list = asArray$11(asRecord$19(result.value).candidates);
					setCandidates(list);
					setSelected(defaultSelectedIds(list));
				});
			}, [props.sessionId]);
			const confirm = async () => {
				if (groupId === "") {
					setError("请选择目标群");
					return;
				}
				const digest = composeHandoffDigest(candidates, selected, migrateFull);
				if (digest.trim() === "") {
					setError("请勾选要分享的摘要，或显式选择全文迁移");
					return;
				}
				setBusy(true);
				setError("");
				const result = await props.homeHandoff(groupId, digest);
				setBusy(false);
				if (!result.ok) {
					setError(result.error.message);
					return;
				}
				const sessionId = typeof asRecord$19(result.value).sessionId === "string" ? asRecord$19(result.value).sessionId : "";
				rememberImSeat({
					groupId,
					sessionId: sessionId === "" ? "" : sessionId
				});
				setWorkbenchDomain("im");
				openWorkbench();
				props.onClose();
			};
			return (0, react_jsx_runtime.jsx)("div", {
				className: home_module_css_default.modalMask,
				role: "dialog",
				"aria-label": "丢进群确认",
				children: (0, react_jsx_runtime.jsxs)("div", {
					className: home_module_css_default.modal,
					children: [
						(0, react_jsx_runtime.jsx)("h3", { children: "丢进群" }),
						(0, react_jsx_runtime.jsx)("p", { children: "默认只发你勾选的可见摘要。私聊全文仍私密。全文迁移必须显式勾选。确认后才会发进群并打开群房间。" }),
						(0, react_jsx_runtime.jsxs)("label", {
							className: home_module_css_default.pick,
							children: ["目标群", (0, react_jsx_runtime.jsx)("select", {
								value: groupId,
								onChange: (event) => setGroupId(event.target.value),
								children: groups.map((group) => (0, react_jsx_runtime.jsx)("option", {
									value: group.id,
									children: group.name === "" ? group.id : group.name
								}, group.id))
							})]
						}),
						(0, react_jsx_runtime.jsxs)("div", {
							className: home_module_css_default.pick,
							children: [candidates.length === 0 && (0, react_jsx_runtime.jsx)("span", { children: "这条私密会话还没有可勾选的摘要。" }), candidates.map((row) => (0, react_jsx_runtime.jsxs)("label", {
								className: home_module_css_default.candidate,
								children: [(0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: migrateFull || selected.includes(row.id),
									disabled: migrateFull,
									onChange: (event) => {
										setSelected((current) => event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id));
									}
								}), (0, react_jsx_runtime.jsxs)("span", { children: [
									(0, react_jsx_runtime.jsx)("strong", { children: row.role === "assistant" ? "助手" : "用户" }),
									" ",
									row.text.slice(0, 180)
								] })]
							}, row.id))]
						}),
						(0, react_jsx_runtime.jsxs)("label", {
							className: home_module_css_default.candidate,
							children: [(0, react_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: migrateFull,
								onChange: (event) => setMigrateFull(event.target.checked)
							}), (0, react_jsx_runtime.jsx)("span", { children: "全文迁移（显式、罕见：整段私聊变为群可见）" })]
						}),
						error !== "" && (0, react_jsx_runtime.jsx)("p", {
							role: "alert",
							children: error
						}),
						(0, react_jsx_runtime.jsxs)("div", {
							className: home_module_css_default.actions,
							children: [(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: home_module_css_default.chromeBtn,
								onClick: props.onClose,
								children: "取消"
							}), (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: `${home_module_css_default.chromeBtn} ${home_module_css_default.chromePrimary}`,
								disabled: busy,
								onClick: () => {
									confirm();
								},
								children: busy ? "交接中…" : "确认发进群"
							})]
						})
					]
				})
			});
		}
		//#endregion
		//#region lib/types/client/composer.js
		/**
		* The composer dock: topic/unbound chrome only.
		* Group-room 发进群 lives in the timeline column.
		*/
		function YzjComposerDock(props) {
			return (0, react_jsx_runtime.jsx)(YzjHomeChrome, { ...props });
		}
		//#endregion
		//#region lib/types/client/session-shell.js
		/**
		* Session-header action that keeps the tab ring honest for v2.0 views.
		* Always mounted (header.actions). Tab-ring hide uses pitfall-018
		* (`display:none !important` + observer). Topic 回群聊 lives on the
		* official composer dock, not here.
		*/
		function asRecord$18(value) {
			return typeof value === "object" && value !== null ? value : {};
		}
		/**
		* Pill + tab-ring sync. Renders 「群聊」/「私聊」 on room sessions so the header
		* still names the view after the tablist is hidden.
		*/
		function YzjSessionShell(props) {
			const [kind, setKind] = (0, react.useState)(() => yzjViewKindFromSessionId(props.sessionId));
			const [roomKind, setRoomKind] = (0, react.useState)("");
			(0, react.useEffect)(() => {
				let cancelled = false;
				setKind(yzjViewKindFromSessionId(props.sessionId));
				const tick = async () => {
					const result = await props.homeBinding(props.sessionId);
					if (cancelled || !result.ok) return;
					const binding = asRecord$18(asRecord$18(result.value).binding);
					setRoomKind(binding.yzjKind === "dm" ? "dm" : binding.yzjKind === "group" ? "group" : "");
				};
				tick();
				const timer = window.setInterval(() => {
					tick();
				}, 1500);
				return () => {
					cancelled = true;
					window.clearInterval(timer);
					restoreYzjViewRing();
				};
			}, [props.sessionId]);
			(0, react.useEffect)(() => watchYzjViewRing(kind), [kind, props.sessionId]);
			if (kind !== "room") return null;
			return (0, react_jsx_runtime.jsx)("span", {
				className: home_module_css_default.kindPill,
				"data-testid": "yzj-room-pill",
				children: roomKind === "dm" ? "私聊" : "群聊"
			});
		}
		//#endregion
		//#region lib/types/client/stores.js
		/**
		* The Yunzhijia panel's viewing store: open state, active tab, fetched data
		* per tab, drill-down selection, loading/error flags. Module level exports
		* the factory only (a module-level handle would pin store identity across
		* plugin reloads); the two registrations share the factory's handle.
		*/
		/** Create the Yunzhijia panel store handle. */
		function createYzjStore() {
			const handle = (0, _deepseek_ai_dsh_client_runtime_client.defineStore)({
				init: () => ({
					open: false,
					tab: "docs",
					panelX: -1,
					panelY: -1,
					workspaces: [],
					workspaceId: "",
					docs: [],
					docId: "",
					events: [],
					calYear: (/* @__PURE__ */ new Date()).getFullYear(),
					calMonth: (/* @__PURE__ */ new Date()).getMonth() + 1,
					calDay: "",
					calEvents: [],
					calEventId: "",
					groups: [],
					groupsPage: 1,
					groupsMore: false,
					groupId: "",
					messages: [],
					messagesMore: false,
					messagesAnchor: "",
					anchorMsgId: "",
					unreadTotal: 0,
					todos: [],
					todoReady: false,
					todoLink: "",
					todoLibName: "",
					todoLibScope: "",
					todoLibraries: [],
					todoActiveDocId: "",
					todoTag: "",
					loading: true,
					error: ""
				}),
				persist: "dsh.yzj.panel.v5",
				actions: {
					setOpen: (d, open) => {
						d.open = open;
					},
					setTab: (d, tab) => {
						d.tab = tab;
					},
					setPanelPosition: (d, x, y) => {
						d.panelX = x;
						d.panelY = y;
					},
					setWorkspaces: (d, workspaces) => {
						d.workspaces = workspaces;
					},
					setWorkspaceId: (d, id) => {
						d.workspaceId = id;
					},
					setDocs: (d, docs) => {
						d.docs = docs;
					},
					setDocId: (d, id) => {
						d.docId = id;
					},
					setEvents: (d, events) => {
						d.events = events;
					},
					setCalCursor: (d, year, month) => {
						d.calYear = year;
						d.calMonth = month;
					},
					setCalDay: (d, day) => {
						d.calDay = day;
					},
					setCalEvents: (d, events) => {
						d.calEvents = events;
					},
					setCalEventId: (d, id) => {
						d.calEventId = id;
					},
					setGroups: (d, groups) => {
						d.groups = groups;
					},
					setGroupsPage: (d, page) => {
						d.groupsPage = page;
					},
					setGroupsMore: (d, more) => {
						d.groupsMore = more;
					},
					appendGroups: (d, groups) => {
						const seen = new Set(d.groups.map((group) => String(asRecord$17(group).groupId)));
						d.groups = [...d.groups, ...groups.filter((group) => !seen.has(String(asRecord$17(group).groupId)))];
					},
					setGroupId: (d, id) => {
						d.groupId = id;
					},
					setMessages: (d, messages) => {
						d.messages = messages;
					},
					setMessagesMore: (d, more) => {
						d.messagesMore = more;
					},
					setMessagesAnchor: (d, anchor) => {
						d.messagesAnchor = anchor;
					},
					prependMessages: (d, messages) => {
						const seen = new Set(d.messages.map((message) => String(asRecord$17(message).msgId)));
						d.messages = [...messages.filter((message) => !seen.has(String(asRecord$17(message).msgId))), ...d.messages];
					},
					appendMessages: (d, messages) => {
						const seen = new Set(d.messages.map((message) => String(asRecord$17(message).msgId)));
						d.messages = [...d.messages, ...messages.filter((message) => !seen.has(String(asRecord$17(message).msgId)))];
					},
					setAnchorMsgId: (d, id) => {
						d.anchorMsgId = id;
					},
					setUnreadTotal: (d, total) => {
						d.unreadTotal = total;
					},
					setTodoState: (d, todos, ready, link, libName, libScope) => {
						d.todos = todos;
						d.todoReady = ready;
						d.todoLink = link;
						if (libName !== void 0) d.todoLibName = libName;
						if (libScope !== void 0) d.todoLibScope = libScope;
					},
					setTodoLibraries: (d, libraries, activeDocId) => {
						d.todoLibraries = libraries;
						d.todoActiveDocId = activeDocId;
					},
					patchTodo: (d, todo) => {
						const todoId = String(asRecord$17(todo).todoId);
						d.todos = d.todos.map((item) => String(asRecord$17(item).todoId) === todoId ? todo : item);
					},
					setTodoTag: (d, tag) => {
						d.todoTag = tag;
					},
					setLoading: (d, loading) => {
						d.loading = loading;
					},
					setError: (d, error) => {
						d.error = error;
					}
				}
			});
			return {
				...handle,
				create(scopeKey) {
					const instance = handle.create(scopeKey);
					const snap = instance.getSnapshot();
					if ([
						"workspaces",
						"docs",
						"events",
						"calEvents",
						"groups",
						"messages",
						"todos",
						"todoLibraries"
					].some((key) => !Array.isArray(snap[key])) || typeof snap.loading !== "boolean") {
						instance.store.set({
							...handle.spec.init(),
							open: false,
							tab: "docs"
						});
						instance.clearPersisted();
					}
					return instance;
				}
			};
		}
		function asRecord$17(value) {
			return typeof value === "object" && value !== null ? value : {};
		}
		//#endregion
		//#region lib/types/contact-parse.js
		/**
		* Contact payload unwrap (pitfall-003: bare array / list / data / single object).
		* Shared by host whoami and the browser sender-name cache.
		*/
		function asRecord$16(value) {
			return typeof value === "object" && value !== null ? value : {};
		}
		function firstNonEmpty(...values) {
			for (const value of values) if (typeof value === "string" && value !== "") return value;
			return "";
		}
		function rowsOf(json) {
			if (Array.isArray(json)) return json;
			const record = asRecord$16(json);
			if (Array.isArray(record.list)) return record.list;
			if (Array.isArray(record.data)) return record.data;
			if (typeof record.data === "object" && record.data !== null) {
				const inner = asRecord$16(record.data);
				if (Array.isArray(inner.list)) return inner.list;
			}
			return Object.keys(record).length === 0 ? [] : [json];
		}
		/** Parse `contact user get` JSON into openId / name / photoUrl. */
		function parseContactUser(json) {
			const user = asRecord$16(rowsOf(json)[0]);
			return {
				openId: firstNonEmpty(user.openId, user.oId),
				name: firstNonEmpty(user.name, user.userName, user.nickName),
				photoUrl: firstNonEmpty(user.photoUrl, user.photo, user.avatar)
			};
		}
		//#endregion
		//#region lib/types/client/im-cache.js
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
		/** Fresh cached message window for a group, or undefined when stale/missing. */
		function getMessageWindow(groupId) {
			loadPersisted();
			const hit = messageCache.get(groupId);
			if (hit === void 0) return void 0;
			if (Date.now() - hit.fetchedAt > MESSAGE_TTL) {
				messageCache.delete(groupId);
				return;
			}
			return hit;
		}
		/** Store (or refresh) a group's rendered message window. */
		function putMessageWindow(groupId, messages, more) {
			messageCache.set(groupId, {
				messages,
				more,
				fetchedAt: Date.now()
			});
			scheduleSave();
		}
		/** Fresh cached first group page, or undefined when stale/missing. */
		function getGroupWindow() {
			loadPersisted();
			if (groupCache === null) return void 0;
			if (Date.now() - groupCache.fetchedAt > GROUP_TTL) return void 0;
			return {
				groups: groupCache.groups,
				more: groupCache.more
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
		/** Record that a group was opened; its server unread at that moment. */
		function markGroupRead(groupId, serverUnread) {
			readState.set(groupId, serverUnread);
			scheduleSave();
		}
		/** Mark every group in a window read (全部已读). */
		function markAllRead(groups) {
			for (const item of groups) {
				const group = typeof item === "object" && item !== null ? item : {};
				const id = typeof group.groupId === "string" ? group.groupId : "";
				const unread = typeof group.unreadCount === "number" ? group.unreadCount : 0;
				if (id !== "" && unread > 0) readState.set(id, unread);
			}
			scheduleSave();
		}
		/** Effective unread for a group: 0 for marked-read groups plus new arrivals. */
		function effectiveUnread(groupId, serverUnread) {
			loadPersisted();
			if (groupId === "" || serverUnread <= 0) return serverUnread;
			const marked = readState.get(groupId);
			if (marked === void 0) return serverUnread;
			return Math.max(0, serverUnread - marked);
		}
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
				if (data.groups !== void 0 && data.groups !== null) {
					if (Date.now() - data.groups.fetchedAt <= GROUP_TTL) groupCache = data.groups;
				}
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
		/** The login user's profile, resolved once (for outbound message attribution). */
		let myProfile = null;
		/** Resolve the login user's openId + name (cached for the session). */
		async function ensureMyProfile(inject) {
			if (myProfile !== null) return myProfile;
			const result = await inject.fetchWhoami();
			if (!result.ok) return {
				openId: "",
				name: "",
				photoUrl: ""
			};
			myProfile = parseContactUser(result.value);
			return myProfile;
		}
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
		/** "2026-08-14 23:03:34.640" → "23:03" today, "昨天 23:03" yesterday, else "08-14 23:03". */
		function formatMsgTime(text) {
			const value = String(text ?? "");
			if (value.length < 16) return value;
			const now = /* @__PURE__ */ new Date();
			const pad = (n) => String(n).padStart(2, "0");
			const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
			if (value.startsWith(todayKey)) return value.slice(11, 16);
			const yesterday = /* @__PURE__ */ new Date(now.getTime() - 864e5);
			const yesterdayKey = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;
			if (value.startsWith(yesterdayKey)) return `昨天 ${value.slice(11, 16)}`;
			return `${value.slice(5, 7)}-${value.slice(8, 10)} ${value.slice(11, 16)}`;
		}
		/** Group-list time: 今天 HH:mm / 昨天 / MM-DD / YYYY-MM-DD. */
		function formatListTime(text) {
			const value = String(text ?? "");
			if (value.length < 10) return "";
			const day = value.slice(0, 10);
			const now = /* @__PURE__ */ new Date();
			const pad = (n) => String(n).padStart(2, "0");
			if (day === `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`) return value.length >= 16 ? value.slice(11, 16) : "今天";
			const yesterday = /* @__PURE__ */ new Date(now.getTime() - 864e5);
			if (day === `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`) return "昨天";
			const year = String(now.getFullYear());
			return day.startsWith(year) ? day.slice(5) : day;
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
		//#region \0dsh-css:/Users/guoxinshan/dev/dsh-yzj/packages/ui-yzj/src/client/login-banner.module.css.mjs
		const css$6 = "._2X38ha_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:10px;flex-direction:column;gap:8px;margin:8px 12px;padding:10px 12px;display:flex}._2X38ha_compact{gap:6px;margin:8px 10px;padding:8px 10px}._2X38ha_title{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600;line-height:18px}._2X38ha_body,._2X38ha_hint,._2X38ha_status{color:var(--dsw-alias-label-secondary);margin:0;font-size:12px;line-height:18px}._2X38ha_hint{color:var(--dsw-alias-label-tertiary);word-break:break-word}._2X38ha_status{flex:none;padding:4px 0 10px}._2X38ha_actions{flex-wrap:wrap;gap:6px;display:flex}._2X38ha_primary,._2X38ha_secondary{cursor:pointer;border-radius:8px;padding:8px 12px;font-family:inherit;font-size:12.5px;line-height:1}._2X38ha_primary{background:var(--dsw-static-deepseek-100);color:var(--dsw-static-deepseek-600);border:none;font-weight:600}._2X38ha_primary:hover:not(:disabled){filter:brightness(.97)}._2X38ha_primary:disabled{cursor:progress;opacity:.7}._2X38ha_secondary{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:0 0}._2X38ha_secondary:hover{color:var(--dsw-alias-label-primary)}";
		const tagId$6 = "@dsh-yzj/bundle/ui-yzj/login-banner.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$6) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@dsh-yzj/bundle/ui-yzj";
			tag.dataset.pluginCss = tagId$6;
			tag.textContent = css$6;
			document.head.appendChild(tag);
		}
		var login_banner_module_css_default = {
			"status": "_2X38ha_status",
			"title": "_2X38ha_title",
			"body": "_2X38ha_body",
			"actions": "_2X38ha_actions",
			"hint": "_2X38ha_hint",
			"primary": "_2X38ha_primary",
			"card": "_2X38ha_card",
			"compact": "_2X38ha_compact",
			"secondary": "_2X38ha_secondary"
		};
		//#endregion
		//#region lib/types/client/login-banner.js
		/**
		* Yunzhijia CLI login card: probe status, open the system browser via
		* `yzj-cli auth login`, then re-probe. DSH never holds tokens.
		*/
		function asRecord$15(value) {
			return typeof value === "object" && value !== null ? value : {};
		}
		function asString$13(value) {
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
				const rec = asRecord$15(result.value);
				if (rec.loggedIn === true) {
					setName(asString$13(rec.name) || asString$13(rec.openId) || "已登录");
					setHint("");
					setPhase("in");
					if (afterLogin) props.onLoggedIn?.();
					return;
				}
				const reason = asString$13(rec.reason);
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
				return (0, react_jsx_runtime.jsxs)("p", {
					className: login_banner_module_css_default.status,
					"data-testid": "yzj-login-status",
					children: ["已登录 · ", name]
				});
			}
			return (0, react_jsx_runtime.jsxs)("div", {
				className: `${login_banner_module_css_default.card} ${props.compact === true ? login_banner_module_css_default.compact : ""}`,
				"data-testid": "yzj-login-banner",
				role: "status",
				children: [
					(0, react_jsx_runtime.jsx)("strong", {
						className: login_banner_module_css_default.title,
						children: "云之家未登录"
					}),
					(0, react_jsx_runtime.jsx)("p", {
						className: login_banner_module_css_default.body,
						children: phase === "waiting" || phase === "retry" ? "已打开系统浏览器。授权完成后点「我已登录」。" : props.compact === true ? "点按钮打开系统浏览器，用 yzj-cli 授权。DSH 不保存密码。" : "工作台复用本机 yzj-cli 登录态。点按钮会打开系统浏览器完成授权；凭据只进操作系统密钥链，DSH 碰不到。"
					}),
					hint !== "" && (0, react_jsx_runtime.jsx)("p", {
						className: login_banner_module_css_default.hint,
						children: hint
					}),
					phase === "waiting" || phase === "retry" ? (0, react_jsx_runtime.jsxs)("div", {
						className: login_banner_module_css_default.actions,
						children: [(0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: login_banner_module_css_default.primary,
							"data-testid": "yzj-login-confirm",
							onClick: () => {
								probe(true);
							},
							children: "我已登录"
						}), (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: login_banner_module_css_default.secondary,
							"data-testid": "yzj-login-again",
							onClick: () => {
								launch();
							},
							children: "再打开一次"
						})]
					}) : (0, react_jsx_runtime.jsx)("button", {
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
		//#region lib/types/client/conv-list.js
		/**
		* Workbench conversation list (docs/spec/group-room-topics.md R15/L1).
		* Merges `im group recent` with bound-room topics: row time/preview follow
		* max(latest group message, latest topic activity); topic wins with a
		* 「话题·标题」prefix. Click always lands on the timeline (drawer stays shut).
		*/
		function asRecord$14(value) {
			return typeof value === "object" && value !== null ? value : {};
		}
		function asArray$10(value) {
			return Array.isArray(value) ? value : [];
		}
		function asString$12(value) {
			return typeof value === "string" ? value : "";
		}
		/** Nested topic label: drop the group-name affix (legacy 「群名 · 」prefix or current 「 · 群名」suffix). */
		function topicNavLabel(groupName, title) {
			const group = groupName.trim();
			const prefix = `${group} · `;
			const suffix = ` · ${group}`;
			const body = title.trim();
			if (group !== "" && body.startsWith(prefix)) return body.slice(prefix.length) || "话题";
			if (group !== "" && body.endsWith(suffix)) return body.slice(0, body.length - suffix.length) || "话题";
			return body || "话题";
		}
		function isPlaceholderName(name) {
			return name === "群房间" || name === "私聊房间";
		}
		/** Prefer the CLI recent name over a host `session/title` placeholder. */
		function displayGroupName(hostName, recentName, kind) {
			const recent = recentName.trim();
			const host = (hostName ?? "").trim();
			if (recent !== "" && !isPlaceholderName(recent)) return recent;
			if (host !== "" && !isPlaceholderName(host)) return host;
			if (recent !== "") return recent;
			return kind === "dm" ? "私聊" : "群聊";
		}
		function kindOf(groupId) {
			return groupId.startsWith("BOT-") ? "dm" : "group";
		}
		/** L2: missing / unknown status counts as running (pre-P3 rows). */
		function topicStatusOf(status) {
			return status === "confirm" || status === "done" ? status : "running";
		}
		/** L2 badge inputs: accent number = confirm count; dot = any running. */
		function topicListBadge(topics) {
			let confirmCount = 0;
			let hasRunning = false;
			for (const topic of topics) {
				const status = topicStatusOf(topic.status);
				if (status === "confirm") confirmCount += 1;
				else if (status === "running") hasRunning = true;
			}
			return {
				confirmCount,
				hasRunning
			};
		}
		function previewOf(message) {
			const content = asString$12(message.content);
			const msgType = asString$12(message.msgType);
			if (msgType === "file") return "[文件]";
			if (msgType === "richText") {
				const plain = content.replace(/\s+/g, " ").trim();
				return plain === "" ? "[图文]" : plain.slice(0, 60);
			}
			return content.replace(/\s+/g, " ").slice(0, 60);
		}
		function listTimeMs(text) {
			if (typeof text === "number" && Number.isFinite(text)) return text;
			const value = String(text ?? "").trim();
			if (value === "") return 0;
			const parsed = Date.parse(value.includes("T") ? value : value.replace(" ", "T"));
			return Number.isFinite(parsed) ? parsed : 0;
		}
		function clockLabel(ms, fallback) {
			if (ms <= 0) return formatListTime(fallback);
			const date = new Date(ms);
			const pad = (n) => String(n).padStart(2, "0");
			return formatListTime(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:00`);
		}
		/** Bound rooms from `home-nav`. */
		function parseNavRooms(value) {
			return asArray$10(asRecord$14(value).rooms).flatMap((row) => {
				const rec = asRecord$14(row);
				const sessionId = asString$12(rec.sessionId);
				const groupId = asString$12(rec.groupId);
				if (sessionId === "" || groupId === "") return [];
				const topics = asArray$10(rec.topics).flatMap((item) => {
					const topic = asRecord$14(item);
					const id = asString$12(topic.sessionId);
					if (id === "") return [];
					const activity = typeof topic.lastActivity === "number" ? topic.lastActivity : 0;
					return [{
						sessionId: id,
						title: asString$12(topic.title) || "话题",
						lastActivity: activity,
						status: topicStatusOf(asString$12(topic.status) || void 0)
					}];
				});
				return [{
					groupId,
					sessionId,
					groupName: asString$12(rec.groupName) || (rec.yzjKind === "dm" ? "私聊房间" : "群房间"),
					yzjKind: rec.yzjKind === "dm" ? "dm" : "group",
					topics
				}];
			});
		}
		/** Recent CLI rows plus whether another page exists. */
		function parseRecentGroups(value) {
			const rec = asRecord$14(value);
			return {
				rooms: asArray$10(rec.list).flatMap((row) => {
					const item = asRecord$14(row);
					const groupId = asString$12(item.groupId);
					if (groupId === "") return [];
					return [{
						groupId,
						groupName: asString$12(item.groupName) || (kindOf(groupId) === "dm" ? "私聊" : "群聊"),
						lastMsg: asRecord$14(item.lastMsg),
						lastMsgSendTime: item.lastMsgSendTime,
						...asString$12(item.headerUrl) === "" ? {} : { headerUrl: asString$12(item.headerUrl) }
					}];
				}),
				more: rec.more === true
			};
		}
		/**
		* L1 merge: recent list × bound topics. Topic activity newer than the last
		* group message wins the preview (prefix 「话题·」) and the sort key.
		*/
		function buildConvRows(recent, bound) {
			const boundById = new Map(bound.map((room) => [room.groupId, room]));
			const seen = /* @__PURE__ */ new Set();
			const rows = [];
			for (const item of recent) {
				seen.add(item.groupId);
				const host = boundById.get(item.groupId);
				const topics = host?.topics ?? [];
				const latestTopic = topics.reduce((best, topic) => {
					if (best === void 0 || topic.lastActivity > best.lastActivity) return topic;
					return best;
				}, void 0);
				const groupMs = listTimeMs(item.lastMsgSendTime);
				const topicMs = latestTopic?.lastActivity ?? 0;
				const topicWins = topicMs > groupMs && latestTopic !== void 0;
				const sortKey = Math.max(groupMs, topicMs);
				const preview = topicWins ? `话题·${topicNavLabel(host?.groupName ?? item.groupName, latestTopic.title)}` : previewOf(item.lastMsg);
				const badge = topicListBadge(topics);
				rows.push({
					groupId: item.groupId,
					groupName: displayGroupName(host?.groupName, item.groupName, host?.yzjKind ?? kindOf(item.groupId)),
					sessionId: host?.sessionId ?? "",
					yzjKind: host?.yzjKind ?? kindOf(item.groupId),
					preview,
					timeLabel: clockLabel(sortKey, item.lastMsgSendTime),
					sortKey,
					topicCount: topics.length,
					confirmCount: badge.confirmCount,
					hasRunning: badge.hasRunning,
					opened: host !== void 0,
					...item.headerUrl === void 0 ? {} : { headerUrl: item.headerUrl }
				});
			}
			for (const host of bound) {
				if (seen.has(host.groupId)) continue;
				const latestTopic = host.topics.reduce((best, topic) => {
					if (best === void 0 || topic.lastActivity > best.lastActivity) return topic;
					return best;
				}, void 0);
				const badge = topicListBadge(host.topics);
				rows.push({
					groupId: host.groupId,
					groupName: displayGroupName(host.groupName, "", host.yzjKind),
					sessionId: host.sessionId,
					yzjKind: host.yzjKind,
					preview: latestTopic === void 0 ? "" : `话题·${topicNavLabel(host.groupName, latestTopic.title)}`,
					timeLabel: clockLabel(latestTopic?.lastActivity ?? 0, ""),
					sortKey: latestTopic?.lastActivity ?? 0,
					topicCount: host.topics.length,
					confirmCount: badge.confirmCount,
					hasRunning: badge.hasRunning,
					opened: true
				});
			}
			return rows.sort((a, b) => b.sortKey - a.sortKey);
		}
		/** Survives `conversation.view` remounts so the left list does not flash empty. */
		let convListHold;
		function rememberConvList(next) {
			convListHold = next;
		}
		/**
		* Left column of the group-room workbench. Further CLI pages load when the
		* list is scrolled to the bottom (or when the first page does not fill it).
		*/
		function YzjConvList(props) {
			const [bound, setBound] = (0, react.useState)(() => convListHold?.bound ?? []);
			const [recent, setRecent] = (0, react.useState)(() => convListHold?.recent ?? []);
			const [error, setError] = (0, react.useState)("");
			const [page, setPage] = (0, react.useState)(() => convListHold?.page ?? 1);
			const [more, setMore] = (0, react.useState)(() => convListHold?.more ?? false);
			const [loading, setLoading] = (0, react.useState)(false);
			const [groupsTick, setGroupsTick] = (0, react.useState)(0);
			const bodyRef = (0, react.useRef)(null);
			const pageRef = (0, react.useRef)(page);
			const moreRef = (0, react.useRef)(more);
			const loadingRef = (0, react.useRef)(false);
			pageRef.current = page;
			moreRef.current = more;
			(0, react.useEffect)(() => {
				rememberConvList({
					bound,
					recent,
					page,
					more
				});
			}, [
				bound,
				recent,
				page,
				more
			]);
			(0, react.useEffect)(() => {
				let cancelled = false;
				const load = async () => {
					const result = await props.homeNav();
					if (cancelled) return;
					if (!result.ok) {
						setError(result.error.message);
						return;
					}
					setError("");
					setBound(parseNavRooms(result.value));
				};
				load();
				const timer = window.setInterval(() => {
					load();
				}, 2e3);
				return () => {
					cancelled = true;
					window.clearInterval(timer);
				};
			}, []);
			(0, react.useEffect)(() => {
				if (props.fetchGroups === void 0) return;
				let cancelled = false;
				props.fetchGroups(20, 1).then((result) => {
					if (cancelled) return;
					if (!result.ok) {
						setError(result.error.message);
						return;
					}
					setError("");
					const parsed = parseRecentGroups(result.value);
					setRecent(parsed.rooms);
					setMore(parsed.more);
					setPage(1);
				});
				return () => {
					cancelled = true;
				};
			}, [groupsTick]);
			const rows = buildConvRows(recent, bound);
			const openRow = (row) => {
				if (props.onSelectGroup !== void 0) {
					props.onSelectGroup(row);
					return;
				}
				if (row.opened && row.sessionId !== "") props.focusBoundSession?.(row.sessionId);
			};
			const loadMore = () => {
				const fetchGroups = props.fetchGroups;
				if (loadingRef.current || !moreRef.current || fetchGroups === void 0) return;
				loadingRef.current = true;
				setLoading(true);
				const nextPage = pageRef.current + 1;
				fetchGroups(20, nextPage).then((result) => {
					loadingRef.current = false;
					setLoading(false);
					if (!result.ok) {
						setError(result.error.message);
						return;
					}
					const parsed = parseRecentGroups(result.value);
					setRecent((prev) => {
						const seen = new Set(prev.map((room) => room.groupId));
						return [...prev, ...parsed.rooms.filter((room) => !seen.has(room.groupId))];
					});
					setMore(parsed.more === true && parsed.rooms.length > 0);
					setPage(nextPage);
				});
			};
			const maybeLoadMore = () => {
				const el = bodyRef.current;
				if (el === null || el.clientHeight === 0) return;
				if (el.scrollHeight - el.scrollTop - el.clientHeight <= 80) loadMore();
			};
			(0, react.useEffect)(() => {
				maybeLoadMore();
			});
			const login = props.authStatus !== void 0 && props.authLogin !== void 0 ? (0, react_jsx_runtime.jsx)(YzjLoginBanner, {
				authStatus: props.authStatus,
				authLogin: props.authLogin,
				compact: true,
				onLoggedIn: () => {
					setError("");
					setGroupsTick((tick) => tick + 1);
				}
			}) : null;
			return (0, react_jsx_runtime.jsxs)("nav", {
				className: home_module_css_default.convList,
				"data-testid": "yzj-conv-list",
				"aria-label": "会话",
				children: [
					login,
					error !== "" && login === null && (0, react_jsx_runtime.jsx)("p", {
						className: home_module_css_default.convListHint,
						children: error
					}),
					rows.length === 0 && error === "" && (0, react_jsx_runtime.jsx)("p", {
						className: home_module_css_default.convListHint,
						children: "还没有最近会话。点侧栏脚「云之家」打开一个。"
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: home_module_css_default.convListBody,
						ref: bodyRef,
						"data-testid": "yzj-conv-list-body",
						onScroll: maybeLoadMore,
						children: rows.map((row) => {
							const active = row.groupId === props.activeGroupId || row.sessionId !== "" && row.sessionId === props.sessionId;
							const glyph = row.headerUrl !== void 0 && row.headerUrl !== "" ? (0, react_jsx_runtime.jsx)("img", {
								src: row.headerUrl,
								alt: "",
								referrerPolicy: "no-referrer"
							}) : row.groupName.slice(0, 1);
							return (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: `${home_module_css_default.convRow} ${active ? home_module_css_default.convRowActive : ""}`,
								"aria-current": active ? "page" : void 0,
								"data-testid": `yzj-conv-row-${row.groupId}`,
								onClick: () => openRow(row),
								children: [(0, react_jsx_runtime.jsx)("span", {
									className: home_module_css_default.convGlyph,
									"aria-hidden": "true",
									children: glyph
								}), (0, react_jsx_runtime.jsxs)("span", {
									className: home_module_css_default.convRowBody,
									children: [(0, react_jsx_runtime.jsxs)("span", {
										className: home_module_css_default.convRowTop,
										children: [(0, react_jsx_runtime.jsx)("span", {
											className: home_module_css_default.convRowName,
											children: row.groupName
										}), (0, react_jsx_runtime.jsx)("span", {
											className: home_module_css_default.convRowTime,
											children: row.timeLabel
										})]
									}), (0, react_jsx_runtime.jsxs)("span", {
										className: home_module_css_default.convRowBottom,
										children: [(0, react_jsx_runtime.jsx)("span", {
											className: home_module_css_default.convRowPreview,
											children: row.preview
										}), row.confirmCount > 0 ? (0, react_jsx_runtime.jsx)("span", {
											className: home_module_css_default.convBadge,
											"data-testid": "yzj-conv-badge",
											title: `${row.confirmCount} 个待确认话题`,
											children: row.confirmCount
										}) : row.hasRunning ? (0, react_jsx_runtime.jsx)("span", {
											className: home_module_css_default.convDot,
											"data-testid": "yzj-conv-dot",
											title: `${row.topicCount} 个进行中话题`
										}) : null]
									})]
								})]
							}, row.groupId);
						})
					}),
					loading && (0, react_jsx_runtime.jsx)("p", {
						className: home_module_css_default.convListHint,
						"data-testid": "yzj-conv-more",
						children: "加载中…"
					})
				]
			});
		}
		//#endregion
		//#region \0dsh-css:/Users/guoxinshan/dev/dsh-yzj/packages/ui-yzj/src/client/panel.module.css.mjs
		const css$5 = "._0i_F6a_toggle{width:100%;color:var(--dsw-alias-label-secondary);cursor:pointer;transition:background-color .12s var(--ds-ease-in-out,ease), color .12s var(--ds-ease-in-out,ease);background:0 0;border:none;border-radius:8px;justify-content:center;align-items:center;gap:6px;padding:6px 10px;display:flex}._0i_F6a_toggle:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}._0i_F6a_toggleActive{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-static-deepseek-500)}._0i_F6a_toggleLabel{white-space:nowrap;font-size:12px;font-weight:500}._0i_F6a_unreadBadge{background:var(--dsw-static-red-500);color:#fff;text-align:center;border-radius:999px;flex:none;min-width:16px;height:16px;padding:0 4px;font-size:10px;line-height:16px;position:relative}._0i_F6a_panel{z-index:100;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);width:min(880px,96vw);height:min(700px,94vh);color:var(--dsw-alias-label-primary);border-radius:14px;flex-direction:column;margin:auto;font-size:14px;line-height:20px;display:flex;position:fixed;inset:0;overflow:hidden;box-shadow:0 16px 48px #0000002e}._0i_F6a_panelEmbedded{z-index:0;width:100%;height:100%;min-height:0;box-shadow:none;border:none;border-radius:0;margin:0;position:relative;inset:auto}._0i_F6a_header{flex:none;align-items:center;gap:8px;padding:10px 12px;display:flex}._0i_F6a_brand{color:var(--dsw-static-deepseek-500);flex:none;align-items:center;display:inline-flex}._0i_F6a_title{flex:none;font-size:14px;font-weight:600}._0i_F6a_headerSpacer{flex:1}._0i_F6a_tabs{border-bottom:1px solid var(--dsw-alias-border-l1);flex:none;gap:2px;padding:2px 12px 8px;display:flex;overflow:hidden}._0i_F6a_tab{color:var(--dsw-alias-label-secondary);cursor:pointer;transition:background-color .12s var(--ds-ease-in-out,ease), color .12s var(--ds-ease-in-out,ease);background:0 0;border:none;border-radius:8px;flex:1;justify-content:center;align-items:center;gap:4px;padding:5px 8px;font-size:12px;display:inline-flex}._0i_F6a_tab:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}._0i_F6a_tabActive{background:var(--dsw-static-deepseek-100);color:var(--dsw-static-deepseek-600);font-weight:600}._0i_F6a_tabActive:hover{background:var(--dsw-static-deepseek-100);color:var(--dsw-static-deepseek-600)}._0i_F6a_iconButton{width:26px;height:26px;color:var(--dsw-alias-label-secondary);cursor:pointer;transition:background-color .12s var(--ds-ease-in-out,ease), color .12s var(--ds-ease-in-out,ease);background:0 0;border:none;border-radius:7px;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}._0i_F6a_iconButton:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}._0i_F6a_iconButton:disabled{opacity:.5;cursor:default}._0i_F6a_headerButton{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);cursor:pointer;transition:background-color .12s var(--ds-ease-in-out,ease);border-radius:8px;flex:none;padding:5px 12px;font-size:12px}._0i_F6a_headerButton:hover{background:var(--dsw-alias-interactive-bg-hover)}._0i_F6a_headerButton:disabled{opacity:.5;cursor:default}._0i_F6a_body{flex-direction:column;flex:1;min-height:0;display:flex;overflow:hidden}._0i_F6a_twoPane{flex:1;min-height:0;display:flex}._0i_F6a_paneLeft{border-right:1px solid var(--dsw-alias-border-l1);flex-direction:column;flex:none;width:250px;min-height:0;display:flex}._0i_F6a_docSearch{flex:none;padding:8px 8px 0}._0i_F6a_docSearchInput{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);width:100%;color:var(--dsw-alias-label-primary);border-radius:8px;outline:none;padding:0 10px;font-size:12px;line-height:28px}._0i_F6a_docSearchInput:focus{border-color:var(--dsw-static-deepseek-500)}._0i_F6a_paneGroupLabel{color:var(--dsw-alias-label-tertiary);letter-spacing:.5px;flex:none;padding:6px 4px 2px;font-size:10.5px;font-weight:600}._0i_F6a_paneRight{flex-direction:column;flex:1;min-width:0;min-height:0;display:flex}._0i_F6a_paneList{flex-direction:column;flex:1;gap:3px;min-height:0;padding:8px;display:flex;overflow:auto}._0i_F6a_paneEmpty{min-height:0;color:var(--dsw-alias-label-tertiary);flex-direction:column;flex:1;justify-content:center;align-items:center;gap:8px;font-size:13px;display:flex}._0i_F6a_paneHead{flex:none;align-items:center;gap:8px;padding:4px 10px 8px;display:flex}._0i_F6a_paneTitle{text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:14px;font-weight:600;overflow:hidden}._0i_F6a_itemActive{background:var(--dsw-static-deepseek-100);box-shadow:inset 3px 0 0 var(--dsw-static-deepseek-500)}._0i_F6a_itemActive:hover{background:var(--dsw-static-deepseek-100)}._0i_F6a_itemActive ._0i_F6a_itemTitleText{color:var(--dsw-static-deepseek-600);font-weight:700}._0i_F6a_readAllRow{border-bottom:1px solid var(--dsw-alias-border-l1);flex:none;justify-content:space-between;align-items:center;gap:8px;padding:6px 12px;display:flex}._0i_F6a_readAllHint{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:16px}._0i_F6a_readAll{border:1px solid var(--dsw-static-deepseek-500);color:var(--dsw-static-deepseek-500);cursor:pointer;transition:background-color .12s var(--ds-ease-in-out,ease), color .12s var(--ds-ease-in-out,ease);background:0 0;border-radius:999px;flex:none;padding:3px 12px;font-size:12px;line-height:18px}._0i_F6a_readAll:hover:not(:disabled){background:var(--dsw-static-deepseek-100)}._0i_F6a_readAll:disabled{opacity:.45;cursor:default}._0i_F6a_error{border-bottom:1px solid var(--dsw-static-red-500);background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-static-red-400);flex:none;align-items:center;gap:8px;padding:7px 12px;font-size:12px;display:flex}._0i_F6a_errorText{text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;overflow:hidden}._0i_F6a_errorDismiss{width:20px;height:20px;color:inherit;cursor:pointer;background:0 0;border:none;border-radius:5px;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}._0i_F6a_errorDismiss:hover{background:var(--dsw-alias-interactive-bg-hover)}._0i_F6a_loading{color:var(--dsw-alias-label-tertiary);flex:none;padding:6px 12px;font-size:12px}._0i_F6a_list{flex-direction:column;flex:1;gap:3px;padding:8px;display:flex;overflow:auto}._0i_F6a_item{color:var(--dsw-alias-label-primary);text-align:left;cursor:pointer;min-width:0;transition:background-color .12s var(--ds-ease-in-out,ease);background:0 0;border:none;border-radius:10px;flex-direction:column;gap:3px;padding:8px 10px;font-size:14px;display:flex}._0i_F6a_item:hover{background:var(--dsw-alias-interactive-bg-hover)}._0i_F6a_itemTitle{align-items:center;gap:10px;min-width:0;font-weight:500;display:flex}._0i_F6a_itemTitleText{text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;overflow:hidden}._0i_F6a_itemSub{color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;padding-left:42px;font-size:12px;line-height:16px;overflow:hidden}._0i_F6a_docGlyph,._0i_F6a_groupGlyph,._0i_F6a_userGlyph{background:var(--dsw-static-deepseek-100);width:32px;height:32px;color:var(--dsw-static-deepseek-600);border-radius:8px;flex:none;justify-content:center;align-items:center;font-size:14px;font-weight:600;display:inline-flex}._0i_F6a_badge{background:var(--dsw-static-red-500);color:#fff;border-radius:999px;flex:none;padding:0 6px;font-size:11px;line-height:16px}._0i_F6a_itemAnchored{outline:2px solid var(--dsw-static-deepseek-500);outline-offset:-1px;background:var(--dsw-static-deepseek-100)}._0i_F6a_msgItem{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);padding-left:18px;position:relative}._0i_F6a_msgRow{border-radius:10px;align-items:flex-start;gap:8px;min-width:0;padding:4px 10px 4px 18px;display:flex;position:relative}._0i_F6a_msgRow:hover{background:var(--dsw-alias-interactive-bg-hover)}._0i_F6a_msgRowSystem{justify-content:center;padding-left:10px}._0i_F6a_msgAvatar{object-fit:cover;background:var(--dsw-alias-bg-layer-2);border-radius:50%;flex:none;width:28px;height:28px;margin-top:2px}._0i_F6a_msgAvatarFallback{background:var(--dsw-static-deepseek-100);width:28px;height:28px;color:var(--dsw-static-deepseek-600);border-radius:50%;flex:none;justify-content:center;align-items:center;margin-top:2px;font-size:12px;font-weight:600;display:inline-flex}._0i_F6a_msgStack{flex-direction:column;flex:1;align-items:flex-start;min-width:0;display:flex}._0i_F6a_msgMetaLine{align-items:baseline;gap:8px;min-width:0;margin-top:1px;display:flex}._0i_F6a_msgTime{color:var(--dsw-alias-label-caption);font-variant-numeric:tabular-nums;flex:none;font-size:11px;line-height:14px}._0i_F6a_msgContent{min-width:0;margin-top:2px}._0i_F6a_anchorTag{background:var(--dsw-static-deepseek-100);color:var(--dsw-static-deepseek-600);border-radius:999px;flex:none;padding:0 6px;font-size:10px;line-height:16px}._0i_F6a_anchorHint{border:1px solid var(--dsw-static-deepseek-500);background:var(--dsw-static-deepseek-100);color:var(--dsw-static-deepseek-600);border-radius:8px;flex:none;margin:0 10px;padding:4px 10px;font-size:11px;line-height:16px}._0i_F6a_groupChips{scrollbar-width:none;flex:none;gap:6px;padding:6px 10px 2px;display:flex;overflow-x:auto}._0i_F6a_groupChips::-webkit-scrollbar{display:none}._0i_F6a_groupChip{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);cursor:pointer;transition:border-color .12s var(--ds-ease-in-out,ease), background-color .12s var(--ds-ease-in-out,ease), color .12s var(--ds-ease-in-out,ease);border-radius:999px;flex:none;align-items:center;gap:5px;padding:3px 10px;font-size:12px;line-height:18px;display:inline-flex}._0i_F6a_groupChip:hover{border-color:var(--dsw-static-deepseek-500);color:var(--dsw-alias-label-primary)}._0i_F6a_groupChipActive{border-color:var(--dsw-static-deepseek-500);background:var(--dsw-static-deepseek-100);color:var(--dsw-static-deepseek-600);font-weight:600}._0i_F6a_chipBadge{background:var(--dsw-static-red-500);color:#fff;border-radius:999px;padding:0 5px;font-size:10px;line-height:14px}._0i_F6a_msgReply{color:var(--dsw-static-deepseek-500);cursor:pointer;opacity:0;transition:opacity .12s var(--ds-ease-in-out,ease), background-color .12s var(--ds-ease-in-out,ease);background:0 0;border:none;border-radius:6px;margin-top:2px;padding:2px 8px;font-size:11px;line-height:16px}._0i_F6a_msgRow:hover ._0i_F6a_msgReply{opacity:1}._0i_F6a_msgReply:hover{background:var(--dsw-alias-interactive-bg-hover)}._0i_F6a_dayDivider{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary);border-radius:999px;margin:6px auto 2px;padding:1px 10px;font-size:11px;line-height:18px;display:table}._0i_F6a_groupHead{align-items:center;gap:8px;padding:2px 10px 8px;display:flex}._0i_F6a_groupHeadName{text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:14px;font-weight:600;overflow:hidden}._0i_F6a_msgBody{color:var(--dsw-alias-label-primary);white-space:pre-wrap;word-break:break-word;min-width:0;font-size:13px;line-height:18px}._0i_F6a_chatHeader{border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);flex:none;align-items:center;gap:4px;padding:2px 4px 0;display:flex}._0i_F6a_panelBanner{background:var(--dsw-static-deepseek-100);color:var(--dsw-alias-label-secondary);border-radius:8px;margin:6px 8px 4px;padding:8px 10px;font-size:12px;line-height:18px}._0i_F6a_chatHeader ._0i_F6a_groupHead{padding:2px 6px 6px}._0i_F6a_back{color:var(--dsw-static-deepseek-500);text-align:left;cursor:pointer;transition:background-color .12s var(--ds-ease-in-out,ease);background:0 0;border:none;border-radius:6px;flex:none;align-items:center;gap:2px;padding:5px 8px;font-size:12px;display:inline-flex}._0i_F6a_back:hover{background:var(--dsw-static-deepseek-100)}._0i_F6a_more{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-static-deepseek-500);cursor:pointer;transition:background-color .12s var(--ds-ease-in-out,ease);border-radius:999px;flex:none;margin:6px auto 2px;padding:5px 14px;font-size:12px}._0i_F6a_more:hover:not(:disabled){background:var(--dsw-static-deepseek-100)}._0i_F6a_more:disabled{opacity:.5;cursor:default}._0i_F6a_empty{color:var(--dsw-alias-label-tertiary);text-align:center;flex-direction:column;align-items:center;gap:10px;padding:44px 0;font-size:12px;display:flex}._0i_F6a_searchRow{flex:none;gap:6px;padding:10px 10px 6px;display:flex}._0i_F6a_searchInput{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);transition:border-color .12s var(--ds-ease-in-out,ease), background-color .12s var(--ds-ease-in-out,ease);border-radius:8px;outline:none;flex:1;padding:6px 10px;font-size:13px}._0i_F6a_searchInput:focus{border-color:var(--dsw-static-deepseek-500);background:var(--dsw-alias-bg-base)}._0i_F6a_meCard{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:12px;flex:none;align-items:center;gap:12px;margin:6px 10px 8px;padding:12px;display:flex}._0i_F6a_meAvatar{object-fit:cover;border-radius:50%;flex:none;width:44px;height:44px}._0i_F6a_meAvatarFallback{background:var(--dsw-static-deepseek-100);width:44px;height:44px;color:var(--dsw-static-deepseek-600);border-radius:50%;flex:none;justify-content:center;align-items:center;font-size:18px;font-weight:600;display:inline-flex}._0i_F6a_meInfo{min-width:0}._0i_F6a_meName{font-size:15px;font-weight:600}._0i_F6a_meSub{color:var(--dsw-alias-label-tertiary);margin-top:2px;font-size:12px;line-height:16px}._0i_F6a_floatWrap{z-index:90;position:fixed;bottom:26px;right:26px}._0i_F6a_floatBall{background:var(--dsw-alias-button-info-fill);width:52px;height:52px;color:var(--dsw-alias-label-primary-foreground);cursor:pointer;transition:background-color .12s var(--ds-ease-in-out,ease), transform .12s var(--ds-ease-in-out,ease);border:none;border-radius:50%;justify-content:center;align-items:center;display:flex;position:relative;box-shadow:0 4px 14px #2e6ff259}._0i_F6a_floatBall:hover{background:var(--dsw-alias-button-info-hover);transform:scale(1.04)}._0i_F6a_floatBallActive{box-shadow:0 0 0 2px var(--dsw-alias-bg-base), 0 0 0 4px var(--dsw-static-deepseek-500), 0 4px 14px #2e6ff259}._0i_F6a_floatBallBadge{border:2px solid var(--dsw-alias-bg-base);background:var(--dsw-static-red-500);color:#fff;border-radius:999px;justify-content:center;align-items:center;min-width:20px;height:20px;padding:0 5px;font-size:11px;font-weight:700;line-height:16px;display:flex;position:absolute;top:-4px;right:-4px}._0i_F6a_floatDock{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);opacity:0;visibility:hidden;transition:opacity .12s var(--ds-ease-in-out,ease), transform .12s var(--ds-ease-in-out,ease), visibility .12s;border-radius:12px;flex-direction:column;gap:2px;padding:6px;display:flex;position:absolute;bottom:62px;right:0;transform:translateY(6px);box-shadow:0 12px 32px #00000024}._0i_F6a_floatDockOpen{opacity:1;visibility:visible;transform:none}._0i_F6a_floatDockItem{width:92px;color:var(--dsw-alias-label-secondary);cursor:pointer;transition:background-color .12s var(--ds-ease-in-out,ease), color .12s var(--ds-ease-in-out,ease);background:0 0;border:none;border-radius:8px;align-items:center;gap:8px;padding:6px 10px;display:flex;position:relative}._0i_F6a_floatDockItem:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}._0i_F6a_floatDockLabel{white-space:nowrap;font-size:12px;line-height:16px}._0i_F6a_floatDockBadge{border:1px solid var(--dsw-alias-bg-layer-1);background:var(--dsw-static-red-500);color:#fff;border-radius:999px;justify-content:center;align-items:center;min-width:16px;height:16px;padding:0 4px;font-size:10px;font-weight:700;line-height:14px;display:flex;position:absolute;top:2px;left:26px}._0i_F6a_panelToast{background:var(--dsw-static-neutral-bluish-850);color:var(--dsw-alias-label-primary-foreground);text-align:center;border-radius:999px;margin:2px 4px 6px;padding:8px 12px;font-size:11px;line-height:16px}._0i_F6a_avatar{object-fit:cover;background:var(--dsw-alias-bg-layer-2);border-radius:8px;flex:none;width:32px;height:32px}._0i_F6a_itemTime{color:var(--dsw-alias-label-caption);font-variant-numeric:tabular-nums;flex:none;font-size:11px;line-height:14px}._0i_F6a_msgSender{color:var(--dsw-alias-label-secondary);text-overflow:ellipsis;white-space:nowrap;flex:none;min-width:0;font-size:12px;font-weight:600;line-height:16px;overflow:hidden}._0i_F6a_msgQuote{color:var(--dsw-alias-label-tertiary);border-left:2px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-2);text-overflow:ellipsis;white-space:nowrap;border-radius:6px;min-width:0;margin:0 0 4px;padding:4px 8px;font-size:12px;line-height:16px;display:block;overflow:hidden}._0i_F6a_msgImage{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);cursor:zoom-in;border-radius:8px;max-width:100%;max-height:220px;margin-top:4px;display:block}._0i_F6a_msgBold{font-weight:600}._0i_F6a_msgImageSkeleton,._0i_F6a_msgImageFail{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary);border-radius:6px;margin-top:4px;padding:6px 10px;font-size:12px;line-height:16px;display:inline-block}._0i_F6a_msgImageFail{color:var(--dsw-static-red-400)}._0i_F6a_msgSystem{color:var(--dsw-alias-label-tertiary);text-align:center;font-size:12px;line-height:18px}._0i_F6a_msgFile{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);cursor:pointer;min-width:0;transition:border-color .12s var(--ds-ease-in-out,ease), background-color .12s var(--ds-ease-in-out,ease);border-radius:8px;align-items:center;gap:10px;margin-top:2px;padding:8px 10px;text-decoration:none;display:flex}._0i_F6a_msgFileGroup{align-items:stretch;gap:6px;min-width:0;display:flex}._0i_F6a_msgFile:hover:not(:disabled){border-color:var(--dsw-static-deepseek-500);background:var(--dsw-static-deepseek-100)}._0i_F6a_msgFile:disabled{opacity:.5;cursor:default}._0i_F6a_msgFileDownload{border:1px dashed var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);cursor:pointer;transition:border-color .12s var(--ds-ease-in-out,ease), color .12s var(--ds-ease-in-out,ease);background:0 0;border-radius:8px;flex:none;align-self:center;padding:4px 8px;font-size:11px;line-height:14px}._0i_F6a_msgFileDownload:hover{border-color:var(--dsw-static-deepseek-500);color:var(--dsw-static-deepseek-500)}._0i_F6a_msgFileIcon{flex:none;font-size:20px;line-height:20px}._0i_F6a_msgFileMeta{flex-direction:column;gap:2px;min-width:0;display:flex}._0i_F6a_msgFileName{text-overflow:ellipsis;white-space:nowrap;font-size:13px;line-height:16px;overflow:hidden}._0i_F6a_msgFileSize{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:14px}._0i_F6a_linkCard{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);min-width:0;transition:border-color .12s var(--ds-ease-in-out,ease);border-radius:8px;gap:10px;margin-top:2px;padding:8px 10px;text-decoration:none;display:flex}._0i_F6a_linkCard:hover{border-color:var(--dsw-static-deepseek-500)}._0i_F6a_linkCardThumb{object-fit:cover;background:var(--dsw-alias-bg-layer-2);border-radius:6px;flex:none;width:56px;height:56px}._0i_F6a_linkCardBody{flex-direction:column;flex:1;gap:3px;min-width:0;display:flex}._0i_F6a_linkCardTitle{text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:600;line-height:16px;overflow:hidden}._0i_F6a_linkCardDesc{color:var(--dsw-alias-label-secondary);-webkit-line-clamp:2;-webkit-box-orient:vertical;font-size:12px;line-height:16px;display:-webkit-box;overflow:hidden}._0i_F6a_linkCardAction{color:var(--dsw-static-deepseek-500);font-size:11px;line-height:14px}._0i_F6a_lightbox{z-index:200;cursor:zoom-out;background:#000000b8;justify-content:center;align-items:center;display:flex;position:fixed;inset:0}._0i_F6a_lightboxImg{border-radius:8px;max-width:90vw;max-height:90vh;box-shadow:0 24px 64px #00000080}._0i_F6a_lightboxPdf{background:#fff;border:none;border-radius:8px;width:min(720px,92vw);height:min(90vh,900px);box-shadow:0 24px 64px #00000080}._0i_F6a_composer{border-top:1px solid var(--dsw-alias-border-l1);flex-direction:column;flex:none;gap:6px;padding:8px 10px;display:flex;position:relative}._0i_F6a_composerRow{align-items:flex-end;gap:6px;display:flex;position:relative}._0i_F6a_atMenu{z-index:20;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);border-radius:10px;flex-direction:column;gap:1px;min-width:180px;max-width:260px;padding:4px;display:flex;position:absolute;bottom:calc(100% + 6px);left:0;box-shadow:0 8px 24px #0003}._0i_F6a_atHint{color:var(--dsw-alias-label-tertiary);padding:5px 8px;font-size:11px;line-height:15px}._0i_F6a_atItem{color:var(--dsw-alias-label-primary);cursor:pointer;text-align:left;background:0 0;border:none;border-radius:7px;align-items:center;gap:8px;padding:7px 8px;font-size:12.5px;line-height:1;display:flex}._0i_F6a_atItem:hover{background:var(--dsw-alias-interactive-bg-hover)}._0i_F6a_atGlyph{background:var(--dsw-static-deepseek-100);width:22px;height:22px;color:var(--dsw-static-deepseek-600);border-radius:50%;flex-shrink:0;justify-content:center;align-items:center;font-size:11px;font-weight:600;display:inline-flex}._0i_F6a_composerInput{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);min-width:0;color:var(--dsw-alias-label-primary);resize:none;max-height:120px;transition:border-color .12s var(--ds-ease-in-out,ease);border-radius:10px;outline:none;flex:1;padding:7px 10px;font-family:inherit;font-size:13px;line-height:18px;overflow-y:auto}._0i_F6a_composerInput:focus{border-color:var(--dsw-static-deepseek-500)}._0i_F6a_composerInput::placeholder{color:var(--dsw-alias-label-tertiary)}._0i_F6a_composerInput:disabled{opacity:.6}._0i_F6a_composerSend{background:var(--dsw-static-deepseek-500);color:#fff;cursor:pointer;transition:background-color .12s var(--ds-ease-in-out,ease), opacity .12s var(--ds-ease-in-out,ease);border:none;border-radius:10px;flex:none;padding:7px 14px;font-size:13px;font-weight:600}._0i_F6a_composerSend:hover:not(:disabled){background:var(--dsw-static-deepseek-600)}._0i_F6a_composerSend:disabled{opacity:.45;cursor:default}._0i_F6a_composerToolbar{align-items:center;gap:2px;display:flex}._0i_F6a_toolButton{cursor:pointer;width:26px;height:26px;transition:background-color .12s var(--ds-ease-in-out,ease);background:0 0;border:none;border-radius:6px;justify-content:center;align-items:center;font-size:15px;line-height:15px;display:inline-flex}._0i_F6a_toolButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}._0i_F6a_toolButton:disabled{opacity:.4;cursor:default}._0i_F6a_toolStatus{color:var(--dsw-alias-label-tertiary);margin-left:6px;font-size:11px}._0i_F6a_replyBar{border-left:2px solid var(--dsw-static-deepseek-500);background:var(--dsw-alias-bg-layer-1);border-radius:6px;align-items:center;gap:8px;padding:5px 8px;font-size:12px;display:flex}._0i_F6a_replyText{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-secondary);flex:1;overflow:hidden}._0i_F6a_replyCancel{color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;border-radius:4px;flex:none;padding:2px 4px;font-size:11px;line-height:14px}._0i_F6a_replyCancel:hover{background:var(--dsw-alias-interactive-bg-hover)}._0i_F6a_emojiPanel{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);z-index:30;border-radius:12px;grid-template-columns:repeat(8,1fr);gap:2px;padding:8px;display:grid;position:absolute;bottom:calc(100% - 4px);left:10px;box-shadow:0 12px 32px #00000029}._0i_F6a_emojiCell{cursor:pointer;background:0 0;border:none;border-radius:6px;justify-content:center;align-items:center;width:30px;height:30px;font-size:17px;display:inline-flex}._0i_F6a_emojiCell:hover{background:var(--dsw-alias-interactive-bg-hover)}._0i_F6a_calHead{flex:none;justify-content:space-between;align-items:center;padding:8px 10px 4px;display:flex}._0i_F6a_calTitle{font-size:13px;font-weight:600}._0i_F6a_calNav{width:24px;height:24px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:6px;font-size:16px;line-height:16px}._0i_F6a_calNav:hover{background:var(--dsw-alias-interactive-bg-hover)}._0i_F6a_calToday{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:999px;margin-left:6px;padding:4px 9px;font-size:11px;line-height:1;transition:border-color .15s,color .15s,background .15s}._0i_F6a_calToday:hover{border-color:var(--dsw-static-deepseek-500);background:var(--dsw-static-deepseek-100);color:var(--dsw-static-deepseek-600)}._0i_F6a_crumbs{flex-wrap:wrap;align-items:center;gap:2px;min-width:0;display:flex}._0i_F6a_crumbLink{color:var(--dsw-static-deepseek-500);cursor:pointer;text-overflow:ellipsis;white-space:nowrap;background:0 0;border:none;max-width:160px;padding:2px 3px;font-size:13px;line-height:18px;overflow:hidden}._0i_F6a_crumbLink:hover{text-decoration:underline}._0i_F6a_crumbItem{align-items:center;min-width:0;display:inline-flex}._0i_F6a_crumbSep{color:var(--dsw-alias-label-caption);padding:0 1px;font-size:12px}._0i_F6a_crumbCurrent{color:var(--dsw-alias-label-primary);text-overflow:ellipsis;white-space:nowrap;max-width:200px;padding:2px 3px;font-size:13px;font-weight:600;line-height:18px;overflow:hidden}._0i_F6a_docRowWrap{align-items:stretch;gap:4px;min-width:0;display:flex}._0i_F6a_docRowWrap ._0i_F6a_item{flex:1;min-width:0}._0i_F6a_drill{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);width:30px;color:var(--dsw-alias-label-tertiary);cursor:pointer;border-radius:9px;flex-shrink:0;justify-content:center;align-self:center;align-items:center;height:30px;transition:border-color .15s,color .15s,background .15s;display:inline-flex}._0i_F6a_drill:hover{border-color:var(--dsw-static-deepseek-500);color:var(--dsw-static-deepseek-600);background:var(--dsw-static-deepseek-100)}._0i_F6a_calGrid{grid-template-columns:repeat(7,1fr);gap:2px;padding:4px 10px 10px;display:grid}._0i_F6a_calDow{text-align:center;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:20px}._0i_F6a_calBlank{height:30px}._0i_F6a_calCell{height:30px;color:var(--dsw-alias-label-primary);cursor:pointer;transition:background-color .12s var(--ds-ease-in-out,ease);background:0 0;border:none;border-radius:8px;justify-content:center;align-items:center;font-size:12px;display:flex;position:relative}._0i_F6a_calCell:hover{background:var(--dsw-alias-interactive-bg-hover)}._0i_F6a_calCellToday{box-shadow:inset 0 0 0 1px var(--dsw-static-deepseek-500)}._0i_F6a_calCellSelected{background:var(--dsw-static-deepseek-100);color:var(--dsw-static-deepseek-600);font-weight:600}._0i_F6a_calCellHas{color:var(--dsw-static-deepseek-500);font-weight:600}._0i_F6a_calDayNum{line-height:18px}._0i_F6a_calDot{background:var(--dsw-static-deepseek-500);border-radius:50%;width:4px;height:4px;position:absolute;bottom:2px;left:50%;transform:translate(-50%)}._0i_F6a_eventTime{color:var(--dsw-static-deepseek-500);font-variant-numeric:tabular-nums;font-size:11px;line-height:14px}._0i_F6a_eventDetail{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:10px;flex-direction:column;gap:6px;margin-top:4px;padding:10px 12px;display:flex}._0i_F6a_eventDetailTitle{font-size:14px;font-weight:600;line-height:20px}._0i_F6a_eventDetailRow{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}._0i_F6a_eventDetailContent{border-top:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary);white-space:pre-wrap;word-break:break-word;margin-top:4px;padding-top:8px;font-size:13px;line-height:20px}._0i_F6a_docMeta{color:var(--dsw-alias-label-tertiary);flex:none;padding:0 10px 6px;font-size:11px;line-height:16px}._0i_F6a_docBody{min-height:0;color:var(--dsw-alias-label-primary);white-space:pre-wrap;word-break:break-word;flex-direction:column;flex:1;gap:4px;padding:2px 12px 12px;font-size:13px;line-height:22px;display:flex;overflow:auto}";
		const tagId$5 = "@dsh-yzj/bundle/ui-yzj/panel.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$5) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@dsh-yzj/bundle/ui-yzj";
			tag.dataset.pluginCss = tagId$5;
			tag.textContent = css$5;
			document.head.appendChild(tag);
		}
		var panel_module_css_default = {
			"floatDockItem": "_0i_F6a_floatDockItem",
			"chipBadge": "_0i_F6a_chipBadge",
			"chatHeader": "_0i_F6a_chatHeader",
			"msgQuote": "_0i_F6a_msgQuote",
			"crumbs": "_0i_F6a_crumbs",
			"readAllHint": "_0i_F6a_readAllHint",
			"calTitle": "_0i_F6a_calTitle",
			"paneGroupLabel": "_0i_F6a_paneGroupLabel",
			"paneRight": "_0i_F6a_paneRight",
			"list": "_0i_F6a_list",
			"replyCancel": "_0i_F6a_replyCancel",
			"panelBanner": "_0i_F6a_panelBanner",
			"paneLeft": "_0i_F6a_paneLeft",
			"lightboxPdf": "_0i_F6a_lightboxPdf",
			"panelEmbedded": "_0i_F6a_panelEmbedded",
			"groupGlyph": "_0i_F6a_groupGlyph",
			"msgReply": "_0i_F6a_msgReply",
			"msgItem": "_0i_F6a_msgItem",
			"groupHeadName": "_0i_F6a_groupHeadName",
			"meSub": "_0i_F6a_meSub",
			"floatBallActive": "_0i_F6a_floatBallActive",
			"itemTitle": "_0i_F6a_itemTitle",
			"composer": "_0i_F6a_composer",
			"eventDetailTitle": "_0i_F6a_eventDetailTitle",
			"itemAnchored": "_0i_F6a_itemAnchored",
			"msgSender": "_0i_F6a_msgSender",
			"item": "_0i_F6a_item",
			"itemActive": "_0i_F6a_itemActive",
			"calGrid": "_0i_F6a_calGrid",
			"crumbCurrent": "_0i_F6a_crumbCurrent",
			"calToday": "_0i_F6a_calToday",
			"empty": "_0i_F6a_empty",
			"msgAvatar": "_0i_F6a_msgAvatar",
			"msgContent": "_0i_F6a_msgContent",
			"floatDockLabel": "_0i_F6a_floatDockLabel",
			"calBlank": "_0i_F6a_calBlank",
			"msgStack": "_0i_F6a_msgStack",
			"calCellToday": "_0i_F6a_calCellToday",
			"readAll": "_0i_F6a_readAll",
			"searchRow": "_0i_F6a_searchRow",
			"paneTitle": "_0i_F6a_paneTitle",
			"meCard": "_0i_F6a_meCard",
			"body": "_0i_F6a_body",
			"lightbox": "_0i_F6a_lightbox",
			"groupChip": "_0i_F6a_groupChip",
			"errorText": "_0i_F6a_errorText",
			"iconButton": "_0i_F6a_iconButton",
			"atGlyph": "_0i_F6a_atGlyph",
			"paneList": "_0i_F6a_paneList",
			"emojiCell": "_0i_F6a_emojiCell",
			"toggleActive": "_0i_F6a_toggleActive",
			"meInfo": "_0i_F6a_meInfo",
			"linkCardBody": "_0i_F6a_linkCardBody",
			"anchorTag": "_0i_F6a_anchorTag",
			"msgFileName": "_0i_F6a_msgFileName",
			"title": "_0i_F6a_title",
			"groupHead": "_0i_F6a_groupHead",
			"atItem": "_0i_F6a_atItem",
			"calCellSelected": "_0i_F6a_calCellSelected",
			"msgImage": "_0i_F6a_msgImage",
			"docSearch": "_0i_F6a_docSearch",
			"itemSub": "_0i_F6a_itemSub",
			"lightboxImg": "_0i_F6a_lightboxImg",
			"eventDetailContent": "_0i_F6a_eventDetailContent",
			"itemTime": "_0i_F6a_itemTime",
			"msgTime": "_0i_F6a_msgTime",
			"linkCardThumb": "_0i_F6a_linkCardThumb",
			"toolButton": "_0i_F6a_toolButton",
			"linkCardTitle": "_0i_F6a_linkCardTitle",
			"atMenu": "_0i_F6a_atMenu",
			"crumbSep": "_0i_F6a_crumbSep",
			"brand": "_0i_F6a_brand",
			"unreadBadge": "_0i_F6a_unreadBadge",
			"atHint": "_0i_F6a_atHint",
			"docMeta": "_0i_F6a_docMeta",
			"floatDockOpen": "_0i_F6a_floatDockOpen",
			"msgRow": "_0i_F6a_msgRow",
			"emojiPanel": "_0i_F6a_emojiPanel",
			"linkCard": "_0i_F6a_linkCard",
			"error": "_0i_F6a_error",
			"floatBallBadge": "_0i_F6a_floatBallBadge",
			"groupChips": "_0i_F6a_groupChips",
			"composerToolbar": "_0i_F6a_composerToolbar",
			"toggleLabel": "_0i_F6a_toggleLabel",
			"calDayNum": "_0i_F6a_calDayNum",
			"dayDivider": "_0i_F6a_dayDivider",
			"back": "_0i_F6a_back",
			"badge": "_0i_F6a_badge",
			"eventDetailRow": "_0i_F6a_eventDetailRow",
			"loading": "_0i_F6a_loading",
			"floatWrap": "_0i_F6a_floatWrap",
			"composerRow": "_0i_F6a_composerRow",
			"panel": "_0i_F6a_panel",
			"replyBar": "_0i_F6a_replyBar",
			"floatDock": "_0i_F6a_floatDock",
			"paneHead": "_0i_F6a_paneHead",
			"toggle": "_0i_F6a_toggle",
			"userGlyph": "_0i_F6a_userGlyph",
			"msgFileMeta": "_0i_F6a_msgFileMeta",
			"panelToast": "_0i_F6a_panelToast",
			"msgFileDownload": "_0i_F6a_msgFileDownload",
			"docGlyph": "_0i_F6a_docGlyph",
			"msgFileIcon": "_0i_F6a_msgFileIcon",
			"floatDockBadge": "_0i_F6a_floatDockBadge",
			"meName": "_0i_F6a_meName",
			"calHead": "_0i_F6a_calHead",
			"msgFileGroup": "_0i_F6a_msgFileGroup",
			"linkCardAction": "_0i_F6a_linkCardAction",
			"calNav": "_0i_F6a_calNav",
			"headerSpacer": "_0i_F6a_headerSpacer",
			"calDot": "_0i_F6a_calDot",
			"meAvatar": "_0i_F6a_meAvatar",
			"eventDetail": "_0i_F6a_eventDetail",
			"drill": "_0i_F6a_drill",
			"calDow": "_0i_F6a_calDow",
			"itemTitleText": "_0i_F6a_itemTitleText",
			"searchInput": "_0i_F6a_searchInput",
			"header": "_0i_F6a_header",
			"meAvatarFallback": "_0i_F6a_meAvatarFallback",
			"calCell": "_0i_F6a_calCell",
			"crumbItem": "_0i_F6a_crumbItem",
			"composerInput": "_0i_F6a_composerInput",
			"eventTime": "_0i_F6a_eventTime",
			"headerButton": "_0i_F6a_headerButton",
			"floatBall": "_0i_F6a_floatBall",
			"paneEmpty": "_0i_F6a_paneEmpty",
			"toolStatus": "_0i_F6a_toolStatus",
			"twoPane": "_0i_F6a_twoPane",
			"msgSystem": "_0i_F6a_msgSystem",
			"errorDismiss": "_0i_F6a_errorDismiss",
			"msgAvatarFallback": "_0i_F6a_msgAvatarFallback",
			"linkCardDesc": "_0i_F6a_linkCardDesc",
			"msgMetaLine": "_0i_F6a_msgMetaLine",
			"docBody": "_0i_F6a_docBody",
			"msgBody": "_0i_F6a_msgBody",
			"avatar": "_0i_F6a_avatar",
			"msgFile": "_0i_F6a_msgFile",
			"msgRowSystem": "_0i_F6a_msgRowSystem",
			"anchorHint": "_0i_F6a_anchorHint",
			"groupChipActive": "_0i_F6a_groupChipActive",
			"readAllRow": "_0i_F6a_readAllRow",
			"tabActive": "_0i_F6a_tabActive",
			"msgBold": "_0i_F6a_msgBold",
			"msgImageFail": "_0i_F6a_msgImageFail",
			"tabs": "_0i_F6a_tabs",
			"docSearchInput": "_0i_F6a_docSearchInput",
			"msgImageSkeleton": "_0i_F6a_msgImageSkeleton",
			"crumbLink": "_0i_F6a_crumbLink",
			"docRowWrap": "_0i_F6a_docRowWrap",
			"replyText": "_0i_F6a_replyText",
			"more": "_0i_F6a_more",
			"msgFileSize": "_0i_F6a_msgFileSize",
			"tab": "_0i_F6a_tab",
			"composerSend": "_0i_F6a_composerSend",
			"calCellHas": "_0i_F6a_calCellHas"
		};
		//#endregion
		//#region lib/types/client/im-render.js
		/**
		* Shared Yunzhijia IM read-face (panel 会话 + group-room transcript).
		* Avatars, bracket-emoticons, inline images/files, reply quotes.
		* Does not implement reactions / recall / forward (R7).
		*/
		function asRecord$13(value) {
			return typeof value === "object" && value !== null ? value : {};
		}
		function asString$11(value) {
			return typeof value === "string" ? value : "";
		}
		function asArray$9(value) {
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
			if (url === "" || failed) return (0, react_jsx_runtime.jsx)("span", {
				className: panel_module_css_default.groupGlyph,
				children: name.slice(0, 1)
			});
			return (0, react_jsx_runtime.jsx)("img", {
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
			if (photo === "" || failed) return (0, react_jsx_runtime.jsx)("span", {
				className: panel_module_css_default.msgAvatarFallback,
				children: fallback.slice(0, 1)
			});
			return (0, react_jsx_runtime.jsx)("img", {
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
			if (failed) return (0, react_jsx_runtime.jsx)("span", {
				className: panel_module_css_default.msgImageFail,
				children: "图片加载失败"
			});
			if (src === null) return (0, react_jsx_runtime.jsx)("span", {
				className: panel_module_css_default.msgImageSkeleton,
				children: "加载中…"
			});
			return (0, react_jsx_runtime.jsx)("img", {
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
			const content = asString$11(message.content);
			const msgType = asString$11(message.msgType);
			const param = asRecord$13(message.param);
			if (msgType === "other" && asString$11(param.title) === "" && asRecord$13(param.interactiveCard).cardJson === void 0) return (0, react_jsx_runtime.jsx)("span", {
				className: panel_module_css_default.msgSystem,
				children: content === "" ? "(系统消息)" : emojiText(content)
			});
			if (asString$11(param.sysType) === "withdrawMsg") return (0, react_jsx_runtime.jsx)("span", {
				className: panel_module_css_default.msgSystem,
				children: content === "" ? "撤回了一条消息" : emojiText(content)
			});
			const replyMsgId = asString$11(param.replyMsgId);
			const replySummary = asString$11(param.replySummary);
			const replyPerson = asString$11(param.replyPersonName);
			const quote = replyMsgId !== "" ? (0, react_jsx_runtime.jsx)("span", {
				className: panel_module_css_default.msgQuote,
				title: replySummary,
				children: `↳ ${replyPerson === "" ? "" : `${replyPerson}：`}${replySummary}`
			}) : null;
			if (msgType === "file") {
				const fileId = asString$11(param.file_id);
				const name = asString$11(param.name) !== "" ? asString$11(param.name) : content.replace(/^\[文件\]:/, "");
				const size = formatSize(param.size);
				const ext = asString$11(param.ext).toLowerCase();
				if (/^(png|jpe?g|gif|webp|bmp)$/.test(ext) && fileId !== "") return (0, react_jsx_runtime.jsxs)("span", {
					className: panel_module_css_default.msgBody,
					children: [quote, (0, react_jsx_runtime.jsx)(ProxyImage, {
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
				return (0, react_jsx_runtime.jsxs)("span", {
					className: panel_module_css_default.msgBody,
					children: [quote, (0, react_jsx_runtime.jsxs)("span", {
						className: panel_module_css_default.msgFileGroup,
						children: [(0, react_jsx_runtime.jsxs)("button", {
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
							children: [(0, react_jsx_runtime.jsx)("span", {
								className: panel_module_css_default.msgFileIcon,
								children: icon
							}), (0, react_jsx_runtime.jsxs)("span", {
								className: panel_module_css_default.msgFileMeta,
								children: [(0, react_jsx_runtime.jsx)("span", {
									className: panel_module_css_default.msgFileName,
									children: name === "" ? "文件" : name
								}), (0, react_jsx_runtime.jsx)("span", {
									className: panel_module_css_default.msgFileSize,
									children: size === "" ? ext === "" ? "文件" : ext.toUpperCase() : size
								})]
							})]
						}), isPdf && fileId !== "" && (0, react_jsx_runtime.jsx)("button", {
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
			if (msgType === "other" && asString$11(param.title) !== "") {
				const title = asString$11(param.title);
				const thumb = asString$11(param.thumbUrl);
				const url = asString$11(param.webpageUrl);
				return (0, react_jsx_runtime.jsx)("span", {
					className: panel_module_css_default.msgBody,
					children: (0, react_jsx_runtime.jsxs)("a", {
						className: panel_module_css_default.linkCard,
						href: url === "" ? void 0 : url,
						target: "_blank",
						rel: "noreferrer",
						onClick: (event) => {
							event.stopPropagation();
						},
						children: [thumb !== "" && (0, react_jsx_runtime.jsx)("img", {
							className: panel_module_css_default.linkCardThumb,
							src: thumb,
							alt: "",
							loading: "lazy",
							referrerPolicy: "no-referrer"
						}), (0, react_jsx_runtime.jsxs)("span", {
							className: panel_module_css_default.linkCardBody,
							children: [
								(0, react_jsx_runtime.jsx)("span", {
									className: panel_module_css_default.linkCardTitle,
									children: title
								}),
								(0, react_jsx_runtime.jsx)("span", {
									className: panel_module_css_default.linkCardDesc,
									children: emojiText(content)
								}),
								url !== "" && (0, react_jsx_runtime.jsx)("span", {
									className: panel_module_css_default.linkCardAction,
									children: "查看详情 →"
								})
							]
						})]
					})
				});
			}
			if (msgType === "other") {
				const cardJson = asString$11(asRecord$13(param.interactiveCard).cardJson);
				const face = cardJson === "" ? {
					title: "",
					image: "",
					actionTitle: "",
					actionUrl: ""
				} : cardFace(cardJson);
				const title = face.title !== "" ? face.title : content;
				const actionUrl = face.actionUrl.startsWith("http") ? face.actionUrl : "";
				if (face.title !== "" || face.image !== "") return (0, react_jsx_runtime.jsx)("span", {
					className: panel_module_css_default.msgBody,
					children: (0, react_jsx_runtime.jsxs)("a", {
						className: panel_module_css_default.linkCard,
						href: actionUrl === "" ? void 0 : actionUrl,
						target: "_blank",
						rel: "noreferrer",
						onClick: (event) => {
							event.stopPropagation();
						},
						children: [face.image !== "" && (0, react_jsx_runtime.jsx)("img", {
							className: panel_module_css_default.linkCardThumb,
							src: face.image,
							alt: "",
							loading: "lazy",
							referrerPolicy: "no-referrer"
						}), (0, react_jsx_runtime.jsxs)("span", {
							className: panel_module_css_default.linkCardBody,
							children: [
								(0, react_jsx_runtime.jsx)("span", {
									className: panel_module_css_default.linkCardTitle,
									children: title
								}),
								(0, react_jsx_runtime.jsx)("span", {
									className: panel_module_css_default.linkCardDesc,
									children: emojiText(content)
								}),
								actionUrl !== "" && (0, react_jsx_runtime.jsxs)("span", {
									className: panel_module_css_default.linkCardAction,
									children: [face.actionTitle === "" ? "查看详情" : face.actionTitle, " →"]
								})
							]
						})]
					})
				});
				return (0, react_jsx_runtime.jsx)("span", {
					className: panel_module_css_default.msgSystem,
					children: content === "" ? "(系统消息)" : emojiText(content)
				});
			}
			if (msgType === "richText") {
				const desc = asArray$9(param.desc);
				const images = [];
				const bolds = [];
				for (const raw of desc) {
					const seg = asRecord$13(raw);
					const segType = asString$11(seg.type);
					if (segType === "image") {
						const fileId = asString$11(seg.data);
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
				return (0, react_jsx_runtime.jsxs)("span", {
					className: panel_module_css_default.msgBody,
					children: [
						quote,
						spans.map((span, index) => (0, react_jsx_runtime.jsx)("span", {
							className: span.bold ? panel_module_css_default.msgBold : void 0,
							children: emojiText(span.text)
						}, `t${index}`)),
						imgSpans.map((image, index) => (0, react_jsx_runtime.jsx)(ProxyImage, {
							fileId: image.fileId,
							alt: "",
							onOpen: onOpenImage,
							inject
						}, `i${index}`))
					]
				});
			}
			return (0, react_jsx_runtime.jsxs)("span", {
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
					if (emoji !== void 0) return (0, react_jsx_runtime.jsx)("span", { children: emoji }, index);
				}
				return part;
			});
		}
		/** Full-screen image / PDF preview (same chrome as the floating panel). */
		function ImLightbox({ src, kind, onClose }) {
			return (0, react_jsx_runtime.jsx)("div", {
				className: panel_module_css_default.lightbox,
				role: "presentation",
				onClick: onClose,
				children: kind === "pdf" ? (0, react_jsx_runtime.jsx)("embed", {
					className: panel_module_css_default.lightboxPdf,
					src,
					type: "application/pdf",
					onClick: (event) => event.stopPropagation()
				}) : (0, react_jsx_runtime.jsx)("img", {
					className: panel_module_css_default.lightboxImg,
					src,
					alt: "",
					onClick: (event) => event.stopPropagation()
				})
			});
		}
		//#endregion
		//#region lib/types/client/reply-bus.js
		/**
		* One-slot bus from the group-room timeline to the room composer:
		* 「回复」on a row arms the composer reply bar. Exactly one composer
		* listens per session view.
		*/
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
		//#region lib/types/client/advance-feed-picker.js
		/**
		* Pick an open 推进事项 and type one sentence (docs/spec/ai-advance-design.md §11).
		* User-direct feed — the caller posts `/yzj advance-feed` (no confirm card).
		*/
		function asRecord$12(value) {
			return typeof value === "object" && value !== null ? value : {};
		}
		function asString$10(value) {
			return typeof value === "string" ? value : "";
		}
		function asArray$8(value) {
			return Array.isArray(value) ? value : [];
		}
		/** Modal: choose an item + one sentence, then feed. */
		function AdvanceFeedPicker(props) {
			const [items, setItems] = (0, react.useState)([]);
			const [ready, setReady] = (0, react.useState)(false);
			const [selected, setSelected] = (0, react.useState)(props.presetId ?? "");
			const [summary, setSummary] = (0, react.useState)(props.defaultSummary);
			const [error, setError] = (0, react.useState)("");
			const [busy, setBusy] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				let cancelled = false;
				props.advanceState().then((result) => {
					if (cancelled) return;
					if (!result.ok) {
						setError(result.error.message);
						return;
					}
					const raw = asArray$8(asRecord$12(result.value).items);
					const rows = [];
					for (const row of raw) {
						const rec = asRecord$12(row);
						const advanceId = asString$10(rec.advanceId);
						if (advanceId === "") continue;
						rows.push({
							advanceId,
							title: asString$10(rec.title) || advanceId,
							stage: asString$10(rec.stage),
							latest: asString$10(rec.latest)
						});
					}
					setItems(rows);
					setReady(asRecord$12(result.value).ready === true);
					if (props.presetId !== void 0 && rows.some((item) => item.advanceId === props.presetId)) setSelected(props.presetId);
					else if (rows[0] !== void 0 && selected === "") setSelected(rows[0].advanceId);
				});
				return () => {
					cancelled = true;
				};
			}, [props.advanceState, props.presetId]);
			const submit = async () => {
				const text = summary.trim();
				if (selected === "") {
					setError("请选择一个推进事项");
					return;
				}
				if (text === "") {
					setError("写一句要喂进去的话");
					return;
				}
				setBusy(true);
				setError("");
				const result = await props.onSubmit(selected, text);
				if (!result.ok) {
					setError(result.error.message);
					setBusy(false);
					return;
				}
				props.onClose();
			};
			return (0, react_jsx_runtime.jsx)("div", {
				className: home_module_css_default.modalMask,
				role: "dialog",
				"aria-modal": "true",
				"aria-label": "喂给推进",
				"data-testid": "yzj-advance-feed-picker",
				children: (0, react_jsx_runtime.jsxs)("div", {
					className: home_module_css_default.modal,
					children: [
						(0, react_jsx_runtime.jsx)("h3", { children: "喂给推进" }),
						(0, react_jsx_runtime.jsx)("p", { children: "这句话会作为一条事元挂到选中的事项上，群里其他人看不见。不改阶段。" }),
						!ready && items.length === 0 && error === "" && (0, react_jsx_runtime.jsx)("p", { children: "推进看板还没有开通。到「推进」页签开通后再喂。" }),
						ready && items.length === 0 && error === "" && (0, react_jsx_runtime.jsx)("p", { children: "还没有推进事项。到「推进」页签发起一条。" }),
						(0, react_jsx_runtime.jsx)("div", {
							className: home_module_css_default.pick,
							"data-testid": "yzj-advance-feed-list",
							children: items.map((item) => (0, react_jsx_runtime.jsxs)("label", {
								className: home_module_css_default.candidate,
								children: [(0, react_jsx_runtime.jsx)("input", {
									type: "radio",
									name: "yzj-advance-feed-item",
									checked: selected === item.advanceId,
									onChange: () => setSelected(item.advanceId)
								}), (0, react_jsx_runtime.jsxs)("span", { children: [
									(0, react_jsx_runtime.jsx)("strong", { children: item.title }),
									(0, react_jsx_runtime.jsxs)("span", { children: [
										" ",
										item.advanceId,
										" · ",
										item.stage
									] }),
									item.latest !== "" && (0, react_jsx_runtime.jsxs)("span", { children: [" · ", item.latest.slice(0, 40)] })
								] })]
							}, item.advanceId))
						}),
						(0, react_jsx_runtime.jsxs)("label", {
							className: home_module_css_default.pick,
							children: ["一句话", (0, react_jsx_runtime.jsx)("textarea", {
								"data-testid": "yzj-advance-feed-summary",
								value: summary,
								onChange: (event) => setSummary(event.target.value),
								rows: 3,
								style: {
									width: "100%",
									marginTop: 6
								}
							})]
						}),
						error !== "" && (0, react_jsx_runtime.jsx)("p", {
							role: "alert",
							children: error
						}),
						(0, react_jsx_runtime.jsxs)("div", {
							className: home_module_css_default.actions,
							children: [(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: home_module_css_default.chromeBtn,
								onClick: props.onClose,
								children: "取消"
							}), (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: `${home_module_css_default.chromeBtn} ${home_module_css_default.chromePrimary}`,
								"data-testid": "yzj-advance-feed-submit",
								disabled: busy || items.length === 0,
								onClick: () => {
									submit();
								},
								children: busy ? "写入中…" : "喂进去"
							})]
						})
					]
				})
			});
		}
		//#endregion
		//#region lib/types/client/advance-feedback.js
		/**
		* Pending 「现在反馈」 card (docs/spec/ai-advance-design.md §11.3).
		* Module-level bus — workbench domain switch does not share a React tree
		* with the advance pane, same pattern as workbench-domain.ts.
		*/
		let current$2 = null;
		const listeners$2 = /* @__PURE__ */ new Set();
		/** Current card, or null when none. */
		function getAdvanceFeedback() {
			return current$2;
		}
		/** Set or clear the pending feedback card. */
		function setAdvanceFeedback(next) {
			current$2 = next;
			for (const listener of listeners$2) listener();
		}
		/** Subscribe to card changes. Returns the disposer. */
		function subscribeAdvanceFeedback(listener) {
			listeners$2.add(listener);
			return () => {
				listeners$2.delete(listener);
			};
		}
		/** React face for {@link getAdvanceFeedback}. */
		function useAdvanceFeedback() {
			const [card, setCard] = (0, react.useState)(getAdvanceFeedback);
			(0, react.useEffect)(() => subscribeAdvanceFeedback(() => {
				setCard(getAdvanceFeedback());
			}), []);
			return card;
		}
		//#endregion
		//#region lib/types/client/advance-ask.js
		/**
		* Pending 「请 AI 验收」 draft (docs/spec/ai-advance-design.md §12.3).
		* Module-level bus — same pattern as advance-feedback.ts / workbench-domain.
		* The draft is written into the topic 问助手 input; we never auto-send.
		*/
		let current$1 = null;
		const listeners$1 = /* @__PURE__ */ new Set();
		/** Current draft, or null when none. */
		function getAdvanceAskDraft() {
			return current$1;
		}
		/** Set or clear the pending ask draft. */
		function setAdvanceAskDraft(next) {
			current$1 = next;
			for (const listener of listeners$1) listener();
		}
		/** Subscribe to draft changes. Returns the disposer. */
		function subscribeAdvanceAskDraft(listener) {
			listeners$1.add(listener);
			return () => {
				listeners$1.delete(listener);
			};
		}
		/** React face for {@link getAdvanceAskDraft}. */
		function useAdvanceAskDraft() {
			const [draft, setDraft] = (0, react.useState)(getAdvanceAskDraft);
			(0, react.useEffect)(() => subscribeAdvanceAskDraft(() => {
				setDraft(getAdvanceAskDraft());
			}), []);
			return draft;
		}
		/** Topic 问助手 prefill for 验收辅助 (spec §12 / PRD §6.3). */
		function reviewAskText(advanceId, title) {
			return `请对推进事项 ${advanceId}「${title}」做验收辅助。先调用 yzj_advance_inspect（mode=review，advanceId=${advanceId}），对照成功指标逐条说明是否达标、有无踩红线，给一句话结论。不要 stageTo=completed，也不要替我点确认达到目标；若产物已齐，用 yzj_advance_feed changeType=验收请求 stageTo=ready-for-review（确认卡）；未齐则只 feed 备注说明缺口。`;
		}
		/** Entry-level 「问助手」prefill (决策 41): discuss one timeline 事元 with the agent, in the bound home session。 */
		function discussAskText(advanceId, title, at, summary) {
			return `关于推进事项 ${advanceId}「${title}」${at} 的这条进展：「${summary}」。先 yzj_advance_get（advanceId=${advanceId}）看上下文，然后我想讨论：`;
		}
		/** Decision-card 「回到对话继续聊」prefill (决策 41): 卡上的选项/动作拿不准时，先回对话讨论;agent 聊出新建议后按纪律补/更新决策请求,用户再回看板拍板。 */
		function decisionChatText(advanceId, title, summary) {
			return `关于推进事项 ${advanceId}「${title}」待我决定的问题：「${summary}」。先 yzj_advance_get（advanceId=${advanceId}）看上下文。我还想聊聊再定；如果聊出更合适的建议，按纪律补/更新决策请求（选项/动作行），我回到看板拍板。我的想法：`;
		}
		/** Topic 问助手 prefill for 终局复盘沉淀 (spec §16, 决策 26: 复盘=终局收口). */
		function exportReviewAskText(advanceId, title) {
			return `请对推进事项 ${advanceId}「${title}」做终局复盘沉淀:先用 yzj_advance_get 翻页读全量事元,再按复盘模板(docs/spec/advance-review-template.md:目标演化/关键决策/偏差与证据链/下一步/事元全量索引)写出复盘 markdown,然后用 yzj_doc_import 入「我的知识/推进复盘/${title}」(父目录不存在就先 doc create 依次建「推进复盘」与事项目录),最后回链 yzj_advance_feed 一条产物事元(refs=[入库 docId],纯追加静默)。入库的确认卡我来点。`;
		}
		//#endregion
		//#region lib/types/client/composer-host.js
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
		/**
		* Subscribe to the connected host. Fires immediately with the current node
		* (or null). Returns the disposer.
		*/
		function subscribeRoomComposerHost(listener) {
			listeners.add(listener);
			listener(liveHost());
			return () => {
				listeners.delete(listener);
			};
		}
		/** Connected host, or null if unregistered / detached. */
		function getRoomComposerHost() {
			return liveHost();
		}
		//#endregion
		//#region lib/types/artifact-badge.js
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
		//#region lib/types/client/room-layout.js
		/**
		* Group-room timeline layout helpers (docs/spec/group-room-topics.md §9.1 P1):
		* same-sender clustering, date separators, reply-count chips, assistant
		* artifact cards. Pure — no React.
		*/
		function asString$9(value) {
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
			const name = asString$9(param.name);
			if ((entry.msgType ?? "") !== "file" && name === "") return void 0;
			const display = name === "" ? entry.content.replace(/^\[文件\]:?\s*/, "").trim() || "文件" : name;
			const ext = asString$9(param.ext);
			return {
				type: artifactBadgeOf(ext === "" || display.includes(".") ? display : `${display}.${ext}`).type,
				name: display,
				note: "已发进群 · 点开查看"
			};
		}
		//#endregion
		//#region lib/types/client/transcript.js
		/**
		* Group-room VIEW (docs/spec/group-room-topics.md R2/R7).
		* Identity/media share the floating-panel renderer; layout follows the
		* canvas prototype (self right, others left). Agent work lives on yzj-topic-*.
		* Registered as conversation.view「群聊」— not a Session.append event type.
		*/
		function asRecord$11(value) {
			return typeof value === "object" && value !== null ? value : {};
		}
		function clock$2(ms) {
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
				const row = asRecord$11(item);
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
			const row = asRecord$11(raw);
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
				const row = asRecord$11(item);
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
		/** Group id last fused for this room session, if the module cache still has it. */
		function cachedRoomGroupId(sessionId) {
			const id = fusedCache.get(sessionId)?.binding?.yzjConversationId;
			return id === void 0 ? "" : id;
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
			const [more, setMore] = (0, react.useState)(true);
			const [loadingOlder, setLoadingOlder] = (0, react.useState)(false);
			const anchorPagesRef = (0, react.useRef)(0);
			(0, react.useEffect)(() => {
				anchorPagesRef.current = 0;
			}, [viewKey]);
			const [names, setNames] = (0, react.useState)(() => seedNames(cached?.items ?? []));
			const [lightbox, setLightbox] = (0, react.useState)(null);
			const [highlightMsgId, setHighlightMsgId] = (0, react.useState)("");
			const [unclamped, setUnclamped] = (0, react.useState)(() => /* @__PURE__ */ new Set());
			const [feedTarget, setFeedTarget] = (0, react.useState)(null);
			const feedback = useAdvanceFeedback();
			const askDraft = useAdvanceAskDraft();
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
				setHighlightMsgId("");
				setUnclamped(/* @__PURE__ */ new Set());
				setError("");
			}, [viewKey]);
			(0, react.useEffect)(() => {
				if (highlightMsgId === "") return;
				followBottomRef.current = false;
				highlightRef.current?.scrollIntoView({ block: "center" });
			}, [highlightMsgId, value.items]);
			(0, react.useEffect)(() => {
				if (props.anchorMsgId === void 0 || props.anchorMsgId === "") return;
				setHighlightMsgId(props.anchorMsgId);
			}, [props.anchorMsgId, viewKey]);
			/** 喂给推进 refs 的渠道 token（决策 49）：群 id 优先 props（R24 跟随），回退绑定群。 */
			const boundGroupId = value.binding?.yzjConversationId;
			const feedGroupId = props.groupId ?? (typeof boundGroupId === "string" ? boundGroupId : "");
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
					const next = applyFused(asRecord$11(fused.value));
					const seeded = seedNames(next.items);
					if (Object.keys(seeded).length > 0) setNames((prev) => ({
						...seeded,
						...prev
					}));
					if (backfill) {
						const stats = await props.homeBackfill(props.sessionId, props.groupId === void 0 || props.groupId === "" ? void 0 : { groupId: props.groupId });
						if (cancelled) return;
						if (stats.ok) {
							if (asRecord$11(stats.value).more === false) setMore(false);
							const again = await props.homeFused(props.sessionId, props.groupId);
							if (!cancelled && again.ok) applyFused(asRecord$11(again.value));
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
				if (asRecord$11(stats.value).more === false) setMore(false);
				const result = await props.homeFused(props.sessionId, props.groupId);
				if (!result.ok) return;
				const seeded = seedNames(applyFused(asRecord$11(result.value)).items);
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
			return (0, react_jsx_runtime.jsxs)("div", {
				className: home_module_css_default.roomMain,
				children: [
					error !== "" && !emptyPhase && (0, react_jsx_runtime.jsx)("div", {
						className: home_module_css_default.hint,
						role: "alert",
						children: error
					}),
					(0, react_jsx_runtime.jsx)("div", { className: home_module_css_default.roomMainHead }),
					(0, react_jsx_runtime.jsx)("div", {
						className: home_module_css_default.roomStage,
						children: (0, react_jsx_runtime.jsxs)("div", {
							className: home_module_css_default.roomTimeline,
							children: [
								feedback !== null && props.advanceFeed !== void 0 && (0, react_jsx_runtime.jsxs)("div", {
									className: home_module_css_default.chrome,
									"data-testid": "yzj-advance-feedback-card",
									children: [
										(0, react_jsx_runtime.jsxs)("span", { children: [
											"正在反馈 · ",
											feedback.title,
											"（",
											feedback.advanceId,
											"）"
										] }),
										(0, react_jsx_runtime.jsx)(FeedbackLine, {
											advanceId: feedback.advanceId,
											advanceFeed: props.advanceFeed,
											onDone: () => setAdvanceFeedback(null)
										}),
										(0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: home_module_css_default.chromeLink,
											onClick: () => setAdvanceFeedback(null),
											children: "取消"
										})
									]
								}),
								askDraft !== null && (0, react_jsx_runtime.jsxs)("div", {
									className: home_module_css_default.chrome,
									"data-testid": "yzj-advance-ask-banner",
									children: [(0, react_jsx_runtime.jsxs)("span", { children: [
										askDraft.kind === "export" ? "复盘沉淀已预备" : askDraft.kind === "discuss" ? "进展讨论已预备" : "验收问题已预备",
										" · ",
										askDraft.title,
										askDraft.advanceId === "" ? "" : `（${askDraft.advanceId}）`,
										"。打开话题后会出现在问助手栏。"
									] }), (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: home_module_css_default.chromeLink,
										onClick: () => setAdvanceAskDraft(null),
										children: "取消"
									})]
								}),
								emptyPhase ? (0, react_jsx_runtime.jsx)("div", {
									className: home_module_css_default.stream,
									"data-testid": "yzj-fused-stream",
									children: (0, react_jsx_runtime.jsx)("div", {
										className: home_module_css_default.unbound,
										children: viewKey === "" ? "在左侧选择一个群开始。" : phase === "unbound" ? "还没有对话。" : (0, react_jsx_runtime.jsx)("div", {
											className: home_module_css_default.hint,
											children: error !== "" ? error : "加载群消息…"
										})
									})
								}) : (0, react_jsx_runtime.jsx)("div", {
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
									children: (0, react_jsx_runtime.jsxs)("div", {
										className: home_module_css_default.streamContent,
										ref: streamContentRef,
										children: [more && (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: home_module_css_default.streamMore,
											onClick: () => {
												loadOlder();
											},
											disabled: loadingOlder,
											children: loadingOlder ? "加载中…" : "加载更早消息"
										}), layoutRoomItems(value.items).map((node) => {
											if (node.kind === "sep") return (0, react_jsx_runtime.jsx)("div", {
												className: home_module_css_default.daySep,
												"data-testid": "yzj-day-sep",
												children: (0, react_jsx_runtime.jsx)("span", { children: node.label })
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
											const time = clock$2(entry.sentAt);
											return (0, react_jsx_runtime.jsxs)("div", {
												className: rowClass,
												"data-origin": entry.origin,
												"data-merged": node.merged ? "true" : "false",
												"data-testid": `yzj-room-row-${entry.msgId}`,
												ref: highlighted ? highlightRef : void 0,
												children: [!mine && (node.merged ? (0, react_jsx_runtime.jsx)("span", {
													className: home_module_css_default.roomAvatarSlot,
													"aria-hidden": "true"
												}) : (0, react_jsx_runtime.jsx)(SenderAvatar, {
													openId,
													fallback: sender === "" ? typeLabelOf(entry.msgType ?? "text") : sender
												})), (0, react_jsx_runtime.jsxs)("span", {
													className: home_module_css_default.roomStack,
													children: [
														!node.merged && (0, react_jsx_runtime.jsxs)("span", {
															className: home_module_css_default.roomMeta,
															children: [
																mine ? `我${time === "" ? "" : ` · ${time}`}` : `${sender}${time === "" ? "" : ` · ${time}`}`,
																entry.status === "pending" ? " · 发送中…" : "",
																entry.status === "failed" ? " · 发送失败" : ""
															]
														}),
														(0, react_jsx_runtime.jsxs)("span", {
															className: bubbleClass,
															children: [
																!hideFileBody && (clamped ? (0, react_jsx_runtime.jsx)("span", {
																	className: home_module_css_default.roomClamp,
																	children: (0, react_jsx_runtime.jsx)(MessageBody, {
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
																}) : (0, react_jsx_runtime.jsx)(MessageBody, {
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
																clampable && (0, react_jsx_runtime.jsx)("button", {
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
																artifact !== void 0 && (0, react_jsx_runtime.jsxs)("span", {
																	className: home_module_css_default.artifactCard,
																	"data-testid": `yzj-artifact-${entry.msgId}`,
																	children: [(0, react_jsx_runtime.jsx)("span", {
																		className: home_module_css_default.artifactType,
																		children: artifact.type
																	}), (0, react_jsx_runtime.jsxs)("span", {
																		className: home_module_css_default.artifactMeta,
																		children: [(0, react_jsx_runtime.jsx)("span", {
																			className: home_module_css_default.artifactName,
																			children: artifact.name
																		}), (0, react_jsx_runtime.jsx)("span", {
																			className: home_module_css_default.artifactNote,
																			children: artifact.note
																		})]
																	})]
																})
															]
														}),
														(0, react_jsx_runtime.jsxs)("span", {
															className: home_module_css_default.roomRowActions,
															children: [(0, react_jsx_runtime.jsx)("button", {
																type: "button",
																className: home_module_css_default.roomAction,
																onClick: () => emitRoomReplyRequest({
																	msgId: entry.msgId,
																	summary: entry.content.slice(0, 80)
																}),
																children: "回复"
															}), props.advanceState !== void 0 && props.advanceFeed !== void 0 && !assistant && (0, react_jsx_runtime.jsx)("button", {
																type: "button",
																className: home_module_css_default.roomAction,
																"data-testid": `yzj-advance-feed-${entry.msgId}`,
																onClick: () => setFeedTarget({
																	summary: entry.content.slice(0, 80),
																	refs: [feedGroupId === "" ? entry.msgId : `im:${feedGroupId}:${entry.msgId}`]
																}),
																children: "喂给推进"
															})]
														})
													]
												})]
											}, `im-${entry.msgId}`);
										})]
									})
								}),
								(0, react_jsx_runtime.jsx)("div", {
									ref: registerRoomComposerHost,
									id: ROOM_COMPOSER_HOST_ID,
									className: home_module_css_default.roomComposerHost,
									"data-testid": "yzj-room-composer-host"
								}, ROOM_COMPOSER_HOST_ID)
							]
						})
					}),
					feedTarget !== null && props.advanceState !== void 0 && props.advanceFeed !== void 0 && (0, react_jsx_runtime.jsx)(AdvanceFeedPicker, {
						advanceState: props.advanceState,
						...feedback === null ? {} : { presetId: feedback.advanceId },
						defaultSummary: feedTarget.summary,
						onClose: () => setFeedTarget(null),
						onSubmit: async (advanceId, summary) => {
							const result = await props.advanceFeed?.({
								advanceId,
								summary,
								sourceType: "对话",
								refs: feedTarget.refs
							});
							if (result === void 0 || !result.ok) return {
								ok: false,
								error: { message: result === void 0 ? "advanceFeed unavailable" : result.error.message }
							};
							return { ok: true };
						}
					}),
					lightbox !== null && (0, react_jsx_runtime.jsx)(ImLightbox, {
						src: lightbox.src,
						kind: lightbox.kind,
						onClose: () => setLightbox(null)
					})
				]
			});
		}
		/** One-line feed on the 「现在反馈」 card (sourceType 人工, no msg ref). */
		function FeedbackLine(props) {
			const [text, setText] = (0, react.useState)("");
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)("");
			const send = async () => {
				const summary = text.trim();
				if (summary === "") {
					setError("写一句反馈");
					return;
				}
				setBusy(true);
				setError("");
				const result = await props.advanceFeed({
					advanceId: props.advanceId,
					summary,
					sourceType: "人工"
				});
				setBusy(false);
				if (!result.ok) {
					setError(result.error.message);
					return;
				}
				setText("");
				props.onDone();
			};
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				(0, react_jsx_runtime.jsx)("input", {
					className: home_module_css_default.topicDrawerInput,
					"data-testid": "yzj-advance-feedback-summary",
					placeholder: "一句话反馈…",
					value: text,
					onChange: (event) => setText(event.target.value),
					disabled: busy
				}),
				(0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: `${home_module_css_default.chromeBtn} ${home_module_css_default.chromePrimary}`,
					"data-testid": "yzj-advance-feedback-send",
					disabled: busy,
					onClick: () => {
						send();
					},
					children: busy ? "写入中…" : "喂进去"
				}),
				error !== "" && (0, react_jsx_runtime.jsx)("span", {
					role: "alert",
					children: error
				})
			] });
		}
		//#endregion
		//#region lib/types/client/panel-controller.js
		let controller = null;
		/** Mount the live panel controller; returns the disposer. */
		function registerPanelController(actions, inject) {
			controller = {
				actions,
				inject
			};
			return () => {
				if (controller?.actions === actions) controller = null;
			};
		}
		function asRecord$10(value) {
			return typeof value === "object" && value !== null ? value : {};
		}
		function asArray$7(value) {
			return Array.isArray(value) ? value : [];
		}
		function asString$8(value) {
			return typeof value === "string" ? value : "";
		}
		/**
		* Open the real panel focused on one item (card 查看详情). Group/workspace
		* jumps prefetch their windows; doc jumps set docId (the panel fetches the
		* preview); event jumps re-target the calendar cursor and prefetch the
		* month. An optional anchor scrolls to one message after the group loads.
		*/
		function openPanelTarget(target, anchorMsgId) {
			const c = controller;
			if (target.kind === "group") {
				setWorkbenchDomain("im");
				rememberImSeat({
					groupId: target.groupId,
					sessionId: ""
				});
			} else if (target.kind === "todo") setWorkbenchDomain("todo");
			else if (target.kind === "advance") setWorkbenchDomain("advance");
			else if (target.kind === "doc" || target.kind === "workspace") setWorkbenchDomain("docs");
			else setWorkbenchDomain("calendar");
			openWorkbench();
			if (c === null) return;
			const actions = c.actions;
			actions.setOpen(true);
			actions.setError("");
			actions.setAnchorMsgId(anchorMsgId ?? "");
			if (target.kind === "group") {
				actions.setTab("chat");
				actions.setGroupId(target.groupId);
				c.inject.fetchMessages(target.groupId, 20).then((result) => {
					if (!result.ok) return;
					const list = asArray$7(asRecord$10(result.value).list);
					actions.setMessages(list);
					actions.setMessagesMore(asRecord$10(result.value).more === true);
					actions.setMessagesAnchor(list.length > 0 ? asString$8(asRecord$10(list[0]).msgId) : "");
				});
			} else if (target.kind === "doc") {
				actions.setTab("docs");
				actions.setDocId(target.docId);
			} else if (target.kind === "workspace") {
				actions.setTab("docs");
				actions.setWorkspaceId(target.workspaceId);
				c.inject.fetchDocs(target.workspaceId).then((result) => {
					if (result.ok) actions.setDocs(asArray$7(result.value));
				});
			} else if (target.kind === "advance") {} else if (target.kind === "todo") {
				actions.setTab("todo");
				c.inject.todoState().then((result) => {
					if (!result.ok) return;
					const value = asRecord$10(result.value);
					const library = asRecord$10(value.library);
					actions.setTodoState(asArray$7(value.todos), value.ready === true, typeof library.link === "string" ? library.link : "");
					actions.setTodoLibraries([], typeof value.activeDocId === "string" ? value.activeDocId : "");
				});
			} else {
				actions.setTab("calendar");
				const date = target.event.startDate > 0 ? new Date(target.event.startDate) : /* @__PURE__ */ new Date();
				const year = date.getFullYear();
				const month = date.getMonth() + 1;
				const pad = (n) => String(n).padStart(2, "0");
				actions.setCalCursor(year, month);
				actions.setCalDay(`${year}-${pad(month)}-${pad(date.getDate())}`);
				actions.setCalEventId(target.event.id);
				c.inject.fetchEvents(`${year}-${pad(month)}-01`, `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`).then((result) => {
					if (result.ok) actions.setCalEvents(asArray$7(result.value));
				});
			}
		}
		//#endregion
		//#region \0dsh-css:/Users/guoxinshan/dev/dsh-yzj/packages/ui-yzj/src/client/todo-pane.module.css.mjs
		const css$4 = ".iwUIxq_body{flex-direction:column;flex:1;gap:8px;min-height:0;padding:10px 12px 12px;display:flex;overflow-y:auto}.iwUIxq_libRow{align-items:center;gap:8px;display:flex;position:relative}.iwUIxq_libSwitch{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:999px;align-items:center;gap:6px;max-width:240px;padding:6px 10px;font-size:12px;line-height:1;transition:border-color .15s,background .15s;display:inline-flex}.iwUIxq_libSwitch:hover,.iwUIxq_libSwitchOpen{border-color:var(--dsw-static-deepseek-500);background:var(--dsw-static-deepseek-100)}.iwUIxq_libName{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.iwUIxq_libCaret{color:var(--dsw-alias-label-tertiary);font-size:10px}.iwUIxq_libMenu{z-index:30;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);border-radius:12px;flex-direction:column;gap:2px;min-width:260px;max-width:320px;max-height:300px;padding:5px;display:flex;position:absolute;top:calc(100% + 6px);left:0;overflow-y:auto;box-shadow:0 8px 28px #00000038}.iwUIxq_libItem{color:var(--dsw-alias-label-primary);cursor:pointer;text-align:left;background:0 0;border:none;border-radius:8px;align-items:center;gap:8px;padding:9px 10px;font-size:12.5px;line-height:1;display:flex}.iwUIxq_libItem:hover{background:var(--dsw-alias-interactive-bg-hover)}.iwUIxq_libItem:disabled{opacity:.5;cursor:default}.iwUIxq_libItemActive{background:var(--dsw-static-deepseek-100);color:var(--dsw-static-deepseek-600)}.iwUIxq_libItemName{text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;overflow:hidden}.iwUIxq_libItemMeta{color:var(--dsw-alias-label-tertiary);flex-shrink:0;font-size:11px}.iwUIxq_libCheck{color:var(--dsw-static-deepseek-500);flex-shrink:0;font-weight:700}.iwUIxq_libBack{color:var(--dsw-static-deepseek-500);cursor:pointer;text-align:left;background:0 0;border:none;border-radius:8px;padding:7px 10px;font-size:12px}.iwUIxq_libBack:hover{background:var(--dsw-alias-interactive-bg-hover)}.iwUIxq_libMenuHint{color:var(--dsw-alias-label-tertiary);padding:4px 10px 7px;font-size:11px;line-height:15px}.iwUIxq_quick{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:10px;align-items:center;gap:8px;padding:6px 8px 6px 10px;transition:border-color .15s;display:flex}.iwUIxq_quick:focus-within{border-color:var(--dsw-static-deepseek-500)}.iwUIxq_quickPlus{color:var(--dsw-alias-label-tertiary);user-select:none;font-size:15px;line-height:1}.iwUIxq_quickInput{min-width:0;color:var(--dsw-alias-label-primary);background:0 0;border:none;outline:none;flex:1;font-family:inherit;font-size:13px;line-height:20px}.iwUIxq_quickInput::placeholder{color:var(--dsw-alias-label-caption)}.iwUIxq_quickAdd{background:var(--dsw-alias-button-info-fill);color:var(--dsw-alias-label-primary-foreground);cursor:pointer;border:none;border-radius:7px;flex-shrink:0;padding:7px 10px;font-size:12px;line-height:1}.iwUIxq_quickAdd:hover{background:var(--dsw-alias-button-info-hover)}.iwUIxq_quickAddDisabled{opacity:.45;cursor:default}.iwUIxq_quickHint{color:var(--dsw-alias-label-tertiary);margin:-2px 2px 0 26px;font-size:12px;line-height:16px}.iwUIxq_quickHint strong{color:var(--dsw-alias-label-secondary);font-weight:600}.iwUIxq_tagRail{flex-wrap:wrap;align-items:center;gap:6px;display:flex}.iwUIxq_tagRailSpace{flex:1}.iwUIxq_tagChip{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);cursor:pointer;white-space:nowrap;border-radius:999px;padding:5px 9px;font-size:12px;line-height:1;transition:border-color .15s,color .15s,background .15s}.iwUIxq_tagChip:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.iwUIxq_tagChipActive{border-color:var(--dsw-static-deepseek-500);background:var(--dsw-static-deepseek-100);color:var(--dsw-static-deepseek-600)}.iwUIxq_libraryLink{color:var(--dsw-static-deepseek-500);white-space:nowrap;font-size:12px;text-decoration:none}.iwUIxq_libraryLink:hover{text-decoration:underline}.iwUIxq_list{flex-direction:column;flex:1;gap:10px;min-height:0;display:flex}.iwUIxq_bucket{flex-direction:column;gap:4px;display:flex}.iwUIxq_bucketHead{align-items:center;gap:6px;padding:0 2px;font-size:12px;font-weight:600;display:flex}.iwUIxq_bucketCount{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary);border-radius:999px;padding:1px 7px;font-size:11px;font-weight:500}.iwUIxq_tone-danger{color:var(--dsw-static-red-400)}.iwUIxq_tone-danger .iwUIxq_bucketCount{background:var(--dsw-static-red-100,#ffe4e199);color:var(--dsw-static-red-400)}.iwUIxq_tone-warn{color:#b25e00}.iwUIxq_tone-info{color:var(--dsw-static-deepseek-600)}.iwUIxq_tone-muted{color:var(--dsw-alias-label-secondary)}.iwUIxq_tone-done{color:var(--dsw-alias-label-tertiary)}.iwUIxq_row{background:var(--dsw-alias-bg-layer-1);cursor:grab;border:1px solid #0000;border-radius:10px;align-items:flex-start;gap:9px;padding:7px 9px;transition:border-color .15s,background .15s;display:flex}.iwUIxq_row:hover{background:var(--dsw-alias-interactive-bg-hover)}.iwUIxq_rowOverdue{border-color:var(--dsw-static-red-100,#ffe4e18c);background:var(--dsw-alias-interactive-bg-hover-danger)}.iwUIxq_rowDone{opacity:.62}.iwUIxq_rowMain{text-align:left;cursor:pointer;background:0 0;border:none;flex-direction:column;flex:1;gap:3px;min-width:0;padding:0;font-family:inherit;display:flex}.iwUIxq_rowTitle{color:var(--dsw-alias-label-primary);word-break:break-word;font-size:13px;line-height:18px}.iwUIxq_rowDone .iwUIxq_rowTitle{text-decoration:line-through;text-decoration-color:var(--dsw-alias-label-caption)}.iwUIxq_rowMeta{flex-wrap:wrap;align-items:center;gap:5px;display:flex}.iwUIxq_chip{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);border-radius:5px;padding:3px 6px;font-size:11px;line-height:1}.iwUIxq_chipDanger{background:var(--dsw-static-red-100,#ffe4e199);color:var(--dsw-static-red-400)}.iwUIxq_chipWarn{color:#8a5300;background:#fff0d6d9}.iwUIxq_chipTag{background:var(--dsw-static-deepseek-100);color:var(--dsw-static-deepseek-600);cursor:pointer;border-radius:5px;padding:3px 6px;font-size:11px;line-height:1}.iwUIxq_chipTag:hover{background:var(--dsw-static-deepseek-500);color:var(--dsw-alias-label-primary-foreground)}.iwUIxq_chipMuted{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1}.iwUIxq_dot{border:1.5px solid var(--dsw-alias-border-l3,var(--dsw-alias-border-l2));background:var(--dsw-alias-bg-base);cursor:pointer;width:18px;height:18px;color:var(--dsw-alias-label-primary-foreground);border-radius:50%;flex-shrink:0;justify-content:center;align-items:center;margin-top:1px;padding:0;transition:border-color .15s,background .15s,transform .1s;display:inline-flex}.iwUIxq_dot:hover{border-color:var(--dsw-static-deepseek-500);transform:scale(1.08)}.iwUIxq_dotProgress{border-color:var(--dsw-static-deepseek-500);background:linear-gradient(90deg, var(--dsw-static-deepseek-500) 50%, var(--dsw-alias-bg-base) 50%)}.iwUIxq_dotDone{border-color:var(--dsw-static-deepseek-500);background:var(--dsw-static-deepseek-500)}.iwUIxq_dotBusy{opacity:.55;cursor:wait}.iwUIxq_detail{border-left:2px solid var(--dsw-alias-border-l3,var(--dsw-alias-border-l2));flex-direction:column;gap:3px;margin:2px 2px 4px 36px;padding:4px 0 4px 10px;display:flex}.iwUIxq_detailLine{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:16px}.iwUIxq_detailLog{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary);border-radius:7px;flex-direction:column;gap:2px;padding:6px 8px;font-size:11px;line-height:16px;display:flex}.iwUIxq_detailHint{color:var(--dsw-alias-label-caption);font-size:11px}.iwUIxq_empty{color:var(--dsw-alias-label-tertiary);flex-direction:column;flex:1;justify-content:center;align-items:center;gap:8px;padding:36px 0;font-size:13px;display:flex}.iwUIxq_emptyIcon{opacity:.75;font-size:26px}.iwUIxq_hero{text-align:center;flex-direction:column;flex:1;justify-content:center;align-items:center;gap:10px;padding:40px 24px;display:flex}.iwUIxq_heroIcon{background:var(--dsw-static-deepseek-100);width:44px;height:44px;color:var(--dsw-static-deepseek-600);border-radius:50%;justify-content:center;align-items:center;font-size:20px;font-weight:700;display:flex}.iwUIxq_heroTitle{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600}.iwUIxq_heroText{color:var(--dsw-alias-label-secondary);max-width:320px;font-size:12px;line-height:18px}.iwUIxq_heroButton{background:var(--dsw-alias-button-info-fill);color:var(--dsw-alias-label-primary-foreground);cursor:pointer;border:none;border-radius:9px;margin-top:4px;padding:9px 22px;font-size:13px}.iwUIxq_heroButton:hover{background:var(--dsw-alias-button-info-hover)}.iwUIxq_foot{color:var(--dsw-alias-label-caption);text-align:center;padding-top:2px;font-size:11px;line-height:15px}.iwUIxq_notice{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);max-width:92%;color:var(--dsw-alias-label-secondary);border-radius:8px;align-self:center;padding:7px 12px;font-size:12px;position:sticky;bottom:8px;box-shadow:0 4px 16px #0000002e}";
		const tagId$4 = "@dsh-yzj/bundle/ui-yzj/todo-pane.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$4) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@dsh-yzj/bundle/ui-yzj";
			tag.dataset.pluginCss = tagId$4;
			tag.textContent = css$4;
			document.head.appendChild(tag);
		}
		var todo_pane_module_css_default = {
			"libraryLink": "iwUIxq_libraryLink",
			"tone-warn": "iwUIxq_tone-warn",
			"libMenuHint": "iwUIxq_libMenuHint",
			"tagChipActive": "iwUIxq_tagChipActive",
			"quickInput": "iwUIxq_quickInput",
			"tone-danger": "iwUIxq_tone-danger",
			"libItemMeta": "iwUIxq_libItemMeta",
			"empty": "iwUIxq_empty",
			"body": "iwUIxq_body",
			"quickHint": "iwUIxq_quickHint",
			"emptyIcon": "iwUIxq_emptyIcon",
			"heroButton": "iwUIxq_heroButton",
			"row": "iwUIxq_row",
			"detail": "iwUIxq_detail",
			"chipMuted": "iwUIxq_chipMuted",
			"libSwitchOpen": "iwUIxq_libSwitchOpen",
			"libName": "iwUIxq_libName",
			"heroIcon": "iwUIxq_heroIcon",
			"quick": "iwUIxq_quick",
			"heroTitle": "iwUIxq_heroTitle",
			"chipWarn": "iwUIxq_chipWarn",
			"chipTag": "iwUIxq_chipTag",
			"rowMain": "iwUIxq_rowMain",
			"rowMeta": "iwUIxq_rowMeta",
			"dotDone": "iwUIxq_dotDone",
			"detailLog": "iwUIxq_detailLog",
			"tagRail": "iwUIxq_tagRail",
			"tone-done": "iwUIxq_tone-done",
			"libRow": "iwUIxq_libRow",
			"notice": "iwUIxq_notice",
			"hero": "iwUIxq_hero",
			"list": "iwUIxq_list",
			"quickAddDisabled": "iwUIxq_quickAddDisabled",
			"libSwitch": "iwUIxq_libSwitch",
			"libItemActive": "iwUIxq_libItemActive",
			"dot": "iwUIxq_dot",
			"bucketCount": "iwUIxq_bucketCount",
			"libItem": "iwUIxq_libItem",
			"libMenu": "iwUIxq_libMenu",
			"rowDone": "iwUIxq_rowDone",
			"tagChip": "iwUIxq_tagChip",
			"bucketHead": "iwUIxq_bucketHead",
			"quickPlus": "iwUIxq_quickPlus",
			"chipDanger": "iwUIxq_chipDanger",
			"dotBusy": "iwUIxq_dotBusy",
			"tagRailSpace": "iwUIxq_tagRailSpace",
			"chip": "iwUIxq_chip",
			"dotProgress": "iwUIxq_dotProgress",
			"detailHint": "iwUIxq_detailHint",
			"tone-muted": "iwUIxq_tone-muted",
			"quickAdd": "iwUIxq_quickAdd",
			"detailLine": "iwUIxq_detailLine",
			"libBack": "iwUIxq_libBack",
			"bucket": "iwUIxq_bucket",
			"rowOverdue": "iwUIxq_rowOverdue",
			"libItemName": "iwUIxq_libItemName",
			"libCaret": "iwUIxq_libCaret",
			"rowTitle": "iwUIxq_rowTitle",
			"libCheck": "iwUIxq_libCheck",
			"foot": "iwUIxq_foot",
			"tone-info": "iwUIxq_tone-info",
			"heroText": "iwUIxq_heroText"
		};
		//#endregion
		//#region lib/types/client/todo-pane.js
		/**
		* The 待办 tab: a friction-light todo surface over the demo-stage sheet
		* backend (待办任务库). Buckets by urgency (逾期 / 今天 / 进行中 / 待办 /
		* 已完成), #tag chips aggregate anything (a tag can be a project, a group,
		* a theme), quick-create parses `#tag` + dates straight from the input, and
		* Completing/reopening and quick-creating are user-direct writes (no
		* confirmation card — the panel acts as the user's own hand); agent writes
		* still go through the tool confirmation flow. Data arrives through the
		* /yzj RPC face only.
		*/
		function asRecord$9(value) {
			return typeof value === "object" && value !== null ? value : {};
		}
		function asString$7(value) {
			return typeof value === "string" ? value : "";
		}
		function asTags(value) {
			return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
		}
		function asArray$6(value) {
			return Array.isArray(value) ? value : [];
		}
		/** Local today as `YYYY/MM/DD` for bucket math. */
		function todayStr() {
			const now = /* @__PURE__ */ new Date();
			const pad = (n) => String(n).padStart(2, "0");
			return `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())}`;
		}
		/** Parse a quick-create input: `#tag` tokens and date fragments become
		* structured fields; the remainder is the title. Supported dates: 今天/明天/
		* 后天, 8/20, 08-20, 2026-08-20, 8月20日. */
		function parseQuickCreate(input) {
			const pad = (n) => String(n).padStart(2, "0");
			const fmt = (y, m, d) => `${y}/${pad(m)}/${pad(d)}`;
			const now = /* @__PURE__ */ new Date();
			let ddl = "";
			let rest = ` ${input} `;
			for (const [word, offset] of [
				["今天", 0],
				["明天", 1],
				["后天", 2]
			]) if (rest.includes(word)) {
				const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
				ddl = fmt(date.getFullYear(), date.getMonth() + 1, date.getDate());
				rest = rest.split(word).join(" ");
				break;
			}
			if (ddl === "") {
				const cn = rest.match(/(\d{1,2})月(\d{1,2})[日号]/);
				if (cn !== null) {
					ddl = fmt(now.getFullYear(), Number(cn[1]), Number(cn[2]));
					rest = rest.replace(cn[0], " ");
				}
			}
			if (ddl === "") {
				const full = rest.match(/(?:^|\s)(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?=\s|$)/);
				if (full !== null) {
					ddl = fmt(Number(full[1]), Number(full[2]), Number(full[3]));
					rest = rest.replace(full[0], " ");
				} else {
					const md = rest.match(/(?:^|\s)(\d{1,2})[-/](\d{1,2})(?=\s|$)/);
					if (md !== null) {
						ddl = fmt(now.getFullYear(), Number(md[1]), Number(md[2]));
						rest = rest.replace(md[0], " ");
					}
				}
			}
			const tags = [];
			rest = rest.replace(/#[^\s#，,、]+/g, (token) => {
				tags.push(token.slice(1));
				return " ";
			});
			return {
				title: rest.replace(/\s+/g, " ").trim(),
				tags: [...new Set(tags)],
				ddl
			};
		}
		/** Bucket todos by urgency; done shows the 10 most recent. */
		function bucketsOf(todos) {
			const today = todayStr();
			const byDdl = (a, b) => {
				const da = asString$7(a.ddl);
				const db = asString$7(b.ddl);
				if (da === "" && db === "") return asString$7(a.todoId) < asString$7(b.todoId) ? -1 : 1;
				if (da === "") return 1;
				if (db === "") return -1;
				return da === db ? asString$7(a.todoId) < asString$7(b.todoId) ? -1 : 1 : da < db ? -1 : 1;
			};
			const open = todos.filter((todo) => asString$7(todo.status) !== "done");
			const done = todos.filter((todo) => asString$7(todo.status) === "done");
			const overdue = open.filter((todo) => asString$7(todo.ddl) !== "" && asString$7(todo.ddl) < today);
			const dueToday = open.filter((todo) => asString$7(todo.ddl) === today);
			const inProgress = open.filter((todo) => asString$7(todo.status) === "in_progress" && !overdue.includes(todo) && !dueToday.includes(todo));
			const plain = open.filter((todo) => !overdue.includes(todo) && !dueToday.includes(todo) && !inProgress.includes(todo));
			return [
				{
					key: "overdue",
					label: "逾期",
					tone: "danger",
					todos: overdue.sort(byDdl)
				},
				{
					key: "today",
					label: "今天到期",
					tone: "warn",
					todos: dueToday.sort(byDdl)
				},
				{
					key: "progress",
					label: "进行中",
					tone: "info",
					todos: inProgress.sort(byDdl)
				},
				{
					key: "pending",
					label: "待办",
					tone: "muted",
					todos: plain.sort(byDdl)
				},
				{
					key: "done",
					label: "已完成",
					tone: "done",
					todos: done.sort((a, b) => asString$7(a.todoId) < asString$7(b.todoId) ? 1 : -1).slice(0, 10)
				}
			].filter((bucket) => bucket.todos.length > 0);
		}
		/** The circular status control: empty (pending), half (in_progress), check (done). */
		function StatusDot({ status, busy, onToggle, title }) {
			const cls = status === "done" ? `${todo_pane_module_css_default.dot} ${todo_pane_module_css_default.dotDone}` : status === "in_progress" ? `${todo_pane_module_css_default.dot} ${todo_pane_module_css_default.dotProgress}` : todo_pane_module_css_default.dot;
			return (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: busy ? `${cls} ${todo_pane_module_css_default.dotBusy}` : cls,
				onClick: onToggle,
				disabled: busy,
				title,
				"aria-label": title,
				"aria-pressed": status === "done",
				children: status === "done" && (0, react_jsx_runtime.jsx)("svg", {
					width: "12",
					height: "12",
					viewBox: "0 0 24 24",
					fill: "none",
					"aria-hidden": "true",
					children: (0, react_jsx_runtime.jsx)("path", {
						d: "M5 12.5l4.5 4.5L19 7.5",
						stroke: "currentColor",
						strokeWidth: "3",
						strokeLinecap: "round",
						strokeLinejoin: "round"
					})
				})
			});
		}
		/** Persisted library selection (docId) so the team library survives reloads
		*  without hand-editing host config. */
		const LIB_PREF_KEY = "dsh.yzj.todo.lib";
		function readLibPref() {
			try {
				return window.localStorage.getItem(LIB_PREF_KEY) ?? "";
			} catch {
				return "";
			}
		}
		function writeLibPref(docId) {
			try {
				if (docId === "") window.localStorage.removeItem(LIB_PREF_KEY);
				else window.localStorage.setItem(LIB_PREF_KEY, docId);
			} catch {}
		}
		function TodoPane(props) {
			const [draft, setDraft] = (0, react.useState)("");
			const [creating, setCreating] = (0, react.useState)(false);
			const [ensuring, setEnsuring] = (0, react.useState)(false);
			const [busyId, setBusyId] = (0, react.useState)("");
			const [notice, setNotice] = (0, react.useState)("");
			const [expanded, setExpanded] = (0, react.useState)("");
			const [switcherOpen, setSwitcherOpen] = (0, react.useState)(false);
			const [teamPick, setTeamPick] = (0, react.useState)(false);
			const [teamWorkspaces, setTeamWorkspaces] = (0, react.useState)([]);
			const [switching, setSwitching] = (0, react.useState)(false);
			const inputRef = (0, react.useRef)(null);
			const switcherRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				const pref = readLibPref();
				if (pref === "" || pref === props.activeDocId) return;
				props.selectTodoLibrary(pref).then((result) => {
					if (!result.ok) writeLibPref("");
				}).catch(() => {});
			}, []);
			(0, react.useEffect)(() => {
				props.todoLibraries().then((result) => {
					if (!result.ok) return;
					const value = asRecord$9(result.value);
					props.actions.setTodoLibraries(Array.isArray(value.libraries) ? value.libraries : [], typeof value.activeDocId === "string" ? value.activeDocId : props.activeDocId);
				}).catch(() => {});
			}, []);
			(0, react.useEffect)(() => {
				if (!switcherOpen) return;
				const onDown = (event) => {
					if (switcherRef.current !== null && !switcherRef.current.contains(event.target)) {
						setSwitcherOpen(false);
						setTeamPick(false);
					}
				};
				window.addEventListener("mousedown", onDown);
				return () => window.removeEventListener("mousedown", onDown);
			}, [switcherOpen]);
			const todos = (0, react.useMemo)(() => (Array.isArray(props.todos) ? props.todos : []).map(asRecord$9), [props.todos]);
			const parsed = (0, react.useMemo)(() => parseQuickCreate(draft), [draft]);
			const tagCounts = (0, react.useMemo)(() => {
				const counts = /* @__PURE__ */ new Map();
				for (const todo of todos) for (const tag of asTags(todo.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
				return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
			}, [todos]);
			const visible = props.tagFilter === "" ? todos : todos.filter((todo) => asTags(todo.tags).includes(props.tagFilter));
			const buckets = (0, react.useMemo)(() => bucketsOf(visible), [visible]);
			const openCount = todos.filter((todo) => asString$7(todo.status) !== "done").length;
			const activeLib = (0, react.useMemo)(() => {
				if (props.libScope === "team" || props.libScope === "personal") return {
					scope: props.libScope,
					workspaceName: props.libName
				};
				const libs = Array.isArray(props.libraries) ? props.libraries : [];
				for (const lib of libs.map(asRecord$9)) if (asString$7(lib.docId) === props.activeDocId) return {
					scope: asString$7(lib.scope),
					workspaceName: asString$7(lib.workspaceName)
				};
			}, [
				props.libScope,
				props.libName,
				props.libraries,
				props.activeDocId
			]);
			const flash = (message) => {
				setNotice(message);
				window.setTimeout(() => setNotice(""), 2600);
			};
			const refresh = () => {
				props.todoState().then((result) => {
					if (!result.ok) return;
					applyState(result.value);
				});
			};
			const applyState = (value) => {
				const record = asRecord$9(value);
				const library = asRecord$9(record.library);
				props.actions.setTodoState(Array.isArray(record.todos) ? record.todos : [], record.ready === true, typeof library.link === "string" ? library.link : "", typeof record.libraryName === "string" ? record.libraryName : void 0, typeof record.libraryScope === "string" ? record.libraryScope : void 0);
				if (Array.isArray(record.libraries) || typeof record.activeDocId === "string") props.actions.setTodoLibraries(Array.isArray(record.libraries) ? record.libraries : [], typeof record.activeDocId === "string" ? record.activeDocId : "");
			};
			/** Pull the switcher list fresh (host cache was cleared by select/ensure). */
			const refreshLibraries = () => {
				props.todoLibraries().then((result) => {
					if (!result.ok) return;
					const value = asRecord$9(result.value);
					props.actions.setTodoLibraries(Array.isArray(value.libraries) ? value.libraries : [], typeof value.activeDocId === "string" ? value.activeDocId : "");
				}).catch(() => {});
			};
			const onSelectLibrary = (docId) => {
				if (docId === props.activeDocId || switching) return;
				setSwitching(true);
				props.selectTodoLibrary(docId).then((result) => {
					setSwitching(false);
					setSwitcherOpen(false);
					setTeamPick(false);
					if (result.ok) {
						writeLibPref(docId);
						applyState(result.value);
						refreshLibraries();
						flash("已切换任务库");
					} else flash(`切换失败：${result.error.message}`);
				});
			};
			const openTeamPicker = () => {
				setTeamPick(true);
				if (teamWorkspaces.length === 0) props.todoLibraries().then((result) => {
					if (!result.ok) return;
					const list = asArray$6(asRecord$9(result.value).teamWorkspaces);
					setTeamWorkspaces(list.map((item) => {
						const ws = asRecord$9(item);
						return {
							id: asString$7(ws.id),
							name: asString$7(ws.name),
							docCount: typeof ws.docCount === "number" ? ws.docCount : 0,
							permissionLevel: typeof ws.permissionLevel === "number" ? ws.permissionLevel : 3
						};
					}));
				});
			};
			const onEnsureTeam = (workspace) => {
				if (switching) return;
				setSwitching(true);
				props.ensureTeamTodo(workspace).then((result) => {
					setSwitching(false);
					setSwitcherOpen(false);
					setTeamPick(false);
					if (result.ok) {
						const docId = asString$7(asRecord$9(asRecord$9(result.value).library).docId);
						if (docId !== "") writeLibPref(docId);
						applyState(result.value);
						refreshLibraries();
						flash("团队任务库已就绪");
					} else flash(`开通失败：${result.error.message}`);
				});
			};
			const onEnsure = () => {
				setEnsuring(true);
				props.ensureTodo().then((result) => {
					setEnsuring(false);
					if (result.ok) {
						const library = asRecord$9(asRecord$9(result.value).library);
						props.actions.setTodoState([], true, typeof library.link === "string" ? library.link : "");
						flash("任务库已开通，创建第一条待办吧");
						inputRef.current?.focus();
					} else flash(`开通失败：${result.error.message}`);
				});
			};
			const onCreate = () => {
				if (parsed.title === "" || creating) return;
				setCreating(true);
				props.createTodo({
					title: parsed.title,
					...parsed.ddl === "" ? {} : { ddl: parsed.ddl },
					...parsed.tags.length === 0 ? {} : { tags: parsed.tags }
				}).then((result) => {
					setCreating(false);
					if (result.ok) {
						setDraft("");
						props.actions.patchTodo(result.value);
						refresh();
					} else flash(`创建失败：${result.error.message}`);
				});
			};
			const onToggle = (todo) => {
				const todoId = asString$7(todo.todoId);
				setBusyId(todoId);
				props.actions.patchTodo({
					...todo,
					status: asString$7(todo.status) === "done" ? "in_progress" : "done"
				});
				props.toggleTodo(todoId).then((result) => {
					setBusyId("");
					if (result.ok) props.actions.patchTodo(result.value);
					else {
						flash(`操作失败：${result.error.message}`);
						refresh();
					}
				});
			};
			if (!props.ready && !props.loading) return (0, react_jsx_runtime.jsx)("div", {
				className: todo_pane_module_css_default.body,
				children: (0, react_jsx_runtime.jsxs)("div", {
					className: todo_pane_module_css_default.hero,
					children: [
						(0, react_jsx_runtime.jsx)("div", {
							className: todo_pane_module_css_default.heroIcon,
							children: "✓"
						}),
						(0, react_jsx_runtime.jsx)("div", {
							className: todo_pane_module_css_default.heroTitle,
							children: "开通待办任务库"
						}),
						(0, react_jsx_runtime.jsx)("div", {
							className: todo_pane_module_css_default.heroText,
							children: "待办以一张多维表格作为演示载体（自动建在你的个人知识库），支持 #标签 聚合与逾期提醒； 后续将无缝切换到原生待办后端，标签与任务数据一并迁移。"
						}),
						(0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: todo_pane_module_css_default.heroButton,
							onClick: onEnsure,
							disabled: ensuring,
							children: ensuring ? "开通中…" : "一键开通"
						})
					]
				})
			});
			return (0, react_jsx_runtime.jsxs)("div", {
				className: todo_pane_module_css_default.body,
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: todo_pane_module_css_default.libRow,
						ref: switcherRef,
						children: [
							(0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: switcherOpen ? `${todo_pane_module_css_default.libSwitch} ${todo_pane_module_css_default.libSwitchOpen}` : todo_pane_module_css_default.libSwitch,
								onClick: () => {
									setSwitcherOpen(!switcherOpen);
									setTeamPick(false);
								},
								"aria-haspopup": "listbox",
								"aria-expanded": switcherOpen,
								title: "切换任务库（个人 / 团队）",
								children: [
									(0, react_jsx_runtime.jsx)("span", {
										"aria-hidden": "true",
										children: activeLib?.scope === "team" ? "👥" : "📋"
									}),
									(0, react_jsx_runtime.jsx)("span", {
										className: todo_pane_module_css_default.libName,
										children: activeLib === void 0 ? "任务库" : activeLib.scope === "team" ? `团队 · ${activeLib.workspaceName === "" ? "共享库" : activeLib.workspaceName}` : `个人 · ${activeLib.workspaceName === "" ? "我的" : activeLib.workspaceName}`
									}),
									(0, react_jsx_runtime.jsx)("span", {
										className: todo_pane_module_css_default.libCaret,
										"aria-hidden": "true",
										children: "▾"
									})
								]
							}),
							(0, react_jsx_runtime.jsx)("span", { className: todo_pane_module_css_default.tagRailSpace }),
							props.libraryLink !== "" && (0, react_jsx_runtime.jsx)("a", {
								className: todo_pane_module_css_default.libraryLink,
								href: props.libraryLink,
								target: "_blank",
								rel: "noreferrer",
								title: "在云之家打开任务库（多维表格）",
								children: "任务库 ↗"
							}),
							switcherOpen && (0, react_jsx_runtime.jsxs)("div", {
								className: todo_pane_module_css_default.libMenu,
								role: "listbox",
								"aria-label": "任务库",
								children: [
									!teamPick && (Array.isArray(props.libraries) ? props.libraries : []).map(asRecord$9).map((lib) => {
										const docId = asString$7(lib.docId);
										const scope = asString$7(lib.scope);
										const name = asString$7(lib.workspaceName);
										return (0, react_jsx_runtime.jsxs)("button", {
											type: "button",
											role: "option",
											"aria-selected": docId === props.activeDocId,
											className: docId === props.activeDocId ? `${todo_pane_module_css_default.libItem} ${todo_pane_module_css_default.libItemActive}` : todo_pane_module_css_default.libItem,
											onClick: () => {
												onSelectLibrary(docId);
											},
											disabled: switching,
											children: [
												(0, react_jsx_runtime.jsx)("span", {
													"aria-hidden": "true",
													children: scope === "team" ? "👥" : "📋"
												}),
												(0, react_jsx_runtime.jsx)("span", {
													className: todo_pane_module_css_default.libItemName,
													children: scope === "team" ? `团队 · ${name === "" ? "共享库" : name}` : `个人 · ${name === "" ? "我的" : name}`
												}),
												docId === props.activeDocId && (0, react_jsx_runtime.jsx)("span", {
													className: todo_pane_module_css_default.libCheck,
													"aria-hidden": "true",
													children: "✓"
												})
											]
										}, docId);
									}),
									!teamPick && (0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										className: todo_pane_module_css_default.libItem,
										onClick: openTeamPicker,
										disabled: switching,
										children: [(0, react_jsx_runtime.jsx)("span", {
											"aria-hidden": "true",
											children: "➕"
										}), (0, react_jsx_runtime.jsx)("span", {
											className: todo_pane_module_css_default.libItemName,
											children: "新建 / 选择团队任务库…"
										})]
									}),
									teamPick && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
										(0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: todo_pane_module_css_default.libBack,
											onClick: () => {
												setTeamPick(false);
											},
											children: "‹ 返回"
										}),
										(0, react_jsx_runtime.jsx)("div", {
											className: todo_pane_module_css_default.libMenuHint,
											children: "选择团队知识库（将创建或复用其中的「待办任务库」，有编辑权限才可选）"
										}),
										teamWorkspaces.map((ws) => (0, react_jsx_runtime.jsxs)("button", {
											type: "button",
											className: todo_pane_module_css_default.libItem,
											onClick: () => {
												onEnsureTeam(ws.id);
											},
											disabled: switching || ws.permissionLevel > 2,
											title: ws.permissionLevel > 2 ? "只读知识库，无法开通" : `在「${ws.name}」开通团队任务库`,
											children: [
												(0, react_jsx_runtime.jsx)("span", {
													"aria-hidden": "true",
													children: "👥"
												}),
												(0, react_jsx_runtime.jsx)("span", {
													className: todo_pane_module_css_default.libItemName,
													children: ws.name
												}),
												(0, react_jsx_runtime.jsx)("span", {
													className: todo_pane_module_css_default.libItemMeta,
													children: ws.permissionLevel > 2 ? "只读" : `${ws.docCount} 文档`
												})
											]
										}, ws.id)),
										teamWorkspaces.length === 0 && (0, react_jsx_runtime.jsx)("div", {
											className: todo_pane_module_css_default.libMenuHint,
											children: "（无可用的团队知识库）"
										})
									] })
								]
							})
						]
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: todo_pane_module_css_default.quick,
						children: [
							(0, react_jsx_runtime.jsx)("span", {
								className: todo_pane_module_css_default.quickPlus,
								"aria-hidden": "true",
								children: "+"
							}),
							(0, react_jsx_runtime.jsx)("input", {
								ref: inputRef,
								className: todo_pane_module_css_default.quickInput,
								value: draft,
								placeholder: "记一条待办… 支持 #标签 和日期（8/20、周五前、8月20日、今天/明天）",
								onChange: (event) => {
									setDraft(event.target.value);
								},
								onKeyDown: (event) => {
									if (event.key === "Enter") {
										event.preventDefault();
										onCreate();
									}
								},
								disabled: creating
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: parsed.title === "" ? `${todo_pane_module_css_default.quickAdd} ${todo_pane_module_css_default.quickAddDisabled}` : todo_pane_module_css_default.quickAdd,
								onClick: onCreate,
								disabled: parsed.title === "" || creating,
								"aria-label": "添加待办",
								children: creating ? "…" : "添加"
							})
						]
					}),
					draft.trim() !== "" && (0, react_jsx_runtime.jsxs)("div", {
						className: todo_pane_module_css_default.quickHint,
						"aria-live": "polite",
						children: [
							"将创建：",
							(0, react_jsx_runtime.jsx)("strong", { children: parsed.title }),
							parsed.tags.length > 0 && (0, react_jsx_runtime.jsxs)("span", { children: [" · ", parsed.tags.map((tag) => `#${tag}`).join(" ")] }),
							parsed.ddl !== "" && (0, react_jsx_runtime.jsxs)("span", { children: [" · DDL ", parsed.ddl] })
						]
					}),
					tagCounts.length > 0 && (0, react_jsx_runtime.jsxs)("div", {
						className: todo_pane_module_css_default.tagRail,
						role: "group",
						"aria-label": "标签聚合",
						children: [(0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: props.tagFilter === "" ? `${todo_pane_module_css_default.tagChip} ${todo_pane_module_css_default.tagChipActive}` : todo_pane_module_css_default.tagChip,
							onClick: () => {
								props.actions.setTodoTag("");
							},
							children: ["全部 · ", todos.length]
						}), tagCounts.map(([tag, count]) => (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: props.tagFilter === tag ? `${todo_pane_module_css_default.tagChip} ${todo_pane_module_css_default.tagChipActive}` : todo_pane_module_css_default.tagChip,
							onClick: () => {
								props.actions.setTodoTag(props.tagFilter === tag ? "" : tag);
							},
							children: [
								"#",
								tag,
								" · ",
								count
							]
						}, tag))]
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: todo_pane_module_css_default.list,
						children: [buckets.length === 0 && !props.loading && (0, react_jsx_runtime.jsxs)("div", {
							className: todo_pane_module_css_default.empty,
							children: [(0, react_jsx_runtime.jsx)("div", {
								className: todo_pane_module_css_default.emptyIcon,
								children: "🗒️"
							}), (0, react_jsx_runtime.jsx)("div", { children: props.tagFilter === "" ? openCount === 0 && todos.length === 0 ? "还没有待办，从上面记一条开始" : "当前筛选下没有待办" : `#${props.tagFilter} 下没有待办` })]
						}), buckets.map((bucket) => (0, react_jsx_runtime.jsxs)("section", {
							className: todo_pane_module_css_default.bucket,
							"aria-label": bucket.label,
							children: [(0, react_jsx_runtime.jsxs)("header", {
								className: `${todo_pane_module_css_default.bucketHead} ${todo_pane_module_css_default[`tone-${bucket.tone}`]}`,
								children: [(0, react_jsx_runtime.jsx)("span", { children: bucket.label }), (0, react_jsx_runtime.jsx)("span", {
									className: todo_pane_module_css_default.bucketCount,
									children: bucket.todos.length
								})]
							}), bucket.todos.map((todo) => {
								const todoId = asString$7(todo.todoId);
								const status = asString$7(todo.status);
								const isExpanded = expanded === todoId;
								const meta = [];
								if (asString$7(todo.priority) !== "") meta.push(asString$7(todo.priority));
								if (asString$7(todo.assignee) !== "") meta.push(`@${asString$7(todo.assignee)}`);
								const overdue = status !== "done" && asString$7(todo.ddl) !== "" && asString$7(todo.ddl) < todayStr();
								const dueToday = status !== "done" && asString$7(todo.ddl) === todayStr();
								return (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsxs)("div", {
									className: status === "done" ? `${todo_pane_module_css_default.row} ${todo_pane_module_css_default.rowDone}` : overdue ? `${todo_pane_module_css_default.row} ${todo_pane_module_css_default.rowOverdue}` : todo_pane_module_css_default.row,
									children: [(0, react_jsx_runtime.jsx)(StatusDot, {
										status,
										busy: busyId === todoId,
										onToggle: () => {
											onToggle(todo);
										},
										title: status === "done" ? "重开待办" : "完成待办"
									}), (0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										className: todo_pane_module_css_default.rowMain,
										onClick: () => {
											setExpanded(isExpanded ? "" : todoId);
										},
										"aria-expanded": isExpanded,
										children: [(0, react_jsx_runtime.jsx)("span", {
											className: todo_pane_module_css_default.rowTitle,
											children: asString$7(todo.title)
										}), (0, react_jsx_runtime.jsxs)("span", {
											className: todo_pane_module_css_default.rowMeta,
											children: [
												asString$7(todo.ddl) !== "" && (0, react_jsx_runtime.jsxs)("span", {
													className: overdue ? `${todo_pane_module_css_default.chip} ${todo_pane_module_css_default.chipDanger}` : dueToday ? `${todo_pane_module_css_default.chip} ${todo_pane_module_css_default.chipWarn}` : todo_pane_module_css_default.chip,
													children: [overdue ? "逾期 " : dueToday ? "今天 " : "", asString$7(todo.ddl)]
												}),
												asTags(todo.tags).map((tag) => (0, react_jsx_runtime.jsxs)("span", {
													className: todo_pane_module_css_default.chipTag,
													onClick: (event) => {
														event.stopPropagation();
														props.actions.setTodoTag(props.tagFilter === tag ? "" : tag);
													},
													children: ["#", tag]
												}, tag)),
												meta.map((part) => (0, react_jsx_runtime.jsx)("span", {
													className: todo_pane_module_css_default.chipMuted,
													children: part
												}, part))
											]
										})]
									})]
								}), isExpanded && (0, react_jsx_runtime.jsxs)("div", {
									className: todo_pane_module_css_default.detail,
									children: [
										(0, react_jsx_runtime.jsxs)("div", {
											className: todo_pane_module_css_default.detailLine,
											children: [
												"ID ",
												todoId,
												" · 状态 ",
												status,
												asString$7(todo.ddl) === "" ? "" : ` · DDL ${asString$7(todo.ddl)}`
											]
										}),
										asString$7(todo.assignee) !== "" && (0, react_jsx_runtime.jsxs)("div", {
											className: todo_pane_module_css_default.detailLine,
											children: ["负责人：", asString$7(todo.assignee)]
										}),
										asString$7(todo.log) !== "" && (0, react_jsx_runtime.jsx)("div", {
											className: todo_pane_module_css_default.detailLog,
											children: asString$7(todo.log).split("\n").slice(-4).map((line, index) => (0, react_jsx_runtime.jsx)("div", { children: line }, index))
										}),
										(0, react_jsx_runtime.jsx)("div", {
											className: todo_pane_module_css_default.detailHint,
											children: "改期/改负责人请直接告诉 agent。"
										})
									]
								})] }, todoId);
							})]
						}, bucket.key))]
					}),
					(0, react_jsx_runtime.jsx)("footer", {
						className: todo_pane_module_css_default.foot,
						children: (0, react_jsx_runtime.jsx)("span", { children: "演示阶段：待办存于多维表格「待办任务库」，后续切换原生后端时数据与标签平滑迁移" })
					}),
					notice !== "" && (0, react_jsx_runtime.jsx)("div", {
						className: todo_pane_module_css_default.notice,
						role: "status",
						children: notice
					})
				]
			});
		}
		//#endregion
		//#region \0dsh-css:/Users/guoxinshan/dev/dsh-yzj/packages/ui-yzj/src/client/calendar-pane.module.css.mjs
		const css$3 = ".Djov9a_page{flex-direction:column;flex:1;height:100%;min-height:0;display:flex}.Djov9a_toolbar{flex:none;justify-content:space-between;align-items:center;gap:12px;padding:12px 16px 10px;display:flex}.Djov9a_toolbarLeft{align-items:center;gap:8px;min-width:0;display:flex}.Djov9a_today{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:8px;padding:6px 14px;font-size:13px}.Djov9a_today:hover{background:var(--dsw-alias-interactive-bg-hover)}.Djov9a_nav{align-items:center;display:flex}.Djov9a_icon{width:28px;height:28px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:6px;justify-content:center;align-items:center;font-size:18px;display:flex}.Djov9a_icon:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.Djov9a_range{color:var(--dsw-alias-label-primary);white-space:nowrap;text-overflow:ellipsis;font-size:15px;font-weight:600;overflow:hidden}.Djov9a_views{background:var(--dsw-alias-bg-layer-1);border-radius:8px;flex:none;padding:2px;display:flex}.Djov9a_view{color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;border-radius:6px;padding:6px 14px;font-size:13px;line-height:1}.Djov9a_viewOn{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-weight:600;box-shadow:0 1px 2px #0000000f}.Djov9a_week{flex-direction:column;flex:1;min-height:0;display:flex}.Djov9a_weekHead{border-top:1px solid var(--dsw-alias-border-l2);border-bottom:1px solid var(--dsw-alias-border-l2);flex:none;display:flex}.Djov9a_gutter{width:52px;color:var(--dsw-alias-label-caption);flex:none;justify-content:center;align-items:flex-end;padding-bottom:6px;font-size:11px;display:flex}.Djov9a_dayHead{border:none;border-left:1px solid var(--dsw-alias-border-l2);cursor:pointer;background:0 0;flex-direction:column;flex:1;align-items:center;gap:2px;padding:8px 0;display:flex}.Djov9a_dayWeek{color:var(--dsw-alias-label-tertiary);font-size:12px}.Djov9a_dayDate{color:var(--dsw-alias-label-primary);justify-content:center;align-items:center;width:24px;height:24px;font-size:16px;font-weight:600;display:flex}.Djov9a_dayHeadToday .Djov9a_dayDate{color:var(--dsw-static-deepseek-500)}.Djov9a_dayHeadOn .Djov9a_dayDate{background:var(--dsw-static-deepseek-500);color:#fff;border-radius:50%}.Djov9a_weekBody{flex:1;min-height:0;display:flex;overflow-y:auto}.Djov9a_times{flex:none;width:52px}.Djov9a_timeRow{position:relative}.Djov9a_timeLabel{color:var(--dsw-alias-label-caption);font-size:11px;position:absolute;top:-7px;right:6px}.Djov9a_grid{flex:1;display:flex;position:relative}.Djov9a_col{border-left:1px solid var(--dsw-alias-border-l2);background-image:repeating-linear-gradient(to bottom, transparent, transparent 51px, var(--dsw-alias-border-l2) 51px, var(--dsw-alias-border-l2) 52px);flex:1;position:relative}.Djov9a_colToday{background-color:color-mix(in srgb, var(--dsw-static-deepseek-500) 6%, transparent)}.Djov9a_colOn{background-color:color-mix(in srgb, var(--dsw-static-deepseek-500) 10%, transparent)}.Djov9a_block{z-index:1;cursor:pointer;text-align:left;border:none;border-radius:6px;flex-direction:column;align-items:flex-start;gap:1px;padding:2px 6px;display:flex;position:absolute;left:3px;right:3px;overflow:hidden}.Djov9a_blockTitle{color:var(--dsw-alias-label-primary);text-overflow:ellipsis;white-space:nowrap;max-width:100%;font-size:12px;font-weight:500;overflow:hidden}.Djov9a_blockTime{color:var(--dsw-alias-label-tertiary);font-size:11px}.Djov9a_blockOn{outline:1px solid var(--dsw-static-deepseek-500)}.Djov9a_block_blue{background:color-mix(in srgb, var(--dsw-static-deepseek-500) 16%, #fff);box-shadow:inset 2px 0 var(--dsw-static-deepseek-500)}.Djov9a_block_green{background:#ebf9ee;box-shadow:inset 2px 0 #2a9f47}.Djov9a_block_orange{background:#fff4e5;box-shadow:inset 2px 0 #ff9500}.Djov9a_block_red{background:#fcebea;box-shadow:inset 2px 0 #e5352b}.Djov9a_block_purple{background:#f3eefe;box-shadow:inset 2px 0 #7c3aed}.Djov9a_now{z-index:3;border-top:1.5px solid #e5352b;height:0;position:absolute;left:0;right:0}.Djov9a_nowDot{background:#e5352b;border-radius:50%;width:8px;height:8px;position:absolute;top:-4px;left:-3px}.Djov9a_month{border-top:1px solid var(--dsw-alias-border-l2);flex-direction:column;flex:1;min-height:0;display:flex}.Djov9a_monthHead{border-bottom:1px solid var(--dsw-alias-border-l2);flex:none;grid-template-columns:repeat(7,1fr);display:grid}.Djov9a_monthHeadCell{text-align:center;color:var(--dsw-alias-label-tertiary);padding:8px 0;font-size:12px}.Djov9a_monthGrid{flex-direction:column;flex:1;min-height:0;display:flex;overflow-y:auto}.Djov9a_monthRow{flex:1;grid-template-columns:repeat(7,1fr);min-height:88px;display:grid}.Djov9a_monthCell{border-right:1px solid var(--dsw-alias-border-l2);border-bottom:1px solid var(--dsw-alias-border-l2);cursor:pointer;flex-direction:column;gap:3px;padding:6px 6px 4px;display:flex;overflow:hidden}.Djov9a_monthCell:hover{background:var(--dsw-alias-interactive-bg-hover)}.Djov9a_monthCellMuted .Djov9a_monthDate{color:var(--dsw-alias-label-caption)}.Djov9a_monthCellOn{background:color-mix(in srgb, var(--dsw-static-deepseek-500) 8%, transparent)}.Djov9a_monthDateRow{justify-content:flex-end;display:flex}.Djov9a_monthDate{color:var(--dsw-alias-label-primary);justify-content:center;align-items:center;width:22px;height:22px;font-size:13px;display:flex}.Djov9a_monthDateToday{background:var(--dsw-static-deepseek-500);color:#fff;border-radius:50%;font-weight:600}.Djov9a_monthEvents{flex-direction:column;gap:2px;display:flex;overflow:hidden}.Djov9a_monthEv{white-space:nowrap;cursor:pointer;text-align:left;border:none;border-radius:4px;align-items:center;gap:4px;padding:1px 4px;font-size:11px;display:flex;overflow:hidden}.Djov9a_monthEvOn{outline:1px solid var(--dsw-static-deepseek-500)}.Djov9a_monthEvTime{color:var(--dsw-alias-label-tertiary);flex:none}.Djov9a_monthEvTitle{text-overflow:ellipsis;color:var(--dsw-alias-label-primary);overflow:hidden}.Djov9a_ev_blue{background:color-mix(in srgb, var(--dsw-static-deepseek-500) 16%, #fff)}.Djov9a_ev_green{background:#ebf9ee}.Djov9a_ev_orange{background:#fff4e5}.Djov9a_ev_red{background:#fcebea}.Djov9a_ev_purple{background:#f3eefe}.Djov9a_monthMore{color:var(--dsw-alias-label-tertiary);padding-left:4px;font-size:11px}.Djov9a_year{border-top:1px solid var(--dsw-alias-border-l2);flex:1;grid-template-columns:repeat(4,1fr);align-content:start;gap:16px;padding:16px 18px;display:grid;overflow-y:auto}.Djov9a_yearMonth{cursor:pointer;text-align:left;background:0 0;border:none;border-radius:10px;padding:8px}.Djov9a_yearMonth:hover{background:var(--dsw-alias-interactive-bg-hover)}.Djov9a_yearTitle{color:var(--dsw-alias-label-primary);margin-bottom:6px;font-size:14px;font-weight:600}.Djov9a_yearTitleOn{color:var(--dsw-static-deepseek-500)}.Djov9a_yearWeek,.Djov9a_yearDays{grid-template-columns:repeat(7,1fr);display:grid}.Djov9a_yearWcell{text-align:center;color:var(--dsw-alias-label-caption);padding:2px 0;font-size:10px}.Djov9a_yearDay{height:22px;color:var(--dsw-alias-label-primary);justify-content:center;align-items:center;font-size:11px;display:flex;position:relative}.Djov9a_yearDayEmpty{visibility:hidden}.Djov9a_yearDayToday{background:var(--dsw-static-deepseek-500);color:#fff;border-radius:50%;width:20px;height:20px;margin:auto;font-weight:600}.Djov9a_yearDot{background:#ff9500;border-radius:50%;width:4px;height:4px;position:absolute;bottom:1px;left:50%;transform:translate(-50%)}.Djov9a_detail{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:10px;flex:none;margin:0 16px 12px;padding:10px 12px}.Djov9a_detailTitle{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:600}.Djov9a_detailRow{color:var(--dsw-alias-label-secondary);margin-top:4px;font-size:12px}.Djov9a_detailBody{color:var(--dsw-alias-label-primary);white-space:pre-wrap;margin-top:6px;font-size:12px}";
		const tagId$3 = "@dsh-yzj/bundle/ui-yzj/calendar-pane.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$3) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@dsh-yzj/bundle/ui-yzj";
			tag.dataset.pluginCss = tagId$3;
			tag.textContent = css$3;
			document.head.appendChild(tag);
		}
		var calendar_pane_module_css_default = {
			"ev_red": "Djov9a_ev_red",
			"yearDayToday": "Djov9a_yearDayToday",
			"yearWeek": "Djov9a_yearWeek",
			"detail": "Djov9a_detail",
			"block_orange": "Djov9a_block_orange",
			"monthGrid": "Djov9a_monthGrid",
			"detailBody": "Djov9a_detailBody",
			"dayHead": "Djov9a_dayHead",
			"yearMonth": "Djov9a_yearMonth",
			"yearTitleOn": "Djov9a_yearTitleOn",
			"monthEv": "Djov9a_monthEv",
			"monthCellOn": "Djov9a_monthCellOn",
			"yearDays": "Djov9a_yearDays",
			"views": "Djov9a_views",
			"blockTime": "Djov9a_blockTime",
			"monthMore": "Djov9a_monthMore",
			"week": "Djov9a_week",
			"yearWcell": "Djov9a_yearWcell",
			"yearDayEmpty": "Djov9a_yearDayEmpty",
			"icon": "Djov9a_icon",
			"block": "Djov9a_block",
			"monthEvTime": "Djov9a_monthEvTime",
			"times": "Djov9a_times",
			"range": "Djov9a_range",
			"month": "Djov9a_month",
			"blockOn": "Djov9a_blockOn",
			"nav": "Djov9a_nav",
			"ev_blue": "Djov9a_ev_blue",
			"monthDate": "Djov9a_monthDate",
			"block_blue": "Djov9a_block_blue",
			"dayWeek": "Djov9a_dayWeek",
			"gutter": "Djov9a_gutter",
			"monthHeadCell": "Djov9a_monthHeadCell",
			"toolbarLeft": "Djov9a_toolbarLeft",
			"yearDay": "Djov9a_yearDay",
			"weekHead": "Djov9a_weekHead",
			"page": "Djov9a_page",
			"blockTitle": "Djov9a_blockTitle",
			"timeRow": "Djov9a_timeRow",
			"block_green": "Djov9a_block_green",
			"ev_green": "Djov9a_ev_green",
			"now": "Djov9a_now",
			"detailTitle": "Djov9a_detailTitle",
			"col": "Djov9a_col",
			"monthHead": "Djov9a_monthHead",
			"ev_purple": "Djov9a_ev_purple",
			"viewOn": "Djov9a_viewOn",
			"colToday": "Djov9a_colToday",
			"block_purple": "Djov9a_block_purple",
			"dayHeadOn": "Djov9a_dayHeadOn",
			"yearTitle": "Djov9a_yearTitle",
			"block_red": "Djov9a_block_red",
			"ev_orange": "Djov9a_ev_orange",
			"year": "Djov9a_year",
			"today": "Djov9a_today",
			"nowDot": "Djov9a_nowDot",
			"detailRow": "Djov9a_detailRow",
			"view": "Djov9a_view",
			"dayDate": "Djov9a_dayDate",
			"timeLabel": "Djov9a_timeLabel",
			"dayHeadToday": "Djov9a_dayHeadToday",
			"monthDateToday": "Djov9a_monthDateToday",
			"grid": "Djov9a_grid",
			"weekBody": "Djov9a_weekBody",
			"monthCellMuted": "Djov9a_monthCellMuted",
			"yearDot": "Djov9a_yearDot",
			"monthEvTitle": "Djov9a_monthEvTitle",
			"colOn": "Djov9a_colOn",
			"monthRow": "Djov9a_monthRow",
			"monthDateRow": "Djov9a_monthDateRow",
			"monthEvOn": "Djov9a_monthEvOn",
			"monthEvents": "Djov9a_monthEvents",
			"toolbar": "Djov9a_toolbar",
			"monthCell": "Djov9a_monthCell"
		};
		//#endregion
		//#region lib/types/client/calendar-pane.js
		/**
		* Workbench calendar (group-room-topics v1.16): Lingee-shaped day / week /
		* month / year views over the month events already fetched by the panel.
		*/
		const WEEKDAYS = [
			"一",
			"二",
			"三",
			"四",
			"五",
			"六",
			"日"
		];
		const HOUR_START = 7;
		const HOUR_END = 21;
		const HOUR_PX = 52;
		const TONES = [
			"blue",
			"green",
			"orange",
			"red",
			"purple"
		];
		function asRecord$8(value) {
			return typeof value === "object" && value !== null ? value : {};
		}
		function asString$6(value) {
			return typeof value === "string" ? value : "";
		}
		function pad(n) {
			return String(n).padStart(2, "0");
		}
		function ymd(date) {
			return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
		}
		function parseDay(day, fallback) {
			if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return fallback;
			const date = /* @__PURE__ */ new Date(`${day}T00:00:00`);
			return Number.isNaN(date.getTime()) ? fallback : date;
		}
		function mondayOf(date) {
			const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
			const dow = (next.getDay() + 6) % 7;
			next.setDate(next.getDate() - dow);
			return next;
		}
		function addDays(date, days) {
			return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
		}
		function clock$1(ms) {
			if (typeof ms !== "number") return "";
			const date = new Date(ms);
			return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
		}
		function toneOf(id) {
			let hash = 0;
			for (let i = 0; i < id.length; i += 1) hash = (hash + id.charCodeAt(i)) % TONES.length;
			return TONES[hash] ?? "blue";
		}
		function eventDayKey(event) {
			if (typeof event.startDate !== "number") return "";
			return ymd(new Date(event.startDate));
		}
		function eventsOn(events, day) {
			return events.map(asRecord$8).filter((event) => eventDayKey(event) === day);
		}
		function eventBlock(event) {
			if (typeof event.startDate !== "number") return void 0;
			const start = new Date(event.startDate);
			const end = typeof event.endDate === "number" ? new Date(event.endDate) : new Date(event.startDate + 36e5);
			const startHour = start.getHours() + start.getMinutes() / 60;
			const endHour = end.getHours() + end.getMinutes() / 60;
			return {
				top: (startHour - HOUR_START) * HOUR_PX,
				height: Math.max(22, (endHour - startHour) * HOUR_PX)
			};
		}
		function hours() {
			const list = [];
			for (let hour = HOUR_START; hour <= HOUR_END; hour += 1) list.push(hour);
			return list;
		}
		/**
		* Full-page calendar with 日 / 周 / 月 / 年, matching the Lingee `.cal` chrome.
		*/
		function CalendarPane(props) {
			const [view, setView] = (0, react.useState)("week");
			const cursor = parseDay(props.day, new Date(props.year, props.month - 1, 1));
			const today = ymd(/* @__PURE__ */ new Date());
			const weekStart = mondayOf(cursor);
			const weekDays = (0, react.useMemo)(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart.getTime()]);
			const rangeLabel = (() => {
				if (view === "year") return `${cursor.getFullYear()}年`;
				if (view === "month") return `${cursor.getFullYear()}年${cursor.getMonth() + 1}月`;
				if (view === "day") return `${cursor.getMonth() + 1}月${cursor.getDate()}日`;
				const end = weekDays[6] ?? cursor;
				if (weekStart.getMonth() === end.getMonth()) return `${weekStart.getFullYear()}年${weekStart.getMonth() + 1}月${weekStart.getDate()}日 – ${end.getDate()}日`;
				return `${weekStart.getMonth() + 1}月${weekStart.getDate()}日 – ${end.getMonth() + 1}月${end.getDate()}日`;
			})();
			const goToday = () => {
				const now = /* @__PURE__ */ new Date();
				props.onNavigate(now.getFullYear(), now.getMonth() + 1, ymd(now));
			};
			const go = (delta) => {
				let next = new Date(cursor);
				if (view === "day") next = addDays(cursor, delta);
				else if (view === "week") next = addDays(cursor, delta * 7);
				else if (view === "month") next = new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1);
				else next = new Date(cursor.getFullYear() + delta, cursor.getMonth(), 1);
				props.onNavigate(next.getFullYear(), next.getMonth() + 1, ymd(next));
			};
			const pickDay = (date, nextView) => {
				if (nextView !== void 0) setView(nextView);
				props.onNavigate(date.getFullYear(), date.getMonth() + 1, ymd(date));
			};
			const renderEventChip = (event, key) => {
				const id = asString$6(event.id);
				const tone = toneOf(id === "" ? asString$6(event.title) : id);
				const start = clock$1(event.startDate);
				return (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: `${calendar_pane_module_css_default.monthEv} ${calendar_pane_module_css_default[`ev_${tone}`]} ${id === props.eventId ? calendar_pane_module_css_default.monthEvOn : ""}`,
					onClick: (click) => {
						click.stopPropagation();
						props.onSelectEvent(event);
					},
					children: [(0, react_jsx_runtime.jsx)("span", {
						className: calendar_pane_module_css_default.monthEvTime,
						children: start === "" ? "全天" : start
					}), (0, react_jsx_runtime.jsx)("span", {
						className: calendar_pane_module_css_default.monthEvTitle,
						children: asString$6(event.title)
					})]
				}, key);
			};
			const renderTimed = (day) => {
				const key = ymd(day);
				return eventsOn(props.events, key).map((event, index) => {
					const box = eventBlock(event);
					if (box === void 0) return null;
					const id = asString$6(event.id);
					const tone = toneOf(id === "" ? asString$6(event.title) : id);
					return (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: `${calendar_pane_module_css_default.block} ${calendar_pane_module_css_default[`block_${tone}`]} ${id === props.eventId ? calendar_pane_module_css_default.blockOn : ""}`,
						style: {
							top: box.top,
							height: box.height
						},
						onClick: () => {
							props.onSelectEvent(event);
						},
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: calendar_pane_module_css_default.blockTitle,
							children: asString$6(event.title)
						}), (0, react_jsx_runtime.jsxs)("span", {
							className: calendar_pane_module_css_default.blockTime,
							children: [clock$1(event.startDate), clock$1(event.endDate) === "" ? "" : ` – ${clock$1(event.endDate)}`]
						})]
					}, `${key}-${index}`);
				});
			};
			const nowTop = (() => {
				const now = /* @__PURE__ */ new Date();
				if (ymd(now) !== ymd(cursor) && view === "day") return void 0;
				const hour = now.getHours() + now.getMinutes() / 60;
				if (hour < HOUR_START || hour > HOUR_END) return void 0;
				return (hour - HOUR_START) * HOUR_PX;
			})();
			return (0, react_jsx_runtime.jsxs)("div", {
				className: calendar_pane_module_css_default.page,
				"data-testid": "yzj-calendar-pane",
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: calendar_pane_module_css_default.toolbar,
						children: [(0, react_jsx_runtime.jsxs)("div", {
							className: calendar_pane_module_css_default.toolbarLeft,
							children: [
								(0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: calendar_pane_module_css_default.today,
									onClick: goToday,
									children: "今天"
								}),
								(0, react_jsx_runtime.jsxs)("div", {
									className: calendar_pane_module_css_default.nav,
									children: [(0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: calendar_pane_module_css_default.icon,
										"aria-label": "上一段",
										onClick: () => go(-1),
										children: "‹"
									}), (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: calendar_pane_module_css_default.icon,
										"aria-label": "下一段",
										onClick: () => go(1),
										children: "›"
									})]
								}),
								(0, react_jsx_runtime.jsx)("span", {
									className: calendar_pane_module_css_default.range,
									children: rangeLabel
								})
							]
						}), (0, react_jsx_runtime.jsx)("div", {
							className: calendar_pane_module_css_default.views,
							role: "tablist",
							"aria-label": "日程视图",
							children: [
								"day",
								"week",
								"month",
								"year"
							].map((item) => (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								role: "tab",
								"aria-selected": view === item,
								className: view === item ? `${calendar_pane_module_css_default.view} ${calendar_pane_module_css_default.viewOn}` : calendar_pane_module_css_default.view,
								onClick: () => {
									setView(item);
								},
								children: item === "day" ? "日" : item === "week" ? "周" : item === "month" ? "月" : "年"
							}, item))
						})]
					}),
					view === "week" && (0, react_jsx_runtime.jsxs)("div", {
						className: calendar_pane_module_css_default.week,
						children: [(0, react_jsx_runtime.jsxs)("div", {
							className: calendar_pane_module_css_default.weekHead,
							children: [(0, react_jsx_runtime.jsx)("div", {
								className: calendar_pane_module_css_default.gutter,
								children: "GMT+8"
							}), weekDays.map((day) => {
								const key = ymd(day);
								return (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: `${calendar_pane_module_css_default.dayHead} ${key === today ? calendar_pane_module_css_default.dayHeadToday : ""} ${key === props.day ? calendar_pane_module_css_default.dayHeadOn : ""}`,
									onClick: () => pickDay(day, "day"),
									children: [(0, react_jsx_runtime.jsx)("span", {
										className: calendar_pane_module_css_default.dayWeek,
										children: WEEKDAYS[(day.getDay() + 6) % 7]
									}), (0, react_jsx_runtime.jsx)("span", {
										className: calendar_pane_module_css_default.dayDate,
										children: day.getDate()
									})]
								}, key);
							})]
						}), (0, react_jsx_runtime.jsxs)("div", {
							className: calendar_pane_module_css_default.weekBody,
							children: [(0, react_jsx_runtime.jsx)("div", {
								className: calendar_pane_module_css_default.times,
								children: hours().map((hour) => (0, react_jsx_runtime.jsx)("div", {
									className: calendar_pane_module_css_default.timeRow,
									style: { height: HOUR_PX },
									children: (0, react_jsx_runtime.jsxs)("span", {
										className: calendar_pane_module_css_default.timeLabel,
										children: [pad(hour), ":00"]
									})
								}, hour))
							}), (0, react_jsx_runtime.jsx)("div", {
								className: calendar_pane_module_css_default.grid,
								style: { height: hours().length * HOUR_PX },
								children: weekDays.map((day) => {
									const key = ymd(day);
									return (0, react_jsx_runtime.jsx)("div", {
										className: `${calendar_pane_module_css_default.col} ${key === today ? calendar_pane_module_css_default.colToday : ""} ${key === props.day ? calendar_pane_module_css_default.colOn : ""}`,
										onClick: () => pickDay(day),
										children: renderTimed(day)
									}, key);
								})
							})]
						})]
					}),
					view === "day" && (0, react_jsx_runtime.jsxs)("div", {
						className: calendar_pane_module_css_default.week,
						children: [(0, react_jsx_runtime.jsxs)("div", {
							className: calendar_pane_module_css_default.weekHead,
							children: [(0, react_jsx_runtime.jsx)("div", {
								className: calendar_pane_module_css_default.gutter,
								children: "GMT+8"
							}), (0, react_jsx_runtime.jsxs)("div", {
								className: `${calendar_pane_module_css_default.dayHead} ${calendar_pane_module_css_default.dayHeadOn} ${ymd(cursor) === today ? calendar_pane_module_css_default.dayHeadToday : ""}`,
								children: [(0, react_jsx_runtime.jsx)("span", {
									className: calendar_pane_module_css_default.dayWeek,
									children: WEEKDAYS[(cursor.getDay() + 6) % 7]
								}), (0, react_jsx_runtime.jsx)("span", {
									className: calendar_pane_module_css_default.dayDate,
									children: cursor.getDate()
								})]
							})]
						}), (0, react_jsx_runtime.jsxs)("div", {
							className: calendar_pane_module_css_default.weekBody,
							children: [(0, react_jsx_runtime.jsx)("div", {
								className: calendar_pane_module_css_default.times,
								children: hours().map((hour) => (0, react_jsx_runtime.jsx)("div", {
									className: calendar_pane_module_css_default.timeRow,
									style: { height: HOUR_PX },
									children: (0, react_jsx_runtime.jsxs)("span", {
										className: calendar_pane_module_css_default.timeLabel,
										children: [pad(hour), ":00"]
									})
								}, hour))
							}), (0, react_jsx_runtime.jsx)("div", {
								className: calendar_pane_module_css_default.grid,
								style: { height: hours().length * HOUR_PX },
								children: (0, react_jsx_runtime.jsxs)("div", {
									className: `${calendar_pane_module_css_default.col} ${calendar_pane_module_css_default.colOn} ${ymd(cursor) === today ? calendar_pane_module_css_default.colToday : ""}`,
									children: [renderTimed(cursor), nowTop !== void 0 && ymd(cursor) === today && (0, react_jsx_runtime.jsx)("div", {
										className: calendar_pane_module_css_default.now,
										style: { top: nowTop },
										children: (0, react_jsx_runtime.jsx)("span", { className: calendar_pane_module_css_default.nowDot })
									})]
								})
							})]
						})]
					}),
					view === "month" && (0, react_jsx_runtime.jsxs)("div", {
						className: calendar_pane_module_css_default.month,
						children: [(0, react_jsx_runtime.jsx)("div", {
							className: calendar_pane_module_css_default.monthHead,
							children: WEEKDAYS.map((label) => (0, react_jsx_runtime.jsx)("div", {
								className: calendar_pane_module_css_default.monthHeadCell,
								children: label
							}, label))
						}), (0, react_jsx_runtime.jsx)("div", {
							className: calendar_pane_module_css_default.monthGrid,
							children: monthRows(cursor.getFullYear(), cursor.getMonth() + 1).map((row, rowIndex) => (0, react_jsx_runtime.jsx)("div", {
								className: calendar_pane_module_css_default.monthRow,
								children: row.map((cell) => {
									const key = ymd(cell.date);
									const dayEvents = eventsOn(props.events, key);
									return (0, react_jsx_runtime.jsxs)("div", {
										className: `${calendar_pane_module_css_default.monthCell} ${cell.outside ? calendar_pane_module_css_default.monthCellMuted : ""} ${key === props.day ? calendar_pane_module_css_default.monthCellOn : ""}`,
										onClick: () => pickDay(cell.date, "day"),
										children: [(0, react_jsx_runtime.jsx)("div", {
											className: calendar_pane_module_css_default.monthDateRow,
											children: (0, react_jsx_runtime.jsx)("span", {
												className: `${calendar_pane_module_css_default.monthDate} ${key === today ? calendar_pane_module_css_default.monthDateToday : ""}`,
												children: cell.date.getDate()
											})
										}), (0, react_jsx_runtime.jsxs)("div", {
											className: calendar_pane_module_css_default.monthEvents,
											children: [dayEvents.slice(0, 3).map((event, index) => renderEventChip(event, `${key}-${index}`)), dayEvents.length > 3 && (0, react_jsx_runtime.jsxs)("div", {
												className: calendar_pane_module_css_default.monthMore,
												children: [
													"还有 ",
													dayEvents.length - 3,
													" 项"
												]
											})]
										})]
									}, key);
								})
							}, `r${rowIndex}`))
						})]
					}),
					view === "year" && (0, react_jsx_runtime.jsx)("div", {
						className: calendar_pane_module_css_default.year,
						children: Array.from({ length: 12 }, (_, monthIndex) => {
							const month = monthIndex + 1;
							return (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: calendar_pane_module_css_default.yearMonth,
								onClick: () => {
									setView("month");
									props.onNavigate(cursor.getFullYear(), month, `${cursor.getFullYear()}-${pad(month)}-01`);
								},
								children: [
									(0, react_jsx_runtime.jsxs)("div", {
										className: `${calendar_pane_module_css_default.yearTitle} ${month === cursor.getMonth() + 1 ? calendar_pane_module_css_default.yearTitleOn : ""}`,
										children: [month, "月"]
									}),
									(0, react_jsx_runtime.jsx)("div", {
										className: calendar_pane_module_css_default.yearWeek,
										children: WEEKDAYS.map((label) => (0, react_jsx_runtime.jsx)("span", {
											className: calendar_pane_module_css_default.yearWcell,
											children: label
										}, label))
									}),
									(0, react_jsx_runtime.jsx)("div", {
										className: calendar_pane_module_css_default.yearDays,
										children: yearCells(cursor.getFullYear(), month).map((cell, index) => {
											if (cell === null) return (0, react_jsx_runtime.jsx)("span", { className: `${calendar_pane_module_css_default.yearDay} ${calendar_pane_module_css_default.yearDayEmpty}` }, `e${index}`);
											const key = `${cursor.getFullYear()}-${pad(month)}-${pad(cell)}`;
											const has = eventsOn(props.events, key).length > 0;
											const isToday = key === today;
											return (0, react_jsx_runtime.jsxs)("span", {
												className: `${calendar_pane_module_css_default.yearDay} ${isToday ? calendar_pane_module_css_default.yearDayToday : ""}`,
												children: [cell, has && (0, react_jsx_runtime.jsx)("span", { className: calendar_pane_module_css_default.yearDot })]
											}, key);
										})
									})
								]
							}, month);
						})
					}),
					props.eventDetail !== null && props.eventId !== "" && (0, react_jsx_runtime.jsxs)("div", {
						className: calendar_pane_module_css_default.detail,
						children: [
							(0, react_jsx_runtime.jsx)("div", {
								className: calendar_pane_module_css_default.detailTitle,
								children: props.eventDetail.title
							}),
							props.eventDetail.time !== "" && (0, react_jsx_runtime.jsx)("div", {
								className: calendar_pane_module_css_default.detailRow,
								children: props.eventDetail.time
							}),
							props.eventDetail.person !== "" && (0, react_jsx_runtime.jsx)("div", {
								className: calendar_pane_module_css_default.detailRow,
								children: props.eventDetail.person
							}),
							props.eventDetail.place !== "" && (0, react_jsx_runtime.jsx)("div", {
								className: calendar_pane_module_css_default.detailRow,
								children: props.eventDetail.place
							}),
							props.eventDetail.content !== "" && (0, react_jsx_runtime.jsx)("div", {
								className: calendar_pane_module_css_default.detailBody,
								children: props.eventDetail.content
							})
						]
					})
				]
			});
		}
		function monthRows(year, month) {
			const start = mondayOf(new Date(year, month - 1, 1));
			const rows = [];
			let cursor = start;
			for (let row = 0; row < 6; row += 1) {
				const cells = [];
				for (let col = 0; col < 7; col += 1) {
					cells.push({
						date: cursor,
						outside: cursor.getMonth() !== month - 1
					});
					cursor = addDays(cursor, 1);
				}
				rows.push(cells);
			}
			return rows;
		}
		function yearCells(year, month) {
			const firstDow = (new Date(year, month - 1, 1).getDay() + 6) % 7;
			const dim = new Date(year, month, 0).getDate();
			const cells = [];
			for (let i = 0; i < firstDow; i += 1) cells.push(null);
			for (let day = 1; day <= dim; day += 1) cells.push(day);
			return cells;
		}
		//#endregion
		//#region lib/types/client/panel.js
		/**
		* The Yunzhijia workspace panel: a frame overlay with three tabs — 知识库
		* (workspace → doc tree), 日程 (today), 会话 (recent groups → messages with
		* paging). Rendering stays presentational: data arrives through the injected
		* fetch face and the shared store; verbs are the injected face and store
		* actions.
		*/
		function asRecord$7(value) {
			return typeof value === "object" && value !== null ? value : {};
		}
		function asString$5(value) {
			return typeof value === "string" ? value : "";
		}
		function asArray$5(value) {
			return Array.isArray(value) ? value : [];
		}
		/** Outline cloud mark for the Yunzhijia brand, DSH icon-line style. */
		function YzjCloudIcon({ size = 16 }) {
			return (0, react_jsx_runtime.jsxs)("svg", {
				width: size,
				height: size,
				viewBox: "0 0 24 24",
				fill: "none",
				"aria-hidden": "true",
				children: [(0, react_jsx_runtime.jsx)("path", {
					d: "M7.5 18.5h9a4.25 4.25 0 0 0 .65-8.45A6 6 0 0 0 5.6 11.3a3.9 3.9 0 0 0 1.9 7.2Z",
					stroke: "currentColor",
					strokeWidth: "1.7",
					strokeLinejoin: "round"
				}), (0, react_jsx_runtime.jsx)("path", {
					d: "M9.2 14.6l2.4 2.3 3.4-3.6",
					stroke: "currentColor",
					strokeWidth: "1.7",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})]
			});
		}
		/** One-line preview of a message for the group list / reply chip. */
		function messagePreview(message) {
			const content = asString$5(message.content);
			const msgType = asString$5(message.msgType);
			const param = asRecord$7(message.param);
			if (msgType === "file") {
				const name = asString$5(param.name);
				return name === "" ? "[文件]" : `[文件] ${name}`;
			}
			if (msgType === "other" && asString$5(param.title) !== "") return `[链接] ${asString$5(param.title)}`;
			if (msgType === "richText") {
				const plain = content.replace(/\[图片\]/g, "[图片]").trim();
				return plain === "" ? "[图文]" : plain;
			}
			return content.replace(/\s+/g, " ").slice(0, 60);
		}
		/** Reply-chip title for a message (file names and media get real labels). */
		function dragTitleOf(message) {
			const msgType = asString$5(message.msgType);
			const param = asRecord$7(message.param);
			if (msgType === "file") {
				const name = asString$5(param.name);
				return name === "" ? "文件消息" : name;
			}
			if (msgType === "richText") return "图文消息";
			const content = asString$5(message.content);
			return content === "" ? "(消息)" : content;
		}
		/** Chat header inside a group: the group's avatar + name. */
		function groupNameOf(groups, groupId) {
			const group = groups.map(asRecord$7).find((item) => asString$5(item.groupId) === groupId);
			return group === void 0 ? "" : asString$5(group.groupName);
		}
		function GroupHead({ groups, groupId }) {
			const group = groups.map(asRecord$7).find((item) => asString$5(item.groupId) === groupId);
			const name = groupNameOf(groups, groupId) || "群聊";
			const avatar = group === void 0 ? "" : asString$5(group.headerUrl);
			return (0, react_jsx_runtime.jsxs)("div", {
				className: panel_module_css_default.groupHead,
				children: [(0, react_jsx_runtime.jsx)(GroupAvatar, {
					url: avatar,
					name
				}), (0, react_jsx_runtime.jsx)("span", {
					className: panel_module_css_default.groupHeadName,
					children: name
				})]
			});
		}
		const TABS = [
			{
				key: "docs",
				label: "知识库",
				icon: () => (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenOutline16, {})
			},
			{
				key: "calendar",
				label: "日程",
				icon: () => (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChecklistOutline14, {})
			},
			{
				key: "chat",
				label: "会话",
				icon: () => (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconNewChatOutline16, {})
			},
			{
				key: "todo",
				label: "待办",
				icon: () => (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconListPenOutline16, {})
			}
		];
		/** Sum the effective (read-aware) unread counts of a recent-session window. */
		function unreadTotalOf(value) {
			return asArray$5(asRecord$7(value).list).reduce((sum, item) => {
				const group = asRecord$7(item);
				const server = typeof group.unreadCount === "number" ? group.unreadCount : 0;
				if (server <= 0) return sum;
				return sum + effectiveUnread(asString$5(group.groupId), server);
			}, 0);
		}
		/** Load one tab's data into the store through the fetch face. */
		function loadTab(tab, props) {
			const fail = (error) => {
				props.actions.setError(typeof error === "string" ? error : "加载失败");
				props.actions.setLoading(false);
			};
			props.actions.setLoading(true);
			props.actions.setError("");
			if (tab === "docs") props.fetchWorkspaces().then((result) => {
				if (result.ok) {
					props.actions.setWorkspaces(asArray$5(result.value));
					props.actions.setLoading(false);
				} else fail(result.error.message);
			});
			else if (tab === "calendar") {
				const pad = (n) => String(n).padStart(2, "0");
				const now = /* @__PURE__ */ new Date();
				const year = now.getFullYear();
				const month = now.getMonth() + 1;
				props.actions.setCalCursor(year, month);
				props.actions.setCalDay(`${year}-${pad(month)}-${pad(now.getDate())}`);
				props.actions.setCalEventId("");
				const start = `${year}-${pad(month)}-01`;
				const end = `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`;
				props.fetchEvents(start, end).then((result) => {
					if (result.ok) {
						props.actions.setCalEvents(asArray$5(result.value));
						props.actions.setLoading(false);
					} else fail(result.error.message);
				});
			} else if (tab === "chat") {
				const cached = getGroupWindow();
				if (cached !== void 0) {
					props.actions.setGroups(cached.groups);
					props.actions.setGroupsPage(1);
					props.actions.setGroupsMore(cached.more);
					props.actions.setLoading(false);
					return;
				}
				props.fetchGroups(20, 1).then((result) => {
					if (result.ok) {
						const groups = asArray$5(asRecord$7(result.value).list);
						putGroupWindow(groups, asRecord$7(result.value).more === true);
						props.actions.setGroups(groups);
						props.actions.setGroupsPage(1);
						props.actions.setGroupsMore(asRecord$7(result.value).more === true);
						props.actions.setLoading(false);
					} else fail(result.error.message);
				});
			} else if (tab === "todo") props.todoState().then((result) => {
				if (result.ok) {
					const value = asRecord$7(result.value);
					const library = asRecord$7(value.library);
					props.actions.setTodoState(asArray$5(value.todos), value.ready === true, typeof library.link === "string" ? library.link : "", typeof value.libraryName === "string" ? value.libraryName : void 0, typeof value.libraryScope === "string" ? value.libraryScope : void 0);
					props.actions.setTodoLibraries([], typeof value.activeDocId === "string" ? value.activeDocId : "");
					props.actions.setLoading(false);
					if (typeof value.error === "string" && value.error !== "") props.actions.setError(`待办读取失败：${value.error}`);
				} else fail(result.error.message);
			});
		}
		/** The frame-overlay Yunzhijia panel; renders null while closed. */
		function YzjPanel(props) {
			const open = props.useStore((state) => state.open);
			(0, react.useEffect)(() => {
				bindImCachePersistence((key, payload, fetchedAt) => {
					props.imCachePut(key, payload, fetchedAt);
				}, async (key) => {
					const result = await props.imCacheGet(key);
					if (!result.ok || result.value === null) return null;
					return {
						payload: result.value.payload,
						fetchedAt: result.value.fetchedAt
					};
				});
			}, []);
			const tab = props.useStore((state) => state.tab);
			const embedded = props.embedded === true;
			const storedTab = tab === "docs" || tab === "calendar" || tab === "chat" || tab === "todo" ? tab : "docs";
			const activeTab = embedded ? props.forceTab ?? (storedTab === "chat" ? "todo" : storedTab) : storedTab;
			const anchorActive = props.useStore((state) => state.anchorMsgId !== "");
			const state = props.useStore((s) => s);
			const panelRef = (0, react.useRef)(null);
			const dragOffset = (0, react.useRef)(null);
			const anchorRef = (0, react.useRef)(null);
			const [anchorToast, setAnchorToast] = (0, react.useState)("");
			const [senderNames, setSenderNames] = (0, react.useState)({});
			const [lightbox, setLightbox] = (0, react.useState)(null);
			const [draft, setDraft] = (0, react.useState)("");
			const [sending, setSending] = (0, react.useState)(false);
			const [uploading, setUploading] = (0, react.useState)(false);
			const [replyTo, setReplyTo] = (0, react.useState)(null);
			const [emojiOpen, setEmojiOpen] = (0, react.useState)(false);
			const [myProfile, setMyProfile] = (0, react.useState)({
				openId: "",
				name: ""
			});
			const [docPreview, setDocPreview] = (0, react.useState)(null);
			/** Folder drill-down trail inside the selected workspace (root = workspace). */
			const [docCrumbs, setDocCrumbs] = (0, react.useState)([]);
			/** 知识库搜索(v0.1.4):null = 浏览模式;非 null = 搜索结果列表(可能空)。 */
			const [docQuery, setDocQuery] = (0, react.useState)("");
			const [docResults, setDocResults] = (0, react.useState)(null);
			const [docSearching, setDocSearching] = (0, react.useState)(false);
			const [eventDetail, setEventDetail] = (0, react.useState)(null);
			const [messagesFetching, setMessagesFetching] = (0, react.useState)(false);
			const openGenRef = (0, react.useRef)(0);
			const listRef = (0, react.useRef)(null);
			(0, react.useRef)(null);
			(0, react.useRef)(null);
			const draftRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				ensureMyProfile(props).then((profile) => {
					setMyProfile({
						openId: profile.openId,
						name: profile.name
					});
					if (profile.openId !== "" && profile.name !== "") setSenderNames((prev) => ({
						...prev,
						[profile.openId]: profile.name
					}));
				});
			}, []);
			(0, react.useEffect)(() => registerPanelController(props.actions, props), []);
			(0, react.useEffect)(() => {
				if (state.groupId === "") return;
				const group = state.groups.map(asRecord$7).find((item) => asString$5(item.groupId) === state.groupId);
				if (group === void 0) return;
				const serverUnread = typeof group.unreadCount === "number" ? group.unreadCount : 0;
				if (serverUnread <= 0) return;
				markGroupRead(state.groupId, serverUnread);
				props.actions.setGroups(state.groups.map((item) => asString$5(asRecord$7(item).groupId) === state.groupId ? {
					...asRecord$7(item),
					unreadCount: 0
				} : item));
				props.actions.setUnreadTotal(unreadTotalOf({ list: state.groups }));
			}, [state.groupId]);
			(0, react.useEffect)(() => {
				if (draft === "" && draftRef.current !== null) draftRef.current.style.height = "auto";
			}, [draft]);
			const atBottomRef = (0, react.useRef)(true);
			const chatScrollRef = (0, react.useRef)({
				more: false,
				loading: false,
				loadOlder: () => {}
			});
			const scrollRestoreRef = (0, react.useRef)(null);
			const lastTopLoadRef = (0, react.useRef)(0);
			(0, react.useEffect)(() => {
				if (!open || activeTab !== "chat" || state.groupId === "") return;
				const poll = () => {
					const anchor = state.messages.length > 0 ? asString$5(asRecord$7(state.messages[state.messages.length - 1]).msgId) : "";
					(anchor === "" ? props.fetchMessages(state.groupId, 20) : props.fetchMessages(state.groupId, 20, {
						type: "new",
						msgId: anchor
					})).then((result) => {
						if (!result.ok) return;
						const fresh = asArray$5(asRecord$7(result.value).list);
						if (fresh.length === 0) return;
						const known = new Set(state.messages.map((message) => String(asRecord$7(message).msgId)));
						const delta = fresh.filter((message) => !known.has(String(asRecord$7(message).msgId)));
						if (delta.length === 0) return;
						props.actions.appendMessages(delta);
						putMessageWindow(state.groupId, [...state.messages, ...delta], state.messagesMore);
						markGroupRead(state.groupId, delta.length);
						props.actions.setGroups(state.groups.map((item) => asString$5(asRecord$7(item).groupId) === state.groupId ? {
							...asRecord$7(item),
							unreadCount: 0
						} : item));
						props.actions.setUnreadTotal(unreadTotalOf({ list: state.groups.map((item) => asString$5(asRecord$7(item).groupId) === state.groupId ? {
							...asRecord$7(item),
							unreadCount: 0
						} : item) }));
						if (atBottomRef.current) {
							const list = listRef.current;
							if (list !== null) list.scrollTop = list.scrollHeight;
						}
					});
				};
				const interval = window.setInterval(poll, 3e4);
				return () => window.clearInterval(interval);
			}, [
				open,
				activeTab,
				state.groupId,
				state.messages.length === 0
			]);
			(0, react.useEffect)(() => {
				const list = listRef.current;
				if (list === null || activeTab !== "chat") return;
				const onScroll = () => {
					atBottomRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
					const { more, loading, loadOlder } = chatScrollRef.current;
					if (list.scrollTop <= 60 && more && !loading && scrollRestoreRef.current === null && Date.now() - lastTopLoadRef.current > 1200) {
						lastTopLoadRef.current = Date.now();
						scrollRestoreRef.current = {
							height: list.scrollHeight,
							top: list.scrollTop
						};
						loadOlder();
					}
				};
				list.addEventListener("scroll", onScroll, { passive: true });
				return () => list.removeEventListener("scroll", onScroll);
			}, [activeTab, state.groupId]);
			(0, react.useEffect)(() => {
				chatScrollRef.current = {
					...chatScrollRef.current,
					more: state.messagesMore,
					loading: messagesFetching
				};
			}, [state.messagesMore, messagesFetching]);
			(0, react.useEffect)(() => {
				if (state.docId === "" || docPreview !== null) return;
				loadDocPreview(state.docId);
			}, [state.docId]);
			(0, react.useEffect)(() => {
				if (state.calEventId === "" || eventDetail !== null) return;
				const event = state.calEvents.map(asRecord$7).find((item) => asString$5(item.id) === state.calEventId);
				if (event !== void 0) pickEvent(event);
			}, [state.calEventId, state.calEvents]);
			(0, react.useEffect)(() => {
				if (state.groupId === "" || state.anchorMsgId !== "") return;
				const list = listRef.current;
				if (list === null) return;
				list.scrollTop = list.scrollHeight;
			}, [state.groupId, state.messages]);
			(0, react.useEffect)(() => {
				const openIds = state.messages.map((message) => asString$5(asRecord$7(message).fromOpenId));
				if (openIds.length === 0) return;
				const seeded = {};
				for (const openId of openIds) {
					const name = senderNameOf(openId);
					if (name !== "") seeded[openId] = name;
				}
				if (Object.keys(seeded).length > 0) setSenderNames((prev) => ({
					...prev,
					...seeded
				}));
				resolveSenders(openIds, props).then((names) => {
					if (Object.keys(names).length > 0) setSenderNames((prev) => ({
						...prev,
						...names
					}));
				});
			}, [state.messages]);
			(0, react.useEffect)(() => {
				if (lightbox === null) return;
				const onKey = (event) => {
					if (event.key === "Escape") setLightbox(null);
				};
				window.addEventListener("keydown", onKey);
				return () => window.removeEventListener("keydown", onKey);
			}, [lightbox]);
			const atCandidates = (0, react.useMemo)(() => {
				const seen = /* @__PURE__ */ new Map();
				for (const message of state.messages) {
					const openId = asString$5(asRecord$7(message).fromOpenId);
					if (openId === "") continue;
					const name = senderNames[openId] ?? "";
					if (name !== "" && !seen.has(name)) seen.set(name, {
						name,
						openId
					});
				}
				return [...seen.values()].filter((candidate) => candidate.openId !== myProfile.openId);
			}, [
				state.messages,
				senderNames,
				myProfile.openId
			]);
			const [atMenu, setAtMenu] = (0, react.useState)(null);
			atMenu === null || atCandidates.filter((candidate) => atMenu.query === "" || candidate.name.toLowerCase().includes(atMenu.query.toLowerCase())).slice(0, 6);
			(0, react.useEffect)(() => {
				if (!open) return;
				const onKey = (event) => {
					if (event.key !== "Escape" || lightbox !== null) return;
					if (emojiOpen) {
						setEmojiOpen(false);
						return;
					}
					if (replyTo !== null) {
						setReplyTo(null);
						return;
					}
					props.actions.setOpen(false);
				};
				window.addEventListener("keydown", onKey);
				return () => window.removeEventListener("keydown", onKey);
			}, [
				open,
				lightbox,
				emojiOpen,
				replyTo
			]);
			(0, react.useEffect)(() => {
				if (state.anchorMsgId === "" || anchorRef.current === null) return;
				anchorRef.current.scrollIntoView({ block: "center" });
				setAnchorToast(`已定位到锚点消息（${state.anchorMsgId.slice(0, 12)}…）`);
				const timer = window.setTimeout(() => setAnchorToast(""), 3200);
				return () => window.clearTimeout(timer);
			}, [state.messages, state.anchorMsgId]);
			(0, react.useEffect)(() => {
				if (!open) return;
				const move = (event) => {
					if (dragOffset.current === null) return;
					const x = Math.max(8, Math.min(event.clientX - dragOffset.current.dx, Math.max(8, window.innerWidth - 880)));
					const y = Math.max(8, Math.min(event.clientY - dragOffset.current.dy, window.innerHeight - 60));
					props.actions.setPanelPosition(x, y);
				};
				const up = () => {
					dragOffset.current = null;
				};
				window.addEventListener("pointermove", move);
				window.addEventListener("pointerup", up);
				return () => {
					window.removeEventListener("pointermove", move);
					window.removeEventListener("pointerup", up);
				};
			}, [open]);
			(0, react.useEffect)(() => {
				if (!open && !embedded) return;
				loadTab(activeTab, props);
			}, [
				open,
				activeTab,
				embedded
			]);
			if (!open && !embedded) return null;
			const startDrag = (event) => {
				if (event.button !== 0) return;
				const rect = panelRef.current?.getBoundingClientRect();
				if (rect === void 0) return;
				dragOffset.current = {
					dx: event.clientX - rect.left,
					dy: event.clientY - rect.top
				};
				event.preventDefault();
			};
			const dockStyle = state.panelX >= 0 && state.panelY >= 0 ? {
				left: Math.min(state.panelX, Math.max(0, window.innerWidth - 860)),
				top: Math.min(state.panelY, Math.max(0, window.innerHeight - 80)),
				margin: 0
			} : void 0;
			/** 知识库全局搜索(v0.1.4):命中后左栏切到结果列表;清空关键词回浏览模式。 */
			const runDocSearch = async () => {
				const keyword = docQuery.trim();
				if (keyword === "") {
					setDocResults(null);
					return;
				}
				setDocSearching(true);
				const result = await props.fetchDocSearch(keyword, state.workspaceId === "" ? void 0 : state.workspaceId);
				setDocSearching(false);
				if (!result.ok) {
					props.actions.setError(result.error.message);
					return;
				}
				const rows = asArray$5(result.value).length > 0 ? asArray$5(result.value) : asArray$5(asRecord$7(result.value).list);
				setDocResults(rows.map(asRecord$7));
			};
			/** Fetch one docs level of the workspace; parentId omitted = root. */
			const fetchDocsAt = (workspace, parentId) => {
				props.actions.setLoading(true);
				props.actions.setError("");
				props.fetchDocs(workspace, parentId).then((result) => {
					if (result.ok) props.actions.setDocs(asArray$5(result.value));
					else props.actions.setError(result.error.message);
					props.actions.setLoading(false);
				});
			};
			const openWorkspace = (id) => {
				props.actions.setWorkspaceId(id);
				props.actions.setDocId("");
				setDocPreview(null);
				setDocCrumbs([]);
				fetchDocsAt(id);
			};
			/** Drill into a folder node (docs tab): push a crumb, load its children. */
			const openFolder = (id, title) => {
				props.actions.setDocId("");
				setDocPreview(null);
				setDocCrumbs((prev) => [...prev, {
					id,
					title
				}]);
				fetchDocsAt(state.workspaceId, id);
			};
			/** Jump the docs trail back to a crumb (index -1 = workspace root). */
			const jumpCrumb = (index) => {
				const next = index < 0 ? [] : docCrumbs.slice(0, index + 1);
				props.actions.setDocId("");
				setDocPreview(null);
				setDocCrumbs(next);
				const parent = next.length > 0 ? next[next.length - 1].id : void 0;
				fetchDocsAt(state.workspaceId, parent);
			};
			/** Right-pane doc preview: info + first blocks as text. */
			const loadDocPreview = (id) => {
				setDocPreview(null);
				Promise.all([props.fetchDoc(id), props.fetchDocBlocks(id)]).then(([infoResult, blocksResult]) => {
					const node = asRecord$7(infoResult.ok ? infoResult.value : {});
					const title = asString$5(node.title) === "" ? "文档" : asString$5(node.title);
					const meta = [
						asString$5(node.fileSuffix) === "dbt" ? "多维表格" : "在线文档",
						asString$5(node.updateTime).slice(0, 10) === "" ? "" : `更新 ${asString$5(node.updateTime).slice(0, 10)}`,
						asString$5(node.creatorName) === "" ? "" : `创建人 ${asString$5(node.creatorName)}`
					].filter((part) => part !== "").join(" · ");
					const lines = [];
					if (blocksResult.ok) {
						const blocksValue = asRecord$7(blocksResult.value);
						const blocks = asArray$5(asRecord$7(blocksValue.data).blocks ?? blocksValue.blocks);
						const walk = (node2) => {
							if (typeof node2 !== "object" || node2 === null) return;
							const record = node2;
							if (typeof record.type === "string" && typeof record.content === "string") {
								const text = record.content.trim();
								if (text !== "" && (record.type === "heading" || record.type === "paragraph" || record.type === "code" || record.type === "text" || record.type === "title")) {
									lines.push(text);
									return;
								}
							}
							const children = record.childNodes;
							if (Array.isArray(children) && children.length > 0) {
								for (const child of children) walk(child);
								return;
							}
							for (const [key, value] of Object.entries(record)) {
								if (key === "content") continue;
								if (Array.isArray(value)) for (const item of value) walk(item);
								else if (typeof value === "object" && value !== null) walk(value);
							}
							if (Array.isArray(record.content)) for (const item of record.content) walk(item);
						};
						for (const block of blocks) walk(block);
					}
					setDocPreview({
						title,
						meta,
						lines: lines.slice(0, 200)
					});
				}).catch(() => setDocPreview({
					title: "文档",
					meta: "",
					lines: []
				}));
			};
			const openDoc = (id) => {
				props.actions.setDocId(id);
				loadDocPreview(id);
			};
			/** Select an event; enrich with the full detail when needed. */
			const pickEvent = (event) => {
				const id = asString$5(event.id);
				props.actions.setCalEventId(id);
				const clock = (ms) => {
					if (typeof ms !== "number") return "";
					const date = new Date(ms);
					const pad = (n) => String(n).padStart(2, "0");
					return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
				};
				const start = clock(event.startDate);
				const end = clock(event.endDate);
				const base = {
					title: asString$5(event.title),
					time: start === "" ? "" : `${start}${end === "" ? "" : ` → ${end}`}`,
					person: asString$5(event.personName),
					place: asString$5(event.meetingPlace),
					content: asString$5(event.content)
				};
				if (base.content !== "") {
					setEventDetail(base);
					return;
				}
				props.fetchEvent(id).then((result) => {
					if (!result.ok) {
						setEventDetail(base);
						return;
					}
					const detail = asRecord$7(result.value);
					const ms = typeof detail.startDate === "number" ? detail.startDate : typeof event.startDate === "number" ? event.startDate : 0;
					const start2 = clock(ms);
					const endMs = typeof detail.endDate === "number" ? detail.endDate : typeof event.endDate === "number" ? event.endDate : 0;
					const end2 = clock(endMs);
					setEventDetail({
						title: asString$5(detail.title) === "" ? base.title : asString$5(detail.title),
						time: start2 === "" ? base.time : `${start2}${end2 === "" ? "" : ` → ${end2}`}`,
						person: asString$5(detail.personName) === "" ? base.person : asString$5(detail.personName),
						place: asString$5(detail.meetingPlace),
						content: asString$5(detail.content)
					});
				}).catch(() => setEventDetail(base));
			};
			const openGroup = (id) => {
				const gen = ++openGenRef.current;
				props.actions.setGroupId(id);
				props.actions.setAnchorMsgId("");
				setDraft("");
				setReplyTo(null);
				rememberImSeat({
					groupId: id,
					sessionId: "",
					...groupNameOf(state.groups, id) === "" ? {} : { groupName: groupNameOf(state.groups, id) }
				});
				setWorkbenchDomain("im");
				openWorkbench();
				const cached = getMessageWindow(id);
				if (cached !== void 0) {
					setMessagesFetching(false);
					props.actions.setMessages(cached.messages);
					props.actions.setMessagesMore(cached.more);
					props.actions.setMessagesAnchor(cached.messages.length > 0 ? asString$5(asRecord$7(cached.messages[0]).msgId) : "");
					return;
				}
				props.actions.setMessages([]);
				props.actions.setMessagesMore(false);
				props.actions.setMessagesAnchor("");
				props.actions.setError("");
				setMessagesFetching(true);
				props.fetchMessages(id, 20).then((result) => {
					if (gen !== openGenRef.current) return;
					if (result.ok) {
						const messages = asArray$5(asRecord$7(result.value).list);
						putMessageWindow(id, messages, asRecord$7(result.value).more === true);
						props.actions.setMessages(messages);
						props.actions.setMessagesMore(asRecord$7(result.value).more === true);
						props.actions.setMessagesAnchor(messages.length > 0 ? asString$5(asRecord$7(messages[0]).msgId) : "");
					} else props.actions.setError(result.error.message);
					setMessagesFetching(false);
				});
			};
			const openGroupRef = (0, react.useRef)(openGroup);
			openGroupRef.current = openGroup;
			(0, react.useEffect)(() => subscribeImGroupFocus((target) => {
				openGroupRef.current(target.groupId);
			}), []);
			const loadMoreGroups = () => {
				if (state.loading) return;
				props.actions.setLoading(true);
				props.fetchGroups(20, state.groupsPage + 1).then((result) => {
					if (result.ok) {
						props.actions.appendGroups(asArray$5(asRecord$7(result.value).list));
						props.actions.setGroupsPage(state.groupsPage + 1);
						props.actions.setGroupsMore(asRecord$7(result.value).more === true);
					} else props.actions.setError(result.error.message);
					props.actions.setLoading(false);
				});
			};
			const loadOlderMessages = () => {
				if (messagesFetching || state.messagesAnchor === "") return;
				const gen = openGenRef.current;
				chatScrollRef.current = {
					...chatScrollRef.current,
					loadOlder: loadOlderMessages
				};
				setMessagesFetching(true);
				props.fetchMessages(state.groupId, 20, {
					type: "old",
					msgId: state.messagesAnchor
				}).then((result) => {
					if (gen !== openGenRef.current) return;
					if (result.ok) {
						const older = asArray$5(asRecord$7(result.value).list);
						props.actions.prependMessages(older);
						putMessageWindow(state.groupId, [...older, ...state.messages], asRecord$7(result.value).more === true);
						props.actions.setMessagesMore(asRecord$7(result.value).more === true);
						if (older.length > 0) props.actions.setMessagesAnchor(asString$5(asRecord$7(older[0]).msgId));
						requestAnimationFrame(() => {
							const restore = scrollRestoreRef.current;
							scrollRestoreRef.current = null;
							const list = listRef.current;
							if (restore === null || list === null) return;
							const delta = list.scrollHeight - restore.height;
							if (delta > 0) list.scrollTop = restore.top + delta;
						});
					} else {
						props.actions.setError(result.error.message);
						scrollRestoreRef.current = null;
					}
					setMessagesFetching(false);
				});
			};
			chatScrollRef.current = {
				...chatScrollRef.current,
				loadOlder: loadOlderMessages
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				ref: panelRef,
				className: embedded ? `${panel_module_css_default.panel} ${panel_module_css_default.panelEmbedded}` : panel_module_css_default.panel,
				role: "dialog",
				"aria-label": "云之家",
				"data-testid": embedded ? "yzj-workbench-domain" : void 0,
				style: embedded ? void 0 : dockStyle,
				children: [
					!embedded && (0, react_jsx_runtime.jsxs)("header", {
						className: panel_module_css_default.header,
						onPointerDown: startDrag,
						children: [
							(0, react_jsx_runtime.jsx)("span", {
								className: panel_module_css_default.brand,
								children: (0, react_jsx_runtime.jsx)(YzjCloudIcon, { size: 18 })
							}),
							(0, react_jsx_runtime.jsx)("span", {
								className: panel_module_css_default.title,
								children: "云之家"
							}),
							(0, react_jsx_runtime.jsx)("span", { className: panel_module_css_default.headerSpacer }),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: panel_module_css_default.iconButton,
								onClick: () => {
									loadTab(activeTab, props);
								},
								disabled: state.loading,
								"aria-label": "刷新",
								title: "刷新",
								onPointerDown: (event) => {
									event.stopPropagation();
								},
								children: (0, react_jsx_runtime.jsx)(IconRefresh14, {})
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: panel_module_css_default.iconButton,
								onClick: () => {
									props.actions.setOpen(false);
								},
								"aria-label": "关闭",
								title: "关闭",
								onPointerDown: (event) => {
									event.stopPropagation();
								},
								children: (0, react_jsx_runtime.jsx)(IconClose14, {})
							})
						]
					}),
					!embedded && (0, react_jsx_runtime.jsx)("nav", {
						className: panel_module_css_default.tabs,
						"aria-label": "云之家功能",
						onPointerDown: (event) => {
							event.stopPropagation();
						},
						children: TABS.map((item) => (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: activeTab === item.key ? `${panel_module_css_default.tab} ${panel_module_css_default.tabActive}` : panel_module_css_default.tab,
							"aria-current": activeTab === item.key ? "page" : void 0,
							onClick: () => {
								props.actions.setTab(item.key);
							},
							children: [item.icon(), (0, react_jsx_runtime.jsx)("span", { children: item.label })]
						}, item.key))
					}),
					state.error !== "" && (0, react_jsx_runtime.jsxs)("div", {
						className: panel_module_css_default.error,
						role: "alert",
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: panel_module_css_default.errorText,
							children: state.error
						}), (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: panel_module_css_default.errorDismiss,
							onClick: () => {
								props.actions.setError("");
							},
							"aria-label": "忽略错误",
							children: (0, react_jsx_runtime.jsx)(IconClose14, {})
						})]
					}),
					state.loading && (0, react_jsx_runtime.jsx)("div", {
						className: panel_module_css_default.loading,
						"data-testid": "yzj-panel-loading",
						children: "加载中…"
					}),
					activeTab === "docs" && (0, react_jsx_runtime.jsx)("div", {
						className: panel_module_css_default.body,
						children: (0, react_jsx_runtime.jsxs)("div", {
							className: panel_module_css_default.twoPane,
							children: [(0, react_jsx_runtime.jsxs)("div", {
								className: panel_module_css_default.paneLeft,
								children: [(0, react_jsx_runtime.jsx)("div", {
									className: panel_module_css_default.docSearch,
									children: (0, react_jsx_runtime.jsx)("input", {
										className: panel_module_css_default.docSearchInput,
										value: docQuery,
										placeholder: "搜索文档标题/文件名…",
										"aria-label": "搜索文档",
										"data-testid": "yzj-panel-doc-search",
										onChange: (event) => {
											setDocQuery(event.target.value);
											if (event.target.value.trim() === "") setDocResults(null);
										},
										onKeyDown: (event) => {
											if (event.key === "Enter") runDocSearch();
										}
									})
								}), (0, react_jsx_runtime.jsx)("div", {
									className: panel_module_css_default.paneList,
									children: docResults !== null ? docSearching ? (0, react_jsx_runtime.jsx)("div", {
										className: panel_module_css_default.empty,
										children: "搜索中…"
									}) : docResults.length === 0 ? (0, react_jsx_runtime.jsxs)("div", {
										className: panel_module_css_default.empty,
										children: [(0, react_jsx_runtime.jsx)(YzjCloudIcon, { size: 28 }), (0, react_jsx_runtime.jsx)("span", { children: "没有命中文档" })]
									}) : docResults.map((node, index) => {
										const id = asString$5(node.id);
										const title = asString$5(node.title) || asString$5(node.fileName) || id;
										const updated = asString$5(node.updateTime).slice(0, 10);
										const kb = asString$5(node.kbName);
										return (0, react_jsx_runtime.jsxs)("button", {
											type: "button",
											className: panel_module_css_default.item,
											"data-testid": `yzj-panel-doc-hit-${id}`,
											onClick: () => {
												openDoc(id);
											},
											children: [(0, react_jsx_runtime.jsxs)("span", {
												className: panel_module_css_default.itemTitle,
												children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenOutline16, {}), (0, react_jsx_runtime.jsx)("span", {
													className: panel_module_css_default.itemTitleText,
													children: title
												})]
											}), (0, react_jsx_runtime.jsxs)("span", {
												className: panel_module_css_default.itemSub,
												children: [kb === "" ? "" : `${kb} · `, updated === "" ? "文档" : `更新 ${updated}`]
											})]
										}, `s${index}`);
									}) : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [state.workspaces.length === 0 && !state.loading && state.error === "" && (0, react_jsx_runtime.jsxs)("div", {
										className: panel_module_css_default.empty,
										children: [(0, react_jsx_runtime.jsx)(YzjCloudIcon, { size: 28 }), (0, react_jsx_runtime.jsx)("span", { children: "暂无知识库" })]
									}), (() => {
										const rows = state.workspaces.map(asRecord$7);
										const personal = rows.filter((ws) => ws.visibility === 2);
										const enterprise = rows.filter((ws) => ws.visibility !== 2);
										const renderWs = (ws, index) => {
											const count = typeof ws.docCount === "number" ? ws.docCount : 0;
											const members = typeof ws.memberCount === "number" ? ws.memberCount : 0;
											const id = asString$5(ws.id);
											const name = asString$5(ws.name);
											const active = id === state.workspaceId;
											return (0, react_jsx_runtime.jsxs)("button", {
												type: "button",
												className: active ? `${panel_module_css_default.item} ${panel_module_css_default.itemActive}` : panel_module_css_default.item,
												onClick: () => {
													openWorkspace(id);
												},
												children: [(0, react_jsx_runtime.jsxs)("span", {
													className: panel_module_css_default.itemTitle,
													children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenOutline16, {}), (0, react_jsx_runtime.jsx)("span", {
														className: panel_module_css_default.itemTitleText,
														children: name
													})]
												}), (0, react_jsx_runtime.jsxs)("span", {
													className: panel_module_css_default.itemSub,
													children: [
														"文档 ",
														count,
														" · 成员 ",
														members
													]
												})]
											}, `w${index}`);
										};
										return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [personal.length > 0 && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("div", {
											className: panel_module_css_default.paneGroupLabel,
											"data-testid": "yzj-panel-ws-group-personal",
											children: "个人"
										}), personal.map(renderWs)] }), enterprise.length > 0 && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("div", {
											className: panel_module_css_default.paneGroupLabel,
											"data-testid": "yzj-panel-ws-group-enterprise",
											children: "企业 / 团队"
										}), enterprise.map(renderWs)] })] });
									})()] })
								})]
							}), (0, react_jsx_runtime.jsx)("div", {
								className: panel_module_css_default.paneRight,
								children: state.docId !== "" ? docPreview === null ? (0, react_jsx_runtime.jsx)("div", {
									className: panel_module_css_default.paneEmpty,
									children: "加载中…"
								}) : (0, react_jsx_runtime.jsxs)("div", {
									className: panel_module_css_default.paneList,
									children: [
										(0, react_jsx_runtime.jsxs)("div", {
											className: panel_module_css_default.paneHead,
											children: [(0, react_jsx_runtime.jsxs)("button", {
												type: "button",
												className: panel_module_css_default.back,
												onClick: () => {
													props.actions.setDocId("");
												},
												children: [(0, react_jsx_runtime.jsx)(IconChevronLeft14, {}), " 返回文档"]
											}), (0, react_jsx_runtime.jsx)("span", {
												className: panel_module_css_default.paneTitle,
												children: docPreview.title
											})]
										}),
										docPreview.meta !== "" && (0, react_jsx_runtime.jsx)("div", {
											className: panel_module_css_default.docMeta,
											children: docPreview.meta
										}),
										(0, react_jsx_runtime.jsx)("div", {
											className: panel_module_css_default.docBody,
											children: docPreview.lines.length === 0 ? "（无文本内容，可拖拽引用或在新标签打开）" : docPreview.lines.map((line, i) => (0, react_jsx_runtime.jsx)("div", { children: line }, i))
										})
									]
								}) : state.workspaceId === "" ? (0, react_jsx_runtime.jsxs)("div", {
									className: panel_module_css_default.paneEmpty,
									children: [(0, react_jsx_runtime.jsx)(YzjCloudIcon, { size: 28 }), (0, react_jsx_runtime.jsx)("span", { children: "选择左侧知识库查看文档" })]
								}) : (0, react_jsx_runtime.jsxs)("div", {
									className: panel_module_css_default.paneList,
									children: [
										(0, react_jsx_runtime.jsx)("div", {
											className: panel_module_css_default.paneHead,
											children: docCrumbs.length === 0 ? (0, react_jsx_runtime.jsx)("span", {
												className: panel_module_css_default.paneTitle,
												children: asString$5(state.workspaces.map(asRecord$7).find((ws) => asString$5(ws.id) === state.workspaceId)?.name ?? "知识库")
											}) : (0, react_jsx_runtime.jsxs)("nav", {
												className: panel_module_css_default.crumbs,
												"aria-label": "文档位置",
												children: [(0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: panel_module_css_default.crumbLink,
													onClick: () => {
														jumpCrumb(-1);
													},
													children: asString$5(state.workspaces.map(asRecord$7).find((ws) => asString$5(ws.id) === state.workspaceId)?.name ?? "知识库")
												}), docCrumbs.map((crumb, index) => (0, react_jsx_runtime.jsxs)("span", {
													className: panel_module_css_default.crumbItem,
													children: [(0, react_jsx_runtime.jsx)("span", {
														className: panel_module_css_default.crumbSep,
														"aria-hidden": "true",
														children: "/"
													}), index === docCrumbs.length - 1 ? (0, react_jsx_runtime.jsx)("span", {
														className: panel_module_css_default.crumbCurrent,
														children: crumb.title
													}) : (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: panel_module_css_default.crumbLink,
														onClick: () => {
															jumpCrumb(index);
														},
														children: crumb.title
													})]
												}, crumb.id))]
											})
										}),
										state.docs.length === 0 && !state.loading && state.error === "" && (0, react_jsx_runtime.jsx)("div", {
											className: panel_module_css_default.empty,
											children: "暂无文档"
										}),
										state.docs.map((item, index) => {
											const node = asRecord$7(item);
											const suffix = asString$5(node.fileSuffix);
											const title = asString$5(node.title);
											const id = asString$5(node.id);
											const hasChildren = node.hasChildren === true || typeof node.childrenCount === "number" && node.childrenCount > 0;
											return (0, react_jsx_runtime.jsxs)("div", {
												className: panel_module_css_default.docRowWrap,
												children: [(0, react_jsx_runtime.jsxs)("button", {
													type: "button",
													className: panel_module_css_default.item,
													onClick: () => {
														openDoc(id);
													},
													children: [(0, react_jsx_runtime.jsxs)("span", {
														className: panel_module_css_default.itemTitle,
														children: [(0, react_jsx_runtime.jsx)("span", {
															className: panel_module_css_default.docGlyph,
															children: suffix === "dbt" ? "表" : "文"
														}), (0, react_jsx_runtime.jsx)("span", {
															className: panel_module_css_default.itemTitleText,
															children: title
														})]
													}), (0, react_jsx_runtime.jsxs)("span", {
														className: panel_module_css_default.itemSub,
														children: [
															suffix === "dbt" ? "多维表格" : "在线文档",
															" · ",
															asString$5(node.updateTime).slice(0, 10),
															hasChildren && typeof node.childrenCount === "number" ? ` · ${node.childrenCount} 个子项` : ""
														]
													})]
												}), hasChildren && (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: panel_module_css_default.drill,
													title: `打开「${title}」`,
													"aria-label": `打开文件夹 ${title}`,
													onClick: () => {
														openFolder(id, title);
													},
													children: (0, react_jsx_runtime.jsx)("svg", {
														width: "14",
														height: "14",
														viewBox: "0 0 24 24",
														fill: "none",
														"aria-hidden": "true",
														children: (0, react_jsx_runtime.jsx)("path", {
															d: "M9 5l7 7-7 7",
															stroke: "currentColor",
															strokeWidth: "2",
															strokeLinecap: "round",
															strokeLinejoin: "round"
														})
													})
												})]
											}, `d${index}`);
										})
									]
								})
							})]
						})
					}),
					activeTab === "calendar" && (0, react_jsx_runtime.jsx)("div", {
						className: panel_module_css_default.body,
						children: (0, react_jsx_runtime.jsx)(CalendarPane, {
							year: state.calYear,
							month: state.calMonth,
							day: state.calDay,
							events: state.calEvents,
							eventId: state.calEventId,
							eventDetail,
							onNavigate: (year, month, day) => {
								props.actions.setCalCursor(year, month);
								props.actions.setCalDay(day);
								props.actions.setCalEventId("");
								setEventDetail(null);
								if (year === state.calYear && month === state.calMonth) return;
								const pad = (n) => String(n).padStart(2, "0");
								const start = `${year}-${pad(month)}-01`;
								const end = `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`;
								props.actions.setLoading(true);
								props.actions.setError("");
								props.fetchEvents(start, end).then((result) => {
									if (result.ok) props.actions.setCalEvents(asArray$5(result.value));
									else props.actions.setError(result.error.message);
									props.actions.setLoading(false);
								});
							},
							onSelectEvent: pickEvent
						})
					}),
					activeTab === "chat" && (0, react_jsx_runtime.jsx)("div", {
						className: panel_module_css_default.body,
						children: (0, react_jsx_runtime.jsxs)("div", {
							className: panel_module_css_default.twoPane,
							children: [(0, react_jsx_runtime.jsxs)("div", {
								className: panel_module_css_default.paneLeft,
								children: [(0, react_jsx_runtime.jsxs)("div", {
									className: panel_module_css_default.readAllRow,
									children: [(0, react_jsx_runtime.jsx)("span", {
										className: panel_module_css_default.readAllHint,
										children: state.unreadTotal > 0 ? `共 ${state.unreadTotal > 99 ? "99+" : state.unreadTotal} 条未读` : "没有未读消息"
									}), (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: panel_module_css_default.readAll,
										disabled: state.unreadTotal === 0,
										onClick: () => {
											markAllRead(state.groups);
											props.actions.setGroups(state.groups.map((item) => ({
												...asRecord$7(item),
												unreadCount: 0
											})));
											props.actions.setUnreadTotal(0);
										},
										children: "全部已读"
									})]
								}), (0, react_jsx_runtime.jsxs)("div", {
									className: panel_module_css_default.paneList,
									children: [
										state.groups.length === 0 && !state.loading && state.error === "" && (0, react_jsx_runtime.jsxs)("div", {
											className: panel_module_css_default.empty,
											children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconNewChatOutline16, {}), (0, react_jsx_runtime.jsx)("span", { children: "暂无最近会话" })]
										}),
										state.groups.map((item, index) => {
											const group = asRecord$7(item);
											const unread = effectiveUnread(asString$5(group.groupId), typeof group.unreadCount === "number" ? group.unreadCount : 0);
											const name = asString$5(group.groupName);
											const lastTime = formatListTime(group.lastMsgSendTime);
											const preview = messagePreview(asRecord$7(group.lastMsg));
											const active = asString$5(group.groupId) === state.groupId;
											return (0, react_jsx_runtime.jsxs)("button", {
												type: "button",
												className: active ? `${panel_module_css_default.item} ${panel_module_css_default.itemActive}` : panel_module_css_default.item,
												onClick: () => {
													openGroup(asString$5(group.groupId));
												},
												children: [(0, react_jsx_runtime.jsxs)("span", {
													className: panel_module_css_default.itemTitle,
													children: [
														(0, react_jsx_runtime.jsx)(GroupAvatar, {
															url: asString$5(group.headerUrl),
															name
														}),
														(0, react_jsx_runtime.jsx)("span", {
															className: panel_module_css_default.itemTitleText,
															children: name
														}),
														lastTime !== "" && (0, react_jsx_runtime.jsx)("span", {
															className: panel_module_css_default.itemTime,
															children: lastTime
														}),
														unread > 0 && (0, react_jsx_runtime.jsx)("span", {
															className: panel_module_css_default.badge,
															children: unread > 99 ? "99+" : unread
														})
													]
												}), (0, react_jsx_runtime.jsx)("span", {
													className: panel_module_css_default.itemSub,
													children: preview
												})]
											}, `g${index}`);
										}),
										state.groupsMore && (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: panel_module_css_default.more,
											onClick: loadMoreGroups,
											disabled: state.loading,
											children: state.loading ? "加载中…" : "加载更多会话"
										})
									]
								})]
							}), (0, react_jsx_runtime.jsx)("div", {
								className: panel_module_css_default.paneRight,
								children: state.groupId === "" ? (0, react_jsx_runtime.jsxs)("div", {
									className: panel_module_css_default.paneEmpty,
									children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconNewChatOutline16, {}), (0, react_jsx_runtime.jsx)("span", { children: "选择左侧会话查看消息" })]
								}) : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
									(0, react_jsx_runtime.jsx)("div", {
										className: panel_module_css_default.chatHeader,
										children: (0, react_jsx_runtime.jsx)(GroupHead, {
											groups: state.groups,
											groupId: state.groupId
										})
									}),
									(0, react_jsx_runtime.jsx)("div", {
										className: panel_module_css_default.panelBanner,
										role: "note",
										children: "点群打开 DSH 群聊。悬浮窗不再发消息。"
									}),
									anchorActive && (0, react_jsx_runtime.jsx)("div", {
										className: panel_module_css_default.anchorHint,
										role: "status",
										children: "已定位到锚点消息（来自「查看上下文」）"
									}),
									(0, react_jsx_runtime.jsxs)("div", {
										className: panel_module_css_default.list,
										ref: listRef,
										children: [
											messagesFetching && state.messages.length === 0 && (0, react_jsx_runtime.jsx)("div", {
												className: panel_module_css_default.empty,
												"data-testid": "yzj-chat-loading",
												children: "加载中…"
											}),
											state.messages.length === 0 && !messagesFetching && state.error === "" && (0, react_jsx_runtime.jsx)("div", {
												className: panel_module_css_default.empty,
												children: "暂无消息"
											}),
											state.messagesMore && (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: panel_module_css_default.more,
												onClick: loadOlderMessages,
												disabled: messagesFetching,
												children: messagesFetching ? "加载中…" : "加载更早消息"
											}),
											state.messages.map((item, index) => {
												const message = asRecord$7(item);
												const msgType = asString$5(message.msgType);
												const sendTime = formatMsgTime(message.sendTime);
												const msgId = asString$5(message.msgId);
												const fromOpenId = asString$5(message.fromOpenId);
												const mine = myProfile.openId !== "" && fromOpenId === myProfile.openId;
												const sender = fromOpenId === "" ? "" : senderNames[fromOpenId] ?? "";
												const anchored = msgId !== "" && msgId === state.anchorMsgId;
												const dayKey = String(message.sendTime).slice(0, 10);
												const prevDay = index > 0 ? String(asRecord$7(state.messages[index - 1]).sendTime).slice(0, 10) : "";
												const dayLabel = dayKey === "" ? "" : formatListTime(`${dayKey} 00:00:00`);
												const isSystem = msgType === "other" || asString$5(asRecord$7(message.param).sysType) === "withdrawMsg";
												return (0, react_jsx_runtime.jsxs)("div", { children: [dayKey !== "" && dayKey !== prevDay && (0, react_jsx_runtime.jsx)("div", {
													className: panel_module_css_default.dayDivider,
													children: dayLabel
												}), (0, react_jsx_runtime.jsxs)("div", {
													ref: anchored ? anchorRef : void 0,
													className: [
														panel_module_css_default.msgRow,
														isSystem ? panel_module_css_default.msgRowSystem : "",
														anchored ? panel_module_css_default.itemAnchored : ""
													].filter(Boolean).join(" "),
													children: [!isSystem && (0, react_jsx_runtime.jsx)(SenderAvatar, {
														openId: fromOpenId,
														fallback: sender === "" ? typeLabelOf(msgType) : sender
													}), (0, react_jsx_runtime.jsxs)("span", {
														className: panel_module_css_default.msgStack,
														children: [
															!isSystem && (0, react_jsx_runtime.jsxs)("span", {
																className: panel_module_css_default.msgMetaLine,
																children: [
																	(0, react_jsx_runtime.jsxs)("span", {
																		className: panel_module_css_default.msgSender,
																		children: [sender === "" ? typeLabelOf(msgType) : sender, mine ? "（我）" : ""]
																	}),
																	(0, react_jsx_runtime.jsx)("span", {
																		className: panel_module_css_default.msgTime,
																		children: sendTime
																	}),
																	anchored && (0, react_jsx_runtime.jsx)("span", {
																		className: panel_module_css_default.anchorTag,
																		children: "锚点"
																	})
																]
															}),
															(0, react_jsx_runtime.jsx)("span", {
																className: panel_module_css_default.msgContent,
																children: (0, react_jsx_runtime.jsx)(MessageBody, {
																	message,
																	onOpenImage: (src) => setLightbox({
																		src,
																		kind: "image"
																	}),
																	onOpenPdf: (src) => setLightbox({
																		src,
																		kind: "pdf"
																	}),
																	inject: props
																})
															}),
															!isSystem && (0, react_jsx_runtime.jsx)("button", {
																type: "button",
																className: panel_module_css_default.msgReply,
																title: "回复此消息",
																"aria-label": "回复",
																onClick: () => {
																	setReplyTo({
																		msgId,
																		summary: dragTitleOf(message)
																	});
																	draftRef.current?.focus();
																},
																children: "回复"
															})
														]
													})]
												})] }, `m${index}`);
											}),
											anchorToast !== "" && (0, react_jsx_runtime.jsx)("div", {
												className: panel_module_css_default.panelToast,
												role: "status",
												children: anchorToast
											})
										]
									}),
									(0, react_jsx_runtime.jsx)("div", {
										className: panel_module_css_default.composer,
										children: (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: panel_module_css_default.composerSend,
											"data-testid": "yzj-open-group-room",
											onClick: () => {
												rememberImSeat({
													groupId: state.groupId,
													sessionId: "",
													...groupNameOf(state.groups, state.groupId) === "" ? {} : { groupName: groupNameOf(state.groups, state.groupId) }
												});
												setWorkbenchDomain("im");
												openWorkbench();
											},
											children: "打开群聊"
										})
									})
								] })
							})]
						})
					}),
					activeTab === "todo" && (0, react_jsx_runtime.jsx)(TodoPane, {
						todos: state.todos,
						ready: state.todoReady,
						libraryLink: state.todoLink,
						tagFilter: state.todoTag,
						loading: state.loading,
						activeDocId: state.todoActiveDocId,
						libraries: state.todoLibraries,
						libName: state.todoLibName,
						libScope: state.todoLibScope,
						actions: props.actions,
						todoState: props.todoState,
						ensureTodo: props.ensureTodo,
						createTodo: props.createTodo,
						toggleTodo: props.toggleTodo,
						todoLibraries: props.todoLibraries,
						selectTodoLibrary: props.selectTodoLibrary,
						ensureTeamTodo: props.ensureTeamTodo
					}),
					lightbox !== null && (0, react_jsx_runtime.jsx)(ImLightbox, {
						src: lightbox.src,
						kind: lightbox.kind,
						onClose: () => setLightbox(null)
					})
				]
			});
		}
		function IconRefresh14() {
			return (0, react_jsx_runtime.jsxs)("svg", {
				width: "14",
				height: "14",
				viewBox: "0 0 24 24",
				fill: "none",
				"aria-hidden": "true",
				children: [(0, react_jsx_runtime.jsx)("path", {
					d: "M20 12a8 8 0 1 1-2.34-5.66",
					stroke: "currentColor",
					strokeWidth: "2",
					strokeLinecap: "round"
				}), (0, react_jsx_runtime.jsx)("path", {
					d: "M20 3v4h-4",
					stroke: "currentColor",
					strokeWidth: "2",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})]
			});
		}
		function IconClose14() {
			return (0, react_jsx_runtime.jsx)("svg", {
				width: "14",
				height: "14",
				viewBox: "0 0 24 24",
				fill: "none",
				"aria-hidden": "true",
				children: (0, react_jsx_runtime.jsx)("path", {
					d: "M6 6l12 12M18 6L6 18",
					stroke: "currentColor",
					strokeWidth: "2",
					strokeLinecap: "round"
				})
			});
		}
		function IconChevronLeft14() {
			return (0, react_jsx_runtime.jsx)("svg", {
				width: "14",
				height: "14",
				viewBox: "0 0 24 24",
				fill: "none",
				"aria-hidden": "true",
				children: (0, react_jsx_runtime.jsx)("path", {
					d: "M14.5 5.5L8 12l6.5 6.5",
					stroke: "currentColor",
					strokeWidth: "2",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})
			});
		}
		//#endregion
		//#region lib/types/client/workbench-pane.js
		const TAB = {
			todo: "todo",
			calendar: "calendar",
			docs: "docs"
		};
		/**
		* Right-of-list workbench content for a non-IM domain.
		*/
		function YzjDomainWorkbench(props) {
			return (0, react_jsx_runtime.jsx)(YzjPanel, {
				...props.panel,
				useStore: props.useStore,
				actions: props.actions,
				embedded: true,
				forceTab: TAB[props.domain]
			});
		}
		//#endregion
		//#region \0dsh-css:/Users/guoxinshan/dev/dsh-yzj/packages/ui-yzj/src/client/advance-pane.module.css.mjs
		const css$2 = ".Y6ZzqW_body{flex:1;gap:16px;min-height:0;padding:16px 20px 20px;display:flex;overflow:hidden}.Y6ZzqW_queue{flex-direction:column;flex:0 0 260px;gap:10px;min-height:0;padding-right:4px;display:flex;overflow-y:auto}.Y6ZzqW_queueHead{flex-direction:column;gap:2px;display:flex}.Y6ZzqW_queueHead b{color:var(--dsw-alias-label-primary);font-size:14px}.Y6ZzqW_queueHead span{color:var(--dsw-alias-label-tertiary);font-size:11px}.Y6ZzqW_queueGroup{flex-direction:column;gap:6px;display:flex}.Y6ZzqW_queueLabel{color:var(--dsw-alias-label-secondary);justify-content:space-between;align-items:center;font-size:11px;display:flex}.Y6ZzqW_queueCount{text-align:center;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);min-width:18px;color:var(--dsw-alias-label-tertiary);border-radius:999px;padding:1px 5px;font-size:10px}.Y6ZzqW_queueItem{text-align:left;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);cursor:pointer;border-radius:12px;flex-direction:column;gap:4px;padding:10px 12px;transition:border-color .15s,background .15s;display:flex}.Y6ZzqW_queueItem:hover{border-color:var(--dsw-static-deepseek-500)}.Y6ZzqW_queueItemOn{border-color:var(--dsw-static-deepseek-500);background:var(--dsw-static-deepseek-100)}.Y6ZzqW_queueTitle{align-items:center;gap:6px;min-width:0;display:flex}.Y6ZzqW_queueTitle b{color:var(--dsw-alias-label-primary);text-overflow:ellipsis;white-space:nowrap;font-size:12.5px;overflow:hidden}.Y6ZzqW_queueItem p{color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;margin:0;font-size:11px;overflow:hidden}.Y6ZzqW_queueEmpty{border:1px dashed var(--dsw-alias-border-l2);border-radius:10px;padding:8px 10px}.Y6ZzqW_queueEmpty b{color:var(--dsw-alias-label-secondary);font-size:12px}.Y6ZzqW_queueEmpty p{color:var(--dsw-alias-label-tertiary);margin:2px 0 0;font-size:11px}.Y6ZzqW_dot{background:var(--dsw-alias-border-l2);border-radius:50%;flex:0 0 8px;width:8px;height:8px}.Y6ZzqW_dot_red{background:#e5484d}.Y6ZzqW_dot_blue{background:var(--dsw-static-deepseek-500)}.Y6ZzqW_dot_green{background:#2f9e44}.Y6ZzqW_dot_gray{background:var(--dsw-alias-border-l2)}.Y6ZzqW_detail{flex-direction:column;flex:1;gap:16px;min-width:0;min-height:0;display:flex;overflow-y:auto}.Y6ZzqW_detailHead{flex-direction:column;gap:4px;display:flex}.Y6ZzqW_kicker{color:var(--dsw-alias-label-tertiary);align-items:center;gap:8px;font-size:11px;display:flex}.Y6ZzqW_kickerActions{gap:6px;margin-left:auto;display:flex}.Y6ZzqW_feedbackBtn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:8px;padding:4px 10px;font-size:12px;font-weight:600}.Y6ZzqW_feedbackBtn:hover{background:var(--dsw-alias-interactive-bg-hover)}.Y6ZzqW_stagePill{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);border-radius:999px;align-items:center;padding:2px 8px;font-size:11px;display:inline-flex}.Y6ZzqW_pill_red{color:#e5484d;border-color:#e5484d}.Y6ZzqW_pill_green{color:#2f9e44;border-color:#2f9e44}.Y6ZzqW_pill_blue{border-color:var(--dsw-static-deepseek-500);color:var(--dsw-static-deepseek-500)}.Y6ZzqW_pill_gray{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-tertiary)}.Y6ZzqW_detailHead h1{color:var(--dsw-alias-label-primary);margin:0;font-size:19px;font-weight:650;line-height:1.35}.Y6ZzqW_meta{color:var(--dsw-alias-label-tertiary);flex-wrap:wrap;gap:10px;font-size:11.5px;display:flex}.Y6ZzqW_meta a{color:var(--dsw-static-deepseek-500);text-decoration:none}.Y6ZzqW_metrics{flex-wrap:wrap;gap:12px;display:flex}.Y6ZzqW_metric{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:12px;flex-direction:column;flex:140px;gap:4px;min-width:140px;padding:12px 14px;display:flex}.Y6ZzqW_metric span{color:var(--dsw-alias-label-tertiary);font-size:11.5px}.Y6ZzqW_metric b{color:var(--dsw-alias-label-primary);font-size:22px;font-weight:650}.Y6ZzqW_metric small{color:var(--dsw-alias-label-tertiary);font-size:11px}.Y6ZzqW_detailGrid{align-items:flex-start;gap:16px;display:flex}.Y6ZzqW_main{flex-direction:column;flex:1;gap:16px;min-width:0;display:flex}.Y6ZzqW_side{flex-direction:column;flex:0 0 280px;gap:16px;min-width:0;display:flex}.Y6ZzqW_section{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:14px;flex-direction:column;gap:10px;padding:14px 16px;display:flex}.Y6ZzqW_sectionHead{justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:2px;display:flex}.Y6ZzqW_sectionHead h2{color:var(--dsw-alias-label-primary);margin:0;font-size:14px;font-weight:650}.Y6ZzqW_sectionHead small{color:var(--dsw-alias-label-tertiary);font-size:11px}.Y6ZzqW_goal{color:var(--dsw-alias-label-primary);margin:0;font-size:13.5px;line-height:1.65}.Y6ZzqW_background{color:var(--dsw-alias-label-secondary);margin:0;font-size:12px;line-height:1.6}.Y6ZzqW_quiet{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px}.Y6ZzqW_decision{flex-direction:column;gap:6px;display:flex}.Y6ZzqW_decision h3{color:var(--dsw-alias-label-primary);margin:0;font-size:13px}.Y6ZzqW_decision p{color:var(--dsw-alias-label-secondary);white-space:pre-wrap;margin:0;font-size:12px}.Y6ZzqW_verbs{flex-wrap:wrap;gap:8px;display:flex}.Y6ZzqW_verbs button{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:999px;padding:6px 12px;font-size:12px}.Y6ZzqW_verbs button:disabled{opacity:.6;cursor:default}.Y6ZzqW_verbsSecondary{margin-top:2px}.Y6ZzqW_verbsSecondary button{color:var(--dsw-alias-label-secondary);padding:4px 10px;font-size:11px}.Y6ZzqW_options{flex-direction:column;gap:6px;display:flex}.Y6ZzqW_optionBtn{text-align:left;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:10px;padding:7px 10px;font-size:12px;line-height:1.4;transition:border-color .15s,background .15s}.Y6ZzqW_optionBtn:hover{border-color:var(--dsw-static-deepseek-500);background:var(--dsw-static-deepseek-100)}.Y6ZzqW_optionBtn:disabled{opacity:.6;cursor:default}.Y6ZzqW_impact{color:#e8a33d;margin:0;font-size:11.5px}.Y6ZzqW_actions{flex-direction:column;gap:6px;display:flex}.Y6ZzqW_actionRow{flex-direction:column;align-items:stretch;gap:6px;display:flex}.Y6ZzqW_imDraft{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);border-radius:10px;flex-direction:column;gap:6px;padding:8px 10px;display:flex}.Y6ZzqW_imDraft textarea{resize:vertical;min-height:48px;color:var(--dsw-alias-label-primary);background:0 0;border:none;outline:none;font-family:inherit;font-size:12.5px;line-height:1.5}.Y6ZzqW_imDraftFoot{align-items:center;gap:10px;display:flex}.Y6ZzqW_linkBtn{color:var(--dsw-static-deepseek-500);cursor:pointer;background:0 0;border:none;padding:0;font-size:11.5px}.Y6ZzqW_linkBtn:disabled{opacity:.6;cursor:default}.Y6ZzqW_subSources{flex-direction:column;gap:6px;display:flex}.Y6ZzqW_subChip{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);border-radius:999px;align-items:center;gap:6px;min-width:0;padding:3px 6px 3px 4px;display:flex}.Y6ZzqW_subIcon{background:var(--dsw-static-deepseek-100);width:18px;height:18px;color:var(--dsw-static-deepseek-500);border-radius:50%;flex:0 0 18px;justify-content:center;align-items:center;font-size:10px;font-style:normal;display:inline-flex}.Y6ZzqW_subChip b{min-width:0;color:var(--dsw-alias-label-primary);text-overflow:ellipsis;white-space:nowrap;flex:1;font-size:11.5px;overflow:hidden}.Y6ZzqW_subChip em{color:var(--dsw-alias-label-tertiary);flex:none;font-size:10px;font-style:normal}.Y6ZzqW_subChip button{color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;border-radius:999px;flex:none;padding:2px 4px;font-size:12px;line-height:1}.Y6ZzqW_subChip button:hover{color:#e5484d;background:var(--dsw-alias-interactive-bg-hover)}.Y6ZzqW_subGroupList{flex-wrap:wrap;gap:6px;max-height:160px;display:flex;overflow-y:auto}.Y6ZzqW_subGroupList button{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:999px;padding:4px 10px;font-size:11.5px}.Y6ZzqW_subGroupList button:hover{border-color:var(--dsw-static-deepseek-500)}.Y6ZzqW_subGroupList button:disabled{opacity:.6;cursor:default}.Y6ZzqW_sourceCiting{color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;max-width:100%;font-size:10.5px;line-height:1.5;display:block;overflow:hidden}.Y6ZzqW_entryDetail{color:var(--dsw-alias-label-secondary);white-space:pre-wrap;word-break:break-word;margin:2px 0 4px;font-size:12px;line-height:1.6}.Y6ZzqW_refEvent{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);cursor:pointer;text-align:left;border-radius:10px;flex-direction:column;align-items:flex-start;gap:2px;width:100%;max-width:560px;padding:6px 10px;font-size:11.5px;text-decoration:none;display:flex}.Y6ZzqW_refEvent:hover{border-color:var(--dsw-static-deepseek-500);text-decoration:none}.Y6ZzqW_refEventMeta{color:var(--dsw-alias-label-tertiary);font-size:10.5px}.Y6ZzqW_refEventBody{color:var(--dsw-alias-label-primary);text-overflow:ellipsis;white-space:nowrap;max-width:100%;overflow:hidden}.Y6ZzqW_dreamPoolList{flex-direction:column;gap:8px;max-height:320px;display:flex;overflow-y:auto}.Y6ZzqW_dreamPoolRow{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:10px;flex-direction:column;gap:2px;padding:8px 10px;font-size:12px;display:flex}.Y6ZzqW_dreamPoolMeta{color:var(--dsw-alias-label-tertiary);word-break:break-all;font-size:10.5px}.Y6ZzqW_timeline{flex-direction:column;gap:18px;display:flex}.Y6ZzqW_timeItem{align-items:flex-start;gap:10px;display:flex;position:relative}.Y6ZzqW_time{color:var(--dsw-alias-label-tertiary);white-space:nowrap;flex:0 0 76px;padding-top:2px;font-size:10.5px}.Y6ZzqW_mark{border-radius:50%;flex:0 0 8px;width:8px;height:8px;margin-top:4px;position:relative}.Y6ZzqW_mark_blue{background:var(--dsw-static-deepseek-500)}.Y6ZzqW_mark_green{background:#2f9e44}.Y6ZzqW_mark_red{background:#e5484d}.Y6ZzqW_timeItem:not(:last-child):before{content:\"\";background:var(--dsw-alias-border-l2);width:1.5px;position:absolute;top:14px;bottom:-18px;left:89.25px}.Y6ZzqW_timeCopy{flex-direction:column;flex:1;gap:5px;min-width:0;display:flex}.Y6ZzqW_timeCopy b{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600;line-height:1.5}.Y6ZzqW_entryHead{width:100%;min-width:0;font:inherit;text-align:left;cursor:pointer;background:0 0;border:none;align-items:baseline;gap:6px;padding:0;display:flex}.Y6ZzqW_entryHead b{-webkit-line-clamp:2;-webkit-box-orient:vertical;display:-webkit-box;overflow:hidden}.Y6ZzqW_entryCaret{color:var(--dsw-alias-label-tertiary);flex:none;margin-left:auto;font-size:10.5px}.Y6ZzqW_entryHead:hover .Y6ZzqW_entryCaret{color:var(--dsw-alias-label-primary)}.Y6ZzqW_changeType{color:var(--dsw-alias-label-tertiary);flex:none;font-size:11px;font-weight:600;line-height:1.5}.Y6ZzqW_changeType_blue{color:var(--dsw-static-deepseek-500)}.Y6ZzqW_changeType_red{color:#e5484d}.Y6ZzqW_changeType_green{color:#2f9e44}.Y6ZzqW_refsHead{color:var(--dsw-alias-label-tertiary);justify-content:space-between;align-items:center;gap:8px;margin-top:4px;font-size:11px;display:flex}.Y6ZzqW_timeCopy p{color:var(--dsw-alias-label-secondary);white-space:pre-wrap;margin:0;font-size:12px;line-height:1.6}.Y6ZzqW_timeMeta{color:var(--dsw-alias-label-tertiary);flex-wrap:wrap;align-items:center;gap:8px;font-size:10.5px;display:flex}.Y6ZzqW_dreamLine{color:var(--dsw-alias-label-tertiary);flex-direction:column;align-items:flex-start;gap:4px;margin-top:2px;font-size:11px;line-height:1.5;display:flex}.Y6ZzqW_dreamActions{align-items:center;gap:6px;display:flex}.Y6ZzqW_refs{flex-direction:column;align-items:stretch;gap:6px;display:flex}.Y6ZzqW_refChip{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:999px;align-self:flex-start;align-items:center;padding:0 10px;font-family:inherit;font-size:10.5px;line-height:20px;text-decoration:none;display:inline-flex}.Y6ZzqW_refChip:hover{border-color:var(--dsw-static-deepseek-500);color:var(--dsw-static-deepseek-500)}.Y6ZzqW_patrolBtn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:999px;align-self:flex-start;margin-top:4px;padding:2px 10px;font-size:11px}.Y6ZzqW_patrolBtn:hover{color:var(--dsw-static-deepseek-500);border-color:var(--dsw-static-deepseek-500)}.Y6ZzqW_closedZone{border-top:1px dashed var(--dsw-alias-border-l2);flex-direction:column;gap:4px;margin-top:4px;padding-top:8px;display:flex}.Y6ZzqW_closedToggle{color:var(--dsw-alias-label-tertiary);cursor:pointer;text-align:left;background:0 0;border:none;padding:2px 0;font-size:11.5px}.Y6ZzqW_closedToggle:hover{color:var(--dsw-alias-label-primary)}.Y6ZzqW_closedZone .Y6ZzqW_queueItem b{color:var(--dsw-alias-label-secondary);font-weight:500}.Y6ZzqW_jump{color:var(--dsw-static-deepseek-500);cursor:pointer;background:0 0;border:none;padding:0;font-size:10.5px}.Y6ZzqW_more{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:999px;align-self:flex-start;padding:5px 12px;font-size:11.5px}.Y6ZzqW_sourceList{flex-direction:column;gap:12px;display:flex}.Y6ZzqW_source{align-items:center;gap:8px;min-width:0;display:flex}.Y6ZzqW_sourceIcon{background:var(--dsw-static-deepseek-100);width:22px;height:22px;color:var(--dsw-static-deepseek-500);border-radius:6px;flex:0 0 22px;justify-content:center;align-items:center;font-size:11px;display:inline-flex}.Y6ZzqW_sourceCopy{flex-direction:column;flex:1;min-width:0;display:flex}.Y6ZzqW_sourceCopy a{min-width:0;color:var(--dsw-static-deepseek-500);text-overflow:ellipsis;white-space:nowrap;text-decoration:none;display:block;overflow:hidden}.Y6ZzqW_sourceCopy a:hover{text-decoration:underline}.Y6ZzqW_sourceCopy b{color:var(--dsw-alias-label-primary);text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:1.5;display:block;overflow:hidden}.Y6ZzqW_sourceCopy span{color:var(--dsw-alias-label-tertiary);font-size:10.5px}.Y6ZzqW_sourceState{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-tertiary);border-radius:999px;flex:none;padding:1px 6px;font-size:10px;font-style:normal}.Y6ZzqW_state_已确认{color:#2f9e44;border-color:#2f9e44}.Y6ZzqW_state_未达标{color:#e5484d;border-color:#e5484d}.Y6ZzqW_state_等待中{color:#e8a33d;border-color:#e8a33d}.Y6ZzqW_sideNote{color:var(--dsw-alias-label-tertiary);margin:0;font-size:10.5px;line-height:1.5}.Y6ZzqW_hero{text-align:center;flex-direction:column;align-items:center;gap:8px;max-width:380px;margin:auto;display:flex}.Y6ZzqW_hero h2{color:var(--dsw-alias-label-primary);margin:0;font-size:15px}.Y6ZzqW_hero p{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px}.Y6ZzqW_hint{color:var(--dsw-alias-label-tertiary);margin:auto;font-size:12px}.Y6ZzqW_primary{background:var(--dsw-static-deepseek-500);color:#fff;cursor:pointer;border:none;border-radius:999px;padding:7px 16px;font-size:12.5px}.Y6ZzqW_primary:disabled{opacity:.6;cursor:default}.Y6ZzqW_error{color:#e5484d;font-size:11.5px}.Y6ZzqW_mask{z-index:40;background:#00000059;justify-content:center;align-items:center;display:flex;position:absolute;inset:0}.Y6ZzqW_modal{background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:14px;flex-direction:column;gap:10px;width:min(480px,92%);max-height:86%;padding:14px 16px;display:flex;overflow-y:auto}.Y6ZzqW_modalHead{justify-content:space-between;align-items:center;display:flex}.Y6ZzqW_modalHead h2{color:var(--dsw-alias-label-primary);margin:0;font-size:14px}.Y6ZzqW_modalHead button{color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;font-size:16px}.Y6ZzqW_fieldLabel{color:var(--dsw-alias-label-secondary);flex-direction:column;gap:4px;font-size:11.5px;display:flex}.Y6ZzqW_fieldLabel input,.Y6ZzqW_fieldLabel textarea{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);resize:vertical;border-radius:8px;padding:7px 9px;font-size:12.5px}.Y6ZzqW_fieldLabel textarea{min-height:56px}.Y6ZzqW_fieldRow{gap:10px;display:flex}.Y6ZzqW_fieldRow .Y6ZzqW_fieldLabel{flex:1}.Y6ZzqW_modalFoot{justify-content:flex-end;gap:8px;display:flex}.Y6ZzqW_modalFoot button{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:999px;padding:6px 14px;font-size:12px}.Y6ZzqW_modalFoot .Y6ZzqW_primary{background:var(--dsw-static-deepseek-500);color:#fff;border:none}.Y6ZzqW_sourceJump{font:inherit;color:var(--dsw-static-deepseek-500);cursor:pointer;text-align:left;background:0 0;border:none;min-width:0;margin:0;padding:0}.Y6ZzqW_sourceJump b{text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:1.5;display:block;overflow:hidden}.Y6ZzqW_sourceJump:hover b{text-decoration:underline}";
		const tagId$2 = "@dsh-yzj/bundle/ui-yzj/advance-pane.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@dsh-yzj/bundle/ui-yzj";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var advance_pane_module_css_default = {
			"state_已确认": "Y6ZzqW_state_已确认",
			"modal": "Y6ZzqW_modal",
			"dreamPoolRow": "Y6ZzqW_dreamPoolRow",
			"timeline": "Y6ZzqW_timeline",
			"pill_blue": "Y6ZzqW_pill_blue",
			"verbs": "Y6ZzqW_verbs",
			"background": "Y6ZzqW_background",
			"mark_red": "Y6ZzqW_mark_red",
			"primary": "Y6ZzqW_primary",
			"sourceJump": "Y6ZzqW_sourceJump",
			"kicker": "Y6ZzqW_kicker",
			"actions": "Y6ZzqW_actions",
			"state_等待中": "Y6ZzqW_state_等待中",
			"dot_red": "Y6ZzqW_dot_red",
			"changeType": "Y6ZzqW_changeType",
			"timeMeta": "Y6ZzqW_timeMeta",
			"side": "Y6ZzqW_side",
			"mark_blue": "Y6ZzqW_mark_blue",
			"closedToggle": "Y6ZzqW_closedToggle",
			"closedZone": "Y6ZzqW_closedZone",
			"queue": "Y6ZzqW_queue",
			"linkBtn": "Y6ZzqW_linkBtn",
			"entryDetail": "Y6ZzqW_entryDetail",
			"metrics": "Y6ZzqW_metrics",
			"fieldRow": "Y6ZzqW_fieldRow",
			"modalFoot": "Y6ZzqW_modalFoot",
			"feedbackBtn": "Y6ZzqW_feedbackBtn",
			"quiet": "Y6ZzqW_quiet",
			"decision": "Y6ZzqW_decision",
			"actionRow": "Y6ZzqW_actionRow",
			"changeType_green": "Y6ZzqW_changeType_green",
			"dreamLine": "Y6ZzqW_dreamLine",
			"refChip": "Y6ZzqW_refChip",
			"imDraft": "Y6ZzqW_imDraft",
			"state_未达标": "Y6ZzqW_state_未达标",
			"dot_green": "Y6ZzqW_dot_green",
			"stagePill": "Y6ZzqW_stagePill",
			"main": "Y6ZzqW_main",
			"sourceIcon": "Y6ZzqW_sourceIcon",
			"refEvent": "Y6ZzqW_refEvent",
			"sideNote": "Y6ZzqW_sideNote",
			"meta": "Y6ZzqW_meta",
			"mark": "Y6ZzqW_mark",
			"refEventBody": "Y6ZzqW_refEventBody",
			"pill_gray": "Y6ZzqW_pill_gray",
			"time": "Y6ZzqW_time",
			"jump": "Y6ZzqW_jump",
			"impact": "Y6ZzqW_impact",
			"timeCopy": "Y6ZzqW_timeCopy",
			"entryHead": "Y6ZzqW_entryHead",
			"changeType_blue": "Y6ZzqW_changeType_blue",
			"pill_green": "Y6ZzqW_pill_green",
			"detailGrid": "Y6ZzqW_detailGrid",
			"more": "Y6ZzqW_more",
			"subSources": "Y6ZzqW_subSources",
			"queueTitle": "Y6ZzqW_queueTitle",
			"queueLabel": "Y6ZzqW_queueLabel",
			"goal": "Y6ZzqW_goal",
			"dot_blue": "Y6ZzqW_dot_blue",
			"mark_green": "Y6ZzqW_mark_green",
			"subChip": "Y6ZzqW_subChip",
			"pill_red": "Y6ZzqW_pill_red",
			"detailHead": "Y6ZzqW_detailHead",
			"entryCaret": "Y6ZzqW_entryCaret",
			"verbsSecondary": "Y6ZzqW_verbsSecondary",
			"changeType_red": "Y6ZzqW_changeType_red",
			"refsHead": "Y6ZzqW_refsHead",
			"source": "Y6ZzqW_source",
			"sourceCopy": "Y6ZzqW_sourceCopy",
			"body": "Y6ZzqW_body",
			"dot": "Y6ZzqW_dot",
			"options": "Y6ZzqW_options",
			"sourceState": "Y6ZzqW_sourceState",
			"error": "Y6ZzqW_error",
			"queueItem": "Y6ZzqW_queueItem",
			"sourceCiting": "Y6ZzqW_sourceCiting",
			"dreamActions": "Y6ZzqW_dreamActions",
			"kickerActions": "Y6ZzqW_kickerActions",
			"queueItemOn": "Y6ZzqW_queueItemOn",
			"dot_gray": "Y6ZzqW_dot_gray",
			"queueCount": "Y6ZzqW_queueCount",
			"hint": "Y6ZzqW_hint",
			"queueGroup": "Y6ZzqW_queueGroup",
			"imDraftFoot": "Y6ZzqW_imDraftFoot",
			"dreamPoolMeta": "Y6ZzqW_dreamPoolMeta",
			"mask": "Y6ZzqW_mask",
			"patrolBtn": "Y6ZzqW_patrolBtn",
			"subGroupList": "Y6ZzqW_subGroupList",
			"optionBtn": "Y6ZzqW_optionBtn",
			"sectionHead": "Y6ZzqW_sectionHead",
			"detail": "Y6ZzqW_detail",
			"sourceList": "Y6ZzqW_sourceList",
			"timeItem": "Y6ZzqW_timeItem",
			"subIcon": "Y6ZzqW_subIcon",
			"refEventMeta": "Y6ZzqW_refEventMeta",
			"fieldLabel": "Y6ZzqW_fieldLabel",
			"refs": "Y6ZzqW_refs",
			"dreamPoolList": "Y6ZzqW_dreamPoolList",
			"metric": "Y6ZzqW_metric",
			"section": "Y6ZzqW_section",
			"hero": "Y6ZzqW_hero",
			"queueHead": "Y6ZzqW_queueHead",
			"queueEmpty": "Y6ZzqW_queueEmpty",
			"modalHead": "Y6ZzqW_modalHead"
		};
		//#endregion
		//#region lib/types/client/advance-pane.js
		/**
		* The 推进 tab: the AI推进 board (docs/spec/ai-advance-design.md §7),
		* information architecture replicated from the lgap17 prototype — left
		* "我的推进" queue (待我决定 / 待我验收 / 我关注的推进 with count badges),
		* main detail (kicker + metric cards + goal + stage-aware decision area +
		* 推进时间旅程 with three-tone marks and source jumps), right column
		* (信息来源;「已有产物」区已于 v1.6 收掉——产物是事元的一部分,随信息来源呈现)。Panel judge verbs and the start modal are
		* user-direct writes (D9: no confirmation card); agent writes go through
		* yzj_advance_create/feed with the standard card. Data arrives through the
		* /yzj RPC face only.
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
		/** Chinese stage labels (seven-stage machine, v1.6 +cancelled). */
		const STAGE_LABEL = {
			"draft": "草稿",
			"running": "推进中",
			"decision-needed": "待你决定",
			"updated": "已按方案更新",
			"ready-for-review": "待你验收",
			"completed": "已完成",
			"cancelled": "已中止"
		};
		/** Queue grouping of the board items (spec §7 / PRD §5.3.2); terminals land in closed (「已结束」折叠区). */
		function queuesOf(items) {
			const isTerminal = (stage) => stage === "completed" || stage === "cancelled";
			return {
				decide: items.filter((item) => asString$4(item.stage) === "decision-needed"),
				review: items.filter((item) => asString$4(item.stage) === "ready-for-review"),
				watch: items.filter((item) => asString$4(item.stage) !== "decision-needed" && asString$4(item.stage) !== "ready-for-review" && !isTerminal(asString$4(item.stage))),
				closed: items.filter((item) => isTerminal(asString$4(item.stage)))
			};
		}
		/** Ref kind: token 前缀优先(`im:` 必是群消息——即使事元来源类型是会议/文档,引用的也可能是群消息);sourceType 兜底(refs carry bare ids)。 */
		function refKindOf(sourceType, token) {
			if (token.startsWith("im:")) return "msg";
			if (sourceType === "文档" || sourceType === "会议") return "doc";
			if (sourceType === "对话") return "msg";
			if (sourceType === "待办") return "todo";
			if (sourceType === "日程") return "event";
			return "other";
		}
		/** Strip the literal `yzj:` prefix models sometimes add per the tool description (yzj:{json} chip encoding never lands on entry refs). */
		function stripRefPrefix(raw) {
			return raw.startsWith("yzj:") && !raw.startsWith("yzj:{") ? raw.slice(4) : raw;
		}
		const REF_ICON = {
			doc: "文",
			msg: "聊",
			todo: "待",
			event: "程",
			other: "源"
		};
		/** 未命中降级 chip 的类型名(不露裸 id,视觉走查 08-21)。 */
		const REF_LABEL = {
			doc: "文档",
			msg: "群消息",
			todo: "待办",
			event: "日程",
			other: "来源"
		};
		/** 事元出处载体(视觉走查 08-21):sourceType 记内容场合,refs 才是载体——「记录自」承诺的是载体,
		会议来源引用群消息就显示「群消息」。按 refs 实际 kind 聚合;无 refs 退回 sourceType。 */
		function entryOriginOf(sourceType, refs) {
			const kinds = /* @__PURE__ */ new Set();
			for (const raw of refs) {
				const token = stripRefPrefix(raw);
				if (token === "") continue;
				kinds.add(refKindOf(sourceType, token));
			}
			if (kinds.size === 0) return sourceType;
			return [
				"msg",
				"doc",
				"todo",
				"event",
				"other"
			].filter((k) => kinds.has(k)).map((k) => REF_LABEL[k] ?? "来源").join("·");
		}
		/** 决策 39: `im:<groupId>:<msgId>` msg ref → 事件级定位锚点；裸 msgId 是 legacy（无群信息，只能降级跳群）。 */
		function msgAnchorOf(raw) {
			const match = /^im:([^:\s]+):(.+)$/.exec(raw);
			if (match === null) return null;
			return {
				groupId: match[1],
				msgId: match[2]
			};
		}
		/** 事件行时间戳：sentAt(ms) → `MM-DD HH:mm`。 */
		function refStampOf(sentAt) {
			if (sentAt <= 0) return "";
			const date = new Date(sentAt);
			const pad = (value) => String(value).padStart(2, "0");
			return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
		}
		/** 时间线时间戳紧凑化(视觉走查):当天只留 `HH:mm`,当年 `MM-DD HH:mm`,跨年全量;完整值在 title。 */
		function formatEntryAt(at) {
			const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{1,2}):(\d{2})/.exec(at.trim());
			if (match === null) return at;
			const [, year, month, day, hh, mm] = match;
			const pad = (value) => String(value).padStart(2, "0");
			const mmdd = `${pad(Number(month))}-${pad(Number(day))}`;
			const now = /* @__PURE__ */ new Date();
			const today = `${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
			if (year === String(now.getFullYear()) && mmdd === today) return `${hh}:${mm}`;
			if (year === String(now.getFullYear())) return `${mmdd} ${hh}:${mm}`;
			return `${year}-${mmdd} ${hh}:${mm}`;
		}
		/** Doc deep link(知识库 web);其他类型跳域(无消息级锚点,spec 决策 8 诚实降级)。 */
		function refHref(kind, id) {
			if (kind === "doc" && id !== "") return `https://www.yunzhijia.com/knowledge/lingee/#/store/doc/${id}`;
			return null;
		}
		/** Queue dot tone per stage (prototype: 红=待决定 蓝=推进 绿=完成 灰=草稿/中止). */
		function dotToneOf(stage) {
			if (stage === "decision-needed") return "red";
			if (stage === "completed") return "green";
			if (stage === "draft" || stage === "cancelled") return "gray";
			return "blue";
		}
		/** Max personal workspaces listed in the source picker (防爆上限;个人库通常一两个)。 */
		const MAX_PICKER_WORKSPACES = 6;
		/** Single-character icon per source token prefix (上下文来源 chip). */
		const THREAD_ICON = {
			im: "群",
			doc: "文",
			todo: "待",
			event: "日",
			file: "附",
			dir: "库"
		};
		function sourceIconOf(token) {
			const prefix = token.split(":")[0] ?? "";
			return THREAD_ICON[prefix] ?? "源";
		}
		/** Queue-head patrol line (spec §14.5). */
		function hhmm(ts) {
			const date = new Date(ts);
			return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
		}
		function formatScanStatus(scannedAt, found) {
			if (scannedAt === null) return "尚未巡检";
			const date = new Date(scannedAt);
			return `上次巡检 ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")} · 本轮发现 ${found} 条`;
		}
		const ACTION_KIND = {
			"建待办": "todo",
			"发消息": "im",
			"定会议": "event"
		};
		/** 动作类型标签与执行态文案(决策 41)。 */
		const ACTION_LABEL = {
			todo: "建待办",
			im: "发消息",
			event: "定会议"
		};
		const ACTION_DONE = {
			todo: "已建待办",
			im: "已发消息",
			event: "已跳日程"
		};
		/**
		* Parse one decision-request 事元 detail into selectable options (spec §15.4
		* / 决策 23) plus action lines (决策 41): `选项N: …` lines become buttons,
		* `动作: 建待办 | 内容: …` lines become executable action buttons, the `影响: …`
		* line is shown separately, the remaining lines stay as plain detail.
		* No `选项N` line → options empty; unrecognized 动作类型 stays plain text.
		*/
		function parseDecisionOptions(detail) {
			const options = [];
			const actions = [];
			let impact = "";
			let mergedFrom = "";
			const rest = [];
			for (const line of detail.split("\n")) {
				const trimmed = line.trim();
				if (trimmed === "") continue;
				const option = trimmed.match(/^选项\d+[:：]\s*(.+)$/);
				if (option !== null) {
					options.push((option[1] ?? "").trim());
					continue;
				}
				const merged = trimmed.match(/^综合自[:：]\s*([^\s（(]+)/);
				if (merged !== null) {
					mergedFrom = (merged[1] ?? "").trim();
					continue;
				}
				const actionMatch = trimmed.match(/^动作[:：]\s*(.+)$/);
				if (actionMatch !== null) {
					const segments = (actionMatch[1] ?? "").split("|").map((segment) => segment.trim()).filter((segment) => segment !== "");
					const kind = ACTION_KIND[segments[0] ?? ""];
					if (kind === void 0) {
						rest.push(trimmed);
						continue;
					}
					const fields = {};
					for (const segment of segments.slice(1)) {
						const kv = segment.match(/^([^:：|]+)[:：]\s*(.+)$/);
						if (kv !== null) fields[(kv[1] ?? "").trim()] = (kv[2] ?? "").trim();
					}
					actions.push({
						kind,
						text: fields["内容"] ?? fields["主题"] ?? segments.slice(1).join(" · "),
						fields
					});
					continue;
				}
				const impactMatch = trimmed.match(/^影响[:：]\s*(.+)$/);
				if (impactMatch !== null) {
					impact = (impactMatch[1] ?? "").trim();
					continue;
				}
				rest.push(trimmed);
			}
			return {
				options,
				impact,
				rest: rest.join("\n"),
				actions,
				mergedFrom
			};
		}
		/**
		* Fold executed decision-card actions from the entry stream (决策 45): every
		* execution 事元 carries a detail mark `动作序: <key> | 种类: <kind> | 文本:
		* <text>` written by the host (advance-action-run). The set holds both the
		* raw key and the `kind|text` fallback pair — 综合卡 re-orders action rows
		* (决策 43), so the key alone is not stable across card revisions. Done
		* state is derived from the stream, never held in memory (refresh-safe).
		*/
		function foldDoneActions(entries) {
			const done = /* @__PURE__ */ new Set();
			for (const entry of entries) for (const line of asString$4(entry.detail).split("\n")) {
				const mark = /^动作序:\s*([^|]+)\|\s*种类:\s*(\w+)\s*\|\s*文本:\s*(.*)$/.exec(line.trim());
				if (mark === null) continue;
				done.add((mark[1] ?? "").trim());
				done.add(`${mark[2]}|${(mark[3] ?? "").trim()}`);
			}
			return done;
		}
		/**
		* Fold pending source recommendations from the entry stream (决策 49): entries
		* carrying a `推荐订阅: <token>` detail mark, minus `推荐忽略:` (permanent) and
		* already-subscribed tokens. Label comes from the recommend entry's summary
		* (「推荐订阅来源：<name>」). Recommendations are a shelf, not a bill.
		*/
		function foldPendingRecommendations(entries, subscribedTokens) {
			const pending = /* @__PURE__ */ new Map();
			const ignored = /* @__PURE__ */ new Set();
			for (const entry of entries) {
				const summary = asString$4(entry.summary);
				for (const line of asString$4(entry.detail).split("\n")) {
					const trimmed = line.trim();
					const rec = /^推荐订阅[:：]\s*([^\s|]+)/.exec(trimmed);
					if (rec !== null) {
						const token = rec[1] ?? "";
						if (token !== "" && !ignored.has(token)) {
							const label = /^推荐订阅来源[:：]\s*(.+)$/.exec(summary)?.[1]?.trim() ?? token;
							pending.set(token, label);
						}
						continue;
					}
					const ign = /^推荐忽略[:：]\s*([^\s|]+)/.exec(trimmed);
					if (ign !== null) {
						const token = ign[1] ?? "";
						if (token !== "") {
							ignored.add(token);
							pending.delete(token);
						}
					}
				}
			}
			const subscribed = new Set(subscribedTokens);
			return [...pending.entries()].filter(([token]) => !subscribed.has(token)).map(([token, label]) => ({
				token,
				label
			}));
		}
		function YzjAdvancePane(props) {
			const [board, setBoard] = (0, react.useState)({
				loading: true,
				ready: false,
				items: [],
				libraryLink: "",
				error: ""
			});
			const [activeId, setActiveId] = (0, react.useState)("");
			const [detail, setDetail] = (0, react.useState)(null);
			const [detailLoading, setDetailLoading] = (0, react.useState)(false);
			const [showAll, setShowAll] = (0, react.useState)(false);
			const [busy, setBusy] = (0, react.useState)(false);
			const [startOpen, setStartOpen] = (0, react.useState)(false);
			/** Two-tap confirm for the terminal 中止推进 verb (cancelled is a 终局, 决策 27). */
			const [cancelArmed, setCancelArmed] = (0, react.useState)(false);
			/** 「已结束」折叠区(completed/cancelled 事项,终局提示事后可达)。 */
			const [showClosed, setShowClosed] = (0, react.useState)(false);
			/** 发消息动作的就地草稿框(决策 41)。 */
			const [imDraft, setImDraft] = (0, react.useState)(null);
			/** 时间线事元详情展开集(默认折叠,展开才见原始来源)。 */
			const [expandedEntries, setExpandedEntries] = (0, react.useState)(/* @__PURE__ */ new Set());
			const [draft, setDraft] = (0, react.useState)({
				title: "",
				goal: "",
				metrics: "",
				assignee: "",
				targetDate: "",
				background: ""
			});
			const [error, setError] = (0, react.useState)("");
			/** msg 类事元/来源跳转：带渠道 token 直达该群并定位那条消息（决策 39）；裸 msgId 降级用订阅渠道猜群。 */
			const imGroupTokens = (detail?.contextSources ?? []).map((row) => asString$4(row.token)).filter((token) => token.startsWith("im:"));
			/** 第一个订阅群的显示名(发消息动作的投递目标文案)。 */
			const imGroupLabel = asString$4((detail?.contextSources ?? []).map(asRecord$6).find((row) => asString$4(row.token).startsWith("im:"))?.label) || "订阅群";
			const jumpToMsg = () => {
				if (imGroupTokens.length === 1) requestImGroupFocus({ groupId: imGroupTokens[0].slice(3) });
				setWorkbenchDomain("im");
			};
			/** 事元 msg ref 跳转（决策 39）：`im:g:m` 直达消息；legacy 裸 msgId 回退 jumpToMsg。 */
			const jumpToSourceMsg = (raw) => {
				const anchor = msgAnchorOf(raw);
				if (anchor !== null) {
					requestImGroupFocus({
						groupId: anchor.groupId,
						anchorMsgId: anchor.msgId
					});
					setWorkbenchDomain("im");
					return;
				}
				jumpToMsg();
			};
			const [scanLine, setScanLine] = (0, react.useState)("尚未巡检");
			/** Dream 蓄水池水位行(spec §17.3)。 */
			const [dreamLine, setDreamLine] = (0, react.useState)("");
			/** Dream 水位达阈（决策 35）：抽取按钮高亮。 */
			const [waterReached, setWaterReached] = (0, react.useState)(false);
			/** 蓄水池 pending 明细（池查看浮层，决策 38）。 */
			const [dreamEntries, setDreamEntries] = (0, react.useState)([]);
			const [dreamPoolOpen, setDreamPoolOpen] = (0, react.useState)(false);
			/** 原始信息叶子可读化(决策 39 后续): msg → bound log 事件行;doc → 文档名。 */
			const [refHits, setRefHits] = (0, react.useState)({});
			const [sourceModalOpen, setSourceModalOpen] = (0, react.useState)(false);
			const [groupOptions, setGroupOptions] = (0, react.useState)([]);
			/** 知识库目录选项(决策 32):整库 + 一层目录。 */
			const [dirOptions, setDirOptions] = (0, react.useState)([]);
			const loadScan = async () => {
				const result = await props.inject.advanceScanState();
				if (!result.ok) return;
				const value = asRecord$6(result.value);
				const scannedAt = typeof value.scannedAt === "number" ? value.scannedAt : null;
				const found = typeof value.found === "number" ? value.found : 0;
				setScanLine(formatScanStatus(scannedAt, found));
			};
			const loadDream = async () => {
				const result = await props.inject.advanceDreamState();
				if (!result.ok) return;
				const value = asRecord$6(result.value);
				const pending = typeof value.pending === "number" ? value.pending : 0;
				const lastDreamAt = typeof value.lastDreamAt === "number" ? value.lastDreamAt : null;
				setWaterReached(value.waterLevelReached === true);
				setDreamEntries(Array.isArray(value.entries) ? value.entries.map((row) => {
					const entry = asRecord$6(row);
					return {
						id: asString$4(entry.id),
						channel: asString$4(entry.channel),
						refId: asString$4(entry.refId),
						content: asString$4(entry.content),
						sendTime: asString$4(entry.sendTime)
					};
				}) : []);
				if (pending === 0) {
					setDreamLine(lastDreamAt === null ? "" : `蓄水池已清空 · 上次抽取 ${hhmm(lastDreamAt)}`);
					return;
				}
				setDreamLine(`池中 ${pending} 条待抽取${value.waterLevelReached === true ? " · 水位达到，建议抽取" : ""}${lastDreamAt === null ? "" : ` · 上次抽取 ${hhmm(lastDreamAt)}`}`);
			};
			/** Dream 手动径（决策 38）: host 直建 yzj-dream-* 会话并聚焦。 */
			const runDream = async () => {
				setBusy(true);
				try {
					const result = await props.inject.advanceDreamRun();
					if (!result.ok) {
						setError(result.error.message);
						return;
					}
					setError("");
					const sessionId = asString$4(asRecord$6(result.value).sessionId);
					if (sessionId !== "") props.inject.focusBoundSession?.(sessionId);
				} finally {
					setBusy(false);
				}
			};
			/** 原始信息可读化(决策 39 后续): detail 加载后批量把 refs 按 kind 解析成可读叶子。 */
			(0, react.useEffect)(() => {
				if (detail === void 0 || detail === null) {
					setRefHits({});
					return;
				}
				const wanted = [];
				const seen = /* @__PURE__ */ new Set();
				for (const entry of detail.entries) {
					const refs = Array.isArray(entry.refs) ? entry.refs : [];
					for (const raw of refs) {
						const token = stripRefPrefix(asString$4(raw));
						if (token === "" || seen.has(token)) continue;
						const kind = refKindOf(asString$4(entry.sourceType), token);
						if (kind !== "msg" && kind !== "doc" && !token.startsWith("dp-")) continue;
						seen.add(token);
						wanted.push({
							token,
							kind
						});
					}
				}
				if (wanted.length === 0) {
					setRefHits({});
					return;
				}
				let cancelled = false;
				(async () => {
					const result = await props.inject.advanceRefLookup(wanted);
					if (cancelled || !result.ok) return;
					const hits = asRecord$6(result.value).hits;
					if (!Array.isArray(hits)) return;
					const next = {};
					for (const row of hits) {
						const hit = asRecord$6(row);
						next[asString$4(hit.token)] = {
							kind: asString$4(hit.kind),
							fromName: asString$4(hit.fromName),
							content: asString$4(hit.content),
							sentAt: typeof hit.sentAt === "number" ? hit.sentAt : 0,
							...asString$4(hit.jumpToken) === "" ? {} : { jumpToken: asString$4(hit.jumpToken) },
							...asString$4(hit.docId) === "" ? {} : { docId: asString$4(hit.docId) }
						};
					}
					if (!cancelled) setRefHits(next);
				})();
				return () => {
					cancelled = true;
				};
			}, [detail, props.inject]);
			const loadBoard = async () => {
				const result = await props.inject.advanceState();
				if (!result.ok) {
					setBoard({
						loading: false,
						ready: false,
						items: [],
						libraryLink: "",
						error: result.error.message
					});
					return [];
				}
				const value = asRecord$6(result.value);
				const items = asArray$4(value.items).map(asRecord$6);
				setBoard({
					loading: false,
					ready: value.ready === true,
					items,
					libraryLink: asString$4(asRecord$6(value.library).link),
					error: asString$4(value.error)
				});
				return items;
			};
			(0, react.useEffect)(() => {
				let live = true;
				(async () => {
					const items = await loadBoard();
					await loadScan();
					await loadDream();
					if (!live || items.length === 0) return;
					const { decide, review, watch } = queuesOf(items);
					const first = decide[0] ?? review[0] ?? watch[0];
					if (first !== void 0) setActiveId(asString$4(first.advanceId));
				})();
				return () => {
					live = false;
				};
			}, []);
			(0, react.useEffect)(() => {
				if (activeId === "") {
					setDetail(null);
					return;
				}
				let live = true;
				setDetailLoading(true);
				setSourceModalOpen(false);
				props.inject.advanceGet(activeId, showAll ? 0 : void 0, showAll ? 200 : void 0).then((result) => {
					if (!live) return;
					setDetailLoading(false);
					if (!result.ok) {
						setError(result.error.message);
						return;
					}
					const value = asRecord$6(result.value);
					setDetail({
						item: asRecord$6(value.item),
						entries: asArray$4(value.entries).map(asRecord$6),
						entryTotal: typeof value.entryTotal === "number" ? value.entryTotal : 0,
						sources: asArray$4(value.sources).map(asRecord$6),
						contextSources: asArray$4(value.contextSources).map(asRecord$6)
					});
				});
				return () => {
					live = false;
				};
			}, [activeId, showAll]);
			const queues = (0, react.useMemo)(() => queuesOf(board.items), [board.items]);
			/** 动作执行态从事元流折叠(决策 45)：执行事元 detail 带动作序标记，刷新不丢。 */
			const doneActions = (0, react.useMemo)(() => foldDoneActions(detail?.entries ?? []), [detail]);
			/** 待确认推荐订阅(决策 49)：货架不是账单——灰字行，不点无后果。 */
			const pendingRecs = (0, react.useMemo)(() => foldPendingRecommendations(detail?.entries ?? [], (detail?.contextSources ?? []).map((row) => asString$4(row.token))), [detail]);
			const judge = async (action, note) => {
				if (busy || activeId === "") return;
				setBusy(true);
				setError("");
				const result = await props.inject.advanceJudge(activeId, action, note);
				setBusy(false);
				if (!result.ok) {
					setError(result.error.message);
					return;
				}
				await loadBoard();
				setShowAll(false);
				const detailResult = await props.inject.advanceGet(activeId);
				if (detailResult.ok) {
					const value = asRecord$6(detailResult.value);
					setDetail({
						item: asRecord$6(value.item),
						entries: asArray$4(value.entries).map(asRecord$6),
						entryTotal: typeof value.entryTotal === "number" ? value.entryTotal : 0,
						sources: asArray$4(value.sources).map(asRecord$6),
						contextSources: asArray$4(value.contextSources).map(asRecord$6)
					});
				}
			};
			/** Re-pull the detail only (source add/remove landed registry/entry rows). */
			const refreshDetail = async () => {
				if (activeId === "") return;
				const result = await props.inject.advanceGet(activeId);
				if (!result.ok) {
					setError(result.error.message);
					return;
				}
				const value = asRecord$6(result.value);
				setDetail({
					item: asRecord$6(value.item),
					entries: asArray$4(value.entries).map(asRecord$6),
					entryTotal: typeof value.entryTotal === "number" ? value.entryTotal : 0,
					sources: asArray$4(value.sources).map(asRecord$6),
					contextSources: asArray$4(value.contextSources).map(asRecord$6)
				});
			};
			/** 动作执行(决策 45)：一个 RPC 由 host 编排 执行→执行事元留痕(refs+动作序)
			*  →效应对象自动订阅。event 无效应对象——留痕后跳日程域，建成后经订阅回流。 */
			const runAction = async (key, action) => {
				if (action.kind === "im") {
					setImDraft({
						key,
						text: action.fields["内容"] ?? action.text
					});
					return;
				}
				setBusy(true);
				setError("");
				const result = await props.inject.advanceActionRun({
					advanceId: activeId,
					actionKey: key,
					kind: action.kind,
					text: action.text,
					fields: action.fields
				});
				setBusy(false);
				if (!result.ok) {
					setError(result.error.message);
					return;
				}
				const warnings = asArray$4(asRecord$6(result.value).warnings).map(asString$4).filter((row) => row !== "");
				if (warnings.length > 0) setError(`已完成，但：${warnings.join("；")}`);
				if (action.kind === "event") setWorkbenchDomain("calendar");
				await refreshDetail();
			};
			/** 发消息动作发送(决策 41/45):用户在看板过目草稿后点发;host 落 refs=im:g:m 留痕。 */
			const sendActionMessage = async () => {
				if (imDraft === null || imDraft.text.trim() === "") return;
				const groupId = (imGroupTokens[0] ?? "").slice(3);
				if (groupId === "") {
					setError("没有订阅的群渠道，发消息动作无处投递");
					return;
				}
				setBusy(true);
				setError("");
				const result = await props.inject.advanceActionRun({
					advanceId: activeId,
					actionKey: imDraft.key,
					kind: "im",
					text: imDraft.text.trim(),
					fields: {},
					imGroupId: groupId,
					imGroupLabel
				});
				setBusy(false);
				if (!result.ok) {
					setError(result.error.message);
					return;
				}
				const warnings = asArray$4(asRecord$6(result.value).warnings).map(asString$4).filter((row) => row !== "");
				setImDraft(null);
				if (warnings.length > 0) setError(`已完成，但：${warnings.join("；")}`);
				await refreshDetail();
			};
			/** 推荐忽略(决策 49)：落「推荐忽略」事元——host 抑制同 token 永不再推。 */
			const ignoreRecommendation = async (rec) => {
				if (busy || activeId === "") return;
				setBusy(true);
				setError("");
				const result = await props.inject.advanceFeed({
					advanceId: activeId,
					summary: `忽略推荐来源：${rec.label}`,
					detail: `推荐忽略: ${rec.token}`,
					sourceType: "人工"
				});
				setBusy(false);
				if (!result.ok) {
					setError(result.error.message);
					return;
				}
				await refreshDetail();
			};
			const openSourceModal = async () => {
				setSourceModalOpen(true);
				const result = await props.inject.fetchGroups();
				if (result.ok) {
					const value = asRecord$6(result.value);
					const rows = asArray$4(value.list).length > 0 ? asArray$4(value.list) : asArray$4(result.value);
					setGroupOptions(rows.map(asRecord$6).filter((row) => asString$4(row.groupId) !== ""));
				}
				const dirs = [];
				const wsResult = await props.inject.fetchWorkspaces("personal");
				if (wsResult.ok) {
					const workspaces = asArray$4(wsResult.value).map(asRecord$6).filter((row) => asString$4(row.id) !== "").slice(0, MAX_PICKER_WORKSPACES);
					for (const ws of workspaces) {
						const kbId = asString$4(ws.id);
						dirs.push({
							id: kbId,
							label: `${asString$4(ws.name) || kbId}（整库）`
						});
					}
				}
				setDirOptions(dirs);
			};
			const addSource = async (token, label) => {
				if (busy || activeId === "") return;
				setBusy(true);
				setError("");
				const result = await props.inject.advanceSourceAdd(activeId, token, label);
				setBusy(false);
				if (!result.ok) {
					setError(result.error.message);
					return;
				}
				setSourceModalOpen(false);
				await refreshDetail();
			};
			const removeSource = async (token) => {
				if (busy || activeId === "") return;
				setBusy(true);
				setError("");
				const result = await props.inject.advanceSourceRemove(activeId, token);
				setBusy(false);
				if (!result.ok) {
					setError(result.error.message);
					return;
				}
				await refreshDetail();
			};
			const create = async () => {
				if (busy || draft.title.trim() === "") return;
				setBusy(true);
				setError("");
				const result = await props.inject.advanceCreate({
					title: draft.title.trim(),
					goal: draft.goal.trim(),
					background: draft.background.trim(),
					metrics: draft.metrics.trim(),
					assignee: draft.assignee.trim(),
					targetDate: draft.targetDate.trim()
				});
				setBusy(false);
				if (!result.ok) {
					setError(result.error.message);
					return;
				}
				setStartOpen(false);
				setDraft({
					title: "",
					goal: "",
					metrics: "",
					assignee: "",
					targetDate: "",
					background: ""
				});
				await loadBoard();
				setActiveId(asString$4(asRecord$6(result.value).advanceId));
			};
			const ensure = async () => {
				if (busy) return;
				setBusy(true);
				setError("");
				const result = await props.inject.advanceEnsure();
				setBusy(false);
				if (!result.ok) {
					setError(result.error.message);
					return;
				}
				await loadBoard();
			};
			const queueGroup = (key, label, rows, emptyTitle, emptySub) => (0, react_jsx_runtime.jsxs)("div", {
				className: advance_pane_module_css_default.queueGroup,
				"data-testid": `yzj-advance-queue-${key}`,
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: advance_pane_module_css_default.queueLabel,
					children: [(0, react_jsx_runtime.jsx)("span", { children: label }), (0, react_jsx_runtime.jsx)("span", {
						className: advance_pane_module_css_default.queueCount,
						children: rows.length
					})]
				}), rows.length === 0 ? (0, react_jsx_runtime.jsxs)("div", {
					className: advance_pane_module_css_default.queueEmpty,
					children: [(0, react_jsx_runtime.jsx)("b", { children: emptyTitle }), (0, react_jsx_runtime.jsx)("p", { children: emptySub })]
				}) : rows.map((item) => {
					const id = asString$4(item.advanceId);
					const tone = dotToneOf(asString$4(item.stage));
					return (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: activeId === id ? `${advance_pane_module_css_default.queueItem} ${advance_pane_module_css_default.queueItemOn}` : advance_pane_module_css_default.queueItem,
						"data-testid": `yzj-advance-item-${id}`,
						onClick: () => {
							setShowAll(false);
							setActiveId(id);
						},
						children: [(0, react_jsx_runtime.jsxs)("span", {
							className: advance_pane_module_css_default.queueTitle,
							children: [(0, react_jsx_runtime.jsx)("i", { className: `${advance_pane_module_css_default.dot} ${advance_pane_module_css_default[`dot_${tone}`]}` }), (0, react_jsx_runtime.jsx)("b", { children: asString$4(item.title) === "" ? "(无标题)" : asString$4(item.title) })]
						}), (0, react_jsx_runtime.jsx)("p", { children: asString$4(item.latest) === "" ? STAGE_LABEL[asString$4(item.stage)] ?? asString$4(item.stage) : asString$4(item.latest) })]
					}, id);
				})]
			});
			if (!board.loading && !board.ready) return (0, react_jsx_runtime.jsx)("div", {
				className: advance_pane_module_css_default.body,
				"data-testid": "yzj-advance-pane",
				children: (0, react_jsx_runtime.jsxs)("div", {
					className: advance_pane_module_css_default.hero,
					children: [
						(0, react_jsx_runtime.jsx)("h2", { children: "推进看板还没有开通" }),
						(0, react_jsx_runtime.jsx)("p", { children: "发起第一个推进事项时会在当前任务库自动开通「事项 / 事元」双表；也可以现在一键开通。" }),
						(0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: advance_pane_module_css_default.primary,
							"data-testid": "yzj-advance-ensure",
							disabled: busy,
							onClick: () => {
								ensure();
							},
							children: busy ? "开通中…" : "一键开通"
						}),
						(error !== "" || board.error !== "") && (0, react_jsx_runtime.jsx)("div", {
							className: advance_pane_module_css_default.error,
							children: error || board.error
						})
					]
				})
			});
			const stage = detail === null ? "" : asString$4(detail.item.stage);
			const metrics = detail === null ? [] : asArray$4(detail.item.metrics).map(asRecord$6);
			/** 单卡决策(决策 43 修正,用户拍板):卡面=最近一条判定事元之后的最新决策请求;
			新卡必须「综合自」旧卡(host 强制),judge 结算后重算——永远只有一条当前决策。 */
			const latestDecision = detail === null ? void 0 : (() => {
				let lastJudge = -1;
				detail.entries.forEach((entry, i) => {
					if (asString$4(entry.judge) !== "") lastJudge = i;
				});
				return detail.entries.reduce((acc, entry, i) => i > lastJudge && asString$4(entry.changeType) === "决策请求" ? entry : acc, void 0);
			})();
			const decisionParsed = latestDecision === void 0 ? void 0 : parseDecisionOptions(asString$4(latestDecision.detail));
			/** 决策 41 前存量兜底:阶段已到 decision-needed 但无决策请求事元(旧纪律喂的是偏差+stageTo)——摆驱动事元。 */
			const latestDriver = detail === null ? void 0 : [...detail.entries].reverse().find((entry) => asString$4(entry.summary) !== "" && asString$4(entry.changeType) !== "阶段变化");
			/** agent 产的选项/动作是决策卡主按钮;有它们时写死的 judge 动词降级为次要行(用户拍板 08-21)。 */
			const hasDynamic = decisionParsed !== void 0 && (decisionParsed.actions.length > 0 || decisionParsed.options.length > 0);
			/** 「问助手/回到对话继续聊」(决策 41 讨论回环)：预填 discuss 草稿 → 切对话域 → 聚焦订阅群。
			*  产出会话优先（直回产出会话）；话题抽屉已撤下（决策 50），落点=群房间 + banner 草稿提示。 */
			const openAgentChat = async (text, producer) => {
				if (detail === null) return;
				if (producer !== void 0 && producer !== "") {
					try {
						await navigator.clipboard?.writeText(text);
					} catch {}
					props.inject.focusBoundSession?.(producer);
					return;
				}
				setAdvanceAskDraft({
					advanceId: asString$4(detail.item.advanceId),
					title: asString$4(detail.item.title),
					text,
					kind: "discuss"
				});
				setWorkbenchDomain("im");
				const groupId = (imGroupTokens[0] ?? "").slice(3);
				if (groupId === "") return;
				requestImGroupFocus({ groupId });
			};
			/** 「回到对话继续聊」:agent 聊出新建议后补/更新决策请求,用户再回看板拍板。
			落点=产出该决策请求/驱动事元的会话(有记录时),否则订阅群最新话题。 */
			const chatAboutDecision = (summary) => {
				const producer = asString$4((latestDecision ?? latestDriver)?.producer);
				openAgentChat(decisionChatText(asString$4(detail?.item.advanceId), asString$4(detail?.item.title), summary), producer);
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				className: advance_pane_module_css_default.body,
				"data-testid": "yzj-advance-pane",
				children: [
					(0, react_jsx_runtime.jsxs)("aside", {
						className: advance_pane_module_css_default.queue,
						"data-testid": "yzj-advance-queue",
						children: [
							(0, react_jsx_runtime.jsxs)("div", {
								className: advance_pane_module_css_default.queueHead,
								children: [
									(0, react_jsx_runtime.jsx)("b", { children: "我的推进" }),
									(0, react_jsx_runtime.jsx)("span", {
										"data-testid": "yzj-advance-scan-status",
										children: scanLine
									}),
									(0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: advance_pane_module_css_default.patrolBtn,
										"data-testid": "yzj-advance-patrol-now",
										title: "立即机械巡检一轮上下文来源（host routine，无模型）",
										onClick: () => {
											(async () => {
												setBusy(true);
												try {
													await props.inject.advancePatrolNow();
													const scan = await props.inject.advanceScanState();
													if (scan.ok) {
														const v = asRecord$6(scan.value);
														setScanLine(formatScanStatus(typeof v.scannedAt === "number" ? v.scannedAt : null, typeof v.found === "number" ? v.found : 0));
													}
													await loadDream();
												} finally {
													setBusy(false);
												}
											})();
										},
										children: "巡检"
									}),
									dreamLine !== "" && (0, react_jsx_runtime.jsxs)("div", {
										className: advance_pane_module_css_default.dreamLine,
										"data-testid": "yzj-advance-dream-status",
										children: [(0, react_jsx_runtime.jsx)("span", { children: dreamLine }), (0, react_jsx_runtime.jsxs)("span", {
											className: advance_pane_module_css_default.dreamActions,
											children: [dreamEntries.length > 0 && (0, react_jsx_runtime.jsxs)("button", {
												type: "button",
												className: advance_pane_module_css_default.patrolBtn,
												"data-testid": "yzj-advance-dream-pool",
												title: "查看蓄水池待抽取信号",
												onClick: () => {
													setDreamPoolOpen(true);
												},
												children: ["池 ", dreamEntries.length]
											}), (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: waterReached ? advance_pane_module_css_default.primary : advance_pane_module_css_default.patrolBtn,
												"data-testid": "yzj-advance-dream-now",
												disabled: busy,
												title: "新建会话直接开始 Dream 抽取",
												onClick: () => {
													runDream();
												},
												children: "Dream 抽取"
											})]
										})]
									})
								]
							}),
							queueGroup("decide", "待我决定", queues.decide, "当前没有待决定事项", "AI 会在需要你的权限时再提醒"),
							queueGroup("review", "待我验收", queues.review, "暂无待验收结果", "只有业务标准满足后才进入这里"),
							queueGroup("watch", "我关注的推进", queues.watch, "还没有推进事项", "先从真实工作目标开始"),
							queues.closed.length > 0 && (0, react_jsx_runtime.jsxs)("div", {
								className: advance_pane_module_css_default.closedZone,
								children: [(0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: advance_pane_module_css_default.closedToggle,
									"data-testid": "yzj-advance-closed-toggle",
									onClick: () => {
										setShowClosed(!showClosed);
									},
									children: [
										showClosed ? "▾" : "▸",
										" 已结束 ",
										queues.closed.length
									]
								}), showClosed && queues.closed.map((item) => {
									const id = asString$4(item.advanceId);
									return (0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										className: activeId === id ? `${advance_pane_module_css_default.queueItem} ${advance_pane_module_css_default.queueItemOn}` : advance_pane_module_css_default.queueItem,
										"data-testid": `yzj-advance-item-${id}`,
										onClick: () => {
											setShowAll(false);
											setActiveId(id);
										},
										children: [(0, react_jsx_runtime.jsxs)("span", {
											className: advance_pane_module_css_default.queueTitle,
											children: [(0, react_jsx_runtime.jsx)("i", { className: `${advance_pane_module_css_default.dot} ${advance_pane_module_css_default[`dot_${dotToneOf(asString$4(item.stage))}`]}` }), (0, react_jsx_runtime.jsx)("b", { children: asString$4(item.title) === "" ? "(无标题)" : asString$4(item.title) })]
										}), (0, react_jsx_runtime.jsxs)("p", { children: [STAGE_LABEL[asString$4(item.stage)] ?? asString$4(item.stage), asString$4(item.latest) === "" ? "" : ` · ${asString$4(item.latest)}`] })]
									}, id);
								})]
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: advance_pane_module_css_default.primary,
								"data-testid": "yzj-advance-start",
								onClick: () => {
									setStartOpen(true);
								},
								children: "发起推进"
							})
						]
					}),
					(0, react_jsx_runtime.jsxs)("main", {
						className: advance_pane_module_css_default.detail,
						"data-testid": "yzj-advance-detail",
						children: [board.loading || detailLoading ? (0, react_jsx_runtime.jsx)("div", {
							className: advance_pane_module_css_default.hint,
							children: "加载中…"
						}) : detail === null ? (0, react_jsx_runtime.jsxs)("div", {
							className: advance_pane_module_css_default.hero,
							children: [
								(0, react_jsx_runtime.jsx)("h2", { children: "这件事还没有开始推进" }),
								(0, react_jsx_runtime.jsx)("p", { children: "发起后，AI 会持续跟进目标、工作进展、变化和结果；遇到影响较大的问题时再请你决定。" }),
								(0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: advance_pane_module_css_default.primary,
									"data-testid": "yzj-advance-start-hero",
									onClick: () => {
										setStartOpen(true);
									},
									children: "发起推进"
								})
							]
						}) : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							(0, react_jsx_runtime.jsxs)("header", {
								className: advance_pane_module_css_default.detailHead,
								children: [
									(0, react_jsx_runtime.jsxs)("div", {
										className: advance_pane_module_css_default.kicker,
										children: [
											(0, react_jsx_runtime.jsx)("span", { children: asString$4(detail.item.advanceId) }),
											(0, react_jsx_runtime.jsx)("span", {
												className: `${advance_pane_module_css_default.stagePill} ${advance_pane_module_css_default[`pill_${dotToneOf(stage)}`]}`,
												"data-testid": "yzj-advance-stage",
												children: STAGE_LABEL[stage] ?? stage
											}),
											(0, react_jsx_runtime.jsxs)("div", {
												className: advance_pane_module_css_default.kickerActions,
												children: [(0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: advance_pane_module_css_default.feedbackBtn,
													"data-testid": "yzj-advance-feedback",
													onClick: () => {
														setAdvanceFeedback({
															advanceId: asString$4(detail.item.advanceId),
															title: asString$4(detail.item.title),
															goal: asString$4(detail.item.goal),
															stage
														});
														setWorkbenchDomain("im");
													},
													children: "现在反馈"
												}), (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: advance_pane_module_css_default.feedbackBtn,
													"data-testid": "yzj-advance-review",
													onClick: () => {
														const advanceId = asString$4(detail.item.advanceId);
														const title = asString$4(detail.item.title);
														setAdvanceAskDraft({
															advanceId,
															title,
															text: reviewAskText(advanceId, title),
															kind: "review"
														});
														setWorkbenchDomain("im");
													},
													children: "请 AI 验收"
												})]
											})
										]
									}),
									(0, react_jsx_runtime.jsx)("h1", { children: asString$4(detail.item.title) }),
									(0, react_jsx_runtime.jsxs)("div", {
										className: advance_pane_module_css_default.meta,
										children: [
											asString$4(detail.item.assignee) !== "" && (0, react_jsx_runtime.jsxs)("span", { children: ["结果承担者：", asString$4(detail.item.assignee)] }),
											asString$4(detail.item.targetDate) !== "" && (0, react_jsx_runtime.jsxs)("span", { children: ["目标日期：", asString$4(detail.item.targetDate)] }),
											board.libraryLink !== "" && (0, react_jsx_runtime.jsx)("a", {
												href: board.libraryLink,
												target: "_blank",
												rel: "noreferrer",
												children: "推进库 ↗"
											})
										]
									})
								]
							}),
							metrics.length > 0 && (0, react_jsx_runtime.jsxs)("section", {
								className: advance_pane_module_css_default.section,
								children: [(0, react_jsx_runtime.jsxs)("div", {
									className: advance_pane_module_css_default.sectionHead,
									children: [(0, react_jsx_runtime.jsx)("h2", { children: "成功指标" }), (0, react_jsx_runtime.jsx)("small", { children: "这几项达标 = 推进达到目标" })]
								}), (0, react_jsx_runtime.jsx)("div", {
									className: advance_pane_module_css_default.metrics,
									"data-testid": "yzj-advance-metrics",
									children: metrics.map((metric, index) => (0, react_jsx_runtime.jsxs)("div", {
										className: advance_pane_module_css_default.metric,
										children: [
											(0, react_jsx_runtime.jsx)("span", { children: asString$4(metric.name) }),
											(0, react_jsx_runtime.jsx)("b", { children: asString$4(metric.current) === "" ? "—" : asString$4(metric.current) }),
											asString$4(metric.target) !== "" && (0, react_jsx_runtime.jsxs)("small", { children: ["目标 ", asString$4(metric.target)] })
										]
									}, `m${index}`))
								})]
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: advance_pane_module_css_default.detailGrid,
								children: [(0, react_jsx_runtime.jsxs)("div", {
									className: advance_pane_module_css_default.main,
									children: [
										(0, react_jsx_runtime.jsxs)("section", {
											className: advance_pane_module_css_default.section,
											children: [
												(0, react_jsx_runtime.jsxs)("div", {
													className: advance_pane_module_css_default.sectionHead,
													children: [(0, react_jsx_runtime.jsx)("h2", { children: "这件事要做到什么" }), (0, react_jsx_runtime.jsx)("small", { children: "当前有效目标" })]
												}),
												(0, react_jsx_runtime.jsx)("p", {
													className: advance_pane_module_css_default.goal,
													children: asString$4(detail.item.goal) === "" ? "（尚未填写目标）" : asString$4(detail.item.goal)
												}),
												asString$4(detail.item.background) !== "" && (0, react_jsx_runtime.jsxs)("p", {
													className: advance_pane_module_css_default.background,
													children: ["背景：", asString$4(detail.item.background)]
												})
											]
										}),
										(0, react_jsx_runtime.jsxs)("section", {
											className: advance_pane_module_css_default.section,
											"data-testid": "yzj-advance-decision",
											children: [
												(0, react_jsx_runtime.jsxs)("div", {
													className: advance_pane_module_css_default.sectionHead,
													children: [(0, react_jsx_runtime.jsx)("h2", { children: stage === "decision-needed" ? "需要你决定" : stage === "ready-for-review" ? "是否已经达到目标" : "接下来会怎样" }), (0, react_jsx_runtime.jsx)("small", { children: stage === "decision-needed" || stage === "ready-for-review" ? "等待你处理" : "AI 持续跟进" })]
												}),
												stage === "decision-needed" && (0, react_jsx_runtime.jsxs)("div", {
													className: advance_pane_module_css_default.decision,
													children: [latestDecision !== void 0 && decisionParsed !== void 0 ? (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
														(0, react_jsx_runtime.jsx)("h3", { children: asString$4(latestDecision.summary) }),
														decisionParsed.rest !== "" && (0, react_jsx_runtime.jsx)("p", { children: decisionParsed.rest }),
														decisionParsed.actions.length > 0 && (0, react_jsx_runtime.jsx)("div", {
															className: advance_pane_module_css_default.actions,
															"data-testid": "yzj-advance-actions",
															children: decisionParsed.actions.map((action, actionIndex) => {
																const key = `${asString$4(latestDecision.entryId) || "latest"}:${actionIndex}`;
																const done = doneActions.has(key) || doneActions.has(`${action.kind}|${action.text}`);
																return (0, react_jsx_runtime.jsxs)("div", {
																	className: advance_pane_module_css_default.actionRow,
																	children: [(0, react_jsx_runtime.jsx)("button", {
																		type: "button",
																		className: advance_pane_module_css_default.optionBtn,
																		"data-testid": `yzj-advance-action-${actionIndex}`,
																		disabled: busy || done,
																		onClick: () => {
																			runAction(key, action);
																		},
																		children: done ? `✓ ${ACTION_DONE[action.kind]}` : `${ACTION_LABEL[action.kind]}：${action.text}`
																	}), action.kind === "im" && !done && imDraft?.key === key && (0, react_jsx_runtime.jsxs)("span", {
																		className: advance_pane_module_css_default.imDraft,
																		children: [(0, react_jsx_runtime.jsx)("textarea", {
																			value: imDraft.text,
																			"data-testid": "yzj-advance-action-draft",
																			onChange: (event) => {
																				setImDraft({
																					key,
																					text: event.target.value
																				});
																			}
																		}), (0, react_jsx_runtime.jsxs)("span", {
																			className: advance_pane_module_css_default.imDraftFoot,
																			children: [(0, react_jsx_runtime.jsxs)("button", {
																				type: "button",
																				className: advance_pane_module_css_default.primary,
																				"data-testid": "yzj-advance-action-send",
																				disabled: busy || imDraft.text.trim() === "",
																				onClick: () => {
																					sendActionMessage();
																				},
																				children: ["发到 ", imGroupLabel]
																			}), (0, react_jsx_runtime.jsx)("button", {
																				type: "button",
																				className: advance_pane_module_css_default.linkBtn,
																				onClick: () => {
																					setImDraft(null);
																				},
																				children: "取消"
																			})]
																		})]
																	})]
																}, key);
															})
														}),
														decisionParsed.options.length > 0 && (0, react_jsx_runtime.jsx)("div", {
															className: advance_pane_module_css_default.options,
															"data-testid": "yzj-advance-options",
															children: decisionParsed.options.map((option, index) => (0, react_jsx_runtime.jsxs)("button", {
																type: "button",
																className: advance_pane_module_css_default.optionBtn,
																"data-testid": `yzj-advance-option-${index + 1}`,
																disabled: busy,
																onClick: () => {
																	judge("confirm_advance", option);
																},
																children: [
																	"选项",
																	index + 1,
																	"：",
																	option
																]
															}, `o${index}`))
														}),
														decisionParsed.impact !== "" && (0, react_jsx_runtime.jsxs)("p", {
															className: advance_pane_module_css_default.impact,
															children: ["影响：", decisionParsed.impact]
														}),
														decisionParsed.mergedFrom !== "" && (0, react_jsx_runtime.jsxs)("p", {
															className: advance_pane_module_css_default.quiet,
															children: [
																"此卡综合了 ",
																decisionParsed.mergedFrom,
																" 的未决内容（旧卡留在时间线）。"
															]
														})
													] }) : latestDriver === void 0 ? (0, react_jsx_runtime.jsx)("p", {
														className: advance_pane_module_css_default.quiet,
														children: "等待你处理。"
													}) : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
														(0, react_jsx_runtime.jsx)("h3", { children: asString$4(latestDriver.summary) }),
														asString$4(latestDriver.detail) !== "" && (0, react_jsx_runtime.jsx)("p", { children: asString$4(latestDriver.detail) }),
														(0, react_jsx_runtime.jsx)("p", {
															className: advance_pane_module_css_default.quiet,
															children: "这条变化把事项推到了「待你决定」，但没有带上建议动作；你可以直接拍板，或「回到对话继续聊」让它补齐建议。"
														})
													] }), (0, react_jsx_runtime.jsxs)("div", {
														className: hasDynamic ? `${advance_pane_module_css_default.verbs} ${advance_pane_module_css_default.verbsSecondary}` : advance_pane_module_css_default.verbs,
														"data-testid": "yzj-advance-verbs",
														children: [
															(0, react_jsx_runtime.jsx)("button", {
																type: "button",
																"data-testid": "yzj-advance-judge-confirm_condition",
																disabled: busy,
																onClick: () => {
																	judge("confirm_condition");
																},
																children: "确认新条件"
															}),
															(0, react_jsx_runtime.jsx)("button", {
																type: "button",
																className: hasDynamic ? void 0 : advance_pane_module_css_default.primary,
																"data-testid": "yzj-advance-judge-confirm_advance",
																disabled: busy,
																onClick: () => {
																	judge("confirm_advance");
																},
																children: "确认推进"
															}),
															(0, react_jsx_runtime.jsx)("button", {
																type: "button",
																"data-testid": "yzj-advance-judge-ignore",
																disabled: busy,
																onClick: () => {
																	judge("ignore");
																},
																children: "忽略"
															}),
															(0, react_jsx_runtime.jsx)("button", {
																type: "button",
																"data-testid": "yzj-advance-decision-chat",
																disabled: busy,
																onClick: () => {
																	chatAboutDecision(asString$4((latestDecision ?? latestDriver)?.summary));
																},
																children: "回到对话继续聊"
															})
														]
													})]
												}),
												stage === "ready-for-review" && (0, react_jsx_runtime.jsxs)("div", {
													className: advance_pane_module_css_default.decision,
													children: [(0, react_jsx_runtime.jsx)("p", { children: "新的结果已经准备好，等待你确认。" }), (0, react_jsx_runtime.jsxs)("div", {
														className: advance_pane_module_css_default.verbs,
														children: [(0, react_jsx_runtime.jsx)("button", {
															type: "button",
															"data-testid": "yzj-advance-judge-reject",
															disabled: busy,
															onClick: () => {
																judge("reject");
															},
															children: "退回补充"
														}), (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															className: advance_pane_module_css_default.primary,
															"data-testid": "yzj-advance-judge-accept",
															disabled: busy,
															onClick: () => {
																judge("accept");
															},
															children: "确认达到目标"
														})]
													})]
												}),
												(stage === "running" || stage === "updated" || stage === "draft") && (0, react_jsx_runtime.jsx)("p", {
													className: advance_pane_module_css_default.quiet,
													children: "AI 正在跟进，当前不需要你处理；有目标变化或材料不足时会再提醒。"
												}),
												(stage === "completed" || stage === "cancelled") && (0, react_jsx_runtime.jsxs)("div", {
													className: advance_pane_module_css_default.decision,
													"data-testid": "yzj-advance-terminal",
													children: [(0, react_jsx_runtime.jsxs)("p", {
														className: advance_pane_module_css_default.quiet,
														children: [stage === "completed" ? "这次推进已经完成。" : "这次推进已中止。", "复盘可以沉淀回知识库：目标演化、关键决策、偏差与证据链。"]
													}), (0, react_jsx_runtime.jsx)("div", {
														className: advance_pane_module_css_default.verbs,
														children: (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															"data-testid": "yzj-advance-export-review",
															disabled: busy,
															onClick: () => {
																const advanceId = asString$4(detail.item.advanceId);
																const title = asString$4(detail.item.title);
																setAdvanceAskDraft({
																	advanceId,
																	title,
																	text: exportReviewAskText(advanceId, title),
																	kind: "export"
																});
																setWorkbenchDomain("im");
															},
															children: "沉淀复盘"
														})
													})]
												}),
												stage !== "completed" && stage !== "cancelled" && (0, react_jsx_runtime.jsx)("div", {
													className: advance_pane_module_css_default.verbs,
													children: (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														"data-testid": "yzj-advance-judge-cancel",
														disabled: busy,
														onClick: () => {
															if (!cancelArmed) {
																setCancelArmed(true);
																return;
															}
															setCancelArmed(false);
															judge("cancel");
														},
														children: cancelArmed ? "确认中止？再点一次" : "中止推进"
													})
												})
											]
										}),
										(0, react_jsx_runtime.jsxs)("section", {
											className: advance_pane_module_css_default.section,
											"data-testid": "yzj-advance-timeline",
											children: [
												(0, react_jsx_runtime.jsxs)("div", {
													className: advance_pane_module_css_default.sectionHead,
													children: [(0, react_jsx_runtime.jsx)("h2", { children: "推进演进" }), (0, react_jsx_runtime.jsx)("small", { children: "每条事元可溯源到原始信息" })]
												}),
												detail.entries.length === 0 ? (0, react_jsx_runtime.jsx)("p", {
													className: advance_pane_module_css_default.quiet,
													children: "还没有事元记录。"
												}) : (0, react_jsx_runtime.jsx)("div", {
													className: advance_pane_module_css_default.timeline,
													children: [...detail.entries].reverse().map((entry, index) => {
														const entryId = asString$4(entry.entryId) || `e${index}`;
														const expanded = expandedEntries.has(entryId);
														const refList = [...new Set(asArray$4(entry.refs).map((ref) => asString$4(ref)).filter((ref) => ref !== ""))];
														const toggleExpanded = () => {
															const next = new Set(expandedEntries);
															if (next.has(entryId)) next.delete(entryId);
															else next.add(entryId);
															setExpandedEntries(next);
														};
														return (0, react_jsx_runtime.jsxs)("div", {
															className: advance_pane_module_css_default.timeItem,
															children: [
																(0, react_jsx_runtime.jsx)("span", {
																	className: advance_pane_module_css_default.time,
																	title: asString$4(entry.at),
																	children: formatEntryAt(asString$4(entry.at))
																}),
																(0, react_jsx_runtime.jsx)("i", { className: `${advance_pane_module_css_default.mark} ${advance_pane_module_css_default[`mark_${asString$4(entry.tone) || "blue"}`]}` }),
																(0, react_jsx_runtime.jsxs)("div", {
																	className: advance_pane_module_css_default.timeCopy,
																	children: [(0, react_jsx_runtime.jsxs)("button", {
																		type: "button",
																		className: advance_pane_module_css_default.entryHead,
																		"data-testid": `yzj-advance-entry-toggle-${index}`,
																		"aria-expanded": expanded,
																		onClick: toggleExpanded,
																		children: [
																			asString$4(entry.changeType) !== "" && (0, react_jsx_runtime.jsx)("span", {
																				className: `${advance_pane_module_css_default.changeType} ${advance_pane_module_css_default[`changeType_${asString$4(entry.tone) || "blue"}`]}`,
																				children: asString$4(entry.changeType)
																			}),
																			(0, react_jsx_runtime.jsx)("b", {
																				"data-testid": `yzj-advance-entry-${index}`,
																				children: asString$4(entry.summary)
																			}),
																			(0, react_jsx_runtime.jsx)("span", {
																				className: advance_pane_module_css_default.entryCaret,
																				children: expanded ? "收起" : "详情"
																			})
																		]
																	}), expanded && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
																		asString$4(entry.detail) !== "" && (0, react_jsx_runtime.jsx)("p", {
																			className: advance_pane_module_css_default.entryDetail,
																			"data-testid": `yzj-advance-entry-detail-${index}`,
																			children: asString$4(entry.detail)
																		}),
																		refList.length > 0 && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("div", {
																			className: advance_pane_module_css_default.refsHead,
																			children: (0, react_jsx_runtime.jsxs)("span", { children: [
																				"原始信息 ",
																				refList.length,
																				" 条"
																			] })
																		}), (0, react_jsx_runtime.jsx)("span", {
																			className: advance_pane_module_css_default.refs,
																			children: refList.map((raw) => {
																				const id = stripRefPrefix(raw);
																				const kind = refKindOf(asString$4(entry.sourceType), id);
																				const hit = refHits[id];
																				if (hit !== void 0 && hit.content !== "") {
																					if (hit.kind === "doc") {
																						const docHref = refHref("doc", hit.docId ?? id);
																						return (0, react_jsx_runtime.jsxs)("a", {
																							className: advance_pane_module_css_default.refEvent,
																							href: docHref ?? void 0,
																							target: "_blank",
																							rel: "noreferrer",
																							title: `打开文档 ${raw}`,
																							"data-testid": `yzj-advance-ref-${id}`,
																							children: [(0, react_jsx_runtime.jsx)("span", {
																								className: advance_pane_module_css_default.refEventMeta,
																								children: "文档"
																							}), (0, react_jsx_runtime.jsx)("span", {
																								className: advance_pane_module_css_default.refEventBody,
																								children: hit.content
																							})]
																						}, raw);
																					}
																					return (0, react_jsx_runtime.jsxs)("button", {
																						type: "button",
																						className: advance_pane_module_css_default.refEvent,
																						title: `打开来源群消息 ${raw}`,
																						"data-testid": `yzj-advance-ref-${id}`,
																						onClick: () => {
																							jumpToSourceMsg(hit.jumpToken ?? id);
																						},
																						children: [(0, react_jsx_runtime.jsxs)("span", {
																							className: advance_pane_module_css_default.refEventMeta,
																							children: [
																								"[",
																								refStampOf(hit.sentAt),
																								"] ",
																								hit.fromName === "" ? "群消息" : hit.fromName
																							]
																						}), (0, react_jsx_runtime.jsx)("span", {
																							className: advance_pane_module_css_default.refEventBody,
																							children: hit.content
																						})]
																					}, raw);
																				}
																				const href = refHref(kind, id);
																				const label = `${REF_ICON[kind] ?? "源"} ${REF_LABEL[kind] ?? "来源"}`;
																				if (href !== null) return (0, react_jsx_runtime.jsx)("a", {
																					className: advance_pane_module_css_default.refChip,
																					href,
																					target: "_blank",
																					rel: "noreferrer",
																					title: raw,
																					"data-testid": `yzj-advance-ref-${id}`,
																					children: label
																				}, raw);
																				if (kind === "msg") return (0, react_jsx_runtime.jsx)("button", {
																					type: "button",
																					className: advance_pane_module_css_default.refChip,
																					title: `打开来源群消息 ${raw}`,
																					"data-testid": `yzj-advance-ref-${id}`,
																					onClick: () => {
																						jumpToSourceMsg(id);
																					},
																					children: "聊 群消息"
																				}, raw);
																				const domain = kind === "todo" ? "todo" : kind === "event" ? "calendar" : null;
																				if (domain !== null) return (0, react_jsx_runtime.jsx)("button", {
																					type: "button",
																					className: advance_pane_module_css_default.refChip,
																					title: raw,
																					"data-testid": `yzj-advance-ref-${id}`,
																					onClick: () => {
																						setWorkbenchDomain(domain);
																					},
																					children: label
																				}, raw);
																				return (0, react_jsx_runtime.jsx)("span", {
																					className: advance_pane_module_css_default.refChip,
																					title: raw,
																					children: label
																				}, raw);
																			})
																		})] }),
																		(0, react_jsx_runtime.jsxs)("div", {
																			className: advance_pane_module_css_default.timeMeta,
																			children: [(() => {
																				const origin = entryOriginOf(asString$4(entry.sourceType), refList);
																				return (origin !== "" || asString$4(entry.actor) === "user") && (0, react_jsx_runtime.jsx)("span", { children: asString$4(entry.actor) === "user" ? `${origin === "" ? "" : `${origin} · `}你的判断` : `记录自 ${origin}` });
																			})(), (0, react_jsx_runtime.jsx)("button", {
																				type: "button",
																				className: advance_pane_module_css_default.jump,
																				"data-testid": `yzj-advance-entry-discuss-${index}`,
																				title: asString$4(entry.producer) !== "" ? "回到产出这条进展的会话(草稿已复制,粘贴即可)" : "就这条进展问助手(预填到问助手栏)",
																				onClick: () => {
																					openAgentChat(discussAskText(asString$4(detail.item.advanceId), asString$4(detail.item.title), asString$4(entry.at), asString$4(entry.summary)), asString$4(entry.producer));
																				},
																				children: "问助手"
																			})]
																		})
																	] })]
																})
															]
														}, entryId);
													})
												}),
												!showAll && detail.entryTotal > detail.entries.length && (0, react_jsx_runtime.jsxs)("button", {
													type: "button",
													className: advance_pane_module_css_default.more,
													"data-testid": "yzj-advance-show-all",
													onClick: () => {
														setShowAll(true);
													},
													children: [
														"查看全部 ",
														detail.entryTotal,
														" 条"
													]
												})
											]
										})
									]
								}), (0, react_jsx_runtime.jsxs)("aside", {
									className: advance_pane_module_css_default.side,
									"data-testid": "yzj-advance-sources",
									children: [(0, react_jsx_runtime.jsxs)("section", {
										className: advance_pane_module_css_default.section,
										children: [
											(0, react_jsx_runtime.jsxs)("div", {
												className: advance_pane_module_css_default.sectionHead,
												children: [(0, react_jsx_runtime.jsx)("h2", { children: "上下文来源" }), (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: advance_pane_module_css_default.linkBtn,
													"data-testid": "yzj-advance-source-add-open",
													disabled: busy,
													onClick: () => {
														openSourceModal();
													},
													children: "关联来源"
												})]
											}),
											detail.contextSources.length === 0 ? (0, react_jsx_runtime.jsx)("p", {
												className: advance_pane_module_css_default.quiet,
												children: "尚未关联来源；关联群 / 知识库目录后，巡检会按订阅取增量。"
											}) : (0, react_jsx_runtime.jsx)("div", {
												className: advance_pane_module_css_default.subSources,
												"data-testid": "yzj-advance-sources",
												children: detail.contextSources.map((source, index) => {
													const token = asString$4(source.token);
													return (0, react_jsx_runtime.jsxs)("span", {
														className: advance_pane_module_css_default.subChip,
														"data-testid": `yzj-advance-source-${index}`,
														children: [
															(0, react_jsx_runtime.jsx)("i", {
																className: advance_pane_module_css_default.subIcon,
																children: sourceIconOf(token)
															}),
															(0, react_jsx_runtime.jsx)("b", { children: asString$4(source.label) === "" ? token : asString$4(source.label) }),
															(0, react_jsx_runtime.jsx)("em", { children: asString$4(source.addedBy) === "user" ? "你关联" : "AI 关联" }),
															(0, react_jsx_runtime.jsx)("button", {
																type: "button",
																"aria-label": "解除关联",
																"data-testid": `yzj-advance-source-remove-${index}`,
																disabled: busy,
																onClick: () => {
																	removeSource(token);
																},
																children: "×"
															})
														]
													}, token === "" ? `t${index}` : token);
												})
											}),
											pendingRecs.length > 0 && (0, react_jsx_runtime.jsxs)("div", {
												className: advance_pane_module_css_default.subSources,
												"data-testid": "yzj-advance-recommendations",
												children: [(0, react_jsx_runtime.jsx)("p", {
													className: advance_pane_module_css_default.quiet,
													children: "推荐订阅（不点不影响任何事）："
												}), pendingRecs.map((rec) => {
													const safe = rec.token.replaceAll(":", "-");
													return (0, react_jsx_runtime.jsxs)("span", {
														className: advance_pane_module_css_default.subChip,
														"data-testid": `yzj-advance-recommend-${safe}`,
														children: [
															(0, react_jsx_runtime.jsx)("i", {
																className: advance_pane_module_css_default.subIcon,
																children: sourceIconOf(rec.token)
															}),
															(0, react_jsx_runtime.jsx)("b", { children: rec.label }),
															(0, react_jsx_runtime.jsx)("button", {
																type: "button",
																className: advance_pane_module_css_default.linkBtn,
																"data-testid": `yzj-advance-recommend-add-${safe}`,
																disabled: busy,
																onClick: () => {
																	addSource(rec.token, rec.label);
																},
																children: "挂上"
															}),
															(0, react_jsx_runtime.jsx)("button", {
																type: "button",
																className: advance_pane_module_css_default.linkBtn,
																"aria-label": `忽略 ${rec.label}`,
																"data-testid": `yzj-advance-recommend-ignore-${safe}`,
																disabled: busy,
																onClick: () => {
																	ignoreRecommendation(rec);
																},
																children: "×"
															})
														]
													}, rec.token);
												})]
											})
										]
									}), (0, react_jsx_runtime.jsx)("p", {
										className: advance_pane_module_css_default.sideNote,
										children: "AI 推进不建立新的文件库，也不建独立来源库：原始信息挂在事元下（多条信息可能被提炼为一条事元），多个事元折叠出推进演进。"
									})]
								})]
							})
						] }), error !== "" && (0, react_jsx_runtime.jsx)("div", {
							className: advance_pane_module_css_default.error,
							"data-testid": "yzj-advance-error",
							children: error
						})]
					}),
					startOpen && (0, react_jsx_runtime.jsx)("div", {
						className: advance_pane_module_css_default.mask,
						"data-testid": "yzj-advance-start-modal",
						children: (0, react_jsx_runtime.jsxs)("section", {
							className: advance_pane_module_css_default.modal,
							role: "dialog",
							"aria-modal": "true",
							"aria-label": "发起推进",
							children: [
								(0, react_jsx_runtime.jsxs)("header", {
									className: advance_pane_module_css_default.modalHead,
									children: [(0, react_jsx_runtime.jsx)("h2", { children: "发起推进" }), (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										"aria-label": "关闭",
										onClick: () => {
											setStartOpen(false);
										},
										children: "×"
									})]
								}),
								(0, react_jsx_runtime.jsxs)("label", {
									className: advance_pane_module_css_default.fieldLabel,
									children: ["这件事叫什么", (0, react_jsx_runtime.jsx)("input", {
										value: draft.title,
										"data-testid": "yzj-advance-draft-title",
										onChange: (event) => {
											setDraft({
												...draft,
												title: event.target.value
											});
										}
									})]
								}),
								(0, react_jsx_runtime.jsxs)("label", {
									className: advance_pane_module_css_default.fieldLabel,
									children: ["这件事要做到什么", (0, react_jsx_runtime.jsx)("textarea", {
										value: draft.goal,
										"data-testid": "yzj-advance-draft-goal",
										onChange: (event) => {
											setDraft({
												...draft,
												goal: event.target.value
											});
										}
									})]
								}),
								(0, react_jsx_runtime.jsxs)("div", {
									className: advance_pane_module_css_default.fieldRow,
									children: [(0, react_jsx_runtime.jsxs)("label", {
										className: advance_pane_module_css_default.fieldLabel,
										children: ["结果承担者", (0, react_jsx_runtime.jsx)("input", {
											value: draft.assignee,
											onChange: (event) => {
												setDraft({
													...draft,
													assignee: event.target.value
												});
											}
										})]
									}), (0, react_jsx_runtime.jsxs)("label", {
										className: advance_pane_module_css_default.fieldLabel,
										children: ["目标日期", (0, react_jsx_runtime.jsx)("input", {
											value: draft.targetDate,
											placeholder: "2026-08-31",
											onChange: (event) => {
												setDraft({
													...draft,
													targetDate: event.target.value
												});
											}
										})]
									})]
								}),
								(0, react_jsx_runtime.jsxs)("label", {
									className: advance_pane_module_css_default.fieldLabel,
									children: ["达到什么结果才算完成（每行一条「指标名: 当前 / 目标」）", (0, react_jsx_runtime.jsx)("textarea", {
										value: draft.metrics,
										onChange: (event) => {
											setDraft({
												...draft,
												metrics: event.target.value
											});
										}
									})]
								}),
								(0, react_jsx_runtime.jsxs)("label", {
									className: advance_pane_module_css_default.fieldLabel,
									children: ["任务背景", (0, react_jsx_runtime.jsx)("textarea", {
										value: draft.background,
										onChange: (event) => {
											setDraft({
												...draft,
												background: event.target.value
											});
										}
									})]
								}),
								(0, react_jsx_runtime.jsxs)("footer", {
									className: advance_pane_module_css_default.modalFoot,
									children: [(0, react_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => {
											setStartOpen(false);
										},
										children: "关闭"
									}), (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: advance_pane_module_css_default.primary,
										"data-testid": "yzj-advance-create",
										disabled: busy || draft.title.trim() === "",
										onClick: () => {
											create();
										},
										children: busy ? "创建中…" : "开始推进"
									})]
								})
							]
						})
					}),
					dreamPoolOpen && (0, react_jsx_runtime.jsx)("div", {
						className: advance_pane_module_css_default.mask,
						"data-testid": "yzj-advance-dream-modal",
						children: (0, react_jsx_runtime.jsxs)("section", {
							className: advance_pane_module_css_default.modal,
							role: "dialog",
							"aria-modal": "true",
							"aria-label": "蓄水池待抽取",
							children: [
								(0, react_jsx_runtime.jsxs)("header", {
									className: advance_pane_module_css_default.modalHead,
									children: [(0, react_jsx_runtime.jsxs)("h2", { children: [
										"蓄水池 · 待抽取 ",
										dreamEntries.length,
										" 条"
									] }), (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										"aria-label": "关闭",
										onClick: () => {
											setDreamPoolOpen(false);
										},
										children: "×"
									})]
								}),
								(0, react_jsx_runtime.jsx)("p", {
									className: advance_pane_module_css_default.sideNote,
									children: "巡检发现的增量信号在池中等待 Dream 抽取：有价值的落成事元/建议卡，无关的跳过；抽过的标记完成不删除（审计面）。"
								}),
								(0, react_jsx_runtime.jsxs)("div", {
									className: advance_pane_module_css_default.dreamPoolList,
									"data-testid": "yzj-advance-dream-entries",
									children: [dreamEntries.map((entry) => (0, react_jsx_runtime.jsxs)("div", {
										className: advance_pane_module_css_default.dreamPoolRow,
										"data-testid": `yzj-advance-dream-entry-${entry.id}`,
										children: [(0, react_jsx_runtime.jsxs)("span", {
											className: advance_pane_module_css_default.dreamPoolMeta,
											children: [
												"[",
												entry.sendTime,
												"] ",
												entry.channel,
												" · ",
												entry.refId
											]
										}), (0, react_jsx_runtime.jsx)("span", { children: entry.content })]
									}, entry.id)), dreamEntries.length === 0 && (0, react_jsx_runtime.jsx)("p", {
										className: advance_pane_module_css_default.sideNote,
										children: "池是空的。"
									})]
								})
							]
						})
					}),
					sourceModalOpen && (0, react_jsx_runtime.jsx)("div", {
						className: advance_pane_module_css_default.mask,
						"data-testid": "yzj-advance-source-modal",
						children: (0, react_jsx_runtime.jsxs)("section", {
							className: advance_pane_module_css_default.modal,
							role: "dialog",
							"aria-modal": "true",
							"aria-label": "关联来源",
							children: [
								(0, react_jsx_runtime.jsxs)("header", {
									className: advance_pane_module_css_default.modalHead,
									children: [(0, react_jsx_runtime.jsx)("h2", { children: "关联来源" }), (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										"aria-label": "关闭",
										onClick: () => {
											setSourceModalOpen(false);
										},
										children: "×"
									})]
								}),
								(0, react_jsx_runtime.jsx)("p", {
									className: advance_pane_module_css_default.sideNote,
									children: "IM 群与知识库整库都是持续渠道：巡检按订阅取增量（群=新消息，整库=库内新增/更新文档）。关联即订阅，解除不删事元。"
								}),
								groupOptions.length > 0 && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("p", {
									className: advance_pane_module_css_default.subGroupLabel,
									children: "IM 群"
								}), (0, react_jsx_runtime.jsx)("div", {
									className: advance_pane_module_css_default.subGroupList,
									"data-testid": "yzj-advance-source-groups",
									children: groupOptions.map((group) => {
										const groupId = asString$4(group.groupId);
										return (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											"data-testid": `yzj-advance-source-group-${groupId}`,
											disabled: busy,
											onClick: () => {
												addSource(`im:${groupId}`, asString$4(group.groupName));
											},
											children: asString$4(group.groupName) === "" ? groupId : asString$4(group.groupName)
										}, groupId);
									})
								})] }),
								dirOptions.length > 0 && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("p", {
									className: advance_pane_module_css_default.subGroupLabel,
									children: "知识库（整库订阅）"
								}), (0, react_jsx_runtime.jsx)("div", {
									className: advance_pane_module_css_default.subGroupList,
									"data-testid": "yzj-advance-source-dirs",
									children: dirOptions.map((dir) => (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										"data-testid": `yzj-advance-source-dir-${dir.id}`,
										disabled: busy,
										onClick: () => {
											addSource(`dir:${dir.id}`, dir.label);
										},
										children: dir.label
									}, dir.id))
								})] }),
								(0, react_jsx_runtime.jsx)("footer", {
									className: advance_pane_module_css_default.modalFoot,
									children: (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => {
											setSourceModalOpen(false);
										},
										children: "关闭"
									})
								})
							]
						})
					})
				]
			});
		}
		//#endregion
		//#region lib/types/client/room-shell.js
		/**
		* Group-room workbench shell (docs/spec/group-room-topics.md §9 / v1.16):
		* page tabs + conversation list | timeline, or a non-IM domain pane.
		* The official conversation.view seat stays one slot; this splits internally.
		*/
		function asRecord$5(value) {
			return typeof value === "object" && value !== null ? value : {};
		}
		/**
		* Two-column group-room canvas. Clicking a list row switches groupId
		* (R24) — it does not open a DSH session. Overlay mode (R27) paints
		* without a hanger session. Slot mode still refuses non-`yzj-home-*`.
		*/
		function YzjRoomShell(props) {
			const isRoom = props.overlay === true || props.sessionId.startsWith("yzj-home-");
			const [domain, setDomain] = (0, react.useState)(getWorkbenchDomain);
			const [activeGroupId, setActiveGroupId] = (0, react.useState)(() => peekImSeat()?.groupId || cachedRoomGroupId(props.sessionId));
			(0, react.useEffect)(() => subscribeWorkbenchDomain(() => {
				setDomain(getWorkbenchDomain());
			}), []);
			(0, react.useEffect)(() => {
				if (!isRoom || props.actions === void 0 || props.panel === void 0) return;
				return registerPanelController(props.actions, props.panel);
			}, [
				isRoom,
				props.actions,
				props.panel
			]);
			(0, react.useEffect)(() => {
				if (!isRoom) return;
				const seated = peekImSeat()?.groupId ?? "";
				if (seated !== "") {
					setActiveGroupId(seated);
					return;
				}
				const cached = cachedRoomGroupId(props.sessionId);
				if (cached !== "") setActiveGroupId(cached);
				if (!props.sessionId.startsWith("yzj-home-")) return;
				let cancelled = false;
				const load = async () => {
					if (peekImSeat()?.groupId) return;
					const result = await props.homeFused(props.sessionId);
					if (cancelled || !result.ok) return;
					const binding = asRecord$5(asRecord$5(result.value).binding);
					const groupId = typeof binding.yzjConversationId === "string" ? binding.yzjConversationId : "";
					if (groupId === "" || peekImSeat()?.groupId) return;
					setActiveGroupId(groupId);
					rememberImSeat({
						groupId,
						sessionId: props.sessionId
					});
				};
				load();
				return () => {
					cancelled = true;
				};
			}, [isRoom, props.sessionId]);
			const [focusAnchor, setFocusAnchor] = (0, react.useState)("");
			(0, react.useEffect)(() => subscribeImGroupFocus((target) => {
				setActiveGroupId(target.groupId);
				setFocusAnchor(target.anchorMsgId ?? "");
				rememberImSeat({
					groupId: target.groupId,
					sessionId: props.sessionId
				});
			}), []);
			const selectGroup = (groupId, groupName) => {
				setActiveGroupId(groupId);
				setFocusAnchor("");
				rememberImSeat({
					groupId,
					sessionId: props.sessionId,
					...groupName === void 0 || groupName === "" ? {} : { groupName }
				});
			};
			if (!isRoom) return null;
			const domainPane = domain === "advance" && props.panel !== void 0 ? (0, react_jsx_runtime.jsx)(YzjAdvancePane, { inject: props.panel }) : domain !== "im" && domain !== "advance" && props.panel !== void 0 && props.useStore !== void 0 && props.actions !== void 0 ? (0, react_jsx_runtime.jsx)(YzjDomainWorkbench, {
				domain,
				panel: props.panel,
				useStore: props.useStore,
				actions: props.actions
			}) : null;
			return (0, react_jsx_runtime.jsxs)("div", {
				className: home_module_css_default.roomShell,
				"data-testid": "yzj-room-shell",
				"data-workbench-domain": domain,
				"data-conversation-composer-overlay": "",
				children: [(0, react_jsx_runtime.jsx)("div", {
					className: home_module_css_default.pageTabs,
					role: "tablist",
					"aria-label": "云之家",
					"data-testid": "yzj-workbench-tabs",
					children: WORKBENCH_TABS.map((tab) => (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						role: "tab",
						"aria-selected": domain === tab.domain,
						className: domain === tab.domain ? `${home_module_css_default.pageTab} ${home_module_css_default.pageTabOn}` : home_module_css_default.pageTab,
						"data-testid": `yzj-workbench-tab-${tab.id}`,
						onClick: () => {
							setWorkbenchDomain(tab.domain);
						},
						children: tab.label
					}, tab.id))
				}), domainPane !== null ? (0, react_jsx_runtime.jsxs)("div", {
					className: home_module_css_default.roomMain,
					children: [props.authStatus !== void 0 && props.authLogin !== void 0 && (0, react_jsx_runtime.jsx)(YzjLoginBanner, {
						authStatus: props.authStatus,
						authLogin: props.authLogin,
						compact: true
					}), domainPane]
				}) : (0, react_jsx_runtime.jsxs)("div", {
					className: home_module_css_default.pageBody,
					children: [(0, react_jsx_runtime.jsx)(YzjConvList, {
						sessionId: props.sessionId,
						...activeGroupId === "" ? {} : { activeGroupId },
						homeNav: props.homeNav,
						...props.fetchGroups === void 0 ? {} : { fetchGroups: props.fetchGroups },
						...props.authStatus === void 0 ? {} : { authStatus: props.authStatus },
						...props.authLogin === void 0 ? {} : { authLogin: props.authLogin },
						onSelectGroup: (row) => {
							selectGroup(row.groupId, row.groupName);
						}
					}), (0, react_jsx_runtime.jsx)(YzjFusedView, {
						sessionId: props.sessionId,
						...activeGroupId === "" ? {} : { groupId: activeGroupId },
						...focusAnchor === "" ? {} : { anchorMsgId: focusAnchor },
						homeFused: props.homeFused,
						homeBackfill: props.homeBackfill,
						...props.homeTopicOpen === void 0 ? {} : { homeTopicOpen: props.homeTopicOpen },
						...props.homeTopicLens === void 0 ? {} : { homeTopicLens: props.homeTopicLens },
						...props.homeTopicAsk === void 0 ? {} : { homeTopicAsk: props.homeTopicAsk },
						...props.focusBoundSession === void 0 ? {} : { focusBoundSession: props.focusBoundSession },
						...props.fetchFileData === void 0 ? {} : { fetchFileData: props.fetchFileData },
						...props.fetchContact === void 0 ? {} : { fetchContact: props.fetchContact },
						...props.panel === void 0 ? {} : {
							advanceState: props.panel.advanceState,
							advanceFeed: props.panel.advanceFeed
						}
					})]
				})]
			});
		}
		//#endregion
		//#region lib/types/client/im-compose.js
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
		//#endregion
		//#region lib/types/client/room-composer.js
		/**
		* Group-room composer takeover (`conversation.composer` chain).
		* yzj-home-* sessions: one verb = 发进群, covering the CLI send surface
		* (reply / @ / @all / emoji / image / file). Approval/question entries keep
		* higher or equal priority and still cover the bar when they match.
		* The visible face portals into the timeline host from `composer-host.ts`
		* (pitfall-019): do not cache getElementById across workbench remounts.
		*/
		/** Collapse the official composer seat so a hidden takeover leaves no gap. */
		function collapseComposerSeat(on) {
			const seat = document.querySelector("[data-composer-seat]");
			if (seat === null) return () => {};
			if (!on) return () => {};
			seat.style.setProperty("height", "0");
			seat.style.setProperty("min-height", "0");
			seat.style.setProperty("overflow", "hidden");
			seat.style.setProperty("padding", "0");
			return () => {
				seat.style.removeProperty("height");
				seat.style.removeProperty("min-height");
				seat.style.removeProperty("overflow");
				seat.style.removeProperty("padding");
			};
		}
		function asRecord$4(value) {
			return typeof value === "object" && value !== null ? value : {};
		}
		function speakersOf(value) {
			const items = asRecord$4(value).items;
			if (!Array.isArray(items)) return [];
			const byId = /* @__PURE__ */ new Map();
			for (const item of items) {
				const row = asRecord$4(asRecord$4(item).entry);
				const openId = typeof row.fromOpenId === "string" ? row.fromOpenId : "";
				const name = typeof row.fromName === "string" ? row.fromName : "";
				if (openId === "" || row.isSelf === true) continue;
				if (!byId.has(openId) && name !== "") byId.set(openId, name);
			}
			return [...byId.entries()].map(([openId, name]) => ({
				openId,
				name
			}));
		}
		function useComposerHost() {
			const [host, setHost] = (0, react.useState)(() => getRoomComposerHost());
			(0, react.useEffect)(() => subscribeRoomComposerHost((node) => {
				setHost(node !== null && node.isConnected ? node : null);
			}), []);
			return host !== null && host.isConnected ? host : null;
		}
		/**
		* DSH-shaped composer card: draft + attach tools + circular send.
		* Placeholder names the group; the send control is an icon (aria 发进群).
		*/
		function YzjRoomComposer(props) {
			const standalone = props.standalone === true;
			const [localDraft, setLocalDraft] = (0, react.useState)("");
			const draft = standalone || props.useInput === void 0 ? localDraft : props.useInput((s) => s.draft);
			const setDraft = (value) => {
				if (standalone || props.inputActions === void 0) setLocalDraft(value);
				else props.inputActions.setDraft(value);
			};
			const hangerName = props.useSessions === void 0 ? "群" : props.useSessions((s) => {
				const title = (s.byId?.[props.sessionId])?.displayTitle;
				return typeof title === "string" && title !== "" && title !== "群房间" && title !== "私聊房间" ? title : "群";
			});
			const [seat, setSeat] = (0, react.useState)(peekImSeat);
			(0, react.useEffect)(() => subscribeImSeat(() => {
				setSeat(peekImSeat());
			}), []);
			const groupId = seat?.groupId ?? "";
			const groupName = seat?.groupName !== void 0 && seat.groupName !== "" ? seat.groupName : hangerName;
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)("");
			const [replyTo, setReplyTo] = (0, react.useState)(null);
			const [emojiOpen, setEmojiOpen] = (0, react.useState)(false);
			const [speakers, setSpeakers] = (0, react.useState)([]);
			const imageRef = (0, react.useRef)(null);
			const fileRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => onRoomReplyRequest((target) => {
				setReplyTo(target);
				setError("");
			}), []);
			(0, react.useEffect)(() => {
				let cancelled = false;
				const load = async () => {
					if (props.homeFused === void 0) return;
					if (props.sessionId === "" && groupId === "") return;
					const result = await props.homeFused(props.sessionId, groupId === "" ? void 0 : groupId);
					if (cancelled || !result.ok) return;
					setSpeakers(speakersOf(result.value));
				};
				load();
				const timer = window.setInterval(() => {
					load();
				}, 4e3);
				return () => {
					cancelled = true;
					window.clearInterval(timer);
				};
			}, [props.sessionId, groupId]);
			const sendText = async (content, extra) => {
				const mentions = resolveAtMentions(content, speakers);
				if (!mentions.ok) {
					setError(mentions.error);
					return;
				}
				setBusy(true);
				setError("");
				const replyMsgId = replyTo?.msgId;
				const result = await props.homeSend(props.sessionId, content, {
					...extra,
					...groupId === "" ? {} : { groupId },
					...replyMsgId === void 0 ? {} : { replyMsgId },
					...mentions.atOpenIds.length === 0 ? {} : { atOpenIds: [...mentions.atOpenIds] },
					...mentions.atAll ? { atAll: true } : {}
				});
				setBusy(false);
				if (!result.ok) {
					setError(result.error.message);
					return;
				}
				setDraft("");
				setReplyTo(null);
				setEmojiOpen(false);
			};
			const send = async () => {
				const text = draft.trim();
				if (text === "" || busy) return;
				await sendText(text);
			};
			const onKeyDown = (event) => {
				if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
				event.preventDefault();
				event.stopPropagation();
				send();
			};
			const pickFile = (kind, file) => {
				if (file === void 0) return;
				if (props.uploadFile === void 0) {
					setError("上传不可用");
					return;
				}
				if (file.size > 25165824) {
					setError("文件超过 24MB，请压缩后重试");
					return;
				}
				const reader = new FileReader();
				reader.onload = () => {
					const base64 = typeof reader.result === "string" ? reader.result.split(",")[1] ?? "" : "";
					if (base64 === "") return;
					setBusy(true);
					setError("");
					props.uploadFile?.(file.name, base64, file.size).then(async (result) => {
						if (!result.ok) {
							setError(result.error.message);
							return;
						}
						const payload = asRecord$4(result.value);
						const fileId = typeof payload.fileId === "string" && payload.fileId !== "" ? payload.fileId : typeof payload.file_id === "string" ? payload.file_id : typeof payload.id === "string" ? payload.id : "";
						if (fileId === "") {
							setError("上传失败：未返回文件 ID");
							return;
						}
						if (kind === "image") {
							const text = draft.trim();
							const content = text === "" ? "[图片]" : `${text}\n[图片]`;
							await sendText(content, {
								msgType: "richText",
								images: [fileId]
							});
							return;
						}
						const sent = await props.homeSend(props.sessionId, void 0, {
							msgType: "file",
							fileId
						});
						if (!sent.ok) {
							setError(sent.error.message);
							return;
						}
						setReplyTo(null);
					}).finally(() => setBusy(false));
				};
				reader.readAsDataURL(file);
			};
			const host = useComposerHost();
			const hide = useWorkbenchDomain() !== "im";
			(0, react.useEffect)(() => {
				if (standalone) return;
				return collapseComposerSeat(true);
			}, [standalone]);
			if (hide) return (0, react_jsx_runtime.jsx)("span", {
				className: home_module_css_default.roomComposerSeat,
				"data-testid": "yzj-room-composer-seat",
				hidden: true
			});
			const face = (0, react_jsx_runtime.jsxs)("div", {
				className: home_module_css_default.roomComposer,
				"data-testid": "yzj-room-composer",
				children: [
					replyTo !== null && (0, react_jsx_runtime.jsxs)("div", {
						className: home_module_css_default.roomReplyBar,
						"data-testid": "yzj-room-reply",
						children: [(0, react_jsx_runtime.jsxs)("span", {
							className: home_module_css_default.roomReplyText,
							children: ["回复：", replyTo.summary]
						}), (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: home_module_css_default.roomReplyCancel,
							onClick: () => setReplyTo(null),
							children: "取消"
						})]
					}),
					emojiOpen && (0, react_jsx_runtime.jsx)("div", {
						className: home_module_css_default.roomEmojiPanel,
						role: "listbox",
						"aria-label": "表情",
						children: EMOJI_LIST.map((emoji) => (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: home_module_css_default.roomEmojiBtn,
							onClick: () => {
								setDraft(`${draft}${emoji}`);
								setEmojiOpen(false);
							},
							children: emoji
						}, emoji))
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: home_module_css_default.roomComposerCard,
						children: [(0, react_jsx_runtime.jsx)("textarea", {
							className: home_module_css_default.roomComposerInput,
							value: draft,
							placeholder: `发到 ${groupName}…`,
							rows: 2,
							"aria-label": `发到 ${groupName}`,
							onChange: (event) => setDraft(event.target.value),
							onKeyDown
						}), (0, react_jsx_runtime.jsxs)("div", {
							className: home_module_css_default.roomComposerBar,
							children: [(0, react_jsx_runtime.jsxs)("div", {
								className: home_module_css_default.roomComposerTools,
								children: [
									(0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: home_module_css_default.roomToolBtn,
										onClick: () => setEmojiOpen((open) => !open),
										children: "表情"
									}),
									(0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: home_module_css_default.roomToolBtn,
										onClick: () => imageRef.current?.click(),
										children: "图片"
									}),
									(0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: home_module_css_default.roomToolBtn,
										onClick: () => fileRef.current?.click(),
										children: "文件"
									}),
									(0, react_jsx_runtime.jsx)("input", {
										ref: imageRef,
										type: "file",
										accept: "image/*",
										hidden: true,
										onChange: (event) => {
											pickFile("image", event.target.files?.[0]);
											event.target.value = "";
										}
									}),
									(0, react_jsx_runtime.jsx)("input", {
										ref: fileRef,
										type: "file",
										hidden: true,
										onChange: (event) => {
											pickFile("file", event.target.files?.[0]);
											event.target.value = "";
										}
									})
								]
							}), (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: home_module_css_default.roomSendCircle,
								"data-testid": "yzj-send-to-group",
								"aria-label": "发进群",
								disabled: busy || draft.trim() === "",
								onClick: () => {
									send();
								},
								children: (0, react_jsx_runtime.jsx)("svg", {
									width: "16",
									height: "16",
									viewBox: "0 0 16 16",
									fill: "none",
									"aria-hidden": "true",
									children: (0, react_jsx_runtime.jsx)("path", {
										d: "M8 12.5V3.5M8 3.5L3.5 8M8 3.5L12.5 8",
										stroke: "currentColor",
										strokeWidth: "1.6",
										strokeLinecap: "round",
										strokeLinejoin: "round"
									})
								})
							})]
						})]
					}),
					error !== "" && (0, react_jsx_runtime.jsx)("p", {
						role: "alert",
						children: error
					})
				]
			});
			if (host === null) return face;
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("span", {
				className: home_module_css_default.roomComposerSeat,
				"data-testid": "yzj-room-composer-seat",
				hidden: true
			}), (0, react_dom.createPortal)(face, host)] });
		}
		//#endregion
		//#region \0dsh-css:/Users/guoxinshan/dev/dsh-yzj/packages/ui-yzj/src/client/overlay.module.css.mjs
		const css$1 = "[data-pane=conversation],[class*=centerCol]{position:relative}[data-dsh-yzj-view]{z-index:60;background:var(--dsw-alias-bg-base);min-height:0;display:none;position:absolute;inset:0}html[data-dsh-yzj-active]:not([data-dsh-taskboard-active]):not([data-dsh-ssh-active]) [data-dsh-yzj-view]{flex-direction:column;min-height:0;display:flex}html[data-dsh-yzj-active]:not([data-dsh-taskboard-active]):not([data-dsh-ssh-active]) [data-pane=conversation]>:not([data-dsh-yzj-view]),html[data-dsh-yzj-active]:not([data-dsh-taskboard-active]):not([data-dsh-ssh-active]) [class*=centerCol]>:not([data-dsh-yzj-view]){display:none!important}.d0ZwzW_entryHost{flex:none;width:100%}";
		const tagId$1 = "@dsh-yzj/bundle/ui-yzj/overlay.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@dsh-yzj/bundle/ui-yzj";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var overlay_module_css_default = { "entryHost": "d0ZwzW_entryHost" };
		//#endregion
		//#region lib/types/client/workbench-mount.js
		const VIEW_ATTR = "data-dsh-yzj-view";
		const COLUMN_SELECTOR = "[data-pane=\"conversation\"], [class*=\"centerCol\"]";
		function conversationColumn() {
			return document.querySelector(COLUMN_SELECTOR) ?? void 0;
		}
		/**
		* Append the cover into the center column and keep it alive across shell
		* remounts. Returns the disposer.
		*/
		function useStoreOf(store) {
			return function useStore(selector) {
				return (0, react.useSyncExternalStore)(store.subscribe, () => selector(store.getSnapshot()), () => selector(store.getSnapshot()));
			};
		}
		function mountWorkbench(panel) {
			const store = createYzjStore().create();
			const useStore = useStoreOf(store);
			let root;
			let container;
			const paint = () => {
				if (container === void 0 || root === void 0) return;
				const sessionId = "";
				root.render((0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(YzjRoomShell, {
					overlay: true,
					sessionId,
					homeFused: (id, groupId) => panel.homeFused?.(id, groupId) ?? Promise.resolve({
						ok: false,
						error: { message: "homeFused unavailable" }
					}),
					homeBackfill: (id, opts) => panel.homeBackfill?.(id, opts) ?? Promise.resolve({
						ok: false,
						error: { message: "homeBackfill unavailable" }
					}),
					homeNav: () => panel.homeNav?.() ?? Promise.resolve({
						ok: false,
						error: { message: "homeNav unavailable" }
					}),
					fetchGroups: (limit, page) => panel.fetchGroups(limit, page),
					authStatus: () => panel.authStatus(),
					authLogin: () => panel.authLogin(),
					homeTopicOpen: (input) => panel.homeTopicOpen?.(input) ?? Promise.resolve({
						ok: false,
						error: { message: "homeTopicOpen unavailable" }
					}),
					homeTopicLens: (id) => panel.homeTopicLens?.(id) ?? Promise.resolve({
						ok: false,
						error: { message: "homeTopicLens unavailable" }
					}),
					homeTopicAsk: (id, text) => panel.homeTopicAsk?.(id, text) ?? Promise.resolve({
						ok: false,
						error: { message: "homeTopicAsk unavailable" }
					}),
					...panel.focusBoundSession === void 0 ? {} : { focusBoundSession: panel.focusBoundSession },
					fetchFileData: panel.fetchFileData,
					fetchContact: panel.fetchContact,
					panel,
					useStore,
					actions: store.actions
				}), (0, react_jsx_runtime.jsx)(YzjRoomComposer, {
					standalone: true,
					sessionId,
					homeSend: (id, content, opts) => panel.homeSend?.(id, content, opts) ?? Promise.resolve({
						ok: false,
						error: { message: "homeSend unavailable" }
					}),
					uploadFile: panel.uploadFile,
					homeFused: (id, groupId) => panel.homeFused?.(id, groupId) ?? Promise.resolve({
						ok: false,
						error: { message: "homeFused unavailable" }
					}),
					fetchContact: panel.fetchContact
				})] }));
			};
			const ensure = () => {
				if (container !== void 0) {
					if (!document.body.contains(container)) {
						container = void 0;
						root?.unmount();
						root = void 0;
					} else return;
				}
				const column = conversationColumn();
				if (column === void 0) return;
				container = document.createElement("div");
				container.setAttribute(VIEW_ATTR, "");
				container.dataset.testid = "yzj-workbench-overlay";
				column.appendChild(container);
				root = (0, react_dom_client.createRoot)(container);
				paint();
			};
			const wait = new MutationObserver(() => {
				ensure();
			});
			wait.observe(document.body, {
				childList: true,
				subtree: true
			});
			const offOpen = subscribeWorkbenchOpen(() => {
				ensure();
			});
			const offDismiss = bindWorkbenchDismissal();
			if (isWorkbenchOpen()) ensure();
			else ensure();
			return () => {
				wait.disconnect();
				offOpen();
				offDismiss();
				root?.unmount();
				root = void 0;
				container?.remove();
				container = void 0;
			};
		}
		//#endregion
		//#region lib/types/client/group-space.js
		/**
		* 云之家 sidebar entry (R27 cover + R31 single entry).
		* One 「云之家」button opens the center-column cover — it does not
		* focus a hanger session and does not switch domains. Domain switching
		* lives on the workbench tablist. Robot status lives in 设置 → 云之家.
		*/
		/**
		* 云之家 dock (injected under New Session). Compact glyph when the
		* sidebar is a rail.
		*/
		function YzjYunzhijiaDock(props) {
			const [hint, setHint] = (0, react.useState)("");
			const [open, setOpen] = (0, react.useState)(isWorkbenchOpen);
			(0, react.useEffect)(() => subscribeWorkbenchOpen(() => {
				setOpen(isWorkbenchOpen());
			}), []);
			(0, react.useEffect)(() => {
				let cancelled = false;
				props.homeNav().then((nav) => {
					if (cancelled || !nav.ok) return;
					const first = parseNavRooms(nav.value)[0];
					if (first === void 0) return;
					rememberImSeat({
						groupId: first.groupId,
						sessionId: first.sessionId,
						...first.groupName === "" ? {} : { groupName: first.groupName }
					});
				});
				return () => {
					cancelled = true;
				};
			}, []);
			const onHome = () => {
				setHint("");
				openWorkbench();
			};
			return (0, react_jsx_runtime.jsxs)("nav", {
				className: props.wide ? home_module_css_default.yzjDock : home_module_css_default.yzjDockNarrow,
				"data-testid": "yzj-group-space",
				"aria-label": "云之家",
				children: [(0, react_jsx_runtime.jsx)("div", {
					className: home_module_css_default.yzjDockEntries,
					children: (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: `${home_module_css_default.yzjDockEntry} ${open ? home_module_css_default.yzjDockEntryActive : ""}`,
						title: "云之家",
						"aria-pressed": open,
						"data-testid": "yzj-dock-home",
						onClick: onHome,
						children: [!props.wide && (0, react_jsx_runtime.jsx)("span", {
							className: home_module_css_default.yzjDockMark,
							"aria-hidden": "true",
							children: "云"
						}), props.wide && (0, react_jsx_runtime.jsx)("span", {
							className: home_module_css_default.yzjDockLabel,
							children: "云之家"
						})]
					})
				}), props.wide && hint !== "" && (0, react_jsx_runtime.jsx)("p", {
					className: home_module_css_default.yzjDockHint,
					children: hint
				})]
			});
		}
		//#endregion
		//#region lib/types/client/sidebar-entry.js
		/**
		* Inject the 云之家 dock after the official New Session button (R27).
		* Official sidebar has no upper list slot; this follows webuiall task-board.
		*/
		const ENTRY_ATTR = "data-dsh-yzj-entry";
		function sidebarRoot() {
			const column = document.querySelector("[data-pane=\"sidebar\"], [class*=\"sidebarCol\"]");
			if (column === null) return void 0;
			return column.querySelector("[class*=\"logoRow\"]")?.parentElement ?? column.firstElementChild;
		}
		function newSessionButton(root) {
			const nested = root.querySelector("button[class*=\"newSession\"]");
			if (nested !== null) return nested;
			for (const child of root.children) if (child.tagName === "BUTTON") return child;
		}
		function sidebarIsWide() {
			return (document.querySelector("[data-pane=\"sidebar\"], [class*=\"sidebarCol\"]")?.getBoundingClientRect().width ?? 0) > 80;
		}
		/**
		* Mount the dock into the sidebar chrome. Returns the disposer.
		*/
		function mountSidebarEntry(inject) {
			if (typeof document !== "undefined" && document.querySelector(`[${ENTRY_ATTR}]`) !== null) return () => {};
			const host = document.createElement("div");
			host.setAttribute(ENTRY_ATTR, "");
			host.className = overlay_module_css_default.entryHost ?? "";
			const reactRoot = (0, react_dom_client.createRoot)(host);
			let wide = sidebarIsWide();
			const paint = () => {
				reactRoot.render((0, react_jsx_runtime.jsx)(YzjYunzhijiaDock, {
					wide,
					...inject
				}));
			};
			const place = (root) => {
				const button = newSessionButton(root);
				if (button === void 0) return false;
				const row = button.closest("[class*=\"logoRow\"]");
				const base = row !== null && row.parentElement === root ? row : button;
				if (host.parentElement !== root) root.insertBefore(host, base.nextElementSibling);
				return true;
			};
			let root;
			const tryPlace = () => {
				if (root !== void 0 && !root.isConnected) root = void 0;
				root ??= sidebarRoot();
				if (root === void 0) return;
				if (place(root)) paint();
			};
			const wait = new MutationObserver(() => {
				wide = sidebarIsWide();
				tryPlace();
				if (root !== void 0 && !root.contains(host)) tryPlace();
			});
			wait.observe(document.body, {
				childList: true,
				subtree: true
			});
			tryPlace();
			return () => {
				wait.disconnect();
				reactRoot.unmount();
				host.remove();
			};
		}
		//#endregion
		//#region lib/types/client/context.js
		/** In-memory ref → context cache, keyed by a stable ref string. */
		const contextCache = /* @__PURE__ */ new Map();
		function yzjRefKey(ref) {
			return `${ref.kind}:${ref.id}`;
		}
		function asRecord$3(value) {
			return typeof value === "object" && value !== null ? value : {};
		}
		function asArray$3(value) {
			return Array.isArray(value) ? value : [];
		}
		function asString$3(value) {
			return typeof value === "string" ? value : "";
		}
		function asTagsOf(value) {
			return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
		}
		/** Compact clock for event ms timestamps. */
		function clock(ms) {
			if (typeof ms !== "number") return "";
			const date = new Date(ms);
			const pad = (n) => String(n).padStart(2, "0");
			return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
		}
		/** Extract plain text from a doc block subtree (heading/paragraph/code/text). */
		function blockText(node) {
			const record = asRecord$3(node);
			const parts = [];
			const own = asString$3(record.content);
			if (own !== "") parts.push(own);
			const childArray = asArray$3(record.childNodes ?? record.children);
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
				message: "消息",
				todo: "待办"
			}[ref.kind] ?? ref.kind}】${ref.title}`);
			try {
				switch (ref.kind) {
					case "workspace": {
						const result = await inject.fetchWorkspace(ref.id);
						if (result.ok) {
							const ws = asRecord$3(result.value);
							lines.push(`类型：${asString$3(ws.bizType) === "" ? "知识库" : asString$3(ws.bizType)} · 文档 ${typeof ws.docCount === "number" ? ws.docCount : "?"} 篇 · 成员 ${typeof ws.memberCount === "number" ? ws.memberCount : "?"} 人`);
							if (asString$3(ws.description) !== "") lines.push(`简介：${asString$3(ws.description)}`);
						}
						break;
					}
					case "doc": {
						const [infoResult, blocksResult] = await Promise.all([inject.fetchDoc(ref.id), inject.fetchDocBlocks(ref.id)]);
						if (infoResult.ok) {
							const node = asRecord$3(infoResult.value);
							const suffix = asString$3(node.fileSuffix);
							lines.push(`类型：${suffix === "dbt" ? "多维表格" : "在线文档"} · 更新 ${asString$3(node.updateTime).slice(0, 10)} · 创建人 ${asString$3(node.creatorName) === "" ? "未知" : asString$3(node.creatorName)}`);
							const link = asString$3(node.openWebUrl);
							if (link !== "") lines.push(`链接：${link}`);
						}
						if (blocksResult.ok) {
							const blocksValue = asRecord$3(blocksResult.value);
							const excerpt = asArray$3(asRecord$3(blocksValue.data).blocks ?? blocksValue.blocks).slice(0, 10).map(blockText).filter((text) => text !== "").join(" ");
							if (excerpt !== "") {
								lines.push(`内容摘要：${excerpt.length > 500 ? `${excerpt.slice(0, 500)}…` : excerpt}`);
								lines.push("（内容为摘要，完整内容可用 yzj_doc_block_list / yzj_doc_get 获取）");
							}
						}
						if (infoResult.ok && asString$3(asRecord$3(infoResult.value).fileSuffix) === "dbt") {
							const sheetResult = await inject.fetchSheet(ref.id);
							if (sheetResult.ok) {
								const sheetValue = asRecord$3(sheetResult.value);
								const tableLines = asArray$3(sheetValue.sheets ?? asRecord$3(sheetValue.data).sheets).slice(0, 5).map((item) => {
									const table = asRecord$3(item);
									const fields = asArray$3(table.fields).map((field) => asString$3(asRecord$3(field).name)).filter((name) => name !== "");
									return `- ${asString$3(table.name)}${fields.length === 0 ? "" : `：${fields.join(" / ")}`}`;
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
							const preview = [...asArray$3(asRecord$3(result.value).list)].reverse().slice(0, 6).map((item) => {
								const message = asRecord$3(item);
								const time = asString$3(message.sendTime).slice(5, 16);
								const body = asString$3(message.content);
								return `[${time}] ${body === "" ? "(文件/图片消息)" : body.replace(/\s+/g, " ").slice(0, 60)}`;
							});
							if (preview.length > 0) lines.push(`最近消息：\n${preview.join("\n")}`);
						}
						break;
					}
					case "event": {
						const result = await inject.fetchEvent(ref.id);
						if (result.ok) {
							const event = asRecord$3(result.value);
							const span = [clock(event.startDate), clock(event.endDate)].filter((part) => part !== "").join(" → ");
							lines.push(`时间：${span === "" ? "未知" : span}`);
							if (asString$3(event.personName) !== "") lines.push(`组织者：${asString$3(event.personName)}`);
							if (asString$3(event.content) !== "") lines.push(`描述：${asString$3(event.content).slice(0, 200)}`);
						}
						break;
					}
					case "contact": {
						const result = await inject.fetchContact(ref.id);
						if (result.ok) {
							const user = asRecord$3(asArray$3(result.value)[0] ?? result.value);
							const parts = [
								asString$3(user.department),
								asString$3(user.jobTitle),
								asString$3(user.jobNo) === "" ? "" : `工号 ${asString$3(user.jobNo)}`
							];
							lines.push(parts.filter((part) => part !== "").join(" · "));
						}
						break;
					}
					case "todo": {
						const result = await inject.todoState();
						if (result.ok) {
							const value = asRecord$3(result.value);
							const todo = asArray$3(value.todos).map(asRecord$3).find((item) => asString$3(item.todoId) === ref.id);
							if (todo !== void 0) {
								const parts = [`状态：${asString$3(todo.status)}`];
								if (asString$3(todo.ddl) !== "") parts.push(`DDL：${asString$3(todo.ddl)}${todo.overdue === true ? "（已逾期）" : ""}`);
								if (asString$3(todo.priority) !== "") parts.push(`优先级：${asString$3(todo.priority)}`);
								if (asTagsOf(todo.tags).length > 0) parts.push(`标签：${asTagsOf(todo.tags).map((tag) => `#${tag}`).join(" ")}`);
								if (asString$3(todo.assignee) !== "") parts.push(`负责人：${asString$3(todo.assignee)}`);
								lines.push(parts.join(" · "));
								const log = asString$3(todo.log);
								if (log !== "") {
									const tail = log.split("\n").slice(-3);
									lines.push(`推进日志（最近）：\n${tail.map((line) => `- ${line}`).join("\n")}`);
								}
								const library = asRecord$3(value.library);
								if (asString$3(library.link) !== "") lines.push(`任务库：${asString$3(library.link)}`);
								lines.push("（可用 yzj_todo_list / yzj_todo_update 跟进；标签可用于聚合筛选）");
							} else lines.push("（该待办已不存在，可能已被删除；不要编造内容）");
						} else lines.push("（待办库暂不可读，可让用户确认任务库状态）");
						break;
					}
					case "message": {
						const groupId = asString$3(ref.group);
						if (groupId !== "") {
							lines.push(`所属会话：${groupId}`);
							const result = await inject.fetchMessages(groupId, 20, {
								type: "new",
								msgId: ref.id
							});
							if (result.ok) {
								const hit = asArray$3(asRecord$3(result.value).list).find((item) => asString$3(asRecord$3(item).msgId) === ref.id);
								if (hit !== void 0) {
									const message = asRecord$3(hit);
									const body = asString$3(message.content);
									const from = asString$3(message.fromOpenId);
									lines.push(`发送人：${from === "" ? "(未知)" : from}`);
									lines.push(`原文：${body === "" ? `(${asString$3(message.msgType) === "" ? "消息" : asString$3(message.msgType)})` : body}`);
								} else lines.push(`内容（快照，原文可能已变）：${ref.title}`);
							} else lines.push(`内容（快照，原文可能已变）：${ref.title}`);
						} else lines.push(`内容（快照，原文可能已变）：${ref.title}`);
						if (asString$3(ref.sub) !== "") lines.push(`时间：${asString$3(ref.sub)}`);
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
		//#region lib/types/client/input-source.js
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
			message: "消息",
			todo: "待办"
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
			message: "✉️",
			todo: "🗒️"
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
		function asRecord$2(value) {
			return typeof value === "object" && value !== null ? value : {};
		}
		function asArray$2(value) {
			return Array.isArray(value) ? value : [];
		}
		function asString$2(value) {
			return typeof value === "string" ? value : "";
		}
		/** Warm the catalog once per session: workspaces + recent groups + first-level docs. */
		function ensureWarm(cache, inject) {
			if (cache.warm !== null) return cache.warm;
			cache.warm = Promise.all([inject.fetchWorkspaces().then((result) => {
				if (result.ok) cache.workspaces = asArray$2(result.value);
			}).catch(() => {}), inject.fetchGroups(20).then((result) => {
				if (result.ok) cache.groups = asArray$2(asRecord$2(result.value).list);
			}).catch(() => {})]).then(() => {
				const roots = cache.workspaces.slice(0, 3);
				return Promise.all(roots.map((workspace) => inject.fetchDocs(asString$2(asRecord$2(workspace).id)).then((result) => {
					if (result.ok) cache.docs = [...cache.docs, ...asArray$2(result.value)];
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
				if (result.ok) for (const item of asArray$2(result.value)) {
					const user = asRecord$2(item);
					const name = asString$2(user.name);
					if (name === "") continue;
					const sub = [asString$2(user.department), asString$2(user.jobTitle)].filter((part) => part !== "").join(" · ");
					pushCandidate(cache, out, name, `👤 ${sub === "" ? "联系人" : sub}（仅你有权查看的范围）`, KIND_ICON.contact, {
						kind: "contact",
						id: asString$2(user.oId ?? user.openId),
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
				const group = asRecord$2(item);
				const name = asString$2(group.groupName);
				if (name === "") continue;
				if (q !== "" && !name.toLowerCase().includes(q)) continue;
				const unread = typeof group.unreadCount === "number" ? group.unreadCount : 0;
				pushCandidate(cache, out, name, `💬 会话${unread > 0 ? ` · 未读 ${unread}` : ""}`, KIND_ICON.group, {
					kind: "group",
					id: asString$2(group.groupId),
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
				const node = asRecord$2(item);
				const title = asString$2(node.title);
				if (title === "") continue;
				if (q !== "" && !title.toLowerCase().includes(q)) continue;
				const kindText = asString$2(node.fileSuffix) === "dbt" ? "多维表格" : "文档";
				const updated = asString$2(node.updateTime).slice(0, 10);
				pushCandidate(cache, out, title, `📄 ${kindText}${updated === "" ? "" : ` · 更新 ${updated}`}`, KIND_ICON.doc, {
					kind: "doc",
					id: asString$2(node.id),
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
		//#region \0dsh-css:/Users/guoxinshan/dev/dsh-yzj/packages/ui-yzj/src/client/settings-section.module.css.mjs
		const css = ".ywfNxq_section{flex-direction:column;gap:12px;max-width:760px;display:flex}.ywfNxq_switcher{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:10px;align-self:flex-start;gap:4px;padding:4px;display:inline-flex}.ywfNxq_seg,.ywfNxq_segOn{cursor:pointer;border:none;border-radius:7px;padding:8px 16px;font-family:inherit;font-size:12.5px;line-height:1}.ywfNxq_seg{color:var(--dsw-alias-label-secondary);background:0 0}.ywfNxq_seg:hover{color:var(--dsw-alias-label-primary)}.ywfNxq_segOn{background:var(--dsw-static-deepseek-100);color:var(--dsw-static-deepseek-600);font-weight:600}.ywfNxq_content{flex-direction:column;min-height:420px;display:flex}.ywfNxq_content>*{flex:1;min-height:0;max-height:min(70vh,640px);overflow-y:auto}";
		const tagId = "@dsh-yzj/bundle/ui-yzj/settings-section.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@dsh-yzj/bundle/ui-yzj";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var settings_section_module_css_default = {
			"switcher": "ywfNxq_switcher",
			"segOn": "ywfNxq_segOn",
			"section": "ywfNxq_section",
			"seg": "ywfNxq_seg",
			"content": "ywfNxq_content"
		};
		//#endregion
		//#region lib/types/client/settings-section.js
		/** The 云之家 settings section: login only (robot/memory cards removed, 决策 50). */
		function YzjSettingsSection(props) {
			const face = props;
			return (0, react_jsx_runtime.jsx)("div", {
				className: settings_section_module_css_default.section,
				children: face.authStatus !== void 0 && face.authLogin !== void 0 && (0, react_jsx_runtime.jsx)(YzjLoginBanner, {
					authStatus: face.authStatus,
					authLogin: face.authLogin,
					onLoggedIn: () => {}
				})
			});
		}
		//#endregion
		//#region lib/types/client/rpc.js
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
				todoState: () => call("todo-state", {}),
				ensureTodo: () => call("todo-ensure", {}),
				createTodo: (input) => call("todo-create", {
					title: input.title,
					...input.ddl === void 0 ? {} : { ddl: input.ddl },
					...input.priority === void 0 ? {} : { priority: input.priority },
					...input.tags === void 0 || input.tags.length === 0 ? {} : { tags: input.tags }
				}),
				toggleTodo: (todoId) => call("todo-toggle", { todoId }),
				todoLibraries: () => call("todo-libraries", {}),
				selectTodoLibrary: (docId) => call("todo-select", { docId }),
				ensureTeamTodo: (workspace) => call("todo-ensure-team", { workspace }),
				advanceState: () => call("advance-state", {}),
				advanceGet: (advanceId, entryOffset, entryLimit) => call("advance-get", {
					advanceId,
					...entryOffset === void 0 ? {} : { entryOffset },
					...entryLimit === void 0 ? {} : { entryLimit }
				}),
				advanceCreate: (input) => call("advance-create", {
					title: input.title,
					...input.goal === void 0 || input.goal === "" ? {} : { goal: input.goal },
					...input.background === void 0 || input.background === "" ? {} : { background: input.background },
					...input.metrics === void 0 || input.metrics === "" ? {} : { metrics: input.metrics },
					...input.assignee === void 0 || input.assignee === "" ? {} : { assignee: input.assignee },
					...input.targetDate === void 0 || input.targetDate === "" ? {} : { targetDate: input.targetDate },
					...input.tags === void 0 || input.tags.length === 0 ? {} : { tags: input.tags }
				}),
				advanceJudge: (advanceId, action, note) => call("advance-judge", {
					advanceId,
					action,
					...note === void 0 || note === "" ? {} : { note }
				}),
				advanceEnsure: () => call("advance-ensure", {}),
				advanceScanState: () => call("advance-scan-state", {}),
				advancePatrolNow: () => call("advance-patrol-now", {}),
				imCacheGet: (key) => call("im-cache-get", { key }),
				imCachePut: (key, payload, fetchedAt) => call("im-cache-put", {
					key,
					payload,
					fetchedAt
				}),
				advanceDreamState: () => call("advance-dream-state", {}),
				advanceDreamRun: () => call("advance-dream-run", {}),
				advanceRefLookup: (refs) => call("advance-ref-lookup", { refs }),
				advanceFeed: (input) => call("advance-feed", {
					advanceId: input.advanceId,
					summary: input.summary,
					...input.sourceType === void 0 || input.sourceType === "" ? {} : { sourceType: input.sourceType },
					...input.detail === void 0 || input.detail === "" ? {} : { detail: input.detail },
					...input.refs === void 0 || input.refs.length === 0 ? {} : { refs: input.refs }
				}),
				advanceActionRun: (input) => call("advance-action-run", {
					advanceId: input.advanceId,
					actionKey: input.actionKey,
					kind: input.kind,
					text: input.text,
					...input.fields === void 0 ? {} : { fields: input.fields },
					...input.imGroupId === void 0 ? {} : { imGroupId: input.imGroupId },
					...input.imGroupLabel === void 0 ? {} : { imGroupLabel: input.imGroupLabel }
				}),
				advanceSourceAdd: (advanceId, token, label) => call("advance-source-add", {
					advanceId,
					token,
					...label === void 0 || label === "" ? {} : { label }
				}),
				advanceSourceRemove: (advanceId, token) => call("advance-source-remove", {
					advanceId,
					token
				}),
				fetchWrite: (sessionId, callId) => call("write-list", {
					sessionId,
					callId
				}),
				decideWrite: (writeId, outcome) => call("write-decide", {
					writeId,
					outcome
				}),
				robotStatus: () => call("robot-status", {}),
				robotOverrides: () => call("robot-overrides", {}),
				setRobotOverride: (key, provider, model) => call("robot-override-set", {
					key,
					...provider === void 0 ? {} : { provider },
					...model === void 0 ? {} : { model }
				}),
				deleteRobotOverride: (key) => call("robot-override-delete", { key }),
				robotModels: () => call("robot-models", {}),
				robotDiagnostics: () => call("robot-diagnostics", {}),
				robotNotify: (text, robotIndex) => call("robot-notify", {
					text,
					...robotIndex === void 0 ? {} : { robotIndex }
				}),
				robotContinue: (text, options = {}) => call("robot-continue", {
					text,
					...options.robotIndex === void 0 ? {} : { robotIndex: options.robotIndex },
					...options.groupId === void 0 ? {} : { groupId: options.groupId }
				}),
				robotFork: (sessionId) => call("robot-fork", { sessionId }),
				robotShareList: (groupId, robotIndex) => call("robot-share-list", {
					groupId,
					...robotIndex === void 0 ? {} : { robotIndex }
				}),
				robotShareRead: (groupId, filename, robotIndex) => call("robot-share-read", {
					groupId,
					filename,
					...robotIndex === void 0 ? {} : { robotIndex }
				}),
				robotOpenFolder: (groupId, robotIndex) => call("robot-open-folder", {
					...groupId === void 0 || groupId === "" ? {} : { groupId },
					...robotIndex === void 0 ? {} : { robotIndex }
				}),
				robotShareWrite: (input) => call("robot-share-write", {
					groupId: input.groupId,
					filename: input.filename,
					content: input.content,
					...input.overwrite === void 0 ? {} : { overwrite: input.overwrite },
					...input.robotIndex === void 0 ? {} : { robotIndex: input.robotIndex }
				}),
				robotChannelsSave: (input) => call("robot-channels-save", {
					...input.defaultProvider === void 0 ? {} : { defaultProvider: input.defaultProvider },
					...input.defaultModel === void 0 ? {} : { defaultModel: input.defaultModel },
					robots: input.robots
				}),
				memoryScope: (scope) => call("memory-scope", scope === void 0 ? {} : { scope }),
				memoryLog: (scope) => call("memory-log", scope === void 0 ? {} : { scope }),
				memoryObserve: (content, tags, scope, durable) => call("memory-observe", {
					content,
					...tags === void 0 || tags.length === 0 ? {} : { tags },
					...scope === void 0 ? {} : { scope },
					...durable === void 0 ? {} : { durable }
				}),
				dreamState: () => call("dream-state", {}),
				dreamSet: (partial) => call("dream-set", {
					...partial.enabled === void 0 ? {} : { enabled: partial.enabled },
					...partial.provider === void 0 ? {} : { provider: partial.provider },
					...partial.model === void 0 ? {} : { model: partial.model },
					...partial.dailyAt === void 0 ? {} : { dailyAt: partial.dailyAt }
				}),
				dreamRun: () => call("dream-run", {}),
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
				homeDigest: (sessionId) => call("home-digest", { sessionId }),
				homeHandoff: (groupId, digest) => call("home-handoff", {
					groupId,
					digest
				})
			};
		}
		//#endregion
		//#region lib/types/client/home-focus.js
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
		//#region lib/types/client/write-card.js
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
			"yzj_im_message_send",
			"yzj_file_upload",
			"yzj_file_download",
			"yzj_doc_move",
			"yzj_doc_workspace_create",
			"yzj_doc_create",
			"yzj_doc_rename",
			"yzj_doc_import",
			"yzj_doc_block_insert",
			"yzj_doc_block_update",
			"yzj_sheet_create",
			"yzj_sheet_table_create",
			"yzj_sheet_table_rename",
			"yzj_sheet_record_create",
			"yzj_sheet_record_update",
			"yzj_calendar_event_create",
			"yzj_calendar_event_update",
			"yzj_todo_create",
			"yzj_todo_update",
			"yzj_todo_complete",
			"yzj_advance_create",
			"yzj_advance_feed"
		];
		function asRecord$1(value) {
			return typeof value === "object" && value !== null ? value : {};
		}
		function asString$1(value) {
			return typeof value === "string" ? value : "";
		}
		function asArray$1(value) {
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
			yzj_calendar_event_update: "更新日程",
			yzj_todo_create: "新建待办",
			yzj_todo_update: "更新待办",
			yzj_todo_complete: "完成待办",
			yzj_advance_create: "立项推进事项",
			yzj_advance_feed: "喂入事元"
		};
		/** Domain labels for the card header. */
		const DOMAIN_LABELS = {
			im: "消息",
			doc: "文档",
			kb: "知识库",
			sheet: "多维表格",
			calendar: "日程",
			file: "文件",
			todo: "待办",
			advance: "推进",
			other: "云之家"
		};
		function row(title, sub, key) {
			return (0, react_jsx_runtime.jsxs)("div", {
				className: cards_module_css_default.row,
				children: [(0, react_jsx_runtime.jsx)("div", {
					className: cards_module_css_default.rowTitle,
					children: title
				}), sub !== "" && (0, react_jsx_runtime.jsx)("div", {
					className: cards_module_css_default.rowSub,
					children: sub
				})]
			}, key);
		}
		/** The full draft text a card's 编辑 verb restores into the composer. */
		function writableDraft(record) {
			const args = asRecord$1(record.args);
			const content = asString$1(args.content);
			if (content !== "") return content;
			const text = asString$1(args.text);
			if (text !== "") return text;
			const records = asString$1(args.records);
			if (records !== "") return records;
			const title = asString$1(args.title);
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
				const args = asRecord$1(record.args);
				const out = {};
				const tasks = [];
				const groupId = asString$1(args.groupId);
				if (record.domain === "im" && groupId !== "" && inject.fetchGroups !== void 0) tasks.push(inject.fetchGroups(20).then((result) => {
					if (!result.ok) return;
					const group = asArray$1(asRecord$1(result.value).list).map(asRecord$1).find((g) => asString$1(g.groupId) === groupId);
					if (group !== void 0 && asString$1(group.groupName) !== "") out[groupId] = asString$1(group.groupName);
				}).catch(() => {}));
				const docId = asString$1(args.id);
				if ((record.domain === "doc" || record.domain === "sheet") && docId !== "" && inject.fetchDoc !== void 0) tasks.push(inject.fetchDoc(docId).then((result) => {
					if (!result.ok) return;
					const node = asRecord$1(result.value);
					const title = asString$1(node.title) !== "" ? asString$1(node.title) : asString$1(asRecord$1(node.data).title);
					if (title !== "") out[docId] = title;
				}).catch(() => {}));
				const workspace = asString$1(args.workspace);
				if (workspace !== "" && inject.fetchWorkspaces !== void 0) tasks.push(inject.fetchWorkspaces().then((result) => {
					if (!result.ok) return;
					const ws = asArray$1(result.value).map(asRecord$1).find((w) => asString$1(w.id) === workspace);
					if (ws !== void 0 && asString$1(ws.name) !== "") out[workspace] = asString$1(ws.name);
				}).catch(() => {}));
				if (inject.fetchContact !== void 0) for (const raw of asArray$1(args.organizerOpenIds)) {
					const openId = asString$1(raw);
					if (openId === "") continue;
					tasks.push(inject.fetchContact(openId).then((result) => {
						if (!result.ok) return;
						const name = asString$1(asRecord$1(asArray$1(result.value)[0] ?? {}).name);
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
			const args = asRecord$1(record.args);
			const str = (key) => asString$1(args[key]);
			const list = (key) => asArray$1(args[key]);
			const rows = [];
			const push = (title, sub, key) => {
				rows.push(row(title, sub, key));
			};
			const nameOf = (id, fallback) => id === "" ? "" : names[id] ?? fallback;
			switch (record.domain) {
				case "im": {
					const groupId = str("groupId");
					const toOpenId = str("toOpenId");
					push("目标", groupId !== "" ? `群聊${nameOf(groupId, "") === "" ? "" : ` · ${nameOf(groupId, "")}`}` : `单聊${nameOf(toOpenId, "") === "" ? "" : ` · ${nameOf(toOpenId, "")}`}`, "t");
					push("类型", str("msgType"), "mt");
					const body = str("content") !== "" ? str("content") : str("text");
					if (body !== "") rows.push((0, react_jsx_runtime.jsx)("div", {
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
					push("文档", id === "" ? "新建文档" : nameOf(id, "文档操作"), "id");
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
						const orgNames = orgs.map((id) => names[asString$1(id)] ?? "").filter((name) => name !== "");
						push("组织者", orgNames.length > 0 ? orgNames.join("、") : `${orgs.length} 人`, "o");
					}
					break;
				}
				case "todo": {
					if (str("title") !== "") push("标题", str("title"), "t");
					if (str("todoId") !== "") push("待办", str("todoId"), "id");
					if (record.toolName === "yzj_todo_update" || record.toolName === "yzj_todo_complete") push("操作", record.toolName === "yzj_todo_complete" ? "标记完成" : "更新字段", "op");
					if (str("status") !== "") push("状态", str("status"), "st");
					if (str("assignee") !== "") push("负责人", str("assignee"), "as");
					if (str("ddl") !== "") push("DDL", str("ddl"), "dl");
					if (str("priority") !== "") push("优先级", str("priority"), "pr");
					const tags = list("tags").filter((tag) => typeof tag === "string");
					if (tags.length > 0) push("标签", tags.map((tag) => `#${tag}`).join(" "), "tg");
					if (str("appendLog") !== "") push("备注", str("appendLog").slice(0, 200), "al");
					if (str("note") !== "") push("备注", str("note").slice(0, 200), "nt");
					break;
				}
				case "advance": {
					if (str("title") !== "") push("事项", str("title"), "t");
					if (str("advanceId") !== "") push("事项", str("advanceId"), "id");
					if (str("changeType") !== "") push("变化类型", str("changeType"), "ct");
					if (str("summary") !== "") push("摘要", str("summary").slice(0, 200), "sm");
					if (str("stageTo") !== "") push("阶段", `→ ${str("stageTo")}`, "sg");
					if (str("goal") !== "") push("目标", str("goal").slice(0, 200), "g");
					if (str("metrics") !== "") push("成功指标", str("metrics").split("\n").join("；").slice(0, 200), "mt");
					if (str("background") !== "") push("背景", str("background").slice(0, 200), "bg");
					if (str("assignee") !== "") push("负责人", str("assignee"), "as");
					if (str("targetDate") !== "") push("目标日期", str("targetDate"), "td");
					if (str("detail") !== "") push("变化", str("detail").split("\n").join("；").slice(0, 200), "dt");
					const advanceTags = list("tags").filter((tag) => typeof tag === "string");
					if (advanceTags.length > 0) push("标签", advanceTags.map((tag) => `#${tag}`).join(" "), "tg");
					break;
				}
				case "file":
					if (list("files").length > 0) push("文件", `${list("files").length} 个文件`, "f");
					if (str("name") !== "") push("文件名", str("name"), "n");
					if (str("output") !== "") push("输出", str("output"), "o");
					break;
				default: rows.push((0, react_jsx_runtime.jsx)("div", {
					className: cards_module_css_default.text,
					children: JSON.stringify(args)
				}, "j"));
			}
			return (0, react_jsx_runtime.jsx)("div", {
				className: cards_module_css_default.rows,
				children: rows
			});
		}
		/** Mini-chip labels for referenced refs (decode yzj:... tokens → titles). */
		function refChips(refs) {
			const out = [];
			const list = asArray$1(refs);
			for (let index = 0; index < list.length; index += 1) {
				const raw = asString$1(list[index]);
				if (raw === "") continue;
				const parsed = decodeRef(raw);
				out.push((0, react_jsx_runtime.jsx)("span", {
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
			if (!ready || record === void 0 || record.status === "done" || record.status === "failed") return (0, react_jsx_runtime.jsx)(YzjToolCard, { ...props });
			const strong = record.level === "strong";
			const settled = record.status === "approved";
			const title = WRITE_TITLES[toolName] ?? `云之家 · ${DOMAIN_LABELS[record.domain] ?? "写操作"}`;
			const draft = writableDraft(record);
			const refs = refChips(asRecord$1(record.args).refs);
			const decide = (outcome, next) => {
				props.decideWrite(record.writeId, outcome).then((ok) => {
					if (ok) setRecord({
						...record,
						status: next
					});
				});
			};
			if (record.status === "cancelled") return (0, react_jsx_runtime.jsxs)("div", {
				className: `${cards_module_css_default.card} ${cards_module_css_default.terminalCancel}`,
				role: "status",
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: cards_module_css_default.header,
					children: [(0, react_jsx_runtime.jsx)("span", {
						className: cards_module_css_default.icon,
						children: "✕"
					}), (0, react_jsx_runtime.jsxs)("span", {
						className: cards_module_css_default.title,
						children: [title, " · 已取消"]
					})]
				}), (0, react_jsx_runtime.jsx)("div", {
					className: cards_module_css_default.text,
					children: "未产生任何写动作；「编辑」可把草稿塞回 composer 修改后再发起。"
				})]
			});
			return (0, react_jsx_runtime.jsxs)("div", {
				className: strong ? `${cards_module_css_default.card} ${cards_module_css_default.strongCard}` : cards_module_css_default.card,
				role: "status",
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: cards_module_css_default.header,
						children: [
							(0, react_jsx_runtime.jsx)("span", {
								className: cards_module_css_default.icon,
								children: "☁"
							}),
							(0, react_jsx_runtime.jsx)("span", {
								className: cards_module_css_default.title,
								children: title
							}),
							settled ? (0, react_jsx_runtime.jsx)("span", {
								className: cards_module_css_default.tag,
								children: "执行中"
							}) : (0, react_jsx_runtime.jsx)("span", {
								className: strong ? `${cards_module_css_default.tag} ${cards_module_css_default.tagStrong}` : cards_module_css_default.tag,
								children: strong ? "强确认" : "需确认"
							}),
							(0, react_jsx_runtime.jsx)("span", {
								className: cards_module_css_default.writeId,
								children: record.writeId
							})
						]
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: cards_module_css_default.ccTarget,
						children: [(0, react_jsx_runtime.jsx)(ArgBody, {
							record,
							names
						}), meName !== "" && (0, react_jsx_runtime.jsxs)("div", {
							className: cards_module_css_default.ccIdentity,
							children: [
								"将以你本人（",
								meName,
								"）身份执行"
							]
						})]
					}),
					refs.length > 0 && (0, react_jsx_runtime.jsxs)("div", {
						className: cards_module_css_default.ccRefs,
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: cards_module_css_default.ccRefsLabel,
							children: "关联引用"
						}), refs]
					}),
					settled ? (0, react_jsx_runtime.jsx)("div", {
						className: cards_module_css_default.text,
						children: "已批准，正在执行…"
					}) : (0, react_jsx_runtime.jsxs)("div", {
						className: cards_module_css_default.actions,
						children: [
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: cards_module_css_default.action,
								onClick: () => props.openContext(record),
								children: "查看上下文"
							}),
							draft !== "" && (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: cards_module_css_default.action,
								onClick: () => {
									props.editDraft(draft);
									decide("rejected", "cancelled");
								},
								children: "编辑"
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: cards_module_css_default.action,
								onClick: () => decide("rejected", "cancelled"),
								children: "取消"
							}),
							(0, react_jsx_runtime.jsx)("button", {
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
		//#region lib/types/client/index.js
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
					closeWorkbench();
					const sessions = ctx.sessions;
					if (sessions === void 0 || typeof sessions.open !== "function") return;
					focusBoundSession(sessions, sessionId);
				}
			};
			const openWriteContextFor = (record) => openWriteContext(record);
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "yzj",
				order: 25,
				label: "云之家",
				inject: () => panelInject
			}, YzjSettingsSection));
			ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
				name: "conversation.input.dock",
				id: "yzj-home-chrome",
				order: 100,
				inject: (sessionId) => {
					const actx = scopeOf(ctx, sessionId);
					const draftFace = () => {
						return (actx?.get("conversation"))?.input.for(actx).state.getSnapshot() ?? {
							draft: "",
							draftRev: 0
						};
					};
					return {
						sessionId,
						readDraft: () => draftFace().draft,
						clearDraft: () => {
							if (actx === void 0) return;
							const state = draftFace();
							actx.bail(actx, "slash/input-insert-text", {
								text: "",
								span: {
									start: 0,
									end: state.draft.length,
									draftRev: state.draftRev
								}
							});
						},
						homeBinding: (id) => panelInject.homeBinding?.(id) ?? Promise.resolve({
							ok: false,
							error: { message: "homeBinding unavailable" }
						}),
						homeSend: (id, content) => panelInject.homeSend?.(id, content) ?? Promise.resolve({
							ok: false,
							error: { message: "homeSend unavailable" }
						}),
						homeDigest: (id) => panelInject.homeDigest?.(id) ?? Promise.resolve({
							ok: false,
							error: { message: "homeDigest unavailable" }
						}),
						homeHandoff: (groupId, digest) => panelInject.homeHandoff?.(groupId, digest) ?? Promise.resolve({
							ok: false,
							error: { message: "homeHandoff unavailable" }
						}),
						...panelInject.homeOpen === void 0 ? {} : { homeOpen: panelInject.homeOpen },
						fetchGroups: (limit, page) => panelInject.fetchGroups(limit, page),
						focusBoundSession: panelInject.focusBoundSession
					};
				}
			}, YzjComposerDock));
			ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
				name: "conversation.session.header.actions",
				id: "yzj-session-shell",
				order: -80,
				label: "群聊",
				inject: (sessionId) => ({
					sessionId,
					homeBinding: (id) => panelInject.homeBinding?.(id) ?? Promise.resolve({
						ok: false,
						error: { message: "homeBinding unavailable" }
					}),
					homeOpen: (groupId, title) => panelInject.homeOpen?.(groupId, title) ?? Promise.resolve({
						ok: false,
						error: { message: "homeOpen unavailable" }
					}),
					focusBoundSession: panelInject.focusBoundSession
				})
			}, YzjSessionShell));
			const dockInject = {
				homeNav: () => panelInject.homeNav?.() ?? Promise.resolve({
					ok: false,
					error: { message: "homeNav unavailable" }
				}),
				focusBoundSession: panelInject.focusBoundSession,
				fetchGroups: (limit, page) => panelInject.fetchGroups(limit, page),
				robotStatus: () => panelInject.robotStatus(),
				...panelInject.homeOpen === void 0 ? {} : { homeOpen: panelInject.homeOpen }
			};
			ctx.effect(() => {
				const disposeView = mountWorkbench(panelInject);
				const disposeEntry = mountSidebarEntry(dockInject);
				return () => {
					disposeView();
					disposeEntry();
				};
			}, "ui-yzj: workbench overlay + sidebar entry");
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
				inject: (sessionId) => {
					const actx = scopeOf(ctx, sessionId);
					return {
						fetchWrite: async (callId) => {
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
							return asString(asRecord(asArray(result.value)[0] ?? {}).name);
						},
						fetchGroups: (limit, page) => panelInject.fetchGroups(limit, page),
						fetchWorkspaces: (type) => panelInject.fetchWorkspaces(type),
						fetchDoc: (id) => panelInject.fetchDoc(id),
						fetchContact: (openId) => panelInject.fetchContact(openId)
					};
				}
			}, YzjWriteToolCard));
		}
		/**
		* The 查看上下文 jump (write card): drive the real panel (via the live
		* controller) onto the context the write targets. IM writes anchor on the
		* replied-to message when this write is a reply.
		*/
		function openWriteContext(record) {
			const args = asRecord(record.args);
			if (record.domain === "im") {
				const groupId = asString(args.groupId);
				if (groupId === "") return;
				const replyTarget = asString(args.replyMsgId);
				openPanelTarget({
					kind: "group",
					groupId
				}, replyTarget === "" ? void 0 : replyTarget);
			} else if (record.domain === "doc" || record.domain === "kb" || record.domain === "sheet") {
				const workspace = asString(args.workspace);
				if (workspace !== "") openPanelTarget({
					kind: "workspace",
					workspaceId: workspace
				});
			} else if (record.domain === "todo") openPanelTarget({ kind: "todo" });
			else if (record.domain === "advance") openPanelTarget({ kind: "advance" });
			else openPanelTarget({
				kind: "event",
				event: {
					id: "",
					startDate: 0,
					title: ""
				}
			});
		}
		//#endregion
		exports.apply = apply;
		exports.bindAndFocusGroup = bindAndFocusGroup;
		exports.createYzjPanelInject = createYzjPanelInject;
		exports.createYzjStore = createYzjStore;
		exports.focusBoundSession = focusBoundSession;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map