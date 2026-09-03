# pitfall-050: 单占槽二次 register 会抛错，IM 不能真占 `conversation` / `sidebar.workspaces`

## 复现条件（Reproduction）

harness rc.7：`sidebar.workspaces` 与 layout `conversation` 都是 `{ kind: 'single' }`。ui-workspace / ui-conversation 已经各占一座。插件再 `slots.inject` → `register` 同一名字，SlotCore 抛 `already has a registration`，inject 把失败丢进 microtask，整面 client 插件卸载。

## 根因（Root cause）

单占槽只有一个 registrant。`slots.inject` 只是等声明出现后调用 callback，不会替掉已有 occupant。list（`conversation.view`）和 chain（`conversation.composer`）才允许多登记。

## 解法（Fix）

- 收件箱：门户进 `[data-slot="sidebar.workspaces"]`，CSS 藏文件夹树；不 `register` 该单占座。设置座不动。
- 中间 IM：占 list 槽 `conversation.view`（id `yzj-im`，label 助手），自动点该 tab，CSS 藏 tablist / details / New Session。
- 官方输入条：`conversation.composer` chain takeover 画 `null`。
- 不要占 layout `conversation` 或 `details`。

## 回归覆盖（Regression coverage）

`packages/ui-yzj/tests/inbox-mount.client.spec.tsx`；`im-shell.tsx` / `inbox-mount.tsx`；gap §25 occupancy 行。
