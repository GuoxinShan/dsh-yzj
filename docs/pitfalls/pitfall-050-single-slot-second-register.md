# pitfall-050: 单占槽二次 register 会抛错，IM 不能真占 `conversation` / `sidebar.workspaces`

## 复现条件（Reproduction）

harness rc.7：`sidebar.workspaces` 与 layout `conversation` 都是 `{ kind: 'single' }`。ui-workspace / ui-conversation 已经各占一座。插件再 `slots.inject` → `register` 同一名字，SlotCore 抛 `already has a registration`，inject 把失败丢进 microtask，整面 client 插件卸载。

## 根因（Root cause）

单占槽只有一个 registrant。`slots.inject` 只是等声明出现后调用 callback，不会替掉已有 occupant。list（`conversation.view`）和 chain（`conversation.composer`）才允许多登记。

## 解法（Fix）

- 收件箱：门户进 `[data-slot="sidebar.workspaces"]`，**仅** `html[data-dsh-yzj-im]` 下 CSS 藏文件夹树（排除 `data-yzj-surface-switch` / `data-yzj-surface-root`）；不 `register` 该单占座。设置座不动。
- 中间 IM：占 list 槽 `conversation.view`（id `yzj-im`，label 助手），消息态自动点该 tab，CSS 藏宿主 tablist / details / New Session。会话态卸 occupancy 属性并点宿主 Chat（I16）。
- 官方输入条：`conversation.composer` chain 仍登记并画 `null`，但 **rc.7 `overlay:true` 不会卸 fallback InputBar**；alpha.3 甚至没有 `[data-composer-seat]`。真正隐藏见 pitfall-052（CSS + `watchHostChrome`）。会话态必须卸 `data-dsh-yzj-im`，否则 CSS 继续藏官方条。
- 不要占 layout `conversation` 或 `details`。
- 文件夹树隐藏**不得**写成未加 occupancy 前缀的 `[data-slot=sidebar.workspaces] > :not([data-yzj-inbox-host])`——那会在「会话」里继续盖住 workspaces。

## 回归覆盖（Regression coverage）

`packages/ui-yzj/tests/inbox-mount.client.spec.tsx`；`im-nav.client.spec.tsx`；`im-shell.tsx` / `inbox-mount.tsx`；gap §25 occupancy 行。
