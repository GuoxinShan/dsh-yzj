# dsh-yzj 文档目录（Spec-driven 索引）

> 本仓库由 agent 维护、面向 agent 消费（AGENTS.md「Spec-driven」）。`docs/` 是仓库主体：设计、决策、坑、验收证据都以此为准，代码是文档的执行形式。**任何 agent 接手，从本文件开始。**

## 目录结构

```
docs/
  README.md                          ← 本文件：索引与阅读顺序
  release.md                           发布流程（GitHub 分享 / npm 全量发布 + 前置检查清单）
  spec/                              ← 设计基线（要做什么、为什么、验收口径）
    im-shell.md                        **v3.0 产品法**：IM 壳（助手单聊 1..N + 人群房间 + present）
    integration-master-plan.md         云之家×dsh 集成整体方案（v1.8 指针 → 会话家园；正文仍为 v1.7 人在闭环）
    group-room-topics.md               v2.0 历史产品法（群房间 + 话题 / 工作台）；导航已被 im-shell 覆盖
    dsh-home-session.md                DSH 唯一会话家园（v1.x 历史快照；D2/D3 被 group-room-topics 覆盖，D9 等仍有效）
    dsh-home-transcript.md             绑定会话可见时间线：插件消息日志（v1.x 历史快照；存储/去重/回填/切会话分阶段机制沿用，融合视图条款被覆盖）
    meeting-minutes-template.md        金蝶标准四段式纪要模板（目标/内容/共识/下一步）
    robot-channel-plan.md              机器人通道调研与双向打通方案（v0.2：会话落点改打绑定对象）
    yzj-openapi-requirements.md        云之家开放能力需求（对外：感知/行动/人审三类 17 项 × CLI/OpenAPI 现状 × 缺口；任务复用 = worktask；P0-P2 汇总）
    routines-delivery.md               定时任务引擎选型（dsh-routines 参考调研）+ yzj chatnode 投递契约
    memory-vault-design.md             记忆库组件设计（v0.2：vault 模型 + dream 开关/进程内固化/模型链 + 插件默认模型 + 群组留缝）
    memory-dream-routine.yaml          dream 固化 routine 模板（dsh-routines，备选路径）
    headless-yzj.cordis.yml            headless overlay：只挂 bridge + tool-yzj
  status/                             ← 实现与设计的对照与验收证据
    gap-analysis.md                    设计×实现 gap 对照（每功能提交留痕，含验收证据；§17 / §24 待办+推进历史节已归档，见文末 2026-08-27）
  pitfalls/                           ← 实现级坑库（一坑一文件 + 索引）
```

## 阅读顺序（新 agent 接手）

1. **`README.md`（仓库根）**——三分钟了解包结构与能力面。
2. **`spec/im-shell.md`**——**当前产品法（v3.0 IM 壳）**：助手是 1..N 条特殊单聊；云之家群/同事是人群房间；IM 只渲染 `present` 气泡 + 写确认卡。对照 `status/gap-analysis.md` §25。
3. **`spec/integration-master-plan.md`**——系统全貌：目标、用户旅程、人在闭环验收基准（会话模型见 IM 壳 + 下一份历史法）。
4. **`spec/group-room-topics.md`**——v2.0 历史产品法（群房间 + 话题 / 工作台三域）。导航与视图已被 im-shell 覆盖；人群房间日志、写路径 D9、话题前缀仍有效。
5. **`spec/dsh-home-session.md`** / **`spec/dsh-home-transcript.md`**——v1.x 历史快照：写路径 D9、消息日志存储/去重/回填（机制沿用）。
6. **`status/gap-analysis.md`**——当前实现状态与已验收证据（**§25 为 v3.0 IM 壳**；§23 为 v2.0 工作台快照；§17 / §24 待办+推进已归档）。
7. **`pitfalls/README.md` 索引**——动手前必查。单占槽二次 register 先读 pitfall-050；藏官方 InputBar 先读 pitfall-052；client copy 先读 pitfall-051；CLI 信封/0.1.6 先读 pitfall-003 / 049；确认卡 Full access 先读 pitfall-036。
8. 其余设计文档（机器人协议 → `spec/robot-channel-plan.md`；定时任务 → `spec/routines-delivery.md`；记忆库 → `spec/memory-vault-design.md`）。待办 / AI推进 spec 已从本仓删除。
9. **插件开发 skill**（`.agents/skills/`）——`cordis-plugin-development`；本仓规矩在 `AGENTS.md`。

## 命名规则

- 目录与文件名**英文 kebab-case**；正文中文（与全仓语言分工一致）。
- spec 文档带版本号与日期头；演进用「vN 变更」段落追加，不重写历史。
- `docs/` 根不再散放文档：新文档进对应子目录；新子目录须在本文件登记。
- **实验设计文档**：执行版实验设计放 `.acceptance/`（与验收脚本同目录）；实验**证据**归档进 `status/gap-analysis.md`，不留散件。
