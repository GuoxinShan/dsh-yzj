# dsh-yzj 文档目录（Spec-driven 索引）

> 本仓库由 agent 维护、面向 agent 消费（AGENTS.md「Spec-driven」）。`docs/` 是仓库主体：设计、决策、坑、验收证据都以此为准，代码是文档的执行形式。**任何 agent 接手，从本文件开始。**

## 目录结构

```
docs/
  README.md                          ← 本文件：索引与阅读顺序
  release.md                           发布流程（GitHub 分享 / npm 全量发布 + 前置检查清单）
  spec/                              ← 设计基线（要做什么、为什么、验收口径）
    integration-master-plan.md         云之家×dsh 集成整体方案（v1.8 指针 → 会话家园；正文仍为 v1.7 人在闭环）
    group-room-topics.md               v2.0 产品法：1 群 = 1 群房间 + N 话题会话；工作台盖层；v1.17 R31 侧栏单入口 + 顶栏页签；R30 透镜产物卡；R29 job-done 投递；R27 盖层；R26 未登录入口
    dsh-home-session.md                DSH 唯一会话家园（v1.x 历史快照；D2/D3 被 group-room-topics 覆盖，D9 等仍有效）
    dsh-home-transcript.md             绑定会话可见时间线：插件消息日志（v1.x 历史快照；存储/去重/回填/切会话分阶段机制沿用，融合视图条款被覆盖）
    todo-design.md                     待办功能设计（v1.4，tag 理念 + §11.2 决策表；看板职责移交 ai-advance-design——待办回归轻量任务/事元角色）
    ai-advance-design.md               AI推进（**v1.7**）：①期双表/七态/第五页签；②期用户直写 feed +「现在反馈」；③期 inspect +「请 AI 验收」；§13 门控线；§14 主动发现 scan→inspect→feed；§15 意图线程订阅（含 dir: 目录级，决策 32）；§16 知识沉淀出口（cancelled 第七态 + 复盘/纪要模板）；§17 Dream 蓄水池（决策 33/34）；决策 1–34
    advance-review-template.md         复盘文档五段模板（§16.2：目标演化/关键决策/偏差与证据链/下一步/事元索引）
    meeting-minutes-template.md        金蝶标准四段式纪要模板（§16.1 ④-b：目标/内容/共识/下一步）
    robot-channel-plan.md              机器人通道调研与双向打通方案（v0.2：会话落点改打绑定对象）
    routines-delivery.md               定时任务引擎选型（dsh-routines 参考调研）+ yzj chatnode 投递契约
    memory-vault-design.md             记忆库组件设计（v0.2：vault 模型 + dream 开关/进程内固化/模型链 + 插件默认模型 + 群组留缝）
    memory-dream-routine.yaml          dream 固化 routine 模板（dsh-routines，备选路径）
    advance-patrol-routine.yaml        AI推进巡检 routine 模板（headless；主形态是 root schedule）
    headless-yzj.cordis.yml            headless overlay：只挂 bridge + tool-yzj（巡检用不了 ui-yzj）
  migration/                          ← 架构演进方案
    todo-backend-migration.md          待办 demo 后端 → 原生后端（四层架构 + §3 实测格式事实）
    advance-lingee-migration.md        AI推进 dsh MVP → 灵基终态（合同/机制/脚手架三层拆分 + 断层清单 + 验证清单；「存钱 vs 镀金」取舍原则）
  status/                             ← 实现与设计的对照与验收证据
    gap-analysis.md                    设计×实现 gap 对照（每功能提交留痕，含验收证据；§24.1–24.10 为 AI推进 ①–④期 + 门控 + 主动发现 + 真机实验 + Dream 蓄水池）
  diagrams/                           ← AI推进图集（archscribe：*-spec.json 为源，*.html 为交互产物；编号留空号不重排）
    advance-1-architecture             MVP 架构与环路（v1.7：蓄水池 + 七态 + dir 目录订阅入图）
    advance-3-gate                     增量感应门 × 门控线（打扰判据 vs 批写规则，不叠问）
    advance-5-target                   灵基终态映射（v1.7：Signal Pool + 七态 + dir 增量；组件对照以 migration/advance-lingee-migration.md 三层表为准）
    advance-6-journey                  用户旅程（@灵基 → 弹卡立项 → 意图线程订阅 → Dream 抽取 → 验收）
    advance-7-gaps                     待补能力六块（策略选择已随 ③.2 落地；余：拆解/会前材料/阻塞升级/跨推进依赖/指标读数）
                                       （汇报产物不留仓库：模块关系图/故事线图/架构蓝图/接口契约/故事线文字版已发 测试群，见 gap §24.5；合同唯一事实源 = ai-advance-design + migration）
  pitfalls/                           ← 实现级坑库（一坑一文件 + 索引）
```

