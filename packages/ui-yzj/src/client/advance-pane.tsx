/**
 * The 推进 tab: the AI推进 board (docs/spec/ai-advance-design.md §7),
 * information architecture replicated from the lgap17 prototype — left
 * "我的推进" queue (待我决定 / 待我验收 / 我关注的推进 with count badges),
 * main detail (kicker + metric cards + goal + stage-aware decision area +
 * 推进时间旅程 with three-tone marks and source jumps), right column
 * (信息来源;「已有产物」区已于 v1.6 收掉——产物是事元的一部分,随信息来源呈现)。Panel judge verbs and the start modal are
 * user-direct writes (D9: no confirmation card); agent writes go through
 * yzj_advance_create/feed with the standard card. Data arrives through the
 * /yzj RPC face only.
 */
import { useEffect, useMemo, useState } from 'react'
import type { YzjPanelInject } from './rpc.ts'
import { requestImGroupFocus, setWorkbenchDomain } from './workbench-domain.ts'
import { setAdvanceFeedback } from './advance-feedback.ts'
import { setAdvanceAskDraft, reviewAskText, exportReviewAskText } from './advance-ask.ts'
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

/** 决策 39: `im:<groupId>:<msgId>` msg ref → 事件级定位锚点；裸 msgId 是 legacy（无群信息，只能降级跳群）。 */
function msgAnchorOf(raw: string): { groupId: string; msgId: string } | null {
  const match = /^im:([^:\s]+):(.+)$/.exec(raw)
  if (match === null) return null
  return { groupId: match[1]!, msgId: match[2]! }
}

