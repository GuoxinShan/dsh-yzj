/**
 * memory-yzj vault suite: initialization, observe semantics, projection
 * bounds, deterministic search, dream apply (all five decision types, rev
 * conflicts, malformed entries), scope validation, and human-edit
 * protection. Everything runs against temp vault roots.
 */

import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { MemoryCore, parseDecision } from '../src/service.ts'
import { parseNote, serializeNote } from '../src/frontmatter.ts'

let root: string
let core: MemoryCore

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'memory-yzj-'))
  core = new MemoryCore({
    vaultRoot: root,
    allowScopes: ['user', 'group:g1'],
    injectScopes: ['user'],
    injectCharCap: 6000,
    observationsMax: 10,
    maxSearchHits: 20,
  })
})

describe('frontmatter round-trip', () => {
  it('parses the reference dream-vault shape (quoted list values, dates)', () => {
    const raw = [
      '---',
      'name: 云之家',
      'created: "2026-08-14"',
      'tags:',
      "  - 'product'",
      '  - platform',
      'relation:',
      "  - 'integration_project: [[云之家dsh集成]]'",
      '---',
      '',
      '# 云之家',
      '',
      '金蝶旗下的企业协作平台。',
    ].join('\n')
    const note = parseNote(raw)
    expect(note.frontmatter['name']).toBe('云之家')
    expect(note.frontmatter['created']).toBe('2026-08-14')
    expect(note.frontmatter['tags']).toEqual(['product', 'platform'])
    expect(note.frontmatter['relation']).toEqual(['integration_project: [[云之家dsh集成]]'])
    expect(note.body.startsWith('# 云之家')).toBe(true)
    const serialized = serializeNote(note.frontmatter, note.body)
    expect(parseNote(serialized)).toEqual(note)
  })

  it('treats a fence-less file as pure body', () => {
    const note = parseNote('just a body line\n')
    expect(note.frontmatter).toEqual({})
    expect(note.body).toBe('just a body line')
  })
})

describe('vault initialization and observe', () => {
  it('creates the scope skeleton on first touch', () => {
    const view = core.readScope('user')
    expect(view.sections).toEqual([])
    expect(view.entities).toEqual([])
    expect(view.observations).toEqual([])
    expect(view.cap).toBe(6000)
  })

  it('records observations with id/date/source and dedupes identical content', () => {
    const first = core.observe('user', { content: '用户偏好剧情驱动的双人合作游戏', tags: ['taste'] })
    expect(first.duplicate).toBe(false)
    expect(first.id).toMatch(/^obs-\d{14}-[0-9a-f]{4}$/)
    const again = core.observe('user', { content: '用户偏好剧情驱动的双人合作游戏' })
    expect(again.duplicate).toBe(true)
    expect(again.id).toBe(first.id)
    expect(again.openCount).toBe(1)
    const view = core.readScope('user')
    const observation = view.observations.find(item => item.id === first.id)
    expect(observation?.tags).toEqual(['taste'])
    expect(observation?.source).toBe('agent')
    expect(observation?.status).toBe('open')
  })

  it('caps the open pool and tells the caller to dream first', () => {
    const tinyRoot = mkdtempSync(join(tmpdir(), 'memory-yzj-cap-'))
    const tiny = new MemoryCore({
      vaultRoot: tinyRoot,
      allowScopes: ['user'],
      injectScopes: ['user'],
      injectCharCap: 6000,
      observationsMax: 1,
      maxSearchHits: 20,
    })
    tiny.observe('user', { content: '第一条' })
    expect(() => tiny.observe('user', { content: '第二条' })).toThrow(/observation pool is full/)
  })

  it('rejects empty content and unauthorized scopes', () => {
    expect(() => core.observe('user', { content: '   ' })).toThrow(/must not be empty/)
    expect(() => core.observe('group:other', 'x')).toThrow(/allowScopes/)
    expect(() => core.observe('evil/../user', 'x')).toThrow(/allowScopes/)
  })

  it('maps group scopes to their own directory', () => {
    core.observe('group:g1', { content: '本群周报一律发表格' })
    const view = core.readScope('group:g1')
    expect(view.observations.length).toBe(1)
    // scope isolation: the user vault does not see the group observation
    expect(core.readScope('user').observations.some(item => item.content.includes('周报'))).toBe(false)
  })
})

