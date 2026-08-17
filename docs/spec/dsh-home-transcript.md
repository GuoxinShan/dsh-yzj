# DSH 绑定会话的可见时间线：插件消息日志

> 版本：v1.1（已拍板；**实现已落地**——插件消息日志 + 融合视图 + composer 双意图 + 召唤窗口注入）+ **v1.2 文案**（2026-08-16）：产品手势是云之家 @机器人、DSH「发给助手」；「产品文案 @Claude」作废。Claude Tag 仅对照。+ **v1.3 UI**（2026-08-17）：①② 复用面板 IM 渲染器；切会话分阶段，禁止闪「私密会话」/上一群残留。
> 日期：2026-08-17
> 决策人：Guoxin Shan
> 定位：会话家园产品法（[`dsh-home-session.md`](dsh-home-session.md)）落地后的**下一片**：绑定 DSH 会话里人看见的那条融合时间线。本文规定存储对象、合并规则、模型上下文、发送路径、去重、回填、composer chrome，以及**为什么 ①② 不是 `Session.append`**。
> 前置：绑定对象 `yzjConversationId ↔ dshSessionId` 已在 `ctx.yzjHome` 落地；本文不改绑定基数、不重写 D1–D11。
> 对照：实现缺口记在 `../status/gap-analysis.md` §22。v1.1 关闭 G2/G6 与丢进群 UI；G3 仍开放（pending overlay 融合视图，但不是 session 事件）。

---

## 0. 北极星

**人对着一条流；模型默认不吃群流水；①② 住在插件日志里，不假装是 harness session 事件。**

[`dsh-home-session.md`](dsh-home-session.md) D1/D3 要求绑定会话的 transcript **看起来**含四类节点。那是产品视图，不是「四类都写入 `Session.append`」。harness 对仓外插件关闭自定义 session 事件类型（见 §2）；确认卡 pending 已经因此住在 host 内存。①② 走同一条路：插件自有耐久消息日志 + 视图按时间戳与官方事件（③④ + 确认卡）融合。

未绑定私聊没有这条 ①② 流（D7）。本片只约束 `binding.kind === 'bound'`。

---

## 1. 决策表

