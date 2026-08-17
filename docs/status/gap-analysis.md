# 云之家-dsh 集成：设计方案 × 已有实现 对照与 Gap 分析

> 对齐对象：`../spec/integration-master-plan.md`（v1.7 人在闭环验收基准；**v1.8 会话家园产品法见 `../spec/dsh-home-session.md`，实现对照 §22**）↔ 本仓库现有实现（`packages/bridge`、`packages/tool-yzj`、`packages/ui-yzj`、`packages/bundle`、`packages/robot-yzj`）
> 核验日期：2026-08-14 之后（实现开发期）
> **v2.0 增补**（2026-08-17，Guoxin Shan）：**群房间 + 话题会话产品法**（[`../spec/group-room-topics.md`](../spec/group-room-topics.md)）取代 v1.8 的 1:1 绑定与融合一条流。**设计已拍板；锚定 / 入站话题 / 群房间视图 / 写闸 / 出站进日志 / 面板第二 IM 退役已落地**，对照 **§23**。§22 保留为 v1.8 实现快照。
> v1.8 增补：**会话家园产品法**（2026-08-17，Guoxin Shan）——目标是 DSH 唯一家园 + 1:1 绑定。**绑定对象 + 融合时间线已落地**：入站与挑群打 `yzj-home-*`；`conversation.view`「群工作」融合 ①②③④；面板 composer 降为快捷 ②。仍开放 G3/G5。v1.7 完成度口径不因此改写。
> v1.4 增补：**UI 后续演化对照**（git `08fc7b1` → `af3bf5d`，19 个 ui-yzj commit）——面板四 tab→三 tab、悬浮球唯一入口、面板真 IM composer（用户直写）、拖入快捷动作移除、确认卡去 ID 化、未读持久化；新增 §16。v1.3 增补：**最终验收状态**（git `de3c058`）——全部可开发缺口完成：锚点定位高亮、@ 候选三组、拖入即处理引导均已落地；剩余仅机制受限项（多 chip 合并、通知卡、确认卡事件族，均为 harness 契约边界）与待拍板项（合并确认、快照决策）。全量 build/typecheck/test 通过（58 passed）。v1.2 增补：实现进展状态全量刷新（git 至 `491db61`）——P0 消息回源、P1 门禁分级 + 确认卡、通知层一/三、skill、影子任务库、dbt 预览均已落地；剩余缺口见 §15 更新清单。v1.1 增补：补全实现侧全部工具明细（§2）；新增设计补强「悬浮窗全量拖拽 → composer」（§2A，用户思路）。

**完成度：≈95%（host 侧稳定；UI 侧在验收后继续演化，见 §16——其中「我的」tab 移除仍是对 v1.6 的偏离，终局待拍板；用户直写原则已由 v1.8 D9 拍板）**——按设计 v1.7 验收基准。**v1.8 会话家园不在此百分比内**：绑定 + 融合时间线已落地（§22 G1/G2/G4/G6），G3/G5 仍开放。**禁止**把 §20 机器人通道「已闭环」读成家园完成。

*本文档为对照记录，不替代 v1.7 设计原文，也不替代 v1.8 [`dsh-home-session.md`](../spec/dsh-home-session.md)；标注「待拍板」的项目维持原设计的决策归属——其中写路径两分已由会话家园 D9 拍板。*

---

## 1. 总体对照（§3.2 三个组件 + 一个协议）

| 设计（§3.2） | 实现 | 状态 |
|---|---|---|
| **yzj-tools**（host）：工具 + 门控写 + `yzjReader` 服务 + dsh skill | `@dsh-yzj/bridge`（`ctx.yzjBridge`）+ `@dsh-yzj/tool-yzj`（41 工具六域）+ `guard.ts`（标准/强确认两级门禁，**全量写工具入闸**） | ✅ 工具超配、门禁分级齐全；yzjReader 以 `/yzj` RPC 通道替代；skill 随 bundle 交付 |
| **yzj-ui**（client）：悬浮窗、@ 候选源、拖放 chip、codec、确认卡、面板跳转服务 | `@dsh-yzj/ui-yzj`：四 tab 面板（含角标轮询）、`inputTriggers` @ 源、drop band + chip、codec 回源（含消息原文）、**确认卡（host 桥接 + 按 domain 卡片）**、查看上下文跳转 | ✅ 除 @ 三组排序与锚点高亮外齐备 |
| **mention token 协议** `@yzj:{type}:{id}` | `yzj:{JSON}` 前缀编码（kind 含 message/group/doc 等） | 🟡 与设计格式不同但功能等价；**消息 ref 已携带 groupId**（回源能力达成，设计 §5.4 硬性要求满足） |

## 2. 工具清单对照（§5.1）— ✅ 全量对齐

- 设计清单 17 项全部有实现对应（`yzj_group_list`→`yzj_im_group_recent` 等，§5.1 主表已列实现名映射列）。
- 补充工具 14 项全部实现（§5.1 表后）。
- **门禁**：设计清单全部写工具 + 补充表写工具**均已入闸**（`guard.ts` 22 项：5 强确认 + 17 标准确认），只读全放行；`yzj_file_download` 仅 `overwrite` 时确认。风险分级（standard/strong）随 `yzj/ask-pending` 事件传给确认卡（强确认红色卡片）。
- 未登录引导：`failureDigest` 检测 auth/登录类 stderr 后附「请先运行 `yzj-cli auth login`」文案。

## 2A. 设计补强｜悬浮窗全量可拖拽 → composer（用户思路）— 🟢 已达成

六类条目（知识库/文档/多维表格/日程/会话/消息/联系人）全部可拖、全部有 chip、codec 提交时回源注入：

| 设计硬性要求（v1.6 §5.2） | 实现 | 状态 |
|---|---|---|
| 1. 消息 ref 必须携带 `groupId`，回源原文 | ✅ 拖拽载荷带 `group`，serialize 按 `(groupId, msgId)` 回源；锚点缺失降级「快照（原文可能已变）」 | ✅ |
| 2. dbt 节点附 `sheet get` 表结构摘要 | ✅ `context.ts` doc 分支对 `fileSuffix=dbt` 追加表结构预览（新增 `/yzj sheet-get` RPC 端点） | ✅ |
| 3. doc 摘要显式深度提示 | ✅ 摘要尾部注明「完整内容可用 `yzj_doc_block_list` / `yzj_doc_get` 获取」 | ✅ |
| 4. 拖入即处理引导（P2 可选） | ✅ drop 后快捷动作行：让 agent 总结 / 起草回复 / 沉淀知识库（一键插入指令文本） | ✅ |

## 3. mention token 协议（§5.4）— 🟡 功能等价

| 维度 | 设计 | 实现 | 状态 |
|---|---|---|---|
| 格式 | `@yzj:{type}:{id}` | `yzj:{json}` | 🟡 不互认（下期扩展需别名映射），功能等价 |
| 消息指针 | `{groupId}:{msgId}` | `yzj:{json}` 内 `id`=msgId + `group`=groupId | ✅ 回源能力满足设计硬性要求 |
| 懒解析 | 序列化时刻 | ✅ | ✅ |
| 失败降级 | 明确提示 | ✅ 快照标注 | ✅ |
| 出处记录 | Trajectory 结构化事件 | 🟡 序列化文本落日志；无独立引用事件（外部插件事件受限，见 §4 注） | 🟡 |

## 4. 确认流 / 确认卡（§5.2、旅程 7）— 🟢 已落地（含一处受限降级）

**实现形态**：`tools/pre-execute` ask（guard，含分级）→ `yzj/ask-pending` 广播参数 → host `write-gate` 应答 `approval/request` waterfall（yzj_* 加上绑定家园的 `robot_notify` / `robot_continue`，配对 `approval/asked` 审计 id，内存 pending 记录）→ 浏览器确认卡（`tool.call.toolview` keyed）查询/决策（RPC `write-list`/`write-decide`）→ 终态由官方 `tools/result` 驱动。

| 设计点 | 实现 | 状态 |
|---|---|---|
| 风险分级（标准/强确认） | ✅ guard 两级 + 卡片红色强确认徽标 | ✅ |
| 全部写工具入闸 | ✅ yzj 写族 + `robot_share_write`；绑定家园另加 `robot_notify` / `robot_continue`（D9） | ✅ |
| 按 domain 分发渲染 | ✅ im/doc/kb/sheet/calendar/file 六种参数详情 | ✅ |
| 按钮：确认 / 取消 / 查看上下文 / 编辑 | ✅ 全四按钮（编辑=草稿塞回 composer + 取消请求） | ✅ |
| 查看上下文跳转 | ✅ 打开面板并切 tab（im→会话群、doc/kb/sheet→知识库、其余→日程） | ✅ |
| 刷新可回放 | 🟡 pending/approved 由 host 内存表恢复（SPA 刷新存活）；终态由官方 tool/call+tool/result 事件回放；host 重启降级普通卡 | 🟡 满足主体 |
| `yzj.write/request\|resolved` 事件族 | ❌ **受限降级**：harness 对外部插件的自定义 session 事件类型无注册面（`KNOWN_SESSION_EVENT_TYPES` 生成白名单 + `Session.append` 无 `ignorable` 入口），故确认卡状态不进会话日志，改由 host 内存 pending + 官方工具事件承载 | ⚪ 机制边界，文档备案 |
| 标准确认同会话同目标合并 | ⚪ 未实现（设计标注「待评审拍板」） | ⚪ 待拍板 |
| 终态 deep link | ✅ doc 类结果卡带「打开文档」链接；消息类跳面板锚点 | 🟡 消息类锚点定位待补 |

## 5. yzjReader 服务（§5.1）— 🟡 以 RPC 通道替代

`/yzj` Connection RPC channel（`workspaces/docs/events/groups/messages/whoami/search/doc-get/doc-blocks/sheet-get/workspace-get/event-get/contact-get/write-list/write-decide`）覆盖面板查询 + 引用回源 + 确认卡决策；client 内存 Map 缓存引用上下文。缺 append-only 持久缓存与撤回检测（P2 可选）。

## 6. 悬浮窗（§5.2、旅程 1）— 🟢 达成

四 tab（知识库/日程/会话/我的）、双向分页、手动刷新、全条目可拖、CLI unreadCount 徽标、**角标轮询**（展开 30s / 收起 5min，汇总 unreadTotal 徽标）。

