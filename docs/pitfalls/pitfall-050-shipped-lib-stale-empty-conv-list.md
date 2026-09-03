# Pitfall 050 — 提交的 `lib/` 产物落后于 `src/`：工作台会话列表永远空

> 记录日期：2026-09-03
> 影响区域：根 `lib/*.mjs` + `lib/client.js`（git 可装的成品产物）/ 工作台「对话」会话列表 / 任何依赖 `bridgeResult` 解信封的 `/yzj` 读端点

## 现象

已登录 yzj-cli（`yzj-cli whoami` / `im group recent` CLI 返回 4 个群），但工作台「对话」页恒显示「还没有最近会话。点侧栏脚「云之家」打开一个。」。日程页正常、写确认流正常、agent 调 `yzj_im_group_recent` 工具卡也能出——唯独会话列表空。浏览器无报错，`error===''`（不是 RPC 失败）。

## 根因

两层叠加：

1. **提交的 `lib/` 是陈旧产物**（pitfall-016 的发布态变体）。`src/index.ts` 的 `bridgeResult` 早已改为 `return { ok: true, value: unwrapCli(result.json) ?? {} }`，但**仓库里 git 跟踪的 `lib/ui-yzj.mjs` 是更早一次构建的**——`git show HEAD:lib/ui-yzj.mjs | grep -c unwrapCli` 为 `0`。即：源码里的解信封修复从没被构建进随包发布的 host bundle。`im group recent` 的输出是 `{ data: { list: [...] }, identity, success: true }`（pitfall-003 的 data 信封），旧 bundle 未 `unwrapCli`，`/yzj` `groups` RPC 把整只 `{ data: {...} }` 原样回给浏览器。
2. **客户端解析只认顶层 `.list`**。`conv-list.tsx` 的 `parseRecentGroups` 读 `asRecord(value).list`；拿到 `{ data: { list } }` 时顶层无 `list` → 0 行 → 列表空（且 `error===''`，连报错都没有）。

浏览器侧 `window` 全局插桩证实：`fetchGroups` 返回 `{ok:true, value:{data:{count:4,list:[4]}}}`，`parsed.rooms.length===0`；host 侧插桩证实 `result.json` 有 `success:true`、`unwrapCli(result.json)` 展开成 `{count,list:[4]}`——**用当前源码重建 bundle 后 rooms 立刻变 4，列表铺满**。

## 解法

1. **发布产物必须随源码重建**：`lib/` 是 git 可装成品（见根 `.gitignore` 显式 unignore + docs/release.md「发布 = 构建 + tag」）。改了 host/browser 源后，产物要跟着构建提交，否则装 `github:...#tag` 的人拿到的是旧行为。构建口径见 pitfall-016：改 TS 先 `tsc -b`（本仓 tsc 因 harness 版本漂移会报错但仍 emit，可 `tsc -b --force` 后再 tsdown）再聚合 `tsdown` + `copy-client`。
2. **解析对 data 信封健壮**：`parseRecentGroups` 先剥一层可能残留的 `.data`（顶层无 `list` 但 `.data.list` 是数组时用 `.data`），与 tool-yzj `cliList`「同键在残留 .data 下」的容错对齐。即便未来某端点信封没被 `unwrapCli` 展开，会话列表也不再整列变空。

## 回归覆盖

流程 + 解析双坑。解析健壮性可加 `parseRecentGroups({data:{list:[...]}})` 单测断言 rooms 非空（与既有 `parseRecentGroups({list:[...]}})` 并列）。发布态陈旧只能靠真机走查暴露：登录 yzj-cli 后开工作台「对话」，会话列表应铺出 `im group recent` 的群（本次由真机截图 `conv-list-fixed.png` 的 4 行群 暴露并验证）。
