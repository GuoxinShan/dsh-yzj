/**
 * Model-facing `present` tool: speak into the current IM projection
 * (assistant DM or a local-only group thread). Never sends to Yunzhijia.
 * @module @dsh-yzj/tool-yzj/present
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { textValue, yzjToolOutput, type YzjToolBudget } from './shared.ts'
import type { YzjAssistantsService } from './assistants.ts'

/** Structural session id on a tool execute exec. */
function callingSessionId(exec: { agent?: { session?: { id?: unknown } } } | undefined): string {
  const id = exec?.agent?.session?.id
  return typeof id === 'string' ? id : ''
}

/** Register `present`. Not a write tool — no confirm card. */
export function applyPresentTool(ctx: Context, budget: YzjToolBudget): void {
  ctx.tools.register(defineTool({
    name: 'present',
    description: 'Speak to the current IM conversation (assistant DM, or the local-only thread under a group message). The user only sees this text plus Yunzhijia write-confirm cards — not tool traces. This does NOT send to Yunzhijia. Call this when you have something to say; yzj_im_message_send is only for posting to a Yunzhijia group in the user\'s name (that still shows a confirm card).',
    parameters: {
      text: {
        type: 'string',
        required: true,
        description: 'User-visible message. Markdown ok; keep it conversational.',
      },
    },
    output: yzjToolOutput,
    timeoutMs: budget.timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const text = typeof args.text === 'string' ? args.text : ''
      const sessionId = callingSessionId(exec as { agent?: { session?: { id?: unknown } } })
      const assistants = ctx.get('yzjAssistants') as YzjAssistantsService | undefined
      if (assistants === undefined || sessionId === '') {
        return { ...textValue('present: no assistant session on this turn.', false), data: { shown: false } }
      }
      const bubble = await assistants.store.present(sessionId, text)
      const shown = bubble !== undefined
      const line = shown
        ? `present: shown in IM (${bubble.role} ${bubble.text.length} chars). The user cannot see other tools.`
        : 'present: this session has no IM turn target; the user did not see this text.'
      return {
        ...textValue(line, false),
        data: {
          shown,
          ...(bubble === undefined ? {} : { bubbleId: bubble.id, at: bubble.at }),
        },
      }
    },
  }))
}
