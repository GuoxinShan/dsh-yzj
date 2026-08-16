# @dsh-yzj/bundle

Installable dsh profile bundle for 云之家. Declares `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`, making it a patch layer for `dsh --profile` compositions ([profile contract](../../deepseek-harness/packages/boot/app-boot/README.md#profiles)).

The patch inserts six rows over the base + web-app layers:

| Row | Package | Role |
| --- | ------- | ---- |
| `yzj-bridge` | `@dsh-yzj/bridge` | `ctx.yzjBridge` subprocess channel to `yzj-cli` |
| `tool-yzj` | `@dsh-yzj/tool-yzj` | 45 model-facing tools + the approval guard |
| `ui-yzj` | `@dsh-yzj/ui-yzj` | `/yzj` RPC channel (node half) + tool cards and workspace panel (browser half, discovered by the modules registry through its `dsh.client` declaration) |
| `robot-yzj` | `@dsh-yzj/robot-yzj` | Yunzhijia robot channel: measured WS inbound + sendMsgUrl outbound, session router (reply-chain continuation, bang command family, ack-then-push), DSH→robot controls, group shared workspaces, and the chatnode bridge (see the package README) |
| `memory-yzj` | `@dsh-yzj/memory-yzj` | Markdown memory vault (`memory_*` tools, dream consolidation, bounded prompt injection) |
| `model-yzj` | `@dsh-yzj/model-yzj` | Plugin-wide default model route (`$DSH_HOME/yzj-model.json`) shared by the robot chain and the dream executor |

## Install

```sh
dsh plugin --profile web add <bundle 包名或路径>
```

The profile reconcile appends `@dsh-yzj/bundle` to `dsh.profile.bundles` automatically. Restart the GUI afterwards; the sidebar shows the 云之家 toggle.

## Model Experience

Indirect only: the bundle itself mounts the rows that own all model-visible behavior.
