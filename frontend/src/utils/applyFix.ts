/**
 * applyFix — patches SKILL.md content based on a structured ApplyableFix.
 *
 * Three strategies:
 *  - frontmatter_field: adds/replaces a YAML key in the --- block
 *  - body_section:      appends a new section at the end of the body
 *  - text_replace:      finds a string and replaces it with the snippet
 */
import type { ApplyableFix } from '../types'

export function applyFix(content: string, fix: ApplyableFix): string {
  switch (fix.kind) {
    case 'frontmatter_field':
      return applyFrontmatterFix(content, fix)
    case 'body_section':
      return applyBodySection(content, fix)
    case 'text_replace':
      return applyTextReplace(content, fix)
    default:
      return content
  }
}

// ── Frontmatter field ──────────────────────────────────────────────────────

function applyFrontmatterFix(content: string, fix: ApplyableFix): string {
  const { field, snippet } = fix
  if (!field) return content

  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
  if (!fmMatch) {
    // No frontmatter — prepend a minimal one
    return `---\n${field}: ${quoteIfNeeded(snippet)}\n---\n\n${content}`
  }

  const [fullMatch, fmBody] = fmMatch
  const lines = fmBody.split('\n')
  const existingIdx = lines.findIndex(l => l.match(new RegExp(`^${escapeRegex(field)}\\s*:`)))

  let newFm: string
  if (existingIdx >= 0) {
    // Replace existing field — handle multi-line values by collapsing them
    lines[existingIdx] = `${field}: ${quoteIfNeeded(snippet)}`
    // Remove any continuation lines (indented) that follow
    let next = existingIdx + 1
    while (next < lines.length && lines[next].match(/^\s+/)) {
      lines.splice(next, 1)
    }
    newFm = lines.join('\n')
  } else {
    // Add new field
    newFm = fmBody + `\n${field}: ${quoteIfNeeded(snippet)}`
  }

  return content.replace(fullMatch, `---\n${newFm}\n---`)
}

function quoteIfNeeded(value: string): string {
  // If value contains newlines → use a block literal
  if (value.includes('\n')) {
    const indented = value.split('\n').map(l => `  ${l}`).join('\n')
    return `|\n${indented}`
  }
  // If value contains colon or special chars → quote it
  if (value.match(/[:{}[\],&*?|<>=!%@`#]/)) {
    return `"${value.replace(/"/g, '\\"')}"`
  }
  return value
}

// ── Body section ──────────────────────────────────────────────────────────

function applyBodySection(content: string, fix: ApplyableFix): string {
  const { snippet } = fix
  const trimmed = content.trimEnd()
  return `${trimmed}\n\n${snippet}\n`
}

// ── Text replace ──────────────────────────────────────────────────────────

function applyTextReplace(content: string, fix: ApplyableFix): string {
  const { replaceTarget, snippet } = fix
  if (!replaceTarget) return content
  return content.replace(replaceTarget, snippet)
}

// ── Helpers ───────────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
