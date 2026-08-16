# 记忆库组件设计：memory-yzj（vault 模型 + dream 固化 + 定时任务对接）

> v0.2 · 2026-08-16 · 状态：v0.1 已实现；v0.2 增补（dream 开关/进程内执行器/插件默认模型）已实现
>
> v0.2 变更（2026-08-16）：dream 增加**运行时开关（默认关闭）**与**可设置模型**，固化主路径从
> dsh-routines routine 改为**进程内执行器**（`ctx.agents` one-shot 会话），新增插件级默认模型
> 包 `@dsh-yzj/model-yzj`（`ctx.yzjModels`）并接入 robot-yzj 模型解析链。见 §7.1 与决策表 D12-D15。
>
> 参考输入：
> - **dream-vault 导出包**（用户提供，`dream-vault-<uuid>.zip`）：sections / entities /
>   observations 三层 + 定期「dream」固化 + 注入上限（`sections.yaml` 的
>   `inject_char_cap: 6000`）+ 人工可编辑明文。
> - **DSH 插件生态**（"dsh find"，见 `routines-delivery.md` 头部入口清单）：30+ 记忆
>   插件，成熟模式＝明文存储 + 有界注入 + remember/recall/forget 工具 + 定期固化
>   （mneme autoDream / biomemory dream / memory-meow nightly dream）+ 人工主权闸门。
>   代表实现：[@modusensus/dsh-mneme](https://github.com/modusensus/dsh-mneme)（SQLite
>   + Markdown 镜像 + autoDream 决策清单）、
>   [dsh-native-memory](https://github.com/highland0971/dsh-native-memory)（storage-domain
>   + 审批闸门 + 来源引用）、[@max-null/dsh-memory](https://github.com/Max-Null/dsh-memory)
>   （明文 + BM25 + suggested→confirmed 人工确认）。
> - **本仓现状**：`robot-yzj` 已有按会话「记住/忘掉」指令行记忆（`MemoryStore`，
>   storage-domain，30 行上限，逐轮注入 instructions）——这是群组记忆的雏形，但无
>   固化、无实体、无跨会话用户画像。

## 1. 目标与非目标

### 目标（本期）

1. **一个通用记忆组件**（新包 `@dsh-yzj/memory-yzj`，服务 `ctx.yzjMemory`）：
   - vault 明文文件模型（参考 dream-vault）：sections（策展长期记忆）/ entities
     （实体页）/ observations（临时信号草稿区）+ log（固化审计）；
   - 模型面工具族：观察写入、读取、关键词检索、dream 加载/应用；
   - 注入缝：`ctx.systemPrompt.context` 动态上下文，按 `inject_char_cap` 有界注入
     user 作用域投影。
2. **可接定时任务**：dream 固化以 dsh-routines routine 形态运行（YAML + prompt 模板
   交付），固化决策走结构化工具应用，完整会话日志即审计。
3. **为群组记忆留缝**：服务 API 按 scope 参数化（`user` / `group:<id>`），目录按
   scope 分仓；robot-yzj 后续接群组注入与群内「记住」时零迁移。

### 非目标（本期不做，留缝）

- 群组 scope 的注入 wiring（robot-yzj 消费 `ctx.yzjMemory`，见 §8）；
- 向量/语义检索（先用确定性关键词检索；向量化留 v2 可选项）；
- 面板的 dream 手动触发（固化仍只由 routine 发起；面板只读 + 手动记观察）；
- 与生态记忆插件互操作或迁移。

### v0.1 增补（2026-08-16）：浏览器记忆面板（随用户要求提前）

原「浏览器管理面板」非目标提前转正为 ui-yzj 工作台第六 tab「记忆」（只读浏览 +
用户直写），交付面：

- `/yzj` RPC +3：`memory-scope`（readScope 视图）、`memory-log`（log.md 尾部，
  服务新增 `dreamLogTail`）、`memory-observe`（**面板直写 = 用户本人意志**，与
  im-send/todo-create 直写同语义，不经确认卡；source 标 `panel`）；
- 记忆 tab：sections/entities 展开浏览、open observations 全文、注入上限与
  open/archived 计数、dream 日志尾部（「记录何时被分析过」对用户透明）、
  「记一条」快捷新增（写观察草稿区）；
- 工具卡：`memory_*` 五工具进 cards.tsx keyed 视图（简单摘要形态）。

## 2. Vault 模型（存储契约）

```
<vaultRoot>/                          # 默认 $DSH_HOME/yzj-memory（≈ ~/.dsh/yzj-memory）
  user/                               # scope: user（操作者全局画像）
    sections.yaml                     # 注入配置：仅 inject_char_cap（段的顺序与标题在各段自身 frontmatter）
    sections/<name>.md                # 策展长期记忆（dream 写，人类可改）
    entities/<name>.md                # 实体页（frontmatter: tags/relation/status）
    observations/
      obs-<yyyymmddhhmmss>-<rand>.md  # 临时信号（agent 写；dream 提升/丢弃）
      archived/
        obs-….md                      # 已处置的观察（dream 移入，保留审计）
    index.md                          # 生成索引（dream 维护，wikilink 汇总）
    log.md                            # dream 日志（追加式审计）
  group-<id>/                         # （预留）群组 scope，同构目录
```

- **一切皆明文 Markdown + YAML**：人类可读可改（记忆主权），可 git 分享，可被
  任何进程（web / ops / headless routine）以文件路径直读——跨 profile 共享的
  最简 substrate（routines 的 `projectDir` 固定路径同理）。
- **文件格式**：
  - `sections.yaml`：仅一项平面配置 `inject_char_cap: <int>`（默认 6000）；段的顺序
    与标题放各段自身 frontmatter（`order` / `title`）——一处事实一处存放，也避免手写
    嵌套 YAML 列表的解析脆弱性。首次初始化自动生成。
  - section/entity/observation 均「frontmatter + 正文」；frontmatter 由组件/dream
    维护（`created` / `last_updated` / `tags` / `status` / `id` 等），正文为纯文本，
    支持 `[[wikilink]]` 互链（索引由 dream 重建，不做双向链接图）。
  - observation frontmatter：`id / created / status: open|archived / tags / source`；
    正文即信号内容（≤2000 字符，超长裁剪）。
- **一观察一文件**：写入是纯创建（无读-改-写窗口），跨进程并发安全；dream 处置 =
  移入 `archived/`（或改 status 后移动，二选一：**移动文件 + frontmatter 标
  `status: archived`**）。
- **section/entity 写入**：临时文件 + 原子 rename（Windows 同卷 rename 原子）；
  读-改-写窗口用「rev 校验」收窄（§6）。
- **容量上限**：每 scope open observations ≤ `observationsMax`（默认 200，超出拒新
  并提示先 dream）；section 数量不设硬顶（注入受 char cap 约束）。

## 3. 写路径三分（治理模型）

沿用 dream-vault 的核心治理直觉 + 本仓「写路径两分」的同类思路：

| 写者 | 可写面 | 通道 | 闸门 |
|---|---|---|---|
| **agent（任意会话）** | 仅 observations（草稿区） | `memory_observe` 工具 | 无确认卡（本地草稿、非云之家写；见决策表 D4） |
| **dream（routine 会话）** | sections / entities / index / log / observations 处置 | `memory_dream_load` + `memory_dream_apply` | 结构化决策逐条校验 + rev 乐观锁；完整会话日志即审计 |
| **人类** | 任意文件（记忆主权） | 文本编辑器 | 无（dream 以当下磁盘状态为基线，不覆盖未读过的内容——见 D6） |

**固化规则（dream prompt 承载，工具不硬编码）**，继承 dream-vault 的佐证哲学：

- 单日单源信号 → 留在 observations（不提升）；
- 被既有 section/entity 佐证（信息已反映）→ 丢弃（drop，移入 archived）；
- 多源/跨日佐证，或明确稳定的事实/偏好 → 提升（promote：并入 section，必要时
  建/更实体页）；
- 过时/矛盾 → update_section / upsert_entity 重写，log 记录变更理由。

## 4. 服务契约：`ctx.yzjMemory`

```ts
interface YzjMemoryService {
  /** 写入一条观察（草稿区），返回 id。 */
  observe(scope: string, input: { content: string; tags?: string[]; source?: string }): { id: string; duplicate: boolean; openCount: number; capacity: number }
  /** 读一个 scope 的当前状态（sections/entities/open observations，有界）。 */
  readScope(scope: string): YzjMemoryScopeView
  /** 组装注入投影：按段 frontmatter 的 order 拼段，受 inject_char_cap 截断。 */
  projection(scope: string): { text: string; truncated: boolean; chars: number; cap: number }
  /** 确定性关键词检索（sections > entities > observations，含/分词匹配计分）。 */
  search(scope: string, query: string): YzjMemoryHit[]
  /** dream 专用：全量状态 + 每文件 rev（内容 hash），供 apply 乐观校验。 */
  dreamLoad(scope: string): YzjDreamState
  /** dream 专用：逐条应用决策（rev 不匹配即该条失败），追加 log、重建 index。 */
  dreamApply(scope: string, decisions: YzjDreamDecision[], summary: string): YzjDreamReport
}
```

- **全部方法同步实现**（本地小文件、注入 provider 契约是同步字符串；单进程内
  天然串行无交错），工具层在 async execute 中直接调用；跨进程安全靠「观察纯创建
  + 段写原子 rename + rev 乐观锁」。
- scope 取值：`user`（本期）｜`group:<groupId>`（预留，字符白名单校验：`[A-Za-z0-9_-]`）；
  工具入参 scope 必须在 Config `allowScopes`（默认 `['user']`）内，防串仓。
- 决策类型（`YzjDreamDecision`，判别联合）：
  `promote_observation`（obs→section 追加，可选同时 upsert 实体）｜`drop_observation`
  ｜`update_section`（整段重写）｜`upsert_entity`｜`log_only`。
- 所有方法纯本地文件操作，不依赖 bridge / 云之家；失败语义＝抛错（工具层转
  isError digest；dream_apply 的逐条失败不抛错，进报告）。

## 5. 工具族与注入

### 工具（`@dsh-yzj/memory-yzj` 自注册，`inject: ['tools']`）

| 工具 | 参数（摘要） | 说明 |
|---|---|---|
| `memory_observe` | `content`（必填，≤2000 字符）、`tags?`、`scope?`（默认 user） | 写观察；返回 id；重复内容幂等提示 |
| `memory_read` | `scope?` | 有界读：段清单+摘要、实体清单、open 观察全文 |
| `memory_search` | `query`、`scope?` | 关键词检索，命中行带来源（文件+行号） |
| `memory_dream_load` | `scope` | dream 入口：全量状态+rev |
| `memory_dream_apply` | `scope`、`decisions`（JSON 数组字符串，仓库工具族惯例如 todo 的 records）、`summary` | dream 应用：逐条校验+应用，返回报告 |

- 输出契约复用 tool-yzj 范式（`content` digest + `truncated` + `data`
  presentationMeta）；digest 上限 `maxRenderChars`（Config，默认 20000）。
- **不进 `WRITE_SPECS` 确认卡**：记忆库是本地文件草稿/策展，不是云之家云上写；
  确认卡门控的语义是「以用户身份写云之家」（见决策表 D4）。

### 注入（`ctx.get('systemPrompt')` 可选消费）

- `systemPrompt.context({ name: 'yzj-memory', order: 0, text: provider })`；
  provider 每次组装时读 user scope 投影——无陈旧镜像问题（dream-vault 的
  README.md 生成式合成会被我们改为**注入时现算**，单一事实源是 sections 本身）。
- 空投影（空库）→ 空文本 → 按 harness 契约不贡献任何内容。
- 截断时尾部标注 `…（已达注入上限 N 字符，完整记忆用 memory_read 查看）`。
- model-visible ⟺ logged：runtime-context 快照进会话日志，满足 harness 纪律。
- 作用域：本期只注入 `user`；`group` scope 由 robot-yzj 后续以 agent 作用域贡献
  或 instructions 注入（§8），本包不做全局多 scope 注入。

## 6. 并发与失败语义

- **跨进程**（web 写观察 ↔ headless dream 写 section）：观察=纯创建；section 写
  = tmp+rename；`dreamApply` 对每个目标文件带 rev（load 时内容 hash）乐观锁——
  load 之后文件被人类/他进程改过，则涉该文件的决策条目失败（报告标
  `rev-conflict`），其余决策照常；dream 下轮重读即可，不丢人工编辑（D6）。
- **同进程**：服务实例内串行化 dreamApply（简单互斥队列）。
- **崩溃安全**：rename 原子；log.md 追加式（append 单行 JSONL 段落头 + Markdown
  正文，追加不重写）；index.md 重建失败不影响 sections（下次 dream 重试）。
- **vault 根不存在**：首次调用自动初始化（建目录 + 空 sections.yaml + 空
  log.md）；只读方法在缺目录时返回空视图而非抛错。

## 7. 定时任务对接（v0.2 起：主路径为进程内 dream，routine 为备选）

### 7.1 dream 开关、模型与调度（v0.2）

- **开关默认关闭**：`<vaultRoot>/dream.json`（运行时状态文件，面板可翻，热生效）：
  `{ enabled: false, provider?, model?, dailyAt?, lastRunDay?, lastNote? }`。
  - `enabled=false` 时：`memory_dream_apply` 工具与执行器一律拒绝（**跨进程共享同一文件**，
    headless routine 路径同样被拦）；`memory_observe/read/search/dream_load` 不受影响
    （观察与读取是组件的本体，固化才是被开关的对象）。
  - 路由成对约束：provider/model 同设同清；`dailyAt` 严格 `HH:mm` 校验，非法值静默丢弃。
- **进程内执行器**（主路径）：`dreamRun(trigger)` 经 `ctx.get('agents')` 创建 one-shot
  会话（`dream-<ts>-<rand>`，cwd=vaultRoot，完整会话日志=审计不变），推入 canonical
  dream prompt（`src/dream.ts` 的 `DREAM_PROMPT`），`whenIdle()` 收敛（10 分钟预算），
  从 `core.lastDreamReport('user')` 取固化报告写回 `lastNote`。in-flight 互斥。
- **模型链**：dream.json 显式路由 > `ctx.yzjModels`（插件默认）> harness 默认（省略
  agentOptions，agent-loop 路由生效）。dsh-routines 的 routine **没有 per-routine 模型
  字段**（实读确认），这是主路径切换的动因。
- **每日定时**：`enabled + dailyAt` 时进程内每分钟 tick，`shouldFireDaily`（纯函数：
  过点 + 当日未跑）为真即先盖 `lastRunDay` 戳再跑（重启安全，不双发）。web profile
  常驻即调度存在；不依赖 ops daemon（对比：dsh-routines 调度器进 web profile 会因
  jobs 控制器缺失崩进程，见 routines-delivery §5.1）。
- **触发面**：面板「立即固化」（RPC `dream-run`，trigger=panel）；每日 tick
  （trigger=schedule）；后续可加 robot 命令（如群内 `!dream`）。
- **备选路径**：`memory-dream-routine.yaml`（dsh-routines）仍可用——固化判断在独立
  headless 会话、digest 可经 chatnode 推群；其模型 = 该 profile 的默认路由（不可按
  dream 配置），且需 headless profile 挂 memory-yzj 行。

### 7.2 插件级默认模型：`@dsh-yzj/model-yzj`（v0.2）

- `ctx.yzjModels`：`get() / setDefault(provider, model) / clear() / catalog()`（catalog
  经可选 `llm` 服务，活跃路由优先，与 robot 设置选择器同策略）；存
  `$DSH_HOME/yzj-model.json`（明文，手改热生效）。
- **消费方**：robot-yzj 模型解析链尾部（会话覆盖 > 机器人配置 > 通道 default >
  **插件默认** > harness 默认——router `fallbackRoute` 每次建会话现查）；memory dream
  执行器的兜底。后续新组件（如群组例行任务）一律接此默认。

## 8. 群组记忆扩展缝（后续，本期不实现）

- **scope 即仓**：`group:<id>` 目录同构，服务 API 已参数化，零迁移。
- **注入**：robot-yzj 拿 `ctx.get('yzjMemory')`，群消息回合注入该群投影（与现
  MemoryStore 指令行并行，或迁移为 vault 的一个 section——到时拍板）。
- **写入**：群内「记住 …」动词 → `observe('group:<id>', …)`；群聊日常摘要可由
  例行 routine 从会话日志提炼观察（harness 会话日志无损，来源引用天然可用）。
- **固化**：同一 dream routine 扫全部 scope（`allowScopes` 扩围即可），或按群
  分 routine。

## 9. 部署与挂载

- bundle `cordis.patch.yml` 新增行：`- id: memory-yzj / name: '@dsh-yzj/memory-yzj'`
  → web profile 全量生效（注入 + 工具）。
- headless profile（routine 运行态）：同行挂载（工具 + user 注入；dream 会话
  也受益于既有记忆）。
- ops profile（调度器）：**不挂**——ops 无 agent 会话，挂了只占内存（与
  routines-cli/web 抢命令行的教训无关，但同「按 profile 职责裁剪」原则）。
- `vaultRoot` 默认 `$DSH_HOME/yzj-memory`；跨 profile 固定（web/ops/headless 同机
  同 DSH_HOME 共享），Config 可显式覆盖。

## 10. 决策表

| # | 决策 | 选择 | 理由 |
|---|---|---|---|
| D1 | 存储形态 | 明文 Markdown vault（文件目录） | 参考设计的核心优点：主权、可审计、可 git、跨 profile/进程零依赖共享；SQLite/向量把可观测性换成了黑盒（@max-null 同论证） |
| D2 | 三层模型 | sections/entities/observations + log | dream-vault 实证结构；observations 草稿区天然实现「agent 只建议、固化才生效」的治理 |
| D3 | 固化引擎 | dsh-routines routine + 结构化决策工具 | 判断归 LLM 会话（完整审计）、机械应用归工具（可校验）；不自建后台调度器（web profile 崩溃教训 pitfall/routines §5.1） |
| D4 | 确认卡 | 记忆工具不进 WRITE_SPECS | WRITE_SPECS 语义=「以用户身份写云之家」；本地草稿无外部爆炸半径；dream_apply 有 rev 锁 + 审计兜底 |
| D5 | 注入机制 | `systemPrompt.context` 动态 provider（现算投影） | 每次组装求值 → 无陈旧镜像；runtime-context 快照天然落日志；空库零成本 |
| D6 | 人工编辑保护 | rev 乐观锁（load→apply 窗口）+ dream 以磁盘现状为基线 | 不覆盖 dream 未读过的人工编辑；三方合并留 v2（mneme 有先例，首版从简） |
| D7 | 检索 | 确定性关键词（含命中行/来源） | v0 可解释可回放；语义检索留缝（vault 是明文，随时可外挂向量化） |
| D8 | 服务命名 | `ctx.yzjMemory` / 包 `@dsh-yzj/memory-yzj` / 工具前缀 `memory_` | 服务名随仓内 yzjBridge/yzjTodo/yzjRobot 惯例（防与生态 `ctx.memory` 撞名）；工具前缀表义清晰 |
| D9 | scope 校验 | Config `allowScopes` 白名单（默认 `['user']`） | 防 agent 串写群组仓；群组能力解锁=扩白名单 + robot wiring，不改代码 |
| D10 | 被否决：README.md 生成式合成注入 | 改为注入时现算 | 生成物会陈旧；sections 是唯一事实源 |
| D11 | 被否决：storage-domain 承载 | 文件目录承载 | 跨进程（web/ops/headless）共享最简；storage-domain 单位与 profile 进程生命周期耦合更深，且失去「人类直接编辑目录」的便 利 |
| D12 | dream 开关 | `<vaultRoot>/dream.json` 运行时文件，**默认 enabled=false**，面板可翻热生效 | 用户要求不默认开启；cordis config 是静态的（改需重启），开关属运行时状态；跨进程共享同一文件 = headless routine 路径同样被拦 |
| D13 | dream 执行 | 进程内执行器（ctx.agents one-shot 会话）为主，dsh-routines routine 降为备选 | 实读确认 dsh-routines 无 per-routine 模型字段——routine 路径模型不可控；进程内会话同样有完整会话日志（审计不降级），且模型链/开关/每日定时全部可配 |
| D14 | dream/robot 模型链 | dream.json 显式路由 > 插件默认（ctx.yzjModels）> harness 默认；robot 链尾部同接插件默认 | 用户拍板「插件范围内的默认模型把已有地方搞过来」；一次设置全插件生效，局部显式配置仍可覆盖 |
| D15 | 插件默认模型归属 | 新包 `@dsh-yzj/model-yzj`（`~/.dsh/yzj-model.json`） | memory 与 robot 互不依赖，共享默认必须有独立底层包；明文 JSON 手改热生效，与 vault 同哲学 |

## 11. 验收口径

1. **单测**（vitest，临时目录）：vault 初始化/observe 幂等与上限/read 有界/
   projection 截断标记/search 命中来源/dreamApply 五类决策 + rev 冲突 + log/index
   产物；
2. **组装验证**：挂载 memory-yzj 行的 profile 启动无错；`systemPrompt` 组装包含
   `yzj-memory` 上下文（空库不贡献）；
3. **端到端（手工/验收脚本）**：会话里 `memory_observe` → 临时 routine（或手动
   会话）跑 dream load/apply → sections 更新 + log 留痕 + 下一轮组装注入新投影；
4. **定时对接**：headless profile 挂行后，`memory-dream` routine 到点跑通，digest
   经 chatnode 推群（复用 routines-delivery §5 验收链路）。

## 12. 风险与开放问题

- routine 子进程写 vault 与 web 进程写观察的极端并发：rev 锁只护 dream 目标文件，
  observations 纯创建无冲突——残余风险仅 dream 移档与他人 drop 同一观察（后到
  者报 not-found，可接受）；
- `[[wikilink]]` 悬链（实体被改名）：index 重建时报告 broken links，不阻塞；
- 注入与 persona 的顺序观感（contexts 与 sections 是不同通道，order 0 已定，
  实际观感待 GUI 验收后微调）。
