# 云之家机器人通道调研与双向打通方案（对接 ui-yzj）

> 版本：v0.1（调研稿）｜ 日期：2026-08-16
> 调研来源：云之家开放平台官方文档（opendocs，2026-08-16 抓取）、openclaw-yzj v2026.4.9 源码（本地参考 `.openclaw-yzj/`，不入 workspace）、yzj-cli 实测。
> 定位：整体方案 §8「无人值守衔接点」的落地前调研 + ui-yzj 集成设计。回答两个问题：**机器人体系到底长什么样**、**双向打通怎么接进我们已经做好的东西**。

---

## 1. 机器人体系全景（三种形态 + 管理）

### 1.1 群组机器人（Webhook 机器人）——纯出站

官方文档：`/opendocs/docs/api/im/im-robot.md`、`/guide/im/robot.md`。

- **创建**：群设置 → 群组机器人 → 创建，**需群管理员**；只填名称，创建即得 Webhook 地址。
- **Webhook = 出站 API**：`POST https://…/gateway/robot/webhook/send?yzjtype=&yzjtoken=`，token 在 URL 内（`yzjtype` 即授权码，文档原话）；仅管理员可见。
- **出站消息能力**（比预想丰富）：
  - 文本：`{content}`，支持 `@All`（不区分大小写）；
  - **应用类消息 `msgType:1`**：三种样式 `customStyle` 0 原始 / 1 主次内容 / 2 图表，带 `appName/title/lightAppId/thumbUrl/webpageUrl`——webpageUrl 可跳轻应用/网页；
  - **卡片消息 `type:25`**：模板 + 数据 + 基本状态/独享状态（按人区分），见 §1.4；
  - 精确提醒：`notifyParams:[{type:"mobiles"|"openIds", values:[…]}]`，≤100 人、自动去重、仅群内成员生效。
- **限制**：每机器人 **30 条/分钟**；token 无轮换机制，泄露 = 删除重建。
- **无入站**——它听不到群消息，只能单向推送。

### 1.2 对话机器人（企业自建对话机器人）——双向主角

官方文档：`/opendocs/docs/api/im/chatbot.md`、`/guide/im/robot.md` §企业自建对话机器人。

- **创建**：群设置 → 群组机器人 → 创建自定义机器人 → **创建对话型机器人**（手机/桌面端需最新版客户端）；填名称/Logo/描述 + **消息接收地址（公网 HTTPS）**。创建时云之家发一次测试请求（固定 `secret=test-secret`、`robotId=test-robotId`，见 §2.1），**3 秒内返回正确格式才能创建成功**——这是纯本机部署的最大门槛，见 §4 spike。
- 创建成功给两样东西：**机器人密钥 appSecret**（签名验证用，泄露同样只能删重建）+ **发送消息接口地址 sendMsgUrl**（含 yzjtoken）。
- **唤起**：群内 `@机器人 消息` → 云之家 POST 到消息接收地址（或走 WS，见 §2.2）。
- **入站报文**：`{type:2, robotId, robotName, operatorOpenid, operatorName, time, msgId, content, groupType}`；header 带 `sign`（验签）+ `sessionId`。
- **同步响应契约**：每次请求 **3 秒内**回 `{success, data:{type, content}}`，超时用户侧显示「哎呀,出现了点小问题」。**LLM 不可能同步出活** → 唯一可行模式是 **ack-then-push**：立即回 `{success:true, data:{type:2, content:""}}`，agent 处理完经 sendMsgUrl 主动推回（openclaw-yzj 正是这么实现的，已验证可行）。
- **出站**：sendMsgUrl 同 §1.1 全套（文本/应用卡片/notifyParams），另有引用回复 `param:{replyMsgId,…} + paramType:3`；回复也支持卡片 `type:25`。

### 1.3 个人机器人——待登录实测

- 入口 `https://www.yunzhijia.com/im/personalRobotCreate`（openclaw README 给出），**重定向登录页，未登录抓不到内容**。
- openclaw 对它与群机器人用同一套协议（sendMsgUrl + websocket 推导），推断是**无需群管理员**的个人对话机器人入口。
- 未决问题（需登录后实测）：会话形态（单聊？）、`groupType` 取值、能否不挂群使用、创建时是否同样强制公网测试。见 §4。

### 1.4 消息卡片（type 25）——机器人也有交互按钮

官方文档：`/opendocs/docs/server-api/cardmsg.md`。

- 卡片搭建工具：`https://www.yunzhijia.com/developers/`（可视化，产模板 ID）。
- 模板 + 数据（`${var}` 变量）+ 状态（基本状态全员可见；**独享状态按人区分**，审批类卡片的经典用法）。
- **回传交互**：提交按钮 + 输入控件 → 用户点按钮 → 云之家把 `{oid, outTrackId, eventData}` POST 到**模板上配置的回调地址**；卡片可更新（基本/独享状态均可，独享优先）。
- **对本方案的意义**：「机器人建议动作 → 人确认」的确认卡可以在**云之家侧**做成真按钮（不再只能群内文本回复「确认」）——但前提是有公网回调地址。本机场景先用文本确认，卡片按钮作为公网部署时的增强。修正此前「机器人消息无交互按钮」的判断。
- 跳转交互支持 cloudhub 协议（deep link 回跳云之家原生页面/轻应用）——todo deep link 需求的现成通道。

