# pitfall-048：0.1.2 的 `dsh-client-store` 种子在 0.1.1 桌面上不存在

## 现象

Oh My DSH 0.3.0-rc.18（bundled harness 0.1.1）加载 `@dsh-yzj/bundle@v0.1.2` 时整面插件失败：

```
Failed to load plugins
failed to import loader entry … (@dsh-yzj/bundle):
client-modules: require("@deepseek-ai/dsh-client-store") missed the module table
```

同一份 v0.1.2 在 0.1.2 `dsh web` 上正常。

## 复现条件

桌面仍是 rc.18 / 0.1.1 种子表，web profile 已换成 `github:GuoxinShan/dsh-yzj#v0.1.2`。client bundle 顶层 `require("@deepseek-ai/dsh-client-store")`。

## 根因

0.1.2 把 snapshot store 从 `@deepseek-ai/dsh-client-runtime/client`（parser preload）挪到平台种子 `@deepseek-ai/dsh-client-store`。v0.1.2 按 0.1.2 `PLATFORM_MODULES` 做了静态值导入。0.1.1 桌面的模块表没有这个词，`require` 同步抛错，factory 还没跑到业务代码。包根 handoff id（pitfall-047）两边都能对上，但 store 词不能。

## 解法

不改 harness，也不内联第二份 store 引擎。`defineStore` 先 `require` 0.1.2 种子，未命中再 `require` 0.1.1 的 runtime 词；两个 specifier 都进 `CLIENT_EXTERNALS`。不要静态 `import { defineStore } from '…'`——bundler 会把它抬成 factory 顶层无条件 `require`，try/catch 包不住。

## 回归覆盖

- `packages/ui-yzj/tests/client-bundle.client.spec.ts`：产物含 `try`，且 `@deepseek-ai/dsh-client-store` 出现在 `@deepseek-ai/dsh-client-runtime/client` 之前
- 真机：rc.18 桌面重启后不再 Failed to load plugins；0.1.2 `dsh web` 设置「云之家」仍在
