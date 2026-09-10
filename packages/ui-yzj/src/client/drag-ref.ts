/**
 * Compact Yunzhijia reference carried by @ chips / context blocks.
 * Kept outside the retired panel surface so input-source / context stay lean.
 */
export interface YzjDragRef {
  kind: 'workspace' | 'doc' | 'group' | 'event' | 'contact' | 'message'
  id: string
  title: string
  url?: string
  sub?: string
  /** Owning session id for message refs (required for re-fetching the body). */
  group?: string
}
