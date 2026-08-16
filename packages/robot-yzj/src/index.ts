/**
 * Host plugin for the Yunzhijia robot channel: wires the measured inbound
 * WebSocket (protocol.ts / socket.ts), the outbound sender (outbound.ts), and
 * the session router (router.ts) into one Cordis service (`ctx.yzjRobot`).
 * One channel per configured robot (personal DM robot, group conversation
 * robot, …), each with its own socket, sender, and router. Lifecycle is
 * effect-owned — stop/unload closes every socket, cancels every timer, and
 * leaves no residue. The allowFrom policy resolves the CLI login user's openId
 * through the bridge (`contact user get`), so by default only the machine's
 * owner can drive the robots.
 * @module @dsh-yzj/robot-yzj
 */

import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { SocketStatus } from './socket.ts'
import { RobotSocket } from './socket.ts'
import { deriveWebSocketUrl } from './protocol.ts'
import { RobotSender } from './outbound.ts'
import { RobotRouter, dmSessionId } from './router.ts'
import { OverrideStore } from './overrides.ts'
import { ConfirmBroker, type ConfirmApprovalRequest, type ConfirmAskPending } from './confirm.ts'
import { PushHub, type PushSessionEvent } from './push.ts'
import { MemoryStore } from './memory.ts'

/** Plugin name used by loader diagnostics. */
export const name = 'robot-yzj'
/** Required services: the CLI bridge (allowFrom resolution) and the agent registry (robot sessions). */
export const inject = ['yzjBridge', 'agents']

declare module '@deepseek-ai/cordis' {
  interface Context {
    yzjRobot: YzjRobot
  }
  interface Events {
    /** tool-yzj's guard broadcast before asking on a gated write. */
    'yzj/ask-pending'(pending: ConfirmAskPending): void
    'approval/request'(
      req: ConfirmApprovalRequest,
      next: () => Promise<'allowed-once' | 'rejected' | 'cancelled' | 'unavailable'>,
    ): Promise<'allowed-once' | 'rejected' | 'cancelled' | 'unavailable'>
  }
}

/** One robot channel's configuration. */
export interface RobotChannelConfig {
  /** The robot's sendMsgUrl (personal-robot page or group conversation robot detail). */
  sendMsgUrl: string
  /** Whether to bring this channel up. Defaults to true. */
  enabled?: boolean
  /** openIds allowed to drive this robot; defaults to the CLI login user. */
  allowFrom?: string[]
  /** Default provider route for this robot's sessions; empty = the harness default. */
  provider?: string
  /** Default model id for this robot's sessions; empty = the harness default. */
  model?: string
}

/** Plugin configuration: a robot list plus legacy single-robot fields. */
export interface Config {
  /** Default provider for every robot without its own; empty = harness default. */
  defaultProvider?: string
  /** Default model for every robot without its own; empty = harness default. */
  defaultModel?: string
  /** Robot channels; each gets its own WS connection, sender, and router. */
  robots?: RobotChannelConfig[]
  /** Legacy single-robot sendMsgUrl — used as robot #0 when `robots` is empty. */
  sendMsgUrl?: string
  /** Legacy single-robot enable (applies to the synthesized robot #0). */
  enabled?: boolean
  /** Legacy single-robot allowFrom (applies to the synthesized robot #0). */
  allowFrom?: string[]
  /** Legacy single-robot provider (applies to the synthesized robot #0). */
  provider?: string
  /** Legacy single-robot model (applies to the synthesized robot #0). */
  model?: string
}

const RobotChannelSchema: z<RobotChannelConfig> = z.object({
  sendMsgUrl: z.string(),
  enabled: z.boolean().default(true),
  allowFrom: z.array(z.string()).default([]),
  provider: z.string().default(''),
  model: z.string().default(''),
})

const ConfigSchema: z<Config> = z.object({
  defaultProvider: z.string().default(''),
  defaultModel: z.string().default(''),
  robots: z.array(RobotChannelSchema).default([]),
  sendMsgUrl: z.string().default(''),
  enabled: z.boolean().default(true),
  allowFrom: z.array(z.string()).default([]),
  provider: z.string().default(''),
  model: z.string().default(''),
})

