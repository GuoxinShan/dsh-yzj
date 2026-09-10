/**
 * Persistent 消息 / 会话 occupancy switch (I16). Mounted in sidebar chrome
 * above host「新会话」so 会话态 reads 表面 → 新会话 → 工作区.
 */
import type { ImSurface } from './im-nav.ts'
import { setImSurface } from './im-nav.ts'
import css from './shell.module.css'

export function YzjSurfaceSwitch(props: { surface: ImSurface }) {
  return (
    <div
      className={css.surfaceSwitch}
      role="tablist"
      aria-label="表面"
      data-yzj-surface-switch=""
      data-testid="yzj-surface-switch"
    >
      <button
        type="button"
        role="tab"
        className={props.surface === 'im' ? css.surfaceTabOn : css.surfaceTab}
        aria-selected={props.surface === 'im'}
        data-testid="yzj-surface-im"
        onClick={() => setImSurface('im')}
      >
        消息
      </button>
      <button
        type="button"
        role="tab"
        className={props.surface === 'session' ? css.surfaceTabOn : css.surfaceTab}
        aria-selected={props.surface === 'session'}
        data-testid="yzj-surface-session"
        onClick={() => setImSurface('session')}
      >
        会话
      </button>
    </div>
  )
}
