/**
 * Group-room composer takeover (`conversation.composer` chain).
 * yzj-home-* sessions: one verb = 发进群, covering the CLI send surface
 * (reply / @ / @all / emoji / image / file). Approval/question entries keep
 * higher or equal priority and still cover the bar when they match.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ComposerChainProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { EMOJI_LIST, resolveAtMentions, type AtCandidate } from './im-compose.ts'
import { onRoomReplyRequest, type RoomReplyTarget } from './reply-bus.ts'
import type { YzjPanelInject } from './rpc.ts'
import css from './home.module.css'

/** Injected send / upload / speaker path for the room composer. */
export interface YzjRoomComposerInjected {
  readonly sessionId: string
  homeSend: (
    sessionId: string,
    content: string | undefined,
    opts?: YzjPanelInject['sendMessageOpts'],
  ) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  uploadFile?: YzjPanelInject['uploadFile']
  homeFused?: (sessionId: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  fetchContact?: YzjPanelInject['fetchContact']
}

/** Chain select: group-room hosts, unless a question/approval already claimed the bar. */
export function selectGroupRoomComposer({ session, interactions }: ComposerChainProps): { room: true } | null {
  if (interactions.some(item => item.kind === 'approval' || item.kind === 'question')) return null
  const id = session?.sessionId
  if (typeof id !== 'string' || !id.startsWith('yzj-home-')) return null
  return { room: true }
}

/** Portal target inside the timeline column (`transcript.tsx`). */
export const ROOM_COMPOSER_HOST_ID = 'yzj-room-composer-host'

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
  const [host, setHost] = useState<HTMLElement | null>(() => document.getElementById(ROOM_COMPOSER_HOST_ID))
  useEffect(() => {
    const found = document.getElementById(ROOM_COMPOSER_HOST_ID)
    if (found !== null) {
      setHost(found)
      return
    }
    const observer = new MutationObserver(() => {
      const node = document.getElementById(ROOM_COMPOSER_HOST_ID)
      if (node !== null) {
        setHost(node)
        observer.disconnect()
      }
    })
    observer.observe(document.documentElement, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])
  return host
}

/**
 * Canvas-shaped composer: placeholder 「发进 群名…」, primary button 「发进群」,
 * toolbar for emoji / image / file, reply bar above the input.
 */
export function YzjRoomComposer(
  props: PropsRuntime<'conversation.composer'> & YzjRoomComposerInjected & { matched: { room: true } },
) {
  const draft = props.useInput(s => s.draft)
  const groupName = props.useSessions(s => {
    const row = (s as { byId?: Record<string, SessionRow> }).byId?.[props.sessionId]
    const title = row?.displayTitle
    return typeof title === 'string' && title !== '' && title !== '群房间' && title !== '私聊房间' ? title : '群'
  })
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
      const result = await props.homeFused(props.sessionId)
      if (cancelled || !result.ok) return
      setSpeakers(speakersOf(result.value))
    }
    void load()
    const timer = window.setInterval(() => { void load() }, 4000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [props.sessionId])

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
      ...(replyMsgId === undefined ? {} : { replyMsgId }),
      ...(mentions.atOpenIds.length === 0 ? {} : { atOpenIds: [...mentions.atOpenIds] }),
      ...(mentions.atAll ? { atAll: true } : {}),
    })
    setBusy(false)
    if (!result.ok) {
      setError(result.error.message)
      return
    }
    props.inputActions.setDraft('')
    setReplyTo(null)
    setEmojiOpen(false)
  }

  const send = async (): Promise<void> => {
    const text = draft.trim()
    if (text === '') {
      setError('先写点内容再发进群')
      return
    }
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
  useEffect(() => {
    if (host === null) return
    const seat = document.querySelector<HTMLElement>('[data-composer-seat]')
    if (seat === null) return
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
  }, [host])
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
                props.inputActions.setDraft(`${draft}${emoji}`)
                setEmojiOpen(false)
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
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
      <div className={css.roomComposerRow}>
        <textarea
          className={css.roomComposerInput}
          value={draft}
          placeholder={`发进 ${groupName}…`}
          rows={2}
          aria-label={`发进 ${groupName}`}
          onChange={event => props.inputActions.setDraft(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          className={`${css.chromeBtn} ${css.chromePrimary}`}
          data-testid="yzj-send-to-group"
          disabled={busy}
          onClick={() => { void send() }}
        >
          {busy ? '发进群…' : '发进群'}
        </button>
      </div>
      <p className={css.roomComposerCaption}>
        本人身份直发，无确认卡。要用助手，点消息旁的「交给助手」。
      </p>
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
