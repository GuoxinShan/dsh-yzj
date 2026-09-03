# @dsh-yzj/ui-yzj

Yunzhijia browser surface, dual-face package (`dsh.client`, `platform: web`).

**Product law (v3.0):** the surface is an IM shell — see `docs/spec/im-shell.md`.
Assistants are user-defined 1..N 单聊 contacts (factory 「助手」). Yunzhijia
groups and colleague DMs are people rooms. The user never sees the folder
tree, New Session, cwd, or DSH session ids.

## Node half

Registers the `/yzj` Connection RPC channel over `ctx.yzjBridge` (authority
`loopback`). Endpoints include the existing panel reads/writes (`workspaces`,
`groups`, `whoami`, `auth-*`, `home-fused` / `home-send`, `write-list` /
`write-decide`, …) plus the IM shell: `assistants-list` / `assistants-create` /
`assistant-ask` / `assistant-thread-ask` / `assistant-projection` /
`assistant-threads` / `assistant-process`. Only lossless JSON crosses the
channel. yzj-cli 0.1.6 `whoami` is `{success, identity, data}` — parse both
`data` and sibling `identity` (`parseContactUser`).

## Browser half

Does **not** `register` layout `conversation` or `sidebar.workspaces` (those
single seats are already taken; a second register throws — pitfall-050).

- **Inbox** — portals into `[data-slot="sidebar.workspaces"]` and hides the
  folder tree. Settings stay on `sidebar.settings`. Sectioned list 助手 /
  单聊 / 群 / 订阅通知 (`parseRecentGroups` + `inboxRoomKind`); avatars from
  `headerUrl`/`photoUrl`. Header `+` creates an assistant without opening 设置.
  CSS hides New Session / session rows / details / the view tablist.
- **Center** — occupies `conversation.view` (`id: yzj-im`, label 助手) with
  the IM shell (assistant DM or people room). `conversation.composer` chain
  paints `null`; host InputBar / stats / session chrome are collapsed via CSS
  + `watchHostChrome` (works without `data-composer-seat`, pitfall-052).
  Workbench overlay / 云之家 dock / topic leftover chrome are **not mounted**.
- **Assistant DM** — Grok-Bot bubbles from `present` + pending yzj confirm
  cards. Muted 「查看过程」opens a digest of the hidden session (not a tool
  trace in the bubble stream). Composer `+` opens calendar/docs as a pane,
  not a home tab.
- **People room** — Yunzhijia timeline via `home-fused` / `home-send`. Header
  「问助手」. Reply + `@助手` (assistants listed first) intercepts send and
  hangs a 只你可见 local thread under that `msgId`. Empty `@助手` does not
  post to Yunzhijia. People `@姓名` still uses `resolveAtMentions`.
- **Tool cards** — keyed `tool.call.toolview` for every `yzj_*` name plus
  `present`. Write tools use the confirmation card.
- **设置 → 云之家** — CLI login + 「新建助手」 (name + optional notes).

Styling uses `--dsw-*` tokens; product copy is Chinese.
