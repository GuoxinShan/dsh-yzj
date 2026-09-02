# pitfall-020：群房间没 opt-in harness 的 composer-overlay 契约，整页长到一万像素

> 影响区域：ui-yzj `room-shell.tsx` / `transcript.tsx`（群房间三栏布局与触底跟随）

## 复现条件

`conversation.view` 自定义视图想要「列内自滚动」（会话列 / 时间线 / 话题抽屉各自滚动 + 自己的 composer 钉底），只在视图内部写 `height: 100%` + `min-height: 0` flex 链。打开群房间：发进群输入框在视口外约 9800px 处，三栏全靠 harness 整页滚动。jsdom 单测全绿（不断言像素），只有真实浏览器能看出来。

## 根因

两层叠加：

1. **布局契约没接上**。harness `ConversationRoot` 默认把 viewArea 设成 `flex: 1 0 auto`（内容撑开、`scrollBody` 整页滚）——这是为官方 Chat  transcript 设计的。自管滚动的视图必须在视图根元素上加 `data-conversation-composer-overlay` 属性 opt-in（`ConversationRoot.module.css` 的 `:has()` 规则把 viewArea 改成 `flex: 1 1 0; min-height: 0; overflow: hidden`，并把 composerSeat 改成绝对定位叠层）。harness 自己的 TrajectoryView 就是这么做的。群房间没加，于是 `.roomShell { height: 100% }` 解析到内容撑开的父高，整条 flex 链失效。
2. **触底跟随被虚假 scroll 事件打断**。修好契约后还有第二个坑：初始加载序列里 harness 的焦点管理会对流内元素 `scrollIntoView`，把流滚离底部；`onScroll` 无法区分这种程序化滚动和用户主动上翻，`followBottom` 被误判为 false，于是永远停在差 139px 的位置。另外 `ResizeObserver` 观察滚动容器本身没用——容器高度被 flex 定死，图片晚加载撑大内容时它根本不触发。

## 解法

- 视图根加 `data-conversation-composer-overlay`（一行，官方契约，不 fork harness）。
- 触底判定改为「用户意图门控」：`wheel`/`touchmove` 才标记用户转向；`onScroll` 里只在内容高度稳定（`scrollHeight` 等于上次 stick 记录值）时采信，且只有被用户标记过的滚动才允许脱离跟随；任何来源落到底部都重新挂上跟随。
- `ResizeObserver` 观察**内容包裹层**（`.streamContent`），不是滚动容器——图片/卡片晚加载撑高内容时也会重新触底。

## 回归覆盖

`.acceptance/verify-room-layout.mjs`（真实 GUI）：shell 高度 ≤ 视口、流内部滚动、打开即触底、发进群可见、无 ghost 行、机器人标注、长文折叠、抽屉有界。单测：`transcript.client.spec.tsx`（折叠/身份）、`rpc.node.spec.ts`（home-nav 名字回填）。
