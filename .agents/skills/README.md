# Agent skills (plugin development)

Copied or distilled from sibling `../deepseek-harness` at **`99f6f02fec`**
(`dsh-v0.1.0-rc.7`, pulled 2026-08-18). Refresh by pulling harness and
re-copying the two `cordis-*` files; keep the `dsh-*` overlays in this repo.

| Skill | Source | Use when |
|---|---|---|
| [dsh-yzj-plugin](dsh-yzj-plugin/SKILL.md) | this repo | any change in this bundle |
| [cordis-plugin-development](cordis-plugin-development/SKILL.md) | harness cordis preset | Host/Client, slots, inject, RPC, effects |
| [editing-cordis-compositions](editing-cordis-compositions/SKILL.md) | harness cordis preset | composition rows, host vs preset, realms |
| [dsh-plugin-tools](dsh-plugin-tools/SKILL.md) | harness cookbook + WRITE_SPECS | new or changed model tools |
| [dsh-plugin-settings](dsh-plugin-settings/SKILL.md) | harness cookbook | 设置 → 云之家 |

Not copied (read in harness if needed):

- `docs/cordis-tutorial/` (01–07) — first-plugin walkthrough
- `docs/cookbook/adding-a-package.md` — harness monorepo package checklist
- `docs/cookbook/adding-a-conversation-node.md` — custom chat nodes
- `.agents/skills/dsh-*` process skills (review, docs, CI) — harness-only
- `.agents/notes/` — harness Agent Notes (RFC + format gates). This repo uses `docs/spec` / `gap-analysis` / `pitfalls` instead; see [../README.md](../README.md).
