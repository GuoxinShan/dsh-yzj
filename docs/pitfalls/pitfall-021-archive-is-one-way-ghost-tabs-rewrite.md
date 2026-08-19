# pitfall-021：harness 归档是单向的，且旧 tab 会幽灵回写宿主状态

> 影响区域：任何想「从官方侧栏隐藏某类会话」的插件 / 验收纪律

## 复现条件

两条叠加才炸得出这次的全体感：

1. 用 `workspaces.archiveSession` 把 `yzj-home-*` 房间从官方侧栏隐藏。隐藏当时生效，但之后工作台/dock 再也无法打开该房间——`focusBoundSession` 的 `byId` 门槛等不到它。
2. 用户/同事的 Cursor、Chrome 里**还开着 3080 的旧 tab**（装着归档扫描器的旧 bundle）。把 `~/.dsh/storages/workspace.json` 的 `archivedSessionIds` 手工清干净、重启宿主，几秒后 17 个房间又被重新归档——旧 tab 的 client runtime 重连后收到 list 帧，扫描器照跑，`workspace.archiveSession` RPC 照发。宿主的写盘是 tmp+rename，`chmod 444` 也拦不住。

## 根因

- harness 的 archive 契约是**单向**的：`IWorkspaces` 只有 `archiveSession`，没有 unarchive（"a future unarchive" 注释 = 还没实现）；归档会话从客户端 session list 投影里消失，`open()` 路径走不通。官方语义就是「用户手动归档、不可恢复」，不是给插件当「按类型隐藏」用的。
- client bundle 以 `?rev=` 按内容寻址，但**已打开的 tab 不会自动换新 bundle**：旧 tab 里的常驻副作用（订阅 + RPC 写）在宿主重启后依然生效，且多 profile/多 tab 共享 `~/.dsh` 状态文件，看起来就像"宿主自己在写"。

## 解法

- 不用归档藏房间。v1.4 产品法（R20）改为：**根本不 `attachSession` 房间**——官方侧栏「云之家」只收话题；房间导航只在工作台。归档仍禁止当「按类型隐藏」用（单向、归档后打不开）。本条记录的是「曾经用归档硬藏」这条死路，不是现行做法。
- 验收纪律：凡客户端行为变更涉及**宿主状态写**，验收前必须确认没有旧 bundle 的活 tab（`lsof -iTCP:3080 | grep ESTABLISHED` 看非 playwright 连接）；本机状态修复要等宿主**进程真正退出**（`ps -p` 确认，不是端口释放）再改文件，否则退出 flush 会盖掉修复。

## 回归覆盖

无自动化（环境级坑）。排查手段固化在本条：`lsof -nP -iTCP:3080 | grep ESTABLISHED` 数活连接；`~/.dsh/storages/workspace.json` 的 `global.archivedSessionIds` 是归档集唯一落点。
