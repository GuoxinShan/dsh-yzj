/**
 * Session-header action that keeps the tab ring honest for v2.0 views.
 * Always mounted (header.actions). Tab-ring hide uses pitfall-018
 * (`display:none !important` + observer). Topic 回群聊 lives on the
 * official composer dock, not here.
 */
import { useEffect, useState } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { restoreYzjViewRing, watchYzjViewRing, yzjViewKindFromSessionId, type YzjViewKind } from './view-ring.ts'
import css from './home.module.css'

/** Injected binding lookup for the header shell. */
export interface YzjSessionShellInjected {
  readonly sessionId: string
  homeBinding: (sessionId: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  homeOpen?: (groupId: string, title?: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  focusBoundSession?: (sessionId: string) => void
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

/**
 * Pill + tab-ring sync. Renders 「群聊」/「私聊」 on room sessions so the header
 * still names the view after the tablist is hidden.
 */
export function YzjSessionShell(props: PropsRuntime<'conversation.session.header.actions'> & YzjSessionShellInjected) {
  const [kind, setKind] = useState<YzjViewKind>(() => yzjViewKindFromSessionId(props.sessionId))
  const [roomKind, setRoomKind] = useState<'group' | 'dm' | ''>('')

  useEffect(() => {
    let cancelled = false
    setKind(yzjViewKindFromSessionId(props.sessionId))
    const tick = async (): Promise<void> => {
      const result = await props.homeBinding(props.sessionId)
      if (cancelled || !result.ok) return
      const binding = asRecord(asRecord(result.value).binding)
      setRoomKind(binding.yzjKind === 'dm' ? 'dm' : binding.yzjKind === 'group' ? 'group' : '')
    }
    void tick()
    const timer = window.setInterval(() => { void tick() }, 1500)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      restoreYzjViewRing()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.sessionId])

  useEffect(() => watchYzjViewRing(kind), [kind, props.sessionId])

  // Topic jump lives on the official composer dock (same column as InputBar).
  if (kind !== 'room') return null
  return (
    <span className={css.kindPill} data-testid="yzj-room-pill">{roomKind === 'dm' ? '私聊' : '群聊'}</span>
  )
}
