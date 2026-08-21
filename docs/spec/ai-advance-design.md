# AI推进：事元流驱动的「推进事项」

> 版本：v1.9（**决策 42：移除 bundle 的 `schedule`/`time-context` 挂载行**——决策 35 已把巡检收敛为 host 机械 routine，模型面 `schedule_create` 自此无消费者；v1.7 = §17 Dream 蓄水池落地，决策 33/34；v1.6 = ④期知识沉淀出口 §16 + 决策 26–31 含第七态 `cancelled`；v1.5 = 订阅模型一等化（当时名「意图线程」，v1.8 改名上下文来源；v1.7 决策 32 加 dir: 目录级订阅）；v1.4 = 主动发现 scan → inspect → feed 巡检回路，见 §14；v1.3 = 打扰判据 + 确认卡门控线收窄，见 §13）
> 日期：2026-08-21（v1.9 / v1.8）；2026-08-20（v1.7）；2026-08-19（v1.6 / v1.5 / v1.4 / v1.3 / v1.2 同日）
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
- 术语表：推进（从意图走向结果的动态过程）/ **上下文来源**（v1.5 立格、v1.8 改名，订阅模型见 §15：推进事项订阅的数据渠道，可多条；事元 = 来源上被采纳的 event）/ **事源**（上下文的最小单位，内部概念——本文的「事元」即此）。
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
      └─ 面板呈纯三层树(决策 39 后续):演进=事元时间线,事元展开见「原始信息 N」(事件行可读化+点击定位);
         扁平信息来源聚合列已删(aggregateSources 带 citing 保留在 API 面),侧栏只留上下文来源订阅
