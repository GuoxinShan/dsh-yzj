# pitfall-044: 验收脚本时序两坑——同事项不重拉 / Dream 切会话

## 现象

Playwright 验收推进看板时两个反复出现的时序坑：

1. **同事项点击不重拉**：sidecar 写入新事元后点队列里**已激活**的事项，详情区毫无变化——阶段 pill、时间线全是旧数据。
2. **Dream 后页面失踪**：点「Dream 抽取」后，后续 `yzj-workbench-tabs` 等 testid 全部 timeout——页面已经不在工作台了。

## 根因

1. 队列项 `onClick = setActiveId(id)`——React 同值 setState 不触发 effect，detail 不重拉。面板没有轮询 detail 的机制（只有 activeId 变化才拉）。
2. Dream 手动径（决策 38）的语义是「直建 `yzj-dream-*` 会话并注入抽取指令」——host 切会话即离开推进页签所在的会话上下文，工作台盖层随之不在。

## 解法

1. 断言前先「点走再点回」（点队列里任意另一事项 → 点回目标事项），或干脆 `page.reload()` 后重新导航；**不要**对已激活事项重复 click 并期待新数据。
2. Dream 触发后的断言一律 `page.reload()` 再重新导航回推进页签，不假设页面停留原处。

## 回归覆盖

`.acceptance/verify-advance-dsh2.mjs`（S2/S5 段均用点走点回 / reload 模式，注释标明本坑）；dsh-2 闭环演习全程走查（gap §24.28）。
