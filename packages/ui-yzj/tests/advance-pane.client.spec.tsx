// @vitest-environment jsdom
/**
 * Advance board specs: queue grouping (三栏目), prototype-toned queue dots,
 * the stage-aware decision area, the timeline with tones and 查看全部
 * paging, the sources column, judge direct writes, the provisioning hero,
 * and the start modal — all against a scripted inject face (no RPC).
 */
import { act } from 'react-dom/test-utils'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { YzjAdvancePane, queuesOf, STAGE_LABEL, formatScanStatus } from '../src/client/advance-pane.tsx'
import type { AdvancePaneProps } from '../src/client/advance-pane.tsx'
import { getAdvanceFeedback, setAdvanceFeedback } from '../src/client/advance-feedback.ts'
import { getAdvanceAskDraft, setAdvanceAskDraft } from '../src/client/advance-ask.ts'
import { getWorkbenchDomain, setWorkbenchDomain } from '../src/client/workbench-domain.ts'

type Rpc = { ok: true; value: unknown } | { ok: false; error: { message: string } }

function item(over: Record<string, unknown>): Record<string, unknown> {
  return {
    advanceId: 'A-1', title: '事项', goal: '', assignee: '', targetDate: '',
    stage: 'running', background: '', metrics: [], tags: [], latest: '', ...over,
  }
}

function entry(over: Record<string, unknown>): Record<string, unknown> {
  return {
    entryId: 'E-1', at: '2026/08/19 10:00', sourceType: '人工', changeType: '备注',
    summary: '事件', detail: '', refs: [], actor: 'agent', tone: 'blue', ...over,
  }
}

interface Face {
  container: HTMLDivElement
  root: Root
  judged: { advanceId: string; action: string }[]
  created: Record<string, unknown>[]
  ensured: { count: number }
  getRequests: { advanceId: string; entryOffset?: number; entryLimit?: number }[]
}

function mountPane(config: {
  ready?: boolean
  items?: Record<string, unknown>[]
  detail?: { item: Record<string, unknown>; entries: Record<string, unknown>[]; entryTotal?: number; sources?: Record<string, unknown>[] }
  scan?: { scannedAt: number | null; found: number }
}): Face {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const judged: Face['judged'] = []
  const created: Face['created'] = []
  const ensured = { count: 0 }
  const getRequests: Face['getRequests'] = []
  const items = config.items ?? []
  const props: AdvancePaneProps = {
    inject: {
      advanceState: async () => ({
        ok: true,
        value: {
          ready: config.ready !== false,
          library: { link: 'https://example/board' },
          items,
        },
      }) as Rpc,
      advanceGet: async (advanceId, entryOffset, entryLimit) => {
        getRequests.push({ advanceId, ...(entryOffset === undefined ? {} : { entryOffset }), ...(entryLimit === undefined ? {} : { entryLimit }) })
        const detail = config.detail
        if (detail === undefined) return { ok: false, error: { message: 'no detail scripted' } } as Rpc
        return {
          ok: true,
          value: {
            item: detail.item,
            entries: detail.entries,
            entryOffset: 0,
            entryTotal: detail.entryTotal ?? detail.entries.length,
            sources: detail.sources ?? [],
          },
        } as Rpc
      },
      advanceCreate: async (input) => {
        created.push(input as Record<string, unknown>)
        return { ok: true, value: { advanceId: 'A-NEW', title: input.title, stage: 'draft' } } as Rpc
      },
      advanceJudge: async (advanceId, action) => {
        judged.push({ advanceId, action })
        return { ok: true, value: { advanceId, stage: 'updated' } } as Rpc
      },
      advanceEnsure: async () => {
        ensured.count += 1
        return { ok: true, value: { ready: true, library: { link: 'https://example/board' }, items: [] } } as Rpc
      },
      advanceScanState: async () => ({
        ok: true,
        value: config.scan ?? { scannedAt: null, found: 0 },
      }) as Rpc,
    },
  }
  act(() => {
    root.render(<YzjAdvancePane {...props} />)
  })
  return { container, root, judged, created, ensured, getRequests }
}

