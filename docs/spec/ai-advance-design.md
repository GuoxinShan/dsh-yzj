# AI推进：事元流驱动的「推进事项」

> 版本：v1.0（已拍板并开工）
> 日期：2026-08-19
> 决策人：Guoxin Shan
> 定位：AI推进的一等对象是**「推进事项」——一个聚合了很多事元、动态变化的事件推进体**，不是 todolist。IM 消息、待办、文档、会议纪要、日程都是事元；每个事元可溯源，会让这件事产生目标更新、进度更新、偏差、决策请求；AI 的价值是把变化过程看清楚。
> 三条硬要求（用户 2026-08-19 拍板）：① 推进必须有待办以外的**独立看板**承载；② **完整时间线**永不裁剪，作为未来知识沉淀来源；③ AI 参与方式必须明确（§5 六机制）。
> 对照：实现缺口记 [`../status/gap-analysis.md`](../status/gap-analysis.md)。

---

## 0. 参考资料（防跑偏锚点，实现时对照）

**PRD**：《AI推进-产品PRD v2.1》，同事甲，云之家群「测试群」（groupId `gid-test`），fileId `file-prd`（临时副本曾在 `/tmp/advance-prd/`，可凭 fileId 随时重取）。关键锚点：

- §5.1.2 六态状态机 `draft→running→decision-needed→updated→ready-for-review→completed`；**状态变化由 AI 判断触发而非用户手动改**；`running` 是默认稳态不打扰。
- §5.2.2 Agent 角色：监听 IM/对话/会议纪要等工作现场，与在途任务的「任务背景/成功指标」做语义比对。
- §5.2.3 最小推进回路：增量信息 → 核心变量对比（原来的理解 vs 现在的约束）→ 确认新条件 → 推进建议（AI建议+备选+自定义）→ AI 复述影响（目标变化/工作调整/再次检查）→ 确认推进/继续修改/忽略，可多次触发。
- §5.3.2 AI推进看板 = 推进队列（三栏目：待我决定/待我验收/我关注的推进，全部 AI 生成）+ 推进详情（任务字段 + 推进时间旅程 + 信息来源面板）。
- §5.3.3 信息来源面板：来源类型（对话/任务/会议/数据/人员）+ 内容 + 位置 + 状态（已确认/已读取/未达标/等待中）；「AI推进不建立新的文件库，而是解释这些工作事实为什么支持或不支持当前目标」；与时间旅程双向关联。
- §5.3.4 推进时间旅程：时间 / 颜色标记（蓝=正常推进 绿=完成达标 红=偏差决策）/ 事件描述 / **来源跳转** / 空态引导；替代传统操作记录，每个事件可追溯到工作现场原始记录。
- §5.3.5 增量信息判断开关：任意来源，展示「这次变化改变了什么」+ 来源 + 用户判断。
- §6.1 任务详情 7 字段（名称/描述/负责人/目标日期/推进状态/任务背景/成功指标），AI 预填 + 字段始终可编辑；成功指标可视化指标卡（指标名/当前值/目标值/达标状态）。
- §6.3 验收：AI 验收默认手动触发；「现在反馈」跳 IM 注入任务卡。
- 术语表：推进（从意图走向结果的动态过程）/ 意图线程（围绕一个意图积累上下文、行动、证据的聚合体）/ **事源**（上下文的最小单位，内部概念——本文的「事元」即此）。
- 附录：TAG 聚合模式 MVP 不做。

**原型**：`lingee-ai-advancement-v0-cross-page-2026-08-17.html`，同事乙，同群 fileId `file-proto`。以其中**最新的 lgap17 版「AI 推进」页**为准，函数锚点：`queueHtml`（三栏目队列）/ `detailHtml`（kicker+meta+指标卡+目标+决策+时间线的主详情）/ `metricsHtml`（成功指标卡行）/ `timelineHtml`（三色时间线+空态 hero）/ `decisionHtml`（阶段化决策区）/ `sideHtml`（信息来源+已有产物右栏）/ `startModal`（发起推进弹窗）。UI 复刻口径见 §7。

**本仓基线**：[`group-room-topics.md`](group-room-topics.md)（R21/R31 入口与页签；本设计新增第五页签，修订见其 v1.18 段）、[`dsh-home-session.md`](dsh-home-session.md)（D9 直写原则）、[`todo-design.md`](todo-design.md)（待办 = 轻量任务/事元角色）、[`../migration/todo-backend-migration.md`](../migration/todo-backend-migration.md)（§3 CLI 实测格式事实，本设计的存储层沿用同一套事实）。

