# pitfall-045: GUI 重启撞 credentials schema 冲突（旧 harness 扁平 vs 最新 harness v1 嵌套）

## 现象

按约定重启 web GUI（kill 旧进程 → `node apps/cli/lib/bin.js web --port 3080` 拉起）后 `:3080` 一直 000，boot 死在 plugin tree 加载。两种报错形态对应两种 build：

```
# 旧 build（pre-release 扁平 parser）：
credentials-local: the value for "version" in ~/.dsh/.credentials.yaml must be a string
# 最新 build（v1 parser，2026-08-25 v0.1.1-rc.2 亲测）：
credentials-local: ... declares version "1"; this build reads version 1
credentials-local: ... unknown top-level key "DEEPSEEK_API_KEY" in ...
```

旧进程明明跑得好好的——重启才炸。

## 根因（2026-08-25 修正版）

**是 harness 版本差，不是 desktop 乱写**。`~/.dsh/.credentials.yaml` 的合法格式随 harness 版本演进：

- **pre-release 扁平**：顶层 `KEY: "value"` 平铺（旧 build 的 parser，每个顶层 value 必须非空 string）；
- **v1 嵌套（现行）**：`version: 1`（数字，不带引号）+ `refs:` 二级映射嵌全部键值；只认 `version`/`refs`/`records` 三个顶层键，其余报 unknown key。

本机 harness checkout 更新到 `v0.1.1-rc.2+zw.1` 并重建 lib（2026-08-25）后，boot 读的是 v1 parser——而磁盘上的凭据文件还是为旧 build 压平的扁平格式，重启即撞。同一文件两天内「压平救活了旧 build、又毒死了新 build」的反复，根因都是 build 与文件格式不同步，而非写者冲突（初版根因归咎 desktop 重写嵌套是**错的**——desktop 写的 v1 嵌套本来就是最新 harness 的正确格式）。

## 解法

1. 重启前若 boot 报 credentials 解析错，**先确认 harness build 是哪代**（报 `must be a string` = 旧扁平 parser；报 `declares version`/`unknown top-level key` = v1 parser），再看文件结构（只打印键与值类型，绝不打印值——全是凭据）；
2. **v1（现行）迁移**：备份（`cp … .bak-日期`）后改成——`version: 1`（数字无引号）+ `refs:` 下按两空格缩进嵌全部 `KEY: "value"`；顶层不得再有裸键。v1 parser 还内置一次性自迁移：给它旧扁平文件会提示 `Add "version: 1" and nest the existing entries under "refs:"`；
3. **扁平压平的旧解法已作废**——压平对 v1 build 是毒药。harness 保持在远端最新版（本仓约定），文件保持 v1，此后两边稳定不再复发；若再报扁平 parser 的错，说明 lib 是旧构建，先重建 harness 再说文件。
4. 与 pitfall-002 同族的教训仍然成立：运行中进程的健康不代表磁面状态可重启；但更前一条是——**改机器级共享文件的格式前，先确认读它的 build 版本**。

## 回归覆盖

2026-08-24 泳道验收前首次遭遇（旧 build，压平修复，备份 `.bak-20260824`）；2026-08-25 harness 更新至 `v0.1.1-rc.2+zw.1` + lib 重建后二次遭遇（新 build），按 v1 嵌套迁移修复；修复后 GUI 200 + `verify-todo-swimlane.mjs` 21 检查点 ALL PASS。harness 现行版本与 `~/.dsh/.credentials.yaml` v1 格式已对齐。
