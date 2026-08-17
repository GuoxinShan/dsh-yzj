/**
 * Slack-style topic drawer (docs/spec/group-room-topics.md R15/L3/L6).
 * List ⇄ lens stay inside this narrow column; the timeline is never replaced.
 * 「原生会话 ↗」is the only jump to official Chat.
 */
import css from './home.module.css'
import { topicNavLabel } from './conv-list.tsx'

/** Topic row the drawer can render (subset of the fused snapshot). */
export interface TopicLensRow {
  readonly dshSessionId: string
  readonly title: string
  readonly source: string
  readonly lastActivity?: number
  readonly rootMsgId?: string
  readonly originWho?: string
  readonly originText?: string
  readonly originTime?: number
}

/** Drawer mode: list of this group's topics, or one topic as an IM lens. */
export interface YzjTopicDrawerProps {
  readonly groupName: string
  readonly topics: readonly TopicLensRow[]
  /** When set, the drawer shows that topic's lens instead of the list. */
  readonly lensSessionId?: string
  onClose: () => void
  onBack: () => void
  onOpenLens: (sessionId: string) => void
  onNative: (sessionId: string) => void
  onJumpOrigin: (msgId: string) => void
}

function clock(ms: number | undefined): string {
  if (ms === undefined || !Number.isFinite(ms) || ms <= 0) return ''
  const date = new Date(ms)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * Right-hand topic drawer. Empty list still renders so 「话题 0」has a home.
 */
export function YzjTopicDrawer(props: YzjTopicDrawerProps) {
  const lens = props.lensSessionId === undefined
    ? undefined
    : props.topics.find(topic => topic.dshSessionId === props.lensSessionId)
  const title = lens === undefined
    ? '话题'
    : topicNavLabel(props.groupName, lens.title)

  if (props.lensSessionId !== undefined) {
    const origin = lens?.originText ?? ''
    const who = lens?.originWho ?? ''
    const when = clock(lens?.originTime)
    const rootMsgId = lens?.rootMsgId
    return (
      <aside className={css.topicDrawer} data-testid="yzj-topic-drawer" aria-label="话题">
        <div className={css.topicDrawerHead}>
          <button type="button" className={css.topicDrawerNav} onClick={props.onBack} aria-label="返回话题列表">‹</button>
          <span className={css.topicDrawerTitle}>{title}</span>
          <button
            type="button"
            className={css.topicDrawerNav}
            onClick={() => props.onNative(props.lensSessionId ?? '')}
          >
            原生会话 ↗
          </button>
          <button type="button" className={css.topicDrawerNav} onClick={props.onClose} aria-label="关闭话题抽屉">×</button>
        </div>
        {rootMsgId !== undefined && rootMsgId !== '' && (
          <button
            type="button"
            className={css.topicAnchorBar}
            data-testid="yzj-drawer-anchor"
            onClick={() => props.onJumpOrigin(rootMsgId)}
          >
            <span>{who === '' ? '群消息锚点' : `${who}${when === '' ? '' : ` · ${when}`}`}</span>
            <span className={css.topicAnchorExcerpt}>{origin === '' ? '点这里定位群消息' : origin}</span>
          </button>
        )}
        <div className={css.topicDrawerBody}>
          <p className={css.topicDrawerHint}>透镜只作对照。问助手、工具卡、确认卡都在原生会话里。</p>
        </div>
        <form
          className={css.topicDrawerAsk}
          onSubmit={(event) => {
            event.preventDefault()
            props.onNative(props.lensSessionId ?? '')
          }}
        >
          <input className={css.topicDrawerInput} placeholder="问助手…" aria-label="问助手" />
          <button type="submit" className={css.topicDrawerSend}>去提问</button>
        </form>
      </aside>
    )
  }

  const ordered = [...props.topics].sort((a, b) => (b.lastActivity ?? 0) - (a.lastActivity ?? 0))
  return (
    <aside className={css.topicDrawer} data-testid="yzj-topic-drawer" aria-label="话题列表">
      <div className={css.topicDrawerHead}>
        <span className={css.topicDrawerTitle}>话题 {props.topics.length}</span>
        <button type="button" className={css.topicDrawerNav} onClick={props.onClose} aria-label="关闭话题抽屉">×</button>
      </div>
      <div className={css.topicDrawerBody}>
        {ordered.length === 0 && <p className={css.topicDrawerHint}>还没有话题。把一条群消息「交给助手」就会出现在这里。</p>}
        {ordered.map((topic) => (
          <button
            key={topic.dshSessionId}
            type="button"
            className={css.topicCard}
            data-testid={`yzj-topic-card-${topic.dshSessionId}`}
            onClick={() => props.onOpenLens(topic.dshSessionId)}
          >
            <span className={css.topicCardTitle}>{topicNavLabel(props.groupName, topic.title)}</span>
            {topic.originText !== undefined && topic.originText !== '' && (
              <span className={css.topicCardOrigin}>{topic.originText}</span>
            )}
          </button>
        ))}
      </div>
    </aside>
  )
}
