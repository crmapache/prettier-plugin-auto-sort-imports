import { preprocess } from './preprocess'

export interface ParserLike {
  preprocess?: (code: string, options: unknown) => string
  [key: string]: unknown
}

/**
 * Prettier 3 moved its bundled parsers from `prettier/parser-*` to
 * `prettier/plugins/*`. The old specifiers are still aliased in the 3.x export
 * map, but they are legacy, so the current layout is tried first and the v2
 * paths are only a fallback.
 */
const PARSER_MODULES: Array<[string, string]> = [
  ['prettier/plugins/babel', 'prettier/parser-babel'],
  ['prettier/plugins/typescript', 'prettier/parser-typescript'],
  ['prettier/plugins/flow', 'prettier/parser-flow'],
  ['prettier/plugins/acorn', 'prettier/parser-espree'],
  ['prettier/plugins/meriyah', 'prettier/parser-meriyah'],
]

/** Parsers this plugin knows how to sort imports for. */
const SUPPORTED = [
  'babel',
  'babel-ts',
  'babel-flow',
  'typescript',
  'flow',
  'espree',
  'meriyah',
  'acorn',
]

function loadBundledParsers(): Record<string, ParserLike> {
  const collected: Record<string, ParserLike> = {}

  for (const candidates of PARSER_MODULES) {
    for (const id of candidates) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const loaded = require(id) as { parsers?: Record<string, ParserLike>; default?: unknown }
        const fromDefault = (loaded.default ?? {}) as { parsers?: Record<string, ParserLike> }
        const parsers = loaded.parsers ?? fromDefault.parsers
        if (parsers) {
          Object.assign(collected, parsers)
          break
        }
      } catch {
        // Not available in this prettier version - try the next path.
      }
    }
  }

  return collected
}

function withSorting(base: ParserLike): ParserLike {
  const original = base.preprocess

  return {
    ...base,
    preprocess(code: string, options: unknown): string {
      const sorted = preprocess(code, options)
      // Compose rather than replace: prettier may rely on its own preprocess.
      return original ? original(sorted, options) : sorted
    },
  }
}

export const parsers: Record<string, ParserLike> = (() => {
  const bundled = loadBundledParsers()
  const result: Record<string, ParserLike> = {}

  for (const name of SUPPORTED) {
    const base = bundled[name]
    if (base) result[name] = withSorting(base)
  }

  return result
})()