async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('queuesOf', () => {
  it('groups the three queues by stage', () => {
    const items = [
      item({ advanceId: 'A-1', stage: 'decision-needed' }),
      item({ advanceId: 'A-2', stage: 'ready-for-review' }),
      item({ advanceId: 'A-3', stage: 'running' }),
      item({ advanceId: 'A-4', stage: 'completed' }),
    ]
    const queues = queuesOf(items)
    expect(queues.decide.map(i => i.advanceId)).toEqual(['A-1'])
    expect(queues.review.map(i => i.advanceId)).toEqual(['A-2'])
    expect(queues.watch.map(i => i.advanceId)).toEqual(['A-3', 'A-4'])
  })

  it('labels all six stages in Chinese', () => {
    for (const stage of ['draft', 'running', 'decision-needed', 'updated', 'ready-for-review', 'completed']) {
      expect(STAGE_LABEL[stage]).toBeTruthy()
    }
  })
})

describe('formatScanStatus', () => {
  it('renders 尚未巡检 until a patrol has run', () => {
    expect(formatScanStatus(null, 0)).toBe('尚未巡检')
    expect(formatScanStatus(Date.parse('2026-08-19T12:34:00+08:00'), 3)).toMatch(/上次巡检 \d{2}:\d{2} · 本轮发现 3 条/)
  })
})

