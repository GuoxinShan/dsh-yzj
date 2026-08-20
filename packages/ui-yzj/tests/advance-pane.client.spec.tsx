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
import { YzjAdvancePane, queuesOf, STAGE_LABEL, formatScanStatus, parseDecisionOptions } from '../src/client/advance-pane.tsx'
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
  judged: { advanceId: string; action: string; note?: string }[]
  created: Record<string, unknown>[]
  ensured: { count: number }
  getRequests: { advanceId: string; entryOffset?: number; entryLimit?: number }[]
  sourceAdds: { advanceId: string; token: string; label?: string }[]
  sourceRemoves: { advanceId: string; token: string }[]
  groupFetches: number
}

function mountPane(config: {
  ready?: boolean
  items?: Record<string, unknown>[]
  detail?: { item: Record<string, unknown>; entries: Record<string, unknown>[]; entryTotal?: number; sources?: Record<string, unknown>[]; contextSources?: Record<string, unknown>[] }
  scan?: { scannedAt: number | null; found: number }
  dream?: { pending: number; lastDreamAt: number | null }
  groups?: Record<string, unknown>[]
}): Face {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const judged: Face['judged'] = []
  const created: Face['created'] = []
  const ensured = { count: 0 }
  const getRequests: Face['getRequests'] = []
  const sourceAdds: Face['sourceAdds'] = []
  const sourceRemoves: Face['sourceRemoves'] = []
  const groupState = { fetches: 0 }
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
            contextSources: detail.contextSources ?? [],
          },
        } as Rpc
      },
      advanceCreate: async (input) => {
        created.push(input as Record<string, unknown>)
        return { ok: true, value: { advanceId: 'A-NEW', title: input.title, stage: 'draft' } } as Rpc
      },
      advanceJudge: async (advanceId, action, note) => {
        judged.push({ advanceId, action, ...(note === undefined ? {} : { note }) })
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
      advanceDreamState: async () => ({
        ok: true,
        value: config.dream ?? { pending: 0, lastDreamAt: null },
      }) as Rpc,
      advanceSourceAdd: async (advanceId, token, label) => {
        if (!/^(im|doc|todo|event|file|dir):[A-Za-z0-9_-]+$/.test(token)) {
          return { ok: false, error: { message: `advance-source-add failed: 非法来源 token「${token}」` } } as Rpc
        }
        sourceAdds.push({ advanceId, token, ...(label === undefined ? {} : { label }) })
        return { ok: true, value: { sources: [], entryAppended: false } } as Rpc
      },
      advanceSourceRemove: async (advanceId, token) => {
        sourceRemoves.push({ advanceId, token })
        return { ok: true, value: { sources: [] } } as Rpc
      },
      fetchGroups: async () => {
        groupState.fetches += 1
        return { ok: true, value: { list: config.groups ?? [] } } as Rpc
      },
      fetchWorkspaces: async () => ({
        ok: true,
        value: [{ id: 'kb1', name: '我的知识' }],
      }) as Rpc,
      fetchDocs: async () => ({
        ok: true,
        value: [
          { id: 'dirA', title: '830实验·共识', hasChildren: true },
          { id: 'docB', title: '散文档', hasChildren: false },
        ],
      }) as Rpc,
    },
  }
  act(() => {
    root.render(<YzjAdvancePane {...props} />)
  })
  return {
    container, root, judged, created, ensured, getRequests, sourceAdds, sourceRemoves,
    get groupFetches() { return groupState.fetches },
  }
}

async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('queuesOf', () => {
  it('groups the three queues by stage, terminals excluded (决策 26/27)', () => {
    const items = [
      item({ advanceId: 'A-1', stage: 'decision-needed' }),
      item({ advanceId: 'A-2', stage: 'ready-for-review' }),
      item({ advanceId: 'A-3', stage: 'running' }),
      item({ advanceId: 'A-4', stage: 'completed' }),
      item({ advanceId: 'A-5', stage: 'cancelled' }),
    ]
    const queues = queuesOf(items)
    expect(queues.decide.map(i => i.advanceId)).toEqual(['A-1'])
    expect(queues.review.map(i => i.advanceId)).toEqual(['A-2'])
    expect(queues.watch.map(i => i.advanceId)).toEqual(['A-3'])
  })

  it('labels all seven stages in Chinese', () => {
    for (const stage of ['draft', 'running', 'decision-needed', 'updated', 'ready-for-review', 'completed', 'cancelled']) {
      expect(STAGE_LABEL[stage]).toBeTruthy()
    }
    expect(STAGE_LABEL['cancelled']).toBe('已中止')
  })

  it('keeps terminals in closed (已结束折叠区), not the watch queue', () => {
    const queues = queuesOf([
      item({ advanceId: 'A-1', stage: 'running' }),
      item({ advanceId: 'A-2', stage: 'completed' }),
      item({ advanceId: 'A-3', stage: 'cancelled' }),
    ])
    expect(queues.watch.map(i => i.advanceId)).toEqual(['A-1'])
    expect(queues.closed.map(i => i.advanceId)).toEqual(['A-2', 'A-3'])
  })
})

