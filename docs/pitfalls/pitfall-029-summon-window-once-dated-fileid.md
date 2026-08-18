# pitfall-029：召唤窗每轮重贴、同轮闪烁、跨日倒序、文件没 fileId

## 现象

话题会话（例 `yzj-topic-6a605c7ce4b0772a6279295e-…`）里每敲一轮，runtime snapshot 都带完整 `［本群最近消息］`（默认 20 条 / 4000 字）。同轮第二个快照又把它丢掉（2741↔577），记忆库明明没变也跟着整段重发。窗口第一行 `[16:55]` 下一行 `[10:50]`，看起来像倒序。群文件只有 `[文件]:名`，模型拿 msgId 调 `yzj_file_download` 得到 API 2001。

## 复现条件

1. 工作台打开群房间，点「交给助手」，抽屉或官方 Chat 连问两轮。
2. 解码该 `yzj-topic-*` 的 `session.jsonl.zstd`（pitfall-008）：每轮首个 snapshot 有 `yzj-bound-window`，同轮下一个没有；`request/header` 的 `system` 并不含窗口（窗口是 user 角色快照，不是插到 system 前面）。
3. 近窗跨过午夜：`formatWindowTime` 只出 `HH:mm`。
4. 群里有 `msgType=file` 且 CLI `param.file_id` 有值的消息。

## 根因

1. **门控从 source 猜召唤。** `summonWindowText` 用 `latestUserSourceKind !== 'plugin'`。GUI 每轮最新 user/message 都是 `'user'` → 每轮重贴。snapshot 自己也是 plugin user 消息 → 同轮下一步变成 `'plugin'` → 窗被拿掉。harness `RuntimeContextProjection` 按文本去重，闪烁导致记忆 section 也重发。
2. **抽屉复用了机器人 inject。** `askTopicAssistant` 先 `inject(窗口)` 再 `followup(问句)`，T5 再贴一次，同一轮双份；转写里窗口还排在问句上面，像假气泡。
3. **时间戳丢日期。** `formatWindowTime` 只 `HH:mm`。`acked.slice(-N)` + `unshift` 的行序是升序，跨日看起来反了。
4. **渲染丢 fileId。** `PARAM_KEEP` 已留 `file_id`，但 `messageLine` / `formatSummonWindow` 只拼 `content`。

## 解法

- `shouldAttachSummonWindow(events)`：本轮已有窗口 inject → 空；历史只有 inject、快照从未带窗 → 空（稳住「记忆+策略」）；快照曾带 `yzj-bound-window` → **仍返回同一段**。不要在后续轮把窗从快照拿掉——`RuntimeContextProjection` 按整份文本去重，拿掉窗 = 新快照 = 记忆再贴一遍。不要再「最新一条是不是 plugin」。
- `yzj-memory` 本身不必改注入缝：它本就该每次 assemble 现算；重发是快照指纹被窗带崩，不是记忆自己每轮主动贴。
- 抽屉只 `followup` 问句。云之家 `@机器人` / D8 handoff 仍 `inject`。
- `formatWindowTime` → `MM-DD HH:mm`。
- 文件行与话题锚追加 `fileId=<param.file_id>`（可附 size）。`yzj_file_download` 的 `id` 说明写清：来自 upload 返回或消息 `param.file_id`，不是 msgId。

不要另写一套窗口文案。不要把窗口当用户气泡 chip。

## 回归覆盖

- `packages/tool-yzj/tests/home.spec.ts`：第一次 user 给窗；同轮 / 下一轮仍给窗（稳住指纹）；机器人 inject 之后的 GUI 轮不再把窗加进快照；本轮已 inject 空。
- `packages/tool-yzj/tests/bound-log.spec.ts`：跨日两条显示 `MM-DD`；file 行含 `fileId=`。
- `packages/ui-yzj/tests/bound-io.spec.ts`：`askTopicAssistant` 不再 inject 窗口，只 followup。
