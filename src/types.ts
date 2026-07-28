/**
 * Identifiers of the buckets an import can land in. The order of this union is
 * documentation only - the effective order comes from `ResolvedOptions.groups`.
 */
export type ImportGroupId =
  | 'polyfill'
  | 'builtin'
  | 'library'
  | 'alias'
  | 'relative'
  | 'side-effect'

export type SpecifierOrder = 'length' | 'alphabetical' | 'none'

export type PresetName =
  | 'auto'
  | 'react'
  | 'next'
  | 'nest'
  | 'node'
  | 'vue'
  | 'nuxt'
  | 'svelte'
  | 'angular'
  | 'none'

/** A single entry inside the braces of a named import. */
export interface NamedSpecifier {
  /** Exact source slice, e.g. `type Foo as Bar`. Preserved verbatim. */
  text: string
  /** Imported name, used as the sort key. */
  name: string
  /**
   * Local binding this specifier introduces. For `Foo as Bar` that is `Bar` -
   * the name that matters when deciding whether the import is referenced.
   */
  local: string
}

/**
 * One import declaration together with the comments that belong to it.
 *
 * `start`/`end` span the whole block (leading comments .. trailing comment), which
 * is what makes it safe to lift the block out of the source and put it back
 * somewhere else.
 */
export interface ParsedImport {
  /** Source slice `[start, end)`, comments included. */
  text: string
  /** Module specifier, e.g. `react` or `./styles.css`. */
  source: string
  /** Position of the declaration among all imports, used for stable sorting. */
  index: number
  start: number
  end: number
  /** `import './x'` - no bindings at all. */
  isSideEffect: boolean
  /** Local names this import introduces. */
  bindings: string[]
  /** Entries between the braces, or `null` when the import has none. */
  specifiers: NamedSpecifier[] | null
  /** Range of the named block `{ ... }`, relative to `text`. */
  namedRange: { start: number; end: number } | null
  /** `import Foo from ...` binding, if present. */
  defaultSpecifier: NamedSpecifier | null
  /** `import * as Foo from ...` binding, if present. */
  namespaceSpecifier: NamedSpecifier | null
  /**
   * Everything between the `import` keyword and `from`, relative to `text`.
   * Rebuilding this range is how unused bindings are dropped without touching
   * the source string, import attributes or attached comments.
   */
  clauseRange: { start: number; end: number } | null
  /**
   * False when a comment sits anywhere inside the declaration. Rewriting the
   * braces would drop it, so specifier sorting is skipped for such imports.
   */
  canSortSpecifiers: boolean
}

/** Result of locating the leading import block of a file. */
export interface ImportBlock {
  imports: ParsedImport[]
  /** Everything before the first import block: shebang, directives, file header. */
  header: string
  /** Everything after the last import block. */
  tail: string
}

export interface ResolvedOptions {
  groups: ImportGroupId[]
  priorityPackages: string[]
  aliases: string[]
  specifierOrder: SpecifierOrder
  separator: boolean
  removeUnused: boolean
  ignorePragma: string
}
