# pitfall-040：外部 seed sqlite 事元缺 `entry_id` fields 键，被 parse 静默过滤出时间线

> 记录日期：2026-08-20
> 影响区域：`.acceptance/verify-advance-anchor.mjs` 等直接写 `~/.dsh/storages/yzj_advance.db` 的验收脚本 / 任何绕过 `appendEntry` 的 sqlite 直插

## 现象

验收脚本往 entries 表 INSERT 一行事元（entry_id/advance_id 列都填了，fields JSON 用中文键），`SELECT COUNT(*)` 确认在库，GUI 看板却始终不显示；同结构经 agent `yzj_advance_feed` 写入的行正常显示。且早期一轮「验证」因 Dream 抽取产出的裸 msgId ref 事元恰好走了「恰一订阅群跳转」路径而全 PASS——**假阳性掩盖了 seed 行从未进过时间线的事实**。

## 复现条件

1. 脚本用独立 `node:sqlite` 连接向 entries 表 INSERT，fields JSON 只含中文业务键 + `advance_id`，**缺 `entry_id` 键**（id 只写进了列）。
2. GUI host `fetchEntries` sqlite 分支：`parseAdvanceEntry` 从 `fields['entry_id']` 取 id（`ENTRY_F.id`），空串直接 `return null`。
3. filter 丢弃 → 时间线无此行，无任何报错。

## 根因

`parseAdvanceEntry` 的 id 事实源是 **fields JSON 里的 `entry_id` 键**（与 dbt 行的 record.fields 对齐），不是表的 entry_id 列。`appendEntry` 写入时会在 fields 里同时放 `entry_id`；列只是存储索引。绕过写入路径的直插脚本不知道这个双写约定。排查时受「双连接可见性」怀疑干扰绕了远路——实际上 host 日志一打 `rows=N` 立刻看清（读取正常，parse 层丢行）。

## 解法

seed 脚本 fields 与写入路径产物对齐：**同时携带 `entry_id` 与 `advance_id` 键**（verify-advance-anchor.mjs 已修并注释）。排查同类「写进库、UI 不见」问题时，先在 host 侧加一行读路径日志（localStore 路径 + 行数）区分「读不到」vs「parse 丢行」，再查连接/缓存等远因。

## 回归覆盖

`.acceptance/verify-advance-anchor.mjs` 的 seed 注释 + 事件行断言（seed 行出现在时间线是全链路前提）。单测覆盖不了外部直插形态（FakeStore 走 appendEntry 全键路径）。
