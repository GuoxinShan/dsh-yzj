/**
 * Hide host ConversationRoot chrome while the IM shell owns the surface.
 * Must not depend on `[data-composer-seat]` (absent on harness 0.1.2-alpha.3;
 * rc.7 overlay:true also leaves the fallback InputBar mounted — pitfall-052).
 */
const HIDDEN_ATTR = 'data-yzj-host-hidden'

const HOST_SELECTORS = [
  '[data-composer-seat]',
  '[data-composer-card]',
  '[class*="composerSeat"]',
  '[class*="composerStack"]',
  '[class*="composerHero"]',
  '[class*="InputBar"]',
  '[class*="titleRow"]',
  '[class*="headerUtilities"]',
  '[class*="headerActions"]',
  '[class*="sessionLogButton"]',
] as const

const IM_OWNED = '[data-yzj-im-composer], [data-yzj-im-header], [data-yzj-inbox-host], [data-yzj-surface-switch], [data-yzj-surface-root], [data-testid="yzj-inbox"]'

function ownedByIm(node: Element): boolean {
  return node.closest(IM_OWNED) !== null
}

function collapse(el: HTMLElement): void {
  if (ownedByIm(el)) return
  if (el.hasAttribute('data-conversation-scroll')) return
  if (el.querySelector('[data-yzj-im-composer], [data-yzj-im-header]') !== null) return
  if (el.hasAttribute(HIDDEN_ATTR)) return
  el.setAttribute(HIDDEN_ATTR, '')
  el.setAttribute('hidden', '')
  el.style.setProperty('display', 'none', 'important')
  el.style.setProperty('height', '0', 'important')
  el.style.setProperty('min-height', '0', 'important')
  el.style.setProperty('overflow', 'hidden', 'important')
  el.style.setProperty('padding', '0', 'important')
  el.style.setProperty('margin', '0', 'important')
}

function restore(el: HTMLElement): void {
  el.removeAttribute(HIDDEN_ATTR)
  el.removeAttribute('hidden')
  el.style.removeProperty('display')
  el.style.removeProperty('height')
  el.style.removeProperty('min-height')
  el.style.removeProperty('overflow')
  el.style.removeProperty('padding')
  el.style.removeProperty('margin')
}

function restoreAll(): void {
  if (typeof document === 'undefined') return
  for (const el of document.querySelectorAll<HTMLElement>(`[${HIDDEN_ATTR}]`)) restore(el)
}

function hidePlaceholderHosts(): void {
  for (const node of document.querySelectorAll('textarea, input')) {
    const placeholder = node.getAttribute('placeholder') ?? ''
    if (!placeholder.includes('发消息或做任务')) continue
    const wrap = node.closest<HTMLElement>(
      '[data-composer-seat], [data-composer-card], [class*="composerStack"], [class*="composerSeat"], [class*="InputBar"]',
    ) ?? (node.parentElement instanceof HTMLElement ? node.parentElement : null)
    if (wrap !== null) collapse(wrap)
  }
}

function hideSessionChromeButtons(): void {
  for (const btn of document.querySelectorAll('button')) {
    const label = `${btn.textContent ?? ''} ${btn.getAttribute('aria-label') ?? ''}`
    if (!/Session\s*日志|Session log|标准模式/.test(label)) continue
    const wrap = btn.closest<HTMLElement>(
      'header, [class*="titleRow"], [class*="headerUtilities"], [class*="headerActions"]',
    )
    collapse(wrap instanceof HTMLElement ? wrap : btn)
  }
}

function hideStatsLines(): void {
  for (const el of document.querySelectorAll<HTMLElement>('div, span, p')) {
    if (ownedByIm(el)) continue
    const text = (el.textContent ?? '').trim()
    if (text.length === 0 || text.length > 280) continue
    if (!/^\d+\s*轮\s*·/.test(text)) continue
    const wrap = el.closest<HTMLElement>(
      '[data-composer-seat], [class*="composerStack"], [class*="InputBar"]',
    )
    if (wrap === null || wrap.hasAttribute('data-conversation-scroll')) continue
    collapse(wrap)
  }
}

function restoreComposerHeight(): void {
  for (const scroller of document.querySelectorAll<HTMLElement>('[data-conversation-scroll]')) {
    scroller.style.removeProperty('--dsh-composer-height')
  }
}

/**
 * Collapse host InputBar / session header / stats when IM occupancy is on.
 * No-op and restores when `html[data-dsh-yzj-im]` is absent (会话 surface).
 */
export function applyHostChromeHide(): void {
  if (typeof document === 'undefined') return
  if (!document.documentElement.hasAttribute('data-dsh-yzj-im')) {
    restoreAll()
    restoreComposerHeight()
    return
  }
  for (const selector of HOST_SELECTORS) {
    for (const node of document.querySelectorAll<HTMLElement>(selector)) collapse(node)
  }
  hidePlaceholderHosts()
  hideSessionChromeButtons()
  hideStatsLines()
  for (const scroller of document.querySelectorAll<HTMLElement>('[data-conversation-scroll]')) {
    scroller.style.setProperty('--dsh-composer-height', '0px')
  }
}

let watchers = 0
let observer: MutationObserver | undefined

/**
 * Keep host chrome collapsed for the lifetime of IM occupancy.
 * Ref-counted so inbox mount and the composer chain can both subscribe.
 */
export function watchHostChrome(): () => void {
  if (typeof document === 'undefined') return () => {}
  watchers += 1
  applyHostChromeHide()
  if (watchers === 1) {
    observer = new MutationObserver(() => { applyHostChromeHide() })
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-dsh-yzj-im'],
    })
  }
  return () => {
    watchers -= 1
    if (watchers > 0) return
    observer?.disconnect()
    observer = undefined
    restoreAll()
  }
}
