# @dsh-yzj/ui-yzj

Yunzhijia browser surface, dual-face package (`dsh.client`, `platform: web`).

## Node half

Registers the `/yzj` Connection RPC channel over `ctx.yzjBridge` (authority `loopback`). Endpoints (36): `workspaces`, `docs`, `events`, `groups`, `messages`, `whoami`, `search`, `doc-get`, `doc-blocks`, `sheet-get`, `workspace-get`, `event-get`, `contact-get`, `write-list`, `write-decide`, the panel write face `im-send` / `file-upload` / `file-data` (user-direct writes), the todo face `todo-state` / `todo-ensure` / `todo-create` / `todo-toggle` / `todo-libraries` / `todo-select` / `todo-ensure-team` over the shared `ctx.yzjTodo` core from `@dsh-yzj/tool-yzj`, and the robot face `robot-status` / `robot-overrides` / `robot-override-set` / `robot-override-delete` / `robot-models` / `robot-share-list` / `robot-share-write` (panel-direct, user's own will) / `robot-diagnostics` / `robot-notify` / `robot-continue` / `robot-fork` over `ctx.yzjRobot` from `@dsh-yzj/robot-yzj`. Only lossless CLI-parsed JSON crosses the channel.

## Browser half

Registers into `shell.overlay` (floating ball + workspace panel), `conversation.input.dock` (drop band), and `tool.call.toolview` (keyed cards):

- **Tool cards** — one keyed view per yzj tool name (41): pending calls render the family title from args; settled calls render the structured `meta` payload with the digest text as fallback, and an error summary on failure. Card ↔ panel two-way jumps (查看上下文 opens the panel at the anchored tab/entry).
- **Workspace panel** — floating-ball entry (hover quick-dock, persistent toggle), five tabs: 知识库 (two-pane drill-down with doc content preview), 日程 (today), 会话 (full IM: chronological bubbles, media/file previews, emoji, reply, date dividers, anchor tags, 全部已读, plus a real composer sending via `im-send` as user-direct writes), 待办 (urgency buckets 逾期/今天/进行中/待办/已完成, #tag aggregation chips, quick-create parsing `#tag` + date fragments, one-click provisioning, checkbox complete/reopen, draggable rows), and 机器人 (channel status with resolved cwd, per-conversation model overrides, and the group shared workspace: browse files / panel-direct write with auto-unique names). Unread counts come from CLI `unreadCount` plus locally persisted read-state; browser system notifications on unread increase. All panel entries remain draggable into the composer as reference chips.
- **@ trigger sources** — 云之家·同事 / 云之家·会话 / 云之家·文档 (plus the codec carrier source).

Styling uses the GUI's `--dsw-*` semantic tokens with local fallbacks; product copy is Chinese.

## Model Experience

No direct effect: the node half contributes no prompt text, and the browser half renders only already-logged tool results plus panel data fetched through RPC.

## Known Limitations and Deferred Work

- **User-direct writes are un-gated by design** — panel composer sends and (planned) todo checkboxes act as the user's own hand; only agent-initiated writes pass the confirmation card.
- **`file download` card is text-only** — the CLI returns no structured path metadata for downloads.
- **Locale namespace not registered** — cards use Chinese literals; a `locale` namespace can be added when i18n is needed.
- **`panel.tsx` is a 2000-line module** — split before adding the planned 待办 tab.