## 7. @ 候选源与 codec（§5.2、旅程 5）— 🟡

| 设计点 | 实现 | 状态 |
|---|---|---|
| InputTriggerSource | ✅ 三组：云之家·同事（order 0）/ 云之家·会话（order 1）/ 云之家·文档（order 2），另保留 codec 载体源 | ✅ |
| 三组候选（同事 order=0 / 群 order=1 / 文档 order=2） | ✅ 按设计分组与排序；文档组 warm 前 3 个知识库首层 | ✅ |
| @同事 越权边界 UI 明示 | ✅ 候选描述注明「仅你有权查看的范围」 | ✅ |
| @同事 起草消息给他 | ❌（选中即引用注入；起草走确认卡流程，无独立入口） | ⚪ 可选 |
| ReferenceCodec 回源 | ✅（含消息原文、dbt 表结构） | ✅ |
| 多 chip 合并序列化 | ❌ 受限：dsh chip 管道逐 chip 序列化（§15 备案） | 🔒 |
| chip 源失效变灰 | ❌（快照标注已提供，灰 chip 未做） | ⚪ 可选 |

## 8. 三层通知（§5.3）— 🟢 层一/三已落地，层二以 skill 引导落地

| 层 | 设计 | 实现 | 状态 |
|---|---|---|---|
| 1 悬浮窗角标 | `lastSeenMsgId` diff 轮询 | ✅ 轮询 unreadCount 汇总徽标（CLI 已带未读数；未做逐群 lastSeen diff） | ✅ 主体 |
| 2 schedule 筛选播报 | `every` 提醒 → agent 拉增量筛选 → 通知卡 | 🟡 schedule_create 为 harness 内置工具（已核验存在）；skill 交付「创建提醒 → 拉增量 → 筛选 → 播报」流程引导；**通知卡按钮受限**（外部插件事件限制，播报为普通会话文本 + 面板自查） | 🟡 |
| 3 浏览器系统通知 | 自接 Notification | ✅ unread 增量触发、点击聚焦 + 打开面板、首次点击授权 | ✅ |

## 9. 面板跳转服务 yzjPanel（§5.2）— ✅ 达成

确认卡「查看上下文」打开面板 + 切 tab + 加载群消息/workspace 文档；**锚点定位高亮**：im 回复类写操作锚定 `replyMsgId`，消息列表滚动定位并高亮（`itemAnchored`）。

## 10. dsh skill（§5.1）— ✅ 已交付

`packages/bundle/skills/yzj-cli/SKILL.md`（bundle files 打包）：红线（禁止编造 ID、写前先查、不得主动群发）+ 工具优先 + 四种 mention 引导 + schedule 播报流程 + 影子任务库表结构与规则 + 常见问题。安装方式：复制到 `~/.agents/skills/yzj-cli/`。

## 11. 影子任务库（§5.1 顺带）— ✅ 已交付

skill「影子任务库」章节含完整表结构（`todo_id`/标题/`状态` 状态机/负责人/DDL/来源消息/推进日志）与使用规则（创建/推进/查逾期全走确认卡）。

## 12. 安全与异常分支（§5.5、旅程 8）— ✅ 主体

单点门禁 ✅、身份/凭据 ✅、审计 ✅（批准对 + 工具事件落日志）、完整参数展示 ✅（卡片全文不截断）、未登录引导 ✅、ID 失效不编造 ✅、确认卡无人处理挂起 ✅。快照决策标注 ⚪ 待拍板。

## 13. 旅程与阶段验收对照（§4、§6）

| 旅程 | 状态 |
|---|---|
| 1 悬浮窗看消息 | ✅（含角标轮询） |
| 2 三层通知 | 🟡（层一/三 ✅；层二为 skill 引导 + 面板自查，通知卡按钮受限） |
| 3 拖→起草→确认卡→发送 | ✅ 全闭环（含消息原文回源、确认卡、查看上下文跳转、真实 E2E） |
| 4 讨论沉淀知识库 | ✅（确认卡 + doc 链接；落位预览=知识库 tab 跳转） |
| 5 @ 拉上下文 | ✅（三组：同事/会话/文档，真实候选；「起草消息给他」⚪ 可选） |
| 6 知识库问答 | ✅ |
| 7 确认卡状态机 | ✅（待确认→已批准执行中→工具结果终态；取消；真实 E2E） |
| 8 异常分支 | ✅ 主体（未登录引导/ID 不编造/挂起不写；灰 chip ⚪ 可选） |

| 阶段 | 完成度 |
|---|---|
| P0 环境验证 | ✅ |
| P1 yzj-tools（工具/门禁/确认卡桥接/skill/影子库） | ✅ ~98%（剩余仅 ⚪ 可选与受限项） |
| P2 yzj-ui（悬浮窗/@ 三组/chip/codec/确认卡/跳转/通知） | ✅ ~98%（剩余仅 ⚪ 可选与受限项） |

## 14. 工程侧状态

- link 依赖相对化 ✅，本机（Windows）可 install/build/test（67 passed + 2 平台跳过）；bridge 增加 Windows npm 全局 CLI 启动器解析（真实 CLI 链路打通，8 项真实冒烟执行）。
- harness 机制核验：`shell.overlay`、`ConversationNodeDefinition`、`inputTriggers`、`approval/request` waterfall、`schedule_create`、`tools/result` 均存在；**外部插件自定义 session 事件类型不可用**（确认卡事件族降级的原因，§4 注）。
- 文档同步：README 已更新（确认卡/改造版 skill 红线/相对依赖/受限说明），skill 已装入 `~/.agents/skills/yzj-cli/`（原版备份 `SKILL.md.orig`）。

---

## 15. 验收结论与残余项（v1.6 基准）

### ✅ 全部可开发缺口已完成

P0 消息回源、P1 门禁分级/确认卡（含真实 E2E）/通知层一三/skill/影子库/锚点定位高亮、P2 @ 三组/dbt 预览/摘要提示/拖入即处理引导/未登录引导/越权明示——均落地并有测试（67 passed，2 Windows 平台跳过）。**旁路已封堵**：改造版 skill 红线生效，模型写操作必须走工具确认卡（真实 E2E 复现并验证）。

### 🔒 机制受限项（harness 契约边界，文档备案）

1. `yzj.write/request|resolved` 持久化事件族（`KNOWN_SESSION_EVENT_TYPES` 白名单），由 host 内存 pending + 官方工具事件承载，主体语义达成。
2. 通知卡（ConversationNodeDefinition 按钮卡）同因受限；第二层播报为 agent 文本 + 面板自查。
3. 多 chip 合并序列化：dsh chip 管道为逐 chip codec 契约，无批量序列化面；多条引用按 chip 位置注入（行为等价，缺时间排序合并的展示层整理）。

### ⚪ 待拍板 / 可选（设计标注归属，未实现）

4. 标准确认同会话同目标合并。
5. 拖入 chip 快照留存决策标注。
6. @同事 选中后「起草消息给他」独立入口。
7. chip 源失效灰化（当前为快照标注降级）。

### 验证证据

- `pnpm -r --sort build` / `typecheck`：4 包全绿。
- `pnpm test`：67 passed + 2 skipped（Windows 平台限制），**含 tool-yzj 8 项真实 CLI 冒烟**（登录态下执行 whoami/知识库/通讯录/最近会话/日程）。
- **确认卡真实端到端**（`.acceptance/verify-confirm-e2e2.mjs`，真实登录态 + 真实 agent + 用户授权的目标群「830 项目【登顶计划】」）：**7/7 PASS**——模型调 `yzj_im_message_send` → 门禁 ask → 确认卡渲染（目标群 ID / 全文 / 确认 / 取消 / 查看上下文）→ 点击确认 → 工具真实发送 → 卡片结算；`im message list` 独立回查确认消息入群。**过程中发现并封堵一个旁路**：官方原版 skill 引导模型走 bash 直调 CLI（绕过确认卡）——改造版 skill 已装入 `~/.agents/skills/yzj-cli/`（原版备份 `SKILL.md.orig`，references 保留），红线「写操作必须走 yzj_* 工具」生效后确认卡链路正常。
- **真实浏览器验收**（`.acceptance/verify-real-data.mjs`，已登录 yzj-cli + 独立 dsh web 实例 + 系统 Chrome）：**8/8 PASS**——知识库真实列表、日程真实事件、20 个真实群组、群消息加载、@ 菜单会话/文档组真实候选、同事组关键词检索（带可见范围提示）、零页面错误。
- **无 CLI 降级验收**（`.acceptance/verify-windows.mjs`）：9/9 PASS——插件挂载、面板四 tab、优雅错误横幅（无 500）、@ 菜单不崩溃。验收中抓到并修复 4 个真实 bug（toolview 同 key 注册冲突、store 跨 scope 冲突、bridge spawn 500、dsh.client.inject 配置）+ Windows npm 启动器解析（bridge 真实 CLI 链路）与 @ 候选 warm 时序问题。
- 客户端 bundle 重建成功（`lib/client.js`）。

*本文档为对照记录，不替代 v1.7 设计原文；标注「待拍板」的项目维持原设计的决策归属。**v1.8**：写路径两分已拍板（[`dsh-home-session.md`](../spec/dsh-home-session.md) D9）；会话家园目标 vs 三面现状见 §22。*

---

## 17. v1.5 增补｜待办功能落地（2026-08-15，用户授权自主决策后开工）

§11.2 待拍板项全部拍板（结论见 `../spec/todo-design.md` §11.2），随后完成开发：

| 项 | 实现 | 状态 |
|---|---|---|
| T0 record digest 丢字段值 | `sheet.ts` `fieldsOf` 兼容 `fields` JSON 字符串形态（create/update/list 全路径） | ✅ 含回归测试 |
| T1 todo 工具族 | `todo.ts`：`yzj_todo_list/create/update/complete` + `ctx.yzjTodo` 服务（state/ensure/create/toggle）；稳定 ID 幂等、host 状态机、追加日志、自动发现/开通任务库（`todo` 配置可显式绑定团队库）；guard +3（25 写工具） | ✅ 14 项单测（fake bridge） |
| tag 核心理念 | `#tag` tokens 存储 + host 归一化；`yzj_todo_list(tag)` 聚合 + 面板标签轨 chips 过滤 + chip 回源携带 tags | ✅ |
| T2 面板待办 tab | 分桶（逾期/今天/进行中/待办/已完成）+ 标签聚合 + 快捷新建（`#tag`/日期片段解析）+ 一键开通 hero + 勾选完成/重开（乐观更新）+ 整行拖 chip；`todo-state/ensure/create/toggle` RPC；确认卡 `todo` 域（状态/负责人/DDL/标签/refs）；工具卡 todo 族（45 keyed）；codec `kind:'todo'` 回源 | ✅ 8 项组件测试 |
| demo 阶段声明与迁移 | `../migration/todo-backend-migration.md`：四层架构（工具/核心/服务/浏览器 不变 ↔ 存储适配层可换）、字段映射、8 条实测格式事实、迁移五步、API 需求清单 | ✅ |
| T3 闭环（逾期播报/催办实测） | 链路已通（schedule + `yzj_todo_list overdue` + 催办消息走确认卡）；真实使用走查待续 | ⏳ |