| # | 决策 | 结论 | 理由 |
|---|---|---|---|
| T1 | ①② 的存储位置 | **不是** harness session 事件。写入**插件自有耐久消息日志**，按绑定键（`yzjConversationId` ↔ `dshSessionId`）索引 | 仓外插件无法注册自定义事件类型：`KNOWN_SESSION_EVENT_TYPES` 拒绝未知 type，`Session.append` 无 `ignorable` 入口。硬塞 ①② 会丢事件或污染官方日志。确认卡 pending 已因同一约束改走 host 内存，①② 不得假装例外 |
| T2 | 人看见什么 | **一条融合时间线**：消息日志（①②）与官方 session 事件（③④，含确认卡挂起态）按时间戳交错 | 产品法 D3：群工作发生在 DSH 里。两份存储、一个视图；禁止再在面板另开一套 IM transcript 作家园 |
| T3 | 模型默认看见什么 | **默认不把每一条 ① 喂给模型**。未召唤的群流水只给人看 | 群聊噪音大、token 贵；D11 已否 ambient。人要完整群脸，模型只要被叫到时的近期窗口 |
| T4 | 何时把日志交给模型 | **召唤才注入**：云之家侧 `@机器人`，或 DSH 绑定 composer「发给助手」。注入物 = 本条绑定日志的**有界近期窗口**，且**只服务这一轮**（同轮工具续写仍可见；下一轮未召唤则不再注入） | 对齐 D6 召唤手势。对照/类比：对齐 Claude Tag（仅对照）。窗口有界（条数 + 字符，Config，不是常量）。禁止把全量日志当系统提示常驻 |
| T5 | 窗口注入机制 | **显式 per-turn 注入**，两条召唤入口共用同一 digest 契约（§5.2），走**已有** host 缝，不新开 harness 钩子：① 云之家 @机器人 → `agent.inject(窗口)` 再 `followup(问句)`（对齐 robot-yzj `dispatchTurn`）；② DSH「发给助手」→ `ctx.systemPrompt.context`（对齐 memory-yzj 有界注入缝），仅在「本轮由召唤发起」时返回窗口文本 | `agent/request` 只能改 `LlmCallConfig`，不能改消息正文（总方案 §2.2）。**不用 codec 承载窗口**：`ReferenceCodec.serialize` 的输出会固化进 ③，后续轮次重复付费且窗口变脏快照，违反「只服务这一轮」。codec 仍只服务用户主动 @/拖 chip（既有 mention 管线）。禁止为窗口发明自定义 session 事件或新的 harness fork |
| T6 | DSH「发进群」 | 写日志（乐观 ②）+ CLI `im message send`（经 `/yzj` 直写，用户意志）。**不**开 DSH user-turn。**不**弹确认卡 | 开 ③ 会打到模型（用户只是发群，不是叫 agent）。确认卡只门控 agent 写（D9）。乐观气泡避免等 CLI 往返；回声按 `(groupId, msgId)` 去重（T8） |
| T7 | 云之家客户端发出的「我发的」 | **① + `isSelf: true`**，不是 ② | ② 的定义是「用户在 DSH 点了发进群」。同一人在云之家客户端打的字，来源是入站/回填，不是 DSH 直写路径 |
| T8 | 去重键 | 主键 **`(yzjConversationId, msgId)`**。乐观 ② 先占 `local-*`，CLI 返回真实 `msgId` 后改写；之后同一键的入站/回填回声丢弃，保留 ② 行 | 面板消息流已按 `msgId` 去重。无第二套模糊主键做默认；仅当 CLI 未返回 `msgId` 时才允许 `(fromOpenId, content, sentAt±窗口)` 作临时贴合，贴上即升格为主键 |
| T9 | 打开绑定会话 | **必须回填**最近 N 条进日志/视图。只靠 live inbound **不够** | 对话机器人 WS 默认只投递 `@机器人`，不是全量群流水。绑定前的历史、DSH 关掉时的非 @ 消息、漏帧，都只有 `im message list` 能补。N 为 Config（默认 50） |
| T10 | 未绑定 composer | **无 ①② 流**；**单一发送按钮**（只对 agent） | D7。私聊不是群；引用 chip ≠ 绑定 |
| T11 | 绑定 composer | **两种意图**：发给助手 / 发进群。chrome 可以是双按钮或模式切换，必须在 **DSH composer**，不得放回面板第二 IM | D3/D5/§2.1 不变量 5。面板 composer 已降级为快捷 ②（G6），不得作家园 |
| T12 | 机器人出站帖子 | **不进 ①② 日志**（回填/入站遇到本通道机器人发送者则跳过）。群里那条帖子是 ④ 的投递，视图用「已投递到群」标记，不另开说话人 | D4。否则融合流会出现 agent 正文 + 一条「机器人 ①」双影 |
| T13 | write-gate 的 `yzj-robot-*` skip | **已重划**（家园 UX PR）：残留 `yzj-robot-*` 仍 skip GUI。`ownsConfirm` 的 `yzj-home-*`：最新 user/message 是 GUI 用户轮 → GUI 卡；plugin followup 或尚无 user/message → 群建议卡 | 绑定后 skip 前缀失效；操作者对着绑定会话「发给助手」必须能在 GUI 确认 |

---

## 2. 为什么不是 `Session.append`

仓外插件（本 bundle）对 harness session 事件类型没有注册面。`write-gate.ts` 已把同一约束写成注释，确认卡因此：

- 走官方审计路径（`tools/pre-execute` → `yzj/ask-pending` → `approval/request` → 官方 `tools/result`）；
- pending 只活在 **host 内存**；SPA 刷新还在，host 重启降级为普通工具卡；
- **记录永不进入模型 transcript**。

①② 若 `Session.append` 一个插件自造 `type`，会被 `KNOWN_SESSION_EVENT_TYPES` 拒绝（无 `ignorable` 标记可绕）。把 IM 正文写进官方 `user/message` 则：

