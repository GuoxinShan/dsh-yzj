import { describe, expect, it } from 'vitest'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  attachYzjSession,
  detachYzjRoomHosts,
  ensureYzjHostWorkspace,
  isYzjRoomSessionId,
  isYzjTopicSessionId,
  yzjWorkspacePath,
} from '../src/yzj-cwd.ts'

describe('yzjWorkspacePath', () => {
  it('lives under ~/.dsh-yzj/workspace, not process.cwd()', () => {
    expect(yzjWorkspacePath()).toBe(join(homedir(), '.dsh-yzj', 'workspace'))
    expect(yzjWorkspacePath()).not.toBe(process.cwd())
  })
})

function recordingRegistry(initialMembers: readonly string[] = []) {
  const attached: string[] = []
  const detached: string[] = []
  const members = [...initialMembers]
  const workspace = {
    get sessionIds() { return [...members] },
    attachSession: async (sessionId: string) => {
      attached.push(String(sessionId))
      if (!members.includes(String(sessionId))) members.push(String(sessionId))
    },
    detachSession: async (sessionId: string) => {
      detached.push(String(sessionId))
      const at = members.indexOf(String(sessionId))
      if (at >= 0) members.splice(at, 1)
    },
  }
  return {
    attached,
    detached,
    members,
    registry: {
      create: async () => workspace,
      resolveByPath: async () => workspace,
    },
  }
}

describe('attachYzjSession', () => {
  it('attaches topic ids and skips room hosts', async () => {
    const { attached, registry } = recordingRegistry()
    const ctx = { get: (name: string) => name === 'workspaceRegistry' ? registry : undefined }
    await attachYzjSession(ctx, 'yzj-home-g-a')
    await attachYzjSession(ctx, 'yzj-topic-g-a-m1')
    await attachYzjSession(ctx, 'private-coding-session')
    expect(attached).toEqual(['yzj-topic-g-a-m1'])
  })

  it('still ensures the dedicated cwd workspace without attaching a room', async () => {
    const created: string[] = []
    const attached: string[] = []
    const workspace = {
      sessionIds: [] as string[],
      attachSession: async (sessionId: string) => { attached.push(String(sessionId)) },
      detachSession: async () => undefined,
    }
    const ctx = {
      get: (name: string) => name === 'workspaceRegistry'
        ? {
          create: async (path: string, title?: string) => {
            created.push(`${path}:${title ?? ''}`)
            return workspace
          },
          resolveByPath: async () => workspace,
        }
        : undefined,
    }
    const cwd = await ensureYzjHostWorkspace(ctx)
    expect(cwd).toBe(yzjWorkspacePath())
    expect(cwd).not.toBe(process.cwd())
    expect(created).toEqual([`${yzjWorkspacePath()}:云之家`])
    await attachYzjSession(ctx, 'yzj-home-g-a')
    expect(attached).toEqual([])
  })
})

describe('isYzjTopicSessionId / isYzjRoomSessionId', () => {
  it('splits topic agent sessions from room hosts', () => {
    expect(isYzjTopicSessionId('yzj-topic-g-a-m1')).toBe(true)
    expect(isYzjTopicSessionId('yzj-home-g-a')).toBe(false)
    expect(isYzjTopicSessionId('yzj-robot-x')).toBe(false)
    expect(isYzjRoomSessionId('yzj-home-g-a')).toBe(true)
    expect(isYzjRoomSessionId('yzj-topic-g-a-m1')).toBe(false)
  })
})

describe('detachYzjRoomHosts', () => {
  it('detaches leftover room hosts and leaves topics', async () => {
    const { detached, members, registry } = recordingRegistry([
      'yzj-home-g-a',
      'yzj-topic-g-a-m1',
      'yzj-home-BOT-x',
    ])
    const ctx = { get: (name: string) => name === 'workspaceRegistry' ? registry : undefined }
    await detachYzjRoomHosts(ctx)
    expect(detached).toEqual(['yzj-home-g-a', 'yzj-home-BOT-x'])
    expect(members).toEqual(['yzj-topic-g-a-m1'])
  })

  it('runs on ensure so a plugin start sweeps leftover rooms', async () => {
    const { detached, members, registry } = recordingRegistry(['yzj-home-old', 'yzj-topic-keep'])
    const ctx = { get: (name: string) => name === 'workspaceRegistry' ? registry : undefined }
    await ensureYzjHostWorkspace(ctx)
    expect(detached).toEqual(['yzj-home-old'])
    expect(members).toEqual(['yzj-topic-keep'])
  })
})
