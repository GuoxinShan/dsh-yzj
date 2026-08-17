# pitfall-018：`[hidden]` 藏不住 harness tab ring

> 影响区域：ui-yzj `view-ring.ts` / 群房间 session header

## 复现条件

群房间 `yzj-home-*` 已选中「群房间」view，`syncYzjViewRing('room')` 把 `[role=tablist]` 设了 `hidden`。jsdom 单测 `tablist.hidden === true` 通过，真机 GUI 标题下仍能看见「群房间 / 对话 / 轨迹」。

## 根因

harness `ConversationRoot.module.css` 的 `.tabs { display: flex }` 是作者样式，优先级高于 UA 的 `[hidden] { display: none }`。只设 HTML `hidden` 属性，视觉上 tablist 仍是 flex 行。

次因：header 的 tablist 可能晚于 `YzjSessionShell` 首次 sync 才挂上；只在 `kind` 变化时跑一次，后来出现的 tablist 不会被藏。

## 解法

`hideTablist` 同时设 `hidden`、`data-yzj-ring=off` 和 `style.setProperty('display', 'none', 'important')`，才能压过 `.tabs { display:flex }`。已经藏过则直接 return，避免 MutationObserver 死循环。`watchYzjViewRing` 只观察 `childList`（等 tab 入场），不观察 `style`/`hidden` 属性。不 fork harness。

## 回归覆盖

`packages/ui-yzj/tests/view-ring.spec.ts`：flex 作者样式下 `getComputedStyle(tablist).display === 'none'`；tablist 晚挂时 observer 仍能藏。e2e：群房间页 `tablist` 不可见。
