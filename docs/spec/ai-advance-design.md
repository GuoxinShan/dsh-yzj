# AI推进：事元流驱动的「推进事项」

> 版本：v1.5（①②③ + ③.1 已落地；**v1.5 = 意图线程一等化（订阅模型，§15）+ 0819 产品会决策 20–24**；v1.4 = 主动发现 scan → inspect → feed 巡检回路，见 §14；v1.3 = 打扰判据 + 确认卡门控线收窄，见 §13）
> 日期：2026-08-19（v1.5 / v1.4 / v1.3 / v1.2 同日）
> 决策人：Guoxin Shan
> MVP↔灵基终态关系（合同 vs 脚手架）：[`../migration/advance-lingee-migration.md`](../migration/advance-lingee-migration.md)——本文是合同文本，该文件回答哪些条款迁移、哪些是 demo 落位。
> 定位：AI推进的一等对象是**「推进事项」——一个聚合了很多事元、动态变化的事件推进体**，不是 todolist。IM 消息、待办、文档、会议纪要、日程都是事元；每个事元可溯源，会让这件事产生目标更新、进度更新、偏差、决策请求；AI 的价值是把变化过程看清楚。
> 三条硬要求（用户 2026-08-19 拍板）：① 推进必须有待办以外的**独立看板**承载；② **完整时间线**永不裁剪，作为未来知识沉淀来源；③ AI 参与方式必须明确（§5 六机制）。
> 对照：实现缺口记 [`../status/gap-analysis.md`](../status/gap-analysis.md)。

---

## 0. 参考资料（防跑偏锚点，实现时对照）

**PRD**：《AI推进-产品PRD v2.1》，冯胜龙，云之家群「830 项目【登顶计划】」（groupId `6a605c7ce4b0772a6279295e`），fileId `6a84279269855600019ba7ba`（临时副本曾在 `/tmp/dengding-ai/`，可凭 fileId 随时重取）。关键锚点：

- §5.1.2 六态状态机 `draft→running→decision-needed→updated→ready-for-review→completed`；**状态变化由 AI 判断触发而非用户手动改**；`running` 是默认稳态不打扰。
- §5.2.2 Agent 角色：监听 IM/对话/会议纪要等工作现场，与在途任务的「任务背景/成功指标」做语义比对。
- §5.2.3 最小推进回路：增量信息 → 核心变量对比（原来的理解 vs 现在的约束）→ 确认新条件 → 推进建议（AI建议+备选+自定义）→ AI 复述影响（目标变化/工作调整/再次检查）→ 确认推进/继续修改/忽略，可多次触发。
- §5.3.2 AI推进看板 = 推进队列（三栏目：待我决定/待我验收/我关注的推进，全部 AI 生成）+ 推进详情（任务字段 + 推进时间旅程 + 信息来源面板）。
- §5.3.3 信息来源面板：来源类型（对话/任务/会议/数据/人员）+ 内容 + 位置 + 状态（已确认/已读取/未达标/等待中）；「AI推进不建立新的文件库，而是解释这些工作事实为什么支持或不支持当前目标」；与时间旅程双向关联。
- §5.3.4 推进时间旅程：时间 / 颜色标记（蓝=正常推进 绿=完成达标 红=偏差决策）/ 事件描述 / **来源跳转** / 空态引导；替代传统操作记录，每个事件可追溯到工作现场原始记录。
- §5.3.5 增量信息判断开关：任意来源，展示「这次变化改变了什么」+ 来源 + 用户判断。
- §6.1 任务详情 7 字段（名称/描述/负责人/目标日期/推进状态/任务背景/成功指标），AI 预填 + 字段始终可编辑；成功指标可视化指标卡（指标名/当前值/目标值/达标状态）。
- §6.3 验收：AI 验收默认手动触发；「现在反馈」跳 IM 注入任务卡。
- 术语表：推进（从意图走向结果的动态过程）/ 意图线程（**v1.5 升格为一等概念，订阅模型见 §15**：推进事项订阅的数据渠道，可多条；事元 = 线程上被采纳的 event）/ **事源**（上下文的最小单位，内部概念——本文的「事元」即此）。
- 附录：TAG 聚合模式 MVP 不做。

