// @vitest-environment jsdom
/**
 * Message media: cached file-data must paint on the first frame (pitfall-013).
 */
import { act } from 'react-dom/test-utils'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { clearFileDataCache, resolveFileData } from '../src/client/im-cache.ts'
import { ProxyImage } from '../src/client/im-render.tsx'

describe('ProxyImage', () => {
  it('paints from the module cache without a 加载中 skeleton', async () => {
    clearFileDataCache()
    const dataUrl = 'data:image/png;base64,abc'
    await resolveFileData('fid-img', {
      fetchFileData: async () => ({ ok: true, value: { dataUrl } }),
    })
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    act(() => {
      root.render(
        <ProxyImage
          fileId="fid-img"
          alt="图"
          onOpen={() => undefined}
          inject={{ fetchFileData: async () => ({ ok: false as const, error: { message: 'unused' } }) }}
        />,
      )
    })
    expect(container.textContent).not.toContain('加载中')
    expect(container.querySelector('img')?.getAttribute('src')).toBe(dataUrl)
    act(() => { root.unmount() })
    clearFileDataCache()
  })
})
