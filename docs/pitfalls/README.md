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

## 维护规则

1. **一条坑一个文件**：`pitfall-NNN-<slug>.md`，NNN 递增；索引表同步更新。
2. 记录必须包含：最小复现条件（什么环境/序列才触发）、根因（到代码行为层面，不写猜测）、解法（为什么这个解法而非别的）、回归验证方式（哪个测试/验收脚本覆盖）。
3. 坑的解法变更时更新条目而非删掉；条目过时（对应代码已删）标注「已失效」并保留历史。
