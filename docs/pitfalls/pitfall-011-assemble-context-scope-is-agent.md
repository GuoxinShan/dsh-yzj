# pitfall-011：`systemPrompt.context` 的 assemble.scope 是 Agent 对象，不是 session id

## 现象

DSH「发给助手」的召唤窗口（`systemPrompt.context` `yzj-bound-window`）在绑定会话里始终为空：模型看不到近窗群消息。云之家 `@机器人` 路径正常（那条走 `agent.inject`，不经过 assemble）。

## 复现条件

在 `systemPrompt.context({ text: (assemble) => ... })` 里把 `assemble.scope` 当成 session id 字符串用：`String(assemble.scope)`、`assemble.scope.startsWith('yzj-home-')`，或拿 `agent.ctx === assemble.scope` 去 `ctx.agents` 里对。harness 真实组装走 `assembleContextFor(agent)`。

## 根因

`@deepseek-ai/dsh-scope` 的 `ScopeKey` 是 `object`。agent 包把组装上下文写成：

```ts
return { agent, scope: agent, ...signal }
```

因此 `assemble.scope` **就是 Agent**，`assemble.agent` 也是同一个 Agent。`String(agent)` 得到 `"[object Object]"`，永远对不上 `yzj-home-*`。`agent.ctx` 是作用域 Context，也不等于 `scope`。

## 解法

读 `assemble.agent.session.id`（缺省再读 `assemble.scope.session.id`）。最新 user/message 也从同一 `session.events` 取，不要再 `ctx.agents.get(sessionId)` 绕一圈。仓外插件不要为了点名类型去 import `dsh-agent`——结构类型即可。见 `sessionIdFromAssemble`。

## 回归覆盖

`packages/tool-yzj/tests/home.spec.ts`：`sessionIdFromAssemble({ agent, scope: agent })` 得到 `yzj-home-*`；把 scope 当成字符串则 `undefined`。
