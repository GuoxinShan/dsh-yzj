# @dsh-yzj/robot-yzj

Yunzhijia robot channel, host half: the measured two-way bridge between a
personal (or group) Yunzhijia robot and DSH agent sessions.

**Product law (binding + fused timeline landed):** inbound `followup()` lands on the
**bound DSH session** for that Yunzhijia conversation (`ctx.yzjHome`,
`docs/spec/dsh-home-session.md`). Session ids are `yzj-home-*`. Inbound also
appends ① to the shared bound log; 云之家 @机器人 injects `formatSummonWindow` then
followup. GUI-focused bound sessions keep the GUI confirm card; inbound
plugin turns stay on the group suggestion-card path. `!fork` /
`robot_fork` open or resume that bound session and must not `create` a
`fork-*` / `yzj-robot-*` parallel root. Remaining gaps (confirm-card pending
as a session event, group search) are in gap-analysis §22 G3/G5.

## What it does

- **Inbound** — derives `wss://<host>/xuntong/websocket?yzjtoken=…` from the
  robot's `sendMsgUrl`, keeps the outbound-originating long connection alive
  (30s `{cmd:"ping"}` heartbeat, stale detection, capped exponential
  reconnect), and classifies every frame by the measured protocol
  (`directPush/robotMessage` messages, `msgChg` changes, `auth`/`pong`
  controls). No public callback is needed.
- **Routing** — one bound DSH session per Yunzhijia conversation (group or
  DM) via `ctx.yzjHome` (`yzj-home-<slug>`). Reply-chain ids stay transcript
  relations, not new roots. MsgId dedupe, per-session mute, and the
  standalone bang commands `!help / !status / !routines / !memory / !mute /
  !unmute / !restart / !configure` plus `!fork <群名|群ID> <指令>` (open or
  resume the target group's bound session and inject a bounded summary) and
  `!feedback <文本>` (local log + receipt).
- **ack-then-push** — the HTTP contract's 3-second budget cannot fit an LLM
  turn, so inbound turns are acked immediately (the ack text is the
  "is thinking…" surface) and the assistant's answer — every
  `assistant/message` text block above the per-session watermark — is pushed
  back with a reply anchor once the agent goes idle.
- **Outbound** — `POST sendMsgUrl` with the measured envelope (`msgtype:2`,
  `param/paramType:3` reply cards, `notifyParams` targeting), response-msgId
  extraction, chunking under the measured ~5000-char ceiling, and a
  conservative serialized rate limiter.
- **Policy** — `allowFrom` defaults to the CLI login user's openId (resolved
  once through the bridge); everyone else gets a denial and no session.
- **Bidirectional controls** — the operator can drive robot channels from any
  DSH session: `robot_status` (channels, cwd, surfaces, sessions),
  `robot_notify` (proactive push), `robot_continue` (inject an operator turn
  through the full inbound pipeline), and `robot_fork` (open or resume the
  bound home for that conversation — not a new root). On a bound `yzj-home-*`
  session, `robot_notify` / `robot_continue` enter WRITE_SPECS (D9 confirm
  card / group suggestion card). The unbound operator console and panel RPC
  stay card-less. Leftover `yzj-robot-*` sessions still refuse at execute.
  See `src/control.ts` and docs/spec/robot-channel-plan.md §8 / §9.
- **Group workspaces** — one working directory per bound group
  (`<cwd>/groups/<groupId>/`) plus one shared directory per group
  (`<cwd>/groups/<groupId>/shared/`). `robot_share_write` is the ONLY write
  channel into the shared area. See `src/share.ts`.
- **Chatnode bridge** — the cross-process delivery path for an ops scheduler
  daemon (dsh-routines) that must NOT hold its own robot connection. Two
  halves of the same `ctx.chatnode` contract in `src/bridge.ts`:
  - *listener* (web profile, opt-in via `bridgeToken`): an exact
    `POST /yzj/chatnode` route on the profile's `webServer` (loopback-only,
    bearer-token checked) that pushes through this plugin's own robot
    channel;
  - *client* (`bridgeTarget` set, no robots configured): the plugin provides
    `ctx.chatnode` as an HTTP client to the listener — no WebSocket, no
    robot credentials on the scheduler side.
  Final answers also append a session-record line
  (`📎 本任务完整记录：<guiUrl>（DSH 会话 <id>）`) when `guiUrl` is set
  (S2 deep-link analogue — the GUI has no session URL route).

