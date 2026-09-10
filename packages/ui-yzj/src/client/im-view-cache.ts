/**
 * Warm snapshots for IM center panes that remount when the host swaps
 * conversation.view (消息↔会话) or when the shell used to exclusive-return
 * on selection. Server/RPC remains source of truth; these only paint first.
 */
import type { YzjWriteRecord } from '../write-gate.ts'
import type { RoomReplyTarget } from './reply-bus.ts'
import type { LocalThreadView } from './local-thread.tsx'
import type { AtCandidate } from './im-compose.ts'

export interface AssistantDmSnapshot {
  readonly name: string
  readonly bubbles: readonly { id: string; role: 'user' | 'assistant'; text: string }[]
  readonly processing: boolean
  readonly writes: readonly YzjWriteRecord[]
  readonly draft: string
}

export interface GroupRoomSnapshot {
  readonly draft: string
  readonly replyTo: RoomReplyTarget | null
  readonly threads: readonly LocalThreadView[]
  readonly speakers: readonly AtCandidate[]
}

const assistants = new Map<string, AssistantDmSnapshot>()
const groups = new Map<string, GroupRoomSnapshot>()
/** Fused timeline “加载更早” budget per viewKey. */
const fusedMore = new Map<string, boolean>()

export function getAssistantDmSnapshot(id: string): AssistantDmSnapshot | undefined {
  return assistants.get(id)
}

export function putAssistantDmSnapshot(id: string, next: AssistantDmSnapshot): void {
  if (id === '') return
  assistants.set(id, next)
}

export function getGroupRoomSnapshot(groupId: string): GroupRoomSnapshot | undefined {
  return groups.get(groupId)
}

export function putGroupRoomSnapshot(groupId: string, next: GroupRoomSnapshot): void {
  if (groupId === '') return
  groups.set(groupId, next)
}

export function getFusedMore(viewKey: string): boolean | undefined {
  return fusedMore.get(viewKey)
}

export function putFusedMore(viewKey: string, more: boolean): void {
  if (viewKey === '') return
  fusedMore.set(viewKey, more)
}

/** Test helper. */
export function clearImViewCache(): void {
  assistants.clear()
  groups.clear()
  fusedMore.clear()
}
