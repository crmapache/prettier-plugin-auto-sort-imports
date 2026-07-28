import type { ImportGroupId, PresetName } from './types'

export interface Preset {
  groups: ImportGroupId[]
  priorityPackages: string[]
}

export const DEFAULT_GROUPS: ImportGroupId[] = [
  'polyfill',
  'builtin',
  'library',
  'alias',
  'relative',
  'side-effect',
]

export const PRESETS: Record<Exclude<PresetName, 'auto'>, Preset> = {
  react: {
    groups: DEFAULT_GROUPS,
    priorityPackages: ['react', 'react-dom', 'react-router', 'react-router-dom'],
  },
  next: {
    groups: DEFAULT_GROUPS,
    priorityPackages: ['react', 'react-dom', 'next'],
  },
  nest: {
    groups: DEFAULT_GROUPS,
    priorityPackages: [
      'reflect-metadata',
      '@nestjs/common',
      '@nestjs/core',
      '@nestjs/config',
      '@nestjs/typeorm',
      'typeorm',
    ],
  },
  node: {
    groups: DEFAULT_GROUPS,
    priorityPackages: [],
  },
  vue: {
    groups: DEFAULT_GROUPS,
    priorityPackages: ['vue', 'vue-router', 'pinia', 'vuex'],
  },
  nuxt: {
    groups: DEFAULT_GROUPS,
    priorityPackages: ['vue', 'vue-router', 'nuxt', 'pinia'],
  },
  svelte: {
    groups: DEFAULT_GROUPS,
    priorityPackages: ['svelte', '@sveltejs/kit'],
  },
  angular: {
    groups: DEFAULT_GROUPS,
    priorityPackages: ['@angular/core', '@angular/common', 'rxjs'],
  },
  none: {
    groups: DEFAULT_GROUPS,
    priorityPackages: [],
  },
}

/** More specific frameworks are checked first: Nuxt before Vue, Next before React. */
const DETECTION_ORDER: Array<[Exclude<PresetName, 'auto' | 'none'>, string[]]> = [
  ['nuxt', ['nuxt', 'nuxt3']],
  ['next', ['next']],
  ['nest', ['@nestjs/core', '@nestjs/common']],
  ['angular', ['@angular/core']],
  ['svelte', ['svelte', '@sveltejs/kit']],
  ['vue', ['vue']],
  ['react', ['react', 'preact']],
]

export function detectPreset(dependencies: Set<string>): Exclude<PresetName, 'auto'> {
  for (const [preset, markers] of DETECTION_ORDER) {
    if (markers.some((marker) => dependencies.has(marker))) return preset
  }
  return 'node'
}
