// @vitest-environment jsdom
/**
 * Host InputBar / session chrome must collapse with or without data-composer-seat.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { applyHostChromeHide, watchHostChrome } from '../src/client/host-chrome.ts'
import { markImOccupancy, resetImSelection } from '../src/client/im-nav.ts'

function hostTree(opts: { seat: boolean }): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = `
    <header class="ConversationRoot-module_header_x">
      <div class="titleRow">
        <nav class="crumbs"><button type="button">调用 yzj_advance_feed: adv...</button></nav>
        <div class="headerActions"><button type="button">标准模式</button></div>
        <div class="headerUtilities">
          <button type="button" class="sessionLogButton">Session 日志</button>
          <button type="button" aria-label="layout">▣</button>
        </div>
      </div>
    </header>
    <div data-conversation-scroll="">
      <div class="composerStack InputBar-module_root_x" ${opts.seat ? 'data-composer-seat=""' : ''}>
        <div data-composer-card="">
          <textarea placeholder="发消息或做任务... / 调用指令 @ 文件或对话"></textarea>
        </div>
        <div class="stats">2 轮 · 5 步 | LLM 26.4 秒</div>
      </div>
      <div data-yzj-im-composer="">
        <textarea placeholder="发给助手" data-testid="im-box"></textarea>
      </div>
    </div>
  `
  return root
}

describe('host chrome hide', () => {
  afterEach(() => {
    resetImSelection()
    document.body.replaceChildren()
    document.documentElement.removeAttribute('data-dsh-yzj-im')
  })

  it('collapses the official bar when data-composer-seat is missing (alpha.3)', () => {
    const tree = hostTree({ seat: false })
    document.body.append(tree)
    document.documentElement.setAttribute('data-dsh-yzj-im', '')
    applyHostChromeHide()
    const hostInput = tree.querySelector<HTMLTextAreaElement>('textarea[placeholder^="发消息或做任务"]')
    expect(hostInput?.closest('[data-yzj-host-hidden], [hidden]')).not.toBeNull()
    expect(tree.querySelector('[data-testid="im-box"]')?.closest('[data-yzj-host-hidden]')).toBeNull()
    expect(tree.querySelector('.titleRow')?.hasAttribute('data-yzj-host-hidden')).toBe(true)
    expect(tree.querySelector('.headerActions')?.hasAttribute('data-yzj-host-hidden')).toBe(true)
    expect(tree.querySelector('.sessionLogButton')?.hasAttribute('data-yzj-host-hidden')).toBe(true)
  })

  it('collapses the official bar when data-composer-seat exists (rc.7)', () => {
    const tree = hostTree({ seat: true })
    document.body.append(tree)
    document.documentElement.setAttribute('data-dsh-yzj-im', '')
    applyHostChromeHide()
    expect(tree.querySelector('[data-composer-seat]')?.hasAttribute('data-yzj-host-hidden')).toBe(true)
    expect(tree.querySelector('[data-testid="im-box"]')?.closest('[data-yzj-host-hidden]')).toBeNull()
  })

  it('watchHostChrome hides a late-mounted InputBar that has no seat attribute', () => {
    document.documentElement.setAttribute('data-dsh-yzj-im', '')
    const stop = watchHostChrome()
    const tree = hostTree({ seat: false })
    document.body.append(tree)
    applyHostChromeHide()
    expect(tree.querySelector('[data-composer-card]')?.hasAttribute('data-yzj-host-hidden')).toBe(true)
    expect(tree.querySelector('[data-testid="im-box"]')?.closest('[data-yzj-host-hidden]')).toBeNull()
    stop()
  })

  it('markImOccupancy starts the watcher so inbox-only mount still hides the bar', () => {
    const tree = hostTree({ seat: false })
    document.body.append(tree)
    const stop = markImOccupancy()
    expect(document.documentElement.hasAttribute('data-dsh-yzj-im')).toBe(true)
    expect(tree.querySelector('[data-composer-card]')?.hasAttribute('data-yzj-host-hidden')).toBe(true)
    stop()
  })

  it('does not hide an IM composer that shares the composerCard class fragment', () => {
    const im = document.createElement('div')
    im.setAttribute('data-yzj-im-composer', '')
    im.className = 'shell-module_composerCard_abc'
    im.innerHTML = '<textarea placeholder="发给助手"></textarea>'
    document.body.append(im)
    document.documentElement.setAttribute('data-dsh-yzj-im', '')
    const stop = watchHostChrome()
    expect(im.hasAttribute('data-yzj-host-hidden')).toBe(false)
    stop()
  })
})
