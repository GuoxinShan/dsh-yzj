# OpenAPI 依赖清单（终态「开放 API 直连」口径）

> 版本：v1.0 ｜ 日期：2026-08-24
> 背景：终态在灵基侧重建（[`../migration/advance-lingee-migration.md`](../migration/advance-lingee-migration.md) 组件映射第一行：**bridge → 开放 API 直连**）。本文把 MVP 期经 yzj-cli（用户登录态）消费的全部能力，逐域对照到云之家开放平台公开 OpenAPI（opendocs），标出：已公开端点、鉴权级别、覆盖差距、待协调项。
> 调研来源：opendocs 目录树与各页 markdown 原文（2026-08-24 抓取，`open.yunzhijia.com/opendocs/docs.html#/server-api/...`，源文 `…/opendocs/docs/<路径>.md`）；本仓既有调研（[`robot-channel-plan.md`](robot-channel-plan.md) §1.6/§1.7、[`../migration/todo-backend-migration.md`](../migration/todo-backend-migration.md)）。

## 0. 大前提：两套并存的调用体系

| 体系 | 载体 | 能力面 | 终态可用性 |
|---|---|---|---|
| **A. 用户态私有网关** | yzj-cli（keychain 登录态） | 最全：新知识库（workspace/block）、多维表格、IM 消息读写、速记归档库可见 | ❌ **opendocs 未文档化、无合同**——终态不可依赖 |
| **B. app 级公开 OpenAPI** | opendocs 文档化端点（`www.yunzhijia.com/gateway/…`） | 本文逐域盘点的面 | ✅ 终态直连的目标面 |

本文的对照口径 = 「我们正在用的功能」在 B 面有没有对应物；没有的就是缺口。

## 1. 鉴权层（一切 API 的前置）

| 档 | 获取 | 适用面 |
|---|---|---|
| app 级 accessToken | `server-api/auth/oauth`；轻应用 secret 在 **管理中心-应用管理-应用详细** | 待办消息（im-todo）、IM 群管理、知识中心、通讯录、订阅号 |
| **resGroupSecret 级** accessToken | `server-api/auth/res-secret`；**管理中心-系统设置-系统集成-资源授权 → 「时间助手管理」授权码** | **时间助手全家：日程 / 任务 / 会议 / 共享日历 / 备忘** |
| 用户身份解析 | `server-api/auth/index` | accessToken ↔ openId 映射 |
| 回调类 | 卡片模板回调地址（公网 HTTPS）；时间助手 callBackUrl（管理员：时间助手 > 更多 > 开放平台） | 交互卡片回传；日程/任务/会议变更推送 |

## 2. 域对照矩阵

### 2.1 IM 消息

| 面 | OpenAPI 现状 |
|---|---|
| 已公开 | 群管理 7 个（`gateway/xtinterface/`：`group/createGroup`、`addGroupUser`、`delGroupUser`、`groupUsers`、`groupInfo`、`notice/create` 公告、`banner/create` 主题）；群组机器人出站 `gateway/robot/webhook/send`（yzjtoken 在 URL）；对话机器人 sendMsgUrl 出站 + `xuntong/websocket` 入站（仅收 @机器人） |
| ❌ 缺口 | **读群消息历史**（CLI `im message list` 无公开对应物）；**以应用身份向任意会话发普通消息**（webhook 只能发绑定群）；**消息级 deep link**；机器人创建/管理 API（只能 Web 手工，产品做引导） |

### 2.2 日程（时间助手 cloudwork，resGroupSecret 级）

| 面 | OpenAPI 现状 |
|---|---|
| 已公开 | `gateway/cloudwork/newwork/`：create / detail / modify / delete（批量）/ finish / unfinish / teamWorks / queryByDay / repeatWork / batchModify / batchDelete / queryByUser（12 个）＋共享日历 4 个（`shareCalendar/list/myShares`、`list/shareToMe`、`share`、`share/batch`）＋备忘 4 个（`notes/`） |
| ✅ **变更回调存在** | 时间助手 > 更多 > 开放平台 配 callBackUrl，日程增删改完成全部推送（method 1001-1007）；`callback/errorLogs` 查投递失败。**推翻「日程无 webhook」的旧口径**（todo §5 那条对 im-todo 仍成立，对时间助手不成立） |
| 待实测 | CLI event 模型 ↔ newwork 字段映射（会议室/参与人/提醒粒度） |

### 2.3 任务——「是否复用云之家已有任务系统」终版答案

云之家有**两套任务面**，定位完全不同：

