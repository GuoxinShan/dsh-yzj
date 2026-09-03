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
- 未登录引导：工作台会话列 + 设置→云之家 登录卡（`/yzj auth-status` / `auth-login` 拉起本机 `yzj-cli auth login`）；`failureDigest` 检测 auth/登录类 stderr 后仍附同一条命令兜底。

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

**实现形态**：`tools/pre-execute`（guard，含分级）广播 `yzj/ask-pending` → waterfall `yzj/confirm-request` → host `write-gate` 应答（自建 writeId，内存 pending）→ 浏览器确认卡（`tool.call.toolview` keyed）查询/决策（RPC `write-list`/`write-decide`）→ 终态由官方 `tools/result` 驱动。不 return harness `{ kind: 'ask' }`，因此 GUI Full access（`approval=never`）仍弹卡（pitfall-036 / D9）。旧 `approval/request` 应答保留作防御。

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

单点门禁 ✅、身份/凭据 ✅、审计 ✅（批准对 + 工具事件落日志）、完整参数展示 ✅（卡片全文不截断）、未登录引导 ✅（工作台/设置登录卡 + 工具摘要兜底）、ID 失效不编造 ✅、确认卡无人处理挂起 ✅。快照决策标注 ⚪ 待拍板。

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
| 8 异常分支 | ✅ 主体（未登录登录卡 + 工具摘要/ID 不编造/挂起不写；灰 chip ⚪ 可选） |

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
- **确认卡真实端到端**（`.acceptance/verify-confirm-e2e2.mjs`，真实登录态 + 真实 agent + 用户授权的目标群「测试群」）：**7/7 PASS**——模型调 `yzj_im_message_send` → 门禁 ask → 确认卡渲染（目标群 ID / 全文 / 确认 / 取消 / 查看上下文）→ 点击确认 → 工具真实发送 → 卡片结算；`im message list` 独立回查确认消息入群。**过程中发现并封堵一个旁路**：官方原版 skill 引导模型走 bash 直调 CLI（绕过确认卡）——改造版 skill 已装入 `~/.agents/skills/yzj-cli/`（原版备份 `SKILL.md.orig`，references 保留），红线「写操作必须走 yzj_* 工具」生效后确认卡链路正常。
- **真实浏览器验收**（`.acceptance/verify-real-data.mjs`，已登录 yzj-cli + 独立 dsh web 实例 + 系统 Chrome）：**8/8 PASS**——知识库真实列表、日程真实事件、20 个真实群组、群消息加载、@ 菜单会话/文档组真实候选、同事组关键词检索（带可见范围提示）、零页面错误。
- **无 CLI 降级验收**（`.acceptance/verify-windows.mjs`）：9/9 PASS——插件挂载、面板四 tab、优雅错误横幅（无 500）、@ 菜单不崩溃。验收中抓到并修复 4 个真实 bug（toolview 同 key 注册冲突、store 跨 scope 冲突、bridge spawn 500、dsh.client.inject 配置）+ Windows npm 启动器解析（bridge 真实 CLI 链路）与 @ 候选 warm 时序问题。
- 客户端 bundle 重建成功（`lib/client.js`）。

*本文档为对照记录，不替代 v1.7 设计原文；标注「待拍板」的项目维持原设计的决策归属。**v1.8**：写路径两分已拍板（[`dsh-home-session.md`](../spec/dsh-home-session.md) D9）；会话家园目标 vs 三面现状见 §22。*

---

## 17. v1.5 增补｜待办功能落地（2026-08-15，用户授权自主决策后开工）

> **已归档（2026-08-27）**：待办从公开仓撤出，完整实现在私有归档 GuoxinShan/dsh-yzj-archive。本节是历史验收记录，不是当前产品面。

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

### 20.2 R2 群场景收口（2026-08-16 10:37，测试群实测）

- **多机器人架构**：`robots[]` 配置数组，每通道独立 WS/sender/router（commit `b1c8104`）；本机双通道并挂（个人助手 BOT-test-assist + 群机器人 BOT-6a80d097 = DSH-YZJ-TEST）。
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
- **真交互卡片 = Adaptive Cards 1.4，开放平台通道**：重保群（gid-card-sample）告警平台卡片只读样本——`param.interactiveCard.cardJson` 内联完整 Adaptive 协议（Action.Submit 按钮/Input.Text/ChoiceSet/`_secondConfirm` 二次确认），回传走卡片平台→模板回调地址。R3 上 Adaptive 确认卡的协议依据已锁定，等 D 层协调。
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
  子进程独立会话 → digest → `ctx.chatnode.send` → 机器人推送到「测试群」，
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
| 🧹 发布 | 对外 git 安装走根 `@dsh-yzj/bundle` registry 依赖；workspace 六包保留 `link:` 兄弟 checkout（开发事实源） | ✅ 关闭（2026-08-18 起；**2026-08-19 升 rc.7**）：根 `dependencies` 已是 `^0.1.0-rc.7`，无 `link:`；tag `v0.1.0` / `v0.1.1` 已打。**不要**把 workspace `link:` 换成 registry——会拆掉 vitest alias / 类型闭环。browser half 须 `import type {} from '@deepseek-ai/dsh-client-ui-tool/client'` 才能 merge `tool.call.toolview`；session 槽 `inject` / overlay hanger 用 branded `SessionId`（pitfall-034）。口径见 `docs/release.md` |
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

点任意群/单聊会闪一下：融合视图把初始 `bound: false` 当成未绑定（回填期间闪「私密会话」）；面板 cache miss 在新标题下残留上一群消息并打全局「加载中…」。已对齐面板分阶段路径：header 立刻换、缓存同步上屏、miss 清空后只在消息窗 loading、人名/媒体后补。v2.0 群房间时间线沿用同一套分阶段（pitfall-013）。**工作台增补（2026-08-18）**：`conversation.view` 随 session 重挂时左栏用模块 hold、时间线打开滚到底、「加载更早」保位置、图首帧同步读 `file-data` 缓存、H9 `quiet` 不 bump L1。验收：`packages/ui-yzj/tests/transcript.client.spec.tsx`、`packages/ui-yzj/tests/panel-switch.client.spec.tsx`、`packages/ui-yzj/tests/conv-list.client.spec.tsx`、`packages/ui-yzj/tests/im-render.client.spec.tsx`。

---

## 23. v2.0｜群房间 + 话题会话（2026-08-17 拍板；e2e 刀）

设计基线：[`../spec/group-room-topics.md`](../spec/group-room-topics.md)（R1–R22，含 v1.1 工作台）。**本节记录目标 vs 现状。** 本刀：锚定表、入站/交给助手开话题、群房间 IM 视图占住对话格、composer takeover「发进群」、`yzj-topic-*` 写闸、出站帖子进房间日志、面板第二 IM 退役；v1.1 P0 把侧栏树换成入口块 + 工作台两栏 + 话题抽屉。v1.1 P1 精致度六条、P2 四域迁入工作台并退役悬浮球、P3 `TopicRecord.status` 已落地。**视觉刀（2026-08-17）**：tab ring 真藏（pitfall-018）、发进群 portal 进时间线列、dock「发进群」退役、会话行不以「群房间」占位盖 CLI 群名。**宿主生命周期刀（2026-08-17）**：composer portal 改注册/订阅总线（pitfall-019）；view-ring observer 收窄到 header；e2e 量不到发送盒即失败。v1.2（2026-08-18）：H9 旧宿主 ③④ 迁成「历史对话」话题；H18 抽屉透镜气泡 + 问助手；H4 入站 e2e（未连接 skip）；发布口径与根 registry 依赖对齐。**v1.3 布局刀（2026-08-18）**：群房间 opt-in `data-conversation-composer-overlay` 有界视图契约（pitfall-020），三栏内部滚动、打开即触底（wheel/touch 门控的跟随判定）；`BOT-` 发送者标「机器人」（原 openId 尾号兜底废弃）；机器人长帖折叠「展开全文」；home-nav 分页回填绑定房间真名（「群聊」鬼影行消除）；话题官方列表标题改「话题 · 群名」（H10 修订）；话题抽屉 340px + 锚点卡 clamp 两行；侧栏脚 dock 视觉重排（图标行 + 当前域高亮 + 机器人状态点）。**v1.3 尾刀**：视图可见名称改「群聊/私聊」（「群房间」保留为设计概念名）；话题页重复的回群入口收口到头部锚点卡（chrome 条按钮删除）；17 个 pin-only 空壳房间 session 清除 + focus 路径全部走 `homeOpen` 自愈重建（H21）。**v1.4 产品法修订（2026-08-18）**：R20 纠正——官方侧栏「云之家」只收 `yzj-topic-*`（群聊长出的 agent session），`yzj-home-*` 房间不 attach。`attachYzjSession` 按 id 闸门，home-open / topic-open / ask / handoff 已跟。回归 = cwd/RPC 单测。**v1.5 视图归属（同日）**：R22 / H23——话题与普通会话不得挂 IM 壳；只藏「群聊」tab 不够，必须点「对话」清掉持久化 `view=yzj-home`（pitfall-022）。**v1.11 盖层（2026-08-19）**：R27 / H33——工作台是中间栏 DOM 盖层，开面板不建挂钩。**v1.17 入口刀（同日）**：R31 / H40——左边只留一个「云之家」，四域用顶栏页签。

### 23.1 目标 vs 现状

| # | 面 | 现状 | v2.0 目标 | 状态 |
|---|---|---|---|---|
| H1 | 基数 | `yzj-home-*` 群房间 + `yzj_topic_anchors` / `ensureTopic` | 1 群 = 1 群房间 + 0..N 话题（R1） | ✅ 关闭（单测） |
| H2 | 视图 | **v1.5**：群房间自动切「群聊」并藏 tab ring。话题/未绑定/普通 session **点「对话」**（写入 `view=chat`）并藏「群聊」tab——只 hidden 不够，残留 `view=yzj-home` 仍挂 IM 壳（R22 / pitfall-022）。`YzjRoomShell` 非 `yzj-home-*` 不画。kind 只跟 id 前缀 | 群房间占对话格；话题 = 官方 chat | ✅ 关闭（v1.5 补拨 view + 壳前缀闸；pitfall-018 藏 ring 仍有效） |
| H3 | Composer | 群房间 `conversation.composer` takeover 藏官方条；可见面 portal 进时间线列。宿主由 transcript `ref` 注册、composer 订阅（pitfall-019）。dock「发进群」退役（R2） | 群房间唯一动词=发进群；话题唯一动词=问助手；发送条不压会话列表 | ✅ 关闭（takeover + 宿主总线；切工作台域再切回跟到新节点；确认卡 chain priority 更高；发送面见 H14） |
| H4 | 话题入口 | 「交给助手」→ `home-topic-open`；@机器人 `resolveSession` 走 `ensureTopic`；回复链续同一话题；丢进群落地房间并开 handoff 话题；发进群 `local-*` ack 后 `retargetAnchor` 到真实 msgId（pitfall-015） | 四入口锚出话题 | ✅ 关闭（router 单测 mint `yzj-topic-*`；`.acceptance/verify-robot-at-topic.mjs`：点 `yzj-dock-home` 开盖层后断言话题抽屉可开。禁止 bash 直调 `yzj-cli` 代发 @） |
| H5 | 锚定 | `TopicAnchorStore`：`(groupId, rootMsgId)` + outbound msgId 登记 | R4 锚定表 | ✅ 关闭（单测） |
| H6 | 出站帖子 | ack / PushHub / `robot_notify` / 回填写入 `robot-outbound`，标话题回链 | R9：进群房间时间线 | ✅ 关闭（单测） |
| H7 | guard / write-gate | `whenSession` 覆盖 `yzj-home-*` 与 `yzj-topic-*` | R10/R11 | ✅ 关闭（单测） |
| H8 | 面板 / 悬浮窗 | `shell.overlay` 已摘除；四页签迁入工作台；卡片「查看」切 workbench domain | 第二聊天淘汰；球退役（R16） | ✅ P2 关闭（单测：dock 不再 `openPanel`） |
| H9 | 迁移 | 打开群房间时，有真实 ③④ 则幂等 `ensureTopic(..., quiet: true)`；`lastActivity` 用宿主原时间；不搬事件；空白宿主/单聊不迁 | 降为群房间宿主；历史进首条话题；打开不刷列表 | ✅ 关闭（quiet 不 bump；home-open 单测） |
| H10 | 侧栏可见 | 话题 `session/title` = `话题 · 群名`。房间保持 blank（R14 v1.8）：只在 current 时显「新会话」，点走消失；不进「云之家」分组（R20） | 官方「云之家」能扫出话题、扫不到群聊；挂钩不常驻未分组 | ✅ 标题规则关闭（单测）；房间 blank 见 H31 |
| H11 | 导航 | **v1.17 / R31**：左边「新建会话」下只有一个「云之家」入口（`yzj-dock-home`），点它 `openWorkbench()` 打开盖层，不切域、不 focus 挂钩。四域是工作台顶栏页签（`yzj-workbench-tab-*` / `setWorkbenchDomain`）。对话 = 会话列表 + 时间线 + 话题抽屉；待办/日程/知识库 embed 原面板。**记忆入口搁置**（R21 v1.6）：dock / 工作台 / 设置分段不露，包与工具保留 | 左边一个入口；页签切域；单聊无抽屉；群聊 header「话题 N」开关抽屉 | ✅ P2 关闭；记忆面 v1.6 卸入口；v1.17 收成单入口（dock / room-shell 单测） |
| H12 | 模型上下文 | **v1.13**：近窗是一次 plugin inject（`yzj-summon-window` / pre-step），不进 snapshot。记忆仍在 `yzj-memory` snapshot。话题窗走回复链。 | 轨迹里记忆与近窗是两条 plugin 消息 | ✅ 关闭（pre-step + thread + ask inject 单测；pitfall-031） |
| H13 | 人名 / openId | CLI 解析 `fromUser.openId/oId/name`；撞键补身份；回填通讯录补名；客户端 `resolveSenders` 与 host 共用 `contact-parse.ts` 拆信封（pitfall-003）；时间线禁止「群消息」占位；`BOT-` 前缀发送者标「机器人」（v1.3：机器人不在通讯录，openId 尾号兜底废弃） | 行上是真人名+头像 | ✅ 关闭（单测 + 真机：真人真名、机器人标「机器人」；本 profile 未配置机器人通道时我方助手帖子同样落「机器人」，不伪造「助手」） |
| H14 | 轻发送 | 群房间 composer 接 CLI send 全集：回复 / @ / @all / 正文表情 / 图 / 文件；P2 删 72px 留白（pitfall-017 失效：球已退役） | 云之家侧能看见对应回复/@/图文件 | ✅ 关闭（单测；真机需 GUI 重启后 e2e） |
| H15 | 群房间视觉 | 布局跟 canvas：自己靠右、他人靠左、hover 出操作；话题回群叠在官方 composer dock（与 InputBar 同宽）。工作台会话行优先 CLI 群名，占位「群房间」不得盖住真名；`session/title` 占位可被真名升级 | 与已拍板原型同一套脸 | ✅ 关闭（2026-08-17 视觉刀 + 回群落 composer 列；单测 + e2e） |
| H16 | 云之家 workspace | cwd 仍是 `~/.dsh-yzj/workspace`（房间与话题都建在这，防污染编码区）。**v1.4：`attachYzjSession` 只对 `yzj-topic-*` 调 `attachSession`**；`yzj-home-*` / 其它 id 直接跳过。`ensureYzjHostWorkspace` 顺带 `detachSession` 清掉 v1.1 误挂的房间。robot 通道默认 cwd 同路径。旧会话仍是 `process.cwd()`，attach 失败则吞掉、不分组 | 官方侧栏「云之家」= 话题，不是群聊 | ✅ 关闭（闸 + 存量 detach；cwd 单测：ensure 摘 `yzj-home-*`、留话题） |
| H17 | lastActivity / status | `lastActivity` 创建写入、ensure 已有则 touch（H9 `quiet` 除外）。`status`：pending/approved 写 → `confirm`；交付或取消 → `running`（L5）；显式 `done`。L2 徽标：accent 数字 = 待确认 ＞ 细点 = 进行中 ＞ 完成无标 | 会话行能反映话题活动与待确认 | ✅ P3 关闭（topics / write-gate / conv-list 单测；quiet 不 bump） |
| H18 | 话题抽屉 | 「交给助手」/ chip 开抽屉透镜，不 `focus` 原生；抽屉「原生会话 ↗」才 focus；锚点条反跳高亮时间线且不关抽屉；单聊无抽屉；透镜气泡 + 「问助手」`home-topic-lens` / `home-topic-ask`（用户 `followup`，不 focus） | L3/L6/R17/R19 | ✅ 关闭（抽屉单测：气泡渲染、问助手不 focus、`legacy-host` 无群锚跳转） |
| H19 | 群房间精致度 | 同人连发合并、日期分隔、气泡圆角、hover 文字链、助手产物卡、气泡内「N 条回复」chip | §9.1 / §9.5 P1 | ✅ P1 关闭（`room-layout` + transcript 单测） |
| H20 | 有界布局 | 视图根带 `data-conversation-composer-overlay`（pitfall-020）：三栏各自内部滚动、打开即触底（wheel/touch 门控跟随 + 内容层 ResizeObserver）、composer 钉底；抽屉 340px 有界、锚点卡 clamp 两行；机器人长帖 >240 字折叠「展开全文」；home-nav 对占位房间名分页回填 CLI 真名（60s 缓存） | 房间 = IM 应用的肌肉记忆布局 | ✅ 关闭（v1.3 布局刀；`.acceptance/verify-room-layout.mjs` 全绿） |
| H21 | 房间在官方侧栏的去留 | **v1.4 拍板 + 已落地**：群聊本身不进官方侧栏「云之家」；进该分组的是群聊长出的 agent session（话题）。归档藏房间是死路（pitfall-021）。正确手段 = 不 attach 房间；**已挂上的用 `detachSession` 撤回**（ensure 时扫 `yzj-home-*`）。**2026-08-18 清理刀**仍有效：17 个 pin-only 空壳已删；focus 走 `homeOpen` 自愈；房间是临时座位，binding + 插件日志才是真相。R14 空 turn 只防 blank 复用。**同日开发机再清**：停 web GUI 后删 4 个残留 `yzj-home-*` session 目录，并从 `workspace.json`「云之家」成员 / `session_projcache` 去掉对应 id；绑定表与 `yzj_home_logs` / 话题未动。打开群聊会按 homeOpen 自愈重建座位 | 打开群聊 / 重启后「云之家」无该群名行；话题仍在 | ✅ 关闭（闸 + 存量 detach 单测；本机残留房间文件已删） |
| H22 | 说明书卸脸 | 话题 chrome 卸掉「下方发送 = 问助手」等式；未绑定 chrome 只留安静「丢进群」链；侧栏脚去 emoji / 去左边框选中、机器人只留状态点；群聊 composer 去 chip 边框、输入圆角；会话列去「会话」头、头像改圆、加载更多改文字链；抽屉空态收成「还没有话题」。**话题回群**：卸掉 header 双行卡 / 挤在标题旁的小字。入口改走官方 `conversation.input.dock`，与 InputBar 卡同宽同圆角，文案只留「回群聊」 | 控件自己说话，密度跟官方侧栏 | ✅ 关闭（chrome / dock / transcript / session-shell 单测） |
| H23 | 错画 IM | `conversation.view`「群聊」对每个 session 都在（list 槽无 select）。只藏 tab 时，话题/普通会话若持久化 `view=yzj-home`（点过 tab、或房间切走后没拨回）就整页变成群聊三栏。v1.5：view-ring 点「对话」+ 壳前缀闸 + fused 只把 `kind=room` 当 IM | 只有 `yzj-home-*` 渲染 IM | ✅ 关闭（R22；view-ring / room-shell / transcript 单测；pitfall-022） |
| H24 | 工作台首帧 | 侧栏脚「对话」曾 `await homeNav` 再 `homeOpen` 才 focus，冷 CLI / 重开座位时左下角要点很久。现：点「云之家」= `openWorkbench()` 开盖层，不 focus、不换域（R27 / R31） | 点「云之家」立刻出工作台 | ✅ 关闭（dock / overlay 单测） |
| H25 | 非对话域发送条 | 待办/日程等仍 focus 房间以挂 `conversation.view`，时间线一卸，发进群 takeover 把卡片画回官方 `composerSeat`。现：域 ≠ 对话时 takeover 仍占位但画 `null` 并收起座位 | 只有对话/群聊有 composer | ✅ 关闭（room-composer 单测） |
| H26 | 拖入引用 | 悬浮窗「一切皆可拖」在工作台残留：面板/待办 `draggable` + 全屏 overlay + drop-bus 往 composer 塞 ☁ chip。v1.6 / R23 卸掉拖源、overlay、drop-bus；`conversation.input.dock` 只留回群/丢进群。@ 源不动 | 不能再拖条目进输入框 | ✅ 关闭（面板/待办无 drag；dock 无 insertReference） |
| H27 | 他人气泡 | 视觉刀把他人底设成 `--dsw-alias-bg-layer-1`。浅色主题该 token 与画布同白，别人的话看起来没气泡。改为 `--dsw-alias-interactive-bg-hover-solid`（pitfall-023） | 他人 / 助手也有可见 chip | ✅ 关闭（CSS + transcript 单测） |
| H28 | 点群开会话 | 会话列每点一行 `homeOpen` + `sessions.open`：卡、未分组多一行、官方超长 composer 闪。v1.7 / R24：点群只切 groupId；`home-fused` / `home-send` / 回填走 groupId；挂钩座位不换。inject 必须把 groupId 传进 `homeFused`（`(id, groupId) => …`），否则点了时间线不换。cache-miss 不得提前 return 卸掉 `#yzj-room-composer-host`（否则官方 InputBar 闪「给智能体发消息」） | 切群立刻出时间线；未分组不增生；loading 仍挂宿主 | ✅ 关闭（conv-list：click 不调 homeOpen；transcript：切 groupId 宿主节点不变） |
| H29 | 话题空 turn | 「交给助手」对话题套房间的 `publishHostSession` 空 turn 1；第一次提问再开 turn 1 → 官方 Chat `more than one start Match`。v1.7 / R25：话题只钉标题，不写空 turn | 交给助手后再问，历史能回放 | ✅ 关闭（home-open 单测：话题无 turn/start） |
| H30 | 话题问助手损坏 | 抽屉 followup 无 `message.id` → resume `lacks an identified message`；host `agents.create` 不传模型 → `{{model}}` 无值。`identifiedUserMessage` + `topicAgentRoute`（yzjModels / agentDefaultModel） | 问助手后官方 Chat 能打开、能续问 | ✅ 关闭（bound-io / home-open 单测；已坏 session 须停 GUI 后删目录） |
| H31 | 挂钩走「新会话」点走就藏 | 试过停写空 turn。真机：focus 到挂钩后窗口标题已是群名，但无 tab ring、`yzj-room-shell` 为 0，并栈溢出。维持空 turn（R14） | 点「对话」必须出工作台 | ✅ 关闭（否决；home-open 仍写空 turn） |
| H32 | 未登录入口 | 原先只有工具摘要「请先运行 `yzj-cli auth login`」；home-nav 是本地表，未登录会话列空着。v1.10 / R26：`auth-status` 探测 + `auth-login` 后台拉起 CLI 浏览器登录；工作台会话列 / 非对话域顶栏 / 设置→云之家 登录卡 | 页面上能跳去登录，不用自己开终端 | ✅ 关闭（bridge `start` + RPC + login-banner / conv-list / settings 单测） |
| H33 | 工作台挂钩 | 开工作台必须 focus/建 `yzj-home-*` 才能挂 `conversation.view`；入口在侧栏脚。v1.11 / R27：中间栏 DOM 盖层 + 「新建会话」下入口；开面板不造 session；话题仍 `sessions.open` | 开云之家不新建会话；点话题才回官方 Chat | ✅ 关闭（overlay / sidebar-entry / dock 不再 focus；room-shell overlay 模式） |
| H34 | 召唤窗每次重贴 / 记忆跟着重发 / 文件没 fileId | GUI 每轮 snapshot 带完整近窗（skip 把 snapshot 当 plugin 又同轮闪掉）；整份快照（含 `yzj-memory`）跟着 2741↔577 重发。`messageLine` / 窗口只渲染 `[文件]:名`。v1.12：稳住快照指纹、时间戳带日期、digest 输出 `fileId=` | 续问不再新贴窗/记忆；群附件能按 fileId 下载 | ✅ 关闭（bound-log / home / im 单测；pitfall-029） |
| H35 | 话题没有标准工具 | 程序化 `create` 漏挂 preset，裸作用域只有 host 的 `yzj_*`。v1.13 / R28：create/resume mount `agentPresets.defaultId`（standard） | 话题里能读文件 / bash，同时还能发群 | ✅ 关闭（home-open 单测；pitfall-030） |
| H36 | 日程永远是 8 月 3 日那条 | 面板/工具一次拉整月。云之家 `calendar event list` 跨天窗口按循环系列折叠，只留窗口内第一次（实测 2 日已丢 18 日那次）。v1.14：按天拆查。v1.15：7 天条带 + 快慢指针（peek 后缀、只信最早日、空尾一停），RPC 与 `yzj_calendar_event_list` 共用 | 打开 8 月能看到各次；今天右侧有今天的会；不再 31 天全打 | ✅ 关闭（calendar-range / events RPC 单测；已登录 tools 冒烟；pitfall-032） |
| H37 | 日程/对话不像灵基原型 | 面板日程只有月点 + 右栏列表，无日/周/年；工作台切域只靠侧栏 dock。v1.16：顶栏页签 + 日程四视图（对照 lingee 原型 `.cal` / `calendar-page__tabs`） | 顶栏能切四域；日程能切日/周/月/年 | ✅ 关闭（calendar-pane / room-shell 单测） |
| H38 | 话题结果不回云之家话题 | DSH 话题里问助手，回复只留在 DSH；群里锚点回复链是空的。模型偶尔调 `yzj_im_message_send`（还要确认卡），且会把过程也发出去。v1.17 / R29：`agent/status` idle 后 host 以 CLI 本人身份把本轮**最后一条助手正文**回复到 `rootMsgId`；本轮 `write`/`edit` 产物 `file upload` 成功后再写进总结（图进 richText 回复；其它文件因 CLI 不支持 file+reply，跟发群时间线，总结写明落点，pitfall-033）。跳过 plugin 入站 / 已调 `yzj_im_message_send` / 写闸 pending / 假锚点 / 无正文。投递失败不清 watermark，下一轮 idle 可重试。机器人通道本刀不动 | 云之家话题链能看见总结 + 产物；不是每条气泡 | ✅ 关闭（`topic-deliver` 单测 + dsh-2 真机回帖；file 不能进链是 CLI 契约不是漏实现） |
| H39 | 话题面板看不到产物 | 云之家 file 不能挂回复链，话题抽屉透镜原先只有文字气泡。v1.17 / R30：透镜把本轮 write/edit 文件画在助手气泡下。R29 发群照旧。助手正文读 `data.message.content` 与 `data.content` | 抽屉里能看见纪要.md 等卡片；群里文件帖仍在 | ✅ 关闭（`topicLensBubbles` 单测 + 抽屉客户端卡） |
| H40 | 四域多个侧栏入口 | 侧栏曾并排「对话 / 待办 / 日程 / 知识库」四钮，和官方侧栏抢注意力。v1.17 / R31：左边只留「云之家」；四域改工作台顶栏页签。卡片「查看」仍 `setWorkbenchDomain` | 一个入口 + 页签 | ✅ 关闭（dock 无四钮；room-shell 顶栏页签单测） |

