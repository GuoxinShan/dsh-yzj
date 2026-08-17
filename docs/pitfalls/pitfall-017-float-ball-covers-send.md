# Pitfall 017 — 云之家悬浮球盖住群房间「发进群」按钮：jsdom 全绿、真机点不到

> 记录日期：2026-08-17
> 状态：**已失效（P2 退役悬浮球）**
> 影响区域：ui-yzj 群房间 composer / 视口右下布局（历史）

## 现象

群房间 composer 的「发进群」主按钮在 jsdom 组件测试与 Playwright 可见性断言里全部通过，但真机 GUI 上点击无效：e2e 的「发进群 paints ②」失败，`click` 报 `intercepted by <span class="floatBallBadge">`（悬浮球的 99+ 徽标）。`force: true` 也救不了——事件落在悬浮球子树上，不冒泡到按钮。

## 根因

云之家悬浮球（`shell.overlay`，`position: fixed`）钉在视口右下角；群房间 composer 满宽铺到会话面板右缘，主按钮位于行尾——两者在真实视口里重叠。jsdom 没有布局引擎，永远测不出 fixed 元素叠压。此前 composer 上的 `padding-right: 72px` 正是为此而设，在视觉改版中被当作无名 hack 删除导致回归。

## 解法

当时：`.roomComposerRow` 恢复 `padding-right: 72px`。

**P2 终局（2026-08-17）**：`shell.overlay` 注册摘除，悬浮球/悬浮窗退役，72px 留白删除。坑源不在，本条失效。若再注册贴视口右下的 fixed 控件，先对照本条。

## 回归覆盖

`.acceptance/verify-group-room-e2e.mjs` 断言「floating ball is gone」且「发进群 paints ②」。
