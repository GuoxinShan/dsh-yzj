# 待办后端迁移说明（demo 载体 → 原生待办后端）

> 版本：v1.1 ｜ 日期：2026-08-15（v1.0）；2026-08-24（v1.1）
> v1.1 变更：真机后端已切本地 SQLite（v1.8 决策 36/37；云多维表格 record 服务间歇 500 弃用，dbt 仅剩测试 double）；原生后端候选锁定云之家 worktask（[`../spec/openapi-dependency.md`](../spec/openapi-dependency.md) §2.3：activate 重开 / 回调 2001-2009 / executors 原生成员引用）；tag 聚合终态已拍板放弃（todo-design §11.2 决策 9）。§1–§3 的 dbt 细节保留为历史快照与测试语义。
> 配套实现：`packages/tool-yzj/src/todo.ts`（工具族 + `ctx.yzjTodo` 服务）、`packages/ui-yzj/src/client/todo-pane.tsx`（面板待办 tab）
> 一句话：后端只是存储，可换。全部业务不变量（稳定 ID、状态机、幂等、追加日志、#tag 聚合）都收在 host 侧的 todo 核心层；真机默认后端 = 本地 SQLite（v1.8 决策 37），多维表格 dbt 仅剩测试 double；切原生后端时**换适配器不换工具面**。

## 1. 架构分层（当前）

```
模型面（不变）      yzj_todo_list / create / update / complete   ← 4 个工具，参数即未来 API 契约
                    ↑ 经 tools 注册表 + 确认卡门禁（guard 标准确认）
──────────────────────────────────────────────────────────────
todo 核心（不变）   coreCreate / coreSetStatus / fetchTodos / resolveLibrary
                    · todo_id 生成与幂等（T-YYYYMMDD-NNN，创建前查重）
                    · 状态机校验（pending→in_progress→done，done→in_progress 重开）
                    · 推进日志 host 追加（模型不可改写历史）
                    · #tag 归一化（#a #b 存储，按 tag 聚合/过滤）
                    · 逾期判定（host 本地 YYYY/MM/DD 字符串比较）
                    ↑ 同一核心
服务面（不变）      ctx.yzjTodo（state / ensure / create / toggle）
                    ↑ /yzj RPC：todo-state / todo-ensure / todo-create / todo-toggle
──────────────────────────────────────────────────────────────
浏览器面（不变）    待办 tab（分桶/标签聚合/快捷新建/勾选完成/拖 chip）、确认卡 todo 域、工具卡 todo 族
                    ↑ 用户直写原则：面板勾选/新建即用户本人意志，不经确认卡
──────────────────────────────────────────────────────────────
存储适配层（可换）  SqliteTodoStore ← 真机默认（v1.8 决策 37：本地 SQLite，node:sqlite）
                    SheetTodoStore ← 多维表格「待办任务库」（v1.8 起仅剩测试 double；
                    字段映射见 §2；CLI 格式适配见 §3）
```

工具、核心、服务、浏览器四层都只依赖 **YzjTodo 视图模型**（`todoId/title/status/assignee/ddl/priority/tags/log/overdue`），不依赖任何 sheet 概念——这正是迁移缝。

## 2. 数据模型映射

| 视图模型（不变） | 多维表格字段（demo） | 原生后端（未来） |
|---|---|---|
| `todoId` | `todo_id`（MultiLineText，host 生成） | 原生稳定 ID（服务端生成，格式不变 `T-YYYYMMDD-NNN` 可继续兼容） |
| `title` | `标题`（MultiLineText） | title |
| `status` | `状态`（SingleSelect，选项预注册 pending/in_progress/done） | 状态机（建议服务端也校验同一条流转表） |
| `assignee` / `assigneeOpenId` | `负责人`（MultiLineText，`姓名(openId)`；CLI Contact 写入不可用——实测 500） | 原生 Contact/成员引用（demo 的降级即卡点证据） |
| `ddl` | `DDL`（Date，值形态 `YYYY/MM/DD` 字符串） | native date |
| `priority` | `优先级`（SingleSelect P0/P1/P2） | enum |
| `tags` | `标签`（MultiLineText，`#tag` tokens；CLI MultipleSelect 动态新值被静默丢弃——实测） | **原生 tag 模型**（tag 是核心理念：tag 可以是一个待办集、一个群组、一个项目，任何维度自由聚合） |
| `log` | `推进日志`（MultiLineText，host 追加 `时间 动作` 行） | append-only 事件流（建议原生直接给变更历史 API） |
| —（未用） | `来源`（Url，预留给 deep link） | source/deep link |