**原型**：`lingee-ai-advancement-v0-cross-page-2026-08-17.html`，农佳捷，同群 fileId `6a83f1947f37950001692878`。以其中**最新的 lgap17 版「AI 推进」页**为准，函数锚点：`queueHtml`（三栏目队列）/ `detailHtml`（kicker+meta+指标卡+目标+决策+时间线的主详情）/ `metricsHtml`（成功指标卡行）/ `timelineHtml`（三色时间线+空态 hero）/ `decisionHtml`（阶段化决策区）/ `sideHtml`（信息来源+已有产物右栏）/ `startModal`（发起推进弹窗）。UI 复刻口径见 §7。

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
| `yzj_advance_inspect` | 只读 | `advanceId?`、`signals?`、`mode?`（compare/review） | 摊开 open 事项的目标/背景/指标/最近事元/合法下一阶段 + 比对纪律；**不做语义结论**（决策 11） |
| `yzj_advance_scan` | 只读 | `groups`（必填，群 id/名，上限 8）、`limit?`（1–20） | 按群增量拉 IM（host 管 cursor）；首扫只建基线不回灌；过滤本人/机器人防自激励；digest = 新信号包 + open 事项一行 + 巡检纪律 |
| `yzj_advance_create` | 标准确认 | `title`（必填）、`goal?`、`background?`、`metrics?`、`assignee?`、`targetDate?`、`tags?`、`refs?`、`sourceType?`、`advanceId?`（幂等） | host 生成 `advance_id` → 查重幂等 → 建事项行 + 首条「立项」事元（refs 落引用列） |
| `yzj_advance_feed` | **条件确认**（改基准才卡，决策 14 / §13.5） | `advanceId`（必填）、`sourceType`、`changeType`、`summary`（必填）、`detail?`、`refs?`、`stageTo?`、`goal?`、`metrics?`、`targetDate?`、`note?` | 校验六态流转（带 `stageTo` 时）→ 追加事元行（变化内容含 host 生成的字段级 `原值→新值`）→ 回写投影（阶段/目标/指标/目标日期/最新动态） |

**刻意不提供 `yzj_advance_update` / `yzj_advance_delete`**：一切变更都是 feed 一条事元（含阶段变化）——这就是「投影是折叠」的执行面；销毁历史走裸 `yzj_sheet_record_delete`（强确认红卡），路径刻意不便。

guard `WRITE_SPECS` +2：`yzj_advance_create` 一律标准确认；`yzj_advance_feed` **条件确认**——只在载荷含 `goal` / `metrics` / `targetDate` / `assignee`（改写比对基准）时问，纯追加与阶段变化静默落（决策 14，门控表见 §13.5）。确认卡 `advance` 域：事项名/变化类型/摘要/`原值→新值`/阶段流转（前→后）/来源 refs chips。

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
- **B 喂事元**（①期半手动 → ③期主动）：被召唤或读到新信息（群消息、纪要、文档变更）时，与在途事项的任务背景/成功指标比对（§5.2.2），判断「这条信息影响哪个事项」，写入结构化变化。写路径 `yzj_advance_feed`：纯追加静默落，改基准才确认卡（§13.5）。
- **C 触发阶段变化**（③期）：偏差成立 → feed `stageTo: decision-needed` 推入「待我决定」；产物齐 → `ready-for-review` 推入「待我验收」。**不弹卡**——看板队列就是找人面（决策 14）；打扰判据见 §13.1。
- **D 最小推进回路对话面**（③期）：话题里核心变量对比 → 推进建议（AI建议+备选+自定义）→ 用户选择 → AI 复述影响（目标变化/工作调整/再次检查）→ 确认落 feed；用户判断本身记为事元。
- **E 验收辅助**（③期）：创建人手动触发（PRD §6.3），对照成功指标 N/N 与红线给一句话结论，不自动过。
- **F 周期巡检**（③期教学 → ④期落地，§14）：root 会话 `schedule_create`（every ≥ 5 min）唤醒 → `yzj_advance_scan` → `yzj_advance_inspect` → 按 §13 判据 feed。无偏差静默。dsh-routines 为 GUI 关掉时的无人值守扩展。

第一期交付 A/B 的写路径与 skill 教学（agent 从第一天可在话题中立项、喂事元，全程确认卡）；C–F 在③期做成主动行为。**诚实边界**：本仓 agent 无常驻监听，「监听工作现场」的实现形态是 schedule 唤醒 + 被召唤时比对。

## 6. 写路径分界（D9 沿用）

- **agent 立项**（`yzj_advance_create`）→ 标准确认卡（新对象，不是追加）。
- **agent 喂事元**（`yzj_advance_feed`）→ **只在改基准时**（`goal` / `metrics` / `targetDate` / `assignee`）弹标准确认卡；纯追加事元与阶段变化（含 → `decision-needed` / → `ready-for-review`）静默落，人在看板队列被找到（决策 14 / §13.5）。
- **用户面板判断**（judge 五动词、发起推进弹窗的直写创建）= 用户本人意志 → `/yzj` RPC 直写，不经确认卡（与面板待办勾选/快捷新建同一原则）。
- **用户一句话喂事元**（②期 §11：群房间/话题「喂给推进」、事项卡「现在反馈」的直写 feed）= 用户本人意志 → `/yzj advance-feed`，`操作者=user`，不经确认卡。RPC **不接受** `stageTo` / 目标字段（决策 10）。

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

