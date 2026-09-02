# 坑 023：浅色主题他人气泡与画布同色，看起来像没气泡

## 复现条件

1. 浅色主题打开群房间时间线。
2. 自己发的消息右侧有 `--dsw-specific-bubble` 底（deepseek-50）。
3. 别人 / 助手的消息左侧只有字，看不出气泡。

jsdom 只断言 `roomRowOther` class，不算 computed background。真机浅色主题 `bg-layer-1 === bg-base === bluish-00`。

## 根因

官方 Chat 只给**用户**一侧上色，助手侧是画布上的裸字。视觉刀把 IM 他人气泡底设成 `--dsw-alias-bg-layer-1`，「跟官方」。浅色主题里 layer-1 / layer-2 / base 三个 token 都是同一白，他人气泡等于透明。深色主题 layer 有阶，所以只在浅色面暴露。

## 解法

IM 不是官方 Chat：两侧都要有可见 chip。他人 / 助手用 `--dsw-alias-interactive-bg-hover-solid`（浅色 bluish-75，深色 bluish-800），fallback `bluish-75`。不要用 `bg-layer-*` 当浅色主题的 chip 底。

## 回归覆盖

- `packages/ui-yzj/tests/transcript.client.spec.tsx`：他人行挂 `roomBubbleOther`。
- 真机：他人气泡 computed background 不能等于时间线 canvas。
