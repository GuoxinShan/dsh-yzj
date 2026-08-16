# 发布流程（Release）

> 本仓库 0.x 阶段为 pre-release：无外部消费者，优先做对的地基而非兼容垫片
> （AGENTS.md「Pre-release stance」）。发布 = 两个层次：**路线 A** 代码/文档
> 上 GitHub + tag（内部分享）；**路线 B** 全量发布 npm（对外可
> `dsh plugin add` 安装）。发布前必须完成本文档的前置检查。

## 0. 前置事实（2026-08-16 现状）

- 所有包 `private: true` → **npm registry 发不了**（路线 B 第一步要改）；
- 依赖为 `link:`（指向 `../deepseek-harness`）/ `workspace:^`（包间互依）→
  别人从 GitHub/npm 装 bundle 时这些依赖解析不了；
- git remote 已配 `origin → https://github.com/GuoxinShan/dsh-yzj.git`，
  从未 push、无 tag；
- 六个包：`bridge` / `tool-yzj` / `ui-yzj` / `robot-yzj` / `memory-yzj` /
  `model-yzj` + `bundle`（挂载层，依赖上面六包）。

## 1. 发布前置检查（AGENTS.md Pre-release stance 的执行面）

- [ ] 各包 `@deepseek-ai/*` 依赖从 `link:` 换成已发布版本范围
  （npm registry 上 rc.6 系列：`@deepseek-ai/cordis@^4.0.1`、
  `@deepseek-ai/dsh-agent@^0.1.0-rc.6` 等——以 `npm view` 核实）；
- [ ] 包间互依（`@dsh-yzj/*`）从 `workspace:^` 换成 `^0.1.0`；
- [ ] 所有包 `private: false`；
- [ ] 验证：`dsh plugin --profile <临时 profile> add <发布源>` 能装上并挂载
  （GitHub：`github:GuoxinShan/dsh-yzj#<tag>`；registry：`@dsh-yzj/bundle`）；
- [ ] 首个 tag 发布后删除 AGENTS.md「Pre-release stance」一节。

## 2. 路线 A：GitHub 分享（内部用，最快）

```sh
git push origin main
git tag v0.1.0
git push origin --tags
```

- 效果：仓库可克隆/浏览、tag 可追溯；本机继续 `link:` 安装不变；
- 局限：他人 `dsh plugin add github:GuoxinShan/dsh-yzj#v0.1.0` 会因
  `workspace:`/`link:` 依赖解析失败——仅供代码分享，不可安装。

## 3. 路线 B：正式发布（对外可装）

在**发布分支**上做（main 保持 `link:` 开发态，发完不破坏本地环境）：

```sh
git checkout -b release/v0.1.0
# 1) 改六个包 package.json：private:false + link:/workspace: → 版本范围
# 2) 按依赖序发布（bridge → tool-yzj/ui-yzj/robot-yzj/memory-yzj/model-yzj → bundle）：
npm publish --workspaces --dry-run   # 先看包内容
npm publish -w packages/bridge
# …依次…
npm publish -w packages/bundle
# 3) 验证：
dsh plugin --profile release-test add @dsh-yzj/bundle
dsh --profile release-test --dump-config | Select-String yzj
# 4) 打 tag + GitHub Release（changelog 从 git log 提炼）：
git tag v0.1.0 && git push origin release/v0.1.0 --tags
# 5) 合并回 main（仅 package.json 回滚到 link: 态）或保留 release 分支
```

- npm 发布需要 `npm login`（用户凭据，agent 不代办）；
- 发布后 main 的 `link:` 依赖与 registry 版本可能漂移（本地 harness checkout
  与 rc.6 的差异）——发布分支隔离此风险。

## 4. 已知坑

- `workspace:^` 在非 workspace 环境（GitHub/pnpm add 目标）解析失败——
  bundle 的互依必须发布为版本范围；
- `private: true` 包 `npm publish` 直接报错（`ERR_PNPM`/npm 拒绝）；
- bundle 层依赖六包：`dsh plugin add @dsh-yzj/bundle` 会从 registry 拉全部
  互依——发布序错误（bundle 先发）会导致安装时拉不到；
- 验证安装用**独立临时 profile**（`dsh plugin --profile release-test add …`），
  别污染生产 profile。

## 5. 发布历史

| 版本 | 日期 | 形态 | 内容 |
|---|---|---|---|
| （未发布） | — | — | 0.x pre-release，全部功能在 main |
