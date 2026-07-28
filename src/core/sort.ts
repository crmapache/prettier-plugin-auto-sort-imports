import type { ImportGroupId, NamedSpecifier, ParsedImport, ResolvedOptions } from '../types'
import { packageName } from './classify'

function depth(source: string): number {
  return source.split('/').length
}

/** Shallow paths first, then alphabetical. */
function byDepthAsc(a: ParsedImport, b: ParsedImport): number {
  const diff = depth(a.source) - depth(b.source)
  return diff !== 0 ? diff : a.source.localeCompare(b.source)
}

/** Deep paths first, then alphabetical - the historical order for relatives. */
function byDepthDesc(a: ParsedImport, b: ParsedImport): number {
  const diff = depth(b.source) - depth(a.source)
  return diff !== 0 ? diff : a.source.localeCompare(b.source)
}

function byOriginalOrder(a: ParsedImport, b: ParsedImport): number {
  return a.index - b.index
}

function bySource(a: ParsedImport, b: ParsedImport): number {
  return a.source.localeCompare(b.source)
}

/**
 * Whole-name matching only. Substring matching used to promote `preact`,
 * `next-auth` and `@testing-library/react` alongside the real thing.
 */
function priorityRank(source: string, priorityPackages: string[]): number {
  const name = packageName(source)
  for (let i = 0; i < priorityPackages.length; i++) {
    const entry = priorityPackages[i]
    if (!entry) continue
    if (source === entry || name === entry || source.startsWith(`${entry}/`)) return i
  }
  return priorityPackages.length
}

function sortLibraries(imports: ParsedImport[], options: ResolvedOptions): ParsedImport[] {
  return imports.slice().sort((a, b) => {
    const rankDiff =
      priorityRank(a.source, options.priorityPackages) -
      priorityRank(b.source, options.priorityPackages)
    return rankDiff !== 0 ? rankDiff : byDepthAsc(a, b)
  })
}

/** Imports reaching out of the current folder come before local ones. */
function sortRelatives(imports: ParsedImport[]): ParsedImport[] {
  const outer: ParsedImport[] = []
  const current: ParsedImport[] = []
  for (const entry of imports) {
    if (entry.source.startsWith('./')) current.push(entry)
    else outer.push(entry)
  }
  return [...outer.sort(byDepthDesc), ...current.sort(byDepthDesc)]
}

export function sortGroup(
  id: ImportGroupId,
  imports: ParsedImport[],
  options: ResolvedOptions,
): ParsedImport[] {
  switch (id) {
    case 'library':
      return sortLibraries(imports, options)
    case 'workspace':
    case 'alias':
      return imports.slice().sort(byDepthAsc)
    case 'relative':
      return sortRelatives(imports)
    case 'builtin':
      return imports.slice().sort(bySource)
    // Side-effect imports run for their side effects alone, so their relative
    // order is part of the program's behaviour and is never rearranged.
    case 'polyfill':
    case 'side-effect':
      return imports.slice().sort(byOriginalOrder)
    default:
      return imports.slice()
  }
}

export function sortSpecifiers(
  specifiers: NamedSpecifier[],
  order: ResolvedOptions['specifierOrder'],
): NamedSpecifier[] {
  if (order === 'none') return specifiers

  if (order === 'alphabetical') {
    return specifiers.slice().sort((a, b) => a.name.localeCompare(b.name))
  }

  return specifiers.slice().sort((a, b) => {
    if (a.text.length === b.text.length) return a.text.localeCompare(b.text)
    return a.text.length - b.text.length
  })
}
