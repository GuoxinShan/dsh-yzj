import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Vitest config: resolve client-half packages to their TS source so specs
 * exercise the browser entry directly (the built lib/client.js artifacts are
 * closure-factory bundles that require the shell's `window.__ModuleLoader__`).
 * The harness checkout is the single source of truth for these paths; when
 * the sibling checkout is absent (e.g. standalone git worktrees), fall back
 * to the machine-level harness checkout resolved from DSH_HARNESS_ROOT, then
 * ~/dev/deepseek-harness.
 */
const ROOT = fileURLToPath(new URL('.', import.meta.url))
const HARNESS_ROOT = fileURLToPath(new URL('../deepseek-harness', import.meta.url))
const HARNESS = `${HARNESS_ROOT}/packages/client`
const requireRoot = createRequire(join(ROOT, 'package.json'))
const HARNESS_SOURCE = `${HARNESS}/runtime/src/client/index.ts`
const FALLBACK_HARNESS_ROOTS = [
  ...(process.env.DSH_HARNESS_ROOT !== undefined && process.env.DSH_HARNESS_ROOT !== '' ? [process.env.DSH_HARNESS_ROOT] : []),
  `${process.env.HOME ?? ''}/dev/deepseek-harness`,
]
const RUNTIME_CLIENT_ALIAS = existsSync(HARNESS_SOURCE)
  ? HARNESS_SOURCE
  : FALLBACK_HARNESS_ROOTS
      .map(root => join(root, 'packages/client/runtime/src/client/index.ts'))
      .find(candidate => existsSync(candidate)) ?? HARNESS_SOURCE

/** Prefer a built primitives lib (unbuilt sibling checkout has none). */
const PRIMITIVES_LIB = [
  join(HARNESS, 'ui-primitives/lib/index.js'),
  join(ROOT, 'node_modules/@deepseek-ai/dsh-client-ui-primitives/lib/index.js'),
].find(candidate => existsSync(candidate)) ?? join(HARNESS, 'ui-primitives/src/index.ts')

export default defineConfig({
  resolve: {
    alias: {
      // runtime's lib/client.js is a closure-factory artifact requiring the
      // shell loader; its source is a plain ESM browser entry that vitest can
      // import directly. ui-primitives' sibling link has no lib/ until the
      // harness is built — fall back to the workspace registry artifact.
      '@deepseek-ai/dsh-client-runtime/client': RUNTIME_CLIENT_ALIAS,
      // ui-yzj's workspace link points at the unbuilt sibling tree (no lib/).
      '@deepseek-ai/dsh-client-ui-primitives': PRIMITIVES_LIB,
    },
  },
  plugins: [{
    // Vite does not walk a file-outside-the-repo's node_modules. Harness
    // source pulled in by the runtime/client alias resolves @deepseek-ai
    // peers from this workspace (registry rc.7), not the unbuilt vendor tree
    // (pitfall-034).
    name: 'yzj-harness-source-peers',
    resolveId(source, importer) {
      if (importer === undefined || !importer.includes(`${sep}deepseek-harness${sep}`)) return null
      if (source.startsWith('.') || source.startsWith('/') || source.startsWith('node:')) return null
      try {
        return requireRoot.resolve(source)
      } catch {
        return null
      }
    },
  }],
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    // Only this repo's packages — stray sibling checkouts cloned into the
    // workspace root (e.g. .openclaw-yzj) must not be picked up.
    include: ['packages/*/tests/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    server: {
      // The sibling checkout is often a symlink whose realpath sits outside
      // this repo (cloud agents: /deepseek-harness → /home/ubuntu/...). Vite
      // must be allowed to read that tree for the runtime/client source alias
      // (including the worktree fallback checkout).
      fs: { allow: [ROOT, HARNESS_ROOT, ...FALLBACK_HARNESS_ROOTS] },
      deps: {
        // ui-primitives (rc.7) imports katex/dist/katex.min.css; externalized
        // node_modules deps are loaded raw by Node, which rejects .css.
        // Inlining routes the css through vitest's transform (empty module).
        inline: [/@deepseek-ai\/dsh-client-ui-primitives/],
      },
    },
  },
})
