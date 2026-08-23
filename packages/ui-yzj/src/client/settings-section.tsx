/**
 * The 云之家 settings section (设置 → 云之家): login banner only.
 * 机器人管理卡已撤下（决策 50，2026-08-23）：产品面未想清；robot-yzj 插件与
 * memory-yzj 仍挂载（通道/工具后台在跑），robot-pane.tsx / memory-pane.tsx
 * 保留待恢复或删除。Memory vault UI 本来就 deferred（R21 v1.6）。
 */
import type { YzjPanelInject } from './rpc.ts'
import { YzjLoginBanner } from './login-banner.tsx'
import css from './settings-section.module.css'

/** Props: the settings-section owner shares plus the injected RPC face. */
export interface YzjSettingsSectionProps extends Partial<YzjPanelInject> {}

/** The 云之家 settings section: login only (robot/memory cards removed, 决策 50). */
export function YzjSettingsSection(props: YzjSettingsSectionProps): React.ReactNode {
  const face = props as YzjPanelInject
  return (
    <div className={css.section}>
      {face.authStatus !== undefined && face.authLogin !== undefined && (
        <YzjLoginBanner
          authStatus={face.authStatus}
          authLogin={face.authLogin}
          onLoggedIn={() => {}}
        />
      )}
    </div>
  )
}
