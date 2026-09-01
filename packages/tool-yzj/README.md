# @dsh-yzj/tool-yzj

Model-facing Yunzhijia tools over `ctx.yzjBridge`. This package owns tool schemas, digest rendering, budget caps, and the structured UI payload projection; the CLI channel stays in `@dsh-yzj/bridge`.

## Tools

| Domain | Tools |
| ------ | ----- |
| contact | `yzj_whoami`, `yzj_contact_search`, `yzj_contact_get` |
| doc | `yzj_doc_workspace_list/get/create`, `yzj_doc_list/get/recent/create/rename/move/delete/import/download_url`, `yzj_doc_search/write/download` (v0.1.4), `yzj_doc_block_list/insert/update/delete/replace` |
| sheet | `yzj_sheet_create/get`, `yzj_sheet_table_get/create/rename/delete`, `yzj_sheet_record_list/create/update/delete` |
| calendar | `yzj_calendar_event_list/get/create/update/delete/participants`, `yzj_calendar_room_find` |
| im | `yzj_im_message_send/list`, `yzj_im_group_recent`, `yzj_im_group_search/create/members_add/members_remove` (v0.1.4) |
| file | `yzj_file_upload`, `yzj_file_download` |

Every tool returns `{ content, truncated, data }`:

- `content` — the model-facing digest capped at `maxRenderChars` (rendered through `output.render`).
- `data` — the capped structured payload projected through `output.presentationMeta`. **Never model-visible**; persisted with the session log (`tool/result` meta) so the browser UI reproduces the card on live and replay paths alike.

## Home binding (`ctx.yzjHome`)

Durable group-room table: one Yunzhijia conversation (group or DM) ↔ one DSH host session (`yzj-home-*`) plus 0..N topic sessions (`yzj-topic-*`). Shared by robot inbound `followup()` and the workbench pick-group path (`/yzj home-open`). Domain `yzj_home_bindings` (storage-domain); a second open is focus (`created: false`), never a parallel row. `TopicAnchorStore` keys `(conversation, rootMsgId)` and stores `lastActivity` / `status` (`running` | `confirm` | `done`).

**Bound message log** (domain `yzj_home_logs`, keyed by `yzjConversationId`): inbound ① and DSH「发进群」② live here — never as harness `Session.append` events. Rows keep a clipped CLI `param` snapshot (`file_id` / `desc` / reply) so the group-room view can reuse the floating-panel renderer (avatars, emoticons, images). `formatSummonWindow` is the shared digest. The window is planted **once** as a plugin user message (`agent.inject` / `agent/pre-step`, `plugin: yzj-summon-window`) — it is not a `systemPrompt.context` snapshot section (pitfall-031). Topics prefer the reply chain around the anchor. Memory stays on the `yzj-memory` snapshot. File rows print `fileId=` (`param.file_id`, never msgId). The digest always pins `groupId` and per-line `msgId` (topic sessions also pin the anchor `msgId`) so the model can call `yzj_im_message_send` / `replyMsgId`. See `docs/spec/dsh-home-transcript.md` §5.2 and pitfall-027 / 029.

## Approval guard

`tools/pre-execute` gates writes that must never run unconfirmed: `yzj_doc_delete`, `yzj_doc_move`, `yzj_doc_block_delete`, `yzj_sheet_table_delete`, `yzj_sheet_record_delete`, `yzj_calendar_event_delete`, `yzj_im_group_members_remove` (strong; these destructive commands also carry the CLI `--yes` flag after the product-level approval), `yzj_im_message_send`, `yzj_file_upload`, `yzj_file_download`/`yzj_doc_download` with `overwrite: true`, `yzj_doc_write`, `yzj_doc_block_replace`, `yzj_im_group_create`, `yzj_im_group_members_add`, `yzj_sheet_*` writes, `yzj_calendar_event_create`/`update`. The guard broadcasts `yzj/ask-pending` and waits on `yzj/confirm-request` (ui-yzj write-gate answers; `{ kind: 'allow' }` / `{ kind: 'deny' }`). It does **not** return harness `{ kind: 'ask' }` — GUI Full access sets `approval: never`, which would auto-reject an ask before the waterfall runs (pitfall-036). Headless overlays without write-gate fail closed (`unavailable` → deny).

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
