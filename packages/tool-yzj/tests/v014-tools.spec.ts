/**
 * yzj-cli v0.1.4 tool family: command assembly over a fake bridge (no real CLI).
 * Covers the new doc/im tools plus the delete-family `--yes` passthrough the
 * v0.1.4 CLI made mandatory (the product confirmation card already covers it).
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { applyDocTools } from '../src/doc.ts'
import { applyImTools } from '../src/im.ts'
import { applySheetTools } from '../src/sheet.ts'
import { applyCalendarTools } from '../src/calendar.ts'
import type { YzjToolBudget } from '../src/shared.ts'

const BUDGET: YzjToolBudget = { timeoutMs: 30_000, maxRenderChars: 5_000, maxMetaChars: 5_000 }

interface CapturedTool {
  name: string
  execute: (args: Record<string, unknown>) => Promise<{ content: string; truncated: boolean; data: unknown }>
}

/** Fake registry + fake bridge capturing every spawned command. */
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
  applyDocTools(ctx, BUDGET)
  applyImTools(ctx, BUDGET)
  applySheetTools(ctx, BUDGET)
  applyCalendarTools(ctx, BUDGET)
  return { commands, byName: new Map(captured.map(tool => [tool.name, tool])) }
}

describe('yzj-cli v0.1.4 doc tools', () => {
  it('yzj_doc_workspace_create passes enterprise visibility + all-member (v0.1.4)', async () => {
    const { commands, byName } = mount({ id: 'kb9' })
    await byName.get('yzj_doc_workspace_create')!.execute({ name: '团 队库', visibility: 1, allMember: 3 })
    expect(commands[0]).toEqual(['doc', 'workspace', 'create', '--name', '团 队库', '--visibility', '1', '--all-member', '3'])
  })

  it('yzj_doc_search assembles keyword + workspace + paging', async () => {
    const { commands, byName } = mount([{ id: 'd1', title: '测试报告' }])
    const result = await byName.get('yzj_doc_search')!.execute({ keyword: '测试报告', workspace: 'kb1', pageSize: 50, pageNum: 2 })
    expect(commands[0]).toEqual(['doc', 'search', '--keyword', '测试报告', '--workspace', 'kb1', '--page-size', '50', '--page-num', '2'])
    expect(result.content).toContain('测试报告')
  })

  it('yzj_doc_write assembles id + content + mode/format', async () => {
    const { commands, byName } = mount({})
    const result = await byName.get('yzj_doc_write')!.execute({ id: 'd1', content: '# 周报', mode: 'append', format: 'markdown' })
    expect(commands[0]).toEqual(['doc', 'write', '--id', 'd1', '--content', '# 周报', '--mode', 'append', '--format', 'markdown'])
    expect(result.content).toContain('mode=append')
  })

  it('yzj_doc_download passes output and the overwrite flag only when set', async () => {
    const { commands, byName } = mount({})
    await byName.get('yzj_doc_download')!.execute({ id: 'd1', output: '/tmp/a.pdf' })
    await byName.get('yzj_doc_download')!.execute({ id: 'd1', output: '/tmp/a.pdf', overwrite: true })
    expect(commands[0]).toEqual(['doc', 'download', '--id', 'd1', '--output', '/tmp/a.pdf'])
    expect(commands[1]).toEqual(['doc', 'download', '--id', 'd1', '--output', '/tmp/a.pdf', '--overwrite'])
  })

  it('yzj_doc_block_replace assembles the delete range + content JSON', async () => {
    const { commands, byName } = mount({})
    const result = await byName.get('yzj_doc_block_replace')!.execute({ id: 'd1', start: 2, end: 4, content: '[{"type":"paragraph"}]', parentBlockId: 'doc' })
    expect(commands[0]).toEqual(['doc', 'block', 'replace', '--id', 'd1', '--start', '2', '--end', '4', '--content', '[{"type":"paragraph"}]', '--parent-block-id', 'doc'])
    expect(result.content).toContain('[2, 4)')
  })
})

describe('yzj-cli v0.1.4 im group tools', () => {
  it('yzj_im_group_search assembles keyword + paging', async () => {
    const { commands, byName } = mount({ list: [{ groupId: 'g1', groupName: '登顶' }] })
    const result = await byName.get('yzj_im_group_search')!.execute({ keyword: '登顶', limit: 5, page: 2 })
    expect(commands[0]).toEqual(['im', 'group', 'search', '--keyword', '登顶', '--limit', '5', '--page', '2'])
    expect(result.content).toContain('登顶')
  })

  it('yzj_im_group_create repeats --member-open-id and validates the 2-10 window', async () => {
    const { commands, byName } = mount({ groupId: 'g9' })
    const result = await byName.get('yzj_im_group_create')!.execute({ name: '战情室', memberOpenIds: ['u1', 'u2', 'u3'] })
    expect(commands[0]).toEqual(['im', 'group', 'create', '--name', '战情室', '--member-open-id', 'u1', '--member-open-id', 'u2', '--member-open-id', 'u3'])
    expect(result.content).toContain('g9')
    await expect(byName.get('yzj_im_group_create')!.execute({ memberOpenIds: ['u1'] })).rejects.toThrow('2-10')
  })

  it('yzj_im_group_members_add repeats --open-id; remove also appends --yes', async () => {
    const { commands, byName } = mount({})
    await byName.get('yzj_im_group_members_add')!.execute({ groupId: 'g1', openIds: ['u1', 'u2'] })
    await byName.get('yzj_im_group_members_remove')!.execute({ groupId: 'g1', openIds: ['u1'] })
    expect(commands[0]).toEqual(['im', 'group.members', 'add', '--group-id', 'g1', '--open-id', 'u1', '--open-id', 'u2'])
    expect(commands[1]).toEqual(['im', 'group.members', 'remove', '--group-id', 'g1', '--open-id', 'u1', '--yes'])
    await expect(byName.get('yzj_im_group_members_add')!.execute({ groupId: 'g1', openIds: [] })).rejects.toThrow('1-10')
  })
})

describe('delete family --yes passthrough (v0.1.4 CLI mandate)', () => {
  it('doc/block/sheet/calendar deletes all carry --yes after the product-level strong approval', async () => {
    const { commands, byName } = mount({})
    await byName.get('yzj_doc_delete')!.execute({ id: 'd1' })
    await byName.get('yzj_doc_block_delete')!.execute({ id: 'd1', operations: '[]' })
    await byName.get('yzj_sheet_table_delete')!.execute({ id: 's1', tableId: 2 })
    await byName.get('yzj_sheet_record_delete')!.execute({ id: 's1', tableId: 2, recordIds: 'r1' })
    await byName.get('yzj_calendar_event_delete')!.execute({ id: 'e1' })
    expect(commands[0]).toContain('--yes')
    expect(commands[1]).toContain('--yes')
    expect(commands[2]).toContain('--yes')
    expect(commands[3]).toContain('--yes')
    expect(commands[4]).toContain('--yes')
  })
})
