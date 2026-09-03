/**
 * Copy the ui-yzj closure-factory client bundle into the aggregate package
 * root as lib/client.js (+ map). The closure artifact is stamped with the
 * loader entry id `@dsh-yzj/bundle` and must ship verbatim —
 * re-bundling it would break the `window.__ModuleLoader__.load` handoff.
 *
 * Root is the script's repository, not process.cwd() — `pnpm --filter
 * @dsh-yzj/ui-yzj bundle` must still refresh the file DSH loads
 * (pitfall-051).
 */
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
mkdirSync(join(ROOT, 'lib'), { recursive: true })
for (const name of ['client.js', 'client.js.map']) {
  copyFileSync(join(ROOT, 'packages', 'ui-yzj', 'lib', name), join(ROOT, 'lib', name))
}
console.log('copied ui-yzj client bundle to lib/client.js')
