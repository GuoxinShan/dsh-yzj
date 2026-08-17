# 踩坑记录（Pitfalls）

> 目录名用英文（`docs/pitfalls/`）、文件名 `pitfall-NNN-<slug>.md`（slug 英文）；条目正文中文。本仓库积累的实现级坑与解法。每条记录：现象 → 根因 → 解法 → 验证方式。**动手前先扫一遍本目录**，避免重踩；解决新坑后必须回写一条。
>
> 面向两类读者：人类协作者，以及 coding agent（AGENTS.md「踩坑记录制度」要求 agent 查引并维护本目录）。

## 索引

| # | 坑 | 影响区域 | 条目 |
|---|---|---|---|
| 1 | React #310：浏览器崩溃但 jsdom 复现不了 | ui-yzj browser half / 任何面板 hooks | [pitfall-001-react-310-hooks.md](pitfall-001-react-310-hooks.md) |
| 2 | 持久化 store 整体替换：旧 blob 缺字段 → undefined 崩溃 | stores.ts / store schema 演进 | [pitfall-002-store-rehydration.md](pitfall-002-store-rehydration.md) |
| 3 | CLI 输出的三重形态：裸数组 / data 信封 / fields JSON 字符串 | bridge / 任何解析 CLI 输出的代码 | [pitfall-003-cli-output-shapes.md](pitfall-003-cli-output-shapes.md) |
| 4 | 大载荷被默认输出上限截断成不可解析 JSON | bridge maxOutputChars / doc-blocks 类端点 | [pitfall-004-output-cap-truncation.md](pitfall-004-output-cap-truncation.md) |
| 5 | 函数插件模块必须模块级 `export const inject`——Service 类的 `static inject` 不被 loader 读取 | 任何 host 包经 dsh profile 加载 | [pitfall-005-module-inject-for-loader-entries.md](pitfall-005-module-inject-for-loader-entries.md) |
| 6 | agent 轮次静默无回答的两大来源：session id 碰撞须 resume 不能 create；`_no-cwd` session 过不了 persona 模板 | robot-yzj router / 任何程序化创建 DSH agent 的通道 | [pitfall-006-programmatic-agent-sessions.md](pitfall-006-programmatic-agent-sessions.md) |
| 7 | 程序化创建的 agent 是裸作用域：harness 工具族（schedule）不会自动挂载，需复刻 schedule 插件的注册路径 | robot-yzj routines / 任何给自建 agent 加 harness 工具的场景 | [pitfall-007-bare-agent-tool-families.md](pitfall-007-bare-agent-tool-families.md) |
| 8 | packed zstd 会话日志骗过一次性解压：只解出首帧 → "只有 header" → 误判持久化失效 | 任何直接读 `session.jsonl.zstd` 的脚本 / 诊断 | [pitfall-008-packed-zstd-session-logs.md](pitfall-008-packed-zstd-session-logs.md) |
| 9 | defineTool 的 output.schema 宽化成 `object` 报误导性执行体类型错；数组 of object 参数不存在——走 JSON 字符串（todo `records` 先例） | 任何新增 dsh-tools 工具包 | [pitfall-009-definetool-schema-literals-and-json-array-params.md](pitfall-009-definetool-schema-literals-and-json-array-params.md) |
| 9 | profile 装 bundle 三连坑：autoInstallPeers=false 致 peers 不解析；link 包传递依赖 EPERM；`every Nm` 首次触发依赖 lastRunAt 播种；SPA fallback 2xx 假阳性 | ops daemon / dsh-routines / chatnode 桥 | [pitfall-009-profile-peers-and-routines-seeding.md](pitfall-009-profile-peers-and-routines-seeding.md) |
| 10 | 客户端 bundle 注册 id 必须等于 loader 条目（profile 行名），不是包名；单测/构建全绿但 web 壳启动报 loaded without registering | ui-yzj browser half / 任何经 monobundle 子路径行名加载的 client bundle | [pitfall-010-loader-entry-id.md](pitfall-010-loader-entry-id.md) |
| 11 | `systemPrompt.context` 的 assemble.scope 是 Agent 对象，不是 session id 字符串 | tool-yzj 召唤窗口 / 任何仓外 `systemPrompt.context` 按会话分流 | [pitfall-011-assemble-context-scope-is-agent.md](pitfall-011-assemble-context-scope-is-agent.md) |
| 12 | `yzj-robot-*` 前缀闸在家园 id 改打后不再覆盖绑定会话 | robot_notify / robot_continue / 任何按旧前缀分流的写闸 | [pitfall-012-home-prefix-gate-misses-yzj-home.md](pitfall-012-home-prefix-gate-misses-yzj-home.md) |
| 13 | 群房间宿主无 `turn/start`：侧栏藏成「新会话」，可被新建会话复用 | ui-yzj home-open / 任何不跑模型回合的程序化 session | [pitfall-013-blank-host-sessions-hidden.md](pitfall-013-blank-host-sessions-hidden.md) |
| 14 | 发进群 `local-*` 锚了话题后 ack 成真实 msgId，回群房间对不上 | tool-yzj topics / 交给助手幂等 | [pitfall-014-local-id-topic-anchor.md](pitfall-014-local-id-topic-anchor.md) |
| 15 | 只跑 `pnpm run bundle` 打包的是旧代码——client bundle 入口是 tsc 产物 `lib/types`，改 TS 后须先 `tsc -b`/`pnpm run build` | ui-yzj browser half / 改源→bundle→验收 循环 | [pitfall-015-bundle-needs-tsc-first.md](pitfall-015-bundle-needs-tsc-first.md) |
| 16 | 悬浮球（fixed 右下）盖住群房间「发进群」按钮：jsdom 全绿、真机点不到；composer 右留白与悬浮球绑定，不可当 hack 删 | ui-yzj 群房间 composer / 视口右下布局 | [pitfall-016-float-ball-covers-send.md](pitfall-016-float-ball-covers-send.md) |

## 维护规则

1. **一条坑一个文件**：`pitfall-NNN-<slug>.md`，NNN 递增；索引表同步更新。
2. 记录必须包含：最小复现条件（什么环境/序列才触发）、根因（到代码行为层面，不写猜测）、解法（为什么这个解法而非别的）、回归验证方式（哪个测试/验收脚本覆盖）。
3. 坑的解法变更时更新条目而非删掉；条目过时（对应代码已删）标注「已失效」并保留历史。
