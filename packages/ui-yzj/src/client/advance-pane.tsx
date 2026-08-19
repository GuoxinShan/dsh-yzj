/**
 * The 推进 tab: the AI推进 board (docs/spec/ai-advance-design.md §7),
 * information architecture replicated from the lgap17 prototype — left
 * "我的推进" queue (待我决定 / 待我验收 / 我关注的推进 with count badges),
 * main detail (kicker + metric cards + goal + stage-aware decision area +
 * 推进时间旅程 with three-tone marks and source jumps), right column
 * (信息来源 + 已有产物). Panel judge verbs and the start modal are
 * user-direct writes (D9: no confirmation card); agent writes go through
 * yzj_advance_create/feed with the standard card. Data arrives through the
 * /yzj RPC face only.
 */
import { useEffect, useMemo, useState } from 'react'
import type { YzjPanelInject } from './rpc.ts'
import { setWorkbenchDomain } from './workbench-domain.ts'
import { setAdvanceFeedback } from './advance-feedback.ts'
import { setAdvanceAskDraft, reviewAskText, exportReviewAskText, patrolAskText } from './advance-ask.ts'
import css from './advance-pane.module.css'

type UnknownRecord = Record<string, unknown>

function asRecord(value: unknown): UnknownRecord {
  return typeof value === 'object' && value !== null ? value as UnknownRecord : {}
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

/** Chinese stage labels (seven-stage machine, v1.6 +cancelled). */
export const STAGE_LABEL: Record<string, string> = {
  'draft': '草稿',
  'running': '推进中',
  'decision-needed': '待你决定',
  'updated': '已按方案更新',
  'ready-for-review': '待你验收',
  'completed': '已完成',
  'cancelled': '已中止',
}

/** Queue grouping of the board items (spec §7 / PRD §5.3.2); terminals land in closed (「已结束」折叠区). */
export function queuesOf(items: readonly UnknownRecord[]): { decide: UnknownRecord[]; review: UnknownRecord[]; watch: UnknownRecord[]; closed: UnknownRecord[] } {
  const isTerminal = (stage: string): boolean => stage === 'completed' || stage === 'cancelled'
  const decide = items.filter(item => asString(item.stage) === 'decision-needed')
  const review = items.filter(item => asString(item.stage) === 'ready-for-review')
  const watch = items.filter(item => asString(item.stage) !== 'decision-needed' && asString(item.stage) !== 'ready-for-review' && !isTerminal(asString(item.stage)))
  const closed = items.filter(item => isTerminal(asString(item.stage)))
  return { decide, review, watch, closed }
}

/** Ref kind inferred from the entry's sourceType (refs carry bare ids). */
function refKindOf(sourceType: string): 'doc' | 'msg' | 'todo' | 'event' | 'other' {
  if (sourceType === '文档' || sourceType === '会议') return 'doc'
  if (sourceType === '对话') return 'msg'
  if (sourceType === '待办') return 'todo'
  if (sourceType === '日程') return 'event'
  return 'other'
}

/** Strip the literal `yzj:` prefix models sometimes add per the tool description (yzj:{json} chip encoding never lands on entry refs). */
function stripRefPrefix(raw: string): string {
  return raw.startsWith('yzj:') && !raw.startsWith('yzj:{') ? raw.slice(4) : raw
}

const REF_ICON: Record<string, string> = { doc: '文', msg: '聊', todo: '待', event: '程', other: '源' }

/** Doc deep link(知识库 web);其他类型跳域(无消息级锚点,spec 决策 8 诚实降级)。 */
function refHref(kind: string, id: string): string | null {
  if (kind === 'doc' && id !== '') return `https://www.yunzhijia.com/knowledge/lingee/#/store/doc/${id}`
  return null
}

/** Queue dot tone per stage (prototype: 红=待决定 蓝=推进 绿=完成 灰=草稿/中止). */
function dotToneOf(stage: string): 'red' | 'blue' | 'green' | 'gray' {
  if (stage === 'decision-needed') return 'red'
  if (stage === 'completed') return 'green'
  if (stage === 'draft' || stage === 'cancelled') return 'gray'
  return 'blue'
}

/** Single-character source icon (信息来源面板). */
const SOURCE_ICON: Record<string, string> = {
  '对话': '聊', '待办': '待', '文档': '文', '会议': '会', '日程': '日', '数据': '数', '人工': '人',
}

/** Single-character icon per thread token prefix (订阅渠道 chip). */
const THREAD_ICON: Record<string, string> = {
  im: '群', doc: '文', todo: '待', event: '日', file: '附',
}

function threadIconOf(token: string): string {
  const prefix = token.split(':')[0] ?? ''
  return THREAD_ICON[prefix] ?? '源'
}

/** Workbench domain a source type jumps to (可跳则跳，不可跳则只标注). */
function sourceJumpDomain(sourceType: string): 'im' | 'todo' | 'docs' | 'calendar' | null {
  if (sourceType === '对话') return 'im'
  if (sourceType === '待办') return 'todo'
  if (sourceType === '文档' || sourceType === '会议') return 'docs'
  if (sourceType === '日程') return 'calendar'
  return null
}

/** Props: the RPC verbs the board needs (subset of the panel inject). */
export interface AdvancePaneProps {
  inject: Pick<YzjPanelInject, 'advanceState' | 'advanceGet' | 'advanceCreate' | 'advanceJudge' | 'advanceEnsure' | 'advanceScanState' | 'advanceThreadAdd' | 'advanceThreadRemove' | 'fetchGroups'>
}

/** Queue-head patrol line (spec §14.5). */
export function formatScanStatus(scannedAt: number | null, found: number): string {
  if (scannedAt === null) return '尚未巡检'
  const date = new Date(scannedAt)
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `上次巡检 ${hh}:${mm} · 本轮发现 ${found} 条`
}

/**
 * Parse one decision-request 事元 detail into selectable options (spec §15.4
 * / 决策 23): `选项N: …` lines become buttons, the `影响: …` line is shown
 * separately, the remaining lines stay as plain detail. No `选项N` line →
 * options empty (the classic two verbs render unchanged).
 */
export function parseDecisionOptions(detail: string): { options: string[]; impact: string; rest: string } {
  const options: string[] = []
  let impact = ''
  const rest: string[] = []
  for (const line of detail.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '') continue
    const option = trimmed.match(/^选项\d+[:：]\s*(.+)$/)
    if (option !== null) {
      options.push((option[1] ?? '').trim())
      continue
    }
    const impactMatch = trimmed.match(/^影响[:：]\s*(.+)$/)
    if (impactMatch !== null) {
      impact = (impactMatch[1] ?? '').trim()
      continue
    }
    rest.push(trimmed)
  }
  return { options, impact, rest: rest.join('\n') }
}

