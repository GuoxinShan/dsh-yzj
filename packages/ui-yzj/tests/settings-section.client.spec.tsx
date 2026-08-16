// @vitest-environment jsdom
/**
 * 云之家 settings-section specs: the segmented 机器人｜记忆库 control, both
 * panes mounting with self-fetched data, and the wrapper's verb wrappers
 * refreshing local state (so pane-internal refresh paths re-render).
 */
import { act } from 'react-dom/test-utils'
import { createRoot, type Root } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { YzjSettingsSection } from '../src/client/settings-section.tsx'
import type { YzjSettingsSectionProps } from '../src/client/settings-section.tsx'
import type { YzjPanelInject } from '../src/client/rpc.ts'

type Rpc = { ok: true; value: unknown } | { ok: false; error: { message: string } }

/** Minimal fake face: every verb counts its calls and returns fixtures. */
function fakeFace(): { face: YzjPanelInject; calls: Record<string, number> } {
  const calls: Record<string, number> = {}
  const count = (key: string): void => { calls[key] = (calls[key] ?? 0) + 1 }
  const ok = (value: unknown): Rpc => ({ ok: true, value })
  const face = {
    fetchGroups: async (limit?: number, page?: number) => { count('fetchGroups'); return ok({ list: [{ groupId: 'g1', groupName: '测试群' }], more: false }) },
    robotStatus: async () => { count('robotStatus'); return ok({ channels: [{ sendMsgUrl: 'https://example/webhook', connected: true, cwd: 'C:/x', name: '群机器人' }] }) },
    robotOverrides: async () => { count('robotOverrides'); return ok({ overrides: [] }) },
    robotModels: async () => { count('robotModels'); return ok({ catalog: [{ provider: 'deepseek', models: ['glm-4.7'] }] }) },
    memoryScope: async () => { count('memoryScope'); return ok({ view: { scope: 'user', cap: 6000, sections: [{ name: 'work_context', title: 'Work Context', order: 10, excerpt: '正在推进云之家集成。' }], entities: [], observations: [], archivedCount: 0 } }) },
    memoryLog: async () => { count('memoryLog'); return ok({ log: '## dream' }) },
    memoryObserve: async () => { count('memoryObserve'); return ok({ id: 'obs-1', duplicate: false }) },
    dreamState: async () => { count('dreamState'); return ok({ state: { enabled: false } }) },
    dreamSet: async () => { count('dreamSet'); return ok({ state: { enabled: true } }) },
    dreamRun: async () => { count('dreamRun'); return ok({ ok: true, sessionId: 'dream-1', note: '固化完成' }) },
    modelDefault: async () => { count('modelDefault'); return ok({ route: undefined, path: 'x' }) },
    modelSetDefault: async () => { count('modelSetDefault'); return ok({ route: { provider: 'deepseek', model: 'glm-4.7' } }) },
    modelClearDefault: async () => { count('modelClearDefault'); return ok({ route: undefined }) },
    modelCatalog: async () => { count('modelCatalog'); return ok({ catalog: [] }) },
    setRobotOverride: async () => { count('setRobotOverride'); return ok({}) },
    deleteRobotOverride: async () => { count('deleteRobotOverride'); return ok({}) },
    robotShareList: async () => { count('robotShareList'); return ok({ files: [] }) },
    robotShareRead: async () => { count('robotShareRead'); return ok({ content: '' }) },
    robotOpenFolder: async () => { count('robotOpenFolder'); return ok({}) },
    robotShareWrite: async () => { count('robotShareWrite'); return ok({}) },
    robotChannelsSave: async () => { count('robotChannelsSave'); return ok({}) },
  } as unknown as YzjPanelInject
  return { face, calls }
}

interface Face {
  container: HTMLDivElement
  root: Root
  calls: Record<string, number>
}

function mountSection(props: Partial<YzjSettingsSectionProps> = {}): Face {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const fake = fakeFace()
  act(() => {
    root.render(<YzjSettingsSection {...fake.face} {...props} />)
  })
  return { container, root, calls: fake.calls }
}

/** Flush mount-time async loads to completion. */
async function flush(): Promise<void> {
  await act(async () => { await new Promise(resolve => { setTimeout(resolve, 0) }) })
}

function clickButton(container: HTMLElement, label: string): void {
  const button = Array.from(container.querySelectorAll('button'))
    .find(node => (node.textContent ?? '').includes(label))
  act(() => { button?.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
}

describe('YzjSettingsSection', () => {
  it('renders the segmented control and fetches robot + memory on mount', async () => {
    const face = mountSection()
    await flush()
    expect(face.calls.robotStatus).toBeGreaterThanOrEqual(1)
    expect(face.calls.memoryScope).toBeGreaterThanOrEqual(1)
    const text = face.container.textContent ?? ''
    expect(text).toContain('机器人')
    expect(text).toContain('记忆库')
    // Robot pane default: channel count row renders from the status payload.
    expect(text).toContain('机器人（1）')
  })

  it('switches to the memory pane and renders the vault view', async () => {
    const face = mountSection()
    await flush()
    clickButton(face.container, '记忆库')
    const text = face.container.textContent ?? ''
    expect(text).toContain('记忆库 · user')
    expect(text).toContain('段 1')
    expect(text).toContain('Work Context')
  })

  it('wraps the memoryScope verb so pane-internal refreshes re-render', async () => {
    const face = mountSection()
    await flush()
    clickButton(face.container, '记忆库')
    // The pane's 记一条 submit calls the wrapped memoryScope; the wrapper
    // updates local state from the same RPC result (verified via call count
    // and no crash — the re-render path is the same code as on mount).
    const textarea = face.container.querySelector('textarea') as HTMLTextAreaElement
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
    await act(async () => {
      setter?.call(textarea, '新观察')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    clickButton(face.container, '记下')
    await flush()
    expect(face.calls.memoryObserve).toBe(1)
    expect(face.calls.memoryScope).toBeGreaterThanOrEqual(2)
  })
})
