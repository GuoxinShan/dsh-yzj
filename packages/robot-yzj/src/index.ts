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

/** Plugin name used by loader diagnostics. */
export const name = 'robot-yzj'
/** Required services: the CLI bridge (allowFrom resolution) and the agent registry (robot sessions). */
export const inject = ['yzjBridge', 'agents']

declare module '@deepseek-ai/cordis' {
  interface Context {
    yzjRobot: YzjRobot
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
  /** Provider route for this robot's agent sessions; empty = the harness default. */
  provider?: string
  /** Model id for this robot's agent sessions; empty = the harness default. */
  model?: string
}

/** Plugin configuration: a robot list plus legacy single-robot fields. */
export interface Config {
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

  constructor(ctx: Context, config: Config) {
    super(ctx, 'yzjRobot')
    const robots = config.robots !== undefined && config.robots.length > 0
      ? config.robots
      : config.sendMsgUrl === undefined || config.sendMsgUrl === ''
        ? []
        : [{
            sendMsgUrl: config.sendMsgUrl,
            enabled: config.enabled ?? true,
            allowFrom: config.allowFrom ?? [],
            provider: config.provider ?? '',
            model: config.model ?? '',
          }]
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
  ctx.effect(() => {
    return () => robot.stop()
  }, 'robot-yzj: channel lifecycle')
}
