# AGENTS.md

dsh-yzj 是 DeepSeek Harness 的独立插件 bundle 仓库：`yzj-cli` 桥接、六域 + todo 的模型面工具族（写确认流）、云之家浏览器 UI（富卡片 + 工作台面板）。一切能力经 Cordis 插件交付——bridge 提供服务、tool-yzj 注册工具、ui-yzj 双面呈现、bundle 挂成 profile patch 层；不修改 harness 本体。**动手前先读 [docs/README.md](docs/README.md)（文档索引与阅读顺序）**；实现与设计的分歧记录在 [docs/status/gap-analysis.md](docs/status/gap-analysis.md)。

## Spec-driven：文档就是仓库的主体

**本仓库由 agent 维护、面向 agent 消费——不会有任何人类阅读这里的代码。** 一切设计、决策与知识都以文档形态沉淀，代码只是文档的机器执行形式。由此推出 agent 的硬性义务：

1. **文档先于代码**：新功能先在 `docs/` 落设计（目标、契约、验收口径），再写实现；实现过程中设计变更，**先改文档再改代码**，同一提交。
2. **文档即接口**：下一个读这个仓库的是另一个 agent，它以 `docs/` 为首要输入。文档陈旧 = 下一个 agent 必然做错。每个提交自问：「只读 docs/ 的人（agent）能准确重建当前系统的行为吗？」不能，就补。
3. **docs/ 目录义务**（职责与阅读顺序见 [docs/README.md](docs/README.md)，改动对应面时同提交更新）：
   - `spec/` — 设计基线：`integration-master-plan.md`（整体方案/人在闭环验收基准）、`group-room-topics.md`（**v2.0 产品法**：1 群 = 1 群房间 + N 话题；v1.1 工作台三栏 P0–P3 已落地）、`dsh-home-session.md` / `dsh-home-transcript.md`（v1.x 历史快照；D9 写路径与消息日志机制沿用，1:1 绑定与融合一条流已被 v2.0 覆盖）、`todo-design.md`（todo 域 + §11.2 决策表）、`robot-channel-plan.md`（机器人通道协议；会话落点以 group-room-topics 为准）；
   - `migration/` — 架构演进：`todo-backend-migration.md`（demo→原生后端分层 + §3 实测格式事实）、`advance-lingee-migration.md`（AI推进 MVP→灵基：合同/机制/脚手架三层 + 断层清单）；
   - `status/` — `gap-analysis.md`：设计×实现分歧与验收证据，**每个功能提交都应在此留痕**；
   - `pitfalls/` — 踩坑库（见 Conventions「踩坑记录制度」）。
4. **决策必须留档**：拍板（设计取舍、风险分级、命名）写进对应设计文档的决策表，附理由；不允许只存在于提交信息或对话里的决策。
5. **不写无人维护的文档**：文档要么随代码演进，要么删掉；「大概如此」的描述比没有更糟（下一个 agent 会信以为真）。

## 发布依赖口径

workspace 六包对 `@deepseek-ai/*` 的 `link:../../../deepseek-harness/...` **保留**（兄弟 checkout 是唯一事实源；vitest alias / 类型闭环依赖它）。对外安装走根 `@dsh-yzj/bundle`，其 `dependencies` 已是 registry `^0.1.0-rc.7`，无 `link:`。tag `v0.1.0` / `v0.1.1` 已打。**不要**把 workspace `link:` 换成 registry。流程见 [docs/release.md](docs/release.md)。

## Repository layout

```
packages/       @dsh-yzj/* workspace 包（均 private、ESM；开发态，发布经根聚合）
  bridge/         ctx.yzjBridge —— 有界子进程通道：argv 数组直启 yzj-cli
  tool-yzj/       模型面工具族 + 写操作确认 guard（风险表）+ ctx.yzjTodo 服务（泳道待办）
  ui-yzj/         dsh.client 双面包：node half 为 /yzj RPC 通道 + write-gate，
                  browser half 为 toolview 富卡片 + 云之家工作台（侧栏单入口 + 顶栏页签 + 三栏；悬浮球已退役）
  # robot-yzj / memory-yzj 已彻底退役删除（决策 53，2026-08-25）——包、RPC、
  # 工具、话题交互面全无；历史见 git 与 docs/spec/*-plan.md 档案
  model-yzj/      插件级默认模型路由
根 = @dsh-yzj/bundle（monobundle）：tsdown 聚合六包 host half 进 lib/*.mjs +
  scripts/copy-client.mjs 搬运 ui-yzj closure bundle 为 lib/client.js；
  cordis.patch.yml 行名用子路径（@dsh-yzj/bundle/<row>）；发布 = 构建 + tag
  （见 docs/release.md）
docs/           设计文档，本仓库的主体（见「Spec-driven」；索引与阅读顺序：docs/README.md）
  spec/           设计基线：integration-master-plan / group-room-topics（v2.0 产品法 + v1.1 工作台）/ dsh-home-session（v1.x 快照）/ todo-design / robot-channel-plan
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
pnpm dsh plugin --profile web add -w link:<本仓库路径>
node .acceptance/verify-real-data.mjs   # 需运行中的 GUI + 已登录 yzj-cli
```

改 host 面后 `pnpm run build` 即可；改 browser half 后还要 `pnpm run bundle`。web profile 禁用 client HMR、host 也不热加载 `lib/*.mjs`，验收前必须重启 GUI。

### 证据匹配改动面

