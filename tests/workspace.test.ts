import path from 'path'

import { describe, expect, it } from 'vitest'

import { sortImports } from '../src/preprocess'
import { REACT_FILE, assertParses, collectImports } from './helpers'

const PNPM_FILE = path.resolve(__dirname, 'fixtures/monorepo/apps/web/src/Page.tsx')
const NPM_FILE = path.resolve(__dirname, 'fixtures/npm-monorepo/packages/app/src/index.ts')

const format = (code: string, filepath: string, extra: Record<string, unknown> = {}) =>
  sortImports(code, { filepath, parser: 'typescript', ...extra })

describe('workspace packages', () => {
  it('separates packages from this repository from third-party ones (workspace: protocol)', () => {
    const code = [
      "import { Button } from '@fixture/ui'",
      "import zeta from 'zeta'",
      "import { useState } from 'react'",
      "import { TextField } from '@/components/TextField'",
      '',
      'export default [Button, zeta, useState, TextField]',
      '',
    ].join('\n')

    expect(format(code, PNPM_FILE)).toBe(
      [
        "import { useState } from 'react'",
        "import zeta from 'zeta'",
        '',
        "import { Button } from '@fixture/ui'",
        '',
        "import { TextField } from '@/components/TextField'",
        '',
        'export default [Button, zeta, useState, TextField]',
        '',
      ].join('\n'),
    )
  })

  it('detects members declared only through pnpm-workspace.yaml', () => {
    // @fixture/contract is a workspace member but the import uses a subpath,
    // so the package name has to be derived rather than matched literally.
    const code =
      "import { schema } from '@fixture/contract/user'\nimport zeta from 'zeta'\n\nexport default [schema, zeta]\n"
    const out = format(code, PNPM_FILE)

    expect(out.indexOf("'zeta'")).toBeLessThan(out.indexOf('@fixture/contract/user'))
  })

  it('detects members of an npm "workspaces" monorepo, which has no protocol marker', () => {
    const code =
      "import { core } from '@npmmono/core'\nimport zeta from 'zeta'\n\nexport default [core, zeta]\n"
    const out = format(code, NPM_FILE)

    expect(out.indexOf("'zeta'")).toBeLessThan(out.indexOf('@npmmono/core'))
  })

  it('keeps tsconfig aliases below workspace packages', () => {
    const code =
      "import { TextField } from '@/components/TextField'\nimport { Button } from '@fixture/ui'\n\nexport default [TextField, Button]\n"
    const out = format(code, PNPM_FILE)

    expect(out.indexOf('@fixture/ui')).toBeLessThan(out.indexOf('@/components/TextField'))
  })

  it('sortImportsDetectWorkspace: false sorts them among the libraries again', () => {
    const code =
      "import { Button } from '@fixture/ui'\nimport aaa from 'aaa'\n\nexport default [Button, aaa]\n"
    const out = format(code, PNPM_FILE, { sortImportsDetectWorkspace: false })

    expect(out).toBe("import aaa from 'aaa'\nimport { Button } from '@fixture/ui'\n\nexport default [Button, aaa]\n")
  })

  it('changes nothing in a project that is not a monorepo', () => {
    const code =
      "import { Button } from '@mui/material'\nimport aaa from 'aaa'\n\nexport default [Button, aaa]\n"
    const out = sortImports(code, { filepath: REACT_FILE, parser: 'typescript' })

    expect(out).toBe("import aaa from 'aaa'\nimport { Button } from '@mui/material'\n\nexport default [Button, aaa]\n")
  })

  it('holds the usual invariants', () => {
    const code = [
      "import { Button } from '@fixture/ui'",
      "import { schema } from '@fixture/contract'",
      "import zeta from 'zeta'",
      "import { useState } from 'react'",
      "import { TextField } from '@/components/TextField'",
      "import local from './local'",
      "import './styles.css'",
      '',
      'export default [Button, schema, zeta, useState, TextField, local]',
      '',
    ].join('\n')

    const once = format(code, PNPM_FILE)

    expect(() => assertParses(once)).not.toThrow()
    expect(collectImports(once)).toEqual(collectImports(code))
    expect(format(once, PNPM_FILE)).toBe(once)
  })
})
