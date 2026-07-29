import { builtinModules } from 'module'

import type { ImportGroupId, ParsedImport, ResolvedOptions } from '../types'

const BUILTINS = new Set(builtinModules)

/**
 * Bare side-effect imports of these files are assets rather than polyfills, so
 * they belong at the bottom with `import './styles.css'`.
 */
const ASSET_EXTENSION =
  /\.(?:css|scss|sass|less|styl|stylus|pcss|postcss|svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|eot|graphql|gql|wasm|md)$/i

/** `@scope/pkg/deep/path` -> `@scope/pkg`, `lodash/debounce` -> `lodash`. */
export function packageName(source: string): string {
  const parts = source.split('/')
  if (source.startsWith('@')) return parts.slice(0, 2).join('/')
  return parts[0] ?? source
}

/**
 * Position in the priority list, or the list length when absent.
 *
 * Whole-name matching only. Substring matching used to promote `preact`,
 * `next-auth` and `@testing-library/react` alongside the real thing.
 */
export function priorityRank(source: string, priorityPackages: string[]): number {
  const name = packageName(source)
  for (let i = 0; i < priorityPackages.length; i++) {
    const entry = priorityPackages[i]
    if (!entry) continue
    if (source === entry || name === entry || source.startsWith(`${entry}/`)) return i
  }
  return priorityPackages.length
}

function isRelative(source: string): boolean {
  return source.startsWith('.')
}

function matchesAlias(source: string, aliases: string[]): boolean {
  return aliases.some((alias) =>
    alias.endsWith('/') ? source.startsWith(alias) : source === alias || source.startsWith(`${alias}/`),
  )
}

function isBuiltin(source: string): boolean {
  return BUILTINS.has(source) || BUILTINS.has(packageName(source))
}

/**
 * Picks the bucket for a single import.
 *
 * Aliases win over builtins because a project may legitimately alias a name that
 * collides with a node module; `node:` prefixed specifiers can never be aliases
 * and are decided first.
 */
export function classify(entry: ParsedImport, options: ResolvedOptions): ImportGroupId {
  const { source } = entry
  const alias = matchesAlias(source, options.aliases)

  if (entry.isSideEffect) {
    // Bare package side effects are polyfills (`reflect-metadata`, `zone.js`)
    // and must run first. Anything relative, aliased or asset-like is styling.
    if (isRelative(source) || alias || ASSET_EXTENSION.test(source)) return 'side-effect'
    return 'polyfill'
  }

  if (source.startsWith('node:')) return 'builtin'
  if (alias) return 'alias'
  if (isRelative(source)) return 'relative'
  if (isBuiltin(source)) return 'builtin'
  // Workspace packages are usually scoped too, so they have to be claimed first.
  if (options.workspacePackages.has(packageName(source))) return 'workspace'

  // A pinned package stays with the libraries even when scoped, otherwise the
  // scoped group would swallow `@nestjs/common` and `@angular/core` and undo
  // the very ordering the preset exists to provide.
  const isPinned = priorityRank(source, options.priorityPackages) < options.priorityPackages.length
  if (options.groupScoped && !isPinned && source.startsWith('@') && source.includes('/')) {
    return 'scoped'
  }

  return 'library'
}

export function groupImports(
  imports: ParsedImport[],
  options: ResolvedOptions,
): Map<ImportGroupId, ParsedImport[]> {
  const groups = new Map<ImportGroupId, ParsedImport[]>()
  for (const entry of imports) {
    const id = classify(entry, options)
    const bucket = groups.get(id)
    if (bucket) bucket.push(entry)
    else groups.set(id, [entry])
  }
  return groups
}
