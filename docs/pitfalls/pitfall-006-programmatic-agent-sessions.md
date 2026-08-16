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

## 解法（Fix）

In the router's `ensureAgent`:

```ts
const handle = await this.agents
  .resume({ resumeSessionId: sessionId, ...(agentOptions ?? {}) })
  .catch(() => this.agents.create({ sessionId, meta: { cwd: process.cwd() }, ...(agentOptions ?? {}) }))
```

Resume-first with create fallback covers restart continuity; `meta.cwd` on
create keeps the session out of `_no-cwd`. A stale broken session dir (e.g.
one already persisted without cwd) must be deleted once — resume cannot
repair the header.

## 回归覆盖（Regression coverage）

`tests/router.spec.ts`: 'prefers resume over create for a persisted DM
session' asserts the resume→create order. The cwd half is environmental
(needs the real session store); the E2E round (DM message → ack →
deepseek-v4-flash turn → quoted answer pushed back, 2026-08-16 10:25) is the
recorded evidence in docs/status/gap-analysis.md §20.