`/yzj` RPC 端点：`advance-state`（队列快照）/ `advance-get`（详情+事元窗口）/ `advance-create`（面板直写立项）/ `advance-judge`（五动词直写）/ `advance-ensure`（一键开通双表）/ **`advance-feed`（②期用户一句话喂事元，不经确认卡，不接受 stageTo）**。

## 8. 分期

| 期 | 内容 | 状态 |
|---|---|---|
| ① 地基 | 本设计 + 双表存储 + 4 工具 + guard + `ctx.yzjAdvance` + 独立「推进」页签（队列/详情/时间旅程/信息来源/judge 直写）+ skill 教学 | ✅ 已落地（gap §24） |
| ② 事元接入便捷化 | 话题/群房间把 IM 消息一句话喂给事项（用户直写 feed）；「现在反馈」跳对话域带事项卡。文档/日程 chip 仍走 agent `yzj_advance_feed`（①期已通） | ✅ 已落地（gap §24.1） |
| ③ AI 主动回路（机制 C–F） | 语义比对 → 核心变量对比 → 建议 → 复述影响 → 确认落 feed；AI 触发阶段；验收辅助；schedule 巡检 | ✅ 已落地（gap §24.2）；**v1.3 补打扰判据 + 门控线**（§13，gap §24.3） |
| ③.1 主动发现 | `yzj_advance_scan` + host cursor + host 强制同源去重 + root `schedule_create` 巡检五步；可选 dsh-routines / 看板巡检状态行 | ✅ 已落地（§14，gap §24.4） |
| ③.2 意图线程订阅 | 事项 ↔ 线程订阅承载（§15.2）+ 面板「关联渠道」入口 + scan 按订阅取流分发 + 策略选择结构化（§15.4） | 待排（v1.5 定稿设计） |
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
| 10 | 用户一句话喂事元能否改阶段 | **不能**。面板 `advance-feed` 不接受 `stageTo` / 目标字段；只追加「这条信号属于该事项」。阶段仍由 agent feed（确认卡）或 judge 五动词触发 | PRD「状态由 AI 判断触发而非用户手动改」；②期便捷化是溯源接入，不是第二套状态机 |
| 11 | inspect 要不要做语义结论 | **不要**。`yzj_advance_inspect` 只摊开目标/背景/指标/最近事元/合法下一阶段/比对纪律；结论由模型经 `yzj_advance_feed` 确认卡写下 | host 不做 LLM；保持 feed 唯一变更通道 |
| 12 | 「请 AI 验收」是否自动发给助手 | **不自动发**。只切对话域并把验收提示写入问助手草稿；用户点「发送」才 followup（PRD §6.3 创建人手动触发） | 自动发送会变成第二条 IM/助手回合，且话题可能没打开 |
| 13 | 巡检 schedule 挂在哪 | **root / 用户主会话的 `schedule_create`**，不挂话题 agent。v1.4 起 bundle patch 挂 `@deepseek-ai/dsh-schedule`（id=`schedule`，与官方 overlay 同 id 以免双挂） | pitfall-007：程序化话题拿不到 harness schedule 工具；无偏差则 inspect 纪律要求静默不 feed |
| 16 | 主动发现的巡检宿主 | **主形态 = GUI 内 root 会话 `schedule_create`**（session-local，GUI 关了就停）。dsh-routines headless 是无人值守扩展（§14.4），不是替换 | 与 todo 逾期播报同型；harness schedule 只给 live root；C11 无人值守已验证走 routines，两条路并存不打架 |
| 17 | 监视哪些群 | **scan 显式 `groups` 参数**（schedule prompt 里写死 id/名）；上限 8 群；不做隐式全群扫描 | integration-master-plan「关注群数量设上限」；全量 recent 会把无关闲聊灌进比对 |
| 18 | 增量 cursor 存在哪 | **host storage-domain `yzj_advance_scan_cursors`**（groupId → lastMsgId）；模型不持 cursor | 与 `yzj_home_bindings` / `robot_yzj_surface` 同模式；模型持 cursor 就能回放或跳过 |
| 19 | 同源去重谁强制 | **host 强制**（`coreFeedAdvance` 在 append 前判定）。「同源」的判定口径 v1.5 后被决策 25 收窄（原口径=refs 有交集即幂等） | §13.3 原为教学面，自动发现会把同一 msgId 喂两次；升 host 后工具/RPC/服务共用一处 |
| 14 | agent feed 是否一律弹确认卡 | **不是**（v1.3 收窄）。卡只门控**改基准**（`goal` / `metrics` / `targetDate` / `assignee`）；纯追加事元与阶段变化（→ `decision-needed` / → `ready-for-review`）静默落 | 进度正常弹卡是纯噪音，会训练用户闭眼点「确认」；偏差已经有「待我决定」当注意力面，再弹卡等于同一件事问两遍，而第一遍「我能写这条吗」没有信息量；改基准会替换后续全部比对锚点，人没看过就换，AI 之后的判断无从校验——这才是值得一次打断的事 |
| 15 | 「重不重要」谁判断、怎么表达 | **AI 判断**，但只能表达为**阶段**（进不进 `decision-needed` / `ready-for-review`），不能表达为「这次要不要过卡」。判据成文见 §13.1–§13.4 | PRD「状态由 AI 判断触发而非用户手动改」；若让模型自选是否过卡，`tools/pre-execute` 这道写门禁就变成模型可绕的软闸（违背「策略只在 pre-execute」）。判据放教学面、门控线放 host 固定规则，两边都不需要 host 做语义判断（决策 11 保持） |
| 20 | 意图线程订阅存哪（v1.5） | **host storage-domain `yzj_advance_threads`**（advanceId → 线程 tokens），不动 dbt 双表 schema | 存量事项表加列要动已 provision 的表；storage-domain 与 cursor（决策 18）同模式即可落地。**这是 demo 落位不是合同**——终态订阅是事项聚合的原生关系（迁移文档断层 2） |
| 21 | 采集节奏（v1.5） | **双节奏**：Work = 被召唤 / schedule 唤醒时实时比对（既有 §12/§14）；Dream = 每日一次按订阅取各线程增量、筛有价值落事元、折叠出建议。cursor 保持**渠道级**（决策 18 不变），一次取流按各事项订阅 + 语义分发，不给每个事项建 cursor | 只有每日 Dream 会让偏差提示最长延迟 24h，与「会前材料预置/阻塞及时通知」冲突；只有高频巡检则噪音大。同一渠道可被多个事项订阅（830 群即多线并行），每事项一个 cursor 会重复拉流 |
| 22 | 对外命名（0819 会议） | 产品名「**AI 推进**」，中性、双向（上对下对齐 + 下对上反馈）；不用「参谋部」（太管理层，产品面向全员）；「战略对齐」被否（单向感） | 0819 14:00 会议对齐结论；品宣名词要短 |
| 23 | 策略选择的载荷（v1.5） | 决策请求事元的 `变化内容` 按行约定备选（`选项N: 描述`，末行可 `影响: …` 复述）；决策区渲染为可选项，用户选定经 judge `confirm_advance` 带 note 落 user 事元。**MVP 文本约定，终态原生结构化**（迁移文档断层 4） | PRD §5.2.3 最小推进回路要求「AI建议+备选+自定义」；0819 会议演示（私有化 → 加资源/延期/自定义）确认这是显式一步；demo 存储无结构化字段可用 |
| 24 | MVP 与灵基终态的关系（0819 会议） | **合同 + 证据 → 重建**，不是原型移植。三层拆分（合同/机制形状/宿主脚手架）、断层清单、验证清单收进 [`../migration/advance-lingee-migration.md`](../migration/advance-lingee-migration.md)；新任务先问「存钱还是镀金」 | 会上拍板终态要灵基侧重新组装（Honeycomb 式底座，非现有插件方式）；本仓代码大部分是脚手架，可带走的是合同、机制形状与真机证据 |
| 25 | 「同源」去重的判定口径（830 实验后收窄，修订决策 19） | **refs 集合完全相等 + 同一 changeType 才算重放**（幂等返回、不追加）；refs 部分重叠正常追加，返回 `overlappedRefs` 提示 | 830 真数据实验（gap §24.6）实测：交集口径误吞「目标更新」——不同事元合法引用同一文档（回放② refs=[0806,0812 纪要]、③ refs=[0812 纪要] 被幂等吞掉，模型追问中断、补救多弹一张卡）。交集口径把「引用同一证据」误等同「同一信号重放」；真正的重放是 refs 集合与语义类型都相同 |