```

- **事项**：7 字段投影 + tags。字段的当前值是事元流折叠出来的**投影**，不是独立可篡改的事实。
- **事元**（host 追加，模型不可改写历史）：`{ 时间, 来源类型(对话/待办/文档/会议/日程/数据/人工), refs(可溯源 yzj token 或 id；消息事件用 im:<groupId>:<msgId> 带渠道 token，决策 39), 摘要, 变化类型(目标更新/进度更新/偏差/决策请求/验收请求/阶段变化/备注), 变化内容(原值→新值), 操作者(user/agent/panel) }`。**阶段变化本身也是一条事元**——PRD「状态由 AI 判断触发」在数据上即体现为 agent 喂入的阶段事元。**来源类型 vs refs 的语义分工（08-21 拍板）**：来源类型记**内容场合**（提炼者判断「这变化来自什么场合」，如会议讨论），refs 才是**溯源载体**（客观指针）；呈现层的出处脚注一律按 refs 实际 kind 聚合显示（会议来源引用群消息就显示「记录自 群消息」），无 refs 才退回来源类型。
- **轻量待办与事项的关系**：`yzj_todo_*` 三态与待办页签均不动——待办是事元的一种（一条待办可挂进某事项，其完成/推进作为事元回流），不是事项本身。
- **时间线完整性不变量**（硬要求 ②）：事元行只增不改不删（代码里不存在 update/delete 路径）；摘要/变化内容存全文；裁剪只发生在模型面 digest 与面板首屏窗口；`yzj_advance_get` 支持窗口翻页读全量。知识沉淀出口（第④期）：推进完成后把完整事元流折成复盘文档入知识库（目标演化、关键决策、偏差与证据链），并供 memory-yzj dream 固化取材。

## 2. 状态机（六态 + cancelled 终局；v1.6 起七态）

```
draft → running
running → decision-needed | ready-for-review | draft（打回草稿）
decision-needed → running | updated（用户拍板后）
updated → running | ready-for-review
ready-for-review → completed | running（验收打回）
completed → running（重开）
（非终态）→ cancelled（v1.6：中止——黄了/不再推进的体面收口）
cancelled → running（重启）
```

- `running` 是默认稳态：不进「待我决定/待我验收」栏、不打扰。
- `decision-needed → updated` 可多次触发（最小推进回路）。
- `cancelled`（已中止）与 `completed` 同为终局：**只由用户 judge 进入**（agent 禁止 stageTo=cancelled，同 completed；终局判断是人的主权）。中止是「黄了/不再推进」的体面收口——失败事项是复盘价值最高的对象（决策 26）。open 队列排除 completed/cancelled。
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
| `引用` | MultiLineText | ref tokens（`yzj:...` / `im:<groupId>:<msgId>` 消息事件指针（决策 39，面板据此定位到具体群消息）/ docId / todoId 空格分隔；legacy 裸 msgId 兼容降级跳群） |
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
- **右侧栏**（`sideHtml`）：「当前判断来自哪里」= 信息来源面板（单字图标 聊/待/文/会/日/数/人 + 标题 + 状态标）+ 底注「AI 推进不建立新的文件库，而是解释这些工作事实为什么支持或不支持当前目标」。v1.6 拍板收掉「已有产物」区：产物是事元的一部分，随信息来源呈现（原型 sideHtml 的产物区是冗余聚合）。
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
| ③.2 上下文来源订阅 | 事项 ↔ 来源订阅承载（§15.2）+ 面板「关联来源」入口 + scan 按订阅取流分发 + 策略选择结构化（§15.4）；v1.8 改名 threads→sources | ✅ 已落地（§15，gap §24.7） |
| ④ 知识沉淀出口 | 完整事元流折成复盘文档入知识库；金蝶标准纪要模板；共识入库、下一步生成待办/日程（自动回链为事元）；供 memory-yzj dream 取材 | ✅ 已拍板（§16，决策 26–31） |
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
| 13 | 巡检 schedule 挂在哪 | **root / 用户主会话的 `schedule_create`**，不挂话题 agent。v1.4 起 bundle patch 挂 `@deepseek-ai/dsh-schedule`（id=`schedule`，与官方 overlay 同 id 以免双挂）。**v1.9 起废止挂载行（决策 42）** | pitfall-007：程序化话题拿不到 harness schedule 工具；无偏差则 inspect 纪律要求静默不 feed |
| 16 | 主动发现的巡检宿主 | **主形态 = GUI 内 root 会话 `schedule_create`**（session-local，GUI 关了就停）。dsh-routines headless 是无人值守扩展（§14.4），不是替换。**v1.8 决策 35 起巡检已是 host 机械 routine（`startPatrolTimer`），v1.9 决策 42 移除 schedule 挂载行收尾** | 与 todo 逾期播报同型；harness schedule 只给 live root；C11 无人值守已验证走 routines，两条路并存不打架 |
| 17 | 监视哪些群 | **scan 显式 `groups` 参数**（schedule prompt 里写死 id/名）；上限 8 群；不做隐式全群扫描 | integration-master-plan「关注群数量设上限」；全量 recent 会把无关闲聊灌进比对 |
| 18 | 增量 cursor 存在哪 | **host storage-domain `yzj_advance_scan_cursors`**（groupId → lastMsgId）；模型不持 cursor | 与 `yzj_home_bindings` / `robot_yzj_surface` 同模式；模型持 cursor 就能回放或跳过 |
| 19 | 同源去重谁强制 | **host 强制**（`coreFeedAdvance` 在 append 前判定）。「同源」的判定口径 v1.5 后被决策 25 收窄（原口径=refs 有交集即幂等） | §13.3 原为教学面，自动发现会把同一 msgId 喂两次；升 host 后工具/RPC/服务共用一处 |
| 14 | agent feed 是否一律弹确认卡 | **不是**（v1.3 收窄）。卡只门控**改基准**（`goal` / `metrics` / `targetDate` / `assignee`）；纯追加事元与阶段变化（→ `decision-needed` / → `ready-for-review`）静默落 | 进度正常弹卡是纯噪音，会训练用户闭眼点「确认」；偏差已经有「待我决定」当注意力面，再弹卡等于同一件事问两遍，而第一遍「我能写这条吗」没有信息量；改基准会替换后续全部比对锚点，人没看过就换，AI 之后的判断无从校验——这才是值得一次打断的事 |
| 15 | 「重不重要」谁判断、怎么表达 | **AI 判断**，但只能表达为**阶段**（进不进 `decision-needed` / `ready-for-review`），不能表达为「这次要不要过卡」。判据成文见 §13.1–§13.4 | PRD「状态由 AI 判断触发而非用户手动改」；若让模型自选是否过卡，`tools/pre-execute` 这道写门禁就变成模型可绕的软闸（违背「策略只在 pre-execute」）。判据放教学面、门控线放 host 固定规则，两边都不需要 host 做语义判断（决策 11 保持） |
| 20 | 上下文来源订阅存哪（v1.5；v1.8 改名） | **host storage-domain `yzj_advance_sources`**（v1.8 前名 `yzj_advance_threads`，open 时 legacy 迁移；advanceId → 来源 tokens），不动 dbt 双表 schema | 存量事项表加列要动已 provision 的表；storage-domain 与 cursor（决策 18）同模式即可落地。**这是 demo 落位不是合同**——终态订阅是事项聚合的原生关系（迁移文档断层 2） |
| 21 | 采集节奏（v1.5） | **双节奏**：Work = 被召唤 / schedule 唤醒时实时比对（既有 §12/§14）；Dream = 每日一次按订阅取各线程增量、筛有价值落事元、折叠出建议。cursor 保持**渠道级**（决策 18 不变），一次取流按各事项订阅 + 语义分发，不给每个事项建 cursor | 只有每日 Dream 会让偏差提示最长延迟 24h，与「会前材料预置/阻塞及时通知」冲突；只有高频巡检则噪音大。同一渠道可被多个事项订阅（830 群即多线并行），每事项一个 cursor 会重复拉流 |
| 22 | 对外命名（0819 会议） | 产品名「**AI 推进**」，中性、双向（上对下对齐 + 下对上反馈）；不用「参谋部」（太管理层，产品面向全员）；「战略对齐」被否（单向感） | 0819 14:00 会议对齐结论；品宣名词要短 |
| 23 | 策略选择的载荷（v1.5） | 决策请求事元的 `变化内容` 按行约定备选（`选项N: 描述`，末行可 `影响: …` 复述）；决策区渲染为可选项，用户选定经 judge `confirm_advance` 带 note 落 user 事元。**MVP 文本约定，终态原生结构化**（迁移文档断层 4） | PRD §5.2.3 最小推进回路要求「AI建议+备选+自定义」；0819 会议演示（私有化 → 加资源/延期/自定义）确认这是显式一步；demo 存储无结构化字段可用 |
| 24 | MVP 与灵基终态的关系（0819 会议） | **合同 + 证据 → 重建**，不是原型移植。三层拆分（合同/机制形状/宿主脚手架）、断层清单、验证清单收进 [`../migration/advance-lingee-migration.md`](../migration/advance-lingee-migration.md)；新任务先问「存钱还是镀金」 | 会上拍板终态要灵基侧重新组装（Honeycomb 式底座，非现有插件方式）；本仓代码大部分是脚手架，可带走的是合同、机制形状与真机证据 |
| 25 | 「同源」去重的判定口径（830 实验后收窄，修订决策 19） | **refs 集合完全相等 + 同一 changeType 才算重放**（幂等返回、不追加）；refs 部分重叠正常追加，返回 `overlappedRefs` 提示 | 830 真数据实验（gap §24.6）实测：交集口径误吞「目标更新」——不同事元合法引用同一文档（回放② refs=[0806,0812 纪要]、③ refs=[0812 纪要] 被幂等吞掉，模型追问中断、补救多弹一张卡）。交集口径把「引用同一证据」误等同「同一信号重放」；真正的重放是 refs 集合与语义类型都相同 |
| 26 | 复盘的触发时机 | **终局收口**：事项进 `completed` / `cancelled` 时提示可沉淀；主路径 = 用户口述「我要复盘」（④期不做独立「沉淀复盘」按钮） | 用户拍板：「跟我的 agent 说我要复盘不就行了」——按钮只值发现性与上下文装配两个钱，对话即入口的产品哲学下不值得做壳；终局提示（「接下来会怎样」区）保留发现性。中途回看靠口述，不设专门入口 |
| 27 | 失败/黄了的事项怎么收口 | **加第七态 `cancelled`（已中止）**：非终态均可 judge 进入，`cancelled→running` 可重启；与 completed 同为终局，只由用户 judge（agent 禁止 stageTo） | 没有失败出口的事项只能烂尾在 running，而失败事项恰是复盘价值最高的对象；append-only 兼容（只是状态机多一条边）。judge 动词五→六（+`cancel`） |
| 28 | 「下一步」批量落待办的确认粒度 | **一批一次确认**（模型合并陈述多条 todo_create，用户一次确认） | 逐条弹卡训练人闭眼点确认（同决策 14 理由）；待办是可逆对象。且生成待办不是复盘必选动作——用户说「把这几条落成待办」时才发生 |
| 29 | dream 取材接口 | **只改 dream prompt 模板**（补「可经 yzj_advance_list/get 读事项产物事元」取材指引），不动 memory-yzj 机制 | dream 固化流程（vault/执行器）已验证；取材是指引不是新机制 |
| 30 | 复盘文档默认落点 | **「我的知识/推进复盘/<事项名>」自动建父目录**（可选手改） | 830「830实验·共识」父目录模式已验证（演示/清理两便）；一个事项可多次复盘，目录归档系列 |
| 31 | ④期实现范围 | **教学面 + 模板 + 终局提示 + cancelled 态**；工具面零新增（get/import/feed 全复用）；④-b 纪要出口只做模板+流程打包，群里转录自动感知留⑤期 | 830 第 0 波证明现有工具链人工已跑通（10 分钟/4 篇基线）；④期价值是流程打包，不是新能力（迁移文档「存钱 vs 镀金」） |
| 32 | 订阅粒度：单文档 vs 目录（v1.7） | **目录级 `dir:<docId>` 进持续渠道**（新增/更新文档 = 增量信号）；单文档 `doc:` 保留为「关联即事元」的静态引用。关联弹层去掉手输 token：只留 IM 群 picker + 知识库目录 picker | 用户拍板：「应该是知识库一整个这样才能自动获取增量」——单文档源没有增量语义；手输 token 是开发者界面不是用户界面。目录级（含整库根）比整库更精准，整库作为根目录特例同机制支持 |
| 33 | Dream 的采集模型 | **蓄水池**（DreamPool）：Work scan 的新信号 copy 入池 pending，Dream 触发时统一提炼；替代决策 21 的「Dream 每日直取订阅流」合同（直取无法攒批折叠） | 用户拍板 eventloop 设想：「定时把待抽取进 eventloop，到一定数量或时间就开始抽取事元产生建议卡片」；Work 即时价值（830 已验）不动，池是待抽取队列不是替代 |
| 34 | Dream 触发方式 | **三径：手动按钮（演示主路径）+ 水位提示（pending ≥ 5＝DREAM_WATER_LEVEL，面板抽取按钮高亮）+ 定时 schedule（既有机制）**；host 自动唤起 agent 会话后置 | 演示不能等定时任务；自动唤起需要 host 主动建会话（召唤窗面），复杂度后置 |
| 37 | todo 与缓存也切 sqlite（v1.8） | **todo 家族同切 local SQLite（双后端：真机 sqlite / 测试 dbt double）；IM 消息窗口/群清单/已读态缓存 = localStorage L1 + host SQLite L2 副本（`im-cache-get/put` RPC）**；云 dbt 在真机全死 | 用户拍板「待办也切 sql，云直接干掉；消息列表之类的缓存也进 sql」；todo 与 advance 同库不同表，单一本地事实源；缓存 L2 让刷新/跨会话首屏有热数据 |
| 38 | Dream 手动径落点（v1.8） | **host 直建 `yzj-dream-*` 会话**：面板按钮 → `advance-dream-run` RPC（agents.create + followup 抽取指令为 turn 1 + 钉标题「Dream 抽取 · 池中 N 条」）→ GUI 聚焦该会话；蓄水池 pending 明细进面板（「池 N」浮层，dreamState 扩展 entries） | 用户质疑「不应该是跳转到新会话吗，为啥是群里的话题助手」——askDraft 预填是决策 34 后置自动唤起的临时形态，两步走断层（跳群列表 + banner 暗示）；程序化建会话（话题同款）已验证，一步到位；「池里没地方看有啥」同轮反馈 |
| 39 | 事元 msg ref 的定位粒度（v1.8） | **事件级**：msg ref 升级为带渠道 token `im:<groupId>:<msgId>`（scan digest / dream 指令直接产出，agent 原样抄入 feed/create refs），面板点 ref/来源 → 打开该群并滚动高亮**那条消息**；legacy 裸 msgId 降级跳群不定位。锚点不在首窗时自动翻页加载更早（每群有界 10 页，找到或到底即停）。三层模型不变：事件（原始消息/文档）→ 事元（提炼，refs=事件指针，N 信息→1 事元）→ 事项（事元流折叠出演进，N 事元→1 演进态）；面板为纯三层树，无扁平原始信息列 | 用户拍板「跳转可以跳到 message 吗不是只是群；需要定位的是产生事元的事件」——模型与 spec 一致（refs 本就是事件指针），实现欠账在 msg ref 不带群信息且只到容器；捞过的消息本体都在 bound log（每群 500 条持久）且 fused 全量读，从未开过的群只 backfill 最近 50 条，故补自动翻页把「捞过就能定位」闭环 |
| 40 | 关联来源 picker 的知识库范围（v1.8） | **只列全部个人库的「整库」选项**（个人库数有界 6）；修正决策 32 只列「我的知识」的口径。**08-21 二拍收窄：一层目录/含子页文档节点不再列出**（实测灵基知识库没有独立文件夹对象，`type=2`/`fileSuffix=otl` 的文档带子页被当目录列出，混读奇怪）；存量 dir: 订阅（含文档级）不受影响 | 用户拍板「我的知识库是这两个（AI速记知识库 + 我的知识）感觉不对」——AI速记知识库是速记纪要的自动归档地（pitfall-041），picker 只列「我的知识」导致它永远选不到；`doc workspace list --type personal` 正好返回个人库集；二拍「就整库就好了别搞太复杂」 |
| 41 | Dream/Work 建议卡的产出形态（v1.8） | **动作型建议卡**：推 decision-needed 必须配 `changeType=决策请求`（host 强制拒绝其他 changeType），detail = 问题分析 + **动作行**（每行一个，可多个）：`动作: 建待办 \| 内容: <标题> \| 截止: <yyyy-MM-dd> \| 负责人: <名字>` / `动作: 发消息 \| 内容: <草稿>` / `动作: 定会议 \| 主题: <主题> \| 时间: <yyyy-MM-dd HH:mm>`（键可省）。面板渲为独立动作按钮：建待办点击直落当前待办库（user-direct）、发消息就地展开草稿框投到恰一订阅群、定会议跳日程域；执行后置灰并落一条 `操作者=user` 留痕事元。偏差只记录事实不推阶段。存量（偏差+stageTo 期）事项决策区兜底摆最新驱动事元 + 提示，不空区。事元级「问助手」入口：每条事元展开后可一键预填讨论草稿（kind=discuss）切对话域；决策卡同级「回到对话继续聊」入口——讨论落点**产出会话优先**（三拍「应该到产生这个演进的那个会话」）：feed 时 host 记录 `exec.agent.session.id` 进事元 `出处会话` 字段（sqlite fields JSON，免 dbt 重建），面板「问助手/继续聊」有产出会话则 focusBoundSession 直回该会话（草稿进剪贴板——官方 composer 无跨插件预填 API）；无记录（存量/面板直写）退回订阅群话题抽屉 latch（最新话题直开，没有则按标题现 mint，草稿预填问助手栏）。agent 聊出新建议后补/更新决策请求，用户再回看板拍板。卡上 agent 产的选项/动作是主按钮；有动态内容时写死的 judge 动词降级为次要行 | 用户拍板「应该 dream 要用 agent 产生一些东西，例如代办/发消息对齐/定会议；要简单；在看板随时能根据某个进展和 agent 讨论」——旧纪律「偏差成立 → 偏差+decision-needed」让决策区只剩裸动词（830 实测空决策区）；用户再拍板「选项应该是变化的/可以回到对话继续聊，而不是写死的」（AskUserQuestion 式体验在 harness 会话内无通用问答卡原语，看板决策卡+讨论回环即其实现）；动作直执/草稿分级符合 D9（用户点击=本人意志，外向写多一层眼检）；发消息不做自动发送，永远经人过目 |
| 36 | 推进双表存哪（v1.8 存储切换） | **local SQLite（node:sqlite，`~/.dsh/storages/yzj_advance.db`）**；todo 家族仍留云 dbt；双后端适配器（config 级 `setAdvanceBackend`，真机 sqlite / 测试 dbt） | 云多维表格 record 服务间歇 500（2026-08-20 全天多次，删探针/导数据全被挡）；推进看板是明天演示主面，不能押云脸；SQLite 本地闭环、无损 JSON 行、中文键复用 dbt 映射层；dbt 路径保留作测试与 legacy |
| 35 | 巡检要不要模型（v1.8 收敛） | **不要。巡检 = host 机械 routine（≥300s 增量入池，无模型）；模型只在 Dream 抽取时出场**。判断权单点收敛到 Dream | 830 实验观察到模型实时判断漂移（同一信号集一次拒噪音一次聚合）；巡检高频，模型实时判断烧 token 且双判断冗余（Work 喂一次 + Dream 抽一次）；水位达阈即提示抽取，实时性从「实时」变「水位实时」，偏差提示延迟可控 |
| 42 | schedule/time-context 挂载行去留（v1.9） | **从 bundle `cordis.patch.yml` 移除**。决策 35 把巡检收敛为 host 机械 routine、Dream 定时走 dream.json `dailyAt` 自管 tick 后，模型面 `schedule_create` 在代码与工具教学面均已无消费者；`time-context` 每步注入纯死重（每个会话每个 step 白付三行读数，dream 会话同样被注入）。保留 `@deepseek-ai/dsh-schedule` 的 package.json 依赖：robot-yzj `!routines` 命令以库形态 import `foldScheduleEvents`（折叠会话内 schedule 事件的纯函数），不需要插件挂载 | 用户质疑「为啥 yzj 要加这个我感觉不用啊」——核查确认 v1.4 的挂载理由（巡检五步教学，决策 13/16）已被决策 35 作废；根因是决策 35 落地时只改了巡检机制、没收挂载行的尾。harness 官方默认 composition 本就不启用 time-context（仅 `examples/web-schedule` opt-in overlay），移除后与官方口径对齐；用户如想恢复自行 `--patch examples/web-schedule/cordis.yml` 即可 |

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

## 14. 主动发现（host 机械巡检 → Dream 抽取）

> v1.4 立节（原名 scan → inspect → feed）；**v1.8 收敛（决策 35）：巡检 = host 机械 routine，无模型；模型只在 Dream 抽取时出场**。不改双表 / 六态 / D9 / 决策 10–15。host 仍不做语义结论（决策 11）。

### 14.1 回路（v1.8 收敛后）

```
host patrol timer（≥300s，ctx.effect 注册，卸载无残留）
  → coreScanAdvance（聚合 open 事项的上下文来源，cursor 增量取流）
  → 信号 copy 入蓄水池（§17）+ 水位更新   // 无模型，无 feed
  → 水位达阈（DREAM_WATER_LEVEL=5）→ 面板高亮「Dream 抽取」
