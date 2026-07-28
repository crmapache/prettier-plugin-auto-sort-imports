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

/** Throws if the code is not parseable, which is what prettier would do. */
export function assertParses(code: string): void {
  parse(code, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx', 'decorators-legacy', 'importAttributes'],
  })
}