describe('projection', () => {
  it('is empty for a scope without sections, then bounded once sections exist', () => {
    expect(core.projection('user').text).toBe('')
    // rev supplied for a missing file → that item is rejected (not-found)
    const rejected = core.dreamApply('user', [
      { type: 'update_section', section: 'personal_context', rev: 'deadbeef', content: 'x' },
    ], 'noop')
    expect(rejected.counts.rejected).toBe(1)
    const created = core.dreamApply('user', [
      { type: 'update_section', section: 'personal_context', content: '用户主要使用中文交流。' },
      { type: 'update_section', section: 'taste', content: '偏'.repeat(8000) },
    ], 'seed sections')
    expect(created.counts.sectionsWritten).toBe(2)
    const projection = core.projection('user')
    expect(projection.text.startsWith('# 记忆库 · user')).toBe(true)
    expect(projection.truncated).toBe(true)
    expect(projection.text).toContain('已达注入上限')
  })

  it('orders sections by frontmatter order and respects the per-scope cap file', () => {
    core.dreamApply('user', [
      { type: 'update_section', section: 'work_context', content: '正在做云之家集成。', order: 5 },
      { type: 'update_section', section: 'this_month', content: '推进记忆库。', order: 20 },
    ], 'ordering seed')
    const text = core.projection('user').text
    const workAt = text.indexOf('正在做云之家集成')
    const monthAt = text.indexOf('推进记忆库')
    expect(workAt).toBeGreaterThan(-1)
    expect(workAt).toBeLessThan(monthAt)
    const capPath = join(root, 'user', 'sections.yaml')
    writeFileSync(capPath, 'inject_char_cap: 20\n', 'utf8')
    const capped = core.projection('user')
    expect(capped.truncated).toBe(true)
    expect(capped.chars).toBeLessThanOrEqual(20)
    writeFileSync(capPath, 'inject_char_cap: 6000\n', 'utf8')
  })
})

describe('search', () => {
  it('ranks section body matches and reports the matching line', () => {
    const hits = core.search('user', '云之家')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0]?.kind).toBe('section')
    expect(hits[0]?.ref).toBe('work_context')
    expect(hits[0]?.line).toContain('云之家')
  })

  it('searches open observations within the right scope only', () => {
    expect(core.search('user', '周报')).toEqual([])
    const group = core.search('group:g1', '周报')
    expect(group[0]?.kind).toBe('observation')
  })

  it('returns nothing for empty queries', () => {
    expect(core.search('user', '   ')).toEqual([])
  })
})

