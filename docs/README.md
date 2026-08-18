# dsh-yzj 文档目录（Spec-driven 索引）

> 本仓库由 agent 维护、面向 agent 消费（AGENTS.md「Spec-driven」）。`docs/` 是仓库主体：设计、决策、坑、验收证据都以此为准，代码是文档的执行形式。**任何 agent 接手，从本文件开始。**

## 目录结构

```
docs/
  README.md                          ← 本文件：索引与阅读顺序
  release.md                           发布流程（GitHub 分享 / npm 全量发布 + 前置检查清单）
  spec/                              ← 设计基线（要做什么、为什么、验收口径）
    integration-master-plan.md         云之家×dsh 集成整体方案（v1.8 指针 → 会话家园；正文仍为 v1.7 人在闭环）
    group-room-topics.md               v2.0 产品法：1 群 = 1 群房间 + N 话题会话；工作台三栏；v1.10 R26 话题 job-done 投递
    dsh-home-session.md                DSH 唯一会话家园（v1.x 历史快照；D2/D3 被 group-room-topics 覆盖，D9 等仍有效）
    dsh-home-transcript.md             绑定会话可见时间线：插件消息日志（v1.x 历史快照；存储/去重/回填/切会话分阶段机制沿用，融合视图条款被覆盖）
    todo-design.md                     待办功能设计（v1.3，tag 理念 + §11.2 决策表；直写原则交叉引用会话家园）
    robot-channel-plan.md              机器人通道调研与双向打通方案（v0.2：会话落点改打绑定对象）
    routines-delivery.md               定时任务引擎选型（dsh-routines 参考调研）+ yzj chatnode 投递契约
    memory-vault-design.md             记忆库组件设计（v0.2：vault 模型 + dream 开关/进程内固化/模型链 + 插件默认模型 + 群组留缝）
    memory-dream-routine.yaml          dream 固化 routine 模板（dsh-routines，备选路径）
  migration/                          ← 架构演进方案
    todo-backend-migration.md          待办 demo 后端 → 原生后端（四层架构 + §3 实测格式事实）
  status/                             ← 实现与设计的对照与验收证据
    gap-analysis.md                    设计×实现 gap 对照（每功能提交留痕，含验收证据）
  pitfalls/                           ← 实现级坑库（一坑一文件 + 索引）
```

## 阅读顺序（新 agent 接手）

1. **`README.md`（仓库根）**——三分钟了解包结构与能力面。
2. **`spec/integration-master-plan.md`**——系统全貌：目标、用户旅程、人在闭环验收基准（会话模型见下一份）。
3. **`spec/group-room-topics.md`**——**当前产品法（v2.0 / v1.1 工作台）**：1 群 = 1 群房间 + N 话题会话；两视图各一个发送动词；导航 = 侧栏脚「云之家」入口块 + 工作台会话列表 + 右侧话题抽屉。对照 `status/gap-analysis.md` §23。
4. **`spec/dsh-home-session.md`** / **`spec/dsh-home-transcript.md`**——v1.x 历史快照：会话对象、写路径 D9、消息日志存储/去重/回填/召唤窗口（机制沿用）；1:1 绑定与融合一条流已被 v2.0 覆盖（保留/作废对照见 group-room-topics §6）。
5. **`status/gap-analysis.md`**——当前实现状态与已验收证据（§15–§21 为既有面；§22 为 v1.8 实现快照；**§23 为 v2.0 目标 vs 现状**）。
6. **`pitfalls/README.md` 索引**——动手前必查；命中相关条目先读再写代码。话题「发给助手」没近窗先读 pitfall-027；想把文件挂进回复链先读 pitfall-028（CLI `file` 不支持 `--reply-msg-id`）。
7. 任务相关的设计文档（todo 域 → `spec/todo-design.md`；机器人协议 → `spec/robot-channel-plan.md`（会话落点已被 dsh-home-session 覆盖）；定时任务 → `spec/routines-delivery.md`；记忆库 → `spec/memory-vault-design.md`）。
8. **插件开发 skill**（`.agents/skills/`）——`cordis-plugin-development` 按 cookbook 座位提炼成本仓契约；`editing-cordis-compositions` 仍是创造模式原文。本仓规矩在 `AGENTS.md`。索引见 [`.agents/skills/README.md`](../.agents/skills/README.md)。

## 命名规则

- 目录与文件名**英文 kebab-case**；正文中文（与全仓语言分工一致）。
- spec 文档带版本号与日期头；演进用「vN 变更」段落追加，不重写历史。
- `docs/` 根不再散放文档：新文档进对应子目录；新子目录须在本文件登记。