| | A. 时间助手任务 `worktask` | B. 通知中心待办 `im-todo` |
|---|---|---|
| 端点 | `gateway/cloudwork/worktask/`：find / page / create / modify / finish / **activate（重开）** / delete / close / **actor/comment（进度评论）** / queryByUser | `gateway/newtodo/open/`：generatetodo / action / checkcreatetodo |
| 鉴权 | resGroupSecret 级（资源授权） | app 级（轻应用 secret） |
| 状态机 | finish + **activate 支持已办→重开** + close | **不可逆**（待处理→已处理，无回退） |
| 变更感知 | **回调 2001-2009 全覆盖**（含激活 2009） | ❌ 无 webhook，只能轮询 checkcreatetodo |
| 定位 | 通用任务（执行人/抄送/附件/评论） | 审批/通知（todoType 0 通知中心 / 1 待审批） |

与我们待办视图模型（[`todo-backend-migration.md`](../migration/todo-backend-migration.md) §2）逐字段对照 worktask：

| 我们的不变量 | worktask 对应物 | 判定 |
|---|---|---|
| 稳定 ID | 服务端 id（回调带 id） | ✅ |
| 状态机 pending→in_progress→done + 重开 | finish / activate / close | ✅（im-todo 的硬冲突在此不存在） |
| 负责人 | `executors`（执行人 openId 集合）+ `ccs` 抄送 | ✅ 原生成员引用（Contact 写入 500 的痛点在终态消失） |
| DDL | `endDate`（时间戳） | ✅ |
| 优先级 P0/P1/P2 | `important` 仅 0/1 两档 | ⚠️ 收窄 |
| 推进日志（append-only） | `actor/comment` 进度评论 | ✅ |
| deep link | `extApps` 外部跳转应用集合（icon/url/appId） | ✅ |
| 催办/提醒 | `noticeTime` + `timingNoticeTime`（每天/每工作日/每周/每两周/每月 = **循环提醒**） | ✅（todo §5「循环待办」需求官方已有） |
| tag 聚合 | 无 tag 模型 | ➖ 已放弃（2026-08-24 拍板：终态不要求 tag 聚合，见 [`todo-design.md`](todo-design.md) §11.2 决策 9） |
| 批量流转 / 逾期服务端判定 | page/queryByUser 组合可实现；无显式批量接口 | ⚠️ 待实测 |

**选型口径**：复用首选 **worktask**——原「无 tag 模型」缺口已随 2026-08-24 拍板（放弃 tag 聚合理念，见 [`todo-design.md`](todo-design.md) §11.2 决策 9）消除，对照表无结构性缺口剩余；im-todo 只在「推审批/通知到消息列表」场景用。**待实测**：worktask detail 返回结构、page 过滤能力、activate 语义边界、回调注册的工作圈粒度。

### 2.4 知识库

| 面 | OpenAPI 现状 |
|---|---|
| 已公开（**老知识中心**，yzj-info） | `gateway/api/yzj-info/`：`directory/mng/addDir`、`getDirListByIdForGateway`、`setPermission`；`document/createForGateWay`、`update`、`common/detailForGateWay`、`list`、`value/readStatsForGateWay`（阅读明细，500 次/分/企业） |
| ❌ 缺口 | **新知识库（workspace / doc / block 结构）无公开 API**——CLI `doc` 域、AI速记归档库都是新知识库；老知识中心是上一代产品（目录 + HTML 文档 + 标签白名单），结构不对应 |

**这是终态最大缺口**：知识库读写、AI推进 `dir:` 订阅、沉淀出口「复盘文档入知识库」、速记纪要读取，全部压在上面。需云之家团队确认新知识库开放计划；在此之前 MVP 面只能继续走 CLI。

### 2.5 AI 速记 / 智能会议

| 面 | OpenAPI 现状 |
|---|---|
| 智能会议（resGroupSecret 级） | `gateway/cloudwork/meeting/`：create / modify / detail / cancel / repeatMeeting / batchModify / batchCancel / queryByDay / queryByRange / pageRecentList / queryByUser；会议室 `api/roomBook/third/`：hasNew / bookInfo / freeRooms / getActors；`meeting/getAttendDetail` 签到；`calendar/managedCalendarList` 我管理的日历 |
| 会议纪要 | = `meeting/detail` 返回的 **`recordInfo` 字段**（object）；会议回调 3001-3010（含 3006 结束会议 = 纪要产出时机信号） |
| ❌ 缺口 | **无独立「AI 速记」API**（opendocs 目录核实）；recordInfo 内部结构（是否含转写全文/说话人分离）待实测；「AI速记知识库」归档文档的读取压在 2.4 的新知识库缺口上；速记归档目标可配 / 速记库聚合可见（pitfall-041 的⑤期缺口）无对应 API |

### 2.6 通讯录

已公开（org 域）：`org/summary`、`org/index`（人员组织数据）、`org/dept`、`org/person`、`org/role`、`org/org-admins`、`org/parttime-jobs`、`org/relations`（上下级）、`org/orgRule`。CLI `contact user search/get` 的对应物在 person/index（字段级对照待做）。**覆盖完整**。

### 2.7 多维表格（sheet / aitable）——已从存储面退役

❌ **opendocs 全站无此域**（含旧版 `#/api/` 目录，2026-08-24 核实）——CLI sheet 走未公开通道。

