/**
 * The 云之家 settings section (设置 → 云之家): login + 新建助手.
 * 机器人/记忆管理卡已随决策 53 退役。IM 壳助手是 1..N 条单聊，不是一群一机器人。
 */
import { useEffect, useState } from 'react'
import type { YzjPanelInject } from './rpc.ts'
import { YzjLoginBanner } from './login-banner.tsx'
import css from './settings-section.module.css'

/** Props: the settings-section owner shares plus the injected RPC face. */
export interface YzjSettingsSectionProps extends Partial<YzjPanelInject> {}

interface AssistantRow {
  readonly id: string
  readonly name: string
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

/** The 云之家 settings section: login + assistant catalog. */
export function YzjSettingsSection(props: YzjSettingsSectionProps): React.ReactNode {
  const face = props as YzjPanelInject
  const [assistants, setAssistants] = useState<AssistantRow[]>([])
  const [name, setName] = useState('')
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const reload = async (): Promise<void> => {
    const listed = await face.assistantsList?.()
    if (listed === undefined || !listed.ok) return
    const rows = asArray(asRecord(listed.value).assistants).flatMap((item) => {
      const row = asRecord(item)
      const id = asString(row.id)
      if (id === '') return []
      return [{ id, name: asString(row.name) || '助手' }]
    })
    setAssistants(rows)
  }

  useEffect(() => {
    void reload()
    // assistantsList is a stable RPC closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [face.assistantsList])

  const create = async (): Promise<void> => {
    const trimmed = name.trim()
    if (trimmed === '' || busy) return
    setBusy(true)
    setError('')
    const result = await face.assistantsCreate?.(trimmed, prompt.trim() === '' ? undefined : prompt.trim())
    setBusy(false)
    if (result === undefined || !result.ok) {
      setError(result?.error.message ?? '新建失败')
      return
    }
    setName('')
    setPrompt('')
    await reload()
  }

  return (
    <div className={css.section}>
      {face.authStatus !== undefined && face.authLogin !== undefined && (
        <YzjLoginBanner
          authStatus={face.authStatus}
          authLogin={face.authLogin}
          onLoggedIn={() => {}}
        />
      )}
      <div className={css.assistants} data-testid="yzj-settings-assistants">
        <div className={css.assistantsTitle}>助手</div>
        <p className={css.assistantsHint}>特殊单聊，不是一群一机器人。出厂一条「助手」。</p>
        <ul className={css.assistantList}>
          {assistants.map(row => (
            <li key={row.id}>{row.name}</li>
          ))}
        </ul>
        <label className={css.field}>
          名称
          <input
            value={name}
            placeholder="新建助手"
            aria-label="助手名称"
            onChange={event => setName(event.target.value)}
          />
        </label>
        <label className={css.field}>
          说明（可选）
          <textarea
            value={prompt}
            placeholder="可选：技能/口吻备注"
            aria-label="助手说明"
            rows={3}
            onChange={event => setPrompt(event.target.value)}
          />
        </label>
        {error !== '' && <p className={css.alert} role="alert">{error}</p>}
        <button
          type="button"
          className={css.create}
          data-testid="yzj-create-assistant"
          disabled={busy || name.trim() === ''}
          onClick={() => { void create() }}
        >
          新建助手
        </button>
      </div>
    </div>
  )
}
