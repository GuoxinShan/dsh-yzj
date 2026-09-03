/**
 * People IM room: Yunzhijia timeline + local @助手 threads + group composer.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { YzjPanelInject } from './rpc.ts'
import { YzjFusedView, type FusedImEntry } from './transcript.tsx'
import { YzjLocalThread, type LocalThreadView } from './local-thread.tsx'
import {
  EMOJI_LIST, interceptAssistantAt, resolveAtMentions,
  type AssistantAtCandidate, type AtCandidate,
} from './im-compose.ts'
import { onRoomReplyRequest, type RoomReplyTarget } from './reply-bus.ts'
import { rememberImSeat } from './im-seat.ts'
import { setImSelection } from './im-nav.ts'
import css from './shell.module.css'
import homeCss from './home.module.css'

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function parseThread(raw: unknown): LocalThreadView | undefined {
  const row = asRecord(raw)
  const msgId = asString(row.msgId)
  const groupId = asString(row.groupId)
  if (msgId === '' || groupId === '') return undefined
  return {
    groupId,
    msgId,
    assistantId: asString(row.assistantId) || 'default',
    status: row.status === 'processing' ? 'processing' : 'idle',
    bubbles: asArray(row.bubbles).flatMap((item) => {
      const bubble = asRecord(item)
      const id = asString(bubble.id)
      const role = bubble.role === 'user' || bubble.role === 'assistant' ? bubble.role : 'assistant'
      const text = asString(bubble.text)
      if (id === '') return []
      return [{ id, role, text }]
    }),
  }
}

export function YzjGroupRoom(props: {
  groupId: string
  groupName: string
  panel: YzjPanelInject
  defaultAssistantId: string
}) {
  const [assistants, setAssistants] = useState<AssistantAtCandidate[]>([{ id: 'default', name: '助手' }])
  const [threads, setThreads] = useState<LocalThreadView[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [replyTo, setReplyTo] = useState<RoomReplyTarget | null>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [atOpen, setAtOpen] = useState(false)
  const [speakers, setSpeakers] = useState<AtCandidate[]>([])
  const imageRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    rememberImSeat({ groupId: props.groupId, sessionId: '', groupName: props.groupName })
  }, [props.groupId, props.groupName])

  useEffect(() => onRoomReplyRequest((target) => {
    setReplyTo(target)
    setError('')
  }), [])

  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      const listed = await props.panel.assistantsList?.()
      if (!cancelled && listed?.ok) {
        const rows = asArray(asRecord(listed.value).assistants).flatMap((item) => {
          const row = asRecord(item)
          const id = asString(row.id)
          const name = asString(row.name)
          if (id === '') return []
          return [{ id, name: name === '' ? '助手' : name }]
        })
        if (rows.length > 0) setAssistants(rows)
      }
      const packed = await props.panel.assistantThreads?.(props.groupId)
      if (!cancelled && packed?.ok) {
        setThreads(asArray(asRecord(packed.value).threads).flatMap(item => {
          const thread = parseThread(item)
          return thread === undefined ? [] : [thread]
        }))
      }
      const fused = await props.panel.homeFused?.('', props.groupId)
      if (!cancelled && fused?.ok) {
        const items = asArray(asRecord(fused.value).items)
        const byId = new Map<string, string>()
        for (const item of items) {
          const entry = asRecord(asRecord(item).entry)
          const openId = asString(entry.fromOpenId)
          const name = asString(entry.fromName)
          if (openId !== '' && name !== '' && entry.isSelf !== true) byId.set(openId, name)
        }
        setSpeakers([...byId.entries()].map(([openId, name]) => ({ openId, name })))
      }
    }
    void load()
    const timer = window.setInterval(() => { void load() }, 1_200)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [props.groupId, props.panel])

  const askThread = async (assistantId: string, msgId: string, text: string, origin?: FusedImEntry): Promise<void> => {
    setBusy(true)
    setError('')
    const result = await props.panel.assistantThreadAsk?.({
      assistantId,
      groupId: props.groupId,
      msgId,
      text,
      ...(props.groupName === '' ? {} : { groupName: props.groupName }),
      ...(origin === undefined || origin.fromName === '' ? {} : { originWho: origin.fromName }),
      ...(origin === undefined || origin.content === '' ? {} : { originText: origin.content.slice(0, 400) }),
    })
    setBusy(false)
    if (result === undefined || !result.ok) setError(result?.error.message ?? '助手未响应')
  }

  const sendText = async (content: string, extra?: YzjPanelInject['sendMessageOpts']): Promise<void> => {
    const intercepted = interceptAssistantAt(content, assistants, replyTo !== null)
    if (intercepted.kind === 'empty') {
      setError('单独 @助手 不会发到群。请先回复一条消息，或打开助手单聊。')
      return
    }
    if (intercepted.kind === 'need-anchor') {
      setError('V1：没有回复目标的 @助手 不受理，请先点「回复」或去助手单聊。')
      return
    }
    if (intercepted.kind === 'ask') {
      const msgId = replyTo?.msgId ?? ''
      await askThread(intercepted.assistantId, msgId, intercepted.text)
      setDraft('')
      setReplyTo(null)
      return
    }
    const mentions = resolveAtMentions(content, speakers)
    if (!mentions.ok) {
      setError(mentions.error)
      return
    }
    setBusy(true)
    setError('')
    const result = await props.panel.homeSend?.('', content, {
      ...extra,
      groupId: props.groupId,
      ...(replyTo === null ? {} : { replyMsgId: replyTo.msgId }),
      ...(mentions.atOpenIds.length === 0 ? {} : { atOpenIds: [...mentions.atOpenIds] }),
      ...(mentions.atAll ? { atAll: true } : {}),
    })
    setBusy(false)
    if (result === undefined || !result.ok) {
      setError(result?.error.message ?? '发送失败')
      return
    }
    setDraft('')
    setReplyTo(null)
  }

  const send = async (): Promise<void> => {
    const text = draft.trim()
    if (text === '' || busy) return
    await sendText(text)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    void send()
  }

  const pickAssistant = (row: AssistantAtCandidate): void => {
    setAtOpen(false)
    if (replyTo === null) {
      setError('请先回复一条消息再 @助手，或打开助手单聊。')
      setImSelection({ kind: 'assistant', assistantId: row.id })
      return
    }
    const rest = draft.replace(/@\S+/g, '').trim()
    void askThread(row.id, replyTo.msgId, rest === '' ? '请看这条消息' : rest)
    setDraft('')
    setReplyTo(null)
  }

  return (
    <div className={css.shell} data-testid="yzj-group-room">
      <header className={css.header} data-yzj-im-header="">
        <div>
          <div className={css.headerTitle}>{props.groupName || '群聊'}</div>
          <div className={css.headerSub}>人群房间</div>
        </div>
        <span className={css.headerGrow} />
        <button
          type="button"
          className={css.askBtn}
          data-testid="yzj-ask-assistant"
          onClick={() => setImSelection({ kind: 'assistant', assistantId: props.defaultAssistantId })}
        >
          问助手
        </button>
      </header>
      <div className={css.body}>
        <YzjFusedView
          sessionId=""
          groupId={props.groupId}
          homeFused={(id, groupId) => props.panel.homeFused?.(id, groupId) ?? Promise.resolve({ ok: false as const, error: { message: 'homeFused unavailable' } })}
          homeBackfill={(id, opts) => props.panel.homeBackfill?.(id, opts) ?? Promise.resolve({ ok: false as const, error: { message: 'homeBackfill unavailable' } })}
          {...(props.panel.fetchFileData === undefined ? {} : { fetchFileData: props.panel.fetchFileData })}
          {...(props.panel.fetchContact === undefined ? {} : { fetchContact: props.panel.fetchContact })}
          renderThread={(entry) => {
            const thread = threads.find(item => item.msgId === entry.msgId)
            if (thread === undefined) return null
            return (
              <YzjLocalThread
                thread={thread}
                onPeek={() => setImSelection({
                  kind: 'peek',
                  assistantId: thread.assistantId,
                  groupId: props.groupId,
                  ...(props.groupName === '' ? {} : { groupName: props.groupName }),
                })}
              />
            )
          }}
          onForwardToAssistant={(entry) => {
            void askThread(props.defaultAssistantId, entry.msgId, '请看这条消息', entry)
          }}
        />
      </div>
      {error !== '' && <p className={css.alert} role="alert">{error}</p>}
      <div className={css.composer} data-yzj-im-composer="">
        {replyTo !== null && (
          <div className={homeCss.roomReplyBar} data-testid="yzj-room-reply">
            <span className={homeCss.roomReplyText}>回复：{replyTo.summary}</span>
            <button type="button" className={homeCss.roomReplyCancel} onClick={() => setReplyTo(null)}>取消</button>
          </div>
        )}
        {atOpen && (
          <div className={css.atMenu} data-testid="yzj-at-menu">
            {assistants.map(row => (
              <button key={row.id} type="button" className={css.atItem} onClick={() => pickAssistant(row)}>
                @{row.name}
              </button>
            ))}
            {speakers.map(row => (
              <button
                key={row.openId}
                type="button"
                className={css.atItem}
                onClick={() => {
                  setDraft(`${draft}@${row.name} `)
                  setAtOpen(false)
                }}
              >
                @{row.name}
              </button>
            ))}
          </div>
        )}
        {emojiOpen && (
          <div className={homeCss.roomEmojiPanel} role="listbox" aria-label="表情">
            {EMOJI_LIST.map(emoji => (
              <button
                key={emoji}
                type="button"
                className={homeCss.roomEmojiBtn}
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
        <div className={css.composerCard}>
          <textarea
            className={css.composerInput}
            value={draft}
            placeholder="发到群里，@ 可叫助手（不会发到群）"
            rows={2}
            aria-label="发到群里"
            onChange={event => {
              setDraft(event.target.value)
              if (event.target.value.endsWith('@')) setAtOpen(true)
            }}
            onKeyDown={onKeyDown}
          />
          <button type="button" className={css.plus} aria-label="提及" onClick={() => setAtOpen(open => !open)}>@</button>
          <button type="button" className={css.plus} aria-label="表情" onClick={() => setEmojiOpen(open => !open)}>☺</button>
          <button type="button" className={css.plus} aria-label="图片" onClick={() => imageRef.current?.click()}>📎</button>
          <input
            ref={imageRef}
            type="file"
            accept="image/*"
            hidden
            onChange={event => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file === undefined || props.panel.uploadFile === undefined) return
              const reader = new FileReader()
              reader.onload = (): void => {
                const base64 = typeof reader.result === 'string' ? reader.result.split(',')[1] ?? '' : ''
                if (base64 === '') return
                void props.panel.uploadFile?.(file.name, base64, file.size).then(async (result) => {
                  if (!result.ok) return
                  const fileId = asString(asRecord(result.value).fileId)
                  if (fileId === '') return
                  await sendText(draft.trim() === '' ? '[图片]' : draft, { msgType: 'richText', images: [fileId] })
                })
              }
              reader.readAsDataURL(file)
            }}
          />
          <input ref={fileRef} type="file" hidden />
          <button
            type="button"
            className={css.send}
            data-testid="yzj-send-to-group"
            aria-label="发进群"
            disabled={busy || draft.trim() === ''}
            onClick={() => { void send() }}
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  )
}
