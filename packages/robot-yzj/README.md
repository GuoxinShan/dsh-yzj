# @dsh-yzj/robot-yzj

Yunzhijia robot channel, host half: the measured two-way bridge between a
personal (or group) Yunzhijia robot and DSH agent sessions.

## What it does

- **Inbound** — derives `wss://<host>/xuntong/websocket?yzjtoken=…` from the
  robot's `sendMsgUrl`, keeps the outbound-originating long connection alive
  (30s `{cmd:"ping"}` heartbeat, stale detection, capped exponential
  reconnect), and classifies every frame by the measured protocol
  (`directPush/robotMessage` messages, `msgChg` changes, `auth`/`pong`
  controls). No public callback is needed.
- **Routing** — one persistent agent session per (robot, user) DM
  (`yzj-robot-<robotId>-<openId>`), reply-chain continuation anchored on the
  server-maintained `replyRootMsgId`, msgId dedupe, per-session mute, and the
  standalone bang commands `!help / !status / !mute / !unmute / !restart`.
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
  through the full inbound pipeline), and `robot_fork` (new operator-side
  session seeded with a robot conversation's completed-turn history). See
  `src/control.ts` and docs/spec/robot-channel-plan.md §8.

## Configuration

| Key | Type | Default | Meaning |
|---|---|---|---|
| `sendMsgUrl` | string | `''` | The robot's send URL (token included). Empty disables the channel. |
| `enabled` | boolean | `true` | Bring the channel up when the plugin loads. |
| `allowFrom` | string[] | `[]` | openIds allowed to drive the robot; empty list = CLI login user only. |
| `provider` / `model` | string | `''` | Default route for this robot's sessions; empty = harness default. |
| `cwd` | string | `''` | Working directory for this robot's sessions; empty = host process cwd (`defaultCwd` applies first). |

## Service face (`ctx.yzjRobot`)

- `getStatus(): RobotStatus` — configured/connected/lastError/lastFrameAt.
- `send(text)` — proactive push (routines, digests, reminders).
- `notify(text, robotIndex?)` / `notifyCard(card, robotIndex?)` — DSH-side
  proactive notification on one channel.
- `continueConversation(text, {robotIndex?, groupId?})` — inject an operator
  turn through the full inbound pipeline (ack, memory, agent turn, push back).
- `forkSession(sessionId)` — fork a robot conversation into a new
  operator-side root session (completed-turn seed, cwd + parentSession
  lineage); the fork shows up in the DSH session list.
- `dmSession(robotId, openId)` — stable DM session id.

## Protocol facts (measured 2026-08-16, see docs/机器人通道调研与双向打通方案.md §4.1)

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