const DEFAULT_ACK_TEXT = '收到，处理中…'
const DEFAULT_DENY_TEXT = '抱歉，你不在本机器人的白名单内。'

/** Live status of one channel, projected to RPC consumers (lossless JSON). */
export interface RobotChannelStatus extends RobotChannelConfig {
  /** Index of the channel in config order. */
  index: number
  connected: boolean
  lastError: string | null
  lastFrameAt: number
}

/** One running robot channel: socket + sender + router + status mirror. */
interface RunningChannel {
  readonly config: RobotChannelConfig
  readonly sender: RobotSender
  readonly router: RobotRouter
  readonly socket: RobotSocket
  readonly status: SocketStatus
}

/**
 * The robot-channel service: one managed connection per configured robot.
 * `send()` is the proactive-push entry on channel 0; `statuses()` feeds the
 * panel; inbound turns flow through each channel's router into agent sessions.
 */
export class YzjRobot extends Service {
  static Config: z<Config> = ConfigSchema
  static inject = ['yzjBridge', 'agents']

  private readonly channels: RunningChannel[] = []
  private readonly overrides = new OverrideStore()
  private readonly confirm = new ConfirmBroker()
  private readonly hub = new PushHub()
  private readonly memory = new MemoryStore()

  constructor(ctx: Context, config: Config) {
    super(ctx, 'yzjRobot')
    const fillDefaults = (robot: RobotChannelConfig): RobotChannelConfig => ({
      ...robot,
      ...(robot.provider === undefined || robot.provider === '' ? (config.defaultProvider === undefined || config.defaultProvider === '' ? {} : { provider: config.defaultProvider }) : {}),
      ...(robot.model === undefined || robot.model === '' ? (config.defaultModel === undefined || config.defaultModel === '' ? {} : { model: config.defaultModel }) : {}),
    })
    const robots = config.robots !== undefined && config.robots.length > 0
      ? config.robots.map(fillDefaults)
      : config.sendMsgUrl === undefined || config.sendMsgUrl === ''
        ? []
        : [fillDefaults({
            sendMsgUrl: config.sendMsgUrl,
            enabled: config.enabled ?? true,
            allowFrom: config.allowFrom ?? [],
            provider: config.provider ?? '',
            model: config.model ?? '',
          })]
    this.startAll(robots)
  }

  /** Status of every configured channel (config order). */
  statuses(): RobotChannelStatus[] {
    return this.channels.map((channel, index) => ({
      index,
      sendMsgUrl: channel.config.sendMsgUrl,
      enabled: channel.config.enabled ?? true,
      allowFrom: channel.config.allowFrom ?? [],
      provider: channel.config.provider ?? '',
      model: channel.config.model ?? '',
      connected: channel.status.connected,
      lastError: channel.status.lastError,
      lastFrameAt: channel.status.lastFrameAt,
    }))
  }

  /** Proactive outbound push on the first enabled channel (routines, digests). */
  async send(text: string): Promise<{ ok: boolean; msgId?: string; error?: string }> {
    const channel = this.channels.find(item => (item.config.enabled ?? true) && item.status.connected)
    if (channel === undefined) return { ok: false, error: 'no connected robot channel' }
    return channel.sender.send(text)
  }

  /** Stable DM session id for one robot and one user openId. */
  dmSession(robotId: string, operatorOpenid: string): string {
    return dmSessionId(robotId, operatorOpenid)
  }

  /** Every persisted model override (lossless JSON for RPC). */
  listOverrides(): { key: string; provider?: string; model?: string }[] {
    return this.overrides.entries()
  }

  /** Persist one conversation's model override (whole-record replace). */
  async setOverride(key: string, override: { provider?: string; model?: string }): Promise<void> {
    if (override.provider === undefined && override.model === undefined) {
      await this.overrides.delete(key)
      return
    }
    await this.overrides.put(key, override)
  }

