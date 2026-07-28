import { parse, type ParserPlugin } from '@babel/parser'

import type { ImportBlock, NamedSpecifier, ParsedImport } from '../types'

/** Minimal shapes we rely on, so the plugin does not need `@babel/types` at runtime. */
interface RawComment {
  value: string
  start: number
  end: number
}

interface RawNode {
  type: string
  start: number
  end: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export interface ParseResult {
  block: ImportBlock
  /** True when babel reported recoverable syntax errors anywhere in the file. */
  hasErrors: boolean
  /** Program body statements after the import block, used by unused-import analysis. */
  bodyAfterImports: RawNode[]
  /** True when the file uses decorators, which makes unused-import removal unsafe. */
  hasDecorators: boolean
}

const BASE_PLUGINS: ParserPlugin[] = ['decorators-legacy', 'importAttributes']

/**
 * Comments that configure the whole file rather than the import right below them.
 * They stay pinned to the top instead of travelling with the first import.
 */
const FILE_LEVEL_PRAGMA =
  /^\s*(?:eslint-disable(?![-\w])|eslint-env|globals\s|@ts-nocheck|@ts-check|@flow|@jsx\b|@jsxRuntime|@jsxImportSource|@sort-imports-ignore|sort-imports-ignore|tslint:disable|istanbul ignore file|c8 ignore|@vitest-environment|@jest-environment|copyright|spdx-license-identifier|@license|@preserve)/i

/** Ordered parser configurations; the first one that parses wins. */
function pluginLadder(filepath: string | undefined, parser: string | undefined): ParserPlugin[][] {
  const ext = filepath ? filepath.slice(filepath.lastIndexOf('.')).toLowerCase() : ''
  const isTsx = ext === '.tsx' || ext === '.mtsx' || ext === '.ctsx'
  const isTs =
    ext === '.ts' ||
    ext === '.mts' ||
    ext === '.cts' ||
    parser === 'typescript' ||
    parser === 'babel-ts'
  const isFlow = parser === 'flow' || parser === 'babel-flow' || ext === '.js.flow'

  const ladder: ParserPlugin[][] = []

  if (isTsx) ladder.push(['typescript', 'jsx'])
  else if (isTs) ladder.push(['typescript'], ['typescript', 'jsx'])
  else if (isFlow) ladder.push(['flow', 'jsx'])
  else ladder.push(['jsx'], ['typescript', 'jsx'])

  // Generic fallbacks so an unexpected dialect still gets a chance.
  ladder.push(['typescript', 'jsx'], ['flow', 'jsx'], ['jsx'], [])

  return ladder.map((plugins) => [...plugins, ...BASE_PLUGINS])
}

function isAtLineStart(code: string, pos: number): boolean {
  for (let i = pos - 1; i >= 0; i--) {
    const char = code[i]
    if (char === '\n') return true
    if (char !== ' ' && char !== '\t' && char !== '\r') return false
  }
  return true
}

function countNewlines(code: string, from: number, to: number): number {
  let count = 0
  for (let i = from; i < to; i++) if (code[i] === '\n') count += 1
  return count
}

function isBlank(text: string): boolean {
  return /^\s*$/.test(text)
}

/** Local names a declaration introduces, used by unused-import analysis. */
function collectBindings(node: RawNode): string[] {
  const names: string[] = []
  for (const specifier of (node.specifiers ?? []) as RawNode[]) {
    const local = specifier.local as RawNode | undefined
    if (local && typeof local.name === 'string') names.push(local.name)
  }
  return names
}

function specifierSortName(specifier: RawNode): string {
  const imported = specifier.imported as RawNode | undefined
  if (imported) {
    if (typeof imported.name === 'string') return imported.name
    if (typeof imported.value === 'string') return imported.value
  }
  const local = specifier.local as RawNode | undefined
  return local && typeof local.name === 'string' ? local.name : ''
}

/**
 * Locates the `{ ... }` block and slices every entry verbatim, so `type`
 * modifiers, `as` renames and string-literal names all survive untouched.
 */
function readNamedSpecifiers(
  code: string,
  node: RawNode,
): { specifiers: NamedSpecifier[]; range: { start: number; end: number } } | null {
  const named = ((node.specifiers ?? []) as RawNode[]).filter((s) => s.type === 'ImportSpecifier')
  const first = named[0]
  const last = named[named.length - 1]
  if (!first || !last) return null

  const open = code.lastIndexOf('{', first.start)
  const close = code.indexOf('}', last.end)
  if (open < node.start || close < 0 || close >= node.end) return null

  return {
    specifiers: named.map((specifier) => ({
      text: code.slice(specifier.start, specifier.end),
      name: specifierSortName(specifier),
      local: String((specifier.local as RawNode | undefined)?.name ?? specifierSortName(specifier)),
    })),
    range: { start: open, end: close + 1 },
  }
}

/**
 * Extracts the leading run of import declarations together with their comments.
 *
 * Returns `null` whenever the file cannot be handled safely - no imports, a parse
 * failure, or a layout where lifting the blocks out would lose source characters.
 * Callers treat `null` as "leave this file alone".
 */
export function parseImports(
  code: string,
  filepath: string | undefined,
  parser: string | undefined,
): ParseResult | null {
  let ast: RawNode | null = null

  for (const plugins of pluginLadder(filepath, parser)) {
    try {
      ast = parse(code, {
        sourceType: 'module',
        allowReturnOutsideFunction: true,
        allowSuperOutsideMethod: true,
        allowUndeclaredExports: true,
        errorRecovery: true,
        ranges: false,
        plugins,
      }) as unknown as RawNode
      break
    } catch {
      // Try the next dialect.
    }
  }

  if (!ast) return null

  const program = ast.program as RawNode | undefined
  if (!program) return null

  const body = (program.body ?? []) as RawNode[]
  const comments = ((ast.comments ?? []) as RawComment[])
    .slice()
    .sort((a, b) => a.start - b.start)

  // Only the unbroken run of imports at the top of the module may be reordered.
  // Stopping at the first other statement keeps `export ... from`, `require` and
  // any side-effecting code exactly where the author put them.
  const declarations: RawNode[] = []
  for (const statement of body) {
    if (statement.type !== 'ImportDeclaration') break
    declarations.push(statement)
  }

  if (declarations.length === 0) return null

  const consumed = new Set<number>()

  // Trailing comments first, so they cannot be mistaken for the next import's
  // leading comments.
  const trailingOf = new Map<number, RawComment>()
  declarations.forEach((node, i) => {
    for (let c = 0; c < comments.length; c++) {
      const comment = comments[c]
      if (!comment || consumed.has(c) || comment.start < node.end) continue
      if (countNewlines(code, node.end, comment.start) > 0) break
      if (!isBlank(code.slice(node.end, comment.start))) break
      trailingOf.set(i, comment)
      consumed.add(c)
      break
    }
  })

  const leadingOf = new Map<number, RawComment[]>()
  declarations.forEach((node, i) => {
    const attached: RawComment[] = []
    let boundary = node.start

    for (let c = comments.length - 1; c >= 0; c--) {
      const comment = comments[c]
      if (!comment || consumed.has(c) || comment.end > boundary) continue
      // A comment belongs to this import only if nothing but a single line break
      // separates them, and it owns its line.
      if (countNewlines(code, comment.end, boundary) > 1) break
      if (!isBlank(code.slice(comment.end, boundary))) break
      if (!isAtLineStart(code, comment.start)) break
      attached.unshift(comment)
      consumed.add(c)
      boundary = comment.start
    }

    // Pragmas above the very first import configure the file, not the import.
    if (i === 0) {
      while (attached.length > 0) {
        const candidate = attached[0]
        if (!candidate || !FILE_LEVEL_PRAGMA.test(candidate.value)) break
        attached.shift()
      }
    }

    leadingOf.set(i, attached)
  })

  const imports: ParsedImport[] = declarations.map((node, index) => {
    const leading = leadingOf.get(index) ?? []
    const trailing = trailingOf.get(index)
    const first = leading[0]
    const start = first ? first.start : node.start
    const end = trailing ? trailing.end : node.end

    const named = readNamedSpecifiers(code, node)
    const source = String((node.source as RawNode | undefined)?.value ?? '')
    const hasInnerComment = comments.some((c) => c.start >= node.start && c.end <= node.end)

    const allSpecifiers = (node.specifiers ?? []) as RawNode[]
    const defaultNode = allSpecifiers.find((s) => s.type === 'ImportDefaultSpecifier')
    const namespaceNode = allSpecifiers.find((s) => s.type === 'ImportNamespaceSpecifier')

    const clauseStart = allSpecifiers.reduce<number | null>(
      (min, s) => (min === null || s.start < min ? s.start : min),
      null,
    )
    const clauseEnd = named
      ? named.range.end
      : allSpecifiers.reduce<number | null>((max, s) => (max === null || s.end > max ? s.end : max), null)

    return {
      text: code.slice(start, end),
      source,
      index,
      start,
      end,
      isSideEffect: allSpecifiers.length === 0,
      bindings: collectBindings(node),
      specifiers: named ? named.specifiers : null,
      namedRange: named
        ? { start: named.range.start - start, end: named.range.end - start }
        : null,
      defaultSpecifier: defaultNode
        ? {
            text: code.slice(defaultNode.start, defaultNode.end),
            name: String(defaultNode.local?.name ?? ''),
            local: String(defaultNode.local?.name ?? ''),
          }
        : null,
      namespaceSpecifier: namespaceNode
        ? {
            text: code.slice(namespaceNode.start, namespaceNode.end),
            name: String(namespaceNode.local?.name ?? ''),
            local: String(namespaceNode.local?.name ?? ''),
          }
        : null,
      clauseRange:
        clauseStart !== null && clauseEnd !== null
          ? { start: clauseStart - start, end: clauseEnd - start }
          : null,
      canSortSpecifiers: !hasInnerComment,
    }
  })

  // Safety invariant: the blocks must be ordered, non-overlapping, and separated
  // by whitespace only. If that holds, reordering them cannot lose a character.
  for (let i = 0; i < imports.length; i++) {
    const current = imports[i]
    if (!current) return null
    const next = imports[i + 1]
    if (!next) break
    if (next.start < current.end) return null
    if (!isBlank(code.slice(current.end, next.start))) return null
  }

  const firstImport = imports[0]
  const lastImport = imports[imports.length - 1]
  if (!firstImport || !lastImport) return null

  return {
    block: {
      imports,
      header: code.slice(0, firstImport.start),
      tail: code.slice(lastImport.end),
    },
    hasErrors: ((ast.errors ?? []) as unknown[]).length > 0,
    bodyAfterImports: body.slice(declarations.length),
    hasDecorators: /(^|[^.\w])@[A-Za-z_$]/.test(code.slice(lastImport.end)),
  }
}
