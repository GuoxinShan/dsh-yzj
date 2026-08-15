# Pitfall 003 — yzj-cli 输出的三种形态：写解析前必须先实测

> 记录日期：2026-08-15 ｜ 关联提交：`e7f904c`、`a890003`
> 影响区域：`packages/bridge` 消费方、`packages/tool-yzj/src/todo.ts`、ui-yzj 的 doc-blocks 消费

## 现象与根因

CLI 0.1.3 的 JSON 输出**没有统一信封**，同一条命令族里混着三种形态，按文档/直觉写解析必错：

| 形态 | 命令示例 | 样子 |
|---|---|---|
| 裸数组 | `doc workspace list`、`doc list` | `[{id, name, …}, …]` |
| data 信封 | `doc block list`、`sheet get` | `{success, data: {blocks/sheets: […]}, error}` |
| fields 为 JSON 字符串 | `sheet record list/create/update` | `records[].fields` 是**字符串** `"{\"姓名\":\"张明\"}"`，不是嵌套对象 |

已实测的其他事实（都吃过亏）：

- record create/update 的 `--records` **必须是数组** `[{"fieldsValue":{…}}]`——对象形态直接 400。
- SingleSelect 选项必须 table create 时经 `data.items` 预注册；运行期写未注册值**静默丢弃**（存 `""`，不报错）。
- MultipleSelect 动态新值同样静默丢弃 → tag 只能用文本 tokens。
- Contact 字段写入（object/数组/裸 openId 全试过）服务端 500 → 负责人降级 `姓名(openId)` 文本。
- Date 值形态 `YYYY/MM/DD` 字符串，读写同形。
- `doc workspace list --type personal` 的**首项不一定是「我的知识」**（本机首项是 AI速记知识库）——发现逻辑必须扫全部候选。

## 解法

- 解析层一律**双形态兼容**：`Array.isArray(json) ? json : (json.list ?? json.data?.xxx ?? [])`。
- 需要新字段/新命令时，**先用真实 CLI 打一发看原始 JSON**（`.acceptance/` 下留了探针脚本传统），不要照工具的 `--help` 描述写。
- 每条格式事实同时是正式待办 API 的需求证据，回写 `../migration/todo-backend-migration.md` §3。

## 回归覆盖

- `todo.spec.ts`（多 workspace 扫描、records 数组形态、fields 字符串解析）；`doc-walk.client.spec.tsx`（block 树双镜像结构）。

## 教训

CLI 无源码可读、无 schema 可查——**实测输出是唯一事实源**；「静默丢弃」类失败（select 选项）没有报错路径，只有回读校验能发现。
