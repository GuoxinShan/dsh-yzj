# pitfall-055: im-shell 保挂载包裹层不撑高 → 时间线 height 0（消息已加载但看不见）

## 复现条件（Reproduction）

1. IM 壳 `im-shell` 用 CSS-hidden 保挂载多路助手/群/peek（中间对话缓存）。
2. 打开任一群房间：header「人群房间」+ 底部 composer 可见，中间大白。
3. DOM：`[data-testid="yzj-fused-stream"]` 里已有「加载更早消息」和气泡文案，但 `.body` / 时间线 `getBoundingClientRect().height === 0`。

真机：2026-09-10，灵基Chat 群房间。

## 根因（Root cause）

`.shellStack` 是 `height:100%` 的 column flex；子节点是无样式的包裹 `div`。包裹层默认 `flex: 0 1 auto`，高度被内容撑成「header + composer」。内部 `.shell { height: 100% }` 相对这个矮包裹；`.body { flex: 1 1 0; min-height: 0 }` 在**高度由内容决定**的 flex 父级里分到 0 —— 经典「flex:1 子项在 auto 父级塌缩」。

消息 RPC / fused 正常；是布局把时间线裁没了。

## 解法（Fix）

```css
.shellStack > *:not([hidden]) {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.shellStack > [hidden] {
  display: none !important;
  flex: none;
}
```

让当前可见包裹吃满 stack，`.shell` / `.body` / `.roomMain` 的 flex 链才能把高度传到 `.stream`。

## 回归覆盖（Regression coverage）

- 真机：群房间中间栏高度 > 0，气泡可见；助手 DM 同理。
- 可选：后续加 layout client spec 量 `yzj-fused-stream` 高度（jsdom 对 flex 百分比弱，优先真机）。
