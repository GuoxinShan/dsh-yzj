# pitfall-005: function-plugin modules need module-level `export const inject` — a Service class's `static inject` is not consulted

## 复现条件（Reproduction）

A host package exports `apply(ctx, config)` as its plugin entry and internally
constructs a `Service` subclass with `static inject = ['yzjBridge', 'agents']`.
The plugin calls `this.ctx.agents` during `ctx.effect(...)` at load time.
Loading it through the dsh profile (`dsh plugin add` → loader entry) crashes
the whole plugin tree at boot.

## 根因（Root cause）

The loader entry treats the **module** as the plugin: its `apply` function plus
the module-level `inject`/`name` exports. `new SomeService(ctx)` inside
`apply` does not re-scope the service's context — runtime property access
(`ctx.agents`) is authorized against the *loading fiber's* inject declaration,
which is the module's, not the class's. `static inject` on a class only
matters when the class itself is passed to `ctx.plugin(Class)`. Symptom:
`Error: cannot get property "agents" without inject` pointing at the access
site inside the service, far from any obvious inject declaration.

## 解法（Fix）

Declare the dependency at the module level of the entry file:

```ts
export const name = 'robot-yzj'
export const inject = ['yzjBridge', 'agents']
export function apply(ctx: Context, config: Config): void { ... }
```

Keep the class's `static inject` too (it documents the dependency and applies
if the class is ever loaded directly) — but the module export is the operative
one for loader entries.

## 回归覆盖（Regression coverage）

Boot-level coverage is environmental (needs the profile tree), so the guard is
procedural: any new host package that touches `ctx.<service>` outside
`ctx.get()` must list that service in its entry module's `export const inject`.
Found live while installing robot-yzj into the web profile (verification
instance on a spare port — see docs/status/gap-analysis.md §20).
