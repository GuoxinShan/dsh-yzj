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
import { SessionId } from '@deepseek-ai/dsh-session'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { AgentHandle } from '@deepseek-ai/dsh-agent'
import type { SocketStatus } from './socket.ts'
import { RobotSocket } from './socket.ts'
import { deriveWebSocketUrl } from './protocol.ts'
import { RobotSender, type RobotCardOptions, type RobotSendResult } from './outbound.ts'
import { RobotRouter, completedTurnPrefix, dmSessionId, slugId } from './router.ts'
import { OverrideStore } from './overrides.ts'
import { SurfaceStore } from './surface.ts'
import { ConfirmBroker, type ConfirmApprovalRequest, type ConfirmAskPending } from './confirm.ts'
import { PushHub, type PushSessionEvent } from './push.ts'
import { MemoryStore } from './memory.ts'
import { YzjChatnode } from './chatnode.ts'
import { ChatnodeBridge, ChatnodeBridgeClient, type WebServerFace } from './bridge.ts'
import { applyRobotControlTools } from './control.ts'
import { applyRobotShareTools } from './share.ts'

/** Plugin name used by loader diagnostics. */
export const name = 'robot-yzj'
/** Required services: the agent registry (robot sessions) and the tools registry (robot_* controls). The CLI bridge is optional (allowFrom resolution only). */
export const inject = ['agents', 'tools']

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
  /** Working directory for this robot's sessions; empty = the host process cwd. */
  cwd?: string
}

/** Plugin configuration: a robot list plus legacy single-robot fields. */
export interface Config {
  /** Default provider for every robot without its own; empty = harness default. */
  defaultProvider?: string
  /** Default model for every robot without its own; empty = harness default. */
  defaultModel?: string
  /** Default working directory for every robot without its own; empty = host process cwd. */
  defaultCwd?: string
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
  /** Legacy single-robot cwd (applies to the synthesized robot #0). */
  cwd?: string
  /** Which channel `ctx.chatnode.send` pushes to (dsh-routines digests); default 0. */
  chatnodeRobotIndex?: number
  /**
   * Shared bearer token enabling the chatnode bridge listener: an exact
   * `POST /yzj/chatnode` route on the profile's `webServer` (when present)
   * that pushes bridge calls through this plugin's own robot channel. The
   * ops scheduler daemon delivers digests through this route instead of
   * holding its own robot connection.
   */
  bridgeToken?: string
  /**
   * Bridge client target URL (`http://127.0.0.1:<port>/yzj/chatnode`). When
   * set, the plugin runs in bridge-client mode: no robot channels, no
   * WebSocket, no sessions — it only provides `ctx.chatnode` as an HTTP
   * client to the listener. Requires `bridgeToken`.
   */
  bridgeTarget?: string
  /** DSH GUI base URL; `!configure` and final-answer session records use it. */
  guiUrl?: string
  /**
   * Optional JSON file holding the FULL channel configuration
   * (`{defaultProvider?, defaultModel?, robots: [...]}`). When the file
   * exists and is readable it is the sole source of truth — `config.robots`
   * and `config.default*` are ignored (design §8.5). The settings card
   * writes here; changes take effect after a GUI restart (channels are built
   * at startup).
   */
  channelsFile?: string
}

const RobotChannelSchema: z<RobotChannelConfig> = z.object({
  sendMsgUrl: z.string(),
  enabled: z.boolean().default(true),
  allowFrom: z.array(z.string()).default([]),
  provider: z.string().default(''),
  model: z.string().default(''),
  cwd: z.string().default(''),
})

