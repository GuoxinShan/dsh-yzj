/**
 * Memory vault browser pane: sections/entities (expandable), open
 * observations, injection stats, the dream log tail, and a panel-direct
 * "记一条" observe composer (user's own will — no confirmation card).
 * Data arrives through the injected RPC face; rendering is defensive over
 * the raw memory-yzj payloads (an unavailable service renders a hint).
 */
import { useState } from 'react'
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
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
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

      <section className={css.quick}>
        <textarea
          className={css.quickInput}
          value={draft}
          placeholder="记一条：稳定的偏好、事实或决策（进观察草稿区，由定期 dream 固化成长期记忆）"
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
            ? <p className={css.hint}>还没有 dream 运行记录。定时 routine（memory-dream）到点后会在此留痕。</p>
            : <pre className={css.logBody}>{props.log}</pre>
        )}
      </section>
    </div>
  )
}
