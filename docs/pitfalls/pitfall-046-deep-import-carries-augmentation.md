# pitfall-046: 深路径 import 隐式携带 cordis augmentation——删除时断链，类型静默 any

## 现象

删除一个看似无用的深路径 import（`import { sessionHasSummonWindow } from '@dsh-yzj/tool-yzj/src/index.ts'`——函数本身已无调用者）后，全仓 typecheck **不报新错**，但另一处代码开始报一串莫名类型错：`Parameter 'row' implicitly has an 'any' type`、`'pooled' is possibly 'null'`、`Property 'channel' does not exist on type '{}'`——全在**没改过的代码**（advance-ref-lookup）里。

## 根因

`ctx.yzjHome/yzjTodo/yzjAdvance/yzjBridge` 的 Context augmentation（`declare module '@deepseek-ai/cordis'`）散在 tool-yzj/bridge 的**各域源文件**里，包入口 `index.ts` 不 re-export 它们（`export { ... }` 只导值不导 augmentation 的加载效果——augmentation 靠**模块被加载**生效）。ui-yzj 的编译程序里，这条 augmentation 链正是由 bound-io.ts 那个深路径 import **隐式携带**的。删掉它 → `ctx.get('yzjAdvance')` 静默退化为弱类型（`{}`/any）→ 下游推断全塌。d.ts 侧（`lib/types/*.d.ts`）虽然也有 declare module，但与源码版同名声明在同一个程序里会 TS2717 冲突，不能双加载。

## 解法

深路径 import 的替代物必须**显式补链**：

```ts
// 深路径 type-only import：tool-yzj 源码入口带出全部 cordis augmentation——
// 包入口 d.ts 不 re-export 它们，浅 import 拿不到。
import type {} from '@dsh-yzj/tool-yzj/src/index.ts'
```

判定技巧：probe 文件里 `const n: number = ctx.get('yzjHome')` 不报错 = augmentation 已失效（any 可赋一切）。

## 回归覆盖

决策 53（2026-08-25）拆除 sessionHasSummonWindow 时真实踩中；修复后全量 typecheck 0 错。以后删除任何 `@dsh-yzj/*/src/...` 深路径 import 前，先 grep 该入口是否携带 augmentation 链。
