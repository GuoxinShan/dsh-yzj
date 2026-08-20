/**
 * Group-room composer takeover (`conversation.composer` chain).
 * yzj-home-* sessions: one verb = 发进群, covering the CLI send surface
 * (reply / @ / @all / emoji / image / file). Approval/question entries keep
 * higher or equal priority and still cover the bar when they match.
 * The visible face portals into the timeline host from `composer-host.ts`
 * (pitfall-019): do not cache getElementById across workbench remounts.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ComposerChainProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { EMOJI_LIST, resolveAtMentions, type AtCandidate } from './im-compose.ts'
import { onRoomReplyRequest, type RoomReplyTarget } from './reply-bus.ts'
import type { YzjPanelInject } from './rpc.ts'
import {
  getRoomComposerHost, subscribeRoomComposerHost,
} from './composer-host.ts'
import { useWorkbenchDomain } from './workbench-domain.ts'
import { peekImSeat, subscribeImSeat } from './im-seat.ts'
import css from './home.module.css'

/** Injected send / upload / speaker path for the room composer. */
export interface YzjRoomComposerInjected {
  readonly sessionId: string
  /** R27 overlay: local draft, no official InputBar takeover. */
  standalone?: boolean
  homeSend: (
    sessionId: string,
    content: string | undefined,
    opts?: YzjPanelInject['sendMessageOpts'],
  ) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  uploadFile?: YzjPanelInject['uploadFile']
  homeFused?: (sessionId: string, groupId?: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  fetchContact?: YzjPanelInject['fetchContact']
}

/** Chain select: group-room hosts, unless a question/approval already claimed the bar. */
export function selectGroupRoomComposer({ session, interactions }: ComposerChainProps): { room: true } | null {
  if (interactions.some(item => item.kind === 'approval' || item.kind === 'question')) return null
  const id = session?.sessionId
  if (typeof id !== 'string' || !id.startsWith('yzj-home-')) return null
  return { room: true }
}

/** Collapse the official composer seat so a hidden takeover leaves no gap. */
function collapseComposerSeat(on: boolean): () => void {
  const seat = document.querySelector<HTMLElement>('[data-composer-seat]')
  if (seat === null) return () => {}
  if (!on) return () => {}
  seat.style.setProperty('height', '0')
  seat.style.setProperty('min-height', '0')
  seat.style.setProperty('overflow', 'hidden')
  seat.style.setProperty('padding', '0')
  return () => {
    seat.style.removeProperty('height')
    seat.style.removeProperty('min-height')
    seat.style.removeProperty('overflow')
    seat.style.removeProperty('padding')
  }
}

/** Portal target inside the timeline column (`transcript.tsx`). */
export { ROOM_COMPOSER_HOST_ID } from './composer-host.ts'

type SessionRow = { displayTitle?: string }

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function speakersOf(value: unknown): AtCandidate[] {
  const items = asRecord(value).items
  if (!Array.isArray(items)) return []
  const byId = new Map<string, string>()
  for (const item of items) {
    const row = asRecord(asRecord(item).entry)
    const openId = typeof row.fromOpenId === 'string' ? row.fromOpenId : ''
    const name = typeof row.fromName === 'string' ? row.fromName : ''
    if (openId === '' || row.isSelf === true) continue
    if (!byId.has(openId) && name !== '') byId.set(openId, name)
  }
  return [...byId.entries()].map(([openId, name]) => ({ openId, name }))
}

function useComposerHost(): HTMLElement | null {
  const [host, setHost] = useState<HTMLElement | null>(() => getRoomComposerHost())
  useEffect(() => subscribeRoomComposerHost((node) => {
    setHost(node !== null && node.isConnected ? node : null)
  }), [])
  return host !== null && host.isConnected ? host : null
}

/**
 * DSH-shaped composer card: draft + attach tools + circular send.
 * Placeholder names the group; the send control is an icon (aria 发进群).
 */
export function YzjRoomComposer(
  props: Partial<PropsRuntime<'conversation.composer'>> & YzjRoomComposerInjected & { matched?: { room: true } },
) {
  const standalone = props.standalone === true
  const [localDraft, setLocalDraft] = useState('')
  const draft = standalone || props.useInput === undefined
    ? localDraft
    : props.useInput(s => s.draft)
  const setDraft = (value: string): void => {
    if (standalone || props.inputActions === undefined) setLocalDraft(value)
    else props.inputActions.setDraft(value)
  }
  const hangerName = props.useSessions === undefined
    ? '群'
    : props.useSessions(s => {
      const row = (s as { byId?: Record<string, SessionRow> }).byId?.[props.sessionId]
      const title = row?.displayTitle
      return typeof title === 'string' && title !== '' && title !== '群房间' && title !== '私聊房间' ? title : '群'
    })
  const [seat, setSeat] = useState(peekImSeat)
  useEffect(() => subscribeImSeat(() => { setSeat(peekImSeat()) }), [])
  const groupId = seat?.groupId ?? ''
  const groupName = seat?.groupName !== undefined && seat.groupName !== '' ? seat.groupName : hangerName
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [replyTo, setReplyTo] = useState<RoomReplyTarget | null>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [speakers, setSpeakers] = useState<AtCandidate[]>([])
  const imageRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => onRoomReplyRequest((target) => {
    setReplyTo(target)
    setError('')
  }), [])

  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      if (props.homeFused === undefined) return
      // No room seated (overlay cover, nothing picked): an empty payload only
      // errors on the host (pitfall-039) — skip the poll until a group exists.
      if (props.sessionId === '' && groupId === '') return
      const result = await props.homeFused(props.sessionId, groupId === '' ? undefined : groupId)
      if (cancelled || !result.ok) return
      setSpeakers(speakersOf(result.value))
    }
    void load()
    const timer = window.setInterval(() => { void load() }, 4000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [props.sessionId, groupId])

  const sendText = async (content: string, extra?: YzjPanelInject['sendMessageOpts']): Promise<void> => {
    const mentions = resolveAtMentions(content, speakers)
    if (!mentions.ok) {
      setError(mentions.error)
      return
    }
    setBusy(true)
    setError('')
    const replyMsgId = replyTo?.msgId
    const result = await props.homeSend(props.sessionId, content, {
      ...extra,
      ...(groupId === '' ? {} : { groupId }),
      ...(replyMsgId === undefined ? {} : { replyMsgId }),
      ...(mentions.atOpenIds.length === 0 ? {} : { atOpenIds: [...mentions.atOpenIds] }),
      ...(mentions.atAll ? { atAll: true } : {}),
    })
    setBusy(false)
    if (!result.ok) {
      setError(result.error.message)
      return
    }
    setDraft('')
    setReplyTo(null)
    setEmojiOpen(false)
  }

  const send = async (): Promise<void> => {
    const text = draft.trim()
    if (text === '' || busy) return
    await sendText(text)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    event.stopPropagation()
    void send()
  }

  const pickFile = (kind: 'image' | 'file', file: File | undefined): void => {
    if (file === undefined) return
    if (props.uploadFile === undefined) {
      setError('上传不可用')
      return
    }
    if (file.size > 24 * 1024 * 1024) {
      setError('文件超过 24MB，请压缩后重试')
      return
    }
    const reader = new FileReader()
    reader.onload = (): void => {
      const base64 = typeof reader.result === 'string' ? reader.result.split(',')[1] ?? '' : ''
      if (base64 === '') return
      setBusy(true)
      setError('')
      void props.uploadFile?.(file.name, base64, file.size).then(async (result) => {
        if (!result.ok) {
          setError(result.error.message)
          return
        }
        const payload = asRecord(result.value)
        const fileId = typeof payload.fileId === 'string' && payload.fileId !== '' ? payload.fileId
          : typeof payload.file_id === 'string' ? payload.file_id
            : typeof payload.id === 'string' ? payload.id : ''
        if (fileId === '') {
          setError('上传失败：未返回文件 ID')
          return
        }
        if (kind === 'image') {
          const text = draft.trim()
          const content = text === '' ? '[图片]' : `${text}\n[图片]`
          await sendText(content, { msgType: 'richText', images: [fileId] })
          return
        }
        const sent = await props.homeSend(props.sessionId, undefined, {
          msgType: 'file',
          fileId,
        })
        if (!sent.ok) {
          setError(sent.error.message)
          return
        }
        setReplyTo(null)
      }).finally(() => setBusy(false))
    }
    reader.readAsDataURL(file)
  }

  const host = useComposerHost()
  const domain = useWorkbenchDomain()
  const hide = domain !== 'im'
  // Overlay composer never touches the official seat. Slot takeover still
  // collapses it for the leftover hanger path.
  useEffect(() => {
    if (standalone) return
    return collapseComposerSeat(true)
  }, [standalone])
  if (hide) {
    return <span className={css.roomComposerSeat} data-testid="yzj-room-composer-seat" hidden />
  }
  const face = (
    <div className={css.roomComposer} data-testid="yzj-room-composer">
      {replyTo !== null && (
        <div className={css.roomReplyBar} data-testid="yzj-room-reply">
          <span className={css.roomReplyText}>回复：{replyTo.summary}</span>
          <button type="button" className={css.roomReplyCancel} onClick={() => setReplyTo(null)}>取消</button>
        </div>
      )}
      {emojiOpen && (
        <div className={css.roomEmojiPanel} role="listbox" aria-label="表情">
          {EMOJI_LIST.map(emoji => (
            <button
              key={emoji}
              type="button"
              className={css.roomEmojiBtn}
              onClick={() => {
                setDraft(`${draft}${emoji}`)
                setEmojiOpen(false)
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      <div className={css.roomComposerCard}>
        <textarea
          className={css.roomComposerInput}
          value={draft}
          placeholder={`发到 ${groupName}…`}
          rows={2}
          aria-label={`发到 ${groupName}`}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className={css.roomComposerBar}>
          <div className={css.roomComposerTools}>
            <button type="button" className={css.roomToolBtn} onClick={() => setEmojiOpen(open => !open)}>表情</button>
            <button type="button" className={css.roomToolBtn} onClick={() => imageRef.current?.click()}>图片</button>
            <button type="button" className={css.roomToolBtn} onClick={() => fileRef.current?.click()}>文件</button>
            <input
              ref={imageRef}
              type="file"
              accept="image/*"
              hidden
              onChange={event => { pickFile('image', event.target.files?.[0]); event.target.value = '' }}
            />
            <input
              ref={fileRef}
              type="file"
              hidden
              onChange={event => { pickFile('file', event.target.files?.[0]); event.target.value = '' }}
            />
          </div>
          <button
            type="button"
            className={css.roomSendCircle}
            data-testid="yzj-send-to-group"
            aria-label="发进群"
            disabled={busy || draft.trim() === ''}
            onClick={() => { void send() }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 12.5V3.5M8 3.5L3.5 8M8 3.5L12.5 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
      {error !== '' && <p role="alert">{error}</p>}
    </div>
  )
  if (host === null) return face
  return (
    <>
      <span className={css.roomComposerSeat} data-testid="yzj-room-composer-seat" hidden />
      {createPortal(face, host)}
    </>
  )
}
