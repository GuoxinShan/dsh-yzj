/**
 * Composer-side Yunzhijia seat: `conversation.input.dock`.
 * Leftover topic 「回群聊」 lives here. D8 「丢进群」 is retired (决策 55).
 * Drag-to-chip (floating panel era) is retired — @ mention sources stay in input-source.ts.
 */
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { YzjHomeChrome, type YzjHomeChromeInjected } from './home-chrome.tsx'

export type { YzjHomeChromeInjected }

/**
 * The composer dock: topic/unbound chrome only.
 * Group-room 发进群 lives in the timeline column.
 */
export function YzjComposerDock(props: PropsRuntime<'conversation.input.dock'> & YzjHomeChromeInjected) {
  return <YzjHomeChrome {...props} />
}
