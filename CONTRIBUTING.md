# Contributing

Thanks for taking a look.

## Getting started

```shell
npm install
npm test
```

`npm test` builds the plugin and runs the suite. `npm run test:watch` skips the build and watches the sources.

## How the plugin works

Prettier hands the raw file text to `preprocess` before parsing it. The pipeline is:

1. `core/ignore` - bail out if the file opts out via the pragma.
2. `core/parse-imports` - parse with `@babel/parser`, take the unbroken run of imports at the top of the module, and attach each import's own comments to it.
3. `core/unused` - optional, off by default.
4. `core/classify` - assign each import to a group.
5. `core/sort` - order within each group.
6. `core/print` - render the block and reassemble the file.

`resolve/` handles tsconfig, alias and package.json lookups, all cached.

## The one rule

**If anything is uncertain, return the input unchanged.**

A formatter that corrupts a file is worse than one that does nothing. Every failure path in `sortImports` returns the original source. `parse-imports` also verifies that the blocks it is about to move are ordered, non-overlapping and separated by nothing but whitespace, and gives up otherwise.

## Tests

Three kinds, and new work should add to all that apply:

- `tests/regressions.test.ts` - one case per fixed bug. Add a case before fixing anything.
- `tests/invariants.test.ts` - a corpus of file shapes, checked as properties: the output parses, the set of imports and bindings is unchanged, and formatting is idempotent. Adding an entry to `CORPUS` is the cheapest way to widen coverage.
- `tests/prettier.test.ts` - end to end through the real prettier.

CI runs the suite against Node 18, 20 and 22, on both Prettier 2 and Prettier 3, and checks that the published tarball contains only `dist`, `package.json`, `README.md` and `LICENSE`.

## Releasing

`dist` is not committed. `prepublishOnly` cleans, rebuilds and runs the tests, so `npm publish` cannot ship a stale build - which is exactly how the ignore pragma once shipped broken.
