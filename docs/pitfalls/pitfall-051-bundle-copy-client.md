# pitfall-051: 只跑 ui-yzj tsdown 不会更新 DSH 加载的 client

## 复现条件（Reproduction）

改 `packages/ui-yzj/src/client/**` 后只执行 `pnpm --filter @dsh-yzj/ui-yzj bundle`（tsdown 写出 `packages/ui-yzj/lib/client.js`），不跑根目录 `scripts/copy-client.mjs`。Oh My DSH / harness 经 `@dsh-yzj/bundle` 的 `exports["./client"]` 加载的是**仓库根** `lib/client.js`。重启 GUI 仍是上一版 overlay / 旧 inbox。

与 pitfall-016 叠加：tsdown client 入口是 `lib/types`（须先 `tsc -b`），即使 tsc+tsdown 都新了，漏 copy 根 `lib/client.js` 仍然是旧包。

## 根因（Root cause）

monobundle 的浏览器半是「ui-yzj closure 原样搬运」，不是根 tsdown 再打一份。DSH 只认包根 `lib/client.js`。`packages/ui-yzj` 的 `bundle` 脚本曾经只有 tsdown；根 `pnpm run bundle` 才会 copy。在包目录或 filter 下打 client 会留下旧 overlay。

## 解法（Fix）

- `scripts/copy-client.mjs` 以脚本文件定位仓库根（不依赖 `process.cwd()`）。
- `packages/ui-yzj` 的 `bundle` / `build` 在 tsdown 之后调用 copy-client，与根 `pnpm run bundle` 同效。
- 改 browser half：`tsc -b`（pitfall-016）+ bundle（含 copy）+ 重启 GUI。

## 回归覆盖（Regression coverage）

`packages/ui-yzj/package.json` `bundle` 含 copy-client；本条目。真机验收：根 `lib/client.js` mtime 与 `packages/ui-yzj/lib/client.js` 一致。
