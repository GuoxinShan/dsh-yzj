# pitfall-030：话题 `agents.create` 不挂 preset → 只有 yzj 工具、读不了本地文件

## 现象

从群房间「交给助手」长出的 `yzj-topic-*` 会话里，模型只有 `yzj_im_*` / `yzj_doc_*` / `memory_*` / `robot_*`，没有 bash、读文件、`str_replace_editor`。它会自称「这是云之家预设，不是梁神模式」，让用户去新建梁神会话才能读 md。

## 复现条件

1. 工作台点一条群消息「交给助手」，抽屉或官方 Chat 问「读一下工作区里的 xx.md」。
2. 模型回答没有读文件工具。导出 session 的 request/header 工具表只有 host 注册的 yzj 族。

## 根因

`openTopicHome` / `askTopicAssistant` / robot `ensureAgent` 走 `ctx.agents.create({ sessionId, meta: { cwd }, agentOptions })`，**不传 `meta.agentPreset`、不 `agentPresets.mount`**。

`agents.create` 的 scoped world 是裸的（pitfall-007）：GUI「新建会话」靠 apiproxy `composeAgent(defaultId)` 才把 `standard`（bash、文件工具、jobs…）挂上。host `cordis.patch.yml` 上的 `tool-yzj` / `memory-yzj` 是进程级工具，裸 session 也能看见，于是表面看起来像「我们造了一个只有云之家工具的 preset」。其实没有这样的 preset——是漏挂了官方默认 preset。

梁神（`dsh-liangshen`）是用户根下的另一份 preset，话题不该、也不会自动用它。

## 解法

与 GUI 新建会话同一条缝：

```ts
const presets = ctx.get('agentPresets')
const id = (await presets.resolve(presets.defaultId)).id // 出厂 standard
await agents.create({
  sessionId,
  meta: { cwd, agentPreset: id },
  agentOptions: route,
  setup: (agentCtx) => presets.mount(agentCtx, id),
})
```

resume 同样要 `setup` 再 mount（scoped world 每次重建）。**不要**为 yzj 另写一份 `agent.cordis.yml`。yzj 工具留在 host patch，任何 preset 都能用。

存量裸话题：停 GUI 再开，resume 会挂上默认 preset。

## 回归覆盖

- `packages/ui-yzj/tests/home-open.spec.ts`：`topicAgentComposition` 解析 defaultId；`openTopicHome` create 带上 `meta.agentPreset` 与 `setup`。
- 真机：新话题问「你有哪些工具」应同时出现 bash/读文件与 `yzj_im_*`。