**第二轮验收证据（2026-08-15，隔离实例 :3091，3080 全程未动）**：

- **浏览器旅程 14/14 PASS**（`verify-todo-browser.mjs`）：悬浮球 → 四 tab → 待办 tab 真实库加载（非开通 hero）→ 快捷新建（`#tag`+日期片段解析预览「将创建」）→ 创建落库 → 标签轨过滤 → 勾选完成 → 拖拽行就绪 → demo 声明与任务库链接 → 零页面错误。
- **视觉健全性 6/6 PASS**（`verify-todo-style.mjs`，DOM 计算样式）：快捷创建圆角卡片、品牌蓝添加按钮、分桶标题、圆形状态点、grab 拖拽光标、四 tab 布局——CSS Modules 真实生效。
- **确认卡 agent E2E 12/12 PASS**（`verify-todo-confirm-e2e.mjs`，真实 agent + 真实放行）：`yzj_todo_create` → approval/asked → 确认卡（新建待办/标题/#e2e 标签/四动词）→ 点击确认 → approval/decided → 工具真实落库（含标签与推进日志）→ 动态发现任务库交叉验证 → 探针清理 → 零页面错误。
- **第二轮修复的真 bug**：库发现只扫第一个个人知识库（CLI 首项是 AI速记知识库而非我的知识），导致重复开通第二个任务库——已改为扫描全部个人知识库（≤8）再决定开通（`todo.ts` resolveLibrary，新增多库扫描单测）。会话日志诊断还证实第一轮 E2E 实际成功（approval/decided → created T-…-005），首报 FAIL 为脚本自身硬编码旧库 ID 与结算检测缺陷，均已修复。

## 18. v1.6 增补｜现有功能 UX 打磨（2026-08-15 第三轮）

审计知识库/日程/会话三 tab 与全局交互后修复三处摩擦（会话 tab 审计结论：已完备，未动）：

| 摩擦点 | 修复 | 验收 |
|---|---|---|
| 日程打开是空右栏（要求先点日期）；持久化的旧选择/旧月份会残留；日标题渲染成「00:00」 | 打开日程 tab **始终落在今天**（当月+当日+清旧选择）；月导航回到当月自动选今天；新增「今天」快捷按钮；日标题改人话（`今天 · 周六` / `8月20日 · 周四`） | 浏览器 5 项 PASS |
| 知识库只能看第一层文档——有子文档的库（如 127 篇的安全体系库）无法下钻 | **文件夹下钻**：有子项的节点显示 `›` 钻入按钮 + 子项数；面包屑（知识库 / 文件夹…）可逐级回跳；行点击仍开预览，拖拽语义不变 | 真实库钻入/回跳 3 项 PASS |
| Esc 只关 lightbox，不关面板 | **Esc 逐层收起**：表情面板 → 回复条 → 面板本体 | PASS |

浏览器验收 `verify-ux-polish.mjs` **11/11 PASS**（隔离实例 :3091，真实登录态，含「切走再切回日程仍落今天」回归项）；全量测试 93 passed。

## 19. v1.7 增补｜团队协作待办库（2026-08-15 第四轮）

v1.6 §11.2 决策 1「双轨库」完整落地：

| 能力 | 实现 | 验收 |
|---|---|---|
| 任务库切换器 | 待办 tab 顶部 pill：📋 个人 / 👥 团队 + 知识库名（当前激活库身份由 state() 经 doc-get + 5min 缓存的 workspace 索引廉价带出，不阻塞首屏）；点开列出发现的全部「待办任务库」（个人+企业扫描 ≤12+12，5min 缓存），active 项打勾 | 浏览器 PASS |
| 团队库开通 | 「新建 / 选择团队任务库…」二级菜单列出企业知识库（permissionLevel 排序，>2 只读禁选并提示）；选定后 adopt-or-provision（已有同名库则复用，缺任务表则补建，全无则新建 dbt+任务表）并自动激活 | 真实企业库「六大场景内测」开通 PASS |
| agent 跟随激活库 | 切换写入 host `TodoBindingHolder.override`，工具族与 RPC 同源共享——面板建的库 agent 写的库永远是同一个；失效库（被删）override 自动清除回落个人发现 | 单测：override 路由写入团队表 + 失效回落 |
| 持久化 | 浏览器 localStorage 记住选择，面板重开自动重放 todo-select；headless 用 `todo` 配置钉默认库 | 浏览器重开恢复 PASS |
| 团队语义 | 分派=assignee（姓名→openId 解析）；催办=IM 给负责人（确认卡）；多人共用 last-write-wins + 推进日志可追溯 | 既有能力组合 |

浏览器验收 `verify-todo-team.mjs` **15/15 PASS**（真实企业库开通 → 面板建待办真实落入团队库（含 #团队 tag，CLI 交叉验证）→ 切回个人库恢复 → 探针清理，零页面错误）；全量测试 97 passed。RPC 端点 22→25（`todo-libraries`/`todo-select`/`todo-ensure-team`）。

实测探针副产物（进迁移文档 §3）：`--records` 必须数组；`fields` 恒为 JSON 字符串；SingleSelect 需 `data.items` 预注册；MultipleSelect 动态值静默丢弃；Contact 写入 500；`sheet create` 带 `openWebUrl`；新 dbt 自带空默认表。工具数 41→45，写门禁 22→25，RPC 端点 18→22，面板回归四 tab（第四 tab＝待办）。

---

## 16. v1.4 增补｜UI 后续演化对照（git `08fc7b1` → `af3bf5d`，19 commit，~4300 行）

验收收口（v1.3，`de3c058`/`08fc7b1`）后，ui-yzj 经 19 个 commit 继续演化，host 侧（tool-yzj/bridge/bundle/skill）除三处小改（Windows 启动器、`im send` 增 `refs` 参数、skill 同步一行）外零变动。逐项对照：

| # | v1.3 收口时状态 | 现状（`af3bf5d`） | 性质 |
|---|---|---|---|
| 1 | 面板四 tab（知识库/日程/会话/我的） | **三 tab**：「我的」删除（`5112849`）；身份经 `yzj_whoami`，找人经 @ 候选 | ⚪ 偏离设计 §5.2，待拍板（恢复 vs 修订设计） |
| 2 | 侧边栏底部按钮入口 | **悬浮球唯一入口**：hover 快捷坞、持久化显隐（`9f970b7`→`af3bf5d`） | 🟢 演进，设计 v1.7 已修订 |
| 3 | 面板只读浏览 | **面板真 IM composer**（文本/图片/文件/回复/表情，`d60ece0`/`3dc66e8`），经 `/yzj im-send` 直发，不经确认卡 | ⚪ 当时引入「用户直写」路径（原则待拍板）；**v1.8 D9 已成文**，composer 作为家园则否（§22 G6） |
| 4 | 拖入即处理快捷动作（§2A 第 4 行 ✅） | **已移除**（`2a3a556`），改为全屏 drop overlay 直接成 chip | ⚪ 设计硬性要求 4（P2 可选）实现后删除，终局与否待拍板 |
| 5 | 确认卡展示原始 ID | **去 ID 化**：ID 解析为群名/人名，原型风格（`bfb81c0`/`1d6ee38`）；`refs` 关联引用 chips | 🟢 演进（同名目标可辨识性见待拍板 #8） |
| 6 | lastSeen diff 角标 | CLI `unreadCount` + 本地已读持久化（`0dedff8`/`361788b`），刷新不回退 99+，「全部已读」 | 🟢 演进 |
| 7 | 会话 tab 消息气泡 | 完整 IM：正序阅读、媒体/文件预览、表情、回复、日期分割线、锚点 tag、双栏布局、文档内容预览（`20cc7ba`→`7eb1b6c`） | 🟢 演进 |
| 8 | RPC 15 端点 | **18 端点**：新增 `im-send`/`file-upload`（用户直写）与 `file-data`（媒体代理） | 🟢 演进（#3 的载体） |

**维持不变**：41 工具、22 写门禁、@ 三组、codec 回源（含消息原文/dbt 表结构）、三层通知、确认卡四动词与锚点跳转、toolview keyed 注册。

### 16.1 新增待拍板项（并入 §15 清单）

8. **「我的」tab**：恢复（通讯录浏览回归面板）vs 维持删除（@ 候选已覆盖找人）+ 修订设计 §5.2。
9. **用户直写原则**：**v1.8 已拍板**（[`dsh-home-session.md`](../spec/dsh-home-session.md) D9/§8）——确认卡只门控 agent 写；用户从 DSH 发出（及现行面板 composer / 待办勾选/新建）即用户意志、不经确认卡。**尚未落地的是家园迁移**：用户发群应发生在绑定 DSH 会话；面板 composer 目标为移除/降级（§22 G6）。
10. **拖入即处理引导终局**：确认移除（修订 v1.6 硬性要求 4）或恢复。
11. **确认卡同名目标可辨识性**：去 ID 化后两个同名群/同名人在卡上不可区分；可考虑主显名称 + 可展开 ID 明文（安全审计可回溯）。

### 16.2 实测新发现（2026-08-15，真实库探针）

- **`yzj_sheet_record_list` 丢字段值**：CLI list 输出 `records[].fields` 为 JSON 字符串，`recordLine` 解析吃成空对象，digest 只剩 record id（UI `clipJson` 同样只当文本）；此前冒烟未覆盖 sheet 记录故未暴露。修复列入待办 T0（见 `../spec/todo-design.md` §11.1）。
- Date 字段真实值形态为 `YYYY/MM/DD` 字符串；Contact 字段无真实实例可考，写入格式待探针（待办设计 §3/§11.3）。

