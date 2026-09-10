# pitfall-053：Oh My DSH 上 `connection.rpc.handle` 不能给第三方挂 `/yzj`

## 复现条件（Reproduction）

web profile link 本仓 `@dsh-yzj/bundle` 后启 Oh My DSH。sidecar 在打印 `dsh web` URL 前 exit 1：

```
failed to apply loader entry ui-yzj (@dsh-yzj/bundle): cannot get property "webServer" without inject
```

栈：`ui-yzj` `apply` → `ctx.connection.rpc.handle('/yzj', …)` → `owner.webServer.register`。

仅把 `webServer` 写进本模块 `export const inject` **不够**（已验证仍炸）。

## 根因（Root cause）

Oh My DSH 桌面 runtime 里的 `dsh-client-connection`：

1. 模块 `inject` 只有 `['credentials']`，自己的 `/api` 用 `ctx.inject(['webServer'], …)` 挂。
2. `HostConnectionService.rpc.handle` 里 `owner.webServer.register(route)` 的 `owner` 实际是 **Connection 自己的 fiber**（不是调用方 ui-yzj），该 fiber 未声明 `webServer` → Cordis 抛 `cannot get property "webServer" without inject`。

对照：harness `0.1.2-alpha.5` 源码里 Connection 模块 inject 是 `['webServer', 'credentials']`，同一 API 在 checkout 上可通；桌面包与 alpha.5 不一致。仓库内无其它插件调用 `rpc.handle`；webhook 类插件都是 `ctx.webServer.register` 直挂。

## 解法（Fix）

不要调用 `connection.rpc.handle`。本模块 inject `webServer` + `connection`，在 `apply` 里：

1. `ctx.webServer.register({ kind: 'prefix', path: '/yzj', handler })`
2. handler 内先走 `connection.requestRejection`（与 Connection 同款鉴权）
3. 解析 `client-request` JSON 信封，调既有 `createRpcHandler`，回 `server-response`

浏览器仍 `connection.rpc.call('/yzj', endpoint, payload)`（URL `/yzj/<endpoint>`），契约不变。

## 回归覆盖（Regression coverage）

启 Oh My DSH web profile：日志有 launch URL、无 `webServer without inject`；IM 壳能拉 `assistants-list` / `groups`。单测盖不了 desktop connection 实现差异。