**迁移时的数据搬迁**：按 `todo_id` 逐条映射；`标签` 字符串按空白切分还原 tags 数组；`负责人` 按 `姓名(openId)` 正则拆分。总量 demo 级（百条内），一次性脚本即可，无需双写。

## 3. 已实测的 CLI 格式事实（demo 适配层吸收，2026-08-15 探针）

1. record create/update 的 `--records` 必须是**数组** `[{"fieldsValue":{…}}]`（对象形态 400）；
2. list/create/update 返回的 `records[].fields` 是 **JSON 字符串**（需 parse；已同步修复 `yzj_sheet_record_list` digest）；
3. Date 值 `YYYY/MM/DD` 字符串，写入读取同形态；
4. SingleSelect 选项必须在 table create 时用 `data.items` 预注册，运行期写未注册值**静默丢弃**（存 `""`）；
5. MultipleSelect 同样不收新值 → tag 降级为文本 tokens；
6. Contact 写入（object/数组/裸 openId 全试）→ 服务端 500；
7. `sheet create` 返回 `openWebUrl`（任务库 deep link 来源）；每个新 dbt 自动带一张空「数据表」（table 1，任务表是其后的新表）；
8. filter JSON 按 `{"mode":"AND","criteria":[{field,operator,values}]}` 工作，tag 的 Contains 语义可用；
9. `doc workspace list --type personal` 的**首项不一定是「我的知识」**（本机首项为 AI速记知识库）——库发现必须扫描全部个人知识库，否则会重复开通第二个任务库（第二轮浏览器 E2E 实测抓到并修复）。

每一条都是**待办正式 API 的需求输入**：稳定 ID、状态机服务端校验、成员引用、动态标签、变更历史、deep link。

## 4. 迁移步骤（原生 API 就绪后）

1. 新建 `NativeTodoStore`（实现与 SheetTodoStore 相同的 5 个原语：`resolve / fetchAll / fetchById / writeCreate / writeStatusUpdate`——都在 `todo.ts` 的存储适配层里，约 200 行）；
2. `todo.ts` 配置加 `backend: 'sheet' | 'native'`，工厂切换；工具/服务/UI 三面零改动；
3. 一次性搬迁脚本（§2 映射）；
4. mention 协议 `kind: 'todo'` 芯片与 codec 回源不变（回源走 `todo-state`，天然后端无关）；
5. 删除 sheet 适配层与 `todoLibrary` 配置项。

## 5. 期间累积的 API 需求清单（随用随记）

- [ ] 记录级 deep link（现状：只有任务库级 `openWebUrl`）
- [ ] 批量状态流转 / 批量改期（现在逐条 update，确认卡逐条弹）
- [ ] 按 DDL 排序 / 按标签聚合的服务端视图（现在 host 本地排序过滤，demo 量级够用）
- [ ] 变更 webhook（催办/播报的触发源升级）——**2026-08-24 修正**：官方 im-todo 仍无；但时间助手域（cloudwork newwork/worktask/meeting）有完整回调机制（callBackUrl，method 1001-3010），见 [`../spec/openapi-dependency.md`](../spec/openapi-dependency.md) §2.2/§2.3
- [ ] 负责人被分配时的站内/IM 通知（催办现在靠 agent 发消息 + 确认卡）
- [ ] 循环待办（recurring）
- [ ] 逾期判定服务端化（现在客户端/host 时区本地比较）
- [ ] Contact 字段 CLI 可写（或原生成员引用）
- [ ] 「列出我创建的/分给我的」服务端过滤（现在全量拉取后 host 过滤，demo 量级够用）
