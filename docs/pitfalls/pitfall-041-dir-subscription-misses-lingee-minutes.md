# pitfall-041：dir: 订阅扫不到会议速记纪要（归档库错位 + 一层列取 + 基线不回灌三重叠加）

> 记录日期：2026-08-21
> 影响区域：tool-yzj advance scan 的 `dir:` 线程（scanDirThread/listDirDocs）/ 产品认知：金蝶云 AI 速记的归档行为

## 现象

用户在推进事项上关联了知识库（「830实验·共识」目录 + 「我的知识（整库）」），之后开了几场会有了新会议纪要，蓄水池却始终没有 `dir:` 条目——「关联了知识库但新纪要没进抽取池」。巡检本身健康：im: 渠道增量正常入池，dir: 基线按时建立，无任何报错。

## 复现条件

1. 会议纪要是金蝶云 **AI 速记自动归档**的产物——归档到「AI速记知识库」（`6a744266…`）或会议生成的独立共享库（如 `6a87bea5…`，不在用户自己 workspace list 里），**不归档到「我的知识」**。
2. 订阅的是「我的知识（整库）」或某目录 → 速记纪要在扫描范围之外，巡检永远扫不到。
3. 即使纪要落在订阅库内，仍有两道闸：(a) `doc list` 只列**一层子节点**（CLI 定义如此，spec 决策 32 同口径）——整库订阅只看根层级，子目录内容变化扫不到；(b) `dir:` 首扫只立基线**不回灌**（决策 32 防回灌）——订阅时刻之前的存量文档永不入池。

## 根因

扫描范围由订阅 token 决定（`scanDirThread` 只对注册表里的 `dir:` 渠道跑 `listDirDocs`），而速记纪要的归档位置由会议产品决定——两者从不相交。诊断路径（下次同类问题直接照走）：

1. `~/.dsh/storages/yzj_advance_sources.json` → 确认订阅了哪些 `dir:`、挂在哪个事项（须为 open 态才参与聚合）。
2. `~/.dsh/storages/yzj_advance_scan_cursors.json` 的 `dirs` 表 → 基线是否已立、knownDocs 快照里有没有目标文档（有 = 被基线吸入不回灌）。
3. `~/.dsh/storages/yzj_advance_dreampool.json` → 池内条目的 channel 分布（本例 90 条全 `im:`）。
4. `yzj-cli doc recent` → 目标文档**实际在哪个 kbId**（本例三个新纪要分别在 `6a744266…` / `6a87bea5…`，均 ≠ 订阅的 `6a7042a2…`）。

## 解法

- **增量**：把「AI速记知识库」挂为 `dir:` 订阅（面板「关联来源」picker 可选；它在自己的 workspace list 里）。注意基线效应：挂上那一刻的存量不回灌，之后的新纪要自动入池。会议生成的临时共享库（不在自己 workspace list）picker 选不到，需 agent 侧 `source_add` 直传 `dir:<kbId>` token。
- **存量**：已有纪要不走池——Dream/话题里让 agent 直接 `yzj_doc_get` 读那几个 docId 后 `yzj_advance_feed`（refs=[docId]，doc: 静态引用语义，决策 32）。
- **产品缺口（留⑤期）**：速记归档库不可控且随会议增生，dir: 订阅追不上；需要「速记库聚合订阅」或速记归档目标可配进「我的知识」。已记 spec §15.3 已知缺口 + gap §24.19。

## 回归覆盖

机制行为全部符合 spec（决策 32 基线/一层口径），无代码缺陷，无测试改动。tool-yzj `advance.spec.ts` 的 dir: 用例（首扫基线不回灌 / 新增与 updateTime 变化出信号）覆盖机制本身；本条目防的是「用户视角的没反应」被下一个 agent 当成 bug 重查一遍。