沿用不动：消息日志存储/去重/回填（T1/T7–T9）、召唤窗口（T4/T5）、写路径 D9、群内建议卡（ConfirmBroker）、未绑定私聊与丢进群（D7/D8）。G3 与 G5 继续开放。**v1.17 / R29**：话题 job-done 投递是「问助手」的契约投递面（CLI 本人身份、无确认卡），不是 D9 agent 另起写；agent 显式 `yzj_im_message_send` 仍走确认卡。

### 23.2 验收指针

按 [`group-room-topics.md`](../spec/group-room-topics.md) §7 + §9.7。H2/H3/H5/H6/H7/H8/H9/H10/H11/H12/H13/H14/H15/H16/H17/H18/H19 有单测。H4 入站话题有 router 单测，`local-*`→真实 msgId 的 `retargetAnchor` 有 topics 单测；真机 `.acceptance/verify-robot-at-topic.mjs`（点 `yzj-dock-home` 开盖层后走抽屉；机器人状态在设置）。真机脚本：`.acceptance/verify-group-room-e2e.mjs`（需运行中 GUI + 已登录 yzj-cli；改 host / browser 后须重启 GUI 再跑，见 AGENTS.md「验收要新实例就重启 GUI」；改 browser TS 后 bundle 前必须先 `tsc -b`，见 pitfall-016）。**v1.1 P0**：入口块 + 会话列表 + 话题抽屉 + `lastActivity` + `~/.dsh-yzj/workspace`。**P1**：时间线精致度六条。**P2**：四域迁入工作台、`shell.overlay` 摘除、72px 留白删除。**P3**：`TopicRecord.status` + L2 徽标 + write-gate L5 回落。**视觉刀**：pitfall-018 tab ring、composer 列、dock 退役、群名占位。**宿主生命周期**：pitfall-019 总线 + view-ring 收窄到 header + e2e 盒子缺失即失败。**v1.2**：H9 历史对话话题、H18 透镜气泡/问助手、H4 skip 型 e2e、发布口径。**v1.3 布局刀**：`.acceptance/verify-room-layout.mjs`（有界三栏 / 触底 / composer 可见 / 无鬼影行 / 机器人标注 / 长帖折叠 / 抽屉有界）；pitfall-020（overlay 契约 + 跟随门控）；H10 标题改「话题 · 群名」。**v1.4**：R20/H16/H21 云之家分组只进话题；`attachYzjSession` 闸 + cwd/RPC 单测。**v1.5**：R22/H23 话题与普通会话不得挂 IM 壳；view-ring 点「对话」+ `YzjRoomShell` 前缀闸。**v1.6**：R21/H11 记忆入口搁置；R23/H26 拖入引用退役（面板/待办无 drag，`verify-drop.mjs` skip）。**H27**：他人气泡浅色主题可见（pitfall-023）。**v1.7**：R24/H28 点群只切 groupId，不建/不 focus DSH 会话（pitfall-024）。**R25/H29 空 turn**：话题不写空 turn 1（pitfall-025）。**v1.9 / H12**：话题问助手近窗（pitfall-027；`.acceptance/verify-summon-window.mjs`）。**v1.11 / H33**：工作台盖中间栏，开面板不建挂钩（R27 / pitfall-028）。**v1.14 / H36**：日程按天拆查，循环实例不再被整月折叠成第一次（pitfall-032）。**v1.15 / H36**：改成周条带 + 快慢指针，空后缀一次停。**v1.17 / H38**：话题 job-done 投递（`topic-deliver.spec.ts`；dsh-2 真机回帖自跳过若未登录）。**v1.17 / H39**：话题透镜产物卡（`topicLensBubbles` + 抽屉客户端；发群 R29 仍在）。**v1.17 / H40**：侧栏单入口 + 工作台页签（`yzj-dock-home` / `yzj-workbench-tab-*`；dock / room-shell 单测）。

## 24. AI推进第一期｜事元流驱动的推进事项（2026-08-19，设计随提交）

> **已归档（2026-08-27）**：AI推进从公开仓撤出，完整实现在私有归档 GuoxinShan/dsh-yzj-archive。§24.* 是历史验收记录，不是当前产品面。被删 spec（`ai-advance-design.md` 等）只在 git 历史与私有归档里。

设计基线 [`ai-advance-design.md`](../spec/ai-advance-design.md) v1.0（PRD《AI推进-产品PRD v2.1》+ 灵基原型 lgap17 版引用锚点全文收录于其 §0）。三条硬要求（用户拍板）全部落地：

| 面 | 交付 | 证据 |
|---|---|---|
| 数据模型 | `advance.ts`：事项/事元双表（同「待办任务库」dbt，`sheet table create` 自愈开通，SingleSelect 预注册六态与来源/变化类型）；**feed 是唯一变更通道**（无 update/delete 工具），字段级 `原值→新值` diff host 生成；投影（阶段/目标/指标/最新动态）随 feed 折叠回写，读路径以流为准 | `advance.spec.ts` 15 项（fake bridge 有状态存储）：建表、幂等、投影折叠、六态流转、非法跳变拒绝且零事元、**时间线无损**（feed N 条翻页读回全量且有序）、judge 用户事元 |
| 工具面 | `yzj_advance_list/get/create/feed`（45→49）；guard `WRITE_SPECS` +2（create/feed 标准确认，25→27 写门禁） | guard.spec 绿；确认卡 `advance` 域展示变化类型/摘要/阶段流转/原值→新值/refs chips |
| 服务/RPC | `ctx.yzjAdvance`（state/get/ensure/create/feed/judge）与 todo 共享 active-library holder（库切换双板跟随）；`/yzj` +5 端点（advance-state/get/create/judge/ensure，25→30） | judge 五动词（确认新条件/确认推进→updated/验收→completed/打回→running/忽略→running）全部落 `操作者=user` 事元——D9 直写无卡 |
| 独立看板 | **第五页签「推进」**（`WorkbenchDomain` 扩 `advance`，R21/R31 v1.18 修订——推进有真实数据源，与空壳「会议/AI速记」页不同）；`advance-pane.tsx` 按 lgap17 信息架构复刻：左队列三组带徽标（待我决定/待我验收/我关注的推进，空态文案沿原型语气）、主详情（kicker+阶段 pill、成功指标卡行、当前有效目标、阶段化决策区、三色时间旅程+来源跳转+查看全部翻页）、右侧信息来源（状态标：已确认/已读取/未达标/等待中）+已有产物+PRD 底注；发起推进弹窗=面板直写立项。**待办页签与 todo-pane 零改动** | `advance-pane.client.spec.tsx` 8 项 + room-shell 五页签断言；全量 551 绿；**真机看板 13/13 PASS**（`verify-advance-board.mjs`，探针 `A-20260819-001`）；**六态闭环 10/10 PASS**（2026-08-19 09:48，`.acceptance/verify-advance-loop.mjs`：`A-20260819-003`「闭环探针 105555」draft→running→待我决定→面板确认推进→updated→待我验收→面板确认达到目标→已完成；时间旅程保留立项/确认推进/验收通过，无确认卡、零页面错误；截图 `shots-advance/6–9-loop-*.png`） |

**同日旁路真机（发群指定 dsh-2 `gid-dsh2`）**：`topic-deliver` live job-done 绿（锚点「【验收】话题 job-done 锚点（R29）」+ 总结回帖 + `r29-summary.md` 跟发时间线）。群房间 e2e `YZJ_E2E_GROUP=dsh-2`：**发进群直写成功**（`【群房间e2e】01:38:12 5zpd`、无确认卡、交给助手开抽屉）；旧断言「composer 文案含发进群」FAIL——现行 placeholder 是 `发到 {群名}…`、发送钮是 aria「发进群」图标（`room-composer.tsx`）；回复 chip / 幂等「N 条回复」8s 内未出现。`verify-room-layout.mjs` 对 dsh-2：有界三栏 / 触底 / composer 可见 PASS；机器人折叠与抽屉 chip 依赖「测试群」的 BOT 历史，dsh-2 上 0 行属预期。

**分期状态**：①地基已交付；② 事元接入便捷化已交付（§24.1）；**③ AI 主动回路本次交付 host/面板切片（§24.2）**；④ 知识沉淀出口、⑤ 归集分析——见设计 §8。

**已知偏差**：(a) AGENTS/本档旧文提到的 `bundle/skills/yzj-cli/SKILL.md` 在当前仓库不存在（历史路径）；第一期 agent 教学面由工具 description（立项预填、running 勿打扰、feed 唯一变更通道）与 spec 承载，机器级 skill 的「AI推进」章节待 skill 文件回仓后补。(b) 来源跳转按「可跳则跳」降级：doc 走 web url/知识库域、对话跳对话域、待办跳待办页签，无消息级锚点（CLI 限制，设计 §9-8）。(c) 双写非事务：投影是缓存、流是事实（设计 §9-6，原生后端应服务端折叠）。

## 24.1 AI推进第二期｜事元接入便捷化（2026-08-19，设计随提交）

设计基线 [`ai-advance-design.md`](../spec/ai-advance-design.md) v1.1 §11。不改双表/六态/确认卡；补「人在工作现场把一条信号挂上事项」的用户直写入口。

| 面 | 交付 | 证据 |
|---|---|---|
| RPC | `/yzj advance-feed`：`actor=user`、`changeType` 固定「进度更新」；**拒绝** `stageTo` / `goal` / `metrics` / `targetDate` / `assignee`（决策 10）；有 refs 默认 `sourceType=对话`，否则「人工」 | `rpc.node.spec.ts`：无服务失败闭合；带 stageTo/goal 零调用；refs 过滤空串 |
| 群房间 | 消息 hover「喂给推进」（助手帖除外）→ 事项选择器 + 一句话（默认消息前 80 字）→ `refs=[msgId]`、`sourceType=对话`；无 inject 不露按钮 | `transcript.client.spec.tsx`：picker 提交载荷；无 inject 不含「喂给推进」；助手行无按钮 |
| 话题透镜 | 锚点旁 / 问助手栏「喂给推进」；草稿作 summary；`legacy-host` 不当 ref；问助手栏仍只 `followup`，两按钮不混 | `topic-drawer.client.spec.tsx`：锚点 feed refs=`m-root`；legacy 无锚点按钮；草稿 feed 且 asked=[] |
| 现在反馈 | 看板 kicker「现在反馈」→ `setAdvanceFeedback` + `setWorkbenchDomain('im')`；对话顶非模态事项卡一句话 `sourceType=人工`；取消清卡 | `advance-pane.client.spec.tsx` bus + 切域；`transcript.client.spec.tsx` 卡直写清 bus |
| 选择器 | `AdvanceFeedPicker`：列事项、presetId 预选、空板禁用、空摘要拦截 | `advance-feed-picker.client.spec.tsx` |

**不做（留给后续切片）**：文档/日程工作台行「喂给推进」；独立巡检 daemon。agent composer chip 喂入仍走 ①期 `yzj_advance_feed` 确认卡。

**已知偏差**：与 §24 (a)(b)(c) 同；另：群房间「喂给推进」是行操作文字链，不是独立 chip 组件（产品文案沿用「喂给推进」，实现是 picker 模态）。

**真机 chrome（2026-08-19，rc.7 web profile 新实例，无 yzj-cli）**：编 harness client+web dist → `dsh web :3080` → `dsh plugin --profile web add -w link:<本仓>`。boot 图含 `@dsh-yzj/bundle/ui-yzj`，`/plugins/@dsh-yzj/bundle/ui-yzj/client.js` 200。新鲜 profile 先关掉内测声明/API Key 卡（pitfall-035）后：

| 脚本 | chrome | 写路径 |
|---|---|---|
| `.acceptance/verify-advance-board.mjs` | **PASS** dock / 五页签「对话 待办 日程 知识库 推进」/ `yzj-advance-pane` 挂上（空态「推进看板还没有开通」+「一键开通」） | **SKIP** exit 0：该环境无 `yzj-cli`（`spawn yzj-cli ENOENT`），登录卡在 |
| `.acceptance/verify-advance-feed.mjs` | **PASS** 「推进」页签 + 看板挂上 | 同上；立项 / 「现在反馈」/ hover picker 该轮未跑 |

截图（git 忽略 `shots*/`）：`shots-advance/1-tabs.png`、`2-board.png`；`shots-advance-feed/0-advance-tab.png`。ENOENT 不是产品失败。

