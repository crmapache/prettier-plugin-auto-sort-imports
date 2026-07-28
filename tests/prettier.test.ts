import { createRequire } from 'module'
import path from 'path'

import { describe, expect, it } from 'vitest'

import { REACT_FILE, assertParses, collectImports } from './helpers'

const require = createRequire(import.meta.url)

// The built bundle is what actually ships, so the end-to-end checks load it
// rather than the sources. `npm test` builds first.
const plugin = require(path.resolve(__dirname, '../dist/index.js'))
const prettier = require('prettier')
const prettierMajor = Number.parseInt(String(prettier.version).split('.')[0] ?? '0', 10)

async function format(code: string, options: Record<string, unknown> = {}): Promise<string> {
  return await prettier.format(code, {
    parser: 'typescript',
    plugins: [plugin],
    filepath: REACT_FILE,
    semi: false,
    singleQuote: true,
    ...options,
  })
}

describe(`prettier ${prettier.version} integration`, () => {
  it('exposes the parsers prettier needs', () => {
    const parsers = plugin.parsers ?? plugin.default?.parsers
    expect(parsers).toBeTruthy()
    expect(Object.keys(parsers)).toContain('typescript')
    expect(Object.keys(parsers)).toContain('babel')
  })

  it('exposes its options so prettier can validate a config', () => {
    const options = plugin.options ?? plugin.default?.options
    expect(options).toBeTruthy()
    expect(options.sortImportsPreset.default).toBe('auto')
  })

  it('formats the multiline react import that used to crash prettier', async () => {
    const code =
      "import b from 'b'\nimport React, {\n  useState,\n} from 'react'\n\nexport function App() {\n  return [b, React, useState]\n}\n"

    const out = await format(code)
    expect(() => assertParses(out)).not.toThrow()
    expect(collectImports(out)).toEqual(collectImports(code))
  })

  it('formats the multiline type-only import that used to crash prettier', async () => {
    const code = "import a from 'a'\nimport type {\n  Foo,\n} from './types'\n\nexport const x: Foo = a\n"

    const out = await format(code)
    expect(() => assertParses(out)).not.toThrow()
  })

  it('leaves a template literal containing an import line byte for byte', async () => {
    const code = 'const tpl = `\nimport foo from \'bar\'\n`\nexport default tpl\n'
    expect(await format(code)).toBe(code)
  })

  it('sorts imports under the default semi: true', async () => {
    const code = "import zeta from 'zeta'\nimport alpha from 'alpha'\n\nexport default [alpha, zeta]\n"
    const out = await format(code, { semi: true })

    expect(out.indexOf("'alpha'")).toBeLessThan(out.indexOf("'zeta'"))
  })

  it('honours the ignore pragma end to end', async () => {
    const code = "// @sort-imports-ignore\nimport zeta from 'zeta'\nimport alpha from 'alpha'\n\nexport default [alpha, zeta]\n"
    expect(await format(code)).toBe(code)
  })

  it('produces output that prettier --check considers stable', async () => {
    const code = [
      "import Fuse from 'fuse.js'",
      "import './styles.scss'",
      "import { BlackTransparentMask } from '../../SharedPageMask'",
      "import Image from 'next/image'",
      "import { useMemo, useState } from 'react'",
      '',
      'export default [Fuse, BlackTransparentMask, Image, useMemo, useState]',
      '',
    ].join('\n')

    const once = await format(code)
    expect(await format(once)).toBe(once)
  })

  it('works through the babel parser too', async () => {
    const code = "import zeta from 'zeta'\nimport alpha from 'alpha'\n\nexport default [alpha, zeta]\n"
    const out = await format(code, { parser: 'babel' })

    expect(out.indexOf("'alpha'")).toBeLessThan(out.indexOf("'zeta'"))
  })

  it('resolves prettier bundled parsers on this major version', () => {
    expect(prettierMajor === 2 || prettierMajor === 3).toBe(true)
  })

  // Prettier routes embedded <script> blocks through the js/ts parser, which is
  // where our preprocess is attached, so single-file components work without
  // any component-format-specific code on our side.
  it('sorts imports inside a Vue single file component', async () => {
    const sfc = [
      '<template>',
      '  <div>{{ msg }}</div>',
      '</template>',
      '',
      '<script setup lang="ts">',
      "import zeta from 'zeta'",
      "import { ref } from 'vue'",
      "import Local from './Local.vue'",
      '',
      "const msg = ref('hi')",
      '</script>',
      '',
    ].join('\n')

    const out = await format(sfc, { parser: 'vue' })

    expect(out.indexOf("'vue'")).toBeLessThan(out.indexOf("'zeta'"))
    expect(out.indexOf("'zeta'")).toBeLessThan(out.indexOf("'./Local.vue'"))
    expect(out).toContain('<template>')
  })
})