---

## 20. 机器人通道 R1（host 面，2026-08-16）

设计基线：`../spec/robot-channel-plan.md` §3.2/§3.6（DM 子集）。新增包 `packages/robot-yzj`（`ctx.yzjRobot`），bundle 第 5 行挂载。

| 设计项 | 实现状态 | 证据 |
|---|---|---|
| WS 入站（spike ①③⑦a 协议） | ✅ `protocol.ts` 帧分类 + `socket.ts` 心跳/陈旧/退避重连 | `tests/protocol.spec.ts`（11）、`tests/socket.spec.ts`（6，含停止清定时器） |
| 出站 sendMsgUrl（§2.3 语义） | ✅ `outbound.ts` 信封/引用卡/notify/分片/限流/msgId 提取 | `tests/outbound.spec.ts`（9） |
| S1 DM 持久 session + replyRootMsgId 锚定素材 | ✅ `router.ts`（session id `yzj-robot-<r>-<u>`；`outboundAnchor` 记录出站 msgId） | `tests/router.spec.ts`（7） |
| S2 ack-then-push + seq 水位防重发 | ✅ ack 即时引用回复；`whenIdle()` 后按 `assistant/message` seq 水位推回 | `router.spec.ts`（watermark 两用例） |
| S3 命令族子集 `!help/!status/!mute/!unmute/!restart` | ✅ 独立成句才生效；restart dispose 旧 session | `router.spec.ts`（help/mute 两用例） |
| S5/S8 触发与安全 | ✅ allowFrom 默认 CLI 登录用户（经 bridge `contact user get`）；非白名单拒绝且不建 session | `router.spec.ts`（拒绝用例） |
| 生命周期无残留 | ✅ `ctx.effect` → stop → socket 停 + router dispose | `socket.spec.ts`（stop 清定时器） |

已知缺口（转 §7.3 / R2）：msgChg `needAck` 的 ack 帧未实现（服务端 ~90s 重推，仅噪音）；面板设置卡与 `/yzj` robot 端点未做（R1 UI 半）；群场景全未做。

验收口径（真实通道，待 GUI 集成后走）：在「个人助手」DM 发非命令消息 → 3s 内 ack（引用原消息）→ agent 轮次收敛 → 回答以机器人身份引用推回；`!mute` 后静默、直接再发解除；非白名单账号拒绝。

### 20.1 E2E 收口（2026-08-16 10:25，真实通道全绿）

web profile 已装 `@dsh-yzj/robot-yzj`（link），`~/.dsh/profiles/web/cordis.patch.yml` 持 sendMsgUrl（凭据不入库）。隔离验证实例（端口 3093）跑通完整旅程：

```
用户 DM「你好5（全链路最终验证）」(10:25:56)
→ 秒回「收到，处理中…」（引用原消息）
→ agent 轮次真实执行（opencode-go/deepseek-v4-flash，测试期临时配置；agent 还自主调了 yzj_whoami 核身份）
→ 10:26 完整回答以机器人身份引用推回 DM
```

修复链（各配 pitfall）：loader inject 声明（pitfall-005）→ resume-before-create + `meta.cwd`（pitfall-006）。34 单测全绿。**测试期 provider/model 配置已撤**（回 harness 默认路由），正式模型路由待拍板。残留：`_no-cwd` 下旧坏 session 已删；3093 验证实例供群机器人接入复用。

### 20.2 R2 群场景收口（2026-08-16 10:37，金蝶最小DSH交流群实测）

- **多机器人架构**：`robots[]` 配置数组，每通道独立 WS/sender/router（commit `b1c8104`）；本机双通道并挂（个人助手 BOT-69ccc7 + 群机器人 BOT-6a80d097 = DSH-YZJ-TEST）。
- **群锚定实测**（对齐 §3.6 S1）：顶层 `@DSH-YZJ-TEST 你好` → 秒回 ack（引用+定向 @提问者）→ 完整回答 BOT 身份推回；**引用机器人回答**追问「群里都在说啥」→ 同一 session 续接（agent 多工具轮次、自我纠错、跨 5 群摘要报告）；`replyRootMsgId` 链根锚定生效，ack 本身也入锚（回复 ack 同样续接）。
- **免公网坐实**：隧道早已杀掉，群消息纯 WS 入站——spike ① 群场景收口。
- 35 单测全绿；测试期 provider/model（opencode-go/deepseek-v4-flash）标注于 profile patch 注释，正式路由待拍板。
- 待办（R2 余项）：`!fork`/`!routines`、群内建议卡协议、msgChg ack。

### 20.3 按会话模型覆盖（2026-08-16，UI 落地，`0a424fb`）

- **架构**：`OverrideStore`（storage-domain `robot_yzj_overrides`，json backend 落 `~/.dsh/storages`）——键 `g:<groupId>` / `dm:<robotId>:<openId>`；解析序**会话覆盖 > 通道默认 > harness 默认**，在 agent 创建时应用（已存在会话 `!restart` 后采用）。
- **面**：`/yzj` RPC 5 个 robot 端点（status/overrides/set/delete/models）；面板第五个「机器人」tab（dock+TABS）——通道状态灯、覆盖编辑器（群选择器显示群名、provider/model 下拉来自 live 目录）、覆盖列表（变更后主动重拉）。
- **验收**：`verify-robot-pane.mjs` **10/10 PASS**（含 保存→切 tab 重载→持久化→删除 全环）；截图 `.acceptance/shots-robot/`（gitignored）。
- **决策留档**：provider 目录合并 `listProviders()`（已激活路由）与 `listConfigurableProviders()`（休眠可选）——UI 可选全部 harness provider；未激活 provider 的模型列表可能为空（选择后由 agent 轮次按需暴露错误）。**决策反转（用户否决，2026-08-16）**：目录只列 `listProviders()`（已激活）——未配置的 provider 出现在选择器里是噪音；配置文件（channelsFile / patch）仍可引用未激活 provider。

### 20.4 通道默认模型可配置（2026-08-16，`50bc120`）

- **Config 新增 `defaultProvider` / `defaultModel`**：填进所有未自带 provider/model 的机器人——一行 profile 路由整个机群。**解析序定为四级**：会话覆盖（UI）> 机器人自带 > 插件默认 > harness 默认。
- **本机落位**：`opencode-go / deepseek-v4-flash` 为通道默认（用户拍板：默认便宜模型，强模型按群在面板覆盖）；之前手配的逐群 flash 覆盖已删（冗余）。
- **验证**：`verify-flash-default.mjs` PASS（双通道行显示 flash 默认）；真实 @ 往返（11:04，ack→flash 轮次→引用回推）确认默认路由驱动 agent。

### 20.5 R2 全量收口（2026-08-16，`8b97c3b`）

- **msgChg ack**：socket 对 `needAck:true` 的推送立即回 `{"cmd":"ack","seq":N}`——消掉实测的 ~90s 服务端重推。
- **群内建议卡协议（S8）**：`ConfirmBroker` 接管 `yzj-robot-*` 会话的 approval waterfall（GUI write-gate 让位）——写工具在机器人会话里触发时，推送编号卡（🔒 标准 / 🔴 强确认 + 参数摘要 + 30 分钟窗口），群内回复「`@机器人 确认 N / 取消 N`」裁决（**群面协议只送 @ 消息，确认必须带 @**——文档化）；超时自动取消；跨会话不串卡。**实测全链**：doc_create 卡[1] → @确认 1 → ✅放行 → block_insert 卡[2] → @确认 2 → ✅放行 → 文档真实落《我的知识》+ deep link 回推（11:15–11:21）。
- **`!routines`**：fold 会话 `schedule/change` 日志列活跃提醒（dsh-schedule 纯函数 fold，无运行时依赖）；`!help` 同步确认流程说明。
- 已知边界（留档）：确认卡为进程内存态，host 重启即失效（对齐 GUI 确认卡的降级语义）；R2 设计清单仅剩 `!fork`（跨群交接）未做，价值待群使用密度评估。
- 43 单测全绿（新增 confirm 6 + msgChg ack 2）。

### 20.6 卡片能力面二轮实测（2026-08-16，修正初判）

- **webhook 通道交互卡片判死**：8 个信封变体（msgtype 2/25/26 × param 三种挂法）全回落 `param:null` 纯文本——服务端白名单只放行 reply/notify 结构。初判"假模板渲染真卡片"系误读（应用类消息的富文本观感）。
- **应用类（msgType:1）确认为 webhook 唯一视觉卡片**：标题/主次内容/`webpageUrl` 跳转；与引用锚互斥（param 争用，实测 D/E 两变体）。**确认卡已用此形态上线**（`RobotSender.sendCard`，群内实测卡片标题/工具/确认提示三层结构 + ✅ 卡片回执）。
- **真交互卡片 = Adaptive Cards 1.4，开放平台通道**：重保群（698439d1e4b0d221d736ee42）告警平台卡片只读样本——`param.interactiveCard.cardJson` 内联完整 Adaptive 协议（Action.Submit 按钮/Input.Text/ChoiceSet/`_secondConfirm` 二次确认），回传走卡片平台→模板回调地址。R3 上 Adaptive 确认卡的协议依据已锁定，等 D 层协调。
- 设计文档 §4.1 spike⑥/§1.7 C 层/§3.5 R3 三处同步修正。

### 20.7 R2.5：Claude Tag 对齐收口（2026-08-16，`0bb88e3`）

- **PushHub（事件驱动推送）**：router 只排队轮次（ack 后即返回），**全部推送**由 `session/event` firehose + `agent/status`/`agent/error` 驱动——**任何触发源**（交互/定时/看板）的产出都会推回会话（C11 投递缺口补上）；水位防重发、长任务每 5 个工具步推里程碑（`⏳ 进行中…`）、错误以有界失败行呈现（C4 完整）。
- **群记忆（C9/S4）**：`robot_yzj_memory` 域——「记住 …」存（去重、上限 30）、「忘掉 …」删、`!memory` 列；存储行以 instructions 上下文注入每轮。实测：记住→查询→注入生效全通。
- **入群自我介绍（S7/C14）**：每群首个会话跑 intro 轮（读群历史+提建议任务），进程内去重。
- **任务署名 ack（C12）**：ack 带任务摘要（`收到，处理中…（帮我演示…）`）。
- **对齐终局**：14 项中 12 项 ✅ 等价或更强、1 项 ⚠️（C3 群内须带 @，协议限制已文档化）、1 项 ➖（C7 自静音显式放弃）；`!fork` 仍留观察。51 单测绿。
- 遗留观察：取消确认卡后部分轮次无收尾推送（agent 收尾产出为空的情形），非阻塞，下轮观察。

