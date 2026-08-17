# pitfall-014: 群房间宿主没有 `turn/start` → 侧栏藏成「新会话」，可被新建会话复用

## 复现条件（Reproduction）

打开云之家群（面板「打开群房间」或挑群 `home-open`）后：

1. DSH 侧栏搜群名 / `yzj-home` → 「无匹配会话」。
2. 当前行标题是「新会话」，composer 停在「选择一个工作区开始」（textarea `readonly`）。
3. chrome 却是「发进群」（其实已经 focus 到 `yzj-home-*`，只是 blank）。
4. 点「新建会话」有复用该宿主的风险：harness 把 blank session 当工作区的临时 New Session 行。

真机：2026-08-17，`verify-group-room-e2e.mjs` 对「测试群」发进群/交给助手全部被挡。

## 根因（Root cause）

harness `sessionBlank` = 日志里没有 `turn/start`。侧栏 `sessionVisible` 对 blank 行只展示 **当前** 那一条，且搜索排除 blank，显示名强制本地化为「新会话」。

群房间时间线在插件日志（T1：①② 禁止 `Session.append`），宿主本来就不会跑模型回合 → 永远 blank。`session/title` 也不揭开（`/plan` `/goal` 同类：standalone 事件不打开 turn）。

## 解法（Fix）

`publishHostSession`（`packages/ui-yzj/src/home-open.ts`）：create/resume 之后若还没有 `turn/start`，追加一次已关闭空 turn（`turn/start` + `turn/end` reason completed）并钉 `session/title`（群名，`source.kind=user`）。不调用模型、不写 ①②。已有真实回合的宿主只补标题、不再写第二轮空 turn。

产品法见 `docs/spec/group-room-topics.md` R14。

## 回归覆盖（Regression coverage）

- `packages/ui-yzj/tests/home-open.spec.ts`：create 后事件序 `turn/start` / `turn/end` / `session/title`；已有 `turn/start` 不重复。
- `.acceptance/verify-group-room-e2e.mjs`：侧栏能搜到群名（需 GUI 加载新 host）。
