# 踩坑记录（Pitfalls）

> 目录名用英文（`docs/pitfalls/`）、文件名 `pitfall-NNN-<slug>.md`（slug 英文）；条目正文中文。本仓库积累的实现级坑与解法。每条记录：现象 → 根因 → 解法 → 验证方式。**动手前先扫一遍本目录**，避免重踩；解决新坑后必须回写一条。
>
> 面向两类读者：人类协作者，以及 coding agent（AGENTS.md「踩坑记录制度」要求 agent 查引并维护本目录）。

## 索引

| # | 坑 | 影响区域 | 条目 |
|---|---|---|---|
| 1 | React #310：浏览器崩溃但 jsdom 复现不了 | ui-yzj browser half / 任何面板 hooks | [pitfall-001-react-310-hooks.md](pitfall-001-react-310-hooks.md) |
| 2 | 持久化 store 整体替换：旧 blob 缺字段 → undefined 崩溃 | stores.ts / store schema 演进 | [pitfall-002-store-rehydration.md](pitfall-002-store-rehydration.md) |
| 3 | CLI 输出的三重形态：裸数组 / data 信封 / fields JSON 字符串 | bridge / 任何解析 CLI 输出的代码 | [pitfall-003-cli-output-shapes.md](pitfall-003-cli-output-shapes.md) |
| 4 | 大载荷被默认输出上限截断成不可解析 JSON | bridge maxOutputChars / doc-blocks 类端点 | [pitfall-004-output-cap-truncation.md](pitfall-004-output-cap-truncation.md) |
| 5 | 函数插件模块必须模块级 `export const inject`——Service 类的 `static inject` 不被 loader 读取 | 任何 host 包经 dsh profile 加载 | [pitfall-005-module-inject-for-loader-entries.md](pitfall-005-module-inject-for-loader-entries.md) |
| 6 | 程序化 agent：resume 不能 create；缺 `meta.cwd` → `{{cwd}}`；缺 `agentOptions.model` → `{{model}}` | robot-yzj / ui-yzj 话题 create | [pitfall-006-programmatic-agent-sessions.md](pitfall-006-programmatic-agent-sessions.md) |
| 7 | 程序化创建的 agent 是裸作用域：harness 工具族（schedule）不会自动挂载，需复刻 schedule 插件的注册路径 | robot-yzj routines / 任何给自建 agent 加 harness 工具的场景 | [pitfall-007-bare-agent-tool-families.md](pitfall-007-bare-agent-tool-families.md) |
| 8 | packed zstd 会话日志骗过一次性解压：只解出首帧 → "只有 header" → 误判持久化失效 | 任何直接读 `session.jsonl.zstd` 的脚本 / 诊断 | [pitfall-008-packed-zstd-session-logs.md](pitfall-008-packed-zstd-session-logs.md) |
| 9 | defineTool 的 output.schema 宽化成 `object` 报误导性执行体类型错；数组 of object 参数不存在——走 JSON 字符串（todo `records` 先例） | 任何新增 dsh-tools 工具包 | [pitfall-009-definetool-schema-literals-and-json-array-params.md](pitfall-009-definetool-schema-literals-and-json-array-params.md) |
| 9 | profile 装 bundle 三连坑：autoInstallPeers=false 致 peers 不解析；link 包传递依赖 EPERM；`every Nm` 首次触发依赖 lastRunAt 播种；SPA fallback 2xx 假阳性 | ops daemon / dsh-routines / chatnode 桥 | [pitfall-009-profile-peers-and-routines-seeding.md](pitfall-009-profile-peers-and-routines-seeding.md) |
| 10 | 客户端 bundle 注册 id 必须等于 loader 条目（profile 行名），不是包名；单测/构建全绿但 web 壳启动报 loaded without registering | ui-yzj browser half / 任何经 monobundle 子路径行名加载的 client bundle | [pitfall-010-loader-entry-id.md](pitfall-010-loader-entry-id.md) |
| 11 | `systemPrompt.context` 的 assemble.scope 是 Agent 对象，不是 session id 字符串 | tool-yzj 召唤窗口 / 任何仓外 `systemPrompt.context` 按会话分流 | [pitfall-011-assemble-context-scope-is-agent.md](pitfall-011-assemble-context-scope-is-agent.md) |
| 12 | `yzj-robot-*` 前缀闸在家园 id 改打后不再覆盖绑定会话 | robot_notify / robot_continue / 任何按旧前缀分流的写闸 | [pitfall-012-home-prefix-gate-misses-yzj-home.md](pitfall-012-home-prefix-gate-misses-yzj-home.md) |
| 13 | 切群/切会话闪「私密会话」或上一群消息 | 群房间时间线 / 面板会话 tab | [pitfall-013-session-switch-flash.md](pitfall-013-session-switch-flash.md) |
| 14 | 房间若保持 blank（官方「新会话」），侧栏会藏，但工作台挂不上 | ui-yzj home-open / conversation.view | [pitfall-014-blank-host-sessions-hidden.md](pitfall-014-blank-host-sessions-hidden.md) |
| 15 | 发进群 `local-*` 锚了话题后 ack 成真实 msgId，回群房间对不上 | tool-yzj topics / 交给助手幂等 | [pitfall-015-local-id-topic-anchor.md](pitfall-015-local-id-topic-anchor.md) |
| 16 | 只跑 `pnpm run bundle` 打包的是旧代码——client bundle 入口是 tsc 产物 `lib/types`，改 TS 后须先 `tsc -b`/`pnpm run build` | ui-yzj browser half / 改源→bundle→验收 循环 | [pitfall-016-bundle-needs-tsc-first.md](pitfall-016-bundle-needs-tsc-first.md) |
| 17 | 悬浮球盖住群房间「发进群」按钮（P2 退役球后此坑应失效） | ui-yzj 群房间 composer / 视口右下布局 | [pitfall-017-float-ball-covers-send.md](pitfall-017-float-ball-covers-send.md) |
| 18 | harness tablist 的 `display:flex` 盖过 `[hidden]`，群房间藏不住 tab ring | ui-yzj view-ring / 群房间 header | [pitfall-018-tablist-hidden-overridden-by-flex.md](pitfall-018-tablist-hidden-overridden-by-flex.md) |
| 19 | 发进群 portal 钉在已卸载的时间线宿主上（切工作台域再切回） | ui-yzj room composer / transcript | [pitfall-019-composer-portal-stale-host.md](pitfall-019-composer-portal-stale-host.md) |
| 20 | 自管滚动的 conversation.view 没 opt-in `data-conversation-composer-overlay` → 整页万像素、composer 失踪；触底跟随被程序化 scrollIntoView 骗停 | ui-yzj 群房间三栏 / 任何自定义 view 想列内滚动 | [pitfall-020-room-view-composer-overlay-contract.md](pitfall-020-room-view-composer-overlay-contract.md) |
| 21 | harness 归档单向（无 unarchive，归档会话客户端打不开）；开着旧 bundle 的 tab 会幽灵回写宿主状态文件 | 想用归档藏会话的插件 / 改 client 后的验收纪律 | [pitfall-021-archive-is-one-way-ghost-tabs-rewrite.md](pitfall-021-archive-is-one-way-ghost-tabs-rewrite.md) |
| 22 | 话题/普通会话残留 `view=yzj-home`，只藏 tab 仍整页错画成 IM | ui-yzj view-ring / room-shell / 任何挂在 conversation.view list 槽上的自定义视图 | [pitfall-022-stale-group-view-on-non-room.md](pitfall-022-stale-group-view-on-non-room.md) |
| 23 | 浅色主题 `bg-layer-*` 与画布同色，他人气泡看起来像没画 | ui-yzj 群房间气泡 / 任何浅色主题 chip 底 | [pitfall-023-other-bubble-vanishes-on-light-canvas.md](pitfall-023-other-bubble-vanishes-on-light-canvas.md) |
| 24 | 工作台点群走 homeOpen+focus，卡、未分组增生、官方 composer 闪 | ui-yzj conv-list / home-open / 官方侧栏 | [pitfall-024-click-group-must-not-open-session.md](pitfall-024-click-group-must-not-open-session.md) |
| 25 | 话题套房间空 turn 1，第一次提问再开 turn 1，官方 Chat 历史加载失败 | ui-yzj openTopicHome / publishHostSession / 官方 conversation 回放 | [pitfall-025-topic-dummy-turn-collides-with-first-ask.md](pitfall-025-topic-dummy-turn-collides-with-first-ask.md) |
| 26 | 话题 followup 不带 `message.id`，resume 校验失败，历史永久装不上 | ui-yzj askTopicAssistant / followup | [pitfall-026-topic-followup-needs-message-id.md](pitfall-026-topic-followup-needs-message-id.md) |
| 27 | 话题发给助手没近窗：只查房间表 + skip 过窄 + 注册层不对 | tool-yzj T5 / ui-yzj 问助手 | [pitfall-027-summon-window-topic-assemble.md](pitfall-027-summon-window-topic-assemble.md) |
| 28 | 工作台盖中间栏必须摸产品 DOM（官方无上方/cover 槽） | ui-yzj overlay / sidebar-entry | [pitfall-028-workbench-dom-overlay.md](pitfall-028-workbench-dom-overlay.md) |
| 29 | 召唤窗每轮重贴、同轮闪烁、跨日看起来倒序、文件行丢 fileId | tool-yzj T5 / formatSummonWindow / 抽屉问助手 | [pitfall-029-summon-window-once-dated-fileid.md](pitfall-029-summon-window-once-dated-fileid.md) |
| 30 | 话题 create 不挂默认 preset → 只有 yzj 工具、读不了本地文件 | ui-yzj / robot-yzj 程序化 agent | [pitfall-030-topic-needs-default-preset.md](pitfall-030-topic-needs-default-preset.md) |
| 31 | 近窗进 snapshot 会和记忆糊成一段；要用独立 plugin inject | T5 召唤窗 / 记忆 | [pitfall-031-summon-window-is-inject.md](pitfall-031-summon-window-is-inject.md) |
| 32 | `calendar event list` 跨天窗口只留循环日程第一次 | 工作台日程 / `yzj_calendar_event_list` | [pitfall-032-calendar-list-collapses-recurrence.md](pitfall-032-calendar-list-collapses-recurrence.md) |
| 33 | yzj-cli `msg-type file` 不能带 `--reply-msg-id`，产物文件进不了回复链 | ui-yzj 话题 job-done / `parseImSend` / `yzj_im_message_send` | [pitfall-033-cli-file-cannot-reply.md](pitfall-033-cli-file-cannot-reply.md) |
| 34 | rc.7：`tool.call.toolview` 要 type-import merge；SessionId branded；禁止 `/src/` 深路径 | ui-yzj browser half / 根包 registry 对齐 | [pitfall-034-rc7-slot-merge-and-sessionid.md](pitfall-034-rc7-slot-merge-and-sessionid.md) |
| 35 | 新鲜 web profile 的内测声明 / API Key 卡挡住云之家 dock | `.acceptance`  真机脚本 / 空 web profile 首启 | [pitfall-035-first-run-onboarding-masks-dock.md](pitfall-035-first-run-onboarding-masks-dock.md) |
| 36 | GUI「Full access」档位 approval=never,yzj 写工具 ask 自动转 deny、确认卡 不弹 | `.acceptance` 确认卡实验 / 任何依赖弹卡的 GUI 会话 | [pitfall-036-full-access-disables-approval.md](pitfall-036-full-access-disables-approval.md) |
| 37 | 验收脚本的话题步骤对「目标群有没有话题锚点」敏感：数据态差异被误读成代码 回归 | `.acceptance/verify-advance-feed.mjs` / 任何以话题为前置的走查 | [pitfall-037-acceptance-topic-data-precondition.md](pitfall-037-acceptance-topic-data-precondition.md) |
| 38 | web profile bundle link 被切到 worktree 不归位：主 checkout build 与 GUI 加载 脱节 | 真机验收 / 实验环境前置 | [pitfall-038-profile-bundle-link-stale.md](pitfall-038-profile-bundle-link-stale.md) |
| 39 | 工作台 overlay 空 sessionId 撞 home-fused 空 payload 校验，推进跳转报错且轮询刷屏 | ui-yzj browser half / 推进板「跳到消息」等切 im 域入口 | [pitfall-039-overlay-empty-session-home-fused.md](pitfall-039-overlay-empty-session-home-fused.md) |