## 10. 验收口径（第一期）

1. 新库/存量库均能 provision 双表（缺表自愈）；立项 → feed 三条不同类型事元 → 投影与时间旅程一致、事元可溯源（refs 保留）。
2. **时间线无损**：feed N 条后可翻页读回全部 N 条，顺序与内容一致；代码无改写/删除路径。
3. 独立「推进」第五页签可用；待办页签行为与现状完全一致（回归测试）。
4. 三栏目归类正确；`running` 事项只出现在「我关注的推进」。
5. 用户 judge 直写无确认卡；agent create/feed 有确认卡且卡上可见变化摘要与阶段流转。
6. 六态非法跳变被拒并给出合法路径。
7. UI 结构与原型 lgap17 版逐区对照（队列三组徽标 / kicker+指标卡 / 目标区 / 阶段化决策区 / 时间旅程三色 / 信息来源状态标 / 空态文案），`.acceptance/verify-advance-board.mjs` 走查留证。
8. **六态闭环真机**：`.acceptance/verify-advance-loop.mjs`（sidecar 经 bridge feed `draft→running→decision-needed` 与 `updated→ready-for-review`；面板点「确认推进」「确认达到目标」直写无卡；时间旅程保留立项/确认推进/验收通过）。agent 面确认卡仍由 `yzj_advance_feed` 门禁覆盖，本脚本不替代卡面走查。
9. `pnpm test` 绿；文档只读可重建行为；侧栏仍单入口。

