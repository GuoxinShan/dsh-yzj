/**
 * Local-only thread under a group message (只你可见).
 */
import css from './shell.module.css'

export interface LocalThreadView {
  readonly groupId: string
  readonly msgId: string
  readonly assistantId: string
  readonly status: 'idle' | 'processing'
  readonly bubbles: readonly { readonly id: string; readonly role: 'user' | 'assistant'; readonly text: string }[]
}

export function YzjLocalThread(props: {
  thread: LocalThreadView
  onPeek: () => void
}) {
  const { thread } = props
  if (thread.status === 'idle' && thread.bubbles.length === 0) return null
  return (
    <div className={css.thread} data-testid={`yzj-local-thread-${thread.msgId}`}>
      <span className={css.pill}>只你可见</span>
      {thread.status === 'processing' && (
        <div className={css.processing} data-testid="yzj-thread-processing">助手正在处理…</div>
      )}
      {thread.bubbles.filter(b => b.role === 'assistant').map(bubble => (
        <div key={bubble.id} className={css.bubbleAssistant}>{bubble.text}</div>
      ))}
      <button type="button" className={css.processLink} onClick={props.onPeek}>查看过程</button>
    </div>
  )
}
