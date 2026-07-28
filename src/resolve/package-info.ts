import fs from 'fs'
import path from 'path'

const dependencyCache = new Map<string, Set<string>>()

/**
 * Reads the dependency names of the nearest package.json, walking up from the
 * file being formatted. Used only to pick a preset, so a miss is harmless.
 */
export function findDependencies(startDir: string): Set<string> {
  const cached = dependencyCache.get(startDir)
  if (cached) return cached

  let dependencies = new Set<string>()
  let dir = startDir

  for (;;) {
    const candidate = path.join(dir, 'package.json')
    try {
      const raw = JSON.parse(fs.readFileSync(candidate, 'utf8')) as {
        dependencies?: Record<string, string>
        devDependencies?: Record<string, string>
        peerDependencies?: Record<string, string>
      }
      dependencies = new Set([
        ...Object.keys(raw.dependencies ?? {}),
        ...Object.keys(raw.devDependencies ?? {}),
        ...Object.keys(raw.peerDependencies ?? {}),
      ])
      break
    } catch {
      // Keep looking upwards.
    }

    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }

  dependencyCache.set(startDir, dependencies)
  return dependencies
}
