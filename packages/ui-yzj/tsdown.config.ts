import { clientBundle } from '../../tsdown.shared.ts'

// 0.1.2 client-modules keys the graph by the package manifest `name`.
// The Loader row is therefore the package root `@dsh-yzj/bundle`, and the
// handoff id must match (see docs/pitfalls/pitfall-010-loader-entry-id.md
// and pitfall-047).
export default clientBundle('@dsh-yzj/bundle', ['lib/types/index.js', 'lib/types/invariant.js'])
