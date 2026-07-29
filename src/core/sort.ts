import type { ImportGroupId, NamedSpecifier, ParsedImport, ResolvedOptions } from '../types'
import { packageName, priorityRank } from './classify'

/** Every slash counts. Correct for paths, where each slash is a real level. */
function segmentDepth(source: string): number {
  return source.split('/').length
}

/**
 * Depth measured from the package name, so a scope is not mistaken for a folder.
 *
 * `@mui/material` is one package with no subpath and ranks alongside `axios`,
 * while `lodash/debounce` and `@mui/material/styles` genuinely reach inside one.
 * Counting raw slashes put every scoped package on a par with deep imports and
 * scattered them through the middle of the list.
 */
function packageDepth(source: string): number {
  const name = packageName(source)
  if (source.length <= name.length) return 1
  return 1 + source.slice(name.length + 1).split('/').length
}

/** Shallow paths first, then alphabetical. */
function byDepthAsc(a: ParsedImport, b: ParsedImport): number {
  const diff = segmentDepth(a.source) - segmentDepth(b.source)
  return diff !== 0 ? diff : a.source.localeCompare(b.source)
}

/** Shallow packages first, then alphabetical. */
function byPackageDepthAsc(a: ParsedImport, b: ParsedImport): number {
  const diff = packageDepth(a.source) - packageDepth(b.source)
  return diff !== 0 ? diff : a.source.localeCompare(b.source)
}

/** Deep paths first, then alphabetical - the historical order for relatives. */
function byDepthDesc(a: ParsedImport, b: ParsedImport): number {
  const diff = segmentDepth(b.source) - segmentDepth(a.source)
  return diff !== 0 ? diff : a.source.localeCompare(b.source)
}

function byOriginalOrder(a: ParsedImport, b: ParsedImport): number {
  return a.index - b.index
}

function bySource(a: ParsedImport, b: ParsedImport): number {
  return a.source.localeCompare(b.source)
}

function sortLibraries(imports: ParsedImport[], options: ResolvedOptions): ParsedImport[] {
  return imports.slice().sort((a, b) => {
    const rankDiff =
      priorityRank(a.source, options.priorityPackages) -
      priorityRank(b.source, options.priorityPackages)
    return rankDiff !== 0 ? rankDiff : byPackageDepthAsc(a, b)
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
    case 'scoped':
      return sortLibraries(imports, options)
    // Packages, so depth is measured from the package name.
    case 'workspace':
      return imports.slice().sort(byPackageDepthAsc)
    // Paths, where every slash is a real level.
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