### 20.8 R2.6：DSH→机器人 双向控制 + 工作目录（2026-08-16，`df3ac60`）

**双向打通（操作者从 DSH 内部驱动机器人通道）——🟢 已落地并经真实通道验证**（设计见 `docs/spec/robot-channel-plan.md` §8）：

- **`robot_status`**：通道连接/cwd/provider/model/allowFrom/已见会话表面（groupId+robotId+lastSessionId）/live session；实测列出 `cwd=D:\dev\deepseek-harness`（宿主进程 cwd，可配置键 `cwd`/`defaultCwd` 覆盖）。
- **`robot_notify`**：主动通知推送到通道会话；实测群内收到「双向打通验证（来自 DSH 内部控制台）」。
- **`robot_continue`**：以白名单操作者身份注入消息走完整入站管线（ack/鉴权/确认卡/记忆/intro/轮次/推送）；实测注入后群内 ack + 机器人回答；synthetic 消息不带 reply 锚点（fake msgId 服务端不存在）；跨重启续接靠持久表面域 `robot_yzj_surface`（`surface:<index>:<groupId>` + `recent:<index>`，注入了真实 robotId/groupId/lastSessionId 后实测续接旧会话）。
- **`robot_fork`**：把机器人会话 fork 成操作者侧根会话（completed-turn seed + cwd + parentSession 谱系）；实测生成 `fork-yzj-robot-…` 会话且出现在 `session.list`（GUI 会话列表可打开继续）。
- 服务面 + `/yzj` RPC（`robot-notify`/`robot-continue`/`robot-fork`）+ client 注入面同步补齐；工具体拒绝 `yzj-robot-*` 会话调用（防机器人自驱）。
- 决策记录：工具不过确认门控（机器人是操作者自有通道，allowFrom 已限定），见 spec §8.2。

**定时任务主动通知（C11 定时推送）——🟢 已闭环（2026-08-16 R2.7，外部引擎 + 自研投递）**：

- 结论：**单独插件路线**（`docs/spec/routines-delivery.md`）——定时引擎采用社区
  **dsh-routines**（专用 `ops` daemon profile），云之家投递自研 `ctx.chatnode`
  （`robot-yzj/src/chatnode.ts`，提交 `640f205`）。
- 端到端实测通过（隔离 DSH_HOME）：routine `every 1m` → 调度器 tick → headless
  子进程独立会话 → digest → `ctx.chatnode.send` → 机器人推送到「金蝶最小DSH交流群」，
  群里收到 `[completed] c11-yzj / 定时任务 chatnode 投递测试通过。`；
  run 记录 `deliveries: [{file, ok}, {chatnode, ok: true}]`。
- 旧方案（在机器人会话里挂 harness schedule 工具，pitfall-007 的 `unknown tool`）
  已随 `df3ac60` 后的清理提交退役：移除 `attachScheduleTools`/schedule 运行时/
  flush 屏障监听；`!routines` 空态文案指向 `dsh routines list`。
- 实测坑（web profile 缺 jobs 控制器会崩调度器 tick、routines-cli 抢命令行、
  Windows 子进程 dshBin/runModule、patch insert 格式等）见 `routines-delivery.md` §5.1。

**生产形态定稿（2026-08-16 R2.8，`ops 不直连机器人`）——通信桥落地**：

- 用户要求 ops 调度器不直连云之家、一切机器人通信走我们的插件；最终为
  **HTTP 桥，两端都是 robot-yzj**（`robot-yzj/src/bridge.ts`，提交随本行）：
  web profile 在 webServer 注册 exact 路由 `POST /yzj/chatnode`
  （`bridgeToken` opt-in，loopback-only + Bearer 口令），ops profile 以
  `bridgeTarget` 进入 client 模式（无 WS/无凭据/只提供 `ctx.chatnode`）。
- 被否决备选：文件监听 runs 目录（用户判定太 low）、ops 侧 webhook 直连
  机器人 API（违反不直连）。
- `inject` 从 `['yzjBridge','agents','tools']` 改为 `['agents','tools']`
  （bridge 可选化，client 模式无需 yzj-cli 桥）；单测
  `tests/bridge.spec.ts` 全路径覆盖（真实 loopback HTTP，181 绿）。
- 生产布局与验收口径见 `routines-delivery.md` §6；端到端验证在 web profile
  重启（web patch 生效）后进行。

### 20.9 群工作区三层模型 + 共享区工具（2026-08-16，设计随提交）

**背景**：cwd 原为 per-channel（全机器人共享一个目录）——群 A/群 B/DM 文件互通，话题间静默覆盖（harness `write` 是覆盖语义，无保护），与 Claude Tag per-thread 沙箱隔离（C13）存在静默降级。用户拍板三层模型（设计见 `robot-channel-plan.md` §8.4）：

- **目录模型**：群话题 session cwd = `<通道cwd>/groups/<groupId>/<rootMsgId>/`（私有工作区，结构性无冲突）；DM 落通道根；群共享区 = `<通道cwd>/groups/<groupId>/shared/`（跨话题显式协作，等价 Claude Tag 的文件同步通道）；记忆按群不变。
- **权限模型（session 权限不动）**：机器人会话保持 workspace-write；共享区在 session workspace 外，内置写工具被沙箱拒，`robot_share_write`（插件宿主直写）是唯一写通道；读共享区用内置 `read`/`glob`（只读不受沙箱限制，零新工具）。
- **工具面**：`robot_share_write`（默认存在即自动唯一名 `name-2.ext`、`overwrite:true` 才覆盖、临时文件 + rename 原子写、filename 防穿越）+ `robot_share_list`（名/大小/mtime）；进 `WRITE_SPECS`（standard），机器人会话自动走群内建议卡；工具不禁机器人会话（区别于 §8.2 operator-only）。
- **注入**：每轮对群会话注入共享区指令（绝对路径 + 强制走 `robot_share_write`），DM 不注入。
- **验收**：单测覆盖群/DM cwd 解析、回复续接复用同目录、共享区指令只注入群会话、唯一名/覆盖/穿越拒绝；**沙箱行为实测（2026-08-16，3081 测试实例 + 假通道 overlay）**：内置 `write` 对 cwd 外非临时区路径被拒（`D:/dsh-share-outside/…`）、cwd 内放行；`robot_share_list` 无表面时正确报错（工具注册/接线/错误语义）；`robot_share_write` 确认卡（「工作区写操作确认」+ 拒绝/允许一次）→ 允许 → 落盘 `<cwd>/groups/probe-g1/shared/hello.md` → `robot_share_list` 回读可见，端到端全通。**边界条件（实测发现）**：workspace-write 豁免平台临时区（`%TEMP%`）——通道 `cwd` 配置在临时区下时共享区可被内置工具写，「唯一写通道」不成立；默认宿主 cwd 不受影响，部署注意（spec §8.4 已记录）。

### 20.10 全量 Gap 盘点（2026-08-16 R2.8 后，设计 vs 实现）

**结论：功能面 ~97% 闭环**；剩余真 gap = 群 watcher + 1 个外部依赖（Adaptive 卡片）+ 生产收口三步。

| 类别 | 项 | 状态 |
|---|---|---|
| 🔴 生产收口 | 生产 GUI 重启 → 桥路由 + 插件市场 UI + digest 进群（R2.8 验收最后一步） | ✅ **已闭环（2026-08-16 21:20/21:26 生产实测）**：桥 POST `{ok:true}`、定时 digest `[completed] c11-prod` 经 ops→桥→生产 GUI→群机器人推送，群内实收 |
| 🔴 生产收口 | ops daemon 常驻化 | ✅ **`dsh web` 唯一入口**（R2.12：web patch `autoStartOps: true` → robot-yzj 经 `~/.dsh/ops-wrapper.mjs` 自动拉起，pid 文件幂等；手动启动脚本/登录自启已删除） |
| 🔴 生产收口 | 生产 smoke（`.acceptance/verify-prod-smoke.mjs` 已提交） | 未在生产跑 |
| 🟡 设计有代码无 | `!fork` 跨群交接（S3/C5；§20.5 标"仅剩"） | ✅ 已实现（R2.10：目标群 surface + 本群最近会话上下文摘要 + continueFromDsh 全管线交接；顶层/链内均可触发；R2.11 目标支持**群名或 groupId**——群名经 CLI `im group recent` 惰性解析并持久化到 surface） |
| 🟡 设计有代码无 | `!configure` / `!feedback`（S3 命令族表） | ✅ 已实现（R2.10：!configure 回 GUI 设置链接（config `guiUrl`）；!feedback 落 `~/.dsh/robot-feedback.log` + 回执） |
| 🟡 设计有代码无 | 会话 deep link（S2「在 DSH 中打开会话」） | ✅ 降级实现（R2.10：GUI 无会话 URL 路由，最终推送附 `📎 本任务完整记录：<guiUrl>（DSH 会话 <id>）`；config `guiUrl` 开关） |
| 🟡 设计有代码无 | 群 watcher 关键词轮询（S6） | 未实现（schedule 已走 dsh-routines） |
| 🟡 外部依赖 | Adaptive 确认卡 / checklist 原地更新（S2/R3） | 协议依据已锁定，等开放平台协调 |
| ⚪ 可选 | 标准确认同会话合并 / chip 快照标注 / @同事起草入口 / chip 灰化 / 灰 chip | 设计标注可选，未实现 |
| 🔒 受限 | yzj.write 持久化事件族 / 通知卡按钮 / 多 chip 批量序列化 / 自定义 session 事件 / 确认卡进程内存态 | harness/协议边界，已备案 |
| 🧹 发布 | 对外 git 安装走根 `@dsh-yzj/bundle` registry 依赖；workspace 六包保留 `link:` 兄弟 checkout（开发事实源） | ✅ 关闭（2026-08-18）：根 `dependencies` 已是 `^0.1.0-rc.6`，无 `link:`；tag `v0.1.0` / `v0.1.1` 已打。**不要**把 workspace `link:` 换成 registry——会拆掉 vitest alias / 类型闭环。AGENTS.md Pre-release 段已删，口径见 `docs/release.md` |
| 🧹 业务 | routine 内容为 demo 巡检，真实定时任务未定义 | 待用户提供 |

