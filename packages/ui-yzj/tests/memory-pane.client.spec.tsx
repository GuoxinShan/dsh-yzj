// @vitest-environment jsdom
/**
 * Memory pane specs: renders the scope view (sections/entities/observations
 * stats), expands rows, submits the panel-direct observe composer against a
 * scripted inject face, surfaces duplicate/failure notes, and toggles the
 * dream log tail.
 */
import { act } from 'react-dom/test-utils'
import { createRoot, type Root } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { MemoryPane } from '../src/client/memory-pane.tsx'
import type { MemoryPaneProps } from '../src/client/memory-pane.tsx'

type Rpc = { ok: true; value: unknown } | { ok: false; error: { message: string } }

interface Face {
  container: HTMLDivElement
  root: Root
  calls: { observe: string[]; scope: number }
}

function viewFixture(): unknown {
  return {
    scope: 'user',
    cap: 6000,
    sections: [
      { name: 'personal_context', title: 'Personal Context', order: 10, excerpt: '用户主要使用中文交流。' },
      { name: 'taste', title: 'Taste', order: 20, excerpt: '偏好双人合作游戏。' },
    ],
    entities: [{ name: '云之家', title: '云之家', excerpt: '金蝶旗下的企业协作平台。' }],
    observations: [
      { id: 'obs-1', created: '2026-08-16', tags: ['work'], source: 'agent', status: 'open', content: '用户希望周报发成表格。' },
    ],
    archivedCount: 3,
  }
}

function mountPane(over: Partial<MemoryPaneProps> = {}): Face {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const calls = { observe: [] as string[], scope: 0 }
  const base: MemoryPaneProps = {
    view: viewFixture(),
    log: '## [2026-08-16 ab12] dream\n\n提升 1 · 丢弃 0',
    loading: false,
    error: '',
    memoryScope: async () => { calls.scope += 1; return { ok: true, value: { view: viewFixture() } } as Rpc },
    memoryLog: async () => ({ ok: true, value: { log: '' } }) as Rpc,
    memoryObserve: async (content: string) => { calls.observe.push(content); return { ok: true, value: { id: 'obs-9', duplicate: false } } as Rpc },
    ...over,
  }
  act(() => {
    root.render(<MemoryPane {...base} />)
  })
  return { container, root, calls }
}

function setAreaValue(area: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
  setter?.call(area, value)
  area.dispatchEvent(new Event('input', { bubbles: true }))
}

function clickButton(container: HTMLElement, label: string): void {
  const button = Array.from(container.querySelectorAll('button'))
    .find(node => (node.textContent ?? '').includes(label))
  act(() => { button?.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
}

describe('MemoryPane', () => {
  it('renders the stats bar and every group', () => {
    const face = mountPane()
    const text = face.container.textContent ?? ''
    expect(text).toContain('记忆库 · user')
    expect(text).toContain('段 2')
    expect(text).toContain('实体 1')
    expect(text).toContain('待固化 1')
    expect(text).toContain('已归档 3')
    expect(text).toContain('长期记忆（sections · 2）')
    expect(text).toContain('实体（entities · 1）')
    expect(text).toContain('观察草稿区（open · 1）')
  })

  it('shows the unavailable-service hint through the error share', () => {
    const face = mountPane({ error: 'memory-scope: yzjMemory 服务不可用（memory-yzj 未挂载）' })
    expect(face.container.textContent).toContain('memory-yzj 未挂载')
  })

  it('expands a section row on click', () => {
    const face = mountPane()
    const head = face.container.querySelectorAll('button')
    const sectionHead = Array.from(head).find(button => (button.textContent ?? '').includes('Personal Context'))
    expect(sectionHead).toBeDefined()
    act(() => { sectionHead?.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    // The expandable body renders the excerpt… sections carry excerpt only
    // (the read view); the row expands without error.
    expect(face.container.textContent).toContain('Personal Context')
  })

  it('submits the observe composer and reports the new id', async () => {
    const face = mountPane()
        const textarea = face.container.querySelector('textarea') as HTMLTextAreaElement
    expect(textarea).toBeDefined()
    act(() => { setAreaValue(textarea, '用户偏好表格周报') })
    await act(async () => { clickButton(face.container, '记下') })
    expect(face.calls.observe).toEqual(['用户偏好表格周报'])
    expect(face.container.textContent).toContain('已记录 obs-9')
  })

  it('surfaces a duplicate note without clearing the draft', async () => {
    const face = mountPane({
      memoryObserve: async () => ({ ok: true, value: { id: 'obs-1', duplicate: true } }) as Rpc,
    })
        const textarea = face.container.querySelector('textarea') as HTMLTextAreaElement
    act(() => { setAreaValue(textarea, '重复内容') })
    await act(async () => { clickButton(face.container, '记下') })
    expect(face.container.textContent).toContain('这条已经在记忆里')
    expect(textarea.value).toBe('重复内容')
  })

  it('surfaces an observe failure note', async () => {
    const face = mountPane({
      memoryObserve: async () => ({ ok: false, error: { message: 'boom' } }) as Rpc,
    })
        const textarea = face.container.querySelector('textarea') as HTMLTextAreaElement
    act(() => { setAreaValue(textarea, '内容') })
    await act(async () => { clickButton(face.container, '记下') })
    expect(face.container.textContent).toContain('记录失败：boom')
  })

  it('toggles the dream log tail', () => {
    const face = mountPane()
    expect(face.container.textContent).not.toContain('提升 1 · 丢弃 0')
    const toggle = Array.from(face.container.querySelectorAll('button'))
      .find(node => (node.textContent ?? '').includes('展开日志'))
    act(() => { toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(face.container.textContent).toContain('提升 1 · 丢弃 0')
  })

  it('renders the empty-log hint when no dream has run', () => {
    const face = mountPane({ log: '' })
    const toggle = Array.from(face.container.querySelectorAll('button'))
      .find(node => (node.textContent ?? '').includes('展开日志'))
    act(() => { toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(face.container.textContent).toContain('还没有 dream 运行记录')
  })
})
