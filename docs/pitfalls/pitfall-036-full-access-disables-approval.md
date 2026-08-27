# pitfall-036: GUI 会话「Full access」档位使 yzj 写工具 ask 自动转 deny——确认卡永远不弹

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

`approval: 'never'` 意味着审批能力不被组合进会话;core tools 的执行语义是
「missing approval support turns `ask` into denial」(`packages/core/tools`)。
于是 tool-yzj guard 的 `{ kind: 'ask' }` 在 core 层直接落成 denial,`approval/request`
瀑布根本不会运行——ui-yzj write-gate 连弹卡的机会都没有。这不是 dsh-yzj 的缺陷,
是 harness preset 语义:Full access 只为 harness 自带沙箱工具放行设计,插件的
ask 决策在该档位下等于自动拒绝。

## 解法(Solution)

需要确认卡流的实验/验收,会话档位必须是 **Workspace Write**。浏览器 driver 在发
prompt 前检查 composer 档位选择器文本,非 Workspace Write 则点开切换:

```ts
const permPicker = page.locator('button, [role="button"]')
  .filter({ hasText: /Full access|Workspace Write|Read Only/ }).first()
if (!(await permPicker.innerText()).includes('Workspace Write')) {
  await permPicker.click()
  await page.getByText('Workspace Write', { exact: true }).first().click()
}
```

反向切换(Full access → Workspace Write)无确认对话框;启用 Full access 才有
「确认启用 Full access?」对话框(harness `access-confirmation.e2e.ts`)。

## 回归覆盖(Regression coverage)

`.acceptance/acceptance-wave.mjs` / `acceptance-wave.mjs` 内置档位检查与切换;
后续任何依赖确认卡的 `.acceptance` 脚本应复用这段,不要假设档位默认值。
