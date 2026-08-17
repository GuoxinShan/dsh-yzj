/**
 * Shared light-send helpers for the group-room composer (CLI `im message send`
 * surface). Extracted so panel and room composer do not duplicate @ parsing.
 */

/** Common emojis for the composer picker (body Unicode, not message reactions). */
export const EMOJI_LIST = [
  '😀', '😄', '😂', '🤣', '😊', '😍', '🤔', '😎', '😭', '😅',
  '😉', '🙏', '👍', '👏', '💪', '🔥', '❤️', '🎉', '✅', '❌',
  '⚠️', '📌', '💡', '🚀',
] as const

/** One known speaker the @ resolver can bind to. */
export interface AtCandidate {
  readonly openId: string
  readonly name: string
}

/** Result of mapping `@姓名` fragments onto speaker openIds. */
export type AtResolveResult =
  | { readonly ok: true; readonly atOpenIds: readonly string[]; readonly atAll: boolean }
  | { readonly ok: false; readonly error: string }

/**
 * One `--at-open-id` per `@姓名` fragment, in order. `@all` sets atAll.
 * Unknown names fail closed — the CLI cannot guess members.
 */
export function resolveAtMentions(content: string, candidates: readonly AtCandidate[]): AtResolveResult {
  const atOpenIds: string[] = []
  let atAll = false
  for (const frag of content.match(/@[^@\s，,、]+/g) ?? []) {
    if (frag === '@all') {
      atAll = true
      continue
    }
    const openId = candidates.find(candidate => frag === `@${candidate.name}`)?.openId ?? ''
    if (openId === '') {
      return { ok: false, error: `未找到 ${frag} 的成员（候选来自本群发言者）` }
    }
    atOpenIds.push(openId)
  }
  return { ok: true, atOpenIds, atAll }
}
