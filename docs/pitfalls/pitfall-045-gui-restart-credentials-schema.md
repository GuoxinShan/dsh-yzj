# pitfall-045: GUI 重启撞 credentials schema 冲突（desktop 嵌套 vs CLI 扁平）

## 现象

按约定重启 web GUI（kill 旧进程 → `node apps/cli/lib/bin.js web --port 3080` 拉起）后 `:3080` 一直 000，boot 死在 plugin tree 加载：

```
credentials-local: the value for "version" in ~/.dsh/.credentials.yaml must be a string
# 修掉 version 后下一颗：
credentials-local: the value for "refs" in ~/.dsh/.credentials.yaml must be a string
```

旧进程明明跑得好好的——重启才炸。

## 根因

`~/.dsh/.credentials.yaml` 是**两个写者共享**的机器级文件：CLI（credentials-local）的 parser 要求**扁平严格映射**（每个顶层 value 必须是非空 string）；而 dsh-desktop 运行时会把它重写成**嵌套 schema**（`version:` 数字 + `refs:` 二级映射）。旧 GUI 进程启动时文件还是扁平的（boot 一次性读入后不再碰），desktop 在之后某个时刻改写为嵌套——于是「正在跑的 GUI」与「能启动的 GUI」脱节，重启即撞。教训与 pitfall-002 同族：运行中进程的健康不代表磁面状态可重启。

## 解法

1. 重启 GUI 前若 boot 报 credentials 解析错，先看文件**结构**（只打印键与值类型，绝不打印值——这文件全是凭据）；
2. 修复 = 备份（`cp … .bak-日期`）后**压平**：`version` 加引号成字符串，`refs:` 下的嵌套键逐条提升为顶层 `key: "value"`（值统一双引号包裹；键须匹配 POSIX 标识符 `[A-Za-z0-9_.-]+`，否则 parser 同样拒）；
3. 压平后 GUI 即刻可起；**desktop 运行时在屏期间会再次重写为嵌套（同日两次重启两次中招）**——GUI 迭代验收的节奏里，重启前顺手重跑一遍压平即可；治本要 harness 侧两 schema 对齐（desktop 与 CLI checkout 版本偏斜），超出本仓边界。

## 回归覆盖

2026-08-24 泳道验收前真机遭遇并修复（备份 `.bak-20260824` 留在 `~/.dsh/`）；修复后 GUI 200 + `verify-todo-swimlane.mjs` / `verify-advance-loop.mjs` 全绿。
