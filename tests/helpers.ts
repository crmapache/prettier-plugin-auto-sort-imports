import path from 'path'

import { parse } from '@babel/parser'

export const REACT_FILE = path.resolve(
  __dirname,
  'fixtures/project/src/components/Widget.tsx',
)
export const NEST_FILE = path.resolve(__dirname, 'fixtures/nest/src/user.service.ts')

/**
 * A canonical, order-independent description of every import in a file.
 *
 * Comparing this before and after formatting is the core safety net: it proves
 * no import, binding or rename was lost, duplicated or altered.
 */
export function collectImports(code: string): string[] {
  const ast = parse(code, {
    sourceType: 'module',
    errorRecovery: true,
    plugins: ['typescript', 'jsx', 'decorators-legacy', 'importAttributes'],
  })

  const result: string[] = []

  for (const node of ast.program.body) {
    if (node.type !== 'ImportDeclaration') continue

    const specifiers = node.specifiers
      .map((specifier) => {
        if (specifier.type === 'ImportDefaultSpecifier') return `default:${specifier.local.name}`
        if (specifier.type === 'ImportNamespaceSpecifier') return `namespace:${specifier.local.name}`
        const imported =
          specifier.imported.type === 'Identifier'
            ? specifier.imported.name
            : specifier.imported.value
        const kind = specifier.importKind === 'type' ? 'type' : 'value'
        return `named:${kind}:${imported}:${specifier.local.name}`
      })
      .sort()

    result.push(`${node.source.value}|${node.importKind ?? 'value'}|${specifiers.join(',')}`)
  }

  return result.sort()
}

/**
 * One entry per binding rather than per declaration.
 *
 * `collectImports` describes a whole import statement, so dropping a single
 * unused name changes its signature entirely. When imports may legitimately
 * shrink, the useful question is whether every binding in the output was
 * present in the input.
 */
export function collectImportBindings(code: string): string[] {
  const ast = parse(code, {
    sourceType: 'module',
    errorRecovery: true,
    plugins: ['typescript', 'jsx', 'decorators-legacy', 'importAttributes'],
  })

  const result: string[] = []

  for (const node of ast.program.body) {
    if (node.type !== 'ImportDeclaration') continue
    const source = node.source.value

    if (node.specifiers.length === 0) {
      result.push(`${source}|side-effect`)
      continue
    }

    for (const specifier of node.specifiers) {
      if (specifier.type === 'ImportDefaultSpecifier') {
        result.push(`${source}|default:${specifier.local.name}`)
      } else if (specifier.type === 'ImportNamespaceSpecifier') {
        result.push(`${source}|namespace:${specifier.local.name}`)
      } else {
        const imported =
          specifier.imported.type === 'Identifier'
            ? specifier.imported.name
            : specifier.imported.value
        const kind = specifier.importKind === 'type' ? 'type' : 'value'
        result.push(`${source}|named:${kind}:${imported}:${specifier.local.name}`)
      }
    }
  }

  return result.sort()
}

/** Throws if the code is not parseable, which is what prettier would do. */
export function assertParses(code: string): void {
  parse(code, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx', 'decorators-legacy', 'importAttributes'],
  })
}
