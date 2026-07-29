import { describe, expect, it } from 'vitest'

import { sortImports } from '../src/preprocess'
import { NEST_FILE, REACT_FILE, assertParses } from './helpers'

const react = (code: string, extra: Record<string, unknown> = {}) =>
  sortImports(code, { filepath: REACT_FILE, parser: 'typescript', ...extra })

describe('critical: code corruption and crashes', () => {
  it('bug 1: keeps a multiline default+named import intact when it is last', () => {
    const code = "import b from 'b'\nimport React, {\n  useState,\n} from 'react'\n\nexport function App() {\n  return useState\n}\n"
    const out = react(code)

    expect(() => assertParses(out)).not.toThrow()
    expect(out).toContain('import React, {')
    expect(out).toContain('} from ')
  })

  it('bug 1b: keeps a multiline type-only import intact when it is last', () => {
    const code = "import a from 'a'\nimport type {\n  Foo,\n} from './types'\n\nexport const x: Foo = a\n"
    const out = react(code)

    expect(() => assertParses(out)).not.toThrow()
    expect(out).toContain('import type {')
  })

  it('bug 2: never touches a template literal that contains an import line', () => {
    const code = 'const tpl = `\nimport foo from \'bar\'\n`\nexport default tpl\n'
    expect(react(code)).toBe(code)
  })

  it('bug 2b: never touches a block comment that contains an import line', () => {
    const code = "/*\nimport nothing from 'nowhere'\n*/\nconst x = 1\n"
    expect(react(code)).toBe(code)
  })
})

describe('high: wrong output and broken tooling', () => {
  it('bug 4: a leading comment travels with its own import', () => {
    const code =
      "// eslint-disable-next-line import/no-cycle\nimport { a } from './a'\nimport b from 'b'\n\nexport default [a, b]\n"
    const out = react(code)

    expect(out).toMatch(/\/\/ eslint-disable-next-line import\/no-cycle\nimport \{ a \} from '\.\/a'/)
  })

  it('bug 4b: a trailing comment stays on its own import', () => {
    const code = "import zeta from 'zeta' // pinned\nimport alpha from 'alpha'\n\nexport default [alpha, zeta]\n"
    const out = react(code)

    expect(out).toMatch(/import zeta from 'zeta' \/\/ pinned/)
  })

  it('bug 5: sorts imports written with semicolons', () => {
    const code = "import zeta from 'zeta';\nimport alpha from 'alpha';\n\nexport default [alpha, zeta];\n"
    const out = react(code)

    expect(out.indexOf("'alpha'")).toBeLessThan(out.indexOf("'zeta'"))
  })

  it('bug 5b: sorts a side-effect import written with a semicolon', () => {
    const code = "import './s.css';\nimport zeta from 'zeta';\n\nexport const x = 1;\n"
    const out = react(code)

    expect(out.indexOf("'zeta'")).toBeLessThan(out.indexOf("'./s.css'"))
  })

  it('bug 6: never hoists an export-from above the imports', () => {
    const code = "import a from 'a'\nexport { b } from './b'\nimport c from 'c'\n\nexport default a\n"
    const out = react(code)

    expect(out.indexOf("import a from 'a'")).toBeLessThan(out.indexOf('export { b }'))
    expect(out.indexOf('export { b }')).toBeLessThan(out.indexOf("import c from 'c'"))
  })

  it('bug 8: scoped packages are libraries, not aliases', () => {
    const code =
      "import { Button } from '@mui/material'\nimport helper from '~/utils/helper'\n\nexport default [Button, helper]\n"
    const out = react(code)

    // The alias group comes after the library group.
    expect(out.indexOf('@mui/material')).toBeLessThan(out.indexOf('~/utils/helper'))
  })

  it('bug 9: aliases without a leading @ are recognised', () => {
    const code =
      "import Card from 'components/Card'\nimport lib from 'some-package'\n\nexport default [Card, lib]\n"
    const out = react(code)

    expect(out.indexOf('some-package')).toBeLessThan(out.indexOf('components/Card'))
  })

  it('bug 10: reads aliases from a tsconfig containing comments and trailing commas', () => {
    const code = "import core from '@core/thing'\nimport lib from 'zzz'\n\nexport default [core, lib]\n"
    const out = react(code)

    expect(out.indexOf('zzz')).toBeLessThan(out.indexOf('@core/thing'))
  })
})

