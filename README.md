# dsh-yzj — 云之家 × DeepSeek Harness 插件

将云之家（Yunzhijia）的全部 CLI 能力搬进 DeepSeek Harness：`yzj-cli` 桥接、六域模型面工具（含写入确认流）、以及一套为云之家设计的浏览器 UI（工具结果富卡片 + 云之家工作台面板）。

独立仓库的 bundle 包，通过 `dsh plugin --profile <name> add <package>` 安装，不修改 harness 本体。

**产品法（v2.0 已拍板）**：[群房间 + 话题会话](docs/spec/group-room-topics.md)——1 云之家群 = 1 群房间 + N 话题。群房间发送 = 发进群；话题发送 = 问助手。入站 `@` / 「交给助手」锚出 `yzj-topic-*`。对照 [gap-analysis §23](docs/status/gap-analysis.md)。v1.x 1:1 融合一条流见 [dsh-home-session.md](docs/spec/dsh-home-session.md) 历史快照。

## 包结构

| 包 | 角色 | 说明 |
|---|---|---|
| [`packages/bridge`](packages/bridge/README.md) | `@dsh-yzj/bridge` → `ctx.yzjBridge` | 有界子进程通道：argv 数组直启 `yzj-cli`，无 shell 插值；复用机器上 `yzj-cli auth login` 的登录态与 keychain 凭据，harness 全程不接触 appSecret/accessToken |
| [`packages/tool-yzj`](packages/tool-yzj/README.md) | `@dsh-yzj/tool-yzj`（注册到 `ctx.tools`） | 45 个模型面工具：doc（16）/ sheet（10）/ calendar（7）/ contact（3）/ im（3）/ file（2）/ **todo（4）**；每个工具输出有界 digest，并把裁剪后的结构化载荷经 `output.presentationMeta` 投影给 UI；todo 核心同时以 `ctx.yzjTodo` 服务暴露给浏览器面；**`ctx.yzjHome`** 绑定表 + **绑定消息日志**（`yzj_home_logs`，①② 不是 Session.append） |
| [`packages/ui-yzj`](packages/ui-yzj/README.md) | `@dsh-yzj/ui-yzj`（`dsh.client` 双面包） | node half：`/yzj` Connection RPC 通道（含 `home-open` / `home-topic-open` / `home-send` / `home-fused` / `home-handoff`）；browser half：侧栏脚「云之家」入口块 + `conversation.view` 工作台（会话列表 \| 群房间时间线 + 话题抽屉；待办/日程/知识库/记忆迁入中栏）+ composer takeover「发进群」+ 话题锚点卡 / 未绑定「丢进群」+ **设置 → 云之家**（机器人/记忆管理） |
| [`packages/robot-yzj`](packages/robot-yzj/README.md) | `@dsh-yzj/robot-yzj` → `ctx.yzjRobot` | 机器人双向通道（R2.x host 面，设计见 [docs/spec/robot-channel-plan.md](docs/spec/robot-channel-plan.md)）：实测协议 WS 入站 + sendMsgUrl 出站；入站 `followup()` 打该云之家会话的**绑定 DSH 家园**（`yzj-home-*`，不是隐藏 `yzj-robot-*`）；ack-then-push；bang 命令族含 `!fork`（打开/恢复目标群绑定会话，不开新根）+ `!feedback`；**DSH→机器人双向控制**：`robot_status` / `robot_notify` / `robot_continue` / `robot_fork`（resume 绑定会话）/ `robot_share_*`；**chatnode 桥**见 [routines-delivery.md](docs/spec/routines-delivery.md) §3.1 |
| [`packages/memory-yzj`](packages/memory-yzj/README.md) | `@dsh-yzj/memory-yzj` → `ctx.yzjMemory` | 记忆库组件（设计见 [docs/spec/memory-vault-design.md](docs/spec/memory-vault-design.md)）：明文 Markdown vault（sections/entities/observations + log/index，默认 `$DSH_HOME/yzj-memory`，按 `user`/`group:<id>` scope 分仓）；5 个 `memory_*` 工具（observe/read/search/dream_load/dream_apply）；`systemPrompt.context` 有界注入（每 scope `inject_char_cap`，默认 6000）；**dream 固化默认关闭**——`dream.json` 运行时开关（面板可翻）+ 每日 `dailyAt` 进程内定时 + 「立即固化」，模型链＝dream 配置 > 插件默认 > harness 默认，rev 乐观锁保护人工编辑；`group:<id>` scope 留缝群组记忆 |
| [`packages/model-yzj`](packages/model-yzj/README.md) | `@dsh-yzj/model-yzj` → `ctx.yzjModels` | 插件级默认模型（`~/.dsh/yzj-model.json`，明文热生效）：robot 模型解析链尾部（会话覆盖 > 机器人配置 > 通道默认 > **插件默认** > harness 默认）与 dream 执行器共用；`catalog()` 提供活跃路由的 provider/model 目录（面板选择器数据源） |
| **根 = `@dsh-yzj/bundle`**（monobundle） | 可安装的 profile patch 层（`cordis.patch.yml` 在根，行名 `@dsh-yzj/bundle/<row>`） | tsdown 聚合六包 host half 进 `lib/*.mjs`（互依内嵌、`@deepseek-ai/*` 外部化）+ `scripts/copy-client.mjs` 搬运 ui-yzj closure bundle 为 `lib/client.js`；`dsh.bundle` + `dsh.client` 声明；发布 = 构建 + tag（见 [docs/release.md](docs/release.md)） |

