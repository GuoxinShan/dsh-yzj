# AGENTS.md

dsh-yzj 是 DeepSeek Harness 的独立插件 bundle 仓库：`yzj-cli` 桥接、六域 + todo 的模型面工具族（写确认流）、云之家浏览器 UI（富卡片 + 工作台面板）。一切能力经 Cordis 插件交付——bridge 提供服务、tool-yzj 注册工具、ui-yzj 双面呈现、bundle 挂成 profile patch 层；不修改 harness 本体。**动手前先读 [docs/README.md](docs/README.md)（文档索引与阅读顺序）**；实现与设计的分歧记录在 [docs/status/gap-analysis.md](docs/status/gap-analysis.md)。

## Spec-driven：文档就是仓库的主体

**本仓库由 agent 维护、面向 agent 消费——不会有任何人类阅读这里的代码。** 一切设计、决策与知识都以文档形态沉淀，代码只是文档的机器执行形式。由此推出 agent 的硬性义务：

1. **文档先于代码**：新功能先在 `docs/` 落设计（目标、契约、验收口径），再写实现；实现过程中设计变更，**先改文档再改代码**，同一提交。
2. **文档即接口**：下一个读这个仓库的是另一个 agent，它以 `docs/` 为首要输入。文档陈旧 = 下一个 agent 必然做错。每个提交自问：「只读 docs/ 的人（agent）能准确重建当前系统的行为吗？」不能，就补。
3. **docs/ 目录义务**（职责与阅读顺序见 [docs/README.md](docs/README.md)，改动对应面时同提交更新）：
   - `spec/` — 设计基线：`integration-master-plan.md`（整体方案/验收基准）、`todo-design.md`（todo 域 + §11.2 决策表）、`robot-channel-plan.md`（机器人通道调研）；
   - `migration/` — 架构演进：`todo-backend-migration.md`（demo→原生后端分层 + §3 实测格式事实）；
   - `status/` — `gap-analysis.md`：设计×实现分歧与验收证据，**每个功能提交都应在此留痕**；
   - `pitfalls/` — 踩坑库（见 Conventions「踩坑记录制度」）。
4. **决策必须留档**：拍板（设计取舍、风险分级、命名）写进对应设计文档的决策表，附理由；不允许只存在于提交信息或对话里的决策。
5. **不写无人维护的文档**：文档要么随代码演进，要么删掉；「大概如此」的描述比没有更糟（下一个 agent 会信以为真）。

## Pre-release stance：地基优先于爆炸半径

**首个 tag 发布时删除本节。** 0.x 无外部消费者，优先做对的地基而非兼容垫片：可自由重命名并同步所有引用。发布前必须把各包指向 `../deepseek-harness` 的 `link:` 依赖替换为已发布版本范围，并验证 `dsh plugin add` 能从 registry 安装（见 README「已知限制」）。

## Repository layout

```
packages/       @dsh-yzj/* workspace 包（均 private、ESM）
  bridge/         ctx.yzjBridge —— 有界子进程通道：argv 数组直启 yzj-cli
  tool-yzj/       模型面工具族 + 写操作确认 guard（风险表）+ ctx.yzjTodo 服务
  ui-yzj/         dsh.client 双面包：node half 为 /yzj RPC 通道 + write-gate，
                  browser half 为 toolview 富卡片 + 悬浮球工作台面板
  robot-yzj/      机器人通道（入站 WS + 出站 webhook，见 docs/spec/robot-channel-plan.md）
  bundle/         可安装 profile patch 层（cordis.patch.yml）+ 改造版 yzj-cli skill
docs/           设计文档，本仓库的主体（见「Spec-driven」；索引与阅读顺序：docs/README.md）
  spec/           设计基线：integration-master-plan / todo-design / robot-channel-plan
  migration/       架构演进：todo-backend-migration（demo→原生后端分层 + 实测格式事实）
  status/          gap-analysis：设计×实现分歧与验收证据（每功能提交留痕）
  pitfalls/        实现级坑库（pitfall-NNN-*.md）——动手前先查，解决新坑后回写（见 Conventions「踩坑记录制度」）
.acceptance/    Playwright 浏览器验收脚本（verify-*.mjs）+ 验收证据截图
tsdown.shared.ts  客户端 closure-factory bundle 预设（与 harness client 预设对齐）
```

