/**
 * Card / write-card jump targets: open the IM shell on a people room.
 * Legacy calendar/docs panel jumps are retired (I8) — no-op for those kinds.
 */
import type { YzjJumpTarget } from './cards.tsx'
import { rememberImSeat } from './im-seat.ts'
import { setImSelection } from './im-nav.ts'

/**
 * Focus the IM shell on one item (card 查看详情 / write-card 查看上下文).
 * Only group targets have a surface; docs/calendar stay tool-card only.
 */
export function openPanelTarget(target: YzjJumpTarget, _anchorMsgId?: string): void {
  if (target.kind !== 'group') return
  setImSelection({ kind: 'group', groupId: target.groupId })
  rememberImSeat({ groupId: target.groupId, sessionId: '' })
}
