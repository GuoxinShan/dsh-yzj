# Pitfall 013 — 切群/切会话闪「私密会话」或上一群消息

> 记录日期：2026-08-17 ｜ 关联提交：融合视图 + 面板 `openGroup` 分阶段
> 影响区域：`packages/ui-yzj/src/client/transcript.tsx`（群工作）、`panel.tsx`（悬浮窗会话 tab）

## 现象

在悬浮窗或 DSH 里随便点一个群 / 单聊，画面闪一下再出现正确内容。常见两种闪法：

1. **群工作 tab** 先出现「这是私密会话」，过几百毫秒才变成时间线。
2. **面板右栏** 标题已经是新群名，消息还是上一群的，或整块被全局「加载中…」盖住再刷出来。

jsdom 里如果测试只 `await Promise.resolve()` 一次、且 fused 同步返回，往往绿——真机上 `home-backfill` 要走 CLI，空窗足够长，人能看见闪。

## 复现条件

1. 已绑定至少一个群；DSH 开着「群工作」，或悬浮窗开着会话 tab 且当前已有消息窗。
2. 点另一个群（cache miss 最明显；融合视图只要该 session 还没有模块级 `fusedCache`）。
3. `home-backfill` / `im message list` 尚未返回。

## 根因

1. 融合视图用 `{ bound: false, items: [] }` 做初始 state，并且 **`bound === false` 立刻渲染未绑定文案**。`bound: false` 的语义被用成了「已确认未绑定」，其实只是「还没问过 host」。回填是慢路径（先 CLI 再 fused），整段期间都在闪私密会话。
2. `useState` 的初始值只在挂载时读 cache。harness 复用同一 `YzjFusedView` 实例只改 `sessionId` 时，**第一帧仍是上一会话的 rows**（effect 还没跑）。
3. 面板 `openGroup` cache miss 时立刻 `setGroupId`（标题换了）但 **不清空 `messages`**，同时 `setLoading(true)` 打出面板顶栏全局 loading。缓存命中路径是对的（立刻换窗、不打全局 loading）；miss 路径缺阶段。

## 解法

与面板会话 tab 已经做对的阶段对齐，两边都走完：

| 阶段 | 面板 `openGroup` | 群工作 `YzjFusedView` |
|---|---|---|
| 1 | header 立刻换 | session 身份立刻换 |
| 2 | `getMessageWindow` 命中则立刻画 | 模块级 `fusedCache` 命中则**同步**画（按 `sessionId` 派生，不等 effect） |
| 3 | miss：先清空上一群行，只在右栏「加载中…」，不打全局 loading | miss：空窗「加载群消息…」；**confirmed unbound 之前不画「私密会话」** |
| 4 | `fetchMessages` 回来再画 | 先本地 `home-fused`，再 `home-backfill` 后重画 |
| 5 | `resolveSenders` + `MessageBody`（表情/图/文件/引用/lightbox） | 同一套 `im-render.tsx`；日志可选 `param` 才能画出媒体 |

发送人禁止「群消息」占位（空名 → 通讯录 → openId 尾号 →「未知」）。慢请求用 generation / `cancelled` 丢掉，避免 A 的响应写进 B。

**v2.0 工作台增补（2026-08-18）**：`conversation.view` 随 sessionId 重挂时，中栏 `YzjConvList` 也会卸掉——`recent`/`bound` 必须有模块级缓存，否则点任何会话左侧先空再刷。时间线 `.stream` 默认 `scrollTop=0`，人看见的是窗口里**最早**的那页，必须跟面板一样打开滚到底（最新）；「加载更早」才保位置。图走 `file-data` 内存缓存，首帧从 cache 同步出，禁止每次「加载中…」。H9 迁「历史对话」须 `quiet`，禁止 `lastActivity=now` 把群行顶到最上。

## 回归覆盖

- `packages/ui-yzj/tests/transcript.client.spec.tsx`：延迟 fused 首帧是「加载群消息」不是「私密会话」；切 sessionId 首帧不得残留上一群；`[握手]`→🤝；`displayNameOf` 不用「群消息」。
- `packages/ui-yzj/tests/panel-switch.client.spec.tsx`：点新群立刻清空上一群正文，只出右栏 `yzj-chat-loading`，没有全局 `yzj-panel-loading`。
- `packages/tool-yzj/tests/bound-log.spec.ts`：CLI `param` 写入条目；无 param 的旧行仍可投影。
- `packages/robot-yzj/tests/router.spec.ts`：入站回复把 `msgParam` 写入 log `param`。
- `packages/ui-yzj/tests/panel-hooks.client.spec.tsx`：`messagesFetching` / `openGenRef` 插在现有 hooks 块末尾（pitfall-001：不要在函数体中部插入 hook）。
- `packages/ui-yzj/tests/conv-list.client.spec.tsx`：重挂后 fetch 未返回时左栏仍有 hold 行。
- `packages/ui-yzj/tests/transcript.client.spec.tsx`：`streamAtBottom` 跟底判定。
- `packages/ui-yzj/tests/im-cache.client.spec.ts` / `im-render.client.spec.tsx`：`peekFileData` 命中后 `ProxyImage` 首帧出图、无「加载中…」。
- `packages/tool-yzj/tests/topics.spec.ts`：`quiet` ensure 不 bump `lastActivity`。