本机可能存在但不属于仓库的内容（如兄弟参考工程、spike 本地状态）由 `.gitignore` 表达，不在此罗列。

## Commands

```sh
pnpm install    # 需要兄弟目录 ../deepseek-harness checkout 存在（link: 依赖指向它）
pnpm run build  # 依赖序 tsc -b + tsdown（host 产物 lib/index.js，ui-yzj 另产 lib/client.js）
pnpm run typecheck
pnpm test       # vitest：bridge 单测（fake CLI）+ 真实 CLI 冒烟（未登录自跳过）+ 浏览器组件测试
pnpm run bundle # 仅重建 ui-yzj 客户端 bundle（改 browser half 后必跑）
pnpm run clean
# 安装进 harness（在 harness checkout 下执行）：
pnpm dsh plugin --profile web add -w link:<本仓库路径>/packages/bundle
node .acceptance/verify-real-data.mjs   # 需运行中的 GUI + 已登录 yzj-cli
```

改 host 面后 `pnpm run build` 即可；改 browser half 后还要 `pnpm run bundle` 并**重启 GUI**（web profile 在 web-app 层禁用了 client HMR，bundle 不会热更）。

### 证据匹配改动面

- bridge / 工具逻辑：对应包的 vitest；真实 CLI 行为变化在 `tools.spec.ts` 冒烟断言。
- 面板 / 卡片 UX：`.acceptance/` 对应 verify 脚本走查，截图提交到 `shots-*/`（`shots/` 被忽略）。
- 确认流端到端：`verify-confirm-e2e*.mjs` / `verify-todo-confirm-e2e.mjs`。
- 不重复跑已通过的检查当提交仪式；全量 `pnpm test` 约 6 秒，提交前跑一次是合理默认。

## Secrets / 凭据

仓库无 `.env`、无 API key。云之家凭据只存在于机器级 `yzj-cli auth login` 态（keychain + `~/.yzj-cli/config.json`）；本仓库与 harness 全程不接触 appSecret/accessToken——bridge 只 spawn CLI 复用其登录态。绝不提交凭据。

## Conventions

