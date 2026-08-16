/**
 * The 机器人 tab: a two-level settings surface. Level 1 lists every
 * registered robot channel (status, auto cwd, group count) with the add
 * form; clicking a channel opens level 2 — one robot's detail view: model
 * route, the groups it has configured (surfaces with per-group model
 * overrides), its group shared workspace (browse + panel-direct write), and
 * delete. All mutations write the channels file (§8.5) and take effect
 * after a GUI restart. Data arrives through the /yzj RPC face only.
 */
import { useMemo, useState } from 'react'
import { formatSize } from './im-cache.ts'
import css from './robot-pane.module.css'

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

/** Friendly channel label from its sendMsgUrl's yzjtype (0 personal, 12 group-conversation). */
function channelLabel(channel: UnknownRecord): string {
  const url = asString(channel.sendMsgUrl)
  const type = /yzjtype=(\d+)/.exec(url)?.[1] ?? '?'
  if (type === '0') return '个人机器人（私聊助手）'
  if (type === '12') return '群对话机器人'
  return `机器人通道 yzjtype=${type}`
}

/** The group surfaces one channel has actually seen (BOT- DMs excluded). */
function groupSurfacesOf(channel: unknown): { groupId: string; robotName: string; time: number; lastSessionId?: string }[] {
  return asArray(asRecord(channel).surface).flatMap(surface => {
    const record = asRecord(surface)
    const groupId = asString(record.groupId)
    if (groupId === '' || groupId.startsWith('BOT-')) return []
    return [{
      groupId,
      robotName: asString(record.robotName),
      time: typeof record.time === 'number' ? record.time : 0,
      ...(asString(record.lastSessionId) === '' ? {} : { lastSessionId: asString(record.lastSessionId) }),
    }]
  })
}

/** Group display name from the chat-tab cache, else the raw id. */
function groupNameOf(groups: unknown[], groupId: string): string {
  for (const group of asArray(groups)) {
    const record = asRecord(group)
    if (asString(record.groupId) === groupId) return asString(record.name)
  }
  return groupId
}

/** Human-relative timestamp: 今天/昨天 HH:mm, else M月d日 HH:mm. */
function formatRelativeTime(time: number): string {
  if (time <= 0) return ''
  const then = new Date(time)
  const now = new Date()
  const sameDay = then.getFullYear() === now.getFullYear() && then.getMonth() === now.getMonth() && then.getDate() === now.getDate()
  const yesterday = new Date(now.getTime() - 86_400_000)
  const isYesterday = then.getFullYear() === yesterday.getFullYear() && then.getMonth() === yesterday.getMonth() && then.getDate() === yesterday.getDate()
  const clock = `${String(then.getHours()).padStart(2, '0')}:${String(then.getMinutes()).padStart(2, '0')}`
  if (sameDay) return `今天 ${clock}`
  if (isYesterday) return `昨天 ${clock}`
  return `${then.getMonth() + 1}月${then.getDate()}日 ${clock}`
}

/** The model override for one group, when present (key `g:<groupId>`). */
function overrideOf(overrides: unknown[], groupId: string): { provider: string; model: string } | undefined {
  const key = `g:${groupId}`
  for (const item of asArray(overrides)) {
    const record = asRecord(item)
    if (asString(record.key) === key) return { provider: asString(record.provider), model: asString(record.model) }
  }
  return undefined
}