describe('YzjAdvancePane', () => {
  afterEach(() => {
    setAdvanceFeedback(null)
    setAdvanceAskDraft(null)
    setWorkbenchDomain('im')
  })

  it('shows the provisioning hero and ensures on click', async () => {
    const face = mountPane({ ready: false })
    await settle()
    expect(face.container.textContent).toContain('推进看板还没有开通')
    const button = face.container.querySelector('[data-testid="yzj-advance-ensure"]') as HTMLButtonElement
    await act(async () => { button.click(); await Promise.resolve() })
    expect(face.ensured.count).toBe(1)
    act(() => { face.root.unmount() })
  })

  it('renders the three queue groups with badges and prototype empty copy', async () => {
    const face = mountPane({
      items: [item({ advanceId: 'A-3', stage: 'running', title: '安静推进', latest: 'AI 正在跟进' })],
      detail: { item: item({ advanceId: 'A-3', stage: 'running' }), entries: [] },
    })
    await settle()
    expect(face.container.querySelector('[data-testid="yzj-advance-queue-decide"]')?.textContent).toContain('当前没有待决定事项')
    expect(face.container.querySelector('[data-testid="yzj-advance-queue-decide"]')?.textContent).toContain('AI 会在需要你的权限时再提醒')
    expect(face.container.querySelector('[data-testid="yzj-advance-queue-review"]')?.textContent).toContain('只有业务标准满足后才进入这里')
    expect(face.container.querySelector('[data-testid="yzj-advance-queue-watch"]')?.textContent).toContain('安静推进')
    act(() => { face.root.unmount() })
  })

  it('shows the patrol status line on the queue head', async () => {
    const empty = mountPane({
      items: [item({ advanceId: 'A-3', stage: 'running', title: '安静推进' })],
      detail: { item: item({ advanceId: 'A-3', stage: 'running' }), entries: [] },
    })
    await settle()
    expect(empty.container.querySelector('[data-testid="yzj-advance-scan-status"]')?.textContent).toBe('尚未巡检')
    act(() => { empty.root.unmount() })
    const found = mountPane({
      items: [item({ advanceId: 'A-3', stage: 'running', title: '安静推进' })],
      detail: { item: item({ advanceId: 'A-3', stage: 'running' }), entries: [] },
      scan: { scannedAt: Date.parse('2026-08-19T12:34:00+08:00'), found: 2 },
    })
    await settle()
    expect(found.container.querySelector('[data-testid="yzj-advance-scan-status"]')?.textContent).toMatch(/上次巡检 \d{2}:\d{2} · 本轮发现 2 条/)
    act(() => { found.root.unmount() })
  })

  it('selects the decision item first and shows the decision area with judge verbs', async () => {
    const decision = entry({ entryId: 'E-9', changeType: '决策请求', summary: '客户新增本地部署要求', tone: 'red' })
    const face = mountPane({
      items: [
        item({ advanceId: 'A-2', stage: 'running', title: '安静' }),
        item({ advanceId: 'A-1', stage: 'decision-needed', title: '要决定' }),
      ],
      detail: { item: item({ advanceId: 'A-1', stage: 'decision-needed', title: '要决定' }), entries: [decision] },
    })
    await settle()
    expect(face.getRequests[0]?.advanceId).toBe('A-1')
    const area = face.container.querySelector('[data-testid="yzj-advance-decision"]')
    expect(area?.textContent).toContain('需要你决定')
    expect(area?.textContent).toContain('客户新增本地部署要求')
    const confirm = face.container.querySelector('[data-testid="yzj-advance-judge-confirm_advance"]') as HTMLButtonElement
    await act(async () => { confirm.click(); await Promise.resolve() })
    await settle()
    expect(face.judged).toEqual([{ advanceId: 'A-1', action: 'confirm_advance' }])
    act(() => { face.root.unmount() })
  })

  it('shows accept/reject on ready-for-review and quiet copy on running', async () => {
    const face = mountPane({
      items: [item({ advanceId: 'A-5', stage: 'ready-for-review', title: '待验收' })],
      detail: { item: item({ advanceId: 'A-5', stage: 'ready-for-review', title: '待验收' }), entries: [] },
    })
    await settle()
    expect(face.container.querySelector('[data-testid="yzj-advance-decision"]')?.textContent).toContain('是否已经达到目标')
    const accept = face.container.querySelector('[data-testid="yzj-advance-judge-accept"]') as HTMLButtonElement
    expect(accept).not.toBeNull()
    expect(face.container.querySelector('[data-testid="yzj-advance-judge-reject"]')).not.toBeNull()
    await act(async () => { accept.click(); await Promise.resolve() })
    await settle()
    expect(face.judged[0]?.action).toBe('accept')
    act(() => { face.root.unmount() })
  })

  it('renders the timeline with tones, metrics cards, sources and 查看全部 paging', async () => {
    const face = mountPane({
      items: [item({ advanceId: 'A-1', stage: 'running', title: '试运行' })],
      detail: {
        item: item({
          advanceId: 'A-1', stage: 'running', title: '试运行', goal: '8/31 前进入试运行',
          metrics: [{ name: '自助解决率', current: '38%', target: '60%' }],
        }),
        entries: [
          entry({ entryId: 'E-1', summary: '从对话中发起', tone: 'blue' }),
          entry({ entryId: 'E-2', changeType: '偏差', summary: 'UAT 不达标', tone: 'red', sourceType: '数据' }),
        ],
        entryTotal: 12,
        sources: [
          { sourceType: '文档', label: '范围说明', ref: 'yzj:doc:1', at: '10:00', status: '已读取' },
          { sourceType: '数据', label: 'UAT 记录', ref: 'yzj:data:1', at: '11:00', status: '未达标' },
        ],
      },
    })
    await settle()
    expect(face.container.querySelector('[data-testid="yzj-advance-metrics"]')?.textContent).toContain('自助解决率')
    const timeline = face.container.querySelector('[data-testid="yzj-advance-timeline"]')
    expect(timeline?.textContent).toContain('从对话中发起')
    expect(timeline?.textContent).toContain('UAT 不达标')
    const sources = face.container.querySelector('[data-testid="yzj-advance-sources"]')
    expect(sources?.textContent).toContain('当前判断来自哪里')
    expect(sources?.textContent).toContain('未达标')
    expect(sources?.textContent).toContain('AI 推进不建立新的文件库')
    // 已有产物 aggregates doc sources.
    expect(sources?.textContent).toContain('已有产物')
    const showAll = face.container.querySelector('[data-testid="yzj-advance-show-all"]') as HTMLButtonElement
    expect(showAll).not.toBeNull()
    await act(async () => { showAll.click(); await Promise.resolve() })
    await settle()
    const full = face.getRequests.find(request => request.entryOffset === 0 && request.entryLimit === 200)
    expect(full).toBeDefined()
    act(() => { face.root.unmount() })
  })

  it('creates from the start modal as a user-direct write', async () => {
    const face = mountPane({ items: [], detail: undefined as never })
    await settle()
    expect(face.container.textContent).toContain('这件事还没有开始推进')
    const start = face.container.querySelector('[data-testid="yzj-advance-start-hero"]') as HTMLButtonElement
    act(() => { start.click() })
    const modal = face.container.querySelector('[data-testid="yzj-advance-start-modal"]')
    expect(modal).not.toBeNull()
    const title = face.container.querySelector('[data-testid="yzj-advance-draft-title"]') as HTMLInputElement
    const goal = face.container.querySelector('[data-testid="yzj-advance-draft-goal"]') as HTMLTextAreaElement
    act(() => {
      const setInput = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
      setInput.call(title, 'KA 试运行')
      title.dispatchEvent(new Event('input', { bubbles: true }))
      const setArea = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!
      setArea.call(goal, '进入试运行')
      goal.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const create = face.container.querySelector('[data-testid="yzj-advance-create"]') as HTMLButtonElement
    await act(async () => { create.click(); await Promise.resolve() })
    await settle()
    expect(face.created).toHaveLength(1)
    expect(face.created[0]?.title).toBe('KA 试运行')
    expect(face.created[0]?.goal).toBe('进入试运行')
    act(() => { face.root.unmount() })
  })

  it('现在反馈 writes the card bus and switches to 对话', async () => {
    setWorkbenchDomain('advance')
    const face = mountPane({
      items: [item({ advanceId: 'A-1', stage: 'running', title: '试运行', goal: '进入试运行' })],
      detail: { item: item({ advanceId: 'A-1', stage: 'running', title: '试运行', goal: '进入试运行' }), entries: [] },
    })
    await settle()
    const button = face.container.querySelector('[data-testid="yzj-advance-feedback"]') as HTMLButtonElement
    expect(button).not.toBeNull()
    await act(async () => { button.click(); await Promise.resolve() })
    expect(getWorkbenchDomain()).toBe('im')
    expect(getAdvanceFeedback()).toEqual({
      advanceId: 'A-1',
      title: '试运行',
      goal: '进入试运行',
      stage: 'running',
    })
    act(() => { face.root.unmount() })
  })

  it('请 AI 验收 writes the ask draft and switches to 对话 without sending', async () => {
    setWorkbenchDomain('advance')
    const face = mountPane({
      items: [item({ advanceId: 'A-1', stage: 'running', title: '试运行', goal: '进入试运行' })],
      detail: { item: item({ advanceId: 'A-1', stage: 'running', title: '试运行', goal: '进入试运行' }), entries: [] },
    })
    await settle()
    const button = face.container.querySelector('[data-testid="yzj-advance-review"]') as HTMLButtonElement
    expect(button).not.toBeNull()
    await act(async () => { button.click(); await Promise.resolve() })
    expect(getWorkbenchDomain()).toBe('im')
    const draft = getAdvanceAskDraft()
    expect(draft?.advanceId).toBe('A-1')
    expect(draft?.title).toBe('试运行')
    expect(draft?.text).toContain('yzj_advance_inspect')
    expect(draft?.text).toContain('不要 stageTo=completed')
    act(() => { face.root.unmount() })
  })
})
