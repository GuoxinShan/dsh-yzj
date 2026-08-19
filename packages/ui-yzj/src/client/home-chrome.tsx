/**
 * Bound / unbound composer chrome in `conversation.input.dock`.
 * Group room: dock 发进群 is retired (R2) — the timeline column owns 发进群.
 * Topic: native send = 问助手. Unbound: 「丢进群」.
 */
import { useEffect, useRef, useState } from 'react'
import {
  composeHandoffDigest, defaultSelectedIds, type DigestCandidate,
} from '../handoff-digest.ts'
import { peekImSeat, rememberImSeat } from './im-seat.ts'
import { setWorkbenchDomain, useWorkbenchDomain } from './workbench-domain.ts'
import { openWorkbench } from './workbench-overlay.ts'
import { yzjViewKindFromSessionId } from './view-ring.ts'
import css from './home.module.css'

/** Injected verbs for the dock chrome. */
export interface YzjHomeChromeInjected {
  readonly sessionId: string
  readDraft: () => string
  clearDraft: () => void
  homeBinding: (sessionId: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  homeSend: (sessionId: string, content: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  homeDigest: (sessionId: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  homeHandoff: (groupId: string, digest: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  homeOpen?: (groupId: string, title?: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  fetchGroups: (limit?: number, page?: number) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  focusBoundSession?: (sessionId: string) => void
  /** Native composer submit; intercepted on group rooms so 发送 = 发进群. */
  inputActions?: { submit: () => void }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

/**
 * Room chrome: native send is intercepted to 发进群 (safety net if the
 * official bar is still up). Topic paints 「回群聊」 on this dock, matching
 * the official InputBar column. Unbound keeps 「丢进群」. Room dock 发进群
 * is retired — the timeline column owns it.
 */
export function YzjHomeChrome(props: YzjHomeChromeInjected) {
  const domain = useWorkbenchDomain()
  const [kind, setKind] = useState<'room' | 'topic' | 'unbound'>(() => yzjViewKindFromSessionId(props.sessionId))
  const [error, setError] = useState('')
  const [handoffOpen, setHandoffOpen] = useState(false)
  const [roomGroupId, setRoomGroupId] = useState('')
  const [roomKind, setRoomKind] = useState<'group' | 'dm' | ''>('')
  const [summary, setSummary] = useState('')
  const sendRef = useRef<() => Promise<void>>(async () => {})

  useEffect(() => {
    const next = yzjViewKindFromSessionId(props.sessionId)
    setKind(next)
    if (next !== 'topic') {
      setRoomGroupId('')
      setRoomKind('')
      setSummary('')
      return
    }
    let cancelled = false
    const tick = async (): Promise<void> => {
      const result = await props.homeBinding(props.sessionId)
      if (cancelled || !result.ok) return
      const raw = asRecord(result.value)
      const binding = asRecord(raw.binding)
      const host = typeof binding.dshSessionId === 'string' ? binding.dshSessionId : ''
      const groupId = typeof binding.yzjConversationId === 'string' ? binding.yzjConversationId : ''
      setRoomGroupId(groupId)
      setRoomKind(binding.yzjKind === 'dm' ? 'dm' : binding.yzjKind === 'group' ? 'group' : '')
      rememberImSeat({ groupId, sessionId: host })
      const topic = asRecord(raw.topic)
      const origin = typeof topic.originText === 'string' ? topic.originText : ''
      const title = typeof topic.title === 'string' ? topic.title : ''
      setSummary(origin !== '' ? origin : title)
    }
    void tick()
    const timer = window.setInterval(() => { void tick() }, 1500)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.sessionId])

  const sendToGroup = async (): Promise<void> => {
    const draft = props.readDraft().trim()
    if (draft === '') {
      setError('先写点内容再发进群')
      return
    }
    setError('')
    const result = await props.homeSend(props.sessionId, draft)
    if (!result.ok) {
      setError(result.error.message)
      return
    }
    props.clearDraft()
  }
  sendRef.current = sendToGroup

  useEffect(() => {
    if (kind !== 'room') return
    const actions = props.inputActions
    const original = actions?.submit
    if (actions !== undefined && original !== undefined) {
      actions.submit = () => { void sendRef.current() }
    }
    return () => {
      if (actions !== undefined && original !== undefined) actions.submit = original
    }
  }, [kind, props.inputActions])

  if (kind === 'room' || domain !== 'im') return null

  if (kind === 'topic') {
    const label = roomKind === 'dm' ? '回私聊' : '回群聊'
    return (
      <div className={css.topicDock} data-testid="yzj-home-chrome">
        <button
          type="button"
          className={css.topicDockBtn}
          data-testid="yzj-topic-anchor"
          title={summary === '' ? label : summary}
          aria-label={summary === '' ? label : `${label}：${summary}`}
          onClick={() => {
            const groupId = roomGroupId !== '' ? roomGroupId : (peekImSeat()?.groupId ?? '')
            if (groupId !== '') rememberImSeat({ groupId, sessionId: peekImSeat()?.sessionId ?? '' })
            setWorkbenchDomain('im')
            openWorkbench()
          }}
        >
          <span className={css.topicDockLabel}>{label}</span>
          {summary !== '' && <span className={css.topicDockSummary}>{summary}</span>}
        </button>
      </div>
    )
  }

  return (
    <div className={css.chromeQuiet} data-testid="yzj-home-chrome">
      <button type="button" className={css.chromeLink} onClick={() => setHandoffOpen(true)}>丢进群</button>
      {error !== '' && <span role="alert">{error}</span>}
      {handoffOpen && (
        <HandoffModal
          sessionId={props.sessionId}
          homeDigest={props.homeDigest}
          homeHandoff={props.homeHandoff}
          fetchGroups={props.fetchGroups}
          {...(props.focusBoundSession === undefined ? {} : { focusBoundSession: props.focusBoundSession })}
          onClose={() => setHandoffOpen(false)}
        />
      )}
    </div>
  )
}

function HandoffModal(props: {
  sessionId: string
  homeDigest: YzjHomeChromeInjected['homeDigest']
  homeHandoff: YzjHomeChromeInjected['homeHandoff']
  fetchGroups: YzjHomeChromeInjected['fetchGroups']
  focusBoundSession?: (sessionId: string) => void
  onClose: () => void
}) {
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([])
  const [groupId, setGroupId] = useState('')
  const [candidates, setCandidates] = useState<DigestCandidate[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [migrateFull, setMigrateFull] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void props.fetchGroups(20).then(result => {
      if (!result.ok) return
      const list = asArray(asRecord(result.value).list)
      const rows = list.map(item => {
        const row = asRecord(item)
        return {
          id: typeof row.groupId === 'string' ? row.groupId : '',
          name: typeof row.groupName === 'string' ? row.groupName : '',
        }
      }).filter(row => row.id !== '')
      setGroups(rows)
      if (rows[0] !== undefined) setGroupId(rows[0].id)
    })
    void props.homeDigest(props.sessionId).then(result => {
      if (!result.ok) return
      const list = asArray(asRecord(result.value).candidates) as DigestCandidate[]
      setCandidates(list)
      setSelected(defaultSelectedIds(list))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.sessionId])

  const confirm = async (): Promise<void> => {
    if (groupId === '') {
      setError('请选择目标群')
      return
    }
    const digest = composeHandoffDigest(candidates, selected, migrateFull)
    if (digest.trim() === '') {
      setError('请勾选要分享的摘要，或显式选择全文迁移')
      return
    }
    setBusy(true)
    setError('')
    const result = await props.homeHandoff(groupId, digest)
    setBusy(false)
    if (!result.ok) {
      setError(result.error.message)
      return
    }
    const sessionId = typeof asRecord(result.value).sessionId === 'string'
      ? asRecord(result.value).sessionId as string : ''
    rememberImSeat({ groupId, sessionId: sessionId === '' ? '' : sessionId })
    setWorkbenchDomain('im')
    openWorkbench()
    props.onClose()
  }

  return (
    <div className={css.modalMask} role="dialog" aria-label="丢进群确认">
      <div className={css.modal}>
        <h3>丢进群</h3>
        <p>默认只发你勾选的可见摘要。私聊全文仍私密。全文迁移必须显式勾选。确认后才会发进群并打开群房间。</p>
        <label className={css.pick}>
          目标群
          <select value={groupId} onChange={event => setGroupId(event.target.value)}>
            {groups.map(group => (
              <option key={group.id} value={group.id}>{group.name === '' ? group.id : group.name}</option>
            ))}
          </select>
        </label>
        <div className={css.pick}>
          {candidates.length === 0 && <span>这条私密会话还没有可勾选的摘要。</span>}
          {candidates.map(row => (
            <label key={row.id} className={css.candidate}>
              <input
                type="checkbox"
                checked={migrateFull || selected.includes(row.id)}
                disabled={migrateFull}
                onChange={event => {
                  setSelected(current => event.target.checked
                    ? [...current, row.id]
                    : current.filter(id => id !== row.id))
                }}
              />
              <span><strong>{row.role === 'assistant' ? '助手' : '用户'}</strong> {row.text.slice(0, 180)}</span>
            </label>
          ))}
        </div>
        <label className={css.candidate}>
          <input type="checkbox" checked={migrateFull} onChange={event => setMigrateFull(event.target.checked)} />
          <span>全文迁移（显式、罕见：整段私聊变为群可见）</span>
        </label>
        {error !== '' && <p role="alert">{error}</p>}
        <div className={css.actions}>
          <button type="button" className={css.chromeBtn} onClick={props.onClose}>取消</button>
          <button type="button" className={`${css.chromeBtn} ${css.chromePrimary}`} disabled={busy} onClick={() => { void confirm() }}>
            {busy ? '交接中…' : '确认发进群'}
          </button>
        </div>
      </div>
    </div>
  )
}