- 「发进群」会变成 ③，打到模型（违反 T6）；
- 每一条 ① 都进默认上下文（违反 T3）；
- 与用户对 agent 的话无法区分。

因此：**官方 session 日志只承载 ③④（外加官方工具/确认审计事件）**；①② 是插件领域对象；人看到的「一条 transcript」是 §4 的融合视图。不在本文发明旁路协议去改 harness。

---

## 3. 存储对象

只读 `docs/` 的下一个 agent 必须能凭本节重建对象，而不是从实现反推。

### 3.1 日志头（按绑定键）

```
YzjBoundMessageLog
  yzjConversationId: string     // 云之家 groupId（群或 DM，与 CLI / 绑定表同 ID 空间）——主键
  dshSessionId:      string     // 当前绑定的 DSH session；绑定表是权威，此处冗余便于按 session 反查
  yzjKind:           'group' | 'dm'
  updatedAt:         number     // unix ms，最后一次 append / 回填
  entries:           YzjLogEntry[]   // 按 sentAt 升序；实现可拆成 KV 行，语义仍是这一条 log
```

不变量：

1. 一条 `yzjConversationId` 至多一条 log；与绑定表 1:1。无绑定则无 log（或不渲染）。
2. `dshSessionId` 随绑定表；绑定 PR 写入/切换绑定时同步本头，禁止 log 指向已不是该群家园的 session。
3. 持久化落 **storage-domain**（与 robot surface / 绑定表同类：json backend、进程可重启）。语义是会话家园的一部分，不是 robot 包私有 `lastSession` 线索，也不是面板 `stores.ts` 的内存 Map。
4. 保留上限是 Config（`logRetention`，默认 500 条/会话）：超出丢最旧。视图要更早历史走「再回填一页」，不在本片做无限本地档。

### 3.2 日志行

```
YzjLogEntry
  msgId:        string          // 云之家消息 id；乐观 ② 可为 local-<epochMs>
  sentAt:       number          // unix ms，融合排序键
  fromOpenId:   string
  fromName:     string          // 展示名；回填时按通讯录补，可空
  content:      string          // 文本 digest（富文本/图片/文件见 §3.3）
  msgType:      'text' | 'richText' | 'file' | 'other'
  origin:       'inbound' | 'dsh-send' | 'backfill'
  isSelf:       boolean         // 发送者 == 当前 CLI 登录用户
  replyMsgId?:  string          // 群内回复关系（产品法：链是节点引用，不是新 session）
  status:       'pending' | 'acked' | 'failed'   // 仅 ② 用 pending/failed；①/回填为 acked
  param?:       object          // CLI `param` 原样留下（file_id / desc / 引用 / 卡片）；旧 blob 无此字段仍合法
```

`origin` 判别：

| origin | 何时写入 | 产品节点 |
|---|---|---|
| `inbound` | 机器人 WS/通道投递的入站（含用户在**云之家客户端**发的）；`isSelf` 按 openId | **①**（自己发的也是 ①，T7） |
| `dsh-send` | 用户在 **DSH** 点「发进群」 | **②** |
| `backfill` | 打开/focus 绑定会话时 `im message list` 补入，且尚未被 inbound/dsh-send 占键 | 按 `isSelf` 与是否已有 `dsh-send` 同行：无 ② 则视为 ① |

回填撞上已有 `(yzjConversationId, msgId)`：**不改 origin**（② 不被回填降成 ①）。

### 3.3 非文本

日志存 **digest**（`content`）+ 可选 `param`（CLI 元数据，无二进制）。图片/文件靠 `msgType` + `param.file_id` / `param.desc` 在融合视图走与面板相同的 `file-data` 代理回源；旧 blob 只有 digest、没有 `param` 时退化成文字芯片。发进群的图片/文件：直写路径与现行 `/yzj im-send` 一致，乐观 ② 写入同一 digest 与 `param`。

### 3.4 配置（schema 字段，不是代码常量）

