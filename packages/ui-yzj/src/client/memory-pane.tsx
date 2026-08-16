/**
 * Memory vault browser pane: sections/entities (expandable), open
 * observations, injection stats, the dream log tail, a panel-direct
 * "记一条" observe composer (user's own will — no confirmation card), and
 * the dream control section: runtime switch (dream.json), daily schedule,
 * dream model route, plugin-wide default model, and a run-now button over
 * the in-process executor. Data arrives through the injected RPC face;
 * rendering stays defensive over raw payloads.
 */
import { useEffect, useState } from 'react'
import css from './memory-pane.module.css'

/** Props: memory state slices plus the RPC verbs (panel inject face). */
export interface MemoryPaneProps {
  view: unknown
  log: string
  loading: boolean
  error: string
  memoryScope: () => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  memoryLog: () => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  memoryObserve: (content: string, tags?: string[]) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  dreamState: () => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  dreamSet: (partial: { enabled?: boolean; provider?: string; model?: string; dailyAt?: string }) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  dreamRun: () => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  modelDefault: () => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  modelSetDefault: (provider: string, model: string) => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  modelClearDefault: () => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
  modelCatalog: () => Promise<{ ok: true; value: unknown } | { ok: false; error: { message: string } }>
}

type Rpc = { ok: true; value: unknown } | { ok: false; error: { message: string } }

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** One provider's catalog entry (models list). */
interface CatalogEntry {
  provider: string
  models: string[]
}

/** Provider/model pair or undefined. */
interface Route {
  provider: string
  model: string
}

/** One memory row: title/meta line + expandable content body. */
function MemoryRow({ title, meta, content }: { title: string; meta: string; content: string }): React.ReactNode {
  const [open, setOpen] = useState(false)
  return (
    <li className={css.item}>
      <button type="button" className={css.itemHead} onClick={() => { setOpen(!open) }}>
        <span className={css.itemCaret} aria-hidden="true">{open ? '▾' : '▸'}</span>
        <span className={css.itemTitle}>{title}</span>
        {meta !== '' && <span className={css.itemMeta}>{meta}</span>}
      </button>
      {open && <div className={css.itemBody}>{content === '' ? '(empty)' : content}</div>}
    </li>
  )
}

/** Two-select model picker; empty provider selection clears the route. */
function ModelPicker({ value, catalog, placeholder, onPick }: {
  value: Route | undefined
  catalog: CatalogEntry[]
  placeholder: string
  onPick: (route: Route | undefined) => void
}): React.ReactNode {
  const provider = value?.provider ?? ''
  const models = catalog.find(entry => entry.provider === provider)?.models ?? []
  return (
    <span className={css.picker}>
      <select
        className={css.pickerSelect}
        value={provider}
        onChange={event => {
          const next = event.target.value
          if (next === '') { onPick(undefined); return }
          const first = catalog.find(entry => entry.provider === next)?.models[0] ?? ''
          if (first !== '') onPick({ provider: next, model: first })
        }}
      >
        <option value="">{placeholder}</option>
        {catalog.map(entry => <option key={entry.provider} value={entry.provider}>{entry.provider}</option>)}
      </select>
      {provider !== '' && (
        <select
          className={css.pickerSelect}
          value={value?.model ?? ''}
          onChange={event => {
            const next = event.target.value
            if (next !== '') onPick({ provider, model: next })
          }}
        >
          {models.map(model => <option key={model} value={model}>{model}</option>)}
        </select>
      )}
    </span>
  )
}

