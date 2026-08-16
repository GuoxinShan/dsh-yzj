/**
 * The Yunzhijia workspace panel: a frame overlay with three tabs — 知识库
 * (workspace → doc tree), 日程 (today), 会话 (recent groups → messages with
 * paging). Rendering stays presentational: data arrives through the injected
 * fetch face and the shared store; verbs are the injected face and store
 * actions.
 */
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import {
  IconChecklistOutline14,
  IconFolderOpenOutline16,
  IconListPenOutline16,
  IconNewChatOutline16,
  Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { BakedActions } from '@deepseek-ai/dsh-client-ui-slots'
import type { YzjPanelActions, YzjPanelState, YzjTab } from './stores.ts'
import type { YzjPanelInject } from './rpc.ts'
import {
  effectiveUnread, ensureMyProfile, formatListTime, formatMsgTime, formatSize, getGroupWindow,
  getMessageWindow, markAllRead, markGroupRead, putGroupWindow, putMessageWindow, resolveFileData, resolveSenders,
  senderNameOf, senderPhotoOf,
} from './im-cache.ts'
import { emitYzjDropRequest } from './drop-bus.ts'
import { registerPanelController } from './panel-controller.ts'
import { TodoPane } from './todo-pane.tsx'
import { RobotPane } from './robot-pane.tsx'
import css from './panel.module.css'

/** The props shares the panel reads. */
export interface YzjPanelProps extends YzjPanelInject {
  useStore: <R>(selector: (state: YzjPanelState) => R) => R
  actions: BakedActions<YzjPanelState, YzjPanelActions>
}

type UnknownRecord = Record<string, unknown>

function asRecord(value: unknown): UnknownRecord {
  return typeof value === 'object' && value !== null ? value as UnknownRecord : {}
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

/** One draggable reference payload shared by drag sources and the drop dock. */
export interface YzjDragRef {
  kind: 'workspace' | 'doc' | 'group' | 'event' | 'contact' | 'message' | 'todo'
  id: string
  title: string
  url?: string
  sub?: string
  /** Owning session id for message refs (required for re-fetching the body). */
  group?: string
}

/** MIME type carrying the structured drag payload. */
export const YZJ_DRAG_MIME = 'application/x-dsh-yzj-ref'

/** Human-readable citation text for a drag ref (what lands in the draft). */
export function yzjRefText(ref: YzjDragRef): string {
  const kindLabel: Record<YzjDragRef['kind'], string> = {
    workspace: '知识库', doc: '文档', group: '会话', event: '日程', contact: '联系人', message: '消息', todo: '待办',
  }
  const head = `【云之家·${kindLabel[ref.kind]}】${ref.title}`
  const sub = ref.sub === undefined || ref.sub === '' ? '' : `（${ref.sub}）`
  const url = ref.url === undefined || ref.url === '' ? '' : `\n${ref.url}`
  return `${head}${sub}${url}`
}

/** Wire one draggable item's data transfer. */
function startDragTransfer(event: React.DragEvent, ref: YzjDragRef): void {
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData(YZJ_DRAG_MIME, JSON.stringify(ref))
  event.dataTransfer.setData('text/plain', yzjRefText(ref))
}

/** Outline cloud mark for the Yunzhijia brand, DSH icon-line style. */
export function YzjCloudIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7.5 18.5h9a4.25 4.25 0 0 0 .65-8.45A6 6 0 0 0 5.6 11.3a3.9 3.9 0 0 0 1.9 7.2Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 14.6l2.4 2.3 3.4-3.6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Human-readable label for a raw msgType. */
function typeLabelOf(msgType: string): string {
  if (msgType === 'richText') return '图文'
  if (msgType === 'file') return '文件'
  if (msgType === 'other') return '系统'
  return '消息'
}

/** One-line preview of a message for the group list / drag payload. */
function messagePreview(message: Record<string, unknown>): string {
  const content = asString(message.content)
  const msgType = asString(message.msgType)
  const param = asRecord(message.param)
  if (msgType === 'file') {
    const name = asString(param.name)
    return name === '' ? '[文件]' : `[文件] ${name}`
  }
  if (msgType === 'other' && asString(param.title) !== '') {
    return `[链接] ${asString(param.title)}`
  }
  if (msgType === 'richText') {
    const plain = content.replace(/\[图片\]/g, '[图片]').trim()
    return plain === '' ? '[图文]' : plain
  }
  return content.replace(/\s+/g, ' ').slice(0, 60)
}

/** Drag-chip title for a message (file names and media get real labels). */
function dragTitleOf(message: Record<string, unknown>): string {
  const msgType = asString(message.msgType)
  const param = asRecord(message.param)
  if (msgType === 'file') {
    const name = asString(param.name)
    return name === '' ? '文件消息' : name
  }
  if (msgType === 'richText') return '图文消息'
  const content = asString(message.content)
  return content === '' ? '(消息)' : content
}

/** Group avatar: headerUrl image with first-letter fallback. */
function GroupAvatar({ url, name }: { url: string; name: string }) {
  const [failed, setFailed] = useState(false)
  if (url === '' || failed) return <span className={css.groupGlyph}>{name.slice(0, 1)}</span>
  return (
    <img
      className={css.avatar}
      src={url}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  )
}

/** Chat header inside a group: the group's avatar + name. */
function GroupHead({ groups, groupId }: { groups: unknown[]; groupId: string }) {
  const group = groups.map(asRecord).find(item => asString(item.groupId) === groupId)
  const name = group === undefined ? '群聊' : asString(group.groupName)
  const avatar = group === undefined ? '' : asString(group.headerUrl)
  return (
    <div className={css.groupHead}>
      <GroupAvatar url={avatar} name={name} />
      <span className={css.groupHeadName}>{name}</span>
    </div>
  )
}

/** Sender avatar in a message row: photo with a glyph fallback. */
function SenderAvatar({ openId, fallback }: { openId: string; fallback: string }) {
  const [failed, setFailed] = useState(false)
  const photo = senderPhotoOf(openId)
  if (photo === '' || failed) return <span className={css.msgAvatarFallback}>{fallback.slice(0, 1)}</span>
  return (
    <img
      className={css.msgAvatar}
      src={photo}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  )
}

/**
 * One richText/image/file payload rendered through the file-data proxy
 * (docrest URLs require the authenticated CLI; the panel has no session
 * cookie). Shows a loading placeholder, then the image; failures degrade to
 * a small chip.
 */
function ProxyImage({ fileId, alt, onOpen, inject }: {
  fileId: string
  alt: string
  onOpen: (src: string) => void
  inject: Pick<YzjPanelInject, 'fetchFileData'>
}) {
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    void resolveFileData(fileId, inject).then(dataUrl => {
      if (!alive) return
      if (dataUrl === undefined) setFailed(true)
      else setSrc(dataUrl)
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId])
  if (failed) return <span className={css.msgImageFail}>图片加载失败</span>
  if (src === null) return <span className={css.msgImageSkeleton}>加载中…</span>
  return (
    <img
      className={css.msgImage}
      src={src}
      alt={alt}
      onClick={(event) => {
        event.stopPropagation()
        onOpen(src)
      }}
    />
  )
}

/** Extract a minimal adaptive-card face (image + title + action). */
function cardFace(cardJson: string): { title: string; image: string; actionTitle: string; actionUrl: string } {
  const face = { title: '', image: '', actionTitle: '', actionUrl: '' }
  let parsed: unknown
  try {
    parsed = JSON.parse(cardJson)
  } catch {
    return face
  }
  const walk = (node: unknown): void => {
    if (typeof node !== 'object' || node === null) return
    const record = node as Record<string, unknown>
    if (record.type === 'Image' && typeof record.url === 'string' && face.image === '') face.image = record.url
    if (record.type === 'TextBlock' && typeof record.text === 'string' && record.isSubtle !== true && face.title === '') face.title = record.text
    if (record.type === 'Action.OpenUrl') {
      if (typeof record.title === 'string' && face.actionTitle === '') face.actionTitle = record.title
      if (typeof record.url === 'string' && face.actionUrl === '') face.actionUrl = record.url
    }
    for (const value of Object.values(record)) {
      if (Array.isArray(value)) for (const item of value) walk(item)
      else if (typeof value === 'object' && value !== null) walk(value)
    }
  }
  walk(parsed)
  return face
}

/**
 * One message's body, rendered by msgType: text (bold + emoticon tokens),
 * richText (inline proxy images + text), file (image inline / PDF preview /
 * download chip), other (link card, adaptive card, or system line), withdraw
 * (system line). Images and PDFs open the lightbox.
 */
function MessageBody({ message, onOpenImage, onOpenPdf, inject }: {
  message: Record<string, unknown>
  onOpenImage: (src: string) => void
  onOpenPdf: (src: string) => void
  inject: Pick<YzjPanelInject, 'fetchFileData'>
}) {
  const content = asString(message.content)
  const msgType = asString(message.msgType)
  const param = asRecord(message.param)

  // System rows (撤回 / 入群 / 其他) — centered, tertiary.
  if (msgType === 'other' && asString(param.title) === '' && asRecord(param.interactiveCard).cardJson === undefined) {
    return <span className={css.msgSystem}>{content === '' ? '(系统消息)' : emojiText(content)}</span>
  }
  if (asString(param.sysType) === 'withdrawMsg') {
    return <span className={css.msgSystem}>{content === '' ? '撤回了一条消息' : emojiText(content)}</span>
  }

  // Reply quote above the body.
  const replyMsgId = asString(param.replyMsgId)
  const replySummary = asString(param.replySummary)
  const replyPerson = asString(param.replyPersonName)
  const quote = replyMsgId !== ''
    ? <span className={css.msgQuote} title={replySummary}>{`↳ ${replyPerson === '' ? '' : `${replyPerson}：`}${replySummary}`}</span>
    : null

  // File: image extensions preview inline; PDF previews in the lightbox
  // with a separate 下载 action; everything else downloads on click.
  if (msgType === 'file') {
    const fileId = asString(param.file_id)
    const name = asString(param.name) !== '' ? asString(param.name) : content.replace(/^\[文件\]:/, '')
    const size = formatSize(param.size)
    const ext = asString(param.ext).toLowerCase()
    if (/^(png|jpe?g|gif|webp|bmp)$/.test(ext) && fileId !== '') {
      return (
        <span className={css.msgBody}>
          {quote}
          <ProxyImage fileId={fileId} alt={name} onOpen={onOpenImage} inject={inject} />
        </span>
      )
    }
    const isPdf = ext === 'pdf'
    const icon = isPdf ? '📕'
      : /^(mp4|mov|avi|mkv|webm)$/.test(ext) ? '🎬'
        : /^(xls|xlsx|csv)$/.test(ext) ? '📊'
          : /^(doc|docx|txt|md)$/.test(ext) ? '📄'
            : /^(zip|rar|7z|tar|gz)$/.test(ext) ? '📦'
              : '📎'
    const download = (): void => {
      if (fileId === '') return
      void resolveFileData(fileId, inject).then(dataUrl => {
        if (dataUrl === undefined) return
        const link = document.createElement('a')
        link.href = dataUrl
        link.download = name
        document.body.appendChild(link)
        link.click()
        link.remove()
      })
    }
    return (
      <span className={css.msgBody}>
        {quote}
        <span className={css.msgFileGroup}>
          <button
            type="button"
            className={css.msgFile}
            title={isPdf ? `预览 ${name}` : `下载 ${name}`}
            disabled={fileId === ''}
            onClick={(event) => {
              event.stopPropagation()
              if (fileId === '') return
              if (!isPdf) {
                download()
                return
              }
              void resolveFileData(fileId, inject).then(dataUrl => {
                if (dataUrl !== undefined) onOpenPdf(dataUrl)
              })
            }}
          >
            <span className={css.msgFileIcon}>{icon}</span>
            <span className={css.msgFileMeta}>
              <span className={css.msgFileName}>{name}</span>
              <span className={css.msgFileSize}>{size === '' ? ext === '' ? '文件' : ext.toUpperCase() : size}</span>
            </span>
          </button>
          {isPdf && fileId !== '' && (
            <button
              type="button"
              className={css.msgFileDownload}
              onClick={(event) => {
                event.stopPropagation()
                download()
              }}
            >
              下载
            </button>
          )}
        </span>
      </span>
    )
  }

  // Link card (survey / light app).
  if (msgType === 'other' && asString(param.title) !== '') {
    const title = asString(param.title)
    const thumb = asString(param.thumbUrl)
    const url = asString(param.webpageUrl)
    return (
      <span className={css.msgBody}>
        <a
          className={css.linkCard}
          href={url === '' ? undefined : url}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => { event.stopPropagation() }}
        >
          {thumb !== '' && (
            <img className={css.linkCardThumb} src={thumb} alt="" loading="lazy" referrerPolicy="no-referrer" />
          )}
          <span className={css.linkCardBody}>
            <span className={css.linkCardTitle}>{title}</span>
            <span className={css.linkCardDesc}>{emojiText(content)}</span>
            {url !== '' && <span className={css.linkCardAction}>查看详情 →</span>}
          </span>
        </a>
      </span>
    )
  }

  // Adaptive interactive card: first image + title + action, rendered as a
  // mini card (cloudhub:// deep links stay inert).
  if (msgType === 'other') {
    const card = asRecord(param.interactiveCard)
    const cardJson = asString(card.cardJson)
    const face = cardJson === '' ? { title: '', image: '', actionTitle: '', actionUrl: '' } : cardFace(cardJson)
    const title = face.title !== '' ? face.title : content
    const actionUrl = face.actionUrl.startsWith('http') ? face.actionUrl : ''
    if (face.title !== '' || face.image !== '') {
      return (
        <span className={css.msgBody}>
          <a
            className={css.linkCard}
            href={actionUrl === '' ? undefined : actionUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => { event.stopPropagation() }}
          >
            {face.image !== '' && (
              <img className={css.linkCardThumb} src={face.image} alt="" loading="lazy" referrerPolicy="no-referrer" />
            )}
            <span className={css.linkCardBody}>
              <span className={css.linkCardTitle}>{title}</span>
              <span className={css.linkCardDesc}>{emojiText(content)}</span>
              {actionUrl !== '' && <span className={css.linkCardAction}>{face.actionTitle === '' ? '查看详情' : face.actionTitle} →</span>}
            </span>
          </a>
        </span>
      )
    }
    return <span className={css.msgSystem}>{content === '' ? '(系统消息)' : emojiText(content)}</span>
  }

  // richText: interleave text (with bold + emoticons) and inline images.
  if (msgType === 'richText') {
    const desc = asArray(param.desc)
    const images: { start: number; fileId: string }[] = []
    const bolds: { start: number; length: number }[] = []
    for (const raw of desc) {
      const seg = asRecord(raw)
      const segType = asString(seg.type)
      if (segType === 'image') {
        const fileId = asString(seg.data)
        if (fileId === '') continue
        images.push({ start: typeof seg.start === 'number' ? seg.start : -1, fileId })
      } else if (segType === 'bold' && typeof seg.start === 'number' && typeof seg.length === 'number') {
        bolds.push({ start: seg.start, length: seg.length })
      }
    }
    const sorted = [...images].sort((a, b) => a.start - b.start)
    const spans: { text: string; bold: boolean }[] = []
    const imgSpans: { fileId: string }[] = []
    let cursor = 0
    const inBold = (from: number, to: number): boolean =>
      bolds.some(range => from < range.start + range.length && to > range.start)
    for (const image of sorted) {
      const chunk = content.slice(cursor, image.start).replace(/\[图片\]/g, '')
      if (chunk !== '') spans.push({ text: chunk, bold: inBold(cursor, image.start) })
      imgSpans.push({ fileId: image.fileId })
      cursor = image.start + 4
    }
    const tail = content.slice(cursor).replace(/\[图片\]/g, '')
    if (tail !== '') spans.push({ text: tail, bold: inBold(cursor, content.length) })
    return (
      <span className={css.msgBody}>
        {quote}
        {spans.map((span, index) => (
          <span key={`t${index}`} className={span.bold ? css.msgBold : undefined}>{emojiText(span.text)}</span>
        ))}
        {imgSpans.map((image, index) => (
          <ProxyImage
            key={`i${index}`}
            fileId={image.fileId}
            alt=""
            onOpen={onOpenImage}
            inject={inject}
          />
        ))}
      </span>
    )
  }

  // Plain text (with emoticon tokens).
  return (
    <span className={css.msgBody}>
      {quote}
      {content === '' ? `(${typeLabelOf(msgType)})` : emojiText(content)}
    </span>
  )
}

const TABS: { key: YzjTab; label: string; icon: () => ReactNode }[] = [
  { key: 'docs', label: '知识库', icon: () => <IconFolderOpenOutline16 /> },
  { key: 'calendar', label: '日程', icon: () => <IconChecklistOutline14 /> },
  { key: 'chat', label: '会话', icon: () => <IconNewChatOutline16 /> },
  { key: 'todo', label: '待办', icon: () => <IconListPenOutline16 /> },
  { key: 'robot', label: '机器人', icon: () => <IconRobot16 /> },
]

/** Robot-channel glyph (local: ui-primitives ships no bot icon). */
function IconRobot16(): ReactNode {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="8" width="16" height="12" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M12 8V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="4" r="1.5" fill="currentColor" />
      <circle cx="9" cy="14" r="1.5" fill="currentColor" />
      <circle cx="15" cy="14" r="1.5" fill="currentColor" />
    </svg>
  )
}