## 安装

```sh
# 本机开发（harness checkout 下）：
pnpm dsh plugin --profile web add -w link:<本仓库路径>

# 对外安装（GitHub，monobundle 后一行可装）：
dsh plugin --profile web add github:GuoxinShan/dsh-yzj#v0.1.0
```

安装后重启 GUI（源码启动时重启 `node --import tsx/esm apps/cli/src/bin.ts web`），侧栏脚出现「云之家」入口块（对话 / 待办 / 日程 / 知识库 / 记忆）。

> 本地开发用 `link:` 依赖指向 harness checkout；对外安装走 monobundle + git tag
> （根包依赖已全部指向 registry 的 `@deepseek-ai` rc.6 系列，见 docs/release.md）。

## 功能面

- **doc**：知识库列表/详情/新建、文档树浏览、文档详情、最近文档、创建/重命名/移动/删除、导入（md inline / 文件 reference）、下载链接、块级 list/insert/update/delete
- **sheet**：多维表格创建、schema 读取、数据表 get/create/rename/delete、记录 list（筛选/搜索/分页）/create/update/delete
- **calendar**：日程 list/get/create/update/delete（软取消或硬删）、参会人、空闲会议室
- **contact**：whoami、通讯录搜索、用户详情
- **im**：发消息（text/file/richText、@、回复、多图）、聊天记录、最近会话
- **file**：上传（≤30MB、最多 5 并发）、下载（自动重命名 / 覆盖）
- **todo**：语义化待办工具族（demo 阶段以多维表格「待办任务库」承载，首用自动开通）——`yzj_todo_list/create/update/complete`；稳定 ID 幂等、host 强制状态机、追加式推进日志；**核心理念 tag 自由聚合**（tag 可以是项目/群组/主题）；**团队协作**：面板任务库切换器一键切换个人/团队库或按需在企业知识库开通（权限标注），agent 写入跟随当前激活库，浏览器持久化选择；后端迁移架构见 `docs/migration/todo-backend-migration.md`
- **memory**：明文 Markdown 记忆库（`@dsh-yzj/memory-yzj`，设计见 `docs/spec/memory-vault-design.md`）——`memory_observe/read/search/dream_load/dream_apply` 五工具 + `systemPrompt.context` 有界注入；管理面在 **设置 → 云之家 · 记忆库**（sections/entities 展开、观察草稿区、注入统计、dream 固化日志、直写「记一条」、**dream 开关/每日时间/模型选择/立即固化、插件默认模型设置**）；dream 固化**默认关闭**（`dream.json` 运行时开关），开启后每日定时或手动触发，模型链＝dream 配置 > 插件默认（`@dsh-yzj/model-yzj`，robot 通道同用）> harness 默认；rev 乐观锁保护人工编辑；`group:<id>` scope 留缝群组记忆；dsh-routines routine 为备选路径（模板 `docs/spec/memory-dream-routine.yaml`）
- **定时任务（无人值守）**：外部引擎 **dsh-routines**（专用 `ops` daemon profile，官方推荐形态）+ 自研 `ctx.chatnode` 投递——digest 经 **chatnode 桥**（`POST /yzj/chatnode`，loopback + Bearer 口令）由 web profile 的机器人通道推送进群，ops 侧不持任何机器人凭据（架构/决策/生产布局见 `docs/spec/routines-delivery.md`）；routine 为 YAML（`~/.dsh/routines/*.yaml`），到点起 headless 子进程独立会话，审计完整（`runs/<runId>.json` + digest）；生产部署：`start-prod.cmd` 统一入口 + 登录自启 ops daemon（幂等防双跑）

### 确认流（确认卡）

全部 25 个写工具按风险分级在 `tools/pre-execute` 返回 `ask`（标准确认 / 强确认），由 host 侧 `write-gate` 应答 `approval/request` waterfall 后，在浏览器渲染**按 domain 分发的确认卡**：参数全文（消息目标/文档落位/记录内容/日程时间/待办字段等，不折叠截断；目标以解析后的名称展示，ID 不再裸露）、风险徽标（删除类强确认红色卡片）、四动词（确认 / 取消 / 查看上下文 / 编辑）。`查看上下文` 打开面板并锚定对应 tab/消息（卡片↔面板双向跳转）；终态由官方工具事件承载（回放安全）。覆盖：`doc`（含 workspace/rename/move/import/block）、`sheet`（含 table/record）、`calendar`、`im message send`、`file upload/download`、`todo` 全部写操作。

