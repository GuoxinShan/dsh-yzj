---
name: cordis-plugin-development
description: >-
  Extend this dsh-yzj TypeScript plugin bundle — Host vs Client, slots,
  inject, effects, lossless RPC, tool cards, settings.section. Use when
  adding or changing a package, slot, tool card, or /yzj RPC. Not the
  in-session cordis_define / inspect / run loop.
---

# 在本仓库扩插件

本仓是 TypeScript 六包 + `cordis.patch.yml` profile patch，不是会话内 `cordis_define`。
常驻规则只在 [AGENTS.md](../../../AGENTS.md)。本文只写那里没写细的 harness 契约。

不要走创造模式循环：`cordis_inspect_*` / `cordis_define` / `cordis_run` /
`cordis_stop` / `cordis_undefine`。改 `packages/*`，按 AGENTS.md Commands
构建并重启 web GUI。

契约提炼自 harness `99f6f02fec` 创造模式 skill 与 `docs/cookbook/`。
完整原文在兄弟仓，不要在本仓再抄一份。

## 先选面

| 需求 | 面 | 本仓落点 |
|---|---|---|
| 文件、子进程、网络 | Host | `packages/bridge` argv spawn；禁止 bash 直调 `yzj-cli` 写命令 |
| Agent / 会话 / 生命周期 | Host | 对应包的 `apply`；房间不是 DSH chat（R20/R24） |
| 模型可调工具 | Host | `packages/tool-yzj` + `WRITE_SPECS`（AGENTS.md） |
| 主题、布局、页内状态 | Client | `packages/ui-yzj/src/client` 槽位 |
| 设置、侧栏、输入区、工具卡 | Client | 先看 `src/client/index.ts` 已注册的槽，不要新开 root/sidebar/conversation |
| Host 取数、Client 展示 | 两面 | Host `/yzj` 叶子 JSON；Client 槽位渲染 |

靠近数据所有者。Slot props 里已有的不要再打一轮 RPC。只改自己的组件样式时不要动全局 theme。只要一个入口时不要换掉整块产品 UI。

## Cookbook 座位（不要抄错槽）

兄弟仓 `docs/cookbook/`。本仓真实座位：

| 要做的 | Cookbook | 本仓 |
|---|---|---|
| 模型工具 | `adding-a-tool.md` | `defineTool` + `yzjToolOutput`；策略在 `WRITE_SPECS`（`tools/pre-execute` ask）。卡是 keyed `tool.call.toolview`（`cards.tsx` / `write-card.tsx`），不是 `presentCall`/`presentResult` |
| 设置卡 | `adding-a-settings-card.md` | **不要用** `settings.plugin.item` + `installSettingsSection`。云之家是 `settings.section` id `yzj`，持久化走 `/yzj` RPC |
| Chat 业务节点 | `adding-a-conversation-node.md` | 确认卡也在 `tool.call.toolview`，不是 `ConversationNodeDefinition` |
| 新 `@deepseek-ai/dsh-*` 包 | `adding-a-package.md` | **不要照做**。本仓是独立 bundle |

`execute` 契约见 AGENTS.md「工具 execute 契约」。

## 注册

- 默认 `ctx.get(name)`，缺了就返回。`inject: ['x']` 只用于硬依赖；未声明禁止 `ctx.x`。
- 每个贡献必须可卸：`ctx.on`、`ctx.effect`（返回 disposer）、官方 API 的 disposer。不要在模块顶层挂进程/页面副作用。
- 定时器是名为 `timer` 的 Service，不是 Builtin；用 `ctx.timeout` / `ctx.interval` 前必须 `inject: ['timer']`。不要 `setTimeout`。
- Waterfall 事件最后一个参数是 `next`，不中断就必须调用并返回它。

## Client 槽

先读本仓已有 `slots.inject` / `slots.register`，对上 `name`、协议（single/list/keyed/chain）、`id`/`key`。不要猜。不要默认替换 `root` / `sidebar` / `conversation` / `details` 整槽——会拆掉子槽。

```ts
ctx.slots.inject('target.slot', () => ctx.slots.register(
  { name: 'target.slot', id: 'yzj-…' },
  Component,
))
```

- 完整设置页：`settings.section`（本仓「云之家」已占 `id: 'yzj'`）。`settings.general.item` 只给一条总设置。
- 工具结果卡：`tool.call.toolview`，key = 工具名。新工具同提交登记 `YZJ_TOOL_NAMES`；写工具再登记 `YZJ_WRITE_TOOL_NAMES`。
- 小入口用内槽（如 `conversation.input.dock`），不要换整栏。
- 样式用 `--dsw-*`。不要操作 `document.body` / 产品 DOM 选择器。

Client 半包是 TS/JSX，走 `tsc -b` + `pnpm run bundle`（pitfall-016）。创造模式那套「禁止 import/JSX、必须 `React.createElement`」只约束 `cordis_define` 的纯 JS 包，不约束本仓。

## RPC 与活对象

`/yzj` 两向只过无损 JSON。不要 `JSON.stringify` / `structuredClone` Context、Session、Service、Slot props 或其子孙。先取叶子字段，再构造自有对象。

创造模式的 `harness.handle` + `host.call` 是同一条规矩；本仓的通道是 `/yzj`，不是再注册一套 Package-private handle。
