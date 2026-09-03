# dsh-yzj — 云之家 × DeepSeek Harness 插件

将云之家（Yunzhijia）的全部 CLI 能力搬进 DeepSeek Harness：`yzj-cli` 桥接、六域模型面工具（含写入确认流）、以及一套为云之家设计的浏览器 UI（工具结果富卡片 + 云之家工作台面板）。待办与 AI推进已从本公开仓撤出（完整实现在私有归档 GuoxinShan/dsh-yzj-archive）。

独立仓库的 bundle 包，通过 `dsh plugin --profile <name> add <package>` 安装，不修改 harness 本体。

**产品法（v2.0 已拍板）**：[群房间 + 话题会话](docs/spec/group-room-topics.md)——1 云之家群 = 1 群房间 + N 话题。群房间发送 = 发进群；话题发送 = 问助手。入站 `@` / 「交给助手」锚出 `yzj-topic-*`。**话题 job-done（R29）**：一轮结束后以 CLI 本人身份把总结回帖到云之家锚点，并带上本轮产物。对照 [gap-analysis §23](docs/status/gap-analysis.md)。v1.x 1:1 融合一条流见 [dsh-home-session.md](docs/spec/dsh-home-session.md) 历史快照。

## 包结构

| 包 | 角色 | 说明 |
|---|---|---|
| [`packages/bridge`](packages/bridge/README.md) | `@dsh-yzj/bridge` → `ctx.yzjBridge` | 有界子进程通道：argv 数组直启 `yzj-cli`，无 shell 插值；复用机器上 `yzj-cli auth login` 的登录态与 keychain 凭据，harness 全程不接触 appSecret/accessToken |
| [`packages/tool-yzj`](packages/tool-yzj/README.md) | `@dsh-yzj/tool-yzj`（ 注册到 `ctx.tools`） | 53 个模型面工具：doc（21）/ sheet（10）/ calendar（7）/ contact（3）/ im（10）/ file（2）；每个工具输出 有界 digest，并把裁剪后的结构化载荷经 `output.presentationMeta` 投影给 UI；**`ctx.yzjHome`** 绑定表 + **绑定消息日志**（`yzj_home_logs`，①② 不是 Session.append） |
| [`packages/ui-yzj`](packages/ui-yzj/README.md) | `@dsh-yzj/ui-yzj`（`dsh.client` 双面包） | node half：`/yzj` Connection RPC 通道（含 `home-open` / `home-send` / `home-fused` / `im-cache-*`）；browser half：「新建会话」下一个「云之家」入口 + 中间栏工作台盖层（顶栏页签切对话 / 日程 / 知识库；对话域 = 会话列表 \| 群房间时间线）+ 群房间「发进群」+ **设置 → 云之家**（仅登录卡；话题 / 机器人 / 记忆 / 丢进群 / 待办 / 推进已退役） |
| [`packages/model-yzj`](packages/model-yzj/README.md) | `@dsh-yzj/model-yzj` → `ctx.yzjModels` | 插件级默认模型（`~/.dsh/yzj-model.json`，明文热生效）：robot 模型解析链尾部（会话覆盖 > 机器人配置 > 通道默认 > **插件默认** > harness 默认）与 dream 执行器共用；`catalog()` 提供活跃路由的 provider/model 目录（面板选择器数据源） |
| **根 = `@dsh-yzj/bundle`**（monobundle） | 可安装的 profile patch 层（`cordis.patch.yml` 在根，行名 `@dsh-yzj/bundle/<row>`） | tsdown 聚合六包 host half 进 `lib/*.mjs`（互依内嵌、`@deepseek-ai/*` 外部化）+ `scripts/copy-client.mjs` 搬运 ui-yzj closure bundle 为 `lib/client.js`；`dsh.bundle` + `dsh.client` 声明；发布 = 构建 + tag（见 [docs/release.md](docs/release.md)） |

## 安装

```sh
# 本机开发（harness checkout 下）：
pnpm dsh plugin --profile web add -w link:<本仓库路径>

# 对外安装（GitHub，monobundle 后一行可装）：
dsh plugin --profile web add github:GuoxinShan/dsh-yzj#v0.1.0
```

安装后重启 GUI（源码启动时重启 `node --import tsx/esm apps/cli/src/bin.ts web`），侧栏脚出现一个「云之家」入口；点开工作台后用顶栏页签切对话 / 日程 / 知识库（记忆入口搁置）。

