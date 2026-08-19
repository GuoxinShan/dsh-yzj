import { createRequire } from 'node:module'
import { join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Vitest config: resolve client-half packages to their TS source so specs
 * exercise the browser entry directly (the built lib/client.js artifacts are
 * closure-factory bundles that require the shell's `window.__ModuleLoader__`).
 * The harness checkout is the single source of truth for these paths.
 */
const ROOT = fileURLToPath(new URL('.', import.meta.url))
const HARNESS_ROOT = fileURLToPath(new URL('../deepseek-harness', import.meta.url))
const HARNESS = `${HARNESS_ROOT}/packages/client`
const requireRoot = createRequire(join(ROOT, 'package.json'))

export default defineConfig({
  resolve: {
    alias: {
      // runtime's lib/client.js is a closure-factory artifact requiring the
      // shell loader; its source is a plain ESM browser entry that vitest can
      // import directly. ui-primitives' lib/index.js is a plain ESM build and
      // resolves normally.
      '@deepseek-ai/dsh-client-runtime/client': `${HARNESS}/runtime/src/client/index.ts`,
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
      // must be allowed to read that tree for the runtime/client source alias.
      fs: { allow: [ROOT, HARNESS_ROOT] },
      deps: {
        // ui-primitives (rc.7) imports katex/dist/katex.min.css; externalized
        // node_modules deps are loaded raw by Node, which rejects .css.
        // Inlining routes the css through vitest's transform (empty module).
        inline: [/@deepseek-ai\/dsh-client-ui-primitives/],
      },
    },
  },
})
