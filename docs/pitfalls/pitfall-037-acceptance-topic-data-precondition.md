# pitfall-037：验收脚本的话题步骤对「目标群有没有话题锚点」敏感

## 现象

`YZJ_E2E_GROUP=dsh-2 node .acceptance/verify-advance-feed.mjs` 在 ③.2 落地后跑出 3 个 FAIL（`has a topic to open` / `timeline has 话题透镜喂入` / `问助手 filled with inspect prompt`），看起来像新 bundle 引入的话题链路回归。

## 根因

话题清单不是 CLI 数据，而是 GUI 进程的 storage-domain `yzj_topic_anchors`（`~/.dsh/storages/yzj_topic_anchors.json`）：只有历史上在该群点过「交给助手」/ 话题 job-done 才会留下锚点。排查时磁盘与 GUI 读取一致——dsh-2 当前就是 0 条话题（存量 2 条都属于 830 群）；此前该脚本通过，是因为当时 dsh-2 恰好有过临时话题（后来被清理）。脚本把「有话题」当成隐式前置条件，缺话题时直接 FAIL，于是**数据态差异被误读成代码回归**。与 ③.2 变更无关：本次未触碰话题链路，bundle 同 commit，换有话题的群全链路（抽屉 → 透镜 → 喂给推进 picker → 问助手预填）验证全绿。

## 解法

验收脚本对「环境数据前置」自跳过而非失败（与「未登录 SKIP exit 0」同范式）：`verify-advance-feed.mjs` 在目标群无话题锚点时打印 SKIP 并跳过话题透镜/问助手相关断言。判断话题链路本身是否回归，应选一个**确定有话题**的群（如 830 群 `6a605c7ce4b0772a6279295e`）走查，而不是换群碰运气。诊断顺序：先读 `~/.dsh/storages/yzj_topic_anchors.json` 比对磁盘与 GUI，再下「回归」结论。

## 回归验证

`YZJ_E2E_GROUP=dsh-2 node .acceptance/verify-advance-feed.mjs` → ALL PASS（话题步骤 SKIP）；830 群话题链路探针（抽屉 → 透镜 → picker → 问助手草稿 → 不 followup）→ ALL PASS、零页面错误（2026-08-19，③.2 bundle）。
