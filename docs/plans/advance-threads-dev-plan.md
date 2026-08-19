# ③.2 意图线程订阅 · 开发交接文档

> 日期：2026-08-19 ｜ 设计基线：[`../spec/ai-advance-design.md`](../spec/ai-advance-design.md) **v1.5 §15**（决策 20 / 21 / 23）｜ 缺口清单：[`../status/gap-analysis.md`](../status/gap-analysis.md) §24.5
> 执行：转交他人（agent 或人）。**动手前必读**：仓库根 `AGENTS.md` 全文、`docs/README.md` 阅读顺序、spec §15 全节、`docs/pitfalls/README.md` 索引（至少命中 pitfall-001 jsdom≠浏览器、pitfall-009 schema 字面量、pitfall-034 rc.7 对齐）。
> 本文是**实现计划**，不是设计——设计取舍已在 spec §15 拍板，实现中发现设计要改时**先改 spec 再改代码，同一提交**。
> **完工后处置**：验收全绿、gap 留痕后，删除本文件并在 README 移除登记行（计划文档不留档，实现事实以 spec + gap 为准）。

## 0. 目标与验收总表

实现 spec §15 的订阅模型。完工判定 = spec **§15.5 五条验收口径**逐条通过 + 下表工程项：

| # | 验收项 | 证据形式 |
|---|---|---|
| 1 | §15.5-1 立项后线程①可见；面板可关联/解除，落 user 记录 | 浏览器验收脚本 + 组件测试 |
| 2 | §15.5-2 同一群被两事项订阅：一次取流、各自分发、cursor 只前进一次 | tool-yzj 单测（fake CLI） |
| 3 | §15.5-3 单文档源关联即产一条事元；重复关联幂等 | 单测（复用 refs 同源去重） |
| 4 | §15.5-4 决策请求事元带 `选项N` 行时决策区渲染选项，选定落 user 事元 | 组件测试 + 浏览器验收 |
| 5 | §15.5-5 双表 schema / 六态 / 门控线 / 既有 E2E 全部回归绿 | 全量 `pnpm test`（当前基线 575） |
| 6 | 文档同提交：spec §15 标注已实现、gap 新增 §24.7、两个包 README 更新（RPC 端点数、参数） | diff 审查 |

## 1. 范围

**做**：
1. host storage-domain `yzj_advance_threads`（订阅注册表）；
2. `yzj_advance_create` 新增可选 `threads?: string[]`（立项自动挂线程①）；
3. 面板详情右栏「关联渠道」入口（线程清单 + 关联/解除，用户直写）；
4. `yzj_advance_scan` 的 `groups` 改为可选：缺省时从注册表聚合 open 事项的 `im:` 线程；digest 给出每事项订阅清单供模型分发；
5. 单文档源（`doc:`/`file:`/`todo:`/`event:`）关联即产一条事元；
6. 决策区渲染 `选项N` 行为可选项，选定经 judge 落 user 事元；
7. 教学面同步（`INSPECT_DISCIPLINE`、create/feed/scan description）。

**不做（本切片明确排除，别顺手做）**：
- agent 在 feed 里带 subscribe 意图（spec §15.2 提及但后置；若实现中发现必须做，先改 spec 分期）；
- 单文档源的「内容更新检测」（关联即一条事元就够，更新监测记 gap 待排）；
- Dream 每日 job 的落地（决策 21 的 Dream 节奏是 ④期配套，本切片只保证 scan 聚合订阅可被任何节奏调用）；
- 新的模型面 `yzj_advance_thread_*` 工具（订阅写路径只有 create 参数 + 面板直写两条）。

## 2. 数据与接口定义

**Token 语法**（spec §15.2，校验用字面量正则，别造新词）：`im:<groupId>` / `doc:<docId>` / `todo:<todoId>` / `event:<eventId>` / `file:<fileId>`。

**存储**（照抄 `packages/tool-yzj/src/scan-cursors.ts` 的 storage-domain 模式）：

```
unit: yzj_advance_threads (version 0)
tables.threads: {
  [advanceId]: Array<{
    token: string        // 上述语法
    kind: 'persistent' | 'document'   // im: 为 persistent，其余 document
    label: string        // 展示名（群名/文档名，写入时解析一次，不做活引用）
    addedBy: 'user' | 'agent'
    addedAt: number
  }>
}
```

**RPC（ui-yzj，+2 端点）**：
- `advance-thread-add { advanceId, token, label? }`：用户直写（D9，无确认卡）。host 校验 token 语法与事项存在；`document` 类同时追加一条事元（`来源类型` 按 token 类型映射，`changeType=备注`，`refs=[token]`——**refs 带 token 使重复关联天然被决策 19 的同源去重挡住**）；
- `advance-thread-remove { advanceId, token }`：解除订阅（只删注册表行，不动已产事元——时间线无损不变量）。
- 线程清单读取**折进 `advance-get` 响应**（加 `threads` 字段），不另开读端点。

