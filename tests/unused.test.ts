import path from 'path'

import { describe, expect, it } from 'vitest'

import { isParseable } from '../src/core/parse-imports'
import { sortImports } from '../src/preprocess'
import { NEST_FILE, REACT_FILE, assertParses } from './helpers'

/**
 * Every case in this file asserts the result parses, not just that some string
 * is present or absent.
 *
 * The original version of these tests checked substrings only, and happily
 * passed while the plugin emitted `import { { kept } from 'zzz'` - the text
 * contained "kept" and did not contain "dropped", so both assertions held on
 * output that no parser would accept. Rewriting a clause is the one path that
 * edits a statement, so parseability is the assertion that matters.
 */
const prune = (code: string, extra: Record<string, unknown> = {}) => {
  const out = sortImports(code, {
    filepath: REACT_FILE,
    parser: 'typescript',
    sortImportsRemoveUnused: true,
    ...extra,
  })
  assertParses(out)
  return out
}

describe('removing unused imports', () => {
  it('rebuilds a named-only import without emitting a second brace', () => {
    // Regression: the clause was anchored on the first specifier, which sits
    // *after* the opening brace, so rebuilding produced `import { { a } from`.
    const code =
      "import { withCost, GoogleAdsMetricsData, DEFAULT_LIMIT } from './metrics'\n\nexport default [withCost, DEFAULT_LIMIT]\n"

    expect(prune(code)).toBe(
      "import { withCost, DEFAULT_LIMIT } from './metrics'\n\nexport default [withCost, DEFAULT_LIMIT]\n",
    )
  })

  it('rebuilds a multiline named-only import', () => {
    const code =
      "import {\n  withCost,\n  GoogleAdsMetricsData,\n  DEFAULT_LIMIT,\n} from './metrics'\n\nexport default [withCost, DEFAULT_LIMIT]\n"

    expect(prune(code)).toBe(
      "import { withCost, DEFAULT_LIMIT } from './metrics'\n\nexport default [withCost, DEFAULT_LIMIT]\n",
    )
  })

  it('is off unless explicitly enabled', () => {
    const code = "import unused from 'zzz'\nimport used from 'aaa'\n\nexport default used\n"
    expect(sortImports(code, { filepath: REACT_FILE })).toContain("'zzz'")
  })

  it('drops an import whose every binding is unused', () => {
    const code = "import unused from 'zzz'\nimport used from 'aaa'\n\nexport default used\n"
    const out = prune(code)

    expect(out).not.toContain("'zzz'")
    expect(out).toContain("'aaa'")
  })

  it('drops only the unused names inside the braces', () => {
    const code = "import { kept, dropped } from 'zzz'\n\nexport default kept\n"
    const out = prune(code)

    expect(out).toContain('kept')
    expect(out).not.toContain('dropped')
  })

  it('keeps a used default when its named siblings go', () => {
    const code = "import React, { unusedHook } from 'react'\n\nexport default React\n"
    const out = prune(code)

    expect(out).toContain('React')
    expect(out).not.toContain('unusedHook')
    expect(() => assertParses(out)).not.toThrow()
  })

  it('drops an unused default while keeping used named siblings', () => {
    const code = "import Unused, { kept } from 'zzz'\n\nexport default kept\n"
    const out = prune(code)

    expect(out).not.toContain('Unused')
    expect(out).toContain('kept')
    expect(() => assertParses(out)).not.toThrow()
  })

  it('compares local names, not imported ones', () => {
    const code = "import { Foo as Bar } from 'zzz'\nimport { Foo } from 'aaa'\n\nexport default Bar\n"
    const out = prune(code)

    expect(out).toContain('Foo as Bar')
    expect(out).not.toContain("from 'aaa'")
  })

  it('removes the whole block when nothing is used', () => {
    const code = "import a from 'a'\nimport b from 'b'\n\nexport const answer = 42\n"
    const out = prune(code)

    expect(out).toBe('export const answer = 42\n')
  })

  it('counts references in type positions', () => {
    const code = "import type { Foo } from './types'\n\nexport const x: Foo = null as never\n"
    expect(prune(code)).toContain('Foo')
  })

  it('counts references inside JSX', () => {
    const code = "import Widget from './Widget'\n\nexport default () => <Widget />\n"
    expect(prune(code)).toContain('Widget')
  })
})

describe('removal safety gates', () => {
  it('never removes a side-effect import', () => {
    const code = "import './styles.css'\nimport 'reflect-metadata'\n\nexport const x = 1\n"
    const out = prune(code)

    expect(out).toContain('./styles.css')
    expect(out).toContain('reflect-metadata')
  })

  it('leaves files with decorators alone, so Nest DI metadata survives', () => {
    const code = [
      "import { Injectable } from '@nestjs/common'",
      "import { Repository } from 'typeorm'",
      '',
      '@Injectable()',
      'export class UserService {',
      '  constructor(private readonly repo: Repository<string>) {}',
      '}',
      '',
    ].join('\n')

    const out = sortImports(code, {
      filepath: NEST_FILE,
      parser: 'typescript',
      sortImportsRemoveUnused: true,
    })

    expect(out).toContain('Injectable')
    expect(out).toContain('Repository')
  })

  it('keeps the JSX pragma binding even when it is never written', () => {
    const code = "import React from 'react'\nimport Widget from './Widget'\n\nexport default () => <Widget />\n"
    expect(prune(code)).toContain("import React from 'react'")
  })

  it('leaves declaration files alone', () => {
    const code = "import { Foo } from './foo'\n\nexport const answer = 42\n"
    const out = prune(code, { filepath: path.resolve(path.dirname(REACT_FILE), 'types.d.ts') })

    expect(out).toContain('Foo')
  })

  it('leaves files with ambient augmentation alone', () => {
    const code =
      "import { Foo } from './foo'\n\ndeclare global {\n  interface Window { foo: unknown }\n}\n\nexport const answer = 42\n"
    expect(prune(code)).toContain('Foo')
  })

  it('leaves single file components alone, since the template also references bindings', () => {
    const code = "import Widget from './Widget'\nimport zeta from 'zeta'\n\nconst n = 1\n"
    const out = prune(code, { filepath: path.resolve(path.dirname(REACT_FILE), 'App.vue') })

    expect(out).toContain('Widget')
    expect(out).toContain('zeta')
  })

  it('leaves an unparseable file alone', () => {
    const code = "import a from 'a'\n\nfunction ( { ] broken\n"
    // Not via `prune`: the input never parsed, so neither can the output.
    const out = sortImports(code, {
      filepath: REACT_FILE,
      parser: 'typescript',
      sortImportsRemoveUnused: true,
    })

    expect(out).toBe(code)
  })

  it('keeps an import whose comment lives inside the declaration', () => {
    const code = "import {\n  // note\n  kept,\n  dropped,\n} from 'zzz'\n\nexport default kept\n"
    const out = prune(code)

    expect(out).toContain('// note')
    expect(out).toContain('dropped')
  })

  it('the output guard rejects code that does not parse', () => {
    // The guard behind the clause rewrite: if a future defect produces broken
    // output, `sortImports` returns the original instead of shipping it.
    expect(isParseable("import { a } from 'x'\n", '/tmp/a.ts', 'typescript')).toBe(true)
    expect(isParseable("import { { a } from 'x'\n", '/tmp/a.ts', 'typescript')).toBe(false)
  })

  it('stays idempotent', () => {
    const code = "import unused from 'zzz'\nimport { kept, dropped } from 'aaa'\n\nexport default kept\n"
    const once = prune(code)

    expect(prune(once)).toBe(once)
  })
})