/** 事件行时间戳：sentAt(ms) → `MM-DD HH:mm`。 */
function refStampOf(sentAt: number): string {
  if (sentAt <= 0) return ''
  const date = new Date(sentAt)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** 时间线时间戳紧凑化(视觉走查):当天只留 `HH:mm`,当年 `MM-DD HH:mm`,跨年全量;完整值在 title。 */
function formatEntryAt(at: string): string {
  const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{1,2}):(\d{2})/.exec(at.trim())
  if (match === null) return at
  const [, year, month, day, hh, mm] = match
  const pad = (value: number): string => String(value).padStart(2, '0')
  const mmdd = `${pad(Number(month))}-${pad(Number(day))}`
  const now = new Date()
  const today = `${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  if (year === String(now.getFullYear()) && mmdd === today) return `${hh}:${mm}`
  if (year === String(now.getFullYear())) return `${mmdd} ${hh}:${mm}`
  return `${year}-${mmdd} ${hh}:${mm}`
}

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


/** Max personal workspaces listed in the source picker (防爆上限;个人库通常一两个)。 */
const MAX_PICKER_WORKSPACES = 6

/** Single-character icon per source token prefix (上下文来源 chip). */
const THREAD_ICON: Record<string, string> = {
  im: '群', doc: '文', todo: '待', event: '日', file: '附', dir: '库',
}

function sourceIconOf(token: string): string {
  const prefix = token.split(':')[0] ?? ''
  return THREAD_ICON[prefix] ?? '源'
}

/** Props: the RPC verbs the board needs (subset of the panel inject). */
export interface AdvancePaneProps {
  inject: Pick<YzjPanelInject, 'advanceState' | 'advanceGet' | 'advanceCreate' | 'advanceJudge' | 'advanceEnsure' | 'advanceScanState' | 'advancePatrolNow' | 'advanceSourceAdd' | 'advanceSourceRemove' | 'fetchGroups' | 'fetchWorkspaces' | 'fetchDocs' | 'advanceDreamState' | 'advanceDreamRun' | 'advanceRefLookup' | 'focusBoundSession'>
}

/** Queue-head patrol line (spec §14.5). */
function hhmm(ts: number): string {
  const date = new Date(ts)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

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
  contextSources: UnknownRecord[]
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
  /** 时间线事元详情展开集(默认折叠,展开才见原始来源)。 */
  const [expandedEntries, setExpandedEntries] = useState<ReadonlySet<string>>(new Set())
  const [draft, setDraft] = useState({ title: '', goal: '', metrics: '', assignee: '', targetDate: '', background: '' })
  const [error, setError] = useState('')
  /** msg 类事元/来源跳转：带渠道 token 直达该群并定位那条消息（决策 39）；裸 msgId 降级用订阅渠道猜群。 */
  const imGroupTokens = (detail?.contextSources ?? []).map(row => asString(row.token)).filter(token => token.startsWith('im:'))
  const jumpToMsg = (): void => {
    if (imGroupTokens.length === 1) requestImGroupFocus({ groupId: imGroupTokens[0]!.slice(3) })
    setWorkbenchDomain('im')
  }
  /** 事元 msg ref 跳转（决策 39）：`im:g:m` 直达消息；legacy 裸 msgId 回退 jumpToMsg。 */
  const jumpToSourceMsg = (raw: string): void => {
    const anchor = msgAnchorOf(raw)
    if (anchor !== null) {
      requestImGroupFocus({ groupId: anchor.groupId, anchorMsgId: anchor.msgId })
      setWorkbenchDomain('im')
      return
    }
    jumpToMsg()
  }
  const [scanLine, setScanLine] = useState('尚未巡检')
  /** Dream 蓄水池水位行(spec §17.3)。 */
  const [dreamLine, setDreamLine] = useState('')
  /** Dream 水位达阈（决策 35）：抽取按钮高亮。 */
  const [waterReached, setWaterReached] = useState(false)
  /** 蓄水池 pending 明细（池查看浮层，决策 38）。 */
  const [dreamEntries, setDreamEntries] = useState<{ id: string; channel: string; refId: string; content: string; sendTime: string }[]>([])
  const [dreamPoolOpen, setDreamPoolOpen] = useState(false)
  /** 原始信息叶子可读化(决策 39 后续): msg → bound log 事件行;doc → 文档名。 */
  const [refHits, setRefHits] = useState<Record<string, { kind: string; fromName: string; content: string; sentAt: number; jumpToken?: string; docId?: string }>>({})
  const [sourceModalOpen, setSourceModalOpen] = useState(false)
  const [groupOptions, setGroupOptions] = useState<UnknownRecord[]>([])
  /** 知识库目录选项(决策 32):整库 + 一层目录。 */
  const [dirOptions, setDirOptions] = useState<{ id: string; label: string }[]>([])

  const loadScan = async (): Promise<void> => {
    const result = await props.inject.advanceScanState()
    if (!result.ok) return
    const value = asRecord(result.value)
    const scannedAt = typeof value.scannedAt === 'number' ? value.scannedAt : null
    const found = typeof value.found === 'number' ? value.found : 0
    setScanLine(formatScanStatus(scannedAt, found))
  }

  const loadDream = async (): Promise<void> => {
    const result = await props.inject.advanceDreamState()
    if (!result.ok) return
    const value = asRecord(result.value)
    const pending = typeof value.pending === 'number' ? value.pending : 0
    const lastDreamAt = typeof value.lastDreamAt === 'number' ? value.lastDreamAt : null
    setWaterReached(value.waterLevelReached === true)
    setDreamEntries(Array.isArray(value.entries)
      ? (value.entries as unknown[]).map(row => {
        const entry = asRecord(row)
        return {
          id: asString(entry.id),
          channel: asString(entry.channel),
          refId: asString(entry.refId),
          content: asString(entry.content),
          sendTime: asString(entry.sendTime),
        }
      })
      : [])
    if (pending === 0) {
      setDreamLine(lastDreamAt === null ? '' : `蓄水池已清空 · 上次抽取 ${hhmm(lastDreamAt)}`)
      return
    }
    setDreamLine(`池中 ${pending} 条待抽取${value.waterLevelReached === true ? ' · 水位达到，建议抽取' : ''}${lastDreamAt === null ? '' : ` · 上次抽取 ${hhmm(lastDreamAt)}`}`)
  }

  /** Dream 手动径（决策 38）: host 直建 yzj-dream-* 会话并聚焦。 */
  const runDream = async (): Promise<void> => {
    setBusy(true)
    try {
      const result = await props.inject.advanceDreamRun()
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      setError('')
      const sessionId = asString(asRecord(result.value).sessionId)
      if (sessionId !== '') props.inject.focusBoundSession?.(sessionId)
    } finally {
      setBusy(false)
    }
  }

  /** 原始信息可读化(决策 39 后续): detail 加载后批量把 refs 按 kind 解析成可读叶子。 */
  useEffect(() => {
    if (detail === undefined || detail === null) { setRefHits({}); return }
    const wanted: { token: string; kind: string }[] = []
    const seen = new Set<string>()
    for (const entry of detail.entries) {
      const kind = refKindOf(asString(entry.sourceType))
      const refs = Array.isArray(entry.refs) ? entry.refs : []
      for (const raw of refs) {
        const token = stripRefPrefix(asString(raw))
        if (token === '' || seen.has(token)) continue
        // host 全量可解:doc → 文件名;msg → im: 直查 + 裸 msgId 扫绑定 log;dp-* 池 id 也能还原(视觉走查 08-21)。
        if (kind !== 'msg' && kind !== 'doc' && !token.startsWith('dp-')) continue
        seen.add(token)
        wanted.push({ token, kind })
      }
    }
    if (wanted.length === 0) { setRefHits({}); return }
    let cancelled = false
    void (async () => {
      const result = await props.inject.advanceRefLookup(wanted)
      if (cancelled || !result.ok) return
      const hits = asRecord(result.value).hits
      if (!Array.isArray(hits)) return
      const next: Record<string, { kind: string; fromName: string; content: string; sentAt: number; jumpToken?: string; docId?: string }> = {}
      for (const row of hits) {
        const hit = asRecord(row)
        next[asString(hit.token)] = {
          kind: asString(hit.kind),
          fromName: asString(hit.fromName),
          content: asString(hit.content),
          sentAt: typeof hit.sentAt === 'number' ? hit.sentAt : 0,
          ...(asString(hit.jumpToken) === '' ? {} : { jumpToken: asString(hit.jumpToken) }),
          ...(asString(hit.docId) === '' ? {} : { docId: asString(hit.docId) }),
        }
      }
      if (!cancelled) setRefHits(next)
    })()
    return () => { cancelled = true }
  }, [detail, props.inject])

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
      await loadDream()
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
    setSourceModalOpen(false)
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
        contextSources: asArray(value.contextSources).map(asRecord),
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
        contextSources: asArray(value.contextSources).map(asRecord),
      })
    }
  }

  /** Re-pull the detail only (source add/remove landed registry/entry rows). */
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
      contextSources: asArray(value.contextSources).map(asRecord),
    })
  }

  const openSourceModal = async (): Promise<void> => {
    setSourceModalOpen(true)
    const result = await props.inject.fetchGroups()
    if (result.ok) {
      const value = asRecord(result.value)
      const rows = asArray(value.list).length > 0 ? asArray(value.list) : asArray(result.value)
      setGroupOptions(rows.map(asRecord).filter(row => asString(row.groupId) !== ''))
    }
    // 知识库目录 picker(决策 40):全部个人库整库 + 各库一层目录(hasChildren;
    // 多库时目录带库名前缀)。决策 32 只列「我的知识」——AI速记知识库(会议
    // 纪要自动归档地)因此被漏掉,用户 08-21 拍板修正。
    const dirs: { id: string; label: string }[] = []
    const wsResult = await props.inject.fetchWorkspaces('personal')
    if (wsResult.ok) {
      const workspaces = asArray(wsResult.value).map(asRecord)
        .filter(row => asString(row.id) !== '')
        .slice(0, MAX_PICKER_WORKSPACES)
      const multi = workspaces.length > 1
      for (const ws of workspaces) {
        const kbId = asString(ws.id)
        const kbName = asString(ws.name) || kbId
        dirs.push({ id: kbId, label: `${kbName}（整库）` })
        const docsResult = await props.inject.fetchDocs(kbId)
        if (!docsResult.ok) continue
        for (const node of asArray(docsResult.value).map(asRecord)) {
          const id = asString(node.id)
          const title = asString(node.title)
          const hasChildren = node.hasChildren === true || (typeof node.childrenCount === 'number' && node.childrenCount > 0)
          if (id !== '' && title !== '' && hasChildren) {
            dirs.push({ id, label: multi ? `${kbName} / ${title}` : title })
          }
        }
      }
    }
    setDirOptions(dirs)
  }

  const addSource = async (token: string, label?: string): Promise<void> => {
    if (busy || activeId === '') return
    setBusy(true)
    setError('')
    const result = await props.inject.advanceSourceAdd(activeId, token, label)
    setBusy(false)
    if (!result.ok) {
      setError(result.error.message)
      return
    }
    setSourceModalOpen(false)
    await refreshDetail()
  }

  const removeSource = async (token: string): Promise<void> => {
    if (busy || activeId === '') return
    setBusy(true)
    setError('')
    const result = await props.inject.advanceSourceRemove(activeId, token)
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
            title="立即机械巡检一轮上下文来源（host routine，无模型）"
            onClick={() => {
              void (async () => {
                setBusy(true)
                try {
                  await props.inject.advancePatrolNow()
                  const scan = await props.inject.advanceScanState()
                  if (scan.ok) {
                    const v = asRecord(scan.value)
                    setScanLine(formatScanStatus(typeof v.scannedAt === 'number' ? v.scannedAt : null, typeof v.found === 'number' ? v.found : 0))
                  }
                  await loadDream()
                } finally {
                  setBusy(false)
                }
              })()
            }}
          >
            巡检
          </button>
          {dreamLine !== '' && (
            <div className={css.dreamLine} data-testid="yzj-advance-dream-status">
              <span>{dreamLine}</span>
              <span className={css.dreamActions}>
                {dreamEntries.length > 0 && (
                  <button
                    type="button"
                    className={css.patrolBtn}
                    data-testid="yzj-advance-dream-pool"
                    title="查看蓄水池待抽取信号"
                    onClick={() => { setDreamPoolOpen(true) }}
                  >
                    池 {dreamEntries.length}
                  </button>
                )}
                <button
                  type="button"
                  className={waterReached ? css.primary : css.patrolBtn}
                  data-testid="yzj-advance-dream-now"
                  disabled={busy}
                  title="新建会话直接开始 Dream 抽取"
                  onClick={() => { void runDream() }}
                >
                  Dream 抽取
                </button>
              </span>
            </div>
          )}
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
              <section className={css.section}>
                <div className={css.sectionHead}>
                  <h2>成功指标</h2>
                  <small>这几项达标 = 推进达到目标</small>
                </div>
                <div className={css.metrics} data-testid="yzj-advance-metrics">
                  {metrics.map((metric, index) => (
                    <div key={`m${index}`} className={css.metric}>
                      <span>{asString(metric.name)}</span>
                      <b>{asString(metric.current) === '' ? '—' : asString(metric.current)}</b>
                      {asString(metric.target) !== '' && <small>目标 {asString(metric.target)}</small>}
                    </div>
                  ))}
                </div>
              </section>
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
                    <h2>推进演进</h2>
                    <small>每条事元可溯源到原始信息</small>
                  </div>
                  {detail.entries.length === 0 ? (
                    <p className={css.quiet}>还没有事元记录。</p>
                  ) : (
                    <div className={css.timeline}>
                      {/* 三层树(用户拍板):演进=本时间线;每条事元 = 进度行(changeType·summary)
                          + 描述正文(detail) + 原始信息(refs)。无中间分组层。
                          新→旧倒序:最新事元置顶(host 保持 oldest-first 窗口契约,仅渲染倒)。 */}
                      {[...detail.entries].reverse().map((entry, index) => {
                        const entryId = asString(entry.entryId) || `e${index}`
                        const expanded = expandedEntries.has(entryId)
                        const refList = [...new Set(asArray(entry.refs).map(ref => asString(ref)).filter(ref => ref !== ''))]
                        const toggleExpanded = (): void => {
                          const next = new Set(expandedEntries)
                          if (next.has(entryId)) next.delete(entryId)
                          else next.add(entryId)
                          setExpandedEntries(next)
                        }
                        return (
                          <div key={entryId} className={css.timeItem}>
                            <span className={css.time} title={asString(entry.at)}>{formatEntryAt(asString(entry.at))}</span>
                            <i className={`${css.mark} ${css[`mark_${asString(entry.tone) || 'blue'}`]}`} />
                            <div className={css.timeCopy}>
                              {/* 进度行:changeType 作小标签,summary 才是标题主体(视觉走查)。 */}
                              <div className={css.entryHead}>
                                {asString(entry.changeType) !== '' && (
                                  <span className={`${css.changeType} ${css[`changeType_${asString(entry.tone) || 'blue'}`]}`}>{asString(entry.changeType)}</span>
                                )}
                                <b data-testid={`yzj-advance-entry-${index}`}>{asString(entry.summary)}</b>
                              </div>
                              {/* 事元本身也是一段描述(用户拍板):默认展示变化内容,
                                  之下才是原始信息 — 进度行→事元描述→原始信息。 */}
                              {asString(entry.detail) !== '' && (
                                <p className={css.entryDetail} data-testid={`yzj-advance-entry-detail-${index}`}>{asString(entry.detail)}</p>
                              )}
                              {/* 原始信息默认挂在事元描述下(最新 2 条),多条时「展开全部」。 */}
                              {refList.length > 0 && (
                                <>
                                  <div className={css.refsHead}>
                                    <span>原始信息 {refList.length} 条</span>
                                    {refList.length > 2 && (
                                      <button type="button" className={css.jump} data-testid={`yzj-advance-entry-toggle-${index}`} onClick={toggleExpanded}>
                                        {expanded ? '收起' : `展开全部 ${refList.length} 条`}
                                      </button>
                                    )}
                                  </div>
                                  <span className={css.refs}>
                                  {(expanded ? refList : refList.slice(-2)).map((raw) => {
                                    const id = stripRefPrefix(raw)
                                    const kind = refKindOf(asString(entry.sourceType))
                                    const hit = refHits[id]
                                    // 命中一律按 hit.kind 渲染:dp-* 池 ref 已被 host 还原成原始 msg/doc(视觉走查 08-21)。
                                    if (hit !== undefined && hit.content !== '') {
                                      if (hit.kind === 'doc') {
                                        const docHref = refHref('doc', hit.docId ?? id)
                                        return (
                                          <a key={raw} className={css.refEvent} href={docHref ?? undefined} target="_blank" rel="noreferrer" title={`打开文档 ${raw}`} data-testid={`yzj-advance-ref-${id}`}>
                                            <span className={css.refEventMeta}>文档</span>
                                            <span className={css.refEventBody}>{hit.content}</span>
                                          </a>
                                        )
                                      }
                                      return (
                                        <button
                                          key={raw}
                                          type="button"
                                          className={css.refEvent}
                                          title={`打开来源群消息 ${raw}`}
                                          data-testid={`yzj-advance-ref-${id}`}
                                          onClick={() => { jumpToSourceMsg(hit.jumpToken ?? id) }}
                                        >
                                          <span className={css.refEventMeta}>[{refStampOf(hit.sentAt)}] {hit.fromName === '' ? '群消息' : hit.fromName}</span>
                                          <span className={css.refEventBody}>{hit.content}</span>
                                        </button>
                                      )
                                    }
                                    // 未命中降级:doc 保留直跳;msg 不露裸 id(「聊 群消息」),点击仍走锚点/猜群。
                                    const href = refHref(kind, id)
                                    const short = id.length > 12 ? `${id.slice(0, 8)}…` : id
                                    const label = `${REF_ICON[kind] ?? '源'} ${short}`
                                    if (href !== null) {
                                      return <a key={raw} className={css.refChip} href={href} target="_blank" rel="noreferrer" title={raw} data-testid={`yzj-advance-ref-${id}`}>{label}</a>
                                    }
                                    if (kind === 'msg') {
                                      return <button key={raw} type="button" className={css.refChip} title={`打开来源群消息 ${raw}`} data-testid={`yzj-advance-ref-${id}`} onClick={() => { jumpToSourceMsg(id) }}>聊 群消息</button>
                                    }
                                    const domain = kind === 'todo' ? 'todo' : kind === 'event' ? 'calendar' : null
                                    if (domain !== null) {
                                      return <button key={raw} type="button" className={css.refChip} title={raw} data-testid={`yzj-advance-ref-${id}`} onClick={() => { setWorkbenchDomain(domain) }}>{label}</button>
                                    }
                                    return <span key={raw} className={css.refChip} title={raw}>{label}</span>
                                  })}
                                  </span>
                                </>
                              )}
                              {/* 事元出处脚注:裸 sourceType 曾渲染成 refs 卡下的孤儿标签(视觉走查)。 */}
                              {(asString(entry.sourceType) !== '' || asString(entry.actor) === 'user') && (
                                <div className={css.timeMeta}>
                                  <span>{asString(entry.actor) === 'user' ? `${asString(entry.sourceType) === '' ? '' : `${asString(entry.sourceType)} · `}你的判断` : `记录自 ${asString(entry.sourceType)}`}</span>
                                </div>
                              )}
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
                    <h2>上下文来源</h2>
                    <button type="button" className={css.linkBtn} data-testid="yzj-advance-source-add-open" disabled={busy} onClick={() => { void openSourceModal() }}>关联来源</button>
                  </div>
                  {detail.contextSources.length === 0 ? (
                    <p className={css.quiet}>尚未关联来源；关联群 / 知识库目录后，巡检会按订阅取增量。</p>
                  ) : (
                    <div className={css.subSources} data-testid="yzj-advance-sources">
                      {detail.contextSources.map((source, index) => {
                        const token = asString(source.token)
                        return (
                          <span key={token === '' ? `t${index}` : token} className={css.subChip} data-testid={`yzj-advance-source-${index}`}>
                            <i className={css.subIcon}>{sourceIconOf(token)}</i>
                            <b>{asString(source.label) === '' ? token : asString(source.label)}</b>
                            <em>{asString(source.addedBy) === 'user' ? '你关联' : 'AI 关联'}</em>
                            <button
                              type="button"
                              aria-label="解除关联"
                              data-testid={`yzj-advance-source-remove-${index}`}
                              disabled={busy}
                              onClick={() => { void removeSource(token) }}
                            >
                              ×
                            </button>
                          </span>
                        )
                      })}
                    </div>
                  )}
                </section>
                <p className={css.sideNote}>AI 推进不建立新的文件库，也不建独立来源库：原始信息挂在事元下（多条信息可能被提炼为一条事元），多个事元折叠出推进演进。</p>
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
      {dreamPoolOpen && (
        <div className={css.mask} data-testid="yzj-advance-dream-modal">
          <section className={css.modal} role="dialog" aria-modal="true" aria-label="蓄水池待抽取">
            <header className={css.modalHead}>
              <h2>蓄水池 · 待抽取 {dreamEntries.length} 条</h2>
              <button type="button" aria-label="关闭" onClick={() => { setDreamPoolOpen(false) }}>×</button>
            </header>
            <p className={css.sideNote}>巡检发现的增量信号在池中等待 Dream 抽取：有价值的落成事元/建议卡，无关的跳过；抽过的标记完成不删除（审计面）。</p>
            <div className={css.dreamPoolList} data-testid="yzj-advance-dream-entries">
              {dreamEntries.map(entry => (
                <div key={entry.id} className={css.dreamPoolRow} data-testid={`yzj-advance-dream-entry-${entry.id}`}>
                  <span className={css.dreamPoolMeta}>[{entry.sendTime}] {entry.channel} · {entry.refId}</span>
                  <span>{entry.content}</span>
                </div>
              ))}
              {dreamEntries.length === 0 && <p className={css.sideNote}>池是空的。</p>}
            </div>
          </section>
        </div>
      )}
      {sourceModalOpen && (
        <div className={css.mask} data-testid="yzj-advance-source-modal">
          <section className={css.modal} role="dialog" aria-modal="true" aria-label="关联来源">
            <header className={css.modalHead}>
              <h2>关联来源</h2>
              <button type="button" aria-label="关闭" onClick={() => { setSourceModalOpen(false) }}>×</button>
            </header>
            <p className={css.sideNote}>IM 群与知识库目录都是持续渠道：巡检按订阅取增量（群=新消息，目录=新增/更新文档）。关联即订阅，解除不删事元。</p>
            {groupOptions.length > 0 && (
              <>
                <p className={css.subGroupLabel}>IM 群</p>
                <div className={css.subGroupList} data-testid="yzj-advance-source-groups">
                  {groupOptions.map((group) => {
                    const groupId = asString(group.groupId)
                    return (
                      <button
                        key={groupId}
                        type="button"
                        data-testid={`yzj-advance-source-group-${groupId}`}
                        disabled={busy}
                        onClick={() => { void addSource(`im:${groupId}`, asString(group.groupName)) }}
                      >
                        {asString(group.groupName) === '' ? groupId : asString(group.groupName)}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
            {dirOptions.length > 0 && (
              <>
                <p className={css.subGroupLabel}>知识库目录</p>
                <div className={css.subGroupList} data-testid="yzj-advance-source-dirs">
                  {dirOptions.map((dir) => (
                    <button
                      key={dir.id}
                      type="button"
                      data-testid={`yzj-advance-source-dir-${dir.id}`}
                      disabled={busy}
                      onClick={() => { void addSource(`dir:${dir.id}`, dir.label) }}
                    >
                      {dir.label}
                    </button>
                  ))}
                </div>
              </>
            )}
            <footer className={css.modalFoot}>
              <button type="button" onClick={() => { setSourceModalOpen(false) }}>关闭</button>
            </footer>
          </section>
        </div>
      )}
    </div>
  )
}
