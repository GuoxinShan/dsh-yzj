# pitfall-007: robot agents are bare scopes — harness tool families (schedule) must be attached explicitly; naive attachScheduleTools misses

## 复现条件（Reproduction）

A channel plugin creates DSH agents programmatically
(`agents.create({sessionId, meta})` + resume-first). The group asks the robot
to set a scheduled reminder ("schedule_create 一个 13:05 的提醒"). The agent's
turn answers that `schedule_create` is **not in its tool list** and proposes
`yzj_calendar_event_create` as a substitute. `!routines` (folding the session
log for `schedule/change` events) reports none.

## 根因（Root cause）

`agents.create` builds a bare scoped world: whatever the host's web-app layer
mounts for GUI sessions (schedule tools registered per-agent by the schedule
plugin's own runtime sweep) never runs for externally-created agents. The
agent's tool surface is only what registers into `agent.ctx.tools` — the yzj
family arrives via the host-level tools registry; the schedule family is
registered per-agent by `registerScheduleTools(rootCtx, toolCtx, agent, cb)`
and needs a live `Agent` plus a tools-service-bearing context. Two naive
attempts failed live: registering inside `create({setup})` has no live agent
yet; calling `registerScheduleTools(rootCtx, agent.ctx, ...)` after
publication did not surface the tools (the tools service is not part of the
bare agent scope's graph — `agent.ctx.inject(['tools'])` never resolves, or
the registration context is not the tool-registry context the agent's
requests consult).

## 解法（Fix — 部分落地，2026-08-16 R2.6）

The verified mechanism mirrors the schedule plugin's root-agent mount: after
publication, `registerScheduleTools(rootCtx, agent.ctx, agent, cb)` +
`ScheduleRuntime` + the idle-drive listener, all inside `agent.ctx.effect`.
That landed in `router.ts::attachScheduleTools` and the runtime pieces work
(flush barrier ok=true at tool time, jsonl coordinator persists robot sessions
in real time, cursor advances).

**Still open (live-confirmed)**: the schedule tools do NOT surface in the
assembled tool list of freshly created robot agents (`schedule_create` →
`unknown tool`; the yzj tools ARE visible because they register on the host
registry). Adding `setup: agentCtx => agentCtx.inject(['tools'], ...)` to
create/resume (per the original next-step) did NOT change this — scoped
registrations on the programmatic agent's context still do not reach the
assembly this harness version consults. Remaining candidate directions:
register the schedule tools on the HOST registry for robot-owned session ids
(visible to every agent — needs an agent-id guard inside the tool bodies), or
find the assembly path programmatic agents actually consult.

## 回归覆盖（Regression coverage）

Live-only for now: the group round-trip (schedule_create → !routines lists
the reminder → fire pushes into the group). A unit seam will follow the fix
(fake agents exposing a tools registry face).
