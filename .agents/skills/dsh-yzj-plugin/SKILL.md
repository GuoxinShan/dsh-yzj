---
name: dsh-yzj-plugin
description: >-
  Develop or debug this dsh-yzj plugin bundle — Host/Client packages, tools,
  slots, settings, write-gate, bundle, and profile install. Use when adding a
  tool or UI surface, changing RPC, or adapting to a harness interface change.
---

# dsh-yzj plugin development

This repo is a **standalone plugin bundle**, not an in-session `cordis_define`
plugin and not a shipped harness preset.

Read first: [AGENTS.md](../../../AGENTS.md), [docs/README.md](../../../docs/README.md).
Then the matching upstream skill:

| Job | Skill |
|---|---|
| Host vs Client, slots, inject, effects, lossless RPC | `cordis-plugin-development` |
| Composition rows, host vs preset plane, isolate realms | `editing-cordis-compositions` |
| `defineTool` / output / write-gate | `dsh-plugin-tools` |
| Settings Host+Client pairing | `dsh-plugin-settings` |

## Layout

```
packages/bridge      ctx.yzjBridge — argv spawn only
packages/tool-yzj    model tools + WRITE_SPECS + ctx.yzjTodo
packages/ui-yzj      /yzj RPC (node) + client slots (browser)
packages/robot-yzj   inbound WS + outbound webhook
packages/memory-yzj  vault + dream + memory_* tools
packages/model-yzj   default model route
root @dsh-yzj/bundle tsdown six host halves + lib/client.js
cordis.patch.yml     profile rows: @dsh-yzj/bundle/<row>
```

Workspace `@deepseek-ai/*` stays `link:../../../deepseek-harness/...`. After
pulling harness, run typecheck/tests here and adapt — do not copy harness
source.

## Workflow

1. **Docs first** — change `docs/spec/` (and gap / pitfalls) in the same commit.
2. Implement the package. New write tool → `WRITE_SPECS` + keyed card + README.
3. Host change: `pnpm run build`. Browser half: `tsc -b` then `pnpm run bundle`
   (pitfall-016).
4. Web profile has no HMR. Restart `--profile web` on 3080. Do not kill this
   process if the agent is running inside it.
5. Evidence: matching vitest, or `.acceptance/verify-*.mjs` for UI.

## Hard rules (same as AGENTS.md)

- Register only via `ctx.effect()` / `ctx.on()` / disposer APIs.
- `/yzj` carries lossless JSON only — never serialize Context/Session/Service.
- User-direct writes (composer, todo check, `home-send`) skip the confirm card.
  Agent writes go through `WRITE_SPECS`.
- No bash `yzj-cli` write path; only bridge argv spawn.
- Official sidebar 「云之家」 = `yzj-topic-*` only. Rooms are not DSH chats
  (R20/R24). Topics do not seed empty turn 1 (R25 / pitfall-025).

## Harness source

Sibling checkout `../deepseek-harness` at the commit recorded in the copied
skills. Pull that repo when interfaces change; this overlay does not replace it.
