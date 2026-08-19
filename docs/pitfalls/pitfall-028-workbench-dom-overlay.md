# pitfall-028: 工作台盖中间栏必须摸产品 DOM（官方无槽）

## 复现条件（Reproduction）

R27 要把云之家工作台做成「开面板不造 session」。官方侧栏上方没有 list 槽，中间栏也没有 cover 槽。`conversation.view` 挂在当前 session 上，没有挂钩就画面板。

## 根因（Root cause）

`ui-sidebar` 只声明 `sidebar.workspaces`（单占）/ `sidebar.settings`（单占）/ `sidebar.footer.action`（脚）。logo + 「新建会话」是壳自己的按钮。`conversation` 整栏也是单占。webuiall task-board 用同一套选择器私挂。

## 解法（Fix）

显式例外（R27）：入口插在 `button[class*="newSession"]` 后；盖层挂在 `[data-pane="conversation"], [class*="centerCol"]`；用 `html[data-dsh-yzj-active]` 藏底下 Chat；`dsh-panel-activate` 与 task-board / ssh 互斥。外壳改 class 时只改这一处选择器。

## 回归覆盖（Regression coverage）

`packages/ui-yzj/tests/workbench-overlay.spec.ts`、`group-space.client.spec.tsx`（开面板不 focus）、`room-shell.client.spec.tsx`（overlay 无 hanger）。
