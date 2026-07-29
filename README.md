# prettier-plugin-auto-sort-imports

[![npm version](https://img.shields.io/npm/v/prettier-plugin-auto-sort-imports.svg)](https://www.npmjs.com/package/prettier-plugin-auto-sort-imports)
[![npm downloads](https://img.shields.io/npm/dm/prettier-plugin-auto-sort-imports.svg)](https://www.npmjs.com/package/prettier-plugin-auto-sort-imports)
[![CI](https://github.com/crmapache/prettier-plugin-auto-sort-imports/actions/workflows/ci.yml/badge.svg)](https://github.com/crmapache/prettier-plugin-auto-sort-imports/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/prettier-plugin-auto-sort-imports.svg)](./LICENSE)

Sorts and groups your imports, with blank lines between groups, **without asking you to write a single regular expression**.

It reads your `tsconfig.json` / `jsconfig.json` and works out which imports are your own path aliases, which are npm packages, which are Node builtins and which are relative. Install it, and it does the right thing.

## Why another one

The popular plugins make you choose between control and convenience:

|                                         | **auto-sort-imports** | @trivago/…sort-imports | @ianvs/…sort-imports | …organize-imports |
| --------------------------------------- | --------------------- | ---------------------- | -------------------- | ----------------- |
| Works with zero configuration           | **Yes**               | No                     | No                   | Yes               |
| Requires hand-written regexes           | **No**                | Yes                    | Yes                  | No                |
| Blank lines between groups              | **Yes**               | Yes                    | Yes                  | No                |
| Finds your aliases from tsconfig itself | **Yes**               | No                     | No                   | No                |
| Groups your monorepo packages           | **Yes**               | No                     | No                   | No                |
| Needs TypeScript installed              | **No**                | No                     | No                   | Yes               |
| Removes unused imports                  | **Opt-in**            | No                     | No                   | Always            |
| Prettier 2 and 3                        | **Both**              | Both                   | Both                 | Both              |

With the regex-based plugins, a project using `@core`, `@ui` and `@server` has to declare and maintain something like:

```json
"importOrder": ["^@core/(.*)$", "^@server/(.*)$", "^@ui/(.*)$", "^[./]"]
```

Here you declare nothing. Those aliases are already in your `tsconfig.json`, so the plugin uses them.

## Install

```shell
npm install --save-dev prettier-plugin-auto-sort-imports
```

## Usage

**Prettier 3** (plugins must be listed explicitly):

```json
{
  "plugins": ["prettier-plugin-auto-sort-imports"]
}
```

**Prettier 2** works with the same config.

That is the whole setup. Everything below is optional.

## Example

### Input

```javascript
import Fuse from 'fuse.js'
import './styles.scss'
import { BlackTransparentMask } from '../../SharedPageMask'
import { ACCORDEON_DATA, TAB_OPTIONS } from './Faq.constants'
import emptySearchResultSadFace from '@assets/svg/empty-search-result.svg'
import Image from 'next/image'
import { BackdropWrap, Backdrop } from '../FrontBackdrop'
import { SearchInput, Tabs, Accordeon, Typography, Box } from '@core'
import debounce from 'lodash/debounce'
import { useMemo, useState } from 'react'
```

### Output

```javascript
import { useMemo, useState } from 'react'
import Image from 'next/image'
import Fuse from 'fuse.js'
import debounce from 'lodash/debounce'

import { Box, Tabs, Accordeon, Typography, SearchInput } from '@core'
import emptySearchResultSadFace from '@assets/svg/empty-search-result.svg'

import { BlackTransparentMask } from '../../SharedPageMask'
import { Backdrop, BackdropWrap } from '../FrontBackdrop'
import { TAB_OPTIONS, ACCORDEON_DATA } from './Faq.constants'

import './styles.scss'
```

## Groups

Imports are placed into these groups, in this order:

| Group         | What lands there                                                     |
| ------------- | -------------------------------------------------------------------- |
| `polyfill`    | Bare side-effect imports such as `reflect-metadata` or `zone.js`      |
| `builtin`     | Node builtins: `node:fs`, `path`, `crypto`                            |
| `library`     | Unscoped npm packages, plus any package you pinned as a priority      |
| `scoped`      | Scoped npm packages such as `@mui/material`                           |
| `workspace`   | Packages from your own monorepo                                       |
| `alias`       | Your own path aliases from tsconfig/jsconfig                          |
| `relative`    | `./foo`, `../bar`                                                     |
| `side-effect` | Style and asset imports such as `import './styles.css'`               |

Within a group, packages are ordered by depth and then alphabetically. Depth is measured from the package name, so `@mui/material` ranks alongside `axios` rather than alongside `lodash/debounce` - a scope is part of the name, not a folder level. Relative paths count every slash, so `../../deep` comes before `../shallow`.

Side-effect imports are never reordered relative to one another, because their order is part of how your program runs.

## Monorepos

Packages from your own repository are dependencies, so by default they would sort next to `react` and `lodash` even though they are your code. They get their own group instead, between third-party libraries and the aliases of the package you are editing:

```javascript
import { useState } from 'react'
import * as Yup from 'yup'

import { Button } from '@acme/ui'
import { api } from '@acme/api-client'

import { TextField } from '@/components/TextField'
```

Membership is detected from whichever of these your setup uses, so there is nothing to configure:

- a `workspace:` version range in `package.json` (pnpm, yarn berry, bun)
- a `workspaces` field in the repository root `package.json` (npm, yarn classic)
- `pnpm-workspace.yaml`

Aliases are resolved from the tsconfig nearest to the file being formatted, so each package in the monorepo gets its own. Set `sortImportsDetectWorkspace: false` to sort workspace packages among the libraries instead.

## Frameworks

The `auto` preset reads the nearest `package.json` and picks defaults for React, Next.js, NestJS, Vue, Nuxt, Svelte, Angular or plain Node. This only affects which packages get pinned to the top of the library group, for example `react` and `next` for a Next.js app, or `@nestjs/common` and `typeorm` for a Nest service.

Single-file components work too. Prettier hands `<script>` blocks to its JavaScript and TypeScript parsers, which is where this plugin attaches, so `.vue`, `.svelte` and `.astro` files are sorted alongside your regular sources.

## Options

Everything is optional.

| Option                        | Type                                            | Default               |
| ----------------------------- | ----------------------------------------------- | --------------------- |
| `sortImportsPreset`           | `auto` \| `react` \| `next` \| `nest` \| `node` \| `vue` \| `nuxt` \| `svelte` \| `angular` \| `none` | `auto` |
| `sortImportsGroups`           | array of group ids                              | preset default        |
| `sortImportsPriorityPackages` | array of package names                          | preset default        |
| `sortImportsAliases`          | array of alias prefixes                         | `[]`                  |
| `sortImportsSpecifierOrder`   | `length` \| `alphabetical` \| `none`            | `length`              |
| `sortImportsSeparator`        | boolean                                         | `true`                |
| `sortImportsGroupScoped`      | boolean                                         | `true`                |
| `sortImportsDetectWorkspace`  | boolean                                         | `true`                |
| `sortImportsRemoveUnused`     | boolean                                         | `false`               |
| `sortImportsIgnorePragma`     | string                                          | `@sort-imports-ignore` |

Example:

```json
{
  "plugins": ["prettier-plugin-auto-sort-imports"],
  "sortImportsPriorityPackages": ["react", "react-dom", "next"],
  "sortImportsAliases": ["~/", "#internal/"],
  "sortImportsSpecifierOrder": "alphabetical"
}
```

`sortImportsAliases` is only needed for bundler aliases that are defined in Vite or webpack but not mirrored in your tsconfig.

## Removing unused imports

Off by default. Deleting code while formatting should be a deliberate choice.

```json
{ "sortImportsRemoveUnused": true }
```

When enabled, the plugin skips whole files where the analysis could be wrong:

- files containing decorators, because with `emitDecoratorMetadata` a type used only in a constructor parameter is still needed at runtime (this is what would otherwise break NestJS and Angular dependency injection);
- `.d.ts` files and anything using `declare module`, `declare global` or `declare namespace`;
- `.vue`, `.svelte` and `.astro` files, whose bindings are referenced from a template the script does not contain;
- files that did not parse cleanly.

Side-effect imports are never removed, and the JSX pragma binding (`React`) is always kept when the file contains JSX.

## Ignoring a file

Put this anywhere in the comments at the top of the file:

```js
// @sort-imports-ignore
```

It is recognised after a shebang, a byte order mark, a `'use client'` directive, blank lines and other comments. `//@sort-imports-ignore`, `/* @sort-imports-ignore */` and `// sort-imports-ignore` all work as well.

## Migrating from @trivago or @ianvs

Delete your `importOrder` configuration. That is usually the entire migration.

```diff
 {
-  "plugins": ["@trivago/prettier-plugin-sort-imports"],
-  "importOrder": ["^@core/(.*)$", "^@server/(.*)$", "^@ui/(.*)$", "^[./]"],
-  "importOrderSeparation": true,
-  "importOrderSortSpecifiers": true
+  "plugins": ["prettier-plugin-auto-sort-imports"]
 }
```

Your aliases keep working because they are read from `tsconfig.json`. If some of them live only in your bundler config, list those prefixes in `sortImportsAliases`.

## Safety

This plugin parses your file and moves whole import statements, comments included. It never rewrites the module string, and it verifies that the statements it is about to move are separated by nothing but whitespace before touching anything. If any step is uncertain - the file does not parse, the layout is unusual, an internal check fails - the source is returned exactly as it came in.

The test suite asserts on every fixture that the output still parses, that the set of imports and bindings is unchanged, and that formatting twice gives the same result as formatting once.

## Compatibility

- Prettier 2.3+ and Prettier 3
- Node 14.17+
- TypeScript, JavaScript, JSX, TSX, Flow
- Vue, Svelte and Astro through their prettier plugins

Like every plugin that customises prettier's `babel` and `typescript` parsers, this one cannot be combined with another plugin that does the same, such as `prettier-plugin-organize-imports`.

## License

MIT