## Configuration

| Key | Type | Default | Meaning |
|---|---|---|---|
| `sendMsgUrl` | string | `''` | The robot's send URL (token included). Empty disables the channel. |
| `enabled` | boolean | `true` | Bring the channel up when the plugin loads. |
| `allowFrom` | string[] | `[]` | openIds allowed to drive the robot; empty list = CLI login user only. |
| `provider` / `model` | string | `''` | Default route for this robot's sessions; empty = harness default. |
| `cwd` | string | `''` | Channel root for this robot's sessions; empty = host process cwd (`defaultCwd` applies first). DMs work at the root; bound group homes use `<cwd>/groups/<groupId>/` and the group shared dir sits at `<cwd>/groups/<groupId>/shared/`. |
| `chatnodeRobotIndex` | number | `0` | Which channel `ctx.chatnode.send` pushes to (dsh-routines digests). |
| `bridgeToken` | string | `''` | Shared bearer token; when set, registers the `POST /yzj/chatnode` bridge listener on the profile's webServer (loopback-only). |
| `bridgeTarget` | string | `''` | Bridge client mode: with this set (and no robots), the plugin provides `ctx.chatnode` as an HTTP client to the listener — no WS, no credentials. Requires `bridgeToken`. |
| `guiUrl` | string | `''` | DSH GUI base URL for `!configure` and the S2 session-record line on final answers. |

## Service face (`ctx.yzjRobot`)

- `getStatus(): RobotStatus` — configured/connected/lastError/lastFrameAt.
- `send(text)` — proactive push (routines, digests, reminders).
- `notify(text, robotIndex?)` / `notifyCard(card, robotIndex?)` — DSH-side
  proactive notification on one channel.
- **`ctx.chatnode`** — the scheduled-engine delivery contract (dsh-routines):
  `send({text, title})` pushes a digest into the configured channel
  (`chatnodeRobotIndex` config; title prefixed as the first line). One chatnode
  provider per profile. See docs/spec/routines-delivery.md.
- `continueConversation(text, {robotIndex?, groupId?})` — inject an operator
  turn through the full inbound pipeline (ack, memory, agent turn, push back).
- `forkSession(sessionId)` — open or resume the bound DSH home for the
  conversation behind this session id (never a `fork-*` parallel root).
- `dmSession(robotId, openId)` — leftover. Legacy `yzj-robot-*` DM id;
  unused by inbound (homes are `yzj-home-*`). Kept so old disk logs stay
  addressable.
- `shareWrite(robotIndex, groupId?, filename, content, overwrite)` /
  `shareList(robotIndex, groupId?)` — group shared-workspace writes/lists
  behind the `robot_share_*` tools (groupId defaults to the channel's most
  recent surface).

## Protocol facts (measured 2026-08-16, see docs/spec/robot-channel-plan.md §4.1)

- Personal-robot creation needs no callback URL; the WS connection is the
  entire inbound path.
- Robot DM conversations are ordinary CLI-visible sessions (same id space);
  `im message list` round-trips both the robot's messages and reply chains.
- The inbound push carries the full reply chain incl. `replyRootMsgId`; the
  send response carries the message's real `msgId`.
- Content ceiling sits between 5000 and 6000 chars (errorCode 1401002);
  35 messages at 800ms all succeeded.

## Known limitations

- The outbound echo is not delivered back over WS (measured), so the
  `outboundAnchor` map only feeds reply continuation, not echo suppression.
- `!restart` disposes the router's own handle; sessions created elsewhere
  (e.g. the web UI resuming the same id) are left to their owners.
- The ack/deny texts are fixed strings for now; localization rides the config
  pass later.
