# pitfall-010：客户端 bundle 注册 id 必须等于 loader 条目（profile 行名），不是包名

## 现象

web profile 启动时报（entry 名按实际 profile 行名）：

```
failed to import loader entry 1fb23123 (@dsh-yzj/bundle/ui-yzj):
client-modules: bundle /plugins/@dsh-yzj/bundle/ui-yzj/client.js?rev=4ce667501c80
loaded without registering "@dsh-yzj/bundle/ui-yzj" via __ModuleLoader__.load
```

`pnpm test` 全绿（257 通过）、`pnpm run build`/`bundle` 均成功，只有真实 web 壳启动才炸。

## 复现条件

monobundle（根即 `@dsh-yzj/bundle`，patch 行名用子路径 `@dsh-yzj/bundle/<row>`）下，`packages/ui-yzj/tsdown.config.ts` 传给 `clientBundle()` 的 id 是包名 `@dsh-yzj/ui-yzj`，而 profile 的行名是 `@dsh-yzj/bundle/ui-yzj`。任何重命名 patch 行名（或换 id 语义）而不同步 tsdown id 都会触发。

## 根因

harness `packages/client/modules/src/client/system.ts` 的 `arrive(row)` 在加载完 bundle 脚本后做严格相等检查：`this.factories.has(id)` —— `id` 是**图行 id（profile 行名）**，不是包名。bundle 必须经 `window.__ModuleLoader__.load({ id, factory })` 注册**恰好该行名**；注册别的 id 一律判为「loaded without registering」。

monobundle 重构（commit ab714b2）把 `cordis.patch.yml` 行名改成 `@dsh-yzj/bundle/*`（使行解析进单一可安装包），但 `tsdown.config.ts` 的注册 id 仍写包名 `@dsh-yzj/ui-yzj`。构建期（tsdown banner 只看传入 id）与单测（组件测试直连 TSX 源，不走 bundle）都发现不了；只有 web 壳启动、client-modules 加载 graph row 时才暴露。commit 信息里「aggregate boot verified」只验证了 bundle 200 可达，没验证注册 id 匹配。

## 解法

handoff id 必须等于 **当时 harness 写进图行的 id**。0.1.1 图行 id 是 Loader 行名，所以当时写成 `@dsh-yzj/bundle/ui-yzj`。0.1.2 起图行 id 是包清单 `name`，且 **只有精确包名** 会被扫成 client 行（子路径默认不是，见 pitfall-047）。因此：

- `cordis.patch.yml` 的 ui-yzj 行 `name` 改为包根 `@dsh-yzj/bundle`（根 `exports["."]` 指向 `./lib/ui-yzj.mjs`，host 半不变）
- `packages/ui-yzj/tsdown.config.ts` 的 `clientBundle()` id 同步为 `@dsh-yzj/bundle`
- 重建 bundle 并由 `scripts/copy-client.mjs` 搬到根 `lib/client.js`

不要写成 workspace 包名 `@dsh-yzj/ui-yzj`：那不是 profile 里安装的包。

## 回归覆盖

- `packages/ui-yzj/tests/client-bundle.client.spec.ts`：读构建产物 `lib/client.js`，断言首处 `__ModuleLoader__.load` handoff id 为 `@dsh-yzj/bundle`，且不含 `@dsh-yzj/ui-yzj` / `@dsh-yzj/bundle/ui-yzj`（产物缺失时自跳过）。
- 人工验证：`pnpm run bundle` 后 `head -c 220 lib/client.js` 看注册 id；重启 web profile 不再报错（GUI 重启只能用户手动执行）。
- 改行名/改 id 语义时：同时改 `cordis.patch.yml`、`tsdown.config.ts`、本条目与 `client-bundle.client.spec.ts` 的常量。
