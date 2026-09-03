/**
 * Browser half: IM shell occupancy (inbox + conversation) plus keyed tool cards.
 * Workbench overlay / 云之家 dock / topic leftover chrome are not mounted.
 */
import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import type {} from '@deepseek-ai/dsh-client-ui-tool/client'
import { YzjToolCard, YZJ_TOOL_NAMES } from './cards.tsx'
import { applyYzjAtSource } from './input-source.ts'
import { YzjSettingsSection } from './settings-section.tsx'
import { createYzjPanelInject } from './rpc.ts'
import { openPanelTarget } from './panel-controller.ts'
import { focusBoundSession } from './home-focus.ts'
import {
  YZJ_WRITE_TOOL_NAMES, YzjWriteToolCard,
  type WriteCardInjected,
} from './write-card.tsx'
import type { YzjWriteRecord } from '../write-gate.ts'
import { parseContactUser } from '../contact-parse.ts'
import {
  YzjHideHostComposer, selectImComposer, bindImConversationView,
} from './im-shell.tsx'
import { mountInbox } from './inbox-mount.tsx'
import './shell.module.css'

export { createYzjStore } from './stores.ts'
export { createYzjPanelInject } from './rpc.ts'
export type { YzjPanelInject, YzjRpcError } from './rpc.ts'
export { focusBoundSession, bindAndFocusGroup } from './home-focus.ts'
export type { YzjPanelState, YzjPanelActions, YzjTab } from './stores.ts'
export type { YzjPanelProps } from './panel.tsx'
export type { WriteCardInjected } from './write-card.tsx'

/** Required services: the slot registry, connection transport, and sessions. */
export const inject = ['slots', 'connection', 'sessions']

type UnknownRecord = Record<string, unknown>

