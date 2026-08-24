# 待办功能设计（影子任务库正式化）

> 版本：v1.5（泳道化收口；v1.4 仅角色定位交叉引用）
> 日期：2026-08-24（v1.5）；2026-08-19（v1.4）；2026-08-17（v1.3 及以前）
> v1.5 变更：**待办进入泳道时代**——三态状态机、分桶列表页签与 §4 工具面被 [`todo-swimlane-agent.md`](todo-swimlane-agent.md) 接手为六态泳道（backlog→todo→in_progress→in_review→done + cancelled 终局；blocked 砍为 release 备注 S8）+ claim 工具族 + 面板人动词直写。本文保留 tag 聚合（§0）、实测格式事实（§3/§11）、库切换器与迁移架构的历史记录；状态机/工具契约以泳道文档为准。
> v1.4 变更：**待办回归轻量任务/事元角色**——AI推进看板（三栏目/六态/时间旅程）由独立设计 [`ai-advance-design.md`](ai-advance-design.md) 承载，走独立「推进」第五页签；待办的三态/工具面/面板分桶**全部不变**。一条待办可作为「事元」挂进推进事项（其完成/推进作为事元回流）；早期「todo 升六态 + 日志锚点双写」草案作废（ai-advance-design §9-2）。
> v1.3 变更：用户直写原则（§11.2 决策 5）收进会话家园产品法 [`dsh-home-session.md`](dsh-home-session.md) D9——闸门看发起者；面板待办直写语义不变。
> v1.2 变更：**团队协作库落地**——任务库切换器（个人/团队一键切换 + 企业库按需开通）、agent 写入跟随激活库、浏览器持久化选择、库失效自动回落；验收 15/15（真实企业库开通 + 真实团队库写入 + 切回）。v1.1 变更：**tag 升级为核心理念**（§0）；全部待拍板项已决策（§12）；实测格式修正 schema（负责人 Contact→MultiLineText 降级、标签 MultipleSelect→`#tag` tokens 降级，探针证据见 §11）；实施进度见 §13；迁移架构独立成文 `../migration/todo-backend-migration.md`。
> 定位：把 v1.6 §5.1「影子任务库」从 skill 引导升级为**语义化工具族 + 面板 UX**，作为待办预研的真实使用载体；对齐 v1.6 §8 待办预留（稳定 ID、状态机、幂等创建、deep link、mention 扩展 `type = todo`）。
> 前置事实（2026-08-15 复核）：`@yunzhijia/cli` 0.1.3 仍无待办命令（auth/doc/sheet/calendar/contact/im/file/update 八组）；全部 sheet 记录读写工具已落地且入闸。

## 0. 核心理念：tag 自由聚合（v1.1 新增）

> **2026-08-24 拍板（§11.2 决策 9）**：终态复用云之家 worktask 口径下，本理念**放弃**——官方任务模型无 tag 概念，不再要求外挂或降级承载；「迁移不变量」条随之废止。MVP 现状面（tags 字段、面板标签轨）保留不动，仅不再是终态需求与迁移约束。

**tag 不是分类字段，是聚合维度**：一个 tag 可以是一个待办集、一个群组、一个项目、任何主题。待办通过 tag 自由聚合，不强制层级。

- 存储形态：`#tag` tokens（demo 阶段为文本字段；原生后端应为真正的 tag 模型）；
- 聚合面：`yzj_todo_list(tag=…)`（模型侧）、面板标签轨 chips（用户侧，点击即过滤）、todo chip 回源上下文携带 tags（agent 侧）；
- 迁移不变量：tags 是视图模型一等字段，跨后端语义不变。

## 1. 现状与问题

skill 已交付「影子任务库」章节（表结构 + 使用规则），但执行路径是**裸 sheet 工具调用**：

- 建一条任务 = `yzj_sheet_get`（拿 tableId）→ `yzj_sheet_record_list`（查重）→ `yzj_sheet_record_create`，3~5 次调用，每次 `records` 都是手拼 JSON 字符串；
- 模型每轮都要重新发现表结构与字段名，状态机靠模型自觉，`todo_id` 靠模型生成（无幂等）；
- 无专属 UX：面板看不到任务，拖不进对话，无逾期视图。

