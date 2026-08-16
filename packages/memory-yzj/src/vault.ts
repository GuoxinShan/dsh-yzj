/**
 * Per-scope memory vault file model: sections (curated long-term memory),
 * entities (structured pages), observations (provisional scratchpad), plus
 * the generated index and the append-only dream log. Everything is plain
 * Markdown over synchronous fs — the payloads are small and bounded by
 * design, and sync access makes every operation atomic within one process
 * (no interleaved read-modify-write windows to guard).
 * @module @dsh-yzj/memory-yzj/vault
 */

import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import {
  atomicWrite, dateStr, fmBool, fmList, fmNumber, fmString, parseNote, readText,
  revOf, safeName, serializeNote, timestampId,
} from './frontmatter.ts'

/** One curated section file. */
export interface SectionEntry {
  /** File-name segment (`sections/<name>.md`). */
  readonly name: string
  /** Display title (frontmatter `title`, defaults to the name). */
  readonly title: string
  /** Injection order (frontmatter `order`, default 100; ascending). */
  readonly order: number
  readonly tags: string[]
  /** Local date the section was created. */
  readonly created: string
  /** Local date of the last machine write. */
  readonly lastUpdated: string
  /** Body text (no frontmatter). */
  readonly content: string
  /** Revision of the full file content at read time. */
  readonly rev: string
}

/** One entity page. */
export interface EntityEntry {
  readonly name: string
  readonly title: string
  readonly tags: string[]
  /** Free-form lifecycle status (e.g. `in_progress`), empty when unset. */
  readonly status: string
  readonly created: string
  readonly lastUpdated: string
  readonly content: string
  readonly rev: string
}

/** One observation file (open or archived). */
export interface ObservationEntry {
  /** Stable id; also the file-name stem. */
  readonly id: string
  /** Local date received. */
  readonly created: string
  readonly tags: string[]
  /** Provenance label (`agent`, `routine:<id>`, …). */
  readonly source: string
  /** `open` while awaiting a dream decision; `archived` after disposal. */
  readonly status: 'open' | 'archived'
  /**
   * Agent/user intent mark: `true` = 长期候选（dream 单源也可提升）；
   * `false` = 便签（dream 默认丢弃除非被佐证）；undefined = 中性。
   */
  readonly durable?: boolean
  readonly content: string
}

/** Field set for writing a section (create or replace). */
export interface SectionWrite {
  readonly title: string
  readonly order: number
  readonly tags: string[]
  readonly content: string
}

/** Field set for writing an entity (create or replace). */
export interface EntityWrite {
  readonly title: string
  readonly tags: string[]
  readonly status: string
  readonly content: string
}

/** Default injection character cap when `sections.yaml` is absent. */
export const DEFAULT_INJECT_CHAR_CAP = 6000

