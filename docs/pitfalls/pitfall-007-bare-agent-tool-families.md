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

## 解法（Fix — 已退役，2026-08-16 R2.7）

该路线已废弃：定时任务改由**外部独立插件 dsh-routines**（专用 `ops` daemon
profile）+ 自研 `ctx.chatnode` 投递实现（`docs/spec/routines-delivery.md`，
提交 `640f205` 后全链路实测通过）。`robot-yzj` 里的会话内 schedule 挂载
（`attachScheduleTools`/ScheduleRuntime/registerScheduleTools、flush 屏障监听）
已随清理提交移除；`!routines` 空态文案指向 `dsh routines list`。

保留本条目作为历史记录：程序化创建的 agent 拿不到 harness 会话内工具族的事实
依然成立（scoped 注册对非 root agent 不可见），只是本仓库不再走这条路。

## 回归覆盖（Regression coverage）

Live-only for now: the group round-trip (schedule_create → !routines lists
the reminder → fire pushes into the group). A unit seam will follow the fix
(fake agents exposing a tools registry face).
