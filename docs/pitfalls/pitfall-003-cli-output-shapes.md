# Pitfall 003 — yzj-cli 输出形态：写解析前必须先实测

> 记录日期：2026-08-15 ｜ 关联提交：`e7f904c`、`a890003` ｜ **2026-09-02 增补 0.1.6 统一信封**
> 影响区域：`packages/bridge` 消费方、`packages/tool-yzj/src/shared.ts` `unwrapCli` / `cliList`、ui-yzj `cli-payload.ts`

## 现象与根因

CLI **0.1.3 / 0.1.4** 的 JSON 输出**没有统一信封**，同一条命令族里混着三种形态，按文档/直觉写解析必错：

| 形态 | 命令示例 | 样子 |
|---|---|---|
| 裸数组 | `doc workspace list`、`doc list`、`contact user get` | `[{id, name, …}, …]` |
| data 信封 | `doc block list`、`sheet get` | `{success, data: {blocks/sheets: […]}, error}` |
| fields 为 JSON 字符串 | `sheet record list/create/update` | `records[].fields` 是**字符串** `"{\"姓名\":\"张明\"}"`，不是嵌套对象 |

**0.1.6**（skill 0.6.0，2026-09-02 实测未登录二进制）把成功 stdout 收成统一信封：

```json
{ "success": true, "identity": { "openId": "…" }, "data": { } }
```

- 列表在 `.data.list`（`--jq` 也从信封根起步，所以官方文档写 `.data.list`）。
- 伴随字段（如 `more`）与 `list` 平级，在 `data` 里，不在信封根。
- 空写回执可以没有 `data`（`im group rename` 成功即此）。
- 失败：stdout 空，stderr 单行 JSON `{success:false, error:{type,subtype,message,hint,code}}`。退出码见 [pitfall-049](pitfall-049-cli-exit10-vs-auth-exit3.md)。

插件仍必须兼容 0.1.4 裸数组 / `{list}`——用户机器可能还没升级。

已实测的其他事实（都吃过亏，仍有效）：

- record create/update 的 `--records` **必须是数组** `[{"fieldsValue":{…}}]`——对象形态直接 400。
- SingleSelect 选项必须 table create 时经 `data.items` 预注册；运行期写未注册值**静默丢弃**（存 `""`，不报错）。
- MultipleSelect 动态新值同样静默丢弃 → tag 只能用文本 tokens。
- Contact 字段写入（object/数组/裸 openId 全试过）服务端 500 → 负责人降级 `姓名(openId)` 文本。
- Date 值形态 `YYYY/MM/DD` 字符串，读写同形。
- `doc workspace list --type personal` 的**首项不一定是「我的知识」**（本机首项是 AI速记知识库）——发现逻辑必须扫全部候选。

## 解法

- 解析入口一律走 `unwrapCli`（剥 `{success:true, data}`；裸数组 / 0.1.4 对象原样返回；空回执 → `{}`），列表再走 `cliList` / 浏览器 `cliRows`。
- 不要在 `bridge.run` 里解信封：假 CLI 仍回 `{argv:…}`，解包放 tool / `/yzj` RPC。
- 需要新字段/新命令时，**先用真实 CLI 打一发看原始 JSON**，不要只信 skill / README（0.1.6 skill 仍写「无独立文件夹」，`--help` 却有 `doc folder create`）。

## 回归覆盖

- `packages/tool-yzj/tests/cli-envelope.spec.ts`；`v016-tools.spec.ts`（包裹与未包 list 都能出 digest）；`bound-log.spec.ts`；`packages/ui-yzj/tests/cli-payload.spec.ts` / `contact-parse.spec.ts`。

## 教训

CLI 无源码可读、无 schema 可查——**实测输出是唯一事实源**；「静默丢弃」类失败（select 选项）没有报错路径，只有回读校验能发现。

2026-08-19 增补实例：`contact user get` 返回顶层裸数组，而当时的 `whoamiOpenId` 按 `{list:[…]}` 解析 → selfOpenId 永远为 `""`。更深一层的坑：**fake store 的 mock 形状也是照错误假设写的**，单测绿而真机挂。修法双管齐下：解析层改「裸数组优先、`{list}` 兼容」，fake 改实测形状。教训追加：mock 的形状也必须实测，不能照解析代码的假设写。

