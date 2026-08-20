# pitfall-039：工作台 overlay 空 sessionId 撞 home-fused 空 payload 校验

> 记录日期：2026-08-20
> 影响区域：ui-yzj browser half（`room-shell.tsx` / `transcript.tsx` / `room-composer.tsx`）/ 推进板「跳到消息」与 Dream 抽取等切 im 域入口

## 现象

推进面板点「跳到消息」（或任何不带目标群的 `setWorkbenchDomain('im')` 入口），时间轴空态显示 host 报错：

```
home-fused endpoint requires a groupId or sessionId payload
```

且每 800ms 轮询反复触发。jsdom 组件测试全绿——overlay 用例的 `homeFused` mock 无条件返回成功，掩盖了真实 host 的 payload 校验。

## 复现条件

1. rc.7 工作台 overlay（R27）：`workbench-mount.tsx` 以空占位 `sessionId = ''` 挂 `YzjRoomShell`。
2. 用户没坐过任何群（im seat 空）→ `activeGroupId` 为空。
3. 任何入口裸切 im 域（推进「跳到消息」多/零 im 来源分支、Dream 抽取按钮等）。
4. `YzjFusedView` / room-shell binding fallback / composer speakers 轮询发出 `homeFused('', undefined)` → rpc 投影为 `{ sessionId: '' }` → host `stringField` 把空串当缺失（`value !== ''` 才收）→ 双字段皆缺 → 报错。

## 根因

两叠加：(a) overlay 的空占位 sessionId 是 R27 新引入的，而 `home-fused` 的客户端调用链（binding fallback / fused 轮询 / speakers 轮询）为 slot 模式设计，默认 sessionId 非空；(b) host 端 `stringField` 将空串视为缺失，空占位 payload 必然撞校验。另有一个连带缺陷：`requestImGroupFocus`（推进跳转直达群的总线）只有旧侧栏 panel 消费，工作台 overlay 的 `room-shell` 没订阅——即使「恰一 im 来源」分支也 retarget 不了 overlay 时间轴。

## 解法

三层短路 + 一条订阅（全部在 client 面，host 校验保持原样）：

- `room-shell.tsx` binding fallback 仅在 `sessionId.startsWith('yzj-home-')`（slot 模式）时发起；overlay 不发。
- `transcript.tsx` `YzjFusedView`：`viewKey === ''`（无 sessionId 且无 groupId）时 load effect 直接 return，不轮询不 setError；空态文案显示「在左侧选择一个群开始。」。
- `room-composer.tsx` speakers 轮询：`sessionId === '' && groupId === ''` 时跳过。
- `room-shell.tsx` 订阅 `subscribeImGroupFocus`：推进跳转直达群时 `setActiveGroupId` + `rememberImSeat`，overlay 时间轴即时 retarget。

## 回归覆盖

`packages/ui-yzj/tests/room-shell.client.spec.tsx` 两用例：overlay 无 seat 断言 `homeFused` **零调用** + 空态文案；`requestImGroupFocus('g-focus')` 断言以 groupId 调用、seat 落定、目标群消息渲染。真机走查 `.acceptance/verify-advance-jump.mjs`（无 seat 空态无报错 → 群列表点选开房 → 推进详情 msg 来源跳转直达 im 域群房间 → 零 page error）。教训同 pitfall-001：mock 成功 ≠ host 会成功，涉及 RPC payload 的组件测试要 mock 校验语义而不是恒成功。