| 键 | 默认 | 含义 |
|---|---|---|
| `backfillLimit` | 50 | 打开绑定会话时拉取的最近条数 |
| `summonWindowMessages` | 20 | 召唤窗口最多纳入的日志行 |
| `summonWindowChars` | 4000 | 召唤窗口字符上限（对齐 `im-send` 4000 / 出站分片预算） |
| `logRetention` | 500 | 单会话 log 保留上限 |

---

## 4. 融合规则（视图，不是写官方日志）

### 4.1 输入

绑定会话的融合流 = 排序后的：

| 源 | 产品节点 | 时间戳 |
|---|---|---|
| `YzjBoundMessageLog.entries` | ① / ② | `sentAt` |
| 该 `dshSessionId` 的官方 session 事件 | ③ 用户对 agent；④ agent 轮次（含工具卡） | 事件自带时间 |
| write-gate 内存 pending（本 `sessionId`） | ④ 的挂起确认卡 | `record.time` |

未绑定：只渲染官方 ③④（外加既有引用 chip），**禁止**读消息日志。

### 4.2 排序

升序。同毫秒：①② 在 ③ 前（召唤 ① 先于其 followup 触发器）；确认卡 pending 贴在对应工具事件之后。禁止按「先全 IM 再全 DSH」分段。

### 4.3 渲染口径（验收，非像素处方）

- ①② = IM 气泡（发送人、时间、`replyMsgId` 回复关系、`isSelf` 右对齐）。**住在 DSH 会话**，不是面板第二套日志。复用面板会话 tab 的同一套渲染器：头像、括号表情（`[握手]`→🤝）、图文/文件/`file-data` 代理、引用条、链接卡、lightbox。发送人**禁止**用「群消息」占位：空名 → 通讯录 → openId 尾号 →「未知」。
- ③④ = 既有 DSH 用户轮 / assistant / 工具卡。
- ④ 已投递到群：终态「已投递到群」，不出现「机器人说：」。
- 确认卡是 ④ 的挂起态，必须出现在**这条**融合流里（pending 仍在 host 内存，视图 overlay，与现行 GUI 卡同一条 writeId）。
- **切会话分阶段**（与面板 `openGroup` 对齐，禁止闪一下）：
  1. header / 会话身份立刻换；
  2. 该 session 的融合缓存（若有）同步上屏，**不得**残留上一会话的行；
  3. cache miss：右栏「加载群消息…」，**在 `home-fused` 确认 `bound: false` 之前禁止画「私密会话」**；
  4. 先画本地 `home-fused`（插件日志，快），再 `home-backfill`（CLI）后重画；
  5. 通讯录补人名、媒体走 `file-data`。
  面板 cache miss 同样先清空上一群消息，只在右栏出「加载中…」，不得打全局顶栏 loading、不得在新群名下闪旧消息。

### 4.4 召唤 followup 不是第二句人话

云之家 @机器人 要启动 ④，harness 仍需要一次 user-turn（`followup()`）。该 ③ 是**轮次扳机**，不是产品上的第二句发言：

- 人只看见对应 ①（IM 气泡）；
- 识别：`source.kind === 'plugin'`（现行 robot followup 已带），或 followup 元数据带同一 `msgId`；
- 融合视图**不渲染**这条扳机 ③。

DSH「发给助手」的 ③ 是用户真的对助手说的话，**要渲染**。

### 4.5 视图落点（不 fork harness）

①② 不能靠 `ConversationNodeDefinition` 挂自定义事件族（那仍要 `Session.append` 已知 type）。融合发生在 **client 视图合成**：绑定 session 用插件视图把日志气泡与官方节点按 §4.2 交错。实现优先复用已有槽（`conversation.view` / 线程 overlay / 与 `conversation.input.dock` 同层的会话 chrome），**禁止**为气泡注册新的 session event type。槽位不够则记入 gap，不在本片发明 harness API。

面板消息列表在绑定落地后降为挑选器/历史；不得与 DSH 融合流各写各的「真相源」。面板若仍暂存消息，只能当回填/live 的缓存，权威是 §3 日志。

---

## 5. 模型上下文（召唤窗口）

### 5.1 何时注入

