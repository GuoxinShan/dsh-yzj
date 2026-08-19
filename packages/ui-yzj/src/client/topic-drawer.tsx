/**
 * Slack-style topic drawer (docs/spec/group-room-topics.md R15/L3/L6/H18).
 * List ⇄ lens stay inside this narrow column; the timeline is never replaced.
 * 「原生会话 ↗」is the only jump to official Chat. Lens bubbles + 「问助手」
 * live here; asking does not focus native Chat.
 */
import { useEffect, useState } from 'react'
import css from './home.module.css'
import { topicNavLabel } from './conv-list.tsx'
import type { ArtifactBadge } from '../artifact-badge.ts'

/** Matches tool-yzj `LEGACY_HOST_ROOT` — not imported (browser-half purity). */
const LEGACY_HOST_ROOT = 'legacy-host'

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

/** One lens bubble from `/yzj home-topic-lens`. */
export interface TopicLensBubble {
  readonly id: string
  readonly role: 'user' | 'assistant'
  readonly text: string
  readonly time: number
  readonly artifacts?: readonly ArtifactBadge[]
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
  homeTopicLens?: (sessionId: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  homeTopicAsk?: (sessionId: string, text: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
}

function clock(ms: number | undefined): string {
  if (ms === undefined || !Number.isFinite(ms) || ms <= 0) return ''
  const date = new Date(ms)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function asArtifacts(value: unknown): ArtifactBadge[] {
  if (!Array.isArray(value)) return []
  const out: ArtifactBadge[] = []
  for (const row of value) {
    if (typeof row !== 'object' || row === null) continue
    const rec = row as Record<string, unknown>
    if (typeof rec.name !== 'string' || rec.name === '') continue
    out.push({
      name: rec.name,
      type: typeof rec.type === 'string' && rec.type !== '' ? rec.type : 'FILE',
    })
  }
  return out
}

function asBubbles(value: unknown): TopicLensBubble[] {
  if (typeof value !== 'object' || value === null) return []
  const raw = (value as { bubbles?: unknown }).bubbles
  if (!Array.isArray(raw)) return []
  const out: TopicLensBubble[] = []
  for (const row of raw) {
    if (typeof row !== 'object' || row === null) continue
    const rec = row as Record<string, unknown>
    if (rec.role !== 'user' && rec.role !== 'assistant') continue
    const artifacts = asArtifacts(rec.artifacts)
    const text = typeof rec.text === 'string' ? rec.text : ''
    if (text === '' && artifacts.length === 0) continue
    out.push({
      id: typeof rec.id === 'string' ? rec.id : `b${out.length}`,
      role: rec.role,
      text,
      time: typeof rec.time === 'number' ? rec.time : 0,
      ...(artifacts.length === 0 ? {} : { artifacts }),
    })
  }
  return out
}

function YzjTopicLens(props: {
  readonly groupName: string
  readonly lens: TopicLensRow | undefined
  readonly lensSessionId: string
  onBack: () => void
  onNative: (sessionId: string) => void
  onClose: () => void
  onJumpOrigin: (msgId: string) => void
  homeTopicLens?: YzjTopicDrawerProps['homeTopicLens']
  homeTopicAsk?: YzjTopicDrawerProps['homeTopicAsk']
}) {
  const [bubbles, setBubbles] = useState<TopicLensBubble[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [asking, setAsking] = useState(false)
  const title = props.lens === undefined
    ? '话题'
    : topicNavLabel(props.groupName, props.lens.title)
  const origin = props.lens?.originText ?? ''
  const who = props.lens?.originWho ?? ''
  const when = clock(props.lens?.originTime)
  const rootMsgId = props.lens?.rootMsgId
  const showAnchor = rootMsgId !== undefined && rootMsgId !== '' && rootMsgId !== LEGACY_HOST_ROOT

  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      if (props.homeTopicLens === undefined) return
      const result = await props.homeTopicLens(props.lensSessionId)
      if (cancelled) return
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      setError('')
      setBubbles(asBubbles(result.value))
    }
    void load()
    const timer = window.setInterval(() => { void load() }, 800)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [props.lensSessionId, props.homeTopicLens])

  const ask = async (): Promise<void> => {
    const text = draft.trim()
    if (text === '' || props.homeTopicAsk === undefined || asking) return
    setAsking(true)
    const result = await props.homeTopicAsk(props.lensSessionId, text)
    setAsking(false)
    if (!result.ok) {
      setError(result.error.message)
      return
    }
    setDraft('')
    setBubbles(prev => [...prev, { id: `local-${Date.now()}`, role: 'user', text, time: Date.now() }])
    if (props.homeTopicLens !== undefined) {
      const lens = await props.homeTopicLens(props.lensSessionId)
      if (lens.ok) setBubbles(asBubbles(lens.value))
    }
  }

  return (
    <aside className={css.topicDrawer} data-testid="yzj-topic-drawer" aria-label="话题">
      <div className={css.topicDrawerHead}>
        <button type="button" className={css.topicDrawerNav} onClick={props.onBack} aria-label="返回话题列表">‹</button>
        <span className={css.topicDrawerTitle}>{title}</span>
        <button
          type="button"
          className={css.topicDrawerNav}
          onClick={() => props.onNative(props.lensSessionId)}
        >
          原生会话 ↗
        </button>
        <button type="button" className={css.topicDrawerNav} onClick={props.onClose} aria-label="关闭话题抽屉">×</button>
      </div>
      {showAnchor && (
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
      <div className={css.topicDrawerBody} data-testid="yzj-topic-lens">
        {error !== '' && <p className={css.topicDrawerHint} role="alert">{error}</p>}
        {bubbles.length === 0 && error === '' && (
          <p className={css.topicDrawerHint}>还没有助手回合。在下面问一句就会出现在这里。</p>
        )}
        {bubbles.map(bubble => (
          <div
            key={bubble.id}
            className={`${css.topicLensRow} ${bubble.role === 'user' ? css.topicLensRowUser : css.topicLensRowAssistant}`}
            data-testid={`yzj-lens-bubble-${bubble.role}`}
          >
            <div className={css.topicLensStack}>
              {bubble.text !== '' && (
                <div className={`${css.topicLensBubble} ${bubble.role === 'user' ? css.topicLensBubbleUser : css.topicLensBubbleAssistant}`}>
                  {bubble.text}
                </div>
              )}
              {bubble.artifacts?.map(card => (
                <span
                  key={card.name}
                  className={css.artifactCard}
                  data-testid={`yzj-lens-artifact-${card.name}`}
                >
                  <span className={css.artifactType}>{card.type}</span>
                  <span className={css.artifactMeta}>
                    <span className={css.artifactName}>{card.name}</span>
                    <span className={css.artifactNote}>本话题产物</span>
                  </span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <form
        className={css.topicDrawerAsk}
        onSubmit={(event) => {
          event.preventDefault()
          void ask()
        }}
      >
        <input
          className={css.topicDrawerInput}
          placeholder="问助手…"
          aria-label="问助手"
          value={draft}
          onChange={event => setDraft(event.target.value)}
          disabled={asking || props.homeTopicAsk === undefined}
        />
        <button type="submit" className={css.topicDrawerSend} disabled={asking || props.homeTopicAsk === undefined}>
          {asking ? '发送中…' : '发送'}
        </button>
      </form>
    </aside>
  )
}

/**
 * Right-hand topic drawer. Empty list still renders so 「话题 0」has a home.
 */
export function YzjTopicDrawer(props: YzjTopicDrawerProps) {
  const lens = props.lensSessionId === undefined
    ? undefined
    : props.topics.find(topic => topic.dshSessionId === props.lensSessionId)

  if (props.lensSessionId !== undefined) {
    return (
      <YzjTopicLens
        groupName={props.groupName}
        lens={lens}
        lensSessionId={props.lensSessionId}
        onBack={props.onBack}
        onNative={props.onNative}
        onClose={props.onClose}
        onJumpOrigin={props.onJumpOrigin}
        {...(props.homeTopicLens === undefined ? {} : { homeTopicLens: props.homeTopicLens })}
        {...(props.homeTopicAsk === undefined ? {} : { homeTopicAsk: props.homeTopicAsk })}
      />
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
        {ordered.length === 0 && <p className={css.topicDrawerHint}>还没有话题</p>}
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
