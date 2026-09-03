# pitfall-052: 藏官方 InputBar 不能只查 `[data-composer-seat]`

## 复现条件（Reproduction）

IM 壳占 `conversation.view` 并登记 `conversation.composer` chain，组件返回 `null`，JS 只 `querySelector('[data-composer-seat]')` 再把 height 收成 0。

- **harness 0.1.2-alpha.3（Oh My DSH）**：ConversationRoot **没有** `data-composer-seat`。选择器 miss，官方 InputBar（「发消息或做任务」、完全权限、模型、$ 计数、`N 轮 · M 步` 统计）仍在 IM composer 下面。
- **harness rc.7**：有 `data-composer-seat`，但 `renderSlotChain(..., { fallback: composerBar, overlay: true })` 把 elected 与 fallback **同时挂成兄弟**。chain 画 `null` 卸不掉 InputBar；只收 seat 在 rc.7 碰巧能藏，alpha.3 则完全无效。

真机截图：上条「发给助手」，下条宿主 InputBar + session 标题「调用 yzj_…」+「标准模式」+「Session 日志」。

## 根因（Root cause）

seat 属性是 rc.7 才打上的 DOM 契约，不是跨版本 API。`overlay: true` 的语义是「盖在 fallback 上」不是「替换 fallback」。插件不能假设宿主 class 哈希，但 CSS modules 仍把源 class 名留在 hash 里（`composerStack` / `InputBar` / `titleRow`）。

## 解法（Fix）

`html[data-dsh-yzj-im]` 下 CSS + `watchHostChrome()` MutationObserver 双保险，选择器覆盖 seat / `data-composer-card` / `composerSeat|composerStack|composerHero|InputBar` / titleRow / headerActions / headerUtilities / Session 日志按钮，以及 placeholder「发消息或做任务」、统计行「N 轮 ·」。IM 输入标 `data-yzj-im-composer`，header 标 `data-yzj-im-header`，选择器排除这两棵子树。不要用 `[class*='composerCard']`（会打中 IM 自己的 `.composerCard`）。

## 回归覆盖（Regression coverage）

`packages/ui-yzj/tests/host-chrome.client.spec.tsx`：有 seat / 无 seat 都藏宿主条与统计，不藏 IM composer。
