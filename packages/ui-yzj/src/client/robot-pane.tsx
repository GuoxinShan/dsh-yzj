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
      ...(asString(record.groupName) === '' ? {} : { groupName: asString(record.groupName) }),
    }]
  })
}

/** Group display name: surface-resolved, then the chat-tab cache (groupName/name), else a short id. */
function groupNameOf(surface: { groupId: string; groupName?: string }, groups: unknown[]): string {
  if (surface.groupName !== undefined && surface.groupName !== '') return surface.groupName
  for (const group of asArray(groups)) {
    const record = asRecord(group)
    if (asString(record.groupId) === surface.groupId) {
      const name = asString(record.groupName) || asString(record.name)
      if (name !== '') return name
    }
  }
  return `${surface.groupId.slice(0, 10)}…`
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
  /** Read one shared file's text content (bounded preview). */
  robotShareRead: (groupId: string, filename: string, robotIndex?: number) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  /** Open a robot workspace folder in the OS file manager (user's own click). */
  robotOpenFolder: (groupId: string | undefined, robotIndex?: number) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
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
        <div className={css.guideBox}>
          <p className={css.hint}><strong>方式一 · 个人机器人（推荐，本机即可用）</strong>：在
            <a href="https://www.yunzhijia.com/im/personalRobotCreate" target="_blank" rel="noreferrer">个人机器人创建页</a>
            零门槛创建，不需要任何公网地址；创建后复制 sendMsgUrl 粘贴到下面。</p>
          <p className={css.hint}><strong>方式二 · 群对话机器人（需群管理员）</strong>：创建时云之家要求填「消息接收地址」（公网 HTTPS）并立即发一次测试请求——本机用临时隧道（ngrok/frp）把任意可达地址填进去即可通过；创建成功后收消息走我们自己的长连接，<strong>公网地址可以弃用、隧道可关</strong>。创建时给的 appSecret 不需要配置（我们的通道凭据在 sendMsgUrl 里）。</p>
        </div>
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
  // Editable push address (sendMsgUrl) draft.
  const [sendUrlDraft, setSendUrlDraft] = useState(sendMsgUrl)
  // Editable workspace directory draft (empty = auto-assigned again).
  const [cwdDraft, setCwdDraft] = useState(cwd)
  // Per-group override drafts (groupId → {provider, model}).
  const [overrideDrafts, setOverrideDrafts] = useState<Record<string, { provider: string; model: string }>>({})
  // Per-group shared files (each group card owns its own browse + preview state).
  const [shareByGroup, setShareByGroup] = useState<Record<string, { dir: string; files: { name: string; size: number; mtime: number }[] | null; loading: boolean; note: string }>>({})
  const [previewByGroup, setPreviewByGroup] = useState<Record<string, { name: string; content: string; truncated: boolean } | null>>({})
  const [previewLoading, setPreviewLoading] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [note, setNote] = useState('')

  const loadShareFor = (groupId: string): void => {
    setShareByGroup(prev => ({ ...prev, [groupId]: { dir: '', files: null, loading: true, note: '' } }))
    void props.robotShareList(groupId, index).then(result => {
      setShareByGroup(prev => {
        const current = prev[groupId] ?? { dir: '', files: null, loading: false, note: '' }
        if (!result.ok) return { ...prev, [groupId]: { ...current, loading: false, note: `读取失败：${result.error.message}` } }
        const record = asRecord(result.value)
        return {
          ...prev,
          [groupId]: {
            dir: asString(record.dir),
            files: asArray(record.files).map(file => {
              const entry = asRecord(file)
              return {
                name: asString(entry.name),
                size: typeof entry.size === 'number' ? entry.size : 0,
                mtime: typeof entry.mtime === 'number' ? entry.mtime : 0,
              }
            }),
            loading: false,
            note: current.note,
          },
        }
      })
    })
  }

  /** Open one shared file's preview in the group card. */
  const openShareFile = (groupId: string, filename: string): void => {
    setPreviewLoading(filename)
    void props.robotShareRead(groupId, filename, index).then(result => {
      setPreviewLoading('')
      setPreviewByGroup(prev => {
        if (!result.ok) return { ...prev, [groupId]: { name: filename, content: `读取失败：${result.error.message}`, truncated: false } }
        const record = asRecord(result.value)
        if (record.ok !== true) return { ...prev, [groupId]: { name: filename, content: `读取失败：${asString(record.error)}`, truncated: false } }
        return { ...prev, [groupId]: { name: filename, content: asString(record.content), truncated: record.truncated === true } }
      })
    })
  }

  /** Open a folder in the OS file manager (undefined groupId = workspace root). */
  const openFolder = (groupId: string | undefined): void => {
    void props.robotOpenFolder(groupId, index).then(result => {
      if (!result.ok) { setNote(`打开失败：${result.error.message}`); return }
      const record = asRecord(result.value)
      if (record.ok !== true) { setNote(`打开失败：${asString(record.error)}`); return }
      setNote(`已在文件管理器中打开：${asString(record.path)}`)
    })
  }

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

  /** Persist an edited push address for this channel. */
  const saveSendUrl = (): void => {
    if (sendUrlDraft === '' || sendUrlDraft === sendMsgUrl) return
    const robots = asArray(props.channels).map((item, i) => {
      const record = asRecord(item)
      return {
        sendMsgUrl: i === index ? sendUrlDraft : asString(record.sendMsgUrl),
        ...(record.enabled === true ? {} : { enabled: false }),
        ...(Array.isArray(record.allowFrom) ? { allowFrom: record.allowFrom.filter((v): v is string => typeof v === 'string') } : {}),
        ...(asString(record.provider) === '' ? {} : { provider: asString(record.provider) }),
        ...(asString(record.model) === '' ? {} : { model: asString(record.model) }),
        ...(i === index ? (cwd === '' ? {} : { cwd }) : asString(record.cwd) === '' ? {} : { cwd: asString(record.cwd) }),
      }
    }).filter(item => item.sendMsgUrl !== '')
    saveChannels(robots)
  }

  /** Persist an edited workspace directory (empty draft = auto-assigned again). */
  const saveCwd = (): void => {
    if (cwdDraft === cwd) return
    const robots = asArray(props.channels).map((item, i) => {
      const record = asRecord(item)
      return {
        sendMsgUrl: asString(record.sendMsgUrl),
        ...(record.enabled === true ? {} : { enabled: false }),
        ...(Array.isArray(record.allowFrom) ? { allowFrom: record.allowFrom.filter((v): v is string => typeof v === 'string') } : {}),
        ...(asString(record.provider) === '' ? {} : { provider: asString(record.provider) }),
        ...(asString(record.model) === '' ? {} : { model: asString(record.model) }),
        ...(i === index ? (cwdDraft === '' ? {} : { cwd: cwdDraft }) : asString(record.cwd) === '' ? {} : { cwd: asString(record.cwd) }),
      }
    }).filter(item => item.sendMsgUrl !== '')
    saveChannels(robots, () => { setNote(cwdDraft === '' ? '已恢复自动分配，重启后生效' : `已保存工作目录，重启后生效`) })
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
      setNote(hasValue ? `群「${groupNameOf({ groupId }, props.groups)}」已指定模型（新会话生效；已有会话发 !restart）` : '覆盖已删除')
      settle()
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
        <div className={css.editor}>
          <label className={css.field}>
            <span className={css.fieldLabel}>推送地址（sendMsgUrl，机器人收发消息的凭据；重建机器人后可在此更新）</span>
            <input
              className={css.input}
              value={sendUrlDraft}
              onChange={(event) => { setSendUrlDraft(event.target.value) }}
              placeholder="https://www.yunzhijia.com/gateway/robot/webhook/send?yzjtoken=…"
            />
          </label>
          <div className={css.actions}>
            <button
              type="button"
              className={css.primary}
              disabled={sendUrlDraft === '' || sendUrlDraft === sendMsgUrl}
              onClick={saveSendUrl}
            >
              保存推送地址
            </button>
            <button type="button" className={css.secondary} onClick={() => { openFolder(undefined) }}>打开工作目录</button>
          </div>
        </div>
        <div className={css.editor}>
          <label className={css.field}>
            <span className={css.fieldLabel}>工作目录（默认自动分配；留空保存 = 恢复自动分配）</span>
            <input
              className={css.input}
              value={cwdDraft}
              onChange={(event) => { setCwdDraft(event.target.value) }}
              placeholder="留空 = 自动分配（~/.dsh/robot-workspaces/）"
            />
          </label>
          <div className={css.actions}>
            <button
              type="button"
              className={css.primary}
              disabled={cwdDraft === cwd}
              onClick={saveCwd}
            >
              保存工作目录
            </button>
            <button
              type="button"
              className={css.secondary}
              disabled={cwdDraft === ''}
              onClick={() => { setCwdDraft('') }}
            >
              恢复自动分配
            </button>
          </div>
        </div>
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
        <p className={css.hint}>在群里 @机器人 发过消息的群会出现在这里（机器人只收 @ 它的消息）。每个群可以单独指定模型，并拥有自己的公共文件区。</p>
        {groups.length === 0 && <p className={css.hint}>该机器人还没有收到过任何群消息。</p>}
        <ul className={css.overrideList}>
          {groups.map(group => {
            const draft = overrideDrafts[group.groupId] ?? overrideOf(props.overrides, group.groupId) ?? { provider: '', model: '' }
            const share = shareByGroup[group.groupId]
            const preview = previewByGroup[group.groupId]
            return (
              <li key={group.groupId} className={css.groupCard}>
                <div className={css.groupCardHead}>
                  <span className={css.overrideName}>{groupNameOf(group, props.groups)}</span>
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
                  <button type="button" className={css.secondary} onClick={() => { saveGroupOverride(group.groupId, draft) }}>保存模型</button>
                  <button type="button" className={css.secondary} onClick={() => { loadShareFor(group.groupId) }}>刷新文件</button>
                  <button type="button" className={css.secondary} onClick={() => { openFolder(group.groupId) }}>打开文件夹</button>
                </div>
                <div className={css.groupFiles}>
                  <h4 className={css.groupFilesTitle}>这个群的公共文件</h4>
                  <p className={css.hint}>
                    机器人在这个群处理文件任务时（比如把表格整理成报告、写脚本），产物会存放在这里，群里任何对话都能读取、继续处理；
                    点击文件名即可打开查看。
                  </p>
                  {share !== undefined && share.dir !== '' && <p className={css.hint} title={share.dir}>目录：{share.dir}</p>}
                  {share?.loading === true && <p className={css.hint}>加载中…</p>}
                  {share !== undefined && !share.loading && share.files !== null && (
                    share.files.length === 0
                      ? <p className={css.hint}>这个群还没有公共文件。</p>
                      : (
                        <ul className={css.shareList}>
                          {share.files.map(file => (
                            <li key={file.name} className={css.shareRow}>
                              <button
                                type="button"
                                className={css.shareOpen}
                                title="点击打开查看"
                                onClick={() => { openShareFile(group.groupId, file.name) }}
                              >
                                <span className={css.shareName}>{file.name}</span>
                                <span className={css.shareMeta}>{formatSize(file.size)}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )
                  )}
                  {previewLoading !== '' && <p className={css.hint}>打开 {previewLoading}…</p>}
                  {preview !== null && preview !== undefined && (
                    <div className={css.sharePreview}>
                      <div className={css.sharePreviewHead}>
                        <span className={css.shareName}>{preview.name}</span>
                        <button
                          type="button"
                          className={css.secondary}
                          onClick={() => { setPreviewByGroup({ ...previewByGroup, [group.groupId]: null }) }}
                        >
                          关闭
                        </button>
                      </div>
                      <pre className={css.sharePreviewBody}>{preview.content}</pre>
                      {preview.truncated && <p className={css.hint}>（内容较长，仅显示前一部分）</p>}
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
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
