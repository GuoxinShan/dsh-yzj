/**
 * DSH-side bidirectional robot controls: the model-facing tools that let the
 * operator drive robot channels from any harness session — proactive
 * notifications (`robot_notify`), conversation continuation (`robot_continue`,
 * fabricates an operator turn through the full inbound pipeline), and session
 * fork (`robot_fork`, opens or resumes the bound DSH home for that
 * conversation — never a parallel `fork-*` root). These are operator-trusted channels:
 * unlike the yzj write family they are deliberately NOT gated by the
 * confirmation guard — the robot is the operator's own bot, its outbound is
 * already allowFrom-restricted, and the tool bodies refuse to run inside
 * robot sessions themselves.
 * @module @dsh-yzj/robot-yzj/control
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { JsonValue } from '@deepseek-ai/dsh-tools'
import type { YzjRobot } from './index.ts'

/** Canonical tool value: model sees `content` only; `data` rides presentationMeta. */
interface ControlToolValue {
  content: string
  truncated: boolean
  data?: JsonValue
}

/** Shared output contract (mirrors the yzj tool family's shape). */
export const controlOutput: {
  readonly schema: {
    readonly type: 'object'
    readonly additionalProperties: false
    readonly properties: {
      readonly content: { readonly type: 'string'; readonly required: true }
      readonly truncated: { readonly type: 'boolean'; readonly required: true }
      readonly data: { readonly type: 'json' }
    }
  }
  render(_args: unknown, value: ControlToolValue): { type: 'text'; text: string }[]
  presentationMeta(_args: unknown, value: ControlToolValue): JsonValue
} = {
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      content: { type: 'string', required: true },
      truncated: { type: 'boolean', required: true },
      data: { type: 'json' },
    },
  },
  render: (_args, value) => [{ type: 'text', text: value.content }],
  presentationMeta: (_args, value) => value.data ?? null,
}

/** Reject calls originating inside robot sessions (no self-driving). */
function operatorOnly(sessionId: unknown): void {
  if (typeof sessionId === 'string' && sessionId.startsWith('yzj-robot-')) {
    throw new Error('robot_* 工具仅限操作者会话使用，机器人会话不能驱动自身')
  }
}

/**
 * Register the robot control tools on one context.
 * @param ctx - Cordis context carrying the tools registry.
 * @param robot - the live robot-channel service.
 */
export function applyRobotControlTools(ctx: Context, robot: YzjRobot): void {
  ctx.tools.register(defineTool({
    name: 'robot_status',
    description: 'Inspect every Yunzhijia robot channel: connection state, resolved working directory (cwd), provider/model route, allowFrom, every conversation surface the channel has seen (groupId + robotId + last anchored session id), and live session ids. Use this first to discover session ids for robot_continue / robot_fork.',
    parameters: {},
    output: controlOutput,
    timeoutMs: 10_000,
    isConcurrencySafe: () => true,
    async execute(_args, exec) {
      operatorOnly(exec.agent?.session.id)
      const channels = robot.statuses()
      const lines = channels.map(channel => {
        const parts = [
          `#${channel.index} ${channel.connected ? '已连接' : `断开(${channel.lastError ?? 'unknown'})`}`,
          `cwd=${channel.cwd}`,
          `route=${channel.provider === '' ? '(默认)' : channel.provider}${channel.model === '' ? '' : ` / ${channel.model}`}`,
        ]
        if (channel.surface.length > 0) {
          for (const surface of channel.surface) {
            parts.push(`  surface ${surface.groupId} robot=${surface.robotId}${surface.lastSessionId === undefined ? '' : ` lastSession=${surface.lastSessionId}`}`)
          }
        } else {
          parts.push('  (尚未收到入站消息)')
        }
        if (channel.sessions.length > 0) {
          parts.push(`  live sessions: ${channel.sessions.join(', ')}`)
        }
        return parts.join('\n')
      })
      return {
        content: channels.length === 0 ? '(未配置任何机器人通道)' : lines.join('\n\n'),
        truncated: false,
        // statuses() is lossless-JSON by construction (RPC contract), so the
        // structural cast to JsonValue is a projection, not a lie.
        data: { channels: channels as unknown as JsonValue[] },
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'robot_notify',
    description: 'Proactive notification: push a text message to one robot channel\'s conversation (a group robot pushes to its group, a personal robot to its DM) without any agent turn. Use for digests, alerts, and routine deliveries the operator initiates from DSH.',
    parameters: {
      text: { type: 'string', required: true, description: 'Message body to push.' },
      robotIndex: { type: 'number', description: 'Channel index (robot_status lists them); default 0.' },
    },
    output: controlOutput,
    timeoutMs: 30_000,
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      operatorOnly(exec.agent?.session.id)
      const result = await robot.notify(args.text, args.robotIndex ?? 0)
      if (!result.ok) {
        throw new Error(`robot_notify 推送失败：${result.error ?? 'unknown'}`)
      }
      return {
        content: `已通过机器人通道 ${args.robotIndex ?? 0} 推送消息${result.msgId === undefined ? '' : `（msgId ${result.msgId}）`}`,
        truncated: false,
        data: { ok: true, msgId: result.msgId ?? null },
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'robot_continue',
    description: 'Bidirectional continuation: inject an operator turn into a robot conversation as if the operator had typed it. The full inbound pipeline runs — ack to the conversation, memory injection, agent processing, answer pushed back to the group/DM. Bang commands (!help/!status/!routines/!mute/…) also work through it. Requires the whitelisted operator identity (allowFrom).',
    parameters: {
      text: { type: 'string', required: true, description: 'The message to inject as the operator.' },
      robotIndex: { type: 'number', description: 'Channel index (robot_status lists them); default 0.' },
      groupId: { type: 'string', description: 'Explicit conversation surface (groupId); default = the most recent surface the channel saw.' },
    },
    output: controlOutput,
    timeoutMs: 30_000,
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      operatorOnly(exec.agent?.session.id)
      const result = await robot.continueConversation(args.text, {
        ...(args.robotIndex === undefined ? {} : { robotIndex: args.robotIndex }),
        ...(args.groupId === undefined ? {} : { groupId: args.groupId }),
      })
      if (!result.ok) {
        throw new Error(`robot_continue 失败：${result.error ?? 'unknown'}`)
      }
      return {
        content: `已把操作者消息注入会话 ${result.sessionId ?? '(未锚定)'}，机器人会回复到该会话${args.groupId === undefined ? '' : `（群 ${args.groupId}）`}。`,
        truncated: false,
        data: { ok: true, sessionId: result.sessionId ?? null },
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'robot_fork',
    description: 'Open or resume the bound DSH session for the Yunzhijia conversation behind this session id. Does not create a parallel fork-* root. Returns the bound session id (same id when already bound).',
    parameters: {
      sessionId: { type: 'string', required: true, description: 'Source session id (bound yzj-home-… from robot_status, or a surface lastSessionId).' },
    },
    output: controlOutput,
    timeoutMs: 60_000,
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      operatorOnly(exec.agent?.session.id)
      const result = await robot.forkSession(args.sessionId)
      if (!result.ok) {
        throw new Error(`robot_fork 失败：${result.error ?? 'unknown'}`)
      }
      return {
        content: `已打开/恢复绑定会话 ${result.sessionId}（来源 ${args.sessionId}）。可在 DSH 会话列表继续；未创建平行 fork 根。`,
        truncated: false,
        data: { ok: true, forkSessionId: result.sessionId ?? null, sourceSessionId: args.sessionId },
      }
    },
  }))
}
