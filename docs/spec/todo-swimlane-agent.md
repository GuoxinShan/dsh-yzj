# 泳道待办 + Agent 自动执行

> 版本：v1.2（期①②已落地；v1.1 六态定稿）
> 日期：2026-08-24（v1.2/v1.1/v1.0）
> 决策人：Guoxin Shan
> 触发：08-24 早会结论——待办用泳道图方式实现 + 要有 agent 自动执行概念；参考 [`DSH-taskboard`](https://github.com/shengsheng90/DSH-taskboard)（Harness 原生任务板插件）。
> 定位：todo 域的演进设计。与推进域的接力关系见 §3。

## 0. 参考仓库的本质（不是那张皮）

DSH-taskboard 的核心不是泳道看板的皮，是**自动执行回路**：

```
人建 backlog → 人批准到 todo → agent 自动 claim（排他+版本锁）→ agent 干
  → agent 提交 in_review → 人验收（accept）才 done
```

agent 最多走到 in_review，done 永远是人点的——与我们「终局人主权」（ai-advance-design 决策 27）同款哲学。它的工具面刻意收窄：无 accept 工具、无通用 status 工具，只有 claim/comment/submit_review/block/release_claim/relate。

## 1. 现状对照与缺口

| 面 | DSH-taskboard | 我们现状 | 缺口 |
|---|---|---|---|
| 存储 | SQLite 本地 | **已是 SQLite**（真机默认；dbt 留测试路径） | 无 |
| 状态机 | 七态 | 三态（pending/in_progress/done） | **+backlog（待决定）+in_review（待验收）+cancelled（终局）** |
| 看板 | 分列泳道 | 列表 | 泳道 UI |
| agent 执行 | claim→干→交验收 | **完全没有**——agent 只观察/分析/建议 | claim 机制 + 执行回路 + 验收面 |
| 自动化 | 定时 scheduler 自动 claim | 巡检 routine（只观察） | claim 调度（复用巡检骨架） |
| 人主权 | accept 只经人 | 终局只经人 | 同构，复用 |

## 2. 设计

### 2.1 六态状态机（v1.1：blocked 砍为 release 备注，S8）

```
backlog（待我决定）──人批准──► todo（可认领）──agent claim──► in_progress ──agent 提交──► in_review ──人验收──► done
                     ◄──人打回──┘  ◄──agent release(带备注)/人打回──┘  ◄──人打回（return，带评语）──┘
任意 open 态 ──人──► cancelled（终局，不占列）；done/cancelled 可重开（done→in_progress，cancelled→todo）
```

- `backlog`：新事/未批准的事——agent 不可认领的缓冲区；
- `todo`：人批准「可以做了」——agent 可认领的唯一入口（资格闸）；
- `in_review`：agent 干完交卷——**done 只经人 accept**（与推进终局同构）；
- `cancelled`：人终止（唯一终止坑——刻意不提供删除工具）；
- ~~`blocked`~~：**砍（S8）**——阻塞不是状态，是卡住的理由；agent 用 `yzj_todo_release_claim` 带备注「阻塞：…」，卡回可认领列显示备注。

### 2.2 claim 机制（排他 + 版本锁）

- `yzj_todo_claim`（agent 工具）：认领一件 todo——排他（已认领不抢）+ 乐观版本（stale 即重读）；claim 携带 agent 会话 id（谁干的可查）。
- `yzj_todo_submit_review`：干完交卷（带结果说明 + 证据链接）。
- `yzj_todo_release_claim`：释放认领，可带备注（阻塞即备注「阻塞：…」，S8）。
- **刻意不提供** `yzj_todo_accept`（人主权，同推进）、`yzj_todo_block`（阻塞是备注不是状态，S8）与通用 status 工具（状态只能走合法边）。

### 2.3 agent 执行回路

claim 后 agent 开工的落点：开一个新 agent 会话，首条消息注入任务上下文（任务 id + 标题 + **描述** + 版本）——与 DSH-taskboard 的「Open in new session」同款，也与我们的 Dream 手动径（host 直建会话注入指令，决策 38）同构（复用其形态：`yzj-todo-<stamp>` 会话 + `todoDispatchPrompt` 首 turn）。**描述是 agent 执行的提示词本体（S7）**：待办新增 `描述` 字段，人可在面板随时编辑任务详情（标题/描述/DDL/负责人，用户直写无卡）——批准前先改好提示词，验收时对照的也是它。MVP 形态：**手动触发**（泳道「可认领」列卡片「让 agent 做」按钮 → `/yzj todo-dispatch` / 口述「把 todo 里能做的做了」）；定时自动 claim 留到期③（复用巡检 routine 骨架）。

### 2.4 泳道看板 UI

待办页签从列表改五列泳道：**待我决定** | 可认领 | 进行中 | **待我验收** | 已完成（已终止收进折叠区，与推进看板「已结束」同款）。列名与推进三栏目同词（决策 52）——两个看板各只有两列会来找人。卡片操作即状态动词（批准/打回/验收）；卡片支持行内编辑任务详情（S7）；拖动留到后续。

### 2.5 与推进域的接力（两个域的分工）

```
推进域（判断面）：观察→分析→决策卡「该做什么」→ 动作行建待办 → 落 backlog
泳道待办域（执行面）：人批准 → agent 认领干 → 交验收 → 人 accept
回流（已有）：done → todo 渠道采集器（决策 48）→ 事元回推进时间线
```

**人管两头**（批准干什么 + 验收干得好不好），**AI 管中间**（判断该做什么 + 认领去做）。
落点分流（S6）：**agent 建的一律落 backlog**（含决策卡动作行与裸 `yzj_todo_create`）；**面板快捷新建落 todo**（用户本人意志即隐式批准，D9）。

## 3. 写门禁（D9 沿用）

- `approve`（backlog→todo）/ `accept` / `return` / `cancel` / 编辑任务详情（S7）：人面板直写，无卡；
- `claim` / `release` / `submit_review`：agent 工具，**静默无卡**（可逆、不对外写——claim 只是状态标记；干活的写由工作区自己的门禁管）；
- 既有 `yzj_todo_create/update/complete` 保留：create 落 backlog（S6）；complete 在泳道语义下 = 人直写 done（不经 review 的快路径，面板勾选沿用）。

## 4. 决策表

| # | 决策 | 结论 | 理由 |
|---|---|---|---|
| S1 | 存储 | **本地 SQLite**（现状已是；dbt 路径留测试） | 用户拍板「用 sqlite 别用多维表了」；决策 36 已切真机默认 |
| S2 | agent 能走到哪 | **in_review 为止**；done 只经人 accept | DSH-taskboard 同款 + 我们终局人主权同构 |
| S3 | claim 要不要确认卡 | **不要**（可逆、无外部写） | 弹卡训练闭眼点（决策 14 同款理由） |
| S4 | 自动 claim 的时机 | **MVP 手动触发**；定时自动留期③ | 演示可控；巡检 routine 骨架可复用但不预支 |
| S5 | 与既有待办的关系 | 六态为超集：pending→todo、in_progress 不变、done 不变；存量待办落 todo 列（读取时归一化，零迁移抖动） | 快路径（人直写 done）保留 |
| S6 | 新建待办的落点 | **agent 建的一律落 backlog**（决策卡动作行 + 裸 `yzj_todo_create`）；**面板快捷新建落 todo** | 人管「干什么」的闸要拦住一切 AI 来源；用户自己建即本人意志，隐式批准（D9） |
| S7 | 任务详情可编辑 | **新增 `描述` 字段（= agent 执行的提示词本体）；人可在面板行内编辑标题/描述/DDL/负责人**，用户直写无卡 | 用户拍板「本质上 AI 干就是发一段提示词，人可以修改这个任务描述」——批准前改提示词是人的第一闸的本职 |
| S8 | blocked 的位置 | **砍状态，降级为 `release_claim` 备注**（卡回可认领列显示「阻塞：…」） | 用户拍板状态不要复杂（2026-08-24 同会话砍推进 draft/updated，决策 52）：阻塞是卡住的理由不是状态；省 1 态 2 边 1 工具 |

## 5. 分期与验收口径

| 期 | 内容 | 验收 |
|---|---|---|
| ① 状态机+泳道（**已落地** 2026-08-24） | 六态 + claim 工具族 + 泳道 UI + 人验收 + 行内编辑（S7） | 单测全绿；密封 e2e 17/17；真机 GUI 五列+动词走查全绿（verify-todo-swimlane.mjs） |
| ② 执行回路（**已落地 MVP 手动径** 2026-08-24） | claim 后自动开 agent 会话干活（任务上下文注入）：「让 agent 做」→ `/yzj todo-dispatch` → host 直建 `yzj-todo-*` 会话注入任务卡 | 真机：派发后会话自动开工，产出落 in_review 评语（verify-todo-dispatch.mjs） |
| ③ 自动调度 | 定时/水位自动 claim | 巡检骨架复用；quota 上限 |

## 6. 边界（明示不做）

- 不做 Gantt/依赖图/附件管理（DSH-taskboard 有，我们不需要——附件走云之家文件）；
- 不做多项目（多 project key）——单库 + tag 聚合（既有 todo 理念）；
- 不改推进域任何面（接力关系是单向：推进建待办 → 待办被做 → 回流）。
