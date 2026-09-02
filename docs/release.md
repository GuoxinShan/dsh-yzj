# 发布流程（Release）

> 本仓库 0.x 阶段为 pre-release。**发布形态 = monobundle + git**：仓库根即
> 可安装的 `@dsh-yzj/bundle` 包（六包源码聚合进根 `lib/`，互依内嵌，
> `@deepseek-ai/*` 走 registry），发布动作 = 构建 + 打 tag + push，
> 别人 `dsh plugin add github:GuoxinShan/dsh-yzj#v0.1.0` 一行可装，
> **零 npm 账号、零 registry 服务**。

## 0. 形态事实（2026-08-16 定稿）

- **monobundle**：根 `package.json` = `@dsh-yzj/bundle`（`exports` 子路径
  `./bridge`…`./model-yzj` + `./client`；`dsh.bundle` patch + `dsh.client`
  声明；`dependencies` 仅 `@deepseek-ai/*`（registry rc.7 系列）+ react/zod）；
- 构建：根 `tsdown.config.ts` 把六包 `lib/index.js` 聚合成 `lib/*.mjs`
  （`noExternal /@dsh-yzj\//` 内嵌互依，`@deepseek-ai/*` 外部化）；
  `scripts/copy-client.mjs` 原样搬运 ui-yzj closure bundle 为 `lib/client.js`；
- patch：ui-yzj 行名是包根 `@dsh-yzj/bundle`（0.1.2 client-modules 只扫精确包名，见 pitfall-047）；其余行仍用子路径；
  根 `exports["."]` 指向 `./lib/ui-yzj.mjs`；`./ui-yzj/package.json` 仍导出给旧扫描路径；
- 本地开发不变：workspace 六包对 `@deepseek-ai/*` 的 `link:` **必须保留**（兄弟 checkout 是类型/测试事实源）；测试直跑源码。
- 根包对外依赖已经是 registry `^0.1.0-rc.7`，**不要**把 workspace `link:` 改成 registry——那会拆掉开发态闭环。首个 tag（`v0.1.0` / `v0.1.1`）已打，AGENTS.md 旧「Pre-release 发布前替换 link:」口径作废。

## 1. 发布步骤（全部本地可完成，无需账号）

```sh
pnpm run build                        # 六包 + 聚合 lib
pnpm test                             # 255 绿（质量门）
git add -A && git commit -m "release(v0.1.0): …"
git push origin main
git tag -f v0.1.0 && git push origin v0.1.0 --force
# 验收（真实验证 git 安装路径）：
dsh plugin --profile release-check add github:GuoxinShan/dsh-yzj#v0.1.0
```

- tag 打在新 main 上（monobundle 后不再有独立 release 分支）；
- `--force` 重打 tag 仅当上一版 tag 指向旧结构时。

## 2. 安装形态（使用者）

```sh
dsh plugin --profile web add github:GuoxinShan/dsh-yzj#v0.1.0
```

pnpm 从 GitHub 拉仓库根包（`@dsh-yzj/bundle`，`dsh.bundle` 声明被 reconcile
识别）→ 装 `@deepseek-ai/*` registry 依赖 → 重启生效。

## 3. 已放弃的路线（记录原因）

- **npm 全量发布**：需要 npm 账号；且 `@deepseek-ai/*` 的 rc.5 从未发布
  （当时 registry 0.1.0 系列只有 rc.2/rc.3/rc.6，本地 rc.5 是内部号；
  **现行对外口径是 `^0.1.0-rc.7`**）——registry 版本不可用是当初的卡点；
  monobundle 后不再需要。
- **多包 GitHub 安装**：bundle 依赖六个未发布包 + `workspace:^` 在 git 安装
  时不重写——解析必然失败；monobundle 内嵌互依彻底绕开。

## 4. 已知坑

- harness 0.1.1 client-modules 按**行名** `require.resolve('<row>/package.json')` 找
  `dsh.client`——子路径行必须配 `./ui-yzj/package.json` 导出，否则 client
  bundle 404；
- harness 0.1.2 只扫精确包名，图行 id 是清单 `name`：ui-yzj 必须用包根行 +
  handoff id `@dsh-yzj/bundle`，`defineStore` 从 `@deepseek-ai/dsh-client-store`
  取值（pitfall-047 / pitfall-010）；
- tsdown 多 entry 输出 `.mjs`（ESM）——exports 用 `.mjs`，不是 `.js`；
- closure-factory client bundle 绝不能重打包——复制搬运；
- 安装验证用独立临时 profile（`dsh plugin --profile release-check add …`），
  别污染生产 profile；无 web-app 的 base-only profile 装 bundle 会因
  ui-yzj 等 connection 服务 pending（web 形态才完整）。

## 5. 发布历史

| 版本 | 日期 | 形态 | 内容 |
|---|---|---|---|
| v0.1.2 | 2026-09-02 | monobundle + git | **适配 harness 0.1.2**：ui-yzj Loader 行与 client handoff id 改为包根 `@dsh-yzj/bundle`（0.1.2 不扫子路径、图行 id 是包名）；`defineStore` 改从平台种子 `@deepseek-ai/dsh-client-store` 取值。0.1.1 同一份 id 也对。pitfall-047 + 更新 pitfall-010。Release：https://github.com/GuoxinShan/dsh-yzj/releases/tag/v0.1.2 |
| v0.1.1 | 2026-08-16 | monobundle + git | **修复 web profile 启动崩溃**：client bundle 注册 id 与 loader 行名对齐（`@dsh-yzj/bundle/ui-yzj`），v0.1.0 因 ab714b2 行名改名后 tsdown id 未同步，browser half 挂载即报 `loaded without registering`；新增 bundle 契约测试 + pitfall-010。Release：https://github.com/GuoxinShan/dsh-yzj/releases/tag/v0.1.1 |
| v0.1.0 | 2026-08-16 | monobundle + git | 全量功能（桥/命令族/定时/记忆/模型默认链），六行聚合 + client bundle，git 可装；**GitHub 安装全链路验收通过**（六行挂载 + client bundle 200）；Release 说明见 https://github.com/GuoxinShan/dsh-yzj/releases/tag/v0.1.0 |

## 6. 发布 note 维护

每次发布在 GitHub Release 页写 note（`gh release create <tag> --notes-file <file>`），
内容组织：安装命令 → 能力面（按域）→ 发布形态 → 验证。note 模板见本文件 §2 的
验收步骤 + 上一条 Release 正文。发布后同步更新 §5 表格。