describe('medium', () => {
  it('bug 11: priority matching does not promote lookalike packages', () => {
    const code =
      "import { render } from '@testing-library/react'\nimport preact from 'preact'\nimport React from 'react'\n\nexport default [render, preact, React]\n"
    const out = react(code)

    expect(out.indexOf("from 'react'")).toBeLessThan(out.indexOf("from 'preact'"))
    expect(out.indexOf("from 'react'")).toBeLessThan(out.indexOf('@testing-library/react'))
  })

  it('bug 12: a specifier starting with "from" does not corrupt the module path', () => {
    const code =
      "import { fromPairs } from 'lodash'\nimport aaa from 'aaa'\n\nexport default [fromPairs, aaa]\n"
    const out = react(code)

    expect(out.indexOf("'aaa'")).toBeLessThan(out.indexOf("'lodash'"))
  })

  it('bug 13: a trailing semicolon is not part of the module path', () => {
    const code = "import b from 'b';\nimport a from './a';\n\nexport default [a, b];\n"
    const out = react(code)

    expect(out.indexOf("'b'")).toBeLessThan(out.indexOf("'./a'"))
  })

  it('bug 14: a multiline named import in the middle of the block still sorts', () => {
    const code =
      "import zeta from 'zeta'\nimport {\n  Foo,\n} from 'alpha'\nimport mid from 'mid'\n\nexport default [zeta, Foo, mid]\n"
    const out = react(code)

    expect(out.indexOf("'alpha'")).toBeLessThan(out.indexOf("'mid'"))
    expect(out.indexOf("'mid'")).toBeLessThan(out.indexOf("'zeta'"))
  })

  it('bug 15: aliases resolve from the file location, not the working directory', () => {
    const code = "import helper from '~/utils/helper'\nimport lib from 'zzz'\n\nexport default [helper, lib]\n"

    // The plugin process runs in the repository root, which has no such alias.
    expect(react(code).indexOf('zzz')).toBeLessThan(react(code).indexOf('~/utils/helper'))
  })

  it.each([
    ['plain', '// @sort-imports-ignore'],
    ['no space', '//@sort-imports-ignore'],
    ['block comment', '/* @sort-imports-ignore */'],
    ['without the at sign', '// sort-imports-ignore'],
  ])('bug 18: honours the ignore pragma written as %s', (_label, pragma) => {
    const code = `${pragma}\nimport z from 'z'\nimport a from 'a'\n\nexport default [z, a]\n`
    expect(react(code)).toBe(code)
  })

  it.each([
    ["after 'use client'", "'use client'\n// @sort-imports-ignore"],
    ['after a shebang', '#!/usr/bin/env node\n// @sort-imports-ignore'],
    ['after a blank line', '\n// @sort-imports-ignore'],
    ['after another comment', '// header\n// @sort-imports-ignore'],
  ])('bug 18b: honours the ignore pragma %s', (_label, prefix) => {
    const code = `${prefix}\nimport z from 'z'\nimport a from 'a'\n\nexport default [z, a]\n`
    expect(react(code)).toBe(code)
  })

  it('bug 18c: honours the ignore pragma after a byte order mark', () => {
    const code = "﻿// @sort-imports-ignore\nimport z from 'z'\nimport a from 'a'\n\nexport default [z, a]\n"
    expect(react(code)).toBe(code)
  })

  it('bug 19: a comment inside the braces is preserved', () => {
    const code =
      "import {\n  // keep this note\n  beta,\n  alpha,\n} from 'zzz'\nimport a from 'aaa'\n\nexport default [alpha, beta, a]\n"
    const out = react(code)

    expect(out).toContain('// keep this note')
    // Sorting the braces would drop the comment, so it is skipped for this import.
    expect(out).toContain('beta,\n  alpha,')
  })
})

