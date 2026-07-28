# Changelog

## 1.0.0

Renamed from `prettier-plugin-sort-react-imports`. The engine was rewritten on top of a real parser, which fixes a class of bugs the previous line-by-line regex approach could not.

### Breaking

- **Package renamed** to `prettier-plugin-auto-sort-imports`. The old name still installs and works, but is deprecated.
- **Scoped npm packages are libraries again.** Previously, in any project without `paths` in its tsconfig, every `@scope/package` import was treated as an internal alias. `@mui/material`, `@tanstack/react-query` and `@nestjs/common` now sort with the other packages.
- **Aliases come from your tsconfig or jsconfig, whatever their shape.** Prefixes without a leading `@`, such as `~/`, `src/` and `components/`, are recognised now. Previously only `@`-prefixed aliases worked.
- Bare side-effect imports such as `reflect-metadata` now form their own group at the very top instead of sorting among the libraries.
- Node builtins now form their own group above the libraries.
- License changed from ISC to MIT.

### Fixed

- A multiline `import X, { … }` or `import type { … }` as the last import produced invalid code and made prettier fail with a syntax error. This hit the most common React import there is.
- A blank line was inserted inside template literals and block comments that contained a line starting with `import`, silently changing runtime string values.
- `// @sort-imports-ignore` never worked in the published package: the committed build output had not been regenerated since before the feature was added. The build is no longer committed, and `prepublishOnly` now rebuilds and tests.
- The pragma is also recognised after a byte order mark, a shebang, a `'use client'` directive, blank lines and other comments, written without a space, or as a block comment.
- Leading comments such as `// eslint-disable-next-line` stayed behind and reattached to a different import.
- With prettier's default `semi: true`, default, namespace and side-effect imports were not sorted at all.
- `export { x } from '…'` between imports was hoisted above them.
- The plugin failed to load on Prettier 3, whose bundled parser paths differ from Prettier 2's.
- A tsconfig containing comments or trailing commas caused every alias to be silently ignored.
- Priority packages were matched by substring, which promoted `preact`, `next-auth`, `nextra` and `@testing-library/react`.
- A specifier whose name begins with `from`, such as `fromPairs`, corrupted the parsed module path.
- A trailing semicolon ended up as part of the module path.
- Comments inside the braces of an import were deleted.
- The tsconfig was read from the working directory instead of the file's location, so monorepos never found their aliases, and it was re-read from disk for every file.

### Added

- Prettier 3 support, alongside Prettier 2.3+.
- Plugin options: `sortImportsPreset`, `sortImportsGroups`, `sortImportsPriorityPackages`, `sortImportsAliases`, `sortImportsSpecifierOrder`, `sortImportsSeparator`, `sortImportsRemoveUnused`, `sortImportsIgnorePragma`.
- Framework presets for React, Next.js, NestJS, Vue, Nuxt, Svelte, Angular and plain Node, detected automatically from the nearest `package.json`.
- Optional removal of unused imports, off by default, with safety gates for decorators, declaration files, ambient augmentation and single-file components.
- Support for the `babel-ts`, `babel-flow`, `flow`, `espree`, `meriyah` and `acorn` parsers in addition to `babel` and `typescript`. Vue, Svelte and Astro work through their own prettier plugins.
- Alias discovery understands `extends` chains, JSONC syntax and `baseUrl`.
- A test suite that asserts, for every fixture, that the output parses, that no import or binding is lost or altered, and that formatting is idempotent.
