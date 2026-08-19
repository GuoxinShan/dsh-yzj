// @vitest-environment jsdom
/**
 * AdvanceFeedPicker: pick an open item + one sentence, then user-direct feed.
 */
import { act } from 'react-dom/test-utils'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { AdvanceFeedPicker } from '../src/client/advance-feed-picker.tsx'
import { setAdvanceFeedback } from '../src/client/advance-feedback.ts'

type Rpc = { ok: true; value: unknown } | { ok: false; error: { message: string } }

interface Face {
  container: HTMLDivElement
  root: Root
  submitted: { advanceId: string; summary: string }[]
}

function mountPicker(config: {
  items?: Record<string, unknown>[]
  ready?: boolean
  presetId?: string
  defaultSummary?: string
  fail?: string
}): Face {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const submitted: Face['submitted'] = []
  const items = config.items ?? [
    { advanceId: 'A-1', title: '试运行', stage: 'running', latest: 'AI 正在跟进' },
    { advanceId: 'A-2', title: '验收', stage: 'ready-for-review', latest: '' },
  ]
  act(() => {
    root.render(
      <AdvanceFeedPicker
        advanceState={async () => ({
          ok: true,
          value: { ready: config.ready !== false, items },
        }) as Rpc}
        {...(config.presetId === undefined ? {} : { presetId: config.presetId })}
        defaultSummary={config.defaultSummary ?? '群里一句'}
        onClose={() => undefined}
        onSubmit={async (advanceId, summary) => {
          if (config.fail !== undefined) return { ok: false, error: { message: config.fail } }
          submitted.push({ advanceId, summary })
          return { ok: true }
        }}
      />,
    )
  })
  return { container, root, submitted }
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('AdvanceFeedPicker', () => {
  afterEach(() => {
    setAdvanceFeedback(null)
  })

  it('lists items and submits the selected id plus the sentence', async () => {
    const face = mountPicker({})
    await flush()
    expect(face.container.querySelector('[data-testid="yzj-advance-feed-picker"]')).not.toBeNull()
    expect(face.container.textContent).toContain('试运行')
    expect(face.container.textContent).toContain('不改阶段')
    const submit = face.container.querySelector('[data-testid="yzj-advance-feed-submit"]') as HTMLButtonElement
    await act(async () => { submit.click(); await Promise.resolve() })
    await flush()
    expect(face.submitted).toEqual([{ advanceId: 'A-1', summary: '群里一句' }])
    act(() => { face.root.unmount() })
  })

  it('pre-selects presetId when that item is in the list', async () => {
    const face = mountPicker({ presetId: 'A-2' })
    await flush()
    const radios = [...face.container.querySelectorAll('input[type="radio"]')] as HTMLInputElement[]
    const checked = radios.find(radio => radio.checked)
    expect(checked?.parentElement?.textContent).toContain('验收')
    const submit = face.container.querySelector('[data-testid="yzj-advance-feed-submit"]') as HTMLButtonElement
    await act(async () => { submit.click(); await Promise.resolve() })
    await flush()
    expect(face.submitted[0]?.advanceId).toBe('A-2')
    act(() => { face.root.unmount() })
  })

  it('blocks empty summary and empty board, surfaces submit errors', async () => {
    const empty = mountPicker({ items: [], defaultSummary: '' })
    await flush()
    expect(empty.container.textContent).toContain('还没有推进事项')
    expect((empty.container.querySelector('[data-testid="yzj-advance-feed-submit"]') as HTMLButtonElement).disabled).toBe(true)
    act(() => { empty.root.unmount() })

    const unready = mountPicker({ items: [], ready: false, defaultSummary: '' })
    await flush()
    expect(unready.container.textContent).toContain('推进看板还没有开通')
    act(() => { unready.root.unmount() })

    const face = mountPicker({ defaultSummary: '', fail: '库未开通' })
    await flush()
    const submit = face.container.querySelector('[data-testid="yzj-advance-feed-submit"]') as HTMLButtonElement
    await act(async () => { submit.click(); await Promise.resolve() })
    expect(face.container.textContent).toContain('写一句要喂进去的话')
    const area = face.container.querySelector('[data-testid="yzj-advance-feed-summary"]') as HTMLTextAreaElement
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!
      setter.call(area, '口头一句')
      area.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => { submit.click(); await Promise.resolve() })
    await flush()
    expect(face.container.textContent).toContain('库未开通')
    expect(face.submitted).toEqual([])
    act(() => { face.root.unmount() })
  })
})
