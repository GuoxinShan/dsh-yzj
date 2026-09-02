# Pitfall 049 — 0.1.6 确认闸是 exit 10，exit 3 改成认证失败

> 记录日期：2026-09-02 ｜ 关联：`@yunzhijia/cli@0.1.6` skill 0.6.0
> 影响区域：`packages/tool-yzj/src/shared.ts` `failureDigest` / 任何把 CLI 非零退出当「未登录」的代码

## 现象与根因

yzj-cli 0.1.4 的 `references/global.md` 把高风险命令缺 `--yes` 标成 **exit 3** + `confirmation_required`。0.1.6 / skill 0.6.0 把该闸改成 **exit 10**；exit 3 现在是 **认证失败**（`authentication` / `credentials_missing`，未登录实测如此）。

若仍按「exit 3 = 要确认」或「任何非零 = 未登录」分流：

- 漏传 `--yes` 的删除族会被提示去 `auth login`，而真正缺的是产品确认卡后的 `--yes`；
- 未登录会被当成确认闸，digest 教模型加 `--yes` 而不是登录。

`--jq` 求值失败是 exit 5（语法错是 exit 2）。本插件不传 `--jq`。

`im message recall` / `im group rename` / `doc folder create` 的 `--help` **没有** `--yes`：高风险语义在产品确认卡，不要因为 exit 10 文档就给这些命令加 `--yes`。

## 解法

- `looksCliConfirm`：`exitCode === 10` **或** stderr 含 `confirmation_required`（兼容 0.1.4 exit 3 确认）。
- 认证 hint 只看 stderr（`auth` / `credential` / `未授权` 等），不把 exit 3 一律当确认。
- 删除族在确认卡通过后继续透传 `--yes`；recall / rename / folder create 不加 `--yes`。
- 写路径禁止 bash 直调 CLI。

## 回归覆盖

- `packages/tool-yzj/tests/cli-envelope.spec.ts`（exit 10 / exit 3 认证 / 0.1.4 confirmation_required）
- `packages/bridge/tests/bridge.spec.ts`（fake CLI `confirm` / `unauth`）
- `packages/tool-yzj/tests/v016-tools.spec.ts`（recall / rename 组装不含 `--yes`）

## 教训

退出码表会在小版本里改用途。对照要以当前包的 `references/global.md` **加上未登录二进制实测**为准，不能沿用上一版 global.md。