---

## 1. 概念模型（event-sourced）

```
工作现场（对话 / 待办 / 文档·纪要 / 日程）
      │ 每个信号都是一条「事元」（append-only，带 ref 溯源）
      ▼
推进事项 = 事元流 + 投影
      ├─ 事元流：只增不改不删，永不裁剪 —— 事实本体
      ├─ 投影：名称/描述(目标)/负责人/目标日期/阶段(六态)/任务背景/成功指标/最新动态
      │        —— 由 host 在每次追加事元时折叠更新；投影是缓存，流是事实
      ├─ 推进时间旅程 = 事元流的渲染（时间/三色/描述/来源跳转）
      └─ 信息来源面板 = 事元流按 ref 去重聚合（类型/内容/状态）
```

- **事项**：7 字段投影 + tags。字段的当前值是事元流折叠出来的**投影**，不是独立可篡改的事实。
- **事元**（host 追加，模型不可改写历史）：`{ 时间, 来源类型(对话/待办/文档/会议/日程/数据/人工), refs(可溯源 yzj token 或 id), 摘要, 变化类型(目标更新/进度更新/偏差/决策请求/验收请求/阶段变化/备注), 变化内容(原值→新值), 操作者(user/agent/panel) }`。**阶段变化本身也是一条事元**——PRD「状态由 AI 判断触发」在数据上即体现为 agent 喂入的阶段事元。
- **轻量待办与事项的关系**：`yzj_todo_*` 三态与待办页签均不动——待办是事元的一种（一条待办可挂进某事项，其完成/推进作为事元回流），不是事项本身。
- **时间线完整性不变量**（硬要求 ②）：事元行只增不改不删（代码里不存在 update/delete 路径）；摘要/变化内容存全文；裁剪只发生在模型面 digest 与面板首屏窗口；`yzj_advance_get` 支持窗口翻页读全量。知识沉淀出口（第④期）：推进完成后把完整事元流折成复盘文档入知识库（目标演化、关键决策、偏差与证据链），并供 memory-yzj dream 固化取材。

## 2. 六态状态机（host 校验）

```
draft → running
running → decision-needed | ready-for-review | draft（打回草稿）
decision-needed → running | updated（用户拍板后）
updated → running | ready-for-review
ready-for-review → completed | running（验收打回）
completed → running（重开）
```

- `running` 是默认稳态：不进「待我决定/待我验收」栏、不打扰。
- `decision-needed → updated` 可多次触发（最小推进回路）。
- 非法跳变拒绝并在 digest 里回说明合法路径（与 todo 状态机同一范式）。

## 3. 存储 schema v1（demo 阶段：沿用「待办任务库」dbt + 库切换器）

在**同一「待办任务库」dbt** 里新增两张表（`sheet table create` 对存量 dbt 可用；新表 SingleSelect 可预注册，绕开运行期加选项被静默丢弃的坑——迁移文档 §3 事实 4/5）。库切换器/团队库语义天然复用：解析先走 todo 的 `resolveLibrary`（面板激活库 override → 显式配置 → 发现/开通），再在该 doc 内找/开通推进双表；用户切换任务库时推进事项跟随同一 doc。

**「事项」表**：

| 字段 | 类型 | 说明 |
|---|---|---|
| `advance_id` | MultiLineText | 稳定 ID，host 生成 `A-YYYYMMDD-NNN`，创建时查重幂等 |
| `名称` | MultiLineText | 事项名（必填） |
| `描述` | MultiLineText | 「这件事要做到什么」——当前有效目标 |
| `负责人` | MultiLineText | `姓名(openId)`（Contact 写入不可用的既有降级） |
| `目标日期` | Date | `YYYY/MM/DD` 字符串形态 |
| `阶段` | SingleSelect（预注册六态） | §2 状态机 |
| `任务背景` | MultiLineText | 立项背景，AI 比对的锚点之一 |
| `成功指标` | MultiLineText | 每行一条 `指标名: 当前 / 目标`，面板渲染成指标卡 |
| `标签` | MultiLineText | `#tag` tokens（与 todo 同一套归一化） |
| `最新动态` | MultiLineText | 投影缓存：最后一条事元的一行摘要 |
| `来源` | Url | 预留 deep link |

**「事元」表**：

