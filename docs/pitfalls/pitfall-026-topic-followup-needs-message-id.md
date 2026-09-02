# 坑 026：话题 followup 不带 message.id → 历史永久装不上

## 复现条件

1. 群房间点「交给助手」，抽屉里「问助手」发一句（例如「这是在说啥」）。
2. 打开该 `yzj-topic-*` 的官方 Chat。
3. `历史加载失败：session event at seq N lacks an identified message`；再问一次 `resume failed` 同一错误。

本机证据：`yzj-topic-gid-test-msg-signal` seq 7 是

`user/message { role, content, source }`，没有 `id`。同一次提问的 turn/end 还记着 `{{model}}` 装配失败（pitfall-006）。

## 根因

官方 composer 走 `createUserMessage`，会赋 `id`。抽屉「问助手」走 `askTopicAssistant` → `followup(userTurn(text))`，旧 `userTurn` / `pluginTurn` 为了不 import `dsh-llm`（ui-yzj 双面 tsconfig）只拼了 role/content/source。

`followup` 原样落盘。resume 校验 `user/message` / `assistant/message` / `tool/result` 必须有非空 `message.id`（harness `assertMessageEventShape`）。缺 id 的日志无法修，只能删 session 目录。

## 解法

`identifiedUserMessage` 用 `crypto.randomUUID()` 补 id，不引进 `dsh-llm`。所有 host 侧 `followup` / `inject` 用户消息走它。已写坏的话题：停 GUI 后删该 session 目录（pitfall-021），下次按同一 id create 空壳。

## 回归覆盖

- `packages/ui-yzj/tests/bound-io.spec.ts`：`askTopicAssistant` 的 followup 带非空 `id`。
- `packages/ui-yzj/tests/home-open.spec.ts`：`identifiedUserMessage` 有 id。
