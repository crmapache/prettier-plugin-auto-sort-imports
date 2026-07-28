import fs from 'fs'

import { findTsConfig } from './tsconfig'

/** Directories under `baseUrl` that are never import roots. */
const IGNORED_BASE_ENTRIES = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  'coverage',
  'public',
  'static',
])

const baseUrlCache = new Map<string, string[]>()

/**
 * Turns a `paths` key into a match prefix.
 *
 * `@app/*` -> `@app/`, `~/*` -> `~/`, `components/*` -> `components/`, and a key
 * without a wildcard stays exact. The old implementation stripped the leading
 * `@` and then required one, so `~/`, `src/` and friends never matched anything.
 */
function toPrefix(key: string): string | null {
  if (!key || key === '*') return null
  if (key.endsWith('/*')) return key.slice(0, -1)
  if (key.endsWith('*')) return key.slice(0, -1)
  return key
}

/**
 * Top-level directories under `baseUrl` behave like aliases: with
 * `baseUrl: "src"`, `import Button from 'components/Button'` is a local import,
 * not a package. One cached readdir keeps this cheap.
 */
function baseUrlPrefixes(baseUrl: string): string[] {
  const cached = baseUrlCache.get(baseUrl)
  if (cached) return cached

  let prefixes: string[] = []
  try {
    prefixes = fs
      .readdirSync(baseUrl, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => !name.startsWith('.') && !IGNORED_BASE_ENTRIES.has(name))
      .map((name) => `${name}/`)
  } catch {
    prefixes = []
  }

  baseUrlCache.set(baseUrl, prefixes)
  return prefixes
}

/**
 * Collects alias prefixes for the file being formatted.
 *
 * Lookup starts at the file's own directory rather than `process.cwd()`, so a
 * monorepo package picks up its own tsconfig instead of the repository root's.
 */
export function resolveAliases(fileDir: string | null, extraAliases: string[]): string[] {
  const prefixes = new Set<string>()

  for (const alias of extraAliases) {
    const prefix = toPrefix(alias)
    if (prefix) prefixes.add(prefix)
  }

  if (fileDir) {
    const config = findTsConfig(fileDir)
    if (config) {
      for (const key of Object.keys(config.paths)) {
        const prefix = toPrefix(key)
        if (prefix) prefixes.add(prefix)
      }

      if (config.baseUrl) {
        for (const prefix of baseUrlPrefixes(config.baseUrl)) prefixes.add(prefix)
      }
    }
  }

  // Longest first, so `@app/ui/` is tested before `@app/`.
  return [...prefixes].sort((a, b) => b.length - a.length)
}