**真机写路径（2026-08-19，本机 Mac，`yzj-cli` 已登录「测试用户」，群 = dsh-2，web GUI 重启加载合入后的 `main`）**：`YZJ_E2E_GROUP=dsh-2 node .acceptance/verify-advance-feed.mjs` → **ALL PASS**（含话题透镜）。最新探针「喂入探针 676347」草稿未改阶段：事项卡「真机口头进度」（人工 · 你的判断）；「现在反馈」预选后 dsh-2 hover picker 文案含「不改阶段」；话题抽屉打开已有话题，锚点「喂给推进」写入「话题透镜喂入」；问助手栏填「不该发给助手」打开 picker 后取消，透镜里没有 followup。时间旅程同时有卡直写、群房间喂入、话题透镜喂入。脚本要点：切回「推进」须点开该探针；picker 无预选会落到队列第一项。

截图：`shots-advance-feed/1-board-feedback.png`、`2-feedback-card.png`、`3-picker.png`、`4-timeline.png`、`5-topic-lens.png`。

## 24.2 AI推进第三期｜主动回路 host/面板切片（2026-08-19，设计随提交）

设计基线 [`ai-advance-design.md`](../spec/ai-advance-design.md) v1.2 §12。不改双表/六态/D9。host 不做 LLM 语义结论（决策 11）；写仍走 `yzj_advance_feed` 确认卡。

| 面 | 交付 | 证据 |
|---|---|---|
| inspect | 只读 `yzj_advance_inspect`：摊开 open 事项目标/背景/指标/最近事元/合法下一阶段 + 静默/禁止 completed 纪律；`mode=review` 为验收辅助材料 | `advance.spec.ts`：digest 单测 + fake-store 隐藏 completed |
| 教学 | feed description 要求先 inspect、无偏差静默、偏差→decision-needed、产物齐→ready-for-review、禁止 completed、话题五步回路 | 工具 description 文本 |
| 请 AI 验收 | 看板 kicker → 切对话域 + `advance-ask` 草稿进问助手栏；不自动 followup（决策 12） | `advance-pane.client.spec.tsx`；`topic-drawer.client.spec.tsx` asked=[]；真机见下 |
| F 巡检挂点 | 不往话题 agent 挂 `schedule_create`（决策 13 / pitfall-007）；纪律写在 inspect digest | 文档 |

**不做（本切片）**：文档/日程工作台行「喂给推进」；独立 routines daemon；对话向导独立 UI（看板 decision 三按钮 + 话题五步说话已覆盖 D）。

**已知偏差**：与 §24 (a)(b)(c) 同。F 的真实定时仍需用户在 root 会话里自己 `schedule_create`，本切片只提供 inspect 材料与静默纪律。

**门控线后续收窄见 §24.3。**

**真机（2026-08-19，本机 Mac，GUI 重启加载③期 bundle，`yzj-cli` 已登录「测试用户」，群 = dsh-2）**：`pnpm test` 564 绿；`YZJ_E2E_GROUP=dsh-2 node .acceptance/verify-advance-feed.mjs` → **ALL PASS**。探针 `A-20260819-007`「喂入探针 630752」：②期时间旅程（卡直写 / 群房间 / 话题透镜）仍通；kicker「请 AI 验收」切对话、banner「验收问题已预备」、问助手预填 `yzj_advance_inspect` + `不要 stageTo=completed`、透镜无 followup、零页面错误。截图 `shots-advance-feed/6-ask-banner.png`、`7-ask-draft.png`。

## 24.3 AI推进｜打扰判据 + 确认卡门控线收窄（2026-08-19，设计随提交）

设计基线 [`ai-advance-design.md`](../spec/ai-advance-design.md) **v1.3 §13**，决策 14 / 15。缘起：用户指出「让人确认的必须是 AI 发现的重要事情，进度正常不该要确认」——而此前 `yzj_advance_feed` 在 `WRITE_SPECS` 里是**无条件** standard，一条进度备注也弹卡。不改双表/六态/D9/②期用户直写。

| 面 | 交付 | 证据 |
|---|---|---|
| 门控线（host 固定） | `yzj_advance_feed` 由无条件确认改为 `when: rewritesAdvanceBaseline`——只在载荷含非空 `goal`/`metrics`/`targetDate`/`assignee` 时问；纯追加与阶段变化（→`decision-needed`/→`ready-for-review`）静默落。`yzj_advance_create` 不变（立项是新对象）。写门禁仍 27 条（feed 留在表内，改条件） | `guard.spec.ts` +2：四种静默载荷（含空白基准字段）返回 allow 且 `pending` 为空、四个基准字段各 ask；create 无条件 ask |
| 判据（教学面） | `INSPECT_DISCIPLINE` 与 feed description 补：**打扰判据**六条（基准冲突 / 指标掉头 / 按趋势不可达 / 目标日期受威胁 / 需要取舍或授权 / 路径分叉）、**静默判据**、**抑制**（同判据不重复提、同来源去重、被 ignore 过不再提）、**验收判据**（N/N + 产物齐 + 无未决偏差）、门控线一句 | `advance.spec.ts` digest 断言五条锚点；全量 **566 绿** |
| 分工 | 「重不重要」由 AI 判断，但只能表达为**阶段**；「要不要过卡」是 host 固定规则，模型不可绕（决策 15） | 设计 §13.5；host 仍不做语义结论（决策 11） |

**为什么阶段变化也不弹卡**：偏差 feed 的落点就是看板「待我决定」，那里本来就要人拍板（确认推进 / 忽略）。此时再弹一张卡＝同一件事问两遍，且第一遍「我能写这条吗」没有信息量。卡留给「改基准」——目标/指标/目标日期/负责人一换，后续所有比对的锚点就换了，人没看过就换，AI 之后的判断无从校验。

**已知偏差 / 代价**：静默 feed 把噪音代价前移到事元表——纪律（§13.2/§13.3）是教学面，host 不强制；v1.4 已把同源去重升为 host 强制（决策 19），频率上限仍观察噪音后再定。真机卡面走查未重跑（本次改的是 ask 与否的判定，`guard.spec` 已覆盖；卡面渲染未变）。

## 24.4 AI推进｜主动发现 scan → inspect → feed（2026-08-19，设计随提交）

设计基线 [`ai-advance-design.md`](../spec/ai-advance-design.md) **v1.4 §14**，决策 16–19。把机制 B/F 从「被召唤时比对」升级为「AI 定时自己发现」。不改双表/六态/D9/决策 10–15。发现通道是 CLI `im message list --type new` 轮询，不是机器人 WS（协议只投 @机器人）。

| 面 | 交付 | 证据 |
|---|---|---|
| scan 工具 | 只读 `yzj_advance_scan`（50→51）：`groups` 必填 1–8；首扫 `type=newest` 建基线不回灌；增量 `type=new`；过滤本人/`BOT-`；cursor 写 storage-domain `yzj_advance_scan_cursors` | `advance.spec.ts`：基线 / 静默轮 / 过滤自身 / cursor 持久 / 未知群 |
| host 去重 | `coreFeedAdvance` 在 `appendEntry` 前：`input.refs` 与已有事元 refs 有交集 → 幂等返回、不加行（空 refs 不去重） | `advance.spec.ts`：同 msgId 二次 feed 不加行；无 refs 仍追加 |
| 巡检教学 | `INSPECT_DISCIPLINE` + scan/inspect/feed description 含巡检五步；用户说「开启巡检」→ root `schedule_create(every_seconds≥300)` | digest 断言「巡检五步」；scan 不在 `WRITE_SPECS` |
| schedule 挂载 | bundle `cordis.patch.yml` 加 `id: time-context` / `id: schedule`（与官方 `examples/web-schedule` 同 id，防双挂） | 插件 id 与 overlay 对齐；诚实边界：session-local，GUI 关就停。**v1.9 决策 42 已移除挂载行（§24.24）** |
| 无人值守 | `docs/spec/advance-patrol-routine.yaml` + `docs/spec/headless-yzj.cordis.yml`（只挂 bridge+tool-yzj）。digest 降噪：routines 每轮都投 chatnode，无内容过滤 → 默认只 `file` deliver；无发现输出 `[advance-patrol:quiet]` | 模板头写明 spike 结论 |
| 看板状态行 | `/yzj advance-scan-state` + 队列头 `data-testid="yzj-advance-scan-status"`（尚未巡检 / 上次巡检 HH:mm · 本轮发现 N 条） | `advance-pane.client.spec.tsx` + `rpc.node.spec.ts` |

**已知偏差**：频率上限未做（决策 19 观察项）。sidecar 扫描走独立 `ScanCursorStore`（内存），不会写 GUI 进程的 cursor domain——看板「上次巡检」只在 GUI 内 `yzj_advance_scan` 之后更新。schedule 仅对新创建的 live root 生效（已有 root 需重开或新会话）。

**真机闭环（2026-08-19 13:22，群 dsh-2 `gid-dsh2`）**：sidecar `tsx .acceptance/advance-patrol-driver.ts` 把 cursor 回拨到最新非机器人消息之前 → `yzj_advance_scan` 扫到 1 条真信号 `msg-scan`（`[文件]:r29-summary.md`，09:58）→ inspect digest 含该 `<msgId>` → 立项 `A-20260819-008`「巡检闭环 945125」并 feed 进度更新（refs=该 msgId）→ 第二次同 ref feed `idempotent:true`、事元仍 3 条。`E2E_HEADED=1 node .acceptance/verify-advance-patrol.mjs` → **ALL PASS**：看板「我关注的推进」出现该事项，时间旅程第三行「巡检发现：群「dsh-2」[文件]:r29-summary.md」，信息来源「已读取」。截图 `.acceptance/shots-advance-patrol/1-patrol-board.png`。队列头仍「尚未巡检」——scan 跑在 sidecar 进程，不写 GUI 的 cursor domain；要让状态行跳「上次巡检」需在 root 会话里让模型调用 `yzj_advance_scan`。

## 24.5 AI推进｜v1.5 意图线程订阅模型（2026-08-19，纯文档，无代码）

出处：0819 14:00 产品方案讨论会（转录 `转录：AI推进产品方案讨论 20260819 1400.txt`，会上确认三概念定型、命名口径、两个待补交付物）+ 用户旅程口述定稿。

| 面 | 交付 |
|---|---|
| 设计 | [`ai-advance-design.md`](../spec/ai-advance-design.md) 升 **v1.5**：§15 意图线程订阅模型（两类线程 / `yzj_advance_threads` demo 落位 / 渠道级 cursor 一次取流多事项分发 / Work+Dream 双节奏 / 策略选择文本约定）；决策 20–24 入表；分期表加 ③.2（待排） |
| 迁移合同 | 已从本仓删除（灵基终态文档迁出） |
| 图 | `docs/diagrams/advance-6-journey`（用户旅程按口述重画：意图线程×N 订阅、手动喂/关联两条路径、待我决定/待我验收双出口）。**图集清理**：删 `advance-2-lifecycle`（被 6-journey + 3-gate 覆盖）与 `advance-4-dream`（「巡检唤醒 Dream」触发关系被决策 21 双节奏取代）；`advance-1` 输入改「意图线程订阅」；`advance-7` 补第六块「策略选择结构化」。编号留空号不重排；图集已登记 docs/README.md |

**实现缺口（③.2，已于 §24.7 落地）**：`yzj_advance_threads`、面板「关联渠道」入口、scan 按订阅取流分发、决策区 `选项N` 渲染均已实现；feed 带 `subscribe` 与单文档源内容更新监测仍后置（见 §24.7 已知偏差）。

汇报产物不留仓库。合同唯一事实源 = spec v1.5。

## 24.7 AI推进｜③.2 意图线程订阅（2026-08-19，设计随提交）

设计基线 [`ai-advance-design.md`](../spec/ai-advance-design.md) **v1.5 §15**，决策 20 / 21 / 23。不改双表 schema / 六态 / 门控线 / feed 唯一变更通道；订阅承载在 host storage-domain，写路径只有两条：agent 立项参数（既有卡）+ 面板直写（D9 无卡）。

| 面 | 交付 | 证据 |
|---|---|---|
| 订阅注册表 | `tool-yzj/src/advance-threads.ts`：storage-domain `yzj_advance_threads`（v0）`advanceId → [{ token, kind, label, addedBy, addedAt }]`；token 字面量正则 `im:/doc:/todo:/event:/file:`；`im:` = persistent，其余 = document；内存垫底直到 `open()`（同 scan-cursors 范式） | `advance.spec.ts`：token 语法 / kind / 来源类型映射单测 |
| create 挂线程① | `yzj_advance_create` 新增可选 `threads` 参数（schema 字面量，pitfall-009）；非法 token 跳过；im: 标签写入时经群目录解析一次；digest 回报「已订阅线程」。`WRITE_SPECS` 不变（create 本就标准卡） | `advance.spec.ts`：带 threads 立项 → 注册表行（addedBy=agent、label=群名）；bogus token 被丢弃 |
| scan 聚合订阅 | `yzj_advance_scan` 的 `groups` 改为可选：缺省时聚合全部 open 事项的 `im:` 线程去重（completed 事项不进集合）；超过 8 个渠道报错提示分批（决策 17 刚性，不悄悄截断）；无订阅时报错带指引；digest 新增「订阅清单」行（每事项 token 列表）供模型分发；cursor 机制零改动（渠道级共享） | `advance.spec.ts`：同一群被两事项订阅 → `im message list` 恰好一次、cursor 只前进一次、两事项各自出现在订阅清单；completed 的订阅不进扫描集合；无订阅报错指引 |
| 单文档源关联 | `advance-thread-add` 对 document 类追加一条 `备注` 事元（来源类型按 token 映射：doc/file→文档、todo→待办、event→日程；refs=[token]）；重复关联被注册表 + 决策 19 同源去重双重幂等挡住 | `advance.spec.ts`：关联 doc → 一条 user 备注事元；重复关联不加行；解除只删注册表行、事元不动 |
| 服务面 + RPC | `ctx.yzjAdvance` 新增 `threadsOf` / `threadAdd` / `threadRemove`；`/yzj` +2 端点 `advance-thread-add` / `advance-thread-remove`（用户直写，无卡）；线程清单折进 `advance-get` 响应的 `threads` 字段，不另开读端点；`openNow` 同时打开两个 domain | `rpc.node.spec.ts`：两端点缺服务/缺载荷/服务报错/透传四类契约 + advance-get threads 折叠 |
| 面板 | 详情右栏顶部「订阅渠道」区：线程 chips（`data-testid="yzj-advance-threads"`，群/文/待/日/附图标 + 你关联/AI 关联 + × 解除）+「关联渠道」弹层（群 picker 复用 groups RPC + 手输 token 兜底）；决策区解析最新决策请求事元的 `选项N` 行渲染按钮（点击 = judge confirm_advance 带 note=选项全文），`影响` 行单独展示，无选项行时既有三动词原样 | `advance-pane.client.spec.tsx`：chips 渲染/解除、弹层群 picker/手输 token、选项按钮落 note、无选项回归 + `parseDecisionOptions` 单测 |
| 教学面 | `INSPECT_DISCIPLINE` 补订阅分发一句；create description 写「在群话题里立项时带 threads=[im:<groupId>]」；scan description 写 groups 可选 + 订阅聚合语义 | 工具 description 文本；digest 断言「订阅清单」 |

**真机（2026-08-19，本机 Mac，GUI 重启加载 worktree bundle，`yzj-cli` 已登录）**：`pnpm test` **592 绿**（基线 575 + 新增 17）。`node .acceptance/verify-advance-threads.mjs` → **ALL PASS**：sidecar 探针 `A-20260819-001`「线程探针 910289」走到 decision-needed → 决策区渲染 选项1/选项2 按钮 + 影响行、既有三动词仍在 → 点选项2 落 user 事元「确认推进：目标日期顺延两周」（你的判断）→ 关联渠道弹层群 picker（10 群）关联后 chip 出现、× 解除 → 手输 `doc:e2e-probe-doc` 落一条备注事元「关联渠道：e2e-probe-doc」。零页面错误。截图 `.acceptance/shots-advance-threads/1-decision-options.png` — `4-doc-thread.png`。**既有 E2E 回归**：`YZJ_E2E_GROUP=dsh-2 node .acceptance/verify-advance-feed.mjs` → ALL PASS（②③期现在反馈/事项卡/群房间喂入/picker 全通；话题步骤自跳过，见 pitfall-037：dsh-2 当前无话题锚点，属数据态非回归）；另以有话题的 测试群走查话题链路（抽屉 → 透镜 → 喂给推进 picker → 问助手预填不 followup）全绿。

**已知偏差**：(a) agent 在 feed 里带 `subscribe` 意图（§15.2 提及）本切片未做，订阅写路径只有 create 参数 + 面板直写两条（计划内排除）；(b) 单文档源只做「关联即一条事元」，内容更新监测未排期（计划内排除，spec §15.1 已注）；(c) Dream 每日节奏未落地（④期配套，本切片只保证 scan 聚合可被任何节奏调用）；(d) 浏览器验收的线程①演示走用户关联路径（storage-domain 注册表是 GUI 进程私有的，sidecar 写入对 GUI 不可见，同 §24.4 sidecar cursor 局限）——立项挂线程①与「同群两事项一次取流」由 fake CLI 单测覆盖；(e) 线程 chip 未展示「最近取流时间」（§15.2 投影句的可选细节，cursor domain 未按线程反查，后置）；(f) vitest client 测试的 harness 源 alias 在无兄弟 checkout的 worktree 下回退到 `~/dev/deepseek-harness`（`DSH_HARNESS_ROOT` 可覆盖）——环境适配，不改变「兄弟 checkout 是唯一事实源」语义。
## 24.8 AI推进｜④期知识沉淀出口 + 第七态 cancelled（2026-08-19，设计随提交）

设计基线 [`ai-advance-design.md`](../spec/ai-advance-design.md) **v1.6 §16**，决策 26–31（同日拍板：复盘=终局收口、面板不做独立沉淀按钮、一批一次确认、dream 只改 prompt、落点「推进复盘/<事项名>」、工具面零新增）。真机实验第 0 波人工基线（10 分钟/4 篇）是④期自动化收益的对照。

| 面 | 交付 | 证据 |
|---|---|---|
| 第七态 cancelled | `cancelled`（已中止）入状态机：非终态均可达、`cancelled→running` 可重启；judge 第六动词 `cancel`（用户直写无卡，D9）；open 队列/scan 订阅聚合/inspect 全排终局（`isOpenStage` 统一）；**终局 host 强制**：agent `stageTo=completed/cancelled` 一律拒绝（actor≠user）——顺带补齐 spec §13.5 早声称「状态机拒绝 completed」而代码未拦的偏差 | `advance.spec.ts` +5：cancel 落 user 事元/重启、legacy 库缺选项明示报错、agent 终局拦截、状态机边、list open 排除 |
| 存量表 schema 守卫 | `assertStageOption`：写 cancelled 前读 `sheet get` 校验「阶段」SingleSelect 选项（实测形状 `fields[].data.items[].value`），缺则明示引导补选项，不静默丢（迁移文档 §3 事实 5 / pitfall-003） | 真机走查命中（见下） |
| 面板 | STAGE_LABEL「已中止」+ dot 灰；队列排除终局；决策区底部低强调「中止推进」（二次确认态「确认中止？再点一次」）；终局（completed/cancelled）渲染「沉淀复盘」入口（跳对话域预填，复用「请 AI 验收」bus 模式） | `advance-pane.client.spec.tsx` +2：终局提示写 draft、二次确认；queuesOf 语义更新（终局不进队列，spec §2） |
| 教学面 | `INSPECT_DISCIPLINE` 补沉淀四步/纪要四步；feed description 同步（七态+终局禁止+沉淀流程）；模板两份落 `docs/spec/advance-review-template.md`（五段）/ `meeting-minutes-template.md`（金蝶四段式） | 文本断言随既有 digest 用例 |
| dream 取材 | `DREAM_PROMPT` 补推进事项取材指引（yzj_advance_list/get 读终局事项产物事元），放开「只用 memory_*」为「memory_* + yzj_advance_*（只读）」（决策 29） | `memory-yzj/src/dream.ts` |

