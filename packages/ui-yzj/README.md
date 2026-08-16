# @dsh-yzj/ui-yzj

Yunzhijia browser surface, dual-face package (`dsh.client`, `platform: web`).

**Product law (docs, not yet implemented):** DSH is the only conversation home — see `docs/spec/dsh-home-session.md`. The panel's job is picker / history / extra-reference; "挑群" opens or switches the bound DSH session. The real IM composer in the 会话 tab is the current three-surface implementation, targeted for removal or demotion (gap-analysis §22 G6).

## Node half

Registers the `/yzj` Connection RPC channel over `ctx.yzjBridge` (authority `loopback`). Endpoints (49): `workspaces`, `docs`, `events`, `groups`, `messages`, `whoami`, `search`, `doc-get`, `doc-blocks`, `sheet-get`, `workspace-get`, `event-get`, `contact-get`, `write-list`, `write-decide`, the panel write face `im-send` / `file-upload` / `file-data` (user-direct writes), the todo face `todo-state` / `todo-ensure` / `todo-create` / `todo-toggle` / `todo-libraries` / `todo-select` / `todo-ensure-team` over the shared `ctx.yzjTodo` core from `@dsh-yzj/tool-yzj`, the robot face `robot-status` / `robot-overrides` / `robot-override-set` / `robot-override-delete` / `robot-models` / `robot-share-list` / `robot-share-read` / `robot-share-write` (panel-direct, user's own will) / `robot-diagnostics` / `robot-notify` / `robot-continue` / `robot-fork` / `robot-channels-save` over `ctx.yzjRobot` from `@dsh-yzj/robot-yzj`, the memory face `memory-scope` / `memory-log` / `memory-observe` (panel-direct observe = user's own will) / `dream-state` / `dream-set` / `dream-run` (in-process dream executor) over `ctx.yzjMemory` from `@dsh-yzj/memory-yzj`, and the model face `model-default` / `model-default-set` / `model-default-clear` / `model-catalog` over `ctx.yzjModels` from `@dsh-yzj/model-yzj`. Only lossless CLI-parsed JSON crosses the channel.

## Browser half

Registers into `shell.overlay` (floating ball + workspace panel), `conversation.input.dock` (drop band), and `tool.call.toolview` (keyed cards):

- **Tool cards** — one keyed view per yzj tool name (41) plus the five `memory_*` tools: pending calls render the family title from args; settled calls render the structured `meta` payload with the digest text as fallback, and an error summary on failure. Card ↔ panel two-way jumps (查看上下文 opens the panel at the anchored tab/entry).
- **Workspace panel** — floating-ball entry (hover quick-dock, persistent toggle), four operational tabs: 知识库 (two-pane drill-down with doc content preview), 日程 (today), 会话 (full IM: chronological bubbles, media/file previews, emoji, reply, date dividers, anchor tags, 全部已读, plus a real composer sending via `im-send` as user-direct writes), 待办 (urgency buckets 逾期/今天/进行中/待办/已完成, #tag aggregation chips, quick-create parsing `#tag` + date fragments, one-click provisioning, checkbox complete/reopen, draggable rows). Unread counts come from CLI `unreadCount` plus locally persisted read-state; browser system notifications on unread increase. All panel entries remain draggable into the composer as reference chips.
- **设置 → 云之家** — the management home (NOT a workspace tab; user decision): a segmented 机器人｜记忆库 control mounting the same RobotPane (channel status with resolved cwd, per-conversation model overrides, group shared workspace, channel management) and MemoryPane (vault browser over `ctx.yzjMemory`, dream switch/schedule/model, plugin default model picker). The wrapper self-fetches on mount and its RPC verb wrappers refresh local state, so every pane-internal refresh path (observe submit, dream run, override edits) re-renders.
- **@ trigger sources** — 云之家·同事 / 云之家·会话 / 云之家·文档 (plus the codec carrier source).

Styling uses the GUI's `--dsw-*` semantic tokens with local fallbacks; product copy is Chinese.

## Model Experience

No direct effect: the node half contributes no prompt text, and the browser half renders only already-logged tool results plus panel data fetched through RPC.

## Known Limitations and Deferred Work

- **User-direct writes are un-gated by design** — panel composer sends and todo checkboxes act as the user's own hand; only agent-initiated writes pass the confirmation card. Product law (dsh-home-session D9) confirms this split; the *target send surface* is the bound DSH session, not a second panel composer.
- **`file download` card is text-only** — the CLI returns no structured path metadata for downloads.
- **Locale namespace not registered** — cards use Chinese literals; a `locale` namespace can be added when i18n is needed.
- **`panel.tsx` is a 2000-line module** — split before adding the planned 待办 tab.
