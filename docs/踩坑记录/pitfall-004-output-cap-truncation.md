# Pitfall 004 — 默认输出上限把合法大载荷截断成「合法的空结果」

> 记录日期：2026-08-15 ｜ 关联提交：`a890003`
> 影响区域：`packages/bridge`（maxOutputChars）、任何经 bridge 传输大 JSON 的端点

## 现象

大文档（会议记录，块数据 ~390k 字符）在面板**预览为空**（「无文本内容」），小文档正常；CLI 直跑有完整数据；无任何报错。

## 根因

bridge 的输出防护默认 `maxOutputChars = 200_000`。超限时**截断 stdout 并置 truncated 标志**，但截断后的字符串 `JSON.parse` 失败 → `result.json === undefined` → 消费端 `result.json ?? {}` 拿到空对象——**一路上没有错误**，呈现为「合法的空结果」。这是最阴的一类失败：静默、按大小阈值二分表现（小文档好、大文档空）、日志里查无异常。

## 解法

- `bridge.run()` 支持 per-call `maxOutputChars` 覆盖（与 timeoutMs 同级）。
- 已知大载荷端点显式给预算：`doc-blocks` 用 `{ timeoutMs: 120_000, maxOutputChars: 2_000_000 }`。
- 判定方法：结果 `truncated === true` 或「CLI 直跑有数据、经 bridge 为空」→ 基本就是上限截断。

## 回归覆盖

- `.acceptance/verify-doc-dedup.mjs`：390k 会议记录正文完整渲染（201 行）。
- 排查此问题时用过的「HTTP response body 抓包」（Playwright `page.on('response')` 看 `/yzj/doc-blocks` 返回 `value:{}`）是最快定位手段。

## 教训

**有界防护 + 静默降级 = 排查地狱**。给 bridge 加新的大载荷命令时：先量一下典型输出体积（`| Out-String` 长度），超过 100k 就在调用点显式给预算；未来可考虑让 truncated 结果带上结构化标记透传到消费端。
