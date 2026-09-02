# pitfall-009: defineTool 的 output.schema 必须保持字面量结构类型；数组 of object 参数走 JSON 字符串

## 复现条件（Reproduction）

在 dsh-yzj 仓库新增一个 `defineTool` 工具包（不抄 tool-yzj 的 `yzjToolOutput`，而是自写输出契约），两种写法都会在 `tsc -b` 阶段报出**误导性错误**：

1. 把共享输出契约声明成 `{ readonly schema: object; render(...); presentationMeta(...) }`（schema 宽化为 `object`）；
2. 参数里要一个「对象数组」（如 `decisions: {type:'array', items: z.object({...})}`，用 schemastery 对象做 items）。

## 根因（Root cause）

- `defineTool` 的 `output` 参数是 `ValueSchemaSpec` 判别联合：`schema` 必须是带 `type: 'object'` / `additionalProperties: false` / 具名 properties 的**字面量结构**。宽化成 `object` 后，TS 不在 schema 字段上报错，而是把 `render`/`presentationMeta`/`execute` 的推断整体打穿（`Type 'object' is not assignable to type 'ValueSchemaSpec'` 连带 `execute` 返回 `Promise<never>`），报错位置远离真因。
- `ParameterPropertySpec` 的 `items` 只接受标量/json 型 `ValueSchemaSpec`，**不存在 object 形态**；schemastery 的 `z.object()` 不是它的成员，硬塞报深层联合不匹配。
- 附带：`exactOptionalPropertyTypes` 下给可选字段显式赋 `undefined`（含 spread 构造时两次调用同一函数的结果）不收窄，必须先落局部变量再条件展开。

## 解法（Fix）

- 输出契约照抄 tool-yzj `shared.ts` 的 `yzjToolOutput` 形状：`schema` 用完整字面量结构类型（`type: 'object'`、`additionalProperties: false`、每个 property 字面量），render/presentationMeta 的 value 参数用自己的 value 接口。
- 「对象数组」参数用 **JSON 字符串 + execute 里 `JSON.parse` 校验**——仓库既有先例是 todo 工具族的 `records`（模型实测能稳定产出）；解析失败抛错转 isError，逐条失败进报告则用 `dreamApplyRaw` 范式（畸形条目降级为报告项，不打断批）。
- 可选字段构造用局部变量 + 条件 spread（`...(x === undefined ? {} : { x })`），不要对同一取值函数调用两次。

## 回归覆盖（Regression coverage）

`packages/memory-yzj` 的构建本身即回归（typecheck 失败即复发）；畸形决策条目进报告的行为由 `tests/vault.spec.ts`「rejects malformed decision entries as report items, not exceptions」覆盖。首发现场：memory-yzj 首版构建（提交 b600e0d）。
