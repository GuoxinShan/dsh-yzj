/**
 * Pending 「请 AI 验收」 draft (docs/spec/ai-advance-design.md §12.3).
 * Module-level bus — same pattern as advance-feedback.ts / workbench-domain.
 * The draft is written into the topic 问助手 input; we never auto-send.
 */

import { useEffect, useState } from 'react'

/** Prefill for the topic ask bar. */
export interface AdvanceAskDraft {
  readonly advanceId: string
  readonly title: string
  readonly text: string
}

let current: AdvanceAskDraft | null = null
const listeners = new Set<() => void>()

/** Current draft, or null when none. */
export function getAdvanceAskDraft(): AdvanceAskDraft | null {
  return current
}

/** Set or clear the pending ask draft. */
export function setAdvanceAskDraft(next: AdvanceAskDraft | null): void {
  current = next
  for (const listener of listeners) listener()
}

/** Subscribe to draft changes. Returns the disposer. */
export function subscribeAdvanceAskDraft(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** React face for {@link getAdvanceAskDraft}. */
export function useAdvanceAskDraft(): AdvanceAskDraft | null {
  const [draft, setDraft] = useState<AdvanceAskDraft | null>(getAdvanceAskDraft)
  useEffect(() => subscribeAdvanceAskDraft(() => { setDraft(getAdvanceAskDraft()) }), [])
  return draft
}

/** Topic 问助手 prefill for 验收辅助 (spec §12 / PRD §6.3). */
export function reviewAskText(advanceId: string, title: string): string {
  return `请对推进事项 ${advanceId}「${title}」做验收辅助。先调用 yzj_advance_inspect（mode=review，advanceId=${advanceId}），对照成功指标逐条说明是否达标、有无踩红线，给一句话结论。不要 stageTo=completed，也不要替我点确认达到目标；若产物已齐，用 yzj_advance_feed changeType=验收请求 stageTo=ready-for-review（确认卡）；未齐则只 feed 备注说明缺口。`
}