- **禁止终止宿主进程（自杀红线）**：承载当前会话的 harness 宿主就是本 agent 的运行环境——web GUI 进程（命令行含 `bin.ts "web"` 或 `--profile web`、监听 3080 的 node 进程）。`Stop-Process` / `taskkill` 它 = 杀掉自己：会话、后台 job、全部状态一起消失，且无法自愈。任何 kill 操作前必须核对命令行：监听 3080 的 web 进程、命令行含 `--profile web`/`"web"` 的进程一律不碰。**GUI 的重启只允许用户手动执行**；测试需要新配置生效时，告知用户并等待，绝不代劳。可以 kill 的只有自己启动的后台 job（如 `--profile ops` 的调度 daemon、探针进程、临时进程）——kill 前同样先核对命令行确认不是宿主。
- **兄弟 checkout 是唯一事实源**：所有 `@deepseek-ai/*` 依赖以 `link:` 相对路径指向 `../deepseek-harness`；vitest 经 alias 把 client 包解析到 harness 的 TS 源。harness 接口变化在本仓库直接体现为类型/测试失败，就地适配，不复制其代码。
- **两面包界限**：host 面（bridge、tool-yzj、ui-yzj node half）产出普通 ESM `lib/index.js`；browser half 经 `tsdown.shared.ts` 产出 closure-factory bundle（`window.__ModuleLoader__.load` 注入），其纯度门禁禁止跨插件值导入——协作只走 cordis 服务与 `/yzj` RPC。
- **注册即效应**：一切贡献经 `ctx.effect()` / `ctx.on()` 或返回 disposer 的官方 API；bundle 卸载 / profile 移除后必须无残留（harness 全局约定，此处同样成立）。
- **写路径两分**：确认卡只门控 **agent 发起的写**——`tools/pre-execute` → `guard.ts` 的 `WRITE_SPECS` 风险表（删除类 strong，其余 standard）→ host 侧 write-gate 应答 `approval/request`；用户在面板的直接操作是用户本人意志，走 `/yzj` 直写端点（`im-send`/`file-upload`），不经确认卡。新增写工具必须同提交进 `WRITE_SPECS`。
- **禁止绕过桥接**：仓库内禁止以 bash 直调 `yzj-cli` 执行写命令；代码里唯一的子进程路径是 bridge 的 argv 数组 spawn（无 shell 插值）。`bundle/skills/yzj-cli/SKILL.md` 的红线（结构化工具优先、禁止编造 ID、写前先查）与之一致，改动工具面时同步维护。
- **有界输出**：每个工具产出有界 digest 并把裁剪后的结构化载荷经 `output.presentationMeta` 投影给 UI；上限（timeoutMs / maxRenderChars / maxMetaChars）是 schema 校验的 Config 字段，不是常量。
- **RPC 通道只过无损 JSON**：`/yzj` 通道两向都不携带 harness 活对象；先取所需叶子字段，再构造自有数据对象，绝不整体序列化 Context/Session/Service。
- **新工具清单**：域模块实现 → guard 风险表（若写）→ `cards.tsx` keyed 卡片视图 → 包 README 工具清单同步 → 测试。
- **todo 为 demo 阶段**：后端是多维表格「待办任务库」（首用自动开通）；工具核、`ctx.yzjTodo` 服务与面板任务库切换器共享 active-library holder，agent 写入跟随当前激活库。迁移方案见 [docs/migration/todo-backend-migration.md](docs/migration/todo-backend-migration.md)。
- **测试自跳过而非失败**：依赖真实登录 / CLI 的测试在缺失时 skip（`tools.spec.ts` 范式）；平台差异在测试内显式分支（bridge 的 fake CLI 在 Windows 经 `node` 路由）。
- **踩坑记录制度**：[docs/pitfalls/](docs/pitfalls/README.md) 是实现级坑库，agent 必须维护它：(a) **动手前查索引**，命中相关条目先读再写代码；(b) **解决新坑必须回写**——排查中出现「现象与文档/预期不符」「超过一次构建-验证循环才定位」「jsdom/单测绿但真实环境异常」任一情形，修复后**同一提交**内新增 `pitfall-NNN-<english-slug>.md`（复现条件/根因/解法/回归覆盖四段）并更新 README 索引表；(c) 触发既有坑的解法变更时更新原条目而非另开新条。jsdom 测试通过不等于浏览器没问题（pitfall-001 的核心教训）。
- **提交**：conventional commits（`feat(ui-yzj): …` / `fix(todo): …`），直推 main。
- 文件以恰好一个换行符结尾。
- **文档随代码走**（Spec-driven 的执行面，与「Spec-driven」节配合）：行为变化（工具面、配置键、RPC 端点、确认流、面板交互）同提交更新根 README、对应包 README 与 `docs/` 对应文档；实现与设计分歧更新 gap 对照文档；新功能先文档后代码。

## Type safety and documentation

全仓 `strict: true` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`；每个模块与导出有简明 JSDoc 陈述非显然契约。注释写完整契约与上下文，不复述代码、不留推理过程。语言分工：代码、JSDoc、包 README 用英文；根 README、`docs/`、skill、产品文案用中文——随所在文件保持一致，不混写。

## Editing these instructions

本文件是唯一事实源；本 Windows checkout 未启用 symlink，故未建 `CLAUDE.md` 链接。每条规则保持自包含，高层细节链接到 README 与 docs/；清晰不减时可以压缩。