### 1.5 机器人管理

- **无个人可用的集中管理 API**；群机器人管理收在群设置（管理员）；yzj-cli v0.1.3 实测**无任何 robot 子命令**（`unrecognized subcommand`）——机器人配置无法 CLI 化，只能 Web 手工操作，我们的产品要做**引导**而不是自动化。
- 密钥生命周期：appSecret 创建时一次性展示；泄露处理统一为删除重建（无轮换）。文档明示 webhook「仅管理员可见」。
- 频控：群机器人 30 条/分钟（对话机器人未文档化，spike 观测）。

### 1.6 顺带发现：官方待办 API（影响 `../migration/todo-backend-migration.md`）

`/opendocs/docs/api/im/im-todo.md`：`generatetodo.json / action.json / checkcreatetodo.json` 三接口。

- 幂等主键 `openId+appId+sourceId`（与我们的稳定 ID 理念天然对齐）；同步/异步双模式；`url` 字段即 deep link；`todoType` 0 通知中心 / 1 待审批。
- **门槛**：app 级 accessToken + 轻应用 secret（管理员在管理中心-应用管理获取）→ **企业级能力，个人用户不可用**。
- **硬约束**：状态不可逆（待处理→已处理，不支持回退）——与我们「done→in_progress 重开」语义冲突；**无变更 webhook**（§5 清单里那条官方确实没有），用户在云之家侧处理需轮询 `checkcreatetodo` 感知。
- 结论：todo 迁移的目标后端多一个选项（企业团队库 + 自建轻应用时可升原生待办），个人库维持 dbt；映射时不可逆状态机要单独设计（建议：重开 = 删旧建新换 sourceId，文档 FAQ 6 给了官方口径）。

### 1.7 依赖分层：零注册可推进 vs 必须开放平台协调

> 结论先行：**R0–R2 主线（双向打通 MVP）全部落在 A+B 两层，零开放平台依赖，可立即推进**；需要跨部门协调的只有 D 层三块（原生待办后端、卡片更新/订阅号、应用身份 API），均不阻塞主线，协调可并行启动。

| 层 | 能力 | 获取方式 | 谁能自助 | 状态 |
|---|---|---|---|---|
| **A. CLI 用户身份**（已落地） | 六域 45 工具 + 面板 + todo demo | `yzj-cli auth login`（OS keychain） | 每个用户自己 | ✅ 已在跑 |
| **B. 机器人自助**（openclaw-yzj 已验证的路径） | 群 Webhook 机器人**出站**（文本/@All/notifyParams） | 群设置→群组机器人→创建，复制 Webhook URL 粘进配置 | **群管理员**，无需任何注册 | 协议已验证，待接入 |
| | 对话机器人**WS 双向**（入站触发 agent + 出站回推/引用回复） | 群设置→创建对话型机器人：一次性公网测试（临时隧道可过）→ 得 appSecret + sendMsgUrl → 此后 WS 出站长连接免公网 | **群管理员**，无需任何注册 | 协议已验证，待 spike ①②③ |
| | 个人机器人（免群管理员入口，协议同上 + DM 形态） | `yunzhijia.com/im/personalRobotCreate` | 每个用户自己 | ✅ **已实测（§4.1）：创建零门槛、WS 双向、全协议通过** |
| | HmacSHA1 验签 / msgId 去重 / WS 重连 | 随机器人创建附带（appSecret + sendMsgUrl） | — | openclaw 四模块直接移植 |
| **C. 灰色待验证**（可能无需企业应用，但需某种账号/字段） | type:25 卡片**一次性发送**（模板来自卡片搭建工具 `yunzhijia.com/developers/`） | 搭建工具账号性质未知 | 待验证 | spike ⑥ |
| | msgType:1 应用类消息（文档标注 `lightAppId` 必填——是否接受非注册值未知） | 待验证 | 待验证 | spike ⑥ |
| | 卡片**回传交互**（回调地址配在模板上） | 需公网 HTTPS 回调 | — | 本机场景不用；公网部署时评估 |
| **D. 必须开放平台/跨部门协调** | **原生待办 API**（generatetodo/action/checkcreatetodo） | accessToken（oauth）+ 轻应用 secret（**管理中心-应用管理，管理员**）；app 级授权 | ❌ 需协调 | todo 原生后端选项，不阻塞 demo |
| | 卡片**更新**（基本/独享状态） | 必须真实有效 appid（=轻应用） | ❌ 需协调 | R3 增强 |
| | 订阅号推送（pubacc/pubsendV2） | 订阅号 id+secret（订阅号管理员）+ pubtoken | ❌ 需协调 | 未纳入路线 |
| | 应用身份 IM 开放 API（`/api/im/index` 等以应用发消息、org 同步） | accessToken + 企业授权 | ❌ 需协调 | 未纳入路线 |

