# @dsh-yzj/model-yzj

Plugin-wide default model route for the dsh-yzj bundle: one editable
default (provider + model) in plain JSON under `$DSH_HOME/yzj-model.json`,
shared by every consumer — today the robot channels' model-resolution chain
(per-conversation override > per-robot config > channel default >
**plugin default** > harness default) and the memory dream executor's
fallback; future components (group routines, …) plug into the same default.

## Service `ctx.yzjModels`

| Method | Description |
|---|---|
| `get()` | Current route or undefined; malformed/absent files read as unset. |
| `setDefault(provider, model)` | Persist (both fields required; atomic write). |
| `clear()` | Unset (consumers fall back to the harness default). |
| `catalog()` | Active provider/model entries over the optional `llm` service (same policy as the robot settings picker). |
| `path` | Store path (diagnostics). |

The store file is hand-editable and re-read on every access — external
edits apply live without a restart. Editing UI: the 记忆 tab's
「插件默认模型」 picker (via the `/yzj` RPC face `model-default*` endpoints).

## Configuration

| Key | Default | Description |
|---|---|---|
| `path` | `$DSH_HOME/yzj-model.json` | Store location; `~` expands. |

## Tests

`pnpm vitest run packages/model-yzj` — route persistence round-trip,
malformed-file tolerance, half-empty rejection, catalog passthrough
(empty without `llm`).
