# `.agents/`

Agent-facing extras for this plugin repo. Not a second product spec — `docs/` stays the authority.

## `skills/`

Plugin-development skills copied or distilled from sibling `deepseek-harness`. Index: [skills/README.md](skills/README.md).

## Why there is no `notes/` tree

Harness requires **Agent Notes** (`.agents/notes/{proposed|implemented|rejected|archived}/{class}/yyyy-mm-dd-slug.md`) on every non-trivial PR. Hard rule in harness `AGENTS.md`:

> Non-trivial changes MUST include an Agent Note in the same PR.

A note is an RFC: Problem / Decision / Alternatives considered / Consequences. Lifecycle folders move as status changes. `implemented/` is kept current with shipped code. Format, i18n triplets (`md` + `zh.md` + `i18n.yaml`), and archive hashes are gated (`verify-agent-note-format`, `verify-archived-agent-notes`). Classification is a closed set: feature / bug-fix / simplification / architecture / process / testing.

**This repo already has the same jobs, in Chinese product docs:**

| Harness Agent Note | Here |
|---|---|
| Why + what we gave up | `docs/spec/*` 决策表 |
| Shipped vs design | `docs/status/gap-analysis.md` |
| Implementation trap + regression | `docs/pitfalls/pitfall-NNN-*.md` |
| Proposed / not built | spec 待拍板 / gap 开放项 |

Do **not** copy harness `notes/` or its verifiers. That corpus is thousands of files and assumes bilingual triplets plus doc-sync. Duplicating it here would fight Spec-driven (`docs/` is the subject). If a decision is too small for spec and too design-y for a pitfall, put it in the owning spec 决策表, same commit as the code.

When changing harness itself, write Agent Notes **in the harness checkout**, not here.
