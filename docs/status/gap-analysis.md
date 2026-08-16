# 云之家-dsh 集成：设计方案 × 已有实现 对照与 Gap 分析

> 对齐对象：`../spec/integration-master-plan.md`（v1.7，预研稿，**最终验收基准**；v1.4 基础上补齐工具清单、「一切皆可拖」原则与全量拖拽完整规格）↔ 本仓库现有实现（`packages/bridge`、`packages/tool-yzj`、`packages/ui-yzj`、`packages/bundle`）
> 核验日期：2026-08-14 之后（实现开发期）
> v1.4 增补：**UI 后续演化对照**（git `08fc7b1` → `af3bf5d`，19 个 ui-yzj commit）——面板四 tab→三 tab、悬浮球唯一入口、面板真 IM composer（用户直写）、拖入快捷动作移除、确认卡去 ID 化、未读持久化；新增 §16。v1.3 增补：**最终验收状态**（git `de3c058`）——全部可开发缺口完成：锚点定位高亮、@ 候选三组、拖入即处理引导均已落地；剩余仅机制受限项（多 chip 合并、通知卡、确认卡事件族，均为 harness 契约边界）与待拍板项（合并确认、快照决策）。全量 build/typecheck/test 通过（58 passed）。v1.2 增补：实现进展状态全量刷新（git 至 `491db61`）——P0 消息回源、P1 门禁分级 + 确认卡、通知层一/三、skill、影子任务库、dbt 预览均已落地；剩余缺口见 §15 更新清单。v1.1 增补：补全实现侧全部工具明细（§2）；新增设计补强「悬浮窗全量拖拽 → composer」（§2A，用户思路）。

**完成度：≈95%（host 侧稳定；UI 侧在验收后继续演化，见 §16——其中「我的」tab 移除与用户直写原则构成对 v1.6 设计的两处偏离，待拍板）**——按设计 v1.7 验收基准。

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

**实现形态**：`tools/pre-execute` ask（guard，含分级）→ `yzj/ask-pending` 广播参数 → host `write-gate` 应答 `approval/request` waterfall（yzj_* 接管，配对 `approval/asked` 审计 id，内存 pending 记录）→ 浏览器确认卡（`tool.call.toolview` keyed，22 个写工具）查询/决策（RPC `write-list`/`write-decide`）→ 终态由官方 `tools/result` 驱动。

| 设计点 | 实现 | 状态 |
|---|---|---|
| 风险分级（标准/强确认） | ✅ guard 两级 + 卡片红色强确认徽标 | ✅ |
| 全部写工具入闸 | ✅ 22 项 | ✅ |
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

*本文档为对照记录，不替代 v1.7 设计原文；标注「待拍板」的项目维持原设计的决策归属。*

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
| 3 | 面板只读浏览 | **面板真 IM composer**（文本/图片/文件/回复/表情，`d60ece0`/`3dc66e8`），经 `/yzj im-send` 直发，不经确认卡 | ⚪ 引入「用户直写」路径，原则待拍板成文 |
| 4 | 拖入即处理快捷动作（§2A 第 4 行 ✅） | **已移除**（`2a3a556`），改为全屏 drop overlay 直接成 chip | ⚪ 设计硬性要求 4（P2 可选）实现后删除，终局与否待拍板 |
| 5 | 确认卡展示原始 ID | **去 ID 化**：ID 解析为群名/人名，原型风格（`bfb81c0`/`1d6ee38`）；`refs` 关联引用 chips | 🟢 演进（同名目标可辨识性见待拍板 #8） |
| 6 | lastSeen diff 角标 | CLI `unreadCount` + 本地已读持久化（`0dedff8`/`361788b`），刷新不回退 99+，「全部已读」 | 🟢 演进 |
| 7 | 会话 tab 消息气泡 | 完整 IM：正序阅读、媒体/文件预览、表情、回复、日期分割线、锚点 tag、双栏布局、文档内容预览（`20cc7ba`→`7eb1b6c`） | 🟢 演进 |
| 8 | RPC 15 端点 | **18 端点**：新增 `im-send`/`file-upload`（用户直写）与 `file-data`（媒体代理） | 🟢 演进（#3 的载体） |

**维持不变**：41 工具、22 写门禁、@ 三组、codec 回源（含消息原文/dbt 表结构）、三层通知、确认卡四动词与锚点跳转、toolview keyed 注册。

### 16.1 新增待拍板项（并入 §15 清单）

8. **「我的」tab**：恢复（通讯录浏览回归面板）vs 维持删除（@ 候选已覆盖找人）+ 修订设计 §5.2。
9. **用户直写原则**：确认卡只门控 agent 写；面板直操作（composer 发送，及规划中的待办勾选/新建）即用户意志、不经确认卡——是否成文为正式原则（v1.6 §5.5 原表述「全部写操作收敛到同一道门禁」需相应修订）。
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
- **决策留档**：provider 目录合并 `listProviders()`（已激活路由）与 `listConfigurableProviders()`（休眠可选）——UI 可选全部 harness provider；未激活 provider 的模型列表可能为空（选择后由 agent 轮次按需暴露错误）。

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