const ConfigSchema: z<Config> = z.object({
  defaultProvider: z.string().default(''),
  defaultModel: z.string().default(''),
  defaultCwd: z.string().default(''),
  robots: z.array(RobotChannelSchema).default([]),
  sendMsgUrl: z.string().default(''),
  enabled: z.boolean().default(true),
  allowFrom: z.array(z.string()).default([]),
  provider: z.string().default(''),
  model: z.string().default(''),
  cwd: z.string().default(''),
  chatnodeRobotIndex: z.number().default(0),
  bridgeToken: z.string().default(''),
  bridgeTarget: z.string().default(''),
  guiUrl: z.string().default(''),
  channelsFile: z.string().default(''),
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
  /** Resolved working directory for this channel's sessions. */
  cwd: string
  /** Every conversation surface this channel has seen, most recent first. */
  surface: { groupId: string; robotId: string; robotName: string; groupType: number; time: number; lastSessionId?: string }[]
  /** Live sessions this channel's router created. */
  sessions: string[]
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
  static inject = ['agents', 'tools']

  private readonly channels: RunningChannel[] = []
  private readonly overrides = new OverrideStore()
  private readonly surfaces = new SurfaceStore()
  private readonly confirm = new ConfirmBroker()
  private readonly hub: PushHub
  private readonly memory = new MemoryStore()
  private readonly guiUrl: string
  /** The settings card's channel file (design §8.5); undefined = file not configured. */
  private readonly channelsFile: string | undefined
  /** Operator-side fork sessions created from robot conversations (owned here). */
  private readonly forked = new Map<string, AgentHandle>()

  constructor(ctx: Context, config: Config) {
    super(ctx, 'yzjRobot')
    this.guiUrl = config.guiUrl ?? ''
    this.hub = new PushHub(this.guiUrl === '' ? undefined : this.guiUrl)
    this.channelsFile = config.channelsFile === undefined || config.channelsFile === '' ? undefined : config.channelsFile
    // When the channels file exists it is the sole source of truth
    // (§8.5); otherwise the patch-level config applies (legacy behavior).
    const source = this.channelsFile === undefined ? undefined : loadChannelsFile(this.channelsFile)
    const defaults = source ?? {
      defaultProvider: config.defaultProvider,
      defaultModel: config.defaultModel,
      defaultCwd: config.defaultCwd,
    }
    const fillDefaults = (robot: RobotChannelConfig): RobotChannelConfig => ({
      ...robot,
      ...(robot.provider === undefined || robot.provider === '' ? (defaults.defaultProvider === undefined || defaults.defaultProvider === '' ? {} : { provider: defaults.defaultProvider }) : {}),
      ...(robot.model === undefined || robot.model === '' ? (defaults.defaultModel === undefined || defaults.defaultModel === '' ? {} : { model: defaults.defaultModel }) : {}),
      ...(robot.cwd === undefined || robot.cwd === '' ? (defaults.defaultCwd === undefined || defaults.defaultCwd === '' ? {} : { cwd: defaults.defaultCwd }) : {}),
    })
    const configured = source !== undefined
      ? source.robots
      : config.robots !== undefined && config.robots.length > 0
        ? config.robots
        : config.sendMsgUrl === undefined || config.sendMsgUrl === ''
          ? []
          : [{
              sendMsgUrl: config.sendMsgUrl,
              enabled: config.enabled ?? true,
              allowFrom: config.allowFrom ?? [],
              provider: config.provider ?? '',
              model: config.model ?? '',
              cwd: config.cwd ?? '',
            }]
    this.startAll(configured.map(fillDefaults))
  }

  /**
   * Persist the FULL channel configuration to the channels file (§8.5):
   * seeds the file from the current config when it does not exist yet
   * (existing channels migrate transparently), then writes the payload.
   * Changes apply after a GUI restart — live channels are not touched.
   */
  async saveChannels(input: { defaultProvider?: string; defaultModel?: string; robots: RobotChannelConfig[] }): Promise<{ ok: boolean; path?: string; count?: number; error?: string }> {
    if (this.channelsFile === undefined) {
      return { ok: false, error: 'channelsFile 未配置：robot-yzj config 加 channelsFile 指向 JSON 文件后才可保存通道' }
    }
    for (const robot of input.robots) {
      if (robot.sendMsgUrl === undefined || robot.sendMsgUrl === '') {
        return { ok: false, error: '每个通道必须有 sendMsgUrl' }
      }
    }
    const existing = loadChannelsFile(this.channelsFile)
    const previous = existing ?? {
      defaultProvider: this.config.defaultProvider,
      defaultModel: this.config.defaultModel,
    }
    const doc = {
      ...(firstNonEmpty(input.defaultProvider, previous?.defaultProvider, this.config.defaultProvider) === undefined ? {} : { defaultProvider: firstNonEmpty(input.defaultProvider, previous?.defaultProvider, this.config.defaultProvider) }),
      ...(firstNonEmpty(input.defaultModel, previous?.defaultModel, this.config.defaultModel) === undefined ? {} : { defaultModel: firstNonEmpty(input.defaultModel, previous?.defaultModel, this.config.defaultModel) }),
      robots: input.robots.map(robot => ({
        sendMsgUrl: robot.sendMsgUrl,
        ...(robot.enabled === undefined ? {} : { enabled: robot.enabled }),
        ...(robot.allowFrom === undefined || robot.allowFrom.length === 0 ? {} : { allowFrom: robot.allowFrom }),
        ...(robot.provider === undefined || robot.provider === '' ? {} : { provider: robot.provider }),
        ...(robot.model === undefined || robot.model === '' ? {} : { model: robot.model }),
        ...(robot.cwd === undefined || robot.cwd === '' ? {} : { cwd: robot.cwd }),
      })),
    }
    try {
      mkdirSync(dirname(this.channelsFile), { recursive: true })
      const tmp = join(dirname(this.channelsFile), `.robot-channels-${Date.now().toString(36)}.tmp`)
      writeFileSync(tmp, JSON.stringify(doc, null, 2), 'utf8')
      renameSync(tmp, this.channelsFile)
    } catch (error) {
      return { ok: false, error: `写入通道配置失败：${String(error)}` }
    }
    return { ok: true, path: this.channelsFile, count: input.robots.length }
  }

  /** The configured channels file path, when present (settings-card hint). */
  channelsFilePath(): string | undefined {
    return this.channelsFile
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
      cwd: channel.router.workdir(),
      connected: channel.status.connected,
      lastError: channel.status.lastError,
      lastFrameAt: channel.status.lastFrameAt,
      surface: channel.router.surfaceSummary(),
      sessions: channel.router.liveSessionIds(),
    }))
  }

  /** Proactive outbound push on the first enabled channel (routines, digests). */
  async send(text: string): Promise<{ ok: boolean; msgId?: string; error?: string }> {
    const channel = this.channels.find(item => (item.config.enabled ?? true) && item.status.connected)
    if (channel === undefined) return { ok: false, error: 'no connected robot channel' }
    return channel.sender.send(text)
  }

  /**
   * DSH-side proactive notification: push text to one robot channel's
   * conversation (the channel's own surface — the group for a group robot,
   * the DM for a personal robot).
   * @param text - message body.
   * @param robotIndex - channel index; defaults to 0.
   */
  async notify(text: string, robotIndex = 0): Promise<{ ok: boolean; msgId?: string; error?: string }> {
    const channel = this.channels[robotIndex]
    if (channel === undefined) return { ok: false, error: `no robot channel at index ${robotIndex}` }
    if (!(channel.config.enabled ?? true)) return { ok: false, error: `robot channel ${robotIndex} is disabled` }
    return channel.sender.send(text)
  }

  /** DSH-side proactive card notification (application-style card). */
  async notifyCard(card: RobotCardOptions, robotIndex = 0): Promise<RobotSendResult> {
    const channel = this.channels[robotIndex]
    if (channel === undefined) return { ok: false, error: `no robot channel at index ${robotIndex}` }
    if (!(channel.config.enabled ?? true)) return { ok: false, error: `robot channel ${robotIndex} is disabled` }
    return channel.sender.sendCard(card)
  }

  /**
   * Resolve one channel's shared dir and target group (design §8.4); an
   * omitted groupId defaults to the channel's most recent surface. The dir is
   * created on demand.
   */
  private shareTarget(robotIndex: number, groupId: string | undefined): { dir: string; groupId: string } | { error: string } {
    const channel = this.channels[robotIndex]
    if (channel === undefined) return { error: `no robot channel at index ${robotIndex}` }
    if (!(channel.config.enabled ?? true)) return { error: `robot channel ${robotIndex} is disabled` }
    const target = groupId ?? channel.router.surfaceSummary()[0]?.groupId
    if (target === undefined || target === '') {
      return { error: groupId === undefined
        ? '该机器人尚未收到任何入站消息，没有可用的群表面'
        : `机器人没有见过群 ${groupId} 的消息` }
    }
    return { dir: channel.router.shareDir(target), groupId: target }
  }

  /**
   * Write one UTF-8 text file into a group's shared workspace — the ONLY
   * write channel outside session sandboxes (design §8.4). Existing
   * same-named files get an automatic unique suffix unless `overwrite` is
   * explicit; writes are atomic (tmp file + rename).
   */
  async shareWrite(
    robotIndex: number,
    groupId: string | undefined,
    filename: string,
    content: string,
    overwrite: boolean,
  ): Promise<{ ok: boolean; path?: string; name?: string; existed?: boolean; error?: string }> {
    const target = this.shareTarget(robotIndex, groupId)
    if ('error' in target) return { ok: false, error: target.error }
    return writeShareFile(target.dir, filename, content, overwrite)
  }

  /** List one group's shared workspace files (name/size/mtime, newest first). */
  shareList(robotIndex: number, groupId: string | undefined): { ok: boolean; dir?: string; files?: { name: string; size: number; mtime: number }[]; error?: string } {
    const target = this.shareTarget(robotIndex, groupId)
    if ('error' in target) return { ok: false, error: target.error }
    return listShareFiles(target.dir)
  }

  /**
   * DSH-side conversation continuation: fabricate an operator turn on one
   * channel and run it through the full inbound pipeline (ack + agent turn +
   * push to the conversation).
   * @param text - the operator's message text.
   * @param options - channel index (default 0) and optional explicit groupId.
   */
  async continueConversation(text: string, options: { robotIndex?: number; groupId?: string } = {}): Promise<{ ok: boolean; sessionId?: string; error?: string }> {
    const channel = this.channels[options.robotIndex ?? 0]
    if (channel === undefined) return { ok: false, error: `no robot channel at index ${options.robotIndex ?? 0}` }
    return channel.router.continueFromDsh(text, options.groupId === undefined ? {} : { groupId: options.groupId })
  }

  /**
   * Fork one live session (typically a robot conversation) into a new
   * operator-side root session seeded with its completed-turn history. The
   * fork appears in the DSH web session list and continues with the full
   * harness toolset; its log keeps `parentSession` pointing at the source.
   * @param sourceSessionId - any live session id (robot conversations included).
   * @returns the new fork session id.
   */
  async forkSession(sourceSessionId: string): Promise<{ ok: boolean; sessionId?: string; error?: string }> {
    const source = this.ctx.agents.get(sourceSessionId as never)
    if (source === undefined) return { ok: false, error: `no live agent for session ${sourceSessionId}` }
    const seed = completedTurnPrefix(source.session.events)
    if (seed.length === 0) return { ok: false, error: '源会话还没有任何完成的回合，无法 fork' }
    const forkId = SessionId(`fork-${slugId(sourceSessionId)}-${Date.now().toString(36)}`)
    try {
      const handle = await this.ctx.agents.create({
        sessionId: forkId,
        seed,
        meta: {
          ...(source.session.header.cwd === undefined ? {} : { cwd: source.session.header.cwd }),
          parentSession: source.session.header.id,
          seedLength: seed.length,
        },
      })
      this.forked.set(String(forkId), handle)
      return { ok: true, sessionId: String(forkId) }
    } catch (error) {
      return { ok: false, error: `fork failed: ${String(error)}` }
    }
  }

  /** Fork sessions this service owns (diagnostics). */
  forkedSessions(): string[] {
    return [...this.forked.keys()]
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
    let index = 0
    for (const robotConfig of robots) {
      if (!(robotConfig.enabled ?? true)) { index += 1; continue }
      if (robotConfig.sendMsgUrl === '') { index += 1; continue }
      const channel = this.makeChannel(robotConfig, index)
      this.channels.push(channel)
      channel.socket.start()
      index += 1
    }
  }

  /** Assemble one channel's runtime pieces. */
  private makeChannel(robotConfig: RobotChannelConfig, channelIndex: number): RunningChannel {
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
      channelIndex,
      cwd: robotConfig.cwd ?? process.cwd(),
      surface: this.surfaces,
      memory: {
        lines: key => this.memory.lines(key),
        remember: (key, line) => this.memory.remember(key, line),
        forget: (key, substring) => this.memory.forget(key, substring),
      },
      ackText: DEFAULT_ACK_TEXT,
      denyText: DEFAULT_DENY_TEXT,
      logger: { warn: message => this.ctx.logger.warn(message) },
      ...(this.guiUrl === '' ? {} : { guiUrl: this.guiUrl }),
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

  /** Stop every channel (idempotent). Disposes router-owned and fork agents. */
  stop(): void {
    for (const channel of this.channels) {
      channel.socket.stop()
      void channel.router.dispose()
    }
    this.channels.length = 0
    for (const handle of this.forked.values()) {
      void handle.dispose()
    }
    this.forked.clear()
    this.confirm.dispose()
    void this.overrides.close()
    void this.surfaces.close()
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

  /** Push-hub diagnostic snapshot (statuses()-adjacent debugging face). */
  pushDiagnostics(): { conversations: number; activeTurns: { sessionId: string; parts: number; toolCalls: number }[]; watermarks: number } {
    return this.hub.diagnostics()
  }

  /** Confirm-broker diagnostic snapshot. */
  confirmDiagnostics(): { openCards: number } {
    return { openCards: this.confirm.openCards }
  }

  /** Open the override + surface stores once the storage hub has the domain form. */
  private async ensureOverrides(): Promise<void> {
    const facility = this.ctx.get('storageDomain')
    if (facility === undefined) return
    try {
      await this.overrides.open(facility as never)
      await this.memory.open(facility as never)
      await this.surfaces.open(facility as never)
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

/** File names allowed in the shared workspace: no path separators or Windows-reserved characters. */
const SHARE_NAME = /^[^\\/:*?"<>|\u0000-\u001f]+$/

/** First non-colliding `base-N.ext` for an existing shared file name. */
function uniqueShareName(dir: string, filename: string): string {
  const dot = filename.lastIndexOf('.')
  const base = dot > 0 ? filename.slice(0, dot) : filename
  const ext = dot > 0 ? filename.slice(dot) : ''
  let n = 2
  while (existsSync(join(dir, `${base}-${n}${ext}`))) n += 1
  return `${base}-${n}${ext}`
}

/**
 * Write one UTF-8 text file into a shared dir (design §8.4). Rejects unsafe
 * names, resolves conflicts with an automatic unique suffix unless
 * `overwrite` is explicit, and writes atomically (tmp file + rename). Pure
 * host-side helper so the collision/validation rules are unit-testable.
 */
export function writeShareFile(
  dir: string,
  filename: string,
  content: string,
  overwrite: boolean,
): { ok: boolean; path?: string; name?: string; existed?: boolean; error?: string } {
  if (filename === '.' || filename === '..' || !SHARE_NAME.test(filename)) {
    return { ok: false, error: '文件名不合法：禁止路径分隔符、Windows 保留字符与空名' }
  }
  let name = filename
  let existed = existsSync(join(dir, filename))
  if (existed && !overwrite) name = uniqueShareName(dir, filename)
  const full = join(dir, name)
  const tmp = join(dir, `.robot-share-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.tmp`)
  try {
    mkdirSync(dir, { recursive: true })
    writeFileSync(tmp, content, 'utf8')
    renameSync(tmp, full)
  } catch (error) {
    try { rmSync(tmp, { force: true }) } catch { /* best-effort cleanup */ }
    return { ok: false, error: `写入共享区失败：${String(error)}` }
  }
  return { ok: true, path: full, name, existed }
}

/** List one shared dir's files (name/size/mtime, newest first). */
export function listShareFiles(
  dir: string,
): { ok: boolean; dir: string; files: { name: string; size: number; mtime: number }[]; error?: string } {
  try {
    const files = readdirSync(dir, { withFileTypes: true })
      .filter(entry => entry.isFile())
      .map(entry => {
        const stat = statSync(join(dir, entry.name))
        return { name: entry.name, size: stat.size, mtime: stat.mtimeMs }
      })
      .sort((a, b) => b.mtime - a.mtime || a.name.localeCompare(b.name))
    return { ok: true, dir, files }
  } catch (error) {
    return { ok: false, dir, files: [], error: `读取共享区失败：${String(error)}` }
  }
}

/** Plugin entry: expose the service and own every channel's lifecycle. */
export function apply(ctx: Context, config: Config): void {
  // Bridge-client mode: this profile holds no robot channels — it only
  // delivers `ctx.chatnode` calls to the web profile's bridge listener. Used
  // by the ops scheduler daemon so scheduling never opens its own robot
  // connection or touches robot credentials.
  if (config.bridgeTarget !== undefined && config.bridgeTarget !== '') {
    if (config.bridgeToken === undefined || config.bridgeToken === '') {
      throw new Error('robot-yzj: bridgeTarget requires bridgeToken (the shared listener secret)')
    }
    new ChatnodeBridgeClient(ctx, config.bridgeTarget, config.bridgeToken)
    ctx.logger.info(`robot-yzj: bridge client mode → ${config.bridgeTarget}`)
    return
  }
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
  // DSH-side bidirectional controls: proactive notify, conversation
  // continuation, and session fork, exposed as model tools on every session
  // (guarded inside so robot sessions cannot drive themselves).
  applyRobotControlTools(ctx, robot)
  // Group shared-workspace tools (robot_share_write / robot_share_list): the
  // sole write channel into a group's shared directory. Callable from every
  // session; the write tool rides the same approval guard as the yzj family
  // (GUI card for GUI sessions, in-group suggestion card for robot sessions).
  applyRobotShareTools(ctx, robot)
  // The chatnode delivery contract scheduled-agent engines (dsh-routines)
  // consume: digests land in the robot conversation via notify.
  new YzjChatnode(ctx, robot, config.chatnodeRobotIndex ?? 0)
  // The chatnode bridge listener: an exact HTTP route on the profile's
  // webServer that pushes bridge calls through this plugin's own channels —
  // the shared delivery path for the ops scheduler daemon (bridge client
  // mode above). Opt-in via bridgeToken; the route registers through
  // ctx.inject so it lands as soon as webServer activates — a bare
  // ctx.get at apply time would miss it, because the web server binds
  // asynchronously and robot-yzj does not declare it as an inject
  // dependency. Profiles without webServer simply never run the callback.
  const bridgeToken = config.bridgeToken
  if (bridgeToken !== undefined && bridgeToken !== '') {
    ctx.inject(['webServer'], () => {
      const webServer = ctx.get('webServer') as WebServerFace | undefined
      if (webServer === undefined) return
      const bridge = new ChatnodeBridge({
        robot,
        defaultRobotIndex: config.chatnodeRobotIndex ?? 0,
        token: bridgeToken,
      })
      ctx.effect(() => webServer.register({
        kind: 'exact',
        path: '/yzj/chatnode',
        handler: (req, res) => bridge.handle(req, res),
      }), 'robot-yzj: chatnode bridge route')
    })
  }
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
