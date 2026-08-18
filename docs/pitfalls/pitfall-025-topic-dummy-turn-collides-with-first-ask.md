# 坑 025：话题套房间空 turn 1，第一次提问再开 turn 1 → 历史加载失败

## 复现条件

1. 群房间时间线 hover 一条消息，点「交给助手」。
2. 系统 `ensureTopic` + `agents.create` 一条 `yzj-topic-*`，并 `publishHostSession`（房间那套：已关闭空 `turn/start {turn:1}` + `turn/end completed` + `session/title`）。
3. 在抽屉「问助手」或官方 Chat 里发第一条（例如「这群里在说啥呢」）。
4. 打开该话题的官方 Chat：`历史加载失败：conversation Context 10:turn-error1 received more than one start Match（internal）`。

本机证据：`yzj-topic-gid-test-msg-signal` 日志里 `turn/start {turn:1}` 出现两次；第二次后面才是真 user/message。

## 根因

官方 conversation 装配器里 `turn-error` 把每个 `turn/start` 当成 `role: 'start'`，id = turn 号。同一 turn 号两个 start 直接抛。

房间需要空 turn（R14 / pitfall-014）：房间永不跑模型，没有 ③④，不写空 turn 就会 blank 复用。话题是真 agent session，第一次提问 harness **再开一轮 turn 1**（不读已关闭空回合去 +1）。把房间揭开术套到话题上，等于预先占用 turn 1。

交给助手本身不 followup，只建话题 + 开抽屉；空 turn 是 `openTopicHome` → `publishHostSession` 写的。

## 解法

`publishHostSession(..., seedEmptyTurn)`：房间默认 `true`；`openTopicHome` 传 `false`，话题只钉 `session/title`。揭开靠第一次真提问。新话题在第一次提问前可能短暂 blank（侧栏暂不列出），好过历史永久装不上。

已写坏的话题日志不能在 GUI 开着时改（pitfall-021）。删掉该 session 目录后，下次打开会按同一 sessionId create 空壳（不再写空 turn）。

## 回归覆盖

- `packages/ui-yzj/tests/home-open.spec.ts`：`openTopicHome` 的话题事件只有 `session/title`，没有 `turn/start`；房间仍是 `turn/start` + `turn/end` + `session/title`。
