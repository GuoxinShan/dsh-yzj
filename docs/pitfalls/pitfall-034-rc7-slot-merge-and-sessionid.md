# Pitfall 034 — rc.7：`tool.call.toolview` 槽名要 type-import merge；SessionId 是 branded；禁止 `/src/` 深路径

> 记录日期：2026-08-19
> 影响区域：ui-yzj browser half / 任何向 harness slot 注册的 client 插件 / 根包 `@deepseek-ai/*` 对齐 rc.7

## 现象

兄弟 checkout 升到 `dsh-v0.1.0-rc.7` 后，`packages/ui-yzj` 的 `tsc -b` 红：

1. `'tool.call.toolview'` 不在 slot 名 union 里；写卡 `inject: (sessionId) => …` 对不上 `() => …`。
2. `workbench-mount.tsx` 把 `sessionId = ''` 传给 `YzjRoomComposer`：`string` 不能赋给 branded `SessionId`。
3. 跟进 `ui-input-trigger/src/types.ts` / `ui-tool/.../slots.ts` 时，找不到 `@deepseek-ai/dsh-client-runtime/client` 等 `/client` 面（未构建的 harness 没有 `lib/types`）。

用 `tsc -b --noCheck` 能 emit，但那不是解法：类型门禁被关掉，下一轮 agent 会把坏契约带进 bundle。

## 根因

- **SlotMap 是 declaration merge。** `tool.call.toolview` 写在 `@deepseek-ai/dsh-client-ui-tool` 的 `declare module '@deepseek-ai/dsh-client-ui-slots'`。client 入口没 `import type {} from '@deepseek-ai/dsh-client-ui-tool/client'` 时，该键不存在；`InjectParams` 退化成 `[]`（看起来像 `() => I`）。
- **rc.7 `SessionStandardProps.sessionId` 是 branded `SessionId`**（`string & { readonly [BRAND]: "SessionId" }`）。`Partial<PropsRuntime<'conversation.composer'>> & { sessionId: string }` 的交集会把 overlay 的 `sessionId` 收成 branded；裸 `''` 过不了。
- **`package.json` `exports["./client"].types` 指向 `lib/types/client/*.d.ts`。** 本仓若 `import '@deepseek-ai/dsh-*/src/...'`（走 `./src/*` 导出），tsc 会当源码检查 harness `.ts`；那些文件再 import `/client` 时，fresh clone / 未 `build:lib:client` 的 checkout 没有 `.d.ts`，解析失败。skipLibCheck 不保护 `.ts`。

## 解法

1. browser 入口（以及任何注册 `tool.call.toolview` 的模块）加 `import type {} from '@deepseek-ai/dsh-client-ui-tool/client'`。`dsh.client.inject` 同步列入该包，保证运行时槽已声明。
2. session 槽的 `inject` 工厂参数用 `SessionId`（从 `@deepseek-ai/dsh-client-runtime/client` 只导入类型）。R27 overlay 无挂钩时用 `'' as SessionId`，不要把品牌函数从 host 包值导入进 browser half。
3. 类型只走公开 `/client` 面（`ToolCallViewProps`、input-trigger 的 `InputTriggerSource` 等均已从该面再导出）。禁止 `@deepseek-ai/dsh-*/src/...`。
4. 开发态 typecheck 假定兄弟 harness 已产出 `lib/types`（`pnpm run build:lib:host` 再按需 `build:lib:client`），或本机 GUI 本来就是从该 checkout 打过包的。不要 `--noCheck`。
5. vitest 把 `dsh-client-runtime/client` alias 到 harness **源码**。兄弟 checkout 若是仓外 symlink，须 `server.fs.allow` 含实路径；且 Vite 不会走仓外文件自己的 node_modules，要用插件把 harness 源码里的 `@deepseek-ai/*` 解析到本仓 registry（rc.7）的 `node_modules`（vendor/cordis 未 tsdown 时没有 `lib/index.js`）。primitives 的 `lib/index.js` 仍须 harness client tsdown（plain ESM）。

## 回归覆盖

`pnpm run typecheck` / `pnpm run build` 必须在未加 `--noCheck` 时绿。`release-deps.spec.ts` 断言根 `@deepseek-ai/dsh-*` 全部是 `^0.1.0-rc.7`。jsdom 单测不覆盖 slot merge；缺 type-import 只会在 `tsc -b` 爆。
