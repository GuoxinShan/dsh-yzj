# @dsh-yzj/ui-yzj

Yunzhijia browser surface, dual-face package (`dsh.client`, `platform: web`).

**Product law (v2.0):** 1 Yunzhijia group = 1 group room + N topic sessions —
see `docs/spec/group-room-topics.md`. "挑群" opens the group-room host
(`yzj-home-*`). Agent work lives on `yzj-topic-*`. Switching rooms paints
cache first and never flashes the private-chat hint. The 会话 tab is a picker
(no second IM composer).

## Node half

Registers the `/yzj` Connection RPC channel over `ctx.yzjBridge` (authority `loopback`). Endpoints include: `workspaces`, `docs`, `events`, `groups`, `messages`, `whoami`, `auth-status` / `auth-login` (probe CLI login; user-clicked `yzj-cli auth login` opens the system browser — tokens stay in the OS keychain), `search`, `doc-get`, `doc-blocks`, `sheet-get`, `workspace-get`, `event-get`, `contact-get`, `write-list`, `write-decide`, `home-open` / `home-binding` / `home-log` / `home-fused` / `home-nav` / `home-backfill` / `home-send` (bound DSH home + plugin message log ①②), the panel write face `im-send` / `file-upload` / `file-data` (user-direct writes; `im-send` also appends ② when the group is bound), `im-cache-get` / `im-cache-put` (L2 IM cache), and the model face over `ctx.yzjModels`. Only lossless CLI-parsed JSON crosses the channel.

## Browser half

Does **not** register `conversation.view` or `sidebar.footer.action` (R27). The 云之家 dock is DOM-injected under New Session as a single 「云之家」button (R31); click opens the center-column cover and does not switch domains or focus a hanger. The workbench is a cover (`data-dsh-yzj-view`) that does not create a session. Opening a topic closes the cover and `sessions.open`s the real `yzj-topic-*`. Still registers `conversation.input.dock` (leftover topic 「回群聊」; D8 丢进群 retired), `conversation.session.header.actions` (leftover room pill), and `tool.call.toolview` (keyed cards). **Does not** register `shell.overlay`.

- **Tool cards** — one keyed view per yzj tool name (53: contact / doc / sheet / calendar / im / file): pending calls render the family title from args; settled calls render the structured `meta` payload with the digest text as fallback, and an error summary on failure. Card 查看 jumps switch the workbench domain.
- **Workbench domains** — top underline tabs 对话 / 日程 / 知识库 (R31; 待办 and 推进 withdrawn 2026-08-27). 对话 is the session list + group-room timeline; 知识库 embeds the former panel. 日程 is day/week/month/year (`.cal` toolbar + time grid). Memory UI is deferred. The sidebar has one 「云之家」entry; it does not switch domains.
- **Group room** — workbench two-pane (conversation list + timeline). Clicking a list row switches `groupId` only (R24) — it does not create or focus a DSH session. Overlay mode paints without a hanger. Canvas layout (self right / others left; same-sender merge; date rules; in-bubble 「N 条回复」 chips; assistant file artifact cards), directory names (never 「群消息」; list rows prefer the CLI group name over the 「群房间」 title placeholder), hover text links 「回复 / 交给助手」. The first ask plants the summon window once as a plugin inject (`yzj-summon-window`). Topic agents mount the host default preset (`standard`) so bash/files sit next to `yzj_*` (R28 / pitfall-030). **Job-done delivery (R29):** when a topic turn goes idle, the node half posts a bounded summary back onto the Yunzhijia reply chain as the logged-in user (CLI identity, no confirm card) and still uploads/`im message send`s that turn's artifacts (images in the reply, other files on the group timeline). Composer takeover covering CLI send (reply / @ / @all / emoji / image / file), portaled into the timeline column. L2 badges: accent count = 待确认 topics, dot = 进行中. DMs have no drawer. New yzj sessions use `~/.dsh-yzj/workspace` as `meta.cwd`. Only `yzj-topic-*` attach to Host Workspace 「云之家」; room hosts (`yzj-home-*`) share the cwd but are not listed in that sidebar group. Plugin ensure detaches leftover `yzj-home-*` membership from an earlier attach-everything pass.
- **设置 → 云之家** — CLI login status + 「打开登录页」 (R26). Memory vault UI is deferred (R21 v1.6).
- **未登录** — the workbench session list (and non-IM domain top bar) shows a login card. The button starts `yzj-cli auth login` on the host; after the browser OAuth the user clicks 「我已登录」. DSH never stores tokens.
- **@ trigger sources** — 云之家·同事 / 云之家·会话 / 云之家·文档 (plus the codec carrier source for leftover chips). Drag-to-chip (floating-panel drop overlay) is retired.


Styling uses the GUI's `--dsw-*` semantic tokens with local fallbacks; product copy is Chinese.

## Model Experience

The node half posts a topic-turn summary back onto the Yunzhijia reply chain when the agent goes idle (R29). It does not add prompt text. The browser half renders already-logged tool results plus panel data fetched through RPC.

## Known Limitations and Deferred Work

- **User-direct writes are un-gated by design** — DSH「发进群」acts as the user's own hand; only agent-initiated writes pass the confirmation card. Product law D9 / R6. Topic job-done delivery (R29) is the contracted post-back of 「问助手」, also un-gated, CLI identity.
- **CLI file messages cannot join a reply chain** — `msg-type file` rejects `--reply-msg-id` (pitfall-033). Job-done images ride the richText reply; other files follow on the group timeline. The topic-drawer lens still shows those files as local cards (R30). Do not lift the `parseImSend` / `yzj_im_message_send` gate until CLI supports it.
- **`file download` card is text-only** — the CLI returns no structured path metadata for downloads.
- **Locale namespace not registered** — cards use Chinese literals; a `locale` namespace can be added when i18n is needed.
- **`panel.tsx` is a large module** — the floating overlay is gone; the same tabs now embed in the workbench. Split before further panel growth.
- **Calendar month fetch is two-pointer-scanned on the host** — `/yzj` `events` week-stripes the month and walks each stripe (pitfall-032). The browser still sends a single start/end.