## 维护规则

1. **一条坑一个文件**：`pitfall-NNN-<slug>.md`，NNN 递增；索引表同步更新。
2. 记录必须包含：最小复现条件（什么环境/序列才触发）、根因（到代码行为层面，不写猜测）、解法（为什么这个解法而非别的）、回归验证方式（哪个测试/验收脚本覆盖）。
3. 坑的解法变更时更新条目而非删掉；条目过时（对应代码已删）标注「已失效」并保留历史。
| 40 | 外部 seed sqlite 事元缺 entry_id fields 键被 parse 静默过滤；早期验证被裸 msgId 事元的恰一群路径假阳性掩盖 | `.acceptance` 直插库脚本 / parseAdvanceEntry | [pitfall-040-seed-fields-need-id-keys.md](pitfall-040-seed-fields-need-id-keys.md) |
| 41 | dir: 订阅扫不到会议速记纪要：速记归档独立库 + doc list 一层列取 + 首扫基 线不回灌三重叠加 | advance scan dir: 线程 / 速记归档认知 | [pitfall-041-dir-subscription-misses-lingee-minutes.md](pitfall-041-dir-subscription-misses-lingee-minutes.md) |
| 42 | CSS 变量笔误 `--dsh-*`（应为 `--dsw-*`）静默失效：ref 卡边框/底色/文字色全丢，单测 typecheck 全绿只有真机可见 | ui-yzj browser half 一切 module.css / 主题 token 引用 | [pitfall-042-unknown-css-var-silent-noop.md](pitfall-042-unknown-css-var-silent-noop.md) |
