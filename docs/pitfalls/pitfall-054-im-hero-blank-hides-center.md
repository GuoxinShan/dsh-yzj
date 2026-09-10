# pitfall-054: 消息态停在 hero / blank「新会话」→ 中间栏全白

## 复现条件（Reproduction）

1. Oh My DSH 冷启动落在无当前会话，或当前行是 blank「新会话」（`data-phase="hero"`）。
2. 默认表面是「消息」：收件箱正常，`html[data-dsh-yzj-im]` 已打上。
3. 点收件箱任意行：选中高亮，**中间栏仍是白屏**；DOM 无 `[data-testid="yzj-im-shell"]`，也无「助手」view tab。

真机：2026-09-10，desktop web token 页；侧栏混排有群，中栏空白。

## 根因（Root cause）

harness 的 `conversation.view`（含 id `yzj-im` / label 助手）只挂在**非 blank 的当前 session** 画布上。hero / blank 没有 tab ring，`yzj-im-shell` 根本不进 DOM。

IM occupancy 又用 CSS + `watchHostChrome` 把 hero 的官方 InputBar / composer 收成 0（pitfall-052），于是中间只剩白底——看起来像「点了加载不出来」，其实是画布座位缺失，不是 inbox RPC 失败。

点群切 `groupId` 故意不 `homeOpen`（R24 / pitfall-024），所以收件箱点击本身不会造座位。

## 解法（Fix）

消息态（`surface=im`）且壳未挂、当前缺失或 blank 时：`ensureImCanvas` 从 session 列表挑一条 **非 blank** 行 `sessions.open`（优先 `peekImSeat`）。不新建 session、不 per-click homeOpen。有壳或已在非 blank 当前上则 no-op；会话表面不碰。

列表里若只有 blank（全新机），仍无法挂 view——需用户在「会话」里先有一条真实对话，或后续再做专用 canvas 铸币；本坑先覆盖「本机已有历史会话却冷启动停在 hero」的主路径。

## 回归覆盖（Regression coverage）

- `packages/ui-yzj/tests/im-canvas.client.spec.ts`：needsFocus / open 首条非 blank / 优先 seat / 会话态不 open。
- 真机：冷启动「消息」中栏应出现助手 DM 或点群后的群房间；`[data-testid="yzj-im-shell"]` 高度 > 0。