**真机（2026-08-19 晚，本机 Mac，GUI 重启加载 main 合并后 bundle）**：`pnpm test` **602 绿**（595+7）；`node .acceptance/verify-advance-terminal.mjs` → **ALL PASS**：面板直写探针「终局探针」立项（无卡）→ 详情「中止推进」二次确认态正确 → judge cancel 撞上存量库缺 cancelled 选项，`assertStageOption` 明示引导（「请在多维表格给该字段补加选项 cancelled 后重试」）——不静默丢的诚实路径按设计工作。截图 `shots-advance-terminal/1-3`。

**存量库升级（同日晚，用户拍板「删掉重新加」）**：CLI 无补选项口子（实测：运行期写未注册值回读为空串，静默丢弃今日仍成立；`sheets/update` 端点仅供 rename）→ 对推进库做**备份→删「事项」表→按最新 itemFieldsJson 七态重建→导回**：事项 7 条字段级零差异、事元 24 条未动、阶段选项含 cancelled。备份留 `/tmp/yzj-advance-backup/`。升级后重跑 `verify-advance-terminal.mjs` → **ALL PASS**：探针中止 → 已中止 → 终局提示「沉淀复盘」→ 队列排除 → 跳对话域 banner「复盘沉淀已预备」。截图 `shots-advance-terminal/4-cancelled.png`、`5-export-review.png`。

**已知边界（计划内）**：(a) ~~存量推进库需手工补 cancelled 选项~~ 已由备份-重建-导回完成（见上）；(b) 终局事项从队列排除后详情不可再打开，「沉淀复盘」提示只在收口当刻可见（决策 26：主路径是用户口述）；(c) 复盘/纪要的批量落待办（决策 28）与面板直写一键沉淀（决策 26 明确不做）均未实现，属教学面口径。(d) 面板 judge 区「中止推进」按钮本期无单测覆盖 busy 态（二次确认已覆盖）。(e) banner 文案按 draft kind 区分（验收/复盘）——复用 bus 时记得带 kind，否则误导（本日走查抓到，已修）。
## 24.9 AI推进｜面板 UX 打磨（2026-08-20，v1.6 续）

缘起：用户走查后点名「事元溯源点击跳转做好一点、缺按钮、不合理设计都看看」。布局锚点用户现场确认：中栏=推进时间线、右栏=意图线程（订阅渠道）+事元（信息来源/产物）——本次未动布局结构。

| 面 | 交付 | 证据 |
|---|---|---|
| refs 溯源可点化 | 时间旅程 refs 从裸文本（`yzj:6a85…` 长串、不可点）改为 chips：剥 `yzj:` 前缀（模型按工具 description 字面误加的前缀）+ 类型图标（文/聊/待/程）+ 短 id；**doc → 知识库 web 直跳**（`window.open` 真链接，hover 见全 id），msg/todo/event → 跳对应域（无消息级锚点，决策 8 诚实降级）；同值去重（巡检合并 feed 的重复 ref 只渲一次）。sources 区与已有产物区条目同样可点 | `advance-pane.client.spec.tsx` +1（doc chip 是 <a> 含 docId 直跳、msg chip 点击切 im 域）；真机 `shots-advance-ux/audit-1-top.png` |
| 已结束折叠区 | 队列底部「▸ 已结束 N」：终局（completed/cancelled）事项不再蒸发，展开可点进详情——④期边界 (b)「终局提示只在收口当刻可见」就此补上（事后可达）；终局条目弱化显示 | 单测 +1（toggle 展开→点进→终局提示出现）；真机 `audit-3-closed.png` / `audit-4-closed-detail.png` |
| 立即巡检入口 | 队列头状态行旁「巡检」按钮 → 跳对话域预填巡检 prompt（复用 ask bus，新 kind='patrol'）——巡检不再只能靠 schedule/口述全文 | 单测 +1（draft kind=patrol、切 im 域） |
| banner 文案分流 | ask banner 按 kind 区分「验收问题已预备 / 复盘沉淀已预备 / 巡检请求已预备」；patrol 无事项时不显示空括号 | 走查抓到文案写死后修复 |

全量 606 绿。**产物区收掉（用户拍板 2026-08-20）**：「已有产物」区（sources 的文档类子集聚合）从右栏移除——产物是事元的一部分，随「当前判断来自哪里」呈现；spec §7 sideHtml 口径已同步。右栏自此只有意图线程（订阅渠道）+ 事元（信息来源）两区。

**事元来源区窗口化（同日续）**：「当前判断来自哪里」默认只显示最近 3 条 +「展开全部 N 条 / 收起」（与时间旅程「查看全部」同型）；意图线程的加（关联渠道弹层）/去（chip ×）为既有能力，真机确认在位。607 绿。

**目录级订阅（同日续，决策 32，用户拍板「知识库一整个才能自动获取增量」）**：token 词汇加 **`dir:<docId>`**（知识库目录节点；整库=库根目录 `dir:<kbId>`），kind=persistent 进持续渠道——scan 聚合时按 `doc list --parent-id` 取增量（首扫快照 docId→updateTime 建基线不回灌；增量=新增/更新文档，信号 refs=<docId>、sourceType=文档）；cursor 存 scan domain 新 `dirs` 表。关联弹层**去掉手输 token**（开发者界面不是用户界面）：只留 IM 群 picker + 知识库目录 picker（「我的知识（整库）」+ 一层 hasChildren 目录）；chip 图标加「库」。单测 +3（dir 扫描全生命周期：基线/新增/更新/静默；弹层无手输+目录 picker+dir 关联；threadKindOf dir=persistent）；真机：弹层关联「实验目录」ALL PASS（`audit-5/6`），scan digest 含目录基线行（`audit-7`）。608 绿。存量 doc:/todo:/event:/file: 单文档源保留（关联即事元，静态引用）。
## 24.10 AI推进｜Dream 蓄水池落地 + scan 截断修复（2026-08-20，决策 33/34）

**Dream 蓄水池（spec §17）**：`yzj_advance_dreampool` storage-domain（pool + meta 两表）；Work scan 的每个 accepted 信号（IM + dir）copy 入池 pending，Work 即时处理不受影响。工具面：`yzj_advance_dream_status`（pending 清单+水位+lastDreamAt，description 内嵌抽取流程教学）+ `yzj_advance_dream_mark`（标记 done，host 内部状态不进 WRITE_SPECS）。服务面 `dreamState()` + RPC `advance-dream-state`。面板队列头水位行「池中 N 条待抽取 · 上次抽取 HH:mm」+「Dream 抽取」按钮（ask bus kind='dream'，banner「Dream 抽取已预备」）。触发三径：手动（演示主路径）+ 水位提示 + 定时 schedule（沿用既有机制）；host 自动唤起 agent 会话后置（迁移文档）。

**scan 截断修复**：真机实验观察项 3 落地——单页 20 条截断丢晚到信号；改 `listImMessagesAll` 自动翻页取完增量（`MAX_SCAN_MESSAGES=200` 防爆上限）。回归用例：基线后涌入 25 条 → 一次 scan 全收（25 条新信号）。

**验证**：单测 610 绿（+dream 水位行用例 +dir 全生命周期 +翻页回归）；真机 `advance-dream-demo.mjs` ALL PASS：cursor 回拨→巡检入池→看板「池中 1 条待抽取」+「Dream 抽取」→banner 预备（`audit-8/9`）。明天演示路径=看板「巡检」→ 回看板看水位 → 「Dream 抽取」。

## 24.12 AI推进｜概念修正：意图线程 → 上下文来源（2026-08-20，v1.8，全量改名含代码）

用户拍板：「意图」属于事项（意图体），渠道只是事项的**上下文来源**——旧命名把意图倒挂到了渠道上。改名深度：文档 + UI 文案 + 代码标识 + storage domain 全量改，含 legacy 存储迁移。

| 层 | 改动 |
|---|---|
| 代码标识 | `advance-threads.ts`→`advance-sources.ts`；`AdvanceThread*`→`ContextSource*`；`threadsOf/add/remove`→`sourcesOf/add/remove`；service `threadAdd/Remove`→`sourceAdd/Remove`；create 参数 `threads`→`sources`；RPC `advance-thread-add/remove`→`advance-source-add/remove`；detail 折叠字段 `contextSources`（与事元证据 `sources` 区分） |
| 存储 | domain `yzj_advance_threads`→`yzj_advance_sources`（表 `sources`）；`ContextSourceStore.open()` 时若新域空且 legacy 域有数据则一次性迁移（best-effort） |
| UI | 右栏上区「订阅渠道」→「**上下文来源**」（入口「关联来源」），下区「当前判断来自哪里」→「**事元**」；testid `yzj-advance-source-*`；CSS `.subChip/.subSources` |
| 文档 | spec §15 重写（持续源/静态源二分）+ 术语表/分期/决策 20 同步；migration 三概念加 v1.8 修订注记；README 索引同步；diagrams advance-1/6 重渲染 |
| 历史节 | §24.5/§24.7 等历史留痕不重写（演进用追加段落，AGENTS.md 规矩） |

**真机验证**：重启 GUI 后 测试事项「上下文来源」区显示迁移过来的两个订阅 chip（测试群 + 实验目录 目录）——legacy 迁移成功；下区「事元」正常。610 绿。截图 `shots-advance-ux/ux-redesign.png`。
## 24.13 AI推进｜巡检收敛：host 机械 routine，AI 只在抽取时出场（2026-08-20，v1.8，决策 35）

用户拍板：「巡检应该是不需要 AI 的，抽取事元才需要」。原混合双节奏（Work 模型实时判断 + Dream 再抽取）冗余且漂移（复验判定 6 观察到同一信号集模型两次判断不一致）。

| 层 | 改动 |
|---|---|
| host | `YzjAdvanceService.startPatrolTimer()`（setInterval ≥300s，ctx.effect 注册/卸载）；tick = `patrolNow()` = coreScanAdvance 全量聚合入池，错误吞掉 |
| 工具 | `yzj_advance_scan` 降级为只读查询（description 明示 host 巡检自动入池、抽取走 Dream）；digest 不再附实时判断纪律；`INSPECT_DISCIPLINE` 删「巡检五步/订阅分发」改「抽取分发」 |
| RPC | 新增 `advance-patrol-now`（面板「巡检」按钮 = 立即机械一轮，不切域不写 ask） |
| 面板 | 水位达阈（DREAM_WATER_LEVEL=5）dreamState.waterLevelReached → 水位行「建议抽取」+ Dream 按钮高亮 primary |
| 文档 | spec §14 重写（回路图/14.3 机械巡检）；决策 34 水位 8→5、决策 35 入表 |

**验证**：609 绿（巡检测例改机械断言：不切域/不写 ask/RPC 计数）；typecheck 0。实时性 trade-off 记录于决策 35（偏差提示从实时变水位实时）。
## 24.14 AI推进｜存储切换：推进双表 dbt → local SQLite（2026-08-20，v1.8，决策 36）

云多维表格 record 服务间歇 500（code=10000506）全天多次：删探针重试 3+5+10 次全灭、演示数据无法导出。用户拍板 fallback：「如果还是有问题就把数据存储层换成 sql」。

| 层 | 改动 |
|---|---|
| 新增 | `advance-local-store.ts`：node:sqlite 双表（items/entries，fields 无损 JSON 中文键），singleton + `YZJ_ADVANCE_DB` 覆盖 |
| 核心 | advance.ts 六触点（resolve/fetchItems/fetchItemById/fetchEntries/todaysEntryIds/writeTable）加 sqlite 分支；`setAdvanceBackend('sqlite')` 在 tool-yzj apply 启用；测试零改动（不 call 即 dbt） |
| 数据 | 云导不出 → seed 脚本按实验记录重建 演示旅程（item + 5 事元，refs 用真实 docId）；sqlite 写路径探针已删；上下文来源订阅（storage-domain）本就本地，原样在位 |
| 验证 | 609 绿（dbt 测试路径不变）；真机：空板 hero → 创建落库 → seed 后 演示看板完整（截图 sqlite-check/ux-redesign） |

todo 家族仍留 dbt（用户未要求动）；dbt 路径保留作测试与 legacy 回退。
## 24.15 AI推进｜todo + 缓存同切 SQLite，云 dbt 真机全死（2026-08-20，v1.8，决策 37）

用户拍板：「待办也切到 sqlite，云的直接干掉；消息列表之类的缓存也进 sql」。

| 层 | 改动 |
|---|---|
| todo | `todo.ts` 四触点（resolveLibrary/fetchTodos/fetchTodoByTodoId/writeRecords）加 sqlite 分支；`setTodoBackend('sqlite')` 真机启用；测试留 dbt double 零改动 |
| 缓存 | `im-cache.ts`：localStorage L1 热备 + host SQLite L2 副本（scheduleSave 双写、loadPersisted L1 空时异步回填）；host 新增 `im-cache-get/put` RPC（ui-yzj node half 直开同库） |
| 存储 | 单库 `yzj_advance.db` 四表：items/entries/todos/im_cache |
| 验证 | 609 绿；真机 todo 创建落库且列表可见（验收脚本 ux-sqlite-todo.mjs）；im_cache 待真用户开群触发双写 |

云 dbt 残行（探针等）不再是任何路径的事实源；云服务恢复后可一次性物理清理。
## 24.16 ui-yzj｜推进「跳到消息」撞 home-fused 空 payload + overlay 跳转总线缺消费端（2026-08-20，pitfall-039）

用户报告：推进面板点「跳到消息」显示 `home-fused endpoint requires a groupId or sessionId payload` 且轮询刷屏。根因是 R27 overlay 空 占位 sessionId 与 slot 时代调用链叠加（详见 pitfall-039），连带 `requestImGroupFocus` 只有旧侧栏 panel 消费、overlay 时间轴 retarget 不了。

| 层 | 改动 |
|---|---|
| room-shell | binding fallback 仅 slot 模式（`yzj-home-*`）发起；新增 `subscribeImGroupFocus` 订阅（setActiveGroupId + rememberImSeat），推进跳转直达群 |
| transcript | `YzjFusedView` viewKey 空时 load effect 短路（不 RPC 不轮询不 setError）；空态文案「在左侧选择一个群开始。」 |
| composer | speakers 轮询在 `sessionId === '' && groupId === ''` 时跳过 |
| 验证 | 611 绿（room-shell 新增 2 用例：零调用断言 + imGroupFocus retarget）；真机 verify-advance-jump.mjs 全 PASS（无报错空态 → 点群开房 → 推进 msg 来源跳转直达 im 域群房间 → 零 page error） |

host 端 `stringField` 空=缺失校验保持原样（校验正确，错在 client 发空 payload）。Dream 抽取按钮的「跳群列表」体验断层属设计语义（askDraft 预备→话题问助手栏），见 ai-advance-design §14。
## 24.17 ui-yzj｜Dream 手动径重定义：host 直建会话一步到位 + 蓄水池面板可视化（2026-08-20，决策 38）

用户质疑决策 34 的 askDraft 两步形态：「不应该是跳转到新会话吗为啥是群里的话题助手」+「蓄水池没地方看有啥」。当时后置的「host 自动唤起会话」这轮补上——程序化建会话机制（话题同款）已验证。

| 层 | 改动 |
|---|---|
| host | bound-io 新增 `dreamAskPrompt()`（指令文本单一事实源迁 host）+ `runDreamSession()`（mint `yzj-dream-<stamp>` → agents.create + followup 指令为 turn 1 → publishHostSession 钉标题「Dream 抽取 · 池中 N 条」）；index.ts 新 RPC `advance-dream-run`（复用 topicAgentRoute/composition + attachYzjSession） |
| 面板 | Dream 按钮 → `advanceDreamRun` → `focusBoundSession(sessionId)`（关工作台盖板 + 聚焦主会话）；「池 N」按钮 → pending 明细浮层（dreamState 扩展 entries：id/channel/refId/content 前 120 字/sendTime） |
| 清理 | advance-ask.ts 删 `dreamAskText`/`patrolAskText`（后者 v1.8 收敛后已是死代码）；AskDraft.kind 收窄为 review/export；banner 文案删 dream/patrol 分支 |
| 验证 | 613 绿（advance-pane 2 用例改写：RPC+聚焦+不再写 draft；bound-io 新增 runDreamSession）；真机 verify-advance-dream.mjs 全 PASS（巡检入池 → 池浮层列 35 条 → 点抽取 → 盖板退下聚焦新会话「Dream 抽取 · 池中 35 条」→ 指令为 turn 1 → agent 开跑 dream_status → 零 page error） |

`yzj-dream-*` 是普通 agent 会话（非 room/topic 视图），确认卡按 WRITE_SPECS 标准弹。旧 askDraft 机制保留给「请 AI 鎮收」「沉淀复盘」（绑事项、话题上下文有延续合理性）。
## 24.18 AI推进｜事元 msg ref 事件级定位：跳到消息而非只到群（2026-08-20，决策 39）

用户拍板：「跳转可以跳到 message 吗不是只是群；需要定位的是产生事元的事件」——三层模型（事件→事元→事项）与 spec 一致，实现欠账两点：msg ref 只存裸 msgId 不带群信息、跳转只到容器不定位消息。本轮补齐。

| 层 | 改动 |
|---|---|
| 工具面 | scan digest 信号行 `<msgId>` → `<im:<groupId>:<msgId>>`（模型原样抄入 refs）；feed/create refs description 同步；dreamAskPrompt 教 agent 用池条目 channel+refId 组装 token |
| 跳转总线 | `requestImGroupFocus` 升级为 `ImFocusTarget { groupId, anchorMsgId? }`（字符串兼容旧调用方）；room-shell 消费 anchor 透传 YzjFusedView |
| 时间轴 | `YzjFusedView` 新 `anchorMsgId` prop：viewKey 切换后 setHighlightMsgId → 既有高亮机制滚动+高亮该消息行；手选群清 anchor |
| 面板 | 事元 refs chip 与来源列 msg 跳转接 `jumpToSourceMsg`：`im:g:m` 直达群+定位消息；legacy 裸 msgId 回退订阅渠道猜群 |
| 兼容 | 存量事元裸 msgId refs 降级（跳群不定位）；isRefReplay token 字符串比较不受影响（混格式漏判可接受）；锚点不在首屏窗口时诚实降级（到群，自动翻页后续增强） |
| 验证 | 616 绿（advance-pane 2 用例：anchor 直达/legacy 回退；room-shell 1 用例：scrollIntoView 落在锚点行）；真机 verify-advance-anchor.mjs 全 PASS（seed `im:<realGroupId>:<realMsgId>` 事元 → 点来源 → 直达 测试群 → 锚点消息行渲染 → 零 page error，seed 已清理） |

**§24.18 续（同日）**：用户追问「不是有 sqlite 缓存吗，总得捞过吧」——核实后补齐最后一段：捞过的消息本体都在 bound log（每群 500 条持久，fused 全量读），锚点在 log 内的定位本就全覆盖；唯一缺口是从未开过的群只 backfill 最近 50 条。transcript 新增锚点自动翻页 effect（viewKey 级有界 10 页，复用 loadOlder；找到/到底/超界即停），room-shell 测试断言自动以最老一条为 beforeMsgId 翻页。真机 verify-advance-anchor.mjs 升级为窗外锚点（newest 20 + old 翻两页取 ~第 60 条）仍全 PASS。617 绿。

**§24.18 再续（同日，三层结构 UI 化）**：用户追问「三层结构为啥 UI 没跟着改」——refs 此前对用户是截断 ID chip，事件层不可读。补齐事件层呈现：host 新 RPC `advance-ref-lookup`（`im:<g>:<m>` → bound log 命中的 谁/何时/说了什么），面板事元展开后 msg ref 命中渲染为可读事件行（点击仍定位消息，未命中降级旧 chip）。真机 verify-advance-anchor.mjs 事件行 PASS（`[08-20 17:06] 代少兵 …`）；调试中发现并修复验收 seed 缺 `entry_id` fields 键被 parse 静默过滤的坑（pitfall-040，此前一轮「锚点 PASS」实为裸 msgId 事元的恰一群路径假阳性，本轮 seed 修复后锚点+事件行才是真验证）。618 绿。

