# @dsh-yzj/memory-yzj

Markdown memory vault for DSH agents: per-scope `sections` / `entities` /
`observations` stores, deterministic retrieval, dream-consolidation tools,
and bounded prompt injection. Design and contracts:
[docs/spec/memory-vault-design.md](../../docs/spec/memory-vault-design.md).

## What it provides

- **Service** `ctx.yzjMemory` (`YzjMemoryService`, thin owner of the pure
  `MemoryCore`): `observe` / `readScope` / `projection` / `search` /
  `dreamLoad` / `dreamApply` — all synchronous (small bounded files; sync
  access is atomic within one process), scoped by `user` or `group:<id>`.
- **Tools** (`inject: ['tools']`):
  | Tool | Kind | Notes |
  |---|---|---|
  | `memory_observe` | write (scratchpad) | One observation file per call; deduped; open pool capped by `observationsMax`. |
  | `memory_read` | read | Bounded view: section/entity summaries + full open observations. |
  | `memory_search` | read | Deterministic multi-token keyword search with matching lines. |
  | `memory_dream_load` | read | Full state incl. content revisions (`rev`) for the dream run. |
  | `memory_dream_apply` | write | Decision list as a JSON-string parameter; per-item validation (stale rev / missing target rejects that item only); log + index always rebuilt. |
- **Injection** (opportunistic, via `ctx.get('systemPrompt')`): the
  `yzj-memory` dynamic context renders `injectScopes`' projections on every
  assembly, capped per scope by that scope's `sections.yaml`
  `inject_char_cap`. Empty vault ⇒ empty text ⇒ no contribution.

None of the tools enter the yzj WRITE_SPECS confirmation gate: the vault is
local, human-auditable storage, not a Yunzhijia-side write (design §3/D4).

## Storage layout

```
<vaultRoot>/            # default $DSH_HOME/yzj-memory
  user/
    sections.yaml       # inject_char_cap: 6000
    sections/<name>.md  # frontmatter: title/order/tags/created/last_updated
    entities/<name>.md  # frontmatter: title/tags/status/created/last_updated
    observations/obs-<ts>-<rand>.md   # open signals (agent-written)
    observations/archived/…           # disposed signals (dream-moved)
    index.md            # generated (rebuilt by every dream apply)
    log.md              # append-only dream audit log
  group-<id>/           # same shape, activated via allowScopes
```

Files are plain Markdown: human edits are first-class, and a dream never
clobbers content it did not read — `rev` (content hash) mismatches reject
that decision item without touching the file.

## Dream consolidation (v0.2)

Consolidation is **off by default** and controlled by a runtime state file —
`<vaultRoot>/dream.json` (hand-editable, hot-reloaded):

```json
{ "enabled": false, "provider": "", "model": "", "dailyAt": "03:30", "lastRunDay": "", "lastNote": "" }
```

- `enabled: false` refuses every consolidation surface — the
  `memory_dream_apply` tool and the executor — in every process sharing the
  vault (including the legacy dsh-routines path). Observe/read/search/load
  are never gated.
- The in-process executor (`dreamRun`) creates a one-shot agent session
  (full session log = audit) driven by the canonical prompt in
  `src/dream.ts`; model resolution: `dream.json` route > plugin default
  (`ctx.yzjModels`) > harness default.
- `dailyAt` (HH:mm) arms a daily in-process tick (`lastRunDay` stamps make
  it restart-safe); triggers: panel「立即固化」(`dream-run`, trigger
  `panel`) and the daily tick (`schedule`).
- The dsh-routines template stays as an alternative path
  ([docs/spec/memory-dream-routine.yaml](../../docs/spec/memory-dream-routine.yaml));
  its model is the run profile's default (dsh-routines has no per-routine
  model field).

## Configuration

| Key | Default | Description |
|---|---|---|
| `vaultRoot` | `$DSH_HOME/yzj-memory` | Vault root; `~` expands. |
| `allowScopes` | `['user']` | Scopes the tools may address (`user`, `group:<id>`). |
| `injectScopes` | `['user']` | Scopes injected into every prompt assembly. |
| `injectCharCap` | `6000` | Cap fallback when a scope has no `sections.yaml`. |
| `observationsMax` | `200` | Open-observation capacity per scope. |
| `maxRenderChars` | `20000` | Model-facing digest cap. |
| `maxMetaChars` | `50000` | UI presentation payload cap. |
| `maxSearchHits` | `20` | Search hit cap. |

## Scheduled dream

Consolidation runs as a dsh-routines routine (LLM judgment in an audited
one-shot session; mechanical application through the tools). Template:
[docs/spec/memory-dream-routine.yaml](../../docs/spec/memory-dream-routine.yaml);
the headless profile needs this package mounted for the routine's session to
see the `memory_*` tools.

## Tests

`pnpm vitest run packages/memory-yzj` — frontmatter round-trip (reference
dream-vault shape), observe semantics (dedup/cap/scope isolation), projection
ordering and caps, deterministic search, all five dream decision types, rev
conflict protection for human edits, malformed-decision reporting, temp-file
hygiene.