存储角色已退役（v1.8 决策 36/37）：云多维表格 record 服务真机间歇 500 不可用，**待办任务表 + AI推进事项/事元双表的真机后端已切本地 SQLite**（`node:sqlite`，`~/.dsh/storages/yzj_advance.db`；dbt 路径仅剩测试 double）。多维表格曾有的独有价值是「用户在云之家 GUI 直接可见可改数据」，该价值随切换放弃，终态由灵基原生页承接。

终态口径：任务存储候选 = worktask（§2.3）；AI推进双表 = 灵基「推进域原生存储 + 服务端折叠投影」（migration §6）。**多维表格在 MVP 后期与终态均无位置**，仅剩面板「团队库切换器」的历史语义待清理。

### 2.8 文件

无独立分类；通用「文件操作接口」（multipart 上传 / 下载）作为章节嵌在 `business/cloudflow`（智能审批）与 `business/official`（文事会）两页。CLI `file upload/download`、`doc download-url` 的公开对应物待字段级确认（缺口）。注意 worktask/newwork 的 `images/files` 参数引用 fileId——**上传接口是任务/日程附件的前置依赖**。

### 2.9 消息卡片

`server-api/cardmsg`：订阅号 / 客户端 JS 桥 / 群组机器人 / 对话机器人四种发卡通道、**updateCardMsg（卡片原地更新）**、回传交互（模板回调地址）、cloudhub 跳转协议（deep link 回跳原生页/轻应用）。前置：真实 appid（轻应用）+ 公网回调地址 = D 层协调项（[`robot-channel-plan.md`](robot-channel-plan.md) §1.7）。R3 Adaptive 确认卡的协议依据已锁定（gap-analysis §17 附近样本）。

### 2.10 订阅号

`im/pubacc`（订阅管理）/ `im/pubSend`（发送）/ `im/pubRespon`（应答）/ `im/pubToken`（密钥验证）。未纳入路线，播报备选通道。

## 3. 缺口汇总：需要云之家侧确认/新开的（按阻塞度）

| 级别 | 缺口 | 压着的功能 |
|---|---|---|
| **P0** | 新知识库（workspace/block）公开 API | 知识库域全部、AI速记归档读取、AI推进 dir: 订阅与沉淀出口 |
| **P0** | 群消息历史读取 + 消息级 deep link | AI推进「上下文来源」的 IM 腿（终态事件总线前的过渡） |
| P1 | worktask 字段级契约实测 | 任务系统复用选型定稿 |
| P1 | 速记 recordInfo 结构（转写全文/说话人）+ 速记归档可配/速记库聚合可见 | AI速记域 |
| P1 | 文件上传/下载公开端点确认 | 任务/日程附件、IM 发文件 |
| P2 | 真交互卡片（轻应用注册 + 公网回调地址） | R3 确认卡（已在 D 层协调清单，今天即可并行发起） |
| P2 | 机器人管理 API、应用身份发任意会话消息 | 运维自动化、播报增强 |

## 4. 灵基侧（harness）依赖归档

- **定时任务**：`@deepseek-ai/dsh-schedule`（session-local：`schedule_create/list/delete`；after / at / every ≥300s；durable `schedule/change` 事件；硬边界 = 原会话必须 live、无外部通知、无 cron）。本仓已退役挂载（决策 42）：巡检 = host 机械 timer、dream = memory-yzj 自身 dailyAt、`!routines` = dsh-routines 外部引擎（[`routines-delivery.md`](routines-delivery.md)）。契约文档：harness `docs/subsystems/schedule.md` + `docs/tool-catalog.md#deepseek-aidsh-schedule`。灵基终态对应物 = **Brain Scheduler**（migration 组件映射）。
- 其余终态要重建的灵基侧承载：tools/pre-execute + approval（确认卡）、storage-domain、会话 followup、RPC 通道、settings.section——见 migration §6 灵基需求清单 8 项。

## 5. 参考来源

- opendocs 目录树（2026-08-24 抓取）：`#/server-api/auth/{oauth,index,res-secret}`、`im/{index,chatbot,im-todo,pubacc,pubSend,pubRespon,pubToken}`、`cardmsg`、`org/*`、`business/{cloudwork,meeting,knowledge-center,cloudflow,official,flowcenter2}`
- 端点原文：`open.yunzhijia.com/opendocs/docs/server-api/business/{cloudwork,meeting,knowledge-center}.md`、`server-api/im/index.md`、`api/im/im-todo.md`
- 本仓：[`robot-channel-plan.md`](robot-channel-plan.md)（机器人协议/卡片/待办 im-todo）、[`../migration/todo-backend-migration.md`](../migration/todo-backend-migration.md)（待办视图模型与需求清单）、[`../migration/advance-lingee-migration.md`](../migration/advance-lingee-migration.md)（三层拆分与灵基需求）、[`ai-advance-design.md`](ai-advance-design.md)（上下文来源/门控线）