**§24.18 三续（同日，纯三层树）**：用户再纠「右边是事元、事元下面是原始信息；多条信息→一个事元，多个事元→演进状态」——上一轮把聚合列改名为「原始信息」方向错了：扁平聚合列本身就破坏三层树（N:1 归属关系在 UI 上不可见）。本轮收掉扁平列：详情主体 = 推进演进（事元时间线，副标「多个事元折叠出演进」），事元展开见「原始信息 N」区（事件行可读化+点击定位），侧栏只留「上下文来源」订阅管理；sideNote 改写为三层结构自述。aggregateSources 升级 citing（引用事元列表）保留在 API 面（agent 仍可用）；showAllSources 窗口化随列删除。测试：窗口化用例改为「聚合不再呈现」，msg 跳转用例改走事元展开路径；618 绿；真机 verify-advance-anchor.mjs（已改为事元展开→点原始信息行→跳转定位）全 PASS。

**§24.18 四续（同日，原始信息默认挂载）**：用户再纠「事元的列表怎么没了、原始信息放中间、这是 2 层」——上轮把原始信息藏进「展开详情」里，用户视角事元列表与原始信息的从属关系不可见（看着像两层）。改为默认挂载：每条事元行下直接渲染「原始信息 N」区（事件行/chip 默认可见，>2 条显示最新 2 条 + 「展开全部 N 条原始信息」；≤2 条且无 detail 时不再渲染 toggle）。三层一眼可见：事项→事元行→原始信息行。测试去掉展开前置步骤（默认可见）；618 绿；真机 verify-advance-anchor.mjs 全 PASS；演示详情实测 11 个原始信息区默认可见（截图 4-tree.png）。

**§24.18 五续（同日，doc 叶子可读化）**：用户「你看看！我感觉不对」——界面结构渲染正常（11 个原始信息块、零错误），真正不对的是叶子：doc 类原始信息是截断 ID chip（文 doc-id…），用户读不出文档是什么，三层看着像两层。advance-ref-lookup 升级为按 kind 解析（payload `{ refs: [{token,kind}] }`）：msg → bound log 事件行（既有）；doc → `doc get --id` 取 fileName（进程内缓存，miss 不缓存），面板命中渲染「文档 + 文件名」链接卡。真机 实测：4 个真实文档名全部显示（纪要·示例讨论等），截断 ID chip 清零；legacy 裸 msgId（Dream 抽取旧 digest 产物）仍降级 ID chip。619 绿。

**§24.18 六续（同日，事元描述默认展示）**：用户最终澄清「一个进度下面挂事元，事元本身也是一段描述，事元下面才是原始信息」——「事元」= 变化内容那段描述文字（此前折叠在「查看详情」里，视觉上进度行直接跳原始信息，描述层缺失）。改为 detail 默认渲染（entryDetail 样式，pre-wrap）；toggle 收窄为仅 refList>2（「展开全部 N 条原始信息」）。四层呈现齐备：进度行（changeType·summary）→ 事元描述（detail）→ 原始信息（文档名/消息事件行）→ 点击直达现场。619 绿；真机 演示详情 3 段描述默认可见（截图 look-final）。

**§24.18 七续（同日，进度节点分组）**：用户「那进度更新不是从多个事元来的吗🤔」——此前时间线每行=一条事元，「进度更新」只是类型前缀，用户模型里的聚合层（进度节点=多个事元）缺失。呈现层改为两级树：连续同 changeType 的事元聚为一个「进度节点」（组头=类型+事元数+时间范围，如「进度更新 8 个事元 · 18:28 → 15:58」），节点内每条事元=summary+detail（描述）+原始信息，事元行不再带类型前缀。数据模型不动（纯呈现分组）；真机 呈 6 个进度节点（备注1/进度更新2/目标更新1/进度更新8/偏差1…），完整四层：演进→进度节点→事元（描述）→原始信息。619 绿。

**§24.18 八续（08-21，三层定稿）**：用户最终拍板主骨架为三层「演进 → 事元 → 原始信息」——上一轮的「进度节点」分组层是过度解读（进度更新只是事元的类型标签，不是独立层），已删 groupEntriesByChangeType/entryGroup，回扁平事元时间线（事元行 = changeType·summary 进度行 + detail 描述 + refs 原始信息）。存量 10 条空 detail 事元补描述正文（sqlite 直改）；feed 工具 detail description 与 dreamAskPrompt 加纪律「事元必须带描述正文」。todo.spec 日期炸弹修复（DDL 硬编码 2026-08-20 随真实日期过期，改相对日期）。图 advance-1/5 措辞四层→三层并重渲。619 绿；真机 13 条事元全带描述、分组头清零。

## 24.19 AI推进｜dir: 订阅与速记归档库错位：新会议纪要不进池（2026-08-21，pitfall-041）

用户「关联了知识库却没有进抽取池，有几个新的会议纪要」——排查链：storages 三 JSON（sources/cursors/dreampool）+ `doc recent` 定位文档实际库。结论：机制全部健康（im: 增量正常、dir: 基线按时建立），扫不到的根因是**金蝶云 AI 速记把纪要归档到独立库（AI速记知识库 <kbId-minutes> / 会议生成的共享库 <kbId-shared>），不归档到用户订阅的「我的知识」**；叠加两道既有口径闸：doc list 只列一层子节点（整库订阅不看子目录）、dir: 首扫基线不回灌（决策 32）。

| 面 | 事实 |
|---|---|
| 订阅 | A-20260819-002 挂 dir:实验目录（4 文档）+ dir:我的知识整库（根层级 12 文档），基线 08-21 11:28 已立 |
| 新纪要实际位置 | 08-20 业务设计启动会纪要 → AI速记知识库；08-21 上午两场沟通会纪要 → 会议共享库 kb-shared（不在用户 workspace list） |
| 池 | 90 条 pending 全 im: 渠道，无 dir: 条目 |

补救口径：增量挂「AI速记知识库」dir: 订阅（基线后新纪要自动入池；临时共享库需 agent source_add 直传 token）；存量纪要不经池，Dream/话题里 agent 读 docId 直接 feed（refs=[docId]）。**产品缺口留⑤期**：速记归档库随会议增生、dir: 订阅追不上——需要速记库聚合订阅或归档目标可配进「我的知识」。无代码改动（机制符合 spec），spec §15.3 已补缺口注记，诊断路径固化在 pitfall-041。

## 24.20 ui-yzj｜关联来源 picker 只列「我的知识」漏掉 AI速记知识库（2026-08-21，决策 40）

用户「你好些关联的不是知识库而是文档？我的知识库是这两个感觉不对」——两个观察都属实：(a) picker 的「实验目录」实为 .otl 文档（hasChildren 才被当目录列出，dir: 扫描对它工作正常，otl 可有子节点）；(b) **picker 只 `find(name.includes('我的知识'))`，AI速记知识库（速记纪要自动归档地，pitfall-041 的根因库）永远不在选项里**。修复：picker 改列全部个人库（`doc workspace list --type personal`，实测返回 AI速记知识库 + 我的知识 2 库），每库一个整库选项 + 一层 hasChildren 目录，多库时目录 label 带库名前缀（`AI速记知识库 / xxx`）；个人库有界 6（MAX_PICKER_WORKSPACES）。另实测 `doc get --id <kbId>` 返回 DOC_NOT_FOUND——整库订阅 dir:<kbId> 走 listDirDocs 的「非 docId」分支直接按 workspace 列根层级，工作正常。测试：mock 改双库分返 + 断言两整库与库名前缀；619 绿。真机截图 picker-dirs.png：picker 列出 AI速记知识库（整库）+ 3 个速记纪要目录 + 我的知识（整库）+ 实验目录。用户挂上「AI速记知识库（整库）」后，基线后每场新会纪要自动入池；存量 3 份（08-20 三场会）不回灌，Dream 里读 docId 直接 feed 即可。

## 24.21 ui-yzj｜推进看板视觉走查：--dsh- 变量笔误 + 孤儿标签 + 时间线无轨道（2026-08-21，pitfall-042）

用户「推进的看板 ui 设计的很丑了很多东西也没对齐」贴图走查——截图里 ref 卡是无边框裸文字、每条事元底部吊着孤儿「文档/对话」、圆点无连线、右栏不可见。逐条定位与修复：

| 面 | 根因 | 修法 | 证据 |
|---|---|---|---|
| ref 卡裸文本 | `.refEvent`/`.entryDetail`/`.sourceCiting` 等 7 处 `var(--dsh-*)` 笔误（主题只有 `--dsw-*`），未定义变量整条声明静默无效（pitfall-042）；`<a>` 未去默认链接样式 | 全部改回 `--dsw-*` + `text-decoration: none`；卡改整行宽堆叠（max 560px）消除不等宽 wrap 锯齿；底色 `bg-base`（pitfall-023） | ux-shot-align.mjs 断言 borderTopWidth=1px；截图 ux-align-fix-timeline.png |
| 孤儿「文档」标签 | timeMeta 把裸 `sourceType` 渲在 ref 卡正下方，与卡内「文档」meta 撞脸 | 改带谓语出处脚注「记录自 文档 / 人工 · 你的判断」（「你的判断」措辞保留，verify-advance-feed/threads 断言锁定） | 同上截图 |
| 时间线不像线 | 圆点无轨道；时间戳整串日期重复占 96px+ 列宽 | mark ::after 画竖向连接线（top:10px→bottom:-24px 跨 18px 间距咬合下一圆点）；`formatEntryAt` 紧凑化（当天 HH:mm / 当年 MM-DD HH:mm，全量入 title），列固定 76px | 断言 ::after 高度 22px |
| 标题行过重 | changeType·summary 整条 700 粗体，长句糊一片 | changeType 拆成色阶小标签（蓝/红/绿随 tone），summary 降 600 | 截图 |
| 每条事元重复「原始信息 N · 多条信息可能被提炼为同一条事元」 | 八续定稿时删过的噪音行随展开功能回潮 | 收窄为「原始信息 N 条」头行 + 右侧「展开全部 N 条」（toggle testid 保留，verify-advance-anchor 锁定）；sectionHead 开发腔「三层结构：…」改用户话「每条事元可溯源到原始信息」 | 断言噪音文案清零 |
| 左栏 Dream 行断行 | 状态长文 + 池 N + Dream 抽取挤一行 wrap | dreamLine 改纵向：状态一行、按钮一行（dreamActions） | 整页截图 |

单测 619 绿、typecheck 绿；真机（GUI 11:53 重启 + bundle 直链本 checkout）ux-shot-align.mjs 全 PASS，截图 shots-advance-ux/ux-align-fix-{full,timeline}.png：三层骨架不动（演进→事元→原始信息），右栏「上下文来源」chips 正常呈现（用户截图右栏缺失为旧 bundle 所致，重启即恢复）。

## 24.22 ui-yzj｜ref 解析升到全量：裸 msgId 扫绑定 log、dp-* 池 id 还原原始出处（2026-08-21）

用户「聊怎么都是id还有源dp也是id又是啥，是不是有些不在sqlite里面」——实测否定猜想：**数据都在本地**（裸 msgId 全部命中 bound log backfill；dp-* 全部命中蓄水池，池条目 done 也保留），漏的是解析面：

| ref 形态 | 旧链路 | 新链路 |
|---|---|---|
| `im:<g>:<m>` | bound log 直查（已有） | 同左 + hit 带 jumpToken |
| 裸 msgId（08-20 Dream 旧 digest 产物） | client 直接不上送（只送 im:），渲染「聊 <msgId>」裸 id | host 经 `listBindings` 扫全部绑定会话 log，命中渲染事件行 + jumpToken 锚点直达；真 miss 才降级「聊 群消息」chip（不露 id） |
| `dp-*` 池 id（抽取 agent 违反 prompt 抄的池内键） | kind=other 不上送，渲染「源 dp-1787…」 | yzjAdvance 新增 `dreamPoolLookup(ids)`（含 done；池永不删）→ channel+refId 还原：`im:` → log 取 fromName/本体（miss 用池副本）+ jumpToken；`dir:` → doc get 文件名卡 |
| doc | `doc get` 文件名（已有） | 同左 + hit 带 docId |

client 渲染改为 **hit 优先**：命中一律按 hit.kind 渲染（文档卡/消息事件行），entry.sourceType 推断的 kind 只作未命中降级——agent 乱写 ref 形态时 host 按 token 形状兜底。写侧纪律同步加固：dreamAskPrompt 明确「禁止把池条目 id(dp-*)抄进 refs」。面板「聊 群消息」降级 chip 保留点击（裸 id 走锚点/恰一渠道猜群，决策 39 语义不变）。

测试：tool-yzj `DreamPoolStore.lookup`（含 done）；rpc.node spec 四 ref 形态（dp→msg/dp→doc/裸 msgId/miss）；client spec 三例（裸 msgId 事件行不露 id、dp-* jumpToken 锚点、miss 降级「聊 群消息」）。624 绿 + typecheck 绿。真机（GUI 重启后）：演示时间线 14 条事元 refs 全部可读（同事乙/同事甲事件行 + 文档名卡），dp-/裸 hex 清零，截图 ux-align-fix-refs.png（ux-shot-align.mjs 增两条断言全 PASS）。

## 24.21 落地｜AI速记知识库订阅 + 存量 3 份纪要事元化（2026-08-21，决策 40 后续动作）

用户「你帮我搞定这两件事」：(a) 挂「AI速记知识库（整库）」dir: 订阅——`.acceptance/verify-subscribe-lingee-lib.mjs` 走面板直写点击完成并验证 sources.json 落盘（dir:<kbId>，之后每场新会纪要自动入池；首扫基线不回灌存量）。(b) 存量 3 份纪要（08-20 三场会）进事元——`.acceptance/verify-minutes-to-entries.mjs` 在**全新 harness 会话**发定向指令（读 3 docId → yzj_advance_feed refs=[docId]，无基准字段无确认卡），agent 落 E-20260821-002/003/004 三条事元（摘要+共识描述+refs 齐全）。

**执行中暴露的 harness 侧故障（待查，非本仓代码）**：首选路径「测试群话题问助手」的既有话题会话（yzj-topic-…-<topicId>，08-18 建）在 turn 3 直接以 `invalid pi-ai replay state: unknown state kind`（INVALID_REPLAY_STATE）错误结束，零工具调用——replay state 损坏与历史事件相关，全新会话无此问题。该话题里残留一条无回应的指令气泡（无害）。自动化启示：Playwright 操作 GUI 时长任务会撞真机同后端操作（第一次 0/3 超时部分因此）；`fill()` 后必须读回 inputValue 验证 React 受控 state（第一次空发由此）；.mjs 里写 TS 类型注解这种低级错不该过手。

**§24.21 续（同日，时间线倒序）**：用户「时间线是不是反了新的在前面」——此前渲染按 host oldest-first 窗口直出（最新事元沉底，刚落的 E-002/003/004 要滚到底才见）。改为渲染层 `[...entries].reverse()` 新→旧置顶（host 窗口契约不动）；「查看全部 N 条」在底部语义自然成立（往下=更早）。真机 timeline-reversed.png：顶部 13:21 三条纪要事元，下接 10:38 偏差（原始信息已是消息事件行+文档名——refHits 可读化同轮生效）。35 测试绿。

**§24.21 再续（同日，时间线收敛 + 竖线贯穿）**：用户「时间线填的东西太多了应该少一点点开再展示具体的，然后线都没有连起来了」——两个诉求同根：(a) 事元默认全展开（描述+原始信息+出处全露，一屏只看 3-4 条）改回**默认收敛只露进度行**（changeType 标签+summary 两行截断+「详情」），整行可点展开看描述/原始信息/出处，二级「展开全部 N 条」取消（展开即全量 refs）；(b) 竖线断的根因是 `.mark::after` 固定 26px 长而展开的 timeItem 高几百 px——改为 **timeItem 级贯穿轨道**（`::before` 从圆点中心贯穿整条高度并延伸进 gap，x=76+10+4-0.75px），展开态也不断线。测试统一加 expandEntry 辅助（8 个 ref 用例先点展开）；倒序后 index 0=mock 末条注意点。真机：收敛态一屏 18 条、竖线全程贯通（timeline-collapsed.png）、展开完整（timeline-expanded.png）。执行插曲：并行会话同文件推进决策 41（latestDriver 决策区/事元「问助手」discuss 按钮/advance-ask kind+discussAskText），叠加编译断点两处（advance.ts `changeType`→`input.changeType`、advance-ask 导出）由双方各自补齐，最终 build/bundle 全绿、36 测试绿；决策 41 的 spec/文档留痕由该线补。

**§24.21 四续（同日，原始信息不露 ID）**：用户「你这个原始信息不要显示 id 呀」——「会议」来源的事元引用 `im:<g>:<m>` 消息 token，但 `refKindOf` 只按事元 sourceType 判（会议→doc），token 被误当文档渲染成「文 im:<msgId>」截断 id 链接。修复：kind 改为 **token 前缀优先**（`im:` 必是 msg，sourceType 只兜底），refHits 收集段同步逐 ref 判；未命中降级一律泛化类型名（文 文档/聊 群消息/待 待办/程 日程/源 来源，新增 REF_LABEL），任何分支不再拼截断 id。回归用例：会议来源 + im: ref 渲染事件行。630 绿；真机 refs-no-id.png：两条 13:54 事元的原始信息均为消息事件行（[08-21 11:47] 同事乙 … / [08-21 10:38] 同事甲 [文件]:转录：访谈.txt）。并行会话的决策 41 discuss 用例与收敛默认冲突（discuss 按钮在展开区）已补 expandEntry。

## 24.23 tool-yzj+ui-yzj｜动作型建议卡 + 空决策区兜底 + 事元「问助手」（2026-08-21，决策 41）

用户「产生的决定啥的这里也没有变化呀…应该 dream 要用 agent 产生一些东西呀例如代办？发消息对齐？定会议？」——两个事实层：(a) 该事项处于 decision-needed 但全库无一条「决策请求」事元（旧纪律喂「偏差+stageTo」），决策区只剩三个裸动词，要决定什么完全不可见；(b) Dream 只会记事元，不产出可执行动作。拍板：动作型建议卡（要简单、可多个动作、看板随时能就某条进展问 agent）。

| 面 | 交付 | 证据 |
|---|---|---|
| 合同（host 强制） | feed 校验 `stageTo=decision-needed` 必须 `changeType=决策请求`（错误信息即正确姿势指导）；INSPECT_DISCIPLINE / feed 工具 description / dreamAskPrompt 全部改产「问题 + 动作行」（`动作: 建待办\|发消息\|定会议 \| 键: 值 \| …`，决策 23 文本约定的行动化扩展） | advance.spec +1（偏差推阶段被拒、阶段不动、零事元写入） |
| 动作执行（面板） | `parseDecisionOptions` 升级解析动作行（未知类型留原文）；动作按钮组各自独立：建待办 → `createTodo` 直落（截止→ddl、负责人→tags），发消息 → 就地草稿框预填投到恰一订阅群（`sendMessage`，人过目再发），定会议 → 跳日程域；执行后置灰「✓ 已建/已发」并 `advanceFeed` 落 user 留痕事元 | client spec 三例全链路（todos/sent/feeds 断言 + 置灰 + 跳域） |
| 空决策区兜底 | decision-needed 但无决策请求事元 → 摆最新驱动事元（summary+detail）+「没有带上建议动作…点问助手补齐」提示，经典动词保留 | client spec +1；真机（13:54 偏差事元驱动）h3 非空 + 提示 + 动词全在 |
| 事元「问助手」 | 每条事元展开后出处行尾「问助手」→ askDraft kind=discuss 预填「关于…这条进展：…先 yzj_advance_get 看上下文」→ 切对话域；banner 文案分流加「进展讨论已预备」。落点=绑定家园会话问助手栏（与请 AI 验收同径）；精确回到「产出它的 Dream 会话」需事元表加 producer 列（dbt 重建），本轮不做（记为取舍） | client spec +1（draft kind/text + 切域） |

