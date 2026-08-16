/**
 * Copy the ui-yzj closure-factory client bundle into the aggregate package
 * root as lib/client.js (+ map). The closure artifact is stamped with its own
 * `@dsh-yzj/ui-yzj` id and must ship verbatim — re-bundling it would break
 * the `window.__ModuleLoader__.load` handoff.
 */
import { copyFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
mkdirSync(join(ROOT, 'lib'), { recursive: true })
for (const name of ['client.js', 'client.js.map']) {
  copyFileSync(join(ROOT, 'packages', 'ui-yzj', 'lib', name), join(ROOT, 'lib', name))
}
console.log('copied ui-yzj client bundle to lib/client.js')
