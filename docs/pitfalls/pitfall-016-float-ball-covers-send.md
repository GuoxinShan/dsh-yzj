# Pitfall 016 — 云之家悬浮球盖住群房间「发进群」按钮：jsdom 全绿、真机点不到

> 记录日期：2026-08-17
> 影响区域：ui-yzj 群房间 composer / 任何贴视口右下角布局的面板控件

## 现象

群房间 composer 的「发进群」主按钮在 jsdom 组件测试与 Playwright 可见性断言里全部通过，但真机 GUI 上点击无效：e2e 的「发进群 paints ②」失败，`click` 报 `intercepted by <span class="floatBallBadge">`（悬浮球的 99+ 徽标）。`force: true` 也救不了——事件落在悬浮球子树上，不冒泡到按钮。

## 根因

云之家悬浮球（`shell.overlay`，`position: fixed`）钉在视口右下角；群房间 composer 满宽铺到会话面板右缘，主按钮位于行尾——两者在真实视口里重叠。jsdom 没有布局引擎，永远测不出 fixed 元素叠压。此前 composer 上的 `padding-right: 72px` 正是为此而设，在视觉改版中被当作无名 hack 删除导致回归。

## 解法

`.roomComposerRow` 恢复 `padding-right: 72px`，并把「为悬浮球让位」的原因写进 CSS 注释——留白与悬浮球的存在绑定，删除前必须真机核对。不选移动悬浮球：它是跨会话全局控件，位置改动影响所有面。

## 回归覆盖

`.acceptance/verify-group-room-e2e.mjs`「发进群 paints ② immediately with no confirm card」——按钮被压住时该步必失败。