并行会话同日把时间线改为「倒序 + 默认收敛」（commit 77f4f90/25b00f6，问助手按钮随出处行入展开区，测试经 expandEntry 先展开）；两边工作已在工作树合流：630 绿 + typecheck 绿。真机（GUI 14:27 重启）verify-advance-actions.mjs 全 PASS，截图 ux-actions-decision.png。注：成功指标卡 0/0/0 是指标 current 从未被 feed 更新（动作卡里「建待办」类执行回写不涉及指标）——指标更新纪律留待下轮（Dream 比对后应回写 current）。

**§24.21 五续（同日，出处脚注按 refs 载体）**：用户「为啥是记录自会议啊这不是 im 来的吗，我们的信息来源没有字段区分？」——字段是有的，但语义没分清：sourceType 记**内容场合**（agent 提炼时判断「会议讨论来的」），refs 才是**溯源载体**（客观 IM 消息）；「记录自」措辞承诺载体却渲染了 sourceType，于是 IM 提炼的事元显示「记录自 会议」。修复：新增 entryOriginOf——按 refs 实际 kind 聚合（msg/doc/todo/event → 群消息/文档/待办/日程，多类 join「·」），无 refs 退回 sourceType；actor=user  的「你的判断」标记不变。spec §1 事元定义补「来源类型 vs refs 的语义分工」。630  绿；真机两条 13:54 事元脚注均为「记录自 群消息」（origin-by-refs.png）。

**§24.23 续（同日，决策卡讨论回环）**：用户「需要我决策的卡片应该可以回到对话中继续聊，选项应该是变化的/askuserquestion，而不是写死的」——决策卡加「回到对话继续聊」入口（预填问题上下文的 discuss 草稿切对话域；agent 聊出新建议按抑制判据补/更新决策请求，用户再回看板拍板，闭环）；有 agent 产选项/动作行时写死的 judge 动词降级次要行（verbsSecondary，确认推进去 primary）——动态内容为主、写死动词为辅。兜底卡同有讨论入口。client spec 增补（讨论草稿内容/降级 className/兜底卡入口），630 绿；真机 verify-advance-actions.mjs 增「回到对话继续聊」断言全 PASS。

## 24.24 bundle｜移除 schedule/time-context 挂载行：决策 35 遗留死重收尾（2026-08-21，决策 42）

缘起：用户在 dream 固化会话里看到 `Time sampled while preparing turn X, step Y` 反复注入（每 step 一条），质疑「为啥 yzj 要加这个」。排查链：`dsh web --dump-config` 组合树显示两行挂在 `# == @dsh-yzj/bundle` 段落——来源是本仓 `cordis.patch.yml`（v1.4 决策 13/16，为「巡检五步」模型教学挂的）；但 v1.8 决策 35 已把巡检收敛为 host 机械 routine（`startPatrolTimer`），Dream 定时走 dream.json `dailyAt` 自管 tick，`packages/*/src` 全仓对 harness `schedule` 服务与 `schedule_create` **零引用**——挂载行成为死重，每个会话每个 step 白付三行读数（time-context 默认 `refreshIntervalMs=0`）。harness 官方默认 composition 本就不启用 time-context（仅 `examples/web-schedule` opt-in overlay），移除后与官方口径对齐。

| 面 | 交付 | 证据 |
|---|---|---|
| 挂载行 | 删 `cordis.patch.yml` 的 `time-context` / `schedule` 两行（同 id 设计使官方 overlay 仍可覆盖恢复） | `dsh web --dump-config` 组合树无此两行 |
| 依赖 | 删 package.json `@deepseek-ai/dsh-time-context`；**保留** `@deepseek-ai/dsh-schedule`——robot-yzj `!routines` bang 命令以库形态 import `foldScheduleEvents`（折叠会话内 schedule 事件的纯函数，插件不挂载时返回空列表，回复「本会话暂无定时提醒」），tsdown 打包 external 化该 import，发布形态依赖它解析 | `packages/robot-yzj/src/router.ts` import；`lib/robot-yzj.mjs` 保留 external import |
| 文档 | spec 决策 13/16 标注 v1.9 废止、新增决策 42，版本头升 v1.9 | ai-advance-design.md |

**教训回写**：决策 35（巡检去模型化）落地时只改了巡检机制、没收挂载行的尾——机制级决策变更应同轮清点其带进来的 composition 行。pitfall 库未新增条目（无「现象与预期不符」的调试过程，属决策债务收尾）。

**§24.20 续（同日，picker 文档标签）**：用户「为啥这里又有知识库又有文档」——实测 `doc list` 节点：灵基知识库**没有独立文件夹对象**，「目录」= 含子页的 .otl 文档（`type=2`/`fileSuffix=otl` + hasChildren；实验目录 childrenCount=4、纪要-总结 childrenCount=1 都是文档）。picker 给这类节点加「（文档）」标签 + 弹窗说明「订阅它=看它的子页变化」，整库条目不变；不移除（实验目录这类文档订阅是真实在用的能力）。client spec fixture 带 type/fileSuffix、断言标签与关联 label；630 绿；真机 picker 4 个文档节点全部带标签（截图 ux-picker-doctag.png）。

**§24.20 再续（同日，picker 收窄整库）**：用户「就整库就好了别搞太复杂」——picker 不再列一层目录/含子页文档（上一续的「（文档）」标签方案被更彻底的收窄取代），只列个人库「整库」；弹窗文案与分区标题（知识库（整库订阅））同步。存量 dir: 订阅（实验目录等文档级）在 registry 与巡检面不受影响。client spec 改断言（只列两整库、关联 label=「我的知识（整库）」）；638 绿；真机 picker 仅剩「AI速记知识库（整库）/ 我的知识（整库）」（截图 ux-picker-libonly.png）。

## 24.22 tool-yzj｜yzj-cli v0.1.4 对齐：8 个新工具 + 删除族 --yes 兼容必修（2026-08-21）

用户转发 v0.1.4 发布（im 群组管理 / doc search·write·download·block replace / 企业 workspace 权限）拍板「新功能有价值，对齐」。本机 0.1.3→0.1.4 升级（升级引发 keychain ACL 重弹——未签名 node 脚本 Always Allow 不持久，已在钥匙串访问.app 改「允许所有应用」+ 重登恢复；凭据明文全程未接触）。

| 层 | 改动 |
|---|---|
| doc.ts | 新增 `yzj_doc_search`（只读，限库分页）、`yzj_doc_write`（整篇覆盖/追加，standard）、`yzj_doc_download`（落本地，overwrite 时 standard）、`yzj_doc_block_replace`（范围先删后插，standard） |
| im.ts | 新增 `yzj_im_group_search`（只读）、`yzj_im_group_create`（standard，成员 2-10 校验）、`yzj_im_group_members_add`（standard）、`yzj_im_group_members_remove`（strong + --yes） |
| **兼容必修** | v0.1.4 给删除族全加强制 `--yes`（doc delete / block delete / sheet table·record delete / calendar event delete）——既有封装全缺，0.1.4 下这些工具会失败；统一透传（产品确认卡已确认，--yes 不再二次挡） |
| guard/cards | WRITE_SPECS +6（remove strong、write/block_replace/create/add standard、download when overwrite）；cards 工具名 +8 与中文名 |
| 测试 | v014-tools.spec.ts 8 例 fake 组装断言（含 --yes 透传×5、成员窗口校验）；tools.spec.ts +2 真实冒烟（doc search 命中 纪要×4、group search 命中 测试群）——640 绿 |

未对齐（留观）：workspace 企业级权限参数（demo 个人库够用）；block replace 与 block update/delete/insert 能力重叠（便捷封装，低优先但已顺手补齐）。工具总数 51→59、写工具 27→33（根 README 同步）。

**§24.22 续（同日，v0.1.4 完全适配收口）**：「完全适配了吗」核验补最后一块——`yzj_doc_workspace_create` 透传 `--visibility`（1=企业/2=个人）与 `--all-member`（企业全员 2=可编辑/3=可查看，v0.1.4 企业库特性），组装断言进 v014 spec；GUI 重启让 8 个新工具真机注册（lib/tool-yzj.mjs 核验 19 处新工具名引用）；全量 641 绿（含 2 个 v0.1.4 真实 CLI 冒烟；一次间歇抖动复跑即过）。面板全局 search RPC 是 `contact user search`（搜人），doc search 面板入口留作后续（非适配必选项）。

**§24.23 再续（同日，讨论入口直开 agent 问答面）**：用户「问助手/回到对话继续聊为什么都是回到云之家对话而不是 agent 对话」——原路径只切 im 域 + banner（用户还要自己开话题抽屉，两跳）。新增 topic-open latch（workbench-domain）：入口点击 → 预填 discuss 草稿 → 切 im 域 + 聚焦订阅群 → latch `{groupId, sessionId|title}` → 群 transcript binding 就绪后消费：有最新话题直开抽屉，没有则 `homeTopicOpen` 按标题现 mint（「进展讨论 · …」/「决策讨论 · …」）；无订阅群退回 banner 老路径。641 绿；真机点「问助手」直接落在 测试群最新话题的抽屉、问助手栏已预填「关于推进事项 A-…这条进展…」（截图 ux-discuss-drawer.png）。

## 24.23 Dream 取材纪律升级 + 知识库搜索框（2026-08-21）

用户两问：「UI 要不要加这些（v0.1.4）？Dream 有点笨要不要加工具？」

**Dream 笨的确诊（证据）**：最近有产出的 Dream 会话（yzj-dream-20260821-151102，产出 E-20260821-001 偏差）全程只 5 次工具调用（dream_status/list/inspect/feed/mark），**零深读**——没有 im message list 读前后文、没有 doc get/block list 读正文、没有 search 检索。池条目只是一行摘要（dir: 条目甚至只有文档标题），它凭标题猜当然笨。**根因不是缺工具（59 个工具它都能用），是指令没取材纪律**。修复：dreamAskPrompt 加取材段（dir: 条目必先 doc get+block list 读正文；im: 拿不准就读前后各 10 条；相关判断可 advance_get/doc search 找对照；detail 必须写读到的原文要点不是复述标题）。

**UI 适配取舍**：知识库页加搜索框（高性价比：47 个库翻目录找文档是高频痛点）——host `doc-search` RPC + `fetchDocSearch` + 左栏顶部搜索框（选中库时限库搜），结果行点击 openDoc 预览。不做：建群/选人 UI（低频、contact 选择器成本高，agent 面已能）、文档编辑器（write/block replace 属 agent 面，面板不做编辑器）。下载按钮留后续（预览区顺手位）。

测试：panel-switch 补搜索框用例（Enter→fetchDocSearch→命中行→点击开预览）；真机 doc-search.png：搜「纪要」命中 4 行、点击打开全文预览。644 绿。

**§24.23 续（同日，知识库类型分组）**：用户「能不能区分个人和其他类型啊还是有什么类型那看看先」——先查数据：51 库中 visibility=2（个人）仅 2 个（AI速记知识库、我的知识），visibility=1（企业）49 个，无更多类型（allMember 全 None，无企业全员库）。左栏按 visibility 分组渲染：「个人」组置顶 +「企业 / 团队」组随后，组标头小字（paneGroupLabel）。panel-switch 补分组用例（标头存在 + 个人组整体在企业组前，与数据源顺序无关）；真机 ws-groups.png。645 绿。

## 24.24 tool-yzj+ui-yzj｜决策队列与待决出口主权：决策不被下一次 Dream 覆盖（2026-08-21，决策 43）

用户「产生的决策会给下一次 dream 覆盖掉？我感觉这不太对」——核查两路覆盖都属实：① 卡面取最新决策请求（latest-wins），新 Dream 喂新卡就把未处理旧卡顶出决策区（只剩时间线）；② 状态机允许 agent feed decision-needed/ready-for-review→running，未处理决策可被静默拖出待决。修复：

| 面 | 交付 | 证据 |
|---|---|---|
| 决策队列（面板） | 决策请求按时间排队，卡面=最旧未处理条；judge 事元带 `判定动作` 字段（ENTRY_F.judge，service.judge 落），最近判定之前的决策请求算已处理；>1 条时区头「待你决定 N 条」+ 卡内排队提示。处理完一条自动浮出下一条 | client spec：judge 结算前旧卡不被顶（E-1 隐藏、E-3 浮出）+ 无结算时最旧先出与「2 条待决定排队」 |
| 待决出口主权（host） | `decision-needed`/`ready-for-review` 的 stageTo 离开在 actor≠user 时抛错（「只能由用户在看板拍板；agent 请补进现有决策请求或保持静默」），与决策 27 终局主权同构 | advance.spec：decision-needed/ready-for-review 被 agent 拖出均拒绝、阶段不动、零事元；judge 标记落库+parse 回读 |

648 绿 + typecheck 绿；真机 18:33 重启 verify-advance-actions.mjs 全 PASS。配套说明：抑制判据（同判据补进现有决策请求不新起）仍是第一道闸，队列是兜底防踩；agent 侧无需新纪律。

**§24.24 续（同日，队列→单卡综合修正）**：用户「应该只有一条决策 但是后续要根据这个综合起来产生新的才对 因为会有实效性」——队列方案（最旧先出+排队列表）被修正为**单卡综合**：① 面板卡面=最近 judge 事元之后的最新决策请求（永远只有一条）；② host 强制「综合自」合同：已有未处理决策请求时，新决策请求 detail 必须带「综合自: <旧卡 entryId>」并写明旧问题并入/失效，缺一即拒（错误信息教写法）；③ 卡面渲染「此卡综合了 E-x 的未决内容」链，旧卡留时间线。INSPECT_DISCIPLINE（抑制与综合）/ feed 工具 description / dreamAskPrompt 同步。撤销排队列表 UI（queueList 只活了一轮）。测试：host 综合自强制（无标记被拒/带标记放行）、client 单卡+综合链渲染、parse mergedFrom；650 绿。真机活卡：首张真决策请求上线（评审两个范围补充：问题+分析+建待办/发消息动作+三选项+影响行，截图 ux-decision-card-live.png，seed-decision-card.mjs 全 PASS，出处=session-ace209e5）。

## 24.25 领域模型收敛：事元驱动闭环 + 行动建模（2026-08-21，决策 44/45，设计留痕）

从「演进应该有什么类型」起的五轮讨论收敛：演进无类型（类型是事元标签）→ 行动不设 changeType（决策卡动作行 + todo 域承接）→ 行动抽象 > todo（执行器多态：人/IM/日程/未来 AI）→ 系统本体 = 观察→分析→决策→执行→再观察闭环 → 领域模型按「环上每段弧必须有载体」构造。交付：

| 面 | 交付 | 证据 |
|---|---|---|
| 领域模型合同 | [`../spec/advance-domain-model.md`](../spec/advance-domain-model.md) v1.0：五环弧→载体映射、对象清单（推进事项/事元/上下文来源/蓄水池/行动）、三条公理、断点清单；刻意不设信号/建议卡/清单实体 | 文档入库 |
| 领域模型图 | [`../diagrams/advance-9-domain-model.{html,png}`](../diagrams/advance-9-domain-model.png)：手写 HTML+SVG（archscribe panorama 模板布线限制放弃——右面板入线硬编码来自中间面板，「④执行→执行器」分派线画不出）；分派/效应回流/落事元三线齐全 | 图入库，PNG 走查通过 |
| 决策 44 | 行动 = 事元结构化载荷起步，实体化留缝（推翻信号明文化） | 决策表留痕，未实现不涉及代码 |
| 决策 45（**待实现**） | 闭环强制：执行事元必带效应指针 refs + 效应对象自动进订阅集；done 态从事元流折叠 | 决策表留痕；现状三断点（回流断/溯源断/done 态丢）记录在案待排 |

archscribe 旧产物（advance-9 spec.json/gif/excalidraw）与 HTML 版不一致，已删（git 可恢复）。无代码变更，不动测试。

## 24.26 判据与纪律文本面：分流判据 + 偏差推论链 + 静默判据精确化（2026-08-21，决策 46/47）

同日讨论收敛的后续三问：① 「agent 识别意图时建推进还是待办」——分流判据此前真空（两工具 description 互不提对方）；② 「无影响的信号不落事元吗」——我一度把静默判据错述为「不落」，用户纠正：无影响的波动也是演进过程；③ 「影响的叙事缺一层吗」——区分出影响的既有落点（写时判定 changeType/detail + 读时投影）与缺的叙事折叠（延迟决策）。交付：

| 面 | 交付 | 证据 |
|---|---|---|
| 决策 46 分流判据 | 「完成标准自明→待办 / 需跨时间跟进判断→推进 / 拿不准建待办」；`yzj_advance_create` 与 `yzj_todo_create` description 互引 | 决策表 + 两工具 description 文本断言随既有用例 |
| 偏差推论链纪律 | INSPECT_DISCIPLINE 偏差条 + dreamAskPrompt：偏差事元 detail 必须写「事实→影响了什么→为什么」；缺推论链的偏差等于没判 | 文本落码，feed 工具面即生效 |
| 静默判据精确化 | 「管打扰面不管记录面」：有关但无影响仍落进度/备注事元；只有无关信号才跳过（池副本留审计） | INSPECT_DISCIPLINE 静默条改写 |
| 决策 47 演进折叠延迟决策 | 永不做实体摘要层；视图层折叠触发信号 + 折叠键=目标版本段 | 决策表 + domain-model §4.3 登记 |
| 领域模型文档 | 公理 3 升级「生死人主权」（入口确认卡 + 出口 judge）；新增 §4.1 诞生分流 / §4.2 判断的实体化 / §4.3 延迟决策登记 | advance-domain-model.md v1.0 同提交演进 |

全量测试 + typecheck 随提交验证。决策 45（闭环强制 advance-action-run）仍为待实现，方案已评审（新 RPC host 编排三效应：执行→refs 留痕→自动订阅 + 幂等闸 + done 态流折叠）。

## 24.27 ui-yzj｜闭环强制落地：`/yzj advance-action-run`（2026-08-21，决策 45 实现）

按 §24.26 评审过的方案实现——「执行→再观察」弧闭合：

| 面 | 交付 | 证据 |
|---|---|---|
| host 编排 | 新模块 `advance-action.ts`：`runAdvanceAction` 幂等闸（同动作序 key 或同 kind+文本已留痕则不双执行）→ 三 kind 执行（todo.create / sendImAndLog+extractSendMsgId / event 跳转留痕）→ 执行事元（refs=效应指针，detail 带 `动作序: \| 种类 \| 文本` 标记）→ todo 效应对象自动 sourceAdd 订阅；效应失败整体不落事元，订阅失败降级 warning | `advance-action-run.spec.ts` 9 项：三效应原子 / im refs / msgId 缺失降级 / event 留痕 / 双键幂等 / 效应失败零事元 / 服务缺失明示 / 订阅失败不回滚 |
| RPC | `/yzj advance-action-run` 端点（payload 校验 + yzjTodo/yzjHome 服务注入） | index.ts case；typecheck 绿 |
| client | advance-pane：runAction/sendActionMessage 换调新端点（废止 createTodo+advanceFeed 两步手拼）；`doneActions` 内存 Set 废止 → `foldDoneActions` 从事元流折叠（刷新不丢；kind+文本 兼底扛综合卡重排）；warnings 显示「已完成，但：…」 | `advance-pane.client.spec.tsx` 动作卡用例改写 + 新增折叠用例（已有执行事元渲染已执行且禁用、未执行可点） |

全量 660 绿（68 文件）+ typecheck 绿；build + bundle 已跑。真机验收待重启 GUI 后走查（面板点动作卡 → 事元带 refs + 订阅出现 todo: 源 + 刷新后已执行态保持）。

## 24.28 dsh-2 闭环演习：决策 45 真机验收 + todo 渠道断层证实（2026-08-22 凌晨）

