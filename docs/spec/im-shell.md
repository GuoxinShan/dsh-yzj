# IM 壳：助手单聊 + 人群房间（v3.0 产品法）

> 版本：v3.0（2026-09-03）
> 决策人：Guoxin Shan
> 定位：**本插件的表面是 IM，不是盖在 IDE 上的工作台。** 覆盖 [`group-room-topics.md`](group-room-topics.md) v2.0 的「工作台三域 + 群房间 + 话题」导航与视图模型。后端沿用：yzj-cli 0.1.6 信封、确认闸 exit 10、`yzj_*` 工具、write-gate、群时间线日志、`home-send`。不恢复待办 / AI推进 / 入站机器人 / 话题 UI / 交给助手 / 悬浮球。
> 对照：实现缺口记 [`../status/gap-analysis.md`](../status/gap-analysis.md) §25。

---

## 0. 北极星

用户打开的是即时通讯：左边收件箱，中间一条对话。助手是一类特殊单聊（Grok Bot 那种联系人），云之家群和同事私信是人群房间。工作发生在隐藏的 DSH session 里；IM 只渲染模型通过 `present` 说出口的话，以及既有 yzj 写确认卡。

---

## 1. 决策表

| # | 决策 | 结论 | 理由 |
|---|---|---|---|
| I1 | 表面 | **IM 壳**，不是工作台盖层。侧栏 workspaces **区域**换成收件箱（保留设置座）；中间栏占 `conversation.view`，默认不是官方 Chat+轨迹 | 工作台是 IDE 封面；用户只要聊天 |
| I2 | 助手基数 | **用户定义的 1..N 条助手单聊**。出厂一条「助手」。**不是**一云之家群克隆一条助手（那是机器人） | 助手是联系人品类，不是群镜像 |
| I3 | 人群房间 | 云之家群 + 同事 DM = 人群房间。时间线来自插件消息日志 / CLI；发送走 `home-send` / `im-send`（本人身份，无确认卡） | 人与人的 IM；D9 用户直写 |
| I4 | 隐藏三元组 | 每个助手一条隐藏 DSH session + cwd `~/.dsh-yzj/assistants/<id>/` + **串行队列**。助手之间可并行，同一助手内串行 | 用户不看见 workspace / 会话 id / New Session |
| I5 | IM 渲染 | 只画 (a) `present` 工具写出的气泡 (b) 既有 yzj 写确认卡。工具轨迹 / thinking / bash 只活在真实 session。弱化「查看过程」临时打开该 session | 助手 DM 是 Grok-Bot 简气泡，不是轨迹画布 |
| I6 | 群 `@助手` | **不**调用 `im message send`。点名预定义助手。锚点 = 被回复的群 `msgId`。工作挂在该消息下，**只你可见**本地线程。V1：没有回复目标的 `@` 不受理（去助手 DM）。空 composer 只 `@` 不得发到云之家 | 空 `@` 发群不可撤回；线程可见性跟容器 |
| I7 | 助手发群 | 仍走 `yzj_im_message_send` + 确认卡，以用户本人身份 | 写路径两分不改 |
| I8 | 日程 / 知识库 | **不是**首页页签。经 composer `+`、设置、或问助手调既有 `yzj_*` | 首页只有收件箱 + 对话 |
| I9 | 占位 | workspaces / layout `conversation` 是单占，二次 register 抛错（pitfall-050）。收件箱门户进 workspaces 区域；IM 占 `conversation.view` list + composer chain 藏官方条；CSS 藏 details / New Session / 文件夹树。不抄 Bruce `next/graph` / 委派 / 私账 | 核验 harness rc.7 SlotCore：single 只有一座 |
| I10 | 存储 | `present` 气泡进插件状态（domain `yzj_assistants`），**不**伪造自定义 durable session 事件（F4）。隐藏 session 日志仍是工具/确认审计；IM 投影不是那条日志的撒谎副本 | harness 禁止外部自定义事件类型 |
| I11 | 不恢复 | 入站云之家机器人、话题 UI、交给助手、悬浮球、面板第二 IM、待办、AI推进 | 公开仓已撤；本刀不回潮 |
| I12 | `present` 回退 | 模型应显式 `present`。若一轮只用了其它工具、从未 `present`，IM 停在「助手正在处理…」，直到 `present` 或回合结束时把**最后一条助手文本**回退 present——用户不能卡死。优先显式工具 | 空回合不可接受 |

