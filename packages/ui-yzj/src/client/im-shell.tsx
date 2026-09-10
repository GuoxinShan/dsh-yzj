/**
 * Center IM shell occupying conversation / conversation.view.
 * Keeps assistant / group panes mounted (CSS-hidden) so drafts and
 * timelines survive inbox row switches; warm snapshots cover 消息↔会话 remounts.
 * Tool process opens the real assistant session on 会话 (no IM peek page).
 */
import { useEffect, useState } from 'react'
import type { ComposerChainProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { YzjPanelInject } from './rpc.ts'
import { YzjInbox } from './inbox.tsx'
import { YzjAssistantDm } from './assistant-dm.tsx'
import { YzjGroupRoom } from './group-room.tsx'
import {
  electImComposer, getImSelection, markImOccupancy, subscribeImSelection,
  type ImSelection,
} from './im-nav.ts'
import type { WriteCardInjected } from './write-card.tsx'
import { watchHostChrome } from './host-chrome.ts'
import css from './shell.module.css'

function hideStyle(on: boolean): { display: 'none' } | undefined {
  return on ? { display: 'none' } : undefined
}

function rememberId(prev: string[], id: string, max = 6): string[] {
  if (prev[prev.length - 1] === id) return prev
  const next = prev.filter(row => row !== id)
  next.push(id)
  return next.length <= max ? next : next.slice(next.length - max)
}

function rememberGroup(
  prev: Array<{ groupId: string; groupName: string }>,
  groupId: string,
  groupName: string,
  max = 6,
): Array<{ groupId: string; groupName: string }> {
  const without = prev.filter(row => row.groupId !== groupId)
  without.push({ groupId, groupName })
  return without.length <= max ? without : without.slice(without.length - max)
}

function selectionKey(sel: ImSelection): string {
  if (sel.kind === 'group') return `g:${sel.groupId}`
  return `a:${sel.assistantId}`
}

export function YzjImShell(props: {
  panel: YzjPanelInject
  writeInject: WriteCardInjected
  /** Occupying sidebar.workspaces — inbox is a sibling, not nested. */
  mode: 'inbox' | 'conversation'
}) {
  const [sel, setSel] = useState(getImSelection)
  const [seenAssistants, setSeenAssistants] = useState<string[]>(() => {
    const cur = getImSelection()
    return [cur.kind === 'group' ? 'default' : cur.assistantId]
  })
  const [seenGroups, setSeenGroups] = useState<Array<{ groupId: string; groupName: string }>>(() => {
    const cur = getImSelection()
    return cur.kind === 'group'
      ? [{ groupId: cur.groupId, groupName: cur.groupName ?? '' }]
      : []
  })

  useEffect(() => markImOccupancy(), [])
  useEffect(() => subscribeImSelection(() => {
    setSel(getImSelection())
  }), [])

  useEffect(() => {
    if (sel.kind === 'assistant') {
      setSeenAssistants(prev => rememberId(prev, sel.assistantId))
    }
    if (sel.kind === 'group') {
      setSeenGroups(prev => rememberGroup(prev, sel.groupId, sel.groupName ?? ''))
    }
  }, [sel])

  if (props.mode === 'inbox') {
    return <YzjInbox panel={props.panel} />
  }

  const assistantOn = sel.kind === 'assistant'
  const groupOn = sel.kind === 'group'

  return (
    <div className={css.shellStack} data-testid="yzj-im-shell" data-yzj-sel={selectionKey(sel)}>
      {seenAssistants.map(id => (
        <div
          key={`a-${id}`}
          style={hideStyle(!(assistantOn && sel.assistantId === id))}
          hidden={!(assistantOn && sel.assistantId === id)}
        >
          <YzjAssistantDm
            assistantId={id}
            panel={props.panel}
            writeInject={props.writeInject}
          />
        </div>
      ))}

      {seenGroups.map(row => (
        <div
          key={`g-${row.groupId}`}
          style={hideStyle(!(groupOn && sel.groupId === row.groupId))}
          hidden={!(groupOn && sel.groupId === row.groupId)}
        >
          <YzjGroupRoom
            groupId={row.groupId}
            groupName={row.groupName}
            panel={props.panel}
            defaultAssistantId="default"
          />
        </div>
      ))}
    </div>
  )
}

/** Conversation-view occupant: host session props are unused (IM selection bus). */
export function YzjConversationSlot(props: {
  panel: YzjPanelInject
  writeInject: WriteCardInjected
}) {
  return <YzjImShell mode="conversation" panel={props.panel} writeInject={props.writeInject} />
}

/** Bind panel/write into a slot component (conversation.view has no inject face). */
export function bindImConversationView(panel: YzjPanelInject, writeInject: WriteCardInjected) {
  return function YzjImConversationView() {
    return <YzjConversationSlot panel={panel} writeInject={writeInject} />
  }
}

/** Chain select: hide the official InputBar while the IM shell owns the center. */
export function selectImComposer({ interactions }: ComposerChainProps): { im: true } | null {
  return electImComposer(interactions)
}

/** Collapse the official composer seat; the IM shell draws its own. */
export function YzjHideHostComposer() {
  useEffect(() => watchHostChrome(), [])
  return null
}