## 阅读顺序（新 agent 接手）

1. **`README.md`（仓库根）**——三分钟了解包结构与能力面。
2. **`spec/integration-master-plan.md`**——系统全貌：目标、用户旅程、人在闭环验收基准（会话模型见下一份）。
3. **`spec/group-room-topics.md`**——**当前产品法（v2.0 / v1.19 工作台）**：1 群 = 1 群房间 + N 话题会话；两视图各一个发送动词；导航 = 侧栏脚一个「云之家」入口 + 工作台顶栏页签（对话 / 待办 / 日程 / 知识库 / 推进）+ 会话列表 + 右侧话题抽屉。对照 `status/gap-analysis.md` §23。v1.19 群房间 hover「喂给推进」见 [`ai-advance-design.md`](spec/ai-advance-design.md) §11。
4. **`spec/dsh-home-session.md`** / **`spec/dsh-home-transcript.md`**——v1.x 历史快照：会话对象、写路径 D9、消息日志存储/去重/回填/召唤窗口（机制沿用）；1:1 绑定与融合一条流已被 v2.0 覆盖（保留/作废对照见 group-room-topics §6）。
5. **`status/gap-analysis.md`**——当前实现状态与已验收证据（§15–§21 为既有面；§22 为 v1.8 实现快照；**§23 为 v2.0 目标 vs 现状**；**§24–§24.10 为 AI推进 ①–④期 + 门控线 + 主动发现 + 830 真数据实验 + Dream 蓄水池**）。
6. **`pitfalls/README.md` 索引**——动手前必查；命中相关条目先读再写代码。话题「发给助手」没近窗先读 pitfall-027；工作台盖中间栏先读 pitfall-028；每轮重贴 / 跨日倒序 / 文件没 fileId 先读 pitfall-029；日程永远停在某天第一次先读 pitfall-032；想把文件挂进回复链先读 pitfall-033（CLI `file` 不支持 `--reply-msg-id`）。对齐 harness rc.7 / 注册 `tool.call.toolview` / branded `SessionId` 先读 pitfall-034。空 web profile 真机点 dock 被内测声明挡住先读 pitfall-035。Full access 档位确认卡不弹先读 pitfall-036；验收脚本话题数据态先读 pitfall-037；CLI 输出形状/record list 信封先读 pitfall-003。
7. 任务相关的设计文档（todo 域 → `spec/todo-design.md`；**AI推进 → `spec/ai-advance-design.md`（v1.7：①双表/七态/第五页签，②用户直写 feed，③ inspect，§13 门控线，§14 主动发现，§15 意图线程，§16 沉淀出口，§17 蓄水池）**；机器人协议 → `spec/robot-channel-plan.md`（会话落点已被 dsh-home-session 覆盖）；定时任务 → `spec/routines-delivery.md`；记忆库 → `spec/memory-vault-design.md`）。
8. **插件开发 skill**（`.agents/skills/`）——`cordis-plugin-development` 按 cookbook 座位提炼成本仓契约；`editing-cordis-compositions` 仍是创造模式原文。本仓规矩在 `AGENTS.md`。索引见 [`.agents/skills/README.md`](../.agents/skills/README.md)。

## 命名规则

- 目录与文件名**英文 kebab-case**；正文中文（与全仓语言分工一致）。
- spec 文档带版本号与日期头；演进用「vN 变更」段落追加，不重写历史。
- `docs/` 根不再散放文档：新文档进对应子目录；新子目录须在本文件登记。
- **实验设计文档**：执行版实验设计放 `.acceptance/`（与验收脚本同目录，如 `advance-830-experiment.md`，已完工）；实验**证据**归档进 `status/gap-analysis.md`，不留散件。
