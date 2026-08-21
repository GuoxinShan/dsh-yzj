# dsh-2 闭环演习实验设计（2026-08-21）

> 触发：决策 45（`advance-action-run` 闭环强制）落地后的真机模拟实验。
> **约束（用户拍板）**：① 全部 IM 消息只发 **dsh-2 群**（groupId `6a8400d4e4b09a073e3feeaf`）；② 待办/日程只建给本人；③ 不 @ 任何人、不触碰其他群与他人数据。

## 关键前置事实（决定实验形状）

**前置事实 1——本人消息不进巡检池**：`isSkippableSender` 刻意过滤本人 + BOT 发送者（防自激励，spec §14）。dsh-2 群只有本人可发消息 → 「观察弧」的机器自动发现路径（scan 入池 → Dream 抽取）对本实验信号**不可达**。因此信号注入走两条**真实用户路径**：

- **面板「喂给推进」**（②期直写）：本人在 dsh-2 发消息 → 群房间 hover 喂给事项（D9 本人意志，refs=[im:g:m] 真实可定位）；
- **sidecar agent-parity feed**（advance-loop-driver 模式）：决策请求/验收请求由 driver 直接 feed（等价于 agent 在话题里喂，绕开确认卡——验收脚本不替代卡面走查）。

**前置事实 2——`todo:` 订阅无采集器（2026-08-22 演习已证实）**：`coreScanAdvance` 只实现 `im:`（resolveGroupToken）与 `dir:`（scanDirThread）两个渠道的增量；`todo:`/`event:`/`doc:`/`file:` 是「关联即事元」的静态引用，无轮询。后果：决策 45 落地时自动订阅的 `todo:<id>` 不产生增量——「待办完成回流」现状只能靠 agent 主动 feed。S4 断层探测结果：**已证实**（勾待办 → 巡检 → Dream，事元流无「待办完成」）。后续任务：**todo 渠道采集器**（patrol 时对每个 todo: 订阅查状态、变化入池）——gap §24.28。

观察弧的机器部分（入池/去重/cursor）由既有单测与 真机实验覆盖，本演习不重验。

## 剧本：「闭环演习 · 演示环境准备」

| 阶段 | 动作 | 驱动 | 预期 |
|---|---|---|---|
| S0 立项 | 面板「发起推进」：标题「闭环演习·演示环境准备」、目标「08-26 前完成演示环境搭建并通过一次彩排」、指标「彩排通过: 0 / 1」、背景「演示环境依赖演示数据包；数据包不齐则环境起不来」；然后「关联来源」挂上 dsh-2 群 | Playwright | 事项入「我关注的推进」（draft）；信息来源区出现 im:dsh-2 |
| S1 正常进展 | dsh-2 发「演示脚本初稿已完成，明天下一轮校对」→ 群房间 hover 喂给推进 | driver 发消息 + Playwright 喂 | 进度事元落、**阶段仍 draft/running 不动**、refs 指向该消息 |
| S2 阻塞信号 | dsh-2 发「演示数据包还没齐，供应侧说最早下周一（08-24）才能给到」→ sidecar feed 决策请求（detail 带推论链「数据包 08-24 才到→彩排窗口被压缩→威胁 08-26 目标」+ 三动作行）→ stageTo=decision-needed | driver | 事项进「待我决定」；决策卡渲染问题 + 推论链 + 三动作按钮 |
| S3 三动作执行 | 面板点「建待办」→「发消息」（草稿过目后发送）→「定会议」 | Playwright | **决策 45 验收面**，见验收标准 A4 |
| S4 待办回流（断层探测） | sidecar 勾选 S3 建的待办为 done → 面板「立即巡检」→「Dream 抽取」→ 等 agent | driver + Playwright | 预期证实断层：池无 todo 渠道条目（见前置事实 2）；若出现回流事元则超出预期 |
| S5 收口六态 | 面板 judge 确认推进 → updated；sidecar feed 验收请求 → ready-for-review；面板确认达到目标 → completed | Playwright + driver | 六态走通；事元流全量无损（SQLite 行数 = 面板「查看全部」数） |

## 验收标准（PASS 条件）

- **A1 立项**：看板出现事项；立项事元 refs 可溯；dsh-2 在信息来源区。
- **A2 静默进展**：S1 事元落库且 refs=[`im:<dsh-2>:<msgId>`]；阶段未被拖动。
- **A3 决策卡**：进 decision-needed；卡面含推论链文本与 ≥1 动作按钮。
- **A4 执行闭环（核心）**：建待办 → 待办真建成 + 执行事元 refs=[todoId] + 信息来源区新增 `todo:` 订阅；发消息 → dsh-2 群时间线可见该消息 + 执行事元 refs=[`im:<gid>:<msgId>`]；定会议 → 留痕事元落；**刷新页面后三动作仍显示已执行**（foldDoneActions 流折叠）。
- **A5 断层探测**：S4 后断言池/事元中 todo 渠道信号**有无**——无论结果都记录：有 = 超出预期（采集器已存在）；无 = 断层证实，登记「todo 渠道采集器」为后续任务。
- **A6 六态**：running→decision-needed→updated→ready-for-review→completed 全程合法流转；事元流全量（SQLite entries 行数 == 面板查看全部条数）。
- **A7 边界**：全程零页面错误；CLI/RPC 写操作只触及 dsh-2 群与本人待办库；截图留证 `shots-advance-dsh2/`。

## LLM 软断言的诚实降级

Dream 抽取（S4）的产出由模型判定，不保证单次必落「待办完成」事元：超时 180s 未出现则记 SOFT-FAIL（不阻断整体 PASS，截图蓄水池状态留证），并在 gap 留痕待复查。

## 清理

演习数据可留（dsh-2 为实验群；事项 completed 后自然归档）。待办库的演习待办已完成态留存。
