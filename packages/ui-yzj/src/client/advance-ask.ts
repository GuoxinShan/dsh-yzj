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
  /** Which flow produced the draft — drives the banner copy (验收 vs 复盘 vs 事元讨论)。 */
  readonly kind: 'review' | 'export' | 'discuss'
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

/** Entry-level 「问助手」prefill (决策 41): discuss one timeline 事元 with the agent, in the bound home session。 */
export function discussAskText(advanceId: string, title: string, at: string, summary: string): string {
  return `关于推进事项 ${advanceId}「${title}」${at} 的这条进展：「${summary}」。先 yzj_advance_get（advanceId=${advanceId}）看上下文，然后我想讨论：`
}

/** Decision-card 「回到对话继续聊」prefill (决策 41): 卡上的选项/动作拿不准时，先回对话讨论;agent 聊出新建议后按纪律补/更新决策请求,用户再回看板拍板。 */
export function decisionChatText(advanceId: string, title: string, summary: string): string {
  return `关于推进事项 ${advanceId}「${title}」待我决定的问题：「${summary}」。先 yzj_advance_get（advanceId=${advanceId}）看上下文。我还想聊聊再定；如果聊出更合适的建议，按纪律补/更新决策请求（选项/动作行），我回到看板拍板。我的想法：`
}

/** Topic 问助手 prefill for 终局复盘沉淀 (spec §16, 决策 26: 复盘=终局收口). */
export function exportReviewAskText(advanceId: string, title: string): string {
  return `请对推进事项 ${advanceId}「${title}」做终局复盘沉淀:先用 yzj_advance_get 翻页读全量事元,再按复盘模板(docs/spec/advance-review-template.md:目标演化/关键决策/偏差与证据链/下一步/事元全量索引)写出复盘 markdown,然后用 yzj_doc_import 入「我的知识/推进复盘/${title}」(父目录不存在就先 doc create 依次建「推进复盘」与事项目录),最后回链 yzj_advance_feed 一条产物事元(refs=[入库 docId],纯追加静默)。入库的确认卡我来点。`
}