**对推进节奏的含义**：现在就能动手的是 A+B——spike ①–⑤、`packages/robot-yzj` 协议层、WS 入站→session→回推、面板设置卡。找其他部门协调的申请（轻应用注册 + secret、必要时订阅号）**今天就并行发起**，因为它只影响 R3（卡片增强）和 todo 原生后端迁移，周期再长也不卡主线。

---

## 2. 协议细节（源码 + 文档交叉验证，实现直接抄这里）

### 2.1 签名验签（修正官方文档笔误）

- 摘要串：`robotId,robotName,operatorOpenid,operatorName,time,msgId,content` 逗号拼接。
- 算法：官方文档正文写「HmacSHA256」，但同页 Java 示例实为 **HmacSHA1**；openclaw-yzj 用 SHA1 且线上工作。**以 SHA1 为准**。
- Base64 输出放 `sign` header。openclaw 的实现缺陷要修掉：比较未用 timing-safe（自写了 `timingSafeEqualBuffer` 却没接上）——移植时接上。
- 创建时的测试请求 secret 固定为 `test-secret`，`robotId=test-robotId`（跳过验签放行该固定值即可）。

### 2.2 WebSocket 入站（免公网，本机场景的生命线）

- 推导规则（openclaw `ws-url.ts`）：`sendMsgUrl` 取 host + `yzjtoken` → `wss://{host}/xuntong/websocket?yzjtoken={token}`。
- **出站长连接**：不需要任何公网回调/端口，个人本机 dsh 直接可用。
- 帧协议为 openclaw 行为逆向（auth/ping/pong/ack 控制帧 + 消息帧），心跳 ping、陈旧检测、指数退避重连、坏帧计数强制重连的工程实现可直接移植（`websocket-client.ts`）。
- 修复项：连接选项 `rejectUnauthorized:false` 必须去掉。
- Webhook 与 WS 双入口并存时按 `msgId` 去重（TTL 10min Map，`dedupe-store.ts`）。
- `sessionId` header（仅 Webhook 入站携带）：同用户同群同机器人 30 分钟内共享——**只能当活跃会话线索，不能当持久 session key**。

### 2.3 出站语义（实测确认）

- `groupType===3`：群聊语境，**不带 `notifyParams`** 广播全群；否则带 `notifyParams:[{type:"openIds",values:[operatorOpenid]}]` 只提醒发送者（形成私聊形态回复）。
- 引用回复：`param:{replyMsgId, replySummary, replyPersonName, isReference:true} + paramType:3`。
- 每分钟 30 条频控下的播报策略要合并/限流。

### 2.4 未验证的三件事（spike 清单，见 §4）

robotId 与 CLI groupId 的 ID 空间映射；创建流程的公网测试是否可绕过（决定部署门槛）；`xuntong/websocket` 真实帧格式（openclaw 的逆向可能不完备）。

---

## 3. 双向打通：接进 ui-yzj 的设计

### 3.1 要不要做？——做，但定位是「增量身份」而非替换

- 整体方案 §8 早已预留：无人值守（入站触发 + 出站播报）只有机器人身份能做，CLI 用户身份做不了（凭据在 keychain、无推送通道）。
- 但**推送只覆盖机器人所在群**：用户其余群/私聊的未读仍走现有 CLI `unreadCount` 轮询。§5.3 第一层「整体替换为真推送」修正为**混合模式**：机器人群推送、其余照旧轮询。
- 写路径从两分变三分：用户直写（面板，不经确认卡）/ agent 写（工具 + 确认卡）/ **机器人无人值守写**（新路径，门控语义见 3.4）——§5.5「待拍板成文」的原则要扩写。

### 3.2 新增包 `packages/robot-yzj`（host 面为主）

```
协议层（移植 openclaw 四模块 + 修复）     ws-url 推导 / HmacSHA1 验签(timing-safe) / msgId 去重 / WS 客户端(去 rejectUnauthorized)
账户与配置                               sendMsgUrl + appSecret + allowFrom 白名单（openId 列表）
                                         挂 harness 配置（bundle cordis.patch.yml 带 config schema）
入站路由                                 operatorOpenid+robotId → DSH session 映射（每群一个 session）
                                         ack-then-push：入站即回空 content，异步 dispatch 进 session
出站播报服务 ctx.yzjRobot                 send(text|card, {notify, reply}) —— 三处消费：
                                         ① 入站回复 ② schedule 播报（替换机器人群的轮询触发）
                                         ③ 待办催办（todo §5「IM 通知」的落地通道）
生命周期                                 全部经 ctx.effect() 注册，插件停用即断连、无残留
```

关键决策：**WS 客户端跑在 host 进程**（Node），不走浏览器 WebSocket——host 存活即可收消息（与「第二层播报 host 侧执行」同前提），浏览器只消费状态与通知。

### 3.3 ui-yzj 的结合点（现有代码的落位）

