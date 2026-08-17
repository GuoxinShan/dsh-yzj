# @dsh-yzj/ui-yzj

Yunzhijia browser surface, dual-face package (`dsh.client`, `platform: web`).

**Product law (v2.0):** 1 Yunzhijia group = 1 group room + N topic sessions —
see `docs/spec/group-room-topics.md`. "挑群" opens the group-room host
(`yzj-home-*`). Agent work lives on `yzj-topic-*`. Switching rooms paints
cache first and never flashes the private-chat hint. The 会话 tab is a picker
(no second IM composer).

## Node half

Registers the `/yzj` Connection RPC channel over `ctx.yzjBridge` (authority `loopback`). Endpoints include: `workspaces`, `docs`, `events`, `groups`, `messages`, `whoami`, `search`, `doc-get`, `doc-blocks`, `sheet-get`, `workspace-get`, `event-get`, `contact-get`, `write-list`, `write-decide`, `home-open` / `home-binding` / `home-log` / `home-fused` / `home-nav` / `home-backfill` / `home-send` / `home-digest` / `home-handoff` (bound DSH home + plugin message log ①②), the panel write face `im-send` / `file-upload` / `file-data` (user-direct writes; `im-send` also appends ② when the group is bound), the todo face over `ctx.yzjTodo`, the robot face over `ctx.yzjRobot`, the memory face over `ctx.yzjMemory`, and the model face over `ctx.yzjModels`. Only lossless CLI-parsed JSON crosses the channel.

## Browser half

Registers into `sidebar.footer.action` (「云之家」entry dock: 对话 / 待办 / 日程 / 知识库 / 记忆 + robot status; 对话 focuses a bound room, other domains switch the workbench pane), `conversation.view` (workbench: session list | canvas timeline + Slack-style topic drawer, or an embedded todo/calendar/docs/memory pane; self right / others left; hover 回复/交给助手 opens the drawer, not native Chat), `conversation.composer` (group-room takeover hides the official bar; the 发进群 face portals into the timeline column), `conversation.input.dock` (topic 回群房间 / unbound 丢进群; room dock 发进群 is retired), `conversation.session.header.actions` (tab-ring sync + topic anchor card「点这里回群房间」; the chrome keeps only a lightweight 回群房间 jump), and `tool.call.toolview` (keyed cards). **Does not** register `shell.overlay` (P2 retired the floating ball).

- **Tool cards** — one keyed view per yzj tool name (41) plus the five `memory_*` tools: pending calls render the family title from args; settled calls render the structured `meta` payload with the digest text as fallback, and an error summary on failure. Card 查看 jumps switch the workbench domain.
- **Workbench domains** — 对话 is the session list + group-room timeline; 待办 / 日程 / 知识库 embed the former panel tabs (todo checkboxes are user-direct, no confirm card); 记忆 is the local vault with copy 「本地，不出本机」.
- **Group room** — workbench two-pane (conversation list + timeline). Canvas layout (self right / others left; same-sender merge; date rules; in-bubble 「N 条回复」 chips; assistant file artifact cards), directory names (never 「群消息」; list rows prefer the CLI group name over the 「群房间」 title placeholder), hover text links 「回复 / 交给助手」 open the topic drawer (native Chat via 原生会话 ↗). Composer takeover covering CLI send (reply / @ / @all / emoji / image / file), portaled into the timeline column. L2 badges: accent count = 待确认 topics, dot = 进行中. DMs have no drawer. New yzj sessions use `~/.dsh-yzj/workspace` as `meta.cwd` (Host Workspace 「云之家」).
- **设置 → 云之家** — the management home (NOT a workspace tab; user decision): a segmented 机器人｜记忆库 control mounting the same RobotPane (channel status with resolved cwd, per-conversation model overrides, group shared workspace, channel management) and MemoryPane (vault browser over `ctx.yzjMemory`, dream switch/schedule/model, plugin default model picker). The wrapper self-fetches on mount and its RPC verb wrappers refresh local state, so every pane-internal refresh path (observe submit, dream run, override edits) re-renders.
- **@ trigger sources** — 云之家·同事 / 云之家·会话 / 云之家·文档 (plus the codec carrier source).

Styling uses the GUI's `--dsw-*` semantic tokens with local fallbacks; product copy is Chinese.

## Model Experience

No direct effect: the node half contributes no prompt text, and the browser half renders only already-logged tool results plus panel data fetched through RPC.

## Known Limitations and Deferred Work

- **User-direct writes are un-gated by design** — DSH「发进群」and todo checkboxes act as the user's own hand; only agent-initiated writes pass the confirmation card. Product law D9 / R6.
- **`file download` card is text-only** — the CLI returns no structured path metadata for downloads.
- **Locale namespace not registered** — cards use Chinese literals; a `locale` namespace can be added when i18n is needed.
- **`panel.tsx` is a large module** — the floating overlay is gone; the same tabs now embed in the workbench. Split before further panel growth.
