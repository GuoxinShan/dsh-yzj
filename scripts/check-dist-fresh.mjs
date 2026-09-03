/**
 * Release gate: rebuild every committed `lib/` artifact from `src/` and fail if
 * the working tree changed — i.e. the shipped bundle is stale relative to
 * source. git-based installs (`dsh plugin add github:...#tag`) receive `lib/`
 * verbatim, so a stale artifact ships old behavior (see pitfall-050: the
 * conversation list shipped blank because a `bridgeResult` fix never made it
 * into the committed host bundle).
 *
 * The client bundle is byte-stable (CSS-module keys are sorted in
 * tsdown.shared.ts), so `git diff --exit-code lib/` is a reliable signal.
 *
 * Requires the sibling harness checkout (link: deps) and node that satisfies
 * package.json engines; run after a normal dev setup.
 */
import { execSync } from 'node:child_process'

const sh = (cmd) => execSync(cmd, { stdio: 'inherit' })
// ui-yzj `tsc -b` reports harness API-skew errors but still emits lib/types,
// so tolerate a non-zero exit on the emit steps and rely on the final diff.
const soft = (cmd) => { try { execSync(cmd, { stdio: 'inherit' }) } catch { /* emit-despite-errors */ } }

console.log('› rebuilding lib/ from src/ …')
soft('pnpm --filter @dsh-yzj/bridge --filter @dsh-yzj/tool-yzj --filter @dsh-yzj/model-yzj build')
soft('pnpm --filter @dsh-yzj/ui-yzj exec tsc -b --force')
soft('pnpm --filter @dsh-yzj/ui-yzj exec tsdown')
soft('pnpm --filter @dsh-yzj/ui-yzj exec tsdown --env.DSH_BUILD_FACE=client')
sh('pnpm exec tsdown')
sh('node scripts/copy-client.mjs')

try {
  execSync('git diff --exit-code -- lib/', { stdio: 'inherit' })
  console.log('✓ lib/ is in sync with src/.')
} catch {
  console.error('\n✗ Committed lib/ is STALE relative to src/.')
  console.error('  Rebuild (pnpm run build) and commit the regenerated lib/ before tagging.')
  console.error('  Why this matters: docs/pitfalls/pitfall-050-shipped-lib-stale-empty-conv-list.md')
  process.exit(1)
}
