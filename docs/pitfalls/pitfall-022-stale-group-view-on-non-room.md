# 坑 022：话题 / 普通会话残留「群聊」view，整页错画成 IM

## 复现条件

1. 打开任意非 `yzj-home-*` session（`yzj-topic-*`、未绑定私聊、普通编码会话）。
2. 该 session 的 harness `ChatStoreState.view` 曾被写成 `yzj-home`——点过 header「群聊」tab，或从群房间切走时 view-ring 只藏 tab、没点「对话」。
3. 再打开这条 session：主面是群聊三栏（会话列表 + 空时间线 / 「还没有对话。」），不是官方 Chat。

jsdom 里「tab.hidden === true」全绿，因为旧测试只断言藏 tab，不断言选中了「对话」。真机 GUI 按持久化 view id 挂组件。

## 根因

`conversation.view` id `yzj-home` 是 list 槽，**没有** per-session `select`（和 `conversation.composer` 不同）。每个 session 的 tab ring 都有「群聊」。harness `resolveActiveView`：

```
requestedId = selectedId ?? 'chat'
tabs.find(id === requestedId) ?? tabs.find(id === 'chat')
```

`selectedId === 'yzj-home'` 时直接挂 `YzjRoomShell`，与当前 session 是不是房间无关。v1.4 的 `syncYzjViewRing('topic'|'unbound')` 只 `hidden` 群聊 tab，**不**点「对话」，所以磁盘上的 view 永不回落。壳组件也不看 session id 前缀。`homeBinding.kind` / `bound: true` 还能把普通 session 提升成 room，再点一次「群聊」。

## 解法

三层闸，口径跟 composer 的 `yzj-home-*` 前缀一致（R22）：

1. **view-ring**：话题 / 未绑定点「对话」（写入 `view=chat`），再藏「群聊」tab。kind **只跟** `yzj-home-` / `yzj-topic-` 前缀，binding 不得提升。
2. **YzjRoomShell**：非 `yzj-home-*` 直接 `return null`，即使 view 仍是 `yzj-home` 也不画三栏。
3. **YzjFusedView**：只有 `kind === 'room' && bound` 才进 IM 时间线；话题 snapshot 不画群流。

不在 list 槽上伪造 `select`——`views.list()` 不读 select，加了也不摘 tab。

## 回归覆盖

- `packages/ui-yzj/tests/view-ring.spec.ts`：群聊已选中时 `syncYzjViewRing('topic'|'unbound')` 必须点「对话」。
- `packages/ui-yzj/tests/room-shell.client.spec.tsx`：`yzj-topic-*` / 普通 id 不挂 `yzj-room-shell`。
- `packages/ui-yzj/tests/transcript.client.spec.tsx`：`kind: 'topic'` 不画 IM 行。