Dream 抽取（手动 / 水位提示 / 定时三径）
  → yzj_advance_dream_status 读池 pending
  → yzj_advance_inspect 逐事项比对（§13 判据）
  → 有价值的落事元 / 建议卡 → yzj_advance_dream_mark 出池
```

对话机器人 WS **收不到**全量群消息（只投 @机器人 / 链内），所以发现通道是 CLI `im message list --type new` 轮询，不是入站监听。

### 14.2 `yzj_advance_scan`

- `groups`：群 id 或群名，必填，1–8 个。名经 `im group recent` 解析（精确匹配优先，唯一子串次之）。
- 每群：无 cursor → `type=newest` 取最新一条记 cursor，**不回灌历史**（基线）。有 cursor → `type=new --msg-id <cursor>`，跳过锚点自身。
- 过滤：本人（`contact user get` 的 openId）与 `fromOpenId` 以 `BOT-` 开头的机器人帖，防自激励（沿 T12 口径）。
- cursor 写 storage-domain `yzj_advance_scan_cursors`（决策 18）；只读工具，不进 `WRITE_SPECS`。
- digest：各群新信号（`messageLine` 形态，含 `<msgId>`）+ open 事项一行摘要 + 订阅清单。无新信号则明写「本轮无新信号」；有新信号则注明「已入蓄水池，抽取走 Dream」。v1.8 起 digest 不再附实时判断纪律（判断只在抽取时做）。

### 14.3 host 机械巡检（v1.8 收敛，决策 35）

`YzjAdvanceService.startPatrolTimer()`：setInterval ≥300s，tick = `patrolNow()`（coreScanAdvance 全量聚合，错误吞掉——巡检永不弄坏 host）。`ctx.effect` 注册，bundle 卸载清 timer。面板「巡检」按钮 = `/yzj advance-patrol-now` 立即机械一轮（无模型、不切域、不写 ask）。旧「巡检五步」模型教学面作废——830 实验观察到模型实时判断漂移（同一信号集一次拒噪音一次聚合），判断权收敛到 Dream 单点。

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

## 15. 上下文来源（订阅模型）

> v1.5 立节（原名「意图线程」）；**v1.8 概念修正：意图线程 → 上下文来源**（用户拍板：「意图」属于事项（意图体），渠道只是事项的**上下文来源**，旧命名把意图倒挂到了渠道上）。代码标识全量改名（threads→sources，domain `yzj_advance_sources`，含 legacy 存储迁移）；UI 右栏上区「上下文来源」（订阅的源）、下区「事元」（已采纳证据）。不改双表 / 六态 / 门控线 / feed 唯一变更通道。

### 15.1 定义

**上下文来源 = 推进事项订阅的一个数据渠道**；一个事项可挂 N 个来源；**事元 = 来源上被采纳的 event**（来源是「订阅了什么」，事元是「从来源里捞到了什么」）。立项时的工作现场（通常是群）自动成为来源①；其余由用户「关联来源」追加，或 agent 建议关联（写门禁同 feed 改基准？否——见 15.2 写路径）。

两类来源，采集语义不同：

| 类 | 例 | 增量语义 |
|---|---|---|
| **持续源** | IM 群 / 话题；**知识库目录**（v1.7 起，`dir:`——含整库根目录） | 有 cursor 概念，每轮取增量（scan 既有机制；目录级按「新增/更新文档」取增量） |
| **静态源** | 纪要 / 文档 / AI 产物 / 待办 / 日程 | 关联即产一条事元；此后仅内容更新才算新 event（demo 阶段以更新时间戳判断，够用即可） |

**手动喂 ≠ 手动关联**（旅程图两条边）：单条直喂（②期 UserFeed / agent feed）直接产事元、立即生效，不经来源订阅；关联来源是订阅，之后靠采集节奏取增量。

### 15.2 订阅承载（demo 落位，决策 20；v1.8 改名 sources）

host storage-domain **`yzj_advance_sources`**（v1.8 前名 `yzj_advance_threads`，open 时 legacy 迁移）：`advanceId → [{ token, kind, label, addedBy, addedAt }]`。token 形态沿 refs 词汇：`im:<groupId>` / `doc:<docId>` / `todo:<todoId>` / `event:<eventId>` / `file:<fileId>`；v1.7 起加 **`dir:<docId>`**（知识库目录节点；整库 = 库根目录）。不动 dbt 双表。

写路径：
- **用户关联/解除**（面板详情右栏「上下文来源」区「关联来源」入口）= 用户本人意志 → `/yzj` RPC 直写（D9，同 judge）。
- **agent 关联** = 订阅影响后续采集范围但不改基准 → 随 `yzj_advance_create`（立项群自动来源①，参数名 `sources`）或 feed 时带 `subscribe` 意图；不单独弹卡（与 `stageTo` 同级：看板可见即注意力面）。
- 投影：详情右栏上区列来源清单（渠道 + 最近取流时间）；下区「事元」列已采纳证据（按 refs 反推）——订阅关系与已采纳证据两区不合并。

> ③.2 实现落点（v1.8 改名后）：注册表 = `tool-yzj/src/advance-sources.ts`（domain `yzj_advance_sources`，token 字面量正则校验；open 时若新域空且 legacy `yzj_advance_threads` 有数据则迁移）；用户写路径 = `/yzj advance-source-add` / `advance-source-remove`（`ui-yzj`）；agent 写路径 = `yzj_advance_create` 的 `sources` 参数；静态源关联即追加一条 `备注` 事元（refs=[token]，重复关联被注册表 + 决策 19 双重幂等挡住）；解除只删注册表行，事元不删（时间线无损）。feed 带 `subscribe` 后置未做（见 gap §24.7）。

### 15.3 采集与分发（决策 21）

- cursor 保持**渠道级**（`yzj_advance_scan_cursors` 不变）：同一渠道被多个事项订阅时一次取流。
- 分发是模型职责：scan digest 列出新信号 + 各 open 事项的订阅清单（上下文来源），inspect 按「信号 ∈ 哪个事项的来源 + 语义相关」决定喂给谁；host 不做语义判断（决策 11），同源去重兜底（决策 19/25）。
- **目录来源的增量（v1.7，决策 32）**：`dir:<docId>` 来源按「`doc list --parent-id` 该目录」取增量——首扫建基线（docId→updateTime 快照，不回灌）；增量 = 新增文档或 updateTime 变化，信号 refs=[docId]、sourceType=文档。cursor 存 scan domain 的 `dirs` 表（与群 cursor 同域不同表）。**已知缺口（08-21 实证，pitfall-041 / gap §24.19）**：金蝶云 AI 速记把会议纪要归档到独立库（AI速记知识库 / 会议生成的共享库），不归档到用户订阅的库——dir: 订阅追不上速记库的增生；且列取只盖一层（整库订阅不看子目录）。⑤期需「速记库聚合订阅」或速记归档目标可配。
- 双节奏：**Work**（被召唤 / schedule 唤醒，实时比对，§12/§14 既有）+ **Dream**（每日一次，按订阅全量取增量、筛有价值落事元、折叠摘要/建议/偏差提示；无偏差静默）。巡检频率的既有口径（≥300s）适用于 Work 触发；Dream 是低频大预算轮。

> ③.2 实现落点：`yzj_advance_scan` 的 `groups` 改为可选——缺省时从注册表聚合全部 open 事项的 `im:` 来源去重取流（超过 8 个渠道报错提示分批，不悄悄截断，决策 17 刚性保持）；digest 新增「订阅清单」行供模型分发。Dream 仅定合同，未落地（④期配套）。

### 15.4 策略选择（决策 23）

decision-needed 的决策请求事元在 `变化内容` 里按行写备选：

```
选项1: 追加资源，目标日期不变
选项2: 目标日期顺延两周
选项3: 砍掉私有化范围，先公有云交付
影响: 目标从公有云交付改为私有化交付，检验标准需同步调整
```

决策区把 `选项N` 行渲染成可选项（既有「确认推进 / 忽略」动词之上）；用户选定 → judge `confirm_advance` 带 note=选定项 → 落 user 事元。MVP 文本约定；原生结构化记迁移需求（断层 4）。

> ③.2 实现落点：`advance-pane.tsx` 的 `parseDecisionOptions` 解析最新决策请求事元 `变化内容` 的 `选项N` / `影响` 行——选项渲染为按钮（点击 = `advance-judge { action: confirm_advance, note: 选项全文 }`），影响行单独展示，其余行照旧；无 `选项N` 行时既有三动词原样渲染。

### 15.5 验收口径（③.2 实现时）

1. 立项后 `yzj_advance_sources` 出现来源①（立项群）；面板可关联/解除来源，落 user 记录；legacy `yzj_advance_threads` 数据 open 时自动迁移。
2. 同一群被两个事项订阅：scan 一次取流，两个事项各自按语义收到分发（或不收），cursor 只前进一次。
3. 静态源关联即产一条 `来源类型=文档` 事元；重复关联幂等。
4. 决策请求事元带 `选项N` 行时决策区渲染选项；选定后事元流出现 user 选择记录。
5. 双表 schema、六态、门控线、既有 E2E 全部回归绿。

## 16. 知识沉淀出口（④期，决策 26–31 已拍板）

> v1.6。依据：硬要求 ②（完整时间线=知识沉淀来源）+ 830 真数据实验第 0 波人工基线（「转录→四段式纪要→入库」agent 口径约 10 分钟/4 篇，gap §24.6）+ 事项 A-20260819-002 的 goal 本身（「跑通 听会→标准纪要→共识入知识库→下一步入任务 的最小回路」——纪要出口是这个产品对自身的兑现）。**复盘 = 终局收口**（决策 26）：做完了（completed）或黄了（cancelled，决策 27）才沉淀；中途回看靠用户口述，不设专门入口。

### 16.1 两个出口场景（先分清，别揉在一起）

| 场景 | 输入 | 产物 | 触发点 |
|---|---|---|---|
| **④-a 事项复盘** | 一个事项的完整事元流（`yzj_advance_get` 翻页读全量，硬要求 ② 已有） | 复盘文档（目标演化/关键决策/偏差与证据链/下一步）入知识库，docId 回链事元 | 事项进 `completed`/`cancelled`（终局提示），或用户口述「我要复盘」 |
| **④-b 会议纪要** | 一份会议转录（群文件 fileId / 本地文件 / 知识库 docId） | 金蝶标准四段式纪要（目标/内容/共识/下一步）入知识库；「下一步」逐条挂入相关事项（feed 事元，refs=[纪要 docId]） | 用户把转录交给 agent（对话/喂给推进），后续可接 830 群话题自动感知（⑤期依赖） |

④-a 是「事项生命周期的收口」；④-b 是「工作现场的知识化」。两者的共同底座：**入库 = `yzj_doc_import`（标准确认卡），回链 = `yzj_advance_feed` 产物事元（纯追加静默，refs=[docId]）**——工具面零新增（见 16.3）。

### 16.2 复盘文档结构（④-a 合同）

```
# <事项名>复盘(<advanceId>,YYYY-MM-DD)
> 阶段历程:draft→…→completed | 时间跨度 | 事元数 N