| 手势 | 是否召唤 | 模型看见 |
|---|---|---|
| 群内普通消息（无 @ 机器人） | 否（D11） | 无窗口；只写 ①（live 或下次打开回填） |
| 云之家 `@机器人` | 是 | 窗口 + 本条问句（followup）→ ④ |
| DSH「发给助手」 | 是 | 窗口 + ③ 正文 → ④ |
| DSH「发进群」 | 否 | 无窗口、无 ③、无 ④ |
| 同轮工具续写 | 跟随本轮召唤 | 窗口仍在（T4） |
| 下一轮未再召唤（含 routines 投递进绑定会话的 ④） | 否 | 不注入窗口 |

用户主动 @/拖 chip 仍走既有 codec，与窗口正交（可叠在同一轮 ③ 上）。

### 5.2 Digest 契约

函数语义：`formatSummonWindow(log, opts) → string`。

- 输入：该绑定 log 的 `acked` 行（`pending`/`failed` ② 不进模型），按 `sentAt` 升序。
- 切窗口：从末尾取至多 `summonWindowMessages` 条，再从最旧向前截到 `summonWindowChars`（超限丢更旧，保留较新）。
- **不含本轮问句对应的那条 ①**：@机器人 时去掉与 inbound `msgId` 相同的行（问句走 followup 正文）；DSH「发给助手」时日志里本无这条 ③，窗口即当前 ①② 近窗。
- 行格式（模型可见，中文标签）：`[时间] 显示名: digest`；`isSelf` 标「我」；有 `replyMsgId` 则附「回复 <短摘要或 id>」。
- 头一行固定：`［本群最近消息（仅本轮上下文，非完整群档）］`。空窗口 → 不注入（不要送空块）。

两条召唤入口**必须调用同一函数**，禁止 robot 与 DSH composer 各拼一套。

### 5.3 注入缝（与既有机制对齐）

```
云之家 @机器人
  写 ①（inbound）
  → agent.inject(createUserMessage({ content: 窗口, source: plugin }))   // 若窗口非空
  → agent.followup(createUserMessage({ content: 入站正文, source: plugin }))
  既有 memory / 群共享工作区 inject 仍按 robot-yzj 原顺序，窗口块另加，不替换它们

DSH「发给助手」
  官方 ③ = composer 正文（可含用户 chip；chip 仍 codec.serialize）
  → systemPrompt.context({ name: 'yzj-bound-window', text: (assemble) => 本轮是 GUI 召唤则窗口否则 '' })
  读 `assemble.agent.session.id`（harness `assembleContextFor`：`scope` 是 Agent 对象，不是 session id 字符串——pitfall-011）
  仅 `latestUserSourceKind === 'user'` 时返回窗口；plugin followup 已走 `agent.inject`
  无 systemPrompt 的 profile（ops daemon）不注入；`ctx.inject(['systemPrompt'])` 等待该服务
```

`agent/request` **不**用来塞窗口（改不了正文）。**不**把窗口写成用户气泡里的隐藏 chip。

---

## 6. 发送路径

闸门看发起者（D9），不看通道。

| 发起者 | 意图 | 写日志 | harness 轮次 | 确认卡 | 云之家 |
|---|---|---|---|---|---|
| 用户 | DSH **发给助手** | 否 | **③** 官方 user-turn | 无 | 否 |
| 用户 | DSH **发进群** | 乐观 ② | **无** | **无** | CLI `im message send`（`/yzj im-send`，用户本人身份） |
| 用户 | 云之家客户端发消息 | ① `isSelf`（inbound 或回填） | 无（除非同时 @ 机器人 → 另走召唤） | 无 | 已在云之家 |
| 用户 | 过渡期面板 composer 发群 | 必须写入绑定 log 为 ②，不得只写面板缓存 | 无 | 无 | 同 `im-send` |
| Agent | 提议发进群等写工具 | 否（成功投递是 ④ 终态，T12） | ④ | **标准确认** | 工具执行 |
| Agent | 删除类 | — | ④ | **强确认** | 工具执行 |
| 通道 | 已放行 ④ 投递 | 否 | 否（不是新写发起） | 不再第二张卡 | sendMsgUrl |

### 6.1 「发进群」时序

