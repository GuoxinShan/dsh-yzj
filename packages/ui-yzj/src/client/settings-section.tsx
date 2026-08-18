/**
 * The 云之家 settings section (设置 → 云之家): robot-channel management.
 * Memory vault UI is deferred (R21 v1.6); memory-yzj stays mounted for tools.
 */
import { useEffect, useState } from 'react'
import type { YzjPanelInject } from './rpc.ts'
import { RobotPane } from './robot-pane.tsx'
import { YzjLoginBanner } from './login-banner.tsx'
import css from './settings-section.module.css'

type Rpc = { ok: true; value: unknown } | { ok: false; error: { message: string } }

/** Props: the settings-section owner shares plus the injected RPC face. */
export interface YzjSettingsSectionProps extends Partial<YzjPanelInject> {}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

/** The 云之家 settings section: robot channels only (memory pane deferred). */
export function YzjSettingsSection(props: YzjSettingsSectionProps): React.ReactNode {
  const face = props as YzjPanelInject
  const [robotChannels, setRobotChannels] = useState<unknown[]>([])
  const [robotOverrides, setRobotOverrides] = useState<unknown[]>([])
  const [robotCatalog, setRobotCatalog] = useState<unknown[]>([])
  const [robotGroups, setRobotGroups] = useState<unknown[]>([])
  const [robotKey, setRobotKey] = useState('')
  const [robotLoading, setRobotLoading] = useState(true)
  const [robotError, setRobotError] = useState('')

  const fetchRobot = async (): Promise<void> => {
    setRobotLoading(true)
    setRobotError('')
    const status = await face.robotStatus()
    if (!status.ok) {
      setRobotLoading(false)
      setRobotError(status.error.message)
      return
    }
    const overrides = await face.robotOverrides()
    const models = await face.robotModels()
    const pages: unknown[][] = []
    for (let page = 1; page <= 3; page += 1) {
      const result = await face.fetchGroups(20, page)
      if (!result.ok) break
      pages.push(asArray(asRecord(result.value).list))
      if (asRecord(result.value).more !== true) break
    }
    const seen = new Set<string>()
    const merged = pages.flat().filter(item => {
      const id = String(asRecord(item).groupId)
      if (id === '' || seen.has(id)) return false
      seen.add(id)
      return true
    })
    setRobotChannels(asArray(asRecord(status.value).channels))
    setRobotOverrides(overrides.ok ? asArray(asRecord(overrides.value).overrides) : [])
    setRobotCatalog(models.ok ? asArray(asRecord(models.value).catalog) : [])
    setRobotGroups(merged)
    setRobotLoading(false)
    if (!overrides.ok) setRobotError(overrides.error.message)
    else if (!models.ok) setRobotError(`模型目录读取失败：${models.error.message}`)
  }

  useEffect(() => {
    void fetchRobot()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once; the RPC face is stable
  }, [])

  const robotVerbs = {
    robotStatus: async (): Promise<Rpc> => { const r = await face.robotStatus(); if (r.ok) setRobotChannels(asArray(asRecord(r.value).channels)); return r },
    robotOverrides: async (): Promise<Rpc> => { const r = await face.robotOverrides(); if (r.ok) setRobotOverrides(asArray(asRecord(r.value).overrides)); return r },
    robotModels: async (): Promise<Rpc> => face.robotModels(),
    setRobotOverride: (key: string, provider: string | undefined, model: string | undefined) => face.setRobotOverride(key, provider, model),
    deleteRobotOverride: (key: string) => face.deleteRobotOverride(key),
    robotShareList: (groupId: string, robotIndex?: number) => face.robotShareList(groupId, robotIndex),
    robotShareRead: (groupId: string, filename: string, robotIndex?: number) => face.robotShareRead(groupId, filename, robotIndex),
    robotOpenFolder: (groupId: string | undefined, robotIndex?: number) => face.robotOpenFolder(groupId, robotIndex),
    robotShareWrite: (input: { groupId: string; filename: string; content: string; overwrite?: boolean; robotIndex?: number }) => face.robotShareWrite(input),
    robotChannelsSave: (input: Parameters<YzjPanelInject['robotChannelsSave']>[0]) => face.robotChannelsSave(input),
  }

  return (
    <div className={css.section}>
      {face.authStatus !== undefined && face.authLogin !== undefined && (
        <YzjLoginBanner
          authStatus={face.authStatus}
          authLogin={face.authLogin}
          onLoggedIn={() => { void fetchRobot() }}
        />
      )}
      <div className={css.content}>
        <RobotPane
          channels={robotChannels}
          overrides={robotOverrides}
          catalog={robotCatalog}
          selectedKey={robotKey}
          groups={robotGroups}
          loading={robotLoading}
          error={robotError}
          onSelectKey={key => { setRobotKey(key) }}
          onOverridesRefreshed={overrides => { setRobotOverrides(overrides) }}
          {...robotVerbs}
        />
      </div>
    </div>
  )
}
