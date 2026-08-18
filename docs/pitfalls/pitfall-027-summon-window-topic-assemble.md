# pitfall-027：话题「发给助手」召唤窗口没挂上，模型不知道在问哪条群消息

## 现象

群房间点「交给助手」再问助手（抽屉或官方 Chat），模型看不到近窗群消息：不知道 groupId、锚点 msgId、刚才那条说了啥。解码话题 session 的 runtime snapshot，context 只有 `sandbox:policy` / `approval:policy`，没有 `yzj-bound-window`，正文也没有 `［本群最近消息］`。云之家 `@机器人` 路径正常（那条走 `agent.inject`）。

## 复现条件

1. 工作台打开群房间，hover 一条消息点「交给助手」。
2. 抽屉「问助手」或「原生会话 ↗」后在官方 Chat 发送。
3. 看该 `yzj-topic-*` 的 `session.jsonl`：`request/header` 的 runtime context 列表，或模型回复是否在猜群。

## 根因

三件事叠在一起，单测绿（`formatSummonWindow` 本身有窗）但真机空：

1. **查错表。** T5 曾只 `home.getBySession(sessionId)`。那张表是群房间 `yzj-home-*`。话题 id 查不到 → `conversationId` 空 → 窗口 `''`。空文本的 context 不会进 runtime snapshot，看起来像「没注册」。
2. **skip 过窄。** 正文曾写「仅 `latestUserSourceKind === 'user'`」。首轮 assemble 时 user/message 可能还没进 `session.events`（`none`），窗口被丢掉。plugin 才该跳（机器人 / handoff 已经 `inject` 过）。
3. **注册层。** `systemPrompt.context()` 写在调用 Context 的 ScopedLayers 上。插件 fiber 上 `ctx.get('systemPrompt').context()` 对 `assemble(scope=agent)` 不可见。必须跟 `sandbox:policy` 一样：`ctx.inject(['systemPrompt'], (scope) => scope.systemPrompt.context({ name: 'yzj-bound-window', ... }))`。

抽屉「问助手」旧实现只 `followup`、不 `inject`。官方 Chat 靠 T5；T5 空则两条路都没窗。

## 解法

- `summonWindowText`：`getBySession` ?? `getTopicBySession`；`latestUserSourceKind === 'plugin'` 才返回 `''`；`none` / `user` 都 `formatSummonWindow(conversationId, undefined, sessionId)`（话题带锚点）。
- 注册走 inject-scope mixin（上条）。
- 抽屉 `askTopicAssistant`：非空窗口先 `inject(pluginTurn(window))` 再 `followup(userTurn)`——透镜仍藏 plugin 行；即使 T5 再漏一次，历史里也有近窗。
- 开话题（`home-topic-open`）**不** inject、不启轮。窗跟第一次提问走，避免空会话里先堆一块可见气泡。

不要另写一套窗口文案。不要把窗口当用户气泡 chip。

## 回归覆盖

- `packages/tool-yzj/tests/home.spec.ts`：`summonWindowText` 对话题 id 出窗；plugin 跳过；`none` 仍出窗。
- `packages/ui-yzj/tests/bound-io.spec.ts`：`askTopicAssistant` 先 inject 再 followup，inject 正文含 `本群最近消息` / `groupId`。
- 真机：`.acceptance/verify-summon-window.mjs`（需运行中 GUI）。新话题问一句，日志含 `本群最近消息` / `groupId`；T5 成功时还有 `yzj-bound-window`。