结论：裸 sheet 路径验证的是「表格交互」而不是「待办交互」——预研信号被工具摩擦淹没。v1.6 自己写明影子库的目的是「待办的核心交互（创建/分配/推进/查逾期）被真实使用验证」，这要求待办以**一等公民**形态出现。

## 2. 方案选型

| 方案 | 内容 | 判断 |
|---|---|---|
| A. 维持 skill 引导 | 现状，零代码 | 摩擦大、无幂等/状态机保障、预研信号弱；仅作为兜底路径保留 |
| **B. 语义化工具族（推荐）** | 新增 `yzj_todo_*` 工具族，host 侧封装固定 schema + 绑定 + 状态机 + 幂等；面板加「待办」tab；chip 扩展 `kind: todo` | 复用既有 sheet 底座与确认卡框架，边际成本低；工具名即未来原生 API 的迁移缝 |
| C. 等原生待办 API | 等 CLI 增加待办命令 | 0.1.3 无命令、路线图未知；B 的工具缝就是 C 的落点，届时换后端不换契约 |

选 B。核心原则：**schema 对齐未来 API、工具名稳定、后端可替换**——「每条卡点都是一条待办 API 需求」（v1.6 原话）的记录义务不变。

## 3. 固定 schema v1（多维表格「待办任务库」）

| 字段 | 类型 | 说明 |
|---|---|---|
| `todo_id` | MultiLineText | 稳定 ID，**host 生成**（`T-YYYYMMDD-NNN`），创建时查重保证幂等 |
| `标题` | MultiLineText | 任务标题（必填） |
| `状态` | SingleSelect（选项预注册） | `pending` / `in_progress` / `done`，host 侧状态机校验 |
| `负责人` | MultiLineText（Contact 写入 500 的降级） | `姓名(openId)`；工具入参姓名唯一命中通讯录时自动解析 |
| `DDL` | Date（`YYYY/MM/DD` 字符串） | 截止日期 |
| `优先级` | SingleSelect（选项预注册） | `P0` / `P1` / `P2`（可选） |
| `标签` | MultiLineText（MultipleSelect 动态值被丢弃的降级） | **`#tag` tokens**——核心理念，自由聚合（§0） |
| `来源` | Url | 预留 deep link（当前 refs 记入推进日志） |
| `推进日志` | MultiLineText | **host 追加**，每次流转/改字段写一行 `时间 动作 结果`，模型不可跳过 |

首用时自动开通：`yzj_sheet_create`（标题「待办任务库」）+ `yzj_sheet_table_create`（上表结构，配 Grid + 按 DDL 的 Query 视图）。绑定记录在 tool-yzj 配置 `todoLibrary: { workspace?, docId?, tableId? }`，缺省自动发现/开通；`yzj_sheet_get` 自愈校验，字段缺失时给出可操作修复提示（不猜 ID）。

**实测格式事实（2026-08-15，真实库探针）**：Date 字段读出值为 `"2026/08/05"` 形态的 `YYYY/MM/DD` 字符串（非时间戳/ISO）；`--records` 必须数组形态；**负责人 Contact 字段写入全形态 500**（object/数组/裸 openId 均试）→ 降级 MultiLineText 存 `姓名 (openId)`，卡片/工具侧解析展示；**MultipleSelect 动态新值被静默丢弃** → 标签降级 MultiLineText `#tag` tokens（host 归一化/解析）。SingleSelect 选项须在 table create 时 `data.items` 预注册（状态/优先级已预注册）。以上均为正式待办 API 的需求证据（Contact 引用、动态标签），累积清单见迁移文档 §5。

## 4. 工具族（4 个，全部经既有门禁）