| 字段 | 类型 | 说明 |
|---|---|---|
| `entry_id` | MultiLineText | `E-YYYYMMDD-NNN`，host 生成 |
| `advance_id` | MultiLineText | 所属事项（filter Equals 读流） |
| `时间` | MultiLineText | `YYYY/MM/DD HH:mm`（host 打点） |
| `来源类型` | SingleSelect（预注册） | 对话 / 待办 / 文档 / 会议 / 日程 / 数据 / 人工 |
| `变化类型` | SingleSelect（预注册） | 目标更新 / 进度更新 / 偏差 / 决策请求 / 验收请求 / 阶段变化 / 备注 |
| `摘要` | MultiLineText | 事件描述（时间旅程行的主文案） |
| `变化内容` | MultiLineText | 结构化 `原值→新值`（host 生成，含字段级 diff 行） |
| `引用` | MultiLineText | ref tokens（`yzj:...` / msgId / docId / todoId）空格分隔 |
| `操作者` | MultiLineText | `user` / `agent` / `panel` |

读路径：事项列表 = 「事项」表全量 + host 排序；详情 = 按 `advance_id` filter「事元」表（filter Equals 已实测可用）。写路径：每次 feed = 追加一行事元 + 回写事项投影字段（last-write-wins）。**两次写非事务**：投影写失败时事元行已在——读路径以事元流为准（`最新动态` 只是缓存）；原生后端应服务端折叠（记入迁移文档 API 需求）。

## 4. 工具契约（4 个，全部经既有门禁框架）

| 工具 | 门禁 | 参数要点 | 行为 |
|---|---|---|---|
| `yzj_advance_list` | 只读 | `stage?`（六态/open/all，默认 open）、`tag?`、`assignee?`、`limit?` | 三栏目分组投影（decision-needed / ready-for-review / 其余 open）；digest 一行一事项（id·名称·阶段·目标日期·最新动态） |
| `yzj_advance_get` | 只读 | `advanceId`（必填）、`entryOffset?`、`entryLimit?` | 单事项投影 + 事元流窗口（默认尾部，翻页可读全量）+ 信息来源聚合 |
| `yzj_advance_create` | 标准确认 | `title`（必填）、`goal?`、`background?`、`metrics?`、`assignee?`、`targetDate?`、`tags?`、`refs?`、`sourceType?`、`advanceId?`（幂等） | host 生成 `advance_id` → 查重幂等 → 建事项行 + 首条「立项」事元（refs 落引用列） |
| `yzj_advance_feed` | 标准确认 | `advanceId`（必填）、`sourceType`、`changeType`、`summary`（必填）、`detail?`、`refs?`、`stageTo?`、`goal?`、`metrics?`、`targetDate?`、`note?` | 校验六态流转（带 `stageTo` 时）→ 追加事元行（变化内容含 host 生成的字段级 `原值→新值`）→ 回写投影（阶段/目标/指标/目标日期/最新动态） |

**刻意不提供 `yzj_advance_update` / `yzj_advance_delete`**：一切变更都是 feed 一条事元（含阶段变化）——这就是「投影是折叠」的执行面；销毁历史走裸 `yzj_sheet_record_delete`（强确认红卡），路径刻意不便。

guard `WRITE_SPECS` +2：`yzj_advance_create` / `yzj_advance_feed` 均标准确认。确认卡 `advance` 域：事项名/变化类型/摘要/`原值→新值`/阶段流转（前→后）/来源 refs chips。

**`ctx.yzjAdvance` 服务**（ui-yzj RPC 的 host 端）：`state / get / create / feed / judge`。`judge(advanceId, action, note?)` 承接面板直写（全部落为 `操作者=user` 的事元）：

| action | 语义 | 阶段变化 |
|---|---|---|
| `confirm_condition` | 确认新条件（PRD §5.3.5 判断开关的「确认」支） | 无（记事元） |
| `confirm_advance` | 确认推进（按当前方案走） | decision-needed → updated |
| `accept` | 验收通过 | ready-for-review → completed |
| `reject` | 打回（退回补充） | ready-for-review / decision-needed → running |
| `ignore` | 忽略本次评估，不构成新约束 | decision-needed → running |

## 5. AI 怎么参与推进（六机制，分期；硬要求 ③）