**文档修正（同提交）**：`robot-channel-plan.md` §3.6.4 对齐表 C5 原标 ✅ 与 §20.5「!fork 未做」矛盾——已改标 ⚠️ 观察项；R2.10 `!fork` 落地后改回 ✅（含 !configure/!feedback/会话 deep link 降级实现）。

### 20.11 机器人面板升级：通道 cwd + 群共享工作区（2026-08-16，随 UI 提交）

- 机器人 tab 三个增量：① 通道状态行显示解析后 cwd（`robot_status` 数据本来就有，UI 补投影）；② 新增「群共享工作区」section——**先选已注册的机器人通道，再选该通道真实见过的群表面**（`robot_status` surface，过滤 DM 的 BOT- 前缀；群名从会话 tab 群缓存解析，缺失显示 groupId）→ 拉 `robot-share-list` 显示共享区路径 + 文件列表（名/大小/mtime，空态）；③ 面板直写表单（文件名 + 内容 → `robot-share-write`，携带所选通道 robotIndex），复用 `writeShareFile` 的自动唯一名语义，**面板直写 = 用户本人意志，不经确认卡**（对齐 im-send 直写语义；agent 会话写仍走确认卡）。多机器人下共享区按通道隔离（各通道 cwd 不同）。
- RPC 端点 +2（`robot-share-list` / `robot-share-write`），`/yzj` 共 36 端点；注入面 `robotShareList`/`robotShareWrite`。
- **演进（同会话内多轮）**：① 两级结构（机器人列表 → 详情）；② 文件区并进群卡片（不再单独选群）；③ **面板直写 UI 移除，改为「打开」预览**——`robot-share-read` 端点（只读、20k 字符截断、防穿越）＋群卡片内预览（文件名 + 内容 + 关闭）；机器人 agent 的 `robot_share_write` 工具不受影响；RPC `robot-share-write` 端点保留（向后兼容）。
- 验收：ui-yzj typecheck/build/bundle 通过、63 单测绿；浏览器走查待 web profile 重启后跑 `verify-robot-pane.mjs` 扩展（面板共享区浏览 + 直写落盘）。

## 21. 记忆库组件 memory-yzj（2026-08-16，设计随提交）

**背景**：用户提供 dream-vault 导出包作参考，要求对照 dsh 插件生态（"dsh find"）的记忆实现，做一个可接定时任务、后续可接群组记忆的记忆组件。调研结论（30+ 记忆插件，代表：dsh-mneme / dsh-native-memory / @max-null/dsh-memory）与全部取舍见 `spec/memory-vault-design.md`（D1-D11 决策表）。

**落地（首版，全部已实现）**：

- 新包 `@dsh-yzj/memory-yzj`（`ctx.yzjMemory`）：明文 Markdown vault，默认根 `$DSH_HOME/yzj-memory`，scope 分仓（`user/`、`group-<id>/` 同构预留）；sections（frontmatter `title/order/tags`）/ entities / observations（open/archived）+ log.md（追加审计）+ index.md（dream 重建）+ sections.yaml（仅 `inject_char_cap`，默认 6000）。
- 5 个工具：`memory_observe`（草稿区写入，去重 + 容量上限 200，唯一 agent 可写面）/ `memory_read` / `memory_search`（确定性关键词）/ `memory_dream_load`（全量状态 + 内容 rev）/ `memory_dream_apply`（决策 JSON 字符串入参——todo 工具族 records 同款范式；逐条校验，rev 不符或目标缺失仅拒该条；log/index 总是重建）。**不进 WRITE_SPECS**：本地草稿非云之家写（设计 §3/D4）。
- 注入：`ctx.get('systemPrompt')` 机会式注册 `yzj-memory` 动态 context，每次组装现算 `injectScopes` 投影（无陈旧镜像）；空库零贡献。
- 定时对接：`spec/memory-dream-routine.yaml`（dsh-routines 真 schema：name/schedule/timezone/profile/cwd/overlap/timeoutMin/deliver/prompt），固化规则全在 prompt，工具只做机械应用；headless profile 需挂 memory-yzj 行。
- 群组留缝：`allowScopes` 白名单扩 `group:<id>` 即激活（scope 正则 + 目录映射 + 仓间隔离已有单测）；robot-yzj 接群注入/群内「记住」为后续工作（设计 §8）。

**与设计的实现级偏差（设计已同步）**：① sections.yaml 从「段顺序+cap 双职责」简化为仅 cap（段的 order/title 移入各段 frontmatter——一处事实一处存放）；② 服务方法同步实现（注入 provider 契约是同步字符串；单进程串行，跨进程靠纯创建+原子 rename+rev 锁）；③ dream_apply 的 decisions 为 JSON 字符串参数（工具框架的数组 of object 参数不支持，todo records 同款）。

**验收证据**：`pnpm vitest run packages/memory-yzj` 21 测试全绿（frontmatter 参考格式往返、observe 去重/容量/scope 隔离、投影排序与截断、检索命中行、五类决策 + rev 冲突保护人工编辑 + 畸形决策进报告、临时文件卫生）；`pnpm run build`/`typecheck` 全仓通过。**待真实环境验收**（web profile 重启后）：提示组装含 `yzj-memory` 上下文、会话内 observe → 手动 dream → 注入更新；headless routine 端到端（ops→桥→群摘要）复用 routines-delivery §5 链路。

### 21.1 记忆面板（2026-08-16 v0.1 增补，设计 §「v0.1 增补」随提交）

用户要求 UI 可看记忆。原「浏览器管理面板」非目标提前转正：

- **ui-yzj**：工作台第六 tab「记忆」——sections/entities 逐条展开、观察草稿区全文、注入上限与 open/archived 统计、dream 固化日志尾部展开（「记录何时被分析过」透明化）、面板直写「记一条」（`memory-observe` 端点，source=`panel`，**用户本人意志不经确认卡**，与 im-send/todo-create 同语义）；memory-yzj 未挂载时 tab 显示安装提示。store 加 `memoryView/memoryLog`（repair 检查同步扩展，旧 blob 自愈）。
- **RPC +3**：`memory-scope`（readScope）、`memory-log`（服务新增 `dreamLogTail`，4000 字符行边界截断）、`memory-observe`；`/yzj` 共 41 端点。
- **工具卡**：`memory_*` 五工具进 cards.tsx（observe 确认/scope 计数/search 命中/dream 报告四种形态）。
- **验收**：memory-pane 8 客户端测试（含不可用态、重复 note、失败 note、空日志提示）+ rpc 端点契约测试（`ctx.provide` 挂 fake 服务：scope 投影/log 截断/observe 直写参数、未挂载 fail-closed）+ memory-yzj logTail 行边界测试；`pnpm test` 全仓 237 绿。浏览器走查（六 tab 布局、展开交互、composer）待 web profile 重启后进行。

### 21.2 dream 开关 + 进程内执行器 + 插件默认模型（2026-08-16 v0.2，设计 §7.1/§7.2 随提交）

用户要求：dream 不应默认开启 + 模型可设置，并建议插件级默认模型统一机器人/dream 等处的模型配置。

- **开关默认关**：`<vaultRoot>/dream.json`（enabled/provider/model/dailyAt/lastRunDay/lastNote），面板热生效；`enabled=false` 拦 `memory_dream_apply` 工具与执行器（跨进程共享文件，routine 备选路径同拦）；observe/read/search/dream_load 不受影响。命名 `DreamSettings`（避免与 service.ts 的 dream 快照 `DreamState` 撞名）。
- **主路径改为进程内执行器**：`dreamRun` 经 `ctx.get('agents')` 创建 one-shot 会话（cwd=vaultRoot、canonical `DREAM_PROMPT`、`whenIdle()` 10 分钟预算、`core.lastDreamReport` 回收报告、in-flight 互斥）；每日 `dailyAt` tick（`shouldFireDaily` 纯函数 + `lastRunDay` 戳防重启双发）。动因：实读 dsh-routines 源码确认 routine **无 per-routine 模型字段**——旧路径模型不可控；`memory-dream-routine.yaml` 降为备选（模板头注明差异）。
- **新包 `@dsh-yzj/model-yzj`**（`ctx.yzjModels`，`~/.dsh/yzj-model.json`，get/setDefault/clear/catalog）；robot-yzj 解析链尾部接 `fallbackRoute`（会话覆盖 > 机器人配置 > 通道默认 > 插件默认 > harness 默认，建会话现查热生效）；dream 模型链 = dream.json > 插件默认 > harness 默认。
- **RPC +7**：`dream-state/dream-set/dream-run` + `model-default(-set/-clear)/model-catalog`；`/yzj` 共 49 端点。记忆 tab dream 区：开关、每日时间、dream 模型选择器、插件默认模型选择器（清空=跟随 harness 默认）、立即固化、上次结果。
- **验收**：model-yzj 4 测试（round-trip/畸形容错/半空拒绝/catalog 透传）；dream 5 测试（默认关/局部更新归一化/每日触发边界）；memory-pane +4（开关默认关+run 禁用、开关提交、run-now 报告、picker 提交/清除）；rpc dream/model 端点契约；全仓 `pnpm test` 251 绿。真实环境验收（开关热生效、dreamRun 全链路、robot 兜底路由）待 web profile 重启后进行。

### 21.3 记忆组件真机验收（2026-08-16，web profile 重启后实测）

- **挂载**：web patch 展开确认（profile node_modules 含 memory-yzj/model-yzj 七包）；GUI 3080 在跑。
- **默认关**：`yzj-memory\dream.json` 验收前不存在（= enabled:false 的安全缺省）；手写 `{"enabled":true}` 开闸（等价面板开关）。
- **被动注入**：vault 骨架由注入 provider 的首次组装自动创建（无人显式初始化）。
- **全链路（子代理在 GUI 进程内经工具执行）**：observe（obs-20260816211751-c465，open 1/200）→ read → search「周报」命中 → dream_load → dream_apply（提升 1 · 段写 2 · 拒绝 0，无 rev 冲突）→ read 复核（work_context 段建立，观察转 archived）。观察无 rev 属设计（rev 只护 sections/entities 的读改写；观察按 id 一次性处置）。
- **闭环**：固化后的 `work_context` 段在下一轮提示组装中作为 `yzj-memory` runtime-context 出现（验收会话自身可见）——注入现算、无陈旧镜像实证。
- **待用户点验（面板交互，无自动化覆盖）**：记忆 tab「立即固化」（dreamRun 进程内执行器，one-shot dream 会话 + lastNote 回写）与「插件默认模型」选择器（robot 兜底路由热生效）。dream.json 当前 enabled=true 且未设 dailyAt（不自动跑）；用户可在面板设每日时间或关闸。

