# Pitfall 002 — 引擎 store 持久化是「整体替换」：旧 blob 缺字段 → 全体 undefined

> 记录日期：2026-08-15 ｜ 关联提交：`530435c`
> 影响区域：`packages/ui-yzj/src/client/stores.ts`；任何给已持久化 store 加字段的改动

## 现象

给面板 store 新增字段（todo 系列：`todos`/`todoReady`/`todoLibraries`…）发布后，**老用户浏览器**打开面板直接崩：

```
TypeError: Cannot read properties of undefined (reading 'map')  at todo-pane
```

## 根因

harness 引擎的 store 持久化（`createSnapshotStore` → `attachPersistence`）回放是**整体 setState(JSON.parse(blob))**，**不做**与 init 的字段合并。旧版本写入的 blob 没有新字段 key → 回放后新字段全为 `undefined` → 任何 `.map`/消费点崩溃。且崩溃点可能在**任何**数组字段（不止新增的那个）：blob 越老，缺失越多。

## 解法（两层防御）

1. **schema 版本化 + 自检修复**：persist key 带版本（`dsh.yzj.panel.v5`），且 `createYzjStore()` 包装 handle 的 `create()`——对回放快照做结构自检（所有数组字段必须是数组、布尔字段必须是布尔），不合格 blob **重置为 init 态并 clearPersisted()**。这防的是**未来任何** schema 演进，不只是本次。
2. **组件层兜底**：消费端 `Array.isArray(x) ? x : []`（todo-pane 的 todos/libraries），毒化 store 也炸不了 UI。

```ts
// stores.ts — 关键形状
return {
  ...handle,
  create(scopeKey?: string) {
    const instance = handle.create(scopeKey)
    const broken = ARRAYS.some(key => !Array.isArray(instance.getSnapshot()[key]))
    if (broken) {
      instance.store.set({ ...handle.spec.init(), open: false, tab: 'docs' })
      instance.clearPersisted()
    }
    return instance
  },
}
```

## 排查方法

- 崩溃含 `reading 'map'` + 涉及持久化面板 → 先怀疑旧 blob。诊断脚本：`addInitScript` 种入缺失字段的旧版 blob 再打开面板。

## 回归覆盖

- `.acceptance/verify-stale-store.mjs`：种入 v4 形状（缺全部 todo 字段）+ 毒化 v5（`todos` 为字符串）两种 blob，面板正常渲染、零页面错误。

## 教训

**任何** `persist: '...'` 的 store 加字段时：要么 bump key 版本，要么确认自检修复已覆盖——两者本仓库都已固化在 `createYzjStore()`，但新 store 声明时应照抄该模式。