## 目标演化        —— 每次「目标更新」事元的 原值→新值 diff 链，带时间戳与 refs
## 关键决策        —— decision-needed 事元 + 用户 judge 选择（选项N 全文),谁拍的板
## 偏差与证据链    —— 偏差事元 + 每条 refs 指向的原始消息/文档
## 下一步          —— 未闭环行动项（可回链生成待办，见 16.4)
## 附:事元全量索引  —— 时间 | 变化类型 | 摘要 | refs(永不裁剪的核对面)
```

与会议纪要四段式（目标/内容/共识/下一步）是两种文体：纪要对齐会议现场，复盘对齐事项生命周期。模板文件落 `docs/spec/`（实现时随代码同提交）。

### 16.3 工具面：零新工具（草案建议，待拍板 D26）

- 读：`yzj_advance_get` 翻页读全量事元流（既有，830 实验已验证 5 条全量读出）。
- 写库：`yzj_doc_import`（既有，标准确认卡）。
- 回链：`yzj_advance_feed` 追加「产物」事元（refs=[复盘 docId]，静默）。
- 面板入口：**不做独立「沉淀复盘」按钮**（决策 26）；事项进 `completed`/`cancelled` 时「接下来会怎样」区提示「可沉淀复盘」，点击 = 跳对话域带预填（同「请 AI 验收」模式）。主路径是用户口述。
- 教学面：feed/create description 或 `INSPECT_DISCIPLINE` 补「沉淀四步」（读全量 → 写复盘 → 入库 → 回链）。

零新工具的理由：830 第 0 波证明现有工具链已能人工跑通；④期的价值是**流程打包与触发面**，不是新能力。若拍板要「一键沉淀」（面板直写不经模型），才需要 `yzj_advance_export`（host 折叠模板，无 LLM）——草案不推荐：复盘品质恰恰靠模型读流后的归纳，host 模板折叠只是拼接。

### 16.4 下一步生成待办/日程（回链语义）

复盘/纪要的「下一步」段落逐条生成待办（`yzj_todo_create`，标准卡）或日程；每个生成动作回链一条 feed 事元（refs=[待办/日程 id])——待办/日程因此出现在事项「信息来源」里，闭环可追。确认卡策略：逐条弹卡会淹没人，建议**一批待办合并一次确认**（模型把多条 todo_create 合并陈述，用户一次确认）——待拍板 D27。

### 16.5 dream 取材（与 memory-yzj 的缝）

不动 memory-yzj 机制。dream 执行器的 prompt 模板补一条取材指引：可经 `yzj_advance_list`（含 completed）+ `yzj_advance_get` 读事项的「产物」事元（refs 指向复盘/纪要 docId）作为固化素材。复盘事元=「哪些事做完了、做成了什么样」的天然高价值观察。已拍板（决策 29）。

### 16.6 实现清单（决策 26–31）

1. 第七态 `cancelled`（已中止）：状态机边（非终态→cancelled、cancelled→running）+ judge 第六动词 `cancel`（用户直写无卡，D9）+ 面板「中止推进」入口（决策区低强调）+ open 队列排除 cancelled（同 completed）+ agent 禁止 stageTo=cancelled（INSPECT_DISCIPLINE/feed description 同步）。**存量表 schema 校验**：`阶段` SingleSelect 是建表时预注册的，CLI 无补选项命令——ensure 时读 schema 校验 cancelled 选项存在，缺失则明确报错引导（多维表格 UI 手工加一次即可），不静默丢（pitfall-003 教训）。
2. 模板两份落 `docs/spec/`：`advance-review-template.md`（复盘五段，16.2）+ `meeting-minutes-template.md`（金蝶四段式）。
3. 教学面：feed/get description + `INSPECT_DISCIPLINE` 补「沉淀四步」（读全量 → 写复盘 → 入库 → 回链）与「纪要四步」（读转录 → 四段式 → 入库 → 下一步挂事项）。
4. dream prompt 模板补推进事项取材指引（决策 29，memory-yzj）。
5. 终局提示：详情「接下来会怎样」区对 completed/cancelled 渲染「可沉淀复盘」入口（跳对话域预填）。
6. 复盘默认落点「我的知识/推进复盘/<事项名>」自动建父目录（决策 30，口述时模型遵循）。

### 16.7 验收口径（④期实现时）

1. 终局提示：事项进 `completed`/`cancelled` 后详情「接下来会怎样」区出现「可沉淀复盘」，点击跳对话域带预填。
2. cancelled 态：judge `cancel` 从各非终态进入已中止；open 队列排除；`cancelled→running` 可重启；agent `stageTo=cancelled` 被拒并给出「中止只由用户拍板」说明；存量表缺选项时 ensure 明确报错不静默丢。
3. 830 事项（A-20260819-002）实测复盘：口述「复盘一下 830 事项」→ 模型读全量事元 → 复盘 md（16.2 五段）→ `doc import` 弹卡 → 确认入库 → 回链事元出现在时间旅程与「已有产物」；全程确认卡恰好 1 张。
4. 给一段新转录 → 四段式纪要入库 → 「下一步」逐条挂事项并回链。
5. 既有 E2E 与单测全绿；`pnpm test` 不新增失败。

## 17. Dream 蓄水池（eventloop 模型；决策 33/34，v1.7 落地）

> 出处：用户拍板设想——「定时把待抽取进到 eventloop，到一定数量或者时间就开始抽取事元产生建议卡片；手动触发必须有（演示不能等定时任务）」。Dream 节奏从「每日直取订阅流」（决策 21 合同）演进为**蓄水池模型**。

### 17.1 模型

```
Work 巡检(scan) ──新信号──→ DreamPool(pending 蓄水)
                                │
            触发(手动按钮 / 水位提示 / 定时 schedule)
                                ▼
              模型统一提炼:读 pending → 比对待办事项 →
              有价值落事元(feed,refs=原信号)+ 命中判据 → 建议卡片(待我决定)
                                │
                                ▼
                    池条目标记 done(不删,审计面)