- **A 建档预填**（①期）：话题中从对话/纪要识别意图，建议立项；AI 预填 7 字段（PRD §6.1「人只看和轻点确认」），用户在确认卡上核对。写路径 `yzj_advance_create` 经确认卡。
- **B 喂事元**（①期半手动 → ③期主动）：被召唤或读到新信息（群消息、纪要、文档变更）时，与在途事项的任务背景/成功指标比对（§5.2.2），判断「这条信息影响哪个事项」，写入结构化变化。写路径 `yzj_advance_feed` 经确认卡。
- **C 触发阶段变化**（③期）：偏差成立 → feed `stageTo: decision-needed` 推入「待我决定」；产物齐 → `ready-for-review` 推入「待我验收」。经确认卡。
- **D 最小推进回路对话面**（③期）：话题里核心变量对比 → 推进建议（AI建议+备选+自定义）→ 用户选择 → AI 复述影响（目标变化/工作调整/再次检查）→ 确认落 feed；用户判断本身记为事元。
- **E 验收辅助**（③期）：创建人手动触发（PRD §6.3），对照成功指标 N/N 与红线给一句话结论，不自动过。
- **F 周期巡检**（③期）：`schedule_create` 定时唤醒（todo 逾期播报同款机制）：拉 open 事项 + 近期群消息/纪要比对；`running` 无偏差则静默。

第一期交付 A/B 的写路径与 skill 教学（agent 从第一天可在话题中立项、喂事元，全程确认卡）；C–F 在③期做成主动行为。**诚实边界**：本仓 agent 无常驻监听，「监听工作现场」的实现形态是 schedule 唤醒 + 被召唤时比对。

## 6. 写路径分界（D9 沿用）

- **agent 发起的写**（`yzj_advance_create` / `yzj_advance_feed`）→ 标准确认卡。
- **用户面板判断**（judge 五动词、发起推进弹窗的直写创建）= 用户本人意志 → `/yzj` RPC 直写，不经确认卡（与面板待办勾选/快捷新建同一原则）。

## 7. 独立「推进」页签与 UI（复刻原型 lgap17 信息架构）

**独立看板落点（硬要求 ①）**：工作台新增**第五页签「推进」**（`WorkbenchDomain` 扩 `advance`），待办页签与 todo-pane 零改动。R21「无数据源不造假」不构成障碍——推进有自己的真实数据源（事项/事元双表），与当年否掉的空壳「会议/AI速记」页性质不同（决策 §9-1）。侧栏仍单「云之家」入口。

**复刻的是信息架构、区块文案基调与交互语义；视觉皮肤跟随本仓工作台现有语言（CSS Modules），不搬灵基紫蓝壳。**

- **左栏「我的推进」推进队列**（`queueHtml`）：三组带数量徽标（待我决定 / 待我验收 / 我关注的推进）；队列项 = 彩色圆点（红=待决定、蓝=推进中、绿=完成、灰=空）+ 事项名 + 一行说明（最新动态）；空态文案沿原型语气（「当前没有待决定事项 / AI 会在需要你的权限时再提醒」「暂无待验收结果 / 只有业务标准满足后才进入这里」）。
- **主详情**（`detailHtml`）：kicker（`A-…` + 阶段 pill）→ 事项名 → meta 行（负责人 / 目标日期）→ **成功指标卡行**（`metricsHtml`，按行解析 `指标名: 当前 / 目标`）→ 三个 section：
  1. 「这件事要做到什么」（当前有效目标 = `描述` 字段 + `任务背景`）；
  2. **决策区**（`decisionHtml`，标题随阶段：「需要你决定」/「是否已经达到目标」/「接下来会怎样」）——decision-needed 展示最新决策请求事元 + 「确认推进 / 忽略」；ready-for-review 展示「退回补充 / 确认达到目标」；running 只显示「AI 正在跟进…当前不需要你处理」；completed 显示「确认后的决定和经验可以回到共享知识库」；
  3. 「已经推进到这里」= **推进时间旅程**（`timelineHtml`）：每行 = 时间 + 三色圆点 + 事件 + 说明 + **来源跳转**（doc→知识库域或 web url、对话→对话域、待办→待办页签；可跳则跳、不可跳则标注来源，不造假链接）；首屏尾部窗口 + 「查看全部」翻完整流；空态 hero「这件事还没有开始推进」+「发起推进」。
- **右侧栏**（`sideHtml`）：「当前判断来自哪里」= 信息来源面板（单字图标 聊/待/文/会/日/数/人 + 标题 + 状态标）+ 底注「AI 推进不建立新的文件库，而是解释这些工作事实为什么支持或不支持当前目标」；「已有产物」= doc 类事元聚合。
- **发起推进弹窗**（`startModal`）：目标 textarea + 负责人 / 目标日期 + 成功指标 + 背景——面板直写创建（用户本人意志）。

三色映射（host 侧在视图里给 `tone`）：偏差/决策请求 → 红；验收请求、阶段变化至 completed → 绿；其余 → 蓝。

