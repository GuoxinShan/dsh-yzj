# pitfall-035：新鲜 web profile 的内测声明 / API Key 卡挡住云之家 dock

> 记录日期：2026-08-19
> 影响区域：`.acceptance/verify-*.mjs` 真机脚本 / 任何对空 `~/.dsh/profiles/web` 点 `yzj-dock-home` 的走查

## 现象

`yzj-group-space` / `yzj-dock-home` 已挂上（插件 client 200），但 Playwright `click()` 超时：

```
<div aria-hidden="true" class="_mask_…"> from <div role="presentation" class="_root_…">
subtree intercepts pointer events
```

jsdom 单测绿；本机已用过的 web profile 也绿——只有**第一次**起 GUI 才炸。

## 复现条件

1. 空 `~/.dsh/profiles/web`（或清掉 `ui-onboarding.welcomeNoticeVersion`）。
2. rc.7 `dsh web` 拉起，boot 图含 `@dsh-yzj/bundle/ui-yzj`。
3. 不先点「继续」/「稍后配置」，直接点侧栏「云之家」。

## 根因

harness `settings.onboarding` 槽按序挂两张 `OnboardingModal`：内测声明（`welcomeNoticeVersion` 未确认）和官方 DeepSeek「添加一个 API Key」。模态把 `#root` 设 `inert`，并在上面盖一层 `aria-hidden` mask。云之家 dock 在侧栏脚，视觉上仍 `visible`，点击被 mask 吃掉。Playwright 默认 `locale=en-US` 时文案是 Continue / Configure later，与中文 GUI 不一致。

## 解法

验收脚本在点 dock 前关掉这两张卡（中英按钮都认），页面 `locale: 'zh-CN'`。点 dock 若仍被挡，`force: true` 兜底。不要在 host 里为了 e2e 关掉 onboarding——那是产品首启，不是插件 bug。

## 回归覆盖

`.acceptance/verify-advance-board.mjs` 与 `verify-advance-feed.mjs` 的 `dismissFirstRun()`。未登录时 chrome（五页签含「推进」、看板挂上）通过后对写路径 `SKIP` exit 0，不把 ENOENT 当失败。
