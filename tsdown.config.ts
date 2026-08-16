/**
 * Root aggregate build (monobundle): bundles the six workspace packages'
 * host halves (their tsdown lib output) into one installable package's
 * `lib/`, inlining @dsh-yzj/* inter-deps (noExternal) and keeping
 * @deepseek-ai/* external (registry dependencies). The ui-yzj browser half
 * is a closure-factory artifact that must NOT be re-bundled — it is copied
 * verbatim to lib/client.js (see scripts/copy-client.mjs).
 */
import { defineConfig } from 'tsdown'

export default defineConfig({
  name: '@dsh-yzj/bundle',
  entry: {
    bridge: 'packages/bridge/lib/index.js',
    'tool-yzj': 'packages/tool-yzj/lib/index.js',
    'ui-yzj': 'packages/ui-yzj/lib/index.js',
    'robot-yzj': 'packages/robot-yzj/lib/index.js',
    'memory-yzj': 'packages/memory-yzj/lib/index.js',
    'model-yzj': 'packages/model-yzj/lib/index.js',
  },
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  dts: false,
  clean: true,
  // @dsh-yzj/* inter-deps inline into each entry (self-contained rows);
  // everything else external (resolved from dependencies at install time).
  noExternal: [/@dsh-yzj\//],
})