| 现有结构 | 结合方式 |
|---|---|
| `/yzj` RPC 通道（`ui-yzj/src/index.ts`） | 新增端点：`robot-status`（连接状态/最近入站）、`robot-send`（面板直发，用户直写语义）、`robot-config`（读写机器人配置 + 连接测试） |
| 面板 tab（`panel.tsx` TABS） | 不加第六 tab；在**悬浮球快捷坞**加「机器人」入口 → 设置卡（sendMsgUrl 粘贴即推导 WS 地址、连接状态灯、allowFrom 管理、创建引导文案——把 §1.2 的 Web 操作步骤内置成图文向导） |
| 未读角标聚合（`stores.ts` + unreadTotalOf） | 机器人入站消息计数并入聚合：来源标记 `robot`，点开落对应群的会话 tab（有映射时）或机器人会话视图 |
| write-gate（`write-gate.ts` approval/request） | 机器人触发的写**不经 GUI 确认卡**（人不在 GUI 前）——走 §3.4 的群内确认协议；write-gate 保持只服务 GUI 路径，不混 |
| ConversationNodeDefinition 卡片族 | 入站消息在 session 里渲染为带群/发送人上下文的轮次；机器人回复带「已推送到群」终态标记 |
| im-cache（`im-cache.ts`） | 机器人所在群的消息缓存复用现有 groupId 通道回源（依赖 spike：robotId↔groupId 映射） |

### 3.4 安全模型（机器人无人值守写的门控）

- **allowFrom 白名单**：openclaw 只支持 pairing 且不支持 allowFrom——我们按 `operatorOpenid` 自建白名单（默认仅 CLI 登录用户本人可指挥），面板可管理。
- **动作分级**（对齐 guard 的 WRITE_SPECS 理念）：
  - 只读动作（查日程/查文档/列待办）：白名单内直接执行直接答；
  - 低风险写（建待办、给自己发提醒）：白名单内直接执行 + 播报结果；
  - 高风险写（发消息给别人、删文档、改表）：**建议卡协议**——机器人推「建议 + 编号」，白名单用户在群里回复「确认 N / 取消 N」（文本协议，30 分钟窗口），或回 GUI 走原有确认卡；两通道都收敛到同一 writeId 状态机。
- **审计**：入站 msgId、决策人 openId、执行结果全部进 session 日志（Trajectory 可回放），与 §5.5 审计原则一致。
- 频控护栏：出站 30 条/分钟内做合并与节流，避免 agent 长回复刷屏（分片 + 引用回复挂接）。

### 3.5 分期（按 §1.7 依赖分层标注）

- **R0 spike（半天~1 天，先决；依赖 A+B，零注册）**：§4 清单 ①–⑤ 逐项实测，任何一项不过都要回头改设计。⑥（卡片实发）顺带做，结果只影响 R3。
- **R1 MVP（依赖 B）**：robot-yzj 包协议层 + WS 入站 → session → agent → 回群（ack-then-push）；面板机器人设置卡 + 状态灯；allowFrom 本人限定。
- **R2 协作（依赖 B）**：建议卡协议（群内文本确认 + GUI 确认卡双通道）；schedule 播报与待办催办接入 `ctx.yzjRobot`；角标混合聚合。
- **R3 增强（可选；部分依赖 D——开放平台协调项）**：卡片消息（type 25）一次性发送若 spike ⑥ 通过则 C 层可用；卡片**更新**与独享状态、原生待办后端 = D 层，等协调到位；公网部署形态（Webhook 双入口 + 卡片按钮确认）。

> 协调申请（D 层：轻应用注册 + secret、原生待办 API 授权；订阅号视需要）在 R0 启动时并行发起，目标只覆盖 R3 与 todo 迁移，不进 R1/R2 关键路径。

### 3.6 会话管理模型：全功能对齐 Claude Tag（Slack）