  /** Remove one conversation's override. */
  async deleteOverride(key: string): Promise<boolean> {
    return this.overrides.delete(key)
  }

  /**
   * Provider/model catalog for the UI picker: active adapter routes
   * (`listProviders`) merged with the configurable directory
   * (`listConfigurableProviders` — dormant-but-selectable providers), each
   * with its model list when it can be enumerated.
   */
  async modelCatalog(): Promise<{ provider: string; models: string[] }[]> {
    const llm = this.ctx.get('llm') as
      | {
          listProviders(): { provider?: string }[]
          listConfigurableProviders(): { provider?: string }[]
          listModels(provider: string): Promise<{ id?: string; model?: string }[]>
        }
      | undefined
    if (llm === undefined) return []
    const names = [...new Set([
      ...llm.listProviders().map(entry => String(entry.provider ?? '')),
      ...llm.listConfigurableProviders().map(entry => String(entry.provider ?? '')),
    ].filter(name => name !== ''))]
    return Promise.all(names.map(async provider => {
      try {
        const models = await llm.listModels(provider)
        return { provider, models: models.map(m => String(m.id ?? m.model ?? '')).filter(id => id !== '') }
      } catch (error) {
        this.ctx.logger.warn(`robot: listModels failed for ${provider}: ${String(error)}`)
        return { provider, models: [] }
      }
    }))
  }

  /** Build and start every channel (idempotent per constructor call). */
  private startAll(robots: readonly RobotChannelConfig[]): void {
    for (const robotConfig of robots) {
      if (!(robotConfig.enabled ?? true)) continue
      if (robotConfig.sendMsgUrl === '') continue
      const channel = this.makeChannel(robotConfig)
      this.channels.push(channel)
      channel.socket.start()
    }
  }

  /** Assemble one channel's runtime pieces. */
  private makeChannel(robotConfig: RobotChannelConfig): RunningChannel {
    const sender = new RobotSender({ sendMsgUrl: robotConfig.sendMsgUrl })
    const agentOptions = {
      ...(robotConfig.provider === undefined || robotConfig.provider === '' ? {} : { provider: robotConfig.provider }),
      ...(robotConfig.model === undefined || robotConfig.model === '' ? {} : { model: robotConfig.model }),
    }
    const router = new RobotRouter({
      agents: this.ctx.agents,
      sender,
      allowFrom: () => this.resolveAllowFrom(robotConfig),
      ...(Object.keys(agentOptions).length === 0 ? {} : { agentOptions }),
      resolveOverride: key => this.overrides.get(key),
      confirm: this.confirm,
      push: this.hub,
      memory: {
        lines: key => this.memory.lines(key),
        remember: (key, line) => this.memory.remember(key, line),
        forget: (key, substring) => this.memory.forget(key, substring),
      },
      ackText: DEFAULT_ACK_TEXT,
      denyText: DEFAULT_DENY_TEXT,
      logger: { warn: message => this.ctx.logger.warn(message) },
    })
    const status: SocketStatus = { connected: false, attempts: 0, lastError: null, lastFrameAt: 0 }
    const socket = new RobotSocket({
      url: deriveWebSocketUrl(robotConfig.sendMsgUrl),
      onMessage: message => {
        void router.handle(message)
      },
      onStatus: updated => {
        Object.assign(status, updated)
      },
    })
    return { config: robotConfig, sender, router, socket, status }
  }

  /** Stop every channel (idempotent). Disposes router-owned agents. */
  stop(): void {
    for (const channel of this.channels) {
      channel.socket.stop()
      void channel.router.dispose()
    }
    this.channels.length = 0
    this.confirm.dispose()
    void this.overrides.close()
    void this.memory.close()
  }

  /** Firehose slice for robot sessions (plugin entry). */
  noteSessionEvent(sessionId: string, event: PushSessionEvent): void {
    this.hub.noteEvent(sessionId, event)
  }

  /** Agent-idle slice for robot sessions (plugin entry): flush the answer. */
  noteAgentIdle(sessionId: string): void {
    this.hub.noteIdle(sessionId)
  }

