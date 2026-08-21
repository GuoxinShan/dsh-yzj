# pitfall-042：CSS 变量笔误（`--dsh-*` vs `--dsw-*`）静默失效，ref 卡片渲染成裸文本

> 记录日期：2026-08-21
> 影响区域：ui-yzj browser half 一切 `*.module.css` / 任何引用 harness 主题 token 的样式

## 现象

推进看板时间线的「原始信息」文档/消息卡渲染成无边框、无底色的裸文字块：`.refEventMeta`「文档」标签与文件名像两段散落文本，多条卡 flex wrap 成不等宽两列，事元底部还吊着一个孤零零的「文档」字样；事元描述颜色也失效成默认深色。jsdom 单测全绿、typecheck 全绿，只有真机截图看得出来。

## 复现条件

1. `advance-pane.module.css` 的 `.refEvent` / `.refEventMeta` / `.refEventBody` / `.entryDetail` / `.sourceCiting` 等 7 处写成 `var(--dsh-alias-border-l2)`、`var(--dsh-alias-label-primary)` 等。
2. harness 主题只定义 `--dsw-*` 一族 token（`design-platform.css`），`--dsh-alias-*` 全仓不存在。
3. CSS `var()` 引用未定义变量且无 fallback 时，整条声明「computed-value time 无效」→ `border`/`background`/`color` 全部回退初始值——不报错、不警告，卡片 chrome 整体消失。

## 根因

token 族名笔误（dsh vs dsw 一字之差）。CSS 与 TS 不同：未定义变量不产生任何构建/类型/运行时错误，jsdom 不计算样式也察觉不到；此类 bug 的唯一暴露面是真机视觉。叠加因素：refEvent 是 `<a>` 却没写 `text-decoration: none`，变量失效后文档名直接掉回浏览器默认链接蓝紫+下划线。

## 解法

- 7 处 `--dsh-*` 全部改回 `--dsw-*`；refEvent 补 `text-decoration: none`、整行宽堆叠（`width: 100%; max-width: 560px`）消除不等宽换行锯齿；卡片底色用 `bg-base` 而非 `bg-layer-1`（浅色主题 layer 与画布同色，pitfall-023）。
- 事元底部裸 `sourceType`（「文档」「对话」）正是截图里每条事元下的孤儿标签——改为带谓语的出处脚注「记录自 文档 / 人工 · 你的判断」。
- 动手写样式前先 `grep -- '--dsw-alias' packages/ui-yzj/src/client/<既有 pane>.module.css` 确认 token 族名，不要凭记忆敲。

## 回归覆盖

`.acceptance/ux-shot-align.mjs`：断言 ref 卡 computed style `borderTopWidth === '1px'`、时间线轨道 `::after` 高度 > 10、孤儿文案消失，并出整页+时间线特写截图（shots-advance-ux/ux-align-fix-*.png）。CSS 变量拼写单测/jsdom 覆盖不了，真机截图断言是唯一防线。
