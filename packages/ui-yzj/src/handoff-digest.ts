/**
 * D8「丢进群」digest helpers: default is a user-selected visible summary.
 * Full-transcript migrate is explicit. Pure — node RPC and client share it.
 * @module @dsh-yzj/ui-yzj/handoff-digest
 */

/** One checkbox row in the handoff picker. */
export interface DigestCandidate {
  readonly id: string
  readonly role: 'user' | 'assistant'
  readonly text: string
  readonly time: number
}

/** Flatten one session event's text blocks (user/assistant only). */
export function textOfSessionEvent(event: { readonly type: string; readonly data: unknown }): string {
  if (event.type !== 'user/message' && event.type !== 'assistant/message') return ''
  const data = typeof event.data === 'object' && event.data !== null ? event.data as Record<string, unknown> : {}
  const source = typeof data.source === 'object' && data.source !== null ? data.source as Record<string, unknown> : {}
  if (event.type === 'user/message' && source.kind === 'plugin') return ''
  if (typeof data.content === 'string') return data.content.trim()
  if (!Array.isArray(data.content)) return ''
  const parts: string[] = []
  for (const block of data.content) {
    if (typeof block === 'string') {
      if (block.trim() !== '') parts.push(block.trim())
      continue
    }
    if (typeof block !== 'object' || block === null) continue
    const row = block as Record<string, unknown>
    if (typeof row.text === 'string' && row.text.trim() !== '') parts.push(row.text.trim())
  }
  return parts.join('\n').trim()
}

/** Visible private-transcript lines the user can tick (plugin followups omitted). */
export function digestCandidates(
  events: readonly { readonly type: string; readonly time: number; readonly data: unknown }[],
): DigestCandidate[] {
  const out: DigestCandidate[] = []
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index]
    if (event === undefined) continue
    const text = textOfSessionEvent(event)
    if (text === '') continue
    out.push({
      id: `e${index}`,
      role: event.type === 'assistant/message' ? 'assistant' : 'user',
      text,
      time: event.time,
    })
  }
  return out
}

/**
 * Default ticks: the newest few user/assistant lines (visible digest).
 * Never pre-select the whole transcript.
 */
export function defaultSelectedIds(candidates: readonly DigestCandidate[], max = 4): string[] {
  return candidates.slice(-Math.max(0, max)).map(row => row.id)
}

/** Compose the group-visible digest. `migrateFull` is the explicit rare path. */
export function composeHandoffDigest(
  candidates: readonly DigestCandidate[],
  selectedIds: readonly string[],
  migrateFull: boolean,
): string {
  const rows = migrateFull
    ? [...candidates]
    : candidates.filter(row => selectedIds.includes(row.id))
  if (rows.length === 0) return ''
  const lines = rows.map(row => {
    const who = row.role === 'assistant' ? 'Claude' : '用户'
    return `${who}：${row.text}`
  })
  const header = migrateFull
    ? '［私密会话全文迁移（用户显式确认）］'
    : '［私密会话摘要（用户勾选）］'
  return `${header}\n${lines.join('\n\n')}`
}
