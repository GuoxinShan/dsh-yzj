/**
 * yzj-cli 0.1.6 tool family: whoami mapping, IM recall/search/rename,
 * doc folder create, sheet --lite, and dual-shape JSON envelopes.
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { applyContactTools } from '../src/contact.ts'
import { applyDocTools } from '../src/doc.ts'
import { applyImTools } from '../src/im.ts'
import { applySheetTools } from '../src/sheet.ts'
import type { YzjToolBudget } from '../src/shared.ts'

const BUDGET: YzjToolBudget = { timeoutMs: 30_000, maxRenderChars: 5_000, maxMetaChars: 5_000 }

interface CapturedTool {
  name: string
  execute: (args: Record<string, unknown>) => Promise<{ content: string; truncated: boolean; data: unknown }>
}

function mount(json: unknown = { list: [] }): { commands: string[][]; byName: Map<string, CapturedTool> } {
  const commands: string[][] = []
  const captured: CapturedTool[] = []
  const ctx = {
    tools: {
      register(def: { name: string; execute: CapturedTool['execute'] }): void {
        captured.push({ name: def.name, execute: def.execute })
      },
    },
    yzjBridge: {
      run: async (command: string[]) => {
        commands.push(command)
        return { ok: true, json }
      },
    },
  } as unknown as Context
  applyContactTools(ctx, BUDGET)
  applyDocTools(ctx, BUDGET)
  applyImTools(ctx, BUDGET)
  applySheetTools(ctx, BUDGET)
  return { commands, byName: new Map(captured.map(tool => [tool.name, tool])) }
}

describe('yzj_whoami maps to the top-level whoami command', () => {
  it('spawns whoami (not contact user get) and digests a wrapped user object', async () => {
    const { commands, byName } = mount({
      success: true,
      identity: { openId: 'u1' },
      data: { name: '老黎', openId: 'u1', department: '研发', tokenStatus: 'ok' },
    })
    const result = await byName.get('yzj_whoami')!.execute({})
    expect(commands[0]).toEqual(['whoami'])
    expect(result.content).toContain('老黎')
    expect(result.content).toContain('token ok')
  })
})

describe('yzj_im_message_recall', () => {
  it('assembles group recall without --yes', async () => {
    const { commands, byName } = mount({ success: true, identity: {}, data: {} })
    const result = await byName.get('yzj_im_message_recall')!.execute({ msgId: 'm1', groupId: 'g1' })
    expect(commands[0]).toEqual(['im', 'message', 'recall', '--msg-id', 'm1', '--group-id', 'g1'])
    expect(commands[0]).not.toContain('--yes')
    expect(result.content).toContain('m1')
  })

  it('assembles DM recall via --to-open-id', async () => {
    const { commands, byName } = mount({})
    await byName.get('yzj_im_message_recall')!.execute({ msgId: 'm1', toOpenId: 'u2' })
    expect(commands[0]).toEqual(['im', 'message', 'recall', '--msg-id', 'm1', '--to-open-id', 'u2'])
  })

  it('rejects missing or dual targets', async () => {
    const { byName } = mount({})
    await expect(byName.get('yzj_im_message_recall')!.execute({ msgId: 'm1' })).rejects.toThrow('exactly one')
    await expect(byName.get('yzj_im_message_recall')!.execute({
      msgId: 'm1', groupId: 'g1', toOpenId: 'u2',
    })).rejects.toThrow('exactly one')
  })
})

describe('yzj_im_message_search', () => {
  const hit = {
    groupId: 'g1',
    groupName: '战情室',
    matchedMessageCount: 1,
    messages: [{ content: '周报已发', fromOpenId: 'u1', sendTime: '2026-09-02 12:00:00.000', msgId: 'm9' }],
  }

  it('assembles keyword + optional filters and digests nested hits', async () => {
    const { commands, byName } = mount({
      success: true,
      data: { list: [hit], more: false },
    })
    const result = await byName.get('yzj_im_message_search')!.execute({
      keyword: '周报',
      groupId: 'g1',
      senderOpenId: 'u1',
      start: '2026-09-01',
      end: '2026-09-02',
      limit: 5,
      page: 2,
    })
    expect(commands[0]).toEqual([
      'im', 'message', 'search', '--keyword', '周报',
      '--group-id', 'g1', '--sender-open-id', 'u1',
      '--start', '2026-09-01', '--end', '2026-09-02',
      '--limit', '5', '--page', '2',
    ])
    expect(result.content).toContain('战情室')
    expect(result.content).toContain('周报已发')
  })

  it('also digests an unwrapped {list} payload', async () => {
    const { byName } = mount({ list: [hit] })
    const result = await byName.get('yzj_im_message_search')!.execute({ keyword: '周报' })
    expect(result.content).toContain('战情室')
  })

  it('rejects keywords shorter than 2 characters', async () => {
    const { byName } = mount({})
    await expect(byName.get('yzj_im_message_search')!.execute({ keyword: '周' })).rejects.toThrow('2')
  })
})

describe('yzj_im_group_rename', () => {
  it('assembles rename without --yes', async () => {
    const { commands, byName } = mount({ success: true, identity: { openId: 'u1' } })
    const result = await byName.get('yzj_im_group_rename')!.execute({ groupId: 'g1', name: '新名' })
    expect(commands[0]).toEqual(['im', 'group', 'rename', '--group-id', 'g1', '--name', '新名'])
    expect(commands[0]).not.toContain('--yes')
    expect(result.content).toContain('新名')
  })

  it('rejects a blank name', async () => {
    const { byName } = mount({})
    await expect(byName.get('yzj_im_group_rename')!.execute({ groupId: 'g1', name: '  ' })).rejects.toThrow('blank')
  })
})

describe('yzj_doc_folder_create', () => {
  it('spawns doc folder create (distinct from doc create)', async () => {
    const { commands, byName } = mount({
      success: true,
      data: { id: 'f1', title: '归档' },
    })
    const result = await byName.get('yzj_doc_folder_create')!.execute({
      workspace: 'kb1', title: '归档', parentId: 'n0',
    })
    expect(commands[0]).toEqual([
      'doc', 'folder', 'create', '--workspace', 'kb1', '--title', '归档', '--parent-id', 'n0',
    ])
    expect(result.content).toContain('归档')
    expect(result.content).toContain('f1')
  })
})

describe('yzj_sheet_get --lite', () => {
  it('passes --lite only when requested', async () => {
    const { commands, byName } = mount({ sheets: [] })
    await byName.get('yzj_sheet_get')!.execute({ id: 's1' })
    await byName.get('yzj_sheet_get')!.execute({ id: 's1', lite: true })
    expect(commands[0]).toEqual(['sheet', 'get', '--id', 's1'])
    expect(commands[1]).toEqual(['sheet', 'get', '--id', 's1', '--lite'])
  })
})

describe('0.1.6 envelope vs 0.1.4 unwrapped lists', () => {
  it('yzj_im_group_search digests both shapes', async () => {
    const wrapped = mount({
      success: true,
      data: { list: [{ groupId: 'g1', groupName: '测试群' }] },
    })
    const bare = mount({ list: [{ groupId: 'g1', groupName: '测试群' }] })
    const a = await wrapped.byName.get('yzj_im_group_search')!.execute({ keyword: '测试' })
    const b = await bare.byName.get('yzj_im_group_search')!.execute({ keyword: '测试' })
    expect(a.content).toContain('测试群')
    expect(b.content).toContain('测试群')
  })
})
