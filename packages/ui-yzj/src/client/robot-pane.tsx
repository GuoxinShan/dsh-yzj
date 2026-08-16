/**
 * The 机器人 tab: robot-channel status plus the per-conversation model
 * override editor. Overrides answer "which model does this group / DM use" —
 * resolution order is conversation override > channel default > harness
 * default, and a change applies to NEW sessions (existing ones adopt it
 * after !restart). Data arrives through the /yzj RPC face only.
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

/** Friendly override-key label: `g:<groupId>` resolves against the group list. */
function keyLabel(key: string, groups: unknown[]): string {
  if (key.startsWith('g:')) {
    const groupId = key.slice(2)
    for (const group of groups) {
      const record = asRecord(group)
      if (asString(record.groupId) === groupId) return `群 · ${asString(record.name)}`
    }
    return `群 · ${groupId}`
  }
  if (key.startsWith('dm:')) {
    const [, robotId, openId] = key.split(':')
    return `私聊 · ${openId === undefined ? '' : `${openId.slice(0, 10)}… @ ${robotId === undefined ? '' : robotId.slice(0, 14)}…`}`
  }
  return key
}

/** One override row + the editor share this derived view. */
interface OverrideView {
  key: string
  provider: string
  model: string
}

function overrideView(item: unknown): OverrideView {
  const record = asRecord(item)
  return {
    key: asString(record.key),
    provider: asString(record.provider),
    model: asString(record.model),
  }
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

export function RobotPane(props: RobotPaneProps): React.ReactNode {
  const overrideViews = useMemo(() => asArray(props.overrides).map(overrideView).filter(item => item.key !== ''), [props.overrides])
  const selected = overrideViews.find(item => item.key === props.selectedKey)
  const [provider, setProvider] = useState(selected?.provider ?? '')
  const [model, setModel] = useState(selected?.model ?? '')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  // Shared-workspace browse + panel-direct write (user's own will, no card).
  // Scoped per robot CHANNEL (each channel owns its cwd), then per group
  // surface that channel has actually seen (robot_status surfaces).
  const [shareRobot, setShareRobot] = useState('')
  const [shareGroup, setShareGroup] = useState('')
  const [shareDir, setShareDir] = useState('')
  const [shareFiles, setShareFiles] = useState<{ name: string; size: number; mtime: number }[] | null>(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareFilename, setShareFilename] = useState('')
  const [shareContent, setShareContent] = useState('')
  const [shareNote, setShareNote] = useState('')
  // Channel management (§8.5): inline route drafts per row + add form + delete.
  const [routeDrafts, setRouteDrafts] = useState<Record<number, { provider: string; model: string }>>({})
  const [confirmingDelete, setConfirmingDelete] = useState<number | null>(null)
  const [addUrl, setAddUrl] = useState('')
  const [addProvider, setAddProvider] = useState('')
  const [addModel, setAddModel] = useState('')
  const [addCwd, setAddCwd] = useState('')
  const [channelNote, setChannelNote] = useState('')

  /** The full channel list as the settings file expects it (live values + row drafts). */
  const currentChannels = (): { sendMsgUrl: string; provider?: string; model?: string; cwd?: string; enabled?: boolean; allowFrom?: string[] }[] =>
    asArray(props.channels).map((channel, index) => {
      const record = asRecord(channel)
      const draft = routeDrafts[index]
      const provider = draft?.provider ?? asString(record.provider)
      const model = draft?.model ?? asString(record.model)
      return {
        sendMsgUrl: asString(record.sendMsgUrl),
        enabled: record.enabled === true,
        ...(Array.isArray(record.allowFrom) ? { allowFrom: record.allowFrom.filter((value): value is string => typeof value === 'string') } : {}),
        ...(provider === '' ? {} : { provider }),
        ...(model === '' ? {} : { model }),
        ...(asString(record.cwd) === '' ? {} : { cwd: asString(record.cwd) }),
      }
    }).filter(item => item.sendMsgUrl !== '')

  /** Persist channels; on success run the callback (e.g. clearing the add form). */
  const saveChannels = (robots: { sendMsgUrl: string; provider?: string; model?: string; cwd?: string; enabled?: boolean; allowFrom?: string[] }[], onSaved?: () => void): void => {
    setChannelNote('')
    void props.robotChannelsSave({ robots }).then(result => {
      if (!result.ok) { setChannelNote(`保存失败：${result.error.message}`); return }
      const record = asRecord(result.value)
      if (record.ok !== true) { setChannelNote(`保存失败：${asString(record.error)}`); return }
      setChannelNote(`已保存 ${asString(record.count)} 个通道到通道配置文件（${asString(record.path)}），重启 GUI 后生效`)
      setConfirmingDelete(null)
      setRouteDrafts({})
      onSaved?.()
    })
  }

  const removeChannel = (index: number): void => {
    if (confirmingDelete !== index) { setConfirmingDelete(index); return }
    const next = currentChannels().filter((_, i) => i !== index)
    saveChannels(next)
  }

  const addChannel = (): void => {
    if (addUrl === '') return
    const next = [...currentChannels(), {
      sendMsgUrl: addUrl,
      ...(addProvider === '' ? {} : { provider: addProvider }),
      ...(addModel === '' ? {} : { model: addModel }),
      ...(addCwd === '' ? {} : { cwd: addCwd }),
    }]
    saveChannels(next, () => {
      setAddUrl('')
      setAddProvider('')
      setAddModel('')
      setAddCwd('')
    })
  }

  /** Group surfaces the selected channel has actually seen (shared dir exists per surface). */
  const shareGroups = useMemo(() => {
    if (shareRobot === '') return [] as { groupId: string; robotName: string }[]
    const channel = asArray(props.channels)[Number(shareRobot)]
    return asArray(asRecord(channel).surface).map(surface => {
      const record = asRecord(surface)
      return { groupId: asString(record.groupId), robotName: asString(record.robotName) }
    }).filter(entry => entry.groupId !== '' && !entry.groupId.startsWith('BOT-'))
  }, [shareRobot, props.channels])

  /** Group display name: resolved from the chat-tab group cache, else the raw id. */
  const groupNameOf = (groupId: string): string => {
    for (const group of asArray(props.groups)) {
      const record = asRecord(group)
      if (asString(record.groupId) === groupId) return asString(record.name)
    }
    return groupId
  }

  const pickShareRobot = (index: string): void => {
    setShareRobot(index)
    setShareGroup('')
    setShareFiles(null)
    setShareDir('')
    setShareNote('')
  }

  const loadShare = (groupId: string): void => {
    setShareGroup(groupId)
    setShareFiles(null)
    setShareDir('')
    setShareNote('')
    if (groupId === '' || shareRobot === '') return
    setShareLoading(true)
    void props.robotShareList(groupId, Number(shareRobot)).then(result => {
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
    if (shareRobot === '' || shareGroup === '' || shareFilename === '' || shareContent === '') return
    setShareNote('')
    void props.robotShareWrite({ groupId: shareGroup, filename: shareFilename, content: shareContent, robotIndex: Number(shareRobot) }).then(result => {
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

  const catalog = useMemo(() => asArray(props.catalog).map(entry => {
    const record = asRecord(entry)
    return { provider: asString(record.provider), models: asArray(record.models).filter((m): m is string => typeof m === 'string') }
  }).filter(entry => entry.provider !== ''), [props.catalog])
  const models = catalog.find(entry => entry.provider === provider)?.models ?? []

  const pick = (key: string): void => {
    props.onSelectKey(key)
    const view = overrideViews.find(item => item.key === key)
    setProvider(view?.provider ?? '')
    setModel(view?.model ?? '')
    setNote('')
  }

  /** Re-pull the override list into the store after a mutation. */
  const refresh = (): void => {
    void props.robotOverrides().then((result) => {
      if (result.ok) {
        const record = asRecord(result.value)
        props.onOverridesRefreshed(Array.isArray(record.overrides) ? record.overrides : [])
      }
    })
  }

  const save = (): void => {
    if (props.selectedKey === '') return
    setBusy(true)
    setNote('')
    void props.setRobotOverride(props.selectedKey, provider === '' ? undefined : provider, model === '' ? undefined : model)
      .then((result) => {
        setBusy(false)
        if (!result.ok) { setNote(`保存失败：${result.error.message}`); return }
        setNote('已保存（对新建会话生效；已有会话发 !restart 立即应用）')
        refresh()
      })
  }

  const remove = (): void => {
    if (props.selectedKey === '') return
    setBusy(true)
    setNote('')
    void props.deleteRobotOverride(props.selectedKey)
      .then((result) => {
        setBusy(false)
        if (!result.ok) { setNote(`删除失败：${result.error.message}`); return }
        setProvider('')
        setModel('')
        setNote('已删除（回到通道默认）')
        refresh()
      })
  }

  return (
    <div className={css.pane}>
      <section className={css.section}>
        <h3 className={css.sectionTitle}>通道管理</h3>
        <p className={css.hint}>
          注册/删除机器人通道与默认路由（作用于该通道全部会话；按会话覆盖可再细配）。保存写入通道配置文件，<strong>重启 GUI 后生效</strong>。创建机器人：个人机器人
          <a href="https://www.yunzhijia.com/im/personalRobotCreate" target="_blank" rel="noreferrer">个人机器人创建页</a>零门槛，复制 sendMsgUrl 粘贴下方；群对话机器人需群管理员。
        </p>
        {asArray(props.channels).length === 0 && props.loading && <p className={css.hint}>加载中…</p>}
        {asArray(props.channels).length === 0 && !props.loading && (
          <p className={css.hint}>{props.error === '' ? '没有已配置的机器人通道（robot-yzj 未配置 sendMsgUrl）。' : `通道读取失败：${props.error}`}</p>
        )}
        <ul className={css.channelList}>
          {asArray(props.channels).map((channel, index) => {
            const record = asRecord(channel)
            const connected = record.connected === true
            const lastError = asString(record.lastError)
            const cwd = asString(record.cwd)
            const draft = routeDrafts[index] ?? { provider: asString(record.provider), model: asString(record.model) }
            return (
              <li key={index} className={css.channelRow}>
                <span className={connected ? css.dotOn : css.dotOff} aria-hidden="true" />
                <span className={css.channelName}>{channelLabel(record)}</span>
                <span className={css.channelMeta}>{connected ? '已连接' : '未连接'}</span>
                <span className={css.channelCwd} title={cwd}>cwd: {cwd}</span>
                {lastError !== '' && <span className={css.channelError} title={lastError}>!</span>}
                <span className={css.routeEditor}>
                  <select
                    className={css.miniSelect}
                    value={draft.provider}
                    onChange={(event) => { setRouteDrafts({ ...routeDrafts, [index]: { provider: event.target.value, model: '' } }) }}
                  >
                    <option value="">默认路由</option>
                    {catalog.map(entry => <option key={entry.provider} value={entry.provider}>{entry.provider}</option>)}
                  </select>
                  <select
                    className={css.miniSelect}
                    value={draft.model}
                    disabled={draft.provider === ''}
                    onChange={(event) => { setRouteDrafts({ ...routeDrafts, [index]: { ...draft, model: event.target.value } }) }}
                  >
                    <option value="">（跟随默认）</option>
                    {catalog.find(entry => entry.provider === draft.provider)?.models.map(id => <option key={id} value={id}>{id}</option>)}
                  </select>
                  <button type="button" className={css.secondary} onClick={() => { saveChannels(currentChannels()) }}>保存</button>
                  <button
                    type="button"
                    className={confirmingDelete === index ? `${css.danger} ${css.dangerActive}` : css.danger}
                    onClick={() => { removeChannel(index) }}
                  >
                    {confirmingDelete === index ? '确认删除?' : '删除'}
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
        <div className={css.editor}>
          <label className={css.field}>
            <span className={css.fieldLabel}>sendMsgUrl（粘贴创建机器人时给的地址）</span>
            <input
              className={css.input}
              value={addUrl}
              onChange={(event) => { setAddUrl(event.target.value) }}
              placeholder="https://www.yunzhijia.com/gateway/robot/webhook/send?yzjtoken=…"
            />
          </label>
          <div className={css.addRow}>
            <label className={css.field}>
              <span className={css.fieldLabel}>Provider</span>
              <select className={css.select} value={addProvider} onChange={(event) => { setAddProvider(event.target.value); setAddModel('') }}>
                <option value="">（默认路由）</option>
                {catalog.map(entry => <option key={entry.provider} value={entry.provider}>{entry.provider}</option>)}
              </select>
            </label>
            <label className={css.field}>
              <span className={css.fieldLabel}>模型</span>
              <select className={css.select} value={addModel} disabled={addProvider === ''} onChange={(event) => { setAddModel(event.target.value) }}>
                <option value="">（跟随默认）</option>
                {catalog.find(entry => entry.provider === addProvider)?.models.map(id => <option key={id} value={id}>{id}</option>)}
              </select>
            </label>
            <label className={css.field}>
              <span className={css.fieldLabel}>cwd（可选）</span>
              <input className={css.input} value={addCwd} onChange={(event) => { setAddCwd(event.target.value) }} placeholder="留空 = 宿主 cwd" />
            </label>
          </div>
          <div className={css.actions}>
            <button type="button" className={css.primary} disabled={addUrl === ''} onClick={addChannel}>添加机器人通道</button>
          </div>
          {channelNote !== '' && <p className={css.note} role="status">{channelNote}</p>}
        </div>
      </section>

      <section className={css.section}>
        <h3 className={css.sectionTitle}>按会话指定模型</h3>
        <p className={css.hint}>优先级：会话覆盖 &gt; 通道默认 &gt; harness 默认。选择一个群（或已有覆盖项），指定 provider / 模型。</p>
        <div className={css.editor}>
          <label className={css.field}>
            <span className={css.fieldLabel}>会话</span>
            <select
              className={css.select}
              value={props.selectedKey}
              onChange={(event) => { pick(event.target.value) }}
            >
              <option value="">— 选择群 —</option>
              {asArray(props.groups).map((group) => {
                const record = asRecord(group)
                const groupId = asString(record.groupId)
                if (groupId === '') return null
                const key = `g:${groupId}`
                return <option key={key} value={key}>群 · {asString(record.name)}</option>
              })}
              {overrideViews
                .filter(item => !item.key.startsWith('g:') || !asArray(props.groups).some(g => asString(asRecord(g).groupId) === item.key.slice(2)))
                .map(item => <option key={item.key} value={item.key}>{keyLabel(item.key, props.groups)}</option>)}
            </select>
          </label>
          <label className={css.field}>
            <span className={css.fieldLabel}>Provider</span>
            <select
              className={css.select}
              value={provider}
              onChange={(event) => { setProvider(event.target.value); setModel('') }}
            >
              <option value="">（继承通道默认）</option>
              {catalog.map(entry => <option key={entry.provider} value={entry.provider}>{entry.provider}</option>)}
            </select>
          </label>
          <label className={css.field}>
            <span className={css.fieldLabel}>模型</span>
            <select
              className={css.select}
              value={model}
              onChange={(event) => { setModel(event.target.value) }}
              disabled={provider === ''}
            >
              <option value="">（跟随 provider 默认）</option>
              {models.map(id => <option key={id} value={id}>{id}</option>)}
            </select>
          </label>
          <div className={css.actions}>
            <button type="button" className={css.primary} disabled={props.selectedKey === '' || busy} onClick={save}>保存</button>
            <button type="button" className={css.secondary} disabled={props.selectedKey === '' || busy || selected === undefined} onClick={remove}>删除覆盖</button>
          </div>
          {note !== '' && <p className={css.note} role="status">{note}</p>}
        </div>
      </section>

      <section className={css.section}>
        <h3 className={css.sectionTitle}>当前覆盖（{overrideViews.length}）</h3>
        {overrideViews.length === 0 && <p className={css.hint}>暂无覆盖 — 所有会话走通道默认 / harness 默认。</p>}
        <ul className={css.overrideList}>
          {overrideViews.map(item => (
            <li key={item.key} className={css.overrideRow}>
              <button type="button" className={css.overridePick} onClick={() => { pick(item.key) }}>
                <span className={css.overrideName}>{keyLabel(item.key, props.groups)}</span>
                <span className={css.overrideMeta}>{[item.provider, item.model].filter(v => v !== '').join(' / ') || '—'}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className={css.section}>
        <h3 className={css.sectionTitle}>群共享工作区</h3>
        <p className={css.hint}>跨话题显式协作区（`&lt;通道cwd&gt;/groups/&lt;群&gt;/shared/`）。先选已注册的机器人通道，再选该机器人真实见过的群；写共享区自动唯一名防冲突，agent 会话写经确认卡，面板直写为你的本人意志、不经确认卡。</p>
        <div className={css.editor}>
          <label className={css.field}>
            <span className={css.fieldLabel}>机器人通道</span>
            <select className={css.select} value={shareRobot} onChange={(event) => { pickShareRobot(event.target.value) }}>
              <option value="">— 选择机器人 —</option>
              {asArray(props.channels).map((channel, index) => (
                <option key={index} value={String(index)}>{channelLabel(asRecord(channel))}（#{index}）</option>
              ))}
            </select>
          </label>
          {shareRobot !== '' && (
            <label className={css.field}>
              <span className={css.fieldLabel}>该机器人见过的群</span>
              <select className={css.select} value={shareGroup} onChange={(event) => { loadShare(event.target.value) }}>
                <option value="">{shareGroups.length === 0 ? '该机器人尚未收到任何群消息' : '— 选择群 —'}</option>
                {shareGroups.map(entry => (
                  <option key={entry.groupId} value={entry.groupId}>群 · {groupNameOf(entry.groupId)}</option>
                ))}
              </select>
            </label>
          )}
          {shareGroup !== '' && (
            <>
              {shareDir !== '' && <p className={css.note}>路径：{shareDir}</p>}
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
                  placeholder="要写入共享区的文本…"
                />
              </label>
              <div className={css.actions}>
                <button
                  type="button"
                  className={css.primary}
                  disabled={shareFilename === '' || shareContent === ''}
                  onClick={writeShare}
                >
                  写入共享区
                </button>
              </div>
              {shareNote !== '' && <p className={css.note} role="status">{shareNote}</p>}
            </>
          )}
        </div>
      </section>
    </div>
  )
}
