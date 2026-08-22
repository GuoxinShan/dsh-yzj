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
import { consumeTopicOpen, getWorkbenchDomain, setWorkbenchDomain, subscribeImGroupFocus, type ImFocusTarget } from '../src/client/workbench-domain.ts'

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
  patrols: { at: number }[]
  dreamRuns: number
  focused: string[]
  groupFetches: number
  feeds: { advanceId: string; summary: string; sourceType?: string; refs?: string[] }[]
  actionRuns: { advanceId: string; actionKey: string; kind: string; text: string; fields?: Record<string, string>; imGroupId?: string; imGroupLabel?: string }[]
}

function mountPane(config: {
  ready?: boolean
  items?: Record<string, unknown>[]
  detail?: { item: Record<string, unknown>; entries: Record<string, unknown>[]; entryTotal?: number; sources?: Record<string, unknown>[]; contextSources?: Record<string, unknown>[] }
  scan?: { scannedAt: number | null; found: number }
  dream?: { pending: number; lastDreamAt: number | null; entries?: { id: string; channel: string; refId: string; content: string; sendTime: string }[] }
  groups?: Record<string, unknown>[]
  /** Tokens the ref-lookup mock should NOT resolve (miss-fallback specs). */
  lookupMiss?: string[]
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
  const patrols: { at: number }[] = []
  const dreamRuns = { count: 0 }
  const focused: string[] = []
  const groupState = { fetches: 0 }
  const feeds: { advanceId: string; summary: string; sourceType?: string; refs?: string[] }[] = []
  const actionRuns: { advanceId: string; actionKey: string; kind: string; text: string; fields?: Record<string, string>; imGroupId?: string; imGroupLabel?: string }[] = []
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
      advancePatrolNow: async () => {
        patrols.push({ at: Date.now() })
        return { ok: true, value: { scannedAt: Date.now(), found: 0 } } as Rpc
      },
      advanceScanState: async () => ({
        ok: true,
        value: config.scan ?? { scannedAt: null, found: 0 },
      }) as Rpc,
      advanceDreamState: async () => ({
        ok: true,
        value: config.dream ?? { pending: 0, lastDreamAt: null, entries: [] },
      }) as Rpc,
      advanceDreamRun: async () => {
        dreamRuns.count += 1
        return { ok: true, value: { sessionId: 'yzj-dream-20260820-120000' } } as Rpc
      },
      advanceRefLookup: async (refs: { token: string; kind: string }[]) => {
        const miss = new Set(config.lookupMiss ?? [])
        const hits = refs.filter(ref => !miss.has(ref.token)).map(ref => ref.kind === 'doc'
          ? { token: ref.token, kind: 'doc', fromName: '', content: '830纪要·0806 AI参谋产品方案讨论.otl', sentAt: 0 }
          : { token: ref.token, kind: 'msg', fromName: '老黎', content: '覆盖率到 80，还差最后一步', sentAt: 1_755_600_000_000, ...(ref.token.startsWith('dp-') ? { jumpToken: 'im:g1:m-dp' } : {}) })
        return { ok: true, value: { hits } } as Rpc
      },
      focusBoundSession: (sessionId: string) => { focused.push(sessionId) },
      advanceFeed: async (input: { advanceId: string; summary: string; sourceType?: string; detail?: string; refs?: string[] }) => {
        feeds.push(input)
        // 落库即时间线（决策 49 推荐忽略/确认事元随之被折叠到）
        config.detail?.entries.push(entry({
          entryId: `E-feed-${feeds.length}`, changeType: '备注', summary: input.summary, actor: 'user',
          detail: input.detail ?? '',
        }))
        return { ok: true, value: { advanceId: input.advanceId, stage: 'running' } } as Rpc
      },
      advanceActionRun: async (input: { advanceId: string; actionKey: string; kind: string; text: string; fields?: Record<string, string>; imGroupId?: string; imGroupLabel?: string }) => {
        actionRuns.push(input)
        // 模拟 host 落执行事元（决策 45）：refreshDetail 后 foldDoneActions 折叠出已执行态
        const detail = config.detail
        if (detail !== undefined) {
          const label = input.kind === 'todo'
            ? `执行建议动作：建待办「${input.text}」`
            : input.kind === 'im'
              ? '执行建议动作：发消息到「830 项目」对齐'
              : `执行建议动作：定会议「${input.fields?.['主题'] ?? input.text}」（已跳日程域，建成后经订阅回流）`
          detail.entries.push(entry({
            entryId: `E-run-${actionRuns.length}`, changeType: '进度更新', summary: label, actor: 'user',
            detail: `动作序: ${input.actionKey} | 种类: ${input.kind} | 文本: ${input.text}`,
          }))
        }
        return { ok: true, value: { idempotent: false, effectRef: 'T-NEW', warnings: [] } } as Rpc
      },
      homeNav: async () => ({
        ok: true,
        value: {
          rooms: [{
            groupId: 'g1', sessionId: 'yzj-home-g1', groupName: '830 项目', yzjKind: 'group',
            topics: [{ sessionId: 't-old', title: '旧话题', lastActivity: 1 }, { sessionId: 't-latest', title: '最新话题', lastActivity: 2 }],
          }],
        },
      }) as Rpc,
      advanceSourceAdd: async (advanceId, token, label) => {
        if (!/^(im|doc|todo|event|file|dir):[A-Za-z0-9_-]+$/.test(token)) {
          return { ok: false, error: { message: `advance-source-add failed: 非法来源 token「${token}」` } } as Rpc
        }
        sourceAdds.push({ advanceId, token, ...(label === undefined ? {} : { label }) })
        // 挂上后订阅集即变（决策 49 推荐 chip 随之消失）
        config.detail?.contextSources?.push({ token, kind: 'persistent', label: label ?? token, addedBy: 'user', addedAt: Date.now() })
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
        value: [
          { id: 'kb2', name: 'AI速记知识库' },
          { id: 'kb1', name: '我的知识' },
        ],
      }) as Rpc,
      fetchDocs: async (workspace: string) => ({
        ok: true,
        value: workspace === 'kb1'
          ? [
            { id: 'dirA', title: '830实验·共识', hasChildren: true, type: 2, fileSuffix: 'otl' },
            { id: 'docB', title: '散文档', hasChildren: false, type: 2, fileSuffix: 'otl' },
          ]
          : [
            { id: 'dirC', title: 'AI推进业务设计启动会纪要-总结', hasChildren: true, type: 2, fileSuffix: 'otl' },
          ],
      }) as Rpc,
    },
  }
  act(() => {
    root.render(<YzjAdvancePane {...props} />)
  })
  return {
    container, root, judged, created, ensured, getRequests, sourceAdds, sourceRemoves, patrols,
    feeds, actionRuns,
    get dreamRuns() { return dreamRuns.count },
    focused,
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

/** Expand one timeline entry (收敛默认:点开进度行才见 detail/refs;倒序后 index 0 = mock 末条)。 */
async function expandEntry(face: Face, index: number): Promise<void> {
  const toggle = face.container.querySelector(`[data-testid="yzj-advance-entry-toggle-${index}"]`) as HTMLButtonElement
  await act(async () => { toggle.click(); await Promise.resolve() })
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

  it('parses 动作 lines into executable actions (决策 41); unrecognized types stay plain', () => {
    const parsed = parseDecisionOptions('两个范围补充要定\n动作: 建待办 | 内容: 确认会议模板排期 | 截止: 2026-08-25 | 负责人: 王剑\n动作: 发消息 | 内容: 范围补充想跟你对齐一下\n动作: 定会议 | 主题: 原型评审二次会 | 时间: 2026-08-22 14:00\n动作: 喝咖啡 | 内容: 不认识\n影响: 最小回路要扩')
    expect(parsed.actions).toEqual([
      { kind: 'todo', text: '确认会议模板排期', fields: { '内容': '确认会议模板排期', '截止': '2026-08-25', '负责人': '王剑' } },
      { kind: 'im', text: '范围补充想跟你对齐一下', fields: { '内容': '范围补充想跟你对齐一下' } },
      { kind: 'event', text: '原型评审二次会', fields: { '主题': '原型评审二次会', '时间': '2026-08-22 14:00' } },
    ])
    expect(parsed.impact).toBe('最小回路要扩')
    expect(parsed.rest).toContain('两个范围补充要定')
    expect(parsed.rest).toContain('动作: 喝咖啡')
    expect(parsed.rest).not.toContain('建待办')
  })

  it('extracts the 综合自 line (决策 43 修正: 单卡综合链)', () => {
    const parsed = parseDecisionOptions('综合最新上下文后的判断\n综合自: E-20260821-007（旧问题并入本卡）\n动作: 建待办 | 内容: 确认排期')
    expect(parsed.mergedFrom).toBe('E-20260821-007')
    expect(parsed.actions).toHaveLength(1)
    expect(parsed.rest).not.toContain('综合自')
    expect(parsed.rest).toContain('综合最新上下文后的判断')
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
    // 决策 39 后续:扁平的原始信息聚合列已删 — 原始信息只挂在事元下(三层树),
    // 侧栏只剩订阅管理;sideNote 保留产品哲学脚注。
    expect(sources?.textContent).toContain('上下文来源')
    expect(sources?.textContent).not.toContain('未达标')
    expect(sources?.textContent).toContain('AI 推进不建立新的文件库')
    expect(face.container.querySelector('[data-testid="yzj-advance-sources-toggle"]')).toBeNull()
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
          { entryId: 'E-2', at: '2026/08/19 18:28', sourceType: '对话', changeType: '进度更新', summary: '群信号', detail: '', refs: ['msg-prd'], actor: 'agent' },
        ],
      },
    })
    await settle()
    // 三层树(决策 39 后续):原始信息默认挂在事元行下,无需展开
    // 收敛默认:展开两条事元才见 refs(倒序后 index 0=E-2 msg、1=E-1 doc)
    await expandEntry(face, 0)
    await expandEntry(face, 1)
    const docChip = face.container.querySelector('[data-testid="yzj-advance-ref-6a85774aecd3fb103b859f8a"]') as HTMLAnchorElement
    expect(docChip.tagName).toBe('A')
    expect(docChip.href).toContain('/store/doc/6a85774aecd3fb103b859f8a')
    const msgChip = face.container.querySelector('[data-testid="yzj-advance-ref-msg-prd"]') as HTMLButtonElement
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

  it('立即巡检 = host 机械 patrol RPC（v1.8 收敛：无模型、不切域、不写 ask）', async () => {
    setWorkbenchDomain('advance')
    const face = mountPane({
      items: [item({ advanceId: 'A-1', stage: 'running', title: '试运行' })],
      detail: { item: item({ advanceId: 'A-1', stage: 'running', title: '试运行' }), entries: [] },
    })
    await settle()
    const patrol = face.container.querySelector('[data-testid="yzj-advance-patrol-now"]') as HTMLButtonElement
    await act(async () => { patrol.click(); await Promise.resolve() })
    await settle()
    expect(face.patrols).toHaveLength(1)
    expect(getWorkbenchDomain()).toBe('advance')
    expect(getAdvanceAskDraft()).toBeNull()
    act(() => { face.root.unmount() })
  })

  it('扁平原始信息列已收(决策 39 后续):侧栏只留订阅管理,聚合不再呈现', async () => {
    const five = [1, 2, 3, 4, 5].map(i => ({ sourceType: '文档', label: `来源${i}`, ref: `doc${i}`, at: `08-1${i}`, status: '已读取' }))
    const face = mountPane({
      items: [item({ advanceId: 'A-1', stage: 'running', title: '试运行' })],
      detail: { item: item({ advanceId: 'A-1', stage: 'running', title: '试运行' }), entries: [], sources: five },
    })
    await settle()
    const side = face.container.querySelector('[data-testid="yzj-advance-sources"]')!
    expect(side.textContent).not.toContain('来源1')
    expect(side.textContent).not.toContain('来源5')
    expect(side.querySelector('[data-testid="yzj-advance-sources-toggle"]')).toBeNull()
    act(() => { face.root.unmount() })
  })

  it('Dream 水位行:点「Dream 抽取」走 advance-dream-run 并聚焦新会话(决策 38),不再写 askDraft', async () => {
    setWorkbenchDomain('advance')
    const face = mountPane({
      items: [item({ advanceId: 'A-1', stage: 'running', title: '试运行' })],
      detail: { item: item({ advanceId: 'A-1', stage: 'running', title: '试运行' }), entries: [] },
      dream: {
        pending: 3,
        lastDreamAt: null,
        entries: [
          { id: 'p1', channel: 'im:g1', refId: 'm1', content: '覆盖率到 80', sendTime: '2026/08/20 10:00' },
          { id: 'p2', channel: 'dir:d1', refId: 'doc2', content: '更新文档《范围》', sendTime: '2026/08/20 10:05' },
        ],
      },
    })
    await settle()
    const line = face.container.querySelector('[data-testid="yzj-advance-dream-status"]')
    expect(line?.textContent).toContain('池中 3 条待抽取')
    const dreamBtn = face.container.querySelector('[data-testid="yzj-advance-dream-now"]') as HTMLButtonElement
    await act(async () => { dreamBtn.click(); await Promise.resolve() })
    await settle()
    expect(face.dreamRuns).toBe(1)
    expect(face.focused).toEqual(['yzj-dream-20260820-120000'])
    // 决策 38:不再经 askDraft 预备,也不切域
    expect(getAdvanceAskDraft()).toBeNull()
    expect(getWorkbenchDomain()).toBe('advance')
    act(() => { face.root.unmount() })
  })

  it('蓄水池查看:点「池 N」列出 pending 明细(决策 38)', async () => {
    const face = mountPane({
      items: [item({ advanceId: 'A-1', stage: 'running', title: '试运行' })],
      detail: { item: item({ advanceId: 'A-1', stage: 'running', title: '试运行' }), entries: [] },
      dream: {
        pending: 2,
        lastDreamAt: null,
        entries: [
          { id: 'p1', channel: 'im:g1', refId: 'm1', content: '覆盖率到 80', sendTime: '2026/08/20 10:00' },
          { id: 'p2', channel: 'dir:d1', refId: 'doc2', content: '更新文档《范围》', sendTime: '2026/08/20 10:05' },
        ],
      },
    })
    await settle()
    const poolBtn = face.container.querySelector('[data-testid="yzj-advance-dream-pool"]') as HTMLButtonElement
    expect(poolBtn.textContent).toContain('池 2')
    await act(async () => { poolBtn.click(); await Promise.resolve() })
    const modal = face.container.querySelector('[data-testid="yzj-advance-dream-modal"]')
    expect(modal).not.toBeNull()
    expect(modal?.textContent).toContain('待抽取 2 条')
    expect(modal?.textContent).toContain('覆盖率到 80')
    expect(modal?.textContent).toContain('更新文档《范围》')
    expect(modal?.textContent).toContain('im:g1')
    act(() => { face.root.unmount() })
  })

  it('事元 msg ref 带渠道 token:展开点原始信息直达群并定位那条消息(决策 39)', async () => {
    setWorkbenchDomain('advance')
    const focused: ImFocusTarget[] = []
    const dispose = subscribeImGroupFocus(target => { focused.push(target) })
    const face = mountPane({
      items: [item({ advanceId: 'A-1', stage: 'running', title: '试运行' })],
      detail: {
        item: item({ advanceId: 'A-1', stage: 'running', title: '试运行' }),
        entries: [entry({ entryId: 'E-1', sourceType: '对话', changeType: '进度更新', summary: '覆盖率推进到 80', refs: ['im:g1:m9'] })],
      },
    })
    await settle()
    await expandEntry(face, 0)
    const jump = face.container.querySelector('[data-testid="yzj-advance-ref-im:g1:m9"]') as HTMLButtonElement
    expect(jump).not.toBeNull()
    await act(async () => { jump.click(); await Promise.resolve() })
    expect(focused).toEqual([{ groupId: 'g1', anchorMsgId: 'm9' }])
    expect(getWorkbenchDomain()).toBe('im')
    dispose()
    act(() => { face.root.unmount() })
  })

  it('事元 msg ref 裸 msgId(legacy):回退订阅渠道猜群不带锚点', async () => {
    setWorkbenchDomain('advance')
    const focused: ImFocusTarget[] = []
    const dispose = subscribeImGroupFocus(target => { focused.push(target) })
    const face = mountPane({
      items: [item({ advanceId: 'A-1', stage: 'running', title: '试运行' })],
      detail: {
        item: item({ advanceId: 'A-1', stage: 'running', title: '试运行' }),
        entries: [entry({ entryId: 'E-1', sourceType: '对话', changeType: '备注', summary: '旧信号', refs: ['m-legacy'] })],
        contextSources: [{ token: 'im:g2', kind: 'persistent', label: 'dsh-2', addedBy: 'user', addedAt: 1 }],
      },
    })
    await settle()
    await expandEntry(face, 0)
    const jump = face.container.querySelector('[data-testid="yzj-advance-ref-m-legacy"]') as HTMLButtonElement
    await act(async () => { jump.click(); await Promise.resolve() })
    expect(focused).toEqual([{ groupId: 'g2' }])
    dispose()
    act(() => { face.root.unmount() })
  })

  it('事元展开的 msg ref 渲染为可读事件行(决策 39 后续):谁/何时/说了什么,点击仍定位消息', async () => {
    setWorkbenchDomain('advance')
    const focused: ImFocusTarget[] = []
    const dispose = subscribeImGroupFocus(target => { focused.push(target) })
    const face = mountPane({
      items: [item({ advanceId: 'A-1', stage: 'running', title: '试运行' })],
      detail: {
        item: item({ advanceId: 'A-1', stage: 'running', title: '试运行' }),
        entries: [entry({
          entryId: 'E-1',
          at: '2026/08/20 16:00',
          sourceType: '对话',
          changeType: '进度更新',
          summary: '覆盖率推进到 80',
          refs: ['im:g1:m9'],
        })],
      },
    })
    await settle()
    await expandEntry(face, 0)
    const eventRow = face.container.querySelector('[data-testid="yzj-advance-ref-im:g1:m9"]')
    expect(eventRow).not.toBeNull()
    expect(eventRow?.textContent).toContain('老黎')
    expect(eventRow?.textContent).toContain('覆盖率到 80')
    await act(async () => { (eventRow as HTMLButtonElement).click(); await Promise.resolve() })
    expect(focused).toEqual([{ groupId: 'g1', anchorMsgId: 'm9' }])
    dispose()
    act(() => { face.root.unmount() })
  })

  it('会议来源的 im: ref 按 token 判 msg(视觉走查 08-21):渲染消息事件行而非「文 im:」文档 chip', async () => {
    setWorkbenchDomain('advance')
    const focused: ImFocusTarget[] = []
    const dispose = subscribeImGroupFocus(target => { focused.push(target) })
    const face = mountPane({
      items: [item({ advanceId: 'A-1', stage: 'running', title: '试运行' })],
      detail: {
        item: item({ advanceId: 'A-1', stage: 'running', title: '试运行' }),
        entries: [entry({ entryId: 'E-1', sourceType: '会议', changeType: '偏差', summary: '讨论会共识', refs: ['im:g1:m9'] })],
      },
    })
    await settle()
    await expandEntry(face, 0)
    const row = face.container.querySelector('[data-testid="yzj-advance-ref-im:g1:m9"]')
    expect(row).not.toBeNull()
    // kind=msg:命中渲染事件行,不再是「文 im:6a605…」式的截断 id 文档链接
    expect(row?.textContent).toContain('老黎')
    expect(row?.textContent).not.toContain('im:6a')
    await act(async () => { (row as HTMLButtonElement).click(); await Promise.resolve() })
    expect(focused).toEqual([{ groupId: 'g1', anchorMsgId: 'm9' }])
    // 出处脚注按 refs 载体:显示「记录自 群消息」,不是 agent 自述的「会议」(视觉走查 08-21)
    expect(face.container.textContent).toContain('记录自 群消息')
    expect(face.container.textContent).not.toContain('记录自 会议')
    dispose()
    act(() => { face.root.unmount() })
  })

  it('doc 类原始信息可读化:事元下显示文档名而非截断 ID(决策 39 后续)', async () => {
    const face = mountPane({
      items: [item({ advanceId: 'A-1', stage: 'running', title: '试运行' })],
      detail: {
        item: item({ advanceId: 'A-1', stage: 'running', title: '试运行' }),
        entries: [entry({
          entryId: 'E-1',
          at: '2026/08/19 18:11',
          sourceType: '文档',
          changeType: '进度更新',
          summary: '阶段共识',
          refs: ['6a85774aecd3fb103b859f8a'],
        })],
      },
    })
    await settle()
    await expandEntry(face, 0)
    const docRow = face.container.querySelector('[data-testid="yzj-advance-ref-6a85774aecd3fb103b859f8a"]') as HTMLAnchorElement
    expect(docRow).not.toBeNull()
    expect(docRow.tagName).toBe('A')
    expect(docRow.textContent).toContain('830纪要·0806 AI参谋产品方案讨论.otl')
    expect(docRow.getAttribute('href')).toContain('/store/doc/6a85774aecd3fb103b859f8a')
    act(() => { face.root.unmount() })
  })

  it('裸 msgId ref 命中后渲染事件行不露裸 id(视觉走查 08-21)', async () => {
    const face = mountPane({
      items: [item({ advanceId: 'A-1', stage: 'running', title: '试运行' })],
      detail: {
        item: item({ advanceId: 'A-1', stage: 'running', title: '试运行' }),
        entries: [entry({ entryId: 'E-1', sourceType: '对话', changeType: '进度更新', summary: '群信号', refs: ['msg-prd'] })],
      },
    })
    await settle()
    await expandEntry(face, 0)
    const row = face.container.querySelector('[data-testid="yzj-advance-ref-msg-prd"]')
    expect(row).not.toBeNull()
    expect(row?.textContent).toContain('老黎')
    expect(row?.textContent).not.toContain('6a842792')
    act(() => { face.root.unmount() })
  })

  it('dp-* 池 ref 渲染事件行并按 jumpToken 锚点定位(视觉走查 08-21)', async () => {
    setWorkbenchDomain('advance')
    const focused: ImFocusTarget[] = []
    const dispose = subscribeImGroupFocus(target => { focused.push(target) })
    const face = mountPane({
      items: [item({ advanceId: 'A-1', stage: 'running', title: '试运行' })],
      detail: {
        item: item({ advanceId: 'A-1', stage: 'running', title: '试运行' }),
        entries: [entry({ entryId: 'E-1', sourceType: '智能', changeType: '进度更新', summary: 'Dream 抽取', refs: ['dp-1787190275985-3'] })],
      },
    })
    await settle()
    await expandEntry(face, 0)
    const row = face.container.querySelector('[data-testid="yzj-advance-ref-dp-1787190275985-3"]')
    expect(row).not.toBeNull()
    expect(row?.textContent).toContain('老黎')
    await act(async () => { (row as HTMLButtonElement).click(); await Promise.resolve() })
    expect(focused).toEqual([{ groupId: 'g1', anchorMsgId: 'm-dp' }])
    dispose()
    act(() => { face.root.unmount() })
  })

  it('msg ref 未命中降级「聊 群消息」不露裸 id', async () => {
    const face = mountPane({
      items: [item({ advanceId: 'A-1', stage: 'running', title: '试运行' })],
      detail: {
        item: item({ advanceId: 'A-1', stage: 'running', title: '试运行' }),
        entries: [entry({ entryId: 'E-1', sourceType: '对话', changeType: '备注', summary: '旧信号', refs: ['m-gone'] })],
      },
      lookupMiss: ['m-gone'],
    })
    await settle()
    await expandEntry(face, 0)
    const chip = face.container.querySelector('[data-testid="yzj-advance-ref-m-gone"]')
    expect(chip?.textContent).toBe('聊 群消息')
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

  it('shows the empty subscription copy and opens the 关联来源 modal with the group picker', async () => {
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

  it('关联来源 modal:无手输 token;知识库目录 picker 列出全部个人库并关联 dir: 来源(决策 40)', async () => {
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
    // 知识库 picker 只列整库(决策 40,08-21 二拍「就整库就好了」):一层目录/文档节点不再列出
    const dirs = face.container.querySelector('[data-testid="yzj-advance-source-dirs"]')
    expect(dirs?.textContent).toContain('我的知识（整库）')
    expect(dirs?.textContent).toContain('AI速记知识库（整库）')
    expect(dirs?.textContent).not.toContain('830实验·共识')
    expect(dirs?.textContent).not.toContain('散文档')
    const dirBtn = face.container.querySelector('[data-testid="yzj-advance-source-dir-kb1"]') as HTMLButtonElement
    await act(async () => { dirBtn.click(); await Promise.resolve() })
    await settle()
    expect(face.sourceAdds).toEqual([{ advanceId: 'A-1', token: 'dir:kb1', label: '我的知识（整库）' }])
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

  it('动作型建议卡(决策 41):建待办直执+留痕,发消息就地草稿框投递,定会议跳日程', async () => {
    setWorkbenchDomain('advance')
    const decision = entry({
      entryId: 'E-9', changeType: '决策请求', summary: '两个范围补充是否纳入最小回路', tone: 'red',
      detail: '评审浮现两个范围补充\n动作: 建待办 | 内容: 确认会议模板排期 | 截止: 2026-08-25 | 负责人: 王剑\n动作: 发消息 | 内容: 范围补充想跟你对齐一下\n动作: 定会议 | 主题: 原型评审二次会 | 时间: 2026-08-22 14:00',
    })
    const face = mountPane({
      items: [item({ advanceId: 'A-1', stage: 'decision-needed', title: '要决定' })],
      detail: {
        item: item({ advanceId: 'A-1', stage: 'decision-needed', title: '要决定' }),
        entries: [decision],
        contextSources: [{ token: 'im:g1', kind: 'persistent', label: '830 项目', addedBy: 'user', addedAt: 1 }],
      },
    })
    await settle()
    const actions = face.container.querySelector('[data-testid="yzj-advance-actions"]')
    expect(actions?.textContent).toContain('建待办：确认会议模板排期')
    expect(actions?.textContent).toContain('发消息：范围补充想跟你对齐一下')
    expect(actions?.textContent).toContain('定会议：原型评审二次会')
    // 建待办:点击 → advanceActionRun(host 编排执行+留痕+订阅) → 折叠置灰
    const todoBtn = face.container.querySelector('[data-testid="yzj-advance-action-0"]') as HTMLButtonElement
    await act(async () => { todoBtn.click(); await Promise.resolve() })
    await settle()
    expect(face.actionRuns[0]).toMatchObject({
      advanceId: 'A-1', actionKey: 'E-9:0', kind: 'todo', text: '确认会议模板排期',
      fields: { 截止: '2026-08-25', 负责人: '王剑' },
    })
    expect((face.container.querySelector('[data-testid="yzj-advance-action-0"]') as HTMLButtonElement).textContent).toContain('已建待办')
    // 发消息:就地草稿框预填,点发送投到恰一订阅群(host 落 refs=im:g:m 留痕)
    const imBtn = face.container.querySelector('[data-testid="yzj-advance-action-1"]') as HTMLButtonElement
    await act(async () => { imBtn.click(); await Promise.resolve() })
    const draft = face.container.querySelector('[data-testid="yzj-advance-action-draft"]') as HTMLTextAreaElement
    expect(draft.value).toBe('范围补充想跟你对齐一下')
    const send = face.container.querySelector('[data-testid="yzj-advance-action-send"]') as HTMLButtonElement
    expect(send.textContent).toContain('830 项目')
    await act(async () => { send.click(); await Promise.resolve() })
    await settle()
    expect(face.actionRuns[1]).toMatchObject({ kind: 'im', text: '范围补充想跟你对齐一下', imGroupId: 'g1', imGroupLabel: '830 项目' })
    // 定会议:留痕 + 跳日程域
    const eventBtn = face.container.querySelector('[data-testid="yzj-advance-action-2"]') as HTMLButtonElement
    await act(async () => { eventBtn.click(); await Promise.resolve() })
    expect(face.actionRuns[2]).toMatchObject({ kind: 'event', text: '原型评审二次会' })
    expect(getWorkbenchDomain()).toBe('calendar')
    setWorkbenchDomain('advance')
    // 有 agent 产动作时写死动词降级为次要行;「回到对话继续聊」预填 discuss 草稿(决策 41)
    expect(face.container.querySelector('[data-testid="yzj-advance-verbs"]')?.className).toContain('verbsSecondary')
    const chat = face.container.querySelector('[data-testid="yzj-advance-decision-chat"]') as HTMLButtonElement
    await act(async () => { chat.click(); await Promise.resolve() })
    await settle()
    const chatDraft = getAdvanceAskDraft()
    expect(chatDraft?.kind).toBe('discuss')
    expect(chatDraft?.text).toContain('两个范围补充是否纳入最小回路')
    expect(chatDraft?.text).toContain('补/更新决策请求')
    expect(getWorkbenchDomain()).toBe('im')
    // 讨论回环:直开订阅群最新话题抽屉(决策 41)
    expect(consumeTopicOpen('g1')?.sessionId).toBe('t-latest')
    act(() => { face.root.unmount() })
  })

  it('执行态从事元流折叠(决策 45)：已有执行事元的动作直接渲染已执行且禁用；综合卡重排后 key 失效以 kind+文本 兼底', async () => {
    setWorkbenchDomain('advance')
    const decision = entry({
      entryId: 'E-10', changeType: '决策请求', summary: '综合卡', tone: 'red',
      detail: '问题\n动作: 建待办 | 内容: 确认会议模板排期 | 截止: 2026-08-25\n动作: 发消息 | 内容: 对齐一下',
    })
    const face = mountPane({
      items: [item({ advanceId: 'A-1', stage: 'decision-needed', title: '要决定' })],
      detail: {
        item: item({ advanceId: 'A-1', stage: 'decision-needed', title: '要决定' }),
        entries: [
          decision,
          // 执行事元的动作序 key 是旧卡 E-9:0（综合卡重排后该动作在新卡 E-10:0）——kind+文本 兼底命中
          entry({ entryId: 'E-run-1', changeType: '进度更新', summary: '执行建议动作：建待办「确认会议模板排期」', actor: 'user', detail: '动作序: E-9:0 | 种类: todo | 文本: 确认会议模板排期' }),
        ],
      },
    })
    await settle()
    const todoBtn = face.container.querySelector('[data-testid="yzj-advance-action-0"]') as HTMLButtonElement
    expect(todoBtn.textContent).toContain('已建待办')
    expect(todoBtn.disabled).toBe(true)
    // 未执行的发消息动作仍可点
    const imBtn = face.container.querySelector('[data-testid="yzj-advance-action-1"]') as HTMLButtonElement
    expect(imBtn.textContent).toContain('发消息：对齐一下')
    expect(imBtn.disabled).toBe(false)
    act(() => { face.root.unmount() })
  })

  it('推荐订阅源(决策 49)：折叠出待确认推荐，挂上后消失，忽略后永不出现', async () => {
    setWorkbenchDomain('advance')
    const recEntry = entry({
      entryId: 'E-r1', changeType: '备注', summary: '推荐订阅来源：新群', actor: 'agent',
      detail: '推荐订阅: im:g-new | 理由: 事元 refs 引用过该渠道但尚未订阅',
    })
    const face = mountPane({
      items: [item({ advanceId: 'A-1', stage: 'running', title: '事项' })],
      detail: {
        item: item({ advanceId: 'A-1', stage: 'running' }),
        entries: [entry({}), recEntry],
        contextSources: [{ token: 'im:g1', kind: 'persistent', label: '830 项目', addedBy: 'user', addedAt: 1 }],
      },
    })
    await settle()
    const recs = face.container.querySelector('[data-testid="yzj-advance-recommendations"]')
    expect(recs?.textContent).toContain('新群')
    expect(recs?.textContent).toContain('推荐订阅')
    // 挂上 → sourceAdd 直写 + chip 消失（订阅集已含）
    const addBtn = face.container.querySelector('[data-testid="yzj-advance-recommend-add-im-g-new"]') as HTMLButtonElement
    await act(async () => { addBtn.click(); await Promise.resolve() })
    await settle()
    expect(face.sourceAdds.map(row => row.token)).toContain('im:g-new')
    expect(face.container.querySelector('[data-testid="yzj-advance-recommendations"]')).toBeNull()
    // 忽略 → 落「推荐忽略」事元 + chip 消失且不再出现
    face.feeds.length = 0
    const detail = face.container.querySelector('[data-testid="yzj-advance-recommendations"]')
    expect(detail).toBeNull()
    // 再造一条推荐（另一个渠道），点 ×
    const feedEntry = entry({
      entryId: 'E-r2', changeType: '备注', summary: '推荐订阅来源：别群', actor: 'agent',
      detail: '推荐订阅: im:g-other | 理由: x',
    })
    // 直接改 mock 的 detail entries 并触发重渲（reread）
    face.root.unmount()
    const face2 = mountPane({
      items: [item({ advanceId: 'A-1', stage: 'running', title: '事项' })],
      detail: {
        item: item({ advanceId: 'A-1', stage: 'running' }),
        entries: [entry({}), recEntry, feedEntry],
        contextSources: [
          { token: 'im:g1', kind: 'persistent', label: '830 项目', addedBy: 'user', addedAt: 1 },
          { token: 'im:g-new', kind: 'persistent', label: '新群', addedBy: 'user', addedAt: 2 },
        ],
      },
    })
    await settle()
    const recs2 = face2.container.querySelector('[data-testid="yzj-advance-recommendations"]')
    expect(recs2?.textContent).not.toContain('新群')  // 已订阅的不推
    expect(recs2?.textContent).toContain('别群')
    const ignoreBtn = face2.container.querySelector('[data-testid="yzj-advance-recommend-ignore-im-g-other"]') as HTMLButtonElement
    await act(async () => { ignoreBtn.click(); await Promise.resolve() })
    await settle()
    expect(face2.feeds.some(row => row.detail === '推荐忽略: im:g-other')).toBe(true)
    expect(face2.container.querySelector('[data-testid="yzj-advance-recommendations"]')).toBeNull()
    act(() => { face2.root.unmount() })
  })

  it('decision-needed 无决策请求事元(决策 41 前存量):兜底摆驱动事元 + 提示,不空区', async () => {
    const drift = entry({ entryId: 'E-8', changeType: '偏差', summary: '评审中浮现两个需决策的范围补充', tone: 'red', detail: '阶段 running→decision-needed' })
    const face = mountPane({
      items: [item({ advanceId: 'A-1', stage: 'decision-needed', title: '要决定' })],
      detail: { item: item({ advanceId: 'A-1', stage: 'decision-needed', title: '要决定' }), entries: [drift] },
    })
    await settle()
    const area = face.container.querySelector('[data-testid="yzj-advance-decision"]')
    expect(area?.textContent).toContain('评审中浮现两个需决策的范围补充')
    expect(area?.textContent).toContain('没有带上建议动作')
    expect(face.container.querySelector('[data-testid="yzj-advance-judge-confirm_advance"]')).not.toBeNull()
    // 兑底卡也有「回到对话继续聊」,且动词不降级(无动态内容)
    expect(face.container.querySelector('[data-testid="yzj-advance-verbs"]')?.className).not.toContain('verbsSecondary')
    const chat = face.container.querySelector('[data-testid="yzj-advance-decision-chat"]') as HTMLButtonElement
    await act(async () => { chat.click(); await Promise.resolve() })
    expect(getAdvanceAskDraft()?.text).toContain('评审中浮现两个需决策的范围补充')
    expect(getWorkbenchDomain()).toBe('im')
    act(() => { face.root.unmount() })
  })

  it('事元「问助手」入口:预填讨论草稿并直开最新话题抽屉(决策 41 讨论回环)', async () => {
    setWorkbenchDomain('advance')
    const face = mountPane({
      items: [item({ advanceId: 'A-1', stage: 'running', title: '试运行' })],
      detail: {
        item: item({ advanceId: 'A-1', stage: 'running', title: '试运行' }),
        entries: [entry({ entryId: 'E-1', at: '2026/08/20 15:58', summary: '产品需求细化', changeType: '进度更新' })],
        contextSources: [{ token: 'im:g1', kind: 'persistent', label: '830 项目', addedBy: 'user', addedAt: 1 }],
      },
    })
    await settle()
    // discuss 按钮在展开的事元出处行里(收敛默认,先展开)
    await expandEntry(face, 0)
    const discuss = face.container.querySelector('[data-testid="yzj-advance-entry-discuss-0"]') as HTMLButtonElement
    expect(discuss).not.toBeNull()
    await act(async () => { discuss.click(); await Promise.resolve() })
    await settle()
    const draftNow = getAdvanceAskDraft()
    expect(draftNow?.kind).toBe('discuss')
    expect(draftNow?.text).toContain('产品需求细化')
    expect(draftNow?.text).toContain('A-1')
    expect(getWorkbenchDomain()).toBe('im')
    // 直开 agent 问答面:latch 指向订阅群的最新话题(transcript 消费后开抽屉,不再停在群时间线)
    const pending = consumeTopicOpen('g1')
    expect(pending?.sessionId).toBe('t-latest')
    act(() => { face.root.unmount() })
  })

  it('事元有产出会话时「问助手」直回产出会话(focusBoundSession),不走话题抽屉(用户拍板 08-21)', async () => {
    setWorkbenchDomain('advance')
    const face = mountPane({
      items: [item({ advanceId: 'A-1', stage: 'running', title: '试运行' })],
      detail: {
        item: item({ advanceId: 'A-1', stage: 'running', title: '试运行' }),
        entries: [entry({ entryId: 'E-1', at: '2026/08/21 15:12', summary: '产品需求细化', changeType: '进度更新', producer: 'yzj-dream-20260821-101500' })],
        contextSources: [{ token: 'im:g1', kind: 'persistent', label: '830 项目', addedBy: 'user', addedAt: 1 }],
      },
    })
    await settle()
    await expandEntry(face, 0)
    const discuss = face.container.querySelector('[data-testid="yzj-advance-entry-discuss-0"]') as HTMLButtonElement
    await act(async () => { discuss.click(); await Promise.resolve() })
    await settle()
    // 聚焦产出会话,不切域、不开话题 latch
    expect(face.focused).toEqual(['yzj-dream-20260821-101500'])
    expect(consumeTopicOpen('g1')).toBeNull()
    expect(getWorkbenchDomain()).toBe('advance')
    act(() => { face.root.unmount() })
  })

  it('单卡决策(决策 43 修正):卡面=最近判定后的最新决策请求;综合卡带「综合自」链', async () => {
    const a = entry({ entryId: 'E-1', changeType: '决策请求', summary: '范围补充要不要纳入', tone: 'red' })
    const judged = entry({ entryId: 'E-2', changeType: '备注', summary: '忽略本次评估，不构成新约束', actor: 'user', judge: 'ignore' })
    const b = entry({ entryId: 'E-3', changeType: '决策请求', summary: '范围补充与新分叉综合版', tone: 'red', detail: '综合最新上下文后的判断\n综合自: E-1（旧问题并入本卡）' })
    const face = mountPane({
      items: [item({ advanceId: 'A-1', stage: 'decision-needed', title: '要决定' })],
      detail: { item: item({ advanceId: 'A-1', stage: 'decision-needed', title: '要决定' }), entries: [a, judged, b] },
    })
    await settle()
    const area = face.container.querySelector('[data-testid="yzj-advance-decision"]')
    expect(area?.textContent).toContain('范围补充与新分叉综合版')
    expect(area?.textContent).toContain('综合了 E-1')
    expect(area?.textContent).not.toContain('范围补充要不要纳入')
    act(() => { face.root.unmount() })
    // 无 judge:最新综合卡同样顶面(旧卡内容必须已被它并入,host 侧强制)
    const face2 = mountPane({
      items: [item({ advanceId: 'A-1', stage: 'decision-needed', title: '要决定' })],
      detail: { item: item({ advanceId: 'A-1', stage: 'decision-needed', title: '要决定' }), entries: [a, b] },
    })
    await settle()
    const area2 = face2.container.querySelector('[data-testid="yzj-advance-decision"]')
    expect(area2?.textContent).toContain('范围补充与新分叉综合版')
    expect(area2?.textContent).not.toContain('排队中')
    act(() => { face2.root.unmount() })
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