---

## 11. ②期：事元接入便捷化

> v1.1。不改双表/六态/确认卡；只补「人在工作现场把一条信号挂上事项」的直写入口，以及看板回到对话的事项卡。

### 11.1 对象

```
UserFeed  // /yzj advance-feed，actor=user
  advanceId:  string     // 必填
  summary:    string     // 必填，一句话
  sourceType: 对话 | 待办 | 文档 | 会议 | 日程 | 数据 | 人工   // 默认：有 msg 引用则「对话」，否则「人工」
  changeType: 进度更新     // 面板固定；不开放阶段/目标字段
  refs:       string[]   // msgId / yzj token / docId … 可空
```

禁止从这条 RPC 传 `stageTo` / `goal` / `metrics` / `targetDate` / `assignee`。host 拒绝。agent 仍走 `yzj_advance_feed` 确认卡改阶段。

### 11.2 入口

| 入口 | 手势 | 写什么 |
|---|---|---|
| 群房间消息 hover | 「喂给推进」（与「交给助手」并列） | 事项选择器 + 一句话（默认消息前 80 字）→ UserFeed，`refs=[msgId]`，`sourceType=对话` |
| 话题透镜锚点 / 问助手栏 | 「喂给推进」 | 同上；锚点消息作 ref；问助手栏用当前草稿作 summary |
| 推进看板详情 | 「现在反馈」（PRD §6.3） | 切工作台「对话」域，注入事项卡（id/名称/阶段/目标摘要）。卡上可一句话直写 UserFeed（`sourceType=人工`）；群房间「喂给推进」预选该事项。取消清卡 |

文档/日程工作台行的「喂给推进」与 agent composer chip 喂入：agent 路径①期已通（`yzj_advance_feed` + refs）；工作台行入口本切片仍不做（§12.4）。

### 11.3 事项卡（现在反馈）

模块级 bus（与 `workbench-domain` 同款，不经 harness）：`setAdvanceFeedback(card | null)`。对话时间线顶部渲染一张非模态条，不顶走时间线、不 focus 官方 Chat。卡片不是第二条 IM，只是推进对象的透镜。

### 11.4 验收口径（②期）

1. 群房间一条消息「喂给推进」→ 选出事项 + 一句话 → 该事项时间旅程多一条 `操作者=user`、`来源=对话`、refs 含 msgId 的事元；无确认卡。
2. 话题透镜「喂给推进」同样落 user 事元；问助手栏仍只 `followup`，两个按钮不混。
3. 「现在反馈」切到对话域并出现事项卡；卡上直写与预选喂入都进同一事项；取消后卡消失。
4. `/yzj advance-feed` 带 `stageTo` 被拒；agent `yzj_advance_feed` 带 `stageTo` 仍走确认卡（回归①期）。
5. 待办页签、六态、feed 唯一变更通道均不变。
6. `.acceptance/verify-advance-feed.mjs`：已登录走「立项 → 现在反馈卡直写 → 再点现在反馈预选 → 群房间 hover 喂给推进 → 话题透镜锚点喂入 / 问助手栏取消且不 followup → 切回看板点开该事项读时间线」；未登录/无 `yzj-cli` 在五页签+看板 chrome 通过后对写路径 `SKIP` exit 0。新鲜 web profile 须先关掉内测声明/API Key 卡（pitfall-035）。切回「推进」后必须点开探针再读时间旅程（队列默认会停在上一件待决定事项）。

## 12. ③期：AI 主动回路（机制 C–F）

> v1.2。不改双表 / 六态 / D9。C–E 的**写**仍走 `yzj_advance_feed` 确认卡；host 不做 LLM。诚实边界（§5）：本仓 agent 无常驻监听，形态是「被召唤或 schedule 唤醒时比对」。

### 12.1 对象

```
Inspect  // yzj_advance_inspect，只读
  advanceId?: string          // 缺省 = 全部 open 事项
  signals?:   string          // 调用方贴上的新信息（群消息/纪要摘录）；可空
  mode?:      compare | review  // 默认 compare
```

digest 含：每条事项的目标 / 背景（原来的理解）/ 成功指标 / 最近事元 / 合法下一阶段 + 固定纪律（running 无偏差则不要 feed；偏差 → `changeType=偏差` + `stageTo=decision-needed`；产物齐 → `验收请求` + `ready-for-review`；**禁止 `stageTo=completed`**）。`mode=review` 额外要求对照指标给一句话结论。