describe('behaviour preserved from the previous engine', () => {
  it('keeps the documented grouping and ordering', () => {
    const input = [
      "import Fuse from 'fuse.js'",
      "import './styles.scss'",
      "import { BlackTransparentMask } from '../../SharedPageMask'",
      "import emptyFace from '@core/svg/face.svg'",
      "import Image from 'next/image'",
      "import { ShowAllButtonBackground } from './ShowAllButtonBackground'",
      "import debounce from 'lodash/debounce'",
      "import { useMemo, useState } from 'react'",
      '',
      'export default null',
      '',
    ].join('\n')

    expect(react(input)).toBe(
      [
        "import { useMemo, useState } from 'react'",
        "import Image from 'next/image'",
        "import Fuse from 'fuse.js'",
        "import debounce from 'lodash/debounce'",
        '',
        "import emptyFace from '@core/svg/face.svg'",
        '',
        "import { BlackTransparentMask } from '../../SharedPageMask'",
        "import { ShowAllButtonBackground } from './ShowAllButtonBackground'",
        '',
        "import './styles.scss'",
        '',
        'export default null',
        '',
      ].join('\n'),
    )
  })

  it('sorts the names inside braces shortest first', () => {
    const code = "import { Typography, Box, SearchInput } from 'zzz'\n\nexport default null\n"
    expect(react(code)).toContain('{ Box, Typography, SearchInput }')
  })

  it('preserves type modifiers and renames while sorting braces', () => {
    const code = "import { type Beta, Alpha as Renamed } from 'zzz'\n\nexport default null\n"
    const out = react(code)

    expect(out).toContain('type Beta')
    expect(out).toContain('Alpha as Renamed')
  })
})

describe('backend and framework coverage', () => {
  const nest = (code: string) => sortImports(code, { filepath: NEST_FILE, parser: 'typescript' })

  it('puts a bare side-effect polyfill first and node builtins next', () => {
    const code = [
      "import { Injectable } from '@nestjs/common'",
      "import path from 'path'",
      "import 'reflect-metadata'",
      "import fs from 'node:fs'",
      '',
      '@Injectable()',
      'export class A {}',
      '',
    ].join('\n')
    const out = nest(code)

    expect(out.indexOf('reflect-metadata')).toBeLessThan(out.indexOf('node:fs'))
    expect(out.indexOf('node:fs')).toBeLessThan(out.indexOf("'path'"))
    expect(out.indexOf("'path'")).toBeLessThan(out.indexOf('@nestjs/common'))
  })

  it('applies the detected nest preset ordering', () => {
    const code = [
      "import { Repository } from 'typeorm'",
      "import axios from 'axios'",
      "import { Injectable } from '@nestjs/common'",
      '',
      'export class A {}',
      '',
    ].join('\n')
    const out = nest(code)

    expect(out.indexOf('@nestjs/common')).toBeLessThan(out.indexOf('typeorm'))
    expect(out.indexOf('typeorm')).toBeLessThan(out.indexOf('axios'))
  })

  it('leaves a file without imports untouched', () => {
    const code = 'export const answer = 42\n'
    expect(react(code)).toBe(code)
  })

  it('leaves an unparseable file untouched', () => {
    const code = "import a from 'a'\n\nfunction ( { ] broken\n"
    expect(react(code)).toBe(code)
  })
})

