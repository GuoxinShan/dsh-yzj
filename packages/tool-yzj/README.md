# @dsh-yzj/tool-yzj

Model-facing Yunzhijia tools over `ctx.yzjBridge`. This package owns tool schemas, digest rendering, budget caps, and the structured UI payload projection; the CLI channel stays in `@dsh-yzj/bridge`.

## Tools

| Domain | Tools |
| ------ | ----- |
| contact | `yzj_whoami`, `yzj_contact_search`, `yzj_contact_get` |
| doc | `yzj_doc_workspace_list/get/create`, `yzj_doc_list/get/recent/create/rename/move/delete/import/download_url`, `yzj_doc_block_list/insert/update/delete` |
| sheet | `yzj_sheet_create/get`, `yzj_sheet_table_get/create/rename/delete`, `yzj_sheet_record_list/create/update/delete` |
| calendar | `yzj_calendar_event_list/get/create/update/delete/participants`, `yzj_calendar_room_find` |
| im | `yzj_im_message_send/list`, `yzj_im_group_recent` |
| file | `yzj_file_upload`, `yzj_file_download` |
| todo | `yzj_todo_list/create/update/complete` (semantic todo core, demo-stage sheet backend; see `ctx.yzjTodo`) |
| advance | `yzj_advance_list/get/inspect/scan/create/feed` (AI推进 board; see `ctx.yzjAdvance`) |

Every tool returns `{ content, truncated, data }`:

- `content` — the model-facing digest capped at `maxRenderChars` (rendered through `output.render`).
- `data` — the capped structured payload projected through `output.presentationMeta`. **Never model-visible**; persisted with the session log (`tool/result` meta) so the browser UI reproduces the card on live and replay paths alike.

## Home binding (`ctx.yzjHome`)

Durable group-room table: one Yunzhijia conversation (group or DM) ↔ one DSH host session (`yzj-home-*`) plus 0..N topic sessions (`yzj-topic-*`). Shared by robot inbound `followup()` and the workbench pick-group path (`/yzj home-open`). Domain `yzj_home_bindings` (storage-domain); a second open is focus (`created: false`), never a parallel row. `TopicAnchorStore` keys `(conversation, rootMsgId)` and stores `lastActivity` / `status` (`running` | `confirm` | `done`).

**Bound message log** (domain `yzj_home_logs`, keyed by `yzjConversationId`): inbound ① and DSH「发进群」② live here — never as harness `Session.append` events. Rows keep a clipped CLI `param` snapshot (`file_id` / `desc` / reply) so the group-room view can reuse the floating-panel renderer (avatars, emoticons, images). `formatSummonWindow` is the shared digest. The window is planted **once** as a plugin user message (`agent.inject` / `agent/pre-step`, `plugin: yzj-summon-window`) — it is not a `systemPrompt.context` snapshot section (pitfall-031). Topics prefer the reply chain around the anchor. Memory stays on the `yzj-memory` snapshot. File rows print `fileId=` (`param.file_id`, never msgId). The digest always pins `groupId` and per-line `msgId` (topic sessions also pin the anchor `msgId`) so the model can call `yzj_im_message_send` / `replyMsgId`. See `docs/spec/dsh-home-transcript.md` §5.2 and pitfall-027 / 029.

## Advancement board (`ctx.yzjAdvance`)

