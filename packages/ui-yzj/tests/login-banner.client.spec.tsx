// @vitest-environment jsdom
/**
 * CLI login card: probe → open browser → confirm.
 */
import { act } from 'react-dom/test-utils'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { YzjLoginBanner } from '../src/client/login-banner.tsx'

type Rpc = { ok: true; value: unknown } | { ok: false; error: { message: string } }

interface Harness {
  container: HTMLDivElement
  root: Root
}

const mounted: Harness[] = []

function mount(opts: {
  loggedIn?: boolean
  name?: string
  statusError?: string
  loginError?: string
  onLoggedIn?: () => void
}): Harness & { loginCalls: number } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const loginCalls = { n: 0 }
  let loggedIn = opts.loggedIn === true
  act(() => {
    root.render(
      <YzjLoginBanner
        authStatus={async (): Promise<Rpc> => {
          if (opts.statusError !== undefined) return { ok: false, error: { message: opts.statusError } }
          return {
            ok: true,
            value: loggedIn
              ? { loggedIn: true, name: opts.name ?? '单国鑫', openId: 'oid', reason: '' }
              : { loggedIn: false, name: '', openId: '', reason: 'no app credentials configured' },
          }
        }}
        authLogin={async (): Promise<Rpc> => {
          loginCalls.n += 1
          if (opts.loginError !== undefined) return { ok: false, error: { message: opts.loginError } }
          return { ok: true, value: { started: true, alreadyRunning: false } }
        }}
        onLoggedIn={opts.onLoggedIn}
      />,
    )
  })
  const face = { container, root }
  mounted.push(face)
  return Object.assign(face, { get loginCalls() { return loginCalls.n } })
}

async function flush(): Promise<void> {
  await act(async () => { await Promise.resolve() })
}

afterEach(() => {
  for (const face of mounted.splice(0)) {
    act(() => { face.root.unmount() })
    face.container.remove()
  }
})

describe('YzjLoginBanner', () => {
  it('shows a one-line status when already logged in', async () => {
    const face = mount({ loggedIn: true, name: '单国鑫' })
    await flush()
    expect(face.container.textContent).toContain('已登录 · 单国鑫')
    expect(face.container.querySelector('[data-testid="yzj-login-banner"]')).toBeNull()
  })

  it('opens the CLI login and confirms after the browser finishes', async () => {
    let loggedIn = false
    const hits: string[] = []
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    mounted.push({ container, root })
    act(() => {
      root.render(
        <YzjLoginBanner
          authStatus={async () => ({
            ok: true,
            value: loggedIn
              ? { loggedIn: true, name: '单国鑫', openId: 'oid', reason: '' }
              : { loggedIn: false, name: '', openId: '', reason: 'no app credentials' },
          })}
          authLogin={async () => {
            hits.push('login')
            return { ok: true, value: { started: true, alreadyRunning: false } }
          }}
          onLoggedIn={() => { hits.push('ready') }}
        />,
      )
    })
    await flush()
    expect(container.textContent).toContain('云之家未登录')
    const open = container.querySelector('[data-testid="yzj-login-open"]') as HTMLButtonElement
    await act(async () => { open.click(); await Promise.resolve() })
    expect(hits).toEqual(['login'])
    expect(container.textContent).toContain('已打开系统浏览器')
    loggedIn = true
    const confirm = container.querySelector('[data-testid="yzj-login-confirm"]') as HTMLButtonElement
    await act(async () => { confirm.click(); await Promise.resolve() })
    expect(hits).toEqual(['login', 'ready'])
    expect(container.textContent).toContain('已登录 · 单国鑫')
  })

  it('surfaces a spawn failure on the card', async () => {
    const face = mount({ loginError: 'failed to spawn yzj-cli' })
    await flush()
    const open = face.container.querySelector('[data-testid="yzj-login-open"]') as HTMLButtonElement
    await act(async () => { open.click(); await Promise.resolve() })
    expect(face.container.textContent).toContain('failed to spawn yzj-cli')
  })
})