### 12.2 机制落点

| 机制 | 本切片做什么 | 不做什么 |
|---|---|---|
| B 主动喂事元 | 被召唤时先 inspect 再决定是否 feed | 不监听群 WS |
| C 触发阶段 | inspect 给出合法下一阶段；模型经确认卡 `stageTo` | 面板直写仍不能改阶段（决策 10） |
| D 最小推进回路 | 话题里按五步说话（核心变量对比 → 建议 → 用户选 → 复述影响 → 确认落 feed）；看板 decision-needed 三按钮已是「用户选择」 | 不另做独立向导 UI |
| E 验收辅助 | 看板 kicker「请 AI 验收」：切对话域 + 把验收提示写入问助手草稿（`advance-ask` bus）；用户点发送才 followup | 不自动过、不 `stageTo=completed` |
| F 周期巡检 | inspect/feed 的 description 教 root 会话 `schedule_create`：到点 inspect，无偏差静默 | 不往话题 agent 挂 schedule（决策 13 / pitfall-007） |

### 12.3 请 AI 验收

模块级 bus（与「现在反馈」同款）：`setAdvanceAskDraft({ advanceId, title, text })`。话题透镜订阅后写入「问助手」输入框。对话顶可显示一条非模态提示「验收问题已预备，打开话题后发送」。取消清草稿。

### 12.4 明确不做（本切片）

文档/日程工作台**行**「喂给推进」——仍走 agent `yzj_advance_feed` + refs。独立巡检 daemon / dsh-routines 不在本切片。

### 12.5 验收口径（③期本切片）

1. `yzj_advance_inspect` 单测：open 事项 digest 含目标/背景/合法下一阶段；`review` 含「不要 completed」；无事项则提示静默。
2. inspect 不在 `WRITE_SPECS`（只读）。
3. 「请 AI 验收」切到对话域并出现问助手草稿；不发 followup。`.acceptance/verify-advance-feed.mjs` 在②期旅程末尾点 kicker → 断言 `data-workbench-domain=im`、验收预备 banner、问助手含 `yzj_advance_inspect` / `不要 stageTo=completed`、透镜无 followup。
4. feed 带 `stageTo=completed` 仍被状态机拒绝（除非当前已是 ready-for-review，且那是用户点「确认达到目标」的 judge，不是 inspect）。
5. 待办页签、②期用户直写 feed、六态均不变。

## 13. 打扰判据与确认卡门控线

> v1.3。决策 14 / 15。这一节回答两个**不同**的问题：**什么时候该打扰人**（AI 判断，表达为阶段）与**什么时候该让人批准写**（host 固定规则，模型不可绕）。两者不是同一道闸：看板队列是「让人决定」的面，确认卡是「让人批准写」的面；把它们叠在同一条信号上就会问两遍。

### 13.1 该打扰人（→ `decision-needed`，命中任一条）

| # | 判据 | 判断依据 |
|---|---|---|
| 1 | **基准冲突** | 新信号与「任务背景」写下的前提直接矛盾——原来的理解不再成立 |
| 2 | **指标掉头** | 任一成功指标由达标转未达标，或当前值朝远离目标值的方向移动 |
| 3 | **按趋势不可达** | 当前值与目标值的差距，在目标日期前按现速度补不上 |
| 4 | **目标日期受威胁** | 出现明确阻塞（等外部方 / 等人 / 依赖未交付） |
| 5 | **需要取舍或授权** | 继续推进必须砍范围、追加资源、改优先级，或会越过事项写明的红线 |
| 6 | **路径分叉** | 存在两条以上都合理、且会改变后续基准的选择 |

### 13.2 该静默（只追加事元，不改阶段）

- 信号与目标一致，且指标不变或朝目标移动；
- 纯过程信息：谁在做、做到哪、附了什么产物、时间地点变更但不影响目标日期；
- **已记录事实的复述 → 连事元都不写**（`running` 是默认稳态，§2）。

### 13.3 抑制（命中打扰判据也不重复提）

- 同一事项同一判据已在 `decision-needed` 且未处理 → 补进现有决策请求，不新起一条；
- 同一来源（msgId / docId）已喂过 → **host 强制去重**（决策 19，`coreFeedAdvance` 幂等跳过；「同源」= refs 集合完全相等 + 同一 changeType，决策 25——部分重叠只提示不拦截）；
- 同一判据曾被用户 `ignore` → 除非指标进一步恶化，不再提。

### 13.4 验收（→ `ready-for-review`）

成功指标 N/N 达标 + 产物类事元齐 + 无未决偏差。`completed` 仍只由用户在看板点「确认达到目标」。

### 13.5 门控线（host 固定，模型绕不过）