describe('scoped packages and package depth', () => {
  it('a scope is not counted as a path level', () => {
    // `@mui/material` is one package with no subpath. Counting raw slashes put
    // it on a par with `lodash/debounce` and scattered scoped packages through
    // the middle of the list.
    const code = [
      "import { Button } from '@mui/material'",
      "import { styled } from '@mui/material/styles'",
      "import { useQuery } from '@tanstack/react-query'",
      '',
      'export default [Button, styled, useQuery]',
      '',
    ].join('\n')
    const out = react(code)

    // Depth 1 entries first, alphabetically; the subpath import goes last.
    expect(out.indexOf("from '@mui/material'")).toBeLessThan(out.indexOf('@tanstack/react-query'))
    expect(out.indexOf('@tanstack/react-query')).toBeLessThan(out.indexOf('@mui/material/styles'))
  })

  it('scoped packages form their own block below the unscoped ones', () => {
    const code = [
      "import { Button } from '@mui/material'",
      "import axios from 'axios'",
      "import debounce from 'lodash/debounce'",
      '',
      'export default [Button, axios, debounce]',
      '',
    ].join('\n')

    expect(react(code)).toBe(
      [
        "import axios from 'axios'",
        "import debounce from 'lodash/debounce'",
        '',
        "import { Button } from '@mui/material'",
        '',
        'export default [Button, axios, debounce]',
        '',
      ].join('\n'),
    )
  })

  it('a pinned package stays with the libraries even when scoped', () => {
    // Otherwise the scoped group would swallow @nestjs/common and undo the
    // ordering the preset exists to provide.
    const code = [
      "import { Repository } from 'typeorm'",
      "import { Injectable } from '@nestjs/common'",
      '',
      'export class A {}',
      '',
    ].join('\n')
    const out = sortImports(code, { filepath: NEST_FILE, parser: 'typescript' })

    expect(out.indexOf('@nestjs/common')).toBeLessThan(out.indexOf('typeorm'))
  })

  it('sortImportsGroupScoped: false keeps them among the libraries', () => {
    const code =
      "import { Button } from '@mui/material'\nimport axios from 'axios'\n\nexport default [Button, axios]\n"

    expect(react(code, { sortImportsGroupScoped: false })).toBe(
      "import { Button } from '@mui/material'\nimport axios from 'axios'\n\nexport default [Button, axios]\n",
    )
  })

  it('relative imports still count every slash', () => {
    const code = [
      "import { a } from './a'",
      "import { deep } from '../../deep/nested/thing'",
      "import { b } from '../b'",
      '',
      'export default [a, deep, b]',
      '',
    ].join('\n')
    const out = react(code)

    expect(out.indexOf('../../deep/nested/thing')).toBeLessThan(out.indexOf("'../b'"))
    expect(out.indexOf("'../b'")).toBeLessThan(out.indexOf("'./a'"))
  })
})

describe('options', () => {
  it('sortImportsSeparator: false removes the blank lines between groups', () => {
    const code = "import a from './a'\nimport z from 'zzz'\n\nexport default [a, z]\n"
    const out = react(code, { sortImportsSeparator: false })

    expect(out).toBe("import z from 'zzz'\nimport a from './a'\n\nexport default [a, z]\n")
  })

  it('sortImportsSpecifierOrder: alphabetical sorts braces by name', () => {
    const code = "import { Typography, Box, SearchInput } from 'zzz'\n\nexport default null\n"
    const out = react(code, { sortImportsSpecifierOrder: 'alphabetical' })

    expect(out).toContain('{ Box, SearchInput, Typography }')
  })

  it('sortImportsSpecifierOrder: none leaves braces untouched', () => {
    const code = "import { Typography, Box } from 'zzz'\n\nexport default null\n"
    const out = react(code, { sortImportsSpecifierOrder: 'none' })

    expect(out).toContain('{ Typography, Box }')
  })

  it('sortImportsPriorityPackages overrides the preset', () => {
    const code = "import react from 'react'\nimport axios from 'axios'\n\nexport default [react, axios]\n"
    const out = react(code, { sortImportsPriorityPackages: ['axios'] })

    expect(out.indexOf("'axios'")).toBeLessThan(out.indexOf("'react'"))
  })

  it('sortImportsAliases adds prefixes that tsconfig does not know about', () => {
    const code = "import x from '#internal/x'\nimport lib from 'zzz'\n\nexport default [x, lib]\n"
    const out = react(code, { sortImportsAliases: ['#internal/*'] })

    expect(out.indexOf('zzz')).toBeLessThan(out.indexOf('#internal/x'))
  })

  it('a custom ignore pragma is honoured', () => {
    const code = "// @no-sorting-here\nimport z from 'z'\nimport a from 'a'\n\nexport default [z, a]\n"
    expect(react(code, { sortImportsIgnorePragma: '@no-sorting-here' })).toBe(code)
  })

  it('an incomplete group list still prints every import', () => {
    const code = "import a from './a'\nimport z from 'zzz'\n\nexport default [a, z]\n"
    const out = react(code, { sortImportsGroups: ['relative'] })

    expect(out).toContain("'./a'")
    expect(out).toContain("'zzz'")
  })
})