/** The 记忆 tab body. */
export function MemoryPane(props: MemoryPaneProps): React.ReactNode {
  const view = asRecord(props.view)
  const scope = asString(view.scope) || 'user'
  const cap = typeof view.cap === 'number' ? view.cap : 0
  const sections = asArray(view.sections)
  const entities = asArray(view.entities)
  const observations = asArray(view.observations)
  const archivedCount = typeof view.archivedCount === 'number' ? view.archivedCount : 0
  const [draft, setDraft] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [dream, setDream] = useState<Record<string, unknown>>({ enabled: false })
  const [pluginRoute, setPluginRoute] = useState<Route | undefined>(undefined)
  const [catalog, setCatalog] = useState<CatalogEntry[]>([])
  const [dreamNote, setDreamNote] = useState('')
  const [dreamBusy, setDreamBusy] = useState(false)

  useEffect(() => {
    void props.dreamState().then(result => {
      if (result.ok) setDream(asRecord(asRecord(result.value).state))
    })
    void props.modelDefault().then(result => {
      if (result.ok) {
        const route = asRecord(asRecord(result.value).route)
        if (route.provider !== undefined) {
          setPluginRoute({ provider: asString(route.provider), model: asString(route.model) })
        }
      }
    })
    void props.modelCatalog().then(result => {
      if (result.ok) {
        setCatalog(asArray(asRecord(result.value).catalog).map(entry => {
          const record = asRecord(entry)
          return {
            provider: asString(record.provider),
            models: asArray(record.models).filter((m): m is string => typeof m === 'string'),
          }
        }).filter(entry => entry.provider !== ''))
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once; the RPC verbs are stable
  }, [])

  const refresh = (): void => {
    void Promise.all([props.memoryScope(), props.memoryLog()]).then(() => { setNote('已刷新') })
  }

  const submit = (): void => {
    const content = draft.trim()
    if (content === '' || busy) return
    setBusy(true)
    setNote('')
    void props.memoryObserve(content).then(result => {
      setBusy(false)
      if (!result.ok) {
        setNote(`记录失败：${result.error.message}`)
        return
      }
      const record = asRecord(result.value)
      setNote(record.duplicate === true ? '这条已经在记忆里了' : `已记录 ${asString(record.id)}（等待 dream 固化）`)
      if (record.duplicate !== true) setDraft('')
      void props.memoryScope()
    })
  }

  const dreamRoute: Route | undefined = dream.provider !== undefined
    ? { provider: asString(dream.provider), model: asString(dream.model) }
    : undefined
  const dreamEnabled = dream.enabled === true

  const patchDream = (partial: { enabled?: boolean; provider?: string; model?: string; dailyAt?: string }): void => {
    setDreamBusy(true)
    setDreamNote('')
    void props.dreamSet(partial).then(result => {
      setDreamBusy(false)
      if (!result.ok) {
        setDreamNote(`设置失败：${result.error.message}`)
        return
      }
      setDream(asRecord(asRecord(result.value).state))
    })
  }

  const pickPluginDefault = (route: Route | undefined): void => {
    setDreamBusy(true)
    const call: Promise<Rpc> = route === undefined
      ? props.modelClearDefault()
      : props.modelSetDefault(route.provider, route.model)
    void call.then(result => {
      setDreamBusy(false)
      if (!result.ok) {
        setDreamNote(`设置失败：${result.error.message}`)
        return
      }
      const next = asRecord(asRecord(result.value).route)
      setPluginRoute(next.provider !== undefined && asString(next.provider) !== ''
        ? { provider: asString(next.provider), model: asString(next.model) }
        : undefined)
    })
  }

  const runDream = (): void => {
    setDreamBusy(true)
    setDreamNote('固化运行中…（完成后此处显示结果）')
    void props.dreamRun().then(result => {
      setDreamBusy(false)
      if (!result.ok) {
        setDreamNote(result.error.message)
        return
      }
      const record = asRecord(result.value)
      if (record.ok === true) {
        setDreamNote(asString(record.note))
        void props.memoryScope()
        void props.memoryLog().then(() => undefined)
      } else {
        setDreamNote(asString(record.error) || '固化失败')
      }
      void props.dreamState().then(state => {
        if (state.ok) setDream(asRecord(asRecord(state.value).state))
      })
    })
  }

  return (
    <div className={css.body}>
      <section className={css.stats}>
        <span className={css.statsMain}>记忆库 · {scope}</span>
        <span className={css.statsMeta}>
          段 {sections.length} · 实体 {entities.length} · 待固化 {observations.length} · 已归档 {archivedCount} · 注入上限 {cap} 字符
        </span>
        <button type="button" className={css.refresh} onClick={refresh}>刷新</button>
      </section>

      {props.error !== '' && <p className={css.error}>{props.error}</p>}

      <section className={css.dream}>
        <div className={css.dreamHead}>
          <span className={css.dreamTitle}>dream 固化</span>
          <button
            type="button"
            className={dreamEnabled ? css.switchOn : css.switchOff}
            disabled={dreamBusy}
            onClick={() => { patchDream({ enabled: !dreamEnabled }) }}
          >
            {dreamEnabled ? '已开启' : '已关闭'}
          </button>
          <button
            type="button"
            className={dreamEnabled && !dreamBusy ? css.dreamRun : css.dreamRunOff}
            disabled={!dreamEnabled || dreamBusy}
            onClick={runDream}
          >
            立即固化
          </button>
        </div>
        <div className={css.dreamRow}>
          <label className={css.dreamLabel}>
            每日
            <input
              type="time"
              className={css.timeInput}
              value={asString(dream.dailyAt)}
              onChange={event => { patchDream({ dailyAt: event.target.value }) }}
            />
          </label>
          <span className={css.dreamHint}>（清空 = 不自动固化；到点在本进程跑一次）</span>
          <label className={css.dreamLabel}>
            dream 模型
            <ModelPicker
              value={dreamRoute}
              catalog={catalog}
              placeholder="跟随插件默认"
              onPick={route => { patchDream(route === undefined ? { provider: '', model: '' } : { provider: route.provider, model: route.model }) }}
            />
          </label>
        </div>
        <div className={css.dreamRow}>
          <label className={css.dreamLabel}>
            插件默认模型
            <ModelPicker value={pluginRoute} catalog={catalog} placeholder="（未设置）" onPick={pickPluginDefault} />
          </label>
          <span className={css.dreamHint}>（机器人通道与 dream 共用的兜底；未设置时用 harness 默认）</span>
        </div>
        {asString(dream.lastNote) !== '' && <p className={css.dreamLast}>上次：{asString(dream.lastNote)}</p>}
        {dreamNote !== '' && <p className={css.dreamNote}>{dreamNote}</p>}
      </section>

      <section className={css.quick}>
        <textarea
          className={css.quickInput}
          value={draft}
          placeholder="记一条：稳定的偏好、事实或决策（进观察草稿区，由 dream 固化成长期记忆）"
          rows={2}
          onChange={event => { setDraft(event.target.value) }}
          onKeyDown={event => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) submit()
          }}
        />
        <button type="button" className={busy || draft.trim() === '' ? css.quickAddOff : css.quickAdd} disabled={busy || draft.trim() === ''} onClick={submit}>记下</button>
        {note !== '' && <span className={css.quickNote}>{note}</span>}
      </section>

      <section className={css.list}>
        <h3 className={css.groupTitle}>长期记忆（sections · {sections.length}）</h3>
        {sections.length === 0 && <p className={css.hint}>还没有长期记忆段落。观察积累并经 dream 固化后会出现在这里。</p>}
        <ul className={css.items}>
          {sections.map((section, index) => {
            const record = asRecord(section)
            return (
              <MemoryRow
                key={`s${index}`}
                title={asString(record.title) || asString(record.name)}
                meta={`order ${typeof record.order === 'number' ? record.order : ''}`}
                content={asString(record.content)}
              />
            )
          })}
        </ul>

        <h3 className={css.groupTitle}>实体（entities · {entities.length}）</h3>
        {entities.length === 0 && <p className={css.hint}>暂无实体页。</p>}
        <ul className={css.items}>
          {entities.map((entity, index) => {
            const record = asRecord(entity)
            return (
              <MemoryRow
                key={`e${index}`}
                title={asString(record.title) || asString(record.name)}
                meta={asString(record.status)}
                content={asString(record.content)}
              />
            )
          })}
        </ul>

        <h3 className={css.groupTitle}>观察草稿区（open · {observations.length}）</h3>
        {observations.length === 0 && <p className={css.hint}>草稿区是空的。会话或本面板记下的信号会先落在这里。</p>}
        <ul className={css.items}>
          {observations.map((observation, index) => {
            const record = asRecord(observation)
            const tags = asArray(record.tags).filter(tag => typeof tag === 'string')
            const meta = [
              asString(record.created),
              ...(tags.length > 0 ? [`#${tags.join(' #')}`] : []),
              ...(asString(record.source) !== '' ? [asString(record.source)] : []),
            ].join(' · ')
            return (
              <MemoryRow
                key={`o${index}`}
                title={asString(record.content).split('\n')[0] ?? ''}
                meta={meta}
                content={asString(record.content)}
              />
            )
          })}
        </ul>

        <h3 className={css.groupTitle}>固化日志（dream）</h3>
        <button type="button" className={css.logToggle} onClick={() => { setLogOpen(!logOpen) }}>
          {logOpen ? '收起日志' : '展开日志（记录何时被分析过）'}
        </button>
        {logOpen && (
          props.log === ''
            ? <p className={css.hint}>还没有 dream 运行记录。开启 dream 后到点或点「立即固化」会在此留痕。</p>
            : <pre className={css.logBody}>{props.log}</pre>
        )}
      </section>
    </div>
  )
}
