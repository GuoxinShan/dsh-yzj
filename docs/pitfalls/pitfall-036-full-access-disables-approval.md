# pitfall-036: GUI 会话「Full access」档位使 yzj 写工具 ask 自动转 deny——确认卡永远不弹

> **已修复（决策 D9 补强）**：guard 不再对云之家写返回 harness `{ kind: 'ask' }`，改走 `yzj/confirm-request` 自托管瀑布；write-gate 应答后才 `allow`/`deny`。Full access 只放开本机沙箱，云上写确认卡照弹。下文是原复现与根因，保留给回归。

## 复现条件(Reproduction)

web GUI 会话权限档位为 **Full access**(composer 左下档位选择器)时,agent 调用任何
`WRITE_SPECS` 门控的 yzj 写工具(`yzj_im_message_send` / `yzj_doc_write` 等):
确认卡不弹,工具调用直接以 isError 结束,模型收到的语义是「approval prompts 被禁用、
写操作被自动拒绝」,随后转入向用户追问「要不要开审批」的死循环。真机实验第 1 波
driver 首轮四连发全部因此失败(0 张卡、看板零写入),模型反复请求人工开启审批。

## 根因(Root cause)

harness `packages/interaction/permission-presets` 的内置 preset 表:

- `workspace-write` = `{ sandbox: 'workspace-write', approval: 'ask' }`
- `danger-full-access`(GUI 显示名「Full access」)= `{ sandbox: 'danger-full-access', approval: 'never' }`

`approval: 'never'` 意味着 `ApprovalService.request()` 在派发 `approval/request`
瀑布**之前**就确定性返回 `rejected`（「never is unbypassable even by a prepended
answerer」）。core tools 对 `{ kind: 'ask' }` 的执行语义是「没有审批通道则
deny」。于是旧 guard 的 `{ kind: 'ask' }` 在 Full access 下直接落成 denial,
`approval/request` 瀑布根本不会运行——ui-yzj write-gate 连弹卡的机会都没有。

这不是「Full access = 云之家写免确认」。Full access 的产品文案是
「Full file access without approval prompts」——只覆盖本机文件沙箱。发消息 /
删文档 / 改日程是云上副作用，D9 要求 agent 发起的写永远弹卡。

## 解法(Solution)

**不要**把云之家写挂在 harness `ask` 上。`tools/pre-execute` 命中 `WRITE_SPECS`
后广播 `yzj/ask-pending`，再 `waterfall('yzj/confirm-request')`；write-gate
应答该瀑布（自建 `writeId`，不依赖 `approval/asked`），用户点确认卡后 guard
才返回 `{ kind: 'allow' }` 或 `{ kind: 'deny' }`。

- GUI Full access / Workspace Write：同一条卡，write-gate 挂着就弹。
- headless overlay（只挂 tool-yzj、无 ui-yzj）：瀑布 `next()` → `unavailable` →
  deny（fail-closed，与「没有确认通道」一致）。
- 旧的 `approval/request` 应答保留作防御：若仍有人 return `ask`，Workspace Write
  档位下官方审计路径还能接。

验收脚本不再**必须**先切到 Workspace Write 才能弹卡；切档位那段仍可留作
harness 沙箱工具的前置（bash/fs 的 never 语义没变）。

## 回归覆盖(Regression coverage)

- `packages/tool-yzj/tests/guard.spec.ts`：写工具走 `yzj/confirm-request`，
  `allowed-once` → allow、`rejected`/`unavailable` → deny；不再 return `ask`。
- `packages/ui-yzj/tests/write-gate.spec.ts`：无 `approval/asked` 的
  `yzj/confirm-request` 仍能建 pending 记录并 settle。
