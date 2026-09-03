# dsh-yzj — 云之家 × DeepSeek Harness 插件

将云之家（Yunzhijia）搬进 DeepSeek Harness：`yzj-cli` 桥接、六域模型面工具（含写入确认流）、以及一套 **IM 壳**（助手单聊 + 人群房间）。待办与 AI推进已从本公开仓撤出。

独立 bundle，经 `dsh plugin --profile <name> add` 安装，不修改 harness 本体。

**产品法（v3.0）**：[IM 壳](docs/spec/im-shell.md)——助手是用户定义的 1..N 条特殊单聊（出厂「助手」），不是一群一机器人。云之家群和同事私信是人群房间。用户看不见 workspace / 文件夹树 / New Session / DSH session id。IM 只渲染模型 `present` 出的气泡和既有 yzj 写确认卡；轨迹在隐藏 session 里，弱化「查看过程」。群 `@助手` 不发云之家，锚在被回复的 `msgId` 下（只你可见）。对照 [gap-analysis §25](docs/status/gap-analysis.md)。

## 包结构

| 包 | 角色 | 说明 |
|---|---|---|
| [`packages/bridge`](packages/bridge/README.md) | `@dsh-yzj/bridge` → `ctx.yzjBridge` | 有界子进程通道：argv 数组直启 `yzj-cli` |
| [`packages/tool-yzj`](packages/tool-yzj/README.md) | `@dsh-yzj/tool-yzj` | 六域 `yzj_*` 工具 + **`present`** + `ctx.yzjAssistants`（助手目录 / IM 投影）+ `ctx.yzjHome` 人群房间日志 |
| [`packages/ui-yzj`](packages/ui-yzj/README.md) | `@dsh-yzj/ui-yzj` | `/yzj` RPC；浏览器 IM 壳（收件箱 + 助手 DM + 人群房间）+ 确认卡 |
| [`packages/model-yzj`](packages/model-yzj/README.md) | `@dsh-yzj/model-yzj` | 插件级默认模型路由 |
| **根 = `@dsh-yzj/bundle`** | profile patch | tsdown 聚合 host half + `lib/client.js` |

## 安装

```sh
pnpm dsh plugin --profile web add -w link:<本仓库路径>
dsh plugin --profile web add github:GuoxinShan/dsh-yzj#v0.1.0
```

安装后重启 GUI。侧栏 workspaces 区域是 IM 收件箱；中间是助手 DM 或人群房间。日程 / 知识库走助手 composer `+` 或设置，不是首页页签。

## 功能面

- **助手 DM**：发给助手 → 隐藏 session 串行 followup → `present` 气泡 + 写确认卡。
- **人群房间**：`home-send` 以本人身份发群（无确认卡）。回复 + `@助手` = 本地线程，不发云之家。
- **yzj_***：doc / sheet / calendar / contact / im / file 六域；agent 写走确认卡。
- **whoami**：yzj-cli 0.1.6 `{success, identity, data}`，不要假定顶层 openId。

## 开发

```sh
pnpm install
pnpm --filter @dsh-yzj/tool-yzj --filter @dsh-yzj/ui-yzj typecheck
pnpm --filter @dsh-yzj/tool-yzj --filter @dsh-yzj/ui-yzj test
pnpm --filter @dsh-yzj/ui-yzj bundle   # 改 browser half 后
```

改 UI 后重建 bundle 并重启 GUI。
