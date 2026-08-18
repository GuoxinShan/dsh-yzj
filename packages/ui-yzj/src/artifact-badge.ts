/**
 * File-type badge for IM / topic-lens artifact cards. Pure — host and
 * browser halves share it (no node, no React).
 * @module @dsh-yzj/ui-yzj/artifact-badge
 */

const WRITE_TOOLS = new Set(['write', 'edit'])

/** Typed badge shown on a product card. */
export interface ArtifactBadge {
  readonly type: string
  readonly name: string
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function parseToolArgs(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw)
      return asRecord(parsed)
    } catch {
      return {}
    }
  }
  return asRecord(raw)
}

/** Basename of a workspace path (`a/b.md` → `b.md`). */
export function fileBaseName(filePath: string): string {
  const trimmed = filePath.trim().replace(/\\/g, '/')
  if (trimmed === '') return ''
  const parts = trimmed.split('/')
  return parts[parts.length - 1] ?? ''
}

/** `write` / `edit` `file_path` basename from one `tool/call` data blob. */
export function writeFileNameOf(data: unknown): string | undefined {
  const rec = asRecord(data)
  const name = asString(rec.name)
  if (!WRITE_TOOLS.has(name)) return undefined
  const path = asString(parseToolArgs(rec.arguments).file_path)
  const base = fileBaseName(path)
  return base === '' ? undefined : base
}

/** Type chip + display name for a file (MD → DOC, png → IMG, …). */
export function artifactBadgeOf(fileName: string): ArtifactBadge {
  const name = fileName.trim()
  const ext = (name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : '').toUpperCase()
  const type = /^(MD|TXT|DOC|DOCX)$/.test(ext) ? 'DOC'
    : /^(XLS|XLSX|CSV)$/.test(ext) ? 'XLS'
      : ext === 'PDF' ? 'PDF'
        : /^(PNG|JPG|JPEG|GIF|WEBP|BMP|SVG)$/.test(ext) ? 'IMG'
          : ext === '' ? 'FILE'
            : ext
  return { type, name: name === '' ? '文件' : name }
}