按 [`../../.acceptance/advance-dsh2-experiment.md`](../../.acceptance/advance-dsh2-experiment.md) 设计执行（约束：消息只发 dsh-2 群、待办只建本人、不 @ 任何人），驱动 = sidecar [`advance-dsh2-driver.ts`](../../.acceptance/advance-dsh2-driver.ts) + Playwright 主控 [`verify-advance-dsh2.mjs`](../../.acceptance/verify-advance-dsh2.mjs)。**ALL PASS（23 PASS + 1 SOFT-FAIL 预期内）**，截图 `shots-advance-dsh2/`：

| 验收点 | 结果 | 证据 |
|---|---|---|
| A1 立项+关联来源 | 面板弹窗直写立项；「关联来源」挂上 dsh-2 群 | s0-created.png |
| A2 静默进展 | 群房间 hover 喂给推进落进度事元（refs=群消息），阶段不被拖动 | s1-fed.png |
| A3 决策卡 | 推论链「数据包 08-24 才到→窗口压缩→威胁 08-26」+ 三动作按钮渲染 | s2-decision.png |
| **A4 决策 45 核心面** | 建待办（refs=T-id + 自动订阅 todo: 源）/ 发消息（refs=im:g:m，dsh-2 可见）/ 定会议（留痕）；**刷新页面三动作仍已执行**（foldDoneActions 流折叠） | s3-after-reload.png（三动作全勾 + 三条 todo 订阅） |
| A5 todo 回流 | **SOFT-FAIL 即断层证实**：勾待办 done → 巡检 → Dream，事元流无「待办完成」——`coreScanAdvance` 只实现 im:/dir: 渠道增量，todo:/event:/doc:/file: 是静态引用，「完成回流」现状只能靠 agent 主动 feed。**后续任务：todo 渠道采集器**（patrol 时对每个 todo: 订阅查状态、变化入池） | s4-dream.png |
| A6 六态收口 | draft→running→decision-needed→updated→ready-for-review→completed；事元流全量无损（SQLite 11 条 == 面板查看全部 11 条） | s5-completed.png |
| A7 边界 | 零页面错误；写操作只触及 dsh-2 群与本人待办库 | — |

**演习踩坑回写**：pitfall-043（sidecar 裸 Context 默认 dbt 后端，须 setAdvanceBackend/setTodoBackend 对齐 sqlite）+ pitfall-044（同事项点击不重拉 / Dream 切会话两时序坑）。三轮 reset-重跑均落在驱动侧，产物代码零改动。

## 24.29 tool-yzj｜todo 渠道采集器落地 + 水源接通（2026-08-22，决策 48）

§24.28 断层（todo: 订阅无采集器）的补钉 + 用户拍板的水源接入：

| 面 | 交付 | 证据 |
|---|---|---|
| todo 渠道采集器 | `coreScanAdvance` 新增 todo: 渠道：订阅聚合收集 open 事项的 todo: token → 指纹（`status\|logLength`）比对 → 变化产信号入池（「待办「X」有进展：状态 A→B + 最新日志行」）；首扫基线不回灌；cursor 乘共享 cursors 表零迁移；scanStateOf 过滤不进巡检行 | advance.spec 新用例（基线/变化入池/无变化零信号/面板行过滤）；全量 661 绿 |
| Dream 纪律 | dreamAskPrompt 补：todo: 条目 refs 直接抄 refId；sourceType 按渠道标（im→对话/dir→文档/todo→待办） | 文本落码 |
| 水源接通 | 测试事项（A-20260819-002）挂上 im:测试群（`gid-test`）+ dir:AI速记知识库整库（`dir-kb`） | 真机面板，截图 `shots-advance-todo-channel/1-sources.png` |
| 真机闭环 | `.acceptance/verify-advance-todo-channel.mjs` ALL PASS：探针事项 → 决策卡建待办（自动挂 todo: 订阅）→ 勾掉 → 巡检 → **池里出现 todo: 渠道条目**（「待办「…」有进展：状态 pending→done」）→ Dream 抽取 → **「待办完成」事元回流到探针事项时间线**（refs=todo:<id>） | 截图 3-pool.png（池 2 条 todo 信号）；断言面全绿 |

**执行→再观察弧自此全通**：决策 45（留痕+订阅）+ 决策 48（采集）合起来，行动的结果自动回到事项。踩坑追记：弹层 × 按钮的 aria-label 是「关闭」不是「×」（accessible name 覆盖），Playwright 按 name:'×' 点不中——driver 脚本已按「关闭」修正。

## 24.30 tool-yzj+ui-yzj｜推荐订阅源落地（2026-08-22，决策 49）

设计定稿（§15.6）一次实现到位 + 真机走查：

| 面 | 交付 | 证据 |
|---|---|---|
| host 推荐检查 | `coreFeedAdvance` 尾挂 `maybeRecommendSources`：refs 提取渠道（`channelTokenOf`：im:g\:m→im:g）→ 未订阅且未忽略且无未结算推荐 → appendEntry 直写推荐事元（**不回写 latest 投影**——推荐不顶队列最新动态）；群名随事元落库（仅在真要推荐时查目录） | advance.spec 新用例：产生/幂等/已订阅不推/忽略不推/裸 docId 不推 + latest 不污染；50/50 绿 |
| 面板 | 来源区底部推荐行（`foldPendingRecommendations` 折叠：推荐标记 − 忽略 − 已订阅）+ [挂上]（复用 sourceAdd）/ [×]（落忽略事元）；灰字「不点不影响任何事」 | client spec 新用例：折叠/挂上消失/忽略消失/已订阅不推；663 绿 |
| RPC | `advance-feed` 透传 detail（忽略事元标记需要） | typecheck 绿 |
| 配套修正 | **写入面 refs 统一带渠道 token**：群房间 hover 与话题透镜的喂入 refs 原先是裸 msgId（推不出渠道）——真机首轮推荐不出来才发现；现统一 `im:<groupId>:<msgId>`（transcript/topic-drawer） | 真机走查 ALL PASS；transcript.client.spec 断言同步 |
| 真机 | `verify-advance-recommend.mjs`：探针 1 挂上路径（推荐出现→挂上→消失→再喂不推）+ 探针 2 忽略路径（出现→×→消失→再喂不推）+ SQLite 审计面 | 截图 `shots-advance-recommend/`；12 断言全过 |

Dream 路（跨事项推荐）纪律入 dreamAskPrompt（顺手落推荐事元）。探针事项演练后已清理（SQLite 删 5 条）。

## 24.31 ui-yzj｜话题功能 + 机器人/记忆卡撤下（2026-08-23，决策 50）

用户拍板「群聊话题什么机器人还有记忆的功能全部去掉，我还没想好怎么做」。范围与程度经两轮澄清：**只撤话题功能 UI 入口**（群房间/IM 消息读写保留）+ **只撤 UI 不摘插件**（robot-yzj/memory-yzj 挂载保留，通道与工具后台在跑，R29 投递不受影响）。

| 面 | 交付 | 证据 |
|---|---|---|
| 话题入口撤除 | 群房间撤：话题 toggle（含待确认 badge）、「交给助手」按钮、话题回复 chip、话题抽屉渲染；transcript.tsx 清理 unused（openTopic/drawerOpen/lensId/optimistic/topics 派生链/isGroup/topicBadge）；讨论回环（决策 41）落点改道：不再发话题 latch，落点=群房间 + banner 草稿提示 | typecheck 0 错；transcript.client.spec 6 个话题用例改写为「入口已撤」断言（钉住防回潮） |
| 设置页 | 机器人管理卡撤下（settings-section 只剩登录卡）；记忆卡本来就 deferred（R21 v1.6）——两面俱空 | settings-section.client.spec 改写「只剩登录卡」断言 |
| 机制保留 | topic-drawer.tsx / memory-pane.tsx / robot-pane.tsx 文件保留不挂载；话题 latch（workbench-domain）保留；robot-yzj/memory-yzj 插件挂载行不动 | cordis.patch.yml 零改动 |
| 真机 | `verify-advance-no-topics.mjs` ALL PASS：群房间无话题入口 + hover 仍有回复/喂给推进（不误伤）+ 推进看板完好 + 零页面错误 | 截图 `shots-no-topics/`；全量 663 绿 |

可逆性：恢复路径 = 加回渲染点（机制与数据无损）。group-room-topics.md 版本头 v1.20 留痕。

## 24.32 bundle｜机器人/记忆后台停运（2026-08-23，决策 51）

用户追问「机器人和记忆是不是后台也先停了」——决策 50 撤 UI 后连后台一起停：

| 面 | 交付 | 证据 |
|---|---|---|
| 挂载行摘除 | cordis.patch.yml 移除 robot-yzj + memory-yzj 两行（包保留不删，加回即恢复）；头注记恢复路径 | GUI 重启正常（200），无 robot/memory 报错；`verify-no-topics.mjs` ALL PASS（摘挂载后面板+群房间完好） |
| 死重清理 | guard 删 robot_notify/robot_continue/robot_share_write 条目 + isBoundHomeSession；write-gate 删 robot 判断；write-card 删 robot 标签；三个 spec 的 robot 用例清除 | 654 绿 + typecheck 0 错 |
| 连带停运（明示） | R29 话题产物投递、@机器人入站、memory_* 工具族、dream 固化（记忆库侧 dream.json/dailyAt 在 memory-yzj）全停；AI推进 Dream 池/巡检（tool-yzj）不受影响 | 依赖点逐一验证降级安全（yzjRobot/yzjMemory 缺席均有「未挂载」明示；ownsConfirm undefined 安全） |

恢复路径：cordis.patch.yml 加回两行 + guard/write-gate 条目恢复（git 可翻）。

## 24.33 泳道待办 + agent 自动执行：设计定稿（2026-08-24，待实现）