信息来源状态推导（第一期启发式，③期由 AI 判定取代）：最新一条该 ref 的事元——决策请求→等待中；偏差→未达标；操作者=user→已确认；其余→已读取。

`/yzj` RPC 新端点：`advance-state`（队列快照）/ `advance-get`（详情+事元窗口）/ `advance-create`（面板直写立项）/ `advance-judge`（五动词直写）/ `advance-ensure`（一键开通双表）。

## 8. 分期

| 期 | 内容 | 状态 |
|---|---|---|
| ① 地基 | 本设计 + 双表存储 + 4 工具 + guard + `ctx.yzjAdvance` + 独立「推进」页签（队列/详情/时间旅程/信息来源/judge 直写）+ skill 教学 | 本次实现 |
| ② 事元接入便捷化 | 话题里把 IM 消息/文档/纪要/日程 chip 一句话喂给事项；「现在反馈」跳对话域带事项卡 | 待排 |
| ③ AI 主动回路（机制 C–F） | 语义比对 → 核心变量对比 → 建议 → 复述影响 → 确认落 feed；AI 触发阶段；验收辅助；schedule 巡检 | 待排 |
| ④ 知识沉淀出口 | 完整事元流折成复盘文档入知识库；金蝶标准纪要模板；共识入库、下一步生成待办/日程（自动回链为事元）；供 memory-yzj dream 取材 | 待排 |
| ⑤ 同类纪要/推进归集分析 | 后置 | 待排 |

## 9. 决策表

| # | 决策 | 结论 | 理由 |
|---|---|---|---|
| 1 | 第五页签 vs 待办页内子视图 | **独立第五页签「推进」**（用户硬要求 ①） | R21「无数据源不造假」针对的是无数据源的空壳页；推进有自己的双表数据源。若反悔可无损降级为待办页内子视图（组件独立，挂载点一处） |
| 2 | todo 升六态 + 日志锚点双写（早期方案） | **作废** | 那是把推进体硬塞进 todolist；六态归事项，新表可预注册 SingleSelect，无需 hack；待办回归轻量任务/事元角色 |
| 3 | 页签文案 | 「推进」；`WorkbenchDomain` 值用 `advance` | 中文对用户、英文对代码，与既有四域一致 |
| 4 | 变更通道 | **只有 feed**，无 update/delete 工具 | 投影 = 流的折叠；改字段也是一条事元（带 `原值→新值`），时间线因此天然完整 |
| 5 | 存储落位 | 与待办同一「待办任务库」dbt，新增两表 | 复用库切换器/团队库/自动开通全套；事项与待办本来就该同库互链 |
| 6 | 双写非事务 | 接受；流为事实、投影为缓存 | demo 后端无事务；读路径可从流重折叠；原生后端应服务端折叠（迁移 API 需求） |
| 7 | 面板判断动词 | judge 五动词（confirm_condition/confirm_advance/accept/reject/ignore）直写 | D9：用户本人意志不经确认卡；每次判断都落为 user 事元（PRD「每次用户的判断及操作都记录在推进时间旅程上」） |
| 8 | 来源跳转边界 | doc 真跳（web url/知识库域）；对话跳对话域定位群（无消息锚点）；待办跳待办页签 | CLI 无消息级 deep link；不造假链接 |
| 9 | 角色三态（管理者/执行者/相关方） | 第一期不做 | 本仓单用户视角；PRD v2.1 的角色是任务角色（创建人/负责人/关注人），负责人字段已留 |

## 10. 验收口径（第一期）

1. 新库/存量库均能 provision 双表（缺表自愈）；立项 → feed 三条不同类型事元 → 投影与时间旅程一致、事元可溯源（refs 保留）。
2. **时间线无损**：feed N 条后可翻页读回全部 N 条，顺序与内容一致；代码无改写/删除路径。
3. 独立「推进」第五页签可用；待办页签行为与现状完全一致（回归测试）。
4. 三栏目归类正确；`running` 事项只出现在「我关注的推进」。
5. 用户 judge 直写无确认卡；agent create/feed 有确认卡且卡上可见变化摘要与阶段流转。
6. 六态非法跳变被拒并给出合法路径。
7. UI 结构与原型 lgap17 版逐区对照（队列三组徽标 / kicker+指标卡 / 目标区 / 阶段化决策区 / 时间旅程三色 / 信息来源状态标 / 空态文案），`.acceptance/verify-advance-board.mjs` 走查留证。
8. `pnpm test` 绿；文档只读可重建行为；侧栏仍单入口。