/** Props: store slices plus the RPC verbs (panel inject face). */
export interface RobotPaneProps {
  channels: unknown[]
  overrides: unknown[]
  catalog: unknown[]
  selectedKey: string
  groups: unknown[]
  loading: boolean
  error: string
  onSelectKey: (key: string) => void
  onOverridesRefreshed: (overrides: unknown[]) => void
  robotStatus: () => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  robotOverrides: () => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  robotModels: () => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  setRobotOverride: (key: string, provider: string | undefined, model: string | undefined) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  deleteRobotOverride: (key: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  /** List one group's shared workspace files. */
  robotShareList: (groupId: string, robotIndex?: number) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  /** Panel-direct write into a group's shared workspace (user's own will). */
  robotShareWrite: (input: { groupId: string; filename: string; content: string; overwrite?: boolean; robotIndex?: number }) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  /** Persist the FULL channel configuration to the channels file (§8.5). */
  robotChannelsSave: (input: { defaultProvider?: string; defaultModel?: string; robots: { sendMsgUrl: string; provider?: string; model?: string; cwd?: string; enabled?: boolean; allowFrom?: string[] }[] }) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
}

/** Provider/model catalog rows. */
interface CatalogEntry {
  provider: string
  models: string[]
}

/** Two-level root: the channel list, or one channel's detail view. */
export function RobotPane(props: RobotPaneProps): React.ReactNode {
  const [detailIndex, setDetailIndex] = useState<number | null>(null)
  const active = detailIndex === null ? undefined : asArray(props.channels)[detailIndex]
  return detailIndex === null || active === undefined
    ? <RobotList props={props} onOpen={setDetailIndex} />
    : <RobotDetail props={props} index={detailIndex} onBack={() => { setDetailIndex(null) }} />
}

/** Level 1: every registered channel (tap → detail) + the add form. */
function RobotList(outer: { props: RobotPaneProps; onOpen: (index: number) => void }): React.ReactNode {
  const { props, onOpen } = outer
  const catalog = useMemo<CatalogEntry[]>(() => asArray(props.catalog).map(entry => {
    const record = asRecord(entry)
    return { provider: asString(record.provider), models: asArray(record.models).filter((m): m is string => typeof m === 'string') }
  }).filter(entry => entry.provider !== ''), [props.catalog])
  const [addOpen, setAddOpen] = useState(false)
  const [addUrl, setAddUrl] = useState('')
  const [addProvider, setAddProvider] = useState('')
  const [addModel, setAddModel] = useState('')
  const [note, setNote] = useState('')
  const channels = asArray(props.channels)

  const saveChannels = (robots: Parameters<RobotPaneProps['robotChannelsSave']>[0]['robots'], onSaved?: () => void): void => {
    setNote('')
    void props.robotChannelsSave({ robots }).then(result => {
      if (!result.ok) { setNote(`保存失败：${result.error.message}`); return }
      const record = asRecord(result.value)
      if (record.ok !== true) { setNote(`保存失败：${asString(record.error)}`); return }
      setNote(`已保存 ${asString(record.count)} 个通道，重启 GUI 后生效`)
      onSaved?.()
    })
  }

  const addChannel = (): void => {
    if (addUrl === '') return
    const next = channels.map(channel => {
      const record = asRecord(channel)
      return {
        sendMsgUrl: asString(record.sendMsgUrl),
        ...(record.enabled === true ? {} : { enabled: false }),
        ...(Array.isArray(record.allowFrom) ? { allowFrom: record.allowFrom.filter((v): v is string => typeof v === 'string') } : {}),
        ...(asString(record.provider) === '' ? {} : { provider: asString(record.provider) }),
        ...(asString(record.model) === '' ? {} : { model: asString(record.model) }),
        ...(asString(record.cwd) === '' ? {} : { cwd: asString(record.cwd) }),
      }
    }).filter(item => item.sendMsgUrl !== '')
    next.push({
      sendMsgUrl: addUrl,
      ...(addProvider === '' ? {} : { provider: addProvider }),
      ...(addModel === '' ? {} : { model: addModel }),
    })
    saveChannels(next, () => {
      setAddUrl('')
      setAddProvider('')
      setAddModel('')
      setAddOpen(false)
    })
  }

  return (
    <div className={css.pane}>
      <section className={css.section}>
        <h3 className={css.sectionTitle}>机器人（{channels.length}）</h3>
        <p className={css.hint}>点开一个机器人，管理它的模型、服务的群和公共文件区。工作目录自动分配，无需填写。</p>
        {channels.length === 0 && props.loading && <p className={css.hint}>加载中…</p>}
        {channels.length === 0 && !props.loading && (
          <p className={css.hint}>{props.error === '' ? '没有已配置的机器人通道。' : `通道读取失败：${props.error}`}</p>
        )}
        <ul className={css.channelList}>
          {channels.map((channel, index) => {
            const record = asRecord(channel)
            const connected = record.connected === true
            const lastError = asString(record.lastError)
            const cwd = asString(record.cwd)
            const groups = groupSurfacesOf(channel)
            return (
              <li key={index}>
                <button type="button" className={css.channelPick} onClick={() => { onOpen(index) }}>
                  <span className={connected ? css.dotOn : css.dotOff} aria-hidden="true" />
                  <span className={css.channelName}>{channelLabel(record)}</span>
                  <span className={css.channelMeta}>
                    {connected ? '已连接' : '未连接'}
                    {lastError !== '' ? ` · ${lastError.slice(0, 24)}` : ''}
                  </span>
                  <span className={css.channelCwd} title={cwd}>cwd: {cwd}</span>
                  <span className={css.groupCount}>{groups.length} 个群 ›</span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section className={css.section}>
        <h3 className={css.sectionTitle}>添加机器人</h3>
        <p className={css.hint}>
          创建：个人机器人在
          <a href="https://www.yunzhijia.com/im/personalRobotCreate" target="_blank" rel="noreferrer">个人机器人创建页</a>
          零门槛创建（群对话机器人需群管理员）；创建后复制 sendMsgUrl 粘贴到这里。
        </p>
        {addOpen ? (
          <div className={css.editor}>
            <label className={css.field}>
              <span className={css.fieldLabel}>sendMsgUrl</span>
              <input
                className={css.input}
                value={addUrl}
                onChange={(event) => { setAddUrl(event.target.value) }}
                placeholder="https://www.yunzhijia.com/gateway/robot/webhook/send?yzjtoken=…"
              />
            </label>
            <div className={css.addRow}>
              <label className={css.field}>
                <span className={css.fieldLabel}>默认模型 Provider</span>
                <select className={css.select} value={addProvider} onChange={(event) => { setAddProvider(event.target.value); setAddModel('') }}>
                  <option value="">（跟随全局默认）</option>
                  {catalog.map(entry => <option key={entry.provider} value={entry.provider}>{entry.provider}</option>)}
                </select>
              </label>
              <label className={css.field}>
                <span className={css.fieldLabel}>模型</span>
                <select className={css.select} value={addModel} disabled={addProvider === ''} onChange={(event) => { setAddModel(event.target.value) }}>
                  <option value="">（跟随 provider 默认）</option>
                  {catalog.find(entry => entry.provider === addProvider)?.models.map(id => <option key={id} value={id}>{id}</option>)}
                </select>
              </label>
            </div>
            <div className={css.actions}>
              <button type="button" className={css.primary} disabled={addUrl === ''} onClick={addChannel}>添加</button>
              <button type="button" className={css.secondary} onClick={() => { setAddOpen(false) }}>取消</button>
            </div>
            {note !== '' && <p className={css.note} role="status">{note}</p>}
          </div>
        ) : (
          <button type="button" className={css.secondary} onClick={() => { setAddOpen(true) }}>＋ 添加机器人</button>
        )}
      </section>
    </div>
  )
}

/** Level 2: one channel's detail — route, groups with overrides, shared workspace, delete. */
function RobotDetail(outer: { props: RobotPaneProps; index: number; onBack: () => void }): React.ReactNode {
  const { props, index, onBack } = outer
  const channel = asRecord(asArray(props.channels)[index])
  const groups = groupSurfacesOf(channel)
  const cwd = asString(channel.cwd)
  const sendMsgUrl = asString(channel.sendMsgUrl)
  const connected = channel.connected === true
  const catalog = useMemo<CatalogEntry[]>(() => asArray(props.catalog).map(entry => {
    const record = asRecord(entry)
    return { provider: asString(record.provider), models: asArray(record.models).filter((m): m is string => typeof m === 'string') }
  }).filter(entry => entry.provider !== ''), [props.catalog])
  // Default route draft.
  const [route, setRoute] = useState({ provider: asString(channel.provider), model: asString(channel.model) })
  // Per-group override drafts (groupId → {provider, model}).
  const [overrideDrafts, setOverrideDrafts] = useState<Record<string, { provider: string; model: string }>>({})
  // Shared workspace browse + write.
  const [shareGroup, setShareGroup] = useState('')
  const [shareDir, setShareDir] = useState('')
  const [shareFiles, setShareFiles] = useState<{ name: string; size: number; mtime: number }[] | null>(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareFilename, setShareFilename] = useState('')
  const [shareContent, setShareContent] = useState('')
  const [shareNote, setShareNote] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [note, setNote] = useState('')

  const saveChannels = (robots: Parameters<RobotPaneProps['robotChannelsSave']>[0]['robots'], onSaved?: () => void): void => {
    setNote('')
    void props.robotChannelsSave({ robots }).then(result => {
      if (!result.ok) { setNote(`保存失败：${result.error.message}`); return }
      const record = asRecord(result.value)
      if (record.ok !== true) { setNote(`保存失败：${asString(record.error)}`); return }
      setNote(`已保存，重启 GUI 后生效`)
      onSaved?.()
    })
  }

  /** All channels with THIS one's row replaced by the draft values. */
  const withRoute = (provider: string, model: string): Parameters<RobotPaneProps['robotChannelsSave']>[0]['robots'] =>
    asArray(props.channels).map((item, i) => {
      const record = asRecord(item)
      const isThis = i === index
      return {
        sendMsgUrl: asString(record.sendMsgUrl),
        ...(record.enabled === true ? {} : { enabled: false }),
        ...(Array.isArray(record.allowFrom) ? { allowFrom: record.allowFrom.filter((v): v is string => typeof v === 'string') } : {}),
        ...(isThis ? (provider === '' ? {} : { provider }) : asString(record.provider) === '' ? {} : { provider: asString(record.provider) }),
        ...(isThis ? (model === '' ? {} : { model }) : asString(record.model) === '' ? {} : { model: asString(record.model) }),
        ...(isThis ? (cwd === '' ? {} : { cwd }) : asString(record.cwd) === '' ? {} : { cwd: asString(record.cwd) }),
      }
    }).filter(item => item.sendMsgUrl !== '')

  const saveRoute = (): void => {
    saveChannels(withRoute(route.provider, route.model))
  }

  const removeChannel = (): void => {
    if (!confirmingDelete) { setConfirmingDelete(true); return }
    const next = asArray(props.channels)
      .map((item) => {
        const record = asRecord(item)
        return {
          sendMsgUrl: asString(record.sendMsgUrl),
          ...(record.enabled === true ? {} : { enabled: false }),
          ...(Array.isArray(record.allowFrom) ? { allowFrom: record.allowFrom.filter((v): v is string => typeof v === 'string') } : {}),
          ...(asString(record.provider) === '' ? {} : { provider: asString(record.provider) }),
          ...(asString(record.model) === '' ? {} : { model: asString(record.model) }),
          ...(asString(record.cwd) === '' ? {} : { cwd: asString(record.cwd) }),
        }
      })
      .filter((item, i) => i !== index && item.sendMsgUrl !== '')
    saveChannels(next, onBack)
  }

  /** Persist one group's override (or remove it when both fields are empty). */
  const saveGroupOverride = (groupId: string, draft: { provider: string; model: string }): void => {
    setNote('')
    const key = `g:${groupId}`
    const settle = (): void => {
      void props.robotOverrides().then(result => {
        if (result.ok) {
          const record = asRecord(result.value)
          props.onOverridesRefreshed(Array.isArray(record.overrides) ? record.overrides : [])
        }
      })
    }
    const hasValue = draft.provider !== '' || draft.model !== ''
    const call = hasValue
      ? props.setRobotOverride(key, draft.provider === '' ? undefined : draft.provider, draft.model === '' ? undefined : draft.model)
      : props.deleteRobotOverride(key)
    void call.then(result => {
      if (!result.ok) { setNote(`覆盖保存失败：${result.error.message}`); return }
      setNote(hasValue ? `群「${groupNameOf(props.groups, groupId)}」已指定模型（新会话生效；已有会话发 !restart）` : '覆盖已删除')
      settle()
    })
  }

  const loadShare = (groupId: string): void => {
    setShareGroup(groupId)
    setShareFiles(null)
    setShareDir('')
    setShareNote('')
    if (groupId === '') return
    setShareLoading(true)
    void props.robotShareList(groupId, index).then(result => {
      setShareLoading(false)
      if (!result.ok) { setShareNote(`读取失败：${result.error.message}`); return }
      const record = asRecord(result.value)
      setShareDir(asString(record.dir))
      setShareFiles(asArray(record.files).map(file => {
        const entry = asRecord(file)
        return {
          name: asString(entry.name),
          size: typeof entry.size === 'number' ? entry.size : 0,
          mtime: typeof entry.mtime === 'number' ? entry.mtime : 0,
        }
      }))
    })
  }

  const writeShare = (): void => {
    if (shareGroup === '' || shareFilename === '' || shareContent === '') return
    setShareNote('')
    void props.robotShareWrite({ groupId: shareGroup, filename: shareFilename, content: shareContent, robotIndex: index }).then(result => {
      if (!result.ok) { setShareNote(`写入失败：${result.error.message}`); return }
      const record = asRecord(result.value)
      if (record.ok !== true) { setShareNote(`写入失败：${asString(record.error)}`); return }
      const name = asString(record.name)
      setShareNote(record.existed === true
        ? `已写入 ${name}（同名文件已存在，自动唯一化；原文件未动）`
        : `已写入 ${name}`)
      setShareFilename('')
      setShareContent('')
      loadShare(shareGroup)
    })
  }

  return (
    <div className={css.pane}>
      <section className={css.section}>
        <div className={css.detailHead}>
          <button type="button" className={css.secondary} onClick={onBack}>‹ 返回</button>
          <h3 className={css.sectionTitle}>{channelLabel(channel)}</h3>
          <span className={connected ? css.dotOn : css.dotOff} aria-hidden="true" />
          <span className={css.channelMeta}>{connected ? '已连接' : '未连接'}</span>
        </div>
        <p className={css.hint} title={sendMsgUrl}>sendMsgUrl：{sendMsgUrl}</p>
        <p className={css.hint} title={cwd}>工作目录（自动分配，一般不用管）：{cwd}</p>
      </section>

      <section className={css.section}>
        <h3 className={css.sectionTitle}>模型配置</h3>
        <p className={css.hint}>这个机器人默认使用哪个模型；下面还可以给某个群单独指定模型（比如重要群用强模型）。</p>
        <div className={css.editor}>
          <div className={css.addRow}>
            <label className={css.field}>
              <span className={css.fieldLabel}>Provider</span>
              <select className={css.select} value={route.provider} onChange={(event) => { setRoute({ provider: event.target.value, model: '' }) }}>
                <option value="">（跟随全局默认）</option>
                {catalog.map(entry => <option key={entry.provider} value={entry.provider}>{entry.provider}</option>)}
              </select>
            </label>
            <label className={css.field}>
              <span className={css.fieldLabel}>模型</span>
              <select className={css.select} value={route.model} disabled={route.provider === ''} onChange={(event) => { setRoute({ ...route, model: event.target.value }) }}>
                <option value="">（跟随 provider 默认）</option>
                {catalog.find(entry => entry.provider === route.provider)?.models.map(id => <option key={id} value={id}>{id}</option>)}
              </select>
            </label>
            <div className={css.actions}>
              <button type="button" className={css.primary} onClick={saveRoute}>保存</button>
            </div>
          </div>
        </div>
      </section>

      <section className={css.section}>
        <h3 className={css.sectionTitle}>机器人服务的群（{groups.length}）</h3>
        <p className={css.hint}>在群里 @机器人 发过消息的群会出现在这里（机器人只收 @ 它的消息）。每个群可以单独指定使用的模型。</p>
        {groups.length === 0 && <p className={css.hint}>该机器人还没有收到过任何群消息。</p>}
        <ul className={css.overrideList}>
          {groups.map(group => {
            const draft = overrideDrafts[group.groupId] ?? overrideOf(props.overrides, group.groupId) ?? { provider: '', model: '' }
            return (
              <li key={group.groupId} className={css.groupCard}>
                <div className={css.groupCardHead}>
                  <span className={css.overrideName}>{groupNameOf(props.groups, group.groupId)}</span>
                  <span className={css.overrideMeta}>
                    {group.time > 0 && `最近互动 ${formatRelativeTime(group.time)}`}
                    {(draft.provider !== '' || draft.model !== '') && ` · 单独用 ${[draft.provider, draft.model].filter(v => v !== '').join('/')}`}
                  </span>
                </div>
                <div className={css.addRow}>
                  <select
                    className={css.miniSelect}
                    value={draft.provider}
                    onChange={(event) => { setOverrideDrafts({ ...overrideDrafts, [group.groupId]: { provider: event.target.value, model: '' } }) }}
                  >
                    <option value="">跟随机器人默认</option>
                    {catalog.map(entry => <option key={entry.provider} value={entry.provider}>{entry.provider}</option>)}
                  </select>
                  <select
                    className={css.miniSelect}
                    value={draft.model}
                    disabled={draft.provider === ''}
                    onChange={(event) => { setOverrideDrafts({ ...overrideDrafts, [group.groupId]: { ...draft, model: event.target.value } }) }}
                  >
                    <option value="">（跟随 provider 默认）</option>
                    {catalog.find(entry => entry.provider === draft.provider)?.models.map(id => <option key={id} value={id}>{id}</option>)}
                  </select>
                  <button type="button" className={css.secondary} onClick={() => { saveGroupOverride(group.groupId, draft) }}>保存</button>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section className={css.section}>
        <h3 className={css.sectionTitle}>群的公共文件区</h3>
        <p className={css.hint}>
          机器人在群里干活时产生的文件（草稿、报告等）会存放在每个群自己的公共目录里：同一个群的任何对话都能读取、继续处理；
          同名文件自动加序号（report.md → report-2.md），不会互相覆盖。面板里直接放文件是你的本人操作，不需要确认。
        </p>
        <div className={css.editor}>
          <label className={css.field}>
            <span className={css.fieldLabel}>群</span>
            <select className={css.select} value={shareGroup} onChange={(event) => { loadShare(event.target.value) }}>
              <option value="">— 选择群 —</option>
              {groups.map(group => (
                <option key={group.groupId} value={group.groupId}>群 · {groupNameOf(props.groups, group.groupId)}</option>
              ))}
            </select>
          </label>
          {shareGroup !== '' && (
            <>
              {shareDir !== '' && <p className={css.hint} title={shareDir}>公共文件目录（一般不用管）：{shareDir}</p>}
              {shareLoading && <p className={css.hint}>加载中…</p>}
              {!shareLoading && shareFiles !== null && (
                shareFiles.length === 0
                  ? <p className={css.hint}>共享区暂无文件。</p>
                  : (
                    <ul className={css.shareList}>
                      {shareFiles.map(file => (
                        <li key={file.name} className={css.shareRow}>
                          <span className={css.shareName}>{file.name}</span>
                          <span className={css.shareMeta}>{formatSize(file.size)} · {new Date(file.mtime).toLocaleString()}</span>
                        </li>
                      ))}
                    </ul>
                  )
              )}
              <label className={css.field}>
                <span className={css.fieldLabel}>文件名</span>
                <input
                  className={css.input}
                  value={shareFilename}
                  onChange={(event) => { setShareFilename(event.target.value) }}
                  placeholder="report.md（同名自动变 report-2.md）"
                />
              </label>
              <label className={css.field}>
                <span className={css.fieldLabel}>内容</span>
                <textarea
                  className={css.textarea}
                  value={shareContent}
                  onChange={(event) => { setShareContent(event.target.value) }}
                  rows={3}
                  placeholder="要放进公共文件区的文本…"
                />
              </label>
              <div className={css.actions}>
                <button
                  type="button"
                  className={css.primary}
                  disabled={shareFilename === '' || shareContent === ''}
                  onClick={writeShare}
                >
                  存入公共文件区
                </button>
              </div>
              {shareNote !== '' && <p className={css.note} role="status">{shareNote}</p>}
            </>
          )}
        </div>
      </section>

      <section className={css.section}>
        <h3 className={css.sectionTitle}>危险区</h3>
        <div className={css.actions}>
          <button
            type="button"
            className={confirmingDelete ? `${css.danger} ${css.dangerActive}` : css.danger}
            onClick={removeChannel}
          >
            {confirmingDelete ? '确认删除该机器人?' : '删除机器人'}
          </button>
        </div>
        {note !== '' && <p className={css.note} role="status">{note}</p>}
      </section>
    </div>
  )
}
