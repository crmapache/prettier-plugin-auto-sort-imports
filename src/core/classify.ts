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
  if (options.workspacePackages.has(packageName(source))) return 'workspace'
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
