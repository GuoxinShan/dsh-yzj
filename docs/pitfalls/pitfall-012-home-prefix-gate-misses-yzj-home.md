# pitfall-012：`yzj-robot-*` 前缀闸在家园 id 改打后不再覆盖绑定会话

## 现象

绑定家园（`yzj-home-*`）上的 agent 可以调用 `robot_notify` / `robot_continue`，以机器人身份把消息推到云之家群，**不经过确认卡**。D9（agent 提议发群必须确认）被绕过。用户从 DSH「发进群」/ 面板 `im-send` / `home-send` 仍正确无卡。

## 复现条件

1. 入站已改打 `yzj-home-*`（`router.ts` `resolveSession` / `ctx.yzjHome`）。
2. 在该绑定会话里让模型调用 `robot_notify` 或 `robot_continue`。
3. `operatorOnly` 只判断 `sessionId.startsWith('yzj-robot-')`；这两项工具故意不在 `WRITE_SPECS`（§8.2 操作者自有通道）。

旧前缀闸在 id 改打后永远不命中家园会话，execute 直接 `RobotSender.send` / 入站管线推群。

## 根因

自驱禁令写在 **session id 前缀** 上，而不是「这条会话是不是正在对群说话」。产品家园从 `yzj-robot-*` 换成 `yzj-home-*` 后，前缀闸与 D9 同时失效：工具仍按「操作者控制台、不过确认」实现。

## 解法

不要把家园会话直接 `operatorOnly` 拒绝（确认后还应能推）。把 `robot_notify` / `robot_continue` 折进既有确认链：

- `WRITE_SPECS` + `whenSession`：`yzj-home-*`（及缺失 session id）ask；未绑定操作者控制台不过闸；残留 `yzj-robot-*` 仍不 ask，execute 时 `operatorOnly` 抛错。
- write-gate 认领这两项（不再只认 `yzj_*`）；GUI 聚焦的绑定会话走 GUI 卡，入站 plugin 轮次仍由 ConfirmBroker 群建议卡接。
- 面板 RPC / chatnode 继续调服务方法，不经工具闸（用户意志 / 调度投递）。

后续凡是「按 `yzj-robot-*` 前缀分流」的逻辑，先问：绑定家园是不是同一条语义。残留 skip 可以留，但不能当唯一闸。

## 回归覆盖

- `packages/tool-yzj/tests/guard.spec.ts`：绑定家园 ask；未绑定 / `yzj-robot-*` 不过闸；缺 session id fail-closed ask。
- `packages/ui-yzj/tests/write-gate.spec.ts`：GUI 聚焦家园认领 `robot_notify`；残留 `yzj-robot-*` 仍 skip。
- `packages/robot-yzj/tests/confirm.spec.ts`：入站家园 `robot_notify` 走群建议卡。
- `packages/robot-yzj/tests/control.spec.ts`：execute 时 `yzj-robot-*` 仍拒绝，`yzj-home-*` 放行。
