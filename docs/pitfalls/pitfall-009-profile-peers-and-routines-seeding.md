# pitfall-008: profile 装 bundle 的 peers 与 dsh-routines every 调度播种

2026-08-16 生产 ops daemon 落地时连踩三个坑，均在 `docs/spec/routines-delivery.md`
§5.1/§6 留档，这里按「复现/根因/解法/回归」四段归档。

## 1. profile 里 bundle 的 @deepseek-ai peers 不解析

**复现**：`dsh plugin --profile ops add file:.../dsh-routines` 成功，但 daemon 静默；
`--dump-config` 正常。bundle 模块 import `@deepseek-ai/cordis` 失败。

**根因**：
- profile 模板的 `pnpm-workspace.yaml` 写死 `autoInstallPeers: false`（
  `packages/boot/app-boot` 的 profile 初始化模板），peers 一律不装；
- 手动改 `autoInstallPeers: true` 后 pnpm 从 registry 装 peers（当时 rc.6），与
  harness 本体的 rc.5 **双份并存**——Cordis `Service` 单例身份分裂风险
  （现行对外口径是 `^0.1.0-rc.7`；解法仍是 peers `link:` 到兄弟 checkout，不跟 registry 再装一份）；
- 裸 `pnpm add link:<harness 包>` 装 @dsh-yzj/robot-yzj 时报
  `ERR_PNPM_EPERM`：pnpm 把 link 目标的依赖树往 **junction 目标（harness
  checkout 目录）里**装，被沙箱/权限拒绝，且失败后 package.json 回滚。

**解法**：peers 全部以 `link:` 显式列进 profile package.json（cordis/timer/
schemastery 在 harness `vendor/`；agent/session 在 `packages/core/`；jobs/llm 在
`packages/{jobs,llm}/{jobs,llm}`；cmdline 在 `packages/boot/cmdline`），解析全部
落到 harness checkout 单份。跨包行（`@dsh-yzj/robot-yzj` 这类 workspace:^ 依赖
链无法在 profile 解析的）直接建 junction 挂进 profile node_modules，不进
package.json（daemon 不跑 pnpm，loader 只认 node_modules）。

**回归覆盖**：`createRequire(profileDir).resolve('@deepseek-ai/cordis')` 断言指
向 harness 路径；ops 组合树 `--dump-config` 出现全部行；探针 apply 打印
routines/jobs/timer/chatnode 服务在位。

## 2. dsh-routines `every Nm` 首次触发依赖 lastRunAt 已播种

**复现**：全新 state 下 `every 5m` 的 routine 在 daemon 里永不触发；`dsh
routines list` 显示 next 正常。

**根因**：调度器 tick 里 `nextAfter(schedule, lastRunAt === 0 ? now : lastRunAt)`
对 `every` 返回 `after + interval`——lastRunAt 为空时 next 恒为 `now+interval >
now`，永远 skip。必须有一次 run（manual launch / 历史 state）先播种
`state.json` 的 `lastRunAt`，之后的周期触发才成立。另：state 只读一次进内存，
**另一个进程**写的 state.json 不会热更，播种后必须重启 daemon。

**解法**：首次部署先 `dsh routines run <name>`（ops profile 下）播种；之后
`every Nm` 正常周期触发。文档 §5.1 注 5 原「首次触发在启动后约 1 分钟」不成立，
已修正。

**回归覆盖**：播种后重启 daemon，等一个周期，`runs/` 出现 `trigger: schedule`
的完成记录。

## 3. 未注册路由的 2xx 假阳性（SPA fallback）

**复现**：桥 client 对未注册的 `/yzj/chatnode` POST 返回 ok——webServer 的
fallback（SPA dist）对未匹配路由回 200 + index.html，`res.ok` 为 true。

**根因**：bridge client 只检查 HTTP 状态码；fallback 对任意方法/路径回 2xx。

**解法**：client 增加严格校验——2xx 且 body 必须是 `{ok:true}` JSON，否则按
投递失败 throw（调度器记入 `deliveries`，不 crash）。listener 侧本身对未匹配
路径无感知（路由未注册 = 请求根本没到 bridge）。

**回归覆盖**：`tests/bridge.spec.ts` 的「2xx non-{ok:true} body 判失败」用例。
