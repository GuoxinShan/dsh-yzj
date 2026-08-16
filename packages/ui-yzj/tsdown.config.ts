import { clientBundle } from '../../tsdown.shared.ts'

// Registration id must be the loader entry (profile patch row) name
// @dsh-yzj/bundle/ui-yzj, not the package name: the harness client-modules
// arrive() check requires the __ModuleLoader__.load handoff id to equal the
// graph row id (see docs/pitfalls/pitfall-010-loader-entry-id.md).
export default clientBundle('@dsh-yzj/bundle/ui-yzj', ['lib/types/index.js', 'lib/types/invariant.js'])
