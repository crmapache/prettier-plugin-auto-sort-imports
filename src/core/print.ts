import type { ImportGroupId, ParsedImport, ResolvedOptions } from '../types'
import { sortSpecifiers } from './sort'

/**
 * Renders one import, rewriting only the region between the braces.
 *
 * Everything outside that range - the `import` keyword, default and namespace
 * bindings, the source string, semicolons, import attributes and the attached
 * comments - is copied through untouched.
 */
export function printImport(entry: ParsedImport, options: ResolvedOptions): string {
  if (
    options.specifierOrder === 'none' ||
    !entry.canSortSpecifiers ||
    !entry.specifiers ||
    entry.specifiers.length < 2 ||
    !entry.namedRange
  ) {
    return entry.text
  }

  const sorted = sortSpecifiers(entry.specifiers, options.specifierOrder)
  const body = sorted.map((specifier) => specifier.text).join(', ')
  const { start, end } = entry.namedRange

  return `${entry.text.slice(0, start)}{ ${body} }${entry.text.slice(end)}`
}

export function printGroups(
  groups: Map<ImportGroupId, ParsedImport[]>,
  order: ImportGroupId[],
  options: ResolvedOptions,
): string {
  const blocks: string[] = []

  for (const id of order) {
    const entries = groups.get(id)
    if (!entries || entries.length === 0) continue
    blocks.push(entries.map((entry) => printImport(entry, options)).join('\n'))
  }

  return blocks.join(options.separator ? '\n\n' : '\n')
}

/**
 * Reassembles the file.
 *
 * The blank line between the header and the imports is reproduced from the
 * original source rather than forced, so a `'use client'` directive keeps the
 * spacing the author chose.
 */
export function assemble(header: string, imports: string, tail: string): string {
  const head = header.replace(/\s+$/, '')
  const headGap = header.slice(head.length)
  const rest = tail.replace(/^(?:[ \t]*\r?\n)+/, '')

  let out = ''
  if (head) {
    const blankLine = (headGap.match(/\n/g) ?? []).length > 1
    out += head + (blankLine ? '\n\n' : '\n')
  }
  out += imports
  out += rest ? `\n\n${rest}` : '\n'

  return out
}
