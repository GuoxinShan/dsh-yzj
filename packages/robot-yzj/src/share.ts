/**
 * Group shared-workspace tools (design §8.4): `robot_share_write` and
 * `robot_share_list` are the ONLY write channel into a group's shared
 * directory (`<cwd>/groups/<groupId>/shared/`). Harness file tools stay
 * sandboxed inside each session's private workspace, so the plugin's host
 * process writes the shared area directly — the permission boundary IS the
 * channel boundary and robot sessions never need elevated sandbox rights.
 * Unlike the operator-only `robot_*` control tools, these are callable from
 * every session: robot sessions place deliverables here, operator sessions
 * place shared materials. Write conflicts resolve by automatic unique naming
 * (report.md → report-2.md) unless `overwrite: true` is explicit.
 * @module @dsh-yzj/robot-yzj/share
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { controlOutput } from './control.ts'
import type { YzjRobot } from './index.ts'

/**
 * Register the group shared-workspace tools on one context. The write tool is
 * gated by the approval guard (WRITE_SPECS, standard level) — GUI sessions
 * answer via the GUI confirmation card, robot sessions via the in-group
 * suggestion card.
 * @param ctx - Cordis context carrying the tools registry.
 * @param robot - the live robot-channel service.
 */
export function applyRobotShareTools(ctx: Context, robot: YzjRobot): void {
  ctx.tools.register(defineTool({
    name: 'robot_share_write',
    description: 'Write a text file into a group\'s shared workspace — the explicit cross-thread collaboration area for robot group conversations (design §8.4), located at <cwd>/groups/<groupId>/shared/. Existing same-named files get an automatic unique suffix (report.md → report-2.md, the original stays untouched) unless overwrite:true. This is the ONLY way to write the shared area: harness write tools are sandboxed inside the session\'s private workspace and would be denied on this path. Callable from any session — robot sessions place deliverables here, operator sessions place shared materials.',
    parameters: {
      groupId: { type: 'string', description: 'Target group surface (robot_status lists them); default = the channel\'s most recent surface.' },
      filename: { type: 'string', required: true, description: 'File name; path separators, Windows-reserved characters, and empty names are rejected.' },
      content: { type: 'string', required: true, description: 'UTF-8 text content to write.' },
      overwrite: { type: 'boolean', description: 'Replace an existing same-named file; default false (unique suffix instead).' },
      robotIndex: { type: 'number', description: 'Channel index (robot_status lists them); default 0.' },
    },
    output: controlOutput,
    timeoutMs: 15_000,
    // Unique-name resolution must not race with a concurrent write.
    isConcurrencySafe: () => false,
    async execute(args, _exec) {
      const result = await robot.shareWrite(
        args.robotIndex ?? 0,
        args.groupId,
        args.filename,
        args.content,
        args.overwrite === true,
      )
      if (!result.ok) {
        throw new Error(`robot_share_write 失败：${result.error ?? 'unknown'}`)
      }
      return {
        content: `已写入群共享工作区：${result.path}${result.existed === true ? `（目标原本存在，已自动唯一化为 ${result.name}，原文件未动）` : ''}`,
        truncated: false,
        data: {
          ok: true,
          path: result.path ?? null,
          name: result.name ?? null,
          existed: result.existed ?? false,
        },
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'robot_share_list',
    description: 'List the files of a group\'s shared workspace (name / size / mtime, most recently modified first). Use this BEFORE robot_share_write to see what other topics have placed there and pick a non-colliding name.',
    parameters: {
      groupId: { type: 'string', description: 'Target group surface (robot_status lists them); default = the channel\'s most recent surface.' },
      robotIndex: { type: 'number', description: 'Channel index (robot_status lists them); default 0.' },
    },
    output: controlOutput,
    timeoutMs: 10_000,
    isConcurrencySafe: () => true,
    async execute(args, _exec) {
      const result = robot.shareList(args.robotIndex ?? 0, args.groupId)
      if (!result.ok) {
        throw new Error(`robot_share_list 失败：${result.error ?? 'unknown'}`)
      }
      const files = result.files ?? []
      const content = files.length === 0
        ? `群共享工作区（${result.dir}）暂无文件。`
        : `群共享工作区（${result.dir}）共 ${files.length} 个文件：\n${files
            .map(entry => `· ${entry.name}（${entry.size} B，${new Date(entry.mtime).toISOString()}）`)
            .join('\n')}`
      return {
        content,
        truncated: false,
        data: { ok: true, dir: result.dir ?? null, files: files as never },
      }
    },
  }))
}