08-24 早会结论「待办用泳道图 + 要有 agent 自动执行」+ 参考 [`DSH-taskboard`](https://github.com/shengsheng90/DSH-taskboard) 的缺口对照。设计定稿落 [`../spec/todo-swimlane-agent.md`](../spec/todo-swimlane-agent.md)：五态状态机（+backlog 待批准 +in_review 待验收）+ claim 排他版本锁 + agent 执行回路（claim 后开会话干活，MVP 手动触发）+ 人验收主权（done 只经人 accept，与推进终局同构）+ 与推进域接力（推进建待办→待办被做→done 回流，决策 45/48 已有）。存储本地 SQLite（现状已是）。分期：①状态机+泳道 ②执行回路 ③自动调度。**未实现，待排期开工。**

## 24.34 泳道待办期① + 推进五态收敛（2026-08-24，决策 52 / S6-S8，已落地）

泳道待办期①（状态机+claim 工具族+泳道 UI+人验收）与推进七态→五态收敛同会话落地。定稿过程：用户两连问「怎么和推进看板结合」「两系统都 7 态是否过度复杂」——答案落进设计：两域是**接力不是融合**（推进=判断面建待办落 backlog → 待办=执行面人批准+agent 认领+人验收 → done 经决策 48 渠道回流推进时间线）；状态审计砍掉三块非承重墙（推进 draft/updated + 待办 blocked），两板同构为「稳态 / 待我决定 / 待我验收 / 终局」四格心智，泳道列名与推进三栏目同词。

| 面 | 交付 | 证据 |
|---|---|---|
| 推进五态（决策 52） | advance.ts：五态机（running⇄decision-needed/ready-for-review→completed/cancelled）+ 立项即 running + `normalizeStage` 读取归一（draft/updated→running，SQLite 零迁移脚本）；judge `confirm_advance` 改落 running；面板 STAGE_LABEL/dotToneOf/quiet 文案同步 | `advance.spec.ts` 五态机全边表 + 归一化断言；推进域测试 95 绿 |
| 待办六态（S5/S8） | todo.ts：六态机 + `TODO_NEXT` 合法边表 + `normalizeTodoStatus`（pending→todo）+ 版本字段（每次流转递增）+ 认领会话/验收说明/描述新字段（SQLite fields blob 零迁移）；`isOverdue` 排除 cancelled | `todo.spec.ts` 六态全边 + 排他/版本断言；全量 659 绿 + typecheck 0 错 |
| claim 工具族（S2/S3） | `yzj_todo_claim`（排他+会话留痕）/ `yzj_todo_submit_review`（结果说明+证据 refs）/ `yzj_todo_release_claim`（阻塞是备注不是状态）——**静默无卡**（S3 刻意例外，guard.ts 注释留痕）；`yzj_todo_update` 摘除 status 参数（状态只走合法边）；`yzj_todo_complete` 保留为人直写 done 快路径 | 工具级单测覆盖 claim 排他/backlog 拦截/交卷/释放；`cards.tsx` keyed 卡三枚 |
| 落点分流（S6） | agent 建一律落 backlog：`yzj_todo_create` + 决策卡动作行（advance-action 改走 `createFromAgent`）；面板快捷新建落 todo（用户本人意志即隐式批准，D9） | todo.spec 建库断言 `状态=backlog`；advance-action-run.spec 签名同步 |
| 泳道 UI（S7） | todo-pane 五列泳道（待我决定 \| 可认领 \| 进行中 \| 待我验收 \| 已完成）+ 已终止折叠区（与推进「已结束」同款）；卡片动词即状态（批准/编辑/完成/打回/中止/验收/重开）；行内编辑（标题/描述/DDL/负责人——描述=agent 执行的提示词本体）；打回/验收带内联备注表单 | todo-pane.client.spec 泳道用例（五列/折叠/动词 RPC/编辑保存）全绿 |
| 人动词 RPC | `/yzj` 新增 `todo-approve/accept/return/cancel/reopen/edit`（面板直写无卡；打回落点 host 按当前态选合法边：todo→backlog / in_progress→todo / in_review→in_progress） | 面板用例驱动断言；hermetic e2e 覆盖同边 |
| 验收 | `.acceptance/verify-todo-e2e.mjs` 重写为**密封版**（YZJ_ADVANCE_DB 指临时库 + sqlite 后端，无需登录/GUI）：六态全环 17/17 PASS；`verify-todo-swimlane.mjs` 新建（GUI 五列+动词走查）；`verify-todo-style.mjs` 删除（悬浮球时代遗物，泳道脚本覆盖）；`verify-advance-loop.mjs`/drivers 同步五态（loop driver 顺手补上缺失的 `setAdvanceBackend('sqlite')`） | e2e 17/17；GUI 走查见 shots-todo-swimlane |
| 期②边界 | claim 后自动开 agent 会话干活（任务上下文注入）未做——期②；定时自动 claim 期③ | 见 swimlane spec §5 分期表 |

注意：本仓验收脚本族里 verify-advance-loop/dsh2 等引用旧六态的文案已同步；存量真机数据无需动作（读取归一化覆盖）。

## 24.35 泳道待办期②：执行回路 MVP 手动径（2026-08-24，已落地）

期②「claim 后会话自动开工」落地为手动触发径：泳道「可认领」列卡片新增「让 agent 做」→ `/yzj todo-dispatch` → host 直建 `yzj-todo-<stamp>` 会话、首 turn 注入任务卡（`todoDispatchPrompt`：id/标题/描述/DDL/标签/版本 + 四条纪律——先 claim、写动作走确认卡、submit_review 交卷、阻塞即 release 带回流备注）→ 聚焦新会话。复用 Dream 手动径形态（决策 38）；会话纪律是提示词、闸门是 host 状态机（S2/S3 不靠模型自觉）。

| 面 | 交付 | 证据 |
|---|---|---|
| 派发链路 | bound-io `runTodoSession` + `todoDispatchPrompt`（空描述降级、可空字段省略）；`/yzj todo-dispatch` 端点（仅 todo 态可派，其他态明示拒绝）；`yzjTodo.get` 服务读卡 | bound-io.spec +2（会话创建/首 turn/钉标题/提示词内容） |
| 面板 | 「可认领」列「让 agent 做」主按钮 → dispatch → flash + `focusBoundSession` 聚焦新会话 | todo-pane.client.spec 派发用例（RPC 调用 + 聚焦断言；非可认领列不出钮） |
| 真机 | `verify-todo-dispatch.mjs` ALL PASS：建卡→编辑描述→派发→会话自动开工→认领（in_progress）→交卷（in_review 带评语）→人验收→done；探针事后全部验收归档 | 截图 `shots-todo-swimlane/dispatch-*.png`；SQLite 推进日志逐边留痕 |
| 验收坑 | 面板轮询不到新状态 = 同 tab 重点不刷新：待办页签仅在切入时拉 todo-state（panel.tsx），轮询脚本须「对话→待办」切tab强制重拉 | 与 pitfall-044 同族（验收时序），脚本内注释留痕 |

全量 662 绿 + typecheck 0 错。期③（定时/水位自动 claim，巡检骨架复用）未开工。

## 24.36 泳道板面治理：切换器退役 + 归档（2026-08-25，S9/S10，已落地）

用户问「任务库是不是可以不要了 + 能不能归档 + #泳道是啥」——三问三答：切换器是 SQLite 后端后的纯残留（偏好不被读取，v1.2 版本说明书早标「待清理」）→ 退役；已完成/已终止无限堆积 → 归档；#泳道是 08-24 验收探针的测试 tag → 全部归档清理 + 标签轨改为只统计在途卡。

| 面 | 交付 | 证据 |
|---|---|---|
| 切换器退役（S9） | todo-pane 拆切换器整行（activeLib/切换/团队开通/localStorage 偏好/useEffect 簇全删，-76 行）+ panel 拔 6 个死 props；dbt 发现代码路径保留给测试；CSS 清 147 行死样式 | todo-pane.client.spec 切换器 2 用例删除；typecheck 0 错 |
| 归档（S10） | `归档` 字段（布尔，SQLite fields blob 零迁移）+ `coreSetArchived`（不动状态/不增版本/日志留痕）+ `yzjTodo.setArchived` + `/yzj todo-archive`；done/cancelled 卡片「归档」动词 → 「已归档」折叠区 → 「恢复」回原列；`yzj_todo_list`（含 all）排除已归档；归档卡只剩「恢复」动词 | todo.spec 归档往返用例 + list 排除断言；todo-pane.client.spec 归档折叠/恢复/标签轨用例 |
| 标签轨口径 | 只统计在途卡（未归档 + 非终局）——历史 tag 不再占位 | todo-pane.client.spec `#泳道 · 1` 断言 |
| 真机 | `verify-todo-swimlane.mjs` ALL PASS 21 检查点（含新增归档 4 点：完成快路径→归档不占列→折叠区→恢复回已完成）；08-24 验收探针 7 条全部归档，板面/标签轨干净 | 截图 `shots-todo-swimlane/swimlane-board.png` |

全量测试绿 + typecheck 0 错。本仓归档口径与 todo-design v1.1「不做删除」一致：历史事实保留，只是视图收起。

## 24.37 决策 53：机器人/记忆/话题彻底退役（2026-08-25，已落地）

用户拍板「机器人话题记忆那些那种都干掉吧」——决策 50（撤 UI）/51（摘挂载）的渐进路线走到终局：**删除而非保留**。

| 面 | 交付 | 证据 |
|---|---|---|
| 两包删除 | `packages/robot-yzj`、`packages/memory-yzj` 整包 + spike/robot + scripts/ops-wrapper、setup-ops（robot autostart 配套）+ lib/robot-yzj.mjs、memory-yzj.mjs 出口（tsdown/package.json） | workspace 5 包；build 4 files 459KB（原 6 files 688KB） |
| RPC 面 | /yzj 删 20 个 case（robot-* 13 + memory-*/dream-* 7）+ home-topic-open/lens/ask 3 个（话题机制）；client rpc.ts 对应函数全删 | rpc.node.spec「端点已删」断言 ×11 |
| 工具卡 | cards.tsx 删 memory_* 五工具卡（MemoryBody）；write-gate 删 ownsConfirm 代理分支（yzj-robot-* 残留前缀跳过保留） | write-gate.spec robot 用例清 2、改写注释 |
| 话题机制 | topic-deliver.ts（R29 投递）/topic-drawer.tsx/memory-pane/robot-pane 删除；workbench-domain 话题 latch 删除；bound-io 删 askTopicAssistant；settings 只剩登录卡 | 4 spec 文件删除；advance-pane.spec latch 断言移除 |
| 保留边界（明示） | 话题**数据层**（topics.ts TopicRecord/home.ts 绑定表）保留——群房间视图与 conv-list L1 聚合仍消费；bound-io 的 groupSpaceSnapshot/topics 透镜数据保留。这不是功能，是群房间产品法的存储 | verify-no-topics.mjs 真机走查（群房间无话题入口） |
| 踩坑 | pitfall-046：删 sessionHasSummonWindow 深路径 import 断掉 cordis augmentation 链，ctx.get 类型静默 any——修复 = 显式 `import type {} from '@dsh-yzj/tool-yzj/src/index.ts'` | 全量 typecheck 0 错 |

验收：全量测试绿 + typecheck 0 错 + build/bundle 绿 + GUI 重启后 verify-no-topics / verify-todo-swimlane 回归。恢复路径：**无软恢复**——只能从 git 历史重建（决策 53 的明确取舍）。

## 24.38 决策 54：多维表格双后端拆除（2026-08-25，已落地）

用户拍板「多维表格这个东西干掉」——澄清后范围锁定**只拆双后端**：`yzj_sheet_*` 工具族保留（agent 操作云之家多维表格的通用能力），todo/advance 域的云 dbt 分支、库发现/开通/切换面全部清死，本地 SQLite 成唯一后端。

| 面 | 交付 | 证据 |
|---|---|---|
| todo.ts | `setTodoBackend` 双后端开关删除；resolveLibrary 恒返 LOCAL_BINDING；fetchTodos/fetchTodoByTodoId 同步化直读 local-store；writeRecords→applyRecords；dbt 基础设施（bindingForDoc/provisionTable/tableFieldsJson/runTodoJson/cliRecords/LIBRARY_TITLE）删除；服务层 listLibraries/select/ensureTeam/teamWorkspaces/workspaceIndex/libraryIdentity/rememberLibrary/librariesCache 删除 | typecheck 0 错；todo.spec 14 用例 sqlite 直验 |
| advance.ts | `setAdvanceBackend` 同删；六处 `advanceBackend==='sqlite'` 分支展开为唯一路径；fetchItems/fetchItemById/fetchEntries/todaysEntryIds 同步化；advanceTablesOf/provisionAdvanceTables/assertStageOption（dbt SingleSelect 守卫）/itemFieldsJson/entryFieldsJson/writeTable/cliRecords 删除；resolveAdvance 恒返 LOCAL_BINDING | advance.spec 全绿（assertStageOption 用例改断言 sqlite 直写——无预注册约束） |
| RPC | /yzj 删 `todo-libraries`/`todo-select`/`todo-ensure-team`；client rpc.ts 三函数删；stores.ts 切换器状态字段（todoLink/todoLib*/todoLibraries/todoActiveDocId）与 setTodoLibraries 删，setTodoState 瘦身为 (todos, ready) | rpc 面编译绿 |
| 测试 | 新 `tests/sqlite-harness.ts`（每测新 db 文件 + afterEach reset）；todo.spec 重写（fake bridge → sqlite 直验）；advance.spec 的 FakeStore 改为 local-store 只读视图 + seed* 助手（IM/目录 fixture 保留） | 全量 468 绿 |
| 验收脚本 | verify-todo-team.mjs 删除（团队库开通面已不存在） | — |

附带修正：panel-controller todo 分支传播链简化；todo-pane ensure 文案改「待办库已就绪」。

## 24.39 legacy 迁移路径全量拆除（2026-08-25，已落地）

用户拍板「legacy的东西全部干掉」。动手前先核真机存量，确认每条 legacy 路径保护的数据为零，死代码才删：

| 存量核查 | 结果 |
|---|---|
| todo 状态 `pending`（S5 折叠） | 0 行 |
| advance 阶段 `draft`/`updated`（决策 52 折叠） | 0 行 |
| `yzj_advance_threads.json`（v1.8 迁移源） | 0 行，磁盘文件一并删除 |
| 话题表 `fromSessionId` 非空 / `rootMsgId=legacy-host`（H9） | 0/0 行 |
| 群房间 host 会话真实 ③④（H9 触发条件） | 0 事件 |

| 面 | 交付 | 证据 |
|---|---|---|
| advance-sources.ts | `legacyThreadsDomainSpec` 声明 + `open()` 内 v1.8 迁移块删除；磁盘 `~/.dsh/storages/yzj_advance_threads.json` 删除 | tool-yzj typecheck 0 错 |
| home-open.ts H9 链 | `maybeMigrateLegacyHost`/`hostHasLegacyTurns`/`legacyTopicSessionId` 全删；`openBoundHome` 瘦身为 `home + yzjConversationId`（title/agents/cwd/route/composition 参数不再需要，index.ts 与 bound-io handoffToGroup 调用点同步） | home-open.spec 铸币用例删、DM 绑定用例改写 |
| topics.ts | `TopicRecord.fromSessionId` + `TopicEnsureInput` 的 `fromSessionId`/`quiet`/`lastActivity` 输入面、schema、ensureTopic quiet 分支与透传删除（`lastActivity` 字段本体与 touch bump 是活语义，保留） | topics.spec legacy-host slug/quiet 用例删 |
| bound-io.ts | `topicLensBubbles` 的 fromHost ③④ 合并删除（fromSessionId 恒空）；plugin inject 隐藏的覆盖由 fusedSnapshot 用例承接 | bound-io.spec 合并用例删 |
| 读时归一化 | todo `normalizeTodoStatus` 的 pending 折叠、advance `normalizeStage` 的 draft/updated 折叠删除；**非法值兜底保留**（SQLite 自由字符串，未知值仍 fold 回 todo/running）；todo-pane `laneStatusOf` 客户端镜像删除 | todo.spec pending 断言删、用例改 garbage 测兜底 |
| 客户端残留 | conv-list `topicNavLabel` 的 legacy「群名 · 」前缀剥离删除（存量 title 0 条带前缀，后缀剥离保留）；room-shell「legacy sidebar panel」陈旧注释改「top-bar panel」 | group-space.spec 前缀断言删 |

**保留边界（明示；① 已被同日再续推翻——用户拍板彻底删，见下文「再续」）**：① advance refs 的裸 msgId 回退（index.ts advance-ref-lookup + advance-pane jumpToMsg 降级）——真机 72 条事元中 38 条裸 msgId refs，bound log 命中率仅 11/38（其余指向的消息已不在捞取范围），**无法机械迁移**，运行时回退是活存量处理而非死代码；② yzj-cwd attachYzjSession 的 mismatch 容错——防御活的 harness header 差异，非迁移路径；③ `composeHandoffDigest`（handoff-digest.ts）——「丢进群」picker 的活组合器（home-chrome.tsx 消费），仅 home-open 侧的 H9 inject 消费删除。

验收：全量测试 462 绿（真实 CLI 冒烟首轮 1 条网络超时，重跑过）+ typecheck 0 错 + build/bundle 绿 + GUI 重启回归。

**§24.39 再续（同日，裸 msgId 回退彻底退役）**：上文保留边界 ① 被用户拍板推翻——「彻底删，接受失效」。advance refs 的裸 msgId 回退全链删除：

| 面 | 交付 | 证据 |
|---|---|---|
| host 扫描 | index.ts `advance-ref-lookup` 删「扫全部绑定会话 bound log 补 jumpToken」块；裸 msgId token 不再产生 hit（27 条查不到归属的失效是用户接受的代价，11 条能查到的一并失效） | rpc spec 四形态改 dp→msg / dp→doc / im: 直查 / 裸 msgId+miss 双 miss，断言 3 hit |
| client 猜群 | advance-pane `jumpToMsg`（恰一订阅群猜群跳转）删除；`jumpToSourceMsg` 只认 `im:g:m` 锚点直达，无锚点不动作；未命中 msg chip 仅 `im:` 格式可点，裸 msgId 渲染不可点泛化 chip（补 data-testid） | client spec：裸 msgId SPAN 不可点+零 focus、im: 未命中 BUTTON 仍锚点直达 |
| 保留路径（明示） | `im:<g>:<m>` 直查、dp-* 池 id 还原、doc 文件名解析全部不变；「发消息」动作的 imGroupTokens/imGroupLabel（决策 41）不受影响 | dp-* 与 im: 命中渲染事件行用例保留绿 |

验收：全量 461 绿（净 -1：裸 msgId 命中渲染用例场景已死删除）+ typecheck 0 错 + build/bundle 绿 + GUI 重启回归。

## 24.40 决策 55：丢进群 UI + 话题假 banner 退役（2026-08-27，已落地）

用户拍板「把一些奇怪的 UI 都去掉，例如丢进群」。话题退役后，普通 DSH 会话 composer 上的「丢进群」和群房间「打开话题后会出现在问助手栏」都是假入口。

| 面 | 交付 | 证据 |
|---|---|---|
| dock | 未绑定会话不再画「丢进群」；HandoffModal 删除。存量 `yzj-topic-*` 仍画「回群聊」 | home-chrome.client.spec 未绑定零 chrome、无「丢进群」 |
| RPC | `/yzj home-digest` / `home-handoff` 删除；`handoffToGroup` 删除（会 mint 话题，与决策 53 冲突） | rpc.node.spec 两 endpoint unknown；bound-io.spec 无 handoff 用例 |
| banner | 群房间 `yzj-advance-ask-banner` 删除（文案依赖已撤的话题问助手栏） | transcript 不再渲染该 testid；`verify-advance-feed.mjs` 断言 banner 不出现 |
| 文档 | group-room-topics v1.22 §12；dsh-home-session 头注 D8 UI 退役；根 README / 包 README 同步 | — |

恢复路径：无软恢复，git 历史重建。

## 24.41 灵基终态文档迁出本仓（2026-08-27，纯文档）

`docs/target-lingee/`、`docs/migration/advance-lingee-migration.md`、`docs/spec/lingee-platform-requirements.md` 已从本仓删除。本仓只维护 dsh MVP。

## 24.42 清除 830 真实现场与迁灵基残留（2026-08-27）

`.acceptance/advance-830-*` 实验脚本/记录删除。文档、夹具、验收脚本中的真群 ID / 人名 / openId / fileId / 现场群名改为假名或 `YZJ_E2E_*` 环境变量（缺则 skip）。插件代码与 AI 推进 spec 保留，只去现场痕迹。`feat/advance-intent-threads` 从远程删除。历史改写后旧 SHA 在 GitHub GC 前仍可能打开。

## 24.43 待办 + AI推进从公开仓撤出（2026-08-27）

2026-08-27 待办+推进从公开仓撤出，完整实现在私有归档 GuoxinShan/dsh-yzj-archive。不是公开安装路径。公开仓保留 yzj-cli 桥、六域工具、群房间 + 话题、确认卡、工作台三域（对话 / 日程 / 知识库）。IM L2 缓存仍用 `~/.dsh/storages/yzj_advance.db` 的 `im_cache` 表。§17 / §24–§24.42 为历史验收记录。恢复只能从 git 历史或私有归档重建。

## 24.44 Full access 仍弹云之家写确认卡（pitfall-036，D9 补强）

用户指出 GUI「Full access」谈不出确认卡不合理。根因：该档位 = `{ sandbox: danger-full-access, approval: never }`，harness `ApprovalService.request()` 在派发瀑布前直接 `rejected`，旧 guard `{ kind: 'ask' }` 被 core tools 落成 deny，write-gate 没机会弹卡。

| 面 | 交付 | 证据 |
|---|---|---|
| 产品法 | D9 补一句：确认卡不跟权限档位走；Full access 只放开本机沙箱 | `dsh-home-session.md` D9 + 验收 4 |
| guard | 命中 WRITE_SPECS 后 `yzj/ask-pending` + `waterfall('yzj/confirm-request')`，映射 allow/deny；**不再 return ask** | `guard.spec.ts` |
| write-gate | 应答 `yzj/confirm-request`（无 `approval/asked` 也建 pending）；旧 `approval/request` 路径保留 | `write-gate.spec.ts` |
| 文档 | pitfall-036 标已修复 | pitfalls 索引 |

headless overlay（无 ui-yzj）仍 fail-closed：瀑布 next → unavailable → deny。

## 24.45 harness 0.1.2 客户端扫描（2026-09-02，已落地）

0.1.2 `dsh-client-modules` 只把精确包名扫成 client 行，图行 id 是清单 `name`。旧子路径 `@dsh-yzj/bundle/ui-yzj` 在 0.1.2 上 host 四行都在、浏览器半整面消失。

| 面 | 交付 | 证据 |
|---|---|---|
| Loader | ui-yzj 行名 + 根 `exports["."]` = `@dsh-yzj/bundle` / `./lib/ui-yzj.mjs` | `cordis.patch.yml` + 根 `package.json` |
| client | handoff id `@dsh-yzj/bundle`；`defineStore` 先 0.1.2 `dsh-client-store` 再 0.1.1 `dsh-client-runtime/client`；`CLIENT_EXTERNALS` 含两个词 | `client-bundle.client.spec.ts`；0.1.2 `dsh web` 与 rc.18 桌面 |
| 文档 | pitfall-047；pitfall-048；pitfall-010 解法改写 | pitfalls 索引 |

## 24.46 tool-yzj+ui-yzj｜对齐 yzj-cli 0.1.6（skill 0.6.0）（2026-09-02）

目标 npm `@yunzhijia/cli@0.1.6`（2026-09-02T11:10Z）。对照：未登录二进制 `--help` + skill `0.6.0` / `references/global.md` / `products/im.md`。**不**恢复待办/AI推进。本仓无重写版 `packages/bundle/skills/yzj-cli/SKILL.md`，未重建。

| 面 | 交付 | 证据 |
|---|---|---|
| 信封 | 成功 stdout `{success, identity, data}`；list 在 `.data.list`；空写回执可无 data。`unwrapCli` / `cliList` / 浏览器 `cliRows` 同时吃 0.1.4 裸数组/`{list}` | `cli-envelope.spec.ts`；`v016-tools.spec.ts` 双形态 digest；`cli-payload.spec.ts` |
| 退出码 | 高风险缺 `--yes` = **exit 10** + `confirmation_required`（0.1.4 曾用 exit 3）。认证缺失仍 exit 3。`--jq` 求值失败 exit 5。确认卡门控 agent 写；`--yes` 只在卡后透传删除族。recall/rename/folder create **无** `--yes` | pitfall-049；fake CLI `confirm`/`unauth`；recall 组装断言 |
| whoami | 模型工具改打顶层 `whoami`；面板 RPC/bridge.check 仍 `contact user get`（0.1.4 无 whoami 时冒烟可 skip） | `v016-tools.spec.ts` |
| 新 IM | `yzj_im_message_recall`（strong）、`yzj_im_message_search`、`yzj_im_group_rename`（standard）。`yzj_im_group_recent` 文案指向 search，不再写「没有群搜索」 | WRITE_SPECS + cards/write-card |
| 其它 | `sheet get --lite`；`doc folder create`（`--help` 真实且与 `doc create` otl 不同，skill 0.6.0 仍写无独立文件夹——以 CLI 为准）→ `yzj_doc_folder_create` | `v016-tools.spec.ts` |
| 未做 | 不关 G5（工作台挑群 UI 仍无搜索框；模型面群搜索 0.1.4 已有）。不 bash 直调 CLI 写命令 | 根 README 已知限制 |

send 的 `--to-open-id` / `--at-open-id` / `--at-all` / `--reply-msg-id` / `--image` 与 0.1.6 `--help` 一致，未改 flag。

## 25. v3.0｜IM 壳（2026-09-03）

产品法：[`docs/spec/im-shell.md`](../spec/im-shell.md)。表面从工作台盖层换成 IM。不恢复待办 / AI推进 / 入站机器人 / 话题 UI / 交给助手 / 悬浮球。

| 面 | 交付 | 证据 |
|---|---|---|
| 助手 1..N | domain `yzj_assistants`；出厂 `default` / 「助手」；隐藏 session `yzj-assistant-*` + cwd `~/.dsh-yzj/assistants/<id>/` + 串行队列 | `assistants.spec.ts` |
| `present` | 模型工具，写 IM 投影，不进 WRITE_SPECS，永不 `im message send`；回合结束回退 last assistant text | `assistants.spec.ts` present / fallback |
| RPC | `assistants-list/create`、`assistant-ask`、`assistant-thread-ask`、`assistant-projection/threads/process` | `rpc.node.spec.ts` |
| 收件箱 | 门户进 `sidebar.workspaces` 区域（不 register 单占座，pitfall-050）；四段 助手 / 单聊 / 群 / 订阅通知；`parseRecentGroups` 保留 `groupType`+`headerUrl`/`photoUrl`；`GroupAvatar`；inbox「新建助手」 | `inbox.client.spec.tsx` / `inbox-mount.client.spec.tsx` / `conv-list.client.spec.tsx` `inboxRoomKind` |
| 助手 DM | Grok-Bot 气泡 + 确认卡 + 弱化「查看过程」；无 tool trace | `assistant-dm.client.spec.tsx` |
| 人群房间 | `home-send` 发群；回复 + `@助手` 拦截；只你可见本地线程；header「问助手」 | `group-room.client.spec.tsx` / `room-composer.spec.ts` intercept |
| 身份 | 0.1.6 whoami：`data` + 同级 `identity`，不假定顶层 openId | `contact-parse.spec.ts` |
| Occupancy | 不占 layout `conversation` / `sidebar.workspaces` 单座；占 `conversation.view` + composer chain 画 null；**CSS+DOM 收起官方 InputBar/统计/session chrome**（不依赖 `data-composer-seat`，pitfall-052）；消息态 CSS 藏 New Session / 文件夹树 / details / 宿主 tablist。**I16 消息/会话**：常驻 `data-yzj-surface-switch`；会话卸 `html[data-dsh-yzj-im]`、收起 inbox host、点宿主 Chat；切回消息保留 inbox 选中行 | pitfall-050 / 052；`host-chrome.ts`；`host-chrome.client.spec.tsx`；`inbox-mount.client.spec.tsx`；`im-nav.client.spec.tsx` |
| 停止挂载 | 工作台 overlay、云之家 dock、`conversation.input.dock` 话题残留 | `src/client/index.ts` 不再 mount |

**已知限制**：(a) 无 focused session 时 `conversation.view` 不画——依赖 GUI 已有当前会话；(b) V1 无回复目标的 `@助手` 不受理；(c) 日程/知识库只在 composer `+` / 设置，不是首页页签；(d) cloud agent 无 web GUI；宿主 chrome 隐藏由 jsdom 覆盖有/无 `data-composer-seat` 两种 DOM，真机须重启 GUI（host + 根 `lib/client.js`，pitfall-016/051）后对照截图验收；(e) 助手 DM 的 `input-source.ts` @ 芯片仍挂在官方 InputBar 上，IM 自绘 composer 是纯文本；(f) 未构建的兄弟 harness 上 `cards` / `panel-hooks` / `panel-switch` 三个旧 client spec 因缺 `dsh-client-runtime/lib/client.js` 无法加载——与本刀无关。

**表面重做（同 PR，2026-09-03）**：真机 Oh My DSH / harness **0.1.2-alpha.3** 截图暴露双 composer、session 标题泄漏、扁平 inbox、无头像、无新建助手。本刀按 I13–I15 修；不恢复待办 / AI推进 / 入站机器人 / 话题 UI / 交给助手 / 悬浮球。

**消息/会话出口（同 PR，2026-09-03）**：occupancy CSS 曾把 `[role=tablist]` / New Session / 文件夹树 / 宿主 composer 藏死，本地 session 不可达。I16 在 workspaces 顶部常驻「消息」「会话」；会话卸 `data-dsh-yzj-im` 并露出官方 DSH 工作台（文件夹树、session 列表、Chat、InputBar、Session 日志）。「查看过程」不是这个出口。文件夹树隐藏选择器必须带 `html[data-dsh-yzj-im]` 并排除页签，否则会话态仍盖住 workspaces。