> 调研来源：Claude 官方文档 claude.com/docs/claude-tag/*（2026-08-16 抓取：overview / how-it-works / commands / getting-started / memory / when-claude-responds）。目标不是「能回消息」，而是下表每项能力对齐、或显式给出云之家协议下的等价物/降级物。

#### 3.6.1 Claude Tag 会话模型事实清单（官方文档提炼）

| # | 能力 | Claude Tag 行为 |
|---|---|---|
| C1 | **会话单位 = thread** | 每个 thread 一个 session；另有每频道一个顶层 ambient session（响应无 @ 的消息时用它工作） |
| C2 | **发起** | 频道内 `@Claude + 任务` 即开 session；**频道任何成员**都可发起 |
| C3 | **steering** | session 在 thread 激活后「属于那里的所有人」——**thread 内回复（无需再 @）即可转向**，任何成员不限发起人 |
| C4 | **进度面** | 「is thinking…」行 + **checklist（Done/In progress 原地更新）**；结尾带 Open session in Claude 只读全记录链接（含每个工具调用）+ Configure 链接 + 所用模型 |
| C5 | **命令族**（bang 前缀、独立成句，附加词降级为普通 prompt） | `!help`；`!configure`（频道配置页链接）；`!restart`（thread 内=换 thread session 且**重读 thread 历史、保留消息内容丢弃额外上下文**；顶层=换频道 session）；`!mute`/`!unmute`（**按 thread** 静音，直接 @ 自动解除；无频道级静音）；`!feedback [text]`；`!routines [#频道]`（列例行任务，结果仅提问者可见）；`!fork #频道 <prompt>`（thread 会话续到新频道新 thread，双向链接，仅公开频道） |
| C6 | **响应触发三档** | DM=永远响应（无需 @）；已加入的 thread=永远响应；频道顶层=**按判断响应**（Respond automatically 频道级开关，@=保证响应） |
| C7 | **自静音** | 频道消息持续无可响应内容时自动关闭主动回复 |
| C8 | **编辑/删除语义** | 编辑→收到 before/after 便签但**不据此行动**（纠错需新回复）；删除→无通知；删 thread 根消息（已有回复）→session 保留 |
| C9 | **记忆归属频道**（非用户） | 显式「remember for this channel」+ 自动沉淀事实 + **可回读该频道过往 session 转录**（按时间/主题，非全文检索）；公开频道记忆全 workspace 共享，私有频道隔离（own store + 只读 workspace）；长 playbook 官方建议放仓库而非记忆 |
| C10 | **DM vs 频道** | DM 跑在**发起者自己的账号/连接器**上（归因个人）；频道跑在管理员为该频道配的连接上（agent 身份）；DM 仅 1:1 |
| C11 | **例行任务 routines** | 计划任务、频道 watch、PR 订阅——独立触发、主动投递进频道 |
| C12 | **回复署名** | ambient 回复署名「Claude」；任务回复署名「Claude [任务描述]」 |
| C13 | **沙箱生命周期** | 会话开始创建（持有工作文件），**闲置即弃** |
| C14 | **入群自我介绍** | 首次被邀入频道：读历史、建议几个可接任务 |

#### 3.6.2 云之家协议约束（与 Slack 的硬差异）

| 差异 | 影响 |
|---|---|
| **无 thread 原语**：只有引用回复链（replyMsgId） | thread≈回复链；锚定依赖「机器人消息 msgId → session」映射（见 S1） |
| **机器人只收 @ 消息**；引用回复机器人但不带 @ 是否送达**未知** | C3「无需再 @」需 spike ⑦ 验证；不可达则降级「链内回复需带 @」（@ 保证响应语义仍在） |
| **消息不可编辑** | C4 checklist 原地更新不可达 → 降级为里程碑分段推送（30 条/分预算内）或 R3 卡片状态更新 |
| **无编辑/删除事件推送** | C8 大部分语义 N/A（简化而非损失） |
| **群/私聊由 groupType 区分**；出站 notifyParams 可单发 | DM 语义 ≈ 个人机器人/单发回复模式 |
| **3 秒 ack** | ack 文本本身即「is thinking…」等价物（C4 前半天然达成） |
| **可读群历史**（CLI `im message list`）+ **DSH session/Trajectory 本地全量在册** | 比 Claude Tag 更强：session 全记录无需云端链接；「重读 thread」可真回源 |

#### 3.6.3 对齐设计（S 系列，每项标注对应 C#）

**S1 会话单位与锚定（C1/C2/C3）**
- 私聊面（个人机器人，或 groupType≠3 单发语境）：**每用户×机器人一个持久 session**（= C10 DM 语义：无需 @、消息即指令；群内单发回复也归入该用户 session）。
- 群聊面（groupType=3）：
  - **顶层 @机器人（非引用）→ 开新 session**，锚定该消息 msgId；
  - **引用回复机器人消息 → 接续该消息所属 session**（查 msgId→session 映射；⑦ 实测：出站响应直接带 msgId、入站 msgParam 带 replyRootMsgId，登记与接续均为 O(1) 查表）；
  - 链内任何成员可 steer（C3「属于所有人」）；带 @ 保证送达（C6 语义）；
  - **每群另设一个 ambient session**：承载 routines 播报、待办催办等主动投递（C1 频道 session 对应物）；顶层无 @ 消息协议收不到，C6 的「按判断响应」档标记 **N/A-v1**，其价值由 ambient session 的 routines 覆盖。
- session 实体 = **DSH live session**（followup 进同一 session；Trajectory 即全记录）——C13「闲置即弃」弱化为 DSH session 常驻（更强，无对齐缺口）。

**S2 进度面（C4/C12）**
- ack 即时回「收到，处理中…」+ 引用用户消息（replyMsgId 引用卡片）= is thinking + 上下文锚定；
- 长任务按里程碑分段推送（checklist 文本形态：已完成/进行中），受 30 条/分节流合并；
- 每次交付末尾附 **「在 DSH 中打开会话」deep link**（GUI 会话 URL）= Open session in Claude（等价达成）；R3 卡片消息可升级为可更新 checklist；
- C12 署名等价：回复首行任务摘要（协议无显示名变体）。

**S3 命令族（C5，全量实现）**

| 命令 | 行为 |
|---|---|
| `!help` | 列出可用命令与当前群配置摘要 |
| `!configure` | 回复面板「机器人设置卡」deep link（GUI 即配置页） |
| `!restart` | 归档当前 session（Trajectory 留档），新 session **回读本链历史**（`im message list` 按 replyMsgId 链回源重放为上下文——C5「重读 thread、丢弃额外上下文」语义）；链内执行=重启该链 session，顶层执行=重启群 ambient session |
| `!mute` / `!unmute` | 按 session/链静音（配置标记；直接 @ 自动解除）；群级降噪=面板「仅 @ 响应」开关（云之家下天然默认，协议只送 @） |
| `!routines` | 列出本群 schedule 例行任务 + watcher（DSH schedule 子系统），**仅提问者可见**（单发 notifyParams） |
| `!fork <群名/群ID> <指令>` | 当前 session 上下文摘要交接给目标群新 session，双群各回一条带引用的交接消息（跨群双向链接降级为引用回链；要求机器人在两群） |
| `!feedback <文本>` | 写入本地反馈日志 + 回执（可选转发维护群） |

**S4 记忆（C9）**
- 归属**群/机器人**，不归属用户：「记住本群规则：…」→ per-group 指令集（配置内，小而稳定）；
- 长 playbook → **云之家知识库文档**（官方同款建议「仓库>记忆」；我们有现成 doc 域，agent 可读写）；
- 回读过往 session：DSH session 注册表按群列出历史会话 + Trajectory 转录（C9 第三条等价，且可全文检索——更强）；
- 公开/私有频道记忆隔离（C9）≈ 企业知识库 vs 个人知识库边界，天然对齐。

**S5 触发与静音（C6/C7/C8）**
- 私聊=永远响应；链内（引用机器人消息）=响应；顶层=@ 才响应（协议决定，恰为 Claude Tag 保守档）；
- C6 判断档 N/A-v1（无全量消息流），价值由 routines 补足；C7 自静音随之 N/A；
- C8 编辑/删除语义整体 N/A（协议无事件），纠错=新回复（与 Claude Tag 实际指引一致）。

**S6 例行任务（C11）**：DSH schedule（every ≥5min）+ 群 watcher（CLI 轮询增量，混合模式 §3.1）→ 经 ambient session 投递；PR 订阅类无对应源，N/A。

**S7 入群自我介绍（C14）**：机器人配置完成后**首次收到某群消息**时，读该群近期历史（CLI）+ 给出 3 个建议任务——低成本对齐。

**S8 命令解析安全**：bang 命令独立成句才生效（对齐 C5：附加词降级为普通 prompt）；命令权限 = 该 session 的消息权限（observer 不能 restart 他人 session——allowFrom 白名单 + 链内成员判定）。

#### 3.6.4 对齐总表（验收用）

| Claude Tag 能力 | 我们的实现 | 状态 |
|---|---|---|
| C1 thread/频道双 session | S1 回复链 session + 群 ambient session | ✅ 等价 |
| C2 任何人可发起 | S1（allowFrom 白名单内任何成员） | ✅ |
| C3 链内免 @ steering | 引用回复接续 session；DM 已实测（引用消息必达）；群内免 @ 待群机器人补测 | ✅ DM / ⚠️ 群 |
| C4 进度/checklist/全记录链接 | S2 ack+里程碑推送 + DSH 会话 deep link；原地更新→R3 卡片 | ✅ / R3 增强 |
| C5 命令族 7 条 | S3 全量实现（!fork 跨群交接降级） | ✅ |
| C6 触发三档 | 私聊/链内/@（保守档） | ✅（判断档 N/A） |
| C7 自静音 | N/A（无全量流，价值由 routines 覆盖） | ➖ 显式放弃 |
| C8 编辑/删除语义 | N/A（协议无事件） | ➖ |
| C9 频道归属记忆 | S4 per-group 指令 + 知识库 playbook + session 转录回读 | ✅ 等价或更强 |
| C10 DM/频道双身份 | 私聊=CLI 用户身份上下文，群=机器人身份 | ✅ |
| C11 routines | S6 schedule + watcher | ✅ |
| C12 任务署名 | 回复首行任务摘要（文本等价） | ✅ |
| C13 沙箱闲置即弃 | DSH session 常驻 | ✅ 更强 |
| C14 入群自我介绍 | S7 | ✅ |


---

## 4. Spike 验证清单（动手前必须过）

| # | 验证项 | 方法 | 不过的后果 |
|---|---|---|---|
| 1 | 创建对话机器人是否强制可用的公网 HTTPS 测试地址；**WS-only 是否长期可用**（测试仅发生在创建时？） | 临时隧道（ngrok/frp）过创建 → 断隧道 → 观察 WS 推导连接是否持续收消息 | 若 WS 需要创建后持续回调，本机方案坍塌，转公网部署形态 |
| 2 | `robotId` 与 CLI `groupId` 是否同 ID 空间；入站消息能否在 `im message list` 回源 | 群里 @机器人发消息 → 拿 robotId 对照 `yzj_im_group_recent` / `yzj_im_message_list` | 不映射则面板锚定/回源/im-cache 复用全部落空，机器人会话需独立视图 |
| 3 | `xuntong/websocket` 真实帧协议（auth/ping 间隔/ack 格式） | 抓包对比 openclaw 帧分类；长时间连接观察心跳 | 帧分类不完备则重写 WS 客户端解析层 |
| 4 | 个人机器人（personalRobotCreate）形态：会话类型、groupType、创建流程是否同样卡公网测试 | 登录云之家实测 | 个人入口不可用时，无群管理员权限的用户无法自建机器人（产品边界收窄为群管理员可用） |
| 5 | 对话机器人频控与消息长度上限 | 压测观察 | 播报分片策略参数化 |
| 6 | 出站 `msgtype:1/25` 从 sendMsgUrl 发是否真的可用（文档只给了群机器人样例） | 实发验证 | 卡片增强（R3）降级为纯文本 |
| 7 | **引用回复机器人但不带 @ 是否送达**（S1/C3 链内免 @ 的前提）；**sendMsgUrl 响应是否返回 msgId**（msgId→session 映射登记的来源；若无则出站后经 `im message list` 回捞） | 群里引用机器人消息不 @ 它观察 WS 入站；发消息查响应体；对照 `im message list` | 免 @ 不可达→链内 steering 需带 @（降级可用）；msgId 拿不到→靠回捞（稍重）或按时间窗锚定（最后手段） |

### 4.1 R0 实测结论（2026-08-16，个人机器人通道，全部通过）

> 环境：真实个人机器人（web 个人入口创建，`yzjtype=0`），本机 Node 25 原生 WebSocket 直连，探针/工具与原始帧日志见 `spike/robot/`（凭据与日志 gitignored）。**个人机器人通道上 R0 全部验证项通过，MVP（R1/R2）可在此通道先行落地，群对话机器人补充群场景。**

| # | 结果 | 证据 |
|---|---|---|
| ① | ✅ **个人机器人创建完全不要求接收地址**（无公网测试、无隧道）；WS 出站长连接即全部入站 | 用户创建流程实录；`wss://www.yunzhijia.com/xuntong/websocket?yzjtoken=…` open 即认证（首帧 `{"success":true,"cmd":"auth"}`） |
| ② | ✅ **同 ID 空间**：机器人 DM 就是 CLI 可见的普通会话（`im group recent` 首项「个人助手 · 类型3」，groupId `BOT-<uid变体>-BOT-<robotId>`）；`im message list` 完整回源（含机器人消息与引用关系） | CLI 实测双向对照 |
| ③ | ✅ **WS 帧协议实测**（比 openclaw 逆向更完整）：`directPush/robotMessage`（完整入站消息）；`directPush/msgChg`（消息变更，**带 needAck+seq**，如 replyCount 变更）；`message/lastUpdateTime`（同步信号）；30s pong 心跳；**机器人自身出站不回环**（无 echo 风险） | 帧日志 `spike/robot/logs/ws-*.ndjson` |
| ④ | ✅ **个人机器人形态**：DM 场景（groupType=3 的 BOT-BOT 通道）、创建零门槛、**自带 nomi 云 AI 应答**（历史可见）；网页版 DM 无用户侧引用 UI（但引用元数据通道存在，见⑦） | 创建流程 + 历史消息实录 |
| ⑤ | ✅ **频控远宽于文档**：35 条 @800ms（≈75 条/分）全部成功（「30 条/分」为群机器人限制）；**长度上限 5000–6000 字之间**（5000 OK / 6000 FAIL，超限返回 HTTP 200 + `errorCode 1401002 "消息内容太长"`，可检测、可分片） | 压测记录 |
| ⑥ | ✅ **应用类消息 API 接受**（lightAppId=0 不报错）；**卡片消息超预期：假 templateId（全零）也渲染出真卡片**——R3 卡片增强不依赖卡片搭建工具/D 层 | 用户客户端实看确认 |
| ⑦ | ✅ **a）入站推送带全套回复链元数据**：`msgParam:{replyMsgId, replyPersonId, replyPersonName, replySummary, replyRootMsgId}`——**服务端自带链根 replyRootMsgId**，session 锚定无需自行回溯；**b）出站响应直接返回 msgId**（与消息历史一致），映射登记零回捞 | 帧日志 + CLI 对照 |

**对设计的三点修正（并入 §3）**：
1. **R1 MVP 直接落在个人机器人 DM 通道**——零创建门槛、免公网、全协议验证通过；群对话机器人（需公网测试创建）降为群场景增强，不在 MVP 关键路径。
2. **S1 锚定简化**：出站响应带 msgId（零回捞）+ 入站带 replyRootMsgId（零链回溯）——「msgId→session」映射登记与「回复接续 session」判定都是 O(1) 查表。
3. **出站预算**：单条 ≤5000 字（agent 长回复分片线）；速率按 75 条/分内做节流合并即可（保守取 30 条/分仍有 2.4 倍余量）。

**遗留观察项**：WS 长连接 ≥1h 稳定性（探针挂机中，结论后补）；群对话机器人创建流程（公网测试是否强制）待群场景立项时补测。

---

## 5. 对现有文档的修订项

- `integration-master-plan.md` §5.3「下期替换：第一层轮询替换为真推送」→ 修正为混合模式（§3.1）；§8 补本文链接与建议卡协议。
- `../migration/todo-backend-migration.md` §4 迁移步骤 → 增加原生待办 API 后端选项及企业门槛/不可逆状态机注意事项（§1.6）；§5「变更 webhook」标注官方 API 亦无。
- `../status/gap-analysis.md` → 机器人通道立项后补对照节。

## 6. 参考来源

- 官方文档（2026-08-16 抓取，`www.yunzhijia.com/opendocs/docs/`）：`api/im/im-robot.md`、`api/im/chatbot.md`、`guide/im/robot.md`、`server-api/cardmsg.md`、`api/im/im-todo.md`
- Claude Tag 官方文档（2026-08-16 抓取，`claude.com/docs/claude-tag/`）：`overview.md`、`concepts/how-it-works.md`、`users/commands.md`、`users/getting-started.md`、`users/memory.md`、`users/when-claude-responds.md`（会话模型对齐基准，§3.6）
- openclaw-yzj v2026.4.9 源码（本地 `.openclaw-yzj/`，MIT）：`ws-url.ts`、`signature.ts`、`websocket-client.ts`、`dedupe-store.ts`、`monitor.ts`、`inbound-dispatcher.ts`、`onboarding.ts`
- yzj-cli v0.1.3 实测：无 robot 命令（`unrecognized subcommand 'robot'`）
- 整体方案 §8、§5.3、§5.5；待办后端迁移说明 v1.0

---

## 7. 实现状态（R1 MVP host 面已落地，2026-08-16）

> 代码：`packages/robot-yzj`（host 包，bundle 第 5 行挂载，`ctx.yzjRobot` 服务）；验收证据见 `../status/gap-analysis.md` §17。设计基线 = 本文 §3.2/§3.6 的 DM 子集（S1 持久 session / S2 ack-then-push / S3 命令族子集 / S5 触发 / S8 命令解析安全）。

### 7.1 已实现面

| 模块 | 内容 |
|---|---|
| `src/protocol.ts` | 实测帧分类（`auth` / `pong` / `message+lastUpdateTime` / `directPush robotMessage` / `directPush msgChg`）、`deriveWebSocketUrl`、`msgParam` 回复链解析（含 `replyRootMsgId`）、TTL msgId 去重 |
| `src/socket.ts` | 重连管理：30s `{cmd:"ping"}` 心跳、陈旧检测（120s 无帧强制重连）、指数退避（1s 起、30s 封顶）、停止清空全部定时器；socket/timer/clock 全可注入 |
| `src/outbound.ts` | sendMsgUrl 出站：`msgtype:2` 信封、`param/paramType:3` 引用卡、`notifyParams` 定向、响应 msgId 提取、4000 字分片（上限实测 5000–6000，`1401002` 映射 too-long）、串行化限流（默认 1.2s/条） |
| `src/router.ts` | 每 (robot, user) DM 持久 session（id `yzj-robot-<robot>-<user>`）；ack-then-push（ack 即 is-thinking 面；`whenIdle()` 后按 seq 水位收 `assistant/message` 文本推回，防重发）；独立成句 bang 命令 `!help/!status/!mute/!unmute/!restart`；allowFrom 鉴权（默认解析 CLI 登录用户 openId，其余拒绝且不建 session）；`dispose()` 清全部句柄 |
| `src/index.ts` | `ctx.yzjRobot`（`getStatus/send/dmSession`）+ Config（`sendMsgUrl`/`enabled`/`allowFrom`）+ `ctx.effect` 生命周期（停用即断连清态） |

### 7.2 挂机观察补充（探针 19 分钟）

- WS 零断连（pong 30s 稳定）——spike ① 长稳定性的部分证据；
- 新帧型 `extSystemMsg`（`user_status` 系统通知）——分类器按 `other` 容忍；
- **未 ack 的 `msgChg`（`needAck:true, seq:N`）被服务端每 ~90s 重推同一 seq**——ack 帧格式未实测；MVP 不消费 msgChg，仅为日志噪音；**ack 实现列入 R2**（抓包确认形状后补）。

### 7.3 未实现（对应 §3.5 分期）

- 面板机器人设置卡 + `/yzj` RPC 端点（`robot-status`/`robot-send`/`robot-config`）→ R1 UI 半（下一步）；
- 群场景（群聊锚定、`!fork`/`!routines`、ambient session、群内建议卡）→ R2；
- 卡片消息（type 25）、watcher 混合角标 → R2/R3。
