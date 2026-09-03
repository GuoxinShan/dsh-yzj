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

/** One predefined assistant the group composer can @. */
export interface AssistantAtCandidate {
  readonly id: string
  readonly name: string
}

/** Result of intercepting an @助手 send so it never hits Yunzhijia. */
export type AssistantAtIntercept =
  | { readonly kind: 'none' }
  | { readonly kind: 'empty' }
  | { readonly kind: 'need-anchor'; readonly assistantId: string }
  | { readonly kind: 'ask'; readonly assistantId: string; readonly text: string }

const AT_TOKEN = /@([^\s@，,、]+)/g

/**
 * First @ token that matches an assistant name (exact). Assistants are
 * tried before people; empty composer `@助手` is `empty` (must not post).
 */
export function interceptAssistantAt(
  content: string,
  assistants: readonly AssistantAtCandidate[],
  hasReplyTarget: boolean,
): AssistantAtIntercept {
  const trimmed = content.trim()
  if (trimmed === '') return { kind: 'none' }
  const tokens = [...trimmed.matchAll(AT_TOKEN)].map(match => match[1] ?? '')
  if (tokens.length === 0) return { kind: 'none' }
  let assistantId: string | undefined
  for (const token of tokens) {
    const hit = assistants.find(row => row.name === token || (token === '助手' && row.id === 'default'))
    if (hit !== undefined) {
      assistantId = hit.id
      break
    }
  }
  if (assistantId === undefined) return { kind: 'none' }
  const without = trimmed.replace(AT_TOKEN, (whole, name: string) => {
    const hit = assistants.find(row => row.name === name || (name === '助手' && row.id === 'default'))
    return hit !== undefined ? '' : whole
  }).trim()
  if (without === '' && tokens.every(token => assistants.some(row => row.name === token || (token === '助手' && row.id === 'default')))) {
    return { kind: 'empty' }
  }
  if (!hasReplyTarget) return { kind: 'need-anchor', assistantId }
  return { kind: 'ask', assistantId, text: without === '' ? '请看这条消息' : without }
}
