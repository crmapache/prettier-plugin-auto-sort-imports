import path from 'path'

import { DEFAULT_GROUPS, PRESETS, detectPreset } from './presets'
import { resolveAliases } from './resolve/aliases'
import { findDependencies } from './resolve/package-info'
import { findWorkspacePackages } from './resolve/workspace'
import type { ImportGroupId, PresetName, ResolvedOptions, SpecifierOrder } from './types'

/** Prettier option declarations, surfaced in `prettier --help` and editor UIs. */
export const options = {
  sortImportsPreset: {
    type: 'choice' as const,
    category: 'AutoSortImports',
    default: 'auto',
    description:
      'Framework defaults for import grouping. "auto" detects the framework from the nearest package.json.',
    choices: [
      { value: 'auto', description: 'Detect from package.json' },
      { value: 'react', description: 'React' },
      { value: 'next', description: 'Next.js' },
      { value: 'nest', description: 'NestJS' },
      { value: 'node', description: 'Plain Node.js / backend' },
      { value: 'vue', description: 'Vue' },
      { value: 'nuxt', description: 'Nuxt' },
      { value: 'svelte', description: 'Svelte / SvelteKit' },
      { value: 'angular', description: 'Angular' },
      { value: 'none', description: 'No framework defaults' },
    ],
  },
  sortImportsGroups: {
    type: 'string' as const,
    category: 'AutoSortImports',
    array: true,
    default: [{ value: [] as string[] }],
    description: `Group order. Valid ids: ${DEFAULT_GROUPS.join(', ')}. Empty means the preset default.`,
  },
  sortImportsPriorityPackages: {
    type: 'string' as const,
    category: 'AutoSortImports',
    array: true,
    default: [{ value: [] as string[] }],
    description:
      'Packages pinned to the top of the library group, in the given order. Empty means the preset default.',
  },
  sortImportsAliases: {
    type: 'string' as const,
    category: 'AutoSortImports',
    array: true,
    default: [{ value: [] as string[] }],
    description:
      'Extra alias prefixes for bundler aliases that are absent from tsconfig/jsconfig, e.g. "~/" or "@app/".',
  },
  sortImportsSpecifierOrder: {
    type: 'choice' as const,
    category: 'AutoSortImports',
    default: 'length',
    description: 'How to order the names inside the braces of a named import.',
    choices: [
      { value: 'length', description: 'Shortest first, then alphabetical' },
      { value: 'alphabetical', description: 'Alphabetical' },
      { value: 'none', description: 'Leave untouched' },
    ],
  },
  sortImportsSeparator: {
    type: 'boolean' as const,
    category: 'AutoSortImports',
    default: true,
    description: 'Insert a blank line between import groups.',
  },
  sortImportsGroupScoped: {
    type: 'boolean' as const,
    category: 'AutoSortImports',
    default: true,
    description:
      'Give third-party scoped packages such as @mui/material their own group. Turn off to sort them among the unscoped libraries.',
  },
  sortImportsDetectWorkspace: {
    type: 'boolean' as const,
    category: 'AutoSortImports',
    default: true,
    description:
      'Give packages from this repository their own group. Detected from the workspace protocol, a "workspaces" field or pnpm-workspace.yaml. Turn off to sort them among third-party libraries.',
  },
  sortImportsRemoveUnused: {
    type: 'boolean' as const,
    category: 'AutoSortImports',
    default: false,
    description:
      'Remove import bindings that are never referenced. Off by default: deleting code during formatting should be an explicit choice.',
  },
  sortImportsIgnorePragma: {
    type: 'string' as const,
    category: 'AutoSortImports',
    default: '@sort-imports-ignore',
    description: 'Comment pragma that disables this plugin for a file.',
  },
}

/** Prettier passes its own options object; only these keys are ours. */
interface PrettierOptionsLike {
  filepath?: string
  filePath?: string
  parser?: string
  sortImportsPreset?: PresetName
  sortImportsGroups?: string[]
  sortImportsPriorityPackages?: string[]
  sortImportsAliases?: string[]
  sortImportsSpecifierOrder?: SpecifierOrder
  sortImportsSeparator?: boolean
  sortImportsGroupScoped?: boolean
  sortImportsDetectWorkspace?: boolean
  sortImportsRemoveUnused?: boolean
  sortImportsIgnorePragma?: string
}

const VALID_GROUPS = new Set<string>(DEFAULT_GROUPS)
const VALID_SPECIFIER_ORDERS = new Set<string>(['length', 'alphabetical', 'none'])

function asArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

export function getFilePath(raw: PrettierOptionsLike | undefined): string | undefined {
  return raw?.filepath ?? raw?.filePath
}

export function resolveOptions(raw: PrettierOptionsLike | undefined): ResolvedOptions {
  const filepath = getFilePath(raw)
  const fileDir = filepath ? path.dirname(path.resolve(filepath)) : null

  const requested = raw?.sortImportsPreset ?? 'auto'
  const presetName =
    requested === 'auto' ? detectPreset(findDependencies(fileDir ?? process.cwd())) : requested
  const preset = PRESETS[presetName] ?? PRESETS.none

  const requestedGroups = asArray(raw?.sortImportsGroups).filter((group) => VALID_GROUPS.has(group))
  const groups = (
    requestedGroups.length > 0 ? requestedGroups : preset.groups
  ) as ImportGroupId[]

  const requestedPriority = asArray(raw?.sortImportsPriorityPackages)
  const specifierOrder = raw?.sortImportsSpecifierOrder
  const ignorePragma = raw?.sortImportsIgnorePragma

  return {
    // A group the user left out must still be printed, otherwise its imports
    // would silently disappear. Missing ids are appended in their default order.
    groups: [...groups, ...DEFAULT_GROUPS.filter((group) => !groups.includes(group))],
    priorityPackages: requestedPriority.length > 0 ? requestedPriority : preset.priorityPackages,
    aliases: resolveAliases(fileDir, asArray(raw?.sortImportsAliases)),
    workspacePackages:
      raw?.sortImportsDetectWorkspace === false || !fileDir
        ? new Set<string>()
        : findWorkspacePackages(fileDir),
    groupScoped: raw?.sortImportsGroupScoped !== false,
    specifierOrder:
      specifierOrder && VALID_SPECIFIER_ORDERS.has(specifierOrder) ? specifierOrder : 'length',
    separator: raw?.sortImportsSeparator !== false,
    removeUnused: raw?.sortImportsRemoveUnused === true,
    ignorePragma:
      typeof ignorePragma === 'string' && ignorePragma.trim() !== ''
        ? ignorePragma
        : '@sort-imports-ignore',
  }
}
