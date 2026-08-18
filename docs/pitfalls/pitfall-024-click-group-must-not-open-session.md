# 坑 024：工作台点群走 homeOpen+focus → 卡、未分组增生、官方 composer 闪

## 复现条件

1. 侧栏脚「对话」打开工作台（已挂在某条 `yzj-home-*` 上）。
2. 随便点会话列里另一个群。
3. 要等一会儿才出时间线；官方侧栏「未分组」多一行（群名）；中间闪一下官方超长 InputBar。

## 根因

`conversation.view` / `conversation.composer` 是 session 作用域。旧实现把「点一个群」做成 `homeOpen`（ensureBound + agents.resume/create + `publishHostSession`）再 `sessions.open`。于是：

- 热路径等 CLI / 建 agent / 等 session 列表出现（`focusBoundSession` 最多 8s）。
- `publishHostSession` 写了 `turn/start`，房间从 blank 变成可见；R20 又不 attach「云之家」，所以掉进「未分组」。
- focus 换 session 会卸掉房间 composer takeover，官方 InputBar 先画出来再被下一轮 takeover 藏住 → 超长 composer 闪一下。

`ensureBound` 只写绑定表，**不会**让侧栏出现一行。侧栏行来自活 agent + publish。

## 解法

点群 = 切 `groupId`（R24）。时间线 / 发进群 / 回填走 `home-fused` / `home-send` / `home-backfill` 的 groupId。挂钩座位不换，所以不卡、不增生、不闪。首次进对话域仍 focus/建一条挂钩（harness 主面是 session 画布）；之后切群零 session 切换。

点群切 `groupId` 之后，`YzjFusedView` 必须把 groupId 传进 `homeFused`。`conversation.view` inject 若写成 `(id) => homeFused(id)` 会丢掉第二参，RPC 仍按挂钩 session 拉旧群，看起来像「点了没换」。inject 必须是 `(id, groupId) => homeFused(id, groupId)`。

切 `groupId` 的 cache-miss 不得把时间线提前 `return` 成只有「加载群消息…」的空 div。那会卸掉 `#yzj-room-composer-host`，发进群 portal 失去目标，官方 `data-composer-seat` 收起被解开，闪出「给智能体发消息」。loading / unbound 空态必须仍走 `roomMain` 列并挂宿主。

存量 `yzj-home-*` 已 publish 的房间不会自己从「未分组」消失。要清：停 GUI 后删 session 目录，并从 `session_projcache` 去掉对应 id。绑定表与消息日志保留。

## 回归覆盖

- `packages/ui-yzj/tests/conv-list.client.spec.tsx`：click 调 `onSelectGroup`，不调 `homeOpen`。
- `packages/ui-yzj/tests/transcript.client.spec.tsx`：cache-miss 首帧和切 groupId 都保留 `yzj-room-composer-host`（同一节点）。
- 真机：点另一群立刻换时间线；未分组行数不增；无官方 InputBar 闪。