1. 绑定校验：无绑定则无此按钮（T10）。
2. 乐观：`msgId = local-<epochMs>`，`origin: 'dsh-send'`，`status: 'pending'`，`isSelf: true`，立即出现 ② 气泡。
3. `/yzj im-send` → bridge argv `im message send`（禁止 shell 插值、禁止文档外直调 CLI 写）。
4. 成功：用返回 `msgId` 改写主键；`status: 'acked'`。失败：`status: 'failed'`，气泡可重试；**不**回滚成 ③。
5. 之后任何入站/回填带同一 `(yzjConversationId, msgId)`：丢弃回声（T8）。

### 6.2 「发给助手」时序

1. 提交官方 ③（DSH 默认发送路径）。
2. 按 §5 注入窗口（本轮）。
3. 不写 ①②。用户若还想让群看见，需另走「发进群」或授权 agent 发。

---

## 7. 去重

| 碰撞 | 规则 |
|---|---|
| 同一 `(yzjConversationId, msgId)` 再次 append | 丢弃新行；**保留先写入的 `origin`**（② 不被 ① 覆盖） |
| 乐观 `local-*` 与随后真实 `msgId` | 同一行改键，不是第二行 |
| 真实 `msgId` 先回填、后「发进群」返回同一 id | 已有行视为回声：若内容/发送者一致，把 `origin` **升格为 `dsh-send`**（用户意志发生在 DSH）；否则保持 ① 并标异常，不合并正文 |
| 机器人自身出站出现在 `im message list` | 不写入（T12） |
| 通道 inbound 与 WS/Webhook 双入口 | 沿用 robot 既有 `msgId` TTL 去重，再写入本 log |

禁止用「全文相等」做默认去重（群里会重复发言）。

---

## 8. 回填与 live

### 8.1 回填（正确性底线）

**触发**：focus / 打开一条 `bound` DSH session（含挑群切换、@机器人 打开家园、丢进群着陆）。

**动作**：`im message list --group-id <yzjConversationId>`，最近 `backfillLimit` 条，按 §3.2 / §7 写入。过滤 T12。补 `fromName`（whoami / 通讯录，失败则空）。

**不够的情况**：只订阅机器人 inbound。WS 不保证全量群消息；绑定前历史、离线期非 @ 消息，没有回填就没有 ①。

### 8.2 Live（增强，不是替代）

| 来源 | 写入 |
|---|---|
| 机器人 inbound | ①，然后若是 @机器人 再召唤 |
| DSH 发进群 | 乐观 ② |
| 绑定会话处于 focus 时 CLI 增量（复用面板 `type=new` 分页） | ① 或与 ② 去重 |

未 focus 时不要求常驻全量轮询；下次打开靠回填追平。

---

## 9. Composer chrome

| 会话 | Chrome | 默认意图 |
|---|---|---|
| `unbound` | **一个**发送按钮 | 发给助手（③） |
| `bound` | **两种意图**同时可及：发给助手 / 发进群 | 不规定默认选哪一个；必须让用户一眼能分清「这句话会不会进群、会不会叫模型」 |

约束：

- 发进群不得放在面板第二 composer 作为家园入口（过渡期面板若仍能发，必须写入本 log ②，见 §6 表）。
- 既有 `conversation.input.dock`（chip 插入）保留；两种意图共享同一草稿与 @/拖拽管线。「发进群」把草稿当 IM 正文，**不**跑 codec 注入模型；「发给助手」跑官方提交 + §5。
- 未绑定不得出现「发进群」。

---

## 10. 与绑定 PR 的接缝

绑定对象与入站改打家园已落地。本片实现接缝：

1. **入站顺序**：先保证绑定 / 打开家园 → 写 ① → （若 @机器人）`formatSummonWindow` + `agent.inject` → `followup` 进**该** `dshSessionId`。禁止再 `create` `yzj-robot-*` 家园。
2. **write-gate**（T13）：见决策表。GUI 聚焦的绑定会话走 GUI 卡；入站 plugin 轮次走群建议卡。

