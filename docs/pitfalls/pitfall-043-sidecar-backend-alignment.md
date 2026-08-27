# pitfall-043: sidecar 验收脚本必须对齐双后端（setAdvanceBackend/setTodoBackend）

> **已失效（2026-08-27）**：待办/推进双后端已从公开仓撤出。

## 现象

sidecar 驱动脚本（advance-loop-driver 模式：裸 `Context` + `YzjBridge` + core 函数直调）feed 一条事元，报「推进看板尚未开通（依赖待办任务库）」；或更隐蔽地——feed **成功返回 ok**，但 GUI 面板上看不到任何事元变化，反复重试像是在写一个幽灵库。

## 根因

决策 36（v1.8）把推进双表切到本地 SQLite，但**默认后端仍是 dbt**：`advanceBackend`/`todoBackend` 模块级变量默认 `'dbt'`，只有插件入口（tool-yzj/src/index.ts）在真机挂载时调 `setAdvanceBackend('sqlite')` + `setTodoBackend('sqlite')`。sidecar 脚本不走插件入口，裸 `new Context()` 后两个后端都停在 dbt——写路径打到云多维表格（库不存在则报「尚未开通」），与真机 SQLite 完全无交集。dbt 路径不报错时更危险：写成功但读不到。

## 解法

sidecar 脚本 mount 时**第一行就对齐后端**（与真机一致）：

```ts
import { setAdvanceBackend } from '../packages/tool-yzj/src/advance.ts'
import { setTodoBackend } from '../packages/tool-yzj/src/todo.ts'
setAdvanceBackend('sqlite')
setTodoBackend('sqlite')
```

判断后端错位的最快信号：feed 报「尚未开通」或面板与 sidecar 各说各话——先 `~/.dsh/storages/yzj_advance.db` 直读核对（`.acceptance/advance-dsh2-driver.ts` 的 `entries` verb 即此用途）。

## 回归覆盖

`.acceptance/advance-dsh2-driver.ts`（mount 内即对齐，注释标明决策 36）；dsh-2 闭环演习全程真机走查（gap §24.28）。