```

- **入池**：Work scan 的每个 accepted 信号（已过本人/BOT 过滤）**copy 一份入池**——Work 即时处理不受影响；池是「待抽取队列」，不是替代 Work。
- **不重复**：Work 已即时 feed 过的信号,Dream 再筛时 host 同源去重兜底（决策 19/25）;Dream 的价值在**跨渠道归集 + 折叠建议**（把分散信号攒成一次判断），不在重 feed。
- **建议卡片** = 既有「待我决定」队列的事项（stageTo=decision-needed 即卡片）,不新造 UI 形态。

### 17.2 触发三径（决策 34；手动径 v1.8 重定义，决策 38）

| 径 | 形态 |
|---|---|
| **手动** | 看板队列头「Dream 抽取」按钮 → host 直建 `yzj-dream-*` 新会话（`advance-dream-run` RPC：agents.create + followup 抽取指令为 turn 1 + 钉标题「Dream 抽取 · 池中 N 条」）→ GUI 聚焦该会话，一步到位（决策 38；替代决策 34 的 askDraft 预填两步形态） |
| **水位** | 池 pending ≥ 5（DREAM_WATER_LEVEL，可配）时队列头「池中 N 条待抽取 · 水位达到，建议抽取」+ 按钮高亮；水位只提示不自动唤起 |
| **定时** | 沿用既有「开启巡检」的 schedule_create 机制:用户说「开启 Dream」时 root 会话挂每日定时,prompt 即抽取指令 |

### 17.3 工具与数据面

- 池:storage-domain **`yzj_advance_dreampool`** `{ id, channel, refId, content, sendTime, enqueuedAt, done }`。
- 工具:`yzj_advance_dream_status`(只读:pending 清单+水位)与 `yzj_advance_dream_mark`(标记 done;host 内部状态,不在 WRITE_SPECS)。抽取本身零新工具(读池 → feed 复用);抽取指令文本单一事实源在 host(bound-io `dreamAskPrompt`,决策 38)。
- 面板:队列头第二行「池中 N 条待抽取 · 上次抽取 HH:mm」(RPC advance-dream-state);「池 N」按钮打开 pending 明细浮层(时间/渠道/refId/内容前 120 字,决策 38)。
- 会话:`yzj-dream-*` 前缀是普通 agent 会话(非 yzj-home/yzj-topic 视图),挂在云之家工作区;确认卡按 WRITE_SPECS 标准弹。

### 17.4 验收口径

1. scan 发现信号 → 池 pending 增加;Work 即时 feed 行为不变(830 路径回归)。
2. 手动「Dream 抽取」→ 模型读池 → 有价值落事元 + refs 溯源 + 命中判据进待我决定;处理后 pending 清零(标 done)。
3. 水位 ≥8 时队列头横幅出现;手动抽取后消失。
4. Work 已 feed 过的信号,Dream 重复落事元被同源去重幂等挡住。
5. `pnpm test` 绿;真机演示路径(关联 830 群 → scan 入池 → 手动抽取)全通。