| 工具 | 门禁 | 参数要点 | 行为 |
|---|---|---|---|
| `yzj_todo_list` | 只读 | `status?`（pending/in_progress/done/overdue/open）、`assignee?`、`limit?` | 状态过滤复用 sheet filter（SingleSelect Equals）；`overdue` = 拉 open 后 **host 本地**比较 `DDL`（`YYYY/MM/DD` 字符串比较，不依赖 filter 日期运算）；输出按 DDL 升序的行摘要 |
| `yzj_todo_create` | 标准确认 | `title`（必填）、`assignee?`（openId 或姓名）、`ddl?`、`priority?`、`refs?`（引用 token 数组，同 im send 先例）、`note?` | host 生成 todo_id → 查重（存在即返回既有记录，幂等）→ 姓名→openId 解析（歧义时列出候选并中止，不猜）→ 建记录 + 首行日志 |
| `yzj_todo_update` | 标准确认 | `todoId`（必填）、`status?`/`assignee?`/`ddl?`/`priority?`/`appendLog?` | 状态机校验（见 §5）→ 更新字段 → host 追加日志行；`todoId` 不存在时返回可操作提示 |
| `yzj_todo_complete` | 标准确认 | `todoId` | `yzj_todo_update` 的便捷形态：状态置 done + 日志；供「完成这条」一句话场景 |

**刻意不提供 `yzj_todo_delete`**：销毁历史走裸 `yzj_sheet_record_delete`（强确认红色卡），路径刻意不便。补全/催办类诉求一律走消息而非删除重建。

## 5. 状态机与幂等（host 侧强制）

- 合法流转：`pending → in_progress → done`；`in_progress → pending`（打回）；`done → in_progress`（重开）。非法跳变（如 pending → done 直接完成）默认拒绝并在 digest 里说明合法路径——防止模型一步抹掉过程记录。
- 每次流转与字段变更都由 host 追加推进日志，模型只能通过 `appendLog` 补充说明，不能改写历史。
- 幂等：`todo_id` 创建前必查；重复创建返回既有记录并标注「已存在（幂等命中）」，天然对冲重试/双击。

## 6. 确认卡与 skill

- guard 追加 3 项：`yzj_todo_create/update/complete` 均标准确认；write-card 新增 `todo` domain 渲染——标题/负责人（姓名）/DDL/状态变化（前→后）/关联引用 chips（`refs` 展示先例已落地）。
- skill「影子任务库」章节改写为「待办」章节：教 `yzj_todo_*` 四工具、状态机规则、催办话术、逾期播报流程；保留裸 sheet 路径作为降级说明。

## 7. 面板「待办」tab（第四 tab）

- 分桶视图：**待处理 / 进行中 / 逾期 / 已完成（近 7 天）**，数据走 `/yzj` RPC 新端点 `todo-list`（host 复用工具内部实现，不重复拼 CLI）。
- 拖拽成 chip：`kind: 'todo'`，codec 回源规格——`标题 + 状态 + 负责人 + DDL + 来源链接 + 推进日志末 3 行`；mention 协议正式扩展 `type = todo`（v1.6 §8 预留落位）。
- **本人任务勾选 = 用户直写**：自己名下的任务在面板直接勾选完成（RPC 直更，先例＝面板 IM composer 直发）。原则成文：**确认卡门控的是 agent 发起的写；用户在面板的直接操作即用户本人意志**。agent 推进永远走工具 + 确认卡，两条路径不混。

## 8. 通知与催办闭环

- **逾期播报**：skill 教 `schedule_create`（建议 every 早间）→ 醒来调 `yzj_todo_list status=overdue` → 播报 + 提议催办（复用 v1.6 三层通知框架，层二）。
- **催办**：`yzj_im_message_send` 给负责人发待办上下文（标题/DDL/来源链接），确认卡放行——待办 → IM → 确认卡，全程既有能力，零新机制。

## 9. 迁移路径与 API 需求记录

- 工具名 `yzj_todo_*` 与参数语义即未来原生待办 API 的契约草案；CLI 提供待办命令后**换后端不换工具面**，schema 字段 1:1 映射。
- 卡点即需求，随用随记（skill 章节维护）：记录级 deep link、批量状态流转、按 DDL 排序的服务端视图、变更 webhook、负责人被分配时的站内/IM 通知、循环任务（recurring）。

## 10. 分期与工作量