| feed 载荷 | 确认卡 |
|---|---|
| 只有 `summary` / `detail` / `refs` / `changeType`（纯追加） | 无 |
| 带 `stageTo`（含 → `decision-needed` / → `ready-for-review`） | 无——看板队列即注意力面 |
| 带 `goal` / `metrics` / `targetDate` / `assignee`（改基准） | **标准确认卡** |
| 带 `stageTo=completed` | 状态机拒绝（`completed` 只经用户 judge） |

`yzj_advance_create` 不受此收窄，仍一律标准确认卡。判据（13.1–13.4）写在 `INSPECT_DISCIPLINE` 与 feed description 里，是**教学面**；host 只执行本表的固定规则，不做语义判断（决策 11）。

**诚实边界**：静默 feed 把噪音代价前移到事元表——挡它靠 13.2 纪律 + **host 同源去重**（决策 19）+ 时间旅程当事后审计面。频率上限观察噪音后再定（记 gap）。

### 13.6 验收口径（v1.3）

1. `yzj_advance_feed` 只带 `summary` → 不弹卡；带 `stageTo=decision-needed` → 不弹卡；带 `goal` / `metrics` / `targetDate` / `assignee` 任一（非空）→ 弹标准确认卡。
2. `yzj_advance_create` 仍弹卡（回归①期）。
3. inspect digest 含 13.1 六条打扰判据、13.2 静默判据、13.3 抑制判据、13.5 门控线一句。
4. 用户直写 `/yzj advance-feed` 行为不变（决策 10：仍拒 `stageTo` 与基准字段）。

## 14. 主动发现（scan → inspect → feed）

> v1.4。把机制 B/F 从「被召唤时比对」升级为「AI 定时自己发现」。不改双表 / 六态 / D9 / 决策 10–15。host 仍不做语义结论（决策 11）。

### 14.1 回路

```
schedule 到点唤醒 root 会话
  → yzj_advance_scan(groups=…)     // host 管 cursor；无新消息 → 静默结束
  → yzj_advance_inspect(signals=新信号包)
  → 无关或复述 → 不写事元
  → 属于某事项且进度正常 → feed 进度更新（静默落；host 同源去重）
  → 命中 §13.1 打扰判据 → feed 偏差 stageTo=decision-needed（看板待我决定，无卡）
  → 要改基准 → 确认卡（§13.5）
```

对话机器人 WS **收不到**全量群消息（只投 @机器人 / 链内），所以发现通道是 CLI `im message list --type new` 轮询，不是入站监听。

### 14.2 `yzj_advance_scan`

- `groups`：群 id 或群名，必填，1–8 个。名经 `im group recent` 解析（精确匹配优先，唯一子串次之）。
- 每群：无 cursor → `type=newest` 取最新一条记 cursor，**不回灌历史**（基线）。有 cursor → `type=new --msg-id <cursor>`，跳过锚点自身。
- 过滤：本人（`contact user get` 的 openId）与 `fromOpenId` 以 `BOT-` 开头的机器人帖，防自激励（沿 T12 口径）。
- cursor 写 storage-domain `yzj_advance_scan_cursors`（决策 18）；只读工具，不进 `WRITE_SPECS`。
- digest：各群新信号（`messageLine` 形态，含 `<msgId>`）+ open 事项一行摘要 + 巡检五步纪律。无新信号则明写「无新消息，静默」。

### 14.3 巡检五步（教学面）

到点 → scan → 无新消息静默结束 → 有新信号则 inspect → 按 §13 判据行动。用户说「开启巡检」时，agent 在 **root 会话** `schedule_create`（`every_seconds ≥ 300`，prompt 含群清单）。诚实边界：session-local，GUI 进程关掉就停。

### 14.4 无人值守（dsh-routines，可选）

headless profile 挂 yzj **host half**（`docs/spec/headless-yzj.cordis.yml`：bridge + tool-yzj；不要挂 ui-yzj）。routine 跑同一回路；**禁止改基准**（无人应卡）。chatnode 默认每轮投 digest——无发现时 prompt 约定只输出 `[advance-patrol:quiet]`；要完全不推群就把 routine `deliver` 去掉 chatnode（只留 file）。见 `docs/spec/advance-patrol-routine.yaml`。

### 14.5 看板状态行

队列头「上次巡检 HH:mm · 本轮发现 N 条」（`/yzj advance-scan-state` 读 cursor domain 的 last-patrol meta）。设置面不做监视清单（groups 随 schedule prompt）。

### 14.6 验收口径（v1.4）