**写路径两分（已拍板，见 [dsh-home-session.md](docs/spec/dsh-home-session.md) §8 / group-room-topics R6）**：确认卡门控的是 **agent 发起的写**；**用户从 DSH 发出**（群房间「发进群」、待办勾选/新建）即用户本人意志，不经确认卡。删除类强确认。面板不再提供第二套 IM 发送。

## 与 yzj-cli skill 的关系

bundle 交付**改造版 skill**（`packages/bundle/skills/yzj-cli/SKILL.md`），安装到 `~/.agents/skills/yzj-cli/`（覆盖官方原版前请先备份；本机已备份为 `SKILL.md.orig`，`references/` 保留官方细节）：

- **红线**：写操作必须走 `yzj_*` 工具（确认卡门控）；**禁止 bash 直调 `yzj-cli` 执行写命令**——官方原版 skill 会引导模型绕过确认卡直发消息（已真实复现并封堵，见 gap 文档验证证据）；
- 仅当工具不可用（未登录、CLI 缺失、权限错误）时，bash 兜底只允许只读命令；
- 保留官方红线：禁止编造 ID、写前先查、删除类复述目标。

### UI 设计

- **工具结果富卡片**：`tool.call.toolview` keyed 注册全部 45 个工具名。pending 态从参数渲染标题；settled 态优先渲染结构化 `meta`（文档详情/列表、数据表 schema、记录表、日程时间线、消息气泡、联系人卡片、待办列表/动作摘要），无结构时回退到 digest 文本。失败态显示错误摘要。
- **云之家工作台**：侧栏脚「云之家」入口块 → 工作台三栏。对话域 = 会话列表 + 群房间时间线 + 话题抽屉；待办 / 日程 / 知识库 / 记忆迁入中栏（记忆是本地 vault，不出本机）。悬浮球已退役。群房间与话题见 [group-room-topics.md](docs/spec/group-room-topics.md)，对照 gap §23。

## 开发

```sh
pnpm install          # link 依赖指向 ../deepseek-harness（相对路径，可移植）
pnpm -r --sort build  # 全仓构建（tsc + tsdown）
pnpm test             # vitest：bridge 单测 + 工具真实 CLI 冒烟 + 浏览器组件测试
pnpm --filter @dsh-yzj/ui-yzj bundle   # 仅重建客户端 bundle（改 UI 后）
```

改了客户端 UI 后需重建 bundle 并重启 GUI（web profile 的 `hmr` 在 web-app 层被禁用）。浏览器验收脚本见 `.acceptance/`（`verify-real-data.mjs` 需已登录的 yzj-cli，`verify-windows.mjs` 验证无 CLI 降级）。

## 已知限制

- **依赖解析**：各包以 `link:` 相对路径依赖 harness checkout（`../../../deepseek-harness/...`）；发布前需替换为已发布的版本范围并验证 `dsh plugin add` 从 registry 安装。
- **确认卡状态不落会话日志**：harness 对外部插件的自定义 session 事件类型无注册面，确认卡 pending/approved 瞬态由 host 内存表承载（SPA 刷新存活；host 重启降级为普通工具卡），终态由官方工具事件回放。
- **面板「我的」tab 已移除**（原设计四 tab）：身份经 `yzj_whoami`、找人经 @ 候选；第四 tab 现为**待办**（是否另恢复通讯录浏览待拍板）。
- **拖入即处理快捷动作已移除**：现为全屏 drop overlay 直接成 chip（v1.6 硬性要求 4 曾实现后删除，终局与否待拍板）。
- **会话家园 v2.0**：群房间 + 话题（`yzj-home-*` / `yzj-topic-*`）；官方 Chat tab 仍并存。切房间分阶段不闪「私密会话」/上一群。仍开放：确认卡 pending 不进 session 日志、无群搜索、既有宿主 ③④ 历史迁移（[gap-analysis §23](docs/status/gap-analysis.md) H9，§22 G3/G5）。
- **无群搜索/消息搜索**：沿用 CLI 能力面（最近会话翻页定位）。会话家园的「挑群」依赖可找到群（gap §22 G5）。
- **`file download` 只回传摘要**：CLI 的 `downloaded N bytes to <path>` 文本输出不携带结构化路径，卡片回退文本模式。
- **待办为 demo 阶段**：数据存于多维表格「待办任务库」（个人知识库，首用自动开通）；负责人/标签因 CLI 字段写入限制降级为文本形态；原生后端迁移方案见 `docs/migration/todo-backend-migration.md`。
- **无独立文件夹概念**：归类用父文档挂载，与云之家产品语义一致。
