# Pitfall 016 — 只跑 `pnpm run bundle` 打包的是旧代码：client bundle 的入口是 tsc 产物

> 记录日期：2026-08-17
> 影响区域：ui-yzj browser half / 任何「改 TS 源 → bundle → 重启 GUI 验收」的循环

## 现象

改了 `src/client/home-chrome.tsx` 后跑 `pnpm run bundle`（成功、无警告）、重启 GUI，真机行为却是改动前的：话题视图里被删掉的锚点卡仍在渲染（截图里出现两张「群消息锚点」卡）。单测（vitest 直读 TS 源）全绿，极具迷惑性。

## 根因

`tsdown.shared.ts` 的 `clientBundle` 在 `--env.DSH_BUILD_FACE=client` 下把 browser half 的入口设为 **`lib/types/client/index.js`（tsc 产物）**，不是 `src/client/index.ts`。`pnpm run bundle` 只跑 tsdown，不跑 `tsc -b`——源码改动没进 `lib/types`，bundle 打的就是上一次 tsc 的旧 JS。CSS Modules 例外：`sourceAssetPath` 会把 `.module.css` 回映射到 `src/`，所以纯 CSS 改动 bundle 即可生效，更加深了「bundle 就够了」的错觉。

## 解法

改 browser half 的 **TS/TSX** 后，先 `pnpm run build`（含 `tsc -b`）再 `pnpm run bundle`；或在包内 `tsc -b && pnpm run bundle`。只改 `.module.css` 时单跑 bundle 可以。验收出现「改了没生效」时第一时间核对 `lib/types` 的 mtime。

## 回归覆盖

流程坑，无单测；`.acceptance/verify-group-room-e2e.mjs` 的真机走查是唯一能暴露它的环节（本次由 `3-topic.png` 双锚点卡暴露）。
