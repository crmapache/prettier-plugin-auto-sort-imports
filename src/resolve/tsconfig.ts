import fs from 'fs'
import path from 'path'

export interface TsConfigData {
  paths: Record<string, unknown>
  baseUrl: string | null
  /** Directory the config lives in, used to resolve `baseUrl`. */
  dir: string
}

const CONFIG_NAMES = ['tsconfig.json', 'jsconfig.json']

interface CacheEntry<T> {
  mtimeMs: number
  value: T
}

const fileCache = new Map<string, CacheEntry<TsConfigData | null>>()
const lookupCache = new Map<string, string | null>()

/**
 * Strips `//` and comments while leaving string literals alone, then
 * drops trailing commas. tsconfig.json is JSONC in practice - the Next.js, Vite
 * and CRA templates all ship comments in it, and a plain `JSON.parse` throws.
 */
function parseJsonc(text: string): unknown {
  let out = ''
  let i = 0
  let inString = false

  while (i < text.length) {
    const char = text.charAt(i)

    if (inString) {
      out += char
      if (char === '\\') {
        out += text.charAt(i + 1)
        i += 2
        continue
      }
      if (char === '"') inString = false
      i += 1
      continue
    }

    if (char === '"') {
      inString = true
      out += char
      i += 1
      continue
    }

    if (char === '/' && text.charAt(i + 1) === '/') {
      while (i < text.length && text.charAt(i) !== '\n') i += 1
      continue
    }

    if (char === '/' && text.charAt(i + 1) === '*') {
      i += 2
      while (i < text.length && !(text.charAt(i) === '*' && text.charAt(i + 1) === '/')) i += 1
      i += 2
      continue
    }

    out += char
    i += 1
  }

  return JSON.parse(stripTrailingCommas(out))
}

function stripTrailingCommas(text: string): string {
  let out = ''
  let i = 0
  let inString = false

  while (i < text.length) {
    const char = text.charAt(i)

    if (inString) {
      out += char
      if (char === '\\') {
        out += text.charAt(i + 1)
        i += 2
        continue
      }
      if (char === '"') inString = false
      i += 1
      continue
    }

    if (char === '"') {
      inString = true
      out += char
      i += 1
      continue
    }

    if (char === ',') {
      let j = i + 1
      while (j < text.length && /\s/.test(text.charAt(j))) j += 1
      const next = text.charAt(j)
      if (next === '}' || next === ']') {
        i += 1
        continue
      }
    }

    out += char
    i += 1
  }

  return out
}

/** Resolves an `extends` entry, which may be relative or a package name. */
function resolveExtends(target: string, fromDir: string): string | null {
  const candidates: string[] = []

  if (target.startsWith('.')) {
    candidates.push(path.resolve(fromDir, target))
    candidates.push(`${path.resolve(fromDir, target)}.json`)
  } else {
    try {
      candidates.push(require.resolve(target, { paths: [fromDir] }))
    } catch {
      // Not installed - fall through to the path guesses below.
    }
    candidates.push(path.resolve(fromDir, 'node_modules', target))
    candidates.push(path.resolve(fromDir, 'node_modules', target, 'tsconfig.json'))
  }

  for (const candidate of candidates) {
    try {
      if (fs.statSync(candidate).isFile()) return candidate
    } catch {
      // Try the next candidate.
    }
  }

  return null
}

function readConfigFile(configPath: string, seen: Set<string>): TsConfigData | null {
  if (seen.has(configPath)) return null
  seen.add(configPath)

  let mtimeMs: number
  try {
    mtimeMs = fs.statSync(configPath).mtimeMs
  } catch {
    return null
  }

  const cached = fileCache.get(configPath)
  if (cached && cached.mtimeMs === mtimeMs) return cached.value

  let value: TsConfigData | null = null

  try {
    const raw = parseJsonc(fs.readFileSync(configPath, 'utf8')) as {
      extends?: string | string[]
      compilerOptions?: { paths?: Record<string, unknown>; baseUrl?: string }
    }

    const dir = path.dirname(configPath)
    let paths: Record<string, unknown> = {}
    let baseUrl: string | null = null

    // Bases are applied first so the current file wins on conflicts.
    const bases = Array.isArray(raw.extends) ? raw.extends : raw.extends ? [raw.extends] : []
    for (const base of bases) {
      const basePath = resolveExtends(base, dir)
      if (!basePath) continue
      const baseData = readConfigFile(basePath, seen)
      if (!baseData) continue
      paths = { ...paths, ...baseData.paths }
      if (baseData.baseUrl) baseUrl = baseData.baseUrl
    }

    if (raw.compilerOptions?.paths) paths = { ...paths, ...raw.compilerOptions.paths }
    if (raw.compilerOptions?.baseUrl) baseUrl = path.resolve(dir, raw.compilerOptions.baseUrl)

    value = { paths, baseUrl, dir }
  } catch {
    value = null
  }

  fileCache.set(configPath, { mtimeMs, value })
  return value
}

/** Walks up from `startDir` looking for the nearest tsconfig or jsconfig. */
export function findTsConfig(startDir: string): TsConfigData | null {
  const cachedPath = lookupCache.get(startDir)
  if (cachedPath !== undefined) {
    return cachedPath ? readConfigFile(cachedPath, new Set()) : null
  }

  let dir = startDir
  for (;;) {
    for (const name of CONFIG_NAMES) {
      const candidate = path.join(dir, name)
      try {
        if (fs.statSync(candidate).isFile()) {
          lookupCache.set(startDir, candidate)
          return readConfigFile(candidate, new Set())
        }
      } catch {
        // Keep looking.
      }
    }

    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }

  lookupCache.set(startDir, null)
  return null
}
