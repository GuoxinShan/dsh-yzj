# yzj-cli — 云之家插件使用规范（dsh skill）

> 由 `@yunzhijia/cli` 自带 SKILL.md 改造而来：保留 CLI 红线，补充 dsh 插件语境下的使用引导（工具优先、引用 token、确认卡、影子任务库、通知播报）。
> 安装：将本文件所在目录复制到 `~/.agents/skills/yzj-cli/`（harness 的 skill 目录），或在 agent preset 中引用。

## 总则

1. **结构化工具优先**：dsh 会话中优先使用 `yzj_*` 工具（`@dsh-yzj/tool-yzj`），不要用 bash 直调 CLI——工具输出有界、参数受 schema 约束、写操作走统一确认门禁。仅在工具不可用（未登录、CLI 缺失、工具未注册）时按本 skill 用 bash 调用 `yzj-cli` 兜底。
2. **禁止编造 ID**：一切 `groupId` / `openId` / `workspaceId` / `DOC_ID` / `tableId` / `recordId` 必须来自真实查询结果（`yzj_im_group_recent`、`yzj_contact_search`、`yzj_doc_workspace_list`、`yzj_doc_list`、`yzj_sheet_get` 等）。不确定就先查，绝不猜测。
3. **写前先查、写必确认**：所有写工具都会弹确认卡（标准确认 / 强确认两级），由用户点击放行后才真正执行；删除类永远强确认。**任何 `yzj_im_message_send` 必须基于用户明确要求起草，不得主动群发、不得在用户未确认前发送**。
4. **引用即指针**：拖入悬浮窗条目或使用 `@` 菜单产生的云之家引用，以指针形式随消息提交，由 codec 在发送时懒解析为带出处的原文上下文；**不要**把引用内容复制粘贴成无出处文本。

## 工具使用引导

- **找群**：`yzj_im_group_recent`（翻页定位，无搜索）。
- **看消息**：`yzj_im_message_list`（`type: newest/old/new` + `msgId` 锚点分页）。
- **发消息**：`yzj_im_message_send`——先确认目标（群或单聊）、`@` 提及用 `atOpenIds` 且与正文一一对应、`@all` 仅当用户明确要求；**若消息基于拖入/@ 选择的云之家引用起草，把引用 token 原样传入 `refs` 参数**（确认卡会以「关联引用」chips 展示，方便核对出处）；确认卡会展示目标与全文，用户放行后才发出。
- **知识库问答**：`yzj_doc_workspace_list` → `yzj_doc_list` → `yzj_doc_get` / `yzj_doc_block_list`；引用文档时说明出处。
- **写文档**：`yzj_doc_create`（标题勿在正文重复一级标题）→ `yzj_doc_block_insert`；更新用 `yzj_doc_block_update`（blockId 必须来自 `yzj_doc_block_list`）。
- **多维表格**：先 `yzj_sheet_get` 拿真实 `tableId` 与字段名，再 `yzj_sheet_record_list/create/update/delete`；字段值类型遵循 schema。
- **日程**：先 `yzj_contact_search` 解析组织者 openId，再 `yzj_calendar_event_create/update`；删除默认软取消，`hard: true` 为硬删（强确认）。
- **文件**：`yzj_file_upload` 后拿 fileId 发文件消息或插图；`yzj_doc_download_url` 拿临时下载链接。

## 四种 mention 引用

- `@群` → 该群最近消息上下文（codec 自动注入）。
- `@同事` → 共群可见范围内的近期发言（只返回当前用户有权查看的范围，回复中明示边界）。
- `@文档` → 知识库文档正文摘要（完整内容可再调 `yzj_doc_block_list` 获取）。
- `@消息`（拖拽）→ 按 `(groupId, msgId)` 回源原文；回源失败时快照标注「原文可能已变」。

## 通知播报（schedule）

用户要求「定时播报新消息」时：

1. 用 `schedule_create` 创建 `every` 提醒（最小 5 分钟，建议 15 分钟起），提醒词写明关注群与筛选规则（如「拉取需求群最近消息，筛选 @我 或含 deadline 的，播报摘要」）；
2. 到点后 agent 醒来：拉 `yzj_im_group_recent` + 各关注群 `yzj_im_message_list --type new` 增量 → 按用户规则筛选 → 产出带群名与消息摘要的播报文本；
3. 播报中给出可操作的下一步（如「需要我把结论沉淀到知识库吗」）；用户在面板中可自行核对上下文（未读角标、群消息流）。
4. 规则：只读动作（拉取/筛选/播报）无需确认；任何写动作仍走确认卡。

## 待办（yzj_todo_* 工具族，语义化——不要用裸 sheet 工具管理待办）

待办有专属工具族，底层由多维表格「待办任务库」承载（demo 阶段，首用自动开通；后端将切换原生待办，见仓库 docs/待办后端迁移说明.md）。**核心理念是标签聚合：tag 可以是一个项目、一个群组、任何主题**，待办通过 tag 自由聚合（如 `#接口改造 #需求评审群`）。

- **查**：`yzj_todo_list`（`status: open/pending/in_progress/done/overdue/all`，`tag`、`assignee` 过滤，按 DDL 升序）。
- **建**：`yzj_todo_create`（`title` 必填；`tags` 聚合标签；`ddl` `YYYY-MM-DD`；`assignee` 姓名（唯一命中通讯录时自动解析为 openId）；`refs` 传入来源引用 token 会记入日志并在确认卡展示；幂等：传 `todoId` 且已存在时直接返回原记录）。
- **改**：`yzj_todo_update`（状态机：pending→in_progress→done，done→in_progress 重开，in_progress↔pending 打回；pending 不能直接 done——用 complete；推进日志 host 追加，不可改写）。
- **完成**：`yzj_todo_complete`（任意状态→done，幂等）。
- **规则**：id 一律来自 `yzj_todo_list`，不编造；所有写操作过确认卡；刻意**无删除工具**——需要废弃时与用户确认后走 `yzj_sheet_record_delete`（强确认）。
- **团队协作**：待办库有「个人/团队」两种——面板待办 tab 顶部的任务库切换器可一键切换或在某个企业知识库开通团队库（有编辑权限才可选）；**你的写入始终落在用户当前激活的任务库**（切换器上有 👥/📋 徽标）。分派同事用 `assignee`（姓名唯一命中自动解析 openId）；催办=发 IM 给负责人（确认卡）。多人共用同一团队库时为 last-write-wins，推进日志保证可追溯。

面板「待办」tab（用户直写）：分桶（逾期/今天/进行中/待办/已完成）、#tag 聚合过滤、快捷新建（支持 `#标签` 和日期片段）、勾选完成/重开；待办条目可拖入对话交给你跟进。

## 常见问题

- **未登录**：工具返回含 `yzj-cli auth login` 引导的失败摘要；按引导完成浏览器/设备码登录。
- **ID 失效**：返回可操作的重新选择提示，不猜测新 ID。
- **确认卡无人处理**：写操作挂起等待，不产生任何写动作；会话恢复后卡片仍可应答。
