# pitfall-008: packed zstd session logs fool naive readers — "header-only" is a frame-decoding artifact, not missing persistence

## 复现条件（Reproduction）

The jsonl session backend writes `session.jsonl.zstd` as a **concatenated
container of many independent Zstandard frames** (`packChunks: true` default:
each append batch is its own checksummed frame, packed storage rows for
delta-runs). Any ad-hoc reader that decompresses the whole file with a
one-shot API (`zstdDecompressSync` / `inflateSync`) sees only the FIRST frame
— typically just the header record — so a healthy multi-thousand-event log
reads as "events: 1, session {}" and the channel looks unpersisted.

## 根因（Root cause）

`scanZstdFrames` in the backend parses frame HEADERS to find boundaries (a
magic-byte scan is not enough — the magic `28 b5 2f fd` also occurs inside
compressed payloads, so naive splitters corrupt slices); the decoder then
iterates the structurally-complete ranges. Spike scripts that bypassed this
(even with magic scanning + merge retries) extracted only ~10% of the events
on a known-good 8 MB main-session log (33k of 350k lines), which led to a
wrong "persistence is broken for robot sessions" conclusion and a whole
diagnostic detour.

## 解法（Solution）

Use the backend's own readers instead of reimplementing frame splitting:
`ctx.sessionPersistence.readFrom(id, …)` / `readPrefix`, or the
`scanZstdFrames` + decoder primitives exported from
`@deepseek-ai/dsh-session-persistence-jsonl/zstd`. When a quick check must
stay dependency-free, remember that a single decompress shows only the first
frame — never conclude "no events" from it. Evidence rule: file mtime growth
and the coordinator's cursor (visible in append seq-mismatch errors) are the
trustworthy liveness signals, not first-frame line counts.

## 回归覆盖（Regression coverage）

None in-repo (the harness's own reader is the source of truth; spike readers
were thrown away). If a reader helper is ever added to dsh-yzj, it must be
tested against the main-session fixture (expect ~350k lines, contiguous seqs).