interface BoardState {
  loading: boolean
  ready: boolean
  items: UnknownRecord[]
  libraryLink: string
  error: string
}

interface DetailState {
  item: UnknownRecord
  entries: UnknownRecord[]
  entryTotal: number
  sources: UnknownRecord[]
  threads: UnknownRecord[]
}

export function YzjAdvancePane(props: AdvancePaneProps) {
  const [board, setBoard] = useState<BoardState>({ loading: true, ready: false, items: [], libraryLink: '', error: '' })
  const [activeId, setActiveId] = useState('')
  const [detail, setDetail] = useState<DetailState | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [busy, setBusy] = useState(false)
  const [startOpen, setStartOpen] = useState(false)
  /** Two-tap confirm for the terminal 中止推进 verb (cancelled is a 终局, 决策 27). */
  const [cancelArmed, setCancelArmed] = useState(false)
  /** 「已结束」折叠区(completed/cancelled 事项,终局提示事后可达)。 */
  const [showClosed, setShowClosed] = useState(false)
  const [draft, setDraft] = useState({ title: '', goal: '', metrics: '', assignee: '', targetDate: '', background: '' })
  const [error, setError] = useState('')
  const [scanLine, setScanLine] = useState('尚未巡检')
  const [threadModalOpen, setThreadModalOpen] = useState(false)
  const [threadToken, setThreadToken] = useState('')
  const [groupOptions, setGroupOptions] = useState<UnknownRecord[]>([])

  const loadScan = async (): Promise<void> => {
    const result = await props.inject.advanceScanState()
    if (!result.ok) return
    const value = asRecord(result.value)
    const scannedAt = typeof value.scannedAt === 'number' ? value.scannedAt : null
    const found = typeof value.found === 'number' ? value.found : 0
    setScanLine(formatScanStatus(scannedAt, found))
  }

  const loadBoard = async (): Promise<UnknownRecord[]> => {
    const result = await props.inject.advanceState()
    if (!result.ok) {
      setBoard({ loading: false, ready: false, items: [], libraryLink: '', error: result.error.message })
      return []
    }
    const value = asRecord(result.value)
    const items = asArray(value.items).map(asRecord)
    setBoard({
      loading: false,
      ready: value.ready === true,
      items,
      libraryLink: asString(asRecord(value.library).link),
      error: asString(value.error),
    })
    return items
  }

  useEffect(() => {
    let live = true
    void (async () => {
      const items = await loadBoard()
      await loadScan()
      if (!live || items.length === 0) return
      const { decide, review, watch } = queuesOf(items)
      const first = decide[0] ?? review[0] ?? watch[0]
      if (first !== undefined) setActiveId(asString(first.advanceId))
    })()
    return () => { live = false }
    // Load once per mount; refreshes happen after writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (activeId === '') {
      setDetail(null)
      return
    }
    let live = true
    setDetailLoading(true)
    setThreadModalOpen(false)
    setThreadToken('')
    void props.inject.advanceGet(activeId, showAll ? 0 : undefined, showAll ? 200 : undefined).then((result) => {
      if (!live) return
      setDetailLoading(false)
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      const value = asRecord(result.value)
      setDetail({
        item: asRecord(value.item),
        entries: asArray(value.entries).map(asRecord),
        entryTotal: typeof value.entryTotal === 'number' ? value.entryTotal : 0,
        sources: asArray(value.sources).map(asRecord),
        threads: asArray(value.threads).map(asRecord),
      })
    })
    return () => { live = false }
    // The inject face is a stable RPC closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, showAll])

  const queues = useMemo(() => queuesOf(board.items), [board.items])

  const judge = async (action: 'confirm_condition' | 'confirm_advance' | 'accept' | 'reject' | 'ignore' | 'cancel', note?: string): Promise<void> => {
    if (busy || activeId === '') return
    setBusy(true)
    setError('')
    const result = await props.inject.advanceJudge(activeId, action, note)
    setBusy(false)
    if (!result.ok) {
      setError(result.error.message)
      return
    }
    await loadBoard()
    setShowAll(false)
    // Re-pull the detail (the judge landed one user 事元).
    const detailResult = await props.inject.advanceGet(activeId)
    if (detailResult.ok) {
      const value = asRecord(detailResult.value)
      setDetail({
        item: asRecord(value.item),
        entries: asArray(value.entries).map(asRecord),
        entryTotal: typeof value.entryTotal === 'number' ? value.entryTotal : 0,
        sources: asArray(value.sources).map(asRecord),
        threads: asArray(value.threads).map(asRecord),
      })
    }
  }

  /** Re-pull the detail only (thread add/remove landed registry/entry rows). */
  const refreshDetail = async (): Promise<void> => {
    if (activeId === '') return
    const result = await props.inject.advanceGet(activeId)
    if (!result.ok) {
      setError(result.error.message)
      return
    }
    const value = asRecord(result.value)
    setDetail({
      item: asRecord(value.item),
      entries: asArray(value.entries).map(asRecord),
      entryTotal: typeof value.entryTotal === 'number' ? value.entryTotal : 0,
      sources: asArray(value.sources).map(asRecord),
      threads: asArray(value.threads).map(asRecord),
    })
  }

  const openThreadModal = async (): Promise<void> => {
    setThreadModalOpen(true)
    const result = await props.inject.fetchGroups()
    if (!result.ok) return
    const value = asRecord(result.value)
    const rows = asArray(value.list).length > 0 ? asArray(value.list) : asArray(result.value)
    setGroupOptions(rows.map(asRecord).filter(row => asString(row.groupId) !== ''))
  }

  const addThread = async (token: string, label?: string): Promise<void> => {
    if (busy || activeId === '') return
    setBusy(true)
    setError('')
    const result = await props.inject.advanceThreadAdd(activeId, token, label)
    setBusy(false)
    if (!result.ok) {
      setError(result.error.message)
      return
    }
    setThreadModalOpen(false)
    setThreadToken('')
    await refreshDetail()
  }

  const removeThread = async (token: string): Promise<void> => {
    if (busy || activeId === '') return
    setBusy(true)
    setError('')
    const result = await props.inject.advanceThreadRemove(activeId, token)
    setBusy(false)
    if (!result.ok) {
      setError(result.error.message)
      return
    }
    await refreshDetail()
  }

  const create = async (): Promise<void> => {
    if (busy || draft.title.trim() === '') return
    setBusy(true)
    setError('')
    const result = await props.inject.advanceCreate({
      title: draft.title.trim(),
      goal: draft.goal.trim(),
      background: draft.background.trim(),
      metrics: draft.metrics.trim(),
      assignee: draft.assignee.trim(),
      targetDate: draft.targetDate.trim(),
    })
    setBusy(false)
    if (!result.ok) {
      setError(result.error.message)
      return
    }
    setStartOpen(false)
    setDraft({ title: '', goal: '', metrics: '', assignee: '', targetDate: '', background: '' })
    await loadBoard()
    setActiveId(asString(asRecord(result.value).advanceId))
  }

  const ensure = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    setError('')
    const result = await props.inject.advanceEnsure()
    setBusy(false)
    if (!result.ok) {
      setError(result.error.message)
      return
    }
    await loadBoard()
  }

  const queueGroup = (key: string, label: string, rows: UnknownRecord[], emptyTitle: string, emptySub: string) => (
    <div className={css.queueGroup} data-testid={`yzj-advance-queue-${key}`}>
      <div className={css.queueLabel}>
        <span>{label}</span>
        <span className={css.queueCount}>{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <div className={css.queueEmpty}>
          <b>{emptyTitle}</b>
          <p>{emptySub}</p>
        </div>
      ) : rows.map((item) => {
        const id = asString(item.advanceId)
        const tone = dotToneOf(asString(item.stage))
        return (
          <button
            key={id}
            type="button"
            className={activeId === id ? `${css.queueItem} ${css.queueItemOn}` : css.queueItem}
            data-testid={`yzj-advance-item-${id}`}
            onClick={() => { setShowAll(false); setActiveId(id) }}
          >
            <span className={css.queueTitle}>
              <i className={`${css.dot} ${css[`dot_${tone}`]}`} />
              <b>{asString(item.title) === '' ? '(无标题)' : asString(item.title)}</b>
            </span>
            <p>{asString(item.latest) === '' ? STAGE_LABEL[asString(item.stage)] ?? asString(item.stage) : asString(item.latest)}</p>
          </button>
        )
      })}
    </div>
  )

  // --- empty states -------------------------------------------------------

  if (!board.loading && !board.ready) {
    return (
      <div className={css.body} data-testid="yzj-advance-pane">
        <div className={css.hero}>
          <h2>推进看板还没有开通</h2>
          <p>发起第一个推进事项时会在当前任务库自动开通「事项 / 事元」双表；也可以现在一键开通。</p>
          <button type="button" className={css.primary} data-testid="yzj-advance-ensure" disabled={busy} onClick={() => { void ensure() }}>
            {busy ? '开通中…' : '一键开通'}
          </button>
          {(error !== '' || board.error !== '') && <div className={css.error}>{error || board.error}</div>}
        </div>
      </div>
    )
  }

  const stage = detail === null ? '' : asString(detail.item.stage)
  const metrics = detail === null ? [] : asArray(detail.item.metrics).map(asRecord)
  const latestDecision = detail === null
    ? undefined
    : [...detail.entries].reverse().find(entry => asString(entry.changeType) === '决策请求')
  const decisionParsed = latestDecision === undefined
    ? undefined
    : parseDecisionOptions(asString(latestDecision.detail))

  return (
    <div className={css.body} data-testid="yzj-advance-pane">
      <aside className={css.queue} data-testid="yzj-advance-queue">
        <div className={css.queueHead}>
          <b>我的推进</b>
          <span data-testid="yzj-advance-scan-status">{scanLine}</span>
          <button
            type="button"
            className={css.patrolBtn}
            data-testid="yzj-advance-patrol-now"
            title="立即巡检一轮订阅渠道"
            onClick={() => {
              setAdvanceAskDraft({ advanceId: '', title: '全部订阅渠道', text: patrolAskText(), kind: 'patrol' })
              setWorkbenchDomain('im')
            }}
          >
            巡检
          </button>
        </div>
        {queueGroup('decide', '待我决定', queues.decide, '当前没有待决定事项', 'AI 会在需要你的权限时再提醒')}
        {queueGroup('review', '待我验收', queues.review, '暂无待验收结果', '只有业务标准满足后才进入这里')}
        {queueGroup('watch', '我关注的推进', queues.watch, '还没有推进事项', '先从真实工作目标开始')}
        {queues.closed.length > 0 && (
          <div className={css.closedZone}>
            <button
              type="button"
              className={css.closedToggle}
              data-testid="yzj-advance-closed-toggle"
              onClick={() => { setShowClosed(!showClosed) }}
            >
              {showClosed ? '▾' : '▸'} 已结束 {queues.closed.length}
            </button>
            {showClosed && queues.closed.map((item) => {
              const id = asString(item.advanceId)
              return (
                <button
                  key={id}
                  type="button"
                  className={activeId === id ? `${css.queueItem} ${css.queueItemOn}` : css.queueItem}
                  data-testid={`yzj-advance-item-${id}`}
                  onClick={() => { setShowAll(false); setActiveId(id) }}
                >
                  <span className={css.queueTitle}>
                    <i className={`${css.dot} ${css[`dot_${dotToneOf(asString(item.stage))}`]}`} />
                    <b>{asString(item.title) === '' ? '(无标题)' : asString(item.title)}</b>
                  </span>
                  <p>{STAGE_LABEL[asString(item.stage)] ?? asString(item.stage)}{asString(item.latest) === '' ? '' : ` · ${asString(item.latest)}`}</p>
                </button>
              )
            })}
          </div>
        )}
        <button type="button" className={css.primary} data-testid="yzj-advance-start" onClick={() => { setStartOpen(true) }}>
          发起推进
        </button>
      </aside>

      <main className={css.detail} data-testid="yzj-advance-detail">
        {board.loading || detailLoading ? (
          <div className={css.hint}>加载中…</div>
        ) : detail === null ? (
          <div className={css.hero}>
            <h2>这件事还没有开始推进</h2>
            <p>发起后，AI 会持续跟进目标、工作进展、变化和结果；遇到影响较大的问题时再请你决定。</p>
            <button type="button" className={css.primary} data-testid="yzj-advance-start-hero" onClick={() => { setStartOpen(true) }}>
              发起推进
            </button>
          </div>
        ) : (
          <>
            <header className={css.detailHead}>
              <div className={css.kicker}>
                <span>{asString(detail.item.advanceId)}</span>
                <span className={`${css.stagePill} ${css[`pill_${dotToneOf(stage)}`]}`} data-testid="yzj-advance-stage">
                  {STAGE_LABEL[stage] ?? stage}
                </span>
                <div className={css.kickerActions}>
                  <button
                    type="button"
                    className={css.feedbackBtn}
                    data-testid="yzj-advance-feedback"
                    onClick={() => {
                      setAdvanceFeedback({
                        advanceId: asString(detail.item.advanceId),
                        title: asString(detail.item.title),
                        goal: asString(detail.item.goal),
                        stage,
                      })
                      setWorkbenchDomain('im')
                    }}
                  >
                    现在反馈
                  </button>
                  <button
                    type="button"
                    className={css.feedbackBtn}
                    data-testid="yzj-advance-review"
                    onClick={() => {
                      const advanceId = asString(detail.item.advanceId)
                      const title = asString(detail.item.title)
                      setAdvanceAskDraft({
                        advanceId,
                        title,
                        text: reviewAskText(advanceId, title),
                        kind: 'review',
                      })
                      setWorkbenchDomain('im')
                    }}
                  >
                    请 AI 验收
                  </button>
                </div>
              </div>
              <h1>{asString(detail.item.title)}</h1>
              <div className={css.meta}>
                {asString(detail.item.assignee) !== '' && <span>结果承担者：{asString(detail.item.assignee)}</span>}
                {asString(detail.item.targetDate) !== '' && <span>目标日期：{asString(detail.item.targetDate)}</span>}
                {board.libraryLink !== '' && <a href={board.libraryLink} target="_blank" rel="noreferrer">推进库 ↗</a>}
              </div>
            </header>

            {metrics.length > 0 && (
              <div className={css.metrics} data-testid="yzj-advance-metrics">
                {metrics.map((metric, index) => (
                  <div key={`m${index}`} className={css.metric}>
                    <span>{asString(metric.name)}</span>
                    <b>{asString(metric.current) === '' ? '—' : asString(metric.current)}</b>
                    {asString(metric.target) !== '' && <small>目标 {asString(metric.target)}</small>}
                  </div>
                ))}
              </div>
            )}

            <div className={css.detailGrid}>
              <div className={css.main}>
                <section className={css.section}>
                  <div className={css.sectionHead}>
                    <h2>这件事要做到什么</h2>
                    <small>当前有效目标</small>
                  </div>
                  <p className={css.goal}>{asString(detail.item.goal) === '' ? '（尚未填写目标）' : asString(detail.item.goal)}</p>
                  {asString(detail.item.background) !== '' && <p className={css.background}>背景：{asString(detail.item.background)}</p>}
                </section>

                <section className={css.section} data-testid="yzj-advance-decision">
                  <div className={css.sectionHead}>
                    <h2>{stage === 'decision-needed' ? '需要你决定' : stage === 'ready-for-review' ? '是否已经达到目标' : '接下来会怎样'}</h2>
                    <small>{stage === 'decision-needed' || stage === 'ready-for-review' ? '等待你处理' : 'AI 持续跟进'}</small>
                  </div>
                  {stage === 'decision-needed' && (
                    <div className={css.decision}>
                      {latestDecision !== undefined && decisionParsed !== undefined && (
                        <>
                          <h3>{asString(latestDecision.summary)}</h3>
                          {decisionParsed.options.length > 0 && (
                            <div className={css.options} data-testid="yzj-advance-options">
                              {decisionParsed.options.map((option, index) => (
                                <button
                                  key={`o${index}`}
                                  type="button"
                                  className={css.optionBtn}
                                  data-testid={`yzj-advance-option-${index + 1}`}
                                  disabled={busy}
                                  onClick={() => { void judge('confirm_advance', option) }}
                                >
                                  选项{index + 1}：{option}
                                </button>
                              ))}
                            </div>
                          )}
                          {decisionParsed.impact !== '' && <p className={css.impact}>影响：{decisionParsed.impact}</p>}
                          {decisionParsed.rest !== '' && <p>{decisionParsed.rest}</p>}
                        </>
                      )}
                      <div className={css.verbs}>
                        <button type="button" data-testid="yzj-advance-judge-confirm_condition" disabled={busy} onClick={() => { void judge('confirm_condition') }}>确认新条件</button>
                        <button type="button" className={css.primary} data-testid="yzj-advance-judge-confirm_advance" disabled={busy} onClick={() => { void judge('confirm_advance') }}>确认推进</button>
                        <button type="button" data-testid="yzj-advance-judge-ignore" disabled={busy} onClick={() => { void judge('ignore') }}>忽略</button>
                      </div>
                    </div>
                  )}
                  {stage === 'ready-for-review' && (
                    <div className={css.decision}>
                      <p>新的结果已经准备好，等待你确认。</p>
                      <div className={css.verbs}>
                        <button type="button" data-testid="yzj-advance-judge-reject" disabled={busy} onClick={() => { void judge('reject') }}>退回补充</button>
                        <button type="button" className={css.primary} data-testid="yzj-advance-judge-accept" disabled={busy} onClick={() => { void judge('accept') }}>确认达到目标</button>
                      </div>
                    </div>
                  )}
                  {(stage === 'running' || stage === 'updated' || stage === 'draft') && (
                    <p className={css.quiet}>AI 正在跟进，当前不需要你处理；有目标变化或材料不足时会再提醒。</p>
                  )}
                  {(stage === 'completed' || stage === 'cancelled') && (
                    <div className={css.decision} data-testid="yzj-advance-terminal">
                      <p className={css.quiet}>
                        {stage === 'completed'
                          ? '这次推进已经完成。'
                          : '这次推进已中止。'}
                        复盘可以沉淀回知识库：目标演化、关键决策、偏差与证据链。
                      </p>
                      <div className={css.verbs}>
                        <button
                          type="button"
                          data-testid="yzj-advance-export-review"
                          disabled={busy}
                          onClick={() => {
                            const advanceId = asString(detail.item.advanceId)
                            const title = asString(detail.item.title)
                            setAdvanceAskDraft({ advanceId, title, text: exportReviewAskText(advanceId, title), kind: 'export' })
                            setWorkbenchDomain('im')
                          }}
                        >
                          沉淀复盘
                        </button>
                      </div>
                    </div>
                  )}
                  {stage !== 'completed' && stage !== 'cancelled' && (
                    <div className={css.verbs}>
                      <button
                        type="button"
                        data-testid="yzj-advance-judge-cancel"
                        disabled={busy}
                        onClick={() => {
                          if (!cancelArmed) {
                            setCancelArmed(true)
                            return
                          }
                          setCancelArmed(false)
                          void judge('cancel')
                        }}
                      >
                        {cancelArmed ? '确认中止？再点一次' : '中止推进'}
                      </button>
                    </div>
                  )}
                </section>

                <section className={css.section} data-testid="yzj-advance-timeline">
                  <div className={css.sectionHead}>
                    <h2>已经推进到这里</h2>
                    <small>来自对话、待办、文档、会议、日程与业务数据</small>
                  </div>
                  {detail.entries.length === 0 ? (
                    <p className={css.quiet}>还没有事元记录。</p>
                  ) : (
                    <div className={css.timeline}>
                      {detail.entries.map((entry, index) => {
                        const jumpDomain = sourceJumpDomain(asString(entry.sourceType))
                        return (
                          <div key={asString(entry.entryId) || `e${index}`} className={css.timeItem}>
                            <span className={css.time}>{asString(entry.at)}</span>
                            <i className={`${css.mark} ${css[`mark_${asString(entry.tone) || 'blue'}`]}`} />
                            <div className={css.timeCopy}>
                              <b>{asString(entry.summary)}</b>
                              {asString(entry.detail) !== '' && <p>{asString(entry.detail)}</p>}
                              <div className={css.timeMeta}>
                                <span>{asString(entry.sourceType)}{asString(entry.actor) === 'user' ? ' · 你的判断' : ''}</span>
                                {asArray(entry.refs).length > 0 && (
                                  <span className={css.refs}>
                                    {[...new Set(asArray(entry.refs).map(ref => asString(ref)).filter(ref => ref !== ''))].map((raw) => {
                                      const id = stripRefPrefix(raw)
                                      const kind = refKindOf(asString(entry.sourceType))
                                      const href = refHref(kind, id)
                                      const short = id.length > 12 ? `${id.slice(0, 8)}…` : id
                                      const label = `${REF_ICON[kind] ?? '源'} ${short}`
                                      if (href !== null) {
                                        return <a key={raw} className={css.refChip} href={href} target="_blank" rel="noreferrer" title={raw} data-testid={`yzj-advance-ref-${id}`}>{label}</a>
                                      }
                                      const domain = kind === 'msg' ? 'im' : kind === 'todo' ? 'todo' : kind === 'event' ? 'calendar' : null
                                      if (domain !== null) {
                                        return <button key={raw} type="button" className={css.refChip} title={raw} data-testid={`yzj-advance-ref-${id}`} onClick={() => { setWorkbenchDomain(domain) }}>{label}</button>
                                      }
                                      return <span key={raw} className={css.refChip} title={raw}>{label}</span>
                                    })}
                                  </span>
                                )}
                                {jumpDomain !== null && (
                                  <button type="button" className={css.jump} onClick={() => { setWorkbenchDomain(jumpDomain) }}>
                                    查看{asString(entry.sourceType)}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {!showAll && detail.entryTotal > detail.entries.length && (
                    <button type="button" className={css.more} data-testid="yzj-advance-show-all" onClick={() => { setShowAll(true) }}>
                      查看全部 {detail.entryTotal} 条
                    </button>
                  )}
                </section>
              </div>

              <aside className={css.side} data-testid="yzj-advance-sources">
                <section className={css.section}>
                  <div className={css.sectionHead}>
                    <h2>订阅渠道</h2>
                    <button type="button" className={css.linkBtn} data-testid="yzj-advance-thread-add-open" disabled={busy} onClick={() => { void openThreadModal() }}>关联渠道</button>
                  </div>
                  {detail.threads.length === 0 ? (
                    <p className={css.quiet}>尚未订阅线程；关联群后巡检会按订阅取流。</p>
                  ) : (
                    <div className={css.threads} data-testid="yzj-advance-threads">
                      {detail.threads.map((thread, index) => {
                        const token = asString(thread.token)
                        return (
                          <span key={token === '' ? `t${index}` : token} className={css.threadChip} data-testid={`yzj-advance-thread-${index}`}>
                            <i className={css.threadIcon}>{threadIconOf(token)}</i>
                            <b>{asString(thread.label) === '' ? token : asString(thread.label)}</b>
                            <em>{asString(thread.addedBy) === 'user' ? '你关联' : 'AI 关联'}</em>
                            <button
                              type="button"
                              aria-label="解除关联"
                              data-testid={`yzj-advance-thread-remove-${index}`}
                              disabled={busy}
                              onClick={() => { void removeThread(token) }}
                            >
                              ×
                            </button>
                          </span>
                        )
                      })}
                    </div>
                  )}
                </section>
                <section className={css.section}>
                  <div className={css.sectionHead}>
                    <h2>当前判断来自哪里</h2>
                    <small>跨工作现场</small>
                  </div>
                  {detail.sources.length === 0 ? (
                    <p className={css.quiet}>暂无信息来源。</p>
                  ) : (
                    <div className={css.sourceList}>
                      {detail.sources.map((source, index) => {
                        const sourceRef = stripRefPrefix(asString(source.ref))
                        const sourceKind = refKindOf(asString(source.sourceType))
                        const sourceHref = refHref(sourceKind, sourceRef)
                        return (
                          <div key={`s${index}`} className={css.source}>
                            <span className={css.sourceIcon}>{SOURCE_ICON[asString(source.sourceType)] ?? '源'}</span>
                            <span className={css.sourceCopy}>
                              {sourceHref !== null ? (
                                <a href={sourceHref} target="_blank" rel="noreferrer" title={sourceRef}><b>{asString(source.label)}</b></a>
                              ) : (
                                <b>{asString(source.label)}</b>
                              )}
                              <span>{asString(source.at)}</span>
                            </span>
                            <em className={`${css.sourceState} ${css[`state_${asString(source.status)}`] ?? ''}`}>{asString(source.status)}</em>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <p className={css.sideNote}>AI 推进不建立新的文件库，而是解释这些工作事实为什么支持或不支持当前目标。</p>
                </section>
                {detail.sources.some(source => asString(source.sourceType) === '文档') && (
                  <section className={css.section}>
                    <div className={css.sectionHead}>
                      <h2>已有产物</h2>
                      <small>仍在产物管理</small>
                    </div>
                    <div className={css.sourceList}>
                      {detail.sources.filter(source => asString(source.sourceType) === '文档').map((source, index) => {
                        const productRef = stripRefPrefix(asString(source.ref))
                        const productHref = refHref('doc', productRef)
                        return (
                          <div key={`p${index}`} className={css.source}>
                            <span className={css.sourceIcon}>文</span>
                            <span className={css.sourceCopy}>
                              {productHref !== null ? (
                                <a href={productHref} target="_blank" rel="noreferrer" title={productRef}><b>{asString(source.label)}</b></a>
                              ) : (
                                <b>{asString(source.label)}</b>
                              )}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                )}
              </aside>
            </div>
          </>
        )}
        {error !== '' && <div className={css.error} data-testid="yzj-advance-error">{error}</div>}
      </main>

      {startOpen && (
        <div className={css.mask} data-testid="yzj-advance-start-modal">
          <section className={css.modal} role="dialog" aria-modal="true" aria-label="发起推进">
            <header className={css.modalHead}>
              <h2>发起推进</h2>
              <button type="button" aria-label="关闭" onClick={() => { setStartOpen(false) }}>×</button>
            </header>
            <label className={css.fieldLabel}>这件事叫什么<input value={draft.title} data-testid="yzj-advance-draft-title" onChange={(event) => { setDraft({ ...draft, title: event.target.value }) }} /></label>
            <label className={css.fieldLabel}>这件事要做到什么<textarea value={draft.goal} data-testid="yzj-advance-draft-goal" onChange={(event) => { setDraft({ ...draft, goal: event.target.value }) }} /></label>
            <div className={css.fieldRow}>
              <label className={css.fieldLabel}>结果承担者<input value={draft.assignee} onChange={(event) => { setDraft({ ...draft, assignee: event.target.value }) }} /></label>
              <label className={css.fieldLabel}>目标日期<input value={draft.targetDate} placeholder="2026-08-31" onChange={(event) => { setDraft({ ...draft, targetDate: event.target.value }) }} /></label>
            </div>
            <label className={css.fieldLabel}>达到什么结果才算完成（每行一条「指标名: 当前 / 目标」）<textarea value={draft.metrics} onChange={(event) => { setDraft({ ...draft, metrics: event.target.value }) }} /></label>
            <label className={css.fieldLabel}>任务背景<textarea value={draft.background} onChange={(event) => { setDraft({ ...draft, background: event.target.value }) }} /></label>
            <footer className={css.modalFoot}>
              <button type="button" onClick={() => { setStartOpen(false) }}>关闭</button>
              <button type="button" className={css.primary} data-testid="yzj-advance-create" disabled={busy || draft.title.trim() === ''} onClick={() => { void create() }}>
                {busy ? '创建中…' : '开始推进'}
              </button>
            </footer>
          </section>
        </div>
      )}
      {threadModalOpen && (
        <div className={css.mask} data-testid="yzj-advance-thread-modal">
          <section className={css.modal} role="dialog" aria-modal="true" aria-label="关联渠道">
            <header className={css.modalHead}>
              <h2>关联渠道</h2>
              <button type="button" aria-label="关闭" onClick={() => { setThreadModalOpen(false) }}>×</button>
            </header>
            <p className={css.sideNote}>IM 群是持续渠道（巡检增量取流）；文档 / 待办 / 日程 / 文件是单文档源，关联即产一条事元。</p>
            {groupOptions.length > 0 && (
              <div className={css.threadGroupList} data-testid="yzj-advance-thread-groups">
                {groupOptions.map((group) => {
                  const groupId = asString(group.groupId)
                  return (
                    <button
                      key={groupId}
                      type="button"
                      data-testid={`yzj-advance-thread-group-${groupId}`}
                      disabled={busy}
                      onClick={() => { void addThread(`im:${groupId}`, asString(group.groupName)) }}
                    >
                      {asString(group.groupName) === '' ? groupId : asString(group.groupName)}
                    </button>
                  )
                })}
              </div>
            )}
            <label className={css.fieldLabel}>
              或输入线程 token（im: / doc: / todo: / event: / file:）
              <input value={threadToken} data-testid="yzj-advance-thread-token" placeholder="doc:5f3a…" onChange={(event) => { setThreadToken(event.target.value) }} />
            </label>
            <footer className={css.modalFoot}>
              <button type="button" onClick={() => { setThreadModalOpen(false) }}>取消</button>
              <button
                type="button"
                className={css.primary}
                data-testid="yzj-advance-thread-token-submit"
                disabled={busy || threadToken.trim() === ''}
                onClick={() => { void addThread(threadToken.trim()) }}
              >
                {busy ? '关联中…' : '关联'}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  )
}
