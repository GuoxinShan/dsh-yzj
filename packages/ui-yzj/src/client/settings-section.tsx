/**
 * The 云之家 settings section (设置 → 云之家): login banner only.
 * 机器人/记忆管理卡已随决策 53（2026-08-25）彻底退役删除——包、RPC、卡片
 * 全无；此 section 只剩登录态。
 */
import type { YzjPanelInject } from './rpc.ts'
import { YzjLoginBanner } from './login-banner.tsx'
import css from './settings-section.module.css'

/** Props: the settings-section owner shares plus the injected RPC face. */
export interface YzjSettingsSectionProps extends Partial<YzjPanelInject> {}

/** The 云之家 settings section: login only（robot/memory 退役，决策 53）。 */
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
