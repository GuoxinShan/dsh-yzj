/**
 * Shared Yunzhijia IM read-face (panel 会话 + group-room transcript).
 * Avatars, bracket-emoticons, inline images/files, reply quotes.
 * Does not implement reactions / recall / forward (R7).
 */
import { useEffect, useState, type ReactNode } from 'react'
import type { YzjPanelInject } from './rpc.ts'
import { formatSize, peekFileData, resolveFileData, senderPhotoOf } from './im-cache.ts'
import css from './panel.module.css'

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

/** Human-readable label for a raw msgType. */
export function typeLabelOf(msgType: string): string {
  if (msgType === 'richText') return '图文'
  if (msgType === 'file') return '文件'
  if (msgType === 'other') return '系统'
  return '消息'
}

/** Group avatar: headerUrl image with first-letter fallback. */
export function GroupAvatar({ url, name }: { url: string; name: string }) {
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

/** Sender avatar in a message row: photo with a glyph fallback. */
export function SenderAvatar({ openId, fallback }: { openId: string; fallback: string }) {
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
export function ProxyImage({ fileId, alt, onOpen, inject }: {
  fileId: string
  alt: string
  onOpen: (src: string) => void
  inject: Pick<YzjPanelInject, 'fetchFileData'>
}) {
  const [src, setSrc] = useState<string | null>(() => peekFileData(fileId) ?? null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const hit = peekFileData(fileId)
    if (hit !== undefined) {
      setSrc(hit)
      setFailed(false)
      return
    }
    setSrc(null)
    setFailed(false)
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
 * download chip), other (link card, adaptive card, or system line).
 */
export function MessageBody({ message, onOpenImage, onOpenPdf, inject }: {
  message: Record<string, unknown>
  onOpenImage: (src: string) => void
  onOpenPdf: (src: string) => void
  inject: Pick<YzjPanelInject, 'fetchFileData'>
}) {
  const content = asString(message.content)
  const msgType = asString(message.msgType)
  const param = asRecord(message.param)

  if (msgType === 'other' && asString(param.title) === '' && asRecord(param.interactiveCard).cardJson === undefined) {
    return <span className={css.msgSystem}>{content === '' ? '(系统消息)' : emojiText(content)}</span>
  }
  if (asString(param.sysType) === 'withdrawMsg') {
    return <span className={css.msgSystem}>{content === '' ? '撤回了一条消息' : emojiText(content)}</span>
  }

  const replyMsgId = asString(param.replyMsgId)
  const replySummary = asString(param.replySummary)
  const replyPerson = asString(param.replyPersonName)
  const quote = replyMsgId !== ''
    ? <span className={css.msgQuote} title={replySummary}>{`↳ ${replyPerson === '' ? '' : `${replyPerson}：`}${replySummary}`}</span>
    : null

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
              <span className={css.msgFileName}>{name === '' ? '文件' : name}</span>
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

  return (
    <span className={css.msgBody}>
      {quote}
      {content === '' ? `(${typeLabelOf(msgType)})` : emojiText(content)}
    </span>
  )
}

/** Yunzhijia bracket-emoticon tokens → real emoji. Unmatched tokens stay raw. */
const EMOJI_MAP: Record<string, string> = {
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
export function emojiText(text: string): ReactNode[] {
  return text.split(/(\[[^\]\n]{1,10}\])/).map((part, index) => {
    if (part.length > 2 && part.startsWith('[') && part.endsWith(']')) {
      const emoji = EMOJI_MAP[part.slice(1, -1)]
      if (emoji !== undefined) return <span key={index}>{emoji}</span>
    }
    return part
  })
}

/** Full-screen image / PDF preview (same chrome as the floating panel). */
export function ImLightbox({ src, kind, onClose }: {
  src: string
  kind: 'image' | 'pdf'
  onClose: () => void
}) {
  return (
    <div className={css.lightbox} role="presentation" onClick={onClose}>
      {kind === 'pdf'
        ? (
            <embed
              className={css.lightboxPdf}
              src={src}
              type="application/pdf"
              onClick={(event) => event.stopPropagation()}
            />
          )
        : (
            <img className={css.lightboxImg} src={src} alt="" onClick={(event) => event.stopPropagation()} />
          )}
    </div>
  )
}