/** Parse `inject_char_cap: <int>` from a scope's flat config file. */
function readCap(path: string, fallback: number): number {
  const raw = readText(path)
  if (raw === undefined) return fallback
  for (const line of raw.split('\n')) {
    const match = /^(?:#\s*)?inject_char_cap:\s*(\d+)\s*$/.exec(line)
    if (match !== null) return Number.parseInt(match[1] ?? '', 10)
  }
  return fallback
}

/** List `*.md` files of one directory sorted by name; missing dir is empty. */
function listMarkdown(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter(name => name.endsWith('.md')).sort()
}

/** One scope's vault, rooted at its own directory. */
export class MemoryVault {
  /** Section names are re-validated on every write path. */
  constructor(
    /** Absolute scope directory. */
    readonly dir: string,
    /** Open-observation capacity cap. */
    private readonly observationsMax: number,
    /** Injection cap fallback for a missing `sections.yaml`. */
    private readonly injectCharCapFallback: number = DEFAULT_INJECT_CHAR_CAP,
  ) {}

  /** Create the scope skeleton when absent; idempotent. */
  ensure(): void {
    mkdirSync(join(this.dir, 'sections'), { recursive: true })
    mkdirSync(join(this.dir, 'entities'), { recursive: true })
    mkdirSync(join(this.dir, 'observations', 'archived'), { recursive: true })
    if (readText(this.sectionsYamlPath()) === undefined) {
      atomicWrite(this.sectionsYamlPath(), `inject_char_cap: ${this.injectCharCapFallback}\n`)
    }
    if (readText(this.logPath()) === undefined) atomicWrite(this.logPath(), '# Dream Log\n')
  }

  /** `sections.yaml` path (flat per-scope config). */
  sectionsYamlPath(): string { return join(this.dir, 'sections.yaml') }
  /** Dream log path. */
  logPath(): string { return join(this.dir, 'log.md') }
  /** Generated index path. */
  indexPath(): string { return join(this.dir, 'index.md') }

  /** Injection character cap in force for this scope. */
  cap(): number { return readCap(this.sectionsYamlPath(), this.injectCharCapFallback) }

  // -- sections ------------------------------------------------------------

  private sectionPath(name: string): string { return join(this.dir, 'sections', `${name}.md`) }

  /** All sections ordered for injection (order asc, then name). */
  listSections(): SectionEntry[] {
    return listMarkdown(join(this.dir, 'sections'))
      .map(file => this.readSection(file.slice(0, -3)))
      .filter((entry): entry is SectionEntry => entry !== undefined)
      .sort((a, b) => a.order - b.order || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  }

  /** Read one section; undefined when absent or unreadable. */
  readSection(name: string): SectionEntry | undefined {
    const raw = readText(this.sectionPath(name))
    if (raw === undefined) return undefined
    const note = parseNote(raw)
    return {
      name,
      title: fmString(note.frontmatter, 'title') ?? name,
      order: fmNumber(note.frontmatter, 'order') ?? 100,
      tags: fmList(note.frontmatter, 'tags'),
      created: fmString(note.frontmatter, 'created') ?? '',
      lastUpdated: fmString(note.frontmatter, 'last_updated') ?? '',
      content: note.body,
      rev: revOf(raw),
    }
  }

  /** Create or replace one section; returns the written revision. */
  writeSection(name: string, write: SectionWrite): string {
    const safe = safeName('section', name)
    const existing = this.readSection(safe)
    const today = dateStr()
    const raw = serializeNote({
      title: write.title,
      order: String(write.order),
      ...(write.tags.length === 0 ? {} : { tags: write.tags }),
      created: existing?.created ?? today,
      last_updated: today,
    }, write.content)
    atomicWrite(this.sectionPath(safe), raw)
    return revOf(raw)
  }

  /** Append content to one section, creating it when absent. */
  appendSection(name: string, write: SectionWrite): string {
    const existing = this.readSection(name)
    if (existing === undefined) return this.writeSection(name, write)
    const merged = `${existing.content.trimEnd()}\n\n${write.content.trim()}`
    return this.writeSection(name, { ...write, content: merged })
  }

  // -- entities ------------------------------------------------------------

  private entityPath(name: string): string { return join(this.dir, 'entities', `${name}.md`) }

  /** All entities sorted by name. */
  listEntities(): EntityEntry[] {
    return listMarkdown(join(this.dir, 'entities'))
      .map(file => this.readEntity(file.slice(0, -3)))
      .filter((entry): entry is EntityEntry => entry !== undefined)
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  }

  /** Read one entity; undefined when absent. */
  readEntity(name: string): EntityEntry | undefined {
    const raw = readText(this.entityPath(name))
    if (raw === undefined) return undefined
    const note = parseNote(raw)
    return {
      name,
      title: fmString(note.frontmatter, 'title') ?? name,
      tags: fmList(note.frontmatter, 'tags'),
      status: fmString(note.frontmatter, 'status') ?? '',
      created: fmString(note.frontmatter, 'created') ?? '',
      lastUpdated: fmString(note.frontmatter, 'last_updated') ?? '',
      content: note.body,
      rev: revOf(raw),
    }
  }

  /** Create or replace one entity; returns the written revision. */
  writeEntity(name: string, write: EntityWrite): string {
    const safe = safeName('entity', name)
    const existing = this.readEntity(safe)
    const today = dateStr()
    const raw = serializeNote({
      title: write.title,
      ...(write.tags.length === 0 ? {} : { tags: write.tags }),
      ...(write.status === '' ? {} : { status: write.status }),
      created: existing?.created ?? today,
      last_updated: today,
    }, write.content)
    atomicWrite(this.entityPath(safe), raw)
    return revOf(raw)
  }

  // -- observations ----------------------------------------------------------

  private observationsDir(archived: boolean): string {
    return join(this.dir, 'observations', ...(archived ? ['archived'] : []))
  }

  private observationPath(id: string, archived: boolean): string {
    return join(this.observationsDir(archived), `${id}.md`)
  }

  /** Observations of one status, oldest first. */
  listObservations(status: 'open' | 'archived'): ObservationEntry[] {
    return listMarkdown(this.observationsDir(status === 'archived'))
      .map(file => this.readObservation(file.slice(0, -3), status === 'archived'))
      .filter((entry): entry is ObservationEntry => entry !== undefined)
      .sort((a, b) => (a.id < b.id ? -1 : 1))
  }

  /** Read one observation; undefined when absent from that status slot. */
  readObservation(id: string, archived: boolean): ObservationEntry | undefined {
    const raw = readText(this.observationPath(id, archived))
    if (raw === undefined) return undefined
    const note = parseNote(raw)
    const parsedStatus = fmString(note.frontmatter, 'status')
    const durable = fmBool(note.frontmatter, 'durable')
    return {
      id,
      created: fmString(note.frontmatter, 'created') ?? '',
      tags: fmList(note.frontmatter, 'tags'),
      source: fmString(note.frontmatter, 'source') ?? 'agent',
      status: parsedStatus === 'archived' ? 'archived' : 'open',
      ...(durable === undefined ? {} : { durable }),
      content: note.body,
    }
  }

  /**
   * Create one observation file (pure create; never read-modify-write).
   * Content is trimmed and capped; tags/source/durable are metadata only.
   * @throws when the open pool is at capacity.
   */
  createObservation(input: { content: string; tags: string[]; source: string; durable?: boolean }, now = new Date()): string {
    const content = input.content.trim().slice(0, 2000)
    const open = this.listObservations('open')
    if (open.length >= this.observationsMax) {
      throw new Error(`observation pool is full (${open.length}/${this.observationsMax}); run a dream consolidation first`)
    }
    const id = `obs-${timestampId(now)}-${Math.random().toString(16).slice(2, 6)}`
    const raw = serializeNote({
      id,
      created: dateStr(now),
      status: 'open',
      ...(input.tags.length === 0 ? {} : { tags: input.tags }),
      ...(input.source === '' ? {} : { source: input.source }),
      ...(input.durable === undefined ? {} : { durable: String(input.durable) }),
    }, content)
    atomicWrite(this.observationPath(id, false), raw)
    return id
  }

  /**
   * Archive one open observation: write the archived copy (status flipped)
   * first, then unlink the original — a crash between the two leaves the
   * original re-listable and the re-run idempotently overwrites the copy.
   * @returns true when an open observation was archived.
   */
  archiveObservation(id: string): boolean {
    const open = this.readObservation(id, false)
    if (open === undefined) return false
    const raw = serializeNote({
      id,
      created: open.created,
      status: 'archived',
      ...(open.tags.length === 0 ? {} : { tags: open.tags }),
      ...(open.source === '' ? {} : { source: open.source }),
      ...(open.durable === undefined ? {} : { durable: String(open.durable) }),
    }, open.content)
    atomicWrite(this.observationPath(id, true), raw)
    try {
      unlinkSync(this.observationPath(id, false))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    return true
  }

  // -- generated surfaces ----------------------------------------------------

  /** Append one dream log entry (header line + body), verbatim. */
  appendLog(text: string): void {
    const previous = readText(this.logPath()) ?? '# Dream Log\n'
    atomicWrite(this.logPath(), `${previous.trimEnd()}\n\n${text.trimEnd()}\n`)
  }

  /** Tail of the dream log (last `maxChars`, cut at a line boundary). */
  logTail(maxChars: number): string {
    const raw = readText(this.logPath())
    if (raw === undefined) return ''
    if (raw.length <= maxChars) return raw.trimEnd()
    const cut = raw.slice(-maxChars)
    const firstNewline = cut.indexOf('\n')
    return (firstNewline >= 0 ? cut.slice(firstNewline + 1) : cut).trimEnd()
  }

  /** Rebuild the generated index from current vault contents. */
  rebuildIndex(): void {
    const sections = this.listSections()
    const entities = this.listEntities()
    const open = this.listObservations('open').length
    const archived = this.listObservations('archived').length
    const lines: string[] = [
      '# Vault Index',
      '',
      '> Generated by dream consolidation. Relationships live in `[[wikilinks]]` inside the notes.',
      '',
      '## Sections',
      ...(sections.length === 0 ? ['- (none)'] : sections.map(s => `- [[sections/${s.name}|${s.title}]]`)),
      '',
      '## Entities',
      ...(entities.length === 0 ? ['- (none)'] : entities.map(e => `- [[entities/${e.name}|${e.title}]]`)),
      '',
      '## Observations',
      `- open ${open} · archived ${archived}`,
      '',
    ]
    atomicWrite(this.indexPath(), lines.join('\n'))
  }
}
