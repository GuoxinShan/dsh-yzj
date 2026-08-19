/**
 * Pending 「现在反馈」 card (docs/spec/ai-advance-design.md §11.3).
 * Module-level bus — workbench domain switch does not share a React tree
 * with the advance pane, same pattern as workbench-domain.ts.
 */

import { useEffect, useState } from 'react'

/** Compact item card injected into the 对话 timeline. */
export interface AdvanceFeedbackCard {
  readonly advanceId: string
  readonly title: string
  readonly goal: string
  readonly stage: string
}

let current: AdvanceFeedbackCard | null = null
const listeners = new Set<() => void>()

/** Current card, or null when none. */
export function getAdvanceFeedback(): AdvanceFeedbackCard | null {
  return current
}

/** Set or clear the pending feedback card. */
export function setAdvanceFeedback(next: AdvanceFeedbackCard | null): void {
  current = next
  for (const listener of listeners) listener()
}

/** Subscribe to card changes. Returns the disposer. */
export function subscribeAdvanceFeedback(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** React face for {@link getAdvanceFeedback}. */
export function useAdvanceFeedback(): AdvanceFeedbackCard | null {
  const [card, setCard] = useState<AdvanceFeedbackCard | null>(getAdvanceFeedback)
  useEffect(() => subscribeAdvanceFeedback(() => { setCard(getAdvanceFeedback()) }), [])
  return card
}