Event-sourced AI推进 core (docs/spec/ai-advance-design.md): one advancement item (推进事项) is the fold of an append-only 事元 stream stored in two tables (「事项」/「事元」) inside the same 待办任务库 dbt as the todo family — the panel library switcher moves both. `yzj_advance_feed` is the ONLY mutation channel: goal updates, progress, deviations, decision requests, and six-stage moves (`draft→running→(decision-needed→updated)*→ready-for-review→completed`) are all entries with host-generated `原值→新值` diffs and traceable refs; the item row only caches the projection. Host forcibly skips only an exact replay — the same refs set AND the same changeType (决策 25,修订决策 19 的交集语义); a partial refs overlap appends normally and returns an `overlappedRefs` hint. The stream is never truncated storage-side (knowledge-sedimentation source); digests and panel first-screens window it. `yzj_advance_inspect` is read-only 比对材料 (goal/background/metrics/legal next stages + the interrupt/silence/suppression criteria of spec §13; host does not judge). `yzj_advance_scan` is the read-only incremental IM scan (host-owned cursors in `yzj_advance_scan_cursors`); its `groups` parameter is optional — omitted, it aggregates the deduped `im:` threads of every open item from the subscription registry (over 8 channels errors out instead of truncating) and the digest lists each item's 订阅清单 for model-side dispatch. Intent threads (spec §15, 决策 20/21/23) live in the host storage-domain `yzj_advance_threads` (`advance-threads.ts`): `yzj_advance_create` accepts an optional `threads` array (the founding group becomes 线程①; token grammar `im:/doc:/todo:/event:/file:`), and the service exposes `threadsOf` / `threadAdd` / `threadRemove` for the panel RPC — a document-source association lands one `备注` 事元 (refs=[token], repeat idempotent), unlinking never deletes entries. The service backs the `/yzj` RPC endpoints (`advance-state/get/create/judge/ensure/feed/scan-state/thread-add/thread-remove`; the thread list folds into the `advance-get` response); panel judge verbs, the start modal, the user-direct `advance-feed` (one-sentence 事元, no `stageTo`), and the thread add/remove writes are user-direct writes landing as `操作者=user` rows. 「请 AI 验收」pre-fills the topic ask bar and does not auto-send. Patrol five steps live in `INSPECT_DISCIPLINE`.

## Approval guard

`tools/pre-execute` returns `{ kind: 'ask', reason }` for operations that must never run unconfirmed: `yzj_doc_delete`, `yzj_doc_move`, `yzj_doc_block_delete`, `yzj_sheet_table_delete`, `yzj_sheet_record_delete`, `yzj_calendar_event_delete`, `yzj_im_message_send`, `yzj_file_upload`, `yzj_file_download` with `overwrite: true`, todo writes, `yzj_advance_create`, `yzj_advance_feed` **only when it rewrites the baseline** (`goal`/`metrics`/`targetDate`/`assignee` — plain appends and stage moves stay silent, spec §13.5), `robot_share_write`, and **bound-home** `robot_notify` / `robot_continue` (D9 group push; the unbound operator console stays ungated). The composed ApprovalService routes the ask to the GUI approval panel (or the in-group suggestion card on inbound homes) and audits the pair on the session log.

## Config

| Field | Default | Meaning |
| ----- | ------- | ------- |
| `timeoutMs` | `60000` | Cooperative timeout per tool call. |
| `maxRenderChars` | `30000` | Cap on model-facing digest characters. |
| `maxMetaChars` | `50000` | Cap on the UI presentation payload characters (after clipping). |
| `backfillLimit` | `50` | Recent Yunzhijia messages pulled when opening a bound session. |
| `summonWindowMessages` | `20` | Max log rows in one summon window. |
| `summonWindowChars` | `4000` | Summon-window character cap. |
| `logRetention` | `500` | Per-conversation log retention (oldest dropped). |

## Model Experience

Read tools return one digest line per record with stable formats (`- [类型] 标题 (id) · 更新时间`); write tools return the operation summary plus the doc link (`https://www.yunzhijia.com/knowledge/lingee/#/store/doc/<DOC_ID>`) per the yzj-cli contract. Bridge failures render as `yzj <label> failed (exit N): <stderr>`. Results append as tool-result content and never alter the request prefix (KV-cache independent).

`yzj_calendar_event_list` week-stripes the window and two-pointer-scans each stripe (peek remaining suffix, keep the earliest day, skip empty tails). A multi-day `calendar event list` otherwise keeps only the first instance of a recurring series (pitfall-032).

## Known Limitations and Deferred Work

- **Sheet record shapes are defensive** — record payloads vary by endpoint (`records` / bare array, `fieldsValue` / `fields`); the formatters accept the documented shapes and degrade to compact JSON.
- **Write digests for import/block ops are conservative** — the CLI's response shapes for some write endpoints are opaque; the digest states the operation and returns the doc link, and `data.payload` carries the raw clipped response for the UI.
