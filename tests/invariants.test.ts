import { describe, expect, it } from 'vitest'

import { sortImports } from '../src/preprocess'
import { NEST_FILE, REACT_FILE, assertParses, collectImports } from './helpers'

/**
 * A broad corpus of shapes the plugin must survive. The assertions below are
 * properties rather than golden files, so adding a case here is cheap and any
 * new case immediately guards against data loss.
 */
const CORPUS: Record<string, string> = {
  empty: '',
  noImports: 'export const answer = 42\n',
  single: "import a from 'a'\n\nexport default a\n",
  semicolons: "import zeta from 'zeta';\nimport alpha from 'alpha';\n\nexport default [alpha, zeta];\n",
  multilineNamed:
    "import {\n  Beta,\n  Alpha,\n} from 'zzz'\nimport a from 'aaa'\n\nexport default [Alpha, Beta, a]\n",
  multilineDefaultAndNamed:
    "import b from 'b'\nimport React, {\n  useState,\n  useEffect,\n} from 'react'\n\nexport default [b, React, useState, useEffect]\n",
  multilineTypeOnly:
    "import a from 'a'\nimport type {\n  Foo,\n} from './types'\n\nexport const x: Foo = a\n",
  inlineTypeSpecifiers:
    "import { type Beta, Alpha as Renamed } from 'zzz'\n\nexport default Renamed\n",
  namespace: "import * as path from 'path'\nimport { readFile } from 'fs'\n\nexport default [path, readFile]\n",
  sideEffects:
    "import 'reflect-metadata'\nimport './styles.css'\nimport a from 'a'\n\nexport default a\n",
  useClient: "'use client'\n\nimport z from 'zzz'\nimport a from './a'\n\nexport default [z, a]\n",
  shebang: "#!/usr/bin/env node\nimport z from 'zzz'\nimport a from './a'\n\nexport default [z, a]\n",
  licenseHeader:
    "/**\n * Copyright (c) 2024\n */\nimport z from 'zzz'\nimport a from './a'\n\nexport default [z, a]\n",
  eslintDisableFile:
    "/* eslint-disable */\nimport z from 'zzz'\nimport a from './a'\n\nexport default [z, a]\n",
  commentPerImport:
    "// keeps the cycle checker quiet\nimport { a } from './a'\n// vendor build needs this\nimport b from 'b'\n\nexport default [a, b]\n",
  trailingComment: "import zeta from 'zeta' // pinned\nimport alpha from 'alpha'\n\nexport default [alpha, zeta]\n",
  commentInsideBraces:
    "import {\n  // note\n  beta,\n  alpha,\n} from 'zzz'\n\nexport default [alpha, beta]\n",
  exportFromBetween:
    "import a from 'a'\nexport { b } from './b'\nimport c from 'c'\n\nexport default [a, c]\n",
  requireAfterImports:
    "import a from 'a'\nconst b = require('b')\nimport c from 'c'\n\nexport default [a, b, c]\n",
  templateLiteral: 'const tpl = `\nimport foo from \'bar\'\n`\nexport default tpl\n',
  blockCommentWithImport: "/*\nimport nothing from 'nowhere'\n*/\nexport const x = 1\n",
  decorators:
    "import { Injectable } from '@nestjs/common'\nimport { Repository } from 'typeorm'\n\n@Injectable()\nexport class A {\n  constructor(private readonly repo: Repository<unknown>) {}\n}\n",
  importAttributes: "import data from './data.json' with { type: 'json' }\nimport a from 'a'\n\nexport default [data, a]\n",
  stringNamedImport: "import { 'a-b' as ab } from 'zzz'\n\nexport default ab\n",
  emptyBraces: "import {} from 'zzz'\nimport a from 'aaa'\n\nexport default a\n",
  duplicateSource: "import a from 'zzz'\nimport { b } from 'zzz'\n\nexport default [a, b]\n",
  crlf: "import zeta from 'zeta'\r\nimport alpha from 'alpha'\r\n\r\nexport default [alpha, zeta]\r\n",
  noTrailingNewline: "import zeta from 'zeta'\nimport alpha from 'alpha'\n\nexport default [alpha, zeta]",
  jsx: "import z from 'zzz'\nimport React from 'react'\n\nexport default () => <div>{z}</div>\n",
  onlyImports: "import zeta from 'zeta'\nimport alpha from 'alpha'\n",
  bom: "﻿import zeta from 'zeta'\nimport alpha from 'alpha'\n\nexport default [alpha, zeta]\n",
  broken: "import a from 'a'\n\nfunction ( { ] broken\n",
}

const FILES = [REACT_FILE, NEST_FILE]

for (const filepath of FILES) {
  const label = filepath.includes('nest') ? 'nest project' : 'react project'

  describe(`invariants (${label})`, () => {
    const run = (code: string) => sortImports(code, { filepath, parser: 'typescript' })

    it.each(Object.entries(CORPUS))('%s: output still parses', (_name, code) => {
      const out = run(code)
      if (code.includes('broken')) return
      expect(() => assertParses(out)).not.toThrow()
    })

    it.each(Object.entries(CORPUS))('%s: no import is lost or altered', (_name, code) => {
      if (code.includes('broken')) return
      expect(collectImports(run(code))).toEqual(collectImports(code))
    })

    it.each(Object.entries(CORPUS))('%s: formatting is idempotent', (_name, code) => {
      const once = run(code)
      expect(run(once)).toBe(once)
    })

    it.each(Object.entries(CORPUS))('%s: nothing outside the import block moves', (_name, code) => {
      const out = run(code)
      const strip = (value: string) =>
        value
          .split('\n')
          .filter((line) => !/^\s*(?:import\b|\/\/|\/\*|\*)/.test(line) && line.trim() !== '')
          .join('\n')

      // Multiline imports contribute continuation lines, so compare only files
      // whose imports are all single-line.
      if (/^import[^\n]*\{[^}]*$/m.test(code)) return
      expect(strip(out)).toBe(strip(code))
    })
  })
}

describe('safety', () => {
  it('returns the input when the pragma disables the plugin', () => {
    const code = "// @sort-imports-ignore\nimport z from 'z'\nimport a from 'a'\n"
    expect(sortImports(code, { filepath: REACT_FILE })).toBe(code)
  })

  it('survives being called without any options', () => {
    const code = "import zeta from 'zeta'\nimport alpha from 'alpha'\n\nexport default [alpha, zeta]\n"
    expect(() => sortImports(code)).not.toThrow()
  })

  it('survives a filepath that does not exist', () => {
    const code = "import zeta from 'zeta'\nimport alpha from 'alpha'\n\nexport default [alpha, zeta]\n"
    expect(() => sortImports(code, { filepath: '/nowhere/at/all/file.ts' })).not.toThrow()
  })
})