describe('dream apply', () => {
  it('promotes a corroborated observation into a section and archives it', () => {
    const { id } = core.observe('user', { content: '用户已通关 Split Fiction 与 It Takes Two' })
    const report = core.dreamApply('user', [
      { type: 'promote_observation', observationId: id, section: 'taste', content: '已通关 Split Fiction 与 It Takes Two。' },
    ], 'promote one')
    expect(report.counts.promoted).toBe(1)
    expect(report.results.every(item => item.ok)).toBe(true)
    const view = core.readScope('user')
    expect(view.observations.some(item => item.id === id)).toBe(false)
    expect(view.archivedCount).toBeGreaterThan(0)
    const raw = readFileSync(join(root, 'user', 'sections', 'taste.md'), 'utf8')
    expect(raw).toContain('已通关 Split Fiction')
  })

  it('drops an observation and keeps it in the archived directory', () => {
    const { id } = core.observe('user', { content: '一次性琐碎信号' })
    const report = core.dreamApply('user', [{ type: 'drop_observation', observationId: id }], 'drop one')
    expect(report.counts.dropped).toBe(1)
    const archived = readFileSync(join(root, 'user', 'observations', 'archived', `${id}.md`), 'utf8')
    expect(archived).toContain('status: archived')
    expect(() => readFileSync(join(root, 'user', 'observations', `${id}.md`), 'utf8')).toThrow()
  })

  it('rejects unknown observation ids without aborting the batch', () => {
    const report = core.dreamApply('user', [
      { type: 'drop_observation', observationId: 'obs-does-not-exist' },
      { type: 'log_only', note: 'nothing to do' },
    ], 'mixed batch')
    expect(report.counts.rejected).toBe(1)
    expect(report.counts.dropped).toBe(0)
    const ok = report.results.find(item => item.decision === 'log_only')
    expect(ok?.ok).toBe(true)
  })

  it('upserts entities preserving created and updating status', () => {
    core.dreamApply('user', [
      { type: 'upsert_entity', entity: '云之家', content: '金蝶旗下的企业协作平台。', tags: ['platform'], status: 'active' },
    ], 'create entity')
    const first = core.dreamLoad('user').entities.find(item => item.name === '云之家')
    expect(first?.status).toBe('active')
    core.dreamApply('user', [
      { type: 'upsert_entity', entity: '云之家', content: '金蝶旗下的企业协作平台，集成项目进行中。', status: 'in_progress', rev: first?.rev },
    ], 'update entity')
    const second = core.dreamLoad('user').entities.find(item => item.name === '云之家')
    expect(second?.status).toBe('in_progress')
    expect(second?.created).toBe(first?.created)
  })

  it('protects human edits with the rev check and logs/indexes every run', () => {
    const state = core.dreamLoad('user')
    const taste = state.sections.find(section => section.name === 'taste')
    expect(taste).toBeDefined()
    // human edits the file after the load (the dream must not clobber it)
    const tastePath = join(root, 'user', 'sections', 'taste.md')
    writeFileSync(tastePath, '---\ntitle: taste\norder: 100\n---\n人类手工编辑的内容。\n', 'utf8')
    const stale = core.dreamApply('user', [
      { type: 'update_section', section: 'taste', content: '机器重写。', rev: taste?.rev },
    ], 'stale rev')
    expect(stale.counts.rejected).toBe(1)
    expect(stale.results[0]?.reason).toBe('rev-conflict')
    expect(readFileSync(tastePath, 'utf8')).toContain('人类手工编辑的内容')
    // no rev supplied → deliberate overwrite succeeds (fresh-read semantics)
    const fresh = core.dreamApply('user', [
      { type: 'update_section', section: 'taste', content: '机器重写（已重读）。' },
    ], 'rewrite without rev')
    expect(fresh.counts.sectionsWritten).toBe(1)
    const log = readFileSync(join(root, 'user', 'log.md'), 'utf8')
    expect(log).toContain('stale rev')
    expect(log).toContain('rewrite without rev')
    const index = readFileSync(join(root, 'user', 'index.md'), 'utf8')
    expect(index).toContain('[[sections/taste|taste]]')
    expect(index).toContain('open ')
  })

  it('rejects malformed decision entries as report items, not exceptions', () => {
    const report = core.dreamApplyRaw('user', [
      { type: 'teleport_observation', observationId: 'x' },
      'nonsense',
      { type: 'log_only', note: 'fine' },
    ], 'raw batch')
    expect(report.counts.rejected).toBe(2)
    expect(report.results.filter(item => item.ok)).toHaveLength(1)
  })

  it('validates decision payloads through parseDecision', () => {
    expect(() => parseDecision({ type: 'nope' })).toThrow(/decision\.type/)
    expect(() => parseDecision({ type: 'drop_observation', observationId: 7 })).toThrow(/observationId/)
    expect(parseDecision({ type: 'log_only', note: 'x', tags: ['a'] }).tags).toEqual(['a'])
  })
})

describe('vault durability details', () => {
  it('leaves no temp files behind', () => {
    const files = readdirSync(join(root, 'user', 'sections'))
    expect(files.every(name => !name.includes('.tmp-'))).toBe(true)
  })

  it('keeps unlisted scopes inaccessible even when their directories exist', () => {
    mkdirSync(join(root, 'group-g2'), { recursive: true })
    writeFileSync(join(root, 'group-g2', 'sections.yaml'), 'inject_char_cap: 100\n', 'utf8')
    expect(() => core.projection('group:g2')).toThrow(/allowScopes/)
  })
})
