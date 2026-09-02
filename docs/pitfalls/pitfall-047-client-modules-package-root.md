# pitfall-047：0.1.2 client-modules 只扫描精确包名，monobundle 子路径没有浏览器半

## 现象

harness 0.1.2 上，host 四个 yzj 行都启用（bridge / tool-yzj / ui-yzj / model-yzj），但设置里没有「云之家」、composer 没有 dock。浏览器 combo URL 里没有 `@dsh-yzj/bundle/client.js`。0.1.1 同一份 bundle 正常。

## 复现条件

`cordis.patch.yml` 的 ui-yzj 行名为 `@dsh-yzj/bundle/ui-yzj`（子路径），`dsh.client` 写在根 `package.json`。用 0.1.2 `dsh web` 加载该 profile。

## 根因

0.1.2 `dsh-client-modules` 的 `exactPackageSpecifier` 只接受精确包名（`@scope/name` 两段，或无 scope 且不含 `/`）。子路径行（`@scope/bundle/ui`、`pkg/gateway`）直接判成非 client 行，避免 `pkg/gateway` 复制一份 `pkg` 的 client bundle。

副作用：host 行全是子路径的 monobundle（本仓）永远进不了 boot 图。即便强行扫到，0.1.2 图行 id 是清单 `name`（`@dsh-yzj/bundle`），旧 bundle 注册的 `@dsh-yzj/bundle/ui-yzj` 仍会 `loaded without registering`。

## 解法

不改 harness。把 ui-yzj 的 Loader 名改成包根 `@dsh-yzj/bundle`（根 `exports["."]` = `./lib/ui-yzj.mjs`），并把 client bundle handoff id 改成同一个字符串。bridge / tool-yzj / model-yzj 仍走子路径——它们没有 `dsh.client`。

0.1.2 同时把 snapshot store 从 `@deepseek-ai/dsh-client-runtime/client` 挪到平台种子 `@deepseek-ai/dsh-client-store`。`PLATFORM_MODULES` 必须跟 0.1.2 `packages/client/web/src/platform.ts` 对齐，但 `defineStore` 不能只静态导入 store 包——0.1.1 桌面没有这个种子词，见 pitfall-048。

不要插一条空的包根 host 行同时保留子路径 ui-yzj：图行 id 会是包名，旧 bundle 仍注册子路径，启动照样炸。

## 回归覆盖

- `packages/ui-yzj/tests/client-bundle.client.spec.ts` 钉 handoff id `@dsh-yzj/bundle`
- 真机：0.1.2 `dsh web` 的 combo 含 `@dsh-yzj/bundle/client.js`，设置导航出现「云之家」