describe('formatScanStatus', () => {
  it('renders 尚未巡检 until a patrol has run', () => {
    expect(formatScanStatus(null, 0)).toBe('尚未巡检')
    expect(formatScanStatus(Date.parse('2026-08-19T12:34:00+08:00'), 3)).toMatch(/上次巡检 \d{2}:\d{2} · 本轮发现 3 条/)
  })
})

describe('parseDecisionOptions', () => {
  it('extracts 选项N rows and the 影响 row; rest stays plain', () => {
    const parsed = parseDecisionOptions('阶段 running→decision-needed\n选项1: 追加资源，目标日期不变\n选项2：目标日期顺延两周\n影响: 检验标准需同步调整\n补充一句')
    expect(parsed.options).toEqual(['追加资源，目标日期不变', '目标日期顺延两周'])
    expect(parsed.impact).toBe('检验标准需同步调整')
    expect(parsed.rest).toContain('阶段 running→decision-needed')
    expect(parsed.rest).toContain('补充一句')
    expect(parsed.rest).not.toContain('选项1')
  })

  it('returns empty options when the detail carries no 选项N row', () => {
    const parsed = parseDecisionOptions('客户要求改范围')
    expect(parsed.options).toEqual([])
    expect(parsed.impact).toBe('')
    expect(parsed.rest).toBe('客户要求改范围')
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
    expect(sources?.textContent).toContain('事元')
    expect(sources?.textContent).toContain('未达标')
    expect(sources?.textContent).toContain('AI 推进不建立新的文件库')
    // 「已有产物」区已于 v1.6 收掉(产物=事元的一部分,随信息来源呈现)
    expect(sources?.textContent).not.toContain('已有产物')
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

  it('terminal stages render 沉淀复盘 entry and write the export draft (决策 26)', async () => {
    setWorkbenchDomain('advance')
    // 终局提示的语义是「收口当刻」:judge 后 activeId 仍是该事项、detail 重拉为终局
    // (队列已排除终局,事后进入靠口述主路径——决策 26)。用例模拟当刻。
    const face = mountPane({
      items: [item({ advanceId: 'A-1', stage: 'running', title: '试运行' })],
      detail: { item: item({ advanceId: 'A-1', stage: 'completed', title: '试运行' }), entries: [] },
    })
    await settle()
    const terminal = face.container.querySelector('[data-testid="yzj-advance-terminal"]')
    expect(terminal?.textContent).toContain('已经完成')
    const button = face.container.querySelector('[data-testid="yzj-advance-export-review"]') as HTMLButtonElement
    expect(button).not.toBeNull()
    await act(async () => { button.click(); await Promise.resolve() })
    expect(getWorkbenchDomain()).toBe('im')
    const draft = getAdvanceAskDraft()
    expect(draft?.text).toContain('终局复盘沉淀')
    expect(draft?.text).toContain('yzj_advance_get')
    act(() => { face.root.unmount() })
  })

  it('cancelled shows 已中止 copy; 中止推进 needs a second tap (决策 27)', async () => {
    const cancelledFace = mountPane({
      items: [item({ advanceId: 'A-9', stage: 'running', title: '黄了' })],
      detail: { item: item({ advanceId: 'A-9', stage: 'cancelled', title: '黄了' }), entries: [] },
    })
    await settle()
    const terminal = cancelledFace.container.querySelector('[data-testid="yzj-advance-terminal"]')
    expect(terminal?.textContent).toContain('已中止')
    expect(cancelledFace.container.querySelector('[data-testid="yzj-advance-judge-cancel"]')).toBeNull()
    act(() => { cancelledFace.root.unmount() })

    setWorkbenchDomain('advance')
    const face = mountPane({
      items: [item({ advanceId: 'A-1', stage: 'running', title: '试运行' })],
      detail: { item: item({ advanceId: 'A-1', stage: 'running', title: '试运行' }), entries: [] },
    })
    await settle()
    const cancel = face.container.querySelector('[data-testid="yzj-advance-judge-cancel"]') as HTMLButtonElement
    expect(cancel.textContent).toContain('中止推进')
    await act(async () => { cancel.click(); await Promise.resolve() })
    expect(face.judged).toEqual([])
    expect(cancel.textContent).toContain('再点一次')
    await act(async () => { cancel.click(); await Promise.resolve() })
    expect(face.judged).toEqual([{ advanceId: 'A-1', action: 'cancel' }])
    act(() => { face.root.unmount() })
  })

  it('ref chips are clickable: doc refs deep-link, msg refs switch domain (v1.7 UX)', async () => {
    const face = mountPane({
      items: [item({ advanceId: 'A-1', stage: 'running', title: '试运行' })],
      detail: {
        item: item({ advanceId: 'A-1', stage: 'running', title: '试运行' }),
        entries: [
          { entryId: 'E-1', at: '2026/08/19 18:11', sourceType: '文档', changeType: '进度更新', summary: '纪要入库', detail: '', refs: ['yzj:6a85774aecd3fb103b859f8a'], actor: 'agent' },
          { entryId: 'E-2', at: '2026/08/19 18:28', sourceType: '对话', changeType: '进度更新', summary: '群信号', detail: '', refs: ['6a842792e4b08c3f7ebf8521'], actor: 'agent' },
        ],
      },
    })
    await settle()
    const docChip = face.container.querySelector('[data-testid="yzj-advance-ref-6a85774aecd3fb103b859f8a"]') as HTMLAnchorElement
    expect(docChip.tagName).toBe('A')
    expect(docChip.href).toContain('/store/doc/6a85774aecd3fb103b859f8a')
    const msgChip = face.container.querySelector('[data-testid="yzj-advance-ref-6a842792e4b08c3f7ebf8521"]') as HTMLButtonElement
    expect(msgChip.tagName).toBe('BUTTON')
    await act(async () => { msgChip.click(); await Promise.resolve() })
    expect(getWorkbenchDomain()).toBe('im')
    act(() => { face.root.unmount() })
  })

  it('已结束折叠区:toggle 展开终局事项并可点进详情(终局提示事后可达)', async () => {
    const face = mountPane({
      items: [
        item({ advanceId: 'A-1', stage: 'running', title: '跑着' }),
        item({ advanceId: 'A-2', stage: 'completed', title: '成了' }),
        item({ advanceId: 'A-3', stage: 'cancelled', title: '黄了' }),
      ],
      detail: { item: item({ advanceId: 'A-2', stage: 'completed', title: '成了' }), entries: [] },
    })
    await settle()
    const toggle = face.container.querySelector('[data-testid="yzj-advance-closed-toggle"]') as HTMLButtonElement
    expect(toggle.textContent).toContain('已结束 2')
    expect(face.container.querySelector('[data-testid="yzj-advance-item-A-2"]')).toBeNull()
    await act(async () => { toggle.click(); await Promise.resolve() })
    const closedItem = face.container.querySelector('[data-testid="yzj-advance-item-A-2"]') as HTMLButtonElement
    expect(closedItem).not.toBeNull()
    await act(async () => { closedItem.click(); await Promise.resolve() })
    await settle()
    expect(face.container.querySelector('[data-testid="yzj-advance-terminal"]')).not.toBeNull()
    act(() => { face.root.unmount() })
  })

  it('立即巡检 writes a patrol ask draft (kind=patrol) and switches to 对话', async () => {
    setWorkbenchDomain('advance')
    const face = mountPane({
      items: [item({ advanceId: 'A-1', stage: 'running', title: '试运行' })],
      detail: { item: item({ advanceId: 'A-1', stage: 'running', title: '试运行' }), entries: [] },
    })
    await settle()
    const patrol = face.container.querySelector('[data-testid="yzj-advance-patrol-now"]') as HTMLButtonElement
    await act(async () => { patrol.click(); await Promise.resolve() })
    expect(getWorkbenchDomain()).toBe('im')
    const draft = getAdvanceAskDraft()
    expect(draft?.kind).toBe('patrol')
    expect(draft?.text).toContain('yzj_advance_scan')
    act(() => { face.root.unmount() })
  })

  it('事元来源区窗口化:默认最近 3 条,可展开/收起', async () => {
    const five = [1, 2, 3, 4, 5].map(i => ({ sourceType: '文档', label: `来源${i}`, ref: `doc${i}`, at: `08-1${i}`, status: '已读取' }))
    const face = mountPane({
      items: [item({ advanceId: 'A-1', stage: 'running', title: '试运行' })],
      detail: { item: item({ advanceId: 'A-1', stage: 'running', title: '试运行' }), entries: [], sources: five },
    })
    await settle()
    const side = face.container.querySelector('[data-testid="yzj-advance-sources"]')!
    expect(side.textContent).not.toContain('来源1')
    expect(side.textContent).toContain('来源5')
    const toggle = side.querySelector('[data-testid="yzj-advance-sources-toggle"]') as HTMLButtonElement
    expect(toggle.textContent).toContain('展开全部 5 条')
    await act(async () => { toggle.click(); await Promise.resolve() })
    expect(side.textContent).toContain('来源1')
    expect(toggle.textContent).toContain('收起')
    act(() => { face.root.unmount() })
  })

  it('Dream 水位行:pending > 0 时显示「池中 N 条待抽取」+ Dream 抽取按钮写 draft (kind=dream)', async () => {
    setWorkbenchDomain('advance')
    const face = mountPane({
      items: [item({ advanceId: 'A-1', stage: 'running', title: '试运行' })],
      detail: { item: item({ advanceId: 'A-1', stage: 'running', title: '试运行' }), entries: [] },
      dream: { pending: 3, lastDreamAt: null },
    })
    await settle()
    const line = face.container.querySelector('[data-testid="yzj-advance-dream-status"]')
    expect(line?.textContent).toContain('池中 3 条待抽取')
    const dreamBtn = face.container.querySelector('[data-testid="yzj-advance-dream-now"]') as HTMLButtonElement
    await act(async () => { dreamBtn.click(); await Promise.resolve() })
    expect(getWorkbenchDomain()).toBe('im')
    const draft = getAdvanceAskDraft()
    expect(draft?.kind).toBe('dream')
    expect(draft?.text).toContain('yzj_advance_dream_status')
    act(() => { face.root.unmount() })
  })

  it('renders subscribed source chips and unlinks via × (registry only)', async () => {
    const face = mountPane({
      items: [item({ advanceId: 'A-1', stage: 'running', title: '试运行' })],
      detail: {
        item: item({ advanceId: 'A-1', stage: 'running', title: '试运行' }),
        entries: [],
        contextSources: [
          { token: 'im:g1', kind: 'persistent', label: 'dsh-2', addedBy: 'agent', addedAt: 1 },
          { token: 'doc:d1', kind: 'document', label: '范围说明', addedBy: 'user', addedAt: 2 },
        ],
      },
    })
    await settle()
    const chips = face.container.querySelector('[data-testid="yzj-advance-sources"]')
    expect(chips?.textContent).toContain('dsh-2')
    expect(chips?.textContent).toContain('范围说明')
    expect(chips?.textContent).toContain('AI 关联')
    expect(chips?.textContent).toContain('你关联')
    const remove = face.container.querySelector('[data-testid="yzj-advance-source-remove-1"]') as HTMLButtonElement
    await act(async () => { remove.click(); await Promise.resolve() })
    await settle()
    expect(face.sourceRemoves).toEqual([{ advanceId: 'A-1', token: 'doc:d1' }])
    act(() => { face.root.unmount() })
  })

  it('shows the empty subscription copy and opens the 关联渠道 modal with the group picker', async () => {
    const face = mountPane({
      items: [item({ advanceId: 'A-1', stage: 'running', title: '试运行' })],
      detail: { item: item({ advanceId: 'A-1', stage: 'running', title: '试运行' }), entries: [] },
      groups: [{ groupId: 'g9', groupName: '项目群' }],
    })
    await settle()
    expect(face.container.textContent).toContain('尚未关联来源')
    const open = face.container.querySelector('[data-testid="yzj-advance-source-add-open"]') as HTMLButtonElement
    await act(async () => { open.click(); await Promise.resolve() })
    await settle()
    expect(face.groupFetches).toBe(1)
    const modal = face.container.querySelector('[data-testid="yzj-advance-source-modal"]')
    expect(modal).not.toBeNull()
    expect(modal?.textContent).toContain('关联即订阅，解除不删事元')
    const groupBtn = face.container.querySelector('[data-testid="yzj-advance-source-group-g9"]') as HTMLButtonElement
    expect(groupBtn.textContent).toContain('项目群')
    await act(async () => { groupBtn.click(); await Promise.resolve() })
    await settle()
    expect(face.sourceAdds).toEqual([{ advanceId: 'A-1', token: 'im:g9', label: '项目群' }])
    expect(face.container.querySelector('[data-testid="yzj-advance-source-modal"]')).toBeNull()
    act(() => { face.root.unmount() })
  })

  it('关联渠道 modal:无手输 token;知识库目录 picker 关联 dir: 线程(决策 32)', async () => {
    const face = mountPane({
      items: [item({ advanceId: 'A-1', stage: 'running', title: '试运行' })],
      detail: { item: item({ advanceId: 'A-1', stage: 'running', title: '试运行' }), entries: [] },
    })
    await settle()
    const open = face.container.querySelector('[data-testid="yzj-advance-source-add-open"]') as HTMLButtonElement
    await act(async () => { open.click(); await Promise.resolve() })
    await settle()
    // 手输 token 已移除(决策 32)
    expect(face.container.querySelector('[data-testid="yzj-advance-thread-token"]')).toBeNull()
    // 目录 picker:整库 + hasChildren 目录;散文档不列
    const dirs = face.container.querySelector('[data-testid="yzj-advance-thread-dirs"]')
    expect(dirs?.textContent).toContain('我的知识（整库）')
    expect(dirs?.textContent).toContain('830实验·共识')
    expect(dirs?.textContent).not.toContain('散文档')
    const dirBtn = face.container.querySelector('[data-testid="yzj-advance-thread-dir-dirA"]') as HTMLButtonElement
    await act(async () => { dirBtn.click(); await Promise.resolve() })
    await settle()
    expect(face.sourceAdds).toEqual([{ advanceId: 'A-1', token: 'dir:dirA', label: '830实验·共识' }])
    act(() => { face.root.unmount() })
  })

  it('decision-needed with 选项N rows renders option buttons; choosing lands confirm_advance with the option note', async () => {
    const decision = entry({
      entryId: 'E-9', changeType: '决策请求', summary: '私有化交付冲击目标日期', tone: 'red',
      detail: '阶段 running→decision-needed\n选项1: 追加资源，目标日期不变\n选项2: 目标日期顺延两周\n影响: 检验标准需同步调整',
    })
    const face = mountPane({
      items: [item({ advanceId: 'A-1', stage: 'decision-needed', title: '要决定' })],
      detail: { item: item({ advanceId: 'A-1', stage: 'decision-needed', title: '要决定' }), entries: [decision] },
    })
    await settle()
    const area = face.container.querySelector('[data-testid="yzj-advance-decision"]')
    expect(area?.textContent).toContain('需要你决定')
    expect(area?.textContent).toContain('影响：检验标准需同步调整')
    const options = face.container.querySelector('[data-testid="yzj-advance-options"]')
    expect(options).not.toBeNull()
    expect(options?.textContent).toContain('选项1：追加资源，目标日期不变')
    // 既有三动词仍在（渲染缺陷不得影响既有确认推进/忽略）
    expect(face.container.querySelector('[data-testid="yzj-advance-judge-confirm_advance"]')).not.toBeNull()
    expect(face.container.querySelector('[data-testid="yzj-advance-judge-ignore"]')).not.toBeNull()
    const option2 = face.container.querySelector('[data-testid="yzj-advance-option-2"]') as HTMLButtonElement
    await act(async () => { option2.click(); await Promise.resolve() })
    await settle()
    expect(face.judged).toEqual([{ advanceId: 'A-1', action: 'confirm_advance', note: '目标日期顺延两周' }])
    act(() => { face.root.unmount() })
  })

  it('decision-needed without 选项N rows keeps the classic verbs only', async () => {
    const decision = entry({ entryId: 'E-9', changeType: '决策请求', summary: '客户要求改范围', tone: 'red', detail: '客户要求改范围' })
    const face = mountPane({
      items: [item({ advanceId: 'A-1', stage: 'decision-needed', title: '要决定' })],
      detail: { item: item({ advanceId: 'A-1', stage: 'decision-needed', title: '要决定' }), entries: [decision] },
    })
    await settle()
    expect(face.container.querySelector('[data-testid="yzj-advance-options"]')).toBeNull()
    const area = face.container.querySelector('[data-testid="yzj-advance-decision"]')
    expect(area?.textContent).toContain('客户要求改范围')
    const confirm = face.container.querySelector('[data-testid="yzj-advance-judge-confirm_advance"]') as HTMLButtonElement
    await act(async () => { confirm.click(); await Promise.resolve() })
    await settle()
    expect(face.judged).toEqual([{ advanceId: 'A-1', action: 'confirm_advance' }])
    act(() => { face.root.unmount() })
  })
})
