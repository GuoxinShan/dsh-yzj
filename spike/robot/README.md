# robot-spike 工具包（R0）

> 配套 `docs/spec/robot-channel-plan.md` §4 spike 清单。本目录为一次性验证工具，结论回写设计文档后可整目录删除。

## 用户协助步骤（仅此三步）

1. **创建对话机器人**：任一群的 群设置 → 群组机器人 → 创建自定义机器人 → 创建对话型机器人；「消息接收地址」填**下面 README 顶部的 trycloudflare 地址**（我起好的隧道，保持本窗口开着即可）；创建成功后把**发送消息接口地址（sendMsgUrl）**和**机器人密钥（appSecret）**粘给 agent（或存入 `secret.local.json`）。
2. **配合实测**：在群里 @机器人 发几条消息（我会给具体指令清单）。
3. **断隧道观察**：创建成功后告诉我，我杀掉隧道，只留 WS 长连接跑 ≥1 小时（spike ①）。

## 文件

- `hook-recv.mjs` — 本地 webhook 接收器（端口 9902）：打印每个入站请求（sign/sessionId/body），自动按官方格式回 `{success:true,...}`，日志落 `logs/hook-*.ndjson`
- `tunnel.ps1` — 用 bin/cloudflared 起临时隧道（trycloudflare 免账号）
- `ws-probe.mjs` — WS 长连接探针（spike ①③⑦a）：帧分类打印 + 落盘，心跳保活，断线自动重连
- `send-test.mjs` — 出站测试（spike ⑤⑥⑦b）：len/rate/app/card/notify/reply 子命令，打印完整响应体
- `id-check.mjs` — robotId ↔ CLI groupId 对照（spike ②）
- `secret.local.json` — **gitignored**：`{"sendMsgUrl":"...","appSecret":"..."}`

## agent 侧命令备忘

```sh
node spike/robot/hook-recv.mjs            # 接收器
node spike/robot/ws-probe.mjs             # 需先有 sendMsgUrl
node spike/robot/send-test.mjs len 3000
node spike/robot/send-test.mjs rate 35 1000
node spike/robot/send-test.mjs card
node spike/robot/id-check.mjs <robotId>
```