  /** Agent-error slice for robot sessions (plugin entry). */
  noteAgentError(sessionId: string, error: unknown): void {
    this.hub.noteError(sessionId, error)
  }

  /** Open the override store once the storage hub has the domain form. */
  private async ensureOverrides(): Promise<void> {
    const facility = this.ctx.get('storageDomain')
    if (facility === undefined) return
    try {
      await this.overrides.open(facility as never)
      await this.memory.open(facility as never)
    } catch (error) {
      this.ctx.logger.warn(`robot: override store failed to open: ${String(error)}`)
    }
  }

  /** Public wrapper for the plugin entry's inject callback. */
  async openOverridesNow(): Promise<void> {
    await this.ensureOverrides()
  }

  /** Feed one ask broadcast into the confirmation broker (plugin entry). */
  noteAsk(pending: ConfirmAskPending): void {
    this.confirm.noteAsk(pending)
  }

  /** The approval waterfall slice for robot sessions (plugin entry). */
  handleApproval(
    req: ConfirmApprovalRequest & { toolName: string },
    next: () => Promise<'allowed-once' | 'rejected' | 'cancelled' | 'unavailable'>,
  ): Promise<'allowed-once' | 'rejected' | 'cancelled' | 'unavailable'> {
    return this.confirm.handleApproval(req, next)
  }

  /** allowFrom policy: explicit config list, else the CLI login user once. */
  private async resolveAllowFrom(robotConfig: RobotChannelConfig): Promise<readonly string[]> {
    const configured = robotConfig.allowFrom ?? []
    if (configured.length > 0) return configured
    const bridge = this.ctx.get('yzjBridge')
    if (bridge === undefined) {
      this.ctx.logger.warn('robot: yzjBridge unavailable; allowFrom stays empty')
      return []
    }
    try {
      const result = await bridge.run(['contact', 'user', 'get'], { timeoutMs: 15_000 })
      const users = Array.isArray(result.json) ? result.json : []
      const first = users[0] as { openId?: string } | undefined
      const openId = typeof first?.openId === 'string' ? first.openId : ''
      return openId === '' ? [] : [openId]
    } catch (error) {
      this.ctx.logger.warn(`robot: whoami failed: ${String(error)}`)
      return []
    }
  }
}

/** Plugin entry: expose the service and own every channel's lifecycle. */
export function apply(ctx: Context, config: Config): void {
  const robot = new YzjRobot(ctx, config)
  // The override store opens as soon as the storage hub mounts the domain
  // form (web profile: json backend under the harness home). Routers read it
  // lazily per agent creation, so late opening is fine.
  ctx.inject(['storageDomain'], () => {
    void robot.openOverridesNow()
  })
  // Gated writes fired inside robot sessions surface as numbered suggestion
  // cards in the conversation (确认 N / 取消 N); tool-yzj's ask broadcast
  // feeds the digest. Declared structurally (same shape as write-gate.ts).
  ctx.on('yzj/ask-pending', (pending: ConfirmAskPending) => {
    robot.noteAsk(pending)
  })
  ctx.on('approval/request', (req, next) => {
    return robot.handleApproval(req, next)
  })
  // Event-driven push: robot-session output (any turn source — interactive,
  // scheduled, watcher) reaches its conversation through the shared hub.
  ctx.on('session/event', (session, event) => {
    const id = String(session.id)
    if (!id.startsWith('yzj-robot-')) return
    robot.noteSessionEvent(id, event as PushSessionEvent)
  })
  ctx.on('agent/status', payload => {
    if (payload.status !== 'idle') return
    const id = String(payload.agent.id)
    if (!id.startsWith('yzj-robot-')) return
    robot.noteAgentIdle(id)
  })
  ctx.on('agent/error', payload => {
    const id = String(payload.agent.id)
    if (!id.startsWith('yzj-robot-')) return
    robot.noteAgentError(id, payload.error)
  })
  ctx.effect(() => {
    return () => robot.stop()
  }, 'robot-yzj: channel lifecycle')
}