---

## 2. 对象模型

```
Assistant                              // 用户定义，1..N
  id:            string                // 出厂 `default`
  name:          string                // 出厂「助手」
  prompt?:       string
  sessionId:     string                // yzj-assistant-<id>（隐藏）
  cwd:           ~/.dsh-yzj/assistants/<id>/

PresentBubble                          // IM 可见气泡
  id / role / text / at
  role: 'user' | 'assistant'

LocalThread                            // 群消息下只你可见
  groupId + msgId                      // 锚点
  assistantId
  status: 'idle' | 'processing'
  bubbles: PresentBubble[]

TurnTarget                             // 当前回合 present 落点
  | { kind: 'dm'; assistantId }
  | { kind: 'thread'; assistantId; groupId; msgId }
```

不变量：

1. 助手不是云之家会话；`HomeBindingStore` 仍只服务人群房间日志，不拿来一人一群克隆助手。
2. 同一助手同一时刻只有一个 in-flight 回合（串行队列）。
3. `present` 永不调用 `im message send`。
4. 群 `@助手` 在有 `replyMsgId` 时拦截发送；无锚点则提示去 DM，不发云之家。

---

## 3. 两种视图

### 3.1 助手 DM

Grok-Bot 简气泡。用户输入 → 隐藏 session `followup` → 模型 `present` → 左气泡。pending 写确认卡画在流里（确认/取消），不是工具轨迹。弱化「查看过程」打开真实 session 投影（工具名摘要），再「返回」。

Composer 占位「发给助手」。`input-source.ts` 的 @ 引用芯片仍可用（同事/会话/文档）。`+` 可开日程/知识库面板（不是首页页签）。

### 3.2 人群房间

人与人的 IM。Header「问助手」切到默认助手 DM。行 hover：回复 / 转发给助手。回复 + `@助手`（或转发）= 本地线程，不发云之家。

Composer 占位「发到群里，@ 可叫助手（不会发到群）」。`@` 第一组候选 = 助手列表；选助手拦截发送。同事 `@姓名` 仍走 `resolveAtMentions` + 真 IM 发送。

本地线程：左强调条 + 「只你可见」pill → 处理中 → 助手气泡 → 查看过程。

---

## 4. Occupancy

| 槽 | 动作 |
|---|---|
| `sidebar.workspaces` | **不 register**（单占，ui-workspace 已占，二次 register 抛错，pitfall-050）。门户收件箱进 `[data-slot="sidebar.workspaces"]`，CSS 藏文件夹树。设置座不碰 |
| layout `conversation` | **不占**（单占，ui-conversation 已占） |
| `conversation.view` | 占 list：id `yzj-im`、label 助手；自动点该 tab；CSS 藏 tablist。中间是 IM，不是 Chat+轨迹 |
| `conversation.composer` | chain takeover 画 `null`（composer 画在壳内） |
| `details` | 不占；IM 态 CSS 藏 |
| 工作台 overlay / 「云之家」dock / 话题 dock | **停止挂载** |

「查看过程」：IM 壳切到过程投影（读隐藏 session 事件摘要），不把工具轨迹画进气泡流。返回 = 回到 IM 投影。

---

## 5. `present` 工具

模型面、只读副作用（写插件投影，不写云之家）。参数：`text`。落点 = 该隐藏 session 当前 `TurnTarget`。Digest 告诉模型「已在 IM 显示」，UI 不把这次调用画成工具卡。

确认卡仍走既有 `WRITE_SPECS` + `yzj/confirm-request`。IM 轮询该助手 `write-list` 把 pending 卡画进当前投影。

---

## 6. yzj-cli 身份

0.1.6 `whoami` 信封 `{success, identity, data}`。展示名 / openId **不要**假定顶层字段；先 `unwrapCli`，再读 `data` 与同级 `identity`（见 `parseContactUser`）。
