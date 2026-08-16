# @dsh-yzj/ui-yzj

Yunzhijia browser surface, dual-face package (`dsh.client`, `platform: web`).

**Product law (binding + fused timeline landed):** DSH is the only conversation home —
see `docs/spec/dsh-home-session.md`. "挑群" opens or switches the bound DSH
session (`/yzj home-open` + `sessions.open`). Bound sessions register
`conversation.view`「群工作」merging the plugin IM log with official events.
The 会话-tab composer is a shortcut that writes ② into that log (gap-analysis §22 G6 closed as demotion).

## Node half

Registers the `/yzj` Connection RPC channel over `ctx.yzjBridge` (authority `loopback`). Endpoints include: `workspaces`, `docs`, `events`, `groups`, `messages`, `whoami`, `search`, `doc-get`, `doc-blocks`, `sheet-get`, `workspace-get`, `event-get`, `contact-get`, `write-list`, `write-decide`, `home-open` / `home-binding` / `home-log` / `home-fused` / `home-backfill` / `home-send` / `home-digest` / `home-handoff` (bound DSH home + plugin message log ①②), the panel write face `im-send` / `file-upload` / `file-data` (user-direct writes; `im-send` also appends ② when the group is bound), the todo face over `ctx.yzjTodo`, the robot face over `ctx.yzjRobot`, the memory face over `ctx.yzjMemory`, and the model face over `ctx.yzjModels`. Only lossless CLI-parsed JSON crosses the channel.

## Browser half

Registers into `shell.overlay` (floating ball + workspace panel), `conversation.view` (fused「群工作」timeline), `conversation.input.dock` (drop band + 发进群 / 丢进群 chrome), and `tool.call.toolview` (keyed cards):

- **Tool cards** — one keyed view per yzj tool name (41) plus the five `memory_*` tools: pending calls render the family title from args; settled calls render the structured `meta` payload with the digest text as fallback, and an error summary on failure. Card ↔ panel two-way jumps (查看上下文 opens the panel at the anchored tab/entry).
- **Workspace panel** — floating-ball entry (hover quick-dock, persistent toggle), four operational tabs: 知识库, 日程, 会话 (message list plus a shortcut composer that writes ②; **picking a group also focuses its bound DSH session**), 待办. Unread counts come from CLI `unreadCount` plus locally persisted read-state. All panel entries remain draggable into the composer as reference chips.
- **设置 → 云之家** — the management home (NOT a workspace tab; user decision): a segmented 机器人｜记忆库 control mounting the same RobotPane (channel status with resolved cwd, per-conversation model overrides, group shared workspace, channel management) and MemoryPane (vault browser over `ctx.yzjMemory`, dream switch/schedule/model, plugin default model picker). The wrapper self-fetches on mount and its RPC verb wrappers refresh local state, so every pane-internal refresh path (observe submit, dream run, override edits) re-renders.
- **@ trigger sources** — 云之家·同事 / 云之家·会话 / 云之家·文档 (plus the codec carrier source).

Styling uses the GUI's `--dsw-*` semantic tokens with local fallbacks; product copy is Chinese.

## Model Experience

No direct effect: the node half contributes no prompt text, and the browser half renders only already-logged tool results plus panel data fetched through RPC.

## Known Limitations and Deferred Work

- **User-direct writes are un-gated by design** — DSH「发进群」, the demoted panel shortcut, and todo checkboxes act as the user's own hand; only agent-initiated writes pass the confirmation card. Product law (dsh-home-session D9).
- **`file download` card is text-only** — the CLI returns no structured path metadata for downloads.
- **Locale namespace not registered** — cards use Chinese literals; a `locale` namespace can be added when i18n is needed.
- **`panel.tsx` is a 2000-line module** — split before adding the planned 待办 tab.
