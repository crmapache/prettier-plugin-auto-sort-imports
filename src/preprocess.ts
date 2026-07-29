import { groupImports } from './core/classify'
import { hasIgnorePragma } from './core/ignore'
import { isParseable, parseImports } from './core/parse-imports'
import { assemble, printGroups } from './core/print'
import { sortGroup } from './core/sort'
import { canRemoveUnused, findUnusedBindings, pruneImport } from './core/unused'
import { getFilePath, resolveOptions } from './options'
import type { ImportGroupId, ParsedImport } from './types'

/**
 * Sorts the leading import block of a source file.
 *
 * Every failure path returns the input untouched. A formatter that cannot be
 * sure of its output must not change the file.
 */
export function sortImports(code: string, rawOptions?: unknown): string {
  try {
    const prettierOptions = (rawOptions ?? {}) as Parameters<typeof resolveOptions>[0]
    const options = resolveOptions(prettierOptions)

    if (hasIgnorePragma(code, options.ignorePragma)) return code

    const filepath = getFilePath(prettierOptions)
    const parsed = parseImports(code, filepath, prettierOptions?.parser)
    if (!parsed) return code

    const { block } = parsed

    let entries = block.imports
    let rewroteImports = false

    if (options.removeUnused && canRemoveUnused(parsed, code, filepath)) {
      const unused = findUnusedBindings(parsed, code)
      const pruned = entries.map((entry) => pruneImport(entry, unused))
      // pruneImport hands back the same object when it changes nothing.
      rewroteImports = pruned.some((entry, i) => entry !== entries[i])
      entries = pruned.filter((entry): entry is ParsedImport => entry !== null)
    }

    // Every import turned out to be unused: the block disappears entirely.
    if (entries.length === 0) {
      const head = block.header.replace(/\s+$/, '')
      const rest = block.tail.replace(/^(?:[ \t]*\r?\n)+/, '')
      return head ? `${head}\n\n${rest}` : rest
    }

    const grouped = groupImports(entries, options)

    const sorted = new Map<ImportGroupId, ParsedImport[]>()
    for (const [id, groupEntries] of grouped) sorted.set(id, sortGroup(id, groupEntries, options))

    const printed = printGroups(sorted, options.groups, options)
    if (printed.trim() === '') return code

    const result = assemble(block.header, printed, block.tail)

    // Only the unused-import path edits statements rather than moving them, so
    // that is the only path whose output needs verifying.
    if (rewroteImports && !isParseable(result, filepath, prettierOptions?.parser)) return code

    return result
  } catch {
    return code
  }
}

/** Signature prettier calls on a parser. */
export function preprocess(code: string, options?: unknown): string {
  return sortImports(code, options)
}
