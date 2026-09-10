// @vitest-environment jsdom
/**
 * 云之家 settings-section: login + 新建助手 (robot/memory cards retired).
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
    fetchGroups: async () => { count('fetchGroups'); return ok({ list: [{ groupId: 'g1', groupName: '测试群' }], more: false }) },
    robotStatus: async () => { count('robotStatus'); return ok({ channels: [{ sendMsgUrl: 'https://example/webhook', connected: true, cwd: 'C:/x', name: '群机器人' }] }) },
    robotOverrides: async () => { count('robotOverrides'); return ok({ overrides: [] }) },
    robotModels: async () => { count('robotModels'); return ok({ catalog: [{ provider: 'deepseek', models: ['glm-4.7'] }] }) },
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

async function flush(): Promise<void> {
  await act(async () => { await new Promise(resolve => { setTimeout(resolve, 0) }) })
}

describe('YzjSettingsSection', () => {
  it('does not restore robot/memory management cards', async () => {
    const face = mountSection()
    await flush()
    const text = face.container.textContent ?? ''
    expect(text).toContain('新建助手')
    expect(text).not.toContain('记忆库')
    expect(face.calls.robotStatus ?? 0).toBe(0)
    expect(face.calls.memoryScope ?? 0).toBe(0)
  })

  it('renders the CLI login card when auth-status reports logged-out', async () => {
    const face = mountSection({
      authStatus: async () => ({
        ok: true,
        value: { loggedIn: false, name: '', openId: '', reason: 'no app credentials' },
      }),
      authLogin: async () => ({ ok: true, value: { started: true, alreadyRunning: false } }),
    })
    await flush()
    expect(face.container.textContent).toContain('云之家未登录')
    expect(face.container.querySelector('[data-testid="yzj-login-open"]')).not.toBeNull()
  })

  it('lists assistants and creates another via 新建助手', async () => {
    const created: Array<{ name: string; prompt?: string }> = []
    const face = mountSection({
      assistantsList: async () => ({
        ok: true,
        value: { assistants: [{ id: 'default', name: '助手' }, ...created.map((row, i) => ({ id: `a${i}`, name: row.name }))] },
      }),
      assistantsCreate: async (name, prompt) => {
        created.push(prompt === undefined ? { name } : { name, prompt })
        return { ok: true, value: { assistant: { id: 'research', name } } }
      },
    })
    await flush()
    expect(face.container.textContent).toContain('助手')
    expect(face.container.querySelector('[data-testid="yzj-settings-assistants"]')).not.toBeNull()
    const nameInput = face.container.querySelector<HTMLInputElement>('input[aria-label="助手名称"]')
    expect(nameInput).not.toBeNull()
    act(() => {
      if (nameInput === null) return
      const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
      proto?.set?.call(nameInput, '研究助手')
      nameInput.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await flush()
    act(() => {
      face.container.querySelector<HTMLButtonElement>('[data-testid="yzj-create-assistant"]')?.click()
    })
    await flush()
    expect(created).toEqual([{ name: '研究助手' }])
  })
})
