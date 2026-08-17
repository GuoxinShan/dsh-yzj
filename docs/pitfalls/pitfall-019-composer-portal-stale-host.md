# pitfall-019：发进群 portal 钉在已卸载的宿主节点上

> 影响区域：ui-yzj `room-composer.tsx` / `transcript.tsx` / 工作台域切换

## 复现条件

同一 `yzj-home-*` 群房间：工作台「对话 → 待办 → 对话」。切去待办时时间线（含 `#yzj-room-composer-host`）随 `YzjFusedView` 卸载；切回对话后时间线列里发送条消失。官方 composer 仍被 takeover 藏着，页面上看不到「发进群」。

## 根因

`YzjRoomComposer` 挂在 `conversation.composer`（会话级，不随工作台域卸载）。可见面 `createPortal` 进时间线列的宿主。旧实现 `useComposerHost` 用 `document.getElementById` 找到一次就把 MutationObserver 拆掉，之后不再核对 `isConnected`。切走对话域时宿主变 detached，`host !== null` 仍 portal 到旧节点；切回来新宿主挂上，hook 仍握旧节点。

## 解法

抽 `composer-host.ts` 注册/订阅总线：时间线 `ref` 注册/卸载宿主，composer 订阅当前 connected 节点。禁止 `getElementById` + 整页 observer 缓存 DOM 节点。宿主为 null 或已 detached 时，face 回落到 composer seat（工作台非对话域）；新宿主注册后再 portal 进时间线列。

## 回归覆盖

`packages/ui-yzj/tests/composer-host.spec.ts`：卸载再注册，订阅方跟到新节点。`packages/ui-yzj/tests/transcript.client.spec.tsx`：`YzjFusedView` unmount/remount 后总线交出新宿主。
