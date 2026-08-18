---
name: dsh-plugin-settings
description: >-
  Add or change a plugin settings section — Host namespace plus Client
  settings.section card. Use when touching 设置 → 云之家 or pairing a new
  config namespace.
---

# Settings card (dsh-yzj)

Distilled from harness `docs/cookbook/adding-a-settings-card.md` (`99f6f02fec`).
Host serves every registered namespace; the Plugins settings UI keys cards on
that namespace. Both halves live in `packages/ui-yzj` (`src/` + `src/client/`).

## Host

Pick one namespace string and use it on both faces. Register through
`installSettingsSection` when the package already has a composition row:

```ts
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'

export const YZJ_NS = settingsNamespace('yzj')
```

Validate writes the schema cannot express in `validate`. Apply live changes in
`onChange`. Do not invent a second persistence store.

This repo's robot settings go through `/yzj` RPC + `ctx.yzjRobot`, not a
workspace tab. Memory vault UI is deferred (R21); do not add a 记忆库 section
unless product law changes.

## Client

Register `settings.section` for a full section. `settings.general.item` is only
for one compact general preference. Query the live slot subtree in the dynamic
plugin skill if you are unsure; here the existing
`packages/ui-yzj/src/client/settings-section.tsx` is the template.

Styling uses `--dsw-*` tokens. Product copy is Chinese.

## After a change

`tsc -b` + `pnpm run bundle` + restart web GUI. Settings tests live in
`packages/ui-yzj/tests/settings-section.client.spec.tsx`.
