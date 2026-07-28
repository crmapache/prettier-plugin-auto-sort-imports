import type { ParsedImport } from '../types'
import type { ParseResult } from './parse-imports'

/** Formats whose bindings are also referenced from a template we cannot see. */
const COMPONENT_EXTENSIONS = /\.(?:vue|svelte|astro|marko|riot)$/i

/** Node types that carry a referenceable name. */
const NAME_BEARING = new Set(['Identifier', 'JSXIdentifier', 'TSTypeParameter'])

/**
 * Collects every name mentioned anywhere below `node`.
 *
 * Deliberately over-collects: property keys and shorthand names are counted as
 * references too. An extra reference only means an import is kept, which is the
 * safe direction to be wrong in.
 */
function collectReferences(node: unknown, into: Set<string>, depth = 0): void {
  if (depth > 400 || node === null || typeof node !== 'object') return

  if (Array.isArray(node)) {
    for (const child of node) collectReferences(child, into, depth + 1)
    return
  }

  const record = node as Record<string, unknown>
  const type = record.type

  if (typeof type === 'string' && NAME_BEARING.has(type) && typeof record.name === 'string') {
    into.add(record.name)
  }

  for (const key of Object.keys(record)) {
    if (key === 'loc' || key === 'type' || key === 'start' || key === 'end') continue
    const value = record[key]
    if (value !== null && typeof value === 'object') collectReferences(value, into, depth + 1)
  }
}

/**
 * Decides whether unused-import removal may run on this file at all.
 *
 * Each gate below corresponds to a way the analysis would be wrong, and any of
 * them means the whole file is left alone rather than partially trimmed.
 */
export function canRemoveUnused(
  parsed: ParseResult,
  code: string,
  filepath: string | undefined,
): boolean {
  // A file we could not fully understand must not lose code.
  if (parsed.hasErrors) return false

  // With `emitDecoratorMetadata`, types referenced only in constructor
  // parameters are emitted at runtime. Dropping them breaks Nest and Angular DI.
  if (parsed.hasDecorators) return false

  // Declaration files and ambient augmentation reference names in ways the
  // syntactic analysis below cannot see.
  if (filepath && /\.d\.[cm]?ts$/i.test(filepath)) return false
  if (/\bdeclare\s+(?:module|global|namespace)\b/.test(code)) return false

  // Bindings in a component's script are used by its template.
  if (filepath && COMPONENT_EXTENSIONS.test(filepath)) return false

  return true
}

/**
 * Returns the names that are never referenced outside the import block.
 *
 * When JSX is present the classic runtime needs the pragma binding in scope even
 * though it is never written out, so `React` is always treated as used.
 */
export function findUnusedBindings(parsed: ParseResult, code: string): Set<string> {
  const referenced = new Set<string>()
  collectReferences(parsed.bodyAfterImports, referenced)

  if (/<[A-Za-z/>]/.test(code)) {
    referenced.add('React')
  }

  const unused = new Set<string>()
  for (const entry of parsed.block.imports) {
    for (const binding of entry.bindings) {
      if (!referenced.has(binding)) unused.add(binding)
    }
  }

  return unused
}

/**
 * Rewrites one import without its unused bindings.
 *
 * Returns `null` when the whole statement should go, or the original entry when
 * nothing changes. Only the clause between `import` and `from` is rebuilt, so
 * the module string, import attributes and attached comments survive verbatim.
 */
export function pruneImport(entry: ParsedImport, unused: Set<string>): ParsedImport | null {
  if (entry.isSideEffect) return entry
  if (!entry.bindings.some((binding) => unused.has(binding))) return entry

  if (entry.bindings.every((binding) => unused.has(binding))) return null

  // Rebuilding would drop a comment that lives inside the declaration.
  if (!entry.canSortSpecifiers || !entry.clauseRange) return entry

  // Every check below is on the local binding name. Comparing the imported name
  // instead would drop `Foo as Bar` whenever some other import bound an unused
  // `Foo`.
  const parts: string[] = []
  if (entry.defaultSpecifier && !unused.has(entry.defaultSpecifier.local)) {
    parts.push(entry.defaultSpecifier.text)
  }
  if (entry.namespaceSpecifier && !unused.has(entry.namespaceSpecifier.local)) {
    parts.push(entry.namespaceSpecifier.text)
  }

  const keptNamed = (entry.specifiers ?? []).filter(
    (specifier) => !unused.has(specifier.local),
  )

  const prefix = parts.join(', ')
  if (keptNamed.length > 0) {
    parts.push(`{ ${keptNamed.map((specifier) => specifier.text).join(', ')} }`)
  }

  if (parts.length === 0) return null

  const { start, end } = entry.clauseRange
  const clause = parts.join(', ')
  const text = `${entry.text.slice(0, start)}${clause}${entry.text.slice(end)}`

  // Point at the braces inside the rebuilt clause so specifier sorting still
  // applies to what survived. The braces are always the last part.
  const bracesStart = start + (prefix ? prefix.length + 2 : 0)

  return {
    ...entry,
    text,
    specifiers: keptNamed.length > 0 ? keptNamed : null,
    namedRange:
      keptNamed.length > 0
        ? { start: bracesStart, end: bracesStart + (parts[parts.length - 1]?.length ?? 0) }
        : null,
    clauseRange: null,
    bindings: entry.bindings.filter((binding) => !unused.has(binding)),
  }
}
