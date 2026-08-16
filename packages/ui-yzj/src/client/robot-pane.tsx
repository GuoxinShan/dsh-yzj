/**
 * The 机器人 tab: robot-channel status plus the per-conversation model
 * override editor. Overrides answer "which model does this group / DM use" —
 * resolution order is conversation override > channel default > harness
 * default, and a change applies to NEW sessions (existing ones adopt it
 * after !restart). Data arrives through the /yzj RPC face only.
 */
import { useMemo, useState } from 'react'
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
}

export function RobotPane(props: RobotPaneProps): React.ReactNode {
  const overrideViews = useMemo(() => asArray(props.overrides).map(overrideView).filter(item => item.key !== ''), [props.overrides])
  const selected = overrideViews.find(item => item.key === props.selectedKey)
  const [provider, setProvider] = useState(selected?.provider ?? '')
  const [model, setModel] = useState(selected?.model ?? '')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

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
        <h3 className={css.sectionTitle}>通道状态</h3>
        {asArray(props.channels).length === 0 && props.loading && <p className={css.hint}>加载中…</p>}
        {asArray(props.channels).length === 0 && !props.loading && (
          <p className={css.hint}>{props.error === '' ? '没有已配置的机器人通道（robot-yzj 未配置 sendMsgUrl）。' : `通道读取失败：${props.error}`}</p>
        )}
        <ul className={css.channelList}>
          {asArray(props.channels).map((channel, index) => {
            const record = asRecord(channel)
            const connected = record.connected === true
            const lastError = asString(record.lastError)
            const defProvider = asString(record.provider)
            const defModel = asString(record.model)
            return (
              <li key={index} className={css.channelRow}>
                <span className={connected ? css.dotOn : css.dotOff} aria-hidden="true" />
                <span className={css.channelName}>{channelLabel(record)}</span>
                <span className={css.channelMeta}>
                  {connected ? '已连接' : '未连接'}
                  {defProvider !== '' || defModel !== '' ? ` · 默认 ${defProvider}/${defModel}` : ' · 默认 harness 路由'}
                </span>
                {lastError !== '' && <span className={css.channelError} title={lastError}>!</span>}
              </li>
            )
          })}
        </ul>
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
    </div>
  )
}
