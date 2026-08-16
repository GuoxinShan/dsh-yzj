/**
 * The 云之家 settings section (设置 → 云之家): the management home for the
 * robot channels and the memory vault — deliberately NOT workspace-panel
 * tabs (user decision: operational tabs stay in the panel; management and
 * configuration live in Settings). A segmented control switches between the
 * two panes; the wrapper owns local data and self-fetches on mount, and its
 * RPC verb implementations update that state, so every pane-internal refresh
 * path (observe submit, dream run, override edits) re-renders naturally.
 */
import { useEffect, useState } from 'react'
import type { YzjPanelInject } from './rpc.ts'
import { RobotPane } from './robot-pane.tsx'
import { MemoryPane } from './memory-pane.tsx'
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

/** One of the two management panes. */
type SettingsPane = 'robot' | 'memory'

/** The 云之家 settings section: segmented 机器人｜记忆 over the two panes. */
export function YzjSettingsSection(props: YzjSettingsSectionProps): React.ReactNode {
  const [pane, setPane] = useState<SettingsPane>('robot')
  const face = props as YzjPanelInject
  const [robotChannels, setRobotChannels] = useState<unknown[]>([])
  const [robotOverrides, setRobotOverrides] = useState<unknown[]>([])
  const [robotCatalog, setRobotCatalog] = useState<unknown[]>([])
  const [robotGroups, setRobotGroups] = useState<unknown[]>([])
  const [robotKey, setRobotKey] = useState('')
  const [robotLoading, setRobotLoading] = useState(true)
  const [robotError, setRobotError] = useState('')
  const [memoryView, setMemoryView] = useState<unknown>({})
  const [memoryLog, setMemoryLog] = useState('')
  const [memoryLoading, setMemoryLoading] = useState(false)
  const [memoryError, setMemoryError] = useState('')

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
    // Group names for the robot detail pages: a fresh multi-page window (the
    // panel cache is not shared with the settings surface).
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

  const fetchMemory = async (): Promise<void> => {
    setMemoryLoading(true)
    setMemoryError('')
    const scope = await face.memoryScope()
    if (!scope.ok) {
      setMemoryLoading(false)
      setMemoryError(scope.error.message)
      return
    }
    const log = await face.memoryLog()
    setMemoryView(asRecord(scope.value).view)
    setMemoryLog(log.ok ? String(asRecord(log.value).log ?? '') : '')
    setMemoryLoading(false)
    if (!log.ok) setMemoryError(`固化日志读取失败：${log.error.message}`)
  }

  useEffect(() => {
    void fetchRobot()
    void fetchMemory()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once; the RPC face is stable
  }, [])

  // The verb wrappers below both forward the RPC and refresh local state, so
  // pane-internal refresh paths (observe submit, dream run, override edits)
  // land in this component's state without any pane changes.
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
  const memoryVerbs = {
    memoryScope: async (): Promise<Rpc> => { const r = await face.memoryScope(); if (r.ok) setMemoryView(asRecord(r.value).view); return r },
    memoryLog: async (): Promise<Rpc> => { const r = await face.memoryLog(); if (r.ok) setMemoryLog(String(asRecord(r.value).log ?? '')); return r },
    memoryObserve: (content: string, tags?: string[], durable?: boolean) => face.memoryObserve(content, tags, undefined, durable),
    dreamState: () => face.dreamState(),
    dreamSet: (partial: { enabled?: boolean; provider?: string; model?: string; dailyAt?: string }) => face.dreamSet(partial),
    dreamRun: async (): Promise<Rpc> => {
      const r = await face.dreamRun()
      void fetchMemory()
      return r
    },
    modelDefault: () => face.modelDefault(),
    modelSetDefault: (provider: string, model: string) => face.modelSetDefault(provider, model),
    modelClearDefault: () => face.modelClearDefault(),
    modelCatalog: () => face.modelCatalog(),
  }

  return (
    <div className={css.section}>
      <div className={css.switcher} role="tablist" aria-label="云之家管理">
        <button
          type="button"
          role="tab"
          aria-selected={pane === 'robot'}
          className={pane === 'robot' ? css.segOn : css.seg}
          onClick={() => { setPane('robot') }}
        >
          机器人
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pane === 'memory'}
          className={pane === 'memory' ? css.segOn : css.seg}
          onClick={() => { setPane('memory') }}
        >
          记忆库
        </button>
      </div>
      <div className={css.content}>
        {pane === 'robot' ? (
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
        ) : (
          <MemoryPane
            view={memoryView}
            log={memoryLog}
            loading={memoryLoading}
            error={memoryError}
            {...memoryVerbs}
          />
        )}
      </div>
    </div>
  )
}