存储：`yzj_home_logs`（与 `yzj_home_bindings` 分 domain，不 bump 绑定表版本）。融合视图落在 `conversation.view`「群工作」（order 负，不能替换官方 Chat tab——那是 harness tab ring）。官方 Chat 仍渲染 ③④；群工作 tab 是产品验收的一条流。

---

## 11. 验收口径

只读本文的评审应能回答：①② 存在哪、如何与 ③④ 合成一条流、模型何时看到群消息、发进群为何不是 user-turn、回声如何去重、打开会话为何要回填、未绑定为何只有一个按钮、为何不能 `Session.append`。实现完成时至少：

1. 绑定会话打开后，融合流能同时看到回填来的近期群消息、DSH 发进群的 ②、发给助手的 ③、助手的 ④；未绑定会话没有 ①②，只有一个发送按钮。
2. 用户从 DSH 发进群：立刻有 ② 气泡、无确认卡、模型不被这句触发；CLI 回声不出现第二条气泡。
3. 用户在云之家客户端发的消息进融合流为 ①（`isSelf`），不是 ②。
4. 群内普通消息不触发 ④；@机器人 触发 ④，人只看见一条 ①，不看见重复的插件 followup 气泡；该轮模型能读到有界窗口，下一轮未 @ 则不再带窗口。
5. DSH「发给助手」触发 ④ 且带窗口；窗口文本不作为一条永久 ③ 气泡出现在后续历史里（不经 codec 固化）。
6. 机器人自己的群帖子不作为 ① 气泡双影；④ 用「已投递」标记。
7. 重启 host 后，绑定仍在则 log 仍在；确认卡 pending 仍按既有内存语义（不假装已进 session 日志）。

阻塞项（确认卡 pending 仍非 session 事件，G3）不在本片假装已落地。绑定对象本身已落地（`ctx.yzjHome`）。

---

## 12. 本版明确不做

- 免 @ / ambient / 把每一条 ① 默认送进模型（D11 / T3）。
- 改 harness：自定义 session 事件、`Session.append` ignorable、让 `agent/request` 改消息正文、把 `conversation.view` 做成唯一 Chat。
- 解绑 UI、一条 session 绑多群、无限本地群档。
- 把云之家客户端做成 DSH 皮肤。
- 确认卡 pending 写成官方 session 事件（G3；融合视图 overlay `write-list`，SPA 刷新仍在，host 重启仍降级）。

---

## 13. 与既有设计的关系（不重写历史）

| 文档 | 关系 |
|---|---|
| [`dsh-home-session.md`](dsh-home-session.md) | 产品法。本文是 D3「四类节点一条流」的**存储与视图契约**；D1–D11 不变 |
| [`integration-master-plan.md`](integration-master-plan.md) v1.8 | 总方案只加指针。mention/codec、确认卡、`agent/request` 限制仍以总方案 §2.2 / §5.4 为准；窗口注入不走 codec |
| [`robot-channel-plan.md`](robot-channel-plan.md) | 协议（WS、ack-then-push、sendMsgUrl）不变。入站落点是绑定 session；inbound 正文先落本 log 再按 T4 决定是否 `followup` |
| [`todo-design.md`](todo-design.md) / 记忆库 | 用户直写、`systemPrompt.context` 有界注入可对照；不把待办/记忆行写进本 log |
| 根 README / AGENTS.md | 写路径两分仍以家园 D9 为准；发进群 = 用户直写，发给助手 = 官方轮次 |

## 14. v1.3 变更（2026-08-17）

切会话闪一下：融合视图曾把初始 `{ bound: false }` 当成已确认未绑定，回填 CLI 期间闪「私密会话」；面板 cache miss 会在新群名下残留上一群消息并打全局 loading。本版：

- ①② 复用面板 IM 渲染器（头像 / 表情 / 图文文件 / 引用 / lightbox）。
- 切会话：缓存同步上屏 → miss 只出右栏「加载群消息…」→ 先本地 fused 再 CLI 回填；**confirmed unbound 之前不画「私密会话」**。
- 日志可选 `param`（旧 blob 无字段仍合法），回填/发进群才能在融合流里画出媒体与引用。