1. 首扫只建基线：digest 含「基线」且 signals 为空；第二次同群无新消息 → 「无新消息，静默」。
2. 增量消息（非本人、非 BOT-）出现在 digest，`<msgId>` 可被后续 feed 当 ref。
3. 同 msgId 第二次 `yzj_advance_feed` 幂等跳过，事元表不加行。
4. inspect 不在 `WRITE_SPECS`；scan 也不在。
5. 看板队列头能读到「尚未巡检」或「上次巡检」。
6. `pnpm test` 绿。

## 15. 意图线程（订阅模型）

> v1.5。把 §0 术语表里的「意图线程」升格为一等概念并给出可实现的订阅 schema。出处：0819 14:00 产品会（三概念定型：推进体 / 意图线程 / 推进回路）+ 用户旅程定稿（`../diagrams/advance-6-journey-spec.json`）。不改双表 / 六态 / 门控线 / feed 唯一变更通道。实现属 ③.2 期（§8），本节先定合同。

### 15.1 定义

**意图线程 = 推进事项订阅的一个数据渠道**；一个事项可挂 N 条线程；**事元 = 线程上被采纳的 event**（线程是「订阅了什么」，事元是「从订阅里捞到了什么」）。立项时的工作现场（通常是群）自动成为线程①；其余由用户「关联渠道」追加，或 agent 建议关联（写门禁同 feed 改基准？否——见 15.2 写路径）。

两类线程，采集语义不同：

| 类 | 例 | 增量语义 |
|---|---|---|
| **持续渠道** | IM 群 / 话题 | 有 cursor 概念，每轮取新消息（scan 既有机制） |
| **单文档源** | 纪要 / 文档 / AI 产物 / 待办 / 日程 | 关联即产一条事元；此后仅内容更新才算新 event（demo 阶段以更新时间戳判断，够用即可） |

**手动喂 ≠ 手动关联**（旅程图两条边）：单条直喂（②期 UserFeed / agent feed）直接产事元、立即生效，不经线程；关联渠道是订阅，之后靠采集节奏取增量。

### 15.2 订阅承载（demo 落位，决策 20）

host storage-domain **`yzj_advance_threads`**：`advanceId → [{ token, kind, label, addedBy, addedAt }]`。token 形态沿 refs 词汇：`im:<groupId>` / `doc:<docId>` / `todo:<todoId>` / `event:<eventId>` / `file:<fileId>`。不动 dbt 双表。

写路径：
- **用户关联/解除**（面板详情右栏「信息来源」区加「关联渠道」入口）= 用户本人意志 → `/yzj` RPC 直写（D9，同 judge）。
- **agent 关联** = 订阅影响后续采集范围但不改基准 → 随 `yzj_advance_create`（立项群自动线程①）或 feed 时带 `subscribe` 意图；不单独弹卡（与 `stageTo` 同级：看板可见即注意力面）。
- 投影：详情「信息来源」面板顶部列线程清单（渠道 + 最近取流时间），与既有按 refs 反推的来源条目并列——线程是订阅关系，来源条目是已采纳证据，两者不合并。

### 15.3 采集与分发（决策 21）

- cursor 保持**渠道级**（`yzj_advance_scan_cursors` 不变）：同一渠道被多个事项订阅时一次取流。
- 分发是模型职责：scan digest 列出新信号 + 各 open 事项的订阅清单，inspect 按「信号 ∈ 哪个事项的线程 + 语义相关」决定喂给谁；host 不做语义判断（决策 11），同源去重兜底（决策 19/25）。
- 双节奏：**Work**（被召唤 / schedule 唤醒，实时比对，§12/§14 既有）+ **Dream**（每日一次，按订阅全量取增量、筛有价值落事元、折叠摘要/建议/偏差提示；无偏差静默）。巡检频率的既有口径（≥300s）适用于 Work 触发；Dream 是低频大预算轮。

### 15.4 策略选择（决策 23）

decision-needed 的决策请求事元在 `变化内容` 里按行写备选：

```
选项1: 追加资源，目标日期不变
选项2: 目标日期顺延两周
选项3: 砍掉私有化范围，先公有云交付
影响: 目标从公有云交付改为私有化交付，检验标准需同步调整
```

决策区把 `选项N` 行渲染成可选项（既有「确认推进 / 忽略」动词之上）；用户选定 → judge `confirm_advance` 带 note=选定项 → 落 user 事元。MVP 文本约定；原生结构化记迁移需求（断层 4）。

### 15.5 验收口径（③.2 实现时）

1. 立项后 `yzj_advance_threads` 出现线程①（立项群）；面板可关联/解除渠道，落 user 记录。
2. 同一群被两个事项订阅：scan 一次取流，两个事项各自按语义收到分发（或不收），cursor 只前进一次。
3. 单文档源关联即产一条 `来源类型=文档` 事元；重复关联幂等。
4. 决策请求事元带 `选项N` 行时决策区渲染选项；选定后事元流出现 user 选择记录。
5. 双表 schema、六态、门控线、既有 E2E 全部回归绿。

