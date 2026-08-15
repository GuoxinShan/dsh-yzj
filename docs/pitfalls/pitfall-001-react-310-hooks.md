# Pitfall 001 — React #310（hooks 计数错误）：真浏览器崩、jsdom 不崩

> 记录日期：2026-08-16 ｜ 关联提交：`258d2cb`（引入自注册模式修复；原始崩溃来自其前一版的 infinite-scroll 实现）
> 影响区域：`packages/ui-yzj/src/client/panel.tsx`（YzjPanel 及任何持有大量 hooks 的面板组件）

## 现象

给 YzjPanel 加「上滑自动翻页」时，**点击悬浮球首次打开面板的瞬间**，`shell.overlay` 槽位抛出：

```
Error: Minified React error #310   // Rendered more hooks than during the previous render
    at Object.Ls [as useEffect] (assets/index-*.js)
    at YzjPanel (plugins/@dsh-yzj/ui-yzj/client.js:3866:24)
```

面板整个消失（slot entry crash 被 slot 系统吞掉）。**jsdom 组件测试（完整走 open→四个 tab→close→reopen）完全不复现**；`pnpm test` 全绿。

## 复现条件（缺一不可）

1. **真浏览器**（Chromium via Playwright 也算——不需要人工浏览器）。
2. 组件里**普通 const 函数定义（如 `loadOlderMessages`）之后**又声明了新的 `useRef`/`useEffect`，且 effect 通过依赖数组**前向捕获**那个函数（`useEffect(..., [flags, messagesAnchor])` 里引用后面才定义的 const）。
3. 组件从 `return null`（closed）切到**首次完整渲染**（open）。

第 2 点是精确触发形状：把同样的 hooks 数量、同样的逻辑换成「函数自注册进 ref」的形状（见解法）就不崩——**崩溃与 hooks 总数无关，与引用形状有关**。

## 根因（行为层面）

minified 生产构建下，闭包对**尚未初始化的 const 函数**的前向引用在特定执行序里让 React 的 hooks 链读取到上一次渲染的 memoized state 错位，表现为 #310（比「 hooks 少了」的报错口径更迷惑：报的是"more hooks than previous render"，实际本渲染 hooks 数量与顺序都正确）。React 的报错信息在这类场景**不可信**，栈指向的 effect（3866:24）只是撞上错位的第一个 hook，不是肇事者。

> 注：确切机制（为何闭包前向引用会破坏 hooks 链）未深挖到 React 源码级；本条目记录的是**可操作的因果**：这种形状=崩，换形状=不崩，五个构建变体二分验证。

## 解法（自注册 ref 模式）

滚动监听器需要读「最新 flags + loader 函数」。错误做法是让 effect 依赖数组携带后文 const：

```ts
// ❌ 崩溃形状：effect 在 loadOlderMessages 定义之前，依赖数组前向捕获它
const loadOlderRef = useRef(() => {})
useEffect(() => { loadOlderRef.current = loadOlderMessages }, [state.messagesAnchor]) // loadOlderMessages 在下面才定义
```

正确做法：**loader 每次渲染自己写进 ref**，effect 只刷新纯标志位，零前向引用：

```ts
// ✅ 稳定形状：函数自注册，effects 不引用任何后文 const
const loadOlderMessages = (): void => { /* ... */ }
chatScrollRef.current = { ...chatScrollRef.current, loadOlder: loadOlderMessages }  // 每次渲染执行

useEffect(() => {  // 只刷 flags
  chatScrollRef.current = { ...chatScrollRef.current, more: state.messagesMore, loading: state.loading }
}, [state.messagesMore, state.loading])
```

DOM 副作用（滚动位置恢复）不走 effect 依赖，改走数据到达后的 `requestAnimationFrame`（见 panel.tsx `loadOlderMessages` 内的 restore 段）。

## 排查方法（下次直接用）

1. `page.on('pageerror')` + 拿**完整 stack**（不是 console.error 文本）——定位到具体 client.js 行列。
2. **构建变体二分**：git checkout 到上一好提交 → 干净重建（`Remove-Item lib` 后 build，**注意 stash 后必须重新构建，脏 bundle 会给出假 bisect 结论**）→ 逐块加回代码。每个变体一个新 3091 实例 + 全新 browser context。
3. jsdom 测试不崩**不能作为无罪证据**：本仓库的组件测试跑在开发版 React（错误更宽容）且无 slot 系统包裹。

## 回归覆盖

- `packages/ui-yzj/tests/panel-hooks.client.spec.tsx`：mount → open → 四 tab → close → reopen，以及「持久化恢复态（open+chat+已选群+消息在场）」直接挂载。
- `.acceptance/verify-scroll.mjs`：真浏览器滚动触发 + 位置恢复 + 零页面错误（本坑的唯一可信防线）。