/** The sidebar-foot toggle; label and open state ride the store shares. */
export interface YzjPanelButtonProps {
  useStore: <R>(selector: (state: YzjPanelState) => R) => R
  actions: BakedActions<YzjPanelState, YzjPanelActions>
  /** Sidebar column state: wide renders the labeled row, rail the icon. */
  wide: boolean
  /** Fresh recent-session window for the unread badge poll. */
  fetchGroups: (limit?: number, page?: number) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
}

/** Sum the effective (read-aware) unread counts of a recent-session window. */
function unreadTotalOf(value: unknown): number {
  const list = asArray(asRecord(value).list)
  return list.reduce<number>((sum, item) => {
    const group = asRecord(item)
    const server = typeof group.unreadCount === 'number' ? group.unreadCount : 0
    if (server <= 0) return sum
    return sum + effectiveUnread(asString(group.groupId), server)
  }, 0)
}

/** Yunzhijia bracket-emoticon tokens → real emoji (messages use [握手] etc.).
 *  Extended set (issue #1): classic IM expressions plus tokens observed in
 *  real traffic (666/doge/衰/捂脸/裂开/机智/嘻嘻/气球/汽车/钟/话筒…).
 *  Unmatched tokens fall back to the raw [text] — still readable. */
const EMOJI_MAP: Record<string, string> = {
  // smileys & emotions
  微笑: '😊', 呲牙: '😁', 大笑: '😂', 开心: '😄', 愉快: '😀', 调皮: '😜', 机智: '🤓', 得意: '😎',
  害羞: '😳', 难过: '😔', 大哭: '😭', 流泪: '😢', 愤怒: '😡', 惊讶: '😲', 惊恐: '😱', 发呆: '😶',
  睡觉: '😴', 困: '🥱', 疑问: '🤔', 思考: '🤔', 晕: '😵', 憋气: '😤', 抓狂: '🤯', 黑线: '😑',
  闷闷不乐: '🙁', 无语: '😮‍💨', 嘘: '🤫', 吐舌头: '😛', 委屈: '🥺', 鄙视: '🙄', 委屈哭: '🥹',
  奋斗: '💪', 加油: '💪', 强: '👊', 弱: '👎', 赞: '👍', 差评: '👎', 鼓掌: '👏', 抱拳: '🙏',
  握手: '🤝', 胜利: '✌️', 耶: '✌️', OK: '👌', 勾: '✅', 叉: '❌', 对: '✅', 错: '❌',
  心: '❤️', 爱心: '❤️', 心碎: '💔', 玫瑰: '🌹', 郁金香: '🌷', 花朵: '🌸', 向日葵: '🌻',
  咖啡: '☕', 茶: '🍵', 啤酒: '🍺', 干杯: '🍻', 蛋糕: '🎂', 汉堡: '🍔', 西瓜: '🍉', 苹果: '🍎',
  米饭: '🍚', 面: '🍜', 火锅: '🍲', 粽子: '🍙', 月饼: '🥮',
  庆祝: '🎉', 烟花: '🎆', 红包: '🧧', 礼物: '🎁', 蛋糕蜡烛: '🎂', 气球: '🎈', 撒花: '🎊',
  飞机: '✈️', 汽车: '🚗', 火车: '🚄', 火箭: '🚀', 船: '⛵', 自行车: '🚲',
  太阳: '☀️', 月亮: '🌙', 星星: '⭐', 闪电: '⚡', 雨: '🌧️', 雪: '❄️', 云: '☁️', 风: '🍃',
  彩虹: '🌈', 伞: '☔',
  收到: '✅', 求抱抱: '🤗', 比心: '💗', 亲亲: '😘', 飞吻: '😘', 拥抱: '🤗',
  666: '6️⃣', doge: '🐕', 狗头: '🐕', 衰: '😞', 捂脸: '🤦', 裂开: '🥴', 嘻嘻: '😁',
  哈哈: '😆', 嗯嗯: '😐', 呵呵: '🫤', 哦: '🫤', 无奈: '🤷', 耸肩: '🤷', 告辞: '👋',
  再见: '👋', 拜拜: '👋', 你好: '👋', 来吧: '🤝', 稳: '👍', 牛: '🐂', 猪头: '🐷',
  话筒: '🎤', 唱歌: '🎤', 音乐: '🎵', 跳舞: '💃', 电影: '🎬', 游戏: '🎮', 篮球: '🏀',
  足球: '⚽', 乒乓球: '🏓', 奖杯: '🏆', 奖牌: '🏅', 第一: '🥇',
  钟: '⏰', 闹钟: '⏰', 时间: '⏰', 日历: '📅', 电话: '📞', 手机: '📱', 电脑: '💻',
  书: '📖', 笔: '✏️', 文件: '📄', 文档: '📄', 图片: '🖼️', 相机: '📷', 链接: '🔗',
  定位: '📍', 家: '🏠', 公司: '🏢', 学校: '🏫', 医院: '🏥', 银行: '🏦',
  提示: '💡', 灯泡: '💡', 火焰: '🔥', 炸弹: '💣', 刀: '🔪', 锤子: '🔨', 扳手: '🔧',
  钥匙: '🔑', 锁: '🔒', 放大镜: '🔍', 眼睛: '👁️', 耳朵: '👂',
  重要: '❗', 感叹号: '❗', 问号: '❓', 警告: '⚠️', 禁止: '🚫', 停止: '✋',
  上: '⬆️', 下: '⬇️', 左: '⬅️', 右: '➡️', 完成: '✅', 进行中: '⏳', 等待: '⏳',
}

/** Render message text with [token] emoticons mapped to real emoji. */
function emojiText(text: string): ReactNode[] {
  return text.split(/(\[[^\]\n]{1,10}\])/).map((part, index) => {
    if (part.length > 2 && part.startsWith('[') && part.endsWith(']')) {
      const emoji = EMOJI_MAP[part.slice(1, -1)]
      if (emoji !== undefined) return <span key={index}>{emoji}</span>
    }
    return part
  })
}

/**
 * Fire one browser system notification for new unread messages (design v1.6
 * §5.3 layer 3). dsh ships no Notification wrapper — this plugin owns it.
 */
