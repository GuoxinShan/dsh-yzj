/**
 * Open an assistant's real hidden session on the 会话 surface.
 * Replaces the retired IM 「查看过程」digest page (I5 / I16).
 */
import { setImSurface } from './im-nav.ts'
import type { YzjPanelInject } from './rpc.ts'

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

/**
 * Resolve `assistantId` → hidden `sessionId`, switch to 会话, and focus that
 * session so the official Chat / 轨迹 canvas shows tool process.
 */
export async function openAssistantSession(
  panel: Pick<YzjPanelInject, 'assistantProjection' | 'focusBoundSession'>,
  assistantId: string,
): Promise<boolean> {
  const result = await panel.assistantProjection?.({ assistantId })
  if (result === undefined || !result.ok) return false
  const assistant = asRecord(asRecord(result.value).assistant)
  const sessionId = typeof assistant.sessionId === 'string' ? assistant.sessionId : ''
  if (sessionId === '') return false
  setImSurface('session')
  panel.focusBoundSession?.(sessionId)
  return true
}
