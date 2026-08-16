# 定时任务引擎选型与 yzj chatnode 投递（R2.7 调研结论）

> 调研对象（2026-08-16 实读源码）：
> [Jesse-njx/dsh-routines](https://github.com/Jesse-njx/dsh-routines)、
> [Jesse-njx/dsh-chatnode-wechat](https://github.com/Jesse-njx/dsh-chatnode-wechat)、
> [zxz9988/dsh-wechat-bridge](https://github.com/zxz9988/dsh-wechat-bridge)。
> 插件生态入口（"dsh find"）：[dsh-plugin-marketplace](https://github.com/YELEBAI/dsh-plugin-marketplace)
>（装进 DSH 的 UI 市场：设置 → 插件 → 插件市场；Registry 验证、精确 commit 安装）、
> [dsh-market](https://github.com/dsh-market/dsh-market)、
> [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)、
> [HubaKing/dsh-community-plugins](https://github.com/HubaKing/dsh-community-plugins)（市场注册成 skill）。

## 1. 为什么定时任务应该单独成插件

- harness 内置 `@deepseek-ai/dsh-schedule` 只为 **root agent**（config 创建的会话）挂载
  schedule 工具；程序化创建的非 root agent 拿不到（`unknown tool`，见
  `../pitfalls/pitfall-007`），把 harness 的 schedule 子系统硬挂到机器人会话上是
  逆着 harness 设计在走。
- 社区结论一致：**调度是独立关注点**。dsh-routines 把"排期 + 执行 + 投递"从任何
  会话里抽出来：routine 是 YAML（可提交可审计），每次到点起**独立 one-shot 会话**
  跑（完整会话日志 = 完整审计），digest 投递走抽象通道。dsh-wechat-bridge 则是
  **通道内嵌 cron**（`override.json` 的 `jobs[]`，热加载，结果走通道自己的流式链路）。

## 2. 两个参考实现的对比（实读源码结论）

| 维度 | dsh-routines | dsh-wechat-bridge |
|---|---|---|
| 形态 | 独立 bundle：store / scheduler / cli / run 四个插件 | 通道插件内的 cron jobs |
| 排期 | 5 段 cron + `@daily` + `every 4h`；`timezone` 显式 | 5 段 cron；`override.json` 热加载 |
| 执行 | **子进程** `dsh --profile <p> --patch <overlay> -- <prompt>`，approval 强制 `never`，`headless-runner` 行被替换成 run 驱动 | 通道自己的 agent 链路 |
| 审计 | 每次 run 独立会话日志 + `runs/<runId>.json` + digest.md | 普通会话流式链路 |
| 投递 | `file`（常开）+ `chatnode`（可选） | 只投到微信联系人 |
| 重叠/超时 | `overlap: skip/queue/cancel-previous`、`timeoutMin` 硬停（jobs.kill） | 未单独设计 |
| CLI | `dsh routines list/run/pause/resume/logs` | `/help /new /stop /status` |

### 2.1 关键契约：`ctx.chatnode`

dsh-routines 的投递契约极简（`src/types.ts`）：

```ts
interface ChatnodeService {
  send(input: { text: string; title?: string }): Promise<void>
}
// declare module '@deepseek-ai/cordis' { interface Context { chatnode?: ChatnodeService } }
```

调度器 `finalizeRun` 里 `ctx.get('chatnode')`，有则 `send({title, text})`，无则记录
`not-installed`，**投递失败绝不 crash 调度器**。

### 2.2 避坑清单（参考设计里实测/实读得出的）

1. **dsh-chatnode-wechat 没有实现 `ctx.chatnode`**：README 声称 chatnode 投递，但代码
   只提供 `ctx.wechat` 网关 + 会话节点，`send` 契约无人实现——**我们做 yzj chatnode
   就是生态里第一个真实实现**，必须自己补齐 module augmentation 与失败语义
   （投递异常被调度器吞掉并记入 `deliveries`，所以 send 内部要尽量自己兜住错误）。
2. **`chatnode` 同一 profile 只能有一个 provider**：Cordis 同名服务二次注册会 throw；
   微信节点与 yzj 节点不能共存于同一 profile（与 wechat "一账号一 poller" 同理）。
3. **dsh-routines 子进程启动在 Windows/tsx 环境的坑**：`realSpawn` 用
   `process.execPath <bin> --profile …` 直启，不带 `--import tsx/esm`——本仓库
   `apps/cli/src/bin.ts` 是 TS 入口，跑 routine 子进程必须配置 `dshBin`（指向可直启
   的入口）或 `DSH_BIN`；默认 run profile 是 `headless`，测试前需准备 headless
   profile（或每个 routine 显式 `profile:`）。
4. **调度器 tick 依赖 `loader.await()` 后才首跑**（避免与 jobs 控制器竞态）——
   测试时别在启动瞬间断言。
5. **dsh-wechat-bridge 的通道内嵌 cron 是另一条可行路**：不需要子进程/独立 profile，
   结果直接走通道现有链路（我们的 PushHub 正是这个链路）。若不想引入 dsh-routines，
   可仿它做 `robot-yzj` 内嵌 `jobs[]`（cron + 热加载 override.json）。本方案默认选
   dsh-routines 路线（审计与投递抽象更完整），内嵌路线作为备选记录。

## 3. 选定方案：dsh-routines + yzj chatnode（本仓库实现）

- 定时引擎：安装 dsh-routines（独立 bundle，进 `ops` profile 或 web profile 均可）；
- 投递：`robot-yzj` 提供 `ctx.chatnode` 服务——`send({text, title})` →
  `yzjRobot.notify(text, chatnodeRobotIndex)`（群机器人推群、个人机器人推 DM），
  `title` 作为首行前缀；实现见 `packages/robot-yzj/src/chatnode.ts`；
- 验收口径：routine 到点 → run 完成 → digest 经 chatnode 出现在群里
  （`[status] routine\n\ndigest` 形态），调度器 `deliveries` 记录 ok；
- 端到端验证脚本：`.acceptance/verify-routines-yzj.mjs`（待建）。

## 4. 决策表

| 决策 | 选择 | 理由 |
|---|---|---|
| 定时引擎 | 外部 dsh-routines（独立插件） | 社区已验证架构；审计/投递抽象完整；避免继续对抗 harness 对非 root agent 的限制 |
| 云之家投递 | 自研 `ctx.chatnode` 实现（本仓库） | 生态无人实现该契约；契约极小；复用 robot-yzj 现成出站 |
| chatnode 归属 | robot-yzj 包内（同一插件行提供） | 通道自包含；无需新增 bundle 行；与机器人生命周期一致 |
| 目标通道 | Config `chatnodeRobotIndex`（默认 0） | 群/个人机器人可配；与 notify 的 robotIndex 语义一致 |
| 与未来微信节点共存 | 文档禁止同 profile 双 chatnode | Cordis 同名服务冲突；与 wechat 单 poller 同理 |

## 5. 实测记录（2026-08-16，隔离 DSH_HOME `~/.dsh-test` 全链路）

**验收通过**：routine `c11-yzj`（`every 1m`，prompt=一句话回复）在 ops daemon 里被
调度器 tick 触发 → headless 子进程跑独立会话 → digest 产出 →
`ctx.chatnode.send` → robot 推送到「测试群」。群里实测收到：

```
dsh-routines: c11-yzj
[completed] c11-yzj
定时任务 chatnode 投递测试通过。
```

run 记录（`runs/<runId>.json`）：`trigger: schedule`、`status: completed`、
`deliveries: [{type: file, ok: true}, {type: chatnode, ok: true}]`；失败轮次如实
记录 `[failed] … (no digest)` 并推送到群（失败语义符合设计）。

### 5.1 实测踩坑（全部已绕过，写在这里避免重踩）

1. **web profile 会因 jobs 控制器缺失崩溃**：web-app 层禁用了 `tool-jobs`
   （模型面控件移到 preset 后），routines 调度器的 `ctx.jobs.start` 抛
   "background jobs unavailable" → tick 未捕获 → **整个 web 进程退出**。
   → 调度器必须跑在 base-only 的专用 profile（`ops` daemon）；web profile 里
   三行 routines 全部 `disabled: true`。
2. **routines-cli 与 web 应用抢命令行**：cli 插件注入 `cmdlineArgs` 并自行 parse，
   与 web 的 `--port` 冲突（`unknown option '--port'`）→ web profile 禁用
   `routines-cli`；CLI 从专用 profile 跑（`dsh --profile ops routines list`）。
3. **Windows + 源码布局的子进程启动**：默认 `dshBin`（`process.argv[1]` 为
   `apps/cli/src/bin.ts`）spawn 报 `EFTYPE`；`runModule` 裸 Windows 路径报
   `ERR_UNSUPPORTED_ESM_URL_SCHEME`；tsx 解析器对 cwd 敏感（cwd 不在 harness
   时 cordis 解析到错误副本）。解法：`dshBin` 指一个 re-spawn 包装
   （`node --import <tsx 绝对路径> <bin> <args>`，cwd=harness），`runModule`
   配 `file:///…/lib/run.js` 文件 URL。
4. **patch 新增行必须 `- insert:`**：`- id: robot-yzj name: …` 对不存在的行报
   `entry not found`（静默丢弃整行，后果是 chatnode 没装上且无报错迹象）。
5. **调度器 tick 首跑时机**：`every 1m` 的首次触发在启动后约 1 分钟（
   `nextAfter(base=now)` 严格大于 now），验证时别在启动瞬间断言。