### 21.4 机器人/记忆管理迁入设置（2026-08-16 v0.3，用户决策）

用户要求：机器人、记忆的管理/配置不要单独占工作台页签，放进设置里。

- **设置 → 云之家**（`settings.section` 插槽，id `yzj`，label「云之家」，order 25）：分段控件「机器人｜记忆库」复用 RobotPane / MemoryPane（props 不变）；包装组件挂载即自取数，RPC verb 包装器更新本地 state——面板内刷新路径（observe 提交、dream 运行、覆盖项编辑）自然重渲染。
- **工作台面板回到四页签**（知识库/日程/会话/待办）：`TABS`/`DOCK_ITEMS` 删机器人/记忆，`YzjTab` 收窄，store 删 robot/memory 字段与动作（自愈清单同步收窄，旧 blob 判坏重置）；浮动球快捷坞同步。
- **依赖**：ui-yzj 新增 link 依赖 `@deepseek-ai/dsh-client-ui-settings`（仅类型，slot 契约经 `ctx.slots.inject` 延迟注册，无该壳的组合理应静默跳过）。
- **验收**：settings-section 3 组件测试（分段渲染 + 双 pane 挂载自取数 + verb 包装刷新路径）；全仓 255 绿；typecheck/build/bundle 通过。真实走查（设置导航出现「云之家」、四页签面板、球坞）待 web profile 重启后进行。

### 21.5 观察意图标记 durable（2026-08-16 v0.4，设计 §3/D17 随提交）

用户问「agent 怎么标记哪些需要 dream」——此前无 per-observation 意图标记，一切 open 观察都是 dream 候选，由佐证规则判定（agent 写时的判断被丢弃）。

- **`memory_observe` 新增 `durable` 布尔**（frontmatter `durable: true|false`，省略=中性）：true=长期候选（dream 单源也可 promote）；false=便签（默认 drop，除非新稳定事实被佐证）；中性维持原佐证规则。`memory_read`/dream_load digest 显示（长期）/（便签）；归档副本保留标记。
- **DREAM_PROMPT 规则更新**（与 routine 模板的差异已在 §7.1 说明同步，模板头注明 keep-in-sync）。
- **面板**：设置 → 云之家 · 记忆库「记一条」加「长期」勾选（勾=durable true；不勾=中性——面板不做便签标记）；观察行 meta 显示标记；RPC `memory-observe` 透传 durable。
- **验收**：vault +2（durable 持久化/归档保留）、memory-pane +1（勾选提交 true）、rpc 端点 durable 透传断言；全仓 257 绿。

---

## 22. v1.8 增补｜DSH 唯一会话家园（2026-08-17 产品法；2026-08-16 第一刀绑定；2026-08-16 第二刀融合时间线）

设计基线：[`../spec/dsh-home-session.md`](../spec/dsh-home-session.md)（v1.0 + v1.1 文案）、[`../spec/dsh-home-transcript.md`](../spec/dsh-home-transcript.md)（v1.1 + v1.2 文案 + **v1.3 切会话 UI**）。总方案 v1.8 仅指针；机器人协议 [`../spec/robot-channel-plan.md`](../spec/robot-channel-plan.md) §9 覆盖隐藏平行 session。**本节记录目标 vs 现状。** **文案订正**（2026-08-16）：用户可见手势是云之家 @机器人、DSH「发给助手」；说话人「助手」。Claude Tag / @Claude 仅对照类比，不是产品名。行为 / ID / 协议未变。

### 22.1 现状（第二刀后）

| 面 | 现行行为 | 产品法 |
|---|---|---|
| **绑定表** | ✅ `ctx.yzjHome`（tool-yzj，domain `yzj_home_bindings`）：`yzjConversationId` ↔ `dshSessionId` 1:1，重启后同一条。稳定 id `yzj-home-<slug>` | 一条云之家会话恰好一条 DSH session |
| **消息日志** | ✅ domain `yzj_home_logs`：① inbound / ② dsh-send / backfill；主键 `(yzjConversationId, msgId)`；乐观 `local-*`；T12 跳过机器人 openId | ①② 不是 Session.append |
| **DSH 对话** | 挑群 `/yzj home-open` + 回填；`conversation.view`「群工作」按时间戳融合 ①② + ③④ + write-gate pending overlay。IM 行与面板会话 tab 共用渲染器（头像/表情/图文文件/引用）。切会话：缓存先画、miss 不闪「私密会话」、先本地 fused 再 CLI 回填。官方 Chat tab 仍在（harness tab ring，不能替换） | 唯一家园；绑定群时 transcript 含四类节点 |
| **Composer** | 绑定：原生发送 = 发给助手（`systemPrompt.context` `yzj-bound-window`）；dock「发进群」= ② + `/yzj home-send`，无 user-turn、无确认卡。未绑定：单一发送 + 「丢进群」 | T10/T11 |
| **面板 IM composer** | 降为快捷发进群：横幅说明家园在 DSH；发送走 `im-send` → 绑定 log ②。挑群仍 focus 绑定会话 | 面板 = 挑选器/历史/引用；无第二 composer 作家园 |
| **召唤窗口** | 云之家 @机器人：`formatSummonWindow` + `agent.inject` 再 followup。DSH 发给助手：`systemPrompt.context` 仅 GUI user-turn。空窗口不注入 | T4/T5 |
| **丢进群** | 未绑定 dock「丢进群」：默认勾选近期可见摘要；全文迁移显式；确认模态后 `home-handoff`（② 发群 + followup）并 focus 绑定会话 | D8 |
| **write-gate** | 残留 `yzj-robot-*` skip。`ownsConfirm` 的 `yzj-home-*`：GUI user-turn → GUI 卡；plugin / 无 user-message → 群建议卡。绑定家园 `robot_notify` / `robot_continue` 进 WRITE_SPECS（D9） | T13 + D9 |
| **机器人 session** | 入站不再分配 `yzj-robot-*` 产品家园；`!fork` / `robot_fork` 打开或恢复绑定会话 | 入站进绑定对象 |

写路径两分（用户发无卡 / agent 发有卡 / 删除强确认）**原则已拍板**（D9），发进群落点在绑定 DSH composer（面板为快捷 ②）。绑定家园上 agent 经 `robot_notify` / `robot_continue` 推群不再绕过确认卡（cleanup：WRITE_SPECS `whenSession=yzj-home-*` + write-gate 认领这两项；面板 `im-send` / `home-send` 仍无卡）。

### 22.2 阻塞缺口

| # | 缺口 | 现状 | 目标 | 本刀 |
|---|---|---|---|---|
| G1 | **会话绑定对象** | `ctx.yzjHome` 1:1 表 | 一条云之家会话恰好一条 DSH session | ✅ 关闭 |
| G2 | **IM 节点进 transcript** | 绑定会话「群工作」tab 融合 ①②③④；打开回填最近 N；去重 (groupId, msgId) | 绑定会话四类节点共一条流 | ✅ 关闭（官方 Chat tab 仍并存，见下） |
| G3 | **确认卡 pending 不进 session 日志** | harness `KNOWN_SESSION_EVENT_TYPES` 白名单；pending 在 host 内存；融合 VIEW overlay `write-list`（SPA 刷新仍在，host 重启降级） | 家园即这条 transcript，挂起的「agent 要发群」必须能在该会话流回放 | 开放（harness 限制；未发明 Session.append 旁路） |
| G4 | **fork 开新根 / 丢进群** | `!fork` 交到绑定会话；DSH「丢进群」默认摘要 + 确认模态 + 着陆绑定会话 | 打开或恢复绑定会话；跨群/私聊进群走「丢进群」 | ✅ 关闭 |
| G5 | **无群搜索** | 沿用 CLI 最近会话翻页（根 README 已知限制） | 「挑群」要找得到群才能切换绑定会话 | 开放 |
| G6 | **面板 composer 移除/降级** | 会话 tab 仍有快捷 IM（写 ② + 横幅）；家园在绑定 DSH composer | 发送发生在绑定 DSH 会话。面板 composer 删除或降级 | ✅ 关闭（降级，未删除；挑选器仍需要消息列表） |

非阻塞但相关：免 @ / ambient（D11，本版明确不做）；解绑 UI；确认卡同会话合并（仍可选）；「群工作」不能设为唯一 Chat（harness `conversation.view` 是 tab ring）。

### 22.3 验收指针

按 [`dsh-home-session.md`](../spec/dsh-home-session.md) §10 八条：

| # | 口径 | 本刀 |
|---|---|---|
| 1 | 打开群 A 两次 → 一条绑定会话，第二次 focus | ✅ `HomeBindingStore` / `home-open` / 面板挑群 |
| 2 | @机器人 followup 进绑定会话，无新 `yzj-robot-*` 家园 | ✅ robot-yzj `resolveSession` |
| 3 | 四类节点共一条 transcript | ✅ 「群工作」融合流；官方 Chat 仍在 |
| 4 | 用户发群无卡 / agent 发有卡 / 删除强确认 | ✅ 发进群 = home-send / im-send 无卡；agent 写 GUI 或群建议卡；绑定家园 `robot_notify` / `robot_continue` 同闸 |
| 5 | 面板挑群切 DSH；无独立 IM 作家园 | ✅ 挑群切 DSH；面板降为快捷 ② |
| 6 | 未绑定只有对 agent 的单一发送 | ✅ dock 无「发进群」；有「丢进群」 |
| 7 | 丢进群默认摘要 + 确认卡 | ✅ 默认勾选近窗；全文迁移显式；确认后 focus |
| 8 | `!fork` / `robot_fork` 不再 `create` 新根 | ✅ 目标改为绑定会话 |

**禁止**把 §20 机器人通道「已闭环」读成会话家园已达成——那是协议面。G3（pending 耐久事件）与 G5（群搜索）仍阻塞完整「找得到群 + 刷新后确认卡还在日志里」。

### 22.4 切会话 UI（2026-08-17）

