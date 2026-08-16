/**
 * The Yunzhijia `ctx.chatnode` provider: the delivery contract dsh-routines
 * (and any other scheduled-agent engine) consumes to push run digests into a
 * robot conversation. `send({ text, title })` becomes a proactive robot
 * message on the configured channel (a group robot pushes to its group, a
 * personal robot to its DM) — the FIRST real implementation of the chatnode
 * contract in the DSH ecosystem (reference study:
 * docs/spec/routines-delivery.md §2). Only one chatnode provider may exist
 * per profile (Cordis same-name service collision), so a WeChat node and this
 * node cannot coexist on one profile.
 * @module @dsh-yzj/robot-yzj/chatnode
 */

import { Context, Service } from '@deepseek-ai/cordis'

/** The conversation-node delivery contract dsh-routines delivers digests to. */
export interface ChatnodeService {
  send(input: { text: string; title?: string }): Promise<void>
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Optional conversation node for chatnode delivery (one per profile). */
    chatnode?: ChatnodeService
  }
}

/** The minimal robot service face (YzjRobot satisfies it). */
export interface ChatnodeRobotFace {
  notify(text: string, robotIndex?: number): Promise<{ ok: boolean; msgId?: string; error?: string }>
}

/**
 * The chatnode service: `send` prefixes the title, then pushes through the
 * robot channel's outbound. Delivery failures are contained — the scheduler
 * records them in its `deliveries` array and never crashes.
 */
export class YzjChatnode extends Service implements ChatnodeService {
  static inject = ['yzjRobot']

  private readonly robot: ChatnodeRobotFace
  private readonly robotIndex: number

  /**
   * @param ctx - plugin context (provides the service as `ctx.chatnode`).
   * @param robot - the robot-channel service the send delegates to.
   * @param robotIndex - which channel to push to (notify semantics).
   */
  constructor(ctx: Context, robot: ChatnodeRobotFace, robotIndex: number) {
    super(ctx, 'chatnode')
    this.robot = robot
    this.robotIndex = robotIndex
  }

  /** Push one digest into the robot conversation. */
  async send(input: { text: string; title?: string }): Promise<void> {
    const body = input.title === undefined || input.title === ''
      ? input.text
      : `${input.title}\n\n${input.text}`
    const result = await this.robot.notify(body, this.robotIndex)
    if (!result.ok) {
      throw new Error(`yzj chatnode send failed: ${result.error ?? 'unknown'}`)
    }
  }
}