- bridge / 工具逻辑：对应包的 vitest；真实 CLI 行为变化在 `tools.spec.ts` 冒烟断言。
- 面板 / 卡片 UX：`.acceptance/` 对应 verify 脚本走查，截图提交到 `shots-*/`（`shots/` 被忽略）。
- 确认流端到端：`verify-confirm-e2e*.mjs` / `verify-todo-confirm-e2e.mjs`。
- @机器人入站话题：`.acceptance/verify-robot-at-topic.mjs`（dock 未配置/未连接 skip 退出 0）。
- 不重复跑已通过的检查当提交仪式；全量 `pnpm test` 约 6 秒，提交前跑一次是合理默认。

## Secrets / 凭据

仓库无 `.env`、无 API key。云之家凭据只存在于机器级 `yzj-cli auth login` 态（keychain + `~/.yzj-cli/config.json`）；本仓库与 harness 全程不接触 appSecret/accessToken——bridge 只 spawn CLI 复用其登录态。绝不提交凭据。

## Conventions

- **验收要新实例就重启 GUI**：host 面与 browser bundle 都要新进程才生效。核对 PID 与命令行确认是 web GUI（`web --port 3080` / `bin.ts web`）→ 停掉 → 在 harness checkout 用原启动命令拉起（例如 `node --import tsx/esm apps/cli/src/bin.ts web`）→ 等到 `http://127.0.0.1:3080/` 可访问再跑 `.acceptance/`。不要误杀 `--profile ops` 调度 daemon，除非那就是本次要测的实例。
- **兄弟 checkout 是唯一事实源**：所有 `@deepseek-ai/*` 依赖以 `link:` 相对路径指向 `../deepseek-harness`；vitest 经 alias 把 client 包解析到 harness 的 TS 源。harness 接口变化在本仓库直接体现为类型/测试失败，就地适配，不复制其代码。
- **两面包界限**：host 面（bridge、tool-yzj、ui-yzj node half）产出普通 ESM `lib/index.js`；browser half 经 `tsdown.shared.ts` 产出 closure-factory bundle（`window.__ModuleLoader__.load` 注入），其纯度门禁禁止跨插件值导入——协作只走 cordis 服务与 `/yzj` RPC。
- **注册即效应**：一切贡献经 `ctx.effect()` / `ctx.on()` 或返回 disposer 的官方 API；bundle 卸载 / profile 移除后必须无残留（harness 全局约定，此处同样成立）。
- **写路径两分**（产品法已拍板，见 [docs/spec/dsh-home-session.md](docs/spec/dsh-home-session.md) §8）：确认卡只门控 **agent 发起的写**——`tools/pre-execute` → `guard.ts` 的 `WRITE_SPECS` 风险表（删除类 strong，其余 standard；条件门控写 `when` 谓词，如 `yzj_advance_feed` 只在改推进基准时问，见 [docs/spec/ai-advance-design.md](docs/spec/ai-advance-design.md) §13.5）→ host 侧 write-gate 应答 `approval/request`；**用户从 DSH 发出**（及现行面板 composer 过渡态、待办勾选、`/yzj` `home-send` / `im-send` / `file-upload` 等直写）是用户本人意志，不经确认卡。绑定家园上 agent 调用 `robot_notify` / `robot_continue` 也进 `WRITE_SPECS`（D9；v2.0 起 `whenSession` 须同时覆盖 `yzj-home-*` 与 `yzj-topic-*`，见 group-room-topics R10）。**话题 job-done 投递（R29）**也是产品契约面、无确认卡：轮次 idle 后 host 以 CLI 本人身份把总结回帖到锚点并带上本轮产物，不是 agent 另起 `yzj_im_message_send`。会话模型以 [docs/spec/group-room-topics.md](docs/spec/group-room-topics.md) 为准：1 群 = 1 群房间 + N 话题会话，每个视图只有一个发送动词。新增写工具必须同提交进 `WRITE_SPECS`。
- **禁止绕过桥接**：仓库内禁止以 bash 直调 `yzj-cli` 执行写命令；代码里唯一的子进程路径是 bridge 的 argv 数组 spawn（无 shell 插值）。`bundle/skills/yzj-cli/SKILL.md` 的红线（结构化工具优先、禁止编造 ID、写前先查）与之一致，改动工具面时同步维护。
- **有界输出**：每个工具产出有界 digest 并把裁剪后的结构化载荷经 `output.presentationMeta` 投影给 UI；上限（timeoutMs / maxRenderChars / maxMetaChars）是 schema 校验的 Config 字段，不是常量。
- **RPC 通道只过无损 JSON**：`/yzj` 通道两向都不携带 harness 活对象；先取所需叶子字段，再构造自有数据对象，绝不整体序列化 Context/Session/Service。
- **新工具清单**：域模块实现 → guard 风险表（若写）→ `cards.tsx` keyed 卡片视图 → 包 README 工具清单同步 → 测试。
- **工具 execute 契约**（harness `docs/cookbook/adding-a-tool.md`）：`execute(args, exec)` 返回一个规范 JSON 值；抛错或非法返回 → `isError`；领域结果留在 value 里（含非零 CLI 退出）；尊重 `exec.signal`；注册后不要改 definition。策略走 `tools/pre-execute`（本仓即 `WRITE_SPECS`），不要写进 `execute`。复用 `yzjToolOutput`，schema 保持字面量结构（pitfall-009）。UI 卡是 keyed `tool.call.toolview`，不用 cookbook 的 `presentCall` / `presentResult`，也不用 `ConversationNodeDefinition`。
- **设置座不要抄 cookbook**：`adding-a-settings-card.md` 的 `settings.plugin.item` + `installSettingsSection` 是 Plugins 页。本仓是 `settings.section`（设置 → 云之家，id `yzj`），持久化走 `/yzj` RPC。
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
