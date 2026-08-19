/**
 * Yunzhijia CLI login card: probe status, open the system browser via
 * `yzj-cli auth login`, then re-probe. DSH never holds tokens.
 */
import { useEffect, useState, type ReactNode } from 'react'
import css from './login-banner.module.css'

type Rpc = { ok: true; value: unknown } | { ok: false; error: { message: string } }

/** Injected `/yzj auth-status` / `auth-login` verbs. */
export interface YzjLoginBannerProps {
  authStatus: () => Promise<Rpc>
  authLogin: () => Promise<Rpc>
  /** Called after a successful re-probe so the list can refetch. */
  onLoggedIn?: () => void
  /** Narrow column (session list) vs settings section. */
  compact?: boolean
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

type Phase = 'checking' | 'in' | 'out' | 'launching' | 'waiting' | 'retry'

/**
 * Login card. Renders nothing while checking; a one-line status when already
 * logged in (settings); the CTA when the CLI has no credentials.
 */
export function YzjLoginBanner(props: YzjLoginBannerProps): ReactNode {
  const [phase, setPhase] = useState<Phase>('checking')
  const [name, setName] = useState('')
  const [hint, setHint] = useState('')

  const probe = async (afterLogin: boolean): Promise<void> => {
    const result = await props.authStatus()
    if (!result.ok) {
      setPhase('out')
      setHint(result.error.message)
      return
    }
    const rec = asRecord(result.value)
    if (rec.loggedIn === true) {
      setName(asString(rec.name) || asString(rec.openId) || '已登录')
      setHint('')
      setPhase('in')
      if (afterLogin) props.onLoggedIn?.()
      return
    }
    const reason = asString(rec.reason)
    setHint(afterLogin
      ? (reason === '' ? '还没检测到登录，请确认浏览器里已完成授权后再试。' : reason)
      : reason)
    setPhase(afterLogin ? 'retry' : 'out')
  }

  useEffect(() => {
    void probe(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once; the RPC face is stable
  }, [])

  const launch = async (): Promise<void> => {
    setPhase('launching')
    setHint('')
    const result = await props.authLogin()
    if (!result.ok) {
      setPhase('out')
      setHint(result.error.message)
      return
    }
    setPhase('waiting')
  }

  if (phase === 'checking') return null
  if (phase === 'in') {
    if (props.compact === true) return null
    return <p className={css.status} data-testid="yzj-login-status">已登录 · {name}</p>
  }

  return (
    <div className={`${css.card} ${props.compact === true ? css.compact : ''}`} data-testid="yzj-login-banner" role="status">
      <strong className={css.title}>云之家未登录</strong>
      <p className={css.body}>
        {phase === 'waiting' || phase === 'retry'
          ? '已打开系统浏览器。授权完成后点「我已登录」。'
          : props.compact === true
            ? '点按钮打开系统浏览器，用 yzj-cli 授权。DSH 不保存密码。'
            : '工作台复用本机 yzj-cli 登录态。点按钮会打开系统浏览器完成授权；凭据只进操作系统密钥链，DSH 碰不到。'}
      </p>
      {hint !== '' && <p className={css.hint}>{hint}</p>}
      {phase === 'waiting' || phase === 'retry'
        ? (
          <div className={css.actions}>
            <button type="button" className={css.primary} data-testid="yzj-login-confirm" onClick={() => { void probe(true) }}>
              我已登录
            </button>
            <button type="button" className={css.secondary} data-testid="yzj-login-again" onClick={() => { void launch() }}>
              再打开一次
            </button>
          </div>
        )
        : (
          <button
            type="button"
            className={css.primary}
            data-testid="yzj-login-open"
            disabled={phase === 'launching'}
            onClick={() => { void launch() }}
          >
            {phase === 'launching' ? '正在打开浏览器…' : '打开登录页'}
          </button>
        )}
    </div>
  )
}