### 前置：yzj-cli（云之家 CLI）

bridge 直启的 `yzj-cli` 来自 npm **`@yunzhijia/cli`**（该包 `bin` 即 `yzj-cli`）。装它并登录后本插件的工具才有真实数据：

```sh
npm i -g @yunzhijia/cli   # 提供 yzj-cli 可执行文件（也可 pnpm add -g）
yzj-cli auth login        # 浏览器授权；无浏览器环境（SSH / CI / Cloud Agent）加 --device 走设备码
yzj-cli whoami            # 验证登录态
```

登录态存机器级 `~/.yzj-cli/config.json`（+ 系统钥匙串）；DSH 与 harness 全程不接触 appSecret/accessToken——bridge 只 spawn CLI 复用其登录态。未装/未登录时工具降级：面板显示「未登录」并回显 CLI 的 `credentials_missing` 提示（此时只读 bash 兜底可用，写操作仍必须走 `yzj_*` 工具确认卡）。CLI 不在 PATH 时，用 bridge 的 `binary` 配置指向其绝对路径。

> 本地开发用 `link:` 依赖指向 harness checkout；对外安装走 monobundle + git tag
> （根包依赖已全部指向 registry 的 `@deepseek-ai` rc.7 系列，见 docs/release.md）。

## 功能面

- **doc**：知识库列表/详情/新建、文档树浏览、文档详情、最近文档、创建/新建文件夹/重命名/移动/删除、导入（md inline / 文件 reference）、下载链接、块级 list/insert/update/delete
- **sheet**：多维表格创建、schema 读取（含 `--lite`）、数据表 get/create/rename/delete、记录 list（筛选/搜索/分页）/create/update/delete
- **calendar**：日程 list/get/create/update/delete（软取消或硬删）、参会人、空闲会议室
- **contact**：whoami（顶层 `yzj-cli whoami`）、通讯录搜索、用户详情
- **im**：发消息（text/file/richText、@、回复、多图）、撤回、聊天记录、消息搜索、最近会话、群搜索/创建/改名/成员
- **file**：上传（≤30MB、最多 5 并发）、下载（自动重命名 / 覆盖）

### 确认流（确认卡）

全部 31 个写工具按风险分级在 `tools/pre-execute` 走 `yzj/confirm-request` 自托管确认（标准确认 / 强确认；**不** return harness `ask`，GUI Full access 仍弹卡），由 host 侧 `write-gate` 应答后，在浏览器渲染**按 domain 分发的确认卡**：参数全文（消息目标/文档落位/记录内容/日程时间等，不折叠截断；目标以解析后的名称展示，ID 不再裸露）、风险徽标（删除类强确认红色卡片）、四动词（确认 / 取消 / 查看上下文 / 编辑）。`查看上下文` 打开面板并锚定对应 tab/消息（卡片↔面板双向跳转）；终态由官方工具事件承载（回放安全）。覆盖：`doc`（含 workspace/folder/rename/move/import/write/download/block）、`sheet`（含 table/record）、`calendar`、`im`（message send/recall / group create/rename / members）、`file upload/download`。

**写路径两分（已拍板，见 [dsh-home-session.md](docs/spec/dsh-home-session.md) §8 / group-room-topics R6）**：确认卡门控的是 **agent 发起的写**；**用户从 DSH 发出**（群房间「发进群」）即用户本人意志，不经确认卡。删除类强确认。面板不再提供第二套 IM 发送。

## 与 yzj-cli skill 的关系

本公开仓**不**随包重写官方 skill（`packages/bundle/skills/yzj-cli/SKILL.md` 已不存在，不要重建）。目标 CLI 是 npm `@yunzhijia/cli` **0.1.6**（skill catalog **0.6.0**）。官方 skill 会引导 bash 直调 `yzj-cli` 写命令——那会绕过 DSH 确认卡。本仓红线写在这里，不靠覆盖官方 skill 文件：

- **红线**：写操作必须走 `yzj_*` 工具（确认卡门控）；**禁止 bash 直调 `yzj-cli` 执行写命令**。`--yes` 只在产品确认卡通过后由工具透传（删除族）；`im message recall` / `im group rename` / `doc folder create` 的 CLI 没有 `--yes`，闸只在确认卡。
- 仅当工具不可用（未登录、CLI 缺失、权限错误）时，bash 兜底只允许只读命令；
- 保留官方红线：禁止编造 ID、写前先查、删除类复述目标。

