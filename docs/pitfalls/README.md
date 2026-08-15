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

## 维护规则

1. **一条坑一个文件**：`pitfall-NNN-<slug>.md`，NNN 递增；索引表同步更新。
2. 记录必须包含：最小复现条件（什么环境/序列才触发）、根因（到代码行为层面，不写猜测）、解法（为什么这个解法而非别的）、回归验证方式（哪个测试/验收脚本覆盖）。
3. 坑的解法变更时更新条目而非删掉；条目过时（对应代码已删）标注「已失效」并保留历史。