function asRecord(value: unknown): UnknownRecord {
  return typeof value === 'object' && value !== null ? value as UnknownRecord : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** The client session scope face (see the composer dock for the why). */
function scopeOf(ctx: ClientContext, sessionId: SessionId): import('@deepseek-ai/dsh-client-runtime/client').AgentContext | undefined {
  const sessions = ctx.sessions as unknown as { scope: (id: SessionId) => import('@deepseek-ai/dsh-client-runtime/client').AgentContext | undefined }
  return sessions.scope(sessionId)
}

/** Push plain text into a session's composer draft (slash/input-insert-text). */
function insertDraftText(actx: import('@deepseek-ai/dsh-client-runtime/client').AgentContext, text: string): void {
  const attempt = (): boolean => {
    const conversation = actx.get('conversation') as
      | { input: { for: (actx: unknown) => { state: { getSnapshot(): { draft: string; draftRev: number } } } } }
      | undefined
    const state = conversation?.input.for(actx).state.getSnapshot()
    const length = state?.draft.length ?? 0
    const draftRev = state?.draftRev ?? 0
    return actx.bail(actx, 'slash/input-insert-text', { text, span: { start: length, end: length, draftRev } }) === true
  }
  if (!attempt()) {
    setTimeout(attempt, 80)
  }
}

/**
 * Client plugin body: register the sidebar dock, the group-room workbench,
 * the keyed tool views, and the write-confirmation cards. All registrations
 * are fiber-scoped effects.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  const connection = ctx.get('connection') as ConnectionHandle | undefined
  const rpcInject = createYzjPanelInject(connection)
  const panelInject = {
    ...rpcInject,
    focusBoundSession: (sessionId: string): void => {
      const sessions = ctx.sessions as unknown as Parameters<typeof focusBoundSession>[0] | undefined
      if (sessions === undefined || typeof sessions.open !== 'function') return
      focusBoundSession(sessions, sessionId)
    },
  }
  const openWriteContextFor = (record: YzjWriteRecord): void => openWriteContext(record)

  /** Session-less write face for IM confirm cards (projection already carries the record). */
  const imWrite: WriteCardInjected = {
    fetchWrite: async () => undefined,
    decideWrite: async (writeId, outcome): Promise<boolean> => {
      const result = await panelInject.decideWrite(writeId, outcome)
      return result.ok && asRecord(result.value).settled === true
    },
    openContext: openWriteContextFor,
    editDraft: () => {},
    fetchWhoami: async (): Promise<string> => {
      const result = await panelInject.fetchWhoami()
      if (!result.ok) return ''
      return parseContactUser(result.value).name
    },
    fetchGroups: (limit, page) => panelInject.fetchGroups(limit, page),
    fetchWorkspaces: (type) => panelInject.fetchWorkspaces(type),
    fetchDoc: (id) => panelInject.fetchDoc(id),
    fetchContact: (openId) => panelInject.fetchContact(openId),
  }

  const writeInjectOf = (sessionId?: SessionId): WriteCardInjected => {
    const actx = sessionId === undefined ? undefined : scopeOf(ctx, sessionId)
    return {
      fetchWrite: async (callId): Promise<YzjWriteRecord | undefined> => {
        if (sessionId === undefined) return undefined
        const result = await panelInject.fetchWrite(sessionId, callId)
        if (!result.ok) return undefined
        const list = asArray(asRecord(result.value).list)
        return list.length > 0 ? list[0] as YzjWriteRecord : undefined
      },
      decideWrite: async (writeId, outcome): Promise<boolean> => {
        const result = await panelInject.decideWrite(writeId, outcome)
        return result.ok && asRecord(result.value).settled === true
      },
      openContext: openWriteContextFor,
      editDraft: (text): void => {
        if (actx !== undefined) insertDraftText(actx, text)
      },
      fetchWhoami: async (): Promise<string> => {
        const result = await panelInject.fetchWhoami()
        if (!result.ok) return ''
        return parseContactUser(result.value).name
      },
      fetchGroups: (limit, page) => panelInject.fetchGroups(limit, page),
      fetchWorkspaces: (type) => panelInject.fetchWorkspaces(type),
      fetchDoc: (id) => panelInject.fetchDoc(id),
      fetchContact: (openId) => panelInject.fetchContact(openId),
    }
  }

  ctx.slots.inject('settings.section', () => ctx.slots.register(
    { name: 'settings.section', id: 'yzj', order: 25, label: '云之家', inject: () => panelInject },
    YzjSettingsSection,
  ))

  // workspaces is a single seat already taken by ui-workspace (pitfall-050).
  ctx.effect(() => mountInbox(panelInject))

  // Center is IM (list tab), not host Chat+trajectory. Composer chain hides InputBar.
  // conversation.view has no SlotMap inject face — close over panel/write (pitfall-050).
  ctx.slots.inject('conversation.view', () => ctx.slots.register(
    {
      name: 'conversation.view',
      id: 'yzj-im',
      order: -200,
      label: '助手',
    },
    bindImConversationView(panelInject, imWrite),
  ))
  ctx.slots.inject('conversation.composer', () => ctx.slots.register(
    {
      name: 'conversation.composer',
      select: selectImComposer,
      priority: -50,
    },
    YzjHideHostComposer,
  ))

  applyYzjAtSource(ctx, panelInject)

  // Write tools render only the confirmation-enhanced card (which falls back
  // to the ordinary card internally); registering both under the same key
  // would collide in the keyed toolview seat.
  const writeNames = YZJ_WRITE_TOOL_NAMES as readonly string[]
  for (const toolName of YZJ_TOOL_NAMES) {
    if (writeNames.includes(toolName)) continue
    ctx.slots.inject('tool.call.toolview', () => ctx.slots.register(
      {
        name: 'tool.call.toolview',
        key: toolName,
        // Cards jump into the workbench domain (查看详情).
        inject: () => ({ openPanel: openPanelTarget }),
      },
      YzjToolCard,
    ))
  }

  for (const toolName of YZJ_WRITE_TOOL_NAMES) {
    ctx.slots.inject('tool.call.toolview', () => ctx.slots.register(
      {
        name: 'tool.call.toolview',
        key: toolName,
        inject: (sessionId: SessionId): WriteCardInjected => writeInjectOf(sessionId),
      },
      YzjWriteToolCard,
    ))
  }
}

/**
 * The 查看上下文 jump (write card): drive the real panel (via the live
 * controller) onto the context the write targets. IM writes anchor on the
 * replied-to message when this write is a reply.
 */
function openWriteContext(record: YzjWriteRecord): void {
  const args = asRecord(record.args)
  if (record.domain === 'im') {
    const groupId = asString(args.groupId)
    if (groupId === '') return
    const replyTarget = asString(args.replyMsgId)
    openPanelTarget({ kind: 'group', groupId }, replyTarget === '' ? undefined : replyTarget)
  } else if (record.domain === 'doc' || record.domain === 'kb' || record.domain === 'sheet') {
    const workspace = asString(args.workspace)
    if (workspace !== '') openPanelTarget({ kind: 'workspace', workspaceId: workspace })
  } else {
    // Calendar writes: open the panel on the calendar tab as-is.
    openPanelTarget({ kind: 'event', event: { id: '', startDate: 0, title: '' } })
  }
}
