# pitfall-006: programmatic DSH agents — resume before create, and never let a session land in `_no-cwd`

## 复现条件（Reproduction）

A channel plugin (robot-yzj) drives DSH agents programmatically: it derives a
stable session id from an external conversation key, then creates an agent on
first inbound message and reuses `ctx.agents.get(id)` afterwards. Two failures
surfaced live during the 2026-08-16 E2E round on the personal-robot DM:

1. Host restart (the old instance was killed mid-session) → next inbound
   message called `agents.create({sessionId})` →
   `Error: session "yzj-robot-…" already has a persisted log on disk that does
   not match this live session (id collision)`.
2. After fixing (1) by deleting the stale dir and creating fresh with no
   `meta.cwd` → the session landed under `~/.dsh/sessions/_no-cwd/` → every
   turn failed prompt assembly with
   `Error: prompt variable "{{cwd}}" has no value for this assembly (section
   "deployment:persona")`.
3. 话题抽屉「问助手」经 `ctx.agents.create({ sessionId, meta: { cwd } })` 拉起
   `yzj-topic-*`，不传 `agentOptions.model` →
   `prompt variable "{{model}}" has no value for this assembly (section
   "deployment:persona")`。Web 侧栏新建的会话没事：它们走 apiproxy，
   `installModelSelection` 会用 `agentDefaultModel` 填变量。Host 直调
   `agents.create` 不会经过那一层。

Symptom shape: the channel acks ("收到，处理中…") and then nothing or a
failure push arrives — the ack path works while the agent turn dies.

## 根因（Root cause）

- (1) `agents.create` is strictly for fresh sessions; a persisted log under
  the same id is a hard collision. Cross-restart continuity requires
  `agents.resume({resumeSessionId})` — resume does NOT accept `meta`; the
  header comes from disk.
- (2) the `cwd` prompt variable is registered by agent-loop as
  `context.agent?.session.header.cwd`. A session created without `meta.cwd`
  has `header.cwd === undefined`, and the base persona section references
  `{{cwd}}` unconditionally → assembly throws before any LLM call.
- (3) `{{model}}` / `{{provider}}` 读 `context.agent?.options.model`。不传
  `agentOptions` 时 options.model 为空。官方 Chat 靠 apiproxy 的
  `defaultModelSelection()` 补；插件 create/resume 必须自己带上
  `yzjModels.get()` 或 `ctx.agentDefaultModel.currentSelection()`。

## 解法（Fix）

In the router's `ensureAgent`:

```ts
const handle = await this.agents
  .resume({ resumeSessionId: sessionId, ...(agentOptions ?? {}) })
  .catch(() => this.agents.create({ sessionId, meta: { cwd: process.cwd() }, ...(agentOptions ?? {}) }))
```

Resume-first with create fallback covers restart continuity; `meta.cwd` on
create keeps the session out of `_no-cwd`. Topic / robot create 还要带
`agentOptions: { provider, model }`（`topicAgentRoute`：yzjModels 否则
agentDefaultModel），否则 `{{model}}` 同样炸。`agentsFace` 转发 create/resume
时必须原样带上 `agentOptions`，丢掉等于没传。A stale broken session dir
must be deleted once — resume cannot repair the header.

## 回归覆盖（Regression coverage）

`tests/router.spec.ts`: 'prefers resume over create for a persisted DM
session' asserts the resume→create order. The cwd half is environmental
(needs the real session store); the E2E round (DM message → ack →
deepseek-v4-flash turn → quoted answer pushed back, 2026-08-16 10:25) is the
recorded evidence in docs/status/gap-analysis.md §20.
