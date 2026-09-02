# pitfall-031：近窗不要进 runtime snapshot，单独 plugin inject 一次

## 现象

话题首轮的 `Current runtime context` 里，`# 记忆库` 后面紧贴整群 20 条 IM。用户觉得记忆、群上下文、话题糊在一起。

## 根因

`systemPrompt.context` 可以注册多个 name，但 harness `joinContextSections` **强制拼成一条** `plugin=@deepseek-ai/dsh-system-prompt form=snapshot`。`source.sections` 是分开的，模型看见的正文不是。

`agent.inject({ source: { kind: 'plugin', plugin } })` 才是轨迹里单独的一条 user/message。

## 解法

- 记忆留在 snapshot（会变、要 supersede）。
- 近窗第一次问助手时 `inject` 或 `agent/pre-step` 预置一条 `yzj-summon-window`；`sessionHasSummonWindow` 之后不再贴。
- 从 `systemPrompt.context` 拿掉 `yzj-bound-window`。
- 话题窗 = `threadEntries(rootMsgId)`（沿 replyMsgId 向上 + 子孙），不是群 last-20。

不要把记忆也改成 inject（旧记忆会堆在历史上）。不要每轮 inject 近窗。

## 回归覆盖

- `home.spec.ts`：`summonWindowText` 恒空；pre-step 只种一次。
- `bound-log.spec.ts`：回复链不含无关群消息。
- `bound-io.spec.ts`：抽屉问助手 inject 一条窗口。