### UI 设计

- **工具结果富卡片**：`tool.call.toolview` keyed 注册全部 53 个工具名。pending 态从参数渲染标题；settled 态优先渲染结构化 `meta`（文档详情/列表、数据表 schema、记录表、日程时间线、消息气泡、联系人卡片），无结构时回退到 digest 文本。失败态显示错误摘要。
- **云之家工作台**：侧栏脚一个「云之家」入口 → 工作台。三域用顶栏页签切（对话 / 日程 / 知识库）。对话页签 = 会话列表 + 群房间时间线；日程 / 知识库 embed 原面板（记忆入口搁置，vault 仍是本地不出本机）。悬浮球已退役。群房间与话题见 [group-room-topics.md](docs/spec/group-room-topics.md)，对照 gap §23。

## 开发

```sh
pnpm install          # link 依赖指向 ../deepseek-harness（相对路径，可移植）
pnpm -r --sort build  # 全仓构建（tsc + tsdown）
pnpm test             # vitest：bridge 单测 + 工具真实 CLI 冒烟 + 浏览器组件测试
pnpm --filter @dsh-yzj/ui-yzj bundle   # 仅重建客户端 bundle（改 UI 后）
```

改了客户端 UI 后需重建 bundle 并重启 GUI（web profile 的 `hmr` 在 web-app 层被禁用）。浏览器验收脚本见 `.acceptance/`（`verify-real-data.mjs` 需已登录的 yzj-cli，`verify-windows.mjs` 验证无 CLI 降级）。

## 已知限制

- **依赖解析**：workspace 六包以 `link:` 相对路径依赖兄弟 `../deepseek-harness` checkout（开发事实源，不替换）。对外 `dsh plugin add github:…#tag` 走根 `@dsh-yzj/bundle`，其 `@deepseek-ai/*` 已是 registry 版本范围（见 `docs/release.md`）。
- **确认卡状态不落会话日志**：harness 对外部插件的自定义 session 事件类型无注册面，确认卡 pending/approved 瞬态由 host 内存表承载（SPA 刷新存活；host 重启降级为普通工具卡），终态由官方工具事件回放。
- **面板「我的」tab 已移除**（原设计四 tab）：身份经 `yzj_whoami`、找人经 @ 候选。
- **拖入云之家引用已退役**：悬浮窗时代的全屏 drop overlay / ☁ chip 已卸；@ 候选源保留。
- **会话家园 v2.0**：群房间 + 话题（`yzj-home-*` / `yzj-topic-*`）；官方 Chat tab 仍并存。官方侧栏「云之家」只收话题（群聊长出的 agent session），群聊本身不进该分组。IM 工作台只服务 `yzj-home-*`：话题/普通会话打开官方 Chat（残留 `view=yzj-home` 会点「对话」拨回）。**点群只切 groupId，不建/不 focus DSH 会话**（R24）；挂钩座位最多一条，未分组不随点群增生。切房间分阶段不闪「私密会话」/上一群。旧宿主 ③④ 打开时迁成「历史对话」话题（不搬事件）。**话题问助手一轮结束后，总结回帖到云之家锚点（R29，本人身份，可带产物）**；不是每条助手气泡都回群。仍开放：确认卡 pending 不进 session 日志、工作台挑群无搜索框（[gap-analysis §22](docs/status/gap-analysis.md) G3/G5）。
- **工作台挑群无搜索框（G5）**：模型面已有 `yzj_im_group_search`（0.1.4）与 `yzj_im_message_search`（0.1.6）；工作台会话列表仍靠最近会话翻页，没有搜索输入（gap §22 G5）。
- **`file download` 只回传摘要**：CLI 的 `downloaded N bytes to <path>` 文本输出不携带结构化路径，卡片回退文本模式。
- **文件夹节点**：0.1.6 `doc folder create` 是独立命令（`--help` 实测），封装为 `yzj_doc_folder_create`。Skill 0.6.0 仍写「文件夹=父文档」——以 CLI 为准。

## 许可

[MIT](LICENSE)。`package.json` 的 `license` 字段与之一致。
