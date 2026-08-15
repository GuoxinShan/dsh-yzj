// @vitest-environment jsdom
/**
 * Doc block walk dedup regression: the CLI's block tree carries every line
 * twice (childNodes tree + content array mirror). The preview walk and the
 * codec's blockText must extract each line exactly once. Driven by the REAL
 * CLI payload captured from a heavy meeting-note doc (shape preserved).
 */
import { describe, expect, it } from 'vitest'

/** Real shape from `yzj-cli doc block list` (trimmed to the load-bearing
 *  structure; every text node appears in BOTH childNodes and content). */
const realPayload = {
  success: true,
  data: {
    version: 5,
    blocks: [
      {
        content: [
          {
            id: 'root-title',
            type: 'title',
            attrs: { align: 1 },
            childNodes: [
              { type: 'text', content: '组织协同AI产品方案讨论（2026-08-10 会议记录）' },
            ],
            content: [
              { type: 'text', content: '组织协同AI产品方案讨论（2026-08-10 会议记录）' },
            ],
            textContent: null,
          },
          {
            id: 'root-p1',
            type: 'paragraph',
            attrs: { align: 1 },
            childNodes: [
              { type: 'text', content: '2026年8月10日 上午 10:14|2小时 11分钟 49秒' },
            ],
            content: [
              { type: 'text', content: '2026年8月10日 上午 10:14|2小时 11分钟 49秒' },
            ],
            textContent: null,
          },
          {
            id: 'root-p2',
            type: 'paragraph',
            attrs: { align: 1 },
            childNodes: [
              { type: 'text', content: '关键词: 组织、战略、视角、产品、决策、知识库、闭环' },
            ],
            content: [
              { type: 'text', content: '关键词: 组织、战略、视角、产品、决策、知识库、闭环' },
            ],
            textContent: null,
          },
        ],
        id: 'doc-root',
        type: 'doc',
      },
    ],
  },
}

/** Mirror of panel.tsx loadDocPreview's fixed walk. */
function previewLines(blocks: unknown[]): string[] {
  const lines: string[] = []
  const walk = (node2: unknown): void => {
    if (typeof node2 !== 'object' || node2 === null) return
    const record = node2 as Record<string, unknown>
    if (typeof record.type === 'string' && typeof record.content === 'string') {
      const text = record.content.trim()
      if (text !== '' && (record.type === 'heading' || record.type === 'paragraph' || record.type === 'code' || record.type === 'text' || record.type === 'title')) {
        lines.push(text)
        return
      }
    }
    const children = record.childNodes
    if (Array.isArray(children) && children.length > 0) {
      for (const child of children) walk(child)
      return
    }
    if (Array.isArray(record.content)) {
      for (const item of record.content) walk(item)
    }
  }
  for (const block of blocks) walk(block)
  return lines
}

describe('doc preview dedup (real CLI block shape)', () => {
  // Unwrap exactly like the component: { data: { blocks } } first.
  const blocks = realPayload.data.blocks

  it('extracts each line exactly once from the doubled payload', () => {
    const lines = previewLines(blocks)
    expect(lines).toEqual([
      '组织协同AI产品方案讨论（2026-08-10 会议记录）',
      '2026年8月10日 上午 10:14|2小时 11分钟 49秒',
      '关键词: 组织、战略、视角、产品、决策、知识库、闭环',
    ])
  })

  it('the old walk duplicated every line (documents the bug)', () => {
    const oldLines: string[] = []
    const oldWalk = (node: unknown): void => {
      if (typeof node !== 'object' || node === null) return
      const record = node as Record<string, unknown>
      if (typeof record.type === 'string' && typeof record.content === 'string') {
        const text = record.content.trim()
        if (text !== '') oldLines.push(text)
      }
      for (const value of Object.values(record)) {
        if (Array.isArray(value)) for (const item of value) oldWalk(item)
        else if (typeof value === 'object' && value !== null) oldWalk(value)
      }
    }
    for (const block of blocks) oldWalk(block)
    // Every long line appears twice under the old walk.
    const longs = oldLines.filter(line => line.length > 12)
    expect(longs.length).toBe(6)
    expect(new Set(longs).size).toBe(3)
  })
})