点任意群/单聊会闪一下：融合视图把初始 `bound: false` 当成未绑定（回填期间闪「私密会话」）；面板 cache miss 在新标题下残留上一群消息并打全局「加载中…」。已对齐面板分阶段路径：header 立刻换、缓存同步上屏、miss 清空后只在消息窗 loading、人名/媒体后补。v2.0 群房间时间线沿用同一套分阶段（pitfall-013）。验收：`packages/ui-yzj/tests/transcript.client.spec.tsx`、`packages/ui-yzj/tests/panel-switch.client.spec.tsx`。

---

## 23. v2.0｜群房间 + 话题会话（2026-08-17 拍板；e2e 刀）

设计基线：[`../spec/group-room-topics.md`](../spec/group-room-topics.md)（R1–R21，含 v1.1 工作台）。**本节记录目标 vs 现状。** 本刀：锚定表、入站/交给助手开话题、群房间 IM 视图占住对话格、composer takeover「发进群」、`yzj-topic-*` 写闸、出站帖子进房间日志、面板第二 IM 退役；v1.1 P0 把侧栏树换成入口块 + 工作台两栏 + 话题抽屉。v1.1 P1 精致度六条、P2 四域迁入工作台并退役悬浮球、P3 `TopicRecord.status` 已落地。**视觉刀（2026-08-17）**：tab ring 真藏（pitfall-018）、发进群 portal 进时间线列、dock「发进群」退役、会话行不以「群房间」占位盖 CLI 群名。**宿主生命周期刀（2026-08-17）**：composer portal 改注册/订阅总线（pitfall-019）；view-ring observer 收窄到 header；e2e 量不到发送盒即失败。v1.2（2026-08-18）：H9 旧宿主 ③④ 迁成「历史对话」话题；H18 抽屉透镜气泡 + 问助手；H4 入站 e2e（未连接 skip）；发布口径与根 registry 依赖对齐。

### 23.1 目标 vs 现状

| # | 面 | 现状 | v2.0 目标 | 状态 |
|---|---|---|---|---|
| H1 | 基数 | `yzj-home-*` 群房间 + `yzj_topic_anchors` / `ensureTopic` | 1 群 = 1 群房间 + 0..N 话题（R1） | ✅ 关闭（单测） |
| H2 | 视图 | 群房间 session 自动切「群房间」view 并隐藏 tab ring；话题/私聊隐藏「群房间」tab，官方 Chat 仍是对话格 | 群房间占对话格；话题 = 官方 chat | ✅ 关闭（pitfall-018：`display:none !important`；tablist 入场后 observer 只挂 header，不扫整页时间线） |
| H3 | Composer | 群房间 `conversation.composer` takeover 藏官方条；可见面 portal 进时间线列。宿主由 transcript `ref` 注册、composer 订阅（pitfall-019）。dock「发进群」退役（R2） | 群房间唯一动词=发进群；话题唯一动词=问助手；发送条不压会话列表 | ✅ 关闭（takeover + 宿主总线；切工作台域再切回跟到新节点；确认卡 chain priority 更高；发送面见 H14） |
| H4 | 话题入口 | 「交给助手」→ `home-topic-open`；@机器人 `resolveSession` 走 `ensureTopic`；回复链续同一话题；丢进群落地房间并开 handoff 话题；发进群 `local-*` ack 后 `retargetAnchor` 到真实 msgId（pitfall-015） | 四入口锚出话题 | ✅ 关闭（router 单测 mint `yzj-topic-*`；`.acceptance/verify-robot-at-topic.mjs`：dock 未配置/未连接 skip 退出 0；已连接则断言 dock + 话题抽屉可开。禁止 bash 直调 `yzj-cli` 代发 @） |
| H5 | 锚定 | `TopicAnchorStore`：`(groupId, rootMsgId)` + outbound msgId 登记 | R4 锚定表 | ✅ 关闭（单测） |
| H6 | 出站帖子 | ack / PushHub / `robot_notify` / 回填写入 `robot-outbound`，标话题回链 | R9：进群房间时间线 | ✅ 关闭（单测） |
| H7 | guard / write-gate | `whenSession` 覆盖 `yzj-home-*` 与 `yzj-topic-*` | R10/R11 | ✅ 关闭（单测） |
| H8 | 面板 / 悬浮窗 | `shell.overlay` 已摘除；四页签迁入工作台；卡片「查看」切 workbench domain | 第二聊天淘汰；球退役（R16） | ✅ P2 关闭（单测：dock 不再 `openPanel`） |
| H9 | 迁移 | 打开群房间时，有真实 ③④ 则幂等 `ensureTopic(rootMsgId=legacy-host, title=历史对话, fromSessionId=宿主)`；不搬事件；空白宿主/单聊不迁 | 降为群房间宿主；历史进首条话题 | ✅ 关闭（`home-open` 单测：有 ③④ 才迁、二次幂等、空白不迁、DM 不迁） |
| H10 | 侧栏可见 | 群房间 `session/title` = 群名；话题 `session/title` = `群名 · 话题`（官方列表平铺可扫） | 官方列表能扫出归属 | ✅ 关闭（单测） |
| H11 | 导航 | `sidebar.footer.action` 云之家入口块；点五域切 `workbench-domain` 并 focus 房间。对话 = 会话列表 + 时间线 + 话题抽屉；待办/日程/知识库 embed 原面板；记忆 = 本地 vault（「不出本机」） | 入口进工作台；单聊无抽屉；群聊 header「话题 N」开关抽屉 | ✅ P2 关闭（单测） |
| H12 | 模型上下文 | `formatSummonWindow` 头块 `groupId` + 每行 `msgId` + 话题锚点；空 log 仍给 groupId | 话题里问助手能对群发/回复 | ✅ 关闭（单测） |
| H13 | 人名 / openId | CLI 解析 `fromUser.openId/oId/name`；撞键补身份；回填通讯录补名；客户端 `resolveSenders` 与 host 共用 `contact-parse.ts` 拆信封（pitfall-003）；时间线禁止「群消息」占位 | 行上是真人名+头像 | ✅ 关闭（单测 + 真机：真人显示真名；机器人账号不在通讯录，按规格兜底显示 openId 尾号） |
| H14 | 轻发送 | 群房间 composer 接 CLI send 全集：回复 / @ / @all / 正文表情 / 图 / 文件；P2 删 72px 留白（pitfall-017 失效：球已退役） | 云之家侧能看见对应回复/@/图文件 | ✅ 关闭（单测；真机需 GUI 重启后 e2e） |
| H15 | 群房间视觉 | 布局跟 canvas：自己靠右、他人靠左、hover 出操作；话题锚点卡只在 session header（chrome 收成「回群房间」文字钮）。工作台会话行优先 CLI 群名，占位「群房间」不得盖住真名；`session/title` 占位可被真名升级 | 与已拍板原型同一套脸 | ✅ 关闭（2026-08-17 视觉刀：tab ring / composer 列 / dock 退役 / 群名占位；单测 + e2e） |
| H16 | 云之家 workspace | 新 `yzj-home-*` / `yzj-topic-*` 的 `meta.cwd` = `~/.dsh-yzj/workspace`（ensure 目录 + `workspaceRegistry.create(..., '云之家')` + `attachSession`）；robot 通道默认 cwd 同路径。旧会话仍是 `process.cwd()`，attach 失败则吞掉、不分组 | 官方侧栏出现「云之家」分组 | ✅ P0 关闭（路径单测；attach 吞错。机器人入站仍用 `<cwd>/groups/<id>` 子目录作 share 沙箱，不 attach 父 workspace——记此） |
| H17 | lastActivity / status | `lastActivity` 创建写入、ensure 已有则 touch。`status`：pending/approved 写 → `confirm`；交付或取消 → `running`（L5）；显式 `done`。L2 徽标：accent 数字 = 待确认 ＞ 细点 = 进行中 ＞ 完成无标 | 会话行能反映话题活动与待确认 | ✅ P3 关闭（topics / write-gate / conv-list 单测） |
| H18 | 话题抽屉 | 「交给助手」/ chip 开抽屉透镜，不 `focus` 原生；抽屉「原生会话 ↗」才 focus；锚点条反跳高亮时间线且不关抽屉；单聊无抽屉；透镜气泡 + 「问助手」`home-topic-lens` / `home-topic-ask`（用户 `followup`，不 focus） | L3/L6/R17/R19 | ✅ 关闭（抽屉单测：气泡渲染、问助手不 focus、`legacy-host` 无群锚跳转） |
| H19 | 群房间精致度 | 同人连发合并、日期分隔、气泡圆角、hover 文字链、助手产物卡、气泡内「N 条回复」chip | §9.1 / §9.5 P1 | ✅ P1 关闭（`room-layout` + transcript 单测） |

沿用不动：消息日志存储/去重/回填（T1/T7–T9）、召唤窗口（T4/T5）、写路径 D9、群内建议卡（ConfirmBroker）、未绑定私聊与丢进群（D7/D8）。G3 与 G5 继续开放。

### 23.2 验收指针

按 [`group-room-topics.md`](../spec/group-room-topics.md) §7 + §9.7。H2/H3/H5/H6/H7/H8/H9/H10/H11/H12/H13/H14/H15/H16/H17/H18/H19 有单测。H4 入站话题有 router 单测，`local-*`→真实 msgId 的 `retargetAnchor` 有 topics 单测；真机 `.acceptance/verify-robot-at-topic.mjs`（未连接 skip）。真机脚本：`.acceptance/verify-group-room-e2e.mjs`（需运行中 GUI + 已登录 yzj-cli；**禁止杀 3080 / `--profile web` 宿主**——改 host / browser 后请用户手动重启 GUI；改 browser TS 后 bundle 前必须先 `tsc -b`，见 pitfall-016）。**v1.1 P0**：入口块 + 会话列表 + 话题抽屉 + `lastActivity` + `~/.dsh-yzj/workspace`。**P1**：时间线精致度六条。**P2**：四域迁入工作台、`shell.overlay` 摘除、72px 留白删除。**P3**：`TopicRecord.status` + L2 徽标 + write-gate L5 回落。**视觉刀**：pitfall-018 tab ring、composer 列、dock 退役、群名占位。**宿主生命周期**：pitfall-019 总线 + view-ring 收窄到 header + e2e 盒子缺失即失败。**v1.2**：H9 历史对话话题、H18 透镜气泡/问助手、H4 skip 型 e2e、发布口径。