**scan 聚合**：`groups` 缺省 → 注册表里所有 open 事项的 `im:` token 去重；超过 8 个渠道时报错并在 digest 提示分批（决策 17 上限保持刚性，不悄悄截断）。cursor 机制零改动（渠道级共享，决策 18/21）。

**决策区选项**（决策 23）：`advance-pane.tsx` 的 `decisionHtml` 在 decision-needed 时解析最新决策请求事元 `变化内容` 的 `选项N: …` 行（`影响: …` 行单独展示）；每个选项一个按钮，点击 = `advance-judge { action: 'confirm_advance', note: 选项全文 }`。无 `选项N` 行时维持现状两动词，**渲染缺陷不得影响既有确认推进/忽略**。

## 3. 工作分解（按依赖序）

| 步 | 改动面 | 文件 | 要点 |
|---|---|---|---|
| 1 | 订阅注册表 | `packages/tool-yzj/src/` 新建 `advance-threads.ts` | storage-domain 定义 + token 校验 + CRUD 原语；JSDoc 写契约（英文） |
| 2 | create 挂线程① | `packages/tool-yzj/src/advance.ts` | `threads` 参数（schema 字面量，pitfall-009）；guard `WRITE_SPECS` 不变（create 本就标准卡）；教学 description 写「在群话题里立项时带 threads=[im:<groupId>]」 |
| 3 | scan 聚合 | 同上 | `groups` 可选化 + 注册表聚合 + digest 每事项订阅行；保持首扫基线/过滤/去重原样 |
| 4 | 服务面 | `packages/tool-yzj/src/index.ts`（`ctx.yzjAdvance`） | 暴露 threadAdd/threadRemove/threadsOf 给 RPC 用 |
| 5 | RPC | `packages/ui-yzj/src/index.ts` | +2 端点；`advance-get` 响应加 `threads`；只过无损 JSON（仓库规矩） |
| 6 | 面板 | `packages/ui-yzj/src/client/advance-pane.tsx` + `advance-pane.module.css` | 信息来源栏顶部线程 chips（`data-testid="yzj-advance-threads"`）+「关联渠道」弹层（第一版只做群 picker——复用既有 groups RPC 列表 + 手输 token 兜底）+ chip × 解除；决策区选项按钮（`data-testid="yzj-advance-options"`） |
| 7 | 教学面 | `advance.ts` `INSPECT_DISCIPLINE` | 补一句订阅口径：「事项订阅了哪些线程见 digest 订阅行；分发按线程 + 语义相关」 |
| 8 | 测试 | `packages/tool-yzj/tests/advance.spec.ts`、`packages/ui-yzj/tests/rpc.node.spec.ts`、`advance-pane.client.spec.tsx` | 覆盖 §0 表 1–4；fake CLI 模式沿既有范式；真实 CLI 冒烟未登录自跳过 |
| 9 | 浏览器验收 | `.acceptance/` 新 `verify-advance-threads.mjs` | 走查：立项（带群）→ 详情见线程① → 关联一个 doc token → 时间线多一条备注事元 → 决策请求含选项 → 点选项 → 时间线出现 user 选择；未登录 SKIP exit 0；新鲜 profile 先关内测声明卡（pitfall-035） |
| 10 | 文档 | spec §15（标注实现落点）、gap §24.7、`packages/*/README.md`（工具参数、RPC 端点数） | 与代码同提交 |

## 4. 仓库规矩速查（违反任一条 = 返工）

- 构建链：改 host 面 `pnpm run build`；改 browser half（步 6）另跑 `pnpm run bundle`；**验收前必须重启 3080 GUI**（tmux `dsh-web`，勿杀 `--profile ops`）。
- 写路径：新增写口只有 RPC 直写（用户意志，无卡）与 create 参数（既有卡）；**不得**新增绕过 `WRITE_SPECS` 的 agent 写通道；面板直写照旧拒绝 `stageTo`/基准字段（决策 10）。
- 存储：dbt 双表 schema **零改动**（决策 20——订阅在 storage-domain，不动表）。
- 事元不变量：只增不改不删；解除订阅不删事元。
- schema 字面量结构、`yzjToolOutput` 复用、卡片是 keyed `tool.call.toolview`（本切片无新工具卡，线程变化不出新卡）。
- 语言分工：代码/JSDoc/包 README 英文；docs/ 中文。文件恰好一个换行结尾。
- 测试自跳过而非失败；jsdom 绿 ≠ 浏览器没问题（pitfall-001），步 9 必做。
- 提交：conventional commits（建议 `feat(advance): intent-thread subscriptions (spec §15 / ③.2)`），提交前全量 `pnpm test`；**是否提交与何时提交由 Guoxin Shan 决定**，默认改动留工作区。

## 5. 交回件

1. §0 验收总表逐项结果（含 `pnpm test` 总数对比基线 575）；
2. `verify-advance-threads.mjs` 输出 + 截图（`.acceptance/shots-advance-threads/`）；
3. gap §24.7 草稿（设计基线 / 交付表 / 证据 / 已知偏差四段，照 §24.4 版式）；
4. 实现与 spec §15 的任何偏差清单（应为空；不为空则每条附「已改 spec 哪一行」）。