function notifyUnread(total: number, focusPanel: () => void): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    const notice = new Notification('云之家', { body: `${total} 条未读消息` })
    notice.onclick = () => {
      window.focus()
      focusPanel()
    }
  } catch {
    // Some environments (sandboxed iframes) throw on construction.
  }
}

/** Ask for notification permission on first toggle (design §5.3 layer 3). */
function requestNotificationPermission(): void {
  if (typeof Notification === 'undefined') return
  if (Notification.permission === 'default' && typeof Notification.requestPermission === 'function') {
    void Notification.requestPermission()
  }
}

/** The sidebar-foot Yunzhijia toggle (labeled row or rail icon). */
export function YzjPanelButton(props: YzjPanelButtonProps) {  const open = props.useStore(state => state.open)
  const unreadTotal = props.useStore(state => state.unreadTotal)
  // Poll cadence follows the design: ~30s while the panel is open, ~5min
  // while collapsed. New unread counts raise the badge and fire a browser
  // notification once per increase.
  useEffect(() => {
    let last = unreadTotal
    const poll = (): void => {
      void props.fetchGroups(20).then((result) => {
        if (!result.ok) return
        const total = unreadTotalOf(result.value)
        props.actions.setUnreadTotal(total)
        if (total > last && total > 0) notifyUnread(total, () => props.actions.setOpen(true))
        last = total
      })
    }
    poll()
    const interval = window.setInterval(poll, open ? 30_000 : 300_000)
    return () => window.clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const button = (
    <button
      type="button"
      className={open ? `${css.toggle} ${css.toggleActive}` : css.toggle}
      aria-expanded={open}
      onClick={() => {
        requestNotificationPermission()
        props.actions.setOpen(!open)
      }}
      aria-label="云之家"
    >
      <YzjCloudIcon size={props.wide ? 16 : 18} />
      {props.wide && <span className={css.toggleLabel}>云之家</span>}
      {unreadTotal > 0 && (
        <span className={css.unreadBadge} title={`${unreadTotal} 条未读`}>
          {unreadTotal > 99 ? '99+' : unreadTotal}
        </span>
      )}
    </button>
  )
  if (props.wide) return button
  return (
    <Tooltip label="云之家" delayMs={500} side="right">
      {button}
    </Tooltip>
  )
}

/** Shortcut order for the floating ball's hover quick-dock. */
const DOCK_ITEMS: { key: YzjTab; label: string; icon: () => ReactNode }[] = [
  { key: 'chat', label: '会话', icon: () => <IconNewChatOutline16 /> },
  { key: 'todo', label: '待办', icon: () => <IconListPenOutline16 /> },
  { key: 'calendar', label: '日程', icon: () => <IconChecklistOutline14 /> },
  { key: 'docs', label: '知识库', icon: () => <IconFolderOpenOutline16 /> },
  { key: 'robot', label: '机器人', icon: () => <IconRobot16 /> },
]

/** Common emojis for the composer picker (real-IM habit). */
const EMOJI_LIST = ['😀', '😄', '😂', '🤣', '😊', '😍', '🤔', '😎', '😭', '😅', '😉', '🙏', '👍', '👏', '💪', '🔥', '❤️', '🎉', '✅', '❌', '⚠️', '📌', '💡', '🚀']

/** The floating ball: a PERMANENT bottom-right entry — it never disappears,
 *  even while the panel is open (click toggles open/close). Hovering expands
 *  a quick-dock with one shortcut per panel tab. Registered in shell.overlay. */
export interface YzjFloatBallProps {
  useStore: <R>(selector: (state: YzjPanelState) => R) => R
  actions: BakedActions<YzjPanelState, YzjPanelActions>
  /** Fresh recent-session window for the unread badge poll. */
  fetchGroups: (limit?: number, page?: number) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
}

export function YzjFloatBall(props: YzjFloatBallProps) {
  const open = props.useStore(state => state.open)
  const unreadTotal = props.useStore(state => state.unreadTotal)
  const [hover, setHover] = useState(false)

  // The unread poll used to live on the sidebar button; the ball is now the
  // only entry, so it owns the poll. ~60s cadence; an increase raises the
  // badge and fires one browser notification (design §5.3 layer 3).
  useEffect(() => {
    let last = unreadTotal
    const poll = (): void => {
      void props.fetchGroups(20).then((result) => {
        if (!result.ok) return
        const total = unreadTotalOf(result.value)
        props.actions.setUnreadTotal(total)
        if (total > last && total > 0) notifyUnread(total, () => props.actions.setOpen(true))
        last = total
      })
    }
    poll()
    const interval = window.setInterval(poll, 60_000)
    return () => window.clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const openTab = (tab: YzjTab): void => {
    props.actions.setTab(tab)
    props.actions.setOpen(true)
  }
  return (
    <div className={css.floatWrap} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div
        className={hover ? `${css.floatDock} ${css.floatDockOpen}` : css.floatDock}
        role="group"
        aria-label="云之家快捷入口"
      >
        {DOCK_ITEMS.map(item => (
          <button
            key={item.key}
            type="button"
            className={css.floatDockItem}
            title={`${item.label}${item.key === 'chat' && unreadTotal > 0 ? ` · ${unreadTotal} 条未读` : ''}`}
            aria-label={item.label}
            onClick={() => openTab(item.key)}
          >
            {item.icon()}
            <span className={css.floatDockLabel}>{item.label}</span>
            {item.key === 'chat' && unreadTotal > 0 && (
              <span className={css.floatDockBadge}>{unreadTotal > 99 ? '99+' : unreadTotal}</span>
            )}
          </button>
        ))}
      </div>
      <button
        type="button"
        className={open ? `${css.floatBall} ${css.floatBallActive}` : css.floatBall}
        aria-label="云之家悬浮窗"
        aria-expanded={open}
        title={unreadTotal > 0 ? `云之家 · ${unreadTotal} 条未读` : '云之家'}
        onClick={() => {
          requestNotificationPermission()
          props.actions.setOpen(!open)
        }}
      >
        <YzjCloudIcon size={22} />
        {unreadTotal > 0 && (
          <span className={css.floatBallBadge} title={`${unreadTotal} 条未读`}>
            {unreadTotal > 99 ? '99+' : unreadTotal}
          </span>
        )}
      </button>
    </div>
  )
}

/** Load one tab's data into the store through the fetch face. */
function loadTab(
  tab: YzjTab,
  props: YzjPanelProps,
): void {
  const fail = (error: unknown): void => {
    props.actions.setError(typeof error === 'string' ? error : '加载失败')
    props.actions.setLoading(false)
  }
  props.actions.setLoading(true)
  props.actions.setError('')
  if (tab === 'docs') {
    void props.fetchWorkspaces().then((result) => {
      if (result.ok) {
        props.actions.setWorkspaces(asArray(result.value))
        props.actions.setLoading(false)
      } else fail(result.error.message)
    })
  } else if (tab === 'calendar') {
    const pad = (n: number): string => String(n).padStart(2, '0')
    // Opening 日程 always lands on today: cursor month + selected day. A
    // stale persisted selection (or a previously browsed month) must not
    // survive the reopen.
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    props.actions.setCalCursor(year, month)
    props.actions.setCalDay(`${year}-${pad(month)}-${pad(now.getDate())}`)
    props.actions.setCalEventId('')
    const start = `${year}-${pad(month)}-01`
    const end = `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`
    void props.fetchEvents(start, end).then((result) => {
      if (result.ok) {
        props.actions.setCalEvents(asArray(result.value))
        props.actions.setLoading(false)
      } else fail(result.error.message)
    })
  } else if (tab === 'chat') {
    // Group list is cached ~30s so switching tabs is instant.
    const cached = getGroupWindow()
    if (cached !== undefined) {
      props.actions.setGroups(cached.groups)
      props.actions.setGroupsPage(1)
      props.actions.setGroupsMore(cached.more)
      props.actions.setLoading(false)
      return
    }
    // CLI caps --limit at 20; the node half clamps, so ask for the max.
    void props.fetchGroups(20, 1).then((result) => {
      if (result.ok) {
        const groups = asArray(asRecord(result.value).list)
        putGroupWindow(groups, asRecord(result.value).more === true)
        props.actions.setGroups(groups)
        props.actions.setGroupsPage(1)
        props.actions.setGroupsMore(asRecord(result.value).more === true)
        props.actions.setLoading(false)
      } else fail(result.error.message)
    })
  } else if (tab === 'todo') {
    void props.todoState().then((result) => {
      if (result.ok) {
        const value = asRecord(result.value)
        const library = asRecord(value.library)
        props.actions.setTodoState(
          asArray(value.todos),
          value.ready === true,
          typeof library.link === 'string' ? library.link : '',
          typeof value.libraryName === 'string' ? value.libraryName : undefined,
          typeof value.libraryScope === 'string' ? value.libraryScope : undefined,
        )
        props.actions.setTodoLibraries([], typeof value.activeDocId === 'string' ? value.activeDocId : '')
        props.actions.setLoading(false)
        if (typeof value.error === 'string' && value.error !== '') {
          props.actions.setError(`待办读取失败：${value.error}`)
        }
      } else fail(result.error.message)
    })
  } else if (tab === 'robot') {
    // Channel statuses, persisted overrides, and the provider/model catalog
    // in parallel; group names for the robot detail ride a FRESH multi-page
    // group list when the chat-tab cache is absent (a robot's groups may
    // sit outside the newest 20 conversations).
    const loadGroupsFresh = async (): Promise<void> => {
      const pages: unknown[][] = []
      for (let page = 1; page <= 3; page += 1) {
        const result = await props.fetchGroups(20, page)
        if (!result.ok) break
        pages.push(asArray(asRecord(result.value).list))
        if (asRecord(result.value).more !== true) break
      }
      const seen = new Set<string>()
      const merged = pages.flat().filter(item => {
        const id = asString(asRecord(item).groupId)
        if (id === '' || seen.has(id)) return false
        seen.add(id)
        return true
      })
      putGroupWindow(merged, false)
      props.actions.setGroups(merged)
    }
    void Promise.all([
      props.robotStatus(),
      props.robotOverrides(),
      props.robotModels(),
      getGroupWindow() === undefined ? loadGroupsFresh() : Promise.resolve(undefined),
    ]).then(([status, overrides, models]) => {
      if (!status.ok) { fail(status.error.message); return }
      if (!overrides.ok) { fail(overrides.error.message); return }
      props.actions.setRobotData(
        asArray(asRecord(status.value).channels),
        asArray(asRecord(overrides.value).overrides),
        models.ok ? asArray(asRecord(models.value).catalog) : [],
      )
      props.actions.setLoading(false)
      if (!models.ok) props.actions.setError(`模型目录读取失败：${models.error.message}`)
    })
  }
}

/** The frame-overlay Yunzhijia panel; renders null while closed. */
export function YzjPanel(props: YzjPanelProps) {
  const open = props.useStore(state => state.open)
  const tab = props.useStore(state => state.tab)
  // Persisted tabs may hold the removed 'me'; fall back to the docs tab.
  const activeTab: YzjTab = tab === 'docs' || tab === 'calendar' || tab === 'chat' || tab === 'todo' || tab === 'robot' ? tab : 'docs'
  const anchorActive = props.useStore(state => state.anchorMsgId !== '')
  const state = props.useStore(s => s)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const dragOffset = useRef<{ dx: number; dy: number } | null>(null)
  const anchorRef = useRef<HTMLDivElement | null>(null)
  const [anchorToast, setAnchorToast] = useState('')
  const [senderNames, setSenderNames] = useState<Record<string, string>>({})
  const [lightbox, setLightbox] = useState<{ src: string; kind: 'image' | 'pdf' } | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [replyTo, setReplyTo] = useState<{ msgId: string; summary: string } | null>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [myProfile, setMyProfile] = useState<{ openId: string; name: string }>({ openId: '', name: '' })
  const [dropToast, setDropToast] = useState('')
  const [dropArmed, setDropArmed] = useState(false)
  const dropDepth = useRef(0)
  const [docPreview, setDocPreview] = useState<{ title: string; meta: string; lines: string[] } | null>(null)
  /** Folder drill-down trail inside the selected workspace (root = workspace). */
  const [docCrumbs, setDocCrumbs] = useState<{ id: string; title: string }[]>([])
  const [eventDetail, setEventDetail] = useState<{ title: string; time: string; person: string; place: string; content: string } | null>(null)
  const dropToastTimer = useRef<number | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const draftRef = useRef<HTMLTextAreaElement | null>(null)

  // The login user, so "my" messages bubble right with the brand color.
  useEffect(() => {
    void ensureMyProfile(props).then(profile => {
      setMyProfile({ openId: profile.openId, name: profile.name })
      if (profile.openId !== '' && profile.name !== '') {
        setSenderNames(prev => ({ ...prev, [profile.openId]: profile.name }))
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Expose the REAL slot-bound actions to cards (查看详情 / 查看上下文
  // jumps) — apply()-side store.create() is a different instance.
  useEffect(() => registerPanelController(props.actions, props), [])

  // Opening a group marks it read locally (the CLI has no mark-read): the
  // row's unread clears and the floating-ball total drops to what's real.
  useEffect(() => {
    if (state.groupId === '') return
    const group = state.groups.map(asRecord).find(item => asString(item.groupId) === state.groupId)
    if (group === undefined) return
    const serverUnread = typeof group.unreadCount === 'number' ? group.unreadCount : 0
    if (serverUnread <= 0) return
    markGroupRead(state.groupId, serverUnread)
    props.actions.setGroups(state.groups.map(item =>
      asString(asRecord(item).groupId) === state.groupId ? { ...asRecord(item), unreadCount: 0 } : item))
    props.actions.setUnreadTotal(unreadTotalOf({ list: state.groups }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.groupId])

  // Reset the auto-growing textarea after a send clears the draft.
  useEffect(() => {
    if (draft === '' && draftRef.current !== null) draftRef.current.style.height = 'auto'
  }, [draft])

  // Live message sync for the OPEN conversation (issue #2): poll `type:new`
  // anchored on the newest loaded msgId while the panel is open on the chat
  // tab; append whatever arrived and keep the bottom pinned when the user
  // is already there. ~30s matches the unread-badge cadence.
  const atBottomRef = useRef(true)
  // Infinite scroll (older messages): refs only — bisect variant D.
  const chatScrollRef = useRef<{ more: boolean; loading: boolean; loadOlder: () => void }>({ more: false, loading: false, loadOlder: () => {} })
  const scrollRestoreRef = useRef<{ height: number; top: number } | null>(null)
  const lastTopLoadRef = useRef(0)
  useEffect(() => {
    if (!open || activeTab !== 'chat' || state.groupId === '') return
    const poll = (): void => {
      const anchor = state.messages.length > 0
        ? asString(asRecord(state.messages[state.messages.length - 1]).msgId)
        : ''
      const fetch = anchor === ''
        ? props.fetchMessages(state.groupId, 20)
        : props.fetchMessages(state.groupId, 20, { type: 'new', msgId: anchor })
      void fetch.then((result) => {
        if (!result.ok) return
        const fresh = asArray(asRecord(result.value).list)
        if (fresh.length === 0) return
        const known = new Set(state.messages.map(message => String(asRecord(message).msgId)))
        const delta = fresh.filter(message => !known.has(String(asRecord(message).msgId)))
        if (delta.length === 0) return
        props.actions.appendMessages(delta)
        putMessageWindow(state.groupId, [...state.messages, ...delta], state.messagesMore)
        // Opening the group already marks it read; also clear its row badge.
        markGroupRead(state.groupId, delta.length)
        props.actions.setGroups(state.groups.map(item =>
          asString(asRecord(item).groupId) === state.groupId ? { ...asRecord(item), unreadCount: 0 } : item))
        props.actions.setUnreadTotal(unreadTotalOf({ list: state.groups.map(item =>
          asString(asRecord(item).groupId) === state.groupId ? { ...asRecord(item), unreadCount: 0 } : item) }))
        if (atBottomRef.current) {
          const list = listRef.current
          if (list !== null) list.scrollTop = list.scrollHeight
        }
      })
    }
    const interval = window.setInterval(poll, 30_000)
    return () => window.clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeTab, state.groupId, state.messages.length === 0])

  // Track whether the message list is scrolled to the bottom (autoscroll
  // follow vs. keep the user's reading position) — and auto-load the older
  // page when the user reaches the top (infinite scroll). The listener reads
  // flags through chatScrollRef; loadOlderMessages self-registers into it.
  useEffect(() => {
    const list = listRef.current
    if (list === null || activeTab !== 'chat') return
    const onScroll = (): void => {
      atBottomRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 40
      const { more, loading, loadOlder } = chatScrollRef.current
      if (list.scrollTop <= 60 && more && !loading && scrollRestoreRef.current === null
        && Date.now() - lastTopLoadRef.current > 1200) {
        lastTopLoadRef.current = Date.now()
        scrollRestoreRef.current = { height: list.scrollHeight, top: list.scrollTop }
        loadOlder()
      }
    }
    list.addEventListener('scroll', onScroll, { passive: true })
    return () => list.removeEventListener('scroll', onScroll)
  }, [activeTab, state.groupId])
  // Refresh only the FLAGS (the loader registers itself; no forward ref).
  useEffect(() => {
    chatScrollRef.current = { ...chatScrollRef.current, more: state.messagesMore, loading: state.loading }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.messagesMore, state.loading])

  // External jumps (card 查看 → docs preview) set docId without the click
  // handler; fetch the preview when the id changes.
  useEffect(() => {
    if (state.docId === '' || docPreview !== null) return
    loadDocPreview(state.docId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.docId])

  // External jumps (card 查看 → calendar event) set calEventId; enrich the
  // detail once the month's events land.
  useEffect(() => {
    if (state.calEventId === '' || eventDetail !== null) return
    const event = state.calEvents.map(asRecord).find(item => asString(item.id) === state.calEventId)
    if (event !== undefined) pickEvent(event)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.calEventId, state.calEvents])

  // Transient confirmation that a panel drop reached the composer.
  const showDropToast = (title: string): void => {
    setDropToast(`已插入「${title.length > 14 ? `${title.slice(0, 14)}…` : title}」到输入框`)
    if (dropToastTimer.current !== null) window.clearTimeout(dropToastTimer.current)
    dropToastTimer.current = window.setTimeout(() => setDropToast(''), 2600)
  }

  // Drop intake follows the OFFICIAL image-drag implementation: document-level
  // listeners with a depth counter, dropEffect 'copy' while the yzj drag is
  // over the page, and a pointer-inert decorative overlay. The drop lands on
  // whatever is under the cursor (the chat panel, the composer, the panel
  // itself) — nothing is blocked, no full-screen trap.
  useEffect(() => {
    const hasYzj = (event: DragEvent): boolean =>
      event.dataTransfer?.types.includes(YZJ_DRAG_MIME) ?? false
    const reset = (): void => {
      dropDepth.current = 0
      setDropArmed(false)
    }
    const onEnter = (event: DragEvent): void => {
      if (!hasYzj(event)) return
      event.preventDefault()
      dropDepth.current += 1
      setDropArmed(true)
    }
    const onOver = (event: DragEvent): void => {
      if (!hasYzj(event) || event.dataTransfer === null) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
    }
    const onLeave = (event: DragEvent): void => {
      if (!hasYzj(event)) return
      dropDepth.current = Math.max(0, dropDepth.current - 1)
      if (dropDepth.current === 0) setDropArmed(false)
      const leavingViewport = event.clientX <= 0 || event.clientY <= 0
        || event.clientX >= window.innerWidth || event.clientY >= window.innerHeight
      if ((event.target === document.documentElement || event.target === document.body) && leavingViewport) reset()
    }
    const onDrop = (event: DragEvent): void => {
      if (!hasYzj(event)) return
      event.preventDefault()
      reset()
      dropRef(event.dataTransfer?.getData(YZJ_DRAG_MIME) ?? '')
    }
    document.addEventListener('dragenter', onEnter)
    document.addEventListener('dragover', onOver)
    document.addEventListener('dragleave', onLeave)
    document.addEventListener('drop', onDrop)
    window.addEventListener('dragend', reset)
    return () => {
      document.removeEventListener('dragenter', onEnter)
      document.removeEventListener('dragover', onOver)
      document.removeEventListener('dragleave', onLeave)
      document.removeEventListener('drop', onDrop)
      window.removeEventListener('dragend', reset)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dropRef = (raw: string): boolean => {
    if (raw === '') return false
    let ref: YzjDragRef | undefined
    try {
      const parsed = JSON.parse(raw) as YzjDragRef
      if (typeof parsed.kind === 'string' && typeof parsed.title === 'string') ref = parsed
    } catch {
      ref = undefined
    }
    if (ref === undefined) return false
    emitYzjDropRequest(ref)
    showDropToast(ref.title)
    return true
  }

  // Keep the newest messages in view: bottom on group open and after sends,
  // unless an anchor jump is active.
  useEffect(() => {
    if (state.groupId === '' || state.anchorMsgId !== '') return
    const list = listRef.current
    if (list === null) return
    list.scrollTop = list.scrollHeight
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.groupId, state.messages])

  // Resolve sender display names for the loaded message window (cached).
  // The React state mirrors the module cache so newly resolved names
  // re-render; already-cached names are seeded immediately.
  useEffect(() => {
    const openIds = state.messages.map(message => asString(asRecord(message).fromOpenId))
    if (openIds.length === 0) return
    const seeded: Record<string, string> = {}
    for (const openId of openIds) {
      const name = senderNameOf(openId)
      if (name !== '') seeded[openId] = name
    }
    if (Object.keys(seeded).length > 0) setSenderNames(prev => ({ ...prev, ...seeded }))
    void resolveSenders(openIds, props).then(names => {
      if (Object.keys(names).length > 0) setSenderNames(prev => ({ ...prev, ...names }))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.messages])

  // Esc closes the image lightbox.
  useEffect(() => {
    if (lightbox === null) return
    const onKey = (event: KeyboardEvent): void => { if (event.key === 'Escape') setLightbox(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox])

  // @ mention candidates (issue #4): everyone who spoke in the current chat
  // window (name → openId, deduped, self last). The CLI has no group-member
  // list command; the speaker set is the practical roster for mentions.
  const atCandidates = useMemo<{ name: string; openId: string }[]>(() => {
    const seen = new Map<string, { name: string; openId: string }>()
    for (const message of state.messages) {
      const openId = asString(asRecord(message).fromOpenId)
      if (openId === '') continue
      const name = senderNames[openId] ?? ''
      if (name !== '' && !seen.has(name)) seen.set(name, { name, openId })
    }
    return [...seen.values()].filter((candidate: { name: string; openId: string }) => candidate.openId !== myProfile.openId)
  }, [state.messages, senderNames, myProfile.openId])

  // @ menu state: open while the caret types an @fragment; query is the text
  // after the last '@'.
  const [atMenu, setAtMenu] = useState<{ query: string; replaceFrom: number } | null>(null)
  const onDraftChange = (value: string, caret: number): void => {
    setDraft(value)
    if (state.groupId === '') { setAtMenu(null); return }
    const before = value.slice(0, caret)
    const at = before.lastIndexOf('@')
    if (at >= 0) {
      const query = before.slice(at + 1)
      if (/^[\w\u4e00-\u9fa5.·-]*$/.test(query) && query.length <= 12) {
        setAtMenu({ query, replaceFrom: at })
        return
      }
    }
    setAtMenu(null)
  }
  const pickAt = (candidate: { name: string; openId: string }): void => {
    if (atMenu === null) return
    const after = `${draft.slice(0, atMenu.replaceFrom)}@${candidate.name} ${draft.slice(atMenu.replaceFrom + 1 + atMenu.query.length)}`
    setAtMenu(null)
    setDraft(after)
    draftRef.current?.focus()
    requestAnimationFrame(() => {
      const el = draftRef.current
      if (el === null) return
      const pos = atMenu.replaceFrom + candidate.name.length + 2
      el.setSelectionRange(pos, pos)
    })
  }
  const atMatches = atMenu === null ? [] : atCandidates
    .filter(candidate => atMenu.query === '' || candidate.name.toLowerCase().includes(atMenu.query.toLowerCase()))
    .slice(0, 6)

  // Esc dismisses layered UI first (emoji picker → reply bar), then closes
  // the panel itself — the standard floating-panel contract.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || lightbox !== null) return
      if (emojiOpen) { setEmojiOpen(false); return }
      if (replyTo !== null) { setReplyTo(null); return }
      props.actions.setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lightbox, emojiOpen, replyTo])

  // Scroll the jump anchor into view once its group's messages land.
  useEffect(() => {
    if (state.anchorMsgId === '' || anchorRef.current === null) return
    anchorRef.current.scrollIntoView({ block: 'center' })
    setAnchorToast(`已定位到锚点消息（${state.anchorMsgId.slice(0, 12)}…）`)
    const timer = window.setTimeout(() => setAnchorToast(''), 3200)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.messages, state.anchorMsgId])

  useEffect(() => {
    if (!open) return
    const move = (event: PointerEvent): void => {
      if (dragOffset.current === null) return
      const x = Math.max(8, Math.min(event.clientX - dragOffset.current.dx, Math.max(8, window.innerWidth - 880)))
      const y = Math.max(8, Math.min(event.clientY - dragOffset.current.dy, window.innerHeight - 60))
      props.actions.setPanelPosition(x, y)
    }
    const up = (): void => { dragOffset.current = null }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    loadTab(activeTab, props)
    // tab switches and opens are the load triggers; state reads inside the
    // loader come from the snapshot taken at effect time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeTab])

  if (!open) return null

  const startDrag = (event: ReactPointerEvent<HTMLElement>): void => {
    if (event.button !== 0) return
    const rect = panelRef.current?.getBoundingClientRect()
    if (rect === undefined) return
    dragOffset.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top }
    event.preventDefault()
  }

  // Stale persisted positions (saved for the old 460px panel) can push the
  // wide panel off-screen; clamp so it always stays reachable.
  const dockStyle = state.panelX >= 0 && state.panelY >= 0
    ? {
        left: Math.min(state.panelX, Math.max(0, window.innerWidth - 860)),
        top: Math.min(state.panelY, Math.max(0, window.innerHeight - 80)),
        margin: 0,
      }
    : undefined

  /** Fetch one docs level of the workspace; parentId omitted = root. */
  const fetchDocsAt = (workspace: string, parentId?: string): void => {
    props.actions.setLoading(true)
    props.actions.setError('')
    void props.fetchDocs(workspace, parentId).then((result) => {
      if (result.ok) {
        props.actions.setDocs(asArray(result.value))
      } else {
        props.actions.setError(result.error.message)
      }
      props.actions.setLoading(false)
    })
  }

  const openWorkspace = (id: string): void => {
    props.actions.setWorkspaceId(id)
    props.actions.setDocId('')
    setDocPreview(null)
    setDocCrumbs([])
    fetchDocsAt(id)
  }

  /** Drill into a folder node (docs tab): push a crumb, load its children. */
  const openFolder = (id: string, title: string): void => {
    props.actions.setDocId('')
    setDocPreview(null)
    setDocCrumbs(prev => [...prev, { id, title }])
    fetchDocsAt(state.workspaceId, id)
  }

  /** Jump the docs trail back to a crumb (index -1 = workspace root). */
  const jumpCrumb = (index: number): void => {
    const next = index < 0 ? [] : docCrumbs.slice(0, index + 1)
    props.actions.setDocId('')
    setDocPreview(null)
    setDocCrumbs(next)
    const parent = next.length > 0 ? next[next.length - 1]!.id : undefined
    fetchDocsAt(state.workspaceId, parent)
  }

  /** Right-pane doc preview: info + first blocks as text. */
  const loadDocPreview = (id: string): void => {
    setDocPreview(null)
    void Promise.all([props.fetchDoc(id), props.fetchDocBlocks(id)]).then(([infoResult, blocksResult]) => {
      const node = asRecord(infoResult.ok ? infoResult.value : {})
      const title = asString(node.title) === '' ? '文档' : asString(node.title)
      const suffix = asString(node.fileSuffix)
      const meta = [
        suffix === 'dbt' ? '多维表格' : '在线文档',
        asString(node.updateTime).slice(0, 10) === '' ? '' : `更新 ${asString(node.updateTime).slice(0, 10)}`,
        asString(node.creatorName) === '' ? '' : `创建人 ${asString(node.creatorName)}`,
      ].filter(part => part !== '').join(' · ')
      const lines: string[] = []
      if (blocksResult.ok) {
        // The CLI wraps blocks as { data: { blocks: [...] } }. A CONTAINER
        // block mirrors the same children twice — `childNodes` (tree) and
        // `content` (flat array); a LEAF text node carries its string in
        // `content`. Walk the tree when present; only descend into a
        // container's `content` mirror when there is no tree, so every line
        // is emitted exactly once.
        const blocksValue = asRecord(blocksResult.value)
        // The CLI wraps as { data: { blocks: [...] } } (blocks[0] is a
        // root `doc` container whose only children live in its `content`
        // array). A CONTAINER block mirrors children twice — `childNodes`
        // (tree) and `content` (flat array); a LEAF text node carries its
        // string in `content`. Walk the tree when present, otherwise the
        // content array — never both — so each line emits exactly once.
        const blocks = asArray(asRecord(blocksValue.data).blocks ?? blocksValue.blocks)
        const walk = (node2: unknown): void => {
          if (typeof node2 !== 'object' || node2 === null) return
          const record = node2 as Record<string, unknown>
          if (typeof record.type === 'string' && typeof record.content === 'string') {
            const text = record.content.trim()
            if (text !== '' && (record.type === 'heading' || record.type === 'paragraph' || record.type === 'code' || record.type === 'text' || record.type === 'title')) {
              lines.push(text)
              return
            }
          }
          const children = record.childNodes
          if (Array.isArray(children) && children.length > 0) {
            for (const child of children) walk(child)
            return
          }
          for (const [key, value] of Object.entries(record)) {
            if (key === 'content') continue // never the mirror after a leaf check
            if (Array.isArray(value)) for (const item of value) walk(item)
            else if (typeof value === 'object' && value !== null) walk(value)
          }
          // Container with no childNodes (e.g. the root `doc` block): its
          // `content` array IS the only child source — descend last.
          if (Array.isArray(record.content)) {
            for (const item of record.content) walk(item)
          }
        }
        for (const block of blocks) walk(block)
      }
      setDocPreview({ title, meta, lines: lines.slice(0, 200) })
    }).catch(() => setDocPreview({ title: '文档', meta: '', lines: [] }))
  }

  const openDoc = (id: string): void => {
    props.actions.setDocId(id)
    loadDocPreview(id)
  }

  /** Move the calendar cursor and fetch the new month. Landing on the
   *  current month reselects today; other months clear the selection. */
  const moveMonth = (delta: number): void => {
    const next = new Date(state.calYear, state.calMonth - 1 + delta, 1)
    const year = next.getFullYear()
    const month = next.getMonth() + 1
    const now = new Date()
    const pad = (n: number): string => String(n).padStart(2, '0')
    props.actions.setCalCursor(year, month)
    props.actions.setCalDay(year === now.getFullYear() && month === now.getMonth() + 1
      ? `${year}-${pad(month)}-${pad(now.getDate())}`
      : '')
    props.actions.setCalEventId('')
    setEventDetail(null)
    const start = `${year}-${pad(month)}-01`
    const end = `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`
    props.actions.setLoading(true)
    props.actions.setError('')
    void props.fetchEvents(start, end).then((result) => {
      if (result.ok) {
        props.actions.setCalEvents(asArray(result.value))
      } else {
        props.actions.setError(result.error.message)
      }
      props.actions.setLoading(false)
    })
  }

  /** Human day heading for the calendar right pane: 今天 · 周六 / 8月20日 · 周四. */
  const dayHeadLabel = (day: string): string => {
    if (day === '') return ''
    const pad = (n: number): string => String(n).padStart(2, '0')
    const now = new Date()
    const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    const weekdays = ['日', '一', '二', '三', '四', '五', '六']
    const date = new Date(`${day}T00:00:00`)
    const weekday = weekdays[date.getDay()] ?? ''
    const base = day === todayKey ? '今天' : `${Number(day.slice(5, 7))}月${Number(day.slice(8, 10))}日`
    return weekday === '' ? base : `${base} · 周${weekday}`
  }

  /** Jump the calendar back to today and select it. */
  const jumpToToday = (): void => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const pad = (n: number): string => String(n).padStart(2, '0')
    props.actions.setCalCursor(year, month)
    props.actions.setCalDay(`${year}-${pad(month)}-${pad(now.getDate())}`)
    props.actions.setCalEventId('')
    setEventDetail(null)
    props.actions.setLoading(true)
    props.actions.setError('')
    void props.fetchEvents(`${year}-${pad(month)}-01`, `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`).then((result) => {
      if (result.ok) {
        props.actions.setCalEvents(asArray(result.value))
      } else {
        props.actions.setError(result.error.message)
      }
      props.actions.setLoading(false)
    })
  }

  /** Select a calendar day; the right pane lists its events. */
  const pickDay = (day: string): void => {
    props.actions.setCalDay(day)
    props.actions.setCalEventId('')
    setEventDetail(null)
  }

  /** Select an event; enrich with the full detail when needed. */
  const pickEvent = (event: Record<string, unknown>): void => {
    const id = asString(event.id)
    props.actions.setCalEventId(id)
    const clock = (ms: unknown): string => {
      if (typeof ms !== 'number') return ''
      const date = new Date(ms)
      const pad = (n: number): string => String(n).padStart(2, '0')
      return `${pad(date.getHours())}:${pad(date.getMinutes())}`
    }
    const start = clock(event.startDate)
    const end = clock(event.endDate)
    const base = {
      title: asString(event.title),
      time: start === '' ? '' : `${start}${end === '' ? '' : ` → ${end}`}`,
      person: asString(event.personName),
      place: asString(event.meetingPlace),
      content: asString(event.content),
    }
    if (base.content !== '') {
      setEventDetail(base)
      return
    }
    void props.fetchEvent(id).then((result) => {
      if (!result.ok) {
        setEventDetail(base)
        return
      }
      const detail = asRecord(result.value)
      const ms = typeof detail.startDate === 'number' ? detail.startDate : typeof event.startDate === 'number' ? event.startDate : 0
      const start2 = clock(ms)
      const endMs = typeof detail.endDate === 'number' ? detail.endDate : typeof event.endDate === 'number' ? event.endDate : 0
      const end2 = clock(endMs)
      setEventDetail({
        title: asString(detail.title) === '' ? base.title : asString(detail.title),
        time: start2 === '' ? base.time : `${start2}${end2 === '' ? '' : ` → ${end2}`}`,
        person: asString(detail.personName) === '' ? base.person : asString(detail.personName),
        place: asString(detail.meetingPlace),
        content: asString(detail.content),
      })
    }).catch(() => setEventDetail(base))
  }

  const openGroup = (id: string): void => {
    props.actions.setGroupId(id)
    props.actions.setAnchorMsgId('')
    setDraft('')
    // Rendered window is cached ~60s: revisiting a group is instant.
    const cached = getMessageWindow(id)
    if (cached !== undefined) {
      props.actions.setMessages(cached.messages)
      props.actions.setMessagesMore(cached.more)
      // The CLI returns messages OLDEST-first; the oldest id is the next
      // anchor for paging further back.
      props.actions.setMessagesAnchor(
        cached.messages.length > 0 ? asString(asRecord(cached.messages[0]).msgId) : '',
      )
      props.actions.setLoading(false)
      return
    }
    props.actions.setLoading(true)
    props.actions.setError('')
    void props.fetchMessages(id, 20).then((result) => {
      if (result.ok) {
        // The CLI already returns oldest-first, which is exactly the chat
        // reading order — do NOT reverse.
        const messages = asArray(asRecord(result.value).list)
        putMessageWindow(id, messages, asRecord(result.value).more === true)
        props.actions.setMessages(messages)
        props.actions.setMessagesMore(asRecord(result.value).more === true)
        props.actions.setMessagesAnchor(messages.length > 0 ? asString(asRecord(messages[0]).msgId) : '')
      } else {
        props.actions.setError(result.error.message)
      }
      props.actions.setLoading(false)
    })
  }

  const loadMoreGroups = (): void => {
    if (state.loading) return
    props.actions.setLoading(true)
    void props.fetchGroups(20, state.groupsPage + 1).then((result) => {
      if (result.ok) {
        props.actions.appendGroups(asArray(asRecord(result.value).list))
        props.actions.setGroupsPage(state.groupsPage + 1)
        props.actions.setGroupsMore(asRecord(result.value).more === true)
      } else {
        props.actions.setError(result.error.message)
      }
      props.actions.setLoading(false)
    })
  }

  // Keep the scroll listener's facts fresh: the loader SELF-REGISTERS here
  // (no forward references); flags are refreshed by the effect above.
  const loadOlderMessages = (): void => {
    if (state.loading || state.messagesAnchor === '') return
    chatScrollRef.current = { ...chatScrollRef.current, loadOlder: loadOlderMessages }
    props.actions.setLoading(true)
    void props.fetchMessages(state.groupId, 20, { type: 'old', msgId: state.messagesAnchor }).then((result) => {
      if (result.ok) {
        // type 'old' returns messages OLDER than the anchor, oldest-first —
        // prepend as-is so the top of the list stays the oldest message.
        const older = asArray(asRecord(result.value).list)
        props.actions.prependMessages(older)
        putMessageWindow(state.groupId, [...older, ...state.messages], asRecord(result.value).more === true)
        props.actions.setMessagesMore(asRecord(result.value).more === true)
        if (older.length > 0) {
          props.actions.setMessagesAnchor(asString(asRecord(older[0]).msgId))
        }
        // Position restore AFTER the prepend lands: shift scrollTop by the
        // height the older page added above the user's reading position.
        requestAnimationFrame(() => {
          const restore = scrollRestoreRef.current
          scrollRestoreRef.current = null
          const list = listRef.current
          if (restore === null || list === null) return
          const delta = list.scrollHeight - restore.height
          if (delta > 0) list.scrollTop = restore.top + delta
        })
      } else {
        props.actions.setError(result.error.message)
        // A failed page leaves the restore armed forever; drop it so the
        // user can scroll-top again to retry.
        scrollRestoreRef.current = null
      }
      props.actions.setLoading(false)
    })
  }
  // Self-register on every render so the listener always has the freshest
  // closure (state snapshot) without any forward reference.
  chatScrollRef.current = { ...chatScrollRef.current, loadOlder: loadOlderMessages }

  /** Core send: calls the bridge, appends the local message, clears state. */
  const doSend = async (opts: {
    content?: string
    msgType?: 'text' | 'richText' | 'file'
    fileId?: string
    images?: string[]
    replyMsgId?: string
    fileName?: string
    fileSize?: number
    atOpenIds?: string[]
    atAll?: boolean
  }): Promise<void> => {
    if (state.groupId === '') return
    const groupId = state.groupId
    const result = await props.sendMessage(groupId, opts.content, {
      ...(opts.msgType === undefined ? {} : { msgType: opts.msgType }),
      ...(opts.fileId === undefined ? {} : { fileId: opts.fileId }),
      ...(opts.images === undefined ? {} : { images: opts.images }),
      ...(opts.replyMsgId === undefined ? {} : { replyMsgId: opts.replyMsgId }),
      ...(opts.atOpenIds === undefined || opts.atOpenIds.length === 0 ? {} : { atOpenIds: opts.atOpenIds }),
      ...(opts.atAll !== true ? {} : { atAll: true }),
    })
    if (!result.ok) {
      props.actions.setError(result.error.message)
      return
    }
    const profile = await ensureMyProfile(props)
    const payload = asRecord(result.value)
    const now = new Date()
    const pad = (n: number): string => String(n).padStart(2, '0')
    const sendTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.000`
    const msgType = opts.msgType ?? 'text'
    const sent: Record<string, unknown> = {
      msgId: asString(payload.msgId ?? payload.id) === '' ? `local-${now.getTime()}` : asString(payload.msgId ?? payload.id),
      content: opts.content ?? '',
      msgType,
      sendTime,
      fromOpenId: profile.openId,
      param: {
        ...(opts.replyMsgId === undefined ? {} : { replyMsgId: opts.replyMsgId }),
        ...(opts.replyMsgId !== undefined && opts.content !== undefined ? { replySummary: opts.content.slice(0, 80) } : {}),
        ...(msgType === 'file'
          ? { file_id: opts.fileId ?? '', name: opts.fileName ?? '', size: opts.fileSize ?? 0, ext: (opts.fileName ?? '').split('.').pop() ?? '' }
          : {}),
        ...(msgType === 'richText' && opts.images !== undefined && opts.images.length > 0
          ? {
              desc: opts.images.map((fileId) => ({
                type: 'image',
                data: fileId,
                start: (opts.content ?? '').indexOf('[图片]'),
                length: 4,
              })),
            }
          : {}),
      },
    }
    if (profile.openId !== '' && profile.name !== '') {
      setSenderNames(prev => ({ ...prev, [profile.openId]: profile.name }))
    }
    const next = [...state.messages, sent]
    props.actions.setMessages(next)
    putMessageWindow(groupId, next, state.messagesMore)
    setDraft('')
    setReplyTo(null)
    const list = listRef.current
    if (list !== null) list.scrollTop = list.scrollHeight
  }

  /** Plain-text send (Enter / 发送 button). */
  const submitMessage = (): void => {
    const content = draft.trim()
    if (content === '' || sending || uploading || state.groupId === '') return
    // @ mentions (issue #4): one atOpenId per @姓名 fragment, in order —
    // resolved against the chat's known senders (name → openId).
    const atOpenIds: string[] = []
    let atAll = false
    for (const frag of content.match(/@[^@\s，,、]+/g) ?? []) {
      if (frag === '@all') { atAll = true; continue }
      const openId = atCandidates.find(candidate => frag === `@${candidate.name}`)?.openId ?? ''
      if (openId === '') {
        props.actions.setError(`未找到 @${frag.slice(1)} 的成员（候选来自本会话发言者）；请从 @ 菜单选择`)
        return
      }
      atOpenIds.push(openId)
    }
    setSending(true)
    const replyMsgId = replyTo?.msgId
    const send = replyMsgId === undefined ? { content, atOpenIds, atAll } : { content, replyMsgId, atOpenIds, atAll }
    void doSend(send)
      .finally(() => setSending(false))
  }

  /** Upload a picked file, then send it as an image (richText) or file. */
  const handlePickFile = (kind: 'image' | 'file', file: File | undefined): void => {
    if (file === undefined) return
    if (file.size > 24 * 1024 * 1024) {
      props.actions.setError('文件超过 24MB，请压缩后重试')
      return
    }
    const reader = new FileReader()
    reader.onload = (): void => {
      const base64 = typeof reader.result === 'string' ? reader.result.split(',')[1] ?? '' : ''
      if (base64 === '') return
      setUploading(true)
      void props.uploadFile(file.name, base64, file.size).then(async (result) => {
        if (!result.ok) {
          props.actions.setError(result.error.message)
          return
        }
        const payload = asRecord(result.value)
        const fileId = asString(payload.fileId ?? payload.file_id ?? payload.id)
        if (fileId === '') {
          props.actions.setError('上传失败：未返回文件 ID')
          return
        }
        if (kind === 'image') {
          const text = draft.trim()
          const content = text === '' ? '[图片]' : `${text}\n[图片]`
          const replyMsgId = replyTo?.msgId
          await doSend(replyMsgId === undefined
            ? { content, msgType: 'richText', images: [fileId] }
            : { content, msgType: 'richText', images: [fileId], replyMsgId })
        } else {
          await doSend({ msgType: 'file', fileId, fileName: file.name, fileSize: file.size })
        }
      }).finally(() => setUploading(false))
    }
    reader.readAsDataURL(file)
  }

  return (
    <div
      ref={panelRef}
      className={css.panel}
      role="dialog"
      aria-label="云之家"
      style={dockStyle}
    >
      <header className={css.header} onPointerDown={startDrag}>
        <span className={css.brand}><YzjCloudIcon size={18} /></span>
        <span className={css.title}>云之家</span>
        <span className={css.headerSpacer} />
        <button
          type="button"
          className={css.iconButton}
          onClick={() => { loadTab(activeTab, props) }}
          disabled={state.loading}
          aria-label="刷新"
          title="刷新"
          onPointerDown={(event) => { event.stopPropagation() }}
        >
          <IconRefresh14 />
        </button>
        <button
          type="button"
          className={css.iconButton}
          onClick={() => { props.actions.setOpen(false) }}
          aria-label="关闭"
          title="关闭"
          onPointerDown={(event) => { event.stopPropagation() }}
        >
          <IconClose14 />
        </button>
      </header>
      <nav className={css.tabs} aria-label="云之家功能" onPointerDown={(event) => { event.stopPropagation() }}>
        {TABS.map(item => (
          <button
            key={item.key}
            type="button"
            className={activeTab === item.key ? `${css.tab} ${css.tabActive}` : css.tab}
            aria-current={activeTab === item.key ? 'page' : undefined}
            onClick={() => { props.actions.setTab(item.key) }}
          >
            {item.icon()}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {state.error !== '' && (
        <div className={css.error} role="alert">
          <span className={css.errorText}>{state.error}</span>
          <button
            type="button"
            className={css.errorDismiss}
            onClick={() => { props.actions.setError('') }}
            aria-label="忽略错误"
          >
            <IconClose14 />
          </button>
        </div>
      )}
      {state.loading && <div className={css.loading}>加载中…</div>}

      {activeTab === 'docs' && (
        <div className={css.body}>
          <div className={css.twoPane}>
            <div className={css.paneLeft}>
              <div className={css.paneList}>
                {state.workspaces.length === 0 && !state.loading && state.error === '' && (
                  <div className={css.empty}><YzjCloudIcon size={28} /><span>暂无知识库</span></div>
                )}
                {state.workspaces.map((item, index) => {
                  const ws = asRecord(item)
                  const count = typeof ws.docCount === 'number' ? ws.docCount : 0
                  const members = typeof ws.memberCount === 'number' ? ws.memberCount : 0
                  const id = asString(ws.id)
                  const name = asString(ws.name)
                  const active = id === state.workspaceId
                  return (
                    <button
                      key={`w${index}`}
                      type="button"
                      className={active ? `${css.item} ${css.itemActive}` : css.item}
                      onClick={() => { openWorkspace(id) }}
                      draggable
                      onDragStart={(event) => {
                        startDragTransfer(event, { kind: 'workspace', id, title: name, sub: `文档 ${count} · 成员 ${members}` })
                      }}
                    >
                      <span className={css.itemTitle}>
                        <IconFolderOpenOutline16 />
                        <span className={css.itemTitleText}>{name}</span>
                      </span>
                      <span className={css.itemSub}>文档 {count} · 成员 {members}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            <div className={css.paneRight}>
              {state.docId !== '' ? (
                docPreview === null ? (
                  <div className={css.paneEmpty}>加载中…</div>
                ) : (
                  <div className={css.paneList}>
                    <div className={css.paneHead}>
                      <button type="button" className={css.back} onClick={() => { props.actions.setDocId('') }}>
                        <IconChevronLeft14 /> 返回文档
                      </button>
                      <span className={css.paneTitle}>{docPreview.title}</span>
                    </div>
                    {docPreview.meta !== '' && <div className={css.docMeta}>{docPreview.meta}</div>}
                    <div className={css.docBody}>
                      {docPreview.lines.length === 0
                        ? '（无文本内容，可拖拽引用或在新标签打开）'
                        : docPreview.lines.map((line, i) => <div key={i}>{line}</div>)}
                    </div>
                  </div>
                )
              ) : state.workspaceId === '' ? (
                <div className={css.paneEmpty}><YzjCloudIcon size={28} /><span>选择左侧知识库查看文档</span></div>
              ) : (
                <div className={css.paneList}>
                  <div className={css.paneHead}>
                    {docCrumbs.length === 0 ? (
                      <span className={css.paneTitle}>
                        {asString(state.workspaces.map(asRecord).find(ws => asString(ws.id) === state.workspaceId)?.name ?? '知识库')}
                      </span>
                    ) : (
                      <nav className={css.crumbs} aria-label="文档位置">
                        <button type="button" className={css.crumbLink} onClick={() => { jumpCrumb(-1) }}>
                          {asString(state.workspaces.map(asRecord).find(ws => asString(ws.id) === state.workspaceId)?.name ?? '知识库')}
                        </button>
                        {docCrumbs.map((crumb, index) => (
                          <span key={crumb.id} className={css.crumbItem}>
                            <span className={css.crumbSep} aria-hidden="true">/</span>
                            {index === docCrumbs.length - 1
                              ? <span className={css.crumbCurrent}>{crumb.title}</span>
                              : (
                                  <button type="button" className={css.crumbLink} onClick={() => { jumpCrumb(index) }}>
                                    {crumb.title}
                                  </button>
                                )}
                          </span>
                        ))}
                      </nav>
                    )}
                  </div>
                  {state.docs.length === 0 && !state.loading && state.error === '' && <div className={css.empty}>暂无文档</div>}
                  {state.docs.map((item, index) => {
                    const node = asRecord(item)
                    const suffix = asString(node.fileSuffix)
                    const title = asString(node.title)
                    const id = asString(node.id)
                    const url = asString(node.openWebUrl)
                    const hasChildren = node.hasChildren === true
                      || (typeof node.childrenCount === 'number' && node.childrenCount > 0)
                    return (
                      <div key={`d${index}`} className={css.docRowWrap}>
                        <button
                          type="button"
                          className={css.item}
                          onClick={() => { openDoc(id) }}
                          draggable
                          onDragStart={(event) => {
                            startDragTransfer(event, {
                              kind: 'doc', id, title, url,
                              sub: `${suffix === 'dbt' ? '多维表格' : '在线文档'} · ${asString(node.updateTime).slice(0, 10)}`,
                            })
                          }}
                        >
                          <span className={css.itemTitle}>
                            <span className={css.docGlyph}>{suffix === 'dbt' ? '表' : '文'}</span>
                            <span className={css.itemTitleText}>{title}</span>
                          </span>
                          <span className={css.itemSub}>
                            {suffix === 'dbt' ? '多维表格' : '在线文档'} · {asString(node.updateTime).slice(0, 10)}
                            {hasChildren && typeof node.childrenCount === 'number' ? ` · ${node.childrenCount} 个子项` : ''}
                          </span>
                        </button>
                        {hasChildren && (
                          <button
                            type="button"
                            className={css.drill}
                            title={`打开「${title}」`}
                            aria-label={`打开文件夹 ${title}`}
                            onClick={() => { openFolder(id, title) }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'calendar' && (
        <div className={css.body}>
          <div className={css.twoPane}>
            <div className={css.paneLeft}>
              <div className={css.calHead}>
                <button type="button" className={css.calNav} aria-label="上个月" onClick={() => moveMonth(-1)}>‹</button>
                <span className={css.calTitle}>{state.calYear}年{state.calMonth}月</span>
                <button type="button" className={css.calNav} aria-label="下个月" onClick={() => moveMonth(1)}>›</button>
                <button type="button" className={css.calToday} onClick={jumpToToday} title="回到今天">今天</button>
              </div>
              <div className={css.calGrid}>
                {['一', '二', '三', '四', '五', '六', '日'].map(day => (
                  <div key={day} className={css.calDow}>{day}</div>
                ))}
                {(() => {
                  const firstDow = (new Date(state.calYear, state.calMonth - 1, 1).getDay() + 6) % 7
                  const daysInMonth = new Date(state.calYear, state.calMonth, 0).getDate()
                  const pad = (n: number): string => String(n).padStart(2, '0')
                  const todayKey = `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}-${pad(new Date().getDate())}`
                  const eventsByDay = new Map<string, number>()
                  for (const item of state.calEvents) {
                    const event = asRecord(item)
                    if (typeof event.startDate !== 'number') continue
                    const date = new Date(event.startDate)
                    const key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
                    eventsByDay.set(key, (eventsByDay.get(key) ?? 0) + 1)
                  }
                  const cells = []
                  for (let i = 0; i < firstDow; i++) cells.push(<div key={`b${i}`} className={css.calBlank} />)
                  for (let day = 1; day <= daysInMonth; day++) {
                    const key = `${state.calYear}-${pad(state.calMonth)}-${pad(day)}`
                    const count = eventsByDay.get(key) ?? 0
                    const classes = [
                      css.calCell,
                      key === todayKey ? css.calCellToday : '',
                      key === state.calDay ? css.calCellSelected : '',
                      count > 0 ? css.calCellHas : '',
                    ].filter(Boolean).join(' ')
                    cells.push(
                      <button
                        key={key}
                        type="button"
                        className={classes}
                        aria-label={key}
                        onClick={() => pickDay(key)}
                      >
                        <span className={css.calDayNum}>{day}</span>
                        {count > 0 && <span className={css.calDot} title={`${count} 个日程`} />}
                      </button>,
                    )
                  }
                  return cells
                })()}
              </div>
            </div>
            <div className={css.paneRight}>
              {state.calDay === '' ? (
                <div className={css.paneEmpty}><IconChecklistOutline14 /><span>选择左侧日期查看日程</span></div>
              ) : (
                <div className={css.paneList}>
                  <div className={css.paneHead}>
                    <span className={css.paneTitle}>{dayHeadLabel(state.calDay)}</span>
                  </div>
                  {(() => {
                    const pad = (n: number): string => String(n).padStart(2, '0')
                    const dayEvents = state.calEvents.filter((item) => {
                      const event = asRecord(item)
                      if (typeof event.startDate !== 'number') return false
                      const date = new Date(event.startDate)
                      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` === state.calDay
                    })
                    if (dayEvents.length === 0) {
                      return <div className={css.empty}>当天暂无日程</div>
                    }
                    return dayEvents.map((item, index) => {
                      const event = asRecord(item)
                      const clock = (ms: unknown): string => {
                        if (typeof ms !== 'number') return ''
                        const date = new Date(ms)
                        const p = (n: number): string => String(n).padStart(2, '0')
                        return `${p(date.getHours())}:${p(date.getMinutes())}`
                      }
                      const start = clock(event.startDate)
                      const end = clock(event.endDate)
                      const timeText = start === '' ? '' : `${start}${end === '' ? '' : ` → ${end}`}`
                      const title = asString(event.title)
                      const person = asString(event.personName)
                      const place = asString(event.meetingPlace)
                      const id = asString(event.id)
                      const active = id === state.calEventId
                      return (
                        <button
                          key={`e${index}`}
                          type="button"
                          className={active ? `${css.item} ${css.itemActive}` : css.item}
                          onClick={() => pickEvent(event)}
                          draggable
                          onDragStart={(event) => {
                            startDragTransfer(event, {
                              kind: 'event', id, title,
                              sub: [timeText, person].filter(part => part !== '').join(' · '),
                            })
                          }}
                        >
                          <span className={css.eventTime}>{timeText === '' ? '全天' : timeText}</span>
                          <span className={css.itemTitleText}>{title}</span>
                          <span className={css.itemSub}>
                            {[person, place].filter(part => part !== '').join(' · ')}
                          </span>
                        </button>
                      )
                    })
                  })()}
                  {eventDetail !== null && state.calEventId !== '' && (
                    <div className={css.eventDetail}>
                      <div className={css.eventDetailTitle}>{eventDetail.title}</div>
                      {eventDetail.time !== '' && <div className={css.eventDetailRow}>🕐 {eventDetail.time}</div>}
                      {eventDetail.person !== '' && <div className={css.eventDetailRow}>👤 {eventDetail.person}</div>}
                      {eventDetail.place !== '' && <div className={css.eventDetailRow}>📍 {eventDetail.place}</div>}
                      {eventDetail.content !== '' && <div className={css.eventDetailContent}>{eventDetail.content}</div>}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'chat' && (
        <div className={css.body}>
          <div className={css.twoPane}>
            <div className={css.paneLeft}>
              <div className={css.readAllRow}>
                <span className={css.readAllHint}>
                  {state.unreadTotal > 0 ? `共 ${state.unreadTotal > 99 ? '99+' : state.unreadTotal} 条未读` : '没有未读消息'}
                </span>
                <button
                  type="button"
                  className={css.readAll}
                  disabled={state.unreadTotal === 0}
                  onClick={() => {
                    markAllRead(state.groups)
                    props.actions.setGroups(state.groups.map(item => ({ ...asRecord(item), unreadCount: 0 })))
                    props.actions.setUnreadTotal(0)
                  }}
                >
                  全部已读
                </button>
              </div>
              <div className={css.paneList}>
              {state.groups.length === 0 && !state.loading && state.error === '' && (
                <div className={css.empty}><IconNewChatOutline16 /><span>暂无最近会话</span></div>
              )}
              {state.groups.map((item, index) => {
                const group = asRecord(item)
                const unread = effectiveUnread(asString(group.groupId), typeof group.unreadCount === 'number' ? group.unreadCount : 0)
                const name = asString(group.groupName)
                const lastTime = formatListTime(group.lastMsgSendTime)
                const preview = messagePreview(asRecord(group.lastMsg))
                const active = asString(group.groupId) === state.groupId
                return (
                  <button
                    key={`g${index}`}
                    type="button"
                    className={active ? `${css.item} ${css.itemActive}` : css.item}
                    onClick={() => { openGroup(asString(group.groupId)) }}
                    draggable
                    onDragStart={(event) => {
                      startDragTransfer(event, {
                        kind: 'group', id: asString(group.groupId), title: name,
                        sub: preview.replace(/\s+/g, ' ').slice(0, 40),
                      })
                    }}
                  >
                    <span className={css.itemTitle}>
                      <GroupAvatar url={asString(group.headerUrl)} name={name} />
                      <span className={css.itemTitleText}>{name}</span>
                      {lastTime !== '' && <span className={css.itemTime}>{lastTime}</span>}
                      {unread > 0 && <span className={css.badge}>{unread > 99 ? '99+' : unread}</span>}
                    </span>
                    <span className={css.itemSub}>{preview}</span>
                  </button>
                )
              })}
              {state.groupsMore && (
                <button type="button" className={css.more} onClick={loadMoreGroups} disabled={state.loading}>
                  {state.loading ? '加载中…' : '加载更多会话'}
                </button>
              )}
            </div>
            </div>
            <div className={css.paneRight}>
            {state.groupId === '' ? (
                <div className={css.paneEmpty}><IconNewChatOutline16 /><span>选择左侧会话查看消息</span></div>
            ) : (
            <>
              <div className={css.chatHeader}>
                <GroupHead groups={state.groups} groupId={state.groupId} />
              </div>
              {anchorActive && (
                <div className={css.anchorHint} role="status">
                  已定位到锚点消息（来自「查看上下文」）
                </div>
              )}
              <div className={css.list} ref={listRef}>
              {state.messages.length === 0 && !state.loading && state.error === '' && <div className={css.empty}>暂无消息</div>}
              {state.messagesMore && (
                <button type="button" className={css.more} onClick={loadOlderMessages} disabled={state.loading}>
                  {state.loading ? '加载中…' : '加载更早消息'}
                </button>
              )}
              {state.messages.map((item, index) => {
                const message = asRecord(item)
                const msgType = asString(message.msgType)
                const sendTime = formatMsgTime(message.sendTime)
                const msgId = asString(message.msgId)
                const fromOpenId = asString(message.fromOpenId)
                const mine = myProfile.openId !== '' && fromOpenId === myProfile.openId
                const sender = fromOpenId === '' ? '' : senderNames[fromOpenId] ?? ''
                const anchored = msgId !== '' && msgId === state.anchorMsgId
                // Date divider: a new day between consecutive messages.
                const dayKey = String(message.sendTime).slice(0, 10)
                const prevDay = index > 0 ? String(asRecord(state.messages[index - 1]).sendTime).slice(0, 10) : ''
                const dayLabel = dayKey === '' ? '' : formatListTime(`${dayKey} 00:00:00`)
                const isSystem = msgType === 'other' || asString(asRecord(message.param).sysType) === 'withdrawMsg'
                return (
                  <div key={`m${index}`}>
                    {dayKey !== '' && dayKey !== prevDay && (
                      <div className={css.dayDivider}>{dayLabel}</div>
                    )}
                    <div
                      ref={anchored ? anchorRef : undefined}
                      className={[
                        css.msgRow,
                        isSystem ? css.msgRowSystem : '',
                        anchored ? css.itemAnchored : '',
                      ].filter(Boolean).join(' ')}
                      draggable
                      onDragStart={(event) => {
                        startDragTransfer(event, {
                          kind: 'message', id: msgId,
                          title: dragTitleOf(message),
                          sub: sendTime,
                          group: state.groupId,
                        })
                      }}
                    >
                      <span className={css.grip} aria-hidden="true">
                        <svg viewBox="0 0 10 16" fill="currentColor" width="10" height="16">
                          <circle cx="3" cy="3" r="1.4" /><circle cx="7" cy="3" r="1.4" />
                          <circle cx="3" cy="8" r="1.4" /><circle cx="7" cy="8" r="1.4" />
                          <circle cx="3" cy="13" r="1.4" /><circle cx="7" cy="13" r="1.4" />
                        </svg>
                      </span>
                      {!isSystem && (
                        <SenderAvatar openId={fromOpenId} fallback={sender === '' ? typeLabelOf(msgType) : sender} />
                      )}
                      <span className={css.msgStack}>
                        {!isSystem && (
                          <span className={css.msgMetaLine}>
                            <span className={css.msgSender}>{sender === '' ? typeLabelOf(msgType) : sender}{mine ? '（我）' : ''}</span>
                            <span className={css.msgTime}>{sendTime}</span>
                            {anchored && <span className={css.anchorTag}>锚点</span>}
                          </span>
                        )}
                        <span className={css.msgContent}>
                          <MessageBody
                            message={message}
                            onOpenImage={(src) => setLightbox({ src, kind: 'image' })}
                            onOpenPdf={(src) => setLightbox({ src, kind: 'pdf' })}
                            inject={props}
                          />
                        </span>
                        {!isSystem && (
                          <button
                            type="button"
                            className={css.msgReply}
                            title="回复此消息"
                            aria-label="回复"
                            onClick={() => {
                              setReplyTo({ msgId, summary: dragTitleOf(message) })
                              draftRef.current?.focus()
                            }}
                          >
                            回复
                          </button>
                        )}
                      </span>
                    </div>
                  </div>
                )
              })}
              {anchorToast !== '' && (
                <div className={css.panelToast} role="status">{anchorToast}</div>
              )}
              </div>
              <div className={css.composer}>
                {replyTo !== null && (
                  <div className={css.replyBar}>
                    <span className={css.replyText}>回复：{replyTo.summary.length > 40 ? `${replyTo.summary.slice(0, 40)}…` : replyTo.summary}</span>
                    <button
                      type="button"
                      className={css.replyCancel}
                      aria-label="取消回复"
                      onClick={() => setReplyTo(null)}
                    >
                      ✕
                    </button>
                  </div>
                )}
                {emojiOpen && (
                  <div className={css.emojiPanel} role="group" aria-label="表情">
                    {EMOJI_LIST.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        className={css.emojiCell}
                        onClick={() => {
                          setDraft(draft + emoji)
                          draftRef.current?.focus()
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
                <div className={css.composerRow}>
                  <textarea
                    ref={draftRef}
                    className={css.composerInput}
                    value={draft}
                    rows={1}
                    onChange={(event) => {
                      onDraftChange(event.target.value, event.target.selectionStart ?? event.target.value.length)
                      const el = event.target
                      el.style.height = 'auto'
                      el.style.height = `${Math.min(el.scrollHeight, 120)}px`
                    }}
                    onBlur={(): void => { window.setTimeout(() => setAtMenu(null), 150) }}
                    onKeyDown={(event) => {
                      if (atMenu !== null && atMatches.length > 0) {
                        if (event.key === 'Escape') { setAtMenu(null); return }
                        if (event.key === 'Tab' || (event.key === 'Enter' && !event.nativeEvent.isComposing && !event.shiftKey)) {
                          event.preventDefault()
                          pickAt(atMatches[0]!)
                          return
                        }
                      }
                      if (event.key === 'Enter' && !event.nativeEvent.isComposing && !event.shiftKey) {
                        event.preventDefault()
                        submitMessage()
                      }
                    }}
                    placeholder="输入消息，回车发送…（@ 提及群友，输入 @all @所有人）"
                    aria-label="输入消息"
                    disabled={sending || uploading}
                  />
                  {atMenu !== null && (
                    <div className={css.atMenu} role="listbox" aria-label="提及成员">
                      {atMatches.length === 0 && (
                        <div className={css.atHint}>{atCandidates.length === 0 ? '本会话暂无已知成员（发过言才可 @）' : '无匹配成员'}</div>
                      )}
                      {atMatches.map(candidate => (
                        <button
                          key={candidate.openId}
                          type="button"
                          role="option"
                          className={css.atItem}
                          onMouseDown={(event) => { event.preventDefault() }}
                          onClick={() => { pickAt(candidate) }}
                        >
                          <span className={css.atGlyph}>{candidate.name.slice(0, 1)}</span>
                          <span>{candidate.name}</span>
                        </button>
                      ))}
                      <button
                        type="button"
                        className={css.atItem}
                        onMouseDown={(event) => { event.preventDefault() }}
                        onClick={() => {
                          if (atMenu === null) return
                          const after = `${draft.slice(0, atMenu.replaceFrom)}@all ${draft.slice(atMenu.replaceFrom + 1 + atMenu.query.length)}`
                          setAtMenu(null)
                          setDraft(after)
                          draftRef.current?.focus()
                        }}
                      >
                        <span className={css.atGlyph}>@</span>
                        <span>所有人（@all）</span>
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    className={css.composerSend}
                    onClick={submitMessage}
                    disabled={sending || uploading || draft.trim() === ''}
                  >
                    {sending || uploading ? '发送中…' : '发送'}
                  </button>
                </div>
                <div className={css.composerToolbar}>
                  <button
                    type="button"
                    className={css.toolButton}
                    title="发送图片"
                    aria-label="发送图片"
                    disabled={sending || uploading}
                    onClick={() => imageInputRef.current?.click()}
                  >
                    <IconImage14 />
                  </button>
                  <button
                    type="button"
                    className={css.toolButton}
                    title="发送文件"
                    aria-label="发送文件"
                    disabled={sending || uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <IconClip14 />
                  </button>
                  <button
                    type="button"
                    className={css.toolButton}
                    title="表情"
                    aria-label="表情"
                    disabled={sending || uploading}
                    onClick={() => setEmojiOpen(open => !open)}
                  >
                    <IconSmile14 />
                  </button>
                  {uploading && <span className={css.toolStatus}>上传中…</span>}
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(event) => {
                      handlePickFile('image', event.target.files?.[0])
                      event.target.value = ''
                    }}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    hidden
                    onChange={(event) => {
                      handlePickFile('file', event.target.files?.[0])
                      event.target.value = ''
                    }}
                  />
                </div>
              </div>
            </>
          )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'todo' && (
        <TodoPane
          todos={state.todos}
          ready={state.todoReady}
          libraryLink={state.todoLink}
          tagFilter={state.todoTag}
          loading={state.loading}
          activeDocId={state.todoActiveDocId}
          libraries={state.todoLibraries}
          libName={state.todoLibName}
          libScope={state.todoLibScope}
          actions={props.actions}
          todoState={props.todoState}
          ensureTodo={props.ensureTodo}
          createTodo={props.createTodo}
          toggleTodo={props.toggleTodo}
          todoLibraries={props.todoLibraries}
          selectTodoLibrary={props.selectTodoLibrary}
          ensureTeamTodo={props.ensureTeamTodo}
        />
      )}

      {activeTab === 'robot' && (
        <RobotPane
          channels={state.robotChannels}
          overrides={state.robotOverrides}
          catalog={state.robotCatalog}
          selectedKey={state.robotSelKey}
          groups={state.groups}
          loading={state.loading}
          error={state.error}
          onSelectKey={key => { props.actions.setRobotSelKey(key) }}
          onOverridesRefreshed={overrides => {
            props.actions.setRobotData(state.robotChannels, overrides, state.robotCatalog)
          }}
          robotStatus={props.robotStatus}
          robotOverrides={props.robotOverrides}
          robotModels={props.robotModels}
          setRobotOverride={props.setRobotOverride}
          deleteRobotOverride={props.deleteRobotOverride}
          robotShareList={props.robotShareList}
          robotShareWrite={props.robotShareWrite}
          robotChannelsSave={props.robotChannelsSave}
        />
      )}

      {dropToast !== '' && (
        <div className={css.dropToast} role="status">{dropToast}</div>
      )}
      {dropArmed && (
        <div className={css.dropOverlay}>
          <span className={css.dropOverlayHint}>
            <YzjCloudIcon size={16} /> 松开以插入云之家引用
          </span>
        </div>
      )}
      {lightbox !== null && (
        <div
          className={css.lightbox}
          role="presentation"
          onClick={() => setLightbox(null)}
        >
          {lightbox.kind === 'pdf'
            ? (
                <embed
                  className={css.lightboxPdf}
                  src={lightbox.src}
                  type="application/pdf"
                  onClick={(event) => event.stopPropagation()}
                />
              )
            : (
                <img className={css.lightboxImg} src={lightbox.src} alt="" onClick={(event) => event.stopPropagation()} />
              )}
        </div>
      )}
    </div>
  )
}

function IconRefresh14() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 12a8 8 0 1 1-2.34-5.66" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M20 3v4h-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconImage14() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="9" cy="10" r="1.8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 17.5l4.5-4.5 3.5 3.5 3-3 5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}

function IconClip14() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 12.5V8a3 3 0 0 1 6 0v6.5a4.5 4.5 0 0 1-9 0V7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconSmile14() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="9" cy="10" r="1" fill="currentColor" />
      <circle cx="15" cy="10" r="1" fill="currentColor" />
      <path d="M8.5 14.5a4.2 4.2 0 0 0 7 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function IconClose14() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function IconChevronLeft14() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14.5 5.5L8 12l6.5 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
