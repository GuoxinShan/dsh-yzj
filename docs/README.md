# dsh-yzj 文档目录（Spec-driven 索引）

> 本仓库由 agent 维护、面向 agent 消费（AGENTS.md「Spec-driven」）。`docs/` 是仓库主体：设计、决策、坑、验收证据都以此为准，代码是文档的执行形式。**任何 agent 接手，从本文件开始。**

## 目录结构

```
docs/
  README.md                          ← 本文件：索引与阅读顺序
  spec/                              ← 设计基线（要做什么、为什么、验收口径）
    integration-master-plan.md         云之家×dsh 集成整体方案（v1.7，验收基准）
    todo-design.md                     待办功能设计（v1.2，tag 理念 + §11.2 决策表）
    robot-channel-plan.md              机器人通道调研与双向打通方案（v0.1 调研稿）
    routines-delivery.md               定时任务引擎选型（dsh-routines 参考调研）+ yzj chatnode 投递契约
  migration/                          ← 架构演进方案
    todo-backend-migration.md          待办 demo 后端 → 原生后端（四层架构 + §3 实测格式事实）
  status/                             ← 实现与设计的对照与验收证据
    gap-analysis.md                    设计×实现 gap 对照（每功能提交留痕，含验收证据）
  pitfalls/                           ← 实现级坑库（一坑一文件 + 索引）
```

## 阅读顺序（新 agent 接手）

1. **`README.md`（仓库根）**——三分钟了解包结构与能力面。
2. **`spec/integration-master-plan.md`**——系统全貌：目标、用户旅程、验收基准。
3. **`status/gap-analysis.md` §15-§19**——当前实现状态与已验收证据（比设计文档更接近现实）。
4. **`pitfalls/README.md` 索引**——动手前必查；命中相关条目先读再写代码。
5. 任务相关的设计文档（todo 域 → `spec/todo-design.md`；机器人 → `spec/robot-channel-plan.md`）。

## 命名规则

- 目录与文件名**英文 kebab-case**；正文中文（与全仓语言分工一致）。
- spec 文档带版本号与日期头；演进用「vN 变更」段落追加，不重写历史。
- `docs/` 根不再散放文档：新文档进对应子目录；新子目录须在本文件登记。
