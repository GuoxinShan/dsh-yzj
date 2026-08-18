# @dsh-yzj/ui-yzj

Yunzhijia browser surface, dual-face package (`dsh.client`, `platform: web`).

**Product law (v2.0):** 1 Yunzhijia group = 1 group room + N topic sessions —
see `docs/spec/group-room-topics.md`. "挑群" opens the group-room host
(`yzj-home-*`). Agent work lives on `yzj-topic-*`. Switching rooms paints
cache first and never flashes the private-chat hint. The 会话 tab is a picker
(no second IM composer).

## Node half

Registers the `/yzj` Connection RPC channel over `ctx.yzjBridge` (authority `loopback`). Endpoints include: `workspaces`, `docs`, `events`, `groups`, `messages`, `whoami`, `search`, `doc-get`, `doc-blocks`, `sheet-get`, `workspace-get`, `event-get`, `contact-get`, `write-list`, `write-decide`, `home-open` / `home-binding` / `home-log` / `home-fused` / `home-nav` / `home-topic-open` / `home-topic-lens` / `home-topic-ask` / `home-backfill` / `home-send` / `home-digest` / `home-handoff` (bound DSH home + plugin message log ①②; topic drawer lens + ask-assistant), the panel write face `im-send` / `file-upload` / `file-data` (user-direct writes; `im-send` also appends ② when the group is bound), the todo face over `ctx.yzjTodo`, the robot face over `ctx.yzjRobot`, the memory face over `ctx.yzjMemory`, and the model face over `ctx.yzjModels`. Only lossless CLI-parsed JSON crosses the channel.

## Browser half

Registers into `sidebar.footer.action` (「云之家」entry dock: 对话 / 待办 / 日程 / 知识库 + robot status; 记忆入口 deferred; 对话 switches the IM domain immediately and focuses the last room seat — home-open only heals a missing host), `conversation.view` (workbench: session list | canvas timeline + Slack-style topic drawer, or an embedded todo/calendar/docs pane; self right / others left; hover 回复/交给助手 opens the drawer, not native Chat), `conversation.composer` (group-room takeover hides the official bar; 发进群 portals into the timeline and is unmounted on 待办/日程/知识库/记忆 so those domains have no send bar), `conversation.input.dock` (topic 「回群聊」 sits on the official InputBar column — same max-width, QueueDock posture; unbound 丢进群; room dock 发进群 is retired), `conversation.session.header.actions` (tab-ring sync: rooms select 「群聊」; topic/unbound click 「对话」 so a leftover `view=yzj-home` cannot remount the IM shell), and `tool.call.toolview` (keyed cards). **Does not** register `shell.overlay` (P2 retired the floating ball).

- **Tool cards** — one keyed view per yzj tool name (41) plus the five `memory_*` tools: pending calls render the family title from args; settled calls render the structured `meta` payload with the digest text as fallback, and an error summary on failure. Card 查看 jumps switch the workbench domain.
- **Workbench domains** — 对话 is the session list + group-room timeline; 待办 / 日程 / 知识库 embed the former panel tabs (todo checkboxes are user-direct, no confirm card). Memory UI is deferred.
- **Group room** — workbench two-pane (conversation list + timeline). Clicking a list row switches `groupId` only (R24) — it does not create or focus a DSH session. One hanger `yzj-home-*` hosts `conversation.view`; later group clicks stay on that seat. Canvas layout (self right / others left; same-sender merge; date rules; in-bubble 「N 条回复」 chips; assistant file artifact cards), directory names (never 「群消息」; list rows prefer the CLI group name over the 「群房间」 title placeholder), hover text links 「回复 / 交给助手」 open the topic drawer (native Chat via 原生会话 ↗). The drawer lens is a bubble stream plus 「问助手」 (`home-topic-lens` / `home-topic-ask`); this-turn `write`/`edit` files render as cards under the assistant bubble (R27). Asking injects `formatSummonWindow` then followups and does not focus native Chat. Official Chat turns get the same window via `systemPrompt.context` `yzj-bound-window` (topic lookup + skip-only-plugin; pitfall-027). **Job-done delivery (R26):** when a topic turn goes idle, the node half posts a bounded summary back onto the Yunzhijia reply chain as the logged-in user (CLI identity, no confirm card) and still uploads/`im message send`s that turn's artifacts (images in the reply, other files on the group timeline). The lens cards do not replace that send. Opening a host that still has pre-v2.0 ③④ mints a 「历史对话」 topic (`rootMsgId=legacy-host`). Composer takeover covering CLI send (reply / @ / @all / emoji / image / file), portaled into the timeline column. L2 badges: accent count = 待确认 topics, dot = 进行中. DMs have no drawer. New yzj sessions use `~/.dsh-yzj/workspace` as `meta.cwd`. Only `yzj-topic-*` attach to Host Workspace 「云之家」; room hosts (`yzj-home-*`) share the cwd but are not listed in that sidebar group. Plugin ensure detaches leftover `yzj-home-*` membership from an earlier attach-everything pass.
- **设置 → 云之家** — robot-channel management (NOT a workspace tab). Memory vault UI is deferred (R21 v1.6); `memory-yzj` and `memory_*` tools stay mounted.
- **@ trigger sources** — 云之家·同事 / 云之家·会话 / 云之家·文档 (plus the codec carrier source for leftover chips). Drag-to-chip (floating-panel drop overlay) is retired.


Styling uses the GUI's `--dsw-*` semantic tokens with local fallbacks; product copy is Chinese.

## Model Experience

The node half posts a topic-turn summary back onto the Yunzhijia reply chain when the agent goes idle (R26). It does not add prompt text. The browser half renders already-logged tool results plus panel data fetched through RPC.

## Known Limitations and Deferred Work

- **User-direct writes are un-gated by design** — DSH「发进群」and todo checkboxes act as the user's own hand; only agent-initiated writes pass the confirmation card. Product law D9 / R6. Topic job-done delivery (R26) is the contracted post-back of 「问助手」, also un-gated, CLI identity.
- **CLI file messages cannot join a reply chain** — `msg-type file` rejects `--reply-msg-id` (pitfall-028). Job-done images ride the richText reply; other files follow on the group timeline. The topic-drawer lens still shows those files as local cards (R27). Do not lift the `parseImSend` / `yzj_im_message_send` gate until CLI supports it.
- **`file download` card is text-only** — the CLI returns no structured path metadata for downloads.
- **Locale namespace not registered** — cards use Chinese literals; a `locale` namespace can be added when i18n is needed.
- **`panel.tsx` is a large module** — the floating overlay is gone; the same tabs now embed in the workbench. Split before further panel growth.