| 期 | 内容 | 估算 |
|---|---|---|
| T0 前置修复 | `yzj_sheet_record_list` digest 对真实数据丢字段值（见 §11.1） | ✅ 已完成 |
| T1 host | todo.ts 四工具 + 绑定/自动开通 + 状态机/幂等 + guard 3 项 + `ctx.yzjTodo` 服务 + skill 改写 + 单测 | ✅ 已完成 |
| T2 UX | write-card `todo` domain + 面板待办 tab（分桶/标签聚合/快捷创建/勾选/拖 chip）+ codec `todo` + todo RPC 四端点 + 组件测试 | ✅ 已完成（@ 候选第四组缓行） |
| T3 闭环 | 逾期播报引导实测 + 催办链路实测 + 卡点记录成文 | ⏳ 下一轮（链路已通，待真实使用走查） |

依赖：无新 harness 机制（全部走既有工具/门禁/RPC/codec/schedule 面），不触碰 §15 机制受限项。

## 11. 实测复核与开放决策（2026-08-15）

### 11.1 实测暴露的现有缺陷（T0 前置）

`yzj_sheet_record_list` 对真实数据**丢字段值**：CLI 的 list 输出中 `records[].fields` 是 **JSON 字符串**（`"fields":"{\"姓名\":\"张明\",…}"`）而非嵌套对象，`recordLine` 的 `asRecord(row.fields)` 把字符串吃成 `{}`，模型面 digest 只剩 record id。UI 卡片的 `clipJson` 也只把该字符串当文本展示。待办的 list/create/update 全依赖记录读写，必须先修：`recordLine`/`recordsOf` 先尝试 `JSON.parse` 字符串形态。（此前真实冒烟未覆盖 sheet 记录，故未暴露。）

### 11.2 待拍板的设计决策 → **已全部拍板（v1.1，2026-08-15，用户授权自主决策）**

| # | 决策 | 结论 |
|---|---|---|
| 1 | 库落位与可见性 | **双轨已落地**（v1.2）：面板待办 tab 顶部**任务库切换器**——列出发现的全部「待办任务库」（个人 📋 / 团队 👥，含知识库归属），一键切换；「新建 / 选择团队任务库…」列出企业知识库（标注权限，只读不可选）按需开通或复用。切换即写 host 侧 active-binding（工具与面板同源，**agent 写入跟随当前激活库**），浏览器侧 localStorage 持久化选择；headless 场景仍可用 `todo` 配置（workspace/docId/tableId）钉死默认库。库失效（被删）时 override 自动清除并回落个人发现 |
| 2 | 并发一致性 | 接受 last-write-wins；低成本缓解＝更新前重读 + 推进日志整体写回；冲突检测记入 API 需求 |
| 3 | 面板新建任务 | **做**：快捷新建框（标题 + `#tag` + 日期片段解析：8/20、8月20日、今天/明天/后天、YYYY-MM-DD），Enter 创建（用户直写） |
| 4 | 空态/未开通引导 | **做**：一键开通 hero（`todo-ensure` RPC，用户直写） |
| 5 | 用户直写原则 | **成文**（v1.1；v1.8 收进 [`dsh-home-session.md`](dsh-home-session.md) D9）：确认卡门控 agent 写；面板 composer / 待办勾选 / 快捷新建即用户本人意志，不经确认卡。家园目标是用户发群发生在绑定 DSH 会话，面板 IM composer 将移除/降级 |
| 6 | 「我的」tab | 维持删除；待办 tab 使面板回归四 tab 形态（第四 tab 内容为待办） |
| 7 | 拖入快捷动作 | 维持移除（全屏 drop overlay 直接成 chip） |
| 8 | 确认同名目标辨识 | 主显名称；ID 明文展开暂缓（todo 卡显示 todo_id 本身即天然可辨识） |
| 9 | tag 自由聚合理念去留（2026-08-24 拍板） | **终态放弃**：复用云之家 worktask（无 tag 模型）时不再要求 tag 聚合能力——既不外挂自有 tag 存储，也不做 `#tag` 文本降级承载；§0「迁移不变量」条随之废止。MVP 现状面（SQLite 后端 tags 字段、面板标签轨 chips、工具面 `tags` 参数）不动，仅不再作为终态需求与迁移约束。依据：[`yzj-openapi-requirements.md`](yzj-openapi-requirements.md) §2 #8 |

### 11.3 Contact/Date 写入验证 → **已完成（结论进 §3，探针证据进迁移文档 §3/§5）**
